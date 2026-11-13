import { SuiGrpcClient } from '@mysten/sui/grpc';
import { GrpcTransport } from '@protobuf-ts/grpc-transport';
import { ChannelCredentials } from '@grpc/grpc-js';
import { deriveDynamicFieldID } from '@mysten/sui/utils';
import { bcs } from '@mysten/sui/bcs';

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

const keyBytes = bcs.Address.serialize(owner).toBytes();
const candidates = [
  { keyType: 'address', fieldId: deriveDynamicFieldID(accountsTableId, 'address', keyBytes) },
  {
    keyType: '0x2::object::ID',
    fieldId: deriveDynamicFieldID(accountsTableId, '0x2::object::ID', keyBytes),
  },
];

for (const candidate of candidates) {
  try {
    const { response } = await client.ledgerService.getObject({
      objectId: candidate.fieldId,
      readMask: { paths: ['object_id', 'object_type', 'json', 'contents'] },
    });

    console.log(
      JSON.stringify(
        {
          network,
          accountsTableId,
          owner,
          ...candidate,
          found: Boolean(response.object),
          objectType: response.object?.objectType ?? null,
          json: response.object?.json ?? null,
        },
        (_key, value) => (typeof value === 'bigint' ? value.toString() : value),
        2,
      ),
    );
  } catch (error) {
    console.error(`${candidate.keyType}: ${error?.code ?? error?.name}: ${error?.message}`);
  }
}

transport.close();
