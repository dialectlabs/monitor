import {
  DialectNotification,
  Diff,
  Monitor,
  Monitors,
  Pipelines,
  ResourceId,
  SourceData,
} from '../src';
import { DummySubscriberRepository } from './003-custom-subscriber-repository';
import { ConsoleNotificationSink } from './004-custom-notification-sink';
import { AsyncSubject, Observable, Subject } from 'rxjs';
import { Keypair, PublicKey } from '@solana/web3.js';

type DataType = {
  attribute: NestedObject[];
  resourceId: ResourceId;
};

interface NestedObject {
  publicKey: PublicKey;
}

const consoleNotificationSink =
  new ConsoleNotificationSink<DialectNotification>();

const subject = new Subject<SourceData<DataType>>();

const monitor: Monitor<DataType> = Monitors.builder({
  subscriberRepository: new DummySubscriberRepository(3),
})
  .defineDataSource<DataType>()
  .push(subject)
  .transform<NestedObject[], Diff<NestedObject>>({
    keys: ['attribute'],
    pipelines: [Pipelines.diff((e1, e2) => e1.publicKey.equals(e2.publicKey))],
  })
  .notify()
  .custom<DialectNotification>(
    ({ value }) => ({
      message: `Added: ${value.added.map(
        (it) => it.publicKey,
      )}, removed: ${value.removed.map((it) => it.publicKey)}`,
    }),
    consoleNotificationSink,
    { strategy: 'unicast', to: ({ origin: { resourceId } }) => resourceId },
  )
  .also()
  .transform<NestedObject[], NestedObject[]>({
    keys: ['attribute'],
    pipelines: [Pipelines.added((e1, e2) => e1.publicKey.equals(e2.publicKey))],
  })
  .notify()
  .custom<DialectNotification>(
    ({ value }) => ({
      message: `Added: ${value.map((it) => it.publicKey)}`,
    }),
    consoleNotificationSink,
    { strategy: 'unicast', to: ({ origin: { resourceId } }) => resourceId },
  )
  .and()
  .build();
monitor.start();

const publicKey = Keypair.generate().publicKey;
const pk1 = new Keypair().publicKey;
const pk2 = new Keypair().publicKey;
const pk3 = new Keypair().publicKey;

console.log(pk1.toBase58(), pk2.toBase58(), pk3.toBase58());
const d1: SourceData<DataType> = {
  data: { attribute: [{ publicKey: pk1 }, { publicKey: pk2 }] },
  groupingKey: publicKey.toBase58(),
};
const d2: SourceData<DataType> = {
  data: { attribute: [{ publicKey: pk3 }] },
  groupingKey: publicKey.toBase58(),
};
setTimeout(() => {
  subject.next(d1);
}, 500);

setTimeout(() => {
  subject.next(d2);
}, 1000);

setTimeout(() => {
  subject.next(d1);
}, 1500);
