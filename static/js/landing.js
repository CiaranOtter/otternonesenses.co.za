/* HALFTONE WAVE FIELD.

   Two printing plates (black at 15°, spot at 45°) rendered as dot grids.
   Moving the cursor misregisters the plates. Scrolling drives a three-act,
   overlapping-phase transition (see the PHASE_* constants below):

     1. HEAD  — the title track translates straight up and off the top of
        the sticky panel (no fade, just scroll) as scatterProgress rises.
     2. COLLECT — once the title is essentially gone, the spot (colour)
        plate's dots converge into a band on the left SPLIT of the canvas
        and the black (ink) plate's dots converge into a band on the right,
        matching the About section's 30/70 grid exactly.
     3. GROW — once collected, the dots swell and the band behind them
        solidifies until each side is a flat fill — the dot field literally
        becomes that section's background.

   Each phase's range overlaps the next slightly so the handoff blends
   rather than cuts. A spring (spProgress) chases scatterProgress rather
   than tracking it 1:1, so COLLECT/GROW lag slightly behind scroll and
   overshoot before settling — bouncy and fluid instead of scrubbed; HEAD
   tracks scroll directly since it's meant to read as plain scrolling. The
   hero section is 200vh tall so the sticky panel stays on screen for
   exactly one viewport of scroll — enough time for all three acts and the
   settle to play out. */

