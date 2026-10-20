import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';

// ---------- helpers ----------
const $ = (id: string) => document.getElementById(id)!;
const BASE_URL = import.meta.env.BASE_URL;
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const wrapPi = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
const rnd = (a: number, b: number) => a + Math.random() * (b - a);
function fmt(n: number): string {
  if (n < 1000) return Math.floor(n).toString();
  const u = ['K', 'M', 'B', 'T', 'Qa', 'Qi'];
  let i = -1;
  while (n >= 1000 && i < u.length - 1) { n /= 1000; i++; }
  return (n >= 100 ? n.toFixed(0) : n >= 10 ? n.toFixed(1) : n.toFixed(2)) + u[i];
}

// ---------- game data ----------
interface Vehicle { id: string; name: string; cost: number; rb: number; launch: number; speed: number; color: number; accent: number; kind: 'sedan' | 'suv' | 'truck' | 'sport' | 'ship' | 'rocket' | 'ufo'; }
const VEHICLES: Vehicle[] = [
  { id: 'm3', name: 'Model 3', cost: 0, rb: 0, launch: 1, speed: 1, color: 0xd0d2d4, accent: 0x33aaff, kind: 'sedan' },
  { id: 'ms', name: 'Model S', cost: 2500, rb: 0, launch: 1.5, speed: 1.1, color: 0x1a1a1c, accent: 0xff4f4f, kind: 'sedan' },
  { id: 'my', name: 'Model Y Sky', cost: 10000, rb: 0, launch: 1.9, speed: 1.15, color: 0x2d8659, accent: 0x4fffb0, kind: 'suv' },
  { id: 'mx', name: 'Model X', cost: 40000, rb: 0, launch: 2.4, speed: 1.2, color: 0x1e4a9f, accent: 0x5fc3ff, kind: 'suv' },
  { id: 'ct', name: 'Cybertruck', cost: 250000, rb: 0, launch: 3.5, speed: 1.35, color: 0x8a8d94, accent: 0xcccccc, kind: 'truck' },
  { id: 'gt', name: 'Gold Plaid', cost: 1000000, rb: 0, launch: 5, speed: 1.55, color: 0xd4a240, accent: 0xffef80, kind: 'sedan' },
  { id: 'rd', name: 'Roadster', cost: 4000000, rb: 1, launch: 7, speed: 1.7, color: 0xb8192b, accent: 0xff3b50, kind: 'sport' },
  { id: 'nt', name: 'Neon Truck', cost: 25000000, rb: 2, launch: 11, speed: 1.85, color: 0x5a1a8a, accent: 0x00ffff, kind: 'truck' },
  { id: 'ss', name: 'Star-Tesla', cost: 100000000, rb: 3, launch: 18, speed: 2.1, color: 0xb8bcc4, accent: 0xff8844, kind: 'ship' },
  { id: 'uf', name: 'Alien UFO', cost: 1e9, rb: 5, launch: 30, speed: 2.4, color: 0x77ff99, accent: 0xff00ff, kind: 'ufo' },
  { id: 'lt', name: 'Lunar Tank', cost: 2e10, rb: 8, launch: 55, speed: 2.7, color: 0x050510, accent: 0xff00ff, kind: 'ship' },
  { id: 'cx', name: 'COSMIC X', cost: 5e11, rb: 12, launch: 100, speed: 3.2, color: 0xf0f2f5, accent: 0xff7838, kind: 'rocket' },
];
interface Upgrade { id: string; name: string; desc: string; base: number; growth: number; max: number; }
const UPGRADES: Upgrade[] = [
  { id: 'train', name: 'Training Power', desc: '+1 more training point per SPACE press.', base: 50, growth: 1.9, max: 50 },
  { id: 'launch', name: 'Launch Boost', desc: '+20% ramp launch power per level.', base: 120, growth: 2.1, max: 40 },
  { id: 'flip', name: 'Flip Spin', desc: 'Faster aerial flips and flip rewards.', base: 100, growth: 1.9, max: 20 },
  { id: 'glide', name: 'Glider Wings', desc: 'Slower sink and more forward thrust when gliding.', base: 150, growth: 2.0, max: 10 },
  { id: 'engine', name: 'Motor', desc: '+10% top speed per level.', base: 80, growth: 1.9, max: 20 },
  { id: 'magnet', name: 'Coin Magnet', desc: 'Pull coins in from further away.', base: 60, growth: 1.8, max: 15 },
  { id: 'coinv', name: 'Coin Value', desc: '+25% coins from everything.', base: 200, growth: 2.2, max: 40 },
];
const ZONES = [
  { name: 'Neon City', r: 150, color: 0x1a2a4a },
  { name: 'Urban Sprawl', r: 400, color: 0x3a4a6a },
  { name: 'Industrial Zone', r: 800, color: 0x4b4d6e },
  { name: 'Frozen Peaks', r: 1400, color: 0xdbeaf5 },
  { name: 'Lunar Flats', r: 1e9, color: 0x9a9aa6 },
];
const WORLD_R = 2200;
const SPACE_EXTENT = 1_000_000_000;
const SPACE_VIEW_DISTANCE = 1_200_000_000;
const GRAVITY = 32;
const SAVE_KEY = 'flying-tesla-clicker-v1';

interface Save {
  coins: number; train: [number, number, number]; ups: Record<string, number>;
  owned: string[]; veh: string; rebirths: number; best: number; flips: number; launches: number; focus: number;
  rpSpent: number; rups: Record<string, number>; ach: string[]; bestDist: number; totalCoins: number;
}
function freshSave(): Save {
  return { coins: 0, train: [0, 0, 0], ups: {}, owned: ['m3'], veh: 'm3', rebirths: 0, best: 0, flips: 0, launches: 0, focus: 0, rpSpent: 0, rups: {}, ach: [], bestDist: 0, totalCoins: 0 };
}
function loadSave(): Save {
  try {
    const s = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null');
    if (s && typeof s.coins === 'number') return { ...freshSave(), ...s };
  } catch { /* ignore */ }
  return freshSave();
}
const save = loadSave();
const persist = () => { try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch { /* ignore */ } };
setInterval(persist, 4000);
window.addEventListener('beforeunload', persist);

const rup = (id: string) => save.rups[id] || 0;
const rebirthMult = () => (1 + 0.5 * save.rebirths) * (1 + 0.2 * rup('mult'));
const rpAvail = () => save.rebirths - save.rpSpent;
interface RUp { id: string; name: string; desc: string; cost: number; max: number; }
const RUPS: RUp[] = [
  { id: 'mult', name: 'Prestige Power', desc: '+20% to all gains (multiplies rebirth bonus).', cost: 1, max: 20 },
  { id: 'start', name: 'Head Start', desc: 'Start each rebirth with 5,000 × level coins.', cost: 1, max: 10 },
  { id: 'auto', name: 'Auto-Trainer', desc: 'Trains automatically: +1 press/sec per level.', cost: 2, max: 10 },
  { id: 'hi', name: 'Sky Legs', desc: '+25% launch height per level.', cost: 1, max: 20 },
  { id: 'keep', name: 'Muscle Memory', desc: 'Keep 10% of training power per level on rebirth.', cost: 2, max: 8 },
  { id: 'glide', name: 'Eternal Wings', desc: 'Gliding is much more efficient.', cost: 2, max: 5 },
];
const rupCost = (u: RUp) => u.cost * (rup(u.id) + 1);
interface Ach { id: string; name: string; reward: number; test: () => boolean; }
const ACHS: Ach[] = [
  { id: 'a1', name: 'First flight (launch once)', reward: 50, test: () => save.launches >= 1 },
  { id: 'a2', name: 'Reach 50 m height', reward: 200, test: () => save.best >= 50 },
  { id: 'a3', name: 'Reach 500 m height', reward: 5000, test: () => save.best >= 500 },
  { id: 'a4', name: 'Reach 5,000 m height', reward: 100000, test: () => save.best >= 5000 },
  { id: 'a5', name: 'Reach space (30,000 m)', reward: 2e6, test: () => save.best >= 30000 },
  { id: 'a6', name: 'Land 10 flips', reward: 1000, test: () => save.flips >= 10 },
  { id: 'a7', name: 'Land 100 flips', reward: 50000, test: () => save.flips >= 100 },
  { id: 'a8', name: 'Fly 500 m far', reward: 3000, test: () => save.bestDist >= 500 },
  { id: 'a9', name: 'Earn 1M coins total', reward: 25000, test: () => save.totalCoins >= 1e6 },
  { id: 'a10', name: 'First rebirth', reward: 100000, test: () => save.rebirths >= 1 },
  { id: 'a11', name: 'Own 6 vehicles', reward: 250000, test: () => save.owned.length >= 6 },
  { id: 'a12', name: 'Own every vehicle', reward: 1e9, test: () => save.owned.length >= VEHICLES.length },
  { id: 'a13', name: 'Reach deep space (1 billion m)', reward: 1e9, test: () => save.best >= SPACE_EXTENT },
];
const up = (id: string) => save.ups[id] || 0;
const veh = () => VEHICLES.find(v => v.id === save.veh)!;
const upCost = (u: Upgrade) => Math.floor(u.base * Math.pow(u.growth, up(u.id)));
const coinMult = () => (1 + 0.25 * up('coinv')) * rebirthMult();
const maxSpeed = () => 42 * (1 + 0.1 * up('engine')) * veh().speed;
const rebirthCost = () => 50000 * Math.pow(save.rebirths + 1, 2.6);

// ---------- audio ----------
let actx: AudioContext | null = null;
function beep(freq: number, dur = 0.08, type: OscillatorType = 'square', vol = 0.04, slide = 0) {
  try {
    actx = actx || new AudioContext();
    const o = actx.createOscillator(), g = actx.createGain();
    o.type = type; o.frequency.value = freq;
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), actx.currentTime + dur);
    g.gain.value = vol; g.gain.exponentialRampToValueAtTime(0.0001, actx.currentTime + dur);
    o.connect(g).connect(actx.destination); o.start(); o.stop(actx.currentTime + dur);
  } catch { /* audio unavailable */ }
}

// ---------- renderer / scene ----------
const renderer = new THREE.WebGLRenderer({ antialias: true, logarithmicDepthBuffer: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
document.body.prepend(renderer.domElement);
const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x0d1420, 200, 2400);
const camera = new THREE.PerspectiveCamera(65, innerWidth / innerHeight, 0.3, SPACE_VIEW_DISTANCE);
{
  const pm = new THREE.PMREMGenerator(renderer);
  scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.7;
}

scene.add(new THREE.HemisphereLight(0x4a5a7f, 0x2a3a45, 0.85));
const sun = new THREE.DirectionalLight(0xd8a040, 2.5);
const SUN_OFF = new THREE.Vector3(60, 90, 40);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -45, right: 45, top: 45, bottom: -45, near: 1, far: 300 });
sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.05;
scene.add(sun, sun.target);

// gradient sky dome with a sun and a space blend - DARK DYSTOPIAN
const skyU = {
  top: { value: new THREE.Color(0x0a1428) }, bot: { value: new THREE.Color(0x1a2540) },
  space: { value: 0 }, sunDir: { value: SUN_OFF.clone().normalize() },
};
const skyMesh = new THREE.Mesh(new THREE.SphereGeometry(20000, 32, 16), new THREE.ShaderMaterial({
  uniforms: skyU, side: THREE.BackSide, depthWrite: false, fog: false,
  vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
  fragmentShader: `uniform vec3 top; uniform vec3 bot; uniform float space; uniform vec3 sunDir; varying vec3 vP;
    void main(){ float h = clamp(vP.y, 0.0, 1.0); vec3 c = mix(bot, top, pow(h, 0.6));
      float s = max(dot(normalize(vP), sunDir), 0.0);
      float hz = pow(1.0 - clamp(vP.y, 0.0, 1.0), 8.0);
      c = mix(c, vec3(0.45,0.25,0.1), hz * 0.25 * (1.0 - space) * (0.3 + 0.4 * s));
      c += vec3(0.9,0.6,0.25) * (pow(s, 900.0) * 2.5 + pow(s, 10.0) * 0.12 * (1.0 - space) + pow(s, 3.0) * 0.04 * (1.0 - space));
      float au = smoothstep(0.15, 0.45, vP.y) * smoothstep(0.85, 0.45, vP.y) * space;
      c += vec3(0.15,0.6,0.45) * au * (0.5 + 0.5 * sin(vP.x * 12.0 + vP.z * 7.0)) * 0.25;
      c = mix(c, vec3(0.002,0.004,0.012), space); gl_FragColor = vec4(c, 1.0); }`,
}));
skyMesh.frustumCulled = false; skyMesh.renderOrder = -10;
scene.add(skyMesh);

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.35, 0.6, 0.9);
composer.addPass(bloom);
composer.addPass(new OutputPass());

function canvasTex(w: number, h: number, draw: (c: CanvasRenderingContext2D) => void, repX = 1, repY = 1, srgb = true): THREE.CanvasTexture {
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  draw(cv.getContext('2d')!);
  const t = new THREE.CanvasTexture(cv);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repX, repY);
  t.anisotropy = 8; if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
function noise(c: CanvasRenderingContext2D, w: number, h: number, base: number, amp: number, n: number) {
  c.fillStyle = `rgb(${base},${base},${base})`; c.fillRect(0, 0, w, h);
  for (let i = 0; i < n; i++) {
    const v = Math.floor(base + rnd(-amp, amp));
    c.fillStyle = `rgba(${v},${v},${v},${rnd(0.2, 0.8)})`;
    c.fillRect(rnd(0, w), rnd(0, h), rnd(1, 4), rnd(1, 4));
  }
}

// ground (vertex coloured by zone)
{
  const geo = new THREE.PlaneGeometry(WORLD_R * 2.4, WORLD_R * 2.4, 240, 240);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  const cols = new Float32Array(pos.count * 3);
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i), r = Math.hypot(x, z);
    const zi = ZONES.findIndex(zn => r < zn.r);
    const a = ZONES[zi].color, b = ZONES[Math.min(zi + 1, ZONES.length - 1)].color;
    const prev = zi > 0 ? ZONES[zi - 1].r : 0;
    const t = clamp((r - (ZONES[zi].r - 40)) / 40, 0, 1) * (zi < ZONES.length - 1 ? 1 : 0);
    void prev;
    c.set(a).lerp(new THREE.Color(b), t);
    const n = 0.92 + 0.08 * Math.sin(x * 0.07) * Math.cos(z * 0.06);
    cols[i * 3] = c.r * n; cols[i * 3 + 1] = c.g * n; cols[i * 3 + 2] = c.b * n;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(cols, 3));
  const cityPavement = canvasTex(512, 512, c => {
    noise(c, 512, 512, 110, 28, 4200);
    c.strokeStyle = 'rgba(20,28,42,.55)';
    c.lineWidth = 2;
    for (let y = 0; y <= 512; y += 128) {
      c.beginPath(); c.moveTo(0, y); c.lineTo(512, y); c.stroke();
    }
    for (let x = 0; x <= 512; x += 128) {
      c.beginPath(); c.moveTo(x, 0); c.lineTo(x, 512); c.stroke();
    }
    for (let i = 0; i < 24; i++) {
      c.strokeStyle = `rgba(5,10,18,${rnd(0.12, 0.28)})`;
      c.beginPath(); c.moveTo(rnd(0, 512), rnd(0, 512)); c.lineTo(rnd(0, 512), rnd(0, 512)); c.stroke();
    }
  }, WORLD_R * 2.4 / 14, WORLD_R * 2.4 / 14);
  const gm = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, map: cityPavement, roughness: 0.9, metalness: 0.08 }));
  gm.receiveShadow = true; scene.add(gm);
  // asphalt runway
  const asph = canvasTex(256, 1024, c => {
    noise(c, 256, 1024, 70, 25, 5000);
    c.fillStyle = '#e8e8e8'; c.fillRect(8, 0, 6, 1024); c.fillRect(242, 0, 6, 1024);
    c.fillStyle = '#ffd23a'; for (let y = 0; y < 1024; y += 128) c.fillRect(125, y, 6, 64);
  }, 1, 120 / 8);
  const rw = new THREE.Mesh(new THREE.PlaneGeometry(16, 150).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ map: asph, roughness: 0.85 }));
  rw.position.set(0, 0.04, -35); rw.receiveShadow = true; scene.add(rw);
  // start line
  const sl = new THREE.Mesh(new THREE.PlaneGeometry(13, 1.2).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ map: canvasTex(128, 16, c => { for (let i = 0; i < 16; i++) for (let j = 0; j < 2; j++) { c.fillStyle = (i + j) % 2 ? '#111' : '#fff'; c.fillRect(i * 8, j * 8, 8, 8); } }) }));
  sl.position.set(0, 0.06, -12); scene.add(sl);
  // world edge ring
  const ring = new THREE.Mesh(new THREE.TorusGeometry(WORLD_R, 3, 8, 160), new THREE.MeshBasicMaterial({ color: 0xff4fd8 }));
  ring.rotation.x = Math.PI / 2; ring.position.y = 2;
  scene.add(ring);
}

