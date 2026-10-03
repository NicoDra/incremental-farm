# ROADMAP

## Completados

- **M0 / M1** — parcela 16x16, portal, economía básica, sembrador manual + auto, canaletas, ventilador, jamonera, historial de construcción.
- **M1.5-A** — ventilador por tiers de fuerza real sobre física.
- **M1.5-B** — mejoras con ranuras por edad, costes de curva 1.8 vs 1.5, sembrador auto con mejora.
- **M1.5-C** — mover gratis, demoler con reembolso por edad, zona jugable por edad, guía del primer minuto.
- **M1.5-D** — unión Y/T, divisor (alterna E/O), puente en N1, embudo, canaleta rebote, cuentagotas, deshacer/rehacer.
- **M1.5-D2** — invariante de rotación (solo 90° × piezas; fan en 8 dirs), snap al elegir/copiar, migración.
- **M1.5-D3** — fricción por tier de canaleta, apertura trasera ensanchada, júmbos holgados, venta de sueltos por clic.
- **M1.5-D4** — auto-conexión por bocas (canal↔canal solo si el par es boca), canal↔máquina abre solo a la boca, Shift = sin auto-uniones, emisión sin lift vertical, jam en canaleta, UI dock y guía rediseñadas.
- **M1.5-F1** — buffers internos de conversores (3/celda, extra espera en canaleta), sin romper auto-conexión ni canal↔máquina.
- **M1.5-F1b** — smokes D4 corregidos/extendidos (auto-join, join, 3abc, emit, curva, fan, jamonera, ui6).
- **M1.5-F2** — recetas de dos ingredientes (pienso = choclo+calabaza, jamonera_industrial = cerdo+sal) con buffer por ingrediente, línea real verificada, jumbo en recetas, ingrediente equivocado no entra.
- **M1.5-F3** — política de sueltos (cap 120, sin despawn por tiempo), emisores/conversores se pausan al tope, "vender suelo" global + prioridad clic en producto sobre pieza.
- **M1.5-F4** — silo (cap 10, +4/nivel, 1.2 s, alterna tipos, sin cuerpos almacenados, N0/N1/N2, aviso de boca pegada), mejora de capacidad y velocidad, `pnpm test:all`.
- **M1.5-G** — ajuste de potencia/alcance del ventilador (25/50/75/100 % del tier, 1…máx de alcance comprado, atajos B/N, panel con ✓/✗ por producto, cuentagotas/deshacer/serializado, ventana física para `fanMovesProduct`), delegación del panel de selección por eventos, salt en registro del ventilador, entrada trasera única compartida para recetas dobles, boca de la curadora visible, losa de canaleta despegada del suelo.

## En curso / pendiente

1. **M1.5-H — simulador de balance headless**: `pnpm sim:balance` con bots Perezosa y Completa, tabla tiempo/ingresos/cuerpos/bloqueos, salida CSV comparable.
2. **Pasada de balance** (ver `BALANCE.md`): sumideros de dinero, ritmo por edad, mejoras por ranuras, primera hora del juego.
3. **M1.5-E** — modelos y pulido visual (piezas → pub/perfil de época, partículas, audio).
4. **M2 — red**: autoridad del servidor, sin física en servidor.
   - Salas con código (máx. 4 jugadores), lista de jugadores con score en vivo, chat.
   - El servidor conoce el diseño de la parcela: recibe intenciones (colocar, demoler, mover, mejorar, ajustar ventilador, vender), mantiene la grilla y calcula la producción máxima posible con las tasas de /shared (recetas, buffers, silos, ventiladores), y rechaza entregas imposibles.
   - **El servidor NO simula física.**
   - Todas las tasas y constantes usadas por el servidor viven en `/shared`.
5. **M3 — cooperación**:
   - Comedero Comunitario con hitos y beneficios globales; visita de parcelas en solo lectura con snapshots (grilla + ajustes).
   - Eventos coop arbitrados por el servidor: cerdo dorado compartido (gana el primer clic y suma al Comedero), inspección corporativa global con tiempo límite, pedidos asignados por jugador.
6. **M4 — pulido y despliegue**.

## Regla general
Todas las tasas, recetas, capacidades, curvas y valores de juego (interfaz + servidor futuro) viven en `/shared`.
