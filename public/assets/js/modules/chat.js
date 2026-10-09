
let projectId=new URLSearchParams(location.search).get("id"),ctx,channel,projectData,refreshTimer,refreshBusy=false;
const esc=s=>(s??"").toString().replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
const seen=new Set(), bucket="project-files", profileCache=new Map();
let allMessages=[], replyTarget=null;
const fmtDay=d=>{const x=new Date(d),now=new Date(),y=new Date(now);y.setDate(now.getDate()-1);const same=a=>a.toDateString()===x.toDateString();return same(now)?"Today":same(y)?"Yesterday":x.toLocaleDateString([],{month:"short",day:"numeric",year:x.getFullYear()!==now.getFullYear()?"numeric":undefined})};

async function getProfile(userId){
 if(profileCache.has(userId))return profileCache.get(userId);
 const {data}=await renobva.sb.rpc("chat_profile",{p_project:projectId,p_user:userId});
 let p=data?.[0];
 if(!p && userId!==ctx?.user?.id && projectData?.user_id===ctx?.user?.id){
   const a=window.RENOBVA_ADMIN_PROFILE||{};
   p={id:userId,display_name:a.name||"Renobva",role:"admin",avatar_url:a.avatarUrl||null};
 }
 p=p||{id:userId,display_name:"User",role:"client",avatar_url:null};
 profileCache.set(userId,p);return p;
}
async function hydrateMessage(m){
 if(!m.profiles)m.profiles=await getProfile(m.sender_id);
 return m;
}
function initials(name="U"){return name.trim().split(/\s+/).slice(0,2).map(x=>x[0]?.toUpperCase()).join("")||"U"}
function avatar(profile){
 const n=profile?.display_name||"User";
 return profile?.avatar_url?`<img class="chat-avatar" src="${esc(profile.avatar_url)}" alt="">`:`<span class="chat-avatar fallback">${initials(n)}</span>`;
}
function adminBadge(profile){return profile?.role==="admin"?`<span class="admin-badge" title="RENOBVA administrator">◆ ADMIN</span>`:""}
async function signedUrl(path){if(!path)return null;const {data}=await renobva.sb.storage.from(bucket).createSignedUrl(path,3600);return data?.signedUrl||null}
async function attachmentHtml(m){
 if(!m.attachment_path)return '';
 return `<details class="download-item"><summary>▤ ${esc(m.attachment_name||'Attachment')} <small>${formatBytes(m.attachment_size)}</small></summary><div class="download-actions"><button type="button" data-download-file="${m.id}">↓ Download${m.attachment_type==='application/x-renobva-folder'?' folder ZIP':''}</button></div></details>`;
}
function formatBytes(n){if(!n)return "File";if(n<1024)return n+" B";if(n<1048576)return (n/1024).toFixed(1)+" KB";return (n/1048576).toFixed(1)+" MB"}
async function bubble(m){
 if(m.body==="Project brief attachment" && m.attachment_path && !m.deleted_at)return "";
 let mine=m.sender_id===ctx.user.id,p=m.profiles||{},name=p.display_name||(p.role==="admin"?"RENOBVA":"Client");
 if(m.deleted_at)return `<div class="message ${mine?"mine":""}" data-message-id="${m.id}"><div class="message-person">${avatar(p)}<div class="message-stack"><div class="message-meta"><b>${mine?"You":esc(name)}</b>${adminBadge(p)}<span>${new Date(m.created_at).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})}</span></div><div class="bubble deleted-message">Message removed</div></div></div></div>`;
 let reply="";
 if(m.reply_to){const r=allMessages.find(x=>x.id===m.reply_to);if(r)reply=`<button class="reply-preview" type="button" data-jump="${r.id}"><b>${r.sender_id===ctx.user.id?"You":"Reply"}</b><span>${esc(r.body||r.attachment_name||"Attachment")}</span></button>`}
 return `<div class="message ${mine?"mine":""}" data-message-id="${m.id}">
   <div class="message-person">${avatar(p)}<div class="message-stack">
    <div class="message-meta"><b>${mine?"You":esc(name)}</b>${adminBadge(p)}<span>${new Date(m.created_at).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})}${m.edited_at?" · edited":""}</span></div>
    ${reply}<div class="bubble ${m.body?"":"attachment-only"}">${m.body?esc(m.body):""}${await attachmentHtml(m)}</div>
    <div class="message-actions">${mine?`<small class="message-read-state" data-message-read="${m.id}">✓ Sent</small>`:''}<button type="button" data-reply="${m.id}">↩ Reply</button>${mine&&m.body?`<button type="button" data-edit="${m.id}">✎ Edit</button>`:""}${mine?`<button type="button" data-delete-message="${m.id}">Delete</button>`:""}</div>
   </div></div></div>`;
}
function isClosedStatus(status){return ["completed","cancelled"].includes((status||"").toLowerCase())}
function updateChatLock(status){
 const locked=isClosedStatus(status)||!!projectData?.archived_at||!!projectData?.deleted_at,form=document.querySelector("#chatForm");
 if(!form)return;
 form.classList.toggle("chat-locked",locked);
 const input=form.querySelector('[name="message"]'),send=form.querySelector('button[type="submit"]'),attach=document.querySelector("#attachMenuButton");
 if(input){input.disabled=locked;input.placeholder=locked?(status==="completed"?"This project is finished. The conversation is read-only.":"This project is closed or archived. The conversation is read-only."):"Write a message..."}
 if(send){send.disabled=locked;send.textContent=locked?"Closed":"Send"}
 if(attach)attach.disabled=locked;
 if(locked){
   document.querySelector("#uploadMenu")?.setAttribute("hidden","");
   const banner=document.querySelector("#closedChatBanner")||document.createElement("div");
   banner.id="closedChatBanner";banner.className="closed-chat-banner";
   banner.innerHTML=`<span>✓</span><div><b>${status==="completed"?"Project completed":"Ticket closed"}</b><small>This conversation is saved and can still be viewed, but new messages and uploads are disabled.</small></div>`;
   if(!banner.parentNode)form.parentNode.insertBefore(banner,form);
 }else document.querySelector("#closedChatBanner")?.remove();
}

