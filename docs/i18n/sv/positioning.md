# Så jämför sig Lolly

Lolly är två delar av ett projekt med öppen källkod. **Lolly** är motorn, apparna och verktygen för att skapa, redigera, konvertera och exportera på din enhet, utan konto. **Lolly Work** är organisationsservern, driven på din egen infrastruktur, för inloggning, delade projekt, godkännanden och serverrendering. Båda är MPL-2.0. Den här sidan jämför paret med de andra sätten folk designar, styr och producerar filer.

## Dagens verktyg

Varje ring poängsätter hur fullständigt en produktklass levererar en förmåga, med varje klass poängsatt på sin bästa representant. Kolumnen Lolly täcker Lolly och Lolly Work tillsammans, och varje rad säger vilken del som ger vad. Öppna ett radnamn för resonemanget bakom dess poäng. Kolumnerna är sorterade efter raden Overall completeness överst: medelvärdet av de poängsatta raderna, med kostnadsraden undantagen.

::: figure positioning-comparison
Förmågejämförelse: konkurrentundersökning och poäng från augusti 2026; täckningen för Lolly + Lolly Work granskad 28 september 2026. Poängsättning: 0 saknas, 25 nödlösning, 50 verklig men begränsad eller partiell, 75 stark med förbehåll, 100 kärnkompetens.
:::

