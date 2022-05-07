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
import { Keypair } from '@solana/web3.js';

type DataType = {
  cratio: number;
  healthRatio: number;
};

const threshold = 0.5;

const consoleNotificationSink =
  new ConsoleNotificationSink<DialectNotification>();

const monitor: Monitor<DataType> = Monitors.builder({
  subscriberRepository: new DummySubscriberRepository(1),
  sinks: {
    sms: {
      twilioUsername: process.env.TWILIO_ACCOUNT_SID!,
      twilioPassword: process.env.TWILIO_AUTH_TOKEN!,
      senderSmsNumber: process.env.TWILIO_SMS_SENDER!,
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
  .sms(({ value }) => ({
    body: `[WARNING] Your cratio = ${value} above warning threshold`,
  }))
  .custom<DialectNotification>(
    ({ value }) => ({
      message: `Your cratio = ${value} above warning threshold`,
    }),
    consoleNotificationSink,
  )
  .also()
  .dispatch('unicast')
  .build();
monitor.start();
