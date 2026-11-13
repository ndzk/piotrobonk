import type { Game } from './game';
import type { Input } from './input';

/**
 * ?bot=1: a simple AI that plays the run (kites away from enemies, circles the arena, picks cards).
 * Used for the attract mode and for end-to-end tests.
 */
export function attachBot(input: Input, game: Game): void {
  let cardDelay = 0;
  let orbit = 1;
  let orbitTimer = 0;
  input.override = (inp) => {
    const p = game.player.pos;
    if (game.state === 'levelup') {
      cardDelay += 1 / 60;
      if (cardDelay > 0.6) {
        cardDelay = 0;
        inp.press('card1');
      }
      return;
    }
    cardDelay = 0;
    if (game.state !== 'playing') return;
    let ax = 0;
    let az = 0;
    let closest = Infinity;
    // Stay at swing distance: pushed away by enemies that are too close, drawn to ones a few metres out.
    // When hurt, only flee.
    const brave = game.player.hp / game.player.maxHp > 0.35;
    game.enemies.near(p.x, p.z, 12, (i, d2) => {
      const d = Math.sqrt(d2) || 0.1;
      const ux = ((game.enemies.x[i] ?? 0) - p.x) / d;
      const uz = ((game.enemies.z[i] ?? 0) - p.z) / d;
      const w = d < 1.9 || !brave ? -1.6 / (d * d) : 0.35 / d;
      ax += ux * w;
      az += uz * w;
      closest = Math.min(closest, d);
    });
    // Circle around the arena centre so the bot does not pin itself against the fence.
    orbitTimer -= 1 / 60;
    if (orbitTimer <= 0) {
      orbitTimer = 6 + Math.random() * 6;
      orbit = Math.random() < 0.5 ? -1 : 1;
    }
    const r = Math.hypot(p.x, p.z) || 1;
    const want = game.world.radius * 0.45;
    ax += ((-p.z / r) * orbit + (-p.x / r) * (r - want) * 0.08) * 0.35;
    az += ((p.x / r) * orbit + (-p.z / r) * (r - want) * 0.08) * 0.35;
    const m = Math.hypot(ax, az) || 1;
    ax /= m;
    az /= m;
    // World direction to camera-relative stick input.
    const yaw = game.cam.yaw;
    inp.moveY = ax * -Math.sin(yaw) + az * -Math.cos(yaw);
    inp.moveX = ax * Math.cos(yaw) + az * -Math.sin(yaw);
    // Turn the camera behind the direction of travel for nicer attract-mode footage.
    const target = Math.atan2(-ax, -az);
    let d = target - game.cam.yaw;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    game.cam.yaw += d * 0.02;
    if (closest < 1.6 && Math.random() < 0.08) inp.press('jump');
    if (closest < 2.5 && Math.random() < 0.02) inp.press('slide');
  };
}
