// FALQBIT background: an animated lattice of dots with a slow wave of light.
// Respects "reduce motion" and pauses when the tab is hidden.
(function () {
  var cv = document.createElement("canvas");
  cv.id = "fx-lattice"; cv.setAttribute("aria-hidden", "true");
  cv.style.cssText = "position:fixed;inset:0;width:100%;height:100%;z-index:-2;pointer-events:none";
  document.body.prepend(cv);
  var ctx = cv.getContext("2d"), W = 0, H = 0, dpr = 1, t = 0, run = true;
  var still = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  var GAP = 28;
  function size() {
    dpr = Math.min(2, window.devicePixelRatio || 1);
    W = cv.width = Math.round(innerWidth * dpr); H = cv.height = Math.round(innerHeight * dpr);
  }
  function draw() {
    ctx.clearRect(0, 0, W, H);
    var g = GAP * dpr;
    for (var y = g / 2; y < H; y += g) {
      for (var x = g / 2; x < W; x += g) {
        var w = Math.sin(x * 0.0045 + t) * Math.cos(y * 0.0035 - t * 0.7);
        var p = w > 0 ? w : 0, a = 0.06 + p * 0.28;
        ctx.fillStyle = w > 0.6 ? "rgba(63,224,208," + a + ")" : "rgba(110,130,180," + (a * 0.75) + ")";
        ctx.beginPath(); ctx.arc(x, y, (0.85 + p * 1.15) * dpr, 0, 6.2832); ctx.fill();
      }
    }
    t += 0.005;
    if (!still && run) requestAnimationFrame(draw);
  }
  size(); draw();
  addEventListener("resize", function () { size(); if (still) draw(); });
  document.addEventListener("visibilitychange", function () {
    var was = run; run = !document.hidden; if (run && !was && !still) requestAnimationFrame(draw);
  });
})();
