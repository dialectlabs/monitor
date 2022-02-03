import { EventDetectionPipeline, Operators } from '../';
import { SomeOnChainObject } from './002-object-data-source';

export const dummyNumericPipeline: EventDetectionPipeline<number> = (source) =>
  source.pipe(
    Operators.Event.info(
      'Dummy numeric pipeline',
      ({ parameterId, data }) => `Hello world from ${parameterId}: ${data}`,
    ),
  );

export const dummyObjectPipeline: EventDetectionPipeline<SomeOnChainObject> = (
  source,
) =>
  source.pipe(
    Operators.Event.info(
      'Dummy object pipeline',
      ({ parameterId, data }) => `Hello world from ${parameterId}: ${data}`,
    ),
  );
