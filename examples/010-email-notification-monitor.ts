import {
  DialectNotification,
  Monitor,
  Monitors,
  Pipelines,
  ResourceEmail,
  ResourceEmailRepository,
  ResourceId,
  SourceData,
} from '../src';
import { DummySubscriberRepository } from './003-custom-subscriber-repository';
import { ConsoleNotificationSink } from './004-custom-notification-sink';
import { Observable } from 'rxjs';
import { Keypair } from '@solana/web3.js';

type DataType = {
  cratio: number;
  healthRatio: number;
};

const threshold = 0.5;

const consoleNotificationSink =
  new ConsoleNotificationSink<DialectNotification>();

class DummyResourceEmailRepository implements ResourceEmailRepository {
  findBy(resourceIds: ResourceId[]): Promise<ResourceEmail[]> {
    return Promise.resolve([
      {
        resourceId: resourceIds[0],
        email: 'tsymbal.aleksey@gmail.com',
      },
    ]);
  }
}
const monitor: Monitor<DataType> = Monitors.builder({
  subscriberRepository: new DummySubscriberRepository(1),
  sinks: {
    email: {
      senderEmail: 'hello@dialect.to',
      apiToken: process.env.EMAIL_SINK_TOKEN!,
      resourceEmailRepository: new DummyResourceEmailRepository(),
    },
  },
})
  .defineDataSource<DataType>()
  .push(
    new Observable((subscriber) => {
      const publicKey = Keypair.generate().publicKey;
      const d1: SourceData<DataType> = {
        data: { cratio: 0, healthRatio: 2 },
        resourceId: publicKey,
      };
      const d2: SourceData<DataType> = {
        data: { cratio: 1, healthRatio: 0 },
        resourceId: publicKey,
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
  .email(({ value }) => ({
    subject: '[WARNING] Cratio above warning threshold',
    text: `Your cratio = ${value} above warning threshold`,
  }))
  .dialectThread(({ value }) => ({
    message: `Your cratio = ${value} above warning threshold`,
  }))
  .custom<DialectNotification>(
    ({ value }) => ({
      message: `Your cratio = ${value} above warning threshold`,
    }),
    consoleNotificationSink,
  )
  .and()
  .dispatch('unicast')
  .build();
monitor.start();
