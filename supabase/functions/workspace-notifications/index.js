import {createClient} from 'npm:@supabase/supabase-js@2.57.0';
// Scheduled worker. The Vault credential is verified server-side; no public/user token can dispatch mail.
Deno.serve(async req=>{
 const reply=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json'}});
 if(req.method!=='POST')return reply({error:'POST required'},405);
 const sb=createClient(Deno.env.get('SUPABASE_URL'),Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),{auth:{persistSession:false}});
 const token=req.headers.get('Authorization')?.replace(/^Bearer /i,'')||'';
 if(token.length!==72)return reply({error:'Unauthorized'},401);
 const auth=await sb.rpc('authorize_workspace_mail_worker',{candidate:token});if(auth.error||auth.data!==true)return reply({error:'Unauthorized'},401);
 const key=Deno.env.get('RESEND_API_KEY'),from=Deno.env.get('EMAIL_FROM');if(!key||!from)return reply({configured:false,pending:true});
 const batch=await sb.rpc('claim_workspace_emails');if(batch.error)return reply({error:'Queue unavailable'},500);
 let sent=0,failed=0,skipped=0;
 for(const job of batch.data||[]){
  try{
   const [{data:pref},{data:project},{data:profile},account]=await Promise.all([sb.from('notification_preferences').select('*').eq('user_id',job.recipient_id).maybeSingle(),sb.from('projects').select('title,user_id').eq('id',job.project_id).maybeSingle(),sb.from('profiles').select('role').eq('id',job.recipient_id).maybeSingle(),sb.auth.admin.getUserById(job.recipient_id)]);
   const user=account.data.user;
   if(!pref?.email||!pref[job.kind]||!user?.email_confirmed_at||!project||(profile?.role!=='admin'&&project.user_id!==user.id)||Date.now()-Date.parse(job.created_at)>86400000){await sb.from('workspace_email_queue').update({status:'skipped',last_error:null}).eq('id',job.id);skipped++;continue;}
   const site=Deno.env.get('SITE_URL'),link=site&&/^https?:\/\//.test(site)?site.replace(/\/$/,'')+'/pages/'+(profile?.role==='admin'?'admin/admin-chat':'portal/project')+'.html?id='+job.project_id:'';
   const response=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:'Bearer '+key,'Content-Type':'application/json','Idempotency-Key':'renobva-update-'+job.id},body:JSON.stringify({from,to:[user.email],subject:'RENOBVA — '+job.label,text:job.label+'\n\nProject: '+project.title+'\n\n'+(link?'Open your secure project workspace:\n'+link:'Sign in to your RENOBVA account to view this update.')+'\n\nManage email preferences in your account settings.'}),signal:AbortSignal.timeout(10000)});
   if(!response.ok)throw Error('Email provider returned '+response.status);const data=await response.json();const result=await sb.from('workspace_email_queue').update({status:'sent',provider_id:data.id,last_error:null}).eq('id',job.id);if(result.error)throw Error('Could not record delivery');sent++;
  }catch(err){failed++;await sb.from('workspace_email_queue').update({status:job.attempts>=6?'failed':'pending',next_attempt_at:new Date(Date.now()+Math.min(3600,60*2**job.attempts)*1000).toISOString(),last_error:String(err.message).slice(0,200)}).eq('id',job.id);}
 }
 return reply({sent,failed,skipped});
});
