import { Duration } from 'luxon';
import {
  catchError,
  exhaustMap,
  from,
  mergeMap,
  Observable,
  throwError,
  TimeoutError,
  timer,
} from 'rxjs';
import { MonitorFactory } from '../monitor-factory';
import {
  DataSource,
  DataSourceTransformationPipeline,
  PollableDataSource,
  PushyDataSource,
  SubscriberRepository,
} from '../ports';
import { Monitor } from '../monitor-api';
import { ResourceId, SourceData, SubscriberEvent } from '../data-model';
import { timeout } from 'rxjs/operators';
import { DefaultMonitor } from './default-monitor';

export class DefaultMonitorFactory implements MonitorFactory {
  private readonly shutdownHooks: (() => Promise<any>)[] = [];

  constructor(private readonly subscriberRepository: SubscriberRepository) {}

  async shutdown() {
    return Promise.all(this.shutdownHooks.map((it) => it()));
  }

  createDefaultMonitor<T extends object>(
    dataSource: DataSource<T>,
    datasourceTransformationPipelines: DataSourceTransformationPipeline<
      T,
      any
    >[],
    pollInterval: Duration = Duration.fromObject({ seconds: 10 }),
  ): Monitor<T> {
    const pushyDataSource = !('subscribe' in dataSource)
      ? this.toPushyDataSource(
          dataSource as PollableDataSource<T>,
          pollInterval,
          this.subscriberRepository,
        )
      : dataSource;
    const monitor = new DefaultMonitor<T>(
      pushyDataSource,
      datasourceTransformationPipelines,
      this.subscriberRepository,
    );
    this.shutdownHooks.push(() => monitor.stop());
    return monitor;
  }

  createSubscriberEventMonitor(
    dataSourceTransformationPipelines: DataSourceTransformationPipeline<
      SubscriberEvent,
      any
    >[],
  ): Monitor<SubscriberEvent> {
    const dataSource: PushyDataSource<SubscriberEvent> = new Observable<
      SourceData<SubscriberEvent>
    >((subscriber) =>
      this.subscriberRepository.subscribe(
        ({ resourceId }) =>
          subscriber.next({
            groupingKey: resourceId.toBase58(),
            data: {
              resourceId,
              state: 'added',
            },
          }),
        ({ resourceId }) =>
          subscriber.next({
            groupingKey: resourceId.toBase58(),
            data: {
              resourceId,
              state: 'removed',
            },
          }),
      ),
    );
    const monitor = new DefaultMonitor<SubscriberEvent>(
      dataSource,
      dataSourceTransformationPipelines,
      this.subscriberRepository,
    );
    this.shutdownHooks.push(() => monitor.stop());
    return monitor;
  }

  private toPushyDataSource<T extends object>(
    dataSource: PollableDataSource<T>,
    pollInterval: Duration,
    subscriberRepository: SubscriberRepository,
  ): PushyDataSource<T> {
    const pollTimeoutMs = Math.max(
      Duration.fromObject({ minutes: 10 }).toMillis(),
      3 * pollInterval.toMillis(),
    );
    const pollTimeout = Duration.fromObject({ milliseconds: pollTimeoutMs });
    return timer(0, pollInterval.toMillis()).pipe(
      exhaustMap(() =>
        from(
          subscriberRepository
            .findAll()
            .then((s) => s.map(({ resourceId }) => resourceId)),
        ),
      ),
      exhaustMap((resources: ResourceId[]) => from(dataSource(resources))),
      timeout(pollTimeout.toMillis()),
      catchError((error) => {
        if (error instanceof TimeoutError) {
          return throwError(
            new Error(
              `Poll timeout of ${pollTimeout.toISO()} reached. ` + error,
            ),
          );
        }
        return throwError(error);
      }),
      mergeMap((it) => it),
    );
  }
}
