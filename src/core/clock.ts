// The run's own clock for screens whose timing changes the run (the cards, the chest): it moves with the
// game's frames, not with the wall clock, so the same frames always play out the same (replays, the
// headless simulation). Advanced once per frame by `Game.frame`; snapshots save and restore it whole.

interface Due {
  at: number;
  fn: () => void;
}

export const frameClock = { now: 0, due: [] as Due[] };

/** Runs `fn` once the frame clock has moved on by `ms` milliseconds (like setTimeout). */
export function after(fn: () => void, ms: number): void {
  frameClock.due.push({ at: frameClock.now + ms, fn });
}

/** One frame of `dt` seconds: the clock moves on and whatever came due runs, in the order it was asked. */
export function advanceClock(dt: number): void {
  const due = frameClock.due;
  frameClock.now += dt * 1000;
  for (let k = 0; k < due.length; ) {
    if (due[k].at > frameClock.now) {
      k++;
      continue;
    }
    const [d] = due.splice(k, 1);
    d.fn();
  }
}

/** A new run: nothing of the last one may still land in it. */
export function clearClock(): void {
  frameClock.due.length = 0;
}
