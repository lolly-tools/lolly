# Nettleserutvidelse

En nettside kan ikke lese pikslene på et annet nettsted. I en Chromium-basert nettleser (Chrome, Edge, Brave, Arc eller Opera, fra Chrome 111) lar den gratis utvidelsen **Lolly URL Screenshot** Lolly-nettappen ta skjermbilder av en side med samme opptaksmetode som skrivebordsappen bruker. Med utvidelsen installert:

- **[Lolly URL Screenshot](/t/url-shot)** lagrer siden du satte sammen, som en fil;
- en nettadresse limt inn i et bildefelt kan bli et skjermbilde av den siden, med **Screenshot this page**;
- kilden **Website** i [Lolly Design System Setup](/info/brand-studio.html) kan lese én side for å starte et designsystem.

Du godkjenner hver forespørsel, og skrivebordsappen gjør de samme jobbene uten utvidelsen.

<!--i:eti-checklist-->
## Før du installerer

Uten utvidelsen åpnes **Lolly URL Screenshot** fortsatt, og du kan sette sammen et skjermbilde. En merknad øverst i verktøyets kontroller sier hva som mangler.

![Merknaden i URL Screenshot-verktøyet som tilbyr utvidelsen, vist når skjermbilde til fil ikke har noen vert å kjøre på](/t/url-shot?url=%2F%23%2Ftool%2Furl-shot&width=1440&height=900&dpi=192&waitMs=2400&walker=1&format=svg&cropSelector=%23capture-hint-notice&dark=1&filename=exp-url-shot-notice)

Alle kontroller virker uten utvidelsen: mål-URL-en, rulledybden, ventetiden for stabilisering, beskjæringsmargene og omfargingen. Bare selve opptaket trenger utvidelsen.

![Kontrollene i Lolly URL Screenshot med mål-URL, rulledybde, ventetid for stabilisering og beskjæringsmarger, alle tilgjengelige før utvidelsen er på plass](/t/url-shot?url=%2F%23%2Ftool%2Furl-shot%3Furl%3Dhttps%3A%2F%2Flolly.tools%26scrollDepth%3D0.3%26waitMs%3D1200&width=1440&height=2200&dpi=192&waitMs=2400&format=svg&css=%23tool-canvas%7Bdisplay%3Anone%7D&cropSelector=%23tool-inputs&walker=1&dark=1&filename=fq-url-shot-controls)

<!--i:eti-download-->
## Installer

**Fra Chrome Web Store:** kommer snart. Når utvidelsen er publisert, installeres den med ett klikk.

**Last den inn selv (utviklere).** Kildekoden til utvidelsen ligger i kodelageret under `shells/chrome-extension/`. Pakketrinnet bygger produksjonspakken fra den mappen. Den pakken fungerer bare med Lolly på `https://lolly.tools`.

1. Kjør `pnpm run pack:chrome-extension`. Den bygger pakken i `dist/chrome-extension/`.
2. Åpne `chrome://extensions`.
3. Slå på **Developer mode** (øverst til høyre).
4. Klikk på **Load unpacked** og velg mappen `dist/chrome-extension/`.
5. Last Lolly-fanen på nytt. Lolly oppdager utvidelsen når siden lastes, og meldingen «Get the extension» forsvinner. **Lolly URL Screenshot** (under Utilities) kan da lagre skjermbilder til en fil og fungerer i Lolly Batch-modus.

::: details For en lokal utviklingsserver eller kildemappen
For en lokal utviklingsserver kjører du `pnpm run pack:chrome-extension:dev` og laster inn `dist/chrome-extension-dev` i stedet. Den pakken godtar også `http://localhost:5173` og har **Development** i navnet.

Å laste inn selve mappen `shells/chrome-extension/` fungerer også for PNG-skjermbilder. Den mappen har ingen sidegjennomgang, som pakketrinnet bygger inn. En SVG fra den mappen inneholder et skjermbilde, ikke former.
:::

<!--i:eti-user-check-->
## Hva skjer når Lolly spør

![Lolly-fanen ber om én side, og du trykker Approve once i utvidelsens godkjenningsvindu. En bakgrunnsfane åpnes, leser siden og lukkes. Så får Lolly-fanen resultatet.](/info/diagrams/concepts/extension-request.svg)

1. **Lolly spør.** Et lite skript forteller Lolly at utvidelsen er på plass, så et opptak eller en sidelesing kan starte uten mer oppsett.
2. **Du godkjenner.** Utvidelsen åpner sitt eget **Approve page request**-vindu. Det viser nettstedet som spør, om det ønsker et skjermbilde eller sideinnholdet, og sidens adresse. Ingenting leses før du trykker **Approve once**. **Cancel**, eller å lukke vinduet, avslutter forespørselen.
3. **Chrome spør én gang per nettsted.** Første gang du godkjenner en forespørsel for et nettsted, spør Chrome også om utvidelsen kan få tilgang til nettstedet. Chrome beholder tilgangen når du tillater den, men hver senere forespørsel trenger fortsatt sin egen **Approve once**.
4. **Siden leses i en bakgrunnsfane.** Utvidelsen åpner målsiden i en bakgrunnsfane, tar et skjermbilde gjennom DevTools Protocol (samme `Page.captureScreenshot` som skrivebordsappen bruker), lukker fanen og gir resultatet tilbake til Lolly-fanen som spurte.

