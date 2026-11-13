# Integració privada SAP — 13/11/2026

Còmput es manté com a PWA. L’auxiliar Android només gestiona la sessió corporativa en WebView, consulta les valoracions i les retorna localment a Chrome. No replica el calendari ni el motor de Còmput.

## Flux i dades

- Supabase Auth valida el compte administrador i emet un tiquet signat, restringit a any/abast, amb caducitat de 15 minuts. El servidor no rep registres SAP ni credencials corporatives.
- L’APK verifica el tiquet abans d’obrir SAP. L’identificador de personal es llegeix del portal autenticat; no s’introdueix manualment.
- La prova d’octubre consulta les valoracions reals. L’anual valida el calendari complet i consulta els dotze mesos, inclosos els que no tenen valoracions encara.
- El calendari SAP pot portar Pernr absent, buit o el sentinella compartit; només se’n transfereixen les dates per comprovar completesa. Si el calendari porta un identificador individual diferent es rebutja. Les valoracions exigeixen la identitat pròpia a cada fila.
- Chrome Custom Tabs valida l’origen de l’APK amb Digital Asset Links a https://tmb-sap-return-probe.onrender.com. El destí és https://roberfernandez.github.io/computo-aac/sap-return/. Aquest servidor Render no rep el payload.
- Retorn amb nonce, SHA-256, fragments ordenats i confirmació només després del commit d’IndexedDB. Una operació consumida no pot substituir una altra extracció.
- IndexedDB computo-sap-private-v1: exports (activa anual per usuari/any), tests (octubre aïllat), pending (operacions pendents). Cap contrasenya SAP, cookie ni token corporatiu s’hi desa.

## Alternatives

| Alternativa | Estat | Experiència |
| --- | --- | --- |
| PWA sola | No s’ha demostrat lectura automàtica de SAP des d’un altre origen | La política del navegador limita lectures entre dominis; l’autenticació a SAP no atorga aquest accés a Còmput |
| PWA + pont Android | Retorn real de 127 registres i extracció anual provats en Samsung SM-T510 | Una instal·lació inicial; després botó de Còmput i només autenticació TMB quan calgui |
| APK completa | Innecessària per aquest flux | Duplicaria manteniment i distribució de la PWA |
| iPhone | Pont no validat | El canal Android Custom Tabs no és una solució iOS; no s’anuncia suport automàtic iPhone |

Documentació: https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CORS ; https://developer.android.com/reference/androidx/browser/customtabs/CustomTabsSession .

## Correccions confirmades

Intervals mèdics resten només d’hores ordinàries treballades; l’arrodoniment diürn/nocturn és una magnitud separada per al contrast SAP. Permís familiar complet identificat expressament, preservació de DCOM/FEST original, variants Festivo Oficial proporcional/E separades i motor existent de Festivo Trabajado E compartit amb Nòmina. La Hora Nona no canvia de regla.

Els ajustos dels casos individuals de 2026 s’apliquen únicament al compte pilot, després de validar-lo i crear una còpia prèvia a IndexedDB computo-confirmed-migrations-v1 / backups. No s’altera plan.original. Es respecten intervals i modalitats que l’usuari ja hagi indicat explícitament.

## Validació i restauració

- Branca restore/pre-sap-integration-20261113: Còmput 13bbabccd791b174add4fe8fe1d2a6234cd50a78; Nòmina 4df1670eacf3b59e604dacd148641a393df25d53.
- Primera integració: PR45, merge 255dd453e7395c55ab539d8c4ab21149af17cbf5. Validació i Pages correctes.
- Android 0.3.1: compilació i signatura correctes. Identitat, navegació/paginació, 12 períodes, integritat i retorn coberts amb proves.
- Còmput: 92 proves passen; els mateixos 8 errors que la còpia base independent (artefactes antics, expectatives prèvies) continuen presents. No s’han relaxat per ocultar regressions. La compilació Pages i el lint exigit pel repositori passen. Els errors TypeScript globals ja presents no augmenten.
- Nòmina: 102 proves passen, cap error. Build estàtic correcte.
- Cap desplegament elimina calendaris ni altera l’autenticació de TMBAgent existent.
