// Chanchos S.A. — runner único: todos los smokes headless + build.
// Uso: pnpm test:all (raíz) o pnpm --filter chanchos-client test:all.
// Sale 0 solo si TODO pasa (cada smoke + la build).
import { execFile } from 'node:child_process';

const SMOKES = [
  'smoke-b.mjs',
  'smoke-c.mjs',
  'smoke-d.mjs',
  'smoke-d2.mjs',
  'smoke-rot.mjs',
  'smoke-ui-d4.mjs',
  'smoke-d4-3abc.mjs',
  'smoke-d4-autojoin.mjs',
  'smoke-d4-curva.mjs',
  'smoke-d4-emit.mjs',
  'smoke-d4-fan.mjs',
  'smoke-d4-jamonera.mjs',
  'smoke-d4-join.mjs',
  'smoke-d4-ui6.mjs',
  'smoke-d5-debug-prod.mjs',
  'smoke-d5-f1.mjs',
  'smoke-d5-f2.mjs',
  'smoke-d5-f3.mjs',
  'smoke-d5-fan-salt.mjs',
  'smoke-d5-g-fan.mjs',
  'smoke-d5-f4-silo.mjs',
  'smoke-d5-jumbo-accept.mjs',
  'debug-embudo.mjs',
];

function runSmoke(file) {
  return new Promise((resolve) => {
    execFile(
      process.execPath,
      [file],
      { cwd: import.meta.dirname, timeout: 240_000, maxBuffer: 16 * 1024 * 1024 },
      (err, stdout, stderr) => {
        process.stdout.write(stdout || '');
        process.stderr.write(stderr || '');
        if (err) resolve({ file, ok: false, detail: String(err.message || err).split('\n')[0] });
        else resolve({ file, ok: true });
      },
    );
  });
}

const results = [];
for (const f of SMOKES) {
  console.log(`\n===== ${f} =====`);
  // eslint-disable-next-line no-await-in-loop
  const r = await runSmoke(f);
  results.push(r);
  console.log(`----- ${f}: ${r.ok ? 'PASS' : `FAIL (${r.detail})`} -----`);
  if (!r.ok) break; // corto en el primer rojo: el resto no aporta
}

// ---- build (solo si los smokes pasaron) ----
let buildOk = null;
if (results.every((r) => r.ok)) {
  console.log('\n===== vite build =====');
  try {
    const { build } = await import('vite');
    await build();
    buildOk = true;
    console.log('----- vite build: PASS -----');
  } catch (e) {
    buildOk = false;
    console.error('----- vite build: FAIL -----');
    console.error(e?.message || e);
  }
}

console.log('\n===== TEST:ALL resumen =====');
for (const r of results) console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.file}`);
if (buildOk !== null) console.log(`${buildOk ? 'PASS' : 'FAIL'}  vite build`);
const allOk = results.every((r) => r.ok) && buildOk === true;
const ranAll = results.length === SMOKES.length;
console.log(allOk && ranAll ? '\nTEST:ALL PASS' : '\nTEST:ALL FAIL');
process.exit(allOk && ranAll ? 0 : 1);
