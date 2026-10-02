// M1.5-D2 smoke headless: snap de rotación por pieza + botón de guía.
// node client/smoke-d2.mjs  → sale 0 si todo pasa.
import RAPIER from '@dimforge/rapier3d-compat';
import fs from 'node:fs';
import { SimWorld } from './src/sim/world.js';
import { Hud } from './src/ui/hud.js';
import { TOOL_ORDER, snapRot8, DIRS8 } from 'chanchos-shared';

await RAPIER.init();

let pass = 0;
function ok(cond, msg) {
  if (!cond) {
    console.error('FAIL:', msg);
    process.exit(1);
  }
  pass++;
  console.log('ok:', msg);
}

// ---- 1. snapRot8: solo el fan usa 8 dirs ----
for (let r = 0; r < 8; r++) ok(snapRot8('fan', r) === r, `fan conserva rot8=${r}`);
ok(snapRot8('fan', -1) === 7, 'fan normaliza -1 → 7');
ok(snapRot8('fan', 8) === 0, 'fan normaliza 8 → 0');
const fourDir = TOOL_ORDER.filter((t) => t !== 'fan');
ok(fourDir.length > 0, `hay piezas de 4 dirs (${fourDir.length})`);
for (const t of fourDir) {
  ok(snapRot8(t, 0) === 0, `${t} par 0 queda`);
  ok(snapRot8(t, 1) === 2, `${t} impar 1 → 2`);
  ok(snapRot8(t, 2) === 2, `${t} par 2 queda`);
  ok(snapRot8(t, 3) === 4, `${t} impar 3 → 4`);
  ok(snapRot8(t, 4) === 4, `${t} par 4 queda`);
  ok(snapRot8(t, 5) === 6, `${t} impar 5 → 6`);
  ok(snapRot8(t, 6) === 6, `${t} par 6 queda`);
  ok(snapRot8(t, 7) === 0, `${t} impar 7 → 0`);
}

// ---- 2. placeTool aplica el invariante (punto único de colocación) ----
{
  const sim = new SimWorld();
  let n = 100;
  const now = 200000;
  for (const t of fourDir) {
    const h = t === 'rampa' || t === 'puente' ? 1 : 0;
    const i = (n % 14) + 1;
    const j = Math.floor(n / 14) + 1;
    n++;
    const placed = sim.placeTool(t, i, j, h, 3, 0, now);
    ok(placed, `${t} se coloca con rot8=3 pedido`);
    const e = sim.tools.get(sim.key(i, j, h));
    ok(e.rot8 % 2 === 0, `${t} almacenado en 90° (rot8=${e.rot8})`);
    ok(DIRS8[e.rot8].x === 0 || DIRS8[e.rot8].z === 0, `${t} dirección cardinal`);
  }
  const f = sim.placeTool('fan', 12, 12, 0, 5, 0, now);
  ok(f, 'fan se coloca con rot8=5');
  ok(sim.tools.get(sim.key(12, 12, 0)).rot8 === 5, 'fan conserva diagonal (rot8=5)');
  // re-colocar tras migración conserva la pieza (usa la PRIMERA pieza colocada)
  const firstKey = sim.key(3, 8, 0); // primer fourDir: n=100 → i=3, j=8
  const before = sim.tools.get(firstKey);
  ok(before, 'primera pieza colocada existe');
  const want = snapRot8(before.type, 3);
  sim.removeTool(3, 8, 0);
  ok(sim.placeTool(before.type, 3, 8, 0, want, 0, now + 1), 'migración re-coloca');
  ok(sim.tools.get(firstKey).rot8 % 2 === 0, 'migrada queda en 90°');
}

// ---- 3. CSS: .hidden oculta de verdad (con !important vs display por ID) ----
{
  const css = fs.readFileSync('./src/style.css', 'utf8');
  ok(
    /\.hidden\s*\{[^}]*display\s*:\s*none\s*!important/.test(css),
    'CSS .hidden{display:none!important} presente',
  );
}

// ---- 4. botón Entendido recibe el clic y cierra la guía (DOM falso) ----
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
{
  const cache = {};
  globalThis.document = {
    getElementById: (id) => (cache[id] = cache[id] || makeEl(id)),
    querySelectorAll: () => [],
    querySelector: (sel) => (cache[sel] = cache[sel] || makeEl(sel)),
    createElement: () => makeEl('dyn'),
  };
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
  };
  const hud = new Hud(fakeState, {});
  ok(typeof hud.isGuideOpen === 'function', 'Hud expone isGuideOpen()');
  hud.showGuide();
  ok(hud.isGuideOpen(), 'guía abierta tras showGuide()');
  const btn = cache['btn-close-guide'];
  ok(btn && typeof btn.fire === 'function', 'botón Entendido existe en el DOM');
  btn.fire('click');
  ok(!hud.isGuideOpen(), 'clic en Entendido cierra la guía');
  ok(
    cache['guide'].classList.contains('hidden'),
    'guía con clase hidden tras el clic',
  );
  delete globalThis.document;
}

console.log(`SMOKE-D2 PASS (${pass} checks)`);
