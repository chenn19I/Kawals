import { getRequestListener } from '@hono/node-server';
import { createApp } from '../apps/api/src/app';
import { loadConfig } from '../apps/api/src/config';
import { createMemoryRepository, seedMemories } from '../apps/api/src/memory';

const config = loadConfig({
  ...process.env,
  KAWAL_MEMORY_MODE: process.env.KAWAL_MEMORY_MODE || 'mock',
});
const memories = createMemoryRepository(config, seedMemories());
const app = createApp({ config, memories });

export default getRequestListener(app.fetch);
