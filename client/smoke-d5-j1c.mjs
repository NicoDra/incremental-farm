// M1.5-J1c smoke: tope de combo por edad.
// - Constante en /shared: COMBO_MAX_BY_AGE = [2, 3, 4, 5].
// - Nunca excede el tope de la edad actual; al subir sin reiniciar respira.
// - La penalidad por liquidación sigue siendo válida (resta, mínimo x1).
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import RAPIER from '@dimforge/rapier3d-compat';
import { GameState } from './src/game/state.js';
import { COMBO, COMBO_MAX_BY_AGE, LEVELS } from 'chanchos-shared';

await RAPIER.init();

let now = 9_000_000;
let pass = 0;
function ok(cond, msg) {
  if (!cond) {
    console.error('FAIL:', msg);
    process.exit(1);
  }
  pass++;
  console.log('ok:', msg);
}

const state = new GameState();

// ---- 1) constante y tope por edad ----
ok(JSON.stringify(COMBO_MAX_BY_AGE) === '[2,3,4,5]', 'J1c: COMBO_MAX_BY_AGE constante en /shared');
ok(state.comboCap() === 2, 'J1c: Barro tiene tope x2');
state.level = 1;
ok(state.comboCap() === 3, 'J1c: Madera tope x3');
state.level = 2;
ok(state.comboCap() === 4, 'J1c: Piedra tope x4');

// ---- 2) no supera el tope al registrar entregas al portal ----
state.level = 0;
let last = now;
for (let k = 0; k < 40; k++) {
  state.registerDelivery('corn', last);
  last += 200;
}
ok(state.comboMult() <= 2 + 1e-9, `J1c: combo nunca supera el tope (mult=${state.comboMult().toFixed(2)})`);

// ---- 3) al subir de edad el tope aumenta sin reiniciar el combo ----
const before = state.comboSteps;
state.level = 1;
state.registerDelivery('corn', last + 100); // solo una sube
ok(state.comboSteps >= before, 'J1c: subir de edad preserva los pasos del combo');
ok(state.comboMult() <= 3 + 1e-9, `J1c: con Madera el máximo es x3 (mult=${state.comboMult().toFixed(2)})`);

// ---- 4) penalidad por liquidación manual sigue igual ----
{
  const s2 = new GameState();
  s2.level = 3; // combo hasta 5
  s2.registerDelivery('corn', now);
  s2.registerDelivery('corn', now + 100);
  s2.registerDelivery('corn', now + 200);
  const mu = s2.comboMult();
  s2.registerLiquidation('corn', now + 300, s2.liquidateValue('corn'), true);
  ok(s2.comboMult() < mu, `J1c: liquidación manual baja el combo (was ${mu.toFixed(1)}, now ${s2.comboMult().toFixed(1)})`);
  // castigo no negativo ni repite ≤ 1
  ok(s2.comboMult() >= 1, `J1c: combo nunca por debajo de x1 (${s2.comboMult().toFixed(2)})`);
  // ...y si liquidás de nuevo tras subir, la pagana otra vez.
  s2.registerDelivery('corn', now + 400);
  s2.registerLiquidation('corn', now + 500, s2.liquidateValue('corn'), true);
  ok(s2.comboMult() <= mu, 'J1c: segunda liquidación castigado también');
}

// ---- 5) indicador UI muestra actual / máximos ----
const hudSrc = readFileSync(new URL('./src/ui/hud.js', import.meta.url));
ok(/máx|maximum|x\$\{s\.comboCap\(\)|comboCap/.test(hudSrc), 'J1c: indicador de combo muestra el máximo');

console.log(`\nSMOKE-D5-J1C PASS (${pass} checks)`);
