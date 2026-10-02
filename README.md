# Chanchos S.A.

Juego incremental/factory multijugador con físicas: granjas de cerditos voxel, sátira corporativa agropecuaria. Arte 100% procedural con Three.js, físicas con Rapier en el cliente.

## Estructura

- `/client` — Vite + Three.js + Rapier (simulación física local, render, UI)
- `/shared` — constantes de economía y grilla compartidas
- `/server` — Node.js + WebSockets (autoridad económica). **Pendiente (M2).**

## Correr local (M1: demo single-player)

Requisitos: Node 18+, pnpm.

```bash
pnpm install
pnpm dev
```

Abrir http://localhost:5173

Build de producción:

```bash
pnpm build
pnpm preview
```

## Qué hay en M1.5

- Parcela voxel 16×16 con 4 edades (Barro → Madera → Piedra → Fábrica): la edad amplía la parcela, desbloquea piezas y sube el multiplicador de ingresos.
- Físicas Rapier en el cliente: los productos son cuerpos rígidos (tope 120, duermen, se reciclan).
- Menú **Construir** agrupado por categorías (Caminos, Ventiladores, Emisores, Procesadores) con atajos 1–9/0: canaletas (recta, curva, embudo, rampa), piezas nuevas **unión** (dos entradas laterales → una salida al frente), **divisor** (una entrada atrás, salidas E/O que alternan por producto) y **puente** (tramo a N1 que cruza sobre otro camino), ventilador por fuerza con cono (`R` rota, `F` inclina), sembrador manual, calabacera y conversores (palomitera, corral, jamonera).
- Júmbos ×2, ventilador por tiers, mejoras con ranuras por edad, combos con multiplicador, productos dormidos que se reciclan.
- Sin lanzamiento libre: el sembrador emite con clic (una mejora lo vuelve automático). Demoler con reembolso (100% en Barro, 75% después); mover siempre gratis. Mantener el clic barre celdas (colocar/demoler en cadena).
- Cámara: arrastre + WASD/flechas. Atajos: `[`/`]` altura, `I` copiar pieza, `P` ayuda, `Esc` cancelar.
- Deshacer/rehacer con Ctrl+Z / Ctrl+Y (colocar, demoler, mover).
- Atascos: producto lento o dormido en una canaleta marca la celda en rojo (el embudo solo deja pasar productos chicos).
- Entrega por la brecha norte (portal dorado). Costos exponenciales (base × 1.15ⁿ), formato K/M/B.

## Smokes (verificación sin navegador)

```bash
node client/smoke-b.mjs    # cadena, conversores, fan tiers, mejoras (28)
node client/smoke-c.mjs    # reembolso, mover gratis, parcela por edad (20)
node client/smoke-d2.mjs   # rotaciones 90°, CSS, guía (154)
node client/smoke-d.mjs    # unión/divisor/puente, menú Construir, undo (66)
```

## Roadmap

- **M2**: servidor Node + WS, economía autoritativa, 2+ jugadores, chat.
- **M3**: Comedero Comunitario compartido + visitas de parcelas (snapshots).
- **Extra**: mercado dinámico global.
