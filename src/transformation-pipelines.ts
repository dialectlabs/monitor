import { NotificationBuilder, SubscriberState } from './data-model';
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
    notificationBuilder: NotificationBuilder<number>,
    rateLimit?: RateLimit,
  ): TransformationPipeline<number> {
    const triggerOperator = createTriggerOperator(trigger);
    return (source) =>
      source
        .pipe(Operators.Transform.getRaw())
        .pipe(...triggerOperator)
        .pipe(Operators.Notification.create(notificationBuilder))
        .pipe(
          rateLimit
            ? Operators.FlowControl.rateLimit(rateLimit.timeSpan)
            : Operators.Transform.identity(),
        );
  }

  static averageInFixedSizeWindowThreshold(
    window: FixedSizeWindow,
    trigger: Trigger,
    notificationBuilder: NotificationBuilder<number>,
    rateLimit?: RateLimit,
  ): TransformationPipeline<number> {
    const triggerOperator = createTriggerOperator(trigger);
    return (source) =>
      source
        .pipe(Operators.Transform.getRaw())
        .pipe(Operators.Window.fixedSize(window.size))
        .pipe(Operators.Aggregate.avg())
        .pipe(...triggerOperator)
        .pipe(Operators.Notification.create(notificationBuilder))
        .pipe(
          rateLimit
            ? Operators.FlowControl.rateLimit(rateLimit.timeSpan)
            : Operators.Transform.identity(),
        );
  }

  static averageInFixedTimeWindowThreshold(
    window: FixedTimeWindow,
    trigger: Trigger,
    notificationBuilder: NotificationBuilder<number>,
    rateLimit?: RateLimit,
  ): TransformationPipeline<number> {
    const triggerOperator = createTriggerOperator(trigger);
    return (source) =>
      source
        .pipe(Operators.Transform.getRaw())
        .pipe(...Operators.Window.fixedTime<number>(window.timeSpan))
        .pipe(Operators.Aggregate.avg())
        .pipe(...triggerOperator)
        .pipe(Operators.Notification.create(notificationBuilder))
        .pipe(
          rateLimit
            ? Operators.FlowControl.rateLimit(rateLimit.timeSpan)
            : Operators.Transform.identity(),
        );
  }

  static averageInFixedSizeSlidingWindowThreshold(
    window: FixedSizeSlidingWindow,
    trigger: Trigger,
    notificationBuilder: NotificationBuilder<number>,
    rateLimit?: RateLimit,
  ): TransformationPipeline<number> {
    const triggerOperator = createTriggerOperator(trigger);
    return (source) =>
      source
        .pipe(Operators.Transform.getRaw())
        .pipe(Operators.Window.fixedSizeSliding<number>(window.size))
        .pipe(Operators.Aggregate.avg())
        .pipe(...triggerOperator)
        .pipe(Operators.Notification.create(notificationBuilder))
        .pipe(
          rateLimit
            ? Operators.FlowControl.rateLimit(rateLimit.timeSpan)
            : Operators.Transform.identity(),
        );
  }

  static notifyNewSubscribers(
    notificationBuilder: NotificationBuilder<SubscriberState>,
  ): TransformationPipeline<SubscriberState> {
    return (source) =>
      source
        .pipe(Operators.Transform.getRaw())
        .pipe(Operators.Transform.filter((it) => it === 'added'))
        .pipe(Operators.Notification.create(notificationBuilder));
  }

  static createNew<T>(pipeline: TransformationPipeline<T>) {
    return pipeline;
  }
}
