# Dataoverføring: `lolly-backup`-bundlen

Lolly beholder det personlige biblioteket ditt på enheten. En sikkerhetskopibundle er hvordan det biblioteket flyttes: eksporter den på én installasjon, ta med filen på hvilken som helst måte (USB, AirDrop, e-post til deg selv eller en nettverksressurs) og importer den på en annen. Å eksportere og importere trenger ingen server, og målet kan være uten nett.

Denne siden er formatspesifikasjonen, for folk som bygger skall, verktøy eller skript rundt sikkerhetskopier: hva som er i zip-filen, hvordan versjoner kontrolleres, hvordan en import slår sammen og hva som sjekkes. Gjennomgangen for folk som flytter sitt eget arbeid er [Move your work to another device](/info/find-your-work.html#move-your-work-to-another-device).

![De to knappene som flytter en hel installasjon: Export my data skriver én zip, Import data leser den inn igjen](/t/url-shot?url=%2F%23%2Fsettings%3Ffocus%3Dstorage-section&width=1440&height=1800&dpi=192&waitMs=2400&css=.store-move%3Ediv%3Anth-of-type%282%29%2C.store-move%3Ep%3Alast-of-type%7Bdisplay%3Anone%7D&waitSelector=%5Bdata-store-group%3Dmove%5D&drive=click%3A%5Bdata-store-group%3Dmove%5D%3Esummary&walker=1&format=svg&cropSelector=%5Bdata-store-group%3Dmove%5D&dark=1&filename=pd-transfer-controls)

> **Scope.** En bundle bærer *brukerdata*, ikke katalogverktøy. Katalogverktøy og katalogressurser synkroniseres separat og antas å allerede være til stede på målet, i verste fall i en høyere versjon. Verktøy en bruker har laget selv, reiser inne i `profile.json`. Import installerer eller oppgraderer aldri et katalogverktøy.

## Mål

- <!--i:box--> **Ett format, hvert skall.** Nettappen, skrivebords- og mobilappene og fremtidige skall deler samme konvolutt og delskjemaer. Valgfrie deler avhenger av hvert skalls kapabiliteter, og ikke-støttede deler rapporteres. Hver kapabilitetsbro leverer sin lagringsadapter.
- <!--i:shieldcheck--> **Overlever turen.** En bundle som er ødelagt eller avkortet underveis, svikter høylytt ved import og gjenopprettes aldri halvt.
- <!--i:clock--> **Overlever denne versjonen.** En eldre app kan fortsatt importere delene av en nyere bundle den kjenner igjen. Et virkelig brytende format avvises rent.
- <!--i:check--> **Trygt å slå sammen.** Å importere til en installasjon som allerede er i bruk, sletter aldri noe som ikke var i bundlen.

## Konvolutten

En bundle er en vanlig `.zip`, så den overlever enhver transport intakt og ethvert utpakkingsverktøy kan inspisere innholdet.

Nedlastingen får navn etter personen den tilhører: `LollyTools-<First>-<Last>-<YYYY-MM-DD>-<n>.zip`, for eksempel `LollyTools-Ada-Lovelace-2026-06-26-1.zip`, slik at en nedlastingsmappe med sikkerhetskopier forblir lesbar. For- og etternavn kommer fra profilen og utelates når de ikke er satt: ingen profil gir `LollyTools-2026-06-26-1.zip`, og bare et fornavn gir `LollyTools-Ada-2026-06-26-1.zip`. Hvert navn reduseres til et filnavnsikkert token (Unicode-bokstaver og -sifre beholdt, mellomrom og tegnsetting fjernet, høyst 32 tegn). `<n>` er en sekvens per dag og per enhet, så gjentatte eksporter samme dag kolliderer ikke og holder rekkefølgen. `backupFilename()` i `data-transfer.ts` bygger navnet, og zip-filens innhold er det samme uansett navn.

| Sti | Påkrevd | Innhold |
|---|---|---|
| `manifest.json` | ja | Format-ID, versjoner, antall og integritet per del. Det første en leser ser på. |
| `profile.json` | når satt | Brukerens hele `me`-post: navn, kontakt, portrettreferanse og flagg, pluss mapper, Trash, prosjektplaner, brukermaler og brukerlagde verktøy, favoritter, skjulte verktøy, språk og emoji-valg. Leses via `host.profile`. |
| `sessions.json` | ja | Hver lagrede økt: plass, verktøy-ID og versjon, etikett, miniatyrbilde (data-URL) og full inndata. Leses via `host.state`. |
| `assets.json` | ja | Metadata for hver opplastede ressurs (bilder, skrifter, merkevaretokener, logoer, lagrede kopier av nedlastinger), hver peker til bytene sine under `assets/blobs/`. |
| `assets/blobs/<n>.<ext>` | per ressurs | De rå ressursbytene, lagret ukomprimert fordi de fleste allerede er komprimerte formater. Etternavnet er kosmetisk; MIME-typen i `assets.json` er autoritativ. |
| `assets/blobs/<n>.c2pa` | når til stede | Uttrukne Content Credentials som eksakte binære bytes, referert av `_credentialFile` i ressursposten. Dette er ikke enhetens signeringsnøkler. |
| `design-systems.json` | når til stede | Designsystemene laget eller lagt til på denne installasjonen, som `{ active, records }`. Se [Import rules](#import-rules). |
| `file-history.json` | valgfri | Versjonerte ressursøyeblikksbilder, ferdige filoperasjonsrapporter og komplette batchmanifester, med en egen versjon. Leveres av skallets interne `fileHistory`-sikkerhetskopiadapter. |
| `revision-history.json` | valgfri, manuelle sikkerhetskopier | Stabile skapelses-ID-er, beholdte sjekkpunkter, miniatyrbilder og rullerende gjenopprettingsutkast. Leveres av `host.state.history.backup` der det støttes. |
| `file-history/versions/` | per øyeblikksbilde | Tidligere ressursbytes og uttrukne credentials, uansett om den gjeldende ressursen fortsatt finnes. |
| `file-history/results/` | per ferdig operasjon | Eksakte utdatabytes. Ingen originalfil valgt for konvertering beholdes eller tas med. |
| `prefs.json` | ja | Brukereide lokale innstillinger: `theme`, `sidebarWidth` og aktivitetstellingen `ct-metrics`. |
| `lolly.txt` | ja | Et lesbart sammendrag av bundlen (antall, profil, filnavn) for alle som åpner zip-filen uten Lolly. Genereres på nytt ved hver eksport og gjenkjennes ved import, så den teller aldri som en hoppet over del. Den skrives etter integritetskartet, så kartet dekker ikke denne filen. |

::: details Hvordan eksporten skriver zip-filen
Eksporten skriver zip-filen en del om gangen (`shells/web/src/lib/zip-stream.ts`). Opplastinger, lagrede resultater og lagrede ressursversjoner leses i 4 MiB-skiver, aldri hele, og lagrede resultater og versjoner kontrolleres først mot den registrerte SHA-256-verdien. Hver fil leses deretter for sjekksummen og integritetssammendraget, og zip-filen refererer til den der den er.

Ingenting kodes på nytt, så en fil som bærer Content Credentials beholder de eksakte bytene signaturen dekker, og hver del beholder sine eksakte bytes og sammendrag. For de samme delene og tidspunktet er zip-filen identisk med den eldre skriveren i minnet, bortsett fra at en historikkfil over 16 MiB komprimeres i biter. `tests/backup-streaming.test.ts` kontrollerer dette mot registrerte referansesammendrag.

På et syntetisk bibliotek på 192 MiB, målt i Node, tok det å fullføre sikkerhetskopien omtrent 125 til 150 MiB oppå biblioteket, mot omtrent 850 MiB for skriveren i minnet (`node scripts/bench-backup-finalise.ts`). Import leser fortsatt hele zip-filen inn i minnet.
:::

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
| `format` | Alltid `lolly-backup`. En fil uten det avvises som "not a Lolly backup". |
| `formatVersion` | Oppsettet denne bundlen ble **skrevet** med. Økes ved enhver endring av delsettet eller formene. Lesere gater **ikke** på dette feltet. |
| `minReader` | Den laveste leserversjonen som kan importere denne bundlen **trygt**. Dette er feltet lesere gater på. |
| `app` | ID til appen som produserte den, for diagnostikk. |
| `exportedAt` | ISO-tidsstempel for når bundlen ble laget. |
| `counts` | Hva skriveren la inn, for visning og fornuftssjekker. |
| `integrity` | Valgfritt. Kobler hver del bortsett fra `manifest.json` til et SRI-aktig `sha256-<base64>`-sammendrag av dens **ukomprimerte** bytes. |

## Versjonspolicy

To versjonsnumre lar formatet vokse uten å la eldre installasjoner stå igjen.

![En endring i bundleformatet er enten additiv, som gamle lesere kan ignorere, eller brytende, der en feil import ødelegger data. Additiv øker formatVersion og beholder minReader; brytende øker formatVersion og hever minReader. En leser importerer når minReader er høyst dens egen versjon.](/info/diagrams/concepts/backup-version-gate.svg)

- En leser importerer en bundle når `manifest.minReader` er høyst dens egen leserversjon. Den nekter, med "needs a newer version of the app", bare når bundlen krever en nyere leser.
- En **additiv** endring, som en ny valgfri del eller et nytt valgfritt manifestfelt, øker `formatVersion` og lar `minReader` være. Eldre apper importerer fortsatt hver del de kjenner igjen, og deler de ikke kjenner igjen, rapporteres som hoppet over, ikke droppet i det stille.
- En **brytende** endring, der en feil import av en del ødelegger data eller en valgfri del blir obligatorisk, hever `minReader`. Eldre apper nekter da rent i stedet for å importere noe de ikke kan håndtere.
- Hvis en fremtidig bundle setter `formatVersion` men utelater `minReader`, faller lesere tilbake til å gate på `formatVersion` og behandler endringen som brytende.

> **Tommelfingerregel for forfattere:** hvis hver eksisterende leser fortsatt ville gjort det riktige ved å ignorere tillegget ditt, er endringen additiv: øk `formatVersion` og la `minReader` være. Ellers hev `minReader`.

## Integritet

Når `manifest.integrity` er til stede, sjekker en leser hver oppførte dels SHA-256 **før noe skrives**. Et avvik ("failed its integrity check") eller en manglende del ("incomplete") stopper hele importen, så det blir ingen delvis gjenoppretting. Dette fanger skaden en filtransport kan gjøre: en avkortet AirDrop, en e-postgateway som kodet vedlegget på nytt, en dårlig USB-sektor.

Integritet er beste innsats. Det skrives bare der Web Crypto er tilgjengelig (hver sikre nettlesersammenheng og moderne Node), og sjekkes bare når både kartet og Web Crypto er til stede. En bundle uten kartet, som en fra før integritet fantes, importeres uendret: "cannot verify" regnes aldri som "corrupt".

Manifestet lister verken seg selv eller den regenererte `lolly.txt`. Sammendragene dekker delene manifestet innestår for.

## Importregler

En import kjører i en av to moduser.

- **Merge** er det **Import data…** gjør, og det synkroniseringens første tilslutning, **Bring it to this device**, gjør. Data på målet blir, og ingenting som ikke var i bundlen, røres: en økt målet hadde og bundlen ikke hadde, overlever importen.
- **Replace** er det enhetssynkronisering bruker for å holde enheter i takt: den tar den synkroniserte kopiens profilpost, innstillinger, økter, bilder og valg av aktivt designsystem, og fjerner bare elementer en annen enhet har slettet siden forrige synkronisering. Å gjenopprette en tidligere kopi går lenger og får enheten til å samsvare med den kopien, og fjerner alt kopien ikke holder, etter at enheten er lagret først. [Sync your devices](/info/sync.html) dekker hva en person ser.

I en sammenslåing beholdes alt som bare er på målet, og hver type data i bundlen møter målet slik:

| Data | Allerede på målet | Bare i bundlen |
|---|---|---|
| Økter (etter plass) og opplastede bilder (etter id) | Kopien som ble lagret sist, beholdes, så en eldre sikkerhetskopi aldri overskriver nyere arbeid. Like eller ukjente tidspunkt beholder målets kopi. | Lagt til |
| Mapper | Målets navn og forelder beholdes, og mappen får bundlens medlemmer den mangler. En økt arkivert i en mappe på målet blir arkivert der. | Lagt til |
| Favoritter (verktøy, katalogressurser og Projects-elementer) | Kombinert | Lagt til |
| Maler, Projects-maler og brukerverktøy (etter id) | Målets post beholdes. | Lagt til |
| Trash-oppføringer | Målets oppføring beholdes. | Lagt til, slik at et element som kunne gjenopprettes på begge installasjoner, fortsatt kan det. En oppføring der mappen er tatt i bruk igjen på målet, eller der målet allerede bruker Trash-plassen, utelates. |
| Andre profilfelt (navn, kontaktopplysninger, språk, feature flags, skjulte verktøy og andre innstillinger) | Målets verdi beholdes. | Tatt der målets felt er tomt |
| Innstillinger (`prefs.json`) | Målets verdi beholdes. | Skrevet der målet ikke har noen |
| Designsystemer (etter id) | Bundlens post erstatter målets. | Lagt til. Bundlens aktive valg gjelder bare når målet ikke har noe designsystem av eget. |
| Skapelseshistorikk | Kopien som ble lagret sist, forblir gjeldende, og den andre beholdes som et beskyttet utkast. | Lagt til |

**Lagrede økter kobles automatisk til bildene sine igjen.** Ressursreferanser beholdes etter id, og broen løser dem opp på nytt etter at bildene er gjenopprettet, noe den uansett må gjøre fordi `blob:`-URL-er ikke overlever en omlasting.

**Historikkposter endres aldri etter at de er skrevet.** En gjentatt import av ressursversjoner og operasjons-ID-er legger ikke til noe, og en ID som allerede navngir andre bytes eller annen historikk, avvises, ikke overskrives. Å importere en identisk gjeldende ressurs på nytt beholder versjonen, og en endret gjeldende ressurs må bære en annen versjon.

**Skapelseshistorikk har noen flere regler.** En skapelse der plassen målet bruker til en annen skapelse, legges til som en separat skapelse, og en skapelse i målets Trash blir der. En sjekkpunkt-ID som navngir annet innhold på målet, beholder målets. Et arkiv som feiler sine egne kontroller, stopper importen før noen profil, økt, ressurs eller innstilling endres, og en identisk gjentatt import legger ikke til lagring.

**Sammendraget rapporterer hva som skjedde.** Hver import returnerer `profile`, `sessions`, `userAssets`, `prefs`, `skipped` og `failedAssets`.

- `failedAssets` teller opplastede ressurser som ikke kunne gjenopprettes, for eksempel fordi enhetslagringen er full.
- `skipped` teller deler fra en nyere skriver som dette bygget ikke kjente igjen. Appen viser det ("… · N newer items skipped"), så en gjenoppretting sier hva den lot ligge.
- Med filhistorikk legger sammendraget til `assetVersions`, `fileOperations`, `fileBatches` og `failedHistory`. Tom lagring eller en konflikt med en uforanderlig ID kan gi en delvis gjenoppretting, og appen ber da personen beholde kildesikkerhetskopien.
- Med skapelseshistorikk legger det til `revisions` og `recoveryDrafts`, og teller bare det denne importen la til, og `added`, `kept`, `replaced`, `copies` og `hidden` for hvordan hver skapelse ble slått sammen. `skippedCheckpoints` teller sjekkpunkter der ID-en navngir annet innhold på målet, og `historyLeftOut` teller eldre sjekkpunkter og utkast som ikke fikk plass i enhetens historikkplass.
- En replace-import legger til `removed` og `failedRemovals`.

Gjenoppretting er ikke én transaksjon på tvers av profil-, økt-, ressurs- og historikklagrene. Skysynkronisering **øker ikke** sin anvendte revisjon etter en delvis eller ikke-støttet gjenoppretting, så kopien forblir tilgjengelig for nytt forsøk.

## Hva som ikke følger med

- **Katalogbuffere** (nedlastet ressursmetadata og blobs, verktøyindeksen), som målet synkroniserer på nytt gratis.
- **Katalogverktøy og katalogressurser**, som ligger utenfor omfanget og antas å være til stede på målet. Merkevaretokener, skrifter og logoer brukeren la til, er brukerressurser, så de reiser med.
- **`blob:`- og objekt-URL-er**, som broen regenererer ved lasting.
- **Konverteringsoriginaler, levende utførelsesleier og maskinlokale tilgangs- eller signeringshemmeligheter.** Disse er ikke portabel historikk. Et lagret resultat er en kopi, ikke et løfte om at den opprinnelige kilden ble sikkerhetskopiert.
- **Eksportsekvenstelleren**, telleren for navngiving av nedlastinger per dag i `localStorage` (`lolly-export-seq`). Den holdes utenfor `PREF_KEYS`, så den aldri reiser i en bundle.

Lagringsmåleren viser den samme delingen. Lagrede økter, My images og File results & versions går inn i en bundle. Ressursbufferen, verktøyforhåndsvisningene og festene for bruk uten nett under dem kan alle bygges opp igjen, så de blir igjen.

![Lagringsmåleren som deler denne enhetens data i navngitte kategorier, med Saved sessions og My images sporet separat fra Asset cache, her på en ny installasjon der hver kategori fortsatt er tom](/t/url-shot?url=%2F%23%2Fprofile%3Ffocus%3Dstorage-section&width=1440&height=1600&dpi=192&waitMs=2600&format=svg&css=%5Bdata-store-group%3Dmove%5D%2C.storage-actions%2C.store-selbar%7Bdisplay%3Anone%7D&cropSelector=.store-meter&waitSelector=%5Bdata-store-group%3Dmove%5D&drive=click%3A%5Bdata-store-group%3Dwork%5D%3Esummary%3Bclick%3A%5Bdata-store-group%3Dcaches%5D%3Esummary&walker=1&dark=1&filename=ce-storage-categories)

## Organisasjonsdata med Lolly Work

Denne bundlen sikkerhetskopierer enhetens personlige bibliotek. Den er ikke en sikkerhetskopi av en **Lolly Work**-instans: organisasjonskontoer, tilgangspolicyer, delte prosjekter, katalogversjoner, godkjenninger, gjengivelsesjobber og revisjonsposter holdes av den tjenesten. Koble til på nytt og logg på for å få tilgang til delt arbeid igjen; å importere en personlig bundle gir ikke den tilgangen.

Driftsansvarlige sikkerhetskopierer, beholder og sletter serverdata med Lolly Works egne veiledninger: [Backup and restore](/info/work-operations.html#backup-and-restore) og [Work storage and data lifecycle](/info/work-data-lifecycle.html). Å tømme eller eksportere en enhet gjør ingen av disse serveroperasjonene.

## På tvers av skall

`data-transfer.ts` leser og skriver bare gjennom kapabilitetsbroen (`host.profile`, `host.state`, `host.assets`) og de delte `localStorage`-innstillingene. Den samme modulen leser og skriver den felles konvolutten på nettet og i skrivebords- og mobilappene, over IndexedDB eller filsystemlagring. Valgfrie historikkdeler vises bare der adapteren deres er tilgjengelig, og en ikke-støttet del rapporteres som hoppet over ved import. Suiten uten grensesnitt tester de felles delene mot en bro i minnet, og historikktransaksjoner har også tester i ekte nettleser.

To shell befinner seg utenfor den garantien, av ulike grunner:

- **Engangs-CLI-et** har ingenting å bære: tilstanden ligger i minnet og varer ett kall.
- **TUI-et** beholder tilstand i `~/.lolly` (økter, mapper, profil), og Profile-visningen kan sikkerhetskopiere den, men den skriver et enklere arkiv av eget slag: `saved-state/<slot>.json` per økt pluss `profile.json` og `folders.json`, uten manifest, uten `formatVersion` eller `minReader` og uten integritetskart. Dette formatet kan ikke importere det (en leser avviser det som "not a Lolly backup"), og navnet er forvirrende likt (`lolly-backup-<stamp>.zip`). Å forene de to er et kjent gap.

## Ikke portabelt ennå

Konvolutten er et manifest pluss navngitte deler, så nye typer portable data kan komme til senere som additive deler (en ny `formatVersion`, samme `minReader`), og dagens lesere hopper over det de ikke kjenner igjen. Designsystemer reiser allerede slik, som `design-systems.json` pluss brukerressursene sine.

To navn er reservert for data som ikke reiser ennå:

- **`tokens.json`** ville bære et helt [W3C DTCG](https://tr.designtokens.org/format/) designtoken-dokument med grupper, sett og temaer, formatet [Penpot importerer og eksporterer](https://help.penpot.app/user-guide/design-systems/design-tokens/). En brukers egne merkevaretokener reiser allerede som ressursen `user/tokens/brand` i `assets.json`, og et designsystems tokener reiser med posten dets.
- **`penpot/`** er reservert for en inntatt Penpot-fil, eller dens Lolly-relevante delmengde, gjort tilgjengelig som et verktøy.

Dagens lesere kjenner ingen av navnene ennå. Som alt annet utenfor delene ovenfor er hver en ukjent del for dem: latt urørt og talt i `skipped`.

## Historikkdeler

De to historikkdelene er valgfrie og har egne versjoner. De fleste lesere kan hoppe over denne delen.

::: details Skapelseshistorikk (v3)
Manuelle sikkerhetskopier fra en nettinstallasjon med skapelseshistorikk inkluderer `revision-history.json`, med sitt eget skjema `{ version: 1, documents, revisions, recoveries }`. Den bærer de beholdte ID-ene, kanoniske inndataøyeblikksbilder, versjonsstempler, rasterforhåndsvisninger og separate skriverutkast. Historikkadapteren fanger gjeldende økter og hodene deres i én lesetransaksjon, og `sessions.json` bruker de samme gjeldende øyeblikksbildene for eldre lesere.

Gjenoppretting kontrollerer nyttelastens SHA-256 og bytetall, unike identiteter, forhold mellom dokument og hode, aner, tidsstempler, forhåndsvisningstyper og grenser før arkivet bekreftes i én transaksjon. Komprimerte foreldrereferanser kan mangle. Eksisterende gjeldende arbeid erstattes aldri i det stille: når en skapelse finnes på begge sider, blir siden som ikke beholdes som gjeldende, et beskyttet utkast.

Arkivets overføringsgrense på 384 MiB kontrolleres eksplisitt, og lagringsgrenser håndheves uten å avkorte beholdte sjekkpunkter. Eksporten skriver `revision-history.json` og `sessions.json` i biter, med de samme bytene som en enkelt `JSON.stringify` gir, så filteksten aldri holdes hel. En historikkfil som ville passert grensen, droppes i det øyeblikket den gjør det og telles bare derfra. Arkivet lages deretter på nytt uten de eldste automatiske sjekkpunktene, og eksportsammendraget teller disse som `checkpointsLeftOut`, eller arkivet avvises helt.

Et skall uten denne kapabiliteten gjenoppretter vanlige økter og rapporterer historikkdelen som hoppet over. Innebygd filsystemhistorikk forblir ikke-støttet til adapteren leverer varige historikktransaksjoner. Gjester i en privat collab har ingen varig historikk eller gjenopprettingsarkiv.

Personlig øyeblikksbildesynkronisering utelater skapelseshistorikk. Å bruke et øyeblikksbilde på et lokalt dokument med historikk beholder dets forrige arbeidstilstand som et separat gjenopprettingsutkast og ugyldiggjør enhver åpen redigerers skrivetoken. De uforanderlige sjekkpunktene blir på enheten. Dette beskytter lokal historikk under en erstatning av øyeblikksbildet; det slår ikke sammen samtidige enhetshistorikker.

Historiske ressursreferanser beholdes, mens gjengivelsen fortsatt løser ressurser opp gjennom målets eksisterende bibliotek. Dette arkivet garanterer ennå ikke eksakte gamle ressursbytes eller gamle verktøygjengivelser. Bytes for ressursversjoner og filresultater reiser i sin egen sikkerhetskopidel.
:::

::: details Lagrede versjoner og filresultater (v2)
Den valgfrie historikkdelen holder `{ version: 2, assetVersions: [...], operations: [...], batches: [...] }`, og lesere godtar også den tidligere history-v1-formen uten batcher. Hvert øyeblikksbilde gir den stabile ressurs-ID-en og den eksakte versjonen, lagringstidspunktet, bytelengden og heksadesimal SHA-256, pluss en ressurspost der `_file` og valgfri `_credentialFile` peker til binære deler. Operasjoner bærer de opprinnelige filfaktaene, forespørselen, rapporten, tidsstemplene og valgfri resultat-`_file`. Lagringsbakendenavn, OPFS-håndtak og utførelsesleier reiser ikke. Lesere som bare kjenner history v1, nekter den nye historikkversjonen før import, i stedet for å droppe batchmedlemskap i det stille.

Batchmanifester registrerer hver valgte kilde før behandling, inkludert filer som aldri ble lest, avbrutte medlemmer, feil ved reservasjon av resultatplass og avbrutt arbeid. Hvert medlem har en stabil operasjons-ID, kildereferanse og fakta, ønsket utdatanavn og endelig rapport. En ulest kilde har deklarerte fakta, ikke et oppdiktet sammendrag. Importen validerer medlemsidentitet og konsistens med en eventuell medfølgende operasjonsrapport. Batchrapporter forblir tilgjengelige når enkeltresultater er fjernet, men en kvittering betyr ikke at utdatabytene fortsatt er lagret.

- **Validering først.** Hver kjente historikkpost, rapport og refererte fil valideres før noen profil- eller ressursimport skriver. Manglende bytes og avvikende SHA-256 svikter selv når konvolutten ikke har noe integritetskart. Uttrukne credentials forblir byte-arrayer, også ved importer fra eldre skrivere som serialiserte dem som objekter med numeriske nøkler.
- **Kjørende arbeid.** Kjørende operasjoner blir avbrutte poster i sikkerhetskopien, med en forklarende feilrapport og uten resultat. Gjenoppretting starter aldri bakgrunnsarbeid på nytt og importerer aldri et aktivt leie. Nytt forsøk betyr å velge originalfilen på nytt, kontrollert mot den registrerte SHA-256 når den er tilgjengelig.
- **Lagring.** Gjenopprettede resultater bekrefter bytene og metadataene sammen i IndexedDB. Vanlige nye resultater bruker OPFS der det er tilgjengelig, med en IndexedDB-reserve. En eksisterende levende operasjon erstattes aldri av en import.
- **Sikkerhetskopigrenser.** Eksporten strømmer disse bytene inn i arkivet, men gjenoppretting pakker fortsatt ut en hel sikkerhetskopi i minnet, så grensene gjelder: **256 MiB historikknyttelast**, **4 MiB historikkmetadata**, høyst **100 operasjoner**, **100 batcher** og **2 000 øyeblikksbilder**. Eksporten avviser for stor eller ufullstendig historikk eksplisitt og utelater den aldri i det stille. Last ned viktige versjoner og resultater én for én før du fjerner eldre lokale kopier. Disse grensene er ikke en målt garanti for topp minnebruk på telefoner.
- **Lokale budsjetter.** Lokal resultathistorikk har et budsjett på 512 MiB og et tak på 100 poster. Ressursøyeblikksbilder har et separat budsjett på 512 MiB og høyst 20 historiske versjoner per ressurs, og uttrukne credential-bytes teller mot det budsjettet. Gjenoppretting respekterer disse grensene og fjerner aldri eksisterende brukerdata i det stille.
- **Batchmetadata.** Lokale batchmetadata har et separat budsjett på 4 MiB, høyst 100 manifester og 20 medlemmer per batch. Ventende medlemmer reserverer metadatakapasitet, med et rapporttak på 32 KiB per medlem. Dette er et logisk budsjett, ikke en garanti for nettleserens diskplass: en ekte kvotefeil vises, og rapporten i minnet forblir nedlastbar. Nytt forsøk på et batchmedlem oppretter en ny batch uten å overskrive den gamle rapporten. Å fjerne en batchpost fjerner ikke enkeltresultatbytes eller bibliotekressurser.
- **Resultater i biblioteket.** Konverterte resultater kan legges til i biblioteket uten normalisering eller ny koding, med kilde- og utdatahasher og operasjonsrelasjonen vedlagt. Gjentatte tillegg gjenbruker en uendret kopi, og en redigert kopi overskrives aldri. Rasterbilder kan starte et nytt Design-dokument, som bruker gjeldende bibliotekressurs-ID; å håndheve eksakte versjonsfester gjennom hele Designs kjøretid og URL-vei er separat arbeid. SVG-, HTML-, PDF- og ZIP-resultater beholdes som ugjennomsiktige filressurser, ikke oppgradert til klarert interaktivt eller vektorinnhold.
- **Hvor folk ser dette.** **Convert → Recent file operations** viser historikkbruk, rapporter, nedlastinger og versjonsbehandleren, som også finner tidligere versjoner av slettede bibliotekressurser. Å gjenopprette et øyeblikksbilde oppretter en ny gjeldende versjon og beholder det valgte øyeblikksbildet. **Settings → Preferences → Storage** teller resultater og versjoner separat fra engangsbuffere.
- **Opprydding.** Eksplisitt opprydding av midlertidige filer fjerner bare operasjonseide, ureferert bytes. Gjeldende poster beskytter filene sine, og nylige OPFS-filer har en frist på én time. Lagrede resultater og ressursøyeblikksbilder tømmes ikke automatisk.

Eldre lesere godtar fortsatt v2-konvolutten (`minReader: 1`) og gjenoppretter delene de kjenner, og teller ikke-støttede historikkdeler som hoppet over. Full historikkgjenoppretting trenger et skall med adapteren `fileHistory`, en søm inni skallet i stedet for en ny verktøyvendt `HostV1`-kapabilitet. Ekte gjenoppretting på to enheter dekkes av den lokale Chromium-porten; gjenoppretting på installerte skrivebords-, iOS- og Android-apper skal fortsatt godkjennes separat.
:::

## Referanse

- Modul: `shells/web/src/data-transfer.ts` (`exportBackup`, `importBackup`, `BACKUP_FORMAT`, `BACKUP_FORMAT_VERSION`, `BACKUP_READER_VERSION`; navngiveren `backupFilename()` er intern).
- Kontrakttest: `tests/data-transfer.test.ts`, som dekker rundtur, sammenslåing, integritet, fremover-kompatibilitet og leserporten.
- Historikkontrakttester: `tests/file-history-backup.test.ts`, `tests/file-batch-history.test.ts` og `tests/file-result-library.test.ts`. Nettlesergodkjenning: `tests/file-history.browser.test.ts`, `tests/file-batch-history.browser.test.ts` og `tests/file-result-reuse.browser.test.ts`.
- Brukt broflate: `host.profile`, `host.state` og `host.assets`; se [Host API](/info/host-api.html).
