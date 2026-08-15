/* Enter button: smooth-scrolls past the hero so the scroll-driven scatter
   in landing.js plays out automatically rather than requiring manual scroll. */

(function () {
  "use strict";

  var btn = document.getElementById("enter-btn");
  if (!btn) return;

  btn.addEventListener("click", function (e) {
    e.preventDefault();
    var about = document.getElementById("about");
    if (about) about.scrollIntoView({ behavior: "smooth" });
  });
}());
