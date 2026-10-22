# Nettleserutvidelse

Utvidelsen **Lolly URL Screenshot** lar webappen ta skjermbilde av en hvilken som helst nettside fra innsiden av nettleseren din. Uten den krever fangst av en URL skrivebordsappen - en nettleserside kan ikke lese piksler fra en annen side på egen hånd. Utvidelsen kan, ved å bruke samme fangst som skrivebordsappen bruker.

Den gjør to andre jobber på samme måte. En nettadresse limt inn i et bildefelt kan bli et skjermbilde av den siden (**Ta skjermbilde av denne siden**), og utvidelsen kan lese en enkelt side du oppgir, slik at Brand Studio kan hente en merkevare ut av et livenettsted. Hver forespørsel venter på godkjenningen din i utvidelsen.

Den kjører på Chromium-baserte nettlesere: **Chrome, Edge, Brave, Arc, Opera** - Chrome 111 eller nyere.

Inntil den er installert, åpnes **URL Screenshot** likevel slik at du kan sette sammen et skudd, og en merknad øverst i verktøyets kontroller sier hva som mangler.

![Merknaden i URL Screenshot-verktøyet som tilbyr utvidelsen, vist når fangst til fil ikke har noen vert å kjøre på](/t/url-shot?url=%2F%23%2Ftool%2Furl-shot&width=1440&height=900&dpi=192&waitMs=2400&walker=1&format=svg&cropSelector=%23capture-hint-notice&dark=1&filename=exp-url-shot-notice)

Hver kontroll er live mens du venter: mål-URL-en, rullodybden, roforsinkelsen, beskjæringsmarginene og omfargingen. Bare selve fangsten trenger en vert.

![URL Screenshot-kontrollene med en mål-URL, rullodybde, roforsinkelse og beskjæringsmarginer, alle brukbare før utvidelsen finnes](/t/url-shot?url=%2F%23%2Ftool%2Furl-shot%3Furl%3Dhttps%3A%2F%2Flolly.tools%26scrollDepth%3D0.3%26waitMs%3D1200&width=1440&height=2200&dpi=192&waitMs=2400&format=svg&css=%23tool-canvas%7Bdisplay%3Anone%7D&cropSelector=%23tool-inputs&walker=1&dark=1&filename=fq-url-shot-controls)

## Installer

### Fra Chrome nettbutikk

*Kommer snart.* Når den er publisert installerer du den med ett klikk, og laster deretter Lolly på nytt.

### Last den inn selv (utviklere)

Utvidelsen ligger i repoet under `shells/chrome-extension/`. Den mappen er produksjonsbuilden, som bare fungerer med Lolly på `https://lolly.tools`.

1. Åpne `chrome://extensions`.
2. Slå på **Developer mode** (øverst til høyre).
3. Klikk **Load unpacked** og velg mappen `shells/chrome-extension/`.
4. Last Lolly på nytt - **URL Screenshot** fungerer nå i nettleseren.

For en lokal utviklingsserver kjører du `pnpm run pack:chrome-extension:dev` og laster inn `dist/chrome-extension-dev` i stedet. Den pakken godtar også `http://localhost:5173` og har **Development** i navnet.

## Slik fungerer det

- Et lite skript forteller Lolly at utvidelsen er til stede, slik at **URL Screenshot** kan lagre fangster uten videre oppsett.
- Du godkjenner hver forespørsel. Når Lolly spør, åpner utvidelsen sitt eget vindu, **Approve page request**, som viser nettstedet som ber om det, om det vil ha et skjermbilde eller sideinnholdet, og sideadressen. Ingenting leses før du trykker **Approve once**. **Cancel**, eller å lukke vinduet, avslutter forespørselen.
- Første gang du godkjenner en forespørsel for et nettsted, spør Chrome også om utvidelsen får tilgang til det nettstedet. Chrome beholder den tilgangen når du har tillatt den, men hver senere forespørsel trenger fortsatt sin egen **Approve once**.
- En godkjenning dekker én forespørsel og utløper etter 30 sekunder. Bare én forespørsel kan vente eller kjøre om gangen, og en godkjent forespørsel stopper etter 55 sekunder. Hvis Lolly-siden lukkes eller endres, eller målsiden flytter til et annet nettsted, avbrytes forespørselen.
- Etter at du har godkjent, åpner utvidelsen målsiden i en bakgrunnsfane, fanger den via DevTools Protocol (samme `Page.captureScreenshot` som skrivebordsappen bruker), lukker deretter fanen og leverer bildet tilbake til Lolly-fanen som spurte.
- Den kjører helt i nettleseren din, på ditt nettverk - så fangst av `localhost` eller et internt nettsted fungerer. Siden lastes med nettleserøkten din, så en side du er logget inn på, kan vise privat informasjon i resultatet. Selve fangsten lastes aldri opp noe sted; den eneste nettverkstrafikken er din egen nettleser som laster siden du ba om å skyte.

