# spikes

Skrip gerbang Go/No-Go dari PRD bagian 14. Bukan bagian runtime aplikasi.

## Perintah

```sh
pnpm --filter @kawal/spikes tatum       # G1: checkpoint lewat Tatum
pnpm --filter @kawal/spikes memwal      # G2: health + recall
pnpm --filter @kawal/spikes g2          # G2: tulis 10 memori ke Mainnet
pnpm --filter @kawal/spikes g2-recall   # G2: 10 query recall + akurasi top-1
pnpm --filter @kawal/spikes account     # baca objek MemWalAccount + delegate
pnpm --filter @kawal/spikes account-id  # cari ID akun dari alamat pemilik
pnpm --filter @kawal/spikes balance     # saldo SUI dompet pemilik
pnpm --filter @kawal/spikes discover    # objek milik alamat pemilik
```

Semua membaca `../.env.local` dan tidak pernah mencetak nilai rahasia.

## Status 24 Oktober 2026

| Gerbang | Hasil |
| --- | --- |
| G1 Tatum gRPC | Tersambung. Checkpoint Mainnet terbaca ~2,3 detik. Simulasi transfer penuh belum dijalankan karena dompet pemilik punya 0 SUI dan faucet Testnet tidak bisa dipakai otomatis. |
| G2 Walrus Memory | **Lulus.** 10/10 memori tertulis di Mainnet; 10/10 query recall relevan di peringkat 1. Rata-rata tulis 20,5 detik; recall hangat ~0,9–2,8 detik. Biaya tidak terlihat di dompet pemilik. |

Laporan lengkap: [G2-REPORT.md](./G2-REPORT.md).

## Temuan penting

- `MEMWAL_ACCOUNT_ID` harus objek `MemWalAccount`, bukan alamat dompet. Untuk dompet `0x40f6…`, akunnya `0xb45b…` (ditemukan lewat tabel registry).
- `MEMWAL_KEY` harus **private key** delegate. Private key yang diberikan cocok dengan delegate **"Kawal"** (public key `7a4b…`), bukan delegate "Web App" (`e266…`).
- Relayer menolak dengan `401 AUTH_REJECTED` bila public key dipakai sebagai private key.
- Dompet pemilik memiliki 47 objek `blob::Blob` Walrus, tetapi saldo SUI-nya 0.
- Recall pertama setelah idle bisa 7–8 detik; query berikutnya sekitar 1–2 detik. Jalankan recall dan simulasi Tatum secara paralel agar S1 tetap di bawah 3 detik.
- `rememberAndWait` memakai idempotency key stabil, jadi menjalankan ulang `g2` tidak menggandakan penulisan yang sudah berhasil.

## Berkas hasil

`spikes/results/` menyimpan JSON bukti G2: blob ID, latensi per penulisan, hasil recall, dan saldo sebelum/sesudah. Berkas ini tidak berisi kunci rahasia.
