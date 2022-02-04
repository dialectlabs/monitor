import {
  EventDetectionPipeline,
  Operators,
  PipeLogLevel,
  SubscriberEvent,
} from '../src';
import { SomeOnChainObject } from './002-object-data-source';

export const dummyNumericPipeline: EventDetectionPipeline<number> = (source) =>
  source.pipe(
    Operators.Event.info(
      'Dummy numeric pipeline',
      ({ resourceId, parameterData: { parameterId, data } }) =>
        `Hello world from (${resourceId}, ${parameterId}): ${data}`,
    ),
    Operators.Utility.log(PipeLogLevel.INFO),
  );

export const dummyNumericPipeline2: EventDetectionPipeline<number> = (source) =>
  source.pipe(
    Operators.Event.info(
      'Dummy numeric pipeline 2',
      ({ resourceId, parameterData: { parameterId, data } }) =>
        `Hello world from (${resourceId}, ${parameterId}): ${data}`,
    ),
    Operators.Utility.log(PipeLogLevel.INFO),
  );

export const dummyObjectPipeline: EventDetectionPipeline<SomeOnChainObject> = (
  source,
) =>
  source.pipe(
    Operators.Event.info(
      'Dummy object pipeline 2',
      ({ resourceId, parameterData: { parameterId, data } }) =>
        `Hello world from (${resourceId}, ${parameterId}): ${data}`,
    ),
    Operators.Utility.log(PipeLogLevel.INFO),
  );

export const welcomeMessagePipeline: EventDetectionPipeline<SubscriberEvent> = (
  source,
) =>
  source
    .pipe(Operators.Utility.log(PipeLogLevel.INFO))
    .pipe(
      Operators.Transform.filter(
        ({ parameterData: { data } }) => data === 'added',
      ),
    )
    .pipe(
      Operators.Event.info('Welcome', () => `Welcome message from example`),
    );
