// Chanchos S.A. — HUD M1.5-D: barra mínima + cajón con pestaña "Construir"
// (menú agrupado por categoría, reemplaza la hotbar) + selección.
// Lee todo de GameState (no duplica reglas): canBuyTool, toolPrice, upgrade*,
// nextAgePreview, refundRate, allowedRect.
import { TOOLS, TOOL_ORDER, TOOL_CATEGORIES, UPGRADE_LINES, formatMoney } from 'chanchos-shared';

const ICONS = {
  recta: '—',
  curva: '⌐',
  rampa: '⤵',
  embudo: '▽',
  union: 'Y',
  divisor: '‡',
  puente: '═',
  fan: 'VE',
  sembrador: 'SE',
  calabacera: 'CA',
  corral: 'CO',
  palomitera: 'PA',
  jamonera: 'JA',
};

function byId(id) {
  return document.getElementById(id);
}

export class Hud {
  constructor(state, cb) {
    this.state = state;
    this.cb = cb;
    this.el = {
      money: byId('money'),
      age: byId('age-badge'),
      combo: byId('combo-badge'),
      levelName: byId('level-name'),
      drawer: byId('drawer'),
      drawerTabs: [...document.querySelectorAll('.drawer-tab')],
      panels: {
        build: document.querySelector('[data-panel="build"]'),
        up: document.querySelector('[data-panel="up"]'),
        age: document.querySelector('[data-panel="age"]'),
      },
      heights: byId('height-sel'),
      cfg: byId('cfg'),
      toasts: byId('toasts'),
      guide: byId('guide'),
      sel: byId('sel-panel'),
      btnDirs: byId('btn-dirs'),
      btnHelp: byId('btn-help'),
      btnDrawer: byId('btn-drawer'),
      btnMove: byId('btn-move'),
      btnRemove: byId('btn-remove'),
    };
    // Orden estable = TOOL_ORDER; atajos 1-9 + 0 (décima).
    this.hotbarOrder = TOOL_ORDER.slice();
    this.height = 0;
    this.upgradeFocusType = null;
    this.upgradeFocusInfo = null;
    this._guideTimer = null;
    this.buildHeightButtons();
    this.buildBuildCards();
    this.el.btnDirs.addEventListener('click', () => this.cb.onToggleDirs());
    this.el.btnHelp.addEventListener('click', () => this.showGuide());
    this.el.btnDrawer.addEventListener('click', () => this.toggleDrawer());
    byId('btn-close-drawer').addEventListener('click', () => this.closeDrawer());
    this.el.drawerTabs.forEach((t) =>
      t.addEventListener('click', () => this.openDrawer(t.dataset.tab)),
    );
    this.el.btnMove.addEventListener('click', () => this.cb.onSelectMove());
    this.el.btnRemove.addEventListener('click', () => this.cb.onSelectRemove());
    byId('btn-close-guide').addEventListener('click', () => this.hideGuide());
    state.onChange(() => this.refresh());
    // M1.5-D: cajón abierto por defecto en pantallas anchas, pestaña Construir.
    if (typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(min-width: 56rem)').matches) {
      this.openDrawer('build');
    }
    this.refresh();
  }

  // ---- pestaña Construir (menú agrupado; reemplaza la hotbar) ----

  buildBuildCards() {
    this.cards = new Map();
    const sec = this.el.panels.build;
    sec.innerHTML = '';
    let keyIdx = 0;
    for (const cat of TOOL_CATEGORIES) {
      const wrap = document.createElement('div');
      wrap.className = 'build-group';
      const head = document.createElement('h4');
      head.textContent = cat.name;
      wrap.appendChild(head);
      const grid = document.createElement('div');
      grid.className = 'build-grid';
      for (const type of cat.tools) {
        const key = keyIdx < 9 ? String(keyIdx + 1) : '0';
        keyIdx++;
        const b = document.createElement('button');
        b.className = 'slot';
        b.dataset.type = type;
        b.innerHTML =
          `<span class="slot-key">${key}</span>` +
          `<span class="slot-icon" data-icon="${type}">${ICONS[type] || '?'}</span>` +
          `<span class="slot-owned" data-owned="${type}"></span>`;
        b.addEventListener('click', () => this.cb.onSelectTool(type));
        grid.appendChild(b);
        this.cards.set(type, b);
      }
      wrap.appendChild(grid);
      sec.appendChild(wrap);
    }
    this.refreshTooltips();
  }

