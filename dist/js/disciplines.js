const REST_OFFSET = -20;

const descriptions = [
  "Brand systems · Art direction · Identity",
  "Animation · Kinetic type · Motion direction",
  "Digital products · Interfaces · Interaction",
  "Creative AI · Experiments · Visual systems",
];

export function initDisciplines(preferences) {
  const section = document.querySelector(".disciplines-section");
  if (!section) return;

  const cubeScene = section.querySelector(".disciplines-cube-scene");
  const cube = section.querySelector(".disciplines-cube");
  const counter = section.querySelector(".disciplines-counter");
  const focusCopy = section.querySelector(".disciplines-focus-copy");
  const backgroundLayers = section.querySelectorAll(".disciplines-bg-image");
  const wordLayers = section.querySelectorAll(".disciplines-word-layer");
  const letters = section.querySelectorAll(".disciplines-letter");

  if (!cubeScene || !cube || !counter || !focusCopy) return;

  let currentRotation = REST_OFFSET;
  let targetRotation = REST_OFFSET;
  let currentY = 0;
  let targetY = 0;
  let currentZ = 0;
  let targetZ = 0;
  let currentTranslateY = 0;
  let targetTranslateY = 0;
  let pointerX = window.innerWidth * 0.5;
  let pointerY = window.innerHeight * 0.5;
  let pointerActive = false;
  let magnetX = 0;
  let magnetY = 0;
  let magnetTargetX = 0;
  let magnetTargetY = 0;
  let currentIndex = -1;

  const letterState = Array.from(letters, () => ({ x: 0, y: 0, tx: 0, ty: 0 }));
  const clamp = (value, min, max) => Math.min(Math.max(value, min), max);
  const pointerEnabled = () => preferences.finePointer.matches && !preferences.reduceMotion.matches;

  const getFaceIndex = (value) => {
    const steps = Math.round(-(value - REST_OFFSET) / 90);
    return ((steps % 4) + 4) % 4;
  };

  const setActiveCategory = (index) => {
    backgroundLayers.forEach((layer, layerIndex) => layer.classList.toggle("is-active", layerIndex === index));
    wordLayers.forEach((layer, layerIndex) => layer.classList.toggle("is-active", layerIndex === index));
    counter.textContent = `${String(index + 1).padStart(2, "0")} / 04`;
    focusCopy.textContent = descriptions[index];
  };

  const updateMeta = (rotation) => {
    const index = getFaceIndex(rotation);
    if (index === currentIndex) return;
    currentIndex = index;
    setActiveCategory(index);
  };

  const updateScrollTarget = () => {
    if (preferences.reduceMotion.matches) {
      targetRotation = REST_OFFSET;
      targetY = 0;
      targetZ = 0;
      targetTranslateY = 0;
      return;
    }

    const rect = section.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    const progress = clamp((viewportHeight - rect.top) / (viewportHeight + rect.height), 0, 1);
    targetRotation = REST_OFFSET - progress * 360;
    targetY = (progress - 0.5) * 12;
    targetZ = (progress - 0.5) * 2;
    targetTranslateY = -(progress * viewportHeight * 0.2);
  };

  if (pointerEnabled()) {
    window.addEventListener("pointermove", (event) => {
      pointerX = event.clientX;
      pointerY = event.clientY;
      pointerActive = true;
    }, { passive: true });
    window.addEventListener("pointerleave", () => { pointerActive = false; }, { passive: true });
  }

  const render = () => {
    const easing = 0.09;
    currentRotation += (targetRotation - currentRotation) * easing;
    currentY += (targetY - currentY) * easing;
    currentZ += (targetZ - currentZ) * easing;
    currentTranslateY += (targetTranslateY - currentTranslateY) * easing;

    if (pointerEnabled()) {
      const rect = cube.getBoundingClientRect();
      const dx = pointerX - (rect.left + rect.width * 0.5);
      const dy = pointerY - (rect.top + rect.height * 0.5);
      const nearestX = clamp(pointerX, rect.left, rect.right);
      const nearestY = clamp(pointerY, rect.top, rect.bottom);
      const distance = Math.hypot(pointerX - nearestX, pointerY - nearestY);
      const directionDistance = Math.hypot(dx, dy);

      if (pointerActive && distance < 280 && directionDistance > 0.001) {
        const strength = 1 - distance / 280;
        magnetTargetX = (dx / directionDistance) * strength * 20;
        magnetTargetY = (dy / directionDistance) * strength * 14;
      } else {
        magnetTargetX = 0;
        magnetTargetY = 0;
      }
    } else {
      magnetTargetX = 0;
      magnetTargetY = 0;
    }

    magnetX += (magnetTargetX - magnetX) * 0.1;
    magnetY += (magnetTargetY - magnetY) * 0.1;

    letters.forEach((letter, index) => {
      const state = letterState[index];
      if (pointerEnabled()) {
        const rect = letter.getBoundingClientRect();
        const dx = pointerX - (rect.left + rect.width * 0.5);
        const dy = pointerY - (rect.top + rect.height * 0.5);
        const distance = Math.hypot(dx, dy);
        if (pointerActive && distance < 165 && distance > 0.001) {
          const force = (1 - distance / 165) * 6;
          state.tx = (dx / distance) * force;
          state.ty = (dy / distance) * force;
        } else {
          state.tx = 0;
          state.ty = 0;
        }
      } else {
        state.tx = 0;
        state.ty = 0;
      }
      state.x += (state.tx - state.x) * 0.14;
      state.y += (state.ty - state.y) * 0.14;
      letter.style.transform = `translate3d(${state.x.toFixed(2)}px, ${state.y.toFixed(2)}px, 0)`;
    });

    cube.style.transform = `translate3d(${magnetX}px, ${currentTranslateY + magnetY}px, 0) rotateX(${currentRotation - magnetY * 0.05}deg) rotateY(${currentY + magnetX * 0.08}deg) rotateZ(${currentZ}deg)`;
    updateMeta(currentRotation);
    requestAnimationFrame(render);
  };

  cubeScene.classList.add("is-visible");
  updateMeta(REST_OFFSET);
  updateScrollTarget();
  window.addEventListener("scroll", updateScrollTarget, { passive: true });
  window.addEventListener("resize", updateScrollTarget, { passive: true });
  requestAnimationFrame(render);
}
