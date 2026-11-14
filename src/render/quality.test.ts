import { describe, expect, it } from 'vitest';
import { frameDue, QUALITY, ResolutionGovernor } from './quality';

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

  it('limit klatek', () => {
    expect(frameDue(1000, 990, 0)).toBe(true);
    expect(frameDue(1000, 990, 30)).toBe(false);
    expect(frameDue(1000, 967, 30)).toBe(true);
    // 60 on a 60 Hz display: jitter must not skip frames.
    expect(frameDue(1016, 1000, 60)).toBe(true);
  });
});
