import {
  EventDetectionPipeline,
  Monitors,
  ParameterId,
  PipeLogLevel,
  PollableDataSource,
  setPipeLogLevel,
} from '..';
import {
  NUMERIC_PARAMETER1_ID,
  NUMERIC_PARAMETER2_ID,
  NumericDataSource,
} from './001-numeric-data-source';
import {
  dummyNumericPipeline,
  dummyNumericPipeline2,
  welcomeMessagePipeline,
} from './004-dummy-event-detection-pipelines';
import { ConsoleEventSink } from './005-console-event-sink';
import { DummySubscriberRepository } from './003-dummy-subscriber-repository';
import { Duration } from 'luxon';
import { Keypair } from '@solana/web3.js';

const numericDataSource: PollableDataSource<number> = new NumericDataSource();
const numericDataSourceEventDetectionPipelines: Record<
  ParameterId,
  EventDetectionPipeline<number>[]
> = Object.fromEntries([
  [NUMERIC_PARAMETER1_ID, [dummyNumericPipeline, dummyNumericPipeline2]],
  [NUMERIC_PARAMETER2_ID, [dummyNumericPipeline]],
]);

const dummySubscriberRepository = new DummySubscriberRepository(10);
const monitorFactory = Monitors.factory({
  eventSink: new ConsoleEventSink(),
  subscriberRepository: dummySubscriberRepository,
});

const subscriberEventMonitor = monitorFactory.createSubscriberEventMonitor([
  welcomeMessagePipeline,
]);
subscriberEventMonitor
  .start()
  .then(() =>
    dummySubscriberRepository.addNewSubscriber(new Keypair().publicKey),
  );

const unicastMonitor = monitorFactory.createUnicastMonitor(
  numericDataSource,
  numericDataSourceEventDetectionPipelines,
  Duration.fromObject({ seconds: 5 }),
);

setPipeLogLevel(PipeLogLevel.INFO);
unicastMonitor.start();
