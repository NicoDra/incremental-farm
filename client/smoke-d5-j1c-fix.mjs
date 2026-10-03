// M1.5-J1 fix: las metas de cada transición piden sólo lo que ya se puede
// producir con las piezas desbloqueadas de esa edad (reglas física real).
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  AGE_GOALS,
  AGES,
  PRODUCTS,
  TOOLS,
  COMBO_MAX_BY_AGE,
  LEVELS,
  START_MONEY,
  LIQUIDATION_RATE,
} from 'chanchos-shared';

let pass = 0;
function ok(cond, msg) {
  if (!cond) {
    console.error('FAIL:', msg);
    process.exit(1);
  }
  pass++;
  console.log('ok:', msg);
}

const root = dirname(fileURLToPath(import.meta.url));
const sharedSrc = readFileSync(join(root, '..', 'shared', 'src', 'index.js'), 'utf8');

// ---- 1) constantes de edad y metas sin acumular ----
ok(COMBO_MAX_BY_AGE.length === 4, 'J1 fix: tope por edad = [2,3,4,5]');
ok(START_MONEY === 75, 'J1 fix: dinero inicial 75');
ok(Math.abs(LIQUIDATION_RATE - 0.1) < 1e-9, 'J1 fix: LIQUIDATION_RATE = 0.10');
ok(LEVELS[1].cost === 800 && LEVELS[2].cost === 5500 && LEVELS[3].cost === 28000, 'J1 fix: costes de edad 800/5500/28000');

// ---- 2) cada goal pide solo lo que ya produce esa edad (o antes) ----
for (let e = 1; e < AGES.length; e++) {
  const goal = AGE_GOALS[e];
  if (!goal) continue;
  const available = new Set(AGES.slice(0, e + 1).flatMap((a) => a.tools));
  for (const g of goal) {
    const producer = Object.entries(TOOLS).find(([, t]) => t.product === g.kind || t.output === g.kind);
    ok(!!producer, `J1 fix: la meta de ${AGES[e].name} pide ${PRODUCTS[g.kind].name} que produce ${producer ? producer[1].name : 'nadie'}`);
    // y esa pieza debe estar desbloqueada en la misma edad o antes:
    const unlock = AGES.findIndex((a) => a.tools.includes(producer && producer[0]));
    ok(unlock >= 0 && unlock <= e, `J1 fix: ${PRODUCTS[g.kind].name} disponible desde ${AGES[unlock]?.name} ≤ ${AGES[e].name}`);
  }
}

// ---- 3) la pestaña Edad solo muestra la meta de la próxima transición (no acumulada) ----
const hudSrc = readFileSync(join(root, 'src', 'ui', 'hud.js'), 'utf8');
const hudNorm = hudSrc.replace(/\s+/g, '');
const usesNextGoal = /nextAgePreview/.test(hudNorm) && /goal/.test(hudNorm);
ok(usesNextGoal, 'J1 fix: la pestaña Edad usa solo `next.goal` para renderizar la próxima transición');

// ---- 4) debug sigue salteando metas (setDebugAge) y el tope de combo se ajusta ----
const mainSrc = readFileSync(join(root, 'src', 'main.js'), 'utf8');
ok(/setDebugAge/.test(mainSrc), 'J1 fix: debug setDebugAge existe');
ok(/state\.level = a/.test(mainSrc), 'J1 fix: el debug puede fijar edad sin cumplir metas');

// ---- 5) TOSS retirado ----
ok(!/TOSS|tossPig/.test(sharedSrc) && !/TOSS|tossPig/.test(hudSrc), 'J1 fix: TOSS/tossPig ya no existe');

console.log(`\nSMOKE-D5-J1 FIX PASS (${pass} checks)`);
