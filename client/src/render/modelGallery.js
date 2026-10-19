// Superficie de inspección de desarrollo: geometrías reales, cámara fija,
// cuatro épocas y vistas. No forma parte de la entrada de producción.
import * as THREE from 'three';
import { TOOLS, PRODUCTS } from 'chanchos-shared';
import { createScene } from './scene.js';
import { ToolManager } from './toolMeshes.js';
import { ParcelRenderer } from './parcel.js';
import { getProductGeo } from './products.js';
import { voxelMaterial } from './voxel.js';

const view = createScene(document.getElementById('models'));
const manager = new ToolManager(view.scene);
const parcel = new ParcelRenderer(view.scene);
view.scene.remove(parcel.floorMesh, parcel.wallMesh, parcel.zoneGroup);
const labels = document.getElementById('labels');
const subject = document.getElementById('subject');
const items = [];
const tools = Object.keys(TOOLS);
const liveTools = new Map();

function label(text, position) {
  const el = document.createElement('span');
  el.textContent = text;
  labels.appendChild(el);
  items.push({ el, position });
}

tools.forEach((type, index) => {
  const i = (index % 6) * 2, j = Math.floor(index / 6) * 3;
  const h = type === 'rampa' || type === 'puente' ? 1 : 0;
  manager.add(type, i, j, h, 0, 0, { age: 0, fanTier: 0 });
  const key = `${i},${j},${h}`;
  const entry = manager.entries.get(key);
  entry.group.position.set((index % 6 - 2.5) * 1.8, h, (Math.floor(index / 6) - 1) * 2.4);
  label(TOOLS[type].name, entry.group.position.clone().setY(-0.20));
  liveTools.set(key, { powerPct: 100, jamUntil: 0 });
});

const productGroup = new THREE.Group();
view.scene.add(productGroup);
Object.keys(PRODUCTS).forEach((kind, i) => {
  const mesh = new THREE.Mesh(getProductGeo(kind), voxelMaterial());
  mesh.position.set((i - 3) * 1.5, 0.6, 5.4);
  mesh.scale.setScalar(1.6);
  mesh.castShadow = true;
  productGroup.add(mesh);
  label(PRODUCTS[kind].name || kind, mesh.position.clone().setY(0));
});

// Fondo neutro para comparar siluetas, sin detalles dispersos.
const stage = new THREE.Mesh(new THREE.PlaneGeometry(19, 16), new THREE.MeshLambertMaterial({ color: '#c9d2ca' }));
stage.rotation.x = -Math.PI / 2;
stage.position.set(0, -0.08, 1.5);
stage.receiveShadow = true;
view.scene.add(stage);

function showSubject() {
  const barn = subject.value === 'barn';
  const selected = manager.entries.get(subject.value);
  for (const [key, entry] of manager.entries) entry.group.visible = !barn && (!selected || key === subject.value);
  productGroup.visible = !barn && !selected;
  for (const part of [parcel._gateBody, parcel._doorL, parcel._doorR]) part.visible = barn;
  labels.style.display = barn || selected ? 'none' : '';
  const target = barn ? new THREE.Vector3(0, 0.6, -9.5)
    : selected ? selected.group.position.clone().add(new THREE.Vector3(0, 0.4, 0))
      : new THREE.Vector3(0, 0.2, 1.4);
  const offsets = { iso: [9, 10, -14], front: [0, 4, -16], back: [0, 4, 16], top: [0, 18, 0.01] };
  const offset = new THREE.Vector3(...offsets[document.getElementById('view').value]);
  // Las máquinas miran -Z; el granero mira +Z, hacia la parcela.
  if (barn) offset.z *= -1;
  stage.position.z = barn ? -9.5 : 1.5;
  stage.scale.set(barn ? 0.5 : 1, barn ? 0.5 : 1, 1);
  view.controls.target.copy(target);
  view.camera.position.copy(target).add(offset);
  view.camera.zoom = barn ? 2 : selected ? 5 : 1;
  view.camera.lookAt(target);
  view.camera.updateProjectionMatrix();
  view.controls.update();
}

for (const [key, entry] of manager.entries) {
  const option = document.createElement('option');
  option.value = key;
  option.textContent = TOOLS[entry.type].name;
  subject.appendChild(option);
}
document.getElementById('age').addEventListener('change', (event) => {
  const age = Number(event.target.value);
  parcel.applyLevel(age);
  manager.refreshAges(age);
  manager.setFanTier(age);
  // Mostrar los cuatro tiers sin cambiar estado de simulación alguno.
  for (const [key, entry] of manager.entries) {
    if (entry.type === 'fan') { entry.fanTier = age; manager._rebuildEntryBody(key, entry); }
  }
  showSubject();
});
subject.addEventListener('change', showSubject);
document.getElementById('view').addEventListener('change', showSubject);
showSubject();

const projection = new THREE.Vector3();
function frame(t) {
  view.controls.update();
  manager.update(t, liveTools, t);
  for (const { el, position } of items) {
    projection.copy(position).project(view.camera);
    el.style.left = `${(projection.x + 1) * innerWidth / 2}px`;
    el.style.top = `${(1 - projection.y) * innerHeight / 2}px`;
  }
  view.renderer.render(view.scene, view.camera);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
