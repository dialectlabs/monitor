import { Duration } from 'luxon';
import {
  EventSink,
  PollableDataSource,
  SubscriberRepository,
  TransformationPipeline,
} from './ports';
import { Program } from '@project-serum/anchor';
import { Keypair } from '@solana/web3.js';
import { Monitor } from './monitor-api';
import { SubscriberEvent } from './data-model';

export interface MonitorBuilderProps {
  dialectProgram?: Program;
  monitorKeypair?: Keypair;
  eventSink?: EventSink;
  subscriberRepository?: SubscriberRepository;
}

export interface ChooseDataSourceStep {
  subscriberEvents(): AddTransformationsStep<SubscriberEvent>;

  defineDataSource<T extends object>(): DefineDataSourceStep<T>;
}

export interface DefineDataSourceStep<T extends object> {
  poll(
    dataSource: PollableDataSource<T>,
    pollInterval: Duration,
  ): AddTransformationsStep<T>;
}

export type KeysMatching<T extends object, V> = {
  [K in keyof T]: T[K] extends V ? K : never;
}[keyof T];

export interface Transformation<T extends object, V> {
  keys: KeysMatching<T, V>[];
  pipelines: TransformationPipeline<V>[];
}

export type DispatchStrategy = 'unicast';

export interface AddTransformationsStep<T extends object> {
  transform<V>(transformation: Transformation<T, V>): AddTransformationsStep<T>;

  dispatch(strategy: DispatchStrategy): BuildStep<T>;
}

export interface BuildStep<T extends object> {
  build(): Monitor<T>;
}
