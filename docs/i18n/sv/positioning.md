# Så jämför sig Lolly

Vad Lolly gör som dagens kreativa verktyg inte gör, och vad den medvetet lämnar åt dem.

För versionen verktyg för verktyg, en sida vardera för Canva, Adobe, Figma, render-API:er och webbaserade konverterare, se [Lolly jämfört, verktyg för verktyg](/info/compare.html). Varje sida anger vad det andra verktyget gör bättre och vad Lolly gör istället.

> **Pilotstatus:** Lolly är en prototyp i sluten pilot, inte en färdig produkt, och dess säkerhet genomgår för närvarande SUSE:s strikta infrastrukturhärdning, som förbereder för enterprise-skala. Sidan [Adoption & Governance](/info/adoption-governance.html#status) redogör för det aktuella läget.

## Dagens verktyg

Varje ring nedan poängsätter hur fullständigt en produktklass levererar en förmåga **som den levereras idag** - inte som den marknadsförs - där varje klass poängsätts på sin bästa representant. Lolly poängsätts med samma kniv: den tar den enda röda ringen på tavlan, för mognad. Öppna ett radnamn för resonemanget bakom dess poäng. Kolumnerna är sorterade efter raden Overall completeness högst upp - medelvärdet av de poängsatta raderna, med spend-raden exkluderad.

::: figure positioning-comparison
Funktionsfullständighet över dagens kreativa verktyg, undersökt augusti 2026. Poängsättning: 0 saknas, 25 nödlösningsnivå, 50 riktigt men begränsat eller partiellt, 75 starkt med förbehåll, 100 kärnkompetens.
:::

**Anteckningar om poängsättningen.** Lollys poäng förutsätter att dess publicerade påståenden håller, vilket är varför mognad är dess enda röda ring: sluten pilot, säkerhetshärdning pågår, inget granskat ännu. Efterforskning flyttade flera celler.

Canva poängsätts på sin bästa familjemedlem per rad, eftersom det äger Affinity och Cavalry (båda skänkta bort oktober 2025). Offline- och on-device-rendering får 75 via Affinity - en desktopsvit som fortfarande kräver ett verifierat konto och bär på telemetri, samma avdrag Adobe också tar - medan Canvas egen offlineläge bara redigerar förhandssynkade designer, en enhet, begränsat tidsfönster. Autofill får 50: verkligt men Enterprise-låst, asynkront, endast text och bild. Figmas massgenerering steg 25 till 50 när Buzz levererade kalkylbladsifyllnad (gratis beta, augusti 2026).

En regel styr tavlan: Full (100), på rader som rör ditt innehåll eller din identitet, kräver en förmåga du kan använda utan konto och utan molnförutsättning; rader som beskriver produkten själv (mognad, användarvänlighet) är undantagna. Det kostar Adobe på härkomst: den bredaste levererade C2PA (Photoshop, Lightroom, Premiere, Firefly) signerar lokalt och i molnet, men aldrig utan ett Adobe-konto och en identitet, alltså 75. Det tar ner render-API:erna på massgenerering och automatisering av samma skäl.

Lollys härkomst 75 speglar signering offline på enheten: arkitektoniskt starkare men ogranskad, och en enhetsnyckel läses som overifierad i standardvalidatorer tills en identitet eller en organisations egen CA går i god för den. Penpots 50 kommer via det officiella Lolly Export-pluginet: samma motorsignering, opt-in, deklarerad som Lollys egen. Penpot tar också tavlans enda ring utanför skalan, 90 på on-device-rendering - webbläsarcanvas, spara till ditt eget suveräna moln (till och med en laptop), privat export; bara serverhoppet skiljer det från Lolly. Cloudinary får en egen kolumn: en mediepipeline (DAM, transform-API, CDN), och den enda molnkolumnen som levererar C2PA (50, eftersom fl_c2pa signerar vid leverans, vilket intygar levererat-av-Cloudinary, inte skapat-av-dig).

Livesamarbete går åt andra hållet: Figma sätter skalbenchmarken (200 redigerare) och Lollys parvisa, luftgapade P2P får Partial. Pris är en gissning, märkt som en sådan: listprisaritmetik på realistiska platsmixar, medvetet bred, för skala inte upphandling. Render-API:er får 75 på begränsningar: mallar låsta, inget varumärkesstyrningslager.

Gapet: inget som levereras idag är constraints-first och offline utan konto och utan server i renderingsvägen, och ingen har kopierat kontoklausulen. Lolly levererar nu sin egen öppna canvas - **Design**, en fri canvas med direktmanipulation - men färger, typsnitt och tillgångar på den följer varumärkets globaler, så även fri arrangering förblir constraints-first.

Vad Lolly fortfarande **inte** är är en obegränsad designsvit; designers kommer att fortsätta använda Illustrator och Figma för skräddarsytt arbete - och när det arbetet behöver bli en styrd, reproducerbar tillgång, tar Design-verktygets [Import a design](/info/design-import.html) in den färdiga Figma-, Penpot-, Illustrator-, InDesign- eller PDF-filen på canvasen som redigerbara, varumärkesanpassade boxar.

![Designs fria canvas, där färgerna, typsnitten och tillgångarna som erbjuds är varumärkets egna](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Ftemplate%3D__blank__&width=1440&height=900&dpi=192&waitMs=2400&walker=1&format=svg&dark=1&filename=aud-open-canvas)

## Använd den till

- Snabb generering av operationaliserade kreativa tillgångar (eventbrickor, badges, signaturer, varningar)
- Fri arrangering på den öppna canvasen (Design) när delarna - färger, typsnitt, ikoner, bilder - måste hålla sig till varumärkets globaler
- Landa en färdig Figma-, Penpot-, Illustrator-, InDesign- eller PDF-design (Design-verktygets Import a design) så att den kan redigeras, styras och renderas om deterministiskt i alla Lolly-format
- One-to-many-flöden av typen "fyll i tre fält, få den färdiga tillgången" - inklusive massbearbetning från ett kalkylblad/CSV i `/pro`-batchrutnätet (klistra in eller importera rader, en färdig tillgång per rad, ladda ner som en zip)
- Alltid-på, återkommande varumärkta utdata
- Saker där central kontroll av varumärkesuttryck väger tyngre än uttrycksfull flexibilitet

Deck Studio är ett bra mått på taket här: en hel bildspelspresentation deklarerad som data, layoutad live på canvasen och exporterad som en inbyggt redigerbar PowerPoint.

![Deck Studio i delad vy - presentationens bilder listade som block till vänster, den layoutade presentationens rendering till höger](/t/url-shot?url=%2F%23%2Ftool%2Fdeck-studio&width=1440&height=900&dpi=192&waitMs=2600&walker=1&format=svg&dark=1&filename=ov2-deck-studio-output)

## Använd den inte till

- Skräddarsytt eller flaggskeppsinnehåll (billboards, stora videor)
- Unikt kampanjarbete som genuint behöver en designer
- Idégenerering som behöver bryta sig helt loss från varumärkessystemet - Lollys öppna canvas håller fortfarande färger, typsnitt och tillgångar inom varumärkets globaler, och det är just poängen

## Innovera probabilistiskt, skala deterministiskt

De flesta "AI-kreativa" säljargument placerar modellen på fel sida av en gammal skiljelinje. Skrivare och illuminatörer avgjorde redan var den går: du arbetar löst i skissen, där vad som helst kan prövas och inget är bindande, och sedan går du till tryckpressen, som är skrämmande just för att den binder. Skisserna var där konsten fanns. Pressen var hur den spreds. Två redskap, två uppgifter, var och en uppfinningsrik på sitt sätt, och det tryckta verket gick att lita på eftersom pressen höll sitt löfte vid varje tryckning.

Lolly är pressen, inte skissen. Ta med vad du vill till idéarbetet - en modell, en designer, en servett - men i det ögonblick en idé måste bli tio tusen tillgångar går den genom något som renderar likadant varje gång, utifrån indata vem som helst kan läsa av i efterhand. Det är vad jämförelsen ovan egentligen handlar om: inte vem som har den bättre generatorn, utan vem som gör det bindande steget reproducerbart.

> Lita på den kreativa processen, skala med noggrannhet.

## Godkänn verktyget, inte filen

Alla andra verktyg på marknaden producerar en *fil* som sedan måste kontrolleras - en varumärkesansvarig i en Slack-tråd, juridik som granskar friskrivningen, en omgång ändringar, ännu en granskning. Lolly flyttar godkännandet **ett steg uppströms**. Varumärkesreglerna - exakta hex-koder, licensierade typsnittsfiler, utfallsmarginaler, avstånd - är hårdkodade i verktygets HTML och CSS, så mallen *kan inte* producera en tillgång som avviker från varumärket. Det är själva layouten som gör kontrollen.

Så du slutar godkänna resultat och börjar godkänna **verktyget** som skapar dem. Godkänn det en gång, så är varje tillgång det någonsin producerar förgodkänd genom sin konstruktion - ingen människa i loopen, ingen granskningscykel, oavsett volym.

Det här är den förändring som den deterministiska motorn faktiskt levererar: det är inte en snabbare version av den gamla godkännandeprocessen, den tar bort processen. För det kreativa teamet är det ett skyddsräcke, inte en ersättning - du kastar fortfarande bollen (datan, texten, bilden) och koden är den bumperbana som håller varje kast borta från rännan.

![Producentens hela jobb: skriva orden. Typsnitt, färg och avstånd var avgjorda när verktyget godkändes](/t/url-shot?url=%2F%23%2Ftool%2Fwordmark%3Ftext%3DApproved&width=1440&height=900&dpi=192&waitMs=2000&walker=1&format=svg&dark=1&filename=aud-approve-the-tool)

| Att godkänna tillgångar på gamla sättet | Att godkänna verktyget, Lolly-sättet |
|---|---|
| Varje färdig fil kontrolleras, en i taget | Verktyget kontrolleras en gång |
| Förfrågan → designer bygger → varumärkesgranskning → juridisk kontroll → ändringar → omgranskning | En parameterändring → färdig tillgång |
| Designer, varumärkesansvarig, jurist och beställare alla i loopen | Producenten, på egen hand |
| Dagar per tillgång | Sekunder per tillgång |
| 10 000 tillgångar = 10 000 granskningscykler | 10 000 tillgångar = noll (mallen var redan godkänd) |

## Vad detta unikt bidrar med

- **Vild designpotential levererad säkert i sammanhang.** Verktyg kan uttrycka djärva designidéer inom hårdkodade skyddsräcken.

- **Mjukvarudefinierad innehållsautomation som returnerar den färdiga tillgången.** Indata → färdig fil. Inget "spara det nu från ditt designverktyg och efterbehandla det".
- **Verktyg komponerar verktyg.** Ett verktyg kan bädda in ett annat verktygs rendering och returnera det som en del av en enda färdig tillgång, utan kodkoppling mellan verktygen - en primitiv som ingen öppen-canvas- eller DAM-mallprodukt på marknaden erbjuder.
- **Leverantörsneutralitet.** Full kontroll över funktioner och kostnad. Öppen källkod-motor. Verktyg och tillgångar är git-spårat innehåll, inte inlåsta i en SaaS-databas.

Den första av dessa är den man underskattar. En affischgradig stadskarta, ritad som sanna vektorbaserade väg- och vattenvägar, från en rullgardinsmeny och två färgfält som inte kan pekas utanför varumärket:

![Amsterdams kanalringar och vägnät ritade från kant till kant i varumärkets egen bläckfärg, varje streck placerat av mallen snarare än för hand](/t/url-shot?url=%2F%23%2Ftool%2Fstreet-map%3Fcity%3Damsterdam%26theme%3Dlight%26full&width=1440&height=900&dpi=96&waitMs=3200&walker=1&format=svg&cropSelector=%23tool-canvas&dark=1&filename=ov2-street-map-poster)

## Innehållssuveränitet

Det finns ett namn för vad föregående avsnitt summerar till: suveränitet. Din mediepipeline körs på hårdvara du äger. Ditt varumärke - tokens, typsnitten, logotyperna, verktygen som upprätthåller dem - lever i filer du innehar, i versionshantering du kontrollerar, inte i en leverantörs databas med en exportknapp. Rendering sker på enheten framför dig, så en tillgång passerar aldrig genom en tredje part för att existera, och hela vägen från indata till färdig fil är öppen källkod och inspekterbar. Om alla SaaS-designleverantörer försvann imorgon skulle en Lolly-driftsättning inte märka det.

Det här spelar roll för alla vars arbete borde överleva en prenumeration: föräldern vars fotobok lever på den där laptoppen lika mycket som den offentliga myndigheten vars varumärkesbibliotek ligger under upphandlingsregler. För organisationer - offentliga myndigheter, reglerade branscher, alla vars varumärke är en strategisk tillgång snarare än en dekoration - är "var finns vårt innehåll och vem kan stänga av det" en styrningsfråga, inte en preferens. Suveränitet här är en egenskap hos arkitekturen snarare än en hostingfunktion tillagd för efterlevnad, och sidorna [Integritetspolicy](/info/privacy.html) och [Verifiera själv](/info/verify-yourself.html) finns så att du kan kontrollera det påståendet snarare än att bara ta det för sanning.

Under allt detta ligger ett löfte, formulerat som ett åtagande snarare än en funktion: **om det renderas på din enhet är det gratis för alltid.** Motorn, skalen, verktygen, formaten - hela den enhetsbaserade kreativa vägen är öppen källkod och förblir så. Det löftet har en mekanism: en version som har släppts är licensierad så att den inte kan tas tillbaka, och det finns inget bidragsavtal som skulle kunna omlicensiera arbetet senare. Hela gränsen ryms i en mening: allt som renderas på din enhet är gratis och öppen källkod, för alltid; att koordinera människor och maskiner över ett nätverk är jobbet för en separat kontrollplan, [lolly.work](https://lolly.work).
