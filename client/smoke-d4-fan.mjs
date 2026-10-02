// M1.5-D4 smoke headless: ventilador por niveles (punto 2).
// - fan placeable en h0/h1/h2 (h3 y h-1 rechazados)
// - cono y banda vertical anclados al nivel (baseY), no al suelo
// - empuja producto de SU nivel; no empuja niveles vecinos
// node smoke-d4-fan.mjs  → sale 0 si todo pasa.
import RAPIER from '@dimforge/rapier3d-compat';
import { SimWorld } from './src/sim/world.js';
import { fanTierInfo, fanConeParams } from 'chanchos-shared';

await RAPIER.init();

let now = 500000;
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

// ---- 1. niveles de colocación ----
{
  const sim = new SimWorld();
  ok(sim.placeTool('fan', 2, 2, 0, 0, 0, now), 'fan en N0');
  ok(sim.placeTool('fan', 3, 2, 1, 0, 0, now), 'fan en N1');
  ok(sim.placeTool('fan', 4, 2, 2, 0, 0, now), 'fan en N2');
  ok(!sim.placeTool('fan', 5, 2, 3, 0, 0, now), 'fan rechaza N3');
  ok(!sim.placeTool('fan', 6, 2, -1, 0, 0, now), 'fan rechaza nivel -1');
  ok(sim.placeTool('recta', 4, 2, 0, 0, 0, now), 'canaleta bajo el fan de N2 en la misma celda');
}

// ---- 2. cono anclado al nivel del fan ----
{
  const sim = new SimWorld();
  sim.placeTool('fan', 8, 8, 1, 0, 0, now);
  const e = sim.tools.get(sim.key(8, 8, 1));
  const prm = sim.fanParams(e);
  const tier = fanTierInfo(0);
  ok(Math.abs(prm.origin.y - (e.baseY + tier.originY)) < 1e-6, `origen del cono a altura de nivel (${prm.origin.y})`);
  ok(Math.abs(prm.yMin - (e.baseY - 0.4)) < 1e-6, `yMin = baseY-0.4 (${prm.yMin})`);
  ok(Math.abs(prm.yMax - (e.baseY + 0.9)) < 1e-6, `yMax = baseY+0.9 (${prm.yMax})`);
  ok(prm.yMin > 0.2 && prm.yMin < 1.0, 'banda del N1 no alcanza al suelo (yMin>0.2)');
  ok(prm.yMax < 2.0, 'banda del N1 no alcanza al N2 (yMax<2.0)');
}

// helper: producto asentado en canaleta del nivel h
function spawnOnChannel(sim, i, j, h, kind = 'corn') {
  const c = sim.cellCenter(i, j);
  return sim.spawnProduct(kind, c.x, h + 1.0, c.z, { x: 0, y: 0, z: 0 });
}
function northOf(sim, p) {
  const t = p.body.translation();
  return -t.z; // norte = z negativo
}

// ---- 3. fan N1 empuja producto N1 ----
{
  const sim = new SimWorld();
  ok(sim.placeTool('recta', 8, 7, 1, 0, 0, now), 'recta N1 (8,7)');
  ok(sim.placeTool('fan', 8, 8, 1, 0, 0, now), 'fan N1 (8,8) al sur, soplando al norte');
  const p = spawnOnChannel(sim, 8, 7, 1);
  steps(sim, 40); // asentar
  const before = northOf(sim, p);
  steps(sim, 90);
  const moved = northOf(sim, p) - before;
  ok(moved > 0.3, `fan N1 empuja producto N1 (Δnorte=${moved.toFixed(2)})`);
}

// ---- 4. fan N1 NO empuja producto en el suelo (regresión del bug) ----
// Producto a 4 celdas al norte, en suelo: el cono viejo lo alcanzaba
// (radio 2.08 > Δy 1.6); la banda vertical lo excluye ahora.
{
  const sim = new SimWorld();
  ok(sim.placeTool('fan', 8, 8, 1, 0, 0, now), 'fan N1 (8,8)');
  const c = sim.cellCenter(8, 4);
  const p = sim.spawnProduct('corn', c.x, 0.2, c.z, { x: 0, y: 0, z: 0 });
  const before = northOf(sim, p);
  steps(sim, 90);
  const moved = northOf(sim, p) - before;
  ok(Math.abs(moved) < 0.25, `fan N1 ignora producto del suelo (Δ=${moved.toFixed(2)})`);
}

