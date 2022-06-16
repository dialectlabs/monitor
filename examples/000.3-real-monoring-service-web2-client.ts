import { PublicKey } from '@solana/web3.js';

import {
  AddressType,
  Dialect,
  NodeDialectWalletAdapter,
  Thread,
  ThreadMemberScope,
} from '@dialectlabs/sdk';
import { sleep } from '@dialectlabs/web3';

const createClients = async (n: number): Promise<void> => {
  const monitoringServicePublicKey = new PublicKey(process.env.PUBLIC_KEY!);
  console.log(
    `Creating ${n} monitoring service clients targeting ${monitoringServicePublicKey}`,
  );
  const clients = Array(n)
    .fill(0)
    .map(() => {
      const wallet = NodeDialectWalletAdapter.create();
      return {
        wallet,
        sdk: Dialect.sdk({
          environment: 'local-development',
          wallet: wallet,
        }),
      };
    });

  const addresses = await Promise.all(
    clients.map(async ({ wallet, sdk }) => {
      const address = await sdk.wallet.addresses.create({
        dappPublicKey: monitoringServicePublicKey,
        type: AddressType.Wallet,
        value: wallet.publicKey.toBase58(),
        enabled: true,
      });
      return {
        sdk: sdk,
        address,
      };
    }),
  );

  let threadsByAddress: Record<string, { thread: Thread }> = Object.fromEntries(
    await Promise.all(
      clients.map(async ({ sdk }) => {
        const thread = await sdk.threads.create({
          me: { scopes: [ThreadMemberScope.WRITE, ThreadMemberScope.ADMIN] },
          otherMembers: [
            {
              publicKey: monitoringServicePublicKey,
              scopes: [ThreadMemberScope.WRITE],
            },
          ],
          encrypted: false,
        });
        return [thread.address.toBase58(), { owner: sdk, thread }];
      }),
    ),
  );

  process.on('SIGINT', async () => {
    const dialectAccounts = Object.values(threadsByAddress);
    console.log(`Deleting dialects for ${dialectAccounts.length} clients`);
    await Promise.all(dialectAccounts.map(({ thread }) => thread.delete()));
    await Promise.all(
      addresses.map(({ address, sdk }) =>
        sdk.wallet.addresses.delete({ addressId: address.address.id }),
      ),
    );
    console.log(`Deleted dialects for ${dialectAccounts.length} clients`);
    process.exit(0);
  });

  let lastPoll = new Date(0);
  while (true) {
    const threads = Object.values(threadsByAddress);
    await Promise.all(
      threads.map(async ({ thread }) => {
        const messages = await thread.messages();
        const filtered = messages.filter(
          (it) => it.timestamp.getTime() > lastPoll.getTime(),
        );
        if (filtered.length > 0) {
          console.log(
            `Got ${
              filtered.length
            } new messages for ${thread.me.publicKey.toBase58()}: ${filtered.map(
              (it) => it.text,
            )}`,
          );
        }
        return messages;
      }),
    );
    lastPoll = new Date();
    await sleep(1000);
  }
};

const main = async (): Promise<void> => {
  await createClients(2);
};

main();
