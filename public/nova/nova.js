// Chování nové homepage. Vanilla JS, žádné závislosti — stejný přístup jako
// carousel.js / faq.js na stávajícím webu, jen nad vlastním čistým markupem.
(function () {
  "use strict";

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ═══════════════════════════════════════════ navigace — dropdowny */

  function initDropdowns() {
    var items = document.querySelectorAll(".sg-nav-item.has-menu");
    var closeAll = function (except) {
      items.forEach(function (it) {
        if (it === except) return;
        it.classList.remove("open");
        it.querySelector(".sg-nav-link").setAttribute("aria-expanded", "false");
      });
    };

    items.forEach(function (item) {
      var btn = item.querySelector(".sg-nav-link");
      var open = function (state) {
        item.classList.toggle("open", state);
        btn.setAttribute("aria-expanded", state ? "true" : "false");
        if (state) closeAll(item);
      };
      btn.addEventListener("click", function (e) {
        e.stopPropagation();
        open(!item.classList.contains("open"));
      });
      // Otevírání najetím myší řeší CSS (@media hover). Kdyby ho dělal i JS,
      // mouseenter by menu otevřel a bezprostředně následující klik na
      // stejné tlačítko by ho zase zavřel.
      item.querySelectorAll(".sg-dropdown a").forEach(function (a) {
        a.addEventListener("click", function () { open(false); });
      });
    });

    document.addEventListener("click", function () { closeAll(null); });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") closeAll(null);
    });
  }

  /* ══════════════════════════════════════════ navigace — mobilní panel */

  function initMobilePanel() {
    var burger = document.getElementById("sg-burger");
    var panel = document.getElementById("sg-mobile-panel");
    if (!burger || !panel) return;
    var lastFocus = null;
    var locked = false;

    function lock(on) {
      var de = document.documentElement;
      if (on && !locked) {
        var sb = window.innerWidth - de.clientWidth;
        de.style.overflow = "hidden";
        if (sb > 0) de.style.paddingRight = sb + "px";
        locked = true;
      } else if (!on && locked) {
        de.style.overflow = "";
        de.style.paddingRight = "";
        locked = false;
      }
    }

    function open() {
      lastFocus = document.activeElement;
      panel.hidden = false;
      void panel.offsetHeight;
      panel.setAttribute("data-open", "true");
      burger.setAttribute("aria-expanded", "true");
      burger.setAttribute("aria-label", "Zavřít menu");
      lock(true);
      var first = panel.querySelector("a");
      if (first) first.focus();
    }

    function close() {
      if (panel.hidden) return;
      panel.removeAttribute("data-open");
      burger.setAttribute("aria-expanded", "false");
      burger.setAttribute("aria-label", "Otevřít menu");
      lock(false);
      var done = function () { panel.hidden = true; };
      reduceMotion ? done() : setTimeout(done, 200);
      if (lastFocus && lastFocus.focus) lastFocus.focus();
      lastFocus = null;
    }

    burger.addEventListener("click", function () {
      panel.hidden ? open() : close();
    });
    panel.querySelectorAll("a").forEach(function (a) {
      a.addEventListener("click", close);
    });
    document.addEventListener("keydown", function (e) {
      if (panel.hidden) return;
      if (e.key === "Escape") { e.preventDefault(); close(); return; }
      if (e.key !== "Tab") return;
      var f = panel.querySelectorAll("a");
      if (!f.length) return;
      var first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    });
    window.addEventListener("resize", function () {
      if (window.innerWidth > 1100 && !panel.hidden) close();
    });
  }

  /* ═══════════════════════════════════════════════ Sky Hub — záložky */

  // Dokud nemáme samostatné snímky jednotlivých oblastí, fungují záložky
  // jako statické popisky obsahu Hubu. Až snímky přibudou, stačí doplnit
  // cestu do SHOTS a swap se zapne sám.
  var SHOTS = {
    prehled: null, kamery: null, drony: null,
    udalosti: null, zaznamy: null, mapa: null,
  };

  function initHubTabs() {
    var tabs = document.querySelectorAll("[data-hub-tab]");
    var fig = document.querySelector(".sg-hub-figure");
    var img = document.getElementById("sg-hub-shot");
    if (!tabs.length) return;

    tabs.forEach(function (tab) {
      tab.addEventListener("click", function () {
        tabs.forEach(function (t) {
          t.classList.remove("active");
          t.setAttribute("aria-selected", "false");
        });
        tab.classList.add("active");
        tab.setAttribute("aria-selected", "true");

        var src = SHOTS[tab.getAttribute("data-hub-tab")];
        if (!src || !img || !fig) return;
        fig.classList.add("is-swapping");
        setTimeout(function () {
          img.src = src;
          fig.classList.remove("is-swapping");
        }, reduceMotion ? 0 : 260);
      });
    });
  }

  /* ═════════════════════════════════════════════════════ reference */

  // Texty i role převzaté beze změny ze stávajícího webu (carousel.js).
  // Štítky řešení odvozené z obsahu citací, nic dopsaného.
  var QUOTES = [
    {
      tag: "Sky Construction",
      body: "„Na stavbě se nám v minulosti několikrát ztratily nářadí i materiál. Od té doby spolupracujeme se Sky Guard a rozdíl je obrovský. Kamerový systém a mobilní věže s dohledem nám dávají jistotu i v noci a o víkendech. Instalace byla rychlá, vše jsme zvládli bez zdržení výstavby.",
      role: "Construction Manager",
    },
    {
      tag: "Sky Security",
      body: "„Dlouho jsme hledali komplexní zabezpečovací řešení pro náš výrobní areál a s Sky Guard jsme konečně našli partnera, který nám rozumí. Přístup byl naprosto profesionální — od vstupní analýzy rizik až po instalaci systému a jeho napojení na dohledové centrum.",
      role: "Majitel většího průmyslového areálu",
    },
    {
      tag: "Sky Security",
      body: "„Spravuji několik areálů a bezpečnost je u nás naprostou prioritou. Sky Guard nám pomohl sjednotit dohled napříč lokalitami, což nám výrazně usnadnilo každodenní provoz. Systémy jsou spolehlivé, technická podpora reaguje rychle a přehledný přístup ke všem kamerám a záznamům online je obrovská výhoda.",
      role: "Technik spravující několik průmyslových objektů",
    },
  ];

  function initQuotes() {
    var body = document.getElementById("sg-quote");
    var role = document.getElementById("sg-quote-role");
    var tag = document.getElementById("sg-quote-tag");
    var counter = document.getElementById("sg-quote-counter");
    var prev = document.getElementById("sg-quote-prev");
    var next = document.getElementById("sg-quote-next");
    if (!body || !prev || !next) return;
    var i = 0;

    function show(n) {
      i = ((n % QUOTES.length) + QUOTES.length) % QUOTES.length;
      var q = QUOTES[i];
      body.textContent = q.body;
      role.textContent = q.role;
      tag.textContent = q.tag;
      counter.textContent = i + 1 + "/" + QUOTES.length;
    }
    prev.addEventListener("click", function () { show(i - 1); });
    next.addEventListener("click", function () { show(i + 1); });
    show(0);
  }

  /* ══════════════════════════════════════════════════════════ FAQ */

  var FAQ = [
    {
      q: "Lze využít pouze bezpečnostní kamery?",
      a: "Ano. Kamerové sloupy Sky Guard fungují samostatně — pokryjí kritická místa areálu a záznamy i živý náhled máte v Sky Hubu. Dron si můžete pořídit později, nebo vůbec.",
    },
    {
      q: "Musím mít zároveň dron?",
      a: "Ne. Kamery i dron jsou samostatné technologie a každá dává smysl i bez té druhé. Dron přidává mobilní dohled tam, kde pevné kamery nedosáhnou.",
    },
    {
      q: "Jak funguje kombinace kamer a dronu?",
      a: "Kamery hlídají kritické body nepřetržitě. Když zaznamenají událost, objeví se v Sky Hubu a odpovědná osoba dostane upozornění. Dron pak lze vyslat, aby situaci prověřil z jiné pozice.",
    },
    {
      q: "Co všechno vidím v Sky Hubu?",
      a: "Živý náhled z kamer i dronů, historii záznamů, události, mapu objektu, přehled zařízení a reporty — vše na jednom místě a dostupné odkudkoliv.",
    },
    {
      q: "Lze systém postupně rozšiřovat?",
      a: "Ano, systém je modulární. Můžete začít několika kamerami a postupně přidávat další body, dron nebo rozšířit dohled na další lokality.",
    },
    {
      q: "Potřebuji vlastní infrastrukturu?",
      a: "Samostatně stojící kamerové sloupy umožňují pokrýt kritická místa bez nutnosti budovat kompletní novou bezpečnostní infrastrukturu. Konkrétní požadavky projdeme při návrhu řešení pro váš areál.",
    },
    {
      // TODO: doplnit reálné termíny po potvrzení s klientem.
      q: "Jak rychle lze systém instalovat?",
      a: "Záleží na rozsahu a podmínkách areálu. Konkrétní termín potvrdíme po prohlídce objektu a návrhu rozmístění — instalaci plánujeme tak, aby nenarušila provoz.",
    },
    {
      q: "Jak funguje dron za špatného počasí?",
      a: "Zařízení je voděodolné a funguje v extrémních teplotách – mráz, sníh, déšť nejsou problém.",
    },
    {
      q: "Kdo řeší legislativu provozu dronu?",
      a: "Provozní a legislativní požadavky spojené s provozem dronů řeší Sky Guard za vás.",
    },
    {
      // TODO: doplnit retenci záznamů a technické detaily zabezpečení.
      q: "Jak jsou ukládány a zabezpečeny záznamy?",
      a: "Záznamy jsou dostupné v Sky Hubu, kde k nim mají přístup pouze pověřené osoby z vašeho týmu. Délku uchování a konkrétní nastavení přístupů nastavíme podle vašich požadavků.",
    },
  ];

  function initFaq() {
    var root = document.getElementById("sg-faq");
    if (!root) return;

    FAQ.forEach(function (item, idx) {
      var wrap = document.createElement("div");
      wrap.className = "sg-faq-item";

      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "sg-faq-q";
      btn.id = "faq-q-" + idx;
      btn.setAttribute("aria-expanded", "false");
      btn.setAttribute("aria-controls", "faq-a-" + idx);
      btn.appendChild(document.createTextNode(item.q));
      var sign = document.createElement("span");
      sign.className = "sg-faq-sign";
      sign.setAttribute("aria-hidden", "true");
      btn.appendChild(sign);

      var ans = document.createElement("div");
      ans.className = "sg-faq-a";
      ans.id = "faq-a-" + idx;
      ans.setAttribute("role", "region");
      ans.setAttribute("aria-labelledby", btn.id);
      var inner = document.createElement("div");
      var p = document.createElement("p");
      p.textContent = item.a;
      inner.appendChild(p);
      ans.appendChild(inner);

      btn.addEventListener("click", function () {
        var isOpen = wrap.classList.contains("open");
        root.querySelectorAll(".sg-faq-item.open").forEach(function (o) {
          o.classList.remove("open");
          o.querySelector(".sg-faq-q").setAttribute("aria-expanded", "false");
        });
        if (!isOpen) {
          wrap.classList.add("open");
          btn.setAttribute("aria-expanded", "true");
        }
      });

      wrap.appendChild(btn);
      wrap.appendChild(ans);
      root.appendChild(wrap);
    });
  }

  /* ════════════════════════════════════════════════════ formulář */

  // Backend zatím není — čeká na ověření domény v Resend a nasazení
  // Vercel funkce. Do té doby formulář neodesílá a nabídne přímé kontakty,
  // aby se z něj nestala slepá ulička (a hlavně aby se osobní údaje
  // nedostaly do URL nativním GET odesláním).
  var BACKEND_READY = false;

  function initForm() {
    var form = document.getElementById("sg-form");
    if (!form) return;
    var status = document.getElementById("sg-form-status");

    var fields = [
      { id: "f-name", err: "err-name", test: function (v) { return v.trim().length >= 2; } },
      { id: "f-email", err: "err-email", test: function (v) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim()); } },
      { id: "f-object", err: "err-object", test: function (v) { return v !== ""; } },
    ];

    function validate() {
      var ok = true;
      var firstBad = null;
      fields.forEach(function (f) {
        var el = document.getElementById(f.id);
        var err = document.getElementById(f.err);
        var good = f.test(el.value);
        el.setAttribute("aria-invalid", good ? "false" : "true");
        err.hidden = good;
        if (!good) { ok = false; if (!firstBad) firstBad = el; }
      });
      if (firstBad) firstBad.focus();
      return ok;
    }

    // Živá oprava chyby, jakmile ji uživatel napraví.
    fields.forEach(function (f) {
      var el = document.getElementById(f.id);
      el.addEventListener("input", function () {
        if (el.getAttribute("aria-invalid") !== "true") return;
        if (!f.test(el.value)) return;
        el.setAttribute("aria-invalid", "false");
        document.getElementById(f.err).hidden = true;
      });
    });

    form.addEventListener("submit", function (e) {
      e.preventDefault();

      // Honeypot: vyplněné = robot. Tváříme se, že vše proběhlo.
      if (form.querySelector("#f-company-url").value) {
        status.textContent = "Děkujeme, ozveme se vám.";
        return;
      }

      if (!validate()) return;

      if (!BACKEND_READY) {
        status.textContent = "";
        var t1 = document.createElement("span");
        t1.textContent = "Formulář je momentálně v údržbě. Napište nám prosím na ";
        var mail = document.createElement("a");
        mail.href = "mailto:jan@sky-guard.cz";
        mail.textContent = "jan@sky-guard.cz";
        var t2 = document.createElement("span");
        t2.textContent = " nebo volejte ";
        var tel = document.createElement("a");
        tel.href = "tel:+420737373430";
        tel.textContent = "+420 737 373 430";
        status.appendChild(t1); status.appendChild(mail);
        status.appendChild(t2); status.appendChild(tel);
        status.appendChild(document.createTextNode("."));
        return;
      }
    });
  }

  /* ═════════════════════════════════════ jemný nájezd sekcí */

  function initReveal() {
    if (reduceMotion || !("IntersectionObserver" in window)) return;
    var targets = document.querySelectorAll(".sg-section > .sg-container");
    targets.forEach(function (t) { t.classList.add("sg-reveal"); });
    var io = new IntersectionObserver(function (entries, obs) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        en.target.classList.add("sg-revealed");
        obs.unobserve(en.target);
      });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.05 });
    targets.forEach(function (t) { io.observe(t); });
  }

  /* ══════════════════════════════════════════════════════ start */

  function start() {
    initDropdowns();
    initMobilePanel();
    initHubTabs();
    initQuotes();
    initFaq();
    initForm();
    initReveal();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
})();
