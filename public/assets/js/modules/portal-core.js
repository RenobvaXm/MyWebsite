
const CFG=window.RENOBVA_SUPABASE||{};
const configured=CFG.url && !CFG.url.includes("YOUR_") && CFG.anonKey && !CFG.anonKey.includes("YOUR_");
const sb=configured?window.supabase.createClient(CFG.url,CFG.anonKey,{
 auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}
}):null;
window.renobva={sb,configured};

function toast(msg,type="ok"){
 const t=document.createElement("div");t.className="portal-toast "+type;t.textContent=msg;document.body.appendChild(t);
 setTimeout(()=>t.classList.add("show"),10);setTimeout(()=>{t.classList.remove("show");setTimeout(()=>t.remove(),250)},2800);
}
function guardConfig(){if(!configured){toast("Connect Supabase in assets/js/supabase-config.js","warn");return false}return true}
async function currentUser(){if(!sb)return null;const {data,error}=await sb.auth.getUser();if(error&&(error.name==='AuthRetryableFetchError'||!navigator.onLine||error.status>=500))throw error;return data.user||null}
async function profileFor(id){const {data,error}=await sb.from("profiles").select("*").eq("id",id).single();if(error)throw error;return data}
async function requireAuth(admin=false){
 if(!guardConfig())return null;
 let user,profile;try{user=await currentUser();if(user)profile=await profileFor(user.id);}catch(error){window.RENOBVA_AUTH_LOAD_FAILED=true;window.RENOBVA_CONNECTION?.error();toast('Could not load your account. Retry the connection to continue.','warn');return null;}
 if(!user){location.href="../auth/login.html?returnTo="+encodeURIComponent(location.pathname+location.search+location.hash);return null}
 window.RENOBVA_AUTH_LOAD_FAILED=false;
 if(admin && profile?.role!=="admin"){location.href="../portal/dashboard.html";return null}
 document.querySelectorAll("[data-user-name]").forEach(x=>x.textContent=profile?.display_name||user.email.split("@")[0]);
 document.querySelectorAll("[data-user-email]").forEach(x=>x.textContent=user.email);
 document.querySelectorAll(".user-chip .avatar").forEach(x=>{
   if(profile?.avatar_url) {try{if(new URL(profile.avatar_url).protocol==='https:'){const img=document.createElement('img');img.src=profile.avatar_url;img.alt='Your profile picture';x.replaceChildren(img);}}catch{}}
   else x.textContent=(profile?.display_name||user.email||"U").trim().charAt(0).toUpperCase();
 });
 if(profile?.role==="admin"){
   document.querySelectorAll("[data-admin-link]").forEach(x=>x.hidden=false);
   document.body.classList.add("is-admin");
 }
 return {user,profile}
}
async function logout(){window.RENOBVA_DRAFTS?.purgeUser();if(sb)await sb.auth.signOut();location.href="../auth/login.html"}
window.toast=toast;window.requireAuth=requireAuth;window.logout=logout;window.currentUser=currentUser;
