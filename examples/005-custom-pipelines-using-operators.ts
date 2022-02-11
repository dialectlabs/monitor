import {
  Data,
  Monitor,
  Monitors,
  Operators,
  Pipelines,
  PipeLogLevel,
  ResourceId,
  setPipeLogLevel,
} from '../src';
import { ConsoleNotificationSink } from './004-custom-notification-sink';
import { DummySubscriberRepository } from './003-custom-subscriber-repository';
import { Duration } from 'luxon';

type DataType = {
  cratio: number;
  healthRatio: number;
};

setPipeLogLevel(PipeLogLevel.INFO);

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
  }, Duration.fromObject({ seconds: 1 }))
  .transform<number>({
    keys: ['cratio'],
    pipelines: [
      Pipelines.createNew<number>((upstream) =>
        upstream
          .pipe(Operators.Utility.log(PipeLogLevel.INFO, 'upstream'))
          .pipe(Operators.Transform.getRaw())
          .pipe(Operators.Utility.log(PipeLogLevel.INFO, ' raw'))
          .pipe(
            ...Operators.Window.fixedTime<number>(
              Duration.fromObject({ seconds: 3 }),
            ),
          )
          .pipe(Operators.Utility.log(PipeLogLevel.INFO, '  time windowed'))
          .pipe(Operators.Aggregate.avg())
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
          .pipe(...Operators.Trigger.risingEdge(0.6))
          .pipe(Operators.Utility.log(PipeLogLevel.INFO, '      rising edge'))
          .pipe(
            Operators.Notification.info(
              'Example',
              (value) => `here's value exceeded 0.5: ${value}`,
            ),
          ),
      ),
    ],
  })
  .dispatch('unicast')
  .build();
monitor.start();
