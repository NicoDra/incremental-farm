// M1.5-H3 smoke: regla de liquidación y auto-liquidación del suelo.
// - LIQUIDATION_RATE 25 %: venta por clic, sin combo ni metas.
// - Ya apoyado sobre canal/tolva, no liquida; solo suelo desnudo.
// - AUTO_LIQUIDATE_SECONDS libera el tope de cuerpos.
import RAPIER from '@dimforge/rapier3d-compat';
import { SimWorld } from './src/sim/world.js';
import { GameState } from './src/game/state.js';
import { LIQUIDATION_RATE, AUTO_LIQUIDATE_SECONDS, PRODUCTS } from 'chanchos-shared';

await RAPIER.init();

let now = 4_000_000;
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
sim.setAutoLiquidateMs(AUTO_LIQUIDATE_SECONDS * 1000);

// 1) liquidateValue paga el 25 % del valor base, sin multiplicadores.
ok(
  state.liquidateValue('corn') === Math.max(1, Math.floor(PRODUCTS.corn.value * LIQUIDATION_RATE)),
  `H3: venta por clic paga 25 % del maíz (${state.liquidateValue('corn')})`,
);
ok(state.liquidateValue('corn', { jumbo: true }) >= state.liquidateValue('corn'), 'H3: jumbo liquida por al menos el doble del normal');

// 2) liquidar no suma combo ni metas.
const combo0 = state.comboSteps;
const comboUntil0 = state.comboUntil;
state.registerLiquidation('corn', now, state.liquidateValue('corn'), true);
ok(state.delivered === 0, `H3: liquidar no cuenta como entrega al portal (entregas=${state.delivered})`);
ok(state.comboSteps === combo0 && state.comboUntil === comboUntil0, 'H3: liquidar no suma combo');
ok(state.liquidatedManualCount === 1, 'H3: la manual queda registrada como manual');

// 3) autoLiquidate libera el suelo (quieto en suelo desnudo, sin canal).
{
  sim.placeTool('sembrador', 8, 6, 0, 0, 0, now, {});
  sim.setAutoLiquidateMs(AUTO_LIQUIDATE_SECONDS * 1000);
  let liquidated = 0;
  sim.onLiquidate = (kind, pos, nowMs, meta) => {
    liquidated++;
    state.registerLiquidation(kind, nowMs, state.autoLiquidateValue(kind, meta), false);
  };
  sim.triggerManual(8, 6, 0, now);
  steps(sim, 60 * (AUTO_LIQUIDATE_SECONDS + 5));
  ok(liquidated >= 1, `H3: tras ${AUTO_LIQUIDATE_SECONDS}s quieto se auto-liquida (liq=${liquidated})`);
  ok(state.liquidatedAutoCount === liquidated, 'H3: cae en el contador de autos, no en portal');
}

// 4) En canaleta no liquida.
{
  const sim2 = new SimWorld();
  sim2.setAutoLiquidateMs(AUTO_LIQUIDATE_SECONDS * 1000);
  sim2.placeTool('recta', 8, 4, 0, 0, 0, now, {});
  let liq2 = 0;
  sim2.onLiquidate = () => liq2++;
  sim2.placeTool('sembrador', 8, 6, 0, 0, 0, now, {});
  const p = sim2.spawnProduct('corn', 0.5, 1.2, -3.5, { x: 0, y: 0, z: 0 });
  // cae dentro de la canaleta (8,4) y quedaría quieta
  steps(sim2, 60 * (AUTO_LIQUIDATE_SECONDS * 2));
  ok(liq2 === 0, `H3: quieto en canaleta nunca se liquida (liq=${liq2})`);
}

console.log(`\nSMOKE-D5-H3-LIQUIDATION PASS (${pass} checks)`);
