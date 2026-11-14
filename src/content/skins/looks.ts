// Colours the measured palettes get wrong. A palette measured from a skin's image often starts with the gun's
// grey receiver or handle, so famous skins would not be recognisable. Finishes that look the same on every
// weapon in CS (Fade, Doppler phases, Marble Fade…) get their real colours here, and the best-known skins
// get hand-picked palettes: base colour first, then the accents, as the shader expects.

/** "Weapon | Pattern" (or "Weapon | Pattern (Phase)") → palette. */
export const PALETTE_OVERRIDES: Partial<Record<string, string[]>> = {
  'AWP | Asiimov': ['#ecebe6', '#ff6a13', '#1b1b1b'],
  'AK-47 | Asiimov': ['#ecebe6', '#ff6a13', '#1b1b1b'],
  'M4A4 | Asiimov': ['#ecebe6', '#ff6a13', '#1b1b1b'],
  'P90 | Asiimov': ['#ecebe6', '#ff6a13', '#1b1b1b'],
  'AK-47 | Fire Serpent': ['#2f5a3a', '#d9b44a', '#b43a2a', '#1d2a20'],
  'AK-47 | Redline': ['#1c1c1c', '#c4161c', '#3a3a3a'],
  'AWP | Redline': ['#1c1c1c', '#c4161c', '#3a3a3a'],
  'AK-47 | Vulcan': ['#efefea', '#2a6fd0', '#1b1b1b', '#ff7a1a'],
  'AK-47 | Neon Rider': ['#2b1a4a', '#ff3ea5', '#2fe6d6', '#ffd23a'],
  'AK-47 | Bloodsport': ['#1b1b1b', '#d01a1a', '#efefea'],
  'AK-47 | The Empress': ['#2a1a48', '#d9b44a', '#7a2fb0', '#e9e0d0'],
  'AK-47 | Neon Revolution': ['#1b1b1b', '#3cff8c', '#ff3ea5'],
  'AWP | Hyper Beast': ['#2fbf6a', '#ff4f8b', '#3a6be0', '#f2d23a'],
  'M4A1-S | Hyper Beast': ['#2fbf6a', '#ff4f8b', '#3a6be0', '#f2d23a'],
  'Five-SeveN | Hyper Beast': ['#2fbf6a', '#ff4f8b', '#3a6be0', '#f2d23a'],
  'AWP | Lightning Strike': ['#2a1248', '#a050ff', '#e8d0ff'],
  'AWP | Neo-Noir': ['#efefea', '#1b1b1b', '#c4161c'],
  'M4A4 | Neo-Noir': ['#efefea', '#1b1b1b', '#c4161c'],
  'USP-S | Neo-Noir': ['#efefea', '#1b1b1b', '#c4161c'],
  'M4A1-S | Printstream': ['#f2f2f2', '#1b1b1b', '#c8c8e0'],
  'Desert Eagle | Printstream': ['#f2f2f2', '#1b1b1b', '#c8c8e0'],
  'USP-S | Printstream': ['#f2f2f2', '#1b1b1b', '#c8c8e0'],
  'AWP | Printstream': ['#f2f2f2', '#1b1b1b', '#c8c8e0'],
  'Desert Eagle | Kumicho Dragon': ['#1b1b1b', '#c4161c', '#d9b44a'],
  'USP-S | Kill Confirmed': ['#2a2a2a', '#c4161c', '#d9d9d9'],
  'Glock-18 | Water Elemental': ['#1d5fd0', '#ff7a1a', '#efefea'],
  'Glock-18 | Wasteland Rebel': ['#3a3a30', '#d9b44a', '#c4161c'],
  'M4A4 | Desolate Space': ['#1b1b2a', '#7a2fb0', '#ff8a3a'],
  'M4A1-S | Golden Coil': ['#1b1b1b', '#d9b44a', '#efefea'],
  'M4A1-S | Cyrex': ['#efefea', '#c4161c', '#1b1b1b'],
  'SG 553 | Cyrex': ['#efefea', '#c4161c', '#1b1b1b'],
  'P250 | See Ya Later': ['#3fbf5a', '#1b1b1b', '#efefea'],
  'AK-47 | Aquamarine Revenge': ['#1b1b1b', '#2fd6c4', '#ff4f8b'],
  'AK-47 | Frontside Misty': ['#5a7ad0', '#efefea', '#1b1b1b'],
  'AK-47 | Wasteland Rebel': ['#3a3a30', '#d9b44a', '#c4161c'],
  'AWP | Containment Breach': ['#1b1b1b', '#9cff2a', '#efefea'],
  'AWP | Wildfire': ['#1b1b1b', '#ff5a1a', '#ffd23a'],
  'M4A4 | The Emperor': ['#2a3a8a', '#d9b44a', '#efefea'],
  'AK-47 | Nightwish': ['#1a1a4a', '#a050ff', '#2fd6d6'],
  // Gloves.
  'Sport Gloves | Vice': ['#ff4fa5', '#2fd6d6', '#5a2a8a'],
  "Sport Gloves | Pandora's Box": ['#3a1a5a', '#9a4ad8', '#1b1b1b'],
  'Sport Gloves | Superconductor': ['#2b2b33', '#5ad0ff', '#e0e0e0'],
  'Sport Gloves | Hedge Maze': ['#3a7a3a', '#d9d9d9', '#1b1b1b'],
  'Sport Gloves | Omega': ['#2a2a2a', '#6a6aff', '#d9d9d9'],
  'Specialist Gloves | Crimson Kimono': ['#9c0f12', '#1b1b1b', '#d9b44a'],
  'Specialist Gloves | Emerald Web': ['#0f8a3c', '#1b1b1b', '#3cff8c'],
  'Driver Gloves | King Snake': ['#1b1b1b', '#d9b44a', '#c4161c'],
  'Driver Gloves | Crimson Weave': ['#9c0f12', '#1b1b1b', '#5a0a0c'],
  'Moto Gloves | Spearmint': ['#9be0c8', '#f0f0f0', '#2a4a3a'],
  'Moto Gloves | Cool Mint': ['#a8e6cf', '#6a7a80', '#2a2a2a'],
  'Moto Gloves | POW!': ['#ffd23a', '#c4161c', '#1d5fd0'],
  'Hand Wraps | Slaughter': ['#b81414', '#e8d8d0', '#5a0a0c'],
};

