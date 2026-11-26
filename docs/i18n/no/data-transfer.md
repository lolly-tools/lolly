# Dataoverføring: `lolly-backup`-pakken

En sikkerhetskopipakke flytter det personlige biblioteket Lolly lagrer på enheten: eksporter det fra én installasjon, ta med filen (USB, AirDrop, e-post til deg selv eller en delt nettverksmappe) og importer den på en annen. Eksport og import trenger ingen server, og målenheten kan være uten nett.

Dette er formatspesifikasjonen for dem som bygger appskall, verktøy eller skript rundt sikkerhetskopier. For å flytte ditt eget arbeid, les [Flytt arbeidet ditt til en annen enhet](/info/find-your-work.html#move-your-work-to-another-device).

![De to knappene som flytter en hel installasjon: Export my data skriver én zip, Import data leser den inn igjen](/t/url-shot?url=%2F%23%2Fsettings%3Ffocus%3Dstorage-section&width=1440&height=1800&dpi=192&waitMs=2400&css=.store-move%3Ediv%3Anth-of-type%282%29%2C.store-move%3Ep%3Alast-of-type%7Bdisplay%3Anone%7D&waitSelector=%5Bdata-store-group%3Dmove%5D&drive=click%3A%5Bdata-store-group%3Dmove%5D%3Esummary&walker=1&format=svg&cropSelector=%5Bdata-store-group%3Dmove%5D&dark=1&filename=pd-transfer-controls)

::: note Omfang
En pakke inneholder *brukerdata*, ikke katalogverktøy. Katalogverktøy og katalogressurser synkroniseres separat og forutsettes å finnes på målenheten, i verste fall i en nyere versjon. Verktøy en bruker har laget, følger med i `profile.json`. Import installerer eller oppgraderer aldri et katalogverktøy.
:::

<!--i:eti-badge-check-->
## Mål

- <!--i:box--> **Ett format, alle appskall.** Nettappen, skrivebords- og mobilappene og fremtidige appskall deler samme innpakning og delskjemaer. Valgfrie deler avhenger av hva hvert appskall støtter, og deler som ikke støttes, rapporteres. Hver funksjonsbro leverer sin lagringsadapter.
- <!--i:shieldcheck--> **Tåler overføringen.** En pakke som skades eller avkortes under overføringen, avvises ved import med en feil og gjenopprettes aldri halvveis.
- <!--i:clock--> **Varer lenger enn denne versjonen.** En eldre app importerer delene av en nyere pakke som den kjenner igjen. Et inkompatibelt format avvises på en ryddig måte.
- <!--i:check--> **Trygg å slå sammen.** Import til en installasjon som allerede er i bruk, sletter aldri noe som ikke var i pakken.

<!--i:eti-package-->
## Innpakningen

En pakke er en vanlig `.zip`. Den tåler enhver overføring intakt, og ethvert utpakkingsverktøy kan undersøke innholdet.

Nedlastingen får navn etter eieren: `LollyTools-<First>-<Last>-<YYYY-MM-DD>-<n>.zip`, for eksempel `LollyTools-Ada-Lovelace-2026-06-26-1.zip`. For- og etternavnet kommer fra profilen og utelates når de ikke er angitt: uten profil blir det `LollyTools-2026-06-26-1.zip`, og bare et fornavn gir `LollyTools-Ada-2026-06-26-1.zip`. Hvert navn blir et token som er trygt i filnavn (Unicode-bokstaver og sifre beholdes, mellomrom og tegnsetting fjernes, maksimalt 32 tegn). `<n>` er et løpenummer per dag og enhet, så gjentatte eksporter samme dag ikke kolliderer og beholder rekkefølgen. `backupFilename()` i `data-transfer.ts` bygger navnet. Navnet endrer ikke innholdet i zip-filen.

| Sti | Påkrevd | Innhold |
|---|---|---|
| `manifest.json` | ja | Format-id, versjoner, antall og integritet per del. En leser leser denne filen først. |
| `profile.json` | når angitt | Brukerens `me`-oppføring: navn, kontakt, referanse til profilbilde og flagg, pluss mapper, Trash, prosjektoppskrifter, brukermaler og brukerlagde verktøy, favoritter, skjulte verktøy, språk og emojivalg. Leses via `host.profile`. |
| `sessions.json` | ja | Hver lagrede økt: plass, verktøy-id og versjon, etikett, miniatyrbilde (data-URL) og fullstendige inndata. Leses via `host.state`. |
| `assets.json` | ja | Metadata for hver opplastede ressurs (bilder, skrifter, merkevaretokener, logoer, lagrede kopier av nedlastinger), som hver peker til sine byte under `assets/blobs/`. |
| `assets/blobs/<n>.<ext>` | per ressurs | Ressursens rå byte, lagret ukomprimert fordi de fleste allerede er komprimerte formater. Filendelsen er kosmetisk; MIME-typen i `assets.json` er autoritativ. |
| `assets/blobs/<n>.c2pa` | når den finnes | Uthentede Content Credentials som nøyaktige binære byte, referert til av `_credentialFile` i ressursoppføringen. Dette er ikke enhetens signeringsnøkler. |
| `design-systems.json` | når den finnes | Designsystemene laget eller lagt til på denne installasjonen, som `{ active, records }`. Se [Importregler](#import-rules). |
| `file-history.json` | valgfri | Versjonerte øyeblikksbilder av ressurser, rapporter om fullførte filoperasjoner og komplette batchmanifester, med en egen versjon. Leveres av appskallets interne sikkerhetskopiadapter `fileHistory`. |
| `revision-history.json` | valgfri, manuelle sikkerhetskopier | Stabile ID-er for arbeider, beholdte kontrollpunkter, miniatyrbilder og løpende gjenopprettingsutkast. Leveres av `host.state.history.backup` der det støttes. |
| `file-history/versions/` | per øyeblikksbilde | Tidligere ressursbyte og uthentede attester, uansett om den gjeldende ressursen fortsatt finnes. |
| `file-history/results/` | per fullført operasjon | Nøyaktige utdatabyte. Ingen originalfil valgt for konvertering beholdes eller inkluderes. |
| `prefs.json` | ja | Brukereide lokale innstillinger: `theme`, `sidebarWidth` og aktivitetstelleren `ct-metrics`. |
| `lolly.txt` | ja | Et lesbart sammendrag av pakken (antall, profil, filnavn) for alle som åpner zip-filen uten Lolly. Genereres på nytt ved hver eksport og gjenkjennes ved import, så den teller aldri som en utelatt del. Den skrives etter integritetskartet, så kartet dekker ikke denne filen. |

::: details Slik skriver eksporten zip-filen
Eksporten skriver zip-filen én del om gangen (`shells/web/src/lib/zip-stream.ts`). Opplastinger, lagrede resultater og lagrede ressursversjoner leses i biter på 4 MiB, aldri i sin helhet. Lagrede resultater og versjoner kontrolleres først mot sin registrerte SHA-256. Hver fil leses deretter for kontrollsummen og integritetshashen, og zip-filen refererer til filen der den er.

Ingenting kodes på nytt. Hver del beholder sine nøyaktige byte og sin hash, så en fil med Content Credentials beholder bytene signaturen dekker. Med de samme delene og samme tidspunkt er zip-filen identisk med den fra den tidligere skriveren som arbeidet i minnet, bortsett fra at en historikkfil over 16 MiB komprimeres stykkevis. `tests/backup-streaming.test.ts` kontrollerer dette mot registrerte referansehasher.

Med et syntetisk bibliotek på 192 MiB, målt i Node, krevde fullføringen av sikkerhetskopien omtrent 125 til 150 MiB i tillegg til biblioteket, mot omtrent 850 MiB for skriveren som arbeidet i minnet (`node scripts/bench-backup-finalise.ts`). Import leser fortsatt hele zip-filen inn i minnet.
:::

<!--i:eti-file-->
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
| `format` | Alltid `lolly-backup`. En fil uten dette avvises som «ikke en Lolly-sikkerhetskopi». |
| `formatVersion` | Oppsettet denne pakken ble **skrevet** med. Økes ved enhver endring i delsettet eller strukturene. Lesere bruker **ikke** dette feltet som versjonskrav. |
| `minReader` | Den laveste leserversjonen som kan importere denne pakken **trygt**. Dette er feltet lesere bruker som versjonskrav. |
| `app` | Id-en til appen som laget pakken, for diagnostikk. |
| `exportedAt` | ISO-tidsstempelet for når pakken ble opprettet. |
| `counts` | Hva skriveren la inn, for visning og rimelighetskontroller. |
| `integrity` | Valgfri. Kobler hver del unntatt `manifest.json` til en hash i SRI-stil, `sha256-<base64>`, av delens **ukomprimerte** byte. |

<!--i:eti-tag-->
## Versjonspolicy

To versjonsnumre lar formatet vokse uten å stenge ute eldre installasjoner.

![En endring i pakkeformatet er enten et tillegg, som gamle lesere kan ignorere, eller et kompatibilitetsbrudd, der feil import ødelegger data. Et tillegg øker formatVersion og beholder minReader; et kompatibilitetsbrudd øker formatVersion og hever minReader. En leser importerer når minReader er høyst dens egen versjon.](/info/diagrams/concepts/backup-version-gate.svg)

- En leser importerer en pakke når `manifest.minReader` er høyst dens egen leserversjon. Den avviser, med «trenger en nyere versjon av appen», bare når pakken krever en nyere leser.
- En **tilleggsendring**, som en ny valgfri del eller et nytt valgfritt manifestfelt, øker `formatVersion` og lar `minReader` være. Eldre apper importerer fortsatt alle deler de kjenner igjen, og deler de ikke kjenner igjen, rapporteres som hoppet over i stedet for å utelates uten beskjed.
- En **kompatibilitetsbrytende** endring, der feil import av en del ødelegger data eller en valgfri del blir obligatorisk, hever `minReader`. Eldre apper avviser da på en ryddig måte i stedet for å importere noe de ikke kan håndtere. Eldre apper avviser da pakken på en ryddig måte.
- Hvis en fremtidig pakke angir `formatVersion`, men utelater `minReader`, faller lesere tilbake på `formatVersion` som versjonskrav og behandler endringen som et kompatibilitetsbrudd.

::: note Tommelfingerregel for forfattere
Hvis alle eksisterende lesere fortsatt ville gjort det rette ved å ignorere tillegget ditt, er endringen et tillegg: øk `formatVersion` og behold `minReader`. Ellers hever du `minReader`.
:::

<!--i:eti-shield-check-->
## Integritet

Når `manifest.integrity` finnes, kontrollerer en leser SHA-256 for hver oppført del **før noe skrives**. Et avvik («bestod ikke integritetskontrollen») eller en manglende del («ufullstendig») stopper importen, så det ikke blir noen delvis gjenoppretting. Dette fanger opp overføringsskader: en avkortet AirDrop, en e-postgateway som kodet vedlegget på nytt, en dårlig USB-sektor.

Integritet sikres så langt det lar seg gjøre. Den skrives bare der Web Crypto er tilgjengelig (alle sikre nettleserkontekster og moderne Node), og kontrolleres bare når både kartet og Web Crypto finnes. En pakke uten kartet, som en fra før integritet fantes, importeres uendret: «kan ikke verifisere» teller aldri som «skadet».

Manifestet lister verken seg selv eller den nygenererte `lolly.txt`.

<!--i:eti-download-->
## Importregler

En import kjører i én av to moduser.

- **Merge** er det **Import data…** og den første tilkoblingen i synkronisering, **Bring it to this device**, gjør. Data på målenheten blir værende, og ingenting utenfor pakken berøres.
- **Replace** er det enhetssynkronisering bruker for å holde enheter samkjørt. Den bruker den synkroniserte kopiens profiloppføring, innstillinger, økter, bilder og valg av aktivt designsystem. Den fjerner bare elementer en annen enhet slettet siden forrige synkronisering. Gjenoppretting av en tidligere kopi lagrer først enheten, får deretter enheten til å samsvare med kopien og fjerner alt kopien ikke inneholder. [Synkroniser enhetene dine](/info/sync.html) dekker det en person ser.

En sammenslåing behandler hver datatype slik:

| Data | Allerede på målenheten | Bare i pakken |
|---|---|---|
| Økter (etter plass) og opplastede bilder (etter id) | Den sist lagrede kopien beholdes, så en eldre sikkerhetskopi aldri overskriver nyere arbeid. Ved like eller ukjente tidspunkter beholdes målenhetens kopi. | Legges til |
| Mapper | Målenhetens navn og overordnede mappe beholdes, og mappen får medlemmene fra pakken som den mangler. En økt arkivert i en mappe på målenheten blir værende der. | Legges til |
| Favoritter (verktøy, katalogressurser og elementer i Projects) | Slås sammen | Legges til |
| Maler, Projects-maler og brukerverktøy (etter id) | Målenhetens oppføring beholdes. | Legges til |
| Trash-oppføringer | Målenhetens oppføring beholdes. | Legges til, så et element som kunne gjenopprettes på en av installasjonene, fortsatt kan det. En oppføring med en mappe som er i bruk igjen på målenheten, eller med en Trash-plass målenheten allerede bruker, utelates. |
| Andre profilfelt (navn, kontaktopplysninger, språk, funksjonsflagg, skjulte verktøy og andre innstillinger) | Målenhetens verdi beholdes. | Hentes der målenhetens felt er tomt |
| Innstillinger (`prefs.json`) | Målenhetens verdi beholdes. | Skrives der målenheten ikke har noen |
| Designsystemer (etter id) | Pakkens oppføring erstatter målenhetens. | Legges til. Pakkens aktive valg gjelder bare når målenheten ikke har noe eget designsystem. |
| Arbeidshistorikk | Den sist lagrede kopien forblir gjeldende, og den andre beholdes som et beskyttet utkast. | Legges til |

**Lagrede økter kobles automatisk til bildene sine igjen.** Ressursreferanser beholdes etter id. Broen slår dem opp på nytt etter at bildene er gjenopprettet, fordi `blob:`-URL-er ikke overlever en ny innlasting.

**Historikkoppføringer endres aldri etter at de er skrevet.** En gjentatt import av ressursversjoner og operasjons-ID-er legger ikke til noe, og en ID som allerede viser til andre byte eller annen historikk, avvises i stedet for å overskrives. Ny import av en identisk gjeldende ressurs beholder versjonen, og en endret gjeldende ressurs må ha en annen versjon.

**Arbeidshistorikk har noen flere regler.** Et arbeid som har en plass målenheten bruker til et annet arbeid, legges til som et eget arbeid, og et arbeid i målenhetens Trash blir der. En kontrollpunkt-id som viser til annet innhold på målenheten, beholder målenhetens innhold. Et arkiv som ikke består sine egne kontroller, stopper importen før noen profil, økt, ressurs eller innstilling endres, og en identisk gjentatt import tar ikke mer lagringsplass.

**Sammendraget rapporterer hva som skjedde.** Hver import returnerer `profile`, `sessions`, `userAssets`, `prefs`, `skipped` og `failedAssets`.

- `failedAssets` teller opplastede ressurser som ikke kunne gjenopprettes, for eksempel fordi enhetens lagringsplass er full.
- `skipped` teller deler fra en nyere skriver som denne versjonen ikke kjente igjen. Appen viser antallet («… · N nyere elementer hoppet over»).
- Med filhistorikk legger sammendraget til `assetVersions`, `fileOperations`, `fileBatches` og `failedHistory`. Full lagringsplass eller en konflikt med en uforanderlig ID kan føre til en delvis gjenoppretting, og appen ber da personen om å beholde den opprinnelige sikkerhetskopien.
- Med arbeidshistorikk legger det til `revisions` og `recoveryDrafts`, som bare teller det denne importen la til, og `added`, `kept`, `replaced`, `copies` og `hidden` for hvordan hvert arbeid ble slått sammen. `skippedCheckpoints` teller kontrollpunkter med en id som viser til annet innhold på målenheten, og `historyLeftOut` teller eldre kontrollpunkter og utkast som det ikke var plass til i enhetens historikklager.
- En erstatningsimport legger til `removed` og `failedRemovals`.

Gjenoppretting er ikke én transaksjon på tvers av lagrene for profil, økter, ressurser og historikk. Skysynkronisering oppdaterer **ikke** sin anvendte revisjon etter en delvis eller ikke støttet gjenoppretting, så kopien er fortsatt tilgjengelig for et nytt forsøk.

<!--i:eti-unlink-->
## Hva som ikke blir med

- **Katalogbuffere** (nedlastede ressursmetadata og binærdata, verktøyindeksen), som målenheten synkroniserer på nytt.
- **Katalogverktøy og katalogressurser**, som forutsettes å finnes på målenheten. Merkevaretokener, skrifter og logoer brukeren har lagt til, er brukerressurser og blir med.
- **`blob:` og objekt-URL-er**, som broen oppretter på nytt ved innlasting.
- **Konverteringsoriginaler, aktive kjørereservasjoner og maskinlokale tilgangs- eller signeringshemmeligheter.** Disse er ikke flyttbar historikk. Et lagret resultat er en kopi. Det betyr ikke at originalkilden ble sikkerhetskopiert.
- **Eksportsekvenstelleren**, telleren i `localStorage` (`lolly-export-seq`) som gir nedlastinger navn per dag. Den holdes utenfor `PREF_KEYS`, så den blir aldri med i en pakke.

Lagringsmåleren viser samme inndeling. Saved sessions, My images og File results & versions blir med i en pakke. Ressursbufferen, verktøyforhåndsvisninger og innhold festet for bruk uten nett kan bygges opp på nytt og blir igjen.

![Lagringsmåleren deler enhetens data inn i navngitte kategorier, med Saved sessions og My images registrert separat fra Asset cache, her på en ny installasjon der alle kategorier fortsatt er tomme](/t/url-shot?url=%2F%23%2Fprofile%3Ffocus%3Dstorage-section&width=1440&height=1600&dpi=192&waitMs=2600&format=svg&css=%5Bdata-store-group%3Dmove%5D%2C.storage-actions%2C.store-selbar%7Bdisplay%3Anone%7D&cropSelector=.store-meter&waitSelector=%5Bdata-store-group%3Dmove%5D&drive=click%3A%5Bdata-store-group%3Dwork%5D%3Esummary%3Bclick%3A%5Bdata-store-group%3Dcaches%5D%3Esummary&walker=1&dark=1&filename=ce-storage-categories)

<!--i:eti-building-->
## Organisasjonsdata med Lolly Work

Denne pakken sikkerhetskopierer enhetens personlige bibliotek. En pakke er ikke en sikkerhetskopi av en **Lolly Work**-instans. Organisasjonskontoer, tilgangspolicyer, delte prosjekter, katalogversjoner, godkjenninger, gjengivelsesjobber og revisjonsposter lagres av den tjenesten. Koble til på nytt og logg inn for å få tilgang til delt arbeid igjen. Import av en personlig pakke gir ikke den tilgangen.

Driftsansvarlige sikkerhetskopierer, oppbevarer og sletter serverdata med Lolly Works egne veiledninger: [Sikkerhetskopiering og gjenoppretting](/info/work-operations.html#backup-and-restore) og [Lagring og datalivssyklus i Lolly Work](/info/work-data-lifecycle.html). Tømming eller eksport av en enhet utfører ingen av disse serveroperasjonene.

<!--i:eti-monitor-->
## På tvers av skall

`data-transfer.ts` leser og skriver bare gjennom kapabilitetsbroen (`host.profile`, `host.state`, `host.assets`) og de delte innstillingene i `localStorage`. Samme modul leser og skriver den felles innpakningen på nettet og i skrivebords- og mobilappene, via IndexedDB eller filsystemlagring. Valgfrie historikkdeler vises bare der adapteren deres er tilgjengelig. Import rapporterer en del som ikke støttes, som hoppet over. Den hodeløse testsamlingen tester de felles delene mot en bro i minnet, og historikktransaksjoner har også tester i en ekte nettleser.

To skall faller utenfor denne garantien:

- **CLI for engangskjøring** har ingenting å ta med: tilstanden ligger i minnet og varer én kjøring.
- **TUI** beholder tilstanden i `~/.lolly` (økter, mapper, profil). Profile-visningen skriver sitt eget, enklere sikkerhetskopiarkiv: `saved-state/<slot>.json` per økt pluss `profile.json` og `folders.json`, uten manifest, uten `formatVersion` eller `minReader` og uten integritetskart. En leser for dette formatet avviser det arkivet som «ikke en Lolly-sikkerhetskopi», selv om navnene ligner (`lolly-backup-<stamp>.zip`). At de to ikke er samordnet, er en kjent mangel.

<!--i:eti-clock-->
## Kan ennå ikke flyttes

Nye typer flyttbare data kan komme til senere som ekstra deler (en ny `formatVersion`, samme `minReader`). Designsystemer blir allerede med på denne måten, som `design-systems.json` sammen med brukerressursene sine.

To navn er reservert for data som ennå ikke blir med:

- **`tokens.json`** ville inneholde et [W3C DTCG](https://tr.designtokens.org/format/)-dokument med designtokener, grupper, sett og temaer, formatet [Penpot importerer og eksporterer](https://help.penpot.app/user-guide/design-systems/design-tokens/). Brukerens egne merkevaretokener blir allerede med som ressursen `user/tokens/brand` i `assets.json`, og et designsystems tokener blir med i posten for det.
- **`penpot/`** er reservert for en innlest Penpot-fil, eller delene som er relevante for Lolly, gjort tilgjengelig som et verktøy.

<!--i:eti-history-->
## Historikkdeler

De to historikkdelene er valgfrie og har egne versjoner.

::: details Opprettingshistorikk (v3)
Manuelle sikkerhetskopier fra en nettinstallasjon med opprettingshistorikk inkluderer `revision-history.json`, med sitt eget `{ version: 1, documents, revisions, recoveries }`-skjema. Den inneholder de beholdte ID-ene, kanoniske øyeblikksbilder av inndata, versjonsstempler, rasterforhåndsvisninger og separate utkast fra skrivere. Historikkadapteren henter gjeldende økter og deres siste revisjoner i én lesetransaksjon, og `sessions.json` bruker de samme gjeldende øyeblikksbildene for eldre lesere.

Gjenoppretting sjekker nyttelastens SHA-256 og antall byte, unike identiteter, relasjoner mellom dokumenter og siste revisjoner, avstamning, tidsstempler, forhåndsvisningstyper og grenser før arkivet lagres i én transaksjon. Foreldrereferanser kan mangle etter komprimering. Eksisterende gjeldende arbeid erstattes aldri i det stille: når et arbeid finnes på begge sider, blir siden som ikke beholdes som gjeldende, et beskyttet utkast.

Arkivet har en overføringsgrense på 384 MiB. Lagringsgrenser håndheves uten å avkorte beholdte kontrollpunkter. Eksport skriver `revision-history.json` og `sessions.json` i biter, med de samme bytene som én `JSON.stringify` gir, så filteksten holdes aldri samlet i minnet. En historikkfil som ville overskride grensen, forkastes idet den gjør det, og fra da av telles den bare. Arkivet lages så på nytt uten de eldste automatiske kontrollpunktene, og eksportsammendraget teller disse som `checkpointsLeftOut`, eller arkivet avvises.

Et skall uten denne kapabiliteten gjenoppretter vanlige økter og rapporterer historikkdelen som hoppet over. Historikk i det innebygde filsystemet støttes fortsatt ikke før adapteren leverer varige historikktransaksjoner. Gjester i et privat samarbeid har ingen varig historikk eller gjenopprettingsarkiv.

Personlig synkronisering av øyeblikksbilder utelater opprettingshistorikk. Når et øyeblikksbilde brukes på et lokalt dokument med historikk, beholdes den forrige arbeidstilstanden som et separat gjenopprettingsutkast, og skrivetokenet til eventuelle åpne redigeringsvinduer ugyldiggjøres. De uforanderlige kontrollpunktene blir på enheten. Dette beskytter lokal historikk når et øyeblikksbilde erstattes. Det fletter ikke sammen samtidige historikker fra flere enheter.

Historiske ressursreferanser beholdes, mens gjengivelse fortsatt slår opp ressurser gjennom målets eksisterende bibliotek. Dette arkivet garanterer ennå ikke nøyaktig de gamle ressursbytene eller gamle verktøygjengivelser. Byte for ressursversjoner og filresultater blir med i sin egen sikkerhetskopidel.
:::

::: details Lagrede versjoner og filresultater (v2)
Den valgfrie historikkdelen inneholder `{ version: 2, assetVersions: [...], operations: [...], batches: [...] }`, og lesere godtar også det tidligere history-v1-formatet uten batcher. Hvert øyeblikksbilde oppgir stabil ressurs-ID og nøyaktig versjon, lagringstid, bytelengde og heksadesimal SHA-256, pluss en ressurspost der `_file` og valgfri `_credentialFile` peker til binære deler. Operasjoner inneholder opplysninger om originalfilen, forespørsel, rapport, tidsstempler og valgfri `_file` for resultatet. Navn på lagringssystemer, OPFS-håndtak og kjørereservasjoner blir ikke med. Lesere som bare kjenner historikk v1, avviser den nye historikkversjonen før import, så batchtilhørighet blir aldri fjernet i det stille.

Batchmanifester registrerer hver valgt kilde før behandling, også filer som aldri ble lest, avbrutte medlemmer, mislykket reservering av resultatplass og arbeid som ble avbrutt underveis. Hvert medlem har en stabil operasjons-ID, kildereferanse og opplysninger, ønsket utdatanavn og sluttrapport. En ulest kilde har oppgitte opplysninger, ikke en oppdiktet hashverdi. Import validerer medlemmets identitet og samsvar med en eventuell medfølgende operasjonsrapport. Lolly Batch-rapporter er fortsatt tilgjengelige når enkeltresultater er fjernet, men en kvittering betyr ikke at utdatabytene fortsatt er lagret.

- **Validering først.** Hver kjent historikkpost, rapport og referert fil valideres før import av profil eller ressurser skriver noe. Manglende byte og SHA-256 som ikke samsvarer, gir feil selv når innpakningen ikke har noe integritetskart. Uthentede legitimasjonsdata forblir bytearrayer, også ved import fra eldre skrivere som serialiserte dem som objekter med numeriske nøkler.
- **Pågående arbeid.** Pågående operasjoner blir avbrutte poster i sikkerhetskopien, med feilrapport og uten resultat. Gjenoppretting starter aldri bakgrunnsarbeid på nytt eller importerer en aktiv reservasjon. Et nytt forsøk krever at originalfilen velges på nytt og sjekkes mot registrert SHA-256 når den er tilgjengelig.
- **Lagring.** Gjenopprettede resultater lagrer byte og metadata samlet i IndexedDB. Vanlige nye resultater bruker OPFS der det er tilgjengelig, med IndexedDB som reserve. En eksisterende aktiv operasjon erstattes aldri av en import.
- **Sikkerhetskopigrenser.** Eksport strømmer disse bytene inn i arkivet, men gjenoppretting pakker fortsatt ut en hel sikkerhetskopi i minnet, så grensene gjelder fortsatt: **256 MiB historikknyttelast**, **4 MiB historikkmetadata**, høyst **100 operasjoner**, **100 batcher** og **2 000 øyeblikksbilder**. Eksport avviser for stor eller ufullstendig historikk uttrykkelig og utelater den aldri i det stille. Last ned viktige versjoner og resultater enkeltvis før du fjerner eldre lokale kopier. Disse grensene er ingen målt garanti for maksimalt minnebruk på telefoner.
- **Lokale budsjetter.** Lokal resultathistorikk har et budsjett på 512 MiB og en grense på 100 poster. Ressursøyeblikksbilder har et separat budsjett på 512 MiB og høyst 20 historiske versjoner per ressurs, og uthentede legitimasjonsbyte teller med i dette budsjettet. Gjenoppretting respekterer disse grensene og fortrenger aldri eksisterende brukerdata i det stille.
- **Batchmetadata.** Lokale batchmetadata har et separat budsjett på 4 MiB, høyst 100 manifester og 20 medlemmer per batch. Ventende medlemmer reserverer metadatakapasitet, med en rapportgrense på 32 KiB per medlem. Dette er et logisk budsjett, ingen garanti for diskplass i nettleseren: en reell kvotefeil vises, og rapporten i minnet kan fortsatt lastes ned. Et nytt forsøk for et batchmedlem oppretter en ny batch uten å overskrive den gamle rapporten. Fjerning av en batchpost fjerner ikke byte for enkeltresultater eller bibliotekressurser.
- **Resultater i biblioteket.** Konverterte resultater kan legges til i biblioteket uten normalisering eller omkoding, med kilde- og utdatahashene og koblingen til operasjonen vedlagt. Gjentatte tillegg gjenbruker en uendret kopi, og en redigert kopi overskrives aldri. Rasterbilder kan starte et nytt Lolly Design-dokument, som bruker gjeldende ressurs-ID i biblioteket. Håndheving av bindinger til nøyaktige versjoner gjennom hele kjøremiljøet og URL-banen til Lolly Design er et eget arbeid. SVG-, HTML-, PDF- og ZIP-resultater beholdes som ugjennomsiktige filressurser og oppgraderes ikke til betrodd interaktivt innhold eller vektorinnhold.
- **Hvor folk ser dette.** **Convert → Recent file operations** viser historikkbruk, rapporter, nedlastinger og versjonsbehandleren, som også finner tidligere versjoner av slettede bibliotekressurser. Gjenoppretting av et øyeblikksbilde oppretter en ny gjeldende versjon og beholder det valgte øyeblikksbildet. **Settings → Preferences → Storage** teller resultater og versjoner separat fra buffere som kan kastes.
- **Opprydding.** Uttrykkelig opprydding i midlertidige filer fjerner bare byte som eies av operasjoner og ikke er referert. Gjeldende poster beskytter filene sine, og nye OPFS-filer har en frist på én time. Lagrede resultater og ressursøyeblikksbilder slettes ikke automatisk.

Eldre lesere godtar fortsatt v2-innpakningen (`minReader: 1`) og gjenoppretter delene de kjenner, mens historikkdeler som ikke støttes, telles som hoppet over. Full gjenoppretting av historikk krever et skall med adapteren `fileHistory`, et internt grensesnitt i skallet, ikke en `HostV1`-kapabilitet for verktøy. Reell gjenoppretting mellom to enheter dekkes av den lokale Chromium-testporten. Gjenoppretting i installerte skrivebords-, iOS- og Android-apper må fortsatt godkjennes separat.
:::

<!--i:eti-code-->
## Referanse

- Modul: `shells/web/src/data-transfer.ts` (`exportBackup`, `importBackup`, `BACKUP_FORMAT`, `BACKUP_FORMAT_VERSION`, `BACKUP_READER_VERSION`; navnegeneratoren `backupFilename()` er intern).
- Kontrakttest: `tests/data-transfer.test.ts`, som dekker rundtur, fletting, integritet, fremoverkompatibilitet og leserporten.
- Historikkens kontrakttester: `tests/file-history-backup.test.ts`, `tests/file-batch-history.test.ts` og `tests/file-result-library.test.ts`. Nettleserakseptanse: `tests/file-history.browser.test.ts`, `tests/file-batch-history.browser.test.ts` og `tests/file-result-reuse.browser.test.ts`.
- Brukt brogrensesnitt: `host.profile`, `host.state` og `host.assets`; se [Host API](/info/host-api.html).
