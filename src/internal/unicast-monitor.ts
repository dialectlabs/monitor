import {
  exhaustMap,
  from,
  groupBy,
  GroupedObservable,
  mergeMap,
  Observable,
  Subscription as RxJsSubscription,
} from 'rxjs';
import {
  EventSink,
  Monitor,
  MonitorEventDetectionPipeline,
  ResourceData,
} from '../monitor';
import { Operators } from '../monitor-pipeline-operators';
import { PublicKey } from '@solana/web3.js';
import { map, tap } from 'rxjs/operators';

export class UnicastMonitor<T> implements Monitor<T> {
  private started = false;

  private subscriptions: RxJsSubscription[] = [];

  constructor(
    private readonly dataSource: Observable<ResourceData<T>>,
    private readonly eventDetectionPipelines: MonitorEventDetectionPipeline<T>[],
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
      .pipe(tap((it) => console.log(JSON.stringify(it))))
      .pipe(
        groupBy<ResourceData<T>, string, ResourceData<T>>(
          ({ resourceId, data }) => resourceId.toString(),
          {
            element: (it) => it,
          },
        ),
        mergeMap((resourceData: GroupedObservable<string, ResourceData<T>>) => {
          const resourceId = new PublicKey(resourceData.key);
          return this.eventDetectionPipelines.map((pipeline) => {
            return pipeline(resourceData.pipe(map((it) => it.data))).pipe(
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
