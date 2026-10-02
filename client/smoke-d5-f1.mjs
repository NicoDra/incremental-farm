// M1.5-F1 smoke: buffers internos en procesadores.
// - entrada acepta y encola mientras haya buffer
// - con buffer lleno no acepta más; producto espera en canaleta sin rebote duro
// - regresión: auto-conexión intacta (DEAD_SIDES/OPEN_BACKS + canal↔máquina)
import RAPIER from '@dimforge/rapier3d-compat';
import { SimWorld } from './src/sim/world.js';
import { CONVERTER_BUFFER_CAP, OPEN_BACKS } from 'chanchos-shared';

await RAPIER.init();

let now = 1_200_000;
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
const opens = (sim, i, j, h = 0) => sim.tools.get(sim.key(i, j, h)).opens || {};

// ---- 1) buffer llena y producto extra espera sin rebotar ----
{
  const sim = new SimWorld();
  ok(sim.placeTool('corral', 5, 7, 0, 0, 0, now), 'F1: corral (5,7) r0');
  ok(sim.placeTool('recta', 5, 8, 0, 0, 0, now), 'F1: recta de espera al sur');
  const corral = sim.tools.get(sim.key(5, 7, 0));

  // Alimenta buffer+proceso y deja 1 extra afuera.
  const need = CONVERTER_BUFFER_CAP + 2;
  let overflow = null;
  for (let k = 0; k < need; k++) {
    const p = sim.spawnProduct('corn', corral.cx, 0.45, corral.cz + 0.45 + k * 0.02, { x: 0, y: 0, z: -0.6 });
    if (k === need - 1) overflow = p;
  }
  ok(!!overflow, 'F1: overflow spawn ok');

  steps(sim, 120);

  // Debe existir buffer explícito y cap alcanzada.
  ok(Array.isArray(corral.buffer), 'F1: corral expone buffer interno');
  ok(corral.buffer.length === CONVERTER_BUFFER_CAP, `F1: buffer llena (${corral.buffer.length}/${CONVERTER_BUFFER_CAP})`);
  ok(corral.pending === true, 'F1: 1 item en proceso');

  // El extra no entra: espera en canaleta y no "rebota" hacia atrás.
  ok(sim.products.includes(overflow), 'F1: overflow sigue afuera (no aceptado con buffer lleno)');
  const t = overflow.body.translation();
  const v = overflow.body.linvel();
  const along = v.x * corral.dir.x + v.z * corral.dir.z;
  ok(Math.abs(t.x - corral.cx) < 0.75 && t.z > corral.cz + 0.1, `F1: overflow espera en entrada (${t.x.toFixed(2)}, ${t.z.toFixed(2)})`);
  ok(along < 0.25, `F1: overflow sin rebote frontal fuerte (along=${along.toFixed(2)})`);
}

// ---- 2) regresión auto-conexión: DEAD_SIDES/OPEN_BACKS intacto ----
{
  const sim = new SimWorld();
  ok(sim.placeTool('curva', 5, 4, 0, 2, 0, now), 'reg: curva P r2');
  ok(sim.placeTool('curva', 5, 5, 0, 2, 0, now), 'reg: curva B r2');
  ok(opens(sim, 5, 5).N === OPEN_BACKS, `reg: B.N===OPEN_BACKS (${OPEN_BACKS})`);
}

// ---- 3) regresión auto-conexión: canal↔máquina intacto ----
{
  const sim = new SimWorld();
  ok(sim.placeTool('corral', 5, 5, 0, 2, 0, now), 'reg: corral r2 (salida E)');
  ok(sim.placeTool('recta', 6, 5, 0, 0, 0, now), 'reg: recta al este (boca)');
  ok(sim.placeTool('recta', 5, 4, 0, 0, 0, now), 'reg: recta al norte (flanco)');
  ok(opens(sim, 6, 5).W === true, 'reg: boca máquina abre canaleta vecina');
  ok(opens(sim, 5, 4).S === false, 'reg: flanco máquina fuerza pared cerrada');
}

console.log(`\nSMOKE-D5-F1 PASS (${pass} checks)`);
