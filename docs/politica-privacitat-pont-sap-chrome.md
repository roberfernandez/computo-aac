# Política de privacitat — Còmput AAC · Pont SAP Windows

**Última actualització:** 13 de novembre de 2026  
**Extensió de Chrome:** Còmput AAC · Pont SAP Windows (versió inicial 0.1.0)

## 1. Responsable i contacte

Aquesta extensió forma part del projecte independent **Còmput AAC**, mantingut pel desenvolupador del repositori [roberfernandez/computo-aac](https://github.com/roberfernandez/computo-aac). Per consultar qüestions de privacitat, exercir drets o comunicar una incidència, utilitza [el canal de contacte del projecte a GitHub](https://github.com/roberfernandez/computo-aac/issues).

El projecte no és una aplicació oficial de Transports Metropolitans de Barcelona (TMB) ni implica que TMB l'avali. El portal SAP de TMB conserva les seves pròpies condicions i polítiques.

## 2. Finalitat

La finalitat única del **Pont SAP Windows** és permetre que l'usuari autoritzat de Còmput AAC, a petició seva, consulti **les pròpies** valoracions i dades de calendari laboral al portal corporatiu SAP i les desi localment a Còmput per contrastar-les amb el còmput de jornada.

L'extensió no accedeix a dades d'altres empleats i verifica que el número d'empleat del portal coincideixi amb el perfil local de Còmput abans de desar la consulta.

## 3. Dades tractades

Durant el contrast, l'extensió pot tractar:

- **Identificació:** identificador del compte autoritzat de Còmput i número d'empleat, utilitzats per verificar que la consulta correspon al mateix usuari. El número d'empleat obtingut de SAP no s'inclou en el document de valoracions desat per l'extensió.
- **Autenticació i autorització:** token de sessió ja existent a Còmput, tiquet d'autorització temporal, identificadors de pestanyes i caducitat de l'operació. L'extensió no demana ni emmagatzema la contrasenya corporativa de SAP.
- **Dades laborals i contingut del portal:** calendari, dates, conceptes de valoració, quantitats i altres registres necessaris per calcular i contrastar les hores. Alguns conceptes laborals poden fer referència a incapacitat temporal (IT) o absències per motius de salut; la finalitat no és obtenir diagnòstics ni històries clíniques.
- **Dades tècniques limitades:** hora de consulta, estat del procés, nombre de registres i empremta de verificació de les dades per controlar-ne la integritat.

No es recopilen amb aquesta extensió l'historial general de navegació, les comunicacions personals, la ubicació del dispositiu ni l'activitat de tecles o ratolí.

## 4. Com funciona i on es desen les dades

1. L'usuari inicia voluntàriament el contrast des de Còmput AAC i autoritza l'operació.
2. El pont verifica l'autorització amb el servei d'autenticació de **Supabase** utilitzat per Còmput i comprova la identitat del compte.
3. El pont obre el portal corporatiu **launcher.tmb.cat**, on l'usuari s'identifica si cal; només consulta les dades necessàries del servei laboral de SAP.
4. Les valoracions obtingudes es validen i s'emmagatzemen a **IndexedDB, dins l'emmagatzematge local de Còmput AAC al navegador de l'usuari**. L'estat temporal de l'operació es conserva a **chrome.storage.session** i s'elimina quan finalitza, es cancel·la o caduca l'operació; el tancament del navegador també posa fi a aquesta sessió.
5. **L'extensió no envia el document de valoracions SAP a Supabase**. Les comunicacions amb aquest servei s'utilitzen per verificar la identitat i l'autorització temporal. La informació emmagatzemada per Còmput fora de la funcionalitat del pont pot estar subjecta a altres avisos de privacitat del projecte.

Les comunicacions amb els serveis es fan mitjançant connexions HTTPS.

## 5. Destinataris i tercers

- **TMB / portal SAP:** font de les dades laborals i servei corporatiu al qual accedeix l'usuari; no és un destinatari nou de les dades importades.
- **Supabase:** servei de verificació del compte i de l'autorització temporal; rep les dades d'autenticació necessàries per a aquesta verificació, però no el document de valoracions SAP per mitjà del pont.
- **GitHub Pages:** allotjament de la interfície web de Còmput AAC i d'aquesta informació; les valoracions es conserven a l'emmagatzematge local del navegador, no als fitxers públics de GitHub.
- **Google Chrome:** entorn on s'executa l'extensió i es mantenen les dades locals del navegador segons la configuració i les polítiques del producte.

No es venen dades personals ni s'utilitzen per a publicitat, perfils comercials, avaluacions creditícies o finalitats alienes al contrast SAP.

## 6. Conservació i eliminació

Les dades temporals d'una operació caduquen al cap de **15 minuts** com a màxim en el flux autoritzat. Les valoracions importades queden en l'emmagatzematge local de Còmput fins que l'usuari les substitueix o elimina les dades del lloc web al navegador. La desinstal·lació de l'extensió **no garanteix, per si sola, que s'esborri l'emmagatzematge local de Còmput**. Per eliminar-lo, cal esborrar les dades desades del lloc `roberfernandez.github.io` a la configuració de Chrome, tenint en compte que aquesta acció també pot eliminar altres dades locals de Còmput.

## 7. Drets i consultes

Per consultar les dades locals o sol·licitar informació sobre el seu tractament, contacta amb el mantenidor des del [repositori del projecte](https://github.com/roberfernandez/computo-aac/issues). No hi publiquis números d'empleat, tokens, credencials ni dades laborals o mèdiques personals: utilitza la incidència pública només per demanar un canal privat de contacte.

## 8. Canvis

Aquesta política s'actualitzarà si canvien les dades consultades, els permisos, els destinataris o la forma d'emmagatzematge del Pont SAP Windows.
