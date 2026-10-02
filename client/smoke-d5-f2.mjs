// M1.5-F2 smoke: recetas de dos ingredientes + buffers por entrada.
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

// ---- 5) ingrediente equivocado no entra y receta queda esperando faltante ----
{
  const sim = new SimWorld();
  ok(sim.placeTool('pienso', 11, 5, 0, 0, 0, now), 'F2E: pienso colocado');
  const e = sim.tools.get(sim.key(11, 5, 0));

  sim.spawnProduct('corn', e.cx, 0.45, e.cz + 0.35, { x: 0, y: 0, z: -0.6 });
  const wrong = sim.spawnProduct('pig', e.cx, 0.45, e.cz + 0.35, { x: 0, y: 0, z: -0.6 });
  steps(sim, 120);

  ok(!!wrong && sim.products.includes(wrong), 'F2E: ingrediente equivocado queda fuera del converter');
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

  const pigOverflow = sim.spawnProduct('pig', e.cx, 0.45, e.cz + 0.35, { x: 0, y: 0, z: -0.6 });
  const saltOverflow = sim.spawnProduct('salt', e.cx + 0.32, 0.45, e.cz, { x: -0.9, y: 0, z: 0 });
  steps(sim, 90);

  ok(e.inputBuffers.pig.length === CONVERTER_BUFFER_CAP, 'F2C: pig respeta cap por entrada');
  ok(e.inputBuffers.salt.length === CONVERTER_BUFFER_CAP, 'F2C: salt respeta cap por entrada');
  ok(!!pigOverflow && sim.products.includes(pigOverflow), 'F2C: pig extra queda fuera cuando input está lleno');
  ok(!!saltOverflow && sim.products.includes(saltOverflow), 'F2C: salt extra queda fuera cuando input está lleno');
}

// ---- 7) una sola entrada: ambos ingredientes entran por atrás ----
{
  // la declaración ya no fija lados por ingrediente
  ok(!TOOLS.pienso.inputSides, 'F2U: pienso sin inputSides (entrada única trasera)');
  ok(!TOOLS.jamonera_industrial.inputSides, 'F2U: industrial sin inputSides (entrada única trasera)');
  // oráculo: nave del este llega rodando al norte y entra por la trasera (r0)
  const sim = new SimWorld();
  ok(sim.placeTool('jamonera_industrial', 5, 5, 0, 0, 0, now), 'F2U: industrial r0');
  const e = sim.tools.get(sim.key(5, 5, 0));
  sim.spawnProduct('salt', e.cx + 0.6, 0.45, e.cz + 0.6, { x: -0.45, y: 0, z: -0.45 });
  sim.spawnProduct('pig', e.cx + 0.75, 0.45, e.cz + 0.3, { x: -0.45, y: 0, z: -0.45 });
  steps(sim, 200);
  ok((e.inputBuffers?.salt?.length || 0) >= 1 || e.pending, 'F2U: sal entra por la trasera compartida');
  // el cerdo (ancho 0.68) queda apoyado contra el pilar del hueco: pasa el
  // filtro trasero y entra apenas se libera el pilar — igual que en línea.
  {
    const pig = sim.products.find((p) => p.kind === 'pig');
    ok(!!pig, 'F2U: cerdo apoyado en la boca trasera (no rechazado ni perdido)');
    if (pig) {
      const t = pig.body.translation();
      const backDist = (t.x - e.cx) * -e.dir.x + (t.z - e.cz) * -e.dir.z;
      ok(backDist >= -0.1, 'F2U: cerdo pasa el filtro trasero (along >= -0.1)');
    }
  }
  {
    const simB = new SimWorld();
    ok(simB.placeTool('pienso', 9, 9, 0, 0, 0, now), 'F2U: pienso acepta desde cualquier lado de la boca');
    const eB = simB.tools.get(simB.key(9, 9, 0));
    simB.spawnProduct('pumpkin', eB.cx + 0.6, 0.45, eB.cz + 0.6, { x: -0.45, y: 0, z: -0.45 });
    steps(simB, 200);
    ok((eB.inputBuffers?.pumpkin?.length || 0) >= 1 || eB.pending, 'F2U: calabaza entra desplazada al este de la boca');
  }
  // la trasera está ensanchada (una boca ancha para los dos)
  ok(e.colWiden === true, 'F2U: boca trasera ensanchada en receta doble');
}

