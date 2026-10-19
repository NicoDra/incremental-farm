// Chanchos S.A. — constantes compartidas (cliente M1.5, servidor M2+)

export const GRID_SIZE = 16;
export const HALF_GRID = GRID_SIZE / 2;
export const DELIVERY_Z = -HALF_GRID - 0.55; // plano de entrega (borde norte)
export const GAP_CELLS = [6, 7, 8, 9]; // celdas de la brecha norte

export const LEVEL_H = 1.0; // altura de cada nivel de construcción (0, 1, 2)
export const MAX_LEVEL = 2;

export const PRODUCTS = {
  corn: { name: 'Choclo Premium', value: 3 },
  pumpkin: { name: 'Calabaza Gerencial', value: 8 },
  salt: { name: 'Sal Industrial', value: 4 },
  feed: { name: 'Pienso Balanceado', value: 14 },
  popcorn: { name: 'Palomita Motivacional', value: 6 },
  pig: { name: 'Cerdito Ejecutivo', value: 12 },
  ham: { name: 'Jamón Premium Plus', value: 30 },
};

export const TOOLS = {
  recta: {
    name: 'Canaleta Recta',
    base: 8,
    kind: 'channel',
    hint: 'Paredes laterales. La física hace el resto.',
  },
  curva: {
    name: 'Canaleta Curva',
    base: 12,
    kind: 'channel',
    hint: 'Dobla 90° hacia la izquierda de su frente.',
  },
  rampa: {
    name: 'Rampa de Bajada',
    base: 14,
    kind: 'channel',
    minH: 1,
    hint: 'Baja un nivel hacia su frente. Gravedad gratis.',
  },
  embudo: {
    name: 'Embudo',
    base: 18,
    kind: 'channel',
    hint: 'Angosta el flujo. Solo productos chicos: los cerditos se atascan (es física, no un bug).',
  },
  rebote: {
    name: 'Canaleta Rebote',
    base: 20,
    kind: 'channel',
    hint: 'Canaleta especial de alta restitución. Devuelve productos con rebote.',
  },
  union: {
    name: 'Unión Y/T',
    base: 22,
    kind: 'channel',
    hint: 'Dos entradas laterales (E y O), una salida al frente.',
  },
  divisor: {
    name: 'Divisor',
    base: 24,
    kind: 'channel',
    hint: 'Una entrada atrás, dos salidas que se alternan (E y O).',
  },
  puente: {
    name: 'Puente',
    base: 26,
    kind: 'channel',
    minH: 1,
    hint: 'Tramo elevado (N1/N2): otro camino pasa por debajo.',
  },
  fan: {
    name: 'Ventilador Corporativo',
    base: 25,
    kind: 'fan',
    hint: 'Fuerza real en cono. R: dirección, F: inclinación, H: nivel (0/1/2).',
  },
  sembrador: {
    name: 'Sembrador 3000',
    base: 30,
    kind: 'producer',
    product: 'corn',
    interval: 3000,
    manual: true,
    autoWith: 'sembra_vel',
    hint: 'MANUAL: clic en la pieza emite 1 choclo. Mejora velocidad lo vuelve automático.',
  },
  calabacera: {
    name: 'Calabacera S.R.L.',
    base: 45,
    kind: 'producer',
    product: 'pumpkin',
    interval: 5000,
    hint: 'Calabazas de peso medio. Cada 5 s.',
  },
  salinera: {
    name: 'Salinera Industrial',
    base: 58,
    kind: 'producer',
    product: 'salt',
    interval: 5200,
    hint: 'Emite sal industrial por la boca frontal.',
  },
  pienso: {
    name: 'Planta de Mezcla',
    base: 120,
    kind: 'converter',
    inputs: ['corn', 'pumpkin'],
    inputSides: { corn: 'left', pumpkin: 'right' },
    output: 'feed',
    time: 3200,
    hint: 'Mezcla choclo+calabaza: 1+1. Entrada izquierda = choclo, derecha = calabaza.',
  },
  corral: {
    name: 'Corral Ejecutivo',
    base: 60,
    kind: 'converter',
    input: 'corn',
    output: 'pig',
    time: 3000,
    hint: 'Traga choclos por atrás (flecha teal), cría cerditos pesados por la boca dorada. Cada 3 s.',
  },
  palomitera: {
    name: 'Palomitera 2000',
    base: 80,
    kind: 'converter',
    input: 'corn',
    output: 'popcorn',
    time: 1500,
    hint: 'Traga choclos por atrás, escupe palomitas.',
  },
  jamonera: {
    name: 'Jamonera Industrial',
    base: 150,
    kind: 'converter',
    input: 'pig',
    output: 'ham',
    time: 4000,
    hint: 'Traga cerditos por atrás, escupe jamón.',
  },
  jamonera_industrial: {
    name: 'Curadora de Jambros',
    base: 260,
    kind: 'converter',
    inputs: ['pig', 'salt'],
    inputSides: { pig: 'left', salt: 'right' },
    output: 'ham',
    time: 4600,
    hint: 'Receta premium: cerdo por la izquierda, sal por la derecha.',
  },
  silo: {
    name: 'Silo Amortiguador',
    base: 70,
    kind: 'silo',
    hint: 'Depósito en línea: entra por atrás, suelta 1 por vez al frente a ritmo fijo. Si la boca queda pegada a otra máquina, poné una canaleta entre medio.',
  },
};

