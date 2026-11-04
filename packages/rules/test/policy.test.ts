import { describe, expect, it } from 'vitest';
import {
  DEFAULT_MAX_OUTFLOW_MIST,
  DEFAULT_NEW_RECIPIENT_MAX_MIST,
  DEFAULT_TRUSTED_MAX_MIST,
  MIST_PER_SUI,
  normalizeAddress,
  policyFromMemories,
  resolvePolicy,
} from '@kawal/rules';
import type { MemoryRecord } from '@kawal/rules';

const S = MIST_PER_SUI;
const addr = (pair: string): string => `0x${pair.repeat(32)}`;
const TRUSTED = addr('c3');
const DENIED = addr('b2');

const trustMemory: MemoryRecord = {
  id: 'm-trust',
  kind: 'alamat',
  statement: 'Alamat ini penjual langganan.',
  data: { address: TRUSTED, stance: 'trust' },
};

const denyMemory: MemoryRecord = {
  id: 'm-deny',
  kind: 'alamat',
  statement: 'Alamat ini pernah menipu.',
  data: { address: DENIED, stance: 'deny' },
};

function ruleMemory(
  id: string,
  appliesTo: Array<'maxOutflow' | 'newRecipientMax' | 'trustedMax'>,
  mist: bigint,
): MemoryRecord {
  return {
    id,
    kind: 'aturan',
    statement: `Aturan ${id}`,
    data: { threshold: { appliesTo, mist: mist.toString() } },
  };
}

describe('policyFromMemories', () => {
  it('memetakan memori alamat menjadi daftar tolak dan percaya', () => {
    const policy = resolvePolicy(policyFromMemories([trustMemory, denyMemory]));

    expect(policy.trustList).toHaveLength(1);
    expect(policy.trustList[0]?.address).toBe(normalizeAddress(TRUSTED));
    expect(policy.trustList[0]?.memory?.id).toBe('m-trust');

    expect(policy.denyList).toHaveLength(1);
    expect(policy.denyList[0]?.address).toBe(normalizeAddress(DENIED));
    expect(policy.denyList[0]?.memory?.id).toBe('m-deny');
  });

  it('memetakan satu aturan ke beberapa ambang', () => {
    const memory = ruleMemory('m-5sui', ['maxOutflow', 'newRecipientMax'], 5n * S);
    const policy = resolvePolicy(policyFromMemories([memory]));

    expect(policy.maxOutflow.mist).toBe(5n * S);
    expect(policy.newRecipientMax.mist).toBe(5n * S);
    expect(policy.maxOutflow.memory?.id).toBe('m-5sui');
    expect(policy.trustedMax.mist).toBe(DEFAULT_TRUSTED_MAX_MIST);
  });

  it('memilih ambang paling ketat saat beberapa memori berkonflik', () => {
    const longgar = ruleMemory('m-longgar', ['maxOutflow'], 10n * S);
    const ketat = ruleMemory('m-ketat', ['maxOutflow'], 4n * S);
    const policy = resolvePolicy(policyFromMemories([longgar, ketat]));

    expect(policy.maxOutflow.mist).toBe(4n * S);
    expect(policy.maxOutflow.memory?.id).toBe('m-ketat');
  });

  it('ambang dari base ikut dibandingkan dan yang ketat menang', () => {
    const longgar = ruleMemory('m-longgar', ['maxOutflow'], 10n * S);
    const policy = resolvePolicy(
      policyFromMemories([longgar], { maxOutflow: { mist: 3n * S } }),
    );

    expect(policy.maxOutflow.mist).toBe(3n * S);
  });

  it('mengabaikan memori tanpa metadata yang dipakai aturan', () => {
    const memories: MemoryRecord[] = [
      { id: 'm-keputusan', kind: 'keputusan', statement: 'Pernah menolak transfer.' },
      { id: 'm-preferensi', kind: 'preferensi', statement: 'Penjelasan singkat.' },
      {
        id: 'm-alamat-tanpa-stance',
        kind: 'alamat',
        statement: 'Alamat tanpa sikap.',
        data: { address: TRUSTED },
      },
    ];
    const policy = policyFromMemories(memories);

    expect(policy.denyList).toEqual([]);
    expect(policy.trustList).toEqual([]);
    expect(policy.maxOutflow).toBeUndefined();
  });

  it('menolak ambang yang bukan bilangan bulat MIST', () => {
    const invalid: MemoryRecord = {
      id: 'm-rusak',
      kind: 'aturan',
      statement: 'Rusak.',
      data: { threshold: { appliesTo: ['maxOutflow'], mist: '1.5' } },
    };

    expect(() => policyFromMemories([invalid])).toThrow(/bilangan bulat MIST/);
  });

  it('menolak ambang nol atau negatif', () => {
    const zero = ruleMemory('m-nol', ['maxOutflow'], 0n);

    expect(() => policyFromMemories([zero])).toThrow(/lebih besar dari nol/);
  });

  it('menolak alamat memori yang tidak valid', () => {
    const invalid: MemoryRecord = {
      id: 'm-alamat-rusak',
      kind: 'alamat',
      statement: 'Rusak.',
      data: { address: 'bukan-alamat', stance: 'deny' },
    };

    expect(() => policyFromMemories([invalid])).toThrow(/Alamat Sui tidak valid/);
  });
});

describe('resolvePolicy', () => {
  it('memberi bawaan konservatif saat kosong', () => {
    const policy = resolvePolicy();

    expect(policy.maxOutflow.mist).toBe(DEFAULT_MAX_OUTFLOW_MIST);
    expect(policy.newRecipientMax.mist).toBe(DEFAULT_NEW_RECIPIENT_MAX_MIST);
    expect(policy.trustedMax.mist).toBe(DEFAULT_TRUSTED_MAX_MIST);
    expect(policy.knownPackages).toEqual([normalizeAddress('0x2')]);
  });

  it('selalu mengenal paket framework dan menambah paket kustom', () => {
    const pkg = addr('f6');
    const policy = resolvePolicy({ knownPackages: [pkg, pkg] });

    expect(policy.knownPackages).toEqual([normalizeAddress('0x2'), normalizeAddress(pkg)]);
  });

  it('menormalkan alamat pada daftar tolak dan percaya', () => {
    const policy = resolvePolicy({
      denyList: [{ address: DENIED.toUpperCase().replace('0X', '0x') }],
      trustList: [{ address: TRUSTED }],
    });

    expect(policy.denyList[0]?.address).toBe(normalizeAddress(DENIED));
    expect(policy.trustList[0]?.address).toBe(normalizeAddress(TRUSTED));
  });
});
