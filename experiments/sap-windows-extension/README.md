# Còmput AAC · Pont SAP per a Chrome (Windows) — prova pilot 0.1

Extensió Manifest V3 que executa el **mateix extractor SAP de l'auxiliar Android**, directament al portal TMB que l'usuari ha obert i autenticat. No és una app de Windows ni un sistema que comparteixi sessions SAP entre treballadors.

## Objectiu i estat

- **Pilot per a Windows/Chrome. No verificat encara amb una sessió SAP real de Windows.**
- De moment, el botó Còmput i la funció de tiquets continuen restringits al perfil administrador. **No està habilitat encara per als companys**: és una decisió expressa de seguretat fins a completar la prova d'aïllament per compte.
- El codi no conté identificadors d'empleat, dades mèdiques, nòmines individuals ni credencials.
- Un únic paquet d'extensió podrà servir a tots els usuaris quan el backend emeti tiquets individualment i s'hagi comprovat l'aïllament.

## Instal·lació a Windows (distribució prevista)

L'extensió és Manifest V3. **Un instal·lador `.exe` no pot activar una extensió no publicada a Chrome Web Store en un Chrome de Windows normal.** Els instal·ladors de tercers i els registres de Windows no poden eludir el consentiment del navegador. No oferim un fals instal·lador ni demanem manipular carpetes de perfil de Chrome.

1. Un desenvolupador autoritzat publica el paquet a Chrome Web Store amb visibilitat **Privada** per als comptes de prova, o **No llistada** quan s'aprovi la distribució. Vegeu [guia de publicació](../../docs/sap-chrome-webstore.md).
2. Quan l'extensió estigui aprovada, s'estableix la variable del repositori `SAP_BRIDGE_CHROME_WEBSTORE_ID` amb el seu identificador de 32 lletres (a–p).
3. En desplegar Còmput, els Windows sense el pont detectat veuran el botó **Instal·lar Pont SAP a Chrome** que obre directament la fitxa oficial. Chrome demanarà afegir-lo i autoritzar els permisos; en tornar i recarregar Còmput es detectarà automàticament.
4. No cal cap ZIP públic, mode desenvolupador, carpeta local o executables externs. No cal instal·lar res si el pont ja està detectat.

**Estat:** falta registrar/publicar l'extensió i validar-la amb la sessió corporativa de Windows. Fins que existeixi la fitxa real, Còmput informa explícitament que la instal·lació directa no està disponible. La versió pilot prèviament instal·lada es continuarà reconeixent. No s'obre l'accés als companys abans de la validació funcional i de privacitat.

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

- Publicació i revisió a Chrome Web Store (paquet de pujada preparat, encara no publicat).
- Autorització general per a companys, encara desactivada al servidor.
- Sincronització de registres SAP entre dispositius (per decisió de disseny). Les **diferències acceptades** sí que es desen en l'espai privat de cada usuari.
