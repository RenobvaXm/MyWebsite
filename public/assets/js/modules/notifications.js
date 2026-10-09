/* One signed-in notification bell across the public website and portal. */
(async () => {
  const client = window.renobva?.sb || window.renobvaSiteAuth;
  if(!client)return;
  const {data, error} = await client.auth.getUser();
  if(error || !data.user)return;
  const user=data.user;
  const profile=await client.from('profiles').select('role').eq('id',user.id).maybeSingle();
  const admin=profile.data?.role==='admin', e=RENOBVA_EXPERIENCE.escape;
  const target=document.querySelector('.navin') || document.querySelector('.portal-top') || document.querySelector('.case-header');
  if(!target)return;
  const host=document.createElement('details');host.className='renobva-notification-bell';
  host.innerHTML=`<summary aria-label="Notifications" aria-expanded="false"><svg viewBox="0 0 24 24" width="23" height="23" aria-hidden="true"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg><span class="bell-count" hidden></span></summary><section class="bell-panel" aria-label="Recent notifications"><header><div><span class="eyebrow">YOUR WORKSPACE</span><h2>Notifications</h2></div><button type="button" class="mini-btn" data-read-all>Mark all read</button></header><div data-bell-status role="status">Loading updates…</div><div class="bell-items"></div><footer><a href="/pages/${admin?'admin':'portal'}/dashboard.html">Open dashboard →</a><a href="/pages/portal/settings.html">Preferences</a></footer></section>`;
  const menu=target.querySelector('.menu');menu?menu.before(host):target.appendChild(host);
  const summary=host.querySelector('summary'),count=host.querySelector('.bell-count'),status=host.querySelector('[data-bell-status]');
  let busy=false,rows=[],kinds=['messages','payments','approvals','deliveries'],last='';
  host.addEventListener('toggle',()=>summary.setAttribute('aria-expanded',String(host.open)));
  document.addEventListener('pointerdown',ev=>{if(!host.contains(ev.target))host.open=false;});
  host.addEventListener('keydown',ev=>{if(ev.key==='Escape'){host.open=false;summary.focus();}});
  function draw(total){
    count.hidden=total===0;count.textContent=total>99?'99+':String(total);summary.setAttribute('aria-label',`Notifications, ${total} unread`);
    host.querySelector('[data-read-all]').disabled=total===0;
    host.querySelector('.bell-items').innerHTML=rows.map(n=>`<a class="bell-item ${n.read_at?'':'is-unread'}" data-notification="${n.id}" href="${RENOBVA_EXPERIENCE.projectHref(n.project_id,!admin&&n.label==='Project status: completed'?'handover':n.tab,admin)}"><span class="bell-event-dot" aria-hidden="true"></span><span><strong>${e(!admin&&n.label==='Project status: completed'?'Your project is complete — share your experience':n.label)}</strong><small>${e(n.projects?.title || 'Project update')}</small><time datetime="${n.created_at}">${e(new Date(n.created_at).toLocaleString())}</time>${n.read_at?'':'<span class="sr-only">Unread</span>'}</span><span aria-hidden="true">↗</span></a>`).join('');
    status.textContent=rows.length?'':'You’re all caught up. New updates will appear here.';
    host.querySelectorAll('[data-notification]').forEach(a=>a.addEventListener('click',async ev=>{if(ev.ctrlKey||ev.metaKey||ev.shiftKey||ev.altKey)return;ev.preventDefault();try{await client.from('portal_notifications').update({read_at:new Date().toISOString()}).eq('id',a.dataset.notification).eq('recipient_id',user.id);}finally{location.href=a.href;}}));
  }
  async function refresh(){
    if(busy || document.hidden)return;busy=true;
    try{
      const preference=await client.from('notification_preferences').select('messages,payments,approvals,deliveries').eq('user_id',user.id).maybeSingle();
      if(preference.error)throw preference.error;
      kinds=['messages','payments','approvals','deliveries'].filter(k=>preference.data?.[k]!==false);
      if(!kinds.length){rows=[];draw(0);return;}
      const results=await Promise.all([
        client.from('portal_notifications').select('id,project_id,label,tab,created_at,read_at,projects(title)').eq('recipient_id',user.id).in('kind',kinds).order('created_at',{ascending:false}).limit(40),
        client.from('portal_notifications').select('id',{count:'exact',head:true}).eq('recipient_id',user.id).in('kind',kinds).is('read_at',null)
      ]);
      if(results.some(r=>r.error))throw results.find(r=>r.error).error;
      rows=results[0].data || [];const signature=JSON.stringify([rows,results[1].count]);
      if(signature!==last){last=signature;draw(results[1].count || 0);}else{status.textContent=rows.length?'':'You’re all caught up. New updates will appear here.';}
    }catch{status.innerHTML='Could not load notifications. <button class="mini-btn" data-bell-retry>Retry</button>';status.querySelector('button').onclick=refresh;}
    finally{busy=false;}
  }
  host.querySelector('[data-read-all]').onclick=async ev=>{
    const b=ev.currentTarget;b.disabled=true;
    const r=await client.from('portal_notifications').update({read_at:new Date().toISOString()}).eq('recipient_id',user.id).in('kind',kinds).is('read_at',null);
    if(r.error){status.textContent='Could not mark notifications read. Please retry.';b.disabled=false;}else{last='';await refresh();}
  };
  await refresh();
  const channel=client.channel('navigation-notifications-'+user.id).on('postgres_changes',{event:'*',schema:'public',table:'portal_notifications',filter:'recipient_id=eq.'+user.id},refresh).subscribe();
  const timer=setInterval(refresh,10000);
  window.addEventListener('renobva:retry',refresh);document.addEventListener('visibilitychange',refresh);
  window.addEventListener('focus',refresh);
  const {data:listener}=client.auth.onAuthStateChange(event=>{if(event==='SIGNED_OUT'){host.remove();clearInterval(timer);client.removeChannel(channel);}});
  window.addEventListener('pagehide',()=>{clearInterval(timer);client.removeChannel(channel);listener.subscription.unsubscribe();});
})().catch(()=>{});