async function load(){
 ctx=await requireAuth(location.pathname.includes("/admin/"));if(!ctx||!projectId)return;
 const {data:p,error}=await renobva.sb.from("projects").select("*").eq("id",projectId).single();
 if(error||!p){toast("Project not found.","error");return} projectData=p;window.RENOBVA_PROJECT_STATE=p;window.dispatchEvent(new Event('renobva:project-state'));
 renderProjectDetails(p);
 document.querySelector("#projectTitle").textContent=p.title;document.querySelector("#projectService").textContent=p.service_type;setStatus(p.status);updateChatLock(p.status);
 const isAdmin=ctx.profile?.role==="admin";
 const adminControls=document.querySelector("#adminProjectControls");
 if(adminControls){adminControls.hidden=!isAdmin;if(isAdmin)adminControls.querySelector("#projectStatusSelect").value=p.status}
 const clientControls=document.querySelector("#clientTicketControls");
 if(clientControls)clientControls.hidden=isAdmin||!!p.archived_at||!!p.deleted_at||["cancelled","completed"].includes(p.status);
 const {data:msgs}=await renobva.sb.from("messages").select("*").eq("project_id",projectId).order("created_at");
 await Promise.all((msgs||[]).map(hydrateMessage));await render(msgs||[]);
 refreshTimer=setInterval(refreshConversation,5000);
 channel=renobva.sb.channel("renobva-chat-"+projectId+"-"+ctx.user.id)
 .on("postgres_changes",{event:"INSERT",schema:"public",table:"messages",filter:`project_id=eq.${projectId}`},async payload=>{
   if(seen.has(payload.new.id))return;
   const {data:m}=await renobva.sb.from("messages").select("*").eq("id",payload.new.id).single();if(m){await hydrateMessage(m);await append(m)};
 }).on("postgres_changes",{event:"UPDATE",schema:"public",table:"messages",filter:`project_id=eq.${projectId}`},async payload=>{
   const i=allMessages.findIndex(x=>x.id===payload.new.id);if(i>=0){payload.new.profiles=allMessages[i].profiles;allMessages[i]=payload.new;await render(allMessages)}
 }).on("postgres_changes",{event:"UPDATE",schema:"public",table:"projects",filter:`id=eq.${projectId}`},payload=>{
   projectData=payload.new;window.RENOBVA_PROJECT_STATE=projectData;window.dispatchEvent(new Event('renobva:project-state'));setStatus(payload.new.status);updateChatLock(payload.new.status);
 }).subscribe(status=>{let d=document.querySelector(".dot");if(d)d.dataset.realtime=status==="SUBSCRIBED"?"online":"connecting"});
}
function setStatus(s){window.renderProjectTimeline?.(s);const x=document.querySelector("#projectStatus");if(x)x.textContent=s;const sel=document.querySelector("#projectStatusSelect");if(sel)sel.value=s}

