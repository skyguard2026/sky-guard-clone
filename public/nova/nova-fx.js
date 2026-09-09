// Drobné vizuální efekty pro /nova: světelný bod sledující kurzor na
// skleněných panelech, jemná paralaxa produktů v heru a stav hlavičky po
// odscrollování. Všechno respektuje prefers-reduced-motion a na dotyku
// se paralaxa nespouští.
(function () {
  "use strict";

  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var fine = window.matchMedia("(hover: hover) and (pointer: fine)").matches;

  /* Spotlight: karta dostane --mx/--my v procentech, CSS z toho kreslí
     radiální přechod. Posluchač je jeden na dokumentu, ne na každé kartě. */
  function initSpotlight() {
    if (!fine || reduce) return;
    document.addEventListener("pointermove", function (e) {
      var card = e.target.closest && e.target.closest(".sg-glass");
      if (!card) return;
      var r = card.getBoundingClientRect();
      card.style.setProperty("--mx", ((e.clientX - r.left) / r.width * 100).toFixed(1) + "%");
      card.style.setProperty("--my", ((e.clientY - r.top) / r.height * 100).toFixed(1) + "%");
    }, { passive: true });
  }

  /* Paralaxa: prvky s data-parallax="0.08" se posouvají o zlomek scrollu.
     Počítáme jen v requestAnimationFrame a jen dokud je hero na obrazovce. */
  function initParallax() {
    if (reduce || !fine) return;
    var items = [].slice.call(document.querySelectorAll("[data-parallax]"));
    if (!items.length) return;
    var stage = document.querySelector(".sg-stage");
    var ticking = false;
    function update() {
      ticking = false;
      var y = window.scrollY;
      if (stage && stage.getBoundingClientRect().bottom < -200) return;
      items.forEach(function (el) {
        var f = parseFloat(el.getAttribute("data-parallax")) || 0;
        el.style.transform = "translate3d(0," + (-y * f).toFixed(1) + "px,0)";
      });
    }
    window.addEventListener("scroll", function () {
      if (!ticking) { ticking = true; requestAnimationFrame(update); }
    }, { passive: true });
    update();
  }

  /* Hlavička: po odscrollování dostane třídu, CSS ji ztmaví a zmenší. */
  function initHeader() {
    var h = document.getElementById("sg-header");
    var grid = document.querySelector(".sg-bg-grid");
    if (!h) return;
    var progress = document.createElement("span");
    progress.className = "sg-scroll-progress";
    progress.setAttribute("aria-hidden", "true");
    h.appendChild(progress);
    var ticking = false;
    function sync() {
      ticking = false;
      var y = window.scrollY;
      h.classList.toggle("is-scrolled", y > 24);
      if (grid) grid.style.opacity = Math.max(0, 1 - y / 700).toFixed(2);
      var height = document.documentElement.scrollHeight - window.innerHeight;
      progress.style.transform = "scaleX(" + (height > 0 ? Math.min(1, Math.max(0, y / height)) : 0) + ")";
    }
    function schedule() { if (!ticking) { ticking = true; requestAnimationFrame(sync); } }
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule, { passive: true });
    sync();
  }

  function initStagger() {
    if (reduce || !("IntersectionObserver" in window)) return;
    var items = document.querySelectorAll(".sg-glass, .sg-hub-details > li, .sg-steps > li");
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("sg-in-view");
        io.unobserve(entry.target);
      });
    }, { threshold: .08 });
    items.forEach(function (item, i) {
      item.classList.add("sg-stagger");
      item.style.setProperty("--reveal-delay", (i % 3 * 65) + "ms");
      io.observe(item);
    });
  }

  function start() { initSpotlight(); initParallax(); initHeader(); initStagger(); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
