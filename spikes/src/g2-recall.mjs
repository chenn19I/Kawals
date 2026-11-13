import { MemWal } from '@mysten-incubation/memwal';
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const accountId = process.env.MEMWAL_ACCOUNT_ID;
const key = process.env.MEMWAL_KEY?.trim();
const serverUrl = process.env.MEMWAL_SERVER_URL ?? 'https://relayer.memory.walrus.xyz';
const namespace = process.env.MEMWAL_NAMESPACE ?? 'default';

if (!accountId || !key) {
  console.error('MEMWAL_ACCOUNT_ID dan MEMWAL_KEY harus diisi.');
  process.exit(1);
}

const resultsDir = join(process.cwd(), 'results');
mkdirSync(resultsDir, { recursive: true });

const writeFiles = readdirSync(resultsDir)
  .filter((file) => file.startsWith('g2-') && !file.startsWith('g2-recall-') && file.endsWith('.json'))
  .sort();
const latestWriteFile = writeFiles.at(-1);
if (!latestWriteFile) {
  console.error('Tidak ada hasil G2 write di spikes/results.');
  process.exit(1);
}

const writeRun = JSON.parse(readFileSync(join(resultsDir, latestWriteFile), 'utf8'));
const blobByMemoryId = new Map(
  writeRun.memories
    .filter((memory) => memory.status === 'ok')
    .map((memory) => [memory.id, memory.result?.blob_id ?? null]),
);

const queries = [
  {
    query: 'Alamat mana yang saya masukkan daftar tolak?',
    expectedId: 'alamat-ditolak',
    keywords: ['menolak', 'daftar tolak'],
  },
  {
    query: 'Siapa penjual langganan yang saya percaya?',
    expectedId: 'alamat-dipercaya',
    keywords: ['penjual langganan', 'mempercayai'],
  },
  {
    query: 'Berapa total SUI keluar yang boleh sebelum ditahan?',
    expectedId: 'batas-outflow',
    keywords: ['5 SUI', 'total SUI keluar'],
  },
  {
    query: 'Berapa batas transfer ke penerima baru?',
    expectedId: 'batas-penerima-baru',
    keywords: ['1 SUI', 'penerima yang belum pernah'],
  },
  {
    query: 'Apakah NFT boleh ikut berpindah?',
    expectedId: 'objek-non-koin',
    keywords: ['non-koin', 'NFT'],
  },
  {
    query: 'Apa yang saya lakukan dengan paket Move asing?',
    expectedId: 'paket-asing',
    keywords: ['paket Move', 'allowlist'],
  },
  {
    query: 'Kapan saya menolak transfer 2 SUI?',
    expectedId: 'keputusan-tolak',
    keywords: ['menolak transfer', '2 SUI', 'penipuan'],
  },
  {
    query: 'Kapan saya meloloskan transfer 2 SUI?',
    expectedId: 'keputusan-lolos',
    keywords: ['meloloskan transfer 2 SUI', 'penjual langganan'],
  },
  {
    query: 'Bagaimana format penjelasan yang saya inginkan?',
    expectedId: 'preferensi-penjelasan',
    keywords: ['bahasa Indonesia', 'satu kalimat'],
  },
  {
    query: 'Apa yang terjadi jika simulasi gagal atau timeout?',
    expectedId: 'simulasi-gagal',
    keywords: ['simulasi', '5 detik'],
  },
];

const memwal = MemWal.create({ key, accountId, serverUrl, namespace });
const replacer = (_key, value) => (typeof value === 'bigint' ? value.toString() : value);
const runId = new Date().toISOString().replace(/[:.]/g, '-');
const outFile = join(resultsDir, `g2-recall-${runId}.json`);

const output = {
  runId,
  startedAt: new Date().toISOString(),
  sourceWriteFile: latestWriteFile,
  accountId,
  namespace,
  queries: [],
  summary: null,
};

try {
  for (const [index, item] of queries.entries()) {
    const expectedBlob = blobByMemoryId.get(item.expectedId) ?? null;
    const started = performance.now();
    const result = await memwal.recall({ query: item.query, limit: 5 });
    const elapsedMs = Math.round(performance.now() - started);
    const top = result.results[0];
    const topText = top?.text?.toLowerCase() ?? '';
    const textMatch = item.keywords.some((keyword) => topText.includes(keyword.toLowerCase()));

    output.queries.push({
      index: index + 1,
      query: item.query,
      expectedId: item.expectedId,
      expectedBlob,
      elapsedMs,
      resultCount: result.results.length,
      top1: top
        ? {
            blob_id: top.blob_id,
            distance: top.distance,
            text: top.text,
          }
        : null,
      top1BlobMatch: Boolean(top && expectedBlob && top.blob_id === expectedBlob),
      top1TextMatch: textMatch,
    });

    console.log(
      `[${index + 1}/10] ${item.expectedId}: top1 ${
        top?.blob_id === expectedBlob ? 'blob-match' : textMatch ? 'teks-match' : 'MISS'
      } (${elapsedMs} ms, distance ${top?.distance?.toFixed(3) ?? '-'})`,
    );
  }

  const latencies = output.queries.map((query) => query.elapsedMs).sort((a, b) => a - b);
  const p95Index = Math.max(0, Math.ceil(latencies.length * 0.95) - 1);
  output.summary = {
    queries: output.queries.length,
    top1BlobMatches: output.queries.filter((query) => query.top1BlobMatch).length,
    top1TextMatches: output.queries.filter((query) => query.top1TextMatch).length,
    top1Relevant: output.queries.filter((query) => query.top1BlobMatch || query.top1TextMatch).length,
    avgLatencyMs: Math.round(latencies.reduce((sum, value) => sum + value, 0) / latencies.length),
    p95LatencyMs: latencies[p95Index],
    minLatencyMs: latencies[0],
    maxLatencyMs: latencies.at(-1),
  };
  output.finishedAt = new Date().toISOString();
  writeFileSync(outFile, JSON.stringify(output, replacer, 2));

  console.log(JSON.stringify({ outFile, summary: output.summary }, null, 2));
} catch (error) {
  output.summary = { fatal: { name: error?.name ?? 'Error', message: error?.message ?? String(error) } };
  output.finishedAt = new Date().toISOString();
  writeFileSync(outFile, JSON.stringify(output, replacer, 2));
  console.error(`G2 recall fatal: ${error?.name ?? 'Error'}: ${error?.message}`);
  process.exitCode = 1;
} finally {
  memwal.destroy();
}
