# Còmput · Pont TMB 0.3.2

APK nueva, compilada desde el código actual posterior a la corrección de privacidad `9b8ff01`. No se ha reutilizado la APK 0.3.1 ni se han incluido calendarios, datos médicos, reglas individuales, números de empleado o identificadores de cuenta fijos. Se conserva el certificado de firma reconocido por el canal de retorno. Las URL de Còmput, SAP y su servicio de autorización son configuración común, no una identidad de trabajador.

## Descarga e instalación

Descargar `computo-pont-tmb-v0.3.2.apk` desde Chrome en el propio móvil. Android 8.0 o superior, con Chrome y Android System WebView compatibles y actualizados. El APK no incluye bibliotecas nativas dependientes de una arquitectura concreta. La compatibilidad real todavía debe comprobarla el usuario en su móvil.

Abrir la descarga e instalar. Si Android lo pide, permitir a Chrome instalar este archivo. Terminar con **Hecho**, abrir Còmput en Chrome e iniciar la operación desde allí; abrir el icono del auxiliar sin un tiquet válido no inicia SAP.

Còmput: https://roberfernandez.github.io/computo-aac/

1. Tener iniciada la sesión propia de TMBAgent/Còmput en Chrome del móvil.
2. Pulsar **Comprovar retorn · Octubre 2026**. Iniciar sesión corporativa en la pantalla oficial si SAP lo solicita. Esperar el retorno automático y comprobar el recuento; la referencia anterior es 127.
3. Sólo después de comprobar octubre, consultar el año. Referencia anterior: 1.111 registros de los doce meses. Las cifras son referencias de la extracción anterior, no valores que se fuercen en la consulta.
4. Repetir la consulta anual y comprobar que actualiza la misma copia, sin sumar otra vez los registros.

No hacen falta USB, ADB, ordenador, marcadores ni descargar/importar JSON. Se deben comprobar en el móvil la autenticación, el retorno, la conservación de datos y la repetición antes de afirmar que funciona allí. El archivo `verification.json` distingue la auditoría estática y las pruebas automáticas de esta prueba real **pendiente**.

## Acceso y datos

La APK usa la identidad del tiquet autenticado y el número SAP observado en el portal de la sesión del trabajador. No contiene una identidad particular predeterminada. **El servidor sigue exigiendo el permiso administrativo `app_metadata.computo_sap_admin`; no se han habilitado otros usuarios.** Esto no es todavía una distribución abierta a compañeros.

El auxiliar consulta SAP en su WebView y devuelve fechas, conceptos y unidades a Chrome mediante un canal local de Custom Tabs. El receptor queda asociado a la cuenta autenticada y a una operación pendiente de un solo uso. Supabase autoriza la operación; Render publica la acreditación del canal. El payload laboral no se envía a esos dos servicios por este puente. La sincronización habitual de los datos de Còmput sigue siendo independiente.

La sesión corporativa se mantiene en el WebView del móvil. La cuenta Còmput se valida en Chrome. Ninguna depende de que estén encendidos la tableta o el PC; confirmar el funcionamiento independiente sigue pendiente de la prueba real.

## Verificación

- SHA-256 del APK en `SHA256SUMS.txt` y `verification.json`.
- Firmas v2 y v3 verificadas, mismo certificado que la acreditación publicada.
- Auditoría del APK empaquetado: sin UUID fijos, correos, marcadores médicos ni reglas individuales; sus dos assets coinciden con el código actual. No es una auditoría exhaustiva de todos los sistemas.
- 25 pruebas específicas correctas; prueba real de este APK en el móvil todavía pendiente.
- No se han cambiado los cálculos, los registros sincronizados, las políticas ni los permisos existentes de Còmput/Nòmina.

Para compilar se requiere SDK Android 35, build-tools 35.0.0, JDK y las dependencias verificadas por `prepare-return-deps.mjs`. `build-return.mjs` exige el almacén de firma privado mediante `TMB_SAP_KEYSTORE` y su contraseña en `TMB_SAP_STORE_PASSWORD`; no genera silenciosamente otra identidad de firma. No publicar claves ni almacenes de firma.

## Incidencia histórica abierta

Se conserva [el informe de privacidad](../../docs/privacy-remediation-2026-11-13.md). El historial Git, los artefactos antiguos y las APK anteriores no se consideran saneados o retirados por publicar esta nueva versión. Se mantienen los puntos de restauración. No se ha desarrollado soporte iPhone ni nuevas funciones de la aplicación.
