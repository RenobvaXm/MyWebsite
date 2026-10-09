(async () => {
  const ctx=await requireAuth();if(!ctx || ctx.profile?.role==='admin')return;
  const button=document.createElement('button');button.className='btn guide-button';button.type='button';button.textContent='Quick portal guide';document.querySelector('.portal-title').appendChild(button);
  const steps=[
    ['Your project, one clear next step','Your home screen shows what needs attention, your upcoming milestone and any pending payment. Open Manage project to see the full workspace.','/pages/portal/dashboard.html','View dashboard'],
    ['Share your ideas and files','Start a project with a brief. Upload logos, photos, text and references in Files. Uploads are private to your project.','/pages/portal/new-project.html','Start a project'],
    ['Keep the conversation together','Use Chat for questions and quick updates. Feedback groups design comments and revision requests into organized rounds.'],
    ['Agree the scope before you pay','Payments contains proposals, the agreed delivery date and included revisions. Accepting a proposal does not charge you. Pay only through a payment request.'],
    ['Review, approve and launch','Handover contains your final delivery. Accept it or request changes, then follow the website instructions and explore ongoing support.','/pages/portal/settings.html','Open your settings']
  ];
  function open(){let index=0;const box=document.createElement('dialog');box.className='portal-guide-dialog';box.setAttribute('aria-label','Client portal guide');document.body.appendChild(box);
    function render(){const s=steps[index];box.innerHTML=`<form method="dialog"><button class="guide-close" aria-label="Close guide" value="close">×</button></form><span class="eyebrow">WELCOME TO YOUR RENOBVA WORKSPACE</span><div class="guide-progress" aria-label="Step ${index+1} of ${steps.length}">${steps.map((_,i)=>`<span class="${i<=index?'active':''}"></span>`).join('')}</div><small>STEP ${index+1} / ${steps.length}</small><h2>${s[0]}</h2><p>${s[1]}</p>${s[2]?`<a href="${s[2]}" class="guide-link">${s[3]} ↗</a>`:''}<p class="guide-error" role="alert"></p><div class="actions"><button class="btn" data-guide-back ${index===0?'disabled':''}>Back</button><button class="btn primary" data-guide-next>${index===steps.length-1?'Got it — open my workspace':'Next →'}</button></div>`;
      box.querySelector('[data-guide-back]').onclick=()=>{index--;render();box.querySelector('h2').tabIndex=-1;box.querySelector('h2').focus();};
      box.querySelector('[data-guide-next]').onclick=async ev=>{if(index<steps.length-1){index++;render();box.querySelector('h2').tabIndex=-1;box.querySelector('h2').focus();return;}ev.currentTarget.disabled=true;const r=await renobva.sb.from('portal_onboarding').upsert({user_id:ctx.user.id,completed_at:new Date().toISOString()});if(r.error){box.querySelector('.guide-error').textContent='Could not save your guide preference. Please retry.';ev.currentTarget.disabled=false;}else box.close();};
    }
    render();box.addEventListener('close',()=>{box.remove();button.focus();});box.showModal();
  }
  button.onclick=open;
  const r=await renobva.sb.from('portal_onboarding').select('completed_at').eq('user_id',ctx.user.id).maybeSingle();
  if(!r.error&&!r.data)open();
})().catch(()=>{});
