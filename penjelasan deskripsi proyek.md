# Penjelasan Deskripsi Proyek: Kawal

## Identitas proyek

| Bagian | Keterangan |
| --- | --- |
| Nama proyek | Kawal |
| Tagline | Penjaga transaksi Sui yang mengingat keputusanmu |
| Jenis | Prototipe aplikasi keamanan transaksi berbasis memori pribadi |
| Platform | Web, API server, dan paket aturan yang dapat dipakai ulang |
| Teknologi utama | TypeScript, React, Vite, Hono, Sui, Walrus Memory, Tatum |
| Status | Demo web M2 berjalan, API mock/replay siap, G2 Walrus lulus |
| Repositori | Monorepo pnpm |

## Ringkasan proyek

Kawal adalah pos pemeriksaan sebelum transaksi Sui ditandatangani. Alih-alih hanya menampilkan peringatan umum dari dompet, Kawal memeriksa transaksi terhadap aturan yang jelas dan terhadap memori pribadi pengguna. Memori itu berisi penerima yang dipercaya, penerima yang ditolak, batas nominal, serta keputusan yang pernah diambil.

Hasil pemeriksaan selalu berupa salah satu dari tiga putusan:

- **LOLOS**: transaksi sesuai kebijakan dan boleh dilanjutkan.
- **TAHAN**: ada risiko atau pelanggaran batas yang perlu ditinjau sebelum melanjutkan.
- **TOLAK**: transaksi melanggar aturan keras dan tidak boleh dilanjutkan.

Kawal tidak memegang kunci dompet dan tidak menandatangani transaksi. Tugasnya adalah memberi penilaian yang dapat diaudit sebelum pengguna menekan tombol tanda tangan.

## 1. Latar belakang

Dompet kripto umumnya memberi peringatan yang sama untuk semua orang. Peringatan itu tidak tahu bahwa pengguna pernah menolak alamat tertentu, pernah kehilangan dana karena nominal besar, atau sudah menetapkan batas pengeluaran pribadi. Akibatnya, pengguna terus mengulang keputusan yang sama dan risiko yang sama.

Kawal mencoba menyelesaikan masalah itu dengan tiga gagasan:

1. **Periksa sebelum tanda tangan.** Risiko dinilai sebelum transaksi masuk ke dompet.
2. **Ingat keputusan pengguna.** Keputusan disimpan sebagai memori, bukan hanya sebagai riwayat yang pasif.
3. **Ubah memori menjadi kebijakan.** Memori yang tersimpan dipakai lagi pada pemeriksaan berikutnya.

## 2. Tujuan proyek

### Tujuan utama

Mengurangi risiko transaksi yang tidak diinginkan dengan menyediakan pemeriksaan transaksi yang konsisten, personal, dan mudah dipahami.

### Tujuan produk

- Memberi batas pengeluaran pribadi yang dapat disesuaikan.
- Mengenali penerima yang dipercaya dan penerima yang ditolak.
- Menahan transaksi berisiko sebelum ditandatangani.
- Menjelaskan alasan putusan dengan bahasa yang dapat dibaca manusia.
- Menyimpan keputusan agar penjaga semakin sesuai dengan kebiasaan pengguna.
- Menjaga agar pengguna tetap memegang kendali penuh atas dompet dan memori.

### Tujuan teknis

- Membuat mesin aturan yang murni, deterministik, dan dapat diuji.
- Memisahkan rahasia server dari bundel frontend.
- Menyimpan nominal uang dalam bentuk integer MIST, bukan bilangan pecahan.
- Menyediakan API yang dapat dipakai ulang oleh web atau integrasi lain.
- Menyediakan skenario uji yang mencakup batas ambang dan kombinasi aturan.
- Menjaga aksesibilitas, responsivitas, dan dukungan kurangi gerak.

### Tujuan ekosistem

- Menunjukkan pola memori pribadi yang dapat dipakai lintas aplikasi di ekosistem Sui.
- Menjadi contoh integrasi Walrus Memory yang tidak menitipkan kunci pengguna ke aplikasi.
- Menjadi fondasi untuk pemeriksaan transaksi yang dapat diaudit, bukan kotak hitam.

## 3. Fungsi proyek

