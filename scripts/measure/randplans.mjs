// Random build plans like optimize.ts round 1 (four weapons, mostly with their evolution partners), as a
// bots.ts variants file: node scripts/measure/randplans.mjs 18 > scripts/measure/variants/random.json
const W = ['teczka', 'bilet', 'kawa', 'sos', 'telefon', 'parasol', 'gwizdek', 'puszka', 'gnat', 'iskra', 'rozklad'];
const PARTNER = { teczka: 'okulary', bilet: 'nerka', kawa: 'termos', sos: 'kurtka', telefon: 'energetyk', parasol: 'klapki', gwizdek: 'zdrapka', puszka: 'kanapka', iskra: 'bilet-ulgowy', rozklad: 'tabela' };
const P = ['nerka', 'energetyk', 'klapki', 'kurtka', 'zdrapka', 'termos', 'okulary', 'kanapka', 'bilet-ulgowy', 'tabela'];
let x = 20261125;
const rnd = () => ((x = (Math.imul(x, 1103515245) + 12345) >>> 0) / 4294967296);
const pick = (l, not) => { const f = l.filter((v) => !not.includes(v)); return f[Math.floor(rnd() * f.length)]; };
const out = {};
const n = Number(process.argv[2] ?? 18);
for (let k = 0; k < n; k++) {
  const w = [];
  while (w.length < 4) w.push(pick(W, w));
  const p = [];
  for (const v of w) if (PARTNER[v] && p.length < 4 && !p.includes(PARTNER[v]) && rnd() < 0.7) p.push(PARTNER[v]);
  while (p.length < 4) p.push(pick(P, p));
  out[`r${String(k + 1).padStart(2, '0')}`] = ['human', {}, {}, `${w.join('+')}/${p.join('+')}`];
}
console.log(JSON.stringify(out, null, 1));
