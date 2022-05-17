import * as Axios from 'axios';
import { Web2Subscriber } from '../src/web-subscriber.repository';
import { KeypairTokenService } from '../src/internal/rest-web2-subscriber.repository';
import { Keypair } from '@solana/web3.js';

const axios = Axios.default;

async function run() {
  let subs: Web2Subscriber[] = [];
  const DIALECT_BASE_URL = 'http://localhost:3000/api';

  const dappPrivateKey = new Uint8Array(
    JSON.parse(process.env.MONITORING_SERVICE_PRIVATE_KEY as string),
  );
  const keypair = Keypair.fromSecretKey(dappPrivateKey);
  const dappPublicKey = keypair.publicKey;
  let url = `${DIALECT_BASE_URL}/v0/web2Subscriber/all/${dappPublicKey}`;
  const tokenService = new KeypairTokenService(keypair);
  console.log(url);
  let result = await axios.get(url, {
    headers: { Authorization: `Bearer ${tokenService.get().token}` },
  });
  subs = result.data as Web2Subscriber[];
  console.log(subs);
}

(async () => {
  await run();
})();
