# Laporan G2: Walrus Memory

Tanggal: 24 Oktober 2026  
Akun: `0xb45b…` (owner `0x40f6…`)  
Namespace: `kwl_a207ee5528dcf574`  
Delegate: **Kawal** (`7a4b…`)

## Hasil

| Uji | Hasil |
| --- | --- |
| Tulis memori | **10/10 berhasil**, 0 gagal |
| Waktu tulis | total 205,2 detik; rata-rata 20,5 detik; rentang 17,8–24,7 detik |
| Recall | 10 pertanyaan, **10/10 relevan di peringkat 1** |
| Akurasi blob top-1 | 9/10 persis; 1 pertanyaan mengembalikan memori penolakan lain yang juga relevan di peringkat 1, memori yang diharapkan ada di peringkat 2 dengan jarak hampir sama |
| Latensi recall | rata-rata 1,9 detik; min 0,9 detik; p95 8,4 detik (query pertama setelah idle); query hangat umumnya 0,9–2,8 detik |
| Biaya terlihat di dompet pemilik | **tidak ada**: saldo SUI/WAL kosong sebelum dan sesudah |

## Memori yang ditulis

| ID | Blob | Waktu |
| --- | --- | --- |
| `alamat-ditolak` | `EVGb6mIzqDA8W0dBy1BN7KFyXC-L5ul49-Hz_QAY6Ps` | 21,7 dtk |
| `alamat-dipercaya` | `tDEnLX55a6hrhbeSGBUNvek5JAstRxbyuVgEQtM04Rw` | 22,9 dtk |
| `batas-outflow` | `rtK57363M_fg7FCAkzbVlZyQ9jDuoj9se7FZKFXfRoc` | 19,0 dtk |
| `batas-penerima-baru` | `W45on3AheRSoITkc1BHae8Kbq4sLGtM-HRd8M0oR6ko` | 24,7 dtk |
| `objek-non-koin` | `iPXqJ76jeXZ8brEGiMTVpEISViLsM_fYT2N5tCx09Q4` | 18,7 dtk |
| `paket-asing` | `DhaEMIA-DHTXBjO607_El-tMulkipn5ozBIZPIIxg8k` | 20,4 dtk |
| `keputusan-tolak` | `6aAP6JpCOlPC9-m6VeE7-tJwsbN59rYODgXRqjOHpdc` | 17,8 dtk |
| `keputusan-lolos` | `B-2GdBakMZZkFtNvj-HptzVbGd3_S-k3kzEC41vxldE` | 18,6 dtk |
| `preferensi-penjelasan` | `omocSUxZnAoKtLe5nwuqov1f-lPEIn-I9Vh1uG5_9N0` | 21,0 dtk |
| `simulasi-gagal` | `VEnuSY4_z2x64djp8joIkAn5TB6CYzOZSsMZGubY7So` | 20,4 dtk |

## Catatan biaya

SDK tidak mengembalikan digest transaksi atau nominal biaya. `stateService.listBalances` untuk dompet pemilik mengembalikan daftar kosong sebelum dan sesudah penulisan, jadi tidak ada potongan SUI/WAL yang terlihat di dompet pemilik. Penulisan tetap berhasil, yang berarti relayer menangani penyimpanan tanpa menarik saldo dari dompet pemilik. Untuk angka biaya yang pasti, diperlukan dasbor/billing relayer atau digest transaksi yang saat ini tidak diekspos SDK.

## Risiko untuk S1

S1 menuntut p95 putusan di bawah 3 detik. Recall saja bisa 8,4 detik pada query pertama setelah idle, dan sekitar 2 detik saat hangat. Karena itu:

1. Jalankan recall dan simulasi Tatum **secara paralel**, bukan berurutan.
2. Jangan menulis memori di jalur keputusan; tulis keputusan secara asinkron setelah slip tampil.
3. Panggil recall pemanasan saat aplikasi dimuat, atau cache hasil recall per alamat/kebijakan.
4. Pertahankan timeout 5 detik untuk simulasi dan fallback R1.

## Berkas bukti

- `spikes/results/g2-2026-10-24T11-16-20-552Z.json`: hasil 10 penulisan.
- `spikes/results/g2-recall-2026-10-24T11-24-29-294Z.json`: hasil 10 query recall.
