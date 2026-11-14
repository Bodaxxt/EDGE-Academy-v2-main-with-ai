/**
 * Ignis Atlas — Sprint 2 Lead Systems Integration
 * Fully wires internal data logic and interactive telemetry components to verified experiments.json.
 * 
 * SPRINT 2 DELIVERABLES:
 * 1. Data Ingestion of 5-record verified dataset (BASS-01, FLEX-02, ACME-03, SoFIE-04, GAP-LUNAR-LUCI).
 * 2. Star-Map Scatter Plot:
 *    - Midpoint coordinates plotting for each active experiment.
 *    - Distinct fuel state glyphs: Solid (Square), Liquid (Diamond), Gas (Circle).
 *    - Amber Dashed Bounding Box for Lunar Habitat Zone (O2 >= 30%, P <= 10.2 psi).
 *    - Sliding Source Drawer on click with verified DOI, PSI link, and telemetry gauges.
 * 3. ECLSS Controls & Material Safety Passport Engine:
 *    - Sliders (O2%, Pressure, Airflow) & Gravity Mode buttons.
 *    - 4 Material Cards: PMMA, Cotton-Fiberglass, Silicone Elastomer, Nomex.
 *    - Strict evaluation:
 *      * 🟢 COVERED [✓]: Material tested in microgravity AND conditions within bounds.
 *      * 🟡 EXTRAPOLATED / NEAR [~]: Material tested, but bounds exceeded OR gravity is Lunar 0.16g
 *        ("Tested in 0g, but 0.16g partial-gravity flammability remains unmeasured in PSI").
 *      * 🔴 DATA GAP [✕]: Zero records in PSI ("HIGH-PRIORITY BENCHMARK FOR UPCOMING LUCI / FM2 LUNAR MISSION").
 *    - Cross-highlighting from Material Cards to Star-Map nodes.
 * 4. Gaps Tab:
 *    - Automated summary of DATA GAP items, unmapped coordinate pinpointing, and Earth Spin-Off card.
 */

import { gsap } from 'gsap';
import fallbackExperiments from '../data/experiments.json';

export class IgnisAtlas {
  constructor(options = {}) {
    this.heroFlame = options.heroFlame || null;
    this.experiments = fallbackExperiments || [];
    this.selectedExperiment = null;
    this.customMaterials = [];

    // ECLSS State Variables
    this.currentO2 = 34.0;
    this.currentPressure = 8.2;
    this.currentAirflow = 4.0;
    this.currentGravity = 'lunar'; // '0g' | 'lunar' | 'mars' | '1g'

    // SVG Star-Map Chart Dimensions
    this.viewBoxWidth = 860;
    this.viewBoxHeight = 520;
    this.padding = { top: 40, right: 50, bottom: 65, left: 70 };

    this.xMin = 10;
    this.xMax = 105;
    this.yMin = 0;
    this.yMax = 16.5;

    this.chartWidth = this.viewBoxWidth - this.padding.left - this.padding.right;
    this.chartHeight = this.viewBoxHeight - this.padding.top - this.padding.bottom;

    this.init();
  }

  async init() {
    await this.loadData();
    this.renderStarMap();
    this.renderSidebar();
    this.initDrawer();
    this.initECLSSControls();
    this.initCustomMaterialScreener();
    this.initExportCapability();
    this.initJudgeDemoMode();
    this.initAboutModal();
    this.initTabs();
    this.initTheme();
    this.animateStarMapEntrance();
    this.evaluateMaterialPassport();
  }

  async loadData() {
    try {
      const response = await fetch('/data/experiments.json');
      if (response.ok) {
        const data = await response.json();
        if (Array.isArray(data) && data.length > 0) {
          this.experiments = data;
        }
      }
    } catch {
      console.warn('[Ignis Atlas] Using bundled verified dataset.');
    }
  }

  scaleX(o2Val) {
    return this.padding.left + ((o2Val - this.xMin) / (this.xMax - this.xMin)) * this.chartWidth;
  }

  scaleY(pressureVal) {
    return this.padding.top + (1 - (pressureVal - this.yMin) / (this.yMax - this.yMin)) * this.chartHeight;
  }

  /* ==========================================================================
     1. STAR-MAP SCATTER PLOT (Sprint 2 Core)
     ========================================================================== */
  renderStarMap() {
    const container = document.getElementById('atlas-svg-container');
    if (!container) return;

    let svg = `
      <svg viewBox="0 0 ${this.viewBoxWidth} ${this.viewBoxHeight}" 
           role="img" 
           aria-label="Star-Map: Microgravity combustion experiments plotted at O2 and Pressure midpoint coordinates with distinct fuel glyphs"
           tabindex="0">
        <defs>
          <!-- Cyber-Aerospace Lunar Target Safety Hatching Pattern -->
          <pattern id="lunarHazardPattern" width="16" height="16" patternTransform="rotate(45 0 0)" patternUnits="userSpaceOnUse">
            <line x1="0" y1="0" x2="0" y2="16" stroke="#00F0FF" stroke-width="1.8" stroke-opacity="0.22" />
            <line x1="8" y1="0" x2="8" y2="16" stroke="#F59E0B" stroke-width="1.2" stroke-opacity="0.18" />
          </pattern>

          <!-- Range Envelopes Subtle Background Gradients -->
          <linearGradient id="envelopeGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="#00F0FF" stop-opacity="0.18"/>
            <stop offset="100%" stop-color="#0088FF" stop-opacity="0.05"/>
          </linearGradient>

          <!-- High-Intensity Cyber Glow Filter -->
          <filter id="glowFilter" x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="4.5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          <filter id="nodeHaloFilter" x="-80%" y="-80%" width="260%" height="260%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="6" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <!-- Coordinate Grid & Axes -->
        ${this.buildGridAndAxes()}

        <!-- Tactical Highlighted Perimeter for Lunar Habitat Zone (O2 >= 30%, P <= 10.2 psi) -->
        ${this.buildLunarHabitatZone()}

        <!-- Fiber-Line Telemetry Network Connecting Tested Flight Envelopes -->
        ${this.buildFiberLineTelemetry()}

        <!-- Active Experiment Test Envelopes (Range Rectangles) -->
        <g id="svg-envelopes-group">
          ${this.buildExperimentEnvelopes()}
        </g>

        <!-- Sprint 2: Luminous Midpoint Nodes with Fuel State Glyphs -->
        <g id="svg-midpoint-nodes-group">
          ${this.buildMidpointNodes()}
        </g>

        <!-- Reference Markers (Earth 1g & Spacesuit EVA) -->
        ${this.buildReferenceMarkers()}
      </svg>
    `;

    container.innerHTML = svg;
    this.bindStarMapEvents();
  }

