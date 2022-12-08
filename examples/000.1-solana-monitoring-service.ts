import { Monitor, Monitors, Pipelines, ResourceId, SourceData } from '../src';
import { Duration } from 'luxon';

// 1. Common Dialect SDK imports
import {
  Dialect,
  DialectCloudEnvironment,
  DialectSdk,
} from '@dialectlabs/sdk';

// 2. Solana-specific imports
import {
  Solana,
  SolanaSdkFactory,
  NodeDialectSolanaWalletAdapter
} from '@dialectlabs/blockchain-sdk-solana';

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

// 4. Define a data type to monitor
type YourDataType = {
  cratio: number;
  healthRatio: number;
  resourceId: ResourceId;
};

// 5. Build a Monitor to detect and deliver notifications
const dataSourceMonitor: Monitor<YourDataType> = Monitors.builder({
  sdk: dialectSolanaSdk,
  subscribersCacheTTL: Duration.fromObject({ seconds: 5 }),
})
  // (5a) Define data source type
  .defineDataSource<YourDataType>()
  // (5b) Supply data to monitor, in this case by polling
  //      Do on- or off-chain data extraction here to monitor changing datasets
  //      .push also available, see example/007-pushy-data-source-monitor.ts
  .poll((subscribers: ResourceId[]) => {
    const sourceData: SourceData<YourDataType>[] = subscribers.map(
      (resourceId) => ({
        data: {
          cratio: Math.random(),
          healthRatio: Math.random(),
          resourceId,
        },
        groupingKey: resourceId.toString(),
      }),
    );
    return Promise.resolve(sourceData);
  }, Duration.fromObject({ seconds: 3 }))
  // (5c) Transform data source to detect events
  .transform<number, number>({
    keys: ['cratio'],
    pipelines: [
      Pipelines.threshold({
        type: 'falling-edge',
        threshold: 0.5,
      }),
    ],
  })
  // (5d) Add notification sinks for message delivery strategy
  //     Monitor has several sink types available out-of-the-box.
  //     You can also define your own sinks to deliver over custom channels
  //     (see examples/004-custom-notification-sink)
  //     Below, the dialectSdk sync is used, which handles logic to send
  //     notifications to all all (and only) the channels which has subscribers have enabled
  .notify()
  .dialectSdk(
    ({ value }) => {
      return {
        title: 'dApp cratio warning',
        message: `Your cratio = ${value} below warning threshold`,
      };
    },
    {
      dispatch: 'unicast',
      to: ({ origin: { resourceId } }) => resourceId,
    },
  )
  .also()
  .transform<number, number>({
    keys: ['cratio'],
    pipelines: [
      Pipelines.threshold({
        type: 'rising-edge',
        threshold: 0.5,
      }),
    ],
  })
  .notify()
  .dialectSdk(
    ({ value }) => {
      return {
        title: 'dApp cratio warning',
        message: `Your cratio = ${value} above warning threshold`,
      };
    },
    {
      dispatch: 'unicast',
      to: ({ origin: { resourceId } }) => resourceId,
    },
  )
  // (5e) Build the Monitor
  .and()
  .build();

// 6. Start the monitor
dataSourceMonitor.start();
