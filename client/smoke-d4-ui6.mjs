// M1.5-D4 Etapa 1 (repro punto 6, estático): interfaz.
// - sin pestaña "Ayuda" en el cajón (queda Construir/Mejoras/Edad; la ayuda
//   vive en "?" + modal guía).
// - fx.js agrega floats "+$" dentro de FLOAT_COMBINE_WINDOW_MS en un texto.
// - atasco usa JAM_MS (constante shared).
// - .float con contorno (contraste) y #sel-panel sin absolute en el dock.
// node smoke-d4-ui6.mjs → sale 0 si todo pasa.
import { readFileSync } from 'node:fs';

let pass = 0;
function ok(cond, msg) {
  if (!cond) {
    console.error('FAIL:', msg);
    process.exit(1);
  }
  pass++;
  console.log('ok:', msg);
}

const html = readFileSync('./index.html', 'utf8');
const css = readFileSync('./src/style.css', 'utf8');
const fx = readFileSync('./src/render/fx.js', 'utf8');
const world = readFileSync('./src/sim/world.js', 'utf8');

// 1. cajón sin pestaña Ayuda
ok(!/data-tab="help"/.test(html), 'cajón sin pestaña Ayuda');
const tabs = [...html.matchAll(/data-tab="([a-z]+)"/g)].map((m) => m[1]);
ok(
  tabs.includes('build') && tabs.includes('up') && tabs.includes('age') && tabs.length === 3,
  `cajón = Construir/Mejoras/Edad (${tabs.join(',')})`,
);
// la ayuda sigue en "?" + guía
ok(/btn-help|data-help|\?/.test(html), 'botón "?" presente');
ok(/id="guide"/.test(html), 'modal guía presente');

// 2. floats agregados en ventana de 0.5 s
ok(/FLOAT_COMBINE_WINDOW_MS/.test(fx), 'fx.js usa FLOAT_COMBINE_WINDOW_MS');

// 3. atasco tras N segundos (constante shared)
ok(/JAM_MS/.test(world), 'lógica de atasco usa JAM_MS');

// 4. contraste de floats
const floatBody = (css.match(/\.float\s*\{([^}]*)\}/) || [])[1] || '';
ok(/text-shadow/.test(floatBody), '.float con contorno (text-shadow)');

// 5. sel-panel en el dock, sin absolute
const dockMatch = html.match(/<footer\b[^>]*id="dock"[^>]*>[\s\S]*?<\/footer>/);
ok(dockMatch && /id="sel-panel"/.test(dockMatch[0]), '#sel-panel dentro de #dock');
const selBodies = [...css.matchAll(/#sel-panel\s*\{([^}]*)\}/g)].map((m) => m[1]);
ok(selBodies.length > 0 && !selBodies.some((b) => /position\s*:\s*absolute/.test(b)), '#sel-panel sin absolute');

console.log(`\nSMOKE-D4-UI6 PASS (${pass} checks)`);
