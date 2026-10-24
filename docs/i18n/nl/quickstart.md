# Start

Aan het eind van deze pagina dragen je tools je eigen kleuren en lettertypen, en is het werk dat je al hebt klaar voor hergebruik. Je hebt geen account nodig, en maken en exporteren draaien op je apparaat.

::: timeline
- <!--i:sparkle--> **Maak één bestand.** [Maak je eerste bestand](/info/make-something.html) leidt je in een paar minuten door een QR-code.
- <!--i:palette--> **Zet je merk erin.** Begin met één kleur, een tokensbestand of een afgerond ontwerp.
- <!--i:layers--> **Maak er meer van hetzelfde.** Deel een link, vul een spreadsheet of draai de tool vanuit een script.
:::

Nieuw met het idee zelf? [Wat is Lolly?](/info/what-is-lolly.html) is de introductie van vijf minuten, en [Hoe Lolly werkt](/info/how-lolly-works.html) laat zien wie wat doet.

## Zet je merk erin

lolly.tools opent in **Lolly Demo**, het eigen voorbeeld-design system van Lolly; [Maak kennis met Lolly Demo](/info/lolly-demo.html) laat zien wat je ziet. Jouw design system vervangt het: een kleine set designtokens, dus kleuren, lettertypen en een paar regels, waarmee elke tool tekent. Stel het één keer in, en alles wat je maakt begint on-brand.

Kies de route die past bij wat je hebt:

- <!--i:palette--> **Eén kleur.** Open **Design System Setup** (`#/start`), geef je design system een naam en kies een primaire kleur. Lolly leidt daar een compleet, toegankelijk palet uit af, met lichte en donkere vlakken, tekst en accenten. Kies een lettertype en je hebt een werkend merk.
- <!--i:upload--> **Een tokensbestand.** **Add from…**, onderaan de kamerbalk in Design System Setup, neemt een DTCG-, Tokens Studio- of Penpot-tokensbestand, een SVG of een `LollyBrand`-pakket aan. Zet het erin en het palet vult zich. Zolang het design system nog leeg is, opent **Start from a reference** in de kamer Overview dezelfde kiezer.
- <!--i:pentool--> **Een afgerond ontwerp.** Kies in Design **Import a design** en zet een `.fig`-, `.penpot`-, `.ai`-, `.idml`- of SVG-bestand erin. Zie [Neem mee wat je al hebt](#bring-in-what-you-already-have) hieronder.

De eerste keer dat je de galerij opent, biedt een korte welkomstboodschap dezelfde keuzes: **Make it yours** opent Design System Setup, **Bring your design** opent een bestandskiezer voor een ontwerp en **Explore the community tools** sluit de welkomstboodschap.

![De kamer Colours van Design System Setup bij een verse installatie: één live chip, één veld en de hele eerste beslissing](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor&width=1440&height=740&dpi=192&waitMs=1800&format=svg&walker=1&localize=1&dark=1&filename=brand-colours)

Vanaf daar brengen zeven kamers het zo ver als je wilt, in elke volgorde: **Overview**, **Colours**, **Type**, **Logos**, **Tokens**, **Files** en **Usage & rules**. Elk voorbeeld in de app wordt bijgewerkt terwijl je typt. [Design System Setup](/info/brand-studio.html) behandelt elke kamer.

Lettertypen blijven op je apparaat. Kies een Google Font en Lolly bewaart het bestand als merkasset, zodat je typografie offline meereist en er niets wordt opgehaald wanneer een tool tekent.

### Een design system bekijken, wisselen en delen

- **Zie het actieve.** **Settings → Design system** toont het actieve design system als omslag en pagina's, alleen-lezen.
- **Wissel ertussen.** **Settings → Preferences → Design systems** somt elk design system op dit apparaat op. Eén organisatie kan meerdere design systems draaien, of één met meerdere colourways; [Brand architectures](/info/brand-architectures.html) brengt de opzetten in kaart.
- **Deel er één.** Exporteer het design system als `LollyBrand`-pakket: één bestand dat een collega importeert om hetzelfde palet, dezelfde lettertypen en regels te krijgen.

Een design system dat je build of organisatie levert is **beheerd**: het toont een slot en blijft alleen-lezen. Om er een te wijzigen, maak je een bewerkbare kopie via **Settings → Preferences → Design systems**.

![Het tabblad Design system in Settings: het actieve design system als omslag en pagina's](/t/url-shot?url=%2F%23%2Fd%3Ftab%3Dbrand&width=1440&height=900&dpi=192&waitMs=1800&format=svg&walker=1&localize=1&dark=1&filename=dashboard-brand&waitSelector=%5Bdata-issue-ready%5D)

Je design system bestaat uit DTCG-tokens, het formaat dat Penpot leest en schrijft en dat Tokens Studio naar Figma brengt, dus het palet waarmee je ontwerpt en het palet dat Lolly toepast zijn één document. [Design Tokens](/info/design-tokens.html) geeft de details.

::: details Voor ontwikkelaars: een merkpakket bouwen vanaf de opdrachtregel
Om in een checkout een herbruikbaar merkpakket op te zetten, accepteert `ingest:brand` de drie containers die Penpot en Tokens Studio exporteren: één `tokens.json`, een map met bestanden per set met `$metadata.json`, of een `project.penpot`-archief.

```bash
pnpm run ingest:brand ./my-tokens.json --name acme --label "Acme" --activate
```

`--activate` registreert het merk als profiel en bouwt en valideert de catalogus ervan. Het wijzigt nooit het standaardprofiel: draai met `LOLLY_PROFILE=acme` om het nieuwe pakket te gebruiken. [Configuration](/info/configuration.html) legt uit hoe merkpakketten en profielen samenhangen.
:::

## Neem mee wat je al hebt

Je begint niet op een blanco pagina.

**Ontwerpbestanden.** Afgerond werk uit Figma, Penpot, Illustrator, InDesign of een willekeurige SVG-app opent in Design als een levende lay-out: tekst blijft bewerkbaar, vormen blijven vormen en afbeeldingen komen in je bibliotheek. Het bestand wordt in je browser gelezen en er wordt niets geüpload. [Import a design](/info/design-import.html) noemt elk formaat en wat er wordt overgenomen.

**Decks.** Zet een PowerPoint-`.pptx` op Lolly om de dia's als assets op te bergen, schrijf een nieuw deck vanuit Markdown in **Markdown Slides**, of gebruik [Rebrand a deck](/info/rebrand.html) om het hele deck over te zetten naar je design system.

**Gegevens.** Plak of zet een CSV- of JSON-tabel erin en de herhalende velden van een tool vullen zich ermee, of [Batch](/info/batch.html#make-many-versions-of-one-design) maakt één afgerond bestand per rij.

### Van eenmalig ontwerp naar template

Een geïmporteerde lay-out is een gewone Design-sessie. **Share with rules** maakt er een tool van: jij kiest welke delen anderen mogen wijzigen, en zij vullen alleen die in.

![Houd de Design-master, kies invoer en grenzen in een auteurskopie, deel dan een herbruikbare .lolly-tool die ontvangers invullen](/info/diagrams/concepts/share-with-rules.svg)

[Een ontwerp delen met regels](/info/create-a-tool.html) leidt je door elke stap.

## Maak er veel, deel en automatiseer

- <!--i:download--> **Exporteer.** Tools maken SVG, PDF, PNG, JPG, WebP, video en meer, in de formaten die elke tool biedt, op echte drukformaten wanneer je dat nodig hebt. Zie [Export a file](/info/exporting.html).
- <!--i:link--> **Deel een link.** De instellingen van een tool reizen mee in zijn link, zodat de link overal hetzelfde bestand heropent.
- <!--i:layers--> **Maak er één per rij.** Stuur een tool aan vanuit een spreadsheet in [Batch](/info/batch.html#make-many-versions-of-one-design).
- <!--i:cpu--> **Automatiseer.** Dezelfde render draait vanuit de [CLI](/info/cli.html) en vanuit een [AI-agent](/info/ai-agents.html).

Een link is een volledig verzoek. Niemand tekende de grafiek hieronder: het type, de kop en de hele gegevenstabel werden in de adresbalk getypt, en dezelfde link tekent op elk apparaat dezelfde grafiek.

![Een vlakdiagram van maandelijkse aanmeldingen, waarvan elke waarde als queryparameter binnenkwam in plaats van via een klik](/t/url-shot?url=%2F%23%2Ftool%2Fchart%3Fct%3Darea%26d%3DMonth%2CSignups%250AJan%2C120%250AFeb%2C180%250AMar%2C265%250AApr%2C340%250AMay%2C455%26t%3DSignups%2520this%2520year%26full&width=1440&height=900&dpi=192&waitMs=2600&cropSelector=%23tool-canvas&walker=1&format=svg&dark=1&filename=vt-d3-url-chart)

## Waar je hierna heen kunt

- <!--i:people--> **[Maken](/info/creators.html)**: maken, animeren, opnemen, delen en exporteren.
- <!--i:code--> **[Automatiseren](/info/builders.html)**: design systems, tools schrijven, de opdrachtregel, links en agents.
- <!--i:usercheck--> **[Beheren](/info/operators.html)**: Lolly draaien voor een team met Lolly Work.
- <!--i:server--> **[Uitrollen](/info/operate.html)**: Lolly en Lolly Work hosten.
- <!--i:shieldcheck--> **[Vertrouwen](/info/trust.html)**: privacy, beveiliging en zelf een bestand controleren.
