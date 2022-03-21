import { Observable } from 'rxjs';
import { Data, ResourceId, SourceData } from './data-model';

/**
 * An abstraction that represents a source of data, bound to specific type
 */
export type DataSource<T extends object> =
  | PushyDataSource<T>
  | PollableDataSource<T>;

/**
 * Pollable data source is polled by framework to get new data
 */
export interface PollableDataSource<T extends object> {
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
export type DataSourceTransformationPipeline<T extends Object, R> = (
  dataSource: PushyDataSource<T>,
  targets: ResourceId[],
) => Observable<R>;

/**
 * A set of transformations that are executed on-top of a specific key from unbound pushy data source
 * to generate notification but bound to a
 */
export type TransformationPipeline<V, T extends object, R> = (
  upstream: Observable<Data<V, T>>,
) => Observable<Data<R, T>>;

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
export interface NotificationSink<R> {
  push(data: R, recipients: ResourceId[]): Promise<void>;
}
