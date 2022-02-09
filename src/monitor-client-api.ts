import { Duration } from 'luxon';
import { EventDetectionPipeline, Monitor, ResourceId } from './monitor';

/**
 * A set of factory methods to create monitors
 */

export class Monitors {
  static builder<T extends object>(): SetDataSourceStep<T> {
    throw new Error();
  }
}

type KeysMatching<T extends object, V> = {
  [K in keyof T]: T[K] extends V ? K : never;
}[keyof T];

interface Transformation<T extends object, V> {
  parameters: KeysMatching<T, V>[];
  pipelines: EventDetectionPipeline<V>[];
}

interface SetDataSourceStep<T extends object> {
  pollDataFrom(
    dataSource: (subscribers: ResourceId[]) => ResourceData<T>[],
    pollInterval: Duration,
  ): AddTransformationStep<T>;
}

class SetDataSourceStepImpl<T extends object> implements SetDataSourceStep<T> {
  dataSource?: (subscribers: ResourceId[]) => ResourceData<T>[];
  pollInterval?: Duration;

  pollDataFrom(
    dataSource: (subscribers: ResourceId[]) => ResourceData<T>[],
    pollInterval: Duration,
  ): AddTransformationStep<T> {
    this.dataSource = dataSource;
    this.pollInterval = pollInterval;
    return new AddTransformationStepImpl();
  }
}

interface AddTransformationStep<T extends object> {
  transform<V>(transformation: Transformation<T, V>): AddTransformationStep<T>;

  dispatch(strategy: 'unicast'): BuildStep;
}

class AddTransformationStepImpl<T extends object>
  implements AddTransformationStep<T>
{
  transformations: Transformation<T, any>[] = [];

  transform<V>(transformation: Transformation<T, V>): AddTransformationStep<T> {
    this.transformations.push(transformation);
    return this;
  }

  dispatch(strategy: 'unicast' = 'unicast'): BuildStep {
    return new BuildStepImpl();
  }
}

interface BuildStep {
  build(): Monitor<any>;
}

class BuildStepImpl implements BuildStep {
  build(): Monitor<any> {
    throw new Error();
  }
}

export type ResourceData<T extends Object> = {
  resourceId: ResourceId;
  data: T;
};
