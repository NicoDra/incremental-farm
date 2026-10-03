// Chanchos S.A. — parcela voxel 16x16, muros, portal de depósito, paletas por nivel
import * as THREE from 'three';
import { GRID_SIZE, HALF_GRID, GAP_CELLS } from 'chanchos-shared';
import { voxelBuilder, voxelMaterial } from './voxel.js';

export const PALETTES = [
  { floor: '#7a5236', wall: '#8d6244', sky: '#bfd9e8' }, // barro
  { floor: '#a8763e', wall: '#8a5a2b', sky: '#c9dbe2' }, // madera
  { floor: '#9a9aa2', wall: '#7d7d86', sky: '#c2cdd6' }, // piedra
  { floor: '#565e6e', wall: '#3e4552', sky: '#9fb2c4' }, // fábrica
];

function hash01(i, j) {
  return (((i * 73856093) ^ (j * 19349663)) % 100) / 100;
}

// ── Glifos voxel 4×7 (col de bits, fila 0=arriba) ──────────────────────────
const GLYPH = {
  E: ['1111','1000','1000','1110','1000','1000','1111'],
  N: ['1001','1101','1101','1011','1011','1001','1001'],
  T: ['1111','0110','0110','0110','0110','0110','0110'],
  R: ['1110','1001','1001','1110','1100','1010','1001'],
  G: ['0111','1000','1000','1011','1001','1001','0111'],
  A: ['0110','1001','1001','1111','1001','1001','1001'],
};

// ── Cartel: letras centradas y ajustadas al ancho real del cartel ────────────
// xLeft/yBot = esquina inferior izquierda del cartel (world space)
// signW/signH = dimensiones del cartel
// zFront = z de la cara frontal del cartel (letras sobresalen 0.07)
function addSignLetters(v, text, xLeft, yBot, signW, signH, zFront) {
  const nChars = text.length;
  const cols   = GLYPH[text[0]]?.[0]?.length ?? 4; // columnas por letra
  const rows   = GLYPH[text[0]]?.length ?? 7;
  const marginX = signW * 0.07;
  const marginY = signH * 0.12;
  const usableW = signW - marginX * 2;
  const usableH = signH - marginY * 2;
  // Escala: que las 7 letras quepan horizontalmente con pequeño gap
  const gapFrac  = 0.18; // fracción del ancho de letra como gap entre letras
  // totalW = nChars * cw + (nChars-1) * cw*gapFrac = cw * (nChars + (nChars-1)*gapFrac)
  const cw = usableW / (nChars + (nChars - 1) * gapFrac);
  const ch = usableH / rows;
  const sc = Math.min(cw / cols, ch); // pixel size uniforme
  const letterW = cols * sc;
  const letterH = rows * sc;
  const gap     = letterW * gapFrac;
  // Centrar bloque de letras en el cartel
  const totalW  = nChars * letterW + (nChars - 1) * gap;
  const startX  = xLeft + marginX + (usableW - totalW) / 2;
  const startY  = yBot  + marginY + (usableH - letterH) / 2;
  const zL      = zFront + 0.04; // ligeramente por delante de la placa

  let lx = startX;
  for (const ch2 of text) {
    const m = GLYPH[ch2];
    if (!m) { lx += letterW + gap; continue; }
    for (let row = 0; row < m.length; row++) {
      for (let col = 0; col < m[row].length; col++) {
        if (m[row][col] === '1') {
          const px = lx + (col + 0.5) * sc;
          const py = startY + (m.length - 1 - row + 0.5) * sc;
          v.add(sc * 0.9, sc * 0.9, 0.07, px, py, zL, '#2a1a0a');
        }
      }
    }
    lx += letterW + gap;
  }
}

