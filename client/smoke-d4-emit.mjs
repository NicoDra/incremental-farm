// M1.5-D4 smoke headless: emisión estable (punto 1).
// - constantes nuevas (EMIT_IMPULSE / CHANNEL_WALL_H / MAX_PRODUCT_SPEED)
// - salida SOLO con impulso horizontal (sin componente vertical)
// - caja muerta: el producto queda contenido en la celda (nada vuela por la pared)
// - CCD + tope de velocidad anti-túnel
// node smoke-d4-emit.mjs  → sale 0 si todo pasa.
import RAPIER from '@dimforge/rapier3d-compat';
import { SimWorld } from './src/sim/world.js';
import {
  EMIT_IMPULSE,
  CHANNEL_WALL_H,
  MAX_PRODUCT_SPEED,
  SPEED_LIMIT,
} from 'chanchos-shared';

await RAPIER.init();

let now = 400000;
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

const speed = (v) => Math.hypot(v.x, v.y, v.z);

// ---- 1. constantes compartidas ----
ok(EMIT_IMPULSE > 0 && EMIT_IMPULSE <= 2, `EMIT_IMPULSE moderada (${EMIT_IMPULSE})`);
ok(CHANNEL_WALL_H === 0.6, `CHANNEL_WALL_H = 0.6 (top físico 0.62)`);
ok(MAX_PRODUCT_SPEED === 5 && SPEED_LIMIT === MAX_PRODUCT_SPEED, 'tope de velocidad 5 (alias SPEED_LIMIT)');

// La boca de salida queda POR DEBAJO de la pared: nada sale por encima.
{
  const sim = new SimWorld();
  ok(sim.placeTool('sembrador', 6, 6, 0, 0, 0, now), 'sembrador colocado');
  const e = sim.tools.get(sim.key(6, 6, 0));
  const mouth = sim.mouthPos(e);
  const wallTop = 0.02 + CHANNEL_WALL_H;
  ok(mouth.y < wallTop, `boca (${mouth.y}) por debajo del perfil de la pared (${wallTop})`);
}

// ---- 2. emisión del sembrador: velocidad 100% horizontal ≈ EMIT_IMPULSE ----
{
  const sim = new SimWorld();
  sim.placeTool('sembrador', 6, 6, 0, 0, 0, now);
  const p = sim.triggerManual(6, 6, 0, now);
  ok(!!p, 'sembrador emite');
  const v = p.body.linvel();
  ok(Math.abs(v.y) < 1e-6, `salida sin lift vertical (vy=${v.y})`);
  ok(Math.abs(speed(v) - EMIT_IMPULSE) < 1e-3, `velocidad inicial = EMIT_IMPULSE (${speed(v).toFixed(3)})`);
}

// ---- 3. caja muerta: sembrador + recta cerrada a los 3 lados ----
// recta r2 (eje E/O) rodeada por máquinas en O, E y al sur: sus únicas
// aperturas son la boca hacia el sembrador. El producto tiene que quedar
// dentro de la celda (antes salía por encima de la pared).
{
  const sim = new SimWorld();
  ok(sim.placeTool('sembrador', 6, 6, 0, 0, 0, now), 'sembrador (6,6) colocado');
  ok(sim.placeTool('recta', 6, 5, 0, 2, 0, now), 'recta r2 (6,5) colocada');
  ok(sim.placeTool('calabacera', 5, 5, 0, 0, 0, now), 'calabacera (5,5) como pared O');
  ok(sim.placeTool('calabacera', 7, 5, 0, 0, 0, now), 'calabacera (7,5) como pared E');
  for (const k of [sim.key(5, 5, 0), sim.key(7, 5, 0)]) sim.tools.get(k).paused = true;
  const recta = sim.tools.get(sim.key(6, 5, 0));
  ok(
    recta.opens && recta.opens.S && !recta.opens.N && !recta.opens.E && !recta.opens.W,
    `recta en caja: solo boca sur (opens=${JSON.stringify(recta.opens)})`,
  );

  const p = sim.triggerManual(6, 6, 0, now);
  ok(!!p, 'emisión hacia la caja');
  const v0 = p.body.linvel();
  ok(Math.abs(v0.y) < 1e-6, 'emisión hacia la caja sin vy');
  const c = sim.cellCenter(6, 5);
  let maxY = 0;
  let escaped = false;
  for (let k = 0; k < 180; k++) {
    now += 1000 / 60;
    sim.step(STEP, now);
    if (!sim.products.includes(p)) break;
    const t = p.body.translation();
    maxY = Math.max(maxY, t.y);
    if (Math.abs(t.x - c.x) > 0.6 || Math.abs(t.z - c.z) > 0.6) escaped = true;
  }
  ok(sim.products.includes(p), 'producto sigue vivo tras 3 s (no se escapó a la entrega)');
  ok(!escaped, 'producto contenido en la celda de la canaleta');
  ok(maxY < 0.9, `nunca vuela por encima de la pared (maxY=${maxY.toFixed(2)})`);
}

