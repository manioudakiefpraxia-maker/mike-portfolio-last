export function initMenu(preferences){
  const root=document.documentElement;
  const menu=document.getElementById('menu');
  const openButton=document.getElementById('menu-open');
  const closeButton=document.getElementById('menu-close');
  if(!menu||!openButton||!closeButton)return;

  let closeTimer=0;

  const setMenuState=(isOpen)=>{
    root.classList.toggle('menu-active',isOpen);
    openButton.setAttribute('aria-expanded',String(isOpen));
    if(isOpen){
      if(!menu.open)menu.showModal();
      requestAnimationFrame(()=>menu.classList.add('is-visible'));
      return;
    }
    menu.classList.remove('is-visible');
  };

  const close=()=>{
    if(!menu.open)return;
    setMenuState(false);
    clearTimeout(closeTimer);
    closeTimer=setTimeout(()=>{
      if(menu.open)menu.close();
    },preferences.reduceMotion.matches?0:450);
  };

  const open=()=>{
    clearTimeout(closeTimer);
    setMenuState(true);
  };

  openButton.addEventListener('click',open);
  closeButton.addEventListener('click',close);
  menu.addEventListener('cancel',event=>{event.preventDefault();close();});
  menu.querySelectorAll('a').forEach(link=>link.addEventListener('click',close));
  addEventListener('keydown',event=>{if(event.key==='Escape')close();});

  const scrambleChars='ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789+-*#@%<>[]{}';
  document.querySelectorAll('.scramble-link').forEach(link=>{
    const finalText=link.dataset.label||link.textContent.trim();
    link.textContent=finalText;
    requestAnimationFrame(()=>{link.style.width=Math.ceil(link.getBoundingClientRect().width)+'px';});
    let timer=0;
    let frame=0;

    const reset=()=>{
      clearInterval(timer);
      link.textContent=finalText;
    };

    const scramble=()=>{
      clearInterval(timer);
      frame=0;
      const totalFrames=Math.max(10,finalText.length*3);
      timer=setInterval(()=>{
        frame++;
        const reveal=Math.floor((frame/totalFrames)*finalText.length);
        link.textContent=[...finalText].map((char,index)=>{
          return index<reveal?char:scrambleChars[Math.floor(Math.random()*scrambleChars.length)];
        }).join('');
        if(frame>=totalFrames)reset();
      },34);
    };

    link.addEventListener('pointerenter',scramble);
    link.addEventListener('focus',scramble);
    link.addEventListener('pointerleave',reset);
    link.addEventListener('blur',reset);
  });
}
