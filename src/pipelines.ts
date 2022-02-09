import { Operators, PipeLogLevel } from './monitor-pipeline-operators';
import { Event, ResourceData } from './monitor';
import { Observable } from 'rxjs';

export type DeveloperFacingEventDetectionPipeline<V> = (
  source: Observable<V>,
) => Observable<Event>;

export const dummyNumericPipeline2: DeveloperFacingEventDetectionPipeline<
  number
> = (source) =>
  source.pipe(
    Operators.Event.info(
      'Dummy numeric pipeline 2',
      (v) => `Hello world from ${v}`,
    ),
    Operators.Utility.log(PipeLogLevel.INFO),
  );

export const forward: DeveloperFacingEventDetectionPipeline<string> = (
  source,
) =>
  source.pipe(
    Operators.Event.info(
      'Dummy numeric pipeline 2',
      (v) => `Hello world from ${v}`,
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
