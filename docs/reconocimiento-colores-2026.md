# Corrección del reconocimiento personal (sin cambios laborales)

## Causa y alcance

El formato antiguo es 6 columnas por 2 filas; el nuevo, 4 por 3. El anterior fallback deformaba la captura nueva a una plantilla 6×2. Las 365 fechas se generaban por calendario, no demostraban que las coordenadas fueran correctas. Las muestras equivocadas de 03/01 y 04/01 eran RGB(192,192,192), aceptado por la condición rosa anterior. La eliminación del detector de números rojos no había modificado las coordenadas.

Solo cambia el reconocimiento visual en app/page.tsx. Detector versión 2: conserva las previsiones guardadas y utiliza el aviso existente para recomendar releer la imagen. No cambian cálculos, ciclo, contratos, categorías oficiales, cliente Supabase ni la regla de Nochebuena.

## Geometría y color

- 4×3: localiza componentes rectangulares del fondo, excluyendo blancos y letras oscuras. Se elimina una franja de un píxel para separar pequeños puentes de compresión. Se exigen tamaños y proporciones de casilla, 28 columnas y tres grupos de filas. Se verifica un rectángulo en la posición de cada fecha, incluyendo años bisiestos; no basta un recuento de componentes.
- 6×2: conserva la localización mediante seis cabeceras en dos filas. La altura de cada fila se obtiene del borde inferior real del mes y su número de semanas; elimina el desplazamiento acumulado que afectaba a agosto.
- No se acepta una plantilla nominal 6×2 sin detectar sus paneles. Si tampoco se detectan después de la rectificación existente, se devuelve el error visible de captura no localizable, sin guardar una previsión inventada.
- Muestreo: dos franjas interiores, centradas al ±30% del ancho respecto al centro, de 18% del ancho × 50% del alto. Excluyen el centro del número y mantienen margen frente a bordes. Se mantiene la votación de píxeles RGB y la comprobación de acuerdo entre regiones. No se sustituye por un píxel aislado.
- Único cambio en umbrales de clasificación: a las condiciones rosa existentes se añaden `r - g > 30` y `b - g > 30`, tanto en el detector anual como en el mensual. Un gris neutro nunca cumple esas diferencias. No se ajustan los otros colores.

## Muestras reales conservadas

Valores RGB medianos de regiones interiores, antes de modificar la clasificación:

| Fondo / fecha | Antigua | Nueva | Situación |
|---|---|---|---|
| Claro/gris 01/01 | 255,253,253 | 192,192,192 | AGCG |
| Turquesa 03/01 | 60,202,209 | 50,202,213 | DCOM |
| Naranja 04/01 | 219,149,116 | 220,147,112 | FEST |
| Verde suave 19/02 | 148,188,150 | 142,188,142 | REVISION_MEDICA |
| Marrón 16/03 | 144,111,54 | 141,107,36 | VACACIONES_PENDIENTES |
| Azul 23/03 | 7,5,240 | 1,1,252 | REVISAR |
| Rosa 06/05 | 254,156,253 | 255,153,255 | FORMACION |
| Amarillo/naranja 15/06 | 251,158,68 | 255,153,52 | LAUDO |

Hay 26 muestras reales de ambas capturas. El verde intenso ENFERMEDAD no aparece en estos dos calendarios: se conserva su clasificación y se prueba con una muestra sintética RGB(80,190,80), sin presentarla como muestra real.

Los fixtures contienen los píxeles decodificados de los dos JPEG, comprimidos sin pérdida, y sus dimensiones y hashes de origen. Las pruebas ejecutan las funciones reales de la aplicación en Node con un adaptador mínimo de Canvas. También se ejecutó el detector completo con Canvas nativo sobre ambos JPEG. No se ha realizado una nueva prueba de subida mediante interfaz de navegador en esta fase.

## Resultado de las dos imágenes

Las 365 situaciones coinciden fecha por fecha entre ambas imágenes. 03/01 = DCOM; 04/01 = FEST. Gris RGB(192,192,192) = AGCG. Cambiar la tinta central de negro a rojo no cambia la clasificación de las muestras probadas.

| Situación | Casillas |
|---|---:|
| AGCG | 202 |
| DCOM | 66 |
| FEST | 58 |
| VACACIONES_PENDIENTES | 24 |
| REVISAR (azul) | 10 |
| FORMACION | 3 |
| REVISION_MEDICA | 1 |
| LAUDO | 1 |
| Total | 365 |

El contador existente señala 22 avisos respecto al ciclo (incluye los azules pendientes); anteriormente la captura nueva daba 133. Los avisos son: enero 1,3,4,7,8; marzo 16,17,23,24; mayo 25; junio 16,19,20,21,22,23,24; julio 20; septiembre 24; octubre 12; diciembre 8,25.

## Comparación mensual: T8, 85,81%, letra M

| Mes | Confirmado | Obtenido en ambas imágenes/variantes | Diferencia | Comparación |
|---|---:|---:|---:|---|
| Enero | +3,34 | +3,34 | 0 | PASS |
| Febrero | −1,30 | −1,30 | 0 | PASS |
| Marzo | −0,66 | −1,30 | −0,64 | FAIL pendiente de conciliación |
| Abril | +1,42 | +1,42 | 0 | PASS |
| Mayo | +1,34 | +1,34 | 0 | PASS |
| Junio | −1,89 | −1,89 | 0 | PASS |
| Julio | −0,22 | −0,58 | −0,36 | FAIL pendiente de conciliación |

No se han cambiado reglas ni colores para hacer coincidir marzo y julio. Fechas concretas pendientes de interpretación personal: 16,17,18 de marzo (marrón, vacaciones sin año indicado), 23 y 24 de marzo (azul, REVISAR), y 20 de julio (azul, REVISAR). Todas aportan actualmente 0 al saldo según la lógica existente. No se puede afirmar que sean las responsables exactas de −0,64/−0,36: los totales confirmados no incluyen su desglose diario ni modificaciones históricas. Atribuirles una compensación sería inventarla. El archivo revision-marzo-julio-2026.csv contiene las 62 fechas con situación, categoría y aportación actual para su conciliación. La coincidencia de junio tampoco resuelve sus siete días azules.

## Verificación de las dos variantes

- 7 pruebas nuevas de reconocimiento: PASS en ambas.
- Suite completa: 35 pruebas, 33 PASS y 2 fallos preexistentes en metadatos de preview y CSS scrollbar-width.
- Build: PASS en ambas.
- TypeScript: los mismos 5 errores previos (manifest, baseStatus, cloudflare:workers, Fetcher y D1Database), ninguno nuevo.
- Prueba estructural: todas las funciones no visuales previas permanecen idénticas al código integrado.
- Se conservan las cinco diferencias entre pública y privada: .openai/hosting.json, app/layout.tsx, app/page.tsx, package.json y package-lock.json.

No hay merge ni despliegue. La corrección visual está validada con ambas capturas; la conciliación histórica de marzo y julio queda abierta.
