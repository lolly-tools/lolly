# Hvordan Lolly sammenligner seg

Lolly er to deler av ett åpen kildekode-prosjekt. **Lolly** er motoren, appene og verktøyene for å lage, redigere, konvertere og eksportere på enheten din, uten konto. **Lolly Work** er organisasjonsserveren, kjørt på din egen infrastruktur, for pålogging, delte prosjekter, godkjenninger og servergjengivelse. Begge er MPL-2.0. Denne siden sammenligner paret med de andre måtene folk designer, styrer og produserer filer på.

## Dagens verktøy

Hver ring scorer hvor fullstendig en produktklasse leverer en kapabilitet, der hver klasse scores på sin beste representant. Kolonnen Lolly dekker Lolly og Lolly Work sammen, og hver rad sier hvilken del som leverer hva. Åpne et radnavn for begrunnelsen bak scoren. Kolonner er sortert etter raden Overall completeness øverst: gjennomsnittet av de scorede radene, med utgiftsraden utelatt.

::: figure positioning-comparison
Kapabilitetssammenligning: konkurrentundersøkelse og score fra august 2026; dekning for Lolly + Lolly Work gjennomgått 28. september 2026. Scoring: 0 fraværende, 25 nødløsning, 50 reell men begrenset eller delvis, 75 sterk med forbehold, 100 kjernekompetanse.
:::

