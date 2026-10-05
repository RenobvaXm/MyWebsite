
let ADMIN_PROJECTS=[];
const esc=s=>(s??"").toString().replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
(async()=>{
 const ctx=await requireAuth(true);if(!ctx)return;
 await refreshAdmin();
 document.querySelector("#adminSearch")?.addEventListener("input",renderAdmin);
 document.querySelector("#adminFilter")?.addEventListener("change",renderAdmin);
})();
async function refreshAdmin(){
 const [{data:projects,error},{data:profiles}]=await Promise.all([
  renobva.sb.from("projects").select("*,profiles(display_name,email)").order("created_at",{ascending:false}),
  renobva.sb.from("profiles").select("*").order("created_at",{ascending:false})
 ]);
 if(error)return toast(error.message,"error");
 ADMIN_PROJECTS=projects||[];
 document.querySelector("#countProjects").textContent=ADMIN_PROJECTS.length;
 document.querySelector("#countClients").textContent=(profiles||[]).filter(x=>x.role==="client").length;
 document.querySelector("#countActive").textContent=ADMIN_PROJECTS.filter(x=>!["completed","cancelled"].includes(x.status)).length;
 renderAdmin();
}
function renderAdmin(){
 const q=(document.querySelector("#adminSearch")?.value||"").toLowerCase();
 const status=document.querySelector("#adminFilter")?.value||"all";
 const rows=ADMIN_PROJECTS.filter(p=>{
  const hay=[p.title,p.service_type,p.profiles?.display_name,p.profiles?.email].join(" ").toLowerCase();
  return hay.includes(q)&&(status==="all"||p.status===status);
 });
 document.querySelector("#adminProjects").innerHTML=rows.length?rows.map(p=>`<tr>
 <td><b>${esc(p.title)}</b><small>${esc(p.profiles?.display_name||"Client")} • ${esc(p.profiles?.email||"")}</small></td>
 <td>${esc(p.service_type)}<small>${esc(p.budget||"No budget")}</small></td>
 <td><select data-status="${p.id}">${["new","questions","in progress","review","completed","cancelled"].map(s=>`<option ${s===p.status?"selected":""}>${s}</option>`).join("")}</select></td>
 <td><div class="admin-actions"><a class="mini-btn" href="admin-chat.html?id=${p.id}">Chat →</a><button class="danger-mini" data-delete="${p.id}">Delete</button></div></td></tr>`).join("")
 :`<tr><td colspan="4" class="admin-empty">No matching projects.</td></tr>`;
 document.querySelectorAll("[data-status]").forEach(s=>s.onchange=async()=>{
  const {error}=await renobva.sb.from("projects").update({status:s.value,updated_at:new Date().toISOString()}).eq("id",s.dataset.status);
  if(error)return toast(error.message,"error");const p=ADMIN_PROJECTS.find(x=>x.id===s.dataset.status);if(p)p.status=s.value;toast("Project status updated.");
 });
 document.querySelectorAll("[data-delete]").forEach(b=>b.onclick=async()=>{
  if(!confirm("Delete this project and its chat permanently?"))return;
  const {error}=await renobva.sb.from("projects").delete().eq("id",b.dataset.delete);
  if(error)return toast(error.message,"error");ADMIN_PROJECTS=ADMIN_PROJECTS.filter(x=>x.id!==b.dataset.delete);renderAdmin();toast("Project deleted.");
 });
}