| Fungsi | Penjelasan |
| --- | --- |
| Memeriksa transaksi | Menjalankan aturan R1 sampai R9 terhadap penerima, nominal, simulasi, riwayat, dan tingkat risiko. |
| Menyusun kebijakan | Mengubah memori terstruktur menjadi daftar tolak, daftar percaya, dan ambang nominal. |
| Mengingat keputusan | Menyimpan keputusan pengguna sebagai memori baru untuk pemeriksaan berikutnya. |
| Menjelaskan putusan | Menampilkan aturan yang terpicu, temuan, dan alasan dalam bahasa Indonesia. |
| Menampilkan riwayat | Menyediakan linimasa putusan dan statistik aturan yang sering terpicu. |
| Mengelola penjaga | Mengaktifkan, mencabut, dan memulihkan penjaga pada sesi demo. |
| Menyediakan API | Menyediakan endpoint health, skenario, evaluasi, keputusan, memori, revoke, dan restore. |
| Menyediakan bahan uji | Menyediakan 12 skenario Pasar Tiruan dengan putusan yang diharapkan. |
| Menampilkan status sistem | Menampilkan jam, uptime, jumlah memori, jumlah putusan, dan status API secara langsung. |

## 4. Cara kerja sistem

Alur utama Kawal:

```text
Transaksi atau simulasi
        |
        v
Normalisasi alamat dan nominal MIST
        |
        v
Recall memori penerima dan batas pengeluaran
        |
        v
Susun kebijakan dari memori
        |
        v
Jalankan aturan R1 sampai R9
        |
        v
Putusan: LOLOS / TAHAN / TOLAK
        |
        v
Penjelasan dan temuan
        |
        v
Keputusan pengguna
        |
        v
Tulis memori keputusan
        |
        v
Pemeriksaan berikutnya memakai memori baru
```

Penjelasan tiap tahap:

1. **Masukan transaksi.** Sistem menerima penerima, nominal, hasil simulasi, riwayat pengiriman, tingkat risiko, dan daftar paket yang dipanggil.
2. **Normalisasi.** Alamat Sui diseragamkan. Nominal wajib berupa bilangan bulat MIST agar tidak ada pembulatan pecahan.
3. **Recall memori.** Memori yang relevan dengan penerima dan aturan batas diambil dari penyimpanan.
4. **Penyusunan kebijakan.** Memori diubah menjadi kebijakan yang bisa dieksekusi. Jika ada dua ambang yang bertentangan, nilai yang paling ketat dipakai.
5. **Evaluasi aturan.** R1 diperiksa lebih dulu. Jika R1 tidak terpicu, R2 sampai R7 dikumpulkan agar semua temuan terlihat. Keputusan terberat menang: TOLAK lebih berat dari TAHAN, dan TAHAN lebih berat dari LOLOS.
6. **R8 dan R9.** Keduanya hanya berlaku jika R1 sampai R7 tidak menghasilkan temuan.
7. **Penjelasan.** Penjelasan dibuat dengan template deterministik. LLM tidak dipakai untuk mengubah putusan.
8. **Keputusan pengguna.** Pengguna dapat menerima, menahan, atau menolak transaksi. Keputusan itu menjadi memori baru.
9. **Memori berikutnya.** Penerima yang ditolak, dipercaya, atau pernah dikirimi akan memengaruhi pemeriksaan selanjutnya.

## 5. Aturan keputusan

| ID | Kondisi | Putusan |
| --- | --- | --- |
| R1 | Simulasi gagal atau tidak menjawab | TOLAK |
| R2 | Penerima ada di daftar tolak | TOLAK |
| R3 | Total saldo keluar melebihi ambang pribadi | TAHAN |
| R4 | Penerima belum pernah dikirimi dan nominal di atas ambang penerima baru | TAHAN |
| R5 | Memanggil paket Move yang belum dikenal | TAHAN |
| R6 | Memindahkan objek milik pengguna selain koin | TAHAN |
| R7 | Penerima ditandai berbahaya oleh sumber data | TAHAN |
| R8 | Penerima dipercaya dan nominal di bawah batas | LOLOS |
| R9 | Tidak ada aturan yang cocok | TAHAN |

Ambang bawaan:

- Total keluar maksimum: **5 SUI**.
- Penerima baru maksimum: **1 SUI**.
- Penerima dipercaya maksimum: **5 SUI**.

Dua perilaku penting:

