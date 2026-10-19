// Entorno rural estable: terreno continuo y volúmenes agrupados fuera de la
// parcela. Solo visual; no participa en colisiones, colocación ni economía.
import * as THREE from 'three';
import { HALF_GRID } from 'chanchos-shared';
import { voxelBuilder, voxelMaterial } from './voxel.js';

const GROUND_Y = -0.035;

function addTree(v, x, z, height, crown) {
  const trunkH = height * 0.58;
  v.add(0.32, trunkH, 0.32, x, GROUND_Y + trunkH / 2, z, '#756047');
  const levels = [
    [1.5, 0.65, 1.35, height * 0.57],
    [1.9, 0.65, 1.7, height * 0.73],
    [1.3, 0.55, 1.2, height * 0.89],
  ];
  for (const [w, h, d, y] of levels) v.add(w, h, d, x, GROUND_Y + y, z, crown);
}

function grove(x, z) {
  const v = voxelBuilder();
  addTree(v, x - 1.2, z, 2.6, '#728966');
  addTree(v, x + 1.0, z - 1.1, 3.2, '#607c60');
  addTree(v, x + 0.8, z + 1.3, 2.3, '#81916a');
  return v.build();
}

function hill(x, z, w, d) {
  const v = voxelBuilder();
  // Terrazas bajas y anchas, desaturadas: silueta voxel sin ruido superficial.
  for (let step = 0; step < 4; step++) {
    const scale = 1 - step * 0.19;
    v.add(w * scale, 0.32, d * scale, x + step * 0.25, GROUND_Y + 0.16 + step * 0.32,
      z - step * 0.16, step < 2 ? '#94a38c' : '#9aa992');
  }
  return v.build();
}

function corners(box) {
  const result = [];
  for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) {
    for (const z of [box.min.z, box.max.z]) result.push(new THREE.Vector3(x, y, z));
  }
  return result;
}

export class LandscapeRenderer {
  constructor(scene) {
    this.group = new THREE.Group();
    this.group.name = 'rural-landscape';
    // Plano amplio bajo el tablero: las juntas siguen legibles y no hay borde
    // de isla. La niebla integra su extensión en el horizonte.
    this.ground = new THREE.Mesh(new THREE.PlaneGeometry(1024, 1024),
      new THREE.MeshLambertMaterial({ color: '#929c79' }));
    this.ground.rotation.x = -Math.PI / 2;
    this.ground.position.y = GROUND_Y;
    this.ground.receiveShadow = true;
    this.ground.name = 'continuous-ground';
    this.group.add(this.ground);
    this.props = [];
    for (const [name, geometry] of [
      ['grove-west', grove(-12.25, -5)],
      ['grove-east', grove(12.25, -12)],
      ['grove-southwest', grove(-12.25, 10.5)],
      ['hill-west', hill(-32, -30, 18, 12)],
      ['hill-east', hill(33, -32, 20, 13)],
    ]) {
      const material = voxelMaterial({ transparent: true });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.name = name;
      geometry.computeBoundingBox();
      const bounds = geometry.boundingBox.clone();
      this.group.add(mesh);
      this.props.push({ mesh, bounds, corners: corners(bounds), projected: new THREE.Box2() });
    }
    scene.add(this.group);
    this._parcelCorners = corners(new THREE.Box3(
      new THREE.Vector3(-HALF_GRID - 1, 0, -HALF_GRID - 3.6),
      new THREE.Vector3(HALF_GRID + 1, 2.6, HALF_GRID + 1)));
    this._parcelRect = new THREE.Box2();
    this._projected = new THREE.Vector3();
    this._point = new THREE.Vector2();
    this._direction = new THREE.Vector3();
    this._center = new THREE.Vector3();
    this._relative = new THREE.Vector3();
  }

  _project(cornersToProject, camera, box) {
    box.makeEmpty();
    for (const point of cornersToProject) {
      this._projected.copy(point).project(camera);
      this._point.set(this._projected.x, this._projected.y);
      box.expandByPoint(this._point);
    }
  }

  update(camera, deltaSeconds, focus = null) {
    // El suelo uniforme sigue el foco durante el pan: no se alcanza su borde
    // al desplazar la cámara. Árboles, parcela y colinas permanecen en el mundo.
    if (focus) {
      this.ground.position.x = focus.x;
      this.ground.position.z = focus.z;
    }
    // El paisaje se desvanece si queda entre la cámara y el área jugable.
    // Se usan límites proyectados, también para órbitas rasantes y zoom mínimo.
    camera.updateMatrixWorld(true);
    camera.getWorldDirection(this._direction);
    this._project(this._parcelCorners, camera, this._parcelRect);
    const blend = 1 - Math.exp(-Math.min(0.1, Math.max(0, deltaSeconds)) * 12);
    for (const prop of this.props) {
      prop.bounds.getCenter(this._center);
      this._relative.copy(this._center).sub(camera.position);
      const propDepth = this._relative.dot(this._direction);
      this._relative.copy(camera.position).negate();
      const parcelDepth = this._relative.dot(this._direction);
      this._project(prop.corners, camera, prop.projected);
      const occludes = propDepth < parcelDepth && prop.projected.intersectsBox(this._parcelRect);
      prop.mesh.material.opacity += ((occludes ? 0 : 1) - prop.mesh.material.opacity) * blend;
      prop.mesh.material.depthWrite = prop.mesh.material.opacity > 0.98;
      prop.mesh.visible = prop.mesh.material.opacity > 0.01;
    }
  }

  dispose() {
    this.group.removeFromParent();
    this.group.traverse((object) => {
      object.geometry?.dispose();
      object.material?.dispose();
    });
  }
}
