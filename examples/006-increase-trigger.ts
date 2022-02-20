import {
  Context,
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
};

let counter = 0;

const threshold = 5;

function getTriggerOutput(context: Context<DataPool>) {
  return context.trace.find((it) => it.type === 'trigger')?.output;
}

const monitor: Monitor<DataPool> = Monitors.builder({
  subscriberRepository: new DummySubscriberRepository(1),
  notificationSink: new ConsoleNotificationSink(),
})
  .defineDataSource<DataPool>()
  .poll((subscribers: ResourceId[]) => {
    const sourceData: SourceData<DataPool>[] = subscribers.map(
      (resourceId) => ({
        data: {
          share: counter * counter,
        },
        resourceId,
      }),
    );
    counter++;
    return Promise.resolve(sourceData);
  }, Duration.fromObject({ seconds: 1 }))
  .transform<number>({
    keys: ['share'],
    pipelines: [
      Pipelines.threshold(
        {
          type: 'increase',
          threshold,
        },
        {
          messageBuilder: ({ value, context }) =>
            `Your share = ${value} increased by ${getTriggerOutput(
              context,
            )}, which is above the threshold ${threshold}`,
        },
      ),
    ],
  })
  .dispatch('unicast')
  .build();
monitor.start();