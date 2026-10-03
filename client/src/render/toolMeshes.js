// Chanchos S.A. — meshes voxel de herramientas: canaletas, ventilador, procesadores.
// Toda pieza lleva flecha de frente flotante (visible desde las 4 rotaciones).
// Procesadores: boca de salida (dorado) y entrada si tiene (verde azulado).
import * as THREE from 'three';
import {
  HALF_GRID,
  LEVEL_H,
  FAN_TIERS,
  FAN_TIER_COLORS,
  AGE_PALETTES,
  TOOLS,
  fanConeParams,
  computeLevelOpenings,
} from 'chanchos-shared';
import { voxelBuilder, voxelMaterial } from './voxel.js';

const RAMP_TILT = -Math.PI / 4; // -45°: baja hacia el frente local (-z)

function rotToYaw(rot8) {
  return -rot8 * (Math.PI / 4);
}

const CREAM = '#fff8e7';
const GOLD = '#f2c94c';
const TEAL = '#4a9e94';
const RED = '#e05252';
const DARK = '#1a1210';

// Chevrón apuntando al -z local
function chevronGeo(size = 1) {
  const v = voxelBuilder();
  const a = 0.32 * size;
  const w = 0.13 * size;
  const l = 0.34 * size;
  v.add(l, 0.07 * size, w, -a * 0.55, 0, 0.06 * size, '#ffffff', 0.7);
  v.add(l, 0.07 * size, w, a * 0.55, 0, 0.06 * size, '#ffffff', -0.7);
  return v.build();
}

function basicMat(color, opacity = 1) {
  return new THREE.MeshBasicMaterial({
    color,
    transparent: opacity < 1,
    opacity,
    depthWrite: opacity >= 1,
  });
}

function frontArrow(y, size = 1) {
  const m = new THREE.Mesh(chevronGeo(size), basicMat(CREAM));
  m.position.y = y;
  return m;
}

function mouthArrow(color, size = 1) {
  return new THREE.Mesh(chevronGeo(size), basicMat(color));
}



function pillars(v, baseY) {
  if (baseY <= 0) return;
  const post = '#6b5638';
  for (const px of [-0.42, 0.42]) {
    for (const pz of [-0.42, 0.42]) {
      v.add(0.12, baseY, 0.12, px, -baseY / 2 + 0.06, pz, post);
    }
  }
}

// M1.5-D4: soportes del ventilador elevado (N1/N2). SOLO visuales, sin
// collider: no bloquean el camino del nivel de abajo (igual que el puente).
function fanSupportsGeo(baseY) {
  if (baseY <= 0) return null;
  const v = voxelBuilder();
  pillars(v, baseY);
  return v.build();
}

function pal(age) {
  return AGE_PALETTES[Math.max(0, Math.min(age || 0, AGE_PALETTES.length - 1))];
}

const CHANNEL_TYPES = new Set(['recta', 'curva', 'embudo', 'union', 'divisor', 'rebote']);

function isChannelType(type) {
  return CHANNEL_TYPES.has(type);
}

// M1.5-D4: piezas cuya colocación/retiro cambia las aperturas vecinas.
function affectsOpenings(type) {
  const k = TOOLS[type]?.kind;
  return k === 'producer' || k === 'converter' || k === 'silo';
}

// M1.5-D4: aperturas tomadas de chanchos-shared (misma regla que la física:
// eje de salida + bocas de máquinas + escape con Shift). `cell/type/rot8` son
// la pieza AUTO evaluada (fantasma o refresh): si ya está en entries se usa
// la de entries (conserva noAutoConnect).
function openingsFlags(type, rot8, cell, h, entries) {
  const byKey = new Map();
  for (const [key, e] of entries) {
    const [i, j, hh] = key.split(',');
    byKey.set(key, {
      i: Number(i),
      j: Number(j),
      h: Number(hh),
      type: e.type,
      rot8: e.group.userData.rot8,
      noAutoConnect: Boolean(e.noAutoConnect),
    });
  }
  const selfKey = `${cell.i},${cell.j},${h}`;
  if (!byKey.has(selfKey)) {
    byKey.set(selfKey, { i: cell.i, j: cell.j, h, type, rot8, noAutoConnect: false });
  }
  const flags = computeLevelOpenings([...byKey.values()]).get(selfKey);
  return flags || { N: false, E: false, S: false, W: false };
}

// buildChannelGeo trabaja en el marco local de la pieza (el grupo se rota
// aparte). Convertimos aperturas mundo N/E/S/W a front/right/back/left.
function localOpenSidesFromWorld(rot8, openWorld) {
  const q = ((Math.round((rot8 || 0) / 2) % 4) + 4) % 4;
  const worlds = ['N', 'E', 'S', 'W'];
  const sides = ['front', 'right', 'back', 'left'];
  const local = { front: false, right: false, back: false, left: false };
  for (let wi = 0; wi < worlds.length; wi++) {
    const li = (((wi - q) % 4) + 4) % 4;
    local[sides[li]] = Boolean(openWorld && openWorld[worlds[wi]]);
  }
  return local;
}

