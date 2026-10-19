// Maquinaria agrícola de juguete. Marco local: frente -Z, apoyo Y=0,
// huella de una celda. Las bocas son huecos entre paneles, no manchas negras
// sobre una pared cerrada. Oro = salida; los ingredientes conservan su color.
import { AGE_PALETTES } from 'chanchos-shared';
import { voxelBuilder } from './voxel.js';

const GOLD = '#f2c94c';
const STEEL = '#a9b9bf';
const INK = '#303e45';
const CREAM = '#fff0cf';

function feet(v, w, d, color) {
  for (const x of [-w / 2 + 0.09, w / 2 - 0.09]) {
    for (const z of [-d / 2 + 0.09, d / 2 - 0.09]) {
      v.add(0.13, 0.18, 0.13, x, 0.09, z, color);
    }
  }
}

// Panel frontal/lateral con abertura real; la boca física emite en Y=.55.
function wall(v, side, span, depth, h, paint, opening) {
  const sideWall = side === 'left' || side === 'right';
  const sign = side === 'left' || side === 'front' ? -1 : 1;
  const add = (length, height, center, y, color, thickness = 0.07) => {
    if (sideWall) v.add(thickness, height, length, sign * depth, y, center, color);
    else v.add(length, height, thickness, center, y, sign * depth, color);
  };
  if (!opening) { add(span, h, 0, h / 2 + 0.12, paint); return; }
  const jamb = (span - 0.48) / 2;
  for (const s of [-1, 1]) add(jamb, h, s * (0.24 + jamb / 2), h / 2 + 0.12, paint);
  add(0.48, 0.13, 0, 0.185, paint);
  const lintel = h + 0.12 - 0.72;
  if (lintel > 0) add(0.48, lintel, 0, 0.72 + lintel / 2, paint);
}

function port(v, side, depth, color) {
  const sign = side === 'left' || side === 'front' ? -1 : 1;
  const lateral = side === 'left' || side === 'right';
  const add = (w, h, a, y) => lateral
    ? v.add(0.10, h, w, sign * depth, y, a, color)
    : v.add(w, h, 0.10, a, y, sign * depth, color);
  add(0.58, 0.06, 0, 0.22);
  add(0.58, 0.06, 0, 0.75);
  for (const s of [-1, 1]) add(0.05, 0.47, s * 0.265, 0.485);
}

function chassis(v, paint, P, inputs = [], w = 0.78, d = 0.74, h = 0.56) {
  feet(v, w, d, INK);
  v.add(w, 0.10, d, 0, 0.17, 0, P.dark);
  for (const side of ['front', 'back', 'left', 'right']) {
    const lateral = side === 'left' || side === 'right';
    wall(v, side, lateral ? d : w, (lateral ? w : d) / 2, h, paint,
      side === 'front' || inputs.includes(side));
  }
  port(v, 'front', d / 2 + 0.015, GOLD);
  for (const side of inputs) port(v, side, (side === 'back' ? d : w) / 2 + 0.015, '#4a9e94');
}

// Tolva escalonada hueca: cuatro aros crecientes, con grano dentro, no tapa.
function hopper(v, x, y, z, size, color, contents) {
  for (let step = 0; step < 3; step++) {
    const w = size * (0.56 + step * 0.22);
    const yy = y + step * 0.07;
    for (const s of [-1, 1]) {
      v.add(w, 0.07, 0.045, x, yy, z + s * (w / 2 - 0.0225), color);
      v.add(0.045, 0.07, w - 0.09, x + s * (w / 2 - 0.0225), yy, z, color);
    }
  }
  v.add(size * 0.45, 0.035, size * 0.45, x, y + 0.005, z, contents);
}

function vent(v, x, y, z) {
  for (let i = 0; i < 3; i++) v.add(0.22, 0.035, 0.025, x, y + i * 0.075, z, INK);
}

