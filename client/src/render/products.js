// Chanchos S.A. — productos voxel (5 especies) con InstancedMesh
// M1.5-B: júmbos claramente más grandes + brillo (escala JUMBO_SCALE y
// material con emissive en una segunda serie de InstancedMesh).
import * as THREE from 'three';
import { MAX_BODIES, JUMBO_SCALE } from 'chanchos-shared';
import { voxelBuilder, voxelMaterial } from './voxel.js';

function cornGeometry() {
  const v = voxelBuilder();
  v.add(0.2, 0.3, 0.2, 0, 0, 0, '#f2c94c');
  v.add(0.06, 0.3, 0.06, 0.02, 0.19, 0, '#e8b93c');
  v.add(0.22, 0.2, 0.08, 0.08, -0.08, 0.05, '#7fae4a');
  v.add(0.22, 0.2, 0.08, -0.08, -0.08, 0.05, '#7fae4a');
  return v.build();
}

function pumpkinGeometry() {
  const v = voxelBuilder();
  v.add(0.42, 0.4, 0.42, 0, 0, 0, '#e08a3c');
  v.add(0.44, 0.28, 0.2, 0, 0, 0, '#d97f33');
  v.add(0.2, 0.28, 0.44, 0, 0, 0, '#d97f33');
  v.add(0.08, 0.14, 0.08, 0, 0.26, 0, '#5c8a2a');
  v.add(0.1, 0.06, 0.1, 0.12, 0.18, 0.1, '#f2c94c');
  return v.build();
}

function popcornGeometry() {
  const v = voxelBuilder();
  v.add(0.12, 0.1, 0.12, 0, -0.03, 0, '#c94f3d');
  v.add(0.09, 0.09, 0.09, -0.06, 0.05, 0.03, '#fff3d6');
  v.add(0.09, 0.09, 0.09, 0.06, 0.05, -0.02, '#fff3d6');
  v.add(0.08, 0.08, 0.08, 0, 0.1, 0.04, '#f2c94c');
  return v.build();
}

function saltGeometry() {
  const v = voxelBuilder();
  v.add(0.18, 0.16, 0.18, 0, 0, 0, '#ececf0');
  v.add(0.14, 0.1, 0.14, 0.03, 0.1, -0.02, '#d8dae2');
  v.add(0.1, 0.08, 0.1, -0.04, 0.15, 0.03, '#ffffff');
  return v.build();
}

function feedGeometry() {
  const v = voxelBuilder();
  v.add(0.32, 0.22, 0.28, 0, 0, 0, '#b68f56');
  v.add(0.28, 0.08, 0.24, 0, 0.14, 0, '#d2ab6f');
  v.add(0.1, 0.1, 0.1, -0.08, 0.05, 0.07, '#7fae4a');
  return v.build();
}

function pigGeometry() {
  const v = voxelBuilder();
  const body = '#f4a8bd';
  const dark = '#e07b96';
  const leg = '#e891a9';
  v.add(0.5, 0.3, 0.32, 0, 0, 0, body); // cuerpo
  v.add(0.24, 0.24, 0.2, 0, 0.05, -0.24, body); // cabeza (frente local -z)
  v.add(0.14, 0.09, 0.06, 0, 0, -0.36, dark); // hocico
  v.add(0.06, 0.09, 0.05, -0.07, 0.21, -0.22, dark); // orejas
  v.add(0.06, 0.09, 0.05, 0.07, 0.21, -0.22, dark);
  v.add(0.05, 0.05, 0.04, -0.09, 0.11, -0.335, '#3a2b2e'); // ojos
  v.add(0.05, 0.05, 0.04, 0.09, 0.11, -0.335, '#3a2b2e');
  for (const lx of [-0.16, 0.16]) {
    for (const lz of [-0.1, 0.1]) {
      v.add(0.09, 0.15, 0.09, lx, -0.22, lz, leg); // patas
    }
  }
  return v.build();
}

function hamGeometry() {
  const v = voxelBuilder();
  v.add(0.36, 0.24, 0.26, 0, 0, 0.03, '#d98a94');
  v.add(0.38, 0.12, 0.2, 0, 0.03, 0.05, '#e8a0a8');
  v.add(0.07, 0.07, 0.14, 0, 0, -0.2, '#fff3d6'); // hueso
  v.add(0.38, 0.05, 0.27, 0, -0.1, 0.03, '#b45f6e');
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

export class ProductRenderer {
  constructor(scene) {
    const mat = voxelMaterial();
    // Material júmbo: mismo voxel con brillo dorado (emissive) = contorno visible.
    const jumboMat = voxelMaterial({ emissive: new THREE.Color('#8a6b00'), emissiveIntensity: 0.55 });
    this.meshes = {};
    this.jumboMeshes = {};
    for (const [kind, build] of Object.entries(BUILDERS)) {
      const geo = build();
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