function buildChannelGeo(type, baseY, age = 0, openWorld = null, rot8 = 0) {
  const P = pal(age);
  const wood = P.wood;
  const woodDark = P.dark;
  const floorC = '#9a9aa2';
  const floorRebound = '#7d8a96';
  const v = voxelBuilder();
  const o = localOpenSidesFromWorld(
    rot8,
    openWorld || { N: false, E: false, S: false, W: false },
  );
  const floorColor = type === 'rebote' ? floorRebound : floorC;

  // Levanto la losa 0.02 sobra del plano del suelo (y=0). Antes: cara
  // inferior exactamente en y=0 → coplanar con el piso → z-fighting/shimmer.
  const floorCenterY = 0.02;
  v.add(1, 0.06, 1, 0, floorCenterY, 0, floorColor);

  // M1.5-D4: pared 0.6 de alto (centro 0.32) — igual que la física (CHANNEL_WALL_H),
  // por encima de la boca de salida (y=0.55) para que nada salga volando.
  if (!o.left) v.add(0.1, 0.6, 1, -0.45, 0.32, 0, wood);
  if (!o.right) v.add(0.1, 0.6, 1, 0.45, 0.32, 0, wood);
  if (!o.front) v.add(1, 0.6, 0.1, 0, 0.32, -0.45, wood);
  if (!o.back) v.add(1, 0.6, 0.1, 0, 0.32, 0.45, wood);

  if (type === 'curva') {
    // M1.5-D4 punto 4: guía en L ORTOGONAL en la esquina interior
    // (marco local: frente -z, entrada +x). Sin diagonales: la física guía
    // por redirección (updateCurvas) y el camino pasa al sudoeste de la L.
    // Brazos finos pegados a la esquina para no estrangular el canal.
    v.add(0.14, 0.5, 0.4, 0.43, 0.26, -0.3, wood);
    v.add(0.4, 0.5, 0.14, 0.3, 0.26, -0.43, wood);
  } else if (type === 'embudo') {
    v.add(0.94, 0.5, 0.1, -0.36, 0.26, 0, wood, (-75 * Math.PI) / 180);
    v.add(0.94, 0.5, 0.1, 0.36, 0.26, 0, wood, (75 * Math.PI) / 180);
    v.add(0.5, 0.1, 0.12, 0, 0.06, 0.5, GOLD);
  } else if (type === 'union') {
    v.add(0.64, 0.5, 0.08, 0.2, 0.26, 0.15, wood, (-45 * Math.PI) / 180);
    v.add(0.64, 0.5, 0.08, -0.2, 0.26, 0.15, wood, (45 * Math.PI) / 180);
    v.add(0.5, 0.1, 0.1, 0, 0.56, 0.45, woodDark);
  } else if (type === 'divisor') {
    v.add(0.16, 0.1, 0.16, -0.45, 0.56, -0.45, GOLD);
    v.add(0.16, 0.1, 0.16, 0.45, 0.56, -0.45, GOLD);
  } else if (type === 'rebote') {
    v.add(0.5, 0.1, 0.12, 0, 0.06, -0.5, GOLD);
  }

  pillars(v, baseY);
  return v.build();
}

// Puente: barandas altas a N1, SIN pilares — el espacio N0 queda libre para
// que otro camino cruce por debajo.
function buildBridgeGeo(age = 0) {
  const P = pal(age);
  const v = voxelBuilder();
  v.add(1, 0.06, 1, 0, -0.03, 0, '#9a9aa2');
  v.add(0.1, 0.8, 1, -0.48, 0.4, 0, P.wood);
  v.add(0.1, 0.8, 1, 0.48, 0.4, 0, P.wood);
  for (const px of [-0.48, 0.48]) {
    for (const pz of [-0.45, 0.45]) {
      v.add(0.15, 0.9, 0.15, px, 0.45, pz, P.dark);
    }
  }
  v.add(0.16, 0.12, 0.16, -0.48, 0.86, 0, GOLD); // remate superior
  v.add(0.16, 0.12, 0.16, 0.48, 0.86, 0, GOLD);
  return v.build();
}

function buildRampGeo(baseY, age = 0) {
  const v = voxelBuilder();
  const wood = pal(age).wood;
  v.add(0.9, 0.08, 1.41, 0, 0, 0, wood);
  v.add(0.95, 0.05, 0.12, 0, 0.06, -0.64, GOLD);
  v.add(0.1, 0.6, 1.41, -0.46, 0.3, 0, '#6b5233');
  v.add(0.1, 0.6, 1.41, 0.46, 0.3, 0, '#6b5233');
  if (baseY > 0.5) {
    // soportes traseros hasta el suelo (marco sin inclinar: se agregan aparte)
    v.add(0.12, 0.4, 0.12, -0.42, -0.5, 0.6, '#6b5633');
    v.add(0.12, 0.4, 0.12, 0.42, -0.5, 0.6, '#6b5633');
  }
  return v.build();
}

