// Touch controls for phones and tablets: a floating stick wherever the left thumb lands, camera drag on the
// right, and buttons for jumping, sliding, the action key and pause. They write straight into the shared
// `Input`, so the game cannot tell a thumb from a keyboard. Shown only once a finger has touched the screen.

import { UI } from '../content/ui';
import type { Input } from '../game/input';
import { h } from './dom';

/** Keeps a finger's events on `el` even when it slides off. A pointer the browser has already let go of
 * (a very short tap) cannot be captured, and does not need to be. */
function capture(el: HTMLElement, id: number): void {
  try {
    el.setPointerCapture(id);
  } catch {
    // Already released: nothing to follow.
  }
}

/** Stick travel in CSS px for full speed. */
const RADIUS = 56;
/** Camera drag: px of finger travel per px of mouse travel (fingers move less precisely and less far). */
const LOOK = 1.6;

export class TouchControls {
  readonly root = h('div', 'touch');
  private readonly move = h('div', 'touch__move');
  private readonly look = h('div', 'touch__look');
  private readonly base = h('div', 'touch__base');
  private readonly knob = h('div', 'touch__knob');
  private stickId = -1;
  private lookId = -1;
  private ox = 0;
  private oy = 0;
  private lx = 0;
  private ly = 0;
  private wanted = false;
  /** A finger has been seen on this device (a mouse or keyboard alone never shows the controls). */
  used = matchMedia('(pointer: coarse)').matches;

  constructor(
    parent: HTMLElement,
    private readonly input: Input,
  ) {
    this.base.append(this.knob);
    this.move.append(this.base);
    const button = (cls: string, label: string, down: () => void, up: () => void = () => undefined): HTMLButtonElement => {
      const b = h('button', `touch__btn touch__btn--${cls}`, label);
      b.type = 'button';
      b.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        capture(b, e.pointerId);
        b.classList.add('is-down');
        down();
      });
      const release = (): void => {
        b.classList.remove('is-down');
        up();
      };
      b.addEventListener('pointerup', release);
      b.addEventListener('pointercancel', release);
      return b;
    };
    const t = UI.touch;
    this.root.append(
      this.move,
      this.look,
      button(
        'jump',
        t.jump,
        () => {
          input.press('jump');
          input.touch.jump = true;
        },
        () => (input.touch.jump = false),
      ),
      button(
        'slide',
        t.slide,
        () => {
          input.press('slide');
          input.touch.slide = true;
        },
        () => (input.touch.slide = false),
      ),
      button('act', t.act, () => { input.press('interact'); }),
      button('pause', t.pause, () => { input.press('pause'); }),
    );
    this.root.hidden = true;
    parent.append(this.root);

    this.move.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'mouse' || this.stickId >= 0) return;
      this.stickId = e.pointerId;
      capture(this.move, e.pointerId);
      this.ox = e.clientX;
      this.oy = e.clientY;
      this.base.style.transform = `translate(${e.clientX}px, ${e.clientY}px)`;
      this.base.classList.add('is-on');
      this.stick(e.clientX, e.clientY);
    });
    this.move.addEventListener('pointermove', (e) => {
      if (e.pointerId === this.stickId) this.stick(e.clientX, e.clientY);
    });
    const endStick = (e: PointerEvent): void => {
      if (e.pointerId !== this.stickId) return;
      this.stickId = -1;
      input.touch.x = input.touch.y = 0;
      this.base.classList.remove('is-on');
      this.knob.style.transform = '';
    };
    this.move.addEventListener('pointerup', endStick);
    this.move.addEventListener('pointercancel', endStick);

    this.look.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'mouse' || this.lookId >= 0) return;
      this.lookId = e.pointerId;
      capture(this.look, e.pointerId);
      this.lx = e.clientX;
      this.ly = e.clientY;
    });
    this.look.addEventListener('pointermove', (e) => {
      if (e.pointerId !== this.lookId) return;
      input.lookX += (e.clientX - this.lx) * LOOK;
      input.lookY += (e.clientY - this.ly) * LOOK;
      this.lx = e.clientX;
      this.ly = e.clientY;
    });
    const endLook = (e: PointerEvent): void => {
      if (e.pointerId === this.lookId) this.lookId = -1;
    };
    this.look.addEventListener('pointerup', endLook);
    this.look.addEventListener('pointercancel', endLook);

    // The first finger anywhere switches the controls on; a mouse never does.
    window.addEventListener(
      'pointerdown',
      (e) => {
        if (e.pointerType !== 'touch' || this.used) return;
        this.used = true;
        this.sync();
      },
      { capture: true },
    );
  }

  private stick(x: number, y: number): void {
    let dx = x - this.ox;
    let dy = y - this.oy;
    const d = Math.hypot(dx, dy);
    if (d > RADIUS) {
      dx *= RADIUS / d;
      dy *= RADIUS / d;
    }
    this.knob.style.transform = `translate(${dx}px, ${dy}px)`;
    // A little dead zone in the middle, so resting a thumb does not creep.
    const m = Math.hypot(dx, dy) / RADIUS;
    const k = m < 0.12 ? 0 : (m - 0.12) / 0.88 / (m || 1);
    this.input.touch.x = (dx / RADIUS) * k;
    this.input.touch.y = (-dy / RADIUS) * k;
  }

  /** The run wants the controls (playing) or not (menus, cutscenes, the hub). */
  show(on: boolean): void {
    this.wanted = on;
    this.sync();
  }

  private sync(): void {
    const on = this.wanted && this.used;
    if (on === !this.root.hidden) return;
    this.root.hidden = !on;
    if (!on) {
      this.stickId = this.lookId = -1;
      this.input.touch.x = this.input.touch.y = 0;
      this.input.touch.jump = this.input.touch.slide = false;
      this.base.classList.remove('is-on');
    }
  }
}
