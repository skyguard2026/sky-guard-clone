// Progressive motion for /nova. No scroll hijacking, external libraries or timers.
(function () {
  "use strict";

  var root = document.documentElement;
  var media = window.matchMedia("(prefers-reduced-motion: reduce)");
  var fine = window.matchMedia("(hover: hover) and (pointer: fine)");
  var paused = false;
  try { paused = localStorage.getItem("sg-motion-paused") === "true"; } catch (_) { /* Storage can be disabled. */ }
  var active = new Set();
  var effects = new Map();
  var frame = 0;
  var story;
  var storyButtons;
  var storyCaption;
  var storyCount;
  var storyIndex = -1;
  var storyNeedsSync = true;
  var clamp = function (n) { return Math.min(1, Math.max(0, n)); };
  var enabled = function () { return !paused && !media.matches; };

  function schedule(syncStory) {
    if (syncStory === true) storyNeedsSync = true;
    if (!frame) frame = requestAnimationFrame(render);
  }

  function setStory(index) {
    if (!story || index === storyIndex) return;
    storyIndex = index;
    story.dataset.step = String(index);
    story.style.setProperty("--story-progress", (index + 1) / storyButtons.length);
    storyCaption.textContent = storyButtons[index].querySelector("span > span").textContent;
    storyCount.textContent = "0" + (index + 1) + " / 05";
    storyButtons.forEach(function (button, i) {
      button.classList.toggle("is-active", i === index);
      if (i === index) button.setAttribute("aria-current", "step");
      else button.removeAttribute("aria-current");
    });
  }

  function render() {
    frame = 0;
    var vh = window.innerHeight;
    var y = window.scrollY;
    var header = document.getElementById("sg-header");
    var progress = document.querySelector(".sg-scroll-progress");
    var height = root.scrollHeight - vh;
    // Read all scene geometry before writing styles.
    var measurements = [];
    active.forEach(function (element) {
      if (effects.has(element)) measurements.push({ el: element, rect: element.getBoundingClientRect() });
    });
    var step = -1;
    if (storyNeedsSync && story && active.has(document.getElementById("sg-story"))) {
      var anchor = window.innerWidth <= 760 ? vh * .8 : vh * .53;
      var nearest = Infinity;
      storyButtons.forEach(function (button, index) {
        var rect = button.getBoundingClientRect();
        var distance = Math.abs(rect.top + rect.height / 2 - anchor);
        if (distance < nearest) { nearest = distance; step = index; }
      });
    }
    storyNeedsSync = false;
    if (header) header.classList.toggle("is-scrolled", y > 24);
    if (progress) progress.style.transform = "scaleX(" + (height > 0 ? clamp(y / height) : 0) + ")";
    if (enabled()) {
      measurements.forEach(function (item) { effects.get(item.el)(item.rect, vh); });
    }
    if (step >= 0) setStory(step);
  }

  function initMotionSetting() {
    var toggle = document.getElementById("sg-motion-toggle");
    function sync() {
      var off = !enabled();
      root.dataset.motion = off ? "off" : "on";
      if (toggle) {
        toggle.hidden = false;
        toggle.disabled = media.matches;
        toggle.setAttribute("aria-pressed", String(off));
        toggle.querySelector("[data-motion-label]").textContent = media.matches ? "Omezený pohyb" : off ? "Zapnout animace" : "Pozastavit animace";
        toggle.title = media.matches ? "Animace jsou omezené podle nastavení vašeho zařízení." : "";
      }
      schedule();
    }
    if (toggle) toggle.addEventListener("click", function () {
      paused = !paused;
      try { localStorage.setItem("sg-motion-paused", String(paused)); } catch (_) { /* Optional persistence. */ }
      sync();
    });
    media.addEventListener("change", sync);
    sync();
  }

  function initScenes() {
    var claim = document.querySelector(".sg-claim");
    if (claim) effects.set(claim, function (rect, vh) {
      var p = clamp((vh * .86 - rect.top) / (vh * .48));
      claim.querySelectorAll(".sg-claim-text > span").forEach(function (line, i) {
        line.classList.toggle("is-lit", p >= i / 3);
      });
    });
    var hub = document.querySelector(".sg-hub-figure");
    if (hub) effects.set(hub, function (rect, vh) {
      var p = clamp((vh - rect.top) / (vh * .82));
      hub.style.setProperty("--screen-tilt", ((1 - p) * 15).toFixed(2) + "deg");
      hub.style.setProperty("--screen-scale", (.91 + p * .09).toFixed(3));
    });
    var camera = document.querySelector(".sg-showcase");
    if (camera) effects.set(camera, function (rect, vh) {
      var p = clamp((vh - rect.top) / (vh + rect.height));
      camera.style.setProperty("--scan-y", (p * rect.height * .85).toFixed(1) + "px");
      camera.style.setProperty("--camera-y", (18 - p * 36).toFixed(1) + "px");
    });
    var drone = document.querySelector(".sg-cine-art");
    if (drone) effects.set(drone, function (rect, vh) {
      var p = clamp((vh - rect.top) / (vh + rect.height));
      drone.style.setProperty("--flight-y", (20 - p * 72).toFixed(1) + "px");
      drone.style.setProperty("--flight-roll", (2 - p * 5).toFixed(2) + "deg");
    });

    story = document.querySelector(".sg-story-stage");
    storyButtons = document.querySelectorAll("[data-story-step]");
    storyCaption = document.getElementById("sg-story-caption");
    storyCount = document.querySelector(".sg-story-count");
    storyButtons.forEach(function (button, index) {
      button.addEventListener("click", function () {
        storyNeedsSync = false;
        setStory(index);
      });
    });
    setStory(0);

    var scenes = document.querySelectorAll("#hero,.sg-claim,.sg-hub-figure,.sg-showcase,.sg-cine-art,#sg-story,.sg-tile-fusion,.sg-band");
    if ("IntersectionObserver" in window) {
      var observer = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          entry.target.classList.toggle("sg-motion-away", !entry.isIntersecting);
          if (entry.isIntersecting) active.add(entry.target);
          else active.delete(entry.target);
        });
        schedule(true);
      }, { rootMargin: "80px 0px" });
      scenes.forEach(function (scene) { observer.observe(scene); });
    } else scenes.forEach(function (scene) { active.add(scene); });
  }

  function initEntrances() {
    if (!("IntersectionObserver" in window)) return;
    var targets = document.querySelectorAll(".sg-head,.sg-tile,.sg-hub-cell,.sg-split-copy,.sg-solution,.sg-why > li,.sg-quote-grid,.sg-form,.sg-faq-item");
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("sg-visible");
        observer.unobserve(entry.target);
      });
    }, { threshold: .04, rootMargin: "0px 0px -24px 0px" });
    targets.forEach(function (el) {
      // Delay siblings only; nested elements and whole-page indexes drift apart.
      var siblings = Array.prototype.slice.call(el.parentElement.children);
      var i = siblings.indexOf(el);
      el.style.setProperty("--entry-delay", (Math.min(i, 3) * 65) + "ms");
      el.classList.add("sg-enter");
      observer.observe(el);
    });
    document.addEventListener("focusin", function (event) {
      var target = event.target.closest(".sg-enter");
      if (target) target.classList.add("sg-visible");
    });
  }

  function initPointer() {
    var pending = 0;
    var card;
    var point;
    document.addEventListener("pointermove", function (event) {
      if (!enabled() || !fine.matches) return;
      card = event.target.closest && event.target.closest(".sg-glass");
      if (!card) return;
      point = { x: event.clientX, y: event.clientY };
      if (pending) return;
      pending = requestAnimationFrame(function () {
        pending = 0;
        if (!card || !enabled()) return;
        var rect = card.getBoundingClientRect();
        card.style.setProperty("--mx", ((point.x - rect.left) / rect.width * 100).toFixed(1) + "%");
        card.style.setProperty("--my", ((point.y - rect.top) / rect.height * 100).toFixed(1) + "%");
      });
    }, { passive: true });
  }

  function initQuotes() {
    var cell = document.querySelector(".sg-quote-cell");
    if (!cell) return;
    document.querySelectorAll(".sg-quote-btn").forEach(function (button) {
      button.addEventListener("click", function () {
        if (!enabled()) return;
        cell.classList.remove("sg-quote-changing");
        void cell.offsetWidth;
        cell.classList.add("sg-quote-changing");
      });
    });
  }

  function start() {
    var header = document.getElementById("sg-header");
    if (header) {
      var progress = document.createElement("span");
      progress.className = "sg-scroll-progress";
      progress.setAttribute("aria-hidden", "true");
      header.appendChild(progress);
    }
    initMotionSetting();
    initScenes();
    initEntrances();
    initPointer();
    initQuotes();
    window.addEventListener("scroll", function () { schedule(true); }, { passive: true });
    window.addEventListener("resize", function () { schedule(true); }, { passive: true });
    document.addEventListener("visibilitychange", function () {
      root.dataset.motionHidden = String(document.hidden);
      if (!document.hidden) schedule(true);
    });
    root.dataset.motionHidden = String(document.hidden);
    schedule(true);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
