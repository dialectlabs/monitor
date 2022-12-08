import { Keypair, PublicKey } from '@solana/web3.js';

import {
  AddressType,
  ConfigProps,
  Dialect,
  DialectSdk,
  ThreadMemberScope,
} from '@dialectlabs/sdk';

import {
  Solana,
  SolanaSdkFactory,
  NodeDialectSolanaWalletAdapter
} from '@dialectlabs/blockchain-sdk-solana';

const main = async (): Promise<void> => {
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
          environment: 'development',
        },
        dappPublicKey,
      ),
      createClient(
        {
          environment: 'development',
        },
        dappPublicKey,
      ),
    ]);
  }
}

export async function createClient(
  config: Omit<ConfigProps, 'wallet'>,
  dappPublicKey: PublicKey,
): Promise<void> {
  const userKeypair = Keypair.generate();
  const userWalletAdapter = NodeDialectSolanaWalletAdapter.create(userKeypair);

  //const environment: DialectCloudEnvironment = 'development';
  const dialectSolanaSdk: DialectSdk<Solana> = Dialect.sdk(
    config,
    SolanaSdkFactory.create({
      // IMPORTANT: must set environment variable DIALECT_SDK_CREDENTIALS
      // to your dapp's Solana messaging wallet keypair e.g. [170,23, . . . ,300]
      wallet: userWalletAdapter,
    }),
  );
  
  const address = await dialectSolanaSdk.wallet.addresses.create({
    type: AddressType.Wallet,
    value: userWalletAdapter.publicKey.toBase58(),
  });
  await dialectSolanaSdk.wallet.dappAddresses.create({
    addressId: address.id,
    dappAccountAddress: dappPublicKey.toBase58(),
    enabled: true,
  });
  console.log(
    `Created address for wallet: ${userWalletAdapter.publicKey.toBase58()} and linked with dApp ${dappPublicKey}`,
  );
  const thread = await dialectSolanaSdk.threads.create({
    me: { scopes: [ThreadMemberScope.WRITE, ThreadMemberScope.ADMIN] },
    otherMembers: [
      {
        address: dappPublicKey.toBase58(),
        scopes: [ThreadMemberScope.WRITE],
      },
    ],
    encrypted: false,
  });
  console.log(
    `Created ${
      thread.type
    } thread for members: [${userWalletAdapter.publicKey.toBase58()}, ${dappPublicKey.toBase58()}]`,
  );
  let isInterrupted = false;
  process.on('SIGINT', async () => {
    console.log('Cleaning created resources');
    isInterrupted = true;
    console.log(
      `Deleting ${
        thread.type
      } thread for members: [${userWalletAdapter.publicKey.toBase58()}, ${dappPublicKey.toBase58()}]`,
    );
    await thread.delete();
    console.log(`Deleting address for ${userWalletAdapter.publicKey.toBase58()}`);
    await dialectSolanaSdk.wallet.addresses.delete({ addressId: address.id });
    console.log('Please wait');
    // process.exit(0);
  });
  let lastMessageTimestamp = thread.updatedAt;
  while (!isInterrupted) {
    const messages = await thread.messages();
    const newMessages = messages.filter(
      (it) => it.timestamp.getTime() > lastMessageTimestamp.getTime(),
    );
    if (newMessages.length > 0) {
      console.log(
        `Got ${newMessages.length} new messages for ${
          thread.type
        } thread [${userWalletAdapter.publicKey.toBase58()}, ${dappPublicKey.toBase58()}]:
    ${newMessages.map((it) => it.text)}`,
      );
    }
    lastMessageTimestamp = thread.updatedAt;
    await sleep(1000);
  }
}

function sleep(
  ms: number,
): Promise<(value: (() => void) | PromiseLike<() => void>) => void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

main();
