import type { Track } from '../content/music';

/** Step sequencer with look-ahead scheduling; every note is a short-lived WebAudio graph. */
export class Music {
  private track: Track | null = null;
  private step = 0;
  private next = 0;
  private timer = 0;
  private intensity = 0;
  private readonly out: GainNode;
  private readonly drums: GainNode;
  private readonly shaper: WaveShaperNode;
  private readonly echo: DelayNode;
  private readonly noise: AudioBuffer;
  private parsed: { bass: (number | null)[][]; lead: (number | null)[][] } = { bass: [], lead: [] };

  constructor(
    private readonly ctx: AudioContext,
    destination: AudioNode,
  ) {
    this.out = ctx.createGain();
    this.out.gain.value = 0;
    this.out.connect(destination);
    this.shaper = ctx.createWaveShaper();
    this.shaper.oversample = '2x';
    this.drums = ctx.createGain();
    this.drums.connect(this.shaper).connect(this.out);
    this.echo = ctx.createDelay(1);
    const feedback = ctx.createGain();
    feedback.gain.value = 0.32;
    const echoOut = ctx.createGain();
    echoOut.gain.value = 0.28;
    this.echo.connect(feedback).connect(this.echo);
    this.echo.connect(echoOut).connect(this.out);
    this.noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }

  play(track: Track): void {
    if (this.track?.id === track.id) return;
    this.track = track;
    const parse = (rows: string[]): (number | null)[][] => rows.map((r) => r.split(/\s+/).map((t) => (t === '.' ? null : Number(t))));
    this.parsed = { bass: parse(track.bass), lead: parse(track.lead) };
    const k = track.drive * 40 + 1;
    const curve = new Float32Array(1024);
    for (let i = 0; i < curve.length; i++) {
      const x = (i / (curve.length - 1)) * 2 - 1;
      curve[i] = Math.tanh(k * x) / Math.tanh(k);
    }
    this.shaper.curve = curve;
    this.echo.delayTime.value = (60 / track.bpm) * 0.75;
    this.step = 0;
    this.next = this.ctx.currentTime + 0.08;
    const now = this.ctx.currentTime;
    this.out.gain.cancelScheduledValues(now);
    this.out.gain.setValueAtTime(this.out.gain.value, now);
    this.out.gain.linearRampToValueAtTime(0.55, now + 1.2);
    if (!this.timer) this.timer = window.setInterval(() => {
      this.schedule();
    }, 25);
  }

  stop(fade = 0.6): void {
    const now = this.ctx.currentTime;
    this.out.gain.cancelScheduledValues(now);
    this.out.gain.setValueAtTime(this.out.gain.value, now);
    this.out.gain.linearRampToValueAtTime(0, now + fade);
    this.track = null;
    window.setTimeout(() => {
      if (!this.track && this.timer) {
        window.clearInterval(this.timer);
        this.timer = 0;
      }
    }, fade * 1000 + 50);
  }

  setIntensity(level: number): void {
    this.intensity = level;
  }

  /** Muffles the music (pause menus, level-up) without stopping it. */
  duck(on: boolean): void {
    const now = this.ctx.currentTime;
    this.out.gain.cancelScheduledValues(now);
    this.out.gain.setValueAtTime(this.out.gain.value, now);
    this.out.gain.linearRampToValueAtTime(on ? 0.2 : 0.55, now + 0.25);
  }

