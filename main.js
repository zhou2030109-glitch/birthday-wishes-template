import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

/* ---------- DOM ---------- */
const loader      = document.getElementById('loader');
const loaderBar   = document.getElementById('loaderBar');
const enterBtn    = document.getElementById('enterBtn');
const stageEl     = document.getElementById('stage');
const canvasEl    = document.getElementById('scene');
const stagesNav   = document.getElementById('stages');
const captionEl   = document.getElementById('caption');
const capIndex    = document.getElementById('capIndex');
const capTitle    = document.getElementById('capTitle');
const capDesc     = document.getElementById('capDesc');
const scrollHint  = document.getElementById('scrollHint');
const blowEl      = document.getElementById('blow');
const blowFill    = document.getElementById('blowFill');
const finaleEl    = document.getElementById('finale');
const replayBtn   = document.getElementById('replayBtn');
const wishEl      = document.getElementById('wish');
const audioBtn    = document.getElementById('audioToggle');
const audioWave   = document.getElementById('audioWave');
const bgm         = document.getElementById('bgm');
const todayDate   = document.getElementById('todayDate');

/* ---------- Header display text ---------- */
todayDate.textContent = '{{BIRTHDAY_DATE}} · {{RECIPIENT_NAME}}';

/* ============================================================
   STAGES — narrative spine
   ============================================================ */
const STAGES = [
  { key: 'dark',     title: '灯光暗下',       desc: '向下滚动开始' },
  { key: 'plate',    title: '摆上托盘',       desc: '舞台就位' },
  { key: 'cake1',    title: '第一层蛋糕',     desc: '松软海绵' },
  { key: 'cake2',    title: '第二层蛋糕',     desc: '继续向上' },
  { key: 'cake3',    title: '顶层蛋糕',       desc: '稳稳叠好' },
  { key: 'cream',    title: '挤上奶油',       desc: '一圈圈装饰' },
  { key: 'cherries', title: '点缀樱桃',       desc: '红配白' },
  { key: 'candles',  title: '插上蜡烛',       desc: '就差点火' },
  { key: 'flames',   title: '点燃蜡烛',       desc: '按住鼠标吹灭' }
];
const LAST = STAGES.length - 1;

let current = 0;
let cooldown = 0;
let finaleShown = false;

/* Build left-side indicator dots */
STAGES.forEach((s, i) => {
  const dot = document.createElement('button');
  dot.className = 'stages__dot';
  dot.dataset.label = s.key;
  dot.setAttribute('aria-label', s.title);
  dot.addEventListener('click', () => goTo(i));
  stagesNav.appendChild(dot);
});
const dotEls = Array.from(stagesNav.querySelectorAll('.stages__dot'));

function refreshUI() {
  dotEls.forEach((el, i) => {
    el.classList.toggle('is-active', i === current);
    el.classList.toggle('is-passed', i < current);
  });
  const s = STAGES[current];
  capIndex.textContent = String(current).padStart(2, '0');
  capTitle.textContent = s.title;
  capDesc.textContent  = s.desc;
  captionEl.classList.remove('is-swap');
  void captionEl.offsetWidth;
  captionEl.classList.add('is-swap');

  if (current === LAST) {
    document.body.classList.add('is-blow-stage');
    scrollHint.classList.add('is-end');
    blowEl.classList.add('is-show');
  } else {
    document.body.classList.remove('is-blow-stage');
    scrollHint.classList.remove('is-end');
    blowEl.classList.remove('is-show');
    if (finaleShown && current < LAST) hideFinale();
  }
}

function goTo(i) {
  i = Math.max(0, Math.min(LAST, i));
  if (i === current) return;
  current = i;
  refreshUI();
}
function advance(dir = 1) {
  if (cooldown > 0) return;
  cooldown = 0.45;
  goTo(current + dir);
}

/* ---------- Loader ---------- */
let progress = 0;
const loaderTimer = setInterval(() => {
  progress = Math.min(100, progress + Math.random() * 14 + 4);
  loaderBar.style.width = progress + '%';
  if (progress >= 100) {
    clearInterval(loaderTimer);
    setTimeout(() => loader.classList.add('is-ready'), 250);
  }
}, 120);

enterBtn.addEventListener('click', (e) => {
  e.preventDefault();
  if (!loader.classList.contains('is-ready')) return;
  loader.classList.add('is-done');
  stageEl.classList.add('is-on');
  refreshUI();
});

/* ============================================================
   THREE.JS
   ============================================================ */
