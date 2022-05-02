import { ResourceId } from '../data-model';
import { PublicKey } from '@solana/web3.js';
import {
  Web2Subscriber,
  Web2SubscriberRepository,
} from '../web-subscriber.repository';
import { DateTime } from 'luxon';
import * as Axios from 'axios';

const axios = Axios.default;

// TODO: implement this
export class PostgresWeb2SubscriberRepository
  implements Web2SubscriberRepository
{
  constructor(
    private readonly postgresUrl: string,
    private readonly monitorPublicKey: PublicKey,
  ) {}

  async findBy(resourceIds: ResourceId[]): Promise<Web2Subscriber[]> {
    let values: Web2Subscriber[] = (await this.findAll()).filter((web2Sub) => resourceIds.findIndex((it) => it == web2Sub.resourceId) != -1);
    return Promise.all(values);
  }

  async findAll(): Promise<Web2Subscriber[]> {
    let web2Subscribers: Web2Subscriber[] = [];
    let url = `${this.postgresUrl}/api/v0/dapps/${this.monitorPublicKey}/subscribers`;
    console.log(url);
    let result = await axios.get(url, {
      auth: { username: process.env.POSTGRES_BASIC_AUTH!, password: '' }
    });
    web2Subscribers = result.data as Web2Subscriber[];
    console.log(web2Subscribers);
    return Promise.all(web2Subscribers);
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
    
    if ((DateTime.now().toUTC().toSeconds() - this.lastUpdatedAtUtcSeconds) > this.ttl) {

      (await this.delegate.findAll()).map((web2Subscriber) => {
        // find supplied resourceIds
        let pk = resourceIds.find((pubkey) => pubkey.equals(web2Subscriber.resourceId));
        if (pk) {
          this.resourceIdToResourceInfo.set(pk.toString(), web2Subscriber);
        }
      });
      this.lastUpdatedAtUtcSeconds = DateTime.now().toUTC().toSeconds();
    }
    return Array.from(this.resourceIdToResourceInfo.values());
  }

  findAll(): Promise<Web2Subscriber[]> {
    return this.delegate.findAll();
  }
}