Mens en fangst kjører kan du kort se en *"…startet feilsøking av denne nettleseren"*-banner på den midlertidige fanen. Det er DevTools Protocol i arbeid; den forsvinner av seg selv når skuddet er ferdig.

## Å lese et nettsted for Brand Studio

Kilden **Website** i Brand Studio starter en merkevare fra et nettsted du allerede har. På Chromium er det utvidelsen som leser det; på skrivebordsappen gjør en nativ henting samme jobb, og på en vanlig nettleser uten utvidelse tilbys ikke flisen i det hele tatt.

Hva som skjer når du trykker på den:

- Én adresse, én side. Etter at du har godkjent, åpner utvidelsen den i samme slags bakgrunnsfane, leser den rendrede markeringen, stilarktekst og en håndfull ikon- og logobilder, og lukker deretter fanen. Den følger ikke lenker og den crawler ikke.
- Stilark hostet andre steder (et CDN, en skrifttjeneste) hentes også, fordi sidens farger og typografi bor i dem. Kryssopprinnelses-forespørsler går uten dine informasjonskapsler; forespørsler fra samme opprinnelse bruker dem, akkurat som selve siden ville gjort.
- Alt er begrenset - et avgrenset antall ark, bilder og bytes - slik at en fiendtlig eller halvt ødelagt side returnerer delvis materiale i stedet for å henge.
- Bytene går rett tilbake til Lolly-fanen som spurte. Tolkningen til farger, typografi og logoer skjer på din enhet; ingenting lastes opp.

Å lime inn en adresse fyller bare ut feltet. Ingenting leses før du starter lesingen og trykker **Approve once**.

## Etter installasjon

Last Lolly-fanen på nytt. Prompten "Get the extension" forsvinner, **URL Screenshot** (under Nyttefunksjoner) kan lagre fangster til en fil, og verktøyet blir tilgjengelig i batch-modus.

## Tillatelser

`manifest.json` erklærer fire tillatelser, pluss nettstedstilgang som den ber om ett nettsted om gangen:

- `debugger` - styre bakgrunnsfanen gjennom DevTools Protocol. Dette er det som tar skjermbildet.
- `tabs` - åpne den midlertidige bakgrunnsfanen og lukke den igjen etterpå, og sjekke at verken Lolly-siden eller målsiden har flyttet seg siden du godkjente forespørselen.
- `scripting` - kjøre ensidelesern inne i nettstedet du oppga, for Brand Studios Website-kilde.
- `storage` - notere id-en til en fane den åpnet, kun i økt-lagring, slik at fanen fortsatt blir lukket hvis nettleseren suspenderer utvidelsen midt i lesingen. Tømmes ved neste oppstart; ingenting om deg lagres.
- `optional_host_permissions: ["http://*/*", "https://*/*"]` - nettstedstilgang, som ikke gis ved installasjon. Når du trykker **Approve once**, ber utvidelsen Chrome om tilgang til det ene nettstedet i den forespørselen, og Chrome spør deg første gang for hvert nettsted.

Den leser bare den ene siden du godkjenner, og den leser eller overfører ikke nettleserdataene dine - ingenting lastes opp noe sted.

Manifestet setter også `minimum_chrome_version: 111`. Gjeldende versjon er 0.4.0.

## Feilsøking

- **Ser fortsatt "Get the extension"?** Last Lolly-fanen på nytt - deteksjon skjer ved sidelasting.
- **Ingenting skjer på dette nettstedet?** Utvidelsen fungerer bare på `https://lolly.tools`, pluss `http://localhost:5173` i utviklingspakken. En annen opprinnelse, for eksempel en selvhostet kopi av Lolly, trenger en separat build av utvidelsen som lister den opprinnelsen i både `manifest.json` og `policy.js`. Å redigere bare manifestet fungerer ikke lenger.
- **En fangst feiler?** Sjekk at URL-en er nåbar og starter med `http://` eller `https://`. Enkelte sider blokkerer aktivt automatisert fangst. Hvis du trykket **Cancel**, lukket godkjenningsvinduet eller ventet lenger enn 30 sekunder, starter du fangsten på nytt.
