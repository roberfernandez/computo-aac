# Integración del calendario oficial TMB — pendiente de revisión, sin merge

Rama: `desarrollo/calendario-oficial-tmb`, basada en `main`.
Supabase: `jftdmyntpxwsdbokxqfj`, tabla `public.calendario_oficial_tmb`.

## Análisis previo y cambio mínimo

En la versión respaldada, toda la lógica afectada vive en `app/page.tsx`:

- `containsRedDigit` (línea 974) clasificaba la tinta roja por umbrales RGB.
- `classifyAnnual` (1744) recortaba cada número, llamaba al detector y guardaba `officialHoliday` (1842).
- `makeDays` (399) y `normalizeDays` (410) añadían diez festivos de una lista fija.
- `calcDay` (629) examinaba `officialHoliday` del día siguiente; después decidía Non Stop por fechas fijas, víspera, sábado o viernes civil. El último sábado de octubre activaba el horario largo del 75%.
- `dominantStatus`, `annualBlockEvidence`, `annualCellEvidence` y `classifyMonthly` reconocen los colores personales; son independientes de la categoría operativa.
- `shiftFor`, las tablas de contratos/subturnos y los contadores de nómina determinan los valores existentes. No se han cambiado sus tablas ni sus fórmulas.

Ahora `lib/official-calendar.ts` carga y valida un año completo con una única petición GET y clave **publishable**. Las peticiones concurrentes comparten una promesa; los años válidos permanecen en memoria durante la sesión. No se consulta por casilla ni se guardan categorías oficiales en el calendario personal. No se ha accedido a ninguna clave privilegiada.

`calcDay` obtiene directamente `categoria_codigo` por fecha. Se eliminan detector rojo, listas de festivos/Non Stop y deducción de víspera a partir del día siguiente. La antigua casilla de festivo editable se sustituye por la categoría oficial de solo lectura. Las modificaciones personales explícitas de jornada continúan disponibles y se identifican como manuales, sin cambiar la categoría oficial.

La carga también se realiza al abrir un calendario guardado. Los indicadores rojos antiguos quedan inactivos. Si existe trabajo guardado que compensa el año anterior, se carga también el año de origen de ese trabajo. Las respuestas tardías de un año abandonado no actualizan el estado del año visible.

## Tratamiento explícito de los 16 códigos

| Código | Regla de jornada existente utilizada |
|---|---|
| DISSABTE | Sábado |
| DISSABTE_CANVI_HORA | Sábado; conserva la marca oficial de cambio de hora |
| DIUMENGE | Normal con perfil de domingo |
| DIUMENGE_CANVI_HORA | Normal con perfil de domingo; conserva la marca oficial |
| DIVENDRES | Viernes/víspera |
| DIVENDRES_NO_LECTIU | Viernes/víspera; no existe un horario no lectivo distinto en la aplicación anterior |
| DIVENDRES_NO_LECTIU_FINS_23H | Regla existente de Nochebuena |
| DIVENDRES_VIG_FESTIU | Viernes/víspera directamente, sin consultar si mañana es festivo |
| DIVENDRES_VIG_FESTIU_NO_LECTIU | Viernes/víspera directamente |
| FEINER | Normal laborable |
| FEINER_NO_LECTIU | Normal laborable; conserva categoría distinta |
| FEINER_NO_LECTIU_FINS_23H | Regla existente de Nochebuena |
| FEINER_FINS_23H | Regla existente de Nochebuena |
| FESTIU | Normal con perfil de festivo/domingo |
| FESTIU_ESPECIAL | Festivo especial operativo, con horario viernes/víspera |
| VIGILIA_NON_STOP | Non Stop directamente |

Los códigos siguen siendo diferentes aunque compartan horario. T4 y T5 mantienen su horario fijo; T1/T2 mantienen la advertencia de horario histórico en sábados/Non Stop. Los conceptos retributivos no se reinterpretan como categorías operativas: Plus Festiu continúa contando domingos civiles, y los días especiales retributivos mantienen sus reglas previas.

Dos detalles para revisar antes del merge:

1. Las tres categorías `FINS_23H` de estos archivos son Nochebuena. Se conserva la regla anterior de T8: salida **23:50**, jornada normal abonada. No se ha introducido una nueva fórmula de abono o una salida a las 23:00. T4/T5 siguen fijos.
2. El sábado largo de octubre para el 75% utiliza la marca oficial `DIUMENGE_CANVI_HORA` del domingo siguiente, exclusivamente para localizar el cambio de hora, no para deducir vísperas. En 2026 corresponde al **24/10**, no al 31/10 que produciría el antiguo «último sábado de octubre». Se mantienen los horarios del sábado largo ya existentes. No se añade una corrección de minutos por el cambio de hora de primavera, que tampoco existía antes.