  buildHeightButtons() {
    this.heightBtns = [];
    for (let h = 0; h <= 2; h++) {
      const b = document.createElement('button');
      b.className = 'height-btn' + (h === 0 ? ' selected' : '');
      b.textContent = 'N' + h;
      b.title = 'Altura N' + h + ' (H rota, clic fija)';
      b.addEventListener('click', () => this.cb.onHeight(h));
      this.el.heights.appendChild(b);
      this.heightBtns.push(b);
    }
  }

  setHeight(h) {
    this.height = h;
    this.heightBtns.forEach((b, idx) => b.classList.toggle('selected', idx === h));
  }

  setConfig(text) {
    if (this.el.cfg) this.el.cfg.textContent = text;
  }

  setDirsToggle(on) {
    this.el.btnDirs.classList.toggle('selected', Boolean(on));
    this.el.btnDirs.title = on
      ? 'Ocultar direcciones de todas las piezas (G)'
      : 'Mostrar todas las direcciones (G)';
  }

  refreshTooltips() {
    const s = this.state;
    for (const type of this.hotbarOrder) {
      const card = this.cards.get(type);
      if (!card) continue;
      const locked = !s.canBuyTool(type);
      const price = locked ? 'bloqueado por edad' : formatMoney(s.toolPrice(type));
      card.title = `${TOOLS[type].name} — ${price}\n${TOOLS[type].hint}`;
    }
  }

  setMode(mode) {
    for (const [type, card] of this.cards) {
      card.classList.toggle('selected', Boolean(mode && mode.type === type));
    }
    this.el.btnRemove.classList.toggle('selected', mode === 'remove');
    this.el.btnMove.classList.toggle(
      'selected',
      Boolean(mode === 'move-armed' || (mode && mode.moving)),
    );
  }

  // ---- cajón lateral (un panel por vez, cerrado por defecto) ----

  isDrawerOpen() {
    return !this.el.drawer.classList.contains('hidden');
  }

  openDrawer(tab = 'build') {
    this.el.drawer.classList.remove('hidden');
    this.el.drawerTabs.forEach((t) => t.classList.toggle('selected', t.dataset.tab === tab));
    for (const [k, sec] of Object.entries(this.el.panels)) {
      sec.classList.toggle('hidden', k !== tab);
    }
    this.renderDrawerTab(tab);
  }

  closeDrawer() {
    this.el.drawer.classList.add('hidden');
  }

  toggleDrawer(tab) {
    if (!this.isDrawerOpen()) this.openDrawer(tab || 'build');
    else if (tab) this.openDrawer(tab);
    else this.closeDrawer();
  }

  renderDrawerTab(tab) {
    if (tab === 'up') this.renderUpgrades();
    else if (tab === 'age') this.renderAge();
    else this.refreshTooltips();
  }

  renderUpgrades() {
    const s = this.state;
    const sec = this.el.panels.up;
    sec.innerHTML = '';
    const head = document.createElement('p');
    head.className = 'slots-line';
    head.textContent = `Ranuras: ${s.usedUpgradeSlots()}/${s.totalUpgradeSlots()} usadas`;
    sec.appendChild(head);
    if (this.upgradeFocusType) {
      const focus = document.createElement('div');
      focus.className = 'up-focus';
      const fanTxt =
        this.upgradeFocusType === 'fan' && this.upgradeFocusInfo
          ? ` · Fan tier ${this.upgradeFocusInfo.fanTier + 1}`
          : '';
      const tierTxt = this.upgradeFocusInfo ? `Tier edad ${this.upgradeFocusInfo.ageTier + 1}${fanTxt}` : '';
      focus.innerHTML =
        `<p><b>Construcción seleccionada:</b> ${TOOLS[this.upgradeFocusType]?.name || this.upgradeFocusType}</p>` +
        (tierTxt ? `<p>${tierTxt}</p>` : '');
      if (this.upgradeFocusInfo?.canUpgradeInPlace) {
        const upBtn = document.createElement('button');
        upBtn.className = 'up-buy';
        upBtn.disabled = !this.upgradeFocusInfo.canAffordUpgradeInPlace;
        upBtn.textContent = this.upgradeFocusInfo.canAffordUpgradeInPlace
          ? `Mejorar in-place ${formatMoney(this.upgradeFocusInfo.upgradeCost)}`
          : `Faltan fondos (${formatMoney(this.upgradeFocusInfo.upgradeCost)})`;
        upBtn.addEventListener('click', () => this.cb.onUpgradeSelected?.());
        focus.appendChild(upBtn);
      } else {
        const p = document.createElement('p');
        p.className = 'up-focus-muted';
        p.textContent = 'Sin tier siguiente disponible para esta construcción.';
        focus.appendChild(p);
      }
      if (this.upgradeFocusInfo?.isPausable) {
        const pauseBtn = document.createElement('button');
        pauseBtn.className = this.upgradeFocusInfo.isPaused ? 'up-buy danger' : 'up-buy success';
        pauseBtn.textContent = this.upgradeFocusInfo.isPaused ? '▶ Reanudar ciclo' : '⏸ Pausar ciclo';
        pauseBtn.addEventListener('click', () => this.cb.onPauseToggle?.());
        focus.appendChild(pauseBtn);
      }
      sec.appendChild(focus);
    }
    const onlyObj = this.mapToolToUpgradeObj(this.upgradeFocusType);
    for (const id of Object.keys(UPGRADE_LINES)) {
    const def = s.upgradeDef(id);
    if (onlyObj && onlyObj !== '__none__' && def.obj !== onlyObj) continue;
    if (onlyObj === '__none__') continue;
      const lvl = s.upgradeLevel(id);
      const chk = s.canApplyUpgrade(id);
      const row = document.createElement('div');
      row.className = 'up-row';
      const btn = document.createElement('button');
      btn.className = 'up-buy';
      btn.disabled = !chk.ok;
      btn.textContent = chk.ok ? `Comprar ${formatMoney(s.upgradePrice(id))}` : (chk.reason || '—');
      btn.addEventListener('click', () => this.cb.onUpgrade(id));
      row.innerHTML =
        `<span class="up-name">${def.name} <b>${lvl}/${def.max}</b></span>` +
        `<span class="up-desc">${def.desc}</span>`;
      row.appendChild(btn);
      sec.appendChild(row);
    }
    if (onlyObj && sec.children.length === 2) {
      const p = document.createElement('p');
      p.className = 'up-focus-muted';
      p.textContent = 'Esta construcción no tiene mejoras de línea.';
      sec.appendChild(p);
    }
  }

