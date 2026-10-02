// M1.5-D4 auto-conexión: el extremo (boca) que apunta al costado abre la pared.
// - T recto→flanco (+ demolición recierra)
// - codo extremo↔extremo (+ OPEN_BACKS para traseras)
// - curva-boca→recto (el caso "curva con recto")
// - unión/divisor por sus bocas de entrada
// - niveles distintos no unen
// - no-fuga: el punteo no cuenta como boca (calificación solo por defecto)
// - flujo con ventilador: cruce de T y salida curva→recto sin trabarse
// node smoke-d4-autojoin.mjs → sale 0 si todo pasa.
import RAPIER from '@dimforge/rapier3d-compat';
import { SimWorld } from './src/sim/world.js';
import {
  OPEN_BACKS,
  DEAD_SIDES,
  localSideToWorldDir,
  worldDirToDelta,
} from 'chanchos-shared';

await RAPIER.init();

let now = 900000;
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
const opens = (sim, i, j, h = 0) => sim.tools.get(sim.key(i, j, h)).opens || {};

// ---- 1. T recto→flanco (+ demolición recierra; boca de SALIDA: ya abría) ----
{
  const sim = new SimWorld();
  ok(sim.placeTool('recta', 4, 5, 0, 2, 0, now), 'T: recta P(4,5) r2 (boca E)');
  ok(sim.placeTool('recta', 5, 5, 0, 0, 0, now), 'T: recta A(5,5) r0');
  ok(opens(sim, 5, 5).W === true, `T: A.W abre hacia la boca (${JSON.stringify(opens(sim, 5, 5))})`);
  ok(sim.removeTool(4, 5, 0), 'T: P demolida');
  ok(opens(sim, 5, 5).W === false, `T: A.W vuelve a cerrarse (${JSON.stringify(opens(sim, 5, 5))})`);
}

// ---- 2. codo boca-de-ENTRADA→trasera, gobernada por OPEN_BACKS ----
// P presenta su boca de entrada (right=S, NO salida); B presenta su pared
// left (trasera). Hoy: cerrado (ningún lado es salida).
{
  const sim = new SimWorld();
  ok(sim.placeTool('curva', 5, 4, 0, 2, 0, now), 'codo: curva P(5,4) r2 (boca S de entrada)');
  ok(sim.placeTool('curva', 5, 5, 0, 2, 0, now), 'codo: curva B(5,5) r2 (N = pared left)');
  ok(
    opens(sim, 5, 5).N === OPEN_BACKS,
    `codo: B.N === OPEN_BACKS (${OPEN_BACKS}, opens=${JSON.stringify(opens(sim, 5, 5))})`,
  );
  ok(opens(sim, 5, 4).S === true, 'codo: la boca P.S sigue abierta');
}

// ---- 2b. DEAD_SIDES en 4 orientaciones × niveles 0-2 ----
// Boca de salida apuntando a cada pared muerta: abre solo si OPEN_BACKS.
// (Solo colocación + lectura de opens: sin pasos de física, rápido.)
{
  const types = Object.keys(DEAD_SIDES);
  for (const h of [0, 1, 2]) {
    for (const type of types) {
      for (let r = 0; r < 8; r += 2) {
        for (const dead of DEAD_SIDES[type]) {
          const sim = new SimWorld();
          const d = localSideToWorldDir(r, dead);
          const { di, dj } = worldDirToDelta(d);
          const pr = d === 'N' || d === 'S' ? 0 : 2; // recta con boca hacia la pieza
          ok(sim.placeTool(type, 5, 5, h, r, 0, now) !== false, `dead: ${type} r${r} h${h} colocada`);
          ok(sim.placeTool('recta', 5 + di, 5 + dj, h, pr, 0, now) !== false, `dead: puntero hacia ${d} h${h}`);
          ok(
            opens(sim, 5, 5, h)[d] === OPEN_BACKS,
            `dead: ${type} r${r} ${dead}→${d} h${h} === OPEN_BACKS (${OPEN_BACKS})`,
          );
        }
      }
    }
  }
}

