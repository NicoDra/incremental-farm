// M1.5-G smoke: ajuste de potencia y alcance del ventilador.
// - potencia en pasos % del máximo del tier (default 100 %); se conserva al subir tier.
// - alcance de 1 celda al máximo comprado (default null = sigue la mejora).
// - física y panel usan el mismo predicado; cono visual = misma fuente única.
// node smoke-d5-g-fan.mjs → sale 0 si todo pasa.
import RAPIER from '@dimforge/rapier3d-compat';
import { SimWorld } from './src/sim/world.js';
import { GameState } from './src/game/state.js';
import { History } from './src/game/history.js';
import {
  FAN_TIERS,
  FAN_POWER_STEPS,
  FAN_PANEL_PRODUCTS,
  fanEffectiveForce,
  fanEffectiveRange,
  fanMaxRange,
  fanMovesProduct,
  serializeFanTune,
  parseFanTune,
} from 'chanchos-shared';

await RAPIER.init();

let now = 3_000_000;
const STEP = 1 / 60;
let pass = 0;
function ok(cond, msg) {
  if (!cond) {
    console.error('FAIL:', msg);
    process.exit(1);
  }
  pass++;
  console.log('ok:', msg);
}
function steps(sim, n) {
  for (let k = 0; k < n; k++) {
    now += 1000 / 60;
    sim.step(STEP, now);
  }
}
// avance norte de un producto quieto dentro del cono (fan (8,10) r0 tier dado)
function pushDelta(kind, tier, tune, z = 0.5, n = 72) {
  const sim = new SimWorld();
  sim.setFanTier(tier);
  sim.placeTool('fan', 8, 10, 0, 0, 0, now, { fanTier: tier });
  const e = sim.tools.get(sim.key(8, 10, 0));
  if (tune) sim.setFanTune(e, tune);
  const p = sim.spawnProduct(kind, 0.5, 0.8, z, { x: 0, y: 0, z: 0 });
  const z0 = p.body.translation().z;
  steps(sim, n);
  if (!sim.products.includes(p)) return 99; // entregado: avance máximo
  return z0 - p.body.translation().z;
}

// ---- 0) constantes y API en shared ----
ok(JSON.stringify(FAN_POWER_STEPS) === '[25,50,75,100]', 'G: pasos de potencia 25/50/75/100');
ok(JSON.stringify(FAN_PANEL_PRODUCTS) === '["salt","corn","pumpkin","popcorn","pig","ham"]', 'G: panel lista 6 productos');
ok(Math.abs(fanEffectiveForce(2, 50) - FAN_TIERS[2].force * 0.5) < 1e-9, 'G: 50 % = mitad del máximo del tier');
ok(Math.abs(fanEffectiveForce(2, 100) - FAN_TIERS[2].force) < 1e-9, 'G: 100 % = máximo del tier');
ok(Math.abs(fanMaxRange(0, 0) - FAN_TIERS[0].range) < 1e-9, 'G: alcance máx base del tier');
ok(Math.abs(fanEffectiveRange(0, 1.2, null) - (FAN_TIERS[0].range + 1.2)) < 1e-9, 'G: null sigue al máximo comprado');
ok(fanEffectiveRange(0, 1.2, 2) === 2, 'G: ajuste reducido se mantiene');

// ---- 1) potencia: liviano menos, pesado parado; 100 % igual que hoy ----
{
  const d100 = pushDelta('corn', 2, { powerPct: 100 }, 0.5, 20);
  const d50 = pushDelta('corn', 2, { powerPct: 50 }, 0.5, 20);
  ok(d100 > 0.5, `G: maíz a 100 % se mueve (${d100.toFixed(2)})`);
  ok(d50 > 0.1 && d50 < d100 * 0.85, `G: maíz a 50 % se mueve menos (${d50.toFixed(2)} vs ${d100.toFixed(2)})`);
  const ham100 = pushDelta('ham', 0, { powerPct: 100 });
  const ham25 = pushDelta('ham', 0, { powerPct: 25 });
  ok(ham100 > 0.3, `G: jamón a 100 % se mueve (${ham100.toFixed(2)})`);
  ok(ham25 < 0.05, `G: jamón a 25 % deja de moverse (${ham25.toFixed(3)})`);
  // 100 % explícito idéntico a entrada sin ajuste (comportamiento de hoy)
  const simA = new SimWorld();
  simA.placeTool('fan', 8, 10, 0, 0, 0, now, { fanTier: 1 });
  const simB = new SimWorld();
  simB.placeTool('fan', 8, 10, 0, 0, 0, now, { fanTier: 1 });
  simB.setFanTune(simB.tools.get(simB.key(8, 10, 0)), { powerPct: 100 });
  const pa = simA.spawnProduct('corn', 0.5, 0.8, 0.5, { x: 0, y: 0, z: 0 });
  const pb = simB.spawnProduct('corn', 0.5, 0.8, 0.5, { x: 0, y: 0, z: 0 });
  const za = pa.body.translation().z;
  const zb = pb.body.translation().z;
  steps(simA, 72);
  steps(simB, 72);
  const da = za - pa.body.translation().z;
  const db = zb - pb.body.translation().z;
  ok(Math.abs(da - db) < 1e-9, `G: 100 % idéntico a hoy (${da.toFixed(4)} vs ${db.toFixed(4)})`);
}

// ---- 2) alcance reducido: fuera no afecta, dentro sí ----
{
  const farFree = pushDelta('corn', 0, null, 0.4); // axial 2.1 < 4.2
  ok(farFree > 0.3, `G: a 2.1 celdas llega el máximo (${farFree.toFixed(2)})`);
  const farCut = pushDelta('corn', 0, { rangeCells: 2 }, 0.4);
  ok(farCut < 0.05, `G: con alcance 2 no afecta a 2.1 celdas (${farCut.toFixed(3)})`);
  const nearCut = pushDelta('corn', 0, { rangeCells: 2 }, 1.0); // axial 1.5
  ok(nearCut > 0.3, `G: con alcance 2 sí afecta a 1.5 celdas (${nearCut.toFixed(2)})`);
}

