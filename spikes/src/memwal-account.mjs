import { SuiGrpcClient } from '@mysten/sui/grpc';
import { GrpcTransport } from '@protobuf-ts/grpc-transport';
import { ChannelCredentials } from '@grpc/grpc-js';
import { createPrivateKey, createPublicKey } from 'node:crypto';

const apiKey = process.env.TATUM_API_KEY;
const accountId = process.env.MEMWAL_ACCOUNT_ID;
const delegateKey = process.env.MEMWAL_KEY?.trim();

if (!apiKey || !accountId) {
  console.error('TATUM_API_KEY dan MEMWAL_ACCOUNT_ID harus diisi.');
  process.exit(1);
}

const transport = new GrpcTransport({
  host:
    process.env.SUI_NETWORK === 'testnet'
      ? 'sui-testnet-grpc.gateway.tatum.io:443'
      : 'sui-mainnet-grpc.gateway.tatum.io:443',
  channelCredentials: ChannelCredentials.createSsl(),
  meta: { 'x-api-key': apiKey },
});
const client = new SuiGrpcClient({
  network: process.env.SUI_NETWORK === 'testnet' ? 'testnet' : 'mainnet',
  transport,
});

function ed25519PublicKeyHex(secretHex) {
  const seed = Buffer.from(secretHex, 'hex');
  if (seed.length !== 32) {
    throw new Error(`Panjang delegate key ${seed.length} byte, seharusnya 32.`);
  }
  const pkcs8 = Buffer.concat([
    Buffer.from('302e020100300506032b657004220420', 'hex'),
    seed,
  ]);
  const privateKey = createPrivateKey({ key: pkcs8, format: 'der', type: 'pkcs8' });
  const spki = createPublicKey(privateKey).export({ format: 'der', type: 'spki' });
  return spki.subarray(spki.length - 32).toString('hex');
}

try {
  const { response } = await client.ledgerService.getObject({
    objectId: accountId,
    readMask: { paths: ['object_id', 'object_type', 'owner', 'json'] },
  });

  const object = response.object;
  console.log(
    JSON.stringify(
      {
        found: Boolean(object),
        objectId: object?.objectId ?? null,
        objectType: object?.objectType ?? null,
        owner: object?.owner ?? null,
        json: object?.json ?? null,
      },
      (_key, value) => (typeof value === 'bigint' ? value.toString() : value),
      2,
    ),
  );

  if (delegateKey) {
    console.log(`\nDelegate public key (Ed25519): ${ed25519PublicKeyHex(delegateKey)}`);
  } else {
    console.log('\nMEMWAL_KEY kosong; public key delegate tidak diturunkan.');
  }
} catch (error) {
  console.error(`Gagal membaca objek akun: ${error?.code ?? error?.name}: ${error?.message}`);
  process.exit(1);
} finally {
  transport.close();
}
