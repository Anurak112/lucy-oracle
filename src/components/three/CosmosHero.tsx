// ψ Cosmos Hero — the fixed sky behind the whole page, rebuilt on R3F + drei.
// A real glass oracle orb (MeshTransmissionMaterial refracting the starfield),
// gold sparkle dust, drifting stars, shooting stars, bloom.

import { useMemo, useRef, useState, useEffect } from 'react';
import { Canvas, useFrame, useThree, invalidate } from '@react-three/fiber';
import { Stars, Sparkles, Float, Environment, Lightformer } from '@react-three/drei';
import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing';
import * as THREE from 'three';

const GOLD = '#e49e22';
const GOLD_2 = '#f0b84b';
const AZURE = '#5fa8e6';

const REDUCE =
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function usePsiTexture() {
  return useMemo(() => {
    const c = document.createElement('canvas');
    c.width = c.height = 256;
    const ctx = c.getContext('2d')!;
    ctx.font = '190px "Noto Serif Thai", Georgia, serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(170,215,255,0.95)';
    ctx.shadowBlur = 30;
    ctx.fillStyle = 'rgba(240,248,255,0.98)';
    ctx.fillText('ψ', 128, 140);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, []);
}

function useGlowTexture(hex: string) {
  return useMemo(() => {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const ctx = c.getContext('2d')!;
    const col = new THREE.Color(hex);
    const r = (a: number) =>
      `rgba(${(col.r * 255) | 0},${(col.g * 255) | 0},${(col.b * 255) | 0},${a})`;
    const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, 'rgba(255,252,244,1)');
    g.addColorStop(0.25, r(0.6));
    g.addColorStop(1, r(0));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 128, 128);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, [hex]);
}

/** scroll progress through the hero, shared via ref to avoid re-renders */
function useScrollP() {
  const p = useRef(0);
  useEffect(() => {
    const on = () => {
      const heroH = Math.max(window.innerHeight * 0.9, 480);
      p.current = Math.min(1.25, window.scrollY / heroH);
      // Under REDUCE the canvas runs frameloop="demand", so scroll is the only
      // thing left that must still repaint: the orb's dissolve reads this ref
      // from useFrame. invalidate() is a flag, not a render — spamming it is
      // safe, and it is a no-op under "always".
      invalidate();
    };
    on();
    window.addEventListener('scroll', on, { passive: true });
    return () => window.removeEventListener('scroll', on);
  }, []);
  return p;
}

