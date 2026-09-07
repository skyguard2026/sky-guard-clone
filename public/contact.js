// Dočasná záplata kontaktního formuláře.
//
// Formulář nemá action ani method, takže ho prohlížeč odesílal jako nativní GET
// na tutéž URL. Důsledkem byl plný reload stránky a — hlavně — jméno a e-mail
// návštěvníka v query stringu (…/?Name=…&Email=…). Ten query string pak
// script.js posílá do Framer analytiky jako `search:location.search`, takže
// osobní údaje odtékaly třetí straně.
//
// Než bude hotový backend (Vercel Function + Resend), odeslání blokujeme
// a nabídneme přímé kontakty. V index.html je navíc method="post" jako
// pojistka pro případ, že se tenhle soubor nenačte.
(function () {
  "use strict";

  var BOX_ID = "sg-contact-status";

  // Texty jsou česky; anglickou mutaci řeší i18n.js přes DICT. Proto jsou
  // věty rozdělené na samostatné <span>y — i18n překládá po elementech
  // a přepis celého textContentu kontejneru by zničil odkazy uvnitř.
  var TXT_INTRO = "Formulář je momentálně v údržbě. Napište nám prosím na";
  var TXT_OR = "nebo volejte";

  var EMAIL = "jan@sky-guard.cz";
  var PHONE_LABEL = "+420 737 373 430";
  var PHONE_HREF = "tel:+420737373430";

  var BOX_CSS = [
    "margin-top:14px",
    "padding:12px 14px",
    "border:1px solid rgba(255,134,5,0.45)",
    "border-radius:10px",
    "background:rgba(255,134,5,0.10)",
    "color:#f5f5f5",
    "font:400 14px/1.55 'DM Sans','Inter',system-ui,-apple-system,sans-serif",
  ].join(";");

  var LINK_CSS = ["color:#ffffff", "font-weight:600", "text-decoration:underline"].join(";");

  function link(href, label) {
    var a = document.createElement("a");
    a.href = href;
    a.textContent = label;
    a.style.cssText = LINK_CSS;
    return a;
  }

  function buildBox() {
    var box = document.createElement("div");
    box.id = BOX_ID;
    // role=status + aria-live: odečítač hlášku oznámí, aniž by přerušil uživatele.
    box.setAttribute("role", "status");
    box.setAttribute("aria-live", "polite");
    box.style.cssText = BOX_CSS;

    var intro = document.createElement("span");
    intro.textContent = TXT_INTRO;

    var or = document.createElement("span");
    or.textContent = TXT_OR;

    box.appendChild(intro);
    box.appendChild(document.createTextNode(" "));
    box.appendChild(link("mailto:" + EMAIL, EMAIL));
    box.appendChild(document.createTextNode(" "));
    box.appendChild(or);
    box.appendChild(document.createTextNode(" "));
    box.appendChild(link(PHONE_HREF, PHONE_LABEL));
    box.appendChild(document.createTextNode("."));

    return box;
  }

  function showMessage(form) {
    var box = form.querySelector("#" + BOX_ID);
    if (!box) {
      box = buildBox();
      form.appendChild(box);
      return;
    }
    // Opakovaný klik: hlášku znovu oznámíme tím, že ji na okamžik vyprázdníme.
    var fresh = buildBox();
    box.parentNode.replaceChild(fresh, box);
  }

  function start() {
    var forms = document.querySelectorAll("form");
    for (var i = 0; i < forms.length; i++) {
      (function (form) {
        form.addEventListener("submit", function (e) {
          e.preventDefault();
          showMessage(form);
        });
      })(forms[i]);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
})();
