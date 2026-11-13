/**
 * Ignis Atlas - Aerospace Flame Combustion Physics Engine
 * Exact reproduction of NASA's ground-truth comparison:
 * 1.00g Buoyant Convective Plume (Earth) vs 0.00g Spherical Diffusion Shell (CIR-MDCA / ISS).
 *
 * Runs at guaranteed 60fps on HTML5 Canvas with sub-pixel Bezier morphing,
 * additive spectral compositing, 180-star deep-space parallax starfield,
 * and metallic burner nozzle / candle wick geometry.
 */

export class HeroFlame {
  constructor(containerElement) {
    this.container = containerElement;
    this.currentGravity = 1.0;
    this.targetGravity = 1.0;
    this.isPaused = false;
    this.animationFrameId = null;
    this.lastTime = performance.now();

    // Check reduced motion preference
    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    this.reducedMotion = motionQuery.matches;

    // Create and attach high-performance 2D Canvas
    this.canvas = document.createElement('canvas');
    this.canvas.setAttribute('aria-label', 'Interactive Flame Simulation Viewport');
    this.ctx = this.canvas.getContext('2d', { alpha: false, desynchronized: true });
    this.container.innerHTML = '';
    this.container.appendChild(this.canvas);

    // Starfield & Particle Systems
    this.stars = [];
    this.sparks = [];
    this.sparkPoolSize = 50;

    this.initStars();
    this.initSparks();
    this.initResize();
    this.bindEvents();
    this.initIntersectionObserver();

    // Start 60fps physics render loop
    this.animate = this.animate.bind(this);
    this.animationFrameId = requestAnimationFrame(this.animate);
  }

  /* =========================================================================
     STARFIELD & DEEP-SPACE ENVIRONMENT
     ========================================================================= */
  initStars() {
    this.stars = [];
    const count = 180;
    const w = this.width || 800;
    const h = this.height || 520;

    for (let i = 0; i < count; i++) {
      const z = 0.2 + Math.random() * 0.8; // depth factor
      this.stars.push({
        x: Math.random() * w,
        y: Math.random() * h,
        z: z,
        size: 0.6 + z * 1.6,
        speed: 0.06 + z * 0.18,
        twinkleSpeed: 1.2 + Math.random() * 2.5,
        twinklePhase: Math.random() * Math.PI * 2,
        baseAlpha: 0.3 + z * 0.65,
        isCyan: Math.random() < 0.25,
      });
    }
  }

  updateStars(dt, w, h) {
    for (let i = 0; i < this.stars.length; i++) {
      const s = this.stars[i];
      // Slow cosmic drift to the left with parallax speed
      s.x -= s.speed * dt * 60;
      if (s.x < 0) {
        s.x = w;
        s.y = Math.random() * h;
      }
    }
  }

