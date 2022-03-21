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
import { SourceData } from '../data-model';
import { Operators } from '../transformation-pipeline-operators';
import { map } from 'rxjs/operators';

export class BroadcastMonitor<T extends Object> implements Monitor<T> {
  private started = false;

  private subscriptions: RxJsSubscription[] = [];

  constructor(
    private readonly dataSource: PushyDataSource<T>,
    private readonly dataSourceTransformationPipelines: DataSourceTransformationPipeline<
      T,
      void[]
    >[],
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
        mergeMap((data: GroupedObservable<string, SourceData<T>>) =>
          from(this.subscriberRepository.findAll()).pipe(
            map((it) =>
              this.dataSourceTransformationPipelines.map((pipeline) =>
                pipeline(data, it),
              ),
            ),
            mergeMap((it) => it),
          ),
        ),
        mergeMap((it) => it),
      )
      .pipe(...Operators.FlowControl.onErrorRetry())
      .subscribe();
    this.subscriptions.push(monitorPipelineSubscription);
  }
}
