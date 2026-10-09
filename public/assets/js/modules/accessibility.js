/* Keyboard and motion preferences work across the public site and workspace. */
(() => {
  document.documentElement.lang='en';
  const main=document.querySelector('main');if(main){if(!main.id)main.id='mainContent';main.tabIndex=-1;const skip=document.createElement('a');skip.href='#'+main.id;skip.className='skip-link';skip.textContent='Skip to main content';document.body.prepend(skip);}
  document.querySelectorAll('.portal-logo img').forEach(img=>{if(!img.hasAttribute('alt'))img.alt='';});
  const menu=document.querySelector('.menu'),nav=document.querySelector('.navlinks');
  if(menu&&nav){nav.id=nav.id||'mainNavigation';menu.setAttribute('aria-controls',nav.id);menu.setAttribute('aria-expanded',String(nav.classList.contains('open')));
    menu.addEventListener('click',()=>menu.setAttribute('aria-expanded',String(nav.classList.contains('open'))));
    document.addEventListener('keydown',ev=>{if(ev.key==='Escape'&&nav.classList.contains('open')){nav.classList.remove('open');menu.setAttribute('aria-expanded','false');menu.focus();}});
    nav.querySelectorAll('a').forEach(a=>a.addEventListener('click',()=>{nav.classList.remove('open');menu.setAttribute('aria-expanded','false');}));
  }
  document.querySelectorAll('[data-user-name]').forEach(n=>n.setAttribute('dir','auto'));
})();
