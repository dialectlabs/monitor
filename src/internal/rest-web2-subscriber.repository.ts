import { ResourceId } from '../data-model';
import { PublicKey } from '@solana/web3.js';
import {
  Web2Subscriber,
  Web2SubscriberRepository,
} from '../web-subscriber.repository';
import { DateTime } from 'luxon';
import axios, { AxiosError } from 'axios';

export class RestWeb2SubscriberRepository implements Web2SubscriberRepository {
  private readonly subscribersEndpoint;

  constructor(
    private readonly serviceUrl: string,
    private readonly monitorPublicKey: PublicKey,
  ) {
    this.subscribersEndpoint = `${
      this.serviceUrl
    }/v0/dapps/${this.monitorPublicKey.toBase58()}/subscribers`;
  }

  async findBy(resourceIds: ResourceId[]): Promise<Web2Subscriber[]> {
    const all = await this.findAll();
    const filtered: Web2Subscriber[] = all.filter(
      (web2Sub) => !resourceIds.find((it) => it.equals(web2Sub.resourceId)),
    );
    // console.log('___findBy');
    // console.log(filtered);
    return Promise.all(filtered);
  }

  async findAll(): Promise<Web2Subscriber[]> {
    const subscriberDtos = await this.fetchSubscribers();
    // console.log('---finaAll()');
    // console.log(this.monitorPublicKey);
    // console.log(result.data);
    // redo resourceId to Pubkey again on this side.
    const web2Subscribers: Web2Subscriber[] = subscriberDtos.map((it) => ({
      resourceId: new PublicKey(it.resourceId),
      email: it.email,
      telegramId: it.telegramId,
      smsNumber: it.smsNumber,
    }));
    // console.log('^^^findAll()');
    return Promise.all(web2Subscribers);
  }

  private async fetchSubscribers() {
    try {
      return (
        await axios.get<SubscriberDto[]>(this.subscribersEndpoint, {
          auth: {
            username: process.env.WEB2_SUBSCRIBER_SERVICE_BASIC_AUTH!,
            password: '',
          },
        })
      ).data;
    } catch (e) {
      const err = e as AxiosError;
      console.error('Failed to fetch subscribers', err.message);
      return [];
    }
  }
}

// TODO: test this for performance increase
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
    if (
      DateTime.now().toUTC().toSeconds() - this.lastUpdatedAtUtcSeconds >
      this.ttl
    ) {
      (await this.delegate.findAll()).map((web2Subscriber) => {
        // find supplied resourceIds
        let pk = resourceIds.find((pubkey) =>
          pubkey.equals(web2Subscriber.resourceId),
        );
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

interface SubscriberDto {
  resourceId: PublicKey;
  email?: string;
  telegramId?: string;
  smsNumber?: string;
}