function buildFanGeo(tier = 0, age = 0) {
  const v = voxelBuilder();
  const P = pal(age);
  const dark = P.dark;
  const teal = FAN_TIER_COLORS[Math.max(0, Math.min(tier, FAN_TIER_COLORS.length - 1))] || '#4a9e94';
  const head = 0.34 + tier * 0.05; // cada tier cabezal más grande
  v.add(0.5, 0.1, 0.5, 0, 0.05, 0, dark); // base
  v.add(0.2, 0.9, 0.2, 0.35, 0.5, 0.35, dark); // mástil en esquina
  v.add(0.5, 0.1, 0.1, 0.18, 0.9, 0.18, dark, Math.PI / 4); // brazo al cabezal
  v.add(head, head, 0.3, 0, 0.95, 0, teal); // cabezal (color = tier)
  v.add(0.4, 0.06, 0.06, 0, 0.95, -0.18, GOLD);
  if (tier >= 3) v.add(0.2, 0.2, 0.2, 0.35, 1.0, 0.35, GOLD); // remate metal Fábrica
  return v.build();
}

function mouthBox(v, y = 0.35) {
  v.add(0.5, 0.3, 0.12, 0, y, -0.36, DARK); // abertura frontal
}

function buildProducerGeo(type, age = 0) {
  const P = pal(age);
  const v = voxelBuilder();
  if (type === 'sembrador') {
    const metal = P.metal;
    v.add(0.6, 0.5, 0.6, 0, 0.25, 0, metal);
    v.add(0.44, 0.3, 0.44, 0, 0.62, 0, '#7d8794');
    v.add(0.5, 0.12, 0.5, 0, 0.82, 0, GOLD);
    mouthBox(v);
  } else if (type === 'calabacera') {
    v.add(0.9, 0.18, 0.9, 0, 0.09, 0, '#5c4326'); // tierra
    v.add(0.08, 0.06, 0.8, -0.2, 0.2, 0, '#5c8a2a'); // enredaderas
    v.add(0.08, 0.06, 0.8, 0.2, 0.2, 0, '#5c8a2a');
    v.add(0.3, 0.28, 0.3, -0.2, 0.3, -0.1, '#e08a3c'); // calabazas deco
    v.add(0.24, 0.22, 0.24, 0.22, 0.27, 0.15, '#d97f33');
    v.add(0.4, 0.3, 0.1, 0, 0.15, -0.42, '#4a3820'); // boca: tranquera
  } else if (type === 'salinera') {
    v.add(0.82, 0.22, 0.82, 0, 0.11, 0, '#d8dae2');
    v.add(0.7, 0.3, 0.7, 0, 0.38, 0, '#ececf0');
    v.add(0.22, 0.18, 0.22, -0.2, 0.6, 0.15, '#ffffff');
    v.add(0.4, 0.26, 0.1, 0, 0.16, -0.42, '#4a3820');
  } else if (type === 'pienso') {
    // M1.5-F5: maíz entra por la izquierda (oeste), calabaza por la derecha
    // (este); cada entrada tiene su colador tricolor sobre la cara abierta.
    v.add(0.86, 0.78, 0.86, 0, 0.39, 0, '#6e5a46');
    v.add(0.7, 0.14, 0.7, 0, 0.84, 0, GOLD);
    v.add(0.22, 0.4, 0.22, -0.22, 0.95, 0.12, '#9a9aa2'); // tolva izquierda (maíz)
    v.add(0.22, 0.4, 0.22, 0.22, 0.95, 0.12, '#9a9aa2'); // tolva derecha (calabaza)
    // Boca frontal sobresale (casco llega a −0.43; la boca queda afuera).
    v.add(0.5, 0.3, 0.12, 0, 0.44, -0.48, GOLD);
    v.add(0.3, 0.2, 0.1, 0, 0.44, -0.52, DARK);
    // Entradas por costado: hueco dark + tinte del ingrediente en la mitad
    v.add(0.5, 0.3, 0.1, -0.42, 0.42, 0.42, TEAL); // trasera izquierda (oeste→maíz)
    v.add(0.5, 0.3, 0.1, 0.42, 0.42, 0.42, '#e08a3c'); // trasera derecha (este→calabaza)
    // Ícono voxel del ingrediente contra la cara lateral (inspirado ayuda daltonico)
    v.add(0.16, 0.16, 0.16, -0.58, 0.52, 0, '#f2c94c'); // maíz al oeste (amarillo)
    v.add(0.06, 0.06, 0.06, -0.58, 0.62, 0, '#7fae4a');
    v.add(0.2, 0.18, 0.2, 0.58, 0.52, 0, '#e08a3c'); // calabaza al este (naranja)
    v.add(0.08, 0.08, 0.08, 0.58, 0.62, 0, '#5c8a2a');
  } else if (type === 'corral') {
    const fence = '#8a5f36';
    for (const px of [-0.42, 0.42]) {
      for (const pz of [-0.42, 0.42]) {
        v.add(0.12, 0.55, 0.12, px, 0.27, pz, fence);
      }
    }
    v.add(0.96, 0.1, 0.1, 0, 0.45, -0.42, fence);
    v.add(0.96, 0.1, 0.1, -0.24, 0.45, 0.42, fence);
    v.add(0.1, 0.1, 0.96, -0.42, 0.45, 0, fence);
    v.add(0.1, 0.1, 0.96, 0.42, 0.45, 0, fence);
    v.add(0.7, 0.12, 0.7, 0, 0.06, 0, '#c9a86a'); // heno
    v.add(0.3, 0.24, 0.3, 0.05, 0.24, -0.05, '#f4a8bd'); // cerdito residente
    v.add(0.5, 0.34, 0.1, 0.22, 0.17, -0.42, DARK); // boca salida: portón abierto
    v.add(0.5, 0.34, 0.1, -0.22, 0.17, 0.42, DARK); // boca entrada trasera (choclos)
    // banda de edad en el marco
    v.add(0.96, 0.08, 0.96, 0, 0.56, 0, pal(age).accent);
  } else if (type === 'palomitera') {
    const red = age >= 3 ? P.metal : '#b04a3e';
    v.add(0.66, 0.7, 0.66, 0, 0.35, 0, red);
    v.add(0.7, 0.1, 0.7, 0, 0.75, 0, GOLD);
    v.add(0.3, 0.25, 0.3, 0, 0.92, 0.1, '#7d8794'); // tolva superior
    v.add(0.16, 0.4, 0.16, -0.2, 1.0, -0.15, '#5d6673'); // chimenea
    mouthBox(v);
    v.add(0.5, 0.3, 0.12, 0, 0.35, 0.36, DARK); // abertura trasera (entrada)
  } else if (type === 'jamonera') {
    const iron = age >= 3 ? P.metal : '#4a4f58';
    v.add(0.8, 0.85, 0.8, 0, 0.42, 0, iron);
    v.add(0.84, 0.12, 0.84, 0, 0.9, 0, '#2b2620');
    v.add(0.2, 0.5, 0.2, 0.2, 1.15, -0.1, '#6b7078'); // chimenea
    v.add(0.14, 0.5, 0.14, -0.25, 0.5, 0.32, '#7d8794'); // caños
    v.add(0.2, 0.14, 0.14, -0.25, 0.78, 0.32, '#7d8794');
    mouthBox(v, 0.4);
    v.add(0.55, 0.35, 0.12, 0, 0.4, 0.4, DARK); // abertura trasera (entrada)
  } else if (type === 'jamonera_industrial') {
    const iron = age >= 3 ? P.metal : '#4a4f58';
    v.add(0.9, 0.9, 0.9, 0, 0.45, 0, iron);
    v.add(0.84, 0.14, 0.84, 0, 0.96, 0, '#2b2620');
    v.add(0.18, 0.58, 0.18, -0.25, 1.08, -0.15, '#6b7078');
    v.add(0.18, 0.58, 0.18, 0.25, 1.08, -0.15, '#6b7078');
    // Boca de salida frontal dorada, sobresaliendo de la cara (0.48 vs pared
    // 0.45): el cuerpo de la curadora llega hasta z=-0.45, una boca en
    // -0.36/-0.38 quedaría enterrada dentro del casco (era el bug visual).
    v.add(0.5, 0.3, 0.12, 0, 0.44, -0.48, GOLD);
    v.add(0.3, 0.2, 0.1, 0, 0.44, -0.52, DARK);
    // Entradas por costado (M1.5-F5): hueco lateral W (cerdo) y E (sal).
    v.add(0.12, 0.3, 0.45, -0.48, 0.44, 0, '#f4a8bd'); // oeste: cerdo (rosa)
    v.add(0.12, 0.3, 0.45, 0.48, 0.44, 0, '#ececf0'); // este: sal (blanca)
    // Ícono del ingrediente a cada lado (pata del cerdito y cristal de sal).
    v.add(0.12, 0.12, 0.12, -0.58, 0.5, 0, '#e07b96');
    v.add(0.12, 0.12, 0.12, 0.58, 0.5, 0, '#ffffff');
  } else if (type === 'silo') {
    // M1.5-F4: tanque vertical con entrada trasera (oscura) y boca frontal
    // (dorada): aberturas físicas distintas para cada lado.
    const tank = age >= 2 ? P.metal : '#7d8794';
    v.add(0.9, 0.12, 0.9, 0, 0.06, 0, '#5c4326'); // base
    v.add(0.7, 0.9, 0.7, 0, 0.57, 0, tank); // cuerpo
    v.add(0.74, 0.1, 0.74, 0, 1.02, 0, pal(age).accent); // aro de edad
    v.add(0.5, 0.22, 0.5, 0, 1.18, 0, '#5d6673'); // techo
    v.add(0.18, 0.14, 0.18, 0, 1.32, 0, GOLD); // remate
    v.add(0.5, 0.3, 0.12, 0, 0.35, -0.36, GOLD); // boca frontal (salida)
    v.add(0.3, 0.2, 0.1, 0, 0.35, -0.38, DARK);
    v.add(0.5, 0.3, 0.12, 0, 0.35, 0.36, DARK); // abertura trasera (entrada)
  }
  return v.build();
}

