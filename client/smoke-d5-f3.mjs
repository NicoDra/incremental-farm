// M1.5-F3 smoke: política de productos sueltos.
// - cap duro de cuerpos (1x/2x/5x) + medición de heap
// - sin eliminación por tiempo (suelo quieto y dormido)
// - emisores se pausan al llegar al tope
// - UI: botón "vender suelo" + prioridad de clic en producto sobre pieza
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import RAPIER from '@dimforge/rapier3d-compat';
import { SimWorld } from './src/sim/world.js';
import { MAX_BODIES, GROUND_IDLE_DESPAWN_MS, RECYCLE_MS } from 'chanchos-shared';

await RAPIER.init();

let now = 1_100_000;
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

// ---- 1) cap duro + medición 1x/2x/5x ----
{
  const muls = [1, 2, 5];
  const rows = [];
  for (const m of muls) {
    const sim = new SimWorld();
    const before = process.memoryUsage().heapUsed;
    const tries = MAX_BODIES * m;
    let spawned = 0;
    for (let k = 0; k < tries; k++) {
      const p = sim.spawnProduct('corn', 0, 1 + (k % 4) * 0.25, 0, { x: 0, y: 0, z: 0 });
      if (p) spawned++;
    }
    const after = process.memoryUsage().heapUsed;
    ok(spawned === MAX_BODIES, `cap ${m}x: solo ${MAX_BODIES} spawns reales (${spawned})`);
    ok(sim.products.length === MAX_BODIES, `cap ${m}x: products=${sim.products.length}`);
    rows.push({ m, heapKB: ((after - before) / 1024).toFixed(1) });
  }
  console.log('stats: heap delta KB por carga', rows.map((r) => `${r.m}x=${r.heapKB}`).join(' | '));
}

// ---- 2) quitar eliminación por tiempo (suelo quieto) ----
{
  const sim = new SimWorld();
  const p = sim.spawnProduct('corn', 0, 0.35, 0, { x: 0, y: 0, z: 0 });
  ok(!!p, 'idle suelo: spawn ok');
  const secs = Math.ceil((GROUND_IDLE_DESPAWN_MS + 3000) / 1000);
  steps(sim, secs * 60);
  ok(sim.products.includes(p), `idle suelo: sigue vivo tras ${secs}s (sin despawn por tiempo)`);
}

// ---- 3) quitar eliminación por tiempo (dormido) ----
{
  const sim = new SimWorld();
  const p = sim.spawnProduct('corn', 0, 0.4, 0, { x: 0, y: 0, z: 0 });
  ok(!!p, 'sleep: spawn ok');
  const secs = Math.ceil((RECYCLE_MS + 3000) / 1000);
  steps(sim, secs * 60);
  ok(sim.products.includes(p), `sleep: sigue vivo tras ${secs}s (sin recycle por tiempo)`);
}

// ---- 4) emisores se pausan al llegar al tope ----
{
  const sim = new SimWorld();
  ok(sim.placeTool('calabacera', 8, 8, 0, 0, 0, now), 'emisor: calabacera colocada');
  for (let k = 0; k < MAX_BODIES; k++) {
    sim.spawnProduct('corn', 0, 1 + (k % 3) * 0.2, 0, { x: 0, y: 0, z: 0 });
  }
  const e = sim.tools.get(sim.key(8, 8, 0));
  e.nextSpawn = now;
  steps(sim, 3);
  ok(sim.products.length === MAX_BODIES, 'emisor: no supera cap cuando intenta emitir');
  ok(Boolean(e.paused), 'emisor: queda pausado por cap');
}

// ---- 5) UI estática: menú global vender suelo + prioridad clic producto ----
{
  const root = dirname(fileURLToPath(import.meta.url));
  const html = readFileSync(join(root, 'index.html'), 'utf8');
  const hud = readFileSync(join(root, 'src', 'ui', 'hud.js'), 'utf8');
  const main = readFileSync(join(root, 'src', 'main.js'), 'utf8');
  ok(/id="act-sell-ground"/.test(html), 'UI: existe #act-sell-ground');
  ok(/actSellGround/.test(hud), 'UI: hud referencia actSellGround');
  ok(/onSellGround/.test(hud), 'UI: hud cablea callback onSellGround');
  ok(/onSellGround\s*:\s*\(\)\s*=>/.test(main), 'UI: main pasa callback onSellGround');
  ok(
    /else if \(!tryCollectGround\(e\)\) selectAt\(hoverCell\);/.test(main),
    'UI: clic con mano vacía prioriza vender producto antes de seleccionar pieza',
  );
}

console.log(`\nSMOKE-D5-F3 PASS (${pass} checks)`);
