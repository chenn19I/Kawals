import { ApiRequestError } from './api';
import type { Lang } from './i18n';

const MESSAGES: Record<string, { en: string; id: string }> = {
  NETWORK: {
    en: 'The Kawal API cannot be reached. Start the API server and try again.',
    id: 'API Kawal tidak dapat dihubungi. Jalankan server API lalu coba lagi.',
  },
  NETWORK_NOT_CONFIGURED: {
    en: 'Tatum is not configured on the server. A live check needs a Tatum API key.',
    id: 'Tatum belum dikonfigurasi di server. Pemeriksaan live membutuhkan kunci API Tatum.',
  },
  NETWORK_UNAVAILABLE: {
    en: 'Tatum did not return a checkpoint. No check was recorded.',
    id: 'Tatum tidak memberi checkpoint. Tidak ada pemeriksaan yang dicatat.',
  },
  MEMORY_UNAVAILABLE: {
    en: 'Walrus Memory could not be read. Kawal stopped so no rule was skipped.',
    id: 'Memori Walrus tidak dapat dibaca. Kawal berhenti agar tidak ada aturan yang terlewat.',
  },
  MEMORY_WRITE_FAILED: {
    en: 'The memory could not be written to Walrus. Nothing was saved.',
    id: 'Memori tidak dapat ditulis ke Walrus. Tidak ada yang disimpan.',
  },
  MEMORY_LIST_UNAVAILABLE: {
    en: 'Walrus did not answer the list request. Showing the server copy.',
    id: 'Walrus tidak menjawab permintaan daftar. Menampilkan salinan server.',
  },
  RATE_LIMITED: {
    en: 'Too many requests. Wait a minute and try again.',
    id: 'Terlalu banyak permintaan. Tunggu satu menit lalu coba lagi.',
  },
  INVALID_REQUEST: {
    en: 'Check the form. One value is missing or not valid.',
    id: 'Periksa formulir. Ada nilai yang kosong atau tidak sah.',
  },
  INVALID_JSON: {
    en: 'The request body was not valid JSON.',
    id: 'Body permintaan bukan JSON yang sah.',
  },
  GUARD_REVOKED: {
    en: 'The guard is revoked on the server. Restore it before checking another transfer.',
    id: 'Penjaga dicabut di server. Aktifkan kembali sebelum memeriksa transfer lain.',
  },
  EVALUATION_NOT_FOUND: {
    en: 'That check has expired. Run the preflight again.',
    id: 'Pemeriksaan itu sudah kedaluwarsa. Jalankan preflight lagi.',
  },
  DECISION_NOT_FOUND: {
    en: 'That decision was not found on the server.',
    id: 'Keputusan itu tidak ditemukan di server.',
  },
  MEMORY_NOT_FOUND: {
    en: 'That memory was not found on the server.',
    id: 'Memori itu tidak ditemukan di server.',
  },
  UNAUTHORIZED: {
    en: 'This action needs the server admin token.',
    id: 'Tindakan ini membutuhkan token admin server.',
  },
  INTERNAL_ERROR: {
    en: 'The server hit an unexpected error. Try again.',
    id: 'Server mengalami kesalahan tak terduga. Coba lagi.',
  },
  NOT_FOUND: {
    en: 'The requested endpoint does not exist.',
    id: 'Jalur yang diminta tidak ada.',
  },
};

export function errorText(error: unknown, lang: Lang): string {
  const code = error instanceof ApiRequestError ? error.code : 'NETWORK';
  const known = MESSAGES[code];
  if (known) return known[lang];
  return lang === 'en'
    ? 'Something went wrong. Try again.'
    : 'Terjadi kesalahan. Coba lagi.';
}
