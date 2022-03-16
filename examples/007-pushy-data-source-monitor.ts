import { Monitor, Monitors, Pipelines, SourceData } from '../src';
import { DummySubscriberRepository } from './003-custom-subscriber-repository';
import { ConsoleNotificationSink } from './004-custom-notification-sink';
import { Observable } from 'rxjs';
import { Keypair } from '@solana/web3.js';

type DataType = {
  cratio: number;
  healthRatio: number;
};

const threshold = 0.5;

const monitor: Monitor<DataType> = Monitors.builder({
  subscriberRepository: new DummySubscriberRepository(1),
  notificationSink: new ConsoleNotificationSink(),
})
  .defineDataSource<DataType>()
  .push(
    new Observable((subscriber) => {
      const publicKey = Keypair.generate().publicKey;
      const d1: SourceData<DataType> = {
        data: { cratio: 1, healthRatio: 2 },
        resourceId: publicKey,
      };
      const d2: SourceData<DataType> = {
        data: { cratio: 0, healthRatio: 0 },
        resourceId: publicKey,
      };
      subscriber.next(d1);
      subscriber.next(d2);
    }),
  )
  .transform<number>({
    keys: ['cratio'],
    pipelines: [
      Pipelines.threshold(
        {
          type: 'falling-edge',
          threshold,
        },
        {
          messageBuilder: ({ value, context: { origin } }) =>
            `Your cratio = ${value} below warning threshold`,
        },
      ),
      Pipelines.threshold(
        {
          type: 'rising-edge',
          threshold,
        },
        {
          messageBuilder: ({ value, context }) =>
            `Your cratio = ${value} above warning threshold`,
        },
      ),
    ],
  })
  .dispatch('unicast')
  .build();
monitor.start();
