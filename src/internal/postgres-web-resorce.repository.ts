import { ResourceId } from '../data-model';
import { PublicKey } from '@solana/web3.js';
import {
  Web2Subscriber,
  Web2SubscriberRepository,
} from '../web-subscriber.repository';

// TODO: implement this
export class PostgresWeb2SubscriberRepository
  implements Web2SubscriberRepository
{
  constructor(
    private readonly postgresUrl: string,
    private readonly monitorPublicKey: PublicKey,
  ) {}

  findBy(resourceIds: ResourceId[]): Promise<Web2Subscriber[]> {
    //
    // Step 1. Get db connection ready to exec queries
    // Option 1. Use prisma client to make query
    // Option 2. Don't use prisma, use some other db client
    // Step 2. Just write a query
    return Promise.resolve([]);
  }

  findAll(): Promise<Web2Subscriber[]> {
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

  constructor(
    private readonly monitorPublicKey: PublicKey,
    private readonly delegate: Web2SubscriberRepository,
  ) {}

  findBy(resourceIds: ResourceId[]): Promise<Web2Subscriber[]> {
    // TODO: implement
    /*
     *  if (now - lastUpdatedAtUtcSeconds > ttl) {
      resourceIdToResourceInfo = this.delegate.findAll();
      this.lastUpdatedAtUtcSeconds = now;
    }
    *     return resourceIdToResourceInfo;

     * */
    return Promise.resolve([]);
  }

  findAll(): Promise<Web2Subscriber[]> {
    return Promise.resolve([]);
  }
}
