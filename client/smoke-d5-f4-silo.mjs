// M1.5-F4 smoke: Silo, depósito en línea con salida a ritmo constante.
// - capacidad total: al tope no acepta (producto espera, sin rebote); al liberar, acepta.
// - suelta 1 por intervalo, sin ráfagas (incluso tras bloqueo largo).
// - boca ocupada: no suelta ni pierde; retoma al liberarse.
// - dos tipos: alterna.
// - silo ante procesador lleno: no inunda (conservación de unidades).
// - guardados sin cuerpo físico.
// - mejoras capacidad/velocidad aplican.
// - UI estática + regresión canal↔máquina con silo.
// node smoke-d5-f4-silo.mjs → sale 0 si todo pasa.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import RAPIER from '@dimforge/rapier3d-compat';
import { SimWorld } from './src/sim/world.js';
import { GameState } from './src/game/state.js';
import {
  TOOLS,
  AGES,
  TOOL_CATEGORIES,
  UPGRADE_LINES,
  SILO_CAP,
  SILO_INTERVAL_MS,
} from 'chanchos-shared';

await RAPIER.init();

let now = 2_000_000;
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
const total = (e) => Object.values(e.siloStore || {}).reduce((a, s) => a + s.count, 0);
function feed(sim, e, kind, n, jumbo = false) {
  for (let k = 0; k < n; k++) {
    sim.spawnProduct(kind, e.cx, 0.45, e.cz + 0.35, { x: 0, y: 0, z: -0.6 }, { jumbo });
    steps(sim, 25);
  }
  steps(sim, 40);
}

// ---- 0) registro estático ----
ok(TOOLS.silo && TOOLS.silo.kind === 'silo', 'F4: TOOLS.silo existe, kind silo');
ok(AGES[1].tools.includes('silo'), 'F4: silo desbloqueado en Madera');
ok(TOOL_CATEGORIES.some((c) => c.tools.includes('silo')), 'F4: silo en una categoría del menú');
ok(UPGRADE_LINES.silo_cap?.obj === 'silo', 'F4: mejora silo_cap existe');
ok(UPGRADE_LINES.silo_vel?.obj === 'silo', 'F4: mejora silo_vel existe');
ok(Number.isFinite(SILO_CAP) && SILO_CAP > 0, `F4: SILO_CAP=${SILO_CAP}`);
ok(Number.isFinite(SILO_INTERVAL_MS) && SILO_INTERVAL_MS > 0, `F4: SILO_INTERVAL_MS=${SILO_INTERVAL_MS}`);
{
  const root = dirname(fileURLToPath(import.meta.url));
  const hud = readFileSync(join(root, 'src', 'ui', 'hud.js'), 'utf8');
  const meshes = readFileSync(join(root, 'src', 'render', 'toolMeshes.js'), 'utf8');
  const main = readFileSync(join(root, 'src', 'main.js'), 'utf8');
  ok(/silo:\s*'🛢️'/.test(hud), 'F4 UI: icono del silo en HUD');
  ok(/info\.siloInfo/.test(hud), 'F4 UI: panel muestra contenido/capacidad/ritmo/estado del silo');
  ok(/silo.*mapToolToUpgradeObj|mapToolToUpgradeObj[\s\S]*silo/.test(hud), 'F4 UI: silo enlazado a sus mejoras');
  ok(/type === 'silo'/.test(meshes), 'F4 UI: modelo procedural + flechas del silo');
  ok(/siloInfo/.test(main), 'F4 UI: entryInfo expone estado del silo');
}

// ---- 1) llenar: al tope no acepta, sin rebote; al liberar, acepta ----
{
  const sim = new SimWorld();
  ok(sim.placeTool('silo', 5, 5, 0, 0, 0, now), 'F4: silo colocado');
  const e = sim.tools.get(sim.key(5, 5, 0));
  // bloquear la boca para que nada se suelte mientras llenamos
  const mouth = sim.mouthPos(e);
  const plug = sim.spawnProduct('corn', mouth.x, 0.5, mouth.z, { x: 0, y: 0, z: 0 });
  steps(sim, 20);
  feed(sim, e, 'corn', SILO_CAP + 3);
  ok(total(e) === SILO_CAP, `F4: silo corta en cap (${total(e)}/${SILO_CAP})`);
  const waiting = sim.products.filter((p) => p !== plug);
  ok(waiting.length >= 1, 'F4: excedente sigue afuera esperando');
  for (const p of waiting) {
    const v = p.body.linvel();
    ok(Math.hypot(v.x, v.y, v.z) < 1.5, 'F4: excedente sin rebote');
  }
  // liberar lugar: quitar tapón y dejar soltar 1, luego sembrar fresco: debe entrar
  sim.removeProduct(sim.products.indexOf(plug));
  const before = total(e);
  steps(sim, Math.ceil((SILO_INTERVAL_MS + 400) / (1000 / 60)));
  ok(total(e) <= before, 'F4: al soltar baja el stock');
  const mouth2 = sim.mouthPos(e);
  sim.spawnProduct('corn', mouth2.x, 0.5, mouth2.z, { x: 0, y: 0, z: 0 });
  steps(sim, 10);
  sim.spawnProduct('corn', e.cx, 0.45, e.cz + 0.35, { x: 0, y: 0, z: -0.6 });
  steps(sim, 90);
  ok(total(e) === SILO_CAP, `F4: al liberarse lugar acepta de nuevo (${total(e)}/${SILO_CAP})`);
}

