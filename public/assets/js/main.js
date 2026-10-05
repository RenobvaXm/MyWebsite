
const menu=document.querySelector('.menu'),links=document.querySelector('.navlinks');
if(menu) menu.addEventListener('click',()=>links.classList.toggle('open'));
document.querySelectorAll('[data-filter]').forEach(b=>b.addEventListener('click',()=>{
 document.querySelectorAll('[data-filter]').forEach(x=>x.classList.remove('active'));b.classList.add('active');
 const f=b.dataset.filter;document.querySelectorAll('[data-type]').forEach(c=>c.style.display=(f==='all'||c.dataset.type===f)?'block':'none');
}));
const form=document.querySelector('#contactForm');
if(form)form.addEventListener('submit',e=>{e.preventDefault();document.querySelector('.notice').style.display='block';form.reset()});
document.querySelectorAll('[data-year]').forEach(x=>x.textContent=new Date().getFullYear());
