import {
  AddTransformationsStep,
  BuildStep,
  ChooseDataSourceStep,
  DefineDataSourceStep,
  KeysMatching,
  MonitorBuilderProps,
  Transformation,
} from '../monitor-builder';
import { Data, Event, SubscriberEvent } from '../data-model';
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
  constructor(readonly builderProps: MonitorBuilderProps) {
    console.log('fads');
  }

  chooseDataSourceStep?: ChooseDataSourceStepImpl;
  defineDataSourceStep?: DefineDataSourceStepImpl<T>;
  addTransformationsStep?: AddTransformationsStepImpl<T>;
}

type DataSourceType = 'user-defined' | 'subscriber-events';

export class ChooseDataSourceStepImpl implements ChooseDataSourceStep {
  dataSourceType?: DataSourceType;

  constructor(readonly builderProps: MonitorBuilderProps) {}

  subscriberEvents(): AddTransformationsStep<SubscriberEvent> {
    this.dataSourceType = 'subscriber-events';
    const monitorsBuilderState = new MonitorsBuilderState<SubscriberEvent>(
      this.builderProps,
    );
    monitorsBuilderState.chooseDataSourceStep = this;
    return new AddTransformationsStepImpl<SubscriberEvent>(
      monitorsBuilderState,
    );
  }

  defineDataSource<T extends object>(): DefineDataSourceStep<T> {
    this.dataSourceType = 'user-defined';
    const monitorsBuilderState = new MonitorsBuilderState<T>(this.builderProps);
    monitorsBuilderState.chooseDataSourceStep = this;
    return new DefineDataSourceStepImpl<T>(monitorsBuilderState);
  }
}

export class DefineDataSourceStepImpl<T extends object>
  implements DefineDataSourceStep<T>
{
  pollableDataSource?: PollableDataSource<T>;
  pollInterval?: Duration;

  constructor(private readonly monitorBuilderState: MonitorsBuilderState<T>) {
    monitorBuilderState.defineDataSourceStep = this;
  }

  poll(
    dataSource: PollableDataSource<T>,
    pollInterval: Duration,
  ): AddTransformationsStep<T> {
    this.pollableDataSource = dataSource;
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
    const adaptedToDataSourceTypePipelines = keys.flatMap(
      (key: KeysMatching<T, V>) =>
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
    this.dataSourceTransformationPipelines.push(
      ...adaptedToDataSourceTypePipelines,
    );
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
    const {
      builderProps,
      chooseDataSourceStep,
      defineDataSourceStep,
      addTransformationsStep,
    } = this.monitorBuilderState;

    if (!builderProps || !chooseDataSourceStep || !addTransformationsStep) {
      throw new Error(
        'Expected [builderProps, chooseDataSourceStep, addTransformationsStep] to be defined',
      );
    }
    switch (chooseDataSourceStep.dataSourceType) {
      case 'user-defined': {
        if (!defineDataSourceStep) {
          throw new Error('Expected data source to be defined');
        }
        return this.createUserDefinedMonitor(
          defineDataSourceStep,
          addTransformationsStep,
          builderProps,
        );
      }
      case 'subscriber-events': {
        return this.buildSubscriberEventMonitor(
          addTransformationsStep,
          builderProps,
        );
      }
      default: {
        throw new Error(
          `Unexpected data source type: ${chooseDataSourceStep.dataSourceType}`,
        );
      }
    }
  }

  private buildSubscriberEventMonitor(
    addTransformationsStep: AddTransformationsStepImpl<T>,
    builderProps: MonitorBuilderProps,
  ) {
    const { dataSourceTransformationPipelines, dispatchStrategy } =
      addTransformationsStep;
    if (!dataSourceTransformationPipelines || !dispatchStrategy) {
      throw new Error(
        'Expected [dataSourceTransformationPipelines, dispatchStrategy] to be defined',
      );
    }
    return Monitors.factory(builderProps).createSubscriberEventMonitor(
      dataSourceTransformationPipelines as DataSourceTransformationPipeline<SubscriberEvent>[],
    );
  }

  private createUserDefinedMonitor(
    defineDataSourceStep: DefineDataSourceStepImpl<T>,
    addTransformationsStep: AddTransformationsStepImpl<T>,
    builderProps: MonitorBuilderProps,
  ) {
    const { pollableDataSource, pollInterval } = defineDataSourceStep;
    const { dataSourceTransformationPipelines, dispatchStrategy } =
      addTransformationsStep;
    if (
      !pollableDataSource ||
      !pollInterval ||
      !dataSourceTransformationPipelines ||
      !dispatchStrategy
    ) {
      throw new Error(
        'Expected [pollableDataSource, pollInterval, dataSourceTransformationPipelines, dispatchStrategy] to be defined',
      );
    }
    return Monitors.factory(builderProps).createUnicastMonitor<T>(
      pollableDataSource,
      dataSourceTransformationPipelines,
      pollInterval,
    );
  }
}