export const TOOL_ORDER = [
  'recta',
  'curva',
  'rampa',
  'embudo',
  'rebote',
  'union',
  'divisor',
  'puente',
  'fan',
  'sembrador',
  'calabacera',
  'salinera',
  'pienso',
  'corral',
  'palomitera',
  'jamonera',
  'jamonera_industrial',
  'silo',
];

// Categorías del menú "Construir".
export const TOOL_CATEGORIES = [
  { id: 'path', name: 'Caminos', tools: ['recta', 'curva', 'rampa', 'embudo', 'rebote', 'union', 'divisor', 'puente'] },
  { id: 'fan', name: 'Ventiladores', tools: ['fan'] },
  { id: 'emitter', name: 'Emisores', tools: ['sembrador', 'calabacera', 'salinera'] },
  { id: 'processor', name: 'Procesadores', tools: ['pienso', 'corral', 'palomitera', 'jamonera', 'jamonera_industrial', 'silo'] },
];

// 8 direcciones horizontales (rot8). Índices pares = N, E, S, O (piezas de 4 dirs).
export const DIRS8 = [
  { x: 0, z: -1 }, // 0: norte (hacia entregas)
  { x: 0.7071, z: -0.7071 }, // 1: noreste
  { x: 1, z: 0 }, // 2: este
  { x: 0.7071, z: 0.7071 }, // 3: sureste
  { x: 0, z: 1 }, // 4: sur
  { x: -0.7071, z: 0.7071 }, // 5: suroeste
  { x: -1, z: 0 }, // 6: oeste
  { x: -0.7071, z: -0.7071 }, // 7: noroeste
];

export const DIR_NAMES = ['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO'];

// Solo el ventilador usa las 8 direcciones; las demás piezas rotan en pasos
// de 90° (rot8 par). Ajusta cualquier rot8 a una orientación válida.
export function snapRot8(type, rot8) {
  const r = ((rot8 % 8) + 8) % 8;
  if (type === 'fan') return r;
  return (Math.round(r / 2) * 2) % 8;
}

// ---- M1.5-D4: aperturas de canaleta (fuente única: física + render) ----

export const WORLD_DIRS = ['N', 'E', 'S', 'W'];
const OPPOSITE_WORLD_DIR = { N: 'S', E: 'W', S: 'N', W: 'E' };
const LOCAL_SIDES = ['front', 'right', 'back', 'left'];

export function cellKey(i, j, h) {
  return `${i},${j},${h}`;
}

export function worldDirToDelta(d) {
  if (d === 'N') return { di: 0, dj: -1 };
  if (d === 'E') return { di: 1, dj: 0 };
  if (d === 'S') return { di: 0, dj: 1 };
  return { di: -1, dj: 0 };
}

export function oppositeWorldDir(d) {
  return OPPOSITE_WORLD_DIR[d] || 'N';
}

// Lado local (front/right/back/left) → dirección mundo (N/E/S/W) con rot8.
export function localSideToWorldDir(rot8, side) {
  const q = ((Math.round((rot8 || 0) / 2) % 4) + 4) % 4;
  const idx = LOCAL_SIDES.indexOf(side);
  if (idx < 0) return 'N';
  return WORLD_DIRS[(idx + q) % 4];
}

// Dirección mundo (N/E/S/W) → lado local con rot8.
export function worldSideToLocalSide(rot8, worldDir) {
  const q = ((Math.round((rot8 || 0) / 2) % 4) + 4) % 4;
  const wi = WORLD_DIRS.indexOf(worldDir);
  if (wi < 0) return 'front';
  return LOCAL_SIDES[(((wi - q) % 4) + 4) % 4];
}

// Aperturas por defecto de cada pieza (lados locales).
export function defaultOpenSides(type) {
  if (type === 'recta' || type === 'rampa' || type === 'puente' || type === 'embudo' || type === 'rebote') {
    return ['front', 'back'];
  }
  if (type === 'curva') return ['front', 'right'];
  if (type === 'union') return ['front', 'left', 'right'];
  if (type === 'divisor') return ['back', 'left', 'right'];
  return ['front', 'back'];
}

export function defaultOpenWorldDirs(type, rot8) {
  const out = new Set();
  for (const side of defaultOpenSides(type)) out.add(localSideToWorldDir(rot8, side));
  return out;
}

// Lados que corresponden al eje de flujo de la pieza. Para la auto-conexión
// (M1.5-D4) lo que importa es la BOCA: todo lado abierto por defecto es un
// terminal del camino (salida o entrada) y puede iniciar una unión.
export const OUTPUT_SIDES = {
  recta: ['front', 'back'],
  rampa: ['front', 'back'],
  puente: ['front', 'back'],
  embudo: ['front', 'back'],
  rebote: ['front', 'back'],
  curva: ['front'],
  union: ['front'],
  divisor: ['left', 'right'],
};

