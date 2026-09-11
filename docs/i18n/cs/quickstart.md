# Rychlý start

Lolly mění tvá pravidla - barvy, písmo, rozvržení, logiku - na nástroje, se kterými kdokoli vytvoří hotové soubory: obrázky, PDF, sociální karty, video, prostým vyplněním pár polí. Není se co učit a nic se nenahrává: tvorba i export běží na tvém zařízení, online i offline.

Tohle je stránka, kterou si přečti jako první. K produktivitě tě dostanou dvě věci: **udělej si Lolly svým** a **přines si, co už máš** (své návrhové soubory a tokeny). Všechno ostatní je jen odkaz daleko.

> Jsi v Lolly nový a chceš si jen něco vytvořit? [Vytvoř něco za 60 sekund](/info/make-something.html) tě provede třemi věcmi, nebo [otevři aplikaci](/#/), vyber z galerie libovolný nástroj, vyplň políčka a klikni na **Export**. Vrať se sem, až budeš chtít, aby to neslo *tvou* značku.

![Zobrazení Utility - tahouni běžící přímo na zařízení, jako Odstranění skrytých dat, Komprese PDF a Převést obrázek, všichni na jednom místě](/t/url-shot?url=%2F%23%2Fu&width=1440&height=900&dpi=192&waitMs=1600&css=.welcome-dialog%2C.personalize-nudge%7Bdisplay%3Anone!important%7D&tolerance=0.03&format=svg&walker=1&dark=1&filename=use-utilities&try=1)

## 1. Udělej si to po svém - nastav svůj systém designu

Tvá značka je v Lolly malý dokument s **design tokeny** - barvy, písma a pár pravidel - podle kterého vykresluje každý nástroj. Nastavíš ji jednou a všechno, co vytvoříš, je v souladu se značkou už ze své podstaty, ne díky kontrole. Vedou k tomu tři cesty; vyber tu, která odpovídá tomu, kde tvá značka už dnes žije.

### Začni od nuly (průvodce tvorbou systému designu)

Při prvním spuštění se ocitneš v **galerii** a přes ni je krátký uvítací dialog se třemi cestami dovnitř - **Udělej si to po svém** (Brand Studio na `#/start`), **Přines svůj design** (přetáhni soubor z Figmy, Penpotu, InDesignu nebo PDF a otevře se jako editovatelné rozvržení - nejrychlejší cesta k [Přines si, co už máš](#2-bring-in-what-you-already-have) níže) a **Prozkoumat nástroje komunity** - a k tomu řádek jazyků, pokud angličtina není ta tvá. Vezmi první kartu a přistaneš v [**Brand Studiu**](/info/brand-studio.html). Zadej název a primární barvu a Lolly z nich *odvodí* kompletní, přístupnou paletu - světlé/tmavé plochy, text, akcenty - pomocí stejné barevné matematiky, kterou engine používá všude jinde.

![Místnost Barvy v Brand Studiu - primární barva a přístupná paleta, kterou z ní Lolly odvodí](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor&width=1440&height=740&dpi=192&waitMs=1800&format=svg&walker=1&localize=1&dark=1&filename=brand-colours) Vyber písmo a za necelou minutu máš funkční značku. Odtud tě šest místností studia - Přehled, Barvy, Písmo, Loga, Tokeny, Soubory - pustí tak daleko, jak chceš, v libovolném pořadí, a cokoli z toho můžeš doladit, kdykoli se vrátíš. Záložka **Systém designu** v přehledu (`#/d`) ukazuje výsledek jen ke čtení a odkazuje zpět na `#/start`, kde se edituje (pokud nejsi na sestavení Lolly se zamčenou značkou, kde je značka pevně daná a není co měnit).

### Importuj značku, kterou už máš

Pokud je tvá značka už zachycená jako design tokeny - z **Penpotu**, **Tokens Studia** (Figma) nebo z jakéhokoli obyčejného souboru **DTCG** - přenes ji celou, místo ručního přepisování. Vedou k tomu dvě cesty:

- <!--i:palette--> **V aplikaci:** [průvodce tvorbou systému designu: Brand Studio](/info/brand-studio.html) (`#/start`) ji přijme přes **Add from…** dole na liště místností - soubor s tokeny, export z Penpotu, SVG nebo balíček `LollyBrand`. Přetáhni ho dovnitř a paleta se rozsvítí.
- <!--i:code--> **Z příkazové řádky** pro vytvoření znovupoužitelného balíčku značky:

```bash
# a monolithic tokens.json, a one-file-per-set directory, or a Penpot project archive
npm run ingest:brand -- ./my-tokens.json --name acme --label "Acme" --activate
```

`ingest:brand` přijímá všechny tři kontejnery, ve kterých Penpot / Tokens Studio exportují tentýž dokument - jediný soubor `tokens.json`, adresář (`$metadata.json` + soubory po jednotlivých sadách) nebo archiv `project.penpot`. S `--activate` registruje značku jako profil, přepne se na ni a znovu sestaví katalog. Viz [Konfigurace](/info/configuration.html), jak spolu balíčky značek a profily souvisí.

### Dolaď ji v aplikaci

Jakmile je značka aktivní, tvaruj ji dál v [**Brand Studiu**](/info/brand-studio.html) (`#/start`) - změníš barvu nebo roli a každý náhled v aplikaci se aktualizuje při psaní. (Záložka **Systém designu** v přehledu na `#/d` značku jen *ukazuje*; edituje se ve Studiu.)

![Záložka Systém designu v přehledu - aktivní značka zobrazená jen ke čtení](/t/url-shot?url=%2F%23%2Fd%3Ftab%3Dbrand&width=1440&height=900&dpi=192&waitMs=1800&format=svg&walker=1&localize=1&dark=1&filename=dashboard-brand) Stejná značka je shrnutá na kartě **Profil → Tvoje značka**. Písma jsou opravdová: vyber si z Google Fonts a Lolly uloží soubor **na tvém zařízení** jako součást značky, takže tvé písmo funguje i offline a při renderování se nic nestahuje.

Až budeš spokojený, **exportuj značku jako balíček `LollyBrand`** - jediný soubor, který kolega může importovat a získat naprosto stejnou paletu, písma a pravidla. Takhle se značka přesouvá mezi lidmi a stroji bez serveru uprostřed.

> **Tokeny značky fungují obousměrně.** Protože značka Lolly *jsou* tokeny DTCG - formát, který Penpot nativně čte i zapisuje a Tokens Studio přináší do Figmy - paleta, se kterou *navrhuješ*, a paleta, kterou Lolly *vynucuje*, jsou jeden a tentýž dokument, ne dva seznamy, které ručně udržuješ v souladu. Viz [Design tokeny](/info/design-tokens.html).

## 2. Přines si, co už máš

Nezačínáš od prázdné stránky. Lolly otevírá návrhářskou práci a otevřené formáty, které už vlastníš.

### Otevřené návrhové soubory

Hotová práce z **Figmy, Penpotu, Illustratoru, InDesignu nebo jakékoli aplikace pro SVG** nemusí zůstat uzamčená v aplikaci, ve které vznikla. Otevři **Design**, klikni na **Importovat design** a soubor se otevře jako *živé rozvržení* - ne jako zploštělý obrázek. Z každé vrstvy se stane editovatelný box: text zůstává přepisovatelný, tvary zůstávají tvary, obrázky se uloží do tvé knihovny a složitá vektorová grafika se zachová věrně. Vše dorazí už přizpůsobené písmům a barevným pravidlům tvé značky.

| Co máš | Jak to přinést |
|---|---|
| Rám z Figmy | Nativní `.fig` (File → Save local copy) nebo export do SVG |
| Návrh z Penpotu | Jeho export `.penpot` nebo jakékoli SVG |
| Soubor z Illustratoru | Nativní `.ai` (kompatibilní s PDF) nebo `.pdf` - otevře se přímo |
| Rozvržení z InDesignu | `.idml` (File → Export → InDesign Markup) |
| Cokoli jiného | **Jakékoli SVG** - univerzální dveře dovnitř |

Celý import probíhá **na tvém zařízení** - soubor se zpracuje v tvém prohlížeči a nic se nenahrává. Všechny podrobnosti, a přesně co se přenese, najdeš v [Import návrhu](/info/design-import.html).

Máš místo toho **prezentaci v PowerPointu**? Přetáhni `.pptx` na **Tvůrce prezentací** a uprav ji snímek po snímku, rovnou srovnanou s tvou značkou - nebo spusť **Rebrandovat prezentaci** a dostaneš tutéž prezentaci zpátky s novým vzhledem, s grafy i animacemi netknutými.

### Od jednorázovky k šabloně

A tady je ten zisk: importované rozvržení je obyčejná relace nástroje Design, takže jakmile ji **uložíš**, žije na URL adrese. Kdokoli s Lolly může tuto URL otevřít, změnit text, vyměnit obrázek a vyrenderovat si vlastní verzi - bez návrhářské aplikace, a uzamčené části zůstanou uzamčené. Z jednorázového návrhu se stane znovupoužitelný nástroj. To je celá myšlenka, a dosáhneš jí, aniž bys napsal jediný řádek konfigurace.

### Otevřená data a otevřené nástroje

[Sada komunitních nástrojů](/info/builders.html) je open source a nezávislá na značce - QR kódy, mapy ulic, filtry, nástroje na ochranu soukromí - a jakmile ji aktivuješ, vykresluje se podle *tvé* značky.

Nástrojům můžeš dodat i svá vlastní otevřená data: vlož nebo přetáhni tabulku **CSV** nebo **JSON** a opakující se pole nástroje se z ní vyplní, jeden hotový výstup na řádek.

## 3. Vytvoř něco a pak to sdílej nebo automatizuj

S aktivní značkou a materiálem po ruce vytvoří každý nástroj hotový soubor:

- <!--i:download--> **Vyrenderuj** libovolný nástroj do **SVG, PDF, PNG, JPG, WebP, videa** a dalších formátů - ve skutečných tiskových rozměrech a fyzických jednotkách, když je potřebuješ. Viz [Export a formáty](/info/exporting.html).
- <!--i:link--> **Sdílej odkaz.** Stav každého nástroje je URL adresa, takže hotový výstup je reprodukovatelný a adresovatelný přes parametry - ulož si odkaz a znovu ho vygeneruj, kdykoli potřebuješ.
- <!--i:layers--> **Dělej to hromadně.** Řiď šablonu z tabulky v [hromadné mřížce](/info/exporting.html): jeden hotový výstup na řádek.
- <!--i:cpu--> **Automatizuj to.** Stejné renderování běží z [CLI](/info/cli.html) i z [AI agenta](/info/ai-agents.html) - URL adresa je API.

„URL adresa je API“ je myšleno doslova. Graf níže nikdo nekreslil: jeho typ, jeho nadpis i celá jeho datová tabulka se naťukaly do adresního řádku a stejný odkaz vykreslí stejný graf na jakémkoli zařízení.

![Plošný graf měsíčních registrací, kde každá hodnota přišla jako parametr dotazu, a ne jako kliknutí](/t/url-shot?url=%2F%23%2Ftool%2Fchart%3Fct%3Darea%26d%3DMonth%2CSignups%250AJan%2C120%250AFeb%2C180%250AMar%2C265%250AApr%2C340%250AMay%2C455%26t%3DSignups%2520this%2520year%26full&width=1440&height=900&dpi=192&waitMs=2600&cropSelector=%23tool-canvas&walker=1&format=svg&dark=1&filename=vt-d3-url-chart)

## Kam dál

Tři cesty, podle toho, proč jsi tady:

- <!--i:people--> **[Lolly pro tvůrce](/info/creators.html)** - tvoříš věci. Výhody a jak z aplikace vytěžit maximum.
- <!--i:code--> **[Lolly pro vývojáře](/info/builders.html)** - vytváříš nástroje, integruješ a nasazuješ. Technická dokumentace.
- <!--i:shieldcheck--> **[Lolly pro provozovatele](/info/operators.html)** - zodpovídáš za značku, bezpečnost a nasazení napříč organizací.
