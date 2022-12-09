import {
  Change,
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
import { Keypair, PublicKey } from '@solana/web3.js';

type DataType = {
  attribute: PublicKey;
  resourceId: ResourceId;
};

const consoleNotificationSink =
  new ConsoleNotificationSink<DialectNotification>();

const subject = new Subject<SourceData<DataType>>();

const monitor: Monitor<DataType> = Monitors.builder({
  subscriberRepository: new DummySubscriberRepository(3),
})
  .defineDataSource<DataType>()
  .push(subject)
  .transform<PublicKey, Change<PublicKey>>({
    keys: ['attribute'],
    pipelines: [Pipelines.change((e1, e2) => e1.equals(e2))],
  })
  .notify()
  .custom<DialectNotification>(
    ({ value, context }) => ({
      message: `Changed from: ${value.prev.toBase58()} to ${value.current.toBase58()}, origin: ${JSON.stringify(
        context.origin,
      )}`,
    }),
    consoleNotificationSink,
    { dispatch: 'unicast', to: ({ origin: { resourceId } }) => resourceId },
  )
  .and()
  .build();
monitor.start();

const publicKey = Keypair.generate().publicKey;
const pk1 = new Keypair().publicKey;
const pk2 = new Keypair().publicKey;

console.log(pk1.toBase58(), pk2.toBase58());
const d1: SourceData<DataType> = {
  data: {
    attribute: pk1,
    resourceId: publicKey,
  },
  groupingKey: publicKey.toBase58(),
};
const d2: SourceData<DataType> = {
  data: {
    attribute: pk2,
    resourceId: publicKey,
  },
  groupingKey: publicKey.toBase58(),
};
setTimeout(() => {
  subject.next(d1);
}, 500);

setTimeout(() => {
  subject.next(d2);
}, 1000);

setTimeout(() => {
  subject.next(d2);
}, 1500);

setTimeout(() => {
  subject.next(d1);
}, 2000);