// Paredes muertas: lados que nunca forman parte del camino (traseras e
// interiores ciegas). Solo se abren si OPEN_BACKS está encendido.
export const DEAD_SIDES = {
  curva: ['back', 'left'],
  union: ['back'],
  divisor: ['front'],
};

// Auto-conexión: las traseras también se abren ante una boca. Apagarlo deja
// las traseras siempre cerradas (los tests asertan contra esta constante).
export const OPEN_BACKS = true;

export function isOutputSide(type, localSide) {
  const list = OUTPUT_SIDES[type];
  return Boolean(list && list.includes(localSide));
}

export function isChannelType(type) {
  return TOOLS[type]?.kind === 'channel';
}

// M1.5-F5: receta doble = una entrada por ingrediente en el costado que le
// toca (maíz izquierdo/calabaza derecha, cerdo izquierdo/sal derecho);
// receta simple o silo: la trasera, igual que antes.
function converterInputWorldDirs(toolDef, rot8) {
  if (!toolDef || (toolDef.kind !== 'converter' && toolDef.kind !== 'silo')) return [];
  if (toolDef.inputSides && typeof toolDef.inputSides === 'object') {
    const sides = [...new Set(Object.values(toolDef.inputSides))].filter(Boolean);
    return sides.map((s) => localSideToWorldDir(rot8, s));
  }
  return [localSideToWorldDir(rot8, 'back')];
}

// Aperturas efectivas de todas las canaletas de un nivel.
// `pieces`: [{ i, j, h, type, rot8, noAutoConnect }] con TODAS las piezas del
// nivel (canaletas + productores/conversores). Devuelve Map key → {N,E,S,W}.
//
// Reglas (M1.5-D4 auto-conexión):
//  - canal↔canal: el par se abre si ALGÚN lado presentado es BOCA (abierto
//    por defecto: salidas y entradas; solo defaults, nunca punteos: el
//    punteo no propaga ni depende del orden). El extremo que apunta abre el
//    costado que recibe (T) y extremo↔extremo abre ambos (codo). La receptora
//    abre siempre, salvo pared muerta (DEAD_SIDES) que exige OPEN_BACKS.
//    Un flanco/pared que no es boca nunca inicia: la mera cercanía no abre.
//  - canal↔máquina: abre la cara hacia la boca de SALIDA (y hacia la boca de
//    ENTRADA de conversores y del silo); cualquier otra cara queda CERRADA (flanco).
//  - pieza colocada con Shift (noAutoConnect): se salta del emparejamiento;
//    conserva solo sus aperturas por defecto.
export function computeLevelOpenings(pieces) {
  const byKey = new Map();
  const openByKey = new Map();
  for (const p of pieces) {
    const k = cellKey(p.i, p.j, p.h);
    byKey.set(k, p);
    if (isChannelType(p.type)) openByKey.set(k, defaultOpenWorldDirs(p.type, p.rot8));
  }

  for (const p of pieces) {
    const pk = cellKey(p.i, p.j, p.h);
    if (!openByKey.has(pk)) continue;
    if (p.noAutoConnect) continue;
    const open = openByKey.get(pk);
    for (const d of WORLD_DIRS) {
      const { di, dj } = worldDirToDelta(d);
      const nk = cellKey(p.i + di, p.j + dj, p.h);
      const n = byKey.get(nk);
      if (!n) continue;
      const od = oppositeWorldDir(d);
      if (isChannelType(n.type)) {
        if (n.noAutoConnect) continue;
        const nOpen = openByKey.get(nk);
        if (!nOpen) continue;
        // Bocas por DEFECTO (nunca punteos: sin propagación transitiva).
        const selfMouth = defaultOpenWorldDirs(p.type, p.rot8).has(d);
        const neighborMouth = defaultOpenWorldDirs(n.type, n.rot8).has(od);
        if (selfMouth || neighborMouth) {
          const dDead = (DEAD_SIDES[p.type] || []).includes(worldSideToLocalSide(p.rot8, d));
          const nDead = (DEAD_SIDES[n.type] || []).includes(worldSideToLocalSide(n.rot8, od));
          if (!dDead || OPEN_BACKS) open.add(d);
          if (!nDead || OPEN_BACKS) nOpen.add(od);
        }
      } else if (['producer', 'converter', 'silo'].includes(TOOLS[n.type]?.kind)) {
        const outW = localSideToWorldDir(n.rot8, 'front');
        const inWs = ['converter', 'silo'].includes(TOOLS[n.type].kind)
          ? converterInputWorldDirs(TOOLS[n.type], n.rot8)
          : [];
        if (od === outW || inWs.includes(od)) open.add(d);
        else open.delete(d); // flanco de la máquina: pared forzada
      }
      // fan u otros: sin paredes que abrir, se mantienen los defaults.
    }
  }

  const out = new Map();
  for (const [k, set] of openByKey) {
    out.set(k, { N: set.has('N'), E: set.has('E'), S: set.has('S'), W: set.has('W') });
  }
  return out;
}

