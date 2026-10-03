// Chanchos S.A. — RNG con semilla (mulberry32). Mismo algoritmo que el sim
// headless, para que el balance sea reproducible.
let seed = 1;
export function setSimSeed(n) {
  seed = Math.max(1, Math.floor(Number(n) || 1)) >>> 0;
}
export function rand() {
  seed = (seed + 0x6d2b79f5) >>> 0;
  let t = seed;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
