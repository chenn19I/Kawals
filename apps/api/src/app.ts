import { randomUUID, timingSafeEqual } from 'node:crypto';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { scenarios } from '@kawal/fixtures';
import {
  evaluate,
  formatSui,
  normalizeAddress,
  policyFromMemories,
  resolvePolicy,
  safeNormalizeAddress,
  shortAddress,
  type HistoryContext,
  type MemoryRecord,
  type PolicyAddress,
  type PolicyInput,
  type RecipientRisk,
  type SimulationOutcome,
  type TransferIntent,
} from '@kawal/rules';
import type { ApiConfig } from './config';
import type { ExplanationResult, Explainer } from './explain';
import { TemplateExplainer } from './explain';
import {
  createMemoryRepository,
  seedMemories,
  type MemoryRepository,
} from './memory';
import { StateStore } from './state';
import { createNetworkProvider, type NetworkProvider, type NetworkSnapshot } from './tatum';
import {
  ApiError,
  parseDecisionRequest,
  parseEvaluateRequest,
  parseMemoryCreateRequest,
  parseMemoryListQuery,
  parsePreflightRequest,
} from './validation';
import {
  toDecisionDto,
  toEvaluationDto,
  toMemoryCatalogDto,
  toPolicyDto,
  toRecalledMemoryDto,
  toScenarioDto,
  toSimulationDto,
} from './dto';
import type {
  DecisionListItem,
  DecisionRecord,
  EvaluationRecord,
  MemoryCatalogEntry,
  NetworkEvidenceDto,
  RecalledMemory,
  SelfTestResult,
} from './types';

export interface AppDeps {
  config: ApiConfig;
  state?: StateStore;
  memories?: MemoryRepository;
  network?: NetworkProvider;
  explainer?: Explainer;
}

const BULAN = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'Mei',
  'Jun',
  'Jul',
  'Agu',
  'Sep',
  'Okt',
  'Nov',
  'Des',
] as const;

const MONTHS_EN = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const;

const GAS_BUFFER_MIST = 5_000_000n;

function formatDateId(date: Date): string {
  return `${date.getDate()} ${BULAN[date.getMonth()]} ${date.getFullYear()}`;
}

function formatDateEn(date: Date): string {
  return `${date.getDate()} ${MONTHS_EN[date.getMonth()]} ${date.getFullYear()}`;
}

