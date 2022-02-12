import { Monitors, Pipelines, SubscriberState } from '../src';
import { Keypair } from '@solana/web3.js';
import { ConsoleNotificationSink } from './004-custom-notification-sink';
import { DummySubscriberRepository } from './003-custom-subscriber-repository';

const dummySubscriberRepository = new DummySubscriberRepository();
const monitor = Monitors.builder({
  subscriberRepository: dummySubscriberRepository,
  notificationSink: new ConsoleNotificationSink(),
})
  .subscriberEvents()
  .transform<SubscriberState>({
    keys: ['state'],
    pipelines: [
      Pipelines.notifyNewSubscribers({
        messageBuilder: () => `Hi! Welcome onboard :)`,
      }),
    ],
  })
  .dispatch('unicast')
  .build();

monitor.start().then(() => {
  dummySubscriberRepository.addNewSubscriber(new Keypair().publicKey);
});
