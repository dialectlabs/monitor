import { DialectEventSink } from './dialect-event-sink';
import { InMemorySubscriberRepository } from './in-memory-subscriber.repository';
import { OnChainSubscriberRepository } from './on-chain-subscriber.repository';
import { Duration } from 'luxon';
import { UnicastMonitor } from './unicast-monitor';
import { concatMap, from, interval, Observable, switchMap } from 'rxjs';
import {
  DataPackage,
  EventDetectionPipeline,
  EventSink,
  Monitor,
  MonitorFactory,
  MonitorFactoryProps,
  ParameterId,
  PollableDataSource,
  ResourceId,
  ResourceParameterData,
  SubscriberEvent,
  SubscriberRepository,
} from '../monitor';

export class DefaultMonitorFactory implements MonitorFactory {
  private readonly eventSink: EventSink;
  private readonly subscriberRepository: SubscriberRepository;

  constructor({
    dialectProgram,
    monitorKeypair,
    eventSink,
    subscriberRepository,
  }: MonitorFactoryProps) {
    if (dialectProgram && monitorKeypair) {
      this.eventSink = new DialectEventSink(dialectProgram, monitorKeypair);
      this.subscriberRepository = InMemorySubscriberRepository.decorate(
        new OnChainSubscriberRepository(dialectProgram, monitorKeypair),
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

  createUnicastMonitor<T>(
    dataSource: PollableDataSource<T>,
    eventDetectionPipelines: Record<ParameterId, EventDetectionPipeline<T>[]>,
    pollInterval: Duration = Duration.fromObject({ seconds: 10 }),
  ): Monitor<T> {
    const observableDataSource = this.toObservable(
      dataSource,
      pollInterval,
      this.subscriberRepository,
    );
    return new UnicastMonitor<T>(
      observableDataSource,
      eventDetectionPipelines,
      this.eventSink,
    );
  }

  private toObservable<T>(
    dataSource: PollableDataSource<T>,
    pollInterval: Duration,
    subscriberRepository: SubscriberRepository,
  ) {
    const observableDataSource: Observable<ResourceParameterData<T>> = interval(
      pollInterval.toMillis(),
    ).pipe(
      switchMap(() => subscriberRepository.findAll()),
      switchMap((resources: ResourceId[]) =>
        from(dataSource.extract(resources)),
      ),
      concatMap((dataPackage: DataPackage<T>) => dataPackage),
    );
    return observableDataSource;
  }

  createSubscriberEventMonitor(
    eventDetectionPipelines: EventDetectionPipeline<SubscriberEvent>[],
  ): Monitor<SubscriberEvent> {
    const parameterId = 'subscriber-state';
    const observableDataSource: Observable<
      ResourceParameterData<SubscriberEvent>
    > = new Observable<ResourceParameterData<SubscriberEvent>>((subscriber) =>
      this.subscriberRepository.subscribe(
        (resourceId) =>
          subscriber.next({
            resourceId,
            parameterData: {
              parameterId: 'subscriber-state',
              data: 'added',
            },
          }),
        (resourceId) =>
          subscriber.next({
            resourceId,
            parameterData: {
              parameterId: 'subscriber-state',
              data: 'removed',
            },
          }),
      ),
    );
    const eventDetectionPipelinesRecord = Object.fromEntries([
      [parameterId, eventDetectionPipelines],
    ]);
    return new UnicastMonitor<SubscriberEvent>(
      observableDataSource,
      eventDetectionPipelinesRecord,
      this.eventSink,
    );
  }
}