function bindMessageActions(){
 bindFileDownloads();renderProjectFiles();
 document.querySelectorAll("[data-reply]").forEach(b=>b.onclick=()=>{replyTarget=allMessages.find(x=>x.id===b.dataset.reply);showReply()});
 document.querySelectorAll("[data-edit]").forEach(b=>b.onclick=async()=>{const m=allMessages.find(x=>x.id===b.dataset.edit),v=prompt("Edit message",m?.body||"");if(v===null||!v.trim())return;const {error}=await renobva.sb.from("messages").update({body:v.trim(),edited_at:new Date().toISOString()}).eq("id",m.id);if(error)toast(error.message,"error")});
 document.querySelectorAll("[data-delete-message]").forEach(b=>b.onclick=async()=>{if(!confirm("Remove this message?"))return;const {error}=await renobva.sb.from("messages").update({body:"",attachment_path:null,attachment_name:null,attachment_type:null,attachment_size:null,deleted_at:new Date().toISOString()}).eq("id",b.dataset.deleteMessage);if(error)toast(error.message,"error")});
 document.querySelectorAll("[data-jump]").forEach(b=>b.onclick=()=>{const el=document.querySelector(`[data-message-id="${b.dataset.jump}"]`);el?.scrollIntoView({behavior:"smooth",block:"center"});el?.classList.add("message-flash");setTimeout(()=>el?.classList.remove("message-flash"),1200)});
}
function showReply(){
 let box=document.querySelector("#replyComposer");if(!box){box=document.createElement("div");box.id="replyComposer";box.className="reply-composer";document.querySelector("#chatForm").prepend(box)}
 box.innerHTML=`<span><b>Replying</b>${esc(replyTarget?.body||replyTarget?.attachment_name||"Attachment")}</span><button type="button" id="cancelReply">×</button>`;box.hidden=false;document.querySelector("#cancelReply").onclick=clearReply;document.querySelector('#chatForm [name="message"]').focus()
}
function clearReply(){replyTarget=null;const b=document.querySelector("#replyComposer");if(b)b.hidden=true}
const searchBox=document.querySelector("#chatSearch"),searchInput=document.querySelector("#chatSearchInput");
document.querySelector("#chatSearchToggle")?.addEventListener("click",()=>{searchBox.hidden=!searchBox.hidden;if(!searchBox.hidden)searchInput.focus()});
document.querySelector("#chatSearchClose")?.addEventListener("click",()=>{searchBox.hidden=true;searchInput.value="";filterMessages("")});
searchInput?.addEventListener("input",e=>filterMessages(e.target.value));
function filterMessages(q){q=q.toLowerCase().trim();document.querySelectorAll("#messages .message").forEach(el=>{const m=allMessages.find(x=>x.id===el.dataset.messageId);el.hidden=!!q&&!`${m?.body||""} ${m?.attachment_name||""}`.toLowerCase().includes(q)})}
document.querySelector("#chatInfoToggle")?.addEventListener("click",()=>toast(`Project: ${projectData?.title||""} • Status: ${projectData?.status||""}`));

