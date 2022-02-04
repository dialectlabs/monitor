import {
  ResourceId,
  SubscriberEventHandler,
  SubscriberRepository,
} from '../src';
import { Keypair } from '@solana/web3.js';

export class DummySubscriberRepository implements SubscriberRepository {
  private subscribers: ResourceId[] = [
    new Keypair().publicKey,
    new Keypair().publicKey,
  ];

  findAll(): Promise<ResourceId[]> {
    return Promise.resolve(this.subscribers);
  }

  findByResourceId(resourceId: ResourceId): Promise<ResourceId | null> {
    return Promise.resolve(
      this.subscribers.find((it) => it.equals(resourceId)) ?? null,
    );
  }

  subscribe(
    onSubscriberAdded: SubscriberEventHandler,
    onSubscriberRemoved: SubscriberEventHandler,
  ): any {}
}
