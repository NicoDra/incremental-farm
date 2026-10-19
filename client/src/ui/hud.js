// Chanchos S.A. — HUD M1.5-D: barra mínima + cajón con pestaña "Construir"
// (menú agrupado por categoría, reemplaza la hotbar) + selección.
// Lee todo de GameState (no duplica reglas): canBuyTool, toolPrice, upgrade*,
// nextAgePreview, refundRate, allowedRect.
import { TOOLS, TOOL_ORDER, TOOL_CATEGORIES, UPGRADE_LINES, PRODUCTS, AGE_GOALS, COMBO_MAX_BY_AGE, LEVELS, ageInfo, toolUnlockAge, formatMoney } from 'chanchos-shared';
import { TOOL_LABELS, ageProgress, upgradeReason } from './presentation.js';
import { reconcileChildren } from './dom.js';

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
        inspect: byId('inspect-panel'),
      },
      heights: byId('height-sel'),
      cfg: byId('cfg'),
      toasts: byId('toasts'),
      guide: byId('guide'),
      sel: byId('sel-panel'),
      btnHelp: byId('btn-help'),
      btnMore: byId('btn-more'),
      globalMenu: byId('global-menu'),
      actSellGround: byId('act-sell-ground'),
      actReset: byId('act-reset'),
      actDirs: byId('act-dirs'),
      btnDrawer: byId('btn-drawer'),
      btnInspect: byId('btn-inspect'),
      heading: byId('drawer-heading'),
      objective: byId('objective'),
      objectiveTitle: byId('objective-title'),
      objectiveSummary: byId('objective-summary'),
      objectiveProgress: byId('objective-progress'),
      contextHelp: byId('context-help'),
      liquidationInfo: byId('liquidation-info'),
    };
    // Orden estable = TOOL_ORDER; atajos 1-9 + 0 (décima).
    this.hotbarOrder = TOOL_ORDER.slice();
    this.height = 0;
    this.activeTab = 'build';
    this.scrollPositions = new Map();
    this.buildFilter = 'all';
    this.buildQuery = '';
    this.showLocked = false;
    this.mode = null;
    this.selectionInfo = null;
    this.upgradeFocusType = null;
    this.upgradeFocusInfo = null;
    this._guideTimer = null;
    this.buildToolMoveBtn = null;
    this.buildToolRemoveBtn = null;
    this.buildHeightButtons();
    this.buildBuildCards();
    this.buildEraOverlay();
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
    this.el.btnDrawer.addEventListener('click', () => this.toggleDrawer('build'));
    this.el.objective.addEventListener('click', () => this.openDrawer('age'));
    this.el.btnInspect.addEventListener('click', () => this.openDrawer('inspect'));
    this.el.panels.age.addEventListener('click', (event) => {
      const button = event.target?.closest?.('.age-buy');
      if (button && !button.disabled) this.cb.onLevel?.();
    });
    byId('btn-close-drawer').addEventListener('click', () => this.closeDrawer());
    this.el.drawerTabs.forEach((t) =>
      t.addEventListener('click', () => {
        this.openDrawer(t.dataset.tab);
      }),
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
      else if (act === 'global-upgrades') this.focusUpgradesForTool(this.selectionInfo?.type, this.selectionInfo);
      else if (act === 'rotate') this.cb.onRotate?.();
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

  // M1.5-E: overlay de transición de época. No bloquea los controles (solo la
  // tarjeta captura clics); se cierra solo o al hacer clic / Esc.
  buildEraOverlay() {
    const mk = (cls, tag) => {
      const n = document.createElement(tag || 'div');
      n.className = cls;
      return n;
    };
    const el = document.createElement('div');
    el.id = 'era-transition';
    el.className = 'hidden';
    const card = mk('era-card');
    const tagEl = mk('era-tag', 'span');
    const title = mk('era-title', 'h2');
    const slogan = mk('era-slogan', 'p');
    const hint = mk('era-hint', 'span');
    hint.textContent = 'clic o Esc para continuar';
    card.appendChild(tagEl);
    card.appendChild(title);
    card.appendChild(slogan);
    card.appendChild(hint);
    el.appendChild(card);
    (byId('hud') || document.body).appendChild(el);
    this.eraEl = el;
    this.eraCard = card;
    this.eraTag = tagEl;
    this.eraTitle = title;
    this.eraSlogan = slogan;
    this._eraTimer = null;
    this._eraHideTimer = null;
    this._eraEsc = (e) => {
      if (e.key === 'Escape' && !this.eraEl.classList.contains('hidden')) {
        this.hideEraTransition();
      }
    };
    card.addEventListener('click', () => this.hideEraTransition());
  }

  showEraTransition(level, opts = {}) {
    if (!this.eraEl || !this.eraTitle) return;
    const lvl = Math.max(0, Math.min(Number(level) || 0, LEVELS.length - 1));
    const L = LEVELS[lvl] || LEVELS[0];
    this.eraTag.textContent = `ÉPOCA ${lvl}`;
    this.eraTitle.textContent = L.name;
    this.eraSlogan.textContent = L.slogan || '';
    clearTimeout(this._eraTimer);
    clearTimeout(this._eraHideTimer);
    this.eraEl.classList.remove('hidden', 'out');
    void this.eraEl.offsetWidth; // reinicia la animación de entrada
    this.eraEl.classList.add('show');
    const dur = opts.short ? 900 : 3000;
    this._eraTimer = setTimeout(() => this.hideEraTransition(), dur);
    document.addEventListener?.('keydown', this._eraEsc);
  }

  hideEraTransition() {
    if (!this.eraEl || this.eraEl.classList.contains('hidden')) return;
    clearTimeout(this._eraTimer);
    clearTimeout(this._eraHideTimer);
    this.eraEl.classList.remove('show');
    this.eraEl.classList.add('out');
    document.removeEventListener?.('keydown', this._eraEsc);
    this._eraHideTimer = setTimeout(() => {
      this.eraEl.classList.add('hidden');
      this.eraEl.classList.remove('out');
    }, 450);
  }

  // ---- pestaña Construir (menú agrupado; reemplaza la hotbar) ----

  buildBuildCards() {
    this.cards = new Map();
    this.cardViews = new Map();
    this.buildGroups = [];
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
    const context = document.createElement('div');
    context.className = 'build-context hidden';
    this.buildContext = context;
    const heightLabel = document.createElement('span');
    heightLabel.textContent = 'Colocar en';
    context.appendChild(heightLabel);
    context.appendChild(this.el.heights);
    this.rotateBuildBtn = document.createElement('button');
    this.rotateBuildBtn.className = 'tool-mode';
    this.rotateBuildBtn.textContent = 'Rotar (R)';
    this.rotateBuildBtn.addEventListener('click', () => this.cb.onRotate?.());
    context.appendChild(this.rotateBuildBtn);
    const cancel = document.createElement('button');
    cancel.className = 'tool-mode';
    cancel.textContent = 'Cancelar (Esc)';
    cancel.addEventListener('click', () => this.cb.onCancel?.());
    context.appendChild(cancel);
    toolsBox.appendChild(context);
    const filters = document.createElement('div');
    filters.className = 'build-filters';
    const search = document.createElement('input');
    search.id = 'build-search';
    search.type = 'search';
    search.placeholder = 'Buscar pieza…';
    search.setAttribute?.('aria-label', 'Buscar pieza');
    search.addEventListener('input', () => { this.buildQuery = search.value.trim().toLocaleLowerCase(); this.filterBuildCards(); });
    search.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && search.value) {
        search.value = ''; this.buildQuery = ''; this.filterBuildCards();
        event.preventDefault(); event.stopPropagation();
      }
    });
    const category = document.createElement('select');
    category.id = 'build-category';
    category.setAttribute?.('aria-label', 'Categoría de construcción');
    for (const cat of [{ id: 'all', name: 'Todas las categorías' }, ...TOOL_CATEGORIES]) {
      const option = document.createElement('option'); option.value = cat.id; option.textContent = cat.name; category.appendChild(option);
    }
    category.addEventListener('change', () => { this.buildFilter = category.value; this.filterBuildCards(); });
    const lockedLabel = document.createElement('label');
    lockedLabel.className = 'locked-filter';
    const locked = document.createElement('input'); locked.type = 'checkbox'; locked.id = 'show-locked';
    locked.addEventListener('change', () => { this.showLocked = locked.checked; this.filterBuildCards(); });
    const lockedText = document.createElement('span'); lockedText.textContent = 'Ver piezas bloqueadas';
    lockedLabel.appendChild(locked); lockedLabel.appendChild(lockedText);
    filters.appendChild(search); filters.appendChild(category); filters.appendChild(lockedLabel);
    toolsBox.appendChild(filters);
    this.buildEmpty = document.createElement('p'); this.buildEmpty.className = 'panel-intro'; toolsBox.appendChild(this.buildEmpty);
    sec.appendChild(toolsBox);
    this.buildToolMoveBtn = mv;
    this.buildToolRemoveBtn = rm;

    for (const cat of TOOL_CATEGORIES) {
      const wrap = document.createElement('div');
      wrap.className = 'build-group';
      const head = document.createElement('h4');
      head.textContent = cat.name;
      wrap.appendChild(head);
      this.buildGroups.push({ el: wrap, category: cat });
      const grid = document.createElement('div');
      grid.className = 'build-grid';
      for (const type of cat.tools) {
        const keyIdx = this.hotbarOrder.indexOf(type);
        const key = keyIdx < 9 ? String(keyIdx + 1) : '0';
        const hasShortcut = keyIdx >= 0 && keyIdx < 10;
        const b = document.createElement('button');
        b.className = 'slot';
        b.dataset.type = type;
        b.innerHTML =
          `<span class="slot-key${hasShortcut ? '' : ' hidden'}">${hasShortcut ? key : ''}</span>` +
          `<span class="slot-icon" data-icon="${type}">${ICONS[type] || '?'}</span>` +
          `<span class="slot-owned" data-owned="${type}"></span>`;
        const name = document.createElement('span'); name.className = 'slot-name'; name.textContent = TOOL_LABELS[type] || TOOLS[type].name;
        const price = document.createElement('span'); price.className = 'slot-price';
        b.appendChild(name); b.appendChild(price);
        b.setAttribute?.('aria-label', TOOLS[type].name);
        b.addEventListener('click', () => this.cb.onSelectTool(type));
        grid.appendChild(b);
        this.cards.set(type, b);
        this.cardViews.set(type, { name, price, category: cat.id });
      }
      wrap.appendChild(grid);
      sec.appendChild(wrap);
    }
    this.refreshTooltips();
    this.filterBuildCards();
  }

  filterBuildCards() {
    for (const [type, card] of this.cards) {
      const locked = !this.state.canBuyTool(type);
      const view = this.cardViews.get(type);
      const searchable = `${type} ${TOOLS[type].name} ${TOOL_LABELS[type]} ${TOOLS[type].hint}`
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase();
      const query = this.buildQuery.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      const matches = !query || searchable.includes(query);
      const visible = (!locked || this.showLocked) && matches && (this.buildFilter === 'all' || view.category === this.buildFilter);
      card.classList.toggle('hidden', !visible);
      card.setAttribute?.('aria-disabled', String(locked));
      view.price.textContent = locked ? `Desde ${ageInfo(toolUnlockAge(type)).name}` : formatMoney(this.state.toolPrice(type));
    }
    for (const { el, category } of this.buildGroups) {
      el.classList.toggle('hidden', !category.tools.some((type) => !this.cards.get(type)?.classList.contains('hidden')));
    }
    this.buildEmpty.textContent = [...this.cards.values()].some((card) => !card.classList.contains('hidden'))
      ? '' : 'No hay piezas con ese filtro. Probá otra categoría o activá «Ver piezas bloqueadas».';
  }

  buildHeightButtons() {
    this.heightBtns = [];
    for (let h = 0; h <= 2; h++) {
      const b = document.createElement('button');
      b.className = 'height-btn' + (h === 0 ? ' selected' : '');
      b.textContent = h === 0 ? 'Suelo · N0' : `Nivel ${h} · N${h}`;
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
    this.mode = mode;
    this.buildContext?.classList.toggle('hidden', !mode || !mode.type && !mode.moving);
    if (mode && this.activeTab !== 'build') this.openDrawer('build');
    if (this.rotateBuildBtn) this.rotateBuildBtn.disabled = !mode || mode === 'remove' || mode === 'move-armed';
    this.el.contextHelp.textContent = mode ? 'R: rotar · H: altura · Arrastrar: colocar en serie · Esc: cancelar' : 'Rueda: zoom · WASD: cámara · P: ayuda';
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
    this.el.btnMore.setAttribute?.('aria-expanded', String(!this.el.globalMenu.classList.contains('hidden')));
    if (!this.el.globalMenu.classList.contains('hidden')) this.refreshLiquidationPreview();
  }

  hideGlobalMenu() {
    this.el.globalMenu.classList.add('hidden');
    this.el.btnMore.setAttribute?.('aria-expanded', 'false');
  }

  refreshLiquidationPreview() {
    const preview = this.cb.getLiquidationPreview?.();
    if (!preview) return;
    this.el.actSellGround.disabled = preview.count === 0 || preview.remaining > 0;
    if (preview.count === 0) {
      this.el.actSellGround.textContent = 'Sin productos sueltos para liquidar';
    } else if (preview.remaining > 0) {
      this.el.actSellGround.textContent = `Liquidar · disponible en ${preview.remaining}s`;
    } else {
      const noun = preview.count === 1 ? '1 producto' : `${preview.count} productos`;
      this.el.actSellGround.textContent = `Liquidar ${noun} · ${formatMoney(preview.value)}`;
    }
    this.el.liquidationInfo.textContent = `Paga ${Math.round(preview.rate * 100)}% del valor base. Reduce el combo y no suma entregas.`;
  }

  // ---- cajón lateral (un panel por vez, cerrado por defecto) ----

  isDrawerOpen() {
    return !this.el.drawer.classList.contains('hidden');
  }

  openDrawer(tab = 'build') {
    if (tab === 'inspect' && !this.selectionInfo) tab = 'build';
    this.scrollPositions.set(this.activeTab, this.el.panels[this.activeTab]?.scrollTop || 0);
    this.activeTab = tab;
    this.el.drawer.classList.remove('hidden');
    this.el.drawerTabs.forEach((t) => t.classList.toggle('selected', t.dataset.tab === tab));
    for (const [k, sec] of Object.entries(this.el.panels)) {
      sec.classList.toggle('hidden', k !== tab);
    }
    this.renderDrawerTab(tab);
    if (this.el.panels[tab]) this.el.panels[tab].scrollTop = this.scrollPositions.get(tab) || 0;
    this.el.heading.textContent = { build: 'Construir', up: 'Mejoras globales', age: 'Próxima época', inspect: 'Esta pieza' }[tab];
    this.el.btnInspect.classList.toggle('selected', tab === 'inspect');
    this.el.btnDrawer.setAttribute?.('aria-expanded', 'true');
    this.el.drawerTabs.forEach((t) => t.setAttribute?.('aria-pressed', String(t.dataset.tab === tab)));
  }

  closeDrawer() {
    this.el.drawer.classList.add('hidden');
    this.el.btnDrawer.setAttribute?.('aria-expanded', 'false');
  }

  toggleDrawer(tab) {
    if (!this.isDrawerOpen()) this.openDrawer(tab || this.activeTab);
    else if (tab && tab !== this.activeTab) this.openDrawer(tab);
    else this.closeDrawer();
  }

  renderDrawerTab(tab) {
    if (tab === 'up') this.renderUpgrades();
    else if (tab === 'age') this.renderAge();
    else if (tab === 'build') this.refreshTooltips();
  }

  renderUpgrades() {
    const s = this.state;
    const sec = this.el.panels.up;
    if (!this.upgradeRows) {
      sec.innerHTML = '';
      this.upgradeRows = new Map();
      const intro = document.createElement('p'); intro.className = 'panel-intro';
      intro.textContent = 'Estas compras afectan a todas las máquinas del tipo, incluidas las nuevas. Las ranuras se comparten en toda la granja.';
      sec.appendChild(intro);
      this.upgradeSlots = document.createElement('p'); this.upgradeSlots.className = 'slots-line'; sec.appendChild(this.upgradeSlots);
      const filterLabel = document.createElement('label'); filterLabel.className = 'upgrade-filter'; filterLabel.textContent = 'Tipo de mejora';
      this.upgradeFilter = document.createElement('select'); this.upgradeFilter.id = 'upgrade-filter';
      const scopes = [...new Set(Object.values(UPGRADE_LINES).map((def) => def.obj))];
      for (const obj of ['all', ...scopes]) {
        const option = document.createElement('option'); option.value = obj;
        option.textContent = obj === 'all' ? 'Todos los tipos' : obj === 'portal' ? 'Granero' : TOOL_LABELS[obj] || obj;
        this.upgradeFilter.appendChild(option);
      }
      this.upgradeFilter.addEventListener('change', () => {
        this.upgradeFocusType = this.upgradeFilter.value === 'all' ? null : this.upgradeFilter.value;
        this.renderUpgrades();
        sec.scrollTop = 0;
      });
      filterLabel.appendChild(this.upgradeFilter); sec.appendChild(filterLabel);
      for (const id of Object.keys(UPGRADE_LINES)) {
        const row = document.createElement('div'); row.className = 'up-row'; row.dataset.upgrade = id;
        const scope = document.createElement('span'); scope.className = 'up-scope';
        const name = document.createElement('strong'); name.className = 'up-name';
        const desc = document.createElement('span'); desc.className = 'up-desc';
        const btn = document.createElement('button'); btn.className = 'up-buy'; btn.dataset.upgradeBuy = id;
        btn.addEventListener('click', () => this.cb.onUpgrade(id));
        const reason = document.createElement('span'); reason.className = 'up-reason';
        for (const node of [scope, name, desc, btn, reason]) row.appendChild(node);
        sec.appendChild(row); this.upgradeRows.set(id, { row, scope, name, desc, btn, reason });
      }
      this.upgradeEmpty = document.createElement('p'); this.upgradeEmpty.className = 'panel-intro'; sec.appendChild(this.upgradeEmpty);
    }
    this.upgradeSlots.textContent = `Ranuras compartidas: ${s.usedUpgradeSlots()}/${s.totalUpgradeSlots()} usadas`;
    const onlyObj = this.upgradeFocusType === 'portal' ? 'portal' : this.mapToolToUpgradeObj(this.upgradeFocusType);
    this.upgradeFilter.value = onlyObj && onlyObj !== '__none__' ? onlyObj : 'all';
    let visible = 0;
    for (const [id, view] of this.upgradeRows) {
      const def = s.upgradeDef(id);
      const matches = (!onlyObj || onlyObj === def.obj) && (s.level === undefined || def.age <= s.level);
      view.row.classList.toggle('hidden', !matches);
      if (!matches) continue;
      visible++;
      view.scope.textContent = def.obj === 'portal' ? 'Todas las entregas al granero' : `Todas las máquinas: ${TOOL_LABELS[def.obj] || def.obj}`;
      view.name.textContent = `${def.name.replace('Portal:', 'Granero:')} · ${s.upgradeLevel(id)}/${def.max}`;
      view.desc.textContent = def.desc;
      view.btn.textContent = `Comprar ${formatMoney(s.upgradePrice(id))}`;
      view.btn.disabled = !s.canApplyUpgrade(id).ok;
      view.reason.textContent = upgradeReason(s, id);
    }
    this.upgradeEmpty.textContent = visible ? '' : 'Este tipo no tiene mejoras globales disponibles en tu época.';
  }

  mapToolToUpgradeObj(type) {
    if (!type) return null;
    if (type === 'fan') return 'fan';
    if (type === 'sembrador') return 'sembrador';
    if (type === 'corral') return 'corral';
    if (type === 'palomitera') return 'palomitera';
    if (type === 'jamonera') return 'jamonera';
    if (type === 'jamonera_industrial') return 'jamonera';
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
    const target = this.el.panels.age;
    const sec = document.createElement('div');
    const cur = document.createElement('p');
    cur.className = 'age-cur';
    cur.textContent = `Edad actual: ${s.ageInfo().name} (x${s.levelInfo.mult} ingresos)`;
    sec.appendChild(cur);
    const prev = s.nextAgePreview();
    if (!prev) {
      const p = document.createElement('p');
      p.textContent = 'Edad máxima. Chanchos S.A. al 100%.';
      sec.appendChild(p);
      reconcileChildren(target, sec);
      return;
    }
    const box = document.createElement('div');
    box.className = 'age-next';
    const tools = prev.tools.length
      ? prev.tools.map((t) => t.name).join(', ')
      : 'sin herramientas nuevas';
    const prods = prev.products.map((p) => p.name).join(', ');
    box.innerHTML = `<p><b>Siguiente: ${prev.name}</b></p>`;
    const unlocks = document.createElement('details');
    unlocks.className = 'age-unlocks';
    unlocks.innerHTML = '<summary>Qué cambia al avanzar</summary>' +
      `<p>${prev.slogan}</p>` +
      `<p>Desbloquea: ${tools}</p>` +
      `<p>Productos: ${prods} · Ventilador tier ${prev.fanTier + 1} · x${prev.mult} ingresos</p>` +
      `<p>Combo máximo en la próxima edad: x${s.level + 1 < 4 ? COMBO_MAX_BY_AGE[s.level + 1] : COMBO_MAX_BY_AGE[3]}.</p>`;
    const moneyLine = document.createElement('p'); moneyLine.className = 'age-money';
    moneyLine.textContent = `Dinero: ${formatMoney(Math.min(s.money, prev.cost))} / ${formatMoney(prev.cost)}${s.money >= prev.cost ? ' ✓' : ''}`;
    box.appendChild(moneyLine);
    // M1.5-J1: metas de entrega por producto (solo portal).
    const goal = prev.goal;
    if (goal && goal.length) {
      const list = document.createElement('div');
      list.className = 'sel-sub';
      for (const g of goal) {
        // El progreso visual tiene tope; el total real sigue disponible para
        // calibrar el desfase entre requisitos económicos y de productos.
        const have = Math.min(s.deliveredKinds?.[g.kind] || 0, g.count);
        const done = have >= g.count;
        const cell = document.createElement('div');
        cell.className = 'sel-sub';
        cell.textContent = `${PRODUCTS[g.kind].name}: ${have}/${g.count}${done ? ' ✓' : ''}`;
        cell.title = `Entregas reales: ${s.deliveredKinds?.[g.kind] || 0}. Requisito: ${g.count}.`;
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
      ? `Avanzar de época · ${formatMoney(prev.cost)}`
      : s.money < prev.cost ? `Te faltan ${formatMoney(prev.cost - s.money)}` : 'Faltan entregas al granero';
    btn.title = 'Necesitás cumplir dinero y entregas a la vez. Liquidar no suma entregas.';
    box.appendChild(btn);
    box.appendChild(unlocks);
    sec.appendChild(box);
    reconcileChildren(target, sec);
  }

  refreshObjective() {
    const progress = ageProgress(this.state);
    if (!progress) {
      this.el.objective.classList.remove('ready');
      this.el.objectiveTitle.textContent = 'Época final';
      this.el.objectiveSummary.textContent = 'Tu granja llegó a Fábrica';
      this.el.objectiveProgress.value = 1;
      return;
    }
    this.el.objectiveTitle.textContent = progress.ready ? `${progress.name} lista · Ver progreso` : `Próxima época: ${progress.name}`;
    this.el.objectiveSummary.textContent = progress.summary;
    this.el.objectiveProgress.value = progress.progress;
    this.el.objective.classList.toggle('ready', progress.ready);
    this.el.objective.setAttribute?.('aria-label', `${this.el.objectiveTitle.textContent}. ${progress.summary}`);
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
    const target = this.el.sel;
    this.selectionInfo = info;
    this.el.btnInspect.textContent = info ? `Esta pieza: ${TOOL_LABELS[info.type] || info.name}` : 'Esta pieza';
    this.el.btnInspect.classList.toggle('hidden', !info);
    // M1.5-G fix: el frame loop re-llama cada frame; si nada cambió se saltea
    // el rebuild (menos churn de DOM; los clics van por delegación igual).
    if (info) {
      let sig = '';
      try {
        sig = JSON.stringify([info, Math.floor(this.state.money)]);
      } catch {
        sig = String(Math.random());
      }
      if (sig === this._selSig && !target.classList.contains('hidden')) return;
      this._selSig = sig;
    } else {
      this._selSig = null;
    }
    if (!info) {
      this.upgradeFocusInfo = null;
      if (this.isDrawerOpen()) {
        const tab = this.el.drawerTabs.find((t) => t.classList.contains('selected'))?.dataset.tab || 'build';
        if (tab === 'up') this.renderUpgrades();
      }
      target.innerHTML = '';
      target.classList.add('hidden');
      if (this.activeTab === 'inspect') {
        const wasOpen = this.isDrawerOpen();
        this.openDrawer('build');
        if (!wasOpen) this.closeDrawer();
      }
      return;
    }
    target.classList.remove('hidden');
    const el = document.createElement('div');
    const txt = document.createElement('span');
    txt.className = 'sel-txt';
    txt.textContent = info.name;
    el.appendChild(txt);
    const position = document.createElement('p'); position.className = 'sel-sub';
    position.textContent = `Frente ${info.dir} · ${info.h === 0 ? 'Suelo' : `Nivel ${info.h}`} · Material ${ageInfo(info.ageTier || 0).name}`;
    el.appendChild(position);
    if (info.hint && !info.recipeInputs?.length && !info.fanInfo && !info.siloInfo) {
      const hint = document.createElement('p'); hint.className = 'sel-hint'; hint.textContent = info.hint; el.appendChild(hint);
    }
    if (info.isSembrador || (info.isPausable && !info.recipeInputs?.length && !info.siloInfo)) {
      const stateLine = document.createElement('p'); stateLine.className = 'sel-state';
      stateLine.textContent = info.isPaused ? 'Pausada' : info.isManual ? 'Manual · emití choclos o comprá velocidad global para automatizar' : 'Produciendo automáticamente';
      el.appendChild(stateLine);
    }
    if (Array.isArray(info.recipeInputs) && info.recipeInputs.length) {
      const recipeLine = document.createElement('div');
      recipeLine.className = 'sel-sub';
      recipeLine.textContent = `Receta: ${info.recipeInputs.map((r) => r.name).join(' + ')} → ${info.outputName || 'producto'}`;
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
      tierLine.textContent = `Nivel de ventilador ${f.tier + 1}`;
      el.appendChild(tierLine);

      const powLine = document.createElement('div');
      powLine.className = 'sel-state';
      powLine.textContent = `Potencia: ${f.powerPct} % del nivel actual`;
      powLine.title = `Fuerza física: ${f.forceEff.toFixed(2)} de ${f.forceMax.toFixed(2)}`;
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
      b.textContent = 'Emitir choclo';
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
        ? `Actualizar esta pieza · ${formatMoney(info.upgradeCost)}`
        : `Actualizar esta pieza · faltan ${formatMoney(info.upgradeCost - this.state.money)}`;
      up.title = 'Actualiza solo el material o nivel de esta pieza. No consume ranuras de mejoras globales.';
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
    if (this.mapToolToUpgradeObj(info.type) !== '__none__') {
      const global = document.createElement('button'); global.className = 'global-upgrade-link';
      global.textContent = 'Ver mejoras globales de este tipo'; global.dataset.act = 'global-upgrades';
      el.appendChild(global);
    }
    const rotate = document.createElement('button'); rotate.className = 'rotate-piece';
    rotate.textContent = 'Rotar esta pieza (R)'; rotate.dataset.act = 'rotate'; el.appendChild(rotate);
    reconcileChildren(target, el);
  }

  // ---- guía inicial (primer minuto) ----

  isGuideOpen() {
    return !this.el.guide.classList.contains('hidden');
  }

  showGuide() {
    this.el.guide.classList.remove('hidden');
    clearTimeout(this._guideTimer);
    this._guideTimer = setTimeout(() => this.hideGuide(), 60000);
    this.el.btnHelp.setAttribute?.('aria-expanded', 'true');
  }

  hideGuide() {
    this.el.guide.classList.add('hidden');
    clearTimeout(this._guideTimer);
    this.el.btnHelp.setAttribute?.('aria-expanded', 'false');
  }

  // ---- refresco ----

  refresh() {
    const s = this.state;
    this.el.money.textContent = formatMoney(s.money);
    this.el.levelName.textContent = s.levelInfo.name;
    this.el.age.textContent = s.ageInfo().name;
    this.refreshObjective();
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
    this.filterBuildCards();
    if (this.isDrawerOpen()) {
      this.renderDrawerTab(this.activeTab);
    }
  }

  update(nowMs) {
    const s = this.state;
    if (!this.el.globalMenu.classList.contains('hidden')) this.refreshLiquidationPreview();
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
