// setup and declarations
const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(
  60,
  window.innerWidth / window.innerHeight,
  0.1,
  1000,
);

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
renderer.domElement.style.touchAction = "none";
document.body.appendChild(renderer.domElement);

let autoSpin = true;
let colorMode = 0;

let soilSize = 22;
let plantsN = 120;
let maxStemHeight = 10;
let minStemHeight = 4;

let cameraRadius = 27;
const MIN_RADIUS = 15;
const MAX_RADIUS = 27;

const cameraTargetY = 6;

const sprites = [];
const spriteData = [];

// characters
const textureCache = {};

function makeCharTexture(char, color) {
  const key = char + color;
  if (textureCache[key]) return textureCache[key];

  const size = 64;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");

  ctx.clearRect(0, 0, size, size);
  ctx.font = `bold ${size * 0.75}px monospace`;
  ctx.fillStyle = color;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(char, size / 2, size / 2);

  const tex = new THREE.CanvasTexture(canvas);
  textureCache[key] = tex;
  return tex;
}

const CHARS = {
  stem: ["|", "¦", "║"],
  leaf: ["~", "§", "∿", "❧"],
  flower: ["✿", "❀", "✾", "❁"],
  branch: ["/", "\\", "╱", "╲"],
  soil: ["_", ".", ",", "﹏", "~", "░", "▒"],
};

function pickChar(type) {
  const arr = CHARS[type];
  return arr[Math.floor(Math.random() * arr.length)];
}

function buildSoil() {
  let points = [];

  // soil
  for (let x = -soilSize; x <= soilSize; x += 0.5) {
    for (let z = -soilSize; z <= soilSize; z += 0.5) {
      const dist = Math.sqrt(x * x + z * z);
      // only inside a circle radius
      if (dist < soilSize * 0.9) {
        points.push({
          char: pickChar("soil"),
          x: x + (Math.random() - 0.5) * 0.3,
          y: -0.3 + Math.random() * 0.2,
          z: z + (Math.random() - 0.5) * 0.3,
          color: getColor("soil", colorMode),
          type: "soil",
        });
      }
    }
  }

  return points;
}

function buildPlant() {
  let mainStemHeight = Math.floor(
    Math.random() * (maxStemHeight - minStemHeight + 1) + minStemHeight,
  );

  let points = [];

  const soilRadius = soilSize * 0.9;
  const angle = Math.random() * Math.PI * 2;
  const r = soilRadius * Math.sqrt(Math.random());
  // sqrt keeps distribution uniform

  const initialX = Math.cos(angle) * r;
  const initialZ = Math.sin(angle) * r;
  const branchAngle = Math.random() * Math.PI * 2;

  // main stem
  for (let h = 0; h <= mainStemHeight; h += 0.55) {
    const sway = Math.sin(h * 0.8) * 0.15;
    points.push({
      char: pickChar("stem"),
      x: initialX + sway,
      y: h,
      z: initialZ,
      color: getColor("stem", colorMode),
      type: "stem",
    });
  }

  let branchDefs = [];

  for (let i = 0; i < Math.max(Math.ceil(Math.random() * 15), 4); i++) {
    const minH = 2;
    const maxH = mainStemHeight - 2.5;

    const startH = Math.random() * (maxH - minH) + minH;
    const dir = Math.random() < 0.5 ? -1 : 1;
    const len = Math.min(
      4,
      Math.max(
        1.2,
        Math.max(0.3, Math.random()) * 1.3 * ((mainStemHeight / startH) * 0.5),
      ),
    );
    const slope = Math.max(0.7, Math.random() * 2);

    branchDefs.push({
      startH,
      dir,
      len,
      slope,
    });
  }

  for (const b of branchDefs) {
    const steps = Math.floor(b.len / 0.5); // double the length of the branch in units

    for (let s = 0; s <= steps; s++) {
      const t = s / steps; // normalized step in steps
      const by = b.startH + t * b.slope; // y position

      const bDist = b.dir * t * b.len;
      bx = Math.cos(branchAngle) * bDist;
      bz = Math.sin(branchAngle) * bDist;

      for (let dz = -0.15; dz <= 0.15; dz += 0.3) {
        points.push({
          char: s === 0 ? (b.dir > 0 ? "/" : "\\") : pickChar("branch"),
          x: initialX + bx,
          y: by,
          z: initialZ + dz + bz,
          color: getColor("branch", colorMode),
          type: "branch",
        });
      }

      // leaf clusters : arranged in a circle around the branch
      if (s > 0) {
        for (let li = 0; li < 3; li++) {
          const angle = (li / 3) * Math.PI * 2; // 0, 120, 240
          const r = 0.2 + Math.random() * 0.5;
          points.push({
            char: pickChar("leaf"),
            x: initialX + bx + Math.cos(angle) * r,
            y: by + (Math.random() - 0.5) * 0.5,
            z: initialZ + bz + Math.sin(angle) * r,
            color: getColor("leaf", colorMode),
            type: "leaf",
          });
        }
      }
    }
  }

  const flowerColor =
    colorMode === 2 ? (Math.random() < 0.5 ? 0 : 1) : colorMode;

  // flowers at the top
  const flowerH = mainStemHeight - 0.5;
  for (let a = 0; a < Math.PI * 2; a += 0.35) {
    const r = 0.8 + Math.random() * 0.8;
    points.push({
      char: pickChar("flower"),
      x: initialX + Math.cos(a) * r,
      y: flowerH + Math.random() * 1,
      z: initialZ + Math.sin(a) * r,
      color: getColor("flowerFirst", flowerColor),
      type: "flowerFirst",
    });
  }

  for (let i = 0; i < 12; i++) {
    points.push({
      char: pickChar("flower"),
      x: initialX + (Math.random() - 0.5) * 2,
      y: flowerH + 0.5 + Math.random() * 0.9,
      z: initialZ + (Math.random() - 0.5) * 2,
      color: getColor("flowerSecond", flowerColor),
      type: "flowerSecond",
    });
  }

  for (let i = 0; i < 8; i++) {
    points.push({
      char: pickChar("flower"),
      x: initialX + (Math.random() - 0.5) * 0.6,
      y: flowerH + 0.7 + Math.random() * 1,
      z: initialZ + (Math.random() - 0.5) * 0.6,
      color: getColor("flowerThird", flowerColor),
      type: "flowerThird",
    });
  }

  return points;
}

