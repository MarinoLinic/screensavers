// Three.js renderer for FlyWorld — zero-g kinetic sculpture stage.
//
// One shared geometry cache covers all ten shape types; compound silhouettes
// (teapot, satellite, linked rings) are merged into single BufferGeometries
// once, so draw calls stay ~body count + a handful. Materials are per-palette
// slot templates cloned per mesh only so helix/vortex seam fades can write
// per-body opacity without recompiling anything. The environment map is a
// PMREM of a procedurally painted studio equirect — real softbox
// reflections, no external assets.

import * as THREE from '../vendor/three.module.min.js';
import { VIEW } from './engine.js';
import { deformFlowerBox } from './flowerbox.js';
import { paletteOf } from './settings.js';

const MAX_DPR = 1.75;
const LOWRES_W = 480;
const LOWRES_H = 360;
const TRAIL_LEN = 24;

// ---------------------------------------------------------------- helpers

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Merge transformed parts into one non-indexed BufferGeometry
 * (position/normal/uv). Local replacement for BufferGeometryUtils so no
 * add-on import is needed.
 */
export function mergeParts(parts) {
  const geos = parts.map(({ geo, matrix }) => {
    const g = geo.index ? geo.toNonIndexed() : geo.clone();
    if (matrix) g.applyMatrix4(matrix);
    return g;
  });
  let total = 0;
  for (const g of geos) total += g.attributes.position.count;
  const pos = new Float32Array(total * 3);
  const nor = new Float32Array(total * 3);
  const uv = new Float32Array(total * 2);
  let off = 0;
  for (const g of geos) {
    pos.set(g.attributes.position.array, off * 3);
    nor.set(g.attributes.normal.array, off * 3);
    if (g.attributes.uv) uv.set(g.attributes.uv.array, off * 2);
    off += g.attributes.position.count;
    g.dispose();
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  out.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return out;
}

const M4 = () => new THREE.Matrix4();
const compose = (px, py, pz, rx = 0, ry = 0, rz = 0, s = 1) =>
  M4().compose(
    new THREE.Vector3(px, py, pz),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)),
    new THREE.Vector3(s, s, s)
  );

