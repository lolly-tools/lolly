# Dataöverföring - paketet `lolly-backup`

Allt en Lolly-användare samlar på sig finns **på deras enhet** - inget konto, inget moln. Dataöverföringspaketet är hur det värdet flyttas: exportera det från en installation, ta med filen på valfritt sätt (USB, AirDrop, e-post till dig själv, en nätverksdelning) och importera den på en annan. Filen *är* transporten. Målet kan vara offline eller online. Det spelar ingen roll, eftersom inget någonsin pratar med en server.

![De två knapparna som flyttar en hel installation: Exportera mina data skriver en zip, Importera data läser in den igen](/t/url-shot?url=%2F%23%2Fsettings%3Ffocus%3Dstorage-section&width=1440&height=1800&dpi=192&waitMs=2400&css=.store-manages%7Bdisplay%3Anone%7D&walker=1&format=svg&cropSelector=%23storage-section%20.storage-subsection&dark=1&filename=pd-transfer-controls)

Den här sidan är formatspecifikationen. För slutanvändargenomgången, se [Hitta och återfå ditt arbete → Flytta ditt arbete till en annan enhet](/info/find-your-work.html#move-your-work-to-another-device). Implementationen är [`shells/web/src/data-transfer.ts`](../shells/web/src/data-transfer.ts), och [`tests/data-transfer.test.ts`](../tests/data-transfer.test.ts) fastställer kontraktet för tur-och-retur.

> **Omfattning.** Ett paket bär *användardata*, inte katalogverktyg. Katalogverktyg och katalogtillgångar synkas separat och antas redan finnas på målet (i värsta fall i en högre version); verktyg en användare själv har gjort följer med inuti `profile.json`. Import installerar eller uppgraderar aldrig ett katalogverktyg.

## Mål

- <!--i:box--> **Ett format, alla skal.** Webb-PWA:n, Tauri-skrivbords-/mobilapparna och framtida skal delar samma kuvert och samma schema för de delar de stöder. Valfria delar beror på varje skals förmågor; delar som inte stöds rapporteras. Varje capability bridge tillhandahåller sin egen lagringsadapter.
- <!--i:shieldcheck--> **Överlever resan.** Ett paket som skadats eller trunkerats under transport misslyckas högljutt vid import, återställer aldrig till hälften.
- <!--i:clock--> **Överlever den här versionen.** En äldre app kan fortfarande importera de delar av ett nyare paket den känner igen. Ett format som verkligen är brytande avvisas rent.
- <!--i:check--> **Säkert att slå samman.** Att importera till en installation som redan används suddar aldrig ut något som inte fanns i paketet.

## Kuvertet

Ett paket är en vanlig `.zip`. Nedladdningen namnges efter personen den tillhör - `LollyTools-<First>-<Last>-<YYYY-MM-DD>-<n>.zip` (till exempel `LollyTools-Ada-Lovelace-2026-06-26-1.zip`) - så att en Downloads-mapp full av säkerhetskopior förblir läsbar. Förnamns- och efternamnsdelarna kommer från profilen och utelämnas om de inte är ifyllda. Ingen profil ger `LollyTools-2026-06-26-1.zip`, och enbart förnamn ger `LollyTools-Ada-2026-06-26-1.zip`. Varje del saneras till en filnamnssäker token (Unicode-bokstäver/siffror behålls, mellanslag/skiljetecken tas bort, begränsat till 32 tecken). `<n>` är en sekvens per dag och enhet, så upprepade exporter samma dag inte krockar och förblir i ordning. `backupFilename()` i [`shells/web/src/data-transfer.ts`](../shells/web/src/data-transfer.ts) bygger namnet. Zip-innehållet är identiskt oavsett namn. Innehåll:

| Sökväg | Krävs | Innehåll |
|---|---|---|
| `manifest.json` | ja | Format-id, versioner, antal och integritet per del. Det första en läsare tittar på. |
| `profile.json` | när ifylld | Användarens hela `me`-post: namn, kontaktuppgifter, referens till profilbild och flaggor, plus mappar, Papperskorg, projektmallar, användarmallar och användargjorda verktyg, favoriter, dolda verktyg, språk- och emoji-val. Läses via `host.profile`. |
| `sessions.json` | ja | Varje sparad session: plats, verktygs-id/version, etikett, miniatyrbild (data-URL) och all indata. Läses via `host.state`. |
| `assets.json` | ja | Metadata för varje uppladdad tillgång (bilder, typsnitt, varumärkestoken, logotyper, sparade kopior av nedladdningar), var och en pekande på sina byte under `assets/blobs/`. |
| `assets/blobs/<n>.<ext>` | per tillgång | De råa byten för tillgången (bild- och typsnittsfiler). Lagras okomprimerat (redan komprimerade format). Filändelsen är kosmetisk. MIME-typen i `assets.json` är auktoritativ. |
| `assets/blobs/<n>.c2pa` | när närvarande | Extraherade Content Credentials som exakta binära byte, refererade av `_credentialFile` i tillgångsposten. Dessa är inte enhetens signeringsnycklar. |
| `design-systems.json` | när närvarande | Designsystemen som skapats eller lagts till på den här installationen, som `{ active, records }`. Slås samman efter id vid import; paketets aktiva val gäller bara när målet inte har något eget designsystem. |
| `file-history.json` | valfri | Versionerade tillgångsögonblicksbilder, terminalens filoperationsrapporter och kompletta batch-manifest. Historikdelen har sin egen version; tillhandahålls av skalets interna säkerhetskopieringsadapter `fileHistory`. |
| `revision-history.json` | valfri, manuella säkerhetskopior | Stabila skapelse-ID:n, bevarade checkpoints, miniatyrer och löpande återställningsutkast. Tillhandahålls av `host.state.history.backup` där det stöds. |
| `file-history/versions/` | per ögonblicksbild | Tidigare tillgångsbyte och extraherade credentials, oberoende av om den aktuella tillgången fortfarande finns. |
| `file-history/results/` | per avslutad operation | Exakta utdatabyte. Ingen ursprunglig fil vald för konvertering behålls eller inkluderas. |
| `prefs.json` | ja | Användarägda lokala inställningar: `theme`, `sidebarWidth` och aktivitetsräknaren `ct-metrics`. |
| `lolly.txt` | ja | En människoläsbar sammanfattning av paketet (antal, profil, filnamn) för den som öppnar zip:en utan Lolly. Genereras på nytt vid varje export och känns igen vid import, så den räknas aldrig som en överhoppad del. Den skrivs *efter* integritetskartan, så den ligger utanför den. |

Paketet är avsiktligt en vanlig zip: det överlever alla transporter intakt, och vilket uppackningsverktyg som helst kan inspektera det.

`profile.json` är den minsta delen och den en läsare ser först i appen: uppgifterna som en producent fyller i en gång, plus samtycket som låter verktyg använda dem.

![Profilformuläret med detaljer som blir profile.json - namn, kontaktuppgifter, profilbild och samtycket bredvid dem](/t/url-shot?url=%2F%23%2Fprofile&width=1440&height=900&dpi=192&waitMs=1800&format=svg&cropSelector=.profile-details-grid&walker=1&dark=1&filename=ce-profile-record)

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
- Profilen är en enda post, så den ersätts helt: målets mappar, Papperskorg, mallar, favoriter och dolda verktyg blir paketets. En session som målet hade men paketet inte hade behålls, ej i någon mapp, på översta nivån i Projekt.
- Historiska tillgångsversioner och operations-ID:n är oföränderliga undantag: en upprepad import är idempotent, och ett ID som redan namnger andra byte/annan historik avvisas, skrivs inte över. Att återimportera en identisk aktuell tillgång bevarar dess version. En ändrad aktuell tillgång måste bära en annan version.
- Skapelsehistorik är också ett undantag: en motstridig aktuell dokument- eller revisionsidentitet avbryter dess återställning innan profil-, tillgångs- eller inställningsändringar görs. En identisk upprepad import lägger inte till någon lagring. Återställ ett motstridigt arkiv på en separat installation för att inspektera och kopiera dess skapelser.
- Inget som inte fanns i paketet rörs. En session som målet hade men paketet inte hade överlever importen.

Sparade sessioner länkas automatiskt om till sina bilder: tillgångsreferenser bevaras via id, och bryggan löser upp dem på nytt efter att de uppladdade bilderna återställts (det måste den ändå göra, eftersom `blob:`-URL:er inte överlever en omladdning).

Importsammanfattningen rapporterar `{ profile, sessions, userAssets, prefs, skipped, failedAssets }`. `failedAssets` räknar uppladdade tillgångar som inte kunde återställas (till exempel fullt enhetslagringsutrymme). Det skiljer sig från `skipped`, som räknar delar från en framåtkompatibel nyare skribent som den här versionen inte kände igen. Gränssnittet visar `skipped` ("… · N newer items skipped"), så återställningen är ärlig om vad den lämnade kvar.

När filhistorik finns med bär sammanfattningen också `assetVersions`, `fileOperations` och `failedHistory`. Uttömd lagring eller oföränderliga ID-konflikter kan orsaka en delvis återställning; gränssnittet ber användaren behålla källsäkerhetskopian. Molnsynk flyttar **inte** fram sin tillämpade revision efter en delvis eller ostödd återställning, så ögonblicksbilden förblir tillgänglig för ett nytt försök. Återställning är inte en enda transaktion över alla profil-/sessions-/tillgångs-/historiklager.

## Skapelsehistorik (v3)

Manuella säkerhetskopior från en historikkapabel webbvärd inkluderar `revision-history.json` med sitt eget schema `{ version: 1, documents, revisions, recoveries }`. Den bär de bevarade ID:na, kanoniska indataögonblicksbilder, versionsstämplar, rasterförhandsvisningar och separata skrivarutkast. Historikadaptern fångar aktuella sessioner och deras huvuden i en enda läs-transaktion; `sessions.json` använder samma aktuella ögonblicksbilder för äldre läsare.

Återställning kontrollerar nyttolastens SHA-256 och bytantal, unika identiteter, dokument-/huvud-relationer, härkomst, tidsstämplar, förhandsvisningstyper och gränser innan arkivet checkas in i en enda transaktion. Komprimerade föräldrareferenser kan saknas. Befintligt aktuellt arbete måste matcha det importerade dokumentet; konflikter avvisas i stället för att tyst ersätta det. Arkivets överföringsgräns på 384 MiB kontrolleras explicit, och lagringsgränser upprätthålls utan att trunkera bevarade checkpoints. Hela säkerhetskopian använder fortfarande en in-memory ZIP-implementation och är inte ett strömmande arkiv.

Sammanfattningen lägger till `revisions` och `recoveryDrafts`. Ett skal utan den här förmågan återställer vanliga sessioner och rapporterar historikdelen som överhoppad. Historik för det inbyggda filsystemet förblir ostödd tills dess adapter tillhandahåller varaktiga historiktransaktioner. P2P-gästtillstånd har ingen varaktig historik eller något återställningsarkiv.

Personlig ögonblicksbildsynk utesluter uttryckligen skapelsehistorik. Att tillämpa en ögonblicksbild på ett lokalt dokument med historik bevarar dess tidigare arbetstillstånd som ett separat återställningsutkast och ogiltigförklarar en öppen redigerares skrivtoken. Dess oföränderliga checkpoints finns kvar på enheten. Det här skyddar lokal historik under utbyte av ögonblicksbild; det slår inte ihop samtidiga enheters historik.

Historiska tillgångsreferenser bevaras, medan rendering fortfarande löser upp tillgångar via målets befintliga bibliotek. Det här arkivet garanterar ännu inte exakta gamla tillgångsbyte eller gamla verktygsrenderingar. Byte för tillgångsversioner och filresultat fortsätter att följa med via sin befintliga separata säkerhetskopieringsdel.

## Sparade versioner och filresultat (v2)

Den valfria historikdelen innehåller `{ version: 2, assetVersions: [...], operations: [...], batches: [...] }`; läsare accepterar också den tidigare formen history-v1 utan batchar. Varje ögonblicksbild identifierar det stabila tillgångs-ID:t och den exakta versionen, dess sparandetid, bytlängd och hex-SHA-256, plus en tillgångspost vars `_file` och valfria `_credentialFile` pekar på binära delar. Operationer bär de ursprungliga filfakta, förfrågan, rapporten, tidsstämplar och en valfri resultat-`_file`; namn på lagringsbackend, OPFS-handtag och körningsleasar följer inte med. Äldre läsare som bara känner till history-v1 avvisar den nya historikversionen innan import, i stället för att tyst tappa batchmedlemskap.

Batch-manifest registrerar varje vald källa innan bearbetning, inklusive filer som aldrig lästs, avbrutna medlemmar, misslyckanden att reservera resultatutrymme och avbrutet arbete. Varje medlem har ett stabilt operations-ID, källreferens/-fakta, begärt utdatanamn och terminalrapport. En oläst källa har deklarerade fakta, inte en påhittad digest. Import validerar medlemsidentitet och konsistens mot en eventuell medföljande operationsrapport. Batch-rapporter förblir tillgängliga när enskilda resultat uttryckligen har tagits bort, men ett kvitto innebär inte att dess utdatabyte fortfarande är sparade.

- Varje känd historikpost, rapport och refererad fil valideras innan någon profil- eller tillgångsimport skriver. Saknade byte och avvikande SHA-256 misslyckas även om kuvertet inte har någon integritetskarta. Extraherade credentials förblir bytearrayer, inklusive importer från äldre skribenter som JSON-serialiserade dem som objekt med numeriska nycklar.
- Pågående operationer blir avbrutna poster i säkerhetskopian, med en förklarande felrapport och inget resultat. Återställning startar aldrig om bakgrundsarbete eller importerar en aktiv lease. Att försöka igen kräver att man väljer originalfilen, kontrollerad mot dess registrerade SHA-256 när den finns tillgänglig.
- Återställda resultat checkar in sina byte och sin metadata tillsammans i IndexedDB. Vanliga nya resultat använder OPFS där det finns, med IndexedDB som reserv. En befintlig aktiv operation ersätts aldrig av en import.
- ZIP-sammansättningen för historik sker fortfarande i minnet: den aktuella gränsen är **256 MiB historik-nyttolast**, **4 MiB historikmetadata**, som mest **100 operationer**, **100 batchar** och **2 000 ögonblicksbilder**. Export avvisar explicit historik som är för stor eller ofullständig; den utelämnar den aldrig i tysthet. Ladda ner viktiga versioner/resultat individuellt innan du tar bort äldre lokala kopior. De här gränserna är ingen uppmätt garanti för minnestopp på telefoner.
- Lokal resultathistorik har en budget på 512 MiB och ett tak på 100 poster. Tillgångsögonblicksbilder har en separat budget på 512 MiB och som mest 20 historiska versioner per tillgång; extraherade credential-byte räknas mot den ögonblicksbildsbudgeten. Återställning respekterar de här gränserna och vräker aldrig tyst befintlig användardata.
- Lokal batch-metadata har en separat budget på 4 MiB, som mest 100 manifest och 20 medlemmar per batch. Väntande medlemmar reserverar metadatakapacitet, med ett tak på 32 KiB per medlemsrapport. Det här är en logisk budget, ingen garanti för webbläsarens diskutrymme; ett verkligt kvotfel visas och den rapport som finns i minnet förblir nedladdningsbar. Att försöka en batch-medlem igen skapar en ny batch utan att skriva över den gamla rapporten. Att ta bort en batch-post tar inte bort enskilda resultatbyte eller biblioteks-tillgångar.
- Konverterade resultat kan uttryckligen läggas till i biblioteket utan normalisering eller omkodning. Käll-/utdatahashar och operationsrelationen följer med tillgången. Upprepade tillägg återanvänder en oförändrad kopia; en redigerad kopia skrivs aldrig över. Rasterbilder kan starta ett nytt Design-dokument. Det dokumentet använder det aktuella bibliotekstillgångs-ID:t: att upprätthålla exakta versionslåsningar genom hela Designs körtid och URL-sökväg är fortfarande separat arbete. SVG-/HTML-/PDF-/ZIP-resultat hålls som opaka filtillgångar av den här överlämningen, befordras inte till betrott interaktivt/vektorinnehåll.
- **Convert → Recent file operations** exponerar historikanvändning, rapporter, nedladdningar och versionshanteraren. Hanteraren hittar också tidigare versioner av raderade bibliotekstillgångar. Att återställa en ögonblicksbild skapar en ny aktuell version medan den valda ögonblicksbilden förblir intakt. **Inställningar → Lagring** redovisar resultat och versioner separat från slopbara cacher.
- Uttrycklig städning av temporära filer tar bara bort byte som ägs av en operation och inte längre refereras. Aktuella poster skyddar sina filer; nyliga OPFS-filer har en respittid på en timme. Sparade resultat och tillgångsögonblicksbilder rensas inte automatiskt.

Äldre läsare accepterar fortfarande v2-kuvertet (`minReader: 1`) och återställer bekanta delar, och räknar historikdelar som inte stöds som överhoppade. Fullständig historikåterställning kräver ett skal med adaptern `fileHistory`; det här är en skalintern skarv, inte en ny verktygsvänd `HostV1`-förmåga. Verklig återställning mellan två enheter täcks av den lokala Chromium-grinden; godkännande av återställning i installerade Tauri-/iOS-/Android-appar förblir separat.

## Vad som inte följer med

- **Katalogcacher** (nedladdad tillgångsmetadata och blobbar, verktygsindexet) - synkas om gratis på målet.
- **Katalogverktyg och katalogtillgångar** - utanför omfattning, och antas redan finnas på målet. Varumärkestoken, typsnitt och logotyper som användaren lagt till är användartillgångar, så de följer med.
- **`blob:` / objekt-URL:er** - genereras om av bryggan vid inläsning.
- **Konverteringsoriginal, aktiva körningsleasar och maskinlokala åtkomst-/signeringshemligheter** - ingen portabel historik-nyttolast. Ett sparat resultat är en kopia, inte ett löfte om att originalkällan säkerhetskopierades.
- **Exportsekvensräknaren** - räknaren för nedladdningsnamn per dag (`localStorage`-nyckeln `lolly-export-seq`) är en lokal namngivningsbekvämlighet. Den hålls utanför `PREF_KEYS`, så den följer aldrig med i ett paket.

Lagringsmätaren specificerar samma uppdelning. Saved sessions, My images och File results & versions följer med i ett paket. Tillgångscachen, verktygsförhandsvisningarna och offlinefästningarna under dem kan alla härledas på nytt, så de stannar kvar.

![Lagringsmätaren som delar upp den här enhetens data i namngivna kategorier, med Saved sessions och My images spårade separat från Asset cache, här på en ny installation där varje kategori fortfarande är tom](/t/url-shot?url=%2F%23%2Fprofile%3Ffocus%3Dstorage-section&width=1440&height=1600&dpi=192&waitMs=2600&format=svg&css=.store-manages%2C.storage-subsection%2C.store-selbar%7Bdisplay%3Anone%7D&cropSelector=.store-meter&walker=1&dark=1&filename=ce-storage-categories)

## Garanti mellan skal

`data-transfer.ts` läser och skriver uteslutande via kapabilitetsbryggan (`host.profile`, `host.state`, `host.assets`) och de delade `localStorage`-inställningarna. Samma modul läser och skriver det gemensamma kuvertet på webben och Tauri, via IndexedDB eller filsystemlagring. Valfria historikdelar visas bara där motsvarande adapter finns tillgänglig; en del som inte stöds rapporteras som överhoppad vid import. Den huvudlösa testsviten kör de gemensamma delarna mot en in-memory-brygga, medan historiktransaktioner också har tester i en riktig webbläsare.

Två skal står utanför den garantin, av olika skäl:

- Den **engångskörda CLI:n** har inget att bära med sig - dess tillstånd finns i minnet och är flyktigt per anrop.
- **TUI:n** bevarar tillstånd (`~/.lolly`: sessioner, mappar, profil) och dess Profile-vy kan säkerhetskopiera det, men den skriver ett *enklare* eget arkiv: `saved-state/<slot>.json` per session plus `profile.json` och `folders.json`, utan manifest, utan `formatVersion`/`minReader` och utan integritetskarta. Det går **inte** att importera i detta format - en läsare avvisar det som "not a Lolly backup" - och förvirrande nog använder det ett liknande namn (`lolly-backup-<stamp>.zip`). Att förena de två är en känd lucka.

## Reserverade utökningspunkter

Kuvertet är ett manifest plus en uppsättning namngivna delar med avsikt, så att nya typer av portabel data kan ansluta senare **utan en brytande ändring**. De läggs till som additiva delar (ny `formatVersion`, samma `minReader`), och dagens läsare hoppar över det den inte känner igen. Dessa är inte byggda än. Namnen är reserverade här så att formatet förblir sammanhängande när de väl landar.

- **`tokens.json` - designtokens.** Ett [W3C DTCG](https://tr.designtokens.org/format/) designtoken-dokument (formatet [Penpot importerar och exporterar](https://help.penpot.app/user-guide/design-systems/design-tokens/) - tokens med `$value`/`$type`/`$description`, organiserade i grupper, set och teman). Ett tokenset i bunten låter en användare flytta sina varumärkesprimitiver mellan installationer tillsammans med sina sessioner. (En användares egna varumärkestoken följer redan idag med som tillgången `user/tokens/brand` i `assets.json`; den här delen skulle bära ett helt DTCG-dokument med sina set och teman.) På längre sikt blir ett ingesterat tokenset en förstklassig källa som verktyg och palett-tillgångar löser mot.
- **`penpot/` - ingesterade Penpot-filer.** En reserverad katalog för en Penpot-fil (eller dess extraherade, Lolly-relevanta delmängd) importerad och exponerad *som ett verktyg*. Bunten kommer att bära den ingesterade definitionen, så att den följer med resten av användarens data.

Allt utanför dessa reserverade namn och delarna ovan är, för en läsare, en okänd del: lämnas orörd och räknas i `skipped`.

## Referens

- Modul: [`shells/web/src/data-transfer.ts`](../shells/web/src/data-transfer.ts) (`exportBackup`, `importBackup`, `BACKUP_FORMAT`, `BACKUP_FORMAT_VERSION`, `BACKUP_READER_VERSION` - namngivaren `backupFilename()` är intern).
- Kontraktstest: [`tests/data-transfer.test.ts`](../tests/data-transfer.test.ts) - tur-och-retur, sammanslagning, integritet, framåtkompatibilitet och läsarspärr-fall.
- Historikkontraktstester: [`tests/file-history-backup.test.ts`](../tests/file-history-backup.test.ts), [`tests/file-batch-history.test.ts`](../tests/file-batch-history.test.ts) och [`tests/file-result-library.test.ts`](../tests/file-result-library.test.ts). Webbläsargodkännande: [`tests/file-history.browser.test.ts`](../tests/file-history.browser.test.ts), [`tests/file-batch-history.browser.test.ts`](../tests/file-batch-history.browser.test.ts) och [`tests/file-result-reuse.browser.test.ts`](../tests/file-result-reuse.browser.test.ts).
- Bryggyta som används: `host.profile`, `host.state`, `host.assets` - se [Host API](/info/host-api.html).
