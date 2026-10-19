// Pruebas sobre geometrías reales: datos finitos, límites, presupuestos,
// aberturas funcionales, reconstrucción de época y puertas del granero.
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { TOOLS, PRODUCTS, GAP_CELLS, HALF_GRID } from 'chanchos-shared';
import { allowedRect } from './src/game/state.js';
import { ToolManager } from './src/render/toolMeshes.js';
import { buildProducerGeo } from './src/render/machineModels.js';
import { getProductGeo } from './src/render/products.js';
import { ParcelRenderer, PALETTES, hash01 } from './src/render/parcel.js';
import { buildWallGeometry } from './src/render/wallModels.js';
import { LandscapeRenderer } from './src/render/landscape.js';
import { fitGroundView } from './src/render/groundCamera.js';

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

// Curva aislada: queda la L exterior, pero no la guía decorativa del interior.
{
  const manager = new ToolManager(new THREE.Scene());
  manager.add('curva', 4, 4, 0, 0, 0);
  const geometry = manager.entries.get('4,4,0').group.userData.bodyMesh.geometry;
  const material = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.updateMatrixWorld(true);
  ray.set(new THREE.Vector3(0.3, 0.26, -0.15), new THREE.Vector3(0, 0, -1));
  ray.far = 0.30;
  check(ray.intersectObject(mesh).length === 0, 'curva: paso norte sin L pequeña');
  ray.set(new THREE.Vector3(0.2, 0.26, -0.3), new THREE.Vector3(1, 0, 0));
  check(ray.intersectObject(mesh).length === 0, 'curva: paso este sin L pequeña');
  ray.far = 0.60;
  for (const direction of [new THREE.Vector3(-1, 0, 0), new THREE.Vector3(0, 0, 1)]) {
    ray.set(new THREE.Vector3(0, 0.26, 0), direction);
    check(ray.intersectObject(mesh).length > 0, 'curva: conserva pared de la L exterior');
  }
  material.dispose();
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
  check(left.max.x < -1.7 && right.min.x > 1.7, 'puertas abiertas despejan la entrada');
  check(left.min.z < -9.5 && right.min.z < -9.5, 'puertas abiertas hacia dentro');
  check(Math.abs(parcel._doorL.rotation.y - 95 * Math.PI / 180) < 1e-9, 'apertura permanente de 95 grados');
  scene.updateMatrixWorld(true);
  ray.far = 1.6;
  for (const x of [-1.6, 0, 1.6]) {
    ray.set(new THREE.Vector3(x, 0.55, -7.5), new THREE.Vector3(0, 0, -1));
    const solids = [parcel._gateBody, parcel._doorL, parcel._doorR];
    check(ray.intersectObjects(solids, true).length === 0, 'recepción: paso hasta la zona de entrega libre');
  }
  check(scene.background.isTexture, 'cambio de época conserva cielo gradiente');
  const restingAngle = 95 * Math.PI / 180;
  check(parcel.notifyDelivery(1000), 'entrega inicia gesto');
  parcel.updateDoors(1000);
  check(parcel._doorL.rotation.y === restingAngle, 'gesto parte de la posición abierta');
  parcel.updateDoors(1350);
  check(Math.abs(parcel._doorL.rotation.y - 100 * Math.PI / 180) < 1e-9, 'gesto máximo de cinco grados');
  check(!parcel.notifyDelivery(1350), 'ráfaga no reinicia el gesto');
  scene.updateMatrixWorld(true);
  ray.set(new THREE.Vector3(0, 0.55, -7.5), new THREE.Vector3(0, 0, -1));
  check(ray.intersectObjects([parcel._doorL, parcel._doorR], true).length === 0, 'animación deja libre la entrada');
  parcel.updateDoors(1700);
  check(parcel._doorL.rotation.y === restingAngle && parcel._doorR.rotation.y === -restingAngle,
    'gesto termina exactamente en reposo abierto');
  check(!parcel.notifyDelivery(1700), 'reposo obligatorio entre gestos');
  check(parcel.notifyDelivery(2100), 'nueva entrega admitida tras el reposo');
  // Cambiar de época durante un gesto debe descartar su estado temporal.
  parcel.applyLevel((age + 1) % 4);
  parcel.updateDoors(2450);
  check(parcel._doorL.rotation.y === restingAngle, 'cambio de época cancela gesto anterior');
}
// Vallas de expansión: vano de entrega libre y tramos laterales al crecer.
const gapStart = Math.min(...GAP_CELLS) - HALF_GRID;
const gapEnd = Math.max(...GAP_CELLS) - HALF_GRID + 1;
for (let age = 0; age < 4; age++) {
  parcel.setAllowedRect(allowedRect(age));
  const north = parcel.zoneGroup.children.filter((mesh) =>
    mesh.geometry.type === 'BoxGeometry' && mesh.position.z === -HALF_GRID);
  const rails = north.filter((mesh) => mesh.position.y === 0.7);
  check(rails.length === (age === 1 || age === 2 ? 2 : 0), `edad ${age}: tramos norte esperados`);
  for (const rail of rails) {
    const bounds = new THREE.Box3().setFromObject(rail);
    check(bounds.max.x <= gapStart + 1e-6 || bounds.min.x >= gapEnd - 1e-6,
      `edad ${age}: riel fuera del vano`);
  }
  for (const post of north.filter((mesh) => mesh.position.y === 0.45)) {
    check(post.position.x <= gapStart || post.position.x >= gapEnd,
      `edad ${age}: poste fuera del vano`);
  }
  if (age < 3) {
    const posts = parcel.zoneGroup.children.filter((mesh) => mesh.position.y === 0.45);
    check(new Set(posts.map((mesh) => `${mesh.position.x},${mesh.position.z}`)).size === posts.length,
      `edad ${age}: sin postes duplicados en esquinas`);
  } else check(parcel.zoneGroup.children.length === 0, 'Fábrica: sin valla de expansión');
}
parcel.setAllowedRect({ i0: 5, i1: 10, j0: 2, j1: 10 });
check(parcel.zoneGroup.children.some((mesh) => mesh.position.y === 0.7 && mesh.position.z === 2 - HALF_GRID &&
  mesh.geometry.parameters.width === 6), 'límite norte interior conserva el riel completo');

