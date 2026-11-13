# SAP → Chrome: isolated return experiment
The main Còmput application is unchanged. This branch adds only experiments/sap-return.

- Android WebView query: proven on the user's Android tablet (127 October 2026 rows).
- Receiver and Android Custom Tabs delivery: built, not yet verified on the tablet.
- Tests: 22 passing tests for extraction, identity, period, chunk order, digest and commit acknowledgement.
- Receiver: static HTML/JS/CSS. Corporate rows travel only through Chrome's local message channel and remain in the receiver's IndexedDB.
- Digital Asset Links: development certificate fingerprint only; no private signing key or corporate data in this branch.
- Android return origin: example.invalid placeholder until the independent receiver is deployed.
- No SAP password, cookie, corporate token, personnel identifier, or real valuation row is present in this source.

## Rebuild
Set JAVA_HOME and ANDROID_SDK_ROOT. Under android:
1. node prepare-return-deps.mjs
2. node --test tests/*.test.mjs
3. node build-return.mjs

Use a valid own return origin in assets/return-config.json and its matching certificate in web/.well-known/assetlinks.json before testing on a device. The existing test signing key is retained privately with the owner's prototype files.

## Isolated hosting configuration
Repository: roberfernandez/computo-aac
Branch: experiment/sap-return-20261113
Publish directory: experiments/sap-return/web
Build command: true
Environment: SKIP_INSTALL_DEPS=true
No backend, database, paid compute, or modification to Còmput is required.
