/* HALFTONE WAVE FIELD.

   Same interference maths as before, different output. Amplitude now drives
   dot *diameter* only — that's what a halftone screen does, and it's why the
   field reads as ink rather than light.

   Two plates at true screen angles: black at 15 degrees, spot at 45. They sit
   in perfect register until the pointer pulls them apart, which is exactly how
   a two-colour press goes wrong. The misregistration is the interaction. */

(function () {
  "use strict";

  // ── tuning ────────────────────────────────────────────────────────────────
  var PAPER      = "#e9e5db";
  var INK        = "#12100e";
  var SPOT       = "#e8340c";

  var SPACING    = 15;    // px between screen dots
  var MAX_DOTS   = 9000;  // hard cap; spacing widens rather than exceed it
  var DOT_MAX    = 20;   // px diameter at full tone
  var ANGLE_K    = 15;    // black plate screen angle, degrees
  var ANGLE_SPOT = 45;    // spot plate screen angle
  var CURSOR_R   = 240;   // px radius of pointer influence
  var MISREG     = 17;    // px the plates separate directly under the pointer
  var SPOT_GATE  = 0.05;  // below this influence the spot plate isn't inked
  var IDLE_AFTER = 2600;  // ms before the drift takes back over

  var canvas = document.getElementById("field");
  if (!canvas) return;

  var ctx = canvas.getContext("2d", { alpha: false });
  var hint = document.getElementById("hint");
  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  var W = 0, H = 0, dpr = 1, gap = SPACING, steps = 0, half = 0;
  var px = 0, py = 0, tx = 0, ty = 0;
  var lastMove = -1e9, engaged = false;

  var cK = Math.cos(ANGLE_K * Math.PI / 180), sK = Math.sin(ANGLE_K * Math.PI / 180);
  var cS = Math.cos(ANGLE_SPOT * Math.PI / 180), sS = Math.sin(ANGLE_SPOT * Math.PI / 180);

  function resize() {
    // Measure the element, not the window — innerWidth reports 0 in some
    // embedded contexts and that yields an empty grid.
    var r = canvas.getBoundingClientRect();
    W = Math.max(1, Math.round(r.width || window.innerWidth));
    H = Math.max(1, Math.round(r.height || window.innerHeight));

    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width  = Math.floor(W * dpr);
    canvas.height = Math.floor(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // A rotated lattice has to cover the diagonal, so budget against that.
    var diag = Math.sqrt(W * W + H * H);
    gap = SPACING;
    while ((diag / gap) * (diag / gap) > MAX_DOTS) gap += 1;

    steps = Math.ceil(diag / gap) + 2;
    half = steps / 2;

    if (!engaged) { px = tx = W * 0.5; py = ty = H * 0.5; }
  }

  // Three plane waves at incommensurate angles and speeds, so the pattern
  // never visibly repeats.
  var K = [
    { kx:  0.0121, ky:  0.0067, w: 0.00082, a: 1.00 },
    { kx: -0.0074, ky:  0.0139, w: 0.00119, a: 0.68 },
    { kx:  0.0043, ky: -0.0051, w: 0.00061, a: 0.44 }
  ];
  var AMP = K[0].a + K[1].a + K[2].a;

  // Returns tone in [0,1] at a point, given the current time and pointer.
  function tone(x, y, time, infl) {
    var h = 0;
    for (var n = 0; n < 3; n++) {
      var k = K[n];
      h += k.a * Math.sin(x * k.kx + y * k.ky - time * k.w);
    }
    h /= AMP;
    return Math.max(0, Math.min(1, (h + 1) * 0.5));
  }

  var visible = true;
  var running = false;

  function frame(t) {
    if (!visible) { running = false; return; }
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
    var m = gap * 2; // cull margin

    ctx.fillStyle = PAPER;
    ctx.fillRect(0, 0, W, H);

    // ── spot plate first, so black overprints it ────────────────────────────
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

        var d = Math.sqrt(d2);
        var nx = d > 0.001 ? dx / d : 0;
        var ny = d > 0.001 ? dy / d : 0;
        var off = infl * MISREG;

        var tn = tone(x, y, time, infl);
        var rad = (0.3 + tn * DOT_MAX) * 0.5 * infl;
        if (rad < 0.2) continue;

        ctx.moveTo(x + nx * off + rad, y + ny * off);
        ctx.arc(x + nx * off, y + ny * off, rad, 0, 6.283185);
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

        var bdx = bx - px, bdy = by - py;
        var bd2 = bdx * bdx + bdy * bdy;
        var binfl = 1 / (1 + bd2 / R2);
        var bd = Math.sqrt(bd2);

        // the pointer's own ripple, added to the standing interference
        var tn2 = tone(bx, by, time, binfl) +
                  Math.sin(bd * 0.042 - time * 0.0043) * binfl * 0.42;
        tn2 = Math.max(0, Math.min(1, tn2));

        var brad = (0.3 + tn2 * DOT_MAX) * 0.5;
        if (brad < 0.16) continue;

        // black pulls the opposite way to the spot plate
        var bnx = bd > 0.001 ? bdx / bd : 0;
        var bny = bd > 0.001 ? bdy / bd : 0;
        var boff = -binfl * MISREG * 0.45;

        ctx.moveTo(bx + bnx * boff + brad, by + bny * boff);
        ctx.arc(bx + bnx * boff, by + bny * boff, brad, 0, 6.283185);
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

  // Once the hero has scrolled off, stop drawing entirely. Two ink plates at
  // 60fps is real work to be doing behind content nobody can see.
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
})();
