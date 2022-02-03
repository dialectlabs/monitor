import { Keypair, PublicKey } from '@solana/web3.js';
import { Observable } from 'rxjs';
import { UnicastMonitor } from './internal/unicast-monitor';
import { InMemorySubscriberRepository } from './internal/in-memory-subscriber.repository';
import { Program } from '@project-serum/anchor';
import { DialectEventSink } from './internal/dialect-event-sink';
import { OnChainSubscriberRepository } from './internal/on-chain-subscriber.repository';

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
  parameterData: Observable<ParameterData<T>>,
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
    onSubscriberAdded: SubscriberEventHandler,
    onSubscriberRemoved: SubscriberEventHandler,
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

/**
 * A set of factory methods to create monitors
 */
export class Monitors {
  static createUnicast<T>(
    dataSource: PollableDataSource<T>,
    eventDetectionPipelines: Record<ParameterId, EventDetectionPipeline<T>>,
    dialectProgram: Program,
    monitorKeypair: Keypair,
  ): Monitor<T> {
    const eventSink = new DialectEventSink(dialectProgram, monitorKeypair);
    const subscriberRepository = InMemorySubscriberRepository.decorate(
      new OnChainSubscriberRepository(dialectProgram, monitorKeypair),
    );
    return new UnicastMonitor<T>(
      dataSource,
      eventDetectionPipelines,
      eventSink,
      subscriberRepository,
    );
  }
}
