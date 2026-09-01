# SKY GUARD — Homepage Redesign Implementation Spec

> **Purpose:** handoff document for Claude Code. This is an implementation brief, not a moodboard. Apply it to the existing Sky Guard codebase and preserve all working integrations unless explicitly told otherwise.
>
> **Reference site inspected:** `https://sky-guard-clone-git-improvements-skyguard2026s-projects.vercel.app/`
>
> **Core positioning change:** Sky Guard is no longer presented as a drone-first service. It is an integrated security platform combining **Sky Camera**, **Sky Drone** and **Sky Hub**. **Sky Security** and **Sky Construction** are use cases built on top of those technologies.

---

## 0. Non-negotiable rules

1. **Do not redesign the brand from scratch.** Preserve the existing premium dark / technical visual language.
2. Keep the existing SKY GUARD logo, existing real drone/Dock imagery and current real Sky Hub screenshots from the repository. For the new camera product, use the supplied branded camera-tower concept assets from `design-assets/product-assets/sky-camera/` unless an approved real camera-tower photo/render already exists in the repository.
3. **Do not stop implementation or ask the user for camera assets.** Camera visuals are included in this handoff. Use the `*-v2.svg` versions as the default website assets. These are branded concept illustrations for the redesign, not technical drawings of a specific third-party camera model. If approved real photography is added later, swap it in without changing the layout.
4. Do not remove SEO metadata, analytics, forms, routing, CRM/email integrations or Hub login functionality.
5. Do not make unsupported technical claims. For example, do not claim fully automatic drone launch from camera detection unless that workflow is actually implemented.
6. Keep orange reserved for **Sky Construction**. The global platform / Security accent remains electric blue. Camera can use a restrained cyan/teal micro-accent only inside camera-specific UI.
7. Avoid generic SaaS styling: no rainbow gradients, giant pill-heavy UI, stock cybersecurity art, 3D blobs or generic startup illustrations.
8. Desktop max width should remain visually close to the current website. Increase spacing and hierarchy, not overall visual width.
9. Reuse existing components where technically sensible, but recompose the homepage around the new information architecture below.
10. Mobile must not simply stack desktop cards blindly. Preserve hierarchy: Hero → platform explanation → configurations → Hub → technology details → use cases → proof → contact.

---

# 1. New information architecture

## Platform model

```text
SKY GUARD
│
├── TECHNOLOGIES
│   ├── Sky Camera
│   ├── Sky Drone
│   └── Sky Hub
│
└── SOLUTIONS / USE CASES
    ├── Sky Security
    └── Sky Construction
```

### Mental model to communicate within 5 seconds

**CAMERAS + DRONES + SKY HUB = SKY GUARD**

Visitors must understand that:
- cameras can be deployed alone,
- the drone can be deployed alone,
- both can be combined,
- Sky Hub is the common software layer,
- Security / Construction are applications of the platform, not separate unrelated technologies.

---

# 2. Navigation redesign

## Desktop navigation

Left: existing SKY GUARD logo.

Center navigation:
- `Řešení`
- `Technologie`
- `Sky Hub`
- `O nás`
- `Kontakt`

Right actions:
- Primary CTA: `Domluvit ukázku`
- Small secondary text link: `Přihlásit se ↗`

### Dropdown: Řešení
- Sky Security
- Sky Construction
- Kamera + dron / Fusion

### Dropdown: Technologie
- Sky Camera
- Sky Drone
- Sky Hub

### Routing rule
`Sky Hub` in the main navigation must go to a product/explanation page or section, **not directly to login**. `Přihlásit se` is the login action.

## Mobile nav
- Logo left
- Menu trigger right
- CTA appears inside menu after links
- `Přihlásit se` remains a lightweight text item

---

# 3. Homepage section order

Implement the homepage in this exact order:

1. Hero
2. Micro value strip
3. Platform architecture: Camera + Drone → Hub
4. Configuration selector: Camera / Drone / Fusion
5. Sky Hub showcase
6. Incident workflow
7. Sky Camera deep dive
8. Sky Drone deep dive
9. Solutions: Security / Construction
10. Why Sky Guard
11. Capability comparison
12. References / testimonials
13. Lead form
14. FAQ
15. Final CTA
16. Footer

---

# 4. Section-by-section design & copy

## SECTION 01 — HERO

### Purpose
Immediately reposition Sky Guard from “drone security” to “integrated security platform”.

### Eyebrow
`INTELIGENTNÍ OCHRANA AREÁLŮ`

### H1
`Bezpečnost, která nikdy nespí.`