  private schedule(): void {
    const t = this.track;
    if (!t) return;
    const sixteenth = 60 / t.bpm / 4;
    while (this.next < this.ctx.currentTime + 0.15) {
      const s = this.step % 16;
      const bar = Math.floor(this.step / 16);
      const time = this.next + (s % 2 === 1 ? t.swing * sixteenth : 0);
      const on = (pattern: string[], from: number): boolean => this.intensity >= from && pattern[bar % pattern.length]?.[s] === 'x';
      if (on(t.kick, t.from.kick)) this.kick(time);
      if (on(t.clap, t.from.clap)) this.clap(time);
      if (on(t.hat, t.from.hat)) this.hat(time, false);
      if (on(t.open, t.from.open)) this.hat(time, true);
      const bass = this.parsed.bass[bar % this.parsed.bass.length]?.[s];
      if (bass != null && this.intensity >= t.from.bass) this.bass(time, t.root * 2 ** (bass / 12), sixteenth * 1.6);
      const lead = this.parsed.lead[bar % this.parsed.lead.length]?.[s];
      if (lead != null && this.intensity >= t.from.lead) this.lead(time, t.root * 2 * 2 ** (lead / 12), sixteenth * 1.4);
      if (s === 0 && this.intensity >= t.from.pad) {
        const chord = t.pad[bar % t.pad.length] ?? [0];
        for (const n of chord) this.pad(time, t.root * 4 * 2 ** (n / 12), sixteenth * 16);
      }
      this.next += sixteenth;
      this.step++;
    }
  }

  private env(g: GainNode, time: number, peak: number, attack: number, decay: number): void {
    g.gain.setValueAtTime(0, time);
    g.gain.linearRampToValueAtTime(peak, time + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, time + attack + decay);
  }

  private kick(time: number): void {
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.frequency.setValueAtTime(155, time);
    o.frequency.exponentialRampToValueAtTime(42, time + 0.12);
    this.env(g, time, 0.95, 0.002, 0.36);
    o.connect(g).connect(this.drums);
    o.start(time);
    o.stop(time + 0.4);
  }

  private noiseHit(time: number, filter: BiquadFilterType, freq: number, peak: number, decay: number, offset = 0): void {
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise;
    const f = this.ctx.createBiquadFilter();
    f.type = filter;
    f.frequency.value = freq;
    const g = this.ctx.createGain();
    this.env(g, time, peak, 0.001, decay);
    src.connect(f).connect(g).connect(this.drums);
    src.start(time, offset);
    src.stop(time + decay + 0.02);
  }

  private clap(time: number): void {
    for (const d of [0, 0.011, 0.022]) this.noiseHit(time + d, 'bandpass', 1500, 0.55, d === 0.022 ? 0.16 : 0.012, d * 10);
  }

  private hat(time: number, open: boolean): void {
    this.noiseHit(time, 'highpass', 7200, open ? 0.2 : 0.16, open ? 0.22 : 0.035, Math.random() * 0.5);
  }

  private bass(time: number, freq: number, dur: number): void {
    const o = this.ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.value = freq;
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.Q.value = 9;
    f.frequency.setValueAtTime(260, time);
    f.frequency.exponentialRampToValueAtTime(1300 + this.intensity * 300, time + 0.02);
    f.frequency.exponentialRampToValueAtTime(240, time + dur);
    const g = this.ctx.createGain();
    this.env(g, time, 0.3, 0.004, dur);
    o.connect(f).connect(g).connect(this.out);
    o.start(time);
    o.stop(time + dur + 0.05);
  }

  private lead(time: number, freq: number, dur: number): void {
    const o = this.ctx.createOscillator();
    o.type = 'square';
    o.frequency.value = freq;
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 2800;
    const g = this.ctx.createGain();
    this.env(g, time, 0.07, 0.003, dur);
    o.connect(f).connect(g);
    g.connect(this.out);
    g.connect(this.echo);
    o.start(time);
    o.stop(time + dur + 0.05);
  }

  private pad(time: number, freq: number, dur: number): void {
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0, time);
    g.gain.linearRampToValueAtTime(0.03, time + dur * 0.3);
    g.gain.linearRampToValueAtTime(0, time + dur);
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 900;
    f.connect(g).connect(this.out);
    for (const detune of [-8, 8]) {
      const o = this.ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = freq;
      o.detune.value = detune;
      o.connect(f);
      o.start(time);
      o.stop(time + dur + 0.05);
    }
  }
}
