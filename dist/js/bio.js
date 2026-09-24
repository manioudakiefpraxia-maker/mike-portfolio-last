import {clamp} from './scroll.js';

export function initBio(scene){
  const copy=document.getElementById('bio-copy');
  if(!copy)return;

  const words=[];
  copy.querySelectorAll('[data-bio]').forEach(line=>{
    const text=line.dataset.bio||'';
    line.textContent='';
    text.split(' ').forEach((word,index,array)=>{
      const span=document.createElement('span');
      span.className='bio-word';
      span.textContent=word+(index<array.length-1?' ':'');
      line.appendChild(span);
      words.push(span);
    });
  });

  scene.subscribe(progress=>{
    const trigger=.57;
    const reveal=clamp((progress-trigger)/.40);
    const active=progress>=trigger;

    copy.classList.toggle('is-visible',active);
    copy.setAttribute('aria-hidden',String(!active));

    const count=Math.max(1,words.length-1);
    words.forEach((word,index)=>{
      const start=(index/count)*.88;
      const local=clamp((reveal-start)/.12);
      word.style.opacity=String(local);
      word.style.transform='translate3d(0,'+((1-local)*5).toFixed(2)+'px,0)';
    });
  });
}
