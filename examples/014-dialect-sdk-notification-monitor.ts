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
import {
  Dialect,
  Environment,
  NodeDialectWalletAdapter,
  SolanaNetwork,
} from '@dialectlabs/sdk';

type DataType = {
  cratio: number;
  healthRatio: number;
  resourceId: ResourceId;
};

const threshold = 0.5;

const sdk = Dialect.sdk({
  environment: process.env.ENVIROMENT! as Environment,
  solana: {
    rpcUrl: process.env.RPC_URL!,
    network: process.env.NETWORK_NAME! as SolanaNetwork,
  },
  // Note: You must first add your dapp to the Dialect Cloud
  //       See readme section TODO
  wallet: NodeDialectWalletAdapter.create(),
});

const consoleNotificationSink =
  new ConsoleNotificationSink<DialectNotification>();

const dummySubscriberRepository = new DummySubscriberRepository(1);

const publicKey = Keypair.generate().publicKey;

const monitor: Monitor<DataType> = Monitors.builder({
  sdk,
  subscriberRepository: dummySubscriberRepository,
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
  .notify({ notificationType: { id: 'fdsf' } })
  .dialectSdk(
    ({ value }) => ({
      title: 'dApp cratio warning',
      message: `Your cratio = ${value} above warning threshold`,
    }),
    { dispatch: 'unicast', to: ({ origin }) => origin.resourceId },
  )
  .dialectSdk(
    ({ value }) => ({
      title: 'dApp cratio warning',
      message: `Your cratio = ${value} above warning threshold`,
    }),
    { dispatch: 'multicast', to: ({ origin }) => [origin.resourceId] },
  )
  .dialectSdk(
    ({ value }) => ({
      title: 'dApp cratio warning',
      message: `Your cratio = ${value} above warning threshold`,
    }),
    { dispatch: 'broadcast' },
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
