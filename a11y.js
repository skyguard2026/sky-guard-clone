// Přístupnostní záplaty nad Framer exportem.
//
// Framer vygeneroval statické HTML bez landmarků, s dekorativními SVG
// viditelnými pro odečítače, s cursor:pointer na neklikatelných kartách
// a s formulářem, jehož popisky nejsou spárované s poli. Opravujeme to
// za běhu, ať do 600 kB HTML nemusíme zasahovat ručně na stovkách míst.
(function () {
  "use strict";

  var STYLE_ID = "sg-a11y-style";

  /* ---------------------------------------------------------------- styly */

  function injectStyle() {
    if (document.getElementById(STYLE_ID)) return;
    var s = document.createElement("style");
    s.id = STYLE_ID;
    s.textContent = [
      /* Neinteraktivní prvky nesmí předstírat klikatelnost. */
      // !important je tu nutné — Framer sype cursor:pointer inline i přes
      // vysoce specifické selektory, běžná deklarace by prohrála.
      "[data-sg-nopointer],[data-sg-nopointer] *{cursor:default !important}",

      /* Viditelný focus. Framer dává inputům outline:none, takže by uživatel
         na klávesnici nevěděl, kde je. :focus-visible se myší neukáže. */
      ".framer-form-input:focus-visible,#sg-nav-panel a:focus-visible," +
        "[data-sg-nav-btn]:focus-visible,[data-framer-name='Close']:focus-visible," +
        "a:focus-visible,button:focus-visible,select:focus-visible,textarea:focus-visible{" +
        "outline:2px solid #4da3ff;outline-offset:2px;border-radius:4px}",
      ".framer-form-input:focus{outline:2px solid #4da3ff;outline-offset:2px}",

      /* Dotykové plochy na 44x44 bez zvětšení vizuálu — pseudo-element,
         stejný princip jako u šipek karuselu a hamburgeru. */
      "[data-sg-tap]{position:relative}",
      "[data-sg-tap]::after{content:'';position:absolute;top:50%;left:50%;" +
        "transform:translate(-50%,-50%);width:100%;height:100%;" +
        "min-width:44px;min-height:44px}",
      /* Odkazy ve footeru stojí těsně pod sebou; roztažení jen na výšku
         by je překrylo, proto u nich zvětšujeme jen svislou osu. */
      "[data-sg-tap-v]{position:relative}",
      "[data-sg-tap-v]::after{content:'';position:absolute;top:50%;left:0;" +
        "transform:translateY(-50%);width:100%;height:44px}",
    ].join("");
    document.head.appendChild(s);
  }

  /* ----------------------------------------------------------- landmarky */

  function landmarks() {
    // <div id="main"> nelze přejmenovat na <main> — CSS má pravidla
    // div#main a[href^="#"] apod. role="main" dá odečítači totéž.
    var main = document.getElementById("main");
    if (main && !main.hasAttribute("role")) main.setAttribute("role", "main");

    // Hlavička sama je <nav>, takže banner patří na její kontejner.
    var navs = document.querySelectorAll("nav");
    for (var i = 0; i < navs.length; i++) {
      var parent = navs[i].parentElement;
      if (!parent) continue;
      var r = navs[i].getBoundingClientRect();
      // jen viditelná horní lišta — Framer drží variantu pro každý breakpoint
      // a skryté by jinak dostaly banner taky
      if (r.width < 1 || r.height < 1 || r.top > 120) continue;
      if (!parent.hasAttribute("role")) parent.setAttribute("role", "banner");
      if (!navs[i].hasAttribute("aria-label")) {
        navs[i].setAttribute("aria-label", "Hlavní navigace");
      }
    }
  }

  /* ---------------------------------------------------------------- SVG */

  function decorativeSvgs() {
    var svgs = document.querySelectorAll("svg");
    var n = 0;
    for (var i = 0; i < svgs.length; i++) {
      var svg = svgs[i];
      if (svg.hasAttribute("aria-hidden")) continue;
      if (svg.querySelector("title")) continue; // popsané ikony necháme
      // Ikona, která je jediným obsahem odkazu/tlačítka, nese význam —
      // té dáme raději aria-label z okolí, než abychom ji schovali.
      var host = svg.closest("a[href],button,[role=button]");
      if (host && !(host.innerText || "").trim()) {
        if (!host.hasAttribute("aria-label")) {
          var t = host.getAttribute("title") || host.getAttribute("href") || "";
          if (t) host.setAttribute("aria-label", t.replace(/^https?:\/\//, ""));
        }
      }
      svg.setAttribute("aria-hidden", "true");
      svg.setAttribute("focusable", "false");
      n++;
    }
    return n;
  }

  /* --------------------------------------- falešně klikatelné a tabbable */

  function isInteractive(el) {
    if (el.closest("a[href],button,form,label,[role=button],[data-sg-nav-btn]")) return true;
    if (el.closest('[data-framer-name="Close"],[data-framer-name="Open"]')) return true; // FAQ
    if (el.closest("#sg-nav-panel,#sg-lang-switcher")) return true;
    if (el.closest('[data-framer-name="IconLeft"],[data-framer-name="IconRight"]')) return true; // karusel
    return false;
  }

  function deadPointers() {
    var all = document.querySelectorAll("*");
    var n = 0;
    for (var i = 0; i < all.length; i++) {
      var el = all[i];
      if (el.hasAttribute("data-sg-nopointer")) continue;
      if (getComputedStyle(el).cursor !== "pointer") continue;
      if (isInteractive(el)) continue;
      el.setAttribute("data-sg-nopointer", "");
      n++;
    }
    return n;
  }

  function strayTabstops() {
    var list = document.querySelectorAll('[tabindex="0"]');
    var n = 0;
    for (var i = 0; i < list.length; i++) {
      var el = list[i];
      if (el.hasAttribute("role")) continue; // má sémantiku, nechme být
      if (isInteractive(el)) continue;
      el.removeAttribute("tabindex");
      n++;
    }
    return n;
  }

  /* ----------------------------------------------------------- formulář */

  function formLabels() {
    var forms = document.querySelectorAll("form");
    var seq = 0;
    var n = 0;
    for (var f = 0; f < forms.length; f++) {
      var labels = forms[f].querySelectorAll("label");
      for (var i = 0; i < labels.length; i++) {
        var label = labels[i];
        var field = label.querySelector("input,select,textarea");
        if (!field) continue;
        if (!field.id) field.id = "sg-field-" + ++seq;
        if (!label.getAttribute("for")) {
          label.setAttribute("for", field.id);
          n++;
        }
        // Popisek obaluje i <select>, takže by odečítač přečetl i všechny
        // jeho volby. Vezmeme jen text před polem.
        if (!field.getAttribute("aria-label")) {
          var own = "";
          for (var k = 0; k < label.childNodes.length; k++) {
            var node = label.childNodes[k];
            if (node.nodeType === 3) own += node.nodeValue;
            else if (node.nodeType === 1 && !node.contains(field) && node !== field) {
              own += node.textContent;
            }
          }
          own = own.trim();
          if (own) field.setAttribute("aria-label", own);
        }
      }
    }
    return n;
  }

  /* -------------------------------------------------------- tap targety */

  function tapTargets() {
    var sel = "a[href],button,[role=button],input,select";
    var list = document.querySelectorAll(sel);
    var n = 0;
    for (var i = 0; i < list.length; i++) {
      var el = list[i];
      if (el.hasAttribute("data-sg-tap") || el.hasAttribute("data-sg-tap-v")) continue;
      if (el.closest("#sg-nav-panel")) continue; // panel má vlastní min-height
      var r = el.getBoundingClientRect();
      if (r.width < 1 || r.height < 1) continue;
      if (r.width >= 44 && r.height >= 44) continue;
      // Odkazy v seznamech (footer) mají těsné svislé rozestupy — u nich
      // roztahujeme jen výšku, aby se sousedi nepřekrývali.
      var narrowStack = r.height < 44 && r.width >= 44;
      el.setAttribute(narrowStack ? "data-sg-tap-v" : "data-sg-tap", "");
      n++;
    }
    return n;
  }

  /* --------------------------------------------------------------- start */

  function run() {
    landmarks();
    var stats = {
      svg: decorativeSvgs(),
      pointer: deadPointers(),
      tabstop: strayTabstops(),
      label: formLabels(),
      tap: tapTargets(),
    };
    if (window.__SG_A11Y_DEBUG) console.log("[a11y]", stats);
    return stats;
  }

  function start() {
    injectStyle();
    run();
    // faq.js a nav.js dobíhají po nás a doplňují další prvky; po chvíli
    // proto projedeme DOM ještě jednou.
    setTimeout(run, 1200);
    window.addEventListener("resize", function () {
      tapTargets();
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
})();
