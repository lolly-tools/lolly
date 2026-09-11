# Hvordan Lolly sammenligner seg

Hva Lolly gjør som dagens kreative verktøy ikke gjør, og hva den bevisst overlater til dem.

For versjonen verktøy for verktøy, én side hver for Canva, Adobe, Figma, rendrings-API-er og nettbaserte konvertere, se [Lolly sammenlignet, verktøy for verktøy](/info/compare.html). Hver side beskriver hva det andre verktøyet gjør bedre, og hva Lolly gjør i stedet.

> **Pilotstatus:** Lolly er en lukket pilotprototype, ikke et ferdig produkt, og sikkerheten gjennomgår for tiden SUSEs strenge infrastrukturherding, i forberedelse til bedriftsskala. Siden [Adopsjon og styring](/info/adoption-governance.html#status) dekker gjeldende tilstand.

## Dagens verktøy

Hver ring nedenfor viser hvor fullstendig en produktklasse leverer en kapabilitet **slik den leveres i dag** - ikke slik den markedsføres - der hver klasse vurderes ut fra sin beste representant. Lolly vurderes med samme kniv: den får den eneste røde ringen på tavlen, for modenhet. Åpne et radnavn for resonnementet bak vurderingene. Kolonnene er sortert etter Overall completeness-raden øverst - gjennomsnittet av de vurderte radene, med utgiftsraden ekskludert.

::: figure positioning-comparison
Funksjonsfullstendighet på tvers av dagens kreative verktøy, undersøkt august 2026. Poengsetting: 0 fraværende, 25 omvei-nivå, 50 reell, men avgrenset eller delvis, 75 sterk med forbehold, 100 kjernekompetanse.
:::

**Vurderingsnotater.** Lollys vurderinger forutsetter at de publiserte påstandene holder, som er grunnen til at modenhet er dens ene røde ring: lukket pilot, sikkerhetsherding pågår, ingenting revidert ennå. Undersøkelser flyttet flere celler.

Canva vurderes ut fra sitt beste familiemedlem per rad, siden det eier Affinity og Cavalry (begge gitt bort gratis oktober 2025). Offline- og on-device-rendring skårer 75 gjennom Affinity - en desktop-pakke som fortsatt krever en verifisert konto og har telemetri, samme fradrag som Adobe også får - mens Canvas eget offline-modus kun redigerer forhåndssynkroniserte design, én enhet, begrenset tidsvindu. Autofyll skårer 50: reelt, men Enterprise-låst, asynkront, kun tekst og bilde. Figmas massegenerering steg fra 25 til 50 da Buzz leverte regneark-utfylling (gratis betaversjon, august 2026).

Én regel styrer tavlen: Full (100), på rader som berører innholdet eller identiteten din, krever en kapabilitet du kan bruke uten konto og uten skybetingelse; rader som beskriver produktet selv (modenhet, brukervennlighet) er unntatt. Det koster Adobe på opphav: den bredeste leverte C2PA-en (Photoshop, Lightroom, Premiere, Firefly) signerer lokalt og i skyen, men aldri uten en Adobe-konto og identitet, altså 75. Det begrenser rendrings-API-ene på massegenerering og automatisering av samme grunn.

Lollys opphavsskår på 75 gjenspeiler on-device offline-signering: arkitektonisk sterkere, men ikke revidert, og en enhetsnøkkel leses som uverifisert i standard validatorer inntil en identitet eller en organisasjons egen CA går god for den. Penpots 50 kommer via det offisielle Lolly Export-tillegget: samme motorsignering, opt-in, oppgitt som Lollys egen. Penpot har også tavlens eneste utenfor-skala-ring, 90 på on-device-rendring - nettleser-canvas, lagring til din egen suverene sky (til og med en bærbar), privat eksport; bare server-hoppet skiller den fra Lolly. Cloudinary får sin egen kolonne: en mediepipeline (DAM, transformasjons-API, CDN), og den eneste sky-kolonnen som leverer C2PA (50, fordi fl_c2pa signerer ved levering, og attesterer levert-av-Cloudinary, ikke laget-av-deg).

Sanntidssamarbeid går motsatt vei: Figma setter skala-benchmarken (200 redaktører), og Lollys parvise, luftgapte P2P skårer Partial. Pris er et anslag, merket som det: listeprisregning på realistiske brukermikser, bevisst bredt, for skala, ikke innkjøp. Rendrings-API-ene får 75 på begrensninger: maler låst, ingen merkevarestyringslag.

Gapet: ingenting som leveres i dag er constraints-first og offline uten konto og uten server i rendringsveien, og ingen har kopiert kontoklausulen. Lolly leverer nå sitt eget åpne canvas - **Design**, et canvas for direktemanipulering - men fargene, typografien og ressursene på det følger merkevarens globale innstillinger, så selv fri arrangering forblir constraints-first.

Det Lolly fortsatt **ikke** er, er en ubegrenset designpakke; designere vil fortsette å bruke Illustrator og Figma for skreddersydd arbeid - og når det arbeidet må bli en styrt, reproduserbar ressurs, bringer Design-verktøyets [Importer et design](/info/design-import.html) den ferdige Figma-, Penpot-, Illustrator-, InDesign- eller PDF-filen inn på canvaset som redigerbare, merkevaretilpassede bokser.

![Designs frie canvas, der fargene, skrifttypene og ressursene som tilbys, er merkevarens egne](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Ftemplate%3D__blank__&width=1440&height=900&dpi=192&waitMs=2400&walker=1&format=svg&dark=1&filename=aud-open-canvas)

## Bruk det til

- Rask generering av operasjonaliserte kreative ressurser (event-fliser, merker, signaturer, varsler)
- Fri arrangering på det åpne canvaset (Design) når delene - farger, typografi, ikoner, bilder - må forbli tilpasset merkevarens globale innstillinger
- Å bringe inn et ferdig Figma-, Penpot-, Illustrator-, InDesign- eller PDF-design (Design-verktøyets Importer et design) slik at det kan redigeres, styres og re-rendres deterministisk i alle Lolly-formater
- Én-til-mange «fyll ut tre felt, få den ferdige ressursen»-flyter - inkludert bulkkjøring fra et regneark/CSV i `/pro`-batchrutenettet (lim inn eller importer rader, én ferdig ressurs per rad, last ned som en zip)
- Alltid-på, gjentagende merkevareutganger
- Ting der sentral kontroll over merkevareuttrykk betyr mer enn uttrykksmessig fleksibilitet

Deck Studio er et godt mål på taket her: en hel lysbildepresentasjon deklarert som data, lagt ut live på canvaset og eksportert som en native redigerbar PowerPoint.

![Deck Studio i delt visning - presentasjonens lysbilder listet som blokker til venstre, den utlagte presentasjonen rendret til høyre](/t/url-shot?url=%2F%23%2Ftool%2Fdeck-studio&width=1440&height=900&dpi=192&waitMs=2600&walker=1&format=svg&dark=1&filename=ov2-deck-studio-output)

## Ikke bruk det til

- Skreddersydd eller flaggskip-heroinnhold (reklameskilt, store videoer)
- Unikt kampanjearbeid som virkelig trenger en designer
- Idéutvikling som må slippe helt unna merkevaresystemet - Lollys åpne canvas følger fortsatt fargene, typografien og ressursene til merkevarens globale innstillinger, og det er nettopp poenget

## Innover probabilistisk, skaler deterministisk

De fleste «AI-kreativ»-pitchene plasserer modellen på feil side av en gammel linje. Skrivere og illuminatorer avgjorde allerede hvor den grensen går: du jobber løst på skissen, der alt kan prøves og ingenting er forpliktende, og så går du til trykkpressen, som er skremmende nettopp fordi den forplikter. Skissene var der kunsten lå. Pressen var hvordan den reiste. To redskaper, to jobber, hver oppfinnsom på sin egen måte, og det trykte verket kunne stoles på fordi pressen holdt sitt løfte ved hvert trykk.

Lolly er pressen, ikke skissen. Ta med hva du vil til idéutviklingen - en modell, en designer, en serviett - men i det øyeblikket en idé må bli ti tusen ressurser, går den gjennom noe som rendrer på samme måte hver gang, fra inndata hvem som helst kan lese tilbake. Det er det sammenligningen ovenfor egentlig handler om: ikke hvem som har den beste generatoren, men hvem som gjør det forpliktende steget reproduserbart.

> Stol på den kreative prosessen, skaler med presisjon.

## Godkjenn verktøyet, ikke filen

Alle andre verktøy på markedet produserer en *fil* som deretter må sjekkes - en merkevareansvarlig i en Slack-tråd, jus på ansvarsfraskrivelsen, en runde med endringer, nok en gjennomgang. Lolly flytter godkjenningen **ett steg oppstrøms**. Merkevarereglene - eksakte heksfarger, lisensierte skriftfiler, utfallsmarginer, avstander - er hardkodet inn i verktøyets HTML og CSS, slik at malen *ikke kan* levere en ressurs som bryter med merkevaren. Selve oppsettet håndhever reglene.

Så du slutter å godkjenne resultater og begynner å godkjenne **verktøyet** som lager dem. Godkjenn det én gang, og hver eneste ressurs det noensinne produserer er forhåndsgodkjent av konstruksjon - ingen menneske i løkken, ingen gjennomgangssyklus, uansett volum.

Dette er endringen den deterministiske motoren faktisk gir: det er ikke en raskere versjon av den gamle godkjenningsprosessen, den fjerner prosessen. For det kreative teamet er det et vern, ikke en erstatning - du kaster fortsatt ballen (dataene, teksten, bildet), og koden er kanten i bowlingbanen som holder hvert kast unna rennen.

![Produsentens hele jobb: skriv ordene. Skrift, farge og avstand var avgjort da verktøyet ble godkjent](/t/url-shot?url=%2F%23%2Ftool%2Fwordmark%3Ftext%3DApproved&width=1440&height=900&dpi=192&waitMs=2000&walker=1&format=svg&dark=1&filename=aud-approve-the-tool)

| Godkjenne ressurser på den gamle måten | Godkjenne verktøyet, Lolly-måten |
|---|---|
| Hver ferdige fil sjekkes, én om gangen | Verktøyet sjekkes én gang |
| Forespørsel → designer bygger → merkevaregjennomgang → juridisk sjekk → endringer → ny gjennomgang | Én parameterendring → ferdig ressurs |
| Designer, merkevareansvarlig, jus og forespørrer er alle involvert | Produsenten, på egen hånd |
| Dager per ressurs | Sekunder per ressurs |
| 10 000 ressurser = 10 000 gjennomgangssykluser | 10 000 ressurser = null (malen var allerede godkjent) |

## Hva dette gir på en unik måte

- **Vilt designpotensial levert trygt i kontekst.** Verktøy kan uttrykke dristige designideer innenfor hardkodede vernegrenser.

- **Programvarestyrt innholdsautomatisering som leverer den ferdige ressursen.** Inndata → ferdig fil. Ingen «lagre det nå fra designverktøyet ditt og etterbehandle det».
- **Verktøy setter sammen verktøy.** Ett verktøy kan bygge inn et annet verktøys rendering og levere det som del av én enkelt ferdig ressurs, uten kode-kobling mellom verktøyene - en grunnleggende funksjon ingen åpen-lerret- eller DAM-mal-produkt på markedet tilbyr.
- **Leverandørnøytralitet.** Full funksjons- og kostnadskontroll. Motoren er åpen kildekode. Verktøy og ressurser er git-sporet innhold, ikke låst inne i en SaaS-database.

Det første av disse er det folk undervurderer. Et byplakat-kvalitets kart, tegnet som ekte vektor-vei- og vannbaner, fra en nedtrekksmeny og to fargefelt som ikke kan settes utenfor merkevaren:

![Amsterdams kanalringer og veinett tegnet kant til kant i merkevarens egen blekk, hvert strøk plassert av malen fremfor for hånd](/t/url-shot?url=%2F%23%2Ftool%2Fstreet-map%3Fcity%3Damsterdam%26theme%3Dlight%26full&width=1440&height=900&dpi=96&waitMs=3200&walker=1&format=svg&cropSelector=%23tool-canvas&dark=1&filename=ov2-street-map-poster)

## Innholdssuverenitet

Det finnes et navn for det forrige avsnittet summerer opp til: suverenitet. Mediepipelinen din kjører på maskinvare du selv eier. Merkevaren din - tokenene, skriftene, logoene, verktøyene som håndhever dem - lever i filer du selv har, i versjonskontroll du selv styrer, ikke i en leverandørs database med en eksportknapp. Rendering skjer på enheten foran deg, så en ressurs går aldri via en tredjepart for å eksistere, og hele veien fra inndata til ferdig fil er åpen kildekode og inspiserbar. Om alle SaaS-designleverandører forsvant i morgen, ville en Lolly-installasjon ikke merke det.

Dette betyr noe for alle hvis arbeid bør overleve et abonnement: forelderen hvis fotobok ligger på den bærbare like mye som det offentlige organet hvis merkevarebibliotek ligger under anskaffelsesregler. For organisasjoner - offentlige organer, regulerte bransjer, alle hvis merkevare er en strategisk ressurs fremfor en pynt - er «hvor bor innholdet vårt og hvem kan slå det av» et styringsspørsmål, ikke en preferanse. Suverenitet er her en egenskap ved arkitekturen fremfor en vertsfunksjon lagt til for compliance, og sidene [Personvernerklæring](/info/privacy.html) og [Verifiser selv](/info/verify-yourself.html) finnes slik at du kan sjekke den påstanden fremfor å bare ta den for gitt.

Under alt dette ligger ett løfte, formulert som en forpliktelse fremfor en funksjon: **hvis det rendres på enheten din, er det gratis for alltid.** Motoren, skallene, verktøyene, formatene - hele den lokale kreative veien er åpen kildekode og forblir det. Løftet har en mekanisme: en versjon som er utgitt, er lisensiert slik at den ikke kan trekkes tilbake, og det finnes ingen bidragsyteravtale som kunne relisensiere arbeidet senere. Hele grensen får plass i én setning: alt som rendres på enheten din er gratis og åpen kildekode, for alltid; å koordinere mennesker og maskiner over et nettverk er jobben til et separat kontrollplan, [lolly.work](https://lolly.work).
