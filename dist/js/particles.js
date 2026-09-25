import { clamp } from "./scroll.js";

const MORPH_START = 0.30;
const MORPH_END = 0.72;
const CAMERA_Z = 8;
const CAMERA_FOV = 44;
const BIO_STYLES = {
  front: { size: 1.90, alpha: 0.91, xyMotion: 0.012, zMotion: 0.010, mouseXY: 0.20, mouseZ: 0.26 },
  side: { size: 1.05, alpha: 0.10, xyMotion: 0.08, zMotion: 0.040, mouseXY: 0.38, mouseZ: 0.72 },
  back: { size: 0.82, alpha: 0.035, xyMotion: 0.10, zMotion: 0.055, mouseXY: 0.42, mouseZ: 0.88 },
  volume: { size: 0.95, alpha: 0.08, xyMotion: 0.09, zMotion: 0.050, mouseXY: 0.40, mouseZ: 0.78 },
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

  const maxTrailSegments = mobile ? 60 : 180;
  const trailPositions = new Float32Array(maxTrailSegments * 2 * 3);
  const trailGeometry = new THREE.BufferGeometry();
  const trailPositionAttribute = new THREE.BufferAttribute(trailPositions, 3);
  trailPositionAttribute.setUsage(THREE.DynamicDrawUsage);
  trailGeometry.setAttribute("position", trailPositionAttribute);
  trailGeometry.setDrawRange(0, 0);
  const trailMaterial = new THREE.LineBasicMaterial({
    color: 0xd9d9d2,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    depthTest: false
  });
  const trailLines = new THREE.LineSegments(trailGeometry, trailMaterial);
  trailLines.frustumCulled = false;
  trailLines.renderOrder = 0;
  scene.add(trailLines);

  const maxConnectionSegments = mobile ? 60 : 180;
  const connectionPositions = new Float32Array(maxConnectionSegments * 2 * 3);
  const connectionGeometry = new THREE.BufferGeometry();
  const connectionPositionAttribute = new THREE.BufferAttribute(connectionPositions, 3);
  connectionPositionAttribute.setUsage(THREE.DynamicDrawUsage);
  connectionGeometry.setAttribute("position", connectionPositionAttribute);
  connectionGeometry.setDrawRange(0, 0);
  const connectionMaterial = new THREE.LineBasicMaterial({
    color: 0xd8d6cf,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    depthTest: false
  });
  const connectionLines = new THREE.LineSegments(connectionGeometry, connectionMaterial);
  connectionLines.frustumCulled = false;
  connectionLines.renderOrder = 0;
  scene.add(connectionLines);

  const trailEligible = (particle) => {
    if (particle.bioType === "atmosphere") {
      return false;
    }
    if (particle.bioType === "front") {
      return particle.bioTextMotion < 0.06;
    }
    return true;
  };

  const eligibleForTextConnection = (particle) => {
    if (particle.bioType === "atmosphere") {
      return false;
    }
    if (particle.bioType === "front") {
      return Math.sin(particle.bioFloatPhase * 8.731) > 0.60;
    }
    return particle.bioType === "side" ||
      particle.bioType === "back" ||
      particle.bioType === "volume";
  };

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
  let bioYaw = 0;
  let bioPitch = 0;
  let bioRebuildTimer = 0;
  let bioDebugLogged = false;
  let bioCountDebugLogged = false;
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
        0.02 +
        radialDistance * 0.10 +
        random(0, 0.065);

      particle.morphEnd =
        Math.min(
          1,
          particle.morphStart +
          random(0.68, 0.82)
        );
    });
  }

  function textTargets() {
    const primary = bioCopy.querySelector(".bio-text-primary");
    if (!primary || width < 20 || height < 20) return [];
    const rect = primary.getBoundingClientRect();
    const sourceText = primary.dataset.bio || primary.textContent || "";
    const apostrophe = sourceText.includes("’") ? "’" : "'";
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

    const BIO_TEXT_DEPTH = 0.24;
    const LINE_HEIGHT = mobile ? 1.08 : 1.12;
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
    const frontCount = Math.floor(typographyCount * 0.84);
    const sideCount = Math.floor(typographyCount * 0.07);
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
    const desiredPixelWidth = mobile ? width * 0.84 : Math.min(width * 0.68, 1080);
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
    const bioVerticalOffset = pixelWorld(height * 0.05);
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
    const morph = smoothstep(clamp((progress - MORPH_START) / (MORPH_END - MORPH_START)));
    /*
     * Continuous planetary rotation.
     *
     * 0.000045 rad/ms gives roughly one complete
     * rotation every ~140 seconds.
     */
    const rotationY =
      timestamp * 0.000036;

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

    const cosY = Math.cos(rotationY);
    const sinY = Math.sin(rotationY);

    const cosX = Math.cos(tiltX);
    const sinX = Math.sin(tiltX);

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
    const horizontalStrength =
      pointerNormX >= 0
        ? 0.105
        : 0.088;

    const targetParallaxX =
      pointerNormX *
      horizontalStrength;

    const targetParallaxY =
      -pointerNormY * 0.055;

    const dt =
      Math.max(
        0.008,
        Math.min(
          0.05,
          delta / 60
        )
      );

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

    const inertiaX =
      clamp(
        smoothedPointerVelocityX * 0.0065,
        -0.026,
        0.026
      );

    const inertiaY =
      clamp(
        smoothedPointerVelocityY * 0.004,
        -0.012,
        0.012
      );

    const inertialTargetX =
      targetParallaxX +
      inertiaX;

    const inertialTargetY =
      targetParallaxY +
      inertiaY;

    const followSpeed =
      7.2;

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
    const bioTiltEase = 1 - Math.exp(-3.2 * dt);
    bioYaw += (pointerNormX * Math.PI / 120 - bioYaw) * bioTiltEase;
    bioPitch += (-pointerNormY * Math.PI / 225 - bioPitch) * bioTiltEase;
    const bioCosY = Math.cos(bioYaw);
    const bioSinY = Math.sin(bioYaw);
    const bioCosX = Math.cos(bioPitch);
    const bioSinX = Math.sin(bioPitch);
    const worldPerPixel = pixelWorld(1);
    const bioTime = timestamp * 0.001;
    const bioTextSettledVisibility = hasTextTargets
      ? smoothstep(clamp((morph - 0.90) / 0.10))
      : 0;
    const currentPulse =
      0.88 +
      Math.sin(bioTime * 0.75) *
        0.12;
    trailMaterial.opacity = 0.055 * bioTextSettledVisibility;
    connectionMaterial.opacity =
      0.065 *
      bioTextSettledVisibility *
      currentPulse;
    particles.forEach((particle, index) => {
      const settings = BIO_STYLES[particle.bioType];
      const local = particle.hasBioTarget
        ? smoothstep(clamp((morph - particle.morphStart) / (particle.morphEnd - particle.morphStart)))
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
          -0.16,
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
      const textDepthAmplitude = particle.bioType === "front"
        ? (particle.bioTextMotion < 0.18 ? 0.028 : 0.008)
        : particle.bioType === "side" ? 0.065
          : particle.bioType === "back" ? 0.115
            : particle.bioType === "volume" ? 0.090 : 0;
      const textDepthBreath =
        Math.sin(
          bioTime * 0.34 * particle.bioFloatSpeed +
          particle.bioFloatPhase
        ) *
        textDepthAmplitude *
        settled;
      const textDepthDrift =
        Math.sin(
          bioTime * 0.11 +
          particle.bioFloatPhase * 0.73
        ) *
        textDepthAmplitude *
        0.45 *
        settled;
      const animatedDepthOffset =
        particle.bioType === "atmosphere"
          ? 0
          : (textDepthBreath + textDepthDrift) *
            particle.bioDepthDirection;
      const xyAmplitude = particle.bioType === "front"
        ? (particle.bioTextMotion < 0.18 ? worldPerPixel * 0.55 : worldPerPixel * 0.12)
        : particle.bioType === "side" ? worldPerPixel * 0.75
          : particle.bioType === "back" ? worldPerPixel * 1.15
            : particle.bioType === "volume" ? worldPerPixel * 0.90 : 0;
      const textFloatX =
        Math.sin(
          bioTime * 0.21 * particle.bioFloatSpeed +
          particle.bioFloatPhase
        ) *
        xyAmplitude *
        settled;
      const textFloatY =
        Math.cos(
          bioTime * 0.17 * particle.bioFloatSpeed +
          particle.bioFloatPhase * 0.81
        ) *
        xyAmplitude *
        0.65 *
        settled;
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

      const screenScale = height / worldHeightAt(particle.z);
      const dx = width * 0.5 + particle.x * screenScale - mouseX;
      const dy = height * 0.5 - particle.y * screenScale - mouseY;
      const distance = Math.hypot(dx, dy);
      const force = pointerActive && preferences.finePointer.matches && settled > 0
        ? smoothstep(clamp(1 - distance / 155)) * settled : 0;
      const depthReveal = force * settled;
      const normalizedDx = dx / Math.max(distance, 1);
      const normalizedDy = -dy / Math.max(distance, 1);
      const targetOpenX = normalizedDx * force * settings.mouseXY * worldPerPixel * 0.5;
      const targetOpenY = normalizedDy * force * settings.mouseXY * worldPerPixel * 0.5;
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
      const targetOpenZ =
        force *
        settings.mouseZ *
        mouseDepthMultiplier *
        textDepthMouseBoost *
        depthDirection;
      const openEase = 1 - Math.exp(-6 * dt);
      particle.openX += (targetOpenX - particle.openX) * openEase;
      particle.openY += (targetOpenY - particle.openY) * openEase;
      particle.openZ += (targetOpenZ - particle.openZ) * openEase;
      const targetX = lerp(heroX, orientedX, local) +
        arc * particle.arcX + (idleX + textFloatX + particle.openX) * local;
      const targetY = lerp(heroY, orientedY, local) +
        arc * particle.arcY + (idleY + textFloatY + particle.openY) * local;
      const targetZ = lerp(heroZ, orientedZ, local) +
        arc * particle.arcZ + (idleZ + animatedDepthOffset + particle.openZ) * local;
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

      const baseBioSize = particle.bioBaseSize * (mobile ? 0.76 : 1);

      sizes[index] =
        lerp(
          particle.size,
          baseBioSize *
            appliedDepthSizeScale *
            animatedDepthSizeMultiplier,
          local
        );

      const appliedDepthAlphaScale = particle.bioType === "front"
        ? lerp(0.94, 1.04, particleBioDepth01)
        : lerp(0.70, 1.08, particleBioDepth01);
      const supportDepthAlphaScale = particle.bioType === "front" ||
        particle.bioType === "atmosphere"
        ? 1
        : lerp(0.86, 1.12, particleBioDepth01);
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
            interactionAlphaBoost
        );

      alphas[index] =
        lerp(
          particle.alpha,
          bioAlpha,
          local
        );
    });
    positionAttribute.needsUpdate = true;
    sizeAttribute.needsUpdate = true;
    alphaAttribute.needsUpdate = true;
    let trailSegmentCount = 0;
    if (bioTextSettledVisibility >= 0.05) {
      for (let index = 0; index < particles.length; index += 1) {
        if (trailSegmentCount >= maxTrailSegments) {
          break;
        }
        const particle = particles[index];
        if (!trailEligible(particle)) {
          continue;
        }
        const velocityMagnitude = Math.sqrt(
          particle.vx * particle.vx +
          particle.vy * particle.vy +
          particle.vz * particle.vz
        );
        if (velocityMagnitude < 0.0005) {
          continue;
        }
        const trailScale = particle.bioType === "back" ? 13
          : particle.bioType === "volume" ? 11
            : particle.bioType === "side" ? 9 : 6;
        const offset = trailSegmentCount * 6;
        trailPositions[offset] = particle.x;
        trailPositions[offset + 1] = particle.y;
        trailPositions[offset + 2] = particle.z;
        trailPositions[offset + 3] = particle.x - particle.vx * trailScale;
        trailPositions[offset + 4] = particle.y - particle.vy * trailScale;
        trailPositions[offset + 5] = particle.z - particle.vz * trailScale;
        trailSegmentCount += 1;
      }
    }
    trailGeometry.setDrawRange(0, trailSegmentCount * 2);
    trailPositionAttribute.needsUpdate = true;

    let connectionSegmentCount = 0;
    if (bioTextSettledVisibility >= 0.05) {
      const connectionDistance = worldPerPixel * (mobile ? 22 : 26);
      const connectionDistanceSquared = connectionDistance * connectionDistance;
      const cellSize = connectionDistance;
      const connectionGrid = new Map();
      const connectionCandidates = [];
      const connectionKey = (x, y) =>
        Math.floor(x / cellSize) + ":" + Math.floor(y / cellSize);
      for (let index = 0; index < particles.length; index += 1) {
        const particle = particles[index];
        if (!eligibleForTextConnection(particle)) {
          continue;
        }
        const candidate = {
          particle,
          candidateIndex: connectionCandidates.length,
          cellX: Math.floor(particle.x / cellSize),
          cellY: Math.floor(particle.y / cellSize)
        };
        connectionCandidates.push(candidate);
        const key = connectionKey(particle.x, particle.y);
        if (!connectionGrid.has(key)) {
          connectionGrid.set(key, []);
        }
        connectionGrid.get(key).push(candidate);
        if (connectionCandidates.length >= (mobile ? 400 : 1100)) {
          break;
        }
      }
      for (const candidate of connectionCandidates) {
        if (connectionSegmentCount >= maxConnectionSegments) {
          break;
        }
        const a = candidate.particle;
        for (let offsetX = -1; offsetX <= 1; offsetX += 1) {
          if (connectionSegmentCount >= maxConnectionSegments) {
            break;
          }
          for (let offsetY = -1; offsetY <= 1; offsetY += 1) {
            if (connectionSegmentCount >= maxConnectionSegments) {
              break;
            }
            const bucket = connectionGrid.get(
              (candidate.cellX + offsetX) + ":" + (candidate.cellY + offsetY)
            );
            if (!bucket) {
              continue;
            }
            for (const neighbor of bucket) {
              if (connectionSegmentCount >= maxConnectionSegments) {
                break;
              }
              if (neighbor.candidateIndex <= candidate.candidateIndex) {
                continue;
              }
              const b = neighbor.particle;
              const stableConnection = Math.sin(
                a.bioFloatPhase * 13.713 +
                b.bioFloatPhase * 7.119
              );
              if (stableConnection <= 0.48) {
                continue;
              }
              const dx = a.x - b.x;
              const dy = a.y - b.y;
              const dz = (a.z - b.z) * 0.65;
              const distanceSquared = dx * dx + dy * dy + dz * dz;
              if (distanceSquared >= connectionDistanceSquared) {
                continue;
              }
              const positionOffset = connectionSegmentCount * 6;
              connectionPositions[positionOffset] = a.x;
              connectionPositions[positionOffset + 1] = a.y;
              connectionPositions[positionOffset + 2] = a.z;
              connectionPositions[positionOffset + 3] = b.x;
              connectionPositions[positionOffset + 4] = b.y;
              connectionPositions[positionOffset + 5] = b.z;
              connectionSegmentCount += 1;
            }
          }
        }
      }
    }
    connectionGeometry.setDrawRange(0, connectionSegmentCount * 2);
    connectionPositionAttribute.needsUpdate = true;
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
