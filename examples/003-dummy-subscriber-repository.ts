import {
  ResourceId,
  SubscriberEventHandler,
  SubscriberRepository,
} from '../src';
import { Keypair } from '@solana/web3.js';

export class DummySubscriberRepository implements SubscriberRepository {
  private subscribers: ResourceId[] = [];

  constructor(size: number = 2) {
    this.subscribers = Array(size).map((it) => new Keypair().publicKey);
  }

  private readonly onSubscriberAddedHandlers: SubscriberEventHandler[] = [];
  private readonly onSubscriberRemovedHandlers: SubscriberEventHandler[] = [];

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
  ): any {
    this.onSubscriberAddedHandlers.push(onSubscriberAdded);
    this.onSubscriberRemovedHandlers.push(onSubscriberRemoved);
  }

  addNewSubscriber(resourceId: ResourceId) {
    this.subscribers.push(resourceId);
    this.onSubscriberAddedHandlers.forEach((it) => it(resourceId));
  }
}
