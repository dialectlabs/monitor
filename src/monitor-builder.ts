import { Duration } from 'luxon';
import {
  NotificationSink,
  PollableDataSource,
  PushyDataSource,
  SubscriberRepository,
  TransformationPipeline,
} from './ports';
import { Program } from '@project-serum/anchor';
import { Keypair } from '@solana/web3.js';
import { Monitor } from './monitor-api';
import { Data, DialectNotification, SubscriberEvent } from './data-model';

/**
 * Please specify either
 * 1. dialectProgram + monitorKeypair to use on-chain bindings of internal components
 * 2. notificationSink + subscriberRepository to run w/o chain dependency
 */
export interface MonitorBuilderProps {
  /**
   * Dialect program that will be used to interact with chain
   */
  dialectProgram?: Program;
  /**
   * Monitoring service keypair used to sign transactions to send messages and discover subscribers
   */
  monitorKeypair?: Keypair;
  /**
   * Allows to set custom subscriber repository
   */
  subscriberRepository?: SubscriberRepository;
}

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
export type DispatchStrategy = 'unicast' | 'broadcast';

export interface AddTransformationsStep<T extends object> {
  transform<V, R>(transformation: Transformation<T, V, R>): NotifyStep<T, R>;

  dispatch(strategy: DispatchStrategy): BuildStep<T>;
}

export interface NotifyStep<T extends object, R> {
  /**
   * Finish adding transformations and configure how to dispatch notifications
   */
  notify(): AddSinksStep<T, R>;
}

export interface AddSinksStep<T extends object, R> {
  dialectThread(
    adaptFn: (data: Data<R, T>) => DialectNotification,
  ): AddSinksStep<T, R>;

  custom<M>(
    adaptFn: (data: Data<R, T>) => M,
    sink: NotificationSink<M>,
  ): AddSinksStep<T, R>;

  and(): AddTransformationsStep<T>;
}

export interface BuildStep<T extends object> {
  /**
   * Creates new monitor based on configuration above
   */
  build(): Monitor<T>;
}
