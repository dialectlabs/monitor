import { Monitor, Monitors, Pipelines, ResourceId, SourceData } from '../src';
import { Duration } from 'luxon';
import { DummySubscriberRepository } from './003-custom-subscriber-repository';
import { ConsoleDataSink } from './004-custom-notification-sink';

type DataType = {
  cratio: number;
  healthRatio: number;
};

const threshold = 0.5;

const monitor: Monitor<DataType> = Monitors.builder({
  subscriberRepository: new DummySubscriberRepository(1),
  notificationSink: new ConsoleDataSink(),
})
  .defineDataSource<DataType>()
  .poll((subscribers: ResourceId[]) => {
    const sourceData: SourceData<DataType>[] = subscribers.map(
      (resourceId) => ({
        data: {
          cratio: Math.random(),
          healthRatio: Math.random() * 10,
        },
        resourceId,
      }),
    );
    return Promise.resolve(sourceData);
  }, Duration.fromObject({ seconds: 1 }))
  .transform<number>({
    keys: ['cratio'],
    pipelines: [
      Pipelines.threshold(
        {
          type: 'falling-edge',
          threshold,
        },
        {
          messageBuilder: ({ value, context: { origin } }) =>
            `Your cratio = ${value} below warning threshold`,
        },
      ),
      Pipelines.threshold(
        {
          type: 'rising-edge',
          threshold,
        },
        {
          messageBuilder: ({ value, context }) =>
            `Your cratio = ${value} above warning threshold`,
        },
      ),
    ],
  })
  .dispatch('unicast')
  .build();
monitor.start();
