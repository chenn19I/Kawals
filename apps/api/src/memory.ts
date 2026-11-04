import { MemWal } from '@mysten-incubation/memwal';
import { ALAMAT } from '@kawal/fixtures';
import {
  normalizeAddress,
  shortAddress,
  sui,
  type MemoryKind,
  type MemoryRecord,
  type ThresholdKey,
} from '@kawal/rules';
import type { ApiConfig, WalrusConfig } from './config';
import type { RecalledMemory } from './types';

export interface RememberOutcome {
  memoryId: string;
  blobId: string;
}

export interface MemoryRepository {
  readonly mode: 'mock' | 'walrus';
  recall(query: string, limit: number): Promise<RecalledMemory[]>;
  recallForEvaluation(recipient: string): Promise<RecalledMemory[]>;
  list(): Promise<RecalledMemory[]>;
  remember(record: MemoryRecord): Promise<RememberOutcome>;
  close(): void;
}

const MEMORY_KINDS: readonly MemoryKind[] = ['aturan', 'alamat', 'keputusan', 'preferensi'];
const THRESHOLD_KEYS: readonly ThresholdKey[] = ['maxOutflow', 'newRecipientMax', 'trustedMax'];

const STOPWORDS = new Set([
  'yang',
  'saya',
  'dan',
  'ke',
  'di',
  'untuk',
  'apa',
  'berapa',
  'alamat',
  'aturan',
  'transaksi',
  'pribadi',
  'adalah',
  'ini',
  'itu',
  'dengan',
  'dari',
  'pada',
  'dalam',
  'atau',
  'tidak',
  'boleh',
  'bisa',
  'harus',
  'mau',
  'ingin',
  'the',
  'and',
  'for',
  'with',
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isMemoryKind(value: unknown): value is MemoryKind {
  return typeof value === 'string' && (MEMORY_KINDS as readonly string[]).includes(value);
}

function isThresholdKey(value: unknown): value is ThresholdKey {
  return typeof value === 'string' && (THRESHOLD_KEYS as readonly string[]).includes(value);
}

function isMemoryRecord(value: unknown): value is MemoryRecord {
  if (!isRecord(value)) return false;
  if (typeof value.id !== 'string' || !value.id.trim()) return false;
  if (!isMemoryKind(value.kind)) return false;
  if (typeof value.statement !== 'string' || !value.statement.trim()) return false;
  if (value.statementEn !== undefined && typeof value.statementEn !== 'string') return false;

  if (value.data === undefined) return true;
  if (!isRecord(value.data)) return false;

  if (value.data.address !== undefined && typeof value.data.address !== 'string') return false;
  if (
    value.data.stance !== undefined &&
    value.data.stance !== 'trust' &&
    value.data.stance !== 'deny'
  ) {
    return false;
  }

  if (value.data.threshold !== undefined) {
    const threshold = value.data.threshold;
    if (!isRecord(threshold)) return false;
    if (!Array.isArray(threshold.appliesTo)) return false;
    if (!threshold.appliesTo.every(isThresholdKey)) return false;
    if (typeof threshold.mist !== 'string' || !/^\d+$/.test(threshold.mist)) return false;
    if (BigInt(threshold.mist) <= 0n) return false;
  }

  return true;
}

function toRecalled(
  record: MemoryRecord,
  blobId: string,
  distance: number,
  createdAt: string | null,
): RecalledMemory {
  return {
    id: record.id,
    kind: record.kind,
    statement: record.statement,
    ...(record.statementEn ? { statementEn: record.statementEn } : {}),
    data: record.data,
    blobId,
    distance,
    createdAt,
  };
}

function tokens(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 2 && !STOPWORDS.has(token));
}

function scoreMemory(record: MemoryRecord, query: string): number {
  const lowerQuery = query.toLowerCase();
  const queryAddress = /0x[0-9a-f]{64}/i.exec(query)?.[0]?.toLowerCase();
  let score = 0;

  if (queryAddress && record.data?.address) {
    try {
      if (normalizeAddress(record.data.address) === normalizeAddress(queryAddress)) {
        score += 50;
      }
    } catch {
      // Alamat memori yang tidak sah tidak boleh membuat recall gagal.
    }
  }

  const statement = record.statement.toLowerCase();
  for (const token of new Set(tokens(query))) {
    if (statement.includes(token)) score += 2;
  }

  if (lowerQuery.includes('alamat') && record.kind === 'alamat') score += 3;
  if (lowerQuery.includes('aturan') && record.kind === 'aturan') score += 3;
  if (lowerQuery.includes('keputusan') && record.kind === 'keputusan') score += 3;
  if (lowerQuery.includes('preferensi') && record.kind === 'preferensi') score += 3;

  return score;
}

export class InMemoryMemoryRepository implements MemoryRepository {
  readonly mode = 'mock' as const;
  private readonly records = new Map<string, MemoryRecord>();

  constructor(seed: readonly MemoryRecord[] = []) {
    for (const record of seed) {
      this.records.set(record.id, record);
    }
  }

  async recall(query: string, limit: number): Promise<RecalledMemory[]> {
    const scored = [...this.records.values()]
      .map((record) => ({ record, score: scoreMemory(record, query) }))
      .filter((entry) => entry.score > 0)
      .sort((a, b) => b.score - a.score || a.record.id.localeCompare(b.record.id))
      .slice(0, limit);

    return scored.map((entry) =>
      toRecalled(entry.record, entry.record.id, 1 / (1 + entry.score), null),
    );
  }

  async recallForEvaluation(recipient: string): Promise<RecalledMemory[]> {
    const [addressHits, ruleHits] = await Promise.all([
      this.recall(`Alamat ${recipient}`, 8),
      this.recall('Aturan batas transaksi SUI', 8),
    ]);

    const merged = new Map<string, RecalledMemory>();
    for (const memory of [...addressHits, ...ruleHits]) {
      const current = merged.get(memory.blobId);
      if (!current || memory.distance < current.distance) {
        merged.set(memory.blobId, memory);
      }
    }
    return [...merged.values()].slice(0, 12);
  }

  async list(): Promise<RecalledMemory[]> {
    return [...this.records.values()].map((record) =>
      toRecalled(record, record.id, 0, null),
    );
  }

  async remember(record: MemoryRecord): Promise<RememberOutcome> {
    this.records.set(record.id, record);
    return { memoryId: record.id, blobId: record.id };
  }

  close(): void {
    // Tidak ada koneksi jaringan pada mode mock.
  }
}

export class WalrusMemoryRepository implements MemoryRepository {
  readonly mode = 'walrus' as const;
  private readonly client: MemWal;

  constructor(config: WalrusConfig) {
    this.client = MemWal.create({
      key: config.key,
      accountId: config.accountId,
      serverUrl: config.serverUrl,
      namespace: config.namespace,
    });
  }

  async recall(query: string, limit: number): Promise<RecalledMemory[]> {
    const result = await this.client.recall({ query, limit });
    return result.results.map((memory) =>
      parseMemoryText(memory.text, memory.blob_id, memory.created_at ?? null, memory.distance),
    );
  }

  async recallForEvaluation(recipient: string): Promise<RecalledMemory[]> {
    const [addressHits, ruleHits] = await Promise.all([
      this.recall(`Alamat ${recipient}`, 8),
      this.recall('Aturan batas transaksi SUI', 8),
    ]);

    const merged = new Map<string, RecalledMemory>();
    for (const memory of [...addressHits, ...ruleHits]) {
      const current = merged.get(memory.blobId);
      if (!current || memory.distance < current.distance) {
        merged.set(memory.blobId, memory);
      }
    }
    return [...merged.values()].slice(0, 12);
  }

  async list(): Promise<RecalledMemory[]> {
    const result = await this.client.recall({
      query: 'aturan alamat keputusan preferensi transaksi SUI',
      limit: 100,
    });
    return result.results.map((memory) =>
      parseMemoryText(memory.text, memory.blob_id, memory.created_at ?? null, memory.distance),
    );
  }

  async remember(record: MemoryRecord): Promise<RememberOutcome> {
    const result = await this.client.rememberAndWait(encodeMemoryText(record), undefined, {
      timeoutMs: 120_000,
      pollIntervalMs: 1000,
      idempotencyKey: `kawal-${record.id}`,
    });

    return { memoryId: record.id, blobId: result.blob_id };
  }

  close(): void {
    this.client.destroy();
  }
}

export function createMemoryRepository(
  config: ApiConfig,
  seed: readonly MemoryRecord[],
): MemoryRepository {
  if (config.memoryMode === 'walrus' && config.walrus) {
    return new WalrusMemoryRepository(config.walrus);
  }
  return new InMemoryMemoryRepository(seed);
}

export function encodeMemoryText(record: MemoryRecord): string {
  const payload = Buffer.from(JSON.stringify({ v: 1, ...record }), 'utf8').toString('base64url');
  return `${record.statement}\n\n[kawal:v1] ${payload}`;
}

export function parseMemoryText(
  text: string,
  blobId: string,
  createdAt: string | null,
  distance: number,
): RecalledMemory {
  const marker = /\[kawal:v1\]\s+([A-Za-z0-9_-]+)/.exec(text);
  if (marker?.[1]) {
    try {
      const decoded = JSON.parse(Buffer.from(marker[1], 'base64url').toString('utf8')) as unknown;
      if (isRecord(decoded) && isMemoryRecord({ ...decoded, id: decoded.id || blobId })) {
        const record = { ...decoded, id: String(decoded.id || blobId) } as MemoryRecord;
        return toRecalled(record, blobId, distance, createdAt);
      }
    } catch {
      // Marker rusak: jatuh ke pembacaan kalimat alami.
    }
  }

  return toRecalled(inferMemoryRecord(text, blobId), blobId, distance, createdAt);
}

/**
 * SDK Walrus Memory saat ini hanya mengembalikan teks, bukan metadata.
 * Karena itu memori yang ditulis Kawal membawa penanda [kawal:v1], dan
 * memori lama tanpa penanda dibaca dengan pola kalimat yang konservatif.
 */
export function inferMemoryRecord(text: string, blobId: string): MemoryRecord {
  const statement = text.trim();
  const lower = statement.toLowerCase();
  const addressMatch = /0x[0-9a-fA-F]{64}/.exec(statement);
  const address = addressMatch?.[0];

  let kind: MemoryKind = 'aturan';
  let data: MemoryRecord['data'] | undefined;

  if (address) {
    if (/(menolak|tidak percaya|penipuan|menghilang|bahaya|daftar tolak)/.test(lower)) {
      kind = 'alamat';
      data = { address: normalizeAddress(address), stance: 'deny' };
    } else if (/(percaya|tepercaya|langganan|lancar)/.test(lower)) {
      kind = 'alamat';
      data = { address: normalizeAddress(address), stance: 'trust' };
    }
  }

  if (kind !== 'alamat' && /(aturan|batas|maksimal|di atas|melebihi|hingga|ambang)/.test(lower)) {
    const amountMatch = /(\d+(?:[.,]\d+)?)\s*sui/i.exec(statement);
    if (amountMatch?.[1]) {
      const mist = sui(amountMatch[1].replace(',', '.'));
      if (mist > 0n) {
        const appliesTo: ThresholdKey[] = [];
        if (/(penerima baru|belum pernah)/.test(lower)) {
          appliesTo.push('newRecipientMax');
        } else if (/(dipercaya|terpercaya)/.test(lower)) {
          appliesTo.push('trustedMax');
        } else if (/(keluar|total|transaksi|pengiriman)/.test(lower)) {
          appliesTo.push('maxOutflow');
        }

        if (appliesTo.length > 0) {
          kind = 'aturan';
          data = { threshold: { appliesTo, mist: mist.toString() } };
        }
      }
    }
  }

  if (!data && !address) {
    if (/(penjelasan|preferensi|gaya|format)/.test(lower)) {
      kind = 'preferensi';
    } else if (/(pernah|diputuskan|keputusan|memilih)/.test(lower)) {
      kind = 'keputusan';
    }
  }

  return {
    id: blobId,
    kind,
    statement,
    ...(data ? { data } : {}),
  };
}

export function seedMemories(): MemoryRecord[] {
  return [
    {
      id: 'mem-alamat-ditolak',
      kind: 'alamat',
      statement: `Alamat ${shortAddress(ALAMAT.ditolak)} meminta dikirimi 2 SUI lalu menghilang.`,
      statementEn: `The address ${shortAddress(ALAMAT.ditolak)} asked for 2 SUI and then disappeared.`,
      data: { address: ALAMAT.ditolak, stance: 'deny' },
    },
    {
      id: 'mem-alamat-dipercaya',
      kind: 'alamat',
      statement: `Alamat ${shortAddress(ALAMAT.dipercaya)} adalah penjual langganan dengan dua transaksi lancar.`,
      statementEn: `The address ${shortAddress(ALAMAT.dipercaya)} is a subscription seller with two clean transactions.`,
      data: { address: ALAMAT.dipercaya, stance: 'trust' },
    },
    {
      id: 'mem-batas-outflow',
      kind: 'aturan',
      statement: 'Aturan pribadi saya: tahan transaksi dengan total SUI keluar di atas 5 SUI.',
      statementEn: 'My rule: hold any transfer whose total SUI outflow is above 5 SUI.',
      data: { threshold: { appliesTo: ['maxOutflow'], mist: sui('5').toString() } },
    },
    {
      id: 'mem-batas-penerima-baru',
      kind: 'aturan',
      statement: 'Penerima yang belum pernah saya kirimi hanya boleh menerima maksimal 1 SUI.',
      statementEn: 'A recipient I have never sent to may receive at most 1 SUI.',
      data: { threshold: { appliesTo: ['newRecipientMax'], mist: sui('1').toString() } },
    },
    {
      id: 'mem-batas-dipercaya',
      kind: 'aturan',
      statement: 'Batas transfer ke penerima yang saya percaya adalah 5 SUI.',
      statementEn: 'My limit for a trusted recipient is 5 SUI.',
      data: { threshold: { appliesTo: ['trustedMax'], mist: sui('5').toString() } },
    },
    {
      id: 'mem-preferensi-penjelasan',
      kind: 'preferensi',
      statement: 'Saya ingin penjelasan putusan dalam bahasa Indonesia yang singkat.',
      statementEn: 'I want short decision explanations in plain language.',
    },
  ];
}
