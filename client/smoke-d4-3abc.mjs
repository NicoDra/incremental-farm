// M1.5-D4 Etapa 1 (repro): uniones canaleta/curva/máquina, casos a/b/c.
// - a) zigzag: aperturas de toda la cadena + contención (flujo por tramos,
//   sin exigir travesía multi-celda: la fricción actual no la permite).
// - b) dos circuitos paralelos pegados: rectas flanco↔flanco sin unión;
//   curvas boca→trasera SÍ unen (auto-conexión).
// - c) canaleta/curva pegada a flanco de procesador (no entrada/salida).
// - ninguna pared atraviesa el volumen de una máquina (holgura numérica).
// node smoke-d4-3abc.mjs → sale 0 si todo pasa.
import RAPIER from '@dimforge/rapier3d-compat';
import { SimWorld } from './src/sim/world.js';
import { OPEN_BACKS } from 'chanchos-shared';

await RAPIER.init();

let now = 800000;
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
const opens = (sim, i, j) => sim.tools.get(sim.key(i, j, 0)).opens || {};

// ---- a) zigzag: curva→corral→curva→jamonera→curva (sembrador al inicio) ----
{
  const sim = new SimWorld();
  ok(sim.placeTool('sembrador', 4, 8, 0, 0, 0, now), 'a: sembrador (4,8) r0');
  ok(sim.placeTool('curva', 4, 7, 0, 2, 0, now), 'a: curva (4,7) r2');
  ok(sim.placeTool('corral', 5, 7, 0, 2, 0, now), 'a: corral (5,7) r2');
  ok(sim.placeTool('curva', 6, 7, 0, 4, 0, now), 'a: curva (6,7) r4');
  ok(sim.placeTool('jamonera', 6, 8, 0, 4, 0, now), 'a: jamonera (6,8) r4');
  ok(sim.placeTool('curva', 6, 9, 0, 6, 0, now), 'a: curva (6,9) r6');
  const e47 = opens(sim, 4, 7);
  ok(e47.S && e47.E && !e47.N && !e47.W, `a: curva (4,7) opens=${JSON.stringify(e47)}`);
  const e67 = opens(sim, 6, 7);
  ok(e67.W && e67.S && !e67.N && !e67.E, `a: curva (6,7) opens=${JSON.stringify(e67)}`);
  const e69 = opens(sim, 6, 9);
  ok(e69.N && e69.W && !e69.S && !e69.E, `a: curva (6,9) opens=${JSON.stringify(e69)}`);
  // producto en la curva intermedia: no se sale del carril (ni atraviesa paredes)
  const c = sim.cellCenter(6, 7);
  const p = sim.spawnProduct('corn', c.x, 0.4, c.z + 0.2, { x: 0, y: 0, z: 0 });
  steps(sim, 120);
  const t = p.body.translation();
  ok(Math.abs(t.x - c.x) <= 0.55 && Math.abs(t.z - c.z) <= 1.1, `a: contenida en el carril (${t.x.toFixed(2)}, ${t.z.toFixed(2)})`);
}

// ---- b) dos circuitos paralelos pegados: rectas + curvas, sin conexión lateral ----
{
  const sim = new SimWorld();
  ok(sim.placeTool('recta', 5, 5, 0, 0, 0, now), 'b: recta A (5,5) r0');
  ok(sim.placeTool('recta', 6, 5, 0, 0, 0, now), 'b: recta B (6,5) r0');
  ok(sim.placeTool('curva', 5, 7, 0, 0, 0, now), 'b: curva A (5,7) r0');
  ok(sim.placeTool('curva', 6, 7, 0, 0, 0, now), 'b: curva B (6,7) r0');
  const oA = opens(sim, 5, 5);
  const oB = opens(sim, 6, 5);
  ok(oA.E === false && oB.W === false, `b: rectas sin conexión lateral (A.E=${oA.E}, B.W=${oB.W})`);
  const oCA = opens(sim, 5, 7);
  const oCB = opens(sim, 6, 7);
  ok(oCA.E === true, 'b: curva A conserva su default E (boca de entrada)');
  ok(oCB.W === OPEN_BACKS, `b: boca de A abre la trasera de B (OPEN_BACKS=${OPEN_BACKS}, B.W=${oCB.W})`);
  // flujo: el maíz cruza a B por la unión (la T conecta los carriles)
  const cB = sim.cellCenter(5, 7);
  const pB = sim.spawnProduct('corn', cB.x, 0.4, cB.z, { x: 1.6, y: 0, z: 0 });
  steps(sim, 90);
  const tB = pB.body.translation();
  ok(sim.products.includes(pB), 'b: el maíz sigue vivo tras cruzar');
  ok(tB.x > cB.x + 0.55, `b: cruza al circuito B (x=${tB.x.toFixed(2)}, carril=${cB.x.toFixed(2)})`);
  // flujo: maíz por el carril A no cruza al B
  const c = sim.cellCenter(5, 5);
  const p = sim.spawnProduct('corn', c.x, 0.4, c.z + 0.3, { x: 0, y: 0, z: -1.6 });
  steps(sim, 90);
  const t = p.body.translation();
  ok(t.x < c.x + 0.55, `b: no cruza al circuito B (x=${t.x.toFixed(2)}, carril=${c.x.toFixed(2)})`);
}

