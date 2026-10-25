# Začni

Na konci této stránky budou tvé nástroje nosit tvé vlastní barvy a písma a práce, kterou už máš, bude připravená k opětovnému použití. Nepotřebuješ žádný účet a tvorba i export běží na tvém zařízení.

::: timeline
- <!--i:sparkle--> **Vytvoř jeden soubor.** [Vytvoř svůj první soubor](/info/make-something.html) tě za pár minut provede QR kódem.
- <!--i:palette--> **Vlož svou značku.** Začni od jedné barvy, souboru s tokeny nebo hotového návrhu.
- <!--i:layers--> **Dělej víc téhož.** Sdílej odkaz, vyplň tabulku nebo spusť nástroj ze skriptu.
:::

Je ti samotná myšlenka nová? [Co je Lolly?](/info/what-is-lolly.html) je pětiminutový úvod a [Jak Lolly funguje](/info/how-lolly-works.html) ukazuje, kdo co dělá.

## Vlož svou značku

lolly.tools se otevře v **Lolly Demo**, vlastním ukázkovém designovém systému Lolly; [Poznej Lolly Demo](/info/lolly-demo.html) ukazuje, na co se díváš. Tvůj designový systém ho nahradí: malá sada designových tokenů, tedy barev, písem a několika pravidel, ze které kreslí každý nástroj. Nastav ho jednou a vše, co vytvoříš, začíná ve tvé značce.

Vyber cestu, která odpovídá tomu, co máš:

