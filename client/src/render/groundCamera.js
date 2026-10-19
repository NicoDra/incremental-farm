// Cámara ortográfica sobre terreno continuo. Acercar el ángulo al horizonte
// baja los rayos inferiores por debajo del suelo si la cámara queda muy cerca.
// Alejarla sobre su propio eje conserva exactamente encuadre, órbita y zoom.
import * as THREE from 'three';

const BASE_DISTANCE = Math.hypot(16, 14, 16);
const offset = new THREE.Vector3();

export function fitGroundView(camera, target, fog, groundY = -0.035) {
  offset.copy(camera.position).sub(target);
  if (offset.lengthSq() < 1e-10) return;
  offset.normalize();
  const vertical = Math.max(0.001, offset.y);
  const horizontal = Math.sqrt(Math.max(0, 1 - vertical * vertical));
  const halfHeight = Math.max(Math.abs(camera.top), Math.abs(camera.bottom)) / camera.zoom;
  // Todos los puntos del plano de recorte cercano quedan sobre el suelo,
  // incluido el borde inferior de pantalla al alejar el zoom.
  const requiredDistance = (halfHeight * horizontal + groundY - target.y + 0.5) / vertical + camera.near;
  const distance = Math.max(BASE_DISTANCE, requiredDistance);
  camera.position.copy(target).addScaledVector(offset, distance);
  // El plano lejano incluye las intersecciones superiores con el terreno.
  const far = distance + (halfHeight * horizontal + Math.abs(target.y - groundY)) / vertical + 64;
  if (Math.abs(camera.far - far) > 1e-6) {
    camera.far = far;
    camera.updateProjectionMatrix();
  }
  camera.updateMatrixWorld(true);
  // El alejamiento técnico no debe sumergir el tablero en niebla.
  if (fog) {
    fog.near = distance + 34 - BASE_DISTANCE;
    fog.far = distance + 70 - BASE_DISTANCE;
  }
}
