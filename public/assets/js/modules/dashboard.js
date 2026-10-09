(async () => {
  const ctx=await requireAuth();if(!ctx)return;
  const w=RENOBVA_WORKFLOW,x=RENOBVA_EXPERIENCE,e=x.escape,list=document.querySelector('#projectList'),empty=document.querySelector('#emptyProjects');
  let busy=false,last='',queue='current';
  const spotlight=document.createElement('section');spotlight.className='client-spotlight';document.querySelector('.portal-title').after(spotlight);
  const filters=document.createElement('div');filters.className='client-project-filters';filters.innerHTML='<button class="btn selected" data-client-queue="current">Current projects</button><button class="btn" data-client-queue="archived">Archived</button>';list.before(filters);
  filters.querySelectorAll('button').forEach(b=>b.onclick=()=>{queue=b.dataset.clientQueue;filters.querySelectorAll('button').forEach(x=>x.classList.toggle('selected',x===b));last='';refresh();});
  const tabFor=kind=>({quote:'payments',payment:'payments',review:'feedback',revision:'feedback',delivery:'handover',complete:'handover',chat:'chat',questions:'chat'}[kind]||'overview');
  const totals=payments=>Object.entries(payments.reduce((acc,p)=>{acc[p.currency]=(acc[p.currency]||0)+Number(p.amount);return acc;},{})).map(([currency,amount])=>RENOBVA_TOOLS.money(amount,currency)).join(' + ') || RENOBVA_TOOLS.money(0);
  async function refresh(){if(busy||document.hidden)return;busy=true;
    try{
      const data=await w.load(renobva.sb),all=data.projects.filter(p=>p.user_id===ctx.user.id&&!p.deleted_at),projects=all.filter(p=>RENOBVA_USABILITY.visible(p,queue));
      const signature=JSON.stringify([data,queue]);if(signature===last)return;last=signature;
      const active=all.filter(p=>!p.archived_at&&p.status!=='cancelled'),rank={quote:0,payment:1,review:2,delivery:3,questions:4,revision:5,chat:6,complete:7,closed:8};
      const focus=[...active].sort((a,b)=>(rank[w.next(a,data).kind]??9)-(rank[w.next(b,data).kind]??9))[0];
      const outstanding=data.payment_requests.filter(p=>p.status==='pending'&&active.some(a=>a.id===p.project_id));
      const milestones=data.project_milestones.filter(m=>m.status!=='completed'&&m.due_date&&active.some(a=>a.id===m.project_id)).sort((a,b)=>a.due_date.localeCompare(b.due_date));
      const next=focus&&w.next(focus,data),url=focus&&x.preview(focus,data.project_reviews,data.project_deliveries,data.project_handover);
      spotlight.innerHTML=focus?`<div class="spotlight-copy"><span class="eyebrow">YOUR NEXT STEP</span><h2>${e(next.label)}</h2><p>${e(next.detail)}</p><small>${e(focus.title)}</small><div class="actions"><a class="btn primary" href="${x.projectHref(focus.id,tabFor(next.kind))}">Continue project →</a>${url?`<a class="btn" href="${e(url)}" target="_blank" rel="noopener">Preview website ↗</a>`:''}</div></div><div class="spotlight-summary"><div><span>Awaiting payment</span><strong>${e(totals(outstanding))}</strong><small>Only pending requests · submitted transfers await confirmation</small></div><div><span>Upcoming milestone</span><strong>${e(milestones[0]?.title||'No date scheduled')}</strong><small>${milestones[0]?RENOBVA_TOOLS.date(milestones[0].due_date):'Dates appear once your scope is agreed.'}</small></div></div>`:'<div><span class="eyebrow">READY WHEN YOU ARE</span><h2>Let’s build something great.</h2><p>Send a brief, share your goals, and keep every step in one workspace.</p><a class="btn primary" href="new-project.html">Start a project →</a></div>';
      empty.hidden=!!projects.length;
      list.innerHTML=projects.map(p=>{const n=w.next(p,data),ms=data.project_milestones.filter(m=>m.project_id===p.id),done=ms.filter(m=>m.status==='completed').length,r=x.revisions(p,data.project_quotes,data.project_revision_requests),preview=x.preview(p,data.project_reviews,data.project_deliveries,data.project_handover),payments=data.payment_requests.filter(pay=>pay.project_id===p.id&&pay.status==='pending');
        return `<article class="client-action-card"><div><span class="eyebrow">${e(p.service_type)}</span><span class="workflow-status">${e(p.status)}</span></div><h2>${e(p.title)} <span class="unread-badge" data-project-unread="${p.id}" hidden></span></h2><div class="next-action"><small>YOUR NEXT STEP</small><h3>${e(n.label)}</h3><p>${e(n.detail)}</p><a class="btn primary" href="${x.projectHref(p.id,tabFor(n.kind))}">${n.kind==='closed'?'View history':'Manage project'} →</a>${preview?`<a class="btn" href="${e(preview)}" target="_blank" rel="noopener">Preview ↗</a>`:''}</div>${ms.length?`<div class="dashboard-progress"><small>${done} / ${ms.length} milestones complete</small><progress max="${ms.length}" value="${done}" aria-label="Progress for ${e(p.title)}"></progress></div>`:''}<div class="client-card-facts"><span>Delivery: <b>${r.quote?.delivery_date?RENOBVA_TOOLS.date(r.quote.delivery_date):p.deadline?RENOBVA_TOOLS.date(p.deadline)+' (requested)':'To be agreed'}</b></span>${r.quote?`<span>Revisions left: <b>${r.remaining} / ${r.included}</b></span>`:''}${payments.length?`<span>Awaiting payment: <b>${e(totals(payments))}</b></span>`:''}</div></article>`;
      }).join('');
      document.querySelector('#clientProjectCount').textContent=active.length;
      document.querySelector('#clientActionCount').textContent=active.filter(p=>['quote','review','payment','questions','delivery'].includes(w.next(p,data).kind)).length;
      window.dispatchEvent(new Event('renobva:cards-rendered'));
    }catch{list.querySelector('[data-initial-loading]')?.remove();spotlight.innerHTML='<p role="alert">Could not load your workspace. Your projects are safe.</p><button class="btn" data-home-retry>Retry</button>';spotlight.querySelector('button').onclick=()=>{last='';refresh();};}
    finally{busy=false;list.removeAttribute('aria-busy');}
  }
  window.addEventListener('renobva:retry',()=>{last='';refresh();});await refresh();const timer=setInterval(refresh,5000);window.addEventListener('pagehide',()=>clearInterval(timer));
})();