// Ruido de color acotado incluso para coordenadas negativas o enteros grandes.
for (const i of [-100000, -33, -1, 0, 1, 32, 100000]) {
  for (const j of [-33, -1, 0, 16, 100000]) {
    const value = hash01(i, j);
    check(value >= 0 && value < 1 && value === hash01(i, j), 'hash visual determinista en [0,1)');
  }
}

const wallSignatures = new Set();
for (let age = 0; age < 4; age++) {
  const geometry = buildWallGeometry(age, PALETTES[age].wall);
  audit(geometry, `muro/${age}`, 500);
  const bounds = geometry.boundingBox;
  check(bounds.min.x >= -0.491 && bounds.max.x <= 0.491 && bounds.min.z >= -0.491 && bounds.max.z <= 0.491,
    `muro/${age}: mantiene huella de instancia`);
  check(Math.abs(bounds.min.y + 0.6) < 1e-6 && Math.abs(bounds.max.y - 0.6) < 1e-6,
    `muro/${age}: altura de 1.2`);
  wallSignatures.add(geometry.attributes.position.count);
  geometry.dispose();
  const identity = parcel.wallMesh;
  parcel.applyLevel(age);
  check(parcel.wallMesh === identity, 'cambiar muro conserva la instancia de la escena');
  scene.updateMatrixWorld(true);
  ray.far = 2;
  for (const x of [-1.6, 0, 1.6]) {
    ray.set(new THREE.Vector3(x, 0.55, -7.5), new THREE.Vector3(0, 0, -1));
    check(ray.intersectObject(parcel.wallMesh).length === 0, `muro/${age}: entrega despejada`);
  }
  for (const direction of [new THREE.Vector3(1,0,0), new THREE.Vector3(-1,0,0), new THREE.Vector3(0,0,1)]) {
    const origin = direction.clone().multiplyScalar(7.5).setY(0.55);
    // Paño sólido: fuera de juntas del módulo y del aparejo de piedra.
    if (direction.x) origin.z = 0.65;
    else origin.x = 0.65;
    ray.set(origin, direction);
    check(ray.intersectObject(parcel.wallMesh).length > 0, `muro/${age}: perímetro cerrado`);
  }
}
check(wallSignatures.size === 4, 'cada época tiene construcción de muro distinta');

const landscape = new LandscapeRenderer(scene);
const landscapeIdentity = landscape.group;
check(landscape.group.children.length <= 7, 'paisaje de pocas mallas compartidas');
const groundBounds = new THREE.Box3().setFromObject(landscape.ground);
check(groundBounds.min.x < -100 && groundBounds.max.x > 100 && groundBounds.max.y < 0,
  'terreno continuo amplio y debajo de las baldosas');
