import { SuiGrpcClient } from '@mysten/sui/grpc';
import { GrpcTransport } from '@protobuf-ts/grpc-transport';
import { ChannelCredentials } from '@grpc/grpc-js';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { getFaucetHost, requestSuiFromFaucetV2, requestSuiFromFaucetV3 } from '@mysten/sui/faucet';
import { Transaction } from '@mysten/sui/transactions';

const apiKey = process.env.TATUM_API_KEY;
if (!apiKey) {
  console.error('TATUM_API_KEY belum diisi di .env.local');
  process.exit(1);
}

const host = 'sui-testnet-grpc.gateway.tatum.io:443';
const transport = new GrpcTransport({
  host,
  channelCredentials: ChannelCredentials.createSsl(),
  meta: { 'x-api-key': apiKey },
});
const client = new SuiGrpcClient({ network: 'testnet', transport });

const replacer = (_key, value) => (typeof value === 'bigint' ? value.toString() : value);

try {
  const keypair = Ed25519Keypair.generate();
  const sender = keypair.toSuiAddress();
  console.log(`Dompet uji sementara: ${sender}`);

  const faucetHost = getFaucetHost('testnet');
  try {
    const faucet = await requestSuiFromFaucetV2({
      host: faucetHost,
      recipient: sender,
    });
    console.log(`Faucet v2: ${faucet.status}, koin: ${faucet.coins_sent?.length ?? 0}`);
  } catch (v2Error) {
    console.log(`Faucet v2 gagal (${v2Error.message}); mencoba v3 (PoW)...`);
    const faucet = await requestSuiFromFaucetV3({
      host: faucetHost,
      recipient: sender,
      timeout: 120_000,
    });
    console.log(`Faucet v3: ${faucet.status}, amount: ${faucet.amountMist} MIST`);
  }

  let balance = 0n;
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const { response } = await client.stateService.getBalance({
      owner: sender,
      coinType: '0x2::sui::SUI',
    });
    balance = response.balance?.balance ?? 0n;
    if (balance > 0n) break;
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  if (balance === 0n) {
    throw new Error('Saldo faucet belum masuk setelah 30 detik.');
  }
  console.log(`Saldo uji: ${balance} MIST`);

  const tx = new Transaction();
  tx.setSender(sender);
  const [coin] = tx.splitCoins(tx.gas, [10_000_000n]);
  tx.transferObjects([coin], sender);

  const started = performance.now();
  const result = await client.simulateTransaction({
    transaction: tx,
    include: { effects: true, balanceChanges: true, commandResults: true },
  });
  const elapsedMs = Math.round(performance.now() - started);

  if (result.$kind === 'FailedTransaction') {
    console.error(
      JSON.stringify(
        {
          ok: false,
          host,
          sender,
          elapsedMs,
          status: result.FailedTransaction.status,
        },
        replacer,
        2,
      ),
    );
    process.exit(1);
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        host,
        sender,
        elapsedMs,
        digest: result.Transaction.digest,
        status: result.Transaction.status,
        balanceChanges: result.Transaction.balanceChanges,
      },
      replacer,
      2,
    ),
  );
} catch (error) {
  console.error(`G1 testnet gagal: ${error?.name ?? 'Error'}: ${error?.message}`);
  process.exit(1);
} finally {
  transport.close();
}
