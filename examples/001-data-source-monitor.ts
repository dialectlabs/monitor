import { Data, Monitor, Monitors, Pipelines, ResourceId } from '../src';
import { Duration } from 'luxon';
import { DummySubscriberRepository } from './003-custom-subscriber-repository';
import { ConsoleEventSink } from './004-custom-event-sink';

type DataType = {
  cratio: number;
  healthRatio: number;
  smth: string;
};

const monitor: Monitor<DataType> = Monitors.builder({
  subscriberRepository: new DummySubscriberRepository(),
  eventSink: new ConsoleEventSink(),
})
  .defineDataSource<DataType>()
  .poll((subscribers: ResourceId[]) => {
    const data: Data<DataType>[] = subscribers.map((resourceId) => ({
      data: {
        cratio: Math.random(),
        healthRatio: Math.random() * 10,
        smth: Math.random().toString(),
      },
      resourceId,
    }));
    return Promise.resolve(data);
  }, Duration.fromObject({ seconds: 3 }))
  .transform<number>({
    keys: ['cratio', 'healthRatio'],
    pipelines: [Pipelines.fallingEdge(111), Pipelines.risingEdge(150)],
  })
  .transform<string>({
    keys: ['smth'],
    pipelines: [Pipelines.forward()],
  })
  .dispatch('unicast')
  .build();
monitor.start();
