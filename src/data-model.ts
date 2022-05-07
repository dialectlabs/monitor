import { PublicKey } from '@solana/web3.js';

/**
 * A reference to any on-chain resource i.e.g user or a dApp, just an alias to PublicKey
 */
export type ResourceId = PublicKey;

/**
 * Any data bound to a specific on chain resource that may be stored in account
 *  @typeParam T data type provided by data source
 */
export interface SourceData<T> {
  data: T;
  groupingKey: string;
}

/**
 * Any data bound to a specific on chain resource that may be stored in account
 *  @typeParam T data type provided by data source
 */
export interface Data<V, T extends object> {
  value: V;
  context: Context<T>;
}

/**
 * A holder for any context data that need to be preserved through all pipeline transformations
 */
export interface Context<T extends object> {
  origin: T;
  trace: Trace[];
}

/**
 * A holder for recording any context information about execution of transformations steps
 */
export type Trace = TriggerTrace;

/**
 * A holder for trigger transformation context i.e. trigger input and output
 */
export interface TriggerTrace {
  type: 'trigger';
  input: number[];
  output: number;
}

export interface Notification {}

/**
 * An event that is fired when something changes in subscriber state e.g. new subscriber is added
 */
export interface SubscriberEvent {
  state: SubscriberState;
}

export type SubscriberState = 'added' | 'removed';
