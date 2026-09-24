'use strict';
document.documentElement.classList.add('js');
const projects=[{"url":"ichnos/","n":"01","img":"ichnos/hero.png","alt":"ÍCHNOS identity","title":"ÍCHNOS","category":"Identity / Packaging / Motion"},{"url":"offgrid/","n":"02","img":"offgrid/visuals/01.webp","alt":"OFFGRID campaign","title":"OFFGRID","category":"Identity / Campaign"},{"url":"afterhours/","n":"03","img":"afterhours/visuals/01.webp","alt":"AFTERHOURS event identity","title":"AFTERHOURS","category":"Music / Event System"},{"url":"daily-form/","n":"04","img":"daily-form/visuals/01.png","alt":"DAILY FORM identity","title":"DAILY FORM","category":"Identity / Packaging"},{"url":"relay/","n":"05","img":"relay/visuals/01.webp","alt":"RELAY product launch","title":"RELAY","category":"Digital / Launch"},{"url":"on-air/","n":"06","img":"on-air/visuals/hero-v2.webp","alt":"ON AIR broadcast identity","title":"ON AIR","category":"Broadcast / Titles"},{"url":"null-vector/","n":"07","img":"null-vector/key-art.webp","alt":"NULL VECTOR game identity","title":"NULL//VECTOR","category":"Game / UI / Campaign"},{"url":"cue/","n":"08","img":"cue/venue-planning.webp","alt":"CUE product design","title":"CUE","category":"Product / UI UX"},{"url":"aerium/","n":"09","img":"aerium/product.webp","alt":"AERIUM product identity","title":"AERIUM","category":"Product / Campaign"},{"url":"apex-racing/","n":"10","img":"apex-racing/graphic-hero.webp","alt":"APEX RACING campaign","title":"APEX RACING","category":"Identity / Campaign"},{"url":"forma/","n":"11","img":"forma/graphic-hero.webp","alt":"FORMA cultural identity","title":"FORMA","category":"Culture / Editorial"},{"url":"morph/","n":"12","img":"morph/graphic-hero.webp","alt":"MORPH fashion identity","title":"MORPH","category":"Fashion / Direction"}];
const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
const overlay=document.querySelector('.loading'),count=document.querySelector('#loading-count');
// Prepare every homepage image, including media below the fold, before revealing.
function prepareImage(img){
  return new Promise(resolve=>{
    const decode=()=>{
      img.removeEventListener('load',decode);
      img.removeEventListener('error',failed);
      if(img.naturalWidth&&img.decode)img.decode().then(resolve,resolve);
      else resolve();
    };
    const failed=()=>{
      img.removeEventListener('load',decode);
      img.removeEventListener('error',failed);
      resolve(); // A failed request must not lock visitors behind the loader.
    };
    img.addEventListener('load',decode,{once:true});
    img.addEventListener('error',failed,{once:true});
    img.loading='eager';
    if(img.complete)decode();
  });
}
const imageReadiness=[...document.images].map(prepareImage);
const fontsReady=Promise.all([
  document.fonts.load('400 16px "Manrope"'),
  document.fonts.load('500 16px "Space Grotesk"')
]).then(()=>document.fonts.ready,()=>document.fonts.ready);
const readiness=Promise.all([fontsReady,...imageReadiness]);
let introRun=0;
async function playIntro(){
  const run=++introRun,root=document.documentElement;
  root.classList.remove('intro-ready','intro-running');
  root.classList.add('loading-active');
  overlay.classList.remove('done');
  count.textContent='0%';overlay.style.setProperty('--loaded','0');
  history.scrollRestoration='manual';window.scrollTo(0,0);
  await fontsReady;
  if(run!==introRun)return;
  void overlay.offsetWidth;
  root.classList.add('intro-running');
  let ready=false,start=null,progress=0;
  readiness.then(()=>requestAnimationFrame(()=>requestAnimationFrame(()=>{ready=true})));
  function tick(now){
    if(run!==introRun)return;
    if(start===null)start=now;
    const target=Math.min(ready?100:94,Math.floor((now-start)/40));
    progress=Math.min(target,progress+1);
    count.textContent=progress+'%';overlay.style.setProperty('--loaded',progress/100);
    if(progress<100){requestAnimationFrame(tick);return}
    setTimeout(()=>{
      if(run!==introRun)return;
      overlay.classList.add('done');
      setTimeout(()=>{
        if(run!==introRun)return;
        root.classList.add('intro-ready');root.classList.remove('loading-active');
      },reduced?0:1600);
    },400);
  }
  requestAnimationFrame(tick);
}
playIntro();
addEventListener('pageshow',event=>{if(event.persisted)playIntro()});
// Store a covered page in the back/forward cache, ready for the next visit.
addEventListener('pagehide',()=>{
  introRun++;
  document.documentElement.classList.remove('intro-ready','intro-running');
  document.documentElement.classList.add('loading-active');
  overlay.classList.remove('done');
  count.textContent='0%';overlay.style.setProperty('--loaded','0');
});
const menu=document.querySelector('#menu');
let menuTimer=0;
function openMenu(){
  clearTimeout(menuTimer);
  if(!menu.open)menu.showModal();
  document.documentElement.classList.add('menu-active');
  document.querySelector('#menu-open').setAttribute('aria-expanded','true');
  void menu.offsetWidth;menu.classList.add('is-visible');
}
function closeMenu(){
  if(!menu.open)return;
  menu.classList.remove('is-visible');
  clearTimeout(menuTimer);
  menuTimer=setTimeout(()=>menu.close(),reduced?0:350);
}
menu.addEventListener('close',()=>{
  document.documentElement.classList.remove('menu-active');
  document.querySelector('#menu-open').setAttribute('aria-expanded','false');
});
menu.addEventListener('cancel',event=>{event.preventDefault();closeMenu()});
document.querySelector('#menu-open').setAttribute('aria-controls','menu');
document.querySelector('#menu-open').setAttribute('aria-expanded','false');
document.querySelector('#menu-open').addEventListener('click',openMenu);
document.querySelector('#menu-close').addEventListener('click',closeMenu);
menu.querySelectorAll('a').forEach(a=>a.addEventListener('click',closeMenu));