// fluffy cloud clusters
const clouds = new THREE.Group();
{
  const cm = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8, fog: false });
  const sg = new THREE.SphereGeometry(1, 10, 8);
  for (let i = 0; i < 50; i++) {
    const cl = new THREE.Group(), base = rnd(30, 70);
    for (let k = 0; k < 6; k++) {
      const m = new THREE.Mesh(sg, cm); const r = base * rnd(0.5, 1);
      m.scale.set(r, r * 0.5, r); m.position.set(rnd(-base, base) * 1.2, rnd(0, base * 0.3), rnd(-base, base) * 0.6); cl.add(m);
    }
    const a2 = rnd(0, 6.283), d = rnd(300, 3500);
    cl.position.set(Math.cos(a2) * d, rnd(150, 1100), Math.sin(a2) * d);
    clouds.add(cl);
  }
}
scene.add(clouds);
const stars = (() => {
  const starTexture = canvasTex(32, 32, c => {
    const glow = c.createRadialGradient(16, 16, 0, 16, 16, 16);
    glow.addColorStop(0, 'rgba(255,255,255,1)');
    glow.addColorStop(0.16, 'rgba(255,255,255,.92)');
    glow.addColorStop(0.48, 'rgba(255,255,255,.28)');
    glow.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = glow;
    c.fillRect(0, 0, 32, 32);
  });
  const makeStarLayer = (count: number, minRadius: number, maxRadius: number, size: number) => {
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const color = new THREE.Color();
    const palette = [0xffffff, 0xc7e3ff, 0xffe7a3, 0xffa878, 0xb8a6ff];
    for (let i = 0; i < count; i++) {
      const p = new THREE.Vector3().randomDirection().multiplyScalar(rnd(minRadius, maxRadius) / SPACE_EXTENT);
      positions.set([p.x, p.y, p.z], i * 3);
      color.setHex(palette[Math.floor(Math.random() * palette.length)]);
      const brightness = rnd(0.65, 1);
      colors.set([color.r * brightness, color.g * brightness, color.b * brightness], i * 3);
    }
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    const points = new THREE.Points(geometry, new THREE.PointsMaterial({
      map: starTexture, alphaTest: 0.015, size, sizeAttenuation: true, vertexColors: true, fog: false, transparent: true, opacity: 0,
      depthWrite: false, blending: THREE.AdditiveBlending,
    }));
    points.scale.setScalar(SPACE_EXTENT);
    points.frustumCulled = false;
    scene.add(points);
    return points;
  };
  const far = makeStarLayer(56_000, SPACE_EXTENT * 0.76, SPACE_EXTENT, SPACE_EXTENT * 0.0022);
  const near = makeStarLayer(20_000, SPACE_EXTENT * 0.28, SPACE_EXTENT * 0.62, SPACE_EXTENT * 0.0018);
  return { far, near };
})();

const planet = new THREE.Group();
{
  const palettes = [
    { stops: ['#c9773a', '#efc27a', '#8a4a2a'], accent: '#ffe1a0' },
    { stops: ['#5a8fd9', '#3a6fc9', '#1a4fa9'], accent: '#b8e6ff' },
    { stops: ['#e8f4ff', '#b8d8ff', '#7ab8ff'], accent: '#ffffff' },
    { stops: ['#d94a3a', '#b8332a', '#8a1a1a'], accent: '#ffd2a0' },
    { stops: ['#b8a0d8', '#8860a8', '#5a3a88'], accent: '#f0caff' },
    { stops: ['#4a9d5a', '#3a7d4a', '#2a5d3a'], accent: '#b8f58a' },
    { stops: ['#f0a020', '#d88010', '#b06000'], accent: '#ffe179' },
    { stops: ['#20d0d8', '#10b0c8', '#0090b8'], accent: '#9bffff' },
    { stops: ['#ffd840', '#ffb820', '#dd9800'], accent: '#fff3a0' },
    { stops: ['#8a2a2a', '#6a1a1a', '#4a0a0a'], accent: '#ff9a7a' },
    { stops: ['#1a9a8a', '#0a7a6a', '#0a5a4a'], accent: '#a0ffdf' },
    { stops: ['#d080a8', '#b06088', '#804060'], accent: '#ffd1ed' },
  ];
  const planetMaterial = palettes.map((palette, paletteIndex) => {
    const map = canvasTex(512, 256, c => {
      const gradient = c.createLinearGradient(0, 0, 0, 256);
      palette.stops.forEach((stop, i) => gradient.addColorStop(i / (palette.stops.length - 1), stop));
      c.fillStyle = gradient;
      c.fillRect(0, 0, 512, 256);
      for (let i = 0; i < 48; i++) {
        c.globalAlpha = rnd(0.12, 0.38);
        c.fillStyle = i % 3 === 0 ? palette.accent : palette.stops[i % palette.stops.length];
        const y = rnd(-12, 256);
        c.beginPath();
        c.ellipse(rnd(0, 512), y, rnd(12, 180), rnd(2, paletteIndex % 3 === 1 ? 14 : 34), rnd(-0.15, 0.15), 0, Math.PI * 2, false);
        c.fill();
      }
      c.globalAlpha = 0.2;
      for (let i = 0; i < 1800; i++) {
        c.fillStyle = i % 2 ? '#ffffff' : '#080b18';
        const radius = rnd(1, 5);
        c.beginPath(); c.arc(rnd(0, 512), rnd(0, 256), radius, 0, Math.PI * 2); c.fill();
      }
      c.globalAlpha = 1;
    });
    return new THREE.MeshStandardMaterial({ map, roughness: 0.82, metalness: 0.04, fog: false });
  });
  const sphere = new THREE.SphereGeometry(1, 24, 18);
  const ringGeometry = new THREE.RingGeometry(1.35, 2.25, 48);
  const ringMaterial = new THREE.MeshBasicMaterial({
    color: 0xffffff, side: THREE.DoubleSide,
    transparent: true, opacity: 0.72, fog: false, depthWrite: false,
  });
  const moonTexture = canvasTex(512, 256, c => {
    noise(c, 512, 256, 106, 34, 3800);
    for (let i = 0; i < 220; i++) {
      const x = rnd(0, 512), y = rnd(0, 256), r = rnd(2, 16);
      c.fillStyle = 'rgba(25,30,41,.42)';
      c.beginPath(); c.arc(x + r * 0.12, y + r * 0.16, r, 0, Math.PI * 2); c.fill();
      c.strokeStyle = 'rgba(232,237,246,.28)';
      c.lineWidth = rnd(0.5, 2);
      c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.stroke();
    }
  });
  const moonMaterial = new THREE.MeshStandardMaterial({ map: moonTexture, color: 0xb8bbc8, roughness: 1, fog: false });
  const planetBuckets: { position: THREE.Vector3; radius: number; rotation: THREE.Euler }[][] = palettes.map(() => []);
  const ringInstances: { position: THREE.Vector3; radius: number; rotation: THREE.Euler; color: THREE.Color }[] = [];
  const moonInstances: { position: THREE.Vector3; radius: number }[] = [];
  const addPlanet = (x: number, y: number, z: number, radius: number, palette: number, rings = false, moonChance = 0.22) => {
    const rotation = new THREE.Euler(rnd(0, Math.PI), rnd(0, Math.PI * 2), rnd(0, Math.PI));
    planetBuckets[palette].push({ position: new THREE.Vector3(x, y, z).multiplyScalar(1 / SPACE_EXTENT), radius: radius / SPACE_EXTENT, rotation });
    if (rings && Math.random() < 0.36) {
      const ringRotation = new THREE.Euler(Math.PI / 2 + rnd(-0.45, 0.45), rnd(0, Math.PI * 2), rnd(0, Math.PI * 2));
      ringInstances.push({ position: new THREE.Vector3(x, y, z).multiplyScalar(1 / SPACE_EXTENT), radius: radius / SPACE_EXTENT, rotation: ringRotation, color: new THREE.Color(palettes[palette].accent) });
    }
    if (Math.random() < moonChance) {
      const angle = rnd(0, Math.PI * 2);
      const distance = radius * rnd(2.8, 4.5);
      moonInstances.push({
        position: new THREE.Vector3(x + Math.cos(angle) * distance, y + rnd(-radius, radius), z + Math.sin(angle) * distance).multiplyScalar(1 / SPACE_EXTENT),
        radius: radius * rnd(0.12, 0.28) / SPACE_EXTENT,
      });
    }
  };

  // A recognizable close system near the 100 km altitude band.
  addPlanet(-28_000, 82_000, 74_000, 12_000, 0, true, 0.9);
  addPlanet(54_000, 108_000, 138_000, 8_500, 1, true, 0.8);
  addPlanet(-110_000, 128_000, -44_000, 7_000, 2, false, 0.5);
  addPlanet(170_000, 155_000, -160_000, 5_500, 3, false, 0.4);
  addPlanet(-240_000, 185_000, -185_000, 9_500, 4, true, 0.8);
  addPlanet(210_000, 62_000, 240_000, 6_000, 10, false, 0.5);

  // Logarithmic bands keep the planetary backdrop populated all the way to one billion metres.
  const altitudeBands = 64;
  const planetsPerBand = 16;
  const minAltitude = 18_000;
  for (let band = 0; band < altitudeBands; band++) {
    const progress = band / (altitudeBands - 1);
    const altitude = minAltitude * Math.pow(SPACE_EXTENT / minAltitude, progress);
    const phase = band * 2.399963;
    for (let i = 0; i < planetsPerBand; i++) {
      const angle = phase + (i / planetsPerBand) * Math.PI * 2 + rnd(-0.12, 0.12);
      const distance = altitude * rnd(0.12, 0.55);
      const radius = Math.max(2_500, altitude * rnd(0.008, 0.02));
      const y = clamp(altitude * rnd(0.88, 1.08), radius * 1.5, SPACE_EXTENT - radius * 1.5);
      addPlanet(Math.cos(angle) * distance, y, Math.sin(angle) * distance, radius, Math.floor(Math.random() * palettes.length), Math.random() < 0.32);
    }
  }
  const dummy = new THREE.Object3D();
  for (let palette = 0; palette < planetBuckets.length; palette++) {
    const bucket = planetBuckets[palette];
    const instances = new THREE.InstancedMesh(sphere, planetMaterial[palette], bucket.length);
    instances.frustumCulled = false;
    bucket.forEach((p, i) => {
      dummy.position.copy(p.position);
      dummy.rotation.copy(p.rotation);
      dummy.scale.setScalar(p.radius);
      dummy.updateMatrix();
      instances.setMatrixAt(i, dummy.matrix);
    });
    planet.add(instances);
  }
  const ringMesh = new THREE.InstancedMesh(ringGeometry, ringMaterial, ringInstances.length);
  ringMesh.frustumCulled = false;
  ringInstances.forEach((r, i) => {
    dummy.position.copy(r.position);
    dummy.rotation.copy(r.rotation);
    dummy.scale.set(r.radius, r.radius, 1);
    dummy.updateMatrix();
    ringMesh.setMatrixAt(i, dummy.matrix);
    ringMesh.setColorAt(i, r.color);
  });
  planet.add(ringMesh);
  const moons = new THREE.InstancedMesh(sphere, moonMaterial, moonInstances.length);
  moons.frustumCulled = false;
  moonInstances.forEach((m, i) => {
    dummy.position.copy(m.position);
    dummy.rotation.set(0, 0, 0);
    dummy.scale.setScalar(m.radius);
    dummy.updateMatrix();
    moons.setMatrixAt(i, dummy.matrix);
  });
  planet.add(moons);
  planet.visible = false;
  planet.frustumCulled = false;
  // Normalize instance transforms so tiny planetary details survive at billion-metre distances.
  planet.scale.setScalar(SPACE_EXTENT);
  scene.add(planet);
}
// ---------- ramps ----------
interface Ramp { x: number; z: number; yaw: number; L: number; W: number; H: number; }
const ramps: Ramp[] = [];
function addRamp(x: number, z: number, yaw: number, L: number, W: number, H: number, color: number) {
  ramps.push({ x, z, yaw, L, W, H });
  const shape = new THREE.Shape();
  shape.moveTo(0, 0); shape.lineTo(L, 0); shape.lineTo(L, H); shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, { depth: W, bevelEnabled: false });
  geo.rotateY(-Math.PI / 2);
  geo.translate(W / 2, 0, 0);
  const g = new THREE.Group();
  const body = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0x2a2d36, roughness: 0.7, metalness: 0.2 }));
  body.castShadow = body.receiveShadow = true; g.add(body);
  const len = Math.hypot(L, H), slopeA = Math.atan2(H, L);
  // surface deck with asphalt texture
  const deckTex = canvasTex(256, 512, c => { noise(c, 256, 512, 80, 25, 4000); c.fillStyle = '#ffd23a'; for (let y = 0; y < 512; y += 64) c.fillRect(124, y, 8, 32); }, 1, len / 8);
  const deck = new THREE.Mesh(new THREE.BoxGeometry(W, 0.12, len), new THREE.MeshStandardMaterial({ map: deckTex, roughness: 0.8 }));
  deck.position.set(0, H / 2 + 0.06, L / 2); deck.rotation.x = -slopeA; deck.receiveShadow = true; deck.castShadow = true; g.add(deck);
  const glowM = new THREE.MeshStandardMaterial({ color: 0x35f0ff, emissive: 0x35f0ff, emissiveIntensity: 3 });
  for (const sx of [-W / 2 + 0.25, W / 2 - 0.25]) {
    const st = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.14, len), glowM);
    st.position.set(sx, H / 2 + 0.1, L / 2); st.rotation.x = -slopeA; g.add(st);
    // light poles with glowing tips
    for (let k = 1; k <= 4; k++) {
      const lz = (L * k) / 4, ly = (H * k) / 4;
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 2.2, 8), new THREE.MeshStandardMaterial({ color: 0xdddddd, metalness: 0.8, roughness: 0.3 }));
      pole.position.set(sx * 1.08, ly + 1.1, lz); pole.castShadow = true; g.add(pole);
      const orb = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 8), new THREE.MeshStandardMaterial({ color: 0xff2a2a, emissive: 0xff2a2a, emissiveIntensity: 4 }));
      orb.position.set(sx * 1.08, ly + 2.3, lz); g.add(orb);
    }
  }
  // hazard stripes along the lip
  const nStr = 14;
  for (let i = 0; i < nStr; i++) {
    const hz = new THREE.Mesh(new THREE.BoxGeometry(W / nStr, 0.14, 0.9), new THREE.MeshStandardMaterial({ color: i % 2 ? 0x111111 : 0xffd23a, roughness: 0.6 }));
    hz.position.set(-W / 2 + (i + 0.5) * (W / nStr), H + 0.05, L - 0.45); hz.rotation.x = -slopeA * 0.1; g.add(hz);
  }
  // chevron arrows painted on the deck
  for (let k = 0; k < 4; k++) {
    const arrow = new THREE.Mesh(new THREE.ConeGeometry(W * 0.2, W * 0.35, 3), new THREE.MeshStandardMaterial({ color: 0xffe14a, emissive: 0xffa800, emissiveIntensity: 1.5 }));
    arrow.scale.y = 0.35; arrow.rotation.order = 'YXZ'; arrow.rotation.x = -Math.PI / 2 - slopeA;
    const lz = L * (0.18 + k * 0.2);
    arrow.position.set(0, (H * lz) / L + 0.2, lz); g.add(arrow);
  }
  g.position.set(x, 0, z); g.rotation.y = yaw;
  scene.add(g);
}
function ground(x: number, z: number): { h: number; slope: number } {
  let h = 0, slope = 0;
  for (const r of ramps) {
    const dx = x - r.x, dz = z - r.z, s = Math.sin(r.yaw), c = Math.cos(r.yaw);
    const lz = dx * s + dz * c, lx = dx * c - dz * s;
    if (Math.abs(lx) < r.W / 2 && lz >= 0 && lz <= r.L) {
      const hh = (r.H * lz) / r.L;
      if (hh > h) { h = hh; slope = r.H / r.L; }
    }
  }
  return { h, slope };
}
// one big ramp at the end of the runway
addRamp(0, 40, 0, 24, 13, 8, 0xe8a33d);

