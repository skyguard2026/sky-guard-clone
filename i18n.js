// Runtime CS↔EN překlad pro Framer mirror.
// Strategie: matchujeme celé textContenty P / H1–H6 / A / Button elementů,
// protože Framer rozsekává texty na per-slovo <span> kvůli animacím — překlad
// per-textNode by nestačil. Sleduje DOM přes MutationObserver.

(function () {
  const DICT = {
    // Navigace
    "O nás": "About",
    "Technologie": "Technology",
    "Služby": "Services",
    "Kontakt": "Contact",
    "Sky Guard Hub": "Sky Guard Hub",
    "Navigation": "Navigation",
    "Socials": "Socials",
    "Next": "Next",
    "Previous": "Previous",
    "Předchozí": "Previous",
    "Další": "Next",

    // Hero
    "Sky Guard - Dronová ostraha": "Sky Guard - Drone Security",
    "Dronová ostraha - strážce který nikdy nespí.": "Drone security — a guard that never sleeps.",
    "Domluvit ukázku": "Book a demo",
    "Mějte přehled. Mějte jistotu. Mějte Skyguard.": "Stay informed. Stay confident. Stay Skyguard.",

    // Produktové bloky
    "SKY SECURITY": "SKY SECURITY",
    "SKY CONSTRUCTION": "SKY CONSTRUCTION",
    "SECURITY": "SECURITY",
    "CONSTRUCTION": "CONSTRUCTION",
    "SKY": "SKY",
    "Sky security": "Sky security",
    "Sky construction": "Sky construction",
    "Sky reporting": "Sky reporting",
    "Sky storage": "Sky storage",
    "Sky Storage": "Sky Storage",
    "Komplexní řešení ochrany vašeho objektu": "Comprehensive protection for your property",
    "Komplexní řešení pro vaše stavební projekty": "Comprehensive solution for your construction projects",
    "Komplexní řešení pro": "Comprehensive solution for",
    "vaše stavební projekty": "your construction projects",

    // Tabulka služeb
    "Aktivní odrazení a odstrašení pachatele": "Active deterrence of intruders",
    "Aktivní odstrašení": "Active deterrence",
    "Termokamera - detekce osob ve tmě": "Thermal camera — person detection at night",
    "Detekce osob ve tmě": "Person detection at night",
    "Sky Storage - online dostupné záznamy": "Sky Storage — online available recordings",
    "Napojení na existující security systémy": "Integration with existing security systems",
    "Napojení na EPS": "EPS integration",
    "Ortofotomapa - denní záznamy staveniště": "Orthophoto map — daily site records",
    "Ortofotomapa": "Orthophoto map",
    "Ortofotomapy staveniště": "Construction site orthophoto maps",
    "Fotogametrie - detailní 3D výstupy": "Photogrammetry — detailed 3D outputs",
    "Fotogammetrie": "Photogrammetry",
    "Fotogammetrické scany": "Photogrammetric scans",
    "Pravidelný report z nasbíraných dat (PDF)": "Regular report from collected data (PDF)",
    "Pravidelné reporty": "Regular reports",
    "Termální diagnostika a analýza": "Thermal diagnostics and analysis",
    "Termální diagnostika": "Thermal diagnostics",
    "Foto a video dokumentace (reporty)": "Photo and video documentation (reports)",
    "Foto a video": "Photo and video",

    // "Proč si vybrat" sekce
    "Proč si vybrat zrovna nás?": "Why choose us?",
    "Bezpečí vašeho areálu je pro nás naprostou prioritou.": "The safety of your premises is our top priority.",
    "Bezpečnost jako služba, nikoli starost": "Security as a service, not a worry",
    "Naše technologie zajistí, že váš areál bude v bezpečí.": "Our technology keeps your premises safe.",
    "Legislativu vyřešíme za Vás": "We handle the legislation for you",
    "Postaráme se o zlegalizování použití dronů u Vás, vy nic řešit nemusíte.": "We handle drone legalization at your site — you don't have to deal with anything.",
    "Okamžité notifikace": "Instant notifications",
    "O každém narušení, které dron zaznamená informuje do pár vteřin.": "Every breach detected by the drone is reported within seconds.",
    "24/7 Náhled": "24/7 Overview",
    "Do kamerových záznamů nahlížíte kdykoliv a odkudkoliv přes naše úložiště.": "Access camera recordings anytime, anywhere via our storage.",

    // Tech sekce
    "Nejmodernější technologie spojená s profesionály.": "Cutting-edge technology paired with professionals.",
    "2x Termokamera, přesná GPS, Tiché motory i vodě odolné tělo pro použití v jakémkoliv počasí.": "2× thermal camera, precise GPS, quiet motors and a waterproof body — usable in any weather.",

    // Výhody Sky Guard
    "Výhody Sky Guard": "Sky Guard advantages",
    "Veškeré výhody, které dronová ostraha nabízí oproti klasické ostraze.": "All the advantages drone security offers over traditional security.",
    "24/7 Dohled na váš objekt": "24/7 surveillance of your property",
    "Dron automaticky hlídkuje ve zvolených intervalech ve dne i v noci.": "The drone automatically patrols at chosen intervals, day and night.",
    "Při zjištění pohybu mimo zvolenou dobu systém ihned upozorní náš dohled a Vás.": "When motion is detected outside the chosen window, the system immediately alerts our monitoring and you.",
    "Noční vidění": "Night vision",
    "Dvě integrované termokamery a chytrá AI analýza odhalí narušitele ve tmě.": "Two integrated thermal cameras and smart AI analysis detect intruders in the dark.",
    "Výhody oproti klasické security": "Advantages over traditional security",
    "Dron nepotřebuje odpočinek, dovolenou ani nemocenskou. Navíc je služba daleko levnější.": "The drone needs no rest, vacation, or sick leave. Plus the service is far cheaper.",
    "Voděodolná konstrukce": "Waterproof construction",
    "Mráz, teplo, déšť, sníh - zařízení pracuje bezchybně v každém počasí.": "Cold, heat, rain, snow — the device works flawlessly in any weather.",
    "Unifikované snadno přístupné úložiště pro kontrolu a operaci se záznamy z dronu.": "Unified, easily accessible storage for reviewing and managing drone recordings.",
    "Denní záznamy stavebního pozemku včetně přehledu o rozmístění stavební techniky.": "Daily records of the construction site, including an overview of equipment placement.",
    "3D denní scany stavby ve vysokém rozlišení pro Construction Management.": "Daily 3D high-resolution site scans for Construction Management.",
    "Pravidelné analýzy založené na sesbíraných datech, doplněné o poznatky stavebního procesu.": "Regular analyses based on collected data, supplemented with construction process insights.",
    "Comming Soon": "Coming Soon",

    // Formulář
    "Domluvte si s námi ukázku": "Book a demo with us",
    "Jméno": "Name",
    "Email": "Email",
    "Volba služby": "Service",
    "Vybrat": "Select",
    "Stavební projekt": "Construction project",
    "Průmyslový areál": "Industrial site",
    "Zemědělský objekt": "Agricultural property",
    "Odeslat": "Submit",

    // Reference
    "Naši službu aktivně využívají": "Actively used by",
    "Připojte se k dalším klientům Sky Guard a pozdvihněte vaši bezpečnost na novou úroveň.": "Join other Sky Guard clients and take your security to a new level.",
    "„Na stavbě se nám v minulosti několikrát ztratily nářadí i materiál. Od té doby spolupracujeme se Sky Guard a rozdíl je obrovský. Kamerový systém a mobilní věže s dohledem nám dávají jistotu i v noci a o víkendech. Instalace byla rychlá, vše jsme zvládli bez zdržení výstavby.":
      "„On the site we used to lose tools and materials several times. Since we started working with Sky Guard the difference has been huge. The camera system and mobile towers with monitoring give us certainty at night and on weekends. The installation was fast, we got everything done without delaying construction.",
    "„Dlouho jsme hledali komplexní zabezpečovací řešení pro náš výrobní areál a s Sky Guard jsme konečně našli partnera, který nám rozumí. Přístup byl naprosto profesionální — od vstupní analýzy rizik až po instalaci systému a jeho napojení na dohledové centrum.":
      "„We had been looking for a comprehensive security solution for our production facility for a long time, and with Sky Guard we finally found a partner who understands us. The approach was completely professional — from the initial risk analysis to the system installation and connection to the monitoring center.",
    "„Spravuji několik areálů a bezpečnost je u nás naprostou prioritou. Sky Guard nám pomohl sjednotit dohled napříč lokalitami, což nám výrazně usnadnilo každodenní provoz. Systémy jsou spolehlivé, technická podpora reaguje rychle a přehledný přístup ke všem kamerám a záznamům online je obrovská výhoda.":
      "„I manage several sites and security is our absolute priority. Sky Guard helped us unify surveillance across all locations, which significantly streamlined our daily operations. The systems are reliable, technical support responds quickly, and the clear online access to all cameras and recordings is a huge advantage.",
    "Construction Manager": "Construction Manager",
    "Construction Management": "Construction Management",
    "Majitel většího průmyslového areálu": "Owner of a large industrial site",
    "Technik spravující několik průmyslových objektů": "Technician managing several industrial buildings",

    // FAQ
    "Nejčastěji kladené dotazy": "Frequently asked questions",
    "Vše co potřebujete o naší službě Sky Guard na jednom místě": "Everything you need about our Sky Guard service in one place",
    "Jak funguje dronová ostraha v praxi?": "How does drone surveillance work in practice?",
    "Jak je dron chráněn proti krádeži nebo poškození?": "How is the drone protected against theft or damage?",
    "Co když je špatné počasí? Funguje to i v dešti nebo zimě?": "What happens in bad weather? Does it work in rain or winter?",
    "Co když dron selže nebo spadne?": "What if the drone fails or crashes?",
    "Dron pravidelně hlídkuje ve zvolených intervalech, sleduje okolí pomocí kamer a v případě narušení odešle upozornění našemu dohledu i vám.":
      "The drone regularly patrols at chosen intervals, monitors the surroundings via cameras, and instantly sends an alert to our monitoring center and to you in case of an intrusion.",
    "Stanice i dron mají GPS, bezpečnostní zámky a jsou monitorovány. Případný zásah je okamžitě detekován.":
      "Both the station and the drone have GPS, security locks and are continuously monitored. Any tampering is detected immediately.",
    "Ano, zařízení je voděodolné a funguje v extrémních teplotách – mráz, sníh, déšť nejsou problém.":
      "Yes, the device is waterproof and operates in extreme temperatures — frost, snow and rain are not an issue.",
    "Drony jsou pravidelně servisovány a monitorovány. V případě poruchy je aktivován záložní režim a náš tým situaci řeší okamžitě.":
      "The drones are regularly serviced and monitored. In the event of a failure, a fail-safe mode activates and our team handles the situation immediately.",

    // CTA
    "Jste připraveni povznést vaši bezpečnost na novou úroveň?": "Ready to take your security to a new level?",
    "Připojte se k nám ve Sky Guard a zabezpečte své objekty patřičným způsobem 21. století.": "Join us at Sky Guard and secure your properties the way the 21st century deserves.",

    // Footer
    "Sky Guard s.r.o.": "Sky Guard s.r.o.",
    "Pernerova 533/59, Praha 8": "Pernerova 533/59, Praha 8",
    "IČO: 24803383": "ID: 24803383",
    "C 175699 vedená u Městského soudu v Praze": "C 175699 filed at the Municipal Court in Prague",
    "Facebook": "Facebook",
    "Instagram": "Instagram",
    "LinkedIn": "LinkedIn",
    "Tiktok": "Tiktok",
  };

  const STORAGE_KEY = "sg-lang";
  const getLang = () => localStorage.getItem(STORAGE_KEY) || "cs";
  const setLang = (l) => {
    localStorage.setItem(STORAGE_KEY, l);
    location.reload();
  };

  // Tagy, jejichž celý textContent zkusíme matchnout proti DICT (a kde nahradíme
  // celý textContent najednou, čímž rozsekané <span>y zmizí — jejich animace už
  // nepoužíváme, finální stav držíme přes CSS).
  const PHRASE_TAGS = new Set([
    "P", "H1", "H2", "H3", "H4", "H5", "H6",
    "A", "BUTTON", "LI", "LABEL", "SUMMARY", "TITLE",
  ]);

  const SKIP_TAGS = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "TEMPLATE"]);

  // Příznak — abychom u stejného elementu necyklili při MutationObserver fire
  const TRANSLATED = new WeakSet();

  function translatePhrase(el) {
    if (TRANSLATED.has(el)) return false;
    const t = el.textContent;
    if (!t) return false;
    const trimmed = t.trim();
    if (!trimmed) return false;
    if (!DICT.hasOwnProperty(trimmed)) return false;

    // Najdi nejhlubší element, jehož trimmed textContent stále drží celou frázi.
    // Přeskočíme tak <a> wrapper s ikonou + textem, dostaneme se k <p class=
    // "framer-text">, který má styly. Změnou textContent v leafu zachováme
    // sourozence parenta (např. ikonu šipky) a zachováme class na leafu.
    let leaf = el;
    const target = trimmed;
    while (true) {
      let next = null;
      for (let i = 0; i < leaf.children.length; i++) {
        const ch = leaf.children[i];
        if (ch.textContent && ch.textContent.trim() === target) {
          next = ch;
          break;
        }
      }
      if (!next) break;
      leaf = next;
    }

    const lead = t.match(/^\s*/)[0];
    const tail = t.match(/\s*$/)[0];
    leaf.textContent = lead + DICT[trimmed] + tail;
    TRANSLATED.add(el);
    TRANSLATED.add(leaf);
    return true;
  }

  function translateTextNode(node) {
    const v = node.nodeValue;
    if (!v) return;
    const t = v.trim();
    if (!t) return;
    if (!DICT.hasOwnProperty(t)) return;
    // Self-mapping entries (e.g. "Sky security" → "Sky security") would set
    // nodeValue to the same string, but Chrome still fires a characterData
    // mutation, which in turn re-triggers this handler — infinite loop on
    // any text node touched after the MutationObserver is installed (carousel
    // textContent writes, runtime text edits, etc.). Skip no-op translations.
    const newVal = DICT[t];
    if (newVal === t) return;
    const lead = v.match(/^\s*/)[0];
    const tail = v.match(/\s*$/)[0];
    node.nodeValue = lead + newVal + tail;
  }

  function walk(root) {
    if (!root) return;
    if (root.nodeType === Node.TEXT_NODE) {
      translateTextNode(root);
      return;
    }
    if (root.nodeType !== Node.ELEMENT_NODE) return;
    if (SKIP_TAGS.has(root.tagName)) return;
    if (root.id === "sg-lang-switcher") return;

    // Atributy
    if (root.placeholder) {
      const p = root.placeholder.trim();
      if (DICT.hasOwnProperty(p)) root.placeholder = DICT[p];
    }
    if (root.hasAttribute && root.hasAttribute("aria-label")) {
      const al = root.getAttribute("aria-label").trim();
      if (DICT.hasOwnProperty(al)) root.setAttribute("aria-label", DICT[al]);
    }

    // Pokud je to "phrase" tag a celý textContent je ve slovníku, nahradíme ho
    // a children už nezpracováváme.
    if (PHRASE_TAGS.has(root.tagName)) {
      if (translatePhrase(root)) return;
    }

    // Jinak: rekurze do dětí. Také pro divy / spany — pro případ že textContent
    // celého divu (např. fráze splitnutá na "Komplexní řešení pro vaše stavební
    // projekty") je v dictu.
    if (root.tagName === "DIV" || root.tagName === "SPAN") {
      const trimmed = root.textContent?.trim();
      if (trimmed && DICT.hasOwnProperty(trimmed)) {
        if (translatePhrase(root)) return;
      }
    }

    for (let i = 0; i < root.childNodes.length; i++) walk(root.childNodes[i]);
  }

  function injectSwitcher() {
    if (document.getElementById("sg-lang-switcher")) return;
    const lang = getLang();
    const wrap = document.createElement("div");
    wrap.id = "sg-lang-switcher";
    wrap.setAttribute("role", "group");
    wrap.setAttribute("aria-label", "Language switcher");
    wrap.style.cssText = [
      "position:fixed",
      "top:20px",
      "right:20px",
      "z-index:2147483647",
      "display:flex",
      "gap:4px",
      "padding:4px",
      "background:rgba(0,0,0,0.55)",
      "backdrop-filter:blur(8px)",
      "-webkit-backdrop-filter:blur(8px)",
      "border:1px solid rgba(255,255,255,0.15)",
      "border-radius:999px",
      "font:600 12px/1 system-ui,-apple-system,'Inter',sans-serif",
      "letter-spacing:0.05em",
    ].join(";");
    const mkBtn = (code, label) => {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = label;
      const active = lang === code;
      b.style.cssText = [
        "appearance:none",
        "border:0",
        "cursor:pointer",
        "padding:6px 12px",
        "border-radius:999px",
        "color:" + (active ? "#000" : "#fff"),
        "background:" + (active ? "#fff" : "transparent"),
        "font:inherit",
        "transition:background 0.15s, color 0.15s",
      ].join(";");
      b.addEventListener("click", () => {
        if (lang !== code) setLang(code);
      });
      b.addEventListener("mouseenter", () => {
        if (!active) b.style.background = "rgba(255,255,255,0.1)";
      });
      b.addEventListener("mouseleave", () => {
        if (!active) b.style.background = "transparent";
      });
      return b;
    };
    wrap.appendChild(mkBtn("cs", "CS"));
    wrap.appendChild(mkBtn("en", "EN"));
    document.body.appendChild(wrap);
  }

  function start() {
    injectSwitcher();
    if (getLang() !== "en") return;

    document.documentElement.lang = "en";
    if (document.title === "Sky Guard - Dronová ostraha") {
      document.title = "Sky Guard - Drone Security";
    }

    walk(document.body);

    const obs = new MutationObserver((records) => {
      for (const r of records) {
        if (r.type === "characterData") {
          translateTextNode(r.target);
        } else if (r.type === "childList") {
          r.addedNodes.forEach(walk);
        } else if (r.type === "attributes") {
          if (r.attributeName === "placeholder" || r.attributeName === "aria-label") {
            walk(r.target);
          }
        }
      }
    });
    obs.observe(document.body, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
      attributeFilter: ["placeholder", "aria-label"],
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
})();