// ---- 4. conversor: cerdo emitido sin lift vertical y contenido ----
{
  const sim = new SimWorld();
  ok(sim.placeTool('corral', 6, 6, 0, 0, 0, now), 'corral (6,6) colocado');
  ok(sim.placeTool('recta', 6, 5, 0, 2, 0, now), 'recta r2 (6,5) al frente');
  ok(sim.placeTool('calabacera', 5, 5, 0, 0, 0, now), 'calabacera (5,5) pared O');
  ok(sim.placeTool('calabacera', 7, 5, 0, 0, 0, now), 'calabacera (7,5) pared E');
  for (const k of [sim.key(5, 5, 0), sim.key(7, 5, 0)]) sim.tools.get(k).paused = true;
  const corral = sim.tools.get(sim.key(6, 6, 0));
  sim.spawnProduct('corn', corral.cx, 0.4, corral.cz + 0.3, { x: 0, y: 0, z: 0 });
  let pig = null;
  let pigV = null;
  for (let k = 0; k < 60 * 6 && !pig; k++) {
    now += 1000 / 60;
    sim.step(STEP, now);
    pig = sim.products.find((pr) => pr.kind === 'pig');
    if (pig) pigV = pig.body.linvel();
  }
  ok(!!pig, 'corral escupe cerdo');
  if (pig) {
    ok(pigV.y < 0.05, `cerdo sin lift vertical (vy=${pigV.y.toFixed(3)}: solo gravedad, antes era ~+1.0)`);
    const sp = speed(pigV);
    ok(sp <= EMIT_IMPULSE + 0.05, `cerdo emitido a EMIT_IMPULSE (${sp.toFixed(3)})`);
    const c = sim.cellCenter(6, 5);
    steps(sim, 60 * 3);
    const t = pig.body.translation();
    ok(
      Math.abs(t.x - c.x) <= 0.6 && Math.abs(t.z - c.z) <= 0.6,
      `cerdo contenido en la celda (${t.x.toFixed(2)}, ${t.z.toFixed(2)})`,
    );
  }
}

// ---- 5. tope de velocidad: spawn a velocidad loca queda acotado al primer paso ----
{
  const sim = new SimWorld();
  const p = sim.spawnProduct('corn', 0, 1, 0, { x: 0, y: 0, z: -MAX_PRODUCT_SPEED - 2 });
  ok(!!p, 'producto disparado a velocidad loca');
  now += 1000 / 60;
  sim.step(STEP, now);
  const v = p.body.linvel();
  ok(speed(v) <= MAX_PRODUCT_SPEED + 1e-3, `velocidad acotada a ${MAX_PRODUCT_SPEED} (${speed(v).toFixed(2)})`);
}

// ---- 6. calabacera: calabaza emitida sin lift ----
{
  const sim = new SimWorld();
  ok(sim.placeTool('calabacera', 6, 6, 0, 0, 0, now), 'calabacera (6,6) colocada');
  let pk = null;
  let pkV = null;
  for (let k = 0; k < 60 * 15 && !pk; k++) {
    now += 1000 / 60;
    sim.step(STEP, now);
    pk = sim.products.find((pr) => pr.kind === 'pumpkin') || null;
    if (pk) pkV = pk.body.linvel();
  }
  ok(!!pk, 'calabacera emite calabaza');
  if (pk) {
    ok(pkV.y < 0.05, `calabaza sin lift (vy=${pkV.y.toFixed(3)})`);
    ok(speed(pkV) <= EMIT_IMPULSE + 0.05, `calabaza a EMIT_IMPULSE (${speed(pkV).toFixed(3)})`);
  }
}

