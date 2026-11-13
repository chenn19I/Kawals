import { MemWal } from '@mysten-incubation/memwal';

const accountId = process.env.MEMWAL_ACCOUNT_ID;
if (!accountId) {
  console.error('MEMWAL_ACCOUNT_ID harus diisi di .env.local');
  process.exit(1);
}

const key = process.env.MEMWAL_KEY?.trim();
if (!key) {
  console.log(
    [
      'MEMWAL_KEY kosong.',
      'Health relayer sudah terverifikasi pada pemeriksaan sebelumnya.',
      'Recall belum bisa dijalankan karena relayer membutuhkan delegate PRIVATE key Ed25519 (64 hex).',
      'Isi MEMWAL_KEY dengan private key delegate, bukan public key.',
    ].join('\n'),
  );
  process.exit(0);
}

const serverUrl = process.env.MEMWAL_SERVER_URL ?? 'https://relayer.memory.walrus.xyz';
const namespace = process.env.MEMWAL_NAMESPACE ?? 'default';

const memwal = MemWal.create({ key, accountId, serverUrl, namespace });

const started = performance.now();
const health = await memwal.health();
const healthMs = Math.round(performance.now() - started);
console.log(JSON.stringify({ ok: true, serverUrl, namespace, healthMs, health }, null, 2));

const recallStarted = performance.now();
const recall = await memwal.recall({
  query: 'Apa aturan transaksi yang pernah kubuat?',
  limit: 5,
});
const recallMs = Math.round(performance.now() - recallStarted);

console.log(
  JSON.stringify(
    {
      ok: true,
      recallMs,
      resultCount: recall?.results?.length ?? 0,
      results: recall?.results ?? [],
    },
    null,
    2,
  ),
);
