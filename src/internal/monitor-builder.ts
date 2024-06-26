import {
  AddSinksStep,
  AddTransformationsStep,
  BuildStep,
  ChooseDataSourceStep,
  DefineDataSourceStep,
  DispatchStrategy,
  KeysMatching,
  NotificationMetadata,
  NotifyStep,
  Transformation,
} from '../monitor-builder';
import { Data, Notification, SubscriberEvent } from '../data-model';
import {
  ContextEnrichedPushyDataSource,
  DataSourceTransformationPipeline,
  NotificationSink,
  PollableDataSource,
  PushyDataSource,
  SubscriberRepository,
} from '../ports';
import { Duration } from 'luxon';
import { exhaustMap, from, Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { Monitor, MonitorProps, Monitors } from '../monitor-api';
import {
  DialectNotification,
  DialectThreadNotificationSink,
} from '../dialect-thread-notification-sink';
import {
  EmailNotification,
  SengridEmailNotificationSink,
} from '../sengrid-email-notification-sink';
import {
  SmsNotification,
  TwilioSmsNotificationSink,
} from '../twilio-sms-notification-sink';
import {
  TelegramNotification,
  TelegramNotificationSink,
} from '../telegram-notification-sink';
import {
  SolflareNotification,
  SolflareNotificationSink,
} from '../solflare-notification-sink';
import {
  DialectSdkNotification,
  DialectSdkNotificationSink,
} from '../dialect-sdk-notification-sink';
import { SubscriberRepositoryFactory } from './subscriber-repository-factory';
import { NotificationTypeEligibilityPredicate } from './notification-type-eligibility-predicate';

/**
 * A set of factory methods to create monitors
 */
export class MonitorsBuilderState<T extends object> {
  private readonly notificationTypeEligibilityPredicate: NotificationTypeEligibilityPredicate =
    NotificationTypeEligibilityPredicate.create();

  chooseDataSourceStep?: ChooseDataSourceStepImpl;
  defineDataSourceStep?: DefineDataSourceStepImpl<T>;
  addTransformationsStep?: AddTransformationsStepImpl<T>;

  dialectNotificationSink?: DialectThreadNotificationSink;
  dialectSdkNotificationSink?: DialectSdkNotificationSink;
  emailNotificationSink?: SengridEmailNotificationSink;
  smsNotificationSink?: TwilioSmsNotificationSink;
  telegramNotificationSink?: TelegramNotificationSink;
  solflareNotificationSink?: SolflareNotificationSink;

  static create<T extends object>(monitorProps: MonitorProps) {
    const subscriberRepositoryFactory = new SubscriberRepositoryFactory(
      monitorProps,
    );
    return new MonitorsBuilderState<T>(
      monitorProps,
      subscriberRepositoryFactory.create(),
    );
  }

  constructor(
    monitorProps: MonitorProps,
    readonly subscriberRepository: SubscriberRepository,
  ) {
    this.dialectNotificationSink =
      this.createDialectThreadNotificationSink(monitorProps);
    this.dialectSdkNotificationSink =
      this.createDialectSdkNotificationSink(monitorProps);
    const sinks = monitorProps?.sinks;
    if (sinks?.email) {
      this.emailNotificationSink = new SengridEmailNotificationSink(
        sinks.email.apiToken,
        sinks.email.senderEmail,
        this.subscriberRepository,
        this.notificationTypeEligibilityPredicate,
      );
    }
    if (sinks?.sms) {
      this.smsNotificationSink = new TwilioSmsNotificationSink(
        {
          username: sinks.sms.twilioUsername,
          password: sinks.sms.twilioPassword,
        },
        sinks.sms.senderSmsNumber,
        this.subscriberRepository,
        this.notificationTypeEligibilityPredicate,
      );
    }
    if (sinks?.telegram) {
      this.telegramNotificationSink = new TelegramNotificationSink(
        sinks.telegram.telegramBotToken,
        this.subscriberRepository,
        this.notificationTypeEligibilityPredicate,
      );
    }
    if (sinks?.solflare) {
      this.solflareNotificationSink = new SolflareNotificationSink(
        sinks.solflare.apiKey,
        sinks.solflare.apiUrl,
      );
    }
  }

  private createDialectThreadNotificationSink(monitorProps: MonitorProps) {
    if ('sdk' in monitorProps) {
      return new DialectThreadNotificationSink(
        monitorProps.sdk,
        this.subscriberRepository,
        this.notificationTypeEligibilityPredicate,
      );
    } else {
      const sdk = monitorProps.sinks?.dialect?.sdk;
      return (
        sdk &&
        new DialectThreadNotificationSink(
          sdk,
          this.subscriberRepository,
          this.notificationTypeEligibilityPredicate,
        )
      );
    }
  }

  private createDialectSdkNotificationSink(monitorProps: MonitorProps) {
    if ('sdk' in monitorProps) {
      return new DialectSdkNotificationSink(
        monitorProps.sdk,
        this.subscriberRepository,
      );
    } else {
      const sdk = monitorProps.sinks?.dialect?.sdk;
      return (
        sdk && new DialectSdkNotificationSink(sdk, this.subscriberRepository)
      );
    }
  }
}

type DataSourceType = 'user-defined' | 'subscriber-events';

export class ChooseDataSourceStepImpl implements ChooseDataSourceStep {
  dataSourceType?: DataSourceType;

  constructor(readonly monitorProps: MonitorProps) {}

  subscriberEvents(): AddTransformationsStep<SubscriberEvent> {
    this.dataSourceType = 'subscriber-events';
    const monitorsBuilderState = MonitorsBuilderState.create<SubscriberEvent>(
      this.monitorProps,
    );
    monitorsBuilderState.chooseDataSourceStep = this;
    return new AddTransformationsStepImpl<SubscriberEvent>(
      monitorsBuilderState,
    );
  }

  defineDataSource<T extends object>(): DefineDataSourceStep<T> {
    this.dataSourceType = 'user-defined';
    const monitorsBuilderState = MonitorsBuilderState.create<T>(
      this.monitorProps,
    );
    monitorsBuilderState.chooseDataSourceStep = this;
    return new DefineDataSourceStepImpl<T>(monitorsBuilderState);
  }
}

type DataSourceStrategy = 'push' | 'poll';

export class DefineDataSourceStepImpl<T extends object>
  implements DefineDataSourceStep<T>
{
  dataSourceStrategy?: DataSourceStrategy;
  pushyDataSource?: PushyDataSource<T>;
  pollableDataSource?: PollableDataSource<T>;
  pollInterval?: Duration;

  constructor(private readonly monitorBuilderState: MonitorsBuilderState<T>) {
    this.monitorBuilderState.defineDataSourceStep = this;
  }

  poll(
    dataSource: PollableDataSource<T>,
    pollInterval: Duration,
  ): AddTransformationsStep<T> {
    this.pollableDataSource = dataSource;
    this.pollInterval = pollInterval;
    this.dataSourceStrategy = 'poll';
    return new AddTransformationsStepImpl(this.monitorBuilderState);
  }

  push(dataSource: PushyDataSource<T>): AddTransformationsStep<T> {
    this.pushyDataSource = dataSource;
    this.dataSourceStrategy = 'push';
    return new AddTransformationsStepImpl(this.monitorBuilderState);
  }
}

class AddTransformationsStepImpl<T extends object>
  implements AddTransformationsStep<T>
{
  dataSourceTransformationPipelines: DataSourceTransformationPipeline<
    T,
    any
  >[] = [];

  constructor(readonly monitorBuilderState: MonitorsBuilderState<T>) {
    monitorBuilderState.addTransformationsStep = this;
  }

  notify(metadata?: NotificationMetadata): AddSinksStep<T, T> {
    const identityTransformation: DataSourceTransformationPipeline<
      T,
      Data<T, T>
    > = (dataSource) => dataSource;
    this.dataSourceTransformationPipelines.push(identityTransformation);
    return new AddSinksStepImpl(
      this,
      this.dataSourceTransformationPipelines,
      metadata,
      this.monitorBuilderState.dialectNotificationSink,
      this.monitorBuilderState.dialectSdkNotificationSink,
      this.monitorBuilderState.emailNotificationSink,
      this.monitorBuilderState.smsNotificationSink,
      this.monitorBuilderState.telegramNotificationSink,
      this.monitorBuilderState.solflareNotificationSink,
    );
  }

  transform<V, R>(transformation: Transformation<T, V, R>): NotifyStep<T, R> {
    const dataSourceTransformationPipelines: DataSourceTransformationPipeline<
      T,
      Data<R, T>
    >[] = [];

    const { keys, pipelines } = transformation;
    const adaptedToDataSourceTypePipelines: ((
      dataSource: ContextEnrichedPushyDataSource<T>,
    ) => Observable<Data<R, T>>)[] = keys.flatMap((key: KeysMatching<T, V>) =>
      pipelines.map(
        (
          pipeline: (source: Observable<Data<V, T>>) => Observable<Data<R, T>>,
        ) => {
          const adaptedToDataSourceType: (
            dataSource: ContextEnrichedPushyDataSource<T>,
          ) => Observable<Data<R, T>> = (
            dataSource: ContextEnrichedPushyDataSource<T>,
          ) =>
            pipeline(
              dataSource.pipe(
                map((it) => ({
                  ...it,
                  value: it.value[key] as unknown as V,
                })),
              ),
            );
          return adaptedToDataSourceType;
        },
      ),
    );
    dataSourceTransformationPipelines.push(...adaptedToDataSourceTypePipelines);
    return new NotifyStepImpl(
      this,
      dataSourceTransformationPipelines,
      this.monitorBuilderState,
    );
  }
}

class NotifyStepImpl<T extends object, R> implements NotifyStep<T, R> {
  constructor(
    private readonly addTransformationsStep: AddTransformationsStepImpl<T>,
    private readonly dataSourceTransformationPipelines: DataSourceTransformationPipeline<
      T,
      Data<R, T>
    >[],
    private readonly monitorBuilderState: MonitorsBuilderState<T>,
  ) {}

  notify(metadata?: NotificationMetadata): AddSinksStep<T, R> {
    return new AddSinksStepImpl(
      this.addTransformationsStep,
      this.dataSourceTransformationPipelines,
      metadata,
      this.monitorBuilderState.dialectNotificationSink,
      this.monitorBuilderState.dialectSdkNotificationSink,
      this.monitorBuilderState.emailNotificationSink,
      this.monitorBuilderState.smsNotificationSink,
      this.monitorBuilderState.telegramNotificationSink,
      this.monitorBuilderState.solflareNotificationSink,
    );
  }
}

class AddSinksStepImpl<T extends object, R> implements AddSinksStep<T, R> {
  private sinkWriters: ((data: Data<R, T>) => Promise<any>)[] = [];

  constructor(
    private readonly addTransformationsStep: AddTransformationsStepImpl<T>,
    private readonly dataSourceTransformationPipelines: DataSourceTransformationPipeline<
      T,
      Data<R, T>
    >[],
    private readonly notificationMetadata?: NotificationMetadata,
    private readonly dialectNotificationSink?: DialectThreadNotificationSink,
    private readonly dialectSdkNotificationSink?: DialectSdkNotificationSink,
    private readonly emailNotificationSink?: SengridEmailNotificationSink,
    private readonly smsNotificationSink?: TwilioSmsNotificationSink,
    private readonly telegramNotificationSink?: TelegramNotificationSink,
    private readonly solflareNotificationSink?: SolflareNotificationSink,
  ) {}

  also(): AddTransformationsStep<T> {
    this.populateDataSourceTransformationPipelines();
    return this.addTransformationsStep!;
  }

  dialectThread(
    adapter: (data: Data<R, T>) => DialectNotification,
    dispatchStrategy: DispatchStrategy<T>,
  ): AddSinksStep<T, R> {
    if (!this.dialectNotificationSink) {
      throw new Error(
        'Dialect notification sink must be initialized before using',
      );
    }
    return this.custom(adapter, this.dialectNotificationSink, dispatchStrategy);
  }

  dialectSdk(
    adapter: (data: Data<R, T>) => DialectSdkNotification,
    dispatchStrategy: DispatchStrategy<T>,
  ): AddSinksStep<T, R> {
    if (!this.dialectSdkNotificationSink) {
      throw new Error(
        'Dialect Cloud notification sink must be initialized before using',
      );
    }
    return this.custom(
      adapter,
      this.dialectSdkNotificationSink,
      dispatchStrategy,
    );
  }

  custom<N extends Notification>(
    adapter: (data: Data<R, T>) => N,
    sink: NotificationSink<N>,
    dispatchStrategy: DispatchStrategy<T>,
  ) {
    const sinkWriter: (data: Data<R, T>) => Promise<void> = (data) => {
      const toBeNotified = this.selectResources(dispatchStrategy, data);
      return sink!.push(adapter(data), toBeNotified, {
        dispatchType: dispatchStrategy.dispatch,
        notificationMetadata: this.notificationMetadata,
      });
    };
    this.sinkWriters.push(sinkWriter);
    return this;
  }

  email(
    adapter: (data: Data<R, T>) => EmailNotification,
    dispatchStrategy: DispatchStrategy<T>,
  ): AddSinksStep<T, R> {
    if (!this.emailNotificationSink) {
      throw new Error(
        'Email notification sink must be initialized before using',
      );
    }
    return this.custom(adapter, this.emailNotificationSink, dispatchStrategy);
  }

  sms(
    adapter: (data: Data<R, T>) => SmsNotification,
    dispatchStrategy: DispatchStrategy<T>,
  ): AddSinksStep<T, R> {
    if (!this.smsNotificationSink) {
      throw new Error('SMS notification sink must be initialized before using');
    }
    return this.custom(adapter, this.smsNotificationSink, dispatchStrategy);
  }

  telegram(
    adapter: (data: Data<R, T>) => TelegramNotification,
    dispatchStrategy: DispatchStrategy<T>,
  ): AddSinksStep<T, R> {
    if (!this.telegramNotificationSink) {
      throw new Error(
        'Telegram notification sink must be initialized before using',
      );
    }
    return this.custom(
      adapter,
      this.telegramNotificationSink,
      dispatchStrategy,
    );
  }

  solflare(
    adapter: (data: Data<R, T>) => SolflareNotification,
    dispatchStrategy: DispatchStrategy<T>,
  ): AddSinksStep<T, R> {
    if (!this.solflareNotificationSink) {
      throw new Error(
        'Solflare notification sink must be initialized before using',
      );
    }
    return this.custom(
      adapter,
      this.solflareNotificationSink,
      dispatchStrategy,
    );
  }

  and(): BuildStep<T> {
    this.populateDataSourceTransformationPipelines();
    return new BuildStepImpl(this.addTransformationsStep!.monitorBuilderState);
  }

  private populateDataSourceTransformationPipelines() {
    const transformAndLoadPipelines: DataSourceTransformationPipeline<
      T,
      any
    >[] = this.dataSourceTransformationPipelines.map(
      (
        dataSourceTransformationPipeline: DataSourceTransformationPipeline<
          T,
          Data<R, T>
        >,
      ) => {
        const transformAndLoadPipeline: DataSourceTransformationPipeline<
          T,
          any
        > = (dataSource) =>
          dataSourceTransformationPipeline(dataSource).pipe(
            exhaustMap((event) =>
              from(Promise.all(this.sinkWriters.map((it) => it(event)))),
            ),
          );
        return transformAndLoadPipeline;
      },
    );
    this.addTransformationsStep.dataSourceTransformationPipelines.push(
      ...transformAndLoadPipelines,
    );
  }

  private selectResources(
    dispatchStrategy: DispatchStrategy<T>,
    { context }: Data<R, T>,
  ) {
    switch (dispatchStrategy.dispatch) {
      case 'broadcast': {
        return context.subscribers.map(({ resourceId }) => resourceId);
      }
      case 'unicast': {
        return [dispatchStrategy.to(context)];
      }
      case 'multicast': {
        return dispatchStrategy.to(context);
      }
    }
  }
}

class BuildStepImpl<T extends object> implements BuildStep<T> {
  constructor(private readonly monitorBuilderState: MonitorsBuilderState<T>) {}

  build(): Monitor<T> {
    const {
      subscriberRepository,
      chooseDataSourceStep,
      defineDataSourceStep,
      addTransformationsStep,
    } = this.monitorBuilderState;

    if (!chooseDataSourceStep || !addTransformationsStep) {
      throw new Error(
        'Expected [monitorProps, chooseDataSourceStep, addTransformationsStep] to be defined',
      );
    }
    switch (chooseDataSourceStep.dataSourceType) {
      case 'user-defined': {
        if (!defineDataSourceStep) {
          throw new Error('Expected data source to be defined');
        }
        return this.createUserDefinedMonitor(
          defineDataSourceStep,
          addTransformationsStep,
          subscriberRepository,
        );
      }
      case 'subscriber-events': {
        return this.buildSubscriberEventMonitor(
          addTransformationsStep,
          subscriberRepository,
        );
      }
      default: {
        throw new Error(
          `Unexpected data source type: ${chooseDataSourceStep.dataSourceType}`,
        );
      }
    }
  }

  private buildSubscriberEventMonitor(
    addTransformationsStep: AddTransformationsStepImpl<T>,
    subscriberRepository: SubscriberRepository,
  ) {
    const { dataSourceTransformationPipelines } = addTransformationsStep;
    if (!dataSourceTransformationPipelines) {
      throw new Error(
        'Expected [dataSourceTransformationPipelines] to be defined',
      );
    }
    return Monitors.factory(subscriberRepository).createSubscriberEventMonitor(
      dataSourceTransformationPipelines as unknown as DataSourceTransformationPipeline<
        SubscriberEvent,
        any
      >[],
    );
  }

  private createUserDefinedMonitor(
    defineDataSourceStep: DefineDataSourceStepImpl<T>,
    addTransformationsStep: AddTransformationsStepImpl<T>,
    subscriberRepository: SubscriberRepository,
  ) {
    const { dataSourceStrategy } = defineDataSourceStep;
    switch (dataSourceStrategy) {
      case 'poll':
        return this.createForPollable(
          defineDataSourceStep,
          addTransformationsStep,
          subscriberRepository,
        );
      case 'push':
        return this.createForPushy(
          defineDataSourceStep,
          addTransformationsStep,
          subscriberRepository,
        );
      default:
        throw new Error('Expected data source strategy to be defined');
    }
  }

  private createForPollable(
    defineDataSourceStep: DefineDataSourceStepImpl<T>,
    addTransformationsStep: AddTransformationsStepImpl<T>,
    subscriberRepository: SubscriberRepository,
  ) {
    const { pollableDataSource, pollInterval } = defineDataSourceStep;
    const { dataSourceTransformationPipelines } = addTransformationsStep;
    if (
      !pollableDataSource ||
      !pollInterval ||
      !dataSourceTransformationPipelines
    ) {
      throw new Error(
        'Expected [pollableDataSource, pollInterval, dataSourceTransformationPipelines] to be defined',
      );
    }
    return Monitors.factory(subscriberRepository).createDefaultMonitor<T>(
      pollableDataSource,
      dataSourceTransformationPipelines,
      pollInterval,
    );
  }

  private createForPushy(
    defineDataSourceStep: DefineDataSourceStepImpl<T>,
    addTransformationsStep: AddTransformationsStepImpl<T>,
    subscriberRepository: SubscriberRepository,
  ) {
    const { pushyDataSource } = defineDataSourceStep;
    const { dataSourceTransformationPipelines } = addTransformationsStep;
    if (!pushyDataSource || !dataSourceTransformationPipelines) {
      throw new Error(
        'Expected [pushyDataSource, dataSourceTransformationPipelines] to be defined',
      );
    }
    return Monitors.factory(subscriberRepository).createDefaultMonitor<T>(
      pushyDataSource,
      dataSourceTransformationPipelines,
      Duration.fromObject({ seconds: 1 }), // TODO: make optional
    );
  }
}
