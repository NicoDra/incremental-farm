// Módulos de perímetro: eje longitudinal X, ancho/fondo máximos .98,
// altura 1.2. El origen final queda a media altura para las instancias.
// Se conserva la paleta de la parcela; el material se reconoce por su forma.
import * as THREE from 'three';
import { voxelBuilder } from './voxel.js';

export function buildWallGeometry(age, baseColor) {
  const v = voxelBuilder();
  const shade = (delta) => new THREE.Color(baseColor).offsetHSL(0, 0, delta);
  if (age === 0) {
    // Tierra apisonada: cuerpo sólido y dos retranqueos en el borde superior.
    v.add(0.98, 1.04, 0.98, 0, 0.52, 0, baseColor);
    v.add(0.98, 0.08, 0.88, 0, 1.08, 0, shade(0.015));
    v.add(0.88, 0.08, 0.72, 0, 1.16, 0, shade(0.025));
  } else if (age === 1) {
    // Tres tablones anchos entre postes estructurales, sin franjas pintadas.
    for (let board = 0; board < 3; board++) {
      v.add(0.235, 1.10, 0.84, (board - 1) * 0.25, 0.55, 0,
        board === 1 ? shade(0.015) : baseColor);
    }
    for (const x of [-0.43, 0.43]) v.add(0.12, 1.2, 0.98, x, 0.60, 0, shade(-0.035));
    for (const y of [0.12, 1.04]) v.add(0.74, 0.08, 0.90, 0, y, 0, shade(-0.02));
  } else if (age === 2) {
    // Hiladas desplazadas: las juntas pertenecen al aparejo, no al color.
    for (const x of [-0.25, 0.25]) v.add(0.48, 0.585, 0.98, x, 0.2925, 0, baseColor);
    v.add(0.47, 0.60, 0.98, 0, 0.90, 0, shade(0.012));
    for (const x of [-0.3725, 0.3725]) v.add(0.235, 0.60, 0.98, x, 0.90, 0, baseColor);
  } else {
    // Panel prefabricado de hormigón con juntas metálicas en los extremos.
    v.add(0.84, 1.14, 0.88, 0, 0.57, 0, baseColor);
    for (const x of [-0.455, 0.455]) {
      v.add(0.07, 1.2, 0.98, x, 0.60, 0, '#6f787c');
      for (const z of [-0.485, 0.485]) for (const y of [0.25, 0.95]) {
        v.add(0.045, 0.045, 0.01, x, y, z, '#a4afb1');
      }
    }
    for (const z of [-0.455, 0.455]) v.add(0.84, 0.055, 0.03, 0, 0.12, z, '#646d72');
  }
  const geometry = v.build();
  geometry.translate(0, -0.6, 0);
  return geometry;
}
