import { normalizeAddress, type SimulationOutcome } from '@kawal/rules';
import type {
  DecisionRequest,
  EvaluationRequest,
  MemoryCreateRequest,
  MemoryListQuery,
  PreflightRequest,
  ReplayEvaluationRequest,
} from './types';

export type HttpStatus = 400 | 401 | 404 | 409 | 413 | 429 | 500 | 501 | 502 | 503;

export class ApiError extends Error {
  readonly status: HttpStatus;
  readonly code: string;

  constructor(status: HttpStatus, code: string, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readString(
  value: unknown,
  field: string,
  options: { maxLength?: number; required?: boolean } = {},
): string {
  if (value === undefined || value === null) {
    if (options.required === false) return '';
    throw new ApiError(400, 'INVALID_REQUEST', `${field} wajib diisi.`);
  }
  if (typeof value !== 'string') {
    throw new ApiError(400, 'INVALID_REQUEST', `${field} harus berupa teks.`);
  }
  const trimmed = value.trim();
  if (!trimmed && options.required !== false) {
    throw new ApiError(400, 'INVALID_REQUEST', `${field} tidak boleh kosong.`);
  }
  if (options.maxLength && trimmed.length > options.maxLength) {
    throw new ApiError(
      400,
      'INVALID_REQUEST',
      `${field} maksimal ${options.maxLength} karakter.`,
    );
  }
  return trimmed;
}

function readBoolean(value: unknown, field: string): boolean {
  if (typeof value !== 'boolean') {
    throw new ApiError(400, 'INVALID_REQUEST', `${field} harus berupa boolean.`);
  }
  return value;
}

function readMist(value: unknown, field: string, allowZero: boolean): bigint {
  const text = readString(value, field);
  if (!/^\d+$/.test(text)) {
    throw new ApiError(400, 'INVALID_REQUEST', `${field} harus bilangan bulat MIST.`);
  }
  const mist = BigInt(text);
  if (!allowZero && mist <= 0n) {
    throw new ApiError(400, 'INVALID_REQUEST', `${field} harus lebih besar dari nol.`);
  }
  return mist;
}

function readAddress(value: unknown, field: string): string {
  const text = readString(value, field, { maxLength: 66 });
  try {
    return normalizeAddress(text);
  } catch {
    throw new ApiError(400, 'INVALID_REQUEST', `${field} bukan alamat Sui yang sah.`);
  }
}

function readStringArray(
  value: unknown,
  field: string,
  options: { maxItems?: number; required?: boolean } = {},
): string[] {
  if (value === undefined && options.required === false) return [];
  if (!Array.isArray(value)) {
    throw new ApiError(400, 'INVALID_REQUEST', `${field} harus berupa daftar.`);
  }
  const maxItems = options.maxItems ?? 100;
  if (value.length > maxItems) {
    throw new ApiError(400, 'INVALID_REQUEST', `${field} maksimal ${maxItems} item.`);
  }
  return value.map((item, index) => readString(item, `${field}[${index}]`, { maxLength: 300 }));
}

function readTransfer(value: unknown): { recipient: string; amountMist: bigint } {
  if (!isRecord(value)) {
    throw new ApiError(400, 'INVALID_REQUEST', 'transfer wajib berupa objek.');
  }
  return {
    recipient: readAddress(value.recipient, 'transfer.recipient'),
    amountMist: readMist(value.amountMist, 'transfer.amountMist', false),
  };
}

function readSimulation(value: unknown): SimulationOutcome {
  if (!isRecord(value)) {
    throw new ApiError(400, 'INVALID_REQUEST', 'simulation wajib berupa objek.');
  }
  const status = readString(value.status, 'simulation.status');
  if (status !== 'success' && status !== 'failed' && status !== 'timeout') {
    throw new ApiError(
      400,
      'INVALID_REQUEST',
      'simulation.status harus success, failed, atau timeout.',
    );
  }

  const failureReason =
    value.failureReason === undefined
      ? undefined
      : readString(value.failureReason, 'simulation.failureReason', { maxLength: 300 });
  const failureCode =
    value.failureCode === undefined
      ? undefined
      : readString(value.failureCode, 'simulation.failureCode', { maxLength: 80 });

  const leavingObjects = value.leavingObjects;
  if (!Array.isArray(leavingObjects)) {
    throw new ApiError(400, 'INVALID_REQUEST', 'simulation.leavingObjects harus berupa daftar.');
  }
  if (leavingObjects.length > 100) {
    throw new ApiError(400, 'INVALID_REQUEST', 'simulation.leavingObjects maksimal 100 item.');
  }

  return {
    status,
    failureReason,
    failureCode,
    totalOutflowMist: readMist(value.totalOutflowMist, 'simulation.totalOutflowMist', true),
    calledPackages: readStringArray(value.calledPackages, 'simulation.calledPackages', {
      maxItems: 50,
    }),
    leavingObjects: leavingObjects.map((item, index) => {
      if (!isRecord(item)) {
        throw new ApiError(
          400,
          'INVALID_REQUEST',
          `simulation.leavingObjects[${index}] harus berupa objek.`,
        );
      }
      return {
        objectId: readString(item.objectId, `simulation.leavingObjects[${index}].objectId`, {
          maxLength: 200,
        }),
        objectType: readString(item.objectType, `simulation.leavingObjects[${index}].objectType`, {
          maxLength: 300,
        }),
      };
    }),
  };
}

function readHistory(value: unknown): { hasSentToRecipientBefore: boolean } {
  if (!isRecord(value)) {
    throw new ApiError(400, 'INVALID_REQUEST', 'history wajib berupa objek.');
  }
  return {
    hasSentToRecipientBefore: readBoolean(
      value.hasSentToRecipientBefore,
      'history.hasSentToRecipientBefore',
    ),
  };
}

function readRisk(value: unknown): { dangerous: boolean; source: string } | undefined {
  if (value === undefined || value === null) return undefined;
  if (!isRecord(value)) {
    throw new ApiError(400, 'INVALID_REQUEST', 'risk wajib berupa objek.');
  }
  return {
    dangerous: readBoolean(value.dangerous, 'risk.dangerous'),
    source: readString(value.source, 'risk.source', { maxLength: 120, required: false }) || 'sumber data',
  };
}

export function parseEvaluateRequest(value: unknown): EvaluationRequest {
  if (!isRecord(value)) {
    throw new ApiError(400, 'INVALID_REQUEST', 'Body harus berupa objek JSON.');
  }

  const mode = value.mode === undefined ? 'mock' : readString(value.mode, 'mode');
  if (mode === 'live') {
    throw new ApiError(
      501,
      'LIVE_SIMULATION_NOT_READY',
      'Simulasi Tatum live belum aktif karena G1 penuh belum lulus. Pakai mode mock atau replay.',
    );
  }
  if (mode !== 'mock' && mode !== 'replay') {
    throw new ApiError(400, 'INVALID_REQUEST', 'mode harus mock, replay, atau live.');
  }

  if (mode === 'mock') {
    return {
      mode: 'mock',
      scenarioId: readString(value.scenarioId, 'scenarioId', { maxLength: 120 }),
    };
  }

  const replay: ReplayEvaluationRequest = {
    mode: 'replay',
    transfer: readTransfer(value.transfer),
    simulation: readSimulation(value.simulation),
    history: readHistory(value.history),
    risk: readRisk(value.risk),
    knownPackages: readStringArray(value.knownPackages, 'knownPackages', {
      maxItems: 50,
      required: false,
    }),
  };
  return replay;
}

export function parseDecisionRequest(value: unknown): DecisionRequest {
  if (!isRecord(value)) {
    throw new ApiError(400, 'INVALID_REQUEST', 'Body harus berupa objek JSON.');
  }

  const decision = readString(value.decision, 'decision');
  if (decision !== 'LOLOS' && decision !== 'TAHAN' && decision !== 'TOLAK') {
    throw new ApiError(400, 'INVALID_REQUEST', 'decision harus LOLOS, TAHAN, atau TOLAK.');
  }

  const addressStance =
    value.addressStance === undefined
      ? undefined
      : readString(value.addressStance, 'addressStance');
  if (addressStance !== undefined && addressStance !== 'trust' && addressStance !== 'deny') {
    throw new ApiError(400, 'INVALID_REQUEST', 'addressStance harus trust atau deny.');
  }

  return {
    evaluationId: readString(value.evaluationId, 'evaluationId', { maxLength: 100 }),
    decision,
    note:
      value.note === undefined
        ? undefined
        : readString(value.note, 'note', { maxLength: 500, required: false }),
    addressStance,
  };
}

export function parseMemoryListQuery(query: Record<string, string | undefined>): MemoryListQuery {
  const limitText = query.limit?.trim();
  let limit = 20;
  if (limitText) {
    if (!/^\d+$/.test(limitText)) {
      throw new ApiError(400, 'INVALID_REQUEST', 'limit harus bilangan bulat.');
    }
    limit = Number.parseInt(limitText, 10);
    if (limit < 1 || limit > 100) {
      throw new ApiError(400, 'INVALID_REQUEST', 'limit harus antara 1 dan 100.');
    }
  }

  const rawQuery = query.query?.trim();
  if (rawQuery && rawQuery.length > 200) {
    throw new ApiError(400, 'INVALID_REQUEST', 'query maksimal 200 karakter.');
  }

  return {
    query: rawQuery || undefined,
    limit,
  };
}

export function parsePreflightRequest(value: unknown): PreflightRequest {
  if (!isRecord(value)) {
    throw new ApiError(400, 'INVALID_REQUEST', 'Body harus berupa objek JSON.');
  }

  const sender = readAddress(value.sender, 'sender');
  const recipient = readAddress(value.recipient, 'recipient');
  if (sender === recipient) {
    throw new ApiError(400, 'INVALID_REQUEST', 'Penerima harus berbeda dari pengirim.');
  }

  const amountMist = readMist(value.amountMist, 'amountMist', false);
  if (amountMist > 10_000_000_000_000_000n) {
    throw new ApiError(400, 'INVALID_REQUEST', 'amountMist melebihi batas yang wajar.');
  }

  return { sender, recipient, amountMist };
}

const MEMORY_KINDS = ['aturan', 'alamat', 'keputusan', 'preferensi'] as const;
const THRESHOLD_KEYS = ['maxOutflow', 'newRecipientMax', 'trustedMax'] as const;

export function parseMemoryCreateRequest(value: unknown): MemoryCreateRequest {
  if (!isRecord(value)) {
    throw new ApiError(400, 'INVALID_REQUEST', 'Body harus berupa objek JSON.');
  }

  const kind = readString(value.kind, 'kind');
  if (!(MEMORY_KINDS as readonly string[]).includes(kind)) {
    throw new ApiError(
      400,
      'INVALID_REQUEST',
      'kind harus aturan, alamat, keputusan, atau preferensi.',
    );
  }

  const statement = readString(value.statement, 'statement', { maxLength: 500 });
  const statementEn =
    value.statementEn === undefined
      ? undefined
      : readString(value.statementEn, 'statementEn', { maxLength: 500, required: false });

  const request: MemoryCreateRequest = {
    kind: kind as MemoryCreateRequest['kind'],
    statement,
    ...(statementEn ? { statementEn } : {}),
  };

  if (kind === 'alamat') {
    request.address = readAddress(value.address, 'address');
    const stance = readString(value.stance, 'stance');
    if (stance !== 'trust' && stance !== 'deny') {
      throw new ApiError(400, 'INVALID_REQUEST', 'stance harus trust atau deny.');
    }
    request.stance = stance;
  }

  if (kind === 'aturan') {
    if (!isRecord(value.threshold)) {
      throw new ApiError(400, 'INVALID_REQUEST', 'threshold wajib diisi untuk kind aturan.');
    }
    const appliesTo = value.threshold.appliesTo;
    if (!Array.isArray(appliesTo) || appliesTo.length === 0) {
      throw new ApiError(400, 'INVALID_REQUEST', 'threshold.appliesTo minimal satu item.');
    }
    const keys = appliesTo.map((key, index) => {
      const parsed = readString(key, `threshold.appliesTo[${index}]`);
      if (!(THRESHOLD_KEYS as readonly string[]).includes(parsed)) {
        throw new ApiError(
          400,
          'INVALID_REQUEST',
          'threshold.appliesTo harus maxOutflow, newRecipientMax, atau trustedMax.',
        );
      }
      return parsed as (typeof THRESHOLD_KEYS)[number];
    });
    const mist = readMist(value.threshold.mist, 'threshold.mist', false).toString();
    request.threshold = { appliesTo: [...new Set(keys)], mist };
  }

  return request;
}
