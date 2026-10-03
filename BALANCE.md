# Notas de balance

## Estrategias que se saltan los circuitos
- Sembrador apuntando hacia afuera + un ventilador hasta el portal avanza todas las edades.
- Venta por clic y "vender todo lo del suelo": no deben valer lo mismo que entregar por el portal ni recibir multiplicadores.
- Ventilador a 100 % de potencia: fanMovesProduct no limita por masa, así que cualquier tier mueve cualquier producto. La regla "los pesados necesitan tiers altos" solo se aplica al bajar la potencia.

## Economía
- Curvas de costo (base 1.15^n; velocidad x1.8 vs probabilidad x1.5), ingreso pasivo vs manual.
- Valor por producto, cantidades y tiempos de recetas, multiplicador global de la jamonera, tope del combo.
- Sin sumideros de dinero en la edad final ($158K acumulados con todas las ranuras usadas). Evaluar: más ranuras o niveles, expansión de parcela comprable, aportes al Comedero Comunitario.
- Reembolso al demoler (100 % en Barro, 75 % después).
- Rendimiento decreciente del maíz al subir de edad.

## Progresión
- Requisitos de entrega para subir de edad (Madera: X maíz + dinero; Piedra: Y calabazas o palomitas; Fábrica: Z cerdos). Constantes en /shared.
- Tope de nivel por línea de mejora según la edad.
- Definir ritmo objetivo por edad con el simulador.

## Inicio de partida
- Dinero inicial ($50), tamaño de la zona inicial y costo de las primeras canaletas: verificar que el primer circuito se arma en el primer minuto sin quedarse sin plata.
- Revisar el ritmo de los primeros 3 minutos (Barro) con el simulador y con una partida real.

## Inspiración de otros incrementales y juegos de fábricas (a evaluar, no implementar todavía)
- Objetivo actual visible con barra de progreso (metas de entrega por producto para subir de edad).
- Eventos dorados ocasionales (cerdo dorado, inspector corporativo) con bonus temporal por clic.
- Logros con bonus pequeño de valor.
- Cada edad introduce una mecánica nueva, no solo números más grandes.
- Revelación progresiva de la interfaz: ocultar categorías y mejoras aún irrelevantes.
- Prestigio ligero ("Mudarse a una granja nueva"): opcional, para después.
- Pedidos corporativos con tiempo y bonus.
- Filtro/clasificadora de productos (resuelve las líneas mezcladas).
- Selección por área con copiar, pegar y mover; modo de colocación en rectángulo.
- Investigación como alternativa o complemento de las edades.

## Caminos, rampas y niveles
- Fricción de cada tier de canaleta y canaleta rebote: revisar cuáles no tienen sentido.
- Rampa: pendiente, costo y momentum; dar un motivo para usar niveles (portal en otro nivel o detrás de paredes, obstáculos).
- Ventilador: decaimiento de la fuerza con la distancia y alcance corto en los primeros tiers.
- Constantes de emisión (EMIT_IMPULSE) y MAX_PRODUCT_SPEED.

## Procesadores y flujo
- Capacidades de buffer y mejora de capacidad; silo (capacidad 10, +4 por nivel, intervalo 1.2 s); tope de cuerpos.
- Riesgo: con la entrada trasera compartida de las recetas dobles, una línea mezclada puede trabarse por cabeza de fila. Medir con el simulador.

## Diversión (a explorar tras jugar 15 min desde cero)
- Pedidos corporativos con tiempo y bonus (metas compartidas en el modo coop).
- Obstáculos en la parcela que impidan líneas rectas.
- Eventos o sorpresas ocasionales.

## Sistema de mejoras (a rediseñar)
- Hoy: 2 ranuras por edad (8 en total) repartidas entre ~20 líneas; no alcanzan y las líneas de baja prioridad (p. ej. capacidad de buffer) nunca se compran.
- Opciones: (a) ranuras propias por tipo de estructura, 2 por edad, mostradas en el panel de la unidad (recomendada); (b) tope de nivel por línea según la edad, con el dinero como freno; (c) más ranuras globales.
- Más mejoras aceleran la economía: rebalancear junto con los costos y medir con el simulador.

## Buffers
- La capacidad base debería subir con el tier de la máquina (al mejorarla), y la línea de capacidad quedar como extra, para no depender de una ranura.

## Ritmo de edades (objetivo inicial, a ajustar con el simulador)
- Demo completa de ~35-40 min: Barro 3-4 min, Madera 6-8, Piedra 8-10, Fábrica 10+ con sumideros de dinero.
- Hoy las edades se pasan demasiado rápido: subir de edad no debe resolverse solo con dinero (ver requisitos de entrega por producto).

## Registro J1 (primera pasada de balance, valores de arranque)
- `START_MONEY = 75`, `LIQUIDATION_RATE = 0.10`, `AUTO_LIQUIDATE_RATE = 0`, `AUTO_LIQUIDATE_SECONDS = 90`, `BULK_LIQUIDATION_COOLDOWN_MS = 30000`, `COMBO_LIQUIDATION_PENALTY = 0.25`.
- Costes de edad: Madera 800, Piedra 5500, Fábrica 28000.
- Objetivos de entrega por edad (solo cuentan entregas al portal): Madera 30 maíz + 20 calabaza + 20 palomita; Piedra 15 cerdos + 10 pienso.
- TOSS (`tossPig`) quedó como código muerto: se elimina junto con su referencia en smokes.

## Registro J1c (tope de combo por edad)
- `COMBO_MAX_BY_AGE = [2, 3, 4, 5]` (Barro, Madera, Piedra, Fábrica). El paso (0.1) y la ventana (3 s) no cambian; la mejora "ventana de combo" del portal sigue funcionando igual.
- Si se cambian estos topes, los costos de edad hay que recalibrar con la partida real (la penalidad de liquidación queda igual).
- El indicador muestra actual / máximo (`COMBO x1.4 / máx x2`) y el panel de Edad anuncia el valor de la próxima.

## Mejoras generales (a evaluar en el refinado, después de la partida de prueba)
- Mejora general de aguante del combo: más tiempo de ventana antes de apagarse, no atada a una estructura (hoy existe como línea del portal).

## Reglas de calibración
- Nueva fórmula: `costo_nuevo = costo_actual × (tiempo objetivo ÷ tiempo medido en partida real)`.
- Los bots del simulador (runBalance) sirven solo como regresión física y detección de bloqueos, no para calibrar los valores de la economía.
- Agujero de entregas que crece con metas progresivas (estilo Project Pitt): descartado por ahora.

## Herramienta
- Simulador headless (ver M1.5-H / H2 / H3 / H4).