/** Doppler and Gamma Doppler phases (knife colours by phase, as in CS). */
const PHASES: Partial<Record<string, string[]>> = {
  'Phase 1': ['#1a0f22', '#6a1f5e', '#c03a8a'],
  'Phase 2': ['#3a1450', '#d0408e', '#ff7ab8'],
  'Phase 3': ['#0f3d3a', '#1d7f6b', '#4fb3d9'],
  'Phase 4': ['#0c1f5c', '#2f5fd0', '#7aa7ff'],
  Ruby: ['#3a040c', '#b0102a', '#ff3a4a'],
  Sapphire: ['#061a4f', '#1440c0', '#3f8cff'],
  'Black Pearl': ['#0f0818', '#3a1d52', '#6b3a8f'],
  Emerald: ['#06331a', '#0f8a3c', '#3cff8c'],
};
const GAMMA: Partial<Record<string, string[]>> = {
  'Phase 1': ['#06331a', '#1f9a3c', '#9cff2a'],
  'Phase 2': ['#0a3a2a', '#1fae6a', '#7affb0'],
  'Phase 3': ['#0a2a3a', '#1f8a9a', '#5affe0'],
  'Phase 4': ['#0a1f3a', '#1f5aae', '#5ab0ff'],
};

/** The palette a finish has whatever the weapon (null: use the measured or overridden one). */
export function finishPalette(finish: string, pattern: string, phase: string | undefined): string[] | null {
  switch (finish) {
    case 'fade':
      return pattern.includes('Amber') ? ['#c56b1b', '#e2a33a', '#f3d46b'] : ['#f2c94c', '#e8638f', '#8a4fd8'];
    case 'marble':
      return ['#c4161c', '#f2c230', '#1d4fd0'];
    case 'doppler':
      return (pattern.includes('Gamma') ? GAMMA[phase ?? ''] : PHASES[phase ?? '']) ?? (pattern.includes('Gamma') ? ['#06331a', '#1f9a3c', '#9cff2a'] : ['#3a1450', '#d0408e', '#ff7ab8']);
    case 'web':
      return pattern.includes('Emerald') ? ['#0f8a3c', '#0c0c0c'] : ['#9c0f12', '#0c0c0c'];
    default:
      return null;
  }
}
