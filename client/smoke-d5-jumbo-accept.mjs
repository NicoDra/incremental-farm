// M1.5-F jumbo aceptación: todos procesadores aceptan jumbo en entrada.
// Cubre maíz/corral/palomitera, cerdo/jamonera, recetas dobles (pienso y
// jamonera industrial). Verifica además herencia jumbo en salida.
import RAPIER from '@dimforge/rapier3d-compat';
import { SimWorld } from './src/sim/world.js';

await RAPIER.init();

let now = 1_400_000;
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

function backSpawn(sim, entry, kind, jumbo = true) {
  return sim.spawnProduct(kind, entry.cx, 0.5, entry.cz + 0.36, { x: 0, y: 0, z: 0 }, { jumbo });
}

// 1) palomitera acepta maíz jumbo y escupe palomita jumbo
{
  const sim = new SimWorld();
  ok(sim.placeTool('palomitera', 6, 6, 0, 0, 0, now), 'palomitera colocada');
  const e = sim.tools.get(sim.key(6, 6, 0));
  const p = backSpawn(sim, e, 'corn', true);
  ok(!!p && p.jumbo, 'maíz jumbo spawn');
  steps(sim, 60 * 5);
  const out = sim.products.find((q) => q.kind === 'popcorn');
  ok(!!out, 'palomitera produce palomita');
  ok(out.jumbo === true, 'palomitera hereda jumbo');
}

// 2) corral acepta maíz jumbo y escupe cerdo jumbo
{
  const sim = new SimWorld();
  ok(sim.placeTool('corral', 7, 6, 0, 0, 0, now), 'corral colocado');
  const e = sim.tools.get(sim.key(7, 6, 0));
  const p = backSpawn(sim, e, 'corn', true);
  ok(!!p && p.jumbo, 'maíz jumbo spawn corral');
  steps(sim, 60 * 7);
  const out = sim.products.find((q) => q.kind === 'pig');
  ok(!!out, 'corral produce cerdo');
  ok(out.jumbo === true, 'corral hereda jumbo');
}

// 3) jamonera acepta cerdo jumbo y escupe jamón jumbo
{
  const sim = new SimWorld();
  ok(sim.placeTool('jamonera', 8, 6, 0, 0, 0, now), 'jamonera colocada');
  const e = sim.tools.get(sim.key(8, 6, 0));
  const p = backSpawn(sim, e, 'pig', true);
  ok(!!p && p.jumbo, 'cerdo jumbo spawn');
  steps(sim, 60 * 8);
  const out = sim.products.find((q) => q.kind === 'ham');
  ok(!!out, 'jamonera produce jamón');
  ok(out.jumbo === true, 'jamonera hereda jumbo');
}

// 4) pienso receta doble acepta jumbo (corn+pumpkin) y feed sale jumbo si alguno jumbo
{
  const sim = new SimWorld();
  ok(sim.placeTool('pienso', 9, 6, 0, 0, 0, now), 'pienso colocado');
  const e = sim.tools.get(sim.key(9, 6, 0));
  ok(!!backSpawn(sim, e, 'corn', true), 'pienso: corn jumbo');
  ok(!!backSpawn(sim, e, 'pumpkin', false), 'pienso: pumpkin normal');
  steps(sim, 60 * 6);
  const out = sim.products.find((q) => q.kind === 'feed');
  ok(!!out, 'pienso produce feed');
  ok(out.jumbo === true, 'pienso: salida jumbo si algún input jumbo');
}

// 5) jamonera industrial receta doble acepta jumbo (pig+salt)
{
  const sim = new SimWorld();
  ok(sim.placeTool('jamonera_industrial', 10, 6, 0, 0, 0, now), 'jamonera industrial colocada');
  const e = sim.tools.get(sim.key(10, 6, 0));
  ok(!!backSpawn(sim, e, 'pig', false), 'industrial: pig normal');
  ok(!!backSpawn(sim, e, 'salt', true), 'industrial: salt jumbo');
  steps(sim, 60 * 8);
  const out = sim.products.find((q) => q.kind === 'ham');
  ok(!!out, 'industrial produce ham');
  ok(out.jumbo === true, 'industrial: salida jumbo si algún input jumbo');
}

console.log(`\nSMOKE-D5-JUMBO-ACCEPT PASS (${pass} checks)`);
