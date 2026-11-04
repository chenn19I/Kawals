/**
 * Alamat Sui adalah 32 byte. Bentuk pendek seperti 0x2 sah dan
 * dinormalkan ke 64 digit heksadesimal agar perbandingan tidak salah.
 */
export const SUI_FRAMEWORK_ADDRESS = `0x${'0'.repeat(63)}2`;

const HEX_PATTERN = /^[0-9a-f]+$/;

export function normalizeAddress(value: string): string {
  const trimmed = value.trim();
  const hasPrefix = trimmed.startsWith('0x') || trimmed.startsWith('0X');
  const body = hasPrefix ? trimmed.slice(2) : trimmed;

  if (body.length === 0 || body.length > 64) {
    throw new Error(`Alamat Sui tidak valid: "${value}"`);
  }

  const lower = body.toLowerCase();
  if (!HEX_PATTERN.test(lower)) {
    throw new Error(`Alamat Sui tidak valid: "${value}"`);
  }

  return `0x${lower.padStart(64, '0')}`;
}

export function safeNormalizeAddress(value: string): string | null {
  try {
    return normalizeAddress(value);
  } catch {
    return null;
  }
}

export function sameAddress(a: string, b: string): boolean {
  return normalizeAddress(a) === normalizeAddress(b);
}

/** Bentuk pendek untuk teks UI, misalnya 0x00a1…e5f6. */
export function shortAddress(value: string): string {
  const normalized = normalizeAddress(value);
  return `${normalized.slice(0, 6)}…${normalized.slice(-4)}`;
}

/**
 * Objek koin Sui selalu bertipe 0x2::coin::Coin<T>.
 * Koin yang dibungkus paket lain tetap koin selama tipe luarnya Coin.
 */
export function isCoinType(objectType: string): boolean {
  const parts = objectType.split('::');
  if (parts.length < 3) return false;

  const packageId = parts[0] ?? '';
  const moduleName = parts[1] ?? '';
  const structName = parts.slice(2).join('::');

  if (moduleName !== 'coin' || !structName.startsWith('Coin<')) return false;
  return safeNormalizeAddress(packageId) === SUI_FRAMEWORK_ADDRESS;
}
