# Kom igång

När du kommit till slutet av den här sidan bär dina verktyg dina egna färger och typsnitt, och arbetet du redan har är redo att återanvändas. Du behöver inget konto, och att skapa och exportera sker på din enhet.

::: timeline
- <!--i:sparkle--> **Gör en fil.** [Gör din första fil](/info/make-something.html) tar dig genom en QR-kod på några minuter.
- <!--i:palette--> **Lägg in ditt varumärke.** Börja från en färg, en tokenfil eller en färdig design.
- <!--i:layers--> **Gör fler av samma sort.** Dela en länk, fyll i ett kalkylblad eller kör verktyget från ett skript.
:::

Ny på själva idén? [Vad är Lolly?](/info/what-is-lolly.html) är femminutersintroduktionen, och [Så fungerar Lolly](/info/how-lolly-works.html) visar vem som gör vad.

## Lägg in ditt varumärke

lolly.tools öppnas i **Lolly Demo**, Lollys eget exempel på designsystem; [Möt Lolly Demo](/info/lolly-demo.html) visar vad du tittar på. Ditt designsystem ersätter det: en liten uppsättning designtokens, alltså färger, typsnitt och några regler, som varje verktyg ritar med. Ställ in det en gång, så börjar allt du gör i varumärkets stil.

Välj den väg som passar det du har:

- <!--i:palette--> **En färg.** Öppna **Design System Setup** (`#/start`), ge ditt designsystem ett namn och välj en primärfärg. Lolly härleder en komplett, tillgänglig palett från den, med ljusa och mörka ytor, text och accenter. Välj ett typsnitt så har du ett fungerande varumärke.
- <!--i:upload--> **En tokenfil.** **Add from…**, längst ner i rumsfältet i Design System Setup, tar en tokenfil från DTCG, Tokens Studio eller Penpot, en SVG eller ett `LollyBrand`-paket. Släpp in den så fylls paletten. Medan designsystemet fortfarande är tomt öppnar **Start from a reference** i rummet Overview samma väljare.
- <!--i:pentool--> **En färdig design.** I Design väljer du **Import a design** och släpper en `.fig`-, `.penpot`-, `.ai`-, `.idml`- eller SVG-fil. Se [Ta in det du redan har](#bring-in-what-you-already-have) nedan.

Första gången du öppnar galleriet erbjuder en kort välkomstdialog samma val: **Make it yours** öppnar Design System Setup, **Bring your design** öppnar en filväljare för en design och **Explore the community tools** stänger välkomstdialogen.

![Rummet Colours i Design System Setup på en ny installation: ett levande färgchip, ett fält och hela det första beslutet](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor&width=1440&height=740&dpi=192&waitMs=1800&format=svg&walker=1&localize=1&dark=1&filename=brand-colours)

Därifrån tar sju rum dig så långt du vill, i valfri ordning: **Overview**, **Colours**, **Type**, **Logos**, **Tokens**, **Files** och **Usage & rules**. Varje förhandsvisning i appen uppdateras medan du skriver. [Design System Setup](/info/brand-studio.html) går igenom varje rum.

Typsnitt sparas på din enhet. Välj ett Google Font så lagrar Lolly filen som en varumärkestillgång, så att din typografi följer med offline och inget hämtas när ett verktyg ritar.

### Se, byt och dela ett designsystem

- **Se det aktiva.** **Settings → Design system** visar det aktiva designsystemet som ett omslag och sidor, skrivskyddat.
- **Byt mellan dem.** **Settings → Preferences → Design systems** listar varje designsystem på den här enheten. En organisation kan driva flera designsystem, eller ett med flera färgvarianter; [Brand architectures](/info/brand-architectures.html) kartlägger upplägget.
- **Dela ett.** Exportera designsystemet som ett `LollyBrand`-paket: en fil som en kollega importerar för att få samma palett, typsnitt och regler.

Ett designsystem som ditt bygge eller din organisation tillhandahåller är **hanterat**: det visar ett lås och förblir skrivskyddat. För att ändra ett gör du en redigerbar kopia från **Settings → Preferences → Design systems**.

![Fliken Design system i Settings: det aktiva designsystemet som ett omslag och sidor](/t/url-shot?url=%2F%23%2Fd%3Ftab%3Dbrand&width=1440&height=900&dpi=192&waitMs=1800&format=svg&walker=1&localize=1&dark=1&filename=dashboard-brand&waitSelector=%5Bdata-issue-ready%5D)

Ditt designsystem är DTCG-tokens, formatet som Penpot läser och skriver och som Tokens Studio tar med till Figma, så paletten du designar med och paletten Lolly tillämpar är ett och samma dokument. [Design Tokens](/info/design-tokens.html) har detaljerna.

::: details För utvecklare: bygg ett varumärkespaket från kommandoraden
För att sätta upp ett återanvändbart varumärkespaket i en utcheckning tar `ingest:brand` de tre behållarna som Penpot och Tokens Studio exporterar: en enda `tokens.json`, en katalog med filer per uppsättning med `$metadata.json`, eller ett `project.penpot`-arkiv.

```bash
pnpm run ingest:brand ./my-tokens.json --name acme --label "Acme" --activate
```

`--activate` registrerar varumärket som en profil och bygger och validerar dess katalog. Det ändrar aldrig standardprofilen: kör med `LOLLY_PROFILE=acme` för att använda det nya paketet. [Configuration](/info/configuration.html) förklarar hur varumärkespaket och profiler hänger ihop.
:::

## Ta in det du redan har

Du börjar inte från en tom sida.

**Designfiler.** Färdigt arbete från Figma, Penpot, Illustrator, InDesign eller valfri SVG-app öppnas i Design som en levande layout: text förblir omskrivbar, former förblir former och bilder hamnar i ditt bibliotek. Filen läses i din webbläsare och inget laddas upp. [Import a design](/info/design-import.html) listar varje format och vad som följer med.

**Presentationer.** Släpp en PowerPoint-`.pptx` på Lolly för att arkivera dess bilder som tillgångar, skriv en ny presentation från Markdown i **Markdown Slides**, eller använd [Rebrand a deck](/info/rebrand.html) för att flytta hela presentationen till ditt designsystem.

**Data.** Klistra in eller släpp en CSV- eller JSON-tabell så fylls ett verktygs upprepade fält från den, eller så gör [Batch](/info/batch.html#make-many-versions-of-one-design) en färdig fil per rad.

### Från engångsjobb till mall

En importerad layout är en vanlig Design-session. **Share with rules** gör den till ett verktyg: du väljer vilka delar andra får ändra, och de fyller bara i dem.

![Behåll Design-mastern, välj indata och gränser i en författarkopia, dela sedan ett återanvändbart .lolly-verktyg som mottagarna fyller i](/info/diagrams/concepts/share-with-rules.svg)

[Dela en design med regler](/info/create-a-tool.html) går igenom varje steg.

## Gör många, dela och automatisera

- <!--i:download--> **Exportera.** Verktyg skapar SVG, PDF, PNG, JPG, WebP, video och mer, i de format varje verktyg erbjuder, i verkliga tryckstorlekar när du behöver det. Se [Exportera en fil](/info/exporting.html).
- <!--i:link--> **Dela en länk.** Ett verktygs inställningar följer med i dess länk, så länken öppnar samma fil var som helst.
- <!--i:layers--> **Gör en per rad.** Styr ett verktyg från ett kalkylblad i [Batch](/info/batch.html#make-many-versions-of-one-design).
- <!--i:cpu--> **Automatisera.** Samma rendering körs från [CLI](/info/cli.html) och från en [AI-agent](/info/ai-agents.html).

En länk är en komplett begäran. Ingen ritade diagrammet nedan: dess typ, rubrik och hela datatabell skrevs in i adressfältet, och samma länk ritar samma diagram på vilken enhet som helst.

![Ett ytdiagram över månatliga registreringar, där varje värde kom in som en frågeparameter istället för ett klick](/t/url-shot?url=%2F%23%2Ftool%2Fchart%3Fct%3Darea%26d%3DMonth%2CSignups%250AJan%2C120%250AFeb%2C180%250AMar%2C265%250AApr%2C340%250AMay%2C455%26t%3DSignups%2520this%2520year%26full&width=1440&height=900&dpi=192&waitMs=2600&cropSelector=%23tool-canvas&walker=1&format=svg&dark=1&filename=vt-d3-url-chart)

## Vart du ska gå härnäst

- <!--i:people--> **[Skapa](/info/creators.html)**: att skapa, animera, spela in, dela och exportera.
- <!--i:code--> **[Automatisera](/info/builders.html)**: designsystem, verktygsutveckling, kommandoraden, länkar och agenter.
- <!--i:usercheck--> **[Hantera](/info/operators.html)**: att driva Lolly för ett team med Lolly Work.
- <!--i:server--> **[Driftsätt](/info/operate.html)**: att hosta Lolly och Lolly Work.
- <!--i:shieldcheck--> **[Förtroende](/info/trust.html)**: integritet, säkerhet och att själv kontrollera en fil.
