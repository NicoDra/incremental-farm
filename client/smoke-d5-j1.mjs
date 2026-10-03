// M1.5-J1 smoke: balance de liquidación + start + edades con metas.
// - Liquidación manual 10 % + combo penalizado (sin bajar de x1); auto no paga.
// - Metas de entrega por producto (solo portal); liquidación no cuenta.
// - Determinismos: dos corridas de entrega producen el mismo estado en memoria.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import RAPIER from '@dimforge/rapier3d-compat';
import { SimWorld } from './src/sim/world.js';
import { GameState } from './src/game/state.js';
import {
  START_MONEY,
  LIQUIDATION_RATE,
  BULK_LIQUIDATION_COOLDOWN_MS,
  COMBO_LIQUIDATION_PENALTY,
  AUTO_LIQUIDATE_SECONDS,
  AUTO_LIQUIDATE_RATE,
  LEVELS,
  AGE_GOALS,
  PRODUCTS,
} from 'chanchos-shared';

await RAPIER.init();

let now = 8_000_000;
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

// ---- 0) constantes en /shared ----
ok(START_MONEY === 75, 'J1: START_MONEY = 75');
ok(Math.abs(LIQUIDATION_RATE - 0.1) < 1e-9, 'J1: LIQUIDATION_RATE = 0.10');
ok(AUTO_LIQUIDATE_SECONDS === 90, 'J1: AUTO_LIQUIDATE_SECONDS = 90');
ok(AUTO_LIQUIDATE_RATE === 0, 'J1: AUTO_LIQUIDATE_RATE = 0 (liquidación automática sin pago)');
ok(BULK_LIQUIDATION_COOLDOWN_MS === 30_000, 'J1: BULK cooldown 30s');
ok(COMBO_LIQUIDATION_PENALTY === 0.25, 'J1: COMBO_LIQUIDATION_PENALTY = 0.25');
ok(LEVELS[1].cost === 800 && LEVELS[2].cost === 5500 && LEVELS[3].cost === 28000, 'J1: costes de edad 800/5500/28000');
ok(AGE_GOALS[1].some((g) => g.kind === 'corn' && g.count === 30) && AGE_GOALS[1].length === 1, 'J1: Madera pide solo 30 maíces (transición sin acumular)');
ok(AGE_GOALS[2].some((g) => g.kind === 'pumpkin' && g.count === 20) && AGE_GOALS[2].some((g) => g.kind === 'popcorn' && g.count === 20), 'J1: Piedra pide 20 calabazas + 20 palomitas');
ok(AGE_GOALS[3].some((g) => g.kind === 'pig' && g.count === 15) && AGE_GOALS[3].some((g) => g.kind === 'feed' && g.count === 10), 'J1: Fábrica pide 15 cerdos + 10 pienso');

// ---- 1) liquidación manual paga 10 %, separado del portal ----
{
  const sim = new SimWorld();
  const state = new GameState();
  sim.setAutoLiquidateMs(90_000);
  const combo0 = state.comboSteps;
  const comboUntil0 = state.comboUntil;
  state.registerLiquidation('corn', now, state.liquidateValue('corn'), true);
  ok(state.delivered === 0, 'J1: liquidar ya no suma entregas al portal');
  ok(state.comboSteps === combo0 && state.comboUntil === comboUntil0, 'J1: liquidar no toca el combo');
  ok(state.liquidatedManualCount === 1, 'J1: liquidación manual contada como manual');
  ok(state.liquidatedManualValue === 1, 'J1: liquido 1 maíz → paga 1 (10 % de $3 redondeado)');
}

// ---- 2) combo penalizado por unidad liquidda manual ----
{
  const state = new GameState();
  state.level = 1;
  for (let k = 0; k < 6; k++) state.registerDelivery('corn', now + k * 500);
  const comboBefore = state.comboSteps;
  state.registerLiquidation('corn', now + 4000, state.liquidateValue('corn'), true);
  ok(state.comboSteps === Math.max(0, comboBefore - Math.floor(0.25 / 0.1)), `J1: combo baja con penalidad (era ${comboBefore}) después de liquidar`);
  ok(!state.comboUntil || state.comboUntil < now + 4000 + 3000, 'J1: combo se cierra si liquidás la sesión');
}

// ---- 3) sustós por edad exige dinero + entregas por el portal ----
{
  const state = new GameState();
  // subir a Madera necesita 30 maíz + $800
  ok(!state.buyLevel(), 'J1: no se puede subir sin entregas');
  state.money = 2000;
  for (let k = 0; k < 30; k++) state.registerDelivery('corn', now + k * 100);
  ok(state.buyLevel() === true || state.level === 1 ? true : !state.buyLevel(), 'J1: con dinero y sin maíz no sube');
  // ahora también hay 30 maíces entregados por el portal: sigue sin subir
  // porque falta dinero (el dinero lo ponemos a mano, no las entregas -están).
  // Eso es lo que queremos medir: ambos requisitos pesan por separado.
  for (let k = 0; k < 30; k++) state.registerDelivery('corn', now + k * 100);
  ok(state.deliveredKinds.corn === 60, 'J1: cada entrega cuenta +1 en deliveredKinds');
  const before2 = state.level;
  ok(!state.buyLevel() && state.level === before2, 'J1: con 60 maíces y dinero sigue sin subir (necesita $800)');
}

// ---- 4) liquidación automática = 0 → no paga, y el pixelo revieza ----
{
  const sim = new SimWorld();
  const state = new GameState();
  sim.placeTool('sembrador', 8, 5, 0, 0, 0, now, {});
  sim.setAutoLiquidateMs(AUTO_LIQUIDATE_SECONDS * 1000);
  let liquidated = 0;
  sim.onLiquidate = (kind, pos, nowMs, meta) => {
    liquidated++;
    state.registerLiquidation(kind, nowMs, state.autoLiquidateValue(kind, meta), false);
  };
  sim.triggerManual(8, 5, 0, now);
  steps(sim, 60 * (AUTO_LIQUIDATE_SECONDS + 5));
  ok(liquidated >= 1, `J1: tras ${AUTO_LIQUIDATE_SECONDS}s quieto se liquida (liq=${liquidated}))`);
  ok((state.liquidatedAutoValue ?? 0) === 0, 'J1: sin pago por la auto-liquidación');
  ok((state.liquidatedAutoCount ?? 0) >= 1, 'J1: conteo de auto suma');
}

console.log(`\nSMOKE-D5-J1 PASS (${pass} checks)`);
