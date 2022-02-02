import {
  bufferCount,
  bufferTime,
  catchError,
  filter,
  MonoTypeOperatorFunction,
  OperatorFunction,
  retry,
  scan,
  throttleTime,
  throwError,
} from 'rxjs';
import { map, tap } from 'rxjs/operators';
import { Duration } from 'luxon';
import { Event, ParameterData } from './monitor-api';

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
    static getRaw<T>(): OperatorFunction<ParameterData<T>, T> {
      return map(({ data }) => data);
    }
  };

  static Window = class {
    static fixedSize(size: number): OperatorFunction<number, number[]> {
      return bufferCount(size);
    }

    static fixedSizeSliding(size: number): OperatorFunction<number, number[]> {
      return scan<number, number[]>(
        (values, value) => values.slice(1 - size).concat(value),
        [],
      );
    }

    static fixedTime(timeSpan: Duration): OperatorFunction<number, number[]> {
      return bufferTime(timeSpan.milliseconds);
    }
  };

  static Aggregate = class {
    static avg(): OperatorFunction<number[], number> {
      return map(
        (values) =>
          values.reduce((sum, value) => sum + value, 0) / values.length,
      );
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
        Operators.Window.fixedSize(2),
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
        Operators.Window.fixedSize(2),
        filter(([fst, snd]) => fst >= threshold && threshold > snd),
        map(([_, snd]) => snd),
      ];
    }
  };

  static Event = class {
    static warning<T>(
      title: string,
      messageBuilder: (value: T) => string,
    ): OperatorFunction<T, Event> {
      return map((value: T) => ({
        timestamp: new Date(),
        title,
        message: messageBuilder(value),
        type: 'warning',
      }));
    }

    static info<T>(
      title: string,
      messageBuilder: (value: T) => string,
    ): OperatorFunction<T, Event> {
      return map((value: T) => ({
        timestamp: new Date(),
        title,
        message: messageBuilder(value),
        type: 'info',
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
      message: string,
    ): MonoTypeOperatorFunction<T> {
      return tap((value: T) => {
        if (level >= pipeLogLevel) {
          console.log(message + ': ', value);
        }
        return value;
      });
    }
  };
}
