import { formatSui } from '@kawal/rules';
import type { Lang } from './i18n';

const LOCALES: Record<Lang, string> = {
  en: 'en-GB',
  id: 'id-ID',
};

export function formatDate(value: string | Date | null | undefined, lang: Lang): string {
  if (!value) return lang === 'en' ? 'Not recorded' : 'Belum tercatat';
  const date = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return lang === 'en' ? 'Not recorded' : 'Belum tercatat';
  return new Intl.DateTimeFormat(LOCALES[lang], {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

export function formatDateTime(
  value: string | Date | null | undefined,
  lang: Lang,
): string {
  if (!value) return lang === 'en' ? 'Not recorded' : 'Belum tercatat';
  const date = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return lang === 'en' ? 'Not recorded' : 'Belum tercatat';
  return new Intl.DateTimeFormat(LOCALES[lang], {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

export function formatRelative(
  value: string | Date | null | undefined,
  lang: Lang,
  now = Date.now(),
): string {
  if (!value) return lang === 'en' ? 'No time' : 'Tanpa waktu';
  const date = typeof value === 'string' ? new Date(value) : value;
  const diff = Math.max(0, now - date.getTime());
  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (diff < minute) return lang === 'en' ? 'just now' : 'baru saja';
  if (diff < hour) {
    const n = Math.floor(diff / minute);
    return lang === 'en' ? `${n} min ago` : `${n} menit lalu`;
  }
  if (diff < day) {
    const n = Math.floor(diff / hour);
    return lang === 'en' ? `${n} h ago` : `${n} jam lalu`;
  }
  if (diff < 7 * day) {
    const n = Math.floor(diff / day);
    return lang === 'en' ? `${n} d ago` : `${n} hari lalu`;
  }
  return formatDate(date, lang);
}

export function formatSuiAmount(mist: string | bigint): string {
  return formatSui(typeof mist === 'bigint' ? mist : BigInt(mist));
}

export function shortBlob(value: string): string {
  if (value.length <= 20) return value;
  return `${value.slice(0, 10)}…${value.slice(-8)}`;
}

export function shortHash(value: string): string {
  if (value.length <= 18) return value;
  return `${value.slice(0, 8)}…${value.slice(-6)}`;
}

export function formatDuration(milliseconds: number): string {
  const total = Math.max(0, Math.floor(milliseconds / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  return [hours, minutes, seconds].map((part) => String(part).padStart(2, '0')).join(':');
}
