/* Public account navigation uses the same persisted Supabase session as the portal. */
(async () => {
  const cfg=window.RENOBVA_SUPABASE || {};
  if(!window.supabase || !cfg.url || !cfg.anonKey || cfg.url.includes('YOUR_'))return;
  const client=window.renobva?.sb || window.supabase.createClient(cfg.url,cfg.anonKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
  window.renobvaSiteAuth=client;
  const {data,error}=await client.auth.getUser();if(error || !data.user)return;
  const user=data.user,{data:profile}=await client.from('profiles').select('display_name,avatar_url,role').eq('id',user.id).maybeSingle();
  for(const link of document.querySelectorAll('[data-client-portal]')){
    const account=document.createElement('details');account.className='site-account';
    account.innerHTML='<summary><span class="site-avatar"></span><span class="site-account-name"></span><span aria-hidden="true">⌄</span></summary><div class="site-account-menu"><a href="/pages/portal/dashboard.html">Client portal</a><a href="/pages/portal/settings.html">Profile & settings</a><button type="button">Sign out</button></div>';
    account.querySelector('.site-account-name').textContent=profile?.display_name || user.email?.split('@')[0] || 'Account';
    const avatar=account.querySelector('.site-avatar');avatar.textContent=(profile?.display_name || user.email || 'R').charAt(0).toUpperCase();
    try{if(profile?.avatar_url && new URL(profile.avatar_url).protocol==='https:'){const img=document.createElement('img');img.src=profile.avatar_url;img.alt='Your profile picture';avatar.replaceChildren(img);}}catch{}
    if(profile?.role==='admin'){const a=document.createElement('a');a.href='/pages/admin/dashboard.html';a.textContent='Admin dashboard';account.querySelector('button').before(a);}
    const summary=account.querySelector('summary');summary.setAttribute('aria-expanded','false');account.addEventListener('toggle',()=>summary.setAttribute('aria-expanded',String(account.open)));
    account.onkeydown=ev=>{if(ev.key==='Escape'){account.open=false;summary.focus();}};
    account.addEventListener('pointerenter',()=>{if(matchMedia('(hover:hover)').matches)account.open=true;});
    account.addEventListener('pointerleave',()=>{if(!account.contains(document.activeElement))account.open=false;});
    document.addEventListener('pointerdown',ev=>{if(!account.contains(ev.target))account.open=false;});
    account.querySelector('button').onclick=async()=>{window.RENOBVA_DRAFTS?.purgeUser();try{for(let i=localStorage.length-1;i>=0;i--){const key=localStorage.key(i);if(key?.startsWith('renobva.formdraft.v2.'+user.id+'.'))localStorage.removeItem(key);}}catch{}await client.auth.signOut();location.href='/pages/auth/login.html';};
    link.replaceWith(account);
  }
})().catch(()=>{});
