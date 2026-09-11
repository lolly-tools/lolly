# Dataoverføring - `lolly-backup`-pakken

Alt en Lolly-bruker samler seg opp, lever **på enheten deres** - ingen konto, ingen sky. Dataoverføringspakken er hvordan den verdien flytter seg: eksporter den på én installasjon, bær filen på hvilken som helst måte (USB, AirDrop, e-post til deg selv, en nettverksdeling) og importer den på en annen. Filen *er* transporten. Målet kan være offline eller online. Det spiller ingen rolle, fordi ingenting noensinne snakker med en server.

![De to knappene som flytter en hel installasjon: Eksporter dataene mine skriver én zip, Importer data leser den tilbake](/t/url-shot?url=%2F%23%2Fprofile%3Ffocus%3Dstorage-section&width=1440&height=1800&dpi=192&waitMs=2400&css=.store-manages%7Bdisplay%3Anone%7D&walker=1&format=svg&cropSelector=.storage-subsection&dark=1&filename=pd-transfer-controls)

Denne siden er formatspesifikasjonen. For sluttbrukergjennomgangen, se [Using Lolly → Moving to another device](/info/using.html). Implementasjonen er [`shells/web/src/data-transfer.ts`](../shells/web/src/data-transfer.ts), og [`tests/data-transfer.test.ts`](../tests/data-transfer.test.ts) fastlåser tur-retur-kontrakten.

> **Omfang.** En pakke bærer *brukerdata*, ikke verktøy. Verktøy og katalogressurser synkroniseres separat og antas allerede å være til stede på målet (i verste fall i en høyere versjon). Import installerer eller oppgraderer aldri et verktøy.

## Mål

- <!--i:box--> **Ett format, alle shells.** De samme bytene produseres og konsumeres av web-PWA-en, Tauri-appene for desktop/mobil og enhver fremtidig shell. Pakken er kontrakten. Hver shells kapabilitetsbro er per-plattform-adapteren bak den.
- <!--i:shieldcheck--> **Overlever turen.** En pakke som blir ødelagt eller avkuttet under transport, feiler høylytt ved import, aldri en halv gjenoppretting.
- <!--i:clock--> **Overlever denne versjonen.** En eldre app kan fortsatt importere en nyere pakkes gjenkjente deler. Et virkelig brytende format avvises rent.
- <!--i:check--> **Trygt å slå sammen.** Import til en installasjon som allerede er i bruk, sletter aldri noe som ikke var i pakken.

## Konvolutten

En pakke er en vanlig `.zip`. Nedlastingen navngis etter personen den tilhører - `LollyTools-<First>-<Last>-<YYYY-MM-DD>-<n>.zip` (for eksempel `LollyTools-Ada-Lovelace-2026-06-26-1.zip`) - slik at en Nedlastinger-mappe full av sikkerhetskopier holder seg lesbar. Fornavn- og etternavndelene kommer fra profilen og utelates når de ikke er angitt. Uten profil blir det `LollyTools-2026-06-26-1.zip`, og et fornavn alene gir `LollyTools-Ada-2026-06-26-1.zip`. Hver del saneres til et filnavn-sikkert token (Unicode-bokstaver/-tall beholdes, mellomrom/tegnsetting fjernes, maks 32 tegn). `<n>` er et sekvensnummer per dag per enhet, slik at gjentatte eksporter samme dag ikke kolliderer og forblir i rekkefølge. `backupFilename()` i [`shells/web/src/data-transfer.ts`](../shells/web/src/data-transfer.ts) bygger navnet. Zip-filens innhold er identisk uansett navn. Inni:

