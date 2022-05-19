import {
  bufferCount,
  catchError,
  concatMap,
  filter,
  MonoTypeOperatorFunction,
  Observable,
  OperatorFunction,
  retry,
  scan,
  throttleTime,
  throwError,
  toArray,
  windowTime,
} from 'rxjs';
import { map, tap } from 'rxjs/operators';
import { Duration } from 'luxon';
import { Data } from './data-model';

export enum PipeLogLevel {
  TRACE,
  DEBUG,
  INFO,
  ERROR,
}

let pipeLogLevel = PipeLogLevel.INFO;

export function setPipeLogLevel(level: PipeLogLevel) {
  pipeLogLevel = level;
}

export class Operators {
  static Transform = class {
    static identity<V, T extends object>(): OperatorFunction<
      Data<V, T>,
      Data<V, T>
    > {
      return map((data) => data);
    }

    static filter<T>(predicate: (data: T) => boolean): OperatorFunction<T, T> {
      return filter(predicate);
    }

    static map<T, R>(mapper: (data: T) => R): OperatorFunction<T, R> {
      return map(mapper);
    }
  };

  static Window = class {
    static fixedSize<V, T extends object>(
      size: number,
    ): OperatorFunction<Data<V, T>, Data<V, T>[]> {
      return bufferCount(size);
    }

    static fixedSizeSliding<V, T extends object>(
      size: number,
    ): OperatorFunction<Data<V, T>, Data<V, T>[]> {
      return scan<Data<V, T>, Data<V, T>[]>(
        (values, value) => values.slice(1 - size).concat(value),
        [],
      );
    }

    static fixedTime<V, T extends object>(
      timeSpan: Duration,
    ): [
      OperatorFunction<Data<V, T>, Observable<Data<V, T>>>,
      OperatorFunction<Observable<Data<V, T>>, Data<V, T>[]>,
    ] {
      return [
        windowTime<Data<V, T>>(timeSpan.toMillis()),
        concatMap((value) => value.pipe(toArray())),
      ];
    }
  };

  static Aggregate = class {
    static avg<T extends object>(): OperatorFunction<
      Data<number, T>[],
      Data<number, T>
    > {
      return map((values) => {
        const acc = values.reduce((acc, next) => ({
          value: acc.value + next.value,
          context: next.context,
        }));
        return {
          ...acc,
          value: acc.value / values.length,
        };
      });
    }

    static max<T extends object>(): OperatorFunction<
      Data<number, T>[],
      Data<number, T>
    > {
      return map((values) =>
        values.reduce((acc, next) => (acc.value > next.value ? acc : next)),
      );
    }

    static min<T extends object>(): OperatorFunction<
      Data<number, T>[],
      Data<number, T>
    > {
      return map((values) =>
        values.reduce((acc, next) => (acc.value < next.value ? acc : next)),
      );
    }
  };

  static Trigger = class {
    static risingEdge<T extends object>(
      threshold: number,
      limit?: number,
    ): [
      OperatorFunction<Data<number, T>, Data<number, T>[]>,
      OperatorFunction<Data<number, T>[], Data<number, T>[]>,
      OperatorFunction<Data<number, T>[], Data<number, T>>,
    ] {
      return [
        Operators.Window.fixedSizeSliding(2),
        filter(
          (it) =>
            it.length === 2 &&
            it[0].value <= threshold &&
            threshold < it[1].value && (!limit || it[1].value < limit),
        ),
        map(([_, snd]) => snd),
      ];
    }

    static fallingEdge<T extends object>(
      threshold: number,
      limit?: number,
    ): [
      OperatorFunction<Data<number, T>, Data<number, T>[]>,
      OperatorFunction<Data<number, T>[], Data<number, T>[]>,
      OperatorFunction<Data<number, T>[], Data<number, T>>,
    ] {
      return [
        Operators.Window.fixedSizeSliding(2),
        filter(
          (data) =>
            data.length === 2 &&
            data[0].value >= threshold &&
            threshold > data[1].value && (!limit || data[1].value > limit),
        ),
        map(([_, snd]) => snd),
      ];
    }

    static increase<T extends object>(
      threshold: number,
    ): [
      OperatorFunction<Data<number, T>, Data<number, T>[]>,
      OperatorFunction<Data<number, T>[], Data<number, T>[]>,
      OperatorFunction<Data<number, T>[], Data<number, T>>,
    ] {
      return [
        Operators.Window.fixedSizeSliding(2),
        filter(
          (data) =>
            data.length === 2 && data[1].value - data[0].value >= threshold,
        ),
        map(([fst, snd]) => ({
          ...snd,
          context: {
            ...snd.context,
            trace: [
              ...snd.context.trace,
              {
                type: 'trigger',
                input: [fst.value, snd.value],
                output: snd.value - fst.value,
              },
            ],
          },
        })),
      ];
    }

    static decrease<T extends object>(
      threshold: number,
    ): [
      OperatorFunction<Data<number, T>, Data<number, T>[]>,
      OperatorFunction<Data<number, T>[], Data<number, T>[]>,
      OperatorFunction<Data<number, T>[], Data<number, T>>,
    ] {
      return [
        Operators.Window.fixedSizeSliding(2),
        filter(
          (data) =>
            data.length === 2 && data[0].value - data[1].value >= threshold,
        ),
        map(([_, snd]) => snd),
      ];
    }
  };

  static FlowControl = class {
    static rateLimit<T>(time: Duration) {
      return throttleTime<T>(time.toMillis());
    }

    static onErrorRetry<T>(): [
      OperatorFunction<T, unknown>,
      MonoTypeOperatorFunction<unknown>,
    ] {
      return [
        catchError((it) => {
          console.error(it);
          return throwError(it);
        }),
        retry(),
      ];
    }
  };

  static Utility = class {
    static log<T>(
      level: PipeLogLevel,
      msg?: string,
    ): MonoTypeOperatorFunction<T> {
      return tap((value: T) => {
        if (level >= pipeLogLevel) {
          msg
            ? console.log(`${msg}: ${JSON.stringify(value)}`)
            : console.log(JSON.stringify(value));
        }
        return value;
      });
    }
  };
}
