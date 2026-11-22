# Personvernerklæring

*Sist oppdatert: 10. november 2026*

- <!--i:eti-home--> **Det du lager i Lolly, lages på enheten din.** Å åpne et verktøy, skrive, forhåndsvise, eksportere og sjekke en fil skjer i appen på telefonen din, datamaskinen din eller i nettleseren din. Du trenger ingen konto, og appen setter ingen informasjonskapsler for noe av dette.
- <!--i:eti-globe--> **Det du lager, forlater enheten din bare når du ber om det.** Å legge til en Google Font, sende en fil til Drive eller Dropbox, slå på Sync, spille radio eller laste ned en AI-modell for lokal bruk gjør hver sin forespørsel som du startet. Appen henter også verktøyene og oppdateringene sine fra sin egen adresse, og disse forespørslene inneholder ingenting du har laget. [Alle nettverksforespørsler appen kan gjøre](#every-network-request-the-app-can-make) lister dem, vert for vert.
- <!--i:eti-cpu--> **Noen få Lolly-tjenester kjører på en server.** Gjengivelseslenker, bildehenteren, endepunktet for AI-agenter og tjenesten for bekreftet identitet mottar bare det du sender dem, og beholder det ikke lenger enn denne siden oppgir.
- <!--i:eti-building--> **Organisasjonens Lolly Work-instans er annerledes.** Den lagrer det delte arbeidet du legger der og en logg over innloggingene dine og det du gjør der, og driftsansvarliges policy gjelder for disse dataene, ikke denne.

For å spørre om dataene dine eller bruke rettighetene dine, se [Rettighetene dine](#your-rights) og [Hvem som er ansvarlig](#who-is-responsible-and-how-to-reach-us).

::: figure privacy-where-data-goes
Hvor dataene dine går: De blir på enheten din med mindre du starter en forespørsel, og hver type forespørsel har sin egen destinasjon.
:::

<!--i:eti-clipboard-->
## Hva denne erklæringen dekker

Lolly er programvare med åpen kildekode som alle kan kjøre: en motor, appskall for nett, datamaskin, mobil og terminal og en nettleserutvidelse. Denne erklæringen har to deler:

- <!--i:code--> **Selve programvaren**: hva den gjør og ikke gjør med dataene dine, uansett hvor den kjører. Dette er en egenskap ved koden, så det gjelder for alle Lolly-installasjoner, våre eller andres.
- <!--i:server--> **lolly.tools**, referanseinstallasjonen SUSE driver: valgene som gjøres ved drift av de valgfrie serverdelene, som hva som logges, hvor lenge og av hvem.

På en egenhostet Lolly-instans eller en Lolly-instans for en virksomhet gjelder fortsatt programvareatferden nedenfor, men den *driftsansvarlige* for instansen, ikke SUSE, har ansvar for alt på serverne sine: gjengivelsesendepunktet, MCP-serveren, sertifikattjenesten og Lolly Work-instansen. Be dem om deres egen erklæring. [Innføring & styring](/info/adoption-governance.html) beskriver hva det innebærer å drifte Lolly.

<!--i:eti-home-->
## Hva som blir på enheten din

Lollys nett-, skrivebords- og mobilapper kjører hele gjengivelsesmotoren på enheten. Når verktøyene, ressursene og koderne du bruker, er på enheten, trenger gjengivelse og nedlasting ingen server.

**Frittstående bruk av appen setter ingen informasjonskapsler.** Organisasjonsinnlogging og den valgfrie registreringen av bekreftet identitet har egne informasjonskapsler, beskrevet i sine deler. Appen beholder disse opplysningene på enheten:

- <!--i:sliders--> **Grensesnittinnstillinger**: tema, språk, lydinnstillinger, tilgjengelighetsinnstillinger, størrelser for sidepanel og zoom, sorterings- og visningsvalg og hvilke tips du har sett, i profiloppføringen din og i `localStorage`, slik at de er klare før appen er ferdig med å starte.
- <!--i:usercheck--> **Profilopplysningene dine**: navnet, e-postadressen, telefonnummeret, stillingstittelen, organisasjonen, byen, landet og portrettbildet du legger inn i **Settings**, i IndexedDB. De fyller ut verktøyene som ber om dem, og skrives inn i proveniensposten til en eksport eller en delt `.lolly`-fil bare når du slår på *Use my details*.
- <!--i:download--> **En frakoblet hurtigbuffer for verktøykatalogen og forhåndsvisninger av ressurser**, slik at galleriet fungerer uten tilkobling.
- <!--i:hash--> **Lokale brukstellere** for statistikken på profilkortet ditt, som antall eksporter og hvilke verktøy: en liten, avgrenset oppføring i `localStorage`, som vi aldri leser. De forlater enheten bare i din egen sikkerhetskopifil eller Sync-kopi.
- <!--i:folder--> **Ditt eget arbeid**: dokumenter, lagrede økter og historikken deres, opplastede bilder og skrifter, filresultater og tidligere versjoner og Trash, som beholder slettede elementer i 30 dager med mindre du tømmer den før. Etter 30 dager fjernes et element neste gang du åpner Projects, med mindre lagret arbeid fortsatt bruker det, slik det kan bruke et bilde eller en skrift. Disse ligger i IndexedDB og i nettleserens private fillagring (OPFS) på enheten, og blir der med mindre du velger Sync eller deling.
- <!--i:globe--> **Meeting Planners byoppslag**, i `localStorage`, slik at hver by slås opp én gang.
- <!--i:cpu--> **Nedlastede modeller og festede verktøy**: AI-modeller for lokal bruk som du har godtatt å laste ned og verktøy du har festet for bruk uten nett.
- <!--i:seal--> **Signeringsidentiteten din**, når du registrerer deg: det varige nøkkelparet som signerer dine Content Credentials og sertifikatet med den bekreftede e-postadressen din, i IndexedDB. Den private nøkkelen forlater aldri enheten. Uten registrering lages nøkkelen for hver eksport til akkurat den eksporten og forkastes; [Bekreftet identitet](#verified-identity-a-sign-in-you-start-yourself) forklarer begge deler.
- <!--i:link--> **Tilkoblede tjenester**: innloggingene, app-passordene, nøklene og Sync-passfrasen du velger å beholde, kontoetikettene som vises ved siden av dem og listen **Links you've shared**, med navnet og lenken til hver fil. De er aldri med i en sikkerhetskopi eller Sync-kopi; [Filer du sender](#files-you-send) beskriver hver tjeneste.

::: details Andre opplysninger appen beholder på enheten
- **Svarene dine.** Hvilke engangsspørsmål du svarte på og hvordan: å legge til en Google Font, den første forespørselen til hver agent i **Ask an agent**, **Allow pages from any site** og **Allow AI control**. Også hvilke meldinger og velkomsthilsener du har lukket.
- **Nylig aktivitet.** En kort liste over de siste nedlastingene dine, med hver fils navn, verktøy, innstillinger og miniatyrbilde, for Dashboard, og ressursene og verktøyene du brukte sist.
- **En tilkoblet instans.** Adressen, en installasjons-ID for denne enheten, en oversikt over hvilke lokale kopier som kom fra hvilket arbeidsområde og en hurtigbufret kopi av det instansen sender appen: innstillingene og kontoens navn, e-postadresse, grupper og rolle.
- **Arbeidsfiler.** Pågående skjermopptak, lydforhåndsvisninger og videokodinger, i OPFS, og en fil en annen app deler til Lolly, beholdt til appen starter neste gang.
- **Dokumentasjonssidene.** lolly.tools/info setter ingen informasjonskapsler. De beholder temaet, språket og språkrekkefølgen din i `localStorage`, leser appens innstillinger Reduce motion og Large text og, for veien tilbake til appen, adressen til appvisningen denne nettleserfanen kom fra. De beholder bare en kopi av dokumentasjonen hvis du laster den ned for bruk uten nett.
:::

**Settings → Storage** viser hvor mye plass Lolly bruker på enheten, med arbeidet ditt, Trash, nedlastede modeller, frakoblede kopier og hurtigbuffere listet hver for seg. **Clear all my data** der fjerner den lokale kopien, inkludert Lollys service workers og frakoblede hurtigbuffere, og slår av Sync først. Den beholder bare en markør som forteller de andre åpne Lolly-fanene dine at tømmingen skjedde. Den avslutter ikke en organisasjonsinnlogging: Den informasjonskapselen forsvinner når du logger ut, eller når du sletter nettstedets data i nettleseren, som også fjerner alt denne knappen gjør. Lagring som er strengt nødvendig for tjenesten du ba om, krever ikke samtykke etter ePrivacy Directive (Art. 5(3)), bare åpenhet, som dette dokumentet og meldingen i appen gir.

![Lagringsdelen av Settings på en skjerm med telefonbredde: hver kategori av data på enheten er navngitt, med knappen Clear all my data ved siden av listen](/t/url-shot?url=%2F%23%2Fprofile%3Ffocus%3Dstorage-section&width=430&height=1600&dpi=192&waitMs=2400&css=.welcome-dialog%2C.personalize-nudge%2C.store-selbar%2C.profile-row-value%2C.profile-group-value%2C%23store-hero-num%2C%23store-headroom%7Bdisplay%3Anone%7D&format=svg&waitSelector=%5Bdata-store-group%3Dmove%5D&drive=click%3A%5Bdata-store-group%3Dwork%5D%3Esummary%3Bclick%3A%5Bdata-store-group%3Dcaches%5D%3Esummary&walker=1&cropSelector=%23storage-section&dark=1&filename=pv-storage-clear)

**Export my data** lager en `lolly-backup`-fil som du beholder og kontrollerer. Den berører aldri serverne våre med mindre du selv sender den et sted. Se [Dataoverføring](/info/data-transfer.html).

### Filverktøy som kjører på enheten din

Noen verktøy, som **Lolly Strip Hidden Data**, **Compress** og andre med merket **Runs on your device**, arbeider med en fil du gir dem. Filen leses inn i minnet, transformeres på enheten og tilbys tilbake som en nedlasting. Den lastes aldri opp, fordi det ikke er noen server i denne prosessen. Disse filverktøyene fungerer uten nett, og resultatet har ikke noe vannmerke eller noen metadata fra oss.

**Lolly Rondocode** er det ene unntaket, fordi det lager ny lyd fra sangen din i stedet for å transformere en fil du har. Hver lydfil det skriver, inneholder Content Credentials som registrerer sangen og oppgir eventuell AI-generert sang. Export-panelet sier fra om dette før du eksporterer, og [Lolly Rondocode-sanger](/info/rondocode.html#files-from-the-rondocode-utility) lister nøyaktig hva som registreres.

**Music generator** lager også ny lyd. En WAV eller M4A du laster ned derfra, inneholder alltid Content Credentials som sier at Lollys musikkgenerator laget sporet, og oppgir lisensen musikken er underlagt, CC BY 4.0, med krediteringen *Musikk laget med Lolly (https://lolly.tools), CC BY 4.0*. En melodi du lagrer derfra, registrerer profilnavnet ditt som skaper, når profilen din har et navn, versjonene av Lolly og motoren og denne lisensen, alt vist i melodiens detaljer i Assets. Navnet blir i biblioteket ditt: En eksport som spiller melodien, legger det bare til mens *Use my details* er på, og nedlastingen fra musikkgeneratoren inneholder ikke noe navn. [Hva et spor registrerer](/info/generated-music.html#what-a-track-records) lister hver opplysning.

![Merket disse verktøyene har: Runs on your device - ingenting lastes opp](/t/url-shot?url=%2F%23%2Ftool%2Ftext-helper&width=1440&height=900&dpi=192&waitMs=2400&walker=1&format=svg&cropSelector=%5Bdata-privacy%5D&dark=1&filename=pv-ondevice-badge)

**Prepare for sharing** og **Lolly Compare** arbeider i minnet på enheten og sender ingenting til en server, og Prepare legger ingenting til i historikk, lenker, sikkerhetskopier eller Sync før du lagrer et resultat.

<a id="how-prepare-for-sharing-and-compare-handle-your-files"></a>
::: details Slik håndterer Prepare for sharing og Lolly Compare filene dine
**Prepare for sharing** holder inndataene det arbeider med, private funn og erstatningskart i minnet, og sjekker ingen påloggingsopplysninger på nettet. Du velger om du vil kopiere, laste ned, sende eller lagre et resultat i biblioteket ditt; et lagret resultat følger deretter bibliotekets innstillinger for sikkerhetskopiering og Sync. Oppskriftsfiler utelater tidligere innhold og bokstavelige tilordninger, og sammendragsrapporter inneholder antall, omfangs-ID-er og filhasher. CLI-en lagrer en privat gjennomgangsfil med originalverdiene bare når den blir bedt om det med `--review-file`. Når du forlater en klargjøringsvisning, frigjøres arbeidstilstanden. Dette er ikke et løfte om sporfri sletting fra minnet i nettleseren eller operativsystemet.

Klargjorte kopier og fullførte filoperasjoner deler Lolly Compare-kontrollene. Fjernede verdier er sammenfoldet i utgangspunktet, og sammenligningsrapporter utelater kildenavn, stier og verdier med mindre du velger å ta dem med. Filhistorikken lagrer kopien, så en sammenligning etter ny innlasting krever at du velger originalen på nytt, kontrollert mot den registrerte SHA-256-hashen. Å velge den lagrer eller laster ikke opp filen.
:::

Lolly Strip Hidden Data og Prepare for sharing undersøker også DOCX-, PPTX- og XLSX-filer på enheten. Valgte egenskaper i støttede DOCX-filer kan fjernes i en ny kopi; annet Office-innhold kan bare undersøkes, og private forhåndsvisninger vises bare når du bruker en kontroll for å vise dem.

::: details Hva Office-undersøkelsen leser og fjerner
| Office-format | Pakkeinnhold som undersøkes | Støttet fjerning |
|---|---|---|
| DOCX | Kjerneegenskaper, appegenskaper og egendefinerte egenskaper; kommentarer og forfattere; markører og forhåndsvisninger for sporede endringer; skjulte tekstsegmenter; eksterne relasjoner; innebygde objekter | Valgt forfatter, sist lagret av, datoer for opprettelse/endring/siste utskrift, tittel, emne, beskrivelse, nøkkelord, egendefinerte egenskaper, Company, Manager, Template, hyperlenkebase, appnavn og versjon og statistikk (total redigeringstid og antall sider, ord, tegn, linjer og avsnitt) |
| PPTX | Egenskaper; kommentarer og forfatteroppføringer; presentasjonsnotater; markører for skjulte lysbilder; eksterne relasjoner; innebygde objekter og støttede nestede arbeidsbøker | Ingen |
| XLSX | Egenskaper; kommentarer og notater; markører for skjulte ark, rader og kolonner; definerte navn; eksterne relasjoner og tilkoblinger; områder med eksterne lenker og pivothurtigbuffer; innebygde objekter | Ingen |

**Begrensninger.** Kartleggingen undersøker ikke synlig tekst, formler, avhengigheter, gjengitt utseende eller vilkårlige binærdeler fullt ut. Den støtter opptil 300 pakkedeler, 64 MiB samlet oppgitt størrelse etter utpakking, 2 MiB per XML-del og to nestede nivåer av innebygde pakker; Prepare deler grensene for deler og utpakking på tvers av hele jobben. Avkortet, feilformatert, kryptert og ustøttet innhold rapporteres og beholdes. Makroinnhold identifiseres og kjøres aldri, eldre binære Office-formater og XLSB undersøkes ikke, og eksterne referanser hentes aldri.

**Hva DOCX-opprydding beholder.** Opprydding støtter DOCX-pakkeformatet Transitional med kanoniske deler for kjerneegenskaper, egendefinerte egenskaper og utvidede egenskaper. Fra utvidede egenskaper kan Company, Manager, Template, HyperlinkBase, Application, AppVersion og statistikken TotalTime, Pages, Words, Characters, CharactersWithSpaces, Lines og Paragraphs fjernes. DocSecurity, overskrifter og deltitler, lenkeflagg og andre appegenskaper beholdes. Fjerning av Template lar eventuelle tilknyttede mallenker bli i dokumentinnstillingene, der kartleggingen rapporterer dem som eksterne relasjoner.

Noen leseprogrammer velger hvordan de tegner diagrammer og tegninger ut fra appnavnet og versjonen; LibreOffice viser for eksempel et diagram fra en Word 2007-fil annerledes uten dem. Begge beholdes når filen inneholder diagrammer, bilder, former eller innebygde objekter, og undersøkelsen lister dem som beholdt. En egenskap som et Word-felt viser (TEMPLATE, EDITTIME, NUMPAGES, NUMWORDS eller NUMCHARS), beholdes, og lenkefelt og relative eksterne lenker beholder HyperlinkBase, fordi målene deres tolkes ut fra den basisadressen.

**Hva som bare kan undersøkes.** Utvidede data for digitale signaturer hindrer opprydding. Signerte, makroaktiverte, krypterte, feilformaterte, omdøpte eller nestede Office-pakker kan fortsatt bare undersøkes. Det samme gjelder filer med andre egenskapsavhengige Word-felt, som DOCPROPERTY eller AUTHOR, eller med XML-bundne innholdskontroller, fordi fjerning av en egenskap kan endre dokumentet når Word oppdaterer disse bindingene, og hurtigbufret felttekst ikke kan vise at neste gjengivelse vil se lik ut. XML-deler med uvanlige filendelser, relasjonsmål i Word XML som ikke kan undersøkes trygt, feilaktig deklarerte topptekst- eller bunntekstdeler og SVG-deler deklarert som XML med filendelsen `.svg` kan også bare undersøkes i denne første oppryddingsversjonen.

**Slik sjekker oppryddingen arbeidet sitt.** Egenskapsdeler, deklarasjonene deres, uvedkommende pakkemedlemmer, XML-kommentarer og ZIP-kommentarer beholdes. Oppryddingen bruker kartleggingens grenser og sjekker integriteten til hvert medlem før skriving, og undersøker deretter de resulterende egenskapene på nytt. Lolly Compare viser støttede egenskapsforskjeller med verdiene sammenfoldet; det sammenligner ikke synlig tekst eller gjengitt utseende. Verdier bruker forhåndsvisninger på opptil 2048 tegn, så forskjeller utenfor en forhåndsvisning vises kanskje ikke, og en delvis gjennomgang kan ikke fastslå at to filer er like. CLI-ens `prepare --strip-hidden-data` fjerner støttede DOCX-egenskaper, og en privat gjennomgangspakke kan velge enkelte av dem. Hvis en sikkerhetssjekk for opprydding feiler, beholdes filen og operasjonen rapporteres som mislykket.
:::

<!--i:eti-globe-->
## Alle nettverksforespørsler appen kan gjøre

De fleste forespørsler henter verktøy, skrifter eller modeller til enheten din. Send-handlinger overfører filen du valgte, Sync overfører en sikkerhetskopi til lagringen du valgte og organisasjonstjenester overfører innholdet eller opplysningene som trengs for delt arbeid. Hver gruppe nedenfor lister hva som forlater enheten din, når og hva som skjer hvis en driftsansvarlig blokkerer forespørselen. Identitets- og ressursleverandører som driftsansvarlig har konfigurert, kan legge til destinasjoner i den installasjonen. [Alle faste verter i én tabell](#every-fixed-host-in-one-table) lister vertene nettappen kan kontakte.

::: details Ting som hentes til enheten din
- <!--i:download--> **Verktøykatalogen.** Ingenting personlig: en forespørsel om Lollys egen offentlige verktøy- og ressursindeks, til appens egen adresse, ved oppstart og deretter hurtigbufret for bruk uten nett. Hvis den blokkeres, kjører appen med de hurtigbufrede verktøyene og slutter å oppdage nye.
- <!--i:sparkle--> **Emojisett.** Settet du velger, lastes ned fra appens egen adresse første gang du bruker det. Ingenting personlig sendes. Lottie-animasjoner leses på enheten og kontakter ingen.
- <!--i:document--> **Google Fonts.** Navnet på den valgte skriftfamilien og IP-adressen din sendes til Googles skriftservere (`fonts.googleapis.com` for stilarket, `fonts.gstatic.com` for skriftfilen). Dette skjer bare når du legger til en Google Font i Lolly Design System Setup, og først etter at du har godtatt en dialog som sier nøyaktig dette. Hver familie hentes én gang, beholdes deretter på enheten og brukes uten nett. Hvis forespørselen blokkeres, stopper velgeren; last opp en skriftfil i stedet.
- <!--i:cpu--> **AI-modeller for lokal bruk.** Ingenting personlig: en modellfil lastes ned og beholdes deretter på enheten. Nettversjoner bruker appens egen adresse som standard; en versjon kan angi en annen modellvert, som Lollys utgivelsesvert `lolli.li` for de pakkede appene. Verten mottar forespørselen og IP-adressen din, uten konto og uten inndata til modellen. Dette skjer bare når du bruker en funksjon som trenger en modell (Lolly Verifys dybdeskanning, bildeoppskalering, tale og lignende) eller velger å laste ned modeller for bruk uten nett. Hvis forespørselen blokkeres, venter den funksjonen, og alt annet fungerer.
- <!--i:sliders--> **ICC-trykkprofiler.** Ingenting personlig: en forespørsel om en profil for standard trykkforhold til ICCs offentlige register (`registry.color.org`, `www.color.org`), bare når du klikker på en ICC-forhåndsinnstilling i trykkprofilbehandleren, én gang per profil. Hvis forespørselen blokkeres, virker ikke forhåndsinnstillingene; legg til din egen `.icc`-profil.
- <!--i:globe--> **Nettradio.** Ingenting personlig: en spillelisteforespørsel og en lydstrøm fra stasjonen (`api.somafm.com` og strømmeserveren den peker på, `*.somafm.com`), bare mens du spiller den valgfrie radioen i lydspilleren. Hvis forespørselen blokkeres, virker ikke radioen, og alle andre lydfunksjoner fungerer.
:::

::: details Et verktøy som trenger sanntidsdata
- <!--i:globe--> **Meeting Planners byoppslag.** I dag er dette det eneste verktøyet som henter sanntidsdata. Det ber `geocoding-api.open-meteo.com` om å gjøre hvert bynavn (vertsbyen og byen til hvert teammedlem) om til koordinater og en tidssone, uten konto, nøkkel eller identifikator utover selve forespørselen. Inndatafeltet Host city forklarer dette, og hvert svar lagres på enheten slik at en by slås opp én gang. Det kjører bare mens verktøyet er åpent. Hvis forespørselen blokkeres, mislykkes oppslaget, og ingenting annet påvirkes.
:::

::: details Filer du sender
Hver av disse sender bare den ene filen du valgte, når du trykker på Send-knappen, etter en innlogging du fullfører i tjenestens eget vindu. Bluesky-app-passordet, Discord-webhookadressen, Nextcloud-app-passordet og S3-nøklene lagres bare på denne enheten, aldri i en sikkerhetskopi, og **Disconnect** sletter dem.

- <!--i:upload--> **Google Drive.** Filen, i hvilket som helst format, sendes til Googles Drive-API (`www.googleapis.com`). Lollys tilgang er begrenset til filer det har opprettet (tilgangsomfanget `drive.file`), så det kan aldri lese resten av Drive. I nettappen holdes innloggingstokenet i minnet for økten og lagres aldri; i de andre appene lagres et oppdateringstoken bare på denne enheten hvis du krysser av for **Stay connected**. Knappen finnes bare i versjoner der driftsansvarlig har konfigurert en Google-klient-ID. Hvis det er blokkert, vises knappen aldri; last ned filen og last den opp selv. **Delingslenker.** Hvis du trykker på **Create a share link**, legger et nytt kall til `www.googleapis.com` til en tillatelse for den filen (alle med lenken, Workspace-domenet ditt eller adresser du skriver inn, som Google da sender e-post til) og leser lenken. **Stop sharing** sletter tillatelsen. Ingenting annet trengs: Tilgangsomfanget `drive.file` dekker allerede filer Lolly har opprettet.
- <!--i:upload--> **Dropbox.** Filen sendes til Dropbox-API-et (`api.dropboxapi.com` for innlogging og metadata, `content.dropboxapi.com` for filen). Tilgangen gjelder bare appmappen, så Lolly ser `Apps/` og sin egen mappe der og ingenting annet. **Open**-lenken som vises, er en kortvarig privat lenke, og ingen offentlig deling opprettes. Et oppdateringstoken lagres bare hvis du krysser av for **Stay connected**. Knappen finnes bare med en Dropbox-klient-ID konfigurert av driftsansvarlig. **Delingslenker.** Først når du trykker på **Create a share link**, ber Dropbox deg om å godkjenne én tillatelse til, `sharing.write`. Lolly kaller deretter `api.dropboxapi.com` for å opprette lenken (`sharing/create_shared_link_with_settings`) og, for **Stop sharing**, for å trekke tilbake lenken. Sending av filer ber aldri om denne tillatelsen.
- <!--i:upload--> **OneDrive.** Filen sendes til Microsofts identitets- og Graph-tjenester (`login.microsoftonline.com` for innlogging, `graph.microsoft.com` for opplastingen); en stor fil lastes opp i deler til `api.onedrive.com` eller lagringsopprinnelser driftsansvarlig har konfigurert. Tilgangen er begrenset til Lollys egen mappe under `Apps/`, pluss visningsnavnet ditt for kontoetiketten. Et oppdateringstoken lagres bare hvis du krysser av for **Stay connected**. Knappen finnes bare med en Microsoft-klient-ID konfigurert av driftsansvarlig. **Delingslenker.** **Create a share link** kaller `graph.microsoft.com` (`createLink` på filen) med tilgangen du allerede har gitt. Hvis Microsoft avslår det, ber ikke Lolly om videre tilgang: Det sender deg til filens egen side i OneDrive for å bruke Share-knappen der. **Stop sharing** sletter lenkens tillatelse.
- <!--i:upload--> **LinkedIn**, **bare i skrivebordsappene**. Filen, med navnet som innleggstekst, sendes til LinkedIn (`www.linkedin.com` for innlogging i din egen nettleser, `api.linkedin.com` for opplastingen og innlegget) som et offentlig innlegg i din egen feed. Lolly kan publisere som deg og lese navnet ditt for kontoetiketten, ingenting annet. Innloggingen beholdes bare hvis du krysser av for **Stay connected**, og LinkedIns tokener varer i 60 dager og kan ikke fornyes automatisk i bakgrunnen, så den utløper av seg selv. Disse vertene er ikke i nettappens tilkoblingspolicy. Knappen finnes bare i versjoner med en LinkedIn-app konfigurert.
- <!--i:upload--> **Penpot.** Det personlige Penpot-tilgangstokenet ditt, som du limer inn i appen, og `.penpot`-arkivet med designet sendes til Penpot-API-et (`design.penpot.app`) gjennom en liten videresendingstjeneste på appens egen adresse (`/api/penpot`), fordi Penpot-API-et ikke svarer en nettleser direkte. Videresendingstjenesten sender videre og glemmer; skrivebordsappene snakker direkte med Penpot. Dette skjer bare når du trykker på **Send to Penpot** i Design-verktøyet og bekrefter et prosjekt. Hvis forespørselen blokkeres, stoppes sendingen; eksporter `.penpot`-filen og importer den selv.
- <!--i:upload--> **Bluesky.** Bildet, navnet som innleggstekst og alternativ tekst og brukernavnet og app-passordet ditt (opprettet under Bluesky → Settings → App passwords, aldri kontopassordet ditt) sendes til Bluesky-serveren du angir, `bsky.social` med mindre du velger en annen. Du kobler først til kontoen i **Settings → Connected services**.
- <!--i:upload--> **Discord.** Filen sendes som et vedlegg til webhookadressen for kanalen du limte inn, på discord.com. Alle som har en webhookadresse, kan publisere i den kanalen, og derfor blir den på enheten.
- <!--i:upload--> **Mastodon.** Filen, med navnet som innleggstekst, sendes til Mastodon-serveren eller den kompatible serveren du angir, etter innlogging i serverens eget vindu. Tilkobling registrerer en liten app for denne enheten på den serveren, og innloggingen beholdes bare hvis du krysser av for **Stay connected**.
- <!--i:upload--> **Nextcloud eller WebDAV.** Filen sendes til din egen server i én autentisert opplasting, med serveradressen, brukernavnet og app-passordet du oppga (Nextcloud → Settings → Security → Devices & sessions; aldri kontopassordet ditt). **Delingslenker.** **Create a share link** gjør ett kall til din egen servers delingstjeneste (`/ocs/v2.php/apps/files_sharing/api/v1/shares`) med det samme app-passordet, for en offentlig skrivebeskyttet lenke med passordet og utløpsdatoen du velger. **Stop sharing** sletter den delingen.
- <!--i:upload--> **S3-kompatibel lagring.** Filen sendes til din egen bøtte (AWS S3, MinIO, R2, B2, Garage eller et hvilket som helst SigV4-endepunkt), signert på enheten med nøkkelparet du oppga. **Delingslenker.** En lenke er en forhåndssignert adresse laget på enheten din fra de lagrede nøklene, så opprettingen sender ingenting. Den varer i høyst sju dager og kan ikke slås av tidligere.

**Verter du velger, trenger driftsansvarliges godkjenning.** Bluesky-, Discord-, Mastodon-, Nextcloud- og S3-vertene er ikke i Lollys faste liste, fordi du velger dem. Appen sender ingenting til en vert før driftsansvarlig har godkjent akkurat den HTTPS-verten: på nettet, i installasjonens Content Security Policy; i skrivebordsappene, når appen bygges. Det samme gjelder egendefinerte lagringsverter og opplastingsverter for SharePoint. På nettet må serveren også tillate nettleserkall fra appen (CORS), og en omdirigering stoppes, så bruk en adresse som ikke omdirigerer. Skrivebordsappene sjekker hver omdirigering mot listen over godkjente verter.

Denne listen begrenser hvilke verter appen kan nå. Den skiller ikke mellom kontoer eller leietakere hos Google eller Microsoft, og leverandørens egne tillatelser avgjør hvilke kontoer og handlinger som er tillatt. Den dekker heller ikke innloggingsvinduer, andre ressurstyper eller plattformfunksjoner, som har egne regler. En endring krever en ny skrivebordsversjon eller nye svarhoder på nettet; lagre arbeidet ditt før du åpner appen på nytt for å ta den i bruk. [Tilkoblingenes opprinnelser](/info/connector-origins.html) beskriver konfigurasjonen.
:::

::: details Sync på tvers av enhetene dine
- <!--i:folder--> **Hva som sendes.** En kopi av det du har laget på denne enheten (lagrede økter og prosjekter, designsystemene dine med skrifter og logoer, opplastede bilder, profilen og innstillingene dine) som én fil, til den ene lagringen du valgte: Lolly-appmappen i Dropbox (`api.dropboxapi.com`, `content.dropboxapi.com`), filer Lolly har opprettet i Google Drive (`www.googleapis.com`), Lolly-appmappen i OneDrive (`graph.microsoft.com`, med større filer lastet opp til `api.onedrive.com` eller lagringsopprinnelser driftsansvarlig har konfigurert, og nedlastinger fra nøyaktige lagringsopprinnelser driftsansvarlig har konfigurert) eller din egen Nextcloud, WebDAV-server eller S3-bøtte. Den samme lagringen beholder opptil sju daglige kopier og én kopi fra før sist du brukte en kopi.
- <!--i:shieldcheck--> **Ingenting sendes til Lolly.** Ingen Lolly-server, videresendingstjeneste eller Lolly Work-server er med i overføringen, og appene trenger ikke noe Lolly-nettsted for dette, ikke engang for å logge inn. Kopien krypteres på enheten først bare hvis du angir en passfrase. Innlogginger, nøkler, app-passord, passfrasen og Sync-innstillingene blir på enheten og er aldri med i kopien. På nettet beholder en husket Google Drive-tilkobling bare en kontoetikett, normalt e-postadressen til Google-kontoen din, tillatelsen den har og når du koblet til (og din egen klient-ID, hvis du oppga en). Ingen tilgangstokener lagres, og Google-innloggingen varer ett besøk. I Android-appen går Google Drive-innloggingen gjennom Google Play services på telefonen, som Google driver.
- <!--i:sliders--> **Når.** Bare etter at du slår på **Sync across my devices** eller trykker på **Sync now**: en opplasting kort tid etter hver endring og når du forlater appen, og en sjekk etter en nyere kopi når appen starter. Hvis forespørselen blokkeres, mislykkes Sync og sier hvorfor, og arbeidet ditt blir på enheten. Du kan i stedet eksportere dataene dine til en fil og flytte dem selv. [Synkroniser enhetene dine](/info/sync.html) dekker funksjonen.
:::

::: details Nettsider, opptak og bilder fra andre nettsteder
- <!--i:monitor--> **En URL du ber et verktøy ta bilde av.** Verktøyet for URL-skjermbilder forespør akkurat adressen du skriver inn, bare når du starter opptaket. Fordi du velger adressen i det øyeblikket, er den ikke i tilkoblingspolicyen, og en driftsansvarlig kan ikke tillate eller blokkere den etter vert; for å fjerne den må verktøyet fjernes.
- <!--i:globe--> **En nettside i en Lolly Design-boks.** Siden forespørres, med IP-adressen din, fra nettstedet den kommer fra, sammen med det siden selv forespør. Der nettleseren støtter det, sendes rammen ingen informasjonskapsler og ingen adresse utover appens egen opprinnelse, så dokumentet ditt og lenken til det følger aldri med forespørselen. I nettappen kan bare disse spillerne vises i rammer: `www.youtube-nocookie.com`, `player.vimeo.com`, `www.loom.com`, `www.google.com` (kart) og `www.figma.com`, pluss referansesider på `wikipedia.org` og `*.wikipedia.org`, `commons.wikimedia.org`, `upload.wikimedia.org`, `www.wikidata.org`, `www.mediawiki.org` og `www.openstreetmap.org`. **Allow pages from any site**, under **Settings → Trusted sites**, laster Lolly på nytt på enheten din med en policy som kan vise enhver `https:`-side i en ramme, og de samme reglene om tillit og forespørsler gjelder fortsatt. En side lastes bare for et nettsted i Trusted sites, inkludert standardreferansene som kan fjernes, eller etter at du godkjenner den boksen i Inspector; en presentasjon noen har sendt deg, viser et bilde av hver side frem til da. Før du presenterer, tilbyr listen **Just this time** og **Always trust** for hvert nettsted, og det stilles ingen spørsmål mens du presenterer. Hvis siden blokkeres, viser boksen bildet sitt med en lenke for å åpne siden i en ny fane. Lolly-verktøy og Lolly Sandbox-demoer i en boks kjører på appens egen adresse og kontakter ingen.
- <!--i:sliders--> **Endre en side du viser.** Handlingen **Use page** i en nettsideboks lar deg avvise informasjonskapsler eller lukke et banner inne på siden. For tilgjengelige Lolly-sider skjuler **Hide cookie banners** kjente overlegg, inkludert OneTrust, uten å godta informasjonskapsler eller endre nettstedets samtykkevalg. **Page CSS** endrer boksens levende side og presentasjon; eksporter bruker fortsatt det valgte plakatbildet. Reglene kan ikke importere ressurser eller skrifter, og nettlesere hindrer Lolly i å endre CSS på andre nettsteder. Lolly Sandbox-forhåndsvisninger har sin egen CSS-editor under **Edit in Sandbox**.
- <!--i:code--> **Nettressursene til en Lolly Sandbox-demo.** Hvert stilark, skript, hver skrift eller hvert bilde som demoens kode lenker til, forespørres, med IP-adressen din og uten informasjonskapsler, fra nettstedet som er vert for det; filer et hentet stilark angir, som skriftfiler fra Google Fonts, regnes som separate nettsteder. Dette skjer bare etter at du klikker på **Fetch & inline**, eller for et nettsted i Trusted sites; **Always trust** ved siden av en fil legger nettstedet til i den listen. Hvis forespørselen blokkeres, kjører demoen uten disse filene, og Lolly Sandbox lister hver fil det ikke kunne hente og hvorfor.
- <!--i:download--> **Legg til et bilde fra en URL.** **Add from URL** i ressursvelgeren eller Assets forespør akkurat bildeadressen du limer inn. Nettappens egen policy hindrer nettleseren i å hente direkte fra et annet nettsted, så en liten videresendingstjeneste på appens egen adresse (`/api/fetch-image`) henter bildet og returnerer bare bytene; den lagrer ingenting, glemmer adressen og avviser alt som ikke er en offentlig bildeadresse. Skrivebordsappene henter adressen direkte. En Lolly-lenke du limer inn, hentes ikke i det hele tatt: Den gjengis på enheten. Hvis driftsansvarlig slår av videresendingstjenesten (`LOLLY_DISABLE_IMAGE_PROXY=1`), kan bare Lolly-lenker, `data:`-bilder og bilder fra samme opprinnelse legges til i nettappen, og skrivebordsappene påvirkes ikke.
- <!--i:palette--> **Et designsystem fra et nettsted.** Lolly Design System Setup kan lese én side fra et nettsted du angir, gjennom [nettleserutvidelsen](#the-browser-extension) eller skrivebordsappens egen henting, aldri gjennom en Lolly-server. Ingenting hentes før du trykker, og lenker på siden følges ikke.
:::

::: details Arbeide med andre personer og agenter
- <!--i:link--> **Et privat samarbeid.** To enheter kobles direkte sammen, uten noen server imellom. Invitasjonen og svaret inneholder adressene hver enhet kan se på sitt eget nettverk, og denne versjonen konfigurerer ingen ekstern server for adresseoppdagelse, så gi dem bare til personen du arbeider med. Se [Samarbeid](/info/collaborate.html).
- <!--i:monitor--> **Nearby**, i skrivebordsappen. Mens du er synlig, som er i ti minutter når du starter en samarbeidsinvitasjon eller, hvis du slår det på, når appen kjører, kunngjør appen et tilfeldig navn, visningsnavnet du valgte og typen enhet på det lokale nettverket. Den kunngjør ingen e-postadresse, konto eller varig identifikator.
- <!--i:link--> **Invite an agent.** Tilstanden til dokumentet invitasjonen gjelder, forhåndsvisningene agenten ber om, agentens identitet og redigeringene dens går gjennom den konfigurerte videresendingstjenesten for direkte samarbeid (`lolly.ing` på lolly.tools) til agenten du inviterer. En installert vertsbasert plugin videresender også kall gjennom lolly.tools-tilkoblingen til videresendingstjenesten invitasjonen velger; tilkoblingen beholder ingen invitasjon eller dokument mellom kall. Videresendingstjenesten holder invitasjoner og ventende forespørsler i minnet til du kobler fra eller de utløper: ti minutter for en ubrukt invitasjon og tretti minutter uten aktivitet for en der agenten har koblet til. Agentleverandøren din håndterer dataene den mottar, under sin egen policy. Dette skjer bare etter at du oppretter en invitasjon i Share og gir instruksjonene til agenten din; lesetilgang tillater undersøkelse, og redigeringstilgang tillater også endringer. Pause stopper endringer, og Disconnect eller tilbakekalling av invitasjonen avslutter tilgangen. Hvis forbindelsen blokkeres, kan agenten ikke koble til eller fortsette, og du fortsetter å redigere.
- <!--i:cpu--> **Allow AI control**, i skrivebordsappen. En agent som kjører på denne datamaskinen, kan lese og redigere det åpne Lolly Design-dokumentet gjennom en tilkobling som blir på datamaskinen. Den er av til du slår den på. Lolly sender ingenting til en server for dette; agentens leverandør håndterer det agenten leser, under sin egen policy. [Trusselmodell & tillitsgrenser](/info/threat-model.html) lister hva en slik agent kan og ikke kan gjøre.
- <!--i:cpu--> **Ask an agent**, i skrivebordsappen. Å åpne **Ask an agent** i Lolly Design får appen til å lete på denne datamaskinen etter fire kommandolinjeverktøy for agenter (Claude Code, Codex, Gemini CLI og GitHub Copilot CLI), sju apper (Claude, ChatGPT, Codex, Cursor, Visual Studio Code, LM Studio og Ollama) og Ollama- og LM Studio-serverne på `127.0.0.1`. Den kjører versjons- og hjelpekommandoene til hvert verktøy (og Codex sin funksjonsliste), leser appnavn og versjoner fra app-pakkene og spør de to lokale serverne hvilke modeller de har. Den leser ingen innloggings- eller påloggingsopplysningsfiler, resultatet blir i appens minne og ingenting om det sendes noe sted. Når du spør en agent, sendes forespørselen din og det åpne dokumentet, med opplastede bilder utelatt, til agentens leverandør (Anthropic for Claude Code, OpenAI for Codex) under kontoen verktøyet er logget inn med, og abonnementet ditt hos den leverandøren betaler. Ingen Lolly-server er med i overføringen. Før den første forespørselen til hver agent viser panelet dette og spør én gang, og svaret ditt beholdes i `localStorage` på denne enheten. Agenten kjører uten verktøy, i en tom midlertidig mappe, med bare miljøvariablene den trenger for å finne sin egen innlogging, så API-nøkler satt i miljøet blir igjen. På en administrert instans kan organisasjonens policy slå dette av, og da verken leter appen etter agenter eller starter en.
- <!--i:server--> **En ekstern instans.** Når du peker appen mot en annen Lolly-installasjon, mottar den det instansen sender tilbake, gjennom den samme katalogsynkroniseringen, pluss en versjonsetikett på forespørsler til den (apptypen og motorversjonen, samme informasjon som en brukeragent inneholder), slik at driftsansvarlig kan se hvilke Lolly-versjoner som er i bruk. På en administrert instans inneholder etiketten også en installasjons-ID for denne enheten mens du er logget inn, slik at driftsansvarliges enhetsliste kan skille installasjonene fra hverandre; når du forlater instansen, slettes ID-en, og en enhet som kobler til igjen senere, presenterer en ny. Du velger verten, så den er ikke i tilkoblingspolicyen. Hvis forespørselen blokkeres, mislykkes byttet, og den lokale instansen din påvirkes ikke.
- <!--i:people--> **Organisasjonens Lolly Work-instans.** Innloggingsidentitet og enhetsinformasjon, policyforespørsler, delte økter, samarbeidsredigeringer, opplastinger, innsendinger til godkjenning, merkevaresider du publiserer og leveringsfiler du bruker, sendes til organisasjonens instans, med innlogging gjennom identitetsleverandøren. Policyoppdateringer kan kjøre under bruk; delt arbeid, samarbeid, gjennomgang og levering sender innhold som en del av disse arbeidsflytene. Lollys egne apper sender ingen brukshendelser til instansen. Hvis forespørselen blokkeres, kan ikke disse organisasjonsfunksjonene fullføres, og det personlige arbeidet ditt forblir separat. Se [Organisasjonstjenester med Lolly Work](#organisation-services-with-lolly-work).
:::

### Alle faste verter i én tabell

Nettappens Content Security Policy hindrer et skript i å nå verter som ikke står i den. I tillegg til appens egen adresse oppgir tabellen alle vertene policyen lister, pluss de to LinkedIn-vertene skrivebordsappene legger til, merket som bare for skrivebordsapper. En CI-test sjekker denne tabellen mot den aktive policyen, slik at en vert ikke kan legges til i den ene uten den andre.

| Hva | Hva som faktisk forlater enheten din | Verter |
|---|---|---|
| Modeller for lokal bruk i de pakkede appene og utgivelsesfiler | En forespørsel om en offentlig fil, med IP-adressen din | `lolli.li` |
| Google Fonts | Navnet på skriftfamilien og IP-adressen din | `fonts.googleapis.com`, `fonts.gstatic.com` |
| Sending til og Sync med Google Drive | Filen eller sikkerhetskopien du valgte og delingstillatelsen når du ber om en delingslenke | `www.googleapis.com` |
| Sending til og Sync med Dropbox | Filen eller sikkerhetskopien du valgte og lenkeinnstillingene når du ber om en delingslenke | `api.dropboxapi.com`, `content.dropboxapi.com` |
| Sending til og Sync med OneDrive | Filen eller sikkerhetskopien du valgte, visningsnavnet ditt for kontoetiketten og lenkeforespørselen når du ber om en delingslenke | `login.microsoftonline.com`, `graph.microsoft.com`, `api.onedrive.com` |
| Meeting Planners byoppslag | Hvert bynavn | `geocoding-api.open-meteo.com` |
| ICC-trykkprofiler | En forespørsel om en offentlig profil | `registry.color.org`, `www.color.org` |
| Nettradio | En spillelisteforespørsel og en lydstrøm | `api.somafm.com`, `*.somafm.com` |
| Invite an agent og lolly.ing-arbeidsområdet | Tilstanden, forhåndsvisningene og redigeringene til dokumentet invitasjonen gjelder og arbeidsområdeforespørslene du gjør | `lolly.ing` |
| Spillere i en Lolly Design-nettboks | En forespørsel om siden, med IP-adressen din | `www.youtube-nocookie.com`, `player.vimeo.com`, `www.loom.com`, `www.google.com`, `www.figma.com` |
| Referansesider i en Lolly Design-nettboks | En forespørsel om siden, med IP-adressen din | `wikipedia.org`, `*.wikipedia.org`, `commons.wikimedia.org`, `upload.wikimedia.org`, `www.wikidata.org`, `www.mediawiki.org`, `www.openstreetmap.org` |
| Sending til LinkedIn, bare i skrivebordsappene | Filen, med navnet som et offentlig innlegg | `www.linkedin.com`, `api.linkedin.com` |

Skrivebordsappenes egen liste inkluderer også Googles tokenendepunkt for Drive-innloggingen. Alle andre verter, som en Mastodon- eller Nextcloud-server du angir, trenger driftsansvarliges godkjenning, som beskrevet under Filer du sender. Verter du velger ved bruk, som en URL du tar bilde av eller en ekstern instans du angir, står ikke i noen liste.


**SEAL-signaturer gjør ingen forespørsel.** Lolly Verify kan sjekke SEAL-signaturer, en ordning der signeringsnøkkelen kan publiseres i DNS. Nettlesere kan ikke gjøre DNS-spørringer, så et nettoppslag måtte ha gått gjennom en tredjeparts DNS-over-HTTPS-resolver, som ville sett domenet som sjekkes og IP-adressen din. Lolly brukte tidligere Cloudflares resolver; det gjør det ikke lenger, og ingenting har erstattet Cloudflare. Ingen Lolly-app slår opp SEAL-nøkler i dag: Skrivebords- og mobilappene kjører den samme Verify-visningen, og kommandolinjens `lolly validate` sjekker ikke SEAL. En fil der SEAL-posten inneholder nøkkelen, sjekkes uten nett, og Lolly Verify kaller signaturen internt konsistent uten å bekrefte domenet. En fil der nøkkelen bare ligger i DNS, viser **SEAL signature did not verify**, med årsaken "ingen nøkkelresolver og ingen innebygd nøkkel".

![Lolly Verify-skjermen: et slippområde og ingenting annet - filen sjekkes der den allerede er, uten opplasting og uten konto](/t/url-shot?url=%2F%23%2Fverify&width=1440&height=900&dpi=192&waitMs=1400&walker=1&format=svg&cropSelector=.valid-layout&dark=1&filename=cc-verify-drop)

Du kan sjekke dette og alle andre påstander på denne siden selv: [Bekreft det selv](/info/verify-yourself.html) gir kommandoene og resultatet du kan forvente.

<!--i:eti-cpu-->
## Tjenester lolly.tools driver

Disse kjører på lolly.tools for alle. Hver mottar bare det du sender. [Serverflate](/info/server-surface.html) beskriver de samme komponentene slik de fungerer i enhver installasjon.

### Gjengivelseslenker

Hver `https://lolly.tools/tool/<tool-id>.<ext>?<inputs>`-URL gjør en faktisk gjengivelse, og inndataene sendes i URL-en, så en delt Lolly-lenke kan vises som et levende bilde i en README, en wiki eller et dashbord. Å hente en slik lenke ber serveren gjengi **offentlige verktøy- og katalogdata** med inndataene som er skrevet inn i adressen.

- <!--i:usercheck--> **Ingen kontoer, ingen informasjonskapsler, ingen tilstand.** Ruten ber ikke om innlogging, og ingenting på enheten din leses. Dokumentene, øktene og opplastingene dine forlater aldri nettleseren og kan ikke vises i disse lenkene.
- <!--i:document--> **Selve URL-en registreres.** Spørringsstrengen i en URL er en del av forespørselen, så den vises i hostingplattformens vanlige tilgangslogger som enhver forespurt sti. Hvis inndataene i en lenke inneholder noens navn eller e-postadresse, slik et navneskilt eller en e-postsignatur kan gjøre, **ligger den teksten i disse loggene**. Gi en gjengivelseslenke bare det du ville lagt på en offentlig side.
- <!--i:globe--> **Inndataene er offentlige uansett.** De er det lenkens forfatter skrev inn i URL-en, lesbart for alle lenken når. For sensitivt innhold tilbyr Lolly lenkekryptering.
- <!--i:eyeoff--> **Hurtigbufret, begrenset og ikke indeksert.** Svar hurtigbufres og frekvensbegrenses som ethvert offentlig bilde, og merkes med `noindex` slik at søkemotorer utelater gjengivelsene dine.

En egenhostet installasjon som ikke vil ha noen offentlig gjengivelsesrute, setter `LOLLY_DISABLE_RENDER_GET=1`, og hver eneste av disse URL-ene returnerer 404.

### Bildehenteren og Penpot-videresendingstjenesten

**Add from URL** i nettappen og **Send to Penpot** bruker to små videresendingstjenester på lolly.tools, beskrevet under [Alle nettverksforespørsler appen kan gjøre](#every-network-request-the-app-can-make). Bildehenteren beholder ingenting og glemmer adressen. Penpot-videresendingstjenesten sender tokenet og arkivet ditt videre til Penpot og beholder ingen av dem; den logger kommandonavnet og Penpots svarstatus.

### MCP-serveren, for AI-agenter

En AI-agent kan nå Lolly over Model Context Protocol, gjennom et endepunkt en driftsansvarlig kjører. lolly.tools kjører ett, og alle kan kjøre sitt eget, også helt uten nett.

- <!--i:cpu--> **Filer en agent sender.** Verktøyene som tar imot en fil (`lolly_transform`, `lolly_verify`, `lolly_redact`, `lolly_read`, `lolly_check`, `lolly_package`, `lolly_compose`, `lolly_rebrand` og bildeverktøyene `lolly_look`, `lolly_sample_color` og `lolly_trace_edges`), behandler den i minnet og returnerer resultatet i samme kall. Filen skrives aldri til disk og beholdes ikke når forespørselen er fullført. `lolly_inspect` tar også imot en fil, og video- og trykkproduksjonssjekkene skriver en midlertidig arbeidskopi som slettes når kallet returnerer. Alle andre verktøy arbeider ut fra parameterne i kallet: tekst, tall, farger, URL-er, ID-er for katalogressurser eller et dokument klienten oppgir.
- <!--i:cpu--> **Lolly Rebrand oppgir hvor en presentasjon sendes.** Det første trinnet i `lolly_rebrand`, `capabilities`, sier med ord hvor bytene dine ville blitt sendt før du sender noen: På en egenhostet lokal server forlater presentasjonen aldri den maskinen, og på en vertsbasert server sender et kall til `lolly_rebrand` presentasjonen dit, opp til størrelses- og lysbildegrensene trinnet oppgir.
- <!--i:lock--> **Det åpne endepunktet.** På lolly.tools er `lolly.tools/api/mcp` åpent for alle uten token. Kall begrenses per adresse og av en daglig kvote. Adressen blir til en pseudonymisert hashverdi i misbruksvernlageret, som ved innloggingsendepunktene nedenfor, og kvoten teller bare CPU-tid og sendte byte, uten adresse. Bearer-tokenet til et begrenset endepunkt skrives aldri til en logg eller en gjengivelses-URL.
- <!--i:link--> **Nedlastingslenker for store resultater.** lolly.tools returnerer resultater direkte i svaret og utsteder aldri disse lenkene. En driftsansvarlig kan slå dem på for sin egen autentiserte gateway, der et resultat beholdes i høyst fem minutter og bare klientens eget bearer-token kan hente det; se [MCP-server](/info/mcp.html#private-download-links-for-large-results). Et planlagt begrenset endepunkt på `mcp.lolly.tools` ville tatt imot et bearer-token driftsansvarlig utsteder til betrodde klienter, eller OAuth 2.1 med kortvarige signerte tokener som sjekkes mot en delt hemmelighet; aktivering gjenstår, og det er listet under [Leveringsverter og databehandlere](#delivery-hosts-and-processors).

### Bekreftet identitet: en innlogging du starter selv

Lolly kan forsegle en **Content Credential** i eksportene dine, slik at alle kan sjekke uten nett at en fil er uendret siden den forlot Lolly. Dette er **på som standard og helt lokalt**: Signeringsnøkkelen lages på enheten din, og signeringen skjer uten nett. Uten registrering er nøkkelen til engangsbruk, et nytt nøkkelpar laget for hver eksport og forkastet etterpå. Når du registrerer deg, varer nøkkelen og genereres som **ikke-ekstraherbar**, slik at ikke engang Lollys egen kode kan lese den, bare be den om å signere. Uansett forlater den aldri enheten din.

[Eksport](/info/exporting.html#content-credentials-c2pa) lister hva en attest registrerer: verktøyet, tidspunktet, den overordnede eksportflaten, navnet ditt bare når du har slått på *Use my details*, de krediterte verkene en eksport plasserer, hver Lolly Rondocode-sang en video- eller lydeksport spiller (navnet, en hash av kilden og hvordan Lollys sandkasse gjenga sangen) og hver lagrede melodi en slik eksport spiller (navnet, en hash av oppskriften, motorversjonen og lisensen når melodien registrerer en). Skaperen til en lagret melodi, navnet melodien ble lagret med, legges bare til når *Use my details* er på, så med den bryteren av forlater ikke noe navn enheten din på denne måten heller. Eksportpanelet lister disse sangene og melodiene før du eksporterer, og viser bare skaperen til en melodi når navnet vil bli skrevet.

Attesten og filens metadata registrerer også [designsystemet og fargevarianten](/info/exporting.html#the-design-system-record) som tegnet eksporten: designsystemets ID og navn, den publiserte versjonen og fargevarianten. Navnet på et designsystem er tekst eierne har skrevet og kan være navnet til en kunde, så kortet **Design system** i eksportpanelet viser de nøyaktige ordene før du eksporterer. Fjern avkrysningen på kortet, eller send med `_madewith=0` eller `--no-madewith`, for å utelate dem.

Utgiveren av et designsystem kan også velge å registrere adressen til [merkevaresiden](/info/brand-page.html#lead-back-from-your-files) i den samme posten. Adressen er det eneste tillegget. Innstillingen er av til utgiveren slår den på og følger ikke med en pakke eller en kopi, og det samme kortet viser adressen og lar deg utelate den. Å lese en fil tilbake laster aldri den adressen: Lolly Verify viser verten, og du velger om du vil åpne siden.

En fil godkjent gjennom en organisasjons Lolly Work kan også inneholde en signert godkjenningspost: godkjennings-ID-en, datoen for avgjørelsen og hashverdien til filen som ble gjennomgått, uten navn, e-postadresser, grupper, kommentarer eller kjedenavn. Personen som ber om gjennomgangen, ser dette som en avkrysset boks og kan fjerne avkrysningen, og en organisasjon kan slå av registreringen.

En fil laget ut fra en [intensjon](/info/visual-intent.html#what-goes-in-the-file) registrerer også hva den ble bedt om å gjøre: formålet, flaten, verktøyet, språket og en hashverdi av forespørselen. Anledning, målgruppe, region og eventuell instruks registreres bare som fingeravtrykk. Ordlyden i en instruks tas bare med når personen eller agenten som kjører gjengivelsen, ber om det, og kjøringen sier fra om dette, fordi alle som mottar filen, kan lese den. Posten kan utelates, og ingen annen eksport inneholder en slik post.

Det ene *valgfrie* trinnet i tillegg er å registrere en bekreftet identitet, slik at eksportene dine sier "Bekreftet - signert av \<your email\>" i stedet for å navngi en anonym nøkkel. **Hvis du hopper over registreringen, mottar sertifikattjenesten ingen registreringsdata fra deg.**

![Kortet Verified identity i Settings, i telefonbredde: velgeren for sertifikatets levetid og registreringstrinnet under, inaktivt til du starter det selv](/t/url-shot?url=%2F%23%2Fsettings%3Ffocus%3Didentity-section&width=430&height=1600&dpi=192&waitMs=2400&css=.welcome-dialog%2C.personalize-nudge%7Bdisplay%3Anone%7D&format=svg&walker=1&cropSelector=%23identity-section&dark=1&filename=pv-identity-enrol)

Hvis du registrerer deg, skjer nøyaktig dette:

::: timeline
- <!--i:usercheck--> **Du velger en innloggingsmetode**: GitHub, Google, SUSE (id.suse.com) eller en lenke på e-post. For de tre OIDC-leverandørene går du til leverandørens egen innloggingsside, under deres personvernerklæring, ikke vår, og sertifikattjenesten mottar bare en bekreftet e-postadresse og leverandørens navn tilbake. For e-postlenken sendes adressen du skriver inn, til **Resend**, en tjeneste for transaksjonsbasert e-post, bare for å levere den ene lenken.
- <!--i:lock--> **En kortvarig informasjonskapsel beskytter omdirigeringen.** Sertifikattjenesten setter `lolly_ca_state`, `HttpOnly`, avgrenset til `/api/ca` og med utløp innen ti minutter. Den inneholder en tilfeldig verdi i stedet for en sporingsidentifikator, finnes bare for å hindre at innloggingsomdirigeringen forfalskes og slettes så snart innloggingen er fullført.
- <!--i:eyeoff--> **IP-adressen din brukes kortvarig for å hindre misbruk** av innloggingsendepunktene, slik at ett skript ikke kan overfylle en innboks eller bruke opp e-postkvoten. Lolly gjør den om til en SHA-256-hashverdi før den når det kortvarige misbruksvernlageret, så råadressen sendes ikke dit. Hashverdien er pseudonymisert, ikke anonym: Noen med tilgang til lageret kunne gjenfinne en IPv4-adresse ved å prøve alle mulige adresser. Bøtten utløper etter omtrent ett minutt og brukes ikke til noe annet. Vanlige tilgangslogger for hosting er separate og beskrives nedenfor.
- <!--i:seal--> **Tjenesten utsteder et sertifikat** som knytter den bekreftede e-postadressen din til enhetens offentlige nøkkel. Den private nøkkelen blir på enheten: Klienten sender en sertifikatforespørsel med et bundet bevis på besittelse, og ingen privat enhetsnøkkel sendes til noen av utstedermodusene.
- <!--i:check--> **Signering forblir lokal.** Med den eldre utstederen trenger en eksport ingen forespørsel til sertifikattjenesten. En administrert identitet trenger også en fersk, signert tilbakekallingsliste fra utstederen; klienten kan bruke en hurtigbufret liste innenfor det konfigurerte gyldighetsvinduet, og oppdatering av den kan kontakte sertifikattjenesten under en eksport. Manglende, utløpt eller ugyldig status hindrer bruk av den administrerte identiteten.
:::

::: details Lagringstid og tilbakekalling i hver utstedermodus
**Eldre vertsbasert utstedelse** tilbyr 7, 30, 90 eller 365 dager, begrenset av driftsansvarlig. Den beholder ingen identitetsoversikt og ingen utstedelseslogg, så den kan ikke slå opp hvem som fikk et sertifikat eller tilbakekalle vedkommendes sertifikater; levetiden fungerer som tilbakekalling.

**Administrert organisasjonsutstedelse** bruker en standardlevetid på høyst 24 timer og maksimalt sju dager, med sin egen tillitspolicy for rot og utsteder, og signeringen går til Vault-utstederen driftsansvarlig har konfigurert. Registreringsappen bruker et delt lager for engangstillatelser som bare inneholder en nøkkelbasert autentiseringsidentifikator og en hashverdi av forespørselen, i høyst ti minutter, og lagrer ingen identitetsoversikt eller hurtigbuffer for sertifikatsvar. PKI-leverandøren, revisjonsenhetene, gatewayene og sikkerhetskopiene har egne dataflyter. Selv med vanlig utstedelseslagring slått av kan sertifikatbasert tilbakekalling beholde sertifikatet, inkludert e-postidentiteten, og tilbakekallingsserienumre og revisjonsidentifikatorer kan fortsatt være koblingsbare; driftsansvarliges policy avgjør denne oversikten, hvem som kan få tilgang til den og hvor lenge den beholdes.

En administrert enhet kan be om å tilbakekalle sitt eget sertifikat, med et autentisert bevis fra enheten, og ingen API-er ber om enhetens private nøkkel. Driftsansvarlig kan trekke tilbake en utsteder gjennom tillitspolicyen. Lolly beholder ingen kobling mellom personer og sertifikater, så tilbakekalling av en persons sertifikater når vedkommende slutter, avhenger av opplysninger driftsansvarlig beholder, og PKI-opplysninger, revisjonsopplysninger, mottakere og sikkerhetskopier følger driftsansvarliges policy. [Sertifikattjenestens utforming](https://github.com/lolly-tools/lolly/blob/main/services/ca/README.md) dekker utstederforvaltning, leverandørens lagringstid og kvalifisering.
:::

<!--i:eti-building-->
## Organisasjonstjenester med Lolly Work

**Lolly Work** er Lolly-prosjektets valgfrie organisasjonstjeneste, som installeres separat av hver organisasjon som kjører en instans. Å koble til en instans legger til data som lagres på den serveren, ved siden av den lokale redigeringen din. Driftsansvarlig har ansvar for installasjonens personvernerklæring, tilgangskontroller, mottakere, lagringstid og sikkerhetskopier.

Når et arbeidsområde er tilkoblet, sier personvernlinjen på appens første skjerm fra om det: Arbeidsområdet beholder det du lagrer i prosjektene eller deler gjennom det, og en logg over innloggingene dine og det du gjør der.

| Arbeidsflyt | Data som håndteres av organisasjonens tjeneste |
|---|---|
| Innlogging og klargjøring | Identitetsleverandørens påstander, konto- og gruppemedlemskap, innloggingsøkter og enhetsinformasjon. OIDC håndterer innlogging; administratorer kan klargjøre og deaktivere kontoer gjennom SCIM |
| Delt katalog og prosjekter | Opplastede ressurser, metadata og versjoner; delte prosjekter og økter; merkevaresider du publiserer; innhold hentet fra konfigurerte biblioteksleverandører |
| Lolly Work-samarbeid | Delt økttilstand, redigeringer i sanntid og deltakertilstedeværelse sendt gjennom instansen; lagret tilstand beholdes under lagringspolicyen |
| Administrerte delingslenker | Lenkemål og tilgangsinnstillinger, som utløp og valgfri passordbeskyttelse; forespørsler behandles gjennom instansen og kan tilbakekalles |
| Gjennomgang og levering | Innsendt innhold, godkjenningsavgjørelser, valgt destinasjon, klargjorte filer og leveringskvitteringer |
| Servergjengivelser og batcher | Innsendte verktøyinndata, gjengivelsesforespørsler, status og beholdte resultatfiler. Disse jobbene kjører på serveren i stedet for på enheten din |
| Bruksrapportering | Tillatte hendelsesetiketter som verktøy-ID, format og ressurs-ID fra en klient som sender dem, i henhold til telemetripolicyen nedenfor |
| Revisjon | Aktør- og handlingsopplysninger for styrte operasjoner, lagret separat fra brukstelemetri |

Tjenesten bruker informasjonskapsler for autentisering, inkludert `lw_session` for innloggede medlemmer og `lw_guest` for gjestetilgang der det er aktivert, separat fra sertifikattjenestens informasjonskapsel. Policyoppdateringer kan gjøre forespørsler mens appen er i bruk, uten et eget klikk for hver. Dette er trafikk til den konfigurerte instansen, ikke en rapport til Lolly-prosjektet om installasjoner det ikke driver.

**Utgivelsessjekk.** En Lolly Work-server sjekker den publiserte chart-indeksen på GitHub én gang om dagen etter en nyere utgivelse, med den samme enkle forespørselen som enhver `helm repo update` gjør, uten noe om instansen eller personene der. Den er på som standard, og instansens administrator kan slå den av eller peke den mot et speil ([`updates`](/info/work-configuration.html#updates)).

**Brukstelemetri har tre nivåer.** Lollys egne apper sender ingen brukshendelser i dag, så disse nivåene gjelder hendelser fra en annen klient driftsansvarlig kobler til. `off` lagrer ingen brukshendelser, `aggregate` fjerner bruker-ID-er og `standard` kan knytte hendelser til brukere. Standardnivået er `standard`, så en instans lagrer brukshendelsene den mottar, med mindre driftsansvarlig velger `off`. Standardpolicyen for brukertilknytning er `opt-in`, som krever samtykket ditt før en bruker-ID lagres; en driftsansvarlig kan i stedet konfigurere brukertilknyttet rapportering med `telemetryAttribution: default`. Tillatte attributter er etiketter, aldri verdier fra verktøyinndata. Se [Lolly Work-telemetri](/info/work-telemetry.html).

**Revisjon er separat.** Styrte handlinger kan beholde en identifisert revisjonspost uavhengig av telemetrisamtykket ditt. Å slå av telemetri slår ikke av lagring av delte økter, godkjenningsposter, lagring av gjengivelsesjobber eller revisjon. Driftsansvarlig styrer lagringstid og sletting, inkludert eventuell pseudonymisering av revisjonsloggen; se [Lolly Work-lagring og datalivssyklus](/info/work-data-lifecycle.html).

| | Enheten din | Organisasjonens instans |
|---|---|---|
| Hva den lagrer | Ditt personlige arbeid, innstillinger og hurtigbuffere | Delt arbeid, kontoer, opplastinger, godkjenninger, gjengivelser, revisjon og konfigurert telemetri |
| Hvem som sletter det | Du, med **Clear all my data** eller nettleserens nettstedsdata | Driftsansvarlig, gjennom instansens egne kontroller |
| Hvem du kan spørre | Ingen: Opplysningene er på enheten din | Instansens driftsansvarlige, for innsyn, eksport eller sletting |

::: warning Lokal sletting er ikke sletting på serveren
Å forlate en instans eller tømme nettleseren fjerner lokal tilstand, ikke organisasjonens lagrede opplysninger eller sikkerhetskopier. Personlig [Sync](/info/sync.html) og **Export my data** sikkerhetskopierer enheten din, ikke organisasjonens tjeneste. Den offentlige [lolly.work](https://lolly.work)-demoen beholder tilstanden bare i minnet og er ikke varig lagring for arbeidet ditt.
:::

<!--i:eti-camera-->
## Nettleserutvidelsen

Nettleserutvidelsen **Lolly URL Screenshot** samler ikke inn personopplysninger for oss. Den har ingen analyse, ingen sporing og ingen egen server. Siden [Nettleserutvidelse](/info/extension.html) beskriver hvordan den fungerer.

**Hva den gjør.** Lolly-nettappen kan be den om et skjermbilde av en nettside, eller om innholdet på en side for å starte et designsystem fra et nettsted. Hver forespørsel åpner et godkjenningsvindu i utvidelsen som viser nettstedet som spør, om det ønsker et skjermbilde eller sideinnholdet og sidens adresse. Først etter at du trykker på **Approve once**, åpner utvidelsen den siden i en midlertidig bakgrunnsfane, tar skjermbildet eller leser siden, gir resultatet til Lolly-fanen som spurte og lukker fanen. For et SVG-skjermbilde leser den også sidens layout, bilder og skriftfiler i den fanen, og appen gjør dem om til former på enheten din. Hver forespørsel trenger sin egen godkjenning.

**Data.**

- <!--i:shieldcheck--> **Vi samler ikke inn noe.** Resultatet sendes bare til Lolly-siden som spurte, i samme nettleser. Utvidelsen lagrer ikke sideinnhold og legger ikke til noen annen mottaker.
- <!--i:globe--> **Nettverksforespørsler.** Siden du godkjenner, lastes som den ville gjort i enhver fane, sammen med det siden selv forespør. Lesing av sideinnhold henter også sidens stilark og noen av ikon- og logobildene fra innsiden av siden, og disse hentingene sender ingen informasjonskapsler til andre nettsteder. Et SVG-skjermbilde ber siden på nytt om skriftfilene siden lastet, som nettleseren vanligvis leverer fra hurtigbufferen. Utvidelsen gjør ingen andre forespørsler, og ingen går til en Lolly-server.
- <!--i:lock--> **Nettleserøkten din.** Siden lastes med nettleserøkten din, som om du hadde åpnet den selv, så en side du er logget inn på, kan legge private opplysninger i resultatet.
- <!--i:link--> **Adressene du godkjenner**, brukes bare til å laste den ene siden for den ene forespørselen. De logges eller deles ikke.

**Tillatelser.**

- <!--i:wrench--> **`debugger`**: for å ta skjermbildet gjennom DevTools Protocol, den samme mekanismen Lolly-skrivebordsappen bruker, og for å kjøre sidegjennomgangen i den midlertidige fanen for en SVG.
- <!--i:monitor--> **`tabs`**: for å åpne og lukke den midlertidige fanen og for å sjekke at verken Lolly-siden eller målsiden har flyttet seg siden du godkjente.
- <!--i:code--> **`scripting`**: for å lese innholdet på en side i den midlertidige fanen, etter at du har godkjent forespørselen.
- <!--i:database--> **`storage`**: for å notere ID-ene til de midlertidige fanene i øktlagringen, slik at de fortsatt lukkes hvis nettleseren stopper utvidelsen under en forespørsel. Ingen sideinnhold lagres.
- <!--i:check--> **Valgfri nettstedstilgang (`http://*/*`, `https://*/*`)**: gis ikke ved installasjon. Når du trykker på **Approve once**, ber utvidelsen Chrome om tilgang til det ene nettstedet i forespørselen, og Chrome spør deg første gang for hvert nettsted. Et nettsted du har tillatt før, trenger fortsatt en ny godkjenning for hver forespørsel.

Ingen av disse brukes til å lese, overvåke eller overføre nettlesingen din utover den ene forespørselen du godkjente.

<!--i:eti-map-pin-->
## Leveringsverter og databehandlere

Offentlige katalogfiler, verktøy og visningsgjengivelser kommer som standard fra appens egen adresse. Innholdsadresserte navn endrer hvor en fil hentes, ikke hvem som mottar forespørselen. Ingen tredjeparts CDN aktiveres av denne leveringsfunksjonen. Et CDN som terminerer TLS, ville mottatt forespørselsdetaljer, inkludert IP-adresser og eventuelle informasjonskapsler eller bearer-legitimasjon som videresendes til det, selv under det samme vertsnavnet i nettleseren, så en driftsansvarlig som legger til et slikt CDN, tar i bruk en ny databehandler.

**Før et CDN eller en ekstern modellvert legges til**, må administratoren publisere databehandlerens navn, vertsnavn, jurisdiksjoner, mottatte metadata, lagringstid og overføringsordninger. [Installasjon for levering](/info/deploy-delivery.html) lister hva som må opplyses. Private arbeidsområdesvar går utenom delte hurtigbuffere: Personlige resultater, tilgangsavslag og feil bruker `private, no-store`, og et tillatt privat svar kan valideres på nytt i nettleseren din uten å bli offentlig.

Referansetjenestene bruker hostingen nedenfor. Dette er en liste over vertsnavn, ikke en påstand om at en annen organisasjons instans bruker samme region.

| Vertsnavn eller tjeneste | Funksjon og mottaker | Region og datahåndtering |
|---|---|---|
| lolly.tools | Offentlig app, katalog, gjengivelses- og sertifikattjenester; UpCloud-hosting | Frankfurt, Tyskland. Forespørselsdetaljer kan vises i infrastrukturlogger; vanlig lokal redigering blir på enheten |
| lolly.ing | Administrert arbeidsområde og dokumentagenttjenester; UpCloud-hosting | Frankfurt, Tyskland. Den private databasen og fillagringen er på samme vert. Kontoer, delt innhold og tjenesteopplysninger følger instansadministratorens policy |
| mcp.lolly.tools | Planlagt valgfri autentisert MCP-gateway og private resultatnedlastinger; UpCloud-hosting | Frankfurt, Tyskland, med samme hostingdatabehandler. Aktivering gjenstår. Gatewayen ville mottatt forespørselsdetaljer og parameterne eller filene klienten sender |
| lolli.li | Offentlige utgivelses- og modellfiler; UpCloud Managed Object Storage, separat fra applikasjonsklyngen | Frankfurt, Tyskland, i UpClouds objektlagringsregion europe-2. En nedlasting sender forespørselsdetaljer, ikke inndataene modellen senere behandler |
| Konfigurert identitetsleverandør | Google, GitHub eller driftsansvarliges OIDC-leverandør | Innlogging følger leverandørens policy. Spør instansens driftsansvarlige om vertsnavn, region og overføringsordninger |
| Konfigurert ressursleverandør | Brandfolder eller et annet bibliotek driftsansvarlig velger | Leverandøren mottar tillatte biblioteksforespørsler. Kildetillatelsene og instansens policy styrer tilgangen; spør driftsansvarlig om vertsnavn og regioner |
| E-postregistrering, når konfigurert | Resend leverer den forespurte innloggingslenken | Mottar mottakerens e-postadresse for den meldingen; egne behandlingsvilkår gjelder |

Referanseappen bruker ingen annen leverandør for hosting, database eller misbruksvern. En driftsansvarlig kan velge andre leverandører for en annen instans, og hosting-, identitets-, ressurs- og e-postleverandører trenger hver sine opplysninger om behandlingen. Modellvertens [objektlagringsregion](https://upcloud.com/docs/products/managed-object-storage/availability/) bekreftes separat fra appens region.

**Valgfrie MCP-nedlastingslenker bundet til identiteten.** En driftsansvarlig kan slå på nedlastingslenker for store resultater på en autentisert gateway med én replika. De er av som standard. Den anonyme gatewayen på `lolly.tools/api/mcp` returnerer resultater direkte i svaret og utsteder aldri disse lenkene. Det planlagte begrensede vertsnavnet er `mcp.lolly.tools`, hos den samme UpCloud-databehandleren i Frankfurt; aktivering gjenstår, og denne siden hevder ikke at en nedlastingslenketjeneste er i drift. Lenkene legger ikke til noe tredjeparts CDN.

::: details Slik lagres driftsansvarliges MCP-nedlastingslenker
Bare en autentisert klient med filtilgangsomfang kan motta en lenke, og den samme klientens bearer-token kreves for å hente den: Bruk det validerte bearer-tokenet fra gjengivelseskallet, ikke et annet token for samme konto. Tilgangstillatelsen utløper innen 300 sekunder. Eierskap og resultatoppslag blir i gatewayens minne, og resultatbytene går til private midlertidige filer, som ryddes bort etter utløp eller fjernes ved en normal avslutning. En omstart av gatewayen ugyldiggjør eksisterende lenker. Beholdte resultater er begrenset til 64 MiB per bearer-token, 256 MiB for hele gatewayen og 200 ventende eller beholdte filer. Daglige kvoter for CPU og dekodede byte teller resultater når de beholdes og når de lastes ned. Svar bruker `private, no-store` og `Referrer-Policy: no-referrer`. Tokenet i en lenke alene lar ikke en annen person eller agent lese resultatet.
:::

<!--i:eti-file-->
## Infrastrukturlogger

Denne delen beskriver den offentlige lolly.tools-installasjonen. Hostingplattformen registrerer vanlige forespørselsdetaljer: IP-adresse, forespurt sti, tidsstempel og brukeragent. Lokale redigeringer når ikke den verten. Spørringsstrengen i en gjengivelseslenke kan inneholde teksten klienten oppga, som forklart ovenfor. MCP-filverktøy behandler bytene de får, i minnet. En Lolly Work-instans beholder også opplysningene beskrevet ovenfor, under driftsansvarliges loggingspolicy.

**De offentlige tjenestene holder applikasjonslogging på et minimum.** MCP-serveren logger oppstart, konfigurasjon og advarsler om gjengivelse; den beholder ingen egen forespørselslogg og logger ikke tokener eller klientadresser. Penpot-videresendingstjenesten logger hvert kommandonavn og Penpots svarstatus, aldri hoder, tokener eller filen. Sertifikattjenesten logger oppstartsinnstillingene og konfigurasjonsadvarsler, pluss to rensede linjer ved feil: en statuskode for sendefeil uten mottakeradresse og en fast feillinje uten feiltekst, stakksporing eller URL, fordi en leverandørfeil kan inneholde identitetsverdier eller påloggingsopplysninger. Alt annet i loggen kommer fra hostingplattformen.

For lolly.tools styrer instansadministratoren forespørselslogging, rotasjon og lagringstid på UpCloud. Denne siden oppgir ingen maksimal lagringstid for logger som ikke er bekreftet. Kontakt den behandlingsansvarlige nedenfor for gjeldende tidsplan og for alle forespørsler om logger som lagres på serveren. For en annen instans gjelder driftsansvarliges innstillinger, inkludert eventuell loggeksport eller andre databehandlere.

<!--i:eti-stamp-->
## Behandlingsgrunnlag, lagringstid og mottakere

Denne tabellen dekker referanseinstallasjonen **lolly.tools**. Den oppgir ikke behandlingsgrunnlagene eller lagringstidene til organisasjonens Lolly Work-instans; driftsansvarlig oppgir dem i sin egen policy.

| Behandling | Behandlingsgrunnlag (GDPR Art. 6) | Lagres i |
|---|---|---|
| Alt på enheten din (dokumenter, innstillinger, hurtigbuffer, tellere) | **Overhodet ikke vår behandling**: Det når oss aldri. Lagring på enheten din er strengt nødvendig for tjenesten du ba om (ePrivacy Art. 5(3)), så den krever ikke samtykke | Til du sletter det |
| E-postadressen din under eldre vertsbasert Content Credentials-registrering | **Art. 6(1)(b)**, utførelse av en tjeneste du uttrykkelig ba om | Ingen identitetsoversikt eller utstedelseslogg i den eldre tjenesten; e-postadressen brukes under forespørselen og tas med i sertifikatet ditt. Lagringstid for administrert organisasjons-PKI, revisjon og tilbakekalling følger driftsansvarliges policy |
| En pseudonymisert SHA-256-hashverdi laget fra IP-adressen din, for frekvensbegrensning av innloggingsendepunktene og de offentlige gjengivelses-, bilde- og MCP-endepunktene | **Art. 6(1)(f)**, vår berettigede interesse i å hindre misbruk av en gratis tjeneste og en tredjeparts e-postkvote. Vi mener dette består en interesseavveining fordi råadressen ikke sendes til begrenseren, hashverdien bare brukes til misbruksvern og den utløper av seg selv | Omtrent ett minutt i misbruksvernlageret; beholdes ikke etterpå |
| Tilgangslogger for hosting (IP, sti, tidsstempel, brukeragent) | **Art. 6(1)(f)**, vår berettigede interesse i tjenestesikkerhet, forebygging av misbruk og feildiagnostisering | Rotasjon og lagringstid konfigurert av administrator; kontakt den behandlingsansvarlige for gjeldende tidsplan |

**Mottakere.** Mottakerkategoriene er hostingleverandøren vår (UpCloud), som er vert for appens database og misbruksvernlager, og, bare hvis du bruker e-postinnlogging, en leverandør av transaksjonsbasert e-post (Resend). Misbruksvernlageret mottar bare kortvarige hashverdier, aldri den rå IP-adressen. Hvis du logger inn med GitHub, Google eller SUSE (id.suse.com), forholder du deg direkte til den leverandøren under deres egen personvernerklæring, og de gir oss en bekreftet e-postadresse og ingenting annet. Vi deler ikke personopplysninger med noen andre, og vi selger ikke data, driver ikke annonsering og profilerer ikke brukere.

**Overføringer utenfor EØS.** Referanseappens hosting, database og fillagring er i Frankfurt. Valgfrie identitets-, e-post- og ressursleverandører har egne behandlingssteder og vilkår, som kan omfatte tilgang utenfor EØS, og en servers region alene fastslår ikke jurisdiksjonen til hver mottaker. Kontakt den behandlingsansvarlige for leverandøravtalene og overføringsordningene som gjelder; for en annen instans, spør driftsansvarlig. Europakommisjonens [standard personvernbestemmelser](https://commission.europa.eu/law/law-topic/data-protection/international-dimension-data-protection/standard-contractual-clauses-scc_en) er ett tilgjengelig vern for slike overføringer; denne siden hevder ikke at en ubekreftet leverandøravtale bruker dem.

**Automatiserte avgjørelser.** Ingen. Det foregår ingen profilering og ingen automatiserte avgjørelser med rettsvirkning eller tilsvarende betydelig virkning (Art. 22).

<!--i:eti-smile-->
## Barns personvern

Vanlig lokal bruk av appen sender ikke personlig innhold til lolly.tools. Den valgfrie Content Credentials-registreringen mottar en e-postadresse og er ikke rettet mot eller beregnet på barn. Organisasjonstjenester har egne kontoer og egen datahåndtering, under driftsansvarliges policy.

<!--i:eti-user-check-->
## Rettighetene dine

For opplysninger som bare er lagret på enheten din, kan du selv få tilgang til, rette, slette og flytte dataene. De ligger i nettleserens eller appens lagring, i en form du kan undersøke, eksportere (**Export my data**, ovenfor) eller slette (**Clear all my data**, eller nettleserens nettstedsdata).

Formelt har du etter GDPR Articles 15-22 rett til **innsyn** i personopplysningene dine, til å **rette** dem, **slette** dem, **begrense** eller **protestere mot** behandlingen av dem (inkludert alt vi baserer på berettigede interesser), til **dataportabilitet** og, der behandlingen bygger på samtykke, til å **trekke tilbake samtykket når som helst**, uten at det påvirker lovligheten av det som skjedde før du trakk samtykket tilbake.

Den offentlige sertifikattjenesten beholder ingen utstedelseslogg. Infrastrukturlogger kan inneholde forespørselsdetaljer, så denne erklæringen lover ikke at hostingmiljøet ikke lagrer personopplysninger. Kontakt den behandlingsansvarlige for innsyn, sletting eller en annen forespørsel om disse opplysningene; vi forklarer hvilke opplysninger som finnes og hva som kan gjøres. For arbeid, identiteter, telemetri og revisjonsopplysninger som en organisasjon lagrer, kontakt din Lolly Work-driftsansvarlige, fordi lokale eksport- og slettekontroller ikke når disse kopiene.

**Du har rett til å klage.** Hvis du mener vi har håndtert dataene dine feil, kan du sende en klage til en tilsynsmyndighet for personvern: i EU, myndigheten i landet der du bor, arbeider eller mener overtredelsen skjedde (Art. 77). Vår ledende tilsynsmyndighet er *Bayerisches Landesamt für Datenschutzaufsicht* (BayLDA) i Ansbach, Tyskland. Du trenger ikke kontakte oss først, men vi vil gjerne få muligheten til å rette problemet.

<!--i:eti-history-->
## Endringer i denne erklæringen

Datoen øverst endres hver gang dette dokumentet gjør det. En endring som påvirker hva som forlater enheten din eller hva som beholdes, får sin egen linje her i stedet for en umerket redigering. For å se hva som er endret, spør (nedenfor) eller sammenlign med den [offentlige kilden](https://github.com/lolly-tools/lolly/commits/main/docs/privacy.md).

::: details Tidligere endringer, 29. september til 23. oktober 2026
**29. september 2026:** presiserte den valgfrie lolly.work-tjenesten, innholdet organisasjonen lagrer, informasjonskapslene for autentisering, brukstelemetrien og revisjonsopplysningene og skillet mellom lokal sletting og lagring på serveren. Dette er eksisterende valgfrie arbeidsflyter, ikke et nytt opplastingskrav for lokal redigering.

**11. oktober 2026:** erstattet den utgåtte beskrivelsen av Vercel-hosting med oversikten over UpCloud-appens vertsnavn, skilte ut valgfrie identitets- og ressursleverandører og beskrev innholdsadressert levering og MCP-nedlastingsmodusen med beholdte resultater. Ingen tredjeparts CDN aktiveres av denne endringen. Lagringstid for logger styres av administratoren i stedet for en oppgitt standard i et Vercel-abonnement.

**22. oktober 2026:** rettet beskrivelsen av eksisterende atferd. Delen om nettleserutvidelsen dekker nå godkjenningsvinduet for hver forespørsel, nettstedstilgang som forespørres for ett nettsted om gangen og henting av stilark og ikoner ved lesing av et nettsted. Også rettet: radene for Send to Google Drive og Meeting Planner, SEAL-merknaden (ingen Lolly-app slår opp SEAL-nøkler i DNS), organisasjonstjenestens standardnivå for brukstelemetri, MCP-bildeverktøyene og applikasjonsloggingen i de offentlige tjenestene. Selve programvaren ble ikke endret.

**23. oktober 2026:** omorganiserte erklæringen etter hva som starter hver forespørsel og beskrev eksisterende atferd den ikke dekket før: private samarbeidsinvitasjoner som inneholder lokale nettverksadresser, Nearby i skrivebordsappen, Allow AI control, lesing av et designsystem fra et nettsted, emojisett, Meeting Planners hurtigbuffer for byoppslag på enheten, Trash og de andre opplysningene Settings → Storage lister. Rettet to påstander: Bluesky og Discord er ikke bare for skrivebordsapper, og hver vert en person velger for sending, trenger driftsansvarliges godkjenning i både nett- og skrivebordsappene; hashverdien av en IP-adresse som brukes til frekvensbegrensning, er pseudonymisert, ikke anonym. Selve programvaren ble ikke endret.
:::

**3. november 2026:** la til delingslenker etter Send. Når du trykker på Create a share link, gjør Lolly ett ekstra kall til leverandøren du sendte filen til (Google Drive, Dropbox, OneDrive eller din egen Nextcloud), og Stop sharing gjør et nytt kall for å slå av lenken. En S3-delingslenke lages på enheten din og sender ingenting. Ingen ny vert er involvert, og Lolly beholder ingen kopi av noen lenke eller noe token på en server.

**3. november 2026:** la til **Ask an agent** i skrivebordsappen: hva appen ser etter på datamaskinen når panelet åpnes og hva som sendes til en agents leverandør når du spør, under din egen konto hos den leverandøren.

**10. november 2026:** fullførte og rettet beskrivelsen av eksisterende atferd. Enhetslisten nevner nå profilopplysningene dine, signeringsidentiteten din, beholdte innlogginger og delte lenker, svarene dine på engangsspørsmål, nylige nedlastinger, opplysningene til en tilkoblet instans, arbeidsfiler i nettleserens fillagring og hva dokumentasjonssidene beholder. Rettet: De lokale brukstellerne følger med i din egen sikkerhetskopifil og Sync-kopi; Clear all my data avslutter ikke en organisasjonsinnlogging; Trash tømmer elementer eldre enn 30 dager neste gang du åpner Projects; en husket Google Drive-tilkobling på nettet merkes med e-postadressen til Google-kontoen din; Lollys egne apper sender ingen brukshendelser til en Lolly Work-instans. Beskrev også personvernlinjen for arbeidsområdet som ble lagt til i 1.2.0, og merkevaresider publisert til en instans. Bortsett fra den personvernlinjen ble selve programvaren ikke endret.

**10. november 2026:** la til Lolly Work-utgivelsessjekken: En Lolly Work-server leser den publiserte chart-indeksen én gang om dagen for å fortelle administratorene om en nyere utgivelse. Forespørselen inneholder ingenting om instansen eller personene der, og en administrator kan slå den av eller peke den mot et speil.

<!--i:eti-mail-->
## Hvem som er ansvarlig og hvordan du når oss

Den **behandlingsansvarlige** for lolly.tools er:

> SUSE Software Solutions Germany GmbH
>
> Frankenstraße 146
>
> 90461 Nürnberg
>
> Tyskland

SUSE har utnevnt et **personvernombud**, som kan nås på [privacy@suse.com](mailto:privacy@suse.com). Bruk den adressen for alle formelle forespørsler under "Rettighetene dine" ovenfor.

For alt om selve Lolly, som hvordan det fungerer, hvorfor noe er som det er eller en rettelse til dette dokumentet, kontakt **Andy Fitzsimon**, [fitzy@suse.com](mailto:fitzy@suse.com).

For en egenhostet Lolly-instans eller en Lolly-instans for en virksomhet, kontakt i stedet den som drifter den: Driftsansvarlig er behandlingsansvarlig for sin egen installasjon. SUSE og Lolly-prosjektet med åpen kildekode lagrer ingen data for installasjoner de ikke driver.
