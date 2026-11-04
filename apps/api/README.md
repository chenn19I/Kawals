# apps/api

Server tipis untuk Kawal. Ia menjalankan recall memori, menyusun kebijakan dari ingatan, memanggil mesin aturan deterministik, menulis keputusan kembali ke memori, dan mencatat status penjaga.

Status 24 Oktober 2026: **mock dan replay siap dipakai**. Simulasi Tatum live belum aktif karena G1 penuh belum lulus.

## Menjalankan

Dari akar repo:

```sh
pnpm dev:api   # watch mode
pnpm --filter @kawal/api start
```

Bawaan: `http://127.0.0.1:8787`, memori mock, dan tulis memori di antrean latar. Kunci dibaca dari `.env.local` dan tidak pernah masuk ke bundel web.

## Endpoint

| Metode | Jalur | Isi |
| --- | --- | --- |
| GET | `/health` | status layanan, mode memori, status penjaga, uptime |
| GET | `/scenarios` | 12 skenario Pasar Tiruan tanpa kunci rahasia |
| POST | `/evaluate` | evaluasi `mock` atau `replay`; `live` mengembalikan 501 |
| GET | `/evaluations/:id` | ambil satu slip pemeriksaan |
| POST | `/decisions` | simpan keputusan dan tulis memori baru |
| GET | `/memories` | daftar memori, bisa difilter `query` dan `limit` |
| DELETE | `/memories/:id` | tombstone lokal untuk satu memori |
| POST | `/revoke` | hentikan pemeriksaan baru |
| POST | `/restore` | aktifkan penjaga kembali untuk sesi ini |

Semua galat memakai bentuk yang sama:

```json
{ "error": { "code": "GUARD_REVOKED", "message": "Penjaga dicabut. Aktifkan kembali sebelum memeriksa transaksi baru." } }
```

## Evaluasi

```http
POST /evaluate
Content-Type: application/json

{ "mode": "mock", "scenarioId": "transfer-12-sui-alamat-baru" }
```

Alur di dalam server:

1. Ambil skenario atau masukan replay.
2. Recall memori untuk alamat penerima dan aturan batas.
3. Ubah memori terstruktur menjadi kebijakan dengan `policyFromMemories()`. Bila ada ambang yang bertentangan, nilai paling ketat menang.
4. Jalankan `evaluate()` dari `@kawal/rules`. Penjelasan memakai template deterministik, bukan LLM.
5. Simpan slip dan kembalikan `201` dengan `{ "evaluation": ... }`.

Mode replay menerima data yang sudah dinormalkan:

```json
{
  "mode": "replay",
  "transfer": { "recipient": "0x...", "amountMist": "2000000000" },
  "simulation": {
    "status": "success",
    "totalOutflowMist": "2000000000",
    "calledPackages": ["0x2"],
    "leavingObjects": []
  },
  "history": { "hasSentToRecipientBefore": true },
  "risk": { "dangerous": false, "source": "daftar internal" },
  "knownPackages": []
}
```

`amountMist` dan `totalOutflowMist` wajib berupa bilangan bulat dalam MIST. Alamat pendek seperti `0x2` dinormalkan, tetapi harus heksadesimal yang sah.

## Keputusan dan memori

`POST /decisions` membutuhkan `evaluationId` yang masih tersimpan. Keputusan selalu membuat satu memori `keputusan`. Bila `addressStance` diisi `trust` atau `deny`, server juga membuat memori `alamat` yang langsung memengaruhi pemeriksaan berikutnya.

```json
{
  "evaluationId": "eval-...",
  "decision": "TOLAK",
  "note": "Nominal terlalu besar untuk penjual baru.",
  "addressStance": "deny"
}
```

Status tulis ada di `decision.memory.status`:

- `queued`: sudah disimpan, penulisan berjalan di latar.
- `written`: blob sudah diterima, `blobId` tersedia.
- `failed`: penulisan gagal, alasannya ada di `error`. Keputusan tetap tersimpan.

`KAWAL_MEMORY_WRITE_SYNC=1` membuat permintaan menunggu penulisan selesai. Berguna untuk tes dan demo yang butuh bukti blob sebelum respons.

`DELETE /memories/:id` hanya menandai memori sebagai lupa di server (tombstone). Blob Walrus tetap ada; pencabutan onchain membutuhkan dompet pemilik dan belum diimplementasikan.

## Konfigurasi

| Variabel | Bawaan | Arti |
| --- | --- | --- |
| `HOST` | `127.0.0.1` | alamat bind |
| `PORT` | `8787` | port HTTP |
| `KAWAL_CORS_ORIGIN` | `http://localhost:5173,http://127.0.0.1:5173` | origin web yang diizinkan, pisahkan dengan koma |
| `KAWAL_MEMORY_MODE` | `mock` | `mock` atau `walrus` |
| `KAWAL_MEMORY_WRITE_SYNC` | `0` | `1` untuk menunggu penulisan |
| `KAWAL_STATE_FILE` | kosong | path JSON untuk menyimpan state |
| `KAWAL_RATE_LIMIT_MAX` | `60` | batas permintaan mutasi per jendela |
| `KAWAL_RATE_LIMIT_WINDOW_MS` | `60000` | panjang jendela rate limit |
| `KAWAL_ADMIN_TOKEN` | kosong | bila diisi, `/revoke` dan `/restore` butuh bearer token |
| `KAWAL_LIVE_SIMULATION` | `0` | hanya dilaporkan di `/health`; live tetap 501 |

Mode `walrus` juga membaca `MEMWAL_ACCOUNT_ID`, `MEMWAL_KEY` (private key delegate), `MEMWAL_OWNER`, `MEMWAL_SERVER_URL`, dan `MEMWAL_NAMESPACE`. Tanpa account id dan private key, server menolak start.

## Batas yang disengaja

- Tatum live belum tersambung. G1 penuh tertahan karena dompet pemilik memiliki 0 SUI.
- Revoke bersifat lokal. Delegate onchain belum dicabut.
- Penjelasan memakai template. LLM tidak boleh mengubah putusan.
- Memori dari rantai diperlakukan sebagai data tidak tepercaya dan divalidasi sebelum menjadi kebijakan.
- Memori mock disemai hanya pada mode `mock`; mode `walrus` membaca katalog dari relayer.

## Tes

Tes API memakai `app.request()` tanpa jaringan:

```sh
pnpm test
```

Cakupan: health tanpa kebocoran rahasia, evaluasi mock dan replay, penolakan live, keputusan menjadi memori, perubahan kebijakan setelah stance alamat, tombstone memori, revoke/restore, token admin, validasi masukan, dan rate limit.
