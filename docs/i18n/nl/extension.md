# Browserextensie

Een webpagina kan de pixels van een andere website niet lezen. In een op Chromium gebaseerde browser (Chrome, Edge, Brave, Arc of Opera, vanaf Chrome 111) laat de gratis extensie **Lolly URL Screenshot** de Lolly-webapp een screenshot van een pagina maken met dezelfde opnamemethode als de desktopapp. Met de extensie geïnstalleerd:

- **[Lolly URL Screenshot](/t/url-shot)** slaat de pagina die je hebt samengesteld op als bestand;
- een webadres dat je in een afbeeldingsvak plakt kan een screenshot van die pagina worden, met **Screenshot this page**;
- de bron **Website** in [Lolly Design System Setup](/info/brand-studio.html) kan één pagina lezen om een design system te starten.

Je keurt elk verzoek goed, en de desktopapp doet hetzelfde werk zonder de extensie.

<!--i:eti-checklist-->
## Voordat je installeert

Zonder de extensie opent **Lolly URL Screenshot** nog steeds en kun je een opname samenstellen. Een melding bovenaan de bediening van de tool geeft aan wat er ontbreekt.

![De melding van de tool URL Screenshot die de extensie aanbiedt, getoond wanneer er geen host beschikbaar is om een opname als bestand te maken](/t/url-shot?url=%2F%23%2Ftool%2Furl-shot&width=1440&height=900&dpi=192&waitMs=2400&walker=1&format=svg&cropSelector=%23capture-hint-notice&dark=1&filename=exp-url-shot-notice)

Alle bediening werkt zonder de extensie: de doel-URL, de scroldiepte, de wachttijd tot de pagina tot rust is gekomen, de bijsnijmarges en de kleurwijziging. Alleen voor de opname is de extensie nodig.

![De bediening van Lolly URL Screenshot met een doel-URL, scroldiepte, wachttijd en bijsnijmarges, allemaal bruikbaar voordat de extensie is geïnstalleerd](/t/url-shot?url=%2F%23%2Ftool%2Furl-shot%3Furl%3Dhttps%3A%2F%2Flolly.tools%26scrollDepth%3D0.3%26waitMs%3D1200&width=1440&height=2200&dpi=192&waitMs=2400&format=svg&css=%23tool-canvas%7Bdisplay%3Anone%7D&cropSelector=%23tool-inputs&walker=1&dark=1&filename=fq-url-shot-controls)

<!--i:eti-download-->
## Installeren

**Uit de Chrome Web Store:** binnenkort beschikbaar. Na publicatie installeer je de extensie met één klik.

**Zelf laden (ontwikkelaars).** De broncode van de extensie staat in de repository onder `shells/chrome-extension/`. De verpakkingsstap bouwt het productiepakket vanuit die map. Dat pakket werkt alleen met Lolly op `https://lolly.tools`.

1. Voer `pnpm run pack:chrome-extension` uit. Dit bouwt het pakket in `dist/chrome-extension/`.
2. Open `chrome://extensions`.
3. Zet **Developer mode** aan (rechtsboven).
4. Klik op **Load unpacked** en kies de map `dist/chrome-extension/`.
5. Herlaad het Lolly-tabblad. Lolly detecteert de extensie wanneer de pagina laadt, en de melding "Get the extension" verdwijnt. **Lolly URL Screenshot** (onder Utilities) kan dan opnamen als bestand opslaan en werkt in Lolly Batch-modus.

::: details Voor een lokale ontwikkelserver of de bronmap
Voer voor een lokale ontwikkelserver `pnpm run pack:chrome-extension:dev` uit en laad in plaats daarvan `dist/chrome-extension-dev`. Dat pakket accepteert ook `http://localhost:5173` en heeft **Development** in de naam.

De map `shells/chrome-extension/` zelf laden werkt ook voor PNG-screenshots. Die map bevat geen paginadoorloop, die de verpakkingsstap inbouwt. Een SVG uit die map bevat een screenshot, geen vormen.
:::

