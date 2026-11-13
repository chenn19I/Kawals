import { MemWal } from '@mysten-incubation/memwal';
import { SuiGrpcClient } from '@mysten/sui/grpc';
import { GrpcTransport } from '@protobuf-ts/grpc-transport';
import { ChannelCredentials } from '@grpc/grpc-js';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const accountId = process.env.MEMWAL_ACCOUNT_ID;
const key = process.env.MEMWAL_KEY?.trim();
const serverUrl = process.env.MEMWAL_SERVER_URL ?? 'https://relayer.memory.walrus.xyz';
const namespace = process.env.MEMWAL_NAMESPACE ?? 'default';
const owner = process.env.MEMWAL_OWNER;
const apiKey = process.env.TATUM_API_KEY;

if (!accountId || !key || !owner || !apiKey) {
  console.error('MEMWAL_ACCOUNT_ID, MEMWAL_KEY, MEMWAL_OWNER, dan TATUM_API_KEY harus diisi.');
  process.exit(1);
}

const addr = (pair) => `0x${pair.repeat(32)}`;
const DITOLAK = addr('b2');
const DIPERCAYA = addr('c3');
const PAKET_ASING = addr('e5');

const memories = [
  {
    id: 'alamat-ditolak',
    kind: 'alamat',
    text: `Saya menolak transfer ke alamat ${DITOLAK} karena alamat itu meminta 2 SUI lalu menghilang. Alamat ini masuk daftar tolak saya.`,
  },
  {
    id: 'alamat-dipercaya',
    kind: 'alamat',
    text: `Alamat ${DIPERCAYA} adalah penjual langganan yang sudah dua kali transaksi lancar. Saya mempercayainya untuk transfer hingga 5 SUI.`,
  },
  {
    id: 'batas-outflow',
    kind: 'aturan',
    text: 'Aturan pribadi saya: tahan setiap transaksi dengan total SUI keluar di atas 5 SUI, kecuali saya menyetujuinya secara eksplisit.',
  },
  {
    id: 'batas-penerima-baru',
    kind: 'aturan',
    text: 'Aturan pribadi saya: penerima yang belum pernah saya kirimi hanya boleh menerima maksimal 1 SUI.',
  },
  {
    id: 'objek-non-koin',
    kind: 'aturan',
    text: 'Saya tidak mengizinkan objek non-koin, seperti NFT, ikut berpindah tanpa persetujuan eksplisit.',
  },
  {
    id: 'paket-asing',
    kind: 'aturan',
    text: `Saya menahan transaksi yang memanggil paket Move yang belum ada di allowlist saya, misalnya paket ${PAKET_ASING}.`,
  },
  {
    id: 'keputusan-tolak',
    kind: 'keputusan',
    text: `Saya pernah menolak transfer 2 SUI ke alamat ${DITOLAK} karena alamat itu terhubung dengan penipuan.`,
  },
  {
    id: 'keputusan-lolos',
    kind: 'keputusan',
    text: `Saya pernah meloloskan transfer 2 SUI ke alamat ${DIPERCAYA} karena alamat itu penjual langganan tepercaya.`,
  },
  {
    id: 'preferensi-penjelasan',
    kind: 'preferensi',
    text: 'Saya ingin penjelasan putusan dalam bahasa Indonesia yang singkat: satu kalimat ringkasan dan maksimal tiga detail.',
  },
  {
    id: 'simulasi-gagal',
    kind: 'aturan',
    text: 'Jika simulasi transaksi gagal atau tidak menjawab dalam 5 detik, saya menolak transaksi itu.',
  },
];

const queries = [
  'Alamat mana yang saya tolak?',
  'Berapa batas transfer untuk penerima baru?',
  'Apa aturan saya tentang objek non-koin?',
];

const replacer = (_key, value) => (typeof value === 'bigint' ? value.toString() : value);
const runId = new Date().toISOString().replace(/[:.]/g, '-');
const resultsDir = join(process.cwd(), 'results');
mkdirSync(resultsDir, { recursive: true });
const outFile = join(resultsDir, `g2-${runId}.json`);

const output = {
  runId,
  startedAt: new Date().toISOString(),
  accountId,
  owner,
  namespace,
  serverUrl,
  health: null,
  balancesBefore: null,
  balancesAfter: null,
  memories: [],
  recalls: [],
  summary: null,
  finishedAt: null,
};

function save() {
  writeFileSync(outFile, JSON.stringify(output, replacer, 2));
}

const memwal = MemWal.create({ key, accountId, serverUrl, namespace });