/** The oracle orb — glass sphere refracting the sky, ψ inside, gold facet cage */
function OracleOrb({ scrollP }: { scrollP: React.MutableRefObject<number> }) {
  const group = useRef<THREE.Group>(null!);
  const cage = useRef<THREE.LineSegments>(null!);
  const ringGeo = useRef<THREE.BufferGeometry>(null!);
  const psiTex = usePsiTexture();
  const dotTex = useGlowTexture(GOLD_2);
  const haloTex = useGlowTexture(AZURE);
  const { viewport } = useThree();

  const mob = viewport.width < 8.5;
  const R = mob ? 1.05 : 1.45;
  const anchor = useMemo(
    () =>
      new THREE.Vector3(
        mob ? 0 : viewport.width * 0.245,
        mob ? viewport.height * 0.315 : viewport.height * 0.115,
        0
      ),
    [viewport.width, viewport.height, mob]
  );

  // orbiting dust ring
  const RING_N = mob ? 50 : 90;
  const ring = useMemo(() => {
    const phase = new Float32Array(RING_N);
    const rad = new Float32Array(RING_N);
    for (let i = 0; i < RING_N; i++) {
      phase[i] = Math.random() * Math.PI * 2;
      rad[i] = R * (1.55 + Math.random() * 0.9);
    }
    return { phase, rad, pos: new Float32Array(RING_N * 3) };
  }, [RING_N, R]);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    const fade = Math.max(0, 1 - scrollP.current * 1.15) * (mob ? 0.75 : 1);
    group.current.visible = fade > 0.02;
    if (!group.current.visible) return;
    const k = 0.7 + fade * 0.3;
    group.current.scale.setScalar(k);
    group.current.position.set(anchor.x, anchor.y + (1 - fade) * 1.6, anchor.z);
    if (!REDUCE) {
      cage.current.rotation.y = t * 0.22;
      cage.current.rotation.x = Math.sin(t * 0.17) * 0.24;
      for (let i = 0; i < RING_N; i++) {
        const a = ring.phase[i] + t * (0.32 + (i % 5) * 0.028);
        ring.pos[i * 3] = Math.cos(a) * ring.rad[i];
        ring.pos[i * 3 + 1] = Math.sin(a * 0.9) * ring.rad[i] * 0.22;
        ring.pos[i * 3 + 2] = Math.sin(a) * ring.rad[i];
      }
      if (ringGeo.current) ringGeo.current.attributes.position.needsUpdate = true;
    }
  });

  return (
    <group ref={group} position={anchor}>
      <Float speed={REDUCE ? 0 : 1.5} rotationIntensity={0.45} floatIntensity={REDUCE ? 0 : 0.85}>
        {/* the crystal oracle — dark polished glass with iridescent sheen */}
        <mesh>
          <sphereGeometry args={[R, 64, 64]} />
          <meshPhysicalMaterial
            color="#0e141d"
            metalness={0.1}
            roughness={0.08}
            clearcoat={1}
            clearcoatRoughness={0.12}
            iridescence={1}
            iridescenceIOR={1.35}
            envMapIntensity={1.5}
            transparent
            opacity={0.92}
          />
        </mesh>
        {/* ψ soul glowing through the crystal */}
        <sprite scale={[R * 1.22, R * 1.22, 1]} renderOrder={3}>
          <spriteMaterial
            map={psiTex}
            transparent
            opacity={0.9}
            depthWrite={false}
            depthTest={false}
            blending={THREE.AdditiveBlending}
          />
        </sprite>
        {/* gold facet cage */}
        <lineSegments ref={cage} scale={1.22}>
          <edgesGeometry args={[new THREE.IcosahedronGeometry(R, 1)]} />
          <lineBasicMaterial
            color={GOLD}
            transparent
            opacity={0.3}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </lineSegments>
        {/* orbiting dust */}
        <group rotation={[0.55, 0, -0.35]}>
          <points>
            <bufferGeometry ref={ringGeo}>
              <bufferAttribute attach="attributes-position" args={[ring.pos, 3]} />
            </bufferGeometry>
            <pointsMaterial
              map={dotTex}
              size={0.075}
              sizeAttenuation
              transparent
              opacity={0.9}
              depthWrite={false}
              blending={THREE.AdditiveBlending}
            />
          </points>
        </group>
        {/* close halo */}
        <sprite scale={[R * 5.4, R * 5.4, 1]}>
          <spriteMaterial
            map={haloTex}
            transparent
            opacity={0.16}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
          />
        </sprite>
      </Float>
    </group>
  );
}

/** occasional shooting stars */
function Meteors({ scrollP }: { scrollP: React.MutableRefObject<number> }) {
  const lines = useRef<(THREE.Line | null)[]>([]);
  const state = useMemo(
    () =>
      Array.from({ length: 3 }, () => ({
        t: 2 + Math.random() * 6,
        life: 0,
        active: false,
        from: new THREE.Vector3(),
        dir: new THREE.Vector3(),
      })),
    []
  );
  useFrame((_, dt) => {
    if (REDUCE) return;
    const dim = 1 - Math.min(0.5, scrollP.current * 0.5);
    for (let i = 0; i < state.length; i++) {
      const m = state[i];
      const line = lines.current[i];
      if (!line) continue;
      const mat = line.material as THREE.LineBasicMaterial;
      if (!m.active) {
        m.t -= dt;
        if (m.t <= 0) {
          m.active = true;
          m.life = 0;
          m.from.set((Math.random() * 2 - 1) * 14, 5 + Math.random() * 5, -6 - Math.random() * 8);
          m.dir.set(-(0.5 + Math.random() * 0.7), -(0.45 + Math.random() * 0.5), 0).normalize();
        }
      } else {
        m.life += dt * 1.3;
        const head = m.from.clone().addScaledVector(m.dir, m.life * 16);
        const tail = head.clone().addScaledVector(m.dir, -2.6);
        const p = (line.geometry as THREE.BufferGeometry).attributes.position
          .array as Float32Array;
        p[0] = tail.x; p[1] = tail.y; p[2] = tail.z;
        p[3] = head.x; p[4] = head.y; p[5] = head.z;
        (line.geometry as THREE.BufferGeometry).attributes.position.needsUpdate = true;
        mat.opacity = Math.sin(Math.min(1, m.life) * Math.PI) * 0.7 * dim;
        if (m.life > 1.5) {
          m.active = false;
          m.t = 3 + Math.random() * 7;
          mat.opacity = 0;
        }
      }
    }
  });
  return (
    <>
      {state.map((_, i) => (
        <line key={i} ref={(el) => (lines.current[i] = el as unknown as THREE.Line)}>
          <bufferGeometry>
            <bufferAttribute attach="attributes-position" args={[new Float32Array(6), 3]} />
          </bufferGeometry>
          <lineBasicMaterial
            color="#fff2d8"
            transparent
            opacity={0}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </line>
      ))}
    </>
  );
}

