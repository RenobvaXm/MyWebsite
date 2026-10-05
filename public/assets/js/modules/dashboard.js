
(async()=>{
 const ctx=await requireAuth();if(!ctx)return;
 const {data:projects}=await renobva.sb.from("projects").select("*").order("created_at",{ascending:false});
 const list=document.querySelector("#projectList"),empty=document.querySelector("#emptyProjects");
 if(!projects?.length){empty.hidden=false;return}
 empty.hidden=true;
 list.innerHTML=projects.map(p=>`<a class="project-row" href="project.html?id=${p.id}">
 <span class="project-icon">${p.category==="special"?"✦":"↗"}</span><span><b>${escapeHtml(p.title)}</b><small>${escapeHtml(p.service_type)} • ${new Date(p.created_at).toLocaleDateString()}</small></span>
 <span class="status ${p.status.replaceAll(" ","-")}">${p.status}</span><span>→</span></a>`).join("");
})();
function escapeHtml(s=""){return s.replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]))}
