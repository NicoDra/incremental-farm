# Interfaz de Chanchos S.A.

## Objetivo de esta rama

Prioridad PC con ratón y teclado. La parcela es el espacio principal de juego.
El ciclo que comunica la interfaz es producir, transportar, entregar, cobrar,
invertir y avanzar de época. No se cambian precios, recetas ni límites de mejora.

## Organización

- Barra superior: dinero, época, combo y progreso hacia la siguiente época.
- Un panel derecho para Construir, Mejoras globales, Progreso e inspección.
  Inspeccionar una pieza sustituye el contenido, no abre un segundo panel.
- Catálogo con tarjetas uniformes: icono, nombre, precio y atajo. Categoría,
  búsqueda y opción de ver bloqueadas se conservan al cambiar de vista.
- Altura y rotación se agrupan con las herramientas de construcción.
- Menú general: liquidar productos, direcciones y reiniciar. Sin duplicados.
- Ayuda bajo demanda y recordatorios contextuales breves en lugar de una lista
  permanente de todos los atajos. No se abre automáticamente un modal al iniciar.

## Alcance de las acciones

- **Esta pieza:** pausa, potencia, alcance, actualización de material/tier,
  mover y demoler. El reembolso se muestra antes de demoler.
- **Mejoras globales:** se aplican a todas las máquinas de su tipo, también a
  nuevas construcciones. Consumen ranuras compartidas por la granja.
- **Progreso:** dinero y entregas al granero exigidos simultáneamente. El desfase
  económico 198/30 sigue pendiente en BALANCE.md; limitar un contador no lo arregla.
- Liquidar productos sueltos no equivale a entregar ni a vender una construcción.

## Interacción

Conservar R, F, H, G, E, X, M, B, N, I, 1–9/0 y Ctrl+Z/Ctrl+Y. Ratón y botones
invocan las mismas acciones. Los atajos de juego no actúan al escribir ni cuando
se navega por controles con el teclado. Escape cierra primero ayuda/menú, luego
cancela la operación o selección y finalmente cierra el panel.

Los paneles conservan su desplazamiento. Las actualizaciones de dinero y buffers
no deben reemplazar un botón que tiene foco ni interrumpir un clic.

## Dirección visual

Conservar crema, tinta, verde, oro y rosa de la identidad existente. Botones
rectangulares compactos, contraste alto, tipografía legible y cifras tabulares.
Iconos SVG existentes, etiquetas visibles y foco de teclado. No se añade un
framework ni una dependencia de interfaz.

## Verificación

Probar construcción, selección, compras, actualización de pieza, pausa, ajustes,
liquidación, cancelación, deshacer/rehacer y cambios de época. Probar pantallas
PC de 1280×720 y 1920×1080, más una adaptación estrecha funcional. Sin capturas,
según preferencia del usuario. La suite `pnpm test:all` debe terminar en PASS.
