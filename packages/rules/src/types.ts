/** Putusan akhir. Urutan bobot: TOLAK > TAHAN > LOLOS. */
export type Decision = 'LOLOS' | 'TAHAN' | 'TOLAK';

export type RuleId = 'R1' | 'R2' | 'R3' | 'R4' | 'R5' | 'R6' | 'R7' | 'R8' | 'R9';

export type MemoryKind = 'aturan' | 'alamat' | 'keputusan' | 'preferensi';

/**
 * Rujukan memori yang ikut menentukan putusan.
 * Slip pemeriksaan menampilkan ini supaya pengguna tahu alasannya.
 */
export interface MemoryRef {
  id: string;
  kind: MemoryKind;
  statement: string;
  statementEn?: string;
}

export type ThresholdKey = 'maxOutflow' | 'newRecipientMax' | 'trustedMax';

/** Metadata terstruktur yang menyertai kalimat memori. */
export interface MemoryRecord {
  id: string;
  kind: MemoryKind;
  /** Satu kalimat alami, dipakai untuk pencarian semantik. */
  statement: string;
  /** Padanan bahasa Inggris bila memori ditulis dua bahasa. */
  statementEn?: string;
  data?: {
    /** Untuk kind "alamat". */
    address?: string;
    stance?: 'trust' | 'deny';
    /** Untuk kind "aturan". Nilai dalam MIST agar tidak ada pembulatan. */
    threshold?: {
      appliesTo: ThresholdKey[];
      mist: string;
    };
  };
}

export type SimulationStatus = 'success' | 'failed' | 'timeout';

export interface TransferIntent {
  recipient: string;
  amountMist: bigint;
}

export interface LeavingObject {
  objectId: string;
  objectType: string;
}

/**
 * Bagian dari simulasi Tatum yang dipakai mesin aturan.
 * API bertanggung jawab menormalkan respons Tatum ke bentuk ini.
 */
export interface SimulationOutcome {
  status: SimulationStatus;
  /** Alasan singkat saat status bukan "success". */
  failureReason?: string;
  /** Kode stabil agar UI dapat menerjemahkan alasan tanpa menebak teks. */
  failureCode?: string;
  /** Total SUI keluar dari dompet, termasuk gas, dalam MIST. */
  totalOutflowMist: bigint;
  /** Paket Move yang dipanggil transaksi. */
  calledPackages: string[];
  /**
   * Objek milik pengguna yang berpindah keluar dompet.
   * Koin itu normal; objek non-koin memicu R6.
   */
  leavingObjects: LeavingObject[];
}

export interface HistoryContext {
  /** Penerima pernah muncul di riwayat transaksi dompet ini. */
  hasSentToRecipientBefore: boolean;
}

export interface RecipientRisk {
  dangerous: boolean;
  source: string;
}

export interface PolicyAddress {
  address: string;
  memory?: MemoryRef;
}

export interface ThresholdPolicy {
  mist: bigint;
  memory?: MemoryRef;
}

/** Konfigurasi parsial; nilai yang kosong diisi bawaan aman. */
export interface PolicyInput {
  denyList?: PolicyAddress[];
  trustList?: PolicyAddress[];
  /** Ditambahkan ke allowlist bawaan (paket framework Sui), bukan menggantikan. */
  knownPackages?: string[];
  maxOutflow?: ThresholdPolicy;
  newRecipientMax?: ThresholdPolicy;
  trustedMax?: ThresholdPolicy;
}

export interface ResolvedPolicy {
  denyList: PolicyAddress[];
  trustList: PolicyAddress[];
  knownPackages: string[];
  maxOutflow: ThresholdPolicy;
  newRecipientMax: ThresholdPolicy;
  trustedMax: ThresholdPolicy;
}

export interface EvaluationInput {
  transfer: TransferIntent;
  simulation: SimulationOutcome;
  history: HistoryContext;
  risk?: RecipientRisk;
  policy?: PolicyInput;
}

export interface Finding {
  rule: RuleId;
  decision: Decision;
  /** Kalimat fakta siap tampil; LLM tidak boleh mengubah putusan. */
  message: string;
  evidence: Record<string, string>;
  memoryIds: string[];
}

export interface Verdict {
  decision: Decision;
  /** Aturan yang terpicu, urut R2 sampai R9 (atau hanya R1). */
  triggered: RuleId[];
  findings: Finding[];
  usedMemories: MemoryRef[];
}