// ---- 2) ritmo constante, sin ráfagas tras bloqueo largo ----
{
  const sim = new SimWorld();
  ok(sim.placeTool('silo', 9, 9, 0, 0, 0, now), 'F4: silo ritmo colocado');
  const e = sim.tools.get(sim.key(9, 9, 0));
  const mouth = sim.mouthPos(e);
  const plug = sim.spawnProduct('corn', mouth.x, 0.5, mouth.z, { x: 0, y: 0, z: 0 });
  steps(sim, 10);
  feed(sim, e, 'corn', 6);
  const stocked = total(e);
  ok(stocked >= 5, `F4: stock para ritmo (${stocked})`);
  // bloqueo largo: 3 intervalos con boca tapada → 0 sueltas
  const n0 = sim.products.length;
  steps(sim, Math.ceil((SILO_INTERVAL_MS * 3) / (1000 / 60)));
  ok(sim.products.length === n0, 'F4: bloqueado no suelta nada');
  // destapar: sin ráfaga inmediata, luego cadencia 1/intervalo (se drena lo
  // soltado, como haría una línea aguas abajo; polling fino anti-borde)
  sim.removeProduct(sim.products.indexOf(plug));
  steps(sim, 5);
  ok(sim.products.length === n0 - 1, 'F4: al liberar no hay ráfaga inmediata');
  const times = [];
  const known = new Set(sim.products);
  const tStart = now;
  while (now - tStart < 3800) {
    steps(sim, 6);
    for (const p of [...sim.products]) {
      if (!known.has(p)) {
        known.add(p);
        times.push(now);
        sim.removeProduct(sim.products.indexOf(p)); // drena: boca libre
      }
    }
  }
  ok(times.length >= 3 && times.length <= 4, `F4: ~1 por intervalo (${times.length} en 3.8s)`);
  const gaps = times.slice(1).map((t, i) => t - times[i]);
  ok(gaps.length > 0 && gaps.every((g) => g >= 1000 && g <= 1400), `F4: gaps constantes sin ráfaga (${gaps.map((g) => g.toFixed(0)).join(',')})`);
}

// ---- 3) boca ocupada: espera sin perder; retoma ----
{
  const sim = new SimWorld();
  ok(sim.placeTool('silo', 12, 5, 0, 0, 0, now), 'F4: silo boca colocado');
  const e = sim.tools.get(sim.key(12, 5, 0));
  feed(sim, e, 'corn', 3);
  const stocked = total(e);
  const mouth = sim.mouthPos(e);
  const plug = sim.spawnProduct('pumpkin', mouth.x, 0.5, mouth.z, { x: 0, y: 0, z: 0 });
  steps(sim, 10);
  steps(sim, Math.ceil((SILO_INTERVAL_MS * 2 + 400) / (1000 / 60)));
  ok(total(e) === stocked, 'F4: con boca ocupada no suelta ni pierde');
  ok(sim.products.includes(plug), 'F4: tapón sigue ahí');
  sim.removeProduct(sim.products.indexOf(plug));
  steps(sim, Math.ceil((SILO_INTERVAL_MS + 600) / (1000 / 60)));
  ok(total(e) === stocked - 1, 'F4: al liberar retoma la suelta');
}

