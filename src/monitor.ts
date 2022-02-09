import { Keypair, PublicKey } from '@solana/web3.js';
import { Observable } from 'rxjs';
import { Program } from '@project-serum/anchor';
import { Duration } from 'luxon';
import { DefaultMonitorFactory } from './internal/default-monitor-factory';

/**
 * A user or a dApp, just an alias to
 */
export type ResourceId = PublicKey;

/**
 * An abstraction that represents a source of data, bound to specific type
 */
export interface DataSource<T extends object> {}

/**
 * Pollable data source will be polled by framework to get next datapackage
 */
export interface PollableDataSource<T extends object> extends DataSource<T> {
  (subscribers: ResourceId[]): Promise<ResourceData<T>[]>;
}

export type ResourceData<T extends Object> = {
  resourceId: ResourceId;
  data: T;
};

export type MonitorEventDetectionPipeline<T> = (
  source: Observable<T>,
) => Observable<Event>;

/**
 * A set of transformations that are executed on-top of unbound data stream to detect events
 */

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
export class MonitorsInternal {
  private static factoryInstance: DefaultMonitorFactory;

  private constructor() {}

  static factory(props: MonitorFactoryProps): MonitorFactory {
    if (!MonitorsInternal.factoryInstance) {
      MonitorsInternal.factoryInstance = new DefaultMonitorFactory(props);
    }
    return MonitorsInternal.factoryInstance;
  }

  static async shutdown() {
    return (
      MonitorsInternal.factoryInstance &&
      MonitorsInternal.factoryInstance.shutdown()
    );
  }
}

export interface MonitorFactory {
  createUnicastMonitor<T extends object>(
    dataSource: PollableDataSource<T>,
    eventDetectionPipelines: MonitorEventDetectionPipeline<T>[],
    pollInterval: Duration,
  ): Monitor<T>;

  // createSubscriberEventMonitor(
  //   eventDetectionPipelines: MonitorEventDetectionPipeline<SubscriberEvent>[],
  // ): Monitor<SubscriberEvent>;
}
