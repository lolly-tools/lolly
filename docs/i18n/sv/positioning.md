# Så står sig Lolly

Lolly skapar filer som följer varumärket på din egen enhet, utan konto. **Lolly Work** är servern för team: inloggning, delade projekt, godkännanden och serverrendering, på maskiner som din organisation driver. Båda har öppen källkod under MPL-2.0.

De flesta team behåller verktygen de har. En designapp tillhandahåller designerna, ett DAM förblir den auktoritativa källan och Lolly omvandlar godkända indata till färdiga filer. [Använd Lolly med ditt befintliga DAM](/info/use-with-dam.html) beskriver den kombinationen. Idén bakom kombinationen är [innehållssuveränitet](/info/content-sovereignty.html).

<!--i:eti-gauge-->
## Dagens verktyg

Varje ring visar hur fullständigt en produktkategori uppfyller ett behov. Tryck på ett **?** bredvid en rad för att se beläggen, och på **?** bredvid teckenförklaringen för att se hur poängen fungerar.

::: figure positioning-comparison
Jämförelse av funktioner. Konkurrentundersökning utifrån leverantörsdokument, augusti till 21 november 2026. Lolly och Lolly Work granskade 21 november 2026. Poäng: 0 saknas, 25 kringlösning, 50 finns men med åtkomstbegränsningar eller delvis, 75 stark med förbehåll, 100 kärnkompetens.
:::