async function render(ms){seen.clear();allMessages=ms;let html=[],lastDay="";for(const m of ms){seen.add(m.id);if(m.body==="Project brief attachment"&&m.attachment_path&&!m.deleted_at)continue;const day=fmtDay(m.created_at);if(day!==lastDay){html.push(`<div class="day-divider"><span>${day}</span></div>`);lastDay=day}html.push(await bubble(m))}document.querySelector("#messages").innerHTML=html.join("")||`<div class="chat-empty"><span>✦</span><h3>Your conversation starts here.</h3><p>Share a question, an idea, or feedback.<br>Your project files are available above.</p></div>`;bindMessageActions();renderProjectFiles();bindFileDownloads();scrollChat();window.dispatchEvent(new Event('renobva:messages-rendered'))}
async function append(m){if(!m||seen.has(m.id))return;seen.add(m.id);allMessages.push(m);document.querySelector(".chat-empty")?.remove();document.querySelector("#messages").insertAdjacentHTML("beforeend",await bubble(m));bindMessageActions();renderProjectFiles();bindFileDownloads();scrollChat();window.dispatchEvent(new Event('renobva:messages-rendered'))}
let followLatest=true;
const messageArea=document.querySelector('#messages');
messageArea.addEventListener('scroll',()=>{followLatest=messageArea.scrollHeight-messageArea.scrollTop-messageArea.clientHeight<100});
function scrollChat(){if(followLatest){messageArea.scrollTop=messageArea.scrollHeight}else{let button=document.querySelector('#chatLatest');if(!button){button=document.createElement('button');button.id='chatLatest';button.type='button';button.className='chat-latest';button.textContent='↓ Latest messages';messageArea.parentNode.insertBefore(button,messageArea.nextSibling);button.onclick=()=>{followLatest=true;messageArea.scrollTop=messageArea.scrollHeight;button.remove()}}}}
window.RENOBVA_CHAT_SCROLL=scrollChat;const composer=document.querySelector('#chatForm [name="message"]');
composer.addEventListener('input',()=>{composer.style.height='auto';composer.style.height=Math.min(composer.scrollHeight,150)+'px'});
composer.addEventListener('keydown',event=>{if(event.key==='Enter'&&!event.shiftKey&&!event.isComposing&&matchMedia('(pointer:fine)').matches){event.preventDefault();if(!document.querySelector('#chatForm button[type=submit]').disabled)document.querySelector('#chatForm').requestSubmit()}});



let pendingFiles=[];
let pendingFolders=new Map();
const uploadMenu=document.querySelector("#uploadMenu"), queueEl=document.querySelector("#uploadQueue");
const attachBtn=document.querySelector("#attachMenuButton");
const pickers={image:document.querySelector("#chatImage"),file:document.querySelector("#chatDocument"),folder:document.querySelector("#chatFolder")};
attachBtn?.addEventListener("click",e=>{e.stopPropagation();uploadMenu.hidden=!uploadMenu.hidden});
document.addEventListener("click",e=>{if(uploadMenu&&!uploadMenu.hidden&&!uploadMenu.contains(e.target)&&e.target!==attachBtn)uploadMenu.hidden=true});
document.querySelectorAll("[data-picker]").forEach(b=>b.addEventListener("click",()=>{uploadMenu.hidden=true;pickers[b.dataset.picker]?.click()}));
Object.values(pickers).forEach(i=>i?.addEventListener("change",()=>{addFiles([...i.files]);i.value=""}));