| Sti | Påkrevd | Innhold |
|---|---|---|
| `manifest.json` | ja | Format-id, versjoner, antall og integritet per del. Det første en leser ser på. |
| `profile.json` | når satt | Brukerens `me`-post (navn, kontakt, portrettbilde-referanse, flagg). Leses via `host.profile`. |
| `sessions.json` | ja | Hver lagrede sesjon: plass, verktøy-id/versjon, etikett, miniatyrbilde (data-URL) og fullstendige inputdata. Leses via `host.state`. |
| `assets.json` | ja | Metadata for hver opplastet ressurs (bilder, fonter, merkevaretokener), hver med peker til bytene sine under `assets/blobs/`. |
| `assets/blobs/<n>.<ext>` | per ressurs | De rå ressursbytene (bilde- og fontfiler). Lagret ukomprimert (allerede komprimerte formater). Filendelsen er kosmetisk. MIME-typen i `assets.json` er autoritativ. |
| `prefs.json` | ja | Brukereide lokale innstillinger: `theme`, `sidebarWidth` og `ct-metrics`-aktivitetstellingen. |
| `lolly.txt` | ja | Et menneskelesbart sammendrag av pakken (antall, profil, filnavn) for alle som åpner zip-en uten Lolly. Regenereres ved hver eksport og gjenkjennes ved import, så den regnes aldri som en hoppet-over del. Den skrives *etter* integritetskartet, så den holdes utenfor det. |

Pakken er en vanlig zip med hensikt: den overlever enhver transport intakt, og ethvert utpakkingsverktøy kan inspisere den.

`profile.json` er den minste delen og den en leser ser først i appen: detaljene en produsent fyller inn én gang, pluss opt-inen som lar verktøy bruke dem.

![Profile details-skjemaet som blir profile.json - navn, kontakt, portrettbilde og opt-inen ved siden av](/t/url-shot?url=%2F%23%2Fprofile&width=1440&height=900&dpi=192&waitMs=1800&format=svg&cropSelector=.profile-details-grid&walker=1&dark=1&filename=ce-profile-record)

## `manifest.json`

