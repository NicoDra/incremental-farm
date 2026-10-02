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

function buildDepotGate() {
  const v = voxelBuilder();
  const gold = '#f2c94c';
  const dark = '#2b2620';
  for (const px of [-2.5, 2.5]) {
    for (let s = 0; s < 4; s++) {
      v.add(0.34, 0.34, 0.34, px, 0.2 + s * 0.36, -HALF_GRID - 0.5, s % 2 ? dark : gold);
    }
  }
  v.add(5.4, 0.22, 0.26, 0, 1.72, -HALF_GRID - 0.5, gold);
  for (let s = -2; s <= 2; s++) {
    v.add(0.5, 0.1, 0.18, s * 0.95, 1.44, -HALF_GRID - 0.62, dark);
  }
  const mesh = new THREE.Mesh(v.build(), voxelMaterial());
  mesh.castShadow = true;
  return mesh;
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

    this.gate = buildDepotGate();
    scene.add(this.gate);

    // M1.5-C: bloqueo visual fuera de la zona jugable (valla de postes + velo).
    this.zoneGroup = new THREE.Group();
    scene.add(this.zoneGroup);

    this.applyLevel(0);
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
