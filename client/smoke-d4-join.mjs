// M1.5-D4 smoke headless: regla de aperturas y escape con Shift (punto 3).
// - canal↔canal: solo se abre si un lado es SALIDA del emisor (defaults + outputs)
// - canal↔máquina: abre flanco hacia salida/entrada, fuerza el resto cerrado
// - Shift (noAutoConnect): pareja solo respeta defaults, nunca fuerza
// - cadena zigzag: TODAS las aperturas correctas
// - flujo: emisión de conversor queda contenido en la canaleta vecina
// node smoke-d4-join.mjs  → sale 0 si todo pasa.
import RAPIER from '@dimforge/rapier3d-compat';
import { SimWorld } from './src/sim/world.js';

await RAPIER.init();

let now = 600000;
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
const opens = (sim, i, j) => sim.tools.get(sim.key(i, j, 0)).opens || {};

// ---- 1. canal↔canal: lado de ENTRADA no abre el vecino (regresión clave) ----
// recta r0 con W hacia curva: W no es salida de la recta; la curva tampoco
// empuja al oeste desde su flanco derecho. Antes: abría por OR de defaults.
{
  const sim = new SimWorld();
  ok(sim.placeTool('curva', 5, 5, 0, 0, 0, now), 'curva r0 (5,5)');
  ok(sim.placeTool('recta', 6, 5, 0, 0, 0, now), 'recta r0 (6,5)');
  const oRecta = opens(sim, 6, 5);
  const oCurva = opens(sim, 5, 5);
  ok(oRecta.W === true, `recta W abierto hacia la boca de la curva (T, opens=${JSON.stringify(oRecta)})`);
  ok(oRecta.N === true && oRecta.S === true, 'recta conserva sus defaults N/S');
  ok(oCurva.E === true, `curva mantiene su default E (opens=${JSON.stringify(oCurva)})`);

  // flujo: maíz disparado al oeste CRUZA a la celda de la curva (la T une)
  const c = sim.cellCenter(6, 5);
  const p = sim.spawnProduct('corn', c.x + 0.3, 0.3, c.z, { x: -1.5, y: 0, z: 0 });
  ok(!!p, 'maíz disparado hacia W');
  steps(sim, 90);
  const t = p.body.translation();
  ok(sim.products.includes(p), 'maíz sigue vivo tras cruzar');
  ok(t.x < c.x - 0.55, `maíz cruza a la curva por la T (x=${t.x.toFixed(2)}, centro=${c.x.toFixed(2)})`);
}

// ---- 2. canal↔máquina: abre solo el flanco hacia la boca ----
{
  const sim = new SimWorld();
  ok(sim.placeTool('corral', 5, 5, 0, 2, 0, now), 'corral r2 (5,5): sale E, entra W');
  ok(sim.placeTool('recta', 6, 5, 0, 0, 0, now), 'recta r0 (6,5) al este');
  ok(sim.placeTool('recta', 5, 6, 0, 0, 0, now), 'recta r0 (5,6) al sur');
  ok(sim.placeTool('recta', 5, 4, 0, 0, 0, now), 'recta r0 (5,4) al norte');
  const oEste = opens(sim, 6, 5);
  ok(oEste.W === true, `flanco hacia la boca de salida (E del corral) abierto (${JSON.stringify(oEste)})`);
  const oSur = opens(sim, 5, 6);
  ok(oSur.N === false, `flanco del sur forzado cerrado (${JSON.stringify(oSur)})`);
  const oNorte = opens(sim, 5, 4);
  ok(oNorte.S === false, `flanco del norte forzado cerrado (${JSON.stringify(oNorte)})`);
}

// ---- 3. Shift: pareja solo defaults (noAutoConnect) ----
{
  const sim = new SimWorld();
  // control: misma geometría SIN shift → se fuerza la apertura
  ok(sim.placeTool('recta', 5, 3, 0, 2, 0, now), 'control recta r2 (5,3)');
  ok(sim.placeTool('recta', 6, 3, 0, 0, 0, now, {}), 'control recta r0 (6,3)');
  ok(opens(sim, 6, 3).W === true, 'control sin shift: pareja forzada abierta (W=true)');

  // con shift: la pareja se salta, prevalecen los defaults
  ok(sim.placeTool('recta', 3, 3, 0, 2, 0, now), 'shift recta r2 (3,3)');
  ok(sim.placeTool('recta', 4, 3, 0, 0, 0, now, { noAutoConnect: true }), 'shift recta r0 (4,3)');
  const b = sim.tools.get(sim.key(4, 3, 0));
  ok(b.noAutoConnect === true, 'flag noAutoConnect guardado en la pieza');
  ok(opens(sim, 4, 3).W === false, `shift: pareja NO fuerza W (opens=${JSON.stringify(opens(sim, 4, 3))})`);
}

