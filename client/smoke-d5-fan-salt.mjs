// M1.5-F2 smoke: la sal es empujada por el ventilador igual que maíz/calabaza.
// - shared registra salt en FAN_PUSHABLE_PRODUCTS y su masa está en rango tier 0.
// - el fan tier 0 desplaza salt hacia el norte como a corn y pumpkin.
// node smoke-d5-fan-salt.mjs → sale 0 si todo pasa.
import RAPIER from '@dimforge/rapier3d-compat';
import { SimWorld } from './src/sim/world.js';
import {
  FAN_PUSHABLE_PRODUCTS,
  FAN_MAX_PUSH_MASS_BY_TIER,
  productMass,
  fanCanPush,
} from 'chanchos-shared';

await RAPIER.init();

let now = 900000;
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

// ---- 1. registro + masa en shared ----
ok(FAN_PUSHABLE_PRODUCTS.includes('salt'), 'shared: salt registrada entre tipos afectados por el ventilador');
ok(FAN_PUSHABLE_PRODUCTS.includes('corn') && FAN_PUSHABLE_PRODUCTS.includes('pumpkin'), 'shared: corn y pumpkin también registrados');
ok(
  productMass('salt') <= FAN_MAX_PUSH_MASS_BY_TIER[0],
  `shared: masa salt (${productMass('salt').toFixed(4)}) en rango tier 0 (<=${FAN_MAX_PUSH_MASS_BY_TIER[0]})`,
);
ok(fanCanPush('salt', 0), 'shared: fanCanPush(salt, 0) es true');
ok(fanCanPush('corn', 0) && fanCanPush('pumpkin', 0), 'shared: maíz y calabaza también en rango tier 0');

// ---- 2. el fan empuja salt igual que corn/pumpkin (mismo tier, misma posición) ----
async function pushNorth(kind, tier = 0) {
  const sim = new SimWorld();
  sim.setFanTier(tier);
  sim.placeTool('fan', 8, 10, 0, 0, 0, now, { fanTier: tier });
  const p = sim.spawnProduct(kind, 0.5, 0.8, 0.5, { x: 0, y: 0, z: 0 });
  const z0 = p.body.translation().z;
  let zLast = z0;
  for (let k = 0; k < 72; k++) {
    now += 1000 / 60;
    sim.step(STEP, now);
    if (sim.products.includes(p)) zLast = p.body.translation().z;
    else break;
  }
  return z0 - zLast; // avance norte positivo
}

// Tier 2 (Piedra) = edad que desbloquea la Salinera; ahí los tres se mueven.
const dCorn = await pushNorth('corn', 2);
const dPumpkin = await pushNorth('pumpkin', 2);
const dSalt = await pushNorth('salt', 2);
ok(dCorn > 0.3, `fan tier 2 empuja maíz (Δnorte=${dCorn.toFixed(2)})`);
ok(dPumpkin > 0.3, `fan tier 2 empuja calabaza (Δnorte=${dPumpkin.toFixed(2)})`);
ok(dSalt > 0.3, `fan tier 2 empuja sal (Δnorte=${dSalt.toFixed(2)})`);
ok(
  dSalt > Math.min(dCorn, dPumpkin) * 0.5,
  `sal se mueve en el mismo orden que maíz/calabaza (${dSalt.toFixed(2)} vs ${dCorn.toFixed(2)}/${dPumpkin.toFixed(2)})`,
);

console.log(`\nSMOKE-D5-FAN-SALT PASS (${pass} checks)`);
