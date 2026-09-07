# Sky Guard — kalkulačka nákladů a cen

Interní nástroj pro dva jednatele. Slouží ke stanovení měsíční ceny služby pro klienta na základě skutečných nákladů lokality. Nahrazuje excelovský model, ve kterém byla řada chyb.

Referenční implementace je `reference/prototyp.html`. Je funkční a otestovaná. Kde se tato specifikace a prototyp rozcházejí, platí specifikace.

---

## 1. Doména

Sky Guard prodává dva produkty jako službu s měsíčním paušálem:

**Sky Cam** — kamery na sloupech na pozemku klienta. Nízká vstupní investice, nízký měsíční náklad.

**Sky Guard** — autonomní dron v dokovací stanici. Vysoká vstupní investice, vyšší měsíční náklad.

Na jedné lokalitě mohou běžet oba naráz. Klient má jednu nebo více lokalit. Firma má portfolio lokalit napříč klienty a část nákladů je společná pro celé portfolio.

**Klíčová obchodní otázka, na kterou aplikace odpovídá:** jaká je nejnižší měsíční cena, za kterou dává konkrétní konfigurace lokality smysl, a za jak dlouho se vrátí vstupní investice.

---

## 2. Datový model

### Nákladová položka (`catalog_item`)

| Pole | Typ | Popis |
|---|---|---|
| `id` | text, PK | slug, např. `dr_dock` |
| `label` | text | název zobrazený uživateli |
| `group` | enum `cam` \| `drone` \| `shared` | ke kterému produktu patří |
| `cat` | enum `hw` \| `sw` \| `net` \| `ops` \| `lab` | kategorie pro barevný rozpad |
| `price` | numeric | cena v Kč, u driveru `pctHw` v procentech. Může být záporná (slevy). |
| `life` | integer \| null | životnost v měsících. Vyplněno = amortizuje se. |
| `billing` | enum `oneoff` \| `monthly` \| `yearly` | |
| `driver` | enum, viz níže | čím se násobí množství |
| `shared` | boolean | dělí se mezi všechny lokality v portfoliu |
| `prepay` | boolean | jen u `yearly`: platí se dopředu na celý rok, nebo vzniká průběžně |
| `enabled` | boolean | globálně zapnuto |
| `note` | text | poznámka |
| `sort` | integer | pořadí zobrazení |

**Drivery** určují množství:

| Driver | Množství |
|---|---|
| `site` | vždy 1 |
| `camera` | počet kamer na lokalitě |
| `pole` | počet sloupů |
| `dock` | počet dokovacích stanic |
| `km` | vzdálenost tam a zpět |
| `hour` | hodiny práce na instalaci |
| `trip` | u `yearly` počet výjezdů v roce 2+; u `oneoff` rozdíl `trips1 − trips2`, minimálně 0 |
| `pctHw` | vždy 1, ale částka se počítá jinak — viz výpočet |
| `qty` | ruční množství zadané u konkrétní lokality |

### Klient (`client`)

`id`, `name`, `contact`, `note`, `created_at`

### Lokalita (`location`)

`id`, `client_id`, `name`, `note`, `product` (`cam` \| `drone` \| `both`), `price` (měsíční cena klientovi v Kč), a vstupy pro drivery: `cameras`, `poles`, `docks`, `km`, `hours`, `trips1`, `trips2`.

Dále tři mapy, které umožňují odchylku od globálního katalogu jen pro tuhle lokalitu:

- `off` — `{ itemId: true }` — položka se na této lokalitě nezapočítává
- `over` — `{ itemId: number }` — přepsaná cena položky
- `qty` — `{ itemId: number }` — množství pro položky s driverem `qty`

Ulož je jako `jsonb`.

### Nastavení (`settings`, jeden řádek)

| Pole | Výchozí | Popis |
|---|---|---|
| `share` | true | sdílené položky dělit počtem lokalit |
| `prepay` | true | roční předplatky platit dopředu v měsíci 0 |
| `renew` | true | obnovovat hardware po konci životnosti |
| `tax` | 21 | sazba daně z příjmu PO v % |
| `horizon` | 36 | délka simulace v měsících |

---

## 3. Výpočetní jádro

