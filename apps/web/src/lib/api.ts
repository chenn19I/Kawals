import type { Decision, MemoryKind, RuleId, ThresholdKey } from '@kawal/rules';

const configured = import.meta.env.VITE_API_URL?.trim();

function resolveApiBaseUrl(): string {
  if (configured) return configured.replace(/\/+$/, '');
  if (typeof window !== 'undefined') {
    const host = window.location.hostname;
    if (host === 'localhost' || host === '127.0.0.1') {
      return 'http://127.0.0.1:8787';
    }
    return '';
  }
  return 'http://127.0.0.1:8787';
}

/** Only the public API origin lives in the browser bundle. */
export const API_BASE_URL = resolveApiBaseUrl();

export class ApiRequestError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = 'ApiRequestError';
    this.status = status;
    this.code = code;
  }
}

interface ErrorEnvelope {
  error?: { code?: unknown; message?: unknown };
}

async function request<T>(
  path: string,
  init: RequestInit = {},
  signal?: AbortSignal,
): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set('Accept', 'application/json');
  if (init.body !== undefined) headers.set('Content-Type', 'application/json');

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, { ...init, headers, signal });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error;
    throw new ApiRequestError(0, 'NETWORK', 'The Kawal API cannot be reached.');
  }

  const text = await response.text();
  let body: unknown = null;
  if (text) {
    try {
      body = JSON.parse(text) as unknown;
    } catch {
      body = null;
    }
  }

  if (!response.ok) {
    const envelope = (body ?? {}) as ErrorEnvelope;
    const code = typeof envelope.error?.code === 'string' ? envelope.error.code : `HTTP_${response.status}`;
    const message =
      typeof envelope.error?.message === 'string'
        ? envelope.error.message
        : `The API returned HTTP ${response.status}.`;
    throw new ApiRequestError(response.status, code, message);
  }

  return body as T;
}

export interface ApiHealth {
  service: string;
  version: string;
  status: string;
  rules: string;
  memory: 'mock' | 'walrus';
  memoryWriteSync: boolean;
  liveSimulation: 'enabled' | 'blocked';
  tatum: 'mainnet' | 'testnet' | null;
  guard: 'active' | 'revoked';
  uptimeMs: number;
  timestamp: string;
}

export interface NetworkEvidence {
  configured: boolean;
  network: 'mainnet' | 'testnet';
  endpoint: string | null;
  checkpoint: string | null;
  checkpointDigest: string | null;
  chainIdentifier: string | null;
  referenceGasPriceMist: string | null;
  balanceMist: string | null;
  balanceOwner: string | null;
  latencyMs: number;
  fetchedAt: string;
  cached: boolean;
  errors: string[];
}

export interface Finding {
  rule: RuleId;
  decision: Decision;
  message: string;
  evidence: Record<string, string>;
  memoryIds: string[];
}

export interface MemoryRef {
  id: string;
  kind: MemoryKind;
  statement: string;
  statementEn?: string;
}

export interface Verdict {
  decision: Decision;
  triggered: RuleId[];
  findings: Finding[];
  usedMemories: MemoryRef[];
}

export interface ThresholdDto {
  mist: string;
  sui: string;
  memory?: MemoryRef;
}

export interface PolicyDto {
  denyList: Array<{ address: string; memory?: MemoryRef }>;
  trustList: Array<{ address: string; memory?: MemoryRef }>;
  knownPackages: string[];
  thresholds: Record<ThresholdKey, ThresholdDto>;
}

export interface MemoryData {
  address?: string;
  stance?: 'trust' | 'deny';
  threshold?: {
    appliesTo: ThresholdKey[];
    mist: string;
  };
}

export interface RecalledMemory {
  id: string;
  kind: MemoryKind;
  statement: string;
  statementEn?: string;
  data?: MemoryData;
  blobId: string;
  distance: number;
  createdAt: string | null;
}

export interface SimulationDto {
  status: 'success' | 'failed' | 'timeout';
  failureReason?: string;
  failureCode?: string;
  totalOutflowMist: string;
  totalOutflowSui: string;
  calledPackages: string[];
  leavingObjects: Array<{ objectId: string; objectType: string }>;
}

export interface GasEstimate {
  budgetMist: string;
  budgetSui: string;
  method: 'buffer' | 'reference';
  note: string;
}

export interface Evaluation {
  id: string;
  createdAt: string;
  mode: 'mock' | 'replay' | 'intent';
  scenarioId?: string;
  scenarioTitle?: string;
  transfer: { sender?: string; recipient: string; amountMist: string };
  simulation: SimulationDto;
  history: { hasSentToRecipientBefore: boolean; source?: string };
  risk?: { dangerous: boolean; source: string };
  verdict: Verdict;
  policy: PolicyDto;
  memories: RecalledMemory[];
  explanation: { summary: string; details: string[]; source: string };
  timing: { totalMs: number; recallMs: number; networkMs?: number };
  network?: NetworkEvidence;
  gas?: GasEstimate;
  warnings?: string[];
}

export interface MemoryCatalogEntry {
  record: {
    id: string;
    kind: MemoryKind;
    statement: string;
    statementEn?: string;
    data?: MemoryData;
  };
  blobId: string;
  createdAt: string;
  forgotten: boolean;
  source: 'mock' | 'walrus';
}

export interface DecisionRecord {
  id: string;
  evaluationId: string;
  decision: Decision;
  engineDecision: Decision;
  note?: string;
  createdAt: string;
  memory: {
    status: 'queued' | 'written' | 'failed';
    memoryId: string;
    blobId?: string;
    error?: string;
    updatedAt: string;
  };
}

