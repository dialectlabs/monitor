import {
  concatMap,
  exhaustMap,
  filter,
  from,
  groupBy,
  GroupedObservable,
  interval,
  mergeMap,
  Subscription as RxJsSubscription,
  switchMap,
} from 'rxjs';
import {
  DataPackage,
  EventDetectionPipeline,
  EventSink,
  Monitor,
  ParameterId,
  PollableDataSource,
  ResourceId,
  ResourceParameterData,
  SubscriberRepository,
} from '../monitor';
import { Duration } from 'luxon';
import { Operators } from '../monitor-pipeline-operators';
import { PublicKey } from '@solana/web3.js';

export class UnicastMonitor<T> implements Monitor<T> {
  private started = false;

  private subscriptions: RxJsSubscription[] = [];

  constructor(
    private readonly dataSource: PollableDataSource<T>,
    private readonly eventDetectionPipelines: Record<
      ParameterId,
      EventDetectionPipeline<T>[]
    >,
    private readonly eventSink: EventSink,
    private readonly subscriberRepository: SubscriberRepository,
  ) {
    this.unsubscribeOnShutDown();
  }

  private unsubscribeOnShutDown() {
    process.on('SIGINT', () => {
      this.stop();
    });
  }

  async start() {
    if (this.started) {
      console.log('Already started');
      return;
    }
    await this.dataSource.connect();
    this.startMonitorPipeline();
    this.started = true;
  }

  private async startMonitorPipeline() {
    const monitorPipelineSubscription = interval(
      Duration.fromObject({ seconds: 5 }).toMillis(), // TODO: extract timer to parameters
    )
      .pipe(
        switchMap(() => this.subscriberRepository.findAll()),
        switchMap((resources: ResourceId[]) =>
          from(this.dataSource.extract(resources)),
        ),
        concatMap((dataPackage: DataPackage<T>) => dataPackage),
      )
      .pipe(
        filter(
          ({ parameterData: { parameterId } }) =>
            this.eventDetectionPipelines[parameterId] !== undefined,
        ),
      )
      .pipe(
        groupBy<ResourceParameterData<T>, string, ResourceParameterData<T>>(
          ({ resourceId, parameterData: { parameterId } }) =>
            UnicastMonitor.stringifyGroupingKey({
              resourceId,
              parameterId,
            }),
          {
            element: (it) => it,
          },
        ),
        mergeMap(
          (
            resourceParameterData: GroupedObservable<
              string,
              ResourceParameterData<T>
            >,
          ) => {
            const { resourceId, parameterId } =
              UnicastMonitor.deStringifyGroupingKey(resourceParameterData.key);
            const pipelines = this.eventDetectionPipelines[parameterId] ?? []; // safe to do this since we've already checked presence above
            return pipelines.map((pipeline) => {
              return pipeline(resourceParameterData).pipe(
                exhaustMap((event) =>
                  from(this.eventSink.push(event, [resourceId])),
                ),
              );
            });
          },
        ),
        mergeMap((it) => it),
      )
      .pipe()
      .pipe(...Operators.FlowControl.onErrorRetry())
      .subscribe();
    this.subscriptions.push(monitorPipelineSubscription);
  }

  stop(): Promise<void> {
    this.subscriptions.forEach((it) => it.unsubscribe());
    this.subscriptions = [];
    this.started = false;
    this.dataSource.disconnect();
    return Promise.resolve();
  }

  // NB: rxjs cannot group by arbitrary type => need to concat using separator
  private static GROUPING_KEY_SEPARATOR = `¿`;

  private static stringifyGroupingKey({
    resourceId,
    parameterId,
  }: GroupingKey) {
    return `${resourceId.toString()}${
      UnicastMonitor.GROUPING_KEY_SEPARATOR
    }${parameterId}`;
  }

  private static deStringifyGroupingKey(groupingKey: string): GroupingKey {
    const [resourceId, parameterId] = groupingKey.split(
      UnicastMonitor.GROUPING_KEY_SEPARATOR,
    );
    return {
      parameterId,
      resourceId: new PublicKey(resourceId),
    };
  }
}

interface GroupingKey {
  resourceId: ResourceId;
  parameterId: string;
}
