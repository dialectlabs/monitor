import { Keypair, PublicKey } from '@solana/web3.js';
import { concatMap, from, interval, Observable, switchMap } from 'rxjs';
import { UnicastMonitor } from './internal/unicast-monitor';
import { InMemorySubscriberRepository } from './internal/in-memory-subscriber.repository';
import { Program } from '@project-serum/anchor';
import { DialectEventSink } from './internal/dialect-event-sink';
import { OnChainSubscriberRepository } from './internal/on-chain-subscriber.repository';
import { Duration } from 'luxon';

/**
 * Parameter id is a unique name of monitored entity
 */
export type ParameterId = string;

/**
 * Parameter may have some metadata
 */
export type Parameter = {
  id: ParameterId;
  description?: string;
};

/**
 * Parameter-bound data (i.e. parameter measurement)
 */
export type ParameterData<T> = { parameterId: ParameterId; data: T };

export type DataSourceMetadata = {
  id: string;
  parameters: Parameter[];
};

/**
 * A user or a dApp, just an alias to
 */
export type ResourceId = PublicKey;

/**
 * Resource-bound parameter data (i.e. a parameter measurement bound to a specific user)
 */
export type ResourceParameterData<T> = {
  resourceId: ResourceId;
  parameterData: ParameterData<T>;
};

/**
 * A batch of multiple parameter data
 */
export type DataPackage<T> = ResourceParameterData<T>[];

/**
 * An abstraction that represents a source of data, bound to specific type
 */
export interface DataSource<T> {
  connect(): Promise<DataSourceMetadata>;

  disconnect(): Promise<void>;
}

/**
 * Pollable data source will be polled by framework to get next datapackage
 */
export interface PollableDataSource<T> extends DataSource<T> {
  extract(subscribers: ResourceId[]): Promise<DataPackage<T>>;
}

/**
 * A set of transformations that are executed on-top of unbound data stream to detect events
 */
export type EventDetectionPipeline<T> = (
  source: Observable<ResourceParameterData<T>>,
) => Observable<Event>;

export type SubscriberEventHandler = (subscriber: ResourceId) => any;

/**
 * Repository containing all subscribers, also provides subscribe semantics to get updates
 */
export interface SubscriberRepository {
  /**
   * Return all subscribers of the monitor
   */
  findAll(): Promise<ResourceId[]>;

  /**
   * Finds subscriber by resource id
   */
  findByResourceId(resourceId: ResourceId): Promise<ResourceId | null>;

  /**
   * Can be used to set handlers to react if set of subscribers is changed
   */
  subscribe(
    onSubscriberAdded?: SubscriberEventHandler,
    onSubscriberRemoved?: SubscriberEventHandler,
  ): any;
}

/**
 * An interface that abstracts the destination where events are sent/persisted
 */
export interface EventSink {
  push(event: Event, recipients: ResourceId[]): Promise<void>;
}

/**
 * A parameter state that was detected by pipeline and need to be sent to subscribers
 */
export interface Event {
  timestamp: Date;
  type: 'warning' | 'info';
  title: string;
  message: string;
}

/**
 * A monitor is an entity that is responsible for execution of unbounded streaming ETL (Extract, Transform, Load)
 * and connects DataSource, EventDetectionPipeline and EventSink
 */
export interface Monitor<T> {
  start(): Promise<void>;

  stop(): Promise<void>;
}

export type SubscriberEvent = 'added' | 'removed';

export interface MonitorFactoryProps {
  dialectProgram?: Program;
  monitorKeypair?: Keypair;
  eventSink?: EventSink;
  subscriberRepository?: SubscriberRepository;
}

/**
 * A set of factory methods to create monitors
 */
export class MonitorFactory {
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