- **Kepercayaan tidak otomatis melewati R4.** Penerima yang ada di daftar percaya tetapi belum pernah dikirimi tetap kena R4 jika nominalnya di atas ambang penerima baru.
- **Batas R8 bersifat ketat.** Nominal tepat 5 SUI pada penerima dipercaya tidak LOLOS, tetapi jatuh ke R9 (TAHAN). Ini disengaja dan diuji sebagai batas.

## 6. Arsitektur dan struktur folder

```text
kawal/
  apps/
    web/          antarmuka demo, enam layar, adegan 3D, state demo
    api/          server Hono, evaluasi, keputusan, memori, revoke
  packages/
    rules/        mesin aturan R1-R9, kebijakan, format SUI/MIST
    scenes/       placeholder paket adegan bersama
    video/        placeholder video Remotion
  fixtures/       12 skenario Pasar Tiruan
  spikes/         bukti dan catatan eksperimen Tatum serta Walrus
```

Pembagian tanggung jawab:

- **`packages/rules`** tidak melakukan I/O, tidak membaca waktu, dan tidak memakai angka acak. Fungsi yang sama dengan masukan yang sama selalu menghasilkan putusan yang sama.
- **`fixtures`** menyimpan skenario dan putusan yang diharapkan. Fixture bergantung pada aturan, tetapi tes aturan tidak bergantung pada fixture.
- **`apps/api`** menjalankan recall memori, menyusun kebijakan, memanggil mesin aturan, menyimpan slip, dan menulis memori.
- **`apps/web`** menyediakan pengalaman demo. Evaluasi di layar masih berjalan lokal dengan mesin aturan yang sama. Layar Status Penjaga membaca health API secara langsung.
- **`spikes`** menyimpan bukti eksperimen teknis, termasuk laporan G2 Walrus.

## 7. Layar web

| Rute | Layar | Fungsi |
| --- | --- | --- |
| `#/` | Beranda | Menjelaskan pos pemeriksaan, contoh slip, dan konsol sistem waktu nyata. |
| `#/pasar` | Pasar Tiruan | Menampilkan 12 transaksi tiruan dengan filter dan penanda putusan terakhir. |
| `#/slip` | Slip Pemeriksaan | Menampilkan pemindaian bertahap, temuan, memori yang dipakai, dan meter kebijakan. |
| `#/memori` | Yang Kuingat | Menampilkan atlas memori yang dapat difilter, rincian memori, dan aksi lupakan. |
| `#/kurva` | Kurva Belajar | Menampilkan dial kesepakatan, linimasa putusan, dan aturan yang sering terpicu. |
| `#/status` | Status Penjaga | Menampilkan vital sesi, status API langsung, akun dan delegate, bukti G2, dan revoke lokal. |

Angka waktu nyata diambil dari state sebenarnya: jam Jakarta, uptime sesi, jumlah memori aktif, jumlah putusan, jumlah skenario unik yang diperiksa, dan latensi API. Tidak ada metrik karangan.

## 8. Langkah-langkah menggunakan proyek

### 8.1 Prasyarat

- Node.js 22 atau lebih baru.
- pnpm 10 atau lebih baru.
- Browser modern dengan dukungan WebGL untuk adegan 3D.
- Untuk mode Walrus: kredensial delegate dan akun MemWal yang valid.
- Untuk simulasi Tatum live: dompet Sui yang sudah didanai.

### 8.2 Instalasi

Dari folder proyek:

```sh
pnpm install
```

### 8.3 Menjalankan mode demo

Buka dua terminal.

Terminal pertama, jalankan web:

```sh
pnpm dev:web
```

Terminal kedua, jalankan API:

```sh
pnpm dev:api
```

Alamat bawaan:

- Web: `http://127.0.0.1:5173`
- API: `http://127.0.0.1:8787`

Jika API berada di alamat lain, isi `VITE_API_URL` di environment web. Variabel ini hanya boleh berisi alamat publik, bukan kunci rahasia.

### 8.4 Mencoba alur demo

1. Buka Beranda dan lihat pos pemeriksaan.
2. Masuk ke **Pasar Tiruan**.
3. Hubungkan **dompet demo**.
4. Aktifkan penjaga.
5. Pilih salah satu dari 12 skenario.
6. Periksa slip: temuan, aturan yang terpicu, memori yang dipakai, dan meter kebijakan.
7. Ambil keputusan pada slip.
8. Buka **Yang Kuingat** untuk melihat memori baru.
9. Buka **Kurva Belajar** untuk melihat riwayat dan aturan yang sering terpicu.
10. Buka **Status Penjaga** untuk melihat vital sesi, status API, dan bukti G2.
11. Gunakan **Reset demo** untuk mengembalikan state awal.

