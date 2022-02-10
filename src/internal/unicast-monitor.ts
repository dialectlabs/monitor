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
  EventSink,
  PushyDataSource,
} from '../ports';
import { Monitor } from '../monitor-api';
import { Data } from '../data-model';
import { Operators } from '../transformation-operators';

export class UnicastMonitor<T extends Object> implements Monitor<T> {
  private started = false;

  private subscriptions: RxJsSubscription[] = [];

  constructor(
    private readonly dataSource: PushyDataSource<T>,
    private readonly dataSourceTransformationPipelines: DataSourceTransformationPipeline<T>[],
    private readonly eventSink: EventSink,
  ) {}

  async start() {
    if (this.started) {
      console.log('Already started');
      return;
    }
    this.startMonitorPipeline();
    this.started = true;
  }

  private async startMonitorPipeline() {
    const monitorPipelineSubscription = this.dataSource
      .pipe(
        groupBy<Data<T>, string, Data<T>>(
          ({ resourceId, data }) => resourceId.toString(),
          {
            element: (it) => it,
          },
        ),
        mergeMap((data: GroupedObservable<string, Data<T>>) => {
          const resourceId = new PublicKey(data.key);
          return this.dataSourceTransformationPipelines.map((pipeline) => {
            return pipeline(data).pipe(
              exhaustMap((event) =>
                from(this.eventSink.push(event, [resourceId])),
              ),
            );
          });
        }),
        mergeMap((it) => it),
      )
      .pipe()
      .pipe(...Operators.FlowControl.onErrorRetry())
      .subscribe();
    this.subscriptions.push(monitorPipelineSubscription);
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
}
