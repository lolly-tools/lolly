# Browserextensie

Met de extensie **Lolly URL Screenshot** kan de webapp elke webpagina vanuit je browser fotograferen. Zonder de extensie heb je voor het vastleggen van een URL de desktopapp nodig - een browserpagina kan namelijk niet zelf pixels van een andere site lezen. De extensie kan dat wel, met dezelfde capture die de desktopapp gebruikt.

Het doet nog één andere taak op dezelfde manier: een enkele pagina lezen die jij aanwijst, zodat Brand Studio een merk uit een live website kan halen. Beide worden hieronder behandeld.

Hij werkt op Chromium-gebaseerde browsers: **Chrome, Edge, Brave, Arc, Opera** - Chrome 111 of nieuwer.

Zolang hij niet is geïnstalleerd, gaat **URL Screenshot** gewoon open zodat je een shot kunt samenstellen, en een melding boven de knoppen van de tool laat zien wat er ontbreekt.

![De melding van de URL Screenshot-tool die de extensie aanbiedt, getoond wanneer capture naar bestand geen host heeft om op te draaien](/t/url-shot?url=%2F%23%2Ftool%2Furl-shot&width=1440&height=900&dpi=192&waitMs=2400&walker=1&format=svg&cropSelector=%23capture-hint-notice&dark=1&filename=exp-url-shot-notice)

Elke instelling is live terwijl je wacht: de doel-URL, de scrolldiepte, de wachttijd, de bijsnij-marges en de herkleuring. Alleen de capture zelf heeft een host nodig.

![De URL Screenshot-instellingen met een doel-URL, scrolldiepte, wachttijd en bijsnij-marges, allemaal bruikbaar voordat de extensie bestaat](/t/url-shot?url=%2F%23%2Ftool%2Furl-shot%3Furl%3Dhttps%3A%2F%2Flolly.tools%26scrollDepth%3D0.3%26waitMs%3D1200&width=1440&height=2200&dpi=192&waitMs=2400&format=svg&css=%23tool-canvas%7Bdisplay%3Anone%7D&cropSelector=%23tool-inputs&walker=1&dark=1&filename=fq-url-shot-controls)

## Installeren

### Vanuit de Chrome Web Store

*Binnenkort beschikbaar.* Zodra hij gepubliceerd is, installeer je hem met één klik en herlaad je Lolly.

### Zelf laden (ontwikkelaars)

De extensie staat in de repo onder `shells/chrome-extension/`.

1. Open `chrome://extensions`.
2. Zet **Ontwikkelaarsmodus** aan (rechtsboven).
3. Klik op **Uitgepakte extensie laden** en kies de map `shells/chrome-extension/`.
4. Herlaad Lolly - **URL Screenshot** werkt nu in de browser.

## Hoe het werkt

- Een klein scriptje laat Lolly weten dat de extensie aanwezig is, waardoor de tool **URL Screenshot** automatisch aangaat - geen instellingen nodig.
- Bij het renderen opent de extensie de doelpagina in een achtergrondtabblad, legt hem vast via het DevTools Protocol (dezelfde `Page.captureScreenshot` die de desktopapp gebruikt), sluit vervolgens het tabblad en geeft de afbeelding terug.
- Hij draait volledig in je eigen browser, op je eigen netwerk - dus het vastleggen van `localhost` of een interne site werkt gewoon. De capture zelf wordt nergens naartoe geüpload; het enige netwerkverkeer is je eigen browser die de pagina laadt die je wilde fotograferen.

Terwijl een capture draait, kun je even een banner *"…is dit browservenster aan het debuggen"* zien op het tijdelijke tabblad. Dat is het DevTools Protocol aan het werk; hij verdwijnt vanzelf zodra de shot klaar is.

## Een site lezen voor Brand Studio

De bron **Website** in Brand Studio start een merk vanuit een site die je al hebt. Op Chromium is het de extensie die hem leest; op de desktopapp doet een native fetch hetzelfde werk, en op een gewone browser zonder extensie wordt de tegel helemaal niet aangeboden.

Wat er gebeurt als je erop drukt:

- Eén adres, één pagina. De extensie opent hem in hetzelfde soort achtergrondtabblad, leest de gerenderde markup, de stylesheet-tekst en een handvol icoon- en logo-afbeeldingen, en sluit dan het tabblad. Hij volgt geen links en crawlt niet.
- Stylesheets en lettertypen die elders gehost worden (een CDN, een lettertypedienst) worden ook opgehaald, omdat de kleuren en het lettertype van de pagina daarin zitten. Cross-origin verzoeken gaan zonder jouw cookies; same-origin verzoeken gebruiken ze wel, precies zoals de pagina zelf dat zou doen.
- Alles is begrensd - een vast maximum aan stylesheets, afbeeldingen en bytes - zodat een kwaadaardige of half kapotte pagina gedeeltelijk materiaal teruggeeft in plaats van vast te lopen.
- De bytes gaan rechtstreeks terug naar het Lolly-tabblad dat erom vroeg. Het omzetten naar kleuren, lettertype en logo's gebeurt op je eigen apparaat; er wordt niets geüpload.

Er wordt niets gelezen totdat je drukt. Een adres plakken vult alleen het veld in.

## Na het installeren

Herlaad het Lolly-tabblad. De melding "Haal de extensie" verdwijnt en **URL Screenshot** wordt beschikbaar in de galerij en in de Batch-modus.

## Rechten

Zijn `manifest.json` declareert vier rechten plus hosttoegang:

- `debugger` - stuurt het achtergrondtabblad aan via het DevTools Protocol. Dit is wat de screenshot maakt.
- `tabs` - opent het tijdelijke achtergrondtabblad en sluit het daarna weer.
- `scripting` - draait de lezer voor één pagina binnen de site die je opgaf, voor de Website-bron van Brand Studio.
- `storage` - noteert de id van een tabblad dat hij opende, uitsluitend in sessieopslag, zodat het tabblad alsnog gesloten wordt als de browser de extensie halverwege het lezen pauzeert. Wordt gewist bij de volgende start; er wordt niets over jou bewaard.
- `host_permissions: ["<all_urls>"]` - hosttoegang tot *alle* sites, omdat je hem naar elke URL kunt wijzen die je zelf kiest. Chrome toont dit bij installatie als een brede waarschuwing "lees en wijzig al je gegevens op alle websites".

Ondanks die waarschuwing leest hij alleen de ene pagina die je hem vraagt vast te leggen of te importeren, en hij leest of verzendt je browsegegevens niet - er wordt nergens iets geüpload.

Het manifest stelt ook `minimum_chrome_version: 111` in. De huidige versie is 0.2.1.

## Problemen oplossen

- **Zie je nog steeds "Haal de extensie"?** Herlaad het Lolly-tabblad - detectie gebeurt bij het laden van de pagina.
- **Gebeurt er niets op deze site?** De extensie wordt alleen actief op Lolly's eigen origins. Draai je een aangepaste build op een ander domein? Voeg het toe aan `content_scripts.matches` in de `manifest.json` van de extensie.
- **Mislukt een capture?** Controleer of de URL bereikbaar is en begint met `http://` of `https://`. Sommige pagina's blokkeren actief geautomatiseerde captures.
