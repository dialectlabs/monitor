import { Monitor, Monitors, Pipelines, ResourceId, SourceData } from '../src';
import { Duration } from 'luxon';

// 1. Common Dialect SDK imports
import {
  Dialect,
  DialectCloudEnvironment,
  DialectSdk,
} from '@dialectlabs/sdk';

// 2. Aptos-specific imports
import {
  Aptos,
  AptosSdkFactory,
  NodeDialectAptosWalletAdapter
} from '@dialectlabs/blockchain-sdk-aptos';


// 3. Create Dialect Aptos SDK
const environment: DialectCloudEnvironment = 'development';
const dialectAptosSdk: DialectSdk<Aptos> = Dialect.sdk(
  {
    environment,
  },
  AptosSdkFactory.create({
    // IMPORTANT: must set environment variable DIALECT_SDK_CREDENTIALS
    // to your dapp's Aptos messaging wallet keypair e.g. [170,23, . . . ,300]
    wallet: NodeDialectAptosWalletAdapter.create(),
  }),
);

// 4. Define a data type to monitor
type YourDataType = {
  cratio: number;
  healthRatio: number;
  resourceId: ResourceId;
};

const dataSourceMonitor: Monitor<YourDataType> = Monitors.builder({
  sdk: dialectAptosSdk,
  subscribersCacheTTL: Duration.fromObject({ seconds: 5 }),
})
  .defineDataSource<YourDataType>()
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
  .transform<number, number>({
    keys: ['cratio'],
    pipelines: [
      Pipelines.threshold({
        type: 'falling-edge',
        threshold: 0.5,
      }),
    ],
  })
  .notify()
  .dialectThread(
    ({ value }) => {
      return {
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
  .dialectThread(
    ({ value }) => {
      return {
        message: `Your cratio = ${value} above warning threshold`,
      };
    },
    {
      dispatch: 'unicast',
      to: ({ origin: { resourceId } }) => resourceId,
    },
  )
  .and()
  .build();
dataSourceMonitor.start();
