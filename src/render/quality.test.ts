import { describe, expect, it } from 'vitest';
import { FrameCap, QUALITY, ResolutionGovernor } from './quality';

describe('jakość grafiki', () => {
  it('automat schodzi o stopień, gdy nawet najniższa rozdzielczość nie wyrabia, a w górę idzie powoli', () => {
    const g = new ResolutionGovernor(QUALITY.wysokie);
    for (let i = 0; i < 60; i++) g.sample(1000 / 60);
    expect(g.takeVerdict()).toBe(0);
    // Heavy frames: down to the floor, then seconds more of it.
    let v = 0;
    for (let i = 0; i < 400 && v === 0; i++) {
      g.sample(45);
      v = g.takeVerdict();
    }
    expect(v).toBe(-1);
    expect(g.scale).toBe(QUALITY.wysokie.minScale);
    // Smooth for a long while at full scale: one step up is worth a try.
    const h = new ResolutionGovernor(QUALITY.srednie);
    let up = 0;
    for (let i = 0; i < 4000 && up === 0; i++) {
      h.sample(1000 / 60);
      up = h.takeVerdict();
    }
    expect(up).toBe(1);
  });

  it('za wolne klatki szybko obniżają rozdzielczość, płynne powoli ją oddają', () => {
    const g = new ResolutionGovernor(QUALITY.wysokie);
    for (let i = 0; i < 120; i++) g.sample(1000 / 60);
    expect(g.scale).toBe(1);
    // 40 ms frames on a 60 Hz display: down within a second.
    let changed = 0;
    for (let i = 0; i < 25; i++) if (g.sample(40)) changed++;
    expect(changed).toBeGreaterThan(0);
    expect(g.scale).toBeLessThan(1);
    const low = g.scale;
    for (let i = 0; i < 200; i++) g.sample(40);
    expect(g.scale).toBe(QUALITY.wysokie.minScale);
    // Smooth again: it climbs back, but only after seconds of it.
    for (let i = 0; i < 60; i++) g.sample(1000 / 60);
    expect(g.scale).toBe(QUALITY.wysokie.minScale);
    for (let i = 0; i < 2000; i++) g.sample(1000 / 60);
    expect(g.scale).toBeGreaterThan(low);
  });

  it('pojedyncze zacięcie i powrót do karty nic nie zmieniają', () => {
    const g = new ResolutionGovernor(QUALITY.wysokie);
    for (let i = 0; i < 60; i++) g.sample(1000 / 60);
    g.sample(2000);
    g.sample(45);
    for (let i = 0; i < 60; i++) g.sample(1000 / 60);
    expect(g.scale).toBe(1);
  });

  it('szybki ekran przy stałych 90 FPS i jedno krótkie okno klatki nie zbijają rozdzielczości', () => {
    // A 144 Hz display: the fastest intervals are 6.9 ms, the game holds 90 FPS. That is above 60: fine.
    const g = new ResolutionGovernor(QUALITY.wysokie);
    for (let i = 0; i < 20; i++) g.sample(1000 / 144);
    let verdict = 0;
    for (let i = 0; i < 3000; i++) {
      g.sample(1000 / 90);
      verdict = Math.min(verdict, g.takeVerdict());
    }
    expect(g.scale).toBe(1);
    expect(verdict).toBe(0);
    // A 60 Hz display with one 12 ms timestamp among perfect frames.
    const h = new ResolutionGovernor(QUALITY.wysokie);
    h.sample(12);
    for (let i = 0; i < 3000; i++) h.sample(1000 / 60);
    expect(h.scale).toBe(1);
  });

  it('limit klatek trzyma średnią na każdym odświeżaniu ekranu', () => {
    const fps = (hz: number, limit: number): number => {
      const cap = new FrameCap();
      let drawn = 0;
      // Ten seconds of display frames, with a little timestamp jitter.
      for (let i = 0; i < hz * 10; i++) if (cap.ready((i * 1000) / hz + (i % 3) * 0.3, limit)) drawn++;
      return drawn / 10;
    };
    expect(fps(60, 0)).toBe(60);
    expect(fps(144, 0)).toBe(144);
    for (const [hz, limit] of [
      [60, 60],
      [60, 30],
      [75, 60],
      [90, 60],
      [144, 60],
      [144, 120],
      [165, 120],
      [165, 144],
      [240, 144],
    ]) expect(Math.abs(fps(hz, limit) - limit)).toBeLessThanOrEqual(1);
    // Below the limit the display's own rate is all there is.
    expect(fps(60, 120)).toBe(60);
  });
});
