import {Receiver} from "./protocol.mjs";
const $=id=>document.getElementById(id);
const id=new URLSearchParams(location.hash.slice(1)).get("request")||"";
let port=null,receiver=null,queue=Promise.resolve();
function failure(code){
  document.body.className="error";$("symbol").textContent="!";$("state").textContent="La prova no s'ha completat";
  $("problem").textContent="Diagnòstic: "+code;
}
function openDb(){return new Promise((resolve,reject)=>{const r=indexedDB.open("tmb-return-probe-v1",1);r.onupgradeneeded=()=>r.result.createObjectStore("active",{keyPath:"key"});r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(Error("storage-unavailable"));});}
async function save(record){
  const db=await openDb();
  try{await new Promise((resolve,reject)=>{const tx=db.transaction("active","readwrite");tx.objectStore("active").put(record);tx.oncomplete=resolve;tx.onerror=()=>reject(Error("storage-failed"));tx.onabort=()=>reject(Error("storage-aborted"));});}finally{db.close();}
}
function parse(value){if(typeof value!=="string"||value.length>50000)throw Error("invalid-message");return JSON.parse(value);}
if(!/^[a-f0-9]{32}$/.test(id))failure("missing-operation");
else window.addEventListener("message",event=>{
  if(event.origin!==location.origin||!event.ports||!event.ports[0]||port)return;
  let hello;try{hello=parse(event.data);}catch{return;}
  if(hello.type!=="hello"||hello.id!==id)return;
  port=event.ports[0];receiver=new Receiver(id,save);
  $("state").textContent="Canal de Chrome verificat";$("detail").textContent="Rebent les dades de la prova…";
  port.onmessage=event=>{
    queue=queue.then(async()=>{
      const message=parse(event.data);
      const response=await receiver.accept(message);
      if(response.type==="complete"){
        document.body.className="ok";$("symbol").textContent="✓";$("state").textContent="Dades rebudes i desades a Chrome";
        $("detail").textContent="La transferència local s'ha completat.";
        $("result").hidden=false;$("count").textContent=response.count+" registres";
        $("period").textContent="Període: "+response.period;
        $("integrity").textContent="Integritat verificada · "+response.sha256.slice(0,12);
        $("storage").textContent="Còpia activa desada només en aquest navegador. Cap dada laboral enviada al servidor.";
      }
      port.postMessage(JSON.stringify(response));
    }).catch(error=>{failure(error.message);try{port.postMessage(JSON.stringify({type:"error",id,code:error.message}));}catch{}});
  };
  port.start();port.postMessage(JSON.stringify({type:"ready",id}));
});
$("erase").onclick=async()=>{
  const db=await openDb();
  try{await new Promise((resolve,reject)=>{const tx=db.transaction("active","readwrite");tx.objectStore("active").clear();tx.oncomplete=resolve;tx.onerror=reject;});$("storage").textContent="Dades de la prova esborrades d'aquest navegador.";}
  catch{failure("erase-failed");}finally{db.close();}
};
