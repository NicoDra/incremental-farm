// M1.5-F5 smoke: entradas físicas separadas por ingrediente (costados).
// - Pienso (maíz izquierda / calabaza derecha) y Jamonera industrial (cerdo
//   izquierda / sal derecha) aceptan cada ingrediente solo por su costado.
// - Con un buffer lleno y el excedente esperando en su costado, el otro sigue
//   entrando (sin bloqueo por cabeza de fila).
// - Oráculo "física == shared" en las 4 rotaciones.
// - Producto equivocado no entra ni rebota.
// - Ciclo completo de ambas recetas.
import RAPIER from '@dimforge/rapier3d-compat';
import { SimWorld } from './src/sim/world.js';
import {
  CONVERTER_BUFFER_CAP,
  TOOLS,
  localSideToWorldDir,
  worldDirToDelta,
} from 'chanchos-shared';

await RAPIER.init();

let now = 5_000_000;
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
const total = (e, kind) => (e.inputBuffers?.[kind]?.length || 0) + (e.pending ? 1 : 0);

// ---- 1) inputSides en shared como emisario: una entrada por costado ----
ok(TOOLS.pienso.inputSides?.corn === 'left' && TOOLS.pienso.inputSides?.pumpkin === 'right', 'F5: pienso declara maíz=izquierda, calabaza=derecha');
ok(TOOLS.jamonera_industrial.inputSides?.pig === 'left' && TOOLS.jamonera_industrial.inputSides?.salt === 'right', 'F5: industrial declara cerdo=izquierda, sal=derecha');

// ---- 2) oráculo física == shared en las 4 rotaciones ----
for (const [type, sides] of [['pienso', TOOLS.pienso.inputSides], ['jamonera_industrial', TOOLS.jamonera_industrial.inputSides]]) {
  for (const rot8 of [0, 2, 4, 6]) {
    const sim = new SimWorld();
    ok(sim.placeTool(type, 5, 5, 0, rot8, 0, now), `F5: ${type} r${rot8}`);
    const e = sim.tools.get(sim.key(5, 5, 0));
    for (const [kind, side] of Object.entries(sides)) {
      const wd = localSideToWorldDir(rot8, side);
      const { di, dj } = worldDirToDelta(wd);
      const got = e.inputDirs?.[kind];
      ok(!!got, `F5: ${type} r${rot8} expone inputDir para ${kind}`);
      ok(got && Math.abs(got.x - di) < 1e-9 && Math.abs(got.z - dj) < 1e-9, `F5: ${type} r${rot8} ${kind} = ${wd} (física == shared)`);
    }
  }
}

// ---- 3) cabeza de fila inversa: maíz lleno a su costado, calabaza entra ----
{
  const sim = new SimWorld();
  ok(sim.placeTool('pienso', 5, 5, 0, 0, 0, now), 'F5: pienso r0 colocado');
  const e = sim.tools.get(sim.key(5, 5, 0));
  // llenar maíz (costado oeste) con overflow a su entrada
  for (let k = 0; k < CONVERTER_BUFFER_CAP + 2; k++) {
    sim.spawnProduct('corn', e.cx - 0.6, 0.45, e.cz, { x: 0, y: 0, z: 0 });
  }
  steps(sim, 150);
  ok(total(e, 'corn') >= CONVERTER_BUFFER_CAP, `F5: maíz llena su buffer (${e.inputBuffers.corn.length}/${CONVERTER_BUFFER_CAP})`);
  ok(!e.pending, 'F5: sin calabaza la receta no arranca');
  // calabaza llega por su costado (este): entra de una
  sim.spawnProduct('pumpkin', e.cx + 0.6, 0.45, e.cz, { x: 0, y: 0, z: 0 });
  steps(sim, 60);
  ok(e.pending === true, `F5: con la calabaza la receta arranca (cabeza de fila resuelta)`);
  ok(e.inputBuffers.corn.length === CONVERTER_BUFFER_CAP - 1, 'F5: consumió 1 maíz');
  ok(e.inputBuffers.pumpkin.length === 0, 'F5: consumió 1 calabaza');
  steps(sim, 60 * 6);
  ok(sim.products.some((p) => p.kind === 'feed'), 'F5: produce pienso tras la entrada por costado');
}

