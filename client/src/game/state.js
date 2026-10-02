// Chanchos S.A. — estado de economía local (M1; en M2 lo valida el servidor)
// M1.5-B: edades, ranuras de mejora (2 por edad), multiplicadores (jamonera, portal).
import {
  LEVELS,
  PRODUCTS,
  TOOLS,
  TOSS,
  COMBO,
  START_MONEY,
  TOOL_ORDER,
  toolCost,
  comboMult,
  AGES,
  ageInfo,
  isToolUnlocked,
  UPGRADE_LINES,
  upgradeCost,
  totalSlots,
  JUMBO_VALUE_MULT,
  HAM_GLOBAL_PER_UNIT,
  REFUND_RATE_CLAY,
  REFUND_RATE_POST_CLAY,
} from 'chanchos-shared';

// M1.5-C: zona jugable por edad (rect inclusivo en celdas 0..15).
// L0 cubre sembrador inicial (8,4) + camino al portal norte; cada edad agranda.
export function allowedRect(level) {
  const l = Math.max(0, Math.min(level || 0, 3));
  if (l === 0) return { i0: 6, i1: 9, j0: 0, j1: 7 };
  if (l === 1) return { i0: 5, i1: 10, j0: 0, j1: 10 };
  if (l === 2) return { i0: 3, i1: 12, j0: 0, j1: 13 };
  return { i0: 0, i1: 15, j0: 0, j1: 15 };
}

export function isInRect(i, j, r) {
  return i >= r.i0 && i <= r.i1 && j >= r.j0 && j <= r.j1;
}

// M1.5-C: sembrador inicial gratis mirando al norte (hacia el portal).
export const STARTER = { type: 'sembrador', i: 8, j: 5, h: 0, rot8: 0, pitchDeg: 0 };

export class GameState {
  constructor() {
    // M1.5-C: dinero inicial = ~4 canaletas rectas + margen (con costos base de shared).
    this.money = TOOLS.recta.base * 4 + 18;
    void START_MONEY;
    this.level = 0;
    this.owned = Object.fromEntries(TOOL_ORDER.map((t) => [t, 0]));
    this.comboSteps = 0;
    this.comboUntil = 0;
    this.lastToss = -1e9;
    this.delivered = 0;
    this.listeners = new Set();
    // M1.5-B: mejoras. { lineId: nivel }
    this.upgrades = {};
    for (const id of Object.keys(UPGRADE_LINES)) this.upgrades[id] = 0;
  }

  onChange(fn) {
    this.listeners.add(fn);
  }

  emit() {
    for (const fn of this.listeners) fn();
  }

  get levelInfo() {
    return LEVELS[this.level];
  }

  nextLevel() {
    return LEVELS[this.level + 1] || null;
  }

  // ---- M1.5-B: edades ----
  ageInfo() {
    return ageInfo(this.level);
  }

  unlockedTools() {
    return ageInfo(this.level).tools.slice();
  }

  canBuyTool(type) {
    return isToolUnlocked(type, this.level);
  }

  // Qué desbloquea la próxima edad (para que la UI muestre costo + contenido).
  // { cost, tools:[{type,name}], products:[{kind,name}], fanTier }
  nextAgePreview() {
    const next = this.nextLevel();
    if (!next) return null;
    const info = ageInfo(this.level + 1);
    const prev = new Set(ageInfo(this.level).tools);
    return {
      cost: next.cost,
      name: next.name,
      slogan: next.slogan,
      mult: next.mult,
      tools: info.tools.filter((t) => !prev.has(t)).map((t) => ({ type: t, name: TOOLS[t].name })),
      products: info.products.map((k) => ({ kind: k, name: PRODUCTS[k].name })),
      fanTier: info.fanTier,
    };
  }

  toolPrice(type) {
    return toolCost(type, this.owned[type]);
  }

  comboMult() {
    return comboMult(this.comboSteps);
  }

  comboWindowMs() {
    return COMBO.windowMs + (this.upgrades.portal_combo || 0) * 1000;
  }

  comboActive(now) {
    return now < this.comboUntil && this.comboSteps > 0;
  }

  buyTool(type) {
    if (!this.canBuyTool(type)) return false;
    const price = this.toolPrice(type);
    if (this.money < price) return false;
    this.money -= price;
    this.owned[type]++;
    this.emit();
    return true;
  }

  sellTool(type) {
    this.owned[type] = Math.max(0, this.owned[type] - 1);
    const rate = this.refundRate();
    const refund = Math.floor(toolCost(type, this.owned[type]) * rate);
    this.money += refund;
    this.emit();
    return refund;
  }

  // M1.5-C: Barro devuelve 100%, desde Madera 75%.
  refundRate() {
    return this.level <= 0 ? REFUND_RATE_CLAY : REFUND_RATE_POST_CLAY;
  }

  allowedRect() {
    return allowedRect(this.level);
  }

  canPlaceAt(i, j) {
    return isInRect(i, j, this.allowedRect());
  }

  // M1.5-C: reinicia parcela/dinero a estado inicial (el mundo 3D lo hace main.js).
  resetProgress() {
    this.money = TOOLS.recta.base * 4 + 18;
    this.level = 0;
    this.owned = Object.fromEntries(TOOL_ORDER.map((t) => [t, 0]));
    this.owned[STARTER.type] = 1; // el sembrador inicial ya colocado
    this.comboSteps = 0;
    this.comboUntil = 0;
    this.delivered = 0;
    this.upgrades = {};
    for (const id of Object.keys(UPGRADE_LINES)) this.upgrades[id] = 0;
    this.emit();
  }

