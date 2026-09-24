'use strict';
(() => {
const reduce=matchMedia('(prefers-reduced-motion: reduce)'),fine=matchMedia('(pointer:fine)');
const hero=document.querySelector('.creative-title'),copy=document.querySelector('.interlude-copy');
let target=scrollY,frame=0,last=0,internal=false;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const maximum=()=>Math.max(0,document.documentElement.scrollHeight-innerHeight);
function effects(){if(reduce.matches)return;hero.style.setProperty('--hero-shift',Math.min(scrollY,innerHeight)*.1+'px');const rect=copy.getBoundingClientRect(),p=clamp((innerHeight-rect.top)/(innerHeight*.75),0,1);copy.style.setProperty('--copy-opacity',String(.18+p*.82));copy.style.setProperty('--copy-shift',(1-p)*45+'px')}
function tick(now){const dt=Math.min(40,now-(last||now-16));last=now;target=clamp(target,0,maximum());const y=scrollY+(target-scrollY)*(1-Math.exp(-dt/105));internal=true;window.scrollTo(0,Math.abs(target-y)<.5?target:y);internal=false;effects();if(Math.abs(target-scrollY)>.5)frame=requestAnimationFrame(tick);else{frame=0;last=0}}
function go(y){target=clamp(y,0,maximum());if(reduce.matches){scrollTo(0,target);return}if(!frame)frame=requestAnimationFrame(tick)}
function stop(){cancelAnimationFrame(frame);frame=0;last=0;target=scrollY}
addEventListener('wheel',event=>{if(reduce.matches||!fine.matches||event.ctrlKey||event.metaKey||Math.abs(event.deltaX)>Math.abs(event.deltaY)||document.querySelector('dialog[open]')||document.documentElement.classList.contains('loading-active'))return;event.preventDefault();if(!frame)target=scrollY;go(target+event.deltaY*(event.deltaMode===1?16:event.deltaMode===2?innerHeight:1))},{passive:false});
document.addEventListener('click',event=>{const a=event.target.closest('a[href^="#"]');if(!a)return;const id=a.getAttribute('href').slice(1),el=document.getElementById(id);if(!el)return;event.preventDefault();go(el.getBoundingClientRect().top+scrollY);history.replaceState(null,'','#'+id);el.setAttribute('tabindex','-1');el.focus({preventScroll:true})});
addEventListener('scroll',()=>{if(!frame&&!internal)target=scrollY;effects()},{passive:true});
addEventListener('touchstart',stop,{passive:true});addEventListener('pointerdown',stop,{passive:true});
addEventListener('keydown',event=>{if(['ArrowDown','ArrowUp','PageDown','PageUp','Home','End',' '].includes(event.key))stop()});
addEventListener('resize',()=>{stop();effects()});reduce.addEventListener('change',stop);effects();
})();

