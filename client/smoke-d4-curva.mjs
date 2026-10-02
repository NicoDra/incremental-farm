// M1.5-D4 Etapa 1 (repro punto 4): la curva NO debe tener paredes en diagonal.
// Estilo voxel = solo paredes ortogonales (L exterior). Requiere:
// - sim.channelColliders(i,j,h) → [{x,y,z,hx,hy,hz,yawDeg}] (ayuda de debug;
//   FALLA hoy porque no existe).
// - todos los colisionadores alineados a ejes (yaw múltiplo de 90°).
// - un producto entra por el lado de entrada y sale por el frente (4 rots).
// node smoke-d4-curva.mjs → sale 0 si todo pasa.
import RAPIER from '@dimforge/rapier3d-compat';
import { SimWorld } from './src/sim/world.js';

await RAPIER.init();

let now = 800000;
const STEP = 1 / 60;
let pass = 0;
function ok(cond, msg) {
  if (!cond) {
    console.error('FAIL:', msg);
    process.exit(1);
  }
  pass++;
  console.log('ok:', msg);
}
function steps(sim, n) {
  for (let k = 0; k < n; k++) {
    now += 1000 / 60;
    sim.step(STEP, now);
  }
}

// mundo: N = -z, E = +x. curva r0: frente N, entrada E. r2: frente E, entrada S.
// r4: frente S, entrada W. r6: frente W, entrada N.
const DIRS = { N: { x: 0, z: -1 }, E: { x: 1, z: 0 }, S: { x: 0, z: 1 }, W: { x: -1, z: 0 } };
const CURVA = [
  { rot8: 0, front: 'N', entry: 'E' },
  { rot8: 2, front: 'E', entry: 'S' },
  { rot8: 4, front: 'S', entry: 'W' },
  { rot8: 6, front: 'W', entry: 'N' },
];

for (const { rot8, front, entry } of CURVA) {
  const sim = new SimWorld();
  ok(sim.placeTool('curva', 5, 5, 0, rot8, 0, now), `curva r${rot8} colocada (frente ${front})`);
  ok(typeof sim.channelColliders === 'function', 'sim.channelColliders existe (ayuda debug)');
  const cols = sim.channelColliders(5, 5, 0);
  ok(Array.isArray(cols) && cols.length > 0, `curva r${rot8}: hay colisionadores (${cols.length})`);
  for (const c of cols) {
    const yaw = ((c.yawDeg % 180) + 180) % 180;
    const aligned = Math.abs(yaw) < 1 || Math.abs(yaw - 90) < 1;
    ok(aligned, `curva r${rot8}: colisionador a ejes (yaw=${c.yawDeg})`);
  }
  // recorrido: entra por el lado de entrada, sale por el frente
  const cc = sim.cellCenter(5, 5);
  const ed = DIRS[entry];
  const fd = DIRS[front];
  const p = sim.spawnProduct('corn', cc.x + ed.x * 0.35, 0.4, cc.z + ed.z * 0.35, {
    x: -ed.x * 1.6, y: 0, z: -ed.z * 1.6,
  });
  let exited = false;
  for (let k = 0; k < 60 * 4 && !exited; k++) {
    now += 1000 / 60;
    sim.step(STEP, now);
    const t = p.body.translation();
    const dx = t.x - (cc.x + fd.x * 1.0);
    const dz = t.z - (cc.z + fd.z * 1.0);
    if (Math.hypot(dx, dz) < 0.6) exited = true;
  }
  ok(exited, `curva r${rot8}: el producto entra por ${entry} y sale por ${front}`);
}

// tiers: la geometría no depende de la edad (solo el material)
{
  const sim = new SimWorld();
  ok(sim.placeTool('curva', 5, 5, 0, 0, 0, now, { age: 3 }), 'curva tier3 colocada');
  const cols = sim.channelColliders(5, 5, 0);
  for (const c of cols) {
    const yaw = ((c.yawDeg % 180) + 180) % 180;
    ok(Math.abs(yaw) < 1 || Math.abs(yaw - 90) < 1, `tier3: colisionador a ejes (yaw=${c.yawDeg})`);
  }
}

console.log(`\nSMOKE-D4-CURVA PASS (${pass} checks)`);
