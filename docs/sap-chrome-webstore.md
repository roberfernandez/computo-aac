# Pont SAP Windows · publicació a Chrome Web Store

Aquesta guia és **només per a qui publica l'extensió**. Els usuaris finals no han de descarregar ZIP, obrir `chrome://extensions`, activar el mode desenvolupador ni localitzar carpetes.

## Per què no distribuïm un EXE

A Windows, una extensió normal de Chrome no es pot instal·lar o activar silenciosament des d'un `.exe` propi. Els mecanismes d'instal·lació externa exigeixen que l'extensió provingui de Chrome Web Store, amb confirmació de l'usuari; el desplegament forçat corporatiu requereix administració de Chrome i polítiques gestionades. Evitem modificar les polítiques, el registre o el perfil de Chrome dels treballadors.

Documentació oficial:
- https://developer.chrome.com/docs/extensions/how-to/distribute/install-extensions
- https://developer.chrome.com/docs/webstore/cws-dashboard-distribution
- https://support.google.com/chrome/a/answer/7532015

## Distribució prevista

1. Executa el workflow **Prepare SAP Chrome Web Store package** (manualment o amb un canvi al pont de Windows). Descarrega l'artefacte de desenvolupament `sap-chrome-webstore-upload`. El ZIP conté `manifest.json` **a l'arrel**; **no** és un instal·lador destinat als usuaris.
2. Registra un compte de desenvolupador a https://chromewebstore.google.com/ i crea la fitxa. Completa iconografia, captures, descripció, justificació dels permisos, declaració de tractament de dades i política de privacitat. El paquet accedeix només a Còmput, al portal TMB i a la funció d'autorització de Supabase. No afirmis que està aprovat per TMB si no existeix aquesta autorització.
3. Comença amb visibilitat **Private**, només per als comptes de prova autoritzats. La visibilitat **Unlisted** permet que qualsevol usuari amb l'enllaç pugui instal·lar-la; per això no és equivalent a autorització privada. La funció SAP a Còmput segueix limitada pel servidor a comptes amb el permís d'administrador.
4. Superada la revisió de Chrome, copia l'ID de la fitxa (32 caràcters a–p) i configura a **Settings → Secrets and variables → Actions → Variables** del repositori la variable `SAP_BRIDGE_CHROME_WEBSTORE_ID`. No afegeixis un identificador inventat.
5. Executa el workflow **Deploy Cómputo AAC to GitHub Pages**. El panell oferirà als Windows sense pont el botó **Instal·lar Pont SAP a Chrome**, que obre la fitxa real. L'usuari accepta els permisos a Chrome, torna a Còmput i el recarrega. El pont s'identifica pel mateix missatge `ready` que ja existeix.
6. Valida la sessió real a Windows: identificació SAP, període anual, 12 mesos, integritat, caducitat de tiquets, tornada a Còmput i aïllament entre dos comptes. No facis difusió general fins a revisar el permís d'accés al portal corporatiu.

## Canvis a Còmput

- Si el pont està detectat, es conserva el flux existent sense cap pas nou.
- Si no es detecta i hi ha un ID vàlid publicat, apareix el botó directe a la botiga.
- Si encara no hi ha ID vàlid, apareix un avís honest: la instal·lació directa **encara no està disponible**; no es redirigeix l'usuari a un ZIP o a una guia de carpetes.
- A Android es manté l'instal·lador APK actual sense canvis.
- No es modifica IndexedDB ni les còpies SAP, els tiquets, les comparacions ni les revisions privades.

## Validació

El build crea un ZIP privat per a pujar-lo a Chrome Web Store, **no un ZIP perquè l'usuari l'instal·li manualment**. Les proves automatitzades només validen el paquet i el comportament del panell; no substitueixen ni la revisió de Google ni una prova amb SAP real.