// ── Granero de entrega ────────────────────────────────────────────────────────
// Devuelve { body, doorL, doorR } — tres meshes separados.
// doorL/doorR rotan sobre eje Y; su pivote está en la bisagra (borde interior).
function buildDepotGate() {
  // Paleta Barro
  const WOOD_L  = '#a0622a';
  const WOOD_D  = '#7a4520';
  const PLANK_H = '#5a3010';
  const PLANK_R = '#3d2208';
  const DOOR_C  = '#2e1a08';
  const TRIM    = '#f2c94c';
  const SIGN_BG = '#fdf3d0';
  const METAL   = '#c8a832';

  const fz    = -(HALF_GRID - 0.02);
  const bz    = fz - 3.2;
  const midZ  = (fz + bz) / 2;
  const W     = 3.0;
  const WH    = 1.2;
  const DW    = 2.0;   // mitad ancho puerta (total 4 = gap exacto)
  const DH    = 1.15;
  const DEPTH = Math.abs(bz - fz);
  const JT    = 0.14;
  const leafW = DW - JT;

  // ── cuerpo (todo excepto las hojas de puerta) ─────────────────────────────
  const vb = voxelBuilder();
  // paredes
  vb.add(W * 2, WH, 0.16, 0, WH / 2, bz, WOOD_L);
  vb.add(0.16, WH, DEPTH, -W, WH / 2, midZ, WOOD_D);
  vb.add(0.16, WH, DEPTH,  W, WH / 2, midZ, WOOD_D);
  const sideW = W - DW;
  vb.add(sideW, WH, 0.16, -(DW + sideW / 2), WH / 2, fz, WOOD_L);
  vb.add(sideW, WH, 0.16,  (DW + sideW / 2), WH / 2, fz, WOOD_L);
  vb.add(DW * 2, WH - DH, 0.16, 0, DH + (WH - DH) / 2, fz, WOOD_L);
  // marco dorado
  vb.add(JT, DH, 0.2, -(DW - JT / 2), DH / 2, fz + 0.02, TRIM);
  vb.add(JT, DH, 0.2,  (DW - JT / 2), DH / 2, fz + 0.02, TRIM);
  vb.add(DW * 2, JT, 0.2, 0, DH - JT / 2, fz + 0.02, TRIM);
  // tejado
  const roofY  = WH + 0.08;
  const ridgeH = 0.55;
  const tW     = W + 0.22;
  for (let s = 0; s < 4; s++) {
    const frac = s / 4;
    vb.add(tW / 4 + 0.04, 0.18, DEPTH + 0.36,
      -tW + frac * tW + tW / 8,
      roofY + frac * ridgeH * 0.5 + ridgeH * 0.05,
      midZ, PLANK_H);
    vb.add(tW / 4 + 0.04, 0.18, DEPTH + 0.36,
       tW - frac * tW - tW / 8,
      roofY + frac * ridgeH * 0.5 + ridgeH * 0.05,
      midZ, PLANK_H);
  }
  vb.add(0.18, 0.22, DEPTH + 0.4, 0, roofY + ridgeH, midZ, PLANK_R);
  vb.add(W * 2, 0.18, 0.14, 0, roofY + ridgeH * 0.5, fz - 0.06, PLANK_H);
  // cartel
  const SW = DW * 2 + 0.5, SH = 0.72;
  const sZ = fz + 0.22;
  const sY = WH + SH / 2 + 0.04;
  vb.add(SW + 0.12, SH + 0.12, 0.1, 0, sY, sZ - 0.02, TRIM);
  vb.add(SW, SH, 0.12, 0, sY, sZ, SIGN_BG);
  addSignLetters(vb, 'ENTREGA', -SW / 2, sY - SH / 2, SW, SH, sZ);

  const body = new THREE.Mesh(vb.build(), voxelMaterial());
  body.castShadow = body.receiveShadow = true;

  // ── hojas de puerta separadas ─────────────────────────────────────────────
  // Cada hoja se construye con pivote en x=0 (bisagra), luego se traslada.
  // La hoja izquierda tiene bisagra en x = -(DW-JT/2); la derecha en x = +(DW-JT/2).
  // Al rotar sobre Y: positivo = abre hacia afuera (interior del granero).
  function buildLeaf(sx) {
    const vd = voxelBuilder();
    // Panel centrado en x=0 localmente; la bisagra queda en x = -sx*leafW/2
    vd.add(leafW, DH - JT, 0.1,  sx * leafW / 2, DH / 2 - JT / 2, 0, DOOR_C);
    vd.add(leafW, 0.08,    0.12, sx * leafW / 2, DH * 0.52,       0, WOOD_D);
    for (const by of [0.25, 0.85]) {
      // bisagra en el borde interior (x = 0 lado bisagra)
      vd.add(0.1, 0.1, 0.14, sx * 0.1, DH * by, 0, METAL);
    }
    const m = new THREE.Mesh(vd.build(), voxelMaterial());
    m.castShadow = true;
    // Posiciona el Group con el pivote en la bisagra
    const group = new THREE.Group();
    group.add(m);
    // bisagra en x = ±(DW - JT/2), y=0, z=fz+0.06
    group.position.set(sx * (DW - JT / 2), 0, fz + 0.06);
    return group;
  }

  const doorL = buildLeaf(-1); // bisagra en x = -(DW-JT/2), hoja hacia -x
  const doorR = buildLeaf( 1); // bisagra en x = +(DW-JT/2), hoja hacia +x

  return { body, doorL, doorR };
}

