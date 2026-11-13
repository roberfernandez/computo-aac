import {mkdir,writeFile} from "node:fs/promises";
import {dirname,join} from "node:path";
import {fileURLToPath} from "node:url";
import {createHash} from "node:crypto";
import {execFile} from "node:child_process";
const root=dirname(fileURLToPath(import.meta.url));
const deps=[
  {
    "name": "browser",
    "url": "https://dl.google.com/dl/android/maven2/androidx/browser/browser/1.8.0/browser-1.8.0.aar",
    "filename": "browser-1.8.0.aar",
    "kind": "aar",
    "sha256": "2d6167b33bf6a064c37501501543702349e850ac62c732d1efa4e71063675456"
  },
  {
    "name": "annotation",
    "url": "https://dl.google.com/dl/android/maven2/androidx/annotation/annotation/1.2.0/annotation-1.2.0.jar",
    "filename": "annotation.jar",
    "kind": "jar",
    "sha256": "9029262bddce116e6d02be499e4afdba21f24c239087b76b3b57d7e98b490a36"
  },
  {
    "name": "core",
    "url": "https://dl.google.com/dl/android/maven2/androidx/core/core/1.7.0/core-1.7.0.aar",
    "filename": "core.aar",
    "kind": "aar",
    "sha256": "aaf6734226fff923784f92f65d78a2984dbf17534138855c5ce2038f18656e0b"
  },
  {
    "name": "collection",
    "url": "https://dl.google.com/dl/android/maven2/androidx/collection/collection/1.1.0/collection-1.1.0.jar",
    "filename": "collection.jar",
    "kind": "jar",
    "sha256": "632a0e5407461de774409352940e292a291037724207a787820c77daf7d33b72"
  },
  {
    "name": "concurrent",
    "url": "https://dl.google.com/dl/android/maven2/androidx/concurrent/concurrent-futures/1.0.0/concurrent-futures-1.0.0.jar",
    "filename": "concurrent.jar",
    "kind": "jar",
    "sha256": "5595a40e278a7b39fa78a09490e3d7f3faa95c7b01447148bd38b5ade0605c35"
  },
  {
    "name": "interpolator",
    "url": "https://dl.google.com/dl/android/maven2/androidx/interpolator/interpolator/1.0.0/interpolator-1.0.0.aar",
    "filename": "interpolator.aar",
    "kind": "aar",
    "sha256": "33193135a64fe21fa2c35eec6688f1a76e512606c0fc83dc1b689e37add7732a"
  },
  {
    "name": "experimental",
    "url": "https://dl.google.com/dl/android/maven2/androidx/annotation/annotation-experimental/1.4.0/annotation-experimental-1.4.0.aar",
    "filename": "experimental.aar",
    "kind": "aar",
    "sha256": "c6eb7e676011ec65b32428373d450debdfc45179c4f8b3a752174fb87c17b08a"
  },
  {
    "name": "future",
    "url": "https://repo.maven.apache.org/maven2/com/google/guava/listenablefuture/1.0/listenablefuture-1.0.jar",
    "filename": "future.jar",
    "kind": "jar",
    "sha256": "e4ad7607e5c0477c6f890ef26a49cb8d1bb4dffb650bab4502afee64644e3069"
  }
];
const dir=join(root,"_deps");await mkdir(dir,{recursive:true});
for(const dep of deps){const response=await fetch(dep.url);if(!response.ok)throw Error("Download failed: "+dep.name);const data=new Uint8Array(await response.arrayBuffer());if(createHash("sha256").update(data).digest("hex")!==dep.sha256)throw Error("Digest mismatch: "+dep.name);const target=join(dir,dep.filename);await writeFile(target,data);if(dep.kind==="aar"){const output=join(dir,dep.name);await mkdir(output,{recursive:true});const jar=process.env.JAVA_HOME?join(process.env.JAVA_HOME,"bin",process.platform==="win32"?"jar.exe":"jar"):"jar";await new Promise((resolve,reject)=>execFile(jar,["--extract","--file",target,"--dir",output,"classes.jar"],{windowsHide:true},e=>e?reject(e):resolve()));}}
console.log("Pinned dependencies verified.");
