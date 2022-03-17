import {
  exhaustMap,
  from,
  groupBy,
  GroupedObservable,
  mergeMap,
  Subscription as RxJsSubscription,
} from 'rxjs';

import { PublicKey } from '@solana/web3.js';
import {
  DataSourceTransformationPipeline,
  NotificationSink,
  PushyDataSource,
  SubscriberRepository,
} from '../ports';
import { Monitor } from '../monitor-api';
import { SourceData } from '../data-model';
import { Operators } from '../transformation-pipeline-operators';

export class BroadcastMonitor<T extends Object> implements Monitor<T> {
  private started = false;

  private subscriptions: RxJsSubscription[] = [];

  constructor(
    private readonly dataSource: PushyDataSource<T>,
    private readonly dataSourceTransformationPipelines: DataSourceTransformationPipeline<T>[],
    private readonly notificationSink: NotificationSink,
    private readonly subscriberRepository: SubscriberRepository,
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
        groupBy<SourceData<T>, string, SourceData<T>>(
          ({ resourceId }) => resourceId.toString(),
          {
            element: (it) => it,
          },
        ),
        mergeMap((data: GroupedObservable<string, SourceData<T>>) => {
          return this.dataSourceTransformationPipelines.map((pipeline) => {
            return pipeline(data).pipe(
              exhaustMap((event) => {
                return from(
                  this.subscriberRepository
                    .findAll()
                    .then((subscribers) =>
                      this.notificationSink.push(event.value, subscribers),
                    ),
                );
              }),
            );
          });
        }),
        mergeMap((it) => it),
      )
      .pipe(...Operators.FlowControl.onErrorRetry())
      .subscribe();
    this.subscriptions.push(monitorPipelineSubscription);
  }
}