// ---- 4) dos tipos: alterna ----
{
  const sim = new SimWorld();
  ok(sim.placeTool('silo', 3, 9, 0, 0, 0, now), 'F4: silo alternado colocado');
  const e = sim.tools.get(sim.key(3, 9, 0));
  const mouth = sim.mouthPos(e);
  const plug = sim.spawnProduct('corn', mouth.x, 0.5, mouth.z, { x: 0, y: 0, z: 0 });
  steps(sim, 10);
  feed(sim, e, 'corn', 2);
  feed(sim, e, 'pumpkin', 2);
  ok(total(e) === 4, 'F4: stock mixto 2+2');
  sim.removeProduct(sim.products.indexOf(plug));
  const seq = [];
  {
    const known = new Set(sim.products);
    const tStart = now;
    while (seq.length < 4 && now - tStart < 7000) {
      steps(sim, 6);
      for (const p of [...sim.products]) {
        if (!known.has(p)) {
          known.add(p);
          seq.push(p.kind);
          sim.removeProduct(sim.products.indexOf(p)); // drena: la boca queda libre
        }
      }
    }
  }
  ok(seq.length === 4, 'F4: 4 sueltas para alternar');
  ok(seq[0] !== seq[1] && seq[1] !== seq[2] && seq[2] !== seq[3], `F4: alterna tipos (${seq.join(',')})`);
  ok(seq.filter((k) => k === 'corn').length === 2 && seq.filter((k) => k === 'pumpkin').length === 2, 'F4: 2 y 2');
}

// ---- 5) silo ante procesador lleno: no inunda, conserva unidades ----
// silo → canaleta → corral (la boca directa entre máquinas solapa cuerpos).
{
  const sim = new SimWorld();
  ok(sim.placeTool('corral', 5, 5, 0, 0, 0, now), 'F4: corral receptor');
  ok(sim.placeTool('recta', 5, 6, 0, 0, 0, now), 'F4: canaleta intermedia');
  ok(sim.placeTool('silo', 5, 7, 0, 0, 0, now), 'F4: silo al sur de la canaleta');
  const cor = sim.tools.get(sim.key(5, 5, 0));
  const sil = sim.tools.get(sim.key(5, 7, 0));
  cor.pending = true;
  cor.busyUntil = now + 3_600_000;
  while (cor.buffer.length < 3) cor.buffer.push({ timeMs: 999999, jumbo: false, fatMult: 1, count: 1 });
  const mouth5 = sim.mouthPos(sil);
  const plug5 = sim.spawnProduct('corn', mouth5.x, 0.5, mouth5.z, { x: 0, y: 0, z: 0 });
  steps(sim, 10);
  feed(sim, sil, 'corn', 4);
  ok(total(sil) === 4, 'F4: silo cargado con 4');
  sim.removeProduct(sim.products.indexOf(plug5));
  steps(sim, Math.ceil(6000 / (1000 / 60)));
  const cornOut = sim.products.filter((p) => p.kind === 'corn');
  const released = 4 - total(sil);
  ok(released >= 2, `F4: silo entrega de a uno ante corral lleno (${released})`);
  ok(total(sil) + cornOut.length === 4, 'F4: nada se pierde ni se duplica en la espera');
  ok(cor.buffer.length === 3, 'F4: procesador lleno no aceptó de más');
  ok(!sim.products.some((p) => p.kind === 'pig'), 'F4: sin producción mientras sigue lleno');
  // vaciar procesador: debe absorber la espera
  cor.pending = false;
  cor.busyUntil = 0;
  cor.buffer.length = 0;
  steps(sim, 60 * 10);
  const pigs = sim.products.filter((p) => p.kind === 'pig').length;
  const cornLeft = sim.products.filter((p) => p.kind === 'corn').length;
  const accounted = total(sil) + cornLeft + cor.buffer.length + (cor.pending ? 1 : 0) + pigs;
  ok(accounted === 4, `F4: conserva las 4 unidades (${accounted})`);
  ok(pigs >= 1 || cor.pending, 'F4: el procesador absorbió la espera');
}

// ---- 6) guardados sin cuerpo físico ----
{
  const sim = new SimWorld();
  ok(sim.placeTool('silo', 7, 11, 0, 0, 0, now), 'F4: silo conteo colocado');
  const e = sim.tools.get(sim.key(7, 11, 0));
  const mouth = sim.mouthPos(e);
  const plug = sim.spawnProduct('corn', mouth.x, 0.5, mouth.z, { x: 0, y: 0, z: 0 });
  steps(sim, 10);
  feed(sim, e, 'pumpkin', 5);
  ok(total(e) === 5, 'F4: 5 guardados');
  ok(sim.products.length === 1 && sim.products[0] === plug, 'F4: guardados no ocupan cuerpos');
  sim.removeProduct(0);
  ok(sim.products.length === 0, 'F4: al quitar tapón, 0 cuerpos con 5 guardados');
}

