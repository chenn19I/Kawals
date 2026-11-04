import { describe, expect, it } from 'vitest';
import {
  MIST_PER_SUI,
  evaluate,
  formatSui,
  shortAddress,
  sui,
  templateExplanation,
} from '@kawal/rules';
import type {
  Decision,
  EvaluationInput,
  MemoryRef,
  PolicyInput,
  RuleId,
  SimulationStatus,
} from '@kawal/rules';

const S = MIST_PER_SUI;

const addr = (pair: string): string => `0x${pair.repeat(32)}`;

const BARU = addr('a1');
const DITOLAK = addr('b2');
const DIPERCAYA = addr('c3');
const TEMAN = addr('d4');
const PAKET_ASING = addr('e5');
const PAKET_ASING_2 = addr('7a');
const PAKET_DIKENAL = addr('f6');
const NFT = `${addr('8b')}::hero::Hero`;
const COIN = '0x2::coin::Coin<0x2::sui::SUI>';

const DENY_MEMORY: MemoryRef = {
  id: 'mem-alamat-tolak',
  kind: 'alamat',
  statement: `Alamat ${shortAddress(DITOLAK)} pernah meminta 2 SUI lalu menghilang.`,
};

const TRUST_MEMORY: MemoryRef = {
  id: 'mem-alamat-percaya',
  kind: 'alamat',
  statement: `Alamat ${shortAddress(DIPERCAYA)} adalah penjual langganan.`,
};

const POLICY: PolicyInput = {
  denyList: [{ address: DITOLAK, memory: DENY_MEMORY }],
  trustList: [{ address: DIPERCAYA, memory: TRUST_MEMORY }],
  knownPackages: [PAKET_DIKENAL],
};

const BOTH_POLICY: PolicyInput = {
  ...POLICY,
  trustList: [...(POLICY.trustList ?? []), { address: DITOLAK }],
};

interface Options {
  recipient?: string;
  amount?: bigint;
  status?: SimulationStatus;
  failureReason?: string;
  outflow?: bigint;
  sentBefore?: boolean;
  packages?: string[];
  leaving?: Array<{ objectId: string; objectType: string }>;
  dangerous?: boolean;
  riskSource?: string;
  policy?: PolicyInput;
}

function makeInput(options: Options = {}): EvaluationInput {
  const amount = options.amount ?? S;
  const input: EvaluationInput = {
    transfer: {
      recipient: options.recipient ?? BARU,
      amountMist: amount,
    },
    simulation: {
      status: options.status ?? 'success',
      totalOutflowMist: options.outflow ?? amount,
      calledPackages: options.packages ?? [],
      leavingObjects: options.leaving ?? [],
    },
    history: {
      hasSentToRecipientBefore: options.sentBefore ?? false,
    },
    policy: options.policy ?? POLICY,
  };

  if (options.failureReason !== undefined) {
    input.simulation.failureReason = options.failureReason;
  }
  if (options.dangerous !== undefined) {
    input.risk = {
      dangerous: options.dangerous,
      source: options.riskSource ?? 'Tatum',
    };
  }

  return input;
}

interface Case {
  name: string;
  input: EvaluationInput;
  decision: Decision;
  rules: RuleId[];
}

