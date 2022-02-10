import { DefaultMonitorFactory } from './internal/default-monitor-factory';

import { AddDataSourceStep, MonitorBuilderProps } from './monitor-builder';
import { MonitorFactory, MonitorFactoryProps } from './monitor-factory';
import {
  MonitorsBuilderState,
  SetDataSourceStepImpl,
} from './internal/monitor-builder';

/**
 * A monitor is an entity that is responsible for execution of unbounded streaming ETL (Extract, Transform, Load)
 * and connects DataSource, EventDetectionPipeline and EventSink
 */
export interface Monitor<T extends object> {
  start(): Promise<void>;

  stop(): Promise<void>;
}

export class Monitors<T extends object> {
  private static factories: Record<string, DefaultMonitorFactory>;
  private static factoryInstance: DefaultMonitorFactory;

  private constructor() {}

  static builder<T extends object>(
    builderProps: MonitorBuilderProps,
  ): AddDataSourceStep<T> {
    const monitorsBuilderSteps = new MonitorsBuilderState<T>(builderProps);
    return new SetDataSourceStepImpl(monitorsBuilderSteps);
  }

  static factory(props: MonitorFactoryProps): MonitorFactory {
    if (!Monitors.factoryInstance) {
      Monitors.factoryInstance = new DefaultMonitorFactory(props);
    }
    return Monitors.factoryInstance;
  }

  static async shutdown() {
    return Monitors.factoryInstance && Monitors.factoryInstance.shutdown();
  }
}
