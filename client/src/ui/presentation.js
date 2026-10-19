// Solo presentación. Las reglas y habilitaciones siguen en GameState/shared.
import { PRODUCTS, ageInfo, formatMoney } from 'chanchos-shared';

export const TOOL_LABELS = {
  recta: 'Recta', curva: 'Curva', rampa: 'Rampa', embudo: 'Embudo', rebote: 'Rebote',
  union: 'Unión Y/T', divisor: 'Divisor', puente: 'Puente', fan: 'Ventilador',
  sembrador: 'Sembrador', calabacera: 'Calabacera', salinera: 'Salinera',
  pienso: 'Mezcladora', corral: 'Corral', palomitera: 'Palomitera',
  jamonera: 'Jamonera', jamonera_industrial: 'Curadora', silo: 'Silo',
};
const PRODUCT_LABELS = { corn: 'Choclos', pumpkin: 'Calabazas', popcorn: 'Palomitas',
  pig: 'Cerdos', feed: 'Pienso', salt: 'Sal', ham: 'Jamones' };

export function ageProgress(state) {
  const next = state.nextAgePreview?.();
  if (!next) return null;
  const money = Math.min(state.money, next.cost);
  const goals = (next.goal || []).map((goal) => ({ ...goal,
    actual: state.deliveredKinds?.[goal.kind] || 0,
    have: Math.min(state.deliveredKinds?.[goal.kind] || 0, goal.count),
    name: PRODUCTS[goal.kind].name,
    shortName: PRODUCT_LABELS[goal.kind] || PRODUCTS[goal.kind].name,
  }));
  const ready = state.money >= next.cost && goals.every((goal) => goal.have >= goal.count);
  const ratios = [next.cost ? money / next.cost : 1, ...goals.map((goal) => goal.have / goal.count)];
  return { next, goals, ready, money,
    name: ageInfo((state.level || 0) + 1).name,
    progress: ratios.reduce((sum, value) => sum + value, 0) / ratios.length,
    summary: [ `${formatMoney(money)} / ${formatMoney(next.cost)}`,
      ...goals.map((goal) => `${goal.shortName} ${goal.have}/${goal.count}`) ].join(' · '),
  };
}

export function upgradeReason(state, id) {
  const check = state.canApplyUpgrade(id);
  if (check.ok) return '';
  if (check.reason === 'fondos insuficientes') return `Te faltan ${formatMoney(state.upgradePrice(id) - state.money)}`;
  if (check.reason === 'sin ranuras (subí de edad)') return 'Sin ranuras libres. Avanzá de época para obtener más.';
  if (check.reason === 'nivel máximo') return 'Nivel máximo alcanzado';
  return check.reason || 'No disponible';
}
