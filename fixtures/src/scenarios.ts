import { shortAddress, sui } from '@kawal/rules';
import type {
  Decision,
  EvaluationInput,
  MemoryRef,
  PolicyInput,
  RuleId,
} from '@kawal/rules';

const addr = (pair: string): string => `0x${pair.repeat(32)}`;

export const ALAMAT = {
  baru: addr('a1'),
  ditolak: addr('b2'),
  dipercaya: addr('c3'),
  teman: addr('d4'),
  paketAsing: addr('e5'),
  paketDikenal: addr('f6'),
} as const;

const COIN_SUI = '0x2::coin::Coin<0x2::sui::SUI>';
const NFT_HERO = `${addr('8b')}::hero::Hero`;

const koin = (objectId: string) => ({ objectId, objectType: COIN_SUI });
const nft = (objectId: string) => ({ objectId, objectType: NFT_HERO });

const MEMORI_TOLAK: MemoryRef = {
  id: 'mem-alamat-ditolak',
  kind: 'alamat',
  statement: `Alamat ${shortAddress(ALAMAT.ditolak)} meminta dikirimi 2 SUI lalu menghilang.`,
  statementEn: `The address ${shortAddress(ALAMAT.ditolak)} asked for 2 SUI and then disappeared.`,
};

const MEMORI_PERCAYA: MemoryRef = {
  id: 'mem-alamat-dipercaya',
  kind: 'alamat',
  statement: `Alamat ${shortAddress(ALAMAT.dipercaya)} adalah penjual langganan dengan dua transaksi lancar.`,
  statementEn: `The address ${shortAddress(ALAMAT.dipercaya)} is a subscription seller with two clean transactions.`,
};

const POLICY: PolicyInput = {
  denyList: [{ address: ALAMAT.ditolak, memory: MEMORI_TOLAK }],
  trustList: [{ address: ALAMAT.dipercaya, memory: MEMORI_PERCAYA }],
  knownPackages: [ALAMAT.paketDikenal],
};

export interface Scenario {
  id: string;
  dapp: string;
  dappEn: string;
  title: string;
  titleEn: string;
  note: string;
  noteEn: string;
  input: EvaluationInput;
  expected: {
    decision: Decision;
    rules: RuleId[];
  };
}

/**
 * Dua belas skenario dApp tiruan "Pasar Tiruan" (F-03).
 * Angka dan alamat sengaja masuk akal; tidak ada lorem ipsum.
 */