<!--i:eti-user-check-->
## Wat er gebeurt als Lolly een verzoek doet

![Het Lolly-tabblad vraagt om één pagina en je drukt op Approve once in het goedkeuringsvenster van de extensie. Een achtergrondtabblad opent, leest de pagina en sluit. Daarna krijgt het Lolly-tabblad het resultaat.](/info/diagrams/concepts/extension-request.svg)

1. **Lolly doet een verzoek.** Een klein script laat Lolly weten dat de extensie aanwezig is, zodat een opname of het lezen van een pagina kan starten zonder verdere instellingen.
2. **Je keurt goed.** De extensie opent haar eigen venster **Approve page request**. Het toont de aanvragende site, of die een screenshot of de pagina-inhoud wil en het pagina-adres. Er wordt niets gelezen totdat je op **Approve once** drukt. **Cancel** of het venster sluiten beëindigt het verzoek.
3. **Chrome vraagt één keer per site.** De eerste keer dat je een verzoek voor een site goedkeurt, vraagt Chrome ook of de extensie toegang tot die site mag krijgen. Chrome bewaart die toegang zodra je toestemming geeft, maar elk later verzoek heeft nog steeds zijn eigen **Approve once** nodig.
4. **De pagina wordt in een achtergrondtabblad gelezen.** De extensie opent de doelpagina in een achtergrondtabblad, legt die vast via het DevTools Protocol (dezelfde `Page.captureScreenshot` die de desktopapp gebruikt), sluit het tabblad en geeft het resultaat terug aan het Lolly-tabblad dat het verzoek deed.

::: details Hoe een SVG-opname werkt
Voor een **SVG** doorloopt de extensie de pagina in plaats van een foto van het scherm te maken. Een script dat bij de extensie is verpakt leest de lay-out van de pagina in het achtergrondtabblad en zet de pagina om in vormen en tekstcontouren. Het bestand blijft op elk formaat scherp en elk onderdeel blijft bewerkbaar. Afbeeldingen op de pagina blijven afbeeldingen. Alles wat de pagina tekent met een canvas, een video of een effect dat SVG niet kan weergeven wordt gekopieerd uit een screenshot van hetzelfde moment. Lolly controleert het resultaat tegen dat screenshot. Wanneer de twee te veel verschillen, bevat de SVG in plaats daarvan het screenshot.

Om tekstcontouren in het eigen lettertype van de pagina te maken, geeft de extensie Lolly de lettertypebestanden die de pagina heeft geladen. Chrome bewaart de bytes van een lettertype niet waar een extensie ze kan lezen, dus de extensie vraagt de pagina opnieuw om elk lettertype. Je browser antwoordt meestal vanuit zijn cache, en het eigen beveiligingsbeleid van de pagina geldt ook voor dat verzoek.
:::

Een goedkeuring geldt voor één verzoek en verloopt na 30 seconden. Er kan maar één verzoek tegelijk wachten of lopen, en een goedgekeurd verzoek stopt na 55 seconden. Als de Lolly-pagina sluit of verandert, of de doelpagina naar een andere site gaat, wordt het verzoek geannuleerd.

::: warning Opnamen gebruiken je browsersessie
De pagina laadt met je browsersessie, dus een pagina waarop je bent aangemeld kan privégegevens in het resultaat tonen.
:::

De opname draait in je browser op je netwerk, dus `localhost` en interne sites werken. De opname wordt niet geüpload. Het enige netwerkverkeer is je browser die de gevraagde pagina laadt en, voor een SVG, de lettertypebestanden van die pagina een tweede keer.

Tijdens een opname zie je mogelijk kort een banner *"…started debugging this browser"* op het tijdelijke tabblad. De banner komt van het DevTools Protocol en verdwijnt wanneer de opname klaar is.

<a id="reading-a-site-for-design-system-setup"></a>
<!--i:eti-globe-->
## Een site lezen voor Lolly Design System Setup