export function buildProducerGeo(type, age = 0) {
  const P = AGE_PALETTES[Math.max(0, Math.min(age, 3))];
  const v = voxelBuilder();
  if (type === 'sembrador') {
    chassis(v, '#3e8e83', P, [], 0.66, 0.64, 0.48);
    hopper(v, 0, 0.66, 0.04, 0.58, CREAM, GOLD);
    for (const x of [-0.13, 0.05, 0.18]) v.add(0.065, 0.07, 0.065, x, 0.72, 0.04, '#e5ad32');
    v.add(0.15, 0.24, 0.20, 0.26, 0.42, 0.18, INK);
    vent(v, 0, 0.31, 0.365);
    v.add(0.12, 0.07, 0.08, -0.17, 0.64, -0.2, RED_PAINT);
  } else if (type === 'calabacera') {
    v.add(0.88, 0.12, 0.88, 0, 0.06, 0, '#5a3d2a');
    for (const s of [-1, 1]) {
      v.add(0.88, 0.09, 0.07, 0, 0.135, s * 0.405, P.wood);
      v.add(0.07, 0.09, 0.74, s * 0.405, 0.135, 0, P.wood);
      v.add(0.045, 0.06, 0.62, s * 0.17, 0.15, 0.02, '#4c793b');
      const x = s * 0.18, z = s * 0.13;
      v.add(0.25, 0.20, 0.27, x, 0.25, z, '#d57330');
      v.add(0.30, 0.14, 0.18, x, 0.25, z, '#ee9d42');
      v.add(0.18, 0.06, 0.18, x, 0.38, z, '#f0b150');
      v.add(0.05, 0.08, 0.05, x, 0.43, z, '#4c793b');
      v.add(0.16, 0.035, 0.10, x + 0.10, 0.18, z + 0.16, '#7fae4a');
    }
    port(v, 'front', 0.42, GOLD);
  } else if (type === 'salinera') {
    v.add(0.84, 0.12, 0.84, 0, 0.06, 0, INK);
    v.add(0.74, 0.08, 0.74, 0, 0.16, 0, '#72b6ba');
    for (const s of [-1, 1]) {
      v.add(0.82, 0.12, 0.07, 0, 0.23, s * 0.37, STEEL);
      v.add(0.07, 0.12, 0.68, s * 0.37, 0.23, 0, STEEL);
    }
    for (const [x, z, h] of [[-.18,.13,.32],[.12,.16,.23],[0,-.13,.18]]) {
      v.add(0.19, h, 0.19, x, 0.22 + h / 2, z, '#e5edf0');
      v.add(0.12, 0.07, 0.12, x, 0.255 + h, z, '#ffffff');
    }
    port(v, 'front', 0.42, GOLD);
  } else if (type === 'pienso') {
    chassis(v, '#d49a40', P, ['left', 'right'], 0.84, 0.78, 0.62);
    for (const s of [-1, 1]) {
      hopper(v, s * 0.21, 0.81, 0.08, 0.32, STEEL, s < 0 ? GOLD : '#e08a3c');
      port(v, s < 0 ? 'left' : 'right', 0.435, s < 0 ? '#4a9e94' : '#e08a3c');
    }
    v.add(0.10, 0.16, 0.44, 0, 0.83, 0.04, '#a65637');
    vent(v, 0, 0.34, 0.43);
  } else if (type === 'corral') {
    v.add(0.84, 0.08, 0.84, 0, 0.04, 0, '#bd9959');
    for (const x of [-0.40, 0.40]) for (const z of [-0.40, 0.40]) {
      v.add(0.10, 0.74, 0.10, x, 0.37, z, P.wood);
      v.add(0.13, 0.07, 0.13, x, 0.775, z, '#f4dfb5');
    }
    for (const x of [-0.40, 0.40]) for (const y of [0.25, 0.48]) {
      v.add(0.07, 0.08, 0.75, x, y, 0, P.wood);
    }
    // Entradas y salidas abiertas: los travesaños quedan por encima del paso.
    for (const z of [-0.40, 0.40]) v.add(0.74, 0.07, 0.07, 0, 0.68, z, P.wood);
    port(v, 'front', 0.42, GOLD);
    port(v, 'back', 0.42, '#4a9e94');
    v.add(0.25, 0.13, 0.13, -0.22, 0.145, 0.05, '#718b77');
    v.add(0.20, 0.025, 0.08, -0.22, 0.225, 0.05, GOLD);
    v.add(0.27, 0.19, 0.20, 0.13, 0.22, 0.04, '#f4a8bd');
    v.add(0.13, 0.14, 0.12, 0.13, 0.25, -0.10, '#f4a8bd');
    v.add(0.10, 0.055, 0.035, 0.13, 0.23, -0.178, '#d97892');
    for (const x of [0.09, 0.17]) v.add(0.035, 0.06, 0.04, x, 0.35, -0.10, '#d97892');
  } else if (type === 'palomitera') {
    chassis(v, RED_PAINT, P, ['back'], 0.72, 0.72, 0.52);
    // Vitrina abierta: granos visibles entre cuatro montantes crema.
    for (const x of [-0.28, 0.28]) for (const z of [-0.28, 0.28]) v.add(0.055, 0.28, 0.055, x, 0.78, z, CREAM);
    v.add(0.62, 0.05, 0.62, 0, 0.65, 0, GOLD);
    for (const [x,z,h] of [[-.12,.05,.10],[.10,.11,.14],[.05,-.13,.09]]) v.add(0.15, h, 0.15, x, 0.69 + h / 2, z, CREAM);
    v.add(0.78, 0.08, 0.78, 0, 0.97, 0, RED_PAINT);
    v.add(0.56, 0.07, 0.56, 0, 1.045, 0, '#d76a4c');
    v.add(0.32, 0.06, 0.32, 0, 1.11, 0, RED_PAINT);
    for (const x of [-0.22, 0, 0.22]) v.add(0.09, 0.08, 0.04, x, 0.97, -0.405, CREAM);
  } else if (type === 'jamonera' || type === 'jamonera_industrial') {
    const industrial = type === 'jamonera_industrial';
    const w = industrial ? 0.88 : 0.78;
    chassis(v, industrial ? '#417e86' : '#984e42', P, industrial ? ['left', 'right'] : ['back'], w, 0.80, 0.74);
    v.add(w + 0.02, 0.08, 0.82, 0, 0.90, 0, INK);
    for (const x of industrial ? [-0.23, 0.23] : [0.20]) {
      v.add(0.16, 0.30, 0.16, x, 1.08, 0.16, STEEL);
      v.add(0.23, 0.055, 0.23, x, 1.255, 0.16, INK);
    }
    // Puerta de inspección y termómetro en el lateral, fuera de las bocas.
    v.add(0.025, 0.14, 0.25, -w / 2 - 0.047, 0.79, -0.12, CREAM);
    v.add(0.035, 0.20, 0.06, -w / 2 - 0.068, 0.67, -0.12, INK);
    v.add(0.04, 0.09, 0.04, -w / 2 - 0.09, 0.62, -0.12, RED_PAINT);
    if (industrial) {
      port(v, 'left', w / 2 + 0.02, '#f4a8bd');
      port(v, 'right', w / 2 + 0.02, '#ececf0');
      v.add(0.35, 0.14, 0.20, 0, 1.01, -0.16, '#d39a40');
    }
  } else if (type === 'silo') {
    chassis(v, '#527f95', P, ['back'], 0.72, 0.72, 0.54);
    v.add(0.66, 0.38, 0.66, 0, 0.87, 0, '#8fb5bd');
    for (const y of [0.72, 1.04]) v.add(0.72, 0.055, 0.72, 0, y, 0, STEEL);
    v.add(0.56, 0.09, 0.56, 0, 1.115, 0, '#526f85');
    v.add(0.38, 0.08, 0.38, 0, 1.20, 0, '#526f85');
    v.add(0.20, 0.06, 0.20, 0, 1.27, 0, GOLD);
    for (const z of [-0.22, 0.22]) v.add(0.045, 0.70, 0.045, 0.39, 0.72, z, INK);
    for (const y of [0.43, 0.61, 0.79, 0.97]) v.add(0.045, 0.035, 0.44, 0.39, y, 0, STEEL);
  } else {
    throw new Error(`Modelo de máquina desconocido: ${type}`);
  }
  // La época cambia la construcción de la base, no borra la pintura de marca.
  if (!['calabacera', 'salinera', 'corral'].includes(type)) {
    for (const s of [-1, 1]) {
      v.add(0.08, 0.22, 0.08, s * 0.29, 0.19, 0.28, age >= 2 ? STEEL : P.wood);
      if (age >= 2) v.add(0.10, 0.04, 0.11, s * 0.29, 0.29, 0.28, GOLD);
    }
  }
  return v.build();
}

const RED_PAINT = '#b84f42';
