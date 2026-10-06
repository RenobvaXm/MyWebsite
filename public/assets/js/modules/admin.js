/* Admin workspace. Authorization remains enforced by the protected profile role and RLS. */
let ADMIN_PROJECTS=[], ADMIN_CLIENTS=[], adminQueue='all', adminPage=1;
const esc=s=>(s??'').toString().replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
const statuses=['new','questions','in progress','review','completed','cancelled'];
const closed=p=>['completed','cancelled'].includes(p.status);
const attention=p=>['new','questions','review'].includes(p.status);
const dateLabel=value=>value?new Date(value.slice(0,10)+'T12:00:00').toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'}):'Flexible';
(async()=>{
 if(!await requireAuth(true))return;
 for(const id of ['adminSearch','adminFilter','adminSort'])document.getElementById(id).addEventListener(id==='adminSearch'?'input':'change',()=>{adminPage=1;renderAdmin()});
 document.querySelectorAll('[data-queue]').forEach(b=>b.onclick=()=>{adminQueue=b.dataset.queue;adminPage=1;document.querySelectorAll('[data-queue]').forEach(x=>x.classList.toggle('selected',x===b));renderAdmin()});
 document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>{document.querySelectorAll('[data-view]').forEach(x=>x.classList.toggle('selected',x===b));document.querySelector('#projectInbox').hidden=b.dataset.view!=='projects';document.querySelector('#clientDirectory').hidden=b.dataset.view!=='clients'});
 document.querySelector('#clientSearch').oninput=renderClients;
 document.querySelector('#adminPrev').onclick=()=>{adminPage--;renderAdmin()};document.querySelector('#adminNext').onclick=()=>{adminPage++;renderAdmin()};
 document.querySelector('#adminRefresh').onclick=refreshAdmin;
 await refreshAdmin();
})();
async function refreshAdmin(){
 const button=document.querySelector('#adminRefresh');button.disabled=true;button.textContent='Refreshing…';
 try{
 const [projects,profiles]=await Promise.all([renobva.sb.from('projects').select('*,profiles(display_name,email)').order('created_at',{ascending:false}),renobva.sb.from('profiles').select('*').order('created_at',{ascending:false})]);
 if(projects.error||profiles.error)throw projects.error||profiles.error;
 ADMIN_PROJECTS=projects.data||[];ADMIN_CLIENTS=(profiles.data||[]).filter(x=>x.role==='client');updateCounts();renderAdmin();renderClients();
 }catch(error){toast(error.message,'error');document.querySelector('#adminResultCount').textContent='Could not refresh. Please try again.'}
 finally{button.disabled=false;button.textContent='↻ Refresh'}
}
function updateCounts(){document.querySelector('#countProjects').textContent=ADMIN_PROJECTS.length;document.querySelector('#countClients').textContent=ADMIN_CLIENTS.length;document.querySelector('#countActive').textContent=ADMIN_PROJECTS.filter(p=>!closed(p)).length;document.querySelector('#attentionCount').textContent=ADMIN_PROJECTS.filter(attention).length}
function filteredProjects(){
 const q=document.querySelector('#adminSearch').value.trim().toLowerCase(),status=document.querySelector('#adminFilter').value,sort=document.querySelector('#adminSort').value;
 return ADMIN_PROJECTS.filter(p=>[p.title,p.service_type,p.profiles?.display_name,p.profiles?.email,p.brief].join(' ').toLowerCase().includes(q)&&(status==='all'||p.status===status)&&(adminQueue==='all'||adminQueue==='attention'&&attention(p)||adminQueue==='active'&&p.status==='in progress'||adminQueue==='closed'&&closed(p))).sort((a,b)=>sort==='name'?a.title.localeCompare(b.title):sort==='deadline'?(a.deadline||'9999').localeCompare(b.deadline||'9999'):sort==='oldest'?a.created_at.localeCompare(b.created_at):b.created_at.localeCompare(a.created_at));
}
function renderAdmin(){
 const rows=filteredProjects(),pages=Math.max(1,Math.ceil(rows.length/9));adminPage=Math.min(Math.max(1,adminPage),pages);
 document.querySelector('#adminResultCount').textContent=rows.length+' project'+(rows.length===1?'':'s')+' · '+(adminQueue==='attention'?'New requests, questions & reviews':adminQueue==='closed'?'Completed & cancelled':adminQueue==='active'?'Currently in progress':'Project inbox');
 document.querySelector('#adminPage').textContent='Page '+adminPage+' of '+pages;document.querySelector('#adminPrev').disabled=adminPage===1;document.querySelector('#adminNext').disabled=adminPage===pages;
 document.querySelector('#adminProjects').innerHTML=rows.length?rows.slice((adminPage-1)*9,adminPage*9).map(p=>`<article class="admin-project-card"><div class="admin-card-top"><span>${esc(p.service_type)}</span><span class="admin-status ${esc(p.status.replaceAll(' ','-'))}">${esc(p.status)}</span></div><h3>${esc(p.title)}</h3><div class="admin-client-line">${esc(p.profiles?.display_name||'Client')} · ${esc(p.profiles?.email||'')}</div><p class="admin-card-brief">${esc(p.brief||'Open the brief to review project requirements.')}</p><div class="admin-card-meta"><div><small>Estimated budget</small>${esc(p.budget||'Not specified')}</div><div><small>Preferred deadline</small>${esc(dateLabel(p.deadline))}</div></div><div class="admin-card-footer"><button class="mini-btn" data-brief="${p.id}">View brief & files</button><a class="mini-btn" href="admin-chat.html?id=${p.id}">Open chat ↗</a><select aria-label="Status for ${esc(p.title)}" data-status="${p.id}">${statuses.map(v=>`<option ${v===p.status?'selected':''}>${v}</option>`).join('')}</select><details class="admin-more"><summary>More ⋯</summary><button data-delete="${p.id}">Delete project</button></details></div></article>`).join(''):'<div class="admin-empty"><h3>No matching projects</h3><p>Try another search or queue, or refresh to load new requests.</p></div>';
 document.querySelectorAll('[data-brief]').forEach(b=>b.onclick=()=>openAdminBrief(b.dataset.brief));
 document.querySelectorAll('[data-status]').forEach(s=>s.onchange=async()=>{const p=ADMIN_PROJECTS.find(x=>x.id===s.dataset.status),old=p.status,next=s.value;s.disabled=true;const {data,error}=await renobva.sb.from('projects').update({status:next,updated_at:new Date().toISOString()}).eq('id',p.id).select('id').single();if(error||!data){s.value=old;s.disabled=false;return toast(error?.message||'The project could not be updated. Refresh and try again.','error')}p.status=next;updateCounts();renderAdmin();toast('Project status updated.')});
 document.querySelectorAll('[data-delete]').forEach(b=>b.onclick=async()=>{const p=ADMIN_PROJECTS.find(x=>x.id===b.dataset.delete);if(!confirm('Permanently delete "'+p.title+'" and its conversation? This cannot be undone.'))return;b.disabled=true;const {data,error}=await renobva.sb.from('projects').delete().eq('id',p.id).select('id').single();if(error||!data){b.disabled=false;return toast(error?.message||'Could not delete project.','error')}ADMIN_PROJECTS=ADMIN_PROJECTS.filter(x=>x.id!==p.id);updateCounts();renderAdmin();renderClients();toast('Project deleted.')});
}
function renderClients(){
 const q=document.querySelector('#clientSearch').value.toLowerCase();const clients=ADMIN_CLIENTS.filter(p=>[p.display_name,p.email].join(' ').toLowerCase().includes(q));
 document.querySelector('#adminClients').innerHTML=clients.length?clients.map(c=>{const projects=ADMIN_PROJECTS.filter(p=>p.user_id===c.id);return `<article class="admin-client-card"><div class="admin-client-avatar">${esc((c.display_name||c.email||'C').charAt(0).toUpperCase())}</div><h3>${esc(c.display_name||'Client')}</h3><p>${esc(c.email||'No email')}</p><p>${projects.length} projects · ${projects.filter(p=>!closed(p)).length} active</p><button class="btn" data-client-projects="${c.id}">View projects →</button></article>`}).join(''):'<div class="admin-empty">No matching clients.</div>';
 document.querySelectorAll('[data-client-projects]').forEach(b=>b.onclick=()=>{const c=ADMIN_CLIENTS.find(x=>x.id===b.dataset.clientProjects);document.querySelector('[data-view=projects]').click();document.querySelector('[data-queue=all]').click();document.querySelector('#adminFilter').value='all';document.querySelector('#adminSearch').value=c.email||c.display_name||'';adminPage=1;renderAdmin()});
}

