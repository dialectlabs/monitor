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

// Common Dialect SDK imports
import {
  DappMessageActionType,
  Dialect,
  DialectCloudEnvironment,
  DialectSdk,
} from '@dialectlabs/sdk';

// Solana-specific imports
import {
  NodeDialectSolanaWalletAdapter,
  Solana,
  SolanaSdkFactory,
} from '@dialectlabs/blockchain-sdk-solana';

type DataType = {
  cratio: number;
  healthRatio: number;
  resourceId: ResourceId;
};

const threshold = 0.5;

// 3. Create Dialect Solana SDK
const environment: DialectCloudEnvironment = 'development';
const dialectSolanaSdk: DialectSdk<Solana> = Dialect.sdk(
  {
    environment,
  },
  SolanaSdkFactory.create({
    // IMPORTANT: must set environment variable DIALECT_SDK_CREDENTIALS
    // to your dapp's Solana messaging wallet keypair e.g. [170,23, . . . ,300]
    wallet: NodeDialectSolanaWalletAdapter.create(),
  }),
);

const consoleNotificationSink =
  new ConsoleNotificationSink<DialectNotification>();

const dummySubscriberRepository = new DummySubscriberRepository(1);

const publicKey = Keypair.generate().publicKey;

const monitor: Monitor<DataType> = Monitors.builder({
  sdk: dialectSolanaSdk,
  // subscriberRepository: dummySubscriberRepository,
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
  .notify({
    type: {
      id: '434ee971-44ad-4021-98fe-3140a627bca8',
    },
  })
  .dialectSdk(
    ({ value }) => ({
      title: 'dApp cratio warning',
      message: `Your cratio = ${value} above warning threshold`,
    }),
    {
      dispatch: 'unicast',
      to: ({ origin }) =>
        new PublicKey('6MKeaLnTnhXM6Qo8gHEgbeqeoUqbg4Re4FL5UHXMjetJ'),
    },
  )
  .dialectSdk(
    ({ value }) => ({
      title: 'dApp cratio warning',
      message: `Your cratio = ${value} above warning threshold`,
    }),
    {
      dispatch: 'unicast',
      to: ({ origin }) =>
        new PublicKey('6MKeaLnTnhXM6Qo8gHEgbeqeoUqbg4Re4FL5UHXMjetJ'),
    },
  )
  .dialectSdk(
    ({ value }) => ({
      title: 'dApp cratio warning',
      message: `Your cratio = ${value} above warning threshold`,
      actions: {
        type: DappMessageActionType.LINK,
        links: [
          {
            url: 'https://dialect.to/',
            label: 'Open Dialect',
          },
        ],
      },
    }),
    {
      dispatch: 'unicast',
      to: ({ origin }) =>
        new PublicKey('6MKeaLnTnhXM6Qo8gHEgbeqeoUqbg4Re4FL5UHXMjetJ'),
    },
  )
  .custom<DialectNotification>(
    ({ value }) => ({
      message: `Your cratio = ${value} above warning threshold`,
    }),
    consoleNotificationSink,
    {
      dispatch: 'unicast',
      to: ({ origin }) =>
        new PublicKey('6MKeaLnTnhXM6Qo8gHEgbeqeoUqbg4Re4FL5UHXMjetJ'),
    },
  )
  .and()
  .build();
monitor.start();
