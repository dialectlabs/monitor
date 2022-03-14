import {
  DialectNotification,
  Monitor,
  Monitors,
  Operators,
  Pipelines,
  PipeLogLevel,
  ResourceId,
  setPipeLogLevel,
  SourceData,
} from '../src';
import { ConsoleNotificationSink } from './004-custom-notification-sink';
import { DummySubscriberRepository } from './003-custom-subscriber-repository';
import { Duration } from 'luxon';

type DataType = {
  cratio: number;
  healthRatio: number;
};

setPipeLogLevel(PipeLogLevel.INFO);

const consoleNotificationSink =
  new ConsoleNotificationSink<DialectNotification>();
const monitor: Monitor<DataType> = Monitors.builder({
  subscriberRepository: new DummySubscriberRepository(),
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
  .addTransformations<number, number>()
  .transform({
    keys: ['cratio'],
    pipelines: [
      Pipelines.createNew<number, DataType, number>((upstream) =>
        upstream
          .pipe(Operators.Utility.log(PipeLogLevel.INFO, 'upstream'))
          .pipe(
            ...Operators.Window.fixedTime<number, DataType>(
              Duration.fromObject({ seconds: 3 }),
            ),
          )
          .pipe(Operators.Utility.log(PipeLogLevel.INFO, '  time windowed'))
          .pipe(Operators.Aggregate.avg<DataType>())
          .pipe(
            Operators.Utility.log(PipeLogLevel.INFO, '   time windowed avg'),
          )
          .pipe(Operators.Window.fixedSizeSliding(5))
          .pipe(
            Operators.Utility.log(PipeLogLevel.INFO, '    sliding windowed'),
          )
          .pipe(Operators.Aggregate.max())
          .pipe(
            Operators.Utility.log(
              PipeLogLevel.INFO,
              '     sliding windowed max',
            ),
          )
          .pipe(...Operators.Trigger.risingEdge<DataType>(0.6))
          .pipe(Operators.Utility.log(PipeLogLevel.INFO, '      rising edge')),
      ),
    ],
  })
  .notify()
  .custom<DialectNotification>(
    ({ value }) => ({
      message: `        notification ${value}`,
    }),
    consoleNotificationSink,
  )
  .and()
  .dispatch('unicast')
  .build();
monitor.start();
