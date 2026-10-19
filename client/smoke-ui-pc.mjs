// Contratos de presentación con GameState real: no duplicar reglas ni perder
// totales al mostrar una meta con tope. Interacción DOM/teclado: prueba navegador.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { GameState } from './src/game/state.js';
import { ageProgress, upgradeReason, TOOL_LABELS } from './src/ui/presentation.js';
import { TOOL_ORDER, UPGRADE_LINES } from 'chanchos-shared';

const state = new GameState();
const before = JSON.stringify(state);
const initial = ageProgress(state);
assert.equal(initial.name, 'Madera');
assert.equal(initial.ready, false);
assert.equal(initial.goals[0].have, 0);
assert.equal(JSON.stringify(state), before, 'mostrar progreso no muta el estado');

state.deliveredKinds.corn = 198;
state.money = 799;
const almost = ageProgress(state);
assert.equal(almost.goals[0].have, 30);
assert.equal(almost.goals[0].actual, 198);
assert.equal(almost.ready, false, 'meta de productos sola no habilita avanzar');
state.money = 800;
assert.equal(ageProgress(state).ready, true);
assert.equal(ageProgress(state).progress, 1);
state.level = 1;
state.deliveredKinds = {};
assert.deepEqual(ageProgress(state).goals.map((g) => g.kind), ['pumpkin', 'popcorn']);
state.level = 3;
assert.equal(ageProgress(state), null, 'época final sin un objetivo ficticio');

state.level = 0;
state.money = 0;
assert.match(upgradeReason(state, 'sembra_vel'), /Te faltan/);
state.money = 10000;
assert.equal(upgradeReason(state, 'sembra_vel'), '');
state.applyUpgrade('sembra_vel');
state.applyUpgrade('sembra_jumbo');
assert.match(upgradeReason(state, 'sembra_burst'), /ranuras libres/);
assert.match(upgradeReason(state, 'palomi_vel'), /edad Madera/);
for (const type of TOOL_ORDER) assert.ok(TOOL_LABELS[type], `${type}: etiqueta visible`);
for (const id of Object.keys(UPGRADE_LINES)) assert.equal(typeof upgradeReason(state, id), 'string');

const html = readFileSync(new URL('./index.html', import.meta.url), 'utf8');
const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]);
assert.equal(new Set(ids).size, ids.length, 'IDs únicos');
assert.ok(ids.includes('objective') && ids.includes('inspect-panel'));
assert.ok(!ids.includes('btn-sell-ground') && !ids.includes('btn-dirs'), 'acciones globales sin duplicados');
assert.ok(ids.includes('act-sell-ground') && ids.includes('act-dirs'), 'acciones siguen disponibles');
console.log('PASS smoke-ui-pc (progreso, alcance de mejoras, catálogo y estructura unificada)');