async function openAdminBrief(id) {
 const p=ADMIN_PROJECTS.find(x=>x.id===id);if(!p)return;
 document.querySelector('#adminBriefDialog')?.remove();
 const dialog=document.createElement('dialog');dialog.id='adminBriefDialog';dialog.className='brief-dialog';
 const rows=[['Client',p.profiles?.display_name],['Email',p.profiles?.email],['Service',p.service_type],['Budget',p.budget],['Deadline',p.deadline||'Flexible'],['Status',p.status],['Project idea',p.brief],...Object.entries(p.answers||{})];
 dialog.innerHTML=`<button type="button" class="brief-close">Close ×</button><span class="eyebrow">CLIENT BRIEF</span><h2>${esc(p.title)}</h2><dl class="brief-review">${rows.map(([k,v])=>`<div><dt>${esc(k)}</dt><dd>${esc(typeof v==='object'?JSON.stringify(v):v||'Not specified')}</dd></div>`).join('')}</dl><h3>Project files</h3><div id="adminBriefFiles">Loading attachments…</div><p><a class="btn primary" href="admin-chat.html?id=${p.id}">Open conversation →</a></p>`;
 document.body.appendChild(dialog);dialog.querySelector('.brief-close').onclick=()=>dialog.close();dialog.addEventListener('close',()=>dialog.remove());dialog.showModal();
 const {data,error}=await renobva.sb.from('messages').select('attachment_path,attachment_name,attachment_size,attachment_type').eq('project_id',id).not('attachment_path','is',null).is('deleted_at',null).order('created_at');
 const box=dialog.querySelector('#adminBriefFiles');if(error){box.textContent='Could not load attachments. Try opening the conversation.';return}
 box.textContent=data?.length?'':'No files attached yet.';
 if(data?.length){const button=document.createElement('button');button.className='btn';button.textContent='↓ Download all ZIP';button.onclick=async()=>{button.disabled=true;try{await RENOBVA_FILES.all(renobva.sb,data,id,p.title,(i,n)=>button.textContent=`Preparing ${i}/${n}…`)}catch(error){toast(error.message||'Download failed','error')}finally{button.disabled=false;button.textContent='↓ Download all ZIP'}};box.appendChild(button)}
 for(const file of data||[]) {
  const card=document.createElement('div');card.className='brief-file';const name=document.createElement('span');name.textContent=(file.attachment_name||'Attachment')+' · '+((file.attachment_size||0)/1024/1024).toFixed(2)+' MB';card.appendChild(name);
  const button=document.createElement('button');button.type='button';button.textContent='↓ Download';button.onclick=async()=>{button.disabled=true;button.textContent='Downloading…';try{await RENOBVA_FILES.one(renobva.sb,file,id)}catch(error){toast(error.message||'Download failed','error')}finally{button.disabled=false;button.textContent='↓ Download'}};card.appendChild(button);box.appendChild(card);
 }
}