De bron **Website** in Lolly Design System Setup start een design system vanuit een site die je al hebt. In een Chromium-browser leest de extensie de pagina. In de desktopapp haalt de app de pagina zelf op. In een browser zonder extensie wordt de Website-tegel niet aangeboden.

- **Eén adres, één pagina.** Nadat je goedkeurt, opent de extensie de pagina in hetzelfde soort achtergrondtabblad, leest de gerenderde markup, de tekst van de stylesheets en enkele pictogram- en logoafbeeldingen en sluit dan het tabblad. De extensie volgt geen links en crawlt niet.
- **Stylesheets die elders worden gehost** (een CDN of een lettertypedienst) worden ook opgehaald, omdat ze de kleuren en typografie van de pagina bevatten. Cross-originverzoeken gaan zonder je cookies. Same-originverzoeken gebruiken je cookies, zoals de pagina dat zou doen.
- **Alles is begrensd**, met een limiet op het aantal stylesheets en afbeeldingen en op bytes, zodat een kwaadaardige of half kapotte pagina gedeeltelijk materiaal teruggeeft in plaats van vast te lopen.
- **Parsen gebeurt op je apparaat.** De bytes gaan rechtstreeks terug naar het Lolly-tabblad dat het verzoek deed, dat ze omzet in kleuren, typografie en logo's.

Een adres plakken vult alleen het veld in. Er wordt niets gelezen totdat je het lezen start en op **Approve once** drukt.

<!--i:eti-lock-->
## Machtigingen

Het bestand `manifest.json` van de extensie declareert vier machtigingen, plus sitetoegang die per site wordt aangevraagd. Het stelt `minimum_chrome_version: 111` in, en de huidige versie is 0.5.0.

| Machtiging | Waarvoor die dient | Wanneer die wordt verleend |
|---|---|---|
| `debugger` | Stuurt het achtergrondtabblad aan via het DevTools Protocol, dat het screenshot maakt en, voor een SVG, de paginadoorloop uitvoert. | Bij installatie |
| `tabs` | Opent het tijdelijke achtergrondtabblad en sluit het daarna, en controleert dat noch de Lolly-pagina noch de doelpagina is verplaatst sinds je goedkeuring. | Bij installatie |
| `scripting` | Voert de lezer voor één pagina uit binnen de site die je opgaf, voor de bron Website. | Bij installatie |
| `storage` | Noteert de ID van een geopend tabblad, alleen in de sessieopslag, zodat het tabblad toch sluit als de browser de extensie tijdens het lezen opschort. Wordt bij de volgende start gewist; er wordt niets over je opgeslagen. | Bij installatie |
| `optional_host_permissions: ["http://*/*", "https://*/*"]` | Sitetoegang, niet verleend bij installatie. Wanneer je op **Approve once** drukt, vraagt de extensie Chrome om toegang tot de ene site in dat verzoek. | De eerste keer dat je een verzoek voor die site goedkeurt, nadat Chrome je erom vraagt |

De extensie leest alleen de pagina die je goedkeurt. Ze leest of verstuurt je browsegegevens niet.

<!--i:eti-help-->
## Problemen oplossen

- **Zie je nog steeds "Get the extension"?** Herlaad het Lolly-tabblad.
- **Gebeurt er niets op deze site?** De extensie werkt alleen op `https://lolly.tools`, plus `http://localhost:5173` in het ontwikkelpakket. Een andere origin, zoals een zelfgehoste kopie van Lolly, heeft een eigen build van de extensie nodig die die origin zowel in `manifest.json` als in `policy.js` vermeldt. Alleen het manifest bewerken werkt niet.
- **Mislukt een opname?** Controleer of de URL bereikbaar is en begint met `http://` of `https://`. Sommige pagina's blokkeren automatische opnamen. Als je op **Cancel** hebt gedrukt, het goedkeuringsvenster hebt gesloten of langer dan 30 seconden hebt gewacht, start de opname dan opnieuw.