function addFiles(files){
 const allowed=files.filter(f=>f.size<=15*1024*1024);
 if(allowed.length!==files.length)toast("Some files were over the 15 MB limit.","warn");
 for(const f of allowed){
   const rel=f.webkitRelativePath||"";
   const parts=rel.split("/").filter(Boolean);
   if(parts.length>1){
     const folder=parts[0];
     if(!pendingFolders.has(folder))pendingFolders.set(folder,[]);
     const key=rel+"-"+f.size+"-"+f.lastModified;
     if(!pendingFolders.get(folder).some(x=>x.key===key))pendingFolders.get(folder).push({file:f,key,relativePath:rel,progress:0,state:"ready"});
   }else{
     const key=f.name+"-"+f.size+"-"+f.lastModified;
     if(!pendingFiles.some(x=>x.key===key))pendingFiles.push({file:f,key,progress:0,state:"ready"});
   }
 }
 renderQueue();
}
function renderQueue(){
 if(!queueEl)return;
 const folders=[...pendingFolders.entries()];
 queueEl.hidden=!pendingFiles.length&&!folders.length;
 const folderHtml=folders.map(([name,items])=>{
   const total=items.reduce((n,x)=>n+x.file.size,0),done=items.filter(x=>x.state==="done").length;
   const progress=items.length?Math.round(items.reduce((n,x)=>n+x.progress,0)/items.length):0;
   return `<div class="upload-item folder-upload">
    <div class="upload-thumb folder-thumb">▰</div>
    <div class="upload-info"><b>${esc(name)}</b><small>${items.length} item${items.length===1?"":"s"} • ${formatBytes(total)}${progress?` • ${progress}%`:""}</small><div class="upload-progress"><i style="width:${progress}%"></i></div>
    <div class="folder-tree">${items.slice(0,4).map(x=>`<span>└ ${esc(x.relativePath.split("/").slice(1).join("/"))}</span>`).join("")}${items.length>4?`<span>+ ${items.length-4} more</span>`:""}</div></div>
    <button type="button" class="remove-upload" data-remove-folder="${esc(name)}">×</button>
   </div>`;
 }).join("");
 const filesHtml=pendingFiles.map((x,i)=>{
   const f=x.file,img=f.type.startsWith("image/"),label=esc(f.name);
   return `<div class="upload-item ${x.state}" data-upload-index="${i}">
    <div class="upload-thumb">${img?`<img src="${URL.createObjectURL(f)}" alt="">`:`<span>${fileKind(f.name)}</span>`}</div>
    <div class="upload-info"><b title="${label}">${label}</b><small>${formatBytes(f.size)}${x.state==="uploading"?" • Uploading…":x.state==="done"?" • Ready":""}</small><div class="upload-progress"><i style="width:${x.progress}%"></i></div></div>
    <button type="button" class="remove-upload" data-remove-upload="${i}">×</button></div>`;
 }).join("");
 queueEl.innerHTML=folderHtml+filesHtml;
 document.querySelectorAll("[data-remove-upload]").forEach(b=>b.onclick=()=>{pendingFiles.splice(+b.dataset.removeUpload,1);renderQueue()});
 document.querySelectorAll("[data-remove-folder]").forEach(b=>b.onclick=()=>{pendingFolders.delete(b.dataset.removeFolder);renderQueue()});
}
function fileKind(name){let e=(name.split(".").pop()||"FILE").toUpperCase();return e.length>5?"FILE":e}
function pathFor(file){const rel=(file.webkitRelativePath||file.name).replace(/[^a-zA-Z0-9._/-]/g,"_");return `${projectId}/${Date.now()}-${crypto.randomUUID()}/${rel}`}

