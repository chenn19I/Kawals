import { describe, expect, it } from 'vitest';
import { MIST_PER_SUI, formatSui, sui } from '@kawal/rules';

describe('jumlah SUI', () => {
  it('mengubah SUI bulat ke MIST', () => {
    expect(sui('12')).toBe(12n * MIST_PER_SUI);
    expect(sui(1)).toBe(MIST_PER_SUI);
    expect(sui(0)).toBe(0n);
  });

  it('mengubah desimal tanpa pembulatan float', () => {
    expect(sui('0.1')).toBe(100_000_000n);
    expect(sui('0.000000001')).toBe(1n);
    expect(sui('1.234567891')).toBe(1_234_567_891n);
  });

  it('menerima bigint sebagai SUI', () => {
    expect(sui(2n)).toBe(2n * MIST_PER_SUI);
  });

  it('menampilkan MIST sebagai SUI tanpa nol berekor', () => {
    expect(formatSui(12n * MIST_PER_SUI)).toBe('12');
    expect(formatSui(500_000_000n)).toBe('0.5');
    expect(formatSui(1n)).toBe('0.000000001');
    expect(formatSui(1_234_567_891n)).toBe('1.234567891');
  });

  it('bolak-balik SUI ke MIST tetap sama', () => {
    for (const value of ['0', '0.000000001', '0.5', '5', '12.345678901']) {
      expect(formatSui(sui(value))).toBe(value.replace(/\.?0+$/, '') || '0');
    }
  });

  it('menangani nilai negatif', () => {
    expect(sui('-1.5')).toBe(-1_500_000_000n);
    expect(formatSui(-1_500_000_000n)).toBe('-1.5');
  });

  it('menolak lebih dari 9 angka desimal', () => {
    expect(() => sui('0.0000000001')).toThrow(/9 angka desimal/);
  });

  it('menolak format yang tidak dikenal', () => {
    expect(() => sui('1,5')).toThrow(/tidak valid/);
    expect(() => sui('1e9')).toThrow(/tidak valid/);
    expect(() => sui('')).toThrow(/tidak valid/);
  });
});
