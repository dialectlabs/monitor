import { DialectDataSink } from './dialect-data-sink';
import { InMemorySubscriberRepository } from './in-memory-subscriber.repository';
import { OnChainSubscriberRepository } from './on-chain-subscriber.repository';
import { Duration } from 'luxon';
import { UnicastMonitor } from './unicast-monitor';
import { concatMap, exhaustMap, from, Observable, timer } from 'rxjs';
import { MonitorFactory, MonitorFactoryProps } from '../monitor-factory';
import {
  DataSink,
  DataSourceTransformationPipeline,
  PollableDataSource,
  PushyDataSource,
  SubscriberRepository,
} from '../ports';
import { Monitor } from '../monitor-api';
import { ResourceId, SourceData, SubscriberEvent } from '../data-model';

export class DefaultMonitorFactory implements MonitorFactory {
  private readonly notificationSink: DataSink;
  private readonly subscriberRepository: SubscriberRepository;

  private readonly shutdownHooks: (() => Promise<any>)[] = [];

  constructor({
    dialectProgram,
    monitorKeypair,
    notificationSink,
    subscriberRepository,
  }: MonitorFactoryProps) {
    if (dialectProgram && monitorKeypair) {
      this.notificationSink = new DialectDataSink(
        dialectProgram,
        monitorKeypair,
      );
      const onChainSubscriberRepository = new OnChainSubscriberRepository(
        dialectProgram,
        monitorKeypair,
      );
      this.shutdownHooks.push(() => onChainSubscriberRepository.tearDown());
      this.subscriberRepository = InMemorySubscriberRepository.decorate(
        onChainSubscriberRepository,
      );
    }
    if (notificationSink) {
      this.notificationSink = notificationSink;
    }
    if (subscriberRepository) {
      this.subscriberRepository = subscriberRepository;
    }
    // @ts-ignore
    if (!this.notificationSink || !this.subscriberRepository) {
      throw new Error(
        'Please specify either dialectProgram & monitorKeypair or eventSink & subscriberRepository',
      );
    }
  }

  async shutdown() {
    return Promise.all(this.shutdownHooks.map((it) => it()));
  }

  createUnicastMonitor<T extends object>(
    dataSource: PollableDataSource<T>,
    datasourceTransformationPipelines: DataSourceTransformationPipeline<T>[],
    pollInterval: Duration = Duration.fromObject({ seconds: 10 }),
  ): Monitor<T> {
    const pushyDataSource = this.toPushyDataSource(
      dataSource,
      pollInterval,
      this.subscriberRepository,
    );
    const unicastMonitor = new UnicastMonitor<T>(
      pushyDataSource,
      datasourceTransformationPipelines,
      this.notificationSink,
    );
    this.shutdownHooks.push(() => unicastMonitor.stop());
    return unicastMonitor;
  }

  createSubscriberEventMonitor(
    dataSourceTransformationPipelines: DataSourceTransformationPipeline<SubscriberEvent>[],
  ): Monitor<SubscriberEvent> {
    const dataSource: PushyDataSource<SubscriberEvent> = new Observable<
      SourceData<SubscriberEvent>
    >((subscriber) =>
      this.subscriberRepository.subscribe(
        (resourceId) =>
          subscriber.next({
            resourceId,
            data: {
              state: 'added',
            },
          }),
        (resourceId) =>
          subscriber.next({
            resourceId,
            data: {
              state: 'removed',
            },
          }),
      ),
    );
    const unicastMonitor = new UnicastMonitor<SubscriberEvent>(
      dataSource,
      dataSourceTransformationPipelines,
      this.notificationSink,
    );
    this.shutdownHooks.push(() => unicastMonitor.stop());
    return unicastMonitor;
  }

  private toPushyDataSource<T extends object>(
    dataSource: PollableDataSource<T>,
    pollInterval: Duration,
    subscriberRepository: SubscriberRepository,
  ): PushyDataSource<T> {
    return timer(0, pollInterval.toMillis()).pipe(
      exhaustMap(() => subscriberRepository.findAll()),
      exhaustMap((resources: ResourceId[]) => from(dataSource(resources))),
      concatMap((it) => it),
    );
  }
}
