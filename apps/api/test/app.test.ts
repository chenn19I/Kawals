import type { Hono } from 'hono';
import { describe, expect, it } from 'vitest';
import { ALAMAT, scenarios } from '@kawal/fixtures';
import { sui } from '@kawal/rules';
import { createApp } from '../src/app';
import { loadConfig } from '../src/config';
import type { NetworkProvider, NetworkSnapshot } from '../src/tatum';
import type { DecisionRecord, EvaluationRecord, MemoryCatalogEntry } from '../src/types';

interface ApiErrorBody {
  error: { code: string; message: string };
}

function makeApp(env: Record<string, string> = {}, network?: NetworkProvider): Hono {
  const config = loadConfig({
    KAWAL_MEMORY_MODE: 'mock',
    KAWAL_MEMORY_WRITE_SYNC: '1',
    KAWAL_RATE_LIMIT_MAX: '500',
    ...env,
  } as NodeJS.ProcessEnv);
  return createApp({ config, ...(network ? { network } : {}) });
}

function fakeNetwork(overrides: Partial<NetworkSnapshot> = {}): NetworkProvider {
  return {
    configured: true,
    network: 'mainnet',
    snapshot: async (owner?: string): Promise<NetworkSnapshot> => ({
      configured: true,
      network: 'mainnet',
      endpoint: 'sui-mainnet-grpc.gateway.tatum.io:443',
      checkpoint: '339615546',
      checkpointDigest: `0x${'1'.repeat(64)}`,
      chainIdentifier: '4btiuiMPvEENsttpZC7CZ53DruC3LA2HSGcdYTLJHVaG',
      referenceGasPriceMist: '100',
      balanceMist: sui('20').toString(),
      balanceOwner: owner ?? null,
      latencyMs: 42,
      fetchedAt: new Date().toISOString(),
      cached: false,
      errors: [],
      ...overrides,
    }),
    close: () => undefined,
  };
}