// Ventilador: aplica FUERZA (misma F para todos; los livianos aceleran más)
// FAN = tier 0 (compat M1.5-A). FAN_TIERS[0..3] = Barro/Madera/Piedra/Fábrica.
export const FAN_TIERS = [
  { force: 0.25, range: 4.2, halfAngleTan: 0.4452, originY: 0.8, name: 'Barro' },
  { force: 0.8, range: 5.0, halfAngleTan: 0.4452, originY: 0.8, name: 'Madera' },
  { force: 1.6, range: 5.8, halfAngleTan: 0.4452, originY: 0.9, name: 'Piedra' },
  { force: 2.6, range: 6.6, halfAngleTan: 0.4452, originY: 1.0, name: 'Fábrica' },
];
export const FAN = FAN_TIERS[0];
export const FAN_TIER_COLORS = ['#4a9e94', '#7fae4a', '#8a8f98', '#c9a13b'];

// ---- M1.5-F2: física canónica de productos + alcance del ventilador ----
// Fuente única (cliente y servidor futuro): media caja, densidad, restitución.
// La masa sale de volumen × densidad (volumen = 8*hx*hy*hz).
export const PRODUCT_PHYS = {
  corn: { half: [0.16, 0.16, 0.16], density: 0.8, restitution: 0.3 },
  pumpkin: { half: [0.24, 0.24, 0.24], density: 1.0, restitution: 0.25 },
  salt: { half: [0.13, 0.13, 0.13], density: 1.1, restitution: 0.2 },
  feed: { half: [0.2, 0.18, 0.2], density: 0.9, restitution: 0.24 },
  popcorn: { half: [0.1, 0.1, 0.1], density: 0.6, restitution: 0.5 },
  pig: { half: [0.26, 0.17, 0.34], density: 1.2, restitution: 0.3 },
  ham: { half: [0.2, 0.14, 0.24], density: 1.2, restitution: 0.25 },
};

export function productMass(kind) {
  const p = PRODUCT_PHYS[kind];
  if (!p) return Infinity;
  return 8 * p.half[0] * p.half[1] * p.half[2] * p.density;
}

// Productos que el ventilador puede empujar (la sal está incluida).
export const FAN_PUSHABLE_PRODUCTS = ['corn', 'pumpkin', 'salt', 'feed', 'popcorn', 'pig', 'ham'];

// Masa máxima que mueve cada tier (Barro/Madera/Piedra/Fábrica).
// La sal (~0.019) queda dentro del rango desde el tier 0, igual que el
// maíz (~0.026) y la calabaza (~0.111); solo el cerdo (~0.144) exige tier 1+.
export const FAN_MAX_PUSH_MASS_BY_TIER = [0.13, 0.22, 0.35, 0.6];

export function fanCanPush(kind, tier) {
  return fanMovesProduct(kind, tier, FAN_POWER_DEFAULT);
}

// ---- M1.5-G: ajuste de potencia y alcance del ventilador ----
// Principio: los ajustes SOLO REDUCEN desde un máximo ya ganado.
// - Potencia máxima = tier (época). Pasos % del máximo, default 100 %.
//   Se guarda como porcentaje: al subir de tier se conserva.
// - Alcance máximo = tier + mejora "alcance" comprada. null = máximo
//   (sigue la mejora); entero = celdas elegidas, siempre recortado al máximo.
export const FAN_POWER_STEPS = [25, 50, 75, 100];
export const FAN_POWER_DEFAULT = 100;
// Aceleración mínima (fuerza/masa) para contar como "mueve". A 100 % nunca
// limita frente a la tabla de masas (peor caso: cerdo en tier 0 ≈ 1.73).
export const FAN_MOVE_MIN_ACCEL = 1.0;
// Productos que muestra el panel del ventilador (mismo orden siempre).
export const FAN_PANEL_PRODUCTS = ['salt', 'corn', 'pumpkin', 'popcorn', 'pig', 'ham'];

function clampTier(tier) {
  return Math.max(0, Math.min(Number.isFinite(tier) ? tier : 0, FAN_TIERS.length - 1));
}

export function fanMaxForce(tier) {
  return fanTierInfo(tier).force;
}

export function fanEffectiveForce(tier, powerPct = FAN_POWER_DEFAULT) {
  const pct = Math.max(0, Math.min(Number.isFinite(powerPct) ? powerPct : FAN_POWER_DEFAULT, 100));
  return fanMaxForce(tier) * (pct / 100);
}

export function fanMaxRange(tier, rangeBonus = 0) {
  return fanTierInfo(tier).range + (Number.isFinite(rangeBonus) ? rangeBonus : 0);
}

export function fanEffectiveRange(tier, rangeBonus = 0, rangeCells = null) {
  const max = fanMaxRange(tier, rangeBonus);
  if (rangeCells === null || rangeCells === undefined) return max;
  const want = Math.floor(Number(rangeCells));
  if (!Number.isFinite(want)) return max;
  return Math.max(1, Math.min(want, max));
}

// Misma lógica para física y panel: registrado + en rango de masa del tier
// + aceleración efectiva sobre el umbral.
export function fanMovesProduct(kind, tier, powerPct = FAN_POWER_DEFAULT) {
  if (!FAN_PUSHABLE_PRODUCTS.includes(kind)) return false;
  const t = clampTier(tier);
  if (productMass(kind) > FAN_MAX_PUSH_MASS_BY_TIER[t]) return false;
  return fanEffectiveForce(t, powerPct) / productMass(kind) >= FAN_MOVE_MIN_ACCEL;
}