  buildGridAndAxes() {
    let lines = '';

    // Delicate X Grid (O2 %)
    const o2Ticks = [15, 21, 30, 40, 60, 80, 100];
    o2Ticks.forEach((tick) => {
      const x = this.scaleX(tick);
      lines += `
        <line x1="${x}" y1="${this.padding.top}" x2="${x}" y2="${this.padding.top + this.chartHeight}" class="chart-grid-line" />
        <text x="${x}" y="${this.padding.top + this.chartHeight + 24}" class="chart-axis-label mono" text-anchor="middle">${tick}%</text>
      `;
    });

    // Delicate Y Grid (Pressure psi)
    const pTicks = [2, 4.3, 8.2, 10.2, 12, 14.7];
    pTicks.forEach((tick) => {
      const y = this.scaleY(tick);
      lines += `
        <line x1="${this.padding.left}" y1="${y}" x2="${this.padding.left + this.chartWidth}" y2="${y}" class="chart-grid-line" />
        <text x="${this.padding.left - 14}" y="${y + 4}" class="chart-axis-label mono" text-anchor="end">${tick}</text>
      `;
    });

    const xStart = this.padding.left;
    const xEnd = this.padding.left + this.chartWidth;
    const yStart = this.padding.top;
    const yEnd = this.padding.top + this.chartHeight;

    // Glowing Vertical Datum Axes (Earth Atmosphere 21.0% & Lunar Threshold 30.0%)
    const earthDatumX = this.scaleX(21.0);
    const lunarDatumX = this.scaleX(30.0);

    lines += `
      <!-- Glowing Vertical Datum Axes -->
      <line x1="${earthDatumX}" y1="${yStart}" x2="${earthDatumX}" y2="${yEnd}" stroke="#00D2FF" stroke-width="1.2" stroke-dasharray="4 4" stroke-opacity="0.45" />
      <line x1="${lunarDatumX}" y1="${yStart}" x2="${lunarDatumX}" y2="${yEnd}" stroke="#F59E0B" stroke-width="1.2" stroke-dasharray="4 4" stroke-opacity="0.45" />

      <!-- Main Axes -->
      <line x1="${xStart}" y1="${yEnd}" x2="${xEnd}" y2="${yEnd}" class="chart-axis-line" />
      <line x1="${xStart}" y1="${yStart}" x2="${xStart}" y2="${yEnd}" class="chart-axis-line" />
      
      <!-- Axis Titles -->
      <text x="${xStart + this.chartWidth / 2}" y="${yEnd + 52}" class="chart-axis-title mono" text-anchor="middle">
        OXYGEN CONCENTRATION O₂ (% BY VOLUME) &rarr;
      </text>
      <text x="${-(yStart + this.chartHeight / 2)}" y="${20}" class="chart-axis-title mono" text-anchor="middle" transform="rotate(-90)">
        TOTAL CHAMBER PRESSURE (PSI) &rarr;
      </text>
    `;

    return lines;
  }

  buildFiberLineTelemetry() {
    // Generate delicate cyber fiber traces connecting experimental midpoints
    const points = [];
    this.experiments.forEach((exp) => {
      if (exp.o2 && exp.pressure_psi) {
        const midX = this.scaleX((exp.o2[0] + exp.o2[1]) / 2);
        const midY = this.scaleY((exp.pressure_psi[0] + exp.pressure_psi[1]) / 2);
        points.push({ x: midX, y: midY });
      }
    });

    if (points.length < 2) return '';
    points.sort((a, b) => a.x - b.x);

    let d = `M ${points[0].x} ${points[0].y}`;
    for (let i = 1; i < points.length; i++) {
      const prev = points[i - 1];
      const curr = points[i];
      const cx1 = prev.x + (curr.x - prev.x) * 0.5;
      const cy1 = prev.y;
      const cx2 = prev.x + (curr.x - prev.x) * 0.5;
      const cy2 = curr.y;
      d += ` C ${cx1} ${cy1}, ${cx2} ${cy2}, ${curr.x} ${curr.y}`;
    }

    return `
      <!-- Telemetry Fiber-Line Trace connecting Flight Bounds -->
      <path d="${d}" fill="none" stroke="rgba(0, 240, 255, 0.25)" stroke-width="1.5" stroke-dasharray="3 3" filter="url(#glowFilter)" />
    `;
  }

  buildLunarHabitatZone() {
    const x1 = this.scaleX(30.0);
    const x2 = this.scaleX(38.0);
    const yTop = this.scaleY(10.2);
    const yBottom = this.scaleY(6.0);

    const width = x2 - x1;
    const height = yBottom - yTop;

    return `
      <!-- Highlighted Tactical Perimeter for Lunar Habitat Zone with Safety Hatching -->
      <g class="lunar-target-group">
        <rect x="${x1}" y="${yTop}" width="${width}" height="${height}" 
              class="lunar-target-rect" fill="url(#lunarHazardPattern)" rx="8" />
        
        <!-- Corner Reticle Brackets -->
        <path d="M ${x1} ${yTop + 14} L ${x1} ${yTop} L ${x1 + 14} ${yTop}" fill="none" stroke="#00F0FF" stroke-width="2" />
        <path d="M ${x2 - 14} ${yTop} L ${x2} ${yTop} L ${x2} ${yTop + 14}" fill="none" stroke="#00F0FF" stroke-width="2" />
        <path d="M ${x1} ${yBottom - 14} L ${x1} ${yBottom} L ${x1 + 14} ${yBottom}" fill="none" stroke="#00F0FF" stroke-width="2" />
        <path d="M ${x2 - 14} ${yBottom} L ${x2} ${yBottom} L ${x2} ${yBottom - 14}" fill="none" stroke="#00F0FF" stroke-width="2" />

        <text x="${x1 + 14}" y="${yTop + 24}" class="chart-axis-label mono" fill="#00F0FF" font-weight="700" letter-spacing="0.08em">
          LUNAR HABITAT ZONE [TARGET]
        </text>
        <text x="${x1 + 14}" y="${yTop + 40}" class="chart-axis-label mono" fill="#94A3B8">
          O₂ &ge; 30.0% &bull; P &le; 10.2 PSI
        </text>
      </g>
    `;
  }

  buildExperimentEnvelopes() {
    let markup = '';

    this.experiments.forEach((exp) => {
      if (!exp.o2 || !exp.pressure_psi) return;

      const [o2Min, o2Max] = exp.o2;
      const [pMin, pMax] = exp.pressure_psi;

      const x = this.scaleX(o2Min);
      const width = Math.max(14, this.scaleX(o2Max) - x);
      const y = this.scaleY(pMax);
      const height = Math.max(14, this.scaleY(pMin) - y);

      markup += `
        <rect class="experiment-envelope-rect" 
              id="rect-${exp.id}"
              data-id="${exp.id}"
              x="${x}" 
              y="${y}" 
              width="${width}" 
              height="${height}" 
              fill="url(#envelopeGrad)"
              rx="6" />
      `;
    });

    return markup;
  }

  buildMidpointNodes() {
    let markup = '';

    this.experiments.forEach((exp) => {
      if (!exp.o2 || !exp.pressure_psi) return;

      const [o2Min, o2Max] = exp.o2;
      const [pMin, pMax] = exp.pressure_psi;

      // Calculate midpoint coordinates
      const midO2 = (o2Min + o2Max) / 2;
      const midP = (pMin + pMax) / 2;

      const cx = this.scaleX(midO2);
      const cy = this.scaleY(midP);

      const fuelType = (exp.fuel_state || '').toLowerCase();
      let glyphMarkup = '';
      let glyphClass = 'glyph-solid';

      // Sprint 2 Contract: Solid = square, Liquid = diamond, Gas = circle with Luminous Cyber Glow
      if (fuelType.includes('solid')) {
        glyphClass = 'glyph-solid';
        glyphMarkup = `<rect x="${cx - 8}" y="${cy - 8}" width="16" height="16" rx="3" class="midpoint-glyph ${glyphClass}" filter="url(#glowFilter)" />`;
      } else if (fuelType.includes('liquid')) {
        glyphClass = 'glyph-liquid';
        glyphMarkup = `<polygon points="${cx},${cy - 10} ${cx + 10},${cy} ${cx},${cy + 10} ${cx - 10},${cy}" class="midpoint-glyph ${glyphClass}" filter="url(#glowFilter)" />`;
      } else {
        // Gas
        glyphClass = 'glyph-gas';
        glyphMarkup = `<circle cx="${cx}" cy="${cy}" r="8.5" class="midpoint-glyph ${glyphClass}" filter="url(#glowFilter)" />`;
      }

      markup += `
        <g class="star-map-node-group" 
           id="node-${exp.id}"
           data-id="${exp.id}"
           tabindex="0"
           role="button"
           aria-label="${exp.name} node at midpoint O2: ${midO2.toFixed(1)}%, Pressure: ${midP.toFixed(1)} psi. Fuel state: ${exp.fuel_state}.">
          
          <!-- Outer Luminous Pulsing Glow Aura -->
          <circle cx="${cx}" cy="${cy}" r="18" class="node-aura-pulse" filter="url(#nodeHaloFilter)" />

          <!-- Fuel State Glyph -->
          ${glyphMarkup}

          <!-- Node Midpoint Label -->
          <text x="${cx}" y="${cy - 14}" class="node-mid-label mono" text-anchor="middle">${exp.id}</text>
        </g>
      `;
    });

    return markup;
  }