// Reinforced neon crash rails keep ground driving on the launch approach.
{
  const railMat = new THREE.MeshStandardMaterial({ color: 0x243547, metalness: 0.82, roughness: 0.28 });
  const cyan = new THREE.MeshStandardMaterial({ color: 0x25edff, emissive: 0x00cfff, emissiveIntensity: 3.2, metalness: 0.35, roughness: 0.25 });
  const magenta = new THREE.MeshStandardMaterial({ color: 0xff39dc, emissive: 0xff16c7, emissiveIntensity: 2.2, metalness: 0.35, roughness: 0.25 });
  const postGeometry = new THREE.BoxGeometry(0.42, 1.8, 0.5);
  const beamGeometry = new THREE.CylinderGeometry(0.13, 0.13, 1, 10);
  const align = new THREE.Quaternion();
  const placeBeam = (a: THREE.Vector3, b: THREE.Vector3, material: THREE.Material, radiusScale = 1) => {
    const delta = new THREE.Vector3().subVectors(b, a);
    const beam = new THREE.Mesh(beamGeometry, material);
    beam.position.copy(a).add(b).multiplyScalar(0.5);
    beam.quaternion.copy(align.setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.clone().normalize()));
    beam.scale.set(radiusScale, delta.length(), radiusScale);
    beam.castShadow = true;
    scene.add(beam);
  };
  for (const side of [-1, 1]) {
    const x = side * 8.4;
    for (const y of [0.52, 1.42]) {
      placeBeam(new THREE.Vector3(x, y, -108), new THREE.Vector3(x, y, 40), y > 1 ? cyan : railMat, y > 1 ? 0.78 : 1);
    }
    for (let z = -108; z <= 36; z += 8) {
      const post = new THREE.Mesh(postGeometry, railMat);
      post.position.set(x, 0.92, z);
      post.castShadow = true;
      scene.add(post);
      const marker = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.12, 0.54), magenta);
      marker.position.set(x, 1.78, z);
      scene.add(marker);
    }
    const rampX = side * 7.15;
    for (const heightOffset of [0.58, 1.34]) {
      placeBeam(
        new THREE.Vector3(rampX, heightOffset, 40),
        new THREE.Vector3(rampX, 8 + heightOffset, 64),
        heightOffset > 1 ? cyan : railMat,
        heightOffset > 1 ? 0.78 : 1,
      );
    }
    for (let z = 40; z <= 64; z += 4) {
      const rampY = ((z - 40) / 24) * 8;
      const post = new THREE.Mesh(postGeometry, railMat);
      post.position.set(rampX, rampY + 0.92, z);
      post.rotation.x = -Math.atan2(8, 24);
      post.castShadow = true;
      scene.add(post);
      const marker = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.12, 0.54), magenta);
      marker.position.set(rampX, rampY + 1.78, z);
      marker.rotation.x = -Math.atan2(8, 24);
      scene.add(marker);
    }
  }

  // Paved, illuminated staging plaza around the start line.
  const plazaTexture = canvasTex(256, 256, c => {
    noise(c, 256, 256, 72, 18, 1800);
    c.strokeStyle = 'rgba(96,150,176,.4)';
    c.lineWidth = 3;
    for (let y = 0; y < 256; y += 64) { c.beginPath(); c.moveTo(0, y); c.lineTo(256, y); c.stroke(); }
    for (let x = 0; x < 256; x += 64) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, 256); c.stroke(); }
  }, 2, 4);
  const plaza = new THREE.Mesh(
    new THREE.PlaneGeometry(34, 164).rotateX(-Math.PI / 2),
    new THREE.MeshStandardMaterial({ map: plazaTexture, roughness: 0.82, metalness: 0.12 }),
  );
  plaza.position.set(0, 0.025, -30);
  plaza.receiveShadow = true;
  scene.add(plaza);
  for (const side of [-1, 1]) {
    const curb = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.12, 158), cyan);
    curb.position.set(side * 11.5, 0.09, -32);
    scene.add(curb);
  }
  const gateMaterial = new THREE.MeshStandardMaterial({ color: 0x17283a, metalness: 0.75, roughness: 0.3 });
  const gateGlow = new THREE.MeshStandardMaterial({ color: 0xff42de, emissive: 0xe500b8, emissiveIntensity: 3.5 });
  const gate = new THREE.Group();
  for (const x of [-9.6, 9.6]) {
    const pillar = new THREE.Mesh(new THREE.BoxGeometry(1.1, 10, 1.4), gateMaterial);
    pillar.position.set(x, 5, -24);
    pillar.castShadow = true;
    gate.add(pillar);
    const light = new THREE.Mesh(new THREE.BoxGeometry(0.16, 8.8, 1.48), gateGlow);
    light.position.set(x - Math.sign(x) * 0.48, 5, -24);
    gate.add(light);
  }
  const lintel = new THREE.Mesh(new THREE.BoxGeometry(20.4, 1.2, 1.8), gateMaterial);
  lintel.position.set(0, 10.1, -24);
  gate.add(lintel);
  const lintelGlow = new THREE.Mesh(new THREE.BoxGeometry(18.5, 0.2, 1.9), cyan);
  lintelGlow.position.set(0, 9.5, -24);
  gate.add(lintelGlow);
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(11, 2.5), new THREE.MeshBasicMaterial({
    map: canvasTex(512, 128, c => {
      c.fillStyle = '#101724'; c.fillRect(0, 0, 512, 128);
      c.strokeStyle = '#27eaff'; c.lineWidth = 6; c.strokeRect(4, 4, 504, 120);
      c.fillStyle = '#ffffff'; c.font = '900 46px Arial'; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillText('NEON CITY  //  LAUNCH', 256, 65);
    }),
    side: THREE.DoubleSide,
  }));
  sign.position.set(0, 7.9, -22.98);
  gate.add(sign);
  scene.add(gate);
}

interface CoinSpot { x: number; y: number; z: number; value: number; t: number; }
const coinSpots: CoinSpot[] = [];
// ---------- scenery ----------
const nearRamp = (x: number, z: number, m: number) => ramps.some(r => Math.hypot(x - r.x, z - r.z) < r.L + m);
{
  const corridor = (x: number, z: number, w: number) => Math.abs(x) < w && z > -80 && z < 2200;
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), ps = new THREE.Vector3(), col = new THREE.Color();
  const bark = canvasTex(64, 128, c => { noise(c, 64, 128, 110, 40, 500); c.strokeStyle = 'rgba(0,0,0,.35)'; for (let i = 0; i < 10; i++) { c.beginPath(); c.moveTo(rnd(0, 64), 0); c.lineTo(rnd(0, 64), 128); c.stroke(); } });
  const foliage = canvasTex(128, 128, c => noise(c, 128, 128, 200, 55, 1500), 2, 2);
  const barkM = new THREE.MeshStandardMaterial({ map: bark, color: 0x7a5636, roughness: 1 });
  const leafM = () => new THREE.MeshStandardMaterial({ map: foliage, roughness: 0.85, flatShading: true });
  // forest: pines (stacked tiers), oaks (blobby canopy), birches, bushes, rocks, flowers
  const place = (count: number, minD: number, maxD: number, fn: (i: number, x: number, z: number, s: number) => void) => {
    let n = 0, guard = 0;
    while (n < count && guard++ < count * 20) {
      const a2 = rnd(0, 6.283), d = rnd(minD, maxD), x = Math.cos(a2) * d, z = Math.sin(a2) * d;
      if (nearRamp(x, z, 20) || corridor(x, z, 26) || Math.hypot(x, z) < 360) continue;
      fn(n++, x, z, rnd(0.7, 1.9));
    }
  };
  const mkInst = (g: THREE.BufferGeometry, mat: THREE.Material, n: number, shadow = true) => { const im = new THREE.InstancedMesh(g, mat, n); im.castShadow = shadow; im.receiveShadow = true; scene.add(im); return im; };
  const setI = (im: THREE.InstancedMesh, i: number, x: number, y: number, z: number, sx: number, sy: number, rotY: number, hue?: [number, number, number]) => {
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rotY); m.compose(ps.set(x, y, z), q, sc.set(sx, sy, sx)); im.setMatrixAt(i, m);
    if (hue) { col.setHSL(hue[0] + rnd(-0.03, 0.03), hue[1], hue[2] + rnd(-0.08, 0.08)); im.setColorAt(i, col); }
  };
  // pines
  const NP = 360;
  const pTrunk = mkInst(new THREE.CylinderGeometry(0.35, 0.6, 5, 7).translate(0, 2.5, 0), barkM, NP);
  const tiers = [new THREE.ConeGeometry(3.6, 4.2, 9).translate(0, 5.2, 0), new THREE.ConeGeometry(2.8, 3.8, 9).translate(0, 7.4, 0), new THREE.ConeGeometry(1.9, 3.4, 9).translate(0, 9.4, 0), new THREE.ConeGeometry(1.0, 2.6, 9).translate(0, 11.3, 0)];
  const pT = tiers.map(g => mkInst(g, leafM(), NP));
  place(NP, 40, 1700, (i, x, z, s) => { const r = rnd(0, 6.28); setI(pTrunk, i, x, 0, z, s, s, r); pT.forEach(t => setI(t, i, x, 0, z, s, s, r, [0.36, 0.5, 0.22])); });
  // oaks
  const NO = 180;
  const oTrunk = mkInst(new THREE.CylinderGeometry(0.5, 0.85, 4.5, 8).translate(0, 2.2, 0), barkM, NO);
  const canopyG = new THREE.IcosahedronGeometry(3, 1);
  const blobs = [canopyG.clone().translate(0, 6.2, 0), new THREE.IcosahedronGeometry(2.2, 1).translate(1.9, 5.3, 0.6), new THREE.IcosahedronGeometry(2.3, 1).translate(-1.7, 5.5, -0.9), new THREE.IcosahedronGeometry(1.9, 1).translate(0.3, 7.9, -0.4)];
  const oB = blobs.map(g => mkInst(g, leafM(), NO));
  place(NO, 40, 1500, (i, x, z, s) => { const r = rnd(0, 6.28); setI(oTrunk, i, x, 0, z, s, s, r); oB.forEach(t => setI(t, i, x, 0, z, s, s, r, [rnd(0.22, 0.3), 0.55, 0.36])); });
  // birches
  const NB = 90;
  const bTrunk = mkInst(new THREE.CylinderGeometry(0.22, 0.3, 7, 6).translate(0, 3.5, 0), new THREE.MeshStandardMaterial({ color: 0xe8e4da, roughness: 0.8 }), NB);
  const bTop = mkInst(new THREE.IcosahedronGeometry(2, 1).translate(0, 7.8, 0), leafM(), NB);
  place(NB, 40, 1200, (i, x, z, s) => { const r = rnd(0, 6.28); setI(bTrunk, i, x, 0, z, s, s, r); setI(bTop, i, x, 0, z, s, s, r, [0.2, 0.6, 0.5]); });
  // bushes, rocks, flowers
  const NS = 260;
  const bush = mkInst(new THREE.IcosahedronGeometry(1, 1).translate(0, 0.6, 0), leafM(), NS);
  place(NS, 20, 1300, (i, x, z, s) => setI(bush, i, x, 0, z, s * 0.9, s * 0.7, rnd(0, 6), [0.3, 0.55, 0.3]));
  const NR = 250;
  const rock = mkInst(new THREE.DodecahedronGeometry(1, 0).translate(0, 0.4, 0), new THREE.MeshStandardMaterial({ color: 0x8a8d94, roughness: 1, flatShading: true }), NR);
  place(NR, 25, 1500, (i, x, z, s) => setI(rock, i, x, 0, z, s * 1.4, s * 0.9, rnd(0, 6), [0.6, 0.05, 0.5]));
  const NF = 650;
  const flw = mkInst(new THREE.SphereGeometry(0.22, 6, 5).translate(0, 0.5, 0), new THREE.MeshStandardMaterial({ roughness: 0.6, emissive: 0x222222 }), NF, false);
  place(NF, 8, 600, (i, x, z) => { setI(flw, i, x, 0, z, 1, 1, 0); col.setHSL(rnd(0, 1), 0.9, 0.6); flw.setColorAt(i, col); });

  // runway-side lamps, banners and grandstand
  for (const sx of [-1, 1]) for (let k = 0; k < 8; k++) {
    const gr = new THREE.Group(); gr.position.set(sx * 10, 0, -70 + k * 16);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.14, 7, 8), new THREE.MeshStandardMaterial({ color: 0xcccccc, metalness: 0.8, roughness: 0.3 })); pole.position.y = 3.5; pole.castShadow = true;
    const arm = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.1, 0.1), pole.material); arm.position.set(-sx * 0.8, 7, 0);
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.12, 0.4), new THREE.MeshStandardMaterial({ color: 0xfff2c0, emissive: 0xfff2c0, emissiveIntensity: 4 })); lamp.position.set(-sx * 1.5, 6.95, 0);
    gr.add(pole, arm, lamp); scene.add(gr);
  }
  const banner = new THREE.Mesh(new THREE.PlaneGeometry(22, 4), new THREE.MeshStandardMaterial({ map: canvasTex(512, 96, c => { c.fillStyle = '#d6002a'; c.fillRect(0, 0, 512, 96); c.fillStyle = '#fff'; c.font = '900 44px "Trebuchet MS",Arial'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('+1 HEIGHT • TESLA', 256, 50); }), emissive: 0x330000, side: THREE.DoubleSide }));
  banner.position.set(0, 9, -52); scene.add(banner);
  for (const sx of [-1, 1]) { const st = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.25, 9, 8), new THREE.MeshStandardMaterial({ color: 0xcccccc, metalness: 0.8, roughness: 0.3 })); st.position.set(sx * 11, 4.5, -52); st.castShadow = true; scene.add(st); }

  // ---- epic city skyline ----
  const winTex = (hue: number) => canvasTex(128, 256, c => {
    c.fillStyle = '#10131c'; c.fillRect(0, 0, 128, 256);
    for (let y = 4; y < 252; y += 10) for (let x = 4; x < 124; x += 9) {
      const on = Math.random() < 0.55;
      c.fillStyle = on ? `hsl(${hue + rnd(-15, 15)},${rnd(60, 100)}%,${rnd(55, 80)}%)` : '#1b2030'; c.fillRect(x, y, 5, 6);
    }
  });
  const winSets = [30, 45, 200, 190, 300].map(h => { const t = winTex(h); return new THREE.MeshStandardMaterial({ map: t, emissiveMap: t, emissive: 0xffffff, emissiveIntensity: 1.1, roughness: 0.35, metalness: 0.6 }); });
  const roofM = new THREE.MeshStandardMaterial({ color: 0x20242e, roughness: 0.6, metalness: 0.5 });
  const neon = [0xff3bd4, 0x35f0ff, 0xffd23a, 0x7aff6a];
  // Dense low-rise blocks make the launch plaza feel embedded in the city.
  let districtCount = 0, districtGuard = 0;
  while (districtCount < 70 && districtGuard++ < 1600) {
    const a2 = rnd(0, 6.283), d = rnd(250, 560);
    const x = Math.cos(a2) * d, z = Math.sin(a2) * d;
    if (corridor(x, z, 100)) continue;
    const w = rnd(18, 34), depth = rnd(18, 38), h = rnd(28, 92);
    const block = new THREE.Mesh(new THREE.BoxGeometry(w, h, depth), winSets[Math.floor(rnd(0, winSets.length))]);
    block.position.set(x, h / 2, z);
    block.rotation.y = rnd(0, Math.PI);
    block.castShadow = true;
    scene.add(block);
    const roof = new THREE.Mesh(new THREE.BoxGeometry(w * 0.68, rnd(3, 7), depth * 0.7), roofM);
    roof.position.set(0, h / 2 + rnd(3, 7), 0);
    block.add(roof);
    if (Math.random() < 0.4) {
      const hue = neon[Math.floor(rnd(0, neon.length))];
      const sign = new THREE.Mesh(new THREE.BoxGeometry(w * 0.72, 1.4, 0.45), new THREE.MeshStandardMaterial({ color: hue, emissive: hue, emissiveIntensity: 3.5 }));
      sign.position.set(0, -h * 0.2, depth * 0.51);
      block.add(sign);
    }
    districtCount++;
  }
  let nb = 0, guard = 0;
  while (nb < 220 && guard++ < 5000) {
    const a2 = rnd(0, 6.283), d = rnd(650, 1900), x = Math.cos(a2) * d, z = Math.sin(a2) * d;
    if (corridor(x, z, 90)) continue;
    const dd = d / 1900;
    const w = rnd(24, 60), dpt = rnd(24, 60), h = rnd(60, 220) * (1.25 - dd * 0.4) * (Math.random() < 0.12 ? 2.2 : 1);
    const g = new THREE.BoxGeometry(w, h, dpt); g.translate(0, h / 2, 0);
    const uv = g.attributes.uv as THREE.BufferAttribute;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * w / 28, uv.getY(i) * h / 28);
    const b = new THREE.Mesh(g, winSets[Math.floor(rnd(0, winSets.length))]);
    b.position.set(x, 0, z); b.rotation.y = rnd(0, 1.5); scene.add(b);
    // setback crown + antenna + beacon
    const cw = w * 0.6, ch = h * 0.12;
    const crown = new THREE.Mesh(new THREE.BoxGeometry(cw, ch, dpt * 0.6), roofM); crown.position.set(0, h + ch / 2, 0); b.add(crown);
    if (h > 120) {
      const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.8, h * 0.25, 6), roofM); ant.position.set(0, h + ch + h * 0.12, 0); b.add(ant);
      const bc = new THREE.Mesh(new THREE.SphereGeometry(1.6, 8, 6), new THREE.MeshStandardMaterial({ color: 0xff2020, emissive: 0xff2020, emissiveIntensity: 6 })); bc.position.set(0, h + ch + h * 0.25, 0); b.add(bc);
    }
    if (Math.random() < 0.3) {
      const nc = neon[Math.floor(rnd(0, neon.length))];
      const strip = new THREE.Mesh(new THREE.BoxGeometry(w + 0.6, 1.2, dpt + 0.6), new THREE.MeshStandardMaterial({ color: nc, emissive: nc, emissiveIntensity: 4 })); strip.position.set(0, h * rnd(0.5, 0.95), 0); b.add(strip);
    }
    nb++;
  }
  // giant Tesla tower landmark
  {
    const g = new THREE.Group(); g.position.set(-260, 0, 900);
    const tower = new THREE.Mesh(new THREE.CylinderGeometry(14, 24, 420, 24, 1), new THREE.MeshStandardMaterial({ color: 0x0c1118, metalness: 1, roughness: 0.1 })); tower.position.y = 210; g.add(tower);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(26, 2, 8, 40), new THREE.MeshStandardMaterial({ color: 0xff2030, emissive: 0xff2030, emissiveIntensity: 3 })); ring.rotation.x = Math.PI / 2; ring.position.y = 300; g.add(ring);
    const t = makeT(90, 0xff2030); (t.material as THREE.MeshStandardMaterial).emissive.set(0xff2030); (t.material as THREE.MeshStandardMaterial).emissiveIntensity = 2.5; t.position.set(0, 470, 0); t.rotation.y = -0.25; g.add(t);
    scene.add(g);
  }

  // ---- layered mountain ranges with snow caps and haze ----
  const mtnM = (c: number) => new THREE.MeshStandardMaterial({ color: c, roughness: 1, flatShading: true });
  const snow = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.8, flatShading: true });
  const layers: [number, number, number, number][] = [[2300, 0x5c6e8e, 40, 500], [3000, 0x4a5a80, 36, 750], [3800, 0x3b4a74, 30, 1000]];
  for (const [rad, c, cnt, hmax] of layers) for (let i = 0; i < cnt; i++) {
    const a2 = (i / cnt) * 6.283 + rnd(-0.05, 0.05), h = rnd(hmax * 0.45, hmax), r = h * rnd(0.55, 0.9);
    const g = new THREE.ConeGeometry(r, h, 7, 3); const pos = g.attributes.position;
    for (let k = 0; k < pos.count; k++) { const f = 1 - pos.getY(k) / h + 0.5; pos.setX(k, pos.getX(k) + rnd(-1, 1) * r * 0.06 * f); pos.setZ(k, pos.getZ(k) + rnd(-1, 1) * r * 0.06 * f); }
    g.computeVertexNormals();
    const mt = new THREE.Mesh(g, mtnM(c)); mt.position.set(Math.cos(a2) * rad, h / 2 - 5, Math.sin(a2) * rad); mt.castShadow = false; scene.add(mt);
    const cap = new THREE.Mesh(new THREE.ConeGeometry(r * 0.3, h * 0.3, 7), snow); cap.position.set(mt.position.x, h * 0.85 - 5, mt.position.z); scene.add(cap);
  }
  // distant lake
  const lake = new THREE.Mesh(new THREE.CircleGeometry(260, 48).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x2a7bd0, metalness: 0.9, roughness: 0.08 }));
  lake.position.set(420, 0.15, 500); scene.add(lake);
}