::: details Slik fungerer et SVG-opptak
For en **SVG** går utvidelsen gjennom siden i stedet for å ta et bilde av skjermen. Et skript som følger med utvidelsen, leser sidens layout i bakgrunnsfanen og gjør siden om til former og tekst som omriss. Filen holder seg skarp i alle størrelser, og hver del forblir redigerbar. Bilder på siden forblir bilder. Alt siden tegner med et lerret, en video eller en effekt SVG ikke kan uttrykke, kopieres fra et skjermbilde av samme øyeblikk. Lolly sjekker resultatet mot det skjermbildet. Når de to er for ulike, inneholder SVG-en skjermbildet i stedet.

For å tegne teksten som omriss med sidens egen skrifttype gir utvidelsen Lolly skriftfilene siden lastet inn. Chrome oppbevarer ikke skriftens byte der en utvidelse kan lese dem, så utvidelsen ber siden om hver skrift på nytt. Nettleseren svarer vanligvis fra bufferen sin, og sidens egen sikkerhetspolicy gjelder fortsatt for forespørselen.
:::

En godkjenning dekker én forespørsel og utløper etter 30 sekunder. Bare én forespørsel kan vente eller kjøre om gangen, og en godkjent forespørsel stopper etter 55 sekunder. Hvis Lolly-siden lukkes eller endres, eller målsiden flyttes til et annet nettsted, avbrytes forespørselen.

::: warning Opptak bruker nettleserøkten din
Siden lastes med nettleserøkten din, så en side du er logget inn på, kan vise private opplysninger i resultatet.
:::

Opptaket kjører i nettleseren din på nettverket ditt, så `localhost` og interne nettsteder fungerer. Opptaket lastes ikke opp. Den eneste nettverkstrafikken er at nettleseren laster siden du ba om og, for en SVG, sidens skriftfiler en gang til.

Mens et opptak kjører, kan du kort se banneret *«…started debugging this browser»* på den midlertidige fanen. Banneret kommer fra DevTools Protocol og forsvinner når opptaket er ferdig.

<a id="reading-a-site-for-design-system-setup"></a>
<!--i:eti-globe-->
## Lese et nettsted for Lolly Design System Setup

Kilden **Website** i Lolly Design System Setup starter et designsystem fra et nettsted du allerede har. I en Chromium-nettleser leser utvidelsen siden. I skrivebordsappen henter appen siden selv. I en nettleser uten utvidelse tilbys ikke Website-kortet.

- **Én adresse, én side.** Etter at du godkjenner, åpner utvidelsen siden i samme type bakgrunnsfane, leser den gjengitte markupen, stilarkteksten og noen ikon- og logobilder, og lukker så fanen. Utvidelsen følger ikke lenker eller gjennomsøker nettstedet.
- **Stilark som ligger andre steder** (et CDN eller en skrifttjeneste) hentes også, fordi de inneholder sidens farger og typografi. Forespørsler på tvers av opprinnelser sendes uten informasjonskapslene dine. Forespørsler til samme opprinnelse bruker informasjonskapslene dine, slik siden ville gjort.
- **Alt har grenser**, både antall stilark og bilder og antall byte, så en ondsinnet eller delvis ødelagt side returnerer ufullstendig materiale i stedet for å henge seg opp.
- **Tolkingen skjer på enheten din.** Bytene går rett tilbake til Lolly-fanen som spurte, og som gjør dem om til farger, typografi og logoer.

Å lime inn en adresse fyller bare ut feltet. Ingenting leses før du starter lesingen og trykker **Approve once**.

<!--i:eti-lock-->
## Tillatelser

Utvidelsens `manifest.json` oppgir fire tillatelser, pluss nettstedstilgang som den ber om for ett nettsted om gangen. Den setter `minimum_chrome_version: 111`, og gjeldende versjon er 0.5.0.

| Tillatelse | Hva den brukes til | Når den gis |
|---|---|---|
| `debugger` | Styrer bakgrunnsfanen gjennom DevTools Protocol, som tar skjermbildet og, for en SVG, kjører sidegjennomgangen. | Ved installasjon |
| `tabs` | Åpner den midlertidige bakgrunnsfanen og lukker den etterpå, og sjekker at verken Lolly-siden eller målsiden har flyttet seg siden du godkjente. | Ved installasjon |
| `scripting` | Kjører leseren for én side inne på nettstedet du oppga, for Website-kilden. | Ved installasjon |
| `storage` | Noterer ID-en til en fane den åpnet, bare i øktlagring, så fanen fortsatt lukkes hvis nettleseren setter utvidelsen på pause midt i lesingen. Tømmes ved neste start; ingenting om deg lagres. | Ved installasjon |
| `optional_host_permissions: ["http://*/*", "https://*/*"]` | Nettstedstilgang, som ikke gis ved installasjon. Når du trykker **Approve once**, ber utvidelsen Chrome om tilgang til det ene nettstedet i forespørselen. | Første gang du godkjenner en forespørsel for det nettstedet, etter at Chrome har spurt deg |

Utvidelsen leser bare siden du godkjenner. Den leser eller sender ikke nettlesingsdataene dine.

<!--i:eti-help-->
## Feilsøking

- **Ser du fortsatt «Get the extension»?** Last Lolly-fanen på nytt.
- **Skjer det ingenting på dette nettstedet?** Utvidelsen fungerer bare på `https://lolly.tools`, pluss `http://localhost:5173` i utviklingspakken. En annen opprinnelse, som en kopi av Lolly på egen server, trenger sitt eget bygg av utvidelsen som oppgir den opprinnelsen i både `manifest.json` og `policy.js`. Å bare redigere manifestet fungerer ikke.
- **Mislykkes et opptak?** Sjekk at URL-en er tilgjengelig og begynner med `http://` eller `https://`. Noen sider blokkerer automatiske opptak. Hvis du trykket **Cancel**, lukket godkjenningsvinduet eller ventet mer enn 30 sekunder, starter du opptaket på nytt.
