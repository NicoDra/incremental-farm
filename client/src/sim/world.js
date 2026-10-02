// Chanchos S.A. — mundo físico (Rapier, corre solo en el cliente)
// Movimiento 100% físico: canaletas pasivas + ventiladores por fuerza. Sin cintas.
// M1.5-B: sembrador MANUAL (triggerManual), conversores con boca de entrada
// direccional (solo aceptan por atrás), fan por tier, júmbos, mejoras vía setModifiers.
import RAPIER from '@dimforge/rapier3d-compat';
import {
  HALF_GRID,
  DIRS8,
  MAX_BODIES,
  DELIVERY_Z,
  LEVEL_H,
  FAN,
  FAN_TIERS,
  GROUND_FRICTION,
  PRODUCT_LINEAR_DAMPING,
  PRODUCT_ANGULAR_DAMPING,
  channelSurfaceForAge,
  fanConeParams,
  TOOLS,
  JAM_MS,
  SPEED_LIMIT,
  EMIT_IMPULSE,
  CONVERTER_ACCEPT_SPEED,
  CONVERTER_BUFFER_CAP,
  SILO_CAP,
  SILO_INTERVAL_MS,
  SILO_MOUTH_CLEAR_R,
  CHANNEL_WALL_H,
  JUMBO_SCALE,
  SEMBRADOR_MANUAL_COOLDOWN_MS,
  snapRot8,
  computeLevelOpenings,
  PRODUCT_PHYS,
  FAN_POWER_DEFAULT,
  normalizeFanTune,
  fanMovesProduct,
} from 'chanchos-shared';

const WALL_H = 1.2;
const RAMP_HALF_LEN = 0.707; // la rampa baja exactamente 1 nivel en 1 celda (45°)

// OJO: el yaw de Rapier está espejado respecto de three (Rapier(θ) ≡ three(-θ)).
// Para que física y visual coincidan, acá se usa el signo opuesto al de los meshes.
function yawDeg(rot8) {
  // M1.5-D3 fix: match render (three.js) rotation. Rot8=0 is North (-z), and
  // positive rot8 means clockwise when seen from above.
  return -rot8 * 45;
}

function yawQuatDeg(deg) {
  const r = (deg * Math.PI) / 360;
  return { x: 0, y: Math.sin(r), z: 0, w: Math.cos(r) };
}

// Inclinación de la rampa: yaw(rot8) compuesto con tilt de -45° sobre X local
function rampQuat(rot8) {
  const r = (rot8 * 45 * Math.PI) / 360;
  const cy = Math.cos(r);
  const sy = Math.sin(r);
  const tx = -0.3827; // sin(-22.5°)
  return { x: cy * tx, y: 0.9239 * sy, z: -sy * tx, w: 0.9239 * cy };
}

export function defaultModifiers() {
  return {
    sembradorAuto: false,
    sembradorIntervalMs: 3000,
    sembradorJumboChance: 0,
    sembradorBurstChance: 0,
    palomiteraTimeMs: 1500,
    palomiteraValueMult: 1,
    palomiteraDoubleChance: 0,
    corralTimeMs: 3000,
    corralValueMult: 1,
    corralDoubleChance: 0,
    jamoneraTimeMs: 4000,
    jamoneraValueMult: 1,
    siloCap: SILO_CAP,
    siloIntervalMs: SILO_INTERVAL_MS,
    fanTier: 0,
    fanRangeBonus: 0,
    fanMode: 0, // 0 normal, 1 pulsos, 2 giratorio
  };
}

export class SimWorld {
  constructor() {
    this.world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
    this.world.timestep = 1 / 60;
    this.products = []; // { kind, body, sleepSince, slowSince, jumbo, fatMult }
    this.tools = new Map(); // "i,j,h" -> entry
    this.onDeliver = null; // (kind, pos, nowMs, meta {jumbo, fatMult})
    this.onLost = null; // (kind, pos)
    this.onRecycle = null; // (kind, pos, nowMs, meta)
    this.mods = defaultModifiers();
    this.defaultFanTier = 0;
    this.buildStatic();
  }

  // M1.5-B: la UI (vía state.simModifiers()) inyecta mejoras sin acoplar física a economía.
  setModifiers(m) {
    Object.assign(this.mods, m || {});
  }

  setFanTier(tier) {
    this.defaultFanTier = Math.max(0, Math.min(tier, FAN_TIERS.length - 1));
  }

  // M1.5-F4: capacidad total y ritmo del silo (vienen de mejoras vía setModifiers).
  siloCap() {
    const c = this.mods.siloCap;
    return Number.isFinite(c) && c > 0 ? Math.floor(c) : SILO_CAP;
  }

  siloIntervalMs() {
    const v = this.mods.siloIntervalMs;
    return Number.isFinite(v) && v > 0 ? v : SILO_INTERVAL_MS;
  }

  // M1.5-G: ajuste de potencia/alcance por ventilador. Normaliza a pasos
  // enteros; el alcance se recorta al máximo vigente al usar (fanConeParams).
  getFanTune(entry) {
    const n = normalizeFanTune({ powerPct: entry?.powerPct, rangeCells: entry?.rangeCells });
    return { powerPct: n.powerPct, rangeCells: n.rangeCells };
  }

  setFanTune(entry, tune) {
    if (!entry || entry.type !== 'fan') return null;
    const before = this.getFanTune(entry);
    const n = normalizeFanTune(tune);
    entry.powerPct = n.powerPct;
    entry.rangeCells = n.rangeCells;
    return { before, after: this.getFanTune(entry) };
  }

  siloCount(e) {
    if (!e || !e.siloStore) return 0;
    let n = 0;
    for (const s of Object.values(e.siloStore)) n += s.count || 0;
    return n;
  }

