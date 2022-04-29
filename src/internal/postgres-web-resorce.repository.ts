import { ResourceId } from '../data-model';
import { PublicKey } from '@solana/web3.js';
import {
  Web2Subscriber,
  Web2SubscriberRepository,
} from '../web-subscriber.repository';
import { DateTime } from 'luxon';

// TODO: implement this
export class PostgresWeb2SubscriberRepository
  implements Web2SubscriberRepository
{
  constructor(
    private readonly postgresUrl: string,
    private readonly monitorPublicKey: PublicKey,
  ) {}

  findBy(resourceIds: ResourceId[]): Promise<Web2Subscriber[]> {
    // Option one: use prisma
    // - first increment: copy the schema into this repo and generate a client based on this schema here and use it
    // - (in parallel) try to publish prisma client to npm from wallet-address-registry-service
    // Option two: use another db client e.g. slonik
    //   const fooResult = await connection.query(sql`
    //     SELECT id
    //     FROM foo
    //     WHERE bar = ${bar}
    //   `);
    // Option three: call rest API hosted in wallet-address-registry for fetching
    //
    // Step 1. Get db client ready
    // Option 1. Use prisma client to make query
    // Option 2. Don't use prisma, use some other db client
    // Step 2. Just write a query
    return Promise.resolve([]);
  }

  findAll(): Promise<Web2Subscriber[]> {
    const DIALECT_BASE_URL = '/api';
    const dappPublicKey = process.env.MONITOR_PUBLIC_KEY;
    let url = `${DIALECT_BASE_URL}/v0/web2Subscriber/all/dapp:${dappPublicKey}`;
    let headers = new Headers();
    headers.set('Authorization', 'Basic ' + process.env.POSTGRES_AUTH);
    
    async () => {
      let rawResponse = await fetch(url, {method:'GET', headers: headers});
      console.log(rawResponse);
    }

    // TODO return formatted response data
    return Promise.resolve([]);
  }
}

// TODO: implement this
export class InMemoryWeb2SubscriberRepository
  implements Web2SubscriberRepository
{
  private resourceIdToResourceInfo: Map<string, Web2Subscriber> = new Map<
    string,
    Web2Subscriber
  >();

  private lastUpdatedAtUtcSeconds: number = -1;
  private ttl = 60;

  constructor(
    private readonly monitorPublicKey: PublicKey,
    private readonly delegate: Web2SubscriberRepository,
  ) {}

  async findBy(resourceIds: ResourceId[]): Promise<Web2Subscriber[]> {
    
    const nowUtcSeconds = DateTime.now().toUTC().toSeconds();
    if ((nowUtcSeconds - this.lastUpdatedAtUtcSeconds) > this.ttl) {

      (await this.delegate.findAll()).map((web2Subscriber) => {
        // filter for supplied resourceIds
        let pk = resourceIds.find((pubkey) => pubkey.equals(web2Subscriber.resourceId));
        if (pk) {
          this.resourceIdToResourceInfo.set(pk.toString(), web2Subscriber);
        }
      });
      this.lastUpdatedAtUtcSeconds = nowUtcSeconds;
    }
    return Array.from(this.resourceIdToResourceInfo.values());
  }

  findAll(): Promise<Web2Subscriber[]> {
    return Promise.resolve([]);
  }
}