// Normaliza un ajuste {powerPct, rangeCells} a pasos enteros válidos.
// La potencia ajusta al paso más cercano; el alcance queda entero ≥ 1 o null
// (el recorte al máximo vigente lo hace fanEffectiveRange al usar).
export function normalizeFanTune(tune) {
  const t = tune || {};
  let powerPct = FAN_POWER_DEFAULT;
  if (Number.isFinite(Number(t.powerPct))) {
    const p = Number(t.powerPct);
    powerPct = FAN_POWER_STEPS.reduce((a, b) => (Math.abs(b - p) < Math.abs(a - p) ? b : a));
  }
  let rangeCells = null;
  if (t.rangeCells !== null && t.rangeCells !== undefined) {
    const r = Math.floor(Number(t.rangeCells));
    rangeCells = Number.isFinite(r) ? Math.max(1, r) : null;
  }
  return { powerPct, rangeCells };
}

// Estado serializable del ajuste: enteros pequeños (p = %, r = celdas|null).
export function serializeFanTune(entry) {
  const n = normalizeFanTune({ powerPct: entry?.powerPct, rangeCells: entry?.rangeCells });
  return { p: n.powerPct, r: n.rangeCells };
}

export function parseFanTune(json) {
  if (!json || typeof json !== 'object') return null;
  if (!Number.isFinite(Number(json.p)) || (json.r !== null && !Number.isFinite(Number(json.r)))) {
    return null;
  }
  return normalizeFanTune({ powerPct: Number(json.p), rangeCells: json.r === null ? null : Number(json.r) });
}

// Física de suelo y canaletas (M1.5-D3): el suelo frena más que cualquier
// canaleta; las canaletas mejoran por edad/tier.
export const GROUND_FRICTION = 0.92;
export const CHANNEL_FRICTION_BY_TIER = [0.22, 0.14, 0.08, 0.04]; // Barro/Madera/Piedra/Metal
export const CHANNEL_RESTITUTION_BY_TIER = [0.02, 0.03, 0.04, 0.06];
export const BOUNCE_CHANNEL_RESTITUTION = 0.68; // canaleta rebote (edad Piedra)
export const BOUNCE_CHANNEL_FRICTION = 0.06;

// Damping global del producto (el suelo termina de frenar por fricción).
export const PRODUCT_LINEAR_DAMPING = 0.12;
export const PRODUCT_ANGULAR_DAMPING = 2.2;

// Tiempo máximo quieto en suelo antes de limpiar cuerpo para no saturar cap.
export const GROUND_IDLE_DESPAWN_MS = 20000;
// M1.5-H3: regla de liquidación. Liquidar = venta por clic / vender el suelo.
// Auto-liquidación = cuerpos quietos en el suelo (sin canaleta encima) a los
// AUTO_LIQUIDATE_SECONDS. Paga menos: menos % del valor base en ambas.
export const LIQUIDATION_RATE = 0.10; // venta manual por clic o "Liquidar el suelo"
export const BULK_LIQUIDATION_COOLDOWN_MS = 30_000; // cooldown de Liquidar el suelo
export const AUTO_LIQUIDATE_SECONDS = 90;
export const AUTO_LIQUIDATE_RATE = 0; // liquidación automática: nada de pago
export const AUTO_LIQUIDATE_MS = AUTO_LIQUIDATE_SECONDS * 1000;
// M1.5-J1: cada unidad liquidada manualmente resta este valor al combo actual
// (sin bajar de 1.0). Las entregas por el portal no se ven afectadas.
export const COMBO_LIQUIDATION_PENALTY = 0.25;

// Nombre interno: CHANGO recogida stock = el comunicador ya existente.

export function fanTierInfo(tier) {
  const t = Math.max(0, Math.min(Number.isFinite(tier) ? tier : 0, FAN_TIERS.length - 1));
  return FAN_TIERS[t];
}

export function channelTierForAge(age) {
  return Math.max(0, Math.min(Number.isFinite(age) ? age : 0, CHANNEL_FRICTION_BY_TIER.length - 1));
}

export function channelSurfaceForAge(age, isBounce = false) {
  const t = channelTierForAge(age);
  return {
    friction: isBounce ? BOUNCE_CHANNEL_FRICTION : CHANNEL_FRICTION_BY_TIER[t],
    restitution: isBounce ? BOUNCE_CHANNEL_RESTITUTION : CHANNEL_RESTITUTION_BY_TIER[t],
    tier: t,
  };
}

