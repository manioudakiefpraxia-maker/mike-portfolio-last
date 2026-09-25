import { createScrollScene } from "./scroll.js";
import { initMenu } from "./menu.js";
import { initHero } from "./hero.js";
import { initParticles } from "./particles.js";
import { initBio } from "./bio.js";
import { initAudio } from "./audio.js";
import { initDisciplines } from "./disciplines.js";

const stage = document.getElementById("scroll-stage");
const hero = document.getElementById("hero");

if (!stage || !hero) {
  throw new Error("Portfolio home: required scene elements are missing.");
}

const preferences = {
  reduceMotion: matchMedia("(prefers-reduced-motion: reduce)"),
  finePointer: matchMedia("(pointer:fine)"),
};

const scene = createScrollScene(stage, preferences);

initMenu(preferences);
initHero(scene, preferences);
initParticles(scene, preferences);
initBio(scene);
initAudio();
initDisciplines(preferences);
scene.start();
