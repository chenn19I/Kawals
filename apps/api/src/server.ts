import { serve } from '@hono/node-server';
import { createApp } from './app';
import { loadConfig } from './config';
import { createMemoryRepository, seedMemories } from './memory';

const config = loadConfig();
const memories = createMemoryRepository(config, seedMemories());
const app = createApp({ config, memories });

const server = serve(
  {
    fetch: app.fetch,
    hostname: config.host,
    port: config.port,
  },
  (info) => {
    console.log(
      `[kawal-api] ${config.serviceName} ${config.version} di http://${info.address}:${info.port}`,
    );
    console.log(
      `[kawal-api] memori: ${config.memoryMode}` +
        (config.walrus ? ` (namespace ${config.walrus.namespace})` : ''),
    );
    console.log(
      `[kawal-api] tulis memori: ${config.memoryWriteSync ? 'tunggu selesai' : 'antrean latar'}`,
    );
    console.log('[kawal-api] kunci hanya dibaca di server dan tidak pernah dikirim ke klien.');
  },
);

let shuttingDown = false;

function shutdown(signal: string): void {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`[kawal-api] ${signal} diterima, menutup server.`);
  const force = setTimeout(() => {
    console.error('[kawal-api] penutupan melewati 8 detik, keluar paksa.');
    process.exit(1);
  }, 8_000);
  force.unref();

  server.close(() => {
    memories.close();
    clearTimeout(force);
    console.log('[kawal-api] server tertutup.');
    process.exit(0);
  });
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