// ---- 3) bordes: mejora de alcance y subida de tier ----
{
  // mejora con ajuste en máximo: lo sigue
  const sim = new SimWorld();
  sim.placeTool('fan', 8, 10, 0, 0, 0, now, { fanTier: 0 });
  const e = sim.tools.get(sim.key(8, 10, 0));
  const r0 = sim.fanParams(e).range;
  sim.setModifiers({ fanRangeBonus: 1.2 });
  const r1 = sim.fanParams(e).range;
  ok(r1 > r0 && Math.abs(r1 - (r0 + 1.2)) < 1e-9, `G: en máximo sigue la mejora (${r0.toFixed(2)}→${r1.toFixed(2)})`);
  // mejora con ajuste reducido: lo mantiene
  sim.setFanTune(e, { rangeCells: 2 });
  sim.setModifiers({ fanRangeBonus: 2.4 });
  ok(Math.abs(sim.fanParams(e).range - 2) < 1e-9, 'G: reducido mantiene 2 ante más mejora');
  // recorte al máximo vigente
  sim.setFanTune(e, { rangeCells: 99 });
  ok(Math.abs(sim.fanParams(e).range - fanMaxRange(0, 2.4)) < 1e-9, 'G: recorta al máximo vigente');
  // subir de tier con 50 %: queda 50 % del tier nuevo
  sim.setFanTune(e, { powerPct: 50 });
  e.fanTier = 2;
  ok(e.powerPct === 50, 'G: porcentaje conservado al subir tier');
  ok(Math.abs(sim.fanParams(e).force - FAN_TIERS[2].force * 0.5) < 1e-9, 'G: 50 % del máximo nuevo');
}

// ---- 4) panel ✓/✗ coincide con la física (tier 0, 25 %) ----
{
  for (const kind of FAN_PANEL_PRODUCTS) {
    const pred = fanMovesProduct(kind, 0, 25);
    const d = pushDelta(kind, 0, { powerPct: 25 });
    const moved = d > 0.15;
    ok(pred === moved, `G: ${kind} panel=${pred ? '✓' : '✗'} física Δ=${d.toFixed(3)}`);
  }
}

// ---- 5) copiar, deshacer, serializar ----
{
  // copiar vía placeTool (camino del cuentagotas I)
  const sim = new SimWorld();
  sim.placeTool('fan', 8, 10, 0, 0, 0, now, { fanTier: 1, powerPct: 50, rangeCells: 2 });
  const src = sim.tools.get(sim.key(8, 10, 0));
  ok(src.powerPct === 50 && src.rangeCells === 2, 'G: copiar conserva ajustes');
  // deshacer vía historial
  const h = new History();
  const before = sim.getFanTune(src);
  sim.setFanTune(src, { powerPct: 25 });
  h.record({ kind: 'fantune', at: sim.key(8, 10, 0), before, after: sim.getFanTune(src) });
  ok(src.powerPct === 25, 'G: cambio aplicado');
  const rec = h.undo();
  sim.setFanTune(src, rec.before);
  ok(src.powerPct === 50, 'G: deshacer restaura ajustes');
  // serializar: enteros pequeños, round-trip
  const json = JSON.stringify(serializeFanTune(src));
  ok(/"p":50/.test(json) && /"r":2/.test(json), `G: serializa enteros pequeños (${json})`);
  const back = parseFanTune(JSON.parse(json));
  ok(back && back.powerPct === 50 && back.rangeCells === 2, 'G: parse round-trip');
  ok(parseFanTune(null) === null && parseFanTune({ p: 'x' }) === null, 'G: parse inválido → null');
  // clamp al aplicar
  sim.setFanTune(src, { powerPct: 63, rangeCells: 99 });
  ok([25, 50, 75, 100].includes(src.powerPct), `G: potencia ajusta a paso (${src.powerPct})`);
  ok(sim.fanParams(src).range <= fanMaxRange(1, 0) + 1e-9, 'G: alcance recortado al usar');
}

// ---- 6) cableado UI (estático) ----
{
  const { readFileSync } = await import('node:fs');
  const { fileURLToPath } = await import('node:url');
  const { dirname, join } = await import('node:path');
  const root = dirname(fileURLToPath(import.meta.url));
  const main = readFileSync(join(root, 'src', 'main.js'), 'utf8');
  const hud = readFileSync(join(root, 'src', 'ui', 'hud.js'), 'utf8');
  const html = readFileSync(join(root, 'index.html'), 'utf8');
  const meshes = readFileSync(join(root, 'src', 'render', 'toolMeshes.js'), 'utf8');
  ok(/lk === 'b'/.test(main) && /lk === 'n'/.test(main), 'G UI: atajos B/N cableados');
  ok(/kind === 'fantune'/.test(main), 'G UI: deshacer/rehacer maneja fantune');
  ok(/fanTune/.test(main), 'G UI: cuentagotas conserva ajustes');
  ok(/fanInfo/.test(main) && /fanInfo/.test(hud), 'G UI: panel muestra tier/potencia/alcance/✓✗');
  ok(/<kbd>B<\/kbd>/.test(html) && /<kbd>N<\/kbd>/.test(html), 'G UI: ayuda lista B/N');
  ok(/powerPct/.test(meshes), 'G UI: cono visual usa ajustes');
}

console.log(`\nSMOKE-D5-G-FAN PASS (${pass} checks)`);
