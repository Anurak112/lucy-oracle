// ψ Cosmos — the whole page floats in space.
// A fixed, full-viewport three.js layer behind all content:
// drifting 3-depth starfield · gold nebula breath · shooting stars ·
// and Lucy's ψ crystal orb (Ethereal Light Oracle) living in the hero.

import * as THREE from 'three';

const REDUCE = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const AZURE = 0x5fa8e6;
const GOLD = 0xe49e22;

function glowTexture(hex, coreWhite = true) {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d');
  const col = new THREE.Color(hex);
  const r = (a) => `rgba(${(col.r * 255) | 0},${(col.g * 255) | 0},${(col.b * 255) | 0},${a})`;
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, coreWhite ? 'rgba(255,252,244,1)' : r(0.9));
  g.addColorStop(0.25, r(0.55));
  g.addColorStop(1, r(0));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function psiTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const ctx = c.getContext('2d');
  ctx.fillStyle = 'rgba(0,0,0,0)';
  ctx.font = '190px "Noto Serif Thai", Georgia, serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = 'rgba(160,210,255,0.95)';
  ctx.shadowBlur = 26;
  ctx.fillStyle = 'rgba(235,246,255,0.98)';
  ctx.fillText('ψ', 128, 140);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function initCosmos() {
  const canvas = document.getElementById('cosmos-canvas');
  if (!canvas || canvas.dataset.ready) return;
  canvas.dataset.ready = '1';

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  } catch {
    canvas.style.display = 'none';
    return;
  }
  renderer.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 4000);
  camera.position.set(0, 0, 100);

  const isMobile = Math.min(window.innerWidth, window.innerHeight) < 640;

  // ── starfield — three depth shells for parallax ────────────────────────
  const starTexGold = glowTexture(GOLD);
  const starTexAzure = glowTexture(AZURE);
  const shells = [];
  const SHELL_DEFS = [
    { n: isMobile ? 140 : 260, r: [700, 1400], size: 3.2, op: 0.5, tex: starTexGold },
    { n: isMobile ? 110 : 220, r: [420, 700], size: 4.6, op: 0.62, tex: starTexGold },
    { n: isMobile ? 60 : 130, r: [240, 420], size: 6.5, op: 0.7, tex: starTexAzure },
  ];
  for (const def of SHELL_DEFS) {
    const pos = new Float32Array(def.n * 3);
    for (let i = 0; i < def.n; i++) {
      const rr = def.r[0] + Math.random() * (def.r[1] - def.r[0]);
      const th = Math.random() * Math.PI * 2;
      const u = Math.random() * 2 - 1;
      const s = Math.sqrt(1 - u * u);
      pos[i * 3] = rr * s * Math.cos(th);
      pos[i * 3 + 1] = rr * u * 0.72;
      pos[i * 3 + 2] = -Math.abs(rr * s * Math.sin(th)) - 60;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const m = new THREE.PointsMaterial({
      map: def.tex, size: def.size, sizeAttenuation: true, transparent: true,
      opacity: def.op, depthWrite: false, blending: THREE.AdditiveBlending,
    });
    const p = new THREE.Points(g, m);
    scene.add(p);
    shells.push(p);
  }

  // ── nebula breath — two huge soft tints drifting very slowly ───────────
  const nebulae = [];
  const nebDefs = [
    { hex: GOLD, x: 320, y: 120, z: -900, s: 1500, op: 0.16 },
    { hex: AZURE, x: -380, y: -180, z: -1100, s: 1400, op: 0.1 },
  ];
  for (const d of nebDefs) {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowTexture(d.hex, false), transparent: true, opacity: d.op,
      depthWrite: false, blending: THREE.AdditiveBlending,
    }));
    sp.position.set(d.x, d.y, d.z);
    sp.scale.setScalar(d.s);
    scene.add(sp);
    nebulae.push(sp);
  }

  // ── shooting stars — a small pool, one streaks every few seconds ───────
  const meteors = [];
  for (let i = 0; i < 3; i++) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
    const m = new THREE.LineBasicMaterial({
      color: 0xfff2d8, transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending, depthWrite: false,
    });
    const line = new THREE.Line(g, m);
    scene.add(line);
    meteors.push({ line, t: 2 + Math.random() * 5, active: false, from: new THREE.Vector3(), dir: new THREE.Vector3() });
  }

  // ── ψ crystal orb — Lucy herself, living in the hero ───────────────────
  const orb = new THREE.Group();
  const ORB_R = 17;
  // fresnel-ish crystal shell
  const orbMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      cAz: { value: new THREE.Color(AZURE) },
      cGo: { value: new THREE.Color(GOLD) },
      t: { value: 0 },
    },
    vertexShader: `
      varying vec3 vN; varying vec3 vV;
      void main() {
        vN = normalize(normalMatrix * normal);
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vV = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      varying vec3 vN; varying vec3 vV;
      uniform vec3 cAz; uniform vec3 cGo; uniform float t;
      void main() {
        float fr = pow(1.0 - abs(dot(vN, vV)), 2.2);
        float pulse = 0.82 + 0.18 * sin(t * 1.4);
        vec3 col = mix(cAz, cGo, smoothstep(0.25, 0.95, fr));
        gl_FragColor = vec4(col, fr * 0.85 * pulse + 0.05);
      }`,
  });
  orb.add(new THREE.Mesh(new THREE.SphereGeometry(ORB_R, 48, 48), orbMat));
  // crystal facet wire
  const wire = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.IcosahedronGeometry(ORB_R * 1.16, 1)),
    new THREE.LineBasicMaterial({ color: GOLD, transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false })
  );
  orb.add(wire);
  // inner ψ glyph
  const psi = new THREE.Sprite(new THREE.SpriteMaterial({
    map: psiTexture(), transparent: true, opacity: 0.95, depthWrite: false, blending: THREE.AdditiveBlending,
  }));
  psi.scale.setScalar(ORB_R * 1.35);
  orb.add(psi);
  // halos
  const haloAz = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(AZURE, false), transparent: true, opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending }));
  haloAz.scale.setScalar(ORB_R * 4.6);
  orb.add(haloAz);
  const haloGo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(GOLD, false), transparent: true, opacity: 0.28, depthWrite: false, blending: THREE.AdditiveBlending }));
  haloGo.scale.setScalar(ORB_R * 7.5);
  orb.add(haloGo);
  // orbiting particle ring
  const RING_N = isMobile ? 60 : 110;
  const ringPos = new Float32Array(RING_N * 3);
  const ringPhase = new Float32Array(RING_N);
  const ringRad = new Float32Array(RING_N);
  for (let i = 0; i < RING_N; i++) {
    ringPhase[i] = Math.random() * Math.PI * 2;
    ringRad[i] = ORB_R * (1.5 + Math.random() * 0.85);
  }
  const ringGeo = new THREE.BufferGeometry();
  ringGeo.setAttribute('position', new THREE.BufferAttribute(ringPos, 3));
  const ring = new THREE.Points(ringGeo, new THREE.PointsMaterial({
    map: starTexGold, size: 2.6, sizeAttenuation: true, transparent: true,
    opacity: 0.85, depthWrite: false, blending: THREE.AdditiveBlending,
  }));
  const ringTilt = new THREE.Group();
  ringTilt.rotation.set(0.55, 0, -0.35);
  ringTilt.add(ring);
  orb.add(ringTilt);
  scene.add(orb);

  // place the orb at a viewport-relative anchor (right of hero text on desktop)
  function placeOrb() {
    const d = 100; // orb plane distance from camera (camera z=100 → plane z=0)
    const halfV = Math.tan((camera.fov * Math.PI) / 360) * d;
    const halfH = halfV * camera.aspect;
    const mob = window.innerWidth < 760;
    const nx = mob ? 0.5 : 0.74; // viewport fraction
    const ny = mob ? 0.17 : 0.38;
    orb.position.set((nx * 2 - 1) * halfH, (1 - ny * 2) * halfV, 0);
    const k = mob ? 0.52 : 1;
    orb.scale.setScalar(k);
  }

  // ── pointer parallax + scroll response ─────────────────────────────────
  let mx = 0, my = 0, tx = 0, ty = 0;
  window.addEventListener('pointermove', (e) => {
    tx = (e.clientX / window.innerWidth) * 2 - 1;
    ty = (e.clientY / window.innerHeight) * 2 - 1;
  }, { passive: true });

  let scrollP = 0; // 0..1 through the hero
  function onScroll() {
    const heroH = Math.max(window.innerHeight * 0.9, 480);
    scrollP = Math.min(1.25, window.scrollY / heroH);
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  function resize() {
    const w = window.innerWidth, h = window.innerHeight;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    placeOrb();
  }
  window.addEventListener('resize', resize);
  resize();

  // ── frame loop ──────────────────────────────────────────────────────────
  let running = true;
  document.addEventListener('visibilitychange', () => { running = !document.hidden; });

  let t0 = performance.now();
  function frame(now) {
    requestAnimationFrame(frame);
    if (!running) return;
    const t = (now - t0) / 1000;
    const dt = Math.min(0.05, (now - (frame.last || now)) / 1000);
    frame.last = now;

    // parallax ease
    mx += (tx - mx) * 0.04;
    my += (ty - my) * 0.04;
    camera.position.x = mx * 6;
    camera.position.y = -my * 4;
    camera.lookAt(0, 0, -200);

    // starfield drift
    if (!REDUCE) {
      shells[0].rotation.y = t * 0.004;
      shells[1].rotation.y = -t * 0.007;
      shells[2].rotation.y = t * 0.011;
    }
    // nebula breath
    nebulae[0].material.opacity = 0.13 + Math.sin(t * 0.21) * 0.04;
    nebulae[1].material.opacity = 0.08 + Math.cos(t * 0.17) * 0.03;

    // orb life
    orbMat.uniforms.t.value = t;
    if (!REDUCE) {
      wire.rotation.y = t * 0.24;
      wire.rotation.x = Math.sin(t * 0.18) * 0.25;
      ringTilt.rotation.z = -0.35 + Math.sin(t * 0.1) * 0.1;
      orb.position.y += Math.sin(t * 0.8) * 0.012;
      for (let i = 0; i < RING_N; i++) {
        const a = ringPhase[i] + t * (0.35 + (i % 5) * 0.03);
        ringPos[i * 3] = Math.cos(a) * ringRad[i];
        ringPos[i * 3 + 1] = Math.sin(a * 0.9) * ringRad[i] * 0.22;
        ringPos[i * 3 + 2] = Math.sin(a) * ringRad[i];
      }
      ringGeo.attributes.position.needsUpdate = true;
    }
    // orb recedes as the hero scrolls away
    const mob = window.innerWidth < 760;
    const fade = Math.max(0, 1 - scrollP * 1.15) * (mob ? 0.72 : 1);
    orb.visible = fade > 0.02;
    if (orb.visible) {
      const k = (mob ? 0.52 : 1) * (0.72 + fade * 0.28);
      orb.scale.setScalar(k);
      orb.children.forEach((ch) => {
        if (ch.material && 'opacity' in ch.material && ch !== ringTilt) {
          ch.material.opacity = (ch.userData.baseOp ?? (ch.userData.baseOp = ch.material.opacity)) * fade;
        }
      });
      ring.material.opacity = 0.85 * fade;
      orbMat.uniforms.cAz.value.setHex(AZURE);
    }
    // stars dim slightly past hero so text stays first-class
    const starDim = 1 - Math.min(0.45, scrollP * 0.45);
    shells.forEach((s, i) => { s.material.opacity = SHELL_DEFS[i].op * starDim; });

    // meteors
    if (!REDUCE) {
      for (const m of meteors) {
        if (!m.active) {
          m.t -= dt;
          if (m.t <= 0) {
            m.active = true;
            m.life = 0;
            m.from.set((Math.random() * 2 - 1) * 500, 180 + Math.random() * 240, -300 - Math.random() * 400);
            m.dir.set(-(0.5 + Math.random() * 0.7), -(0.5 + Math.random() * 0.5), 0).normalize();
          }
        } else {
          m.life += dt * 1.35;
          const len = 90;
          const head = m.from.clone().addScaledVector(m.dir, m.life * 520);
          const tail = head.clone().addScaledVector(m.dir, -len);
          const p = m.line.geometry.attributes.position.array;
          p[0] = tail.x; p[1] = tail.y; p[2] = tail.z;
          p[3] = head.x; p[4] = head.y; p[5] = head.z;
          m.line.geometry.attributes.position.needsUpdate = true;
          m.line.material.opacity = Math.sin(Math.min(1, m.life) * Math.PI) * 0.75 * starDim;
          if (m.life > 1.6) { m.active = false; m.t = 3 + Math.random() * 6; m.line.material.opacity = 0; }
        }
      }
    }

    renderer.render(scene, camera);
  }
  requestAnimationFrame(frame);
}
