# Sky Guard — web a Hub

Jeden repozitář, jedno nasazení na Vercelu (www.sky-guard.cz):

| Část | Kde | Co |
|---|---|---|
| **Veřejný web** | `public/` | statický export z Frameru + vlastní skripty (`carousel.js`, `faq.js`, `i18n.js`, `script.js`). Adresy zůstávají (`/`, `/images/...`). Čisté adresy, které dřív dělal `cleanUrls`, obstarávají rewrites v [next.config.ts](next.config.ts). |
| **Sky Guard Hub** | `app/hub/`, `components/`, `lib/` | interní kalkulačka nákladů a cen (Next.js 16). Všechny stránky žijí pod `/hub`, brána [proxy.ts](proxy.ts) chrání jen tento prefix. |

Veřejný web z kódu pod `/hub` nic neimportuje — jsou to statické soubory.
Tlačítko „Sky Guard Hub" na webu vede na `/hub`; nepřihlášeného pošle brána
na `/hub/prihlaseni`.

**Repozitář je privátní a musí takový zůstat — kalkulačka obsahuje nákupní
ceny hardwaru.**

Prefix `/hub` se skládá na jednom místě, v [lib/hub-path.ts](lib/hub-path.ts).
`basePath` v Next se nepoužívá: aplikoval by se i na `public/` a rozbil
veřejné adresy.

### Preview bez databáze

Preview deploymenty schválně nemají přístup k produkčním datům. Když chybí
`DATABASE_URL`, brána přepne všechno pod `/hub` na stránku „Hub není v náhledu
dostupný" a veřejný web běží dál. Databázi má jen Production.

---

## Sky Guard Hub — kalkulačka nákladů a cen

Interní nástroj pro dva jednatele. Stanovuje měsíční cenu služby pro klienta
podle skutečných nákladů lokality a počítá, za jak dlouho se vrátí vstupní
investice.

**Repozitář je privátní a musí takový zůstat — jsou v něm nákupní ceny hardwaru.**

Zadání je v [SPEC.md](SPEC.md), referenční implementace v
[reference/prototyp.html](reference/prototyp.html).

### Jak to funguje

- **Next.js 16** (App Router), TypeScript, Tailwind v4
- **Neon Postgres** přes Vercel Marketplace, **Drizzle ORM**
- Zápisy jdou výhradně přes **Server Actions**, žádné vlastní REST API
- Přístup má **každý vlastní účet**, brána nad celou aplikací pod `/hub` je
[proxy.ts](proxy.ts) (v Next 16 nová podoba `middleware.ts`)

#### Přístup a role

Hesla jsou argon2id ([lib/auth/password.ts](lib/auth/password.ts)). Session je
**řádek v databázi**, cookie nese jen její neprůhledné id — podepsaná cookie
se nedá vzít zpět, takže by tlačítko „ukončit session" bylo kosmetika.

**Session se ověřuje v bráně, při každé navigaci.** Ne v layoutu: ten se při
klientském přechodu mezi stránkami pod ním znovu nevykresluje, takže kontrola
v něm by proběhla jen při prvním načtení a při tvrdém reloadu. Uživatel se
zneplatněnou session by mohl klikat dál. RSC požadavky při klientské navigaci
jdou přes bránu taky. Nic se mezi požadavky necachuje — zneplatnění platí hned.

| Role | Co vidí |
|---|---|
| `admin` | všechno včetně Admin centra a sekce Finance |
| `member` | kalkulace, klienti, katalog, nabídky |

Skrytí položky v navigaci je pohodlí, ne ochrana. **Každá server action prochází
obálkou** `withUser`, `withAdmin` nebo `publicAction`
([lib/auth/guards.ts](lib/auth/guards.ts)). Obálka nechá na funkci značku a
[tests/auth-guards.test.ts](tests/auth-guards.test.ts) projde všechny exporty
a ověří, že žádný nezůstal bez ní — zapomenutá stráž shodí test, ne až produkci.
Kontrola je strukturální, ne hledáním v textu.

Dvě pravidla drží přístup pohromadě a obojí je otestované: **posledního
aktivního admina** nejde deaktivovat, degradovat ani smazat, a **nikdo nesmí
na sebe sama**. Obojí je cesta, jak se nevratně zamknout z vlastní aplikace.