// Fuente única de verdad del cono del ventilador (física + render).
// Input esperado: { rot8|dir, pitchDeg, fanTier, cx|x, cy|y, cz|z,
//   rangeBonus, powerPct (default 100), rangeCells (default null = máximo) }.
export function fanConeParams(fan) {
  const f = fan || {};
  const tier = fanTierInfo(f.fanTier ?? f.tier ?? 0);
  const tierIdx = FAN_TIERS.indexOf(tier);
  const rot8 = snapRot8('fan', f.rot8 ?? 0);
  const dir = f.dir || DIRS8[rot8];
  const pitchDeg = Number.isFinite(f.pitchDeg) ? f.pitchDeg : 0;
  const pitchRad = (pitchDeg * Math.PI) / 180;
  const cp = Math.cos(pitchRad);
  const axis = {
    x: dir.x * cp,
    y: Math.sin(pitchRad),
    z: dir.z * cp,
  };
  // M1.5-G: potencia y alcance efectivos (solo reducen desde los máximos).
  const tune = normalizeFanTune({ powerPct: f.powerPct, rangeCells: f.rangeCells });
  const rangeBonus = Number.isFinite(f.rangeBonus) ? f.rangeBonus : 0;
  const maxRange = fanMaxRange(tierIdx, rangeBonus);
  const range = fanEffectiveRange(tierIdx, rangeBonus, tune.rangeCells);
  const maxForce = fanMaxForce(tierIdx);
  const force = fanEffectiveForce(tierIdx, tune.powerPct);
  const halfAngleTan = tier.halfAngleTan;
  const halfAngleDeg = (Math.atan(halfAngleTan) * 180) / Math.PI;
  const cy = Number.isFinite(f.cy) ? f.cy : Number.isFinite(f.y) ? f.y : 0;
  return {
    origin: {
      x: Number.isFinite(f.cx) ? f.cx : (Number.isFinite(f.x) ? f.x : 0),
      y: cy + tier.originY,
      z: Number.isFinite(f.cz) ? f.cz : (Number.isFinite(f.z) ? f.z : 0),
    },
    direction: axis,
    pitchDeg,
    range,
    halfAngleTan,
    halfAngleDeg,
    // M1.5-D4: banda vertical de empuje. Un ventilador solo empuja productos
    // de SU nivel (no del nivel de arriba ni del de abajo).
    yMin: cy - 0.4,
    yMax: cy + 0.9,
    fanTier: tierIdx,
    force,
    // M1.5-G: efectivos + máximos para panel actual/máximo.
    powerPct: tune.powerPct,
    rangeCells: tune.rangeCells,
    rangeBonus,
    maxForce,
    maxRange,
  };
}

export function toolCost(type, owned) {
  return Math.ceil(TOOLS[type].base * Math.pow(1.15, owned));
}

// M1.5-J1: valores de arranque de la primera pasada de balance.
export const LEVELS = [
  { name: 'Corral de Barro S.A.', mult: 1, cost: 0, slogan: 'La honestidad empieza en el barro.' },
  { name: 'Granero de Madera S.A.', mult: 1.6, cost: 800, slogan: 'Ahora con paredes que se ven pro.' },
  { name: 'Granja de Piedra S.A.', mult: 2.6, cost: 5500, slogan: 'Prestigio mineral, precios inflados.' },
  { name: 'Fábrica Chanchos S.A.', mult: 4, cost: 28000, slogan: 'Sinergia porcina integral certificada.' },
];

// M1.5-J1: metas de entrega por edad. Solo cuenta lo entregado por el portal
// (no liquidaciones), y cada edad exige su dinero y sus cantidades juntas.
// Cada meta solo pide lo que ya se puede producir con las piezas de esa edad.
export const AGE_GOALS = [
  null, // Barro: sin meta (primera transición solo pide choclo)
  [{ kind: 'corn', count: 30 }], // Barro → Madera
  [{ kind: 'pumpkin', count: 20 }, { kind: 'popcorn', count: 20 }], // Madera → Piedra
  [{ kind: 'pig', count: 15 }, { kind: 'feed', count: 10 }], // Piedra → Fábrica
];

export function ageGoal(age) {
  if (age <= 0 || age >= AGE_GOALS.length) return null;
  return AGE_GOALS[age];
}

