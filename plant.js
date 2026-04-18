// setup and declarations
const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(
  60,
  window.innerWidth / window.innerHeight,
  0.1,
  1000,
);
camera.position.set(0, 8, 22);
camera.lookAt(0, 6, 0);

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
document.body.appendChild(renderer.domElement);

let autoSpin = true;
let colorMode = 0;
let growFactor = 1.0;
let targetGrow = 1.0;

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

// plant structure and definitions
const CHARS = {
  stem: ["|", "¦", "I", "║"],
  leaf: ["*", "~", "§", "≈", "ʷ", "∿", "❧"],
  flower: ["✿", "❀", "@", "%", "&", "#", "✾"],
  branch: ["/", "\\", "─", "┐", "┘", "╱", "╲"],
  soil: ["_", ".", ",", "`", "~", "░", "▒"],
};

function pickChar(type) {
  const arr = CHARS[type];
  return arr[Math.floor(Math.random() * arr.length)];
}

function buildPlant() {
  const points = [];

  // soil
  for (let x = -5; x <= 5; x += 0.7) {
    for (let z = -5; z <= 5; z += 0.7) {
      const dist = Math.sqrt(x * x + z * z);
      // only inside a circle radius 4.5
      if (dist < 4.5) {
        points.push({
          char: pickChar("soil"),
          x: x + (Math.random() - 0.5) * 0.3,
          y: -0.3 + Math.random() * 0.2,
          z: z + (Math.random() - 0.5) * 0.3,
          type: "soil",
        });
      }
    }
  }

  // main stem: vertical column
  for (let h = 0; h <= 12; h += 0.55) {
    const sway = Math.sin(h * 0.4) * 0.15;
    points.push({
      char: pickChar("stem"),
      x: sway,
      y: h,
      z: 0,
      type: "stem",
    });
    points.push({
      char: pickChar("stem"),
      x: sway,
      y: h,
      z: 0.3,
      type: "stem",
    });
    points.push({
      char: pickChar("stem"),
      x: sway,
      y: h,
      z: -0.3,
      type: "stem",
    });
  }

  // branches (starting height, directionm length, upward slope)
  const branchDefs = [
    { startH: 2.5, dir: 1, len: 3.5, slope: 1.2 },
    { startH: 2.5, dir: -1, len: 3.5, slope: 1.2 },
    { startH: 5.0, dir: 1, len: 4.0, slope: 1.0 },
    { startH: 5.0, dir: -1, len: 4.0, slope: 1.0 },
    { startH: 7.5, dir: 1, len: 3.0, slope: 0.8 },
    { startH: 7.5, dir: -1, len: 3.0, slope: 0.8 },
    { startH: 9.5, dir: 1, len: 2.0, slope: 0.6 },
    { startH: 9.5, dir: -1, len: 2.0, slope: 0.6 },
  ];

  for (const b of branchDefs) {
    const steps = Math.floor(b.len / 0.5); // double the length of the branch in units

    for (let s = 0; s <= steps; s++) {
      const t = s / steps; // normalized step in steps
      const bx = b.dir * t * b.len; // x position
      const by = b.startH + t * b.slope; // y position

      for (let dz = -0.5; dz <= 0.5; dz += 0.5) {
        points.push({
          // First character is a '/' or '\' junction, rest are generic branch chars
          char: s === 0 ? (b.dir > 0 ? "/" : "\\") : pickChar("branch"),
          x: bx,
          y: by,
          z: dz,
          type: "branch",
        });
      }

      // leaf clusters : arranged in a circular fan around each branch point
      if (s > 0) {
        for (let li = 0; li < 3; li++) {
          const angle = (li / 3) * Math.PI * 2; // 0, 120, 240 degrees
          const r = 0.6 + Math.random() * 0.5;
          points.push({
            char: pickChar("leaf"),
            x: bx + Math.cos(angle) * r,
            y: by + (Math.random() - 0.5) * 0.4,
            z: Math.sin(angle) * r,
            type: "leaf",
          });
        }
      }
    }
  }

  // flowers at tht top: arranged in a ring + center cluster
  const flowerH = 12.5;
  for (let a = 0; a < Math.PI * 2; a += 0.35) {
    const r = 0.5 + Math.random() * 0.8;
    points.push({
      char: pickChar("flower"),
      x: Math.cos(a) * r,
      y: flowerH + Math.random() * 0.8,
      z: Math.sin(a) * r,
      type: "flower",
    });
  }

  for (let i = 0; i < 8; i++) {
    points.push({
      char: pickChar("flower"),
      x: (Math.random() - 0.5) * 0.6,
      y: flowerH + 0.5 + Math.random() * 0.5,
      z: (Math.random() - 0.5) * 0.6,
      type: "flower",
    });
  }

  return points;
}

