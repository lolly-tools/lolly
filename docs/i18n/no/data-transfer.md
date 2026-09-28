# Dataoverføring - `lolly-backup`-pakken

Alt en Lolly-bruker samler seg opp, lever **på enheten deres** - ingen konto, ingen sky. Dataoverføringspakken er hvordan den verdien flytter seg: eksporter den på én installasjon, bær filen på hvilken som helst måte (USB, AirDrop, e-post til deg selv, en nettverksdeling) og importer den på en annen. Filen *er* transporten. Målet kan være offline eller online. Det spiller ingen rolle, fordi ingenting noensinne snakker med en server.

![De to knappene som flytter en hel installasjon: Eksporter dataene mine skriver én zip, Importer data leser den tilbake](/t/url-shot?url=%2F%23%2Fsettings%3Ffocus%3Dstorage-section&width=1440&height=1800&dpi=192&waitMs=2400&css=.store-manages%7Bdisplay%3Anone%7D&walker=1&format=svg&cropSelector=%23storage-section%20.storage-subsection&dark=1&filename=pd-transfer-controls)

Denne siden er formatspesifikasjonen. For gjennomgangen for sluttbrukeren, se [Finn og gjenopprett arbeidet ditt → Flytt arbeidet ditt til en annen enhet](/info/find-your-work.html#move-your-work-to-another-device). Implementasjonen er [`shells/web/src/data-transfer.ts`](../shells/web/src/data-transfer.ts), og [`tests/data-transfer.test.ts`](../tests/data-transfer.test.ts) fastsetter kontrakten for tur-retur.

> **Omfang.** En pakke bærer *brukerdata*, ikke katalogverktøy. Katalogverktøy og katalogressurser synkroniseres separat og antas allerede å være til stede på målet (i verste fall i en høyere versjon); verktøy en bruker har laget selv, reiser inni `profile.json`. Import installerer eller oppgraderer aldri et katalogverktøy.

## Mål

- <!--i:box--> **Ett format, alle shells.** Web-PWA-en, Tauri-appene for desktop/mobil og fremtidige shells deler samme konvolutt og samme skjema for delene de støtter. Valgfrie deler avhenger av hvert shells kapabiliteter; deler som ikke støttes, rapporteres. Hver kapabilitetsbro leverer sin egen lagringsadapter.
- <!--i:shieldcheck--> **Overlever turen.** En pakke som blir ødelagt eller avkuttet under transport, feiler høylytt ved import, aldri en halv gjenoppretting.
- <!--i:clock--> **Overlever denne versjonen.** En eldre app kan fortsatt importere en nyere pakkes gjenkjente deler. Et virkelig brytende format avvises rent.
- <!--i:check--> **Trygt å slå sammen.** Import til en installasjon som allerede er i bruk, sletter aldri noe som ikke var i pakken.

## Konvolutten

En pakke er en vanlig `.zip`. Nedlastingen navngis etter personen den tilhører - `LollyTools-<First>-<Last>-<YYYY-MM-DD>-<n>.zip` (for eksempel `LollyTools-Ada-Lovelace-2026-06-26-1.zip`) - slik at en Nedlastinger-mappe full av sikkerhetskopier holder seg lesbar. Fornavn- og etternavndelene kommer fra profilen og utelates når de ikke er angitt. Uten profil blir det `LollyTools-2026-06-26-1.zip`, og et fornavn alene gir `LollyTools-Ada-2026-06-26-1.zip`. Hver del saneres til et filnavn-sikkert token (Unicode-bokstaver/-tall beholdes, mellomrom/tegnsetting fjernes, maks 32 tegn). `<n>` er et sekvensnummer per dag per enhet, slik at gjentatte eksporter samme dag ikke kolliderer og forblir i rekkefølge. `backupFilename()` i [`shells/web/src/data-transfer.ts`](../shells/web/src/data-transfer.ts) bygger navnet. Zip-filens innhold er identisk uansett navn. Inni:

| Sti | Påkrevd | Innhold |
|---|---|---|
| `manifest.json` | ja | Format-id, versjoner, antall og integritet per del. Det første en leser ser på. |
| `profile.json` | når satt | Brukerens hele `me`-post: navn, kontakt, portrettbilde-referanse og flagg, pluss mapper, Papirkurv, prosjektmaler, brukermaler og brukerlagde verktøy, favoritter, skjulte verktøy, språk- og emoji-valg. Leses via `host.profile`. |
| `sessions.json` | ja | Hver lagrede sesjon: plass, verktøy-id/versjon, etikett, miniatyrbilde (data-URL) og fullstendige inputdata. Leses via `host.state`. |
| `assets.json` | ja | Metadata for hver opplastet ressurs (bilder, fonter, merkevaretokener, logoer, lagrede kopier av nedlastinger), hver med peker til bytene sine under `assets/blobs/`. |
| `assets/blobs/<n>.<ext>` | per ressurs | De rå ressursbytene (bilde- og fontfiler). Lagret ukomprimert (allerede komprimerte formater). Filendelsen er kosmetisk. MIME-typen i `assets.json` er autoritativ. |
| `assets/blobs/<n>.c2pa` | når til stede | Ekstraherte Content Credentials som eksakte binære byte, referert av `_credentialFile` i ressursposten. Dette er ikke enhetens signeringsnøkler. |
| `design-systems.json` | når til stede | Designsystemene som er laget eller lagt til på denne installasjonen, som `{ active, records }`. Slås sammen etter id ved import; pakkens aktive valg gjelder bare når målet ikke har noe eget designsystem. |
| `file-history.json` | valgfritt | Versjonerte ressurs-øyeblikksbilder, terminalens filoperasjonsrapporter og komplette batch-manifester. Historikkdelen har sin egen versjon; leveres av shellets interne sikkerhetskopi-adapter `fileHistory`. |
| `revision-history.json` | valgfritt, manuelle sikkerhetskopier | Stabile kreasjons-ID-er, bevarte sjekkpunkter, miniatyrer og rullerende gjenopprettingsutkast. Leveres av `host.state.history.backup` der det støttes. |
| `file-history/versions/` | per øyeblikksbilde | Tidligere ressursbyte og ekstraherte credentials, uavhengig av om den gjeldende ressursen fortsatt finnes. |
| `file-history/results/` | per fullført operasjon | Eksakte utdatabyte. Ingen opprinnelig fil valgt for konvertering beholdes eller inkluderes. |
| `prefs.json` | ja | Brukereide lokale innstillinger: `theme`, `sidebarWidth` og `ct-metrics`-aktivitetstellingen. |
| `lolly.txt` | ja | Et menneskelesbart sammendrag av pakken (antall, profil, filnavn) for alle som åpner zip-en uten Lolly. Regenereres ved hver eksport og gjenkjennes ved import, så den regnes aldri som en hoppet-over del. Den skrives *etter* integritetskartet, så den holdes utenfor det. |

Pakken er en vanlig zip med hensikt: den overlever enhver transport intakt, og ethvert utpakkingsverktøy kan inspisere den.

`profile.json` er den minste delen og den en leser ser først i appen: detaljene en produsent fyller inn én gang, pluss opt-inen som lar verktøy bruke dem.

![Skjemaet med profildetaljer som blir profile.json: navn, kontaktopplysninger og profilbilde](/t/url-shot?url=%2F%23%2Fsettings%3Ffocus%3Ddetails-section&width=1440&height=1100&dpi=192&waitMs=1800&format=svg&cropSelector=.profile-details-grid&walker=1&dark=1&filename=ce-profile-record)

## `manifest.json`

```json
{
  "format": "lolly-backup",
  "formatVersion": 3,
  "minReader": 1,
  "app": "lolly",
  "exportedAt": "2026-06-22T09:30:00.000Z",
  "counts": { "profile": true, "sessions": 2, "userAssets": 4, "prefs": 3, "assetVersions": 1, "fileOperations": 1 },
  "integrity": {
    "profile.json": "sha256-…",
    "sessions.json": "sha256-…",
    "assets.json": "sha256-…",
    "assets/blobs/0.bin": "sha256-…",
    "file-history.json": "sha256-…",
    "file-history/versions/0.bin": "sha256-…",
    "file-history/results/0.bin": "sha256-…",
    "prefs.json": "sha256-…"
  }
}
```

| Felt | Betydning |
|---|---|
| `format` | Alltid `lolly-backup`. En fil uten det avvises som «not a Lolly backup». |
| `formatVersion` | Layouten denne pakken ble **skrevet** med. Heves ved enhver endring av delsettet eller formene. Lesere sjekker **ikke** mot denne. |
| `minReader` | Minste leserversjon som kreves for å importere denne pakken **trygt**. Dette er feltet lesere sjekker mot. |
| `app` | Produserende app-id, for diagnostikk. |
| `exportedAt` | ISO-tidsstempel for når pakken ble laget. |
| `counts` | Hva skriveren la inn, for visning og fornuftssjekk. |
| `integrity` | Valgfritt. Kobler hver del unntatt `manifest.json` til en SRI-lignende `sha256-<base64>`-digest av dens **ukomprimerte** bytes. |

## Versjonspolicy (fremoverkompatibilitet)

Delingen mellom `formatVersion` og `minReader` er det som lar formatet vokse uten å etterlate eldre installasjoner:

- En leser importerer en pakke når `manifest.minReader ≤` sin egen leserversjon. Den nekter (med «needs a newer version of the app») kun når pakken eksplisitt krever en nyere leser.
- En **additiv** endring - en ny *valgfri* del, eller et nytt valgfritt manifestfelt - hever `formatVersion`, men lar `minReader` være uendret. Eldre apper importerer fortsatt hver del de gjenkjenner. Deler de ikke gjenkjenner, hoppes over (se nedenfor), ikke droppes stille.
- En **brytende** endring - en der feil import av en del ødelegger data, eller der en tidligere valgfri del blir obligatorisk - hever `minReader`. Eldre apper nekter da rent i stedet for å importere noe de ikke kan håndtere.
- Hvis en fremtidig pakke setter `formatVersion`, men utelater `minReader`, faller lesere konservativt tilbake til å sjekke mot `formatVersion` (behandler endringen som brytende).

> **Tommelfingerregel for forfattere:** hvis enhver eksisterende leser fortsatt ville gjort det riktige ved å ignorere tilføyelsen din, er den additiv - hev `formatVersion`, la `minReader` være. Ellers hev `minReader`.

## Integritet

Når `manifest.integrity` er til stede, verifiserer en leser hver oppførte dels SHA-256 **før noe skrives**. Et avvik («failed its integrity check») eller en manglende del («incomplete») avbryter hele importen - det finnes ingen delvis gjenoppretting. Dette fanger opp korrupsjonen en filtransport kan innføre (en avkuttet AirDrop, en e-postgateway som har omkodet vedlegget, en dårlig USB-sektor).

Integritet er beste innsats med hensikt: den skrives kun der Web Crypto er tilgjengelig (enhver sikker nettleserkontekst og moderne Node), og verifiseres kun når både kartet og Web Crypto er til stede. En pakke uten kartet - for eksempel en fra før integritet fantes - importeres uendret. «Cannot verify» behandles aldri som «corrupt».

Manifestet lister verken seg selv eller den regenererte `lolly.txt`-README-en. Digestene dekker delene manifestet går god for.

## Importsemantikk

Import er en sammenslåing, aldri erstatt-alt:

- Eksisterende data på målet forblir på plass.
- Når en øktplass eller en opplastet bilde-id finnes på begge, beholdes kopien som ble lagret sist, slik at en eldre sikkerhetskopi aldri overskriver nyere arbeid på målet. Like eller ukjente tidspunkter beholder målets kopi. På en nettinstallasjon med kreasjonshistorikk avgjør samme regel hvilken kopi av en kreasjon som forblir gjeldende, og den andre kopien beholdes som et beskyttet utkast (se nedenfor).
- Profilposten slås sammen, erstattes ikke. Hver mappe på målet beholder innholdet sitt; en mappe fra pakken som målet mangler, legges til, og en mappe som finnes på begge, beholder målets navn og overordnede mappe og får pakkens medlemmer den mangler. En økt arkivert i en mappe på målet forblir arkivert der.
- Favoritter (verktøy, katalogressurser og elementer i Prosjekter) kombineres. Maler, Prosjekter-maler og brukerverktøy fra pakken legges til når målet mangler en post med den ID-en. Papirkurv-oppføringer fra begge beholdes, slik at et element som kan gjenopprettes på en av installasjonene, fortsatt kan det.
- Alle andre profilfelt (navn, kontaktopplysninger, språk, feature flags, skjulte verktøy og de andre innstillingene) beholder målets verdi. Et felt som er tomt på målet, får pakkens verdi. Det samme gjelder `prefs.json`: en innstilling skrives bare der målet ikke har noen.
- Enhetssynkens vanlige anvendelse er unntaket: for å holde enhetene i takt tar den den synkroniserte kopiens profilpost, innstillinger, økter og bilder. Å gjenopprette en tidligere kopi gjør det samme, siden den bevisst går tilbake i tid. Den første tilkoblingen, **Hent hit til denne enheten**, slår sammen som en import.
- Historiske ressursversjoner og operasjons-ID-er er uforanderlige unntak: en gjentatt import er idempotent, og en ID som allerede navngir andre byte/annen historikk, avvises, overskrives ikke. Å importere en identisk gjeldende ressurs på nytt bevarer versjonen dens. En endret gjeldende ressurs må ha en annen versjon.
- Kreasjonshistorikk slås også sammen. En kreasjon på begge sider beholder kopien som ble lagret sist som gjeldende, og den andre kopien som et beskyttet utkast; en kreasjon hvis plass målet bruker til en annen kreasjon, legges til ved siden av den; en kreasjon i målets Papirkurv blir værende der. En sjekkpunkt-ID som navngir annet innhold på målet, beholder målets. Et arkiv som mislykkes i sine egne kontroller, stopper importen før noen endring av profil, økt, ressurs eller innstilling. En identisk gjentatt import legger ikke til lagring.
- Ingenting som ikke var i pakken, røres. En økt målet hadde, men pakken ikke hadde, overlever importen.

Lagrede sesjoner kobles automatisk sammen med bildene sine igjen: ressursreferanser holdes med id, og broen løser dem opp på nytt etter at de opplastede bildene er gjenopprettet (den må uansett det, fordi `blob:`-URL-er ikke overlever en omlasting).

Importsammendraget rapporterer `{ profile, sessions, userAssets, prefs, skipped, failedAssets }`. `failedAssets` teller opplastede ressurser som ikke kunne gjenopprettes (enhetslagring full, for eksempel). Det er atskilt fra `skipped`, som teller deler fra en fremoverkompatibel nyere skriver som denne buildjen ikke gjenkjente. UI-en viser `skipped` («… · N newer items skipped»), så gjenopprettingen er ærlig om hva den lot ligge.

Når filhistorikk er til stede, bærer sammendraget også `assetVersions`, `fileOperations` og `failedHistory`. Uttømt lagring eller uforanderlige ID-konflikter kan forårsake en delvis gjenoppretting; brukergrensesnittet ber brukeren beholde kildesikkerhetskopien. Skysynk flytter **ikke** fram sin anvendte revisjon etter en delvis eller ustøttet gjenoppretting, slik at øyeblikksbildet forblir tilgjengelig for et nytt forsøk. Gjenoppretting er ikke én enkelt transaksjon på tvers av alle profil-/økt-/ressurs-/historikklagre.

## Kreasjonshistorikk (v3)

Manuelle sikkerhetskopier fra en historikkapabel nettvert inkluderer `revision-history.json` med sitt eget skjema `{ version: 1, documents, revisions, recoveries }`. Den bærer de bevarte ID-ene, kanoniske inndata-øyeblikksbilder, versjonsstempler, rasterforhåndsvisninger og separate skriverutkast. Historikkadapteren fanger gjeldende økter og hodene deres i én lese-transaksjon; `sessions.json` bruker de samme gjeldende øyeblikksbildene for eldre lesere.

Gjenoppretting sjekker nyttelastens SHA-256 og bytetall, unike identiteter, dokument-/hode-relasjoner, avstamning, tidsstempler, forhåndsvisningstyper og grenser før arkivet forpliktes i én transaksjon. Komprimerte foreldrereferanser kan mangle. Eksisterende gjeldende arbeid erstattes aldri stille: når en kreasjon finnes på begge sider, blir siden som ikke holdes gjeldende, et beskyttet utkast. Arkivets overføringsgrense på 384 MiB sjekkes eksplisitt, og lagringsgrenser håndheves uten å kutte bevarte sjekkpunkter. Hele sikkerhetskopien bruker fortsatt en in-memory ZIP-implementasjon og er ikke et strømmende arkiv.

Sammendraget legger til `revisions` og `recoveryDrafts`, som bare teller det denne importen la til, samt `added`, `kept`, `replaced`, `copies` og `hidden` for hvordan hver kreasjon ble slått sammen. Et shell uten denne kapabiliteten gjenoppretter vanlige økter og rapporterer historikkdelen som hoppet over. Historikk for det native filsystemet forblir ustøttet inntil adapteren dets leverer varige historikktransaksjoner. P2P-gjestetilstand har ingen varig historikk eller noe gjenopprettingsarkiv.

Personlig øyeblikksbildesynk ekskluderer eksplisitt kreasjonshistorikk. Å bruke et øyeblikksbilde på et lokalt dokument med historikk bevarer dets tidligere arbeidstilstand som et separat gjenopprettingsutkast og ugyldiggjør en åpen redigerers skrivetoken. De uforanderlige sjekkpunktene dens blir værende på enheten. Dette beskytter lokal historikk under utskifting av øyeblikksbilde; det slår ikke sammen samtidige enheters historikk.

Historiske ressursreferanser beholdes, mens rendring fortsatt løser ressurser via målets eksisterende bibliotek. Dette arkivet garanterer ennå ikke eksakte gamle ressursbyte eller gamle verktøyrendringer. Byte for ressursversjoner og filresultater fortsetter å reise via sin eksisterende separate sikkerhetskopi-del.

## Lagrede versjoner og filresultater (v2)

Den valgfrie historikkdelen inneholder `{ version: 2, assetVersions: [...], operations: [...], batches: [...] }`; lesere godtar også den tidligere history-v1-formen uten batcher. Hvert øyeblikksbilde identifiserer den stabile ressurs-ID-en og den eksakte versjonen, lagringstidspunktet, bytelengden og hex-SHA-256, pluss en ressurspost hvis `_file` og valgfrie `_credentialFile` peker på binære deler. Operasjoner bærer de opprinnelige filfaktaene, forespørselen, rapporten, tidsstemplene og en valgfri resultat-`_file`; navn på lagringsbackend, OPFS-håndtak og kjøringsleaser følger ikke med. Eldre lesere som bare kjenner history-v1, avviser den nye historikkversjonen før import, i stedet for stille å droppe batch-medlemskap.

Batch-manifester registrerer hver valgte kilde før behandling, inkludert filer som aldri er lest, avbrutte medlemmer, mislykkede forsøk på å reservere resultatplass og avbrutt arbeid. Hvert medlem har en stabil operasjons-ID, kildereferanse/-fakta, forespurt utdatanavn og terminalrapport. En ulest kilde har deklarerte fakta, ikke en oppdiktet digest. Import validerer medlemsidentitet og konsistens mot en eventuell medfølgende operasjonsrapport. Batch-rapporter forblir tilgjengelige når enkeltresultater eksplisitt er fjernet, men en kvittering innebærer ikke at utdatabytene dens fortsatt er lagret.

- Hver kjente historikkpost, rapport og refererte fil valideres før noen profil- eller ressursimport skriver. Manglende byte og avvikende SHA-256 feiler selv om konvolutten ikke har noe integritetskart. Ekstraherte credentials forblir byte-arrayer, inkludert importer fra eldre skrivere som JSON-serialiserte dem som objekter med numeriske nøkler.
- Pågående operasjoner blir avbrutte poster i sikkerhetskopien, med en forklarende feilrapport og ikke noe resultat. Gjenoppretting starter aldri bakgrunnsarbeid på nytt eller importerer en aktiv lease. Å prøve på nytt krever at man velger originalfilen, kontrollert mot dens registrerte SHA-256 når den er tilgjengelig.
- Gjenopprettede resultater forplikter bytene og metadataene sine sammen i IndexedDB. Vanlige nye resultater bruker OPFS der det finnes, med IndexedDB som reserve. En eksisterende aktiv operasjon erstattes aldri av en import.
- ZIP-sammenstillingen for historikk skjer fortsatt i minnet: den nåværende grensen er **256 MiB historikk-nyttelast**, **4 MiB historikkmetadata**, høyst **100 operasjoner**, **100 batcher** og **2000 øyeblikksbilder**. Eksport avviser eksplisitt historikk som er for stor eller ufullstendig; den utelater den aldri i stillhet. Last ned viktige versjoner/resultater individuelt før du fjerner eldre lokale kopier. Disse grensene er ingen målt topp-minne-garanti for telefoner.
- Lokal resultathistorikk har et budsjett på 512 MiB og et tak på 100 poster. Ressurs-øyeblikksbilder har et separat budsjett på 512 MiB og høyst 20 historiske versjoner per ressurs; ekstraherte credential-byte teller mot det øyeblikksbildebudsjettet. Gjenoppretting respekterer disse grensene og kaster aldri stille ut eksisterende brukerdata.
- Lokal batch-metadata har et separat budsjett på 4 MiB, høyst 100 manifester og 20 medlemmer per batch. Ventende medlemmer reserverer metadatakapasitet, med et tak på 32 KiB per medlemsrapport. Dette er et logisk budsjett, ingen garanti for nettleserens diskplass; en reell kvotefeil vises, og rapporten i minnet forblir nedlastbar. Å prøve et batch-medlem på nytt oppretter en ny batch uten å overskrive den gamle rapporten. Å fjerne en batch-post fjerner ikke enkeltresultatbyte eller biblioteksressurser.
- Konverterte resultater kan eksplisitt legges til i biblioteket uten normalisering eller re-koding. Kilde-/utdata-hasher og operasjonsrelasjonen følger ressursen. Gjentatte tillegg gjenbruker en uendret kopi; en redigert kopi overskrives aldri. Rasterbilder kan starte et nytt Design-dokument. Det dokumentet bruker den gjeldende biblioteksressurs-ID-en: å håndheve eksakte versjonslåsinger gjennom hele Designs kjøretid og URL-sti er fortsatt separat arbeid. SVG-/HTML-/PDF-/ZIP-resultater holdes som opake filressurser av denne overleveringen, forfremmes ikke til betrodd interaktivt/vektorinnhold.
- **Convert → Recent file operations** eksponerer historikkbruk, rapporter, nedlastinger og versjonsbehandleren. Behandleren finner også tidligere versjoner av slettede biblioteksressurser. Å gjenopprette et øyeblikksbilde oppretter en ny gjeldende versjon mens det valgte øyeblikksbildet forblir intakt. **Innstillinger → Lagring** fører resultater og versjoner separat fra engangsbuffer.
- Eksplisitt opprydding av midlertidige filer fjerner bare byte som eies av en operasjon og ikke lenger er referert. Gjeldende poster beskytter filene sine; nylige OPFS-filer har en frist på én time. Lagrede resultater og ressurs-øyeblikksbilder ryddes ikke automatisk.

Eldre lesere godtar fortsatt v2-konvolutten (`minReader: 1`) og gjenoppretter kjente deler, og teller historikkdeler som ikke støttes, som hoppet over. Full historikkgjenoppretting krever et shell med `fileHistory`-adapteren; dette er en shell-intern skjøt, ikke en ny verktøyvendt `HostV1`-kapabilitet. Reell gjenoppretting mellom to enheter dekkes av den lokale Chromium-porten; godkjenning av gjenoppretting i installerte Tauri-/iOS-/Android-apper forblir separat.

## Hva som ikke følger med

- **Katalogbufre** (nedlastet ressursmetadata og blobs, verktøyindeksen) - synkroniseres gratis på nytt på målet.
- **Katalogverktøy og katalogressurser** - utenfor omfanget, og antas allerede å være til stede på målet. Merkevaretokener, fonter og logoer brukeren har lagt til, er brukerressurser, så de reiser med.
- **`blob:`- / objekt-URL-er** - regenereres av broen ved lasting.
- **Konverteringsoriginaler, aktive kjøringsleaser og maskinlokale tilgangs-/signeringshemmeligheter** - ikke portabel historikk-nyttelast. Et lagret resultat er en kopi, ikke et løfte om at originalkilden ble sikkerhetskopiert.
- **Eksportsekvenstelleren** - den daglige nedlastingsnavngivningstelleren per enhet (`localStorage`-nøkkelen `lolly-export-seq`) er en lokal navngivningsbekvemmelighet. Den holdes utenfor `PREF_KEYS`, så den følger aldri med i en pakke.

Lagringsmåleren viser den samme oppdelingen kategori for kategori. Lagrede sesjoner, Mine bilder og File results & versions følger med i en pakke. Ressursbufferen, verktøyforhåndsvisningene og offline-pinnene under dem er alle avledbare på nytt, så de blir igjen.

![Lagringsmåleren som deler denne enhetens data inn i navngitte kategorier, med Saved sessions og My images sporet separat fra Asset cache, her på en fersk installasjon der hver kategori fortsatt er tom](/t/url-shot?url=%2F%23%2Fprofile%3Ffocus%3Dstorage-section&width=1440&height=1600&dpi=192&waitMs=2600&format=svg&css=.store-manages%2C.storage-subsection%2C.store-selbar%7Bdisplay%3Anone%7D&cropSelector=.store-meter&walker=1&dark=1&filename=ce-storage-categories)

## Kryssgaranti mellom shells

`data-transfer.ts` leser og skriver utelukkende via kapabilitetsbroen (`host.profile`, `host.state`, `host.assets`) og de delte `localStorage`-innstillingene. Den samme modulen leser og skriver den felles konvolutten på nett og Tauri, over IndexedDB eller filsystemlagring. Valgfrie historikkdeler vises bare der den tilsvarende adapteren er tilgjengelig; en del som ikke støttes, rapporteres som hoppet over ved import. Den hodeløse testsuiten kjører de felles delene mot en in-memory-bro, mens historikktransaksjoner også har tester i en ekte nettleser.

To shell befinner seg utenfor den garantien, av ulike grunner:

- Den **engangs-CLI-en** har ingenting å bære med seg - tilstanden er in-memory og forbigående per kjøring.
- **TUI-en** vedvarer tilstand (`~/.lolly`: økter, mapper, profil) og Profil-visningen kan ta backup av den, men den skriver et *enklere* eget arkiv: `saved-state/<slot>.json` per økt pluss `profile.json` og `folders.json`, uten manifest, uten `formatVersion`/`minReader` og uten integritetskart. Det er **ikke** importerbart i dette formatet - en leser avviser det som "ikke en Lolly-backup" - og forvirrende nok bruker det et lignende navn (`lolly-backup-<stamp>.zip`). Å samle de to er et kjent gap.

## Reserverte utvidelsespunkter

Konvolutten er et manifest pluss et sett navngitte deler med hensikt, slik at nye typer portabel data kan følge med senere **uten en brytende endring**. De kobles inn som additive deler (ny `formatVersion`, samme `minReader`), og dagens leser hopper over det den ikke kjenner igjen. Disse er ikke bygget ennå. Navnene er reservert her slik at formatet forblir sammenhengende når de kommer.

- **`tokens.json` - designtokens.** Et [W3C DTCG](https://tr.designtokens.org/format/) designtokens-dokument (formatet [Penpot importerer og eksporterer](https://help.penpot.app/user-guide/design-systems/design-tokens/) - tokens med `$value`/`$type`/`$description`, organisert i grupper, sett og temaer). Et tokensett i bunten lar en bruker flytte merkevareprimitivene sine mellom installasjoner sammen med øktene sine. (En brukers egne merkevaretokener reiser allerede i dag som ressursen `user/tokens/brand` i `assets.json`; denne delen ville bære et helt DTCG-dokument med settene og temaene sine.) På lengre sikt blir et innhentet tokensett en førsteklasses kilde som verktøy og palettressurser løser opp mot.
- **`penpot/` - innhentede Penpot-filer.** En reservert mappe for en Penpot-fil (eller dens uttrukne, Lolly-relevante delsett) importert og gjort tilgjengelig *som et verktøy*. Bunten vil bære den innhentede definisjonen, slik at den følger med resten av brukerens data.

Alt utenfor disse reserverte navnene og delene ovenfor er, for en leser, en ukjent del: uberørt og talt med i `skipped`.

## Referanse

- Modul: [`shells/web/src/data-transfer.ts`](../shells/web/src/data-transfer.ts) (`exportBackup`, `importBackup`, `BACKUP_FORMAT`, `BACKUP_FORMAT_VERSION`, `BACKUP_READER_VERSION` - navngiveren `backupFilename()` er intern).
- Kontraktstest: [`tests/data-transfer.test.ts`](../tests/data-transfer.test.ts) - rundtur-, sammenslåings-, integritets-, fremoverkompatibilitets- og lesersperre-tilfeller.
- Historikk-kontraktstester: [`tests/file-history-backup.test.ts`](../tests/file-history-backup.test.ts), [`tests/file-batch-history.test.ts`](../tests/file-batch-history.test.ts) og [`tests/file-result-library.test.ts`](../tests/file-result-library.test.ts). Nettleser-aksept: [`tests/file-history.browser.test.ts`](../tests/file-history.browser.test.ts), [`tests/file-batch-history.browser.test.ts`](../tests/file-batch-history.browser.test.ts) og [`tests/file-result-reuse.browser.test.ts`](../tests/file-result-reuse.browser.test.ts).
- Bro-overflate brukt: `host.profile`, `host.state`, `host.assets` - se [Host API](/info/host-api.html).
