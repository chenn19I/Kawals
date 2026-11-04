import type { Decision, MemoryKind, RuleId, ThresholdKey } from '@kawal/rules';
import type { Lang } from './i18n';

export type IconName =
  | 'arrow-right'
  | 'check'
  | 'chevron-down'
  | 'chevron-right'
  | 'clock'
  | 'copy'
  | 'external'
  | 'info'
  | 'lock'
  | 'memory'
  | 'menu'
  | 'pause'
  | 'play'
  | 'plus'
  | 'refresh'
  | 'scan'
  | 'shield'
  | 'trash'
  | 'wallet'
  | 'warning'
  | 'x';

export interface DecisionCopy {
  label: string;
  title: string;
  description: string;
  action: string;
}

export const DECISION_COPY: Record<
  Decision,
  { en: DecisionCopy; id: DecisionCopy; tone: 'pass' | 'hold' | 'block'; icon: IconName }
> = {
  LOLOS: {
    tone: 'pass',
    icon: 'check',
    en: {
      label: 'PASS',
      title: 'Below your limits',
      description: 'The transfer matches the rules and memory Kawal can see.',
      action: 'Save pass',
    },
    id: {
      label: 'LOLOS',
      title: 'Masih dalam batas',
      description: 'Transfer cocok dengan aturan dan memori yang dibaca Kawal.',
      action: 'Simpan lolos',
    },
  },
  TAHAN: {
    tone: 'hold',
    icon: 'pause',
    en: {
      label: 'HOLD',
      title: 'Stop and review',
      description: 'At least one finding needs your attention before this goes further.',
      action: 'Save hold',
    },
    id: {
      label: 'TAHAN',
      title: 'Berhenti dan periksa',
      description: 'Ada temuan yang perlu kamu lihat sebelum transfer diteruskan.',
      action: 'Simpan tahan',
    },
  },
  TOLAK: {
    tone: 'block',
    icon: 'x',
    en: {
      label: 'REJECT',
      title: 'Do not sign this',
      description: 'The transfer breaks a rule you set, or the network check failed.',
      action: 'Save reject',
    },
    id: {
      label: 'TOLAK',
      title: 'Jangan tanda tangani',
      description: 'Transfer melanggar aturanmu, atau pemeriksaan jaringan gagal.',
      action: 'Simpan tolak',
    },
  },
};

