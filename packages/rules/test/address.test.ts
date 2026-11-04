import { describe, expect, it } from 'vitest';
import {
  SUI_FRAMEWORK_ADDRESS,
  isCoinType,
  normalizeAddress,
  sameAddress,
  shortAddress,
} from '@kawal/rules';

describe('alamat Sui', () => {
  it('menormalkan alamat pendek ke 64 digit heksadesimal', () => {
    expect(normalizeAddress('0x2')).toBe(SUI_FRAMEWORK_ADDRESS);
    expect(normalizeAddress('2')).toBe(SUI_FRAMEWORK_ADDRESS);
    expect(normalizeAddress('0x002')).toBe(SUI_FRAMEWORK_ADDRESS);
  });

  it('menormalkan huruf besar menjadi huruf kecil', () => {
    expect(normalizeAddress('0xABC')).toBe(`0x${'0'.repeat(61)}abc`);
  });

  it('menolak alamat kosong, terlalu panjang, dan bukan heksadesimal', () => {
    expect(() => normalizeAddress('')).toThrow(/tidak valid/);
    expect(() => normalizeAddress('0x')).toThrow(/tidak valid/);
    expect(() => normalizeAddress(`0x${'a'.repeat(65)}`)).toThrow(/tidak valid/);
    expect(() => normalizeAddress('0xzz')).toThrow(/tidak valid/);
  });

  it('membandingkan dua bentuk alamat yang berbeda', () => {
    expect(sameAddress('0x2', `0x${'0'.repeat(63)}2`)).toBe(true);
    expect(sameAddress('0x2', '0x3')).toBe(false);
  });

  it('menampilkan bentuk pendek yang tetap bisa dicocokkan mata', () => {
    expect(shortAddress('0x2')).toBe('0x0000…0002');
  });

  it('mengenali koin framework dengan tipe dalam apa pun', () => {
    expect(isCoinType('0x2::coin::Coin<0x2::sui::SUI>')).toBe(true);
    expect(isCoinType('0x2::coin::Coin<0xabc::usdc::USDC>')).toBe(true);
  });

  it('menolak objek non-koin dan tipe yang rusak', () => {
    expect(isCoinType('0x8b::hero::Hero')).toBe(false);
    expect(isCoinType('0xabc::coin::Coin<0xabc::usdc::USDC>')).toBe(false);
    expect(isCoinType('0x2::coin::Token<0x2::sui::SUI>')).toBe(false);
    expect(isCoinType('0x2::coin::Coin')).toBe(false);
    expect(isCoinType('bukan-tipe')).toBe(false);
  });
});
