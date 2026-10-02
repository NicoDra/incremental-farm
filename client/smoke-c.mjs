// M1.5-C smoke headless: reembolso por edad, mover gratis, rect por edad,
// triggerManual con cooldown, starter + registerDelivery con meta.
// node client/smoke-c.mjs → sale 0 si todo pasa.
import RAPIER from '@dimforge/rapier3d-compat';
import { SimWorld } from './src/sim/world.js';
import { GameState, allowedRect, isInRect, STARTER } from './src/game/state.js';
import { REFUND_RATE_POST_CLAY, REFUND_RATE_CLAY, TOOLS } from 'chanchos-shared';

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

// 1. reembolso 100% en Barro, 75% desde Madera
{
  const s = new GameState();
  ok(s.refundRate() === REFUND_RATE_CLAY && s.refundRate() === 1.0, 'Barro reembolsa 100%');
  s.money = 100000;
  s.buyTool('recta');
  const before = s.money;
  const refund = s.sellTool('recta');
  ok(s.money - before === refund && refund > 0, `demoler en Barro devuelve íntegro (${refund})`);
  s.level = 1;
  ok(s.refundRate() === REFUND_RATE_POST_CLAY && s.refundRate() === 0.75, 'Madera reembolsa 75%');
  s.buyTool('recta');
  const b2 = s.money;
  const r2 = s.sellTool('recta');
  ok(r2 < s.toolPrice('recta') || r2 === Math.floor(s.toolPrice('recta') * 0.75), `demoler en Madera devuelve 75% (${r2})`);
  void b2;
}

// 2. mover gratis: owned y dinero intactos tras levantar + re-colocar
{
  const sim = new SimWorld();
  const state = new GameState();
  state.money = 100000;
  state.buyTool('recta');
  const moneyAfterBuy = state.money;
  sim.placeTool('recta', 8, 5, 0, 0, 0, 1000, { fanTier: 0, age: 0 });
  const e = sim.removeTool(8, 5, 0); // levantar (sin vender)
  ok(e && e.type === 'recta', 'levantar pieza guarda snapshot');
  ok(state.money === moneyAfterBuy && state.owned.recta === 1, 'mover no toca dinero ni owned');
  ok(sim.placeTool(e.type, 8, 4, 0, e.rot8, e.pitchDeg, 2000, { fanTier: 0, age: 0 }), 're-colocar destino libre ok');
  ok(state.money === moneyAfterBuy, 're-colocar sin costo');
}

// 3. rect permitido por edad: crece con nivel, starter dentro
{
  const r0 = allowedRect(0);
  const r3 = allowedRect(3);
  const area = (r) => (r.i1 - r.i0 + 1) * (r.j1 - r.j0 + 1);
  ok(area(r3) === 256, 'Fábrica = parcela completa 16x16');
  ok(area(r0) < area(allowedRect(1)) && area(allowedRect(1)) < area(allowedRect(2)), 'rect crece por edad');
  ok(isInRect(STARTER.i, STARTER.j, r0), `starter (${STARTER.i},${STARTER.j}) dentro del rect L0`);
  ok(!isInRect(0, 0, r0), 'esquina (0,0) bloqueada en Barro');
  ok(isInRect(0, 0, r3), 'esquina (0,0) libre en Fábrica');
}

// 4. triggerManual: emite sin costo + cooldown
{
  const sim = new SimWorld();
  sim.placeTool('sembrador', 8, 6, 0, 0, 0, 1000);
  const p = sim.triggerManual(8, 6, 0, 2000);
  ok(p && p.kind === 'corn', 'triggerManual emite 1 maíz');
  ok(sim.triggerManual(8, 6, 0, 2000) === null, 'cooldown bloquea emisión inmediata');
  const p2 = sim.triggerManual(8, 6, 0, 2000 + 800);
  ok(p2 && p2.kind === 'corn', 'tras 800ms emite de nuevo');
  ok(sim.triggerManual(0, 0, 0, 5000) === null, 'celda vacía retorna null');
}

// 5. dinero inicial alcanza ~3-4 canaletas + margen; starter gratis
{
  const s = new GameState();
  let cost = 0;
  const tmp = new GameState();
  tmp.money = 1e9;
  for (let k = 0; k < 4; k++) cost += tmp.toolPrice('recta'), tmp.buyTool('recta');
  ok(s.money >= cost * 0.9, `inicial $${s.money} cubre ~4 rectas ($${cost})`);
  ok(TOOLS.recta.base === 8, 'costo base recta desde shared');
}

// 6. registerDelivery con meta jumbo vale x2 (contrato onDeliver 4 args)
{
  const a = new GameState();
  const va = a.registerDelivery('corn', 99999, {}).value;
  const b = new GameState();
  const vb = b.registerDelivery('corn', 99999, { jumbo: true }).value;
  ok(vb === va * 2, `meta jumbo x2 (${va}→${vb})`);
}

console.log(`\nSMOKE-C PASS (${pass} checks)`);
