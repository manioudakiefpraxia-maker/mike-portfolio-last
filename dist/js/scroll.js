export const clamp=(value,min=0,max=1)=>Math.max(min,Math.min(max,value));

export function createScrollScene(stage,preferences){
  const listeners=new Set();
  const root=document.documentElement;
  const menu=document.getElementById('menu');
  let target=0;
  let current=0;
  let frame=0;
  let wheelFrame=0;
  let wheelCurrent=scrollY;
  let wheelTarget=scrollY;
  let internalScroll=false;

  const measure=()=>{
    const travel=Math.max(1,stage.offsetHeight-innerHeight);
    return clamp(-stage.getBoundingClientRect().top/travel);
  };

  const notify=()=>{
    listeners.forEach(listener=>listener(current,target));
  };

  const render=()=>{
    frame=0;
    if(preferences.reduceMotion.matches)current=target;
    else current+=(target-current)*.12;
    if(Math.abs(target-current)<.00045)current=target;
    notify();
    if(current!==target)frame=requestAnimationFrame(render);
  };

  const read=()=>{
    target=measure();
    if(!frame)frame=requestAnimationFrame(render);
  };

  const maxScroll=()=>Math.max(0,root.scrollHeight-innerHeight);

  const wheelStep=()=>{
    const diff=wheelTarget-wheelCurrent;
    wheelCurrent+=diff*.11;
    if(Math.abs(diff)<.42){
      wheelCurrent=wheelTarget;
      internalScroll=true;
      scrollTo(0,wheelCurrent);
      internalScroll=false;
      wheelFrame=0;
      return;
    }
    internalScroll=true;
    scrollTo(0,wheelCurrent);
    internalScroll=false;
    wheelFrame=requestAnimationFrame(wheelStep);
  };

  const onWheel=event=>{
    if(preferences.reduceMotion.matches||!preferences.finePointer.matches)return;
    if(event.ctrlKey||event.metaKey||Math.abs(event.deltaX)>Math.abs(event.deltaY))return;
    if(menu?.open||root.classList.contains('loading-active'))return;
    event.preventDefault();
    const scale=event.deltaMode===1?16:event.deltaMode===2?innerHeight:1;
    wheelTarget=clamp(wheelTarget+event.deltaY*scale*.68,0,maxScroll());
    if(!wheelFrame){
      wheelCurrent=scrollY;
      wheelFrame=requestAnimationFrame(wheelStep);
    }
  };

  const cancelWheel=()=>{
    if(!wheelFrame)return;
    cancelAnimationFrame(wheelFrame);
    wheelFrame=0;
    wheelCurrent=wheelTarget=scrollY;
  };

  return{
    subscribe(listener){
      listeners.add(listener);
      listener(current,target);
      return()=>listeners.delete(listener);
    },
    start(){
      addEventListener('scroll',()=>{
        if(!wheelFrame&&!internalScroll)wheelCurrent=wheelTarget=scrollY;
        read();
      },{passive:true});
      addEventListener('resize',read,{passive:true});
      addEventListener('orientationchange',read,{passive:true});
      addEventListener('wheel',onWheel,{passive:false});
      addEventListener('pointerdown',cancelWheel,{passive:true});
      read();
    }
  };
}
