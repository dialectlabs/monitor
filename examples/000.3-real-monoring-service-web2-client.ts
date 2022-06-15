import { PublicKey } from '@solana/web3.js';

import {
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
    .map(() =>
      Dialect.sdk({
        environment: 'local-development',
        wallet: NodeDialectWalletAdapter.create(),
      }),
    );

  let threadsByAddress: Record<string, { thread: Thread }> = Object.fromEntries(
    await Promise.all(
      clients.map(async (client) => {
        const thread = await client.threads.create({
          me: { scopes: [ThreadMemberScope.WRITE, ThreadMemberScope.ADMIN] },
          otherMembers: [
            {
              publicKey: monitoringServicePublicKey,
              scopes: [ThreadMemberScope.WRITE],
            },
          ],
          encrypted: false,
        });
        return [thread.address.toBase58(), { owner: client, thread }];
      }),
    ),
  );

  process.on('SIGINT', async () => {
    const dialectAccounts = Object.values(threadsByAddress);
    console.log(`Deleting dialects for ${dialectAccounts.length} clients`);
    await Promise.all(dialectAccounts.map(({ thread }) => thread.delete()));
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
            `Got ${filtered.length} new messages for ${
              thread.me
            }: ${filtered.map((it) => it.text)}`,
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
  await createClients(1);
};

main();
