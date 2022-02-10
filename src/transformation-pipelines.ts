import { Data, SubscriberState } from './data-model';
import { Operators, PipeLogLevel } from './transformation-pipeline-operators';
import { TransformationPipeline } from './ports';

export const dummyNumericPipeline1: TransformationPipeline<number> = (source) =>
  source.pipe(
    Operators.Event.info(
      'Dummy numeric TransformationPipeline 1',
      (v: Data<number>) => `Hello world for user ${v.resourceId} from p1 ${v}`,
    ),
    Operators.Utility.log(PipeLogLevel.INFO),
  );

export const dummyNumericPipeline2: TransformationPipeline<number> = (source) =>
  source.pipe(
    Operators.Event.info(
      'Dummy numeric TransformationPipeline 2',
      (v: Data<number>) => `Hello world  for user ${v.resourceId} from p2 ${v}`,
    ),
    Operators.Utility.log(PipeLogLevel.INFO),
  );

export const generateWelcomeMessage: TransformationPipeline<SubscriberState> = (
  source,
) =>
  source.pipe(Operators.Transform.filter(({ data }) => data === 'added')).pipe(
    Operators.Event.info(
      'Welcome',
      (v) => `Thanks for subscribing for notifications (managed by Dialect). 
You'll receive notifications about xxx.`,
    ),
    Operators.Utility.log(PipeLogLevel.INFO),
  );

export const forward: TransformationPipeline<string> = (source) =>
  source.pipe(
    Operators.Event.info(
      'Dummy forward',
      (v: Data<string>) =>
        `Hello world for user ${v.resourceId}  from forward ${v}`,
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

  static welcomeMessage(threshold: number) {
    return dummyNumericPipeline2;
  }
}
