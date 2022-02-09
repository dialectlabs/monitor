import { Duration } from 'luxon';

import { Pipelines } from './pipelines';
import { Monitors } from './monitor-client-api';
import { ResourceId } from './monitor';

type DataType = {
  cratio: number;
  cratio2: number;
  smth: string;
};

const monitor = Monitors.builder<DataType>()
  .pollDataFrom(
    (subscribers: ResourceId[]) => [
      {
        data: {
          smth: '31231',
          cratio: 312,
          cratio2: 331,
        },
        resourceId: subscribers[0],
      },
    ],
    Duration.fromObject({ seconds: 10 }),
  )
  .transform<number>({
    parameters: ['cratio', 'cratio2'],
    pipelines: [Pipelines.fallingEdge(111), Pipelines.risingEdge(150)],
  })
  .transform<string>({
    parameters: ['smth'],
    pipelines: [Pipelines.forward()],
  })
  .dispatch('unicast')
  .build();
