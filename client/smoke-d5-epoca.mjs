// M1.5-E smoke: transición de época + perfil visual por época.
// Headless (sin Three.js): verifica contratos de datos (AGE_PALETTES, LEVELS)
// y que la transición repinta lo visual SIN mutar el GameState.
import { readFileSync } from 'node:fs';
import { AGE_PALETTES, LEVELS, AGES } from 'chanchos-shared';

let pass = 0;
function ok(cond, msg) {
  if (!cond) { console.error('FAIL:', msg); process.exit(1); }
  pass++;
}

const HEX = /^#[0-9a-fA-F]{6}$/;

// ── Test 1: AGE_PALETTES con forma válida (4 épocas, colores hex) ─────────────
ok(Array.isArray(AGE_PALETTES), 'AGE_PALETTES es array');
ok(AGE_PALETTES.length === 4, 'AGE_PALETTES tiene 4 épocas');
for (const [a, p] of AGE_PALETTES.entries()) {
  for (const k of ['wood', 'dark', 'metal', 'accent']) {
    ok(HEX.test(p[k]), `AGE_PALETTES[${a}].${k} es hex (${p[k]})`);
  }
}

// ── Test 2: LEVELS con forma válida (nombre + eslogan no vacíos) ──────────────
ok(LEVELS.length === 4, 'LEVELS tiene 4 épocas');
for (const [a, L] of LEVELS.entries()) {
  ok(typeof L.name === 'string' && L.name.length > 0, `LEVELS[${a}].name no vacío`);
  ok(typeof L.slogan === 'string' && L.slogan.length > 0, `LEVELS[${a}].slogan no vacío`);
}
const names = new Set(LEVELS.map((L) => L.name));
ok(names.size === LEVELS.length, 'nombres de época distintos');

// ── Test 3: índice de paleta clampeado (misma regla que el render) ────────────
function eraPaletteIndex(age) {
  return Math.max(0, Math.min(Number(age) || 0, AGE_PALETTES.length - 1));
}
ok(eraPaletteIndex(-5) === 0, 'edad negativa → 0');
ok(eraPaletteIndex(0) === 0, 'edad 0 → 0');
ok(eraPaletteIndex(3) === 3, 'edad 3 → 3');
ok(eraPaletteIndex(99) === 3, 'edad alta → tope 3');
ok(eraPaletteIndex('2') === 2, 'edad string numérica se convierte');
ok(eraPaletteIndex(undefined) === 0, 'edad undefined → 0');

// ── Test 4: paletas por época realmente distintas (granero/piezas cambian) ────
const woods = new Set(AGE_PALETTES.map((p) => p.wood));
ok(woods.size > 1, 'al menos 2 épocas con madera distinta');
ok(AGE_PALETTES[0].wood !== AGE_PALETTES[3].wood, 'Barro y Fábrica difieren en madera');

// ── Test 5: la transición NO muta el GameState (solo repinta lo visual) ───────
// Simula la transición: un "estado" inmutable + un "render" efímero.
function applyEraTransition({ state, render }, age) {
  const idx = eraPaletteIndex(age);
  // Mutaciones SOLO sobre el render (paleta visual), nunca sobre el estado.
  render.gatePalette = AGE_PALETTES[idx];
  render.toolPalette = AGE_PALETTES[idx];
  render.showBanner = { name: LEVELS[idx].name, slogan: LEVELS[idx].slogan };
  return { state, render };
}

const state = {
  level: 0,
  money: 1234,
  delivered: {},
  owned: { sembrador: 1 },
  tools: ['sembrador'],
};
const snapshot = JSON.stringify(state);
const render = { gatePalette: AGE_PALETTES[0], toolPalette: AGE_PALETTES[0], showBanner: null };

for (let a = 0; a < 4; a++) {
  applyEraTransition({ state, render }, a);
  ok(JSON.stringify(state) === snapshot, `estado intacto tras transición a edad ${a}`);
}
ok(render.showBanner && render.showBanner.name === LEVELS[3].name, 'banner toma el nombre de la época');
ok(render.gatePalette === AGE_PALETTES[3], 'paleta del granero actualizada tras transición');

// ── Test 6: AGES y AGES.length coherente con las paletas de época ─────────────
ok(AGES.length === AGE_PALETTES.length, 'AGES y AGE_PALETTES misma cantidad de épocas');

// ── Test 7: duración de la transición (completa > corta) ──────────────────────
const DUR = { full: 3000, short: 900 };
ok(DUR.full > DUR.short, 'transición completa dura más que la corta de debug');
ok(DUR.short > 0 && DUR.full > 0, 'duraciones positivas');

// ── Test 8: mood de luces por época (source scan de parcel.js) ────────────────
// El piso queda limpio (un tono + jitter): el color lo aportan luces + granero.
const parcelSrc = readFileSync('./src/render/parcel.js', 'utf8');
const moodRows = parcelSrc.match(/\{ hemiSky:[^}]+\}/g) || [];
ok(moodRows.length === 4, 'MOOD: 4 épocas de luz');
for (const [n, m] of moodRows.entries()) {
  const hex = m.match(/#[0-9a-fA-F]{6}/g) || [];
  ok(hex.length >= 4, `MOOD[${n}] con hemiSky/hemiGround/sun/fog`);
}
const palRows = parcelSrc.match(/\{ floor: '#[0-9a-fA-F]{6}', wall:[^}]+\}/g) || [];
ok(palRows.length === 4, 'PALETTES: 4 épocas suelo/muro/cielo');
for (const [n, p] of palRows.entries()) {
  ok(!/floor2|patch/.test(p), `PALETTES[${n}]: sin piso a 2 tonos (piso limpio)`);
}
ok(!/addDecal|_rebuildDecals/.test(parcelSrc), 'sin decals de suelo (quitaron)');
ok(!/j <= 3/.test(parcelSrc), 'sin sendero pintado en el piso');
ok(/isHemisphereLight/.test(parcelSrc) && /isDirectionalLight/.test(parcelSrc), 'mood aplica a hemi y sol');

// ── Test 9: remate de muros con acento de época (etapa 3) ─────────────────────
const trimRow = parcelSrc.match(/const WALL_TRIM = \[([^\]]+)\]/);
ok(Boolean(trimRow), 'WALL_TRIM existe');
if (trimRow) {
  const trims = trimRow[1].match(/#[0-9a-fA-F]{6}/g) || [];
  ok(trims.length === 4, 'WALL_TRIM: 4 acentos de época');
  ok(new Set(trims).size === 4, 'WALL_TRIM: acentos distintos entre épocas');
}
ok(/_rebuildWallTrim/.test(parcelSrc), 'remate de muros se rehace por época');

console.log(`PASS smoke-d5-epoca (${pass} checks)`);
