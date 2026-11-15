/* Mobile menu toggle and home audience-bar highlight. No tracking, no network requests. */
(function(){
  var btn=document.querySelector('.nav-toggle'),nav=document.getElementById('site-nav');
  if(!btn||!nav)return;
  function set(o){btn.setAttribute('aria-expanded',o?'true':'false');nav.classList.toggle('open',o);}
  btn.addEventListener('click',function(){set(btn.getAttribute('aria-expanded')!=='true');});
  nav.addEventListener('click',function(e){if(e.target.closest('a'))set(false);});
  document.addEventListener('keydown',function(e){if(e.key==='Escape'&&btn.getAttribute('aria-expanded')==='true'){set(false);btn.focus();}});
})();
(function(){
  var bar=document.querySelector('.aud-bar');
  if(!bar||!('IntersectionObserver' in window))return;
  var links=bar.querySelectorAll('a'),map={};
  links.forEach(function(a){var s=document.getElementById(a.getAttribute('href').slice(1));if(s)map[s.id]=a;});
  function on(id){links.forEach(function(a){var m=map[id]===a;a.classList.toggle('is-active',m);if(m){a.setAttribute('aria-current','true');if(bar.scrollWidth>bar.clientWidth){bar.scrollTo({left:a.offsetLeft-(bar.clientWidth-a.offsetWidth)/2,behavior:'smooth'});}}else{a.removeAttribute('aria-current');}});}
  var io=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting)on(e.target.id);});},{rootMargin:'-45% 0px -50% 0px'});
  Object.keys(map).forEach(function(id){io.observe(document.getElementById(id));});
})();
