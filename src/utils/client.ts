import { LAMPORTS_PER_SOL, PublicKey } from '@solana/web3.js';

import {
  AddressType,
  Backend,
  Config,
  Dialect,
  NodeDialectWalletAdapter,
  ThreadMemberScope,
} from '@dialectlabs/sdk';
import { sleep } from '@dialectlabs/web3';

export async function createClient(
  config: Omit<Config, 'wallet'>,
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
        new PublicKey(wallet),
        3 * LAMPORTS_PER_SOL,
      );
    await program.provider.connection.confirmTransaction(fromAirdropSignature);
  }
  const dappAddress = await sdk.wallet.addresses.create({
    dappPublicKey,
    type: AddressType.Wallet,
    value: wallet.publicKey.toBase58(),
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
  process.on('SIGINT', async () => {
    console.log(
      `Deleting ${
        thread.backend
      } thread for members: [${wallet.publicKey.toBase58()}, ${dappPublicKey}]`,
    );
    await thread.delete();
    console.log(`Deleting address for ${wallet.publicKey.toBase58()}`);
    await sdk.wallet.addresses.delete({ addressId: dappAddress.address.id });
    // process.exit(0);
  });
  let lastMessageTimestamp = thread.updatedAt;
  while (true) {
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
