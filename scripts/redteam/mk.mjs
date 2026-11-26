// Spec builder for boss benches: node scripts/redteam/mk.mjs <out.json> <seeds> <planner> <mortal> <stations,...> <name=w1,w2,..|p1,p2,..|buff:stat=v,..|gun> ...
import { writeFileSync } from 'node:fs';
const P = { okulary: 0.45, zdrapka: 0.7, 'bilet-ulgowy': 2, energetyk: 0.48, kanapka: 0.5, nerka: 1.5, termos: 0.5, klapki: 0.38, kurtka: 0.39, tabela: 0.44 };
const LV = { nerka: 5, zdrapka: 5, 'bilet-ulgowy': 2, energetyk: 5, kanapka: 5, okulary: 5, termos: 5, klapki: 5, kurtka: 5, tabela: 5 };
const EVO = ['teczka-prezesa', 'bilet-sieciowy', 'espresso', 'kebab', 'powerbank', 'parasol-burzowy', 'kontrola', 'zgrzewka', 'siec-trakcyjna', 'rozklad-2027'];
const [out, seeds, planner, mortal, stations, ...defs] = process.argv.slice(2);
const specs = defs.map((d) => {
  const name = d.slice(0, d.indexOf('=')); const rest = d.slice(d.indexOf('=') + 1);
  const [ws, ps, bs, gun] = rest.split('|');
  const weapons = ws.split(',').map((w) => {
    const [id, lv] = w.split(':');
    if (EVO.includes(id)) return { id, level: 1, mults: [] };
    const level = Number(lv ?? 8);
    return { id, level, mults: new Array(level - 1).fill(1) };
  });
  const passives = (ps || '').split(',').filter(Boolean).map((p) => ({ id: p, level: LV[p], total: P[p] }));
  const buffs = (bs || '').split(',').filter(Boolean).map((b) => { const [s, v] = b.split('='); return { stat: s, value: Number(v) }; });
  return { name, stations: stations.split(','), seeds: Number(seeds), seedTag: 'rtboss', cap: 1500, boss: { planner, levels: { weapons, passives }, buffs, ...(gun ? { gun } : {}), mortal: mortal === 'mortal' } };
});
writeFileSync(out, JSON.stringify(specs, null, 1));