/** Lofted tapered tube along a quadratic bezier (teapot spout). */
export function taperedTube(p0, p1, p2, r0, r1, segs = 18, radial = 10) {
  const A = new THREE.Vector3(...p0);
  const B = new THREE.Vector3(...p1);
  const C = new THREE.Vector3(...p2);
  const pos = [], nor = [], uv = [], idx = [];
  const up = new THREE.Vector3(0, 0, 1);
  const center = new THREE.Vector3(), tan = new THREE.Vector3();
  const n = new THREE.Vector3(), b = new THREE.Vector3(), d = new THREE.Vector3();
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    center.copy(A).multiplyScalar((1 - t) * (1 - t))
      .addScaledVector(B, 2 * (1 - t) * t)
      .addScaledVector(C, t * t);
    tan.copy(B).sub(A).multiplyScalar(2 * (1 - t))
      .addScaledVector(new THREE.Vector3().copy(C).sub(B), 2 * t).normalize();
    n.crossVectors(tan, up);
    if (n.lengthSq() < 1e-6) n.set(1, 0, 0); else n.normalize();
    b.crossVectors(tan, n).normalize();
    const r = r0 + (r1 - r0) * t;
    for (let j = 0; j <= radial; j++) {
      const th = (j / radial) * Math.PI * 2;
      d.copy(n).multiplyScalar(Math.cos(th)).addScaledVector(b, Math.sin(th));
      pos.push(center.x + d.x * r, center.y + d.y * r, center.z + d.z * r);
      nor.push(d.x, d.y, d.z);
      uv.push(j / radial, t);
    }
  }
  const ring = radial + 1;
  for (let i = 0; i < segs; i++) {
    for (let j = 0; j < radial; j++) {
      const a = i * ring + j, c = a + ring;
      idx.push(a, c, a + 1, c, c + 1, a + 1);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  return g;
}

// ----------------------------------------------------------- shape baking

export function teapotGeometry() {
  const V2 = (x, y) => new THREE.Vector2(x, y);
  const body = new THREE.LatheGeometry([
    V2(0.02, -0.78), V2(0.4, -0.75), V2(0.66, -0.58), V2(0.82, -0.28),
    V2(0.85, 0.04), V2(0.76, 0.34), V2(0.56, 0.55), V2(0.34, 0.62),
    V2(0.05, 0.62),
  ], 40);
  const lid = new THREE.LatheGeometry([
    V2(0.05, 0.6), V2(0.34, 0.62), V2(0.4, 0.68), V2(0.3, 0.75), V2(0.08, 0.76),
  ], 32);
  const knob = new THREE.SphereGeometry(0.11, 16, 12);
  const spout = taperedTube([-0.78, -0.05, 0], [-1.28, 0.12, 0], [-1.16, 0.68, 0], 0.2, 0.09);
  const handle = new THREE.TorusGeometry(0.45, 0.085, 12, 28, Math.PI * 1.25);
  return mergeParts([
    { geo: body },
    { geo: lid },
    { geo: knob, matrix: compose(0, 0.86, 0) },
    { geo: spout },
    // torus arc stands in the xy-plane, swung open toward the body
    { geo: handle, matrix: compose(0.72, 0.02, 0, 0, 0, -0.6) },
  ]);
}

export function satelliteGeometry() {
  const body = new THREE.CylinderGeometry(0.34, 0.34, 1.0, 20);
  const dome = new THREE.SphereGeometry(0.24, 16, 12);
  const boom = new THREE.CylinderGeometry(0.035, 0.035, 0.55, 8);
  const tip = new THREE.SphereGeometry(0.08, 10, 8);
  const wing = new THREE.BoxGeometry(1.15, 0.05, 0.55);
  const strut = new THREE.CylinderGeometry(0.05, 0.05, 0.5, 8);
  return mergeParts([
    { geo: body, matrix: compose(0, 0, 0, 0, 0, Math.PI / 2) },
    { geo: dome, matrix: compose(0.62, 0, 0) },
    { geo: boom, matrix: compose(-0.72, 0, 0, 0, 0, Math.PI / 2) },
    { geo: tip, matrix: compose(-1.02, 0, 0) },
    { geo: strut, matrix: compose(0, 0, 0.5, Math.PI / 2, 0, 0) },
    { geo: strut.clone(), matrix: compose(0, 0, -0.5, Math.PI / 2, 0, 0) },
    { geo: wing, matrix: compose(0, 0, 1.0) },
    { geo: wing.clone(), matrix: compose(0, 0, -1.0) },
  ]);
}

export function ringsGeometry() {
  const a = new THREE.TorusGeometry(0.72, 0.16, 18, 48);
  const b = new THREE.TorusGeometry(0.72, 0.16, 18, 48);
  return mergeParts([
    { geo: a },
    // vertical twin threading the first ring's hole
    { geo: b, matrix: compose(0.72, 0, 0, 0, Math.PI / 2, 0) },
  ]);
}

/**
 * The Flower Box: one subdivided unit cube whose vertices morph each frame.
 * Keeps an immutable base copy (the morph always rewrites from it), a
 * per-vertex face id derived from the initial axis-aligned normals for the
 * six-hue face colouring, and a shared vertex-color attribute.
 */
export function flowerboxGeometry() {
  const g = new THREE.BoxGeometry(2, 2, 2, 20, 20, 20);
  g.userData.base = new Float32Array(g.attributes.position.array);
  const n = g.attributes.normal.array;
  const ids = new Uint8Array(n.length / 3);
  for (let i = 0; i < ids.length; i++) {
    const x = n[i * 3], y = n[i * 3 + 1], z = n[i * 3 + 2];
    ids[i] = Math.abs(x) > 0.5 ? (x > 0 ? 0 : 1)
      : Math.abs(y) > 0.5 ? (y > 0 ? 2 : 3) : (z > 0 ? 4 : 5);
  }
  g.userData.faceIds = ids;
  g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(n.length), 3));
  g.attributes.position.setUsage(THREE.DynamicDrawUsage);
  // Positions morph up to 1.365x each frame; a static bound keeps the
  // mesh correctly frustum-culled without recomputing per frame.
  g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), Math.sqrt(3) * 1.4);
  return g;
}