const reserved = new THREE.Box3(new THREE.Vector3(-10, -1, -12), new THREE.Vector3(10, 5, 10));
for (const prop of landscape.props) {
  audit(prop.mesh.geometry, prop.mesh.name, 2000);
  check(!prop.bounds.intersectsBox(reserved), `${prop.mesh.name}: fuera de parcela y recepción`);
}
for (const prop of landscape.props.filter((p) => p.mesh.name.startsWith('grove-'))) {
  const bounds = prop.bounds;
  const separation = Math.max(bounds.min.x - (HALF_GRID + 1), -(HALF_GRID + 1) - bounds.max.x,
    bounds.min.z - (HALF_GRID + 1), -(HALF_GRID + 1) - bounds.max.z);
  check(separation > 0.5 && separation < 3, `${prop.mesh.name}: copa próxima al muro sin invadirlo`);
}
// Órbitas rasantes y altas, con distintos zooms: cualquier prop que se proyecte
// delante del área jugable debe desvanecerse, sin alterar su geometría.
const camera = new THREE.OrthographicCamera(-16, 16, 10, -10, 0.1, 120);
let occlusions = 0;
for (const elevation of [0.08, 0.65, 1.35]) for (const zoom of [0.55, 1, 3]) {
  for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 4) {
    camera.position.set(24 * Math.cos(elevation) * Math.sin(angle), 24 * Math.sin(elevation),
      24 * Math.cos(elevation) * Math.cos(angle));
    camera.zoom = zoom;
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
    for (let frame = 0; frame < 50; frame++) landscape.update(camera, 1 / 30);
    for (const prop of landscape.props) {
      const foreground = prop.bounds.getCenter(new THREE.Vector3()).sub(camera.position)
        .dot(camera.getWorldDirection(new THREE.Vector3())) < camera.position.length();
      if (foreground && prop.projected.intersectsBox(landscape._parcelRect)) {
        check(!prop.mesh.visible, `${prop.mesh.name}: paisaje no tapa el juego`);
        occlusions++;
      }
      check(Number.isFinite(prop.mesh.material.opacity) && prop.mesh.material.opacity >= 0 &&
        prop.mesh.material.opacity <= 1, 'transparencia de paisaje estable');
    }
  }
}
check(occlusions > 0, 'barrido de cámara ejercita ocultación de primer plano');

// Regresión de la franja de cielo inferior: toda la pantalla debe intersectar
// el terreno dentro de near/far, aun en órbita rasante, pan grande y zoom mínimo.
const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0.035);
const cornerOrigin = new THREE.Vector3();
const hit = new THREE.Vector3();
const coverageRay = new THREE.Ray();
for (const aspect of [390 / 844, 2, 3]) for (const zoom of [0.55, 1, 3]) {
  for (const elevation of [Math.PI * 0.02, 0.55, Math.PI / 2 - 0.2]) {
    for (const focus of [new THREE.Vector3(), new THREE.Vector3(10000, 0, -10000)]) {
      camera.left = -9 * aspect; camera.right = 9 * aspect;
      camera.top = 9; camera.bottom = -9;
      camera.zoom = zoom;
      camera.position.copy(focus).add(new THREE.Vector3(24 * Math.cos(elevation), 24 * Math.sin(elevation), 0));
      camera.lookAt(focus);
      camera.updateProjectionMatrix(); camera.updateMatrixWorld(true);
      const reference = focus.clone().add(new THREE.Vector3(1, 0.6, -2));
      const before = reference.clone().project(camera);
      fitGroundView(camera, focus, scene.fog);
      const after = reference.clone().project(camera);
      check(Math.abs(before.x - after.x) < 1e-6 && Math.abs(before.y - after.y) < 1e-6,
        'ajuste técnico conserva encuadre y zoom ortográficos');
      landscape.update(camera, 1 / 30, focus);
      const ground = new THREE.Box3().setFromObject(landscape.ground);
      for (const x of [-1, 1]) for (const y of [-1, 1]) {
        cornerOrigin.set(x, y, -1).unproject(camera);
        coverageRay.set(cornerOrigin, camera.getWorldDirection(new THREE.Vector3()));
        check(Boolean(coverageRay.intersectPlane(groundPlane, hit)), 'rayos inferiores no quedan bajo el suelo');
        const projected = hit.clone().project(camera);
        check(projected.z >= -1 && projected.z <= 1, 'terreno dentro de planos de recorte');
        check(hit.x >= ground.min.x && hit.x <= ground.max.x && hit.z >= ground.min.z && hit.z <= ground.max.z,
          'terreno cubre pantalla completa tras pan y órbita');
      }
      check(scene.fog.near > camera.position.distanceTo(focus) && Math.abs(scene.fog.far - scene.fog.near - 36) < 1e-6,
        'niebla conserva profundidad respecto al foco');
    }
  }
}
parcel.applyLevel(2);
check(landscape.group === landscapeIdentity, 'paisaje estable entre épocas');
const disposed = [];
landscape.group.traverse((mesh) => mesh.geometry?.addEventListener('dispose', () => disposed.push(mesh.name)));
landscape.dispose();
check(disposed.length === 6 && landscape.group.parent === null, 'paisaje libera sus seis geometrías');
delete globalThis.document;
console.log(`PASS smoke-models (${checks} checks; máquina máxima ${maxMachineTriangles} triángulos)`);
