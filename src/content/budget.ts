// Weapon power budgets (BALANCE.md, "Bronie"): a damage multiplier per weapon and level that puts every weapon
// on the reference curve. Written by `node scripts/sim/budget.ts --zapisz` from the dummy bench; checked in CI
// by `node scripts/sim/budget.ts --sprawdz` (every weapon within ±15 % of its target at every level).
// Generated: do not edit by hand.

export const WEAPON_BUDGET: Partial<Record<string, readonly number[]>> = {
  'teczka': [1.414, 1.207, 1.085, 0.876, 0.785, 0.722, 0.661, 0.534],
  'bilet': [4.475, 3.579, 2.858, 3.318, 2.842, 2.573, 2.554, 2.359],
  'kawa': [2.976, 1.836, 1.748, 1.338, 1.119, 1.442, 1.333, 1.17],
  'sos': [0.858, 0.753, 0.695, 0.686, 0.67, 0.622, 0.622, 0.582],
  'telefon': [1.97, 1.919, 1.436, 1.254, 1.241, 0.986, 0.82, 0.682],
  'parasol': [0.831, 0.607, 0.571, 0.719, 0.807, 0.758, 0.65, 0.627],
  'gwizdek': [1.71, 1.468, 1.652, 1.424, 1.287, 1.159, 0.859, 0.703],
  'puszka': [8.948, 7.047, 3.557, 3.188, 3.095, 2.548, 2.425, 1.897],
  'gnat': [0.677, 0.615, 0.604, 1.081, 1.039, 1.159, 1.22, 1.109],
  'iskra': [3.201, 2.418, 2.202, 2.174, 2.239, 2.219, 2.165, 1.626],
  'rozklad': [1.474, 1.506, 1.691, 1.266, 1.336, 1.247, 1.05, 1.04],
  'teczka-prezesa': [0.321],
  'bilet-sieciowy': [1.026],
  'espresso': [0.677],
  'kebab': [0.297],
  'powerbank': [0.437],
  'parasol-burzowy': [0.265],
  'kontrola': [0.302],
  'zgrzewka': [0.65],
  'siec-trakcyjna': [0.962],
  'rozklad-2027': [0.915],
};
