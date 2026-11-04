# apps/web

Belum diisi. Rencana dari PRD bagian 10.

## Layar

- Slip pemeriksaan: ringkasan, temuan, memori yang dipakai, tiga tombol.
- Adegan 3D "Pos Pemeriksaan": ban berjalan, lengkung pemindai, Pak Wal.
- Yang Kuingat: daftar memori, tandai lupa, ekspor.
- Kurva Belajar: pertanyaan per sesi, dilabeli replay bila data skenario.
- Status penjaga: aktif, dicabut, galat.

## Batas teknis

- Adegan adalah fungsi murni `f(state, t)` dari `@kawal/scenes`.
- Mode gerak dikurangi dan cadangan 2D wajib.
- Tidak ada kunci rahasia di bundel.
- Putusan diumumkan lewat `aria-live`; warna tidak pernah satu-satunya penanda.
