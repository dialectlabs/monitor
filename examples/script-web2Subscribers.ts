import { Context, Telegraf } from 'telegraf';
import * as Axios from 'axios';
import {
  Web2Subscriber,
  Web2SubscriberRepository,
} from '../src/web-subscriber.repository';

const axios = Axios.default;

async function run() {
  let subs: Web2Subscriber[] = [];
  const DIALECT_BASE_URL = 'http://localhost:3000/api';
  const dappPublicKey = "D2pyBevYb6dit1oCx6e8vCxFK9mBeYCRe8TTntk2Tm98"; //process.env.MONITOR_PUBLIC_KEY;
  let url = `${DIALECT_BASE_URL}/v0/web2Subscriber/all/${dappPublicKey}`;
  console.log(url);
  let result = await axios.get(url, {
    auth: { username: process.env.POSTGRES_BASIC_AUTH!, password: '' }
  });
  subs = result.data as Web2Subscriber[];
  console.log(subs);
}

(async () => {
  await run();
})()