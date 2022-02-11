import { Data, Monitor, Monitors, Pipelines, ResourceId } from '../src';
import { Duration } from 'luxon';
import { DummySubscriberRepository } from './003-custom-subscriber-repository';
import { ConsoleNotificationSink } from './004-custom-notification-sink';

type DataType = {
  cratio: number;
  healthRatio: number;
};

const monitor: Monitor<DataType> = Monitors.builder({
  subscriberRepository: new DummySubscriberRepository(),
  notificationSink: new ConsoleNotificationSink(),
})
  .defineDataSource<DataType>()
  .poll((subscribers: ResourceId[]) => {
    const data: Data<DataType>[] = subscribers.map((resourceId) => ({
      data: {
        cratio: Math.random(),
        healthRatio: Math.random() * 10,
      },
      resourceId,
    }));
    return Promise.resolve(data);
  }, Duration.fromObject({ seconds: 3 }))
  .transform<number>({
    keys: ['cratio'],
    pipelines: [
      Pipelines.threshold(
        {
          type: 'falling-edge',
          threshold: 0.5,
        },
        {
          title: 'Warning!',
          messageBuilder: (value) =>
            `Your cratio = ${value} below warning threshold`,
        },
        {
          type: 'throttle-time',
          timeSpan: Duration.fromObject({ minutes: 5 }),
        },
      ),
    ],
  })
  .transform<number>({
    keys: ['cratio'],
    pipelines: [
      Pipelines.averageInFixedSizeWindowThreshold(
        { type: 'fixed-size', size: 2 },
        {
          type: 'rising-edge',
          threshold: 0.5,
        },
        {
          title: 'Warning!',
          messageBuilder: (value) =>
            `Your cratio = ${value} above warning threshold`,
        },
      ),
    ],
  })
  .dispatch('unicast')
  .build();
monitor.start();