::: details Poängnoteringar
Tillgängliga funktioner och produktionsmognad är skilda saker. Lolly är släppt: version 1.0 levererades som öppen källkod den 30 augusti 2026, dess säkerhet har ännu inte fått en oberoende granskning och dess belägg för användning är några månader gamla ([Adoption & Governance](/info/adoption-governance.html#status) har det aktuella läget). Att ha enkel inloggning, godkännanden eller serverrendering fastställer ingen erfarenhet från produktion, så mognadspoängen speglar det. Konkurrenters poäng behåller sin daterade augustigranskning.

En regel styr tavlan. Full poäng (100), på rader som rör ditt innehåll eller din identitet, kräver en förmåga du kan använda utan konto och utan molnförutsättning; rader om själva produkten, som mognad och användarvänlighet, är undantagna. Den regeln kostar Adobe på Content Credentials: den bredaste levererade implementationen (Photoshop, Lightroom, Premiere, Firefly) signerar lokalt och i molnet, men aldrig utan ett Adobe-konto och en identitet, så 75. Den sätter ett tak för renderings-API:erna på massgenerering och automatisering av samma skäl.

Canva poängsätts på sin bästa familjemedlem per rad, eftersom det äger Affinity och Cavalry (båda bortskänkta i oktober 2025). Offline- och rendering på enheten får 75 genom Affinity, en datorsvit som fortfarande kräver ett verifierat konto och bär telemetri, avdraget Adobe också tar; Canvas eget offlineläge redigerar bara förhandssynkade designer, på en enhet, under ett begränsat fönster. Autofill får 50: det är verkligt men Enterprise-begränsat och asynkront, och det fyller bara text och bilder. Figmas massgenerering steg från 25 till 50 när Buzz levererade kalkylbladsifyllnad (en gratis beta, augusti 2026).

Lollys poäng 75 för Content Credentials täcker signering på enheten och Lolly Works serversignering med en konfigurerad organisationsidentitet; en verifierare måste ändå lita på signeraren ([Content Credentials Identity](/info/content-credentials-identity.html)). Penpots 50 kommer genom Lollys eget exporttillägg för Penpot: samma motorsignering, valfri och redovisad som Lollys. Penpot får 90 på rendering på enheten: en webbläsaryta med ett sparmål på sin server, som kan driftas på egen hand. Cloudinary får en egen kolumn för sitt tillgångsbibliotek, sitt transform-API och sitt CDN; augustigranskningen gav dess leveranssignering 50.

Lollys levande samarbete inkluderar direkta privata collabs mellan två enheter och autentiserade arbetscollabs via Lolly Work, med delade redigeringar, markörer och sparade teamsessioner. Poängen Partial speglar den nuvarande arbetsinstallationen med en nod och den korta driftshistoriken, inte frånvaro av teamredigering. Prisuppskattningar är daterad listprisaritmetik för att visa skala, inte upphandling.
:::

## När du ska ta till Lolly

::: cols
## Ta till Lolly när

- Samma sorts fil behövs om och om igen: eventrutor, namnbrickor, certifikat, larm, sociala kort
- Många filer kommer från en mall och en tabell med värden, i [Batch](/info/batch.html#make-many-versions-of-one-design) eller CLI
- Färgerna, typografin och tillgångarna måste hålla sig inom designsystemet, även på en öppen yta
- En färdig Figma-, Penpot-, Illustrator-, InDesign- eller PDF-design ska bli redigerbar och upprepbar ([Importera en design](/info/design-import.html))
- Filerna måste göras på dina egna enheter eller servrar

## Ta till något annat när

- Arbetet är detaljerad fotoretusch eller illustration
- Du designar och prototypar ett applikationsgränssnitt
- Du behöver ett stort lager av stockmaterial och mallar redo första dagen
- Du behöver en hanterad tjänst med lång erfarenhet i stor skala
:::

Importerade designer och delade designtokens låter ett team kombinera Lolly med specialistprogram, medan Lolly Work styr delade tillgångar, granskning och leverans.

En hel presentation visar taket: i **Markdown Slides** deklareras en presentation som data, läggs ut live och exporteras som en inbyggd, redigerbar PowerPoint-fil.

![Markdown Slides i delad vy: presentationens bilder listade som block till vänster, den utlagda presentationen renderas till höger](/t/url-shot?url=%2F%23%2Ftool%2Fdeck-studio&width=1440&height=900&dpi=192&waitMs=2600&walker=1&format=svg&dark=1&filename=ov2-deck-studio-output)

## Reglerna finns i verktyget

Lolly lägger återanvändbara varumärkesregler i verktyget: färger, typsnitt, utfallsmarginaler, avstånd och tillåtna indata. Mallen fastställer de delar en mottagare inte får ändra. Lolly Work lägger till gruppåtkomst och indatapolicyer kring den mallen, med godkännandekedjor för katalogbidrag och leverans.

Att kontrollera ett verktyg en gång gör repeterbar produktion enklare, eftersom varje utdata ärver dess layoutregler. Text, uppladdade bilder och användningsrättigheter kan ändå behöva kontrolleras, och Lolly Work tillhandahåller delade kataloger och godkännandesteg för det. För det kreativa teamet är verktyget ett skyddsräcke: du tar fortfarande med data, text och bild, och verktyget håller varje resultat i varumärkets stil.

![Producentens hela jobb: skriva orden. Typografi, färg och avstånd avgjordes när verktyget gjordes](/t/url-shot?url=%2F%23%2Ftool%2Fwordmark%3Ftext%3DHello&width=1440&height=900&dpi=192&waitMs=2000&walker=1&format=svg&filename=aud-rules-in-the-tool)

Tre saker till skiljer det här tillvägagångssättet:

- **Den färdiga filen, från indata.** Indata in, färdig fil ut, utan "spara nu från ditt designverktyg och fixa till den".
- **Verktyg komponerar verktyg.** Ett verktyg kan bädda in ett annat verktygs rendering i en enda färdig fil, utan kodkoppling mellan dem.
- **Öppet hela vägen ned.** Motorn har öppen källkod, och verktyg, tillgångar och designtokens är filer du kan behålla i versionshantering eller hantera i Lolly Work, inte rader i någon annans databas.

Djärv design överlever skyddsräckena. Den här stadskartan i affischklass är äkta vektorvägar och vattenvägar, från en rullgardin och två färgfält som inte kan riktas utanför designsystemet:

![Amsterdams kanalringar och vägnät ritade kant till kant i designsystemets eget bläck, varje linje placerad av mallen i stället för för hand](/t/url-shot?url=%2F%23%2Ftool%2Fstreet-map%3Fcity%3Damsterdam%26theme%3Dlight%26full&width=1440&height=900&dpi=96&waitMs=3200&walker=1&format=svg&cropSelector=%23tool-canvas&dark=1&filename=ov2-street-map-poster)

## Innovera probabilistiskt, skala deterministiskt

De flesta "kreativ AI"-pitchar placerar modellen på fel sida av en gammal gräns. Skrivare och illuminatörer avgjorde var den går. Du arbetar fritt på skissen, där allt kan prövas och inget är bundet. Sedan går du till tryckpressen, som binder. Skisserna var där konsten fanns, och pressen var hur den färdades, och det tryckta verket kunde litas på eftersom pressen höll sitt löfte vid varje avdrag.

Lolly är pressen. Ta med vad du vill till idéerna, en modell, en designer eller en grov teckning, men i det ögonblick en idé ska bli många filer går den genom något som renderar på samma sätt varje gång, från indata vem som helst kan läsa tillbaka. Jämförelsen ovan handlar egentligen om vem som gör det bindande steget repeterbart.

> Lita på den kreativa processen, skala med noggrannhet.

## Gratis för alltid

**Om det renderas på din enhet är det gratis för alltid.** Motorn, skalen, verktygen och formaten har öppen källkod, och en släppt version kan inte tas tillbaka. Lolly Work har också öppen källkod. En organisation betalar för den infrastruktur och drift den väljer, utan någon programlicensavgift per plats eller rendering för egen drift. [Frågor och svar](/info/faq.html) berättar historien bakom löftet.

## Var ditt innehåll finns

Lollys kreativa arbete kan köras på hårdvara du äger, och dess designtokens, typsnitt, logotyper och verktyg är filer du kan behålla. Med Lolly Work finns delade projekt, tillgångar, policy och granskningsposter i lagring som din organisation konfigurerar. [Förtroende](/info/trust.html) förklarar varför det spelar roll, och [integritetspolicyn](/info/privacy.html) och [Verify It Yourself](/info/verify-yourself.html) låter dig kontrollera påståendet i stället för att lita på vårt ord.

## Verktyg för verktyg

[Lolly jämfört, verktyg för verktyg](/info/compare.html) jämför Lolly med Canva, Adobe, Figma, Penpot, varumärkesportaler, renderings-API:er och onlineomvandlare, en sida var, och redovisar [vad som körs var](/info/compare.html#what-runs-where).