// M1.5-C: reembolso de demolición. Barro = 100%, desde Madera = 75%.
export const REFUND_RATE_CLAY = 1.0;
export const REFUND_RATE_POST_CLAY = 0.75;
export const COMBO = { windowMs: 3000, step: 0.1, max: 5 };
// M1.5-J1c: tope del combo por edad. El paso (0.1) y la ventana (3 s) no cambian.
export const COMBO_MAX_BY_AGE = [2, 3, 4, 5]; // Barro, Madera, Piedra, Fábrica
export function comboMaxForAge(age) {
  const t = Math.max(0, Math.min(age || 0, COMBO_MAX_BY_AGE.length - 1));
  return COMBO_MAX_BY_AGE[t];
}
// M1.5-B: edades = índice de LEVELS. Cada edad desbloquea herramientas,
// productos y un tier de ventilador. Paleta visual por edad.
export const AGES = [
  {
    id: 0, name: 'Barro', fanTier: 0,
    tools: ['recta', 'curva', 'rampa', 'embudo', 'fan', 'sembrador'],
    products: ['corn'],
    desc: 'Sembrador + canaletas + ventilador tier 1. Maíz.',
  },
  {
    id: 1, name: 'Madera', fanTier: 1,
    tools: ['recta', 'curva', 'rampa', 'embudo', 'union', 'divisor', 'puente', 'fan', 'sembrador', 'calabacera', 'palomitera', 'silo'],
    products: ['corn', 'pumpkin', 'popcorn'],
    desc: 'Palomitera + piezas de conexión (unión, divisor, puente) + ventilador tier 2. Calabaza.',
  },
  {
    id: 2, name: 'Piedra', fanTier: 2,
    tools: ['recta', 'curva', 'rampa', 'embudo', 'rebote', 'union', 'divisor', 'puente', 'fan', 'sembrador', 'calabacera', 'salinera', 'pienso', 'palomitera', 'corral'],
    products: ['corn', 'pumpkin', 'salt', 'feed', 'popcorn', 'pig'],
    desc: 'Corral (maíz→cerdo) + ventilador tier 3. Cerdos.',
  },
  {
    id: 3, name: 'Fábrica', fanTier: 3,
    tools: ['recta', 'curva', 'rampa', 'embudo', 'rebote', 'union', 'divisor', 'puente', 'fan', 'sembrador', 'calabacera', 'salinera', 'pienso', 'palomitera', 'corral', 'jamonera', 'jamonera_industrial'],
    products: ['corn', 'pumpkin', 'salt', 'feed', 'popcorn', 'pig', 'ham'],
    desc: 'Jamonera (cerdo→jamón) + ventilador tier 4. Jamones.',
  },
];
export function ageInfo(age) {
  return AGES[Math.max(0, Math.min(age, AGES.length - 1))];
}
export function toolUnlockAge(type) {
  for (let a = 0; a < AGES.length; a++) if (AGES[a].tools.includes(type)) return a;
  return 0;
}
export function isToolUnlocked(type, age) {
  return toolUnlockAge(type) <= age;
}
// Paleta visual por edad (barro/madera/piedra/metal). La UI/render la consume.
export const AGE_PALETTES = [
  { wood: '#8a6b45', dark: '#6b5233', metal: '#5d6673', accent: '#4a9e94' }, // barro
  { wood: '#a0713f', dark: '#7a5327', metal: '#6b7078', accent: '#7fae4a' }, // madera
  { wood: '#7d7d84', dark: '#54555c', metal: '#5d6673', accent: '#8a8f98' }, // piedra
  { wood: '#5d6673', dark: '#3a3f47', metal: '#c9a13b', accent: '#c9a13b' }, // metal
];

// ---- M1.5-B: mejoras ----
// 2 ranuras por edad (total = (edad+1)*2), repartibles entre líneas.
// Las líneas de edades anteriores siguen disponibles.
// Velocidad escala costo más rápido (growth 1.8) que probabilidad/valor (1.5).
export const SLOTS_PER_AGE = 2;
export function totalSlots(age) {
  return (Math.max(0, Math.min(age, 3)) + 1) * SLOTS_PER_AGE;
}
export const UPGRADE_LINES = {
  sembra_vel: { obj: 'sembrador', name: 'Sembrador: velocidad', max: 5, base: 40, growth: 1.8, age: 0, desc: 'Nivel 1+ lo vuelve AUTOMÁTICO. Niveles extra: -18% intervalo c/u.' },
  sembra_jumbo: { obj: 'sembrador', name: 'Sembrador: júmbos', max: 5, base: 60, growth: 1.5, age: 0, desc: '+10% probabilidad de choclo jumbo (vale x2) por nivel.' },
  sembra_burst: { obj: 'sembrador', name: 'Sembrador: ráfaga x3', max: 3, base: 120, growth: 1.5, age: 0, desc: '+12% probabilidad de emitir 3 choclos por nivel.' },
  corral_vel: { obj: 'corral', name: 'Corral: velocidad', max: 5, base: 60, growth: 1.8, age: 2, desc: '-15% tiempo de cría por nivel.' },
  corral_gordo: { obj: 'corral', name: 'Corral: gordo', max: 5, base: 70, growth: 1.5, age: 2, desc: '+15% valor del cerdo por nivel.' },
  corral_camada: { obj: 'corral', name: 'Corral: camada x2', max: 3, base: 150, growth: 1.5, age: 2, desc: '+15% probabilidad de camada doble por nivel.' },
  palomi_vel: { obj: 'palomitera', name: 'Palomitera: velocidad', max: 5, base: 60, growth: 1.8, age: 1, desc: '-15% tiempo de cocción por nivel.' },
  palomi_dulce: { obj: 'palomitera', name: 'Palomitera: dulce', max: 5, base: 70, growth: 1.5, age: 1, desc: '+15% valor palomita por nivel.' },
  palomi_efi: { obj: 'palomitera', name: 'Palomitera: eficiencia', max: 3, base: 150, growth: 1.5, age: 1, desc: '+15% probabilidad de palomita doble por nivel.' },
  jamon_vel: { obj: 'jamonera', name: 'Jamonera: velocidad', max: 5, base: 100, growth: 1.8, age: 3, desc: '-15% tiempo de curado por nivel.' },
  jamon_curado: { obj: 'jamonera', name: 'Jamonera: curado', max: 5, base: 120, growth: 1.5, age: 3, desc: '+20% valor jamón por nivel.' },
  jamon_mult: { obj: 'jamonera', name: 'Jamonera: multiplicador', max: 5, base: 200, growth: 1.5, age: 3, desc: '+8% ingresos globales por nivel.' },
  silo_cap: { obj: 'silo', name: 'Silo: capacidad', max: 5, base: 80, growth: 1.5, age: 1, desc: '+4 capacidad total por nivel.' },
  silo_vel: { obj: 'silo', name: 'Silo: velocidad de salida', max: 5, base: 90, growth: 1.8, age: 1, desc: '-15% intervalo de salida por nivel.' },
  fan_alcance: { obj: 'fan', name: 'Ventilador: alcance', max: 5, base: 50, growth: 1.5, age: 0, desc: '+0.6 celdas de alcance por nivel.' },
  fan_modo: { obj: 'fan', name: 'Ventilador: modo', max: 2, base: 150, growth: 1.5, age: 1, desc: 'Nv1 pulsos (ráfagas), nv2 giratorio (barre ±40°).' },
  portal_valor: { obj: 'portal', name: 'Portal: valor', max: 5, base: 80, growth: 1.5, age: 0, desc: '+12% valor de entrega por nivel.' },
  portal_combo: { obj: 'portal', name: 'Portal: ventana combo', max: 5, base: 80, growth: 1.5, age: 1, desc: '+1 s ventana de combo por nivel.' },
  portal_boca: { obj: 'portal', name: 'Portal: boca ancha', max: 3, base: 120, growth: 1.5, age: 2, desc: '+6% valor (menos pérdidas) por nivel.' },
};
export function upgradeCost(lineId, level) {
  const line = UPGRADE_LINES[lineId];
  if (!line) return Infinity;
  return Math.ceil(line.base * Math.pow(line.growth, level));
}

