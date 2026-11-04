export const MIST_PER_SUI = 1_000_000_000n;

/** Ubah jumlah SUI yang mudah dibaca menjadi MIST tanpa pembulatan float. */
export function sui(value: string | number | bigint): bigint {
  if (typeof value === 'bigint') {
    return value * MIST_PER_SUI;
  }

  const text = typeof value === 'number' ? String(value) : value.trim();
  const match = /^(-?)(\d+)(?:\.(\d+))?$/.exec(text);
  if (!match) {
    throw new Error(`Jumlah SUI tidak valid: "${value}"`);
  }

  const sign = match[1] ?? '';
  const whole = match[2] ?? '0';
  const fraction = match[3] ?? '';

  if (fraction.length > 9) {
    throw new Error(`Jumlah SUI maksimal 9 angka desimal: "${value}"`);
  }

  const mist = BigInt(whole) * MIST_PER_SUI + BigInt(fraction.padEnd(9, '0'));
  return sign === '-' ? -mist : mist;
}

/** Tampilkan MIST sebagai SUI tanpa nol berekor. */
export function formatSui(mist: bigint): string {
  const negative = mist < 0n;
  const absolute = negative ? -mist : mist;
  const whole = absolute / MIST_PER_SUI;
  const fraction = (absolute % MIST_PER_SUI)
    .toString()
    .padStart(9, '0')
    .replace(/0+$/, '');

  return `${negative ? '-' : ''}${whole}${fraction ? `.${fraction}` : ''}`;
}
