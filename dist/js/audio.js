export function initAudio(){
  const toggle=document.getElementById('sound-toggle');
  const hint=document.getElementById('sound-hint');
  if(!toggle)return;

  let soundOn=true;
  let userMuted=false;
  let activated=false;
  let primed=false;
  let context=null;

  const music=new Audio('./Deep%20Space%20Drones.mp3');
  music.loop=true;
  music.preload='auto';
  music.volume=.78;
  music.playsInline=true;
  music.setAttribute('playsinline','');
  music.setAttribute('webkit-playsinline','');

  const updateLabel=()=>{
    toggle.textContent=soundOn?'SOUND ON':'SOUND OFF';
    toggle.setAttribute('aria-pressed',String(soundOn));
    hint?.classList.toggle('is-hidden',!soundOn||userMuted||activated);
  };

  const ensureContext=()=>{
    if(context)return context;
    const AudioContext=window.AudioContext||window.webkitAudioContext;
    if(!AudioContext)return null;
    context=new AudioContext();
    return context;
  };

  const resumeContext=()=>{
    const ctx=ensureContext();
    if(ctx&&ctx.state!=='running')ctx.resume().catch(()=>{});
    return ctx;
  };

  const primeMuted=()=>{
    if(userMuted||primed)return;
    primed=true;
    music.muted=true;
    try{
      const promise=music.play();
      promise?.catch(()=>{primed=false;});
    }catch(_){
      primed=false;
    }
  };

  const unlock=()=>{
    if(userMuted)return;
    soundOn=true;
    music.muted=false;
    music.volume=.78;
    resumeContext();
    updateLabel();

    try{
      const promise=music.play();
      if(promise?.then){
        promise.then(()=>{
          activated=true;
          updateLabel();
        }).catch(()=>{
          activated=false;
          updateLabel();
        });
      }else{
        activated=!music.paused;
        updateLabel();
      }
    }catch(_){
      activated=false;
      updateLabel();
    }
  };

  const turnOff=()=>{
    soundOn=false;
    userMuted=true;
    activated=false;
    music.pause();
    music.muted=false;
    updateLabel();
  };

  const gestureUnlock=event=>{
    if(event?.target===toggle||userMuted||!soundOn)return;
    unlock();
  };

  ['touchstart','pointerdown','touchend','pointerup','click','keydown'].forEach(type=>{
    window.addEventListener(type,gestureUnlock,{capture:true,passive:type!=='click'&&type!=='keydown'});
  });

  toggle.addEventListener('click',event=>{
    event.stopPropagation();
    if(soundOn&&activated)turnOff();
    else{
      userMuted=false;
      soundOn=true;
      unlock();
    }
  });

  const playHover=()=>{
    if(!soundOn)return;
    const ctx=resumeContext();
    if(!ctx||ctx.state!=='running')return;
    const now=ctx.currentTime;
    const oscillator=ctx.createOscillator();
    const gain=ctx.createGain();
    oscillator.type='sine';
    oscillator.frequency.setValueAtTime(820,now);
    oscillator.frequency.exponentialRampToValueAtTime(1300,now+.07);
    gain.gain.setValueAtTime(.0001,now);
    gain.gain.linearRampToValueAtTime(.062,now+.009);
    gain.gain.exponentialRampToValueAtTime(.0001,now+.13);
    oscillator.connect(gain);
    gain.connect(ctx.destination);
    oscillator.start(now);
    oscillator.stop(now+.14);
  };

  const playClick=()=>{
    if(!soundOn)return;
    const ctx=resumeContext();
    if(!ctx||ctx.state!=='running')return;
    const now=ctx.currentTime;
    const oscillator=ctx.createOscillator();
    const gain=ctx.createGain();
    oscillator.type='triangle';
    oscillator.frequency.setValueAtTime(1300,now);
    oscillator.frequency.exponentialRampToValueAtTime(700,now+.05);
    gain.gain.setValueAtTime(.075,now);
    gain.gain.exponentialRampToValueAtTime(.0001,now+.09);
    oscillator.connect(gain);
    gain.connect(ctx.destination);
    oscillator.start(now);
    oscillator.stop(now+.10);
  };

  document.querySelectorAll('a,button,[role="button"],input,select,textarea,summary,[tabindex]:not([tabindex="-1"])')
    .forEach(element=>element.addEventListener('pointerenter',playHover,{passive:true}));
  document.addEventListener('click',event=>{
    if(event.target instanceof Element&&event.target.closest('a[href]'))playClick();
  });

  music.addEventListener('playing',()=>{
    if(!soundOn||userMuted){
      music.pause();
      return;
    }
    if(!music.muted){
      activated=true;
      updateLabel();
    }
  });
  music.addEventListener('pause',()=>{
    if(soundOn&&!userMuted&&!music.muted){
      activated=false;
      updateLabel();
    }
  });
  music.addEventListener('error',()=>{
    activated=false;
    updateLabel();
  });

  updateLabel();
  music.load();
  primeMuted();
  music.muted=false;
  try{
    const initial=music.play();
    initial?.then(()=>{
      activated=true;
      updateLabel();
    }).catch(()=>{
      activated=false;
      primeMuted();
      updateLabel();
    });
  }catch(_){
    primeMuted();
  }
}