const cases: Case[] = [
  {
    name: 'R1: timeout menghentikan evaluasi aturan lain',
    input: makeInput({
      status: 'timeout',
      recipient: DITOLAK,
      packages: [PAKET_ASING],
      dangerous: true,
    }),
    decision: 'TOLAK',
    rules: ['R1'],
  },
  {
    name: 'R1: simulasi gagal dengan alasan',
    input: makeInput({ status: 'failed', failureReason: 'Objek tidak ditemukan' }),
    decision: 'TOLAK',
    rules: ['R1'],
  },
  {
    name: 'R2: alamat di daftar tolak',
    input: makeInput({ recipient: DITOLAK, amount: sui('0.8') }),
    decision: 'TOLAK',
    rules: ['R2'],
  },
  {
    name: 'R2: pencocokan alamat tidak peka huruf besar',
    input: makeInput({
      recipient: DITOLAK.toUpperCase().replace('0X', '0x'),
      amount: sui('0.8'),
    }),
    decision: 'TOLAK',
    rules: ['R2'],
  },
  {
    name: 'R2: alamat lain tidak memicu daftar tolak',
    input: makeInput({ recipient: TEMAN, amount: sui('0.8') }),
    decision: 'TAHAN',
    rules: ['R9'],
  },
  {
    name: 'R2: daftar tolak menang atas daftar percaya',
    input: makeInput({ recipient: DITOLAK, amount: sui('0.8'), policy: BOTH_POLICY }),
    decision: 'TOLAK',
    rules: ['R2'],
  },
  {
    name: 'R3: saldo keluar di atas ambang',
    input: makeInput({
      recipient: DIPERCAYA,
      amount: S,
      outflow: 5n * S + 1n,
    }),
    decision: 'TAHAN',
    rules: ['R3'],
  },
  {
    name: 'R3: tepat di ambang tidak memicu',
    input: makeInput({ recipient: DIPERCAYA, amount: S, outflow: 5n * S }),
    decision: 'LOLOS',
    rules: ['R8'],
  },
  {
    name: 'R3: di bawah ambang tidak memicu',
    input: makeInput({ recipient: DIPERCAYA, amount: S, outflow: 5n * S - 1n }),
    decision: 'LOLOS',
    rules: ['R8'],
  },
  {
    name: 'R4: penerima baru di atas ambang',
    input: makeInput({ amount: S + 1n }),
    decision: 'TAHAN',
    rules: ['R4'],
  },
  {
    name: 'R4: tepat di ambang tidak memicu',
    input: makeInput({ amount: S }),
    decision: 'TAHAN',
    rules: ['R9'],
  },
  {
    name: 'R4: penerima yang pernah dikirimi tidak memicu',
    input: makeInput({ recipient: TEMAN, amount: 2n * S, sentBefore: true }),
    decision: 'TAHAN',
    rules: ['R9'],
  },
  {
    name: 'R4: kepercayaan tidak melewati ambang penerima baru',
    input: makeInput({ recipient: DIPERCAYA, amount: sui('1.5'), sentBefore: false }),
    decision: 'TAHAN',
    rules: ['R4'],
  },
  {
    name: 'R5: paket asing',
    input: makeInput({ recipient: DIPERCAYA, packages: [PAKET_ASING] }),
    decision: 'TAHAN',
    rules: ['R5'],
  },
  {
    name: 'R5: paket framework Sui dikenal',
    input: makeInput({ recipient: DIPERCAYA, packages: ['0x2'] }),
    decision: 'LOLOS',
    rules: ['R8'],
  },
  {
    name: 'R5: paket yang dikonfigurasi dikenal',
    input: makeInput({ recipient: DIPERCAYA, packages: [PAKET_DIKENAL] }),
    decision: 'LOLOS',
    rules: ['R8'],
  },
  {
    name: 'R5: paket tidak terbaca dianggap asing',
    input: makeInput({ recipient: DIPERCAYA, packages: ['bukan-paket'] }),
    decision: 'TAHAN',
    rules: ['R5'],
  },
  {
    name: 'R5: beberapa paket asing jadi satu temuan',
    input: makeInput({
      recipient: DIPERCAYA,
      packages: [PAKET_ASING, PAKET_ASING_2],
    }),
    decision: 'TAHAN',
    rules: ['R5'],
  },
  {
    name: 'R6: objek non-koin ikut pindah',
    input: makeInput({
      recipient: DIPERCAYA,
      leaving: [{ objectId: '0xnft-1', objectType: NFT }],
    }),
    decision: 'TAHAN',
    rules: ['R6'],
  },
  {
    name: 'R6: koin tidak memicu',
    input: makeInput({
      recipient: DIPERCAYA,
      leaving: [{ objectId: '0xcoin-1', objectType: COIN }],
    }),
    decision: 'LOLOS',
    rules: ['R8'],
  },
  {
    name: 'R6: tipe objek rusak dianggap non-koin',
    input: makeInput({
      recipient: DIPERCAYA,
      leaving: [{ objectId: '0xobj-1', objectType: 'bukan-tipe' }],
    }),
    decision: 'TAHAN',
    rules: ['R6'],
  },
  {
    name: 'R7: penerima ditandai berbahaya',
    input: makeInput({
      recipient: DIPERCAYA,
      dangerous: true,
      riskSource: 'Tatum Risk API',
    }),
    decision: 'TAHAN',
    rules: ['R7'],
  },
  {
    name: 'R7: tanda aman tidak memicu',
    input: makeInput({ recipient: DIPERCAYA, dangerous: false }),
    decision: 'LOLOS',
    rules: ['R8'],
  },
  {
    name: 'R8: dipercaya di bawah batas',
    input: makeInput({
      recipient: DIPERCAYA,
      amount: 4_999_999_999n,
      sentBefore: true,
    }),
    decision: 'LOLOS',
    rules: ['R8'],
  },
  {
    name: 'R8: tepat di batas jatuh ke bawaan aman',
    input: makeInput({ recipient: DIPERCAYA, amount: 5n * S, sentBefore: true }),
    decision: 'TAHAN',
    rules: ['R9'],
  },
  {
    name: 'R8: kepercayaan eksplisit berlaku tanpa riwayat',
    input: makeInput({ recipient: DIPERCAYA, amount: S, sentBefore: false }),
    decision: 'LOLOS',
    rules: ['R8'],
  },
  {
    name: 'R8: belum dipercaya walau jumlah kecil',
    input: makeInput({ amount: sui('0.5') }),
    decision: 'TAHAN',
    rules: ['R9'],
  },
  {
    name: 'R9: jumlah nol ke penerima baru tetap ditahan',
    input: makeInput({ amount: 0n }),
    decision: 'TAHAN',
    rules: ['R9'],
  },
  {
    name: 'R9: penerima baru di bawah ambang',
    input: makeInput({ amount: 999_999_999n }),
    decision: 'TAHAN',
    rules: ['R9'],
  },
  {
    name: 'Kombinasi: tolak dan paket asing',
    input: makeInput({
      recipient: DITOLAK,
      amount: sui('0.8'),
      packages: [PAKET_ASING],
    }),
    decision: 'TOLAK',
    rules: ['R2', 'R5'],
  },
  {
    name: 'Kombinasi: seluruh aturan tahan',
    input: makeInput({
      amount: sui('9'),
      outflow: sui('9'),
      packages: [PAKET_ASING],
      leaving: [{ objectId: '0xnft-2', objectType: NFT }],
      dangerous: true,
    }),
    decision: 'TAHAN',
    rules: ['R3', 'R4', 'R5', 'R6', 'R7'],
  },
  {
    name: 'Kombinasi: tolak mendominasi semua aturan',
    input: makeInput({
      recipient: DITOLAK,
      amount: sui('9'),
      outflow: sui('9'),
      packages: [PAKET_ASING],
      leaving: [{ objectId: '0xnft-3', objectType: NFT }],
      dangerous: true,
    }),
    decision: 'TOLAK',
    rules: ['R2', 'R3', 'R4', 'R5', 'R6', 'R7'],
  },
  {
    name: 'Kebijakan: ambang outflow kustom',
    input: makeInput({
      recipient: DIPERCAYA,
      amount: sui('2'),
      outflow: sui('7'),
      sentBefore: true,
      policy: { ...POLICY, maxOutflow: { mist: 10n * S } },
    }),
    decision: 'LOLOS',
    rules: ['R8'],
  },
  {
    name: 'Kebijakan: ambang penerima baru kustom',
    input: makeInput({
      amount: sui('0.75'),
      policy: { ...POLICY, newRecipientMax: { mist: S / 2n } },
    }),
    decision: 'TAHAN',
    rules: ['R4'],
  },
  {
    name: 'Kebijakan: batas penerima dipercaya kustom',
    input: makeInput({
      recipient: DIPERCAYA,
      amount: sui('2'),
      sentBefore: true,
      policy: { ...POLICY, trustedMax: { mist: S } },
    }),
    decision: 'TAHAN',
    rules: ['R9'],
  },
  {
    name: 'BigInt: selisih di atas 2^53 tetap tepat',
    input: makeInput({
      recipient: DIPERCAYA,
      amount: S,
      outflow: 2n ** 53n + 1n,
    }),
    decision: 'TAHAN',
    rules: ['R3'],
  },
  {
    name: 'Nol SUI ke alamat dipercaya lolos',
    input: makeInput({ recipient: DIPERCAYA, amount: 0n, sentBefore: true }),
    decision: 'LOLOS',
    rules: ['R8'],
  },
];