export interface DecisionListItem extends DecisionRecord {
  transfer: { sender?: string; recipient: string; amountMist: string };
  verdict: Decision;
}

export interface SelfTestResult {
  id: string;
  title: string;
  titleEn: string;
  expected: Decision;
  actual: Decision;
  expectedRules: string[];
  actualRules: string[];
  ok: boolean;
}

export interface SelfTestReport {
  passed: boolean;
  total: number;
  passedCount: number;
  results: SelfTestResult[];
  ranAt: string;
}

export interface MemoryListResponse {
  mode: 'mock' | 'walrus';
  count: number;
  warning: string | null;
  refreshedAt: string;
  memories: MemoryCatalogEntry[];
}

export interface CreateMemoryInput {
  kind: MemoryKind;
  statement: string;
  statementEn?: string;
  address?: string;
  stance?: 'trust' | 'deny';
  threshold?: {
    appliesTo: ThresholdKey[];
    mist: string;
  };
}

export function fetchHealth(signal?: AbortSignal): Promise<ApiHealth> {
  return request<ApiHealth>('/health', {}, signal);
}

export function fetchNetwork(owner?: string, signal?: AbortSignal): Promise<NetworkEvidence> {
  const query = owner ? `?owner=${encodeURIComponent(owner)}` : '';
  return request<{ network: NetworkEvidence }>(`/network${query}`, {}, signal).then(
    (body) => body.network,
  );
}

export function fetchMemories(
  options: { limit?: number; query?: string } = {},
  signal?: AbortSignal,
): Promise<MemoryListResponse> {
  const params = new URLSearchParams();
  params.set('limit', String(options.limit ?? 100));
  if (options.query?.trim()) params.set('query', options.query.trim());
  return request<MemoryListResponse>(`/memories?${params.toString()}`, {}, signal);
}

export function createMemory(
  input: CreateMemoryInput,
  signal?: AbortSignal,
): Promise<{ memory: MemoryCatalogEntry; write: { status: string; blobId: string } }> {
  return request('/memories', { method: 'POST', body: JSON.stringify(input) }, signal);
}

export function forgetMemory(
  id: string,
  signal?: AbortSignal,
): Promise<{ memory: MemoryCatalogEntry; onchainRevoked: boolean; note: string }> {
  return request(`/memories/${encodeURIComponent(id)}`, { method: 'DELETE' }, signal);
}

export function runScenario(
  scenarioId: string,
  signal?: AbortSignal,
): Promise<Evaluation> {
  return request<{ evaluation: Evaluation }>(
    '/evaluate',
    { method: 'POST', body: JSON.stringify({ mode: 'mock', scenarioId }) },
    signal,
  ).then((body) => body.evaluation);
}

export function runReplay(
  input: {
    transfer: { recipient: string; amountMist: string };
    simulation: SimulationDto;
    history: { hasSentToRecipientBefore: boolean };
    risk?: { dangerous: boolean; source: string };
    knownPackages?: string[];
  },
  signal?: AbortSignal,
): Promise<Evaluation> {
  return request<{ evaluation: Evaluation }>(
    '/evaluate',
    { method: 'POST', body: JSON.stringify({ mode: 'replay', ...input }) },
    signal,
  ).then((body) => body.evaluation);
}

export function runPreflight(
  input: { sender: string; recipient: string; amountMist: string },
  signal?: AbortSignal,
): Promise<Evaluation> {
  return request<{ evaluation: Evaluation }>(
    '/preflight',
    { method: 'POST', body: JSON.stringify(input) },
    signal,
  ).then((body) => body.evaluation);
}

export function recordDecision(
  input: {
    evaluationId: string;
    decision: Decision;
    note?: string;
    addressStance?: 'trust' | 'deny';
  },
  signal?: AbortSignal,
): Promise<DecisionRecord> {
  return request<{ decision: DecisionRecord }>(
    '/decisions',
    { method: 'POST', body: JSON.stringify(input) },
    signal,
  ).then((body) => body.decision);
}

export function fetchDecision(id: string, signal?: AbortSignal): Promise<DecisionRecord> {
  return request<{ decision: DecisionRecord }>(
    `/decisions/${encodeURIComponent(id)}`,
    {},
    signal,
  ).then((body) => body.decision);
}

export function fetchDecisions(
  limit = 20,
  signal?: AbortSignal,
): Promise<DecisionListItem[]> {
  return request<{ decisions: DecisionListItem[] }>(
    `/decisions?limit=${limit}`,
    {},
    signal,
  ).then((body) => body.decisions);
}

export function revokeGuard(signal?: AbortSignal): Promise<{ revoked: boolean; note: string }> {
  return request('/revoke', { method: 'POST' }, signal);
}

export function restoreGuard(signal?: AbortSignal): Promise<{ revoked: boolean; note: string }> {
  return request('/restore', { method: 'POST' }, signal);
}

export function runSelfTest(signal?: AbortSignal): Promise<SelfTestReport> {
  return request<{ report: SelfTestReport }>('/self-test', { method: 'POST' }, signal).then(
    (body) => body.report,
  );
}

export interface EvaluationSummary {
  id: string;
  scenarioId?: string;
  scenarioTitle?: string;
  transfer: { sender?: string; recipient: string; amountMist: string };
  verdict: Verdict;
  createdAt: string;
  policy: PolicyDto;
}

export function fetchEvaluations(
  limit = 50,
  signal?: AbortSignal,
): Promise<EvaluationSummary[]> {
  return request<{ evaluations: EvaluationSummary[] }>(
    `/evaluations?limit=${limit}`,
    {},
    signal,
  ).then((body) => body.evaluations);
}
