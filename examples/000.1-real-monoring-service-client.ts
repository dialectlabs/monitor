import { Backend } from '@dialectlabs/sdk';
import { PublicKey } from '@solana/web3.js';
import { createClient } from '../src';

const main = async (): Promise<void> => {
  const publickey = process.env.PUBLIC_KEY;
  const monitoringServiceKey = new PublicKey(publickey!);
  await Promise.allSettled([
    // createClient({
    //   environment: 'local-development',
    //   backends: [Backend.Solana],
    // }),
    createClient(
      {
        environment: 'local-development',
        backends: [Backend.DialectCloud],
      },
      monitoringServiceKey,
    ),
  ]);
};

main();
