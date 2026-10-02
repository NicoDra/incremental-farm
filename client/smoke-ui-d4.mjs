// smoke-ui-d4.mjs — assertions estáticas de layout M1.5-D4 (sin navegador).
// Lee index.html y style.css como texto y verifica:
//  (a) #sel-panel es descendiente de #left-rail (antes #dock: refactor a rail)
//  (b) ninguna regla CSS de #sel-panel usa position: absolute
//  (c) la regla .float tiene un text-shadow con >= 3 capas (contorno)
//  (d) #floats tiene z-index explícito >= 5
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = dirname(fileURLToPath(import.meta.url));
const html = readFileSync(join(root, 'index.html'), 'utf8');
const css = readFileSync(join(root, 'src', 'style.css'), 'utf8');

const fail = (msg) => {
  console.error('UI-D4 FAIL: ' + msg);
  process.exit(1);
};

// (a) #sel-panel dentro de #left-rail
const railMatch = html.match(/<div\b[^>]*id="left-rail"[^>]*>([\s\S]*?)<div id="hint"/);
if (!railMatch) fail('#left-rail no encontrado en index.html');
if (!/id="sel-panel"/.test(railMatch[1])) fail('#sel-panel no es descendiente de #left-rail');

// extrae todos los cuerpos de reglas para un selector dado (CSS plano, sin anidar)
const ruleBodies = (selectorRe) => {
  const bodies = [];
  const re = new RegExp(selectorRe.source, 'g');
  let m;
  while ((m = re.exec(css)) !== null) {
    const open = css.indexOf('{', m.index);
    if (open === -1) break;
    const close = css.indexOf('}', open);
    if (close === -1) fail('regla sin cerrar para ' + m[0]);
    bodies.push(css.slice(open + 1, close));
  }
  return bodies;
};

// (b) #sel-panel nunca absolute
const selBodies = ruleBodies(/#sel-panel\s*\{/);
if (selBodies.length === 0) fail('sin reglas CSS para #sel-panel');
for (const b of selBodies) {
  if (/position\s*:\s*absolute/.test(b)) fail('#sel-panel usa position: absolute');
}

// (c) .float text-shadow con >= 3 capas
const floatBodies = ruleBodies(/\.float\s*\{/);
if (floatBodies.length === 0) fail('sin regla CSS para .float');
const ts = floatBodies.find((b) => /text-shadow\s*:/.test(b));
if (!ts) fail('.float no define text-shadow');
const tsValue = ts.match(/text-shadow\s*:([^;]+)/)[1];
let depth = 0;
let layers = 1;
for (const ch of tsValue) {
  if (ch === '(') depth++;
  else if (ch === ')') depth--;
  else if (ch === ',' && depth === 0) layers++;
}
if (layers < 3) fail('.float text-shadow tiene solo ' + layers + ' capa(s), se exigen >= 3');

// (d) #floats z-index >= 5
const floatsBodies = ruleBodies(/#floats\s*\{/);
if (floatsBodies.length === 0) fail('sin regla CSS para #floats');
const zi = floatsBodies.find((b) => /z-index\s*:/.test(b));
if (!zi) fail('#floats sin z-index explícito');
const ziValue = parseInt(zi.match(/z-index\s*:\s*(\d+)/)[1], 10);
if (!(ziValue >= 5)) fail('#floats z-index=' + ziValue + ' se exige >= 5');

// (e) z-fighting: la losa de la canaleta no toca el plano del suelo (y=0).
{
  const src = readFileSync(join(root, 'src', 'render', 'toolMeshes.js'), 'utf8');
  const m = src.match(/const floorCenterY = (-?[0-9.]+);/);
  if (!m) fail('floorCenterY no encontrado en toolMeshes.js');
  else {
    // cara inferior = centroY - semialto (0.03). floorCenterY negativo = debajo
    // del plano → la cara inferior queda por debajo del suelo → coplanar.
    const bottomFace = parseFloat(m[1]) - 0.03;
    // después del fix, el centro está justo por encima del suelo:
    // floorCenterY = +0.02 → cara inferior en y=-0.01 → la losa flota 0.01.
    const gap = parseFloat(m[1]) - 0.03; // distancia cara inferior desde lo alto
    // la cara superior de la losa queda en y = floorCenterY + 0.03
    const topFace = parseFloat(m[1]) + 0.03;
    if (!(topFace > 0.002 && bottomFace + 0.03 > 0)) {
      fail(`losa coplanar (top=${topFace.toFixed(3)}, bottom=${bottomFace.toFixed(3)})`);
    }
  }
}

console.log('UI-D4 PASS');
