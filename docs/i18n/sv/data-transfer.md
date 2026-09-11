# Dataöverföring - paketet `lolly-backup`

Allt en Lolly-användare samlar på sig finns **på deras enhet** - inget konto, inget moln. Dataöverföringspaketet är hur det värdet flyttas: exportera det från en installation, ta med filen på valfritt sätt (USB, AirDrop, e-post till dig själv, en nätverksdelning) och importera den på en annan. Filen *är* transporten. Målet kan vara offline eller online. Det spelar ingen roll, eftersom inget någonsin pratar med en server.

![De två knapparna som flyttar en hel installation: Exportera mina data skriver en zip, Importera data läser in den igen](/t/url-shot?url=%2F%23%2Fprofile%3Ffocus%3Dstorage-section&width=1440&height=1800&dpi=192&waitMs=2400&css=.store-manages%7Bdisplay%3Anone%7D&walker=1&format=svg&cropSelector=.storage-subsection&dark=1&filename=pd-transfer-controls)

Den här sidan är formatspecifikationen. För slutanvändargenomgången, se [Använda Lolly → Flytta till en annan enhet](/info/using.html). Implementationen är [`shells/web/src/data-transfer.ts`](../shells/web/src/data-transfer.ts), och [`tests/data-transfer.test.ts`](../tests/data-transfer.test.ts) fastställer kontraktet för tur-och-retur.

> **Omfattning.** Ett paket bär *användardata*, inte verktyg. Verktyg och katalogtillgångar synkas separat och antas redan finnas på målet (i värsta fall i en högre version). Import installerar eller uppgraderar aldrig ett verktyg.

## Mål

- <!--i:box--> **Ett format, alla skal.** Samma byte produceras och konsumeras av webb-PWA:n, Tauri-skrivbords-/mobilapparna och alla framtida skal. Paketet är kontraktet. Varje skals capability bridge är plattformsadaptern bakom det.
- <!--i:shieldcheck--> **Överlever resan.** Ett paket som skadats eller trunkerats under transport misslyckas högljutt vid import, återställer aldrig till hälften.
- <!--i:clock--> **Överlever den här versionen.** En äldre app kan fortfarande importera de delar av ett nyare paket den känner igen. Ett format som verkligen är brytande avvisas rent.
- <!--i:check--> **Säkert att slå samman.** Att importera till en installation som redan används suddar aldrig ut något som inte fanns i paketet.

## Kuvertet

Ett paket är en vanlig `.zip`. Nedladdningen namnges efter personen den tillhör - `LollyTools-<First>-<Last>-<YYYY-MM-DD>-<n>.zip` (till exempel `LollyTools-Ada-Lovelace-2026-06-26-1.zip`) - så att en Downloads-mapp full av säkerhetskopior förblir läsbar. Förnamns- och efternamnsdelarna kommer från profilen och utelämnas om de inte är ifyllda. Ingen profil ger `LollyTools-2026-06-26-1.zip`, och enbart förnamn ger `LollyTools-Ada-2026-06-26-1.zip`. Varje del saneras till en filnamnssäker token (Unicode-bokstäver/siffror behålls, mellanslag/skiljetecken tas bort, begränsat till 32 tecken). `<n>` är en sekvens per dag och enhet, så upprepade exporter samma dag inte krockar och förblir i ordning. `backupFilename()` i [`shells/web/src/data-transfer.ts`](../shells/web/src/data-transfer.ts) bygger namnet. Zip-innehållet är identiskt oavsett namn. Innehåll:

| Sökväg | Krävs | Innehåll |
|---|---|---|
| `manifest.json` | ja | Format-id, versioner, antal och integritet per del. Det första en läsare tittar på. |
| `profile.json` | när ifylld | Användarens `me`-post (namn, kontaktuppgifter, referens till profilbild, flaggor). Läses via `host.profile`. |
| `sessions.json` | ja | Varje sparad session: plats, verktygs-id/version, etikett, miniatyrbild (data-URL) och all indata. Läses via `host.state`. |
| `assets.json` | ja | Metadata för varje uppladdad tillgång (bilder, typsnitt, varumärkestoken), var och en pekande på sina byte under `assets/blobs/`. |
| `assets/blobs/<n>.<ext>` | per tillgång | De råa byten för tillgången (bild- och typsnittsfiler). Lagras okomprimerat (redan komprimerade format). Filändelsen är kosmetisk. MIME-typen i `assets.json` är auktoritativ. |
| `prefs.json` | ja | Användarägda lokala inställningar: `theme`, `sidebarWidth` och aktivitetsräknaren `ct-metrics`. |
| `lolly.txt` | ja | En människoläsbar sammanfattning av paketet (antal, profil, filnamn) för den som öppnar zip:en utan Lolly. Genereras på nytt vid varje export och känns igen vid import, så den räknas aldrig som en överhoppad del. Den skrivs *efter* integritetskartan, så den ligger utanför den. |