// ---------- coins ----------
// runway coins, then coin gates climbing the sky above the flight path
for (let k = 0; k < 6; k++) coinSpots.push({ x: 0, y: 1.4, z: -20 + k * 8, value: 3, t: 0 });
for (let i = 0; i < 16; i++) {
  const y = 14 * Math.pow(1.55, i), z = 80 + i * 55;
  for (const x of [-8, 0, 8]) coinSpots.push({ x, y, z, value: Math.floor(6 * Math.pow(1.5, i)), t: 0 });
}
const COIN_MAX = coinSpots.length;
const coinMesh = new THREE.InstancedMesh(
  new THREE.CylinderGeometry(1, 1, 0.25, 20).rotateX(Math.PI / 2),
  new THREE.MeshStandardMaterial({ color: 0xffd23a, emissive: 0xffa800, emissiveIntensity: 1.4, metalness: 0.7, roughness: 0.3 }),
  COIN_MAX,
);
coinMesh.frustumCulled = false;
scene.add(coinMesh);
const hidden = new THREE.Matrix4().makeScale(0, 0, 0);
const tmpM = new THREE.Matrix4(), tmpQ = new THREE.Quaternion(), tmpS = new THREE.Vector3(1.3, 1.3, 1.3), tmpP = new THREE.Vector3(), UP = new THREE.Vector3(0, 1, 0);

// ---------- car ----------
const carRoot = new THREE.Group();   // position + yaw
const carTilt = new THREE.Group();   // pitch
carTilt.rotation.order = 'YXZ';
carRoot.add(carTilt);
scene.add(carRoot);
const shadow = new THREE.Mesh(new THREE.CircleGeometry(2.4, 20).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0, transparent: true, opacity: 0.35, depthWrite: false }));
scene.add(shadow);

function box(w: number, h: number, d: number, color: number, x = 0, y = 0, z = 0, emissive = false): THREE.Mesh {
  const mat = emissive ? new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 4 }) : new THREE.MeshStandardMaterial({ color, metalness: 0.5, roughness: 0.35 });
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  return m;
}

// Tesla "T" emblem: arched cap over a tapered stem
function makeT(size: number, color = 0xdddddd): THREE.Mesh {
  // Realistic Tesla T logo - sleek and modern
  const sh = new THREE.Shape();
  // Top rounded horizontal bar
  sh.moveTo(-0.95, 0.82); sh.quadraticCurveTo(-0.6, 0.95, -0.3, 0.95);
  sh.lineTo(0.3, 0.95); sh.quadraticCurveTo(0.6, 0.95, 0.95, 0.82);
  sh.lineTo(0.85, 0.68); sh.quadraticCurveTo(0.55, 0.78, 0.3, 0.78);
  sh.lineTo(-0.3, 0.78); sh.quadraticCurveTo(-0.55, 0.78, -0.85, 0.68);
  sh.closePath();
  
  // Vertical stem
  const stem = new THREE.Shape();
  stem.moveTo(-0.18, 0.68); stem.lineTo(0.18, 0.68);
  stem.lineTo(0.15, -0.05); stem.quadraticCurveTo(0.1, -0.15, 0, -0.15); stem.quadraticCurveTo(-0.1, -0.15, -0.15, -0.05);
  stem.closePath();
  
  const ga = new THREE.ExtrudeGeometry([sh, stem], { depth: 0.07, bevelEnabled: false });
  ga.translate(0, -0.55, 0).scale(size, size, size);
  return new THREE.Mesh(ga, new THREE.MeshStandardMaterial({ color, metalness: 0.95, roughness: 0.08, emissive: color, emissiveIntensity: 0.2 }));
}
const tTex = canvasTex(512, 96, c => {
  c.clearRect(0, 0, 512, 96); c.fillStyle = '#e6e8ee'; c.font = '900 64px "Trebuchet MS", Arial'; c.textAlign = 'center'; c.textBaseline = 'middle';
  const word = 'TESLA'; let x = 256 - (word.length - 1) * 48;
  for (const ch of word) { c.fillText(ch, x, 52); x += 96; }
});

const wheelSpins: { g: THREE.Object3D; dir: number; r: number }[] = [];
const rocketFlames: { mesh: THREE.Mesh; core: THREE.Mesh; light: THREE.PointLight; phase: number }[] = [];

function addCybertruckDetails(root: THREE.Group, spec: VehicleAssetSpec, center: THREE.Vector3, minY: number) {
  const frame = new THREE.Group();
  frame.position.copy(center).applyAxisAngle(new THREE.Vector3(0, 1, 0), -spec.yaw);
  frame.position.y = minY;
  frame.rotation.y = -spec.yaw;
  root.add(frame);

  const steel = new THREE.MeshStandardMaterial({ color: 0x9ba3ae, metalness: 0.92, roughness: 0.24, envMapIntensity: 1.35 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x090d12, metalness: 0.48, roughness: 0.38 });
  const red = new THREE.MeshStandardMaterial({ color: 0xff263f, emissive: 0xc20c2b, emissiveIntensity: 2.6 });
  const white = new THREE.MeshStandardMaterial({ color: 0xdff6ff, emissive: 0x8cddff, emissiveIntensity: 3.4 });
  const add = <T extends THREE.Object3D>(object: T): T => {
    if (object instanceof THREE.Mesh) object.castShadow = object.receiveShadow = true;
    frame.add(object);
    return object;
  };

  add(box(1.72, 0.055, 0.045, 0xdff6ff, 0, 0.88, 2.84, true)).material = white;
  add(box(1.82, 0.16, 0.24, 0x171c23, 0, 0.48, 2.8)).material = dark;
  add(box(1.7, 0.05, 0.05, 0xff263f, 0, 0.9, -2.82, true)).material = red;
  add(box(1.8, 0.14, 0.22, 0x171c23, 0, 0.46, -2.78)).material = dark;
  add(box(1.45, 0.045, 1.18, 0x171c23, 0, 1.37, -1.56)).material = dark;
  add(box(1.46, 0.018, 1.12, 0x64717d, 0, 1.4, -1.56)).material = steel;

  for (const sx of [-1, 1]) {
    add(box(0.075, 0.11, 2.05, 0x151a20, sx * 1.08, 0.38, -0.16)).material = dark;
    add(box(0.018, 0.035, 0.22, 0xb7c0ca, sx * 1.13, 1.12, 0.32)).material = steel;
    add(box(0.19, 0.09, 0.16, 0x171c23, sx * 1.12, 1.44, 0.78)).material = dark;
    add(box(0.11, 0.035, 0.08, 0xdff6ff, sx * 1.16, 1.43, 0.79, true)).material = white;
    for (const z of [1.02, 0.08, -0.9]) add(box(0.016, 0.66, 0.016, 0x424b55, sx * 1.1, 1.0, z)).material = steel;
    add(box(0.016, 0.04, 0.19, 0x07090c, sx * 1.11, 1.16, 0.26)).material = dark;
    for (const z of [-1.78, 1.78]) {
      const arch = new THREE.Mesh(new THREE.TorusGeometry(0.57, 0.035, 8, 28), dark);
      arch.rotation.y = Math.PI / 2;
      arch.position.set(sx * 1.09, 0.62, z);
      add(arch);
    }
  }

  const frontT = makeT(0.16, 0xe5edf6);
  frontT.position.set(0, 0.97, 2.86);
  add(frontT);
  const rearWord = new THREE.Mesh(new THREE.PlaneGeometry(0.82, 0.15), new THREE.MeshBasicMaterial({ map: tTex, transparent: true, depthWrite: false }));
  rearWord.position.set(0, 0.77, -2.86);
  rearWord.rotation.y = Math.PI;
  add(rearWord);
}

interface VehicleAssetSpec { path: string; length: number; yaw: number; pitch?: number; }
const VEHICLE_ASSETS: Record<string, VehicleAssetSpec> = {
  highland: { path: `${BASE_URL}models/highland/model.glb`, length: 4.72, yaw: -Math.PI / 2 },
  modelS: { path: `${BASE_URL}models/model-s/scene.gltf`, length: 4.97, yaw: 0 },
  modelY: { path: `${BASE_URL}models/model-y/model.glb`, length: 4.794, yaw: Math.PI },
  modelX: { path: `${BASE_URL}models/model-x/model.glb`, length: 5.06, yaw: 0 },
  cybertruck: { path: `${BASE_URL}models/cybertruck/model.glb`, length: 5.683, yaw: Math.PI },
  saturnV: { path: `${BASE_URL}models/rocket/saturn-v.glb`, length: 5.8, yaw: 0, pitch: Math.PI / 2 },
};
const VEHICLE_ASSET_NAMES: Record<string, string> = {
  highland: '2024 Model 3 Highland',
  modelS: 'heritage Model S',
  modelY: '2025 Model Y Juniper',
  modelX: 'pre-refresh Model X',
  cybertruck: '2025 Cybertruck',
  saturnV: 'NASA Saturn V rocket',
};
const VEHICLE_ASSET_BY_ID: Record<string, string> = {
  m3: 'highland',
  ms: 'modelS',
  my: 'modelY',
  mx: 'modelX',
  ct: 'cybertruck',
  gt: 'modelS',
  nt: 'cybertruck',
  ss: 'highland',
  lt: 'modelX',
  cx: 'saturnV',
};
const vehicleAssetLoader = new GLTFLoader();
vehicleAssetLoader.setMeshoptDecoder(MeshoptDecoder);
const vehicleAssetTemplates = new Map<string, Promise<THREE.Group>>();
let activeVehicleModelRequest = 0;
let vehicleAssetLoadQueue: Promise<void> = Promise.resolve();

function loadVehicleAsset(assetId: string): Promise<THREE.Group> {
  let template = vehicleAssetTemplates.get(assetId);
  if (!template) {
    const spec = VEHICLE_ASSETS[assetId];
    const loading = vehicleAssetLoadQueue.then(() => vehicleAssetLoader.loadAsync(spec.path)).then(({ scene: source }) => {
      source.traverse(object => {
        const mesh = object as THREE.Mesh;
        if (!mesh.isMesh) return;
        const indexCount = mesh.geometry.index?.count ?? mesh.geometry.getAttribute('position').count;
        if (assetId === 'cybertruck' && indexCount <= 144) {
          mesh.visible = false;
          return;
        }
        if (assetId === 'cybertruck') {
          const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
          mesh.material = materials.map(material => {
            const refined = material.clone();
            if (refined instanceof THREE.MeshStandardMaterial) {
              refined.color.set(0xb9c3cc);
              refined.metalness = 0.72;
              refined.roughness = 0.28;
              refined.envMapIntensity = 1.1;
            }
            return refined;
          });
        }
        mesh.castShadow = true;
        mesh.receiveShadow = true;
      });
      const fitted = new THREE.Group();
      fitted.add(source);
      fitted.rotation.set(spec.pitch ?? 0, spec.yaw, 0);
      fitted.updateMatrixWorld(true);
      const bounds = new THREE.Box3().setFromObject(fitted);
      if (bounds.isEmpty()) throw new Error(`Vehicle model has no geometry: ${spec.path}`);
      const size = bounds.getSize(new THREE.Vector3());
      const center = bounds.getCenter(new THREE.Vector3());
      const scale = spec.length / Math.max(size.x, size.z);
      fitted.scale.setScalar(scale);
      fitted.position.set(-center.x * scale, -bounds.min.y * scale, -center.z * scale);
      fitted.name = `sourced-${assetId}`;
      fitted.userData.assetFrame = { yaw: spec.yaw, center: center.toArray(), minY: bounds.min.y };
      if (assetId === 'cybertruck') addCybertruckDetails(fitted, spec, center, bounds.min.y);
      return fitted;
    });
    vehicleAssetLoadQueue = loading.then(() => undefined, () => undefined);
    template = loading.catch(error => {
      vehicleAssetTemplates.delete(assetId);
      throw error;
    });
    vehicleAssetTemplates.set(assetId, template);
  }
  return template.then(model => model.clone(true));
}

