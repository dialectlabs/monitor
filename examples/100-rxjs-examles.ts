import {
  bufferCount,
  bufferTime,
  catchError,
  filter,
  retry,
  scan,
  tap,
  timer,
} from 'rxjs';
import { map } from 'rxjs/operators';

function getScalarDataFromDApp(): number {
  return Math.random();
}

// here we emulate monitoring of some scalar value in dApp account using pull-model
const scalarValue1FromDApp = timer(1000, 900)
  .pipe(map(() => getScalarDataFromDApp()))
  .pipe(tap((it) => console.log(`Source 1: ${JSON.stringify(it)}`)));

// Example 1: simple cron subscription
// scalarValue1FromDApp.subscribe();

// Example 2: fixed size window by element count
const windowSize = 2;
const fixedSizeWindowed = scalarValue1FromDApp
  .pipe(bufferCount(windowSize))
  .pipe(
    tap((it) => console.log(` Fixed size windowed: ${JSON.stringify(it)}`)),
  );

// fixedSizeWindowed.subscribe((it) =>
//   console.log(`Fixed-size-windowed: ${JSON.stringify(it)}`),
// );

// Example 2: fixed size window by element count
const timeWindowed = scalarValue1FromDApp
  .pipe(bufferTime(3500))
  .pipe(tap((it) => console.log(` Time-windowed: ${JSON.stringify(it)}`)));

// timeWindowed.subscribe();

// Example 3: sliding window by element count
const slidingWindowed = scalarValue1FromDApp
  .pipe(
    scan<number, number[]>(
      (values, value) => values.slice(1 - windowSize).concat(value),
      [],
    ),
  )
  .pipe(tap((it) => console.log(` Sliding-windowed: ${JSON.stringify(it)}`)));
// slidingWindowed.subscribe();

// Example 4: avg in window
const averagedInWindow = fixedSizeWindowed
  .pipe(
    map((values) => values.reduce((sum, value) => sum + value, 0) / windowSize),
  )
  .pipe(tap((it) => console.log(`   Averaged: ${it}`)));
// averagedInWindow.subscribe();

// Example 5: zipped with next
const avgInWindowZippedWithNext = averagedInWindow
  .pipe(
    scan<number, number[]>(
      (values, value) => values.slice(-1).concat(value),
      [],
    ),
  )
  .pipe(
    tap((it) => console.log(`     Zipped-with-next ${JSON.stringify(it)}`)),
  );
// avgInWindowZippedWithNext.subscribe();

// Example 6: rate of change trigger
const rocSensitivity = 0.2;
const rocTrigger = avgInWindowZippedWithNext
  .pipe(map(([fst, snd]) => Math.abs(fst - snd) > rocSensitivity))
  .pipe(filter((it) => it))
  .pipe(tap(() => console.log(`       ROC trigger fired`)));
// rocTrigger.subscribe();

// Example 7: rising edge trigger
const risingEdgeThreshold = 0.5;
const risingEdgeTrigger = avgInWindowZippedWithNext
  .pipe(
    map(
      ([fst, snd]) => fst <= risingEdgeThreshold && risingEdgeThreshold < snd,
    ),
  )
  .pipe(filter((it) => it))
  .pipe(tap(() => console.log(`       Rising edge trigger fired`)));
// risingEdgeTrigger.subscribe();

// Example 8: falling edge trigger
const fallingEdgeThreshold = 0.5;
const fallingEdgeTrigger = avgInWindowZippedWithNext
  .pipe(
    map(
      ([fst, snd]) => fst >= fallingEdgeThreshold && fallingEdgeThreshold > snd,
    ),
  )
  .pipe(filter((it) => it))
  .pipe(tap(() => console.log(`       Falling edge trigger fired`)));
fallingEdgeTrigger.subscribe();

// Example 9: error handling & retry
function smthThatCanThrow(): number {
  const number = Math.random();
  if (number > 0.7) {
    throw new Error('Some bad error');
  }
  return number;
}

const source = timer(1000, 900)
  .pipe(tap((it) => console.log(it)))
  .pipe(map(() => smthThatCanThrow()))
  .pipe(
    catchError((it) => {
      console.log(it);
      return it;
    }),
  )
  .pipe(tap((it) => console.log(it)))
  .pipe(retry());

// source.subscribe();
