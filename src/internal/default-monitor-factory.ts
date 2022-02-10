import { DialectEventSink } from './dialect-event-sink';
import { InMemorySubscriberRepository } from './in-memory-subscriber.repository';
import { OnChainSubscriberRepository } from './on-chain-subscriber.repository';
import { Duration } from 'luxon';
import { UnicastMonitor } from './unicast-monitor';
import { concatMap, from, Observable, switchMap, timer } from 'rxjs';
import { MonitorFactory, MonitorFactoryProps } from '../monitor-factory';
import {
  DataSourceTransformationPipeline,
  EventSink,
  PollableDataSource,
  PushyDataSource,
  SubscriberRepository,
} from '../ports';
import { Monitor } from '../monitor-api';
import { Data, ResourceId, SubscriberEvent } from '../data-model';

export class DefaultMonitorFactory implements MonitorFactory {
  private readonly eventSink: EventSink;
  private readonly subscriberRepository: SubscriberRepository;

  private readonly shutdownHooks: (() => Promise<any>)[] = [];

  constructor({
    dialectProgram,
    monitorKeypair,
    eventSink,
    subscriberRepository,
  }: MonitorFactoryProps) {
    if (dialectProgram && monitorKeypair) {
      this.eventSink = new DialectEventSink(dialectProgram, monitorKeypair);
      const onChainSubscriberRepository = new OnChainSubscriberRepository(
        dialectProgram,
        monitorKeypair,
      );
      this.shutdownHooks.push(() => onChainSubscriberRepository.tearDown());
      this.subscriberRepository = InMemorySubscriberRepository.decorate(
        onChainSubscriberRepository,
      );
    }
    if (eventSink) {
      this.eventSink = eventSink;
    }
    if (subscriberRepository) {
      this.subscriberRepository = subscriberRepository;
    }
    // @ts-ignore
    if (!this.eventSink || !this.subscriberRepository) {
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
      this.eventSink,
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
      switchMap(() => subscriberRepository.findAll()),
      switchMap((resources: ResourceId[]) => from(dataSource(resources))),
      concatMap((it) => it),
    );
  }

  createSubscriberEventMonitor(
    eventDetectionPipelines: DataSourceTransformationPipeline<SubscriberEvent>[],
  ): Monitor<SubscriberEvent> {
    const observableDataSource: Observable<Data<SubscriberEvent>> =
      new Observable<Data<SubscriberEvent>>((subscriber) =>
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
      observableDataSource,
      eventDetectionPipelines,
      this.eventSink,
    );
    this.shutdownHooks.push(() => unicastMonitor.stop());
    return unicastMonitor;
  }
}