const transport = new GrpcTransport({
  host: 'sui-mainnet-grpc.gateway.tatum.io:443',
  channelCredentials: ChannelCredentials.createSsl(),
  meta: { 'x-api-key': apiKey },
});
const sui = new SuiGrpcClient({ network: 'mainnet', transport });

async function listBalances() {
  const all = [];
  let pageToken;
  do {
    const { response } = await sui.stateService.listBalances({
      owner,
      pageSize: 50,
      ...(pageToken ? { pageToken } : {}),
    });
    all.push(...response.balances);
    pageToken = response.nextPageToken;
  } while (pageToken);

  return all.map((balance) => ({
    coinType: balance.coinType ?? null,
    balance: balance.balance?.toString() ?? '0',
    addressBalance: balance.addressBalance?.toString() ?? '0',
    coinBalance: balance.coinBalance?.toString() ?? '0',
  }));
}

async function recallWithRetry(query) {
  let last;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const started = performance.now();
    const result = await memwal.recall({ query, limit: 5 });
    last = {
      query,
      elapsedMs: Math.round(performance.now() - started),
      resultCount: result.results.length,
      results: result.results,
      attempts: attempt + 1,
    };
    if (result.results.length > 0) return last;
    await new Promise((resolve) => setTimeout(resolve, 3000));
  }
  return last;
}

try {
  output.health = await memwal.health();
  output.balancesBefore = await listBalances().catch((error) => ({
    error: error?.message ?? String(error),
  }));
  save();

  for (const [index, memory] of memories.entries()) {
    const record = {
      index: index + 1,
      id: memory.id,
      kind: memory.kind,
      text: memory.text,
      status: 'pending',
      elapsedMs: null,
      result: null,
      error: null,
    };
    output.memories.push(record);
    save();

    const started = performance.now();
    try {
      const result = await memwal.rememberAndWait(memory.text, undefined, {
        timeoutMs: 120_000,
        pollIntervalMs: 1000,
        idempotencyKey: `kawal-g2-2026-10-24-${String(index + 1).padStart(2, '0')}`,
      });
      record.status = 'ok';
      record.elapsedMs = Math.round(performance.now() - started);
      record.result = result;
      console.log(`[${index + 1}/10] ok ${memory.id} (${record.elapsedMs} ms) ${result.blob_id}`);
    } catch (error) {
      record.status = 'failed';
      record.elapsedMs = Math.round(performance.now() - started);
      record.error = {
        name: error?.name ?? 'Error',
        message: error?.message ?? String(error),
        code: error?.code ?? null,
      };
      save();
      console.error(`[${index + 1}/10] gagal ${memory.id}: ${record.error.message}`);
      break;
    }
    save();
    await new Promise((resolve) => setTimeout(resolve, 750));
  }

  output.balancesAfter = await listBalances().catch((error) => ({
    error: error?.message ?? String(error),
  }));

  if (output.memories.some((memory) => memory.status === 'ok')) {
    await new Promise((resolve) => setTimeout(resolve, 3000));
    for (const query of queries) {
      try {
        output.recalls.push(await recallWithRetry(query));
      } catch (error) {
        output.recalls.push({
          query,
          error: { name: error?.name ?? 'Error', message: error?.message ?? String(error) },
        });
      }
      save();
    }
  }

  const succeeded = output.memories.filter((memory) => memory.status === 'ok');
  const totalWriteMs = succeeded.reduce((sum, memory) => sum + (memory.elapsedMs ?? 0), 0);
  output.summary = {
    attempted: output.memories.length,
    succeeded: succeeded.length,
    failed: output.memories.length - succeeded.length,
    totalWriteMs,
    avgWriteMs: succeeded.length > 0 ? Math.round(totalWriteMs / succeeded.length) : null,
    recallQueries: output.recalls.length,
    recallHits: output.recalls.reduce((sum, recall) => sum + (recall.resultCount ?? 0), 0),
  };
  output.finishedAt = new Date().toISOString();
  save();

  console.log(
    JSON.stringify(
      {
        outFile,
        summary: output.summary,
        recalls: output.recalls.map((recall) => ({
          query: recall.query,
          resultCount: recall.resultCount ?? null,
          error: recall.error ?? null,
        })),
      },
      replacer,
      2,
    ),
  );
} catch (error) {
  output.finishedAt = new Date().toISOString();
  output.summary = {
    fatal: { name: error?.name ?? 'Error', message: error?.message ?? String(error) },
  };
  save();
  console.error(`G2 fatal: ${error?.name ?? 'Error'}: ${error?.message}`);
  process.exitCode = 1;
} finally {
  transport.close();
  memwal.destroy();
}
