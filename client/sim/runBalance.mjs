// pnpm sim:balance — corre el sim headless con semilla fija y bots,
// mide métricas y escribe JSON comparables (balance-report.json/.csv).
import { writeFileSync } from 'node:fs';
import RAPIER from '@dimforge/rapier3d-compat';
import { SimWorld } from '../src/sim/world.js';
import { setSimSeed } from '../src/sim/seed.js';
import { GameState } from '../src/game/state.js';
import { SimWatch } from './watch.js';
import { BotPerezosa, BotPerezosaExploit, BotCompleta, BotConLimpieza, BotBasura } from './bots/balanceBots.js';
import { AUTO_LIQUIDATE_MS, DELIVERY_Z } from 'chanchos-shared';

const SEED = 42;
const SIM_MS = 60 * 60 * 1000; // 60 min simulados
const STEP = 1 / 60;

async function runBot(BotClass, name) {
  await RAPIER.init();
  setSimSeed(SEED);
  const sim = new SimWorld();
  sim.setAutoLiquidateMs(AUTO_LIQUIDATE_MS);
  const state = new GameState();
  const watch = new SimWatch({ intervalMs: 30_000 });
  const bot = new BotClass(sim, state, watch);
  sim.setModifiers(state.simModifiers());
  sim.setFanTier(state.fanTier());
  bot.nowMs = 0;
  bot.setup();

  let portalTotal = 0;
  sim.onDeliver = (kind, pos, nowMs, meta) => {
    const got = state.registerDelivery(kind, nowMs, meta);
    portalTotal += got.value;
  };
  // Liquidación automática: la llama la física de world.js por el flag.
  sim.onLiquidate = (kind, pos, nowMs, meta) => {
    const value = state.autoLiquidateValue(kind, meta);
    state.registerLiquidation(kind, nowMs, value, false);
  };
  let nowMs = 0;
  while (nowMs < SIM_MS) {
    nowMs += STEP * 1000;
    bot.step(STEP, nowMs);
    sim.step(STEP, nowMs);
    watch.tick(sim, state, nowMs);
    if (Math.floor(nowMs / 60000) !== Math.floor((nowMs - STEP * 1000) / 60000)) {
      watch.note(sim, state, nowMs, `t=${(nowMs / 60000).toFixed(0)}min dinero=${state.money.toFixed(0)}`);
    }
  }
  const lastRow = watch.rows.at(-1);
  return {
    name,
    state,
    watch,
    sim,
    portalTotal,
    manualTotal: state.liquidatedValue || 0,
    autoTotal: state.liquidatedValue || 0, // en esta iteración autos y manuales van al mismo pozo; la separación se refina abajo
    manualUnits: state.liquidatedCount || 0,
    autoUnits: 0,
    rows: watch.rows,
    endBreakdown: watch.snapshotBodies(sim, state, SIM_MS),
    milestones: watch.events.filter((e) => e.msg.startsWith('sube a ')),
    lastRow,
  };
}

// ---- Trayectoria del maíz con línea a medias (sembrador → recta → fan →
//  recta → portal): posición cada 0.5 s, distancia recorrida antes de parar.
function traceCornPath() {
  setSimSeed(SEED);
  const sim = new SimWorld();
  sim.placeTool('sembrador', 8, 5, 0, 0, 0, 0, {});
  sim.placeTool('recta', 8, 4, 0, 0, 0, 0, {});
  sim.placeTool('fan', 8, 2, 0, 0, 0, 0, {});
  sim.placeTool('recta', 8, 1, 0, 0, 0, 0, {});
  const log = [];
  const p = sim.triggerManual(8, 5, 0, 0);
  let last = p ? p.body.translation() : null;
  for (let k = 0; k < 60 * 4 && p; k++) {
    now += 1000 / 60;
    sim.step(1 / 60, now);
    if (!sim.products.includes(p)) break;
    log.push(p.body.translation());
  }
  return { started: !!p, log };
}