Implementuj jako čistou funkci `calc(location, catalog, settings, locationCount)` v `lib/calc.ts`, bez závislosti na databázi ani na Reactu. Musí být volatelná ze serveru i z klienta.

### 3.1 Výběr položek

Položka se započítá, pokud platí všechno:

- `item.enabled === true`
- `location.off[item.id]` není `true`
- skupina odpovídá produktu: `group === 'shared'`, nebo `location.product === 'both'`, nebo `group === location.product`

### 3.2 Částka položky

```
cena     = location.over[item.id] ?? item.price
množství = podle driveru (viz tabulka výše)
částka   = cena × množství
pokud item.shared a settings.share:  částka = částka / počet lokalit v portfoliu
```

Položky s nulovým množstvím nebo nulovou částkou se vynechají.

**Položky s driverem `pctHw` se počítají až ve druhém průchodu**, protože potřebují znát hodnotu hardwaru:

```
hwValue = součet částek položek, kde billing === 'oneoff' a life není null
částka  = hwValue × cena / 100
```

Tyto položky se do `hwValue` samy nezapočítávají.

### 3.3 Rozdělení do skupin

```
capex   = oneoff  s vyplněnou life     → hardware, amortizuje se
startup = oneoff  bez life             → uvedení do provozu, jednorázový náklad
yearly  = yearly
monthly = monthly
```

Roční položky se dále dělí:

```
yearlyPre = yearly, kde prepay !== false   → předplatné, platí se dopředu
yearlyAcc = yearly, kde prepay === false   → vzniká průběžně (cesty, mzdy, rezerva, marketing)
```

**Tohle je nejčastější chyba a v původním excelu byla.** Cestovné a mzdy nejsou předplatné a nesmí zvyšovat vstupní investici.

### 3.4 Agregáty

```
amortMonthly = Σ (částka / life)  přes capex
monthlyCash  = Σ monthly + Σ yearly / 12
fullMonthly  = monthlyCash + amortMonthly
prepaid      = settings.prepay ? Σ yearlyPre : 0
day0         = Σ capex + Σ startup + prepaid
```

`fullMonthly` je cenová podlaha. Zobrazuje se jako hlavní číslo pro cenotvorbu.

### 3.5 Rozpad podle kategorií

Pro barevný pruh se sčítá měsíční ekvivalent podle `item.cat`: capex jako `částka / life`, yearly jako `částka / 12`, monthly přímo. Položky ze `startup` se do rozpadu nezahrnují.

### 3.6 Simulace hotovosti

```
baseOut = Σ monthly + Σ yearlyAcc / 12 + (prepaid ? 0 : Σ yearlyPre / 12)

flow[0] = −day0
pro m = 1..horizon:
    out = baseOut
    pokud prepaid a m > 1 a (m−1) % 12 === 0:
        out += Σ yearlyPre          // obnova předplatného
    pokud settings.renew:
        pro každou capex položku s life < horizon:
            pokud m > life a (m−1) % life === 0:
                out += částka        // výměna hardwaru
    flow[m] = flow[m−1] + location.price − out
```

Měsíce, ve kterých nastala obnova, si ulož do mapy `events` — v grafu se zobrazují jako svislé čáry.

### 3.7 Návratnost

```
záporné = indexy, kde flow[i] < 0
payback = (záporné není prázdné a max(záporné) < horizon) ? max(záporné) + 1 : null
```

Tedy **poslední měsíc se zápornou hotovostí plus jedna**, ne první přechod přes nulu. Rozdíl je zásadní: naivní výpočet dává u dronu 12 měsíců, správný 15, protože ve 13. měsíci přijde obnova předplatného a hotovost spadne zpátky pod nulu.

`payback === null` znamená buď že hotovost nikdy nebyla záporná, nebo že se investice v horizontu nevrátí. Rozliš to podle znaménka `flow[horizon]`.

### 3.8 Marže

```
profit = location.price − fullMonthly
margin = location.price > 0 ? profit / location.price : 0
```

Barevné prahy: zelená od 40 %, oranžová od 20 %, jinak červená.

---

## 4. Kontrolní hodnoty

