import {createScrollScene} from './scroll.js';
import {initMenu} from './menu.js';
import {initHero} from './hero.js';
import {initParticles} from './particles.js';
import {initBio} from './bio.js';
import {initAudio} from './audio.js';

const stage=document.getElementById('scroll-stage');
const hero=document.getElementById('hero');
if(!stage||!hero)throw new Error('Portfolio home: required scene elements are missing.');

const mouseGlow=document.getElementById('mouse-glow');
const workSection=document.getElementById('work');
const disciplinesSection=document.querySelector('.disciplines-section');

const preferences={
  reduceMotion:matchMedia('(prefers-reduced-motion: reduce)'),
  finePointer:matchMedia('(pointer:fine)')
};

const scene=createScrollScene(stage,preferences);

if(disciplinesSection){
  const giantWord=disciplinesSection.querySelector('.disciplines-giant-word');
  const cubeScene=disciplinesSection.querySelector('.disciplines-cube-scene');
  const cube=disciplinesSection.querySelector('.disciplines-cube');
  const counter=disciplinesSection.querySelector('.disciplines-counter');
  const focus=disciplinesSection.querySelector('.disciplines-focus');
  const focusCopy=disciplinesSection.querySelector('.disciplines-focus-copy');
  const disciplinesLinks=disciplinesSection.querySelectorAll('.disciplines-link');
  const REST_OFFSET=-20;
  const names=['GRAPHIC','MOTION','WEB','AI'];
  const descriptions=[
    'Brand systems · Art direction · Identity',
    'Animation · Kinetic type · Motion direction',
    'Digital products · Interfaces · Interaction',
    'Creative AI · Experiments · Visual systems'
  ];

  let rotation=0;
  let startRotation=0;
  let pointerStartX=0;
  let pointerStartY=0;
  let isDragging=false;
  let didDrag=false;
  let introPlayed=false;
  let interactionEnabled=false;
  let currentIndex=-1;
  let metaTimer;

  function getFaceIndex(value){
    const steps=Math.round(-(value-REST_OFFSET)/90);
    return ((steps%4)+4)%4;
  }

  function updateMeta(value,force=false){
    const index=getFaceIndex(value);
    if(!force&&index===currentIndex)return;
    currentIndex=index;
    clearTimeout(metaTimer);
    giantWord.classList.add('is-changing');
    focus.classList.add('is-changing');
    metaTimer=setTimeout(()=>{
      giantWord.textContent=names[index];
      counter.textContent=`${String(index+1).padStart(2,'0')} / 04`;
      focusCopy.textContent=descriptions[index];
      giantWord.classList.remove('is-changing');
      focus.classList.remove('is-changing');
    },145);
  }

  function setCubeRotation(value,smooth=false){
    rotation=value;
    cube.style.transition=smooth?'transform .72s cubic-bezier(.16,1,.3,1)':'none';
    cube.style.transform=`rotateX(${rotation}deg)`;
    updateMeta(rotation);
  }

  function getNearestRest(value){
    const step=Math.round((value-REST_OFFSET)/90);
    return step*90+REST_OFFSET;
  }

  function snapCube(){
    setCubeRotation(getNearestRest(rotation),true);
  }

  function moveOneFace(direction){
    if(!interactionEnabled)return;
    setCubeRotation(getNearestRest(rotation)+direction*90,true);
  }

  function runIntro(){
    if(introPlayed)return;
    introPlayed=true;
    cubeScene.classList.add('is-visible');
    if(preferences.reduceMotion.matches){
      rotation=REST_OFFSET;
      cube.style.transform=`rotateX(${REST_OFFSET}deg)`;
      interactionEnabled=true;
      updateMeta(rotation);
      giantWord.classList.add('is-visible');
      return;
    }
    cube.classList.add('is-intro-spinning');
    window.setTimeout(()=>{
      giantWord.classList.add('is-visible');
    },1900);
    cube.addEventListener('animationend',()=>{
      cube.classList.remove('is-intro-spinning');
      cube.style.animation='none';
      rotation=REST_OFFSET;
      cube.style.transition='none';
      cube.style.transform=`rotateX(${REST_OFFSET}deg)`;
      interactionEnabled=true;
      updateMeta(rotation);
    },{once:true});
  }

  const introObserver=new IntersectionObserver((entries)=>{
    entries.forEach((entry)=>{
      if(entry.isIntersecting){
        runIntro();
        introObserver.disconnect();
      }
    });
  },{threshold:0,rootMargin:'-38% 0px -38% 0px'});
  introObserver.observe(cubeScene);

  cubeScene.addEventListener('pointerdown',(event)=>{
    if(!interactionEnabled)return;
    isDragging=true;
    didDrag=false;
    pointerStartX=event.clientX;
    pointerStartY=event.clientY;
    startRotation=rotation;
    cubeScene.classList.add('is-dragging');
    cube.style.transition='none';
  });

  cubeScene.addEventListener('pointermove',(event)=>{
    if(!isDragging)return;
    const deltaX=event.clientX-pointerStartX;
    const deltaY=event.clientY-pointerStartY;
    if(Math.abs(deltaX)>6||Math.abs(deltaY)>6){
      didDrag=true;
      if(!cubeScene.hasPointerCapture(event.pointerId)){
        cubeScene.setPointerCapture(event.pointerId);
      }
    }
    setCubeRotation(startRotation-deltaY*.72,false);
  });

  function finishDrag(event){
    if(!isDragging)return;
    isDragging=false;
    cubeScene.classList.remove('is-dragging');
    if(cubeScene.hasPointerCapture(event.pointerId)){
      cubeScene.releasePointerCapture(event.pointerId);
    }
    snapCube();
  }

  cubeScene.addEventListener('pointerup',finishDrag);
  cubeScene.addEventListener('pointercancel',finishDrag);

  disciplinesLinks.forEach(link=>{
    link.addEventListener('dragstart',(event)=>{
      event.preventDefault();
    });
    link.addEventListener('click',(event)=>{
      if(didDrag){
        event.preventDefault();
        event.stopPropagation();
        didDrag=false;
      }
    });
  });
  cubeScene.addEventListener('keydown',(event)=>{
    if(!interactionEnabled)return;
    if(event.key==='ArrowDown'){
      event.preventDefault();
      moveOneFace(-1);
    }else if(event.key==='ArrowUp'){
      event.preventDefault();
      moveOneFace(1);
    }
  });

  cube.style.transform='rotateX(0deg)';
  updateMeta(REST_OFFSET,true);
}

initMenu(preferences);
initHero(scene,preferences);
initParticles(scene,preferences);
initBio(scene);
initAudio();
scene.start();
