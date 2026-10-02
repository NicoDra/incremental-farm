// M1.5-D smoke headless: piezas nuevas (unión/divisor/puente), alternancia del
// divisor, categorías del menú Construir, deshacer/rehacer, HUD Construir.
// node client/smoke-d.mjs  → sale 0 si todo pasa.
import RAPIER from '@dimforge/rapier3d-compat';
import { SimWorld } from './src/sim/world.js';
import { History } from './src/game/history.js';
import {
  TOOLS,
  TOOL_ORDER,
  TOOL_CATEGORIES,
  AGES,
  toolCost,
} from 'chanchos-shared';

await RAPIER.init();

let now = 300000;
const STEP = 1 / 60;
function steps(sim, n) {
  for (let k = 0; k < n; k++) {
    now += 1000 / 60;
    sim.step(STEP, now);
  }
}
let pass = 0;
function ok(cond, msg) {
  if (!cond) {
    console.error('FAIL:', msg);
    process.exit(1);
  }
  pass++;
  console.log('ok:', msg);
}

// ---- 1. definición de las 3 piezas nuevas ----
for (const t of ['union', 'divisor', 'puente']) {
  const def = TOOLS[t];
  ok(def, `${t} existe en TOOLS`);
  ok(def.kind === 'channel', `${t} es kind channel`);
  ok(toolCost(t, 0) > 0, `${t} tiene costo > 0 (${toolCost(t, 0)})`);
  ok(typeof def.hint === 'string' && def.hint.length > 5, `${t} tiene hint`);
}
ok(TOOLS.puente.minH === 1, 'puente exige minH 1');

// ---- 2. TOOL_CATEGORIES cubre TOOL_ORDER exactamente una vez ----
{
  const seen = new Map();
  for (const cat of TOOL_CATEGORIES) {
    ok(cat.name && cat.tools.length, `categoría "${cat.id}" con nombre y piezas`);
    for (const t of cat.tools) seen.set(t, (seen.get(t) || 0) + 1);
  }
  ok(seen.size === TOOL_ORDER.length, `categorías cubren ${TOOL_ORDER.length} piezas`);
  ok(TOOL_ORDER.every((t) => seen.get(t) === 1), 'cada pieza aparece en 1 sola categoría');
  const path = TOOL_CATEGORIES.find((c) => c.id === 'path');
  ok(
    ['union', 'divisor', 'puente'].every((t) => path.tools.includes(t)),
    'Caminos incluye union/divisor/puente',
  );
}

// ---- 3. edades: se desbloquean en Madera (no en Barro) ----
{
  ok(!AGES[0].tools.includes('union'), 'Barro no desbloquea union');
  for (const age of [1, 2, 3]) {
    for (const t of ['union', 'divisor', 'puente']) {
      ok(AGES[age].tools.includes(t), `${AGES[age].name} desbloquea ${t}`);
    }
  }
}

// ---- 4. placeTool: alturas y estados iniciales ----
{
  const sim = new SimWorld();
  ok(sim.placeTool('union', 3, 3, 0, 0, 0, now), 'union se coloca en N0');
  ok(sim.placeTool('divisor', 5, 5, 0, 0, 0, now), 'divisor se coloca en N0');
  ok(sim.placeTool('puente', 4, 4, 1, 0, 0, now), 'puente se coloca en N1');
  ok(!sim.placeTool('puente', 6, 6, 0, 0, 0, now), 'puente rechaza N0 (minH)');
  const div = sim.tools.get(sim.key(5, 5, 0));
  ok(div && div.lastExit === 0, 'divisor arranca en salida E (lastExit=0)');
  ok(div.body !== null, 'divisor tiene cuerpo físico');
  const uni = sim.tools.get(sim.key(3, 3, 0));
  ok(uni.body !== null && uni.dir, 'union tiene cuerpo y dir');
  // puente no bloquea N0 en la misma celda (cruza otro camino debajo)
  ok(!sim.baseBlocked(4, 4), 'puente no bloquea N0');
  ok(sim.placeTool('recta', 4, 4, 0, 0, 0, now), 'recta cruza bajo el puente (misma celda, N0)');
  ok(sim.tools.has(sim.key(4, 4, 0)) && sim.tools.has(sim.key(4, 4, 1)), 'recta y puente coexisten');
}

// ---- 5. divisor alterna E/O por producto entrante ----
{
  const sim = new SimWorld();
  ok(sim.placeTool('divisor', 5, 5, 0, 0, 0, now), 'divisor colocado (frente N)');
  const c = sim.cellCenter(5, 5);
  const spawn = (vz) =>
    sim.spawnProduct('corn', c.x, 0.25, c.z + 0.35, { x: 0, y: 0, z: vz });

  const p1 = spawn(-1.2);
  ok(!!p1, 'producto 1 entra desde el sur');
  steps(sim, 4);
  const v1 = p1.body.linvel();
  ok(v1.x > 1, `producto 1 sale al ESTE (vx=${v1.x.toFixed(2)})`);
  sim.removeProduct(sim.products.indexOf(p1));

  const p2 = spawn(-1.2);
  ok(!!p2, 'producto 2 entra desde el sur');
  steps(sim, 4);
  const v2 = p2.body.linvel();
  ok(v2.x < -1, `producto 2 sale al OESTE (vx=${v2.x.toFixed(2)}) — alterna`);
  sim.removeProduct(sim.products.indexOf(p2));

  // producto que NO viene del sur (va hacia el sur) no se redirige
  const p3 = sim.spawnProduct('corn', c.x + 0.3, 0.25, c.z, { x: 0, y: 0, z: 1.0 });
  steps(sim, 4);
  const v3 = p3.body.linvel();
  ok(Math.abs(v3.x) < 0.5, `producto saliendo al sur no se redirige (vx=${v3.x.toFixed(2)})`);
  sim.removeProduct(sim.products.indexOf(p3));
}

