import { Operators, PipeLogLevel } from './monitor-pipeline-operators';
import { EventDetectionPipeline } from './monitor';

export const dummyNumericPipeline2: EventDetectionPipeline<number> = (source) =>
  source.pipe(
    Operators.Event.info(
      'Dummy numeric pipeline 2',
      ({ resourceId, parameterData: { parameterId, data } }) =>
        `Hello world from (${resourceId}, ${parameterId}): ${data}`,
    ),
    Operators.Utility.log(PipeLogLevel.INFO),
  );

export const forward: EventDetectionPipeline<string> = (source) =>
  source.pipe(
    Operators.Event.info(
      'Dummy numeric pipeline 2',
      ({ resourceId, parameterData: { parameterId, data } }) =>
        `Hello world from (${resourceId}, ${parameterId}): ${data}`,
    ),
    Operators.Utility.log(PipeLogLevel.INFO),
  );

export class Pipelines {
  static fallingEdge(threshold: number) {
    return dummyNumericPipeline2;
  }

  static risingEdge(threshold: number) {
    return dummyNumericPipeline2;
  }

  static forward() {
    return forward;
  }
}
