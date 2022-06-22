import { LAMPORTS_PER_SOL, PublicKey } from '@solana/web3.js';

import {
  AddressType,
  Backend,
  ConfigProps,
  Dialect,
  NodeDialectWalletAdapter,
  ThreadMemberScope,
} from '@dialectlabs/sdk';
import { sleep } from '@dialectlabs/web3';

export async function createDappIfAbsent(config: ConfigProps) {
  const sdk = Dialect.sdk(config);
  const dapp = await sdk.dapps.find();
  if (!dapp) {
    console.log(
      `Dapp ${sdk.wallet.publicKey.toBase58()} not registered in ${
        sdk.info.config.dialectCloud?.url
      }, creating it`,
    );
    return sdk.dapps.create();
  }
  console.log(
    `Dapp ${dapp.publicKey.toBase58()} already registered in ${
      sdk.info.config.dialectCloud?.url
    }`,
  );
}

export async function createClient(
  config: Omit<ConfigProps, 'wallet'>,
  dappPublicKey: PublicKey,
): Promise<void> {
  const wallet = NodeDialectWalletAdapter.create();
  console.log(`Creating sdk for client ${wallet.publicKey.toBase58()}`);
  const sdk = Dialect.sdk({
    ...config,
    wallet,
  });

  if (sdk.info.config.backends?.find((it) => it === Backend.Solana)) {
    const program = sdk.info.solana.dialectProgram;
    const fromAirdropSignature =
      await program.provider.connection.requestAirdrop(
        new PublicKey(wallet.publicKey.toBase58()),
        3 * LAMPORTS_PER_SOL,
      );
    await program.provider.connection.confirmTransaction(fromAirdropSignature);
  }
  const address = await sdk.wallet.addresses.create({
    type: AddressType.Wallet,
    value: wallet.publicKey.toBase58(),
  });
  await sdk.wallet.dappAddresses.create({
    addressId: address.id,
    dappPublicKey,
    enabled: true,
  });
  console.log(
    `Created address for wallet: ${wallet.publicKey.toBase58()} and linked with dApp ${dappPublicKey}`,
  );
  const thread = await sdk.threads.create({
    me: { scopes: [ThreadMemberScope.WRITE, ThreadMemberScope.ADMIN] },
    otherMembers: [
      {
        publicKey: dappPublicKey,
        scopes: [ThreadMemberScope.WRITE],
      },
    ],
    encrypted: true,
  });
  console.log(
    `Created ${
      thread.backend
    } thread for members: [${wallet.publicKey.toBase58()}, ${dappPublicKey}]`,
  );
  let isInterrupted = false;
  process.on('SIGINT', async () => {
    console.log('Cleaning created resources');
    isInterrupted = true;
    console.log(
      `Deleting ${
        thread.backend
      } thread for members: [${wallet.publicKey.toBase58()}, ${dappPublicKey}]`,
    );
    await thread.delete();
    console.log(`Deleting address for ${wallet.publicKey.toBase58()}`);
    await sdk.wallet.addresses.delete({ addressId: address.id });
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
          thread.backend
        } thread [${wallet.publicKey.toBase58()}, ${dappPublicKey}]:
    ${newMessages.map((it) => it.text)}`,
      );
    }
    lastMessageTimestamp = thread.updatedAt;
    await sleep(1000);
  }
}