Přihlášení se po **pěti neúspěších za 15 minut** na dvojici e-mail + IP zamkne
na 15 minut. Sama IP by zamkla celou kancelář za jedním NAT kvůli překlepu,
samotný e-mail by dovolil komukoli zvenčí zamknout jednateli účet.

Audit log je **jen k připisování**. V aplikaci neexistuje akce, která by z něj
mazala, a tabulka schválně nemá cizí klíč na uživatele — s ním by smazání účtu
buď zápis odmítlo, nebo přepsalo historické řádky.

#### První spuštění a nouzová cesta

Nad prázdnou databází vznikne admin z `BOOTSTRAP_ADMIN_EMAIL` a
`BOOTSTRAP_ADMIN_PASSWORD`, s vynucenou změnou hesla. Bootstrap běží jen když
**nejsou žádní uživatelé a zároveň je prázdný příznak `bootstrapUsedAt`**;
ten se nastaví při prvním úspěšném přihlášení. Kontrolovat jen prázdnou tabulku
by nestačilo — po smazání posledního admina by bootstrap ožil.

Aplikace **neposílá e-maily** a žádná služba na to není. Dočasná hesla předává
správce osobně; ukazují se v Admin centru právě jednou.

Když se správce zamkne a druhý neexistuje, je **jediná** cesta zpět tenhle
skript. Vyžaduje `DATABASE_URL`, tedy přístup k produkčnímu tajemství, ne
jen k webu:

```bash
npm run admin:reset-password -- jan@sky-guard.cz
```

Nastaví dočasné heslo, účet odemkne, ukončí jeho session a zapíše se do
audit logu jako akce systému.

#### Výpočetní jádro

[lib/calc.ts](lib/calc.ts) je čistá funkce bez jediné závislosti — nezná
databázi ani React a volá se stejně ze serveru i z klienta. Díky tomu se čísla
v UI přepočítávají okamžitě při psaní a na server jde jen uložení.

Jádro musí na stejném vstupu dávat stejné výsledky jako prototyp.
Hlídají to testy v [tests/calc.test.ts](tests/calc.test.ts) podle sekce
„Kontrolní hodnoty“ ve specifikaci. Testy běží proti čistým objektům,
nikdy proti databázi.

```bash
npm test
```

#### Peníze v databázi

Peněžní sloupce jsou `double precision`, ne `numeric`. Kontrolní hodnoty
vznikly v JavaScriptu v double a `numeric` se z driveru vrací jako řetězec,
který by se musel parsovat — u sazeb jako 10,33 Kč/km by tam vznikla odchylka.

#### Seed

[lib/db/seed-core.ts](lib/db/seed-core.ts) plní katalog **jen když je tabulka
prázdná**. Ceny, které někdo ručně upravil, jsou nejcennější obsah aplikace
a žádný deploy je nesmí přepsat. Vrácení do výchozího stavu je vědomá akce
v Nastavení.

Katalog se načítá z jediného souboru [reference/catalog-seed.json](reference/catalog-seed.json)
— sahá do něj plnicí skript i testy, aby se nemohly rozejít.

#### Typy kamer

`cameras` na lokalitě znamená **pouze bezpečnostní kamery**. Časosběrné mají
vlastní pole `camerasTlBig` a `camerasTlSmall`. Podle toho jsou i drivery:

| Driver | Množství |
|---|---|
| `camera` | jen bezpečnostní — mezikus, průchodka |
| `cameraAll` | všechny kamery — backplate, instalační materiál, paměťová karta |
| `tlBig`, `tlSmall` | příslušný typ časosběrné |

Časosběrné kamery nemají mezikus ani průchodku, ale backplate, materiál
a paměťovou kartu ano. Změna je zpětně kompatibilní: dokud jsou obě
časosběrná pole nula, `cameraAll` se rovná `cameras` a kontrolní hodnoty
ze SPEC §4 platí beze změny — hlídá to
[tests/timelapse.test.ts](tests/timelapse.test.ts).

Aktualizace existující databáze na nové drivery a položky je vědomý krok,
protože seed plní jen prázdnou tabulku:

```bash
npm run db:load-production
```

Skript je idempotentní, nepřepisuje ručně upravené ceny a testovací data maže
jen s příznakem `--smazat-testovaci`.

#### Inflace, zbytková hodnota a délka kontraktu

