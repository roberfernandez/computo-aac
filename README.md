# Cómputo AAC

Respaldo independiente del código actual de Cómputo AAC, recuperado de las versiones publicadas en ChatGPT Sites el 20 de septiembre de 2026. Esta migración no cambia la lógica ni añade calendario TMB, Supabase o nuevas funciones.

## Variantes conservadas

| Rama | Aplicación | Versión publicada de origen | Commit de origen |
| --- | --- | --- | --- |
| `main` | Pública | 14 | `cc5648fe01eb16c8b83b666577e8c80515a05398` |
| `privada` | Privada | 58 | `6559fb408d78cc5c4a292a72f2d49e867066f489` |

Ambas ramas contienen el proyecto completo y mantienen sus nombres de paquete, configuración y archivos de dependencias originales. Las variantes difieren en cinco archivos: `app/page.tsx`, `app/layout.tsx`, `package.json`, `package-lock.json` y `.openai/hosting.json`.

El inventario de origen con las sumas SHA-256 está en `docs/inventario-origen.json`. Los 111 archivos originales de cada variante se conservan: el README y el `.gitignore` originales se guardan en `docs/origen/`; los demás permanecen en su ruta original, sin cambios de contenido.

## Desarrollo local

Requisitos: Git, npm y Node.js **22.13.0 o superior**. La comprobación de esta migración usa Node.js 24.19.0. Se conservan exactamente `package.json` y `package-lock.json`.

```sh
git clone https://github.com/roberfernandez/computo-aac.git
cd computo-aac
npm ci
```

Para trabajar con la variante privada, ejecutar `git switch privada` antes de instalar dependencias. Guardar o confirmar los cambios propios antes de cambiar de rama.

Los comandos directos siguientes evitan los envoltorios originales específicos de Linux y pueden usarse también en Windows:

```sh
# Desarrollo
node node_modules/vite/bin/vite.js --host 127.0.0.1

# Construcción
node node_modules/vinext/dist/cli.js build

# Servir la construcción
node node_modules/vinext/dist/cli.js start

# Pruebas de cálculos y perfiles
node --test tests/payroll-summary.test.mjs tests/turn-profiles.test.mjs
```

Los scripts originales `npm run dev`, `npm run build`, `npm run install:ci` y `npm test` se mantienen. Algunos usan Bash, GNU `timeout` y `flock`; para ejecutarlos tal cual se necesita un entorno Linux/WSL apropiado. No se han adaptado durante esta migración.

## Estructura

- `app/`: aplicación React/TypeScript, calendario, cálculos, perfiles, estilos, metadatos y utilidades de autenticación originales.
- `components/ui/`, `hooks/`, `lib/`: componentes e infraestructura de interfaz.
- `tests/`: pruebas existentes de cálculos, perfiles, componentes y HTML generado.
- `public/` y `eng.traineddata`: iconos, manifiestos y recursos del reconocimiento de calendarios.
- `worker/`, `build/`, `vite.config.ts`, `next.config.ts`: entrada de Cloudflare y construcción con Vinext/Vite.
- `db/`, `drizzle/`, `examples/d1/`: infraestructura original de la plantilla; no es una integración con Supabase.
- `scripts/`, `.npmrc`, `package.json`, `package-lock.json`, `tsconfig.json`: instalación, configuración y herramientas originales.
- `vendor/`: estilos incluidos y su licencia.
- `.openai/hosting.json`: identificación y configuración original de Sites, sin credenciales.
- `docs/`: procedencia, inventario, revisión y documentación original.

## Funciones y límites conservados

Se mantienen la lectura de imágenes de calendario, edición diaria y por periodos, perfiles y turnos T1/T2/T4/T5/T8, subturnos T8, previsiones mensuales y anuales, jornadas y horas de 2020–2027, nocturnidad y contadores retributivos existentes. Las reglas de tiempo completo que estaban pendientes siguen marcadas como pendientes; esta copia no las completa ni corrige.

Los calendarios y perfiles del usuario se guardan en el almacenamiento local de su navegador. **No forman parte del código ni se trasladan a GitHub.** Cambiar el dominio de la aplicación no traslada automáticamente esos datos.

Este repositorio es privado. Guardarlo en GitHub no cambia ni despliega las aplicaciones publicadas. La restricción de acceso de la aplicación privada depende de Sites; copiar el código a otro alojamiento no reproduce automáticamente esa protección. Las funciones de autenticación y los identificadores de Sites se conservan como parte de la versión original.

## Seguridad y validación

Consultar `docs/REVISION-MIGRACION.md`. Se revisaron ambos árboles con Gitleaks y se comprobó la configuración de credenciales y entorno. No se han detectado secretos. El `.gitignore` excluye dependencias instaladas, construcciones, cachés, archivos de entorno, claves privadas y credenciales locales. No sustituye la revisión de futuras incorporaciones.

Se documentan los fallos preexistentes de comprobaciones generales sin corregirlos, para mantener el comportamiento exacto solicitado.
