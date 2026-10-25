# Webbläsartillägg

En webbsida kan inte läsa pixlarna på en annan webbplats, så Lollys webbapp behöver hjälp för att ta en skärmbild av en sida. I en Chromium-baserad webbläsare (Chrome, Edge, Brave, Arc eller Opera, från Chrome 111) ger det kostnadsfria tillägget **Lolly URL Screenshot** den hjälpen, med samma tagning som datorappen använder. Med det installerat:

- **[URL Screenshot](/t/url-shot)** sparar sidan du komponerade som en fil;
- en webbadress inklistrad i en bildplats kan bli en skärmbild av den sidan, med **Screenshot this page**;
- källan **Website** i [Design System Setup](/info/brand-studio.html) kan läsa en sida för att starta ett designsystem.

Du godkänner varje förfrågan, och datorappen gör samma jobb utan tillägget.

## Innan du installerar

Tills tillägget är installerat öppnas **URL Screenshot** ändå, så du kan komponera en bild. En notis överst bland verktygets kontroller säger vad som saknas.

![URL Screenshot-verktygets notis som erbjuder tillägget, visad när fångst till fil saknar en värd att köra på](/t/url-shot?url=%2F%23%2Ftool%2Furl-shot&width=1440&height=900&dpi=192&waitMs=2400&walker=1&format=svg&cropSelector=%23capture-hint-notice&dark=1&filename=exp-url-shot-notice)

Varje kontroll fungerar medan du väntar: mål-URL:en, rullningsdjupet, inställningsfördröjningen, beskärningsmarginalerna och omfärgningen. Bara själva tagningen behöver tillägget.

![URL Screenshot-kontrollerna med en mål-URL, rulldjup, avvaktningsfördröjning och beskärningsmarginaler, alla användbara innan tillägget finns](/t/url-shot?url=%2F%23%2Ftool%2Furl-shot%3Furl%3Dhttps%3A%2F%2Flolly.tools%26scrollDepth%3D0.3%26waitMs%3D1200&width=1440&height=2200&dpi=192&waitMs=2400&format=svg&css=%23tool-canvas%7Bdisplay%3Anone%7D&cropSelector=%23tool-inputs&walker=1&dark=1&filename=fq-url-shot-controls)

## Installera

**Från Chrome Web Store:** kommer snart. När tillägget är publicerat installerar du det med ett klick.

**Läs in det själv (utvecklare).** Tillägget finns i arkivet på `shells/chrome-extension/`. Den mappen är produktionsbygget, som bara fungerar med Lolly på `https://lolly.tools`.

1. Öppna `chrome://extensions`.
2. Slå på **Developer mode** (uppe till höger).
3. Klicka på **Load unpacked** och välj mappen `shells/chrome-extension/`.
4. Ladda om Lolly-fliken. Upptäckten sker när sidan laddas, så uppmaningen "Get the extension" försvinner. **URL Screenshot** (under Utilities) kan då spara tagningar till en fil och blir tillgänglig i Batch-läget.

För en lokal utvecklingsserver kör du `pnpm run pack:chrome-extension:dev` och laddar in `dist/chrome-extension-dev` i stället. Det paketet godtar även `http://localhost:5173` och har **Development** i namnet.

## Vad som händer när Lolly frågar

![Lolly-fliken ber om en sida och du trycker på Approve once i tilläggets godkännandefönster. En bakgrundsflik öppnas, läser sidan och stängs. Sedan får Lolly-fliken resultatet.](/info/diagrams/concepts/extension-request.svg)

1. **Lolly frågar.** Ett litet skript talar om för Lolly att tillägget finns, så en tagning eller en sidläsning kan starta utan ytterligare uppsättning.
2. **Du godkänner.** Tillägget öppnar sitt eget fönster **Approve page request**. Det visar den begärande webbplatsen, om den vill ha en skärmbild eller sidans innehåll, och sidans adress. Inget läses förrän du trycker på **Approve once**. **Cancel**, eller att stänga fönstret, avslutar förfrågan.
3. **Chrome frågar en gång per webbplats.** Första gången du godkänner en förfrågan för en webbplats frågar Chrome också om tillägget får komma åt den webbplatsen. Chrome behåller den åtkomsten när du tillåtit den, men varje senare förfrågan behöver fortfarande sin egen **Approve once**.
4. **Sidan läses i en bakgrundsflik.** Tillägget öppnar målsidan i en bakgrundsflik, tar den via DevTools Protocol (samma `Page.captureScreenshot` som datorappen använder), stänger fliken och lämnar resultatet tillbaka till Lolly-fliken som frågade.

