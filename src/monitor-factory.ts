import { Keypair } from '@solana/web3.js';
import { Program } from '@project-serum/anchor';
import { Duration } from 'luxon';
import {
  EventSink,
  PollableDataSource,
  SubscriberRepository,
  DataSourceTransformationPipeline,
} from './ports';
import { Monitor } from './monitor-api';

export interface MonitorFactoryProps {
  dialectProgram?: Program;
  monitorKeypair?: Keypair;
  eventSink?: EventSink;
  subscriberRepository?: SubscriberRepository;
}

export interface MonitorFactory {
  createUnicastMonitor<T extends object>(
    dataSource: PollableDataSource<T>,
    transformationPipelines: DataSourceTransformationPipeline<T>[],
    pollInterval: Duration,
  ): Monitor<T>;

  // createSubscriberEventMonitor(
  //   eventDetectionPipelines: MonitorEventDetectionPipeline<SubscriberEvent>[],
  // ): Monitor<SubscriberEvent>;
}