let dragDepth=0;
const chatShell=document.querySelector(".chat-shell")||document.querySelector(".chat-card")||document.querySelector("#messages")?.parentElement;
const dz=document.querySelector("#chatDropzone");
["dragenter","dragover"].forEach(ev=>document.addEventListener(ev,e=>{e.preventDefault();if(ev==="dragenter")dragDepth++;if(dz)dz.hidden=false;chatShell?.classList.add("drag-active")}));
document.addEventListener("dragleave",e=>{e.preventDefault();dragDepth=Math.max(0,dragDepth-1);if(!dragDepth){if(dz)dz.hidden=true;chatShell?.classList.remove("drag-active")}});
document.addEventListener("drop",async e=>{e.preventDefault();dragDepth=0;if(dz)dz.hidden=true;chatShell?.classList.remove("drag-active");const files=await filesFromDrop(e.dataTransfer);addFiles(files)});

async function filesFromDrop(dt){
 const items=[...(dt.items||[])],out=[];
 async function walk(entry,path=""){
   if(entry.isFile)await new Promise(res=>entry.file(f=>{try{Object.defineProperty(f,"webkitRelativePath",{value:path+f.name})}catch{}out.push(f);res()}));
   else if(entry.isDirectory){const reader=entry.createReader();let batch;do{batch=await new Promise(res=>reader.readEntries(res));for(const child of batch)await walk(child,path+entry.name+"/")}while(batch.length)}
 }
 const entries=items.map(i=>i.webkitGetAsEntry?.()).filter(Boolean);
 if(entries.length){for(const e of entries)await walk(e);return out}
 return [...(dt.files||[])];
}

async function uploadFolderBundle(folderName,items){
 const bundleId=Date.now()+"-"+crypto.randomUUID();
 for(let i=0;i<items.length;i++){
   const item=items[i],f=item.file,sub=item.relativePath.split("/").slice(1).join("/").replace(/[^a-zA-Z0-9._/-]/g,"_");
   item.state="uploading";item.progress=20;renderQueue();
   const path=`${projectId}/folders/${bundleId}/${folderName.replace(/[^a-zA-Z0-9._-]/g,"_")}/${sub}`;
   const {error}=await renobva.sb.storage.from(bucket).upload(path,f,{contentType:f.type||"application/octet-stream"});
   if(error)throw error;item.progress=100;item.state="done";item.storagePath=path;renderQueue();
 }
 const manifest=items.map(x=>({name:x.file.name,path:x.relativePath,storagePath:x.storagePath,size:x.file.size,type:x.file.type}));
 const blob=new Blob([JSON.stringify({folder:folderName,files:manifest},null,2)],{type:"application/json"});
 const manifestPath=`${projectId}/folders/${bundleId}/__renobva_folder_manifest.json`;
 const {error:me}=await renobva.sb.storage.from(bucket).upload(manifestPath,blob,{contentType:"application/json"});if(me)throw me;
 const {data:m,error}=await renobva.sb.from("messages").insert({
   project_id:projectId,sender_id:ctx.user.id,body:"",reply_to:replyTarget?.id||null,client_nonce:crypto.randomUUID(),
   attachment_path:manifestPath,attachment_name:folderName,attachment_type:"application/x-renobva-folder",attachment_size:items.reduce((n,x)=>n+x.file.size,0)
 }).select("*").single();
 if(error)throw error;await hydrateMessage(m);await append(m);
}