function addVehicleGlow(group: THREE.Group, v: Vehicle) {
  const glow = new THREE.PointLight(v.accent, 4, 12);
  glow.position.set(0, 0.8, 0);
  group.add(glow);
}
function addRocketPack(group: THREE.Group, v: Vehicle, animate = true) {
  const mount = new THREE.Group();
  const assetFrame = group.userData.assetFrame as { yaw: number; center: [number, number, number]; minY: number } | undefined;
  if (assetFrame) {
    mount.position.set(...assetFrame.center).applyAxisAngle(new THREE.Vector3(0, 1, 0), -assetFrame.yaw);
    mount.position.y = assetFrame.minY;
    mount.rotation.y = -assetFrame.yaw;
  }
  group.add(mount);
  const shell = new THREE.MeshPhysicalMaterial({ color: 0x77818d, metalness: 0.94, roughness: 0.2, clearcoat: 0.8 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x11151b, metalness: 0.72, roughness: 0.27 });
  const hot = new THREE.MeshStandardMaterial({ color: v.accent, emissive: v.accent, emissiveIntensity: 2.8, metalness: 0.35, roughness: 0.22 });
  const plumeMaterial = new THREE.MeshBasicMaterial({ color: v.accent, transparent: true, opacity: 0.84, blending: THREE.AdditiveBlending, depthWrite: false });
  const coreMaterial = new THREE.MeshBasicMaterial({ color: 0xdff8ff, transparent: true, opacity: 0.92, blending: THREE.AdditiveBlending, depthWrite: false });
  for (const sx of [-1, 1]) {
    const x = sx * 0.54;
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.3, 1.42, 16).rotateX(Math.PI / 2), shell);
    body.position.set(x, 0.56, -2.58);
    body.castShadow = true;
    mount.add(body);

    const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.37, 0.22, 16).rotateX(Math.PI / 2), dark);
    collar.position.set(x, 0.56, -3.34);
    mount.add(collar);
    const nozzle = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.28, 0.34, 16).rotateX(Math.PI / 2), dark);
    nozzle.position.set(x, 0.56, -3.57);
    mount.add(nozzle);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.205, 0.035, 10, 24), hot);
    rim.position.set(x, 0.56, -3.75);
    mount.add(rim);
    for (const fin of [-1, 1]) {
      const vane = box(0.07, 0.34, 0.54, v.accent, x + fin * 0.3, 0.55, -2.74);
      vane.material = hot;
      vane.rotation.z = fin * 0.22;
      mount.add(vane);
    }
    const plume = new THREE.Mesh(new THREE.ConeGeometry(0.31, 1.2, 14).rotateX(-Math.PI / 2), plumeMaterial);
    plume.position.set(x, 0.56, -4.27);
    plume.visible = !animate;
    mount.add(plume);
    const core = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.82, 12).rotateX(-Math.PI / 2), coreMaterial);
    core.position.set(x, 0.56, -4.08);
    core.visible = !animate;
    mount.add(core);
    const light = new THREE.PointLight(v.accent, animate ? 0 : 2.2, 16);
    light.position.set(x, 0.56, -3.92);
    mount.add(light);
    if (animate) rocketFlames.push({ mesh: plume, core, light, phase: rnd(0, Math.PI * 2) });
  }
}
function addRocketNozzleEffects(group: THREE.Group, v: Vehicle, animate = true) {
  const plumeMaterial = new THREE.MeshBasicMaterial({ color: 0xff762f, transparent: true, opacity: 0.82, blending: THREE.AdditiveBlending, depthWrite: false });
  const coreMaterial = new THREE.MeshBasicMaterial({ color: 0xffedc2, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false });
  const positions: [number, number][] = [[0, 0.48], [-0.17, 0.48], [0.17, 0.48], [0, 0.3], [0, 0.66]];
  for (const [x, y] of positions) {
    const plume = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.9, 12).rotateX(-Math.PI / 2), plumeMaterial);
    plume.position.set(x, y, -3.27);
    plume.visible = !animate;
    group.add(plume);
    const core = new THREE.Mesh(new THREE.ConeGeometry(0.065, 0.62, 10).rotateX(-Math.PI / 2), coreMaterial);
    core.position.set(x, y, -3.14);
    core.visible = !animate;
    group.add(core);
    const light = new THREE.PointLight(v.accent, animate ? 0 : 2.4, 12);
    light.position.set(x, y, -2.95);
    group.add(light);
    if (animate) rocketFlames.push({ mesh: plume, core, light, phase: rnd(0, Math.PI * 2) });
  }
}
interface Spec {
  W: number; R: number; wz: number; smooth: boolean; flat?: boolean; metal?: number;
  body: [number, number][]; cabin: [number, number][]; cabinW: number;
  hl: [number, number]; tl: [number, number]; logo: [number, number, number]; txt: [number, number]; wide: number; spoiler?: boolean; sideLine?: [number, number];
}
const SPECS: Record<string, Spec> = {
  sedan: {
    W: 2.0, R: 0.43, wz: 1.5, smooth: true, wide: 1.5,
    body: [[-2.42, 0.4], [-2.48, 0.72], [-2.28, 1.02], [-1.2, 1.1], [0.3, 1.12], [1.5, 1.0], [2.3, 0.8], [2.5, 0.56], [2.36, 0.4], [1.6, 0.3], [-1.6, 0.3]],
    cabin: [[-1.75, 1.06], [-1.05, 1.5], [-0.2, 1.64], [0.65, 1.56], [1.35, 1.08]], cabinW: 1.78,
    hl: [0.76, 2.34], tl: [0.92, -2.4], logo: [0.98, 2.04, 0.18], txt: [0.76, -2.5], sideLine: [-0.55, 0.5],
  },
  suv: {
    W: 2.15, R: 0.5, wz: 1.55, smooth: true, wide: 1.6,
    body: [[-2.4, 0.42], [-2.46, 0.95], [-2.34, 1.18], [-0.5, 1.22], [1.5, 1.08], [2.3, 0.86], [2.46, 0.58], [2.3, 0.42], [1.6, 0.33], [-1.6, 0.33]],
    cabin: [[-2.3, 1.14], [-2.18, 1.78], [-0.2, 1.95], [0.75, 1.85], [1.45, 1.14]], cabinW: 1.95,
    hl: [0.84, 2.36], tl: [1.0, -2.44], logo: [1.0, 2.12, 0.2], txt: [0.86, -2.5], sideLine: [-0.6, 0.6],
  },
  sport: {
    W: 1.95, R: 0.44, wz: 1.4, smooth: true, wide: 1.45, spoiler: true,
    body: [[-2.3, 0.34], [-2.36, 0.62], [-1.9, 0.86], [-0.9, 0.92], [0.3, 0.96], [1.6, 0.78], [2.36, 0.54], [2.42, 0.4], [1.6, 0.27], [-1.6, 0.27]],
    cabin: [[-1.15, 0.9], [-0.55, 1.22], [0.2, 1.3], [0.85, 1.16], [1.35, 0.9]], cabinW: 1.6,
    hl: [0.62, 2.3], tl: [0.78, -2.32], logo: [0.7, 2.1, 0.16], txt: [0.66, -2.37], sideLine: [-0.5, 0.45],
  },
  truck: {
    W: 2.3, R: 0.62, wz: 1.75, smooth: false, flat: true, metal: 1, wide: 1.9,
    body: [[-2.7, 0.5], [-2.7, 1.3], [-0.9, 1.52], [0.3, 1.95], [1.4, 1.5], [2.82, 0.95], [2.82, 0.5]],
    cabin: [[1.55, 1.5], [0.35, 1.9], [-0.55, 1.62], [-0.55, 1.44], [1.2, 1.44]], cabinW: 2.34,
    hl: [0.95, 2.84], tl: [1.3, -2.72], logo: [1.1, 2.84, 0.3], txt: [1.1, -2.73],
  },
};

function profileGeo(pts: [number, number][], depth: number, smooth: boolean, bevel: number): THREE.BufferGeometry {
  let p = pts;
  if (smooth) {
    const cv = new THREE.CatmullRomCurve3(pts.map(([a, b]) => new THREE.Vector3(a, b, 0)), true, 'centripetal');
    p = cv.getPoints(110).map(v => [v.x, v.y] as [number, number]);
  }
  const sh = new THREE.Shape(); sh.moveTo(p[0][0], p[0][1]);
  for (let i = 1; i < p.length; i++) sh.lineTo(p[i][0], p[i][1]);
  sh.closePath();
  const g = new THREE.ExtrudeGeometry(sh, { depth, bevelEnabled: bevel > 0, bevelSize: bevel, bevelThickness: bevel, bevelSegments: 3, curveSegments: 1 });
  g.rotateY(-Math.PI / 2); g.translate(depth / 2, 0, 0);
  return g;
}

function buildTesla(g: THREE.Group, v: Vehicle, sp: Spec, spins: { g: THREE.Object3D; dir: number; r: number }[] = wheelSpins) {
  const bevel = sp.smooth ? 0.08 : 0.035;
  const bodyMat = new THREE.MeshPhysicalMaterial({
    color: v.color, metalness: sp.metal ?? 0.55, roughness: sp.flat ? 0.28 : 0.2, clearcoat: 1, clearcoatRoughness: 0.055, flatShading: false, envMapIntensity: 1.6,
  });
  const glassMat = new THREE.MeshPhysicalMaterial({ color: 0x0b1118, metalness: 0.9, roughness: 0.06, clearcoat: 1, envMapIntensity: 2 });
  const body = new THREE.Mesh(profileGeo(sp.body, sp.W - bevel * 2, sp.smooth, bevel), bodyMat);
  const cabin = new THREE.Mesh(profileGeo(sp.cabin, sp.cabinW - bevel * 2, sp.smooth, sp.smooth ? 0.045 : 0.025), glassMat);
  body.castShadow = cabin.castShadow = true; g.add(body, cabin);
  const hw = sp.W / 2 + bevel;

  // light bars and lamps
  const lampW = sp.wide;
  const tail = box(lampW, 0.07, 0.08, 0xff1f1f, 0, sp.tl[0], sp.tl[1], true);
  g.add(tail);
  for (const sx of [-1, 1]) {
    g.add(box(0.5, 0.075, 0.1, 0xeaf4ff, sx * (sp.W / 2 - 0.4), sp.hl[0], sp.hl[1], true).rotateY(sx * 0.3));
    g.add(box(0.14, 0.14, 0.1, 0xff1f1f, sx * (sp.W / 2 - 0.15), sp.tl[0] - 0.02, sp.tl[1], true));
    // side mirrors
    if (sp.smooth) {
      const mir = box(0.1, 0.1, 0.22, v.color, sx * (hw + 0.07), sp.body[0][1] + 0.7 + (sp.cabin[0][1] - 1.06) * 0.2, 0.9);
      mir.material = bodyMat; g.add(mir);
    }
  }
  if (sp.flat) g.add(box(sp.W - 0.1, 0.08, 0.08, 0xeaf4ff, 0, sp.hl[0], sp.hl[1], true));
  
  // Tesla-specific front end styling
  if (sp.smooth) {
    // Front grille area (Tesla has minimal/no traditional grille but vented intake)
    g.add(box(sp.W * 0.6, 0.12, 0.08, 0x0a0a0c, 0, sp.hl[0] - 0.24, sp.hl[1] + 0.12));
    // Front bumper corner guards
    for (const sx of [-1, 1]) {
      g.add(box(0.15, 0.08, 0.12, 0x1a1a2c, sx * (sp.W / 2 - 0.25), sp.hl[0] - 0.28, sp.hl[1] + 0.15));
    }
  }
  
  // dark lower fascia, rocker panels
  g.add(box(sp.W * 0.9, 0.2, 0.1, 0x0a0a0c, 0, sp.hl[0] - 0.33, sp.hl[1] + 0.06));
  for (const sx of [-1, 1]) g.add(box(0.06, 0.12, sp.wz * 1.5, 0x0a0a0c, sx * (hw - 0.02), sp.R * 0.82, 0));

  // door seams, handles, chrome belt line
  if (sp.smooth) {
    const top = sp.body[2][1];
    for (const sx of [-1, 1]) {
      const x = sx * (hw + 0.005);
      for (const z of [0.55, -0.55, -1.45]) g.add(box(0.012, 0.58, 0.014, 0x0a0a0c, x, 0.8, z));
      // door handles (black/subtle on Tesla)
      for (const z of [0.3, -0.8]) g.add(box(0.02, 0.04, 0.22, 0x1a1a1c, x + sx * 0.005, top - 0.12, z));
      g.add(box(0.014, 0.025, 2.9, 0xc8ccd4, sx * (hw - 0.0), top - 0.01 + (sp.W > 2.1 ? 0.08 : 0), 0));
    }
  }

  if (sp.smooth) {
    const ct = sp.cabin;
    // glass roof panel + A/B pillar trim + roof rails
    g.add(box(sp.cabinW * 0.7, 0.02, 1.2, 0x1a2a3a, 0, ct[2][1] + 0.025, 0.1));
    for (const sx of [-1, 1]) {
      g.add(box(0.03, 0.04, 2.4, 0x0a0a0c, sx * (sp.cabinW / 2 + 0.01), ct[2][1] - 0.35, 0.1));
      // Enhanced projector headlamp system
      const headX = sx * (sp.W / 2 - 0.55);
      const headY = sp.hl[0] - 0.06;
      const headZ = sp.hl[1] - 0.03;
      
      // Main projector lens (brighter blue-white)
      const lens = new THREE.Mesh(new THREE.SphereGeometry(0.085, 14, 11), new THREE.MeshStandardMaterial({ 
        color: 0xffffff, emissive: 0xe8f0ff, emissiveIntensity: 7, transparent: true, opacity: 0.95 
      }));
      lens.position.set(headX, headY, headZ); g.add(lens);
      
      // Headlight ring trim (metallic chrome)
      const headRing = new THREE.Mesh(new THREE.TorusGeometry(0.125, 0.012, 10, 32), new THREE.MeshStandardMaterial({ 
        color: 0xf5f5f5, metalness: 0.85, roughness: 0.15 
      }));
      headRing.rotation.y = Math.PI / 2; headRing.position.set(headX, headY, headZ); g.add(headRing);
      
      // DRL strip (modern horizontal line - signature Tesla style)
      const drl = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.38, 0.055), new THREE.MeshStandardMaterial({ 
        color: 0xb8d8ff, emissive: 0x7fb8ff, emissiveIntensity: 5 
      }));
      drl.position.set(headX, headY - 0.13, headZ); g.add(drl);
      
      // Secondary accent light position
      const fog = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 8), new THREE.MeshStandardMaterial({ 
        color: 0xd4e8ff, emissive: 0x8fb8ff, emissiveIntensity: 4 
      }));
      fog.position.set(headX + sx * 0.15, headY - 0.15, headZ + 0.08); g.add(fog);
      
      // Side marker light (amber/orange reflector)
      const marker = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 6), new THREE.MeshStandardMaterial({
        color: 0xffaa44, emissive: 0xff8844, emissiveIntensity: 3
      }));
      marker.position.set(headX + sx * 0.3, headY - 0.08, headZ - 0.12); g.add(marker);
      // charge port flap + side camera
      g.add(box(0.02, 0.1, 0.12, 0x222428, sx * (hw + 0.012), sp.body[2][1] - 0.08, -2.1));
      g.add(box(0.05, 0.05, 0.08, 0x111111, sx * (hw + 0.02), sp.body[2][1] + 0.05, 1.0));
    }
    // front trunk seam, license plates, rear diffuser
    g.add(box(sp.W * 0.7, 0.01, 0.015, 0x0a0a0c, 0, sp.body[3][1] + 0.01, sp.hl[1] - 0.8));
    g.add(box(0.5, 0.15, 0.02, 0xf2f2f2, 0, sp.hl[0] - 0.32, sp.hl[1] + 0.12));
    g.add(box(0.5, 0.14, 0.02, 0xf2f2f2, 0, sp.tl[0] - 0.22, sp.tl[1] - 0.06));
    g.add(box(sp.W * 0.7, 0.08, 0.3, 0x0a0a0c, 0, 0.34, sp.tl[1] + 0.1));
    // wiper
    g.add(box(0.8, 0.015, 0.03, 0x0a0a0c, 0.1, ct[4][1] + 0.04, 1.28));
  } else {
    for (const sx of [-1, 1]) {
      const sideX = sx * (hw + 0.015);
      g.add(box(0.025, 0.045, 0.28, 0x17191d, sideX, 1.33, 0.1));
      for (const z of [-0.72, -1.65]) {
        g.add(box(0.018, 0.54, 0.014, 0x30343a, sideX, 0.86, z));
        g.add(box(0.035, 0.055, 0.24, 0x4a4f56, sideX, 1.32, z + 0.25));
      }
      g.add(box(0.025, 0.035, 2.8, v.accent, sideX, 0.48, -0.1, true));
      const mirror = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.08, 0.22), bodyMat);
      mirror.position.set(sx * (hw + 0.12), 1.65, 0.95);
      g.add(mirror);
    }
  }
  // Every body gets a panoramic roof highlight and a crisp lower aero edge.
  const roof = new THREE.Mesh(new THREE.BoxGeometry(sp.cabinW * 0.68, 0.024, sp.smooth ? 1.15 : 0.92), glassMat);
  roof.position.set(0, Math.max(...sp.cabin.map(point => point[1])) + 0.025, sp.smooth ? 0.08 : 0.18);
  g.add(roof);
  g.add(box(sp.W * 0.72, 0.035, 0.07, v.accent, 0, 0.42, sp.tl[1] + 0.18, true));
  // T emblems and rear lettering
  const tf = makeT(sp.logo[2], 0xe6e8ee); tf.position.set(0, sp.logo[0], sp.logo[1]); tf.rotation.x = -0.25; g.add(tf);
  const tr = makeT(sp.logo[2] * 0.8, 0xe6e8ee); tr.position.set(0, sp.txt[0] + 0.22, sp.txt[1] - 0.02); tr.rotation.y = Math.PI; g.add(tr);
  
  // Enhanced Tesla word text on rear
  const word = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.17), new THREE.MeshBasicMaterial({ map: tTex, transparent: true, depthWrite: false }));
  word.position.set(0, sp.txt[0] - 0.02, sp.txt[1] - 0.045); word.rotation.y = Math.PI; g.add(word);
  
  // Front T logo area (Tesla badge on front)
  if (sp.smooth) {
    const frontT = makeT(sp.logo[2] * 0.9, 0xcccccc);
    frontT.position.set(0, sp.hl[0] - 0.18, sp.hl[1] + 0.18);
    frontT.rotation.x = -0.35;
    g.add(frontT);
  }
  if (sp.spoiler) {
    const carbon = new THREE.MeshPhysicalMaterial({ color: 0x10141a, metalness: 0.62, roughness: 0.3, clearcoat: 0.8 });
    const wing = box(sp.W * 1.08, 0.075, 0.36, 0x10141a, 0, 1.08, -2.25);
    wing.material = carbon;
    g.add(wing, box(sp.W * 1.02, 0.025, 0.035, v.accent, 0, 1.045, -2.44, true));
    for (const sx of [-1, 1]) {
      const support = box(0.065, 0.26, 0.18, 0x10141a, sx * 0.58, 0.91, -2.22);
      support.material = carbon;
      g.add(support);
      const canard = box(0.36, 0.045, 0.3, 0x10141a, sx * (sp.W * 0.48), 0.43, 2.34);
      canard.material = carbon;
      g.add(canard);
      const skirt = box(0.12, 0.13, 2.35, 0x10141a, sx * (hw + 0.03), 0.34, -0.02);
      skirt.material = carbon;
      g.add(skirt);
      const vent = box(0.025, 0.19, 0.45, 0x080b10, sx * (hw + 0.015), 0.64, -0.12);
      g.add(vent);
      for (let i = 0; i < 3; i++) g.add(box(0.03, 0.018, 0.37, v.accent, sx * (hw + 0.035), 0.59 + i * 0.05, -0.12, true));
      const hoodSlot = box(0.045, 0.018, 0.48, 0x121820, sx * 0.32, 0.89, 1.45);
      hoodSlot.material = carbon;
      g.add(hoodSlot);
    }
    const splitter = box(sp.W * 1.08, 0.085, 0.32, 0x10141a, 0, 0.34, 2.43);
    splitter.material = carbon;
    g.add(splitter);
    const diffuser = box(sp.W * 0.76, 0.12, 0.36, 0x10141a, 0, 0.34, -2.34);
    diffuser.material = carbon;
    g.add(diffuser);
    for (const x of [-0.48, -0.16, 0.16, 0.48]) g.add(box(0.045, 0.2, 0.3, 0x090c11, x, 0.26, -2.35));
  }

  // wheels
  const tireMat = new THREE.MeshStandardMaterial({ color: 0x0c0c0e, roughness: 0.9 });
  const rimMat = new THREE.MeshStandardMaterial({ color: 0xcfd3da, metalness: 1, roughness: 0.18 });
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x15161a, metalness: 0.6, roughness: 0.5 });
  const arch = new THREE.MeshStandardMaterial({ color: 0x050507, roughness: 1 });
  const rotorMat = new THREE.MeshStandardMaterial({ color: 0x717a86, metalness: 0.85, roughness: 0.28 });
  const accentMat = new THREE.MeshStandardMaterial({ color: v.accent, emissive: v.accent, emissiveIntensity: 1.2, metalness: 0.7, roughness: 0.22 });
  const R = sp.R, TW = 0.34;
  for (const sx of [-1, 1]) for (const wz of [sp.wz, -sp.wz]) {
    const pivot = new THREE.Group(); pivot.position.set(sx * (sp.W / 2 - 0.1), R, wz); if (sx < 0) pivot.rotation.y = Math.PI;
    const spin = new THREE.Group(); pivot.add(spin);
    const tire = new THREE.Mesh(new THREE.CylinderGeometry(R, R, TW, 28).rotateZ(Math.PI / 2), tireMat); tire.castShadow = true; spin.add(tire);
    const rotor = new THREE.Mesh(new THREE.CylinderGeometry(R * 0.56, R * 0.56, TW * 0.55, 28).rotateZ(Math.PI / 2), rotorMat);
    spin.add(rotor);
    const rim = new THREE.Mesh(new THREE.CylinderGeometry(R * 0.72, R * 0.72, TW + 0.02, 28).rotateZ(Math.PI / 2), rimMat); spin.add(rim);
    const lip = new THREE.Mesh(new THREE.TorusGeometry(R * 0.68, 0.025, 8, 28), accentMat);
    lip.rotation.y = Math.PI / 2; lip.position.x = TW / 2 + 0.025; spin.add(lip);
    for (let i = 0; i < 6; i++) {
      const slot = new THREE.Group(); slot.rotation.x = (i / 6) * Math.PI * 2;
      const sl = new THREE.Mesh(new THREE.BoxGeometry(0.02, R * 0.38, R * 0.2), darkMat); sl.position.set(TW / 2 + 0.012, R * 0.4, 0); slot.add(sl); spin.add(slot);
      const lug = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.045, 8).rotateZ(Math.PI / 2), rotorMat);
      lug.position.set(TW / 2 + 0.035, Math.cos(i / 6 * Math.PI * 2) * R * 0.24, Math.sin(i / 6 * Math.PI * 2) * R * 0.24);
      spin.add(lug);
    }
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(R * 0.14, R * 0.14, TW + 0.05, 12).rotateZ(Math.PI / 2), darkMat); spin.add(hub);
    const cal = new THREE.Mesh(new THREE.BoxGeometry(0.04, R * 0.35, R * 0.3), new THREE.MeshStandardMaterial({ color: 0xd22a2a })); cal.position.set(TW / 2 - 0.08, -R * 0.45, R * 0.1); pivot.add(cal);
    g.add(pivot);
    spins.push({ g: spin, dir: sx, r: R });
    // dark wheel arch behind the tire
    const ar = new THREE.Mesh(new THREE.CylinderGeometry(R * 1.22, R * 1.22, 0.04, 24).rotateZ(Math.PI / 2), arch);
    ar.position.set(sx * (hw + 0.004), R, wz); g.add(ar);
    if (sp.spoiler) {
      const trim = new THREE.Mesh(new THREE.TorusGeometry(R * 1.12, 0.026, 8, 32), darkMat);
      trim.rotation.y = Math.PI / 2;
      trim.position.set(sx * (hw + 0.045), R, wz);
      g.add(trim);
    }
  }
}

