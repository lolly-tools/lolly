# Start

Stel je tools in op je eigen kleuren en lettertypen en hergebruik het werk dat je al hebt. Je hebt geen account nodig en maken en exporteren gebeurt op je apparaat.

::: steps
- <!--i:eti-sparkles--> **[Maak één bestand](/info/make-something.html)** Een QR-code in een paar minuten, met elke stap in beeld.
- <!--i:eti-palette--> **[Voeg je merk toe](#put-your-brand-in)** Begin met één kleur, een tokenbestand of een afgerond ontwerp.
- <!--i:eti-folder-move--> **[Breng je werk mee](#bring-in-what-you-already-have)** Ontwerpen, decks en gegevens die je al hebt, gelezen op je apparaat.
- <!--i:eti-repeat--> **[Maak meer van hetzelfde](#make-many-share-and-automate)** Deel een link, vul een spreadsheet of voer de tool uit vanuit een script.
:::

[Wat is Lolly?](/info/what-is-lolly.html) is een introductie van vijf minuten. [Hoe Lolly werkt](/info/how-lolly-works.html) laat zien wie wat doet.

<!--i:eti-palette-->
## Voeg je merk toe

lolly.tools opent met **Lolly Demo**, Lolly's eigen voorbeelddesign system ([Maak kennis met Lolly Demo](/info/lolly-demo.html)). Je design system vervangt Lolly Demo. Het is een kleine set ontwerptokens (kleuren, lettertypen en een paar regels) waarmee elke tool tekent. Stel het één keer in en alles wat je maakt begint in je huisstijl.

Kies de route die past bij wat je hebt:

- <!--i:palette--> **Eén kleur.** Open de weergave **Design System Setup** (`#/start`), geef je design system een naam en kies een primaire kleur. Lolly leidt uit die kleur een toegankelijk palet af, met lichte en donkere vlakken, tekst en accenten. Kies een lettertype en je hebt een werkbare huisstijl.
- <!--i:upload--> **Een tokenbestand.** **Add from…**, bovenaan Lolly Design System Setup, accepteert een DTCG-, Tokens Studio- of Penpot-tokenbestand, een SVG of een `LollyBrand`-pakket. Het palet wordt vanuit het bestand ingevuld. Zolang het design system leeg is, opent **Start from a reference** op het Board dezelfde kiezer.
- <!--i:pentool--> **Een afgerond ontwerp.** Kies in Lolly Design **Import a design** en sleep er een Figma-, Penpot-, Illustrator-, InDesign-, Affinity-, Photoshop-, PowerPoint- of SVG-bestand naartoe ([elk formaat](/info/design-import.html#what-comes-in-from-each-app)). Zie hieronder [Breng mee wat je al hebt](#bring-in-what-you-already-have).

De eerste keer dat je de galerij opent, biedt een begroeting bovenaan één volgende stap. Op lolly.tools opent **Start making** Lolly Design met de Launch-poster. Bij een nieuwe installatie opent **Make it yours** Lolly Design System Setup. Onder die knop opent **Bring a file** een bestandskiezer voor een ontwerp en verschijnt de andere van die twee keuzes als link. Elk van deze opties, of de sluitknop, laat de begroeting voorgoed verdwijnen.

![De ruimte Colours van Lolly Design System Setup bij een nieuw design system: één live kleurstip, één veld en de volledige eerste beslissing](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor&system=new-design-system&width=1440&height=740&dpi=192&waitMs=1800&format=svg&walker=1&dark=1&filename=bs-colours-new-system)

Acht ruimtes, te gebruiken in elke volgorde, werken het design system verder uit: **Board**, **Colours**, **Type**, **Logos**, **Tokens**, **Files**, **Rules** en **Skills**. Elk voorbeeld in de app wordt tijdens het typen bijgewerkt. [Lolly Design System Setup](/info/brand-studio.html) behandelt elke ruimte.

Lettertypen worden op je apparaat bewaard. Een Google Font dat je kiest, wordt als merkasset opgeslagen, zodat je typografie offline werkt en er niets wordt opgehaald wanneer een tool tekent.

### Een design system bekijken, wisselen en delen

- **Bekijk het actieve design system.** **Settings → Design system** toont het actieve design system als een omslag met pagina's, alleen-lezen.
- **Wissel ertussen.** **Settings → Preferences → Design systems** somt elk design system op dit apparaat op. Eén organisatie kan meerdere design systems gebruiken of één met meerdere colourways. [Merkarchitecturen](/info/brand-architectures.html) brengt de indelingen in kaart.
- **Deel er één.** Exporteer het design system als een `LollyBrand`-pakket: één bestand dat een collega importeert om hetzelfde palet, dezelfde lettertypen en regels te krijgen.

Een design system dat je build of organisatie levert, is **beheerd**: het toont een slotje en blijft alleen-lezen. Wil je het aanpassen, maak dan een bewerkbare kopie via **Settings → Preferences → Design systems**.

![Het tabblad Design system in Settings: het actieve design system als omslag en pagina's](/t/url-shot?url=%2F%23%2Fd%3Ftab%3Dbrand&width=1440&height=900&dpi=192&waitMs=1800&format=svg&walker=1&localize=1&dark=1&filename=dashboard-brand&waitSelector=%5Bdata-issue-ready%5D)

Je design system bestaat uit DTCG-tokens, het formaat dat Penpot leest en schrijft en dat Tokens Studio naar Figma brengt. Het palet waarmee je ontwerpt en het palet dat Lolly toepast, zijn één document. [Designtokens](/info/design-tokens.html) geeft de details.

::: details Voor ontwikkelaars: bouw een merkpakket via de opdrachtregel
`ingest:brand` bouwt een herbruikbaar merkpakket in een checkout. Het accepteert de drie bestandsstructuren die Penpot en Tokens Studio exporteren: één `tokens.json`, een map met bestanden per set en `$metadata.json` of een `project.penpot`-archief.

```bash
pnpm run ingest:brand ./my-tokens.json --name acme --label "Acme" --activate
```

`--activate` registreert het merk als profiel en bouwt en valideert de catalogus. Het standaardprofiel verandert nooit: voer het uit met `LOLLY_PROFILE=acme` om het nieuwe pakket te gebruiken. [Configuratie](/info/configuration.html) legt uit hoe merkpakketten en profielen samenhangen.
:::

<!--i:eti-folder-move-->
## Importeer wat je al hebt

**Lolly Design-bestanden.** Afgerond werk uit Figma, Penpot, Illustrator, InDesign of een SVG-app opent in Lolly Design als bewerkbare lay-out. Tekst blijft bewerkbaar, vormen blijven vormen en afbeeldingen komen in je bibliotheek. Het bestand wordt in je browser gelezen en er wordt niets geüpload. [Een ontwerp importeren](/info/design-import.html) beschrijft elk formaat en wat behouden blijft.

**Decks.** Sleep een PowerPoint-`.pptx` naar Lolly om de dia's als assets op te slaan. Schrijf een nieuw deck vanuit Markdown in **Lolly Markdown Slides**. [Een deck een nieuwe huisstijl geven](/info/rebrand.html) zet een deck om naar je design system.

**Gegevens.** Plak of sleep een CSV- of JSON-tabel om de herhalende velden van een tool te vullen. [Lolly Batch](/info/batch.html#make-many-versions-of-one-design) maakt per rij één afgerond bestand.

### Van eenmalig ontwerp naar sjabloon

Een geïmporteerde lay-out is een gewone Lolly Design-sessie. **Share with rules** maakt van de sessie een tool. Je kiest welke onderdelen anderen mogen wijzigen en zij vullen alleen die in.

![Bewaar het origineel in Lolly Design, kies invoer en grenzen in een auteurskopie en deel vervolgens een herbruikbare .lolly-tool die ontvangers invullen](/info/diagrams/concepts/share-with-rules.svg)

[Een ontwerp delen met regels](/info/create-a-tool.html) neemt je door alle stappen mee.

<!--i:eti-repeat-->
## Maak er veel, deel en automatiseer

- <!--i:download--> **Exporteren.** Tools maken SVG, PDF, PNG, JPG, WebP, video en meer, waar nodig op het echte afdrukformaat. Elke tool biedt zijn eigen formaten. Zie [Een bestand exporteren](/info/exporting.html).
- <!--i:link--> **Een link delen.** De instellingen van een tool gaan mee in de link, zodat die overal hetzelfde bestand opent.
- <!--i:layers--> **Eén per rij maken.** Stuur een tool aan vanuit een spreadsheet in [Lolly Batch](/info/batch.html#make-many-versions-of-one-design).
- <!--i:cpu--> **Automatiseren.** Dezelfde render draait via de [CLI](/info/cli.html) en via een [AI-agent](/info/ai-agents.html).

Een link is een volledige aanvraag. Het type, de kop en de gegevenstabel van het onderstaande diagram zijn in de adresbalk getypt.

![Een staafdiagram met maandelijkse aanmeldingen per kanaal in de kleuren van het design system, waarbij elke waarde via een queryparameter binnenkwam in plaats van een klik](/t/url-shot?url=%2F%23%2Ftool%2Fchart%3Fct%3Dbar%26sty%3Dposter%26pl%3Droles%26transparentBg%3Dfalse%26d%3DMonth%2CWeb%2CApp%2CPartners%250AJan%2C120%2C60%2C25%250AFeb%2C180%2C95%2C40%250AMar%2C265%2C150%2C70%250AApr%2C340%2C210%2C110%250AMay%2C455%2C290%2C160%250AJun%2C560%2C380%2C230%26t%3DSignups%2520this%2520year%26st%3DBy%2520channel%252C%2520January%2520to%2520June%26full&width=1440&height=900&dpi=192&waitMs=4000&cropSelector=%23tool-canvas&walker=1&format=svg&dark=1&filename=vt-d3-url-chart)

<!--i:eti-map-pin-->
## Waar je verder kunt

- <!--i:people--> **[Maken](/info/creators.html)**: maken, animeren, opnemen, delen en exporteren.
- <!--i:code--> **[Automatiseren](/info/builders.html)**: design systems, tools maken, de opdrachtregel, links en agents.
- <!--i:usercheck--> **[Beheren](/info/operators.html)**: Lolly voor een team draaien met Lolly Work.
- <!--i:server--> **[Uitrollen](/info/operate.html)**: Lolly en Lolly Work hosten.
- <!--i:shieldcheck--> **[Vertrouwen](/info/trust.html)**: privacy, beveiliging en zelf een bestand controleren.
