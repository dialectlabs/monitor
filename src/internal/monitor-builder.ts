import {
  AddDataSourceStep,
  AddTransformationsStep,
  BuildStep,
  KeysMatching,
  MonitorBuilderProps,
  Transformation,
} from '../monitor-builder';
import { Data, Event } from '../data-model';
import {
  DataSourceTransformationPipeline,
  PollableDataSource,
  PushyDataSource,
} from '../ports';
import { Duration } from 'luxon';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { Monitor, Monitors } from '../monitor-api';

/**
 * A set of factory methods to create monitors
 */
export class MonitorsBuilderState<T extends Object> {
  constructor(readonly builderProps: MonitorBuilderProps) {}

  addDataSourceStep?: SetDataSourceStepImpl<T>;
  addTransformationsStep?: AddTransformationsStepImpl<T>;
}

export class SetDataSourceStepImpl<T extends object>
  implements AddDataSourceStep<T>
{
  dataSource?: PollableDataSource<T>;
  pollInterval?: Duration;

  constructor(private readonly monitorBuilderState: MonitorsBuilderState<T>) {
    monitorBuilderState.addDataSourceStep = this;
  }

  pollDataFrom(
    dataSource: PollableDataSource<T>,
    pollInterval: Duration,
  ): AddTransformationsStep<T> {
    this.dataSource = dataSource;
    this.pollInterval = pollInterval;
    return new AddTransformationsStepImpl(this.monitorBuilderState);
  }
}

class AddTransformationsStepImpl<T extends object>
  implements AddTransformationsStep<T>
{
  transformations: Transformation<T, unknown>[] = [];
  dataSourceTransformationPipelines: DataSourceTransformationPipeline<T>[] = [];
  dispatchStrategy?: 'unicast';

  constructor(private readonly monitorBuilderState: MonitorsBuilderState<T>) {
    monitorBuilderState.addTransformationsStep = this;
  }

  transform<V>(
    transformation: Transformation<T, V>,
  ): AddTransformationsStep<T> {
    const { keys, pipelines } = transformation;
    const composedPipelines = keys.flatMap((key: KeysMatching<T, V>) =>
      pipelines.map(
        (pipeline: (source: Observable<Data<V>>) => Observable<Event>) => {
          const adaptedToDataSourceType: (
            dataSource: PushyDataSource<T>,
          ) => Observable<Event> = (dataSource: PushyDataSource<T>) =>
            pipeline(
              dataSource.pipe(
                map(({ data, resourceId }) => ({
                  resourceId,
                  data: data[key] as unknown as V,
                })),
              ),
            );
          return adaptedToDataSourceType;
        },
      ),
    );
    this.dataSourceTransformationPipelines.push(...composedPipelines);
    this.transformations.push(transformation as Transformation<T, unknown>);
    return this;
  }

  dispatch(strategy: 'unicast' = 'unicast'): BuildStep<T> {
    this.dispatchStrategy = strategy;
    return new BuildStepImpl(this.monitorBuilderState);
  }
}

class BuildStepImpl<T extends object> implements BuildStep<T> {
  constructor(private readonly monitorBuilderState: MonitorsBuilderState<T>) {}

  build(): Monitor<T> {
    const { builderProps, addDataSourceStep, addTransformationsStep } =
      this.monitorBuilderState;
    if (!builderProps || !addDataSourceStep || !addTransformationsStep) {
      throw new Error('Should not happen');
    }
    const { dataSource, pollInterval } = addDataSourceStep;
    const {
      transformations,
      dataSourceTransformationPipelines,
      dispatchStrategy,
    } = addTransformationsStep;
    if (
      !dataSource ||
      !pollInterval ||
      !transformations ||
      !dataSourceTransformationPipelines ||
      !dispatchStrategy
    ) {
      throw new Error('Should not happen');
    }
    return Monitors.factory(builderProps).createUnicastMonitor<T>(
      dataSource,
      dataSourceTransformationPipelines,
      pollInterval,
    );
  }
}
