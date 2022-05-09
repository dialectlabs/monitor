import {
  DialectNotification,
  Monitor,
  Monitors,
  Pipelines,
  ResourceId,
  SourceData,
} from '../src';
import { DummySubscriberRepository } from './003-custom-subscriber-repository';
import { ConsoleNotificationSink } from './004-custom-notification-sink';
import { Subject } from 'rxjs';
import { Keypair } from '@solana/web3.js';

type DataType = {
  cratio: number;
  healthRatio: number;
  resourceId: ResourceId;
};

const threshold = 0.5;

const consoleNotificationSink =
  new ConsoleNotificationSink<DialectNotification>();

const subject = new Subject<SourceData<DataType>>();

const monitor: Monitor<DataType> = Monitors.builder({
  subscriberRepository: new DummySubscriberRepository(1),
})
  .defineDataSource<DataType>()
  .push(subject)
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
  .custom<DialectNotification>(
    ({ value }) => ({
      message: `Your cratio = ${value} above warning threshold`,
    }),
    consoleNotificationSink,
    {
      dispatch: 'multicast',
      to: ({ origin: { resourceId } }) => [
        resourceId,
        Keypair.generate().publicKey,
      ],
    },
  )
  .and()
  .build();
monitor.start();

const publicKey = Keypair.generate().publicKey;
const d1: SourceData<DataType> = {
  data: { cratio: 0, healthRatio: 2, resourceId: publicKey },
  groupingKey: publicKey.toBase58(),
};
setTimeout(() => {
  subject.next(d1);
}, 100);

const d2: SourceData<DataType> = {
  data: { cratio: 1, healthRatio: 0, resourceId: publicKey },
  groupingKey: publicKey.toBase58(),
};
setTimeout(() => {
  subject.next(d2);
}, 200);
