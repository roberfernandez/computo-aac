export const MAX_LENGTH=6*1024*1024;
export function validateDocument(doc,expectedCount,expectedPeriod){
  if(!doc||doc.schema!=="tmb-probe-month-v1"||doc.period!==expectedPeriod||!/^20\d{2}-(0[1-9]|1[0-2])$/.test(doc.period))throw Error("invalid-document");
  if(!Array.isArray(doc.rows)||doc.rows.length!==expectedCount||doc.rows.length>10000)throw Error("invalid-count");
  if(typeof doc.extractedAt!=="string"||!Number.isFinite(Date.parse(doc.extractedAt)))throw Error("invalid-timestamp");
  const rows=doc.rows.map(row=>{
    if(!row||Object.keys(row).some(k=>!["Date","LongText","Number","Wagetype"].includes(k)))throw Error("unexpected-field");
    const match=/^\/Date\((-?\d+)(?:[+-]\d{4})?\)\/$/.exec(String(row.Date));
    const d=match?new Date(Number(match[1])):null;
    if(!d||!Number.isFinite(d.getTime())||d.toISOString().slice(0,7)!==expectedPeriod)throw Error("wrong-period");
    if(typeof row.LongText!=="string"||row.LongText.length>180||!/^-?\d+(?:[.,]\d+)?$/.test(String(row.Number))||String(row.Number).length>30)throw Error("invalid-value");
    if(typeof row.Wagetype!=="string"||row.Wagetype.length>24)throw Error("invalid-concept");
    return {Date:row.Date,LongText:row.LongText,Number:String(row.Number),Wagetype:row.Wagetype};
  });
  return {schema:doc.schema,period:doc.period,extractedAt:doc.extractedAt,rows};
}
export async function sha256(text){
  const bytes=new TextEncoder().encode(text);
  return Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",bytes)),b=>b.toString(16).padStart(2,"0")).join("");
}
export class Receiver{
  constructor(id,save,{digest=sha256,now=Date.now}={}){this.id=id;this.save=save;this.digest=digest;this.now=now;this.created=now();this.phase="waiting";this.parts=[];this.length=0;this.busy=false;}
  async accept(message){
    if(this.now()-this.created>5*60*1000)throw Error("expired");
    if(!message||message.id!==this.id||!/^[a-f0-9]{32}$/.test(this.id))throw Error("wrong-operation");
    if(this.busy)throw Error("processing");
    if(message.type==="begin"){
      if(this.phase!=="waiting"||!Number.isInteger(message.length)||message.length<2||message.length>MAX_LENGTH||!Number.isInteger(message.count)||message.count<0||message.count>10000||!/^[a-f0-9]{64}$/.test(message.sha256)||!/^20\d{2}-(0[1-9]|1[0-2])$/.test(message.period))throw Error("invalid-begin");
      this.meta={length:message.length,count:message.count,sha256:message.sha256,period:message.period};this.phase="receiving";
      return {type:"begin-ack",id:this.id};
    }
    if(message.type==="chunk"){
      if(this.phase!=="receiving"||message.seq!==this.parts.length||typeof message.data!=="string"||message.data.length===0||message.data.length>24000||this.parts.length>=512)throw Error("invalid-chunk");
      this.length+=message.data.length;if(this.length>this.meta.length)throw Error("too-large");
      this.parts.push(message.data);
      return {type:"ack",id:this.id,seq:message.seq};
    }
    if(message.type==="end"){
      if(this.phase!=="receiving"||this.length!==this.meta.length)throw Error("incomplete");
      this.busy=true;
      try{
        const payload=this.parts.join("");
        if(await this.digest(payload)!==this.meta.sha256)throw Error("digest-mismatch");
        const doc=validateDocument(JSON.parse(payload),this.meta.count,this.meta.period);
        await this.save({key:doc.period,doc,sha256:this.meta.sha256,operation:this.id,receivedAt:new Date(this.now()).toISOString()});
        this.phase="complete";this.parts=[];
        return {type:"complete",id:this.id,count:doc.rows.length,sha256:this.meta.sha256,period:doc.period};
      }finally{this.busy=false;}
    }
    throw Error("unexpected-message");
  }
}
