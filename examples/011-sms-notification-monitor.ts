import {
  DialectNotification,
  Monitor,
  Monitors,
  Pipelines,
  ResourceId,
  SourceData,
} from '../src';
import { ResourceSms, ResourceSmsNumberRepository } from '../src/twilio-sms-notification-sink';
import { DummySubscriberRepository } from './003-custom-subscriber-repository';
import { ConsoleNotificationSink } from './004-custom-notification-sink';
import { Observable } from 'rxjs';
import { Keypair } from '@solana/web3.js';
import twilio from 'twilio';

type DataType = {
  cratio: number;
  healthRatio: number;
};

const threshold = 0.5;

const consoleNotificationSink =
  new ConsoleNotificationSink<DialectNotification>();

class DummyResourceSmsRepository implements ResourceSmsNumberRepository {
  findBy(resourceIds: ResourceId[]): Promise<ResourceSms[]> {
    return Promise.resolve([
      {
        resourceId: resourceIds[0],
        smsNumber: process.env.SMS_RECEIVER!,
      },
    ]);
  }
}
const monitor: Monitor<DataType> = Monitors.builder({
  subscriberRepository: new DummySubscriberRepository(1),
  sinks: {
    sms: {
      twilioUsername: process.env.TWILIO_ACCOUNT_SID,
      twilioPassword: process.env.TWILIO_AUTH_TOKEN,
      senderSmsNumber: process.env.TWILIO_SMS_SENDER,
      resourceSmsNumberRepository: new DummyResourceSmsRepository(),
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
