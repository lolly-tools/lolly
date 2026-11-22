# Dataöverföring: paketet `lolly-backup`

Ett säkerhetskopieringspaket flyttar det personliga bibliotek som Lolly behåller på enheten: exportera det på en installation, för över filen (USB, AirDrop, mejl till dig själv eller en nätverksresurs) och importera den på en annan. Export och import behöver ingen server, och målet kan vara offline.

Det här är formatspecifikationen för personer som bygger skal, verktyg eller skript kring säkerhetskopior. För att flytta ditt eget arbete, läs [Flytta ditt arbete till en annan enhet](/info/find-your-work.html#move-your-work-to-another-device).

![De två knapparna som flyttar en hel installation: Export my data skriver en zip-fil, Import data läser in den igen](/t/url-shot?url=%2F%23%2Fsettings%3Ffocus%3Dstorage-section&width=1440&height=1800&dpi=192&waitMs=2400&css=.store-move%3Ediv%3Anth-of-type%282%29%2C.store-move%3Ep%3Alast-of-type%7Bdisplay%3Anone%7D&waitSelector=%5Bdata-store-group%3Dmove%5D&drive=click%3A%5Bdata-store-group%3Dmove%5D%3Esummary&walker=1&format=svg&cropSelector=%5Bdata-store-group%3Dmove%5D&dark=1&filename=pd-transfer-controls)

::: note Omfattning
Ett paket innehåller *användardata*, inte katalogverktyg. Katalogverktyg och katalogtillgångar synkas separat och förutsätts finnas på målet, i värsta fall i en högre version. Verktyg som en användare har skapat följer med i `profile.json`. Import installerar eller uppgraderar aldrig ett katalogverktyg.
:::

<!--i:eti-badge-check-->
## Mål

- <!--i:box--> **Ett format, alla skal.** Webbappen, dator- och mobilapparna och framtida skal delar samma behållare och delscheman. Valfria delar beror på varje skals funktioner, och delar som inte stöds rapporteras. Varje funktionsbrygga tillhandahåller sin lagringsadapter.
- <!--i:shieldcheck--> **Klarar överföringen.** Ett paket som skadas eller kapas under överföringen ger ett fel vid import och återställs aldrig till hälften.
- <!--i:clock--> **Överlever den här versionen.** En äldre app importerar de delar av ett nyare paket som den känner igen. Ett inkompatibelt format avvisas korrekt.
- <!--i:check--> **Säkert att slå samman.** Import till en installation som redan används raderar aldrig något som inte fanns i paketet.

<!--i:eti-package-->
## Behållaren

Ett paket är en vanlig `.zip`. Det klarar all överföring intakt, och vilket uppackningsverktyg som helst kan granska innehållet.

Nedladdningen namnges efter sin ägare: `LollyTools-<First>-<Last>-<YYYY-MM-DD>-<n>.zip`, till exempel `LollyTools-Ada-Lovelace-2026-06-26-1.zip`. För- och efternamnen kommer från profilen och utelämnas när de inte är angivna: ingen profil ger `LollyTools-2026-06-26-1.zip`, och enbart ett förnamn ger `LollyTools-Ada-2026-06-26-1.zip`. Varje namn blir en filnamnssäker token (Unicode-bokstäver och siffror behålls, mellanslag och skiljetecken tas bort, högst 32 tecken). `<n>` är en sekvens per dag och enhet, så upprepade exporter samma dag inte krockar och behåller sin ordning. `backupFilename()` i `data-transfer.ts` bygger namnet. Namnet ändrar inte zip-filens innehåll.

| Sökväg | Krävs | Innehåll |
|---|---|---|
| `manifest.json` | ja | Format-id, versioner, antal och integritet per del. En läsare läser den här filen först. |
| `profile.json` | när angiven | Användarens `me`-post: namn, kontakt, referens till porträttbild och flaggor, plus mappar, Trash, projektplaner, användarmallar och användarskapade verktyg, favoriter, dolda verktyg, språk och emojival. Läses via `host.profile`. |
| `sessions.json` | ja | Varje sparad session: plats, verktygs-id och version, etikett, miniatyrbild (data-URL) och fullständiga indata. Läses via `host.state`. |
| `assets.json` | ja | Metadata för varje uppladdad tillgång (bilder, typsnitt, varumärkestokens, logotyper, sparade kopior av nedladdningar), var och en med en pekare till sina byte under `assets/blobs/`. |
| `assets/blobs/<n>.<ext>` | per tillgång | Tillgångens råa byte, lagrade okomprimerade eftersom de flesta redan är i komprimerade format. Filändelsen är kosmetisk; MIME-typen i `assets.json` är avgörande. |
| `assets/blobs/<n>.c2pa` | när den finns | Extraherade Content Credentials som exakta binära byte, refererade av `_credentialFile` i tillgångsposten. Det här är inte enhetens signeringsnycklar. |
| `design-systems.json` | när den finns | Designsystemen som skapats eller lagts till på den här installationen, som `{ active, records }`. Se [Importregler](#import-rules). |
| `file-history.json` | valfri | Versionshanterade ögonblicksbilder av tillgångar, rapporter över slutförda filoperationer och fullständiga batchmanifest, med en egen version. Tillhandahålls av skalets interna säkerhetskopieringsadapter `fileHistory`. |
| `revision-history.json` | valfri, manuella säkerhetskopior | Stabila id:n för arbeten, behållna kontrollpunkter, miniatyrbilder och löpande återställningsutkast. Tillhandahålls av `host.state.history.backup` där det stöds. |
| `file-history/versions/` | per ögonblicksbild | Tidigare tillgångsbyte och extraherade intyg, oavsett om den aktuella tillgången fortfarande finns. |
| `file-history/results/` | per slutförd operation | Exakta utdatabyte. Ingen originalfil som valts för konvertering behålls eller tas med. |
| `prefs.json` | ja | Användarens egna lokala inställningar: `theme`, `sidebarWidth` och aktivitetsräknaren `ct-metrics`. |
| `lolly.txt` | ja | En läsbar sammanfattning av paketet (antal, profil, filnamn) för alla som öppnar zip-filen utan Lolly. Genereras på nytt vid varje export och känns igen vid import, så den räknas aldrig som en överhoppad del. Den skrivs efter integritetskartan, så kartan omfattar inte den här filen. |

::: details Så skriver exporten zip-filen
Exporten skriver zip-filen en del i taget (`shells/web/src/lib/zip-stream.ts`). Uppladdningar, sparade resultat och sparade tillgångsversioner läses i delar om 4 MiB, aldrig i sin helhet. Sparade resultat och versioner kontrolleras först mot sin registrerade SHA-256. Varje fil läses sedan för sin kontrollsumma och integritetshash, och zip-filen refererar till filen på plats.

Inget kodas om. Varje del behåller sina exakta byte och sin hashsumma, så en fil med Content Credentials behåller de byte som dess signatur omfattar. Med samma delar och tid är zip-filen identisk med den från den tidigare skrivaren som arbetade i minnet, förutom att en historikfil över 16 MiB komprimeras i delar. `tests/backup-streaming.test.ts` kontrollerar detta mot registrerade referenshashar.

Med ett syntetiskt bibliotek på 192 MiB, mätt i Node, krävde slutförandet av säkerhetskopian cirka 125 till 150 MiB utöver biblioteket, jämfört med cirka 850 MiB för skrivaren som arbetade i minnet (`node scripts/bench-backup-finalise.ts`). Importen läser fortfarande in hela zip-filen i minnet.
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

| Fält | Betydelse |
|---|---|
| `format` | Alltid `lolly-backup`. En fil utan det avvisas som ”inte en Lolly-säkerhetskopia”. |
| `formatVersion` | Den struktur som paketet **skrevs** med. Höjs vid varje ändring av deluppsättningen eller delarnas struktur. Läsare avgör **inte** kompatibiliteten med det här fältet. |
| `minReader` | Den lägsta läsarversion som kan importera paketet **säkert**. Det är fältet som läsare avgör kompatibiliteten med. |
| `app` | Id för appen som skapade paketet, för diagnostik. |
| `exportedAt` | ISO-tidsstämpeln när paketet skapades. |
| `counts` | Det som skrivaren lade in, för visning och rimlighetskontroller. |
| `integrity` | Valfritt. Mappar varje del utom `manifest.json` till en hashsumma i SRI-stil, `sha256-<base64>`, av dess **okomprimerade** byte. |

<!--i:eti-tag-->
## Versionspolicy

Två versionsnummer låter formatet växa utan att lämna äldre installationer utan stöd.

![En ändring av paketformatet är antingen additiv, vilket gamla läsare kan ignorera, eller inkompatibel, där en felaktig import skadar data. En additiv ändring höjer formatVersion och behåller minReader; en inkompatibel höjer formatVersion och minReader. En läsare importerar när minReader är högst dess egen version.](/info/diagrams/concepts/backup-version-gate.svg)

- En läsare importerar ett paket när `manifest.minReader` är högst dess egen läsarversion. Den avvisar det med ”kräver en nyare version av appen” bara när paketet kräver en nyare läsare.
- En **additiv** ändring, till exempel en ny valfri del eller ett nytt valfritt manifestfält, höjer `formatVersion` och lämnar `minReader` oförändrat. Äldre appar importerar fortfarande varje del de känner igen, och delar de inte känner igen rapporteras som överhoppade i stället för att utelämnas utan besked.
- En **inkompatibel** ändring, där en felaktig import av en del skadar data eller en valfri del blir obligatorisk, höjer `minReader`. Äldre appar avvisar då korrekt i stället för att importera något de inte kan hantera. Äldre appar avvisar då paketet korrekt.
- Om ett framtida paket anger `formatVersion` men utelämnar `minReader` faller läsare tillbaka på att avgöra kompatibiliteten med `formatVersion` och behandlar ändringen som inkompatibel.

::: note Tumregel för upphovspersoner
Om varje befintlig läsare fortfarande skulle göra rätt genom att ignorera ditt tillägg är ändringen additiv: höj `formatVersion` och lämna `minReader`. Höj annars `minReader`.
:::

<!--i:eti-shield-check-->
## Integritet

När `manifest.integrity` finns kontrollerar en läsare varje listad dels SHA-256 **innan något skrivs**. En avvikelse (”klarade inte integritetskontrollen”) eller en saknad del (”ofullständig”) stoppar importen, så ingen partiell återställning sker. Detta fångar överföringsskador: en avbruten AirDrop, en e-postgateway som kodade om bilagan, en dålig USB-sektor.

Integritetskontrollen görs efter förmåga. Integritetsdata skrivs bara där Web Crypto finns (alla säkra webbläsarkontexter och modern Node) och kontrolleras bara när både kartan och Web Crypto finns. Ett paket utan kartan, till exempel ett från tiden före integritetskontrollen, importeras oförändrat: ”kan inte verifiera” räknas aldrig som ”skadad”.

Manifestet listar varken sig självt eller den omgenererade `lolly.txt`.

<!--i:eti-download-->
## Importregler

En import körs i ett av två lägen.

- **Merge** är det som **Import data…** och synkningens första anslutning, **Bring it to this device**, gör. Data på målet finns kvar, och inget utanför paketet rörs.
- **Replace** är det som enhetssynkning använder för att hålla enheter synkade. Den tar den synkade kopians profilpost, inställningar, sessioner, bilder och val av aktivt designsystem. Den tar bara bort objekt som en annan enhet har raderat sedan senaste synkningen. Återställning av en tidigare kopia sparar först enheten, får sedan enheten att stämma med den kopian och tar bort allt som kopian inte innehåller. [Synka dina enheter](/info/sync.html) beskriver vad en person ser.

En sammanslagning behandlar varje sorts data så här:

| Data | Finns redan på målet | Finns bara i paketet |
|---|---|---|
| Sessioner (efter plats) och uppladdade bilder (efter id) | Den senast sparade kopian behålls, så en äldre säkerhetskopia skriver aldrig över nyare arbete. Vid lika eller okända tider behålls målets kopia. | Läggs till |
| Mappar | Målets namn och överordnade mapp behålls, och mappen får de medlemmar från paketet som den saknar. En session som ligger i en mapp på målet ligger kvar där. | Läggs till |
| Favoriter (verktyg, katalogtillgångar och objekt i Projects) | Kombineras | Läggs till |
| Mallar, Projects-mallar och användarverktyg (efter id) | Målets post behålls. | Läggs till |
| Poster i Trash | Målets post behålls. | Läggs till, så ett objekt som kunde återställas på någon av installationerna fortfarande kan det. En post vars mapp används igen på målet, eller vars plats i Trash målet redan använder, utelämnas. |
| Andra profilfält (namn, kontaktuppgifter, språk, funktionsflaggor, dolda verktyg och andra inställningar) | Målets värde behålls. | Hämtas där målets fält är tomt |
| Inställningar (`prefs.json`) | Målets värde behålls. | Skrivs där målet saknar ett värde |
| Designsystem (efter id) | Paketets post ersätter målets. | Läggs till. Paketets aktiva val gäller bara när målet saknar ett eget designsystem. |
| Arbetshistorik | Den senast sparade kopian förblir aktuell, och den andra behålls som ett skyddat utkast. | Läggs till |

**Sparade sessioner länkas automatiskt till sina bilder igen.** Tillgångsreferenser behålls efter id. Bryggan slår upp dem igen när bilderna har återställts, eftersom `blob:`-URL:er inte överlever en omladdning.

**Historikposter ändras aldrig efter att de har skrivits.** En upprepad import av tillgångsversioner och operations-id:n lägger inte till något, och ett id som redan anger andra byte eller annan historik avvisas i stället för att skrivas över. En ny import av en identisk aktuell tillgång behåller dess version, och en ändrad aktuell tillgång måste ha en annan version.

**Arbetshistoriken har några fler regler.** Ett arbete vars plats målet använder för ett annat arbete läggs till som ett separat arbete, och ett arbete i målets Trash stannar där. Ett kontrollpunkts-id som anger annat innehåll på målet behåller målets innehåll. Ett arkiv som inte klarar sina egna kontroller stoppar importen innan någon profil, session, tillgång eller inställning ändras, och en identisk upprepad import tar inget ytterligare lagringsutrymme.

**Sammanfattningen rapporterar vad som hände.** Varje import returnerar `profile`, `sessions`, `userAssets`, `prefs`, `skipped` och `failedAssets`.

- `failedAssets` räknar uppladdade tillgångar som inte kunde återställas, till exempel för att enhetens lagringsutrymme är fullt.
- `skipped` räknar delar från en nyare skrivare som den här versionen inte kände igen. Appen visar antalet (”… · N nyare objekt hoppades över”).
- Med filhistorik lägger sammanfattningen till `assetVersions`, `fileOperations`, `fileBatches` och `failedHistory`. Slut på lagringsutrymme eller en konflikt med ett oföränderligt id kan orsaka en partiell återställning, och appen säger då åt personen att behålla den ursprungliga säkerhetskopian.
- Med arbetshistorik lägger den till `revisions` och `recoveryDrafts`, som bara räknar det som den här importen lade till, och `added`, `kept`, `replaced`, `copies` och `hidden` för hur varje arbete slogs samman. `skippedCheckpoints` räknar kontrollpunkter vars id anger annat innehåll på målet, och `historyLeftOut` räknar äldre kontrollpunkter och utkast som inte fick plats i enhetens historikutrymme.
- En ersättningsimport lägger till `removed` och `failedRemovals`.

Återställningen är inte en enda transaktion över lagren för profil, sessioner, tillgångar och historik. Molnsynkroniseringen uppdaterar **inte** sin tillämpade revision efter en partiell återställning eller en återställning som inte stöds, så kopian finns kvar för ett nytt försök.

<!--i:eti-unlink-->
## Det här följer inte med

- **Katalogcachar** (nedladdade metadata och blobbar för tillgångar, verktygsindexet), som målenheten synkroniserar på nytt.
- **Katalogverktyg och katalogtillgångar**, som antas finnas på målenheten. Varumärkestokens, typsnitt och logotyper som användaren har lagt till är användartillgångar och följer med.
- **`blob:`- och objekt-URL:er**, som bryggan återskapar vid inläsning.
- **Konverteringsoriginal, aktiva körningsreservationer och maskinlokala åtkomst- eller signeringshemligheter.** Dessa är inte portabel historik. Ett sparat resultat är en kopia. Det betyder inte att originalkällan har säkerhetskopierats.
- **Exportsekvensräknaren**, den dagliga räknaren för nedladdningsnamn i `localStorage` (`lolly-export-seq`). Den hålls utanför `PREF_KEYS`, så den följer aldrig med i ett paket.

Lagringsmätaren visar samma uppdelning. Saved sessions, My images och File results & versions ingår i ett paket. Tillgångscachen, verktygsförhandsvisningar och det som fästs för offlinebruk kan återskapas och lämnas kvar.

![Lagringsmätaren delar upp enhetens data i namngivna kategorier, där Saved sessions och My images redovisas separat från Asset cache, här på en ny installation där alla kategorier fortfarande är tomma](/t/url-shot?url=%2F%23%2Fprofile%3Ffocus%3Dstorage-section&width=1440&height=1600&dpi=192&waitMs=2600&format=svg&css=%5Bdata-store-group%3Dmove%5D%2C.storage-actions%2C.store-selbar%7Bdisplay%3Anone%7D&cropSelector=.store-meter&waitSelector=%5Bdata-store-group%3Dmove%5D&drive=click%3A%5Bdata-store-group%3Dwork%5D%3Esummary%3Bclick%3A%5Bdata-store-group%3Dcaches%5D%3Esummary&walker=1&dark=1&filename=ce-storage-categories)

<!--i:eti-building-->
## Organisationsdata med Lolly Work

Det här paketet säkerhetskopierar enhetens personliga bibliotek. Ett paket är inte en säkerhetskopia av en **Lolly Work**-instans. Organisationskonton, åtkomstpolicyer, delade projekt, katalogversioner, godkännanden, renderingsjobb och granskningsposter lagras av den tjänsten. Anslut igen och logga in för att återfå åtkomst till delat arbete. Att importera ett personligt paket ger inte den åtkomsten.

Operatörer säkerhetskopierar, behåller och raderar serverdata med hjälp av Lolly Works egna guider: [Säkerhetskopiering och återställning](/info/work-operations.html#backup-and-restore) och [Lagring och datalivscykel i Lolly Work](/info/work-data-lifecycle.html). Att rensa eller exportera en enhet utför ingen av dessa serveråtgärder.

<!--i:eti-monitor-->
## Mellan skal

`data-transfer.ts` läser och skriver enbart genom kapabilitetsbryggan (`host.profile`, `host.state`, `host.assets`) och de delade inställningarna i `localStorage`. Samma modul läser och skriver det gemensamma omslaget på webben och i dator- och mobilapparna, via IndexedDB eller filsystemslagring. Valfria historikdelar visas bara där deras adapter finns tillgänglig. Importen rapporterar en del som inte stöds som överhoppad. Testsviten utan grafiskt gränssnitt testar de gemensamma delarna mot en brygga i minnet, och historiktransaktioner har också tester i riktiga webbläsare.

Två skal faller utanför den garantin:

- **CLI för engångskörningar** har inget att ta med: dess tillstånd finns i minnet och varar en körning.
- **TUI** lagrar tillstånd i `~/.lolly` (sessioner, mappar, profil). Dess Profile-vy skriver ett eget, enklare säkerhetskopieringsarkiv: `saved-state/<slot>.json` per session samt `profile.json` och `folders.json`, utan manifest, utan `formatVersion` eller `minReader` och utan integritetskarta. En läsare av det här formatet avvisar det arkivet som "inte en Lolly-säkerhetskopia", även om namnen liknar varandra (`lolly-backup-<stamp>.zip`). Att förena de två är en känd lucka.

<!--i:eti-clock-->
## Ännu inte portabelt

Nya typer av portabla data kan tillkomma senare som ytterligare delar (en ny `formatVersion`, samma `minReader`). Designsystem följer redan med på det här sättet, som `design-systems.json` plus sina användartillgångar.

Två namn är reserverade för data som ännu inte följer med:

- **`tokens.json`** skulle innehålla ett [W3C DTCG](https://tr.designtokens.org/format/)-dokument med designtokens och dess grupper, uppsättningar och teman, det format som [Penpot importerar och exporterar](https://help.penpot.app/user-guide/design-systems/design-tokens/). En användares egna varumärkestokens följer redan med som tillgången `user/tokens/brand` i `assets.json`, och ett designsystems tokens följer med dess post.
- **`penpot/`** är reserverat för en inläst Penpot-fil, eller den del som är relevant för Lolly, som visas som ett verktyg.

<!--i:eti-history-->
## Historikdelar

De två historikdelarna är valfria och har egna versioner.

::: details Skapandehistorik (v3)
Manuella säkerhetskopior från en webbinstallation med skapandehistorik innehåller `revision-history.json`, med ett eget schema `{ version: 1, documents, revisions, recoveries }`. Det innehåller sparade ID:n, kanoniska ögonblicksbilder av indata, versionsstämplar, rasterförhandsvisningar och separata skrivarutkast. Historikadaptern hämtar aktuella sessioner och deras senaste revisioner i en enda lästransaktion, och `sessions.json` använder samma aktuella ögonblicksbilder för äldre läsare.

Återställningen kontrollerar nyttolastens SHA-256 och byteantal, unika identiteter, relationer mellan dokument och senaste revisioner, härkomst, tidsstämplar, förhandsvisningstyper och gränser innan arkivet skrivs i en enda transaktion. Referenser till komprimerade föräldrarevisioner kan saknas. Befintligt aktuellt arbete ersätts aldrig utan besked: när ett arbete finns på båda sidor blir den sida som inte behålls som aktuell ett skyddat utkast.

Arkivet har en överföringsgräns på 384 MiB. Lagringsgränser tillämpas utan att sparade kontrollpunkter trunkeras. Exporten skriver `revision-history.json` och `sessions.json` i delar, med samma byte som en enda `JSON.stringify` ger, så hela filtexten hålls aldrig i minnet. En historikfil som skulle överskrida gränsen tas bort i det ögonblick den gör det, och därefter räknas bara dess storlek. Arkivet skapas sedan på nytt utan sina äldsta automatiska kontrollpunkter, och exportsammanfattningen räknar dem som `checkpointsLeftOut`, eller så avvisas arkivet.

Ett skal utan den här kapabiliteten återställer vanliga sessioner och rapporterar historikdelen som överhoppad. Historik i det inbyggda filsystemet förblir utan stöd tills dess adapter tillhandahåller beständiga historiktransaktioner. Gäster i en privat collab har ingen beständig historik eller något återställningsarkiv.

Personlig synkronisering av ögonblicksbilder utelämnar skapandehistoriken. När en ögonblicksbild tillämpas på ett lokalt dokument med historik behålls dess föregående arbetstillstånd som ett separat återställningsutkast, och skrivtoken för alla öppna redigerare ogiltigförklaras. Dess oföränderliga kontrollpunkter stannar på enheten. Detta skyddar lokal historik när en ögonblicksbild ersätts. Det slår inte ihop samtidiga enhetshistoriker.

Historiska tillgångsreferenser behålls, medan renderingen fortfarande slår upp tillgångar genom destinationens befintliga bibliotek. Det här arkivet garanterar ännu inte exakt samma gamla tillgångsbyte eller gamla verktygsrenderingar. Byte för tillgångsversioner och filresultat följer med i en egen del av säkerhetskopian.
:::

::: details Sparade versioner och filresultat (v2)
Den valfria historikdelen innehåller `{ version: 2, assetVersions: [...], operations: [...], batches: [...] }`, och läsare accepterar också det tidigare history-v1-formatet utan batchar. Varje ögonblicksbild anger tillgångens stabila ID och exakta version, spartid, bytelängd och SHA-256 i hexformat, plus en tillgångspost vars `_file` och valfria `_credentialFile` pekar på binära delar. Operationer innehåller originalfilens uppgifter, begäran, rapport, tidsstämplar och en valfri `_file` för resultatet. Namn på lagringsbackend, OPFS-handtag och körningsreservationer följer inte med. Läsare som bara känner till historik v1 avvisar den nya historikversionen före import, så batchtillhörighet tappas aldrig bort utan besked.

Batchmanifest registrerar varje vald källa före bearbetning, inklusive filer som aldrig lästes, avbrutna medlemmar, misslyckade reservationer av resultatutrymme och avbrutet arbete. Varje medlem har ett stabilt operations-ID, källreferens och källuppgifter, begärt utdatanamn och slutrapport. En oläst källa har deklarerade uppgifter, inte en påhittad kontrollsumma. Importen validerar medlemsidentitet och samstämmighet med varje medföljande operationsrapport. Rapporter från Lolly Batch finns kvar när enskilda resultat har tagits bort, men ett kvitto betyder inte att dess utdatabyte fortfarande är lagrade.

- **Validering först.** Varje känd historikpost, rapport och refererad fil valideras innan någon profil- eller tillgångsimport skriver data. Saknade byte och avvikande SHA-256 leder till fel även när omslaget saknar integritetskarta. Extraherade intyg förblir bytearrayer, även vid import från äldre skrivare som serialiserade dem som objekt med numeriska nycklar.
- **Pågående arbete.** Pågående operationer blir avbrutna poster i säkerhetskopian, med en felrapport och utan resultat. Återställning startar aldrig om bakgrundsarbete och importerar aldrig en aktiv reservation. Ett nytt försök innebär att välja originalfilen igen, kontrollerad mot dess registrerade SHA-256 när det finns.
- **Lagring.** Återställda resultat skriver sina byte och metadata tillsammans i IndexedDB. Vanliga nya resultat använder OPFS där det finns, med IndexedDB som reserv. En befintlig aktiv operation ersätts aldrig av en import.
- **Säkerhetskopieringsgränser.** Exporten strömmar dessa byte till arkivet, men återställningen packar fortfarande upp en hel säkerhetskopia i minnet, så gränserna kvarstår: **256 MiB historiknyttolast**, **4 MiB historikmetadata**, högst **100 operationer**, **100 batchar** och **2 000 ögonblicksbilder**. Exporten avvisar uttryckligen för stor eller ofullständig historik och utelämnar den aldrig utan besked. Ladda ner viktiga versioner och resultat ett i taget innan du tar bort äldre lokala kopior. Dessa gränser är ingen uppmätt garanti för maximal minnesanvändning på telefoner.
- **Lokala budgetar.** Lokal resultathistorik har en budget på 512 MiB och en gräns på 100 poster. Ögonblicksbilder av tillgångar har en separat budget på 512 MiB och högst 20 historiska versioner per tillgång, och extraherade intygsbyte räknas in i den budgeten. Återställningen respekterar dessa gränser och tar aldrig bort befintliga användardata utan besked.
- **Batchmetadata.** Lokala batchmetadata har en separat budget på 4 MiB, högst 100 manifest och 20 medlemmar per batch. Väntande medlemmar reserverar metadatakapacitet, med ett rapporttak på 32 KiB per medlem. Detta är en logisk budget, ingen garanti för webbläsarens diskutrymme: ett verkligt kvotfel visas, och rapporten i minnet går fortfarande att ladda ner. Ett nytt försök för en batchmedlem skapar en ny batch utan att skriva över den gamla rapporten. Att ta bort en batchpost tar inte bort enskilda resultatbyte eller bibliotekstillgångar.
- **Resultat i biblioteket.** Konverterade resultat kan läggas till i biblioteket utan normalisering eller omkodning, med källans och utdatans hashvärden och relationen till operationen bifogade. Upprepade tillägg återanvänder en oförändrad kopia, och en redigerad kopia skrivs aldrig över. Rasterbilder kan starta ett nytt Lolly Design-dokument, som använder det aktuella tillgångs-ID:t i biblioteket. Att upprätthålla låsning till exakta versioner genom hela Lolly Designs körmiljö och URL-flöde är ett separat arbete. SVG-, HTML-, PDF- och ZIP-resultat behålls som opaka filtillgångar och upphöjs inte till betrott interaktivt innehåll eller vektorinnehåll.
- **Var det här visas.** **Convert → Recent file operations** visar historikens användning, rapporter, nedladdningar och versionshanteraren, som också hittar tidigare versioner av borttagna bibliotekstillgångar. Att återställa en ögonblicksbild skapar en ny aktuell version och behåller den valda ögonblicksbilden. **Settings → Preferences → Storage** räknar resultat och versioner separat från tillfälliga cachar.
- **Rensning.** Uttrycklig rensning av tillfälliga filer tar bara bort byte som ägs av operationer och saknar referenser. Aktuella poster skyddar sina filer, och nya OPFS-filer har en frist på en timme. Sparade resultat och ögonblicksbilder av tillgångar rensas inte automatiskt.

Äldre läsare accepterar fortfarande v2-omslaget (`minReader: 1`) och återställer de delar de känner till, medan historikdelar som inte stöds räknas som överhoppade. Fullständig historikåterställning kräver ett skal med adaptern `fileHistory`, en anslutningspunkt inne i skalet, inte en `HostV1`-kapabilitet för verktyg. Verklig återställning mellan två enheter täcks av den lokala Chromium-kontrollen. Återställning i installerade dator-, iOS- och Android-appar behöver fortfarande acceptanstestas separat.
:::

<!--i:eti-code-->
## Referens

- Modul: `shells/web/src/data-transfer.ts` (`exportBackup`, `importBackup`, `BACKUP_FORMAT`, `BACKUP_FORMAT_VERSION`, `BACKUP_READER_VERSION`; namngivaren `backupFilename()` är intern).
- Kontraktstest: `tests/data-transfer.test.ts`, som täcker export och återimport, sammanslagning, integritet, framåtkompatibilitet och läsarkontrollen.
- Historikkontraktstester: `tests/file-history-backup.test.ts`, `tests/file-batch-history.test.ts` och `tests/file-result-library.test.ts`. Webbläsaracceptans: `tests/file-history.browser.test.ts`, `tests/file-batch-history.browser.test.ts` och `tests/file-result-reuse.browser.test.ts`.
- Använt brygggränssnitt: `host.profile`, `host.state` och `host.assets`; se [Host API](/info/host-api.html).
