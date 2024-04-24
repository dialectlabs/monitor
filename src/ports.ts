import { Observable } from 'rxjs';
import { Data, Notification, ResourceId, SourceData } from './data-model';
import { PublicKey } from '@solana/web3.js';
import { DispatchType, NotificationMetadata } from './monitor-builder';

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
export type ContextEnrichedPushyDataSource<T extends object> = Observable<
  Data<T, T>
>;

/**
 * A set of transformations that are executed on-top of unbound pushy data source
 * to generate a new notification
 */
export type DataSourceTransformationPipeline<T extends object, R> = (
  dataSource: ContextEnrichedPushyDataSource<T>,
) => Observable<R>;

/**
 * A set of transformations that are executed on-top of a specific key from unbound pushy data source
 * to generate notification but bound to a
 */
export type TransformationPipeline<V, T extends object, R> = (
  upstream: Observable<Data<V, T>>,
) => Observable<Data<R, T>>;

export type SubscriberEventHandler = (subscriber: Subscriber) => any;

/**
 * Repository containing all subscribers, also provides subscribe semantics to get updates
 */
export interface SubscriberRepository {
  /**
   * Return all subscribers of the monitor
   */
  findAll(resourceIds?: ResourceId[]): Promise<Subscriber[]>;

  /**
   * Can be used to set handlers to react if set of subscribers is changed
   */
  subscribe(
    onSubscriberAdded?: SubscriberEventHandler,
    onSubscriberRemoved?: SubscriberEventHandler,
  ): any;
}

export interface Subscriber {
  resourceId: ResourceId;
  email?: string | null;
  telegramChatId?: string | null;
  phoneNumber?: string | null;
  wallet?: PublicKey | null;
  notificationSubscriptions?: SubscriberNotificationSubscription[];
}

export interface SubscriberNotificationSubscription {
  notificationType: NotificationType;
  config: SubscriptionConfig;
}

export interface NotificationType {
  id: string;
  humanReadableId: string;
}

export interface SubscriptionConfig {
  enabled: boolean;
}

export interface NotificationSinkMetadata {
  dispatchType: DispatchType;
  notificationMetadata?: NotificationMetadata;
}

/**
 * An interface that abstracts the destination where events are sent/persisted
 */
export interface NotificationSink<N extends Notification> {
  push(
    notification: N,
    recipients: ResourceId[],
    metadata: NotificationSinkMetadata,
  ): Promise<any>;
}