::: details Källor för poängen som ändrades i november 2026
- Canva: [API-ändringslogg](https://www.canva.dev/docs/apps/rest-apis/changelog/), [tjänsteappar](https://www.canva.dev/blog/developers/canva-service-accounts/), [hjälp för Brand Controls](https://www.canva.com/help/brand-control/)
- Adobe: [ändringslogg för InDesign API](https://developer.adobe.com/firefly-services/docs/indesign-apis/getting-started/changelog/), [priser för Adobe Express](https://www.adobe.com/express/pricing)
- Figma: [agent- och AI-krediter](https://help.figma.com/hc/en-us/articles/42614902212887), [MCP-server](https://developers.figma.com/docs/figma-mcp-server/)
- Frontify och Bynder: [Frontifys versionsinformation för oktober 2026](https://news.frontify.com/163371-what-s-new-in-october-2026), [Frontify MCP](https://help.frontify.com/en/articles/14787214-frontify-mcp-beta)
- Bannerbear och Placid: [priser för Bannerbear](https://www.bannerbear.com/pricing/), [ändringslogg för Bannerbear](https://www.bannerbear.com/changelog/), [priser för Placid](https://placid.app/pricing)
- Penpot: [priser för egen drift](https://penpot.app/pricing/self-host), [utgåvor](https://github.com/penpot/penpot/releases)
- Cloudinary: [innehållsproveniens](https://cloudinary.com/documentation/content_provenance_and_authenticity), [priser](https://cloudinary.com/pricing)
:::

Funktioner och dokumenterad erfarenhet är separata rader. Lollys första offentliga utgåva var 1.0.1 den 30 augusti 2026, säkerheten har ännu inte genomgått någon oberoende granskning och beläggen för användning är några månader gamla. [Införande & styrning](/info/adoption-governance.html#status) har det aktuella läget.

<!--i:eti-hammer-->
## När du ska välja Lolly

::: cols
## Välj Lolly när

- Samma sorts fil behövs om och om igen: evenemangskort, brickor, intyg, aviseringar, kort för sociala medier
- Många filer kommer från en mall och en tabell med värden, i [Lolly Batch](/info/batch.html#make-many-versions-of-one-design) eller CLI
- Färgerna, typografin och tillgångarna måste hålla sig inom designsystemet, även på en fri yta
- En färdig design i Figma, Penpot, Illustrator, InDesign, Affinity eller PDF ska bli redigerbar och upprepningsbar ([Importera en design](/info/design-import.html))
- Filerna måste skapas på dina egna enheter eller servrar

## Välj något annat när

- Arbetet gäller detaljerad fotoretuschering eller illustration
- Du formger ett appgränssnitt och bygger prototyper av det
- Du behöver ett stort bild- och mallbibliotek redo från första dagen
- Du behöver en hanterad tjänst med lång dokumenterad erfarenhet av storskalig drift
:::

Importerade designer och delade designtokens låter ett team kombinera Lolly med specialiserade appar, medan Lolly Work styr delade tillgångar, granskning och leverans.

För team med ett noga förvaltat DAM, börja med att behålla det biblioteket och dess administratörer. [SUSE:s erfarenhet av Brandfolder](/info/suse-brandfolder.html) beskriver hur integration stödde införandet och hanteringen av förändrade godkännanden. DAM-leverantörer och implementeringspartner kan utvärdera samma upplägg genom [partnerarbetsflödet](/info/dam-partners.html).

I **Lolly Markdown Slides** skrivs en hel presentation som data, layoutas i realtid och exporteras som en redigerbar fil i PowerPoints eget format.

![Lolly Markdown Slides i delad vy: presentationens bilder listade som block till vänster, den layoutade presentationens rendering till höger](/t/url-shot?url=%2F%23%2Ftool%2Fdeck-studio&width=1440&height=900&dpi=192&waitMs=2600&walker=1&format=svg&dark=1&filename=ov2-deck-studio-output)

<!--i:eti-shield-check-->
## Reglerna finns i verktyget

Lolly placerar återanvändbara varumärkesregler i verktyget: färger, typsnitt, utfallsmarginaler, avstånd och tillåtna indata. Mallen låser de delar som en mottagare inte får ändra. Lolly Work lägger till gruppåtkomst och indatapolicyer kring den mallen, med godkännandekedjor för kataloginlämningar och leverans.

Att kontrollera ett verktyg en gång gör upprepningsbar produktion enklare, eftersom varje utdata ärver dess layoutregler. Text, uppladdade bilder och användningsrättigheter kan fortfarande behöva kontrolleras, och Lolly Work tillhandahåller delade kataloger och godkännandesteg för det. För det kreativa teamet är verktyget ett skyddsräcke: du står fortfarande för data, text och bild, och verktyget håller varje resultat inom varumärkets ramar.

![Producentens hela jobb: skriv orden. Typografi, färg och avstånd fastställdes när verktyget skapades](/t/url-shot?url=%2F%23%2Ftool%2Fwordmark%3Ftext%3DHello&width=1440&height=900&dpi=192&waitMs=2000&walker=1&format=svg&filename=aud-rules-in-the-tool)

Ytterligare tre skillnader:

- **Den färdiga filen, från indata.** Indata in, färdig fil ut, utan "spara den nu från ditt designverktyg och rätta till den".
- **Verktyg sätter samman verktyg.** Ett verktyg kan bädda in ett annat verktygs rendering i en enda färdig fil, utan kodkoppling mellan dem.
- **Öppen källkod.** Motorn har öppen källkod, och verktyg, tillgångar och designtokens är filer du kan behålla i versionshantering eller hantera i Lolly Work, inte rader i någon annans databas.

Djärv design klarar skyddsräckena. Den här stadskartan för affischtryck består av äkta vektorbanor för vägar och vatten, från en rullgardinsmeny och två färgfält som inte kan ställas in utanför designsystemet:

![Amsterdams kanalringar och vägnät ritade från kant till kant i designsystemets egen färg, varje streck placerat av mallen i stället för för hand](/t/url-shot?url=%2F%23%2Ftool%2Fstreet-map%3Fcity%3Damsterdam%26theme%3Dlight%26full&width=1440&height=900&dpi=96&waitMs=3200&walker=1&format=svg&cropSelector=%23tool-canvas&dark=1&filename=ov2-street-map-poster)

<!--i:eti-stamp-->
## Innovera probabilistiskt, skala deterministiskt

De flesta säljpresentationer om "AI-kreativitet" placerar modellen på fel sida av en gammal gräns. Skrivare och bokmålare fastställde var den går. Du arbetar fritt med skissen, där allt kan prövas och inget är fastlagt. Sedan går du till tryckpressen, som låser resultatet. Konsten fanns i skisserna, pressen var sättet den spreds på och det tryckta verket gick att lita på eftersom pressen höll sitt löfte vid varje tryckning.

Lolly är pressen. Använd vad du vill för idéerna, en modell, en designer eller en grov skiss, men i samma ögonblick som en idé ska bli många filer går den genom något som renderar på samma sätt varje gång, från indata som vem som helst kan läsa tillbaka. Jämförelsen ovan handlar egentligen om vem som gör det fastlagda steget upprepningsbart.

> Lita på den kreativa processen, skala med noggrannhet.

<!--i:eti-tag-->
## Gratis för alltid

**Om det renderas på din enhet är det gratis för alltid.** Motorn, skalen, verktygen och formaten har öppen källkod, och en släppt version kan inte tas tillbaka. Lolly Work har också öppen källkod. En organisation betalar för den infrastruktur och drift den väljer, utan programlicensavgift per användare eller rendering vid egen drift. [Frågor & svar](/info/faq.html) berättar historien bakom löftet.

<!--i:eti-map-pin-->
## Var ditt innehåll finns

Lollys kreativa arbete kan köras på hårdvara du äger, och dess designtokens, typsnitt, logotyper och verktyg är filer du kan behålla. Med Lolly Work finns delade projekt, tillgångar, policy och granskningsposter i lagring som din organisation konfigurerar. [Tillit](/info/trust.html) förklarar varför det spelar roll, och [Integritetspolicyn](/info/privacy.html) och [Verifiera själv](/info/verify-yourself.html) låter dig kontrollera påståendet i stället för att ta oss på orden.

<!--i:eti-grid-->
## Verktyg för verktyg

[Lolly i jämförelse, verktyg för verktyg](/info/compare.html) jämför Lolly med Canva, Adobe, Figma, Penpot, varumärkesportaler, renderings-API:er och onlinekonverterare, en sida var, och beskriver [vad som körs var](/info/compare.html#what-runs-where).
