// Just enough of a browser for the game's simulation to run in Node (scripts/sim.ts). The run's DOM screens,
// canvases, audio and the WebGL renderer are built but never shown: every one of them is a "stub" that takes
// any call and any property and gives back another stub (0 or '' when used as a number or a string). The
// simulation itself is the real game code, step for step: this file only stands in for what it draws on.

type Stub = Record<string | symbol, unknown> & (() => unknown);

/** Property names a stub must not invent (a fake `then` would make it a promise, `__THREE__` a second copy). */
const ABSENT = new Set<string | symbol>(['then', '__THREE__', '__THREE_DEVTOOLS__', 'toJSON', 'nodeType', 'getGamepads', 'scheduler', 'onpointerlockchange', 'ontouchstart']);

/** Class lists are real: screens decide what is visible by their classes ('is-out'). */
class ClassList {
  private readonly set = new Set<string>();
  add(...c: string[]): void {
    for (const x of c) this.set.add(x);
  }
  remove(...c: string[]): void {
    for (const x of c) this.set.delete(x);
  }
  toggle(c: string, on?: boolean): boolean {
    const want = on ?? !this.set.has(c);
    if (want) this.set.add(c);
    else this.set.delete(c);
    return want;
  }
  contains(c: string): boolean {
    return this.set.has(c);
  }
  replace(a: string, b: string): void {
    if (this.set.delete(a)) this.set.add(b);
  }
}

export function stub(): Stub {
  const own = new Map<string | symbol, unknown>();
  const fn = function stubFn(): void {
    // A stub called as a function returns a stub (handled by the proxy's apply).
  };
  return new Proxy(fn, {
    get(_t, key) {
      if (own.has(key)) return own.get(key);
      if (key === Symbol.toPrimitive) return (hint: string) => (hint === 'number' ? 0 : '');
      if (key === Symbol.iterator) return function* empty(): Generator<never> {
        // Nothing to iterate.
      };
      if (key === 'length' || key === 'width' || key === 'height' || key === 'clientWidth' || key === 'clientHeight') return 0;
      if (ABSENT.has(key)) return undefined;
      if (key === 'classList') {
        const list = new ClassList();
        own.set(key, list);
        return list;
      }
      if (key === 'hidden' || key === 'matches' || key === 'pointerLockElement' || key === 'fullscreenElement') return false;
      const value = stub();
      own.set(key, value);
      return value;
    },
    set(_t, key, value) {
      own.set(key, value);
      return true;
    },
    apply: () => stub(),
    construct: () => stub(),
    has: (_t, key) => !ABSENT.has(key),
  }) as unknown as Stub;
}

/** A Map-backed localStorage: the save code reads and writes it like the real one. */
class MemoryStorage {
  private readonly data = new Map<string, string>();
  get length(): number {
    return this.data.size;
  }
  key(i: number): string | null {
    return [...this.data.keys()][i] ?? null;
  }
  getItem(k: string): string | null {
    return this.data.get(k) ?? null;
  }
  setItem(k: string, v: string): void {
    this.data.set(k, v);
  }
  removeItem(k: string): void {
    this.data.delete(k);
  }
  clear(): void {
    this.data.clear();
  }
}

/**
 * The simulation's clock. Screens time their input locks on performance.now() and finish on setTimeout (a
 * picked card lands 0,26 s later): both run on game time here, advanced frame by frame with `tick`.
 */
export const realNow = performance.now.bind(performance);
let virtualMs = 0;
interface Timer {
  id: number;
  due: number;
  fn: () => void;
}
const timers: Timer[] = [];
let timerId = 1;

export function tick(ms: number): void {
  virtualMs += ms;
  for (let k = 0; k < timers.length; ) {
    const t = timers[k];
    if (t.due > virtualMs) {
      k++;
      continue;
    }
    timers.splice(k, 1);
    t.fn();
  }
}

/** Drops every pending timer (a new run must not get the last one's late callbacks). */
export function clearTimers(): void {
  timers.length = 0;
}

function setTimer(fn: unknown, ms?: number): number {
  const id = timerId++;
  if (typeof fn === 'function') timers.push({ id, due: virtualMs + (ms ?? 0), fn: fn as () => void });
  return id;
}

function clearTimer(id: unknown): void {
  const k = timers.findIndex((t) => t.id === id);
  if (k >= 0) timers.splice(k, 1);
}

function install(): void {
  performance.now = (): number => virtualMs;
  const g = globalThis as unknown as Record<string, unknown>;
  const doc = stub();
  const win = stub();
  // Timers and the clock are real; everything visual is a stub.
  for (const [k, v] of Object.entries({
    setTimeout: setTimer,
    clearTimeout: clearTimer,
    setInterval: () => 0,
    clearInterval: () => undefined,
    requestAnimationFrame: () => 0,
    cancelAnimationFrame: () => undefined,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    matchMedia: () => ({ matches: false, addEventListener: () => undefined, removeEventListener: () => undefined }),
    devicePixelRatio: 1,
    innerWidth: 1280,
    innerHeight: 720,
    performance,
    document: doc,
    localStorage: new MemoryStorage(),
    sessionStorage: new MemoryStorage(),
  })) {
    win[k] = v;
  }
  Object.defineProperty(g, 'window', { value: win, configurable: true, writable: true });
  Object.defineProperty(g, 'document', { value: doc, configurable: true, writable: true });
  for (const k of ['localStorage', 'sessionStorage', 'matchMedia', 'requestAnimationFrame', 'cancelAnimationFrame', 'devicePixelRatio', 'innerWidth', 'innerHeight']) {
    Object.defineProperty(g, k, { value: win[k], configurable: true, writable: true });
  }
  // Classes the code checks with instanceof or constructs (canvases, images, audio): stubs as well.
  for (const k of ['HTMLElement', 'HTMLInputElement', 'HTMLTextAreaElement', 'HTMLCanvasElement', 'HTMLImageElement', 'Image', 'ImageData', 'OffscreenCanvas', 'AudioContext', 'GainNode', 'ResizeObserver', 'IntersectionObserver', 'Element', 'Node', 'DOMParser', 'XMLSerializer', 'PointerEvent', 'KeyboardEvent']) {
    if (!(k in g)) Object.defineProperty(g, k, { value: function Stand(): void {}, configurable: true, writable: true });
  }
  // `navigator` exists in Node (without getGamepads, which the input checks for).
  Object.defineProperty(g, 'location', { value: { href: 'http://localhost/', search: '', hash: '', origin: 'http://localhost', pathname: '/' }, configurable: true, writable: true });
}

install();
