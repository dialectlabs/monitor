import {
  concatMap,
  exhaustMap,
  filter,
  from,
  groupBy,
  interval,
  Subscription as RxJsSubscription,
  switchMap,
} from 'rxjs';
import {
  EventDetectionPipeline,
  EventSink,
  Monitor,
  ParameterData,
  ParameterId,
  PollableDataSource,
  ResourceId,
  ResourceParameterData,
  SubscriberRepository,
} from '../monitor-api';
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
      EventDetectionPipeline<T>
    >,
    private readonly eventSink: EventSink,
    private readonly subscriberRepository: SubscriberRepository,
  ) {
    this.unsubscribeOnShutDown();
  }

  private unsubscribeOnShutDown() {
    process.on('SIGINT', async () => {
      await this.stop();
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
        switchMap((_) => this.subscriberRepository.findAll()),
        switchMap((resources) =>
          from(this.dataSource.extract(resources.map((it) => it.resourceId))),
        ),
        concatMap((it) => it),
      )
      .pipe(
        filter(({ parameterData: { parameterId } }) => {
          console.log(parameterId);
          return this.eventDetectionPipelines[parameterId] !== undefined;
        }),
      )
      .pipe(
        groupBy<ResourceParameterData<T>, string, ParameterData<T>>(
          ({ resourceId, parameterData: { parameterId } }) =>
            UnicastMonitor.stringifyGroupingKey({
              resourceId,
              parameterId,
            }),
          {
            element: ({ parameterData }) => parameterData,
          },
        ),
        concatMap((parameterObservable) => {
          const { resourceId, parameterId } =
            UnicastMonitor.deStringifyGroupingKey(parameterObservable.key);
          const pipeline = this.eventDetectionPipelines[parameterId]!; // safe to do this since we've already checked presence above
          return pipeline(parameterObservable).pipe(
            exhaustMap((event) =>
              from(this.eventSink.push(event, [resourceId])),
            ),
          );
        }),
      )
      .pipe(...Operators.FlowControl.onErrorRetry())
      .subscribe();
    this.subscriptions.push(monitorPipelineSubscription);
  }

  stop(): Promise<void> {
    this.subscriptions.forEach((it) => it.unsubscribe());
    this.subscriptions = [];
    this.started = false;
    return Promise.resolve();
  }

  // NB: rxjs cannot group by arbitrary type
  private static stringifyGroupingKey({
    resourceId,
    parameterId,
  }: GroupingKey) {
    return `${resourceId.toString()}_${parameterId}`;
  }

  private static deStringifyGroupingKey(groupingKey: string): GroupingKey {
    const [resourceId, parameterId] = groupingKey.split('_');
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