  mapToolToUpgradeObj(type) {
    if (!type) return null;
    if (type === 'fan') return 'fan';
    if (type === 'sembrador') return 'sembrador';
    if (type === 'corral') return 'corral';
    if (type === 'palomitera') return 'palomitera';
    if (type === 'jamonera') return 'jamonera';
    return '__none__';
  }

  focusUpgradesForTool(type, info) {
    this.upgradeFocusType = type || null;
    this.upgradeFocusInfo = info || null;
    this.openDrawer('up');
  }

  renderAge() {
    const s = this.state;
    const sec = this.el.panels.age;
    sec.innerHTML = '';
    const cur = document.createElement('p');
    cur.className = 'age-cur';
    cur.textContent = `Edad actual: ${s.ageInfo().name} (x${s.levelInfo.mult} ingresos)`;
    sec.appendChild(cur);
    const prev = s.nextAgePreview();
    if (!prev) {
      const p = document.createElement('p');
      p.textContent = 'Edad máxima. Chanchos S.A. al 100%.';
      sec.appendChild(p);
      return;
    }
    const box = document.createElement('div');
    box.className = 'age-next';
    const tools = prev.tools.length
      ? prev.tools.map((t) => t.name).join(', ')
      : 'sin herramientas nuevas';
    const prods = prev.products.map((p) => p.name).join(', ');
    box.innerHTML =
      `<p><b>Siguiente: ${prev.name}</b> — ${formatMoney(prev.cost)}</p>` +
      `<p>${prev.slogan}</p>` +
      `<p>Desbloquea: ${tools}</p>` +
      `<p>Productos: ${prods} · Ventilador tier ${prev.fanTier + 1} · x${prev.mult} ingresos</p>`;
    const btn = document.createElement('button');
    btn.className = 'age-buy';
    btn.disabled = s.money < prev.cost;
    btn.textContent = `Subir de edad: ${formatMoney(prev.cost)}`;
    btn.addEventListener('click', () => this.cb.onLevel());
    box.appendChild(btn);
    sec.appendChild(box);
    // M1.5-D4 punto 6: "Reiniciar parcela" vivía en la pestaña Ayuda
    // (eliminada); se muda al panel Edad.
    const reset = document.createElement('button');
    reset.className = 'age-buy danger';
    reset.textContent = 'Reiniciar parcela';
    reset.addEventListener('click', () => this.cb.onReset());
    sec.appendChild(reset);
  }

  // ---- selección ----