**Inflace ročních položek** je parametr v Nastavení s výchozí nulou. Aplikuje
se od druhého roku, `částka × (1 + sazba)^(rok−1)`, a do `fullMonthly` vstupuje
**průměr přes horizont**, ne hodnota prvního roku. Výchozí nula je záměr:
kontrolní hodnoty ze SPEC §4 mají chytat nechtěnou změnu chování jádra, takže
je plánované rozšíření nesmí rozbít. Novou sadu testů má inflace vlastní.

Položky s driverem `pctHw` se **neinflatují**. Rezerva na opravy je procento
z hodnoty hardwaru, ne korunová částka — kdyby zdražovala, rostla by rychleji
než majetek, ze kterého se počítá.

**Zbytková hodnota hardwaru** ([lib/residual.ts](lib/residual.ts)) je záměrně
mimo `calc` — do hotovosti, marže ani návratnosti nevstupuje. Výchozích 40 %
je **odhad, ne měřená hodnota**; upraví se, až bude první stanice reálně
odstavená. Koeficient je nízký schválně: dokovací stanice je vázaná na povolení
konkrétní lokality, takže přesun jinam znamená celé nové povolovací kolo.
Záporné položky (sleva dealera) se nezaokrouhlují na nulu — kdyby ano,
zůstatek by se tiše nafoukl o jejich podíl.

**Stránka Délka kontraktu** počítá ekonomiku pro délky 24 až 72 měsíců.
Pozor na rozdíl mezi lokálním a globálním optimem: vstupní investice se
rozpouští do počtu měsíců, takže delší kontrakt vyhrává skoro vždycky.
Zajímavá jsou **lokální optima, která leží vždy měsíc před velkou obnovou** —
tam jsi ji ještě nezaplatil. Stránka proto ukazuje dvě čísla: doporučení do
48 měsíců pro jednání a vedle toho konkrétní údaj, o kolik procent je nejdelší
varianta lepší.

#### Nabídky a PDF

Nabídka je **neměnný snímek**. Při vzniku se do ní uloží konfigurace lokality,
celý katalog, nastavení i spočítaný výsledek. Pozdější změna cen v katalogu
s odeslanou nabídkou nehne — [tests/offer.test.ts](tests/offer.test.ts) to
ověřuje přesně tímhle scénářem.

Nová verze se **nepočítá z předchozí nabídky, ale z aktuálního stavu lokality**.
Z minulé verze se přebírá jen text rozsahu, poznámka a doba závazku; ekonomika
je vždy čerstvá, jinak by vznikla nabídka se starými čísly a novým datem.

PDF se generuje přes `@react-pdf/renderer` v Server Action a vrací se jako
base64. Šablona dostane jen [`OfferDocumentData`](lib/offer-types.ts) — typ,
ve kterém nákladová pole, ceny katalogu, marže ani návratnost **neexistují**.
Únik interních dat tak není otázka pozornosti při psaní šablony, ale typu.

Co se do klientského výstupu nesmí dostat, je v
[lib/pdf/forbidden-terms.ts](lib/pdf/forbidden-terms.ts). Přibyl dodavatel nebo
model? Přidej ho tam a CI ho začne hlídat.
[tests/pdf-content.test.ts](tests/pdf-content.test.ts) generuje skutečné PDF,
vytáhne z něj text a kontroluje ho ve třech vrstvách: zakázané výrazy, nákupní
ceny z katalogu a **whitelist částek** — v dokumentu nesmí být jiná částka než
ta, kterou generuje šablona nebo kterou si autor napsal do volného textu.

#### Finance — bankovní výpisy

Samostatná sekce vedle kalkulačky. Nahraje se CSV výpis z Raiffeisenbank,
transakce se zařadí do účetních kategorií podle pravidel a stránka Přehled
financí ukáže, za co a kolik se utrácí. **S modelem kalkulačky zatím nemá
vazbu** — kategorie jsou účetní, ne modelové, protože výpis obsahuje spoustu
věcí, které v modelu nejsou (daně, odvody, bankovní poplatky).

**Parser** ([lib/bank/rb-csv.ts](lib/bank/rb-csv.ts)) je čistá funkce jako
`calc.ts`, takže běží i v prohlížeči — náhled před uložením se počítá tam a na
server nejde nic, dokud uživatel nepotvrdí. Při potvrzení se posílá **text
výpisu, ne hotové řádky**; server si ho parsuje znovu a klientovi nevěří.

Sloupce se hledají **podle názvu v hlavičce**, ne podle pozice. Banka může
přidat sloupec nebo změnit pořadí, aniž by to import rozbilo. Kódování se
pozná samo: UTF-8 je samoopravný kód, takže co jím projde, je UTF-8, a co ne,
je windows-1250.

