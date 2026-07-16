// ψ Observatory — Lucy's mind as a 3D star map (three.js).
// Nodes are glowing stars clustered by category; links are faint gold threads.
// Interactions: drag = orbit · wheel/pinch = zoom · hover = trace · click = dossier.

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';

const REDUCE = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Cluster anchor directions — each category settles into its own region of the sky.
const ANCHORS = {
  core: [0, 0, 0, 0],
  identity: [0.25, 0.9, 0.4, 68],
  principle: [-0.8, 0.55, -0.35, 74],
  crew: [-0.95, -0.42, 0.2, 106],
  film: [1, -0.05, 0.1, 152],
  skill: [-0.45, 0.14, 1, 126],
  knowledge: [0.1, -0.95, -0.5, 120],
};

function makeStarTexture(hex) {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const ctx = c.getContext('2d');
  const col = new THREE.Color(hex);
  const r = (a) => `rgba(${(col.r * 255) | 0},${(col.g * 255) | 0},${(col.b * 255) | 0},${a})`;
  // crisp bright core (tight white centre) + defined colour halo that falls off fast
  const g = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.05, 'rgba(255,255,252,1)');
  g.addColorStop(0.12, r(0.98));
  g.addColorStop(0.24, r(0.5));
  g.addColorStop(0.46, r(0.12));
  g.addColorStop(1, r(0));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 256);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

// Soft glow aura (no hard core — the star sprite provides that). Used for the one
// standout star, คุณนุขา, so its halo reads clearly bigger than any other node's.
function makeGlowTexture(hex) {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const ctx = c.getContext('2d');
  const col = new THREE.Color(hex);
  const r = (a) => `rgba(${(col.r * 255) | 0},${(col.g * 255) | 0},${(col.b * 255) | 0},${a})`;
  const g = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
  g.addColorStop(0, r(0.85));
  g.addColorStop(0.2, r(0.44));
  g.addColorStop(0.5, r(0.14));
  g.addColorStop(0.78, r(0.03));
  g.addColorStop(1, r(0));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 256);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// Precomputed force layout — runs once at init, then the sky only breathes.
function layout(nodes, linkIdx) {
  const N = nodes.length;
  const pos = new Float32Array(N * 3);
  const vel = new Float32Array(N * 3);
  const anchor = new Float32Array(N * 3);

  for (let i = 0; i < N; i++) {
    const a = ANCHORS[nodes[i].cat] || ANCHORS.skill;
    const len = Math.hypot(a[0], a[1], a[2]) || 1;
    const R = a[3];
    const spread = nodes[i].cat === 'film' ? 66 : nodes[i].cat === 'core' ? 0 : 44;
    anchor[i * 3] = (a[0] / len) * R;
    anchor[i * 3 + 1] = (a[1] / len) * R;
    anchor[i * 3 + 2] = (a[2] / len) * R;
    // deterministic-ish scatter (golden-angle spiral per index) so layout is stable
    const t = i * 2.39996;
    const u = ((i * 0.618034) % 1) * 2 - 1;
    const rr = Math.sqrt(1 - u * u) * spread;
    pos[i * 3] = anchor[i * 3] + Math.cos(t) * rr;
    pos[i * 3 + 1] = anchor[i * 3 + 1] + u * spread;
    pos[i * 3 + 2] = anchor[i * 3 + 2] + Math.sin(t) * rr;
  }

  const ITER = 260;
  for (let it = 0; it < ITER; it++) {
    // pairwise repulsion
    for (let i = 0; i < N; i++) {
      for (let j = i + 1; j < N; j++) {
        let dx = pos[i * 3] - pos[j * 3];
        let dy = pos[i * 3 + 1] - pos[j * 3 + 1];
        let dz = pos[i * 3 + 2] - pos[j * 3 + 2];
        const d2 = dx * dx + dy * dy + dz * dz + 1;
        const f = 620 / d2;
        const d = Math.sqrt(d2);
        dx = (dx / d) * f; dy = (dy / d) * f; dz = (dz / d) * f;
        vel[i * 3] += dx; vel[i * 3 + 1] += dy; vel[i * 3 + 2] += dz;
        vel[j * 3] -= dx; vel[j * 3 + 1] -= dy; vel[j * 3 + 2] -= dz;
      }
    }
    // springs along links
    for (const [a, b] of linkIdx) {
      let dx = pos[b * 3] - pos[a * 3];
      let dy = pos[b * 3 + 1] - pos[a * 3 + 1];
      let dz = pos[b * 3 + 2] - pos[a * 3 + 2];
      const d = Math.hypot(dx, dy, dz) || 1;
      const rest = nodes[a].cat === nodes[b].cat ? 34 : 62;
      const f = (d - rest) * 0.015;
      dx = (dx / d) * f; dy = (dy / d) * f; dz = (dz / d) * f;
      vel[a * 3] += dx; vel[a * 3 + 1] += dy; vel[a * 3 + 2] += dz;
      vel[b * 3] -= dx; vel[b * 3 + 1] -= dy; vel[b * 3 + 2] -= dz;
    }
    // anchor gravity + integrate
    for (let i = 0; i < N; i++) {
      vel[i * 3] += (anchor[i * 3] - pos[i * 3]) * 0.012;
      vel[i * 3 + 1] += (anchor[i * 3 + 1] - pos[i * 3 + 1]) * 0.012;
      vel[i * 3 + 2] += (anchor[i * 3 + 2] - pos[i * 3 + 2]) * 0.012;
      pos[i * 3] += (vel[i * 3] *= 0.82);
      pos[i * 3 + 1] += (vel[i * 3 + 1] *= 0.82);
      pos[i * 3 + 2] += (vel[i * 3 + 2] *= 0.82);
    }
  }
  // normalize overall radius, then stretch horizontally to fill the wide stage
  let maxR = 1;
  for (let i = 0; i < N; i++) {
    maxR = Math.max(maxR, Math.hypot(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]));
  }
  const s = 172 / maxR;
  for (let i = 0; i < N; i++) {
    pos[i * 3] *= s * 1.24;
    pos[i * 3 + 1] *= s * 0.92;
    pos[i * 3 + 2] *= s;
  }
  return pos;
}