// ---- 2c. flancos rectos en 4 orientaciones × niveles: siempre abren ----
{
  for (const h of [0, 1, 2]) {
    for (let r = 0; r < 8; r += 2) {
      const sim = new SimWorld();
      const d = localSideToWorldDir(r, 'left');
      const { di, dj } = worldDirToDelta(d);
      const pr = d === 'N' || d === 'S' ? 0 : 2;
      ok(sim.placeTool('recta', 5, 5, h, r, 0, now) !== false, `flanco: recta r${r} h${h}`);
      ok(sim.placeTool('recta', 5 + di, 5 + dj, h, pr, 0, now) !== false, `flanco: puntero hacia ${d}`);
      ok(opens(sim, 5, 5, h)[d] === true, `flanco: recta r${r} ${d} h${h} abre`);
    }
  }
}

// ---- 3. curva-boca-de-ENTRADA→recto ----
{
  const sim = new SimWorld();
  ok(sim.placeTool('curva', 4, 7, 0, 0, 0, now), 'curva-boca: curva A(4,7) r0 (boca E de entrada)');
  ok(sim.placeTool('recta', 5, 7, 0, 0, 0, now), 'curva-boca: recta B(5,7) r0');
  ok(opens(sim, 5, 7).W === true, `curva-boca: B.W abre (${JSON.stringify(opens(sim, 5, 7))})`);
}

// ---- 4. unión/divisor por sus bocas de entrada ----
{
  const sim = new SimWorld();
  ok(sim.placeTool('union', 5, 5, 0, 2, 0, now), 'unión (5,5) r2 (boca N)');
  ok(sim.placeTool('recta', 5, 4, 0, 2, 0, now), 'recta (5,4) r2 al norte');
  ok(opens(sim, 5, 4).S === true, `unión: flanco S abre (${JSON.stringify(opens(sim, 5, 4))})`);
  ok(sim.placeTool('divisor', 7, 5, 0, 0, 0, now), 'divisor (7,5) r0 (boca S de entrada)');
  ok(sim.placeTool('recta', 7, 6, 0, 2, 0, now), 'recta (7,6) r2 al sur (flanco N)');
  ok(opens(sim, 7, 6).N === true, `divisor: flanco N abre (${JSON.stringify(opens(sim, 7, 6))})`);
}

// ---- 5. niveles distintos no unen ----
{
  const sim = new SimWorld();
  ok(sim.placeTool('recta', 4, 5, 1, 2, 0, now), 'N1: recta P(4,5) r2');
  ok(sim.placeTool('recta', 5, 5, 1, 0, 0, now), 'N1: recta A(5,5) r0');
  ok(opens(sim, 5, 5, 1).W === true, 'N1: la T une en el mismo nivel');
  ok(sim.placeTool('recta', 5, 5, 0, 0, 0, now), 'N0: recta A(5,5) r0');
  ok(opens(sim, 5, 5, 0).W === false, 'N0: sin unión entre niveles');
}

