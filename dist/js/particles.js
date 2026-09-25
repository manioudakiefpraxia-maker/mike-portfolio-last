import { clamp } from "./scroll.js";

const MORPH_START = 0.30;
const MORPH_END = 0.72;
const CAMERA_Z = 8;
const CAMERA_FOV = 44;
const LAYERS = [
  { z: 0.06, idleXY: 0.55, idleZ: 0.07, openXY: 12, openZ: 0.27, size: 6.2, alpha: 0.98 },
  { z: 0.25, idleXY: 1.0, idleZ: 0.16, openXY: 18, openZ: 0.46, size: 3.3, alpha: 0.25 },
  { z: 0.6, idleXY: 1.5, idleZ: 0.29, openXY: 25, openZ: 0.7, size: 2.4, alpha: 0.12 },
  { z: 0.85, idleXY: 2.4, idleZ: 0.22, openXY: 0, openZ: 0, size: 1.0, alpha: 0.04 },
];
const VERTEX_SHADER = [
  "attribute float aSize;",
  "attribute float aAlpha;",
  "attribute vec3 aColor;",
  "uniform float uPixelRatio;",
  "varying float vAlpha;",
  "varying vec3 vColor;",
  "void main() {",
  "  vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);",
  "  float perspective = 8.0 / max(1.0, -viewPosition.z);",
  "  gl_Position = projectionMatrix * viewPosition;",
  "  gl_PointSize = clamp(aSize * uPixelRatio * perspective, 1.0, 24.0);",
  "  vAlpha = aAlpha * clamp(perspective, 0.68, 1.3);",
  "  vColor = aColor;",
  "}",
].join("\n");
const FRAGMENT_SHADER = [
  "varying float vAlpha;",
  "varying vec3 vColor;",
  "void main() {",
  "  float distanceToCenter = length(gl_PointCoord - vec2(0.5));",
  "  float circle = 1.0 - smoothstep(0.39, 0.5, distanceToCenter);",
  "  if (circle < 0.01) discard;",
  "  gl_FragColor = vec4(vColor, vAlpha * circle);",
  "}",
].join("\n");
const random = (min, max) => min + Math.random() * (max - min);
const smoothstep = (value) => value * value * (3 - 2 * value);
const lerp = (start, end, amount) => start + (end - start) * amount;

export function initParticles(scrollScene, preferences) {
  const canvas = document.getElementById("particles");
  const bioCopy = document.getElementById("bio-copy");
  if (!canvas || !bioCopy) return;
  if (preferences.reduceMotion.matches) {
    canvas.hidden = true;
    return;
  }
  bioCopy.classList.add("bio-particles-pending");
  const fallback = (error) => {
    console.error("HERO/BIO WebGL particles unavailable:", error);
    canvas.hidden = true;
    bioCopy.classList.remove("bio-particles-pending", "bio-particles-active");
  };
  import("./vendor/three.module.min.js")
    .then((THREE) => {
      try {
        startWebGLParticles(THREE, scrollScene, preferences, canvas, bioCopy, fallback);
      } catch (error) {
        fallback(error);
      }
    })
    .catch(fallback);
}

