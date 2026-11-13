import { SuiGrpcClient } from '@mysten/sui/grpc';
import { GrpcTransport } from '@protobuf-ts/grpc-transport';
import { ChannelCredentials } from '@grpc/grpc-js';

const apiKey = process.env.TATUM_API_KEY;
if (!apiKey) {
  console.error('TATUM_API_KEY belum diisi di .env.local');
  process.exit(1);
}

const host = 'sui-mainnet-grpc.gateway.tatum.io:443';

const transport = new GrpcTransport({
  host,
  channelCredentials: ChannelCredentials.createSsl(),
  meta: { 'x-api-key': apiKey },
});

const client = new SuiGrpcClient({ network: 'mainnet', transport });

const started = performance.now();
try {
  const { response } = await client.ledgerService.getCheckpoint({
    checkpointId: { oneofKind: undefined },
    readMask: { paths: ['sequence_number', 'digest'] },
  });
  const elapsedMs = Math.round(performance.now() - started);

  console.log(
    JSON.stringify(
      {
        ok: true,
        endpoint: host,
        elapsedMs,
        sequenceNumber: response.checkpoint?.sequenceNumber?.toString() ?? null,
        digest: response.checkpoint?.digest ?? null,
      },
      null,
      2,
    ),
  );
} catch (error) {
  const code = error?.code ?? error?.name ?? 'unknown';
  const message = error?.message ?? String(error);
  console.error(`Tatum gRPC gagal: ${code}: ${message}`);
  process.exit(1);
} finally {
  transport.close();
}