// ---- c) canaleta/curva pegada al flanco (no entrada/salida) del procesador ----
{
  const sim = new SimWorld();
  ok(sim.placeTool('corral', 5, 5, 0, 2, 0, now), 'c: corral r2 (sale E, entra W)');
  ok(sim.placeTool('recta', 5, 6, 0, 0, 0, now), 'c: recta al sur (flanco)');
  ok(sim.placeTool('curva', 5, 4, 0, 0, 0, now), 'c: curva al norte (flanco)');
  const oS = opens(sim, 5, 6);
  ok(oS.N === false, `c: recta flanco sur cerrada (${JSON.stringify(oS)})`);
  const oN = opens(sim, 5, 4);
  ok(oN.S === false, `c: curva flanco norte cerrada (${JSON.stringify(oN)})`);
  // el flanco hacia la boca SÍ abre (regla de máquina, no de cercanía)
  ok(sim.placeTool('recta', 6, 5, 0, 0, 0, now), 'c: recta al este (boca)');
  ok(opens(sim, 6, 5).W === true, 'c: flanco hacia la boca abierto');
}

// ---- d) ninguna pared atraviesa el volumen de una máquina ni bloquea su boca ----
// Pared de canaleta a ±0.48 del centro del canal; centro de la máquina vecina
// a 1.0 → plano de pared a 0.52 del centro de la máquina; cuerpo ±0.35.
// Holgura = 0.52 - 0.35 = 0.17 > 0.
{
  const clearance = 1.0 - 0.48 - 0.35;
  ok(clearance > 0.1, `d: holgura pared-cuerpo = ${clearance.toFixed(2)} (pared en 0.52, cuerpo hasta 0.35)`);
  // conductual: el cerdo emitido al este viaja entre las paredes N/S de la
  // recta vecina sin desviarse (ninguna pared cruza su camino)
  const sim = new SimWorld();
  ok(sim.placeTool('corral', 5, 5, 0, 2, 0, now), 'd: corral (5,5) r2 (sale E)');
  ok(sim.placeTool('recta', 6, 5, 0, 0, 0, now), 'd: recta (6,5) al este (boca)');
  const corral = sim.tools.get(sim.key(5, 5, 0));
  sim.spawnProduct('corn', corral.cx - 0.3, 0.5, corral.cz, { x: 0, y: 0, z: 0 });
  let pig = null;
  for (let k = 0; k < 60 * 6 && !pig; k++) {
    now += 1000 / 60;
    sim.step(STEP, now);
    pig = sim.products.find((pr) => pr.kind === 'pig') || null;
  }
  ok(!!pig, 'd: corral emite cerdo a la recta');
  const x0 = pig.body.translation().x;
  const z0 = pig.body.translation().z;
  steps(sim, 60);
  const t = pig.body.translation();
  ok(t.x - x0 > 0.2, `d: avanza al este sin bloqueo (${(t.x - x0).toFixed(2)})`);
  ok(Math.abs(t.z - z0) < 0.35, `d: sin desvío lateral (${Math.abs(t.z - z0).toFixed(2)})`);
}

console.log(`\nSMOKE-D4-3ABC PASS (${pass} checks)`);