// ---- 4) cada ingrediente solo por su costado (sector estático: solo el lado
// correcto entra; el otro queda esperando afuera) ----
{
  const sim = new SimWorld();
  ok(sim.placeTool('pienso', 5, 5, 0, 0, 0, now), 'F5: pienso r0');
  const e = sim.tools.get(sim.key(5, 5, 0));
  const wait = (kind, dx, dz) => {
    const p = sim.spawnProduct(kind, e.cx + dx, 0.45, e.cz + dz, { x: 0, y: 0, z: 0 });
    steps(sim, 90);
    return !sim.products.includes(p);
  };
  ok(wait('corn', -0.6, 0), 'F5: maíz por su costado (oeste) entra');
  ok(!wait('corn', 0.6, 0), 'F5: maíz por el costado equivocado (este) NO entra');
  ok(!wait('pumpkin', -0.6, 0), 'F5: calabaza por el costado equivocado (oeste) NO entra');
  ok(wait('pumpkin', 0.6, 0), 'F5: calabaza por su costado (este) entra');
  ok(e.pending === true, 'F5: receta arranca con ambos por su costado');
}

// ---- 5) producto equivocado en una entrada: queda afuera, sin rebote ----
{
  const sim = new SimWorld();
  ok(sim.placeTool('pienso', 5, 5, 0, 0, 0, now), 'F5: pienso para equivocado');
  const e = sim.tools.get(sim.key(5, 5, 0));
  const wrong = sim.spawnProduct('pig', e.cx - 0.6, 0.45, e.cz, { x: 0, y: 0, z: 0 });
  steps(sim, 90);
  ok(sim.products.includes(wrong), 'F5: producto equivocado queda en la entrada sin entrar');
  const v = wrong.body.linvel();
  ok(Math.hypot(v.x, v.y, v.z) < 1.0, 'F5: producto equivocado sin rebote fuerte');
}

// ---- 6) ciclo completo industrial: cerdo por izquierda + sal por derecha ----
{
  const sim = new SimWorld();
  ok(sim.placeTool('corral', 4, 7, 0, 2, 0, now), 'F5: corral (sale E, cerdo entra O de la industrial)');
  ok(sim.placeTool('jamonera_industrial', 5, 7, 0, 0, 0, now), 'F5: industrial (pig ← W, salt ← E)');
  ok(sim.placeTool('salinera', 6, 7, 0, 6, 0, now), 'W salina al E de la industrial (sale O)');
  const corral = sim.tools.get(sim.key(4, 7, 0));
  const salinera = sim.tools.get(sim.key(6, 7, 0));
  // alimento el corral con maíz (conventz por detrás) y salinera genera sal
  for (let k = 0; k < 3; k++) {
    sim.spawnProduct('corn', corral.cx, 0.5, corral.cz + 0.35, { x: 0, y: 0, z: 0 });
    steps(sim, 10);
  }
  sim.emitFrom(salinera);
  steps(sim, 60 * 14);
  const ham = sim.products.find((p) => p.kind === 'ham');
  ok(!!ham, 'F5: ciclo industrial produce jamón con entradas por costado');
}

// ---- 7) ciclo completo pienso: maíz por izquierda + calabaza por derecha ----
{
  const sim = new SimWorld();
  ok(sim.placeTool('pienso', 5, 5, 0, 0, 0, now), 'F5: pienso (maíz ← W, calabaza ← E)');
  const e = sim.tools.get(sim.key(5, 5, 0));
  sim.spawnProduct('corn', e.cx - 0.6, 0.45, e.cz, { x: 0.4, y: 0, z: 0 });
  sim.spawnProduct('pumpkin', e.cx + 0.6, 0.45, e.cz, { x: -0.4, y: 0, z: 0 });
  steps(sim, 60 * 6);
  ok(sim.products.some((p) => p.kind === 'feed'), 'F5: ciclo pienso produce feed');
}

console.log(`\nSMOKE-D5-F5-SIDES PASS (${pass} checks)`);