// Shared line language at the opening and closing, outside the locked intro.
document.querySelectorAll('#motion-field, #contact-field, #lab-field').forEach(canvas => {
  const ctx=canvas.getContext('2d');
  if(!ctx)return;
  const hero=canvas.closest('.creative-hero, footer, .lab-stage');
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  let width=0,height=0,frame=0,visible=true,time=0,last=0;
  const pointer={x:.75,y:.5,tx:.75,ty:.5,force:0,target:0};
  function draw(){
    ctx.clearRect(0,0,width,height);
    const lines=canvas.id==='contact-field'?24:width<600?38:60;
    const amplitude=Math.min(width*.22,280);
    const radius=Math.min(width*.42,350);
    for(let i=0;i<lines;i++){
      const lane=i/(lines-1);
      ctx.beginPath();
      for(let j=0;j<=70;j++){
        const v=j/70,y=v*(height+160)-80;
        const wave=Math.sin(v*4.6+time*.22+lane*2.2);
        let x=width*(.38+lane*.7)+wave*amplitude*Math.sin(v*Math.PI)+Math.sin(v*8-time*.15+lane*3)*35;
        const dx=x-pointer.x*width,dy=y-pointer.y*height;
        const falloff=Math.exp(-(dx*dx+dy*dy)/(radius*radius));
        x+=falloff*pointer.force*(dx*.38+Math.sin(v*12+time)*32);
        const py=y+falloff*pointer.force*dy*.15;
        if(j===0)ctx.moveTo(x,py);else ctx.lineTo(x,py);
      }
      const orange=i%7<2;
      ctx.strokeStyle=orange?'rgba(241,91,50,'+(.3+lane*.32)+')':'rgba(185,169,154,'+(.16+lane*.2)+')';
      ctx.lineWidth=orange?1.1:.7;ctx.stroke();
    }
  }
  function tick(now){
    frame=0;
    if(!visible||document.hidden||reduced.matches){last=0;return}
    const dt=Math.min((now-(last||now))/1000,.05);last=now;time+=dt;
    const ease=1-Math.exp(-dt*5);
    pointer.x+=(pointer.tx-pointer.x)*ease;pointer.y+=(pointer.ty-pointer.y)*ease;
    pointer.force+=(pointer.target-pointer.force)*ease;
    draw();frame=requestAnimationFrame(tick);
  }
  function start(){if(!frame&&visible&&!document.hidden&&!reduced.matches)frame=requestAnimationFrame(tick)}
  function resize(){
    width=hero.clientWidth;height=hero.clientHeight;
    const dpr=Math.min(devicePixelRatio||1,1.75);
    canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);
    ctx.setTransform(dpr,0,0,dpr,0,0);draw();start();
  }
  function interact(event){
    if(reduced.matches)return;
    const rect=hero.getBoundingClientRect();
    pointer.tx=(event.clientX-rect.left)/rect.width;
    pointer.ty=(event.clientY-rect.top)/rect.height;pointer.target=1;
  }
  hero.addEventListener('pointermove',interact,{passive:true});
  hero.addEventListener('pointerdown',interact,{passive:true});
  hero.addEventListener('pointerleave',()=>{pointer.target=0},{passive:true});
  hero.addEventListener('pointerup',event=>{if(event.pointerType!=='mouse')pointer.target=0},{passive:true});
  hero.addEventListener('pointercancel',()=>{pointer.target=0},{passive:true});
  new ResizeObserver(resize).observe(hero);
  new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;if(visible)start();else{cancelAnimationFrame(frame);frame=0;last=0}}).observe(hero);
  document.addEventListener('visibilitychange',()=>{if(document.hidden){cancelAnimationFrame(frame);frame=0;last=0}else start()});
  reduced.addEventListener('change',()=>{cancelAnimationFrame(frame);frame=0;last=0;pointer.force=0;draw();start()});
  resize();
});

// One orange thread changes from a vertical guide to an underline/divider.
(() => {
  const reduce=matchMedia('(prefers-reduced-motion: reduce)');
  const sections=[...document.querySelectorAll('.interlude,.work-intro,.practice,footer')];
  const copy=document.querySelector('.interlude-copy');
  let frame=0;
  const clamp=v=>Math.max(0,Math.min(1,v));
  function render(){
    frame=0;
    sections.forEach(section=>{
      const rect=section.getBoundingClientRect();
      const progress=reduce.matches?1:clamp((innerHeight*.9-rect.top)/(Math.min(rect.height,innerHeight)*.7));
      section.style.setProperty('--thread-progress',progress);
    });
    const rect=copy.getBoundingClientRect();
    const progress=reduce.matches?1:clamp((innerHeight*.85-rect.top)/(innerHeight*.4));
    copy.style.setProperty('--move-offset',(1-progress)*Math.min(innerWidth*.12,130)+'px');
    copy.style.setProperty('--move-turn',(1-progress)*-5+'deg');
  }
  function schedule(){if(!frame)frame=requestAnimationFrame(render)}
  addEventListener('scroll',schedule,{passive:true});
  addEventListener('resize',schedule);reduce.addEventListener('change',schedule);render();
})();
