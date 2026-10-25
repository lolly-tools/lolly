# Personvernerklæring

*Sist oppdatert: 23. oktober 2026*

**Det du lager i Lolly, skjer på enheten din.** Å åpne et verktøy, skrive, forhåndsvise, eksportere og sjekke en fil skjer alt i appen på telefonen, datamaskinen eller nettleseren din. Du trenger ingen konto, og appen setter ingen informasjonskapsler for noe av dette.

**Det du lager forlater enheten din bare når du ber om det.** Å legge til en Google Font, sende en fil til Drive eller Dropbox, slå på Sync, spille av radioen eller laste ned en AI-modell på enheten gir hver sin forespørsel som du selv har startet. Appen henter også verktøyene og oppdateringene sine fra sin egen adresse, og de forespørslene inneholder ingenting av det du har laget. [Alle nettverksforespørsler appen kan sende](#every-network-request-the-app-can-make) lister dem opp, vert for vert.

**Noen få Lolly-tjenester kjører på en server.** Gjengivelseslenker, bildehenteren, endepunktet for AI-agenter og tjenesten for verifisert identitet mottar bare det du sender dem, og lagrer det ikke lenger enn denne siden oppgir.

**Organisasjonens Lolly Work-instans er annerledes.** Den lagrer det delte arbeidet du legger inn der, og driftsansvarliges policy gjelder for de dataene, ikke denne.

::: figure privacy-where-data-goes
Hvor dataene dine går: de blir på enheten din med mindre du starter en forespørsel, og hver type forespørsel har sin egen destinasjon.
:::

## Hva denne erklæringen dekker

Lolly er programvare med åpen kildekode som hvem som helst kan kjøre: en motor, appskall for nett, skrivebord, mobil og terminal, og en nettleserutvidelse. Denne policyen har to deler:

- <!--i:code--> **Selve programvaren**: hva den gjør og ikke gjør med dataene dine, uansett hvor den kjører. Dette er en egenskap ved koden, så det gjelder for alle Lolly-installasjoner, våre og andres.
- <!--i:server--> **lolly.tools**, referanseinstallasjonen SUSE driver: valgene som er tatt i driften av de valgfrie serverdelene, for eksempel hva som logges, hvor lenge og av hvem.

På en selvhostet Lolly-instans eller en bedriftsinstans gjelder programvareoppførselen nedenfor fortsatt, men *driftsansvarlig* for den instansen, ikke SUSE, har ansvaret for alt på serverne deres: gjengivelsesendepunktet, MCP-serveren, sertifikattjenesten og Lolly Work-instansen. Be dem om deres egen policy. [Adoption & Governance](/info/adoption-governance.html) beskriver hva det innebærer å drive Lolly.

## Det som blir på enheten din

Lollys nett-, skrivebords- og mobilapper kjører hele gjengivelsesmotoren på enheten. Når verktøyene, ressursene og koderne du bruker er på enheten, trengs det ingen server for å gjengi og laste ned.

**Bruk av appen alene setter ingen informasjonskapsler.** Organisasjonspåloggingen og den valgfrie registreringen av verifisert identitet har egne informasjonskapsler, beskrevet i sine egne avsnitt. Appen lagrer disse postene på enheten:

- <!--i:sliders--> **Grensesnittinnstillinger**: tema, språk, lydinnstillinger, størrelser på sidefelt og zoom, sorterings- og visningsvalg og hvilke tips du har sett, i `localStorage`, slik at de er klare før appen er ferdig startet.
- <!--i:download--> **En frakoblet hurtigbuffer for verktøykatalogen og ressursforhåndsvisningene**, slik at galleriet fungerer uten tilkobling.
- <!--i:hash--> **Lokale bruksteller** for statistikken på profilkortet ditt, for eksempel hvor mange eksporter og hvilke verktøy: en liten avgrenset post i `localStorage`, aldri lest av oss og aldri sendt noe sted.
- <!--i:folder--> **Ditt eget arbeid**: dokumenter, lagrede økter og historikken deres, opplastede bilder og skrifter, filresultater og tidligere versjoner, og papirkurven, som beholder slettede elementer i 30 dager. Disse ligger i IndexedDB på enheten og blir der med mindre du velger Sync eller deling.
- <!--i:globe--> **Bysøkene til Meeting Planner**, i `localStorage`, slik at hver by slås opp bare én gang.
- <!--i:cpu--> **Nedlastede modeller og festede verktøy**: AI-modeller på enheten som du har godtatt å laste ned, og verktøy du har festet for bruk uten nett.

**Settings → Storage** viser hvor mye plass Lolly bruker på enheten, med arbeidet ditt, papirkurven, nedlastede modeller, frakoblede kopier og hurtigbuffere oppført enkeltvis. **Clear all my data** der fjerner den lokale kopien og slår av Sync først; å tømme nettstedets lagring i nettleseren gjør det samme. Lagring som er strengt nødvendig for tjenesten du ba om, krever ikke samtykke etter ePrivacy-direktivet (art. 5(3)), bare åpenhet, og det er det dette dokumentet og varselet i appen gir.

![Lagringsdelen i Settings på en telefonskjerm: hver kategori av data på enheten er navngitt, med knappen Clear all my data ved siden av listen](/t/url-shot?url=%2F%23%2Fprofile%3Ffocus%3Dstorage-section&width=430&height=1600&dpi=192&waitMs=2400&css=.welcome-dialog%2C.personalize-nudge%2C.store-selbar%2C.profile-row-value%2C.profile-group-value%2C%23store-hero-num%2C%23store-headroom%7Bdisplay%3Anone%7D&format=svg&waitSelector=%5Bdata-store-group%3Dmove%5D&drive=click%3A%5Bdata-store-group%3Dwork%5D%3Esummary%3Bclick%3A%5Bdata-store-group%3Dcaches%5D%3Esummary&walker=1&cropSelector=%23storage-section&dark=1&filename=pv-storage-clear)

**Export my data** lager en `lolly-backup`-fil som du beholder og kontrollerer selv. Den berører aldri serverne våre med mindre du selv sender den et sted. Se [Data transfer](/info/data-transfer.html).

### Verktøy som kjører på enheten din

Noen verktøy, som **Strip Hidden Data**, **Compress** og andre med merket **Runs on your device**, arbeider på en fil du oppgir. Filen leses inn i minnet, behandles på enheten og tilbys tilbake som en nedlasting. Den lastes aldri opp, fordi det ikke er noen server på veien. Disse verktøyene fungerer uten nett, og resultatet bærer ingen vannmerker eller metadata fra oss.

**Rondocode** er det eneste unntaket, fordi det lager ny lyd av sangen din i stedet for å behandle en fil du har. Hver lydfil det skriver, bærer Content Credentials som registrerer sangen og oppgir eventuell AI-generert sang. Eksportpanelet sier fra om dette før du eksporterer, og [Rondocode songs](/info/rondocode.html#files-from-the-rondocode-utility) lister nøyaktig hva som registreres.

![Merket disse verktøyene bærer: Runs on your device - nothing is uploaded](/t/url-shot?url=%2F%23%2Ftool%2Ftext-helper&width=1440&height=900&dpi=192&waitMs=2400&walker=1&format=svg&cropSelector=%5Bdata-privacy%5D&dark=1&filename=pv-ondevice-badge)

**Prepare for sharing** og **Compare** arbeider i minnet på enheten og sender ingenting til en server, og Prepare legger ingenting til i historikk, lenker, sikkerhetskopier eller Sync før du lagrer et resultat.

::: details Slik håndterer Prepare for sharing og Compare filene dine
**Prepare for sharing** holder arbeidsinndata, private funn og erstatningskart i minnet, uten å legge dem til i historikk, lenker, sikkerhetskopier eller Sync. Inspeksjon og erstatning sender ikke filinnhold til noen server og sjekker ingen legitimasjon på nett. Du velger om du vil kopiere, laste ned, sende eller lagre et resultat i biblioteket ditt; et lagret resultat følger deretter bibliotekets innstillinger for sikkerhetskopiering og Sync. Oppskriftsfiler utelater tidligere innhold og bokstavelige tilordninger, og sammendragsrapporter inneholder tall, omfangs-ID-er og filhasher. CLI-et lagrer en privat gjennomgangsfil med de opprinnelige verdiene bare når du ber om det med `--review-file`. Når du forlater en forberedelsesvisning, frigis arbeidstilstanden, men det er ikke et løfte om forensisk sletting fra nettleserens eller operativsystemets minne.

Forberedte kopier og ferdige filoperasjoner deler kontrollene i Compare. Fjernede verdier starter sammenfoldet, og sammenligningsrapporter utelater kildenavn, stier og verdier med mindre du velger å ta dem med. Filhistorikken lagrer kopien, så en sammenligning etter en omlasting betyr at du velger originalen på nytt, matchet med den registrerte SHA-256-verdien. Å velge den lagrer eller laster ikke opp filen.
:::

Strip Hidden Data og Prepare for sharing inspiserer også DOCX-, PPTX- og XLSX-filer på enheten. Støttede DOCX-filer kan få fjernet utvalgte egenskaper i en ny kopi; annet Office-innhold kan bare inspiseres, og private forhåndsvisninger ligger bak en visningskontroll.

::: details Hva Office-inspeksjonen leser og fjerner
| Office-format | Pakkeinnhold som inspiseres | Støttet fjerning |
|---|---|---|
| DOCX | Kjerne-, program- og egendefinerte egenskaper; kommentarer og forfattere; markører og forhåndsvisninger for sporede endringer; skjulte tekstkjøringer; eksterne relasjoner; innebygde objekter | Utvalgt forfatter, sist lagret av, datoene opprettet/endret/sist skrevet ut, tittel, emne, beskrivelse, nøkkelord, egendefinerte egenskaper, Company, Manager, Template, hyperlenkebase, programnavn og -versjon, og statistikk (total redigeringstid og antall sider, ord, tegn, linjer og avsnitt) |
| PPTX | Egenskaper; kommentarer og forfatterposter; talernotater; markører for skjulte lysbilder; eksterne relasjoner; innebygde objekter og støttede nestede arbeidsbøker | Ingen |
| XLSX | Egenskaper; kommentarer og notater; markører for skjulte ark, rader og kolonner; definerte navn; eksterne relasjoner og tilkoblinger; flater for eksterne lenker og pivotbuffer; innebygde objekter | Ingen |

**Grenser.** Opptellingen inspiserer ikke synlig tekst, formler, avhengigheter, gjengitt utseende eller vilkårlige binære deler fullt ut. Den støtter opptil 300 pakkedeler, 64 MiB samlet oppgitt utvidelse, 2 MiB per XML-del og to nestingsnivåer av innebygde pakker; Prepare deler del- og utvidelsesbudsjettene på tvers av hele jobben. Avkortet, ugyldig, kryptert og ikke-støttet innhold rapporteres og beholdes. Makroinnhold identifiseres og kjøres aldri, eldre binære Office-formater og XLSB inspiseres ikke, og eksterne referanser hentes aldri.

**Hva DOCX-opprydding beholder.** Oppryddingen støtter det transitional DOCX-pakkeformatet med kanoniske deler for kjerne-, egendefinerte og utvidede egenskaper. Fra de utvidede egenskapene kan Company, Manager, Template, HyperlinkBase, Application, AppVersion og statistikkene TotalTime, Pages, Words, Characters, CharactersWithSpaces, Lines og Paragraphs fjernes. DocSecurity, overskrifts- og deltitler, lenkeflagg og andre programegenskaper beholdes. Når Template fjernes, blir en eventuell vedlagt malkobling stående i dokumentinnstillingene, der opptellingen rapporterer den som en ekstern relasjon.

Noen lesere velger hvordan diagrammer og tegninger skal tegnes ut fra programnavnet og versjonen; LibreOffice viser for eksempel et diagram fra en Word 2007-fil annerledes uten dem. Begge beholdes når filen inneholder diagrammer, bilder, former eller innebygde objekter, og inspeksjonen lister dem som beholdt. En egenskap som et Word-felt viser (TEMPLATE, EDITTIME, NUMPAGES, NUMWORDS eller NUMCHARS) beholdes, og lenkefelt og relative eksterne lenker beholder HyperlinkBase, fordi målene deres løses opp mot den basisadressen.

**Hva som forblir bare inspiserbart.** Utvidede data for digital signatur hindrer opprydding. Signerte, makroaktiverte, krypterte, ugyldige, omdøpte eller nestede Office-pakker forblir bare inspiserbare. Det samme gjelder filer med andre egenskapsavhengige Word-felt, som DOCPROPERTY eller AUTHOR, eller med XML-bundne innholdskontroller, fordi fjerning av en egenskap kan endre dokumentet når Word oppdaterer disse bindingene, og bufret felttekst kan ikke vise at neste gjengivelse ser lik ut. XML-deler med uvanlige filetternavn, mål for Word XML-relasjoner som ikke kan inspiseres trygt, feil deklarerte topp- eller bunntekstdeler og SVG-deler deklarert som XML med etternavnet `.svg` forblir også bare inspiserbare i denne første oppryddingsversjonen.

**Slik kontrollerer oppryddingen arbeidet sitt.** Egenskapsdeler, deklarasjonene deres, urelaterte pakkemedlemmer, XML-kommentarer og ZIP-kommentarer beholdes. Oppryddingen bruker grensene fra opptellingen og kontrollerer integriteten til hvert medlem før skriving, og inspiserer deretter de resulterende egenskapene på nytt. Compare viser støttede egenskapsforskjeller med sammenfoldede verdier; den sammenligner ikke synlig tekst eller gjengitt utseende. Verdier bruker forhåndsvisninger på opptil 2048 tegn, så forskjeller utenfor en forhåndsvisning vises kanskje ikke, og en delvis gjennomgang kan ikke fastslå at to filer er like. CLI-ets `prepare --strip-hidden-data` fjerner støttede DOCX-egenskaper, og en privat gjennomgangskonvolutt kan velge enkelte av dem. En mislykket oppryddingskontroll beholder filen og rapporterer en mislykket operasjon.
:::

## Hver nettverksforespørsel appen kan gjøre

De fleste forespørsler henter verktøy, skrifter eller modeller til enheten din. Send-handlinger overfører filen du valgte, Sync overfører en sikkerhetskopi til lagringen du valgte, og organisasjonstjenester overfører innholdet eller opplysningene som trengs for delt arbeid. Hver gruppe nedenfor lister hva som forlater enheten din, når, og hva som skjer hvis en driftsansvarlig blokkerer forespørselen. En driftsansvarligs konfigurerte identitets- og ressursleverandører kan legge til destinasjoner for den installasjonen. [Every fixed host, in one table](#every-fixed-host-in-one-table) lister vertene nettappen kan kontakte.

::: details Ting som hentes til enheten din
- <!--i:download--> **Verktøykatalogen.** Ingenting personlig: en forespørsel om Lollys egen offentlige indeks over verktøy og ressurser, til appens egen adresse, ved oppstart og deretter bufret for bruk uten nett. Hvis den blokkeres, kjører appen på de bufrede verktøyene og slutter å oppdage nye.
- <!--i:sparkle--> **Emoji-sett.** Settet du velger lastes ned fra appens egen adresse første gang du bruker det settet. Ingenting personlig sendes. Lottie-animasjoner leses på enheten og kontakter ingen.
- <!--i:document--> **Google Fonts.** Det valgte familienavnet og IP-adressen din går til Googles skrifttjenere (`fonts.googleapis.com` for stilarket, `fonts.gstatic.com` for skriftfilen). Dette skjer bare når du legger til en Google Font i Design System Setup, og bare etter at du har sagt ja i en dialog som sier nøyaktig dette. Hver familie hentes én gang, beholdes deretter på enheten og brukes uten nett. Hvis den blokkeres, svikter velgeren trygt; last opp en skriftfil i stedet.
- <!--i:cpu--> **AI-modeller på enheten.** Ingenting personlig: en nedlasting av modellfiler, som deretter beholdes på enheten. Nettbygg bruker som standard appens egen adresse; et bygg kan oppgi en annen modellvert, for eksempel Lollys utgivelsesvert `lolli.li` for de pakkede appene. Verten mottar forespørselen og IP-adressen din, uten konto og uten modellinndata. Dette skjer bare når du bruker en funksjon som trenger en modell (Verifys dypskanning, bildeoppskalering, tale og lignende) eller velger å laste ned modeller for bruk uten nett. Hvis den blokkeres, venter funksjonen, og alt annet fungerer.
- <!--i:sliders--> **ICC-trykkprofiler.** Ingenting personlig: en forespørsel om en standard trykkbetingelsesprofil til ICCs offentlige register (`registry.color.org`, `www.color.org`), bare når du klikker på en ICC-forhåndsinnstilling i håndteringen av trykkprofiler, én gang per profil. Hvis den blokkeres, svikter forhåndsinnstillingene; oppgi din egen `.icc`-profil.
- <!--i:globe--> **Internettradio.** Ingenting personlig: en forespørsel om spilleliste og en lydstrøm fra stasjonen (`api.somafm.com` og strømtjeneren den peker til, `*.somafm.com`), bare mens du spiller den valgfrie radioen i lydspilleren. Hvis den blokkeres, svikter radioen, og alle andre lydfunksjoner fungerer.
:::

::: details Et verktøy som trenger sanntidsdata
- <!--i:globe--> **Bysøket i Meeting Planner.** I dag er dette det eneste verktøyet som henter sanntidsdata. Det ber `geocoding-api.open-meteo.com` gjøre hvert bynavn (vertsbyen og hvert teammedlems by) om til koordinater og en tidssone, uten konto, uten nøkkel og uten annen identifikator enn selve forespørselen. Inndatafeltet Host city forklarer dette, og hvert svar lagres på enheten slik at en by slås opp bare én gang. Det kjører bare mens verktøyet er åpent. Hvis det blokkeres, svikter oppslaget, og ingenting annet påvirkes.
:::

::: details Filer du sender
Hver av disse sender bare den ene filen du valgte, når du trykker på Send-knappen, etter en pålogging du fullfører i tjenestens eget vindu. Bluesky-appassordet, Discord-webhook-adressen, Nextcloud-appassordet og S3-nøklene lagres bare på denne enheten, aldri i en sikkerhetskopi, og **Disconnect** sletter dem.

- <!--i:upload--> **Google Drive.** Filen, i hvilket som helst format, går til Googles Drive API (`www.googleapis.com`). Lollys tilgang er begrenset til filer den selv har laget (omfanget `drive.file`), så den kan aldri lese resten av Drive. I nettappen holdes påloggingstokenet i minnet for økten og lagres aldri; i de andre appene lagres et oppdateringstoken bare på denne enheten hvis du krysser av for **Stay connected**. Knappen finnes bare i bygg der driftsansvarlig har konfigurert en Google-klient-ID. Hvis den blokkeres, vises knappen aldri; last ned filen og last den opp selv.
- <!--i:upload--> **Dropbox.** Filen går til Dropboxs API (`api.dropboxapi.com` for pålogging og metadata, `content.dropboxapi.com` for filen). Tilgangen gjelder bare appmappen, så Lolly ser `Apps/` og sin egen mappe der og ingenting annet. Lenken **Open** den viser er en kortlevd privat lenke, og det opprettes ingen offentlig deling. Et oppdateringstoken lagres bare hvis du krysser av for **Stay connected**. Knappen finnes bare med en Dropbox-klient-ID konfigurert av driftsansvarlig.
- <!--i:upload--> **OneDrive.** Filen går til Microsofts identitets- og Graph-tjenester (`login.microsoftonline.com` for pålogging, `graph.microsoft.com` for opplastingen); en stor fil lastes opp i deler til `api.onedrive.com` eller lagringsopprinnelser driftsansvarlig har konfigurert. Tilgangen er begrenset til Lollys egen mappe under `Apps/`, pluss visningsnavnet ditt til kontoetiketten. Et oppdateringstoken lagres bare hvis du krysser av for **Stay connected**. Knappen finnes bare med en Microsoft-klient-ID konfigurert av driftsansvarlig.
- <!--i:upload--> **LinkedIn**, **bare i skrivebordsappene**. Filen, med navnet som innleggstekst, går til LinkedIn (`www.linkedin.com` for pålogging i din egen nettleser, `api.linkedin.com` for opplasting og innlegget) som et offentlig innlegg på din egen strøm. Lolly kan poste som deg og lese navnet ditt til kontoetiketten, ingenting annet. Påloggingen beholdes bare hvis du krysser av for **Stay connected**, og LinkedIns tokener varer i 60 dager og kan ikke fornyes i det stille, så den utløper av seg selv. Disse vertene står ikke i nettappens tilkoblingspolicy. Knappen finnes bare i bygg med en konfigurert LinkedIn-app.
- <!--i:upload--> **Penpot.** Penpot-tilgangstokenet ditt, som du limer inn i appen, og `.penpot`-arkivet med designet går til Penpots API (`design.penpot.app`) gjennom en liten gjennomgang på appens egen adresse (`/api/penpot`), fordi Penpots API ikke svarer en nettleser direkte. Gjennomgangen videresender og glemmer; skrivebordsappene snakker direkte med Penpot. Dette skjer bare når du trykker **Send to Penpot** i Design-verktøyet og bekrefter et prosjekt. Hvis det blokkeres, svikter sendingen trygt; eksporter `.penpot`-filen og importer den selv.
- <!--i:upload--> **Bluesky.** Bildet, navnet som innleggstekst og alternativ tekst, og brukernavnet og appassordet ditt (laget under Bluesky → Settings → App passwords, aldri kontopassordet) går til Bluesky-serveren du oppgir, `bsky.social` med mindre du velger en annen. Du kobler til kontoen først under **Settings → Connected services**.
- <!--i:upload--> **Discord.** Filen går som vedlegg til kanalens webhook-adresse du limte inn, på discord.com. Alle som har en webhook-adresse kan poste i den kanalen, og derfor blir den på enheten.
- <!--i:upload--> **Mastodon.** Filen, med navnet som innleggstekst, går til Mastodon-serveren eller en kompatibel server du oppgir, etter en pålogging i den serverens eget vindu. Tilkoblingen registrerer en liten app for denne enheten på den serveren, og påloggingen beholdes bare hvis du krysser av for **Stay connected**.
- <!--i:upload--> **Nextcloud eller WebDAV.** Filen går til din egen server i én autentisert opplasting, med serveradressen, brukernavnet og appassordet du skrev inn (Nextcloud → Settings → Security → Devices & sessions; aldri kontopassordet).
- <!--i:upload--> **S3-kompatibel lagring.** Filen går til din egen bøtte (AWS S3, MinIO, R2, B2, Garage eller et hvilket som helst SigV4-endepunkt), signert på enheten med nøkkelparet du skrev inn.

**Verter du velger trenger godkjenning fra driftsansvarlig.** Vertene for Bluesky, Discord, Mastodon, Nextcloud og S3 står ikke i Lollys faste liste, fordi du velger dem selv. Appen sender ingenting til en slik vert før driftsansvarlig har godkjent akkurat den HTTPS-verten: på nettet i installasjonens Content Security Policy; i skrivebordsappene når appen bygges. Det samme gjelder egendefinerte lagrings- og SharePoint-opplastingsverter. På nettet må serveren også tillate nettleserkall fra appen (CORS), og en omdirigering svikter trygt, så bruk en adresse som ikke omdirigerer. Skrivebordsappene sjekker hver omdirigering mot den godkjente listen.

Denne listen begrenser hvilke verter appen kan nå. Den skiller ikke mellom kontoer eller leietakere hos Google eller Microsoft, og leverandørens egne tillatelser avgjør hvilke kontoer og handlinger som er tillatt. Den dekker heller ikke påloggingsvinduer, andre ressurstyper eller innebygde funksjoner, som har sine egne regler. En endring krever et nytt skrivebordsbygg eller nye topptekster i nettsvaret; lagre arbeidet ditt før du åpner appen på nytt for å få den med. [Connector origins](/info/connector-origins.html) beskriver konfigurasjonen.
:::

::: details Sync på tvers av enhetene dine
- <!--i:folder--> **Hva som forlater enheten.** En kopi av det du har laget på denne enheten (lagrede økter og prosjekter, designsystemene dine med skrifter og logoer, opplastede bilder, profilen og innstillingene dine) som én fil, til den ene lagringen du valgte: Lolly-appmappen i Dropbox (`api.dropboxapi.com`, `content.dropboxapi.com`), filer Lolly har laget i Google Drive (`www.googleapis.com`), Lolly-appmappen i OneDrive (`graph.microsoft.com`, der større filer lastes opp til `api.onedrive.com` eller lagringsopprinnelser driftsansvarlig har konfigurert, og nedlastinger skjer fra nøyaktige lagringsopprinnelser driftsansvarlig har konfigurert), eller din egen Nextcloud, WebDAV-server eller S3-bøtte. Den samme lagringen beholder opptil sju daglige kopier og én kopi fra før forrige gang du tok i bruk en kopi.
- <!--i:shieldcheck--> **Ingenting går til Lolly.** Ingen Lolly-server, ingen relé og ingen Lolly Work-server er på veien, og appene trenger ikke noe Lolly-nettsted for dette, ikke engang for å logge på. Kopien krypteres først på enheten bare hvis du setter en passfrase. Pålogginger, nøkler, appassord, passfrasen og Sync-innstillingene blir på enheten og er aldri med i kopien. På nettet beholder en husket Google Drive-tilkobling bare kontonavnet ditt (og din egen klient-ID, hvis du oppga en), og Google-påloggingen varer ett besøk. I Android-appen går Google Drive-påloggingen gjennom Google Play-tjenester på telefonen, som Google driver.
- <!--i:sliders--> **Når.** Bare etter at du slår på **Sync across my devices** eller trykker **Sync now**: en opplasting kort tid etter hver endring og når du forlater appen, og en sjekk etter en nyere kopi når appen starter. Hvis den blokkeres, svikter Sync og sier hvorfor, og arbeidet ditt blir på enheten. Du kan eksportere dataene dine til en fil og flytte dem selv i stedet. [Sync your devices](/info/sync.html) dekker funksjonen.
:::

::: details Nettsider, opptak og bilder fra andre nettsteder
- <!--i:monitor--> **En URL du ber et verktøy ta opptak av.** URL-skjermbildeverktøyet ber om akkurat den adressen du skriver, bare når du starter opptaket. Fordi du velger adressen i det øyeblikket, står den ikke i tilkoblingspolicyen, og en driftsansvarlig kan ikke tillate eller blokkere den per vert; for å fjerne den må verktøyet fjernes.
- <!--i:globe--> **En nettside i en Design-boks.** Siden hentes, med IP-adressen din, fra nettstedet den kommer fra, sammen med alt siden selv ber om. Der nettleseren støtter det, sendes rammen ingen informasjonskapsler og ingen adresse utover appens egen opprinnelse, så dokumentet ditt og lenken til det følger aldri med forespørselen. I nettappen kan bare disse spillerne rammes inn: `www.youtube-nocookie.com`, `player.vimeo.com`, `www.loom.com`, `www.google.com` (kart) og `www.figma.com`, pluss referansesider på `wikipedia.org` og `*.wikipedia.org`, `commons.wikimedia.org`, `upload.wikimedia.org`, `www.wikidata.org`, `www.mediawiki.org` og `www.openstreetmap.org`. **Allow pages from any site**, under **Settings → Trusted sites**, laster Lolly på nytt på enheten din under en policy som kan ramme inn hvilken som helst `https:`-side, og de samme reglene om tillit og spørsmål gjelder fortsatt. En side lastes bare for et nettsted i Trusted sites, inkludert de fjernbare referansestandardene, eller etter at du godkjenner den boksen i inspektøren; et lysbildeshow noen har sendt deg viser et bilde av hver side til da. Før du presenterer, tilbyr listen **Just this time** og **Always trust** for hvert nettsted, og ingenting spørres mens du presenterer. Hvis den blokkeres, viser boksen bildet sitt med en lenke for å åpne siden i en ny fane. Lolly-verktøy og Sandbox-demoer i en boks kjører på appens egen adresse og kontakter ingen.
- <!--i:sliders--> **Å endre en side du viser.** Handlingen **Use page** i en nettsideboks lar deg avvise informasjonskapsler eller lukke et banner inne på siden. For tilgjengelige Lolly-sider skjuler **Hide cookie banners** kjente overlegg, inkludert OneTrust, uten å godta informasjonskapsler eller endre nettstedets samtykkevalg. **Page CSS** endrer den boksens levende side og presentasjon; eksporter bruker fortsatt det valgte plakatbildet. Reglene kan ikke importere ressurser eller skrifter, og nettlesere hindrer Lolly i å endre et annet nettsteds CSS. Sandbox-forhåndsvisninger har sitt eget CSS-redigeringsprogram under **Edit in Sandbox**.
- <!--i:code--> **Nettressursene til en Sandbox-demo.** Hvert stilark, skript, hver skrift eller hvert bilde demoens kode lenker til, hentes, med IP-adressen din og uten informasjonskapsler, fra nettstedet som er vert for det; filer et hentet stilark nevner, som Google Fonts' skriftfiler, regnes som egne nettsteder. Dette skjer bare etter at du klikker **Fetch & inline**, eller for et nettsted i Trusted sites; **Always trust** ved siden av en fil legger til nettstedet i den listen. Hvis det blokkeres, kjører demoen uten de filene, og Sandbox lister hver fil den ikke kunne hente og hvorfor.
- <!--i:download--> **Legg til et bilde fra en URL.** **Add from URL** i ressursvelgeren eller Assets ber om akkurat den bildeadressen du limer inn. Nettappens egen policy hindrer nettleseren i å hente fra et annet nettsted direkte, så en liten gjennomgang på appens egen adresse (`/api/fetch-image`) henter bildet og leverer bare bytene tilbake; den lagrer ingenting, glemmer adressen og avviser alt som ikke er en offentlig bildeadresse. Skrivebordsappene henter adressen direkte. En Lolly-lenke du limer inn hentes ikke i det hele tatt: den gjengis på enheten. Hvis driftsansvarlig slår av gjennomgangen (`LOLLY_DISABLE_IMAGE_PROXY=1`), kan bare Lolly-lenker, `data:`-bilder og bilder fra samme opprinnelse legges til i nettappen, og skrivebordsappene påvirkes ikke.
- <!--i:palette--> **Et designsystem fra et nettsted.** Design System Setup kan lese én side på et nettsted du oppgir, gjennom [nettleserutvidelsen](#the-browser-extension) eller skrivebordsappens egen henting, aldri gjennom en Lolly-server. Ingenting hentes før du trykker, og lenker på siden følges ikke.
:::

::: details Samarbeid med andre mennesker og agenter
- <!--i:link--> **En privat collab.** To enheter kobler seg direkte sammen, uten server imellom. Invitasjonen og svaret bærer adressene hver enhet kan se på sitt eget nettverk, og dette bygget konfigurerer ingen ekstern tjener for adresseoppdagelse, så gi dem bare til personen du arbeider med. Se [Working together](/info/collaborate.html).
- <!--i:monitor--> **Nearby**, i skrivebordsappen. Mens du er synlig, som er ti minutter når du starter en collab-invitasjon eller, hvis du slår det på, så lenge appen kjører, kunngjør appen et tilfeldig navn, visningsnavnet du valgte og typen enhet på det lokale nettverket. Den kunngjør ingen e-postadresse, konto eller varig identifikator.
- <!--i:link--> **Inviter en agent.** Tilstanden til det inviterte dokumentet, forhåndsvisningene agenten ber om, agentens identitet og endringene dens går gjennom det konfigurerte sanntidsreléet (`lolly.ing` på lolly.tools) til agenten du inviterer. En installert vertsbasert plugin videresender også kall gjennom lolly.tools-koblingen til reléet invitasjonen velger; koblingen beholder ingen invitasjon eller noe dokument mellom kallene. Reléet holder invitasjoner og ventende forespørsler i minnet til du kobler fra eller de utløper: ti minutter for en ubrukt invitasjon og tretti minutter uten aktivitet for en som er tatt i bruk. Agentens leverandør håndterer dataene den mottar etter sin egen policy. Dette skjer bare etter at du oppretter en invitasjon i Share og gir instruksjonene til agenten din; lesetilgang tillater inspeksjon, og redigeringstilgang tillater også endringer. Pause stopper endringer, og Disconnect eller å trekke tilbake invitasjonen avslutter tilgangen. Hvis det blokkeres, kan ikke agenten bli med eller fortsette, og du kan redigere videre.
- <!--i:cpu--> **Allow AI control**, i skrivebordsappen. En agent som kjører på denne datamaskinen kan lese og redigere det åpne Design-dokumentet gjennom en tilkobling som blir på datamaskinen. Den er av til du slår den på. Lolly sender ingenting til en server for dette; agentens leverandør håndterer det agenten leser etter sin egen policy. [Threat Model & Trust Boundaries](/info/threat-model.html) lister hva en slik agent kan og ikke kan gjøre.
- <!--i:server--> **En ekstern instans.** Når du peker appen mot en annen Lolly-installasjon, mottar den det den instansen serverer tilbake, gjennom den samme katalogsynkroniseringen, pluss en versjonsmerkelapp på forespørsler til den (typen app og motorversjonen, den samme informasjonen en user agent bærer), slik at driftsansvarlig kan se hvilke Lolly-versjoner som er i bruk. På en administrert instans bærer merkelappen, mens du er logget på, også en installasjons-ID for denne enheten, slik at driftsansvarliges enhetsliste kan skille installasjoner fra hverandre; å forlate sletter ID-en, og en enhet som kobler til igjen senere presenterer en ny. Du velger verten, så den står ikke i tilkoblingspolicyen. Hvis det blokkeres, svikter byttet, og din lokale instans påvirkes ikke.
- <!--i:people--> **Organisasjonens Lolly Work-instans.** Påloggingsidentitet og enhetsinformasjon, policyforespørsler, de delte øktene, samarbeidsredigeringer, opplastinger, godkjenningsinnleveringer og leveringsfiler du bruker, og tillatte etiketter for bruksbegivenheter der det er konfigurert, går til organisasjonens instans, med pålogging gjennom identitetsleverandøren dens. Policyoppdateringer og aktivert telemetri kan kjøre under bruk; delt arbeid, collabs, gjennomgang og levering sender innhold som del av disse arbeidsflytene. Hvis det blokkeres, kan ikke disse organisasjonsfunksjonene fullføres, og ditt personlige arbeid forblir adskilt. Se [Organisation services with Lolly Work](#organisation-services-with-lolly-work).
:::

### Hver fast vert, i én tabell

Webappens Content Security Policy er det som hindrer et skript i å nå en vert den ikke lister. Ved siden av appens egen adresse gir tabellen hver vert den policyen lister, pluss de to LinkedIn-vertene skrivebordsappene legger til, merket som bare for skrivebord. En CI-test sjekker denne tabellen mot den utrullede policyen, så en vert kan ikke legges til ett sted uten det andre.

| Hva | Hva som faktisk forlater enheten din | Verter |
|---|---|---|
| AI-modeller på enheten i de pakkede appene, og utgivelsesfiler | En forespørsel om en offentlig fil, med IP-adressen din | `lolli.li` |
| Google Fonts | Skriftfamilienavnet og IP-adressen din | `fonts.googleapis.com`, `fonts.gstatic.com` |
| Send til og Sync med Google Drive | Filen eller sikkerhetskopien du valgte | `www.googleapis.com` |
| Send til og Sync med Dropbox | Filen eller sikkerhetskopien du valgte | `api.dropboxapi.com`, `content.dropboxapi.com` |
| Send til og Sync med OneDrive | Filen eller sikkerhetskopien du valgte, og visningsnavnet ditt til kontoetiketten | `login.microsoftonline.com`, `graph.microsoft.com`, `api.onedrive.com` |
| Bysøket i Meeting Planner | Hvert bynavn | `geocoding-api.open-meteo.com` |
| ICC-trykkprofiler | En forespørsel om en offentlig profil | `registry.color.org`, `www.color.org` |
| Internettradio | En forespørsel om spilleliste og en lydstrøm | `api.somafm.com`, `*.somafm.com` |
| Inviter en agent, og arbeidsområdet lolly.ing | Tilstanden til det inviterte dokumentet, forhåndsvisninger og redigeringer, og arbeidsområdeforespørslene du sender | `lolly.ing` |
| Spillere i en Design-nettboks | En forespørsel om siden, med IP-adressen din | `www.youtube-nocookie.com`, `player.vimeo.com`, `www.loom.com`, `www.google.com`, `www.figma.com` |
| Referansesider i en Design-nettboks | En forespørsel om siden, med IP-adressen din | `wikipedia.org`, `*.wikipedia.org`, `commons.wikimedia.org`, `upload.wikimedia.org`, `www.wikidata.org`, `www.mediawiki.org`, `www.openstreetmap.org` |
| Send til LinkedIn, bare i skrivebordsappene | Filen, med navnet som et offentlig innlegg | `www.linkedin.com`, `api.linkedin.com` |

Skrivebordsappenes egen liste inkluderer også Googles tokenendepunkt for Drive-påloggingen. Enhver annen vert, som en Mastodon- eller Nextcloud-server du oppgir, trenger driftsansvarliges godkjenning, som beskrevet under Filer du sender. Verter du velger i selve bruksøyeblikket, som en URL du tar opptak av eller en ekstern instans du oppgir, står ikke i noen liste.


**SEAL-signaturer sender ingen forespørsel.** Verify kan sjekke SEAL-signaturer, en ordning der signeringsnøkkelen kan publiseres i DNS. Nettlesere kan ikke gjøre DNS-oppslag, så et nettoppslag ville måttet gå gjennom en tredjeparts DNS-over-HTTPS-løser, som ville sett domenet som sjekkes og IP-adressen din. Lolly brukte tidligere Cloudflares løser; det gjør den ikke lenger, og ingenting har erstattet Cloudflare. Ingen Lolly-app slår opp SEAL-nøkler i dag: skrivebords- og mobilappene kjører den samme Verify-visningen, og kommandolinjens `lolly validate` sjekker ikke SEAL. En fil hvis SEAL-post bærer nøkkelen innebygd, sjekkes uten nett, og Verify kaller signaturen internt konsistent uten å bekrefte domenet. En fil der nøkkelen bare finnes i DNS, viser **SEAL signature did not verify**, med årsaken "no key resolver and no inline key".

![Verify-skjermen: et slippmål og ingenting annet - filen sjekkes der den allerede er, uten opplasting og uten konto](/t/url-shot?url=%2F%23%2Fverify&width=1440&height=900&dpi=192&waitMs=1400&walker=1&format=svg&cropSelector=.valid-layout&dark=1&filename=cc-verify-drop)

Du kan sjekke dette og alle andre påstander på denne siden selv: [Verify It Yourself](/info/verify-yourself.html) gir kommandoene og utdataene du kan forvente.

## Tjenester lolly.tools driver

Disse kjører på lolly.tools for alle. Hver av dem mottar bare det du sender. [Server Surface](/info/server-surface.html) beskriver de samme komponentene slik de fungerer i enhver installasjon.

### Gjengivelseslenker

Hver `https://lolly.tools/tool/<tool-id>.<ext>?<inputs>`-URL gjengis på ekte, og inndataene reiser i URL-en, så en delt Lolly-lenke kan vises som et levende bilde i en README, en wiki eller et dashbord. Å hente en ber serveren gjengi **offentlige verktøy- og katalogdata** med inndataene skrevet inn i adressen.

- <!--i:usercheck--> **Ingen kontoer, ingen informasjonskapsler, ingen tilstand.** Ruten ber ikke om pålogging, og ingenting på enheten din leses. Dokumentene, øktene og opplastingene dine forlater aldri nettleseren din og kan ikke dukke opp i disse lenkene.
- <!--i:document--> **Selve URL-en blir registrert.** Spørringsstrengen i en URL er en del av forespørselen, så den vises i vertsplattformens vanlige tilgangslogger som enhver annen forespurt sti. Hvis inndataene i en lenke inneholder noens navn eller e-postadresse, som et navneskilt eller en e-postsignatur kan gjøre, **ligger den teksten i disse loggene**. Gi en gjengivelseslenke bare det du ville lagt på en offentlig side.
- <!--i:globe--> **Inndataene er uansett offentlige.** De er det lenkens forfatter skrev inn i URL-en, og kan leses av alle lenken når. Ikke legg hemmeligheter i en delt lenke; Lolly tilbyr lenkekryptering for sensitivt innhold.
- <!--i:eyeoff--> **Bufret, begrenset og ikke indeksert.** Svar bufres og hastighetsbegrenses som alle offentlige bilder, og merkes `noindex` slik at søkemotorer holder gjengivelsene dine utenfor.

En selvhostet installasjon som ikke vil ha noen offentlig gjengivelsesrute, setter `LOLLY_DISABLE_RENDER_GET=1`, og hver av disse URL-ene returnerer 404.

### Bildehenteren og Penpot-gjennomgangen

**Add from URL** i nettappen og **Send to Penpot** bruker to små gjennomganger på lolly.tools, beskrevet under [Alle nettverksforespørsler appen kan sende](#every-network-request-the-app-can-make). Bildehenteren beholder ingenting og glemmer adressen. Penpot-gjennomgangen videresender tokenet og arkivet ditt til Penpot og beholder ingen av dem; den logger kommandonavnet og Penpots svarstatus.

### MCP-serveren, for AI-agenter

En AI-agent kan nå Lolly over Model Context Protocol, gjennom et endepunkt en driftsansvarlig kjører. lolly.tools kjører ett, og hvem som helst kan kjøre sitt eget, også helt uten nett.

- <!--i:cpu--> **Filer en agent sender.** Verktøyene som tar en fil (`lolly_transform`, `lolly_verify`, `lolly_redact`, `lolly_read`, `lolly_check`, `lolly_package`, `lolly_compose`, `lolly_rebrand` og bildeverktøyene `lolly_look`, `lolly_sample_color` og `lolly_trace_edges`) behandler den i minnet og returnerer resultatet i samme kall. Filen skrives aldri til disk og beholdes ikke etter at forespørselen er fullført. `lolly_inspect` tar også en fil, og video- og trykkproduksjonssjekkene skriver en midlertidig arbeidskopi som slettes når kallet returnerer. Alle andre verktøy arbeider ut fra parameterne i kallet: tekst, tall, farger, URL-er, katalogressurs-ID-er eller et dokument den som kaller oppgir.
- <!--i:cpu--> **Rebrand sier hvor en presentasjon går.** Det første trinnet i `lolly_rebrand`, `capabilities`, sier med ord hvor bytene dine ville gå før du sender noe: på en selvhostet lokal server forlater presentasjonen aldri den maskinen, og på en vertsbasert server sender et kall til `lolly_rebrand` presentasjonen dit, opptil størrelses- og lysbildegrensene det trinnet oppgir.
- <!--i:lock--> **Det åpne endepunktet.** På lolly.tools er `lolly.tools/api/mcp` åpent for alle uten token. Kall begrenses per adresse og av et dagsbudsjett. Adressen blir en pseudonym sammendragsverdi i lagringen for misbrukskontroll, som på påloggingsendepunktene nedenfor, og budsjettet teller bare CPU-tid og sendte bytes, uten adresse. Bærertokenet til et begrenset endepunkt skrives aldri til en logg eller en gjengivelses-URL.
- <!--i:link--> **Nedlastingslenker for store resultater.** lolly.tools returnerer resultater direkte og utsteder aldri disse lenkene. En driftsansvarlig kan slå dem på for sin egen autentiserte gateway, der et resultat holdes i høyst fem minutter og bare den som kaller sitt eget bærertoken kan hente det; se [MCP Server](/info/mcp.html#private-download-links-for-large-results). Et planlagt begrenset endepunkt på `mcp.lolly.tools` ville ta et bærertoken driftsansvarlig utsteder til pålitelige klienter, eller OAuth 2.1 med kortlevde signerte tokener sjekket mot en delt hemmelighet; aktiveringen venter, og det er oppført under [Delivery hosts and processors](#delivery-hosts-and-processors).

### Verifisert identitet: en pålogging du starter selv

Lolly kan forsegle en **Content Credential** i eksportene dine, slik at alle kan sjekke uten nett at en fil er uendret siden den forlot Lolly. Så mye er **på som standard og helt lokalt**: signeringsnøkkelen lages på enheten din, og signeringen skjer uten nett. Uten registrering er nøkkelen en engangsnøkkel, et nytt nøkkelpar laget for hver eksport og forkastet etterpå. Når du registrerer deg, varer nøkkelen og lages **ikke-eksporterbar**, så ikke engang Lollys egen kode kan lese den, bare be den signere. Uansett forlater den aldri enheten din.

[Exporting](/info/exporting.html#content-credentials-c2pa) lister hva en credential registrerer: verktøyet, tidspunktet, den grove eksportflaten, navnet ditt bare når du slo på *Use my details*, de krediterte verkene en eksport plasserer, og hver Rondocode-sang en video- eller lydeksport spiller (navnet, en hash av kilden og hvordan Lollys sandkasse gjengav sangen). Eksportpanelet lister disse sangene før du eksporterer.

Credentialen og filens metadata registrerer også [designsystemet og fargevarianten](/info/exporting.html#the-design-system-record) som tegnet eksporten: designsystemets ID og navn, den publiserte versjonen og fargevarianten. Et designsystems navn er tekst eierne skrev, og kan være en kundes navn, så kortet **Design system** i eksportpanelet viser de nøyaktige ordene før du eksporterer. Fjern avkrysningen på kortet, eller send `_madewith=0` eller `--no-madewith`, for å utelate dem.

Det ene *valgfrie* trinnet i tillegg er å registrere en verifisert identitet, slik at eksportene dine sier "Verified - signed by \<your email\>" i stedet for å nevne en anonym nøkkel. **Hvis du hopper over registreringen, mottar sertifikattjenesten ingen registreringsdata fra deg.**

![Kortet Verified identity i Settings, i telefonbredde: velgeren for sertifikatets levetid og registreringstrinnet under, hvilende til du selv starter det](/t/url-shot?url=%2F%23%2Fsettings%3Ffocus%3Didentity-section&width=430&height=1600&dpi=192&waitMs=2400&css=.welcome-dialog%2C.personalize-nudge%7Bdisplay%3Anone%7D&format=svg&walker=1&cropSelector=%23identity-section&dark=1&filename=pv-identity-enrol)

Hvis du registrerer deg, er dette nøyaktig hva som skjer:

::: timeline
- <!--i:usercheck--> **Du velger en påloggingsmetode**: GitHub, Google, SUSE (id.suse.com) eller en lenke på e-post. For de tre OIDC-leverandørene går du til leverandørens egen påloggingsside, under deres personvernerklæring, ikke vår, og sertifikattjenesten får tilbake bare en verifisert e-postadresse og leverandørens navn. For e-postlenken går adressen du skriver til **Resend**, en transaksjonell e-posttjeneste, bare for å levere den ene lenken.
- <!--i:lock--> **En kortlevd informasjonskapsel beskytter omdirigeringen.** Sertifikattjenesten setter `lolly_ca_state`, `HttpOnly`, avgrenset til `/api/ca` og utløper innen ti minutter. Den bærer en tilfeldig verdi i stedet for en sporingsidentifikator, finnes bare for å hindre at påloggingsomdirigeringen forfalskes og slettes så snart påloggingen er fullført.
- <!--i:eyeoff--> **IP-adressen din brukes kort for å hindre misbruk** av påloggingsendepunktene, slik at ett skript ikke kan oversvømme en innboks eller bruke opp e-postkvoten. Lolly gjør den om til en SHA-256-sammendragsverdi før den når den kortlevde lagringen for misbrukskontroll, så den rå adressen sendes ikke dit. Sammendragsverdien er pseudonym, ikke anonym: den som har lagringen, kunne gjenopprette en IPv4-adresse ved å prøve alle mulige. Spannet utløper etter omtrent ett minutt og brukes ikke til noe annet. Vanlige tilgangslogger hos vertstjenesten er adskilt og beskrevet nedenfor.
- <!--i:seal--> **Tjenesten utsteder et sertifikat** som binder den verifiserte e-postadressen din til enhetens offentlige nøkkel. Den private nøkkelen blir på enheten: klienten sender en sertifikatforespørsel med et bundet bevis på besittelse, og ingen privat enhetsnøkkel går til noen av utstedermodusene.
- <!--i:check--> **Signeringen forblir lokal.** Med den eldre utstederen trenger en eksport ingen forespørsel til sertifikattjenesten. En administrert identitet trenger også en fersk, signert tilbakekallingsliste fra utstederen sin; klienten kan bruke en bufret liste innenfor det konfigurerte ferskhetsvinduet, og fornyelsen kan kontakte sertifikattjenesten under en eksport. Manglende, utløpt eller ugyldig status hindrer den administrerte identiteten i å brukes.
:::

::: details Oppbevaring og tilbakekalling i hver utstedermodus
**Eldre vertsbasert utstedelse** tilbyr 7, 30, 90 eller 365 dager, begrenset av driftsansvarlig. Den har ingen identitetsoversikt og ingen utstedelseslogg, så den kan ikke slå opp hvem som har fått et sertifikat eller tilbakekalle sertifikatene til den personen; levetiden er tilbakekallingen.

**Administrert organisasjonsutstedelse** bruker en standardlevetid på høyst 24 timer og et maksimum på sju dager, med egen rot og egen tillitspolicy for utstedere, og signeringen går til Vault-utstederen driftsansvarlig har konfigurert. Registreringsapplikasjonen bruker en delt engangslagring for opptak som bare holder en nøklet autentiseringsidentifikator og en forespørselssammendragsverdi, i høyst ti minutter, og lagrer ingen identitetsoversikt eller buffer av sertifikatsvar. PKI-leverandøren, revisjonsenhetene, gatewayene og sikkerhetskopiene har egne dataflyter. Selv med vanlig utstedelseslagring slått av kan sertifikatbasert tilbakekalling beholde sertifikatet, inkludert e-postidentiteten, og tilbakekallingsserienumre og revisjonsidentifikatorer kan forbli koblbare; driftsansvarliges policy avgjør den oversikten, hvem som har tilgang og hvor lenge den beholdes.

En administrert enhet kan be om å tilbakekalle sitt eget sertifikat, med et autentisert bevis fra enheten, og ingen API ber om den private enhetsnøkkelen. Driftsansvarlig kan trekke tilbake en utsteder gjennom tillitspolicyen sin. Lolly beholder ingen kobling fra personer til sertifikater, så å tilbakekalle en persons sertifikater når personen slutter, avhenger av postene driftsansvarlig fører, og PKI-poster, revisjonsposter, mottakere og sikkerhetskopier følger driftsansvarliges policy. [Utformingen av sertifikattjenesten](https://github.com/lolly-tools/lolly/blob/main/services/ca/README.md) dekker utstederes forvaring, leverandørens oppbevaring og kvalifisering.
:::

## Organisasjonstjenester med Lolly Work

**Lolly Work** er Lolly-prosjektets valgfrie organisasjonstjeneste, som hver organisasjon som driver en instans, setter opp separat. Å koble til en instans legger til data som ligger på den serveren ved siden av din lokale redigering. Driftsansvarlig har ansvaret for den installasjonens personvernpolicy, tilgangskontroller, mottakere, oppbevaring og sikkerhetskopier.

| Arbeidsflyt | Data organisasjonens tjeneste håndterer |
|---|---|
| Pålogging og klargjøring | Påstander fra identitetsleverandøren, konto- og gruppemedlemskap, påloggingsøkter og enhetsinformasjon. OIDC håndterer pålogging; administratorer kan klargjøre og deaktivere kontoer gjennom SCIM |
| Delt katalog og prosjekter | Opplastede ressurser, metadata og versjoner; delte prosjekter og økter; innhold hentet fra konfigurerte bibliotekleverandører |
| Work-collabs | Delt øktstilstand, sanntidsredigeringer og deltakernærvær sendt gjennom instansen; lagret tilstand består under lagringspolicyen |
| Administrerte delingslenker | Lenkemål og tilgangsinnstillinger, som utløp og valgfri passordbeskyttelse; forespørsler løses opp gjennom instansen og kan trekkes tilbake |
| Gjennomgang og levering | Innsendt innhold, godkjenningsbeslutninger, valgt destinasjon, mellomlagrede filer og leveringskvitteringer |
| Servergjengivelser og batcher | Innsendte verktøyinndata, gjengivelsesforespørsler, status og beholdte utdatafiler. Disse jobbene kjører på serveren i stedet for på enheten din |
| Bruksrapportering | Tillatte begivenhetsetiketter som verktøy-ID, format og ressurs-ID, i samsvar med telemetripolicyen nedenfor |
| Revisjon | Aktør- og handlingsposter for styrte operasjoner, holdt adskilt fra bruks-telemetri |

Tjenesten bruker autentiseringsinformasjonskapsler, blant annet `lw_session` for påloggede medlemmer og `lw_guest` for gjestetilgang der det er aktivert, adskilt fra sertifikattjenestens informasjonskapsel. Policyoppdateringer og aktivert bruksrapportering kan sende forespørsler mens appen er i bruk, uten et eget klikk for hver. Dette er trafikk til den konfigurerte instansen, ikke en rapport til Lolly-prosjektet om installasjoner det ikke driver.

**Bruks-telemetri har tre nivåer.** `off` lagrer ingen bruksbegivenheter, `aggregate` fjerner bruker-ID-er og `standard` kan tilskrive begivenheter. Standardnivået er `standard`, så en instans lagrer bruksbegivenhetene den mottar med mindre driftsansvarlig velger `off`. Standard tilskrivingspolicy er `opt-in`, som krever samtykket ditt før en bruker-ID lagres; en driftsansvarlig kan i stedet konfigurere tilskrevet rapportering med `telemetryAttribution: default`. Tillatte attributter er etiketter, aldri verdier fra verktøyinndata. Se [Work telemetry](/info/work-telemetry.html).

**Revisjon er adskilt.** Styrte handlinger kan beholde en identifisert revisjonspost uansett telemetrisamtykket ditt. Å slå av telemetri slår ikke av lagring av delte økter, godkjenningsposter, lagring av gjengivelsesjobber eller revisjon. Driftsansvarlig styrer oppbevaring og sletting, inkludert eventuell pseudonymisering av revisjonsloggen; se [Work storage and data lifecycle](/info/work-data-lifecycle.html).

| | Enheten din | Organisasjonens instans |
|---|---|---|
| Hva den holder | Ditt personlige arbeid, innstillinger og hurtigbuffere | Delt arbeid, kontoer, opplastinger, godkjenninger, gjengivelser, revisjon og konfigurert telemetri |
| Hvem sletter den | Du, med **Clear all my data** eller nettleserens nettstedsdata | Driftsansvarlig, gjennom instansens egne kontroller |
| Hvem du spør | Ingen: postene ligger på enheten din | Instansens driftsansvarlige, for innsyn, eksport eller sletting |

**Lokal sletting er ikke serversletting.** Å forlate en instans eller tømme nettleseren fjerner lokal tilstand, ikke organisasjonens lagrede poster eller sikkerhetskopier. Personlig [Sync](/info/sync.html) og **Export my data** sikkerhetskopierer enheten din, ikke organisasjonens tjeneste. Den offentlige demoen [lolly.work](https://lolly.work) holder tilstanden sin bare i minnet og er ikke varig lagring for arbeidet ditt.

## Nettleserutvidelsen

Nettleserutvidelsen **Lolly URL Screenshot** samler ingen personopplysninger for oss. Den har ingen analyse, ingen sporing og ingen egen server. Siden [Browser extension](/info/extension.html) beskriver hvordan den fungerer.

**Hva den gjør.** Lolly-nettappen kan be den om et skjermbilde av en nettside, eller om innholdet på en side for å starte et designsystem fra et nettsted. Hver forespørsel åpner et godkjenningsvindu i utvidelsen som viser nettstedet som ber, om det vil ha et skjermbilde eller sideinnholdet, og sideadressen. Først etter at du trykker **Approve once** åpner utvidelsen den siden i en midlertidig bakgrunnsfane, tar skjermbildet eller leser siden, gir resultatet til Lolly-fanen som spurte og lukker fanen. Hver forespørsel trenger sin egen godkjenning.

**Data.**

- <!--i:shieldcheck--> **Vi samler ingenting.** Resultatet går bare til Lolly-siden som spurte, i samme nettleser. Utvidelsen lagrer ikke sideinnhold og legger ikke til noen annen mottaker.
- <!--i:globe--> **Nettverksforespørsler.** Siden du godkjenner lastes som i en hvilken som helst fane, sammen med alt siden selv ber om. Å lese sideinnholdet henter også sidens stilark og noen av ikon- og logobildene, fra innsiden av siden, og de hentingene sender ingen informasjonskapsler til andre nettsteder. Utvidelsen sender ingen andre forespørsler, og ingen går til en Lolly-server.
- <!--i:lock--> **Nettleserøkten din.** Siden lastes med nettleserøkten din, som om du åpnet den selv, så en side du er logget på, kan legge privat informasjon i resultatet.
- <!--i:link--> **Adressene du godkjenner** brukes bare til å laste den ene siden for den ene forespørselen. De logges eller deles ikke.

**Tillatelser.**

- <!--i:wrench--> **`debugger`**: for å ta skjermbildet gjennom DevTools Protocol, den samme mekanismen Lolly-skrivebordsappen bruker.
- <!--i:monitor--> **`tabs`**: for å åpne og lukke den midlertidige fanen, og for å sjekke at verken Lolly-siden eller målsiden har flyttet seg siden du godkjente.
- <!--i:code--> **`scripting`**: for å lese innholdet på en side i den midlertidige fanen, etter at du godkjenner den forespørselen.
- <!--i:database--> **`storage`**: for å notere ID-ene til de midlertidige fanene i øktlagringen, slik at de fortsatt lukkes hvis nettleseren stopper utvidelsen midt i en forespørsel. Ingen sideinnhold lagres.
- <!--i:check--> **Valgfri nettstedstilgang (`http://*/*`, `https://*/*`)**: ikke gitt ved installasjon. Når du trykker **Approve once**, ber utvidelsen Chrome om tilgang til det ene nettstedet i den forespørselen, og Chrome spør deg første gang for hvert nettsted. Et nettsted du har tillatt tidligere, trenger fortsatt en ny godkjenning for hver forespørsel.

Ingen av disse brukes til å lese, overvåke eller sende nettlesingen din videre utover den ene forespørselen du godkjente.

## Leveringsverter og databehandlere

Offentlige katalogfiler, verktøy og visningsvarianter kommer som standard fra appens egen adresse. Innholdsadresserte navn endrer hvor en fil hentes, ikke hvem som mottar forespørselen. Ingen tredjeparts CDN aktiveres av denne leveringsfunksjonen. Et CDN som avslutter TLS, ville mottatt forespørselsdetaljer, inkludert IP-adresser og eventuelle informasjonskapsler eller bærerlegitimasjon som videresendes til det, selv under samme vertsnavn i nettleseren, så en driftsansvarlig som legger til et slikt, tar inn en ny databehandler.

**Før noe CDN eller ekstern modellvert legges til**, må administratoren publisere databehandlerens navn, vertsnavn, jurisdiksjoner, metadata som mottas, oppbevaring og overføringsordninger. [Delivery deployment](/info/deploy-delivery.html) lister hva som skal oppgis. Private arbeidsområdesvar går utenom delte hurtigbuffere: personlige resultater, tilgangsavslag og feil bruker `private, no-store`, og et tillatt privat svar kan revalideres i nettleseren din uten å bli offentlig.

Referansetjenestene bruker hostingen nedenfor. Dette er en liste over vertsnavn, ikke en påstand om at en annen organisasjons instans bruker samme region.

| Vertsnavn eller tjeneste | Funksjon og mottaker | Region og databehandling |
|---|---|---|
| lolly.tools | Offentlig app, katalog, gjengivelse og sertifikattjenester; hosting hos UpCloud | Frankfurt, Tyskland. Forespørselsdetaljer kan vises i infrastrukturlogger; vanlig lokal redigering blir på enheten |
| lolly.ing | Administrert arbeidsområde og dokumentagenttjenester; hosting hos UpCloud | Frankfurt, Tyskland. Den private databasen og fillagringen ligger på samme vert. Kontoer, delt innhold og tjenesteposter følger instansadministratorens policy |
| mcp.lolly.tools | Planlagt valgfri autentisert MCP-gateway og private resultatnedlastinger; hosting hos UpCloud | Frankfurt, Tyskland, med samme hostingbehandler. Aktivering venter. Gatewayen ville motta forespørselsdetaljer og parameterne eller filene den som kaller sender |
| lolli.li | Offentlige utgivelses- og modellfiler; UpCloud Managed Object Storage, adskilt fra applikasjonsklyngen | Frankfurt, Tyskland, i UpClouds europe-2-region for objektlagring. En nedlasting sender forespørselsdetaljer, ikke inndataene modellen senere behandler |
| Konfigurert identitetsleverandør | Google, GitHub eller en driftsansvarligs OIDC-leverandør | Pålogging følger den leverandørens policy. Spør instansens driftsansvarlige om vertsnavn, region og overføringsordninger |
| Konfigurert ressursleverandør | Brandfolder eller et annet bibliotek driftsansvarlig velger | Leverandøren mottar tillatte bibliotekforespørsler. Kildetillatelsene og instansens policy styrer tilgangen; spør driftsansvarlig om vertsnavn og regioner |
| E-postregistrering, når konfigurert | Resend leverer den forespurte påloggingslenken | Mottar mottakeradressen for den meldingen; leverandørens egne behandlingsvilkår gjelder |

Referanseapplikasjonen bruker ingen annen hosting, database eller leverandør for misbrukskontroll. En driftsansvarlig kan velge andre leverandører for en annen instans, og leverandører av hosting, identitet, ressurser og e-post trenger hver sin åpenhet. Modellvertens [region for objektlagring](https://upcloud.com/docs/products/managed-object-storage/availability/) verifiseres separat fra applikasjonens region.

**Valgfrie prinsipalbundne nedlastingslenker for MCP.** En driftsansvarlig kan slå på nedlastingslenker for store resultater på en autentisert gateway med én replika. De er av som standard. Den anonyme gatewayen på `lolly.tools/api/mcp` returnerer resultater direkte og utsteder aldri disse lenkene. Det planlagte begrensede vertsnavnet er `mcp.lolly.tools`, hos samme UpCloud-databehandler i Frankfurt; aktiveringen venter, og denne siden hevder ikke at det finnes en levende tjeneste for nedlastingslenker. Lenkene legger ikke til noe tredjeparts CDN.

Bare en autentisert kaller med et filomfang kan motta en lenke, og den samme kallerens bærertoken kreves for å hente den: bruk det validerte bærertokenet fra gjengivelseskallet, ikke et annet token for samme konto. Tildelingen utløper innen 300 sekunder. Eierskap og resultatoppslag blir i gatewayens minne, og utdatabytene går til private midlertidige filer, ryddet etter utløp eller fjernet ved ren avslutning. En omstart av gatewayen ugyldiggjør eksisterende lenker. Holdte resultater er begrenset til 64 MiB per bærer, 256 MiB på tvers av gatewayen og 200 ventende eller holdte filer. Daglige budsjetter for CPU og dekodede bytes teller resultater når de holdes og når de lastes ned. Svar bruker `private, no-store` og `Referrer-Policy: no-referrer`. En lenkes token alene lar ikke en annen person eller agent lese resultatet.

## Infrastrukturlogger

Denne delen beskriver den offentlige lolly.tools-installasjonen. Hostingplattformen registrerer vanlige forespørselsdetaljer: IP-adresse, forespurt sti, tidsstempel og user agent. Lokale redigeringer når ikke den verten. Spørringsstrengen i en gjengivelseslenke kan inneholde teksten den som kalte, oppga, som forklart ovenfor. MCP-filverktøy behandler bytene de får i minnet. En Lolly Work-instans holder også postene beskrevet ovenfor, under driftsansvarliges loggpolicy.

**De offentlige tjenestene holder applikasjonsloggingen på et minimum.** MCP-serveren logger oppstart, konfigurasjon og gjengivelsesadvarsler; den fører ingen egen forespørselslogg og logger ikke tokener eller kalleradresser. Penpot-gjennomgangen logger hvert kommandonavn og Penpots svarstatus, aldri topptekster, tokener eller filen. Sertifikattjenesten logger oppstartsinnstillingene og konfigurasjonsadvarsler, pluss to avstrippede linjer ved feil: en statuskode for sendingsfeil uten mottakeradresse, og en fast feillinje uten feiltekst, stakksporing eller URL, fordi en leverandørfeil kan bære identitetsverdier eller legitimasjon. Alt annet i loggen kommer fra hostingplattformen.

For lolly.tools styrer instansadministratoren forespørselslogging, rotasjon og oppbevaring hos UpCloud. Denne siden oppgir ikke en maksimal loggoppbevaringstid som ikke er verifisert. Kontakt den behandlingsansvarlige nedenfor for gjeldende ordning og for enhver forespørsel om logger holdt på serveren. For en annen instans gjelder driftsansvarliges innstillinger, inkludert eventuelle logg-eksporter eller andre databehandlere.

## Rettslig grunnlag, lagringstid og mottakere

Denne tabellen dekker referanseinstallasjonen **lolly.tools**. Den oppgir ikke rettslig grunnlag eller oppbevaringstider for organisasjonens Lolly Work-instans; driftsansvarlig oppgir dem i sin egen policy.

| Behandling | Rettslig grunnlag (GDPR art. 6) | Oppbevart i |
|---|---|---|
| Alt på enheten din (dokumenter, innstillinger, hurtigbuffer, tellere) | **Ikke vår behandling i det hele tatt**: det når oss aldri. Lagring på enheten din er strengt nødvendig for tjenesten du ba om (ePrivacy art. 5(3)), så det krever ikke samtykke | Til du sletter det |
| E-postadressen din ved eldre vertsbasert registrering for Content Credentials | **Art. 6(1)(b)**, oppfyllelse av en tjeneste du uttrykkelig ba om | Ingen identitetsoversikt eller utstedelseslogg i den eldre tjenesten; e-posten brukes under forespørselen og tas med i sertifikatet ditt. Oppbevaring av administrert organisasjons-PKI, revisjon og tilbakekalling følger driftsansvarliges policy |
| En pseudonym SHA-256-sammendragsverdi laget av IP-adressen din, for hastighetsbegrensning av påloggingsendepunktene og de offentlige endepunktene for gjengivelse, bilde og MCP | **Art. 6(1)(f)**, vår berettigede interesse i å hindre misbruk av en gratis tjeneste og av en tredjeparts e-postkvote. Vi mener dette består en interesseavveining fordi den rå adressen ikke sendes til begrenseren, sammendragsverdien bare brukes til misbrukskontroll og den utløper av seg selv | Omtrent ett minutt i lagringen for misbrukskontroll; ikke beholdt etterpå |
| Tilgangslogger hos hostingtjenesten (IP, sti, tidsstempel, user agent) | **Art. 6(1)(f)**, vår berettigede interesse i tjenestesikkerhet, forebygging av misbruk og feilsøking | Rotasjon og oppbevaring konfigurert av administrator; kontakt den behandlingsansvarlige for gjeldende ordning |

**Mottakere.** Mottakerkategoriene er hostingleverandøren vår (UpCloud), som huser applikasjonens database og lagringen for misbrukskontroll, og, bare hvis du bruker e-postpåloggingen, en leverandør av transaksjonelle e-poster (Resend). Lagringen for misbrukskontroll mottar bare kortlevde sammendragsverdier, aldri den rå IP-adressen. Hvis du logger på med GitHub, Google eller SUSE (id.suse.com), forholder du deg direkte til den leverandøren under deres egen personvernerklæring, og de forteller oss en verifisert e-postadresse og ingenting annet. Vi deler personopplysninger med ingen andre, og vi selger ikke data, viser ikke reklame og profilerer ikke brukere.

**Overføringer utenfor EØS.** Referanseapplikasjonens hosting, database og fillagring ligger i Frankfurt. Valgfrie leverandører av identitet, e-post og ressurser har egne behandlingssteder og vilkår, som kan omfatte tilgang utenfor EØS, og en servers region alene fastslår ikke hver mottakers jurisdiksjon. Kontakt den behandlingsansvarlige for leverandøravtalene og overføringsordningene som gjelder; for en annen instans, spør driftsansvarlig. EU-kommisjonens [standardkontraktsbestemmelser](https://commission.europa.eu/law/law-topic/data-protection/international-dimension-data-protection/standard-contractual-clauses-scc_en) er ett tilgjengelig vern for slike overføringer; denne siden hevder ikke at en uverifisert leverandøravtale bruker dem.

**Automatiserte avgjørelser.** Ingen. Det er ingen profilering og ingen automatisert avgjørelse med rettslige eller tilsvarende betydelige virkninger (art. 22).

## Barns personvern

Vanlig lokal bruk av appen sender ikke noe personlig innhold til lolly.tools. Den valgfrie registreringen for Content Credentials mottar en e-postadresse og er ikke rettet mot eller ment for barn. Organisasjonstjenester har egne kontoer og datahåndtering, under driftsansvarliges policy.

## Dine rettigheter

For poster som bare lagres på enheten din, kan du selv få innsyn i, rette, slette og flytte dataene. De ligger i nettleserens eller appens lagring, i en form du kan inspisere, eksportere (**Export my data**, ovenfor) eller slette (**Clear all my data**, eller nettleserens nettstedsdata).

Formelt har du etter GDPR artikkel 15-22 rett til **innsyn** i personopplysningene dine, til å **rette** dem, til å **slette** dem, til å **begrense** eller **protestere mot** behandlingen (inkludert alt vi baserer på berettigede interesser), til **dataportabilitet** og, der behandlingen bygger på samtykke, til å **trekke samtykket tilbake når som helst**, uten at det påvirker lovligheten av det som skjedde før du trakk samtykket tilbake.

Den offentlige sertifikattjenesten fører ingen utstedelseslogg. Infrastrukturlogger kan inneholde forespørselsdetaljer, så denne policyen lover ikke at hostingmiljøet ikke holder noen personopplysninger. Kontakt den behandlingsansvarlige for innsyn, sletting eller en annen forespørsel om disse postene; vi forklarer hvilke poster som finnes og hva som kan gjøres. For arbeid, identiteter, telemetri og revisjonsposter som en organisasjon holder, kontakt Lolly Work-driftsansvarlig, fordi lokale eksport- og slettekontroller ikke når de kopiene.

**Du har rett til å klage.** Hvis du mener vi har behandlet dataene dine feil, kan du sende en klage til en tilsynsmyndighet for personvern: i EU, myndigheten i landet der du bor, arbeider eller der du mener bruddet skjedde (art. 77). Vår ledende tilsynsmyndighet er *Bayerisches Landesamt für Datenschutzaufsicht* (BayLDA) i Ansbach, Tyskland. Du trenger ikke kontakte oss først, men vi vil gjerne få sjansen til å rette opp problemet.

## Endringer i denne erklæringen

Datoen øverst endres hver gang dette dokumentet endres. En endring som endrer hva som forlater enheten din eller hva som beholdes, får sin egen linje her i stedet for en stille redigering. For å se hva som er endret, spør (nedenfor) eller sammenlign med [den offentlige kilden](https://github.com/lolly-tools/lolly/commits/main/docs/privacy.md).

**29. september 2026:** presisert den valgfrie tjenesten lolly.work, innholdet organisasjonen holder der, autentiseringsinformasjonskapsler, bruks-telemetri og revisjonsposter, og skillet mellom lokal sletting og serveroppbevaring. Dette er eksisterende valgfrie arbeidsflyter, ikke et nytt opplastingskrav for lokal redigering.

**11. oktober 2026:** erstattet den utgåtte beskrivelsen av Vercel-hosting med oversikten over UpCloud-applikasjonens vertsnavn, skilt ut valgfrie identitets- og ressursleverandører, og beskrevet innholdsadressert levering og modusen for holdte MCP-nedlastinger. Ingen tredjeparts CDN aktiveres av denne endringen. Loggoppbevaring styres av administratoren i stedet for en oppgitt Vercel-standard for abonnementet.

**22. oktober 2026:** rettet beskrivelsen av eksisterende oppførsel. Delen om nettleserutvidelsen dekker nå godkjenningsvinduet for hver forespørsel, nettstedstilgang som spørres om ett nettsted om gangen og hentingen av stilark og ikoner ved lesing av et nettsted. Også rettet: radene for Send til Google Drive og Meeting Planner, SEAL-merknaden (ingen Lolly-app slår opp SEAL-nøkler i DNS), standardnivået for bruks-telemetri i organisasjonstjenesten, MCP-bildeverktøyene og applikasjonsloggingen til de offentlige tjenestene. Selve programvaren endret seg ikke.

**23. oktober 2026:** omorganiserte policyen etter hva som starter hver forespørsel, og beskrev eksisterende oppførsel den ikke dekket før: private collab-invitasjoner som bærer lokale nettverksadresser, Nearby i skrivebordsappen, Allow AI control, lesing av et designsystem fra et nettsted, emoji-sett, Meeting Planners hurtigbuffer på enheten for bysøk, papirkurven og de andre postene Settings → Storage lister. Rettet to påstander: Bluesky og Discord er ikke bare for skrivebord, og hver vert en person velger for sending, trenger driftsansvarliges godkjenning i både nett- og skrivebordsappene; sammendragsverdien av en IP-adresse som brukes til hastighetsbegrensning er pseudonym, ikke anonym. Selve programvaren endret seg ikke.

## Hvem er ansvarlig, og hvordan nå oss

**Behandlingsansvarlig** for lolly.tools er:

> SUSE Software Solutions Germany GmbH
> Frankenstraße 146
> 90461 Nürnberg
> Tyskland

SUSE har utnevnt en **personvernombud**, som kan nås på [privacy@suse.com](mailto:privacy@suse.com). Bruk den adressen for enhver formell forespørsel etter "Dine rettigheter" ovenfor.

For alt om selve Lolly, som hvordan det fungerer, hvorfor noe er som det er eller en rettelse til dette dokumentet, kontakt **Andy Fitzsimon**, [fitzy@suse.com](mailto:fitzy@suse.com).

For en selvhostet Lolly-instans eller en bedriftsinstans, kontakt den som driver den i stedet: driftsansvarlig er behandlingsansvarlig for sin egen installasjon. SUSE og åpen kildekode-prosjektet Lolly holder ingen data for installasjoner de ikke driver.
