import { Monitors, Pipelines, SubscriberState } from '../src';
import { Keypair } from '@solana/web3.js';
import { ConsoleEventSink } from './004-custom-event-sink';
import { DummySubscriberRepository } from './003-custom-subscriber-repository';

const dummySubscriberRepository = new DummySubscriberRepository();
const monitor = Monitors.builder({
  subscriberRepository: dummySubscriberRepository,
  eventSink: new ConsoleEventSink(),
})
  .subscriberEvents()
  .transform<SubscriberState>({
    keys: ['state'],
    pipelines: [
      Pipelines.sendMessageToNewSubscriber({
        title: 'Welcome title',
        messageBuilder: () => `Hi! Welcome onboard :)`,
      }),
    ],
  })
  .dispatch('unicast')
  .build();

monitor.start().then(() => {
  dummySubscriberRepository.addNewSubscriber(new Keypair().publicKey);
});
