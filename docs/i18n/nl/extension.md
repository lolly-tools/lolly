# Browserextensie

Een webpagina kan de pixels van een andere website niet lezen, dus de Lolly-webapp heeft hulp nodig om een screenshot van een pagina te maken. In een Chromium-gebaseerde browser (Chrome, Edge, Brave, Arc of Opera, vanaf Chrome 111) biedt de gratis extensie **Lolly URL Screenshot** die hulp, met dezelfde opname die de desktop-app gebruikt. Met de extensie geïnstalleerd:

- **[URL Screenshot](/t/url-shot)** slaat de pagina die je samenstelde op als bestand;
- een webadres dat in een afbeeldingsslot is geplakt kan een screenshot van die pagina worden, met **Screenshot this page**;
- de bron **Website** in [Design System Setup](/info/brand-studio.html) kan één pagina lezen om een design system te starten.

Jij keurt elk verzoek goed, en de desktop-app doet dezelfde klussen zonder de extensie.

## Voordat je installeert

Zolang de extensie niet is geïnstalleerd, opent **URL Screenshot** nog steeds, zodat je een opname kunt samenstellen. Een opmerking bovenaan de bediening van de tool zegt wat ontbreekt.

![De melding van de URL Screenshot-tool die de extensie aanbiedt, getoond wanneer capture naar bestand geen host heeft om op te draaien](/t/url-shot?url=%2F%23%2Ftool%2Furl-shot&width=1440&height=900&dpi=192&waitMs=2400&walker=1&format=svg&cropSelector=%23capture-hint-notice&dark=1&filename=exp-url-shot-notice)

Elke bediening werkt terwijl je wacht: de doel-URL, de scrolldiepte, de wachttijd, de bijsnijmarges en de herkleuring. Alleen de opname zelf heeft de extensie nodig.

![De URL Screenshot-instellingen met een doel-URL, scrolldiepte, wachttijd en bijsnij-marges, allemaal bruikbaar voordat de extensie bestaat](/t/url-shot?url=%2F%23%2Ftool%2Furl-shot%3Furl%3Dhttps%3A%2F%2Flolly.tools%26scrollDepth%3D0.3%26waitMs%3D1200&width=1440&height=2200&dpi=192&waitMs=2400&format=svg&css=%23tool-canvas%7Bdisplay%3Anone%7D&cropSelector=%23tool-inputs&walker=1&dark=1&filename=fq-url-shot-controls)

## Installeren

**Uit de Chrome Web Store:** binnenkort. Zodra de extensie is gepubliceerd, installeer je haar met één klik.

**Laad haar zelf (ontwikkelaars).** De extensie staat in de repository op `shells/chrome-extension/`. Die map is de productiebuild, die alleen werkt met Lolly op `https://lolly.tools`.

1. Open `chrome://extensions`.
2. Zet **Developer mode** aan (rechtsboven).
3. Klik op **Load unpacked** en kies de map `shells/chrome-extension/`.
4. Herlaad het Lolly-tabblad. De detectie gebeurt wanneer de pagina laadt, dus de melding "Get the extension" verdwijnt. **URL Screenshot** (onder Utilities) kan dan opnames in een bestand opslaan en wordt beschikbaar in de Batch-modus.

Voor een lokale ontwikkelserver draai je `pnpm run pack:chrome-extension:dev` en laad je in plaats daarvan `dist/chrome-extension-dev`. Dat pakket accepteert ook `http://localhost:5173` en heeft **Development** in de naam.

## Wat er gebeurt wanneer Lolly erom vraagt

![Het Lolly-tabblad vraagt om één pagina en jij drukt in het goedkeuringsvenster van de extensie op Approve once. Een achtergrondtabblad opent, leest de pagina en sluit. Dan krijgt het Lolly-tabblad het resultaat.](/info/diagrams/concepts/extension-request.svg)

1. **Lolly vraagt.** Een klein script vertelt Lolly dat de extensie aanwezig is, zodat een opname of paginalezing kan starten zonder verdere installatie.
2. **Jij keurt goed.** De extensie opent haar eigen venster **Approve page request**. Het toont de aanvragende site, of er een screenshot of de pagina-inhoud wordt gewild, en het paginaadres. Er wordt niets gelezen totdat je op **Approve once** drukt. **Cancel**, of het venster sluiten, beëindigt het verzoek.
3. **Chrome vraagt één keer per site.** De eerste keer dat je een verzoek voor een site goedkeurt, vraagt Chrome ook of de extensie toegang tot die site mag hebben. Chrome behoudt die toegang zodra je haar toestaat, maar elk later verzoek heeft nog steeds een eigen **Approve once** nodig.
4. **De pagina wordt in een achtergrondtabblad gelezen.** De extensie opent de doelpagina in een achtergrondtabblad, legt haar vast via het DevTools Protocol (dezelfde `Page.captureScreenshot` die de desktop-app gebruikt), sluit het tabblad en geeft het resultaat terug aan het Lolly-tabblad dat erom vroeg.

