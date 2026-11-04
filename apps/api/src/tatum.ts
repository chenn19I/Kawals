import { ChannelCredentials } from '@grpc/grpc-js';
import { GrpcTransport } from '@protobuf-ts/grpc-transport';
import { SuiGrpcClient } from '@mysten/sui/grpc';
import type { TatumConfig } from './config';

export interface NetworkSnapshot {
  configured: boolean;
  network: 'mainnet' | 'testnet';
  endpoint: string | null;
  checkpoint: string | null;
  checkpointDigest: string | null;
  chainIdentifier: string | null;
  referenceGasPriceMist: string | null;
  balanceMist: string | null;
  balanceOwner: string | null;
  latencyMs: number;
  fetchedAt: string;
  cached: boolean;
  errors: string[];
}

export interface NetworkProvider {
  readonly configured: boolean;
  readonly network: 'mainnet' | 'testnet';
  snapshot(owner?: string): Promise<NetworkSnapshot>;
  close(): void;
}

interface BaseSnapshot {
  checkpoint: string | null;
  checkpointDigest: string | null;
  chainIdentifier: string | null;
  referenceGasPriceMist: string | null;
  errors: string[];
  fetchedAt: number;
}

const CACHE_MS = 15_000;

function withTimeout<T>(task: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('TIMEOUT')), timeoutMs);
    task.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

function errorCode(error: unknown): string {
  if (error instanceof Error && error.message === 'TIMEOUT') return 'TIMEOUT';
  const code =
    typeof error === 'object' && error !== null && 'code' in error
      ? String((error as { code?: unknown }).code)
      : '';
  if (code.includes('UNAVAILABLE') || code === '14') return 'UNAVAILABLE';
  if (code.includes('RESOURCE_EXHAUSTED') || code === '8') return 'RATE_LIMITED';
  if (code.includes('UNAUTHENTICATED') || code === '16') return 'UNAUTHORIZED';
  return 'NETWORK_ERROR';
}

export class TatumNetworkProvider implements NetworkProvider {
  readonly configured = true;
  readonly network: 'mainnet' | 'testnet';
  private readonly config: TatumConfig;
  private readonly client: SuiGrpcClient;
  private readonly transport: GrpcTransport;
  private base: BaseSnapshot | null = null;
  private baseRequest: Promise<BaseSnapshot> | null = null;

  constructor(config: TatumConfig) {
    this.config = config;
    this.network = config.network;
    this.transport = new GrpcTransport({
      host: config.endpoint,
      channelCredentials: ChannelCredentials.createSsl(),
      meta: { 'x-api-key': config.apiKey },
    });
    this.client = new SuiGrpcClient({
      network: config.network,
      transport: this.transport,
    });
  }

  async snapshot(owner?: string): Promise<NetworkSnapshot> {
    const started = performance.now();
    const base = await this.readBase();
    const errors = [...base.errors];

    let balanceMist: string | null = null;
    if (owner) {
      try {
        const result = await withTimeout(
          this.client.getBalance({ owner }),
          this.config.timeoutMs,
        );
        const value = result.balance?.balance;
        if (typeof value === 'string' && /^\d+$/.test(value)) balanceMist = value;
      } catch (error) {
        errors.push(`BALANCE_${errorCode(error)}`);
      }
    }

    return {
      configured: true,
      network: this.network,
      endpoint: this.config.endpoint,
      checkpoint: base.checkpoint,
      checkpointDigest: base.checkpointDigest,
      chainIdentifier: base.chainIdentifier,
      referenceGasPriceMist: base.referenceGasPriceMist,
      balanceMist,
      balanceOwner: owner ?? null,
      latencyMs: Math.round(performance.now() - started),
      fetchedAt: new Date().toISOString(),
      cached: Date.now() - base.fetchedAt < CACHE_MS,
      errors,
    };
  }

  private async readBase(): Promise<BaseSnapshot> {
    if (this.base && Date.now() - this.base.fetchedAt < CACHE_MS) {
      return this.base;
    }
    if (this.baseRequest) return this.baseRequest;

    this.baseRequest = this.fetchBase().finally(() => {
      this.baseRequest = null;
    });
    return this.baseRequest;
  }

  private async fetchBase(): Promise<BaseSnapshot> {
    const errors: string[] = [];
    const checkpointCall = this.client.ledgerService.getCheckpoint({
      checkpointId: { oneofKind: undefined },
      readMask: { paths: ['sequence_number', 'digest'] },
    });
    const [checkpoint, chain, gas] = await Promise.allSettled([
      withTimeout(checkpointCall.response, this.config.timeoutMs),
      withTimeout(this.client.getChainIdentifier(), this.config.timeoutMs),
      withTimeout(this.client.getReferenceGasPrice(), this.config.timeoutMs),
    ]);

    let checkpointSequence: string | null = null;
    let checkpointDigest: string | null = null;
    if (checkpoint.status === 'fulfilled') {
      checkpointSequence = checkpoint.value.checkpoint?.sequenceNumber?.toString() ?? null;
      checkpointDigest = checkpoint.value.checkpoint?.digest ?? null;
    } else {
      errors.push(`CHECKPOINT_${errorCode(checkpoint.reason)}`);
    }

    let chainIdentifier: string | null = null;
    if (chain.status === 'fulfilled') {
      chainIdentifier = chain.value.chainIdentifier ?? null;
    } else {
      errors.push(`CHAIN_${errorCode(chain.reason)}`);
    }

    let referenceGasPriceMist: string | null = null;
    if (gas.status === 'fulfilled') {
      const value = gas.value.referenceGasPrice;
      if (typeof value === 'string' && /^\d+$/.test(value)) referenceGasPriceMist = value;
    } else {
      errors.push(`GAS_${errorCode(gas.reason)}`);
    }

    const fresh: BaseSnapshot = {
      checkpoint: checkpointSequence,
      checkpointDigest,
      chainIdentifier,
      referenceGasPriceMist,
      errors,
      fetchedAt: Date.now(),
    };

    const useful = checkpointSequence !== null || chainIdentifier !== null;
    if (useful) {
      this.base = fresh;
      return fresh;
    }

    if (this.base) {
      return { ...this.base, errors: [...this.base.errors, ...errors] };
    }
    return fresh;
  }

  close(): void {
    this.transport.close();
  }
}

export class UnconfiguredNetworkProvider implements NetworkProvider {
  readonly configured = false;
  readonly network: 'mainnet' | 'testnet';

  constructor(network: 'mainnet' | 'testnet' = 'mainnet') {
    this.network = network;
  }

  async snapshot(owner?: string): Promise<NetworkSnapshot> {
    return {
      configured: false,
      network: this.network,
      endpoint: null,
      checkpoint: null,
      checkpointDigest: null,
      chainIdentifier: null,
      referenceGasPriceMist: null,
      balanceMist: null,
      balanceOwner: owner ?? null,
      latencyMs: 0,
      fetchedAt: new Date().toISOString(),
      cached: false,
      errors: ['NOT_CONFIGURED'],
    };
  }

  close(): void {
    // Tidak ada koneksi.
  }
}

export function createNetworkProvider(config: TatumConfig | null): NetworkProvider {
  return config ? new TatumNetworkProvider(config) : new UnconfiguredNetworkProvider();
}
