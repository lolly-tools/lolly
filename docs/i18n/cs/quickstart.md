# Začni

Nastav nástrojům vlastní barvy a písma a znovu využij práci, kterou už máš. Nepotřebuješ účet a tvorba i export běží na tvém zařízení.

::: steps
- <!--i:eti-sparkles--> **[Vytvoř jeden soubor](/info/make-something.html)** QR kód za pár minut s ukázkou každého kroku.
- <!--i:eti-palette--> **[Přidej svou značku](#put-your-brand-in)** Začni jednou barvou, souborem tokenů nebo hotovým návrhem.
- <!--i:eti-folder-move--> **[Přenes svou práci](#bring-in-what-you-already-have)** Návrhy, sady snímků a data, které už máš, načtené na tvém zařízení.
- <!--i:eti-repeat--> **[Vytvoř další podobné výstupy](#make-many-share-and-automate)** Sdílej odkaz, vyplň tabulku nebo spusť nástroj ze skriptu.
:::

[Co je Lolly?](/info/what-is-lolly.html) je pětiminutový úvod. [Jak Lolly funguje](/info/how-lolly-works.html) ukazuje, kdo co dělá.

<!--i:eti-palette-->
## Přidej svou značku

lolly.tools se otevírá s **Lolly Demo**, vlastním ukázkovým designovým systémem Lolly ([Seznam se s Lolly Demo](/info/lolly-demo.html)). Tvůj designový systém nahradí Lolly Demo. Je to malá sada designových tokenů (barev, písem a několika pravidel), se kterými každý nástroj kreslí. Nastav ji jednou a vše, co vytvoříš, bude od začátku odpovídat tvé značce.

Vyber cestu podle toho, co máš:

- <!--i:palette--> **Jedna barva.** Otevři zobrazení **Design System Setup** (`#/start`), pojmenuj svůj designový systém a vyber primární barvu. Lolly z této barvy odvodí přístupnou paletu se světlými a tmavými plochami, textem a akcenty. Vyber písmo a máš funkční značku.
- <!--i:upload--> **Soubor tokenů.** **Add from…** nahoře v Lolly Design System Setup přijímá soubor tokenů DTCG, Tokens Studio nebo Penpot, SVG nebo balíček `LollyBrand`. Paleta se vyplní ze souboru. Dokud je designový systém prázdný, **Start from a reference** na Board otevírá stejný výběr.
- <!--i:pentool--> **Hotový návrh.** V Lolly Design zvol **Import a design** a přetáhni soubor Figma, Penpot, Illustrator, InDesign, Affinity, Photoshop, PowerPoint nebo SVG ([všechny formáty](/info/design-import.html#what-comes-in-from-each-app)). Viz níže [Přenes, co už máš](#bring-in-what-you-already-have).

Při prvním otevření galerie nabídne uvítání nahoře jeden další krok. Na lolly.tools otevře **Start making** Lolly Design s plakátem Launch. V nové instalaci otevře **Make it yours** Lolly Design System Setup. Pod tímto tlačítkem otevře **Bring a file** výběr souboru s návrhem a druhá z těchto dvou možností se zobrazí jako odkaz. Kterákoli z nich nebo tlačítko zavření uvítání natrvalo skryje.

![Sekce Colours v Lolly Design System Setup u nového designového systému: jeden živý vzorek barvy, jedno pole a celé první rozhodnutí](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor&system=new-design-system&width=1440&height=740&dpi=192&waitMs=1800&format=svg&walker=1&dark=1&filename=bs-colours-new-system)

Osm sekcí, které můžeš použít v libovolném pořadí, rozvíjí designový systém dál: **Board**, **Colours**, **Type**, **Logos**, **Tokens**, **Files**, **Rules** a **Skills**. Každý náhled v aplikaci se aktualizuje při psaní. [Lolly Design System Setup](/info/brand-studio.html) popisuje každou sekci.

Písma se uchovávají na tvém zařízení. Vybrané písmo z Google Fonts se uloží jako asset značky, takže tvá typografie funguje offline a při kreslení nástroje se nic nenačítá.

### Prohlížení, přepínání a sdílení designového systému

- **Prohlédni si aktivní systém.** **Settings → Design system** zobrazuje aktivní designový systém jako obálku a stránky, jen ke čtení.
- **Přepínej mezi systémy.** **Settings → Preferences → Design systems** vypisuje všechny designové systémy na tomto zařízení. Jedna organizace může provozovat několik designových systémů nebo jeden s několika colourways. [Architektury značek](/info/brand-architectures.html) mapují tato uspořádání.
- **Sdílej systém.** Exportuj designový systém jako balíček `LollyBrand`: jeden soubor, který kolega importuje, aby získal stejnou paletu, písma a pravidla.

Designový systém dodaný se sestavením aplikace nebo tvou organizací je **spravovaný**: zobrazuje zámek a zůstává jen pro čtení. Pokud ho chceš změnit, vytvoř upravitelnou kopii v **Settings → Preferences → Design systems**.

![Karta Design system v Settings: aktivní designový systém jako obálka a stránky](/t/url-shot?url=%2F%23%2Fd%3Ftab%3Dbrand&width=1440&height=900&dpi=192&waitMs=1800&format=svg&walker=1&localize=1&dark=1&filename=dashboard-brand&waitSelector=%5Bdata-issue-ready%5D)

Tvůj designový systém tvoří tokeny DTCG, formát, který Penpot čte i zapisuje a který Tokens Studio přenáší do Figma. Paleta, se kterou navrhuješ, a paleta, kterou Lolly používá, jsou jeden dokument. Podrobnosti najdeš v [Designových tokenech](/info/design-tokens.html).

::: details Pro vývojáře: vytvoř balíček značky z příkazového řádku
`ingest:brand` vytvoří v pracovní kopii repozitáře znovupoužitelný balíček značky. Přijímá tři podoby exportu z Penpot a Tokens Studio: samostatný `tokens.json`, adresář se soubory jednotlivých sad a `$metadata.json` nebo archiv `project.penpot`.

```bash
pnpm run ingest:brand ./my-tokens.json --name acme --label "Acme" --activate
```

`--activate` zaregistruje značku jako profil a sestaví a ověří její katalog. Výchozí profil nikdy nemění: nový balíček použiješ spuštěním s `LOLLY_PROFILE=acme`. [Konfigurace](/info/configuration.html) vysvětluje vztah mezi balíčky značek a profily.
:::

<!--i:eti-folder-move-->
## Přenes sem, co už máš

**Soubory Lolly Design.** Hotová práce z Figma, Penpot, Illustrator, InDesign nebo jakékoli aplikace pro SVG se v Lolly Design otevře jako upravitelné rozvržení. Text můžeš dál přepisovat, tvary zůstávají tvary a obrázky se uloží do tvé knihovny. Soubor se načítá v prohlížeči a nic se nenahrává na server. [Import návrhu](/info/design-import.html) uvádí jednotlivé formáty a co se z nich zachová.

**Sady snímků.** Přetáhni na Lolly soubor PowerPoint `.pptx` a jeho snímky se uloží jako assety. Novou sadu snímků napiš v Markdown v **Lolly Markdown Slides**. [Převedení sady snímků na jinou značku](/info/rebrand.html) přizpůsobí sadu tvému designovému systému.

**Data.** Vlož nebo přetáhni tabulku CSV či JSON a vyplň tak opakující se pole nástroje. [Lolly Batch](/info/batch.html#make-many-versions-of-one-design) vytvoří pro každý řádek jeden hotový soubor.

### Od jednorázového návrhu k šabloně

Importované rozvržení je běžná relace Lolly Design. **Share with rules** tuto relaci promění v nástroj. Vybereš části, které ostatní smějí měnit, a oni vyplní jen ty.

![Ponech si předlohu v Lolly Design, v autorské kopii vyber vstupy a omezení a pak sdílej znovupoužitelný nástroj .lolly, který příjemci vyplní](/info/diagrams/concepts/share-with-rules.svg)

[Sdílení návrhu s pravidly](/info/create-a-tool.html) tě provede jednotlivými kroky.

<!--i:eti-repeat-->
## Vytvářej ve velkém, sdílej a automatizuj

- <!--i:download--> **Export.** Nástroje vytvářejí SVG, PDF, PNG, JPG, WebP, video a další formáty, podle potřeby ve skutečných tiskových rozměrech. Každý nástroj nabízí vlastní formáty. Viz [Export souboru](/info/exporting.html).
- <!--i:link--> **Sdílej odkaz.** Nastavení nástroje se přenáší v jeho odkazu, takže odkaz kdekoli znovu otevře stejný soubor.
- <!--i:layers--> **Vytvoř jeden soubor pro každý řádek.** Ovládej nástroj tabulkou v [Lolly Batch](/info/batch.html#make-many-versions-of-one-design).
- <!--i:cpu--> **Automatizuj.** Stejné vykreslení spustíš přes [CLI](/info/cli.html) i prostřednictvím [AI agenta](/info/ai-agents.html).

Odkaz je úplný požadavek. Typ, nadpis i datová tabulka následujícího grafu byly zadány do adresního řádku.

![Sloupcový graf měsíčních registrací podle kanálu v barvách designového systému, do kterého každá hodnota přišla jako parametr dotazu místo kliknutí](/t/url-shot?url=%2F%23%2Ftool%2Fchart%3Fct%3Dbar%26sty%3Dposter%26pl%3Droles%26transparentBg%3Dfalse%26d%3DMonth%2CWeb%2CApp%2CPartners%250AJan%2C120%2C60%2C25%250AFeb%2C180%2C95%2C40%250AMar%2C265%2C150%2C70%250AApr%2C340%2C210%2C110%250AMay%2C455%2C290%2C160%250AJun%2C560%2C380%2C230%26t%3DSignups%2520this%2520year%26st%3DBy%2520channel%252C%2520January%2520to%2520June%26full&width=1440&height=900&dpi=192&waitMs=4000&cropSelector=%23tool-canvas&walker=1&format=svg&dark=1&filename=vt-d3-url-chart)

<!--i:eti-map-pin-->
## Kam dál

- <!--i:people--> **[Tvorba](/info/creators.html)**: tvoření, animování, nahrávání, sdílení a export.
- <!--i:code--> **[Automatizace](/info/builders.html)**: designové systémy, tvorba nástrojů, příkazový řádek, odkazy a agenti.
- <!--i:usercheck--> **[Správa](/info/operators.html)**: provoz Lolly pro tým pomocí Lolly Work.
- <!--i:server--> **[Nasazení](/info/operate.html)**: hostování Lolly a Lolly Work.
- <!--i:shieldcheck--> **[Důvěra](/info/trust.html)**: soukromí, zabezpečení a vlastní ověření souboru.
