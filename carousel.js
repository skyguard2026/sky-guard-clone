// Testimonials carousel — Framer mirror static export.
// Cards (4 responsive variants) all hold the same single testimonial in HTML.
// We rotate 3 different testimonials by rewriting body/role/counter in every
// card. i18n.js MutationObserver picks up the new CS text and translates it
// via DICT when the user is in EN mode.

(function () {
  const TESTIMONIALS = [
    {
      body: "„Na stavbě se nám v minulosti několikrát ztratily nářadí i materiál. Od té doby spolupracujeme se Sky Guard a rozdíl je obrovský. Kamerový systém a mobilní věže s dohledem nám dávají jistotu i v noci a o víkendech. Instalace byla rychlá, vše jsme zvládli bez zdržení výstavby.",
      role: "Construction Manager",
    },
    {
      body: "„Dlouho jsme hledali komplexní zabezpečovací řešení pro náš výrobní areál a s Sky Guard jsme konečně našli partnera, který nám rozumí. Přístup byl naprosto profesionální — od vstupní analýzy rizik až po instalaci systému a jeho napojení na dohledové centrum.",
      role: "Majitel většího průmyslového areálu",
    },
    {
      body: "„Spravuji několik areálů a bezpečnost je u nás naprostou prioritou. Sky Guard nám pomohl sjednotit dohled napříč lokalitami, což nám výrazně usnadnilo každodenní provoz. Systémy jsou spolehlivé, technická podpora reaguje rychle a přehledný přístup ke všem kamerám a záznamům online je obrovská výhoda.",
      role: "Technik spravující několik průmyslových objektů",
    },
  ];

  const TOTAL = TESTIMONIALS.length;
  let current = 0;

  function findParts(card) {
    const body = card.querySelector("h4");
    const role = card.querySelector('[data-framer-name="Identity"] p');
    let counter = null;
    card.querySelectorAll("p").forEach((p) => {
      if (counter) return;
      if (p.closest("a, button")) return; // skip prev/next button labels
      if (/^\s*\d+\s*\/\s*\d+\s*$/.test(p.textContent || "")) counter = p;
    });
    return { body, role, counter };
  }

  function setSlide(i) {
    current = ((i % TOTAL) + TOTAL) % TOTAL;
    const t = TESTIMONIALS[current];
    document
      .querySelectorAll('[data-framer-name="TestimonialCards"]')
      .forEach((card) => {
        const { body, role, counter } = findParts(card);
        if (body) body.textContent = t.body;
        if (role) role.textContent = t.role;
        if (counter) counter.textContent = current + 1 + "/" + TOTAL;
      });
  }

  function bindButtons() {
    // Buttons are siblings of the TestimonialCards element (under a shared
    // wrapper). Find all Primary anchors that are visually next to a card
    // and contain a directional icon.
    const all = document.querySelectorAll(
      'a[data-framer-name="Primary"], button[data-framer-name="Primary"]'
    );
    all.forEach((b) => {
      if (b.dataset.sgCarouselBound) return;
      const slot = b.parentElement?.closest(
        '[data-framer-name="1/3"], [data-framer-name="TestimonialCards"]'
      );
      if (!slot && !b.parentElement?.querySelector('[data-framer-name="TestimonialCards"]')) {
        // Only bind if button shares a wrapper with a TestimonialCards element.
        // Fallback: walk up a few parents.
        let p = b.parentElement;
        let near = false;
        for (let i = 0; i < 4 && p; i++) {
          if (p.querySelector('[data-framer-name="TestimonialCards"]')) {
            near = true; break;
          }
          p = p.parentElement;
        }
        if (!near) return;
      }
      const isPrev = !!b.querySelector('[data-framer-name="IconLeft"]');
      const isNext = !!b.querySelector('[data-framer-name="IconRight"]');
      if (!isPrev && !isNext) return;
      b.addEventListener("click", (e) => {
        e.preventDefault();
        setSlide(current + (isNext ? 1 : -1));
      });
      b.dataset.sgCarouselBound = "1";
    });
  }

  function init() {
    if (
      !document.querySelector('[data-framer-name="TestimonialCards"]')
    ) return;
    bindButtons();
    setSlide(0);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
