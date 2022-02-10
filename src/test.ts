import { Duration } from 'luxon';

import {
  Data,
  Event,
  EventSink,
  generateWelcomeMessage,
  Monitors,
  Pipelines,
  ResourceId,
  SubscriberEventHandler,
  SubscriberRepository,
  SubscriberState,
} from '../src';
import { Keypair } from '@solana/web3.js';
import { expect } from '@jest/globals';
import { DataType } from '../examples/poc';

jest.setTimeout(30000);

export class DummySubscriberRepository implements SubscriberRepository {
  private subscribers: ResourceId[] = [];
  private readonly onSubscriberAddedHandlers: SubscriberEventHandler[] = [];
  private readonly onSubscriberRemovedHandlers: SubscriberEventHandler[] = [];

  constructor(size: number = 2) {
    this.subscribers = new Array(size)
      .fill(0)
      .map((it) => new Keypair().publicKey);
  }

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

export class ConsoleEventSink implements EventSink {
  push(event: Event, recipients: ResourceId[]): Promise<void> {
    // console.log(
    //   `Got new event ${JSON.stringify(event)} for recipients ${recipients}`,
    // );
    return Promise.resolve();
  }
}

describe('Update method', () => {
  it('example data source', async () => {
    const monitor = Monitors.builder({
      subscriberRepository: new DummySubscriberRepository(),
      eventSink: new ConsoleEventSink(),
    })
      .defineDataSource<DataType>()
      .poll((subscribers: ResourceId[]) => {
        const data: Data<DataType>[] = subscribers.map((resourceId) => ({
          data: {
            smth: '31231',
            cratio: 312,
            cratio2: 331,
          },
          resourceId,
        }));
        return Promise.resolve(data);
      }, Duration.fromObject({ seconds: 20 }))
      .transform<number>({
        keys: ['cratio', 'cratio2'],
        pipelines: [Pipelines.fallingEdge(111), Pipelines.risingEdge(150)],
      })
      .transform<string>({
        keys: ['smth'],
        pipelines: [Pipelines.forward()],
      })
      .dispatch('unicast')
      .build();
    await monitor.start();

    await sleep(100000);
    expect(monitor).not.toBeNull();
  });

  it('example welc msg', async () => {
    const dummySubscriberRepository = new DummySubscriberRepository();
    const monitor = Monitors.builder({
      subscriberRepository: dummySubscriberRepository,
      eventSink: new ConsoleEventSink(),
    })
      .subscriberEvents()
      .transform<SubscriberState>({
        keys: ['state'],
        pipelines: [generateWelcomeMessage],
      })
      .dispatch('unicast')
      .build();
    await monitor.start();
    dummySubscriberRepository.addNewSubscriber(new Keypair().publicKey);
    dummySubscriberRepository.addNewSubscriber(new Keypair().publicKey);
    dummySubscriberRepository.addNewSubscriber(new Keypair().publicKey);

    await sleep(100000);
    expect(monitor).not.toBeNull();
  });
});

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
