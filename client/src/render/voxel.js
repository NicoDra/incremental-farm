// Chanchos S.A. — helper para arte voxel procedural (cajas fusionadas con colores por vértice)
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export function voxelBuilder() {
  const geos = [];
  return {
    add(w, h, d, x, y, z, color, ry = 0) {
      const g = new THREE.BoxGeometry(w, h, d);
      if (ry) g.rotateY(ry);
      g.translate(x, y, z);
      const c = new THREE.Color(color);
      const normals = g.attributes.normal;
      const count = g.attributes.position.count;
      const arr = new Float32Array(count * 3);
      for (let i = 0; i < count; i++) {
        // Grandes planos legibles sin ruido de textura: tapa clara, base oscura.
        const ny = normals.getY(i);
        const shade = ny > 0.5 ? 1 : ny < -0.5 ? 0.78 : 0.94;
        arr[i * 3] = c.r * shade;
        arr[i * 3 + 1] = c.g * shade;
        arr[i * 3 + 2] = c.b * shade;
      }
      g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
      geos.push(g);
      return this;
    },
    build() {
      const merged = mergeGeometries(geos, false);
      for (const g of geos) g.dispose();
      return merged;
    },
  };
}

export function voxelMaterial(opts = {}) {
  return new THREE.MeshLambertMaterial({ vertexColors: true, ...opts });
}