document.querySelector("#chatForm").addEventListener("submit",async e=>{
 e.preventDefault();if(isClosedStatus(projectData?.status)||projectData?.archived_at||projectData?.deleted_at)return toast("This conversation is read-only because the ticket is closed.","warn");const input=e.target.message,body=input.value.trim();
 if(!body&&!pendingFiles.length&&!pendingFolders.size)return;
 const btn=e.target.querySelector("button[type=submit]");btn.disabled=true;btn.textContent=(pendingFiles.length||pendingFolders.size)?"Uploading…":"Sending…";
 try{
   if(body){
     const {data:m,error}=await renobva.sb.from("messages").insert({project_id:projectId,sender_id:ctx.user.id,body,reply_to:replyTarget?.id||null,client_nonce:crypto.randomUUID()}).select("*").single();
     if(error)throw error;await hydrateMessage(m);await append(m);input.value="";window.RENOBVA_DRAFTS?.clear(e.target);input.style.height="auto";
   }
   for(const [folderName,items] of [...pendingFolders.entries()])await uploadFolderBundle(folderName,items);
   pendingFolders.clear();
   const files=[...pendingFiles];
   for(const item of files){
     if(item.state==="done")continue;
     item.state="uploading";item.progress=35;renderQueue();
     const f=item.file,path=pathFor(f);
     const {error:upErr}=await renobva.sb.storage.from(bucket).upload(path,f,{contentType:f.type||"application/octet-stream"});
     if(upErr)throw upErr;item.progress=75;renderQueue();
     const {data:m,error}=await renobva.sb.from("messages").insert({project_id:projectId,sender_id:ctx.user.id,body:"",attachment_path:path,attachment_name:f.webkitRelativePath||f.name,attachment_type:f.type||"application/octet-stream",attachment_size:f.size}).select("*").single();
     if(error)throw error;item.progress=100;item.state="done";renderQueue();await hydrateMessage(m);await append(m);
   }
   pendingFiles=[];pendingFolders.clear();renderQueue();clearReply();input.focus();
 }catch(err){toast(err.message||"Upload failed.","error")}
 finally{updateChatLock(projectData?.status);if(!isClosedStatus(projectData?.status)&&!projectData?.archived_at&&!projectData?.deleted_at){btn.disabled=false;btn.textContent="Send"}}
});

document.querySelector("#projectStatusSelect")?.addEventListener("change",async e=>{
 const {error}=await renobva.sb.from("projects").update({status:e.target.value,updated_at:new Date().toISOString()}).eq("id",projectId);
 if(!error){projectData.status=e.target.value;setStatus(e.target.value);updateChatLock(e.target.value)}
 toast(error?error.message:"Project progress updated.",error?"error":"ok");
});
document.querySelector("#clientCloseTicket")?.addEventListener("click",async()=>{
 if(!confirm("Close your ticket? RENOBVA will still keep the conversation and project history."))return;
 const {error}=await renobva.sb.from("projects").update({status:"cancelled",updated_at:new Date().toISOString()}).eq("id",projectId).eq("user_id",ctx.user.id);
 if(error)return toast(error.message,"error");
 projectData.status="cancelled";setStatus("cancelled");updateChatLock("cancelled");document.querySelector("#clientTicketControls").hidden=true;toast("Your ticket has been closed.");
});
document.querySelector("#closeTicket")?.addEventListener("click",async()=>{
 if(!confirm("Close this ticket? The conversation will stay saved."))return;
 const {error}=await renobva.sb.from("projects").update({status:"completed",updated_at:new Date().toISOString()}).eq("id",projectId);
 if(error)return toast(error.message,"error");projectData.status="completed";setStatus("completed");updateChatLock("completed");toast("Ticket closed.");
});
window.addEventListener("beforeunload",()=>{clearInterval(refreshTimer);if(channel)renobva.sb.removeChannel(channel)});
function renderProjectDetails(p){
 const title=document.querySelector('.portal-title');if(!title)return;
 let detail=document.querySelector('#projectBrief');if(!detail){detail=document.createElement('div');detail.id='projectBrief';detail.className='project-brief';title.appendChild(detail)}
 detail.innerHTML=`<details><summary>Project details · ${esc(p.budget||'Budget not specified')}</summary><p>${esc(p.brief||'')}</p><p><b>Preferred deadline:</b> ${esc(p.deadline||'Not specified')}</p>${Object.entries(p.answers||{}).map(([key,value])=>`<p><b>${esc(key)}:</b> ${esc(typeof value==='string'?value:JSON.stringify(value))}</p>`).join('')}</details>`;
}
async function refreshConversation(){
 if(!ctx || refreshBusy || document.hidden)return;refreshBusy=true;
 try{
  const [{data:messages,error},{data:p}]=await Promise.all([renobva.sb.from('messages').select('*').eq('project_id',projectId).order('created_at'),renobva.sb.from('projects').select('*').eq('id',projectId).single()]);
  if(error){window.RENOBVA_CONNECTION?.error();return;}
  window.RENOBVA_CONNECTION?.ok();
  const changed=messages.length!==allMessages.length || messages.some((m,i)=>JSON.stringify([m.id,m.body,m.edited_at,m.deleted_at,m.attachment_path])!==JSON.stringify([allMessages[i]?.id,allMessages[i]?.body,allMessages[i]?.edited_at,allMessages[i]?.deleted_at,allMessages[i]?.attachment_path]));
  if(changed){profileCache.clear();await Promise.all(messages.map(hydrateMessage));await render(messages)}
  if(p){projectData=p;window.RENOBVA_PROJECT_STATE=p;window.dispatchEvent(new Event('renobva:project-state'));setStatus(p.status);updateChatLock(p.status)}else{projectData={...projectData,deleted_at:new Date().toISOString()};window.RENOBVA_PROJECT_STATE=projectData;window.dispatchEvent(new Event('renobva:project-state'));updateChatLock(projectData.status);document.querySelector('#projectTitle').textContent='Project unavailable';}
 }catch(error){window.RENOBVA_CONNECTION?.error();}finally{refreshBusy=false}
}
(async()=>{
 const saved=sessionStorage.getItem('renobva.project-notice');if(!saved)return;
 try{const result=JSON.parse(saved);if(result.id===projectId){toast(result.email_status==='sent'?'Project created. Confirmation emails sent.':'Project created. Chat is ready; email notifications are not activated yet.',result.email_status==='sent'?'ok':'warn');sessionStorage.removeItem('renobva.project-notice')}}catch{}
})();
load();window.addEventListener('renobva:retry',refreshConversation);

