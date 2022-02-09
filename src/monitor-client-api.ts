import { Duration } from 'luxon';
import { EventDetectionPipeline, Monitor, ResourceId } from './monitor';

/**
 * A set of factory methods to create monitors
 */

class MonitorsBuilderSteps<T extends Object> {
  setDataSourceStep?: SetDataSourceStepImpl<T>;
  addTransformationsStep?: AddTransformationsStepImpl<T>;
}

export class Monitors {
  static builder<T extends object>(): SetDataSourceStep<T> {
    const monitorsBuilderSteps = new MonitorsBuilderSteps<T>();
    return new SetDataSourceStepImpl(monitorsBuilderSteps);
  }
}

export type KeysMatching<T extends object, V> = {
  [K in keyof T]: T[K] extends V ? K : never;
}[keyof T];

export interface Transformation<T extends object, V> {
  parameters: KeysMatching<T, V>[];
  pipelines: EventDetectionPipeline<V>[];
}

interface SetDataSourceStep<T extends object> {
  pollDataFrom(
    dataSource: (subscribers: ResourceId[]) => ResourceData<T>[],
    pollInterval: Duration,
  ): AddTransformationsStep<T>;
}

class SetDataSourceStepImpl<T extends object> implements SetDataSourceStep<T> {
  dataSource?: (subscribers: ResourceId[]) => ResourceData<any>[];
  pollInterval?: Duration;

  constructor(private readonly monitorBuilderSteps: MonitorsBuilderSteps<T>) {
    monitorBuilderSteps.setDataSourceStep = this;
  }

  pollDataFrom(
    dataSource: (subscribers: ResourceId[]) => ResourceData<T>[],
    pollInterval: Duration,
  ): AddTransformationsStep<T> {
    this.dataSource = dataSource;
    this.pollInterval = pollInterval;
    return new AddTransformationsStepImpl(this.monitorBuilderSteps);
  }
}

interface AddTransformationsStep<T extends object> {
  transform<V>(transformation: Transformation<T, V>): AddTransformationsStep<T>;

  dispatch(strategy: 'unicast'): BuildStep<T>;
}

class AddTransformationsStepImpl<T extends object>
  implements AddTransformationsStep<T>
{
  transformations: Transformation<T, any>[] = [];
  dispatchStrategy?: 'unicast';

  constructor(private readonly monitorBuilderSteps: MonitorsBuilderSteps<T>) {
    monitorBuilderSteps.addTransformationsStep = this;
  }

  transform<V>(
    transformation: Transformation<T, V>,
  ): AddTransformationsStep<T> {
    this.transformations.push(transformation);
    return this;
  }

  dispatch(strategy: 'unicast' = 'unicast'): BuildStep<T> {
    this.dispatchStrategy = strategy;
    return new BuildStepImpl(this.monitorBuilderSteps);
  }
}

interface BuildStep<T extends object> {
  build(): Monitor<any>;
}

class BuildStepImpl<T extends object> implements BuildStep<T> {
  constructor(private readonly monitorBuilderSteps: MonitorsBuilderSteps<T>) {}

  build(): Monitor<any> {
    const { setDataSourceStep, addTransformationsStep } =
      this.monitorBuilderSteps;
    if (!setDataSourceStep || !addTransformationsStep) {
      throw new Error('Should not happen');
    }
    const { dataSource, pollInterval } = setDataSourceStep;
    const { transformations, dispatchStrategy } = addTransformationsStep;
    if (!dataSource || !pollInterval || transformations || dispatchStrategy) {
      throw new Error('Should not happen');
    }

    throw new Error();
  }
}

export type ResourceData<T extends Object> = {
  resourceId: ResourceId;
  data: T;
};
