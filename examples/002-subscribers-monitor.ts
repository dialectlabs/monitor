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
  .transform<SubscriberState, SubscriberState>({
    keys: ['state'],
    pipelines: [Pipelines.notifyNewSubscribers()],
  })
  .notify()
  .custom<DialectNotification>(
    ({
      context: {
        origin: { resourceId },
      },
    }) => ({
      message: `Hey ${resourceId}, welcome!`,
    }),
    consoleNotificationSink,
    { dispatch: 'unicast', to: ({ origin: { resourceId } }) => resourceId },
  )
  .and()
  .build();

monitor.start();

const pk = new Keypair().publicKey;

setTimeout(() => {
  dummySubscriberRepository.addNewSubscriber(pk);
}, 100);
