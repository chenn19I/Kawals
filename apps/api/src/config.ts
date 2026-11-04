export type MemoryMode = 'mock' | 'walrus';
export type SuiNetwork = 'mainnet' | 'testnet';

export interface WalrusConfig {
  accountId: string;
  key: string;
  owner: string;
  serverUrl: string;
  namespace: string;
}

export interface TatumConfig {
  apiKey: string;
  network: SuiNetwork;
  endpoint: string;
  timeoutMs: number;
}

export interface ApiConfig {
  serviceName: string;
  version: string;
  nodeEnv: string;
  host: string;
  port: number;
  corsOrigin: string;
  memoryMode: MemoryMode;
  memoryWriteSync: boolean;
  walrus: WalrusConfig | null;
  tatum: TatumConfig | null;
  stateFile: string | null;
  rateLimitMax: number;
  rateLimitWindowMs: number;
  adminToken: string | null;
  liveSimulation: boolean;
}

function readInt(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function readBool(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) return fallback;
  return value === '1' || value.toLowerCase() === 'true';
}

function optional(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): ApiConfig {
  const memoryMode = env.KAWAL_MEMORY_MODE === 'walrus' ? 'walrus' : 'mock';
  const walrus =
    memoryMode === 'walrus'
      ? {
          accountId: env.MEMWAL_ACCOUNT_ID?.trim() ?? '',
          key: env.MEMWAL_KEY?.trim() ?? '',
          owner: env.MEMWAL_OWNER?.trim() ?? '',
          serverUrl: env.MEMWAL_SERVER_URL?.trim() || 'https://relayer.memory.walrus.xyz',
          namespace: env.MEMWAL_NAMESPACE?.trim() || 'default',
        }
      : null;

  if (walrus && (!walrus.accountId || !walrus.key)) {
    throw new Error(
      'KAWAL_MEMORY_MODE=walrus membutuhkan MEMWAL_ACCOUNT_ID dan MEMWAL_KEY (private key delegate).',
    );
  }

  const network: SuiNetwork = env.TATUM_SUI_NETWORK === 'testnet' ? 'testnet' : 'mainnet';
  const apiKey = optional(env.TATUM_API_KEY);
  const tatum = apiKey
    ? {
        apiKey,
        network,
        endpoint:
          env.TATUM_GRPC_URL?.trim() ||
          (network === 'testnet'
            ? 'sui-testnet-grpc.gateway.tatum.io:443'
            : 'sui-mainnet-grpc.gateway.tatum.io:443'),
        timeoutMs: readInt(env.TATUM_TIMEOUT_MS, 7000),
      }
    : null;

  return {
    serviceName: 'kawal-api',
    version: '0.2.0',
    nodeEnv: env.NODE_ENV ?? 'development',
    host: env.HOST?.trim() || '127.0.0.1',
    port: readInt(env.PORT, 8787),
    corsOrigin:
      env.KAWAL_CORS_ORIGIN?.trim() ||
      'http://localhost:5173,http://127.0.0.1:5173',
    memoryMode,
    memoryWriteSync: readBool(env.KAWAL_MEMORY_WRITE_SYNC, false),
    walrus,
    tatum,
    stateFile: env.KAWAL_STATE_FILE?.trim() || null,
    rateLimitMax: readInt(env.KAWAL_RATE_LIMIT_MAX, 60),
    rateLimitWindowMs: readInt(env.KAWAL_RATE_LIMIT_WINDOW_MS, 60_000),
    adminToken: optional(env.KAWAL_ADMIN_TOKEN),
    liveSimulation: readBool(env.KAWAL_LIVE_SIMULATION, false),
  };
}
