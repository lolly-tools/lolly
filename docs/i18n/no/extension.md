# Nettleserutvidelse

En nettside kan ikke lese pikslene til et annet nettsted, så Lolly-nettappen trenger hjelp for å ta skjermbilde av en side. I en Chromium-basert nettleser (Chrome, Edge, Brave, Arc eller Opera, fra Chrome 111) gir den gratis utvidelsen **Lolly URL Screenshot** den hjelpen, med samme opptak skrivebordsappen bruker. Med den installert:

- **[URL Screenshot](/t/url-shot)** lagrer siden du komponerte som en fil;
- en nettadresse limt inn i en bildeplass kan bli et skjermbilde av den siden, med **Screenshot this page**;
- kilden **Website** i [Design System Setup](/info/brand-studio.html) kan lese én side for å starte et designsystem.

Du godkjenner hver forespørsel, og skrivebordsappen gjør de samme jobbene uten utvidelsen.

## Før du installerer

Til utvidelsen er installert, åpnes **URL Screenshot** fortsatt, så du kan komponere et opptak. En merknad øverst i verktøyets kontroller sier hva som mangler.

![Merknaden i URL Screenshot-verktøyet som tilbyr utvidelsen, vist når fangst til fil ikke har noen vert å kjøre på](/t/url-shot?url=%2F%23%2Ftool%2Furl-shot&width=1440&height=900&dpi=192&waitMs=2400&walker=1&format=svg&cropSelector=%23capture-hint-notice&dark=1&filename=exp-url-shot-notice)

Hver kontroll fungerer mens du venter: mål-URL-en, rullingsdybden, ventetiden for å sette seg, beskjæringsmarginene og omfargingen. Bare selve opptaket trenger utvidelsen.

![URL Screenshot-kontrollene med en mål-URL, rullodybde, roforsinkelse og beskjæringsmarginer, alle brukbare før utvidelsen finnes](/t/url-shot?url=%2F%23%2Ftool%2Furl-shot%3Furl%3Dhttps%3A%2F%2Flolly.tools%26scrollDepth%3D0.3%26waitMs%3D1200&width=1440&height=2200&dpi=192&waitMs=2400&format=svg&css=%23tool-canvas%7Bdisplay%3Anone%7D&cropSelector=%23tool-inputs&walker=1&dark=1&filename=fq-url-shot-controls)

## Installer

**Fra Chrome Web Store:** kommer snart. Når utvidelsen er publisert, installerer du den med ett klikk.

**Last den selv (utviklere).** Utvidelsen ligger i repositoriet under `shells/chrome-extension/`. Den mappen er produksjonsbygget, som bare fungerer med Lolly på `https://lolly.tools`.

1. Åpne `chrome://extensions`.
2. Slå på **Developer mode** (øverst til høyre).
3. Klikk **Load unpacked** og velg mappen `shells/chrome-extension/`.
4. Last Lolly-fanen på nytt. Oppdagelsen skjer når siden lastes, så meldingen "Get the extension" forsvinner. **URL Screenshot** (under Utilities) kan da lagre opptak til en fil og blir tilgjengelig i Batch-modus.

For en lokal utviklingsserver kjører du `pnpm run pack:chrome-extension:dev` og laster inn `dist/chrome-extension-dev` i stedet. Den pakken godtar også `http://localhost:5173` og har **Development** i navnet.

## Hva som skjer når Lolly spør

![Lolly-fanen ber om én side og du trykker Approve once i utvidelsens godkjenningsvindu. En bakgrunnsfane åpnes, leser siden og lukkes. Deretter får Lolly-fanen resultatet.](/info/diagrams/concepts/extension-request.svg)

1. **Lolly spør.** Et lite skript forteller Lolly at utvidelsen er til stede, så et opptak eller en sidelesing kan starte uten videre oppsett.
2. **Du godkjenner.** Utvidelsen åpner sitt eget **Approve page request**-vindu. Det viser nettstedet som ber, om det vil ha et skjermbilde eller sideinnholdet, og sideadressen. Ingenting leses før du trykker **Approve once**. **Cancel**, eller å lukke vinduet, avslutter forespørselen.
3. **Chrome spør én gang per nettsted.** Første gang du godkjenner en forespørsel for et nettsted, spør Chrome også om utvidelsen kan få tilgang til det nettstedet. Chrome beholder den tilgangen når du har tillatt den, men hver senere forespørsel trenger fortsatt sin egen **Approve once**.
4. **Siden leses i en bakgrunnsfane.** Utvidelsen åpner målsiden i en bakgrunnsfane, tar opptak av den gjennom DevTools Protocol (den samme `Page.captureScreenshot` skrivebordsappen bruker), lukker fanen og gir resultatet tilbake til Lolly-fanen som spurte.

