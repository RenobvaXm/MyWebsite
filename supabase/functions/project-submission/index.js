import { createClient } from "npm:@supabase/supabase-js@2.57.0";
const cors = {"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"GET, POST, OPTIONS"};
const reply = (body,status=200) => new Response(JSON.stringify(body),{status,headers:{...cors,"Content-Type":"application/json"}});
const services = ["Business Website","Full-Stack Project","Website Redesign","Birthday Website","Anniversary / Love","Mother's Day","Wedding / Proposal","Custom Celebration"];
const special = services.slice(3);
const clean = (value,max) => String(value || "").trim().slice(0,max);
const ownerEmail = "alexander.haeussler01@gmail.com";
Deno.serve(async req => {
 if(req.method==="OPTIONS") return new Response("ok",{headers:cors});
 if(req.method==="GET") return reply({email_configured:Boolean(Deno.env.get("RESEND_API_KEY") && Deno.env.get("EMAIL_FROM")),site_url_configured:Boolean(Deno.env.get("SITE_URL"))});
 if(req.method!=="POST") return reply({error:"POST required"},405);
 try {
  const admin = createClient(Deno.env.get("SUPABASE_URL"),Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"),{auth:{persistSession:false,autoRefreshToken:false}});
  const token = req.headers.get("Authorization")?.replace(/^Bearer /i,"");
  if(!token) return reply({error:"Sign in to create your project"},401);
  const {data:{user},error:authError} = await admin.auth.getUser(token);
  if(authError || !user) return reply({error:"Your session expired. Sign in again."},401);
  if(!user.email_confirmed_at) return reply({error:"Verify your account email before submitting a project."},403);
  const input = await req.json();
  let project;
  if(input.action==="retry") {
   const {data:p,error} = await admin.from("projects").select("*").eq("id",input.project_id).single();
   const {data:profile} = await admin.from("profiles").select("role").eq("id",user.id).single();
   if(error || !p || (p.user_id!==user.id && profile?.role!=="admin")) return reply({error:"Project not found"},404);
   project=p;
  } else {
   const title=clean(input.title,120), brief=clean(input.brief,5000), service_type=clean(input.service_type,80);
   if(title.length<3 || brief.length<10 || !services.includes(service_type) || !/^[0-9a-f-]{36}$/i.test(input.submission_key||"")) return reply({error:"Add a project title, service and at least 10 characters describing your idea."},400);
   const {data:existing}=await admin.from("projects").select("*").eq("submission_key",input.submission_key).maybeSingle();
   if(existing) {
    if(existing.user_id!==user.id) return reply({error:"Invalid submission reference"},409);
    project=existing;
   } else {
    const {count}=await admin.from("projects").select("id",{count:"exact",head:true}).eq("user_id",user.id).gte("created_at",new Date(Date.now()-600000).toISOString());
    if((count||0)>=5) return reply({error:"Please wait a few minutes before creating another project."},429);
    const deadline=input.deadline||null;
    if(deadline && !/^\d{4}-\d{2}-\d{2}$/.test(deadline)) return reply({error:"Invalid deadline"},400);
    const answers=input.answers && typeof input.answers==="object" && !Array.isArray(input.answers) ? input.answers : {};
    if(JSON.stringify(answers).length>12000) return reply({error:"Project details are too long"},400);
    const result=await admin.from("projects").insert({user_id:user.id,title,brief,service_type,category:special.includes(service_type)?"special":"business",budget:clean(input.budget,80),deadline,answers,status:"new",submission_key:input.submission_key}).select().single();
    if(result.error) {
     if(result.error.code==="23505") {
      const {data:p}=await admin.from("projects").select("*").eq("submission_key",input.submission_key).eq("user_id",user.id).single();
      if(!p) throw result.error; project=p;
     } else throw result.error;
    } else project=result.data;
   }
  }
  const authOwner=await admin.auth.admin.getUserById(project.user_id);
  const customer=authOwner.data.user;
  if(!customer?.email || !customer.email_confirmed_at) return reply({project_id:project.id,email_status:"pending",message:"Project saved; email verification is required."});
  // Each email has a durable delivery row and a provider idempotency key.
  const key=Deno.env.get("RESEND_API_KEY"), from=Deno.env.get("EMAIL_FROM");
  const baseUrl=Deno.env.get("SITE_URL") || req.headers.get("Origin");
  const projectLink=baseUrl && /^https?:\/\//.test(baseUrl) ? baseUrl.replace(/\/$/,"")+"/pages/portal/project.html?id="+project.id : "";
  const summary=`Project: ${project.title}\nService: ${project.service_type}\nBudget: ${project.budget||"Not specified"}\nDeadline: ${project.deadline||"Not specified"}\n\n${project.brief}\n\nSelected details:\n${JSON.stringify(project.answers,null,2)}\n\n${projectLink}`;
  const outcomes={};
  for(const kind of ["owner","confirmation"]) {
   await admin.from("project_email_delivery").upsert({project_id:project.id,kind},{onConflict:"project_id,kind",ignoreDuplicates:true});
   const {data:delivery}=await admin.from("project_email_delivery").select("*").eq("project_id",project.id).eq("kind",kind).single();
   if(delivery?.status==="sent") {outcomes[kind]="sent";continue;}
   if(!key || !from) {outcomes[kind]="pending";continue;}
   const body=kind==="owner"
    ? {from,to:[ownerEmail],reply_to:customer.email,subject:"New RENOBVA request: "+project.title,text:"A client submitted a project.\nClient: "+customer.email+"\n\n"+summary}
    : {from,to:[customer.email],reply_to:ownerEmail,subject:"We received your RENOBVA project request",text:"Hi,\n\nThanks for your request. Your project has been created and RENOBVA will review it. This is a request acknowledgement, not a payment receipt or an accepted quote.\n\n"+summary+"\n\nYou can chat with RENOBVA inside your project.\n\nRENOBVA"};
   try {
    const response=await fetch("https://api.resend.com/emails",{method:"POST",headers:{"Authorization":"Bearer "+key,"Content-Type":"application/json","Idempotency-Key":"renobva-"+project.id+"-"+kind},body:JSON.stringify(body),signal:AbortSignal.timeout(10000)});
    const data=await response.json();
    if(!response.ok) throw Error("Email provider rejected delivery ("+response.status+")");
    await admin.from("project_email_delivery").update({status:"sent",provider_id:data.id,last_error:null,updated_at:new Date().toISOString()}).eq("project_id",project.id).eq("kind",kind);
    outcomes[kind]="sent";
   } catch(error) {
    await admin.from("project_email_delivery").update({status:"failed",last_error:String(error.message).slice(0,200),updated_at:new Date().toISOString()}).eq("project_id",project.id).eq("kind",kind);
    outcomes[kind]="failed";
   }
  }
  return reply({project_id:project.id,email_status:outcomes.owner==="sent"&&outcomes.confirmation==="sent"?"sent":"pending",delivery:outcomes});
 } catch(error) {
  console.error("project-submission failed",error.message);
  return reply({error:"Could not save this request. Please try again."},500);
 }
});
