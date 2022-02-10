import { Duration } from 'luxon';
import {
  Event,
  EventSink,
  Monitor,
  MonitorEventDetectionPipeline,
  MonitorsInternal,
  PollableDataSource,
  SubscriberRepository,
} from './monitor';
import { Program } from '@project-serum/anchor';
import { Keypair } from '@solana/web3.js';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { DeveloperFacingEventDetectionPipeline } from './pipelines';

export interface MonitorBuilderProps {
  dialectProgram?: Program;
  monitorKeypair?: Keypair;
  eventSink?: EventSink;
  subscriberRepository?: SubscriberRepository;
}

/**
 * A set of factory methods to create monitors
 */

class MonitorsBuilderState<T extends Object> {
  constructor(readonly builderProps: MonitorBuilderProps) {}

  setDataSourceStep?: SetDataSourceStepImpl<T>;
  addTransformationsStep?: AddTransformationsStepImpl<T>;
}

export class Monitors {
  static builder<T extends object>(
    builderProps: MonitorBuilderProps,
  ): SetDataSourceStep<T> {
    const monitorsBuilderSteps = new MonitorsBuilderState<T>(builderProps);
    return new SetDataSourceStepImpl(monitorsBuilderSteps);
  }
}

export type KeysMatching<T extends object, V> = {
  [K in keyof T]: T[K] extends V ? K : never;
}[keyof T];

export interface Transformation<T extends object, V> {
  keys: KeysMatching<T, V>[];
  pipelines: DeveloperFacingEventDetectionPipeline<V>[];
}

interface SetDataSourceStep<T extends object> {
  pollDataFrom(
    dataSource: PollableDataSource<T>,
    pollInterval: Duration,
  ): AddTransformationsStep<T>;
}

class SetDataSourceStepImpl<T extends object> implements SetDataSourceStep<T> {
  dataSource?: PollableDataSource<T>;
  pollInterval?: Duration;

  constructor(private readonly monitorBuilderSteps: MonitorsBuilderState<T>) {
    monitorBuilderSteps.setDataSourceStep = this;
  }

  pollDataFrom(
    dataSource: PollableDataSource<T>,
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
  transformations: Transformation<T, unknown>[] = [];
  composedPipelines: MonitorEventDetectionPipeline<T>[] = [];
  dispatchStrategy?: 'unicast';

  constructor(private readonly monitorBuilderSteps: MonitorsBuilderState<T>) {
    monitorBuilderSteps.addTransformationsStep = this;
  }

  transform<V>(
    transformation: Transformation<T, V>,
  ): AddTransformationsStep<T> {
    const { keys, pipelines } = transformation;
    const composedPipelines = keys.flatMap((key: KeysMatching<T, V>) =>
      pipelines.map(
        (
          singleKeyProcessingPipeline: (
            source: Observable<V>,
          ) => Observable<Event>,
        ) => {
          const composedPipeline: (
            dataSource: Observable<T>,
          ) => Observable<Event> = (dataSource: Observable<T>) =>
            singleKeyProcessingPipeline(
              dataSource.pipe(
                map((it: T) => {
                  // @ts-ignore // TODO: how to avoid ts-ignore?
                  return it[key] as V;
                }),
              ),
            );
          return composedPipeline;
        },
      ),
    );
    this.composedPipelines.push(...composedPipelines);
    this.transformations.push(transformation as Transformation<T, unknown>);
    return this;
  }

  dispatch(strategy: 'unicast' = 'unicast'): BuildStep<T> {
    this.dispatchStrategy = strategy;
    return new BuildStepImpl(this.monitorBuilderSteps);
  }
}

interface BuildStep<T extends object> {
  build(): Monitor<T>;
}

class BuildStepImpl<T extends object> implements BuildStep<T> {
  constructor(private readonly monitorBuilderSteps: MonitorsBuilderState<T>) {}

  build(): Monitor<T> {
    const { builderProps, setDataSourceStep, addTransformationsStep } =
      this.monitorBuilderSteps;
    if (!builderProps || !setDataSourceStep || !addTransformationsStep) {
      throw new Error('Should not happen');
    }
    const { dataSource, pollInterval } = setDataSourceStep;
    const { transformations, composedPipelines, dispatchStrategy } =
      addTransformationsStep;
    if (
      !dataSource ||
      !pollInterval ||
      !transformations ||
      !composedPipelines ||
      !dispatchStrategy
    ) {
      throw new Error('Should not happen');
    }

    const monitorFactory = MonitorsInternal.factory(builderProps);

    return monitorFactory.createUnicastMonitor<T>(
      dataSource,
      composedPipelines,
      pollInterval,
    );
  }
}