**Co parser nepřečte, nahlásí — nikdy nezahodí.** Řádek s rozbitým datem nebo
useknutý řádek se do součtu nedostane a objeví se v náhledu s číslem řádku
a důvodem. Tiše sníženému součtu výdajů nikdo nepřijde na kloub.

**Duplicitu odmítá unikátní index v databázi, ne kontrola v kódu.** Dva
překrývající se výpisy nahrané naráz by obě kontroly minuly — obě čtení
proběhnou dřív, než první zapíše. Klíč je `(účet, dedupe_key)`; primárně se
skládá z id transakce od banky, a když ho výpis nemá, z data, částky,
protiúčtu, VS a otisku zbytku řádku. Dvě opravdu shodné platby v jednom
souboru se přitom uloží obě — rozliší je pořadové číslo, takže druhé nahrání
téhož výpisu je pořád pozná jako duplicitu.

**Ruční zařazení pravidlo nikdy nepřepíše** ([lib/bank/categorize.ts](lib/bank/categorize.ts)).
Transakce si nese, jestli ji zařadil člověk, nebo pravidlo, a přepočet sahá jen
na to druhé. Vyčištění kategorie znamená vrátit transakci pravidlům — na
„natrvalo mimo" je kategorie *Ignorovat*.

Pravidla se vyhodnocují **shora dolů podle priority a vyhrává první vyhovující**,
ne nejpřesnější. Pořadí je vidět a dá se přepsat; „nejlepší shoda" je černá
skříňka, u které nikdo nepozná, proč platba spadla jinam, než čekal.

**Poplatek ze sloupce „Poplatek" se do výdajů nepřičítá**, je vidět zvlášť.
Banky ho většinou strhávají samostatnou transakcí, která ve výpisu stojí vedle,
takže přičtením by se započítal dvakrát.

Druh kategorie rozhoduje, kam částka vstupuje: *výdaj*, *příjem*, *převod mezi
účty* a *ignorovat*. Převod mezi vlastními účty nesmí do výdajů — jinak by se
přesun peněz tvářil jako útrata a součet by lhal směrem nahoru.

Kategorie a startovní pravidla se plní **jen do prázdné tabulky**, stejně jako
katalog. Co si jednatel přejmenoval nebo smazal, se dalším deployem nevrátí.

Každá transakce si nese **původní řádek výpisu** sloupec po sloupci. Do seznamu
se netahá — u tisíců transakcí je to zbytečný přenos — ale v detailu je celý
a syrový. Když se někdo diví, proč platba spadla do téhle kategorie nebo proč
má tuhle částku, je to jediné místo, kde jde dohledat, co přesně banka poslala,
bez otevírání CSV v editoru. V detailu je i interní poznámka.

Seznam transakcí vykresluje **200 řádků naráz** a kolik jich je skryto, říká
nahlas. Za pár let provozu jsou jich přes deset tisíc a stejně dlouhý DOM trhá
i při obyčejném rolování; seznam, který mlčky končí na dvoustovce, přitom
vypadá jako úplný.

Záloha z Nastavení finanční sekci obsahuje (verze 2). **Obnova starší zálohy
verze 1 bankovní data nesmaže** — chybějící sekce znamená „nedotýkat se",
ne „vymazat".

V Nastavení jde smazat bankovní výpisy zvlášť od dat kalkulačky. **Kategorie
a pravidla to nechává být** — je to nastavení, které se pracně ladí, a po
vymazání dat se hodí znovu.

#### Ukládání změn

Psaní do políčka se sdružuje (debounce 500 ms) a fronta se vyprázdní na
`visibilitychange` a `pagehide`, aby se poslední změna neztratila při zavření
tabu. Zapisují se **jen změněná pole**, ne celý objekt lokality — dva lidé
pracující současně si tak nepřepíšou to, do čeho nesáhli. Mapy `off`, `over`
a `qty` se mění po jednom klíči přímo v SQL.

#### Aktivní lokalita

Je v cookie prohlížeče, ne v databázi. Je společná napříč stránkami, ale ne
napříč lidmi — jinak by přepnutí u jednoho jednatele přehodilo obrazovku
druhému uprostřed práce.

### Lokální vývoj

