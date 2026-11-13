import { SuiGrpcClient } from '@mysten/sui/grpc';
import { GrpcTransport } from '@protobuf-ts/grpc-transport';
import { ChannelCredentials } from '@grpc/grpc-js';

const apiKey = process.env.TATUM_API_KEY;
const owner = process.env.MEMWAL_OWNER ?? process.env.MEMWAL_ACCOUNT_ID;

if (!apiKey || !owner) {
  console.error('TATUM_API_KEY dan MEMWAL_OWNER harus diisi.');
  process.exit(1);
}

const transport = new GrpcTransport({
  host: 'sui-mainnet-grpc.gateway.tatum.io:443',
  channelCredentials: ChannelCredentials.createSsl(),
  meta: { 'x-api-key': apiKey },
});
const client = new SuiGrpcClient({ network: 'mainnet', transport });

try {
  const { response } = await client.stateService.getBalance({
    owner,
    coinType: '0x2::sui::SUI',
  });

  const balance = response.balance;
  console.log(
    JSON.stringify(
      {
        owner,
        coinType: balance?.coinType ?? null,
        balanceMist: balance?.balance?.toString() ?? null,
        balanceSui:
          balance?.balance !== undefined
            ? (Number(balance.balance) / 1_000_000_000).toString()
            : null,
        raw: balance ?? null,
      },
      (_key, value) => (typeof value === 'bigint' ? value.toString() : value),
      2,
    ),
  );
} catch (error) {
  console.error(`Gagal membaca saldo: ${error?.code ?? error?.name}: ${error?.message}`);
  process.exit(1);
} finally {
  transport.close();
}