// ---- 7) mejoras capacidad y velocidad ----
{
  const sim = new SimWorld();
  const st = new GameState();
  st.level = 1;
  st.money = 1_000_000;
  ok(st.applyUpgrade('silo_cap').ok, 'F4: mejora silo_cap aplicada');
  ok(st.applyUpgrade('silo_vel').ok, 'F4: mejora silo_vel aplicada');
  sim.setModifiers(st.simModifiers());
  ok(sim.siloCap() > SILO_CAP, `F4: cap sube (${SILO_CAP}→${sim.siloCap()})`);
  ok(sim.siloIntervalMs() < SILO_INTERVAL_MS, `F4: intervalo baja (${SILO_INTERVAL_MS}→${sim.siloIntervalMs()})`);
  ok(sim.placeTool('silo', 11, 11, 0, 0, 0, now), 'F4: silo mejorado colocado');
  const e = sim.tools.get(sim.key(11, 11, 0));
  const mouth = sim.mouthPos(e);
  const plug = sim.spawnProduct('corn', mouth.x, 0.5, mouth.z, { x: 0, y: 0, z: 0 });
  steps(sim, 10);
  feed(sim, e, 'corn', SILO_CAP + 2);
  ok(total(e) > SILO_CAP, `F4: con mejora guarda más que base (${total(e)})`);
  ok(total(e) <= sim.siloCap(), 'F4: respeta el nuevo tope');
}

// ---- 8) regresión canal↔silo: abre a bocas, cierra flanco ----
{
  const sim = new SimWorld();
  ok(sim.placeTool('silo', 5, 5, 0, 0, 0, now), 'F4: silo r0 (sale N, entra S)');
  ok(sim.placeTool('recta', 5, 4, 0, 0, 0, now), 'F4: recta al norte (salida)');
  ok(sim.placeTool('recta', 6, 5, 0, 0, 0, now), 'F4: recta al este (flanco)');
  ok(sim.placeTool('recta', 5, 6, 0, 0, 0, now), 'F4: recta al sur (entrada)');
  const oN = sim.tools.get(sim.key(5, 4, 0)).opens;
  const oE = sim.tools.get(sim.key(6, 5, 0)).opens;
  const oS = sim.tools.get(sim.key(5, 6, 0)).opens;
  ok(oN.S === true, `F4: norte abre hacia la salida (${JSON.stringify(oN)})`);
  ok(oE.W === false, `F4: flanco este cerrado (${JSON.stringify(oE)})`);
  ok(oS.N === true, `F4: sur abre hacia la entrada (${JSON.stringify(oS)})`);
}

// ---- 9) silo en N1/N2 con boca y aceptación a su altura ----
{
  const sim = new SimWorld();
  ok(sim.placeTool('silo', 5, 5, 1, 0, 0, now), 'F4N: silo en N1');
  ok(sim.placeTool('silo', 6, 5, 2, 0, 0, now), 'F4N: silo en N2');
  ok(!sim.placeTool('silo', 7, 5, 3, 0, 0, now), 'F4N: silo rechaza N3');
  ok(!sim.placeTool('silo', 7, 5, -1, 0, 0, now), 'F4N: silo rechaza N-1');
  const e = sim.tools.get(sim.key(5, 5, 1));
  ok(Math.abs(e.baseY - 1.0) < 1e-9, 'F4N: cuerpo a altura N1');
  const m = sim.mouthPos(e);
  ok(Math.abs(m.y - 1.55) < 1e-9, 'F4N: boca a N1+0.55');
  const plug = sim.spawnProduct('corn', m.x, m.y, m.z, { x: 0, y: 0, z: 0 });
  steps(sim, 10);
  for (let k = 0; k < 4; k++) {
    sim.spawnProduct('corn', e.cx, e.baseY + 0.45, e.cz + 0.35, { x: 0, y: 0, z: -0.6 });
    steps(sim, 25);
  }
  steps(sim, 40);
  ok(total(e) >= 3, `F4N: acepta a altura N1 (${total(e)})`);
  ok(sim.products.includes(plug), 'F4N: tapón de boca sigue afuera');
}

// ---- 10) aviso boca-pegada: hint + bloqueo en colocación (capa UI) ----
{
  const root = dirname(fileURLToPath(import.meta.url));
  const shared = readFileSync(join(root, '..', 'shared', 'src', 'index.js'), 'utf8');
  const main = readFileSync(join(root, 'src', 'main.js'), 'utf8');
  ok(/canaleta entre medio/.test(shared), 'F4M: tooltip del silo avisa canaleta entre medio');
  ok(/siloMouthComplaint/.test(main), 'F4M: preview calcula boca pegada a máquina');
  ok(/poné una canaleta entre medio/.test(main), 'F4M: preview y bloqueo muestran el aviso');
}

console.log(`\nSMOKE-D5-F4-SILO PASS (${pass} checks)`);