Paketet är avsiktligt en vanlig zip: det överlever alla transporter intakt, och vilket uppackningsverktyg som helst kan inspektera det.

`profile.json` är den minsta delen och den en läsare ser först i appen: uppgifterna som en producent fyller i en gång, plus samtycket som låter verktyg använda dem.

![Profilformuläret med detaljer som blir profile.json - namn, kontaktuppgifter, profilbild och samtycket bredvid dem](/t/url-shot?url=%2F%23%2Fprofile&width=1440&height=900&dpi=192&waitMs=1800&format=svg&cropSelector=.profile-details-grid&walker=1&dark=1&filename=ce-profile-record)

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

| Fält | Betydelse |
|---|---|
| `format` | Alltid `lolly-backup`. En fil utan det avvisas som "not a Lolly backup". |
| `formatVersion` | Layouten det här paketet **skrevs** med. Höjs vid varje ändring av uppsättningen delar eller deras form. Läsare styr **inte** på den. |
| `minReader` | Den lägsta läsarversion som krävs för att importera det här paketet **säkert**. Det är det här fältet läsare styr på. |
| `app` | Id för den app som skapade paketet, för diagnostik. |
| `exportedAt` | ISO-tidsstämpel för när paketet skapades. |
| `counts` | Vad skribenten lade in, för visning och rimlighetskontroll. |
| `integrity` | Valfritt. Kopplar varje del utom `manifest.json` till ett SRI-liknande `sha256-<base64>`-hashvärde för dess **okomprimerade** byte. |

## Versionspolicy (framåtkompatibilitet)

Uppdelningen mellan `formatVersion` och `minReader` är det som låter formatet växa utan att göra äldre installationer föräldralösa:

- En läsare importerar ett paket när `manifest.minReader ≤` dess egen läsarversion. Den vägrar (med "needs a newer version of the app") bara när paketet uttryckligen kräver en nyare läsare.
- En **additiv** ändring - en ny *valfri* del, eller ett nytt valfritt manifestfält - höjer `formatVersion` men lämnar `minReader` oförändrad. Äldre appar importerar fortfarande varje del de känner igen. Delar de inte känner igen hoppas över (se nedan), släpps inte tyst.
- En **brytande** ändring - en där en felaktig import av en del skadar data, eller där en tidigare valfri del blir obligatorisk - höjer `minReader`. Äldre appar vägrar då rent i stället för att importera något de inte kan hantera.
- Om ett framtida paket sätter `formatVersion` men utelämnar `minReader`, faller läsare försiktigt tillbaka på att styra på `formatVersion` (behandlar ändringen som brytande).

> **Tumregel för upphovspersoner:** om varje befintlig läsare fortfarande skulle göra rätt genom att ignorera ditt tillägg, är det additivt - höj `formatVersion`, lämna `minReader`. Annars höj `minReader`.

## Integritet

När `manifest.integrity` finns verifierar en läsare SHA-256 för varje listad del **innan något skrivs**. En avvikelse ("failed its integrity check") eller en saknad del ("incomplete") avbryter hela importen - det finns ingen delvis återställning. Det här fångar den skada en filtransport kan orsaka (en trunkerad AirDrop, en e-postgateway som kodat om bilagan, en dålig USB-sektor).

Integritet är avsiktligt best-effort: den skrivs bara där Web Crypto finns tillgängligt (varje säker webbläsarkontext och modern Node), och verifieras bara när både kartan och Web Crypto finns. Ett paket utan kartan - till exempel ett från innan integritet fanns - importeras oförändrat. "Cannot verify" behandlas aldrig som "corrupt".

Manifestet listar varken sig självt eller den återgenererade `lolly.txt`-README:n. Hashvärdena täcker de delar manifestet intygar för.

## Importsemantik

Import är **sammanfoga-och-skriva-över**, aldrig ersätt-allt:

- Befintlig data på målet lämnas orörd.
- Varje nyckel som krockar - profilen, en sessionsplats, ett id för en uppladdad bild - ersätts av den importerade kopian.
- Inget som inte fanns i paketet rörs. En session som målet hade men paketet inte hade överlever importen.

Sparade sessioner länkas automatiskt om till sina bilder: tillgångsreferenser bevaras via id, och bryggan löser upp dem på nytt efter att de uppladdade bilderna återställts (det måste den ändå göra, eftersom `blob:`-URL:er inte överlever en omladdning).

Importsammanfattningen rapporterar `{ profile, sessions, userAssets, prefs, skipped, failedAssets }`. `failedAssets` räknar uppladdade tillgångar som inte kunde återställas (till exempel fullt enhetslagringsutrymme). Det skiljer sig från `skipped`, som räknar delar från en framåtkompatibel nyare skribent som den här versionen inte kände igen. Gränssnittet visar `skipped` ("… · N newer items skipped"), så återställningen är ärlig om vad den lämnade kvar.

## Vad som inte följer med

