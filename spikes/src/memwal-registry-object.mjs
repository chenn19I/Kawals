import { SuiGrpcClient } from '@mysten/sui/grpc';
import { GrpcTransport } from '@protobuf-ts/grpc-transport';
import { ChannelCredentials } from '@grpc/grpc-js';

const apiKey = process.env.TATUM_API_KEY;
const network = process.env.SUI_NETWORK === 'testnet' ? 'testnet' : 'mainnet';
const registryId =
  process.env.MEMWAL_REGISTRY_ID ??
  (network === 'testnet'
    ? '0x736aef9906798fca4460490ccdf8e8502ef170122dc26ecae32111b78c6b42dd'
    : '0x8bf82c9e09e36b8d1c38298f68b7cb68e7b8762887e7592add9986d5e9cf199f');

if (!apiKey) {
  console.error('TATUM_API_KEY harus diisi.');
  process.exit(1);
}

const transport = new GrpcTransport({
  host:
    network === 'testnet'
      ? 'sui-testnet-grpc.gateway.tatum.io:443'
      : 'sui-mainnet-grpc.gateway.tatum.io:443',
  channelCredentials: ChannelCredentials.createSsl(),
  meta: { 'x-api-key': apiKey },
});
const client = new SuiGrpcClient({ network, transport });

const { response } = await client.ledgerService.getObject({
  objectId: registryId,
  readMask: { paths: ['object_id', 'object_type', 'json', 'owner'] },
});

const fields = response.object?.json?.structValue?.fields ?? {};
const accounts = fields.accounts?.structValue?.fields ?? {};

console.log(
  JSON.stringify(
    {
      network,
      registryId,
      objectType: response.object?.objectType ?? null,
      accountsTableId: accounts.id?.stringValue ?? null,
      accountCount: accounts.size?.stringValue ?? null,
      json: response.object?.json ?? null,
    },
    (_key, value) => (typeof value === 'bigint' ? value.toString() : value),
    2,
  ),
);

transport.close();
