import { clamp } from "./scroll.js";

const MORPH_START = 0.0;
const MORPH_END = 0.70;
const BIO_HOVER_BREAK_STRENGTH = 1.7;
const BIO_HOVER_DEPTH_STRENGTH = 1.9;
const BIO_EXIT_HOLD = 0.035;
const BIO_EXIT_START = MORPH_END + BIO_EXIT_HOLD;
const BIO_EXIT_END = Math.min(1, BIO_EXIT_START + (MORPH_END - MORPH_START));
const CAMERA_Z = 8;
const CAMERA_FOV = 44;
const BIO_STYLES = {
  front: { size: 2.10, alpha: 0.98, xyMotion: 0.006, zMotion: 0.005, mouseXY: 0.20, mouseZ: 0.26 },
  side: { size: 0.95, alpha: 0.075, xyMotion: 0.08, zMotion: 0.040, mouseXY: 0.38, mouseZ: 0.72 },
  back: { size: 0.72, alpha: 0.022, xyMotion: 0.10, zMotion: 0.055, mouseXY: 0.42, mouseZ: 0.88 },
  volume: { size: 0.82, alpha: 0.055, xyMotion: 0.09, zMotion: 0.050, mouseXY: 0.40, mouseZ: 0.78 },
  atmosphere: { size: 0.58, alpha: 0.012, xyMotion: 0.48, zMotion: 0.22, mouseXY: 0.08, mouseZ: 0.12 }
};
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
  const handleWebGLFailure = (error) => {
    console.error("HERO/BIO WebGL particles unavailable:", error);
    canvas.hidden = true;
    bioCopy.classList.remove("bio-particles-pending", "bio-particles-active");
  };
  import("./vendor/three.module.min.js")
    .then((THREE) => {
      return Promise.all([
        import("./vendor/addons/loaders/FontLoader.js"),
        import("./vendor/addons/geometries/TextGeometry.js"),
        import("./vendor/addons/math/MeshSurfaceSampler.js")
      ]).then(([fontModule, geometryModule, samplerModule]) =>
        startWebGLParticles(
          THREE,
          fontModule.FontLoader,
          geometryModule.TextGeometry,
          samplerModule.MeshSurfaceSampler,
          scrollScene,
          preferences,
          canvas,
          bioCopy,
          handleWebGLFailure
        )
      );
    })
    .catch((error) => {
      console.error("BIO TextGeometry initialization failed:", error);
      throw error;
    });
}