  buildReferenceMarkers() {
    const earthX = this.scaleX(21.0);
    const earthY = this.scaleY(14.7);

    const suitX = this.scaleX(100.0);
    const suitY = this.scaleY(4.3);

    const lunarX = this.scaleX(34.0);
    const lunarY = this.scaleY(8.2);

    return `
      <!-- Earth Reference Marker with Radar Ping -->
      <g class="ref-marker" data-label="Earth Sea Level: 21% O₂, 14.7 psi">
        <circle cx="${earthX}" cy="${earthY}" r="5" class="ref-marker-point" style="stroke: #00D2FF;" />
        <circle cx="${earthX}" cy="${earthY}" r="5" class="ref-marker-ping" style="stroke: #00D2FF;" />
        <text x="${earthX + 12}" y="${earthY + 4}" class="ref-marker-text">Earth (21%, 14.7 psi)</text>
      </g>

      <!-- Spacesuit Reference Marker with Radar Ping -->
      <g class="ref-marker" data-label="EMU Spacesuit: 100% pure O₂, 4.3 psi">
        <circle cx="${suitX}" cy="${suitY}" r="5" class="ref-marker-point" style="stroke: #4AA8FF;" />
        <circle cx="${suitX}" cy="${suitY}" r="5" class="ref-marker-ping" style="stroke: #4AA8FF;" />
        <text x="${suitX - 12}" y="${suitY - 12}" class="ref-marker-text" text-anchor="end">EMU Spacesuit (100%, 4.3 psi)</text>
      </g>

      <!-- Lunar Habitat Baseline Marker with Radar Ping -->
      <g class="ref-marker" data-label="NASA Lunar Exploration Baseline: 34% O₂, 8.2 psi">
        <circle cx="${lunarX}" cy="${lunarY}" r="5" class="ref-marker-point" style="stroke: #00D2FF;" />
        <circle cx="${lunarX}" cy="${lunarY}" r="5" class="ref-marker-ping" style="stroke: #00D2FF;" />
        <text x="${lunarX + 12}" y="${lunarY + 4}" class="ref-marker-text" fill="#00D2FF">Lunar Baseline (34%, 8.2 psi)</text>
      </g>
    `;
  }

