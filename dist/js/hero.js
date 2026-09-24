import {clamp} from './scroll.js';

export function initHero(scene,preferences){
  const root=document.documentElement;
  const hero=document.getElementById('hero');
  const heroCenter=document.getElementById('hero-center');
  const creative=document.getElementById('creative');
  const designer=document.getElementById('designer');
  const mouseGlow=document.getElementById('mouse-glow');
  const cursorDot=document.getElementById('cursor-dot');
  const cursorRing=document.getElementById('cursor-ring');
  const loading=document.getElementById('loading');
  const loadingCount=document.getElementById('loading-count');
  if(!hero||!heroCenter||!creative||!designer||!loading||!loadingCount)return;

  [creative,designer].forEach(word=>{
    word.innerHTML=[...word.dataset.word].map(char=>'<span class="letter">'+char+'</span>').join('');
  });
  const letters=[...document.querySelectorAll('.letter')];

  const matchCreativeWidth=()=>{
    const chars=[...creative.querySelectorAll('.letter')];
    if(chars.length<2)return;
    creative.style.columnGap='0px';
    designer.style.columnGap='';
    const target=designer.getBoundingClientRect().width*.985;
    const base=creative.getBoundingClientRect().width;
    creative.style.columnGap=Math.max(2,(target-base)/(chars.length-1)).toFixed(2)+'px';
  };
  matchCreativeWidth();
  addEventListener('resize',matchCreativeWidth,{passive:true});
  document.fonts?.ready?.then(matchCreativeWidth);

  if(!preferences.reduceMotion.matches){
    creative.style.opacity='0';
    designer.style.opacity='0';
    creative.style.transform='translate3d(0,-34px,0)';
    designer.style.transform='translate3d(0,34px,0)';
  }

  let introFinished=false;
  let introStarted=false;
  const runIntro=()=>{
    if(introStarted)return;
    introStarted=true;
    if(preferences.reduceMotion.matches){
      creative.style.opacity='1';
      designer.style.opacity='1';
      creative.style.transform='none';
      designer.style.transform='none';
      hero.classList.add('intro-complete');
      introFinished=true;
      return;
    }
    const timing={duration:1450,easing:'cubic-bezier(.22,.78,.18,1)',fill:'both'};
    const first=creative.animate(
      [{opacity:0,transform:'translate3d(0,-34px,0)'},{opacity:1,transform:'translate3d(0,0,0)'}],
      timing
    );
    const second=designer.animate(
      [{opacity:0,transform:'translate3d(0,34px,0)'},{opacity:1,transform:'translate3d(0,0,0)'}],
      timing
    );
    Promise.all([first.finished,second.finished]).then(()=>{
      hero.classList.add('intro-complete');
      introFinished=true;
    });
  };

  let loadShown=0;
  let assetsReady=false;
  let loaderFinished=false;
  const pageReady=new Promise(resolve=>{
    if(document.readyState==='complete')resolve();
    else addEventListener('load',resolve,{once:true});
  });
  const fontsReady=document.fonts?.ready||Promise.resolve();
  Promise.all([pageReady,fontsReady]).then(()=>{assetsReady=true;});

  const loaderTick=()=>{
    if(loaderFinished)return;
    const target=assetsReady?100:92;
    loadShown+=Math.max(.32,(target-loadShown)*(assetsReady?.14:.055));
    if(!assetsReady)loadShown=Math.min(loadShown,92);
    if(loadShown>=99.6&&assetsReady){
      loadingCount.textContent='100%';
      loaderFinished=true;
      setTimeout(()=>{
        loading.classList.add('is-done');
        root.classList.remove('loading-active');
        setTimeout(runIntro,220);
      },220);
      return;
    }
    loadingCount.textContent=Math.floor(loadShown)+'%';
    requestAnimationFrame(loaderTick);
  };
  requestAnimationFrame(loaderTick);

  scene.subscribe(progress=>{
    const shift=progress*innerHeight*1.14;
    heroCenter.style.transform='translate3d(-50%,calc(-50% - '+shift.toFixed(1)+'px),0)';

    if(mouseGlow){
      const fadeProgress=clamp(progress*0.7);
      const glowScale=Math.max(0.58,1-fadeProgress*.42);
      const glowOpacity=Math.max(0,0.39-(fadeProgress*0.39));
      const whitePhase=clamp((progress-.14)/.2);
      const orangeMix=Math.max(0,1-whitePhase);
      const r=Math.round(241*orangeMix + 255*whitePhase);
      const g=Math.round((91*orangeMix) + 255*whitePhase);
      const b=Math.round((50*orangeMix) + 255*whitePhase);
      const a1=(.14*(1-whitePhase)) + (.06*whitePhase);
      const a2=(.07*(1-whitePhase)) + (.022*whitePhase);
      mouseGlow.style.background='radial-gradient(circle,rgba('+r+','+g+','+b+','+a1.toFixed(3)+') 0%,rgba('+r+','+g+','+b+','+a2.toFixed(3)+') 35%,rgba('+r+','+g+','+b+',0) 72%)';
      mouseGlow.style.opacity=String(glowOpacity.toFixed(3));
      mouseGlow.style.transform='translate3d(-50%,-50%,0) scale('+glowScale.toFixed(3)+')';
    }
  });

  if(!preferences.finePointer.matches)return;

  document.querySelectorAll('a,button,[role="button"]').forEach(element=>{
    element.addEventListener('pointerenter',()=>document.body.classList.add('cursor-interactive'));
    element.addEventListener('pointerleave',()=>document.body.classList.remove('cursor-interactive'));
  });

  let mx=innerWidth*.5;
  let my=innerHeight*.5;
  let ringX=mx;
  let ringY=my;
  let glowX=mx;
  let glowY=my;
  let pointerActive=false;
  const letterState=letters.map(()=>({x:0,y:0,tx:0,ty:0}));

  const setCustomCursorPosition=(x,y)=>{
    if(cursorDot){
      cursorDot.style.left=x+'px';
      cursorDot.style.top=y+'px';
      cursorDot.style.opacity='1';
      cursorDot.style.visibility='visible';
    }
    if(cursorRing){
      cursorRing.style.left=x+'px';
      cursorRing.style.top=y+'px';
      cursorRing.style.opacity='1';
      cursorRing.style.visibility='visible';
    }
  };

  if(cursorDot||cursorRing){
    setCustomCursorPosition(mx,my);
  }

  addEventListener('pointermove',event=>{
    mx=event.clientX;
    my=event.clientY;
    pointerActive=true;
    setCustomCursorPosition(mx,my);
  });
  addEventListener('pointerleave',()=>{
    pointerActive=false;
    document.body.classList.remove('cursor-interactive');
  });

  const cursorLoop=()=>{
    ringX+=(mx-ringX)*.22;
    ringY+=(my-ringY)*.22;
    glowX+=(mx-glowX)*.075;
    glowY+=(my-glowY)*.075;

    if(cursorRing){
      cursorRing.style.left=ringX+'px';
      cursorRing.style.top=ringY+'px';
    }
    if(mouseGlow){
      const rect=hero.getBoundingClientRect();
      mouseGlow.style.left=(glowX-rect.left)+'px';
      mouseGlow.style.top=(glowY-rect.top)+'px';
    }

    if(introFinished){
      letters.forEach((letter,index)=>{
        const state=letterState[index];
        if(pointerActive){
          const rect=letter.getBoundingClientRect();
          const dx=mx-(rect.left+rect.width/2);
          const dy=my-(rect.top+rect.height/2);
          const distance=Math.hypot(dx,dy);
          const radius=165;
          if(distance<radius&&distance>.001){
            const force=(1-distance/radius)*8.5;
            state.tx=dx/distance*force;
            state.ty=dy/distance*force;
          }else{
            state.tx=0;
            state.ty=0;
          }
        }else{
          state.tx=0;
          state.ty=0;
        }
        state.x+=(state.tx-state.x)*.14;
        state.y+=(state.ty-state.y)*.14;
        letter.style.transform='translate3d('+state.x.toFixed(2)+'px,'+state.y.toFixed(2)+'px,0)';
      });
    }
    requestAnimationFrame(cursorLoop);
  };
  requestAnimationFrame(cursorLoop);
}