- **Katalogcacher** (nedladdad tillgångsmetadata och blobbar, verktygsindexet) - synkas om gratis på målet.
- **Verktyg och varumärkestillgångar** - utanför omfattning, och antas redan finnas på målet.
- **`blob:`-/objekt-URL:er** - genereras om av bryggan vid inläsning.
- **Exportsekvensräknaren** - räknaren för nedladdningsnamn per dag (`localStorage`-nyckeln `lolly-export-seq`) är en lokal namngivningsbekvämlighet. Den hålls utanför `PREF_KEYS`, så den följer aldrig med i ett paket.

Lagringsmätaren specificerar samma uppdelning. Saved sessions och My images följer med i ett paket. Tillgångscachen, verktygsförhandsvisningarna och offlinefästningarna under dem kan alla härledas på nytt, så de stannar kvar.

![Lagringsmätaren som delar upp den här enhetens data i namngivna kategorier, med Saved sessions och My images spårade separat från Asset cache, här på en ny installation där varje kategori fortfarande är tom](/t/url-shot?url=%2F%23%2Fprofile%3Ffocus%3Dstorage-section&width=1440&height=1600&dpi=192&waitMs=2600&format=svg&css=.store-manages%2C.storage-subsection%2C.store-selbar%7Bdisplay%3Anone%7D&cropSelector=.store-meter&walker=1&dark=1&filename=ce-storage-categories)

## Garanti mellan skal

`data-transfer.ts` läser och skriver uteslutande via kapabilitetsbryggan (`host.profile`, `host.state`, `host.assets`) och de delade `localStorage`-inställningarna. Eftersom bryggan är den enda kontaktpunkten producerar *samma* modul en byte-identisk bunt på varje skal även om lagringen under skiljer sig - IndexedDB på webben, filsystemet på Tauri. Tauri-skalen återanvänder denna modul oförändrad. Endast deras `host.state`-implementation skiljer sig. Det huvudlösa testet kör hela tur-och-retur-flödet mot en in-memory-brygga, vilket är varför det får representera alla.

Två skal står utanför den garantin, av olika skäl:

- Den **engångskörda CLI:n** har inget att bära med sig - dess tillstånd finns i minnet och är flyktigt per anrop.
- **TUI:n** bevarar tillstånd (`~/.lolly`: sessioner, mappar, profil) och dess Profile-vy kan säkerhetskopiera det, men den skriver ett *enklare* eget arkiv: `sessions/<slot>.json` per session plus `profile.json` och `folders.json`, utan manifest, utan `formatVersion`/`minReader` och utan integritetskarta. Det går **inte** att importera i detta format - en läsare avvisar det som "not a Lolly backup" - och förvirrande nog använder det ett liknande namn (`lolly-backup-<stamp>.zip`). Att förena de två är en känd lucka.

## Reserverade utökningspunkter

Kuvertet är ett manifest plus en uppsättning namngivna delar med avsikt, så att nya typer av portabel data kan ansluta senare **utan en brytande ändring**. De läggs till som additiva delar (ny `formatVersion`, samma `minReader`), och dagens läsare hoppar över det den inte känner igen. Dessa finns på [färdplanen](/info/overview.html#roadmap), ännu inte implementerade. Namnen är reserverade här så att formatet förblir sammanhängande när de väl landar.

- **`tokens.json` - designtokens.** Ett [W3C DTCG](https://tr.designtokens.org/format/) designtoken-dokument (formatet [Penpot importerar och exporterar](https://help.penpot.app/user-guide/design-systems/design-tokens/) - tokens med `$value`/`$type`/`$description`, organiserade i grupper, set och teman). Ett tokenset i bunten låter en användare flytta sina varumärkesprimitiver mellan installationer tillsammans med sina sessioner. På längre sikt blir ett ingesterat tokenset en förstklassig källa som verktyg och palett-tillgångar löser mot.
- **`penpot/` - ingesterade Penpot-filer.** En reserverad katalog för en Penpot-fil (eller dess extraherade, Lolly-relevanta delmängd) importerad och exponerad *som ett verktyg*. Bunten kommer att bära den ingesterade definitionen, så att den följer med resten av användarens data.

Allt utanför dessa reserverade namn och delarna ovan är, för en läsare, en okänd del: lämnas orörd och räknas i `skipped`.

## Referens

- Modul: [`shells/web/src/data-transfer.ts`](../shells/web/src/data-transfer.ts) (`exportBackup`, `importBackup`, `BACKUP_FORMAT`, `BACKUP_FORMAT_VERSION`, `BACKUP_READER_VERSION` - namngivaren `backupFilename()` är intern).
- Kontraktstest: [`tests/data-transfer.test.ts`](../tests/data-transfer.test.ts) - tur-och-retur, sammanslagning, integritet, framåtkompatibilitet och läsarspärr-fall.
- Bryggyta som används: `host.profile`, `host.state`, `host.assets` - se [Host API](/info/host-api.html).