export const scenarios: Scenario[] = [
  {
    id: 'transfer-12-sui-alamat-baru',
    dapp: 'Pasar Tiruan',
    dappEn: 'Mock Market',
    title: 'Kirim 12 SUI ke penjual baru',
    titleEn: 'Send 12 SUI to a new seller',
    note: 'Dimas membeli barang dari penjual yang belum pernah ia kirimi.',
    noteEn: 'Dimas buys from a seller he has never sent to before.',
    input: {
      transfer: { recipient: ALAMAT.baru, amountMist: sui('12') },
      simulation: {
        status: 'success',
        totalOutflowMist: sui('12'),
        calledPackages: [],
        leavingObjects: [koin('0xcoin-sui-01')],
      },
      history: { hasSentToRecipientBefore: false },
      policy: POLICY,
    },
    expected: { decision: 'TAHAN', rules: ['R3', 'R4'] },
  },
  {
    id: 'transfer-kecil-alamat-baru',
    dapp: 'Pasar Tiruan',
    dappEn: 'Mock Market',
    title: 'Kirim 0,5 SUI ke alamat baru',
    titleEn: 'Send 0.5 SUI to a new address',
    note: 'Pembelian kecil ke alamat yang belum dikenal.',
    noteEn: 'A small purchase to an address he does not know.',
    input: {
      transfer: { recipient: ALAMAT.baru, amountMist: sui('0.5') },
      simulation: {
        status: 'success',
        totalOutflowMist: sui('0.5'),
        calledPackages: [],
        leavingObjects: [koin('0xcoin-sui-02')],
      },
      history: { hasSentToRecipientBefore: false },
      policy: POLICY,
    },
    expected: { decision: 'TAHAN', rules: ['R9'] },
  },
  {
    id: 'alamat-pernah-ditolak',
    dapp: 'Pasar Tiruan',
    dappEn: 'Mock Market',
    title: 'Kirim 0,8 SUI ke alamat yang pernah ditolak',
    titleEn: 'Send 0.8 SUI to a previously rejected address',
    note: 'Alamat yang sama muncul lagi di sesi berikutnya.',
    noteEn: 'The same address appears again in a later session.',
    input: {
      transfer: { recipient: ALAMAT.ditolak, amountMist: sui('0.8') },
      simulation: {
        status: 'success',
        totalOutflowMist: sui('0.8'),
        calledPackages: [],
        leavingObjects: [koin('0xcoin-sui-03')],
      },
      history: { hasSentToRecipientBefore: false },
      policy: POLICY,
    },
    expected: { decision: 'TOLAK', rules: ['R2'] },
  },
  {
    id: 'alamat-dipercaya',
    dapp: 'Pasar Tiruan',
    dappEn: 'Mock Market',
    title: 'Kirim 2 SUI ke penjual langganan',
    titleEn: 'Send 2 SUI to a subscription seller',
    note: 'Alamat sudah masuk daftar dipercaya dari keputusan sebelumnya.',
    noteEn: 'The address is already trusted from an earlier decision.',
    input: {
      transfer: { recipient: ALAMAT.dipercaya, amountMist: sui('2') },
      simulation: {
        status: 'success',
        totalOutflowMist: sui('2'),
        calledPackages: [],
        leavingObjects: [koin('0xcoin-sui-04')],
      },
      history: { hasSentToRecipientBefore: true },
      policy: POLICY,
    },
    expected: { decision: 'LOLOS', rules: ['R8'] },
  },
  {
    id: 'paket-tak-dikenal',
    dapp: 'Pasar Tiruan',
    dappEn: 'Mock Market',
    title: 'Klaim hadiah lewat paket Move asing',
    titleEn: 'Claim a reward through a foreign Move package',
    note: 'Transaksi memanggil paket yang tidak ada di allowlist.',
    noteEn: 'The transaction calls a package that is not on the allowlist.',
    input: {
      transfer: { recipient: ALAMAT.baru, amountMist: sui('0.3') },
      simulation: {
        status: 'success',
        totalOutflowMist: sui('0.3'),
        calledPackages: [ALAMAT.paketAsing],
        leavingObjects: [koin('0xcoin-sui-05')],
      },
      history: { hasSentToRecipientBefore: false },
      policy: POLICY,
    },
    expected: { decision: 'TAHAN', rules: ['R5'] },
  },
  {
    id: 'objek-ikut-pindah',
    dapp: 'Pasar Tiruan',
    dappEn: 'Mock Market',
    title: 'Beli barang, NFT ikut berpindah',
    titleEn: 'Buy an item and an NFT leaves too',
    note: 'Selain koin, satu objek milik Dimas keluar dari dompet.',
    noteEn: 'Besides coins, one of Dimas objects leaves the wallet.',
    input: {
      transfer: { recipient: ALAMAT.baru, amountMist: sui('0.2') },
      simulation: {
        status: 'success',
        totalOutflowMist: sui('0.2'),
        calledPackages: [],
        leavingObjects: [koin('0xcoin-sui-06'), nft('0xnft-hero-01')],
      },
      history: { hasSentToRecipientBefore: false },
      policy: POLICY,
    },
    expected: { decision: 'TAHAN', rules: ['R6'] },
  },
  {
    id: 'penerima-ditandai-berbahaya',
    dapp: 'Pasar Tiruan',
    dappEn: 'Mock Market',
    title: 'Kirim 0,4 SUI ke alamat yang ditandai',
    titleEn: 'Send 0.4 SUI to a flagged address',
    note: 'Sumber data menandai penerima sebagai berbahaya.',
    noteEn: 'A risk source flags the recipient as dangerous.',
    input: {
      transfer: { recipient: ALAMAT.baru, amountMist: sui('0.4') },
      simulation: {
        status: 'success',
        totalOutflowMist: sui('0.4'),
        calledPackages: [],
        leavingObjects: [koin('0xcoin-sui-07')],
      },
      history: { hasSentToRecipientBefore: false },
      risk: { dangerous: true, source: 'Tatum Risk API' },
      policy: POLICY,
    },
    expected: { decision: 'TAHAN', rules: ['R7'] },
  },
  {
    id: 'simulasi-timeout',
    dapp: 'Pasar Tiruan',
    dappEn: 'Mock Market',
    title: 'Simulasi tidak menjawab',
    titleEn: 'The simulation does not answer',
    note: 'Tatum tidak menjawab dalam 5 detik. Tidak ada data untuk diperiksa.',
    noteEn: 'Tatum does not answer within 5 seconds. There is no data to check.',
    input: {
      transfer: { recipient: ALAMAT.baru, amountMist: sui('2') },
      simulation: {
        status: 'timeout',
        totalOutflowMist: 0n,
        calledPackages: [],
        leavingObjects: [],
      },
      history: { hasSentToRecipientBefore: false },
      policy: POLICY,
    },
    expected: { decision: 'TOLAK', rules: ['R1'] },
  },
  {
    id: 'simulasi-gagal',
    dapp: 'Pasar Tiruan',
    dappEn: 'Mock Market',
    title: 'Simulasi gagal karena gas',
    titleEn: 'The simulation fails because of gas',
    note: 'Transaksi tidak bisa dijalankan dengan saldo saat ini.',
    noteEn: 'The transfer cannot run with the current balance.',
    input: {
      transfer: { recipient: ALAMAT.teman, amountMist: sui('1.5') },
      simulation: {
        status: 'failed',
        failureReason: 'Saldo tidak cukup untuk membayar gas',
        totalOutflowMist: 0n,
        calledPackages: [],
        leavingObjects: [],
      },
      history: { hasSentToRecipientBefore: true },
      policy: POLICY,
    },
    expected: { decision: 'TOLAK', rules: ['R1'] },
  },
  {
    id: 'di-atas-ambang-outflow',
    dapp: 'Pasar Tiruan',
    dappEn: 'Mock Market',
    title: 'Kirim 6 SUI ke alamat dipercaya',
    titleEn: 'Send 6 SUI to a trusted address',
    note: 'Alamat tepercaya, tetapi total keluar melewati ambang pribadi.',
    noteEn: 'The address is trusted, but total outflow crosses a personal limit.',
    input: {
      transfer: { recipient: ALAMAT.dipercaya, amountMist: sui('6') },
      simulation: {
        status: 'success',
        totalOutflowMist: sui('6'),
        calledPackages: [],
        leavingObjects: [koin('0xcoin-sui-08')],
      },
      history: { hasSentToRecipientBefore: true },
      policy: POLICY,
    },
    expected: { decision: 'TAHAN', rules: ['R3'] },
  },
  {
    id: 'kirim-ke-teman-lama',
    dapp: 'Pasar Tiruan',
    dappEn: 'Mock Market',
    title: 'Kirim 2,5 SUI ke teman lama',
    titleEn: 'Send 2.5 SUI to an old friend',
    note: 'Pernah dikirimi, tetapi belum masuk daftar dipercaya.',
    noteEn: 'He has sent before, but the address is not on the trusted list.',
    input: {
      transfer: { recipient: ALAMAT.teman, amountMist: sui('2.5') },
      simulation: {
        status: 'success',
        totalOutflowMist: sui('2.5'),
        calledPackages: [],
        leavingObjects: [koin('0xcoin-sui-09')],
      },
      history: { hasSentToRecipientBefore: true },
      policy: POLICY,
    },
    expected: { decision: 'TAHAN', rules: ['R9'] },
  },
  {
    id: 'semua-aturan-menyala',
    dapp: 'Pasar Tiruan',
    dappEn: 'Mock Market',
    title: 'Kirim 9 SUI, paket asing, objek ikut, alamat ditandai',
    titleEn: 'Send 9 SUI with a foreign package, a leaving object, and a flagged address',
    note: 'Skenario terburuk untuk melihat slip dengan banyak temuan.',
    noteEn: 'The worst case, used to inspect a slip with many findings.',
    input: {
      transfer: { recipient: ALAMAT.baru, amountMist: sui('9') },
      simulation: {
        status: 'success',
        totalOutflowMist: sui('9'),
        calledPackages: [ALAMAT.paketAsing],
        leavingObjects: [koin('0xcoin-sui-10'), nft('0xnft-hero-02')],
      },
      history: { hasSentToRecipientBefore: false },
      risk: { dangerous: true, source: 'Tatum Risk API' },
      policy: POLICY,
    },
    expected: { decision: 'TAHAN', rules: ['R3', 'R4', 'R5', 'R6', 'R7'] },
  },
];
