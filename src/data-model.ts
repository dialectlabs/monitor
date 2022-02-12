import { PublicKey } from '@solana/web3.js';

/**
 * A reference to any on-chain resource i.e.g user or a dApp, just an alias to PublicKey
 */
export type ResourceId = PublicKey;

/**
 * Any data bound to a specific on chain resource that may be stored in account
 *  @typeParam T data type provided by data source
 */
export type Data<T extends Object> = {
  resourceId: ResourceId;
  data: T;
};

/**
 * Dialect web3 notification
 */
export interface Notification {
  message: string;
}

export interface NotificationBuilder<V> {
  messageBuilder: (value: V) => string;
}

/**
 * An event that is fired when something changes in subscriber state e.g. new subscriber is added
 */
export interface SubscriberEvent {
  state: SubscriberState;
}

export type SubscriberState = 'added' | 'removed';
