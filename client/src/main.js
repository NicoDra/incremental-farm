// Chanchos S.A. — entrada: cablea sim + render + ui + entrada de usuario
// M1.5-C: sin lanzamiento libre; sembrador manual por clic; mover gratis;
// demolición con reembolso por edad; inicio con sembrador + guía; zona por edad.
import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import {
  HALF_GRID,
  GRID_SIZE,
  LEVELS,
  TOOLS,
  DIRS8,
  DIR_NAMES,
  LEVEL_H,
  CONVERTER_BUFFER_CAP,
  formatMoney,
  toolCost,
  snapRot8,
  upgradeInPlaceCost,
} from 'chanchos-shared';
import { createScene } from './render/scene.js';
import { ParcelRenderer } from './render/parcel.js';
import { ProductRenderer } from './render/products.js';
import { ToolManager } from './render/toolMeshes.js';
import { Fx } from './render/fx.js';
import { GameState, STARTER, isInRect } from './game/state.js';
import { History } from './game/history.js';
import { SimWorld } from './sim/world.js';
import { Hud } from './ui/hud.js';

const TOASTS_ENTREGA = [
  'El Consejo aprueba tu entrega con una palmeta.',
  'Logística Porcina emitió el memorando de felicitación correspondiente.',
  'Un inspector visitó la parcela. No encontró nada. Se fue triste.',
  'Recursos Humanos recomienda más cerditos por hora.',
  'La paloma mensajera pidió aumento. Se lo negaron.',
];

const now = () => performance.now();

function fanAxis3(rot8, pitchDeg) {
  const p = ((pitchDeg || 0) * Math.PI) / 180;
  const d = DIRS8[rot8];
  return { x: d.x * Math.cos(p), y: Math.sin(p), z: d.z * Math.cos(p) };
}

