// Return only to a safe, same-origin website page after authentication.
const requestedReturn=new URLSearchParams(location.search).get('returnTo');
let afterLogin='../portal/dashboard.html';
if(requestedReturn){try{const u=new URL(requestedReturn,location.origin);if(u.origin===location.origin && u.pathname.startsWith('/pages/') && !u.pathname.includes('/auth/'))afterLogin=u.pathname+u.search}catch{}}
document.querySelectorAll('a[href="login.html"],a[href="register.html"]').forEach(a=>{if(requestedReturn)a.href+='?returnTo='+encodeURIComponent(requestedReturn)});

// Do not make an already signed-in client log in again.
(async()=>{
 if(!renobva.configured) return;
 const {data:{session}}=await renobva.sb.auth.getSession();
 if(session && document.querySelector('form[data-auth]')){
   location.replace(afterLogin);
 }
})();

const form=document.querySelector('form[data-auth]');
function formNotice(target,message){let notice=target.querySelector('[role=status]');if(!notice){notice=document.createElement('p');notice.setAttribute('role','status');target.prepend(notice)}notice.textContent=message}
if(form)form.addEventListener('submit',async e=>{
 e.preventDefault();if(!renobva.configured)return formNotice(form,'The sign-in service is not configured. Contact RENOBVA.');
 const button=form.querySelector('[type=submit]')||form.querySelector('button'),original=button.textContent;if(button.disabled)return;button.disabled=true;button.textContent='Please wait…';
 try{
 const email=form.email.value.trim(),password=form.password.value,mode=form.dataset.auth;
 const res=mode==='login'?await renobva.sb.auth.signInWithPassword({email,password}):await renobva.sb.auth.signUp({email,password,options:{data:{display_name:form.display_name.value.trim()},emailRedirectTo:new URL('login.html'+(requestedReturn?'?returnTo='+encodeURIComponent(requestedReturn):''),location.href).href}});
 if(res.error)throw res.error;
 if(mode==='register'&&!res.data.session){formNotice(form,'Account created. Check your email and verify the account before signing in.');return}
 formNotice(form,'Signed in. Opening your workspace…');location.href=afterLogin;
 }catch(error){formNotice(form,error.message||'Could not sign in. Check your connection and try again.')}finally{button.disabled=false;button.textContent=original}
});
const reset=document.querySelector('#resetForm');
if(reset)reset.addEventListener('submit',async e=>{
 e.preventDefault();const button=reset.querySelector('button');if(button.disabled)return;button.disabled=true;
 try{const {error}=await renobva.sb.auth.resetPasswordForEmail(reset.email.value.trim(),{redirectTo:location.origin+'/pages/auth/reset-password.html'});if(error)throw error;formNotice(reset,'If this email has an account, a reset link will arrive shortly. Check your spam folder too.')}catch(error){formNotice(reset,error.message||'Could not send the reset email. Please try again.')}finally{button.disabled=false}
});
