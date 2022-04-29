import { Context, Telegraf } from 'telegraf';
import * as Axios from 'axios';

const axios = Axios.default;

async function run() { 

  

  const DIALECT_BASE_URL = 'http://localhost:3000/api';
  const dappPublicKey = "D1ALECTfeCZt9bAbPWtJk7ntv24vDYGPmyS7swp7DY5h"; //process.env.MONITOR_PUBLIC_KEY;
  let url = `${DIALECT_BASE_URL}/v0/web2Subscriber/all/${dappPublicKey}`;
  
  async () => {
    let rawResponse = await axios.get(url, {
      headers: { 'Authorization': + `Basic ${process.env.POSTGRES_BASIC_AUTH}`}
    });
    
    console.log(rawResponse);
  }

  // TODO return formatted response data
  return Promise.resolve([]);
}

run();