export class ParcelRenderer {
  constructor(scene) {
    this.scene = scene;
    const floorGeo = new THREE.BoxGeometry(0.94, 0.5, 0.94);
    this.floorMesh = new THREE.InstancedMesh(
      floorGeo,
      new THREE.MeshLambertMaterial({ color: '#ffffff' }),
      GRID_SIZE * GRID_SIZE,
    );
    this.floorMesh.receiveShadow = true;
    const m = new THREE.Matrix4();
    let k = 0;
    for (let i = 0; i < GRID_SIZE; i++) {
      for (let j = 0; j < GRID_SIZE; j++) {
        m.setPosition(i - HALF_GRID + 0.5, -0.25, j - HALF_GRID + 0.5);
        this.floorMesh.setMatrixAt(k++, m);
      }
    }
    scene.add(this.floorMesh);

    // Muros perimetrales (la fila norte saltea la brecha del depósito)
    const wallCells = [];
    for (let i = 0; i < GRID_SIZE; i++) {
      if (!GAP_CELLS.includes(i)) wallCells.push([i, -1]); // norte
      wallCells.push([i, GRID_SIZE]); // sur
      wallCells.push([-1, i]); // oeste
      wallCells.push([GRID_SIZE, i]); // este
    }
    const wallGeo = new THREE.BoxGeometry(0.98, 1.2, 0.98);
    this.wallMesh = new THREE.InstancedMesh(
      wallGeo,
      new THREE.MeshLambertMaterial({ color: '#ffffff' }),
      wallCells.length,
    );
    this.wallMesh.castShadow = true;
    this.wallMesh.receiveShadow = true;
    wallCells.forEach(([i, j], idx) => {
      m.setPosition(i - HALF_GRID + 0.5, 0.6, j - HALF_GRID + 0.5);
      this.wallMesh.setMatrixAt(idx, m);
    });
    scene.add(this.wallMesh);

    // Granero: cuerpo + dos hojas de puerta separadas
    const gate = buildDepotGate();
    this._gateBody = gate.body;
    this._doorL    = gate.doorL; // Group con pivot en bisagra izquierda
    this._doorR    = gate.doorR; // Group con pivot en bisagra derecha
    scene.add(this._gateBody);
    scene.add(this._doorL);
    scene.add(this._doorR);

    // Estado de animación de puertas
    this._doorAnim  = null;
    this._doorAngle = 0; // ángulo actual (rad), 0=cerrado, MAX_ANGLE=abierto

    // M1.5-C: bloqueo visual fuera de la zona jugable (valla de postes + velo).
    this.zoneGroup = new THREE.Group();
    scene.add(this.zoneGroup);

    this.applyLevel(0);
  }

  // Abre las puertas brevemente (llamado desde onDeliver)
  openDoors() {
    this._doorAnim = { startMs: performance.now(), durationMs: 600 };
  }

  // Llamado cada frame desde el loop de render
  updateDoors() {
    const MAX_ANGLE = Math.PI / 7; // ~26° — sutil, apenas se entreabre
    const OPEN_FRAC = 0.3;         // 30% del tiempo abriendo, 70% cerrando suave

    if (!this._doorAnim) {
      if (this._doorAngle !== 0) {
        this._doorAngle = 0;
        this._applyDoorAngle(0);
      }
      return;
    }

    const { startMs, durationMs } = this._doorAnim;
    const t = Math.min(1, (performance.now() - startMs) / durationMs);

    let angle;
    if (t < OPEN_FRAC) {
      const u = t / OPEN_FRAC;
      angle = MAX_ANGLE * (1 - Math.pow(1 - u, 2)); // ease-out suave
    } else {
      const u = (t - OPEN_FRAC) / (1 - OPEN_FRAC);
      angle = MAX_ANGLE * (1 - u * u);               // ease-in cierre
    }

    this._doorAngle = angle;
    this._applyDoorAngle(angle);
    if (t >= 1) this._doorAnim = null;
  }

  _applyDoorAngle(angle) {
    // doorL (bisagra izquierda, x negativo): abre girando hacia -Z (interior)
    this._doorL.rotation.y =  angle;
    // doorR (bisagra derecha, x positivo): abre girando hacia +Z (interior)
    this._doorR.rotation.y = -angle;
  }