### Supporting copy
`Bezpečnostní kamery, autonomní drony a Sky Hub v jednom systému. Samostatně nebo v kombinaci podle potřeb vašeho areálu.`

### CTA
Primary: `Domluvit ukázku ↗`
Secondary: `Jak Sky Guard funguje ↓`

### Visual composition
- Do **not** use the existing drone-only center composition.
- Create a three-part ecosystem hero using real assets:
  - camera tower on one side,
  - drone + Dock on the other,
  - real Sky Hub UI floating / layered behind as the software layer.
- The Hub should not look like a random laptop product shot. Treat it as a dashboard surface / command layer.
- Camera, drone and Hub should have roughly equal conceptual importance.
- Add 1px low-opacity connector paths from Camera and Drone toward the Hub UI.
- Keep motion subtle: 6–10 second ambient drift maximum, no bouncing.

### Height
Desktop: 760–860px depending on viewport.
Mobile: 690–760px.

---

## SECTION 02 — MICRO VALUE STRIP

One single-row strip immediately after Hero.

Items:
- `24/7 DOHLED`
- `KAMERA + DRON`
- `JEDNA APLIKACE`
- `MODULÁRNÍ ŘEŠENÍ`

Each item uses a small icon + uppercase label. No paragraphs.

Desktop: 4 columns.
Mobile: 2x2 grid.

---

## SECTION 03 — PLATFORM ARCHITECTURE

### Eyebrow
`SKY GUARD PLATFORM`

### H2
`Jeden systém. Kompletní přehled.`

### Supporting copy
`Pevný dohled kamer. Mobilní dosah autonomního dronu. Všechno propojené v Sky Hubu.`

### Layout
Do not make three equal cards.

Desktop:
- top row: two equal technology cards: `SKY CAMERA` and `SKY DRONE`
- bottom row: one full-width `SKY HUB` card
- visual connector lines from each technology card into Hub

#### Card: SKY CAMERA
Title: `Pevný dohled 24/7`
Copy: `Kritická místa pod nepřetržitou kontrolou s přístupem odkudkoliv.`
Micro label: `FIXED LAYER`

#### Card: SKY DRONE
Title: `Mobilní dohled areálu`
Copy: `Autonomní kontrola rozsáhlých ploch a rychlé prověření situace.`
Micro label: `MOBILE LAYER`

#### Hub card
Title: `Sky Hub`
Copy: `Jedno místo pro kamery, drony, záznamy, události a provozní data.`
Micro label: `CONTROL LAYER`
CTA: `Poznat Sky Hub →`

---

## SECTION 04 — CONFIGURATION SELECTOR

### H2
`Vaše bezpečnost. Vaše konfigurace.`

### Supporting copy
`Začněte kamerami, autonomním dronem nebo propojte obě technologie do jednoho systému.`

### 3 cards

#### A — SKY CAMERA
Badge: `CAMERA + HUB`
Title: `Nepřetržitý dohled kritických míst`
Copy: `Vlastní kamerové sloupy Sky Guard rozmístíme podle potřeb vašeho objektu.`
CTA: `Zjistit více →`

#### B — SKY DRONE
Badge: `DRONE + HUB`
Title: `Autonomní dohled nad celým areálem`
Copy: `Pravidelné hlídky a rychlé vizuální prověření situace i mimo pevné zorné pole kamer.`
CTA: `Zjistit více →`

#### C — SKY GUARD FUSION
Badge: `KOMPLETNÍ ŘEŠENÍ`
Title: `Kamery vidí. Dron prověřuje. Sky Hub spojuje.`
Copy: `Nejkomplexnější varianta propojuje nepřetržitý pevný dohled s mobilním dosahem autonomního dronu.`
CTA: `Navrhnout řešení →`

### Visual hierarchy
Fusion gets:
- 1px brighter blue border,
- faint blue radial glow behind card,
- small top-right badge,
- no gold / premium cliché treatment.

---

## SECTION 05 — SKY HUB SHOWCASE

This is one of the three most important homepage sections.

### Eyebrow
`SKY GUARD HUB`

### H2
`Celý areál. Jedna aplikace.`

### Copy
`Sledujte kamery, drony, záznamy a události na jednom místě. Sky Hub dává vašemu týmu kompletní přehled nad bezpečností objektu.`

### Required visual
Use a **real Sky Hub screenshot** from the existing project, displayed large enough to be readable.

Do not use a generic monitor mockup if the actual application screenshot can be rendered directly.

### Interactive tabs
- `Přehled`
- `Kamery`
- `Drony`
- `Události`
- `Záznamy`
- `Mapa`

If screenshots exist for individual areas, swap the visual on tab click. If they do not, keep one screenshot and use the tabs as static feature chips until assets are supplied.

