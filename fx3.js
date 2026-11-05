// FALQBIT universal futurist layer: data-stream edges, auto-apply scan classes.
// Respects reduced motion and small screens.
(function () {
  if (window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  if (innerWidth < 900) return;

  // 1. data streams on left and right edges: short columns of random chars drifting down slowly
  var GL = "01░▒▓<>#$%&ΨΦΩλπ∞◇◆";
  function stream(side) {
    var el = document.createElement("div"); el.className = "fx-stream " + side; el.setAttribute("aria-hidden", "true");
    for (var i = 0; i < 48; i++) {
      var s = document.createElement("span"); s.textContent = GL[(Math.random() * GL.length) | 0];
      s.style.setProperty("--o", (0.25 + Math.random() * 0.7).toFixed(2));
      el.appendChild(s);
    }
    document.body.appendChild(el);
    var offset = 0; var speed = side === "l" ? 0.22 : 0.17;
    function tick() {
      offset += speed; if (offset > 14) {
        offset = 0;
        var kids = el.children;
        for (var j = kids.length - 1; j > 0; j--) kids[j].textContent = kids[j - 1].textContent;
        kids[0].textContent = GL[(Math.random() * GL.length) | 0];
      }
      el.style.transform = "translateY(" + offset + "px)";
      if (!document.hidden) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
    document.addEventListener("visibilitychange", function () { if (!document.hidden) requestAnimationFrame(tick); });
  }
  stream("l"); stream("r");

  // 2. auto-apply the scan sweep class to common card containers so pages that didn't opt in still get it
  var targets = ".stat, .dc, .sbox, .step, .venue, .wd, .w-sec, .w-drop, .leg, .card, .faq details, .road li";
  var k = 0;
  document.querySelectorAll(targets).forEach(function (el) {
    if (el.classList.contains("fxscan")) return;
    el.classList.add("fxscan");
    el.style.setProperty("--sd", ((k++ * 0.37) % 7).toFixed(2) + "s");
  });

  // 3. holographic treatment for key numeric values on dashboard-like pages
  document.querySelectorAll(".dc b, .sbox b, .stat .v").forEach(function (el) {
    if (!el.classList.contains("fxholo")) el.classList.add("fxholo");
  });
})();
