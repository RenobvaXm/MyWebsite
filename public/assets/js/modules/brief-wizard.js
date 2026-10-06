/* Shared guided brief. Files stay in this browser through login; uploads use private project storage. */
(async () => {
  const mount = document.querySelector('#projectWizard');
  if (!mount) return;
  const portal = location.pathname.includes('/portal/');
  const sb = window.renobva?.sb || window.renobvaSiteAuth;
  const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const services = ['Business Website','Website Redesign','Full-Stack Project','Birthday Website','Anniversary / Love',"Mother's Day",'Wedding / Proposal','Custom Celebration'];
  const titles = ['The essentials','Make it yours','Brand assets','Review & send'];
  const questions = {
    business: ['What does your business do, and who is your audience?','Which pages or sections do you need?','What should a visitor do on your website?'],
    app: ['What problem should your app solve?','What should users and admins be able to do?','Which integrations or database features do you need?'],
    special: ['Who is this for, and what is the occasion?','What story or memories should we include?','What would make this surprise feel personal?']
  };
  let step = 0, busy = false, files = [], state = {service:'Business Website',budget:'Not sure — help me choose',submission_key:crypto.randomUUID()}, projectId = null;
  // IndexedDB supports File objects without putting private assets in localStorage.
  const db = await new Promise((resolve,reject) => {const r=indexedDB.open('renobva-brief',1);r.onupgradeneeded=()=>r.result.createObjectStore('draft');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)}).catch(()=>null);
  async function saved(mode,value) {if(!db)return null;return new Promise((resolve,reject)=>{const tx=db.transaction('draft',mode==='read'?'readonly':'readwrite'),store=tx.objectStore('draft');let r=mode==='read'?store.get('current'):mode==='delete'?store.delete('current'):store.put(value,'current');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)})}
  const draft=await saved('read').catch(()=>null);
  if(draft && Date.now()-draft.time<86400000){state=draft.state;files=draft.files||[];projectId=draft.projectId||null;step=new URLSearchParams(location.search).has('submit')?3:0}
  const {data:{user}} = sb ? await sb.auth.getUser() : {data:{user:null}};
  if(portal && user && window.requireAuth) await requireAuth();
  if(user){state.name ||= user.user_metadata?.display_name || '';state.email ||= user.email || ''}
  const family=()=>state.service==='Full-Stack Project'?'app':services.indexOf(state.service)>2?'special':'business';
  const field=(key,label,kind='input',required=false,placeholder='')=>`<label class="${kind==='textarea'?'wide':''}">${escape(label)}${kind==='textarea'?`<textarea name="${key}" maxlength="1500" ${required?'required':''} placeholder="${escape(placeholder)}">${escape(state[key])}</textarea>`:`<input name="${key}" ${kind==='date'?'type="date"':key==='email'?'type="email"':''} maxlength="${key==='title'?120:200}" ${required?'required':''} value="${escape(state[key])}" placeholder="${escape(placeholder)}">`}</label>`;
  const select=(key,label,values)=>`<label>${label}<select name="${key}">${values.map(v=>`<option ${state[key]===v?'selected':''}>${escape(v)}</option>`).join('')}</select></label>`;
  function capture(){const form=mount.querySelector('form');if(!form)return;for(const [k,v] of new FormData(form))if(k!=='assets'&&k!=='feature')state[k]=String(v).trim();if(step===1)state.features=[...form.querySelectorAll('[name=feature]:checked')].map(x=>x.value)}
  async function persist(){await saved('write',{state,files,projectId,time:Date.now()}).catch(()=>{})}
  function detailRows(){return [['Project',state.title],['Service',state.service],['Name',state.name],['Contact email',state.email],['Budget',state.budget],['Preferred deadline',state.deadline||'Flexible'],['Your idea',state.brief],...questions[family()].map((q,i)=>[q,state['q'+i]||'Not specified']),['Features',(state.features||[]).join(', ')||'Help me decide'],['Style & colours',state.style||'Open to suggestions'],['Inspiration / existing website',state.inspiration||'Not provided'],['Assets',files.map(f=>f.name).join(', ')||'I will share files later']]}
  function render(){
    const intro=['Start with the big picture.','A few answers help me understand your vision.','Share what you have. You can always add more later.','Check your brief before creating your project.'];
    let body='';
    if(step===0)body=field('name','Your name','input',true)+field('email','Contact email','input',true)+field('title','Give your project a name','input',true,'e.g. A new website for my café')+select('service','What can I build for you?',services)+select('budget','Your estimated budget',['Not sure — help me choose','€49–€99','€100–€200','€200–€400','€500–€1,200','€1,200+'])+field('deadline','Preferred deadline (optional)','date')+field('brief','Tell me about your idea','textarea',true,'What are you hoping to create? What matters most?');
    if(step===1){body=questions[family()].map((q,i)=>field('q'+i,q,'textarea',i===0)).join('');const features=family()==='special'?['Photo gallery','Music / voice message','Games','Gift hunt','Countdown','RSVP']:['Contact form','Booking','User accounts','Admin dashboard','Online payments','Blog','Live chat','Multiple languages'];body+=`<div class="wide"><p>Which features would you like? <span class="brief-muted">Optional</span></p><div class="brief-options">${features.map(f=>`<label><input type="checkbox" name="feature" value="${escape(f)}" ${(state.features||[]).includes(f)?'checked':''}>${escape(f)}</label>`).join('')}</div></div>`+field('style','Any colours, mood or style you love?','textarea')+field('inspiration','Inspiration links / current website','textarea');}
    if(step===2)body=`<div class="wide"><div class="brief-drop" id="briefDrop"><span style="font-size:32px">↥</span><h3>Drop your files here</h3><p>or click to browse</p><small class="brief-muted">Logos, photos, brand guides, copy or ZIP folders.<br>Up to 10 files · 15 MB each · optional</small><input aria-label="Upload project assets" type="file" id="briefFiles" name="assets" multiple accept=".png,.jpg,.jpeg,.webp,.gif,.svg,.pdf,.txt,.doc,.docx,.zip,.ai,.eps,.psd"></div><div id="briefFileList"></div><p class="brief-muted">Only you and RENOBVA can access your project files. Please share access invitations rather than passwords.</p></div>`;
    if(step===3)body=`<dl class="brief-review wide">${detailRows().map(([k,v])=>`<div><dt>${escape(k)}</dt><dd>${escape(v)}</dd></div>`).join('')}</dl><label class="wide"><span><input type="checkbox" name="confirm" required style="width:auto"> I’ve checked my details and am ready to send this request.</span><small>This creates a project request, not a payment or a confirmed order.</small></label>`;
    mount.innerHTML=`<div class="brief-wizard"><aside class="brief-sidebar"><span class="eyebrow">LET’S CREATE</span><h3>A great website starts here.</h3><p>Your vision, turned into a clear brief.</p><div class="brief-steps">${titles.map((t,i)=>`<div class="brief-step ${i===step?'active':i<step?'done':''}" ${i===step?'aria-current="step"':''}><span>${i<step?'✓':i+1}</span>${t}</div>`).join('')}</div><p>No perfect brief needed.<br>We’ll figure out the details together.</p></aside><div class="brief-main"><span class="eyebrow">STEP ${step+1} OF 4</span><div class="brief-progress"><i style="width:${(step+1)*25}%"></i></div><h2 tabindex="-1">${titles[step]}</h2><p class="brief-muted">${intro[step]}</p><form><div class="brief-fields">${body}</div><div class="brief-notice" role="status" hidden></div><div class="brief-footer"><button class="btn" type="button" id="briefBack" ${step===0?'hidden':''}>← Back</button><span>${step===0?'About 3 minutes':''}</span><button class="btn primary" type="submit">${step===3?(user?'Create project request →':'Sign in & send →'):'Continue →'}</button></div></form></div></div>`;
    mount.querySelector('#briefBack').onclick=async()=>{capture();await persist();step--;render()};
    mount.querySelector('form').onsubmit=async e=>{e.preventDefault();if(busy)return;capture();if(step===0 && (state.title.length<3||state.brief.length<10))return notice('Add a title of at least 3 characters and describe your idea in at least 10 characters.');await persist();if(step<3){step++;render();mount.querySelector('h2').focus();return}await submit()};
    const picker=mount.querySelector('#briefFiles');if(picker){picker.onchange=()=>addFiles([...picker.files]);const drop=mount.querySelector('#briefDrop');drop.ondragover=e=>{e.preventDefault();drop.classList.add('dragging')};drop.ondragleave=()=>drop.classList.remove('dragging');drop.ondrop=e=>{e.preventDefault();drop.classList.remove('dragging');addFiles([...e.dataTransfer.files])};renderFiles()}
  }
  function notice(text){const box=mount.querySelector('.brief-notice');box.hidden=false;box.textContent=text}
  function addFiles(incoming){const allowed=/\.(png|jpe?g|webp|gif|svg|pdf|txt|docx?|zip|ai|eps|psd)$/i;for(const f of incoming){if(files.length>=10||f.size>15*1024*1024||!allowed.test(f.name)){notice('Please choose up to 10 supported files, each no larger than 15 MB.');continue}files.push(f)}renderFiles();persist()}
  function renderFiles(){const list=mount.querySelector('#briefFileList');if(!list)return;list.innerHTML=files.map((f,i)=>`<div class="brief-file"><span>${escape(f.name)} <small class="brief-muted">${(f.size/1024/1024).toFixed(2)} MB</small></span><button type="button" data-remove="${i}" aria-label="Remove ${escape(f.name)}">Remove ×</button></div>`).join('');list.querySelectorAll('[data-remove]').forEach(b=>b.onclick=()=>{files.splice(Number(b.dataset.remove),1);renderFiles();persist()})}
  async function submit(){
    busy=true;const button=mount.querySelector('[type=submit]');button.disabled=true;
    try{
      const {data:{user:current}}=await sb.auth.getUser();
      if(!current){await persist();location.href='/pages/auth/login.html?returnTo='+encodeURIComponent(location.pathname+'?submit=1');return}
      notice('Creating your request…');
      if(!projectId){const answers=Object.fromEntries(detailRows().filter(([key])=>!['Project','Service','Budget','Preferred deadline','Your idea','Assets'].includes(key)));const result=await RENOBVA_PROJECT_FLOW.submit(sb,{submission_key:state.submission_key,title:state.title,service_type:state.service,budget:state.budget,deadline:state.deadline||null,brief:state.brief,answers});projectId=result.project_id;await persist()}
      while(files.length){const f=files[0];notice('Uploading '+f.name+'…');const path=projectId+'/brief/'+crypto.randomUUID()+'-'+f.name.replace(/[^a-zA-Z0-9._-]/g,'_');const {error:uploadError}=await sb.storage.from('project-files').upload(path,f,{upsert:false});if(uploadError)throw uploadError;
        const {error}=await sb.from('messages').insert({project_id:projectId,sender_id:current.id,body:'Project brief attachment',attachment_path:path,attachment_name:f.name,attachment_type:f.type||'application/octet-stream',attachment_size:f.size});if(error){await sb.storage.from('project-files').remove([path]);throw error}files.shift();await persist();
      }
      await saved('delete');location.href='/pages/portal/project.html?id='+encodeURIComponent(projectId);
    }catch(error){notice((projectId?'Your project is saved. Some files could not be uploaded. Click send again to retry, or open your project from the portal.\n':'')+(error.message||'Please try again.'))}
    finally{busy=false;button.disabled=false}
  }
  render();
})();