async function boot() {
  await RAPIER.init();

  const canvas = document.getElementById('scene');
  const state = new GameState();
  const sim = new SimWorld();
  const view = createScene(canvas);
  const parcel = new ParcelRenderer(view.scene);
  const productR = new ProductRenderer(view.scene);
  const toolsR = new ToolManager(view.scene);
  const fx = new Fx(view.scene, document.getElementById('floats'), view.camera, view.renderer);

  let mode = null; // null | { type } | 'remove' | 'move-armed' | { moving: snapshot }
  let rot8 = 0; // 0-7 (piezas de 4 dirs usan valores pares)
  let pitchDeg = 0; // ventilador: 0 o 45
  let height = 0; // nivel de construcción 0-2
  let hoverCell = null;
  let selectedKey = null;
  let showAllDirs = false;
  const history = new History(); // Ctrl+Z / Ctrl+Y (place | sell | move)
  let drag = null; // { kind:'place'|'sell', visited:Set, lastErr } mientras se barrre
  let simPaused = false;

  const hud = new Hud(state, {
    onSelectTool: (type) => {
      if (!state.canBuyTool(type)) {
        hud.toast(`Bloqueado por edad. Subí de edad para desbloquear ${TOOLS[type].name}.`);
        return;
      }
      mode = mode && mode.type === type ? null : { type };
      // M1.5-D2: al cambiar de pieza, la rotación hace snap a una orientación
      // válida (solo el fan usa 8 dirs; el resto 90°). Evita diagonales heredadas.
      if (mode && mode.type) rot8 = snapRot8(mode.type, rot8);
      selectedKey = null;
      toolsR.setSelectedKey(null);
      toolsR.clearSelection();
      hud.setMode(mode);
      hud.showSelection(null);
      updateGhost();
      updateConfig();
    },
    onSelectRemove: () => {
      mode = mode === 'remove' ? null : 'remove';
      selectedKey = null;
      toolsR.setSelectedKey(null);
      toolsR.clearSelection();
      hud.setMode(mode);
      hud.showSelection(null);
      updateGhost();
      updateConfig();
    },
    onSelectMove: () => {
      mode = mode && mode.moving ? null : 'move-armed';
      selectedKey = null;
      toolsR.setSelectedKey(null);
      toolsR.clearSelection();
      hud.setMode(mode);
      hud.showSelection(null);
      updateGhost();
      updateConfig();
      if (mode) hud.toast('Mover: clic en una pieza para levantarla (gratis), luego clic en destino.');
    },
    onHeight: (h) => {
      height = h;
      hud.setHeight(h);
      updateGhost();
      updateConfig();
    },
    onLevel: () => tryLevel(),
    onUpgrade: (lineId) => {
      const r = state.applyUpgrade(lineId);
      if (!r.ok) hud.toast(`Mejora no aplicada: ${r.reason}.`);
      else {
        sim.setModifiers(state.simModifiers());
        hud.refresh();
      }
    },
    onToggleDirs: () => toggleDirs(),
    onReset: () => tryReset(),
    onEmitSelected: () => emitSelected(),
    onMoveSelected: () => startMoveFromSelection(),
    onSellSelected: () => sellSelected(),
    onUpgradeSelected: () => upgradeSelectedInPlace(),
    onPauseToggle: () => togglePauseSelected(),
    onSellGround: () => sellAllGround(),
  });
  hud.setHeight(0);

  function toggleDirs() {
    showAllDirs = !showAllDirs;
    toolsR.setShowAllDirs(showAllDirs);
    hud.setDirsToggle(showAllDirs);
  }

  function updateConfig() {
    const dirName = DIR_NAMES[rot8];
    let piece = '—';
    if (mode && mode.type) piece = TOOLS[mode.type].name;
    else if (mode === 'remove') piece = `Demoler (devuelve ${Math.round(state.refundRate() * 100)}%)`;
    else if (mode === 'move-armed') piece = 'Mover (gratis)';
    else if (mode && mode.moving) piece = `Moviendo ${TOOLS[mode.moving.type].name} (gratis)`;
    hud.setConfig(`Pieza: ${piece} · Frente: ${dirName} · Altura: N${height} · Vent: ${pitchDeg}°`);
    // M1.5-D: mientras se coloca/demuele, el clic izquierdo barre celdas en vez
    // de girar la cámara (girar: arrastre derecho, medio o WASD).
    const building = Boolean(mode && mode.type) || mode === 'remove';
    view.controls.mouseButtons.LEFT = building ? null : THREE.MOUSE.ROTATE;
  }
  updateConfig();

  // ---- callbacks de la simulación ----

  // M1.5-B/C: el 4º param meta (jumbo×2, multiplicadores) es obligatorio.
  sim.onDeliver = (kind, pos, nowMs, meta) => {
    const res = state.registerDelivery(kind, nowMs, meta);
    fx.burst(pos.x, 1, pos.z, 0xf2c94c);
    fx.float(
      pos.x,
      1.2,
      pos.z,
      `+${formatMoney(res.value)}${res.mult > 1 ? ' x' + res.mult.toFixed(1) : ''}`,
      'gold',
      res.value,
      res.mult,
    );
    hud.pulseMoney();
    hud.hideGuide();
    if (state.delivered % 8 === 0) {
      hud.toast(TOASTS_ENTREGA[Math.floor(Math.random() * TOASTS_ENTREGA.length)]);
    }
  };

  sim.onRecycle = (kind, pos) => {
    const value = state.recycleValue(kind);
    state.addMoney(value);
    fx.float(pos.x, pos.y + 0.5, pos.z, `+${formatMoney(value)} reciclado`, 'gray', value);
    hud.toast('El Chango Nocturno recogió stock dormido. Cobró comisión.');
  };

  sim.onLost = (kind, pos) => {
    fx.float(pos.x, 1, pos.z, 'Producto extraviado', 'red');
  };

  // ---- acciones ----

  function tryLevel() {
    const before = state.level;
    if (!state.buyLevel()) return;
    parcel.applyLevel(state.level);
    parcel.setAllowedRect(state.allowedRect());
    toolsR.setAge(state.level);
    toolsR.setFanTier(state.fanTier());
    sim.setFanTier(state.fanTier());
    sim.setModifiers(state.simModifiers());
    hud.toast(LEVELS[state.level].slogan);
    if (before === 0 && state.level >= 1) {
      hud.toast('El reembolso por demoler baja al 75% desde Madera.');
    }
    fx.burst(0, 1.5, 0, 0xf2a2b0);
    hud.refresh();
    updateConfig();
  }

  function canPlace(type, i, j, h) {
    const def = TOOLS[type];
    if (!def) return false;
    if (!state.canBuyTool(type)) return false;
    if (!isInRect(i, j, state.allowedRect())) return false;
    // M1.5-D4: el fan vive en cualquier nivel (0/1/2) y respeta celda ocupada.
    if (type === 'fan') {
      if (h < 0 || h > 2) return false;
      if (sim.tools.has(sim.key(i, j, h))) return false;
      if (h === 0 && sim.baseBlocked(i, j)) return false;
      return true;
    }
    if (def.kind === 'channel') {
      if (sim.tools.has(sim.key(i, j, h))) return false;
      if (def.minH && h < def.minH) return false;
      if (h === 0 && sim.baseBlocked(i, j)) return false;
      return true;
    }
    if (h !== 0) return false;
    return !sim.baseBlocked(i, j);
  }

  function placeFree(snapshot, i, j, h) {
    // Coloca sin costo (modo mover o sembrador inicial). Retorna true si ok.
    if (!canPlace(snapshot.type, i, j, h)) return false;
    const t = now();
    const ok = sim.placeTool(snapshot.type, i, j, h, snapshot.rot8, snapshot.pitchDeg, t, {
      fanTier: snapshot.fanTier ?? state.fanTier(),
      age: snapshot.age ?? state.level,
      noAutoConnect: Boolean(snapshot.noAutoConnect),
    });
    if (!ok) return false;
    toolsR.add(snapshot.type, i, j, h, snapshot.rot8, snapshot.pitchDeg, {
      fanTier: snapshot.fanTier ?? state.fanTier(),
      age: snapshot.age ?? state.level,
      noAutoConnect: Boolean(snapshot.noAutoConnect),
    });
    return true;
  }

  // Devuelve '' si colocó o la razón del fallo. opts.quiet: sin toast (barrido).
  function tryPlace(type, cell, opts = {}) {
    const fail = (msg) => {
      if (!opts.quiet) hud.toast(msg);
      return msg;
    };
    if (!state.canBuyTool(type)) {
      return fail(`Bloqueado por edad. Subí de edad para desbloquear ${TOOLS[type].name}.`);
    }
    if (!isInRect(cell.i, cell.j, state.allowedRect())) {
      return fail('Zona bloqueada: subí de edad para ampliar la parcela.');
    }
    if (!canPlace(type, cell.i, cell.j, height)) {
      return fail(
        type === 'rampa' && height < 1
          ? 'La rampa necesita altura N1 o N2 (baja un nivel).'
          : 'Celda ocupada o altura inválida. La gerencia reprueba.',
      );
    }
    const paid = state.toolPrice(type);
    if (!state.buyTool(type)) {
      return fail('Fondos insuficientes. Finanzas sugiere vender más choclos.');
    }
    // M1.5-D4: Shift = pieza con aperturas SOLO por defecto (escape manual).
    const noAutoConnect = Boolean(opts.noAutoConnect);
    sim.placeTool(type, cell.i, cell.j, height, rot8, pitchDeg, now(), {
      fanTier: state.fanTier(),
      age: state.level,
      noAutoConnect,
    });
    toolsR.add(type, cell.i, cell.j, height, rot8, pitchDeg, {
      fanTier: state.fanTier(),
      age: state.level,
      noAutoConnect,
    });
    sim.setModifiers(state.simModifiers());
    history.record({
      kind: 'place',
      at: { i: cell.i, j: cell.j, h: height },
      tool: { type, rot8, pitchDeg, fanTier: state.fanTier(), age: state.level, noAutoConnect },
      paid,
    });
    if (noAutoConnect && !opts.quiet) hud.toast('Pieza colocada sin conexiones automáticas (Shift).');
    updateGhost();
    return '';
  }

  function findAtCell(cell) {
    if (sim.tools.has(sim.key(cell.i, cell.j, height))) {
      return { i: cell.i, j: cell.j, h: height };
    }
    for (let h = 2; h >= 0; h--) {
      if (sim.tools.has(sim.key(cell.i, cell.j, h))) return { i: cell.i, j: cell.j, h };
    }
    return null;
  }

  function entryInfo(entry) {
    const def = TOOLS[entry.type];
    const ownedBefore = state.owned[entry.type] || 1;
    const refund = Math.floor(toolCost(entry.type, Math.max(0, ownedBefore - 1)) * state.refundRate());
    const ageTier = entry.age ?? 0;
    const fanTier = entry.fanTier ?? 0;
    const canUpgradeInPlace =
      ageTier < state.level || (entry.type === 'fan' && fanTier < state.fanTier());
    const upgradeCost = canUpgradeInPlace
      ? upgradeInPlaceCost(entry.type, state.owned[entry.type], state.refundRate())
      : 0;
    const isPausable = def.kind === 'producer' || def.kind === 'converter';
    return {
      key: sim.key(entry.i, entry.j, entry.h),
      type: entry.type,
      name: def.name,
      hint: def.hint,
      dir: DIR_NAMES[entry.rot8],
      h: entry.h,
      isSembrador: entry.type === 'sembrador',
      refund,
      refundPct: Math.round(state.refundRate() * 100),
      ageTier,
      fanTier,
      canUpgradeInPlace,
      upgradeCost,
      canAffordUpgradeInPlace: canUpgradeInPlace && state.money >= upgradeCost,
      isPausable,
      isPaused: Boolean(entry.paused),
    };
  }

  function setSelectionFromEntry(entry) {
    if (!entry) {
      selectedKey = null;
      toolsR.setSelectedKey(null);
      toolsR.clearSelection();
      hud.showSelection(null);
      return;
    }
    const key = sim.key(entry.i, entry.j, entry.h);
    selectedKey = key;
    const c = sim.cellCenter(entry.i, entry.j);
    toolsR.setSelectedKey(key);
    toolsR.selectAt(c.x, entry.h * LEVEL_H, c.z);
    if (entry.type === 'fan') {
      toolsR.showSelectionCone(c.x, sim.fanParams(entry).origin.y, c.z, sim.fanAxis(entry));
    }
    const info = entryInfo(entry);
    hud.showSelection(info);
    if (!mode) hud.focusUpgradesForTool(entry.type, info);
  }

  function trySell(cell) {
    const found = findAtCell(cell);
    if (!found) return;
    sellAt(found);
  }

  function sellAt(found) {
    const key = sim.key(found.i, found.j, found.h);
    const entry = sim.tools.get(key);
    if (!entry) return;
    const snap = {
      type: entry.type,
      rot8: entry.rot8,
      pitchDeg: entry.pitchDeg,
      fanTier: entry.fanTier,
      age: entry.age,
    };
    const refund = state.sellTool(entry.type);
    sim.removeTool(found.i, found.j, found.h);
    toolsR.remove(found.i, found.j, found.h);
    if (selectedKey === key) {
      selectedKey = null;
      toolsR.setSelectedKey(null);
      toolsR.clearSelection();
      hud.showSelection(null);
    }
    sim.setModifiers(state.simModifiers());
    history.record({
      kind: 'sell',
      at: { i: found.i, j: found.j, h: found.h },
      tool: snap,
      refund,
    });
    const c = sim.cellCenter(found.i, found.j);
    fx.float(c.x, found.h * LEVEL_H + 0.8, c.z, `+${formatMoney(refund)}`, 'gray', refund);
  }

  function sellSelected() {
    if (!selectedKey) return;
    const entry = sim.tools.get(selectedKey);
    if (!entry) return;
    sellAt({ i: entry.i, j: entry.j, h: entry.h });
    mode = null;
    hud.setMode(null);
    updateGhost();
    updateConfig();
  }

  function upgradeSelectedInPlace() {
    if (!selectedKey) return;
    const entry = sim.tools.get(selectedKey);
    if (!entry) return;
    const curAge = entry.age ?? 0;
    const curFanTier = entry.fanTier ?? state.fanTier();
    const nextAge = Math.min(state.level, curAge + 1);
    const nextFanTier =
      entry.type === 'fan' ? Math.min(state.fanTier(), curFanTier + 1) : curFanTier;
    if (nextAge === curAge && nextFanTier === curFanTier) {
      hud.toast('Esa construcción ya está en su tier máximo para esta edad.');
      return;
    }
    const cost = upgradeInPlaceCost(entry.type, state.owned[entry.type], state.refundRate());
    if (state.money < cost) {
      hud.toast(`Fondos insuficientes para mejorar in-place (${formatMoney(cost)}).`);
      return;
    }

    const snap = {
      type: entry.type,
      i: entry.i,
      j: entry.j,
      h: entry.h,
      rot8: entry.rot8,
      pitchDeg: entry.pitchDeg,
      age: curAge,
      fanTier: curFanTier,
      noAutoConnect: Boolean(entry.noAutoConnect),
    };

    state.addMoney(-cost);
    sim.removeTool(snap.i, snap.j, snap.h);
    toolsR.remove(snap.i, snap.j, snap.h);
    const ok = sim.placeTool(
      snap.type,
      snap.i,
      snap.j,
      snap.h,
      snap.rot8,
      snap.pitchDeg,
      now(),
      { fanTier: nextFanTier, age: nextAge, noAutoConnect: snap.noAutoConnect },
    );
    if (!ok) {
      sim.placeTool(snap.type, snap.i, snap.j, snap.h, snap.rot8, snap.pitchDeg, now(), {
        fanTier: snap.fanTier,
        age: snap.age,
        noAutoConnect: snap.noAutoConnect,
      });
      toolsR.add(snap.type, snap.i, snap.j, snap.h, snap.rot8, snap.pitchDeg, {
        fanTier: snap.fanTier,
        age: snap.age,
        noAutoConnect: snap.noAutoConnect,
      });
      state.addMoney(cost);
      hud.toast('No se pudo aplicar la mejora in-place.');
      return;
    }
    toolsR.add(snap.type, snap.i, snap.j, snap.h, snap.rot8, snap.pitchDeg, {
      fanTier: nextFanTier,
      age: nextAge,
      noAutoConnect: snap.noAutoConnect,
    });
    sim.setModifiers(state.simModifiers());
    const fresh = sim.tools.get(sim.key(snap.i, snap.j, snap.h));
    setSelectionFromEntry(fresh);
    hud.toast(`Mejora aplicada in-place por ${formatMoney(cost)}.`);
  }

  function togglePauseSelected() {
    if (!selectedKey) return;
    const entry = sim.tools.get(selectedKey);
    if (!entry) return;
    const def = TOOLS[entry.type];
    if (def.kind !== 'producer' && def.kind !== 'converter') return;
    entry.paused = !entry.paused;
    setSelectionFromEntry(entry);
    hud.toast(entry.paused ? `${def.name} PAUSADO.` : `${def.name} REANUDADO.`);
  }

  // ---- M1.5-D: deshacer/rehacer (Ctrl+Z / Ctrl+Y) ----

  // Coloca sin cobrar (usado por deshacer de venta y mover inverso).
  function placeLike(tool, at) {
    if (!canPlace(tool.type, at.i, at.j, at.h)) return false;
    const noAutoConnect = Boolean(tool.noAutoConnect);
    const ok = sim.placeTool(tool.type, at.i, at.j, at.h, tool.rot8, tool.pitchDeg, now(), {
      fanTier: tool.fanTier,
      age: tool.age,
      noAutoConnect,
    });
    if (!ok) return false;
    toolsR.add(tool.type, at.i, at.j, at.h, tool.rot8, tool.pitchDeg, {
      fanTier: tool.fanTier,
      age: tool.age,
      noAutoConnect,
    });
    sim.setModifiers(state.simModifiers());
    return true;
  }

  // Quita una pieza; null si no está o (wantType) es de otro tipo.
  function removeLike(at, wantType) {
    const key = sim.key(at.i, at.j, at.h);
    const entry = sim.tools.get(key);
    if (!entry) return null;
    if (wantType && entry.type !== wantType) return null;
    sim.removeTool(at.i, at.j, at.h);
    toolsR.remove(at.i, at.j, at.h);
    if (selectedKey === key) {
      selectedKey = null;
      toolsR.setSelectedKey(null);
      toolsR.clearSelection();
      hud.showSelection(null);
    }
    return entry;
  }

  function afterHistoryOp() {
    sim.setModifiers(state.simModifiers());
    updateGhost();
    updateConfig();
  }

  function undoAction() {
    const a = history.peekUndo();
    if (!a) {
      hud.toast('Nada para deshacer.');
      return;
    }
    if (a.kind === 'place') {
      if (!removeLike(a.at, a.tool.type)) {
        history.dropUndo();
        hud.toast('No se puede deshacer: esa celda cambió.');
        return;
      }
      history.undo();
      state.owned[a.tool.type] = Math.max(0, (state.owned[a.tool.type] || 0) - 1);
      state.addMoney(a.paid);
    } else if (a.kind === 'sell') {
      const key = sim.key(a.at.i, a.at.j, a.at.h);
      if (sim.tools.has(key) || !placeLike(a.tool, a.at)) {
        history.dropUndo();
        hud.toast('No se puede deshacer: esa celda cambió.');
        return;
      }
      history.undo();
      state.owned[a.tool.type] = (state.owned[a.tool.type] || 0) + 1;
      state.addMoney(-a.refund); // puede dejar saldo negativo: así no hay truco
    } else if (a.kind === 'move') {
      const back = removeLike(a.to, a.tool.type);
      if (!back || sim.tools.has(sim.key(a.from.i, a.from.j, a.from.h)) || !placeLike(a.tool, a.from)) {
        if (back) placeLike(a.tool, a.to); // devuelve lo que se levantó
        history.dropUndo();
        hud.toast('No se puede deshacer ese mover.');
        return;
      }
      history.undo();
    }
    afterHistoryOp();
    hud.toast('Última acción deshecha.');
  }

  function redoAction() {
    const a = history.peekRedo();
    if (!a) {
      hud.toast('Nada para rehacer.');
      return;
    }
    if (a.kind === 'place') {
      if (!canPlace(a.tool.type, a.at.i, a.at.j, a.at.h)) {
        history.dropRedo();
        hud.toast('No se puede rehacer: esa celda cambió.');
        return;
      }
      const paid = state.toolPrice(a.tool.type);
      if (!state.buyTool(a.tool.type)) {
        history.dropRedo();
        hud.toast('Fondos insuficientes para rehacer.');
        return;
      }
      if (!placeLike(a.tool, a.at)) {
        state.owned[a.tool.type] = Math.max(0, (state.owned[a.tool.type] || 0) - 1);
        state.addMoney(paid);
        history.dropRedo();
        hud.toast('No se puede rehacer: esa celda cambió.');
        return;
      }
      a.paid = paid;
      history.redo();
    } else if (a.kind === 'sell') {
      if (!removeLike(a.at, a.tool.type)) {
        history.dropRedo();
        hud.toast('No se puede rehacer: esa celda cambió.');
        return;
      }
      a.refund = state.sellTool(a.tool.type);
      history.redo();
    } else if (a.kind === 'move') {
      const lift = removeLike(a.from, a.tool.type);
      if (!lift || sim.tools.has(sim.key(a.to.i, a.to.j, a.to.h)) || !placeLike(a.tool, a.to)) {
        if (lift) placeLike(a.tool, a.from);
        history.dropRedo();
        hud.toast('No se puede rehacer ese mover.');
        return;
      }
      history.redo();
    }
    afterHistoryOp();
    hud.toast('Acción rehecha.');
  }

  // I: copia el tipo/orientación de la pieza apuntada al modo de colocación.
  function dropper() {
    const found = selectedKey ? sim.tools.get(selectedKey) : hoverCell ? findAtCell(hoverCell) : null;
    const entry = found && sim.tools.get(sim.key(found.i, found.j, found.h));
    if (!entry) {
      hud.toast('Apuntá a una pieza para copiarla (I).');
      return;
    }
    mode = { type: entry.type };
    rot8 = entry.rot8;
    pitchDeg = entry.pitchDeg || 0;
    selectedKey = null;
    toolsR.setSelectedKey(null);
    toolsR.clearSelection();
    hud.showSelection(null);
    hud.setMode(mode);
    updateGhost();
    updateConfig();
    hud.toast(`Copiando: ${TOOLS[entry.type].name} (frente ${DIR_NAMES[rot8]}).`);
  }

  // M1.5-C: mover siempre gratis. Levanta la pieza (sin vender) y la re-coloca.
  function liftForMove(found) {
    const key = sim.key(found.i, found.j, found.h);
    const entry = sim.tools.get(key);
    if (!entry) return null;
    const snapshot = {
      type: entry.type,
      rot8: entry.rot8,
      pitchDeg: entry.pitchDeg,
      fanTier: entry.fanTier,
      age: entry.age,
      noAutoConnect: Boolean(entry.noAutoConnect),
      fromKey: key,
      from: { i: found.i, j: found.j, h: found.h },
    };
    sim.removeTool(found.i, found.j, found.h);
    toolsR.remove(found.i, found.j, found.h);
    selectedKey = null;
    toolsR.setSelectedKey(null);
    toolsR.clearSelection();
    hud.showSelection(null);
    return snapshot;
  }

  function cancelMoveRestore() {
    if (mode && mode.moving) {
      const mv = mode.moving;
      placeFree(mv, mv.from.i, mv.from.j, mv.from.h);
    }
    mode = null;
    hud.setMode(null);
    updateGhost();
    updateConfig();
  }

  function startMoveFromSelection() {
    if (!selectedKey) return;
    const entry = sim.tools.get(selectedKey);
    if (!entry) return;
    const snapshot = liftForMove({ i: entry.i, j: entry.j, h: entry.h });
    if (!snapshot) return;
    mode = { moving: snapshot };
    rot8 = snapshot.rot8;
    pitchDeg = snapshot.pitchDeg || 0;
    height = snapshot.from.h;
    hud.setHeight(height);
    hud.setMode(mode);
    updateGhost();
    updateConfig();
    hud.toast('Pieza levantada (gratis). Clic en destino para re-colocar, clic derecho para devolver.');
  }

  // M1.5-D2: R sobre pieza colocada la re-orienta (endereza diagonales).
  function rotatePlacedEntry(entry) {
    const step = entry.type === 'fan' ? 1 : 2;
    const nr =
      entry.type !== 'fan' && entry.rot8 % 2 !== 0
        ? snapRot8(entry.type, entry.rot8)
        : (entry.rot8 + step) % 8;
    const { type, i, j, h, pitchDeg, fanTier, age } = entry;
    const noAutoConnect = Boolean(entry.noAutoConnect);
    sim.removeTool(i, j, h);
    toolsR.remove(i, j, h);
    sim.placeTool(type, i, j, h, nr, pitchDeg, now(), { fanTier, age, noAutoConnect });
    toolsR.add(type, i, j, h, nr, pitchDeg, { fanTier, age, noAutoConnect });
    rot8 = nr;
    const key = sim.key(i, j, h);
    selectedKey = key;
    const ne = sim.tools.get(key);
    toolsR.setSelectedKey(key);
    const c = sim.cellCenter(i, j);
    toolsR.selectAt(c.x, h * LEVEL_H, c.z);
    if (type === 'fan') toolsR.showSelectionCone(c.x, sim.fanParams(ne).origin.y, c.z, sim.fanAxis(ne));
    hud.showSelection(entryInfo(ne));
    sim.setModifiers(state.simModifiers());
    updateConfig();
  }

  // M1.5-D2: migración de piezas inválidas existentes a 90° (sim + render).
  function migrateAllRotations() {
    let fixed = 0;
    for (const e of [...sim.tools.values()]) {
      const want = snapRot8(e.type, e.rot8);
      if (want === e.rot8) continue;
      const { type, i, j, h, pitchDeg, fanTier, age } = e;
      const noAutoConnect = Boolean(e.noAutoConnect);
      sim.removeTool(i, j, h);
      toolsR.remove(i, j, h);
      sim.placeTool(type, i, j, h, want, pitchDeg, now(), { fanTier, age, noAutoConnect });
      toolsR.add(type, i, j, h, want, pitchDeg, { fanTier, age, noAutoConnect });
      fixed++;
    }
    if (fixed) hud.toast(`Se enderezaron ${fixed} piezas en diagonal. La gerencia respira.`);
    return fixed;
  }

  function emitSelected() {
    if (!selectedKey) return;
    const entry = sim.tools.get(selectedKey);
    if (!entry || entry.type !== 'sembrador') return;
    const p = sim.triggerManual(entry.i, entry.j, entry.h, now());
    if (p) hud.toast('Sembrador 3000 emitió 1 choclo. Sin costo, como todo lo bueno.');
    else hud.toast('Sembrador recargando… (enfriamiento breve).');
  }

  function setDebugAge(age) {
    const a = Math.max(0, Math.min(3, Number(age) || 0));
    state.level = a;
    parcel.applyLevel(state.level);
    parcel.setAllowedRect(state.allowedRect());
    toolsR.setAge(state.level);
    toolsR.setFanTier(state.fanTier());
    sim.setFanTier(state.fanTier());
    sim.setModifiers(state.simModifiers());
    state.emit();
    updateGhost();
    updateConfig();
  }

  function debugFillSelectedBuffers() {
    if (!selectedKey) return hud.toast('Debug: seleccioná una máquina.');
    const e = sim.tools.get(selectedKey);
    if (!e || TOOLS[e.type]?.kind !== 'converter') return hud.toast('Debug: solo conversores.');
    if (Array.isArray(e.buffer)) {
      while (e.buffer.length < CONVERTER_BUFFER_CAP) {
        e.buffer.push({ timeMs: TOOLS[e.type].time, jumbo: false, fatMult: 1, count: 1 });
      }
    }
    if (e.inputBuffers && typeof e.inputBuffers === 'object') {
      for (const arr of Object.values(e.inputBuffers)) {
        if (!Array.isArray(arr)) continue;
        while (arr.length < CONVERTER_BUFFER_CAP) arr.push({ jumbo: false, fatMult: 1 });
      }
    }
    hud.toast('Debug: buffers llenos.');
  }

  function debugClearSelectedBuffers() {
    if (!selectedKey) return hud.toast('Debug: seleccioná una máquina.');
    const e = sim.tools.get(selectedKey);
    if (!e || TOOLS[e.type]?.kind !== 'converter') return hud.toast('Debug: solo conversores.');
    if (Array.isArray(e.buffer)) e.buffer.length = 0;
    if (e.inputBuffers && typeof e.inputBuffers === 'object') {
      for (const arr of Object.values(e.inputBuffers)) if (Array.isArray(arr)) arr.length = 0;
    }
    hud.toast('Debug: buffers vacíos.');
  }

  function initDebugPanel() {
    if (!import.meta.env.DEV) return;
    const qs = new URLSearchParams(window.location.search);
    if (qs.get('debug') !== '1') return;
    const panel = document.createElement('section');
    panel.id = 'debug-panel';
    panel.innerHTML =
      '<b>DEBUG</b>' +
      '<label>Dinero <input id="dbg-money" type="number" step="1" /></label>' +
      '<button id="dbg-set-money">Fijar dinero</button>' +
      '<label>Edad <input id="dbg-age" type="number" min="0" max="3" step="1" /></label>' +
      '<button id="dbg-set-age">Fijar edad</button>' +
      '<button id="dbg-unlock">Desbloquear todo</button>' +
      '<button id="dbg-fill-buf">Llenar buffers selección</button>' +
      '<button id="dbg-clear-buf">Vaciar buffers selección</button>' +
      '<button id="dbg-pause">Pausar sim</button>';
    document.getElementById('hud').appendChild(panel);
    const $ = (id) => panel.querySelector('#' + id);
    $('dbg-money').value = String(Math.floor(state.money));
    $('dbg-age').value = String(state.level);
    $('dbg-set-money').addEventListener('click', () => {
      const v = Math.max(0, Math.floor(Number($('dbg-money').value) || 0));
      state.money = v;
      state.emit();
      hud.toast(`Debug: dinero = ${formatMoney(v)}`);
    });
    $('dbg-set-age').addEventListener('click', () => {
      setDebugAge($('dbg-age').value);
      hud.toast(`Debug: edad = ${state.ageInfo().name}`);
    });
    $('dbg-unlock').addEventListener('click', () => {
      setDebugAge(3);
      state.money = Math.max(state.money, 999999);
      state.emit();
      $('dbg-age').value = '3';
      $('dbg-money').value = String(Math.floor(state.money));
      hud.toast('Debug: desbloqueado todo.');
    });
    $('dbg-fill-buf').addEventListener('click', () => debugFillSelectedBuffers());
    $('dbg-clear-buf').addEventListener('click', () => debugClearSelectedBuffers());
    $('dbg-pause').addEventListener('click', () => {
      simPaused = !simPaused;
      $('dbg-pause').textContent = simPaused ? 'Reanudar sim' : 'Pausar sim';
      hud.toast(simPaused ? 'Debug: simulación pausada.' : 'Debug: simulación reanudada.');
    });
  }

  // Decisión documentada (M1.5-C §5): clic directo en sembrador EMITE y además
  // lo selecciona. Un clic = emitir + inspeccionar. Si está en enfriamiento,
  // igual selecciona (para no perder la inspección). El panel de selección
  // suma botón "Emitir" para táctil/reintentos.
  function selectAt(cell, emitIfManual = true) {
    const found = findAtCell(cell);
    setSelectionFromEntry(null);
    if (!found) return;
    const key = sim.key(found.i, found.j, found.h);
    const entry = sim.tools.get(key);
    if (!entry) return;
    if (emitIfManual && entry.type === 'sembrador') {
      sim.triggerManual(entry.i, entry.j, entry.h, now());
    }
    setSelectionFromEntry(entry);
  }

  function clearModeAndSelection() {
    mode = null;
    selectedKey = null;
    toolsR.setSelectedKey(null);
    hud.setMode(null);
    toolsR.clearSelection();
    hud.showSelection(null);
    updateGhost();
    updateConfig();
  }

  function runCancelChain() {
    if (hud.isGuideOpen()) {
      hud.hideGuide();
      return true;
    }
    if (mode && mode.moving) {
      cancelMoveRestore();
      return true;
    }
    if (mode || selectedKey) {
      clearModeAndSelection();
      return true;
    }
    if (hud.isDrawerOpen()) {
      hud.closeDrawer();
      return true;
    }
    return false;
  }

  function tryReset() {
    if (!window.confirm('¿Reiniciar parcela? Se pierde todo y se vuelve al inicio (sembrador + portal).')) return;
    for (const key of [...sim.tools.keys()]) {
      const e = sim.tools.get(key);
      sim.removeTool(e.i, e.j, e.h);
      toolsR.remove(e.i, e.j, e.h);
    }
    state.resetProgress();
    history.clear();
    mode = null;
    selectedKey = null;
    toolsR.setSelectedKey(null);
    toolsR.clearSelection();
    toolsR.setAge(0);
    toolsR.setFanTier(state.fanTier());
    sim.setFanTier(state.fanTier());
    sim.setModifiers(state.simModifiers());
    parcel.applyLevel(0);
    parcel.setAllowedRect(state.allowedRect());
    placeStarter();
    hud.setMode(null);
    hud.showSelection(null);
    hud.refresh();
    updateGhost();
    updateConfig();
    hud.showGuide();
    hud.toast('Demoler devuelve el 100% en esta edad.');
  }

  function placeStarter() {
    const t = now();
    sim.placeTool(STARTER.type, STARTER.i, STARTER.j, STARTER.h, STARTER.rot8, STARTER.pitchDeg, t, {
      fanTier: state.fanTier(),
      age: 0,
    });
    toolsR.add(STARTER.type, STARTER.i, STARTER.j, STARTER.h, STARTER.rot8, STARTER.pitchDeg, {
      fanTier: state.fanTier(),
      age: 0,
    });
    state.owned[STARTER.type] = Math.max(1, state.owned[STARTER.type] || 0);
  }

  // ---- inicio M1.5-C: 1 sembrador + portal (puerta norte del depósito) ----
  parcel.setAllowedRect(state.allowedRect());
  placeStarter();
  migrateAllRotations();
  sim.setFanTier(state.fanTier());
  sim.setModifiers(state.simModifiers());
  hud.refresh();
  hud.showGuide();
  hud.toast('Demoler devuelve el 100% en esta edad.');
  hud.setDirsToggle(false);
  initDebugPanel();

  // ---- entrada de usuario ----

  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const pickPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const hitPoint = new THREE.Vector3();

  function pickCell(e) {
    pointer.set((e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1);
    raycaster.setFromCamera(pointer, view.camera);
    if (!raycaster.ray.intersectPlane(pickPlane, hitPoint)) return null;
    const i = Math.floor(hitPoint.x + HALF_GRID);
    const j = Math.floor(hitPoint.z + HALF_GRID);
    if (i < 0 || i >= GRID_SIZE || j < 0 || j >= GRID_SIZE) return null;
    return { i, j };
  }

  function updateGhost() {
    if (!mode || mode === 'remove' || mode === 'move-armed' || !hoverCell) {
      toolsR.showGhost(null);
      return;
    }
    const type = mode.type || (mode.moving && mode.moving.type);
    if (!type) {
      toolsR.showGhost(null);
      return;
    }
    const r8 = mode.moving ? mode.moving.rot8 : rot8;
    const pd = mode.moving ? mode.moving.pitchDeg : pitchDeg;
    const h = mode.moving ? height : height;
    const ok = canPlace(type, hoverCell.i, hoverCell.j, h);
    const affordable = mode.moving ? true : state.money >= state.toolPrice(type);
    const axis = type === 'fan' ? fanAxis3(r8, pd) : null;
    toolsR.showGhost(type, r8, pd, hoverCell, h, ok && affordable, axis);
  }

  let downInfo = null;

  // Barrido con clic sostenido: colocar/demoler una celda nueva por frame.
  function dragStep(e) {
    if (!drag) return;
    if (drag.kind === 'place' && !(mode && mode.type)) {
      drag = null;
      return;
    }
    if (drag.kind === 'sell' && mode !== 'remove') {
      drag = null;
      return;
    }
    const cell = pickCell(e);
    if (!cell) return;
    const k = cell.i + ',' + cell.j + ',' + height;
    if (drag.visited.has(k)) return;
    drag.visited.add(k);
    if (drag.kind === 'place') {
      const err = tryPlace(mode.type, cell, { quiet: true, noAutoConnect: e.shiftKey });
      if (err && err !== drag.lastErr) {
        hud.toast(err);
        drag.lastErr = err;
      }
    } else {
      trySell(cell);
    }
  }

  canvas.addEventListener('pointerdown', (e) => {
    downInfo = { x: e.clientX, y: e.clientY, btn: e.button };
    if (e.button !== 0) return;
    const kind = mode && mode.type ? 'place' : mode === 'remove' ? 'sell' : null;
    if (!kind) return;
    drag = { kind, visited: new Set(), lastErr: '' };
    dragStep(e);
  });

  canvas.addEventListener('pointermove', (e) => {
    hoverCell = pickCell(e);
    // flechas al hover de pieza colocada (sin modo activo)
    if (!mode && hoverCell) {
      const found = findAtCell(hoverCell);
      toolsR.setHoverKey(found ? sim.key(found.i, found.j, found.h) : null);
    } else {
      toolsR.setHoverKey(null);
    }
    if (drag && e.buttons & 1) dragStep(e);
    updateGhost();
  });

  // Clic con mano vacía en producto suelto (fuera de canaleta): lo vende al
  // precio de reciclado. Limpieza del suelo sin esperar a que desaparezca.
  function tryCollectGround(e) {
    pointer.set((e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1);
    raycaster.setFromCamera(pointer, view.camera);
    if (!raycaster.ray.intersectPlane(pickPlane, hitPoint)) return false;
    const idx = sim.groundProductAt(hitPoint.x, hitPoint.z);
    if (idx < 0) return false;
    const p = sim.products[idx];
    const t = p.body.translation();
    const value = state.recycleValue(p.kind, { jumbo: p.jumbo, fatMult: p.fatMult });
    sim.removeProduct(idx);
    state.addMoney(value);
    fx.float(t.x, Math.max(t.y, 0.5) + 0.5, t.z, `+${formatMoney(value)} venta suelta`, 'gray', value);
    hud.pulseMoney();
    return true;
  }

  function sellAllGround() {
    let sold = 0;
    let total = 0;
    for (let idx = sim.products.length - 1; idx >= 0; idx--) {
      const p = sim.products[idx];
      const t = p.body.translation();
      const value = state.recycleValue(p.kind, { jumbo: p.jumbo, fatMult: p.fatMult });
      sim.removeProduct(idx);
      sold++;
      total += value;
      fx.float(t.x, Math.max(t.y, 0.5) + 0.4, t.z, `+${formatMoney(value)} venta suelta`, 'gray', value);
    }
    if (!sold) {
      hud.toast('No hay producto suelto para vender.');
      return;
    }
    state.addMoney(total);
    hud.pulseMoney();
    hud.toast(`Vendidos ${sold} sueltos por ${formatMoney(total)}.`);
  }

  canvas.addEventListener('pointerup', (e) => {
    if (!downInfo) return;
    const moved = Math.hypot(e.clientX - downInfo.x, e.clientY - downInfo.y);
    const wasLeft = downInfo.btn === 0;
    downInfo = null;
    // La acción del clic ya se hizo en pointerdown/drag: no repetir en pointerup.
    if (wasLeft && drag) {
      drag = null;
      return;
    }
    if (moved > 6) return; // fue arrastre de cámara
    if (!wasLeft) {
      runCancelChain();
      return;
    }
    if (!hoverCell) return;
    if (mode === 'remove') trySell(hoverCell);
    else if (mode === 'move-armed') {
      const found = findAtCell(hoverCell);
      if (!found) {
        hud.toast('Clic en una pieza para moverla (es gratis).');
        return;
      }
      const snapshot = liftForMove(found);
      if (!snapshot) return;
      mode = { moving: snapshot };
      rot8 = snapshot.rot8;
      pitchDeg = snapshot.pitchDeg || 0;
      height = snapshot.from.h;
      hud.setHeight(height);
      hud.setMode(mode);
      updateGhost();
      updateConfig();
      hud.toast('Pieza levantada (gratis). Clic en destino para re-colocar.');
    } else if (mode && mode.moving) {
      const mv = mode.moving;
      if (!isInRect(hoverCell.i, hoverCell.j, state.allowedRect())) {
        hud.toast('Zona bloqueada: subí de edad para ampliar la parcela.');
        return;
      }
      if (!placeFree(mv, hoverCell.i, hoverCell.j, height)) {
        hud.toast('Destino ocupado o inválido. La pieza sigue levantada.');
        return;
      }
      history.record({
        kind: 'move',
        from: mv.from,
        to: { i: hoverCell.i, j: hoverCell.j, h: height },
        tool: { type: mv.type, rot8: mv.rot8, pitchDeg: mv.pitchDeg, fanTier: mv.fanTier, age: mv.age },
      });
      mode = null;
      hud.setMode(null);
      updateGhost();
      updateConfig();
      hud.toast('Pieza re-colocada sin costo. Gerencia aplaude.');
    } else if (mode) tryPlace(mode.type, hoverCell, { noAutoConnect: e.shiftKey });
    else if (!tryCollectGround(e)) selectAt(hoverCell);
  });

  canvas.addEventListener('contextmenu', (e) => e.preventDefault());

  function selectHotbar(idx) {
    const type = hud.hotbarOrder[idx];
    if (type) hud.cb.onSelectTool(type);
  }

  const camKeys = new Set();
  const CAM_SETS = {
    w: 'fwd',
    arrowup: 'fwd',
    s: 'back',
    arrowdown: 'back',
    a: 'left',
    arrowleft: 'left',
    d: 'right',
    arrowright: 'right',
  };
  const camDir = new THREE.Vector3();
  const camFwd = new THREE.Vector3();
  const camRight = new THREE.Vector3();
  const CAM_UP = new THREE.Vector3(0, 1, 0);

  function updateCamera(dt) {
    if (!camKeys.size) return;
    view.camera.getWorldDirection(camFwd);
    camFwd.y = 0;
    if (camFwd.lengthSq() < 1e-6) camFwd.set(0, 0, -1);
    else camFwd.normalize();
    camRight.crossVectors(camFwd, CAM_UP);
    camDir.set(0, 0, 0);
    for (const k of camKeys) {
      const which = CAM_SETS[k];
      if (which === 'fwd') camDir.add(camFwd);
      else if (which === 'back') camDir.sub(camFwd);
      else if (which === 'left') camDir.sub(camRight);
      else if (which === 'right') camDir.add(camRight);
    }
    if (!camDir.lengthSq()) return;
    camDir.normalize().multiplyScalar(9 * dt);
    view.camera.position.add(camDir);
    view.controls.target.add(camDir);
  }

  window.addEventListener('keydown', (e) => {
    const lk = e.key.toLowerCase();
    // Ctrl+Z / Ctrl+Y: deshacer y rehacer (place | sell | move).
    if ((e.ctrlKey || e.metaKey) && lk === 'z') {
      e.preventDefault();
      if (e.shiftKey) redoAction();
      else undoAction();
      return;
    }
    if ((e.ctrlKey || e.metaKey) && lk === 'y') {
      e.preventDefault();
      redoAction();
      return;
    }
    // M1.5-D2: el tutorial se cierra con clic, Enter o Espacio (y no bloquea
    // el resto: es solo un banner; el canvas sigue recibiendo eventos).
    if ((e.key === 'Enter' || e.key === ' ') && hud.isGuideOpen()) {
      e.preventDefault();
      hud.hideGuide();
      return;
    }
    // Cámara: WASD o flechas (solo cuando no hay modificador del navegador).
    if (!e.ctrlKey && !e.metaKey && !e.altKey && CAM_SETS[lk]) {
      camKeys.add(lk);
      if (lk.startsWith('arrow')) e.preventDefault();
    }
    if (e.key >= '1' && e.key <= '9') {
      selectHotbar(Number(e.key) - 1);
    } else if (e.key === 'r' || e.key === 'R') {
      const selEntry = !mode && selectedKey ? sim.tools.get(selectedKey) : null;
      if (selEntry) rotatePlacedEntry(selEntry);
      else {
        const t = mode && (mode.type || (mode.moving && mode.moving.type));
        // M1.5-D2: R primero endereza (snap) una orientación inválida, sin rotar.
        if (t && t !== 'fan' && rot8 % 2 !== 0) rot8 = snapRot8(t, rot8);
        else if (t === 'fan') rot8 = (rot8 + 1) % 8;
        else rot8 = (rot8 + 2) % 8;
        if (mode && mode.moving) mode.moving.rot8 = rot8;
        updateGhost();
        updateConfig();
      }
    } else if (e.key === 'f' || e.key === 'F') {
      pitchDeg = pitchDeg === 0 ? 45 : 0;
      if (mode && mode.moving) mode.moving.pitchDeg = pitchDeg;
      updateGhost();
      updateConfig();
    } else if (e.key === 'h' || e.key === 'H') {
      height = (height + 1) % 3;
      hud.setHeight(height);
      updateGhost();
      updateConfig();
    } else if (e.key === 'g' || e.key === 'G') {
      toggleDirs();
    } else if (e.key === 'e' || e.key === 'E') {
      hud.toggleDrawer();
    } else if (e.key === 'x' || e.key === 'X') {
      hud.cb.onSelectRemove();
    } else if (e.key === 'm' || e.key === 'M') {
      hud.cb.onSelectMove();
    } else if (e.key === '[') {
      height = Math.max(0, height - 1);
      hud.setHeight(height);
      updateGhost();
      updateConfig();
    } else if (e.key === ']') {
      height = Math.min(2, height + 1);
      hud.setHeight(height);
      updateGhost();
      updateConfig();
    } else if (lk === 'i') {
      dropper();
    } else if (lk === 'p') {
      if (hud.isGuideOpen()) hud.hideGuide();
      else hud.showGuide();
    } else if (e.key === 'Escape') {
      if (runCancelChain()) e.preventDefault();
    }
  });

  window.addEventListener('keyup', (e) => {
    camKeys.delete(e.key.toLowerCase());
  });

  window.addEventListener('blur', () => {
    camKeys.clear();
    drag = null;
  });

  // ---- bucle principal ----

  const STEP = 1 / 60;
  let last = now();
  let acc = 0;

  function frame() {
    requestAnimationFrame(frame);
    const t = now();
    let dt = (t - last) / 1000;
    last = t;
    dt = Math.min(dt, 0.1);
    acc += dt;
    let steps = 0;
    while (acc >= STEP && steps < 3) {
      if (!simPaused) sim.step(STEP, t);
      acc -= STEP;
      steps++;
    }
    if (steps === 3) acc = 0;

    updateCamera(dt);
    view.controls.update();
    productR.sync(sim.products);
    toolsR.update(t, sim.tools, t);
    fx.update(dt, t);
    hud.update(t);
    view.renderer.render(view.scene, view.camera);
  }
  frame();
}

boot().catch((err) => {
  console.error('Chanchos S.A. no pudo arrancar:', err);
  const el = document.createElement('div');
  el.style.cssText =
    'position:fixed;inset:20% 10%;background:#fff8e7;border:3px solid #2b1e14;border-radius:12px;padding:24px;font-family:sans-serif;z-index:99;';
  el.textContent = 'Error al iniciar: ' + err.message;
  document.body.appendChild(el);
});
