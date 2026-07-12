// ψ Motion — the feel layer: Lenis smooth scroll + GSAP entrances & scrubs.
// SplitText splits by LINES only (Thai combining marks make char-splits unsafe).

import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';
import { DrawSVGPlugin } from 'gsap/DrawSVGPlugin';
import Lenis from 'lenis';

gsap.registerPlugin(ScrollTrigger, SplitText, DrawSVGPlugin);

export function initMotion() {
  if (window.__psiMotion) return;
  window.__psiMotion = true;

  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ── buttery scroll (skip when the user asks for calm) ────────────────────
  if (!reduce) {
    const lenis = new Lenis({ lerp: 0.09, smoothWheel: true });
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add((t) => lenis.raf(t * 1000));
    gsap.ticker.lagSmoothing(0);
  }

  if (reduce) {
    // make sure nothing stays hidden
    gsap.set('[data-hero], .ratchet .stair, .ratchet circle, .ratchet text', {
      clearProps: 'all',
      opacity: 1,
    });
    return;
  }

  // ── hero entrance — lines rise & fade (NO mask: Thai tone marks sit above
  // the line box and an overflow:hidden mask clips them off) ───────────────
  const h1 = document.querySelector('.hero h1');
  if (h1) {
    const split = SplitText.create(h1, { type: 'lines' });
    gsap.set('[data-hero]', { opacity: 1 });
    gsap
      .timeline({ defaults: { ease: 'power4.out' } })
      .from(split.lines, { yPercent: 46, opacity: 0, duration: 1.05, stagger: 0.1, delay: 0.12 })
      .from(
        '.hero .eyebrow',
        { y: -14, opacity: 0, duration: 0.7 },
        0.1
      )
      .from(
        ['.hero .role', '.hero .tagline'],
        { y: 22, opacity: 0, duration: 0.85, stagger: 0.12 },
        0.55
      )
      .from(
        '.hero .statchip',
        { y: 16, opacity: 0, duration: 0.55, stagger: 0.07 },
        0.8
      )
      .from('.hero .hero-rule', { scaleX: 0, transformOrigin: '0 50%', opacity: 0, duration: 0.9 }, 1.0);
  }

  // ── quality-ratchet staircase — draws as you scroll through it ──────────
  const stair = document.querySelector('.ratchet .stair');
  if (stair) {
    const tl = gsap.timeline({
      scrollTrigger: {
        trigger: '.ratchet',
        start: 'top 82%',
        end: 'top 28%',
        scrub: 1,
      },
    });
    tl.fromTo(stair, { drawSVG: '0%' }, { drawSVG: '100%', ease: 'none' }).fromTo(
      ['.ratchet circle', '.ratchet text'],
      { opacity: 0 },
      { opacity: 1, stagger: 0.05, duration: 0.35 },
      0.45
    );
  }

  // ── section headings drift up a touch slower than the page (parallax) ──
  document.querySelectorAll('section h2').forEach((el) => {
    gsap.from(el, {
      y: 26,
      opacity: 0.001,
      duration: 0.9,
      ease: 'power3.out',
      scrollTrigger: { trigger: el, start: 'top 88%' },
    });
  });
}
