import { SuiGrpcClient } from '@mysten/sui/grpc';
import { GrpcTransport } from '@protobuf-ts/grpc-transport';
import { ChannelCredentials } from '@grpc/grpc-js';

const apiKey = process.env.TATUM_API_KEY;
const owner = process.env.MEMWAL_OWNER ?? process.env.MEMWAL_ACCOUNT_ID;
const accountsTableId =
  process.env.MEMWAL_ACCOUNTS_TABLE_ID ??
  '0xcfe04623a8c72ede45fc02babcb9711625df8549e53d3107d507efa696d5efde';

if (!apiKey || !owner) {
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

const target = owner.replace(/^0x/, '').toLowerCase().padStart(64, '0');
const matches = [];
const sample = [];
let pageToken;
let scanned = 0;
let pages = 0;

do {
  const { response } = await client.stateService.listDynamicFields({
    parent: accountsTableId,
    pageSize: 1000,
    ...(pageToken ? { pageToken } : {}),
    readMask: {
      paths: [
        'parent',
        'field_id',
        'name.bytes',
        'value.bytes',
        'value_type',
        'child_id',
      ],
    },
  });

  for (const field of response.dynamicFields) {
    scanned += 1;
    const nameHex = Buffer.from(field.name?.bytes ?? []).toString('hex');
    const entry = {
      fieldId: field.fieldId ?? null,
      nameHex,
      valueHex: Buffer.from(field.value?.bytes ?? []).toString('hex'),
      valueType: field.valueType ?? null,
      childId: field.childId ?? null,
    };
    if (sample.length < 3) sample.push(entry);
    if (nameHex.includes(target)) matches.push(entry);
  }

  pageToken = response.nextPageToken;
  pages += 1;
} while (pageToken && matches.length === 0 && pages < 20);

console.log(
  JSON.stringify(
    {
      network,
      accountsTableId,
      owner,
      scanned,
      pages,
      matches,
      sample,
    },
    null,
    2,
  ),
);

transport.close();
