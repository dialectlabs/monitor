import { Duration } from 'luxon';
import {
  NotificationSink,
  PollableDataSource,
  PushyDataSource,
  TransformationPipeline,
} from './ports';
import { Monitor } from './monitor-api';
import { Context, Data, ResourceId, SubscriberEvent } from './data-model';
import { DialectNotification } from './dialect-notification-sink';
import { EmailNotification } from './sengrid-email-notification-sink';
import { SmsNotification } from './twilio-sms-notification-sink';
import { TelegramNotification } from './telegram-notification-sink';
import { SolflareNotification } from './solflare-notification-sink';
import { DialectCloudNotification } from './dialect-cloud-notification-sink';

export interface ChooseDataSourceStep {
  /**
   * Use subscriber events as a source of data
   * Useful when you need to e.g. send some message for new subscribers
   */
  subscriberEvents(): AddTransformationsStep<SubscriberEvent>;

  /**
   * Define a new data source
   * Useful when you have some on-chain resources or API to get data from
   * @typeParam T data type to be provided by data source
   */
  defineDataSource<T extends object>(): DefineDataSourceStep<T>;
}

export interface DefineDataSourceStep<T extends object> {
  /**
   * Use poll model to supply new data from some on-chain resources or API
   * @param dataSource function that is polled by framework to get new data
   * @param pollInterval an interval of polling
   * @typeParam T data type to be provided {@linkcode PollableDataSource}
   */
  poll(
    dataSource: PollableDataSource<T>,
    pollInterval: Duration,
  ): AddTransformationsStep<T>;

  push(dataSource: PushyDataSource<T>): AddTransformationsStep<T>;
}

export type KeysMatching<T extends object, V> = {
  [K in keyof T]: T[K] extends V ? K : never;
}[keyof T];

/**
 * Defines which keys from need to be proceeded and how
 * @typeParam T data source type from {@linkcode DefineDataSourceStep}
 * @typeParam V data type of specified keys from T
 */
export interface Transformation<T extends object, V, R> {
  /**
   * A set of keys from data source type to be transformed
   *  @typeParam V data type of specified keys from T
   */
  keys: KeysMatching<T, V>[];
  /**
   * Streaming transformations that produce dialect web3 notifications ot be executed for each key
   *  @typeParam V data type of specified keys from T
   */
  pipelines: TransformationPipeline<V, T, R>[];
}

/**
 * Defines to which subscribers the notifications are send.
 * 1. Unicast sends notification to a single subscriber who owned the original data, provided in {@linkcode DefineDataSourceStep}
 */
export type DispatchStrategy<T extends object> =
  | BroadcastDispatchStrategy
  | UnicastDispatchStrategy<T>
  | MulticastDispatchStrategy<T>;

export type BroadcastDispatchStrategy = {
  dispatch: 'broadcast';
};

export type UnicastDispatchStrategy<T extends object> = {
  dispatch: 'unicast';
  to: (ctx: Context<T>) => ResourceId;
};

export type MulticastDispatchStrategy<T extends object> = {
  dispatch: 'multicast';
  to: (ctx: Context<T>) => ResourceId[];
};

export interface AddTransformationsStep<T extends object> {
  transform<V, R>(transformation: Transformation<T, V, R>): NotifyStep<T, R>;

  notify(): AddSinksStep<T, T>;
}

export interface NotifyStep<T extends object, R> {
  /**
   * Finish adding transformations and configure how to dispatch notifications
   */
  notify(): AddSinksStep<T, R>;
}

export interface AddSinksStep<T extends object, R> {
  dialectThread(
    adapter: (data: Data<R, T>) => DialectNotification,
    dispatchStrategy: DispatchStrategy<T>,
  ): AddSinksStep<T, R>;

  dialectCloud(
    adapter: (data: Data<R, T>) => DialectCloudNotification,
    dispatchStrategy: DispatchStrategy<T>,
  ): AddSinksStep<T, R>;

  email(
    adapter: (data: Data<R, T>) => EmailNotification,
    dispatchStrategy: DispatchStrategy<T>,
  ): AddSinksStep<T, R>;

  sms(
    adapter: (data: Data<R, T>) => SmsNotification,
    dispatchStrategy: DispatchStrategy<T>,
  ): AddSinksStep<T, R>;

  telegram(
    adapter: (data: Data<R, T>) => TelegramNotification,
    dispatchStrategy: DispatchStrategy<T>,
  ): AddSinksStep<T, R>;

  solflare(
    adapter: (data: Data<R, T>) => SolflareNotification,
    dispatchStrategy: DispatchStrategy<T>,
  ): AddSinksStep<T, R>;

  custom<N>(
    adapter: (data: Data<R, T>) => N,
    sink: NotificationSink<N>,
    dispatchStrategy: DispatchStrategy<T>,
  ): AddSinksStep<T, R>;

  also(): AddTransformationsStep<T>;

  and(): BuildStep<T>;
}

export interface BuildStep<T extends object> {
  /**
   * Creates new monitor based on configuration above
   */
  build(): Monitor<T>;
}
