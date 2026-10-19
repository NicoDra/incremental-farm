// Pruebas sobre geometrías reales: datos finitos, límites, presupuestos,
// aberturas funcionales, reconstrucción de época y puertas del granero.
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { TOOLS, PRODUCTS } from 'chanchos-shared';
import { ToolManager } from './src/render/toolMeshes.js';
import { buildProducerGeo } from './src/render/machineModels.js';
import { getProductGeo } from './src/render/products.js';
import { ParcelRenderer } from './src/render/parcel.js';

let checks = 0;
function check(condition, message) { assert.ok(condition, message); checks++; }
function audit(geometry, name, budget) {
  check(Boolean(geometry?.attributes.position), `${name}: posiciones`);
  for (const key of ['position', 'normal', 'color']) {
    const a = geometry.attributes[key];
    check(a && Array.from(a.array).every(Number.isFinite), `${name}: ${key} finito`);
  }
  geometry.computeBoundingBox();
  const size = geometry.boundingBox.getSize(new THREE.Vector3());
  check(size.x > 0 && size.y > 0 && size.z > 0, `${name}: volumen`);
  const triangles = (geometry.index?.count ?? geometry.attributes.position.count) / 3;
  check(triangles <= budget, `${name}: ${triangles} triángulos > ${budget}`);
  return triangles;
}

const ray = new THREE.Raycaster();
function assertPort(geometry, side, name) {
  const origin = new THREE.Vector3(0, 0.55, -0.7);
  const direction = new THREE.Vector3(0, 0, 1);
  if (side === 'back') { origin.z = 0.7; direction.z = -1; }
  if (side === 'left') { origin.set(-0.7, 0.55, 0); direction.set(1, 0, 0); }
  if (side === 'right') { origin.set(0.7, 0.55, 0); direction.set(-1, 0, 0); }
  ray.set(origin, direction);
  ray.far = 0.42;
  const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }));
  mesh.updateMatrixWorld(true);
  check(ray.intersectObject(mesh).length === 0, `${name}: boca ${side} tapada en Y=.55`);
  mesh.material.dispose();
}

let maxMachineTriangles = 0;
for (let age = 0; age < 4; age++) {
  const manager = new ToolManager(new THREE.Scene());
  manager.setAge(age);
  let index = 0;
  for (const [type, def] of Object.entries(TOOLS)) {
    const h = type === 'puente' || type === 'rampa' ? 1 : 0;
    manager.add(type, index % 6, Math.floor(index / 6) * 3, h, 0, 0, { age, fanTier: age });
    index++;
  }
  for (const [key, entry] of manager.entries) {
    const geo = entry.group.userData.bodyMesh.geometry;
    audit(geo, `${entry.type}/${age}`, 3000);
    check(geo.boundingBox.max.x <= 0.60 && geo.boundingBox.min.x >= -0.60, `${entry.type}: ancho de celda`);
  }
  // Mismo grupo, mismas transformaciones y tier al cambiar de época.
  const groups = [...manager.entries.values()].map((e) => e.group);
  manager.refreshAges((age + 1) % 4);
  check([...manager.entries.values()].every((e, i) => e.group === groups[i]), 'época conserva grupos');
  for (const [type, def] of Object.entries(TOOLS)) {
    if (!['producer', 'converter', 'silo'].includes(def.kind)) continue;
    const geo = buildProducerGeo(type, age);
    maxMachineTriangles = Math.max(maxMachineTriangles, audit(geo, type, 3000));
    assertPort(geo, 'front', type);
    const inputs = def.inputSides ? Object.values(def.inputSides)
      : def.kind === 'converter' || def.kind === 'silo' ? ['back'] : [];
    for (const side of inputs) assertPort(geo, side, type);
    geo.dispose();
  }
}

for (const kind of Object.keys(PRODUCTS)) {
  const geometry = getProductGeo(kind);
  audit(geometry, kind, 1200);
  const size = geometry.boundingBox.getSize(new THREE.Vector3());
  check(size.x <= 0.55 && size.z <= 0.75 && size.y <= 0.65, `${kind}: escala de producto`);
}

// Canvas mínimo para construir el fondo en Node; no reemplaza la prueba WebGL.
globalThis.document = { createElement: () => ({ getContext: () => ({
  createLinearGradient: () => ({ addColorStop() {} }), fillRect() {},
}) }) };
const scene = new THREE.Scene();
scene.background = new THREE.Color();
scene.fog = new THREE.Fog('#ffffff', 34, 70);
const parcel = new ParcelRenderer(scene);
for (let age = 0; age < 4; age++) {
  parcel.applyLevel(age);
  audit(parcel._gateBody.geometry, `granero/${age}`, 20000);
  const left = new THREE.Box3().setFromObject(parcel._doorL);
  const right = new THREE.Box3().setFromObject(parcel._doorR);
  check(left.min.x >= -2.01 && left.max.x <= 0, 'hoja izquierda dentro del vano');
  check(right.max.x <= 2.01 && right.min.x >= 0, 'hoja derecha dentro del vano');
  check(scene.background.isTexture, 'cambio de época conserva cielo gradiente');
}
delete globalThis.document;
console.log(`PASS smoke-models (${checks} checks; máquina máxima ${maxMachineTriangles} triángulos)`);
