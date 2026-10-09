window.RENOBVA_PROJECT_LIFECYCLE=(()=>{
 async function act(project,action){
  const sb=renobva.sb;
  if(action==='permanent'){
   const {count,error}=await sb.from('payment_documents').select('id',{count:'exact',head:true}).eq('project_id',project.id);if(error)throw error;if(count)throw Error('This project has issued payment documents. Restore or archive it to keep the payment history.');
   const checkout=await sb.from('payment_requests').select('id',{count:'exact',head:true}).eq('project_id',project.id).eq('stripe_locked',true).in('status',['pending','submitted']);if(checkout.error)throw checkout.error;if(checkout.count)throw Error('A Stripe checkout is still active. Keep this project in Trash until the payment is resolved.');if(!project.deleted_at)throw Error('Move the project to Trash first.');
   if(prompt('Permanently delete this project and its files? This cannot be undone. Type the project title to confirm:\n'+project.title)!==project.title)return false;
   const paths=[];
   async function list(prefix,depth=0){if(depth>12)throw Error('The file tree is too deep. Keep this project archived.');for(let offset=0;;offset+=1000){const {data,error}=await sb.storage.from('project-files').list(prefix,{limit:1000,offset});if(error)throw error;for(const item of data||[]){const path=prefix+'/'+item.name;if(item.id)paths.push(path);else await list(path,depth+1);if(paths.length>5000)throw Error('This project has too many files for browser cleanup. Keep it archived.');}if(!data||data.length<1000)break;}}
   await list(project.id);const result=await sb.from('projects').delete().eq('id',project.id).not('deleted_at','is',null).select('id').single();if(result.error)throw result.error;
   for(let i=0;i<paths.length;i+=100){const {error}=await sb.storage.from('project-files').remove(paths.slice(i,i+100));if(error){toast('Project deleted, but some stored files could not be removed. Their project access is disabled.','warn');return true;}}
   toast('Project permanently deleted.');return true;
  }
  const messages={trash:'Move this project to Trash? Its history and files can be restored.',archive:'Archive this project? It will become read-only.',unarchive:'Unarchive this project?',restore:'Restore this project from Trash?'};
  if(!confirm(messages[action]))return false;
  const patch=action==='trash'?{deleted_at:new Date().toISOString()}:action==='restore'?{deleted_at:null}:action==='archive'?{archived_at:new Date().toISOString()}:{archived_at:null};
  const {data,error}=await sb.from('projects').update(patch).eq('id',project.id).select('*').single();if(error)throw error;if(!data)throw Error('Could not update this project.');toast(action==='trash'?'Project moved to Trash.':action==='restore'?'Project restored.':action==='archive'?'Project archived.':'Project unarchived.');window.dispatchEvent(new Event('renobva:project-change'));return true;
 }
 return {act};
})();
