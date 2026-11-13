# Còmput AAC · Pont SAP per a Chrome (Windows) — prova pilot 0.1

Extensió Manifest V3 que executa el **mateix extractor SAP de l'auxiliar Android**, directament al portal TMB que l'usuari ha obert i autenticat. No és una app de Windows ni un sistema que comparteixi sessions SAP entre treballadors.

## Objectiu i estat

- **Pilot per a Windows/Chrome. No verificat encara amb una sessió SAP real de Windows.**
- De moment, el botó Còmput i la funció de tiquets continuen restringits al perfil administrador. **No està habilitat encara per als companys**: és una decisió expressa de seguretat fins a completar la prova d'aïllament per compte.
- El codi no conté identificadors d'empleat, dades mèdiques, nòmines individuals ni credencials.
- Un únic paquet d'extensió podrà servir a tots els usuaris quan el backend emeti tiquets individualment i s'hagi comprovat l'aïllament.

## Instal·lació pilot

1. Des de **Còmput AAC → Contrastar dades amb TMB**, si no es detecta el pont, prem **Descarregar pont Chrome**. Descàrrega estable del pilot: https://github.com/roberfernandez/computo-aac/releases/download/sap-windows-pilot-v0.1.0/computo-pont-sap-chrome-v0.1.0.zip . Descomprimeix el fitxer.
2. A Chrome, obre `chrome://extensions`, activa **Mode de desenvolupador** i prem **Carrega sense empaquetar**.
3. Selecciona la carpeta `sap-windows-extension` descomprimida que conté `manifest.json`.
4. Obre Còmput a `https://roberfernandez.github.io/computo-aac/`, inicia sessió i prem **Ja està instal·lat? Recarrega Còmput**.
5. Al panell SAP hauria d'aparèixer **«Windows · Pont Chrome detectat»**. Prem **«Contrastar dades amb TMB»**.
6. S'obre el portal oficial TMB. Inicia-hi sessió si cal, i entra a **Consultes Bàsiques de l'Empleat** si el portal no hi arriba automàticament.
7. En completar la consulta, el pont retorna a Còmput. Comprova any, 12 mesos, número de valoracions, comparacions i diferències guardades.

No cal enllaçar físicament el telèfon ni exportar JSON. No instal·lis aquesta prova en un ordinador compartit.

## Seguretat i privacitat

- Permisos **Chrome**: únicament scripting/tabs/storage i orígens de Còmput, portal TMB i Supabase del projecte.
- No utilitza API `cookies`, `webRequest`, `<all_urls>` ni executables externs.
- El portal TMB gestiona la seva autenticació; el pont **no demana, llegeix ni guarda contrasenyes ni cookies corporatives**.
- El servidor d'autorització comprova el tiquet signat HMAC. Les extensions poden **verificar** tiquets, però **no emetre'ls**. La concessió és d'un compte, any i operació, i caduca als 15 minuts.
- Abans d'obrir TMB i abans de desar, el navegador verifica el compte privat de Còmput i l'operació pendent amb el mateix nonce. L'emmagatzematge IndexedDB de Còmput es modifica **atòmicament**: substitució anual + historial + consum del nonce.
- Només es conserven localment dates, conceptes, unitats i codi de concepte de les valoracions. **Ni SAP ni les seves credencials passen per Supabase**, ni les valoracions SAP passen per la missatgeria `window.postMessage`; el missatge de la web a l'extensió conté exclusivament el tiquet temporal.
- Un resultat SAP incomplet, de més antiguitat o d'un altre any **no substitueix** la còpia activa.
- La separació entre usuaris es basa en autenticació Supabase i claus `uid:year`, no en un UUID embegut al repositori.
- Cal confirmar les polítiques internes de TMB sobre aquesta forma d'accés abans de distribuir a altres treballadors.

## Prova de robustesa pendent

La validació en GitHub pot comprovar sintaxi, congruència del protocol, autorització i compilació, però no pot executar un login real de TMB. A Windows cal comprovar específicament:
- què passa amb SSO/MFA i quan Chrome bloqueja finestres o scripts,
- que la detecció del propi número d'empleat de SAP no barregi registres,
- integritat dels 12 mesos i del calendari anual,
- reentrada després de cancel·lacions, tokens caducats o tancament del portal,
- un segon compte de prova amb dades separades i permisos correctes.

## Funcionalitats no incloses

- Distribució per Chrome Web Store (encara no empaquetada/publicada).
- Autorització general per a companys, encara desactivada al servidor.
- Sincronització de registres SAP entre dispositius (per decisió de disseny). Les **diferències acceptades** sí que es desen en l'espai privat de cada usuari.