// colors
const COLORS = {
  blue: {
    stem: "#4a9e5c",
    leaf: "#3dcc6a",
    flowerFirst: "#005296",
    flowerSecond: "#328bd4",
    flowerThird: "#8dcbe4",
    branch: "#4a9e5c",
    soil: "#5c4033",
  },
  red: {
    stem: "#4a9e5c",
    leaf: "#3dcc6a",
    flowerFirst: "#a73012",
    flowerSecond: "#ce4e2f",
    flowerThird: "#fd8f00",
    branch: "#4a9e5c",
    soil: "#5c4033",
  },
};

function getColor(type, mode) {
  const blueScheme = COLORS.blue;
  const redScheme = COLORS.red;

  const scheme = mode === 0 ? redScheme : blueScheme;

  return scheme[type] || "#88ff88";
}

function buildSprites() {
  let plantPoints = [];

  for (let i = 0; i < plantsN; i++) {
    plantPoints = [...plantPoints, ...buildPlant()];
  }

  const soilPoints = buildSoil();
  const points = [...plantPoints, ...soilPoints];

  // clean up old sprites
  for (let i = spriteData.length - 1; i >= 0; i--) {
    scene.remove(spriteData[i].sprite);
    spriteData[i].sprite.material.map.dispose();
    spriteData[i].sprite.material.dispose();
  }

  spriteData.length = 0;
  sprites.length = 0;

  points.forEach((p, i) => {
    const color = getColor(p.type, i, colorMode);
    const tex = makeCharTexture(p.char, p.color);

    const mat = new THREE.SpriteMaterial({
      map: tex,
      transparent: true, // transparent so only the character pixel shows
      depthWrite: false,
    });
    const sprite = new THREE.Sprite(mat);

    // scale the sprites in the world
    const scale =
      p.type === "flower"
        ? 0.9
        : p.type === "leaf"
          ? 0.75
          : p.type === "soil"
            ? 0.55
            : 0.65;
    sprite.scale.set(scale, scale, 1);
    sprite.position.set(p.x, p.y, p.z);

    scene.add(sprite);

    spriteData.push({
      sprite,
      basePos: new THREE.Vector3(p.x, p.y, p.z),
      color: getColor(p.type, colorMode),
      type: p.type,
      char: p.char,
      index: i,
    });
    sprites.push(sprite);
  });
}

buildSprites();

// mouse and touch controls
let isDragging = false;
let prevMouse = { x: 0, y: 0 };
let rotY = 0;
let rotX = 0.15;

renderer.domElement.addEventListener("mousedown", (e) => {
  isDragging = true;
  prevMouse = { x: e.clientX, y: e.clientY };
});

