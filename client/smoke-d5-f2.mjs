// M1.5-F2 smoke: recetas de dos ingredientes + buffers por entrada.
import RAPIER from '@dimforge/rapier3d-compat';
import { SimWorld } from './src/sim/world.js';
import { CONVERTER_BUFFER_CAP } from 'chanchos-shared';

await RAPIER.init();

let now = 1_300_000;
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

// ---- 1) buffers independientes en Pienso ----
{
  const sim = new SimWorld();
  ok(sim.placeTool('pienso', 5, 5, 0, 0, 0, now), 'F2: pienso colocado');
  const e = sim.tools.get(sim.key(5, 5, 0));
  ok(e && e.inputBuffers && e.inputBuffers.corn && e.inputBuffers.pumpkin, 'F2: inputBuffers separados (corn,pumpkin)');

  // llena solo corn
  for (let k = 0; k < CONVERTER_BUFFER_CAP + 2; k++) {
    sim.spawnProduct('corn', e.cx, 0.45, e.cz + 0.35 + k * 0.01, { x: 0, y: 0, z: -0.6 });
  }
  steps(sim, 120);
  ok(e.inputBuffers.corn.length === CONVERTER_BUFFER_CAP, `F2: corn llena cap (${e.inputBuffers.corn.length})`);
  ok(e.inputBuffers.pumpkin.length === 0, 'F2: pumpkin sigue vacío');
  ok(!e.pending, 'F2: sin pumpkin no arranca receta');

  // pumpkin entra igual aunque corn esté llena (buffer independiente)
  sim.spawnProduct('pumpkin', e.cx, 0.45, e.cz + 0.35, { x: 0, y: 0, z: -0.6 });
  steps(sim, 20);
  ok(e.pending === true, 'F2: con pumpkin disponible arranca proceso');
  ok(e.inputBuffers.corn.length === CONVERTER_BUFFER_CAP - 1, 'F2: consumió 1 corn');
  ok(e.inputBuffers.pumpkin.length === 0, 'F2: consumió 1 pumpkin');

  // al terminar, aparece pienso
  steps(sim, 60 * 5);
  ok(sim.products.some((p) => p.kind === 'feed'), 'F2: Pienso produce feed');
}

// ---- 2) Jamonera Industrial requiere pig + salt ----
{
  const sim = new SimWorld();
  ok(sim.placeTool('jamonera_industrial', 7, 7, 0, 0, 0, now), 'F2: jamonera industrial colocada');
  const e = sim.tools.get(sim.key(7, 7, 0));

  sim.spawnProduct('pig', e.cx, 0.45, e.cz + 0.35, { x: 0, y: 0, z: -0.6 });
  steps(sim, 60 * 4);
  ok(!sim.products.some((p) => p.kind === 'ham'), 'F2: solo pig no produce ham');

  sim.spawnProduct('salt', e.cx, 0.45, e.cz + 0.35, { x: 0, y: 0, z: -0.6 });
  steps(sim, 60 * 7);
  ok(sim.products.some((p) => p.kind === 'ham'), 'F2: pig+salt produce ham');
}

// ---- 3) línea real: corral(back) + salinera(right) -> jamonera industrial ----
{
  const sim = new SimWorld();
  ok(sim.placeTool('corral', 5, 8, 0, 0, 0, now), 'F2: line corral');
  ok(sim.placeTool('salinera', 6, 7, 0, 6, 0, now), 'F2: line salinera por lado derecho');
  ok(sim.placeTool('jamonera_industrial', 5, 7, 0, 0, 0, now), 'F2: line jamonera industrial');
  const cor = sim.tools.get(sim.key(5, 8, 0));
  const sal = sim.tools.get(sim.key(6, 7, 0));
  sim.spawnProduct('corn', cor.cx, 0.5, cor.cz + 0.35, { x: 0, y: 0, z: 0 });
  sim.emitFrom(sal);
  steps(sim, 60 * 12);
  ok(sim.products.some((p) => p.kind === 'ham'), 'F2: línea real entrega ham');
}

// ---- 4) línea real jumbo: pig jumbo + salt jumbo también entran ----
{
  const sim = new SimWorld();
  ok(sim.placeTool('corral', 9, 8, 0, 0, 0, now), 'F2J: corral');
  ok(sim.placeTool('salinera', 10, 7, 0, 6, 0, now), 'F2J: salinera lateral');
  ok(sim.placeTool('jamonera_industrial', 9, 7, 0, 0, 0, now), 'F2J: jamonera industrial');
  const cor = sim.tools.get(sim.key(9, 8, 0));
  const sal = sim.tools.get(sim.key(10, 7, 0));

  // genera pig jumbo en línea real (corn jumbo entra al corral)
  sim.spawnProduct('corn', cor.cx, 0.5, cor.cz + 0.35, { x: 0, y: 0, z: 0 }, { jumbo: true });
  // inyecta salt jumbo en línea lateral real (desde salinera hacia O)
  sim.spawnProduct('salt', sal.cx - 0.15, 0.55, sal.cz, { x: -1.3, y: 0, z: 0 }, { jumbo: true });

  steps(sim, 60 * 14);
  const ham = sim.products.find((p) => p.kind === 'ham');
  ok(!!ham, 'F2J: línea real produce ham con insumos jumbo');
  ok(ham && ham.jumbo === true, 'F2J: ham hereda jumbo en receta industrial');
}

console.log(`\nSMOKE-D5-F2 PASS (${pass} checks)`);
