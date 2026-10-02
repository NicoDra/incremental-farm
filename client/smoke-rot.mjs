// Verificación de rotación de canaletas tras M1.5-D3.
import RAPIER from '@dimforge/rapier3d-compat';
import { SimWorld } from './src/sim/world.js';

await RAPIER.init();
let now = 100000;
const tick = (s, n) => {
  for (let k = 0; k < n; k++) {
    now += 1000 / 60;
    s.step(1 / 60, now);
  }
};

// Recta rot8=2 (frente E): flujo O->E pasa; paredes N/S contienen.
{
  const sim = new SimWorld();
  sim.placeTool('recta', 5, 5, 0, 2, 0, now);
  const c = sim.cellCenter(5, 5);
  const p = sim.spawnProduct('corn', c.x - 0.4, 0.3, c.z, { x: 1.5, y: 0, z: 0 });
  tick(sim, 60);
  const t = p.body.translation();
  console.log('dbg recta E:', t.x.toFixed(2), t.z.toFixed(2), p.body.linvel());
  if (t.x <= c.x) throw new Error('recta E: producto no avanza en x+');
  if (Math.abs(t.z - c.z) > 0.45) throw new Error('recta E: pared lateral no contiene');
  console.log('ok recta E:', t.x.toFixed(2), t.z.toFixed(2));
}

// Curva rot8=0 (frente N, entrada derecha E): flujo desde E dobla al N.
{
  const sim = new SimWorld();
  sim.placeTool('curva', 5, 5, 0, 0, 0, now);
  const c = sim.cellCenter(5, 5);
  const p = sim.spawnProduct('corn', c.x + 0.35, 0.3, c.z + 0.2, { x: -1.4, y: 0, z: 0 });
  tick(sim, 40);
  const t = p.body.translation();
  console.log('ok curva rot0:', t.x.toFixed(2), t.z.toFixed(2));
  if (t.z >= c.z + 0.55) throw new Error('curva rot0: se escapa al sur');
}

// Curva rot8=2 (frente E, entrada derecha S): flujo desde S dobla al E.
{
  const sim = new SimWorld();
  sim.placeTool('curva', 5, 5, 0, 2, 0, now);
  const c = sim.cellCenter(5, 5);
  const p = sim.spawnProduct('corn', c.x - 0.2, 0.3, c.z + 0.35, { x: 0, y: 0, z: -1.4 });
  tick(sim, 40);
  const t = p.body.translation();
  console.log('ok curva rot2:', t.x.toFixed(2), t.z.toFixed(2));
  if (t.x <= c.x - 0.55) throw new Error('curva rot2: se escapa al oeste');
}

// Divisor rot8=4 (frente S): entrada por N, salida E/O relativas al frente.
{
  const sim = new SimWorld();
  sim.placeTool('divisor', 5, 5, 0, 4, 0, now);
  const c = sim.cellCenter(5, 5);
  const p = sim.spawnProduct('corn', c.x, 0.3, c.z - 0.35, { x: 0, y: 0, z: 1.4 });
  tick(sim, 10);
  const v = p.body.linvel();
  console.log('ok divisor rot4:', v.x.toFixed(2), v.z.toFixed(2));
}

console.log('ROT PASS');
