import { Data, SubscriberEvent, SubscriberState } from './data-model';
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

export interface Diff<E> {
  added: E[];
  removed: E[];
}

/**
 * A set of commonly-used pipelines
 */
export class Pipelines {
  static added<T extends object, E extends object>(
    compareBy: (e1: E, e2: E) => boolean,
    rateLimit?: RateLimit,
  ): TransformationPipeline<E[], T, E[]> {
    return Pipelines.createNew<E[], T, E[]>((upstream) =>
      upstream
        .pipe(Operators.Window.fixedSizeSliding(2))
        .pipe(Operators.Transform.filter((it) => it.length === 2))
        .pipe(
          Operators.Transform.map(([d1, d2]) => {
            const added = d2.value.filter(
              (e2) => !d1.value.find((e1) => compareBy(e1, e2)),
            );
            const data: Data<E[], T> = {
              value: added,
              context: d2.context,
            };
            return data;
          }),
        )
        .pipe(
          Operators.Transform.filter(({ value: added }) => added.length > 0),
        )
        .pipe(
          rateLimit
            ? Operators.FlowControl.rateLimit(rateLimit.timeSpan)
            : Operators.Transform.identity(),
        ),
    );
  }

  static removed<T extends object, E extends object>(
    compareBy: (e1: E, e2: E) => boolean,
    rateLimit?: RateLimit,
  ): TransformationPipeline<E[], T, E[]> {
    return Pipelines.createNew<E[], T, E[]>((upstream) =>
      upstream
        .pipe(Operators.Window.fixedSizeSliding(2))
        .pipe(Operators.Transform.filter((it) => it.length === 2))
        .pipe(
          Operators.Transform.map(([d1, d2]) => {
            const removed = d1.value.filter(
              (e1) => !d2.value.find((e2) => compareBy(e1, e2)),
            );
            const data: Data<E[], T> = {
              value: removed,
              context: d2.context,
            };
            return data;
          }),
        )
        .pipe(
          Operators.Transform.filter(({ value: added }) => added.length > 0),
        )
        .pipe(
          rateLimit
            ? Operators.FlowControl.rateLimit(rateLimit.timeSpan)
            : Operators.Transform.identity(),
        ),
    );
  }

  static diff<T extends object, E extends object>(
    compareBy: (e1: E, e2: E) => boolean,
    rateLimit?: RateLimit,
  ): TransformationPipeline<E[], T, Diff<E>> {
    return Pipelines.createNew<E[], T, Diff<E>>((upstream) =>
      upstream
        .pipe(Operators.Window.fixedSizeSliding(2))
        .pipe(Operators.Transform.filter((it) => it.length === 2))
        .pipe(
          Operators.Transform.map(([d1, d2]) => {
            const added = d2.value.filter(
              (e2) => !d1.value.find((e1) => compareBy(e1, e2)),
            );
            const removed = d1.value.filter(
              (e1) => !d2.value.find((e2) => compareBy(e1, e2)),
            );
            const diff: Diff<E> = {
              added,
              removed,
            };
            const data: Data<Diff<E>, T> = {
              value: diff,
              context: d2.context,
            };
            return data;
          }),
        )
        .pipe(
          Operators.Transform.filter(
            ({ value: { added, removed } }) =>
              added.length + removed.length > 0,
          ),
        )
        .pipe(
          rateLimit
            ? Operators.FlowControl.rateLimit(rateLimit.timeSpan)
            : Operators.Transform.identity(),
        ),
    );
  }

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
