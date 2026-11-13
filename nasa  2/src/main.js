/**
 * Ignis Atlas - Main Application Entrypoint
 * NASA Space Apps Challenge - Fire Safety in Space
 */

import './styles.css';
import { HeroFlame } from './flame.js';
import { initScrollStory } from './story.js';
import { IgnisAtlas } from './atlas.js';
import Lenis from 'lenis';

function initApp() {
  console.log('[Ignis Atlas] Initializing aerospace application...');

  // 1. Initialize Smooth Scroll with Lenis (if not reduced-motion)
  let lenis = null;
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (!prefersReducedMotion) {
    try {
      lenis = new Lenis({
        duration: 1.0,
        easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
        orientation: 'vertical',
        smoothWheel: true,
      });

      function raf(time) {
        lenis.raf(time);
        requestAnimationFrame(raf);
      }
      requestAnimationFrame(raf);
    } catch (e) {
      console.warn('Lenis smooth scrolling not active:', e);
    }
  }

  // 2. Initialize Hero Living Flame (Three.js WebGL)
  const flameContainer = document.getElementById('flame-canvas-container');
  let heroFlame = null;
  if (flameContainer) {
    try {
      heroFlame = new HeroFlame(flameContainer);
    } catch (err) {
      console.error('[Ignis Atlas] Error initializing 3D flame:', err);
    }
  }

  // 3. Initialize Scroll Story Choreography (GSAP & ScrollTrigger)
  try {
    initScrollStory(heroFlame);
  } catch (err) {
    console.error('[Ignis Atlas] Error initializing scroll story:', err);
  }

  // 4. Initialize Ignis Atlas (SVG Chart, Screening Engine, Drawer & Tabs)
  try {
    window.ignisAtlas = new IgnisAtlas({ heroFlame });
    console.log('[Ignis Atlas] Atlas engine initialized successfully.');
  } catch (err) {
    console.error('[Ignis Atlas] Error initializing Atlas:', err);
  }
}

// Ensure execution regardless of script execution timing
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}