describe('mesin aturan R1-R9', () => {
  it.each(cases)('$name', ({ input, decision, rules }) => {
    const verdict = evaluate(input);

    expect(verdict.decision).toBe(decision);
    expect(verdict.triggered).toEqual(rules);
  });

  it('punya minimal 30 kasus, termasuk batas ambang dan kombinasi', () => {
    expect(cases.length).toBeGreaterThanOrEqual(30);
  });

  it('R2 mencantumkan memori yang dipakai', () => {
    const verdict = evaluate(makeInput({ recipient: DITOLAK, amount: sui('0.8') }));

    expect(verdict.usedMemories).toEqual([DENY_MEMORY]);
    expect(verdict.findings[0]?.memoryIds).toEqual([DENY_MEMORY.id]);
  });

  it('R1 tidak membaca memori walau alamat ada di daftar tolak', () => {
    const verdict = evaluate(makeInput({ status: 'timeout', recipient: DITOLAK }));

    expect(verdict.usedMemories).toEqual([]);
    expect(verdict.findings[0]?.memoryIds).toEqual([]);
  });

  it('R8 mencantumkan memori kepercayaan dan memori batas', () => {
    const capMemory: MemoryRef = {
      id: 'mem-batas',
      kind: 'aturan',
      statement: 'Tahan transfer di atas 5 SUI.',
    };
    const verdict = evaluate(
      makeInput({
        recipient: DIPERCAYA,
        policy: { ...POLICY, trustedMax: { mist: 5n * S, memory: capMemory } },
      }),
    );

    expect(verdict.usedMemories.map((memory) => memory.id)).toEqual([
      TRUST_MEMORY.id,
      capMemory.id,
    ]);
  });

  it('R1 memakai alasan bawaan saat timeout', () => {
    const verdict = evaluate(makeInput({ status: 'timeout' }));

    expect(verdict.findings[0]?.message).toContain('jaringan tidak menjawab');
  });

  it('R9 memakai salinan bawaan aman', () => {
    const verdict = evaluate(makeInput({ amount: sui('0.5') }));

    expect(verdict.findings[0]?.message).toContain('Bawaan aman');
  });

  it('R5 menggabungkan beberapa paket dalam satu temuan', () => {
    const verdict = evaluate(
      makeInput({ recipient: DIPERCAYA, packages: [PAKET_ASING, PAKET_ASING_2] }),
    );
    const r5 = verdict.findings.filter((finding) => finding.rule === 'R5');

    expect(r5).toHaveLength(1);
    expect(r5[0]?.message).toContain(shortAddress(PAKET_ASING));
    expect(r5[0]?.message).toContain(shortAddress(PAKET_ASING_2));
  });

  it('R7 memakai sumber data bawaan bila kosong', () => {
    const verdict = evaluate(
      makeInput({ recipient: DIPERCAYA, dangerous: true, riskSource: '   ' }),
    );

    expect(verdict.findings[0]?.message).toContain('sumber data');
  });

  it('templat penjelasan menyalin temuan tanpa mengubah putusan', () => {
    const verdict = evaluate(
      makeInput({ amount: sui('9'), packages: [PAKET_ASING] }),
    );
    const explanation = templateExplanation(verdict);

    expect(explanation.summary).toBe(verdict.findings[0]?.message);
    expect(explanation.details).toEqual(verdict.findings.map((finding) => finding.message));
  });

  it('bukti R3 memakai jumlah SUI yang tepat', () => {
    const verdict = evaluate(
      makeInput({ recipient: DIPERCAYA, outflow: 2n ** 53n + 1n }),
    );

    expect(verdict.findings[0]?.evidence.outflowSui).toBe(
      formatSui(2n ** 53n + 1n),
    );
  });
});