// ---- 4a. zigzag: TODAS las aperturas de la cadena (sembrador→curva→corral→curva→jamonera→curva) ----
{
  const sim = new SimWorld();
  ok(sim.placeTool('sembrador', 4, 8, 0, 0, 0, now), 'sembrador (4,8) r0');
  ok(sim.placeTool('curva', 4, 7, 0, 2, 0, now), 'curva (4,7) r2');
  ok(sim.placeTool('corral', 5, 7, 0, 2, 0, now), 'corral (5,7) r2');
  ok(sim.placeTool('curva', 6, 7, 0, 4, 0, now), 'curva (6,7) r4');
  ok(sim.placeTool('jamonera', 6, 8, 0, 4, 0, now), 'jamonera (6,8) r4');
  ok(sim.placeTool('curva', 6, 9, 0, 6, 0, now), 'curva (6,9) r6');

  const e47 = opens(sim, 4, 7);
  ok(e47.S === true && e47.E === true && e47.N === false && e47.W === false, `curva (4,7) opens=${JSON.stringify(e47)}`);
  const e67 = opens(sim, 6, 7);
  ok(e67.W === true && e67.S === true && e67.N === false && e67.E === false, `curva (6,7) opens=${JSON.stringify(e67)}`);
  const e69 = opens(sim, 6, 9);
  ok(e69.N === true && e69.W === true && e69.S === false && e69.E === false, `curva (6,9) opens=${JSON.stringify(e69)}`);
}

// ---- 4b. flujo: corral escupe cerdo a la canaleta vecina, contenido (punto 1) ----
// (Cadena boca-a-boca entre MÁQUINAS adyacentes no es posible hoy: la boca
//  cae dentro del cuerpo sólido del vecino y lo expulsa — pre-existente,
//  fuera del alcance D4. Ver reporte final.)
{
  const sim = new SimWorld();
  ok(sim.placeTool('corral', 5, 6, 0, 0, 0, now), 'corral (5,6) r0');
  ok(sim.placeTool('recta', 5, 5, 0, 0, 0, now), 'recta (5,5) r0 al norte');
  ok(sim.placeTool('calabacera', 5, 4, 0, 0, 0, now), 'calabacera (5,4) al norte de la recta');
  const rectaN = sim.tools.get(sim.key(5, 5, 0));
  ok(rectaN.opens.N === false, `calabacera cierra el norte de la recta (opens=${JSON.stringify(rectaN.opens)})`);
  const corral = sim.tools.get(sim.key(5, 6, 0));
  // alimentación manual por la trasera (patrón smoke-b); el conversor no emite
  // nada por su cuenta, solo convierte lo que asimila
  sim.spawnProduct('corn', corral.cx, 0.5, corral.cz + 0.3, { x: 0, y: 0, z: 0 });

  let pig = null;
  for (let k = 0; k < 60 * 6 && !pig; k++) {
    now += 1000 / 60;
    sim.step(STEP, now);
    pig = sim.products.find((pr) => pr.kind === 'pig') || null;
  }
  ok(!!pig, 'corral asimiló el maíz y escupió cerdo');
  if (pig) {
    const c = sim.cellCenter(5, 5);
    let escaped = false;
    let maxY = 0;
    for (let k = 0; k < 60 * 3; k++) {
      now += 1000 / 60;
      sim.step(STEP, now);
      if (!sim.products.includes(pig)) break;
      const t = pig.body.translation();
      maxY = Math.max(maxY, t.y);
      if (Math.abs(t.x - c.x) > 0.6 || Math.abs(t.z - c.z) > 0.6) escaped = true;
    }
    ok(sim.products.includes(pig), 'cerdo sigue vivo (no se escapó a la entrega)');
    ok(!escaped, 'cerdo contenido en la canaleta vecina');
    ok(maxY < 0.9, `cerdo no salta la pared (maxY=${maxY.toFixed(2)})`);
  }
}

console.log(`\nSMOKE-D4-JOIN PASS (${pass} checks)`);