Napiš na tyhle případy testy. Musí sedět na jednotky korun.

### Případ A — dron, jedna lokalita v portfoliu

Výchozí katalog ze `catalog-seed.json`, výchozí nastavení, jedna lokalita v celém portfoliu:

```json
{ "product":"drone", "cameras":0, "poles":0, "docks":1,
  "km":260, "hours":8, "trips1":10, "trips2":8, "price":50000 }
```

| Veličina | Hodnota |
|---|---|
| `day0` | 521 565 Kč |
| `monthlyCash` | 14 930,68 Kč |
| `amortMonthly` | 10 447,66 Kč |
| `fullMonthly` | 25 378,35 Kč |
| `payback` | 15 |
| `flow[36]` | 720 684 Kč |
| `margin` | 0,4924 |
| `events` | `{13:[předplatky], 25:[předplatky, baterie], 31:[dron]}` |

Dílčí kontroly: capex 382 944, startup 25 000, yearly celkem 161 168, z toho předplacené 113 621 a průběžné 47 547, monthly 1 500.

### Případ B — kamery, dvě lokality v portfoliu

Stejný katalog, v portfoliu jsou dvě lokality (sdílené položky se dělí dvěma):

```json
{ "product":"cam", "cameras":5, "poles":3, "docks":0,
  "km":260, "hours":8, "trips1":2, "trips2":2, "price":18000 }
```

| Veličina | Hodnota |
|---|---|
| `day0` | 64 791 Kč |
| `monthlyCash` | 2 460,44 Kč |
| `amortMonthly` | 1 517,58 Kč |
| `fullMonthly` | 3 978,02 Kč |
| `payback` | 5 |

### Případ C — hraniční stavy

- Lokalita bez jediné položky: všechna čísla 0, `payback` null, žádné dělení nulou.
- `price = 0`: `margin` je 0, ne `NaN` ani `Infinity`.
- Položka s driverem `pctHw` na lokalitě bez hardwaru: částka 0.
- Vypnutí položky přes `off` a přepsání ceny přes `over` musí měnit výsledek a nesmí ovlivnit ostatní lokality.

---

## 5. Stránky

Levý svislý navigační panel s logem, uprostřed obsah. Dole v panelu přepínač aktivní lokality, který je společný pro celou aplikaci.

### 5.1 Kalkulace (výchozí stránka)

Hlavní obrazovka. Pro aktivní lokalitu:

- Čtyři velká čísla: jednorázově při spuštění, měsíčně hotovost, amortizace hardwaru, plný měsíční náklad.
- Barevný pruh s rozpadem plného měsíčního nákladu podle kategorií a legendou v procentech.
- Konfigurace: přepínač produktu, počty kamer, sloupů a stanic pomocí tlačítek plus a minus, vzdálenost, hodiny práce, výjezdy v roce 1 a v roce 2+.
- Cena klientovi jako pole i posuvník, pod tím marže, měsíční zisk, návratnost a kumulativ za horizont včetně částky po zdanění.
- Graf kumulativní hotovosti za celý horizont. Nulová osa, vyznačené měsíce s obnovou, bod návratnosti.
- Tabulka rozpadu položek. U každé přepínač zapnutí pro tuhle lokalitu, množství, cena za lokalitu (editovatelná, zapisuje do `over`) a měsíční ekvivalent. Vypnuté položky v samostatné sekci na konci.
- Blok upozornění, který se objeví jen když je co říct. Kontroly: cena pod plným nákladem; méně než 1,5 kamery na sloup; zapnuté dvě navzájem výlučné platformy zároveň; návratnost za hranicí sjednaného závazku.

Změna kterékoli hodnoty se okamžitě propíše do všech čísel a uloží na server.

### 5.2 Katalog nákladů

Tabulka všech položek s filtrem podle skupiny a fulltextem. Cena je editovatelná přímo v řádku. U každé položky přepínač zapnutí, tlačítka upravit a smazat. Nahoře tlačítko pro přidání položky.

Dialog položky obsahuje všechna pole z datového modelu včetně vysvětlivky u driveru a u příznaku „platí se dopředu".

Smazání položky musí uklidit odkazy na ni ve všech mapách `off`, `over` a `qty` u všech lokalit.