async function startWebGLParticles(
  THREE,
  FontLoader,
  TextGeometry,
  MeshSurfaceSampler,
  scrollScene,
  preferences,
  canvas,
  bioCopy,
  handleWebGLFailure
) {
  const revealCanvas = document.getElementById("bio-reveal");
  const revealContext = revealCanvas?.getContext("2d", { alpha: true });
  const revealStamp = document.createElement("canvas");
  revealStamp.width = 128;
  revealStamp.height = 128;
  const stampContext = revealStamp.getContext("2d");
  const stampGradient = stampContext.createRadialGradient(64, 64, 0, 64, 64, 64);
  stampGradient.addColorStop(0, "rgba(255,255,255,1)");
  stampGradient.addColorStop(0.34, "rgba(255,255,255,0.72)");
  stampGradient.addColorStop(0.72, "rgba(255,255,255,0.20)");
  stampGradient.addColorStop(1, "rgba(255,255,255,0)");
  stampContext.fillStyle = stampGradient;
  stampContext.fillRect(0, 0, 128, 128);
  const bioFont = await new FontLoader().loadAsync(
    new URL("../assets/fonts/bio-bold.typeface.json", import.meta.url).href
  );
  const renderer = new THREE.WebGLRenderer({
    canvas, alpha: true, antialias: false, powerPreference: "high-performance",
  });
  renderer.setClearColor(0x000000, 0);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(CAMERA_FOV, 1, 0.1, 30);
  camera.position.z = CAMERA_Z;
  const mobile = innerWidth < 700;
  const count = mobile ? 3500 : 10000;
  const bioTypographyCount = Math.floor(count * (mobile ? 0.84 : 0.88));
  const particles = Array.from({ length: count }, () => {
    const theta = random(0, Math.PI * 2);
    const u = random(-1, 1);
    const shell = random(0.48, 1.18);
    const radial = Math.sqrt(1 - u * u);
    const seedX = Math.cos(theta) * radial * shell;
    const seedY = u * shell * 0.9;
    const seedZ = Math.sin(theta) * radial * shell;

    const sizeRoll = Math.random();

    let heroSize;
    let heroAlpha;

    /*
     * 66% tiny distant particles
     * 26% medium particles
     * 8% larger foreground accents
     */
    if (sizeRoll < 0.66) {
      heroSize = random(0.55, 1.05);
      heroAlpha = random(0.012, 0.045);
    } else if (sizeRoll < 0.92) {
      heroSize = random(1.15, 2.15);
      heroAlpha = random(0.055, 0.12);
    } else {
      heroSize = random(2.6, 4.4);
      heroAlpha = random(0.12, 0.24);
    }

    /*
     * Positive Z is slightly closer to the camera.
     * Use that to strengthen foreground depth.
     */
    const depthNormalized = clamp(
      (seedZ + 1.2) / 2.4
    );

    heroSize *= lerp(
      0.82,
      1.18,
      depthNormalized
    );

    heroAlpha *= lerp(
      0.70,
      1.22,
      depthNormalized
    );

    const strongAccent =
      Math.random() < 0.035;

    if (strongAccent) {
      heroAlpha *= random(1.25, 1.55);
    }

    heroAlpha =
      Math.min(
        heroAlpha,
        0.30
      );

    const isOrange =
      Math.random() < 0.08;

    const heroColor = isOrange
      ? [241 / 255, 91 / 255, 50 / 255]
      : [245 / 255, 245 / 255, 238 / 255];

    return {
      seedX, seedY, seedZ,
      heroX: 0, heroY: 0, heroZ: seedZ * 1.8,
      bioX: 0, bioY: 0, bioZ: 0,
      x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0,
      renderX: 0, renderY: 0, renderZ: 0,
      openX: 0, openY: 0, openZ: 0,
      size: heroSize,
      alpha: heroAlpha,
      color: heroColor,
      phase: random(0, Math.PI * 2),
      driftAmp: random(0.012, 0.038),
      driftSpeed: random(0.82, 1.18),
      parallaxStrength: random(0.82, 1.18),
      bioPhase:
        random(0, Math.PI * 2),
      bioSpeed:
        random(0.75, 1.25),
      bioDepthSpeed:
        random(0.72, 1.18),
      bioFloatPhase:
        random(0, Math.PI * 2),
      bioFloatSpeed:
        random(0.78, 1.20),
      bioDepthDirection:
        Math.random() < 0.5 ? -1 : 1,
      bioTextMotion:
        Math.random(),
      bioType: "atmosphere",
      bioBaseSize: BIO_STYLES.atmosphere.size,
      bioBaseAlpha: BIO_STYLES.atmosphere.alpha,
      hasBioTarget: false,
      morphStart: 0,
      morphEnd: 1,
      arcX:
        random(-0.32, 0.32) +
        seedX * 0.08,
      arcY:
        random(-0.26, 0.26) +
        seedY * 0.07,
      arcZ:
        random(-0.42, 0.42),
      exitDirX: Math.cos(random(0, Math.PI * 2)),
      exitDirY: Math.sin(random(0, Math.PI * 2)),
      exitScale: random(0.82, 1.35),
      exitDepth: random(-1.4, 1.4),
      exitDelay: random(0, 0.07),
      exitCurve: random(0.82, 1.18),
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
  cloud.renderOrder = 1;
  scene.add(cloud);

  let width = 1;
  let height = 1;
  let heroScaleX = 1;
  let heroScaleY = 1;
  let heroScaleZ = 1;
  let progress = 0;
  let frame = 0;
  let lastTimestamp = 0;
  let mouseX = innerWidth * 0.5;
  let mouseY = innerHeight * 0.5;
  let heroFlowRotationY = 0;
  const heroIdleFlowDirection = Math.random() < 0.5 ? -1 : 1;
  const heroIdleFlowSpeed = 0.012;
  let heroFlowVelocity = heroIdleFlowDirection * heroIdleFlowSpeed;
  let previousBioPointerX = mouseX;
  let previousBioPointerY = mouseY;
  let bioHoverVelocityX = 0;
  let bioHoverVelocityY = 0;
  let mouseParallaxX = 0;
  let mouseParallaxY = 0;
  let smoothedPointerVelocityX = 0;
  let smoothedPointerVelocityY = 0;
  let previousParallaxTargetX = 0;
  let previousParallaxTargetY = 0;
  let pointerActive = false;
  let stopped = false;
  let hasTextTargets = false;
  let bioMinZ = -1.6;
  let bioMaxZ = 1.6;
  let bioRebuildTimer = 0;
  let bioDebugLogged = false;
  let bioCountDebugLogged = false;
  let bioMotionDebugLogged = false;
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
    if (revealCanvas && revealContext) {
      const revealPixelRatio = Math.min(window.devicePixelRatio || 1, 1.25);
      revealCanvas.width = Math.round(width * revealPixelRatio);
      revealCanvas.height = Math.round(height * revealPixelRatio);
      revealCanvas.style.width = width + "px";
      revealCanvas.style.height = height + "px";
      revealContext.setTransform(revealPixelRatio, 0, 0, revealPixelRatio, 0, 0);
    }
    material.uniforms.uPixelRatio.value = ratio;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    const halfHeight = worldHeightAt(0) * 0.5;
    const halfWidth = halfHeight * camera.aspect;
    /*
     * HERO envelope.
     *
     * X deliberately extends beyond both viewport edges.
     * The center remains exactly at world X = 0.
     */
    heroScaleX =
      halfWidth *
      (mobile ? 1.58 : 1.88);

    heroScaleY =
      halfHeight *
      (mobile ? 1.34 : 1.52);

    heroScaleZ =
      mobile ? 1.5 : 2.05;

    particles.forEach((particle) => {
      particle.heroX =
        particle.seedX *
        heroScaleX;

      particle.heroY =
        particle.seedY *
        heroScaleY;

      particle.heroZ =
        particle.seedZ *
        heroScaleZ;
      const radialDistance =
        clamp(
          Math.sqrt(
            particle.seedX * particle.seedX +
            particle.seedY * particle.seedY
          ) / 1.25
        );

      particle.morphStart =
        radialDistance * 0.02 +
        random(0, 0.012);

      particle.morphEnd =
        Math.min(
          0.96,
          particle.morphStart +
          random(0.58, 0.72)
        );
    });
  }

  function textTargets() {
    const primary = bioCopy.querySelector(".bio-text-primary");
    if (!primary || width < 20 || height < 20) return [];
    const rect = primary.getBoundingClientRect();
    const sourceText = primary.dataset.bio || primary.textContent || "";
    const apostrophe = "'";
    let lines = mobile
      ? [
          "I" + apostrophe + "m Mike,",
          "a creative designer",
          "working across identity,",
          "digital, motion and web."
        ]
      : [
          "I" + apostrophe + "m Mike, a creative designer",
          "working across identity,",
          "digital, motion and web."
        ];
    const nameLead = sourceText.match(/^I[^\s]*\s+Mike,/)?.[0] || "I'm Mike,";
    lines = mobile
      ? [
          nameLead,
          "a creative designer",
          "working across identity,",
          "digital, motion and web."
        ]
      : [
          nameLead + " a creative designer",
          "working across identity,",
          "digital, motion and web."
        ];

    const lineSource = mobile
      ? primary.dataset.bioMobileLines
      : primary.dataset.bioDesktopLines;
    lines = lineSource
      .split("|")
      .map((line) => line.trim())
      .filter(Boolean);
    const BIO_TEXT_DEPTH = 0.24;
    const LINE_HEIGHT = mobile ? 1.22 : 1.38;
    const totalLineSpan = (lines.length - 1) * LINE_HEIGHT;
    const lineSamplers = [];
    const samplingMaterial = new THREE.MeshBasicMaterial();
    const completeBounds = {
      minX: Infinity,
      maxX: -Infinity,
      minY: Infinity,
      maxY: -Infinity,
      minZ: Infinity,
      maxZ: -Infinity
    };
    lines.forEach((lineText, index) => {
      const geometry = new TextGeometry(lineText, {
        font: bioFont,
        size: 1,
        depth: BIO_TEXT_DEPTH,
        curveSegments: 6,
        bevelEnabled: false
      });
      geometry.computeBoundingBox();
      const box = geometry.boundingBox;
      const lineWidth = box.max.x - box.min.x;
      geometry.translate(
        -box.min.x - lineWidth * 0.5,
        totalLineSpan * 0.5 - index * LINE_HEIGHT,
        -BIO_TEXT_DEPTH * 0.5
      );
      geometry.computeBoundingBox();
      const mesh = new THREE.Mesh(geometry, samplingMaterial);
      const sampler = new MeshSurfaceSampler(mesh).build();
      const lineBox = geometry.boundingBox;
      completeBounds.minX = Math.min(completeBounds.minX, lineBox.min.x);
      completeBounds.maxX = Math.max(completeBounds.maxX, lineBox.max.x);
      completeBounds.minY = Math.min(completeBounds.minY, lineBox.min.y);
      completeBounds.maxY = Math.max(completeBounds.maxY, lineBox.max.y);
      completeBounds.minZ = Math.min(completeBounds.minZ, lineBox.min.z);
      completeBounds.maxZ = Math.max(completeBounds.maxZ, lineBox.max.z);
      lineSamplers.push({
        sampler,
        geometry,
        weight: Math.max(0.001,
          (lineBox.max.x - lineBox.min.x) *
          (lineBox.max.y - lineBox.min.y))
      });
    });

    const typographyCount = bioTypographyCount;
    const frontCount = Math.floor(typographyCount * 0.89);
    const sideCount = Math.floor(typographyCount * 0.06);
    const backCount = Math.floor(typographyCount * 0.02);
    const volumeCount = typographyCount - frontCount - sideCount - backCount;
    const rawMinX = completeBounds.minX;
    const rawMaxX = completeBounds.maxX;
    const rawMinY = completeBounds.minY;
    const rawMaxY = completeBounds.maxY;
    const rawMinZ = completeBounds.minZ;
    const rawMaxZ = completeBounds.maxZ;
    const rawWidth = Math.max(0.001, rawMaxX - rawMinX);
    const rawCenterX = (rawMinX + rawMaxX) * 0.5;
    const rawCenterY = (rawMinY + rawMaxY) * 0.5;
    const rawCenterZ = (rawMinZ + rawMaxZ) * 0.5;
    const desiredPixelWidth = mobile ? width * 0.92 : Math.min(width * 0.84, 1340);
    const desiredFrontPixelSpacing = mobile ? 2.6 : 2.2;
    const rawFrontSpacing =
      desiredFrontPixelSpacing *
      rawWidth /
      desiredPixelWidth;
    const samplePosition = new THREE.Vector3();
    const sampleNormal = new THREE.Vector3();
    const classifySurfaceNormal = (normal) =>
      normal.z > 0.7 ? "front" : normal.z < -0.7 ? "back" : "side";
    const pickWeightedLineSampler = () => {
      const totalWeight = lineSamplers.reduce((sum, item) => sum + item.weight, 0);
      let roll = Math.random() * totalWeight;
      for (const item of lineSamplers) {
        roll -= item.weight;
        if (roll <= 0) return item;
      }
      return lineSamplers[lineSamplers.length - 1];
    };
    const sampleWantedSurface = (wantedType) => {
      for (let attempt = 0; attempt < 120; attempt += 1) {
        const source = pickWeightedLineSampler();
        source.sampler.sample(samplePosition, sampleNormal);
        if (classifySurfaceNormal(sampleNormal) === wantedType) {
          return {
            x: samplePosition.x,
            y: samplePosition.y,
            z: samplePosition.z,
            type: wantedType
          };
        }
      }
      return null;
    };

    const rawTargets = [];
    const frontCandidates = [];
    const candidateTarget = Math.max(frontCount * 8, 24000);
    let candidateAttempts = 0;
    while (
      frontCandidates.length < candidateTarget &&
      candidateAttempts < candidateTarget * 4
    ) {
      candidateAttempts += 1;
      const candidate = sampleWantedSurface("front");
      if (candidate) {
        frontCandidates.push(candidate);
      }
    }
    for (let index = frontCandidates.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(Math.random() * (index + 1));
      [frontCandidates[index], frontCandidates[swapIndex]] =
        [frontCandidates[swapIndex], frontCandidates[index]];
    }
    const selectEvenlySpacedFront = (candidates, requiredCount, spacing) => {
      const selected = [];
      const grid = new Map();
      const cellSize = spacing;
      const canAccept = (sample) => {
        const gx = Math.floor(sample.x / cellSize);
        const gy = Math.floor(sample.y / cellSize);
        for (let ox = -1; ox <= 1; ox += 1) {
          for (let oy = -1; oy <= 1; oy += 1) {
            const key = (gx + ox) + ":" + (gy + oy);
            const bucket = grid.get(key);
            if (!bucket) {
              continue;
            }
            for (const point of bucket) {
              const dx = sample.x - point.x;
              const dy = sample.y - point.y;
              if (dx * dx + dy * dy < spacing * spacing) {
                return false;
              }
            }
          }
        }
        return true;
      };

      for (const sample of candidates) {
        if (selected.length >= requiredCount) {
          break;
        }
        if (!canAccept(sample)) {
          continue;
        }
        selected.push(sample);
        const gx = Math.floor(sample.x / cellSize);
        const gy = Math.floor(sample.y / cellSize);
        const key = gx + ":" + gy;
        if (!grid.has(key)) {
          grid.set(key, []);
        }
        grid.get(key).push(sample);
      }
      return selected;
    };

    let frontTargets =
      selectEvenlySpacedFront(
        frontCandidates,
        frontCount,
        rawFrontSpacing
      );
    if (frontTargets.length < frontCount) {
      frontTargets =
        selectEvenlySpacedFront(
          frontCandidates,
          frontCount,
          rawFrontSpacing * 0.88
        );
    }
    if (frontTargets.length < frontCount) {
      frontTargets =
        selectEvenlySpacedFront(
          frontCandidates,
          frontCount,
          rawFrontSpacing * 0.76
        );
    }
    if (frontTargets.length < frontCount) {
      frontTargets =
        selectEvenlySpacedFront(
          frontCandidates,
          frontCount,
          rawFrontSpacing * 0.64
        );
    }
    const frontFallbackStart = frontTargets.length;
    while (frontTargets.length < frontCount) {
      const candidate = sampleWantedSurface("front");
      if (!candidate) {
        break;
      }
      frontTargets.push(candidate);
    }
    const frontFallbackCount = frontTargets.length - frontFallbackStart;
    if (frontTargets.length < frontCount) {
      throw new Error("BIO TextGeometry front sampling failed");
    }

    const collectSurfaceTargets = (type, amount) => {
      const result = [];
      while (result.length < amount) {
        const candidate = sampleWantedSurface(type);
        if (!candidate) throw new Error("BIO TextGeometry " + type + " sampling failed");
        result.push(candidate);
      }
      return result;
    };
    rawTargets.push(...frontTargets);
    rawTargets.push(...collectSurfaceTargets("side", sideCount));
    rawTargets.push(...collectSurfaceTargets("back", backCount));
    for (let index = 0; index < volumeCount; index += 1) {
      const source = frontTargets[Math.floor(Math.random() * frontTargets.length)];
      rawTargets.push({
        x: source.x + random(-0.008, 0.008),
        y: source.y + random(-0.008, 0.008),
        z: random(-BIO_TEXT_DEPTH * 0.40, BIO_TEXT_DEPTH * 0.40),
        type: "volume"
      });
    }

    const desiredWorldWidth = Math.abs(
      screenToWorld(width * 0.5 + desiredPixelWidth * 0.5, height * 0.5, 0).x -
      screenToWorld(width * 0.5 - desiredPixelWidth * 0.5, height * 0.5, 0).x
    );
    const geometryScale = desiredWorldWidth / rawWidth;
    const depthBoost = mobile ? 1.55 : 2.10;
    const bioVerticalOffset = pixelWorld(height * 0.075);
    const toWorldTarget = (target) => ({
      x: (target.x - rawCenterX) * geometryScale,
      y: (target.y - rawCenterY) * geometryScale + bioVerticalOffset,
      z: (target.z - rawCenterZ) * geometryScale * depthBoost,
      type: target.type
    });
    const targets = rawTargets.map(toWorldTarget);
    const typographyHeight = Math.max(0.001, rawMaxY - rawMinY) * geometryScale;
    const typographyWidth = desiredWorldWidth;
    if (!bioDebugLogged) {
      console.table({
        lines: lines.length,
        rawWidth,
        rawHeight: rawMaxY - rawMinY,
        desiredPixelWidth,
        desiredWorldWidth,
        geometryScale,
        finalApproxWidth: rawWidth * geometryScale,
        finalApproxHeight: (rawMaxY - rawMinY) * geometryScale,
        rawZDepth: rawMaxZ - rawMinZ,
        finalZDepth: (rawMaxZ - rawMinZ) * geometryScale * depthBoost
      });
      lines.forEach((lineText, index) => console.log("[BIO line]", index, lineText));
      bioDebugLogged = true;
    }
    const atmosphereCount = count - typographyCount;
    const textHalfWidth = typographyWidth * 0.5;
    const textHalfHeight = typographyHeight * 0.5;
    for (let index = 0; index < atmosphereCount; index += 1) {
      let x;
      let y;
      let z;

      for (let attempt = 0; attempt < 30; attempt += 1) {
        x = random(-typographyWidth * 0.72, typographyWidth * 0.72);
        y = bioVerticalOffset +
          random(-typographyHeight * 1.45, typographyHeight * 1.45);
        z = random(-1.7, 1.7);

        const insideTextProjection =
          Math.abs(x) < textHalfWidth * 1.08 &&
          Math.abs(y - bioVerticalOffset) < textHalfHeight * 1.18;
        const closeToFrontPlane = Math.abs(z) < 0.82;

        if (!(insideTextProjection && closeToFrontPlane) || Math.random() < 0.06) {
          break;
        }
      }

      targets.push({
        x,
        y,
        z,
        type: "atmosphere"
      });
    }
    const geometryTargets = targets.filter((target) => target.type !== "atmosphere");
    const typographyMinZ = Math.min(...geometryTargets.map((target) => target.z));
    const typographyMaxZ = Math.max(...geometryTargets.map((target) => target.z));
    if (!bioCountDebugLogged) {
      console.table({
        total: count,
        typography: typographyCount,
        front: frontCount,
        side: sideCount,
        back: backCount,
        volume: volumeCount,
        atmosphere: count - typographyCount,
        desiredFrontPixelSpacing,
        rawFrontSpacing,
        acceptedFront: frontTargets.length,
        frontFallback: frontFallbackCount,
        frontFallbackPercent: frontFallbackCount / frontCount * 100,
        bioMinZ: typographyMinZ,
        bioMaxZ: typographyMaxZ
      });
      bioCountDebugLogged = true;
    }
    for (let index = targets.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(Math.random() * (index + 1));
      [targets[index], targets[swapIndex]] = [targets[swapIndex], targets[index]];
    }
    lineSamplers.forEach((entry) => entry.geometry.dispose());
    samplingMaterial.dispose();
    return targets;
  }
  function assignBioTargets() {
    const targets = textTargets();
    if (targets.length !== count) {
      hasTextTargets = false;
      bioCopy.classList.remove("bio-particles-pending", "bio-particles-active");
      return;
    }
    const geometryTargets = targets.filter((target) => target.type !== "atmosphere");
    bioMinZ = Math.min(...geometryTargets.map((target) => target.z));
    bioMaxZ = Math.max(...geometryTargets.map((target) => target.z));
    particles.forEach((particle, index) => {
      const target = targets[index];
      particle.bioType = target.type;
      particle.hasBioTarget = true;
      particle.bioX = target.x;
      particle.bioY = target.y;
      particle.bioZ = target.z;
      particle.bioBaseSize = target.type === "front"
        ? (Math.random() < 0.05 ? random(2.20, 2.55) : random(1.70, 2.20))
        : target.type === "side"
          ? random(0.85, 1.30)
          : target.type === "back"
            ? random(0.65, 1.00)
            : target.type === "volume"
              ? random(0.80, 1.18)
              : random(0.40, 0.85);
      particle.bioBaseAlpha = target.type === "front"
        ? random(0.84, 0.98)
        : target.type === "side"
          ? random(0.055, 0.14)
          : target.type === "back"
            ? random(0.015, 0.055)
            : target.type === "volume"
              ? random(0.045, 0.12)
              : (Math.random() < 0.015 ? random(0.025, 0.055) : random(0.004, 0.022));
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
    const rawMorph = clamp(
      (progress - MORPH_START) /
      (MORPH_END - MORPH_START)
    );
    const acceleratedMorph = Math.pow(rawMorph, 1.45);
    const morph = rawMorph * 0.18 + acceleratedMorph * 0.82;
    const rawBioExit = clamp((progress - BIO_EXIT_START) / (BIO_EXIT_END - BIO_EXIT_START));
    const bioExit = Math.pow(rawBioExit, 1.45);
    const fixedUiLightProgress = smoothstep(clamp((bioExit - 0.30) / 0.45));
    const fixedUiChannel = Math.round(255 * (1 - fixedUiLightProgress));
    document.documentElement.style.setProperty(
      "--fixed-ui-base",
      `rgb(${fixedUiChannel}, ${fixedUiChannel}, ${fixedUiChannel})`
    );
    const hoverExitMultiplier = 1 - smoothstep(clamp(bioExit / 0.30));
    const whiteRevealProgress = smoothstep(clamp((bioExit - 0.18) / 0.82));
    const whiteChannel = Math.round(8 + (255 - 8) * whiteRevealProgress);
    document.documentElement.style.setProperty(
      "--bg",
      `rgb(${whiteChannel}, ${whiteChannel}, ${whiteChannel})`
    );
    /*
     * Continuous planetary rotation.
     *
     * 0.000045 rad/ms gives roughly one complete
     * rotation every ~140 seconds.
     */
    /*
     * Small axial tilt / breathing.
     * This prevents the cloud from feeling like
     * a perfectly flat horizontal spinner.
     */
    const tiltX =
      -0.14 +
      Math.sin(
        timestamp * 0.000035
      ) *
      0.035;

    const cosX = Math.cos(tiltX);
    const sinX = Math.sin(tiltX);

    const dt =
      Math.max(
        0.008,
        Math.min(
          0.05,
          delta / 60
        )
      );

    const pointerNormX =
      pointerActive &&
      preferences.finePointer.matches
        ? ((mouseX / width) - 0.5) * 2
        : 0;

    const pointerNormY =
      pointerActive &&
      preferences.finePointer.matches
        ? ((mouseY / height) - 0.5) * 2
        : 0;

    /*
     * Positive pointer X must produce
     * positive particle X.
     *
     * cursor right -> particles right
     * cursor left  -> particles left
     */
    const horizontalStrength = 0.13;

    const targetParallaxX =
      pointerNormX *
      horizontalStrength;

    const targetParallaxY =
      -pointerNormY * 0.055;

    const heroFlowDeadZone = 0.08;
    let heroFlowInput = 0;
    if (Math.abs(pointerNormX) > heroFlowDeadZone) {
      const normalizedFlow =
        (Math.abs(pointerNormX) - heroFlowDeadZone) /
        (1 - heroFlowDeadZone);
      heroFlowInput = Math.sign(pointerNormX) * normalizedFlow;
    }
    const heroFlowMaxSpeed = 0.045;
    let targetHeroFlowVelocity = heroIdleFlowDirection * heroIdleFlowSpeed;
    if (Math.abs(heroFlowInput) > 0) {
      targetHeroFlowVelocity = -heroFlowInput * heroFlowMaxSpeed;
    }
    const heroFlowVelocityEase = 1 - Math.exp(-3.2 * dt);
    heroFlowVelocity +=
      (targetHeroFlowVelocity - heroFlowVelocity) *
      heroFlowVelocityEase;
    heroFlowRotationY += heroFlowVelocity * dt;
    const rotationY = heroFlowRotationY;
    const cosY = Math.cos(rotationY);
    const sinY = Math.sin(rotationY);

    /*
     * Measure how quickly the pointer target
     * is moving.
     */
    const rawVelocityX =
      (
        targetParallaxX -
        previousParallaxTargetX
      ) / dt;

    const rawVelocityY =
      (
        targetParallaxY -
        previousParallaxTargetY
      ) / dt;

    previousParallaxTargetX =
      targetParallaxX;

    previousParallaxTargetY =
      targetParallaxY;

    /*
     * Smooth pointer velocity heavily.
     *
     * This gives us inertia WITHOUT a spring.
     */
    const velocitySmoothing =
      1 -
      Math.exp(
        -10 * dt
      );

    smoothedPointerVelocityX +=
      (
        rawVelocityX -
        smoothedPointerVelocityX
      ) *
      velocitySmoothing;

    smoothedPointerVelocityY +=
      (
        rawVelocityY -
        smoothedPointerVelocityY
      ) *
      velocitySmoothing;

    /*
     * When the pointer slows down,
     * velocity naturally fades.
     */
    const velocityDecay =
      Math.exp(
        -6.5 * dt
      );

    smoothedPointerVelocityX *=
      velocityDecay;

    smoothedPointerVelocityY *=
      velocityDecay;

    const inertiaY =
      clamp(
        smoothedPointerVelocityY * 0.004,
        -0.012,
        0.012
      );

    const inertialTargetX =
      targetParallaxX;

    const inertialTargetY =
      targetParallaxY +
      inertiaY;

    const followSpeed =
      9.5;

    const followEase =
      1 -
      Math.exp(
        -followSpeed * dt
      );

    mouseParallaxX +=
      (
        inertialTargetX -
        mouseParallaxX
      ) *
      followEase;

    mouseParallaxY +=
      (
        inertialTargetY -
        mouseParallaxY
      ) *
      followEase;
    const worldPerPixel = pixelWorld(1);
    const rawBioVelocityX = pointerActive
      ? (mouseX - previousBioPointerX) / Math.max(dt, 0.001)
      : 0;
    const rawBioVelocityY = pointerActive
      ? (mouseY - previousBioPointerY) / Math.max(dt, 0.001)
      : 0;
    previousBioPointerX = mouseX;
    previousBioPointerY = mouseY;
    const bioVelocityEase = 1 - Math.exp(-9.0 * dt);
    bioHoverVelocityX += (rawBioVelocityX - bioHoverVelocityX) * bioVelocityEase;
    bioHoverVelocityY += (rawBioVelocityY - bioHoverVelocityY) * bioVelocityEase;
    if (!pointerActive) {
      const bioVelocityDecay = Math.exp(-7.0 * dt);
      bioHoverVelocityX *= bioVelocityDecay;
      bioHoverVelocityY *= bioVelocityDecay;
    }
    const bioPointerSpeed = Math.hypot(bioHoverVelocityX, bioHoverVelocityY);
    const bioPointerDirectionX = bioPointerSpeed > 1 ? bioHoverVelocityX / bioPointerSpeed : 0;
    const bioPointerDirectionY = bioPointerSpeed > 1 ? bioHoverVelocityY / bioPointerSpeed : 0;
    const bioWaveCarryPixels = clamp(bioPointerSpeed * 0.018, 0, 30);
    const bioWaveCarryWorld = bioWaveCarryPixels * worldPerPixel;
    const bioTime = timestamp * 0.001;
    const bioTextSettledVisibility = hasTextTargets
      ? smoothstep(clamp((morph - 0.78) / 0.16))
      : 0;
    const autoBioYaw =
      Math.sin(bioTime * 0.10) *
      THREE.MathUtils.degToRad(1.15);
    const autoBioPitch =
      Math.sin(bioTime * 0.077 + 1.1) *
      THREE.MathUtils.degToRad(0.45);
    const effectiveBioYaw = autoBioYaw * bioTextSettledVisibility;
    const effectiveBioPitch = autoBioPitch * bioTextSettledVisibility;
    const bioCosY = Math.cos(effectiveBioYaw);
    const bioSinY = Math.sin(effectiveBioYaw);
    const bioCosX = Math.cos(effectiveBioPitch);
    const bioSinX = Math.sin(effectiveBioPitch);
    const motionDebugSamples = [];
    particles.forEach((particle, index) => {
      const settings = BIO_STYLES[particle.bioType];
      const staggeredLocal = smoothstep(clamp(
        (morph - particle.morphStart) /
        (particle.morphEnd - particle.morphStart)
      ));
      const local = particle.hasBioTarget
        ? Math.max(morph * 0.18, staggeredLocal)
        : 0;
      const settled = smoothstep(clamp((local - 0.82) / 0.18));
      /*
       * =================================================
       * NORMALIZED 3D PLANET ROTATION
       * =================================================
       *
       * IMPORTANT:
       * rotate seed coordinates BEFORE viewport scaling.
       */

      const seedX =
        particle.seedX;

      const seedY =
        particle.seedY;

      const seedZ =
        particle.seedZ;

      /*
       * Continuous rotation around Y.
       */
      const normalizedX1 =
        seedX * cosY -
        seedZ * sinY;

      const normalizedZ1 =
        seedX * sinY +
        seedZ * cosY;

      /*
       * Subtle axial tilt around X.
       */
      const normalizedX2 =
        normalizedX1;

      const normalizedY2 =
        seedY * cosX -
        normalizedZ1 * sinX;

      const normalizedZ2 =
        seedY * sinX +
        normalizedZ1 * cosX;

      /*
       * Depth value BEFORE viewport scaling.
       *
       * This is used only to vary mouse parallax.
       */
      const depth01 =
        clamp(
          (
            normalizedZ2 +
            1.25
          ) /
          2.5
        );

      /*
       * Near particles respond more.
       * Far particles respond less.
       */
      const depthResponse =
        lerp(
          0.24,
          1.0,
          depth01
        ) *
        particle.parallaxStrength;

      /*
       * HERO mouse interaction fades out
       * as the particle enters BIO.
       */
      const heroInteraction =
        (1 - local) *
        depthResponse;

      /*
       * Far particles:
       * slight opposite movement.
       *
       * Near particles:
       * strong movement WITH cursor.
       */
      const depthParallax =
        lerp(
          0.38,
          1.0,
          depth01
        ) *
        particle.parallaxStrength *
        (1 - local);

      const normalizedInteractiveX =
        normalizedX2 +
        mouseParallaxX *
        depthParallax;

      const normalizedInteractiveY =
        normalizedY2 +
        mouseParallaxY *
        depthParallax *
        0.72;

      const normalizedInteractiveZ =
        normalizedZ2;

      /*
       * =================================================
       * ONLY NOW SCALE INTO VIEWPORT SPACE
       * =================================================
       */

      const rotatedX =
        normalizedInteractiveX *
        heroScaleX;

      const rotatedY =
        normalizedInteractiveY *
        heroScaleY;

      const rotatedZ =
        normalizedInteractiveZ *
        heroScaleZ;

      const driftTime =
        timestamp *
        0.00016 *
        particle.driftSpeed;

      const driftX =
        Math.sin(
          driftTime +
          particle.phase
        ) *
        particle.driftAmp;

      const driftY =
        Math.cos(
          driftTime * 0.82 +
          particle.phase * 1.13
        ) *
        particle.driftAmp *
        0.62;

      const driftZ =
        Math.sin(
          driftTime * 0.67 +
          particle.phase * 0.73
        ) *
        particle.driftAmp *
        1.35;


      const heroX =
        rotatedX +
        driftX;

      const heroY =
        rotatedY +
        driftY;

      const heroZ =
        rotatedZ +
        driftZ;
      const arc = Math.sin(local * Math.PI);
      const idleX = Math.sin(bioTime * 0.16 * particle.bioSpeed + particle.bioPhase) *
        settings.xyMotion * worldPerPixel * settled;
      const idleY = Math.cos(bioTime * 0.14 * particle.bioSpeed + particle.bioPhase * 0.83) *
        settings.xyMotion * 0.55 * worldPerPixel * settled;
      const idleZ = (
        Math.sin(bioTime * 0.31 * particle.bioDepthSpeed + particle.bioPhase) * settings.zMotion +
        Math.sin(bioTime * 0.13 + particle.bioPhase * 1.37) * settings.zMotion * 0.28
      ) * settled;
      const isBioTextParticle = ["front", "side", "back", "volume"].includes(particle.bioType);
      const activeFrontFloat = particle.bioType === "front" && particle.bioTextMotion < 0.18;
      const renderFloatPx = particle.bioType === "front" ? (activeFrontFloat ? 0.8 : 0.08) : particle.bioType === "side" ? 4.0 : particle.bioType === "volume" ? 5.0 : particle.bioType === "back" ? 6.0 : 0;
      const renderFloatWorld = renderFloatPx * worldPerPixel;
      const renderFloatX = isBioTextParticle ? Math.sin(bioTime * 0.18 * particle.bioFloatSpeed + particle.bioFloatPhase) * renderFloatWorld * settled : 0;
      const renderFloatY = isBioTextParticle ? Math.cos(bioTime * 0.145 * particle.bioFloatSpeed + particle.bioFloatPhase * 0.79) * renderFloatWorld * 0.60 * settled : 0;
      const renderDepthAmplitude = particle.bioType === "front" ? (activeFrontFloat ? 0.06 : 0.006) : particle.bioType === "side" ? 0.38 : particle.bioType === "volume" ? 0.52 : particle.bioType === "back" ? 0.68 : 0;
      const renderFloatZ = isBioTextParticle ? (Math.sin(bioTime * 0.23 * particle.bioFloatSpeed + particle.bioFloatPhase) + Math.sin(bioTime * 0.075 + particle.bioFloatPhase * 0.61) * 0.32) * renderDepthAmplitude * particle.bioDepthDirection * settled : 0;
      const animatedDepthOffset = renderFloatZ;
      const textDepthAmplitude = renderDepthAmplitude;
      const xyAmplitudePx = renderFloatPx;
      const textFloatX = renderFloatX;
      const textFloatY = renderFloatY;
      const depthDisplayScale = particle.bioType === "front" ? 1.00
        : particle.bioType === "side" ? 1.35
          : particle.bioType === "back" ? 1.85
            : particle.bioType === "volume" ? 1.55 : 1.00;
      const displayedBioZ =
        particle.bioZ *
        depthDisplayScale;
      const orientedX = particle.bioX * bioCosY + displayedBioZ * bioSinY;
      const yawZ = -particle.bioX * bioSinY + displayedBioZ * bioCosY;
      const orientedY = particle.bioY * bioCosX - yawZ * bioSinX;
      const orientedZ = particle.bioY * bioSinX + yawZ * bioCosX;

      const hoverRadius = mobile ? 90 : 120;
      const hoverScreenScale = height / worldHeightAt(orientedZ);
      const hoverScreenX = width * 0.5 + orientedX * hoverScreenScale;
      const hoverScreenY = height * 0.5 - orientedY * hoverScreenScale;
      const screenDx = hoverScreenX - mouseX;
      const screenDy = hoverScreenY - mouseY;
      const hoverDistance = Math.hypot(screenDx, screenDy);
      const hoverLinear = clamp(1 - hoverDistance / hoverRadius);
      const hoverShape = Math.pow(smoothstep(hoverLinear), 1.3);
      const force = pointerActive && preferences.finePointer.matches && settled > 0
        ? hoverShape * settled * hoverExitMultiplier : 0;
      const depthReveal = force * settled;
      const scatterX = Math.cos(particle.bioPhase * 2.17);
      const scatterY = Math.sin(particle.bioPhase * 2.17);
      const outwardX = screenDx / Math.max(hoverDistance, 1);
      const outwardY = -screenDy / Math.max(hoverDistance, 1);
      let breakupDirectionX = outwardX * 0.40 + scatterX * 0.60;
      let breakupDirectionY = outwardY * 0.40 + scatterY * 0.60;
      const breakupLength = Math.max(0.001, Math.hypot(breakupDirectionX, breakupDirectionY));
      breakupDirectionX /= breakupLength;
      breakupDirectionY /= breakupLength;
      const breakupPixels = particle.bioType === "front" ? 30 : particle.bioType === "side" ? 36 : particle.bioType === "volume" ? 42 : particle.bioType === "back" ? 48 : 0;
      const breakupWorld = breakupPixels * worldPerPixel;
      const organicScatter = 0.72 + 0.28 * (0.5 + 0.5 * Math.sin(particle.bioPhase * 5.17));
      const organicWave = 0.64 + 0.36 * (0.5 + 0.5 * Math.sin(particle.bioPhase * 3.83));
      const localBreakupX = breakupDirectionX * force * breakupWorld * organicScatter * BIO_HOVER_BREAK_STRENGTH;
      const localBreakupY = breakupDirectionY * force * breakupWorld * organicScatter * BIO_HOVER_BREAK_STRENGTH;
      const waveCarryX = bioPointerDirectionX * bioWaveCarryWorld * force * organicWave * 2.43;
      const waveCarryY = -bioPointerDirectionY * bioWaveCarryWorld * force * organicWave * 2.43;
      const targetOpenX = localBreakupX + waveCarryX;
      const targetOpenY = localBreakupY + waveCarryY;
      const mouseDepthMultiplier = particle.bioType === "front" ? 0.45
        : particle.bioType === "side" ? 0.90
          : particle.bioType === "back" ? 1.10
            : particle.bioType === "volume" ? 1.0 : 0.20;
      const depthDirection = Math.sin(particle.bioPhase * 2.17) >= 0 ? 1 : -1;
      const textDepthMouseBoost = particle.bioType === "side" ||
        particle.bioType === "back" ||
        particle.bioType === "volume"
        ? 1.18
        : 1;
      const breakupDepth = particle.bioType === "front" ? 0.65 : particle.bioType === "side" ? 0.90 : particle.bioType === "volume" ? 1.10 : particle.bioType === "back" ? 1.30 : 0;
      const speedEnergy = clamp(bioPointerSpeed / 1000, 0, 1);
      const waveDepth = Math.sin(particle.bioPhase * 4.41) * speedEnergy * 0.39 * force;
      const depthVariation = 0.76 + 0.24 * Math.sin(particle.bioPhase * 3.71);
      const targetOpenZ = force * breakupDepth * depthVariation * particle.bioDepthDirection * BIO_HOVER_DEPTH_STRENGTH + waveDepth * BIO_HOVER_DEPTH_STRENGTH;
      const organicTiming = 0.5 + 0.5 * Math.sin(particle.bioPhase * 4.13);
      const openFollowSpeed = force > 0.001
        ? 7.0 + organicTiming * 2.0
        : 2.8 + organicTiming * 1.4;
      const openEase = 1 - Math.exp(-openFollowSpeed * dt);
      particle.openX += (targetOpenX - particle.openX) * openEase;
      particle.openY += (targetOpenY - particle.openY) * openEase;
      particle.openZ += (targetOpenZ - particle.openZ) * openEase;
      const morphComplete = morph >= 0.999;
      const targetX = morphComplete
        ? orientedX + idleX + particle.openX
        : lerp(heroX, orientedX, local) + arc * particle.arcX + (idleX + particle.openX) * local;
      const targetY = morphComplete
        ? orientedY + idleY + particle.openY
        : lerp(heroY, orientedY, local) + arc * particle.arcY + (idleY + particle.openY) * local;
      const targetZ = morphComplete
        ? orientedZ + idleZ + particle.openZ
        : lerp(heroZ, orientedZ, local) + arc * particle.arcZ + (idleZ + particle.openZ) * local;
      const particleExit = smoothstep(clamp((bioExit - particle.exitDelay) / Math.max(0.001, 1 - particle.exitDelay)));
      const organicExit = Math.pow(particleExit, particle.exitCurve);
      particle.exitProgress = organicExit;
      const exitDistance = pixelWorld(Math.max(width, height) * particle.exitScale * 0.92);
      const exitArc = Math.sin(organicExit * Math.PI);
      const exitCurlAmount = pixelWorld(24);
      const exitOffsetX = particle.exitDirX * exitDistance * organicExit + Math.sin(particle.bioPhase * 3.17) * exitCurlAmount * exitArc;
      const exitOffsetY = particle.exitDirY * exitDistance * organicExit + Math.cos(particle.bioPhase * 2.73) * exitCurlAmount * exitArc;
      const exitOffsetZ = particle.exitDepth * 2.4 * organicExit;
      const exitedTargetX = targetX + exitOffsetX;
      const exitedTargetY = targetY + exitOffsetY;
      const exitedTargetZ = targetZ + exitOffsetZ;
      const positionFollowSpeed = local < 0.98 ? 11.5 : 9.0;
      const positionFollowEase = 1 - Math.exp(-positionFollowSpeed * dt);
      const previousX = particle.x;
      const previousY = particle.y;
      const previousZ = particle.z;
      particle.x += (exitedTargetX - particle.x) * positionFollowEase;
      particle.y += (exitedTargetY - particle.y) * positionFollowEase;
      particle.z += (exitedTargetZ - particle.z) * positionFollowEase;
      particle.vx = particle.x - previousX;
      particle.vy = particle.y - previousY;
      particle.vz = particle.z - previousZ;
      particle.renderX = particle.x + renderFloatX;
      particle.renderY = particle.y + renderFloatY;
      particle.renderZ = particle.z + renderFloatZ;
      const offset = index * 3;
      positions[offset] = particle.renderX;
      positions[offset + 1] = particle.renderY;
      positions[offset + 2] = particle.renderZ;
      if (
        !bioMotionDebugLogged &&
        bioTextSettledVisibility > 0.95 &&
        motionDebugSamples.length < 4
      ) {
        const wantsFront =
          particle.bioType === "front" &&
          particle.bioTextMotion < 0.20 &&
          !motionDebugSamples.some((sample) => sample.bioType === "front");
        const wantsSupport =
          (particle.bioType === "side" ||
            particle.bioType === "back" ||
            particle.bioType === "volume") &&
          !motionDebugSamples.some((sample) => sample.bioType === particle.bioType);
        if (wantsFront || wantsSupport) {
          motionDebugSamples.push({
            bioType: particle.bioType,
            textDepthAmplitude,
            xyAmplitudePx,
            animatedDepthOffset,
            textFloatX,
            textFloatY
          });
        }
      }
      /*
       * Positive Z = closer to camera.
       */

      const particleBioDepth01 = particle.bioType === "atmosphere"
        ? clamp((particle.z + 1.7) / 3.4)
        : clamp((particle.z - bioMinZ) /
          Math.max(0.001, bioMaxZ - bioMinZ));

      /*
       * Near particles become slightly larger.
       * Far particles slightly smaller.
       */

      const appliedDepthSizeScale = particle.bioType === "front"
        ? lerp(0.94, 1.06, particleBioDepth01)
        : lerp(0.78, 1.16, particleBioDepth01);
      const animatedDepthSizeMultiplier = particle.bioType === "front" ? 1
        : particle.bioType === "side" ? lerp(0.94, 1.08, particleBioDepth01)
          : particle.bioType === "back" ? lerp(0.86, 1.12, particleBioDepth01)
            : particle.bioType === "volume" ? lerp(0.90, 1.10, particleBioDepth01) : 1;
      const dynamicZOffset =
        animatedDepthOffset;
      const dynamicDepthSize = particle.bioType === "front" ? 1
        : clamp(
          1 + dynamicZOffset * 0.20,
          0.90,
          1.12
        );
      const renderDepthSizeMultiplier = particle.bioType === "front"
        ? (activeFrontFloat ? clamp(1 + renderFloatZ * 0.12, 0.95, 1.07) : 1)
        : clamp(1 + renderFloatZ * 0.20, 0.86, 1.16);

      const baseBioSize = particle.bioBaseSize * (mobile ? 0.76 : 1);

      sizes[index] =
        lerp(
          particle.size,
          baseBioSize *
            appliedDepthSizeScale *
            animatedDepthSizeMultiplier *
            dynamicDepthSize *
            renderDepthSizeMultiplier,
          local
        );

      const appliedDepthAlphaScale = particle.bioType === "front"
        ? lerp(0.94, 1.04, particleBioDepth01)
        : lerp(0.70, 1.08, particleBioDepth01);
      const supportDepthAlphaScale = particle.bioType === "front" ||
        particle.bioType === "atmosphere"
        ? 1
        : lerp(0.86, 1.12, particleBioDepth01);
      const dynamicDepthAlpha = particle.bioType === "front" ? 1
        : clamp(
          1 + animatedDepthOffset * 0.16,
          0.90,
          1.10
        );
      const renderDepthAlphaMultiplier = particle.bioType === "front"
        ? 1
        : clamp(1 + renderFloatZ * 0.16, 0.86, 1.14);
      let interactionAlphaBoost = 1;

      if (particle.bioType === "side") {
        interactionAlphaBoost = lerp(1, 1.55, depthReveal);
      } else if (particle.bioType === "back") {
        interactionAlphaBoost = lerp(1, 1.75, depthReveal);
      } else if (particle.bioType === "volume") {
        interactionAlphaBoost = lerp(1, 1.60, depthReveal);
      }

      const bioAlpha =
        Math.min(
          1,
          particle.bioBaseAlpha *
            appliedDepthAlphaScale *
            supportDepthAlphaScale *
            dynamicDepthAlpha *
            renderDepthAlphaMultiplier *
            interactionAlphaBoost
        );

      const exitParticleVisibility = 1 - smoothstep(clamp((bioExit - 0.86) / 0.14));
      alphas[index] =
        lerp(
          particle.alpha,
          bioAlpha,
          local
        ) * exitParticleVisibility;
    });
    positionAttribute.needsUpdate = true;
    sizeAttribute.needsUpdate = true;
    alphaAttribute.needsUpdate = true;
    if (
      !bioMotionDebugLogged &&
      bioTextSettledVisibility > 0.95
    ) {
      console.table(motionDebugSamples);
      bioMotionDebugLogged = true;
    }
    if (revealContext && revealCanvas) {
      revealContext.clearRect(0, 0, width, height);
      if (whiteRevealProgress > 0.001) {
        const revealStep = Math.max(1, Math.floor(particles.length / (mobile ? 90 : 180)));
        for (let index = 0; index < particles.length; index += revealStep) {
          const particle = particles[index];
          const localReveal = smoothstep(clamp(((particle.exitProgress || 0) - 0.18) / 0.82));
          if (localReveal <= 0.001) continue;
          const pz = Number.isFinite(particle.renderZ) ? particle.renderZ : particle.z;
          const screenScale = height / worldHeightAt(pz);
          const screenX = width * 0.5 + (Number.isFinite(particle.renderX) ? particle.renderX : particle.x) * screenScale;
          const screenY = height * 0.5 - (Number.isFinite(particle.renderY) ? particle.renderY : particle.y) * screenScale;
          if (screenX < -220 || screenX > width + 220 || screenY < -220 || screenY > height + 220) continue;
          const phaseVariation = 0.84 + 0.16 * Math.sin(particle.bioPhase * 4.37);
          const revealGrowth = Math.pow(localReveal, 1.3);
          const radius = (2 + revealGrowth * 90) * phaseVariation;
          revealContext.globalAlpha = revealGrowth * 0.14;
          revealContext.drawImage(revealStamp, screenX - radius, screenY - radius, radius * 2, radius * 2);
        }
        revealContext.globalAlpha = 1;
        const finalWhite = smoothstep(clamp((bioExit - 0.82) / 0.18));
        if (finalWhite > 0) {
          revealContext.fillStyle = "rgba(255,255,255," + finalWhite.toFixed(4) + ")";
          revealContext.fillRect(0, 0, width, height);
        }
      }
    }
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
    particle.renderX = particle.x;
    particle.renderY = particle.y;
    particle.renderZ = particle.z;
    const offset = index * 3;
    positions[offset] = particle.x;
    positions[offset + 1] = particle.y;
    positions[offset + 2] = particle.z;
    colors[offset] = particle.color[0];
    colors[offset + 1] = particle.color[1];
    colors[offset + 2] = particle.color[2];
  });
  const fontReady = document.fonts?.ready || Promise.resolve();
  fontReady.then(assignBioTargets).catch((error) => {
    console.error("BIO TextGeometry initialization failed:", error);
    throw error;
  });
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
    clearTimeout(bioRebuildTimer);
    bioRebuildTimer = setTimeout(assignBioTargets, 160);
  }, { passive: true });
  addEventListener("orientationchange", () => {
    resize();
    clearTimeout(bioRebuildTimer);
    bioRebuildTimer = setTimeout(assignBioTargets, 160);
  }, { passive: true });
  document.addEventListener("visibilitychange", start);
  canvas.addEventListener("webglcontextlost", (event) => {
    event.preventDefault();
    stopped = true;
    if (frame) cancelAnimationFrame(frame);
    handleWebGLFailure(new Error("WebGL context lost"));
  }, { passive: false });
  start();
}
