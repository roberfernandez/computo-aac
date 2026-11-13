# Retorno SAP → Chrome verificado
13 de noviembre de 2026. Prueba real en la Samsung SM-T510 del usuario, Android 11, con Chrome y la APK independiente v0.2.1.

- SAP respondió correctamente y el auxiliar obtuvo 127 registros de octubre de 2026.
- El auxiliar abrió automáticamente la página receptora en Chrome.
- Chrome validó Digital Asset Links y abrió el canal.
- El receptor recibió los 127 registros, verificó la huella SHA-256 y completó el guardado en IndexedDB.
- Chrome mostró «Dades rebudes i desades a Chrome» y «127 registres».
- Huella observada: 1dd856a2f33e…; la confirmación nativa comprueba la huella completa.
- El auxiliar recibió ready, begin-ack, ack y complete a las 13:40:50 del dispositivo.
- No se descargó JSON ni se compartieron contraseñas, cookies o tokens corporativos. Las filas se transfirieron por el canal local de Chrome.
- La página es estática, con connect-src 'none'; los datos laborales se guardan únicamente en el navegador.
- Còmput y las demás aplicaciones actuales siguen sin cambios.

## Corrección demostrada por la prueba real
Chrome entrega inicialmente el puerto mediante un evento con origen android-app://tmb-sap-return-probe.onrender.com. La primera implementación exigía https://… y esperaba que ese evento ya contuviera el mensaje hello. Rechazaba el puerto y agotaba el tiempo de espera.
La versión actual acepta exclusivamente el origen nativo exacto, conserva el puerto si el módulo aún no está listo y comprueba el identificador aleatorio de operación en el hello recibido por ese puerto.

## Límites del resultado
El ensayo se lanzó en la tableta mediante ADB, con autoReturn activado. No demuestra todavía el botón dentro de Còmput, la transferencia anual completa, la conservación de la ventana PWA original ni una solución para iPhone.
La página de prueba y su IndexedDB usan un origen independiente de Còmput.