export class ToolManager {
  constructor(scene) {
    this.scene = scene;
    this.currentAge = 0;
    this.currentFanTier = 0;
    this.bodyMat = voxelMaterial();
    this.lampMat = new THREE.MeshLambertMaterial({ color: GOLD });
    this.lampGeo = new THREE.BoxGeometry(0.14, 0.14, 0.14);
    this.armGeo = new THREE.BoxGeometry(0.5, 0.1, 0.04);
    this.armGeo.translate(0.27, 0, 0);
    this.fanGeos = [0, 1, 2, 3].map((t) => buildFanGeo(t, 0));
    this.fanGeo = this.fanGeos[0];
    this.coneGeoCache = new Map();
    const baseCone = fanConeParams({ fanTier: 0, dir: { x: 0, z: -1 }, pitchDeg: 0, cx: 0, cy: 0, cz: 0 });
    this.coneGeo = this.getConeGeo(baseCone.range, baseCone.halfAngleTan);
    this.coneMat = basicMat(TEAL, 0.16);
    this.coneMat.side = THREE.DoubleSide;
    this.jamGeo = voxelBuilder().add(0.22, 0.22, 0.22, 0, 0, 0, RED).add(0.12, 0.12, 0.12, 0, -0.3, 0, RED).build();
    this.jamMat = basicMat(RED);
    this.entries = new Map(); // "i,j,h" -> { group, anim, jamMarker }

    // fantasma de colocación
    this.ghost = new THREE.Group();
    this.ghostBodyMat = new THREE.MeshLambertMaterial({
      color: '#7fae4a',
      transparent: true,
      opacity: 0.45,
      depthWrite: false,
    });
    this.ghostArrowMats = {
      front: basicMat(CREAM, 0.75),
      out: basicMat(GOLD, 0.75),
      in: basicMat(TEAL, 0.75),
    };
    this.ghost.visible = false;
    scene.add(this.ghost);

    // cono persistente (ventilador seleccionado)
    this.selCone = new THREE.Mesh(this.coneGeo, this.coneMat);
    this.selCone.visible = false;
    scene.add(this.selCone);

    // M1.5-C: flechas solo en preview/selección/hover o con "mostrar todas" (G).
    // Pieza colocada sin flechas flotantes (el modelo ya tiene aberturas físicas).
    this.showAllDirs = false;
    this.selectedKey = null;
    this.hoverKey = null;

    // anillo de selección
    this.ring = new THREE.Mesh(
      new THREE.RingGeometry(0.45, 0.62, 24),
      basicMat(CREAM, 0.9),
    );
    this.ring.rotation.x = -Math.PI / 2;
    this.ring.visible = false;
    scene.add(this.ring);
  }

