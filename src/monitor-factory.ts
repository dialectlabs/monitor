import { Duration } from 'luxon';
import { DataSource, DataSourceTransformationPipeline } from './ports';
import { Monitor } from './monitor-api';
import { SubscriberEvent } from './data-model';

export interface MonitorFactory {
  createBroadcastMonitor<T extends object>(
    dataSource: DataSource<T>,
    transformationPipelines: DataSourceTransformationPipeline<T, any>[],
    pollInterval: Duration,
  ): Monitor<T>;

  createSubscriberEventMonitor(
    eventDetectionPipelines: DataSourceTransformationPipeline<
      SubscriberEvent,
      any
    >[],
  ): Monitor<SubscriberEvent>;
}