// ---------------------------------------------------------------- camera

/**
 * Drag/wheel/dbl-click orbit with a gentle auto-wander. The drift is a slow
 * sinusoidal loiter around home — never a continuous spin — and it freezes
 * while paused. Manual input always works, paused or not.
 */
class DriftCamera {
  constructor(camera, dom, { distance = VIEW.dist } = {}) {
    this.camera = camera;
    this.dom = dom;
    this.minDist = 14;
    this.maxDist = 60;
    this.home = { yaw: 0.55, pitch: 0.3, dist: distance };
    this.yaw = this.home.yaw;
    this.pitch = this.home.pitch;
    this.dist = distance;
    this.dragging = false;
    this._autoT = 0;
    this._pid = null;
    this._px = 0;
    this._py = 0;
    this._moved = true;
    this._bind();
    this.update();
  }

  _bind() {
    const el = this.dom;
    el.addEventListener('pointerdown', (e) => {
      if (e.button !== undefined && e.button !== 0) return;
      if (el.inert) return; // panel open: stage is inert anyway, belt+braces
      if (this._pid !== null) return;
      this._pid = e.pointerId;
      this._px = e.clientX;
      this._py = e.clientY;
      this.dragging = true;
      try { el.setPointerCapture(e.pointerId); } catch { /* optional */ }
    });
    el.addEventListener('pointermove', (e) => {
      if (e.pointerId !== this._pid) return;
      const dx = e.clientX - this._px;
      const dy = e.clientY - this._py;
      this._px = e.clientX;
      this._py = e.clientY;
      this.yaw += dx * 0.005;
      this.pitch = Math.min(1.3, Math.max(-1.3, this.pitch + dy * 0.005));
      this._moved = true;
      this.update();
    });
    const end = (e) => {
      if (e.pointerId === this._pid) { this._pid = null; this.dragging = false; }
    };
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);
    el.addEventListener('lostpointercapture', end);
    el.addEventListener('wheel', (e) => {
      e.preventDefault();
      this.dist = Math.min(this.maxDist, Math.max(this.minDist, this.dist * Math.exp(e.deltaY * 0.001)));
      this._moved = true;
      this.update();
    }, { passive: false });
    el.addEventListener('dblclick', () => this.reset());
  }

  reset() {
    this.yaw = this.home.yaw;
    this.pitch = this.home.pitch;
    this.dist = this.home.dist;
    this._moved = true;
    this.update();
  }

  /** Step the auto-wander; returns whether the camera moved this frame. */
  step(dt, allowAuto) {
    let moved = this._moved;
    this._moved = false;
    if (allowAuto && !this.dragging) {
      this._autoT += dt;
      const t = this._autoT;
      const ty = this.home.yaw + 0.42 * Math.sin(t * 0.05) + 0.16 * Math.sin(t * 0.083 + 1.7);
      const tp = this.home.pitch + 0.16 * Math.sin(t * 0.07 + 0.6);
      const k = Math.min(1, dt * 0.5);
      this.yaw += (ty - this.yaw) * k;
      this.pitch += (tp - this.pitch) * k;
      moved = true;
      this.update();
    }
    return moved;
  }

  update() {
    const cp = Math.cos(this.pitch);
    this.camera.position.set(
      Math.cos(this.yaw) * cp * this.dist,
      Math.sin(this.pitch) * this.dist,
      Math.sin(this.yaw) * cp * this.dist
    );
    this.camera.lookAt(0, 0, 0);
  }
}

