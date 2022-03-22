import { DefaultMonitorFactory } from './internal/default-monitor-factory';

import { ChooseDataSourceStep } from './monitor-builder';
import { MonitorFactory } from './monitor-factory';
import { ChooseDataSourceStepImpl } from './internal/monitor-builder';
import { Program } from '@project-serum/anchor';
import { Keypair } from '@solana/web3.js';
import { SubscriberRepository } from './ports';
import { ResourceEmailRepository } from './sengrid-email-notification-sink';

/**
 * Please specify either
 * 1. dialectProgram + monitorKeypair to use on-chain bindings of internal components
 * 2. notificationSink + subscriberRepository to run w/o chain dependency
 */
export interface MonitorProps {
  /**
   * Dialect program that will be used to interact with chain
   */
  dialectProgram?: Program;
  /**
   * Monitoring service keypair used to sign transactions to send messages and discover subscribers
   */
  monitorKeypair?: Keypair;
  /**
   * Allows to set custom subscriber repository
   */
  subscriberRepository?: SubscriberRepository;

  /**
   * Allows to set sinks configuration to send notifications
   */
  sinks?: SinksConfiguration;
}

export interface SinksConfiguration {
  email?: EmailSinkConfiguration;
}

export interface EmailSinkConfiguration {
  apiToken: string;
  senderEmail: string;
  resourceEmailRepository: ResourceEmailRepository;
}

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
  static builder(monitorProps: MonitorProps): ChooseDataSourceStep {
    return new ChooseDataSourceStepImpl(monitorProps);
  }

  /**
   * A more low-level way to create monitors
   */
  static factory(monitorProps: MonitorProps): MonitorFactory {
    if (!Monitors.factoryInstance) {
      Monitors.factoryInstance = new DefaultMonitorFactory(monitorProps);
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
