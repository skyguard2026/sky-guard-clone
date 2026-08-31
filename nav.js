// Mobilní / tabletová navigace.
//
// Pod 1440 px nebyla na webu žádná navigace — jen logo, jazykový přepínač
// a Hub. Framer přitom hamburger vykresluje (div[data-framer-name="CTAs"]
// se třemi proužky "Line 1..3"), ale mrtvý React runtime na něj nikdy
// nenavázal handler. Bereme tedy původní tlačítko a doplňujeme chování,
// aby vzhled zůstal ten, který na webu je.
//
// Panel přebírá odkazy živě z DOMu, takže po přepnutí do EN se popisky
// překládají samy přes i18n.js.
(function () {
  "use strict";

  var PANEL_ID = "sg-nav-panel";
  var STYLE_ID = "sg-nav-style";
  var BP = 1440; // nad tímto breakpointem má Framer vlastní vodorovnou navigaci

  var LABELS = {
    cs: { open: "Otevřít menu", close: "Zavřít menu", nav: "Hlavní navigace" },
    en: { open: "Open menu", close: "Close menu", nav: "Main navigation" },
  };

  function lang() {
    try {
      return localStorage.getItem("sg-lang") === "en" ? "en" : "cs";
    } catch (e) {
      return "cs";
    }
  }

  /* ---------------------------------------------------------------- styly */

  function injectStyle() {
    if (document.getElementById(STYLE_ID)) return;
    var s = document.createElement("style");
    s.id = STYLE_ID;
    s.textContent = [
      /* Zvětšení dotykové plochy hamburgeru na 44x44 bez změny vzhledu —
         stejný princip jako u šipek karuselu. */
      "[data-sg-nav-btn]{position:relative}",
      "[data-sg-nav-btn]::after{content:'';position:absolute;top:50%;left:50%;",
      "transform:translate(-50%,-50%);width:44px;height:44px}",

      /* Proužky hamburgeru -> křížek */
      "[data-sg-nav-btn] [data-framer-name^='Line']{transition:transform .25s ease,opacity .2s ease}",
      "[data-sg-nav-btn][aria-expanded='true'] [data-framer-name='Line 1']{transform:translateY(8px) rotate(45deg)}",
      "[data-sg-nav-btn][aria-expanded='true'] [data-framer-name='Line 2']{opacity:0}",
      "[data-sg-nav-btn][aria-expanded='true'] [data-framer-name='Line 3']{transform:translateY(-9px) rotate(-45deg)}",

      /* Panel — barvy převzaté z hlavičky webu (rgba(8,7,14,.8) + blur) */
      "#" + PANEL_ID + "{position:fixed;inset:80px 0 0 0;z-index:2147483000;",
      "background:rgba(8,7,14,0.97);-webkit-backdrop-filter:blur(16px);backdrop-filter:blur(16px);",
      "display:flex;flex-direction:column;padding:8px 0 32px;overflow-y:auto;",
      "opacity:0;transform:translateY(-8px);transition:opacity .2s ease,transform .2s ease}",
      "#" + PANEL_ID + "[data-open='true']{opacity:1;transform:none}",
      "#" + PANEL_ID + "[hidden]{display:none}",
      "#" + PANEL_ID + " a{display:flex;align-items:center;min-height:56px;padding:0 24px;",
      "color:#f5f5f5;text-decoration:none;font:400 20px/1.3 'DM Sans','Inter',system-ui,sans-serif;",
      "border-bottom:1px solid rgba(255,255,255,0.08)}",
      "#" + PANEL_ID + " a:hover,#" + PANEL_ID + " a:focus-visible{background:rgba(255,255,255,0.06);color:#fff}",
      "@media (prefers-reduced-motion: reduce){#" + PANEL_ID + ",[data-sg-nav-btn] [data-framer-name^='Line']{transition:none}}",
    ].join("");
    document.head.appendChild(s);
  }

  /* ------------------------------------------------------------- pomocné */

  // Framer renderuje hlavičku ve variantách pro každý breakpoint; viditelná
  // je vždy jen jedna, takže ji hledáme podle nenulového rozměru.
  function visibleBtn() {
    var list = document.querySelectorAll('[data-framer-name="CTAs"] [data-highlight][tabindex]');
    for (var i = 0; i < list.length; i++) {
      var r = list[i].getBoundingClientRect();
      if (r.width > 0 && r.height > 0) return list[i];
    }
    return null;
  }

  function navLinks() {
    var seen = {};
    var out = [];
    var all = document.querySelectorAll('a[href^="#"]');
    for (var i = 0; i < all.length; i++) {
      var a = all[i];
      var href = a.getAttribute("href");
      // innerText, ne textContent — Framer renderuje varianty pro každý
      // breakpoint a textContent by slepil i ty skryté ("Sky Guard Hub Hub").
      var text = (a.innerText || a.textContent || "").trim();
      if (!text || text.length > 28 || href === "#") continue;
      if (!document.querySelector(href)) continue;
      if (seen[href]) continue;
      seen[href] = 1;
      out.push({ href: href, text: text });
    }
    return out;
  }

  /* --------------------------------------------------------------- panel */

  var panel = null;
  var scrollLocked = false;

  function buildPanel() {
    var p = document.createElement("div");
    p.id = PANEL_ID;
    p.setAttribute("role", "dialog");
    p.setAttribute("aria-modal", "true");
    p.setAttribute("aria-label", LABELS[lang()].nav);
    p.hidden = true;
    var nav = document.createElement("nav");
    p.appendChild(nav);
    document.body.appendChild(p);
    return p;
  }

  // Plovoucí Hub tlačítko je position:fixed a překrývalo by otevřený panel.
  // Schováme ho a odkaz nabídneme přímo v panelu, ať je navigace na jednom místě.
  function floatingHub() {
    var list = document.querySelectorAll('a[href="/hub/login"]');
    for (var i = 0; i < list.length; i++) {
      if (list[i].getBoundingClientRect().width > 0 && getComputedStyle(list[i]).position === "fixed") {
        return list[i];
      }
    }
    return null;
  }

  function fillPanel() {
    var nav = panel.querySelector("nav");
    nav.textContent = "";
    var items = navLinks();
    var hub = floatingHub();
    if (hub) items.push({ href: "/hub/login", text: (hub.innerText || "Sky Guard Hub").trim() });
    items.forEach(function (l) {
      if (l.href.charAt(0) !== "#") {
        var plain = document.createElement("a");
        plain.href = l.href;
        plain.textContent = l.text;
        plain.addEventListener("click", function () {
          close();
        });
        nav.appendChild(plain);
        return;
      }
      var a = document.createElement("a");
      a.href = l.href;
      a.textContent = l.text;
      a.addEventListener("click", function (e) {
        e.preventDefault();
        close();
        var target = document.querySelector(l.href);
        if (!target) return;
        // Vlastní scroll místo nativního skoku na hash — nespoléháme na
        // hashchange a zachováme scroll-margin-top, který web má nastavený.
        target.scrollIntoView({ behavior: "smooth", block: "start" });
        try {
          history.pushState(null, "", l.href);
        } catch (err) {}
      });
      nav.appendChild(a);
    });
  }

  function lockScroll(on) {
    var de = document.documentElement;
    if (on && !scrollLocked) {
      var sb = window.innerWidth - de.clientWidth;
      de.style.overflow = "hidden";
      if (sb > 0) de.style.paddingRight = sb + "px";
      scrollLocked = true;
    } else if (!on && scrollLocked) {
      de.style.overflow = "";
      de.style.paddingRight = "";
      scrollLocked = false;
    }
  }

  function focusables() {
    return panel ? panel.querySelectorAll("a[href],button,[tabindex]:not([tabindex='-1'])") : [];
  }

  var lastFocus = null;

  function open() {
    var btn = visibleBtn();
    if (!btn || !panel) return;
    lastFocus = document.activeElement;
    fillPanel();
    panel.hidden = false;
    // vynutí reflow, aby se chytil přechod opacity
    void panel.offsetHeight;
    panel.setAttribute("data-open", "true");
    btn.setAttribute("aria-expanded", "true");
    btn.setAttribute("aria-label", LABELS[lang()].close);
    lockScroll(true);
    var hub = floatingHub();
    if (hub) hub.style.visibility = "hidden";
    var f = focusables();
    if (f.length) f[0].focus();
  }

  function close() {
    if (!panel || panel.hidden) return;
    panel.removeAttribute("data-open");
    var btn = visibleBtn();
    if (btn) {
      btn.setAttribute("aria-expanded", "false");
      btn.setAttribute("aria-label", LABELS[lang()].open);
    }
    lockScroll(false);
    var hub = floatingHub();
    if (hub) hub.style.visibility = "";
    var done = function () {
      panel.hidden = true;
    };
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) done();
    else setTimeout(done, 200);
    if (lastFocus && lastFocus.focus) lastFocus.focus();
    lastFocus = null;
  }

  function isOpen() {
    return panel && !panel.hidden;
  }

  /* ---------------------------------------------------------------- vazba */

  // Jazykový přepínač je fixed vpravo nahoře a překrýval by hamburger.
  // Odsuneme ho doleva přesně o šířku tlačítka, dokud je hamburger vidět.
  function nudgeSwitcher() {
    var sw = document.getElementById("sg-lang-switcher");
    if (!sw) return;
    var btn = visibleBtn();
    if (!btn) {
      sw.style.right = "";
      return;
    }
    var r = btn.getBoundingClientRect();
    sw.style.right = Math.round(window.innerWidth - r.left + 12) + "px";
  }

  function bind() {
    var btn = visibleBtn();
    if (!btn) return;
    if (!btn.hasAttribute("data-sg-nav-btn")) {
      btn.setAttribute("data-sg-nav-btn", "");
      btn.setAttribute("role", "button");
      btn.setAttribute("aria-controls", PANEL_ID);
      btn.setAttribute("aria-expanded", "false");
      btn.setAttribute("aria-label", LABELS[lang()].open);
      btn.addEventListener("click", function (e) {
        e.preventDefault();
        isOpen() ? close() : open();
      });
      btn.addEventListener("keydown", function (e) {
        if (e.key === "Enter" || e.key === " " || e.key === "Spacebar") {
          e.preventDefault();
          isOpen() ? close() : open();
        }
      });
    }
  }

  function start() {
    injectStyle();
    panel = buildPanel();
    bind();
    nudgeSwitcher();

    document.addEventListener("keydown", function (e) {
      if (!isOpen()) return;
      if (e.key === "Escape") {
        e.preventDefault();
        close();
        return;
      }
      if (e.key !== "Tab") return;
      var f = focusables();
      if (!f.length) return;
      var first = f[0];
      var last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    });

    // klik mimo odkazy (do prázdna panelu) zavírá
    document.addEventListener("click", function (e) {
      if (!isOpen()) return;
      if (e.target === panel) close();
    });

    var onResize = function () {
      bind();
      nudgeSwitcher();
      if (window.innerWidth >= BP && isOpen()) close();
    };
    window.addEventListener("resize", onResize);
    window.addEventListener("orientationchange", onResize);
    // Framer prohazuje varianty hlavičky podle breakpointu, takže po změně
    // rozměru je potřeba navázat na nově zviditelněné tlačítko.
    setTimeout(onResize, 800);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
})();
