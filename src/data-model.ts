import { PublicKey } from '@solana/web3.js';

/**
 * A user or a dApp, just an alias to
 */
export type ResourceId = PublicKey;

/**
 * A data bound to a specific on chain resource (e.g. subscriber)
 */
export type Data<T extends Object> = {
  resourceId: ResourceId;
  data: T;
};

/**
 * A parameter state that was detected by pipeline and need to be sent to subscribers
 */
export interface Notification {
  timestamp: Date;
  type: 'warning' | 'info';
  title: string;
  message: string;
}

export type SubscriberState = 'added' | 'removed';

export interface SubscriberEvent {
  state: SubscriberState;
}
