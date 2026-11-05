// FALQBIT motion layer 2: quantum "decrypt" text, 3D tilt, magnetic buttons,
// cursor glow, hero constellation and section wipes. Respects reduced motion.
(function () {
  var still = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  var fine = window.matchMedia && matchMedia("(hover: hover) and (pointer: fine)").matches;
  if (still) return;
  document.documentElement.classList.add("fx2");

  // 1. decrypt effect: letters scramble through glyphs before settling
  var GL = "01░▒▓<>/\\|{}[]#$%&*+=?ΨΦΩλ";
  function decrypt(el, delay) {
    if (!el || el.dataset.dx) return; el.dataset.dx = 1;
    var final = el.textContent, n = final.length, t0 = null, dur = Math.min(900, 300 + n * 28);
    function step(ts) {
      if (t0 === null) t0 = ts;
      var p = (ts - t0 - (delay || 0)) / dur;
      if (p < 0) { requestAnimationFrame(step); return; }
      var done = Math.floor(Math.min(1, p) * n), out = "";
      for (var i = 0; i < n; i++) out += i < done || final[i] === " " ? final[i] : GL[(Math.random() * GL.length) | 0];
      el.textContent = out;
      if (p < 1) requestAnimationFrame(step); else el.textContent = final;
    }
    requestAnimationFrame(step);
  }
  var io = new IntersectionObserver(function (es) {
    es.forEach(function (e) {
      if (!e.isIntersecting) return; io.unobserve(e.target);
      e.target.querySelectorAll(".eyebrow, .dk, .stat .k").forEach(function (x, i) { decrypt(x, i * 90); });
      if (e.target.matches(".eyebrow, .dk")) decrypt(e.target, 0);
    });
  }, { rootMargin: "0px 0px -10% 0px" });
  document.querySelectorAll("section, .eyebrow").forEach(function (s) { io.observe(s); });

  // 2. section wipe: a scan line sweeps over each section as it appears
  var io2 = new IntersectionObserver(function (es) {
    es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add("scan"); io2.unobserve(e.target); } });
  }, { rootMargin: "0px 0px -15% 0px" });
  document.querySelectorAll(".sec").forEach(function (s) { io2.observe(s); });

  if (!fine) return; // the rest needs a mouse

  // 3. 3D tilt on cards
  document.querySelectorAll(".step, .venue, .stat, .appsec .phone, .wd").forEach(function (el) {
    el.classList.add("tilt");
    el.addEventListener("mousemove", function (e) {
      var r = el.getBoundingClientRect(), x = (e.clientX - r.left) / r.width - .5, y = (e.clientY - r.top) / r.height - .5;
      var k = el.classList.contains("wd") ? 2 : 7;
      el.style.transform = "perspective(900px) rotateX(" + (-y * k) + "deg) rotateY(" + (x * k) + "deg) translateY(-3px)";
    });
    el.addEventListener("mouseleave", function () { el.style.transform = ""; });
  });

  // 4. hero logo follows the mouse in 3D
  var art = document.querySelector(".hero-art"), svg = art && art.querySelector("svg");
  if (art && svg) {
    document.querySelector(".hero").addEventListener("mousemove", function (e) {
      var r = art.getBoundingClientRect(), x = (e.clientX - (r.left + r.width / 2)) / innerWidth, y = (e.clientY - (r.top + r.height / 2)) / innerHeight;
      svg.style.transform = "perspective(800px) rotateY(" + (x * 22) + "deg) rotateX(" + (-y * 22) + "deg)";
    });
  }

  // 5. magnetic primary buttons
  document.querySelectorAll(".btn.primary").forEach(function (b) {
    b.addEventListener("mousemove", function (e) {
      var r = b.getBoundingClientRect();
      b.style.transform = "translate(" + ((e.clientX - r.left - r.width / 2) * .18) + "px," + ((e.clientY - r.top - r.height / 2) * .25) + "px)";
    });
    b.addEventListener("mouseleave", function () { b.style.transform = ""; });
  });

  // 6. soft cursor glow
  var g = document.createElement("div"); g.id = "cglow"; g.setAttribute("aria-hidden", "true"); document.body.appendChild(g);
  var tx = innerWidth / 2, ty = innerHeight / 2, cx = tx, cy = ty;
  addEventListener("mousemove", function (e) { tx = e.clientX; ty = e.clientY; g.style.opacity = 1; }, { passive: true });
  (function loop() { cx += (tx - cx) * .12; cy += (ty - cy) * .12; g.style.transform = "translate(" + (cx - 200) + "px," + (cy - 200) + "px)"; requestAnimationFrame(loop); })();

  // 7. hero constellation: nodes linked by lines that react to the mouse
  var hero = document.querySelector(".hero");
  if (hero) {
    var cv = document.createElement("canvas"); cv.id = "constel"; cv.setAttribute("aria-hidden", "true"); hero.prepend(cv);
    var ctx = cv.getContext("2d"), W, H, dpr, pts = [], mx = -999, my = -999, run = true;
    function size() { dpr = Math.min(2, devicePixelRatio || 1); W = hero.clientWidth; H = hero.clientHeight; cv.width = W * dpr; cv.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); }
    size(); addEventListener("resize", size);
    for (var i = 0; i < 46; i++) pts.push({ x: Math.random() * W, y: Math.random() * H, vx: (Math.random() - .5) * .3, vy: (Math.random() - .5) * .3 });
    hero.addEventListener("mousemove", function (e) { var r = hero.getBoundingClientRect(); mx = e.clientX - r.left; my = e.clientY - r.top; });
    hero.addEventListener("mouseleave", function () { mx = my = -999; });
    new IntersectionObserver(function (es) { run = es[0].isIntersecting; if (run) requestAnimationFrame(draw); }).observe(hero);
    function draw() {
      ctx.clearRect(0, 0, W, H);
      for (var i = 0; i < pts.length; i++) {
        var p = pts[i]; p.x += p.vx; p.y += p.vy;
        if (p.x < 0 || p.x > W) p.vx *= -1; if (p.y < 0 || p.y > H) p.vy *= -1;
        var dm = Math.hypot(p.x - mx, p.y - my);
        if (dm < 140) { p.x += (p.x - mx) / dm * .6; p.y += (p.y - my) / dm * .6; }
        for (var j = i + 1; j < pts.length; j++) {
          var q = pts[j], d = Math.hypot(p.x - q.x, p.y - q.y);
          if (d < 120) { ctx.strokeStyle = "rgba(63,224,208," + (0.16 * (1 - d / 120)) + ")"; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y); ctx.stroke(); }
        }
        if (dm < 160) { ctx.strokeStyle = "rgba(156,144,255," + (0.35 * (1 - dm / 160)) + ")"; ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(mx, my); ctx.stroke(); }
        ctx.fillStyle = dm < 160 ? "rgba(169,255,246,.9)" : "rgba(63,224,208,.55)";
        ctx.beginPath(); ctx.arc(p.x, p.y, dm < 160 ? 2.2 : 1.5, 0, 6.283); ctx.fill();
      }
      if (run && !document.hidden) requestAnimationFrame(draw);
    }
    requestAnimationFrame(draw);
    document.addEventListener("visibilitychange", function () { if (!document.hidden && run) requestAnimationFrame(draw); });
  }
})();
