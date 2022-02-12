import { DefaultMonitorFactory } from './internal/default-monitor-factory';

import { ChooseDataSourceStep, MonitorBuilderProps } from './monitor-builder';
import { MonitorFactory, MonitorFactoryProps } from './monitor-factory';
import { ChooseDataSourceStepImpl } from './internal/monitor-builder';

/**
 * A monitor is an entity that is responsible for execution of unbounded streaming ETL (Extract, Transform, Load)
 * and includes data ingestion, transformation and dispatching notifications
 *  @typeParam T data source type

 */
export interface Monitor<T extends object> {
  start(): Promise<void>;

  stop(): Promise<void>;
}

/**
 * A main entry point that provides API to create new monitors either by step-by-step builder or factory
 */
export class Monitors<T extends object> {
  private static factoryInstance: DefaultMonitorFactory;

  private constructor() {}

  /**
   * A rich builder that guides developer on monitor creation step
   /**
   * Example:
   *
   * ```typescript
   * Monitors.builder({
   *  subscriberRepository: xxx,
   *  notificationSink: xxx,
   * })
   * .subscriberEvents()
   * .transform<SubscriberState>({
   *   keys: ['state'],
   *   pipelines: [
   *     Pipelines.sendMessageToNewSubscriber({
   *       title: 'Welcome title',
   *       messageBuilder: () => `Hi! Welcome onboard :)`,
   *     }),
   *   ],
   * })
   * .dispatch('unicast')
   * .build()
   * .start()
   * // run typedoc --help for a list of supported languages
   * const instance = new MyClass();
   * ```
   */
  static builder(builderProps: MonitorBuilderProps): ChooseDataSourceStep {
    return new ChooseDataSourceStepImpl(builderProps);
  }

  /**
   * A more low-level way to create monitors
   */
  static factory(props: MonitorFactoryProps): MonitorFactory {
    if (!Monitors.factoryInstance) {
      Monitors.factoryInstance = new DefaultMonitorFactory(props);
    }
    return Monitors.factoryInstance;
  }

  /**
   * Shutdowns monitor app and closes all related resources
   */
  static async shutdown() {
    return Monitors.factoryInstance && Monitors.factoryInstance.shutdown();
  }
}