### 5.3 Klienti a lokality

Karta na každého klienta, v ní tabulka jeho lokalit s produktem, vstupní investicí, plným nákladem, cenou a marží. Tlačítka pro založení a úpravu klienta i lokality, přepnutí na kalkulaci dané lokality a mazání s potvrzením.

### 5.4 Přehled

Souhrn portfolia: počet lokalit a klientů, celková vstupní investice, celková měsíční tržba proti celkovému plnému nákladu, marže portfolia.

Pod tím tři tabulky podle skupin — Sky Cam, Sky Guard, Společné — se všemi položkami katalogu, kde jde přímo editovat cena a životnost. Tohle je rychlá cesta k aktualizaci ceníku po nové nabídce od dodavatele.

### 5.5 Srovnání lokalit

Jedna tabulka se všemi lokalitami portfolia a součtovým řádkem. Kliknutí na řádek přepne aktivní lokalitu a přejde na kalkulaci.

### 5.6 Nastavení

Přepínače a hodnoty z modelu nastavení. Dále export celé databáze do JSON, import ze zálohy, obnovení katalogu do výchozího stavu a smazání všech dat. Každá destruktivní akce s potvrzením.

---

## 6. Design

Aplikace má vypadat jako součást značky Sky Guard, ne jako obecný dashboard.

**Barvy** — tmavá tmavomodrá základna, ne černá a ne šedá:

```
--void   #05090f    nejtmavší, navigační panel
--bg     #080e18    pozadí obsahu
--panel  #0d1624    karty
--raise  #16243a    zvýšené prvky
--line   #1b2b42    linky a okraje
--tx     #e9f0fa    text
--tx-2   #94a9c6    sekundární text
--tx-3   #5d738f    popisky
--blue   #3b8fff    akcent
--green  #3ddc97    kladné hodnoty
--amber  #f5b544    upozornění
--red    #ff6b6b    záporné hodnoty
--violet #8b7cf6    kategorie software
--pink   #ff8ba7    kategorie práce
```

**Písmo** — DM Sans na všechno. Saira Stencil One výhradně na názvy stránek v horní liště, protože stejný stencil nese logo. Nikam jinam stencil nedávej, je nečitelný v malých velikostech.

**Čísla** — vždy `font-variant-numeric: tabular-nums`, aby se v tabulkách zarovnala. Formátování `cs-CZ`, mezera jako oddělovač tisíců, měna „Kč" za číslem. Nad 100 000 Kč se v souhrnech zkracuje na tisíce.

**Logo** — soubory v `assets/`. Bílá verze na tmavém pozadí. Nepřebarvuj ho, nedávej na něj efekty a needituj ho.

**Pohyb** — jen jako reakce na akci uživatele. Žádné animace při načtení stránky.

Aplikace musí být použitelná na mobilu, protože se do ní bude koukat u klienta. Na úzké obrazovce se navigační panel překlopí do vodorovné lišty nahoře.

---

## 7. Co nedělat

- Nezveřejňovat repozitář. Jsou v něm nákupní ceny hardwaru.
- Nedávat do jakéhokoli výstupu pro klienta značky ani modelová označení výrobce dronu. Hardware se pojmenovává obecně, jak je v seed datech.
- Nepřepisovat výpočetní pravidla podle vlastního uvážení. Pokud ti něco přijde matematicky sporné, napiš to a zeptej se, ale neměň to sám.
- Nepředělávat existující Vercel projekt s webem sky-guard.cz.

---

## 8. Co ještě chybí a hodí se doplnit

Není součástí zadání, ale připrav model tak, aby to šlo přidat bez přestavby:

- Export nabídky do PDF pro klienta, tedy bez nákupních cen, jen s výslednou měsíční cenou a rozsahem služby.
- Historie cenových nabídek a jejich verzí.
- Inflace u ročních položek, protože software zdražuje 5 až 7 % ročně.
- Zohlednění minimální doby závazku. Vstupní investice u dronu je přes půl milionu a návratnost 15 měsíců, takže délka kontraktu je klíčový obchodní parametr.
- Přenositelnost hardwaru mezi lokalitami při odchodu klienta.
