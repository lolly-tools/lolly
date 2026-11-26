# Slik står Lolly seg

Lolly lager filer som følger merkevareprofilen, på din egen enhet, uten konto. **Lolly Work** er serveren for team: innlogging, delte prosjekter, godkjenninger og servergjengivelse, på maskiner organisasjonen din drifter. Begge har åpen kildekode under MPL-2.0.

De fleste team beholder verktøyene de har. En designapp leverer designene, et DAM forblir den autoritative kilden, og Lolly gjør godkjente inndata om til ferdige filer. [Bruk Lolly med ditt eksisterende DAM](/info/use-with-dam.html) beskriver den kombinasjonen. Ideen bak kombinasjonen er [innholdssuverenitet](/info/content-sovereignty.html).

<!--i:eti-gauge-->
## Dagens verktøy

Hver ring viser hvor fullstendig en produktkategori dekker ett behov. Trykk på **?** ved siden av en rad for å se dokumentasjonen, og **?** ved siden av tegnforklaringen for å se hvordan poengsettingen fungerer.

::: figure positioning-comparison
Sammenligning av funksjoner. Konkurrentundersøkelse basert på leverandørdokumenter, august til 21. november 2026. Lolly og Lolly Work vurdert 21. november 2026. Poengsetting: 0 mangler, 25 omvei, 50 reell, men tilgangsbegrenset eller delvis, 75 sterk med forbehold, 100 kjernekompetanse.
:::

