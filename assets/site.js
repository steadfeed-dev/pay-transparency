/* Mobile menu toggle only. No tracking, no network requests. */
(function(){
  var btn=document.querySelector('.nav-toggle'),nav=document.getElementById('site-nav');
  if(!btn||!nav)return;
  function set(o){btn.setAttribute('aria-expanded',o?'true':'false');nav.classList.toggle('open',o);}
  btn.addEventListener('click',function(){set(btn.getAttribute('aria-expanded')!=='true');});
  nav.addEventListener('click',function(e){if(e.target.closest('a'))set(false);});
  document.addEventListener('keydown',function(e){if(e.key==='Escape'&&btn.getAttribute('aria-expanded')==='true'){set(false);btn.focus();}});
})();