let now = 0;
const results = [];
for (const [BotClass, label] of [
  [BotPerezosa, 'Perezosa'],
  [BotPerezosaExploit, 'PerezosaExploit'],
  [BotCompleta, 'Completa'],
  [BotConLimpieza, 'ConLimpieza'],
  [BotBasura, 'Basura'],
]) {
  const r = await runBot(BotClass, label);
  const lastRow = r.watch.rows.at(-1);
  const rows = r.watch.rows;
  const capRow = rows.find((row) => row.capBodies);
  const stuckTicks = rows.filter((row) => row.convertersStuck + row.producersPaused > 0).length;

  console.log(`\n=== ${r.name} ===`);
  console.log(`${'min'.padStart(5)} ${'edad'.padEnd(14)} ${'dinero'.padStart(9)} ${'ent/min'.padStart(8)} ${'unid/$'.padStart(14)} ${'suelo'.padStart(5)}/${'canal'.padStart(4)} ${'bloq'.padStart(4)}`);
  for (const row of rows.filter((_, idx) => idx % 5 === 0)) {
    const entMin = row.incomePerMin >= 0 ? Math.round(row.delivered / Math.max(0.1, row.t / 60000) * 100) / 100 : 0;
    console.log(
      `${String((row.t / 60000).toFixed(1)).padStart(5)} ${row.levelName.padEnd(14)} ${String(row.money).padStart(9)} ${String(entMin).padStart(8)} ${(row.liquidatedManualUnits + '/' + row.liquidatedManualIncome).padStart(14)} ${String(row.byPlace?.ground ?? 0).padStart(5)}/${String(row.byPlace?.channel ?? 0).padStart(4)} ${String(row.silosFull + row.convertersStuck + row.producersPaused).padStart(4)}`,
    );
  }
  console.log('hitos por edad:');
  for (const m of r.milestones) {
    console.log(`  ${(m.t / 60000).toFixed(1)}min → ${m.msg} (dinero=${m.money})`);
  }
  console.log('desglose al fin:');
  console.log(`  por tipo: ${JSON.stringify(r.endBreakdown.byKind)}`);
  console.log(`  por lugar: ${JSON.stringify(r.endBreakdown.byPlace)} (cuerpos activos=${r.endBreakdown.total})`);
  console.log(`  ingresos separados: portal=${r.portalTotal} liqManual=${r.state.liquidatedManualValue ?? 0} liqAuto=${r.state.liquidatedAutoValue ?? 0}`);
  console.log(`resumen: edad=${r.state.levelInfo.name} entregasPortal=${r.state.delivered} liquidadosManual=${r.state.liquidatedManualCount ?? 0} liquidadosAuto=${r.state.liquidatedAutoCount ?? 0}`);

  results.push({
    name: r.name,
    finalLevel: r.state.levelInfo.name,
    finalMoney: Math.floor(r.state.money),
    deliveredPortal: r.state.delivered,
    portalIncome: r.portalTotal,
    manualLiquidation: r.state.liquidatedManualValue || 0,
    autoLiquidation: r.state.liquidatedAutoValue || 0,
    manualLiquidationUnits: r.state.liquidatedManualCount || 0,
    autoLiquidationUnits: r.state.liquidatedAutoCount || 0,
    deliveriesPerMin: Math.round(r.state.delivered / (SIM_MS / 60000) * 100) / 100,
    incomePerMin: Math.round(r.portalTotal / (SIM_MS / 60000) * 100) / 100,
    byPlace: r.endBreakdown.byPlace,
    bodiesAtEnd: r.endBreakdown.total,
    stuckTicks,
    capHitAtPct: capRow ? capRow.t / SIM_MS : null,
    upgradesPurchased: Object.values(r.state.upgrades).filter((v) => v > 0).length,
    milestones: r.milestones.map((m) => ({ atMin: +(m.t / 60000).toFixed(1), money: m.money, msg: m.msg })),
  });
}

// ---- Determinismo: dos corridas con la misma semilla dan el mismo estado.
const rA = await (async () => { setSimSeed(SEED); const s = new GameState(); for (let k = 0; k < 600; k++) s.registerDelivery('corn', k * 1000); return s; })();
const rB = await (async () => { setSimSeed(SEED); const s = new GameState(); for (let k = 0; k < 600; k++) s.registerDelivery('corn', k * 1000); return s; })();
const deterministic = rA.money === rB.money && rA.delivered === rB.delivered;
console.log(`\ndeterminismo (misma semilla ×2): ${deterministic ? 'OK' : 'FALLA'}`);

// ---- Trayectoria del maíz (solo medición).
const path = traceCornPath();
if (path.started && path.log.length) {
  const first = path.log[0];
  const last = path.log[path.log.length - 1];
  const dz = Math.abs(last.z - first.z);
  console.log(`\ntrayectoria del maíz: emite en z=${first.z.toFixed(2)}, para en z=${last.z.toFixed(2)} (avanza ${dz.toFixed(2)} celdas, portal en z=${DELIVERY_Z.toFixed(1)})`);
  console.log(`  Portal faltante: ${(Math.abs(last.z) - Math.abs(DELIVERY_Z)).toFixed(2)}. El maíz se queda a ${Math.abs(first.z - last.z).toFixed(2)} de haber salido del sembrador.`);
}

// ---- Reporte comparable.
const summary = {
  generatedAt: new Date().toISOString(),
  seed: SEED,
  durationMin: SIM_MS / 60000,
  deterministic,
  runs: results,
  cornPath: {
    startZ: path.log[0]?.z ?? null,
    stopsAtZ: path.log.at(-1)?.z ?? null,
    deliveryZ: DELIVERY_Z,
  },
};

writeFileSync('balance-report.json', JSON.stringify(summary, null, 2));
const csvHead = 'bot,edad_final,dinero_final,entregas_portal,ingreso_portal,unidades_liq_manual,ingreso_liq_manual,unidades_liq_auto,ingreso_liq_auto,cuerpos_fin,cap_hit,min_edad,money_en_edad';
const csvRows = [];
for (const r of results) {
  for (const m of r.milestones) {
    csvRows.push(`${r.name},${r.finalLevel},${r.finalMoney},${r.deliveredPortal},${r.portalIncome},${r.manualLiquidationUnits},${r.manualLiquidation},${r.autoLiquidationUnits},${r.autoLiquidation},${r.bodiesAtEnd},${r.capHitAtPct === null ? '' : (r.capHitAtPct * 100).toFixed(0) + 'pct'},${m.atMin},${m.money}`);
  }
}
writeFileSync('balance-report.csv', [csvHead, ...csvRows].join('\n'));
console.log('\nReporte: balance-report.json + balance-report.csv');
