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
const hud = readFileSync('./src/ui/hud.js', 'utf8');
const main = readFileSync('./src/main.js', 'utf8');

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

// 5. sel-panel en el rail izquierdo, sin absolute
const iRail = html.indexOf('id="left-rail"');
const iSel = html.indexOf('id="sel-panel"');
ok(iRail >= 0 && iSel > iRail, '#sel-panel dentro de #left-rail');
const selBodies = [...css.matchAll(/#sel-panel\s*\{([^}]*)\}/g)].map((m) => m[1]);
ok(selBodies.length > 0 && !selBodies.some((b) => /position\s*:\s*absolute/.test(b)), '#sel-panel sin absolute');

// 6. M1.5-G fix botones: el panel se reconstruye por frame, así que los
// botones usan delegación (un solo listener) en vez de listeners por botón.
ok(/el\.sel\.addEventListener\('click'/.test(hud), 'panel: un solo listener delegado en #sel-panel');
for (const act of ['emit', 'pause', 'move', 'upgrade', 'sell', 'close', 'fan-power', 'fan-range']) {
  ok(new RegExp(`dataset\\.act = '${act}'`).test(hud), `panel: botón data-act="${act}"`);
}
{
  const body = hud.slice(hud.indexOf('showSelection(info) {'));
  ok(!/addEventListener\('click'/.test(body), 'panel: showSelection sin listeners por botón');
}
// 7. M1.5-G fix atajos: no actúan escribiendo en inputs.
ok(/INPUT\|TEXTAREA\|SELECT/.test(main), 'atajos ignorados dentro de inputs');

console.log(`\nSMOKE-D4-UI6 PASS (${pass} checks)`);