renderer.domElement.addEventListener("mousemove", (e) => {
  if (!isDragging) return;
  rotY += (e.clientX - prevMouse.x) * 0.012; // horizontal drag
  rotX += (e.clientY - prevMouse.y) * 0.008; // vertical drag
  rotX = Math.max(0.1, Math.min(0.8, rotX)); // so you cant flip upside down
  prevMouse = { x: e.clientX, y: e.clientY };
});

renderer.domElement.addEventListener("mouseup", () => {
  isDragging = false;
});
renderer.domElement.addEventListener("mouseleave", () => {
  isDragging = false;
});

// touch
let lastPinchDist = null;
renderer.domElement.addEventListener(
  "touchstart",
  (e) => {
    // Prevent default browser behavior (scrolling/native zoom)
    if (e.cancelable) e.preventDefault();

    if (e.touches.length === 1) {
      isDragging = true;
      prevMouse = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    } else if (e.touches.length === 2) {
      isDragging = false; // Stop rotating while pinching
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      lastPinchDist = Math.sqrt(dx * dx + dy * dy);
    }
  },
  { passive: false },
); // Must be false to allow preventDefault()

renderer.domElement.addEventListener(
  "touchmove",
  (e) => {
    if (e.cancelable) e.preventDefault();

    if (e.touches.length === 2) {
      // Handle Pinch Zoom
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (lastPinchDist !== null) {
        // Sensitivity factor (0.05 - 0.1 usually feels good)
        const delta = dist - lastPinchDist;
        cameraRadius -= delta * 0.1;
        cameraRadius = Math.max(MIN_RADIUS, Math.min(MAX_RADIUS, cameraRadius));
      }
      lastPinchDist = dist;
    } else if (e.touches.length === 1 && isDragging) {
      // Handle Rotation
      rotY += (e.touches[0].clientX - prevMouse.x) * 0.012;
      rotX += (e.touches[0].clientY - prevMouse.y) * 0.008;
      rotX = Math.max(0.1, Math.min(0.8, rotX));
      prevMouse = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }
  },
  { passive: false },
);

renderer.domElement.addEventListener("touchend", () => {
  isDragging = false;
  lastPinchDist = null;
});

// button handlers
// auto spin
document.getElementById("btnSpin").addEventListener("click", () => {
  autoSpin = !autoSpin;
  document.getElementById("btnSpin").textContent = autoSpin
    ? "[ stop ]"
    : "[ spin ]";
});

// cycle through colors
document.getElementById("btnColor").addEventListener("click", () => {
  colorMode = (colorMode + 1) % 3;
  const labels = ["[ red ]", "[ blue ]", "[ mixed ]"];
  document.getElementById("btnColor").textContent = labels[colorMode];
  Object.keys(textureCache).forEach((k) => {
    textureCache[k].dispose();
    delete textureCache[k];
  });
  buildSprites();
});

renderer.domElement.addEventListener("wheel", (e) => {
  cameraRadius += e.deltaY * 0.05;
  cameraRadius = Math.max(MIN_RADIUS, Math.min(MAX_RADIUS, cameraRadius));
});

// resize
window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

function updateCamera() {
  // spherical coordinates to cartesian
  const cx = Math.sin(rotY) * Math.cos(rotX) * cameraRadius;
  const cy = Math.sin(rotX) * cameraRadius + cameraTargetY;
  const cz = Math.cos(rotY) * Math.cos(rotX) * cameraRadius;

  camera.position.set(cx, cy, cz);
  camera.lookAt(0, 1, 0);
}

// animation loop
let time = 0;

function animate() {
  requestAnimationFrame(animate); // schedule the next frame
  time += 0.012;

  if (autoSpin) rotY += 0.0025;

  spriteData.forEach((d, i) => {
    const { sprite, basePos, type } = d;

    // for sway (breathing sort of effect)
    // const swayScale =
    //   type === "flower"
    //     ? 0.08
    //     : type === "leaf"
    //       ? 0.06
    //       : type === "soil"
    //         ? 0.0
    //         : 0.03;

    // // each sprite gets a different frequency
    // const freq = 0.7 + (i % 5) * 0.1;

    // const px = basePos.x + Math.sin(time * freq + i * 0.3) * swayScale;
    // const pz = basePos.z + Math.cos(time * freq * 0.8 + i * 0.2) * swayScale;
    // const py = basePos.y;

    const px = basePos.x;
    const py = basePos.y;
    const pz = basePos.z;

    sprite.position.set(px, py, pz);
  });

  updateCamera();
  renderer.render(scene, camera);
}

animate();