### 8.5 Menjalankan pemeriksaan kualitas

```sh
pnpm check
pnpm build:web
```

`pnpm check` menjalankan typecheck dan seluruh tes. `pnpm build:web` membuat bundel produksi web.

### 8.6 Menguji API secara manual

```sh
curl http://127.0.0.1:8787/health
```

Contoh evaluasi skenario mock:

```sh
curl -X POST http://127.0.0.1:8787/evaluate \
  -H "Content-Type: application/json" \
  -d "{\"mode\":\"mock\",\"scenarioId\":\"transfer-12-sui-alamat-baru\"}"
```

Mode `mock` dan `replay` tersedia. Mode `live` akan mengembalikan `501` sampai simulasi Tatum live siap.

### 8.7 Mode Walrus Memory

Untuk memakai Walrus Memory, API membaca variabel berikut dari `.env.local`:

- `MEMWAL_OWNER`
- `MEMWAL_ACCOUNT_ID`
- `MEMWAL_KEY` (private key delegate Ed25519)
- `MEMWAL_SERVER_URL`
- `MEMWAL_NAMESPACE`

Jalankan API dengan `KAWAL_MEMORY_MODE=walrus`. Jangan pernah menaruh nilai rahasia di variabel `VITE_` atau di kode frontend.

### 8.8 Menghentikan proyek

Tekan `Ctrl+C` pada kedua terminal. Jangan menutup terminal secara paksa jika penulisan memori sedang berjalan.

## 9. Status implementasi

### Sudah berjalan

- Mesin aturan R1 sampai R9 yang murni dan deterministik.
- 12 skenario Pasar Tiruan dengan putusan yang diharapkan.
- 110 tes yang mencakup batas ambang, kombinasi aturan, normalisasi alamat, presisi MIST, alur API, dan CORS.
- Enam layar web lengkap dengan desain responsif dan dukungan kurangi gerak.
- API untuk health, skenario, evaluasi, keputusan, memori, revoke, dan restore.
- Indikator status API langsung di layar Status Penjaga.
- G2 Walrus Memory: 10 dari 10 penulisan berhasil dan 10 dari 10 recall relevan di peringkat pertama.
- Koneksi Tatum gRPC Mainnet untuk membaca checkpoint.

### Masih terbatas

- Evaluasi di web masih berjalan lokal, bukan lewat endpoint evaluasi API.
- API memakai memori mock secara bawaan.
- Revoke bersifat lokal dan belum mencabut delegate onchain.
- Penjelasan putusan memakai template, belum memakai LLM.
- Belum ada tanda tangan transaksi nyata.
- Web demo menyimpan state di `localStorage`, bukan di dompet pengguna.

### Belum selesai

- G1 simulasi penuh Tatum Mainnet tertahan karena dompet pemilik memiliki 0 SUI.
- Simulasi Tatum live di API masih mengembalikan `501`.
- Pencabutan delegate onchain membutuhkan dompet pemilik.
- G3 intersepsi dompet belum dimulai.
- `packages/scenes` dan `packages/video` masih placeholder.

## 10. Kegunaan proyek

### Bagi pengguna dompet

- Memberi batas pengeluaran yang sesuai kebiasaan pribadi.
- Menahan transaksi ke penerima baru yang nominalnya terlalu besar.
- Mengingat alamat yang pernah ditolak atau dipercaya.
- Menampilkan alasan sebelum tanda tangan, bukan setelah dana hilang.
- Menjaga kendali: Kawal tidak memegang kunci dan tidak menandatangani transaksi.

### Bagi pengembang dApp

- Menyediakan paket aturan yang dapat dipakai ulang.
- Menyediakan contoh pemisahan logika murni dari I/O.
- Menyediakan fixture sebagai regression suite.
- Menyediakan API mock/replay untuk pengujian tanpa jaringan.
- Menunjukkan pola integrasi memori tanpa membocorkan kunci.

### Bagi ekosistem Sui

