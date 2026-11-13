# Informe de corrección de privacidad — 13 de noviembre de 2026

## Estado

**Exposición retirada de la versión actual de `main` y del despliegue Pages comprobado. Incidencia histórica todavía abierta.** Este informe no reproduce identificadores de cuenta, información individual ni valores de las correcciones privadas.

Corrección: [`9b8ff0135fa5079b703be15c8ede93802029ab8c`](https://github.com/roberfernandez/computo-aac/commit/9b8ff0135fa5079b703be15c8ede93802029ab8c).
Despliegue: [ejecución 43468755137](https://github.com/roberfernandez/computo-aac/actions/runs/43468755137), finalizada correctamente.
Base auditada: `6fa5051e63ead79c92cc4b5fe69c7bfe5723c988`.

## Cambios

| Archivos | Corrección |
| --- | --- |
| `lib/confirmed-pilot.js` | Retirado del árbol actual; contenía un identificador fijo y correcciones individuales. |
| `lib/private-corrections.js` (nuevo) | Motor genérico de reglas, sin valores individuales, sin evaluación de código y con lista de campos permitidos. Mantiene la base IndexedDB, claves de migración y respaldos existentes. |
| `app/private-corrections.ts` (nuevo), `app/page.tsx` | Recuperación autenticada de las reglas privadas mediante RLS. Comprobación de sesión, respaldo previo y sincronización del resultado. Sin reglas privadas precargadas en el paquete público. |
| `app/computo-sync.ts` | Excluye los registros `private-*` de la descarga general; las reglas sólo se consultan por el flujo autorizado. |
| `app/sap-review-panel.tsx`, `public/sap-return/storage.mjs`, `public/sap-return/receiver.mjs` | Eliminados identificadores fijos. Identidad y permiso proceden de la respuesta autenticada del servidor. El retorno queda asociado a la cuenta validada y al nonce pendiente. |
| `supabase/functions/sap-admin-ticket/core.mjs` | Permiso basado exclusivamente en `app_metadata.computo_sap_admin`, administrado en servidor. No confía en `user_metadata`. Mantiene firma, caducidad y callback restringido de los tiquets. |
| `experiments/sap-admin/android/assets/probe.js`, `experiments/sap-admin/android/src/cat/tmbagent/sapwebviewprobe/ProbeActivity.java` | Retirado el identificador fijo del código fuente. El puente conserva la verificación remota del tiquet y la comprobación de identidad de las filas SAP. |
| `tests/private-corrections.test.mjs` (nuevo), `tests/confirmed-corrections.test.mjs`, `tests/sap-admin-ticket.test.mjs`, `experiments/sap-admin/android/tests/probe.test.mjs` | Pruebas sintéticas de aislamiento, idempotencia, reglas, autorización y compatibilidad. Eliminadas las dependencias de la identidad real. |
| `.github/workflows/validate-pr.yml` | Incorpora las nuevas pruebas de reglas privadas. |
| `experiments/sap-admin/RESULTAT.md` | Documentación adaptada al almacenamiento privado; retiradas referencias a resultados individuales de la prueba. |

Las descripciones actuales de las PR #46, #47 y #48 se sustituyeron por resúmenes genéricos. Se verificó que no tenían comentarios. **Sus diffs y las versiones históricas no se han purgado.**

## Conservación y almacenamiento privado

- Se creó una copia privada de los **47 registros sincronizados** existentes antes de modificar la implementación. Conserva clave, contenido y fecha de cada registro, incluidas las marcas de borrado.
- Comparación posterior: **47 registros presentes y todos sus contenidos iguales a la copia**. No se sustituyeron calendarios, saldos ni exportaciones sincronizadas durante la intervención.
- Las reglas individuales se trasladaron a un registro `private-corrections-v1` de `computo_sync`, protegido por las políticas RLS existentes: propietario autenticado y acceso aprobado. No se añadió una política amplia ni acceso anónimo.
- El respaldo adicional usa `private-restore-20261113-before-remediation`, fuera de las claves que la aplicación sincroniza o elimina normalmente.
- Las copias locales de IndexedDB y las claves de migración anteriores se mantienen. No se borraron datos del sitio, cachés de almacenamiento de usuario ni puntos de restauración Git.
- La autorización administrativa se añadió a los metadatos controlados por servidor de una sola cuenta. La función `sap-admin-ticket` quedó desplegada en versión 2. No se cambiaron credenciales ni se ampliaron permisos a otros usuarios.
- No se reescribió el historial Git. La copia local de trabajo no se considera por sí sola una garantía de recuperación duradera para una futura reescritura.

## Comprobaciones realizadas

| Comprobación | Resultado |
| --- | --- |
| RLS con rol anónimo | Acceso denegado a `computo_sync`. |
| RLS con otra cuenta, incluida otra cuenta aprobada | Cero registros visibles de la cuenta protegida. |
| RLS con la cuenta propietaria | Acceso a sus dos nuevos registros privados. |
| Conservación de datos sincronizados | 47/47 contenidos sin cambios. |
| Equivalencia entre reglas anteriores y privadas | 1.152 planes sintéticos equivalentes, variando estados y campos relevantes. No es una demostración exhaustiva de todas las entradas posibles. |
| Pruebas focalizadas | 32 pasan, ninguna falla. |
| Regresión de sincronización, compensaciones y comparación | 18 pasan, ninguna falla. |
| Respaldo de migración | Prueba con emulación IndexedDB: copia exacta, marca aplicada, idempotencia, respeto a restauración y fallo de escritura por cuota. |
| Batería completa | 134 pasan, 11 fallan, 1 omitida. Una copia independiente de la base reproduce los mismos 11 fallos: 132 pasan y 1 omitida. Parte de esos fallos depende de artefactos antiguos `dist` ausentes; no se presenta esta batería como completamente verde. |
| Lint de archivos de aplicación revisados | Cero errores; 25 avisos existentes. |
| Compilación estática | Correcta. La configuración previa omite comprobación global de tipos; no equivale a un TypeScript global sin errores. |
| Escaneo de fuente actual y salida local | Sin coincidencias del identificador expuesto. |
| Despliegue Pages | Finalizado con éxito para el commit de corrección. |
| Página publicada | HTTP 200. |
| Siete paquetes JavaScript y dos módulos de retorno publicados | HTTP 200, sin coincidencias del identificador expuesto. |
| URL del antiguo paquete principal expuesto | HTTP 404 tras el despliegue. |
| Prueba visual autenticada | Pendiente: el navegador conectado no concedió acceso al origen. Chromium local tampoco pudo iniciarse por restricciones del entorno. No se afirma haber validado una sesión real ni una nueva extracción SAP. |

El asesor de seguridad de Supabase no señaló una incidencia nueva específica de `computo_sync`. Sí devolvió avisos generales preexistentes sobre otras funciones, políticas y protección de contraseñas; no se modificaron sistemas ajenos a esta corrección.

## Alcance histórico y riesgos residuales

1. **Historial Git y referencias de PR.** La introducción del archivo individual está en `360afba7f40fc92476719fd8cab781c665a08bff`; las revisiones posteriores relevantes son `d589eb373b4bee24b701e660dd77e5b89641a5c9` y `366b7a9c2d0e5a905cf330d4e1f17aab3e2794bb`. Se localizaron referencias al identificador en código anterior a esas PR y en ramas históricas, incluida una rama de restauración. Un commit corrector no elimina esos objetos ni sus diffs.
2. **Artefactos de Actions.** Se inspeccionó el ZIP del último despliegue anterior: contenía el identificador tanto en el paquete principal como en `sap-return/storage.mjs`. Los siguientes artefactos anteriores seguían disponibles al auditarse:

| Ejecución | Artefacto |
| --- | --- |
| 43446963545 | 14049230388 |
| 43445314645 | 14047956799 |
| 43444416677 | 14046602664 |
| 43437707263 | 14044460588 |
| 43434787376 | 14043561005 |

La conexión de GitHub no expone borrado de artefactos y el CLI no dispone de autenticación. Se intentó la retirada del primero mediante la interfaz autenticada, pero el navegador dejó de responder y la consulta posterior confirmó que seguía disponible. **No se declara eliminado ninguno.** La lista anterior no es un inventario exhaustivo de todos los artefactos anteriores a estas ejecuciones.

3. **Cachés.** Pages devolvió `Cache-Control: max-age=600`. El antiguo paquete probado ya no está servido por su URL, pero pueden existir respuestas en caché, pestañas abiertas, clones, descargas o copias de terceros. No se puede demostrar su eliminación global desde aquí. No se encontró un service worker propio en este repositorio; otros componentes del lanzador no se auditaron.
4. **APK distribuida.** Se corrigió el código fuente del puente, pero no se compiló, firmó ni distribuyó una APK sustitutiva en esta intervención. Las APK anteriores pueden conservar el identificador fijo. El cambio de servidor mantiene el formato del tiquet para conservar compatibilidad; la comprobación real en dispositivo sigue pendiente.
5. **Alcance.** La intervención se limitó a este repositorio, su despliegue, la función de autorización y los registros privados asociados. No constituye una auditoría completa de Nòmina, TMBAgent, todos los dispositivos ni todas las copias externas.

## Trabajo pendiente para cerrar la incidencia

- Retirar los artefactos históricos expuestos y revisar las ejecuciones anteriores, sus registros, otros despliegues y distribuciones de APK.
- Antes de reescribir Git, crear un respaldo **privado, duradero y con restauración verificada** de todas las referencias necesarias, y coordinar las copias de colaboradores. No restaurar posteriormente una rama antigua sobre producción sin volver a sanearla.
- Sanear las referencias afectadas y solicitar a GitHub la eliminación de vistas y referencias de PR, objetos o cachés que requieran soporte. No se ha enviado una solicitud a soporte ni ningún mensaje externo.
- Sustituir la APK distribuida y comprobar Còmput y el retorno SAP en una sesión real, conservando datos locales.
- No desarrollar nuevas funciones hasta resolver o delimitar expresamente estos pendientes.

Referencia sobre límites de retirada del historial y cachés: [documentación oficial de GitHub](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/removing-sensitive-data-from-a-repository).

## Preparación de APK sustitutiva 0.3.2

Se ha compilado un artefacto nuevo desde el código corregido, con versión 0.3.2 y código 7, conservando el certificado ya reconocido por el canal. La auditoría del APK empaquetado y sus comprobaciones están documentadas en [`releases/sap-bridge-0.3.2`](../releases/sap-bridge-0.3.2/README.md). No se ha instalado ni comprobado todavía esta versión en el móvil del usuario. Los recuentos de octubre y del año son referencias anteriores, no una nueva extracción validada.

Esta distribución sustitutiva **no cierra la incidencia histórica** ni acredita retirada del historial, artefactos o APK distribuidas anteriormente. Tampoco amplía el permiso administrativo a otros trabajadores ni cambia datos, cálculos, reglas privadas o copias de restauración existentes.
