/* Explicit anonymous read: only consented, approved public fields are exposed. */
(async () => {
  if(!document.querySelector('.hero'))return;
  const cfg=window.RENOBVA_SUPABASE;if(!cfg?.url||!cfg.anonKey)return;
  const response=await fetch(cfg.url+'/rest/v1/project_testimonials?select=display_name,rating,body,created_at&order=created_at.desc&limit=6',{headers:{apikey:cfg.anonKey,Authorization:'Bearer '+cfg.anonKey}});
  if(!response.ok)return;const rows=await response.json();if(!rows.length)return;
  const e=RENOBVA_EXPERIENCE.escape,section=document.createElement('section');section.className='public-testimonials';section.innerHTML=`<div class="container"><div class="sectionhead"><div><span class="eyebrow">CLIENT EXPERIENCES</span><h2>Built together. Shared by clients.</h2></div></div><div class="testimonial-grid">${rows.map(r=>`<blockquote class="testimonial-card"><span class="testimonial-stars" aria-label="${Number(r.rating)} out of 5 stars">${'★'.repeat(Number(r.rating))}</span><p>${e(r.body)}</p><footer>${e(r.display_name)}</footer></blockquote>`).join('')}</div></div>`;document.querySelector('main').appendChild(section);
})().catch(()=>{});