export function initObservatory() {
  const stage = document.getElementById('obs-stage');
  const canvas = document.getElementById('obs-canvas');
  const dataEl = document.getElementById('obs-data');
  if (!stage || !canvas || !dataEl || stage.dataset.ready) return;
  stage.dataset.ready = '1';

  const panel = document.getElementById('obs-panel');
  const tooltip = document.getElementById('obs-tip');
  const labelsBox = document.getElementById('obs-labels');
  const chipsBox = document.getElementById('obs-chips');
  const resetBtn = document.getElementById('obs-reset');

  const { nodes, links, cats } = JSON.parse(dataEl.textContent || '{}');
  const idOf = new Map(nodes.map((n, i) => [n.id, i]));
  const linkIdx = links
    .map(([a, b]) => [idOf.get(a), idOf.get(b)])
    .filter(([a, b]) => a !== undefined && b !== undefined);
  const neighbors = nodes.map(() => []);
  for (const [a, b] of linkIdx) { neighbors[a].push(b); neighbors[b].push(a); }

  let renderer;
  try {
    // antialias:false is deliberate — see the composer below. With an EffectComposer the canvas
    // never sees a triangle edge, so a multisampled canvas is pure waste.
    renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: true, powerPreference: 'high-performance' });
  } catch {
    stage.classList.add('no-webgl');
    return;
  }
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x04050c); // deep space
  scene.fog = new THREE.FogExp2(0x04050c, 0.0016); // distance haze for depth
  const camera = new THREE.PerspectiveCamera(55, 1, 1, 2500);
  const HOME = new THREE.Vector3(28, 16, 312);
  camera.position.copy(HOME);

  // bloom pipeline — real glow, the difference between "bright" and "burning"
  // AA has to live on the composer's buffers, not on the canvas: the last pass is a fullscreen
  // quad, and a quad has no edges to antialias. A multisampled canvas would be resolved and
  // thrown away every frame while the 126 link threads stayed jagged — paying for AA and not
  // getting it. Handing the composer a multisampled target puts the samples where the geometry
  // actually is. `samples` survives clone() and setSize(), and three clamps it to MAX_SAMPLES.
  const composer = new EffectComposer(
    renderer,
    new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 }), // sized by resize()
  );
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 1.15, 0.72, 0.3);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());

  // in-scene nebula tints (the stage background now lives inside the scene)
  {
    const soft = (hex) => {
      const c = document.createElement('canvas');
      c.width = c.height = 128;
      const ctx = c.getContext('2d');
      const col = new THREE.Color(hex);
      const r = (a) => `rgba(${(col.r * 255) | 0},${(col.g * 255) | 0},${(col.b * 255) | 0},${a})`;
      const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
      g.addColorStop(0, r(0.55));
      g.addColorStop(1, r(0));
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 128, 128);
      const t = new THREE.CanvasTexture(c);
      t.colorSpace = THREE.SRGBColorSpace;
      return t;
    };
    const neb = (hex, x, y, z, s, op) => {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({
        map: soft(hex), transparent: true, opacity: op, depthWrite: false, blending: THREE.AdditiveBlending,
      }));
      sp.position.set(x, y, z);
      sp.scale.setScalar(s);
      sp.renderOrder = -1;
      scene.add(sp);
    };
    // cool deep-space nebula clouds + one faint gold accent (Lucy's identity)
    neb(0x24408f, 300, 150, -820, 1560, 0.18);
    neb(0x6a2f9c, -350, -180, -880, 1360, 0.15);
    neb(0x146a72, -40, 300, -980, 1060, 0.1);
    neb(0xe49e22, 220, -220, -720, 820, 0.05);
  }

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.06;
  controls.enablePan = false;
  controls.minDistance = 70;
  controls.maxDistance = 640;
  controls.autoRotate = !REDUCE;
  controls.autoRotateSpeed = 0.5;

  const basePos = layout(nodes, linkIdx);

  // ── คุณนุขา sits apart, near Lucy but clearly out of the identity huddle ──
  // Creative direction (2026-07-16): nukha's node carries a single lucy↔nukha thread,
  // so we pin it to its own pocket instead of letting the force layout bury it among the
  // other identity stars. Coords are in final layout space (post-normalise); this spot is
  // ~42u from the nearest node (clear pocket) and pulled forward (+z) so perspective lifts
  // it toward the viewer. Measured: 76u from the nearest identity member vs ~28u before.
  const nukhaIdx = idOf.get('nukha');
  if (nukhaIdx !== undefined) {
    basePos[nukhaIdx * 3] = -72;
    basePos[nukhaIdx * 3 + 1] = 37;
    basePos[nukhaIdx * 3 + 2] = 68;
  }

  const livePos = new Float32Array(basePos);

  // deep-space starfield — 1300 tiny stars, cool white with blue/gold flecks
  {
    const D = 1300;
    const dust = new Float32Array(D * 3);
    const col = new Float32Array(D * 3);
    const cWhite = new THREE.Color(0xffffff);
    const cCool = new THREE.Color(0xbcd4ff);
    const cWarm = new THREE.Color(0xffe9c2);
    for (let i = 0; i < D; i++) {
      const r = 360 + Math.random() * 900;
      const th = Math.random() * Math.PI * 2;
      const u = Math.random() * 2 - 1;
      const s = Math.sqrt(1 - u * u);
      dust[i * 3] = r * s * Math.cos(th);
      dust[i * 3 + 1] = r * u;
      dust[i * 3 + 2] = r * s * Math.sin(th);
      const pick = Math.random();
      const cc = pick < 0.62 ? cWhite : pick < 0.85 ? cCool : cWarm;
      const b = 0.35 + Math.random() * 0.65;
      col[i * 3] = cc.r * b;
      col[i * 3 + 1] = cc.g * b;
      col[i * 3 + 2] = cc.b * b;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(dust, 3));
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const m = new THREE.PointsMaterial({
      size: 1.6, sizeAttenuation: true, vertexColors: true, fog: false,
      transparent: true, opacity: 0.85, depthWrite: false, blending: THREE.AdditiveBlending,
    });
    scene.add(new THREE.Points(g, m));
  }

  // link lines
  const linkGeo = new THREE.BufferGeometry();
  const linkPos = new Float32Array(linkIdx.length * 6);
  const linkCol = new Float32Array(linkIdx.length * 6);
  linkGeo.setAttribute('position', new THREE.BufferAttribute(linkPos, 3));
  linkGeo.setAttribute('color', new THREE.BufferAttribute(linkCol, 3));
  const linkMat = new THREE.LineBasicMaterial({
    vertexColors: true, transparent: true, opacity: 0.85,
    blending: THREE.AdditiveBlending, depthWrite: false,
  });
  const linkMesh = new THREE.LineSegments(linkGeo, linkMat);
  linkMesh.renderOrder = 0;
  scene.add(linkMesh);

  // star sprites — one texture per category
  const tex = {};
  for (const k in cats) tex[k] = makeStarTexture(cats[k].color);
  const sprites = nodes.map((n, i) => {
    const m = new THREE.SpriteMaterial({
      map: tex[n.cat], transparent: true, depthWrite: false,
      blending: THREE.AdditiveBlending, opacity: 0.96,
    });
    const s = new THREE.Sprite(m);
    s.userData.i = i;
    s.userData.base = 7.5 + (n.w || 1) * 6.5;
    s.userData.scale = s.userData.base;
    s.renderOrder = 1;
    scene.add(s);
    return s;
  });

  // dedicated glow aura for คุณนุขา — the one star that carries an extra halo, so it is
  // unmistakably the standout: its core is now the largest node (brain.ts w 3.6 → base 30.9,
  // vs Lucy's w 3.0 → 27.0) AND only it wears this soft aura, so its footprint clearly wins.
  // Warm rose (#FF7EB0) is nukha's own colour — set apart from Lucy's gold, on her single thread.
  let nukhaHalo = null;
  if (nukhaIdx !== undefined) {
    nukhaHalo = new THREE.Sprite(new THREE.SpriteMaterial({
      map: makeGlowTexture('#FF7EB0'), transparent: true, opacity: 0.62,
      depthWrite: false, blending: THREE.AdditiveBlending,
    }));
    nukhaHalo.renderOrder = 0.5; // above links/nebula, below the crisp star cores
    scene.add(nukhaHalo);
  }

  const catVisible = Object.fromEntries(Object.keys(cats).map((k) => [k, true]));
  let hover = -1;
  let selected = -1;
  const camTarget = new THREE.Vector3(0, 0, 0);

  const linkColor = (i, hot) => {
    const [a, b] = linkIdx[i];
    const ca = new THREE.Color(cats[nodes[a].cat].color);
    const cb = new THREE.Color(cats[nodes[b].cat].color);
    const m = hot ? 0.9 : 0.17;
    ca.multiplyScalar(m); cb.multiplyScalar(m);
    linkCol[i * 6] = ca.r; linkCol[i * 6 + 1] = ca.g; linkCol[i * 6 + 2] = ca.b;
    linkCol[i * 6 + 3] = cb.r; linkCol[i * 6 + 4] = cb.g; linkCol[i * 6 + 5] = cb.b;
  };

  function paintLinks() {
    const focus = selected >= 0 ? selected : hover;
    for (let i = 0; i < linkIdx.length; i++) {
      const [a, b] = linkIdx[i];
      const on = catVisible[nodes[a].cat] && catVisible[nodes[b].cat];
      const hot = focus >= 0 && (a === focus || b === focus);
      if (!on) {
        linkCol[i * 6] = linkCol[i * 6 + 1] = linkCol[i * 6 + 2] = 0;
        linkCol[i * 6 + 3] = linkCol[i * 6 + 4] = linkCol[i * 6 + 5] = 0;
      } else linkColor(i, hot);
    }
    linkGeo.attributes.color.needsUpdate = true;
  }

  function paintNodes() {
    const focus = selected >= 0 ? selected : hover;
    for (let i = 0; i < nodes.length; i++) {
      const sp = sprites[i];
      sp.visible = catVisible[nodes[i].cat];
      const isFocus = i === focus;
      const isNb = focus >= 0 && neighbors[focus].includes(i);
      sp.material.opacity = focus < 0 ? 0.96 : isFocus ? 1 : isNb ? 0.98 : 0.28;
      sp.userData.target = sp.userData.base * (isFocus ? 1.5 : isNb ? 1.12 : 1);
    }
  }

  // ── dossier panel ──────────────────────────────────────────────────────
  function showPanel(i) {
    const n = nodes[i];
    const rel = neighbors[i]
      .filter((j) => catVisible[nodes[j].cat])
      .slice(0, 8)
      .map((j) => `<button class="obs-rel" data-i="${j}"><i style="background:${cats[nodes[j].cat].color}"></i>${nodes[j].label}</button>`)
      .join('');
    panel.innerHTML = `
      <button class="obs-close" id="obs-close" aria-label="ปิดแฟ้ม">×</button>
      <p class="obs-kicker" style="color:${cats[n.cat].color}">● ${cats[n.cat].label}</p>
      <h3>${n.label}</h3>
      ${n.meta ? `<p class="obs-meta">${n.meta}</p>` : ''}
      <p class="obs-detail">${n.detail}</p>
      ${rel ? `<p class="obs-relhead">โยงกับ</p><div class="obs-rels">${rel}</div>` : ''}`;
    panel.classList.add('open');
    panel.querySelector('#obs-close').addEventListener('click', deselect);
    panel.querySelectorAll('.obs-rel').forEach((b) =>
      b.addEventListener('click', () => select(+b.dataset.i)));
  }

  function select(i) {
    selected = i;
    camTarget.set(livePos[i * 3], livePos[i * 3 + 1], livePos[i * 3 + 2]);
    showPanel(i);
    paintNodes(); paintLinks();
  }
  function deselect() {
    selected = -1;
    camTarget.set(0, 0, 0);
    panel.classList.remove('open');
    paintNodes(); paintLinks();
  }
  window.addEventListener('keydown', (e) => { if (e.key === 'Escape') deselect(); });
  if (resetBtn) resetBtn.addEventListener('click', () => {
    deselect();
    camera.position.copy(HOME);
  });

  // ── legend / filter chips ──────────────────────────────────────────────
  if (chipsBox) {
    const countBy = {};
    nodes.forEach((n) => (countBy[n.cat] = (countBy[n.cat] || 0) + 1));
    for (const k of Object.keys(cats)) {
      if (k === 'core') continue;
      const b = document.createElement('button');
      b.className = 'obs-chip on';
      b.innerHTML = `<i style="background:${cats[k].color}"></i>${cats[k].label} <span>${countBy[k] || 0}</span>`;
      b.addEventListener('click', () => {
        catVisible[k] = !catVisible[k];
        b.classList.toggle('on', catVisible[k]);
        if (selected >= 0 && !catVisible[nodes[selected].cat]) deselect();
        paintNodes(); paintLinks();
      });
      chipsBox.appendChild(b);
    }
  }

  // ── persistent labels for the biggest stars ────────────────────────────
  const labeled = [];
  nodes.forEach((n, i) => {
    if ((n.w || 1) >= 2) {
      const d = document.createElement('div');
      d.className = n.cat === 'core' ? 'obs-label obs-label-core' : 'obs-label';
      d.textContent = n.label;
      d.style.color = cats[n.cat].color;
      labelsBox.appendChild(d);
      labeled.push([i, d]);
    }
  });

  // ── pointer interaction ────────────────────────────────────────────────
  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  let downAt = 0, downX = 0, downY = 0;

  function pick(e) {
    const r = canvas.getBoundingClientRect();
    ndc.x = ((e.clientX - r.left) / r.width) * 2 - 1;
    ndc.y = -((e.clientY - r.top) / r.height) * 2 + 1;
    ray.setFromCamera(ndc, camera);
    const hits = ray.intersectObjects(sprites.filter((s) => s.visible), false);
    return hits.length ? hits[0].object.userData.i : -1;
  }
  canvas.addEventListener('pointermove', (e) => {
    const i = pick(e);
    if (i !== hover) {
      hover = i;
      canvas.style.cursor = i >= 0 ? 'pointer' : 'grab';
      paintNodes(); paintLinks();
    }
    if (i >= 0 && tooltip) {
      const sr = stage.getBoundingClientRect();
      tooltip.innerHTML = `<i style="background:${cats[nodes[i].cat].color}"></i>${nodes[i].label}`;
      tooltip.style.left = `${e.clientX - sr.left}px`;
      tooltip.style.top = `${e.clientY - sr.top - 16}px`;
      tooltip.classList.add('show');
    } else if (tooltip) tooltip.classList.remove('show');
  });
  canvas.addEventListener('pointerleave', () => {
    hover = -1; tooltip && tooltip.classList.remove('show');
    paintNodes(); paintLinks();
  });
  canvas.addEventListener('pointerdown', (e) => {
    downAt = performance.now(); downX = e.clientX; downY = e.clientY;
    controls.autoRotate = false;
  });
  canvas.addEventListener('pointerup', (e) => {
    const still = Math.hypot(e.clientX - downX, e.clientY - downY) < 6;
    if (still && performance.now() - downAt < 420) {
      const i = pick(e);
      if (i >= 0) select(i); else deselect();
    }
    if (!REDUCE) idleTimer = setTimeout(() => (controls.autoRotate = true), 7000);
  });
  let idleTimer = 0;
  canvas.addEventListener('pointerdown', () => clearTimeout(idleTimer));

  // ── frame loop ─────────────────────────────────────────────────────────
  // Two INDEPENDENT gates, deliberately not merged into one flag.
  // A single `running` latch cannot survive a tab switch: visibilitychange only
  // fires on CHANGE, and the IntersectionObserver does not re-fire on tab return
  // (intersection never changed) — so nothing would ever set it back to true and
  // the star map stayed dead until you scrolled it out of view and back.
  let onScreen = true;
  let tabVisible = !document.hidden;
  const io = new IntersectionObserver(([en]) => { onScreen = en.isIntersecting; }, { threshold: 0.02 });
  io.observe(stage);
  document.addEventListener('visibilitychange', () => { tabVisible = !document.hidden; });

  // pull the camera back on narrow stages so the whole galaxy fits the frame
  let fitDone = false;
  function fitHome() {
    const halfV = Math.tan((camera.fov * Math.PI) / 360);
    const halfH = halfV * camera.aspect;
    const z = Math.min(560, Math.max(300, 165 / Math.min(halfV, halfH)));
    const wasHome = camera.position.distanceTo(HOME) < 2;
    HOME.set(0.09 * z, 0.05 * z, z);
    if (wasHome || !fitDone) {
      camera.position.copy(HOME);
      fitDone = true;
    }
  }
  function resize() {
    const w = stage.clientWidth, h = stage.clientHeight;
    const pr = Math.min(window.devicePixelRatio || 1, 2);
    renderer.setPixelRatio(pr);
    renderer.setSize(w, h, false);
    composer.setPixelRatio(pr);
    composer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    fitHome();
  }
  new ResizeObserver(resize).observe(stage);
  resize();

  const v3 = new THREE.Vector3();
  let t0 = performance.now();

  function frame(now) {
    requestAnimationFrame(frame);
    if (!onScreen || !tabVisible) return;
    const t = (now - t0) / 1000;

    // breathe — gentle per-star float
    for (let i = 0; i < nodes.length; i++) {
      const fl = REDUCE ? 0 : 1;
      livePos[i * 3] = basePos[i * 3] + Math.sin(t * 0.5 + i * 1.7) * 1.4 * fl;
      livePos[i * 3 + 1] = basePos[i * 3 + 1] + Math.cos(t * 0.42 + i * 2.3) * 1.6 * fl;
      livePos[i * 3 + 2] = basePos[i * 3 + 2] + Math.sin(t * 0.36 + i * 0.9) * 1.4 * fl;
      sprites[i].position.set(livePos[i * 3], livePos[i * 3 + 1], livePos[i * 3 + 2]);
      const ud = sprites[i].userData;
      ud.scale += ((ud.target || ud.base) - ud.scale) * 0.14;
      const tw = REDUCE ? 1 : 1 + 0.07 * Math.sin(t * 1.7 + i * 1.31);
      sprites[i].scale.setScalar(ud.scale * tw);
    }
    // nukha's aura rides its star — same position + breathing, ~3.2× the radius,
    // and it inherits the star's hover/select growth. Hidden when identity is filtered off.
    if (nukhaHalo) {
      const sp = sprites[nukhaIdx];
      nukhaHalo.visible = sp.visible;
      if (sp.visible) {
        nukhaHalo.position.copy(sp.position);
        nukhaHalo.scale.setScalar(sp.scale.x * 3.2);
      }
    }
    for (let i = 0; i < linkIdx.length; i++) {
      const [a, b] = linkIdx[i];
      linkPos[i * 6] = livePos[a * 3]; linkPos[i * 6 + 1] = livePos[a * 3 + 1]; linkPos[i * 6 + 2] = livePos[a * 3 + 2];
      linkPos[i * 6 + 3] = livePos[b * 3]; linkPos[i * 6 + 4] = livePos[b * 3 + 1]; linkPos[i * 6 + 5] = livePos[b * 3 + 2];
    }
    linkGeo.attributes.position.needsUpdate = true;

    controls.target.lerp(camTarget, 0.06);
    controls.update();
    composer.render();

    // project labels
    const w = stage.clientWidth, h = stage.clientHeight;
    for (const [i, el] of labeled) {
      if (!catVisible[nodes[i].cat]) { el.style.opacity = '0'; continue; }
      v3.set(livePos[i * 3], livePos[i * 3 + 1], livePos[i * 3 + 2]).project(camera);
      if (v3.z > 1) { el.style.opacity = '0'; continue; }
      el.style.transform = `translate(${(((v3.x * 0.5 + 0.5) * w) | 0) + 9}px, ${(((-v3.y * 0.5 + 0.5) * h) | 0) - 15}px)`;
      const dim = selected >= 0 && selected !== i && !neighbors[selected].includes(i);
      el.style.opacity = dim ? '0.12' : String(Math.min(1, Math.max(0.42, 1.3 - v3.z)));
    }
  }

  paintLinks(); paintNodes();
  requestAnimationFrame(frame);
}
