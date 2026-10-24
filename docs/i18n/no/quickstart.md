# Kom i gang

Når du er ferdig med denne siden, bruker verktøyene dine dine egne farger og skrifter, og arbeidet du allerede har, er klart til å brukes på nytt. Du trenger ingen konto, og både å lage og å eksportere skjer på enheten din.

::: timeline
- <!--i:sparkle--> **Lag én fil.** [Make your first file](/info/make-something.html) tar deg gjennom en QR-kode på noen få minutter.
- <!--i:palette--> **Legg merkevaren din inn.** Start fra én farge, en tokens-fil eller et ferdig design.
- <!--i:layers--> **Lag flere av det samme.** Del en lenke, fyll et regneark eller kjør verktøyet fra et skript.
:::

Ny på selve ideen? [What is Lolly?](/info/what-is-lolly.html) er femminuttersintroduksjonen, og [How Lolly works](/info/how-lolly-works.html) viser hvem som gjør hva.

## Legg merkevaren din inn

lolly.tools åpner i **Lolly Demo**, Lollys eget eksempel på et designsystem; [Meet Lolly Demo](/info/lolly-demo.html) viser hva du ser på. Ditt designsystem erstatter det: et lite sett med designtokens, altså farger, skrifter og noen få regler, som hvert verktøy tegner med. Sett det opp én gang, så starter alt du lager på merkevaren.

Velg ruten som passer det du har:

- <!--i:palette--> **Én farge.** Åpne **Design System Setup** (`#/start`), gi designsystemet et navn og velg en primærfarge. Lolly utleder en komplett, tilgjengelig palett fra den, med lyse og mørke flater, tekst og aksenter. Velg en skrift, så har du en fungerende merkevare.
- <!--i:upload--> **En tokens-fil.** **Add from…**, nederst i romlisten i Design System Setup, tar en DTCG-, Tokens Studio- eller Penpot-tokens-fil, en SVG eller en `LollyBrand`-pakke. Slipp den inn, så fylles paletten. Mens designsystemet fortsatt er tomt, åpner **Start from a reference** i rommet Overview den samme velgeren.
- <!--i:pentool--> **Et ferdig design.** I Design velger du **Import a design** og slipper en `.fig`-, `.penpot`-, `.ai`-, `.idml`- eller SVG-fil. Se [Bring in what you already have](#bring-in-what-you-already-have) nedenfor.

Første gang du åpner galleriet, tilbyr en kort velkomst de samme valgene: **Make it yours** åpner Design System Setup, **Bring your design** åpner en filvelger for et design og **Explore the community tools** lukker velkomsten.

![Rommet Colours i Design System Setup på en ny installasjon: ett levende fargefelt, ett inndatafelt og hele den første beslutningen](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor&width=1440&height=740&dpi=192&waitMs=1800&format=svg&walker=1&localize=1&dark=1&filename=brand-colours)

Derfra tar sju rom deg så langt du vil, i hvilken som helst rekkefølge: **Overview**, **Colours**, **Type**, **Logos**, **Tokens**, **Files** og **Usage & rules**. Hver forhåndsvisning i appen oppdateres mens du skriver. [Design System Setup](/info/brand-studio.html) dekker hvert rom.

Skrifter lagres på enheten din. Velg en Google Font, så lagrer Lolly filen som en merkevareressurs, slik at skriften din følger med uten nett og ingenting hentes når et verktøy tegner.

### Se, bytt og del et designsystem

- **Se det aktive.** **Settings → Design system** viser det aktive designsystemet som et omslag og sider, skrivebeskyttet.
- **Bytt mellom dem.** **Settings → Preferences → Design systems** lister alle designsystemer på denne enheten. Én organisasjon kan ha flere designsystemer, eller ett med flere fargevarianter; [Brand architectures](/info/brand-architectures.html) kartlegger ordningene.
- **Del ett.** Eksporter designsystemet som en `LollyBrand`-pakke: én fil en kollega importerer for å få samme palett, skrifter og regler.

Et designsystem som bygget eller organisasjonen din leverer, er **administrert**: det viser en lås og forblir skrivebeskyttet. For å endre ett, lag en redigerbar kopi fra **Settings → Preferences → Design systems**.

![Fanen Design system i Settings: det aktive designsystemet som et omslag og sider](/t/url-shot?url=%2F%23%2Fd%3Ftab%3Dbrand&width=1440&height=900&dpi=192&waitMs=1800&format=svg&walker=1&localize=1&dark=1&filename=dashboard-brand&waitSelector=%5Bdata-issue-ready%5D)

Designsystemet ditt er DTCG-tokens, formatet Penpot leser og skriver og Tokens Studio tar med til Figma, så paletten du designer med og paletten Lolly bruker, er ett og samme dokument. [Design Tokens](/info/design-tokens.html) har detaljene.

::: details For utviklere: bygg en merkevarepakke fra kommandolinjen
For å sette opp en gjenbrukbar merkevarepakke i en utsjekk, godtar `ingest:brand` de tre beholderne Penpot og Tokens Studio eksporterer: én enkelt `tokens.json`, en mappe med filer per sett med `$metadata.json`, eller et `project.penpot`-arkiv.

```bash
pnpm run ingest:brand ./my-tokens.json --name acme --label "Acme" --activate
```

`--activate` registrerer merkevaren som en profil og bygger og validerer katalogen. Den endrer aldri standardprofilen: kjør med `LOLLY_PROFILE=acme` for å bruke den nye pakken. [Configuration](/info/configuration.html) forklarer hvordan merkevarepakker og profiler henger sammen.
:::

## Ta med det du allerede har

Du starter ikke fra en blank side.

**Designfiler.** Ferdig arbeid fra Figma, Penpot, Illustrator, InDesign eller en hvilken som helst SVG-app åpnes i Design som en levende layout: tekst kan fortsatt skrives på nytt, former forblir former og bilder havner i biblioteket ditt. Filen leses i nettleseren din, og ingenting lastes opp. [Import a design](/info/design-import.html) lister hvert format og hva som følger med.

**Presentasjoner.** Slipp en PowerPoint `.pptx` på Lolly for å arkivere lysbildene som ressurser, skriv en ny presentasjon fra Markdown i **Markdown Slides**, eller bruk [Rebrand a deck](/info/rebrand.html) for å flytte hele presentasjonen over på designsystemet ditt.

**Data.** Lim inn eller slipp en CSV- eller JSON-tabell, så fylles et verktøys repeterende felt fra den, eller [Batch](/info/batch.html#make-many-versions-of-one-design) lager én ferdig fil per rad.

### Fra engangsjobb til mal

En importert layout er en vanlig Design-økt. **Share with rules** gjør den til et verktøy: du velger hvilke deler andre kan endre, og de fyller bare ut de.

![Behold Design-masteren, velg inndata og grenser i en forfatterkopi, og del deretter et gjenbrukbart .lolly-verktøy som mottakerne fyller ut](/info/diagrams/concepts/share-with-rules.svg)

[Share a design with rules](/info/create-a-tool.html) går gjennom hvert trinn.

## Lag mange, del og automatiser

- <!--i:download--> **Eksporter.** Verktøy lager SVG, PDF, PNG, JPG, WebP, video og mer, i formatene hvert verktøy tilbyr, i ekte trykkstørrelser når du trenger det. Se [Export a file](/info/exporting.html).
- <!--i:link--> **Del en lenke.** Et verktøys innstillinger følger med i lenken, så lenken åpner den samme filen igjen overalt.
- <!--i:layers--> **Lag én per rad.** Styr et verktøy fra et regneark i [Batch](/info/batch.html#make-many-versions-of-one-design).
- <!--i:cpu--> **Automatiser.** Den samme gjengivelsen kjører fra [CLI](/info/cli.html) og fra en [AI-agent](/info/ai-agents.html).

En lenke er en komplett forespørsel. Ingen tegnet diagrammet nedenfor: typen, overskriften og hele datatabellen ble skrevet inn i adressefeltet, og den samme lenken tegner det samme diagrammet på alle enheter.

![Et arealdiagram over månedlige registreringer, der hver verdi kom inn som en spørreparameter i stedet for et klikk](/t/url-shot?url=%2F%23%2Ftool%2Fchart%3Fct%3Darea%26d%3DMonth%2CSignups%250AJan%2C120%250AFeb%2C180%250AMar%2C265%250AApr%2C340%250AMay%2C455%26t%3DSignups%2520this%2520year%26full&width=1440&height=900&dpi=192&waitMs=2600&cropSelector=%23tool-canvas&walker=1&format=svg&dark=1&filename=vt-d3-url-chart)

## Hvor du går videre

- <!--i:people--> **[Create](/info/creators.html)**: lage, animere, spille inn, dele og eksportere.
- <!--i:code--> **[Automate](/info/builders.html)**: designsystemer, verktøyforfatting, kommandolinjen, lenker og agenter.
- <!--i:usercheck--> **[Manage](/info/operators.html)**: å kjøre Lolly for et team med Lolly Work.
- <!--i:server--> **[Deploy](/info/operate.html)**: å drifte Lolly og Lolly Work.
- <!--i:shieldcheck--> **[Trust](/info/trust.html)**: personvern, sikkerhet og å sjekke en fil selv.