function buildProceduralRocket(g: THREE.Group) {
  const shell = new THREE.MeshPhysicalMaterial({ color: 0xe5e8ed, metalness: 0.24, roughness: 0.3, clearcoat: 0.55 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x151a22, metalness: 0.72, roughness: 0.3 });
  const blue = new THREE.MeshStandardMaterial({ color: 0x1759ba, metalness: 0.32, roughness: 0.3 });
  const stage = (top: number, bottom: number, length: number, z: number, material: THREE.Material) => {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(top, bottom, length, 28).rotateX(Math.PI / 2), material);
    mesh.position.set(0, 0.5, z);
    mesh.castShadow = true;
    g.add(mesh);
  };
  stage(0.25, 0.25, 0.95, 1.53, shell);
  stage(0.34, 0.34, 1.55, 0.28, shell);
  stage(0.4, 0.4, 2.02, -1.48, shell);
  stage(0.4, 0.28, 0.58, -2.66, dark);
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.25, 0.74, 28).rotateX(Math.PI / 2), shell);
  nose.position.set(0, 0.5, 2.35);
  g.add(nose);
  const band = new THREE.Mesh(new THREE.CylinderGeometry(0.345, 0.345, 0.32, 28).rotateX(Math.PI / 2), blue);
  band.position.set(0, 0.5, 0.95);
  g.add(band);
  for (const z of [-2.35, -0.48, 1.08, 2.0]) {
    const radius = z === 2.0 ? 0.26 : z === 1.08 ? 0.345 : 0.4;
    const ring = new THREE.Mesh(new THREE.TorusGeometry(radius, 0.027, 8, 32), dark);
    ring.position.set(0, 0.5, z);
    g.add(ring);
  }
  for (const [x, y, angle] of [[-0.33, 0.5, -0.22], [0.33, 0.5, 0.22], [0, 0.17, 0], [0, 0.83, Math.PI]] as [number, number, number][]) {
    const fin = box(0.075, 0.48, 0.56, 0x252b34, x, y, -2.35);
    fin.material = dark;
    fin.rotation.z = angle;
    g.add(fin);
  }
}

function createCarModel(v: Vehicle, animateRocket = true) {
  const g = new THREE.Group();
  const spins: { g: THREE.Object3D; dir: number; r: number }[] = [];

  // Build Tesla model using its complete body, detail and wheel specifications.
  if (v.kind === 'truck') buildTesla(g, v, SPECS.truck, spins);
  else if (v.kind === 'suv') buildTesla(g, v, SPECS.suv, spins);
  else if (v.kind === 'sport') buildTesla(g, v, SPECS.sport, spins);
  else if (v.kind === 'ship') buildTesla(g, v, SPECS.sedan, spins);
  else if (v.kind === 'rocket') buildProceduralRocket(g);
  else if (v.kind === 'sedan') buildTesla(g, v, SPECS.sedan, spins);
  else if (v.kind === 'ufo') {
    // Alien UFO
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(2.8, 2.8, 0.5, 24), new THREE.MeshStandardMaterial({ color: v.color, metalness: 0.95, roughness: 0.1, emissive: v.color, emissiveIntensity: 0.3 }));
    disc.position.y = 1.2; g.add(disc);
    const dome = new THREE.Mesh(new THREE.SphereGeometry(1.3, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x33ffaa, transparent: true, opacity: 0.6, emissive: 0x33ffaa, emissiveIntensity: 0.8 }));
    dome.position.y = 1.4; g.add(dome);
    for (let i = 0; i < 8; i++) { const a = i / 8 * 6.283; g.add(box(0.35, 0.2, 0.35, v.accent, Math.cos(a) * 2.6, 1.2, Math.sin(a) * 2.6, true)); }
  }

  if (v.kind === 'ship') addRocketPack(g, v, animateRocket);
  else if (v.kind === 'rocket') addRocketNozzleEffects(g, v, animateRocket);
  const glow = new THREE.PointLight(v.accent, 4, 12);
  glow.position.set(0, 0.8, 0); g.add(glow);
  g.traverse(o => { if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).castShadow = true; });
  return { group: g, wheels: spins };
}
function buildCar(v: Vehicle) {
  const request = ++activeVehicleModelRequest;
  wheelSpins.length = 0;
  rocketFlames.length = 0;
  const replaceWithProceduralModel = () => {
    while (carTilt.children.length) carTilt.remove(carTilt.children[0]);
    const model = createCarModel(v);
    carTilt.add(model.group);
    wheelSpins.push(...model.wheels);
  };
  const assetId = VEHICLE_ASSET_BY_ID[v.id];
  if (!assetId) {
    replaceWithProceduralModel();
    return;
  }
  void loadVehicleAsset(assetId).then(model => {
    if (request !== activeVehicleModelRequest) return;
    while (carTilt.children.length) carTilt.remove(carTilt.children[0]);
    addVehicleGlow(model, v);
    if (v.kind === 'ship') addRocketPack(model, v);
    else if (v.kind === 'rocket') addRocketNozzleEffects(carTilt, v);
    carTilt.add(model);
  }).catch(error => {
    if (request !== activeVehicleModelRequest) return;
    console.error(`Failed to load ${v.name} 3D model`, error);
    replaceWithProceduralModel();
    toast('3D model unavailable · using backup vehicle', '#ffb37a');
  });
}

// ---------- particles ----------
const P_N = 300;
const pGeo = new THREE.BufferGeometry();
const pPos = new Float32Array(P_N * 3), pCol = new Float32Array(P_N * 3);
pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
pGeo.setAttribute('color', new THREE.BufferAttribute(pCol, 3));
const pts = new THREE.Points(pGeo, new THREE.PointsMaterial({ size: 1.1, vertexColors: true, transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending }));
pts.frustumCulled = false;
scene.add(pts);
const pVel = Array.from({ length: P_N }, () => new THREE.Vector3());
const pLife = new Float32Array(P_N);
let pIdx = 0;
function emit(x: number, y: number, z: number, vx: number, vy: number, vz: number, r: number, g: number, b: number, life = 0.8) {
  const i = pIdx++ % P_N;
  pPos.set([x, y, z], i * 3); pCol.set([r, g, b], i * 3);
  pVel[i].set(vx, vy, vz); pLife[i] = life;
}

// ---------- state ----------
const car = {
  x: 0, y: 0, z: -10, yaw: 0, pitch: 0, speed: 0,
  vx: 0, vy: 0, vz: 0, air: false, flipAccum: 0, maxAlt: 0, startX: 0, startZ: 0,
  milestone: 0, onRampSlope: 0, wasOnRamp: false, prevGy: 0, glide: false, crash: 0, bounce: 0, trainCd: 0,
};
const keys: Record<string, boolean> = {};
let started = false, shopOpen = false;

function applyVehicle() { buildCar(veh()); }
applyVehicle();

// ---------- UI ----------
function toast(text: string, color?: string) {
  const d = document.createElement('div');
  d.className = 'toast'; d.textContent = text;
  if (color) d.style.color = color;
  $('toasts').appendChild(d);
  setTimeout(() => d.remove(), 1600);
  while ($('toasts').children.length > 4) $('toasts').firstChild!.remove();
}
function floatText(text: string) {
  const p = tmpP.set(car.x, car.y + 3, car.z).project(camera);
  const d = document.createElement('div');
  d.id = ''; d.className = ''; d.style.cssText = '';
  d.setAttribute('style', `position:fixed;left:${(p.x * 0.5 + 0.5) * innerWidth + rnd(-40, 40)}px;top:${(-p.y * 0.5 + 0.5) * innerHeight}px`);
  d.className = 'plus'; d.textContent = text;
  d.style.cssText += ';pointer-events:none;font-weight:900;font-size:26px;color:#7fff9a;text-shadow:0 2px 0 #0a5a22;animation:rise .9s forwards';
  document.body.appendChild(d);
  setTimeout(() => d.remove(), 900);
}
const FOCUS = ['HEIGHT', 'FLIP', 'DISTANCE'];
function trainGain() { return (1 + up('train')) * rebirthMult(); }
function heightBonus() { return 7 * Math.pow(save.train[0] + 1, 0.6) * veh().launch * (1 + 0.2 * up('launch')) * (1 + 0.25 * rup('hi')); }
function addCoins(n: number) { save.coins += n; save.totalCoins += n; }

function refreshHud() {
  $('coins').textContent = '🪙 ' + fmt(save.coins);
  $('stats').innerHTML =
    ['HEIGHT', 'FLIP', 'DISTANCE'].map((n, i) =>
      `<div>${save.focus === i ? '▶ ' : ''}${n} power: <b>${fmt(save.train[i])}</b></div>`).join('') +
    `<div>Best height: <b>${fmt(save.best)} m</b></div><div>Flips: <b>${fmt(save.flips)}</b> · Rebirths: <b>${save.rebirths}</b> (×${rebirthMult().toFixed(2)}) · ⭐ ${rpAvail()}</div>`;
  const speed = car.air ? Math.hypot(car.vx, car.vz) : Math.abs(car.speed);
  $('hud-right').innerHTML =
    `<b>${veh().name}</b><br>Speed ${Math.round(speed)} m/s<br>` +
    `<span style="opacity:.8">W/S drive · A/D steer<br>SPACE train (hold in air = glide)<br>Air: W/S flip · A/D turn<br>1/2/3 training focus<br>B or TAB shop · R reset car</span>`;
}
let hudTimer = 0;

const vehiclePreviewCache = new Map<string, string>();
const vehicleAssetPreviewCache = new Map<string, string>();
const vehicleAssetPreviewRequests = new Map<string, Promise<string>>();
let vehiclePreviewRenderer: THREE.WebGLRenderer | null = null;
let vehiclePreviewRequest = 0;
let vehiclePreviewObserver: IntersectionObserver | null = null;
const PREVIEW_PLACEHOLDER = 'data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=';

function getVehiclePreviewRenderer(): THREE.WebGLRenderer {
  if (!vehiclePreviewRenderer) {
    vehiclePreviewRenderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, preserveDrawingBuffer: true });
    vehiclePreviewRenderer.setPixelRatio(1);
    vehiclePreviewRenderer.setSize(420, 230, false);
    vehiclePreviewRenderer.toneMapping = THREE.ACESFilmicToneMapping;
    vehiclePreviewRenderer.toneMappingExposure = 1.1;
    vehiclePreviewRenderer.outputColorSpace = THREE.SRGBColorSpace;
  }
  return vehiclePreviewRenderer;
}

function getVehiclePreview(v: Vehicle): string {
  const cached = vehiclePreviewCache.get(v.id);
  if (cached) return cached;
  const previewRenderer = getVehiclePreviewRenderer();
  const previewScene = new THREE.Scene();
  previewScene.background = new THREE.Color(0x091321);
  previewScene.environment = scene.environment;
  previewScene.add(new THREE.HemisphereLight(0xb9e3ff, 0x182536, 2.2));
  const key = new THREE.DirectionalLight(0xffffff, 3);
  key.position.set(5, 8, 7);
  previewScene.add(key);
  const fill = new THREE.DirectionalLight(v.accent, 1.2);
  fill.position.set(-6, 3, -4);
  previewScene.add(fill);
  const model = createCarModel(v, false);
  model.group.rotation.y = -0.32;
  model.group.scale.setScalar(1.12);
  previewScene.add(model.group);
  const previewCamera = new THREE.PerspectiveCamera(32, 420 / 230, 0.1, 100);
  previewCamera.position.set(3.8, 2.8, 5.6);
  previewCamera.lookAt(0, 0.95, 0);
  previewRenderer.render(previewScene, previewCamera);
  const image = previewRenderer.domElement.toDataURL('image/png');
  model.group.traverse(object => {
    const mesh = object as THREE.Mesh;
    if (mesh.geometry) mesh.geometry.dispose();
    if (mesh.material) {
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      materials.forEach(material => material.dispose());
    }
  });
  previewScene.clear();
  vehiclePreviewCache.set(v.id, image);
  return image;
}

