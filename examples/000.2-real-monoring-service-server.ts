import { Monitor, Monitors, Pipelines, ResourceId, SourceData } from '../src';
import { Duration } from 'luxon';
import { Dialect, NodeDialectWalletAdapter } from '@dialectlabs/sdk';

type DataType = {
  cratio: number;
  healthRatio: number;
  resourceId: ResourceId;
};

const sdk = Dialect.sdk({
  environment: 'local-development',
  wallet: NodeDialectWalletAdapter.create(),
});

const dataSourceMonitor: Monitor<DataType> = Monitors.builder({
  sdk,
  subscribersCacheTTL: Duration.fromObject({ seconds: 5 }),
})
  .defineDataSource<DataType>()
  .poll((subscribers: ResourceId[]) => {
    const sourceData: SourceData<DataType>[] = subscribers.map(
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
