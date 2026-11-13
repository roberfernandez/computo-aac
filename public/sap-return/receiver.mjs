import {Receiver} from './protocol.mjs';
import {verifiedOwner,readPending,transaction} from './storage.mjs';
const $=id=>document.getElementById(id),id=new URLSearchParams(location.hash.slice(1)).get('request')||'';
let owner=null,port=null,queue=Promise.resolve(),grant=null,ready=false;
const fail=code=>{$('state').textContent='No s’ha completat el contrast';$('detail').textContent=code+' · Es conserva la còpia anterior.';};
const checked=(g)=>g&&g.uid===owner&&g.nonce===id&&g.exp>Date.now()&&g.callback===location.origin+'/computo-aac/sap-return/';
async function save(record){
  if(await verifiedOwner()!==owner)throw Error('session-changed');
  const doc=record.doc,annual=grant.scope==='year';
  if(doc.period!==(annual?String(grant.year):grant.year+'-10'))throw Error('wrong-period');
  const store=annual?'exports':'tests',key=owner+':'+(annual?grant.year:doc.period);
  await transaction(['pending',store],'readwrite',(tx,done)=>{
    const p=tx.objectStore('pending').get(id);
    p.onsuccess=()=>{
      if(!checked(p.result)){tx.abort();return;}
      const req=tx.objectStore(store).get(key);
      req.onsuccess=()=>{
        const old=req.result;
        if(old&&Date.parse(old.doc.extraido)>Date.parse(doc.extractedAt)){tx.abort();return;}
        const valoraciones=Object.fromEntries(doc.completedPeriods.map(period=>[period,doc.rows.filter(r=>new Date(Number(/^\/Date\((-?\d+)/.exec(r.Date)[1])).toISOString().startsWith(period))]));
        const normalized={ano:grant.year,extraido:doc.extractedAt,valoraciones};
        const history=[...(old?.history||[]),{extraido:doc.extractedAt,cambios:0,records:doc.rows.length,sha256:record.sha256}].slice(-12);
        tx.objectStore(store).put({key,doc:normalized,history,sha256:record.sha256});
        tx.objectStore('pending').delete(id);done(true);
      };
    };
  });
}
function parse(value){if(typeof value!=='string'||value.length>50000)throw Error('invalid-message');return JSON.parse(value);}
const acceptChannel=event=>{
  if(event.origin!=='android-app://tmb-sap-return-probe.onrender.com'||!event.ports?.[0]||port)return;
  port=event.ports[0];let handshaken=false;
  const receiver=new Receiver(id,save);
  port.onmessage=e=>{queue=queue.then(async()=>{
    if(!ready||!checked(grant))throw Error('unauthorized-operation');
    const message=parse(e.data);
    if(!handshaken){if(message.type!=='hello'||message.id!==id)throw Error('invalid-handshake');handshaken=true;port.postMessage(JSON.stringify({type:'ready',id}));return;}
    if(message.type==='begin'&&message.period!==(grant.scope==='year'?String(grant.year):grant.year+'-10'))throw Error('wrong-period');
    const reply=await receiver.accept(message);port.postMessage(JSON.stringify(reply));
    if(reply.type==='complete'){$('state').textContent='Dades desades a Còmput';$('detail').textContent=reply.count+' registres · Integritat '+reply.sha256.slice(0,12);$('back').hidden=false;setTimeout(()=>location.replace('/computo-aac/'),1200);}
  }).catch(e=>{fail(e.message);try{port.postMessage(JSON.stringify({type:'error',id,code:e.message}));}catch{}});};port.start();
};
try{
  if(!/^[a-f0-9]{32}$/.test(id))throw Error('missing-operation');
  owner=await verifiedOwner();grant=await readPending(id);if(!checked(grant))throw Error('expired-or-used-operation');ready=true;window.__returnAcceptChannel=acceptChannel;
  for(const event of window.__returnBootQueue||[])window.__returnAcceptChannel(event);window.__returnBootQueue=[];
}catch(e){fail(e.message);}