Lokální databáze je PGlite vystavené přes socket, takže se k ní aplikace
připojuje úplně stejně jako k Neonu. Nepotřebuje Docker ani nainstalovaný
Postgres. Zvládne **jedno spojení naráz**, takže vedle běžícího dev serveru
do ní nejde psát druhým procesem — na migrace server nejdřív zastav.

```bash
npm install
npm run db:local     # v prvním terminálu, databáze na portu 5433
npm run db:migrate   # migrace + naplnění katalogu
npm run dev          # v druhém terminálu
```

`.env.local`:

```
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5433/postgres
BOOTSTRAP_ADMIN_EMAIL=jan@sky-guard.cz
BOOTSTRAP_ADMIN_PASSWORD=libovolne-dlouhe-heslo
```

### Skripty

| Příkaz | Co dělá |
|---|---|
| `npm run dev` | vývojový server |
| `npm test` | testy jádra, inflace, zbytkové hodnoty, délky kontraktu, citlivosti, seedu, záloh, migrací, brány, nabídek, obsahu PDF, parseru výpisů a zařazování |
| `npm run db:local` | lokální vývojová databáze |
| `npm run db:generate` | vygeneruje migraci ze změn schématu |
| `npm run db:migrate` | spustí migrace a idempotentní seed |
| `npm run db:seed` | jen seed, bez migrací |
| `npm run admin:reset-password -- e-mail` | nouzový reset hesla mimo aplikaci |

### Proměnné prostředí

| Proměnná | K čemu |
|---|---|
| `DATABASE_URL` | připojení k Postgresu. Vercel Marketplace ho nastaví sám. |
| `BOOTSTRAP_ADMIN_EMAIL` | e-mail prvního správce. Po prvním přihlášení se dá smazat. |
| `BOOTSTRAP_ADMIN_PASSWORD` | jeho dočasné heslo. Aplikace si hned vyžádá změnu. |


Proměnné `BOOTSTRAP_ADMIN_*` slouží **jen k založení prvního správce**. Po jeho
prvním přihlášení se příznak `bootstrapUsedAt` uzavře a proměnné se dají
smazat — dál už na nic nemají vliv. Aplikace si při prvním přihlášení stejně
vyžádá nové heslo, takže heslo z nastavení Vercelu v aplikaci nezůstane.

Když `BOOTSTRAP_ADMIN_*` chybí a v databázi není žádný uživatel, aplikace
**nepustí nikoho** a řekne proč. Fail-closed.

### Nasazení

#### Po každém deployi, který mění schéma databáze

**Migrace se nepouštějí při buildu. Musíš je spustit ručně.** Je to schválně:
selhaná migrace tak neshodí deploy a build nesahá do produkčních dat. Ale
znamená to, že po změně v `lib/db/schema.ts` je tohle první, co uděláš —
jinak nasazená aplikace narazí na chybějící sloupec.

```bash
vercel env pull .env.production.local --environment=production
DATABASE_URL="$(grep -m1 '^DATABASE_URL=' .env.production.local | cut -d= -f2- | tr -d '\"')" npm run db:migrate
rm .env.production.local
```

Skript je idempotentní: migrace, které už proběhly, přeskočí, a katalog naplní
jen nad prázdnou tabulkou. Když se schéma nezměnilo, nic se nestane.

Změna schématu má tedy pořadí: `npm run db:generate` → commit migrace →
deploy → `npm run db:migrate` proti produkci.

#### Databáze a preview deploymenty

Produkční databáze je připojená **jen k produkčnímu prostředí**. Preview
deploymenty k ní nemají přístup schválně, aby žádná větev nezapisovala do
ostrých dat. Když bude potřeba preview otestovat proti datům, založ zvlášť
databázi pro preview prostředí.

#### Proměnné prostředí

`DATABASE_URL` nastaví Vercel Marketplace sám při napojení Neonu.
`BOOTSTRAP_ADMIN_EMAIL` a `BOOTSTRAP_ADMIN_PASSWORD` se přidávají ručně
před prvním nasazením verze s účty.

### CI

[GitHub Actions](.github/workflows/ci.yml) pouští na každý push do `main`
a na každý pull request testy, lint a build. Build schválně neběží proti
databázi ani nepotřebuje tajemství — spojení se navazuje až při prvním dotazu.

### Co do výstupu pro klienta nepatří

- značky ani modelová označení výrobce dronu — hardware se pojmenovává obecně,
  jak je v seed datech
- nákupní ceny z katalogu

Záloha z Nastavení je interní soubor pro jednatele, ne podklad pro klienta.
