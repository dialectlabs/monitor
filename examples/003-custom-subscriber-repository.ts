import {
  ResourceId,
  Subscriber,
  SubscriberEventHandler,
  SubscriberRepository,
} from '../src';
import { Keypair } from '@solana/web3.js';

export class DummySubscriberRepository implements SubscriberRepository {
  private readonly subscribers: Subscriber[] = [];
  private readonly onSubscriberAddedHandlers: SubscriberEventHandler[] = [];
  private readonly onSubscriberRemovedHandlers: SubscriberEventHandler[] = [];

  constructor(size: number = 2) {
    this.subscribers = Array(size)
      .fill(0)
      .map(() => {
        const resourceId = new Keypair().publicKey;
        return {
          resourceId,
          wallet: resourceId,
        };
      });
  }

  findAll(): Promise<Subscriber[]> {
    return Promise.resolve(this.subscribers);
  }

  subscribe(
    onSubscriberAdded: SubscriberEventHandler,
    onSubscriberRemoved: SubscriberEventHandler,
  ): any {
    this.onSubscriberAddedHandlers.push(onSubscriberAdded);
    this.onSubscriberRemovedHandlers.push(onSubscriberRemoved);
  }

  addNewSubscriber(subscriber: Subscriber) {
    this.subscribers.push(subscriber);
    this.onSubscriberAddedHandlers.forEach((it) => it(subscriber));
  }
}
