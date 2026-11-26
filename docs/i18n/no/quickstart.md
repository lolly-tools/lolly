# Start

Sett verktøyene til dine egne farger og skrifter, og bruk arbeidet du allerede har på nytt. Du trenger ingen konto, og arbeidet og eksporten kjører på enheten din.

::: steps
- <!--i:eti-sparkles--> **[Lag én fil](/info/make-something.html)** En QR-kode på noen få minutter, med hvert trinn vist.
- <!--i:eti-palette--> **[Legg inn merkevaren din](#put-your-brand-in)** Start med én farge, en tokenfil eller et ferdig design.
- <!--i:eti-folder-move--> **[Hent inn arbeidet ditt](#bring-in-what-you-already-have)** Design, presentasjoner og data du allerede har, lest på enheten din.
- <!--i:eti-repeat--> **[Lag mer av det samme](#make-many-share-and-automate)** Del en lenke, fyll ut et regneark eller kjør verktøyet fra et skript.
:::

[Hva er Lolly?](/info/what-is-lolly.html) er en fem minutters introduksjon. [Slik fungerer Lolly](/info/how-lolly-works.html) viser hvem som gjør hva.

<!--i:eti-palette-->
## Legg inn merkevaren din

lolly.tools åpnes i **Lolly Demo**, Lollys eget eksempeldesignsystem ([Møt Lolly Demo](/info/lolly-demo.html)). Designsystemet ditt erstatter Lolly Demo. Det er et lite sett med designtokener (farger, skrifter og noen få regler) som hvert verktøy tegner med. Sett det opp én gang, så følger alt du lager, merkevaren fra starten av.

Velg veien som passer det du har:

- <!--i:palette--> **Én farge.** Åpne visningen **Design System Setup** (`#/start`), gi designsystemet et navn og velg en primærfarge. Lolly utleder en tilgjengelig palett fra den fargen, med lyse og mørke flater, tekst og aksenter. Velg en skrift, så har du en fungerende merkevare.
- <!--i:upload--> **En tokenfil.** **Add from…**, øverst i Lolly Design System Setup, tar imot en DTCG-, Tokens Studio- eller Penpot-tokenfil, en SVG eller en `LollyBrand`-pakke. Paletten fylles fra filen. Mens designsystemet er tomt, åpner **Start from a reference** på Board den samme velgeren.
- <!--i:pentool--> **Et ferdig design.** I Lolly Design velger du **Import a design** og slipper en Figma-, Penpot-, Illustrator-, InDesign-, Affinity-, Photoshop-, PowerPoint- eller SVG-fil ([alle formater](/info/design-import.html#what-comes-in-from-each-app)). Se [Hent inn det du allerede har](#bring-in-what-you-already-have) nedenfor.

Første gang du åpner galleriet, tilbyr en velkomsthilsen øverst ett neste trinn. På lolly.tools åpner **Start making** Lolly Design med Launch-plakaten. På en ny installasjon åpner **Make it yours** Lolly Design System Setup. Under den knappen åpner **Bring a file** en filvelger for et design, og det andre av de to valgene vises som en lenke. Alle disse, eller lukkeknappen, fjerner velkomsthilsenen for godt.

![Colours-rommet i Lolly Design System Setup med et nytt designsystem: én levende fargebrikke, ett felt og hele den første avgjørelsen](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor&system=new-design-system&width=1440&height=740&dpi=192&waitMs=1800&format=svg&walker=1&dark=1&filename=bs-colours-new-system)

Åtte rom, brukt i hvilken som helst rekkefølge, tar designsystemet videre: **Board**, **Colours**, **Type**, **Logos**, **Tokens**, **Files**, **Rules** og **Skills**. Hver forhåndsvisning i appen oppdateres mens du skriver. [Lolly Design System Setup](/info/brand-studio.html) dekker hvert rom.

Skrifter beholdes på enheten din. En Google Font du velger, lagres som en merkevareressurs, så skriftene dine fungerer uten nett og ingenting hentes når et verktøy tegner.

### Se, bytt og del et designsystem

- **Se det aktive.** **Settings → Design system** viser det aktive designsystemet som et omslag og sider, skrivebeskyttet.
- **Bytt mellom dem.** **Settings → Preferences → Design systems** lister alle designsystemene på denne enheten. Én organisasjon kan bruke flere designsystemer, eller ett med flere fargevarianter. [Merkevarearkitekturer](/info/brand-architectures.html) kartlegger oppsettene.
- **Del ett.** Eksporter designsystemet som en `LollyBrand`-pakke: én fil en kollega importerer for å få den samme paletten, skriftene og reglene.

Et designsystem som følger med byggversjonen eller leveres av organisasjonen din, er **administrert**: det viser en lås og er skrivebeskyttet. For å endre det lager du en redigerbar kopi fra **Settings → Preferences → Design systems**.

![Fanen Design system i Settings: det aktive designsystemet som omslag og sider](/t/url-shot?url=%2F%23%2Fd%3Ftab%3Dbrand&width=1440&height=900&dpi=192&waitMs=1800&format=svg&walker=1&localize=1&dark=1&filename=dashboard-brand&waitSelector=%5Bdata-issue-ready%5D)

Designsystemet ditt består av DTCG-tokener, formatet Penpot leser og skriver og Tokens Studio tar med til Figma. Paletten du designer med og paletten Lolly bruker, er ett dokument. [Designtokener](/info/design-tokens.html) har detaljene.

::: details For utviklere: bygg en merkevarepakke fra kommandolinjen
`ingest:brand` bygger en gjenbrukbar merkevarepakke i en lokal utsjekking. Det godtar de tre beholdertypene Penpot og Tokens Studio eksporterer: én `tokens.json`, en mappe med én fil per sett og `$metadata.json` eller et `project.penpot`-arkiv.

```bash
pnpm run ingest:brand ./my-tokens.json --name acme --label "Acme" --activate
```

`--activate` registrerer merkevaren som en profil og bygger og validerer katalogen. Det endrer aldri standardprofilen: kjør med `LOLLY_PROFILE=acme` for å bruke den nye pakken. [Konfigurasjon](/info/configuration.html) forklarer hvordan merkevarepakker og profiler henger sammen.
:::

<!--i:eti-folder-move-->
## Hent inn det du allerede har

**Lolly Design-filer.** Ferdig arbeid fra Figma, Penpot, Illustrator, InDesign eller en hvilken som helst SVG-app åpnes i Lolly Design som en redigerbar layout. Tekst kan fortsatt skrives om, former forblir former og bilder havner i biblioteket ditt. Filen leses i nettleseren din, og ingenting lastes opp. [Importer et design](/info/design-import.html) lister hvert format og hva som beholdes.

**Presentasjoner.** Slipp en PowerPoint-`.pptx` på Lolly for å lagre lysbildene som ressurser. Skriv en ny presentasjon fra Markdown i **Lolly Markdown Slides**. [Gi en presentasjon ny profil](/info/rebrand.html) tilpasser en presentasjon til designsystemet ditt.

**Data.** Lim inn eller slipp en CSV- eller JSON-tabell for å fylle ut de repeterende feltene i et verktøy. [Lolly Batch](/info/batch.html#make-many-versions-of-one-design) lager én ferdig fil per rad.

### Fra engangsarbeid til mal

En importert layout er en vanlig Lolly Design-økt. **Share with rules** gjør økten om til et verktøy. Du velger hvilke deler andre kan endre, og de fyller bare ut disse.

![Behold originalen i Lolly Design, velg inndata og grenser i en forfatterkopi og del deretter et gjenbrukbart .lolly-verktøy som mottakerne fyller ut](/info/diagrams/concepts/share-with-rules.svg)

[Del et design med regler](/info/create-a-tool.html) går gjennom hvert trinn.

<!--i:eti-repeat-->
## Lag mange, del og automatiser

- <!--i:download--> **Eksporter.** Verktøy lager SVG, PDF, PNG, JPG, WebP, video og mer, i faktiske trykkstørrelser ved behov. Hvert verktøy tilbyr sine egne formater. Se [Eksporter en fil](/info/exporting.html).
- <!--i:link--> **Del en lenke.** Innstillingene til et verktøy følger med i lenken, slik at lenken åpner den samme filen igjen hvor som helst.
- <!--i:layers--> **Lag én per rad.** Styr et verktøy fra et regneark i [Lolly Batch](/info/batch.html#make-many-versions-of-one-design).
- <!--i:cpu--> **Automatiser.** Den samme gjengivelsen kjøres fra [CLI](/info/cli.html) og fra en [KI-agent](/info/ai-agents.html).

En lenke er en fullstendig forespørsel. Typen, overskriften og datatabellen til diagrammet nedenfor ble skrevet inn i adressefeltet.

![Et stolpediagram over månedlige registreringer per kanal i designsystemets farger, der hver verdi kom inn som en spørringsparameter i stedet for et klikk](/t/url-shot?url=%2F%23%2Ftool%2Fchart%3Fct%3Dbar%26sty%3Dposter%26pl%3Droles%26transparentBg%3Dfalse%26d%3DMonth%2CWeb%2CApp%2CPartners%250AJan%2C120%2C60%2C25%250AFeb%2C180%2C95%2C40%250AMar%2C265%2C150%2C70%250AApr%2C340%2C210%2C110%250AMay%2C455%2C290%2C160%250AJun%2C560%2C380%2C230%26t%3DSignups%2520this%2520year%26st%3DBy%2520channel%252C%2520January%2520to%2520June%26full&width=1440&height=900&dpi=192&waitMs=4000&cropSelector=%23tool-canvas&walker=1&format=svg&dark=1&filename=vt-d3-url-chart)

<!--i:eti-map-pin-->
## Veien videre

- <!--i:people--> **[Skap](/info/creators.html)**: lage, animere, ta opp, dele og eksportere.
- <!--i:code--> **[Automatiser](/info/builders.html)**: designsystemer, verktøyutvikling, kommandolinjen, lenker og agenter.
- <!--i:usercheck--> **[Administrer](/info/operators.html)**: drive Lolly for et team med Lolly Work.
- <!--i:server--> **[Sett i drift](/info/operate.html)**: drifte Lolly og Lolly Work.
- <!--i:shieldcheck--> **[Tillit](/info/trust.html)**: personvern, sikkerhet og egen kontroll av en fil.
