# Conciliación personal de Roberto: marzo y julio de 2026

Perfil: T8, contrato 85,81%, letra M. Cálculos ejecutados con las funciones existentes de ambas variantes. No se vuelve a analizar la imagen ni se modifican geometría, umbrales, reglas, categorías o Supabase.

## Fuentes y alcance

La fuente de las excepciones personales es la confirmación expresa de Roberto en la solicitud de esta conciliación: permiso 02/03, huelga 8M 08/03, vacaciones de año anterior 16–18/03 y modificación de +1 hora 20/07. La búsqueda en documentación del proyecto, respaldo inicial y archivos de resultados no aportó otra fuente para resolver 23–24/03. No se atribuye a esos días una situación inventada.

Las reglas de aplicación ya están implementadas en app/page.tsx: `isWorking` y el retorno de cero de `calcDay` para situaciones no trabajadas; `FIXED_PROFILES["85.81"].NORMAL.value = -0.64`; y `value += d.extraHours` para MODIFICACION. Los estados PERMISO, HUELGA_LEGAL y VAC_ANTERIOR ya existen. El origen VACACIONES distingue las vacaciones del año anterior sin convertirlas en trabajo destinado a COMPUTO_ANTERIOR.

Los ajustes de usuario se guardan en localStorage (`metro-year-2026`), no en el código versionado. Esta tarea crea un fixture personal de conciliación y pruebas, sin escribir en perfiles del navegador ni introducir excepciones automáticas en la aplicación. No se afirma haber recuperado ajustes de almacenamiento de un navegador no inspeccionado.

## Fechas afectadas

«Base» es la aportación actual derivada de la situación reconocida, antes de aplicar la excepción. El cero de REVISAR es provisional según el comportamiento existente, no una validación de la jornada.

| Fecha | Situación de imagen | categoria_codigo | Base | Excepción personal | Final | Fuente |
|---|---|---|---:|---|---:|---|
| 02/03/2026 | AGCG | FEINER | −0,64 | PERMISO | 0 | Roberto: permiso; calcDay existente |
| 08/03/2026 | FEST | DIUMENGE | 0 | HUELGA_LEGAL (8M) | 0 | Roberto: huelga; calcDay existente |
| 16/03/2026 | VACACIONES_PENDIENTES | FEINER | 0 | VAC_ANTERIOR, origen VACACIONES | 0 | Roberto: vacaciones del año anterior; calcDay existente |
| 17/03/2026 | VACACIONES_PENDIENTES | FEINER | 0 | VAC_ANTERIOR, origen VACACIONES | 0 | Misma confirmación y regla |
| 18/03/2026 | VACACIONES_PENDIENTES | FEINER | 0 | VAC_ANTERIOR, origen VACACIONES | 0 | Misma confirmación y regla |
| 23/03/2026 | REVISAR (azul) | FEINER | 0 provisional | NO RESUELTA: ninguna aplicada | 0 provisional | Sin fuente que identifique la situación |
| 24/03/2026 | REVISAR (azul) | FEINER | 0 provisional | NO RESUELTA: ninguna aplicada | 0 provisional | Sin fuente que identifique la situación |
| 20/07/2026 | REVISAR (azul) | FEINER | 0 provisional | Jornada AGCG + MODIFICACION, extraHours=1 | +0,36 | Roberto: modificación de +1 hora; tarifa y suma existentes |

## Causas exactas de los descuadres

**Marzo:** el 02/03 aparecía como trabajo ordinario −0,64. El permiso confirmado aporta 0, una variación de +0,64: −1,30 + 0,64 = −0,66. Huelga y vacaciones anteriores cambian la identificación personal pero no la aportación al saldo de marzo. No se calcula aquí una liquidación salarial de la huelga ni el saldo pendiente de vacaciones de otro año.

**Julio:** el 20/07 azul aportaba 0 por estar en REVISAR. Una jornada normal FEINER aporta −0,64; con la hora adicional confirmada pasa a −0,64 + 1 = +0,36. Frente al cero de la lectura, el cambio es +0,36: −0,58 + 0,36 = −0,22. Añadir extraHours=1 sin confirmar una situación trabajada seguiría devolviendo 0 porque calcDay sale antes para REVISAR. La modificación documentada justifica confirmar AGCG en esta fecha concreta; no se convierte ningún otro azul en trabajo.

La ubicación de la hora adicional al principio o al final no está documentada. Para esta conciliación de saldo no hace falta decidirla: el código suma +1 en ambos casos. El fixture deja la ubicación por defecto de makeDays; no se certifican aquí horas exactas de entrada/salida ni otros conceptos de nómina.

## Resultado en ambas variantes

| Mes | Confirmado | Antes | Con excepciones personales | Resultado |
|---|---:|---:|---:|---|
| Enero | +3,34 | +3,34 | +3,34 | PASS |
| Febrero | −1,30 | −1,30 | −1,30 | PASS |
| Marzo | −0,66 | −1,30 | −0,66 | PASS |
| Abril | +1,42 | +1,42 | +1,42 | PASS |
| Mayo | +1,34 | +1,34 | +1,34 | PASS |
| Junio | −1,89 | −1,89 | −1,89 | PASS |
| Julio | −0,22 | −0,58 | −0,22 | PASS |

Las cuatro pruebas específicas pasan en cada variante: explicación del 20/07, explicación del 02/03, conservación de excepciones y casos no resueltos, y siete totales mensuales. No se repiten build ni suite visual: no cambia código funcional.

La coincidencia de totales no resuelve automáticamente 23–24/03 ni los otros azules existentes en junio. Se conservan sus marcas de revisión.

Archivos añadidos: este informe, tests/personal-history.test.mjs y tests/fixtures/roberto-personal-2026.json. Sin merge ni despliegue.
