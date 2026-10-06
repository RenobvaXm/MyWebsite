/* Preserve a contact request through login, then create its project exactly once. */
(async () => {
  const form=document.querySelector('#contactForm'), notice=document.querySelector('#contactNotice');
  if(!form || !window.supabase || !window.RENOBVA_SUPABASE) return;
  const sb=window.renobvaSiteAuth || window.supabase.createClient(RENOBVA_SUPABASE.url,RENOBVA_SUPABASE.anonKey);
  const flow=window.RENOBVA_PROJECT_FLOW, key=flow.draftKey;
  const show=(message,error=false)=>{notice.hidden=false;notice.textContent=message;notice.classList.toggle('error',error)};
  let busy=false;
  function readDraft(){try{const d=JSON.parse(localStorage.getItem(key));return d && Date.now()-d.saved_at<86400000?d:null}catch{return null}}
  const pending=readDraft();
  if(pending) for(const field of ['name','email','service','budget','message']) if(form.elements[field]) form.elements[field].value=pending[field]||'';
  async function send(draft) {
    if(busy) return; busy=true;
    const button=form.querySelector('button[type=submit]');button.disabled=true;button.textContent='Creating project…';
    try {
      const {data:{user}}=await sb.auth.getUser();
      if(!user){location.href='auth/login.html?returnTo='+encodeURIComponent('/pages/contact.html?submit=1');return;}
      const result=await flow.submit(sb,{submission_key:draft.submission_key,title:draft.service+' — '+draft.name,service_type:draft.service,budget:draft.budget,brief:draft.message,answers:{'Contact name':draft.name,'Requested contact email':draft.email,'Source':'Contact form'}});
      localStorage.removeItem(key);
      show(result.email_status==='sent'?'Project created and emails sent. Opening your project chat…':'Project created. Opening your chat; email notifications are not activated yet.');
      location.href='portal/project.html?id='+encodeURIComponent(result.project_id);
    }catch(error){show(error.message,true)}
    finally{busy=false;button.disabled=false;button.textContent='Send project request →'}
  }
  form.addEventListener('submit',async event=>{
    event.preventDefault(); const fd=new FormData(form);
    const draft={};for(const field of ['name','email','service','budget','message'])draft[field]=String(fd.get(field)||'').trim();
    if(draft.message.length<10){show('Please describe your project in at least 10 characters.',true);return}
    const existing=readDraft();
    const same=existing && ['name','email','service','budget','message'].every(k=>existing[k]===draft[k]);
    draft.submission_key=same?existing.submission_key:crypto.randomUUID();draft.saved_at=Date.now();
    localStorage.setItem(key,JSON.stringify(draft));await send(draft);
  });
  if(new URLSearchParams(location.search).get('submit')==='1' && pending) await send(pending);
})();
