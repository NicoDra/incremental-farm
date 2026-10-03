// Chanchos S.A. — espectador del simulador de balance (M1.5-H).
// Mido métricas del mundo simulado SIN tocar la lógica del juego:
//   - dinero del estado, nivel/edad, entregas por minuto simulado
//   - cuerpo físico activos (otro canal distinto de los guardados en silos)
//   - bloqueos: silos llenos, conversores en espera permanente, emisores pausados
import { TOOLS, MAX_BODIES, LIQUIDATION_RATE, AUTO_LIQUIDATE_SECONDS } from 'chanchos-shared';

export class SimWatch {
  constructor({ intervalMs = 1000 } = {}) {
    this.intervalMs = Math.max(250, intervalMs | 0);
    this.rows = [];
    this.events = [];
    this._lastAt = 0;
    this._money0 = 0;
    this._delivered0 = 0;
  }

  tick(sim, state, nowMs) {
    if (nowMs - this._lastAt < this.intervalMs) return;
    this._lastAt = nowMs;
    const bodies = sim.products.length;
    const blockedConv = [];
    const blockedEmit = [];
    const silosFull = [];
    for (const e of sim.tools.values()) {
      const def = TOOLS[e.type];
      if (!def) continue;
      if (def.kind === 'converter') {
        if (e.outputBlocked) blockedConv.push(e);
        const full =
          Array.isArray(e.inputBuffers) ? false
          : e.inputBuffers && Object.values(e.inputBuffers).some((a) => a.length >= 3);
        if (full && !e.pending) blockedConv.push(e);
      } else if (def.kind === 'producer') {
        if (e.paused) blockedEmit.push(e);
      } else if (def.kind === 'silo') {
        const stock = Object.values(e.siloStore || {}).reduce((a, s) => a + s.count, 0);
        if (stock >= sim.siloCap()) silosFull.push(e);
      }
    }
    const moneyRatePerMin =
      this.rows.length > 0
        ? ((state.money - this._money0) / Math.max(1, (nowMs - this.rows[this.rows.length - 1].t) / 60000))
        : 0;
    this.rows.push({
      t: nowMs,
      level: state.level,
      levelName: state.levelInfo.name,
      money: Math.floor(state.money),
      delivered: state.delivered,
      portal: state.delivered,
      liquidatedManualUnits: state.liquidatedManualCount || 0,
      liquidatedManualIncome: state.liquidatedManualValue || 0,
      liquidatedAutoUnits: state.liquidatedAutoCount || 0,
      liquidatedAutoIncome: state.liquidatedAutoValue || 0,
      incomePerMin: Math.round(moneyRatePerMin),
      comboTop: state.comboSteps,
      bodies,
      capBodies: bodies >= MAX_BODIES,
      silosFull: silosFull.length,
      convertersStuck: blockedConv.length,
      producersPaused: blockedEmit.length,
      moneySpendable: Math.floor(state.money),
    });
    this._money0 = state.money;
    this._delivered0 = state.delivered;
  }

  note(sim, state, nowMs, msg) {
    this.events.push({ t: nowMs, levelName: state.levelInfo.name, msg, money: Math.floor(state.money) });
  }

  portalIncome(money, nowMs) {
    (this.portalLog = this.portalLog || []).push({ t: nowMs, money });
  }
  liquidateIncome(value, nowMs) {
    (this.liquidationLog = this.liquidationLog || []).push({ t: nowMs, value });
  }
  portalIncomeTotal() {
    return (this.portalLog || []).length ? this.portalLog[this.portalLog.length - 1].money : 0;
  }
  liquidateTotal() {
    return this.liquidationLog || [];
  }

  // M1.5-H2: desglose del tope de cuerpos (120). Ubicación: en canal si la
  // celda del producto es kind channel; frente a procesador si la celda
  // inmediata en la dirección de su boca es converter/silo; en silo si la boca
  // de salida está tapada; al emisor si el pausa es del productor.
  snapshotBodies(sim, state, nowMs) {
    const byKind = {};
    const byPlace = { ground: 0, channel: 0, converterFront: 0, siloMouth: 0, blockedProducer: 0 };
    let totalStuck = 0;
    let totalSilo = 0;
    for (const p of sim.products) {
      byKind[p.kind] = (byKind[p.kind] || 0) + 1;
      const t = p.body.translation();
      const i = Math.floor(t.x + 8);
      const j = Math.floor(t.z + 8);
      const e = sim.tools.get(sim.key(i, j, Math.max(0, Math.min(2, Math.round(t.y)))));
      const nearDeliver = t.z < -8.2;
      const kind = e ? TOOLS[e.type]?.kind : null;
      if (kind === 'channel') byPlace.channel++;
      else if (kind === 'converter' || kind === 'silo') byPlace.converterFront++;
      else if (e && e.outputBlocked) byPlace.siloMouth++;
      else if (e && e.paused && TOOLS[e.type].kind === 'producer') byPlace.blockedProducer++;
      else if (nearDeliver) byPlace.ground++;
      else byPlace.ground++;
    }
    for (const e of sim.tools.values()) {
      const k = TOOLS[e.type]?.kind;
      if (k === 'converter' && e.outputBlocked) totalStuck++;
      if (k === 'silo') {
        const n = Object.values(e.siloStore || {}).reduce((a, s) => a + s.count, 0);
        if (n >= sim.siloCap()) totalSilo++;
      }
    }
    return {
      t: nowMs,
      level: state.levelInfo.name,
      total: sim.products.length,
      byKind,
      byPlace,
      convertersBlocked: totalStuck,
      silosFull: totalSilo,
      pausedProducers: [...sim.tools.values()].filter((e) => e.paused).length,
    };
  }
}