  // Multiplicador global: nivel + jamoneras colocadas + mejora jamon_mult + portal.
  incomeMult() {
    let m = this.levelInfo.mult;
    m *= 1 + (this.owned.jamonera || 0) * HAM_GLOBAL_PER_UNIT;
    m *= 1 + (this.upgrades.jamon_mult || 0) * 0.08;
    m *= 1 + (this.upgrades.portal_valor || 0) * 0.12;
    m *= 1 + (this.upgrades.portal_boca || 0) * 0.06;
    return m;
  }

  fanTier() {
    return ageInfo(this.level).fanTier;
  }

  // valueMult extra por producto (jumbo x2, gordo/dulce/curado).
  // meta: { jumbo?: bool, fatMult?: number }
  productValueMult(kind, meta = {}) {
    let m = 1;
    if (meta.jumbo) m *= JUMBO_VALUE_MULT;
    if (meta.fatMult) m *= meta.fatMult;
    return m;
  }

  registerDelivery(kind, now, meta = {}) {
    if (now < this.comboUntil) this.comboSteps = Math.min(this.comboSteps + 1, 49);
    else this.comboSteps = 0;
    this.comboUntil = now + this.comboWindowMs();
    const mult = this.comboMult();
    const value = Math.round(PRODUCTS[kind].value * this.incomeMult() * mult * this.productValueMult(kind, meta));
    this.money += value;
    this.delivered++;
    this.emit();
    return { value, mult };
  }

  recycleValue(kind, meta = {}) {
    return Math.max(1, Math.floor(PRODUCTS[kind].value * this.incomeMult() * 0.5 * this.productValueMult(kind, meta)));
  }

  addMoney(v) {
    this.money += v;
    this.emit();
  }

  canToss(now) {
    return this.money >= TOSS.cost && now - this.lastToss >= TOSS.cooldownMs;
  }

  doToss(now) {
    this.money -= TOSS.cost;
    this.lastToss = now;
    this.emit();
  }

  buyLevel() {
    const next = this.nextLevel();
    if (!next || this.money < next.cost) return false;
    this.money -= next.cost;
    this.level++;
    this.emit();
    return true;
  }

  // ---- M1.5-B: API de mejoras (la consume la UI) ----
  // Ranuras: 2 por edad. total = (nivel+1)*2. Usadas = suma de niveles.
  totalUpgradeSlots() {
    return totalSlots(this.level);
  }

  usedUpgradeSlots() {
    return Object.values(this.upgrades).reduce((a, b) => a + b, 0);
  }

  freeUpgradeSlots() {
    return this.totalUpgradeSlots() - this.usedUpgradeSlots();
  }

  upgradeLevel(lineId) {
    return this.upgrades[lineId] ?? 0;
  }

  upgradeDef(lineId) {
    return UPGRADE_LINES[lineId] || null;
  }

  upgradePrice(lineId) {
    return upgradeCost(lineId, this.upgradeLevel(lineId));
  }

  canApplyUpgrade(lineId) {
    const def = UPGRADE_LINES[lineId];
    if (!def) return { ok: false, reason: 'línea desconocida' };
    if (this.level < def.age) return { ok: false, reason: `requiere edad ${ageInfo(def.age).name}` };
    if (this.upgradeLevel(lineId) >= def.max) return { ok: false, reason: 'nivel máximo' };
    if (this.freeUpgradeSlots() < 1) return { ok: false, reason: 'sin ranuras (subí de edad)' };
    if (this.money < this.upgradePrice(lineId)) return { ok: false, reason: 'fondos insuficientes' };
    return { ok: true };
  }

  applyUpgrade(lineId) {
    const c = this.canApplyUpgrade(lineId);
    if (!c.ok) return c;
    this.money -= this.upgradePrice(lineId);
    this.upgrades[lineId]++;
    this.emit();
    return { ok: true, level: this.upgrades[lineId] };
  }

  // Modificadores derivados para SimWorld.setModifiers(). Un solo objeto,
  // para no acoplar la física a este archivo.
  simModifiers() {
    const u = (id) => this.upgrades[id] || 0;
    return {
      // sembrador: auto si velocidad>=1; intervalo base 3000ms
      sembradorAuto: u('sembra_vel') > 0,
      sembradorIntervalMs: 3000 * Math.pow(0.82, u('sembra_vel')),
      sembradorJumboChance: u('sembra_jumbo') * 0.1,
      sembradorBurstChance: u('sembra_burst') * 0.12,
      // conversores: tiempo base × velocidad; doble salida; mult de valor
      palomiteraTimeMs: 1500 * Math.pow(0.85, u('palomi_vel')),
      palomiteraValueMult: 1 + u('palomi_dulce') * 0.15,
      palomiteraDoubleChance: u('palomi_efi') * 0.15,
      corralTimeMs: 3000 * Math.pow(0.85, u('corral_vel')),
      corralValueMult: 1 + u('corral_gordo') * 0.15,
      corralDoubleChance: u('corral_camada') * 0.15,
      jamoneraTimeMs: 4000 * Math.pow(0.85, u('jamon_vel')),
      jamoneraValueMult: 1 + u('jamon_curado') * 0.2,
      // fan: tier por edad + líneas fuerza/alcance/modo
      fanTier: this.fanTier(),
      fanRangeBonus: u('fan_alcance') * 0.6,
      fanMode: u('fan_modo'), // 0 normal, 1 pulsos, 2 giratorio
    };
  }
}
