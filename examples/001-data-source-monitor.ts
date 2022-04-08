import {
  DialectNotification,
  Monitor,
  Monitors,
  Pipelines,
  ResourceId,
  SourceData,
} from '../src';
import { Duration } from 'luxon';
import { DummySubscriberRepository } from './003-custom-subscriber-repository';
import { ConsoleNotificationSink } from './004-custom-notification-sink';

type DataType = {
  cratio: number;
  healthRatio: number;
};

const threshold = 0.5;

const consoleNotificationSink =
  new ConsoleNotificationSink<DialectNotification>();
const dummySubscriberRepository = new DummySubscriberRepository(2);
const monitor: Monitor<DataType> = Monitors.builder({
  subscriberRepository: dummySubscriberRepository,
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
  .transform<number, number>({
    keys: ['cratio'],
    pipelines: [
      Pipelines.threshold({
        type: 'falling-edge',
        threshold,
      }),
    ],
  })
  .notify()
  .custom<DialectNotification>(
    ({ value }) => ({
      message: `Your cratio = ${value} below warning threshold`,
    }),
    consoleNotificationSink,
  )
  .and()
  .transform<number, number>({
    keys: ['cratio'],
    pipelines: [
      Pipelines.threshold({
        type: 'rising-edge',
        threshold,
      }),
    ],
  })
  .notify()
  .custom<DialectNotification>(
    ({ value }) => ({
      message: `Your cratio = ${value} above warning threshold`,
    }),
    consoleNotificationSink,
    () => Math.random() > 0.5,
  )
  .and()
  .dispatch('broadcast')
  .build();
monitor.start();
