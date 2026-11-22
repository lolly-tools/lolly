# Webbläsartillägg

En webbsida kan inte läsa pixlarna på en annan webbplats. I en Chromium-baserad webbläsare (Chrome, Edge, Brave, Arc eller Opera, från Chrome 111) låter det kostnadsfria tillägget **Lolly URL Screenshot** Lollys webbapp ta en skärmbild av en sida med samma fångstmetod som datorappen använder. Med tillägget installerat:

- **[Lolly URL Screenshot](/t/url-shot)** sparar sidan du har komponerat som en fil;
- en webbadress som klistras in i ett bildfält kan bli en skärmbild av den sidan, med **Screenshot this page**;
- källan **Website** i [Lolly Design System Setup](/info/brand-studio.html) kan läsa en sida för att starta ett designsystem.

Du godkänner varje begäran, och datorappen gör samma jobb utan tillägget.

<!--i:eti-checklist-->
## Innan du installerar

Utan tillägget öppnas **Lolly URL Screenshot** fortfarande och du kan komponera en bild. En notis högst upp bland verktygets kontroller berättar vad som saknas.

![Notisen i verktyget URL Screenshot som erbjuder tillägget, visad när skärmbilder till fil saknar en värd att köras på](/t/url-shot?url=%2F%23%2Ftool%2Furl-shot&width=1440&height=900&dpi=192&waitMs=2400&walker=1&format=svg&cropSelector=%23capture-hint-notice&dark=1&filename=exp-url-shot-notice)

Alla kontroller fungerar utan tillägget: måladressen, rulldjupet, väntetiden för stabilisering, beskärningsmåtten och omfärgningen. Bara själva fångsten kräver tillägget.

![Kontrollerna i Lolly URL Screenshot med måladress, rulldjup, väntetid för stabilisering och beskärningsmått, alla användbara innan tillägget finns](/t/url-shot?url=%2F%23%2Ftool%2Furl-shot%3Furl%3Dhttps%3A%2F%2Flolly.tools%26scrollDepth%3D0.3%26waitMs%3D1200&width=1440&height=2200&dpi=192&waitMs=2400&format=svg&css=%23tool-canvas%7Bdisplay%3Anone%7D&cropSelector=%23tool-inputs&walker=1&dark=1&filename=fq-url-shot-controls)

<!--i:eti-download-->
## Installera

**Från Chrome Web Store:** kommer snart. När tillägget har publicerats installeras det med ett klick.

**Läs in det själv (utvecklare).** Tilläggets källkod finns i kodförrådet under `shells/chrome-extension/`. Paketeringssteget bygger produktionspaketet från den mappen. Det paketet fungerar bara med Lolly på `https://lolly.tools`.

1. Kör `pnpm run pack:chrome-extension`. Det bygger paketet i `dist/chrome-extension/`.
2. Öppna `chrome://extensions`.
3. Slå på **Developer mode** (uppe till höger).
4. Klicka på **Load unpacked** och välj mappen `dist/chrome-extension/`.
5. Ladda om Lolly-fliken. Lolly upptäcker tillägget när sidan laddas, och uppmaningen "Get the extension" försvinner. **Lolly URL Screenshot** (under Utilities) kan sedan spara skärmbilder till en fil och fungerar i Lolly Batch-läge.

::: details För en lokal utvecklingsserver, eller källkodsmappen
För en lokal utvecklingsserver kör du `pnpm run pack:chrome-extension:dev` och läser in `dist/chrome-extension-dev` i stället. Det paketet accepterar också `http://localhost:5173` och har **Development** i namnet.

Att läsa in själva mappen `shells/chrome-extension/` fungerar också för PNG-skärmbilder. Den mappen saknar sidgenomgången som paketeringssteget bygger in. En SVG från den mappen innehåller en skärmbild, inte former.
:::

<!--i:eti-user-check-->
## Vad som händer när Lolly frågar

![Lolly-fliken begär en sida och du trycker på Approve once i tilläggets godkännandefönster. En bakgrundsflik öppnas, läser sidan och stängs. Sedan får Lolly-fliken resultatet.](/info/diagrams/concepts/extension-request.svg)

1. **Lolly frågar.** Ett litet skript talar om för Lolly att tillägget finns, så att en skärmbild eller sidläsning kan starta utan ytterligare inställningar.
2. **Du godkänner.** Tillägget öppnar sitt eget fönster **Approve page request**. Det visar den begärande webbplatsen, om den vill ha en skärmbild eller sidans innehåll och sidans adress. Inget läses förrän du trycker på **Approve once**. **Cancel**, eller att stänga fönstret, avslutar begäran.
3. **Chrome frågar en gång per webbplats.** Första gången du godkänner en begäran för en webbplats frågar Chrome också om tillägget får komma åt den webbplatsen. Chrome behåller den åtkomsten när du har tillåtit den, men varje senare begäran kräver fortfarande ett eget **Approve once**.
4. **Sidan läses i en bakgrundsflik.** Tillägget öppnar målsidan i en bakgrundsflik, fångar den genom DevTools Protocol (samma `Page.captureScreenshot` som datorappen använder), stänger fliken och lämnar tillbaka resultatet till Lolly-fliken som begärde det.

