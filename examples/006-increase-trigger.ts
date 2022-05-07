import {
  Context,
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

type DataPool = {
  share: number;
  resourceId: ResourceId;
};

let counter = 0;

const threshold = 5;

function getTriggerOutput(context: Context<DataPool>) {
  return context.trace.find((it) => it.type === 'trigger')?.output;
}

const consoleDataSink = new ConsoleNotificationSink<DialectNotification>();
const monitor: Monitor<DataPool> = Monitors.builder({
  subscriberRepository: new DummySubscriberRepository(2),
})
  .defineDataSource<DataPool>()
  .poll((subscribers: ResourceId[]) => {
    // subscribers are only those users who created a dialect thread!
    const sourceData: SourceData<DataPool>[] = subscribers.map(
      (resourceId) => ({
        data: {
          share: counter * counter,
          resourceId,
        },
        groupingKey: resourceId.toBase58(),
      }),
    );
    counter++;
    return Promise.resolve(sourceData);
  }, Duration.fromObject({ seconds: 1 }))
  .transform<number, number>({
    keys: ['share'],
    pipelines: [
      Pipelines.threshold({
        type: 'increase',
        threshold: 1,
      }),
    ],
  })
  .notify()
  .custom<DialectNotification>(
    ({ value, context }) => ({
      message: `Value: ${value} increase by ${getTriggerOutput(context)} `,
    }),
    consoleDataSink,
    { strategy: 'broadcast' },
  )
  .and()
  .build();
monitor.start();
