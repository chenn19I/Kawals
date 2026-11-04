import { safeNormalizeAddress, shortAddress, type Finding, type RuleId } from '@kawal/rules';
import type { Lang } from './i18n';
import { RULES } from './copy';

function value(finding: Finding, key: string): string {
  return finding.evidence[key] ?? '';
}

function shortPackageList(raw: string): string {
  return raw
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => {
      const normalized = safeNormalizeAddress(item);
      return normalized ? shortAddress(normalized) : item;
    })
    .join(', ');
}

export function ruleName(id: RuleId, lang: Lang): string {
  return (RULES.find((rule) => rule.id === id) ?? RULES[0]!).name[lang];
}

export function findingText(finding: Finding, lang: Lang): string {
  const outflow = value(finding, 'outflowSui');
  const threshold = value(finding, 'thresholdSui');
  const amount = value(finding, 'amountSui');
  const address = value(finding, 'shortAddress');
  const packages = shortPackageList(value(finding, 'packages'));
  const objectCount = value(finding, 'objectIds').split(',').filter(Boolean).length;
  const source = value(finding, 'source');
  const failureCode = value(finding, 'failureCode');

  if (lang === 'en') {
    switch (finding.rule) {
      case 'R1':
        return failureCode === 'INSUFFICIENT_BALANCE'
          ? 'The wallet balance is below the amount plus the gas budget. This transfer cannot be checked.'
          : 'The network check did not pass. This transfer cannot be checked.';
      case 'R2':
        return `The recipient ${address} is on your deny list.`;
      case 'R3':
        return `Total outflow of ${outflow} SUI is above your ${threshold} SUI limit.`;
      case 'R4':
        return `This is a new recipient and ${amount} SUI is above your ${threshold} SUI limit.`;
      case 'R5':
        return `The transfer calls an unknown Move package: ${packages || 'unreadable package'}.`;
      case 'R6':
        return `The transfer moves ${objectCount} non-coin ${objectCount === 1 ? 'object' : 'objects'} out of your wallet.`;
      case 'R7':
        return `A risk source flagged the recipient: ${source || 'external source'}.`;
      case 'R8':
        return `Trusted recipient. ${amount} SUI is below your ${threshold} SUI limit.`;
      case 'R9':
        return 'No rule matched. The safe default is to hold.';
    }
  }

  switch (finding.rule) {
    case 'R1':
      return failureCode === 'INSUFFICIENT_BALANCE'
        ? 'Saldo dompet di bawah jumlah ditambah anggaran gas. Transfer ini tidak bisa diperiksa.'
        : 'Pemeriksaan jaringan tidak berhasil. Transfer ini tidak bisa diperiksa.';
    case 'R2':
      return `Alamat ${address} ada di daftar tolakmu.`;
    case 'R3':
      return `Total keluar ${outflow} SUI melebihi batas ${threshold} SUI.`;
    case 'R4':
      return `Ini penerima baru dan ${amount} SUI melebihi batas ${threshold} SUI.`;
    case 'R5':
      return `Transfer memanggil paket Move yang belum dikenal: ${packages || 'paket tidak terbaca'}.`;
    case 'R6':
      return `Transfer memindahkan ${objectCount} objek non-koin keluar dari dompetmu.`;
    case 'R7':
      return `Sumber risiko menandai penerima: ${source || 'sumber eksternal'}.`;
    case 'R8':
      return `Penerima dipercaya. ${amount} SUI masih di bawah batas ${threshold} SUI.`;
    case 'R9':
      return 'Tidak ada aturan yang cocok. Bawaan aman: tahan dulu.';
  }
}

export function findingDetail(finding: Finding, lang: Lang): string {
  if (finding.rule === 'R6') {
    const ids = value(finding, 'objectIds').split(',').filter(Boolean);
    return ids.join(', ');
  }
  if (finding.rule === 'R5') {
    return value(finding, 'packages');
  }
  if (finding.rule === 'R1') {
    return value(finding, 'reason');
  }
  return '';
}