Een goedkeuring dekt één verzoek en verloopt na 30 seconden. Er kan maar één verzoek tegelijk wachten of lopen, en een goedgekeurd verzoek stopt na 55 seconden. Als de Lolly-pagina sluit of verandert, of de doelpagina naar een andere site gaat, wordt het verzoek geannuleerd.

De opname draait in je browser, op je netwerk, dus `localhost` en interne sites werken. De pagina laadt met je browsersessie, dus een pagina waarbij je bent aangemeld kan privé-informatie in het resultaat tonen. De opname wordt niet geüpload: het enige netwerkverkeer is je eigen browser die de pagina laadt waar je om vroeg.

Terwijl een opname loopt, zie je mogelijk kort een banner *"…started debugging this browser"* op het tijdelijke tabblad. Dat is het DevTools Protocol aan het werk, en de banner verdwijnt zodra de opname klaar is.

## Een site lezen voor Design System Setup

De bron **Website** in Design System Setup start een design system vanaf een site die je al hebt. In een Chromium-browser leest de extensie de pagina. In de desktop-app haalt de app de pagina zelf op. In een browser zonder extensie wordt de tegel Website niet aangeboden.

- **Eén adres, één pagina.** Nadat je goedkeurt, opent de extensie de pagina in hetzelfde soort achtergrondtabblad, leest de gerenderde opmaak, de stijlbladtekst en een handvol pictogram- en logoafbeeldingen, en sluit dan het tabblad. Ze volgt geen links en crawlt niet.
- **Elders gehoste stijlbladen** (een CDN of een lettertypedienst) worden ook opgehaald, omdat de kleuren en typografie van de pagina erin staan. Cross-origin-verzoeken gaan zonder je cookies; same-origin-verzoeken gebruiken ze, zoals de pagina zelf zou doen.
- **Alles is begrensd**, met een limiet op het aantal stijlbladen en afbeeldingen en op bytes, zodat een vijandige of half kapotte pagina gedeeltelijk materiaal teruggeeft in plaats van te blijven hangen.
- **Het parsen gebeurt op je apparaat.** De bytes gaan rechtstreeks terug naar het Lolly-tabblad dat erom vroeg, dat ze omzet in kleuren, typografie en logo's.

Een adres plakken vult alleen het veld in. Er wordt niets gelezen totdat je de lezing start en op **Approve once** drukt.

## Rechten

De `manifest.json` van de extensie declareert vier permissies, plus sitetoegang die ze per site vraagt. Ze zet `minimum_chrome_version: 111`, en de huidige versie is 0.4.0.

| Permissie | Waarvoor | Wanneer verleend |
|---|---|---|
| `debugger` | Stuurt het achtergrondtabblad aan via het DevTools Protocol, dat de screenshot maakt. | Bij installatie |
| `tabs` | Opent het tijdelijke achtergrondtabblad en sluit het daarna, en controleert dat noch de Lolly-pagina noch de doelpagina is verplaatst sinds je goedkeurde. | Bij installatie |
| `scripting` | Draait de lezer van één pagina binnen de site die je noemde, voor de bron Website. | Bij installatie |
| `storage` | Noteert de id van een tabblad dat ze opende, alleen in sessieopslag, zodat het tabblad nog sluit als de browser de extensie halverwege het lezen onderbreekt. Bij de volgende start gewist; er wordt niets over jou opgeslagen. | Bij installatie |
| `optional_host_permissions: ["http://*/*", "https://*/*"]` | Sitetoegang, niet verleend bij installatie. Wanneer je op **Approve once** drukt, vraagt de extensie Chrome om toegang tot de ene site in dat verzoek. | De eerste keer dat je een verzoek voor die site goedkeurt, nadat Chrome het je vraagt |

De extensie leest alleen de ene pagina die je goedkeurt. Ze leest of verstuurt je surfgegevens niet, en er wordt niets geüpload.

## Problemen oplossen

- **Zie je nog steeds "Get the extension"?** Herlaad het Lolly-tabblad.
- **Gebeurt er niets op deze site?** De extensie werkt alleen op `https://lolly.tools`, plus `http://localhost:5173` in het ontwikkelpakket. Een andere origin, zoals een zelf gehoste kopie van Lolly, heeft een eigen build van de extensie nodig die die origin in zowel `manifest.json` als `policy.js` vermeldt. Alleen het manifest bewerken werkt niet.
- **Mislukt een opname?** Controleer of de URL bereikbaar is en begint met `http://` of `https://`. Sommige pagina's blokkeren geautomatiseerde opnames. Als je op **Cancel** drukte, het goedkeuringsvenster sloot of langer dan 30 seconden wachtte, start de opname dan opnieuw.
