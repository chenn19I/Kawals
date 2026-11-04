import { normalizeAddress, SUI_FRAMEWORK_ADDRESS } from './address';
import { MIST_PER_SUI } from './amount';
import type {
  MemoryRecord,
  MemoryRef,
  PolicyAddress,
  PolicyInput,
  ResolvedPolicy,
  ThresholdKey,
  ThresholdPolicy,
} from './types';

/** Bawaan konservatif saat belum ada aturan pribadi. */
export const DEFAULT_MAX_OUTFLOW_MIST = 5n * MIST_PER_SUI;
export const DEFAULT_NEW_RECIPIENT_MAX_MIST = 1n * MIST_PER_SUI;
export const DEFAULT_TRUSTED_MAX_MIST = 5n * MIST_PER_SUI;

export const DEFAULT_POLICY: ResolvedPolicy = {
  denyList: [],
  trustList: [],
  knownPackages: [SUI_FRAMEWORK_ADDRESS],
  maxOutflow: { mist: DEFAULT_MAX_OUTFLOW_MIST },
  newRecipientMax: { mist: DEFAULT_NEW_RECIPIENT_MAX_MIST },
  trustedMax: { mist: DEFAULT_TRUSTED_MAX_MIST },
};

/** Isi nilai kosong dengan bawaan dan normalkan semua alamat. */
export function resolvePolicy(input: PolicyInput = {}): ResolvedPolicy {
  const knownPackages = [SUI_FRAMEWORK_ADDRESS];
  for (const pkg of input.knownPackages ?? []) {
    const normalized = normalizeAddress(pkg);
    if (!knownPackages.includes(normalized)) {
      knownPackages.push(normalized);
    }
  }

  return {
    denyList: (input.denyList ?? []).map((entry) => ({
      address: normalizeAddress(entry.address),
      memory: entry.memory,
    })),
    trustList: (input.trustList ?? []).map((entry) => ({
      address: normalizeAddress(entry.address),
      memory: entry.memory,
    })),
    knownPackages,
    maxOutflow: input.maxOutflow ?? { mist: DEFAULT_MAX_OUTFLOW_MIST },
    newRecipientMax: input.newRecipientMax ?? { mist: DEFAULT_NEW_RECIPIENT_MAX_MIST },
    trustedMax: input.trustedMax ?? { mist: DEFAULT_TRUSTED_MAX_MIST },
  };
}

/**
 * Ubah memori terstruktur menjadi kebijakan.
 *
 * Bila beberapa aturan memberi ambang berbeda untuk kunci yang sama,
 * yang paling ketat (paling kecil) menang. Ini disengaja: konflik aturan
 * tidak boleh membuat penjaga lebih longgar.
 */
export function policyFromMemories(
  memories: readonly MemoryRecord[],
  base: PolicyInput = {},
): PolicyInput {
  const denyList: PolicyAddress[] = [...(base.denyList ?? [])];
  const trustList: PolicyAddress[] = [...(base.trustList ?? [])];
  const knownPackages: string[] = [...(base.knownPackages ?? [])];

  const thresholds = new Map<ThresholdKey, ThresholdPolicy>();
  const seed = (key: ThresholdKey, value: ThresholdPolicy | undefined): void => {
    if (value) thresholds.set(key, value);
  };
  seed('maxOutflow', base.maxOutflow);
  seed('newRecipientMax', base.newRecipientMax);
  seed('trustedMax', base.trustedMax);

  for (const memory of memories) {
    const data = memory.data;
    if (!data) continue;

    const ref: MemoryRef = {
      id: memory.id,
      kind: memory.kind,
      statement: memory.statement,
      ...(memory.statementEn ? { statementEn: memory.statementEn } : {}),
    };

    if (memory.kind === 'alamat' && data.address && data.stance) {
      const entry: PolicyAddress = {
        address: normalizeAddress(data.address),
        memory: ref,
      };
      if (data.stance === 'deny') {
        denyList.push(entry);
      } else {
        trustList.push(entry);
      }
    }

    if (memory.kind === 'aturan' && data.threshold) {
      const mist = parseThresholdMist(memory, data.threshold.mist);
      for (const key of data.threshold.appliesTo) {
        const current = thresholds.get(key);
        if (!current || mist < current.mist) {
          thresholds.set(key, { mist, memory: ref });
        }
      }
    }
  }

  return {
    denyList,
    trustList,
    knownPackages,
    maxOutflow: thresholds.get('maxOutflow'),
    newRecipientMax: thresholds.get('newRecipientMax'),
    trustedMax: thresholds.get('trustedMax'),
  };
}

function parseThresholdMist(memory: MemoryRecord, value: string): bigint {
  if (!/^\d+$/.test(value)) {
    throw new Error(`Memori ${memory.id}: ambang harus bilangan bulat MIST.`);
  }

  const mist = BigInt(value);
  if (mist <= 0n) {
    throw new Error(`Memori ${memory.id}: ambang harus lebih besar dari nol.`);
  }

  return mist;
}
