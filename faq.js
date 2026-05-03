// FAQ accordion — Framer mirror static export.
// Original Framer build had no working accordion JS in this static export and
// the answers were never present in the HTML at all. We inject answers next to
// each question header and add open/close behaviour with a Plus↔X icon swap.
//
// i18n.js MutationObserver translates injected CS answer text to EN via DICT
// when the user is in EN mode. (DICT entries added in i18n.js.)

(function () {
  const PLUS_SVG =
    '<svg class="sg-faq-icon-plus" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" color="rgb(2, 73, 168)" style="width:100%;height:100%;"><path fill-rule="evenodd" d="M12 3.75a.75.75 0 0 1 .75.75v6.75h6.75a.75.75 0 0 1 0 1.5h-6.75v6.75a.75.75 0 0 1-1.5 0v-6.75H4.5a.75.75 0 0 1 0-1.5h6.75V4.5a.75.75 0 0 1 .75-.75Z" clip-rule="evenodd"></path></svg>';
  const X_SVG =
    '<svg class="sg-faq-icon-x" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" color="rgb(2, 73, 168)" style="width:100%;height:100%;"><path fill-rule="evenodd" d="M5.47 5.47a.75.75 0 0 1 1.06 0L12 10.94l5.47-5.47a.75.75 0 1 1 1.06 1.06L13.06 12l5.47 5.47a.75.75 0 1 1-1.06 1.06L12 13.06l-5.47 5.47a.75.75 0 0 1-1.06-1.06L10.94 12 5.47 6.53a.75.75 0 0 1 0-1.06Z" clip-rule="evenodd"></path></svg>';

  const Q2A = {
    "Jak funguje dronová ostraha v praxi?":
      "Dron pravidelně hlídkuje ve zvolených intervalech, sleduje okolí pomocí kamer a v případě narušení odešle upozornění našemu dohledu i vám.",
    "Jak je dron chráněn proti krádeži nebo poškození?":
      "Stanice i dron mají GPS, bezpečnostní zámky a jsou monitorovány. Případný zásah je okamžitě detekován.",
    "Co když je špatné počasí? Funguje to i v dešti nebo zimě?":
      "Ano, zařízení je voděodolné a funguje v extrémních teplotách – mráz, sníh, déšť nejsou problém.",
    "Co když dron selže nebo spadne?":
      "Drony jsou pravidelně servisovány a monitorovány. V případě poruchy je aktivován záložní režim a náš tým situaci řeší okamžitě.",
  };

  // EN question text → CS key (so we can find the answer when i18n.js has
  // already swapped the question header to English by the time faq.js runs).
  const EN2CS = {
    "How does drone surveillance work in practice?":
      "Jak funguje dronová ostraha v praxi?",
    "How is the drone protected against theft or damage?":
      "Jak je dron chráněn proti krádeži nebo poškození?",
    "What happens in bad weather? Does it work in rain or winter?":
      "Co když je špatné počasí? Funguje to i v dešti nebo zimě?",
    "What if the drone fails or crashes?":
      "Co když dron selže nebo spadne?",
  };

  function ensureIcons(plusContainer) {
    const inner = plusContainer.querySelector(
      'div[style*="display:contents"], div[style*="display: contents"]'
    );
    if (!inner) return;
    if (inner.querySelector(".sg-faq-icon-plus, .sg-faq-icon-x")) return;
    inner.insertAdjacentHTML("beforeend", PLUS_SVG + X_SVG);
  }

  function injectAnswer(slot, qText) {
    if (slot.querySelector(".sg-faq-answer")) return;
    const csText = Q2A[qText] || Q2A[EN2CS[qText]];
    if (!csText) return;
    const div = document.createElement("div");
    div.className = "sg-faq-answer";
    const p = document.createElement("p");
    p.textContent = csText;
    div.appendChild(p);
    slot.appendChild(div);
  }

  function init() {
    const headers = document.querySelectorAll('[data-framer-name="Close"]');
    if (!headers.length) return;
    headers.forEach((header) => {
      const qText = header
        .querySelector('[data-framer-name="Question"] p')
        ?.textContent?.trim();
      if (!qText) return;
      const slot = header.parentElement;
      if (!slot) return;
      slot.classList.add("sg-faq-slot");
      injectAnswer(slot, qText);
      const plus = header.querySelector('[data-framer-name="Plus"]');
      if (plus) ensureIcons(plus);
      if (header.dataset.sgFaqBound) return;
      header.addEventListener("click", (e) => {
        e.preventDefault();
        const wasOpen = slot.classList.contains("sg-faq-open");
        document
          .querySelectorAll(".sg-faq-slot.sg-faq-open")
          .forEach((s) => s.classList.remove("sg-faq-open"));
        if (!wasOpen) slot.classList.add("sg-faq-open");
      });
      header.dataset.sgFaqBound = "1";
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
