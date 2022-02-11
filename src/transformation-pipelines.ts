import { SubscriberState } from './data-model';
import { Operators } from './transformation-pipeline-operators';
import { TransformationPipeline } from './ports';
import { Duration } from 'luxon';

export type Window = FixedSizeWindow | FixedSizeSlidingWindow | FixedTimeWindow;

export interface FixedSizeWindow {
  type: 'fixed-size';
  size: number;
}

export interface FixedSizeSlidingWindow {
  type: 'fixed-size-sliding';
  size: number;
}

export interface FixedTimeWindow {
  type: 'fixed-time';
  timeSpan: Duration;
}

export type Trigger = RisingEdgeTrigger | FallingEdgeTrigger;

export interface RisingEdgeTrigger {
  type: 'rising-edge';
  threshold: number;
}

export interface FallingEdgeTrigger {
  type: 'falling-edge';
  threshold: number;
}

export type RateLimit = ThrottleTimeRateLimit;

export interface ThrottleTimeRateLimit {
  type: 'throttle-time';
  timeSpan: Duration;
}

export interface EventGenerationProps<V> {
  title: string;
  messageBuilder: (value: V) => string;
}

function createTriggerOperator(trigger: Trigger) {
  switch (trigger.type) {
    case 'falling-edge':
      return Operators.Trigger.fallingEdge(trigger.threshold);
    case 'rising-edge':
      return Operators.Trigger.risingEdge(trigger.threshold);
  }
  throw new Error('Should not happen');
}

/**
 * A set of commonly-used pipelines
 */
export class Pipelines {
  static threshold(
    trigger: Trigger,
    eventGenerationProps: EventGenerationProps<number>,
    rateLimit?: RateLimit,
  ): TransformationPipeline<number> {
    const triggerOperator = createTriggerOperator(trigger);
    return (source) =>
      source
        .pipe(Operators.Transform.getRaw())
        .pipe(...triggerOperator)
        .pipe(
          Operators.Notification.info(
            eventGenerationProps.title,
            eventGenerationProps.messageBuilder,
          ),
        )
        .pipe(
          rateLimit
            ? Operators.FlowControl.rateLimit(rateLimit.timeSpan)
            : Operators.Transform.identity(),
        );
  }

  static averageInFixedSizeWindowThreshold(
    window: FixedSizeWindow,
    trigger: Trigger,
    eventGenerationProps: EventGenerationProps<number>,
    rateLimit?: RateLimit,
  ): TransformationPipeline<number> {
    const triggerOperator = createTriggerOperator(trigger);
    return (source) =>
      source
        .pipe(Operators.Transform.getRaw())
        .pipe(Operators.Window.fixedSize(window.size))
        .pipe(Operators.Aggregate.avg())
        .pipe(...triggerOperator)
        .pipe(
          Operators.Notification.info(
            eventGenerationProps.title,
            eventGenerationProps.messageBuilder,
          ),
        )
        .pipe(
          rateLimit
            ? Operators.FlowControl.rateLimit(rateLimit.timeSpan)
            : Operators.Transform.identity(),
        );
  }

  static averageInFixedTimeWindowThreshold(
    window: FixedTimeWindow,
    trigger: Trigger,
    eventGenerationProps: EventGenerationProps<number>,
    rateLimit?: RateLimit,
  ): TransformationPipeline<number> {
    const triggerOperator = createTriggerOperator(trigger);
    return (source) =>
      source
        .pipe(Operators.Transform.getRaw())
        .pipe(...Operators.Window.fixedTime<number>(window.timeSpan))
        .pipe(Operators.Aggregate.avg())
        .pipe(...triggerOperator)
        .pipe(
          Operators.Notification.info(
            eventGenerationProps.title,
            eventGenerationProps.messageBuilder,
          ),
        )
        .pipe(
          rateLimit
            ? Operators.FlowControl.rateLimit(rateLimit.timeSpan)
            : Operators.Transform.identity(),
        );
  }

  static averageInFixedSizeSlidingWindowThreshold(
    window: FixedSizeSlidingWindow,
    trigger: Trigger,
    eventGenerationProps: EventGenerationProps<number>,
    rateLimit?: RateLimit,
  ): TransformationPipeline<number> {
    const triggerOperator = createTriggerOperator(trigger);
    return (source) =>
      source
        .pipe(Operators.Transform.getRaw())
        .pipe(Operators.Window.fixedSizeSliding<number>(window.size))
        .pipe(Operators.Aggregate.avg())
        .pipe(...triggerOperator)
        .pipe(
          Operators.Notification.info(
            eventGenerationProps.title,
            eventGenerationProps.messageBuilder,
          ),
        )
        .pipe(
          rateLimit
            ? Operators.FlowControl.rateLimit(rateLimit.timeSpan)
            : Operators.Transform.identity(),
        );
  }

  static sendMessageToNewSubscriber(
    eventGenerationProps: EventGenerationProps<SubscriberState>,
  ): TransformationPipeline<SubscriberState> {
    return (source) =>
      source
        .pipe(Operators.Transform.getRaw())
        .pipe(Operators.Transform.filter((it) => it === 'added'))
        .pipe(
          Operators.Notification.info(
            eventGenerationProps.title,
            eventGenerationProps.messageBuilder,
          ),
        );
  }

  static createNew<T>(pipeline: TransformationPipeline<T>) {
    return pipeline;
  }
}
