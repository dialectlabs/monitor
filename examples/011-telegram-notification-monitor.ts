import {
  DialectNotification,
  Monitor,
  Monitors,
  Pipelines,
  ResourceId,
  SourceData,
} from '../src';
import { ResourceTelegram, ResourceTelegramChatIdRepository } from '../src/telegram-notification-sink';
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

class DummyResourceTelegramRepository implements ResourceTelegramChatIdRepository {
  findBy(resourceIds: ResourceId[]): Promise<ResourceTelegram[]> {
    return Promise.resolve([
      {
        resourceId: resourceIds[0],
        telegramChatId: process.env.TELEGRAM_TEST_CHAT_ID!,
      },
    ]);
  }
}
const monitor: Monitor<DataType> = Monitors.builder({
  subscriberRepository: new DummySubscriberRepository(1),
  sinks: {
    telegram: {
      telegramBotToken: process.env.TELEGRAM_BOT_KEY!,
      resourceTelegramChatIdRepository: new DummyResourceTelegramRepository(),
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
  .telegram(({ value }) => ({
    body: `[WARNING] Your cratio = ${value} above warning threshold`,
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
