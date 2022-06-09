import { Dialect, NodeDialectWalletAdapter } from '@dialectlabs/sdk';

async function run() {
  const sdk = Dialect.sdk({
    environment: 'local-development',
    wallet: NodeDialectWalletAdapter.create(),
  });
  const dapp = await sdk.dapps.find();
  const dappAddresses = await dapp.dappAddresses.findAll();
  console.log(dappAddresses);
}

(async () => {
  await run();
})();