### Feature list
- Živý náhled
- Okamžité notifikace
- Historie záznamů
- Mapa objektu
- Přehled zařízení
- Reporty

CTA: `Poznat Sky Hub →`
Secondary: `Přihlásit se ↗`

### Visual style
- full-width dark blue-tinted panel within the central page container,
- 24–32px corner radius,
- subtle 1px border,
- faint blue glow from behind the real UI,
- no purple accent.

---

## SECTION 06 — INCIDENT WORKFLOW

### Eyebrow
`OD DETEKCE K REAKCI`

### H2
`Během několika okamžiků víte, co se děje.`

### Strong line
`Kamera vidí problém. Dron může situaci prověřit.`

### Workflow
1. `Detekce` — Kamera zaznamená událost.
2. `Sky Hub` — Incident se objeví v jednom přehledu.
3. `Upozornění` — Odpovědná osoba dostane informaci.
4. `Prověření` — Dron lze vyslat k ověření situace.
5. `Reakce` — Operátor / bezpečnostní tým jedná s aktuálními informacemi.

### Technical accuracy
Do not write “dron automaticky odstartuje po detekci” unless that automation is currently production-ready and verified.

### Design
Horizontal 5-step line on desktop; vertical timeline on mobile. Use the workflow SVG supplied in `design-assets/` as the baseline visual language.

---

## SECTION 07 — SKY CAMERA DEEP DIVE

### Eyebrow
`SKY CAMERA`

### H2
`Nepřetržitý dohled přesně tam, kde ho potřebujete.`

### Copy
`Samostatně stojící kamerové systémy Sky Guard umožňují pokrýt kritická místa areálu bez nutnosti budovat kompletní novou bezpečnostní infrastrukturu.`

### Layout
Two-column split.
- left = supplied `design-assets/product-assets/sky-camera/sky-camera-tower-product-v2.svg`, large (replace only if approved real tower photography exists)
- right = copy + 4 capabilities

Capabilities:
- `Pevný dohled 24/7`
- `Rychlé nasazení`
- `Vzdálený přístup`
- `Sky Hub integrace`

Optional capabilities such as PTZ, thermal imaging, AI detection or speaker deterrence should only be displayed if they match the actual deployed camera configuration.

CTA: `Zjistit více o Sky Camera →`

---

## SECTION 08 — SKY DRONE DEEP DIVE

### Eyebrow
`SKY DRONE`

### H2
`Dohled, který není omezený jedním bodem.`

### Copy
`Autonomní dron pokrývá rozsáhlé části areálu, provádí pravidelné hlídky a umožňuje rychlé vizuální prověření události.`

### Layout
Mirror Section 07:
- left = copy + capabilities
- right = existing real Dock + drone visual

Capabilities:
- `Autonomní hlídkové trasy`
- `Termální pohled`
- `Rychlé prověření situace`
- `Sky Hub integrace`

CTA: `Zjistit více o Sky Drone →`

---

## SECTION 09 — SOLUTIONS / USE CASES

### H2
`Jedna technologie. Různé využití.`

### Layout
Two large 50/50 panels.

#### SKY SECURITY
Accent: blue.
Copy: `Kompletní ochrana průmyslových areálů, logistických center, skladů a dalších objektů.`
Capability chips:
- CAMERA
- DRONE
- HUB
CTA: `Sky Security →`

#### SKY CONSTRUCTION
Accent: orange.
Copy: `Bezpečnost, vzdálený dohled a datová dokumentace staveb v jednom řešení.`
Capability chips:
- CAMERA
- DRONE
- HUB
Additional bullets:
- Ortofoto
- Fotogrammetrie
- Reporting
- Průběh výstavby
CTA: `Sky Construction →`

Do not introduce orange anywhere above this section except where an existing Construction-specific element is intentionally shown.

---

## SECTION 10 — WHY SKY GUARD

### H2
`Proč Sky Guard?`

Use five compact benefit modules. Avoid tall repetitive cards.

1. `Jedna platforma`
   - `Kamery, dron i data na jednom místě.`
2. `Bezpečnost jako služba`
   - `Technologie i provoz řeší Sky Guard.`
3. `Modulární systém`
   - `Začněte jednou technologií a systém postupně rozšiřujte.`
4. `Rychlé nasazení`
   - `Řešení přizpůsobíme vašemu existujícímu areálu.`
5. `Kompletní provoz`
   - `Včetně provozních a legislativních požadavků souvisejících s drony.`

---

## SECTION 11 — CAPABILITY COMPARISON

Replace the current Security-vs-Construction service table.