// ---- 8) sprite industrial: boca de salida dorada, entrada trasera ancha,
// una flecha teal de entrada ----
{
  const meshes = readFileSync(join(root, 'src', 'render', 'toolMeshes.js'), 'utf8');
  const branch = meshes.slice(
    meshes.indexOf("type === 'jamonera_industrial'"),
    meshes.indexOf("type === 'silo'"),
  );
  ok(/0\.5,\s*0\.3,\s*0\.12,\s*0,\s*0\.44,\s*-0\.48,\s*GOLD/.test(branch), 'F2U: boca dorada sobresale de la cara frontal (0.48 > pared 0.45)');
  ok(/0\.3,\s*0\.2,\s*0\.1,\s*0,\s*0\.44,\s*-0\.52,\s*DARK/.test(branch), 'F2U: hueco oscuro sobre la boca dorada, afuera del casco');
  ok(!/converterInputSides|inputArrowPose/.test(meshes), 'F2U: flechas sin lados por ingrediente');
}

// ---- 9) circuitos: solo salida + trasera abren; flancos este/oeste cerrados ----
{
  const sim = new SimWorld();
  ok(sim.placeTool('jamonera_industrial', 5, 5, 0, 0, 0, now), 'F2U: industrial r0 (sale N, entra S)');
  for (const [i, j] of [[5, 4], [6, 5], [5, 6], [4, 5]]) {
    sim.placeTool('recta', i, j, 0, 0, 0, now);
  }
  ok(sim.tools.get(sim.key(5, 4, 0)).opens.S === true, 'F2U: norte abre a la salida');
  ok(sim.tools.get(sim.key(5, 6, 0)).opens.N === true, 'F2U: sur abre a las entradas');
  ok(sim.tools.get(sim.key(6, 5, 0)).opens.W === false, 'F2U: este flanco cerrado');
  ok(sim.tools.get(sim.key(4, 5, 0)).opens.E === false, 'F2U: oeste flanco cerrado');
  // pienso igual
  const sim2 = new SimWorld();
  ok(sim2.placeTool('pienso', 5, 5, 0, 2, 0, now), 'F2U: pienso r2 (sale E, entra O)');
  for (const [i, j] of [[5, 4], [6, 5], [5, 6], [4, 5]]) {
    sim2.placeTool('recta', i, j, 0, 0, 0, now);
  }
  ok(sim2.tools.get(sim2.key(6, 5, 0)).opens.W === true, 'F2U: este abre a la salida r2');
  ok(sim2.tools.get(sim2.key(4, 5, 0)).opens.E === true, 'F2U: oeste abre a las entradas r2');
  ok(sim2.tools.get(sim2.key(5, 4, 0)).opens.S === false, 'F2U: norte flanco r2 cerrado');
  ok(sim2.tools.get(sim2.key(5, 6, 0)).opens.N === false, 'F2U: sur flanco r2 cerrado');
}

{
  const shared = readFileSync(join(root, '..', 'shared', 'src', 'index.js'), 'utf8');
  const hud = readFileSync(join(root, 'src', 'ui', 'hud.js'), 'utf8');
  ok(!/sal por la derecha|calabaza por la derecha/.test(shared), 'F2U: hints sin lados (ambos por atrás)');
  ok(!/Entradas:.*derecha/.test(hud), 'F2U: panel sin lados por ingrediente');
}

console.log(`\nSMOKE-D5-F2 PASS (${pass} checks)`);