::: details Kilder til poengsummene som ble endret i november 2026
- Canva: [API-endringslogg](https://www.canva.dev/docs/apps/rest-apis/changelog/), [tjenesteapper](https://www.canva.dev/blog/developers/canva-service-accounts/), [hjelp for Brand Controls](https://www.canva.com/help/brand-control/)
- Adobe: [InDesign API-endringslogg](https://developer.adobe.com/firefly-services/docs/indesign-apis/getting-started/changelog/), [priser for Adobe Express](https://www.adobe.com/express/pricing)
- Figma: [agent- og AI-kreditter](https://help.figma.com/hc/en-us/articles/42614902212887), [MCP-server](https://developers.figma.com/docs/figma-mcp-server/)
- Frontify og Bynder: [Frontifys versjonsmerknad fra oktober 2026](https://news.frontify.com/163371-what-s-new-in-october-2026), [Frontify MCP](https://help.frontify.com/en/articles/14787214-frontify-mcp-beta)
- Bannerbear og Placid: [priser for Bannerbear](https://www.bannerbear.com/pricing/), [Bannerbears endringslogg](https://www.bannerbear.com/changelog/), [priser for Placid](https://placid.app/pricing)
- Penpot: [priser for egen drift](https://penpot.app/pricing/self-host), [utgivelser](https://github.com/penpot/penpot/releases)
- Cloudinary: [innholdsproveniens](https://cloudinary.com/documentation/content_provenance_and_authenticity), [priser](https://cloudinary.com/pricing)
:::

Funksjoner og dokumentert erfaring er separate rader. Lollys første offentlige utgivelse var 1.0.1 den 30. august 2026, sikkerheten har ennå ikke gjennomgått en uavhengig revisjon, og dokumentasjonen på utbredelse er noen måneder gammel. [Innføring & styring](/info/adoption-governance.html#status) viser gjeldende status.

<!--i:eti-hammer-->
## Når du bør velge Lolly

::: cols
## Velg Lolly når

- Samme type fil trengs igjen og igjen: arrangementskort, merker, sertifikater, varsler, kort for sosiale medier
- Mange filer kommer fra én mal og en verditabell, i [Lolly Batch](/info/batch.html#make-many-versions-of-one-design) eller CLI-en
- Fargene, typografien og ressursene må holde seg innenfor designsystemet, selv på et åpent lerret
- Et ferdig design fra Figma, Penpot, Illustrator, InDesign, Affinity eller PDF skal bli redigerbart og kunne gjentas ([Importer et design](/info/design-import.html))
- Filene må lages på dine egne enheter eller servere

## Velg noe annet når

- Arbeidet er detaljert fotoretusjering eller illustrasjon
- Du designer og lager prototyper av et appgrensesnitt
- Du trenger et stort bilde- og malbibliotek klart fra første dag
- Du trenger en administrert tjeneste med lang erfaring fra drift i stor skala
:::

Importerte design og delte designtokener lar et team kombinere Lolly med spesialistapper, mens Lolly Work styrer delte ressurser, gjennomgang og levering.

For team med et kuratert DAM bør utgangspunktet være å beholde biblioteket og administratorene. [SUSEs erfaring med Brandfolder](/info/suse-brandfolder.html) dokumenterer hvordan integrasjon støttet innføring og endringsledelse for godkjenninger. DAM-leverandører og implementeringspartnere kan vurdere samme opplegg gjennom [partnerarbeidsflyten](/info/dam-partners.html).

I **Lolly Markdown Slides** skrives en hel presentasjon som data, får layout fortløpende og eksporteres som en redigerbar fil i PowerPoints eget format.

![Lolly Markdown Slides i delt visning: presentasjonens lysbilder listet som blokker til venstre, den ferdig utformede presentasjonen gjengitt til høyre](/t/url-shot?url=%2F%23%2Ftool%2Fdeck-studio&width=1440&height=900&dpi=192&waitMs=2600&walker=1&format=svg&dark=1&filename=ov2-deck-studio-output)

<!--i:eti-shield-check-->
## Reglene ligger i verktøyet

Lolly legger gjenbrukbare merkevareregler i verktøyet: farger, skrifter, utfallende marger, avstand og tillatte inndata. Malen låser delene en mottaker ikke skal endre. Lolly Work legger gruppetilgang og inndatapolicyer rundt malen, med godkjenningskjeder for innsending til katalogen og levering.

Å sjekke et verktøy én gang gjør gjentakbar produksjon enklere, fordi hvert resultat arver layoutreglene. Tekst, opplastede bilder og bruksrettigheter kan fortsatt trenge en sjekk, og Lolly Work tilbyr delte kataloger og godkjenningstrinn for det. For det kreative teamet er verktøyet et rekkverk: du bidrar fortsatt med dataene, teksten og bildet, og verktøyet holder hvert resultat innenfor merkevareprofilen.

![Hele jobben til produsenten: skriv ordene. Typografi, farge og avstand ble bestemt da verktøyet ble laget](/t/url-shot?url=%2F%23%2Ftool%2Fwordmark%3Ftext%3DHello&width=1440&height=900&dpi=192&waitMs=2000&walker=1&format=svg&filename=aud-rules-in-the-tool)

Tre forskjeller til:

- **Den ferdige filen, fra inndata.** Inndata inn, ferdig fil ut, uten «nå må du lagre den fra designverktøyet og fikse den».
- **Verktøy setter sammen verktøy.** Ett verktøy kan bygge inn et annet verktøys gjengivelse i én ferdig fil, uten kodekobling mellom dem.
- **Åpen kildekode.** Motoren har åpen kildekode, og verktøy, ressurser og designtokener er filer du kan beholde i versjonskontroll eller administrere i Lolly Work, ikke rader i andres databaser.

Dristig design overlever rekkverkene. Dette bykartet i plakatkvalitet har ekte vektorbaner for veier og vann, fra en rullegardin og to fargefelt som ikke kan settes til noe utenfor designsystemet:

![Amsterdams kanalringer og veinett tegnet fra kant til kant med designsystemets eget blekk, hver strek plassert av malen i stedet for for hånd](/t/url-shot?url=%2F%23%2Ftool%2Fstreet-map%3Fcity%3Damsterdam%26theme%3Dlight%26full&width=1440&height=900&dpi=96&waitMs=3200&walker=1&format=svg&cropSelector=%23tool-canvas&dark=1&filename=ov2-street-map-poster)

<!--i:eti-stamp-->
## Innover probabilistisk, skaler deterministisk

De fleste salgspresentasjoner om «kreativ AI» plasserer modellen på feil side av et gammelt skille. Skrivere og illuminatører slo fast hvor det går. Du arbeider fritt med skissen, der alt kan prøves og ingenting er fastlagt. Så går du til trykkpressen, som fastlegger. Kunsten lå i skissene, og pressen spredte den, og det trykte arbeidet var til å stole på fordi pressen holdt løftet sitt for hvert avtrykk.

Lolly er pressen. Bruk hva du vil til ideene, en modell, en designer eller en grov skisse, men i det øyeblikket en idé skal bli mange filer, går den gjennom noe som gjengir likt hver gang, fra inndata alle kan lese tilbake. Sammenligningen ovenfor handler egentlig om hvem som gjør det fastlagte trinnet gjentakbart.

> Stol på den kreative prosessen, skaler med nøyaktighet.

<!--i:eti-tag-->
## Gratis for alltid

**Hvis det gjengis på enheten din, er det gratis for alltid.** Motoren, skallene, verktøyene og formatene har åpen kildekode, og en utgitt versjon kan ikke trekkes tilbake. Lolly Work har også åpen kildekode. En organisasjon betaler for infrastrukturen og driften den velger, uten programvarelisensavgift per bruker eller gjengivelse ved egen drift. [Spørsmål & svar](/info/faq.html) forteller historien bak løftet.

<!--i:eti-map-pin-->
## Hvor innholdet ditt ligger

Kreativt arbeid i Lolly kan kjøre på maskinvare du eier, og designtokener, skrifter, logoer og verktøy er filer du kan beholde. Med Lolly Work ligger delte prosjekter, ressurser, policy og revisjonsposter i lagring organisasjonen din konfigurerer. [Tillit](/info/trust.html) forklarer hvorfor det betyr noe, og [Personvernerklæringen](/info/privacy.html) og [Verifiser selv](/info/verify-yourself.html) lar deg sjekke påstanden i stedet for å ta oss på ordet.

<!--i:eti-grid-->
## Verktøy for verktøy

[Lolly sammenlignet, verktøy for verktøy](/info/compare.html) sammenligner Lolly med Canva, Adobe, Figma, Penpot, merkevareportaler, gjengivelses-API-er og nettbaserte konverterere, én side hver, og viser [hva som kjører hvor](/info/compare.html#what-runs-where).