function getVehicleAssetPreview(assetId: string, v: Vehicle): Promise<string> {
  const previewKey = `${assetId}:${v.id}`;
  const cached = vehicleAssetPreviewCache.get(previewKey);
  if (cached) return Promise.resolve(cached);
  let request = vehicleAssetPreviewRequests.get(previewKey);
  if (!request) {
    request = loadVehicleAsset(assetId).then(model => {
      if (v.kind === 'ship') addRocketPack(model, v, false);
      const previewModel = new THREE.Group();
      previewModel.add(model);
      if (v.kind === 'rocket') addRocketNozzleEffects(previewModel, v, false);
      const previewRenderer = getVehiclePreviewRenderer();
      const previewScene = new THREE.Scene();
      previewScene.background = new THREE.Color(0x091321);
      previewScene.environment = scene.environment;
      previewScene.add(new THREE.HemisphereLight(0xb9e3ff, 0x182536, 2.2));
      const key = new THREE.DirectionalLight(0xffffff, 3);
      key.position.set(5, 8, 7);
      previewScene.add(key);
      const fill = new THREE.DirectionalLight(v.accent, 1.2);
      fill.position.set(-6, 3, -4);
      previewScene.add(fill);
      previewModel.rotation.y = -0.32;
      previewScene.add(previewModel);
      const bounds = new THREE.Box3().setFromObject(previewModel);
      const size = bounds.getSize(new THREE.Vector3());
      const center = bounds.getCenter(new THREE.Vector3());
      const span = Math.max(size.x, size.z);
      const previewCamera = new THREE.PerspectiveCamera(32, 420 / 230, 0.1, 100);
      previewCamera.position.set(center.x + span * 0.76, center.y + span * 0.58, center.z + span * 1.12);
      previewCamera.lookAt(center.x, center.y + size.y * 0.13, center.z);
      previewRenderer.render(previewScene, previewCamera);
      const image = previewRenderer.domElement.toDataURL('image/png');
      previewScene.clear();
      vehicleAssetPreviewCache.set(previewKey, image);
      return image;
    }).catch(error => {
      vehicleAssetPreviewRequests.delete(previewKey);
      throw error;
    });
    vehicleAssetPreviewRequests.set(previewKey, request);
  }
  return request;
}

function refreshVehiclePreviews() {
  const request = ++vehiclePreviewRequest;
  vehiclePreviewObserver?.disconnect();
  const root = document.querySelector('#shop .box') as HTMLElement;
  vehiclePreviewObserver = new IntersectionObserver(entries => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      const image = entry.target as HTMLImageElement;
      vehiclePreviewObserver?.unobserve(image);
      const v = VEHICLES.find(vehicle => vehicle.id === image.dataset.vehiclePreview);
      const assetId = v && VEHICLE_ASSET_BY_ID[v.id];
      if (!v || !assetId) continue;
      const cached = vehicleAssetPreviewCache.get(`${assetId}:${v.id}`);
      if (cached) {
        image.src = cached;
        continue;
      }
      void getVehicleAssetPreview(assetId, v).then(preview => {
        if (request === vehiclePreviewRequest && image.isConnected) image.src = preview;
      }).catch(error => {
        console.error(`Failed to render ${v.name} shop preview`, error);
        if (request === vehiclePreviewRequest && image.isConnected) image.src = getVehiclePreview(v);
      });
    }
  }, { root, rootMargin: '140px 0px' });
  document.querySelectorAll<HTMLImageElement>('img[data-vehicle-preview]').forEach(image => {
    const vehicleId = image.dataset.vehiclePreview || '';
    const assetId = VEHICLE_ASSET_BY_ID[vehicleId];
    const previewKey = assetId ? `${assetId}:${vehicleId}` : '';
    image.src = assetId ? vehicleAssetPreviewCache.get(previewKey) || PREVIEW_PLACEHOLDER : image.src;
    if (assetId && !vehicleAssetPreviewCache.has(previewKey)) vehiclePreviewObserver?.observe(image);
  });
}

