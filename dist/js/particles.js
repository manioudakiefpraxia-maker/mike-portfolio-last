import {clamp} from './scroll.js';

export function initParticles(scene,preferences){
  const canvas=document.getElementById('particles');
  if(!canvas)return;
  const ctx=canvas.getContext('2d',{alpha:true});
  if(!ctx)return;

  let cw=0;
  let ch=0;
  let viewW=0;
  let viewH=0;
  let padX=0;
  let padY=0;
  let dpr=1;
  let particles=[];
  let autoAngle=0;
  let fieldX=0;
  let fieldY=0;
  let targetFieldX=0;
  let targetFieldY=0;
  let progress=0;
  let frame=0;
  let mx=innerWidth*.5;
  let my=innerHeight*.5;

  const tiers=[
    {size:.60,alpha:.20,parallax:.62},
    {size:.78,alpha:.24,parallax:.82},
    {size:.98,alpha:.28,parallax:1.02},
    {size:1.22,alpha:.33,parallax:1.24}
  ];

  const makeParticles=()=>{
    const baseCount=innerWidth<700?72:150;
    const count=Math.round(baseCount*1.2);
    particles=Array.from({length:count},()=>{
      const u=Math.random()*2-1;
      const theta=Math.random()*Math.PI*2;
      const shell=.5+Math.random()*.65;
      const radial=Math.sqrt(Math.max(0,1-u*u));
      const tier=Math.floor(Math.random()*tiers.length);
      const spec=tiers[tier];
      const variation=.95+Math.random()*.18;
      const sizeBias=(Math.random() < .5 ? 1.15 : 0.85) * (1 + (Math.random() - .5) * .15);
      const intensityBoost=1.2 + Math.random() * .2;
      return{
        x:Math.cos(theta)*radial*shell,
        y:u*shell*.88,
        z:Math.sin(theta)*radial*shell,
        size:spec.size*variation*sizeBias,
        alpha:(spec.alpha+Math.random()*.18)*intensityBoost,
        parallax:spec.parallax*1.08,
        fadeOffset:(Math.random()-.5)*.16,
        orange:Math.random()<.23,
        drift:(Math.random()-.5)*.0009,
        phase:Math.random()*Math.PI*2
      };
    });
  };

  const resize=()=>{
    const nextW=innerWidth;
    const nextH=innerHeight;
    if(!preferences.finePointer.matches&&viewW&&Math.abs(nextW-viewW)<=2)return;

    viewW=nextW;
    viewH=nextH;
    dpr=Math.min(devicePixelRatio||1,preferences.finePointer.matches?2:1.5);
    padX=viewW*.18;
    padY=viewH*.18;
    cw=viewW+padX*2;
    ch=viewH+padY*2;
    canvas.width=Math.round(cw*dpr);
    canvas.height=Math.round(ch*dpr);
    canvas.style.width=cw+'px';
    canvas.style.height=ch+'px';
    canvas.style.left=-padX+'px';
    canvas.style.top=-padY+'px';
    ctx.setTransform(dpr,0,0,dpr,0,0);
    makeParticles();
    start();
  };

  const rotatePoint=(point,ax,ay)=>{
    const cy=Math.cos(ay);
    const sy=Math.sin(ay);
    const cx=Math.cos(ax);
    const sx=Math.sin(ax);
    const x=point.x*cy-point.z*sy;
    let z=point.x*sy+point.z*cy;
    const y=point.y*cx-z*sx;
    z=point.y*sx+z*cx;
    return{x,y,z};
  };

  const draw=time=>{
    frame=0;
    if(document.hidden||progress>=.999){
      ctx.clearRect(0,0,cw,ch);
      return;
    }

    ctx.clearRect(0,0,cw,ch);
    if(preferences.finePointer.matches){
      targetFieldX=((mx/viewW)-.5)*92;
      targetFieldY=((my/viewH)-.5)*38;
    }
    fieldX+=(targetFieldX-fieldX)*.11;
    fieldY+=(targetFieldY-fieldY)*.055;
    autoAngle+=preferences.reduceMotion.matches?0:.00042;

    const field=Math.max(viewW,viewH)*1.02;
    const centerX=cw*.5;
    const centerY=ch*.5;

    particles.forEach(particle=>{
      particle.phase+=particle.drift*1.2;
      const wobble=Math.sin(time*.00018+particle.phase)*.018;
      const point=rotatePoint(
        {x:particle.x*(1+wobble),y:particle.y,z:particle.z},
        .12,
        -.18+autoAngle
      );
      const perspective=1/(1.72-point.z*.42);
      const depth=clamp((point.z+1.15)/2.3,.15,1);
      const depthParallax=particle.parallax*(.78+depth*.42);
      const x=centerX+point.x*field*perspective+fieldX*depthParallax;
      const y=centerY+point.y*field*perspective+fieldY*(.68+depth*.34)*particle.parallax;
      const radius=particle.size*(.72+depth*.96)*1.12;

      let fade=1;
      if(progress>.30){
        const sweep=clamp((progress-.30)/.62);
        const fadeFront=1.16-sweep*1.34;
        const fadeWidth=.34;
        const screenY=(y-padY)/Math.max(1,viewH)+particle.fadeOffset;
        fade=clamp((fadeFront-screenY+fadeWidth*.5)/fadeWidth);
        fade=fade*fade*(3-2*fade);
      }

      const alpha=particle.alpha*(.64+depth*.86)*fade*1.2;
      if(alpha<=.002)return;
      ctx.beginPath();
      ctx.arc(x,y,radius,0,Math.PI*2);
      ctx.fillStyle=particle.orange?'rgba(241,91,50,'+alpha+')':'rgba(245,245,245,'+alpha+')';
      ctx.fill();
    });

    frame=requestAnimationFrame(draw);
  };

  const start=()=>{
    if(!frame&&!document.hidden&&progress<.999)frame=requestAnimationFrame(draw);
  };

  scene.subscribe(value=>{
    progress=value;
    canvas.style.opacity=String(1-clamp((progress-.94)/.06));
    start();
  });

  if(preferences.finePointer.matches){
    addEventListener('pointermove',event=>{
      mx=event.clientX;
      my=event.clientY;
    },{passive:true});
  }

  addEventListener('resize',resize,{passive:true});
  addEventListener('orientationchange',resize,{passive:true});
  document.addEventListener('visibilitychange',start);
  resize();
}