(function () {
  "use strict";

  // ── tuning ────────────────────────────────────────────────────────────────
  var PAPER      = "#e9e5db";
  var INK        = "#12100e";
  var SPOT       = "#c1ff72";

  var SPACING    = 15;
  var MAX_DOTS   = 9000;
  var DOT_MAX    = 20;
  var ANGLE_K    = 15;
  var ANGLE_SPOT = 45;
  var CURSOR_R   = 240;
  var MISREG     = 17;
  var SPOT_GATE  = 0.05;
  var IDLE_AFTER = 2600;
  var SPLIT      = 0.30; // matches .about-intro's grid-template-columns: 30% 70%
  var SPRING_K   = 0.020; // spring stiffness driving the collect toward scroll position
  var SPRING_DAMP = 0.78; // per-frame velocity retention — lower = snappier settle

  // Three overlapping acts across the 0→1 scroll range. Each pair overlaps
  // its neighbour slightly so the handoff blends instead of cutting.
  var PHASE_HEAD_END      = 0.30; // title finishes translating off by here
  var PHASE_COLLECT_START = 0.25; // dots start easing toward their band
  var PHASE_COLLECT_END   = 0.65; // dots have reached their band position
  var PHASE_GROW_START    = 0.60; // band + dots start solidifying
  var PHASE_GROW_END      = 1.00; // fully solid, matches the About panels
  var GROW_RADIUS_MULT    = 3;    // how much dots swell by the end of GROW

  var canvas = document.getElementById("field");
  if (!canvas) return;

  var ctx      = canvas.getContext("2d", { alpha: false });
  var hint     = document.getElementById("hint");
  var heroType = document.querySelector(".hero-type");
  var reduced  = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  var W = 0, H = 0, dpr = 1, gap = SPACING, steps = 0, half = 0, diag = 0;
  var px = 0, py = 0, tx = 0, ty = 0;
  var lastMove = -1e9, engaged = false;

  var cK = Math.cos(ANGLE_K    * Math.PI / 180);
  var sK = Math.sin(ANGLE_K    * Math.PI / 180);
  var cS = Math.cos(ANGLE_SPOT * Math.PI / 180);
  var sS = Math.sin(ANGLE_SPOT * Math.PI / 180);

  // Scroll position drives this from 0 → 1.
  var scatterProgress = 0;

  // A lagging, overshooting spring chases scatterProgress rather than the
  // dots tracking scroll 1:1 — that's what makes the collect feel bouncy
  // and fluid instead of scrubbed.
  var spProgress = 0, spVelocity = 0;

  function resize() {
    var r = canvas.getBoundingClientRect();
    W = Math.max(1, Math.round(r.width  || window.innerWidth));
    H = Math.max(1, Math.round(r.height || window.innerHeight));

    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width  = Math.floor(W * dpr);
    canvas.height = Math.floor(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    diag = Math.sqrt(W * W + H * H);
    gap  = SPACING;
    while ((diag / gap) * (diag / gap) > MAX_DOTS) gap += 1;

    steps = Math.ceil(diag / gap) + 2;
    half  = steps / 2;

    if (!engaged) { px = tx = W * 0.5; py = ty = H * 0.5; }
  }

  var K = [
    { kx:  0.0121, ky:  0.0067, w: 0.00082, a: 1.00 },
    { kx: -0.0074, ky:  0.0139, w: 0.00119, a: 0.68 },
    { kx:  0.0043, ky: -0.0051, w: 0.00061, a: 0.44 }
  ];
  var AMP = K[0].a + K[1].a + K[2].a;

  function tone(x, y, time) {
    var h = 0;
    for (var n = 0; n < 3; n++) {
      var k = K[n];
      h += k.a * Math.sin(x * k.kx + y * k.ky - time * k.w);
    }
    return Math.max(0, Math.min(1, (h / AMP + 1) * 0.5));
  }

  // Remaps t from the [a,b] window to a clamped, smoothstepped 0→1 — used
  // to carve the overlapping HEAD/COLLECT/GROW acts out of one timeline.
  function phase(t, a, b) {
    var p = (t - a) / (b - a);
    p = Math.max(0, Math.min(1, p));
    return p * p * (3 - 2 * p);
  }

  // Consistent "random" scatter direction per grid cell — same angle every
  // frame so dots travel in a straight line rather than spiralling.
  function dotAngle(i, j) {
    return Math.atan2(
      Math.sin(i * 7.3199 + j *  3.9113),
      Math.cos(i * 5.1011 + j * 11.7123)
    );
  }

  function updateScroll() {
    var heroEl = document.getElementById("top");
    if (!heroEl) return;

    var scrollable = heroEl.offsetHeight - (window.innerHeight || document.documentElement.clientHeight);
    scatterProgress = scrollable > 0
      ? Math.min(1, Math.max(0, window.scrollY / scrollable))
      : 0;

    // The title doesn't fade — it just scrolls away, finishing within the
    // HEAD act so the dots don't start collecting until it's essentially
    // gone. Tracks scroll directly (no spring) so it reads as plain
    // scrolling rather than the bouncy collect that follows it.
    if (heroType) {
      var headP = phase(scatterProgress, 0, PHASE_HEAD_END);
      heroType.style.transform = "translateY(" + (-headP * 80) + "vh)";
    }

    if (hint && scatterProgress > 0) hint.classList.add("gone");

    // Keep the rAF loop alive while the user is in the hero scroll zone.
    if (scatterProgress < 1) start();
  }

  window.addEventListener("scroll", updateScroll, { passive: true });

  var visible = true;
  var running = false;

  function frame(t) {
    if (!visible) { running = false; return; }

    var leftW = W * SPLIT;

    // Advance the spring every frame, so the bounce keeps playing out even
    // after scroll has already hit the bottom (or top) of the hero.
    spVelocity += (scatterProgress - spProgress) * SPRING_K;
    spVelocity *= SPRING_DAMP;
    spProgress += spVelocity;

    // Fully collected AND the spring has settled: solid bands, pixel-matched
    // to the About section panels waiting underneath. Let the loop rest here.
    var settled = scatterProgress >= 1 &&
                  Math.abs(spProgress - 1) < 0.001 &&
                  Math.abs(spVelocity)     < 0.0005;
    if (settled) {
      spProgress = 1;
      spVelocity = 0;
      ctx.fillStyle = SPOT;
      ctx.fillRect(0, 0, leftW, H);
      ctx.fillStyle = INK;
      ctx.fillRect(leftW, 0, W - leftW, H);
      running = false;
      return;
    }

    // Respect reduced-motion: skip the gradual scatter, vanish immediately.
    if (reduced && scatterProgress > 0) {
      canvas.style.display = "none";
      if (heroType) heroType.style.opacity = "0";
      running = false;
      return;
    }

    var idle = (t - lastMove) > IDLE_AFTER;
    if (idle) {
      tx = W * (0.5 + 0.34 * Math.sin(t * 0.00021));
      ty = H * (0.5 + 0.30 * Math.sin(t * 0.00034 + 1.1));
    }
    var ease = idle ? 0.018 : 0.12;
    px += (tx - px) * ease;
    py += (ty - py) * ease;

    var time = reduced ? 0 : t;
    var cx = W * 0.5, cy = H * 0.5;
    var R2 = CURSOR_R * CURSOR_R;
    var m  = gap * 2;

    // s fades the cursor's misregistration out smoothly across the whole
    // sequence. collectP drives the position collect (COLLECT act); growP
    // drives the solidify + dot swell (GROW act). Both ride the spring
    // (spProgress) so they inherit its lag and overshoot — bouncy and
    // fluid — while staying confined to their own slice of the timeline.
    var s        = Math.max(0, Math.min(1, scatterProgress));
    var collectP = phase(spProgress, PHASE_COLLECT_START, PHASE_COLLECT_END);
    var growP    = phase(spProgress, PHASE_GROW_START, PHASE_GROW_END);
    var posT     = collectP;
    var growMult = 1 + growP * GROW_RADIUS_MULT;

    ctx.fillStyle = PAPER;
    ctx.fillRect(0, 0, W, H);

    // The panels solidify behind the dots once GROW begins, so the halftone
    // texture reads as a spot-colour fill rather than a flat rectangle.
    if (growP > 0) {
      ctx.globalAlpha = growP;
      ctx.fillStyle = SPOT;
      ctx.fillRect(0, 0, leftW, H);
      ctx.fillStyle = INK;
      ctx.fillRect(leftW, 0, W - leftW, H);
      ctx.globalAlpha = 1;
    }

    // ── spot plate (yellow) ─────────────────────────────────────────────────
    ctx.beginPath();
    for (var j = -half; j < half; j++) {
      for (var i = -half; i < half; i++) {
        var u = i * gap, v = j * gap;
        var x = cx + u * cS - v * sS;
        var y = cy + u * sS + v * cS;
        if (x < -m || x > W + m || y < -m || y > H + m) continue;

        var dx = x - px, dy = y - py;
        var d2 = dx * dx + dy * dy;
        var infl = 1 / (1 + d2 / R2);
        if (infl < SPOT_GATE) continue;

        var d   = Math.sqrt(d2);
        var nx  = d > 0.001 ? dx / d : 0;
        var ny  = d > 0.001 ? dy / d : 0;
        var off = infl * MISREG;
        var tn  = tone(x, y, time);
        var rad = (0.3 + tn * DOT_MAX) * 0.5 * infl;
        if (rad < 0.2) continue;

        // Colour plate collects into the left SPLIT of the canvas —
        // squeeze each dot's x toward its proportional spot in that band,
        // preserving left-to-right order, with a little organic vertical
        // drift so the fill doesn't look mechanically uniform.
        var a  = dotAngle(i, j);
        var targetX = (x / W) * leftW;
        var sx = x + nx * off * (1 - s) + (targetX - x) * posT;
        var sy = y + ny * off * (1 - s) + Math.sin(a) * 6 * posT;
        var srad = rad * growMult;

        ctx.moveTo(sx + srad, sy);
        ctx.arc(sx, sy, srad, 0, 6.283185);
      }
    }
    ctx.fillStyle = SPOT;
    ctx.fill();

    // ── black plate ─────────────────────────────────────────────────────────
    ctx.beginPath();
    for (var jj = -half; jj < half; jj++) {
      for (var ii = -half; ii < half; ii++) {
        var uu = ii * gap, vv = jj * gap;
        var bx = cx + uu * cK - vv * sK;
        var by = cy + uu * sK + vv * cK;
        if (bx < -m || bx > W + m || by < -m || by > H + m) continue;

        var bdx   = bx - px, bdy = by - py;
        var bd2   = bdx * bdx + bdy * bdy;
        var binfl = 1 / (1 + bd2 / R2);
        var bd    = Math.sqrt(bd2);

        var tn2 = tone(bx, by, time) +
                  Math.sin(bd * 0.042 - time * 0.0043) * binfl * 0.42;
        tn2 = Math.max(0, Math.min(1, tn2));

        var brad = (0.3 + tn2 * DOT_MAX) * 0.5;
        if (brad < 0.16) continue;

        var bnx  = bd > 0.001 ? bdx / bd : 0;
        var bny  = bd > 0.001 ? bdy / bd : 0;
        var boff = -binfl * MISREG * 0.45;

        // Ink plate collects into the right (1 - SPLIT) of the canvas,
        // mirroring the colour plate so the two bands meet exactly at the
        // SPLIT line the About section's grid uses.
        var ba = dotAngle(ii, jj);
        var btargetX = leftW + (bx / W) * (W - leftW);
        var bsx = bx + bnx * boff * (1 - s) + (btargetX - bx) * posT;
        var bsy = by + bny * boff * (1 - s) + Math.sin(ba) * 6 * posT;
        var bsrad = brad * growMult;

        ctx.moveTo(bsx + bsrad, bsy);
        ctx.arc(bsx, bsy, bsrad, 0, 6.283185);
      }
    }
    ctx.fillStyle = INK;
    ctx.fill();

    requestAnimationFrame(frame);
  }

  function start() {
    if (running) return;
    running = true;
    requestAnimationFrame(frame);
  }

  function point(clientX, clientY) {
    var r = canvas.getBoundingClientRect();
    tx = clientX - r.left;
    ty = clientY - r.top;
    lastMove = performance.now();
    if (!engaged) {
      engaged = true;
      if (hint) hint.classList.add("gone");
    }
  }

  window.addEventListener("pointermove", function (e) {
    point(e.clientX, e.clientY);
  }, { passive: true });

  window.addEventListener("touchmove", function (e) {
    var t0 = e.touches[0];
    if (t0) point(t0.clientX, t0.clientY);
  }, { passive: true });

  var rt;
  window.addEventListener("resize", function () {
    clearTimeout(rt);
    rt = setTimeout(resize, 120);
  });

  if ("IntersectionObserver" in window) {
    new IntersectionObserver(function (entries) {
      visible = entries[0].isIntersecting;
      if (visible) start();
    }, { threshold: 0 }).observe(canvas);
  }

  document.addEventListener("visibilitychange", function () {
    visible = !document.hidden && visible;
    if (!document.hidden) start();
  });

  resize();
  start();
}());
