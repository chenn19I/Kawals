import type {
  Decision,
  MemoryRecord,
  PolicyInput,
  ResolvedPolicy,
  SimulationOutcome,
  Verdict,
} from '@kawal/rules';

export interface MemoryRecordRef {
  id: string;
  kind: MemoryRecord['kind'];
  statement: string;
  statementEn?: string;
}

export interface ThresholdDto {
  mist: string;
  sui: string;
  memory?: MemoryRecordRef;
}

export interface PolicyDto {
  denyList: Array<{ address: string; memory?: MemoryRecordRef }>;
  trustList: Array<{ address: string; memory?: MemoryRecordRef }>;
  knownPackages: string[];
  thresholds: {
    maxOutflow: ThresholdDto;
    newRecipientMax: ThresholdDto;
    trustedMax: ThresholdDto;
  };
}

export interface RecalledMemory {
  id: string;
  kind: MemoryRecord['kind'];
  statement: string;
  statementEn?: string;
  data?: MemoryRecord['data'];
  blobId: string;
  distance: number;
  createdAt: string | null;
}

export interface RecalledMemoryDto {
  id: string;
  kind: MemoryRecord['kind'];
  statement: string;
  statementEn?: string;
  data?: MemoryRecord['data'];
  blobId: string;
  distance: number;
  createdAt: string | null;
}

export interface MemoryCatalogEntry {
  record: MemoryRecord;
  blobId: string;
  createdAt: string;
  forgotten: boolean;
  source: 'mock' | 'walrus';
}

export interface MemoryWriteState {
  status: 'queued' | 'written' | 'failed';
  memoryId: string;
  blobId?: string;
  error?: string;
  updatedAt: string;
}

export interface DecisionRecord {
  id: string;
  evaluationId: string;
  decision: Decision;
  engineDecision: Decision;
  note?: string;
  createdAt: string;
  memory: MemoryWriteState;
}

export interface DecisionListItem extends DecisionRecord {
  transfer: { recipient: string; amountMist: string };
  verdict: Decision;
}

export interface SimulationDto {
  status: SimulationOutcome['status'];
  failureReason?: string;
  failureCode?: string;
  totalOutflowMist: string;
  totalOutflowSui: string;
  calledPackages: string[];
  leavingObjects: Array<{ objectId: string; objectType: string }>;
}

export interface NetworkEvidenceDto {
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

export interface GasEstimateDto {
  budgetMist: string;
  budgetSui: string;
  method: 'buffer' | 'reference';
  note: string;
}

export interface EvaluationRecord {
  id: string;
  createdAt: string;
  mode: 'mock' | 'replay' | 'intent';
  scenarioId?: string;
  scenarioTitle?: string;
  transfer: { sender?: string; recipient: string; amountMist: string };
  simulation: SimulationDto;
  history: { hasSentToRecipientBefore: boolean; source?: 'recorded-decisions' | 'scenario' };
  risk?: { dangerous: boolean; source: string };
  verdict: Verdict;
  policy: PolicyDto;
  memories: RecalledMemoryDto[];
  explanation: { summary: string; details: string[]; source: string };
  timing: { totalMs: number; recallMs: number; networkMs?: number };
  network?: NetworkEvidenceDto;
  gas?: GasEstimateDto;
  warnings?: string[];
}

export interface StateData {
  evaluations: EvaluationRecord[];
  decisions: DecisionRecord[];
  memoryCatalog: MemoryCatalogEntry[];
  forgotten: string[];
  revoked: boolean;
}

export interface EvaluationRequestBase {
  mode: 'mock' | 'replay';
}

export interface MockEvaluationRequest extends EvaluationRequestBase {
  mode: 'mock';
  scenarioId: string;
}

export interface ReplayEvaluationRequest extends EvaluationRequestBase {
  mode: 'replay';
  transfer: { recipient: string; amountMist: bigint };
  simulation: SimulationOutcome;
  history: { hasSentToRecipientBefore: boolean };
  risk?: { dangerous: boolean; source: string };
  knownPackages?: string[];
}

export type EvaluationRequest = MockEvaluationRequest | ReplayEvaluationRequest;

export interface PreflightRequest {
  sender: string;
  recipient: string;
  amountMist: bigint;
}

export interface DecisionRequest {
  evaluationId: string;
  decision: Decision;
  note?: string;
  addressStance?: 'trust' | 'deny';
}

export interface MemoryCreateRequest {
  kind: MemoryRecord['kind'];
  statement: string;
  statementEn?: string;
  address?: string;
  stance?: 'trust' | 'deny';
  threshold?: {
    appliesTo: Array<'maxOutflow' | 'newRecipientMax' | 'trustedMax'>;
    mist: string;
  };
}

export interface MemoryListQuery {
  query?: string;
  limit: number;
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

export interface PolicySource {
  policy: PolicyInput;
  resolved: ResolvedPolicy;
}