  showSelection(info) {
    const el = this.el.sel;
    el.innerHTML = '';
    if (!info) {
      this.upgradeFocusType = null;
      this.upgradeFocusInfo = null;
      if (this.isDrawerOpen()) {
        const tab = this.el.drawerTabs.find((t) => t.classList.contains('selected'))?.dataset.tab || 'build';
        if (tab === 'up') this.renderUpgrades();
      }
      el.classList.add('hidden');
      return;
    }
    el.classList.remove('hidden');
    const txt = document.createElement('span');
    txt.className = 'sel-txt';
    txt.textContent = `${info.name} · frente ${info.dir} · N${info.h}`;
    el.appendChild(txt);
    if (info.isSembrador) {
      const b = document.createElement('button');
      b.textContent = 'Emitir maíz';
      b.title = 'Emite 1 choclo gratis (igual que clic en la pieza)';
      b.addEventListener('click', () => this.cb.onEmitSelected());
      el.appendChild(b);
    }
    if (info.isPausable) {
      const p = document.createElement('button');
      p.className = info.isPaused ? 'danger' : 'success';
      p.textContent = info.isPaused ? '▶ Reanudar' : '⏸ Pausar';
      p.title = info.isPaused ? 'Reanuda el ciclo de la máquina' : 'Pausa el ciclo de la máquina';
      p.addEventListener('click', () => this.cb.onPauseToggle?.());
      el.appendChild(p);
    }
    const mv = document.createElement('button');
    mv.textContent = 'Mover (gratis)';
    mv.addEventListener('click', () => this.cb.onMoveSelected());
    if (info.canUpgradeInPlace) {
      const up = document.createElement('button');
      up.className = 'upgrade';
      up.disabled = !info.canAffordUpgradeInPlace;
      up.textContent = info.canAffordUpgradeInPlace
        ? `Mejorar in-place (${formatMoney(info.upgradeCost)})`
        : `Mejorar (${formatMoney(info.upgradeCost)})`;
      up.title = 'Sube esta construcción al siguiente tier sin demoler/reponer';
      up.addEventListener('click', () => this.cb.onUpgradeSelected?.());
      el.appendChild(up);
    }
    const rm = document.createElement('button');
    rm.className = 'danger';
    rm.textContent = `Demoler (+${formatMoney(info.refund)} · ${info.refundPct}%)`;
    rm.addEventListener('click', () => this.cb.onSellSelected());
    const x = document.createElement('button');
    x.textContent = '✕';
    x.title = 'Cerrar';
    x.addEventListener('click', () => this.showSelection(null));
    el.appendChild(mv);
    el.appendChild(rm);
    el.appendChild(x);
  }

  // ---- guía inicial (primer minuto) ----

  isGuideOpen() {
    return !this.el.guide.classList.contains('hidden');
  }

  showGuide() {
    this.el.guide.classList.remove('hidden');
    clearTimeout(this._guideTimer);
    this._guideTimer = setTimeout(() => this.hideGuide(), 60000);
  }

  hideGuide() {
    this.el.guide.classList.add('hidden');
    clearTimeout(this._guideTimer);
  }

  // ---- refresco ----

  refresh() {
    const s = this.state;
    this.el.money.textContent = formatMoney(s.money);
    this.el.levelName.textContent = s.levelInfo.name;
    this.el.age.textContent = s.ageInfo().name;
    for (const type of this.hotbarOrder) {
      const card = this.cards.get(type);
      if (!card) continue;
      const locked = !s.canBuyTool(type);
      card.classList.toggle('locked', locked);
      card.classList.toggle('broke', !locked && s.money < s.toolPrice(type));
      const ownedEl = card.querySelector(`[data-owned="${type}"]`);
      if (ownedEl) ownedEl.textContent = s.owned[type] > 0 ? `x${s.owned[type]}` : '';
    }
    this.refreshTooltips();
    if (this.isDrawerOpen()) {
      const tab = this.el.drawerTabs.find((t) => t.classList.contains('selected'))?.dataset.tab || 'up';
      this.renderDrawerTab(tab);
    }
  }

  update(nowMs) {
    const s = this.state;
    if (s.comboActive(nowMs)) {
      this.el.combo.classList.remove('hidden');
      const frac = Math.max(0, (s.comboUntil - nowMs) / s.comboWindowMs());
      this.el.combo.innerHTML =
        `COMBO x${s.comboMult().toFixed(1)}` +
        `<span class="combo-bar"><span class="combo-fill" style="width:${(frac * 100).toFixed(0)}%"></span></span>`;
    } else {
      this.el.combo.classList.add('hidden');
    }
  }

  pulseMoney() {
    this.el.money.classList.add('pulse');
    clearTimeout(this._pulseT);
    this._pulseT = setTimeout(() => this.el.money.classList.remove('pulse'), 140);
  }

  toast(text) {
    const el = document.createElement('div');
    el.className = 'toast';
    el.textContent = text;
    this.el.toasts.appendChild(el);
    while (this.el.toasts.children.length > 4) this.el.toasts.firstChild.remove();
    setTimeout(() => el.classList.add('out'), 3200);
    setTimeout(() => el.remove(), 3700);
  }
}