// ---- 6. no-fuga: T por boca de ENTRADA + circuito paralelo pegado ----
// P presenta su boca de entrada (E, no salida) al flanco W de A.
// B, pegado al este de A, presenta flanco contra flanco: debe quedar cerrado
// (la calificación es solo por defecto: el punteo en A.W no propaga).
{
  const sim = new SimWorld();
  ok(sim.placeTool('curva', 4, 5, 0, 0, 0, now), 'fuga: curva P(4,5) r0 (boca E de entrada)');
  ok(sim.placeTool('recta', 5, 5, 0, 0, 0, now), 'fuga: recta A(5,5) r0');
  ok(sim.placeTool('recta', 6, 5, 0, 0, 0, now), 'fuga: recta B(6,5) r0 (paralelo pegado)');
  ok(opens(sim, 5, 5).W === true, `fuga: A.W abre por la boca (${JSON.stringify(opens(sim, 5, 5))})`);
  ok(opens(sim, 5, 5).E === false, 'fuga: A.E sigue cerrado');
  ok(opens(sim, 6, 5).W === false, 'fuga: B.W sigue cerrado (sin propagación)');
  // determinismo: reinsertar A cambia el orden de iteración; el resultado
  // debe ser idéntico (el punteo nunca califica como boca).
  const before = JSON.stringify([opens(sim, 5, 5), opens(sim, 6, 5)]);
  ok(sim.removeTool(5, 5, 0), 'fuga: A demolida');
  ok(sim.placeTool('recta', 5, 5, 0, 0, 0, now), 'fuga: A re-colocada (otro orden)');
  const after = JSON.stringify([opens(sim, 5, 5), opens(sim, 6, 5)]);
  ok(before === after, 'fuga: mismo resultado sin importar el orden');
}

// ---- 7. flujo con ventilador: cruce de T oeste→este ----
{
  const sim = new SimWorld();
  ok(sim.placeTool('fan', 2, 5, 0, 2, 0, now), 'flujo-T: fan (2,5) r2 soplando E');
  ok(sim.placeTool('recta', 3, 5, 0, 2, 0, now), 'flujo-T: recta (3,5) r2');
  ok(sim.placeTool('recta', 4, 5, 0, 0, 0, now), 'flujo-T: recta A(4,5) r0 (la T)');
  ok(sim.placeTool('recta', 5, 5, 0, 2, 0, now), 'flujo-T: recta B(5,5) r2 continúa');
  const c0 = sim.cellCenter(3, 5);
  const p = sim.spawnProduct('corn', c0.x, 0.4, c0.z, { x: 1.6, y: 0, z: 0 });
  const cB = sim.cellCenter(5, 5);
  let crossed = false;
  for (let k = 0; k < 60 * 8 && !crossed; k++) {
    now += 1000 / 60;
    sim.step(STEP, now);
    if (!sim.products.includes(p)) break;
    crossed = p.body.translation().x > cB.x - 0.2;
  }
  ok(sim.products.includes(p), 'flujo-T: el producto sigue vivo');
  ok(crossed, 'flujo-T: cruza la T oeste→este sin trabarse');
}

// ---- 8. flujo con ventilador: curva-boca-de-ENTRADA→recto continúa ----
// La boca E de la curva r0 es de entrada (no salida): hoy la pared sigue
// cerrada y el producto rebota. Con la regla nueva cruza y continúa.
{
  const sim = new SimWorld();
  ok(sim.placeTool('fan', 3, 7, 0, 2, 0, now), 'flujo-C: fan (3,7) r2 soplando E');
  ok(sim.placeTool('curva', 4, 7, 0, 0, 0, now), 'flujo-C: curva (4,7) r0 (boca E de entrada)');
  ok(sim.placeTool('recta', 5, 7, 0, 0, 0, now), 'flujo-C: recta (5,7) r0');
  ok(sim.placeTool('recta', 6, 7, 0, 2, 0, now), 'flujo-C: recta (6,7) r2 continúa');
  const cc = sim.cellCenter(4, 7);
  const p = sim.spawnProduct('corn', cc.x - 0.3, 0.4, cc.z + 0.1, { x: 1.6, y: 0, z: 0 });
  const cC = sim.cellCenter(6, 7);
  let arrived = false;
  for (let k = 0; k < 60 * 8 && !arrived; k++) {
    now += 1000 / 60;
    sim.step(STEP, now);
    if (!sim.products.includes(p)) break;
    arrived = p.body.translation().x > cC.x - 0.2;
  }
  ok(sim.products.includes(p), 'flujo-C: el producto sigue vivo');
  ok(arrived, 'flujo-C: sale de la curva y continúa por el recto');
}

console.log(`\nSMOKE-D4-AUTOJOIN PASS (${pass} checks)`);