function startWebGLParticles(THREE, scrollScene, preferences, canvas, bioCopy, fallback) {
  const renderer = new THREE.WebGLRenderer({
    canvas, alpha: true, antialias: false, powerPreference: "high-performance",
  });
  renderer.setClearColor(0x000000, 0);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(CAMERA_FOV, 1, 0.1, 30);
  camera.position.z = CAMERA_Z;
  const mobile = innerWidth < 700;
  const count = mobile ? 3500 : 10000;
  const textCount = Math.floor(count * 0.88);
  const particles = Array.from({ length: count }, () => {
    const theta = random(0, Math.PI * 2);
    const u = random(-1, 1);
    const shell = random(0.48, 1.18);
    const radial = Math.sqrt(1 - u * u);
    const seedX = Math.cos(theta) * radial * shell;
    const seedY = u * shell * 0.9;
    const seedZ = Math.sin(theta) * radial * shell;
    return {
      seedX, seedY, seedZ,
      heroX: 0, heroY: 0, heroZ: seedZ * 1.8,
      bioX: 0, bioY: 0, bioZ: 0,
      x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0,
      openX: 0, openY: 0, openZ: 0,
      size: random(1.1, 2.0),
      alpha: random(0.035, 0.09),
      color: Math.random() < 0.02 ? [241 / 255, 91 / 255, 50 / 255] : [245 / 255, 245 / 255, 238 / 255],
      phase: random(0, Math.PI * 2),
      layer: 3, hasBioTarget: false,
      morphStart: 0, morphEnd: 1,
      arcX: random(-0.38, 0.38), arcZ: random(-0.4, 0.4),
    };
  });
  const positions = new Float32Array(count * 3);
  const sizes = new Float32Array(count);
  const alphas = new Float32Array(count);
  const colors = new Float32Array(count * 3);
  const geometry = new THREE.BufferGeometry();
  const positionAttribute = new THREE.BufferAttribute(positions, 3);
  const sizeAttribute = new THREE.BufferAttribute(sizes, 1);
  const alphaAttribute = new THREE.BufferAttribute(alphas, 1);
  positionAttribute.setUsage(THREE.DynamicDrawUsage);
  sizeAttribute.setUsage(THREE.DynamicDrawUsage);
  alphaAttribute.setUsage(THREE.DynamicDrawUsage);
  geometry.setAttribute("position", positionAttribute);
  geometry.setAttribute("aSize", sizeAttribute);
  geometry.setAttribute("aAlpha", alphaAttribute);
  geometry.setAttribute("aColor", new THREE.BufferAttribute(colors, 3));
  const material = new THREE.ShaderMaterial({
    uniforms: { uPixelRatio: { value: 1 } },
    vertexShader: VERTEX_SHADER,
    fragmentShader: FRAGMENT_SHADER,
    transparent: true, depthWrite: false, depthTest: false,
  });
  const cloud = new THREE.Points(geometry, material);
  cloud.frustumCulled = false;
  scene.add(cloud);

  let width = 1;
  let height = 1;
  let progress = 0;
  let frame = 0;
  let lastTimestamp = 0;
  let mouseX = innerWidth * 0.5;
  let mouseY = innerHeight * 0.5;
  let pointerActive = false;
  let stopped = false;
  let hasTextTargets = false;
  const worldHeightAt = (z) => 2 * Math.tan((CAMERA_FOV * Math.PI) / 360) * (CAMERA_Z - z);
  const pixelWorld = (pixels, z = 0) => pixels * worldHeightAt(z) / height;
  const screenToWorld = (screenX, screenY, z) => ({
    x: (screenX - width * 0.5) * worldHeightAt(z) / height,
    y: (height * 0.5 - screenY) * worldHeightAt(z) / height,
  });

  function resize() {
    width = Math.max(1, innerWidth);
    height = Math.max(1, innerHeight);
    const ratio = Math.min(devicePixelRatio || 1, preferences.finePointer.matches ? 1.75 : 1.25);
    renderer.setPixelRatio(ratio);
    renderer.setSize(width, height, false);
    material.uniforms.uPixelRatio.value = ratio;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    const halfHeight = worldHeightAt(0) * 0.5;
    const halfWidth = halfHeight * camera.aspect;
    particles.forEach((particle) => {
      particle.heroX = particle.seedX * halfWidth * 1.38;
      particle.heroY = particle.seedY * halfHeight * 1.28;
      particle.heroZ = particle.seedZ * (mobile ? 1.35 : 1.8);
      const upper = clamp((particle.seedY + 1) * 0.5);
      particle.morphStart = 0.02 + (1 - upper) * 0.16 + random(0, 0.04);
      particle.morphEnd = Math.min(1, particle.morphStart + random(0.72, 0.8));
    });
  }

  function textTargets() {
    const primary = bioCopy.querySelector(".bio-text-primary");
    if (!primary) return [];
    const rect = primary.getBoundingClientRect();
    if (rect.width < 20 || rect.height < 20) return [];
    // Offscreen Canvas 2D is used solely as a filled-glyph sampling mask.
    const scale = 2;
    const mask = document.createElement("canvas");
    mask.width = Math.ceil(rect.width * scale);
    mask.height = Math.ceil(rect.height * scale);
    const context = mask.getContext("2d", { willReadFrequently: true });
    if (!context) return [];
    context.scale(scale, scale);
    context.fillStyle = "#fff";
    context.textAlign = "center";
    context.textBaseline = "middle";
    const computed = getComputedStyle(primary);
    const words = (primary.dataset.bio || primary.textContent || "").trim().split(/\s+/);
    let fontSize = mobile ? clamp(width * 0.084, 32, 56) : clamp(width * 0.06, 58, 94);
    let lines = [];
    let lineHeight = 0;
    for (let attempt = 0; attempt < 12; attempt += 1) {
      context.font = "800 " + fontSize + "px " + computed.fontFamily;
      if ("letterSpacing" in context) context.letterSpacing = (-0.05 * fontSize) + "px";
      lines = [];
      let line = "";
      words.forEach((word) => {
        const candidate = line ? line + " " + word : word;
        if (line && context.measureText(candidate).width > rect.width * 0.98) {
          lines.push(line);
          line = word;
        } else {
          line = candidate;
        }
      });
      if (line) lines.push(line);
      lineHeight = fontSize * 0.95;
      if (lines.length * lineHeight <= rect.height || fontSize <= 28) break;
      fontSize *= 0.96;
    }
    const offsetY = (rect.height - lines.length * lineHeight) * 0.5;
    lines.forEach((line, index) => {
      context.fillText(line, rect.width * 0.5, offsetY + (index + 0.5) * lineHeight);
    });
    const alpha = context.getImageData(0, 0, mask.width, mask.height).data;
    const filledAt = (x, y) => {
      const px = Math.floor(x * scale);
      const py = Math.floor(y * scale);
      return px >= 0 && py >= 0 && px < mask.width && py < mask.height
        && alpha[(py * mask.width + px) * 4 + 3] > 100;
    };
    let filledArea = 0;
    for (let y = 0; y < mask.height; y += 2) {
      for (let x = 0; x < mask.width; x += 2) {
        if (alpha[(y * mask.width + x) * 4 + 3] > 100) filledArea += 1;
      }
    }
    if (filledArea < 100) return [];
    const sampleLayer = (desiredCount) => {
      const spacing = Math.max(2.2, Math.sqrt(filledArea / desiredCount) * 0.98);
      const samples = [];
      let row = 0;
      for (let y = 0; y < rect.height; y += spacing, row += 1) {
        const stagger = (row % 2) * spacing * 0.5;
        for (let x = -spacing; x < rect.width; x += spacing) {
          const sx = x + stagger + random(0.08, 0.92) * spacing;
          const sy = y + random(0.08, 0.92) * spacing;
          if (filledAt(sx, sy)) samples.push({ x: rect.left + sx, y: rect.top + sy });
        }
      }
      for (let tries = 0; samples.length < desiredCount && tries < desiredCount * 80; tries += 1) {
        const sx = random(0, rect.width);
        const sy = random(0, rect.height);
        if (filledAt(sx, sy)) samples.push({ x: rect.left + sx, y: rect.top + sy });
      }
      for (let index = samples.length - 1; index > 0; index -= 1) {
        const swap = Math.floor(Math.random() * (index + 1));
        [samples[index], samples[swap]] = [samples[swap], samples[index]];
      }
      return samples.slice(0, desiredCount);
    };
    const frontCount = Math.floor(textCount * 0.7);
    const midCount = Math.floor(textCount * 0.2);
    return [
      ...sampleLayer(frontCount),
      ...sampleLayer(midCount),
      ...sampleLayer(textCount - frontCount - midCount),
    ];
  }

  function assignBioTargets() {
    const targets = textTargets();
    if (targets.length < (mobile ? 450 : 1400)) {
      hasTextTargets = false;
      bioCopy.classList.remove("bio-particles-pending", "bio-particles-active");
      return;
    }
    const frontEnd = Math.floor(targets.length * 0.7);
    const midEnd = Math.floor(targets.length * 0.9);
    particles.forEach((particle, index) => {
      const layer = index < frontEnd ? 0 : index < midEnd ? 1 : index < targets.length ? 2 : 3;
      const settings = LAYERS[layer];
      const target = targets[index] || targets[Math.floor(Math.random() * targets.length)];
      particle.layer = layer;
      particle.hasBioTarget = true;
      particle.bioZ = random(-settings.z, settings.z);
      const world = screenToWorld(target.x, target.y, particle.bioZ);
      particle.bioX = world.x + (layer === 3 ? random(-0.34, 0.34) : 0);
      particle.bioY = world.y + (layer === 3 ? random(-0.25, 0.25) : 0);
    });
    hasTextTargets = true;
    bioCopy.classList.remove("bio-particles-pending");
    bioCopy.classList.add("bio-particles-active");
  }

  function draw(timestamp) {
    frame = 0;
    if (stopped || document.hidden) return;
    const delta = lastTimestamp ? clamp((timestamp - lastTimestamp) / 16.67, 0.5, 2.5) : 1;
    lastTimestamp = timestamp;
    const morph = smoothstep(clamp((progress - MORPH_START) / (MORPH_END - MORPH_START)));
    const angle = Math.sin(timestamp * 0.00012) * 0.18;
    const cosAngle = Math.cos(angle);
    const sinAngle = Math.sin(angle);
    const pointerX = preferences.finePointer.matches ? ((mouseX / width) - 0.5) * pixelWorld(92) : 0;
    const pointerY = preferences.finePointer.matches ? (0.5 - mouseY / height) * pixelWorld(38) : 0;
    const worldPerPixel = pixelWorld(1);
    particles.forEach((particle, index) => {
      const settings = LAYERS[particle.layer];
      const local = particle.hasBioTarget
        ? smoothstep(clamp((morph - particle.morphStart) / (particle.morphEnd - particle.morphStart)))
        : 0;
      const settled = smoothstep(clamp((local - 0.82) / 0.18));
      const rotatedX = particle.heroX * cosAngle - particle.heroZ * sinAngle;
      const rotatedZ = particle.heroX * sinAngle + particle.heroZ * cosAngle;
      const heroX = rotatedX + pointerX * (1 - local);
      const heroY = particle.heroY + pointerY * (1 - local);
      const arc = Math.sin(local * Math.PI);
      const idleX = Math.sin(timestamp * 0.00051 + particle.phase) * settings.idleXY * worldPerPixel * settled;
      const idleY = Math.cos(timestamp * 0.00043 + particle.phase * 0.7) * settings.idleXY * 0.8 * worldPerPixel * settled;
      const idleZ = (Math.sin(timestamp * 0.00067 + particle.phase * 1.3)
        + Math.sin(timestamp * 0.00104 + particle.phase * 0.8) * 0.2) * settings.idleZ * settled;
      const screenScale = height / worldHeightAt(particle.z);
      const dx = width * 0.5 + particle.x * screenScale - mouseX;
      const dy = height * 0.5 - particle.y * screenScale - mouseY;
      const distance = Math.hypot(dx, dy);
      const force = pointerActive && preferences.finePointer.matches && settled > 0
        ? smoothstep(clamp(1 - distance / 155)) * settled
        : 0;
      const side = particle.bioZ < 0 ? -1 : 1;
      particle.openX += ((dx / Math.max(distance, 1)) * settings.openXY * worldPerPixel * force - particle.openX) * 0.04;
      particle.openY += ((-dy / Math.max(distance, 1)) * settings.openXY * worldPerPixel * force - particle.openY) * 0.04;
      particle.openZ += (side * settings.openZ * force - particle.openZ) * 0.035;
      // Keep the readable face anchored while Z breathes; let support layers show more parallax.
      const faceStability = particle.layer === 0 ? 0.9 : particle.layer === 1 ? 0.3 : 0;
      const depthShift = (idleZ + particle.openZ) / (CAMERA_Z - particle.bioZ);
      const targetX = lerp(heroX, particle.bioX, local) + arc * particle.arcX + idleX + particle.openX
        - particle.bioX * depthShift * faceStability * settled;
      const targetY = lerp(heroY, particle.bioY, local) - arc * 0.3 + idleY + particle.openY
        - particle.bioY * depthShift * faceStability * settled;
      const targetZ = lerp(rotatedZ, particle.bioZ, local) + arc * particle.arcZ + idleZ + particle.openZ;
      const spring = 0.068 * delta;
      const damping = Math.pow(0.79, delta);
      particle.vx = (particle.vx + (targetX - particle.x) * spring) * damping;
      particle.vy = (particle.vy + (targetY - particle.y) * spring) * damping;
      particle.vz = (particle.vz + (targetZ - particle.z) * spring) * damping;
      particle.x += particle.vx * delta;
      particle.y += particle.vy * delta;
      particle.z += particle.vz * delta;
      const offset = index * 3;
      positions[offset] = particle.x;
      positions[offset + 1] = particle.y;
      positions[offset + 2] = particle.z;
      sizes[index] = lerp(particle.size, settings.size * (mobile ? 0.76 : 1), local);
      alphas[index] = lerp(particle.alpha, settings.alpha, local);
    });
    positionAttribute.needsUpdate = true;
    sizeAttribute.needsUpdate = true;
    alphaAttribute.needsUpdate = true;
    renderer.render(scene, camera);
    frame = requestAnimationFrame(draw);
  }
  const start = () => {
    if (!frame && !stopped && !document.hidden) frame = requestAnimationFrame(draw);
  };
  resize();
  particles.forEach((particle, index) => {
    particle.x = particle.heroX;
    particle.y = particle.heroY;
    particle.z = particle.heroZ;
    const offset = index * 3;
    positions[offset] = particle.x;
    positions[offset + 1] = particle.y;
    positions[offset + 2] = particle.z;
    colors[offset] = particle.color[0];
    colors[offset + 1] = particle.color[1];
    colors[offset + 2] = particle.color[2];
  });
  const fontReady = document.fonts?.ready || Promise.resolve();
  fontReady.then(assignBioTargets).catch(assignBioTargets);
  scrollScene.subscribe((value) => {
    progress = value;
    canvas.style.opacity = String(1 - clamp((progress - 0.94) / 0.06));
    start();
  });
  if (preferences.finePointer.matches) {
    addEventListener("pointermove", (event) => {
      mouseX = event.clientX;
      mouseY = event.clientY;
      pointerActive = true;
    }, { passive: true });
    addEventListener("pointerleave", () => { pointerActive = false; }, { passive: true });
  }
  addEventListener("resize", () => {
    resize();
    if (hasTextTargets) assignBioTargets();
  }, { passive: true });
  addEventListener("orientationchange", () => {
    resize();
    if (hasTextTargets) assignBioTargets();
  }, { passive: true });
  document.addEventListener("visibilitychange", start);
  canvas.addEventListener("webglcontextlost", (event) => {
    event.preventDefault();
    stopped = true;
    if (frame) cancelAnimationFrame(frame);
    fallback(new Error("WebGL context lost"));
  }, { passive: false });
  start();
}
