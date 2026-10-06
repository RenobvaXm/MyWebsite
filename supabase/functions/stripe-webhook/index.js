import { createClient } from "npm:@supabase/supabase-js@2.57.0";
// Verify the signature over the unmodified request body, with a five-minute tolerance.
export async function verifySignature(body,header,secret,now=Date.now()){
 const parts=header.split(',').map(x=>x.split('='));const timestamp=parts.find(x=>x[0]==='t')?.[1];
 if(!timestamp||!/^\d+$/.test(timestamp)||Math.abs(now/1000-Number(timestamp))>300)return false;
 const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
 const mac=new Uint8Array(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(timestamp+'.'+body)));
 const expected=Array.from(mac,x=>x.toString(16).padStart(2,'0')).join('');
 return parts.filter(x=>x[0]==='v1').some(([,sig])=>{if(sig?.length!==expected.length)return false;let diff=0;for(let i=0;i<expected.length;i++)diff|=sig.charCodeAt(i)^expected.charCodeAt(i);return diff===0;});
}
Deno.serve(async req=>{
 if(req.method!=='POST')return new Response('POST required',{status:405});
 const secret=Deno.env.get('STRIPE_WEBHOOK_SECRET');if(!secret)return new Response('Webhook not configured',{status:503});
 const body=await req.text();if(!await verifySignature(body,req.headers.get('stripe-signature')||'',secret))return new Response('Invalid signature',{status:400});
 try{
  const event=JSON.parse(body);
  if(!['checkout.session.completed','checkout.session.async_payment_succeeded'].includes(event.type))return Response.json({received:true});
  const s=event.data.object;if(s.payment_status!=='paid')return Response.json({received:true});
  const db=createClient(Deno.env.get('SUPABASE_URL'),Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'));
  const {data:p,error}=await db.from('payment_requests').select('*').eq('id',s.metadata?.payment_id).single();
  if(error||!p)throw Error('Unknown payment');
  if(s.client_reference_id!==p.id||s.amount_total!==Math.round(Number(p.amount)*100)||s.currency!==p.currency.toLowerCase()||(p.stripe_session_id&&p.stripe_session_id!==s.id))return new Response('Payment mismatch',{status:400});
  const {error:updateError}=await db.from('payment_requests').update({status:'paid',stripe_locked:true,stripe_session_id:s.id,selected_method:'stripe',paid_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq('id',p.id).neq('status','paid');
  if(updateError)throw updateError;
  return Response.json({received:true});
 }catch(error){console.error('Webhook processing failed',error.message);return new Response('Retry later',{status:500});}
});