function bindFileDownloads(){
 document.querySelectorAll('[data-download-file]').forEach(button=>button.onclick=async()=>{
 const file=allMessages.find(m=>m.id===button.dataset.downloadFile);if(!file)return;button.disabled=true;const text=button.textContent;button.textContent='Downloading…';
 try{await RENOBVA_FILES.one(renobva.sb,file,projectId)}catch(error){toast(error.message||'Download failed. Please try again.','error')}finally{button.disabled=false;button.textContent=text}
 });
}
function renderProjectFiles(){
 const files=allMessages.filter(m=>m.attachment_path&&!m.deleted_at);
 let panel=document.querySelector('#projectFilesDropdown');if(!panel){panel=document.createElement('details');panel.id='projectFilesDropdown';panel.className='project-files-dropdown';const messages=document.querySelector('#messages');messages.parentNode.insertBefore(panel,messages)}
 const open=panel.open;panel.hidden=!files.length;
 panel.innerHTML=`<summary><span>▤ Project files <b>${files.length}</b></span><span>View & download ⌄</span></summary><div class="project-file-content"><div class="project-file-toolbar"><p>All shared assets in one place.</p><button type="button" id="downloadProjectZip">↓ Download all ZIP</button></div>${files.map(m=>`<div class="project-file-row"><span><b>${esc(m.attachment_name||'Attachment')}</b><small>${formatBytes(m.attachment_size)}${m.body==='Project brief attachment'?' · Client brief':''}</small></span><button type="button" data-download-file="${m.id}">↓ Download</button></div>`).join('')}<small class="download-hint">ZIP files contain a project folder. Downloads use your browser’s save location.</small></div>`;
 panel.open=open;bindFileDownloads();panel.querySelector('#downloadProjectZip').onclick=async()=>{const button=panel.querySelector('#downloadProjectZip');button.disabled=true;try{await RENOBVA_FILES.all(renobva.sb,files,projectId,projectData?.title,(i,n)=>button.textContent=`Preparing ${i}/${n}…`)}catch(error){toast(error.message||'Download failed. Please try again.','error')}finally{button.disabled=false;button.textContent='↓ Download all ZIP'}};
}