  drawStars(time) {
    const ctx = this.ctx;
    for (let i = 0; i < this.stars.length; i++) {
      const s = this.stars[i];
      const twinkle = 0.65 + 0.35 * Math.sin(time * s.twinkleSpeed + s.twinklePhase);
      const alpha = Math.min(1, s.baseAlpha * twinkle);

      ctx.fillStyle = s.isCyan
        ? `rgba(0, 210, 255, ${alpha.toFixed(3)})`
        : `rgba(255, 255, 255, ${alpha.toFixed(3)})`;

      ctx.beginPath();
      ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
      ctx.fill();

      // Soft glow for bright foreground stars
      if (s.z > 0.75) {
        ctx.fillStyle = s.isCyan
          ? `rgba(0, 210, 255, ${(alpha * 0.22).toFixed(3)})`
          : `rgba(200, 230, 255, ${(alpha * 0.18).toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.size * 2.4, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  /* =========================================================================
     CONVECTIVE SOOT SPARKS & EMBERS
     ========================================================================= */
  initSparks() {
    this.sparks = [];
    for (let i = 0; i < this.sparkPoolSize; i++) {
      this.sparks.push(this.createSpark(true));
    }
  }

  createSpark(randomInit = false) {
    const life = randomInit ? Math.random() : 0;
    return {
      x: 0,
      y: 0,
      vx: (Math.random() - 0.5) * 0.8,
      vy: -(1.5 + Math.random() * 2.5),
      size: 1.2 + Math.random() * 2.2,
      life: life,
      maxLife: 0.6 + Math.random() * 1.0,
      active: true,
    };
  }

  updateAndDrawSparks(dt, cx, flameBaseY, g) {
    const ctx = this.ctx;
    ctx.save();
    ctx.globalCompositeOperation = 'screen';

    for (let i = 0; i < this.sparks.length; i++) {
      const p = this.sparks[i];
      p.life += dt;

      if (p.life >= p.maxLife) {
        // Reset particle at flame center
        p.life = 0;
        p.maxLife = 0.5 + Math.random() * 0.9;
        p.size = 1.0 + Math.random() * 2.0;

        if (g < 0.1) {
          // Microgravity: gentle isotropic diffusion drift
          const angle = Math.random() * Math.PI * 2;
          const speed = 0.2 + Math.random() * 0.6;
          p.x = cx + Math.cos(angle) * (15 + Math.random() * 30);
          p.y = (flameBaseY - 20) + Math.sin(angle) * (15 + Math.random() * 30);
          p.vx = Math.cos(angle) * speed;
          p.vy = Math.sin(angle) * speed;
        } else {
          // Earth: buoyant acceleration straight upward
          p.x = cx + (Math.random() - 0.5) * (18 * g + 8);
          p.y = flameBaseY - (25 + Math.random() * 40 * g);
          p.vx = (Math.random() - 0.5) * 0.8 * g;
          p.vy = -(1.2 + Math.random() * 2.8) * Math.max(0.2, g);
        }
      } else {
        // Integrate
        p.x += p.vx * dt * 60;
        p.y += p.vy * dt * 60;
        if (g > 0.1) {
          p.vy -= 1.8 * g * dt; // upward buoyant draft acceleration
        }
      }

      // Draw ember
      const progress = p.life / p.maxLife;
      const alpha = Math.max(0, (1 - progress) * 0.85);

      if (g < 0.2) {
        // Cool blue / violet microgravity spark
        ctx.fillStyle = `rgba(0, 210, 255, ${alpha.toFixed(3)})`;
      } else {
        // Fiery golden-orange ember
        ctx.fillStyle = `rgba(255, 180, 50, ${alpha.toFixed(3)})`;
      }

      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * (1 - progress * 0.5), 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  /* =========================================================================
     NASA GROUND-TRUTH BURNER NOZZLE & WICK
     ========================================================================= */
  drawBurnerNozzle(cx, baseY) {
    const ctx = this.ctx;
    ctx.save();

    // 1. Heavy Metallic Burner Body (CIR-MDCA hardware mount)
    const mountW = 44;
    const mountH = 80;
    const mountX = cx - mountW / 2;
    const mountY = baseY + 14;

    const bodyGrad = ctx.createLinearGradient(mountX, mountY, mountX + mountW, mountY);
    bodyGrad.addColorStop(0, '#060B18');
    bodyGrad.addColorStop(0.35, '#1E293B');
    bodyGrad.addColorStop(0.55, '#334155');
    bodyGrad.addColorStop(0.7, '#1E293B');
    bodyGrad.addColorStop(1, '#060B18');

    ctx.fillStyle = bodyGrad;
    ctx.beginPath();
    ctx.roundRect(mountX, mountY, mountW, mountH, [3, 3, 0, 0]);
    ctx.fill();

    // Metallic Bevel Collar
    const collarW = mountW + 8;
    const collarH = 7;
    const collarX = cx - collarW / 2;
    const collarY = mountY - 4;

    const collarGrad = ctx.createLinearGradient(collarX, collarY, collarX + collarW, collarY);
    collarGrad.addColorStop(0, '#0F172A');
    collarGrad.addColorStop(0.5, '#64748B');
    collarGrad.addColorStop(1, '#0F172A');

    ctx.fillStyle = collarGrad;
    ctx.beginPath();
    ctx.roundRect(collarX, collarY, collarW, collarH, 2);
    ctx.fill();

    // 2. High-Temperature Burner Nozzle Tip / Candle Wick
    const wickW = 5;
    const wickH = 18;
    const wickX = cx - wickW / 2;
    const wickY = collarY - wickH + 2;

    const wickGrad = ctx.createLinearGradient(wickX, wickY, wickX + wickW, wickY);
    wickGrad.addColorStop(0, '#10141E');
    wickGrad.addColorStop(0.5, '#2D3748');
    wickGrad.addColorStop(1, '#10141E');

    ctx.fillStyle = wickGrad;
    ctx.fillRect(wickX, wickY, wickW, wickH);

    // Glowing ember at the wick tip
    const emberGrad = ctx.createRadialGradient(cx, wickY + 1, 0, cx, wickY + 1, 6);
    emberGrad.addColorStop(0, 'rgba(255, 240, 200, 0.95)');
    emberGrad.addColorStop(0.4, 'rgba(255, 100, 20, 0.8)');
    emberGrad.addColorStop(1, 'rgba(255, 50, 0, 0)');
    ctx.fillStyle = emberGrad;
    ctx.beginPath();
    ctx.arc(cx, wickY + 1, 6, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  /* =========================================================================
     NASA FLAME MORPHOLOGY & SPECTRAL EMISSION ENGINE
     ========================================================================= */
  drawFlame(cx, anchorY, g, time) {
    const ctx = this.ctx;
    ctx.save();

    // Reduced motion dampener
    const flickMult = this.reducedMotion ? 0.15 : 1.0;

    // Organic Convection Flicker (Strictly proportional to gravity)
    // In 0g (Microgravity), flicker is mathematically 0.00!
    const flickApexX = (Math.sin(time * 6.5) * 3.4 + Math.sin(time * 12.2) * 1.6) * g * flickMult;
    const flickApexY = (Math.sin(time * 8.0) * 5.2 + Math.cos(time * 15.5) * 2.4) * g * flickMult;
    const flickSideL = Math.sin(time * 7.0 + 1.2) * 2.2 * g * flickMult;
    const flickSideR = Math.cos(time * 7.5 + 2.4) * 2.2 * g * flickMult;

    // Microgravity Serene Breathing (Very slow 1.2Hz gentle expansion)
    const microBreathe = Math.sin(time * 1.4) * 1.2 * (1 - g);

    // Geometry Dimensions
    // 0g (ISS): Perfect sphere/dome centered on wick tip (R ≈ 78px)
    // 1g (Earth): Buoyant elongated teardrop (H ≈ 172px, Base Width ≈ 42px)
    const baseSphereR = 76 + microBreathe;
    const apexHeight = (baseSphereR + 10) * (1 - g) + (170 + flickApexY) * g;
    const flameHalfW = (baseSphereR * 1.04) * (1 - g) + (26 + flickSideR) * g;

    const apexX = cx + flickApexX;
    const apexY = anchorY - apexHeight;

    /* -----------------------------------------------------------------------
       1. AMBIENT DIFFUSION HALO (Outer Ethereal Shell)
       ----------------------------------------------------------------------- */
    ctx.save();
    ctx.globalCompositeOperation = 'screen';

    // In 0g: Huge translucent spherical blue diffusion glow
    const haloRadius = (baseSphereR * 1.42) * (1 - g) + (baseSphereR * 1.1) * g;
    const haloGrad = ctx.createRadialGradient(cx, anchorY - (baseSphereR * 0.45), 0, cx, anchorY - (baseSphereR * 0.45), haloRadius);

    if (g < 0.25) {
      // Microgravity Pure Chemiluminescence (Blue / Cyan / Lilac)
      haloGrad.addColorStop(0, 'rgba(0, 51, 255, 0.42)');
      haloGrad.addColorStop(0.5, 'rgba(0, 160, 255, 0.28)');
      haloGrad.addColorStop(0.78, 'rgba(0, 210, 255, 0.12)');
      haloGrad.addColorStop(1, 'rgba(0, 210, 255, 0)');
    } else {
      // Convective Transition to Earth Amber Glow
      const blend = (g - 0.25) / 0.75;
      haloGrad.addColorStop(0, `rgba(${Math.round(255 * blend)}, ${Math.round(140 * blend + 50 * (1-blend))}, ${Math.round(255 * (1-blend))}, 0.35)`);
      haloGrad.addColorStop(0.6, `rgba(${Math.round(255 * blend)}, ${Math.round(80 * blend)}, 0, ${(0.18 * blend).toFixed(3)})`);
      haloGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    }

    ctx.fillStyle = haloGrad;
    ctx.beginPath();
    ctx.arc(cx, anchorY - (baseSphereR * 0.45), haloRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    /* -----------------------------------------------------------------------
       2. OUTER REACTION MANTLE (Bezier Spline from Base to Apex)
       ----------------------------------------------------------------------- */
    ctx.save();
    ctx.beginPath();
    // Start at bottom center of wick
    ctx.moveTo(cx - flameHalfW, anchorY + 3);

    // Left outer curve
    if (g < 0.08) {
      // 0.00g: Perfectly symmetrical spherical / hemispherical dome
      ctx.bezierCurveTo(
        cx - flameHalfW * 1.25, anchorY - baseSphereR * 0.6,
        cx - flameHalfW * 0.95, anchorY - baseSphereR * 1.08,
        apexX, apexY
      );
      // Right outer curve
      ctx.bezierCurveTo(
        cx + flameHalfW * 0.95, anchorY - baseSphereR * 1.08,
        cx + flameHalfW * 1.25, anchorY - baseSphereR * 0.6,
        cx + flameHalfW, anchorY + 3
      );
    } else {
      // 1.00g / Partial-g: Convective teardrop taper
      ctx.bezierCurveTo(
        cx - flameHalfW * 1.15 + flickSideL, anchorY - apexHeight * 0.32,
        cx - flameHalfW * 0.75 + flickSideL * 0.6, anchorY - apexHeight * 0.72,
        apexX, apexY
      );
      ctx.bezierCurveTo(
        cx + flameHalfW * 0.75 + flickSideR * 0.6, anchorY - apexHeight * 0.72,
        cx + flameHalfW * 1.15 + flickSideR, anchorY - apexHeight * 0.32,
        cx + flameHalfW, anchorY + 3
      );
    }

    // Bottom closure around wick
    ctx.quadraticCurveTo(cx, anchorY + 8, cx - flameHalfW, anchorY + 3);
    ctx.closePath();

    // Color Fill for Outer Sheath
    if (g < 0.12) {
      // Microgravity Outer Shell: Ghostly deep royal blue to electric cyan rim
      const microGrad = ctx.createRadialGradient(cx, anchorY - baseSphereR * 0.4, 10, cx, anchorY - baseSphereR * 0.4, baseSphereR * 1.05);
      microGrad.addColorStop(0, 'rgba(40, 20, 160, 0.85)');
      microGrad.addColorStop(0.55, 'rgba(0, 70, 255, 0.88)');
      microGrad.addColorStop(0.85, 'rgba(0, 180, 255, 0.72)');
      microGrad.addColorStop(1, 'rgba(0, 220, 255, 0.1)');
      ctx.fillStyle = microGrad;
    } else {
      // Earth / Partial-g Outer Sheath: Fiery red-orange mantle
      const earthGrad = ctx.createLinearGradient(cx, anchorY, apexX, apexY);
      earthGrad.addColorStop(0, 'rgba(0, 110, 255, 0.85)'); // base blue anchor
      earthGrad.addColorStop(0.18, 'rgba(255, 60, 0, 0.85)'); // deep fiery orange
      earthGrad.addColorStop(0.65, 'rgba(255, 120, 0, 0.9)');
      earthGrad.addColorStop(0.95, 'rgba(255, 180, 0, 0.75)');
      earthGrad.addColorStop(1, 'rgba(255, 80, 0, 0.2)');
      ctx.fillStyle = earthGrad;
    }
    ctx.fill();
    ctx.restore();

    /* -----------------------------------------------------------------------
       3. INNER FLAME BODY (Golden Yellow in 1g vs Violet/Magenta in 0g)
       ----------------------------------------------------------------------- */
    ctx.save();
    ctx.beginPath();
    const midScale = 0.68;
    const midHalfW = flameHalfW * midScale;
    const midApexY = anchorY - apexHeight * midScale;

    ctx.moveTo(cx - midHalfW, anchorY);
    ctx.bezierCurveTo(
      cx - midHalfW * 1.1 + flickSideL * 0.7, anchorY - (anchorY - midApexY) * 0.4,
      cx - midHalfW * 0.65, anchorY - (anchorY - midApexY) * 0.8,
      apexX, midApexY
    );
    ctx.bezierCurveTo(
      cx + midHalfW * 0.65, anchorY - (anchorY - midApexY) * 0.8,
      cx + midHalfW * 1.1 + flickSideR * 0.7, anchorY - (anchorY - midApexY) * 0.4,
      cx + midHalfW, anchorY
    );
    ctx.quadraticCurveTo(cx, anchorY + 4, cx - midHalfW, anchorY);
    ctx.closePath();

    if (g < 0.12) {
      // 0.00g NASA Photo Ground Truth: Ethereal Violet / Lilac Inner Glow surrounding the wick
      const violetGrad = ctx.createRadialGradient(cx, anchorY - 6, 0, cx, anchorY - 6, baseSphereR * 0.58);
      violetGrad.addColorStop(0, 'rgba(240, 220, 255, 0.92)');
      violetGrad.addColorStop(0.35, 'rgba(180, 90, 230, 0.82)'); // lilac / violet
      violetGrad.addColorStop(0.7, 'rgba(130, 50, 210, 0.55)'); // magenta chemiluminescence
      violetGrad.addColorStop(1, 'rgba(60, 20, 180, 0)');
      ctx.fillStyle = violetGrad;
    } else {
      // 1.00g: Vibrant Incandescent Golden Yellow
      const yellowGrad = ctx.createLinearGradient(cx, anchorY, apexX, midApexY);
      yellowGrad.addColorStop(0, 'rgba(255, 200, 50, 0.95)');
      yellowGrad.addColorStop(0.6, 'rgba(255, 225, 80, 0.98)');
      yellowGrad.addColorStop(1, 'rgba(255, 170, 0, 0.4)');
      ctx.fillStyle = yellowGrad;
    }
    ctx.fill();
    ctx.restore();

    /* -----------------------------------------------------------------------
       4. INCANDESCENT CORE (White-Hot Core in 1g vs Soft Lavender Core in 0g)
       ----------------------------------------------------------------------- */
    ctx.save();
    ctx.beginPath();
    const coreScale = 0.38;
    const coreHalfW = flameHalfW * coreScale;
    const coreApexY = anchorY - apexHeight * (0.35 * (1 - g) + 0.48 * g);

    ctx.moveTo(cx - coreHalfW, anchorY - 2);
    ctx.bezierCurveTo(
      cx - coreHalfW * 1.1, anchorY - (anchorY - coreApexY) * 0.5,
      cx - coreHalfW * 0.4, anchorY - (anchorY - coreApexY) * 0.85,
      apexX, coreApexY
    );
    ctx.bezierCurveTo(
      cx + coreHalfW * 0.4, anchorY - (anchorY - coreApexY) * 0.85,
      cx + coreHalfW * 1.1, anchorY - (anchorY - coreApexY) * 0.5,
      cx + coreHalfW, anchorY - 2
    );
    ctx.quadraticCurveTo(cx, anchorY + 1, cx - coreHalfW, anchorY - 2);
    ctx.closePath();

    if (g < 0.12) {
      // Soft Lavender / White Core in 0g
      const coreGrad0g = ctx.createRadialGradient(cx, anchorY - 6, 0, cx, anchorY - 6, 24);
      coreGrad0g.addColorStop(0, 'rgba(255, 255, 255, 0.98)');
      coreGrad0g.addColorStop(0.5, 'rgba(235, 220, 255, 0.85)');
      coreGrad0g.addColorStop(1, 'rgba(180, 140, 240, 0)');
      ctx.fillStyle = coreGrad0g;
    } else {
      // Brilliant White-Hot Incandescent Core in 1g
      const coreGrad1g = ctx.createLinearGradient(cx, anchorY, apexX, coreApexY);
      coreGrad1g.addColorStop(0, 'rgba(255, 255, 255, 1.0)');
      coreGrad1g.addColorStop(0.65, 'rgba(255, 255, 240, 0.98)');
      coreGrad1g.addColorStop(1, 'rgba(255, 240, 180, 0.2)');
      ctx.fillStyle = coreGrad1g;
    }
    ctx.fill();
    ctx.restore();

    /* -----------------------------------------------------------------------
       5. EARTH BASE CONVECTIVE BLUE ANCHOR RING (Only present when g > 0.15)
       ----------------------------------------------------------------------- */
    if (g > 0.15) {
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      const anchorW = flameHalfW * 0.95;
      const blueRing = ctx.createRadialGradient(cx, anchorY + 2, 2, cx, anchorY + 2, anchorW);
      blueRing.addColorStop(0, `rgba(0, 119, 255, ${(0.85 * g).toFixed(3)})`);
      blueRing.addColorStop(0.65, `rgba(0, 210, 255, ${(0.65 * g).toFixed(3)})`);
      blueRing.addColorStop(1, 'rgba(0, 210, 255, 0)');

      ctx.fillStyle = blueRing;
      ctx.beginPath();
      ctx.ellipse(cx, anchorY + 3, anchorW, 7, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    ctx.restore();
  }

  /* =========================================================================
     MAIN 60FPS PHYSICS & RENDER PIPELINE
     ========================================================================= */
  animate() {
    if (this.isPaused) {
      this.animationFrameId = null;
      return;
    }

    this.animationFrameId = requestAnimationFrame(this.animate);

    const now = performance.now();
    const dt = Math.min((now - this.lastTime) * 0.001, 0.1);
    this.lastTime = now;
    const time = now * 0.001;

    // Smooth spring lerp towards target gravity setting
    this.currentGravity += (this.targetGravity - this.currentGravity) * 0.1;

    const ctx = this.ctx;
    const w = this.canvas.width / (this.pixelRatio || 1);
    const h = this.canvas.height / (this.pixelRatio || 1);
    const cx = w / 2;
    const cy = h / 2;
    const flameAnchorY = cy + 50;

    // 1. Deep Space Void Background
    ctx.fillStyle = '#020409';
    ctx.fillRect(0, 0, w, h);

    // 2. Cosmic Ambient Nebula Glow (Tied to Combustion State)
    ctx.save();
    const nebulaGrad = ctx.createRadialGradient(cx, cy, 30, cx, cy, Math.max(w, h) * 0.55);
    if (this.currentGravity < 0.2) {
      nebulaGrad.addColorStop(0, 'rgba(0, 60, 180, 0.14)');
      nebulaGrad.addColorStop(0.4, 'rgba(0, 210, 255, 0.04)');
    } else {
      nebulaGrad.addColorStop(0, 'rgba(10, 30, 70, 0.16)');
      nebulaGrad.addColorStop(0.4, 'rgba(0, 160, 255, 0.03)');
    }
    nebulaGrad.addColorStop(1, 'rgba(2, 4, 9, 0)');
    ctx.fillStyle = nebulaGrad;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();

    // 3. Animated Starfield
    this.updateStars(dt, w, h);
    this.drawStars(time);

    // 4. Burner Hardware & Wick Anchor
    this.drawBurnerNozzle(cx, flameAnchorY);

    // 5. NASA Procedural Flame Morphing
    this.drawFlame(cx, flameAnchorY, this.currentGravity, time);

    // 6. Convective Sparks & Drift Particles
    this.updateAndDrawSparks(dt, cx, flameAnchorY, this.currentGravity);

    // 7. Update UI Telemetry & Controls HUD
    this.updateReadout(this.currentGravity);
  }

  /* =========================================================================
     RESIZE & INTERSECTION OBSERVER
     ========================================================================= */
  initResize() {
    this.pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    this.handleResize = this.handleResize.bind(this);
    window.addEventListener('resize', this.handleResize);
    this.handleResize();
  }

  handleResize() {
    if (!this.container || !this.canvas) return;
    const rect = this.container.getBoundingClientRect();
    const w = rect.width || 800;
    const h = rect.height || 520;
    this.width = w;
    this.height = h;

    this.canvas.width = Math.round(w * this.pixelRatio);
    this.canvas.height = Math.round(h * this.pixelRatio);
    this.canvas.style.width = `${w}px`;
    this.canvas.style.height = `${h}px`;

    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.scale(this.pixelRatio, this.pixelRatio);

    // Re-distribute stars across updated viewport
    if (this.stars.length === 0) {
      this.initStars();
    }
  }

  initIntersectionObserver() {
    this.observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          this.isPaused = !entry.isIntersecting;
          if (entry.isIntersecting && !this.animationFrameId) {
            this.lastTime = performance.now();
            this.animate();
          }
        });
      },
      { threshold: 0.05 }
    );
    this.observer.observe(this.container);
  }

  /* =========================================================================
     PUBLIC API & CONTROLS BINDING
     ========================================================================= */
  setGravity(value) {
    this.targetGravity = Math.max(0.0, Math.min(1.0, value));
  }

  updateReadout(g) {
    const valEl = document.getElementById('gravity-readout-val');
    const regimeEl = document.getElementById('gravity-regime-label');
    const slider = document.getElementById('flame-g-slider');

    if (valEl) {
      valEl.textContent = `${g.toFixed(2)} g`;
      if (g <= 0.05) {
        valEl.style.color = '#00D2FF';
      } else if (g < 0.5) {
        valEl.style.color = '#00D2FF';
      } else {
        valEl.style.color = '#00D2FF';
      }
    }

    if (regimeEl) {
      if (g <= 0.05) {
        regimeEl.textContent = '0.00g Orbital Microgravity • Soot-Free Spherical Diffusion Flame (NASA ISS)';
      } else if (g <= 0.25) {
        regimeEl.textContent = '0.16g Lunar Gravity • Transitional Oblate Dome (Diffusion Dominated)';
      } else if (g <= 0.5) {
        regimeEl.textContent = '0.38g Martian Gravity • Weak Convection Regime';
      } else {
        regimeEl.textContent = '1.00g Earth Gravity • Buoyant Convective Teardrop Plume';
      }
    }

    if (slider && Math.abs(parseFloat(slider.value) - g) > 0.015) {
      slider.value = g.toFixed(2);
      slider.setAttribute('aria-valuenow', g.toFixed(2));
    }
  }

  bindEvents() {
    const slider = document.getElementById('flame-g-slider');
    if (slider) {
      slider.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        this.setGravity(val);
        document.querySelectorAll('.preset-btn').forEach((btn) => {
          const btnG = parseFloat(btn.dataset.g);
          btn.classList.toggle('active', Math.abs(btnG - val) < 0.05);
        });
      });
    }

    const presetButtons = document.querySelectorAll('.preset-btn');
    presetButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        const val = parseFloat(btn.dataset.g);
        this.setGravity(val);
        presetButtons.forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
      });
    });
  }

  destroy() {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }
    if (this.observer) {
      this.observer.disconnect();
    }
    window.removeEventListener('resize', this.handleResize);
    if (this.canvas) {
      this.canvas.remove();
    }
  }
}
