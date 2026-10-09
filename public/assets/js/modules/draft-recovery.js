/* Drafts remain local to this browser and account; passwords/payment credentials are excluded. */
window.RENOBVA_DRAFTS=(()=>{
 let userId='guest',paused=false;const prefix='renobva.formdraft.v2.';const sessions=new WeakMap();
 const key=name=>prefix+userId+'.'+location.pathname+'.'+(new URLSearchParams(location.search).get('id')||'')+'.'+name;
 async function init(){try{const sb=window.renobva?.sb||window.renobvaSiteAuth;if(sb){const {data}=await sb.auth.getUser();userId=data?.user?.id||'guest';}}catch{}}
 const ready=init();
 function attach(form,name){if(!form||sessions.has(form))return;const session={name,timer:null,ready:false};sessions.set(form,session);form.dataset.draftName=name;const status=document.createElement('p');status.className='draft-save-state';status.setAttribute('role','status');form.appendChild(status);
  ready.then(()=>{if(!form.isConnected)return;let saved;try{saved=JSON.parse(localStorage.getItem(key(name))||'null')}catch{}
   if(saved&&Date.now()-saved.time<7*86400000){status.innerHTML='<span>An unfinished draft is available.</span> <button type="button" data-restore-draft>Restore draft</button> <button type="button" data-discard-draft>Discard</button>';status.querySelector('[data-restore-draft]').onclick=()=>{for(const el of form.elements){if(!el.name||!Object.hasOwn(saved.values,el.name)||['password','file','hidden'].includes(el.type))continue;if(el.type==='checkbox')el.checked=!!saved.values[el.name];else el.value=saved.values[el.name];el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));}session.ready=true;status.textContent='Draft restored. Review the values before sending.';};status.querySelector('[data-discard-draft]').onclick=()=>{clear(form);session.ready=true;status.textContent='Draft discarded.';};}else{session.ready=true;status.textContent='Unfinished text is saved in this browser.';}
  });
  const save=()=>{if(!session.ready||paused)return;try{localStorage.setItem(key(name),JSON.stringify({time:Date.now(),values:RENOBVA_USABILITY.fields(form)}));status.textContent='Draft saved on this device.';}catch{status.textContent='Draft could not be saved on this device.';}};
  session.save=save;form.addEventListener('input',event=>{if(event.isTrusted)session.ready=true;clearTimeout(session.timer);session.timer=setTimeout(save,400)});form.addEventListener('change',save);form.addEventListener('submit',()=>{clearTimeout(session.timer);save()});form.closest('dialog')?.addEventListener('close',()=>{clearTimeout(session.timer);save()});
 }
 function clear(form){const s=sessions.get(form);if(s){clearTimeout(s.timer);s.ready=false;try{localStorage.removeItem(key(s.name))}catch{}}}
 function purgeUser(){paused=true;for(let i=localStorage.length-1;i>=0;i--){const k=localStorage.key(i);if(k?.startsWith(prefix+userId+'.'))localStorage.removeItem(k);}}
 window.addEventListener('pagehide',()=>document.querySelectorAll('form[data-draft-name]').forEach(f=>sessions.get(f)?.save?.()));
 return {attach,clear,purgeUser};
})();
