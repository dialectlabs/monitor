import {
  DialectNotification,
  Monitors,
  Pipelines,
  SubscriberState,
} from '../src';
import { Keypair } from '@solana/web3.js';
import { DummySubscriberRepository } from './003-custom-subscriber-repository';
import { ConsoleNotificationSink } from './004-custom-notification-sink';

const dummySubscriberRepository = new DummySubscriberRepository();
const consoleNotificationSink =
  new ConsoleNotificationSink<DialectNotification>();
const monitor = Monitors.builder({
  subscriberRepository: dummySubscriberRepository,
})
  .subscriberEvents()
  .addTransformations<SubscriberState, SubscriberState>()
  .transform({
    keys: ['state'],
    pipelines: [Pipelines.notifyNewSubscribers()],
  })
  .notify()
  .custom<DialectNotification>(
    ({ context }) => ({
      message: `Hey ${context.resourceId}, welcome!`,
    }),
    consoleNotificationSink,
  )
  .and()
  .dispatch('unicast')
  .build();

monitor.start().then(() => {
  dummySubscriberRepository.addNewSubscriber(new Keypair().publicKey);
});