Columns:
- `Sky Camera`
- `Sky Drone`
- `Fusion`

Rows:
- Stálý dohled kritického bodu
- Mobilní kontrola areálu
- Kontrola rozsáhlých ploch
- Prověření incidentu z jiné pozice
- Přístup přes Sky Hub
- Záznam a historie
- Okamžité upozornění
- Propojení pevného a mobilního dohledu

### Data principles
Do not mark unsupported features. Where capability depends on hardware configuration, use `Volitelné` or a footnote instead of a checkmark.

---

## SECTION 12 — REFERENCES

Keep the current carousel interaction if it is stable.

Enhance each testimonial with:
- solution tag e.g. `SKY CAMERA`, `SKY DRONE + CAMERA`, `SKY CONSTRUCTION`
- object type / scale where client-approved
- client role

Do not invent company names or metrics.

---

## SECTION 13 — LEAD FORM

### H2
`Navrhneme řešení pro váš areál.`

Fields:
- Jméno
- Společnost
- E-mail
- Telefon (optional if current backend supports it; otherwise do not break submission)

Object type:
- Průmyslový areál
- Logistika / sklad
- Stavba
- Administrativa
- Jiný

Interest:
- Sky Camera
- Sky Drone
- Camera + Drone / Fusion
- Sky Construction
- Sky Hub
- Nevím — chci poradit

CTA: `Domluvit konzultaci`

Preserve current form submit destination and validation unless intentionally migrating it.

---

## SECTION 14 — FAQ

Questions:
1. `Lze využít pouze bezpečnostní kamery?`
2. `Musím mít zároveň dron?`
3. `Jak funguje kombinace kamer a dronu?`
4. `Co všechno vidím v Sky Hubu?`
5. `Lze systém postupně rozšiřovat?`
6. `Potřebuji vlastní infrastrukturu?`
7. `Jak rychle lze systém instalovat?`
8. `Jak funguje dron za špatného počasí?`
9. `Kdo řeší legislativu provozu dronu?`
10. `Jak jsou ukládány a zabezpečeny záznamy?`

Use existing accordion interaction if stable.

---

## SECTION 15 — FINAL CTA

H2:
`Váš areál. Jeden systém. Kompletní přehled.`

Copy:
`Kamery, autonomní drony a Sky Hub navržené podle potřeb vašeho objektu.`

CTA:
`Domluvit ukázku ↗`

Use a large quiet blue radial glow behind the CTA area. No image necessary.

---

## SECTION 16 — FOOTER

Replace drone-only tagline.

Preferred line:
`Kamery. Drony. Jeden Sky Hub.`

Keep existing company / legal / navigation / social information.

---

# 5. Visual system

The reference implementation files are inside `design-assets/`.

## Core tokens

- page background: `#05060B`
- elevated background: `#090C14`
- card background: rgba-like dark surface around `#0B0E16`
- primary text: `#F4F7FB`
- secondary text: `#9CA6B5`
- muted text: `#687180`
- grid line: `rgba(255,255,255,.075)`
- hairline border: `rgba(255,255,255,.11)`
- primary blue: `#0878FF`
- electric blue: `#0B6CF2`
- camera micro accent: `#19C9C2`
- construction orange: `#FF850A`

### Rules
- Blue may glow; cyan should glow only subtly.
- Orange is Construction-only.
- Avoid purple entirely in the homepage system.
- Text should be white / neutral gray, not tinted blue.

## Typography

Use the project’s existing brand / display font for SKY GUARD branded headers where already licensed and configured.

For body/UI text, preserve the current clean sans-serif if it is already in project. If not, prefer a neutral modern system sans stack rather than importing a random display font.

Suggested scale desktop:
- Hero H1: 64–76px
- Section H2: 42–52px
- Card title: 22–28px
- Body large: 18–20px
- Body: 15–17px
- UI/meta: 12–14px

Mobile:
- H1: 42–48px
- H2: 32–38px
- body: 15–17px

## Radius
- hero visual / major panel: 28–32px
- cards: 20–24px
- buttons: 999px only for actual CTA buttons; do not pill every UI element
- small chips: 999px

## Borders
Use 1px hairlines. Avoid border around every subsection.

## Shadows / glow
Glows are atmospheric, not decorative neon.

Preferred primary glow:
```css
box-shadow:
  0 0 0 1px rgba(8,120,255,.12),
  0 18px 70px rgba(0,70,180,.16);
```

CTA glow on hover only:
```css
box-shadow:
  0 0 28px rgba(8,120,255,.38),
  0 10px 30px rgba(0,70,180,.24);
```

