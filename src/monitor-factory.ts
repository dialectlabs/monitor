import { Keypair } from '@solana/web3.js';
import { Program } from '@project-serum/anchor';
import { Duration } from 'luxon';
import {
  DataSourceTransformationPipeline,
  PollableDataSource,
  SubscriberRepository,
} from './ports';
import { Monitor } from './monitor-api';
import { SubscriberEvent } from './data-model';

export interface MonitorFactoryProps {
  dialectProgram?: Program;
  monitorKeypair?: Keypair;
  subscriberRepository?: SubscriberRepository;
}

export interface MonitorFactory {
  createUnicastMonitor<T extends object>(
    dataSource: PollableDataSource<T>,
    transformationPipelines: DataSourceTransformationPipeline<T, void[]>[],
    pollInterval: Duration,
  ): Monitor<T>;

  createSubscriberEventMonitor(
    eventDetectionPipelines: DataSourceTransformationPipeline<
      SubscriberEvent,
      void[]
    >[],
  ): Monitor<SubscriberEvent>;
}