// ---- 7. palomitera: palomita emitida sin lift ----
{
  const sim = new SimWorld();
  ok(sim.placeTool('palomitera', 6, 6, 0, 0, 0, now), 'palomitera (6,6) colocada');
  const pal = sim.tools.get(sim.key(6, 6, 0));
  sim.spawnProduct('corn', pal.cx, 0.5, pal.cz + 0.3, { x: 0, y: 0, z: 0 });
  let pop = null;
  let popV = null;
  for (let k = 0; k < 60 * 5 && !pop; k++) {
    now += 1000 / 60;
    sim.step(STEP, now);
    pop = sim.products.find((pr) => pr.kind === 'popcorn') || null;
    if (pop) popV = pop.body.linvel();
  }
  ok(!!pop, 'palomitera escupe palomita');
  if (pop) {
    ok(popV.y < 0.05, `palomita sin lift (vy=${popV.y.toFixed(3)})`);
    ok(speed(popV) <= EMIT_IMPULSE + 0.05, `palomita a EMIT_IMPULSE (${speed(popV).toFixed(3)})`);
  }
}

// ---- 8. jumbo: misma velocidad de salida, contenido (mitad 0.24 < pared 0.62) ----
{
  const sim = new SimWorld();
  sim.mods.sembradorJumboChance = 1;
  ok(sim.placeTool('sembrador', 6, 6, 0, 0, 0, now), 'sembrador colocado');
  ok(sim.placeTool('recta', 6, 5, 0, 2, 0, now), 'recta r2 al frente');
  ok(sim.placeTool('calabacera', 5, 5, 0, 0, 0, now), 'pared O');
  ok(sim.placeTool('calabacera', 7, 5, 0, 0, 0, now), 'pared E');
  for (const k of [sim.key(5, 5, 0), sim.key(7, 5, 0)]) sim.tools.get(k).paused = true;
  const p = sim.triggerManual(6, 6, 0, now);
  ok(!!p && p.jumbo, 'sembrador emite choclo jumbo');
  const v = p.body.linvel();
  ok(Math.abs(speed(v) - EMIT_IMPULSE) < 1e-3, `jumbo sale a EMIT_IMPULSE (${speed(v).toFixed(3)})`);
  const c = sim.cellCenter(6, 5);
  steps(sim, 120);
  const t = p.body.translation();
  ok(
    sim.products.includes(p) && Math.abs(t.x - c.x) <= 0.6 && Math.abs(t.z - c.z) <= 0.6,
    `jumbo contenido (${t.x.toFixed(2)}, ${t.z.toFixed(2)})`,
  );
}

// ---- 9. caja muerta en todos los tiers de canaleta (fricción 0..3) ----
for (let age = 0; age <= 3; age++) {
  const sim = new SimWorld();
  sim.placeTool('sembrador', 6, 6, 0, 0, 0, now);
  sim.placeTool('recta', 6, 5, 0, 2, 0, now, { age });
  sim.placeTool('calabacera', 5, 5, 0, 0, 0, now);
  sim.placeTool('calabacera', 7, 5, 0, 0, 0, now);
  for (const k of [sim.key(5, 5, 0), sim.key(7, 5, 0)]) sim.tools.get(k).paused = true;
  const p = sim.triggerManual(6, 6, 0, now);
  ok(!!p, `tier${age}: emisión ok`);
  const c = sim.cellCenter(6, 5);
  let escaped = false;
  for (let k = 0; k < 180; k++) {
    now += 1000 / 60;
    sim.step(STEP, now);
    if (!sim.products.includes(p)) break;
    const t = p.body.translation();
    if (Math.abs(t.x - c.x) > 0.6 || Math.abs(t.z - c.z) > 0.6) escaped = true;
  }
  ok(sim.products.includes(p) && !escaped, `tier${age}: contenido 3 s`);
}

console.log(`\nSMOKE-D4-EMIT PASS (${pass} checks)`);