  orientCone(mesh, ox, oy, oz, axis) {
    const range = mesh.userData.range || 0;
    mesh.position.set(ox + axis.x * (range / 2), oy + axis.y * (range / 2), oz + axis.z * (range / 2));
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(axis.x, axis.y, axis.z));
  }

  getConeGeo(range, halfAngleTan) {
    const key = `${range.toFixed(4)}|${halfAngleTan.toFixed(4)}`;
    if (!this.coneGeoCache.has(key)) {
      this.coneGeoCache.set(key, new THREE.ConeGeometry(range * halfAngleTan, range, 20, 1, true));
    }
    return this.coneGeoCache.get(key);
  }

  applyConeParams(mesh, params, originOverride = null) {
    mesh.geometry = this.getConeGeo(params.range, params.halfAngleTan);
    mesh.userData.range = params.range;
    const o = originOverride || params.origin;
    this.orientCone(mesh, o.x, o.y, o.z, params.direction);
  }

  toPitchDeg(axis) {
    return (Math.asin(Math.max(-1, Math.min(1, axis.y))) * 180) / Math.PI;
  }

  toDir2(axis) {
    const len = Math.hypot(axis.x, axis.z) || 1;
    return { x: axis.x / len, z: axis.z / len };
  }

  refreshChannelAndNeighbors(i, j, h) {
    const cells = [
      { i, j },
      { i: i + 1, j },
      { i: i - 1, j },
      { i, j: j + 1 },
      { i, j: j - 1 },
    ];
    for (const c of cells) {
      const key = `${c.i},${c.j},${h}`;
      const e = this.entries.get(key);
      if (!e || !isChannelType(e.type)) continue;
      const opens = openingsFlags(e.type, e.group.userData.rot8, c, h, this.entries);
      const oldMesh = e.group.userData.bodyMesh;
      const newMesh = new THREE.Mesh(
        buildChannelGeo(e.type, h * LEVEL_H, e.age, opens, e.group.userData.rot8),
        this.bodyMat,
      );
      newMesh.castShadow = true;
      newMesh.receiveShadow = true;
      if (oldMesh) e.group.remove(oldMesh);
      e.group.add(newMesh);
      e.group.userData.bodyMesh = newMesh;
      if (oldMesh && oldMesh.geometry) oldMesh.geometry.dispose();
    }
  }

  // M1.5-B: la UI llama setAge/setFanTier al subir de edad; las piezas nuevas
  // usan esa paleta/tier. refreshAges() reconstruye color de piezas viejas
  // solo si el agente UI quiere (barato: no se llama por frame).
  setAge(age) {
    this.currentAge = Math.max(0, Math.min(age || 0, 3));
    this.fanGeos = [0, 1, 2, 3].map((t) => buildFanGeo(t, this.currentAge));
    this.fanGeo = this.fanGeos[Math.max(0, Math.min(this.currentFanTier, 3))];
  }

  setFanTier(tier) {
    this.currentFanTier = Math.max(0, Math.min(tier || 0, 3));
    this.fanGeo = this.fanGeos[this.currentFanTier];
  }

  fanGeoFor(tier) {
    return this.fanGeos[Math.max(0, Math.min(tier || 0, 3))];
  }

  // M1.5-C: visibilidad de direcciones (reutiliza las flechas del preview/selección).
  setShowAllDirs(v) {
    this.showAllDirs = Boolean(v);
    this.refreshArrows();
  }

  setSelectedKey(key) {
    this.selectedKey = key;
    this.refreshArrows();
  }

  setHoverKey(key) {
    if (this.hoverKey === key) return;
    this.hoverKey = key;
    this.refreshArrows();
  }

  refreshArrows() {
    for (const [key, entry] of this.entries) {
      const arrows = entry.group.userData.arrows;
      if (!arrows) continue;
      const vis = this.showAllDirs || key === this.selectedKey || key === this.hoverKey;
      for (const a of arrows) a.visible = vis;
    }
  }

  buildArrows(group, type, pitchDeg) {
    const arrows = [];
    const front = frontArrow(type === 'rampa' ? 0.55 : 1.35, type === 'fan' ? 0.9 : 1);
    if (type === 'rampa') front.position.z = -0.35;
    group.add(front);
    arrows.push(front);
    const def = TOOLS[type];
    if (def.kind === 'producer' || def.kind === 'converter' || def.kind === 'silo') {
      const out = mouthArrow(GOLD, 0.85);
      out.position.set(0, 0.45, -0.78);
      group.add(out);
      arrows.push(out);
      if (def.kind === 'converter' || def.kind === 'silo') {
        // M1.5-F5: con recetas por costado hay una flecha teal por entrada;
        // de lo contrario y para silo queda una sola trasera.
        const sides = def.inputSides ? Object.values(def.inputSides) : ['back'];
        for (const side of sides) {
          const inp = mouthArrow(TEAL, 0.85);
          if (side === 'left') { inp.position.set(-0.78, 0.45, 0); inp.rotation.y = -Math.PI / 2; }
          else if (side === 'right') { inp.position.set(0.78, 0.45, 0); inp.rotation.y = Math.PI / 2; }
          else if (side === 'front') { inp.position.set(0, 0.45, -0.78); inp.rotation.y = 0; }
          else { inp.position.set(0, 0.45, 0.78); inp.rotation.y = Math.PI; }
          group.add(inp);
          arrows.push(inp);
        }
      }
    } else if (type === 'union') {
      // salida al frente (dorada) + dos entradas laterales (teal)
      const out = mouthArrow(GOLD, 0.85);
      out.position.set(0, 0.45, -0.78);
      group.add(out);
      arrows.push(out);
      for (const sx of [1, -1]) {
        const inp = mouthArrow(TEAL, 0.85);
        inp.position.set(0.78 * sx, 0.45, 0);
        inp.rotation.y = (sx > 0 ? 1 : -1) * (Math.PI / 2);
        group.add(inp);
        arrows.push(inp);
      }
    } else if (type === 'divisor') {
      // entrada trasera (teal) + dos salidas laterales (doradas)
      const inp = mouthArrow(TEAL, 0.85);
      inp.position.set(0, 0.45, 0.78);
      inp.rotation.y = Math.PI;
      group.add(inp);
      arrows.push(inp);
      for (const sx of [1, -1]) {
        const out = mouthArrow(GOLD, 0.85);
        out.position.set(0.78 * sx, 0.45, 0);
        out.rotation.y = (sx > 0 ? -1 : 1) * (Math.PI / 2);
        group.add(out);
        arrows.push(out);
      }
    }
    group.userData.arrows = arrows;
  }

  add(type, i, j, h, rot8, pitchDeg, opts = {}) {
    const key = i + ',' + j + ',' + h;
    const age = opts.age ?? this.currentAge ?? 0;
    const fanTier = opts.fanTier ?? this.currentFanTier ?? 0;
    const baseY = h * LEVEL_H;
    const group = new THREE.Group();
    group.position.set(i - HALF_GRID + 0.5, baseY, j - HALF_GRID + 0.5);
    group.rotation.y = rotToYaw(rot8);
    group.userData.rot8 = rot8;
    const entry = {
      group,
      type,
      anim: null,
      jamMarker: null,
      baseBob: Math.random() * 6,
      age,
      fanTier,
      noAutoConnect: Boolean(opts.noAutoConnect), // M1.5-D4: Shift
    };

    if (isChannelType(type)) {
      const opens = openingsFlags(type, rot8, { i, j }, h, this.entries);
      const mesh = new THREE.Mesh(buildChannelGeo(type, baseY, age, opens, rot8), this.bodyMat);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      group.add(mesh);
      group.userData.bodyMesh = mesh;
      this.buildArrows(group, type);
    } else if (type === 'puente') {
      const mesh = new THREE.Mesh(buildBridgeGeo(age), this.bodyMat);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      group.add(mesh);
      this.buildArrows(group, type);
    } else if (type === 'rampa') {
      const tilted = new THREE.Group();
      tilted.position.y = -0.538;
      tilted.rotation.x = RAMP_TILT;
      const mesh = new THREE.Mesh(buildRampGeo(baseY, age), this.bodyMat);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      tilted.add(mesh);
      group.add(tilted);
      this.buildArrows(group, type);
    } else if (type === 'fan') {
      const mesh = new THREE.Mesh(this.fanGeoFor(fanTier), this.bodyMat);
      mesh.castShadow = true;
      group.add(mesh);
      const supGeo = fanSupportsGeo(baseY);
      if (supGeo) group.add(new THREE.Mesh(supGeo, this.bodyMat));
      const head = new THREE.Group();
      head.position.set(0, 0.95, 0);
      head.rotation.x = ((pitchDeg || 0) * Math.PI) / 180;
      const blades = new THREE.Group();
      blades.position.z = -0.22;
      for (let b = 0; b < 3; b++) {
        const arm = new THREE.Mesh(this.armGeo, this.bodyMat);
        arm.rotation.z = (b * Math.PI * 2) / 3;
        blades.add(arm);
      }
      head.add(blades);
      group.add(head);
      // M1.5-G: las aspas giran con la potencia ajustada (feedback visual).
      const vis = { power: 1 };
      entry.vis = vis;
      entry.anim = (t) => {
        blades.rotation.z = (t / 90) * (0.35 + 0.65 * (vis.power ?? 1));
      };
      this.buildArrows(group, type);
    } else {
      const mesh = new THREE.Mesh(buildProducerGeo(type, age), this.bodyMat);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      group.add(mesh);
      if (type === 'silo') {
        // M1.5-F4: soportes en N1/N2 (igual que el ventilador elevado).
        const supGeo = fanSupportsGeo(baseY);
        if (supGeo) group.add(new THREE.Mesh(supGeo, this.bodyMat));
      }
      if (type === 'sembrador') {
        const lamp = new THREE.Mesh(this.lampGeo, this.lampMat);
        lamp.position.set(0.2, 0.95, 0.2);
        group.add(lamp);
        entry.anim = (t) => {
          lamp.scale.setScalar(0.9 + 0.25 * Math.sin(t / 130));
        };
      }
      this.buildArrows(group, type);
    }

    this.entries.set(key, entry);
    this.scene.add(group);
    // M1.5-D4: productores/conversores también cambian aperturas vecinas.
    if (isChannelType(type) || affectsOpenings(type)) this.refreshChannelAndNeighbors(i, j, h);
    this.refreshArrows();
  }

  remove(i, j, h) {
    const key = i + ',' + j + ',' + h;
    const entry = this.entries.get(key);
    if (!entry) return null;
    if (key === this.selectedKey) this.selectedKey = null;
    if (key === this.hoverKey) this.hoverKey = null;
    this.scene.remove(entry.group);
    this.entries.delete(key);
    if (isChannelType(entry.type) || affectsOpenings(entry.type)) {
      this.refreshChannelAndNeighbors(i, j, h);
    }
    return entry;
  }

  clearGroup(gr) {
    while (gr.children.length) gr.remove(gr.children[0]);
  }

  // M1.5-G: fanTune = { powerPct, rangeCells, rangeBonus } para el cono fantasma.
  showGhost(type, rot8, pitchDeg, cell, h, valid, fanAxis, fanTune = null) {
    const g = this.ghost;
    if (!type || !cell) {
      g.visible = false;
      return;
    }
    this.clearGroup(g);
    g.visible = true;
    const baseY = h * LEVEL_H;
    g.position.set(cell.i - HALF_GRID + 0.5, baseY, cell.j - HALF_GRID + 0.5);
    g.rotation.set(0, rotToYaw(rot8), 0);
    this.ghostBodyMat.color.set(valid ? '#7fae4a' : '#e05252');

    let geo = null;
    if (isChannelType(type)) {
      const opens = openingsFlags(type, rot8, cell, h, this.entries);
      geo = buildChannelGeo(type, baseY, this.currentAge, opens, rot8);
    } else if (type === 'puente') {
      geo = buildBridgeGeo(this.currentAge);
    } else if (type === 'rampa') {
      const tilted = new THREE.Group();
      tilted.position.y = -0.538;
      tilted.rotation.x = RAMP_TILT;
      tilted.add(new THREE.Mesh(buildRampGeo(baseY, this.currentAge), this.ghostBodyMat));
      g.add(tilted);
    } else if (type === 'fan') {
      geo = this.fanGeoFor(this.currentFanTier);
    } else {
      geo = buildProducerGeo(type, this.currentAge);
    }
    if (geo) {
      const m = new THREE.Mesh(geo, this.ghostBodyMat);
      g.add(m);
    }
    if (type === 'fan' || type === 'silo') {
      const supGeo = fanSupportsGeo(baseY);
      if (supGeo) g.add(new THREE.Mesh(supGeo, this.ghostBodyMat));
    }
    const front = new THREE.Mesh(chevronGeo(type === 'fan' ? 0.9 : 1), this.ghostArrowMats.front);
    front.position.y = type === 'rampa' ? 0.55 : 1.35;
    if (type === 'rampa') front.position.z = -0.35;
    g.add(front);
    const def = TOOLS[type];
    if (def && (def.kind === 'producer' || def.kind === 'converter' || def.kind === 'silo')) {
      const out = new THREE.Mesh(chevronGeo(0.85), this.ghostArrowMats.out);
      out.position.set(0, 0.45, -0.78);
      g.add(out);
      if (def.kind === 'converter' || def.kind === 'silo') {
        const sides = def.inputSides ? Object.values(def.inputSides) : ['back'];
        for (const side of sides) {
          const inp = new THREE.Mesh(chevronGeo(0.85), this.ghostArrowMats.in);
          if (side === 'left') { inp.position.set(-0.78, 0.45, 0); inp.rotation.y = -Math.PI / 2; }
          else if (side === 'right') { inp.position.set(0.78, 0.45, 0); inp.rotation.y = Math.PI / 2; }
          else if (side === 'front') { inp.position.set(0, 0.45, -0.78); inp.rotation.y = 0; }
          else { inp.position.set(0, 0.45, 0.78); inp.rotation.y = Math.PI; }
          g.add(inp);
        }
      }
    } else if (type === 'union') {
      const out = new THREE.Mesh(chevronGeo(0.85), this.ghostArrowMats.out);
      out.position.set(0, 0.45, -0.78);
      g.add(out);
      for (const sx of [1, -1]) {
        const inp = new THREE.Mesh(chevronGeo(0.85), this.ghostArrowMats.in);
        inp.position.set(0.78 * sx, 0.45, 0);
        inp.rotation.y = (sx > 0 ? 1 : -1) * (Math.PI / 2);
        g.add(inp);
      }
    } else if (type === 'divisor') {
      const inp = new THREE.Mesh(chevronGeo(0.85), this.ghostArrowMats.in);
      inp.position.set(0, 0.45, 0.78);
      inp.rotation.y = Math.PI;
      g.add(inp);
      for (const sx of [1, -1]) {
        const out = new THREE.Mesh(chevronGeo(0.85), this.ghostArrowMats.out);
        out.position.set(0.78 * sx, 0.45, 0);
        out.rotation.y = (sx > 0 ? -1 : 1) * (Math.PI / 2);
        g.add(out);
      }
    }
    if (type === 'fan') {
      const cone = new THREE.Mesh(this.coneGeo, this.coneMat);
      // M1.5-G: el fantasma muestra los ajustes copiados (o defaults 100/máx).
      const p = fanConeParams({
        fanTier: this.currentFanTier,
        dir: { x: 0, z: -1 },
        pitchDeg: pitchDeg || 0,
        cx: 0,
        cy: 0,
        cz: 0,
        rangeBonus: Number.isFinite(fanTune?.rangeBonus) ? fanTune.rangeBonus : 0,
        powerPct: fanTune?.powerPct,
        rangeCells: fanTune?.rangeCells ?? null,
      });
      this.applyConeParams(cone, p);
      g.add(cone);
    }
  }

  // M1.5-G: tune = { powerPct, rangeCells, rangeBonus } del sim; el cono usa
  // la misma fuente única (fanConeParams) que la física.
  showSelectionCone(x, y, z, axis, tune = null) {
    if (!axis) {
      this.selCone.visible = false;
      return;
    }
    const selected = this.selectedKey ? this.entries.get(this.selectedKey) : null;
    const tier = selected && selected.type === 'fan' ? selected.fanTier ?? this.currentFanTier : this.currentFanTier;
    const tierInfo = FAN_TIERS[Math.max(0, Math.min(tier || 0, FAN_TIERS.length - 1))] || FAN_TIERS[0];
    const params = fanConeParams({
      fanTier: tier,
      dir: this.toDir2(axis),
      pitchDeg: this.toPitchDeg(axis),
      cx: x,
      cy: y - (tierInfo?.originY || 0),
      cz: z,
      rangeBonus: Number.isFinite(tune?.rangeBonus) ? tune.rangeBonus : 0,
      powerPct: tune?.powerPct,
      rangeCells: tune?.rangeCells ?? null,
    });
    this.selCone.visible = true;
    this.applyConeParams(this.selCone, params);
  }

  selectAt(x, y, z) {
    this.ring.visible = true;
    this.ring.position.set(x, y + 0.04, z);
  }

  clearSelection() {
    this.ring.visible = false;
    this.selCone.visible = false;
  }

  syncJamMarkers(tools, now) {
    for (const [key, entry] of this.entries) {
      const sim = tools.get(key);
      const jammed = sim && now < sim.jamUntil;
      if (jammed && !entry.jamMarker) {
        const marker = new THREE.Mesh(this.jamGeo, this.jamMat);
        const h = sim.h * LEVEL_H;
        marker.position.y = h + 1.6;
        entry.group.add(marker);
        entry.jamMarker = marker;
      } else if (!jammed && entry.jamMarker) {
        entry.group.remove(entry.jamMarker);
        entry.jamMarker = null;
      }
    }
  }

  update(t, tools, now) {
    for (const [key, entry] of this.entries) {
      // M1.5-G: sincroniza potencia visual con el ajuste del sim.
      if (entry.type === 'fan' && entry.vis) {
        const s = tools.get(key);
        entry.vis.power = ((s?.powerPct ?? 100) / 100);
      }
      if (entry.anim) entry.anim(t);
      if (entry.jamMarker) {
        entry.jamMarker.position.y += Math.sin(t / 180 + entry.baseBob) * 0.002;
        const s = 1 + 0.18 * Math.sin(t / 140);
        entry.jamMarker.scale.setScalar(s);
      }
      const arrows = entry.group.userData.arrows;
      if (arrows) {
        const bob = Math.sin(t / 300 + entry.baseBob) * 0.05;
        for (const a of arrows) {
          if (!a.userData.baseY) a.userData.baseY = a.position.y;
          a.position.y = a.userData.baseY + bob;
        }
      }
    }
    this.syncJamMarkers(tools, now);
  }
}