export const RULES: Array<{
  id: RuleId;
  name: { en: string; id: string };
  body: { en: string; id: string };
  decision: Decision;
}> = [
  {
    id: 'R1',
    name: { en: 'Network check incomplete', id: 'Pemeriksaan jaringan tidak lengkap' },
    body: {
      en: 'If Tatum cannot provide the checkpoint or the balance check fails, the transfer is rejected. Kawal never guesses around missing network data.',
      id: 'Bila Tatum tidak memberi checkpoint atau saldo tidak bisa dibaca, transfer ditolak. Kawal tidak menebak saat data jaringan hilang.',
    },
    decision: 'TOLAK',
  },
  {
    id: 'R2',
    name: { en: 'Deny list', id: 'Daftar tolak' },
    body: {
      en: 'A recipient stored as blocked in Walrus Memory is rejected immediately.',
      id: 'Penerima yang disimpan sebagai diblokir di Walrus Memory langsung ditolak.',
    },
    decision: 'TOLAK',
  },
  {
    id: 'R3',
    name: { en: 'Total outflow', id: 'Total keluar' },
    body: {
      en: 'The amount plus the gas budget must stay under your maximum outflow. The default is 5 SUI.',
      id: 'Jumlah ditambah anggaran gas harus di bawah batas keluar. Bawaannya 5 SUI.',
    },
    decision: 'TAHAN',
  },
  {
    id: 'R4',
    name: { en: 'New recipient', id: 'Penerima baru' },
    body: {
      en: 'A recipient with no recorded send in Kawal must stay under your new recipient limit. The default is 1 SUI.',
      id: 'Penerima tanpa catatan pengiriman di Kawal harus di bawah batas penerima baru. Bawaannya 1 SUI.',
    },
    decision: 'TAHAN',
  },
  {
    id: 'R5',
    name: { en: 'Unknown Move package', id: 'Paket Move asing' },
    body: {
      en: 'A Move package outside the Sui framework allowlist is held, even when the SUI amount looks small.',
      id: 'Paket Move di luar allowlist framework Sui ditahan, meski jumlah SUI terlihat kecil.',
    },
    decision: 'TAHAN',
  },
  {
    id: 'R6',
    name: { en: 'Non-coin object leaves', id: 'Objek non-koin keluar' },
    body: {
      en: 'If an NFT or another owned object leaves the wallet, the transfer is held.',
      id: 'Bila NFT atau objek lain milikmu keluar dari dompet, transfer ditahan.',
    },
    decision: 'TAHAN',
  },
  {
    id: 'R7',
    name: { en: 'Recipient flagged risky', id: 'Penerima ditandai berbahaya' },
    body: {
      en: 'A connected risk source can raise a hold. This build does not ship a risk provider, so the rule stays quiet during live checks.',
      id: 'Sumber risiko yang terhubung dapat menaikkan status tahan. Build ini belum punya penyedia risiko, jadi aturan ini diam saat pemeriksaan live.',
    },
    decision: 'TAHAN',
  },
  {
    id: 'R8',
    name: { en: 'Trusted recipient', id: 'Penerima dipercaya' },
    body: {
      en: 'Only a trusted recipient below the trusted limit passes without another finding. The limit is strict.',
      id: 'Hanya penerima dipercaya di bawah batas yang lolos tanpa temuan lain. Batasnya ketat.',
    },
    decision: 'LOLOS',
  },
  {
    id: 'R9',
    name: { en: 'Safe default', id: 'Bawaan aman' },
    body: {
      en: 'When no other rule fires, Kawal holds. Silence is not permission.',
      id: 'Bila tidak ada aturan lain yang menyala, Kawal menahan. Diam bukan izin.',
    },
    decision: 'TAHAN',
  },
];

export const KIND_LABEL: Record<MemoryKind, { en: string; id: string }> = {
  aturan: { en: 'Rule', id: 'Aturan' },
  alamat: { en: 'Address', id: 'Alamat' },
  keputusan: { en: 'Decision', id: 'Keputusan' },
  preferensi: { en: 'Preference', id: 'Preferensi' },
};

export const THRESHOLD_LABEL: Record<ThresholdKey, { en: string; id: string }> = {
  maxOutflow: { en: 'Maximum outflow', id: 'Maksimum keluar' },
  newRecipientMax: { en: 'New recipient limit', id: 'Batas penerima baru' },
  trustedMax: { en: 'Trusted recipient limit', id: 'Batas penerima dipercaya' },
};

export function decisionCopy(decision: Decision, lang: Lang): DecisionCopy {
  return DECISION_COPY[decision][lang];
}

export function ruleMeta(id: RuleId): (typeof RULES)[number] {
  return RULES.find((rule) => rule.id === id) ?? RULES[0]!;
}

export function screenTitle(
  screen: 'home' | 'check' | 'memory' | 'status' | 'market' | 'learning' | 'maskot',
  lang: Lang,
): string {
  const titles = {
    home: { en: 'Kawal · Sui transfer guard', id: 'Kawal · Penjaga transfer Sui' },
    check: { en: 'Check a transfer · Kawal', id: 'Periksa transfer · Kawal' },
    memory: { en: 'Walrus Memory · Kawal', id: 'Memori Walrus · Kawal' },
    status: { en: 'Guard status · Kawal', id: 'Status penjaga · Kawal' },
    market: { en: 'Pasar tiruan · Kawal', id: 'Pasar tiruan · Kawal' },
    learning: { en: 'Kurva belajar · Kawal', id: 'Kurva belajar · Kawal' },
    maskot: { en: 'Maskot · Kawal', id: 'Maskot · Kawal' },
  } as const;
  return titles[screen][lang];
}

export const EXPLORER = {
  mainnet: {
    checkpoint: (sequence: string) => `https://suiscan.xyz/mainnet/checkpoint/${sequence}`,
  },
  testnet: {
    checkpoint: (sequence: string) => `https://suiscan.xyz/testnet/checkpoint/${sequence}`,
  },
} as const;
