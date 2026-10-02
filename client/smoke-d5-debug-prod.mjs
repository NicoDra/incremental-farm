// M1.5-F debug guard: en build producción NO existe modo debug.
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const html = readFileSync(join(root, 'dist', 'index.html'), 'utf8');
const assetsDir = join(root, 'dist', 'assets');

function fail(msg) {
  console.error('FAIL:', msg);
  process.exit(1);
}

if (/id="debug-panel"/.test(html)) fail('debug panel no debe estar en dist/index.html');

// Busca bundle JS principal en index.html y verifica que no haya identificadores
// de debug panel cableados para producción.
const m = html.match(/assets\/(index-[^"']+\.js)/);
if (!m) fail('no se encontró bundle principal en dist/index.html');
const jsPath = join(assetsDir, m[1]);
if (!existsSync(jsPath)) fail('bundle principal no existe en dist/assets');
const js = readFileSync(jsPath, 'utf8');

if (/debug-panel/.test(js)) fail('bundle producción contiene marcador debug-panel');
if (/dbg-set-money|dbg-unlock|dbg-fill-buf|dbg-clear-buf/.test(js)) {
  fail('bundle producción contiene controles debug');
}

console.log('SMOKE-D5-DEBUG-PROD PASS');
