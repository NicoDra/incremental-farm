// Chanchos S.A. — siete productos voxel con siluetas propias e InstancedMesh.
// M1.5-B: júmbos claramente más grandes + brillo (escala JUMBO_SCALE y
// material con emissive en una segunda serie de InstancedMesh).
import * as THREE from 'three';
import { MAX_BODIES, JUMBO_SCALE } from 'chanchos-shared';
import { voxelBuilder, voxelMaterial } from './voxel.js';

function cornGeometry() {
  const v = voxelBuilder();
  v.add(0.17, 0.30, 0.17, 0, 0.02, 0, '#dfaa32');
  v.add(0.11, 0.09, 0.11, 0, 0.215, 0, '#ffe18a');
  for (const y of [-0.07, 0.025, 0.12]) {
    for (const s of [-1, 1]) {
      v.add(0.19, 0.065, 0.035, 0, y, s * 0.085, '#f8ce53');
      v.add(0.035, 0.065, 0.12, s * 0.085, y, 0, '#efb93c');
    }
  }
  for (const s of [-1, 1]) {
    v.add(0.08, 0.18, 0.15, s * 0.10, -0.10, 0.02, '#719d45');
    v.add(0.05, 0.09, 0.10, s * 0.14, 0.025, 0.02, '#8fba55');
  }
  return v.build();
}

function pumpkinGeometry() {
  const v = voxelBuilder();
  v.add(0.32, 0.4, 0.32, 0, 0, 0, '#e08a3c');
  v.add(0.44, 0.28, 0.2, 0, 0, 0, '#d97f33');
  v.add(0.2, 0.28, 0.44, 0, 0, 0, '#d97f33');
  v.add(0.08, 0.14, 0.08, 0, 0.26, 0, '#5c8a2a');
  v.add(0.1, 0.06, 0.1, 0.12, 0.18, 0.1, '#f2c94c');
  for (const x of [-0.11, 0.11]) v.add(0.025, 0.26, 0.025, x, 0, -0.174, '#b9672f');
  v.add(0.13, 0.035, 0.08, 0.09, 0.24, 0, '#78a44b');
  return v.build();
}

function popcornGeometry() {
  const v = voxelBuilder();
  v.add(0.09, 0.065, 0.09, 0, -0.065, 0, '#c78a3e');
  v.add(0.09, 0.09, 0.09, -0.06, 0.05, 0.03, '#fff3d6');
  v.add(0.09, 0.09, 0.09, 0.06, 0.05, -0.02, '#fff3d6');
  v.add(0.08, 0.08, 0.08, 0, 0.1, 0.04, '#f2c94c');
  v.add(0.10, 0.07, 0.08, 0, 0.035, -0.065, '#fff8e7');
  v.add(0.07, 0.065, 0.07, -0.04, 0.12, 0.01, '#fff8e7');
  return v.build();
}

function saltGeometry() {
  const v = voxelBuilder();
  v.add(0.18, 0.16, 0.18, 0, 0, 0, '#ececf0');
  v.add(0.14, 0.1, 0.14, 0.03, 0.1, -0.02, '#d8dae2');
  v.add(0.1, 0.08, 0.1, -0.04, 0.15, 0.03, '#ffffff');
  v.add(0.055, 0.045, 0.055, -0.115, -0.02, 0.07, '#b5d7df');
  v.add(0.065, 0.035, 0.065, 0.085, -0.06, -0.06, '#ffffff');
  return v.build();
}

function feedGeometry() {
  const v = voxelBuilder();
  v.add(0.28, 0.22, 0.24, 0, 0, 0, '#b68f56');
  v.add(0.32, 0.11, 0.28, 0, -0.02, 0, '#c8a36b');
  v.add(0.28, 0.08, 0.24, 0, 0.14, 0, '#d2ab6f');
  v.add(0.1, 0.1, 0.1, -0.08, 0.05, 0.07, '#7fae4a');
  v.add(0.055, 0.22, 0.02, 0.06, 0, -0.13, '#789156');
  v.add(0.12, 0.05, 0.08, 0, 0.205, 0, '#8b663f');
  return v.build();
}