/** mouse parallax + hero-scroll dimming */
function Rig({ scrollP }: { scrollP: React.MutableRefObject<number> }) {
  const m = useRef({ x: 0, y: 0 });
  useEffect(() => {
    if (REDUCE) return; // pointer parallax is precisely the motion REDUCE asks us to drop
    const on = (e: PointerEvent) => {
      m.current.x = (e.clientX / window.innerWidth) * 2 - 1;
      m.current.y = (e.clientY / window.innerHeight) * 2 - 1;
    };
    window.addEventListener('pointermove', on, { passive: true });
    return () => window.removeEventListener('pointermove', on);
  }, []);
  useFrame(({ camera }) => {
    // With no pointer input this lerp converges on [0, 0, 10] looking down -Z —
    // exactly where the camera already starts — so skipping it under REDUCE is
    // pixel-identical at rest. It also keeps frameloop="demand" honest: without
    // this, a scroll-driven frame would drag the camera toward a stale pointer.
    if (REDUCE) return;
    camera.position.x += (m.current.x * 0.55 - camera.position.x) * 0.04;
    camera.position.y += (-m.current.y * 0.35 - camera.position.y) * 0.04;
    camera.lookAt(0, 0, -6);
  });
  return null;
}

export default function CosmosHero() {
  const scrollP = useScrollP();
  const [dpr, setDpr] = useState<[number, number]>([1, 2]);
  useEffect(() => {
    if (window.innerWidth < 760) setDpr([1, 1.6]);
  }, []);

  return (
    <Canvas
      dpr={dpr}
      // antialias:false — the EffectComposer below owns AA now. With a composer
      // in play the final pass is a fullscreen quad, so a multisampled DEFAULT
      // framebuffer has no edges to resolve: it was allocated and resolved every
      // frame for nothing. The 3D gets its AA from multisampling={4} instead.
      gl={{ antialias: false, alpha: true, powerPreference: 'high-performance' }}
      // Only under REDUCE is this scene genuinely idle (Float/Stars/Sparkles
      // speed=0, Meteors early-return, pointer parallax off) — measured
      // pixel-identical across 1.5s while still burning 27 draw calls/frame.
      // It must stay "always" otherwise: the orb floats, the cage spins and 90
      // dust motes orbit, so demand would need invalidate() every frame anyway.
      frameloop={REDUCE ? 'demand' : 'always'}
      camera={{ fov: 60, position: [0, 0, 10], near: 0.1, far: 200 }}
      style={{ position: 'absolute', inset: 0 }}
    >
      <Rig scrollP={scrollP} />

      <Stars radius={70} depth={55} count={2400} factor={2.6} saturation={0} fade speed={REDUCE ? 0 : 0.5} />
      <Sparkles count={130} scale={[26, 15, 14]} size={2.6} speed={REDUCE ? 0 : 0.32} color={GOLD_2} opacity={0.5} />
      <Meteors scrollP={scrollP} />
      <OracleOrb scrollP={scrollP} />

      <Environment resolution={256} frames={1}>
        <group>
          <Lightformer form="rect" intensity={1.7} color={GOLD_2} position={[4, 3, -3]} scale={[6, 3, 1]} target={[0, 0, 0]} />
          <Lightformer form="rect" intensity={0.9} color={AZURE} position={[-5, -1, 2]} scale={[5, 4, 1]} target={[0, 0, 0]} />
          <Lightformer form="circle" intensity={0.5} color="#fff4dd" position={[0, 5, 4]} scale={3} target={[0, 0, 0]} />
        </group>
      </Environment>

      <EffectComposer multisampling={4}>
        <Bloom intensity={0.65} luminanceThreshold={0.42} mipmapBlur radius={0.7} />
        <Vignette eskil={false} offset={0.2} darkness={0.75} />
      </EffectComposer>
    </Canvas>
  );
}