  // Dibuja anillo de postes/valla en el borde del rect + velo translúcido fuera.
  // rect: { i0, i1, j0, j1 } inclusivo, celdas 0..15.
  setAllowedRect(rect) {
    while (this.zoneGroup.children.length) {
      const c = this.zoneGroup.children[0];
      this.zoneGroup.remove(c);
      c.geometry?.dispose?.();
    }
    if (!rect) return;
    const full = rect.i0 <= 0 && rect.i1 >= 15 && rect.j0 <= 0 && rect.j1 >= 15;
    if (full) return; // Fábrica: parcela completa, sin valla
    const x0 = rect.i0 - HALF_GRID;
    const x1 = rect.i1 - HALF_GRID + 1;
    const z0 = rect.j0 - HALF_GRID;
    const z1 = rect.j1 - HALF_GRID + 1;
    const postGeo = new THREE.BoxGeometry(0.12, 0.9, 0.12);
    const postMat = new THREE.MeshLambertMaterial({ color: '#5c4326' });
    const railMat = new THREE.MeshLambertMaterial({ color: '#8a6b45' });
    const posts = [];
    for (let x = Math.floor(x0); x <= Math.ceil(x1); x++) {
      posts.push([x, z0], [x, z1]);
    }
    for (let z = Math.floor(z0); z <= Math.ceil(z1); z++) {
      posts.push([x0, z], [x1, z]);
    }
    for (const [px, pz] of posts) {
      const p = new THREE.Mesh(postGeo, postMat);
      p.position.set(px, 0.45, pz);
      this.zoneGroup.add(p);
    }
    // rieles del perímetro
    const railY = 0.7;
    const mkRail = (w, d, px, pz) => {
      const r = new THREE.Mesh(new THREE.BoxGeometry(w, 0.08, d), railMat);
      r.position.set(px, railY, pz);
      this.zoneGroup.add(r);
    };
    mkRail(x1 - x0, 0.08, (x0 + x1) / 2, z0);
    mkRail(x1 - x0, 0.08, (x0 + x1) / 2, z1);
    mkRail(0.08, z1 - z0, x0, (z0 + z1) / 2);
    mkRail(0.08, z1 - z0, x1, (z0 + z1) / 2);
    // velo translúcido sobre la zona bloqueada (4 franjas fuera del rect)
    const veilMat = new THREE.MeshBasicMaterial({
      color: '#3a3f47',
      transparent: true,
      opacity: 0.35,
      depthWrite: false,
    });
    const H = HALF_GRID;
    const mkVeil = (cx, cz, w, d) => {
      const v = new THREE.Mesh(new THREE.PlaneGeometry(w, d), veilMat);
      v.rotation.x = -Math.PI / 2;
      v.position.set(cx, 0.03, cz);
      this.zoneGroup.add(v);
    };
    if (rect.j0 > 0) mkVeil(0, (-H + z0) / 2, 16, z0 + H); // norte
    if (rect.j1 < 15) mkVeil(0, (z1 + H) / 2, 16, H - z1); // sur
    if (rect.i0 > 0) mkVeil((-H + x0) / 2, (z0 + z1) / 2, x0 + H, z1 - z0); // oeste
    if (rect.i1 < 15) mkVeil((x1 + H) / 2, (z0 + z1) / 2, H - x1, z1 - z0); // este
  }

  applyLevel(level) {
    const pal = PALETTES[Math.min(level, PALETTES.length - 1)];
    const c = new THREE.Color();
    for (let idx = 0; idx < this.floorMesh.count; idx++) {
      const i = idx % GRID_SIZE;
      const j = Math.floor(idx / GRID_SIZE);
      c.set(pal.floor).offsetHSL(0, 0, (hash01(i, j) - 0.5) * 0.08);
      this.floorMesh.setColorAt(idx, c);
    }
    this.floorMesh.instanceColor.needsUpdate = true;
    for (let idx = 0; idx < this.wallMesh.count; idx++) {
      c.set(pal.wall).offsetHSL(0, 0, (hash01(idx, idx * 3) - 0.5) * 0.06);
      this.wallMesh.setColorAt(idx, c);
    }
    this.wallMesh.instanceColor.needsUpdate = true;
    this.scene.background.set(pal.sky);
    if (this.scene.fog) this.scene.fog.color.set(pal.sky);
  }
}
