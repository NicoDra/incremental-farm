// M1.5-F2 smoke: recetas de dos ingredientes + buffers por entrada.
// Después de M1.5-F5: cada ingrediente tiene su costado físico (maíz←W,
// calabaza←E; cerdo←W, sal←E). La única fuente de verdad es /shared.
import RAPIER from '@dimforge/rapier3d-compat';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { SimWorld } from './src/sim/world.js';
import { CONVERTER_BUFFER_CAP, TOOLS } from 'chanchos-shared';

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

const root = dirname(fileURLToPath(import.meta.url));


// ---- 1) buffers independientes en Pienso (maíz por W, calabaza por E) ----
{
  const sim = new SimWorld();
  ok(sim.placeTool('pienso', 5, 5, 0, 0, 0, now), 'F2: pienso colocado');
  const e = sim.tools.get(sim.key(5, 5, 0));
  ok(e && e.inputBuffers && e.inputBuffers.corn && e.inputBuffers.pumpkin, 'F2: inputBuffers separados (corn,pumpkin)');

  // llena solo corn por su costado (oeste)
  for (let k = 0; k < CONVERTER_BUFFER_CAP + 2; k++) {
    sim.spawnProduct('corn', e.cx - 0.6, 0.45, e.cz, { x: 0.6, y: 0, z: 0 });
    steps(sim, 8);
  }
  steps(sim, 60);
  ok(e.inputBuffers.corn.length === CONVERTER_BUFFER_CAP, `F2: corn llena cap (${e.inputBuffers.corn.length})`);
  ok(e.inputBuffers.pumpkin.length === 0, 'F2: pumpkin sigue vacío');
  ok(!e.pending, 'F2: sin pumpkin no arranca receta');

  // pumpkin entra igual aunque corn esté llena (buffer independiente, sin fila)
  sim.spawnProduct('pumpkin', e.cx + 0.6, 0.45, e.cz, { x: -0.6, y: 0, z: 0 });
  steps(sim, 30);
  ok(e.pending === true, 'F2: con pumpkin disponible arranca proceso');
  ok(e.inputBuffers.corn.length === CONVERTER_BUFFER_CAP - 1, 'F2: consumió 1 corn');
  ok(e.inputBuffers.pumpkin.length === 0, 'F2: consumió 1 pumpkin');

  // al terminar, aparece pienso
  steps(sim, 60 * 5);
  ok(sim.products.some((p) => p.kind === 'feed'), 'F2: Pienso produce feed');
}

// ---- 2) Jamonera Industrial requiere pig + salt por sus costados ----
{
  const sim = new SimWorld();
  ok(sim.placeTool('jamonera_industrial', 7, 7, 0, 0, 0, now), 'F2: jamonera industrial colocada');
  const e = sim.tools.get(sim.key(7, 7, 0));

  sim.spawnProduct('pig', e.cx - 0.6, 0.45, e.cz, { x: 0.6, y: 0, z: 0 });
  steps(sim, 60 * 4);
  ok(!sim.products.some((p) => p.kind === 'ham'), 'F2: solo pig no produce ham');

  sim.spawnProduct('salt', e.cx + 0.6, 0.45, e.cz, { x: -0.6, y: 0, z: 0 });
  steps(sim, 60 * 7);
  ok(sim.products.some((p) => p.kind === 'ham'), 'F2: pig+salt produce ham');
}

// ---- 3) línea real: corral ← W, salinera ← E, industrial ----
{
  const sim = new SimWorld();
  ok(sim.placeTool('corral', 4, 7, 0, 2, 0, now), 'F2: corral al oeste, sale E');
  ok(sim.placeTool('salinera', 6, 7, 0, 6, 0, now), 'F2: salinera al este, sale O');
  ok(sim.placeTool('jamonera_industrial', 5, 7, 0, 0, 0, now), 'F2: industrial entre los dos');
  const cor = sim.tools.get(sim.key(4, 7, 0));
  const sal = sim.tools.get(sim.key(6, 7, 0));
  sim.spawnProduct('corn', cor.cx, 0.5, cor.cz + 0.35, { x: 0, y: 0, z: 0 });
  sim.emitFrom(sal);
  steps(sim, 60 * 12);
  ok(sim.products.some((p) => p.kind === 'ham'), 'F2: línea real entrega ham');
}

