// Chanchos S.A. — escena, cámara isométrica con órbita suave, luces
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const VIEW_D = 9;

export function createScene(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#bfd9e8');
  scene.fog = new THREE.Fog('#bfd9e8', 34, 70);

  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 120);
  function setFrustum() {
    const a = window.innerWidth / window.innerHeight;
    camera.left = -VIEW_D * a;
    camera.right = VIEW_D * a;
    camera.top = VIEW_D;
    camera.bottom = -VIEW_D;
    camera.updateProjectionMatrix();
  }
  setFrustum();
  camera.position.set(16, 14, 16);
  camera.lookAt(0, 0, 0);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, 0, 0);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.maxPolarAngle = Math.PI * 0.48;
  controls.minPolarAngle = 0.2;
  controls.minZoom = 0.55;
  controls.maxZoom = 3;

  const hemi = new THREE.HemisphereLight('#eaf4ff', '#8a6f52', 0.85);
  scene.add(hemi);

  const sun = new THREE.DirectionalLight('#fff2dd', 1.6);
  sun.position.set(10, 16, 7);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  const sc = sun.shadow.camera;
  sc.left = -14;
  sc.right = 14;
  sc.top = 14;
  sc.bottom = -14;
  sc.near = 1;
  sc.far = 50;
  sun.shadow.bias = -0.0004;
  scene.add(sun);

  window.addEventListener('resize', () => {
    renderer.setSize(window.innerWidth, window.innerHeight);
    setFrustum();
  });

  return { renderer, scene, camera, controls };
}
