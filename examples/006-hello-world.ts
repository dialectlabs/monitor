import {
  EventDetectionPipeline,
  EventSink,
  ParameterId,
  PipeLogLevel,
  PollableDataSource,
  setPipeLogLevel,
} from '../src';
import { UnicastMonitor } from '../src/internal/unicast-monitor';
import {
  NUMERIC_PARAMETER1_ID,
  NUMERIC_PARAMETER2_ID,
  NumericDataSource,
} from './001-numeric-data-source';
import {
  dummyNumericPipeline,
  dummyNumericPipeline2,
} from './004-dummy-event-detection-pipelines';
import { ConsoleEventSink } from './005-console-event-sink';
import { DummySubscriberRepository } from './003-dummy-subscriber-repository';

const numericDataSource: PollableDataSource<number> = new NumericDataSource();
const subscriberRepository = new DummySubscriberRepository();
const numericDataSourceEventDetectionPipelines: Record<
  ParameterId,
  EventDetectionPipeline<number>[]
> = Object.fromEntries([
  [NUMERIC_PARAMETER1_ID, [dummyNumericPipeline, dummyNumericPipeline2]],
  [NUMERIC_PARAMETER2_ID, [dummyNumericPipeline]],
]);
const eventSink: EventSink = new ConsoleEventSink();

const unicastMonitor = new UnicastMonitor(
  numericDataSource,
  numericDataSourceEventDetectionPipelines,
  eventSink,
  subscriberRepository,
);

setPipeLogLevel(PipeLogLevel.INFO);
unicastMonitor.start();