// colors
const COLORS = {
  green: {
    stem: "#4a9e5c",
    leaf: "#3dcc6a",
    flower: "#ffd166",
    branch: "#6b7c3a",
    soil: "#5c4033",
  },
  amber: {
    stem: "#a07840",
    leaf: "#d4a853",
    flower: "#e8d4a0",
    branch: "#7a5c30",
    soil: "#3a2a20",
  },
};

function getColor(type, index, mode) {
  // for rainbow mode
  if (mode === 1) {
    const hue = (index * 137.5) % 360;
    return `hsl(${hue}, 90%, 65%)`;
  }
  const scheme = mode === 2 ? COLORS.amber : COLORS.green;
  return scheme[type] || "#88ff88";
}

function buildSprites() {
  const points = buildPlant();

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
    const tex = makeCharTexture(p.char, color);

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
  rotX = Math.max(-0.8, Math.min(0.8, rotX)); // clamp so you cant flip upside down
  prevMouse = { x: e.clientX, y: e.clientY };
  autoSpin = false;
  document.getElementById("btnSpin").textContent = "[ auto-spin ]";
});

renderer.domElement.addEventListener("mouseup", () => {
  isDragging = false;
});
renderer.domElement.addEventListener("mouseleave", () => {
  isDragging = false;
});

// touch
renderer.domElement.addEventListener(
  "touchstart",
  (e) => {
    isDragging = true;
    prevMouse = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  },
  { passive: true },
);

renderer.domElement.addEventListener("touchmove", (e) => {
  if (!isDragging) return;
  rotY += (e.touches[0].clientX - prevMouse.x) * 0.012; // horizontal drag
  rotX += (e.touches[0].clientY - prevMouse.y) * 0.008; // vertical drag
  rotX = Math.max(-0.8, Math.min(0.8, rotX)); // clamp so you cant flip upside down
  prevMouse = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  autoSpin = false;
  document.getElementById("btnSpin").textContent = "[auto-spin]";
});

renderer.domElement.addEventListener("touchend", () => {
  isDragging = false;
});

// button handlers
// auto spin
document.getElementById("btnSpin").addEventListener("click", () => {
  autoSpin = !autoSpin;
  document.getElementById("btnSpin").textContent = autoSpin
    ? "[ stop spin ]"
    : "[ auto-spin ]";
});

// cycle through colors
document.getElementById("btnColor").addEventListener("click", () => {
  colorMode = (colorMode + 1) % 3;
  const labels = ["[ color mode ]", "[ rainbow ]", "[ amber ]"];
  document.getElementById("btnColor").textContent = labels[colorMode];
  // clear the color chache since colors have changed
  Object.keys(textureCache).forEach((k) => {
    textureCache[k].dispose();
    delete textureCache[k];
  });
  buildSprites();
});

// grow button
document.getElementById("btnGrow").addEventListener("click", () => {
  targetGrow = targetGrow < 1.5 ? 1.5 : 1.0;
  document.getElementById("btnGrow").textContent =
    targetGrow > 1 ? "[ shrink ]" : "[ grow ]";
});

// resize
window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// camera orbit
//  this function converts (rotX, rotY) angles into a camera position on a sphere.
//  the camera always looks at the center of the plant
function updateCamera() {
  const radius = 22;

  // spherical coordinates to cartesian
  const cx = Math.sin(rotY) * Math.cos(rotX) * radius;
  const cy = Math.sin(rotX) * radius + 6;
  const cz = Math.cos(rotY) * Math.cos(rotX) * radius;

  camera.position.set(cx, cy, cz);
  camera.lookAt(0, 6, 0);
}

// animation loop
let time = 0;

function animate() {
  requestAnimationFrame(animate); // schedule the next frame
  time += 0.012;

  if (autoSpin) rotY += 0.007;

  // smoothly change the grow factor
  growFactor += (targetGrow - growFactor) * 0.04;

  spriteData.forEach((d, i) => {
    const { sprite, basePos, type } = d;

    const swayScale =
      type === "flower"
        ? 0.08
        : type === "leaf"
          ? 0.06
          : type === "soil"
            ? 0.0
            : 0.03;

    // each sprite gets a different frequency
    const freq = 0.7 + (i % 5) * 0.1;

    const px = basePos.x + Math.sin(time * freq + i * 0.3) * swayScale;
    const pz = basePos.z + Math.cos(time * freq * 0.8 + i * 0.2) * swayScale;

    const py = basePos.y * growFactor;

    sprite.position.set(px, py, pz);
  });

  updateCamera();
  renderer.render(scene, camera);
}

animate();