## Grid
Preserve the existing technical architectural grid but reduce contrast compared with current implementation. It should organize space, not compete with content.

---

# 6. Motion specification

Use motion sparingly.

### Allowed
- fade + translateY 12px on section entrance, 450–650ms
- connector line draw-in, 700–1100ms
- card hover translateY(-3px)
- border brightness shift on hover
- slow 6–10s ambient hero asset drift, max 5px
- Hub screenshot tab crossfade 220–320ms

### Not allowed
- bouncing drone
- looping typewriter text
- rotating logos
- parallax strong enough to reduce readability
- mouse-following spotlight over the entire page

Respect `prefers-reduced-motion`.

---

# 7. Responsive rules

## Desktop ≥ 1200px
- central container around current site width
- 12-column internal grid
- generous 96–140px section spacing

## Tablet 768–1199px
- reduce multi-column sections to 2-column where possible
- configuration cards: 2 + 1 layout
- comparison table scroll container if required

## Mobile ≤ 767px
- no horizontal layout dependencies
- Hero asset stack: Hub background → camera and drone foreground
- platform architecture becomes Camera → Drone → Hub vertically
- configuration cards stack with Fusion first or second depending on visual flow; preferred order: Camera, Drone, Fusion
- no tiny table; convert comparison into collapsible feature rows if width < 640px
- sticky CTA optional but only if it does not obscure content

---

# 8. Asset mapping rules

Before changing visuals, inspect the repository for:
- supplied Sky Camera concept assets in `design-assets/product-assets/sky-camera/`,
- approved real camera tower photography/renders if later available,
- real Dock + drone transparent PNG/WebP,
- Sky Hub screenshots,
- existing SKY GUARD logo SVG,
- Construction images,
- current icons.

Prefer these assets over newly invented imagery. **Do not ask for additional camera photography in order to complete the homepage.** The supplied Sky Camera concept artwork is the implementation fallback and is already approved for layout/prototyping purposes.

Use the supplied SVGs in `design-assets/icons/` for UI / feature iconography where appropriate.
Use `design-assets/backgrounds/technical-grid.svg` for sections that need the grid but do not already have a reusable background component.

---

# 9. Component plan

Suggested React component decomposition; adapt to the existing stack rather than forcing this naming.

```text
Homepage
├── Header
├── HeroPlatform
├── ValueStrip
├── PlatformArchitecture
│   ├── TechnologyCard(Camera)
│   ├── TechnologyCard(Drone)
│   └── HubControlLayer
├── ConfigurationSelector
│   └── ConfigurationCard x3
├── HubShowcase
├── IncidentWorkflow
├── TechnologyDeepDive(Camera)
├── TechnologyDeepDive(Drone)
├── SolutionPanels
│   ├── SecurityPanel
│   └── ConstructionPanel
├── BenefitsStrip
├── CapabilityComparison
├── Testimonials
├── LeadForm
├── FAQ
├── FinalCTA
└── Footer
```

---

# 10. Migration from current homepage

### KEEP / REUSE
- header shell / logo
- real drone and Dock media
- existing technology photography that is accurate
- testimonial carousel interaction
- FAQ accordion interaction
- form integration
- existing footer company information
- Hub login route
- current grid motif

### REBUILD / RECOMPOSE
- hero
- service cards
- service comparison table
- benefits grid
- Hub presentation
- technology hierarchy
- CTA copy

### REMOVE / REPLACE copy
Replace the global message `Dronová ostraha – strážce, který nikdy nespí.` with platform-level wording.
Do not keep `Výhody, které dronová ostraha nabízí...` as the homepage framing.

---

# 11. Acceptance checklist

Before marking the redesign complete, verify:

- [ ] A new visitor sees **camera + drone + Hub** above the fold.
- [ ] Sky Hub has a dedicated explanatory section.
- [ ] Main Sky Hub nav item does not dump visitors into login.
- [ ] Camera-only purchase/deployment is clearly possible.
- [ ] Drone-only purchase/deployment is clearly possible.
- [ ] Fusion is clearly explained without implying unsupported automation.
- [ ] Security and Construction are positioned as use cases.
- [ ] Orange appears only in Construction context.
- [ ] Existing real product assets are used wherever available.
- [ ] Existing form submission still works.
- [ ] Existing analytics / SEO are preserved.
- [ ] Mobile comparison is usable.
- [ ] `prefers-reduced-motion` is respected.
- [ ] No fake client names, fake metrics or unsupported capabilities were introduced.
- [ ] The page visually feels like an evolution of the current Sky Guard brand, not a template swap.

---

# 12. Supplied design files

See `design-assets/README.md` for how to use the accompanying files.