En godkjenning dekker én forespørsel og utløper etter 30 sekunder. Bare én forespørsel kan vente eller kjøre om gangen, og en godkjent forespørsel stopper etter 55 sekunder. Hvis Lolly-siden lukkes eller endres, eller målsiden flytter til et annet nettsted, avbrytes forespørselen.

Opptaket kjører i nettleseren din, på nettverket ditt, så `localhost` og interne nettsteder fungerer. Siden lastes med nettleserøkten din, så en side du er logget på, kan vise privat informasjon i resultatet. Opptaket lastes ikke opp: den eneste nettverkstrafikken er din egen nettleser som laster siden du ba om.

Mens et opptak kjører, kan du kort se et banner *"…started debugging this browser"* på den midlertidige fanen. Det er DevTools Protocol i arbeid, og banneret forsvinner når opptaket er ferdig.

## Å lese et nettsted for Design System Setup

Kilden **Website** i Design System Setup starter et designsystem fra et nettsted du allerede har. I en Chromium-nettleser leser utvidelsen siden. I skrivebordsappen henter appen siden selv. I en nettleser uten utvidelse tilbys ikke Website-flisen.

- **Én adresse, én side.** Etter at du godkjenner, åpner utvidelsen siden i samme type bakgrunnsfane, leser den gjengitte markupen, stilarkteksten og en håndfull ikon- og logobilder, og lukker deretter fanen. Den følger ikke lenker og crawler ikke.
- **Stilark hostet andre steder** (et CDN eller en skrifttjeneste) hentes også, fordi sidens farger og skrift ligger i dem. Forespørsler på tvers av opprinnelser går uten informasjonskapslene dine; forespørsler til samme opprinnelse bruker dem, slik siden selv ville gjort.
- **Alt er begrenset**, med en grense for antall stilark og bilder og for bytes, slik at en fiendtlig eller halvødelagt side gir delvis materiale i stedet for å henge.
- **Tolkingen skjer på enheten din.** Bytene går rett tilbake til Lolly-fanen som spurte, som gjør dem om til farger, skrift og logoer.

Å lime inn en adresse fyller bare ut feltet. Ingenting leses før du starter lesingen og trykker **Approve once**.

## Tillatelser

Utvidelsens `manifest.json` deklarerer fire tillatelser, pluss nettstedstilgang den ber om ett nettsted om gangen. Den setter `minimum_chrome_version: 111`, og gjeldende versjon er 0.4.0.

| Tillatelse | Hva den er til | Når den gis |
|---|---|---|
| `debugger` | Styrer bakgrunnsfanen gjennom DevTools Protocol, som tar skjermbildet. | Ved installasjon |
| `tabs` | Åpner den midlertidige bakgrunnsfanen og lukker den etterpå, og sjekker at verken Lolly-siden eller målsiden har flyttet seg siden du godkjente. | Ved installasjon |
| `scripting` | Kjører enkeltsideleseren inne i nettstedet du navnga, for Website-kilden. | Ved installasjon |
| `storage` | Noterer ID-en til en fane den åpnet, bare i øktlagring, slik at fanen fortsatt lukkes hvis nettleseren suspenderer utvidelsen midt i en lesing. Tømmes ved neste start; ingenting om deg lagres. | Ved installasjon |
| `optional_host_permissions: ["http://*/*", "https://*/*"]` | Nettstedstilgang, ikke gitt ved installasjon. Når du trykker **Approve once**, ber utvidelsen Chrome om tilgang til det ene nettstedet i den forespørselen. | Første gang du godkjenner en forespørsel for det nettstedet, etter at Chrome har spurt deg |

Utvidelsen leser bare den ene siden du godkjenner. Den leser eller sender ikke nettlesingsdataene dine, og ingenting lastes opp.

## Feilsøking

- **Ser du fortsatt "Get the extension"?** Last Lolly-fanen på nytt.
- **Skjer det ingenting på dette nettstedet?** Utvidelsen fungerer bare på `https://lolly.tools`, pluss `http://localhost:5173` i utviklingspakken. En annen opprinnelse, som en selvhostet kopi av Lolly, trenger sitt eget bygg av utvidelsen som lister den opprinnelsen i både `manifest.json` og `policy.js`. Å redigere bare manifestet fungerer ikke.
- **Svikter et opptak?** Sjekk at URL-en er tilgjengelig og starter med `http://` eller `https://`. Noen sider blokkerer automatisk opptak. Hvis du trykket **Cancel**, lukket godkjenningsvinduet eller ventet lenger enn 30 sekunder, start opptaket på nytt.