- Menunjukkan bahwa memori pribadi dapat menjadi kebijakan yang dapat dieksekusi.
- Menjaga agar memori tetap dapat diaudit dan tidak menjadi kotak hitam.
- Memberi contoh pemeriksaan sebelum tanda tangan yang cocok untuk dompet atau dApp.
- Menunjukkan pemanfaatan Walrus Memory untuk data yang melekat pada keputusan pengguna.

### Bagi pembelajaran

- Contoh mesin aturan deterministik dengan urutan prioritas yang jelas.
- Contoh penanganan nominal uang dengan `bigint` MIST.
- Contoh batas ambang yang diuji secara eksplisit.
- Contoh API dengan validasi, rate limit, CORS, dan penanganan galat yang seragam.
- Contoh antarmuka yang menjaga warna, teks, dan ikon sebagai sinyal putusan, bukan warna saja.

## 11. Keamanan dan privasi

Prinsip yang dipakai:

1. **Rahasia hanya di server.** `TATUM_API_KEY`, `MEMWAL_KEY`, dan kredensial delegate hanya dibaca oleh API serta skrip eksperimen. Tidak ada di bundel web.
2. **Tidak ada kunci dompet di frontend.** Dompet demo tidak menyimpan kunci dan tidak menandatangani transaksi.
3. **Memori diperlakukan sebagai data tidak tepercaya.** Memori dari rantai divalidasi sebelum menjadi kebijakan.
4. **Putusan deterministik.** Penjelasan tidak boleh mengubah putusan. LLM tidak dipakai di jalur keputusan.
5. **Nominal memakai integer MIST.** Ini menghindari kesalahan pembulatan pecahan.
6. **Forgot bersifat lokal.** Penghapusan memori di server adalah tombstone. Blob Walrus tetap ada sampai ada pencabutan onchain oleh pemilik.
7. **Rate limit dan CORS.** Endpoint mutasi dibatasi, dan origin web diatur melalui konfigurasi server.

## 12. Batasan yang perlu dipahami

- Kawal saat ini adalah prototipe dan bahan demo, belum produk dompet produksi.
- Web demo tidak terhubung ke dompet Sui nyata dan tidak menandatangani transaksi.
- Putusan dibuat dari data simulasi atau data replay, bukan dari eksekusi Mainnet penuh.
- Memori yang ditulis ke Walrus pada G2 berasal dari eksperimen, bukan dari setiap transaksi pengguna.
- Pencabutan delegate belum onchain.
- Biaya tulis Walrus belum terlihat secara pasti di saldo pemilik.
- Hasil tes dan status integrasi dapat berubah setelah kredensial atau dana dompet diperbarui.

## 13. Rencana pengembangan berikutnya

1. Mengisi dompet dengan SUI atau menyediakan alamat testnet yang sudah didanai agar G1 penuh dapat dijalankan.
2. Menyambungkan evaluasi web ke endpoint API, lalu menjadikan evaluasi lokal sebagai fallback.
3. Mengaktifkan simulasi Tatum live setelah G1 lulus.
4. Mengimplementasikan pencabutan delegate onchain dengan dompet pemilik.
5. Menambahkan penjelasan LLM sebagai lapisan bahasa, tanpa mengubah putusan deterministik.
6. Memulai G3 intersepsi dompet.
7. Mengisi paket `scenes` dan `video` untuk kebutuhan demonstrasi.
8. Merotasi kredensial delegate setelah demo karena kunci pernah terekspos di percakapan.

## 14. Kesimpulan

Kawal adalah prototipe penjaga transaksi Sui yang menggabungkan tiga hal: aturan keamanan yang deterministik, memori pribadi yang dapat dipakai ulang, dan penjelasan yang dapat dibaca manusia. Fungsi utamanya adalah memeriksa transaksi sebelum ditandatangani, mengingat keputusan pengguna, dan mengubah ingatan itu menjadi kebijakan yang lebih ketat pada pemeriksaan berikutnya.

Nilai proyek ini bukan pada klaim bahwa semua risiko sudah hilang, tetapi pada pendekatan yang dapat diaudit: aturan jelas, batas yang diuji, memori yang dimiliki pengguna, dan kendali dompet yang tetap berada di tangan pengguna. Dengan integrasi API, Walrus Memory, dan Tatum yang bertahap, Kawal dapat berkembang dari demo menjadi lapisan pemeriksaan yang berguna bagi dompet dan dApp di ekosistem Sui.
