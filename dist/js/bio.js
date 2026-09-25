const ENTER_THRESHOLD = 0.57;
const SECONDARY_THRESHOLD = 0.78;

export function initBio(scene) {
  const copy = document.getElementById("bio-copy");
  if (!copy) return;

  const primary = copy.querySelector(".bio-text:not(.bio-text-secondary)");
  const secondary = copy.querySelector(".bio-text-secondary");
  if (!primary || !secondary) return;

  primary.textContent = primary.dataset.bio || primary.textContent || "";
  secondary.textContent = secondary.dataset.bio || secondary.textContent || "";
  primary.classList.add("bio-text-primary");

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  scene.subscribe((progress) => {
    const active = progress >= ENTER_THRESHOLD;
    const showSecondary = progress >= SECONDARY_THRESHOLD;

    copy.classList.toggle("is-visible", active);
    copy.classList.toggle("bio-secondary-visible", active && showSecondary);
    copy.classList.toggle("bio-simple-visible", reduceMotion.matches && active);
    copy.setAttribute("aria-hidden", String(!active));
  });
}