// Costo neto de mejorar en el lugar sin demoler/reponer manualmente.
// Equivalente a: recomprar misma pieza al costo actual menos refund de la pieza
// existente (según refundRate de la edad actual).
export function upgradeInPlaceCost(type, owned, refundRate) {
  const prevOwned = Math.max(0, (owned || 0) - 1);
  const rebuy = toolCost(type, prevOwned);
  const rr = Number.isFinite(refundRate) ? refundRate : REFUND_RATE_POST_CLAY;
  const refund = Math.floor(rebuy * rr);
  return Math.max(0, rebuy - refund);
}
export const JUMBO_VALUE_MULT = 2;
export const JUMBO_SCALE = 1.5;
export const SEMBRADOR_MANUAL_COOLDOWN_MS = 800;
export const HAM_GLOBAL_PER_UNIT = 0.05; // cada jamonera colocada: +5% ingresos
export const MAX_BODIES = 120;
export const RECYCLE_MS = 20000; // producto dormido mucho tiempo se recicla al 50%
export const START_MONEY = 75;
export const JAM_MS = 2500; // tiempo quieto antes de marcar atasco
export const FLOAT_COMBINE_WINDOW_MS = 500; // ventana para sumar floats "+$" en un único texto

// M1.5-D4: emisión estable. Los productos salen SOLO con impulso horizontal
// (sin componente vertical) y la pared de canaleta sube por encima de la
// boca de salida, así ningún producto puede volar por encima de la pared.
export const EMIT_IMPULSE = 1.6; // velocidad inicial en la dirección de la boca
export const CHANNEL_WALL_H = 0.6; // altura de la pared de canaleta sobre la losa
export const MAX_PRODUCT_SPEED = 5; // tope de velocidad (anti-túnel)
export const SPEED_LIMIT = MAX_PRODUCT_SPEED; // alias: código existente
// Traspaso boca-a-boca entre máquinas adyacentes: el producto nace a
// EMIT_IMPULSE dentro del cubo del vecino; si va lento se acepta en el mismo
// paso, antes de que la física lo expulse (ver updateConverters, doble pasada).
export const CONVERTER_ACCEPT_SPEED = EMIT_IMPULSE + 0.1;
export const CONVERTER_BUFFER_CAP = 3;

// M1.5-F4: Silo, depósito en línea. Guarda contadores por tipo (sin cuerpo
// físico) y suelta 1 por intervalo, alternando tipos, solo con boca libre.
export const SILO_CAP = 10; // capacidad total base (unidades)
export const SILO_CAP_PER_LEVEL = 4; // +capacidad por nivel de mejora silo_cap
export const SILO_INTERVAL_MS = 1200; // ritmo base de salida (1 producto cada X)
export const SILO_MOUTH_CLEAR_R = 0.6; // radio libre exigido en la boca de salida

export function comboMult(steps) {
  return Math.min(1 + steps * COMBO.step, COMBO.max);
}

export function formatMoney(n) {
  const v = Math.floor(n);
  if (v < 1000) return '$' + v;
  const units = [
    [1e9, 'B'],
    [1e6, 'M'],
    [1e3, 'K'],
  ];
  for (const [size, suf] of units) {
    if (v >= size) {
      const q = v / size;
      const s = q >= 100 ? String(Math.floor(q)) : q.toFixed(1).replace(/\.0$/, '');
      return '$' + s + suf;
    }
  }
  return '$' + v;
}
