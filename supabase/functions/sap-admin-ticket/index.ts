import {ticketHandler} from './core.mjs';
const url=Deno.env.get('SUPABASE_URL')!;
const publishable=JSON.parse(Deno.env.get('SUPABASE_PUBLISHABLE_KEYS')||'{}').default||Deno.env.get('SUPABASE_ANON_KEY')!;
// The server secret never leaves this function; only a scoped, expiring HMAC is returned.
const secret=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
Deno.serve(ticketHandler({secret,authenticate:async(authorization:string)=>{
  const res=await fetch(url+'/auth/v1/user',{headers:{apikey:publishable,Authorization:authorization},signal:AbortSignal.timeout(10000)});
  return res.ok?await res.json():null;
}}));
