// What Piotrek hold, on any Character: the briefcase (or a ★ knife instead), Gnat z CS in the left hand
// as the equipped CS gun, and ★ gloves. Used by the player in a run and by Piotrek standing in the hub.

import { BoxGeometry, Group, Mesh, MeshToonMaterial, type Material } from 'three';
import type { Character } from '../characters/character';
import { DEFAULT_GUN } from '../content/skins/catalog';
import { gunKey, type Gear } from '../game/gear';
import { buildGlove, buildGun, buildKnife, gloveShape, gunMaterials } from './cs-models';
import { skinMaterial } from './skin-material';
import { toonRamp } from './toon';

const KNIFE_SCALE = 1.35;
const GUN_SCALE = 1.1;

export class Kit {
  private readonly briefcase = new Group();
  private readonly briefcaseMats: [Material, Material];
  /** Holder in the left hand; the gun model inside is swapped when the skin changes. */
  readonly gun = new Group();
  /** Holder in the right hand for a ★ knife (the hub spins it for the inspect flourish). */
  readonly knifeHolder = new Group();
  private owned: Material[] = [];
  private gunWeapon = '';
  /** Accent colour of the knife's skin, for its swing trail (null with the briefcase). */
  swingColor: string | null = null;

  constructor(private readonly avatar: Character) {
    this.briefcaseMats = [new MeshToonMaterial({ color: '#6b4426', gradientMap: toonRamp() }), new MeshToonMaterial({ color: '#2b1c12', gradientMap: toonRamp() })];
    this.briefcase.add(new Mesh(new BoxGeometry(0.34, 0.26, 0.08), this.briefcaseMats[0]));
    const handle = new Mesh(new BoxGeometry(0.12, 0.05, 0.03), this.briefcaseMats[1]);
    handle.position.y = 0.15;
    this.briefcase.add(handle);
    this.briefcase.position.set(0, -0.2, 0.02);
    avatar.joints.wristR.add(this.briefcase);
    this.knifeHolder.position.set(0, -0.085, 0.02);
    this.knifeHolder.scale.setScalar(KNIFE_SCALE);
    avatar.joints.wristR.add(this.knifeHolder);
    this.gun.position.set(0, -0.12, 0.04);
    this.gun.rotation.x = Math.PI / 2;
    this.gun.scale.setScalar(GUN_SCALE);
    this.gun.visible = false;
    avatar.joints.wristL.add(this.gun);
    this.apply(null);
  }

  /** Rebuilds the held items for this gear (null = nothing equipped: the plain Glock and the briefcase). */
  apply(gear: Gear | null): void {
    for (const m of this.owned) m.dispose();
    this.owned = [];
    // Gnat z CS: the model of the equipped gun, painted with its skin.
    const weapon = gear ? gunKey(gear) : DEFAULT_GUN;
    const mats = gunMaterials(gear?.gun?.look ?? null);
    this.owned.push(mats.body, mats.detail, mats.barrel);
    this.gun.clear();
    this.gun.add(buildGun(weapon, mats));
    this.gunWeapon = weapon;
    // A ★ knife replaces the briefcase; a wrap repaints the briefcase itself.
    this.knifeHolder.clear();
    const knife = gear?.knife ?? null;
    if (knife) {
      const blade = skinMaterial(knife.look, 0, 14);
      const handle = skinMaterial(knife.look, 1, 14);
      this.owned.push(blade, handle);
      this.knifeHolder.add(buildKnife(knife.weapon, blade, handle));
      this.swingColor = knife.look.palette[Math.min(1, knife.look.palette.length - 1)] ?? null;
    } else this.swingColor = null;
    this.briefcase.visible = knife === null;
    const wrap = gear?.wraps.get('teczka') ?? null;
    const [body, handle] = this.briefcase.children as Mesh[];
    if (wrap) {
      const a = skinMaterial(wrap.look, 0, 7);
      const b = skinMaterial(wrap.look, 1, 7);
      this.owned.push(a, b);
      body.material = a;
      handle.material = b;
    } else {
      body.material = this.briefcaseMats[0];
      handle.material = this.briefcaseMats[1];
    }
    // ★ gloves on both hands.
    const gloves = gear?.gloves ?? null;
    if (gloves) {
      const g = skinMaterial(gloves.look, 0, 26);
      this.owned.push(g);
      const shape = gloveShape(gloves.weapon);
      this.avatar.setGloves((side) => buildGlove(g, shape, side));
    } else this.avatar.setGloves(null);
  }

  /** The CS weapon key the left hand holds. */
  get gunModel(): string {
    return this.gunWeapon;
  }

  showGun(on: boolean): void {
    this.gun.visible = on;
  }
}
