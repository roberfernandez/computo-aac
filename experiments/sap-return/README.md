# SAP → Chrome: isolated return experiment

Return verified on the user's Android tablet with APK v0.2.1: 127 October 2026 records received, integrity-checked and committed to Chrome IndexedDB. See [RESULTADO.md](RESULTADO.md) for evidence and limits.

Còmput main remains unchanged. This branch adds only experiments/sap-return. No real corporate data or credentials are committed.

Receiver: https://tmb-sap-return-probe.onrender.com
Source branch: experiment/sap-return-20261113
Static publish directory: experiments/sap-return/web
Build command: true; SKIP_INSTALL_DEPS=true. Auto-deploy is disabled.

The receiver stores data only locally. Chrome validates the native app via Digital Asset Links. Its initial MessagePort event uses the exact native android-app:// origin; the hello message over that port carries the operation identifier.

Rebuild: set JAVA_HOME and ANDROID_SDK_ROOT, run node prepare-return-deps.mjs and node build-return.mjs under android. The test signing key is retained privately by the owner; no private key is in this branch.

Validated: real Android return and 25 automated extraction, protocol and native-origin tests. Pending: integration with the Còmput button, full-year transfer and iPhone.