function pigGeometry() {
  const v = voxelBuilder();
  const body = '#f4a8bd';
  const dark = '#e07b96';
  const leg = '#e891a9';
  v.add(0.46, 0.30, 0.28, 0, 0, 0, body); // cuerpo escalonado
  v.add(0.50, 0.20, 0.32, 0, -0.025, 0, body);
  v.add(0.34, 0.04, 0.22, 0, 0.17, 0.02, '#ffc4cf');
  v.add(0.24, 0.24, 0.2, 0, 0.05, -0.24, body); // cabeza (frente local -z)
  v.add(0.14, 0.09, 0.06, 0, 0, -0.36, dark); // hocico
  v.add(0.06, 0.09, 0.05, -0.07, 0.21, -0.22, dark); // orejas
  v.add(0.06, 0.09, 0.05, 0.07, 0.21, -0.22, dark);
  v.add(0.05, 0.05, 0.04, -0.09, 0.11, -0.335, '#3a2b2e'); // ojos
  v.add(0.05, 0.05, 0.04, 0.09, 0.11, -0.335, '#3a2b2e');
  for (const lx of [-0.16, 0.16]) {
    for (const lz of [-0.1, 0.1]) {
      v.add(0.09, 0.15, 0.09, lx, -0.22, lz, leg); // patas
      v.add(0.095, 0.04, 0.095, lx, -0.285, lz, '#68505a');
    }
  }
  for (const x of [-0.04, 0.04]) v.add(0.025, 0.025, 0.012, x, 0, -0.397, '#9e526a');
  v.add(0.045, 0.045, 0.09, 0, 0.05, 0.20, dark);
  v.add(0.045, 0.08, 0.045, 0, 0.09, 0.25, dark);
  return v.build();
}

function hamGeometry() {
  const v = voxelBuilder();
  v.add(0.30, 0.24, 0.22, 0, 0, 0.03, '#d98a94');
  v.add(0.38, 0.12, 0.2, 0, 0.03, 0.05, '#e8a0a8');
  v.add(0.07, 0.07, 0.14, 0, 0, -0.2, '#fff3d6'); // hueso
  v.add(0.38, 0.05, 0.27, 0, -0.1, 0.03, '#b45f6e');
  v.add(0.10, 0.10, 0.055, 0, 0, -0.13, '#b45f6e');
  v.add(0.12, 0.06, 0.05, 0, 0, -0.245, '#fff3d6');
  v.add(0.10, 0.07, 0.018, -0.04, 0.045, 0.158, '#f6d5c4');
  return v.build();
}

const BUILDERS = {
  corn: cornGeometry,
  pumpkin: pumpkinGeometry,
  salt: saltGeometry,
  feed: feedGeometry,
  popcorn: popcornGeometry,
  pig: pigGeometry,
  ham: hamGeometry,
};

// M1.5-F5: geometría compartida de cada producto para reutilizarla en el mesh
// flotante de la entrada de las recetas dobles (sin instanciar).
const GEO_CACHE = new Map();
export function getProductGeo(kind) {
  if (!BUILDERS[kind]) return null;
  if (!GEO_CACHE.has(kind)) GEO_CACHE.set(kind, BUILDERS[kind]());
  return GEO_CACHE.get(kind);
}

export class ProductRenderer {
  constructor(scene) {
    const mat = voxelMaterial();
    // Material júmbo: mismo voxel con brillo dorado (emissive) = contorno visible.
    const jumboMat = voxelMaterial({ emissive: new THREE.Color('#8a6b00'), emissiveIntensity: 0.55 });
    this.meshes = {};
    this.jumboMeshes = {};
    for (const kind of Object.keys(BUILDERS)) {
      const geo = getProductGeo(kind);
      const mesh = new THREE.InstancedMesh(geo, mat, MAX_BODIES);
      mesh.castShadow = true;
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      mesh.frustumCulled = false;
      mesh.count = 0;
      scene.add(mesh);
      this.meshes[kind] = mesh;
      const jm = new THREE.InstancedMesh(geo, jumboMat, MAX_BODIES);
      jm.castShadow = true;
      jm.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      jm.frustumCulled = false;
      jm.count = 0;
      scene.add(jm);
      this.jumboMeshes[kind] = jm;
    }
    this._m = new THREE.Matrix4();
    this._q = new THREE.Quaternion();
    this._p = new THREE.Vector3();
    this._s = new THREE.Vector3(1, 1, 1);
    this._js = new THREE.Vector3(JUMBO_SCALE, JUMBO_SCALE, JUMBO_SCALE);
  }

  sync(products) {
    const counts = {};
    const jcounts = {};
    for (const kind of Object.keys(this.meshes)) {
      counts[kind] = 0;
      jcounts[kind] = 0;
    }
    for (const p of products) {
      const mesh = p.jumbo ? this.jumboMeshes[p.kind] : this.meshes[p.kind];
      if (!mesh) continue;
      const t = p.body.translation();
      const r = p.body.rotation();
      this._p.set(t.x, t.y, t.z);
      this._q.set(r.x, r.y, r.z, r.w);
      this._m.compose(this._p, this._q, p.jumbo ? this._js : this._s);
      if (p.jumbo) mesh.setMatrixAt(jcounts[p.kind]++, this._m);
      else mesh.setMatrixAt(counts[p.kind]++, this._m);
    }
    for (const [kind, mesh] of Object.entries(this.meshes)) {
      mesh.count = counts[kind];
      mesh.instanceMatrix.needsUpdate = true;
      const jm = this.jumboMeshes[kind];
      jm.count = jcounts[kind];
      jm.instanceMatrix.needsUpdate = true;
    }
  }
}
