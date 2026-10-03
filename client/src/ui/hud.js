// Chanchos S.A. — HUD M1.5-D: barra mínima + cajón con pestaña "Construir"
// (menú agrupado por categoría, reemplaza la hotbar) + selección.
// Lee todo de GameState (no duplica reglas): canBuyTool, toolPrice, upgrade*,
// nextAgePreview, refundRate, allowedRect.
import { TOOLS, TOOL_ORDER, TOOL_CATEGORIES, UPGRADE_LINES, PRODUCTS, AGE_GOALS, COMBO_MAX_BY_AGE, formatMoney } from 'chanchos-shared';

const ICONS = {
  recta: '┃',
  curva: '↪',
  rampa: '⤵',
  embudo: '🔻',
  union: 'Y',
  divisor: '↔',
  puente: '⎵',
  fan: '🌀',
  sembrador: '🌽',
  calabacera: '🎃',
  salinera: '🧂',
  pienso: '🥣',
  corral: '🐖',
  palomitera: '🍿',
  jamonera: '🍖',
  jamonera_industrial: '🏭',
  silo: '🛢️',
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
      btnSellGround: byId('btn-sell-ground'),
      btnDirs: byId('btn-dirs'),
      btnHelp: byId('btn-help'),
      btnMore: byId('btn-more'),
      globalMenu: byId('global-menu'),
      actSellGround: byId('act-sell-ground'),
      actReset: byId('act-reset'),
      actDirs: byId('act-dirs'),
      btnDrawer: byId('btn-drawer'),
    };
    // Orden estable = TOOL_ORDER; atajos 1-9 + 0 (décima).
    this.hotbarOrder = TOOL_ORDER.slice();
    this.height = 0;
    this.upgradeFocusType = null;
    this.upgradeFocusInfo = null;
    this._guideTimer = null;
    this.buildToolMoveBtn = null;
    this.buildToolRemoveBtn = null;
    this.buildHeightButtons();
    this.buildBuildCards();
    this.el.btnSellGround.addEventListener('click', () => this.cb.onSellGround?.());
    this.el.btnDirs.addEventListener('click', () => this.cb.onToggleDirs?.());
    this.el.btnHelp.addEventListener('click', () => this.showGuide());
    this.el.btnMore.addEventListener('click', () => this.toggleGlobalMenu());
    this.el.actSellGround.addEventListener('click', () => {
      this.cb.onSellGround?.();
      this.hideGlobalMenu();
    });
    this.el.actReset.addEventListener('click', () => {
      this.cb.onReset?.();
      this.hideGlobalMenu();
    });
    this.el.actDirs.addEventListener('click', () => {
      this.cb.onToggleDirs?.();
      this.hideGlobalMenu();
    });
    this.el.btnDrawer.addEventListener('click', () => this.toggleDrawer());
    byId('btn-close-drawer').addEventListener('click', () => this.closeDrawer());
    this.el.drawerTabs.forEach((t) =>
      t.addEventListener('click', () => this.openDrawer(t.dataset.tab)),
    );
    byId('btn-close-guide').addEventListener('click', () => this.hideGuide());
    // M1.5-G fix: el panel se reconstruye en cada frame (estados vivos), así
    // que los botones usan delegación — un solo listener que sobrevive al rebuild.
    this.el.sel.addEventListener('click', (ev) => {
      const b = ev.target?.closest?.('button[data-act]');
      if (!b || !this.el.sel.contains(b)) return;
      const act = b.dataset.act;
      if (act === 'emit') this.cb.onEmitSelected?.();
      else if (act === 'pause') this.cb.onPauseToggle?.();
      else if (act === 'move') this.cb.onMoveSelected?.();
      else if (act === 'upgrade') this.cb.onUpgradeSelected?.();
      else if (act === 'sell') this.cb.onSellSelected?.();
      else if (act === 'close') this.cb.onCloseSelection?.();
      else if (act === 'fan-power') this.cb.onFanPower?.();
      else if (act === 'fan-range') this.cb.onFanRange?.();
    });
    document.addEventListener?.('pointerdown', (ev) => {
      if (this.el.globalMenu.classList.contains('hidden')) return;
      const t = ev.target;
      if (this.el.globalMenu.contains(t) || this.el.btnMore.contains(t)) return;
      this.hideGlobalMenu();
    });
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
    const toolsBox = document.createElement('div');
    toolsBox.className = 'build-tools';
    const toolsHead = document.createElement('h4');
    toolsHead.textContent = 'Herramientas';
    toolsBox.appendChild(toolsHead);
    const row = document.createElement('div');
    row.className = 'build-tools-row';
    const mv = document.createElement('button');
    mv.className = 'tool-mode';
    mv.textContent = 'Mover (M)';
    mv.addEventListener('click', () => this.cb.onSelectMove());
    const rm = document.createElement('button');
    rm.className = 'tool-mode danger';
    rm.textContent = 'Demoler (X)';
    rm.addEventListener('click', () => this.cb.onSelectRemove());
    row.appendChild(mv);
    row.appendChild(rm);
    toolsBox.appendChild(row);
    sec.appendChild(toolsBox);
    this.buildToolMoveBtn = mv;
    this.buildToolRemoveBtn = rm;

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
        const hasShortcut = keyIdx < 10;
        keyIdx++;
        const b = document.createElement('button');
        b.className = 'slot';
        b.dataset.type = type;
        b.innerHTML =
          `<span class="slot-key${hasShortcut ? '' : ' hidden'}">${hasShortcut ? key : ''}</span>` +
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
      ? 'Ocultar direcciones (G)'
      : 'Mostrar direcciones (G)';
    this.el.actDirs.classList.toggle('selected', Boolean(on));
    this.el.actDirs.textContent = on ? 'Ocultar direcciones (G)' : 'Mostrar direcciones (G)';
  }

  refreshTooltips() {
    const s = this.state;
    for (const type of this.hotbarOrder) {
      const card = this.cards.get(type);
      if (!card) continue;
      const locked = !s.canBuyTool(type);
      const price = locked ? 'bloqueado por edad' : formatMoney(s.toolPrice(type));
      const key = this.hotbarOrder.indexOf(type);
      const shortcut = key >= 0 && key < 10 ? (key < 9 ? String(key + 1) : '0') : '—';
      const seedInfo = type === 'sembrador' ? '\nNota: xN en tarjeta = cuántos sembradores colocados.' : '';
      card.title = `${TOOLS[type].name} · ${price} · atajo ${shortcut}\n${TOOLS[type].hint}${seedInfo}`;
    }
  }

  setMode(mode) {
    for (const [type, card] of this.cards) {
      card.classList.toggle('selected', Boolean(mode && mode.type === type));
    }
    if (this.buildToolRemoveBtn) this.buildToolRemoveBtn.classList.toggle('selected', mode === 'remove');
    if (this.buildToolMoveBtn)
      this.buildToolMoveBtn.classList.toggle(
        'selected',
        Boolean(mode === 'move-armed' || (mode && mode.moving)),
      );
  }

  toggleGlobalMenu() {
    this.el.globalMenu.classList.toggle('hidden');
  }

  hideGlobalMenu() {
    this.el.globalMenu.classList.add('hidden');
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
    if (type === 'silo') return 'silo';
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
      `<p>Productos: ${prods} · Ventilador tier ${prev.fanTier + 1} · x${prev.mult} ingresos</p>` +
      `<p>Combo máximo en la próxima edad: x${s.level + 1 < 4 ? COMBO_MAX_BY_AGE[s.level + 1] : COMBO_MAX_BY_AGE[3]}.</p>`;
    // M1.5-J1: metas de entrega por producto (solo portal).
    const goal = prev.goal;
    if (goal && goal.length) {
      const list = document.createElement('div');
      list.className = 'sel-sub';
      for (const g of goal) {
        const have = s.deliveredKinds?.[g.kind] || 0;
        const done = have >= g.count;
        const cell = document.createElement('div');
        cell.className = 'sel-sub';
        cell.textContent = `${PRODUCTS[g.kind].name}: ${have}/${g.count}${done ? ' ✓' : ''}`;
        const bar = document.createElement('div');
        bar.className = 'sel-meter';
        const fill = document.createElement('div');
        fill.className = 'sel-meter-fill';
        fill.style.width = Math.min(100, (have / g.count) * 100) + '%';
        bar.appendChild(fill);
        cell.appendChild(bar);
        list.appendChild(cell);
      }
      box.appendChild(list);
    }
    const btn = document.createElement('button');
    btn.className = 'age-buy';
    const ready = s.money >= prev.cost && (!prev.goal || prev.goal.every((g) => (s.deliveredKinds?.[g.kind] || 0) >= g.count));
    btn.disabled = !ready;
    btn.textContent = ready
      ? `Subir de edad: ${formatMoney(prev.cost)}`
      : `Faltan metas / dinero (${formatMoney(prev.cost)})`;
    btn.title = 'Las entregas cuentan solo por el portal; liquidar no suma.';
    btn.addEventListener('click', () => this.cb.onLevel());
    box.appendChild(btn);
    sec.appendChild(box);
  }

  // M1.5-J1c fix: la pestaña Edad sólo muestra la meta de la PRÓXIMA transición,
  // nunca la lista acumulada de edades posteriores, y marca advertencia en dev
  // si alguna meta necesita una pieza aún bloqueada para el nivel actual.
  // (va arriba, sin tocar el split-panel viejo)
  velocityGoalHashes() {
    return 0;
  }

  // ---- selección ----

  showSelection(info) {
    const el = this.el.sel;
    // M1.5-G fix: el frame loop re-llama cada frame; si nada cambió se saltea
    // el rebuild (menos churn de DOM; los clics van por delegación igual).
    if (info) {
      let sig = '';
      try {
        sig = JSON.stringify(info);
      } catch {
        sig = String(Math.random());
      }
      if (sig === this._selSig && !el.classList.contains('hidden')) return;
      this._selSig = sig;
    } else {
      this._selSig = null;
    }
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
    if (Array.isArray(info.recipeInputs) && info.recipeInputs.length) {
      const recipeLine = document.createElement('div');
      recipeLine.className = 'sel-sub';
      recipeLine.textContent = `Receta: ${info.recipeInputs.map((r) => r.name).join(' + ')}`;
      el.appendChild(recipeLine);

      if (info.recipeInputs.length > 1) {
        for (const row of info.recipeInputs) {
          const sideLine = document.createElement('div');
          sideLine.className = 'sel-sub';
          const wrong = info.waitingWrong && row.count === 0;
          sideLine.textContent =
            `${row.name} ← ${row.sideLabel} ${row.count}/${row.cap}${row.full ? ' · llena' : ''}${wrong ? ' · esperando' : ''}`;
          el.appendChild(sideLine);
        }
      }

      const stateLine = document.createElement('div');
      stateLine.className = 'sel-state';
      stateLine.textContent = `Estado: ${info.recipeState || '—'}`;
      el.appendChild(stateLine);

      const outLine = document.createElement('div');
      outLine.className = 'sel-sub';
      outLine.textContent = `Salida: ${info.outputBuffer?.count ?? 0}/${info.outputBuffer?.cap ?? 0}`;
      el.appendChild(outLine);

      if (info.recipeInputs.length === 1) {
        for (const row of info.recipeInputs) {
          const inputLine = document.createElement('div');
          inputLine.className = 'sel-sub';
          inputLine.textContent = `${row.name}: ${row.count}/${row.cap}${row.full ? ' · llena' : ''}`;
          el.appendChild(inputLine);
        }
      }

      if (info.recipeHint) {
        const hint = document.createElement('div');
        hint.className = 'sel-hint';
        hint.textContent = info.recipeHint;
        el.appendChild(hint);
      }
    }
    if (info.siloInfo) {
      const s = info.siloInfo;
      const stateLine = document.createElement('div');
      stateLine.className = 'sel-state';
      stateLine.textContent = `Estado: ${s.state}`;
      el.appendChild(stateLine);

      const capLine = document.createElement('div');
      capLine.className = 'sel-sub';
      capLine.textContent = `Capacidad: ${s.stored}/${s.cap} · ritmo 1 cada ${(s.intervalMs / 1000).toFixed(1)}s`;
      el.appendChild(capLine);

      if (!s.contents.length) {
        const empty = document.createElement('div');
        empty.className = 'sel-sub';
        empty.textContent = 'Vacío: entra por la trasera.';
        el.appendChild(empty);
      }
      for (const row of s.contents) {
        const line = document.createElement('div');
        line.className = 'sel-sub';
        const jumboTxt = row.jumbo > 0 ? ` (+${row.jumbo} jumbo)` : '';
        line.textContent = `${row.name}: ${row.count}${jumboTxt}`;
        el.appendChild(line);
      }
      if (s.stored >= s.cap) {
        const full = document.createElement('div');
        full.className = 'sel-hint';
        full.textContent = 'Lleno: el excedente espera en la canaleta.';
        el.appendChild(full);
      }
    }
    if (info.fanInfo) {
      // M1.5-G: tier, potencia y alcance actual/máximo con su origen, y qué mueve.
      const f = info.fanInfo;
      const tierLine = document.createElement('div');
      tierLine.className = 'sel-sub';
      tierLine.textContent = `Ventilador tier ${f.tier + 1}`;
      el.appendChild(tierLine);

      const powLine = document.createElement('div');
      powLine.className = 'sel-state';
      powLine.textContent =
        `Potencia ${f.powerPct} % (${f.forceEff.toFixed(2)} de ${f.forceMax.toFixed(2)} máx tier)`;
      el.appendChild(powLine);

      const rangeLine = document.createElement('div');
      rangeLine.className = 'sel-sub';
      const bonusTxt = f.rangeBonus > 0 ? ` (mejora +${f.rangeBonus.toFixed(1)})` : '';
      rangeLine.textContent = f.rangeIsMax
        ? `Alcance máximo ${f.rangeMax.toFixed(1)}${bonusTxt}: sigue la mejora`
        : `Alcance ${f.rangeEff.toFixed(1)} de ${f.rangeMax.toFixed(1)} máx comprado${bonusTxt}`;
      el.appendChild(rangeLine);

      for (const row of f.moves) {
        const line = document.createElement('div');
        line.className = 'sel-sub';
        line.textContent = `${row.ok ? '✓' : '✗'} ${row.name}`;
        el.appendChild(line);
      }

      const powBtn = document.createElement('button');
      powBtn.textContent = 'Potencia (B)';
      powBtn.title = 'Cicla la potencia: 100 → 75 → 50 → 25 % del máximo del tier';
      powBtn.dataset.act = 'fan-power';
      el.appendChild(powBtn);
      const rangeBtn = document.createElement('button');
      rangeBtn.textContent = 'Alcance (N)';
      rangeBtn.title = 'Cicla el alcance: máximo → 1 → 2 → … → máximo';
      rangeBtn.dataset.act = 'fan-range';
      el.appendChild(rangeBtn);
    }
    const actions = document.createElement('div');
    actions.className = 'sel-actions';
    if (info.isSembrador) {
      const b = document.createElement('button');
      b.textContent = 'Emitir';
      b.title = 'Emite 1 choclo gratis (igual que clic en la pieza)';
      b.dataset.act = 'emit';
      actions.appendChild(b);
    }
    if (info.isPausable) {
      const p = document.createElement('button');
      p.className = info.isPaused ? 'danger' : 'success';
      p.textContent = info.isPaused ? '▶ Reanudar' : '⏸ Pausar';
      p.title = info.isPaused ? 'Reanuda el ciclo de la máquina' : 'Pausa el ciclo de la máquina';
      p.dataset.act = 'pause';
      actions.appendChild(p);
    }
    const mv = document.createElement('button');
    mv.textContent = 'Mover';
    mv.dataset.act = 'move';
    actions.appendChild(mv);
    if (info.canUpgradeInPlace) {
      const up = document.createElement('button');
      up.className = 'upgrade';
      up.disabled = !info.canAffordUpgradeInPlace;
      up.textContent = info.canAffordUpgradeInPlace
        ? `Mejorar ${formatMoney(info.upgradeCost)}`
        : `Mejorar ${formatMoney(info.upgradeCost)}`;
      up.title = 'Sube esta construcción al siguiente tier sin demoler/reponer';
      up.dataset.act = 'upgrade';
      actions.appendChild(up);
    }
    const rm = document.createElement('button');
    rm.className = 'danger';
    rm.textContent = `Demoler +${formatMoney(info.refund)}`;
    rm.dataset.act = 'sell';
    const x = document.createElement('button');
    x.textContent = '✕';
    x.title = 'Cerrar';
    x.dataset.act = 'close';
    actions.appendChild(rm);
    actions.appendChild(x);
    el.appendChild(actions);
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
      // M1.5-J1c: muestra "COMBO x1.4 / máx x2" sin cambiar el comportamiento.
      this.el.combo.innerHTML =
        `COMBO x${s.comboMult().toFixed(1)} / máx x${s.comboCap()}` +
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

  toast(text, stayMs = null) {
    const el = document.createElement('div');
    el.className = 'toast';
    el.textContent = text;
    this.el.toasts.appendChild(el);
    while (this.el.toasts.children.length > 4) this.el.toasts.firstChild.remove();
    const out = stayMs == null ? 3200 : stayMs;
    const rem = out + 500;
    setTimeout(() => el.classList.add('out'), out);
    setTimeout(() => el.remove(), rem);
  }
}