::: details Scoringsnotater
Tilgjengelige funksjoner og produksjonsmodenhet er adskilt. Lolly er utgitt: versjon 1.0 ble sluppet som åpen kildekode 30. august 2026, sikkerheten er ennå ikke uavhengig revidert, og bevisene for bruk er noen måneder gamle ([Adoption & Governance](/info/adoption-governance.html#status) har gjeldende status). Å ha enkel pålogging, godkjenninger eller servergjengivelse etablerer ikke en produksjonshistorikk, så modenhetsscoren gjenspeiler det. Konkurrentscorene beholder sin daterte gjennomgang fra august.

Én regel styrer tavlen. Full pott (100), på rader som berører innholdet eller identiteten din, krever en kapabilitet du kan bruke uten konto og uten skyforutsetning; rader om selve produktet, som modenhet og brukervennlighet, er unntatt. Den regelen koster Adobe på Content Credentials: den bredeste leverte implementasjonen (Photoshop, Lightroom, Premiere, Firefly) signerer lokalt og i skyen, men aldri uten en Adobe-konto og -identitet, så 75. Den setter tak for gjengivelses-API-ene på masseproduksjon og automatisering av samme grunn.

Canva scores på sitt beste familiemedlem per rad, siden det eier Affinity og Cavalry (begge gitt bort i oktober 2025). Gjengivelse uten nett og på enheten scorer 75 gjennom Affinity, en skrivebordspakke som fortsatt trenger en verifisert konto og bærer telemetri, fratrekket Adobe også tar; Canvas egen frakoblede modus redigerer bare forhåndssynkroniserte design, på én enhet, i et begrenset vindu. Autofill scorer 50: det er ekte men Enterprise-begrenset og asynkront, og det fyller bare tekst og bilder. Figmas masseproduksjon steg fra 25 til 50 da Buzz leverte regnearkfylling (en gratis beta, august 2026).

Lollys score på 75 for Content Credentials dekker signering på enheten og Lolly Works serversignering med en konfigurert organisasjonsidentitet; en verifiserer må fortsatt stole på signereren ([Content Credentials Identity](/info/content-credentials-identity.html)). Penpots 50 kommer gjennom Lollys egen eksportplugin for Penpot: den samme motorsigneringen, valgfri og oppgitt som Lollys. Penpot scorer 90 på gjengivelse på enheten: et nettleserlerret med et lagringsmål på serveren sin, som kan selvhostes. Cloudinary får sin egen kolonne for ressursbiblioteket, transformasjons-API-et og CDN-et; august-gjennomgangen scoret leveringssigneringen til 50.

Lollys live samarbeid omfatter direkte private collabs mellom to enheter og autentiserte work collabs gjennom Lolly Work, med delte redigeringer, markører og lagrede teamøkter. Scoren Partial gjenspeiler den nåværende work-installasjonen med én node og den korte driftshistorikken, ikke fravær av teamredigering. Prisanslag er daterte listepris-regnestykker for størrelsesorden, ikke innkjøp.
:::

## Når du bør velge Lolly

::: cols
## Velg Lolly når

- Den samme typen fil trengs om og om igjen: arrangementsfliser, navneskilt, sertifikater, varsler, sosiale kort
- Mange filer kommer fra én mal og en tabell med verdier, i [Batch](/info/batch.html#make-many-versions-of-one-design) eller CLI-et
- Fargene, skriften og ressursene må holde seg innenfor designsystemet, selv på et åpent lerret
- Et ferdig Figma-, Penpot-, Illustrator-, InDesign- eller PDF-design skal bli redigerbart og repeterbart ([Import a design](/info/design-import.html))
- Filene må lages på dine egne enheter eller servere

## Velg noe annet når

- Arbeidet er detaljert fotoretusjering eller illustrasjon
- Du designer og prototyper et applikasjonsgrensesnitt
- Du trenger et stort bilde- og malbibliotek klart første dag
- Du trenger en administrert tjeneste med lang erfaring i stor skala
:::

Importerte design og delte designtokener lar et team kombinere Lolly med spesialiserte applikasjoner, mens Lolly Work styrer delte ressurser, gjennomgang og levering.

En hel presentasjon viser taket: i **Markdown Slides** deklareres en presentasjon som data, legges ut live og eksporteres som en innebygd, redigerbar PowerPoint-fil.

![Markdown Slides i delt visning: presentasjonens lysbilder listet som blokker til venstre, den utlagte presentasjonen gjengitt til høyre](/t/url-shot?url=%2F%23%2Ftool%2Fdeck-studio&width=1440&height=900&dpi=192&waitMs=2600&walker=1&format=svg&dark=1&filename=ov2-deck-studio-output)

## Reglene ligger i verktøyet

Lolly legger gjenbrukbare merkevareregler i verktøyet: farger, skrifter, utfallsmarger, avstand og tillatte inndata. Malen låser delene en mottaker ikke må endre. Lolly Work legger gruppetilgang og inndatapolicyer rundt den malen, med godkjenningskjeder for katalogoppføringer og levering.

Å sjekke et verktøy én gang gjør repeterbar produksjon enklere, fordi hvert resultat arver layoutreglene. Tekst, opplastede bilder og bruksrettigheter kan fortsatt trenge kontroll, og Lolly Work leverer delte kataloger og godkjenningstrinn for det. For det kreative teamet er verktøyet et rekkverk: du kommer fortsatt med dataene, teksten og bildet, og verktøyet holder hvert resultat på merkevaren.

![Produsentens hele jobb: skrive ordene. Skrift, farge og avstand ble avgjort da verktøyet ble laget](/t/url-shot?url=%2F%23%2Ftool%2Fwordmark%3Ftext%3DHello&width=1440&height=900&dpi=192&waitMs=2000&walker=1&format=svg&filename=aud-rules-in-the-tool)

Tre ting til skiller denne tilnærmingen:

- **Den endelige filen, fra inndata.** Inndata inn, ferdig fil ut, uten "lagre den nå fra designverktøyet og rydd opp".
- **Verktøy setter sammen verktøy.** Ett verktøy kan bygge inn gjengivelsen til et annet verktøy i én ferdig fil, uten kodekobling mellom dem.
- **Åpent hele veien ned.** Motoren er åpen kildekode, og verktøy, ressurser og designtokener er filer du kan ha i versjonskontroll eller administrere i Lolly Work, ikke rader i noen andres database.

Dristig design overlever rekkverkene. Dette bykartet i plakatkvalitet er ekte vektorbaner for vei og vann, fra en rullegardin og to fargefelt som ikke kan pekes utenfor designsystemet:

![Amsterdams kanalringer og veinett tegnet kant til kant i designsystemets eget blekk, hver strek plassert av malen i stedet for for hånd](/t/url-shot?url=%2F%23%2Ftool%2Fstreet-map%3Fcity%3Damsterdam%26theme%3Dlight%26full&width=1440&height=900&dpi=96&waitMs=3200&walker=1&format=svg&cropSelector=%23tool-canvas&dark=1&filename=ov2-street-map-poster)

## Innover probabilistisk, skaler deterministisk

De fleste "AI creative"-innleggene plasserer modellen på feil side av en gammel linje. Skriverne og illuminatorene avgjorde hvor den går. Du arbeider løst på skissen, der alt kan prøves og ingenting er forpliktet. Så går du til trykkpressen, som forplikter. Skissene var der kunsten lå, og pressen var hvordan den reiste, og det trykte verket kunne stoles på fordi pressen holdt løftet sitt for hvert avtrykk.

Lolly er pressen. Ta med det du vil til ideene, en modell, en designer eller en grov tegning, men i det øyeblikket en idé må bli mange filer, går den gjennom noe som gjengir på samme måte hver gang, fra inndata hvem som helst kan lese tilbake. Sammenligningen ovenfor handler egentlig om hvem som gjør det forpliktede trinnet repeterbart.

> Stol på den kreative prosessen, skaler med presisjon.

## Gratis for alltid

**Hvis det gjengis på enheten din, er det gratis for alltid.** Motoren, skallene, verktøyene og formatene er åpen kildekode, og en utgitt versjon kan ikke tas tilbake. Lolly Work er også åpen kildekode. En organisasjon betaler for infrastrukturen og driften den velger, uten programvarelisens per bruker eller per gjengivelse for selvhosting. [Questions & answers](/info/faq.html) forteller historien bak løftet.

## Hvor innholdet ditt bor

Lollys kreative arbeid kan kjøre på maskinvare du eier, og designtokenene, skriftene, logoene og verktøyene er filer du kan beholde. Med Lolly Work bor delte prosjekter, ressurser, policy og revisjonsposter i lagring organisasjonen din konfigurerer. [Trust](/info/trust.html) forklarer hvorfor det betyr noe, og [Privacy Policy](/info/privacy.html) og [Verify It Yourself](/info/verify-yourself.html) lar deg sjekke påstanden i stedet for å ta vårt ord for det.

## Verktøy for verktøy

[Lolly compared, tool by tool](/info/compare.html) sammenligner Lolly med Canva, Adobe, Figma, Penpot, merkevareportaler, gjengivelses-API-er og nettbaserte konverterere, én side hver, og setter opp [what runs where](/info/compare.html#what-runs-where).
