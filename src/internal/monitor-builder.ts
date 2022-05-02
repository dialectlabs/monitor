import {
  AddSinksStep,
  AddTransformationsStep,
  BuildStep,
  ChooseDataSourceStep,
  DefineDataSourceStep,
  DispatchStrategy,
  KeysMatching,
  NotifyStep,
  Transformation,
} from '../monitor-builder';
import { Data, ResourceId, SubscriberEvent } from '../data-model';
import {
  DataSourceTransformationPipeline,
  NotificationSink,
  PollableDataSource,
  PushyDataSource,
} from '../ports';
import { Duration } from 'luxon';
import { exhaustMap, from, Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { Monitor, MonitorProps, Monitors } from '../monitor-api';
import {
  DialectNotification,
  DialectNotificationSink,
} from '../dialect-notification-sink';
import {
  EmailNotification,
  SengridEmailNotificationSink,
} from '../sengrid-email-notification-sink';
import { SmsNotification, TwilioSmsNotificationSink } from '../twilio-sms-notification-sink';
import { TelegramNotification, TelegramNotificationSink } from '../telegram-notification-sink';
import { OnChainSubscriberRepository } from './on-chain-subscriber.repository';
import { InMemorySubscriberRepository } from './in-memory-subscriber.repository';

/**
 * A set of factory methods to create monitors
 */
export class MonitorsBuilderState<T extends object> {
  chooseDataSourceStep?: ChooseDataSourceStepImpl;
  defineDataSourceStep?: DefineDataSourceStepImpl<T>;
  addTransformationsStep?: AddTransformationsStepImpl<T>;

  dialectNotificationSink?: DialectNotificationSink;
  emailNotificationSink?: SengridEmailNotificationSink;
  smsNotificationSink?: TwilioSmsNotificationSink;
  telegramNotificationSink?: TelegramNotificationSink;

  constructor(readonly monitorProps: MonitorProps) {
    if (monitorProps.dialectProgram && monitorProps.monitorKeypair) {
      if (!monitorProps.subscriberRepository) {
        const onChainSubscriberRepository = new OnChainSubscriberRepository(
          monitorProps.dialectProgram,
          monitorProps.monitorKeypair,
        );
        monitorProps.subscriberRepository =
          InMemorySubscriberRepository.decorate(onChainSubscriberRepository);
      }
      this.dialectNotificationSink = new DialectNotificationSink(
        monitorProps.dialectProgram,
        monitorProps.monitorKeypair,
        monitorProps.subscriberRepository,
      );
    }
    const sinks = monitorProps?.sinks;
    if (sinks?.email) {
      this.emailNotificationSink = new SengridEmailNotificationSink(
        sinks.email.apiToken,
        sinks.email.senderEmail,
        sinks.email.resourceEmailRepository,
      );
    }
    if (sinks?.sms) {
      this.smsNotificationSink = new TwilioSmsNotificationSink(
        { username: sinks.sms.twilioUsername, password: sinks.sms.twilioPassword },
        sinks.sms.senderSmsNumber,
        sinks.sms.resourceSmsNumberRepository,
      );
    }
    if (sinks?.telegram) {
      this.telegramNotificationSink = new TelegramNotificationSink(
        sinks.telegram.telegramBotToken,
        sinks.telegram.resourceTelegramChatIdRepository,
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
    const monitorsBuilderState = new MonitorsBuilderState<SubscriberEvent>(
      this.monitorProps,
    );
    monitorsBuilderState.chooseDataSourceStep = this;
    return new AddTransformationsStepImpl<SubscriberEvent>(
      monitorsBuilderState,
    );
  }

  defineDataSource<T extends object>(): DefineDataSourceStep<T> {
    this.dataSourceType = 'user-defined';
    const monitorsBuilderState = new MonitorsBuilderState<T>(this.monitorProps);
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

  dispatchStrategy?: DispatchStrategy;

  constructor(private readonly monitorBuilderState: MonitorsBuilderState<T>) {
    monitorBuilderState.addTransformationsStep = this;
  }

  notify(): AddSinksStep<T, T> {
    const identityTransformation: DataSourceTransformationPipeline<
      T,
      Data<T, T>
    > = (dataSource) =>
      dataSource.pipe(
        map(({ data: value, resourceId }) => ({
          context: {
            origin: value,
            resourceId,
            trace: [],
          },
          value,
        })),
      );
    this.dataSourceTransformationPipelines.push(identityTransformation);
    return new AddSinksStepImpl(
      this,
      this.dataSourceTransformationPipelines,
      this.monitorBuilderState.dialectNotificationSink,
      this.monitorBuilderState.emailNotificationSink,
    );
  }

  dispatch(strategy: DispatchStrategy): BuildStep<T> {
    this.dispatchStrategy = strategy;
    return new BuildStepImpl(this.monitorBuilderState!);
  }

  transform<V, R>(transformation: Transformation<T, V, R>): NotifyStep<T, R> {
    const dataSourceTransformationPipelines: DataSourceTransformationPipeline<
      T,
      Data<R, T>
    >[] = [];

    const { keys, pipelines } = transformation;
    const adaptedToDataSourceTypePipelines: ((
      dataSource: PushyDataSource<T>,
    ) => Observable<Data<R, T>>)[] = keys.flatMap((key: KeysMatching<T, V>) =>
      pipelines.map(
        (
          pipeline: (source: Observable<Data<V, T>>) => Observable<Data<R, T>>,
        ) => {
          const adaptedToDataSourceType: (
            dataSource: PushyDataSource<T>,
          ) => Observable<Data<R, T>> = (dataSource: PushyDataSource<T>) =>
            pipeline(
              dataSource.pipe(
                map(({ data: origin, resourceId }) => ({
                  context: {
                    origin,
                    resourceId,
                    trace: [],
                  },
                  value: origin[key] as unknown as V,
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

  notify(): AddSinksStep<T, R> {
    return new AddSinksStepImpl(
      this.addTransformationsStep,
      this.dataSourceTransformationPipelines,
      this.monitorBuilderState.dialectNotificationSink,
      this.monitorBuilderState.emailNotificationSink,
      this.monitorBuilderState.smsNotificationSink,
      this.monitorBuilderState.telegramNotificationSink,
    );
  }
}

class AddSinksStepImpl<T extends object, R> implements AddSinksStep<T, R> {
  private sinkWriters: ((
    data: Data<R, T>,
    resources: ResourceId[],
  ) => Promise<any>)[] = [];

  constructor(
    private readonly addTransformationsStep: AddTransformationsStepImpl<T>,
    private readonly dataSourceTransformationPipelines: DataSourceTransformationPipeline<
      T,
      Data<R, T>
    >[],
    private readonly dialectNotificationSink?: DialectNotificationSink,
    private readonly emailNotificationSink?: SengridEmailNotificationSink,
    private readonly smsNotificationSink?: TwilioSmsNotificationSink,
    private readonly telegramNotificationSink?: TelegramNotificationSink,
  ) {}

  and(): AddTransformationsStep<T> {
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
        > = (dataSource, targets) =>
          dataSourceTransformationPipeline(dataSource, targets).pipe(
            exhaustMap((event) =>
              from(
                Promise.all(this.sinkWriters.map((it) => it(event, targets))),
              ),
            ),
          );
        return transformAndLoadPipeline;
      },
    );
    this.addTransformationsStep.dataSourceTransformationPipelines.push(
      ...transformAndLoadPipelines,
    );
    return this.addTransformationsStep!;
  }

  dialectThread(
    adapter: (data: Data<R, T>) => DialectNotification,
    recipientPredicate?: (data: Data<R, T>, recipient: ResourceId) => boolean,
  ): AddSinksStep<T, R> {
    if (!this.dialectNotificationSink) {
      throw new Error(
        'Dialect notification sink must be initialized before using',
      );
    }
    const sinkWriter: (
      data: Data<R, T>,
      resources: ResourceId[],
    ) => Promise<void> = (data, resources) =>
      this.dialectNotificationSink!.push(
        adapter(data),
        resources.filter((it) =>
          recipientPredicate ? recipientPredicate(data, it) : true,
        ),
      );
    this.sinkWriters.push(sinkWriter);
    return this;
  }

  custom<N>(
    adapter: (data: Data<R, T>) => N,
    sink: NotificationSink<N>,
    recipientPredicate?: (data: Data<R, T>, recipient: ResourceId) => boolean,
  ) {
    const sinkWriter: (
      data: Data<R, T>,
      resources: ResourceId[],
    ) => Promise<void> = (data, resources) =>
      sink.push(
        adapter(data),
        resources.filter((it) =>
          recipientPredicate ? recipientPredicate(data, it) : true,
        ),
      );
    this.sinkWriters.push(sinkWriter);
    return this;
  }

  email(
    adapter: (data: Data<R, T>) => EmailNotification,
    recipientPredicate?: (data: Data<R, T>, recipient: ResourceId) => boolean,
  ): AddSinksStep<T, R> {
    if (!this.emailNotificationSink) {
      throw new Error(
        'Email notification sink must be initialized before using',
      );
    }
    const sinkWriter: (
      data: Data<R, T>,
      resources: ResourceId[],
    ) => Promise<void> = (data, resources) =>
      this.emailNotificationSink!.push(
        adapter(data),
        resources.filter((it) =>
          recipientPredicate ? recipientPredicate(data, it) : true,
        ),
      );
    this.sinkWriters.push(sinkWriter);
    return this;
  }

  sms(
    adapter: (data: Data<R, T>) => SmsNotification,
    recipientPredicate?: (data: Data<R, T>, recipient: ResourceId) => boolean,
  ): AddSinksStep<T, R> {
    if (!this.smsNotificationSink) {
      throw new Error(
        'SMS notification sink must be initialized before using',
      );
    }
    const sinkWriter: (
      data: Data<R, T>,
      resources: ResourceId[],
    ) => Promise<void> = (data, resources) =>
      this.smsNotificationSink!.push(
        adapter(data),
        resources.filter((it) =>
          recipientPredicate ? recipientPredicate(data, it) : true,
        ),
      );
    this.sinkWriters.push(sinkWriter);
    return this;
  }

  telegram(
    adapter: (data: Data<R, T>) => TelegramNotification,
    recipientPredicate?: (data: Data<R, T>, recipient: ResourceId) => boolean,
  ): AddSinksStep<T, R> {
    if (!this.telegramNotificationSink) {
      throw new Error(
        'Telegram notification sink must be initialized before using',
      );
    }
    const sinkWriter: (
      data: Data<R, T>,
      resources: ResourceId[],
    ) => Promise<void> = (data, resources) =>
      this.telegramNotificationSink!.push(
        adapter(data),
        resources.filter((it) =>
          recipientPredicate ? recipientPredicate(data, it) : true,
        ),
      );
    this.sinkWriters.push(sinkWriter);
    return this;
  }
}

class BuildStepImpl<T extends object> implements BuildStep<T> {
  constructor(private readonly monitorBuilderState: MonitorsBuilderState<T>) {}

  build(): Monitor<T> {
    const {
      monitorProps,
      chooseDataSourceStep,
      defineDataSourceStep,
      addTransformationsStep,
    } = this.monitorBuilderState;

    if (!monitorProps || !chooseDataSourceStep || !addTransformationsStep) {
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
          monitorProps,
        );
      }
      case 'subscriber-events': {
        return this.buildSubscriberEventMonitor(
          addTransformationsStep,
          monitorProps,
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
    monitorProps: MonitorProps,
  ) {
    const { dataSourceTransformationPipelines, dispatchStrategy } =
      addTransformationsStep;
    if (!dataSourceTransformationPipelines || !dispatchStrategy) {
      throw new Error(
        'Expected [dataSourceTransformationPipelines, dispatchStrategy] to be defined',
      );
    }
    return Monitors.factory(monitorProps).createSubscriberEventMonitor(
      dataSourceTransformationPipelines as unknown as DataSourceTransformationPipeline<
        SubscriberEvent,
        any
      >[],
    );
  }

  private createUserDefinedMonitor(
    defineDataSourceStep: DefineDataSourceStepImpl<T>,
    addTransformationsStep: AddTransformationsStepImpl<T>,
    monitorProps: MonitorProps,
  ) {
    const { dataSourceStrategy } = defineDataSourceStep;
    switch (dataSourceStrategy) {
      case 'poll':
        return this.createForPollable(
          defineDataSourceStep,
          addTransformationsStep,
          monitorProps,
        );
      case 'push':
        return this.createForPushy(
          defineDataSourceStep,
          addTransformationsStep,
          monitorProps,
        );
      default:
        throw new Error('Expected data source strategy to be defined');
    }
  }

  private createForPollable(
    defineDataSourceStep: DefineDataSourceStepImpl<T>,
    addTransformationsStep: AddTransformationsStepImpl<T>,
    monitorProps: MonitorProps,
  ) {
    const { pollableDataSource, pollInterval } = defineDataSourceStep;
    const { dataSourceTransformationPipelines, dispatchStrategy } =
      addTransformationsStep;
    if (
      !pollableDataSource ||
      !pollInterval ||
      !dataSourceTransformationPipelines ||
      !dispatchStrategy
    ) {
      throw new Error(
        'Expected [pollableDataSource, pollInterval, dataSourceTransformationPipelines, dispatchStrategy] to be defined',
      );
    }

    switch (addTransformationsStep.dispatchStrategy) {
      case 'broadcast':
        return Monitors.factory(monitorProps).createBroadcastMonitor<T>(
          pollableDataSource,
          dataSourceTransformationPipelines,
          pollInterval,
        );
      case 'unicast':
        return Monitors.factory(monitorProps).createUnicastMonitor<T>(
          pollableDataSource,
          dataSourceTransformationPipelines,
          pollInterval,
        );
      default:
        throw new Error(
          'Unknown dispatchStrategy: ' +
            addTransformationsStep.dispatchStrategy,
        );
    }
  }

  private createForPushy(
    defineDataSourceStep: DefineDataSourceStepImpl<T>,
    addTransformationsStep: AddTransformationsStepImpl<T>,
    monitorProps: MonitorProps,
  ) {
    const { pushyDataSource } = defineDataSourceStep;
    const { dataSourceTransformationPipelines, dispatchStrategy } =
      addTransformationsStep;
    if (
      !pushyDataSource ||
      !dataSourceTransformationPipelines ||
      !dispatchStrategy
    ) {
      throw new Error(
        'Expected [pushyDataSource, dataSourceTransformationPipelines, dispatchStrategy] to be defined',
      );
    }
    return Monitors.factory(monitorProps).createUnicastMonitor<T>(
      pushyDataSource,
      dataSourceTransformationPipelines,
      Duration.fromObject({ seconds: 1 }), // TODO: make optional
    );
  }
}
