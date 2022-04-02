import { InMemorySubscriberRepository } from './in-memory-subscriber.repository';
import { OnChainSubscriberRepository } from './on-chain-subscriber.repository';
import { Duration } from 'luxon';
import { UnicastMonitor } from './unicast-monitor';
import { concatMap, exhaustMap, from, Observable, timer } from 'rxjs';
import { MonitorFactory } from '../monitor-factory';
import {
  DataSource,
  DataSourceTransformationPipeline,
  PollableDataSource,
  PushyDataSource,
  SubscriberRepository,
} from '../ports';
import { Monitor, MonitorProps } from '../monitor-api';
import { ResourceId, SourceData, SubscriberEvent } from '../data-model';
import { BroadcastMonitor } from './broadcast-monitor';

export class DefaultMonitorFactory implements MonitorFactory {
  private readonly subscriberRepository: SubscriberRepository;

  private readonly shutdownHooks: (() => Promise<any>)[] = [];

  constructor({
    dialectProgram,
    monitorKeypair,
    subscriberRepository,
  }: MonitorProps) {
    if (dialectProgram && monitorKeypair) {
      const onChainSubscriberRepository = new OnChainSubscriberRepository(
        dialectProgram,
        monitorKeypair,
      );
      this.shutdownHooks.push(() => onChainSubscriberRepository.tearDown());
      this.subscriberRepository = InMemorySubscriberRepository.decorate(
        onChainSubscriberRepository,
      );
    }
    if (subscriberRepository) {
      this.subscriberRepository = subscriberRepository;
    }
    // @ts-ignore
    if (!this.subscriberRepository) {
      throw new Error(
        'Please specify either dialectProgram & monitorKeypair or subscriberRepository',
      );
    }
  }

  async shutdown() {
    return Promise.all(this.shutdownHooks.map((it) => it()));
  }

  createUnicastMonitor<T extends object>(
    dataSource: DataSource<T>,
    datasourceTransformationPipelines: DataSourceTransformationPipeline<
      T,
      any
    >[],
    pollInterval: Duration = Duration.fromObject({ seconds: 10 }),
  ): Monitor<T> {
    const pushyDataSource = this.decorateWithPushyDataSource(
      dataSource,
      pollInterval,
    );
    const unicastMonitor = new UnicastMonitor<T>(
      pushyDataSource,
      datasourceTransformationPipelines,
    );
    this.shutdownHooks.push(() => unicastMonitor.stop());
    return unicastMonitor;
  }

  private decorateWithPushyDataSource<T extends object>(
    dataSource: DataSource<T>,
    pollInterval: Duration,
  ): PushyDataSource<T> {
    if ('subscribe' in dataSource) {
      return dataSource as PushyDataSource<T>;
    }
    return this.toPushyDataSource(
      dataSource as PollableDataSource<T>,
      pollInterval,
      this.subscriberRepository,
    );
  }

  createBroadcastMonitor<T extends object>(
    dataSource: PollableDataSource<T>,
    datasourceTransformationPipelines: DataSourceTransformationPipeline<
      T,
      any
    >[],
    pollInterval: Duration = Duration.fromObject({ seconds: 10 }),
  ): Monitor<T> {
    const pushyDataSource = this.toPushyDataSource(
      dataSource,
      pollInterval,
      this.subscriberRepository,
    );
    const broadcastMonitor = new BroadcastMonitor<T>(
      pushyDataSource,
      datasourceTransformationPipelines,
      this.subscriberRepository,
    );
    this.shutdownHooks.push(() => broadcastMonitor.stop());
    return broadcastMonitor;
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
