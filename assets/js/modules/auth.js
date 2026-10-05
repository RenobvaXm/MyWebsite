
// Do not make an already signed-in client log in again.
(async()=>{
 if(!renobva.configured) return;
 const {data:{session}}=await renobva.sb.auth.getSession();
 if(session && document.querySelector('form[data-auth]')){
   location.replace("../portal/dashboard.html");
 }
})();

const form=document.querySelector("form[data-auth]");
if(form) form.addEventListener("submit",async e=>{
 e.preventDefault();if(!renobva.configured){toast("Add your Supabase URL + anon key first.","warn");return}
 const email=form.email.value.trim(),password=form.password.value;
 const mode=form.dataset.auth;let res;
 if(mode==="login") res=await renobva.sb.auth.signInWithPassword({email,password});
 else {
   const display_name=form.display_name.value.trim();
   res=await renobva.sb.auth.signUp({email,password,options:{data:{display_name}}});
 }
 if(res.error){toast(res.error.message,"error");return}
 if(mode==="register" && !res.data.session){toast("Account created. Check your email to verify it.");setTimeout(()=>location.href="login.html",1400)}
 else {toast("Welcome to RENOBVA.");setTimeout(()=>location.href="../portal/dashboard.html",500)}
});
const reset=document.querySelector("#resetForm");
if(reset)reset.addEventListener("submit",async e=>{
 e.preventDefault();if(!renobva.configured)return toast("Connect Supabase first.","warn");
 const {error}=await renobva.sb.auth.resetPasswordForEmail(reset.email.value,{redirectTo:location.origin+location.pathname.replace("forgot-password.html","reset-password.html")});
 toast(error?error.message:"Password reset email sent.",error?"error":"ok");
});
