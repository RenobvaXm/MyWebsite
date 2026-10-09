/* Presentation and validation only. Existing project, payment and auth handlers own submission. */
(() => {
  document.querySelectorAll('.navlinks>a.active,.side-nav>a.active').forEach(a => a.setAttribute('aria-current','page'));
  const nav=document.querySelector('.navlinks'),menu=document.querySelector('.menu');
  if(nav&&menu) document.addEventListener('click',event=>{
    if(nav.classList.contains('open')&&!nav.contains(event.target)&&!menu.contains(event.target)){
      nav.classList.remove('open');menu.setAttribute('aria-expanded','false');
    }
  });
  const projects={
    'Vantage Legal':['01-vantage-legal','Design & frontend development'],
    'Noir Table':['02-noir-table','Design & frontend development'],
    'FlowCraft':['03-flowcraft','Design & frontend development'],
    'Aurelia Estates':['04-aurelia-estates','Design & development'],
    'Nexora':['05-nexora','Design & full-stack development'],
    'Velora':['06-velora','Design & frontend development'],
    'IronVault':['07-ironvault','Design & frontend development'],
    'Lumina Dental':['08-lumina-dental','Design & frontend development']
  };
  const assetScript=document.currentScript;
  const root=new URL('../../../',assetScript.src);
  document.querySelectorAll('.project[data-type=business]').forEach(card=>{
    const title=card.querySelector('h3')?.textContent.trim();
    const match=Object.entries(projects).find(([name])=>name.toLowerCase()===title?.toLowerCase());
    if(!match)return;
    const [slug,role]=match[1];
    const body=card.querySelector('.projectbody');if(!body)return;
    const label=document.createElement('span');label.className='concept-label';label.textContent='Concept project';body.querySelector('.meta')?.append(label);
    const detail=document.createElement('div');detail.className='project-role';detail.textContent='My role · '+role;body.append(detail);
    const arrow=body.querySelector('.arrow');
    if(arrow&&arrow.tagName!=='A'){
      const link=document.createElement('a');link.className='project-link';link.href=new URL('pages/case-studies/'+slug+'.html',root).href;link.textContent='Explore case study ↗';link.setAttribute('aria-label','Explore '+title+' case study');arrow.replaceWith(link);
    }
    const cover=card.querySelector('.cover img');if(cover){cover.loading='lazy';cover.decoding='async';}
  });
  let errorCount=0;
  document.addEventListener('invalid',event=>{
    const field=event.target;
    if(!field.matches('input,textarea,select')||!field.closest('form'))return;
    field.setAttribute('aria-invalid','true');
    let note=field.parentElement.querySelector('[data-field-error]');
    if(!note){note=document.createElement('small');note.className='field-error';note.dataset.fieldError='';note.id='fieldError'+(++errorCount);field.after(note);}
    const ids=new Set((field.getAttribute('aria-describedby')||'').split(/\s+/).filter(Boolean));ids.add(note.id);field.setAttribute('aria-describedby',[...ids].join(' '));
    note.textContent=field.validationMessage;
  },true);
  document.addEventListener('input',event=>{
    const field=event.target;if(!field.matches('input,textarea,select'))return;
    if(field.validity.valid){field.removeAttribute('aria-invalid');const note=field.parentElement.querySelector('[data-field-error]');if(note)note.textContent='';}
  });
  document.addEventListener('change',event=>{const field=event.target;if(field.matches('select')&&field.validity.valid){field.removeAttribute('aria-invalid');const note=field.parentElement.querySelector('[data-field-error]');if(note)note.textContent='';}});
  document.addEventListener('click',event=>{
    const summary=event.target.closest('.admin-more summary');
    if(summary)document.querySelectorAll('.admin-more[open]').forEach(d=>{if(d!==summary.parentElement)d.open=false;});
    else if(!event.target.closest('.admin-more'))document.querySelectorAll('.admin-more[open]').forEach(d=>d.open=false);
  });
  document.addEventListener('keydown',event=>{if(event.key==='Escape')document.querySelectorAll('.admin-more[open]').forEach(d=>{d.open=false;d.querySelector('summary')?.focus();});});
})();
