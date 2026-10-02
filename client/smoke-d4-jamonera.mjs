// M1.5-D4 Etapa 1 (repro punto 5): ciclo completo Corral → Jamonera → portal.
// Etapas: a) el cerdo llega a la entrada · b) la jamonera lo acepta y consume ·
// c) se procesa (4000 ms) · d) el jamón aparece en la boca · e) el jamón se
// aleja por la canaleta (no queda quieto ni lo come la limpieza) · f) el
// portal (DELIVERY_Z) lo recibe y suma mult global. Más ciclos de palomitera
// y corral. Alimentación manual por trasera (patrón smoke-b).
// node smoke-d4-jamonera.mjs → sale 0 si todo pasa.
import RAPIER from '@dimforge/rapier3d-compat';
import { SimWorld } from './src/sim/world.js';
import { GameState } from './src/game/state.js';
import { DELIVERY_Z } from 'chanchos-shared';

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

// ---- ciclo jamonera: corral adyacente → jamonera adyacente → recta → portal ----
{
  const sim = new SimWorld();
  const state = new GameState();
  const got = [];
  sim.onDeliver = (kind, pos, t, meta) => got.push({ kind, meta, res: state.registerDelivery(kind, t, meta) });
  ok(sim.placeTool('corral', 5, 7, 0, 0, 0, now), 'corral (5,7) r0 (sale N)');
  ok(sim.placeTool('jamonera', 5, 6, 0, 0, 0, now), 'jamonera (5,6) r0 (sale N, entra S)');
  ok(sim.placeTool('recta', 5, 5, 0, 0, 0, now), 'recta (5,5) al norte');
  const corral = sim.tools.get(sim.key(5, 7, 0));
  const jam = sim.tools.get(sim.key(5, 6, 0));
  state.owned.jamonera = 1;

  // a–b) traspaso boca-a-boca: el corral emite y la jamonera acepta en el
  // mismo paso (el cerdo nunca vuela eyectado: sin productos con y alto)
  sim.spawnProduct('corn', corral.cx, 0.5, corral.cz + 0.3, { x: 0, y: 0, z: 0 });
  let flew = false;
  let ham = null;
  for (let k = 0; k < 60 * 9 && !ham; k++) {
    now += 1000 / 60;
    sim.step(STEP, now);
    for (const pr of sim.products) {
      if (pr.body.translation().y > 1.5) flew = true;
    }
    ham = sim.products.find((pr) => pr.kind === 'ham') || null;
  }
  ok(!flew, 'a: traspaso sin eyección (ningún producto vuela)');
  ok(jam.pending || !!ham || jam.busyUntil > now, 'a/b: el cerdo llegó y la jamonera lo aceptó');
  ok(!!ham, 'c/d: tras el curado el jamón aparece en la boca');

  // e) el jamón se aleja por la canaleta (no queda quieto, no lo come la limpieza)
  const h0 = ham.body.translation();
  steps(sim, 60 * 3);
  const h1 = ham.body.translation();
  const moved = Math.hypot(h1.x - h0.x, h1.z - h0.z);
  ok(sim.products.includes(ham), 'e: el jamón sigue vivo (no lo comió la limpieza)');
  ok(moved > 0.3, `e: el jamón se aleja de la boca (Δ=${moved.toFixed(2)})`);

  // f) el portal lo recibe y suma mult global (patrón smoke-b: teleport + empuje)
  ham.body.setTranslation({ x: 0, y: 0.5, z: DELIVERY_Z + 0.4 }, true);
  ham.body.setLinvel({ x: 0, y: 0, z: -3 }, true);
  steps(sim, 90);
  ok(got.length === 1 && got[0].kind === 'ham', 'f: el portal recibe el jamón');
  const base = new GameState().registerDelivery('ham', now).value;
  ok(got[0].res.value > base, `f: mult global aplicado (${base}→${got[0].res.value})`);
}

// ---- ciclo palomitera: maíz → palomita emitida sin lift ----
{
  const sim = new SimWorld();
  ok(sim.placeTool('palomitera', 6, 6, 0, 0, 0, now), 'palomitera (6,6) r0');
  ok(sim.placeTool('recta', 6, 5, 0, 0, 0, now), 'recta (6,5) al norte');
  const pal = sim.tools.get(sim.key(6, 6, 0));
  sim.spawnProduct('corn', pal.cx, 0.5, pal.cz + 0.3, { x: 0, y: 0, z: 0 });
  let pop = null;
  let popV = null;
  for (let k = 0; k < 60 * 5 && !pop; k++) {
    now += 1000 / 60;
    sim.step(STEP, now);
    pop = sim.products.find((pr) => pr.kind === 'popcorn') || null;
    if (pop) popV = pop.body.linvel();
  }
  ok(!!pop, 'palomitera convierte maíz→palomita');
  ok(popV && popV.y < 0.05, `palomita sin lift (vy=${popV ? popV.y.toFixed(3) : '?'})`);
}

// ---- ciclo corral: maíz → cerdo emitido sin lift ----
{
  const sim = new SimWorld();
  ok(sim.placeTool('corral', 7, 6, 0, 0, 0, now), 'corral (7,6) r0');
  ok(sim.placeTool('recta', 7, 5, 0, 0, 0, now), 'recta (7,5) al norte');
  const cor = sim.tools.get(sim.key(7, 6, 0));
  sim.spawnProduct('corn', cor.cx, 0.5, cor.cz + 0.3, { x: 0, y: 0, z: 0 });
  let pig = null;
  let pigV = null;
  for (let k = 0; k < 60 * 6 && !pig; k++) {
    now += 1000 / 60;
    sim.step(STEP, now);
    pig = sim.products.find((pr) => pr.kind === 'pig') || null;
    if (pig) pigV = pig.body.linvel();
  }
  ok(!!pig, 'corral convierte maíz→cerdo');
  ok(pigV && pigV.y < 0.05, `cerdo sin lift (vy=${pigV ? pigV.y.toFixed(3) : '?'})`);
}

console.log(`\nSMOKE-D4-JAMONERA PASS (${pass} checks)`);
