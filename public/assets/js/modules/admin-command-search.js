(async () => {
  if(!location.pathname.includes('/admin/'))return;
  const ctx=await requireAuth(true);if(!ctx)return;
  const sb=renobva.sb,t=RENOBVA_TOOLS,x=RENOBVA_EXPERIENCE,e=x.escape;
  const trigger=document.createElement('button');trigger.className='command-search-trigger';trigger.type='button';trigger.innerHTML='Search everything <kbd>Ctrl K</kbd>';document.querySelector('.portal-top').appendChild(trigger);
  const dialog=document.createElement('dialog');dialog.className='command-search-dialog';dialog.setAttribute('aria-labelledby','commandSearchTitle');dialog.innerHTML='<form method="dialog"><button class="command-close" aria-label="Close search">×</button></form><h2 id="commandSearchTitle">Find anything.</h2><label for="commandSearchQuery">Clients, projects, messages, files or payments</label><input id="commandSearchQuery" type="search" autocomplete="off" placeholder="Type a name, project or keyword…"><p data-command-status role="status">Type at least 2 characters.</p><div class="command-results"></div>';document.body.appendChild(dialog);
  const input=dialog.querySelector('input'),status=dialog.querySelector('[data-command-status]'),box=dialog.querySelector('.command-results');let timer,request=0;
  function open(){dialog.showModal();input.focus();}trigger.onclick=open;dialog.addEventListener('close',()=>trigger.focus());
  document.addEventListener('keydown',ev=>{if((ev.ctrlKey||ev.metaKey)&&ev.key.toLowerCase()==='k'){ev.preventDefault();if(!dialog.open)open();}if(dialog.open&&ev.key==='ArrowDown'&&document.activeElement===input){ev.preventDefault();box.querySelector('a')?.focus();}});
  input.oninput=()=>{clearTimeout(timer);const token=++request;timer=setTimeout(()=>search(token),300);};
  async function search(token){const q=input.value.trim();if(q.length<2){box.replaceChildren();status.textContent='Type at least 2 characters.';return;}status.textContent='Searching…';
    const pattern='%'+q.replace(/[\\%_]/g,'\\$&')+'%';
    try{const results=await Promise.all([
      sb.from('projects').select('id,title,status,deleted_at').ilike('title',pattern).limit(15),
      sb.from('profiles').select('id,display_name,email').ilike('display_name',pattern).limit(15),
      sb.from('profiles').select('id,display_name,email').ilike('email',pattern).limit(15),
      sb.from('messages').select('id,project_id,body').ilike('body',pattern).is('deleted_at',null).order('created_at',{ascending:false}).limit(15),
      sb.from('workspace_files').select('id,project_id,attachment_name').ilike('attachment_name',pattern).limit(15),
      sb.from('payment_requests').select('id,project_id,title,amount,currency,status').ilike('title',pattern).limit(15)
    ]);if(token!==request)return;const [projects,byName,byEmail,messages,files,payments]=results.map(t.check),clients=[...new Map([...byName,...byEmail].map(c=>[c.id,c])).values()];
      const rows=[...projects.map(p=>({type:p.deleted_at?'Project in Trash':'Project',label:p.title,detail:p.status,href:x.projectHref(p.id,'overview',true)})),...clients.map(c=>({type:'Client',label:c.display_name||c.email,detail:c.email||'',href:'/pages/admin/dashboard.html?client='+encodeURIComponent(c.id)})),...messages.map(m=>({type:'Message',label:m.body.slice(0,160),detail:'Project conversation',href:x.projectHref(m.project_id,'chat',true)})),...files.map(f=>({type:'File',label:f.attachment_name,detail:'Shared project files',href:x.projectHref(f.project_id,'files',true)})),...payments.map(p=>({type:'Payment',label:p.title,detail:t.money(p.amount,p.currency)+' · '+p.status,href:x.projectHref(p.project_id,'payments',true)}))];
      box.innerHTML=rows.map(r=>`<a class="command-result" href="${r.href}"><span class="workflow-status">${e(r.type)}</span><span><strong>${e(r.label)}</strong><small>${e(r.detail)}</small></span><span aria-hidden="true">↗</span></a>`).join('');status.textContent=rows.length?`${rows.length} matches. Use Tab to choose a result.`:'No matches. Try another name or keyword.';
    }catch{if(token===request){status.textContent='Could not search. Check your connection and try again.';box.replaceChildren();}}
  }
  window.addEventListener('pagehide',()=>clearTimeout(timer));
})().catch(()=>{});
