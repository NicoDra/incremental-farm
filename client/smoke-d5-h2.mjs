// M1.5-H2 smoke: el ciclo compuesto de BotCompleta produce jamón físicamente
// y lo entrega al portal. La cadena es el patrón del bot: corral + salinera +
// jamonera industrial, piezas enfrentadas por sus bocas reales.
import RAPIER from '@dimforge/rapier3d-compat';
import { SimWorld } from './src/sim/world.js';
import { GameState } from './src/game/state.js';

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

const sim = new SimWorld();
const state = new GameState();
state.money = 500000;
state.level = 3; // Fábrica

// Cadena del diseño del BotCompleta ajuntada al patrón físico que trabaja:
// corral (maíz→cerdo) al S de la industrial del mismo N, salinera al E soplando
//  al W, industrial mirando al N (entrada trasera S).
sim.placeTool('corral', 5, 8, 0, 0, 0, now, {});
sim.placeTool('salinera', 6, 7, 0, 6, 0, now, {});
sim.placeTool('jamonera_industrial', 5, 7, 0, 0, 0, now, {});
const corral = sim.tools.get(sim.key(5, 8, 0));
const industrial = sim.tools.get(sim.key(5, 7, 0));
const salinera = sim.tools.get(sim.key(6, 7, 0));

// alimento al corral con maíz y a la salinera la dejo producir sal.
for (let k = 0; k < 2; k++) {
  // maíz jumbo al corral (cerdo jumbo) + otra pareja común.
  sim.spawnProduct('corn', corral.cx, 0.5, corral.cz + 0.35, { x: 0, y: 0, z: 0 });
}
sim.emitFrom(salinera);
steps(sim, 60 * 12);

const ham = sim.products.find((p) => p.kind === 'ham');
ok(!!ham, `H2: ciclo produce jamón (productos: ${sim.products.map((p) => p.kind).join(',')})`);

// entrega al portal (mismo patrón de los smokes: delivery fuera del sim).
{
  let delivered = 0;
  sim.onDeliver = (kind) => { if (kind === 'ham') delivered++; };
  if (ham) {
    ham.body.setTranslation({ x: 0, y: 0.6, z: -8.7 }, true);
    ham.body.setLinvel({ x: 0, y: 0, z: -2 }, true);
  }
  steps(sim, 12);
  ok(delivered >= 1, `H2: jamón entregado al portal (ham=${delivered})`);
}

console.log(`\nSMOKE-D5-H2 PASS (${pass} checks)`);