// ---- 5. fan N0 NO empuja producto del N1 ----
{
  const sim = new SimWorld();
  ok(sim.placeTool('recta', 8, 7, 1, 0, 0, now), 'recta N1 (8,7)');
  ok(sim.placeTool('fan', 8, 8, 0, 0, 0, now), 'fan N0 (8,8)');
  const p = spawnOnChannel(sim, 8, 7, 1);
  steps(sim, 40);
  const before = northOf(sim, p);
  steps(sim, 90);
  const moved = northOf(sim, p) - before;
  ok(Math.abs(moved) < 0.3, `fan N0 ignora producto N1 (Δ=${moved.toFixed(2)})`);
}

// ---- 6. fan N0 sigue empujando en el suelo (no rompimos lo existente) ----
{
  const sim = new SimWorld();
  sim.placeTool('fan', 8, 8, 0, 0, 0, now);
  const c = sim.cellCenter(8, 7);
  const p = sim.spawnProduct('corn', c.x, 0.2, c.z, { x: 0, y: 0, z: 0 });
  const before = northOf(sim, p);
  steps(sim, 90);
  const moved = northOf(sim, p) - before;
  ok(moved > 0.3, `fan N0 empuja producto del suelo (Δ=${moved.toFixed(2)})`);
}

// ---- 7. M1.5-G: cono visual = física en 8 dirs, con pitch, potencias y alcances ----
// El render (showSelectionCone/fantasma) y la física (fanParams) llaman al
// mismo fanConeParams con los mismos ajustes: se replica acá el camino visual
// y se compara contra sim.fanParams.
{
  const sim = new SimWorld();
  sim.setModifiers({ fanRangeBonus: 0.6 });
  ok(sim.placeTool('fan', 8, 8, 1, 0, 0, now), 'cono: fan N1');
  const e = sim.tools.get(sim.key(8, 8, 1));
  const DIRS8L = [
    { x: 0, z: -1 }, { x: 0.7071, z: -0.7071 }, { x: 1, z: 0 }, { x: 0.7071, z: 0.7071 },
    { x: 0, z: 1 }, { x: -0.7071, z: 0.7071 }, { x: -1, z: 0 }, { x: -0.7071, z: -0.7071 },
  ];
  for (let r = 0; r < 8; r++) {
    for (const pitch of [0, 45]) {
      for (const powerPct of [25, 100]) {
        for (const rangeCells of [null, 2]) {
          e.rot8 = r;
          e.dir = DIRS8L[r];
          e.pitchDeg = pitch;
          sim.setFanTune(e, { powerPct, rangeCells });
          const phys = sim.fanParams(e);
          // camino visual: mismo fanConeParams con mismos ajustes
          const cp = Math.cos((pitch * Math.PI) / 180);
          const vis = fanConeParams({
            fanTier: e.fanTier,
            dir: { x: DIRS8L[r].x, z: DIRS8L[r].z },
            pitchDeg: pitch,
            cx: e.cx,
            cy: e.baseY,
            cz: e.cz,
            rangeBonus: 0.6,
            powerPct,
            rangeCells,
          });
          void cp;
          ok(
            Math.abs(vis.force - phys.force) < 1e-9 && Math.abs(vis.range - phys.range) < 1e-9,
            `cono r${r} pitch${pitch} ${powerPct}% ${rangeCells === null ? 'máx' : rangeCells}: visual=física (F=${phys.force.toFixed(3)}, R=${phys.range.toFixed(2)})`,
          );
          ok(
            // tolerancia 1e-4: DIRS8 guarda 0.7071 (4 decimales), la física
            // lo normaliza a unidad exacta; misma fuente, distinto redondeo.
            Math.abs(vis.direction.x - phys.direction.x) < 1e-4 &&
              Math.abs(vis.direction.z - phys.direction.z) < 1e-4,
            `cono r${r} pitch${pitch}: misma dirección`,
          );
        }
      }
    }
  }
  // efectivos: 25 % = 1/4 del máximo; alcance 2 recorta; null = máximo+bonus
  sim.setFanTune(e, { powerPct: 25, rangeCells: null });
  const p25 = sim.fanParams(e);
  ok(Math.abs(p25.force - p25.maxForce / 4) < 1e-9, 'cono: 25 % = 1/4 del máximo del tier');
  ok(Math.abs(p25.range - p25.maxRange) < 1e-9, 'cono: null = máximo con bonus');
  sim.setFanTune(e, { rangeCells: 2 });
  ok(Math.abs(sim.fanParams(e).range - 2) < 1e-9, 'cono: alcance elegido recorta');
}

console.log(`\nSMOKE-D4-FAN PASS (${pass} checks)`);
