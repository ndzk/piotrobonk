import { Rng } from '../core/rng';
import type { Game } from './game';
import type { Input } from './input';

/**
 * ?bot=1: a simple AI that plays the run (keeps swing distance, flees when hurt, circles the arena,
 * picks the first card). Used for the attract mode and for end-to-end tests. Seeded, so runs repeat.
 */
export function attachBot(input: Input, game: Game, seed: number): void {
  const rng = new Rng(seed ^ 0x2b07);
  let cardDelay = 0;
  let orbit = 1;
  let orbitTimer = 0;
  input.override = (inp) => {
    const p = game.player.pos;
    if (game.state === 'levelup') {
      cardDelay += 1 / 60;
      if (cardDelay > 0.6) {
        cardDelay = 0;
        // Prefer weapon upgrades, then survival passives, then whatever comes first.
        const order = ['teczka', 'kanapka', 'kurtka', 'klapki', 'energetyk', 'okulary', 'nerka', 'zdrapka'];
        const ids = game.offered.map((c) => c.id);
        let best = 0;
        let rank = Infinity;
        ids.forEach((id, i) => {
          const r = order.indexOf(id);
          if (r >= 0 && r < rank) {
            rank = r;
            best = i;
          }
        });
        inp.press(best === 0 ? 'card1' : best === 1 ? 'card2' : 'card3');
      }
      return;
    }
    cardDelay = 0;
    if (game.state !== 'playing') return;
    let ax = 0;
    let az = 0;
    let closest = Infinity;
    const brave = game.player.hp / game.player.maxHp > 0.35;
    const e = game.enemies;
    const n = e.query(p.x, p.z, 12);
    for (let k = 0; k < n; k++) {
      const i = e.found[k];
      const d = Math.sqrt(e.foundD2[k]) || 0.1;
      const ux = (e.x[i] - p.x) / d;
      const uz = (e.z[i] - p.z) / d;
      // Pushed away by enemies that are too close, drawn to ones a few metres out; keeps more distance when hurt.
      const keep = brave ? 2.3 : 3;
      const w = d < keep ? -1.6 / (d * d) : (brave ? 0.35 : 0.12) / d;
      ax += ux * w;
      az += uz * w;
      closest = Math.min(closest, d);
    }
    orbitTimer -= 1 / 60;
    if (orbitTimer <= 0) {
      orbitTimer = 6 + rng.next() * 6;
      orbit = rng.next() < 0.5 ? -1 : 1;
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
    let d = Math.atan2(-ax, -az) - game.cam.yaw;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    game.cam.yaw += d * 0.02;
    if (closest < 1.6 && rng.next() < 0.08) inp.press('jump');
    if (closest < 2.5 && rng.next() < 0.02) inp.press('slide');
  };
}