function safeEqual(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

function dedupeAddresses(entries: readonly PolicyAddress[]): PolicyAddress[] {
  const map = new Map<string, PolicyAddress>();
  for (const entry of entries) {
    const current = map.get(entry.address);
    if (!current || (!current.memory && entry.memory)) {
      map.set(entry.address, entry);
    }
  }
  return [...map.values()];
}

/** Gabungkan kebijakan dari memori dengan kebijakan bawaan pemanggil. */
export function mergePolicyInput(
  recalled: readonly RecalledMemory[],
  base: PolicyInput = {},
): PolicyInput {
  const merged = policyFromMemories(recalled, base);
  const denyList = dedupeAddresses(merged.denyList ?? []);
  const denied = new Set(denyList.map((entry) => entry.address));
  const trustList = dedupeAddresses(merged.trustList ?? []).filter(
    (entry) => !denied.has(entry.address),
  );
  return { ...merged, denyList, trustList };
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function toNetworkDto(snapshot: NetworkSnapshot): NetworkEvidenceDto {
  return { ...snapshot };
}

function emptyNetwork(network: 'mainnet' | 'testnet'): NetworkSnapshot {
  return {
    configured: false,
    network,
    endpoint: null,
    checkpoint: null,
    checkpointDigest: null,
    chainIdentifier: null,
    referenceGasPriceMist: null,
    balanceMist: null,
    balanceOwner: null,
    latencyMs: 0,
    fetchedAt: new Date().toISOString(),
    cached: false,
    errors: ['NOT_CONFIGURED'],
  };
}

export function createApp(deps: AppDeps): Hono {
  const { config } = deps;
  const explainer = deps.explainer ?? new TemplateExplainer();
  const memory = deps.memories ?? createMemoryRepository(config, seedMemories());
  const network = deps.network ?? createNetworkProvider(config.tatum);
  const state = deps.state ?? new StateStore(config.stateFile);
  const startedAt = Date.now();
  const rateBuckets = new Map<string, { count: number; resetAt: number }>();
  const corsOrigins = config.corsOrigin
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);

  if (config.memoryMode === 'mock') {
    state.seedMemories(seedMemories());
  }

  const app = new Hono();

  app.use(
    '*',
    cors({
      origin: corsOrigins.includes('*') ? '*' : corsOrigins,
      allowMethods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
      allowHeaders: ['Content-Type', 'Authorization'],
      maxAge: 600,
    }),
  );

  app.use('*', async (c, next) => {
    if (c.req.method === 'GET' || c.req.method === 'OPTIONS') return next();
    const key =
      c.req.header('x-forwarded-for')?.split(',')[0]?.trim() || 'lokal';
    const now = Date.now();
    const bucket = rateBuckets.get(key);
    if (!bucket || bucket.resetAt <= now) {
      rateBuckets.set(key, { count: 1, resetAt: now + config.rateLimitWindowMs });
      return next();
    }
    bucket.count += 1;
    if (bucket.count > config.rateLimitMax) {
      return c.json(
        {
          error: {
            code: 'RATE_LIMITED',
            message: 'Terlalu banyak permintaan. Coba lagi sebentar.',
          },
        },
        429,
      );
    }
    return next();
  });

  const guardActive = (): void => {
    if (state.isRevoked()) {
      throw new ApiError(
        409,
        'GUARD_REVOKED',
        'Penjaga dicabut. Aktifkan kembali sebelum memeriksa transaksi baru.',
      );
    }
  };

  const requireAdmin = (authorization: string | undefined): void => {
    if (!config.adminToken) return;
    const provided = authorization?.startsWith('Bearer ')
      ? authorization.slice(7).trim()
      : '';
    if (!safeEqual(provided, config.adminToken)) {
      throw new ApiError(
        401,
        'UNAUTHORIZED',
        'Token admin diperlukan untuk mengubah status penjaga.',
      );
    }
  };

  const readJson = async (request: Request): Promise<unknown> => {
    try {
      return (await request.json()) as unknown;
    } catch {
      throw new ApiError(400, 'INVALID_JSON', 'Body harus berupa JSON yang sah.');
    }
  };

  async function recalledFor(recipient: string): Promise<RecalledMemory[]> {
    const recalled = await memory.recallForEvaluation(recipient);
    return recalled.filter(
      (entry) => !state.isForgotten(entry.blobId, entry.id),
    );
  }

  function hasRecordedSend(recipient: string): boolean {
    for (const decision of state.listDecisions(300)) {
      if (decision.decision === 'TOLAK') continue;
      const evaluation = state.getEvaluation(decision.evaluationId);
      if (!evaluation) continue;
      const candidate = safeNormalizeAddress(evaluation.transfer.recipient);
      if (candidate && candidate === recipient) return true;
    }
    return false;
  }

  function buildSimulation(input: SimulationOutcome): ReturnType<typeof toSimulationDto> {
    return toSimulationDto(input);
  }

  app.get('/health', (c) =>
    c.json({
      service: config.serviceName,
      version: config.version,
      status: 'ok',
      rules: 'R1-R9',
      memory: config.memoryMode,
      memoryWriteSync: config.memoryWriteSync,
      liveSimulation: config.liveSimulation ? 'enabled' : 'blocked',
      tatum: config.tatum?.network ?? null,
      guard: state.isRevoked() ? 'revoked' : 'active',
      uptimeMs: Date.now() - startedAt,
      timestamp: new Date().toISOString(),
    }),
  );

  app.get('/network', async (c) => {
    const rawOwner = c.req.query('owner')?.trim();
    const owner = rawOwner ? safeNormalizeAddress(rawOwner) : undefined;
    if (rawOwner && !owner) {
      throw new ApiError(400, 'INVALID_REQUEST', 'owner bukan alamat Sui yang sah.');
    }

    if (!network.configured) {
      return c.json({ network: emptyNetwork(network.network) });
    }

    try {
      return c.json({ network: toNetworkDto(await network.snapshot(owner ?? undefined)) });
    } catch {
      return c.json(
        {
          error: {
            code: 'NETWORK_UNAVAILABLE',
            message: 'Tatum tidak dapat dihubungi saat ini.',
          },
        },
        503,
      );
    }
  });

  app.get('/scenarios', (c) =>
    c.json({
      count: scenarios.length,
      scenarios: scenarios.map(toScenarioDto),
    }),
  );

  app.post('/self-test', (c) => {
    const results: SelfTestResult[] = scenarios.map((scenario) => {
      const verdict = evaluate(scenario.input);
      const actualRules = [...verdict.triggered];
      const ok =
        verdict.decision === scenario.expected.decision &&
        actualRules.length === scenario.expected.rules.length &&
        actualRules.every((rule, index) => rule === scenario.expected.rules[index]);

      return {
        id: scenario.id,
        title: scenario.title,
        titleEn: scenario.titleEn,
        expected: scenario.expected.decision,
        actual: verdict.decision,
        expectedRules: [...scenario.expected.rules],
        actualRules,
        ok,
      };
    });

    return c.json({
      report: {
        passed: results.every((result) => result.ok),
        total: results.length,
        passedCount: results.filter((result) => result.ok).length,
        results,
        ranAt: new Date().toISOString(),
      },
    });
  });

  app.post('/preflight', async (c) => {
    guardActive();
    if (!network.configured) {
      throw new ApiError(
        503,
        'NETWORK_NOT_CONFIGURED',
        'Tatum belum dikonfigurasi di server. Pemeriksaan jaringan tidak dapat dijalankan.',
      );
    }

    const body = parsePreflightRequest(await readJson(c.req.raw));
    const recallStart = Date.now();

    let recalled: RecalledMemory[];
    let snapshot: NetworkSnapshot;
    try {
      [recalled, snapshot] = await Promise.all([
        recalledFor(body.recipient),
        network.snapshot(body.sender),
      ]);
    } catch (error) {
      console.error('[kawal-api] preflight gagal:', errorMessage(error));
      throw new ApiError(
        503,
        'MEMORY_UNAVAILABLE',
        'Walrus Memory tidak dapat dibaca. Pemeriksaan dihentikan agar aturan tidak dilewati.',
      );
    }

    const recallMs = Date.now() - recallStart;
    if (!snapshot.checkpoint) {
      throw new ApiError(
        503,
        'NETWORK_UNAVAILABLE',
        'Tatum tidak memberi checkpoint. Pemeriksaan jaringan tidak dapat dijalankan.',
      );
    }

    const gasPrice = snapshot.referenceGasPriceMist
      ? BigInt(snapshot.referenceGasPriceMist)
      : 100n;
    const gasBudgetMist = gasPrice * 1000n > GAS_BUFFER_MIST ? gasPrice * 1000n : GAS_BUFFER_MIST;
    const totalOutflowMist = body.amountMist + gasBudgetMist;
    const warnings: string[] = ['GAS_BUDGET_ESTIMATE', 'RISK_SOURCE_NOT_CONNECTED'];

    let simulation: SimulationOutcome;
    if (snapshot.balanceMist !== null && totalOutflowMist > BigInt(snapshot.balanceMist)) {
      simulation = {
        status: 'failed',
        failureCode: 'INSUFFICIENT_BALANCE',
        failureReason:
          'The balance is below the amount plus the gas budget. The transfer cannot be checked.',
        totalOutflowMist,
        calledPackages: [],
        leavingObjects: [],
      };
    } else {
      simulation = {
        status: 'success',
        totalOutflowMist,
        calledPackages: [],
        leavingObjects: [],
      };
    }

    if (snapshot.balanceMist === null) {
      warnings.push('BALANCE_UNAVAILABLE');
    }

    const history: HistoryContext = { hasSentToRecipientBefore: hasRecordedSend(body.recipient) };
    const policyInput = mergePolicyInput(recalled, {});
    const policy = resolvePolicy(policyInput);
    const transfer: TransferIntent = {
      recipient: body.recipient,
      amountMist: body.amountMist,
    };
    const risk: RecipientRisk | undefined = undefined;
    const verdict = evaluate({ transfer, simulation, history, risk, policy: policyInput });
    const explanation: ExplanationResult = explainer.explain(verdict);

    const record: EvaluationRecord = {
      id: `eval-${randomUUID()}`,
      createdAt: new Date().toISOString(),
      mode: 'intent',
      transfer: {
        sender: body.sender,
        recipient: body.recipient,
        amountMist: body.amountMist.toString(),
      },
      simulation: buildSimulation(simulation),
      history: { ...history, source: 'recorded-decisions' },
      verdict,
      policy: toPolicyDto(policy),
      memories: recalled.map(toRecalledMemoryDto),
      explanation,
      timing: {
        totalMs: Date.now() - recallStart,
        recallMs,
        networkMs: snapshot.latencyMs,
      },
      network: toNetworkDto(snapshot),
      gas: {
        budgetMist: gasBudgetMist.toString(),
        budgetSui: formatSui(gasBudgetMist),
        method: 'buffer',
        note: 'A fixed gas budget for a simple SUI transfer, not a simulated gas result.',
      },
      warnings,
    };

    state.addEvaluation(record);
    return c.json({ evaluation: toEvaluationDto(record) }, 201);
  });

  app.post('/evaluate', async (c) => {
    guardActive();
    const body = parseEvaluateRequest(await readJson(c.req.raw));

    let scenario: (typeof scenarios)[number] | undefined;
    let transfer: TransferIntent;
    let simulation: SimulationOutcome;
    let history: HistoryContext;
    let risk: RecipientRisk | undefined;
    let basePolicy: PolicyInput;

    if (body.mode === 'mock') {
      scenario = scenarios.find((entry) => entry.id === body.scenarioId);
      if (!scenario) {
        throw new ApiError(404, 'SCENARIO_NOT_FOUND', 'Skenario tidak ditemukan.');
      }
      transfer = scenario.input.transfer;
      simulation = scenario.input.simulation;
      history = scenario.input.history;
      risk = scenario.input.risk;
      basePolicy = scenario.input.policy ?? {};
    } else {
      transfer = body.transfer;
      simulation = body.simulation;
      history = body.history;
      risk = body.risk;
      basePolicy = { knownPackages: body.knownPackages ?? [] };
    }

    const recallStart = Date.now();
    const recalled = await recalledFor(transfer.recipient);
    const recallMs = Date.now() - recallStart;

    const policyInput = mergePolicyInput(recalled, basePolicy);
    const policy = resolvePolicy(policyInput);
    const verdict = evaluate({
      transfer,
      simulation,
      history,
      risk,
      policy: policyInput,
    });
    const explanation: ExplanationResult = explainer.explain(verdict);

    const record: EvaluationRecord = {
      id: `eval-${randomUUID()}`,
      createdAt: new Date().toISOString(),
      mode: body.mode,
      ...(scenario ? { scenarioId: scenario.id, scenarioTitle: scenario.title } : {}),
      transfer: {
        recipient: transfer.recipient,
        amountMist: transfer.amountMist.toString(),
      },
      simulation: buildSimulation(simulation),
      history: { ...history },
      ...(risk ? { risk: { ...risk } } : {}),
      verdict,
      policy: toPolicyDto(policy),
      memories: recalled.map(toRecalledMemoryDto),
      explanation,
      timing: { totalMs: Date.now() - recallStart, recallMs },
    };

    state.addEvaluation(record);
    return c.json({ evaluation: toEvaluationDto(record) }, 201);
  });

  function decisionMemory(
    evaluation: EvaluationRecord,
    decision: DecisionRecord['decision'],
    addressStance: 'trust' | 'deny' | undefined,
    now: Date,
  ): { records: MemoryRecord[]; primaryId: string } {
    const verb =
      decision === 'TOLAK'
        ? 'menolak'
        : decision === 'TAHAN'
          ? 'menahan'
          : 'meloloskan';
    const verbEn =
      decision === 'TOLAK'
        ? 'rejected'
        : decision === 'TAHAN'
          ? 'held'
          : 'passed';
    const amountSui = formatSui(BigInt(evaluation.transfer.amountMist));
    const recipientShort = shortAddress(evaluation.transfer.recipient);
    const primaryId = `mem-keputusan-${randomUUID()}`;
    const records: MemoryRecord[] = [
      {
        id: primaryId,
        kind: 'keputusan',
        statement: `Saya ${verb} transfer ${amountSui} SUI ke alamat ${recipientShort} pada ${formatDateId(now)}.`,
        statementEn: `I ${verbEn} a ${amountSui} SUI transfer to ${recipientShort} on ${formatDateEn(now)}.`,
      },
    ];

    if (addressStance) {
      records.push({
        id: `mem-alamat-${randomUUID()}`,
        kind: 'alamat',
        statement:
          addressStance === 'deny'
            ? `Saya tidak mempercayai alamat ${recipientShort} setelah putusan ${decision}.`
            : `Saya mempercayai alamat ${recipientShort} setelah putusan ${decision}.`,
        statementEn:
          addressStance === 'deny'
            ? `I do not trust the address ${recipientShort} after a ${decision} decision.`
            : `I trust the address ${recipientShort} after a ${decision} decision.`,
        data: {
          address: evaluation.transfer.recipient,
          stance: addressStance,
        },
      });
    }

    return { records, primaryId };
  }

  async function writeMemories(
    records: readonly MemoryRecord[],
    decisionId: string,
    primaryId: string,
  ): Promise<void> {
    try {
      let primaryBlob: string | undefined;
      for (const record of records) {
        const outcome = await memory.remember(record);
        if (!primaryBlob) primaryBlob = outcome.blobId;
        state.upsertMemory({
          record,
          blobId: outcome.blobId,
          createdAt: new Date().toISOString(),
          forgotten: false,
          source: memory.mode,
        });
      }
      state.updateDecisionMemory(decisionId, {
        status: 'written',
        memoryId: primaryId,
        ...(primaryBlob ? { blobId: primaryBlob } : {}),
        updatedAt: new Date().toISOString(),
      });
    } catch (error) {
      state.updateDecisionMemory(decisionId, {
        status: 'failed',
        memoryId: primaryId,
        error: errorMessage(error),
        updatedAt: new Date().toISOString(),
      });
    }
  }

  app.post('/decisions', async (c) => {
    guardActive();
    const body = parseDecisionRequest(await readJson(c.req.raw));
    const evaluation = state.getEvaluation(body.evaluationId);
    if (!evaluation) {
      throw new ApiError(
        404,
        'EVALUATION_NOT_FOUND',
        'Pemeriksaan tidak ditemukan atau sudah kedaluwarsa.',
      );
    }

    const now = new Date();
    const { records, primaryId } = decisionMemory(
      evaluation,
      body.decision,
      body.addressStance,
      now,
    );

    const decision: DecisionRecord = {
      id: `dec-${randomUUID()}`,
      evaluationId: evaluation.id,
      decision: body.decision,
      engineDecision: evaluation.verdict.decision,
      ...(body.note ? { note: body.note } : {}),
      createdAt: now.toISOString(),
      memory: {
        status: 'queued',
        memoryId: primaryId,
        updatedAt: now.toISOString(),
      },
    };
    state.addDecision(decision);

    for (const record of records) {
      state.upsertMemory({
        record,
        blobId: record.id,
        createdAt: now.toISOString(),
        forgotten: false,
        source: memory.mode,
      });
    }

    if (config.memoryWriteSync) {
      await writeMemories(records, decision.id, primaryId);
    } else {
      void writeMemories(records, decision.id, primaryId);
    }

    return c.json({ decision: toDecisionDto(decision) }, 201);
  });

  app.get('/decisions', (c) => {
    const rawLimit = c.req.query('limit')?.trim();
    const limit = rawLimit ? Math.min(Math.max(Number.parseInt(rawLimit, 10) || 20, 1), 100) : 20;
    const items: DecisionListItem[] = state.listDecisions(limit).map((decision) => {
      const evaluation = state.getEvaluation(decision.evaluationId);
      return {
        ...toDecisionDto(decision),
        transfer: evaluation?.transfer ?? { recipient: '', amountMist: '0' },
        verdict: evaluation?.verdict.decision ?? decision.decision,
      };
    });
    return c.json({ decisions: items });
  });

  app.get('/evaluations', (c) => {
    const rawLimit = c.req.query('limit')?.trim();
    const limit = rawLimit ? Math.min(Math.max(Number.parseInt(rawLimit, 10) || 50, 1), 500) : 50;
    const items = state.listEvaluations(limit);
    return c.json({ evaluations: items.map((record) => toEvaluationDto(record)) });
  });

  app.get('/decisions/:id', (c) => {
    const decision = state.getDecision(c.req.param('id'));
    if (!decision) {
      throw new ApiError(404, 'DECISION_NOT_FOUND', 'Keputusan tidak ditemukan.');
    }
    return c.json({ decision: toDecisionDto(decision) });
  });

  app.get('/evaluations/:id', (c) => {
    const evaluation = state.getEvaluation(c.req.param('id'));
    if (!evaluation) {
      throw new ApiError(404, 'EVALUATION_NOT_FOUND', 'Pemeriksaan tidak ditemukan.');
    }
    return c.json({ evaluation: toEvaluationDto(evaluation) });
  });

  app.get('/memories', async (c) => {
    const query = parseMemoryListQuery(c.req.query());
    let warning: string | null = null;

    if (memory.mode === 'walrus') {
      try {
        for (const entry of await memory.list()) {
          state.upsertMemory({
            record: {
              id: entry.id,
              kind: entry.kind,
              statement: entry.statement,
              ...(entry.statementEn ? { statementEn: entry.statementEn } : {}),
              ...(entry.data ? { data: entry.data } : {}),
            },
            blobId: entry.blobId,
            createdAt: entry.createdAt ?? new Date().toISOString(),
            forgotten: false,
            source: 'walrus',
          });
        }
      } catch (error) {
        console.error('[kawal-api] daftar Walrus gagal:', errorMessage(error));
        warning = 'MEMORY_LIST_UNAVAILABLE';
      }
    }

    let catalog = state.listMemories(true);
    const needle = query.query?.toLowerCase();
    const filtered = catalog.filter((entry) => {
      if (entry.forgotten || state.isForgotten(entry.blobId, entry.record.id)) {
        return false;
      }
      if (!needle) return true;
      const text =
        `${entry.record.statement} ${entry.record.statementEn ?? ''} ${entry.record.kind}`.toLowerCase();
      return needle.split(/\s+/).every((token) => text.includes(token));
    });

    return c.json({
      mode: memory.mode,
      count: filtered.length,
      warning,
      refreshedAt: new Date().toISOString(),
      memories: filtered.slice(0, query.limit).map(toMemoryCatalogDto),
    });
  });

  app.post('/memories', async (c) => {
    const body = parseMemoryCreateRequest(await readJson(c.req.raw));
    const record: MemoryRecord = {
      id: `mem-${randomUUID()}`,
      kind: body.kind,
      statement: body.statement,
      ...(body.statementEn ? { statementEn: body.statementEn } : {}),
      ...(body.kind === 'alamat' && body.address && body.stance
        ? { data: { address: normalizeAddress(body.address), stance: body.stance } }
        : {}),
      ...(body.kind === 'aturan' && body.threshold
        ? { data: { threshold: { ...body.threshold } } }
        : {}),
    };

    let outcome: { memoryId: string; blobId: string };
    try {
      outcome = await memory.remember(record);
    } catch (error) {
      console.error('[kawal-api] tulis memori gagal:', errorMessage(error));
      throw new ApiError(
        502,
        'MEMORY_WRITE_FAILED',
        'Memori tidak dapat ditulis ke Walrus. Tidak ada yang disimpan.',
      );
    }

    const entry: MemoryCatalogEntry = {
      record,
      blobId: outcome.blobId,
      createdAt: new Date().toISOString(),
      forgotten: false,
      source: memory.mode,
    };
    state.upsertMemory(entry);

    return c.json(
      {
        memory: toMemoryCatalogDto(entry),
        write: { status: 'written', blobId: outcome.blobId },
      },
      201,
    );
  });

  app.delete('/memories/:id', (c) => {
    const entry = state.forgetMemory(c.req.param('id'));
    if (!entry) {
      throw new ApiError(404, 'MEMORY_NOT_FOUND', 'Memori tidak ditemukan.');
    }
    return c.json({
      memory: toMemoryCatalogDto(entry),
      onchainRevoked: false,
      note: 'Tombstone lokal. Pencabutan blob di Walrus tetap membutuhkan dompet pemilik.',
    });
  });

  app.post('/revoke', (c) => {
    requireAdmin(c.req.header('authorization'));
    state.setRevoked(true);
    return c.json({
      revoked: true,
      note: 'Pemeriksaan baru dihentikan di server. Pencabutan delegate onchain belum dijalankan.',
    });
  });

  app.post('/restore', (c) => {
    requireAdmin(c.req.header('authorization'));
    state.setRevoked(false);
    return c.json({ revoked: false, note: 'Penjaga aktif kembali untuk sesi ini.' });
  });

  app.notFound((c) =>
    c.json(
      { error: { code: 'NOT_FOUND', message: 'Jalur tidak ditemukan.' } },
      404,
    ),
  );

  app.onError((error, c) => {
    if (error instanceof ApiError) {
      return c.json(
        { error: { code: error.code, message: error.message } },
        error.status,
      );
    }
    console.error('[kawal-api] kesalahan tak tertangani:', error);
    return c.json(
      {
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Terjadi kesalahan di server. Coba lagi.',
        },
      },
      500,
    );
  });

  return app;
}
