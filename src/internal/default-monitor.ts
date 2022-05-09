import {
  from,
  groupBy,
  GroupedObservable,
  mergeMap,
  Subscription as RxJsSubscription,
} from 'rxjs';
import {
  DataSourceTransformationPipeline,
  PushyDataSource,
  SubscriberRepository,
} from '../ports';
import { Monitor } from '../monitor-api';
import { Data } from '../data-model';
import { Operators } from '../transformation-pipeline-operators';
import { Web2SubscriberRepository } from '../web-subscriber.repository';
import { findAllDistinct } from './subsbscriber-repository-utilts';

export class DefaultMonitor<T extends Object> implements Monitor<T> {
  private started = false;

  private subscriptions: RxJsSubscription[] = [];

  constructor(
    private readonly dataSource: PushyDataSource<T>,
    private readonly dataSourceTransformationPipelines: DataSourceTransformationPipeline<
      T,
      any
    >[],
    private readonly subscriberRepository: SubscriberRepository,
    private readonly web2SubscriberRepository: Web2SubscriberRepository,
  ) {}

  async start() {
    if (this.started) {
      console.log('Already started');
      return;
    }
    this.startMonitorPipeline();
    this.started = true;
  }

  stop(): Promise<void> {
    if (!this.started) {
      return Promise.resolve();
    }
    this.subscriptions.forEach((it) => it.unsubscribe());
    this.subscriptions = [];
    this.started = false;
    return Promise.resolve();
  }

  private async startMonitorPipeline() {
    const monitorPipelineSubscription = this.dataSource
      .pipe(
        mergeMap(({ data, groupingKey }) =>
          from(this.enrichWithContext(data, groupingKey)),
        ),
        groupBy<Data<T, T>, string, Data<T, T>>(
          ({ context: { groupingKey } }) => groupingKey,
          {
            element: (it) => it,
          },
        ),
        mergeMap((data: GroupedObservable<string, Data<T, T>>) =>
          this.dataSourceTransformationPipelines.map((pipeline) =>
            pipeline(data.pipe()),
          ),
        ),
        mergeMap((it) => it),
      )
      .pipe(...Operators.FlowControl.onErrorRetry())
      .subscribe();
    this.subscriptions.push(monitorPipelineSubscription);
  }

  private async enrichWithContext(
    origin: T,
    groupingKey: string,
  ): Promise<Data<T, T>> {
    const subscribers = await findAllDistinct(
      this.subscriberRepository,
      this.web2SubscriberRepository,
    );
    return {
      context: {
        origin,
        groupingKey,
        subscribers,
        trace: [],
      },
      value: origin,
    };
  }
}