- <!--i:palette--> **Jedna barva.** Otevři **Design System Setup** (`#/start`), pojmenuj svůj designový systém a vyber primární barvu. Lolly z ní odvodí kompletní, přístupnou paletu se světlými a tmavými povrchy, textem a akcenty. Vyber písmo a máš fungující značku.
- <!--i:upload--> **Soubor s tokeny.** **Add from…** dole na liště místností v Design System Setup přijme soubor tokenů DTCG, Tokens Studio nebo Penpot, SVG nebo balíček `LollyBrand`. Přetáhni ho a paleta se vyplní. Dokud je designový systém prázdný, stejný výběr otevře **Start from a reference** v místnosti Overview.
- <!--i:pentool--> **Hotový návrh.** V Design zvol **Import a design** a přetáhni soubor `.fig`, `.penpot`, `.ai`, `.idml` nebo SVG. Viz [Přines, co už máš](#bring-in-what-you-already-have) níže.

Při prvním otevření galerie krátké uvítání nabídne stejné volby: **Make it yours** otevře Design System Setup, **Bring your design** otevře výběr souboru pro návrh a **Explore the community tools** uvítání zavře.

![Místnost Colours v Design System Setup na čerstvé instalaci: jeden živý čip, jedno pole a celé první rozhodnutí](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor&width=1440&height=740&dpi=192&waitMs=1800&format=svg&walker=1&localize=1&dark=1&filename=brand-colours)

Odtud tě sedm místností dovede tak daleko, jak chceš, v libovolném pořadí: **Overview**, **Colours**, **Type**, **Logos**, **Tokens**, **Files** a **Usage & rules**. Každý náhled v aplikaci se aktualizuje při psaní. Každou místnost popisuje [Design System Setup](/info/brand-studio.html).

Písma se uchovávají na tvém zařízení. Vyber Google Font a Lolly uloží soubor jako asset značky, takže tvé písmo cestuje offline a při kreslení nástroje se nic nestahuje.

### Prohlížej, přepínej a sdílej designový systém

- **Zobraz aktivní.** **Settings → Design system** ukazuje aktivní designový systém jako obálku a stránky, jen pro čtení.
- **Přepínej mezi nimi.** **Settings → Preferences → Design systems** vypisuje každý designový systém na tomto zařízení. Jedna organizace může provozovat několik designových systémů nebo jeden s několika colourways; uspořádání mapují [Architektury značek](/info/brand-architectures.html).
- **Sdílej jeden.** Exportuj designový systém jako balíček `LollyBrand`: jeden soubor, který kolega naimportuje, aby získal stejnou paletu, písma a pravidla.

Designový systém, který dodá tvé sestavení nebo organizace, je **spravovaný**: ukazuje zámek a zůstává jen pro čtení. Chceš-li jej změnit, vytvoř upravitelnou kopii v **Settings → Preferences → Design systems**.

![Karta Design system v Settings: aktivní designový systém jako obálka a stránky](/t/url-shot?url=%2F%23%2Fd%3Ftab%3Dbrand&width=1440&height=900&dpi=192&waitMs=1800&format=svg&walker=1&localize=1&dark=1&filename=dashboard-brand&waitSelector=%5Bdata-issue-ready%5D)

Tvůj designový systém jsou tokeny DTCG, formát, který Penpot čte a zapisuje a Tokens Studio přináší do Figmy, takže paleta, se kterou navrhuješ, a paleta, kterou Lolly uplatňuje, jsou jeden dokument. Podrobnosti jsou v [Design Tokens](/info/design-tokens.html).

::: details Pro vývojáře: sestav balíček značky z příkazového řádku
K založení opakovaně použitelného balíčku značky v checkoutu přijímá `ingest:brand` tři kontejnery, které exportují Penpot a Tokens Studio: jediný `tokens.json`, adresář souborů po sadách s `$metadata.json` nebo archiv `project.penpot`.

```bash
pnpm run ingest:brand ./my-tokens.json --name acme --label "Acme" --activate
```

`--activate` zaregistruje značku jako profil a sestaví a ověří její katalog. Nikdy nezmění výchozí profil: spusť s `LOLLY_PROFILE=acme`, abys použil nový balíček. [Konfigurace](/info/configuration.html) vysvětluje, jak do sebe balíčky značek a profily zapadají.
:::

## Přines, co už máš

Nezačínáš od prázdné stránky.

**Návrhové soubory.** Hotová práce z Figmy, Penpotu, Illustratoru, InDesignu nebo jakékoli aplikace SVG se v Design otevře jako živé rozvržení: text zůstane přepisovatelný, tvary zůstanou tvary a obrázky skončí v tvé knihovně. Soubor se čte v tvém prohlížeči a nic se nenahrává. [Import návrhu](/info/design-import.html) vypisuje každý formát a co se přenese.

**Prezentace.** Přetáhni na Lolly PowerPoint `.pptx`, aby se jeho snímky založily jako assety, napiš novou prezentaci z Markdownu v **Markdown Slides** nebo použij [Rebrand prezentace](/info/rebrand.html), abys celou prezentaci přenesl do svého designového systému.

**Data.** Vlož nebo přetáhni tabulku CSV či JSON a opakující se pole nástroje se z ní vyplní, nebo [Batch](/info/batch.html#make-many-versions-of-one-design) vytvoří jeden hotový soubor na řádek.

### Od jednorázovky k šabloně

Importované rozvržení je běžná relace Design. **Share with rules** z něj udělá nástroj: ty vybereš, které části mohou ostatní měnit, a oni vyplní jen ty.

![Ponech mistr v Design, vyber vstupy a limity v autorské kopii, pak sdílej opakovaně použitelný nástroj .lolly, který příjemci vyplňují](/info/diagrams/concepts/share-with-rules.svg)

[Sdílej návrh s pravidly](/info/create-a-tool.html) provede každým krokem.

## Dělej mnoho, sdílej a automatizuj

- <!--i:download--> **Export.** Nástroje vytvářejí SVG, PDF, PNG, JPG, WebP, video a další, ve formátech, které každý nástroj nabízí, ve skutečných tiskových velikostech, když je potřebuješ. Viz [Export souboru](/info/exporting.html).
- <!--i:link--> **Sdílej odkaz.** Nastavení nástroje putuje v jeho odkazu, takže odkaz kdekoli znovu otevře stejný soubor.
- <!--i:layers--> **Jeden na řádek.** Řiď nástroj z tabulky v [Batch](/info/batch.html#make-many-versions-of-one-design).
- <!--i:cpu--> **Automatizuj.** Stejné vykreslení běží z [CLI](/info/cli.html) i od [AI agenta](/info/ai-agents.html).

Odkaz je úplný požadavek. Graf níže nikdo nenakreslil: jeho typ, nadpis i celá tabulka dat byly napsány do adresního řádku a stejný odkaz nakreslí stejný graf na jakémkoli zařízení.

![Plošný graf měsíčních registrací, kde každá hodnota přišla jako parametr dotazu, a ne jako kliknutí](/t/url-shot?url=%2F%23%2Ftool%2Fchart%3Fct%3Darea%26d%3DMonth%2CSignups%250AJan%2C120%250AFeb%2C180%250AMar%2C265%250AApr%2C340%250AMay%2C455%26t%3DSignups%2520this%2520year%26full&width=1440&height=900&dpi=192&waitMs=2600&cropSelector=%23tool-canvas&walker=1&format=svg&dark=1&filename=vt-d3-url-chart)

## Kam dál

- <!--i:people--> **[Tvoř](/info/creators.html)**: tvorba, animace, nahrávání, sdílení a export.
- <!--i:code--> **[Automatizuj](/info/builders.html)**: designové systémy, tvorba nástrojů, příkazový řádek, odkazy a agenti.
- <!--i:usercheck--> **[Spravuj](/info/operators.html)**: provoz Lolly pro tým s Lolly Work.
- <!--i:server--> **[Nasazuj](/info/operate.html)**: hostování Lolly a Lolly Work.
- <!--i:shieldcheck--> **[Důvěřuj](/info/trust.html)**: soukromí, bezpečnost a ověření souboru sám.
