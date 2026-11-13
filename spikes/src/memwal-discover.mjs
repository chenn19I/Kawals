import { SuiGrpcClient } from '@mysten/sui/grpc';
import { GrpcTransport } from '@protobuf-ts/grpc-transport';
import { ChannelCredentials } from '@grpc/grpc-js';

const apiKey = process.env.TATUM_API_KEY;
const address = process.env.MEMWAL_OWNER ?? process.env.MEMWAL_ACCOUNT_ID;

if (!apiKey || !address) {
  console.error('TATUM_API_KEY dan MEMWAL_ACCOUNT_ID harus diisi.');
  process.exit(1);
}

const network = process.env.SUI_NETWORK === 'testnet' ? 'testnet' : 'mainnet';
const transport = new GrpcTransport({
  host:
    network === 'testnet'
      ? 'sui-testnet-grpc.gateway.tatum.io:443'
      : 'sui-mainnet-grpc.gateway.tatum.io:443',
  channelCredentials: ChannelCredentials.createSsl(),
  meta: { 'x-api-key': apiKey },
});
const client = new SuiGrpcClient({ network, transport });

const objects = [];
let pageToken;
do {
  const { response } = await client.stateService.listOwnedObjects({
    owner: address,
    pageSize: 50,
    ...(pageToken ? { pageToken } : {}),
    readMask: { paths: ['object_id', 'object_type'] },
  });
  objects.push(...response.objects);
  pageToken = response.nextPageToken;
} while (pageToken && objects.length < 500);

const summary = objects.map((object) => ({
  objectId: object.objectId,
  objectType: object.objectType,
}));
const memwal = summary.filter((object) => /memwal/i.test(object.objectType ?? ''));

console.log(
  JSON.stringify(
    {
      network,
      address,
      totalOwned: summary.length,
      memwalCandidates: memwal,
      allTypes: [...new Set(summary.map((object) => object.objectType))],
    },
    null,
    2,
  ),
);

transport.close();
