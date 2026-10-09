import { createClient } from "npm:@supabase/supabase-js@2.57.0";
const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, apikey, content-type, x-client-info"};
const reply=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,"Content-Type":"application/json"}});
Deno.serve(async req=>{
 if(req.method==='OPTIONS')return new Response('ok',{headers:cors});
 if(req.method!=='POST')return reply({error:'POST required'},405);
 try{
  const db=createClient(Deno.env.get('SUPABASE_URL'),Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'));
  const token=req.headers.get('Authorization')?.replace(/^Bearer /i,'');
  if(!token)return reply({error:'Sign in to pay.'},401);
  const {data:{user},error:authError}=await db.auth.getUser(token);
  if(authError||!user)return reply({error:'Sign in again.'},401);
  const {payment_id}=await req.json();
  const {data:p,error}=await db.from('payment_requests').select('*').eq('id',payment_id).single();
  if(error||!p||p.client_id!==user.id)return reply({error:'Payment request not found.'},404);
  if(p.status!=='pending')return reply({error:'This request is no longer payable.'},409);
  const {data:project,error:projectError}=await db.from('projects').select('archived_at,deleted_at').eq('id',p.project_id).single();
  if(projectError||!project||project.archived_at||project.deleted_at)return reply({error:'This project is archived or in Trash. Ask RENOBVA to restore it before paying.'},409);
  const key=Deno.env.get('STRIPE_SECRET_KEY'),origin=Deno.env.get('SITE_URL');
  if(!key||!origin)return reply({error:'Online checkout is not configured yet. Please contact RENOBVA.'},503);
  const base=new URL(origin);if(base.protocol!=='https:'&&base.hostname!=='localhost')throw Error('Invalid SITE_URL');
  const stripe=async(path,options={})=>{
   const response=await fetch('https://api.stripe.com/v1/'+path,{...options,headers:{Authorization:'Bearer '+key,...options.headers},signal:AbortSignal.timeout(15000)});
   const data=await response.json();if(!response.ok)throw Error('Stripe request failed');return data;
  };
  if(p.stripe_session_id){
   const session=await stripe('checkout/sessions/'+encodeURIComponent(p.stripe_session_id));
   if(session.status==='open')return reply({url:session.url});
   return reply({error:session.status==='complete'?'Payment is processing. Please wait for confirmation.':'Checkout expired. Ask RENOBVA for a new payment request.'},409);
  }
  const cents=Math.round(Number(p.amount)*100);
  if(!Number.isSafeInteger(cents)||cents<50||!['EUR','USD','GBP'].includes(p.currency))return reply({error:'Online checkout requires at least 0.50 in the selected currency.'},400);
  // Lock the quote before contacting Stripe. Concurrent clicks use one idempotency key.
  const {error:lockError}=await db.from('payment_requests').update({stripe_locked:true}).eq('id',p.id).eq('status','pending').select('id').single();
  if(lockError)throw lockError;
  const target=new URL('/pages/portal/project.html',base);target.searchParams.set('id',p.project_id);
  const body=new URLSearchParams({mode:'payment',client_reference_id:p.id,'metadata[payment_id]':p.id,'line_items[0][quantity]':'1','line_items[0][price_data][currency]':p.currency.toLowerCase(),'line_items[0][price_data][unit_amount]':String(cents),'line_items[0][price_data][product_data][name]':p.title,success_url:target.href+'&checkout=processing',cancel_url:target.href+'&checkout=cancelled'});
  const session=await stripe('checkout/sessions',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded','Idempotency-Key':'renobva-payment-'+p.id},body});
  const {error:saveError}=await db.from('payment_requests').update({stripe_session_id:session.id,selected_method:'stripe',updated_at:new Date().toISOString()}).eq('id',p.id);
  if(saveError)throw saveError;
  return reply({url:session.url});
 }catch(error){console.error('Checkout failed',error.message);return reply({error:'Could not open checkout. Please try again.'},500);}
});
