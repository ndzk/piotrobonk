import { SFX, type SfxId } from '../content/sfx';
import type { Track } from '../content/music';
import { Rng } from '../core/rng';
import { Music } from './music';
import { mixLayers } from './synth';

/** The music bus's place in the mix, under the effects (a level, not a setting). */
const MUSIC_TRIM = 0.7;

/**
 * Effects are rendered at this rate whatever the device runs at (Web Audio resamples on playback), so they
 * can be rendered while the title is up: in the first click itself they took a third of a second.
 */
const RATE = 48000;

export interface Volumes {
  master: number;
  music: number;
  sfx: number;
  ui: number;
}

/**
 * The AudioContext is created on the first user gesture only: creating it earlier makes browsers log
 * an autoplay warning. Until then every call is a silent no-op.
 */
class AudioEngine {
  private ctx: AudioContext | null = null;
  private buses: Record<'master' | 'music' | 'sfx' | 'ui', GainNode> | null = null;
  private readonly buffers = new Map<SfxId, AudioBuffer>();
  private readonly samples = new Map<SfxId, Float32Array<ArrayBuffer>>();
  private readonly last = new Map<SfxId, number>();
  private readonly active = new Map<SfxId, number>();
  private music: Music | null = null;
  private pendingTrack: Track | null = null;
  private volumes: Volumes = { master: 0.8, music: 0.7, sfx: 0.9, ui: 0.8 };
  private readonly rng = new Rng(0x5f3);

  get unlocked(): boolean {
    return this.ctx !== null;
  }

  /** Renders the effects a few at a time, between frames, before anyone clicks (the click only wraps them). */
  prepare(): void {
    const ids = Object.keys(SFX) as SfxId[];
    const slice = (): void => {
      const until = performance.now() + 6;
      while (ids.length > 0 && performance.now() < until) this.sample(ids.shift() as SfxId);
      if (ids.length > 0) window.setTimeout(slice, 16);
    };
    window.setTimeout(slice, 0);
  }

  /** One effect's samples, rendered once. Always in the same order, so the noise in them never changes. */
  private sample(id: SfxId): Float32Array<ArrayBuffer> {
    let s = this.samples.get(id);
    if (!s) {
      s = mixLayers(SFX[id].layers, RATE, () => this.rng.next());
      this.samples.set(id, s);
    }
    return s;
  }

  /** Call from a user gesture (click, key, touch). */
  unlock(): void {
    // Without a user gesture the browser refuses to start audio and logs a warning; wait for a real one.
    if ('userActivation' in navigator && !navigator.userActivation.isActive && !navigator.userActivation.hasBeenActive) return;
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return;
    }
    const ctx = new AudioContext({ latencyHint: 'interactive' });
    this.ctx = ctx;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.ratio.value = 4;
    comp.connect(ctx.destination);
    const master = ctx.createGain();
    master.connect(comp);
    const bus = (): GainNode => {
      const g = ctx.createGain();
      g.connect(master);
      return g;
    };
    this.buses = { master, music: bus(), sfx: bus(), ui: bus() };
    this.applyVolumes();
    for (const id of Object.keys(SFX) as SfxId[]) {
      const data = this.sample(id);
      const buf = ctx.createBuffer(1, data.length, RATE);
      buf.copyToChannel(data, 0);
      this.buffers.set(id, buf);
    }
    this.music = new Music(ctx, this.buses.music);
    if (this.pendingTrack) this.music.play(this.pendingTrack);
  }

  setVolumes(v: Partial<Volumes>): void {
    this.volumes = { ...this.volumes, ...v };
    this.applyVolumes();
  }

  private applyVolumes(): void {
    if (!this.buses) return;
    this.buses.master.gain.value = this.volumes.master;
    // Measured in a run, the music at full setting sat 5 dB over the effects at the start of a station: the
    // bed comes down 3 dB so hits and pickups read over it (the slider still runs 0..100%).
    this.buses.music.gain.value = this.volumes.music * MUSIC_TRIM;
    this.buses.sfx.gain.value = this.volumes.sfx;
    this.buses.ui.gain.value = this.volumes.ui;
  }

  play(id: SfxId, volume = 1, pitch = 1): void {
    const ctx = this.ctx;
    const buf = this.buffers.get(id);
    if (!ctx || !this.buses || !buf || ctx.state !== 'running') return;
    const def = SFX[id];
    const now = ctx.currentTime;
    if (now - (this.last.get(id) ?? -1) < def.gap) return;
    if ((this.active.get(id) ?? 0) >= def.voices) return;
    this.last.set(id, now);
    this.active.set(id, (this.active.get(id) ?? 0) + 1);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = pitch * (1 + (this.rng.next() * 2 - 1) * def.vary);
    const g = ctx.createGain();
    g.gain.value = volume;
    src.connect(g).connect(this.buses[def.bus]);
    src.onended = () => {
      this.active.set(id, Math.max(0, (this.active.get(id) ?? 1) - 1));
    };
    src.start();
  }

  playMusic(track: Track): void {
    this.pendingTrack = track;
    this.music?.play(track);
  }

  stopMusic(): void {
    this.pendingTrack = null;
    this.music?.stop();
  }

  musicIntensity(level: number): void {
    this.music?.setIntensity(level);
  }

  duckMusic(on: boolean): void {
    this.music?.duck(on);
  }

  suspend(): void {
    if (this.ctx?.state === 'running') void this.ctx.suspend();
  }

  resume(): void {
    // Safari before 16.4 has no navigator.userActivation.
    const active = !('userActivation' in navigator) || navigator.userActivation.hasBeenActive;
    if (this.ctx?.state === 'suspended' && active) void this.ctx.resume();
  }
}

export const audio = new AudioEngine();

/**
 * The game's own sounds and music. The hub's attract mode runs a real game behind the menu with this muted,
 * so the demo never plays over the hub.
 */
export const gameAudio = {
  muted: false,
  play(id: SfxId, volume = 1, pitch = 1): void {
    if (!this.muted) audio.play(id, volume, pitch);
  },
  playMusic(track: Track): void {
    if (!this.muted) audio.playMusic(track);
  },
  stopMusic(): void {
    if (!this.muted) audio.stopMusic();
  },
  musicIntensity(level: number): void {
    if (!this.muted) audio.musicIntensity(level);
  },
  duckMusic(on: boolean): void {
    if (!this.muted) audio.duckMusic(on);
  },
  get unlocked(): boolean {
    return audio.unlocked;
  },
  suspend(): void {
    audio.suspend();
  },
  resume(): void {
    audio.resume();
  },
  setVolumes(v: Partial<Volumes>): void {
    audio.setVolumes(v);
  },
};
