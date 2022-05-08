import {
  DialectNotification,
  Monitor,
  Monitors,
  Pipelines,
  ResourceId,
  SourceData,
} from '../src';
import {
  DummySubscriberRepository,
  DummyWeb2SubscriberRepository,
} from './003-custom-subscriber-repository';
import { ConsoleNotificationSink } from './004-custom-notification-sink';
import { Observable } from 'rxjs';
import { Keypair } from '@solana/web3.js';

type DataType = {
  cratio: number;
  healthRatio: number;
  resourceId: ResourceId;
};

const threshold = 0.5;

const consoleNotificationSink =
  new ConsoleNotificationSink<DialectNotification>();

const monitor: Monitor<DataType> = Monitors.builder({
  subscriberRepository: new DummySubscriberRepository(1),
  web2SubscriberRepository: new DummyWeb2SubscriberRepository(),
  sinks: {
    email: {
      senderEmail: 'hello@dialect.to',
      apiToken: process.env.EMAIL_SINK_TOKEN!,
    },
  },
})
  .defineDataSource<DataType>()
  .push(
    new Observable((subscriber) => {
      const publicKey = Keypair.generate().publicKey;
      const d1: SourceData<DataType> = {
        data: { cratio: 0, healthRatio: 2, resourceId: publicKey },
        groupingKey: publicKey.toBase58(),
      };
      const d2: SourceData<DataType> = {
        data: { cratio: 1, healthRatio: 0, resourceId: publicKey },
        groupingKey: publicKey.toBase58(),
      };
      subscriber.next(d1);
      subscriber.next(d2);
    }),
  )
  .transform<number, number>({
    keys: ['cratio'],
    pipelines: [
      Pipelines.threshold({
        type: 'rising-edge',
        threshold,
      }),
    ],
  })
  .notify()
  .email(
    ({ value }) => ({
      subject: '[WARNING] Cratio above warning threshold',
      text: `Your cratio = ${value} above warning threshold`,
    }),
    { strategy: 'unicast', to: (ctx) => ctx.origin.resourceId },
  )
  .dialectThread(
    ({ value }) => ({
      message: `Your cratio = ${value} above warning threshold`,
    }),
    { strategy: 'unicast', to: (ctx) => ctx.origin.resourceId },
  )
  .custom<DialectNotification>(
    ({ value }) => ({
      message: `Your cratio = ${value} above warning threshold`,
    }),
    consoleNotificationSink,
    { strategy: 'unicast', to: (ctx) => ctx.origin.resourceId },
  )
  .also()
  .dispatch('unicast')
  .build();
monitor.start();
