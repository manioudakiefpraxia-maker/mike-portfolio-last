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
  const backgrounds=[...disciplinesSection.querySelectorAll('.disciplines-bg-image')];

  const REST_OFFSET=-20;
  const names=['GRAPHIC','MOTION','WEB','AI'];
  const descriptions=[
    'Brand systems · Art direction · Identity',
    'Animation · Kinetic type · Motion direction',
    'Digital products · Interfaces · Interaction',
    'Creative AI · Experiments · Visual systems'
  ];

  let currentRotation=REST_OFFSET;
  let targetRotation=REST_OFFSET;
  let currentRotateY=0;
  let targetRotateY=0;
  let currentRotateZ=0;
  let targetRotateZ=0;
  let currentTranslateY=0;
  let targetTranslateY=0;
  let sectionStart=0;
  let sectionRange=1;
  let currentIndex=-1;
  let metaTimer=0;
  let rafId=0;

  const clamp=(value,min,max)=>Math.min(Math.max(value,min),max);

  function getFaceIndex(rotation){
    const steps=Math.round(-(rotation-REST_OFFSET)/90);
    return clamp(steps,0,3);
  }

  function setBackground(index){
    backgrounds.forEach((background,i)=>{
      background.classList.toggle('is-active',i===index);
    });
  }

  function updateMeta(rotation,force=false){
    const index=getFaceIndex(rotation);
    if(!force&&index===currentIndex)return;
    currentIndex=index;
    setBackground(index);
    clearTimeout(metaTimer);
    giantWord.classList.add('is-changing');
    focus.classList.add('is-changing');
    metaTimer=window.setTimeout(()=>{
      giantWord.textContent=names[index];
      counter.textContent=`${String(index+1).padStart(2,'0')} / 04`;
      focusCopy.textContent=descriptions[index];
      giantWord.classList.remove('is-changing');
      focus.classList.remove('is-changing');
    },120);
  }

  function measureSection(){
    const rect=disciplinesSection.getBoundingClientRect();
    sectionStart=window.scrollY+rect.top;
    sectionRange=Math.max(disciplinesSection.offsetHeight,window.innerHeight,1);
  }

  function updateScrollTarget(){
    if(preferences.reduceMotion.matches){
      targetRotation=REST_OFFSET;
      targetRotateY=0;
      targetRotateZ=0;
      targetTranslateY=0;
      return;
    }

    const progress=clamp((window.scrollY-sectionStart)/sectionRange,0,1);
    const travelRatio=window.innerWidth<=768?.18:.25;

    targetRotation=REST_OFFSET-(progress*270);
    targetRotateY=(progress-.5)*8;
    targetRotateZ=(progress-.5)*1.5;
    targetTranslateY=(.05-progress*travelRatio)*window.innerHeight;
  }

  function renderCube(){
    const easing=.095;

    currentRotation+=(targetRotation-currentRotation)*easing;
    currentRotateY+=(targetRotateY-currentRotateY)*easing;
    currentRotateZ+=(targetRotateZ-currentRotateZ)*easing;
    currentTranslateY+=(targetTranslateY-currentTranslateY)*easing;

    cube.style.transform=`translate3d(0,${currentTranslateY}px,0) rotateX(${currentRotation}deg) rotateY(${currentRotateY}deg) rotateZ(${currentRotateZ}deg)`;
    updateMeta(currentRotation);

    const delta=
      Math.abs(targetRotation-currentRotation)+
      Math.abs(targetRotateY-currentRotateY)+
      Math.abs(targetRotateZ-currentRotateZ)+
      Math.abs(targetTranslateY-currentTranslateY);

    if(delta>.08){
      rafId=requestAnimationFrame(renderCube);
    }else{
      currentRotation=targetRotation;
      currentRotateY=targetRotateY;
      currentRotateZ=targetRotateZ;
      currentTranslateY=targetTranslateY;
      cube.style.transform=`translate3d(0,${currentTranslateY}px,0) rotateX(${currentRotation}deg) rotateY(${currentRotateY}deg) rotateZ(${currentRotateZ}deg)`;
      updateMeta(currentRotation);
      rafId=0;
    }
  }

  function scheduleRender(){
    if(!rafId)rafId=requestAnimationFrame(renderCube);
  }

  function onScroll(){
    updateScrollTarget();
    scheduleRender();
  }

  function onResize(){
    measureSection();
    updateScrollTarget();
    scheduleRender();
  }

  cubeScene.classList.add('is-visible');
  giantWord.classList.add('is-visible');
  measureSection();
  updateScrollTarget();
  updateMeta(REST_OFFSET,true);
  scheduleRender();

  window.addEventListener('scroll',onScroll,{passive:true});
  window.addEventListener('resize',onResize,{passive:true});
  preferences.reduceMotion.addEventListener?.('change',onResize);
}

initMenu(preferences);
initHero(scene,preferences);
initParticles(scene,preferences);
initBio(scene);
initAudio();
scene.start();