const renderer = new THREE.WebGLRenderer({ canvas: canvasEl, antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0xa9d3ec, 0.035);

const camera = new THREE.PerspectiveCamera(36, window.innerWidth / window.innerHeight, 0.1, 200);
camera.position.set(0, 2.9, 6.5);
camera.lookAt(0, 0.5, 0);

/* PMREM environment for reflections */
const pmrem = new THREE.PMREMGenerator(renderer);
pmrem.compileEquirectangularShader();
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

/* Backdrop sphere */
scene.add(new THREE.Mesh(
  new THREE.SphereGeometry(60, 32, 32),
  new THREE.ShaderMaterial({
    side: THREE.BackSide,
    vertexShader: `varying vec3 vPos; void main(){ vPos = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `
      varying vec3 vPos;
      void main(){
        vec3 n = normalize(vPos);
        float h = n.y * 0.5 + 0.5;
        float r = length(n.xy);
        vec3 top = vec3(0.46, 0.72, 0.90);
        vec3 bot = vec3(0.78, 0.90, 0.97);
        vec3 col = mix(bot, top, h);
        float glow = exp(-r * 2.4) * 0.12;
        col += vec3(glow * 1.0, glow * 0.95, glow * 0.75);
        gl_FragColor = vec4(col, 1.0);
      }
    `
  })
));

/* Table (subtle disk under everything) */
const table = new THREE.Mesh(
  new THREE.CircleGeometry(6, 64),
  new THREE.MeshStandardMaterial({ color: 0xb4bcc6, roughness: 0.78, metalness: 0.05 })
);
table.rotation.x = -Math.PI / 2;
table.position.y = 0;
scene.add(table);

/* Lights */
const ambient = new THREE.AmbientLight(0xffffff, 0.25);
scene.add(ambient);

const keyLight = new THREE.DirectionalLight(0xffffff, 0.65);
keyLight.position.set(2.4, 4, 2.5);
scene.add(keyLight);

const rimLight = new THREE.DirectionalLight(0x8aa0c0, 0.35);
rimLight.position.set(-2.5, 2, -2);
scene.add(rimLight);

/* Flame pool light — lit only when candles ignite */
const flameLight = new THREE.PointLight(0xffb56b, 0, 6, 1.6);
flameLight.position.set(0, 1.9, 0);
scene.add(flameLight);

/* ============================================================
   CAKE — built from primitives, all original
   ============================================================ */
const cakeGroup = new THREE.Group();
scene.add(cakeGroup);

/* materials */
const matPlate = new THREE.MeshPhysicalMaterial({
  color: 0xc8c8d2, metalness: 1.0, roughness: 0.22, clearcoat: 1.0
});
const matSponge = new THREE.MeshStandardMaterial({
  color: 0xecdfc8, roughness: 0.92, metalness: 0.0
});
const matSpongeMid = new THREE.MeshStandardMaterial({
  color: 0x6b3a26, roughness: 0.78, metalness: 0.0  // chocolate filling band
});
const matCream = new THREE.MeshStandardMaterial({
  color: 0xfdf4e0, roughness: 0.85, metalness: 0.0
});
const matCherry = new THREE.MeshPhysicalMaterial({
  color: 0x9a1818, roughness: 0.28, metalness: 0.0,
  clearcoat: 1.0, clearcoatRoughness: 0.10
});
const matCandle = new THREE.MeshPhysicalMaterial({
  color: 0xd9b063, metalness: 1.0, roughness: 0.30, clearcoat: 0.8
});
const matWick = new THREE.MeshBasicMaterial({ color: 0x111111 });

/* PLATE */
const plate = new THREE.Mesh(
  new THREE.CylinderGeometry(1.45, 1.55, 0.08, 80),
  matPlate
);
plate.position.y = 0.04;
cakeGroup.add(plate);

/* CAKE LAYERS — each with a thin filling band */
function makeLayer(rTop, rBot, h, yBase) {
  const g = new THREE.Group();
  const cyl = new THREE.Mesh(
    new THREE.CylinderGeometry(rTop, rBot, h, 64),
    matSponge
  );
  cyl.position.y = h / 2;
  g.add(cyl);
  // filling band near top
  const band = new THREE.Mesh(
    new THREE.CylinderGeometry(rTop * 1.002, rBot * 1.002, h * 0.16, 64),
    matSpongeMid
  );
  band.position.y = h * 0.62;
  g.add(band);
  g.position.y = yBase;
  return g;
}

const layer1 = makeLayer(1.10, 1.15, 0.58, 0.08);   // sits on plate
const layer2 = makeLayer(0.82, 0.86, 0.46, 0.08 + 0.58);
const layer3 = makeLayer(0.54, 0.58, 0.38, 0.08 + 0.58 + 0.46);
cakeGroup.add(layer1, layer2, layer3);
const topY = 0.08 + 0.58 + 0.46 + 0.38; // top surface y

/* CREAM — instanced piped dollops around each layer's top edge */
function makeCreamRing(radius, count, y) {
  const dollop = new THREE.SphereGeometry(0.07, 16, 12);
  const inst = new THREE.InstancedMesh(dollop, matCream, count);
  const m = new THREE.Matrix4();
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2;
    const x = Math.cos(a) * radius;
    const z = Math.sin(a) * radius;
    m.makeScale(1, 0.78, 1);
    m.setPosition(x, y, z);
    inst.setMatrixAt(i, m);
  }
  inst.instanceMatrix.needsUpdate = true;
  return inst;
}
const cream1 = makeCreamRing(1.10, 28, 0.08 + 0.58);
const cream2 = makeCreamRing(0.82, 22, 0.08 + 0.58 + 0.46);
const cream3 = makeCreamRing(0.54, 16, topY);
const creamGroup = new THREE.Group();
creamGroup.add(cream1, cream2, cream3);
cakeGroup.add(creamGroup);

/* CHERRIES — small + one larger on top */
const cherryGeo = new THREE.SphereGeometry(0.075, 20, 16);
const cherryBigGeo = new THREE.SphereGeometry(0.11, 24, 18);
const cherryGroup = new THREE.Group();
function placeCherry(r, y, count, geo = cherryGeo) {
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2 + Math.PI / count;
    const m = new THREE.Mesh(geo, matCherry);
    m.position.set(Math.cos(a) * r, y, Math.sin(a) * r);
    cherryGroup.add(m);
  }
}
placeCherry(0.86, 0.08 + 0.58 + 0.10, 7);
placeCherry(0.60, 0.08 + 0.58 + 0.46 + 0.10, 5);
const topCherry = new THREE.Mesh(cherryBigGeo, matCherry);
topCherry.position.set(0, topY + 0.13, 0);
cherryGroup.add(topCherry);
cakeGroup.add(cherryGroup);

/* CANDLES — 5 slim gold candles on top tier */
const candleGroup = new THREE.Group();
const candleH = 0.34;
const flames = [];
const candlePositions = [];
const CANDLES = 5;
for (let i = 0; i < CANDLES; i++) {
  const a = (i / CANDLES) * Math.PI * 2 + Math.PI / 10;
  const x = Math.cos(a) * 0.30;
  const z = Math.sin(a) * 0.30;

  const c = new THREE.Mesh(
    new THREE.CylinderGeometry(0.028, 0.028, candleH, 20),
    matCandle
  );
  c.position.set(x, topY + candleH / 2, z);
  candleGroup.add(c);

  const wick = new THREE.Mesh(
    new THREE.CylinderGeometry(0.008, 0.008, 0.05, 8),
    matWick
  );
  wick.position.set(x, topY + candleH + 0.025, z);
  candleGroup.add(wick);

  candlePositions.push(new THREE.Vector3(x, topY + candleH + 0.07, z));
}
cakeGroup.add(candleGroup);

/* FLAMES — per-candle material (独立 uniforms：随机相位 + 独立 alive) */
const flameGeo = new THREE.ConeGeometry(0.05, 0.17, 16, 1, true);
const FLAME_VERT = /* glsl */`
  uniform float uTime;
  uniform float uAlive;
  uniform float uSway;
  uniform float uPhase;
  varying vec2 vUv;
  varying float vH;
  void main(){
    vec3 p = position;
    vH = (p.y + 0.085) / 0.17;
    float tt = uTime + uPhase;
    // 加大基础摇曳幅度，让点燃时也明显抖动
    float s = sin(tt * 6.5 + p.x * 4.0) * 0.022 * vH;
    float wob = cos(tt * 8.5) * 0.014 * vH;
    float w = (sin(tt * 4.0) * 0.5 + cos(tt * 7.0) * 0.4) * uSway * vH * 0.22;
    p.x += s + w;
    p.z += cos(tt * 5.5 + p.z * 3.0) * 0.018 * vH + wob;
    float k = mix(0.0, 1.0, uAlive);
    p.xz *= k;
    p.y  = mix(-0.085, p.y, k);
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }
`;
const FLAME_FRAG = /* glsl */`
  varying vec2 vUv;
  varying float vH;
  void main(){
    float edge = abs(vUv.x - 0.5) * 2.0;
    float soft = smoothstep(1.0, 0.3, edge);
    float tip  = smoothstep(0.98, 0.55, vH);
    float bot  = smoothstep(0.0, 0.18, vH);
    float a = soft * tip * bot;
    vec3 base = vec3(0.92, 0.18, 0.05);
    vec3 mid  = vec3(1.00, 0.55, 0.10);
    vec3 top  = vec3(1.00, 0.95, 0.78);
    vec3 col = mix(base, mid, smoothstep(0.0, 0.55, vH));
    col      = mix(col,  top, smoothstep(0.60, 1.0, vH));
    gl_FragColor = vec4(col, a * 0.95);
  }
`;
function makeFlameMaterial(phase){
  return new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    uniforms: {
      uTime:  { value: 0 },
      uAlive: { value: 0 },
      uSway:  { value: 0 },
      uPhase: { value: phase }
    },
    vertexShader: FLAME_VERT,
    fragmentShader: FLAME_FRAG
  });
}
const flameMats = [];
candlePositions.forEach((p, i) => {
  const mat = makeFlameMaterial(i * 1.73 + Math.random() * 0.6);
  const f = new THREE.Mesh(flameGeo, mat);
  f.position.copy(p);
  f.renderOrder = 5;
  cakeGroup.add(f);
  flames.push(f);
  flameMats.push(mat);
});


/* ============================================================
   REVEAL SYSTEM — per-object progress 0..1 driven by current stage
   Each entry maps to a stage index it appears at.
   ============================================================ */
const revealItems = [
  { stage: 1, obj: plate,        baseY: 0.04,                yFrom: -1.0 },
  { stage: 2, obj: layer1,       baseY: 0.08,                yFrom: 4.0 },
  { stage: 3, obj: layer2,       baseY: 0.08 + 0.58,         yFrom: 4.0 },
  { stage: 4, obj: layer3,       baseY: 0.08 + 0.58 + 0.46,  yFrom: 4.0 },
  { stage: 5, obj: creamGroup,   baseY: 0,                   yFrom: 0,  scaleFrom: 0.001 },
  { stage: 6, obj: cherryGroup,  baseY: 0,                   yFrom: 2.0 },
  { stage: 7, obj: candleGroup,  baseY: 0,                   yFrom: 0,  scaleFrom: 0.001 },
];
// initial state: everything hidden (scale 0 or pushed offscreen)
revealItems.forEach((it) => {
  it.progress = 0;
  if (it.scaleFrom !== undefined) {
    it.obj.scale.setScalar(it.scaleFrom);
  } else {
    it.obj.position.y = it.baseY + it.yFrom;
    it.obj.scale.setScalar(0.001);
  }
});
flames.forEach(f => f.scale.setScalar(0.001));

function easeOutBack(x) {
  const c1 = 1.70158, c3 = c1 + 1;
  return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
}
function easeOutCubic(x) { return 1 - Math.pow(1 - x, 3); }

/* ============================================================
   INTERACTION — wheel / keyboard / touch advance
   ============================================================ */
let wheelAccum = 0;
window.addEventListener('wheel', (e) => {
  if (!stageEl.classList.contains('is-on')) return;
  if (finaleShown) return;
  e.preventDefault();
  wheelAccum += e.deltaY;
  if (wheelAccum > 80)  { advance(+1); wheelAccum = 0; }
  if (wheelAccum < -80) { advance(-1); wheelAccum = 0; }
}, { passive: false });

window.addEventListener('keydown', (e) => {
  if (!stageEl.classList.contains('is-on')) return;
  if (finaleShown && e.key !== 'Escape') return;
  if (['ArrowDown','PageDown',' ','Spacebar'].includes(e.key)) { e.preventDefault(); advance(+1); }
  if (['ArrowUp','PageUp'].includes(e.key))                    { e.preventDefault(); advance(-1); }
  if (e.key === 'Escape' && finaleShown)                       { resetAll(); }
});

let touchStartY = null;
window.addEventListener('touchstart', (e) => {
  if (e.touches[0]) touchStartY = e.touches[0].clientY;
}, { passive: true });
window.addEventListener('touchmove', (e) => {
  if (touchStartY === null || !e.touches[0]) return;
  const dy = touchStartY - e.touches[0].clientY;
  if (Math.abs(dy) > 50) {
    advance(dy > 0 ? +1 : -1);
    touchStartY = e.touches[0].clientY;
  }
}, { passive: true });
window.addEventListener('touchend', () => { touchStartY = null; });

/* ============================================================
   BLOW — hold mouse to extinguish flames
   ============================================================ */
let blowing = false;
let blowHold = 0;                  // seconds held
const BLOW_NEEDED = 1.6;

canvasEl.addEventListener('mousedown', (e) => {
  if (current !== LAST || finaleShown) return;
  blowing = true;
});
window.addEventListener('mouseup', () => { blowing = false; });
canvasEl.addEventListener('touchstart', (e) => {
  if (current !== LAST || finaleShown) return;
  blowing = true;
}, { passive: true });
window.addEventListener('touchend', () => { blowing = false; });

const flameAlives        = candlePositions.map(() => 1.0);   // smoothed per candle
const flameAliveTargets  = candlePositions.map(() => 1.0);
const flameExtinguished  = candlePositions.map(() => false); // 防止重复发射火星

function triggerFinale() {
  finaleShown = true;
  document.body.classList.add('is-finale');
  blowEl.classList.remove('is-show');
  emitBurst(new THREE.Vector3(0, topY + 0.4, 0));
  playChimeTriad();
  showWish();
  setTimeout(hideWish, 2400);
  setTimeout(() => finaleEl.classList.add('is-show'), 1800);
}
function hideFinale() {
  finaleShown = false;
  document.body.classList.remove('is-finale');
  finaleEl.classList.remove('is-show');
}
function showWish(){ wishEl?.classList.add('is-show'); }
function hideWish(){ wishEl?.classList.remove('is-show'); }
function resetAll() {
  hideFinale();
  hideWish();
  for (let i = 0; i < flameAliveTargets.length; i++) {
    flameAliveTargets[i] = 1.0;
    flameExtinguished[i] = false;
  }
  blowHold = 0;
  blowFill.style.strokeDashoffset = 289;
  goTo(0);
}
replayBtn.addEventListener('click', resetAll);

/* ============================================================
   BURST PARTICLES (gold sparks) + WISP (smoke)
   ============================================================ */
const BURST_MAX = 220;
const bPos  = new Float32Array(BURST_MAX * 3);
const bVel  = new Float32Array(BURST_MAX * 3);
const bLife = new Float32Array(BURST_MAX);
const bMax  = new Float32Array(BURST_MAX);
const bGeo  = new THREE.BufferGeometry();
bGeo.setAttribute('position', new THREE.BufferAttribute(bPos, 3));
const bLifeAttr = new THREE.BufferAttribute(new Float32Array(BURST_MAX), 1);
const bMaxAttr  = new THREE.BufferAttribute(new Float32Array(BURST_MAX), 1);
bGeo.setAttribute('life', bLifeAttr);
bGeo.setAttribute('lmax', bMaxAttr);
const bMat = new THREE.ShaderMaterial({
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  uniforms: { uPixelR: { value: renderer.getPixelRatio() } },
  vertexShader: `
    attribute float life; attribute float lmax;
    uniform float uPixelR;
    varying float vA;
    void main(){
      vec4 mv = modelViewMatrix * vec4(position,1.0);
      gl_Position = projectionMatrix * mv;
      float dist = -mv.z;
      float t = clamp(life / max(lmax, 0.001), 0.0, 1.0);
      gl_PointSize = (1.0 + t * 3.2) * uPixelR * (80.0 / dist);
      vA = t;
    }
  `,
  fragmentShader: `
    varying float vA;
    void main(){
      vec2 c = gl_PointCoord - 0.5;
      float d = length(c);
      if (d > 0.5) discard;
      float soft = smoothstep(0.5, 0.0, d);
      vec3 gold = vec3(1.0, 0.78, 0.32);
      vec3 hot  = vec3(1.0, 0.95, 0.78);
      vec3 col  = mix(gold, hot, vA);
      gl_FragColor = vec4(col, soft * vA * 0.9);
    }
  `
});
scene.add(new THREE.Points(bGeo, bMat));

function emitBurst(origin) {
  let emitted = 0;
  for (let i = 0; i < BURST_MAX && emitted < 180; i++) {
    if (bLife[i] > 0) continue;
    bPos[i*3+0] = origin.x + (Math.random() - 0.5) * 0.1;
    bPos[i*3+1] = origin.y + (Math.random() - 0.5) * 0.1;
    bPos[i*3+2] = origin.z + (Math.random() - 0.5) * 0.1;
    const theta = Math.random() * Math.PI * 2;
    const phi   = Math.acos(2 * Math.random() - 1);
    const speed = 1.0 + Math.random() * 2.5;
    bVel[i*3+0] = Math.sin(phi) * Math.cos(theta) * speed;
    bVel[i*3+1] = Math.cos(phi) * speed * 0.5 + 0.8;
    bVel[i*3+2] = Math.sin(phi) * Math.sin(theta) * speed;
    const L = 1.2 + Math.random() * 1.4;
    bLife[i] = L;
    bMax[i]  = L;
    emitted++;
  }
}

/* Smoke wisps (separate pool, NormalBlending, soft gray) */
const SMOKE_MAX = 60;
const sPos = new Float32Array(SMOKE_MAX * 3);
const sVel = new Float32Array(SMOKE_MAX * 3);
const sLife = new Float32Array(SMOKE_MAX);
const sMax  = new Float32Array(SMOKE_MAX);
const sGeo  = new THREE.BufferGeometry();
sGeo.setAttribute('position', new THREE.BufferAttribute(sPos, 3));
const sLifeAttr = new THREE.BufferAttribute(new Float32Array(SMOKE_MAX), 1);
const sMaxAttr  = new THREE.BufferAttribute(new Float32Array(SMOKE_MAX), 1);
sGeo.setAttribute('life', sLifeAttr);
sGeo.setAttribute('lmax', sMaxAttr);
const sMat = new THREE.ShaderMaterial({
  transparent: true, depthWrite: false, blending: THREE.NormalBlending,
  uniforms: { uPixelR: { value: renderer.getPixelRatio() } },
  vertexShader: `
    attribute float life; attribute float lmax;
    uniform float uPixelR;
    varying float vA;
    void main(){
      vec4 mv = modelViewMatrix * vec4(position,1.0);
      gl_Position = projectionMatrix * mv;
      float dist = -mv.z;
      float t = clamp(life / max(lmax, 0.001), 0.0, 1.0);
      gl_PointSize = (10.0 + (1.0 - t) * 24.0) * uPixelR * (60.0 / dist);
      vA = t;
    }
  `,
  fragmentShader: `
    varying float vA;
    void main(){
      vec2 c = gl_PointCoord - 0.5;
      float d = length(c);
      if (d > 0.5) discard;
      float soft = smoothstep(0.5, 0.0, d);
      gl_FragColor = vec4(vec3(0.65,0.64,0.66), soft * vA * 0.22);
    }
  `
});
scene.add(new THREE.Points(sGeo, sMat));

function spawnSmokeAt(p) {
  for (let i = 0; i < SMOKE_MAX; i++) {
    if (sLife[i] > 0) continue;
    sPos[i*3+0] = p.x + (Math.random() - 0.5) * 0.04;
    sPos[i*3+1] = p.y;
    sPos[i*3+2] = p.z + (Math.random() - 0.5) * 0.04;
    sVel[i*3+0] = (Math.random() - 0.5) * 0.15;
    sVel[i*3+1] = 0.4 + Math.random() * 0.3;
    sVel[i*3+2] = (Math.random() - 0.5) * 0.15;
    const L = 1.8 + Math.random() * 1.0;
    sLife[i] = L; sMax[i] = L;
    return;
  }
}

/* ============================================================
   AMBIENT STARLIGHT — 漂浮粒子（纯 shader，无 CPU 更新开销）
   ============================================================ */
const STAR_COUNT = 220;
const starPos    = new Float32Array(STAR_COUNT * 3);
const starPhase  = new Float32Array(STAR_COUNT);
const starSize   = new Float32Array(STAR_COUNT);
for (let i = 0; i < STAR_COUNT; i++) {
  const r = 5.5 + Math.random() * 9;
  const theta = Math.random() * Math.PI * 2;
  starPos[i*3+0] = Math.cos(theta) * r;
  starPos[i*3+1] = (Math.random() - 0.4) * 12;
  starPos[i*3+2] = Math.sin(theta) * r - 1;
  starPhase[i]   = Math.random() * Math.PI * 2;
  starSize[i]    = 0.6 + Math.random() * 1.6;
}
const starGeo = new THREE.BufferGeometry();
starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
starGeo.setAttribute('aPhase',   new THREE.BufferAttribute(starPhase, 1));
starGeo.setAttribute('aSize',    new THREE.BufferAttribute(starSize, 1));
const starMat = new THREE.ShaderMaterial({
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  uniforms: { uTime: { value: 0 }, uPixelR: { value: renderer.getPixelRatio() } },
  vertexShader: `
    attribute float aPhase;
    attribute float aSize;
    uniform float uTime;
    uniform float uPixelR;
    varying float vA;
    void main(){
      vec3 p = position;
      p.y += sin(uTime * 0.18 + aPhase) * 0.8;
      p.x += sin(uTime * 0.12 + aPhase * 1.7) * 0.5;
      p.z += cos(uTime * 0.14 + aPhase * 1.3) * 0.5;
      vec4 mv = modelViewMatrix * vec4(p, 1.0);
      gl_Position = projectionMatrix * mv;
      float dist = -mv.z;
      gl_PointSize = (1.6 + sin(uTime * 1.6 + aPhase) * 0.9) * aSize * uPixelR * (40.0 / dist);
      vA = 0.35 + sin(uTime * 0.9 + aPhase * 1.1) * 0.45;
    }
  `,
  fragmentShader: `
    varying float vA;
    void main(){
      vec2 c = gl_PointCoord - 0.5;
      float d = length(c);
      if (d > 0.5) discard;
      float soft = smoothstep(0.5, 0.0, d);
      vec3 col = vec3(1.0, 0.96, 0.86);
      gl_FragColor = vec4(col, soft * vA * 0.55);
    }
  `
});
scene.add(new THREE.Points(starGeo, starMat));

/* ============================================================
   AUDIO — bgm toggle + generated chime triad
   ============================================================ */
let audioOn = false;
let audioCtx = null;
function ensureAudio(){
  if (audioCtx) return audioCtx;
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return null;
  audioCtx = new Ctx();
  return audioCtx;
}
function playChimeTriad() {
  const ctx = ensureAudio();
  if (!ctx) return;
  ctx.resume?.();
  [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.value = freq;
    g.gain.value = 0;
    osc.connect(g).connect(ctx.destination);
    const t = ctx.currentTime + i * 0.12;
    g.gain.linearRampToValueAtTime(0.07, t + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.7);
    osc.start(t);
    osc.stop(t + 0.72);
  });
}
function playTick() {
  const ctx = ensureAudio();
  if (!ctx) return;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.value = 880;
  g.gain.value = 0;
  osc.connect(g).connect(ctx.destination);
  const t = ctx.currentTime;
  g.gain.linearRampToValueAtTime(0.04, t + 0.005);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.15);
  osc.start(t);
  osc.stop(t + 0.17);
}

audioBtn.addEventListener('click', () => {
  audioOn = !audioOn;
  audioBtn.setAttribute('aria-pressed', String(audioOn));
  audioBtn.setAttribute('aria-label', audioOn ? '暂停音乐' : '播放音乐');
  if (audioOn) {
    bgm.volume = 0.55;
    bgm.play().catch(() => {});
  } else {
    bgm.pause();
  }
});
function updateAudioIcon(time){
  if (!audioWave) return;
  const pts = [];
  for (let i = 0; i < 6; i++) {
    const x = 1 + i * 1.5;
    const y = audioOn ? 5 + Math.sin(time * 0.005 + i * 0.9) * 2.4 : 5;
    pts.push(`${x.toFixed(2)},${y.toFixed(2)}`);
  }
  audioWave.setAttribute('points', pts.join(' '));
}

/* ============================================================
   RESIZE
   ============================================================ */
window.addEventListener('resize', () => {
  renderer.setSize(window.innerWidth, window.innerHeight);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
});

/* ---------- Mouse parallax (subtle) ---------- */
const mouse = { x: 0, y: 0, tx: 0, ty: 0 };
window.addEventListener('pointermove', (e) => {
  mouse.tx = (e.clientX / window.innerWidth - 0.5) * 2;
  mouse.ty = -(e.clientY / window.innerHeight - 0.5) * 2;
});

/* ============================================================
   RENDER LOOP
   ============================================================ */
const clock = new THREE.Clock();
let prevStage = -1;

function tick() {
  const dt = Math.min(clock.getDelta(), 0.05);
  const t  = clock.getElapsedTime();

  cooldown = Math.max(0, cooldown - dt);
  mouse.x += (mouse.tx - mouse.x) * 0.04;
  mouse.y += (mouse.ty - mouse.y) * 0.04;

  // Reveal items based on current stage
  revealItems.forEach((it) => {
    const target = (current >= it.stage) ? 1 : 0;
    const speed = (target > it.progress) ? 1.8 : 3.0;
    it.progress += (target - it.progress) * speed * dt;
    const e = target > 0.5 ? easeOutBack(Math.min(1, it.progress)) : easeOutCubic(it.progress);
    if (it.scaleFrom !== undefined) {
      it.obj.scale.setScalar(Math.max(0.001, e));
    } else {
      it.obj.position.y = it.baseY + (1 - e) * it.yFrom;
      it.obj.scale.setScalar(Math.max(0.001, e));
    }
  });

  // Flames appear at stage 8 (LAST). Also handle blow.
  if (current >= LAST && !finaleShown) {
    for (let i = 0; i < flameAliveTargets.length; i++) {
      flameAliveTargets[i] = 1.0;
      flameExtinguished[i] = false;
    }
  } else if (current < LAST) {
    for (let i = 0; i < flameAliveTargets.length; i++) flameAliveTargets[i] = 0.0;
  }

  // Blow logic
  if (blowing && current === LAST && !finaleShown) {
    blowHold += dt;
    if (blowHold > 0.05 && Math.random() < dt * 8) playTick();
    if (blowHold >= BLOW_NEEDED) {
      // 逐根熄灭，每 180ms 灭一根（火星/烟雾在 alive 跨阈值时触发）
      candlePositions.forEach((_, i) => {
        setTimeout(() => { flameAliveTargets[i] = 0.0; }, i * 180);
      });
      triggerFinale();
      blowHold = 0;
    }
  } else if (!blowing && current === LAST && !finaleShown) {
    blowHold = Math.max(0, blowHold - dt * 0.8);
  }
  // Update blow ring progress
  if (current === LAST && !finaleShown) {
    const r = Math.min(1, blowHold / BLOW_NEEDED);
    blowFill.style.strokeDashoffset = String(289 * (1 - r));
  }

  // Smooth flame alive — per candle
  const swayNow = (blowing && current === LAST && !finaleShown)
    ? Math.min(1, blowHold / BLOW_NEEDED) * 1.2
    : 0.0;
  let aliveSum = 0;
  for (let i = 0; i < flameAlives.length; i++) {
    const prev = flameAlives[i];
    flameAlives[i] += (flameAliveTargets[i] - prev) * 0.12;
    aliveSum += flameAlives[i];
    const mat = flameMats[i];
    mat.uniforms.uTime.value  = t;
    mat.uniforms.uAlive.value = flameAlives[i];
    mat.uniforms.uSway.value  = swayNow;
    flames[i].scale.setScalar(Math.max(0.001, flameAlives[i]));
    // 熄灭瞬间：金色火星 + 烟雾（从亮跨到暗时触发一次）
    if (!flameExtinguished[i] && prev > 0.55 && flameAlives[i] <= 0.55 && flameAliveTargets[i] === 0) {
      emitBurstSmall(candlePositions[i]);
      spawnSmokeAt(candlePositions[i]);
      spawnSmokeAt(candlePositions[i]);
      flameExtinguished[i] = true;
    }
  }
  const avgAlive = aliveSum / flameAlives.length;

  // Flame light
  const flick = 0.85 + Math.sin(t * 22.0) * 0.05 + Math.sin(t * 9.3) * 0.06;
  flameLight.intensity = 2.4 * avgAlive * flick;
  flameLight.position.y = topY + 0.45 + Math.sin(t * 3.0) * 0.015;

  // Smoke trail spawn (continuous after extinguish for ~1.2s)
  // (controlled by sLife array which decays automatically)

  // Burst update
  let bDirty = false;
  for (let i = 0; i < BURST_MAX; i++) {
    if (bLife[i] <= 0) continue;
    bLife[i] -= dt;
    bVel[i*3+1] -= 1.4 * dt;
    bVel[i*3+0] *= (1 - 1.1 * dt);
    bVel[i*3+2] *= (1 - 1.1 * dt);
    bPos[i*3+0] += bVel[i*3+0] * dt;
    bPos[i*3+1] += bVel[i*3+1] * dt;
    bPos[i*3+2] += bVel[i*3+2] * dt;
    if (bLife[i] <= 0) { bPos[i*3+0] = 9999; }
    bLifeAttr.array[i] = bLife[i];
    bMaxAttr.array[i]  = bMax[i];
    bDirty = true;
  }
  if (bDirty) {
    bGeo.attributes.position.needsUpdate = true;
    bLifeAttr.needsUpdate = true;
    bMaxAttr.needsUpdate  = true;
  }

  // Smoke update
  let sDirty = false;
  for (let i = 0; i < SMOKE_MAX; i++) {
    if (sLife[i] <= 0) continue;
    sLife[i] -= dt;
    sVel[i*3+1] += 0.05 * dt;
    sPos[i*3+0] += sVel[i*3+0] * dt;
    sPos[i*3+1] += sVel[i*3+1] * dt;
    sPos[i*3+2] += sVel[i*3+2] * dt;
    if (sLife[i] <= 0) { sPos[i*3+0] = 9999; }
    sLifeAttr.array[i] = sLife[i];
    sMaxAttr.array[i]  = sMax[i];
    sDirty = true;
  }
  if (sDirty) {
    sGeo.attributes.position.needsUpdate = true;
    sLifeAttr.needsUpdate = true;
    sMaxAttr.needsUpdate  = true;
  }

  // Subtle cake group slow rotation + parallax
  cakeGroup.rotation.y += dt * 0.10;
  cakeGroup.rotation.y += (mouse.x * 0.3 - (cakeGroup.rotation.y - cakeGroup.rotation.y)) * 0;
  // tilt with mouse
  cakeGroup.rotation.x = mouse.y * 0.08;

  // Camera — pushes the cake into the upper half of the viewport
  // so the bottom strip is free for the caption.
  const camTargetY = 2.9 - (current === 0 ? 0.3 : 0);
  camera.position.x += (mouse.x * 0.10 - camera.position.x) * 0.04;   // gentle parallax
  camera.position.y += (camTargetY + mouse.y * 0.08 - camera.position.y) * 0.04;
  camera.lookAt(0, 0.5, 0);

  starMat.uniforms.uTime.value = t;

  updateAudioIcon(performance.now());
  renderer.render(scene, camera);

  // Detect first entry into LAST to emit a small celebratory burst when candles light
  if (prevStage !== current) {
    if (current === LAST) {
      candlePositions.forEach((p) => {
        // tiny burst at each flame to mark ignition
        emitBurstSmall(p);
      });
    }
    prevStage = current;
  }

  requestAnimationFrame(tick);
}

function emitBurstSmall(origin) {
  let emitted = 0;
  for (let i = 0; i < BURST_MAX && emitted < 14; i++) {
    if (bLife[i] > 0) continue;
    bPos[i*3+0] = origin.x;
    bPos[i*3+1] = origin.y;
    bPos[i*3+2] = origin.z;
    const theta = Math.random() * Math.PI * 2;
    const phi   = Math.acos(2 * Math.random() - 1);
    const speed = 0.4 + Math.random() * 0.9;
    bVel[i*3+0] = Math.sin(phi) * Math.cos(theta) * speed;
    bVel[i*3+1] = Math.cos(phi) * speed * 0.4 + 0.4;
    bVel[i*3+2] = Math.sin(phi) * Math.sin(theta) * speed;
    const L = 0.7 + Math.random() * 0.6;
    bLife[i] = L; bMax[i] = L;
    emitted++;
  }
}

tick();
