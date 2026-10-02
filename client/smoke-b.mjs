// M1.5-B smoke headless: cadena, conversores, fan tiers, jumbo x2, upgrades.
// node client/smoke-b.mjs  → sale 0 si todo pasa.
import RAPIER from '@dimforge/rapier3d-compat';
import { SimWorld } from './src/sim/world.js';
import { GameState } from './src/game/state.js';
import { DELIVERY_Z, UPGRADE_LINES, FAN_TIERS } from 'chanchos-shared';

await RAPIER.init();

let now = 100000;
const STEP = 1 / 60;
function steps(sim, n) {
  for (let k = 0; k < n; k++) {
    now += (1000 / 60);
    sim.step(STEP, now);
  }
}
function settle(sim, ms) {
  const n = Math.ceil(ms / (1000 / 60));
  steps(sim, n);
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

// 1. sembrador manual → boca norte → portal entrega maíz
{
  const sim = new SimWorld();
  const state = new GameState();
  const got = [];
  sim.onDeliver = (kind, pos, t, meta) => got.push({ kind, meta, res: state.registerDelivery(kind, t, meta) });
  ok(sim.placeTool('sembrador', 8, 6, 0, 0, 0, now), 'sembrador colocado (8,6) N');
  ok(sim.placeTool('recta', 8, 5, 0, 0, 0, now), 'canaleta recta colocada');
  const p = sim.triggerManual(8, 6, 0, now);
  ok(p && p.kind === 'corn', 'triggerManual emite 1 maíz');
  const t = p.body.translation();
  const e = sim.tools.get(sim.key(8, 6, 0));
  ok(t.z < e.cz, 'maíz aparece en boca de salida (norte del centro)');
  const v = p.body.linvel();
  ok(v.z < 0, 'maíz sale hacia el norte');
  ok(sim.triggerManual(8, 6, 0, now) === null, 'enfriamiento manual bloquea doble clic');
  // lleva ese maíz al portal: teleport junto a brecha + empuje norte
  p.body.setTranslation({ x: 0, y: 0.5, z: DELIVERY_Z + 0.4 }, true);
  p.body.setLinvel({ x: 0, y: 0, z: -3 }, true);
  settle(sim, 1500);
  ok(got.length === 1 && got[0].kind === 'corn', 'portal entrega maíz (sembrador→portal)');
  ok(got[0].res.value >= 3, `maíz vale >=3 (fue ${got[0].res.value})`);
  // modo auto: sin mejora no auto-emite
  const n0 = sim.products.length;
  settle(sim, 3500);
  ok(sim.products.length <= n0 + 1, 'sembrador manual no auto-emite sin mejora');
  sim.setModifiers(state.simModifiers());
  // con mejora velocidad → auto
  state.money = 100000;
  ok(state.applyUpgrade('sembra_vel').ok, 'mejora sembra_vel aplicada (auto)');
  sim.setModifiers(state.simModifiers());
  const n1 = sim.products.length;
  settle(sim, 4000);
  ok(sim.products.length > n1, 'sembrador auto-emite con mejora velocidad');
}

// 2. palomitera maíz→palomita
{
  const sim = new SimWorld();
  ok(sim.placeTool('palomitera', 5, 5, 0, 0, 0, now), 'palomitera colocada');
  const e = sim.tools.get(sim.key(5, 5, 0));
  sim.spawnProduct('corn', e.cx, 0.5, e.cz + 0.3, { x: 0, y: 0, z: 0 });
  settle(sim, 6000);
  ok(sim.products.some((p) => p.kind === 'popcorn'), 'palomitera convierte maíz→palomita');
}

// 3. corral maíz→cerdo + boca de entrada direccional (rechaza frente)
{
  const sim = new SimWorld();
  ok(sim.placeTool('corral', 6, 6, 0, 0, 0, now), 'corral colocado');
  const e = sim.tools.get(sim.key(6, 6, 0));
  sim.spawnProduct('corn', e.cx, 0.5, e.cz - 0.45, { x: 0, y: 0, z: 0 });
  settle(sim, 800);
  ok(!e.pending && sim.products.some((p) => p.kind === 'corn'), 'corral rechaza maíz por el frente');
  sim.products.slice().forEach((_, idx) => sim.removeProduct(0));
  sim.spawnProduct('corn', e.cx, 0.5, e.cz + 0.3, { x: 0, y: 0, z: 0 });
  settle(sim, 7000);
  ok(sim.products.some((p) => p.kind === 'pig'), 'corral convierte maíz→cerdo por atrás');
}

// 4. jamonera cerdo→jamón + multiplicador global
{
  const sim = new SimWorld();
  const state = new GameState();
  ok(sim.placeTool('jamonera', 7, 7, 0, 0, 0, now), 'jamonera colocada');
  const e = sim.tools.get(sim.key(7, 7, 0));
  sim.spawnProduct('pig', e.cx, 0.5, e.cz + 0.3, { x: 0, y: 0, z: 0 });
  settle(sim, 8000);
  ok(sim.products.some((p) => p.kind === 'ham'), 'jamonera convierte cerdo→jamón');
  const s0 = new GameState();
  const vBase = s0.registerDelivery('ham', now).value;
  const s1 = new GameState();
  s1.owned.jamonera = 1;
  const vJam = s1.registerDelivery('ham', now).value;
  ok(vJam > vBase, `jamonera da multiplicador global (${vBase}→${vJam})`);
}

// 5. fan tier2 empuja más que tier1
{
  ok(FAN_TIERS[2].force > FAN_TIERS[1].force && FAN_TIERS[1].force > FAN_TIERS[0].force, 'tiers fan: fuerza 2>1>0');
  async function push(tier) {
    const sim = new SimWorld();
    sim.setFanTier(tier);
    sim.placeTool('fan', 8, 10, 0, 0, 0, now, { fanTier: tier });
    const p = sim.spawnProduct('popcorn', 0.5, 0.8, 0.5, { x: 0, y: 0, z: 0 });
    const z0 = p.body.translation().z;
    let zLast = z0;
    for (let k = 0; k < 72; k++) {
      now += 1000 / 60;
      sim.step(STEP, now);
      if (sim.products.includes(p)) zLast = p.body.translation().z;
      else break; // salió/entregó: cuenta como avance máximo
    }
    return z0 - zLast; // avance norte positivo
  }
  const d1 = await push(0);
  const d2 = await push(1);
  ok(d2 > d1, `fan tier2 empuja más que tier1 (${d1.toFixed(2)}→${d2.toFixed(2)})`);
}

// 6. jumbo vale x2 + upgrades/ranuras
{
  const a = new GameState();
  const va = a.registerDelivery('corn', now, {}).value;
  const b = new GameState();
  const vb = b.registerDelivery('corn', now, { jumbo: true }).value;
  ok(vb === va * 2, `jumbo vale x2 (${va}→${vb})`);
  const s = new GameState();
  ok(s.totalUpgradeSlots() === 2 && s.freeUpgradeSlots() === 2, '2 ranuras en Barro');
  s.money = 100000;
  ok(s.applyUpgrade('sembra_jumbo').ok && s.upgradeLevel('sembra_jumbo') === 1, 'aplica mejora jumbo nv1');
  ok(s.freeUpgradeSlots() === 1, 'ranura consumida');
  s.level = 3;
  ok(s.totalUpgradeSlots() === 8, '8 ranuras en Fábrica');
  ok(UPGRADE_LINES.sembra_vel.growth > UPGRADE_LINES.sembra_jumbo.growth, 'velocidad escala costo más rápido que probabilidad');
  const r = new GameState().canApplyUpgrade('jamon_mult');
  ok(!r.ok, 'jamon_mult bloqueado en Barro (requiere Fábrica)');
}

console.log(`\nSMOKE-B PASS (${pass} checks)`);
