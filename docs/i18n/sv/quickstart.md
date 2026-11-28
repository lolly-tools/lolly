# Start

Ställ in verktygen med dina egna färger och typsnitt och återanvänd det arbete du redan har. Du behöver inget konto, och skapande och export sker på din enhet.

::: steps
- <!--i:eti-sparkles--> **[Skapa en fil](/info/make-something.html)** En QR-kod på några minuter, med varje steg visat.
- <!--i:eti-palette--> **[Lägg in ditt varumärke](#put-your-brand-in)** Börja med en färg, en tokenfil eller en färdig design.
- <!--i:eti-folder-move--> **[Ta med ditt arbete](#bring-in-what-you-already-have)** Designer, presentationer och data som du redan har, lästa på din enhet.
- <!--i:eti-repeat--> **[Skapa fler av samma slag](#make-many-share-and-automate)** Dela en länk, fyll ett kalkylblad eller kör verktyget från ett skript.
:::

[Vad är Lolly?](/info/what-is-lolly.html) är en fem minuters introduktion. [Så fungerar Lolly](/info/how-lolly-works.html) visar vem som gör vad.

<!--i:eti-palette-->
## Lägg in ditt varumärke

lolly.tools öppnas med **Lolly Demo**, Lollys eget exempeldesignsystem ([Möt Lolly Demo](/info/lolly-demo.html)). Ditt designsystem ersätter Lolly Demo. Det är en liten uppsättning designtokens (färger, typsnitt och några regler) som varje verktyg ritar med. Ställ in det en gång så följer allt du skapar ditt varumärke från början.

Välj den väg som passar det du har:

- <!--i:palette--> **En färg.** Öppna vyn **Design System Setup** (`#/start`), namnge ditt designsystem och välj en primärfärg. Lolly härleder en tillgänglig palett från den färgen, med ljusa och mörka ytor, text och accenter. Välj ett typsnitt så har du ett fungerande varumärke.
- <!--i:upload--> **En tokenfil.** **Add from…**, högst upp i Lolly Design System Setup, tar emot en DTCG-tokenfil, en tokenfil från Tokens Studio eller Penpot, en SVG eller ett `LollyBrand`-paket. Paletten fylls från filen. När designsystemet är tomt öppnar **Start from a reference** på Board samma väljare.
- <!--i:pentool--> **En färdig design.** I Lolly Design väljer du **Import a design** och släpper en Figma-, Penpot-, Illustrator-, InDesign-, Affinity-, Photoshop-, PowerPoint- eller SVG-fil ([alla format](/info/design-import.html#what-comes-in-from-each-app)). Se [Ta med det du redan har](#bring-in-what-you-already-have) nedan.

Första gången du öppnar galleriet erbjuder en hälsning högst upp ett nästa steg. På lolly.tools öppnar **Start making** Lolly Design med Launch-affischen. På en ny installation öppnar **Make it yours** Lolly Design System Setup. Under den knappen öppnar **Bring a file** en filväljare för en design, och det andra av de två alternativen visas som en länk. Vilket som helst av dessa, eller stängningsknappen, tar bort hälsningen för gott.

![Rummet Colours i Lolly Design System Setup för ett nytt designsystem: ett levande färgprov, ett fält och hela det första beslutet](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor&system=new-design-system&width=1440&height=740&dpi=192&waitMs=1800&format=svg&walker=1&dark=1&filename=bs-colours-new-system)

Åtta rum, som kan användas i valfri ordning, tar designsystemet vidare: **Board**, **Colours**, **Type**, **Logos**, **Tokens**, **Files**, **Rules** och **Skills**. Varje förhandsvisning i appen uppdateras medan du skriver. [Lolly Design System Setup](/info/brand-studio.html) beskriver varje rum.

Typsnitt sparas på din enhet. Ett Google Font som du väljer lagras som en varumärkestillgång, så att din typografi fungerar offline och inget hämtas när ett verktyg ritar.

### Visa, byt och dela ett designsystem

- **Visa det aktiva.** **Settings → Design system** visar det aktiva designsystemet som ett omslag och sidor, skrivskyddat.
- **Byt mellan dem.** **Settings → Preferences → Design systems** listar alla designsystem på den här enheten. En organisation kan använda flera designsystem eller ett med flera färgvarianter. [Varumärkesarkitekturer](/info/brand-architectures.html) kartlägger uppläggen.
- **Dela ett.** Exportera designsystemet som ett `LollyBrand`-paket: en fil som en kollega importerar för att få samma palett, typsnitt och regler.

Ett designsystem som följer med din version eller tillhandahålls av din organisation är **hanterat**: det visas med ett lås och är skrivskyddat. Om du vill ändra det skapar du en redigerbar kopia under **Settings → Preferences → Design systems**.

![Fliken Design system i Settings: det aktiva designsystemet som ett omslag och sidor](/t/url-shot?url=%2F%23%2Fd%3Ftab%3Dbrand&width=1440&height=900&dpi=192&waitMs=1800&format=svg&walker=1&localize=1&dark=1&filename=dashboard-brand&waitSelector=%5Bdata-issue-ready%5D)

Ditt designsystem består av DTCG-tokens, det format som Penpot läser och skriver och som Tokens Studio tar in i Figma. Paletten du designar med och paletten Lolly tillämpar är ett och samma dokument. [Designtokens](/info/design-tokens.html) beskriver detaljerna.

::: details För utvecklare: bygg ett varumärkespaket från kommandoraden
`ingest:brand` bygger ett återanvändbart varumärkespaket i en utcheckad kodbas. Det stöder de tre behållare som Penpot och Tokens Studio exporterar: en enda `tokens.json`, en katalog med filer för varje uppsättning och `$metadata.json` eller ett `project.penpot`-arkiv.

```bash
pnpm run ingest:brand ./my-tokens.json --name acme --label "Acme" --activate
```

`--activate` registrerar varumärket som en profil och bygger och validerar dess katalog. Det ändrar aldrig standardprofilen: kör med `LOLLY_PROFILE=acme` för att använda det nya paketet. [Konfiguration](/info/configuration.html) förklarar hur varumärkespaket och profiler hänger ihop.
:::

<!--i:eti-folder-move-->
## Ta in det du redan har

**Lolly Design-filer.** Färdigt arbete från Figma, Penpot, Illustrator, InDesign eller en SVG-app öppnas i Lolly Design som en redigerbar layout. Text går fortfarande att ändra, former förblir former och bilder hamnar i ditt bibliotek. Filen läses i din webbläsare och inget laddas upp. [Importera en design](/info/design-import.html) listar varje format och vad som bevaras.

**Presentationer.** Släpp en PowerPoint-fil i formatet `.pptx` på Lolly för att spara dess bilder som tillgångar. Skriv en ny presentation från Markdown i **Lolly Markdown Slides**. [Byt varumärke på en presentation](/info/rebrand.html) överför en presentation till ditt designsystem.

**Data.** Klistra in eller släpp en CSV- eller JSON-tabell för att fylla i ett verktygs upprepade fält. [Lolly Batch](/info/batch.html#make-many-versions-of-one-design) skapar en färdig fil per rad.

### Från engångsjobb till mall

En importerad layout är en vanlig Lolly Design-session. **Share with rules** gör sessionen till ett verktyg. Du väljer vilka delar andra får ändra, och de fyller bara i dem.

![Behåll originalet i Lolly Design, välj indata och gränser i en redigeringskopia och dela sedan ett återanvändbart .lolly-verktyg som mottagarna fyller i](/info/diagrams/concepts/share-with-rules.svg)

[Dela en design med regler](/info/create-a-tool.html) går igenom varje steg.

<!--i:eti-repeat-->
## Skapa många, dela och automatisera

- <!--i:download--> **Exportera.** Verktygen skapar SVG, PDF, PNG, JPG, WebP, video och mer, i verkliga tryckstorlekar när det behövs. Varje verktyg har sina egna format. Se [Exportera en fil](/info/exporting.html).
- <!--i:link--> **Dela en länk.** Ett verktygs inställningar följer med i länken, så länken öppnar samma fil var som helst.
- <!--i:layers--> **Skapa en per rad.** Styr ett verktyg från ett kalkylblad i [Lolly Batch](/info/batch.html#make-many-versions-of-one-design).
- <!--i:cpu--> **Automatisera.** Samma rendering körs från [CLI](/info/cli.html) och från en [AI-agent](/info/ai-agents.html).

En länk är en fullständig begäran. Diagramtypen, rubriken och datatabellen i diagrammet nedan skrevs in i adressfältet.

![Ett stapeldiagram över registreringar per månad och kanal i designsystemets färger, där varje värde kom som en frågeparameter i stället för ett klick](/t/url-shot?url=%2F%23%2Ftool%2Fchart%3Fct%3Dbar%26sty%3Dposter%26pl%3Droles%26transparentBg%3Dfalse%26d%3DMonth%2CWeb%2CApp%2CPartners%250AJan%2C120%2C60%2C25%250AFeb%2C180%2C95%2C40%250AMar%2C265%2C150%2C70%250AApr%2C340%2C210%2C110%250AMay%2C455%2C290%2C160%250AJun%2C560%2C380%2C230%26t%3DSignups%2520this%2520year%26st%3DBy%2520channel%252C%2520January%2520to%2520June%26full&width=1440&height=900&dpi=192&waitMs=4000&cropSelector=%23tool-canvas&walker=1&format=svg&dark=1&filename=vt-d3-url-chart)

<!--i:eti-map-pin-->
## Gå vidare

- <!--i:people--> **[Skapa](/info/creators.html)**: skapa, animera, spela in, dela och exportera.
- <!--i:code--> **[Automatisera](/info/builders.html)**: designsystem, skapa verktyg, kommandoraden, länkar och agenter.
- <!--i:usercheck--> **[Hantera](/info/operators.html)**: köra Lolly för ett team med Lolly Work.
- <!--i:server--> **[Driftsätt](/info/operate.html)**: vara värd för Lolly och Lolly Work.
- <!--i:shieldcheck--> **[Tillit](/info/trust.html)**: integritet, säkerhet och att själv kontrollera en fil.
