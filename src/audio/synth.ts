import type { SfxLayer } from '../content/sfx';

/** Renders one effect layer to samples (jsfxr-style: oscillator, pitch slide, envelope, one-pole filters). */
export function renderLayer(l: SfxLayer, rate: number, rng: () => number): Float32Array<ArrayBuffer> {
  const attack = l.attack ?? 0.002;
  const total = (l.delay ?? 0) + attack + l.sustain + l.decay;
  const out = new Float32Array(Math.ceil(total * rate));
  const start = Math.floor((l.delay ?? 0) * rate);
  const len = out.length - start;
  const to = l.to ?? l.from;
  let phase = 0;
  let lp = 0;
  let hpIn = 0;
  let hpOut = 0;
  let noise = rng() * 2 - 1;
  const duty = l.duty ?? 0.5;
  for (let i = 0; i < len; i++) {
    const t = i / rate;
    const k = i / len;
    let f = l.from * Math.pow(to / l.from, k);
    if (l.steps) for (const [st, mul] of l.steps) if (t >= st) f *= mul;
    if (l.vibrato) f *= 1 + l.vibrato[0] * Math.sin(2 * Math.PI * l.vibrato[1] * t);
    const prev = phase;
    phase = (phase + f / rate) % 1;
    let v: number;
    switch (l.wave) {
      case 'square':
        v = phase < duty ? 1 : -1;
        break;
      case 'saw':
        v = 2 * phase - 1;
        break;
      case 'sine':
        v = Math.sin(2 * Math.PI * phase);
        break;
      case 'triangle':
        v = 1 - 4 * Math.abs(phase - 0.5);
        break;
      case 'noise':
        // Sample-and-hold noise: the pitch sets how often a new random value is drawn.
        if (phase < prev) noise = rng() * 2 - 1;
        v = noise;
        break;
    }
    let env: number;
    if (t < attack) env = t / attack;
    else if (t < attack + l.sustain) env = 1 + (l.punch ?? 0) * (1 - (t - attack) / l.sustain);
    else env = Math.max(0, 1 - (t - attack - l.sustain) / l.decay);
    v *= env;
    if (l.lowpass) {
      const cutoff = l.lowpassTo ? l.lowpass * Math.pow(l.lowpassTo / l.lowpass, k) : l.lowpass;
      const a = 1 - Math.exp((-2 * Math.PI * cutoff) / rate);
      lp += a * (v - lp);
      v = lp;
    }
    if (l.highpass) {
      const a = Math.exp((-2 * Math.PI * l.highpass) / rate);
      hpOut = a * (hpOut + v - hpIn);
      hpIn = v;
      v = hpOut;
    }
    out[start + i] = v * l.volume;
  }
  return out;
}

export function mixLayers(layers: SfxLayer[], rate: number, rng: () => number): Float32Array<ArrayBuffer> {
  const parts = layers.map((l) => renderLayer(l, rate, rng));
  const out = new Float32Array(Math.max(...parts.map((p) => p.length)));
  for (const p of parts) for (let i = 0; i < p.length; i++) out[i] = (out[i] ?? 0) + (p[i] ?? 0);
  // Short fade-out against clicks.
  const fade = Math.min(out.length, Math.floor(rate * 0.004));
  for (let i = 0; i < fade; i++) out[out.length - 1 - i] = (out[out.length - 1 - i] ?? 0) * (i / fade);
  return out;
}
