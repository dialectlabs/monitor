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
import { Data, Notification, NotificationBuilder } from './data-model';

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
    static identity<T>(): OperatorFunction<T, T> {
      return map((data) => data);
    }

    static getRaw<T>(): OperatorFunction<Data<T>, T> {
      return map(({ data }) => data);
    }

    static filter<T>(predicate: (data: T) => boolean): OperatorFunction<T, T> {
      return filter(predicate);
    }

    static map<T, R>(mapper: (data: T) => R): OperatorFunction<T, R> {
      return map(mapper);
    }
  };

  static Window = class {
    static fixedSize<T>(size: number): OperatorFunction<T, T[]> {
      return bufferCount(size);
    }

    static fixedSizeSliding<T>(size: number): OperatorFunction<T, T[]> {
      return scan<T, T[]>(
        (values, value) => values.slice(1 - size).concat(value),
        [],
      );
    }

    static fixedTime<T>(
      timeSpan: Duration,
    ): [
      OperatorFunction<T, Observable<T>>,
      OperatorFunction<Observable<T>, T[]>,
    ] {
      return [
        windowTime<T>(timeSpan.toMillis()),
        concatMap((value) => value.pipe(toArray())),
      ];
    }
  };

  static Aggregate = class {
    static avg(): OperatorFunction<number[], number> {
      return map(
        (values) =>
          values.reduce((sum, value) => sum + value, 0) / values.length,
      );
    }

    static max(): OperatorFunction<number[], number> {
      return map((values) => Math.max(...values));
    }

    static min(): OperatorFunction<number[], number> {
      return map((values) => Math.min(...values));
    }
  };

  static Trigger = class {
    static risingEdge(
      threshold: number,
    ): [
      OperatorFunction<number, number[]>,
      OperatorFunction<number[], number[]>,
      OperatorFunction<number[], number>,
    ] {
      return [
        Operators.Window.fixedSizeSliding(2),
        filter(([fst, snd]) => fst <= threshold && threshold < snd),
        map(([_, snd]) => snd),
      ];
    }

    static fallingEdge(
      threshold: number,
    ): [
      OperatorFunction<number, number[]>,
      OperatorFunction<number[], number[]>,
      OperatorFunction<number[], number>,
    ] {
      return [
        Operators.Window.fixedSizeSliding(2),
        filter(([fst, snd]) => fst >= threshold && threshold > snd),
        map(([_, snd]) => snd),
      ];
    }
  };

  static Notification = class {
    static create<T>({
      messageBuilder,
    }: NotificationBuilder<T>): OperatorFunction<T, Notification> {
      return map((value: T) => ({
        message: messageBuilder(value),
      }));
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
