# Revisión de migración a GitHub · 20/09/2026

## Alcance

Respaldo privado del código publicado de Cómputo AAC, con dos ramas completas. No se ha cambiado código de aplicación, dependencias, calendario, datos ni reglas de cálculo. No se ha añadido Supabase ni se ha desplegado nada como parte de esta tarea.

Las versiones de Sites consultadas son la privada 58 y la pública 14. Sus commits de origen se identifican en el README y en `inventario-origen.json`. No se importó el historial anterior: el repositorio comienza con una instantánea revisada de la versión actual.

## Integridad y estructura

- Recuperados los 111 archivos de cada commit publicado mediante exportación de Git, incluyendo archivos ocultos, lockfile, recursos OCR, iconos, componentes, scripts, pruebas, configuración, Worker y licencia de estilos.
- Comparación SHA-256 de todos los archivos con el origen. README y `.gitignore` originales conservados en `docs/origen/`; son los únicos archivos originales sustituidos por documentación y exclusiones de migración.
- Conservados los permisos ejecutables de los tres scripts de shell originales en el índice Git.
- Las ramas difieren únicamente en los cinco archivos propios de cada variante indicados en el README.
- Excluidos `node_modules`, construcciones, cachés, registros locales y datos ajenos al proyecto. No se incluyen las exportaciones sindicales ni los documentos personales del espacio de trabajo.

## Revisión de secretos antes de subir

- Gitleaks **8.30.1**, descargado de su distribución oficial y comprobado contra su suma SHA-256 publicada.
- Análisis de ambos árboles completos recuperados: **ningún secreto detectado**.
- Revisión adicional de nombres sensibles, claves privadas, asignaciones de contraseña/token, configuración npm, referencias al entorno y mecanismos de autenticación: no se han encontrado credenciales incrustadas. Las coincidencias de texto corresponden a documentación o a ajustes no secretos de herramientas.
- `.openai/hosting.json` contiene identificadores de proyecto y enlaces lógicos a recursos; no contiene claves o credenciales. Se conserva porque la construcción original lo importa.
- El `.gitignore` se amplía para excluir archivos de entorno, claves, almacenes de credenciales y archivos generados. Los ejemplos de entorno que se añadan en el futuro deben contener solo valores de ejemplo.
- Las credenciales necesarias para crear y subir el repositorio se gestionan fuera del árbol del proyecto y no se escriben en archivos, URLs remotas ni commits.

Un análisis sin hallazgos no garantiza que todo cambio futuro esté libre de secretos. El inventario y la revisión corresponden a esta instantánea.

## Instalación y comprobaciones

Entorno de comprobación: Windows, Node.js **24.19.0**, dependencias instaladas desde cero mediante `npm ci` usando el lockfile original. Las dos variantes tienen las mismas dependencias y versiones; solo difiere su nombre de paquete.

| Comprobación | Pública | Privada |
| --- | --- | --- |
| Construcción Vinext/Vite desde la copia independiente | Correcta | Correcta |
| Pruebas de cálculo y perfiles | 10/10 correctas | 10/10 correctas |
| Pruebas generales adicionales | 3/5 correctas | 3/5 correctas |
| Total de pruebas existentes | 13/15 correctas | 13/15 correctas |

Los dos fallos generales por variante ya existían y se conservan:

1. `tests/rendered-html.test.mjs`: espera una etiqueta `codex-preview` de desarrollo que no aparece en el HTML generado.
2. `tests/ui-components.test.mjs`: espera la utilidad CSS `scrollbar-width: thin`, ausente en la construcción actual.

La comprobación de tipos de la variante pública reproduce los cinco errores preexistentes: valor `any maskable` del manifiesto; tipo de `baseStatus` en la aplicación; declaración de `cloudflare:workers`; tipos `Fetcher` y `D1Database` del Worker. La compilación de ambas variantes sí finaliza correctamente. Estos errores no se han corregido porque esta tarea requiere preservar la lógica actual.

La identidad del código recuperado, la instalación, las construcciones y las pruebas respaldan la integridad de la migración; no se afirma que se hayan probado manualmente todas las combinaciones de calendario. Los límites funcionales anteriores siguen vigentes.

## Datos y alojamiento

El perfil y los calendarios guardados por el usuario viven en el almacenamiento de su navegador, no en el repositorio. No se exportan ni trasladan durante esta migración.

GitHub almacena el código privado; no sustituye el alojamiento actual ni sus controles de acceso. La configuración de Sites se conserva como referencia y como dependencia de la construcción original. Migrar después el alojamiento o la autenticación será una tarea distinta.
