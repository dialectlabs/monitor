import { Monitors } from './monitor-client-api';
import { Event, EventSink, ResourceId } from './monitor';
import { Duration } from 'luxon';
import { Pipelines } from './pipelines';
import { DataType } from './poc';

import { SubscriberEventHandler, SubscriberRepository } from '../src';
import { Keypair } from '@solana/web3.js';
import { expect } from '@jest/globals';
jest.setTimeout(30000);

export class DummySubscriberRepository implements SubscriberRepository {
  private subscribers: ResourceId[] = [];

  constructor(size: number = 2) {
    this.subscribers = new Array(size)
      .fill(0)
      .map((it) => new Keypair().publicKey);
  }

  private readonly onSubscriberAddedHandlers: SubscriberEventHandler[] = [];
  private readonly onSubscriberRemovedHandlers: SubscriberEventHandler[] = [];

  findAll(): Promise<ResourceId[]> {
    console.log('suka', JSON.stringify(this.subscribers));
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
    console.log(
      `Got new event ${JSON.stringify(event)} for recipients ${recipients}`,
    );
    return Promise.resolve();
  }
}

describe('Update method', () => {
  it('fsadsafas', async () => {
    const obj: DataType = {
      smth: '31231',
      cratio: 312,
      cratio2: 331,
    };

    const monitor = Monitors.builder<DataType>({
      subscriberRepository: new DummySubscriberRepository(),
      eventSink: new ConsoleEventSink(),
    })
      .pollDataFrom((subscribers: ResourceId[]) => {
        console.log(JSON.stringify(subscribers));
        return Promise.resolve([
          {
            data: {
              smth: '31231',
              cratio: 312,
              cratio2: 331,
            },
            resourceId: subscribers[0],
          },
        ]);
      }, Duration.fromObject({ seconds: 2 }))
      .transform<number>(
        {
          parameters: ['cratio', 'cratio2'],
          pipelines: [Pipelines.fallingEdge(111), Pipelines.risingEdge(150)],
        },
        obj,
      )
      .transform<string>(
        {
          parameters: ['smth'],
          pipelines: [Pipelines.forward()],
        },
        obj,
      )
      .dispatch('unicast')
      .build();

    await monitor.start();

    await sleep(100000);
    expect(monitor).not.toBeNull();
  });
});

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
