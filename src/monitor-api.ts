import { DefaultMonitorFactory } from './internal/default-monitor-factory';

import { ChooseDataSourceStep } from './monitor-builder';
import { MonitorFactory } from './monitor-factory';
import { ChooseDataSourceStepImpl } from './internal/monitor-builder';
import { BlockchainSdk, DialectSdk } from '@dialectlabs/sdk';
import { SubscriberRepository } from './ports';
import { Duration } from 'luxon';

export type MonitorProps =
  | GenericMonitorProps<BlockchainSdk>
  | DialectSdkMonitorProps<BlockchainSdk>;

export interface GenericMonitorProps<ChainSdk extends BlockchainSdk> {
  subscriberRepository: SubscriberRepository;
  subscribersCacheTTL?: Duration;
  sinks?: SinksConfiguration<ChainSdk>;
}

export interface DialectSdkMonitorProps<ChainSdk extends BlockchainSdk> {
  sdk: DialectSdk<ChainSdk>;
  subscriberRepository?: SubscriberRepository;
  subscribersCacheTTL?: Duration;
  sinks?: Omit<SinksConfiguration<ChainSdk>, 'dialectThread' | 'dialectSdk'>;
}

export interface SinksConfiguration<ChainSdk extends BlockchainSdk> {
  email?: EmailSinkConfiguration;
  sms?: SmsSinkConfiguration;
  telegram?: TelegramSinkConfiguration;
  dialect?: DialectSinksConfiguration<ChainSdk>;
  solflare?: SolflareSinkConfiguration;
}

export interface EmailSinkConfiguration {
  apiToken: string;
  senderEmail: string;
}

export interface SmsSinkConfiguration {
  twilioUsername: string;
  twilioPassword: string;
  senderSmsNumber: string;
}

export interface TelegramSinkConfiguration {
  telegramBotToken: string;
}

export interface DialectSinksConfiguration<ChainSdk extends BlockchainSdk> {
  sdk: DialectSdk<ChainSdk>;
}

export interface SolflareSinkConfiguration {
  apiKey: string;
  apiUrl?: string;
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
  static factory(subscriberRepository: SubscriberRepository): MonitorFactory {
    if (!Monitors.factoryInstance) {
      Monitors.factoryInstance = new DefaultMonitorFactory(
        subscriberRepository,
      );
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
