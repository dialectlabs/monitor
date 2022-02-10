import { Observable } from 'rxjs';
import { Data, Event, ResourceId } from './data-model';

/**
 * An abstraction that represents a source of data, bound to specific type
 */
export interface DataSource<T extends object> {}

/**
 * Pollable data source will be polled by framework to get next data
 */
export interface PollableDataSource<T extends object> extends DataSource<T> {
  (subscribers: ResourceId[]): Promise<Data<T>[]>;
}

/**
 * Pushing data source
 */
export type PushyDataSource<T extends object> = Observable<Data<T>>;

/**
 * A set of transformations that are executed on-top of unbound pushy data source
 */
export type DataSourceTransformationPipeline<T extends Object> = (
  dataSource: PushyDataSource<T>,
) => Observable<Event>;

export type TransformationPipeline<V> = (
  upstream: Observable<Data<V>>,
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