// ---- 4) línea real jumbo: pig jumbo + salt jumbo entran por su costado ----
{
  const sim = new SimWorld();
  ok(sim.placeTool('jamonera_industrial', 6, 5, 0, 0, 0, now), 'F2J: industrial colocada');
  const e = sim.tools.get(sim.key(6, 5, 0));

  // cerdo jumbo entra por su costado oeste; sal por el este. Receta arranca.
  sim.spawnProduct('pig', e.cx - 0.6, 0.45, e.cz, { x: 0.6, y: 0, z: 0 }, { jumbo: true });
  sim.spawnProduct('salt', e.cx + 0.6, 0.45, e.cz, { x: -0.6, y: 0, z: 0 }, { jumbo: true });
  steps(sim, 30);
  ok(e.pending === true, 'F2J: con ambos jumbo la receta arranca');
  ok(e.inputBuffers.pig.length === 0 && e.inputBuffers.salt.length === 0, 'F2J: consume pig+sal jumbo al arrancar');
  steps(sim, 60 * 8);
  const ham = sim.products.find((p) => p.kind === 'ham');
  ok(!!ham, 'F2J: produce jamón con entradas por costado');
  ok(ham && ham.jumbo === true, 'F2J: ham hereda jumbo');
}

// ---- 5) ingrediente equivocado no entra y receta queda esperando faltante ----
{
  const sim = new SimWorld();
  ok(sim.placeTool('pienso', 11, 5, 0, 0, 0, now), 'F2E: pienso colocado');
  const e = sim.tools.get(sim.key(11, 5, 0));

  // maíz por su costado (oeste)
  sim.spawnProduct('corn', e.cx - 0.6, 0.45, e.cz, { x: 0.6, y: 0, z: 0 });
  // equivocado por el mismo lado
  sim.spawnProduct('pig', e.cx - 0.55, 0.45, e.cz, { x: 0.6, y: 0, z: 0 });
  steps(sim, 90);

  ok(sim.products.some((p) => p.kind === 'pig'), 'F2E: ingrediente equivocado queda fuera del converter');
  ok(e.inputBuffers.corn.length >= 1, 'F2E: ingrediente correcto sí entra a su buffer');
  ok(e.inputBuffers.pumpkin.length === 0, 'F2E: faltante sigue vacío');
  ok(!e.pending, 'F2E: receta no arranca sin segundo ingrediente');
}

// ---- 6) capacidad por entrada: cada input corta en su propio cap ----
{
  const sim = new SimWorld();
  ok(sim.placeTool('jamonera_industrial', 12, 7, 0, 0, 0, now), 'F2C: jamonera industrial colocada');
  const e = sim.tools.get(sim.key(12, 7, 0));

  e.pending = true;
  e.busyUntil = now + 999999;
  while (e.buffer.length < CONVERTER_BUFFER_CAP) {
    e.buffer.push({ timeMs: 999999, jumbo: false, fatMult: 1, count: 1 });
  }
  while (e.inputBuffers.pig.length < CONVERTER_BUFFER_CAP) e.inputBuffers.pig.push({ jumbo: false, fatMult: 1 });
  while (e.inputBuffers.salt.length < CONVERTER_BUFFER_CAP) e.inputBuffers.salt.push({ jumbo: false, fatMult: 1 });

  const pigOverflow = sim.spawnProduct('pig', e.cx - 0.6, 0.45, e.cz, { x: 0.6, y: 0, z: 0 });
  const saltOverflow = sim.spawnProduct('salt', e.cx + 0.6, 0.45, e.cz, { x: -0.6, y: 0, z: 0 });
  steps(sim, 90);

  ok(e.inputBuffers.pig.length === CONVERTER_BUFFER_CAP, 'F2C: pig respeta cap por entrada');
  ok(e.inputBuffers.salt.length === CONVERTER_BUFFER_CAP, 'F2C: salt respeta cap por entrada');
  ok(!!pigOverflow && sim.products.includes(pigOverflow), 'F2C: pig extra queda fuera cuando input está lleno');
  ok(!!saltOverflow && sim.products.includes(saltOverflow), 'F2C: salt extra queda fuera cuando input está lleno');
}

// ---- 7) sprite: tiene marco de salida dorado y líneas laterales marcadas ----
{
  const meshes = readFileSync(join(root, 'src', 'render', 'toolMeshes.js'), 'utf8');
  const branch = meshes.slice(
    meshes.indexOf("type === 'jamonera_industrial'"),
    meshes.indexOf("type === 'silo'"),
  );
  ok(/GOLD/.test(branch), 'F2U: sprite con boca de salida dorada');
  ok(/inputSides/.test(meshes), 'F2U: flechas según inputSides de cada receta');
}

console.log(`\nSMOKE-D5-F2 PASS (${pass} checks)`);