  // Boca de salida libre: ningún cuerpo ocupando el área de aparición.
  mouthClear(e) {
    const m = this.mouthPos(e);
    const r2 = SILO_MOUTH_CLEAR_R * SILO_MOUTH_CLEAR_R;
    for (const p of this.products) {
      const t = p.body.translation();
      if (t.y > e.baseY + 1.0) continue;
      const dx = t.x - m.x;
      const dz = t.z - m.z;
      if (dx * dx + dz * dz < r2) return false;
    }
    return true;
  }

  key(i, j, h) {
    return i + ',' + j + ',' + h;
  }

  cellCenter(i, j) {
    return { x: i - HALF_GRID + 0.5, z: j - HALF_GRID + 0.5 };
  }

  baseBlocked(i, j) {
    for (const e of this.tools.values()) {
      if (e.i === i && e.j === j && e.h === 0) return true;
    }
    return false;
  }

  buildStatic() {
    const W = this.world;
    const floor = W.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(0, -0.25, 0));
    W.createCollider(RAPIER.ColliderDesc.cuboid(HALF_GRID, 0.25, HALF_GRID).setFriction(GROUND_FRICTION), floor);

    const addWall = (cx, cz, hx, hz) => {
      const b = W.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(cx, WALL_H / 2, cz));
      W.createCollider(
        RAPIER.ColliderDesc.cuboid(hx, WALL_H / 2, hz).setRestitution(0.4).setFriction(0.6),
        b,
      );
    };
    const H = HALF_GRID + 0.25;
    addWall(0, H, H, 0.25); // sur
    addWall(H, 0, 0.25, H); // este
    addWall(-H, 0, 0.25, H); // oeste
    // norte con brecha central de 4 celdas (x entre -2 y 2)
    addWall(-5.125, -H, 3.125, 0.25);
    addWall(5.125, -H, 3.125, 0.25);
  }

  spawnProduct(kind, x, y, z, linvel, opts = {}) {
    if (this.products.length >= MAX_BODIES) return null;
    const phys = PRODUCT_PHYS[kind];
    if (!phys) return null;
    const s = opts.jumbo ? JUMBO_SCALE : 1;
    const desc = RAPIER.RigidBodyDesc.dynamic()
      .setTranslation(x, y, z)
      .setLinearDamping(PRODUCT_LINEAR_DAMPING)
      .setAngularDamping(PRODUCT_ANGULAR_DAMPING);
    // M1.5-D4: TODOS los productos con CCD (anti-túnel contra paredes de 0.1).
    desc.setCcdEnabled(true);
    const body = this.world.createRigidBody(desc);
    const col = RAPIER.ColliderDesc.cuboid(phys.half[0] * s, phys.half[1] * s, phys.half[2] * s);
    col
      .setRestitution(phys.restitution)
      .setFriction(0.02) // casi sin fricción: deslizan sin cabecear; el freno lo ponen los pisos
      .setDensity(phys.density);
    this.world.createCollider(col, body);
    if (linvel) body.setLinvel(linvel, true);
    const p = {
      kind,
      body,
      sleepSince: 0,
      slowSince: 0,
      groundIdleSince: 0,
      jumbo: Boolean(opts.jumbo),
      fatMult: opts.fatMult || 1,
    };
    this.products.push(p);
    return p;
  }

  // Acción activa: lanzar un cerdito a mano desde el borde oeste
  // M1.5-B: DEPRECADO (el lanzamiento libre se elimina; queda por compat
  // para el smoke test hasta que el agente UI quite el botón).
  tossPig() {
    const z = -6 + Math.random() * 12;
    const p = this.spawnProduct('pig', -7, 1.7, z, {
      x: 4.6,
      y: 2.4,
      z: (Math.random() - 0.5) * 2,
    });
    if (p) {
      p.body.setAngvel(
        {
          x: (Math.random() - 0.5) * 8,
          y: (Math.random() - 0.5) * 8,
          z: (Math.random() - 0.5) * 8,
        },
        true,
      );
    }
    return p;
  }

  fixedBody(x, y, z, quat) {
    const desc = RAPIER.RigidBodyDesc.fixed().setTranslation(x, y, z);
    if (quat) desc.setRotation(quat);
    return this.world.createRigidBody(desc);
  }

  addBox(body, cx, cy, cz, hx, hy, hz, friction, localYawDeg, restitution = 0) {
    const col = RAPIER.ColliderDesc.cuboid(hx, hy, hz).setFriction(friction);
    col.setTranslation(cx, cy, cz);
    if (localYawDeg) col.setRotation(yawQuatDeg(localYawDeg));
    if (restitution) col.setRestitution(restitution);
    this.world.createCollider(col, body);
    // M1.5-D4 punto 4: inventario para channelColliders (debug/test). Solo se
    // registra en cuerpos de canaleta sin rotar (marco = mundo).
    if (body._chanRec) {
      const bt = body.translation();
      body._chanRec.push({
        x: bt.x + cx,
        y: bt.y + cy,
        z: bt.z + cz,
        hx,
        hy,
        hz,
        yawDeg: localYawDeg || 0,
      });
    }
  }

  // M1.5-D4: las aperturas viven en chanchos-shared (fuente única con render).

  addChannelPerimeterWalls(body, opens, friction) {
    // Pared por encima de la boca de salida (mouthPos y=0.55): un producto
    // emitido nunca queda por encima de la pared.
    const hy = CHANNEL_WALL_H / 2;
    const cy = 0.02 + hy;
    if (!opens.W) this.addBox(body, -0.48, cy, 0, 0.05, hy, 0.5, friction);
    if (!opens.E) this.addBox(body, 0.48, cy, 0, 0.05, hy, 0.5, friction);
    if (!opens.N) this.addBox(body, 0, cy, -0.48, 0.5, hy, 0.05, friction);
    if (!opens.S) this.addBox(body, 0, cy, 0.48, 0.5, hy, 0.05, friction);
  }

  rebuildChannelsAtLevel(h) {
    const pieces = [];
    const channels = [];
    for (const e of this.tools.values()) {
      if (e.h !== h) continue;
      pieces.push(e);
      if (TOOLS[e.type]?.kind !== 'channel') continue;
      if (e.body) this.world.removeRigidBody(e.body);
      e.body = null;
      channels.push(e);
    }
    const openingsByKey = computeLevelOpenings(pieces);

    for (const e of channels) {
      const surf = channelSurfaceForAge(e.age || 0, e.type === 'rebote');
      const friction = surf.friction;
      const restitution = surf.restitution;
      const opens = openingsByKey.get(this.key(e.i, e.j, e.h));
      e.opens = opens; // expuesto para tests (M1.5-D4)
      const c = this.cellCenter(e.i, e.j);
      const baseY = e.h * LEVEL_H;

      if (e.type === 'rampa') {
        const b = this.fixedBody(c.x, baseY - 0.538, c.z, rampQuat(e.rot8));
        this.addBox(b, 0, 0, 0, 0.45, 0.04, RAMP_HALF_LEN, friction, 0, restitution);
        this.addBox(b, -0.46, 0.3, 0, 0.05, 0.3, RAMP_HALF_LEN, friction);
        this.addBox(b, 0.46, 0.3, 0, 0.05, 0.3, RAMP_HALF_LEN, friction);
        e.body = b;
        continue;
      }

      if (e.type === 'puente') {
        const b = this.fixedBody(c.x, baseY, c.z, yawQuatDeg(yawDeg(e.rot8)));
        this.addBox(b, 0, 0.02, 0, 0.5, 0.03, 0.5, friction, 0, restitution);
        this.addBox(b, -0.48, 0.4, 0, 0.05, 0.4, 0.5, friction);
        this.addBox(b, 0.48, 0.4, 0, 0.05, 0.4, 0.5, friction);
        e.body = b;
        continue;
      }

      // M1.5-D3 fix: losa ligeramente POR ENCIMA del suelo global (fic 0.92).
      // Si queda debajo, el producto toca el suelo y la canaleta "no desliza".
      const b = this.fixedBody(c.x, baseY, c.z);
      b._chanRec = []; // inventario para channelColliders (punto 4)
      this.addBox(b, 0, 0.02, 0, 0.5, 0.03, 0.5, friction, 0, restitution);
      this.addChannelPerimeterWalls(b, opens, friction);

      if (e.type === 'curva') {
        // M1.5-D4 punto 4: SIN deflector diagonal. La curva guía por
        // redirección de velocidad (updateCurvas) y sus paredes son solo
        // ortogonales (losa + perímetro). La esquina interior lleva una guía
        // visual en L sin colisionador (ver toolMeshes).
      } else if (e.type === 'union') {
        const yaw = yawDeg(e.rot8);
        const rad = (yaw * Math.PI) / 180;
        const cos = Math.cos(rad);
        const sin = Math.sin(rad);
        const p1x = 0.2 * cos - 0.15 * sin;
        const p1z = 0.2 * sin + 0.15 * cos;
        const p2x = -0.2 * cos - 0.15 * sin;
        const p2z = -0.2 * sin + 0.15 * cos;
        this.addBox(b, p1x, 0.28, p1z, 0.32, 0.25, 0.04, friction, yaw - 45);
        this.addBox(b, p2x, 0.28, p2z, 0.32, 0.25, 0.04, friction, yaw + 45);
      } else if (e.type === 'embudo') {
        const yaw = yawDeg(e.rot8);
        const rad = (yaw * Math.PI) / 180;
        const cos = Math.cos(rad);
        const sin = Math.sin(rad);
        const p1x = -0.36 * cos;
        const p1z = -0.36 * sin;
        const p2x = 0.36 * cos;
        const p2z = 0.36 * sin;
        this.addBox(b, p1x, 0.28, p1z, 0.466, 0.25, 0.05, friction, yaw + 75);
        this.addBox(b, p2x, 0.28, p2z, 0.466, 0.25, 0.05, friction, yaw - 75);
      } else if (e.type === 'divisor') {
        e.lastExit = e.lastExit || 0;
      }

      e.body = b;
      e.colliders = b._chanRec || [];
      b._chanRec = null;
    }
  }

  // M1.5-D4 punto 4: inventario de colisionadores de una canaleta (marco del
  // mundo) para tests. [{x,y,z,hx,hy,hz,yawDeg}]. Solo ramas sin rotar.
  channelColliders(i, j, h) {
    const e = this.tools.get(this.key(i, j, h));
    if (!e || !Array.isArray(e.colliders)) return null;
    return e.colliders;
  }

  placeTool(type, i, j, h, rot8, pitchDeg, nowMs, opts = {}) {
    const key = this.key(i, j, h);
    if (this.tools.has(key)) return false;
    const def = TOOLS[type];
    if (!def) return false;
    // M1.5-D2: invariante de rotación (solo el fan usa 8 dirs). Punto único
    // de colocación: tryPlace, placeFree, starter y migración pasan por acá.
    rot8 = snapRot8(type, rot8);
    // M1.5-D4: el fan se coloca en cualquier nivel (0/1/2); el resto de las
    // piezas no-canaleta sigue solo en el nivel 0 (salvo el silo, M1.5-F4).
    if (type === 'fan' || type === 'silo') {
      if (h < 0 || h > 2) return false;
    } else if (def.kind !== 'channel' && h !== 0) return false;
    if (def.minH && h < def.minH) return false;
    const c = this.cellCenter(i, j);
    const dir = DIRS8[rot8];
    const baseY = h * LEVEL_H;
    const entry = {
      type,
      i,
      j,
      h,
      rot8,
      pitchDeg: pitchDeg || 0,
      dir,
      cx: c.x,
      cz: c.z,
      baseY,
      body: null,
      nextSpawn: nowMs + 1200,
      busyUntil: 0,
      jamUntil: 0,
      coolUntil: 0,
      fanTier: opts.fanTier ?? this.defaultFanTier ?? 0,
      age: opts.age ?? 0,
      // M1.5-G: ajuste por ventilador (default 100 % / máximo). Resto: ignorado.
      powerPct: normalizeFanTune({ powerPct: opts.powerPct }).powerPct ?? FAN_POWER_DEFAULT,
      rangeCells: normalizeFanTune({ rangeCells: opts.rangeCells }).rangeCells ?? null,
      noAutoConnect: Boolean(opts.noAutoConnect), // M1.5-D4: Shift = solo defaults
      pending: false,
      pendingJumbo: false,
      pendingFat: 1,
      pendingCount: 1,
      outputBlocked: false,
      buffer: [],
      inputBuffers: null,
      recipeInputs: null,
      // M1.5-F4: depósito del silo (contadores por tipo, sin cuerpo físico).
      siloStore: null,
      siloOrder: null,
      siloRot: 0,
      siloNext: 0,
      siloBlocked: false,
    };

      if (def.kind === 'channel') {
      entry.body = null;
      entry.lastExit = entry.lastExit || 0;
      } else if (type === 'fan') {
      // mástil en la esquina para no bloquear su propia corriente
      const b = this.fixedBody(c.x, baseY, c.z, yawQuatDeg(yawDeg(rot8)));
      this.addBox(b, 0.35, 0.45, 0.35, 0.1, 0.45, 0.1, 0.5);
      entry.body = b;
      } else if (def.kind === 'producer' || def.kind === 'converter' || def.kind === 'silo') {
        // Cuerpo con boca de SALIDA al frente. La entrada (conversores y silo)
        // es la abertura trasera: el modelo la muestra y la física la exige.
        // M1.5-F4: el silo vive en N0/N1/N2 (como el fan); su cuerpo va a baseY.
        const b = this.fixedBody(c.x, def.kind === 'silo' ? baseY : 0, c.z, yawQuatDeg(yawDeg(rot8)));
        this.addBox(b, 0, 0.4, 0, 0.35, 0.4, 0.35, 0.5);
        // M1.5-D3: ensanchar el hueco de entrada trasero (±0.34 vs ±0.25) para que
        // entren productos JUMBO holgadamente. Receta doble: más ancha aún
        // (±0.44), una boca compartida para los dos ingredientes.
        if (def.kind === 'converter' || def.kind === 'silo') {
          const insForGap = Array.isArray(def.inputs) ? def.inputs : null;
          const wide = insForGap && insForGap.length > 1 ? 0.44 : 0.34;
          this.addBox(b, -wide, 0.4, 0.32, 0.1, 0.4, 0.06, 0.5);
          this.addBox(b, wide, 0.4, 0.32, 0.1, 0.4, 0.06, 0.5);
          this.addBox(b, 0, 0.72, 0.32, 0.35, 0.08, 0.06, 0.5);
          entry.colWiden = Boolean(insForGap && insForGap.length > 1);
        }
        entry.body = b;
        if (def.kind === 'converter') {
          const ins = Array.isArray(def.inputs) ? def.inputs.slice() : [def.input].filter(Boolean);
          entry.recipeInputs = ins;
          // M1.5-F2: entrada única trasera para toda receta (los dos
          // ingredientes entran por atrás; buffers separados por tipo).
          entry.inputDirs = Object.fromEntries(
            ins.map((k) => [k, { x: -entry.dir.x, z: -entry.dir.z }]),
          );
          if (ins.length > 1) {
            entry.inputBuffers = Object.fromEntries(ins.map((k) => [k, []]));
          }
        }
        if (def.kind === 'silo') {
          entry.siloStore = {};
          entry.siloOrder = [];
          entry.siloRot = 0;
          entry.siloNext = nowMs + this.siloIntervalMs();
          entry.siloBlocked = false;
        }
      }

    this.tools.set(key, entry);
    // M1.5-D4: productores/conversores/silo cambian las aperturas de las
    // canaletas vecinas (bocas de salida/entrada), así que también disparan el rebuild.
    if (['channel', 'producer', 'converter', 'silo'].includes(def.kind)) {
      this.rebuildChannelsAtLevel(h);
    }
    return true;
  }

  removeTool(i, j, h) {
    const key = this.key(i, j, h);
    const e = this.tools.get(key);
    if (!e) return null;
    if (e.body) this.world.removeRigidBody(e.body);
    this.tools.delete(key);
    const kind = TOOLS[e.type]?.kind;
    if (['channel', 'producer', 'converter', 'silo'].includes(kind)) {
      this.rebuildChannelsAtLevel(h);
    }
    return e;
  }

  mouthPos(entry) {
    const tier = FAN_TIERS[entry.fanTier] || FAN;
    void tier;
    return {
      x: entry.cx + entry.dir.x * 0.8,
      y: (entry.baseY || 0) + 0.55,
      z: entry.cz + entry.dir.z * 0.8,
    };
  }

  // M1.5-B: emisión manual del sembrador (clic en la pieza).
  // Respeta boca de salida (aparece ahí, sale en esa dirección).
  triggerManual(i, j, h, nowMs) {
    const e = this.tools.get(this.key(i, j, h));
    if (!e || e.type !== 'sembrador') return null;
    if (nowMs < (e.coolUntil || 0)) return null;
    e.coolUntil = nowMs + SEMBRADOR_MANUAL_COOLDOWN_MS;
    return this.emitFrom(e);
  }

  emitFrom(e) {
    const def = TOOLS[e.type];
    const m = this.mouthPos(e);
    const jumbo = e.type === 'sembrador' && Math.random() < (this.mods.sembradorJumboChance || 0);
    const burst = e.type === 'sembrador' && Math.random() < (this.mods.sembradorBurstChance || 0);
    const n = burst ? 3 : 1;
    const clear = 0.18;
    const perp = { x: -e.dir.z, z: e.dir.x };
    let first = null;
    for (let k = 0; k < n; k++) {
      const lateral = (Math.random() - 0.5) * 0.12;
      const p = this.spawnProduct(
        def.product,
        m.x + e.dir.x * clear + perp.x * lateral,
        m.y + k * 0.25,
        m.z + e.dir.z * clear + perp.z * lateral,
        // M1.5-D4: solo impulso horizontal en la dirección de la boca.
        // Sin componente vertical el producto no puede volar por encima de
        // la pared de la canaleta vecina.
        { x: e.dir.x * EMIT_IMPULSE, y: 0, z: e.dir.z * EMIT_IMPULSE },
        { jumbo },
      );
      if (!p && this.products.length >= MAX_BODIES) {
        e.paused = true;
        break;
      }
      if (k === 0) first = p;
    }
    return first;
  }

  step(dt, nowMs) {
    this.world.timestep = dt;
    this.updateProducers(nowMs);
    this.updateConverters(nowMs);
    this.updateSilos(nowMs);
    this.updateDivisors();
    this.updateCurvas();
    this.applyFanForces(dt, nowMs);
    this.world.step();
    this.scanProducts(nowMs);
  }

  // M1.5-D punto 4: la curva guía por redirección (precedente: updateDivisors).
  // Las paredes pasivas ortogonales no pueden girar un producto que desliza
  // sobre un eje; al cruzar el centro viniendo del lado de entrada, se le
  // orienta la velocidad hacia el frente conservando su rapidez (mínimo 1.0
  // para que complete el giro sin trabarse).
  updateCurvas() {
    for (const e of this.tools.values()) {
      if (e.type !== 'curva') continue;
      const q = ((Math.round(e.rot8 / 2) % 4) + 4) % 4;
      const front = DIRS8[(q * 2) % 8];
      const entry = DIRS8[((q + 1) % 4) * 2];
      for (const p of this.products) {
        const t = p.body.translation();
        const dx = t.x - e.cx;
        const dz = t.z - e.cz;
        if (Math.abs(dx) > 0.55 || Math.abs(dz) > 0.55) continue;
        if (Math.abs(t.y - (e.baseY + 0.25)) > 0.7) continue;
        // solo pasado el centro viniendo del lado de entrada
        if (dx * entry.x + dz * entry.z > 0.1) continue;
        const v = p.body.linvel();
        const inward = v.x * -entry.x + v.z * -entry.z;
        if (inward < 0.3) continue;
        const sp = Math.hypot(v.x, v.z);
        const ns = Math.max(sp, 1.0);
        p.body.setLinvel({ x: front.x * ns, y: v.y, z: front.z * ns }, true);
      }
    }
  }

  // M1.5-D: el divisor redirige cada producto entrante hacia la salida activa
  // y alterna E/O. Trabaja en el marco de la pieza (rot8 = 4 direcciones).
  updateDivisors() {
    const keyOf = (t) => {
      const i = Math.floor(t.x + HALF_GRID);
      const j = Math.floor(t.z + HALF_GRID);
      const h = Math.max(0, Math.min(2, Math.round(t.y / LEVEL_H)));
      return this.key(i, j, h);
    };
    for (const p of this.products) p.cellKey = keyOf(p.body.translation());
    for (const e of this.tools.values()) {
      if (e.type !== 'divisor') continue;
      const ek = this.key(e.i, e.j, e.h);
      const dir = e.dir;
      const e1x = -dir.z; // perpendicular: salida alternante
      const e1z = dir.x;
      for (const p of this.products) {
        if (p.cellKey !== ek || p.divDoneKey === ek) continue;
        const t = p.body.translation();
        const v = p.body.linvel();
        const along = v.x * dir.x + v.z * dir.z;
        if (along < 0.3) continue; // no viene de la entrada
        const south = -((t.x - e.cx) * dir.x + (t.z - e.cz) * dir.z);
        if (south < 0.05) continue; // no está en el lado de la entrada
        const sign = e.lastExit === 0 ? 1 : -1;
        p.body.setLinvel(
          { x: e1x * sign * 2.2 + dir.x * along * 0.3, y: v.y, z: e1z * sign * 2.2 + dir.z * along * 0.3 },
          true,
        );
        p.divDoneKey = ek;
        e.lastExit ^= 1;
      }
    }
    for (const p of this.products) {
      if (p.divDoneKey && p.divDoneKey !== p.cellKey) p.divDoneKey = null;
    }
  }

  updateProducers(nowMs) {
    for (const e of this.tools.values()) {
      const def = TOOLS[e.type];
      if (def.kind !== 'producer') continue;
      if (e.paused) continue; // M1.5-D3: soporte para pausar productores individuales
      // M1.5-B: el sembrador es MANUAL salvo mejora de velocidad (auto).
      if (def.manual && e.type === 'sembrador' && !this.mods.sembradorAuto) continue;
      if (nowMs < e.nextSpawn) continue;
      const interval = e.type === 'sembrador' ? this.mods.sembradorIntervalMs || def.interval : def.interval;
      e.nextSpawn = nowMs + interval;
      this.emitFrom(e);
    }
  }

  converterMods(type) {
    const m = this.mods;
    if (type === 'palomitera')
      return { time: m.palomiteraTimeMs, double: m.palomiteraDoubleChance, fat: m.palomiteraValueMult };
    if (type === 'corral')
      return { time: m.corralTimeMs, double: m.corralDoubleChance, fat: m.corralValueMult };
    if (type === 'jamonera')
      return { time: m.jamoneraTimeMs, double: 0, fat: m.jamoneraValueMult };
    return { time: TOOLS[type].time, double: 0, fat: 1 };
  }

  updateConverters(nowMs) {
    const convs = [];
    for (const e of this.tools.values()) {
      if (TOOLS[e.type]?.kind !== 'converter') continue;
      if (e.paused) continue; // M1.5-D3: soporte para pausar conversores individuales
      if (nowMs < e.busyUntil) continue;
      convs.push(e);
    }
    // Pasada 1 — emisiones pendientes. Así un producto recién escupido dentro
    // del cubo del conversor vecino puede ser aceptado en la pasada 2 del
    // MISMO paso, antes de que la física resuelva la superposición y lo
    // expulse volando (traspaso boca-a-boca entre máquinas adyacentes).
    for (const e of convs) {
      if (!e.pending) continue;
      const def = TOOLS[e.type];
      // terminó la cocción: escupe el producto por la boca de salida
      e.pending = false;
      e.outputBlocked = false;
      const m = this.mouthPos(e);
      const count = e.pendingCount || 1;
      for (let k = 0; k < count; k++) {
        const out = this.spawnProduct(
          def.output,
          m.x,
          m.y + k * 0.3,
          m.z,
          // M1.5-D4: sin lift vertical + tope anti-túnel (ver emitFrom).
          { x: e.dir.x * EMIT_IMPULSE, y: 0, z: e.dir.z * EMIT_IMPULSE },
          { jumbo: e.pendingJumbo, fatMult: e.pendingFat },
        );
        if (!out && this.products.length >= MAX_BODIES) {
          e.paused = true;
          e.outputBlocked = true;
          break;
        }
      }
      e.pendingJumbo = false;
      e.pendingFat = 1;
      e.pendingCount = 1;
    }
    // Pasada 2 — aceptación de materia prima por la trasera.
    for (const e of convs) {
      if (!e.pending && Array.isArray(e.buffer) && e.buffer.length > 0) {
        const slot = e.buffer.shift();
        e.pending = true;
        e.busyUntil = nowMs + (slot.timeMs || TOOLS[e.type].time);
        e.pendingJumbo = Boolean(slot.jumbo);
        e.pendingFat = slot.fatMult || 1;
        e.pendingCount = slot.count || 1;
      }
      const def = TOOLS[e.type];
      const recipeInputs = Array.isArray(e.recipeInputs) && e.recipeInputs.length
        ? e.recipeInputs
        : [def.input].filter(Boolean);
      const multiInput = recipeInputs.length > 1;
      // busca materia prima quieta dentro de la celda, entrando POR ATRÁS:
      // (pos - centro)·dir < 0.1 → centro o mitad trasera. El frente se rechaza.
      const cm = this.converterMods(e.type);
      for (let idx = 0; idx < this.products.length; idx++) {
        const p = this.products[idx];
        if (!recipeInputs.includes(p.kind)) continue;
        const t = p.body.translation();
        // M1.5-D3: mayor bounding box (0.65 vs 0.55) y altura (1.5 vs 1.3) para asimilar productos jumbo cómodamente
        // M1.5-D4: altura = baseY + 0.8 → acepta productos de SU nivel y nunca
        // los del nivel superior (antes robaba jumbos que pasaban por N1).
        if (Math.abs(t.x - e.cx) > 0.72 || Math.abs(t.z - e.cz) > 0.72 || t.y > e.baseY + 0.95) continue;
        const inDir = e.inputDirs?.[p.kind] || { x: -e.dir.x, z: -e.dir.z };
        const along = (t.x - e.cx) * inDir.x + (t.z - e.cz) * inDir.z;
        if (along < -0.1) continue; // lado opuesto a la boca elegida: no acepta
        const v = p.body.linvel();
        // Traspaso boca-a-boca: nace a EMIT_IMPULSE y se acepta antes de frenar.
        if (Math.hypot(v.x, v.y, v.z) > CONVERTER_ACCEPT_SPEED) continue;
        const slot = {
          timeMs: cm.time || def.time,
          jumbo: p.jumbo,
          fatMult: cm.fat || 1,
          count: Math.random() < (cm.double || 0) ? 2 : 1,
        };
        if (multiInput) {
          const ib = e.inputBuffers?.[p.kind];
          if (!Array.isArray(ib) || ib.length >= CONVERTER_BUFFER_CAP) continue;
          this.removeProduct(idx);
          idx--;
          ib.push({ jumbo: p.jumbo, fatMult: p.fatMult || 1 });
          continue;
        }
        const q = Array.isArray(e.buffer) ? e.buffer : (e.buffer = []);
        if (!e.pending) {
          this.removeProduct(idx);
          idx--;
          e.pending = true;
          e.busyUntil = nowMs + slot.timeMs;
          e.pendingJumbo = slot.jumbo;
          e.pendingFat = slot.fatMult;
          e.pendingCount = slot.count;
          continue;
        }
        if (q.length < CONVERTER_BUFFER_CAP) {
          this.removeProduct(idx);
          idx--;
          q.push(slot);
          continue;
        }
        else {
          // buffer lleno: no aceptar más en este paso; el producto extra queda
          // esperando en canaleta (sin destruirlo).
          break;
        }
      }
      if (multiInput) {
        const ready = recipeInputs.every((k) => Array.isArray(e.inputBuffers?.[k]) && e.inputBuffers[k].length > 0);
        if (!ready) continue;
        const q = Array.isArray(e.buffer) ? e.buffer : (e.buffer = []);
        const canStart = !e.pending;
        const canQueue = q.length < CONVERTER_BUFFER_CAP;
        if (!canStart && !canQueue) continue;
        const used = recipeInputs.map((k) => e.inputBuffers[k].shift());
        const slot = {
          timeMs: cm.time || def.time,
          jumbo: used.some((u) => u?.jumbo),
          fatMult: cm.fat || 1,
          count: Math.random() < (cm.double || 0) ? 2 : 1,
        };
        if (canStart) {
          e.pending = true;
          e.busyUntil = nowMs + slot.timeMs;
          e.pendingJumbo = slot.jumbo;
          e.pendingFat = slot.fatMult;
          e.pendingCount = slot.count;
        } else q.push(slot);
      }
    }
  }

  // M1.5-F4: Silo, depósito en línea. Los guardados son contadores por
  // tipo+jumbo (sin cuerpo físico) y no cuentan contra MAX_BODIES. Suelta 1
  // por intervalo, alternando tipos, solo con la boca libre. Sin deuda de
  // ritmo: bloqueado o vacío reprograma al próximo intervalo (sin ráfagas).
  updateSilos(nowMs) {
    const cap = this.siloCap();
    const interval = this.siloIntervalMs();
    for (const e of this.tools.values()) {
      if (e.type !== 'silo') continue;
      if (e.paused) continue;
      if (!e.siloStore || !Array.isArray(e.siloOrder)) {
        e.siloStore = e.siloStore || {};
        e.siloOrder = e.siloOrder || [];
        e.siloRot = e.siloRot || 0;
      }
      if (!e.siloNext) e.siloNext = nowMs + interval;
      // Pasada 1 — suelta a ritmo fijo.
      if (nowMs >= e.siloNext) {
        const keys = e.siloOrder.filter((k) => (e.siloStore[k]?.count || 0) > 0);
        e.siloBlocked = false;
        if (!keys.length) {
          e.siloNext = nowMs + interval;
        } else if (!this.mouthClear(e)) {
          // boca ocupada: espera sin perder nada ni acumular deuda.
          e.siloBlocked = true;
          e.siloNext = nowMs + interval;
        } else {
          const pick = keys[(e.siloRot || 0) % keys.length];
          const slot = e.siloStore[pick];
          const m = this.mouthPos(e);
          const out = this.spawnProduct(
            slot.kind,
            m.x + e.dir.x * 0.18,
            m.y,
            m.z + e.dir.z * 0.18,
            { x: e.dir.x * EMIT_IMPULSE, y: 0, z: e.dir.z * EMIT_IMPULSE },
            { jumbo: slot.jumbo },
          );
          if (!out && this.products.length >= MAX_BODIES) {
            e.siloBlocked = true;
            e.siloNext = nowMs + interval;
          } else if (out) {
            slot.count--;
            e.siloRot = (e.siloRot || 0) + 1;
            if (slot.count <= 0) {
              delete e.siloStore[pick];
              e.siloOrder = e.siloOrder.filter((k) => k !== pick);
            }
            e.siloNext = nowMs + interval;
          } else {
            e.siloNext = nowMs + interval;
          }
        }
      }
      // Pasada 2 — aceptación por la trasera. Al tope no acepta: el producto
      // extra queda esperando en la canaleta (sin tocarlo, sin rebote).
      if (this.siloCount(e) >= cap) continue;
      for (let idx = 0; idx < this.products.length; idx++) {
        const p = this.products[idx];
        if (!PRODUCT_PHYS[p.kind]) continue;
        const t = p.body.translation();
        if (Math.abs(t.x - e.cx) > 0.72 || Math.abs(t.z - e.cz) > 0.72 || t.y > e.baseY + 0.95) continue;
        const along = (t.x - e.cx) * -e.dir.x + (t.z - e.cz) * -e.dir.z;
        if (along < -0.1) continue; // frente: no acepta
        const v = p.body.linvel();
        if (Math.hypot(v.x, v.y, v.z) > CONVERTER_ACCEPT_SPEED) continue;
        const key = `${p.kind}:${p.jumbo ? 'j' : 'n'}`;
        if (!e.siloStore[key]) {
          e.siloStore[key] = { kind: p.kind, jumbo: p.jumbo, count: 0 };
          e.siloOrder.push(key);
        }
        e.siloStore[key].count++;
        this.removeProduct(idx);
        idx--;
        if (this.siloCount(e) >= cap) break;
      }
    }
  }

  fanParams(entry, nowMs = 0) {
    const ax = this.fanAxis(entry, nowMs);
    const horizLen = Math.hypot(ax.x, ax.z) || 1;
    return fanConeParams({
      fanTier: entry.fanTier ?? this.defaultFanTier ?? 0,
      dir: { x: ax.x / horizLen, z: ax.z / horizLen },
      pitchDeg: (Math.asin(Math.max(-1, Math.min(1, ax.y))) * 180) / Math.PI,
      cx: entry.cx,
      cy: entry.baseY, // M1.5-D4: cono y banda vertical del nivel del fan
      cz: entry.cz,
      rangeBonus: this.mods.fanRangeBonus || 0,
      // M1.5-G: potencia y alcance efectivos (misma fuente que el cono visual).
      powerPct: entry.powerPct,
      rangeCells: entry.rangeCells,
    });
  }

  fanAxis(entry, nowMs = 0) {
    const p = ((entry.pitchDeg || 0) * Math.PI) / 180;
    const cp = Math.cos(p);
    let dx = entry.dir.x * cp;
    let dz = entry.dir.z * cp;
    const mode = this.mods.fanMode || 0;
    if (mode === 2 && nowMs) {
      // giratorio: giro continuo horario (tipo aguja de reloj), sin barrido ida/vuelta.
      // 1 vuelta cada 4.8s aprox.
      const a = (nowMs / 1000) * (Math.PI / 2.4);
      const cos = Math.cos(a);
      const sin = Math.sin(a);
      const rx = dx * cos - dz * sin;
      const rz = dx * sin + dz * cos;
      dx = rx;
      dz = rz;
    }
    return { x: dx, y: Math.sin(p), z: dz };
  }

  fanPulse(nowMs) {
    if ((this.mods.fanMode || 0) !== 1 || !nowMs) return 1;
    // pulsos: ráfagas senoidales 0.3..1.6
    return 0.95 + 0.65 * Math.sin((nowMs / 900) * Math.PI * 2);
  }

  applyFanForces(dt, nowMs = 0) {
    const pulse = this.fanPulse(nowMs);
    for (const e of this.tools.values()) {
      if (e.type !== 'fan') continue;
      const prm = this.fanParams(e, nowMs);
      const fanTier = e.fanTier ?? this.defaultFanTier ?? 0;
      const ax = prm.direction;
      const ox = prm.origin.x;
      const oy = prm.origin.y;
      const oz = prm.origin.z;
      for (const p of this.products) {
        // M1.5-G: mismo predicado que el panel (registrado + masa + potencia).
        if (!fanMovesProduct(p.kind, fanTier, e.powerPct)) continue;
        const t = p.body.translation();
        // M1.5-D4: banda vertical — solo empuja productos del mismo nivel.
        if (t.y < prm.yMin || t.y > prm.yMax) continue;
        const rx = t.x - ox;
        const ry = t.y - oy;
        const rz = t.z - oz;
        const axial = rx * ax.x + ry * ax.y + rz * ax.z;
        if (axial < 0.3 || axial > prm.range) continue;
        const px = rx - ax.x * axial;
        const py = ry - ax.y * axial;
        const pz = rz - ax.z * axial;
        const radial = Math.sqrt(px * px + py * py + pz * pz);
        if (radial > 0.3 + axial * prm.halfAngleTan) continue;
        // FUERZA constante (F*dt): misma F para todos, los livianos aceleran más
        const f = prm.force * pulse * dt;
        p.body.applyImpulse({ x: ax.x * f, y: ax.y * f, z: ax.z * f }, true);
      }
    }
  }

  entryAt(x, y, z) {
    const i = Math.floor(x + HALF_GRID);
    const j = Math.floor(z + HALF_GRID);
    for (let h = 0; h <= 2; h++) {
      const e = this.tools.get(this.key(i, j, h));
      if (e && Math.abs(y - (e.baseY + 0.25)) < 0.7) return e;
    }
    return null;
  }

  scanProducts(nowMs) {
    for (let idx = this.products.length - 1; idx >= 0; idx--) {
      const p = this.products[idx];
      const t = p.body.translation();
      if (t.z < DELIVERY_Z) {
        this.removeProduct(idx);
        if (this.onDeliver) {
          this.onDeliver(
            p.kind,
            { x: t.x, y: Math.max(t.y, 0.5), z: DELIVERY_Z },
            nowMs,
            { jumbo: p.jumbo, fatMult: p.fatMult },
          );
        }
        continue;
      }
      if (t.y < -6) {
        this.removeProduct(idx);
        if (this.onLost) this.onLost(p.kind, t);
        continue;
      }
      const v = p.body.linvel();
      const speed = Math.hypot(v.x, v.y, v.z);
      const nearGround = t.y <= 0.65;
      const groundEntry = this.entryAt(t.x, t.y, t.z);
      const onBareGround = !groundEntry || TOOLS[groundEntry.type]?.kind !== 'channel';
      if (nearGround && onBareGround && speed < 0.12) {
        if (!p.groundIdleSince) p.groundIdleSince = nowMs;
      } else p.groundIdleSince = 0;
      if (speed > SPEED_LIMIT) {
        const k = SPEED_LIMIT / speed;
        p.body.setLinvel({ x: v.x * k, y: v.y * k, z: v.z * k }, true);
      }
      if (p.body.isSleeping()) {
        if (!p.sleepSince) p.sleepSince = nowMs;
        else {
          if (nowMs - p.sleepSince > JAM_MS) {
            const e = this.entryAt(t.x, t.y, t.z);
            if (e && TOOLS[e.type].kind === 'channel') e.jamUntil = nowMs + 600;
          }
        }
      } else {
        p.sleepSince = 0;
        if (speed < 0.25) {
          if (!p.slowSince) p.slowSince = nowMs;
          else if (nowMs - p.slowSince > JAM_MS) {
            const e = this.entryAt(t.x, t.y, t.z);
            if (e && TOOLS[e.type].kind === 'channel') e.jamUntil = nowMs + 600;
          }
        } else {
          p.slowSince = 0;
        }
      }
    }
  }

  removeProduct(idx) {
    const p = this.products[idx];
    this.world.removeRigidBody(p.body);
    this.products.splice(idx, 1);
  }

  // Cualquier producto cerca de (x,z) en la parcela. Sirve para clic de
  // venta/limpieza, tanto en el suelo como dentro de las canaletas.
  groundProductAt(x, z, radius = 0.7) {
    let best = -1;
    let bestD2 = radius * radius;
    for (let idx = 0; idx < this.products.length; idx++) {
      const p = this.products[idx];
      const t = p.body.translation();
      if (t.y > 3.0) continue; // limitar a alturas lógicas
      const dx = t.x - x;
      const dz = t.z - z;
      const d2 = dx * dx + dz * dz;
      if (d2 < bestD2) {
        bestD2 = d2;
        best = idx;
      }
    }
    return best;
  }
}