  bindStarMapEvents() {
    const tooltip = document.getElementById('chart-tooltip');
    const coordsEl = document.getElementById('chart-cursor-coords');
    const nodes = document.querySelectorAll('.star-map-node-group');

    nodes.forEach((node) => {
      const expId = node.dataset.id;
      const exp = this.experiments.find((e) => e.id === expId);
      if (!exp) return;

      node.addEventListener('mouseenter', () => {
        this.highlightExperimentOnMap(expId, true);
        this.highlightSidebarCard(expId, true);

        if (tooltip) {
          const [o2Min, o2Max] = exp.o2;
          const [pMin, pMax] = exp.pressure_psi;
          const midO2 = ((o2Min + o2Max) / 2).toFixed(1);
          const midP = ((pMin + pMax) / 2).toFixed(1);

          tooltip.innerHTML = `
            <div style="font-size:0.75rem; color:var(--flame); font-weight:700;" class="mono">${exp.id} // ${exp.fuel_state.toUpperCase()}</div>
            <strong style="display:block; margin:3px 0 5px; font-size:0.92rem;">${exp.name}</strong>
            <div style="font-size:0.8rem; color:var(--text-muted); line-height:1.45;">
              <strong>Midpoint:</strong> ${midO2}% O₂ &bull; ${midP} psi<br/>
              <strong>Tested Envelope:</strong> ${o2Min}–${o2Max}% O₂ &bull; ${pMin}–${pMax} psi<br/>
              <strong>Hardware:</strong> ${exp.hardware}
            </div>
            <div style="font-size:0.72rem; color:var(--ok); margin-top:8px; font-weight:600;">Click node to open Source Drawer &rarr;</div>
          `;
          tooltip.classList.add('visible');
        }
      });

      node.addEventListener('mousemove', (e) => {
        if (!tooltip) return;
        const containerRect = document.getElementById('atlas-svg-container').getBoundingClientRect();
        const relX = e.clientX - containerRect.left;
        const relY = e.clientY - containerRect.top;
        tooltip.style.left = `${relX}px`;
        tooltip.style.top = `${relY}px`;

        if (coordsEl) {
          coordsEl.textContent = `TARGET: ${exp.id} // ${exp.hardware} // ${exp.fuel_state}`;
        }
      });

      node.addEventListener('mouseleave', () => {
        this.highlightExperimentOnMap(expId, false);
        this.highlightSidebarCard(expId, false);
        if (tooltip) tooltip.classList.remove('visible');
        if (coordsEl) coordsEl.textContent = 'Hover or click any node to inspect dossier';
      });

      node.addEventListener('click', (e) => {
        e.stopPropagation();
        this.openDrawer(exp);
      });

      node.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          this.openDrawer(exp);
        }
      });
    });

    // Also wire envelope rectangles for seamless inspection
    const rects = document.querySelectorAll('.experiment-envelope-rect');
    rects.forEach((rect) => {
      const expId = rect.dataset.id;
      const exp = this.experiments.find((e) => e.id === expId);
      if (!exp) return;

      rect.addEventListener('mouseenter', () => {
        this.highlightExperimentOnMap(expId, true);
        this.highlightSidebarCard(expId, true);
        if (coordsEl) {
          coordsEl.textContent = `TARGET: ${exp.id} // ${exp.hardware} // ${exp.fuel_state}`;
        }
      });

      rect.addEventListener('mouseleave', () => {
        this.highlightExperimentOnMap(expId, false);
        this.highlightSidebarCard(expId, false);
        if (coordsEl) coordsEl.textContent = 'Hover or click any node to inspect dossier';
      });

      rect.addEventListener('click', (e) => {
        e.stopPropagation();
        this.openDrawer(exp);
      });
    });
  }

  highlightExperimentOnMap(expId, active) {
    const node = document.getElementById(`node-${expId}`);
    const rect = document.getElementById(`rect-${expId}`);

    if (node) {
      node.classList.toggle('active-highlight', active);
    }
    if (rect) {
      rect.classList.toggle('active-highlight', active);
    }
  }

  animateStarMapEntrance() {
    gsap.fromTo(
      '.star-map-node-group',
      { scale: 0, transformOrigin: '50% 50%', opacity: 0 },
      { scale: 1, opacity: 1, duration: 0.7, stagger: 0.12, ease: 'back.out(1.6)' }
    );
  }

  /* ==========================================================================
     SIDEBAR DOSSIER LIST
     ========================================================================== */
  renderSidebar() {
    const listContainer = document.getElementById('dataset-list');
    const pendingContainer = document.getElementById('pending-list');
    const countBadge = document.getElementById('dataset-count-badge');

    if (!listContainer || !pendingContainer) return;

    listContainer.innerHTML = '';
    pendingContainer.innerHTML = '';

    let plottedCount = 0;
    let pendingCount = 0;

    this.experiments.forEach((exp) => {
      const isPlotted = exp.o2 && exp.pressure_psi;

      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'dataset-card';
      card.dataset.id = exp.id;
      card.setAttribute('aria-label', `View details for ${exp.name}`);

      const o2Text = exp.o2 ? `${exp.o2[0]}–${exp.o2[1]}% O₂` : 'Pending O₂ Bounds';
      const pText = exp.pressure_psi ? `${exp.pressure_psi[0]}–${exp.pressure_psi[1]} psi` : 'Pending Pressure';

      card.innerHTML = `
        <div class="card-top-row">
          <span class="card-id mono">${exp.id}</span>
          <span class="card-pill ${isPlotted ? 'plotted-pill' : 'unplotted-pill'}">${isPlotted ? 'PLOTTED' : 'CANDIDATE'}</span>
        </div>
        <div class="card-title">${exp.name}</div>
        <div class="card-conditions mono">${o2Text} &bull; ${pText}</div>
        <div class="card-cta-hint mono">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polygon points="10 8 16 12 10 16 10 8"/></svg>
          <span>Open Telemetry Dossier</span>
        </div>
      `;

      card.addEventListener('mouseenter', () => {
        this.highlightExperimentOnMap(exp.id, true);
      });

      card.addEventListener('mouseleave', () => {
        this.highlightExperimentOnMap(exp.id, false);
      });

      card.addEventListener('click', (e) => {
        e.stopPropagation();
        this.openDrawer(exp);
      });

      if (isPlotted) {
        listContainer.appendChild(card);
        plottedCount++;
      } else {
        pendingContainer.appendChild(card);
        pendingCount++;
      }
    });

    if (countBadge) {
      countBadge.textContent = `${this.experiments.length} Records (${plottedCount} Plotted, ${pendingCount} Candidate)`;
    }
  }

  highlightSidebarCard(expId, highlight) {
    const card = document.querySelector(`.dataset-card[data-id="${expId}"]`);
    if (card) {
      card.classList.toggle('active-selected', highlight);
    }
  }

  /* ==========================================================================
     SOURCE DRAWER CONTROLLER
     ========================================================================== */
  initDrawer() {
    this.drawer = document.getElementById('experiment-drawer');
    this.closeBtn = document.getElementById('drawer-close-btn');
    this.backdrop = document.getElementById('drawer-backdrop');

    if (this.closeBtn) {
      this.closeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.closeDrawer();
      });
    }

    if (this.backdrop) {
      this.backdrop.addEventListener('click', (e) => {
        e.stopPropagation();
        this.closeDrawer();
      });
    }

    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.drawer && this.drawer.classList.contains('open')) {
        this.closeDrawer();
      }
    });
  }

  openDrawer(exp) {
    if (!this.drawer) return;
    this.selectedExperiment = exp;

    document.getElementById('drawer-id').textContent = exp.id;
    document.getElementById('drawer-title').textContent = exp.name;
    document.getElementById('drawer-hardware').textContent = `Hardware Facility: ${exp.hardware}`;
    document.getElementById('drawer-finding').textContent = `"${exp.key_finding}"`;
    document.getElementById('drawer-facility-badge').textContent = `${exp.hardware} // NASA Glenn`;

    const o2Val = exp.o2 ? `${exp.o2[0]}% – ${exp.o2[1]}%` : 'Null (Unmeasured)';
    const pVal = exp.pressure_psi ? `${exp.pressure_psi[0]} – ${exp.pressure_psi[1]} psi` : 'Null (Pending Standard Bounds)';
    const flowVal = exp.airflow_cms ? `${exp.airflow_cms[0]} – ${exp.airflow_cms[1]} cm/s` : 'Quiescent (0 cm/s)';

    document.getElementById('drawer-o2').textContent = o2Val;
    document.getElementById('drawer-pressure').textContent = pVal;
    document.getElementById('drawer-airflow').textContent = flowVal;
    document.getElementById('drawer-gravity').textContent = exp.gravity || 'Microgravity (~10⁻⁴ g)';
    document.getElementById('drawer-fuel').textContent = exp.fuel_state || 'Solid';
    document.getElementById('drawer-materials').textContent = Array.isArray(exp.materials) ? exp.materials.join(', ') : exp.materials;

    // Meter fills
    const meterO2 = document.getElementById('meter-o2');
    const meterP = document.getElementById('meter-p');
    const meterFlow = document.getElementById('meter-flow');

    if (meterO2) meterO2.style.width = exp.o2 ? `${Math.min(100, (exp.o2[1] / 100) * 100)}%` : '0%';
    if (meterP) meterP.style.width = exp.pressure_psi ? `${Math.min(100, (exp.pressure_psi[1] / 16.5) * 100)}%` : '0%';
    if (meterFlow) meterFlow.style.width = exp.airflow_cms ? `${Math.min(100, (exp.airflow_cms[1] / 20) * 100)}%` : '0%';

    document.getElementById('drawer-verified').textContent = `Verified: ${exp.verified_by || 'NASA Physical Sciences Informatics'}`;
    document.getElementById('drawer-notes').textContent = exp.notes || '';

    const psiLink = document.getElementById('drawer-psi-link');
    if (psiLink) {
      psiLink.href = exp.psi_url || 'https://psi.nasa.gov';
      psiLink.setAttribute('target', '_blank');
      psiLink.setAttribute('rel', 'noopener noreferrer');
    }

    const doiLink = document.getElementById('drawer-doi-link');
    if (doiLink) {
      const doiTarget = exp.doi_url || (exp.doi ? `https://doi.org/${exp.doi}` : '#');
      doiLink.href = doiTarget;
      doiLink.setAttribute('target', '_blank');
      doiLink.setAttribute('rel', 'noopener noreferrer');
      doiLink.innerHTML = `<span>Open DOI Resolver (${exp.doi || 'Pending'})</span><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>`;
    }

    this.drawer.classList.add('open');
    this.drawer.setAttribute('aria-hidden', 'false');

    if (this.closeBtn) this.closeBtn.focus();
  }

  closeDrawer() {
    if (!this.drawer) return;
    this.drawer.classList.remove('open');
    this.drawer.setAttribute('aria-hidden', 'true');
  }

  /* ==========================================================================
     2. ECLSS CONTROLS & MATERIAL SAFETY PASSPORT (Sprint 2 & 3 Core)
     ========================================================================== */
  syncControlsAndPassport() {
    const o2Slider = document.getElementById('passport-o2');
    const pSlider = document.getElementById('passport-pressure');
    const flowSlider = document.getElementById('passport-airflow');

    if (o2Slider) o2Slider.value = this.currentO2;
    if (pSlider) pSlider.value = this.currentPressure;
    if (flowSlider) flowSlider.value = this.currentAirflow;

    const o2Val = document.getElementById('passport-o2-val');
    const pVal = document.getElementById('passport-pressure-val');
    const flowVal = document.getElementById('passport-airflow-val');

    if (o2Val) o2Val.textContent = `${this.currentO2.toFixed(1)} %`;
    if (pVal) pVal.textContent = `${this.currentPressure.toFixed(1)} psi`;
    if (flowVal) flowVal.textContent = `${this.currentAirflow.toFixed(1)} cm/s`;

    // Sync active state on Gravity buttons
    document.querySelectorAll('.gravity-mode-btn').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.gravity === this.currentGravity);
    });

    // 3D Flame Live State Binding (Fix Decoupling)
    if (this.heroFlame) {
      let gVal = 0.0;
      if (this.currentGravity === '1g') gVal = 1.0;
      else if (this.currentGravity === 'lunar') gVal = 0.16;
      else if (this.currentGravity === 'mars') gVal = 0.38;
      else gVal = 0.0; // 0g ISS
      this.heroFlame.setGravity(gVal);
    }

    // Sync active state on Mission Preset buttons
    const presets = [
      { id: 'preset-iss', o2: 21.0, p: 14.7, flow: 2.5, g: '0g' },
      { id: 'preset-lunar', o2: 34.0, p: 8.2, flow: 4.0, g: 'lunar' },
      { id: 'preset-mars', o2: 28.0, p: 9.5, flow: 3.0, g: 'mars' },
      { id: 'preset-earth', o2: 21.0, p: 14.7, flow: 0.0, g: '1g' },
    ];
    presets.forEach((preset) => {
      const btn = document.getElementById(preset.id);
      if (btn) {
        const isMatch = Math.abs(this.currentO2 - preset.o2) < 0.2 &&
                        Math.abs(this.currentPressure - preset.p) < 0.2 &&
                        this.currentGravity === preset.g;
        btn.classList.toggle('active', isMatch);
      }
    });

    this.evaluateMaterialPassport();
  }

  initECLSSControls() {
    const o2Slider = document.getElementById('passport-o2');
    const pSlider = document.getElementById('passport-pressure');
    const flowSlider = document.getElementById('passport-airflow');

    // Sliders listeners
    if (o2Slider) {
      o2Slider.addEventListener('input', (e) => {
        this.currentO2 = parseFloat(e.target.value);
        this.syncControlsAndPassport();
      });
    }

    if (pSlider) {
      pSlider.addEventListener('input', (e) => {
        this.currentPressure = parseFloat(e.target.value);
        this.syncControlsAndPassport();
      });
    }

    if (flowSlider) {
      flowSlider.addEventListener('input', (e) => {
        this.currentAirflow = parseFloat(e.target.value);
        this.syncControlsAndPassport();
      });
    }

    // Gravity mode buttons
    document.querySelectorAll('.gravity-mode-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.currentGravity = btn.dataset.gravity;
        this.syncControlsAndPassport();
      });
    });

    // Mission Preset buttons
    const presets = [
      { id: 'preset-iss', o2: 21.0, p: 14.7, flow: 2.5, g: '0g' },
      { id: 'preset-lunar', o2: 34.0, p: 8.2, flow: 4.0, g: 'lunar' },
      { id: 'preset-mars', o2: 28.0, p: 9.5, flow: 3.0, g: 'mars' },
      { id: 'preset-earth', o2: 21.0, p: 14.7, flow: 0.0, g: '1g' },
    ];

    presets.forEach((preset) => {
      const btn = document.getElementById(preset.id);
      if (btn) {
        btn.addEventListener('click', () => {
          this.currentO2 = preset.o2;
          this.currentPressure = preset.p;
          this.currentAirflow = preset.flow;
          this.currentGravity = preset.g;
          this.syncControlsAndPassport();
        });
      }
    });

    // Initial sync
    this.syncControlsAndPassport();
  }

  /* ==========================================================================
     HABITAT ASSESSMENT JSON EXPORT (Sprint 3 Deliverable)
     ========================================================================== */
  initExportCapability() {
    const exportBtn = document.getElementById('btn-export-assessment');
    if (!exportBtn) return;

    exportBtn.addEventListener('click', () => {
      this.exportAssessmentJSON();
    });
  }

  exportAssessmentJSON() {
    const materials = [
      {
        id: 'MAT-PMMA',
        name: 'PMMA (Acrylic)',
        subtitle: 'Poly(methyl methacrylate) • Structural thermoplastics & optical viewports',
        testedIn: ['EXP-BASS-01', 'EXP-SOFIE-04'],
        hasMicrogravityRecords: true,
        o2Bounds: [16.0, 32.0],
        pBounds: [8.0, 14.7],
      },
      {
        id: 'MAT-COTTON',
        name: 'Cotton-Fiberglass Blend',
        subtitle: '75/25 Cotton-Fiberglass fabric • Crew cabin textiles & interior insulation',
        testedIn: ['EXP-BASS-01'],
        hasMicrogravityRecords: true,
        o2Bounds: [16.0, 29.0],
        pBounds: [11.6, 14.7],
      },
      {
        id: 'MAT-SILICONE',
        name: 'Silicone Elastomer',
        subtitle: 'Polysiloxane elastomer • Hatch pressure seals, cable feedthroughs & O-rings',
        testedIn: ['GAP-LUNAR-LUCI'],
        hasMicrogravityRecords: false,
        o2Bounds: null,
        pBounds: null,
      },
      {
        id: 'MAT-NOMEX',
        name: 'Nomex Aramid Blend',
        subtitle: 'Flame-resistant meta-aramid • Spacewalker thermal garments & avionics wrap',
        testedIn: ['GAP-LUNAR-LUCI'],
        hasMicrogravityRecords: false,
        o2Bounds: null,
        pBounds: null,
      },
    ];

    const evaluatedMaterials = materials.map((mat) => {
      let status = 'DATA_GAP';
      let code = '[✕] DATA GAP';
      let reason = '';
      let actionTag = '';

      if (!mat.hasMicrogravityRecords) {
        status = 'DATA_GAP';
        code = '[✕] DATA GAP';
        actionTag = 'HIGH-PRIORITY BENCHMARK FOR UPCOMING LUCI / FM2 LUNAR MISSION';
        reason = 'Material has zero microgravity combustion records in PSI. Flammability limits and pyrolysis kinetics under spaceflight environments remain unmeasured.';
      } else {
        const insideO2 = this.currentO2 >= mat.o2Bounds[0] && this.currentO2 <= mat.o2Bounds[1];
        const insideP = this.currentPressure >= mat.pBounds[0] && this.currentPressure <= mat.pBounds[1];

        if (this.currentGravity === '0g' && insideO2 && insideP) {
          status = 'COVERED';
          code = '[✓] COVERED';
          reason = `Material tested in microgravity (${mat.testedIn.join(', ')}). Current conditions (${this.currentO2.toFixed(1)}% O₂, ${this.currentPressure.toFixed(1)} psi) fall within verified bounds.`;
        } else {
          status = 'EXTRAPOLATED';
          code = '[~] EXTRAPOLATED';
          if (this.currentGravity === 'lunar') {
            reason = 'Tested in 0g, but 0.16g partial-gravity flammability remains unmeasured in PSI.';
          } else if (this.currentGravity === 'mars') {
            reason = 'Tested in 0g, but 0.38g Martian partial-gravity flammability remains unmeasured in PSI.';
          } else if (!insideO2 || !insideP) {
            reason = `Material tested in 0g, but current atmospheric conditions exceed verified PSI bounds (${mat.o2Bounds[0]}–${mat.o2Bounds[1]}% O₂, ${mat.pBounds[0]}–${mat.pBounds[1]} psi).`;
          } else {
            reason = 'Terrestrial buoyant convection baseline. Microgravity extinction limits require adjustment.';
          }
        }
      }

      return {
        material_id: mat.id,
        name: mat.name,
        application: mat.subtitle,
        screening_status: status,
        evaluation_badge: code,
        engineering_reason: reason,
        recommendation_action: actionTag || null,
        correlated_experiments: mat.testedIn,
        verified_bounds: mat.o2Bounds ? { o2_min_max_pct: mat.o2Bounds, pressure_min_max_psi: mat.pBounds } : null,
      };
    });

    const report = {
      screening_assessment_meta: {
        platform: "Ignis Atlas — NASA Space Apps Challenge",
        tool_version: "v2.0.0-sprint3",
        generated_at: new Date().toISOString(),
        standard_reference: "NASA-STD-6001 Engineering Decision Support Aid",
        data_repository: "NASA Physical Sciences Informatics (PSI) - psi.nasa.gov",
        scientific_disclaimer: "NOT a formal safety certification. Flammability qualification requires formal NASA-STD-6001 test execution and Aerospace Flight Safety Board review."
      },
      eclss_simulated_environment: {
        oxygen_concentration_pct: this.currentO2,
        total_chamber_pressure_psi: this.currentPressure,
        forced_ventilation_airflow_cms: this.currentAirflow,
        gravitational_regime: this.currentGravity,
        gravity_constant_g: this.currentGravity === '0g' ? 0.0 : this.currentGravity === 'lunar' ? 0.16 : this.currentGravity === 'mars' ? 0.38 : 1.0,
      },
      screened_materials: evaluatedMaterials,
      critical_data_gaps_identified: [
        {
          gap_id: "GAP-PARTIAL-GRAVITY",
          regime: "Lunar 0.16g & Martian 0.38g",
          finding: "Zero investigations exist in NASA PSI with reduced gravity flammability boundaries.",
          recommended_mission: "Dedicated lunar centrifuge flight experiment or LUCI payload benchmark."
        },
        {
          gap_id: "GAP-ELASTOMER-SEALS",
          material: "Silicone Elastomer / Nomex",
          finding: "Zero standardized microgravity combustion envelopes exist in PSI.",
          recommended_mission: "LUCI / FM2 Lunar Mission prioritization."
        }
      ],
      cited_investigations: this.experiments.map((e) => ({
        id: e.id,
        name: e.name,
        hardware: e.hardware,
        psi_url: e.psi_url,
        doi: e.doi
      }))
    };

    const jsonStr = JSON.stringify(report, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ignis-atlas-screening-assessment-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  /* ==========================================================================
     CUSTOM MATERIAL SCREENER ENGINE (Interactive Extensibility)
     ========================================================================== */
  initCustomMaterialScreener() {
    const toggleBtn = document.getElementById('btn-toggle-custom-mat');
    const formContainer = document.getElementById('custom-material-form-container');
    const closeBtn = document.getElementById('btn-close-custom-form');
    const form = document.getElementById('custom-material-form');

    if (toggleBtn && formContainer) {
      toggleBtn.addEventListener('click', () => {
        const isHidden = formContainer.style.display === 'none';
        formContainer.style.display = isHidden ? 'block' : 'none';
        if (isHidden) {
          const input = document.getElementById('custom-mat-name');
          if (input) input.focus();
        }
      });
    }

    if (closeBtn && formContainer) {
      closeBtn.addEventListener('click', () => {
        formContainer.style.display = 'none';
      });
    }

    if (form) {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const nameInput = document.getElementById('custom-mat-name');
        const o2Input = document.getElementById('custom-mat-o2');
        if (!nameInput || !o2Input) return;

        const matName = nameInput.value.trim();
        const targetO2 = parseFloat(o2Input.value);
        if (!matName) return;

        const customMat = {
          id: `CUSTOM-${Date.now().toString().slice(-4)}`,
          name: matName,
          subtitle: `User-Screened Material Specification • Target Max: ${targetO2.toFixed(1)}% O₂`,
          testedIn: ['PSI-25', 'GAP-LUCI-01'],
          hasMicrogravityRecords: false,
          targetO2: targetO2,
          isUserCustom: true,
          o2Bounds: null,
          pBounds: null,
        };

        this.customMaterials.unshift(customMat);
        this.evaluateMaterialPassport();

        // Feedback: scroll to newly inserted card and pulse it
        setTimeout(() => {
          this.pulseHighlightCard(customMat.id, 'mat-pulse-gap');
        }, 100);

        form.reset();
        o2Input.value = '34.0';
      });
    }
  }

  evaluateMaterialPassport() {
    const container = document.getElementById('material-cards-container');
    const summaryEl = document.getElementById('passport-eval-summary');
    if (!container) return;

    // Define the baseline materials + any dynamic custom screened materials
    const baseMaterials = [
      {
        id: 'MAT-PMMA',
        name: 'PMMA (Acrylic)',
        subtitle: 'Poly(methyl methacrylate) • Structural thermoplastics & optical viewports',
        testedIn: ['PSI-25', 'PSI-68'],
        hasMicrogravityRecords: true,
        // Cumulative tested bounds: O2 [15.0, 22.2], P [11.6, 14.7]
        o2Bounds: [15.0, 22.2],
        pBounds: [11.6, 14.7],
      },
      {
        id: 'MAT-COTTON',
        name: 'Cotton-Fiberglass Blend',
        subtitle: '75/25 Cotton-Fiberglass fabric • Crew cabin textiles & interior insulation',
        testedIn: ['PSI-25'],
        hasMicrogravityRecords: true,
        o2Bounds: [15.0, 22.2],
        pBounds: [11.6, 14.7],
      },
      {
        id: 'MAT-SILICONE',
        name: 'Silicone Elastomer',
        subtitle: 'Polysiloxane elastomer • Hatch pressure seals, cable feedthroughs & O-rings',
        testedIn: ['GAP-LUCI-01'],
        hasMicrogravityRecords: false, // 0 standardized microgravity records in PSI
        o2Bounds: null,
        pBounds: null,
      },
      {
        id: 'MAT-NOMEX',
        name: 'Nomex Aramid Blend',
        subtitle: 'Flame-resistant meta-aramid • Spacewalker thermal garments & avionics wrap',
        testedIn: ['GAP-LUCI-01'],
        hasMicrogravityRecords: false, // 0 standardized microgravity records in PSI
        o2Bounds: null,
        pBounds: null,
      },
    ];

    const materials = [...this.customMaterials, ...baseMaterials];

    container.innerHTML = '';
    let coveredCount = 0;
    let nearCount = 0;
    let gapCount = 0;

    materials.forEach((mat) => {
      let status = 'gap'; // 'covered' | 'near' | 'gap'
      let statusBadge = '🔴 DATA GAP [✕]';
      let statusClass = 'mat-status-gap';
      let reasonText = '';
      let tagText = '';

      if (mat.isUserCustom) {
        status = 'gap';
        statusBadge = '[✕] DATA GAP';
        statusClass = 'mat-status-gap';
        tagText = 'USER CUSTOM SCREENING // HIGH-PRIORITY LUCI BENCHMARK';
        reasonText = `Zero microgravity flight data in NASA PSI repository for "${mat.name}" under ${mat.targetO2.toFixed(1)}% O₂. Flammability boundary unmeasured in space environments. Flagged as primary candidate for LUCI/FM2 lunar mission payload.`;
        gapCount++;
      } else if (!mat.hasMicrogravityRecords) {
        // Strict Sprint 2 Rule: Zero microgravity combustion records in PSI
        status = 'gap';
        statusBadge = '[✕] DATA GAP';
        statusClass = 'mat-status-gap';
        tagText = 'HIGH-PRIORITY BENCHMARK FOR UPCOMING LUCI / FM2 LUNAR MISSION';
        reasonText = 'Material has zero microgravity combustion records in PSI. Flammability limits and pyrolysis kinetics under spaceflight environments remain unmeasured.';
        gapCount++;
      } else {
        // Material is tested in microgravity (PMMA or Cotton-Fiberglass)
        const insideO2 = this.currentO2 >= mat.o2Bounds[0] && this.currentO2 <= mat.o2Bounds[1];
        const insideP = this.currentPressure >= mat.pBounds[0] && this.currentPressure <= mat.pBounds[1];

        if (this.currentGravity === '0g' && insideO2 && insideP) {
          // COVERED [✓]
          status = 'covered';
          statusBadge = '[✓] COVERED';
          statusClass = 'mat-status-ok';
          reasonText = `Material tested in microgravity (${mat.testedIn.join(', ')}). Current conditions (${this.currentO2.toFixed(1)}% O₂, ${this.currentPressure.toFixed(1)} psi) fall within verified bounds.`;
          coveredCount++;
        } else {
          // EXTRAPOLATED / NEAR [~]
          status = 'near';
          statusBadge = '[~] EXTRAPOLATED';
          statusClass = 'mat-status-near';

          if (this.currentGravity === 'lunar') {
            reasonText = `Tested in 0g up to ${mat.o2Bounds[1]}% O₂; 0.16g partial-gravity flammability unmeasured in PSI.`;
          } else if (this.currentGravity === 'mars') {
            reasonText = `Tested in 0g up to ${mat.o2Bounds[1]}% O₂; 0.38g Martian partial-gravity flammability unmeasured in PSI.`;
          } else if (!insideO2 || !insideP) {
            reasonText = `Material tested in 0g, but current atmospheric conditions exceed verified PSI bounds (${mat.o2Bounds[0]}–${mat.o2Bounds[1]}% O₂, ${mat.pBounds[0]}–${mat.pBounds[1]} psi).`;
          } else {
            reasonText = 'Terrestrial buoyant convection baseline. Microgravity extinction limits require adjustment.';
          }
          nearCount++;
        }
      }

      // Build Material Card DOM
      const card = document.createElement('div');
      card.className = `material-passport-card glass-card ${statusClass}`;
      card.dataset.materialId = mat.id;

      card.innerHTML = `
        <div class="mat-card-header">
          <div>
            <div class="mat-name-row">
              <h4 class="mat-name">${mat.name}</h4>
              <span class="mat-status-badge mono">${statusBadge}</span>
            </div>
            <p class="mat-subtitle">${mat.subtitle}</p>
          </div>
        </div>

        <div class="mat-body">
          <p class="mat-reason">${reasonText}</p>
          ${tagText ? `<div class="mat-tag mono">${tagText}</div>` : ''}
        </div>

        <div class="mat-footer">
          <span class="mat-dataset-ref mono">Correlated: ${mat.testedIn.join(' &bull; ')}</span>
          <button type="button" class="btn-highlight-node mono" data-target-exp="${mat.testedIn[0]}">
            <span>Cross-Highlight on Star-Map</span>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
          </button>
        </div>
      `;

      // Wire Cross-Highlighting button: switches to Star-Map and pulses node
      const highlightBtn = card.querySelector('.btn-highlight-node');
      if (highlightBtn) {
        highlightBtn.addEventListener('click', () => {
          this.crossHighlightMaterialToStarMap(mat.testedIn);
        });
      }

      container.appendChild(card);
    });

    if (summaryEl) {
      summaryEl.textContent = `STATUS: ${coveredCount} COVERED // ${nearCount} EXTRAPOLATED // ${gapCount} DATA GAP`;
    }

    const gapsCountEl = document.getElementById('gaps-count-display');
    if (gapsCountEl) {
      gapsCountEl.textContent = gapCount.toString();
    }
  }

  crossHighlightMaterialToStarMap(experimentIds) {
    // 1. Switch to Star-Map View
    const atlasTabBtn = document.getElementById('tab-atlas');
    if (atlasTabBtn) atlasTabBtn.click();

    // 2. Scroll smoothly to the chart
    const chartContainer = document.getElementById('atlas-svg-container');
    if (chartContainer) {
      chartContainer.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    // 3. Highlight each experiment node on the map
    experimentIds.forEach((id) => {
      this.highlightExperimentOnMap(id, true);

      // Open drawer for the primary experiment
      const exp = this.experiments.find((e) => e.id === id);
      if (exp) {
        setTimeout(() => {
          this.openDrawer(exp);
        }, 300);
      }
    });
  }

  /* ==========================================================================
     JUDGE DEMO MODE & GUIDED EVALUATION TOUR (Sprint 3 Core)
     ========================================================================== */
  initJudgeDemoMode() {
    this.demoBtn = document.getElementById('btn-judge-demo');
    this.tourOverlay = document.getElementById('tour-hud-overlay');
    this.tourStepBadge = document.getElementById('tour-step-badge');
    this.tourStepTitle = document.getElementById('tour-step-title');
    this.tourDesc = document.getElementById('tour-hud-desc');
    this.tourProgressFill = document.getElementById('tour-progress-fill');
    this.tourPauseBtn = document.getElementById('tour-pause-btn');
    this.tourCloseBtn = document.getElementById('tour-close-btn');

    this.tourIsRunning = false;
    this.tourIsPaused = false;
    this.tourTimeElapsed = 0;
    this.currentTourStep = 0;
    this.tourInterval = null;

    if (this.demoBtn) {
      this.demoBtn.addEventListener('click', () => {
        this.startJudgeDemoTour();
      });
    }

    if (this.tourPauseBtn) {
      this.tourPauseBtn.addEventListener('click', () => {
        this.togglePauseTour();
      });
    }

    if (this.tourCloseBtn) {
      this.tourCloseBtn.addEventListener('click', () => {
        this.stopJudgeDemoTour();
      });
    }

    // Auto-trigger via URL query param: ?demo=1 or ?judge=1
    try {
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get('demo') === '1' || urlParams.get('demo') === 'true' || urlParams.get('judge') === '1') {
        setTimeout(() => {
          this.startJudgeDemoTour();
        }, 800);
      }
    } catch (e) {
      console.warn('URL search params parsing ignored:', e);
    }
  }

  startJudgeDemoTour() {
    if (this.tourIsRunning) {
      this.stopJudgeDemoTour();
    }

    this.tourIsRunning = true;
    this.tourIsPaused = false;
    this.tourTimeElapsed = 0;
    this.currentTourStep = 0;

    if (this.tourOverlay) {
      this.tourOverlay.hidden = false;
      this.tourOverlay.classList.add('visible');
    }
    if (this.tourPauseBtn) {
      this.tourPauseBtn.textContent = 'Pause';
    }

    // Switch view to Material Passport tab
    const passportTabBtn = document.getElementById('tab-passport');
    if (passportTabBtn) passportTabBtn.click();

    // Scroll to views container
    const viewsContainer = document.getElementById('views-container');
    if (viewsContainer) {
      viewsContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    // Initial tick
    this.executeTourTick(0);

    // Run clock loop (every 200ms)
    this.tourInterval = setInterval(() => {
      if (!this.tourIsPaused) {
        this.tourTimeElapsed += 0.2;
        this.executeTourTick(this.tourTimeElapsed);

        if (this.tourTimeElapsed >= 30.0) {
          this.completeJudgeDemoTour();
        }
      }
    }, 200);
  }

  executeTourTick(timeSec) {
    if (!this.tourProgressFill) return;

    // Progress bar width & Circular countdown ring (circumference 2*pi*15 = ~94.2)
    const pct = Math.min(100, (timeSec / 30.0) * 100);
    this.tourProgressFill.style.width = `${pct.toFixed(1)}%`;

    const countdownRing = document.getElementById('tour-countdown-ring');
    if (countdownRing) {
      const offset = 94.2 - (pct / 100) * 94.2;
      countdownRing.style.strokeDashoffset = `${offset.toFixed(1)}`;
    }

    // Step 1: 0 to 8s (ISS Baseline -> PMMA Covered, 0g Blue Sphere Flame)
    if (timeSec < 8.0) {
      if (this.currentTourStep !== 1) {
        this.currentTourStep = 1;
        this.currentO2 = 21.0;
        this.currentPressure = 14.7;
        this.currentAirflow = 2.5;
        this.currentGravity = '0g';
        this.syncControlsAndPassport();

        if (this.tourStepBadge) this.tourStepBadge.textContent = 'STEP 1/4 // 08s';
        if (this.tourStepTitle) this.tourStepTitle.textContent = 'ISS ORBITAL BASELINE (0.00g)';
        if (this.tourDesc) {
          this.tourDesc.textContent = 'Auto-selecting ISS Cabin baseline (21% O₂, 14.7 psi, 0.00g). 3D flame morphs to spherical blue diffusion shell. PMMA acrylic evaluates as [✓] COVERED inside verified BASS-II/FLEX boundaries.';
        }

        this.pulseHighlightCard('MAT-PMMA', 'mat-pulse-ok');
      }
    }
    // Step 2: 8 to 18s (Artemis Lunar Base -> PMMA Extrapolated, 0.16g Hybrid Flame)
    else if (timeSec >= 8.0 && timeSec < 18.0) {
      if (this.currentTourStep !== 2) {
        this.currentTourStep = 2;
        this.currentO2 = 34.0;
        this.currentPressure = 8.2;
        this.currentAirflow = 4.0;
        this.currentGravity = 'lunar';
        this.syncControlsAndPassport();

        if (this.tourStepBadge) this.tourStepBadge.textContent = 'STEP 2/4 // 10s';
        if (this.tourStepTitle) this.tourStepTitle.textContent = 'LUNAR BASE ENVELOPE (0.16g)';
        if (this.tourDesc) {
          this.tourDesc.textContent = 'Switching to Lunar Exploration Habitat (34% O₂, 8.2 psi, 0.16g). 3D flame transitions to oblate 0.16g hybrid. PMMA flips to [~] EXTRAPOLATED: "Tested in 0g up to 22.2% O2; 0.16g partial-gravity flammability unmeasured in PSI".';
        }

        this.pulseHighlightCard('MAT-PMMA', 'mat-pulse-near');
      }
    }
    // Step 3: 18 to 28s (Silicone Elastomer Critical Data Gap / LUCI)
    else if (timeSec >= 18.0 && timeSec < 28.0) {
      if (this.currentTourStep !== 3) {
        this.currentTourStep = 3;
        this.syncControlsAndPassport();

        if (this.tourStepBadge) this.tourStepBadge.textContent = 'STEP 3/4 // 10s';
        if (this.tourStepTitle) this.tourStepTitle.textContent = 'CRITICAL MATERIAL VOID (LUCI TARGET)';
        if (this.tourDesc) {
          this.tourDesc.textContent = 'Silicone Elastomer hatch pressure seals evaluate as [✕] DATA GAP. Zero flight records exist in PSI, establishing the primary flight test requirement for upcoming LUCI/FM2 lunar missions.';
        }

        this.pulseHighlightCard('MAT-SILICONE', 'mat-pulse-gap');
      }
    }
    // Step 4: 28 to 30s (Smooth wrap-up showing Earth Spin-Offs)
    else if (timeSec >= 28.0) {
      if (this.currentTourStep !== 4) {
        this.currentTourStep = 4;
        if (this.tourStepBadge) this.tourStepBadge.textContent = 'STEP 4/4 // 02s';
        if (this.tourStepTitle) this.tourStepTitle.textContent = 'EARTH SPIN-OFFS & COMPLETE';
        if (this.tourDesc) {
          this.tourDesc.textContent = 'Evaluation complete! Terrestrial spin-offs validated: Fine-Mist Extinguishers (from FLEX) and EV Battery Thermal-Runaway detection (from BASS/SAME).';
        }
      }
    }
  }

  pulseHighlightCard(cardId, pulseClass) {
    document.querySelectorAll('.material-passport-card').forEach((c) => {
      c.classList.remove('mat-pulse-ok', 'mat-pulse-near', 'mat-pulse-gap');
    });

    const targetCard = document.querySelector(`.material-passport-card[data-material-id="${cardId}"]`);
    if (targetCard) {
      targetCard.classList.add(pulseClass);
      targetCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }

  togglePauseTour() {
    this.tourIsPaused = !this.tourIsPaused;
    if (this.tourPauseBtn) {
      this.tourPauseBtn.textContent = this.tourIsPaused ? 'Resume' : 'Pause';
    }
  }

  completeJudgeDemoTour() {
    clearInterval(this.tourInterval);
    this.tourIsRunning = false;
    setTimeout(() => {
      this.stopJudgeDemoTour();
    }, 4000);
  }

  stopJudgeDemoTour() {
    clearInterval(this.tourInterval);
    this.tourIsRunning = false;
    this.tourIsPaused = false;
    this.currentTourStep = 0;

    if (this.tourOverlay) {
      this.tourOverlay.hidden = true;
      this.tourOverlay.classList.remove('visible');
    }

    document.querySelectorAll('.material-passport-card').forEach((c) => {
      c.classList.remove('mat-pulse-ok', 'mat-pulse-near', 'mat-pulse-gap');
    });
  }

  /* ==========================================================================
     ABOUT MODAL & NAVIGATION CONTROLLER
     ========================================================================== */
  initAboutModal() {
    const modal = document.getElementById('modal-about');
    const openBtn = document.getElementById('btn-about');
    const closeBtn = document.getElementById('modal-close-btn');
    const ackBtn = document.getElementById('modal-ack-btn');
    const backdrop = document.getElementById('modal-backdrop');

    const open = () => {
      if (!modal) return;
      modal.classList.add('open');
      modal.setAttribute('aria-hidden', 'false');
      if (closeBtn) closeBtn.focus();
    };

    const close = () => {
      if (!modal) return;
      modal.classList.remove('open');
      modal.setAttribute('aria-hidden', 'true');
    };

    if (openBtn) openBtn.addEventListener('click', open);
    if (closeBtn) closeBtn.addEventListener('click', close);
    if (ackBtn) ackBtn.addEventListener('click', close);
    if (backdrop) backdrop.addEventListener('click', close);

    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && modal && modal.classList.contains('open')) {
        close();
      }
    });
  }

  initTabs() {
    const tabConfigs = [
      { id: 'view-atlas', headerBtn: document.getElementById('tab-atlas') },
      { id: 'view-passport', headerBtn: document.getElementById('tab-passport') },
      { id: 'view-gaps', headerBtn: document.getElementById('tab-gaps') },
    ];

    const switchTab = (targetId) => {
      tabConfigs.forEach(({ id, headerBtn }) => {
        const view = document.getElementById(id);
        const isActive = id === targetId;

        if (headerBtn) {
          headerBtn.classList.toggle('active', isActive);
          headerBtn.setAttribute('aria-selected', isActive ? 'true' : 'false');
          headerBtn.setAttribute('tabindex', isActive ? '0' : '-1');
        }

        const secBtn = document.querySelector(`.section-tab-btn[data-target="${id}"]`);
        if (secBtn) {
          secBtn.classList.toggle('active', isActive);
        }

        if (view) {
          view.hidden = !isActive;
          view.classList.toggle('active', isActive);
          if (isActive) {
            gsap.fromTo(view, { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.35, ease: 'power2.out' });
          }
        }
      });
    };

    tabConfigs.forEach(({ id, headerBtn }) => {
      if (headerBtn) {
        headerBtn.addEventListener('click', () => switchTab(id));
      }
    });

    document.querySelectorAll('.section-tab-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const targetId = btn.dataset.target;
        switchTab(targetId);
      });
    });
  }

  initTheme() {
    const toggleBtn = document.getElementById('theme-toggle');
    if (!toggleBtn) return;

    toggleBtn.addEventListener('click', () => {
      const currentTheme = document.documentElement.getAttribute('data-theme') || 'dark';
      const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', newTheme);
    });
  }
}
