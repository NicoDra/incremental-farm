// Chanchos S.A. — partículas de entrega + números flotantes (DOM proyectado)
import * as THREE from 'three';
import { FLOAT_COMBINE_WINDOW_MS, formatMoney } from 'chanchos-shared';

const PARTICLE_N = 240;
const FLOAT_MS = 900;

export class Fx {
  constructor(scene, floatLayer, camera, renderer) {
    this.camera = camera;
    this.renderer = renderer;
    this.layer = floatLayer;

    this.pos = new Float32Array(PARTICLE_N * 3);
    this.vel = new Float32Array(PARTICLE_N * 3);
    this.life = new Float32Array(PARTICLE_N);
    for (let i = 0; i < PARTICLE_N; i++) this.pos[i * 3 + 1] = -999;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    this.points = new THREE.Points(
      geo,
      new THREE.PointsMaterial({
        color: '#f2c94c',
        size: 0.16,
        transparent: true,
        opacity: 0.9,
        depthWrite: false,
      }),
    );
    this.points.frustumCulled = false;
    this.cursor = 0;
    scene.add(this.points);

    this.floats = []; // { el, x, y, z, born }
    this._v = new THREE.Vector3();
  }

  burst(x, y, z, colorHex) {
    this.points.material.color.set(colorHex);
    for (let n = 0; n < 12; n++) {
      const i = this.cursor;
      this.cursor = (this.cursor + 1) % PARTICLE_N;
      this.pos[i * 3] = x;
      this.pos[i * 3 + 1] = y;
      this.pos[i * 3 + 2] = z;
      this.vel[i * 3] = (Math.random() - 0.5) * 3;
      this.vel[i * 3 + 1] = 1.5 + Math.random() * 2.5;
      this.vel[i * 3 + 2] = (Math.random() - 0.5) * 3;
      this.life[i] = 0.7;
    }
  }

  // M1.5-D4 punto 6: los floats numéricos (misma clase, misma zona) que
  // nacen dentro de FLOAT_COMBINE_WINDOW_MS se suman en un único texto en vez
  // de apilarse (p. ej. entregas seguidas sobre el portal).
  float(x, y, z, text, cls, amount, mult) {
    const c = cls || 'gold';
    const now = performance.now();
    if (typeof amount === 'number') {
      for (const f of this.floats) {
        if (f.cls !== c || typeof f.amount !== 'number') continue;
        if (now - f.born > FLOAT_COMBINE_WINDOW_MS) continue;
        const dx = f.x - x;
        const dz = f.z - z;
        if (dx * dx + dz * dz > 4.0) continue;
        f.amount += amount;
        f.mult = mult;
        f.el.textContent = Fx.label(f.amount, f.mult);
        f.born = now;
        return;
      }
    }
    const el = document.createElement('div');
    el.className = 'float ' + c;
    el.textContent = text;
    this.layer.appendChild(el);
    this.floats.push({ el, x, y, z, born: now, cls: c, amount: typeof amount === 'number' ? amount : null, mult });
  }

  static label(amount, mult) {
    return `+${formatMoney(amount)}${mult > 1 ? ' x' + mult.toFixed(1) : ''}`;
  }

  update(dt, nowMs) {
    for (let i = 0; i < PARTICLE_N; i++) {
      if (this.life[i] <= 0) continue;
      this.life[i] -= dt;
      if (this.life[i] <= 0) {
        this.pos[i * 3 + 1] = -999;
        continue;
      }
      this.vel[i * 3 + 1] -= 8 * dt;
      this.pos[i * 3] += this.vel[i * 3] * dt;
      this.pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt;
      this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
    }
    this.points.geometry.attributes.position.needsUpdate = true;

    const w = this.renderer.domElement.clientWidth;
    const h = this.renderer.domElement.clientHeight;
    for (let idx = this.floats.length - 1; idx >= 0; idx--) {
      const f = this.floats[idx];
      const age = nowMs - f.born;
      if (age > FLOAT_MS) {
        f.el.remove();
        this.floats.splice(idx, 1);
        continue;
      }
      this._v.set(f.x, f.y, f.z).project(this.camera);
      const sx = (this._v.x * 0.5 + 0.5) * w;
      const sy = (-this._v.y * 0.5 + 0.5) * h - age * 0.045;
      f.el.style.transform = `translate(${sx.toFixed(1)}px, ${sy.toFixed(1)}px) translate(-50%, -50%)`;
      f.el.style.opacity = String(1 - age / FLOAT_MS);
    }
  }
}
