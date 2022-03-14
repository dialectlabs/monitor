import {
  NotificationBuilder,
  SubscriberEvent,
  SubscriberState,
} from './data-model';
import { Operators } from './transformation-pipeline-operators';
import { TransformationPipeline } from './ports';
import { Duration } from 'luxon';

export interface FixedSizeWindow {
  size: number;
}

export interface FixedSizeSlidingWindow {
  size: number;
}

export interface FixedTimeWindow {
  timeSpan: Duration;
}

export type Trigger =
  | RisingEdgeTrigger
  | FallingEdgeTrigger
  | IncreaseTrigger
  | DecreaseTrigger;

export interface RisingEdgeTrigger {
  type: 'rising-edge';
  threshold: number;
}

export interface FallingEdgeTrigger {
  type: 'falling-edge';
  threshold: number;
}

export interface IncreaseTrigger {
  type: 'increase';
  threshold: number;
}

export interface DecreaseTrigger {
  type: 'decrease';
  threshold: number;
}

export type RateLimit = ThrottleTimeRateLimit;

export interface ThrottleTimeRateLimit {
  type: 'throttle-time';
  timeSpan: Duration;
}

function createTriggerOperator<T extends object>(trigger: Trigger) {
  switch (trigger.type) {
    case 'falling-edge':
      return Operators.Trigger.fallingEdge<T>(trigger.threshold);
    case 'rising-edge':
      return Operators.Trigger.risingEdge<T>(trigger.threshold);
    case 'increase':
      return Operators.Trigger.increase<T>(trigger.threshold);
    case 'decrease':
      return Operators.Trigger.decrease<T>(trigger.threshold);
  }
  throw new Error('Should not happen');
}

/**
 * A set of commonly-used pipelines
 */
export class Pipelines {
  static threshold<T extends object>(
    trigger: Trigger,
    rateLimit?: RateLimit,
  ): TransformationPipeline<number, T, number> {
    const triggerOperator = createTriggerOperator<T>(trigger);
    return Pipelines.createNew<number, T, number>((upstream) =>
      upstream
        .pipe(...triggerOperator)
        .pipe(
          rateLimit
            ? Operators.FlowControl.rateLimit(rateLimit.timeSpan)
            : Operators.Transform.identity(),
        ),
    );
  }

  static averageInFixedSizeWindowThreshold<T extends object>(
    window: FixedSizeWindow,
    trigger: Trigger,
    rateLimit?: RateLimit,
  ): TransformationPipeline<number, T, number> {
    const triggerOperator = createTriggerOperator<T>(trigger);
    return Pipelines.createNew<number, T, number>((upstream) =>
      upstream
        .pipe(Operators.Window.fixedSize(window.size))
        .pipe(Operators.Aggregate.avg())
        .pipe(...triggerOperator)
        .pipe(
          rateLimit
            ? Operators.FlowControl.rateLimit(rateLimit.timeSpan)
            : Operators.Transform.identity(),
        ),
    );
  }

  static averageInFixedTimeWindowThreshold<T extends object>(
    window: FixedTimeWindow,
    trigger: Trigger,
    rateLimit?: RateLimit,
  ): TransformationPipeline<number, T, number> {
    const triggerOperator = createTriggerOperator<T>(trigger);
    return Pipelines.createNew<number, T, number>((upstream) =>
      upstream
        .pipe(...Operators.Window.fixedTime<number, T>(window.timeSpan))
        .pipe(Operators.Aggregate.avg())
        .pipe(...triggerOperator)
        .pipe(
          rateLimit
            ? Operators.FlowControl.rateLimit(rateLimit.timeSpan)
            : Operators.Transform.identity(),
        ),
    );
  }

  static averageInFixedSizeSlidingWindowThreshold<T extends object>(
    window: FixedSizeSlidingWindow,
    trigger: Trigger,
    notificationBuilder: NotificationBuilder<number, T>,
    rateLimit?: RateLimit,
  ): TransformationPipeline<number, T, number> {
    const triggerOperator = createTriggerOperator<T>(trigger);
    return Pipelines.createNew<number, T, number>((upstream) =>
      upstream
        .pipe(Operators.Window.fixedSizeSliding(window.size))
        .pipe(Operators.Aggregate.avg())
        .pipe(...triggerOperator)
        .pipe(
          rateLimit
            ? Operators.FlowControl.rateLimit(rateLimit.timeSpan)
            : Operators.Transform.identity(),
        ),
    );
  }

  static notifyNewSubscribers(): TransformationPipeline<
    SubscriberState,
    SubscriberEvent,
    SubscriberState
  > {
    return (source) =>
      source.pipe(Operators.Transform.filter(({ value }) => value === 'added'));
  }

  static createNew<V, T extends object, R>(
    pipeline: TransformationPipeline<V, T, R>,
  ) {
    return pipeline;
  }
}