::: details Så fungerar en SVG-fångst
För en **SVG** går tillägget igenom sidan i stället för att ta en bild av skärmen. Ett skript som medföljer tillägget läser sidans layout i bakgrundsfliken och omvandlar sidan till former och konturad text. Filen förblir skarp i alla storlekar och varje del förblir redigerbar. Bilder på sidan förblir bilder. Allt som sidan ritar med en canvas, en video eller en effekt som SVG inte kan uttrycka kopieras från en skärmbild av samma ögonblick. Lolly kontrollerar resultatet mot den skärmbilden. När de två skiljer sig för mycket innehåller SVG-filen skärmbilden i stället.

För att kontura texten i sidans eget typsnitt ger tillägget Lolly de typsnittsfiler som sidan laddade in. Chrome lagrar inte ett typsnitts byte där ett tillägg kan läsa dem, så tillägget begär varje typsnitt från sidan igen. Din webbläsare svarar vanligtvis från sin cache, och sidans egen säkerhetspolicy gäller fortfarande för den begäran.
:::

Ett godkännande gäller en begäran och upphör efter 30 sekunder. Bara en begäran kan vänta eller köras åt gången, och en godkänd begäran stoppas efter 55 sekunder. Om Lolly-sidan stängs eller ändras, eller om målsidan flyttas till en annan webbplats, avbryts begäran.

::: warning Skärmbilder använder din webbläsarsession
Sidan laddas med din webbläsarsession, så en sida du är inloggad på kan visa privat information i resultatet.
:::

Fångsten körs i din webbläsare på ditt nätverk, så `localhost` och interna webbplatser fungerar. Skärmbilden laddas inte upp. Den enda nätverkstrafiken är att din webbläsare laddar sidan du begärde och, för en SVG, den sidans typsnittsfiler en andra gång.

Medan en fångst körs kan du kort se en banderoll med *"…started debugging this browser"* på den tillfälliga fliken. Banderollen kommer från DevTools Protocol och försvinner när bilden är klar.

<a id="reading-a-site-for-design-system-setup"></a>
<!--i:eti-globe-->
## Läsa en webbplats för Lolly Design System Setup

Källan **Website** i Lolly Design System Setup startar ett designsystem från en webbplats du redan har. I en Chromium-webbläsare läser tillägget sidan. I datorappen hämtar appen sidan själv. I en webbläsare utan tillägg erbjuds inte Website-kortet.

- **En adress, en sida.** När du har godkänt öppnar tillägget sidan i samma sorts bakgrundsflik, läser den renderade märkkoden, stilmallstexten och några ikon- och logotypbilder och stänger sedan fliken. Tillägget följer inga länkar och genomsöker inte webbplatsen.
- **Stilmallar som ligger någon annanstans** (ett CDN eller en typsnittstjänst) hämtas också, eftersom de innehåller sidans färger och typografi. Begäranden till andra ursprung skickas utan dina kakor. Begäranden till samma ursprung använder dina kakor, som sidan skulle göra.
- **Allt har gränser**, både antalet stilmallar och bilder och antalet byte, så en fientlig eller delvis trasig sida ger ofullständigt material i stället för att hänga sig.
- **Parsningen sker på din enhet.** Byten går direkt tillbaka till den Lolly-flik som begärde dem, och den omvandlar dem till färger, typografi och logotyper.

Att klistra in en adress fyller bara i fältet. Inget läses förrän du startar läsningen och trycker på **Approve once**.

<!--i:eti-lock-->
## Behörigheter

Tilläggets `manifest.json` deklarerar fyra behörigheter, plus webbplatsåtkomst som det begär för en webbplats i taget. Det anger `minimum_chrome_version: 111`, och den aktuella versionen är 0.5.0.

| Behörighet | Vad den är till för | När den beviljas |
|---|---|---|
| `debugger` | Styr bakgrundsfliken genom DevTools Protocol, som tar skärmbilden och, för en SVG, kör sidgenomgången. | Vid installation |
| `tabs` | Öppnar den tillfälliga bakgrundsfliken och stänger den efteråt, och kontrollerar att varken Lolly-sidan eller målsidan har flyttats sedan du godkände. | Vid installation |
| `scripting` | Kör läsaren för en enskild sida inne på den webbplats du angav, för källan Website. | Vid installation |
| `storage` | Antecknar ID:t för en flik det öppnade, enbart i sessionslagringen, så att fliken ändå stängs om webbläsaren pausar tillägget mitt i läsningen. Rensas vid nästa start; inget om dig lagras. | Vid installation |
| `optional_host_permissions: ["http://*/*", "https://*/*"]` | Webbplatsåtkomst, beviljas inte vid installation. När du trycker på **Approve once** ber tillägget Chrome om åtkomst till den enda webbplatsen i den begäran. | Första gången du godkänner en begäran för den webbplatsen, efter att Chrome har frågat dig |

Tillägget läser bara den sida du godkänner. Det läser inte och skickar inte dina webbläsardata.

<!--i:eti-help-->
## Felsökning

- **Ser du fortfarande "Get the extension"?** Ladda om Lolly-fliken.
- **Händer inget på den här webbplatsen?** Tillägget fungerar bara på `https://lolly.tools`, plus `http://localhost:5173` i utvecklingspaketet. Ett annat ursprung, som en egenhostad kopia av Lolly, behöver en egen version av tillägget som listar det ursprunget i både `manifest.json` och `policy.js`. Att enbart redigera manifestet fungerar inte.
- **Misslyckas en fångst?** Kontrollera att URL:en går att nå och börjar med `http://` eller `https://`. Vissa sidor blockerar automatiserad fångst. Om du tryckte på **Cancel**, stängde godkännandefönstret eller väntade längre än 30 sekunder, starta fångsten igen.
