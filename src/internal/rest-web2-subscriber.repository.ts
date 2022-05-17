import { ResourceId } from '../data-model';
import { Keypair, PublicKey } from '@solana/web3.js';
import {
  Web2Subscriber,
  Web2SubscriberRepository,
} from '../web-subscriber.repository';
import { DateTime, Duration } from 'luxon';
import axios, { AxiosError } from 'axios';
import nacl from 'tweetnacl';

export class RestWeb2SubscriberRepository implements Web2SubscriberRepository {
  private readonly subscribersEndpoint;
  private readonly tokenService: TokenService;

  constructor(
    private readonly serviceUrl: string,
    private readonly monitorKeypair: Keypair,
  ) {
    this.subscribersEndpoint = `${
      this.serviceUrl
    }/v0/dapps/${this.monitorKeypair.publicKey.toBase58()}/subscribers`;
    this.tokenService = new CachingTokenService(
      new KeypairTokenService(monitorKeypair),
    );
  }

  async findBy(resourceIds: ResourceId[]): Promise<Web2Subscriber[]> {
    const all = await this.findAll();
    const filtered: Web2Subscriber[] = all.filter((web2Sub) =>
      resourceIds.find((it) => it.equals(web2Sub.resourceId)),
    );
    return Promise.all(filtered);
  }

  async findAll(): Promise<Web2Subscriber[]> {
    const subscriberDtos = await this.fetchSubscribers();
    const web2Subscribers: Web2Subscriber[] = subscriberDtos.map((it) => ({
      resourceId: new PublicKey(it.resourceId),
      email: it.email,
      telegramId: it.telegramId,
      smsNumber: it.smsNumber,
    }));
    return Promise.all(web2Subscribers);
  }

  private async fetchSubscribers() {
    try {
      return (
        await axios.get<SubscriberDto[]>(this.subscribersEndpoint, {
          headers: { Authorization: `Bearer ${this.tokenService.get().token}` },
        })
      ).data;
    } catch (e) {
      const err = e as AxiosError;
      console.error('Failed to fetch subscribers', err.message);
      return [];
    }
  }
}

export class InMemoryWeb2SubscriberRepository
  implements Web2SubscriberRepository
{
  private resourceIdToResourceInfo: Record<string, Web2Subscriber> = {};

  private lastUpdatedAtUtcSeconds: number = -1;
  private ttlSeconds = 60;
  private isCaching = false;

  constructor(
    private readonly monitorPublicKey: PublicKey,
    private readonly delegate: Web2SubscriberRepository,
  ) {}

  async findBy(resourceIds: ResourceId[]): Promise<Web2Subscriber[]> {
    const all = await this.findAll();
    return all.filter((s) => resourceIds.find((it) => it.equals(s.resourceId)));
  }

  async findAll(): Promise<Web2Subscriber[]> {
    if (this.isCaching) {
      return Object.values(this.resourceIdToResourceInfo);
    }
    const now = DateTime.now().toUTC().toSeconds();
    if (now - this.lastUpdatedAtUtcSeconds <= this.ttlSeconds) {
      return Object.values(this.resourceIdToResourceInfo);
    }
    try {
      console.log('Started caching');
      this.isCaching = true;
      const allSubscribers = await this.delegate.findAll();
      this.resourceIdToResourceInfo = Object.fromEntries(
        allSubscribers.map((it) => [it.resourceId, it]),
      );
      this.lastUpdatedAtUtcSeconds = now;
      console.log('Caching complete');
      return Object.values(this.resourceIdToResourceInfo);
    } finally {
      this.isCaching = false;
    }
  }
}

interface SubscriberDto {
  resourceId: PublicKey;
  email?: string;
  telegramId?: string;
  smsNumber?: string;
}

interface Token {
  token: string;
  expiresAt: number;
}

export interface TokenService {
  get(): Token;
}

export class KeypairTokenService implements TokenService {
  constructor(
    private readonly keypair: Keypair,
    private readonly tokenTtl: Duration = Duration.fromObject({ minutes: 5 }),
  ) {}

  get(): Token {
    const now = new Date().getTime();
    const expiresAt = now + this.tokenTtl.toMillis();
    const dateEncoded = new TextEncoder().encode(
      btoa(JSON.stringify(expiresAt)),
    );
    const signature = nacl.sign.detached(dateEncoded, this.keypair.secretKey);
    const base64Signature = btoa(
      String.fromCharCode.apply(null, signature as unknown as number[]),
    );
    return {
      token: `${expiresAt}.${base64Signature}`,
      expiresAt: expiresAt,
    };
  }
}

export class CachingTokenService implements TokenService {
  private token?: Token;

  constructor(private readonly delegate: KeypairTokenService) {}

  get(): Token {
    if (!this.token || this.tokenExpiresSoon()) {
      this.token = this.delegate.get();
    }
    return this.token;
  }

  private tokenExpiresSoon() {
    const now = new Date().getTime();
    const expirationDeltaMillis = 30 * 1000;
    return (
      this.token?.expiresAt &&
      now + expirationDeltaMillis > this.token.expiresAt
    );
  }
}