```json
{
  "format": "lolly-backup",
  "formatVersion": 1,
  "minReader": 1,
  "app": "lolly",
  "exportedAt": "2026-06-22T09:30:00.000Z",
  "counts": { "profile": true, "sessions": 2, "userAssets": 4, "prefs": 3 },
  "integrity": {
    "profile.json": "sha256-…",
    "sessions.json": "sha256-…",
    "assets.json": "sha256-…",
    "assets/blobs/0.webp": "sha256-…",
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

Import er **sammenslåing-med-overskriving**, aldri erstatt-alt:

- Eksisterende data på målet forblir på plass.
- Enhver nøkkel som kolliderer - profilen, en sesjonsplass, en opplastet bilde-id - erstattes av den importerte kopien.
- Ingenting som ikke var i pakken, røres. En sesjon målet hadde, men pakken ikke, overlever importen.

Lagrede sesjoner kobles automatisk sammen med bildene sine igjen: ressursreferanser holdes med id, og broen løser dem opp på nytt etter at de opplastede bildene er gjenopprettet (den må uansett det, fordi `blob:`-URL-er ikke overlever en omlasting).

Importsammendraget rapporterer `{ profile, sessions, userAssets, prefs, skipped, failedAssets }`. `failedAssets` teller opplastede ressurser som ikke kunne gjenopprettes (enhetslagring full, for eksempel). Det er atskilt fra `skipped`, som teller deler fra en fremoverkompatibel nyere skriver som denne buildjen ikke gjenkjente. UI-en viser `skipped` («… · N newer items skipped»), så gjenopprettingen er ærlig om hva den lot ligge.

## Hva som ikke følger med

- **Katalogbufre** (nedlastet ressursmetadata og blobs, verktøyindeksen) - synkroniseres gratis på nytt på målet.
- **Verktøy og merkevareressurser** - utenfor omfanget, og antas allerede å være til stede på målet.
- **`blob:`- / objekt-URL-er** - regenereres av broen ved lasting.
- **Eksportsekvenstelleren** - den daglige nedlastingsnavngivningstelleren per enhet (`localStorage`-nøkkelen `lolly-export-seq`) er en lokal navngivningsbekvemmelighet. Den holdes utenfor `PREF_KEYS`, så den følger aldri med i en pakke.

Lagringsmåleren viser den samme oppdelingen kategori for kategori. Lagrede sesjoner og Mine bilder følger med i en pakke. Ressursbufferen, verktøyforhåndsvisningene og offline-pinnene under dem er alle avledbare på nytt, så de blir igjen.

![Lagringsmåleren som deler denne enhetens data inn i navngitte kategorier, med Saved sessions og My images sporet separat fra Asset cache, her på en fersk installasjon der hver kategori fortsatt er tom](/t/url-shot?url=%2F%23%2Fprofile%3Ffocus%3Dstorage-section&width=1440&height=1600&dpi=192&waitMs=2600&format=svg&css=.store-manages%2C.storage-subsection%2C.store-selbar%7Bdisplay%3Anone%7D&cropSelector=.store-meter&walker=1&dark=1&filename=ce-storage-categories)

## Kryssgaranti mellom shells

`data-transfer.ts` leser og skriver utelukkende gjennom kapabilitetsbroen (`host.profile`, `host.state`, `host.assets`) og de delte `localStorage`-innstillingene. Fordi broen er den eneste skjøten, produserer den *samme* modulen et byte-identisk bundt på hvert shell selv om lagringen under er forskjellig - IndexedDB på web, filsystemet på Tauri. Tauri-shellene gjenbruker denne modulen uendret. Bare deres `host.state`-implementasjon er forskjellig. Den skjulte testen kjører hele rundturen mot en in-memory-bro, og det er derfor den representerer dem alle.

To shell befinner seg utenfor den garantien, av ulike grunner:

- Den **engangs-CLI-en** har ingenting å bære med seg - tilstanden er in-memory og forbigående per kjøring.
- **TUI-en** vedvarer tilstand (`~/.lolly`: økter, mapper, profil) og Profil-visningen kan ta backup av den, men den skriver et *enklere* eget arkiv: `sessions/<slot>.json` per økt pluss `profile.json` og `folders.json`, uten manifest, uten `formatVersion`/`minReader` og uten integritetskart. Det er **ikke** importerbart i dette formatet - en leser avviser det som "ikke en Lolly-backup" - og forvirrende nok bruker det et lignende navn (`lolly-backup-<stamp>.zip`). Å samle de to er et kjent gap.

## Reserverte utvidelsespunkter

Konvolutten er et manifest pluss et sett navngitte deler med hensikt, slik at nye typer portabel data kan følge med senere **uten en brytende endring**. De kobles inn som additive deler (ny `formatVersion`, samme `minReader`), og dagens leser hopper over det den ikke kjenner igjen. Disse er på [veikartet](/info/overview.html#roadmap), ikke implementert ennå. Navnene er reservert her slik at formatet forblir sammenhengende når de kommer.

- **`tokens.json` - designtokens.** Et [W3C DTCG](https://tr.designtokens.org/format/) designtokens-dokument (formatet [Penpot importerer og eksporterer](https://help.penpot.app/user-guide/design-systems/design-tokens/) - tokens med `$value`/`$type`/`$description`, organisert i grupper, sett og temaer). Et tokensett i bunten lar en bruker flytte merkevareprimitivene sine mellom installasjoner sammen med øktene sine. På lengre sikt blir et innhentet tokensett en førsteklasses kilde som verktøy og palettressurser løser opp mot.
- **`penpot/` - innhentede Penpot-filer.** En reservert mappe for en Penpot-fil (eller dens uttrukne, Lolly-relevante delsett) importert og gjort tilgjengelig *som et verktøy*. Bunten vil bære den innhentede definisjonen, slik at den følger med resten av brukerens data.

Alt utenfor disse reserverte navnene og delene ovenfor er, for en leser, en ukjent del: uberørt og talt med i `skipped`.

## Referanse

- Modul: [`shells/web/src/data-transfer.ts`](../shells/web/src/data-transfer.ts) (`exportBackup`, `importBackup`, `BACKUP_FORMAT`, `BACKUP_FORMAT_VERSION`, `BACKUP_READER_VERSION` - navngiveren `backupFilename()` er intern).
- Kontraktstest: [`tests/data-transfer.test.ts`](../tests/data-transfer.test.ts) - rundtur-, sammenslåings-, integritets-, fremoverkompatibilitets- og lesersperre-tilfeller.
- Bro-overflate brukt: `host.profile`, `host.state`, `host.assets` - se [Host API](/info/host-api.html).
