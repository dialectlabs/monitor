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
import { Observable } from 'rxjs';
import { Keypair, PublicKey } from '@solana/web3.js';

type DataType = {
  cratio: number;
  healthRatio: number;
  resourceId: ResourceId;
};

const threshold = 0.5;

const consoleNotificationSink =
  new ConsoleNotificationSink<DialectNotification>();

const dummySubscriberRepository = new DummySubscriberRepository(1);

const publicKey = Keypair.generate().publicKey;
// const publicKey = new PublicKey('AC...sf');

const monitor: Monitor<DataType> = Monitors.builder({
  subscriberRepository: dummySubscriberRepository,
  sinks: {
    solflare: {
      apiKey: process.env.SOLFLARE_SOLCAST_API_KEY!,
      // apiUrl: 'http://localhost:4000/v1',
    },
  },
})
  .defineDataSource<DataType>()
  .push(
    new Observable((subscriber) => {
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
  .solflare(
    ({ value }) => ({
      title: 'dApp cratio warning',
      body: `Your cratio = ${value} above warning threshold`,
      actionUrl: null,
    }),
    { dispatch: 'unicast', to: ({ origin }) => origin.resourceId },
  )
  .custom<DialectNotification>(
    ({ value }) => ({
      message: `Your cratio = ${value} above warning threshold`,
    }),
    consoleNotificationSink,
    { dispatch: 'unicast', to: ({ origin }) => origin.resourceId },
  )
  .and()
  .build();
monitor.start();
