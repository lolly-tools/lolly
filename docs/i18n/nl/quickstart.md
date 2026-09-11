# Snelstart

Lolly zet jouw regels - kleuren, typografie, lay-outs, logica - om in tools waarmee iedereen afgewerkte bestanden maakt: afbeeldingen, pdf's, social cards, video, door een paar velden in te vullen. Er valt weinig te leren en er is niets te uploaden: maken en exporteren gebeurt op je eigen apparaat, online of offline.

Dit is de ene pagina die je als eerste leest. Twee dingen maken je productief: **maak Lolly van jou** en **breng mee wat je al hebt** (je ontwerpbestanden en tokens). Al het andere is maar één link verderop.

> Nieuw bij Lolly en wil je gewoon iets maken? [Maak iets in 60 seconden](/info/make-something.html) neemt je mee door drie voorbeelden, of [open de app](/#/), kies een willekeurige tool uit de galerij, vul de velden in en klik op **Exporteren**. Kom hier terug wanneer je wilt dat het *jouw* merk draagt.

![De weergave Hulpprogramma's - de werkpaarden op je eigen apparaat zoals Strip Hidden Data, Compress PDF en Convert Image, allemaal op één plek](/t/url-shot?url=%2F%23%2Fu&width=1440&height=900&dpi=192&waitMs=1600&css=.welcome-dialog%2C.personalize-nudge%7Bdisplay%3Anone!important%7D&tolerance=0.03&format=svg&walker=1&dark=1&filename=use-utilities&try=1)

## 1. Maak het van jou - configureer je Design System

Je merk in Lolly is een klein **design-tokens**-document - kleuren, lettertypen en een paar regels - waar elke tool tegen rendert. Stel het één keer in en alles wat je maakt is per constructie on-brand, niet pas na controle. Er zijn drie manieren om te beginnen; kies degene die aansluit bij waar je merk nu al leeft.

### Begin vanaf nul (de design-systembouwer)

Bij de eerste keer starten kom je uit in de **galerij**, met daaroverheen een kort welkomstvenster dat drie ingangen biedt - **Maak het van jou** (de Brand Studio op `#/start`), **Breng je ontwerp mee** (sleep er een Figma-, Penpot-, InDesign- of PDF-bestand in en het opent als een bewerkbare lay-out - de snelste route naar [Breng mee wat je al hebt](#2-bring-in-what-you-already-have) hieronder) en **Verken de tools van de community** - plus een rij talen als Engels de jouwe niet is. Kies de eerste kaart en je belandt in de [**Brand Studio**](/info/brand-studio.html). Geef het een naam en een primaire kleur, en Lolly *leidt* daar een compleet, toegankelijk palet van af - light/dark-oppervlakken, tekst, accenten - met dezelfde kleurwiskunde die de engine overal elders gebruikt.

![De Kleuren-ruimte van de Brand Studio - een primaire kleur, en het toegankelijke palet dat Lolly daaruit afleidt](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor&width=1440&height=740&dpi=192&waitMs=1800&format=svg&walker=1&localize=1&dark=1&filename=brand-colours) Kies een lettertype en je hebt binnen een minuut een werkend merk. Vanaf daar kun je met de zes ruimtes van de studio - Overzicht, Kleuren, Type, Logo's, Tokens, Bestanden - zo ver gaan als je wilt, in willekeurige volgorde, en alles verfijnen wanneer je terugkomt. Het tabblad **Design system** van het dashboard (`#/d`) toont het resultaat alleen-lezen en verwijst terug naar `#/start`, waar het bewerken gebeurt (tenzij je een brand-locked build van Lolly gebruikt, waarin het merk vastligt en er niets te wijzigen valt).

### Importeer een merk dat je al hebt

Als je merk al is vastgelegd als design tokens - vanuit **Penpot**, **Tokens Studio** (Figma) of een gewoon **DTCG**-bestand - breng het dan in één keer binnen in plaats van alles over te typen. Twee routes:

- <!--i:palette--> **In de app:** de [design-systembouwer: Brand Studio](/info/brand-studio.html) (`#/start`) neemt het aan via **Add from…** onderaan de ruimtebalk - een tokenbestand, een Penpot-export, een SVG of een `LollyBrand`-pack. Sleep het erin en het palet licht op.
- <!--i:code--> **Vanaf de command line**, om een herbruikbaar merkpakket op te zetten:

```bash
# a monolithic tokens.json, a one-file-per-set directory, or a Penpot project archive
npm run ingest:brand -- ./my-tokens.json --name acme --label "Acme" --activate
```

`ingest:brand` accepteert alle drie de containers waarin Penpot / Tokens Studio hetzelfde document exporteren - een losse `tokens.json`, een map (`$metadata.json` + bestanden per set) of een `project.penpot`-archief. Met `--activate` registreert het het merk als profiel, schakelt het ernaar over en bouwt het de catalogus opnieuw op. Zie [Configuratie](/info/configuration.html) voor hoe merkpakketten en profielen samenhangen.

### Verfijn het in de app

Zodra een merk actief is, blijf je het vormgeven in de [**Brand Studio**](/info/brand-studio.html) (`#/start`) - verander een kleur of een rol en elke preview in de app wordt bijgewerkt terwijl je typt. (Het tabblad **Design system** op `#/d` *toont* het merk alleen-lezen; in de Studio bewerk je het.)

![Het Design-system-tabblad van het dashboard - het actieve merk alleen-lezen getoond](/t/url-shot?url=%2F%23%2Fd%3Ftab%3Dbrand&width=1440&height=900&dpi=192&waitMs=1800&format=svg&walker=1&localize=1&dark=1&filename=dashboard-brand) Hetzelfde merk wordt samengevat op de kaart **Profiel → Je merk**. Lettertypen zijn echt: kies er een uit Google Fonts en Lolly slaat het bestand **op je apparaat** op als merkasset, zodat je typografie ook offline meegaat en er bij het renderen niets wordt opgehaald.

Als je tevreden bent, **exporteer het merk als een `LollyBrand`-pack** - één bestand dat een collega kan importeren om exact hetzelfde palet, dezelfde lettertypen en dezelfde regels te krijgen. Zo verplaatst een merk zich tussen mensen en machines zonder server ertussenin.

> **Merktokens gaan beide kanten op.** Omdat het merk van Lolly DTCG-tokens *is* - het formaat dat Penpot native leest en schrijft en dat Tokens Studio naar Figma brengt - zijn het palet waar je *mee* ontwerpt en het palet dat Lolly *afdwingt* één document, geen twee lijsten die je handmatig synchroon houdt. Zie [Design Tokens](/info/design-tokens.html).

## 2. Breng mee wat je al hebt

Je begint niet bij een leeg blad. Lolly opent het ontwerpwerk en de open formaten die je al hebt.

### Open-source ontwerpbestanden

Afgewerkt werk in **Figma, Penpot, Illustrator, InDesign of een willekeurige SVG-app** hoeft niet opgesloten te blijven in de app waarin je het hebt getekend. Open **Design**, klik op **Ontwerp importeren**, en het bestand opent als een *levende lay-out* - geen platgeslagen plaatje. Elke laag wordt een bewerkbaar vak: tekst blijft herschrijfbaar, vormen blijven vormen, afbeeldingen komen in je bibliotheek terecht en complexe vectorkunst blijft getrouw bewaard. Het is bij aankomst al afgestemd op je merklettertypen en kleurregels.

| Je hebt | Breng het binnen als |
|---|---|
| Een Figma-frame | Native `.fig` (File → Save local copy), of een SVG-export |
| Een Penpot-ontwerp | De `.penpot`-export ervan, of een willekeurige SVG |
| Een Illustrator-bestand | Native `.ai` (PDF-compatibel) of `.pdf` - opent direct |
| Een InDesign-lay-out | `.idml` (File → Export → InDesign Markup) |
| Iets anders | **Elke SVG** - de universele ingang |

De hele import gebeurt **op je apparaat** - het bestand wordt in je browser geparsed en er wordt niets geüpload. Alle details, en precies wat er behouden blijft, staan in [Een ontwerp importeren](/info/design-import.html).

Heb je in plaats daarvan een **PowerPoint-deck**? Sleep de `.pptx` op **Deck Builder** om het dia voor dia te bewerken, meteen passend in je merk - of gebruik **Rebrand a Deck** om hetzelfde deck opnieuw gethematiseerd terug te krijgen, met grafieken en animaties intact.

### Van eenmalig ontwerp naar template

Dit is de beloning: een geïmporteerde lay-out is een gewone Design-sessie, dus zodra je die **opslaat**, staat hij op een URL. Iedereen met Lolly kan die URL openen, de tekst aanpassen, een afbeelding vervangen en zijn eigen versie renderen - zonder ontwerpapp, en de vergrendelde onderdelen blijven vergrendeld. Een eenmalig ontwerp wordt een herbruikbare tool. Dat is het hele idee, bereikt zonder ook maar een regel configuratie te schrijven.

### Open data en open tools

De [community-toolset](/info/builders.html) is open source en merk-onafhankelijk - QR-codes, plattegronden, filters, privacyhulpmiddelen - en rendert tegen *jouw* merk zodra je het activeert.

Voer tools ook met je eigen open data: plak of sleep een **CSV**- of **JSON**-tabel en de herhalende velden van een tool vullen zich daarmee, één afgewerkte asset per rij.

## 3. Maak iets, deel het daarna of automatiseer het

Met een actief merk en je materiaal bij de hand levert elke tool een afgewerkt bestand op:

- <!--i:download--> **Render** elke tool naar **SVG, PDF, PNG, JPG, WebP, video** en meer - op echte drukformaten en fysieke eenheden wanneer je dat nodig hebt. Zie [Exporteren & formaten](/info/exporting.html).
- <!--i:link--> **Deel een link.** Elke tooltoestand is een URL, dus een afgewerkte asset is reproduceerbaar en via parameters aan te spreken - commit de link, genereer opnieuw wanneer nodig.
- <!--i:layers--> **Doe het in bulk.** Stuur een template aan vanuit een spreadsheet in de [batch-grid](/info/exporting.html): één afgewerkte asset per rij.
- <!--i:cpu--> **Automatiseer het.** Dezelfde render draait vanaf de [CLI](/info/cli.html) en vanuit een [AI-agent](/info/ai-agents.html) - een URL is de API.

"Een URL is de API" is letterlijk bedoeld. De grafiek hieronder is door niemand getekend: het type, de kop en de hele datatabel zijn in de adresbalk getypt, en dezelfde link rendert dezelfde grafiek op elk apparaat.

![Een vlakdiagram van maandelijkse aanmeldingen, waarvan elke waarde als queryparameter binnenkwam in plaats van via een klik](/t/url-shot?url=%2F%23%2Ftool%2Fchart%3Fct%3Darea%26d%3DMonth%2CSignups%250AJan%2C120%250AFeb%2C180%250AMar%2C265%250AApr%2C340%250AMay%2C455%26t%3DSignups%2520this%2520year%26full&width=1440&height=900&dpi=192&waitMs=2600&cropSelector=%23tool-canvas&walker=1&format=svg&dark=1&filename=vt-d3-url-chart)

## Waar je hierna heen kunt

Drie paden, afhankelijk van waarvoor je hier bent:

- <!--i:people--> **[Lolly voor makers](/info/creators.html)** - jij maakt dingen. De voordelen, en hoe je het meeste uit de app haalt.
- <!--i:code--> **[Lolly voor bouwers](/info/builders.html)** - jij bouwt tools, integreert en implementeert. De technische documentatie.
- <!--i:shieldcheck--> **[Lolly voor beheerders](/info/operators.html)** - jij bent verantwoordelijk voor merk, beveiliging en uitrol binnen een organisatie.
