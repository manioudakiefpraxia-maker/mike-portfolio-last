const ENTER_THRESHOLD = 0.57;

export function initBio(scene) {
  const copy = document.getElementById("bio-copy");
  if (!copy) return;

  const primary = copy.querySelector(".bio-text");
  if (!primary) return;

  const desktopLines = primary.dataset.bioDesktopLines
    ?.split("|")
    .map((line) => line.trim())
    .filter(Boolean);
  if (desktopLines?.length) {
    primary.textContent = desktopLines.join(" ");
  } else {
    primary.textContent = primary.dataset.bio || primary.textContent || "";
  }
  primary.classList.add("bio-text-primary");

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  scene.subscribe((progress) => {
    const active = progress >= ENTER_THRESHOLD;
    copy.classList.toggle("is-visible", active);
    copy.classList.toggle("bio-simple-visible", reduceMotion.matches && active);
    copy.setAttribute("aria-hidden", String(!active));
  });
}
