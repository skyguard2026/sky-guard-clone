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
    if (!fine) return;
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
    if (!h) return;
    function sync() { h.classList.toggle("is-scrolled", window.scrollY > 24); }
    window.addEventListener("scroll", sync, { passive: true });
    sync();
  }

  function start() { initSpotlight(); initParallax(); initHeader(); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
