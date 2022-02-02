import { Keypair, PublicKey } from '@solana/web3.js';
import { Observable } from 'rxjs';
import { DialectAccount } from '@dialectlabs/web3';
import { UnicastMonitor } from './internal/unicast-monitor';
import { InMemorySubscriberRepository } from './internal/in-memory-subscriber.repository';
import { Program } from '@project-serum/anchor';
import { DialectEventSink } from './internal/dialect-event-sink';
import { OnChainSubscriberRepository } from './internal/on-chain-subscriber.repository';

export type ParameterId = string;

export type Parameter = {
  id: ParameterId;
  description?: string;
};

export type ParameterData<T> = { parameterId: ParameterId; data: T };

// data source
export type DataSourceMetadata = {
  id: string;
  parameters: Parameter[];
};

// resource
export type ResourceId = PublicKey;

export type ResourceParameterData<T> = {
  resourceId: ResourceId;
  parameterData: ParameterData<T>;
};

export type DataPackage<T> = ResourceParameterData<T>[];

export interface DataSource<T> {
  connect(): Promise<DataSourceMetadata>;

  disconnect(): Promise<void>;
}

export interface PollableDataSource<T> extends DataSource<T> {
  extract(subscribers: ResourceId[]): Promise<DataPackage<T>>;
}

export type EventDetectionPipeline<T> = (
  parameterData: Observable<ParameterData<T>>,
) => Observable<Event>;

export type Subscriber = {
  resourceId: ResourceId;
  dialectAccount: DialectAccount;
};

export type SubscriberAddedEventHandler = (subscriber: Subscriber) => any;
export type SubscriberRemovedEventHandler = (
  subscriberResourceId: ResourceId,
) => any;

export interface SubscriberRepository {
  findAll(): Promise<Subscriber[]>;

  findByResourceId(resourceId: ResourceId): Promise<Subscriber | null>;

  subscribe(
    onSubscriberAdded: SubscriberAddedEventHandler,
    onSubscriberRemoved: SubscriberRemovedEventHandler,
  ): any;
}

export interface EventSink {
  push(event: Event, recipients: ResourceId[]): Promise<void>;
}

export interface Event {
  timestamp: Date;
  type: 'warning' | 'info';
  title: string;
  message: string;
}

export interface Monitor<T> {
  start(): Promise<void>;

  stop(): Promise<void>;
}

export class Monitors {
  static createUnicast<T>(
    dataSource: PollableDataSource<T>,
    eventDetectionPipelines: Record<ParameterId, EventDetectionPipeline<T>>,
    dialectProgram: Program,
    monitorKeypair: Keypair,
  ): Monitor<T> {
    const eventSink = new DialectEventSink(dialectProgram, monitorKeypair);
    const subscriberRepository = InMemorySubscriberRepository.decorate(
      new OnChainSubscriberRepository(dialectProgram, monitorKeypair),
    );
    return new UnicastMonitor<T>(
      dataSource,
      eventDetectionPipelines,
      eventSink,
      subscriberRepository,
    );
  }
}
