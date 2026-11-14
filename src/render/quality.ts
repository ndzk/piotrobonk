// Graphics quality: four presets, a dynamic-resolution governor that trades pixels for a steady frame rate
// (and tells the automatic mode when a whole preset step is due), and the FPS limit. Pure logic, no
// renderer: main.ts applies it.

export type QualityId = 'niskie' | 'srednie' | 'wysokie' | 'ultra';

export interface QualityPreset {
  /** Highest device pixel ratio used (a 3× phone does not need 3× the pixels of a game this chunky). */
  maxDpr: number;
  /** The governor's range for the render scale, as a share of that resolution. */
  minScale: number;
  maxScale: number;
  /** Share of cosmetic particles kept (sparks, dust, shards). Gameplay effects never thin out. */
  particles: number;
}

export const QUALITY_ORDER: QualityId[] = ['niskie', 'srednie', 'wysokie', 'ultra'];

export const QUALITY: Record<QualityId, QualityPreset> = {
  niskie: { maxDpr: 1, minScale: 0.5, maxScale: 0.75, particles: 0.4 },
  srednie: { maxDpr: 1.25, minScale: 0.6, maxScale: 1, particles: 0.7 },
  wysokie: { maxDpr: 1.5, minScale: 0.7, maxScale: 1, particles: 1 },
  ultra: { maxDpr: 2, minScale: 0.85, maxScale: 1, particles: 1 },
};

/**
 * Holds the frame rate by moving the render scale. Frame intervals at the display's own rate mean there
 * is headroom (vsync hides how much), so the scale creeps back up slowly; frames that run long bring it
 * down quickly. The fastest interval seen is the display's refresh.
 */
export class ResolutionGovernor {
  scale: number;
  private refresh = Infinity;
  private slow = 0;
  private fine = 0;
  /** ms spent at the lowest scale with frames still running long, and at full scale with room to spare. */
  private stuck = 0;
  private easy = 0;

  constructor(
    private preset: QualityPreset,
    /** Frame interval to hold, ms (the FPS limit, or the display's refresh when there is none). */
    private targetMs = 0,
  ) {
    this.scale = preset.maxScale;
  }

  /**
   * For the automatic quality: -1 when even this preset's lowest resolution has run slow for seconds (the
   * next preset down is due), 1 after a long stretch at full resolution with room to spare (worth trying
   * the next one up), else 0. Vsync hides how much room there is, so going up is slow and cautious.
   */
  takeVerdict(): -1 | 0 | 1 {
    if (this.stuck > 6000) {
      this.stuck = 0;
      return -1;
    }
    if (this.easy > 45000) {
      this.easy = 0;
      return 1;
    }
    return 0;
  }

  setPreset(preset: QualityPreset, targetMs = this.targetMs): void {
    this.preset = preset;
    this.targetMs = targetMs;
    this.scale = Math.min(preset.maxScale, Math.max(preset.minScale, this.scale));
    this.slow = this.fine = this.stuck = this.easy = 0;
  }

  /** One frame interval in ms. Returns true when the scale changed (and the canvas needs resizing). */
  sample(ms: number): boolean {
    // Tab switches and hitches are not frame rate.
    if (!(ms > 0) || ms > 250) return false;
    this.refresh = Math.min(this.refresh, Math.max(ms, 4));
    const target = Math.max(this.targetMs, this.refresh) * 1.2;
    if (ms > target) {
      this.slow += ms;
      this.fine = 0;
    } else {
      this.fine += ms;
      this.slow = Math.max(0, this.slow - ms * 0.5);
    }
    const { minScale, maxScale } = this.preset;
    if (ms > target && this.scale <= minScale) this.stuck += ms;
    else this.stuck = Math.max(0, this.stuck - ms * 0.25);
    if (ms <= target && this.scale >= maxScale) this.easy += ms;
    else this.easy = 0;
    if (this.slow > 600 && this.scale > minScale) {
      this.scale = Math.max(minScale, Math.round((this.scale - 0.1) * 100) / 100);
      this.slow = 0;
      return true;
    }
    if (this.fine > 4000 && this.scale < maxScale) {
      this.scale = Math.min(maxScale, Math.round((this.scale + 0.05) * 100) / 100);
      this.fine = 0;
      return true;
    }
    return false;
  }
}

/**
 * The FPS limit: whether a frame should be drawn now. `last` is when the previous drawn frame started;
 * a little slack keeps 60 on a 60 Hz display from dropping every other frame on timer jitter.
 */
export function frameDue(now: number, last: number, limit: number): boolean {
  if (limit <= 0) return true;
  return now - last >= 1000 / limit - 2;
}
