import { clamp } from "./scroll.js";

const MORPH_START = 0.30;
const MORPH_END = 0.72;
const CAMERA_Z = 8;
const CAMERA_FOV = 44;
const BIO_STYLES = {
  front: { size: 2.05, alpha: 0.84, xyMotion: 0.10, zMotion: 0.045, mouseXY: 0.35, mouseZ: 0.42 },
  side: { size: 1.65, alpha: 0.43, xyMotion: 0.22, zMotion: 0.12, mouseXY: 0.55, mouseZ: 0.85 },
  back: { size: 1.38, alpha: 0.23, xyMotion: 0.30, zMotion: 0.18, mouseXY: 0.65, mouseZ: 1.05 },
  volume: { size: 1.45, alpha: 0.31, xyMotion: 0.25, zMotion: 0.16, mouseXY: 0.55, mouseZ: 0.92 },
  atmosphere: { size: 0.85, alpha: 0.035, xyMotion: 0.65, zMotion: 0.35, mouseXY: 0.15, mouseZ: 0.18 }
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
  const bioTypographyCount = Math.floor(count * (mobile ? 0.62 : 0.60));
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
    const frontCount = Math.floor(typographyCount * 0.60);
    const sideCount = Math.floor(typographyCount * 0.22);
    const backCount = Math.floor(typographyCount * 0.10);
    const volumeCount = typographyCount - frontCount - sideCount - backCount;
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
    const frontTargets = [];
    const frontSpacing = mobile ? 0.030 : 0.027;
    const acceptedFront = new Map();
    const acceptFront = (sample, spacing) => {
      const gx = Math.floor(sample.x / spacing);
      const gy = Math.floor(sample.y / spacing);
      for (let ox = -1; ox <= 1; ox += 1) {
        for (let oy = -1; oy <= 1; oy += 1) {
          const bucket = acceptedFront.get((gx + ox) + ":" + (gy + oy));
          if (bucket && bucket.some((point) =>
            (sample.x - point.x) ** 2 + (sample.y - point.y) ** 2 < spacing ** 2)) {
            return false;
          }
        }
      }
      const key = gx + ":" + gy;
      if (!acceptedFront.has(key)) acceptedFront.set(key, []);
      acceptedFront.get(key).push({ x: sample.x, y: sample.y });
      return true;
    };

    let spacing = frontSpacing;
    while (frontTargets.length < frontCount && spacing >= frontSpacing * 0.48) {
      const candidate = sampleWantedSurface("front");
      if (candidate && acceptFront(candidate, spacing)) {
        frontTargets.push(candidate);
      } else if (frontTargets.length < frontCount && Math.random() < 0.02) {
        spacing *= 0.985;
      }
    }
    while (frontTargets.length < frontCount) {
      const candidate = sampleWantedSurface("front");
      if (!candidate) throw new Error("BIO TextGeometry front sampling failed");
      frontTargets.push(candidate);
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
    for (let index = 0; index < atmosphereCount; index += 1) {
      targets.push({
        x: random(-typographyWidth * 0.62, typographyWidth * 0.62),
        y: random(-typographyHeight * 1.05, typographyHeight * 1.05),
        z: random(-1.6, 1.6),
        type: "atmosphere"
      });
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
    bioMinZ = Math.min(...targets.map((target) => target.z));
    bioMaxZ = Math.max(...targets.map((target) => target.z));
    particles.forEach((particle, index) => {
      const target = targets[index];
      particle.bioType = target.type;
      particle.hasBioTarget = true;
      particle.bioX = target.x;
      particle.bioY = target.y;
      particle.bioZ = target.z;
      particle.bioBaseSize = target.type === "front"
        ? (Math.random() < 0.06 ? random(2.15, 2.45) : random(1.55, 2.15))
        : target.type === "side"
          ? random(1.25, 1.85)
          : target.type === "back"
            ? random(1.0, 1.55)
            : target.type === "volume"
              ? random(1.10, 1.70)
              : random(0.45, 1.0);
      particle.bioBaseAlpha = target.type === "front"
        ? random(0.72, 0.94)
        : target.type === "side"
          ? random(0.30, 0.55)
          : target.type === "back"
            ? random(0.12, 0.28)
            : target.type === "volume"
              ? random(0.20, 0.42)
              : (Math.random() < 0.025 ? random(0.05, 0.09) : random(0.008, 0.045));
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
      const bioTime = timestamp * 0.001;
      const idleX = Math.sin(bioTime * 0.16 * particle.bioSpeed + particle.bioPhase) *
        settings.xyMotion * worldPerPixel * settled;
      const idleY = Math.cos(bioTime * 0.14 * particle.bioSpeed + particle.bioPhase * 0.83) *
        settings.xyMotion * 0.55 * worldPerPixel * settled;
      const idleZ = (
        Math.sin(bioTime * 0.31 * particle.bioDepthSpeed + particle.bioPhase) * settings.zMotion +
        Math.sin(bioTime * 0.13 + particle.bioPhase * 1.37) * settings.zMotion * 0.28
      ) * settled;
      const orientedX = particle.bioX * bioCosY + particle.bioZ * bioSinY;
      const yawZ = -particle.bioX * bioSinY + particle.bioZ * bioCosY;
      const orientedY = particle.bioY * bioCosX - yawZ * bioSinX;
      const orientedZ = particle.bioY * bioSinX + yawZ * bioCosX;

      const screenScale = height / worldHeightAt(particle.z);
      const dx = width * 0.5 + particle.x * screenScale - mouseX;
      const dy = height * 0.5 - particle.y * screenScale - mouseY;
      const distance = Math.hypot(dx, dy);
      const force = pointerActive && preferences.finePointer.matches && settled > 0
        ? smoothstep(clamp(1 - distance / 155)) * settled : 0;
      const normalizedDx = dx / Math.max(distance, 1);
      const normalizedDy = -dy / Math.max(distance, 1);
      const targetOpenX = normalizedDx * force * settings.mouseXY * worldPerPixel * 0.5;
      const targetOpenY = normalizedDy * force * settings.mouseXY * worldPerPixel * 0.5;
      const mouseDepthMultiplier = particle.bioType === "front" ? 0.45
        : particle.bioType === "side" ? 0.90
          : particle.bioType === "back" ? 1.10
            : particle.bioType === "volume" ? 1.0 : 0.20;
      const depthDirection = Math.sin(particle.bioPhase * 2.17) >= 0 ? 1 : -1;
      const targetOpenZ = force * settings.mouseZ * mouseDepthMultiplier * depthDirection;
      const openEase = 1 - Math.exp(-6 * dt);
      particle.openX += (targetOpenX - particle.openX) * openEase;
      particle.openY += (targetOpenY - particle.openY) * openEase;
      particle.openZ += (targetOpenZ - particle.openZ) * openEase;
      const targetX = lerp(heroX, orientedX, local) +
        arc * particle.arcX + (idleX + particle.openX) * local;
      const targetY = lerp(heroY, orientedY, local) +
        arc * particle.arcY + (idleY + particle.openY) * local;
      const targetZ = lerp(heroZ, orientedZ, local) +
        arc * particle.arcZ + (idleZ + particle.openZ) * local;
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

      const bioDepth01 = clamp((particle.z - bioMinZ) /
        Math.max(0.001, bioMaxZ - bioMinZ));

      /*
       * Near particles become slightly larger.
       * Far particles slightly smaller.
       */

      const depthSizeScale = lerp(0.78, 1.16, bioDepth01);

      const baseBioSize = particle.bioBaseSize * (mobile ? 0.76 : 1);

      sizes[index] =
        lerp(
          particle.size,
          baseBioSize *
            lerp(
              1,
              depthSizeScale,
              settled
            ),
          local
        );

      const depthAlphaScale = lerp(0.70, 1.08, bioDepth01);

      const bioAlpha =
        particle.bioBaseAlpha *
        lerp(
          1,
          depthAlphaScale,
          settled
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
