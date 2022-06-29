import { Backend, NodeDialectWalletAdapter } from '@dialectlabs/sdk';
import { Keypair, PublicKey } from '@solana/web3.js';
import { createClient, createDappIfAbsent } from '../src';

const main = async (): Promise<void> => {
  const dappPrivateKeyFromEnv = process.env.DAPP_PRIVATE_KEY;
  if (dappPrivateKeyFromEnv) {
    const dappKeyPair: Keypair = Keypair.fromSecretKey(
      new Uint8Array(JSON.parse(dappPrivateKeyFromEnv)),
    );
    await createDappIfAbsent('Monitoring service client', {
      wallet: NodeDialectWalletAdapter.create(dappKeyPair),
      environment: 'local-development',
      backends: [Backend.DialectCloud],
    });
  }
  const dappPublicKeyFromEnv = process.env.DAPP_PUBLIC_KEY;
  if (!dappPublicKeyFromEnv) {
    return;
  }
  await startClients(dappPublicKeyFromEnv);
};

async function startClients(dappPublicKeyFromEnv: string) {
  const dappPublicKey = new PublicKey(dappPublicKeyFromEnv);
  if (dappPublicKeyFromEnv) {
    await Promise.all([
      createClient(
        {
          environment: 'local-development',
          backends: [Backend.Solana],
        },
        dappPublicKey,
      ),
      createClient(
        {
          environment: 'local-development',
          backends: [Backend.DialectCloud],
        },
        dappPublicKey,
      ),
    ]);
  }
}

main();