## Categorías no disponibles y errores

- `2025-03-31` y `2025-06-30` conservan `NULL`. No se sustituyen por FEINER ni por el día de la semana.
- Jornada que necesita categoría ausente: muestra **Pendiente**, sin horas/saldo calculados; se propaga al total semanal, mensual y anual afectado. No se convierte a cero ni se suma un total parcial como completo.
- Un descanso/ausencia personal que ya computaba cero conserva cero: no requiere determinar un horario de trabajo. El aviso de categoría ausente sigue visible.
- Error HTTP, conexión, timeout de 12 segundos, año incompleto, duplicado, fecha inválida o código desconocido: no se acepta ese año en memoria. Aviso visible y botón de reintento. No se utiliza el rojo ni las listas antiguas como fallback.
- El reconocimiento de colores y la edición personal siguen disponibles. Una carga válida ya disponible en memoria se reutiliza durante la sesión. Al recargar la aplicación se consulta de nuevo; no hay una copia persistente silenciosa.
- Años sin datos oficiales, incluidos actualmente 2020–2023 y 2027, quedan pendientes en sus jornadas dependientes del calendario; se conservan sus datos personales y referencias teóricas de contrato.

## Archivos

- `app/page.tsx`: conexión al calendario, selección de jornada, indicadores y estados pendientes.
- `lib/official-calendar.ts`: cliente público, validación, caché anual y mapa de categorías.
- `tests/official-calendar.test.mjs`: nueve pruebas nuevas.
- `tests/helpers/calendar-context.mjs`: entorno de prueba con carga anual explícita.
- `tests/fixtures/official-calendar.json`: las 1.096 fechas/códigos ya auditados de los Excel; solo fixture de pruebas, no fallback de producción.
- `tests/payroll-summary.test.mjs` y `tests/turn-profiles.test.mjs`: cargar esa fuente explícita al probar los helpers; se conservan todas las aserciones existentes.
- Este documento.

## Validación

- API real con el cliente y la clave publishable: **366 + 365 + 365**, los 1.096 códigos idénticos al fixture auditado.
- Nueve pruebas nuevas: 16 códigos/1.096 fechas; horarios esperados; fechas especiales de los tres años; independencia de número rojo y mañana festivo; NULL/años ausentes y propagación de pendientes; cambio de hora oficial; colores/ciclo intactos; petición anual compartida/caché; errores y respuesta inválida/reintento.
- Diez helpers de colores, geometría y ciclo comparados byte a byte con el respaldo. Además se ejecutan muestras RGB de las distintas situaciones personales y se comparan sus resultados.
- Catorce fechas especiales con horarios explícitos esperados en 2024/2025/2026, incluidos Non Stop, festivo especial, víspera, sábado y Nochebuena. Los sábados largos se comprueban para los cinco subturnos del 75% en los tres años.
- Build pública: correcto. Build de la integración aplicada a una copia separada de privada: correcto.
- Suite completa en cada variante: **24 pruebas; 22 pasan, 2 fallan**. Las dos incidencias ya estaban en el respaldo: metadato `codex-preview=development` y CSS `scrollbar-width: thin`. No se ocultan ni se cambian pruebas ajenas a esta fase. Las nueve pruebas nuevas y las diez de negocio existentes pasan.
- TypeScript mantiene los cinco errores previos (manifest `any maskable`, inferencia `baseStatus`, módulo `cloudflare:workers`, tipos `Fetcher` y `D1Database`); no aparecen errores nuevos del calendario.
- Navegador local: carga correcta de 2026, aviso de los dos NULL en 2025 y aviso seguro al solicitar 2027 sin calendario. Perfil ficticio en un puerto local independiente, sin datos personales reales.

## Variantes y alcance

Se comprobó que el parche se aplica sin conflictos sobre una copia separada y sin rama de `privada`. La única diferencia en `app/page.tsx` sigue siendo `Globe2/Pública` frente a `LockKeyhole/Privado`. Los otros cuatro archivos distintos (`.openai/hosting.json`, `app/layout.tsx`, `package.json`, `package-lock.json`) se conservan exactamente.

No hay merge ni despliegue. `main` permanece en `b345830947778183530abcff5b38975d9eb816e2`; `privada`, en `ace3f65f84c8b03a8d52590e0797ae115a6b15d5`. No se ha modificado Supabase, sus datos ni RLS durante esta fase. No se ha tocado `incidencias-l4`.