// -------------------------------------------------------------- renderer

export class FlyRenderer {
  constructor(canvas, settings, { onContextLost } = {}) {
    this.canvas = canvas;
    this.settings = settings;
    this.onContextLost = onContextLost;
    this.contextLost = false;
    this.renders = 0;

    this.renderer = new THREE.WebGLRenderer({
      canvas, antialias: true, preserveDrawingBuffer: false,
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.2;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(VIEW.fov, 1, 0.1, 220);
    this.cam = new DriftCamera(this.camera, canvas, { distance: VIEW.dist });

    canvas.addEventListener('webglcontextlost', (e) => {
      e.preventDefault();
      this.contextLost = true;
      if (this.onContextLost) this.onContextLost();
    });
    canvas.addEventListener('webglcontextrestored', () => {
      try { window.location.reload(); } catch { /* nothing else to do */ }
    });

    this.geoCache = new Map();
    this.baseMats = new Map();
    this.meshes = new Map(); // body id -> { mesh, rim, trail, last }
    this._meshSig = '';
    this._checkerTex = null;
    this._rimMat = null;
    this._fbMat = null;          // clean solo-box material template
    this._fbBg = new THREE.Color('#020305'); // near-black Flower Box stage
    this._fbMorphTime = NaN;     // sim time the live positions were last morphed at

    this._buildEnvironment();
    this._buildBackdrop(settings.preset);
    this._buildLights(settings.preset);
    this._buildStars();
    this.resize();
  }

  // ------------------------------------------------------ scene dressing

  /** PMREM'd procedural studio equirect: gradient + softbox cards. */
  _buildEnvironment() {
    const c = document.createElement('canvas');
    c.width = 512; c.height = 256;
    const g = c.getContext('2d');
    const grad = g.createLinearGradient(0, 0, 0, 256);
    grad.addColorStop(0, '#6a7a9e');
    grad.addColorStop(0.4, '#323e5c');
    grad.addColorStop(0.7, '#161c2e');
    grad.addColorStop(1, '#0a0e16');
    g.fillStyle = grad;
    g.fillRect(0, 0, 512, 256);
    // horizon band — broad mid-tone so chrome reads as metal, not void
    const band = g.createLinearGradient(0, 80, 0, 180);
    band.addColorStop(0, 'rgba(140,160,200,0)');
    band.addColorStop(0.5, 'rgba(140,160,200,0.8)');
    band.addColorStop(1, 'rgba(140,160,200,0)');
    g.fillStyle = band;
    g.fillRect(0, 80, 512, 100);
    // softbox highlights — what actually streaks across the metal
    const soft = (x, y, w, h, a) => {
      const rg = g.createRadialGradient(x, y, 2, x, y, Math.max(w, h));
      rg.addColorStop(0, `rgba(255,250,240,${a})`);
      rg.addColorStop(1, 'rgba(255,250,240,0)');
      g.save();
      g.translate(x, y);
      g.scale(1, h / w);
      g.translate(-x, -y);
      g.fillStyle = rg;
      g.fillRect(x - w, y - h, w * 2, h * 2);
      g.restore();
    };
    soft(110, 55, 130, 42, 1.0);   // big key card, upper left
    soft(370, 42, 90, 30, 0.85);   // rim card, upper right
    soft(430, 120, 55, 80, 0.5);   // side fill
    soft(80, 150, 45, 60, 0.35);   // left fill
    soft(256, 250, 160, 16, 0.35); // faint floor bounce
    const tex = new THREE.CanvasTexture(c);
    tex.mapping = THREE.EquirectangularReflectionMapping;
    tex.colorSpace = THREE.SRGBColorSpace;
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromEquirectangular(tex).texture;
    pmrem.dispose();
    tex.dispose();
  }

  /** Gradient sky sphere; per-preset via uniforms, zero texture churn. */
  _buildBackdrop(presetKey) {
    const p = paletteOf({ preset: presetKey });
    this.skyUniforms = {
      uTop: { value: new THREE.Color(p.sky[0]) },
      uMid: { value: new THREE.Color(p.sky[1]) },
      uBot: { value: new THREE.Color(p.sky[2]) },
    };
    const mat = new THREE.ShaderMaterial({
      uniforms: this.skyUniforms,
      side: THREE.BackSide,
      depthWrite: false,
      toneMapped: false,
      vertexShader: `
        varying vec3 vDir;
        void main() {
          vDir = normalize(position);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: `
        varying vec3 vDir;
        uniform vec3 uTop; uniform vec3 uMid; uniform vec3 uBot;
        void main() {
          float h = vDir.y * 0.5 + 0.5;
          vec3 col = h > 0.5
            ? mix(uMid, uTop, (h - 0.5) * 2.0)
            : mix(uMid, uBot, (0.5 - h) * 2.0);
          col += uMid * 0.35 * exp(-pow(vDir.y * 4.5, 2.0));   // horizon glow
          col += uMid * 0.18 * exp(-pow(length(vDir.xz - vec2(0.0, -0.9)) * 1.4, 2.0));
          gl_FragColor = vec4(col, 1.0);
        }`,
    });
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(140, 32, 20), mat);
    this.scene.add(this.sky);
  }

  _setSky(presetKey) {
    const p = paletteOf({ preset: presetKey });
    this.skyUniforms.uTop.value.set(p.sky[0]);
    this.skyUniforms.uMid.value.set(p.sky[1]);
    this.skyUniforms.uBot.value.set(p.sky[2]);
  }

  _buildLights(presetKey) {
    const p = paletteOf({ preset: presetKey });
    this.key = new THREE.DirectionalLight(new THREE.Color(p.light), 2.6);
    this.key.position.set(10, 14, 12);
    this.rim = new THREE.DirectionalLight('#7fb8e8', 1.4);
    this.rim.position.set(-12, -4, -14);
    this.hemi = new THREE.HemisphereLight('#46587c', '#10141e', 1.0);
    this.scene.add(this.key, this.rim, this.hemi);
  }

  _buildStars() {
    const N = 650;
    const rng = mulberry32(0x5eed);
    const pos = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      // even-ish shell distribution far behind the action
      const z = rng() * 2 - 1;
      const th = rng() * Math.PI * 2;
      const r = Math.sqrt(1 - z * z);
      const dist = 70 + rng() * 40;
      pos[i * 3] = Math.cos(th) * r * dist;
      pos[i * 3 + 1] = z * dist * 0.8;
      pos[i * 3 + 2] = Math.sin(th) * r * dist;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.stars = new THREE.Points(geo, new THREE.PointsMaterial({
      color: '#9fb8d8', size: 0.09, sizeAttenuation: true,
      transparent: true, opacity: 0.5, depthWrite: false,
    }));
    this.scene.add(this.stars);
  }

  // ------------------------------------------------------- geometry cache

  _geometry(shape) {
    let g = this.geoCache.get(shape);
    if (g) return g;
    switch (shape) {
      case 'cube': g = new THREE.BoxGeometry(1.5, 1.5, 1.5); break;
      case 'sphere': g = new THREE.SphereGeometry(0.95, 48, 32); break;
      case 'octahedron': g = new THREE.OctahedronGeometry(1.15, 0); break;
      case 'icosahedron': g = new THREE.IcosahedronGeometry(1.05, 0); break;
      case 'torus': g = new THREE.TorusGeometry(0.9, 0.34, 24, 56); break;
      case 'knot': g = new THREE.TorusKnotGeometry(0.72, 0.26, 160, 24); break;
      case 'capsule': g = new THREE.CapsuleGeometry(0.55, 1.0, 8, 28); break;
      case 'rings': g = ringsGeometry(); break;
      case 'teapot': g = teapotGeometry(); break;
      case 'satellite': g = satelliteGeometry(); break;
      case 'flowerbox': g = flowerboxGeometry(); break;
      default: g = new THREE.SphereGeometry(0.9, 32, 24);
    }
    this.geoCache.set(shape, g);
    return g;
  }

  _checkerTexture() {
    if (this._checkerTex) return this._checkerTex;
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const g = c.getContext('2d');
    const s = 16;
    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 8; x++) {
        g.fillStyle = (x + y) % 2 ? '#e8e8e8' : '#101418';
        g.fillRect(x * s, y * s, s, s);
      }
    }
    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(2, 2);
    tex.colorSpace = THREE.SRGBColorSpace;
    this._checkerTex = tex;
    return tex;
  }

  // -------------------------------------------------------- material slot

  _baseMaterial(paletteIndex) {
    const key = `${this.settings.preset}|${this.settings.material}|${paletteIndex}`;
    let m = this.baseMats.get(key);
    if (m) return m;
    const p = paletteOf(this.settings);
    const hue = new THREE.Color(p.hues[paletteIndex % p.hues.length]);
    const mode = this.settings.material === 'auto' ? 'auto' : this.settings.material;
    const prof = p.mat;
    switch (mode) {
      case 'chrome':
        m = new THREE.MeshStandardMaterial({
          color: hue, metalness: 1.0, roughness: 0.08, envMapIntensity: 1.45,
        });
        break;
      case 'ceramic':
        m = new THREE.MeshStandardMaterial({
          color: hue, metalness: 0.0, roughness: 0.36, envMapIntensity: 0.85,
        });
        break;
      case 'glass':
        m = new THREE.MeshPhysicalMaterial({
          color: hue, metalness: 0.0, roughness: 0.06,
          transparent: true, opacity: 0.55, envMapIntensity: 1.7,
          depthWrite: false,
        });
        m.userData.baseOpacity = 0.55;
        break;
      case 'wireframe':
        m = new THREE.MeshBasicMaterial({ color: hue, wireframe: true });
        break;
      case 'checker':
        m = new THREE.MeshStandardMaterial({
          color: hue, map: this._checkerTexture(),
          metalness: 0.35, roughness: 0.3, envMapIntensity: 1.0,
        });
        break;
      default: { // auto -> the preset's bundled surface profile
        const em = new THREE.Color(hue).multiplyScalar(prof.emissive || 0);
        m = new THREE.MeshStandardMaterial({
          color: prof.emissive ? hue.clone().multiplyScalar(0.55) : hue,
          metalness: prof.metalness, roughness: prof.roughness,
          envMapIntensity: prof.env, emissive: em,
        });
      }
    }
    m.userData.baseOpacity = m.opacity;
    this.baseMats.set(key, m);
    return m;
  }

  _dropMaterials() {
    for (const m of this.baseMats.values()) m.dispose();
    this.baseMats.clear();
  }

  /**
   * Solo-box surface for material 'auto': a clean ceramic-ish standard
   * material — the six face hues come from vertex colours, so no preset
   * profile is bundled in.
   */
  _flowerboxMaterial() {
    if (!this._fbMat) {
      this._fbMat = new THREE.MeshStandardMaterial({
        color: '#ffffff', vertexColors: true,
        metalness: 0.12, roughness: 0.35, envMapIntensity: 0.75,
      });
      this._fbMat.userData.baseOpacity = 1;
    }
    return this._fbMat;
  }

  /** Tint the six box faces with the current palette's six hues. */
  _flowerboxColors() {
    const g = this.geoCache.get('flowerbox');
    if (!g) return;
    const hues = paletteOf(this.settings).hues;
    const ids = g.userData.faceIds;
    const col = g.attributes.color.array;
    const c = new THREE.Color();
    for (let i = 0; i < ids.length; i++) {
      c.set(hues[ids[i] % hues.length]);
      col[i * 3] = c.r;
      col[i * 3 + 1] = c.g;
      col[i * 3 + 2] = c.b;
    }
    g.attributes.color.needsUpdate = true;
  }

  _rimMaterial() {
    // Spectral dressing: one shared additive edge sheen.
    if (!this._rimMat) {
      this._rimMat = new THREE.MeshBasicMaterial({
        color: '#7fe8ff', wireframe: true, transparent: true,
        opacity: 0.14, blending: THREE.AdditiveBlending, depthWrite: false,
      });
    }
    return this._rimMat;
  }

  // ------------------------------------------------------------- bodies

  _sig(snap) {
    const s = this.settings;
    return `${snap.motion}|${snap.family}|${snap.seed}|${snap.count}|${s.preset}|${s.material}`;
  }

  _syncMeshes(snap) {
    const sig = this._sig(snap);
    if (sig === this._meshSig) return;
    this._meshSig = sig;
    for (const rec of this.meshes.values()) this._removeMesh(rec);
    this.meshes.clear();
    this._dropMaterials();
    for (const b of snap.bodies) {
      const geo = this._geometry(b.shape);
      const isBox = b.shape === 'flowerbox';
      // 'auto' gets the clean solo-box material; explicit overrides keep
      // their semantics but take the six face hues via vertex colours.
      const base = isBox && this.settings.material === 'auto'
        ? this._flowerboxMaterial()
        : this._baseMaterial(b.paletteIndex);
      const mat = base.clone();
      if (isBox) {
        mat.vertexColors = true;
        mat.color.set('#ffffff');
      }
      const mesh = new THREE.Mesh(geo, mat);
      const rec = { mesh, rim: null, trail: null, last: null };
      if (this.settings.preset === 'spectral') {
        rec.rim = new THREE.Mesh(geo, this._rimMaterial());
        rec.rim.scale.setScalar(1.03);
        mesh.add(rec.rim);
      }
      // trails are created lazily in update() so the toggle works live
      this.scene.add(mesh);
      this.meshes.set(b.id, rec);
    }
    this._setSky(this.settings.preset);
    this.key.color.set(paletteOf(this.settings).light);
    // Flower Box gets a quiet near-black stage; prefs survive for the fleet.
    const solo = snap.motion === 'flowerbox';
    this.sky.visible = !solo;
    this.scene.background = solo ? this._fbBg : null;
    if (solo) this._flowerboxColors();
  }

  _removeMesh(rec) {
    this.scene.remove(rec.mesh);
    if (rec.trail) {
      this.scene.remove(rec.trail);
      rec.trail.geometry.dispose();
    }
    rec.mesh.material.dispose(); // per-body clone; geometry is cached/shared
  }

  _makeTrail(paletteIndex) {
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(TRAIL_LEN * 3);
    const col = new Float32Array(TRAIL_LEN * 3);
    const hue = new THREE.Color(paletteOf(this.settings).hues[paletteIndex % 6]);
    for (let i = 0; i < TRAIL_LEN; i++) {
      const k = (i / (TRAIL_LEN - 1)) * 0.75; // tail dim -> head brighter
      col[i * 3] = hue.r * k;
      col[i * 3 + 1] = hue.g * k;
      col[i * 3 + 2] = hue.b * k;
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const line = new THREE.Line(geo, this._trailMaterial());
    line.frustumCulled = false;
    this.scene.add(line);
    return line;
  }

  _trailMaterial() {
    if (!this._trailMat) {
      this._trailMat = new THREE.LineBasicMaterial({
        vertexColors: true, transparent: true, opacity: 0.45,
        depthWrite: false,
      });
    }
    return this._trailMat;
  }

  /** Push a point onto a trail ring buffer; resets on a teleport jump. */
  _pushTrail(rec, x, y, z) {
    const attr = rec.trail.geometry.attributes.position;
    const a = attr.array;
    if (rec.last) {
      const dx = x - rec.last[0], dy = y - rec.last[1], dz = z - rec.last[2];
      if (dx * dx + dy * dy + dz * dz > 9) {
        a.fill(0);
        for (let i = 0; i < TRAIL_LEN; i++) { a[i * 3] = x; a[i * 3 + 1] = y; a[i * 3 + 2] = z; }
      } else {
        a.copyWithin(0, 3);
        a[(TRAIL_LEN - 1) * 3] = x;
        a[(TRAIL_LEN - 1) * 3 + 1] = y;
        a[(TRAIL_LEN - 1) * 3 + 2] = z;
      }
    } else {
      for (let i = 0; i < TRAIL_LEN; i++) { a[i * 3] = x; a[i * 3 + 1] = y; a[i * 3 + 2] = z; }
    }
    rec.last = [x, y, z];
    attr.needsUpdate = true;
  }

  // -------------------------------------------------------------- public

  /** Pull the latest sample into the scene graph. */
  update(world) {
    const snap = world.sample();
    this._syncMeshes(snap);
    const solo = snap.motion === 'flowerbox';
    const trailsOn = this.settings.trails && !solo;
    // Morph the box in place, once per sim-time change: pause/reduced-motion
    // freezes it, spin 0 keeps it breathing while the pose holds.
    if (solo && snap.time !== this._fbMorphTime) {
      const g = this.geoCache.get('flowerbox');
      if (g) {
        deformFlowerBox(g.userData.base, g.attributes.position.array, snap.time);
        g.attributes.position.needsUpdate = true;
        g.computeVertexNormals(); // smooth faces follow the morph
        this._fbMorphTime = snap.time;
      }
    }
    for (const b of snap.bodies) {
      const rec = this.meshes.get(b.id);
      if (!rec) continue;
      const m = rec.mesh;
      m.position.set(b.position[0], b.position[1], b.position[2]);
      m.rotation.set(b.rotation[0], b.rotation[1], b.rotation[2]);
      m.scale.setScalar(b.scale);
      const op = b.opacity * (m.material.userData.baseOpacity ?? 1);
      m.material.opacity = op;
      m.material.transparent = op < 0.999 || m.material.userData.baseOpacity < 1;
      m.material.depthWrite = !(m.material.transparent);
      if (rec.rim) rec.rim.visible = b.opacity > 0.2;
      if (trailsOn && !rec.trail) rec.trail = this._makeTrail(b.paletteIndex);
      if (rec.trail) {
        rec.trail.visible = trailsOn && b.opacity > 0.1;
        if (trailsOn) this._pushTrail(rec, b.position[0], b.position[1], b.position[2]);
      }
    }
    this.stars.visible = this.settings.stars && !solo;
    return snap;
  }

  render() {
    if (this.contextLost) return;
    this.renderer.render(this.scene, this.camera);
    this.renders++;
  }

  /** Display-only settings: resolution economy switch + toggles. */
  setDisplay(settings) {
    this.settings = settings;
    this.resize();
  }

  resize() {
    const w = this.canvas.clientWidth || window.innerWidth;
    const h = this.canvas.clientHeight || window.innerHeight;
    const low = this.settings.lowRes;
    const scale = low
      ? Math.min(LOWRES_W / w, LOWRES_H / h, 1)
      : Math.min(window.devicePixelRatio || 1, MAX_DPR);
    this.renderer.setPixelRatio(Math.max(scale, 0.1));
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  diagnostics() {
    const i = this.renderer.info;
    return {
      calls: i.render.calls,
      triangles: i.render.triangles,
      geometries: i.memory.geometries,
      textures: i.memory.textures,
      renders: this.renders,
    };
  }
}
