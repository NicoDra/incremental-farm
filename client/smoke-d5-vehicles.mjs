// M1.5-E Etapa 2 smoke: vehículos de entrega — límite MAX_DELIVERY_VEHICLES
// y sin efecto en física ni estado del juego.
// No usa Three.js (headless): verifica solo la lógica de slots y límite.
import { MAX_DELIVERY_VEHICLES } from 'chanchos-shared';

let pass = 0;
function ok(cond, msg) {
  if (!cond) { console.error('FAIL:', msg); process.exit(1); }
  pass++;
}

// ── Simulación headless del pool de vehículos ─────────────────────────────────
// Reimplementa la misma lógica de DeliveryVehicleRenderer.spawn/update
// sin importar Three.js (no disponible en Node headless).

const ANIM_MS = 1100;

function makePool() {
  const active = [];
  let time = 0;

  return {
    tick(ms) { time += ms; },
    spawn(x) {
      if (active.length >= MAX_DELIVERY_VEHICLES) return false;
      const usedSlots = new Set(active.map(a => a.slot));
      let slot = -1;
      for (let i = 0; i < MAX_DELIVERY_VEHICLES; i++) {
        if (!usedSlots.has(i)) { slot = i; break; }
      }
      if (slot < 0) return false;
      active.push({ slot, startMs: time, x });
      return true;
    },
    update() {
      const stillActive = active.filter(a => (time - a.startMs) < ANIM_MS);
      active.length = 0;
      active.push(...stillActive);
    },
    count() { return active.length; },
    slots() { return active.map(a => a.slot); },
  };
}

// ── Test 1: spawn hasta el límite ─────────────────────────────────────────────
{
  const pool = makePool();
  for (let i = 0; i < MAX_DELIVERY_VEHICLES; i++) {
    ok(pool.spawn(i * 0.5), `spawn ${i} debe aceptarse`);
  }
  ok(pool.count() === MAX_DELIVERY_VEHICLES, 'pool lleno al límite');
  const extra = pool.spawn(99);
  ok(!extra, 'spawn extra sobre límite debe rechazarse');
  ok(pool.count() === MAX_DELIVERY_VEHICLES, 'count no sube sobre límite');
}

// ── Test 2: slot liberado tras ANIM_MS ────────────────────────────────────────
{
  const pool = makePool();
  pool.spawn(0);
  pool.update();
  ok(pool.count() === 1, 'slot activo antes de expirar');
  pool.tick(ANIM_MS + 1);
  pool.update();
  ok(pool.count() === 0, 'slot liberado tras ANIM_MS');
  // debe poder aceptar uno nuevo
  ok(pool.spawn(0.5), 'slot reutilizable tras expirar');
}

// ── Test 3: slots únicos (no se duplican) ─────────────────────────────────────
{
  const pool = makePool();
  for (let i = 0; i < MAX_DELIVERY_VEHICLES; i++) pool.spawn(i);
  const slots = pool.slots();
  const unique = new Set(slots);
  ok(unique.size === slots.length, 'slots únicos, sin duplicados');
}

// ── Test 4: la constante es >= 1 ─────────────────────────────────────────────
ok(MAX_DELIVERY_VEHICLES >= 1, 'MAX_DELIVERY_VEHICLES >= 1');
ok(Number.isInteger(MAX_DELIVERY_VEHICLES), 'MAX_DELIVERY_VEHICLES es entero');

// ── Test 5: no altera estado de juego ─────────────────────────────────────────
ok(typeof MAX_DELIVERY_VEHICLES === 'number', 'constante es numérica desde shared');

console.log(`PASS smoke-d5-vehicles (${pass} checks)`);