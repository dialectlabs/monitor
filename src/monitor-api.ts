import { DefaultMonitorFactory } from './internal/default-monitor-factory';

import { ChooseDataSourceStep } from './monitor-builder';
import { MonitorFactory } from './monitor-factory';
import { ChooseDataSourceStepImpl } from './internal/monitor-builder';
import { DialectSdk } from '@dialectlabs/sdk';
import { SubscriberRepository } from './ports';

export type MonitorProps = GenericMonitorProps | DialectSdkMonitorProps;

export interface GenericMonitorProps {
  subscriberRepository: SubscriberRepository;
  sinks?: SinksConfiguration;
}

export interface DialectSdkMonitorProps {
  sdk: DialectSdk;
  subscriberRepository?: SubscriberRepository;
  sinks?: Omit<SinksConfiguration, 'wallet'>;
}

export interface SinksConfiguration {
  email?: EmailSinkConfiguration;
  sms?: SmsSinkConfiguration;
  telegram?: TelegramSinkConfiguration;
  wallet?: WalletSinkConfiguration;
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

export interface WalletSinkConfiguration {
  sdk: DialectSdk;
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