Ett godkännande gäller en förfrågan och löper ut efter 30 sekunder. Bara en förfrågan kan vänta eller köras åt gången, och en godkänd förfrågan stoppas efter 55 sekunder. Om Lolly-sidan stängs eller ändras, eller målsidan flyttar till en annan webbplats, avbryts förfrågan.

Tagningen körs i din webbläsare, på ditt nätverk, så `localhost` och interna webbplatser fungerar. Sidan laddas med din webbläsarsession, så en sida du är inloggad på kan visa privat information i resultatet. Tagningen laddas inte upp: den enda nätverkstrafiken är din egen webbläsare som laddar sidan du bad om.

Medan en tagning körs kan du kort se en banner *"…started debugging this browser"* på den tillfälliga fliken. Det är DevTools Protocol i arbete, och bannern försvinner när bilden är klar.

## Att läsa en webbplats för Design System Setup

Källan **Website** i Design System Setup startar ett designsystem från en webbplats du redan har. I en Chromium-webbläsare läser tillägget sidan. I datorappen hämtar appen sidan själv. I en webbläsare utan tillägg erbjuds inte rutan Website.

- **En adress, en sida.** Efter att du godkänt öppnar tillägget sidan i samma sorts bakgrundsflik, läser den renderade markupen, formatmallstexten och en handfull ikon- och logotypbilder och stänger sedan fliken. Det följer inte länkar och kryper inte.
- **Formatmallar som hostas någon annanstans** (ett CDN eller en typsnittstjänst) hämtas också, eftersom sidans färger och typografi finns i dem. Förfrågningar mellan ursprung går utan dina cookies; förfrågningar inom samma ursprung använder dem, som sidan själv skulle göra.
- **Allt är begränsat**, med en gräns för antalet formatmallar och bilder och för byte, så att en fientlig eller halvtrasig sida returnerar partiellt material i stället för att hänga sig.
- **Tolkningen sker på din enhet.** Byten går direkt tillbaka till Lolly-fliken som frågade, som gör dem till färger, typografi och logotyper.

Att klistra in en adress fyller bara i fältet. Inget läses förrän du startar läsningen och trycker på **Approve once**.

## Behörigheter

Tilläggets `manifest.json` deklarerar fyra behörigheter, plus webbplatsåtkomst som det ber om en webbplats i taget. Det sätter `minimum_chrome_version: 111`, och den aktuella versionen är 0.4.0.

| Behörighet | Vad den är till för | När den beviljas |
|---|---|---|
| `debugger` | Styr bakgrundsfliken genom DevTools Protocol, som tar skärmbilden. | Vid installation |
| `tabs` | Öppnar den tillfälliga bakgrundsfliken och stänger den efteråt, och kontrollerar att varken Lolly-sidan eller målsidan har flyttats sedan du godkände. | Vid installation |
| `scripting` | Kör enkelsideläsaren inne i webbplatsen du angav, för källan Website. | Vid installation |
| `storage` | Noterar id:t för en flik det öppnat, bara i sessionslagring, så att fliken ändå stängs om webbläsaren pausar tillägget mitt i en läsning. Rensas vid nästa start; inget om dig lagras. | Vid installation |
| `optional_host_permissions: ["http://*/*", "https://*/*"]` | Webbplatsåtkomst, beviljas inte vid installation. När du trycker på **Approve once** ber tillägget Chrome om åtkomst till den enda webbplatsen i den förfrågan. | Första gången du godkänner en förfrågan för den webbplatsen, efter att Chrome frågat dig |

Tillägget läser bara den enda sida du godkänner. Det läser eller skickar inte dina surfdata, och inget laddas upp.

## Felsökning

- **Ser du fortfarande "Get the extension"?** Ladda om Lolly-fliken.
- **Händer inget på den här webbplatsen?** Tillägget fungerar bara på `https://lolly.tools`, plus `http://localhost:5173` i utvecklingspaketet. Ett annat ursprung, som en egen driftad kopia av Lolly, behöver ett eget bygge av tillägget som listar det ursprunget i både `manifest.json` och `policy.js`. Att bara redigera manifestet fungerar inte.
- **Misslyckas en tagning?** Kontrollera att URL:en är nåbar och börjar med `http://` eller `https://`. Vissa sidor blockerar automatiserad tagning. Om du tryckte på **Cancel**, stängde godkännandefönstret eller väntade längre än 30 sekunder, starta tagningen igen.