async function post(app: Hono, path: string, body: unknown): Promise<Response> {
  return app.request(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

async function read<T>(response: Response): Promise<T> {
  return (await response.json()) as T;
}

describe('GET /health', () => {
  it('reports service state without secret material', async () => {
    const app = makeApp();
    const response = await app.request('/health');
    expect(response.status).toBe(200);

    const body = await read<Record<string, unknown>>(response);
    expect(body).toMatchObject({
      service: 'kawal-api',
      status: 'ok',
      rules: 'R1-R9',
      memory: 'mock',
      guard: 'active',
    });
    expect(body).not.toHaveProperty('walrus');
    expect(body).not.toHaveProperty('adminToken');
    expect(JSON.stringify(body)).not.toMatch(/MEMWAL|private|secret/i);
  });
});

describe('CORS', () => {
  it('allows both local web origins and refuses unknown ones', async () => {
    const app = makeApp();

    const local = await app.request('/health', {
      headers: { Origin: 'http://localhost:5173' },
    });
    expect(local.headers.get('access-control-allow-origin')).toBe('http://localhost:5173');

    const loopback = await app.request('/health', {
      headers: { Origin: 'http://127.0.0.1:5173' },
    });
    expect(loopback.headers.get('access-control-allow-origin')).toBe('http://127.0.0.1:5173');

    const stranger = await app.request('/health', {
      headers: { Origin: 'https://evil.example' },
    });
    expect(stranger.headers.get('access-control-allow-origin')).toBeNull();

    const wildcard = makeApp({ KAWAL_CORS_ORIGIN: '*' });
    const open = await wildcard.request('/health', {
      headers: { Origin: 'https://example.test' },
    });
    expect(open.headers.get('access-control-allow-origin')).toBe('*');
  });
});

describe('GET /scenarios', () => {
  it('lists all twelve Pasar Tiruan scenarios', async () => {
    const app = makeApp();
    const response = await app.request('/scenarios');
    expect(response.status).toBe(200);

    const body = await read<{ count: number; scenarios: Array<{ id: string }> }>(response);
    expect(body.count).toBe(12);
    expect(body.scenarios).toHaveLength(12);
    expect(body.scenarios[0]?.id).toBe(scenarios[0]?.id);
  });
});

describe('POST /evaluate', () => {
  it('evaluates a mock scenario with memory-derived thresholds', async () => {
    const app = makeApp();
    const response = await post(app, '/evaluate', {
      mode: 'mock',
      scenarioId: 'transfer-12-sui-alamat-baru',
    });
    expect(response.status).toBe(201);

    const { evaluation } = await read<{ evaluation: EvaluationRecord }>(response);
    expect(evaluation.mode).toBe('mock');
    expect(evaluation.scenarioId).toBe('transfer-12-sui-alamat-baru');
    expect(evaluation.verdict.decision).toBe('TAHAN');
    expect(evaluation.verdict.triggered).toEqual(['R3', 'R4']);
    expect(evaluation.policy.thresholds.maxOutflow.sui).toBe('5');
    expect(evaluation.policy.thresholds.newRecipientMax.sui).toBe('1');
    expect(evaluation.policy.thresholds.maxOutflow.memory?.id).toBe('mem-batas-outflow');
    expect(evaluation.memories.length).toBeGreaterThan(0);
    expect(evaluation.explanation.source).toBe('template');
    expect(evaluation.timing.totalMs).toBeGreaterThanOrEqual(0);
  });

  it('returns TOLAK when the recipient is on the deny list', async () => {
    const app = makeApp();
    const response = await post(app, '/evaluate', {
      mode: 'mock',
      scenarioId: 'alamat-pernah-ditolak',
    });
    const { evaluation } = await read<{ evaluation: EvaluationRecord }>(response);
    expect(evaluation.verdict.decision).toBe('TOLAK');
    expect(evaluation.verdict.triggered).toEqual(['R2']);
  });

  it('returns LOLOS for a trusted recipient below the limit', async () => {
    const app = makeApp();
    const response = await post(app, '/evaluate', {
      mode: 'mock',
      scenarioId: 'alamat-dipercaya',
    });
    const { evaluation } = await read<{ evaluation: EvaluationRecord }>(response);
    expect(evaluation.verdict.decision).toBe('LOLOS');
    expect(evaluation.verdict.triggered).toEqual(['R8']);
  });

  it('evaluates replay input through the same rules engine', async () => {
    const app = makeApp();
    const response = await post(app, '/evaluate', {
      mode: 'replay',
      transfer: { recipient: ALAMAT.dipercaya, amountMist: sui('2').toString() },
      simulation: {
        status: 'success',
        totalOutflowMist: sui('2').toString(),
        calledPackages: ['0x2'],
        leavingObjects: [],
      },
      history: { hasSentToRecipientBefore: true },
    });
    expect(response.status).toBe(201);

    const { evaluation } = await read<{ evaluation: EvaluationRecord }>(response);
    expect(evaluation.mode).toBe('replay');
    expect(evaluation.verdict.decision).toBe('LOLOS');
    expect(evaluation.verdict.triggered).toEqual(['R8']);
    expect(evaluation.transfer.amountMist).toBe(sui('2').toString());
  });

  it('rejects live mode with a clear blocker', async () => {
    const app = makeApp();
    const response = await post(app, '/evaluate', { mode: 'live' });
    expect(response.status).toBe(501);
    const body = await read<ApiErrorBody>(response);
    expect(body.error.code).toBe('LIVE_SIMULATION_NOT_READY');
  });

  it('rejects unknown scenarios', async () => {
    const app = makeApp();
    const response = await post(app, '/evaluate', {
      mode: 'mock',
      scenarioId: 'tidak-ada',
    });
    expect(response.status).toBe(404);
    const body = await read<ApiErrorBody>(response);
    expect(body.error.code).toBe('SCENARIO_NOT_FOUND');
  });

  it('rejects malformed replay data', async () => {
    const app = makeApp();
    const badAddress = await post(app, '/evaluate', {
      mode: 'replay',
      transfer: { recipient: '0xzz', amountMist: '1000' },
      simulation: {
        status: 'success',
        totalOutflowMist: '1000',
        calledPackages: [],
        leavingObjects: [],
      },
      history: { hasSentToRecipientBefore: false },
    });
    expect(badAddress.status).toBe(400);
    expect((await read<ApiErrorBody>(badAddress)).error.code).toBe('INVALID_REQUEST');

    const badAmount = await post(app, '/evaluate', {
      mode: 'replay',
      transfer: { recipient: ALAMAT.baru, amountMist: '1.5' },
      simulation: {
        status: 'success',
        totalOutflowMist: '1.5',
        calledPackages: [],
        leavingObjects: [],
      },
      history: { hasSentToRecipientBefore: false },
    });
    expect(badAmount.status).toBe(400);
  });

  it('rejects invalid JSON without crashing', async () => {
    const app = makeApp();
    const response = await app.request('/evaluate', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{bukan json',
    });
    expect(response.status).toBe(400);
    expect((await read<ApiErrorBody>(response)).error.code).toBe('INVALID_JSON');
  });
});

describe('POST /decisions', () => {
  it('stores a decision and turns it into a written memory', async () => {
    const app = makeApp();
    const evaluationResponse = await post(app, '/evaluate', {
      mode: 'mock',
      scenarioId: 'transfer-12-sui-alamat-baru',
    });
    const { evaluation } = await read<{ evaluation: EvaluationRecord }>(evaluationResponse);

    const response = await post(app, '/decisions', {
      evaluationId: evaluation.id,
      decision: 'TOLAK',
      note: 'Penjual baru, nominal terlalu besar.',
      addressStance: 'deny',
    });
    expect(response.status).toBe(201);

    const { decision } = await read<{ decision: DecisionRecord }>(response);
    expect(decision.evaluationId).toBe(evaluation.id);
    expect(decision.decision).toBe('TOLAK');
    expect(decision.engineDecision).toBe('TAHAN');
    expect(decision.memory.status).toBe('written');
    expect(decision.memory.blobId).toBeTruthy();

    const memoriesResponse = await app.request('/memories?limit=100');
    const memories = await read<{ memories: MemoryCatalogEntry[] }>(memoriesResponse);
    const statements = memories.memories.map((entry) => entry.record.statement);
    expect(statements.some((text) => text.includes('menolak transfer 12 SUI'))).toBe(true);
    expect(statements.some((text) => text.includes('tidak mempercayai alamat'))).toBe(true);
  });

  it('changes the next evaluation when an address stance is remembered', async () => {
    const app = makeApp();
    const first = await post(app, '/evaluate', {
      mode: 'mock',
      scenarioId: 'transfer-12-sui-alamat-baru',
    });
    const { evaluation } = await read<{ evaluation: EvaluationRecord }>(first);
    expect(evaluation.verdict.decision).toBe('TAHAN');

    await post(app, '/decisions', {
      evaluationId: evaluation.id,
      decision: 'TOLAK',
      addressStance: 'deny',
    });

    const second = await post(app, '/evaluate', {
      mode: 'mock',
      scenarioId: 'transfer-12-sui-alamat-baru',
    });
    const repeated = await read<{ evaluation: EvaluationRecord }>(second);
    expect(repeated.evaluation.verdict.decision).toBe('TOLAK');
    expect(repeated.evaluation.verdict.triggered).toContain('R2');
  });

  it('rejects decisions for unknown evaluations', async () => {
    const app = makeApp();
    const response = await post(app, '/decisions', {
      evaluationId: 'eval-tidak-ada',
      decision: 'TOLAK',
    });
    expect(response.status).toBe(404);
    expect((await read<ApiErrorBody>(response)).error.code).toBe('EVALUATION_NOT_FOUND');
  });

  it('rejects an invalid decision value', async () => {
    const app = makeApp();
    const response = await post(app, '/decisions', {
      evaluationId: 'eval-x',
      decision: 'MUNGKIN',
    });
    expect(response.status).toBe(400);
    expect((await read<ApiErrorBody>(response)).error.code).toBe('INVALID_REQUEST');
  });
});

describe('GET and DELETE /memories', () => {
  it('lists seeded memories and marks a memory as forgotten', async () => {
    const app = makeApp();
    const listResponse = await app.request('/memories?limit=100');
    expect(listResponse.status).toBe(200);
    const list = await read<{ count: number; memories: MemoryCatalogEntry[] }>(listResponse);
    expect(list.count).toBe(6);
    expect(list.memories).toHaveLength(6);

    const target = list.memories[0];
    expect(target).toBeDefined();
    const deleteResponse = await app.request(`/memories/${target!.record.id}`, {
      method: 'DELETE',
    });
    expect(deleteResponse.status).toBe(200);
    const removed = await read<{ memory: MemoryCatalogEntry }>(deleteResponse);
    expect(removed.memory.forgotten).toBe(true);

    const afterResponse = await app.request('/memories?limit=100');
    const after = await read<{ count: number; memories: MemoryCatalogEntry[] }>(afterResponse);
    expect(after.count).toBe(5);
    expect(after.memories.some((entry) => entry.record.id === target!.record.id)).toBe(false);
  });

  it('filters memories by query text and validates the limit', async () => {
    const app = makeApp();
    const response = await app.request('/memories?query=penjual&limit=10');
    const body = await read<{ count: number; memories: MemoryCatalogEntry[] }>(response);
    expect(body.count).toBeGreaterThanOrEqual(1);
    expect(
      body.memories.every((entry) =>
        `${entry.record.statement} ${entry.record.kind}`.toLowerCase().includes('penjual'),
      ),
    ).toBe(true);

    const bad = await app.request('/memories?limit=1000');
    expect(bad.status).toBe(400);
  });

  it('returns 404 for an unknown memory', async () => {
    const app = makeApp();
    const response = await app.request('/memories/tidak-ada', { method: 'DELETE' });
    expect(response.status).toBe(404);
  });
});

describe('POST /revoke', () => {
  it('blocks new evaluations until restored', async () => {
    const app = makeApp();
    const revoke = await post(app, '/revoke', {});
    expect(revoke.status).toBe(200);

    const blocked = await post(app, '/evaluate', {
      mode: 'mock',
      scenarioId: 'alamat-dipercaya',
    });
    expect(blocked.status).toBe(409);
    expect((await read<ApiErrorBody>(blocked)).error.code).toBe('GUARD_REVOKED');

    const health = await read<{ guard: string }>(await app.request('/health'));
    expect(health.guard).toBe('revoked');

    const restore = await post(app, '/restore', {});
    expect(restore.status).toBe(200);
    const allowed = await post(app, '/evaluate', {
      mode: 'mock',
      scenarioId: 'alamat-dipercaya',
    });
    expect(allowed.status).toBe(201);
  });

  it('requires the admin token when configured', async () => {
    const app = makeApp({ KAWAL_ADMIN_TOKEN: 'token-demo' });

    const denied = await post(app, '/revoke', {});
    expect(denied.status).toBe(401);
    expect((await read<ApiErrorBody>(denied)).error.code).toBe('UNAUTHORIZED');

    const wrong = await app.request('/revoke', {
      method: 'POST',
      headers: { authorization: 'Bearer salah' },
    });
    expect(wrong.status).toBe(401);

    const allowed = await app.request('/revoke', {
      method: 'POST',
      headers: { authorization: 'Bearer token-demo' },
    });
    expect(allowed.status).toBe(200);
  });
});

describe('rate limiting', () => {
  it('returns 429 after the configured number of mutating requests', async () => {
    const app = makeApp({ KAWAL_RATE_LIMIT_MAX: '2', KAWAL_RATE_LIMIT_WINDOW_MS: '60000' });
    expect((await post(app, '/restore', {})).status).toBe(200);
    expect((await post(app, '/restore', {})).status).toBe(200);
    const limited = await post(app, '/restore', {});
    expect(limited.status).toBe(429);
    expect((await read<ApiErrorBody>(limited)).error.code).toBe('RATE_LIMITED');
  });
});

describe('POST /preflight', () => {
  it('fails closed when Tatum is not configured', async () => {
    const app = makeApp();
    const response = await post(app, '/preflight', {
      sender: ALAMAT.teman,
      recipient: ALAMAT.dipercaya,
      amountMist: sui('2').toString(),
    });
    expect(response.status).toBe(503);
    expect((await read<ApiErrorBody>(response)).error.code).toBe('NETWORK_NOT_CONFIGURED');
  });

  it('combines a Tatum snapshot with Walrus recall', async () => {
    const app = makeApp({}, fakeNetwork());
    const response = await post(app, '/preflight', {
      sender: ALAMAT.teman,
      recipient: ALAMAT.dipercaya,
      amountMist: sui('0.5').toString(),
    });
    expect(response.status).toBe(201);

    const { evaluation } = await read<{ evaluation: EvaluationRecord }>(response);
    expect(evaluation.mode).toBe('intent');
    expect(evaluation.verdict.decision).toBe('LOLOS');
    expect(evaluation.verdict.triggered).toEqual(['R8']);
    expect(evaluation.transfer.sender).toBe(ALAMAT.teman);
    expect(evaluation.network?.checkpoint).toBe('339615546');
    expect(evaluation.network?.balanceMist).toBe(sui('20').toString());
    expect(evaluation.network?.latencyMs).toBe(42);
    expect(evaluation.gas?.budgetSui).toBe('0.005');
    expect(evaluation.warnings).toEqual(['GAS_BUDGET_ESTIMATE', 'RISK_SOURCE_NOT_CONNECTED']);
    expect(evaluation.history.source).toBe('recorded-decisions');
    expect(
      evaluation.verdict.usedMemories.some((memory) => memory.id === 'mem-alamat-dipercaya'),
    ).toBe(true);
  });

  it('rejects the transfer when Tatum returns no checkpoint', async () => {
    const app = makeApp({}, fakeNetwork({ checkpoint: null, checkpointDigest: null }));
    const response = await post(app, '/preflight', {
      sender: ALAMAT.teman,
      recipient: ALAMAT.dipercaya,
      amountMist: sui('2').toString(),
    });
    expect(response.status).toBe(503);
    expect((await read<ApiErrorBody>(response)).error.code).toBe('NETWORK_UNAVAILABLE');
  });

  it('turns a short balance into R1 instead of a pass', async () => {
    const app = makeApp({}, fakeNetwork({ balanceMist: sui('1').toString() }));
    const response = await post(app, '/preflight', {
      sender: ALAMAT.teman,
      recipient: ALAMAT.dipercaya,
      amountMist: sui('2').toString(),
    });
    expect(response.status).toBe(201);

    const { evaluation } = await read<{ evaluation: EvaluationRecord }>(response);
    expect(evaluation.verdict.decision).toBe('TOLAK');
    expect(evaluation.verdict.triggered).toEqual(['R1']);
    expect(evaluation.verdict.findings[0]?.evidence.failureCode).toBe('INSUFFICIENT_BALANCE');
  });

  it('rejects a sender that matches the recipient', async () => {
    const app = makeApp({}, fakeNetwork());
    const response = await post(app, '/preflight', {
      sender: ALAMAT.dipercaya,
      recipient: ALAMAT.dipercaya,
      amountMist: sui('2').toString(),
    });
    expect(response.status).toBe(400);
    expect((await read<ApiErrorBody>(response)).error.code).toBe('INVALID_REQUEST');
  });
});

describe('GET /network', () => {
  it('returns Tatum evidence without exposing the API key', async () => {
    const app = makeApp({}, fakeNetwork());
    const response = await app.request(`/network?owner=${ALAMAT.teman}`);
    expect(response.status).toBe(200);

    const { network } = await read<{ network: NetworkSnapshot }>(response);
    expect(network.configured).toBe(true);
    expect(network.checkpoint).toBe('339615546');
    expect(network.balanceOwner).toBe(ALAMAT.teman);
    expect(JSON.stringify(network)).not.toMatch(/api[-_]?key|secret/i);
  });

  it('reports an unconfigured provider without a 503', async () => {
    const app = makeApp();
    const response = await app.request('/network');
    expect(response.status).toBe(200);
    const { network } = await read<{ network: NetworkSnapshot }>(response);
    expect(network.configured).toBe(false);
    expect(network.checkpoint).toBeNull();
    expect(network.errors).toContain('NOT_CONFIGURED');
  });

  it('rejects an invalid owner address', async () => {
    const app = makeApp({}, fakeNetwork());
    const response = await app.request('/network?owner=0xzz');
    expect(response.status).toBe(400);
  });
});

describe('POST /self-test', () => {
  it('replays all twelve fixtures through the same engine', async () => {
    const app = makeApp();
    const response = await post(app, '/self-test', {});
    expect(response.status).toBe(200);

    const { report } = await read<{
      report: {
        passed: boolean;
        total: number;
        passedCount: number;
        results: Array<{ ok: boolean; expected: string; actual: string }>;
      };
    }>(response);
    expect(report.total).toBe(12);
    expect(report.passedCount).toBe(12);
    expect(report.passed).toBe(true);
    expect(report.results.every((result) => result.ok)).toBe(true);
    expect(report.results.every((result) => result.expected === result.actual)).toBe(true);
  });
});

describe('POST /memories', () => {
  it('writes a bilingual threshold rule and returns a blob id', async () => {
    const app = makeApp();
    const response = await post(app, '/memories', {
      kind: 'aturan',
      statement: 'Aturan saya: tahan transfer di atas 3 SUI.',
      statementEn: 'My rule: hold transfers above 3 SUI.',
      threshold: { appliesTo: ['maxOutflow'], mist: sui('3').toString() },
    });
    expect(response.status).toBe(201);

    const body = await read<{
      memory: MemoryCatalogEntry;
      write: { status: string; blobId: string };
    }>(response);
    expect(body.memory.record.statementEn).toBe('My rule: hold transfers above 3 SUI.');
    expect(body.memory.record.data?.threshold?.mist).toBe(sui('3').toString());
    expect(body.write.status).toBe('written');
    expect(body.write.blobId).toBeTruthy();

    const list = await read<{ count: number; memories: MemoryCatalogEntry[] }>(
      await app.request('/memories?limit=100'),
    );
    expect(list.count).toBe(7);
    expect(list.memories.some((entry) => entry.record.id === body.memory.record.id)).toBe(true);
  });

  it('requires a threshold when the memory is a rule', async () => {
    const app = makeApp();
    const response = await post(app, '/memories', {
      kind: 'aturan',
      statement: 'Aturan tanpa batas.',
    });
    expect(response.status).toBe(400);
    expect((await read<ApiErrorBody>(response)).error.code).toBe('INVALID_REQUEST');
  });
});

