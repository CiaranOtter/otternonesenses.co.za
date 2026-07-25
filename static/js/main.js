/* Live host readout. Polls /api/status and paints the bottom bar.
   Values come from the Go runtime on the machine actually serving the page. */

(function () {
  "use strict";

  var bar = document.getElementById("statusbar");
  if (!bar) return;

  var el = {
    host: document.getElementById("st-host"),
    arch: document.getElementById("st-arch"),
    go:   document.getElementById("st-go"),
    mem:  document.getElementById("st-mem"),
    hits: document.getElementById("st-hits"),
    up:   document.getElementById("st-up")
  };

  var timer = null;

  function paint(s) {
    bar.classList.remove("st-stale");
    el.host.textContent = s.host;
    el.arch.textContent = s.os + "/" + s.arch + " · " + s.cpus + " cpu";
    el.go.textContent   = s.go;
    el.mem.textContent  = "heap " + s.heap_kb + "K · " + s.goroutines + " goroutines";
    el.hits.textContent = s.hits + " hits";
    el.up.textContent   = "up " + s.uptime;
  }

  function stale() {
    bar.classList.add("st-stale");
    el.up.textContent = "disconnected";
  }

  function poll() {
    fetch("/api/status", { cache: "no-store" })
      .then(function (r) {
        if (!r.ok) throw new Error(r.status);
        return r.json();
      })
      .then(paint)
      .catch(stale);
  }

  function start() {
    if (timer) return;
    poll();
    timer = setInterval(poll, 5000);
  }

  function halt() {
    clearInterval(timer);
    timer = null;
  }

  // Don't poll a tab nobody is looking at.
  document.addEventListener("visibilitychange", function () {
    document.hidden ? halt() : start();
  });

  start();
})();
