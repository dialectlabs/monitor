import { Context, DialectNotification, Monitor, Monitors, Pipelines, ResourceId, SourceData } from '../src';
import { Duration } from 'luxon';
import { DummySubscriberRepository } from './003-custom-subscriber-repository';
import { ConsoleDataSink } from './004-custom-notification-sink';

type DataPool = {
  share: number;
};

let counter = 0;

const threshold = 5;

function getTriggerOutput(context: Context<DataPool>) {
  return context.trace.find((it) => it.type === 'trigger')?.output;
}

const consoleDataSink = new ConsoleDataSink<DialectNotification>();
const monitor: Monitor<DataPool> = Monitors.builder({
  subscriberRepository: new DummySubscriberRepository(1),
  notificationSink: consoleDataSink,
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
  .transform<number, number>({
    keys: ['share'],
    pipelines: [
      Pipelines.threshold({
        type: 'increase',
        threshold,
      }),
      Pipelines.threshold({
        type: 'increase',
        threshold,
      }),
    ],
  })
  .notify()
  .dialectThread((m) => ({ message: '11' }))
  .email((m) => ({ title: 'fas', message: '22' }))
  .and()
  .dispatch('unicast')
  .build();
monitor.start();
