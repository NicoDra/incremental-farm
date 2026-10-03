// Bots de balance. Solo leen/actúan sobre el estado; la sim corre igual.
import { UPGRADE_LINES, upgradeCost } from 'chanchos-shared';

// Sembrador inicial del juego (mismas coordenadas que STARTER en game/state.js).
const STARTER = { type: 'sembrador', i: 8, j: 5, h: 0, rot8: 0, pitchDeg: 0 };

export class BotBase {
  constructor(sim, state, watch) {
    this.sim = sim;
    this.state = state;
    this.watch = watch;
    this.placed = new Set();
  }
  place(type, i, j, h, rot8) {
    const key = `${i},${j},${h}`;
    if (this.placed.has(key) || this.sim.tools.has(key)) return false;
    if (!this.state.canBuyTool(type)) return false;
    if (this.state.money < this.state.toolPrice(type)) return false;
    if (!this.state.buyTool(type)) return false;
    const ok = this.sim.placeTool(type, i, j, h, rot8, 0, this.nowMs || 0, {
      age: this.state.level,
      fanTier: this.state.fanTier(),
      noAutoConnect: false,
    });
    if (!ok) {
      this.state.owned[type]--;
      this.state.addMoney(this.state.toolPrice(type) + 1);
      return false;
    }
    this.placed.add(key);
    return true;
  }
  emitManual(i, j) {
    this.sim.triggerManual(i, j, 0, this.nowMs || 0);
  }
  upgradeCheapest() {
    let best = null;
    for (const id of Object.keys(UPGRADE_LINES)) {
      if (!this.state.canApplyUpgrade(id).ok) continue;
      const c = upgradeCost(id, this.state.upgradeLevel(id));
      if (!best || c < best.cost) best = { id, cost: c };
    }
    if (best) this.upgrade(best.id);
    return false;
  }
  upgrade(id) {
    const r = this.state.applyUpgrade(id);
    if (r.ok) this.sim.setModifiers(this.state.simModifiers());
    return r.ok;
  }
  tryLevelUp() {
    if (this.state.buyLevel()) {
      this.sim.setModifiers(this.state.simModifiers());
      this.sim.setFanTier(this.state.fanTier());
      this.watch.note(this.sim, this.state, this.nowMs || 0, `sube a ${this.state.levelInfo.name}`);
    }
  }
  step(dt, nowMs) {
    this.nowMs = nowMs;
  }
}

// Perezosa: línea mínima solo maíz, sin kick. El maíz no llega al portal al
// tier base (fricción + distancia) y eso se mide: sin entregas, la economía
// queda taponada por el cap.
export class BotPerezosa extends BotBase {
  setup() {
    this.place('sembrador', STARTER.i, STARTER.j, 0, STARTER.rot8);
    this.place('recta', 8, 4, 0, 0);
    this.place('fan', 8, 3, 0, 0);
    this.place('recta', 8, 2, 0, 0);
  }
  step(dt, nowMs) {
    this.nowMs = nowMs;
    this.emitManual(STARTER.i, STARTER.j);
    this.upgradeCheapest();
    this.tryLevelUp();
  }
}

// PerezosaExploit: línea física que sí entrega (sembrador al N, fan tier 1 al
// N del borde del paso, y salta por el fan a un tramo utilizado). Sin kick.
export class BotPerezosaExploit extends BotBase {
  setup() {
    this.place('sembrador', STARTER.i, STARTER.j, 0, STARTER.rot8);
    this.place('fan', 8, 3, 0, 0);
    this.place('recta', 8, 2, 0, 0);
  }
  step(dt, nowMs) {
    this.nowMs = nowMs;
    this.emitManual(STARTER.i, STARTER.j);
    this.upgradeCheapest();
    this.tryLevelUp();
  }
}

// Con limpieza: misma línea que Perezosa + vende lo suelto cada 60 s (como el
// jugador que hace clic; para medir si el tope se debe a mala administración).
export class BotConLimpieza extends BotPerezosa {
  constructor(sim, state, watch) {
    super(sim, state, watch);
    this.lastClean = -60_000;
  }
  step(dt, nowMs) {
    if (nowMs - this.lastClean >= 60_000) {
      this.lastClean = nowMs;
      for (const p of [...this.sim.products]) {
        const t = p.body.translation();
        const v = this.state.liquidateValue(p.kind, { jumbo: p.jumbo, fatMult: p.fatMult });
        this.sim.removeProduct(this.sim.products.indexOf(p));
        this.state.registerLiquidation(p.kind, nowMs, v, true);
      }
    }
    super.step(dt, nowMs);
  }
}

// Basura: emisores apuntando al suelo, sin circuito. Solo auto-liquidación.
export class BotBasura extends BotBase {
  setup() {
    this.place('sembrador', 6, 5, 0, 0);
    this.place('sembrador', 8, 5, 0, 0);
    this.place('sembrador', 10, 5, 0, 0);
    this.place('calabacera', 4, 5, 0, 0);
  }
  step(dt, nowMs) {
    this.nowMs = nowMs;
    this.emitManual(6, 5);
    this.emitManual(8, 5);
    this.emitManual(10, 5);
  }
}

// Completa: cadena compuesta validada físicamente (starter al N con fan y
// recta + corral E→W hacia la industrial, salinera al E soplando al O).
export class BotCompleta extends BotBase {
  setup() {
    this.place('sembrador', STARTER.i, STARTER.j, 0, STARTER.rot8);
    this.place('recta', 8, 4, 0, 0);
    this.place('fan', 8, 3, 0, 0);
    this.place('recta', 8, 2, 0, 0);
    this.place('pienso', 7, 4, 0, 2);
    this.place('recta', 7, 3, 0, 0);
    this.place('calabacera', 6, 4, 0, 0);
    this.place('corral', 11, 4, 0, 2);
    this.place('jamonera', 12, 4, 0, 2);
  }
  step(dt, nowMs) {
    this.nowMs = nowMs;
    this.emitManual(STARTER.i, STARTER.j);
    this.emitManual(6, 4);
    const priority = [
      'sembra_vel', 'jamon_vel', 'corral_vel', 'palomi_vel', 'sembra_burst',
      'corral_camada', 'sembra_jumbo', 'silo_cap', 'silo_vel', 'fan_alcance',
      'palomi_efi', 'palomi_dulce', 'jamon_curado', 'jamon_mult',
      'corral_gordo', 'fan_modo', 'portal_combo', 'portal_boca', 'portal_valor',
    ];
    for (const id of priority) {
      this.state.canApplyUpgrade(id).ok && this.upgrade(id);
    }
    if (this.state.level >= 2 && !this.placed.has('ind')) {
      const okSil = this.place('silo', 9, 4, 0, 0);
      const okInd = this.place('jamonera_industrial', 10, 4, 0, 0);
      if (okSil || okInd) this.placed.add('ind');
    }
    this.tryLevelUp();
  }
}
