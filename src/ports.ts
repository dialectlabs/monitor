import { Observable } from 'rxjs';
import { Data, Notification, ResourceId, SourceData } from './data-model';

/**
 * An abstraction that represents a source of data, bound to specific type
 */
export interface DataSource<T extends object> {}

/**
 * Pollable data source is polled by framework to get new data
 */
export interface PollableDataSource<T extends object> extends DataSource<T> {
  (subscribers: ResourceId[]): Promise<SourceData<T>[]>;
}

/**
 * Pushy data source delivers data asynchronously, which eliminates polling
 */
export type PushyDataSource<T extends object> = Observable<SourceData<T>>;

/**
 * A set of transformations that are executed on-top of unbound pushy data source
 * to generate a new notification
 */
export type DataSourceTransformationPipeline<T extends Object> = (
  dataSource: PushyDataSource<T>,
) => Observable<Data<Notification, T>>;

/**
 * A set of transformations that are executed on-top of a specific key from unbound pushy data source
 * to generate notification but bound to a
 */
export type TransformationPipeline<V, T extends object> = (
  upstream: Observable<Data<V, T>>,
) => Observable<Data<Notification, T>>;

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
export interface DataSink<R> {
  push(data: R, recipients: ResourceId[]): Promise<void>;
}