// ---- 6. unión: entradas E y O confluyen al norte ----
{
  const sim = new SimWorld();
  ok(sim.placeTool('union', 7, 7, 0, 0, 0, now), 'union colocado (frente N)');
  const c = sim.cellCenter(7, 7);

  const east = sim.spawnProduct('corn', c.x + 0.35, 0.25, c.z, { x: -1.2, y: 0, z: 0 });
  steps(sim, 50);
  const te = east.body.translation();
  ok(te.z < c.z - 0.15, `entrada E converge al norte (dz=${(te.z - c.z).toFixed(2)})`);
  sim.removeProduct(sim.products.indexOf(east));

  const west = sim.spawnProduct('corn', c.x - 0.35, 0.25, c.z, { x: 1.2, y: 0, z: 0 });
  steps(sim, 50);
  const tw = west.body.translation();
  ok(tw.z < c.z - 0.15, `entrada O converge al norte (dz=${(tw.z - c.z).toFixed(2)})`);
  sim.removeProduct(sim.products.indexOf(west));
}

// ---- 7. History: undo/redo/drop/limit ----
{
  const h = new History();
  ok(!h.canUndo() && !h.canRedo(), 'historial vacío');
  h.record({ kind: 'place', id: 1 });
  h.record({ kind: 'sell', id: 2 });
  h.record({ kind: 'move', id: 3 });
  ok(h.peekUndo().id === 3, 'peekUndo = última acción');
  const u1 = h.undo();
  ok(u1.id === 3 && h.canRedo(), 'undo devuelve la última y deja redo');
  const u2 = h.undo();
  ok(u2.id === 2, 'undo encadenado');
  const r1 = h.redo();
  ok(r1.id === 2, 'redo re-apila en orden');
  h.record({ kind: 'place', id: 9 });
  ok(!h.canRedo(), 'record nuevo limpia la pila de redo');
  ok(h.peekUndo().id === 9, 'record va al tope del undo');
  ok(h.dropUndo().id === 9, 'dropUndo descarta sin mover a redo');
  ok(h.canUndo() && !h.canRedo(), 'drop deja el undo anterior y sin redo');
  const lim = new History(100);
  for (let i = 0; i < 150; i++) lim.record({ id: i });
  ok(lim.undoStack.length === 100, 'límite 100 acciones');
  ok(lim.undo().id === 149, 'se deshace la más reciente, no la vieja');
  lim.clear();
  ok(!lim.canUndo() && !lim.canRedo(), 'clear vacía todo');
}

// ---- 8. HUD: pestaña Construir arma las 13 tarjetas ----
{
  const cache = {};
  function makeEl(id) {
    const listeners = {};
    const classes = new Set();
    const el = {
      id,
      dataset: {},
      style: {},
      children: [],
      className: '',
      innerHTML: '',
      textContent: '',
      title: '',
      disabled: false,
      classList: {
        add: (...c) => c.forEach((x) => classes.add(x)),
        remove: (...c) => c.forEach((x) => classes.delete(x)),
        toggle: (c, f) => {
          const on = f === undefined ? !classes.has(c) : !!f;
          if (on) classes.add(c);
          else classes.delete(c);
          return on;
        },
        contains: (c) => classes.has(c),
      },
      addEventListener: (t, fn) => {
        (listeners[t] = listeners[t] || []).push(fn);
      },
      appendChild: (ch) => {
        el.children.push(ch);
        return ch;
      },
      querySelector: () => null,
      remove: () => {},
      fire: (t) => (listeners[t] || []).forEach((fn) => fn()),
    };
    return el;
  }
  globalThis.document = {
    getElementById: (id) => (cache[id] = cache[id] || makeEl(id)),
    querySelectorAll: () => [],
    querySelector: (sel) => (cache[sel] = cache[sel] || makeEl(sel)),
    createElement: () => makeEl('dyn'),
  };
  const { Hud } = await import('./src/ui/hud.js');
  const fakeState = {
    money: 50,
    owned: {},
    onChange: () => {},
    canBuyTool: () => true,
    toolPrice: () => 10,
    levelInfo: { name: 'Barro' },
    ageInfo: () => ({ name: 'Barro' }),
    usedUpgradeSlots: () => 0,
    totalUpgradeSlots: () => 2,
    upgradeDef: () => ({ name: 'U', max: 3, desc: 'd' }),
    upgradeLevel: () => 0,
    canApplyUpgrade: () => ({ ok: false, reason: '—' }),
    upgradePrice: () => 5,
    refundRate: () => 1,
  };
  const hud = new Hud(fakeState, {});
  ok(hud.cards && hud.cards.size === TOOL_ORDER.length, `Construir arma ${TOOL_ORDER.length} tarjetas (${hud.cards && hud.cards.size})`);
  ok(['rebote', 'union', 'divisor', 'puente'].every((t) => hud.cards.has(t)), 'tarjetas rebote/union/divisor/puente presentes');
  const groups = cache['[data-panel="build"]'].children;
  ok(groups.length === 5, `menú agrupa en 5 bloques (Herramientas + 4 categorías) (${groups.length})`);
  hud.openDrawer('build');
  ok(hud.isDrawerOpen(), 'cajón abre en Construir');
  hud.closeDrawer();
  ok(!hud.isDrawerOpen(), 'cajón cierra');
  delete globalThis.document;
}

console.log(`SMOKE-D PASS (${pass} checks)`);
