# Hoe Lolly zich verhoudt

Wat Lolly doet dat de creatieve tools van vandaag niet doen, en wat het bewust aan hen overlaat.

Voor de tool-voor-tool-versie, één pagina elk voor Canva, Adobe, Figma, render-API's en online converters, zie [Lolly vergeleken, tool voor tool](/info/compare.html). Elke pagina vermeldt wat de andere tool beter doet en wat Lolly in plaats daarvan doet.

> **Pilootstatus:** Lolly is een prototype in een gesloten piloot, geen af product, en de beveiliging ervan ondergaat momenteel de strikte infrastructuurverharding van SUSE, ter voorbereiding op enterprise-schaal. De pagina [Adoption & Governance](/info/adoption-governance.html#status) beschrijft de huidige stand van zaken.

## De tools van vandaag

Elke ring hieronder scoort hoe volledig een productklasse een capaciteit levert **zoals vandaag uitgeleverd** - niet zoals vermarkt - waarbij elke klasse wordt beoordeeld op zijn beste vertegenwoordiger. Lolly wordt met hetzelfde mes beoordeeld: het krijgt de enige rode ring op het bord, voor volwassenheid. Open een rijnaam voor de redenering achter de scores. Kolommen zijn gesorteerd op de rij Overall completeness bovenaan - het gemiddelde van de gescoorde rijen, met de spend-rij uitgesloten.

::: figure positioning-comparison
Volledigheid van functionaliteit bij de creatieve tools van vandaag, onderzocht in augustus 2026. Score: 0 afwezig, 25 workaround-niveau, 50 echt maar beperkt of gedeeltelijk, 75 sterk met kanttekeningen, 100 kerncompetentie.
:::

**Opmerkingen bij de scores.** De scores van Lolly gaan uit van de juistheid van de gepubliceerde claims, en dat is waarom volwassenheid zijn enige rode ring is: gesloten piloot, beveiligingsverharding in uitvoering, nog niets geaudit. Onderzoek verplaatste verschillende cellen.

Canva wordt per rij beoordeeld op zijn beste familielid, omdat het Affinity en Cavalry bezit (beide weggegeven in oktober 2025). Offline en on-device renderen scoren 75 dankzij Affinity - een desktopsuite die nog steeds een geverifieerd account vereist en telemetrie meedraagt, de aftrek die Adobe ook krijgt - terwijl de eigen offlinemodus van Canva alleen vooraf gesynchroniseerde ontwerpen bewerkt, op één apparaat, met een beperkt venster. Autofill scoort 50: reëel maar Enterprise-gebonden, asynchroon, alleen tekst en afbeeldingen. De massagenerering van Figma steeg van 25 naar 50 toen Buzz spreadsheet-fill uitbracht (gratis bèta, augustus 2026).

Eén regel bepaalt het bord: Full (100), op rijen die je content of identiteit raken, vereist een capaciteit die je zonder account en zonder cloud-voorwaarde kunt gebruiken; rijen die het product zelf beschrijven (volwassenheid, gebruiksgemak) zijn vrijgesteld. Het kost Adobe punten op provenance: het breedst uitgeleverde C2PA (Photoshop, Lightroom, Premiere, Firefly) signeert lokaal en in de cloud, maar nooit zonder een Adobe-account en -identiteit, dus 75. Het beperkt de render-API's op massagenerering en automatisering om dezelfde reden.

De provenance-score 75 van Lolly weerspiegelt on-device offline signeren: architecturaal sterker maar ongeaudit, en een apparaatsleutel leest in standaardvalidators als ongeverifieerd totdat een identiteit of de eigen CA van een organisatie ervoor instaat. De 50 van Penpot komt binnen via de officiële Lolly Export-plugin: dezelfde engine-signering, opt-in, expliciet aangeduid als afkomstig van Lolly. Penpot krijgt ook de enige buiten-schaal-ring van het bord, 90 op on-device renderen - browsercanvas, opslaan naar je eigen soevereine cloud (zelfs een laptop), privé-export; alleen de serverstap scheidt het van Lolly. Cloudinary krijgt zijn eigen kolom: een mediapipeline (DAM, transform-API, CDN), en de enige cloudkolom die C2PA uitlevert (50, omdat fl_c2pa signeert bij levering en dus geleverd-door-Cloudinary attesteert, niet gemaakt-door-jou).

Live samenwerking loopt andersom: Figma zet de schaalbenchmark (200 bewerkers) en de pairwise, air-gapped P2P van Lolly scoort Partial. Prijs is een schatting, als zodanig gelabeld: rekenwerk op listprijs bij realistische mixen van seats, met opzet ruim, bedoeld voor schaal, niet voor inkoop. Render-API's krijgen 75 op beperkingen: templates vastgezet, geen laag voor merkgovernance.

Het gat: niets dat vandaag wordt uitgeleverd is constraints-first en offline zonder account en zonder server in het renderpad, en niemand heeft de account-clausule overgenomen. Lolly levert nu zijn eigen open canvas - **Design**, een direct-manipulatie vrij canvas - maar kleuren, typografie en assets erop volgen de merkglobals, dus zelfs vrije opmaak blijft constraints-first.

Wat Lolly nog steeds **niet** is, is een onbeperkte ontwerpsuite; ontwerpers blijven Illustrator en Figma gebruiken voor maatwerk - en wanneer dat werk een beheerste, reproduceerbare asset moet worden, brengt [Import a design](/info/design-import.html) van de Design-tool het afgeronde Figma-, Penpot-, Illustrator-, InDesign- of PDF-bestand als bewerkbare, merkconforme vakken op het canvas.

![Het vrije canvas van Design, waar de kleuren, lettertypen en assets die worden aangeboden het merk zelf zijn](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Ftemplate%3D__blank__&width=1440&height=900&dpi=192&waitMs=2400&walker=1&format=svg&dark=1&filename=aud-open-canvas)

## Gebruik het voor

- Snel genereren van geoperationaliseerde creatieve assets (event tiles, badges, signatures, alerts)
- Vrije vormgeving op het open canvas (Design) wanneer de onderdelen - kleuren, type, iconen, afbeeldingen - conform de merkglobals moeten blijven
- Een afgerond Figma-, Penpot-, Illustrator-, InDesign- of PDF-ontwerp binnenhalen (de Import a design van de Design-tool) zodat het deterministisch bewerkt, beheerd en opnieuw gerenderd kan worden in elk Lolly-formaat
- One-to-many "vul drie velden in, krijg het afgeronde asset"-flows - inclusief bulkruns vanuit een spreadsheet/CSV in het `/pro` batchgrid (plak of importeer rijen, één afgerond asset per rij, download als zip)
- Altijd-actieve, terugkerende branded output
- Zaken waarbij centrale controle over merkexpressie belangrijker is dan expressieve vrijheid

Deck Studio is een goede maatstaf voor het plafond hier: een hele slidedeck gedeclareerd als data, live opgemaakt op het canvas en geëxporteerd als een native bewerkbare PowerPoint.

![Deck Studio in de split view - de slides van de deck als blokken opgesomd links, de opgemaakte deck gerenderd rechts](/t/url-shot?url=%2F%23%2Ftool%2Fdeck-studio&width=1440&height=900&dpi=192&waitMs=2600&walker=1&format=svg&dark=1&filename=ov2-deck-studio-output)

## Gebruik het niet voor

- Op maat gemaakte of vlaggenschip hero-content (billboards, grote video's)
- Uniek campagnewerk dat echt een designer nodig heeft
- Ideevorming die volledig aan het merksysteem moet ontsnappen - Lolly's open canvas conformeert kleuren, type en assets nog steeds aan de merkglobals, en dat is precies het punt

## Innoveer probabilistisch, schaal deterministisch

De meeste "AI creative"-pitches plaatsen het model aan de verkeerde kant van een oude grens. Schrijvers en verluchters hebben al vastgesteld waar die ligt: je werkt losjes aan de schets, waar alles geprobeerd kan worden en niets vastligt, en dan ga je naar de drukpers, die intimiderend is juist omdat die zich vastlegt. De schetsen waren waar de kunst zat. De pers was hoe die reisde. Twee instrumenten, twee taken, elk vindingrijk op zijn eigen manier, en het gedrukte werk kon vertrouwd worden omdat de pers zijn belofte hield bij elke afdruk.

Lolly is de pers, niet de schets. Breng wat je wilt naar de ideevorming - een model, een designer, een servet - maar het moment dat een idee tienduizend assets moet worden, gaat het door iets dat elke keer hetzelfde rendert, vanuit input die iedereen kan terugleren. Daar gaat de vergelijking hierboven eigenlijk over: niet wie de betere generator heeft, maar wie de vastgelegde stap reproduceerbaar maakt.

> Vertrouw het creatieve proces, schaal met precisie.

## Keur de tool goed, niet het bestand

Elke andere tool op het bord produceert een *bestand* dat vervolgens gecontroleerd moet worden - een brand manager in een Slack-thread, legal over de disclaimer, een ronde wijzigingen, nog een review. Lolly verplaatst de goedkeuring **een stap stroomopwaarts**. De merkregels - exacte hexcodes, gelicentieerde lettertypebestanden, afloopmarges, spatiëring - zijn hardgecodeerd in de HTML en CSS van de tool, zodat het template *geen* off-brand asset kan uitvoeren. De opmaak zelf handhaaft het.

Dus stop je met het goedkeuren van outputs en begin je met het goedkeuren van de **tool** die ze maakt. Keur die eenmaal goed, en elk asset dat hij ooit produceert is vooraf goedgekeurd door constructie - geen mens in de loop, geen reviewcyclus, bij welk volume dan ook.

Dit is de verandering die de deterministische engine daadwerkelijk levert: het is geen snellere versie van het oude goedkeuringsproces, het verwijdert het proces. Voor het creatieve team is het een guard-rail, geen vervanging - je gooit nog steeds de bal (de data, de tekst, de afbeelding) en de code is de bumperlane die elke worp uit de goot houdt.

![De hele taak van de producer: type de woorden. Type, kleur en spatiëring waren vastgelegd toen de tool werd goedgekeurd](/t/url-shot?url=%2F%23%2Ftool%2Fwordmark%3Ftext%3DApproved&width=1440&height=900&dpi=192&waitMs=2000&walker=1&format=svg&dark=1&filename=aud-approve-the-tool)

| Assets goedkeuren op de oude manier | De tool goedkeuren, de Lolly-manier |
|---|---|
| Elk afgerond bestand wordt één voor één gecontroleerd | De tool wordt eenmaal gecontroleerd |
| Aanvraag → designer bouwt → merkreview → juridische controle → wijzigingen → herreview | Eén parameterwijziging → afgerond asset |
| Designer, brand manager, legal en aanvrager allemaal in de loop | Alleen de producer |
| Dagen per asset | Seconden per asset |
| 10.000 assets = 10.000 reviewcycli | 10.000 assets = nul (het template was al goedgekeurd) |

## Wat dit uniek biedt

- **Wild ontwerppotentieel veilig geleverd in context.** Tools kunnen avontuurlijke ontwerpideeën uitdrukken binnen hardgecodeerde guard-rails.

- **Software-gedefinieerde contentautomatisering die het eindasset teruggeeft.** Input → definitief bestand. Geen "sla het nu op vanuit je ontwerptool en verwerk het na".
- **Tools stellen tools samen.** Eén tool kan de render van een andere tool insluiten en teruggeven als onderdeel van één afgerond asset, zonder tool-tot-tool codekoppeling - een primitief dat geen enkel open-canvas- of DAM-templatingproduct op het bord biedt.
- **Leveranciersneutraliteit.** Volledige controle over functies en kosten. Open-source engine. Tools en assets zijn git-getrackte content, niet vastgezet in een SaaS-database.

Het eerste van die twee wordt het meest onderschat. Een posterkwaliteit stadsplattegrond, getekend als echte vector weg- en waterpaden, vanuit een dropdown en twee kleurvelden die niet buiten het merk gewezen kunnen worden:

![Amsterdams grachtenring en wegennet getekend van rand tot rand in de eigen inkt van het merk, elke lijn geplaatst door het template in plaats van met de hand](/t/url-shot?url=%2F%23%2Ftool%2Fstreet-map%3Fcity%3Damsterdam%26theme%3Dlight%26full&width=1440&height=900&dpi=96&waitMs=3200&walker=1&format=svg&cropSelector=%23tool-canvas&dark=1&filename=ov2-street-map-poster)

## Contentsoevereiniteit

Er is een naam voor waar de vorige sectie op neerkomt: soevereiniteit. Je mediapipeline draait op hardware die je bezit. Je merk - de tokens, de lettertypen, de logo's, de tools die ze handhaven - leeft in bestanden die jij vasthoudt, in versiebeheer dat jij beheert, niet in de database van een leverancier met een exportknop. Renderen gebeurt op het apparaat voor je neus, dus een asset gaat nooit via een derde partij om te bestaan, en het hele pad van input naar afgerond bestand is open source en inspecteerbaar. Als elke SaaS-ontwerpleverancier morgen zou verdwijnen, zou een Lolly-deployment het niet merken.

Dit is belangrijk voor iedereen wiens werk een abonnement zou moeten overleven: van de ouder wiens fotoboek net zo goed op die laptop leeft als de publieke instantie wiens merkbibliotheek onder aanbestedingsregels valt. Voor organisaties - publieke instanties, gereguleerde sectoren, iedereen wiens merk een strategisch bezit is in plaats van een decoratie - is "waar leeft onze content en wie kan die uitschakelen" een governancevraag, geen voorkeur. Soevereiniteit is hier een eigenschap van de architectuur in plaats van een hostingfunctie toegevoegd voor compliance, en de pagina's [Privacybeleid](/info/privacy.html) en [Verify It Yourself](/info/verify-yourself.html) bestaan zodat je die claim kunt controleren in plaats van aannemen.

Onder dit alles ligt één belofte, geformuleerd als een verplichting in plaats van een functie: **als het rendert op jouw apparaat, is het voor altijd gratis.** De engine, de shells, de tools, de formaten - het hele on-device creatieve pad is open source en blijft dat. Die belofte heeft een mechanisme: een versie die is uitgebracht, is gelicentieerd zodat die niet teruggenomen kan worden, en er bestaat geen contributorovereenkomst die het werk later opnieuw zou kunnen licentiëren. De hele grens past in één zin: alles wat op jouw apparaat rendert, is voor altijd gratis en open source; het coördineren van mensen en machines over een netwerk is de taak van een apart controlevlak, [lolly.work](https://lolly.work).