function renderShop() {
  const rc = rebirthCost();
  let h = `<header class="shop-header"><div><span class="shop-kicker">NEON CITY MOTOR EXPO</span><h2>Garage &amp; upgrades</h2><p>Build your launch setup, pick a ride, then chase the next sky-high milestone.</p></div><div class="shop-wallet"><b>🪙 ${fmt(save.coins)}</b><button id="closeShop">Close <kbd>B</kbd></button></div></header>` +
    `<nav class="shop-tabs" aria-label="Shop categories"><button data-shop-section="upgrades">01 · Upgrades</button><button data-shop-section="vehicles">02 · Garage</button><button data-shop-section="rebirth">03 · Rebirth</button><button data-shop-section="achievements">04 · Records</button></nav>` +
    `<section class="shop-section" id="shop-upgrades"><div class="section-heading"><span>01</span><div><h3>Flight upgrades</h3><p>Choose a specialty and tune the way your next run performs.</p></div></div>`;
  const upgradeGroups = [
    { name: 'Flight & handling', ids: ['launch', 'engine', 'glide'] },
    { name: 'Training & rewards', ids: ['train', 'flip', 'magnet', 'coinv'] },
  ];
  for (const group of upgradeGroups) {
    h += `<h4 class="shop-subheading">${group.name}</h4><div class="grid">`;
    for (const id of group.ids) {
      const u = UPGRADES.find(item => item.id === id)!;
      const lvl = up(u.id), maxed = lvl >= u.max, c = upCost(u);
      const symbol = id === 'launch' ? '↗' : id === 'engine' ? 'ϟ' : id === 'glide' ? '⌁' : id === 'train' ? '+1' : id === 'flip' ? '⟳' : id === 'magnet' ? '◎' : '◈';
      h += `<article class="card upgrade-card"><div class="card-symbol">${symbol}</div><h4>${u.name}<small>Lv ${lvl}/${u.max}</small></h4><p>${u.desc}</p><button data-up="${u.id}" ${maxed || save.coins < c ? 'disabled' : ''}>${maxed ? 'MAX LEVEL' : 'Upgrade · 🪙 ' + fmt(c)}</button></article>`;
    }
    h += `</div>`;
  }
  h += `</section><section class="shop-section" id="shop-vehicles"><div class="section-heading"><span>02</span><div><h3>Vehicle garage</h3><p>Compare the actual in-game models, paint, flight stats, and unlock requirements.</p></div></div><div class="grid vehicle-grid">`;
  for (const v of VEHICLES) {
    const owned = save.owned.includes(v.id), sel = save.veh === v.id;
    const role = v.kind === 'rocket' ? 'Deep-space rocket' : v.kind === 'ship' ? 'Aerial craft' : v.kind === 'ufo' ? 'Alien tech' : v.kind === 'truck' ? 'Heavy duty' : v.kind === 'suv' ? 'All-terrain' : v.kind === 'sport' ? 'Performance' : 'Electric sedan';
    const status = sel ? 'CURRENT RIDE' : owned ? 'OWNED' : v.rb > save.rebirths ? `LOCKED · ${v.rb} REBIRTHS` : 'AVAILABLE';
    const preview = VEHICLE_ASSET_BY_ID[v.id] ? PREVIEW_PLACEHOLDER : getVehiclePreview(v);
    const assetId = VEHICLE_ASSET_BY_ID[v.id];
    const bodyLabel = assetId ? `${v.kind === 'rocket' ? 'SOURCED ROCKET' : 'SOURCED BODY'} · ${VEHICLE_ASSET_NAMES[assetId]}` : 'PROCEDURAL PLACEHOLDER';
    h += `<article class="card vehicle-card ${sel ? 'is-equipped' : ''}"><div class="vehicle-card-head"><span class="vehicle-role">${role}</span><span class="vehicle-status">${status}</span></div><img class="vehicle-preview" data-vehicle-preview="${v.id}" src="${preview}" alt="3D preview of the ${v.name} in the game"><h4>${v.name}</h4><div class="vehicle-body-label">${bodyLabel}</div><div class="vehicle-stats"><span>Launch <b>×${v.launch}</b></span><span>Speed <b>×${v.speed}</b></span>${v.rb ? `<span>Rebirth <b>⭐ ${v.rb}</b></span>` : ''}</div>` +
      (owned ? `<button data-eq="${v.id}" ${sel ? 'disabled' : ''}>${sel ? 'Equipped' : 'Equip vehicle'}</button>` :
        (save.rebirths < v.rb ? `<button disabled>🔒 Needs ${v.rb} rebirths</button>` :
        `<button class="gold" data-buy="${v.id}" ${save.coins < v.cost ? 'disabled' : ''}>Buy · 🪙 ${fmt(v.cost)}</button>`)) + `</article>`;
  }
  h += `<p class="vehicle-asset-note"><b>Imported Tesla bodies:</b> Model 3 Highland by RBLXSupercars, Model S by iSteven, Model Y by BloxBloger, Model X by cgi Moon, and Cybertruck by Nieve5677. The COSMIC X uses NASA's Saturn V model; the Lunar Tank retains the Model X rocket-car. Some late-game rides reuse these bodies. Roadster and fictional UFO remain original placeholders. Model S and Model Y assets are CC BY-NC 4.0 (non-commercial use only). <a href="${BASE_URL}models/CREDITS.md" target="_blank" rel="noreferrer">Full credits and license terms</a>.</p></section><section class="shop-section" id="shop-rebirth"><div class="section-heading"><span>03</span><div><h3>Rebirth &amp; prestige</h3><p>Reset your run for permanent multipliers. Your unlocked vehicles stay in the garage.</p></div></div><article class="card prestige-card"><div><span class="vehicle-role">PRESTIGE RESET</span><p>Gain <b>+0.5×</b> to training and coin rewards plus <b>1 ⭐ Rebirth Point</b>. Current multiplier: ×${rebirthMult().toFixed(2)}.</p></div><button class="red" id="rebirth" ${save.coins < rc ? 'disabled' : ''}>Rebirth · 🪙 ${fmt(rc)}</button></article>` +
    `<h4 class="shop-subheading">Permanent rebirth perks <small>· ${rpAvail()} points available</small></h4><div class="grid">` +
    RUPS.map(u => { const l = rup(u.id), c = rupCost(u); return `<div class="card"><h4>${u.name} <small>Lv ${l}/${u.max}</small></h4><p>${u.desc}</p><button class="gold" data-rup="${u.id}" ${l >= u.max || rpAvail() < c ? 'disabled' : ''}>${l >= u.max ? 'MAX' : '⭐ ' + c}</button></div>`; }).join('') +
    `</div></section><section class="shop-section" id="shop-achievements"><div class="section-heading"><span>04</span><div><h3>Flight records</h3><p>Milestones and collection goals from your career.</p></div></div><div class="grid">` +
    ACHS.map(a => `<article class="card record-card ${save.ach.includes(a.id) ? 'is-complete' : ''}"><h4>${save.ach.includes(a.id) ? '✅' : '◇'} ${a.name}</h4><p>Reward: 🪙 ${fmt(a.reward)}</p></article>`).join('') + `</div><p class="wipe-row"><button id="wipe" class="red">Delete save</button></p></section>`;
  const box = document.querySelector('#shop .box') as HTMLElement;
  const sy = box.scrollTop;
  box.innerHTML = h; box.scrollTop = sy;
  refreshVehiclePreviews();
}
function setShop(open: boolean) {
  shopOpen = open;
  $('shop').style.display = open ? 'flex' : 'none';
  if (open) renderShop();
}
$('shop').addEventListener('click', e => {
  const t = e.target as HTMLElement;
  if (t.id === 'shop' || t.id === 'closeShop') return setShop(false);
  const d = t.dataset;
  if (d.shopSection) {
    document.getElementById(`shop-${d.shopSection}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    return;
  }
  if (d.up) {
    const u = UPGRADES.find(x => x.id === d.up)!, c = upCost(u);
    if (save.coins >= c && up(u.id) < u.max) { save.coins -= c; save.ups[u.id] = up(u.id) + 1; beep(660, 0.12, 'triangle', 0.06, 400); }
  } else if (d.buy) {
    const v = VEHICLES.find(x => x.id === d.buy)!;
    if (save.coins >= v.cost) { save.coins -= v.cost; save.owned.push(v.id); save.veh = v.id; applyVehicle(); toast('Unlocked ' + v.name + '!', '#ffd84a'); beep(880, 0.3, 'sawtooth', 0.05, 800); }
  } else if (d.rup) {
    const u = RUPS.find(x => x.id === d.rup)!, c = rupCost(u);
    if (rpAvail() >= c && rup(u.id) < u.max) { save.rpSpent += c; save.rups[u.id] = rup(u.id) + 1; beep(700, 0.15, 'triangle', 0.06, 500); }
  } else if (d.eq) { save.veh = d.eq; applyVehicle(); }
  else if (t.id === 'rebirth' && save.coins >= rebirthCost()) {
    const keep = 0.1 * rup('keep');
    save.rebirths++; save.coins = 5000 * rup('start'); save.train = save.train.map(t => Math.floor(t * keep)) as [number, number, number]; save.ups = {};
    resetCar(); toast('REBIRTH! ×' + rebirthMult().toFixed(1), '#ff6bd6'); beep(300, 0.6, 'sawtooth', 0.06, 1200);
  } else if (t.id === 'wipe' && confirm('Delete all progress?')) {
    Object.assign(save, freshSave()); applyVehicle(); resetCar();
  }
  persist(); renderShop(); refreshHud();
});

// ---------- input ----------
function doTrain() {
  if (car.trainCd > 0) return;
  car.trainCd = 0.07;
  const g = trainGain();
  save.train[save.focus] += g;
  car.bounce = 1;
  floatText(`+${fmt(g)} ${FOCUS[save.focus]}`);
  beep(380 + Math.min(600, Math.log2(1 + save.train[save.focus]) * 30), 0.05, 'square', 0.03);
  if (!car.air) {
    car.air = true; car.onRampSlope = 0;
    car.vy = Math.min(12, 4 + 0.5 * Math.sqrt(save.train[0]));
    car.vx = Math.sin(car.yaw) * car.speed; car.vz = Math.cos(car.yaw) * car.speed;
    resetFlight();
  }
  for (let i = 0; i < 5; i++) emit(car.x, car.y + 0.5, car.z, rnd(-4, 4), rnd(2, 6), rnd(-4, 4), 0.5, 1, 0.6, 0.5);
}
addEventListener('keydown', e => {
  const k = e.code;
  if (['Space', 'Tab', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(k)) e.preventDefault();
  if (!started) return;
  if ((k === 'KeyB' || k === 'Tab') && !e.repeat) { setShop(!shopOpen); return; }
  if (k === 'Escape' && shopOpen) { setShop(false); return; }
  if (shopOpen) return;
  keys[k] = true;
  if (k === 'Space') doTrain();
  if (k === 'Digit1' || k === 'Digit2' || k === 'Digit3') { save.focus = +k.slice(-1) - 1; toast('Focus: ' + FOCUS[save.focus]); }
  if (k === 'KeyR' && !e.repeat) resetCar();
});
addEventListener('keyup', e => { keys[e.code] = false; });
addEventListener('blur', () => { for (const k in keys) keys[k] = false; });
addEventListener('resize', () => {
  renderer.setSize(innerWidth, innerHeight); composer.setSize(innerWidth, innerHeight);
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
});
$('play').addEventListener('click', () => { started = true; $('title').style.display = 'none'; actx = actx || new AudioContext(); });

function resetFlight() {
  car.flipAccum = 0; car.maxAlt = 0; car.milestone = 0; car.startX = car.x; car.startZ = car.z; car.crash = 0;
}
function resetCar() {
  Object.assign(car, { x: 0, y: 0, z: -10, yaw: 0, pitch: 0, speed: 0, vx: 0, vy: 0, vz: 0, air: false, wasOnRamp: false, prevGy: 0 });
}

// ---------- simulation ----------
let returnTimer = 0, autoAcc = 0, achTimer = 0;
const MILESTONES = [20, 50, 100, 250, 500, 1000, 2500, 5000, 10000, 25000, 50000, 100000, 250000, 1e6, 5e6, 25e6, 50e6, 100e6, 250e6, 500e6, SPACE_EXTENT];
function launch(slope: number) {
  const ms = maxSpeed();
  const sp = Math.abs(car.speed);
  const spF = Math.min(1, 0.35 + sp / (0.7 * ms));
  car.vy = slope * sp * 0.9 + heightBonus() * spF;
  const boost = 1.5 * Math.sqrt(save.train[2] + 1) * veh().speed * spF;
  const hs = sp * 1.0 + boost;
  car.vx = Math.sin(car.yaw) * hs; car.vz = Math.cos(car.yaw) * hs;
  car.air = true; resetFlight();
  save.launches++;
  toast('LAUNCH!', '#ffe14a'); beep(200, 0.4, 'sawtooth', 0.06, 700);
  for (let i = 0; i < 40; i++) emit(car.x, car.y + 0.5, car.z, rnd(-10, 10), rnd(0, 12), rnd(-10, 10), 1, 0.7, 0.2, 1);
}

function land(gy: number) {
  const dist = Math.hypot(car.x - car.startX, car.z - car.startZ);
  const p = wrapPi(car.pitch);
  const clean = Math.abs(p) < 0.9;
  const flips = Math.floor(Math.abs(car.flipAccum) / (Math.PI * 2) + 0.2);
  car.air = false; car.y = gy; car.vy = 0;
  car.speed = Math.hypot(car.vx, car.vz) * (clean ? 0.85 : 0.3);
  car.pitch = 0;
  car.bounce = 1.5;
  if (car.maxAlt > 3 || flips > 0) {
    const base = car.maxAlt * 0.6 + flips * 25 * (1 + 0.1 * up('flip')) + dist * 0.4;
    const reward = Math.max(1, Math.floor(base * coinMult() * (clean ? 1 : 0.4)));
    addCoins(reward); save.flips += flips;
    save.best = Math.max(save.best, car.maxAlt); save.bestDist = Math.max(save.bestDist, dist);
    returnTimer = 2.5;
    toast(clean ? `LANDED +${fmt(reward)} 🪙` : `WIPEOUT +${fmt(reward)} 🪙`, clean ? '#7fff9a' : '#ff7a7a');
    if (flips > 0) setTimeout(() => toast(`${flips}× FLIP${flips > 1 ? 'S' : ''}!`, '#ff6bd6'), 250);
    if (car.maxAlt >= 20 || flips) setTimeout(() => toast(`${Math.floor(car.maxAlt)} m · ${Math.floor(dist)} m far`, '#9fd8ff'), 500);
    beep(clean ? 520 : 110, 0.25, clean ? 'triangle' : 'sawtooth', 0.07, clean ? 400 : -50);
    for (let i = 0; i < 40; i++) emit(car.x, gy + 0.3, car.z, rnd(-8, 8), rnd(1, 7), rnd(-8, 8), 0.8, 0.75, 0.55, 0.9);
  }
}

function step(dt: number) {
  car.trainCd = Math.max(0, car.trainCd - dt);
  if (rup('auto') > 0) {
    autoAcc += dt * rup('auto');
    while (autoAcc >= 1) { autoAcc -= 1; save.train[save.focus] += trainGain(); }
  }
  achTimer -= dt;
  if (achTimer <= 0) {
    achTimer = 0.5;
    for (const a of ACHS) if (!save.ach.includes(a.id) && a.test()) { save.ach.push(a.id); addCoins(a.reward); toast('🏆 ' + a.name + ' +' + fmt(a.reward), '#ffd84a'); beep(900, 0.3, 'triangle', 0.06, 600); }
  }
  if (returnTimer > 0 && !car.air) { returnTimer -= dt; if (returnTimer <= 0) { resetCar(); toast('Back to the runway!', '#9fd8ff'); } }
  const fwd = (keys['KeyW'] || keys['ArrowUp'] ? 1 : 0) - (keys['KeyS'] || keys['ArrowDown'] ? 1 : 0);
  const steer = (keys['KeyA'] || keys['ArrowLeft'] ? 1 : 0) - (keys['KeyD'] || keys['ArrowRight'] ? 1 : 0);
  if (keys['Space'] && car.trainCd <= 0 && !car.air) doTrain();
  const ms = maxSpeed();

  if (!car.air) {
    if (fwd > 0) car.speed += (car.speed < ms ? 30 : 0) * dt;
    else if (fwd < 0) car.speed -= (car.speed > 0 ? 45 : 18) * dt;
    else car.speed *= 1 - Math.min(1, 0.8 * dt);
    car.speed = clamp(car.speed, -ms * 0.3, ms);
    const turn = 1.9 * clamp(Math.abs(car.speed) / 12, 0, 1) * Math.sign(car.speed || 1) / (1 + Math.abs(car.speed) / ms);
    car.yaw += steer * turn * dt * 1.6;
    const px = car.x, pz = car.z;
    car.x += Math.sin(car.yaw) * car.speed * dt;
    car.z += Math.cos(car.yaw) * car.speed * dt;
    if (car.z >= -110 && car.z <= 66 && Math.abs(car.x) > 7.55) {
      car.x = px; car.z = pz; car.speed *= 0.25;
    }
    // world edge
    const r = Math.hypot(car.x, car.z);
    if (r > WORLD_R - 10) { car.x = px; car.z = pz; car.speed *= -0.3; }
    const g = ground(car.x, car.z);
    const drop = car.prevGy - g.h;
    if (car.wasOnRamp && drop > 1.0 && car.speed > 3) {
      car.y = car.prevGy; launch(car.onRampSlope);
    } else if (car.wasOnRamp && drop > 1.0) {
      car.air = true; car.vy = 0; car.vx = 0; car.vz = 0; car.y = car.prevGy; resetFlight();
    } else {
      car.y = g.h;
      car.onRampSlope = g.slope;
      car.wasOnRamp = g.h > 0.3 && g.slope > 0;
      const target = g.h > 0.05 ? Math.atan(g.slope) * (car.speed >= 0 ? 1 : -1) : 0;
      car.pitch += (target - car.pitch) * Math.min(1, 12 * dt);
    }
    car.prevGy = g.h;
    if (Math.abs(car.speed) > 20 && !car.air) emit(car.x - Math.sin(car.yaw) * 2.4, car.y + 0.3, car.z - Math.cos(car.yaw) * 2.4, rnd(-1, 1), rnd(0, 1.5), rnd(-1, 1), 0.3, 0.7, 1, 0.4);
  } else {
    car.wasOnRamp = false;
    // flips + turning
    const flipRate = clamp(2.8 + 0.8 * up('flip') + 0.25 * Math.sqrt(save.train[1]), 0, 14);
    const dPitch = -fwd * flipRate * dt; // W = nose down (front flip), S = back flip
    car.pitch += dPitch; car.flipAccum += dPitch;
    if (fwd === 0) {
      const sp = Math.hypot(car.vx, car.vz) + 0.001;
      const tgt = car.glide ? Math.atan2(car.vy, sp) * 0.6 : Math.atan2(car.vy, sp) * 0.3;
      car.pitch += wrapPi(tgt - car.pitch) * Math.min(1, 1.4 * dt);
    }
    const dy = steer * 1.4 * dt;
    car.yaw += dy;
    const c = Math.cos(dy), s = Math.sin(dy);
    const nvx = car.vx * c + car.vz * s, nvz = -car.vx * s + car.vz * c;
    car.vx = nvx; car.vz = nvz;
    car.glide = !!keys['Space'] && car.vy < 0;
    car.vy -= GRAVITY * dt;
    if (car.glide) {
      const sink = Math.max(1.5, 18 - 1.5 * up('glide') - 3 * rup('glide'));
      if (car.vy < -sink) car.vy += (-sink - car.vy) * Math.min(1, 6 * dt);
      const hs = Math.hypot(car.vx, car.vz);
      const th = (4 + up('glide') * 1.5) * dt;
      car.vx += (car.vx / (hs || 1)) * th; car.vz += (car.vz / (hs || 1)) * th;
    }
    car.x += car.vx * dt; car.y += car.vy * dt; car.z += car.vz * dt;
    const r = Math.hypot(car.x, car.z);
    if (r > WORLD_R - 10) { const k = (WORLD_R - 10) / r; car.x *= k; car.z *= k; }
    car.maxAlt = Math.max(car.maxAlt, car.y);
    while (car.milestone < MILESTONES.length && car.y >= MILESTONES[car.milestone]) {
      const m = MILESTONES[car.milestone++];
      const bonus = Math.floor(m * 0.5 * coinMult());
      addCoins(bonus); toast(`☁ ${fmt(m)} m  +${fmt(bonus)} 🪙`, '#9fd8ff'); beep(500 + car.milestone * 60, 0.15, 'triangle', 0.05);
    }
    const g = ground(car.x, car.z);
    if (car.y <= g.h && car.vy < 0) land(g.h);
    if (car.glide) emit(car.x - car.vx * 0.02, car.y, car.z - car.vz * 0.02, rnd(-1, 1), rnd(-1, 1), rnd(-1, 1), 0.7, 0.9, 1, 0.5);
    if (veh().kind === 'ship') {
      for (const sx of [-1, 1]) emit(car.x + sx * 0.54, car.y + 0.56, car.z - 3.8, -car.vx * 0.1 + rnd(-0.7, 0.7), rnd(-2, 0), -car.vz * 0.1 - rnd(2, 5), 0.35, 0.75, 1, 0.55);
    } else if (car.vy > 5) {
      emit(car.x, car.y + 0.5, car.z, -car.vx * 0.1, rnd(-2, 0), -car.vz * 0.1, 1, 0.6, 0.2, 0.5);
    }
  }

  // coins
  const reach = 3.5 + up('magnet') * 3;
  for (let i = 0; i < coinSpots.length; i++) {
    const c = coinSpots[i];
    if (c.t > 0) { c.t -= dt; continue; }
    const dx = c.x - car.x, dy = c.y - (car.y + 1), dz = c.z - car.z;
    const d2 = dx * dx + dy * dy + dz * dz;
    if (d2 < reach * reach * 2.2) {
      const v = Math.max(1, Math.floor(c.value * coinMult()));
      addCoins(v); c.t = 12; beep(1100, 0.05, 'sine', 0.04);
      floatText('+' + fmt(v));
    }
  }
  if (car.bounce > 0) car.bounce = Math.max(0, car.bounce - dt * 4);
}

// ---------- render loop ----------
const camPos = new THREE.Vector3(0, 6, -20), camLook = new THREE.Vector3();
let camYaw = 0, lastT = performance.now(), time = 0;
function frame(now: number) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.033, (now - lastT) / 1000); lastT = now; time += dt;
  if (started && !shopOpen) step(dt);

  // car visuals
  carRoot.position.set(car.x, car.y, car.z);
  carRoot.rotation.y = car.yaw;
  carTilt.rotation.x = -car.pitch;
  const bs = 1 + 0.08 * Math.sin(car.bounce * Math.PI) * (car.bounce > 1 ? 1 : 1);
  carTilt.scale.set(1 / bs, bs, 1 / bs);
  const gh = ground(car.x, car.z).h;
  shadow.position.set(car.x, gh + 0.08, car.z);
  const alt = Math.max(0, car.y - gh);
  const ss = 1 / (1 + alt * 0.02);
  shadow.scale.setScalar(ss); (shadow.material as THREE.Material).opacity = 0.35 * ss;
  sun.position.set(car.x + SUN_OFF.x, car.y + SUN_OFF.y, car.z + SUN_OFF.z); sun.target.position.set(car.x, car.y, car.z);
  const roll = (car.air ? Math.hypot(car.vx, car.vz) * 0.3 : car.speed) * dt;
  for (const w of wheelSpins) w.g.rotation.x += (roll / w.r) * w.dir * (w.dir < 0 ? 1 : 1);
  skyMesh.position.copy(camera.position);
  const rocketThrust = car.air
    ? clamp(0.62 + car.vy / 70, 0.18, 1.2)
    : clamp(Math.abs(car.speed) / Math.max(1, maxSpeed()) * 0.42, 0, 0.42);
  for (const rocket of rocketFlames) {
    const pulse = rocketThrust * (0.88 + 0.12 * Math.sin(time * 34 + rocket.phase));
    rocket.mesh.visible = rocketThrust > 0.04;
    rocket.core.visible = rocketThrust > 0.04;
    rocket.mesh.scale.set(1, 1, pulse);
    rocket.core.scale.set(1, 1, pulse * 0.8);
    rocket.light.intensity = rocketThrust * 3.2;
  }

  // camera
  const hs = car.air ? Math.hypot(car.vx, car.vz) : Math.abs(car.speed);
  const headYaw = car.air && hs > 8 ? Math.atan2(car.vx, car.vz) : car.yaw;
  camYaw += wrapPi(headYaw - camYaw) * Math.min(1, 4 * dt);
  const dist = 13 + Math.min(alt * 0.03, 60) + hs * 0.06;
  const hgt = 5 + Math.min(alt * 0.015, 30);
  const tgt = new THREE.Vector3(car.x - Math.sin(camYaw) * dist, car.y + hgt, car.z - Math.cos(camYaw) * dist);
  camPos.lerp(tgt, Math.min(1, 6 * dt));
  camera.position.copy(camPos);
  camLook.set(car.x, car.y + 1.5, car.z);
  camera.lookAt(camLook);
  const fov = 65 + Math.min(25, hs * 0.25);
  if (Math.abs(camera.fov - fov) > 0.05) { camera.fov += (fov - camera.fov) * Math.min(1, 4 * dt); camera.updateProjectionMatrix(); }

  // sky: fade to space with altitude
  const t = clamp(car.y / 3000, 0, 1);
  skyU.space.value = clamp((t - 0.15) / 0.6, 0, 1);
  const f = scene.fog as THREE.Fog;
  f.color.set(0xbfe3ff).lerp(new THREE.Color(0x02030a), skyU.space.value);
  f.near = THREE.MathUtils.lerp(200, 280_000, skyU.space.value);
  f.far = THREE.MathUtils.lerp(2400 + alt * 4, SPACE_VIEW_DISTANCE, skyU.space.value);
  sun.intensity = 3.0 * (1 - 0.3 * skyU.space.value);
  const starOpacity = clamp((t - 0.2) / 0.5, 0, 1);
  (stars.far.material as THREE.PointsMaterial).opacity = starOpacity;
  (stars.near.material as THREE.PointsMaterial).opacity = starOpacity * 0.72;
  stars.far.position.copy(camera.position);
  stars.near.position.copy(camera.position);
  planet.position.copy(camera.position);
  planet.visible = skyU.space.value > 0.05;
  clouds.visible = car.y < 1500;
  bloom.strength = 0.35 + t * 0.25;

  // coins render
  for (let i = 0; i < coinSpots.length; i++) {
    const c = coinSpots[i];
    if (c.t > 0) { coinMesh.setMatrixAt(i, hidden); continue; }
    tmpQ.setFromAxisAngle(UP, time * 2.5 + i);
    tmpP.set(c.x, c.y + Math.sin(time * 2 + i) * 0.3, c.z);
    const s = 1.3 * (1 + (c.value > 20 ? 0.5 : 0));
    tmpS.set(s, s, s);
    tmpM.compose(tmpP, tmpQ, tmpS);
    coinMesh.setMatrixAt(i, tmpM);
  }
  coinMesh.instanceMatrix.needsUpdate = true;

  // particles
  for (let i = 0; i < P_N; i++) {
    if (pLife[i] > 0) {
      pLife[i] -= dt;
      pPos[i * 3] += pVel[i].x * dt; pPos[i * 3 + 1] += pVel[i].y * dt; pPos[i * 3 + 2] += pVel[i].z * dt;
      pVel[i].y -= 8 * dt;
    } else pPos[i * 3 + 1] = -1000;
  }
  pGeo.attributes.position.needsUpdate = true; pGeo.attributes.color.needsUpdate = true;

  // HUD
  const zr = Math.hypot(car.x, car.z);
  $('altv').textContent = `${Math.floor(alt)} m`;
  const spaceProgress = clamp(Math.log1p(alt) / Math.log1p(SPACE_EXTENT) * 100, 0, 100);
  $('space-tier').textContent = alt < 12_000 ? 'CITY SKY' : alt < 80_000 ? 'EDGE OF SPACE' : alt < 1_000_000 ? 'DEEP SPACE' : alt < 100_000_000 ? 'OUTER REACH' : 'INTERSTELLAR';
  $('space-distance').textContent = `${fmt(alt)} / 1B m`;
  $('space-meter').style.width = `${spaceProgress}%`;
  $('space-progress').setAttribute('aria-valuenow', spaceProgress.toFixed(1));
  const zone = ZONES.find(z => zr < z.r)!;
  let near = Infinity;
  for (const r of ramps) near = Math.min(near, Math.hypot(r.x - car.x, r.z - car.z));
  $('zone').textContent = `${zone.name} · ${car.air ? 'Distance ' + Math.floor(Math.hypot(car.x - car.startX, car.z - car.startZ)) + ' m' : 'Ramp ' + Math.floor(near) + ' m ahead'}`;
  $('hint').innerHTML = alt > 3
    ? 'Hold <kbd>SPACE</kbd> to glide · <kbd>W</kbd>/<kbd>S</kbd> flip · <kbd>A</kbd>/<kbd>D</kbd> turn'
    : `<kbd>SPACE</kbd> train ${FOCUS[save.focus]} · drive up a ramp with <kbd>W</kbd> · <kbd>B</kbd> shop`;
  hudTimer -= dt;
  if (hudTimer <= 0) { hudTimer = 0.1; refreshHud(); }

  composer.render();
}
refreshHud();
requestAnimationFrame(frame);

// test hook
(window as unknown as { __game: unknown }).__game = { car, save, ramps, keys };
