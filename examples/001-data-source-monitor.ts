import { Data, Monitor, Monitors, Pipelines, ResourceId } from '../src';
import { Duration } from 'luxon';
import { DummySubscriberRepository } from './003-custom-subscriber-repository';
import { ConsoleNotificationSink } from './004-custom-notification-sink';

type DataType = {
  cratio: number;
  healthRatio: number;
};

const THRESHOLD = 0.5;

const monitor: Monitor<DataType> = Monitors.builder({
  subscriberRepository: new DummySubscriberRepository(1),
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
  }, Duration.fromObject({ seconds: 1 }))
  .transform<number>({
    keys: ['cratio'],
    pipelines: [
      Pipelines.threshold(
        {
          type: 'falling-edge',
          threshold: 0.5,
        },
        {
          messageBuilder: (value) =>
            `Your cratio = ${value} below warning threshold`,
        },
      ),
      Pipelines.threshold(
        {
          type: 'rising-edge',
          threshold: 0.5,
        },
        {
          messageBuilder: (value) =>
            `Your cratio = ${value} above warning threshold`,
        },
      ),
    ],
  })
  .dispatch('unicast')
  .build();
monitor.start();
