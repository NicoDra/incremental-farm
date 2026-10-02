import RAPIER from '@dimforge/rapier3d-compat';
import { SimWorld } from './src/sim/world.js';

await RAPIER.init();
const sim = new SimWorld();
sim.placeTool('embudo', 8, 4, 0, 0, 0, 0);
const p = sim.spawnProduct('corn', 0.5, 0.4, -2.6, { x: 0, y: 0, z: -4 });
let t = 0;
for (let s = 0; s < 120; s++) {
  sim.step(1 / 60, t);
  t += 1000 / 60;
  if (s % 15 === 0) {
    const tr = p.body.translation();
    const v = p.body.linvel();
    console.log(
      `s=${s} pos=(${tr.x.toFixed(2)}, ${tr.y.toFixed(2)}, ${tr.z.toFixed(2)}) v=(${v.x.toFixed(2)}, ${v.y.toFixed(2)}, ${v.z.toFixed(2)})`,
    );
  }
}
