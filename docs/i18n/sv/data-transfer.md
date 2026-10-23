# Dataöverföring: bundlen `lolly-backup`

Lolly behåller ditt personliga bibliotek på enheten. En säkerhetskopieringsbundle är hur biblioteket flyttas: exportera den på en installation, bär filen hur du vill (USB, AirDrop, e-post till dig själv eller en nätverksresurs) och importera den på en annan. Export och import behöver ingen server, och målet kan vara offline.

Den här sidan är formatspecifikationen, för dem som bygger skal, verktyg eller skript kring säkerhetskopior: vad som finns i zippen, hur versioner spärras, hur en import slår ihop och vad som kontrolleras. Genomgången för dem som flyttar sitt eget arbete är [Flytta ditt arbete till en annan enhet](/info/find-your-work.html#move-your-work-to-another-device).

![De två knapparna som flyttar en hel installation: Export my data skriver en zip, Import data läser tillbaka den](/t/url-shot?url=%2F%23%2Fsettings%3Ffocus%3Dstorage-section&width=1440&height=1800&dpi=192&waitMs=2400&css=.store-move%3Ediv%3Anth-of-type%282%29%2C.store-move%3Ep%3Alast-of-type%7Bdisplay%3Anone%7D&waitSelector=%5Bdata-store-group%3Dmove%5D&drive=click%3A%5Bdata-store-group%3Dmove%5D%3Esummary&walker=1&format=svg&cropSelector=%5Bdata-store-group%3Dmove%5D&dark=1&filename=pd-transfer-controls)

> **Omfång.** En bundle bär *användardata*, inte katalogverktyg. Katalogverktyg och katalogtillgångar synkas separat och antas redan finnas på målet, i värsta fall i en högre version. Verktyg som en användare gjort själv färdas inuti `profile.json`. Import installerar eller uppgraderar aldrig ett katalogverktyg.

## Mål

- <!--i:box--> **Ett format, varje skal.** Webbappen, dator- och mobilapparna och framtida skal delar samma kuvert och delscheman. Valfria delar beror på varje skals förmågor, och delar som inte stöds rapporteras. Varje capability bridge tillhandahåller sin lagringsadapter.
- <!--i:shieldcheck--> **Överlever resan.** En bundle som är skadad eller trunkerad under transporten misslyckas högljutt vid import och återställs aldrig till hälften.
- <!--i:clock--> **Överlever den här versionen.** En äldre app kan fortfarande importera de delar av en nyare bundle som den känner igen. Ett verkligt brytande format avvisas rent.
- <!--i:check--> **Säkert att slå ihop.** Att importera på en installation som redan används raderar aldrig något som inte fanns i bundlen.

## Kuvertet

En bundle är en vanlig `.zip`, så den överlever vilken transport som helst intakt och vilket uppackningsverktyg som helst kan granska innehållet.

Nedladdningen är döpt efter personen den tillhör: `LollyTools-<First>-<Last>-<YYYY-MM-DD>-<n>.zip`, till exempel `LollyTools-Ada-Lovelace-2026-06-26-1.zip`, så att en Nedladdningar-mapp med säkerhetskopior förblir läsbar. För- och efternamnet kommer från profilen och utelämnas när de inte är satta: ingen profil ger `LollyTools-2026-06-26-1.zip`, och enbart ett förnamn ger `LollyTools-Ada-2026-06-26-1.zip`. Varje namn reduceras till en filnamnssäker token (Unicode-bokstäver och -siffror behålls, mellanslag och skiljetecken tas bort, högst 32 tecken). `<n>` är en sekvens per dag och per enhet, så upprepade exporter samma dag krockar inte och hålls i ordning. `backupFilename()` i `data-transfer.ts` bygger namnet, och zippens innehåll är detsamma oavsett dess namn.

| Sökväg | Obligatorisk | Innehåll |
|---|---|---|
| `manifest.json` | ja | Format-id, versioner, antal och integritet per del. Det första en läsare tittar på. |
| `profile.json` | när det är satt | Användarens hela `me`-post: namn, kontakt, porträttreferens och flaggor, plus mappar, Trash, projektritningar, användarmallar och användargjorda verktyg, favoriter, dolda verktyg, språk och emojival. Läses via `host.profile`. |
| `sessions.json` | ja | Varje sparad session: plats, verktygs-id och version, etikett, miniatyr (data-URL) och fullständiga indata. Läses via `host.state`. |
| `assets.json` | ja | Metadata för varje uppladdad tillgång (bilder, typsnitt, varumärkestokens, logotyper, sparade kopior av nedladdningar), var och en pekar på sina byte under `assets/blobs/`. |
| `assets/blobs/<n>.<ext>` | per tillgång | De råa tillgångsbyten, lagrade okomprimerade eftersom de flesta redan är komprimerade format. Filändelsen är kosmetisk; MIME-typen i `assets.json` är auktoritativ. |
| `assets/blobs/<n>.c2pa` | när det finns | Utdragna Content Credentials som exakta binära byte, refererade av `_credentialFile` i tillgångsposten. Det är inte enhetens signeringsnycklar. |
| `design-systems.json` | när det finns | Designsystemen som gjorts eller lagts till på den här installationen, som `{ active, records }`. Se [Importregler](#import-rules). |
| `file-history.json` | valfri | Versionshanterade tillgångsögonblicksbilder, färdiga filoperationsrapporter och kompletta batchmanifest, med en egen version. Tillhandahålls av skalets interna backupadapter `fileHistory`. |
| `revision-history.json` | valfri, manuella säkerhetskopior | Stabila skapelse-id:n, behållna kontrollpunkter, miniatyrer och löpande återställningsutkast. Tillhandahålls av `host.state.history.backup` där det stöds. |
| `file-history/versions/` | per ögonblicksbild | Tidigare tillgångsbyte och utdragna credentials, oavsett om den aktuella tillgången fortfarande finns. |
| `file-history/results/` | per färdig operation | Exakta utdatabyte. Ingen originalfil vald för konvertering behålls eller ingår. |
| `prefs.json` | ja | Användarägda lokala inställningar: `theme`, `sidebarWidth` och aktivitetsräknaren `ct-metrics`. |
| `lolly.txt` | ja | En läsbar sammanfattning av bundlen (antal, profil, filnamn) för den som öppnar zippen utan Lolly. Genereras om vid varje export och känns igen vid import, så den räknas aldrig som en överhoppad del. Den skrivs efter integritetskartan, så kartan täcker inte den här filen. |

::: details Hur exporten skriver zippen
Exporten skriver zippen en del i taget (`shells/web/src/lib/zip-stream.ts`). Uppladdningar, sparade resultat och sparade tillgångsversioner läses i 4 MiB-skivor, aldrig hela, och sparade resultat och versioner kontrolleras först mot sin registrerade SHA-256. Varje fil läses sedan för sin kontrollsumma och integritetsdigest, och zippen refererar till den där den ligger.

Inget kodas om, så en fil med Content Credentials behåller exakt de byte dess signatur täcker, och varje del behåller sina exakta byte och sin digest. För samma delar och tid är zippen identisk med den tidigare minnesskrivarens, förutom att en historikfil över 16 MiB komprimeras i bitar. `tests/backup-streaming.test.ts` kontrollerar detta mot registrerade referensdigester.

På ett syntetiskt bibliotek på 192 MiB, mätt i Node, tog det att slutföra säkerhetskopian ungefär 125 till 150 MiB utöver biblioteket, mot ungefär 850 MiB för minnesskrivaren (`node scripts/bench-backup-finalise.ts`). Import läser fortfarande hela zippen i minnet.
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

| Fält | Betydelse |
|---|---|
| `format` | Alltid `lolly-backup`. En fil utan det avvisas som "not a Lolly backup". |
| `formatVersion` | Layouten som den här bundlen **skrevs** med. Höjs vid varje ändring av delarna eller deras former. Läsare spärrar **inte** på det här fältet. |
| `minReader` | Den lägsta läsarversion som kan importera den här bundlen **säkert**. Det här är fältet läsare spärrar på. |
| `app` | Producerande app-id, för diagnostik. |
| `exportedAt` | ISO-tidsstämpel för när bundlen skapades. |
| `counts` | Vad skrivaren la in, för visning och rimlighetskontroller. |
| `integrity` | Valfri. Kopplar varje del utom `manifest.json` till en SRI-liknande `sha256-<base64>`-digest av dess **okomprimerade** byte. |

## Versionspolicy

Två versionsnummer låter formatet växa utan att lämna äldre installationer strandade.

![En ändring av bundleformatet är antingen additiv, vilket gamla läsare kan ignorera, eller brytande, där en felaktig import skadar data. Additiv höjer formatVersion och behåller minReader; brytande höjer formatVersion och höjer minReader. En läsare importerar när minReader är högst dess egen version.](/info/diagrams/concepts/backup-version-gate.svg)

- En läsare importerar en bundle när `manifest.minReader` är högst dess egen läsarversion. Den vägrar, med "needs a newer version of the app", bara när bundlen kräver en nyare läsare.
- En **additiv** ändring, som en ny valfri del eller ett nytt valfritt manifestfält, höjer `formatVersion` och lämnar `minReader` ifred. Äldre appar importerar fortfarande varje del de känner igen, och delar de inte känner igen rapporteras som överhoppade, inte tysta bortslängda.
- En **brytande** ändring, där en felaktig import av en del skadar data eller en valfri del blir obligatorisk, höjer `minReader`. Äldre appar vägrar då rent i stället för att importera något de inte kan hantera.
- Om en framtida bundle sätter `formatVersion` men utelämnar `minReader`, faller läsare tillbaka på att spärra på `formatVersion` och behandlar ändringen som brytande.

> **Tumregel för upphovspersoner:** om varje befintlig läsare fortfarande skulle göra rätt genom att ignorera ditt tillägg är ändringen additiv: höj `formatVersion` och lämna `minReader`. Annars höj `minReader`.

## Integritet

När `manifest.integrity` finns kontrollerar en läsare varje listad dels SHA-256 **innan något skrivs**. En avvikelse ("failed its integrity check") eller en saknad del ("incomplete") stoppar hela importen, så det blir ingen partiell återställning. Det fångar den skada en filtransport kan göra: en trunkerad AirDrop, en e-postgateway som kodade om bilagan, en dålig USB-sektor.

Integriteten är bästa möjliga. Den skrivs bara där Web Crypto finns (varje säker webbläsarkontext och modern Node), och kontrolleras bara när både kartan och Web Crypto finns. En bundle utan kartan, som en från före integritet fanns, importeras oförändrad: "cannot verify" räknas aldrig som "corrupt".

Manifestet listar varken sig självt eller den omgenererade `lolly.txt`. Digesterna täcker delarna som manifestet går i god för.

## Importregler

En import körs i ett av två lägen.

- **Merge** är vad **Import data…** gör, och vad synkroniseringens första anslutning, **Bring it to this device**, gör. Data på målet blir kvar, och inget som inte fanns i bundlen rörs: en session som målet hade och bundlen inte hade överlever importen.
- **Replace** är vad enhetssynkronisering använder för att hålla enheter i takt: den tar den synkade kopians profilpost, inställningar, sessioner, bilder och val av aktivt designsystem, och tar bara bort objekt som en annan enhet raderat sedan förra synkroniseringen. Att återställa en tidigare kopia går längre och får enheten att matcha den kopian, och tar bort allt kopian inte håller, efter att ha sparat enheten först. [Synkronisera dina enheter](/info/sync.html) beskriver vad en person ser.

I en sammanslagning behålls allt som bara finns på målet, och varje sorts data i bundlen möter målet så här:

| Data | Redan på målet | Bara i bundlen |
|---|---|---|
| Sessioner (per plats) och uppladdade bilder (per id) | Den senast sparade kopian behålls, så en äldre säkerhetskopia skriver aldrig över nyare arbete. Lika eller okända tider behåller målets kopia. | Läggs till |
| Mappar | Målets namn och förälder behålls, och mappen får de av bundlens medlemmar den saknar. En session som arkiverats i en mapp på målet förblir arkiverad där. | Läggs till |
| Favoriter (verktyg, katalogtillgångar och Projects-objekt) | Kombineras | Läggs till |
| Mallar, Projects-mallar och användarverktyg (per id) | Målets post behålls. | Läggs till |
| Trash-poster | Målets post behålls. | Läggs till, så att ett objekt som kunde återställas på endera installationen fortfarande kan det. En post vars mapp åter används på målet, eller vars Trash-plats målet redan använder, lämnas utanför. |
| Andra profilfält (namn, kontaktuppgifter, språk, feature flags, dolda verktyg och andra inställningar) | Målets värde behålls. | Tas där målets fält är tomt |
| Inställningar (`prefs.json`) | Målets värde behålls. | Skrivs där målet saknar ett |
| Designsystem (per id) | Bundlens post ersätter målets. | Läggs till. Bundlens aktiva val gäller bara när målet inte har något eget designsystem. |
| Skapelsehistorik | Den senast sparade kopian förblir aktuell, och den andra behålls som ett skyddat utkast. | Läggs till |

**Sparade sessioner länkas automatiskt om till sina bilder.** Tillgångsreferenser behålls via id, och bryggan löser upp dem igen efter att bilderna återställts, vilket den måste göra ändå eftersom `blob:`-URL:er inte överlever en omladdning.

**Historikposter ändras aldrig efter att de skrivits.** En upprepad import av tillgångsversioner och operations-id:n lägger inte till något, och ett id som redan namnger andra byte eller en annan historik avvisas, skrivs inte över. Att importera en identisk aktuell tillgång igen behåller dess version, och en ändrad aktuell tillgång måste bära en annan version.

**Skapelsehistorik har några fler regler.** En skapelse vars plats målet använder för en annan skapelse läggs till som en separat skapelse, och en skapelse i målets Trash blir kvar där. Ett kontrollpunkts-id som namnger annat innehåll på målet behåller målets. Ett arkiv som misslyckas med sina egna kontroller stoppar importen innan någon profil, session, tillgång eller inställning ändras, och en identisk upprepad import lägger inte till någon lagring.

**Sammanfattningen redovisar vad som hände.** Varje import returnerar `profile`, `sessions`, `userAssets`, `prefs`, `skipped` och `failedAssets`.

- `failedAssets` räknar uppladdade tillgångar som inte kunde återställas, till exempel för att enhetens lagring är full.
- `skipped` räknar delar från en nyare skrivare som det här bygget inte kände igen. Appen visar det ("… · N newer items skipped"), så en återställning anger vad den lämnade kvar.
- Med filhistorik lägger sammanfattningen till `assetVersions`, `fileOperations`, `fileBatches` och `failedHistory`. Slut på lagring eller en konflikt med oföränderligt id kan orsaka en partiell återställning, och appen ber då personen behålla källsäkerhetskopian.
- Med skapelsehistorik lägger den till `revisions` och `recoveryDrafts`, som bara räknar vad den här importen lade till, och `added`, `kept`, `replaced`, `copies` och `hidden` för hur varje skapelse slogs ihop. `skippedCheckpoints` räknar kontrollpunkter vars id namnger annat innehåll på målet, och `historyLeftOut` räknar äldre kontrollpunkter och utkast som inte ryms i enhetens historikutrymme.
- En replace-import lägger till `removed` och `failedRemovals`.

Återställning är inte en transaktion över profil-, sessions-, tillgångs- och historiklagren. Molnsynk avancerar **inte** sin tillämpade revision efter en partiell eller icke-stödd återställning, så kopian förblir tillgänglig för nytt försök.

## Vad som inte följer med

- **Katalogcacher** (nedladdad tillgångsmetadata och blobbar, verktygsindexet), som målet synkar om gratis.
- **Katalogverktyg och katalogtillgångar**, som ligger utanför omfånget och antas finnas på målet. Varumärkestokens, typsnitt och logotyper som användaren lagt till är användartillgångar, så de följer med.
- **`blob:`- och objekt-URL:er**, som bryggan genererar om vid inläsning.
- **Konverteringsoriginal, levande exekveringslån och maskinlokala åtkomst- eller signeringshemligheter.** De är inte portabel historik. Ett sparat resultat är en kopia, inget löfte om att originalkällan säkerhetskopierades.
- **Exportsekvensräknaren**, den dagliga räknaren för nedladdningsnamn i `localStorage` (`lolly-export-seq`). Den hålls utanför `PREF_KEYS`, så den färdas aldrig i en bundle.

Lagringsmätaren visar samma uppdelning. Sparade sessioner, My images och File results & versions går in i en bundle. Tillgångscachen, verktygsförhandsvisningarna och offlinefästen under dem kan alla byggas om, så de stannar kvar.

![Lagringsmätaren som bryter ned den här enhetens data i namngivna kategorier, med Saved sessions och My images spårade skilt från Asset cache, här på en ny installation där varje kategori fortfarande är tom](/t/url-shot?url=%2F%23%2Fprofile%3Ffocus%3Dstorage-section&width=1440&height=1600&dpi=192&waitMs=2600&format=svg&css=%5Bdata-store-group%3Dmove%5D%2C.storage-actions%2C.store-selbar%7Bdisplay%3Anone%7D&cropSelector=.store-meter&waitSelector=%5Bdata-store-group%3Dmove%5D&drive=click%3A%5Bdata-store-group%3Dwork%5D%3Esummary%3Bclick%3A%5Bdata-store-group%3Dcaches%5D%3Esummary&walker=1&dark=1&filename=ce-storage-categories)

## Organisationsdata med Lolly Work

Den här bundlen säkerhetskopierar enhetens personliga bibliotek. Den är inte en säkerhetskopia av en **Lolly Work**-instans: organisationskonton, åtkomstpolicyer, delade projekt, katalogversioner, godkännanden, renderjobb och granskningsposter hålls av den tjänsten. Anslut igen och logga in för att få tillbaka åtkomst till delat arbete; att importera en personlig bundle ger inte den åtkomsten.

Operatörer säkerhetskopierar, bevarar och raderar serverdata med Lolly Works egna guider: [Backup and restore](/info/work-operations.html#backup-and-restore) och [Work storage and data lifecycle](/info/work-data-lifecycle.html). Att rensa eller exportera en enhet gör ingen av de serveroperationerna.

## Över skal

`data-transfer.ts` läser och skriver bara genom capability bridge (`host.profile`, `host.state`, `host.assets`) och de delade `localStorage`-inställningarna. Samma modul läser och skriver det gemensamma kuvertet på webben och i dator- och mobilapparna, över IndexedDB eller filsystemslagring. Valfria historikdelar visas bara där deras adapter finns, och en del som inte stöds rapporteras som överhoppad vid import. Sviten utan gränssnitt prövar de gemensamma delarna mot en brygga i minnet, och historiktransaktioner har också tester i riktig webbläsare.

Två skal står utanför den garantin, av olika skäl:

- **CLI för enstaka körning** har inget att bära: dess tillstånd finns i minnet och varar en körning.
- **TUI** behåller tillstånd i `~/.lolly` (sessioner, mappar, profil), och dess Profile-vy kan säkerhetskopiera det, men den skriver ett enklare arkiv av eget slag: `saved-state/<slot>.json` per session plus `profile.json` och `folders.json`, utan manifest, utan `formatVersion` eller `minReader` och utan integritetskarta. Det här formatet kan inte importera det (en läsare avvisar det som "not a Lolly backup"), och dess namn är förvirrande likt (`lolly-backup-<stamp>.zip`). Att förena de två är en känd lucka.

## Ännu inte portabelt

Kuvertet är ett manifest plus namngivna delar, så nya sorters portabel data kan ansluta senare som additiva delar (en ny `formatVersion`, samma `minReader`), och dagens läsare hoppar över det de inte känner igen. Designsystem färdas redan på det här sättet, som `design-systems.json` plus deras användartillgångar.

Två namn är reserverade för data som ännu inte färdas:

- **`tokens.json`** skulle bära ett helt [W3C DTCG](https://tr.designtokens.org/format/)-designtokendokument med sina grupper, uppsättningar och teman, formatet som [Penpot importerar och exporterar](https://help.penpot.app/user-guide/design-systems/design-tokens/). En användares egna varumärkestokens färdas redan som tillgången `user/tokens/brand` i `assets.json`, och ett designsystems tokens färdas med dess post.
- **`penpot/`** är reserverad för en inläst Penpot-fil, eller dess Lolly-relevanta delmängd, framlyft som ett verktyg.

Dagens läsare känner ännu inte till något av namnen. Som allt annat utanför delarna ovan är var och en en okänd del för dem: lämnas orörd och räknas i `skipped`.

## Historikdelar

De två historikdelarna är valfria och har egna versioner. De flesta läsare kan hoppa över det här avsnittet.

::: details Skapelsehistorik (v3)
Manuella säkerhetskopior från en webbinstallation med skapelsehistorik innehåller `revision-history.json`, med eget schema `{ version: 1, documents, revisions, recoveries }`. Den bär de behållna id:na, kanoniska indataögonblicksbilder, versionsstämplar, rasterförhandsvisningar och separata skrivarutkast. Historikadaptern fångar aktuella sessioner och deras huvuden i en läsningstransaktion, och `sessions.json` använder samma aktuella ögonblicksbilder för äldre läsare.

Återställningen kontrollerar nyttolastens SHA-256 och bytelängder, unika identiteter, relationer mellan dokument och huvud, anor, tidsstämplar, förhandsvisningstyper och gränser innan arkivet bekräftas i en transaktion. Komprimerade föräldrareferenser kan saknas. Befintligt aktuellt arbete ersätts aldrig tyst: när en skapelse finns på båda sidor blir sidan som inte behålls aktuell ett skyddat utkast.

Arkivets överföringsgräns på 384 MiB kontrolleras uttryckligen, och lagringsgränser upprätthålls utan att behållna kontrollpunkter trunkeras. Exporten skriver `revision-history.json` och `sessions.json` i bitar, med samma byte som en enda `JSON.stringify` ger, så filtexten hålls aldrig hel. En historikfil som skulle passera gränsen släpps i samma stund den gör det och räknas bara därifrån. Arkivet görs sedan om utan sina äldsta automatiska kontrollpunkter, och exportsammanfattningen räknar dem som `checkpointsLeftOut`, eller så avvisas arkivet helt.

Ett skal utan den här förmågan återställer vanliga sessioner och rapporterar historikdelen som överhoppad. Inbyggd filsystemshistorik förblir icke-stödd tills dess adapter tillhandahåller varaktiga historiktransaktioner. Gäster i en privat collab har ingen varaktig historik eller återställningsarkiv.

Personlig ögonblicksbildssynk lämnar skapelsehistoriken utanför. Att tillämpa en ögonblicksbild på ett lokalt dokument med historik behåller dess tidigare arbetstillstånd som ett separat återställningsutkast och ogiltigförklarar varje öppen redigerares skrivtoken. Dess oföränderliga kontrollpunkter stannar på enheten. Det här skyddar lokal historik under ett byte av ögonblicksbild; det slår inte ihop samtidiga enhetshistoriker.

Historiska tillgångsreferenser behålls, medan rendering fortfarande löser tillgångar genom destinationens befintliga bibliotek. Det här arkivet garanterar ännu inte exakta gamla tillgångsbyte eller gamla verktygsrenderingar. Byte för tillgångsversioner och filresultat färdas i sin egen säkerhetskopiedel.
:::

::: details Sparade versioner och filresultat (v2)
Den valfria historikdelen håller `{ version: 2, assetVersions: [...], operations: [...], batches: [...] }`, och läsare godtar också den tidigare formen history-v1 utan batchar. Varje ögonblicksbild anger det stabila tillgångs-id:t och den exakta versionen, sin sparningstid, bytelängd och hex-SHA-256, plus en tillgångspost vars `_file` och valfria `_credentialFile` pekar på binära delar. Operationer bär de ursprungliga fakta om filen, begäran, rapport, tidsstämplar och valfritt resultatets `_file`. Namn på lagringsbackend, OPFS-handtag och exekveringslån färdas inte. Läsare som bara känner till history v1 avvisar den nya historikversionen före import, i stället för att tyst tappa batchmedlemskap.

Batchmanifest registrerar varje vald källa före bearbetning, inklusive filer som aldrig lästs, avbrutna medlemmar, misslyckanden att reservera resultatutrymme och avbrutet arbete. Varje medlem har ett stabilt operations-id, en källreferens och fakta, begärt utdatanamn och slutlig rapport. En oläst källa har deklarerade fakta, inte en påhittad digest. Importen validerar medlemsidentitet och konsistens med varje medföljande operationsrapport. Batchrapporter förblir tillgängliga när enskilda resultat har tagits bort, men ett kvitto betyder inte att dess utdatabyte fortfarande är lagrade.

- **Validering först.** Varje känd historikpost, rapport och refererad fil valideras innan någon profil- eller tillgångsimport skriver. Saknade byte och SHA-256 som inte stämmer misslyckas även när kuvertet saknar integritetskarta. Utdragna credentials förblir byte-arrayer, även vid import från äldre skrivare som serialiserade dem som objekt med numeriska nycklar.
- **Pågående arbete.** Pågående operationer blir avbrutna poster i säkerhetskopian, med en förklarande felrapport och inget resultat. Återställning startar aldrig om bakgrundsarbete eller importerar ett aktivt lån. Att försöka igen betyder att välja originalfilen på nytt, kontrollerad mot dess registrerade SHA-256 när den finns.
- **Lagring.** Återställda resultat bekräftar sina byte och metadata tillsammans i IndexedDB. Vanliga nya resultat använder OPFS där det finns, med IndexedDB som reserv. En befintlig levande operation ersätts aldrig av en import.
- **Säkerhetskopieringsgränser.** Exporten strömmar dessa byte in i arkivet, men återställningen packar fortfarande upp en hel säkerhetskopia i minnet, så gränserna kvarstår: **256 MiB historiknyttolast**, **4 MiB historikmetadata**, högst **100 operationer**, **100 batchar** och **2 000 ögonblicksbilder**. Exporten avvisar uttryckligen för stor eller ofullständig historik och utelämnar den aldrig tyst. Ladda ner viktiga versioner och resultat en och en innan du tar bort äldre lokala kopior. Gränserna är ingen uppmätt garanti för toppminne på telefoner.
- **Lokala budgetar.** Lokal resultathistorik har en budget på 512 MiB och ett tak på 100 poster. Tillgångsögonblicksbilder har en separat budget på 512 MiB och högst 20 historiska versioner per tillgång, och utdragna credentialbyte räknas mot den budgeten. Återställningen respekterar gränserna och avhyser aldrig tyst befintliga användardata.
- **Batchmetadata.** Lokal batchmetadata har en separat budget på 4 MiB, högst 100 manifest och 20 medlemmar per batch. Väntande medlemmar reserverar metadatakapacitet, med ett rapporttak på 32 KiB per medlem. Det här är en logisk budget, ingen garanti för webbläsarens diskutrymme: ett verkligt kvotfel visas, och rapporten i minnet förblir nedladdningsbar. Att försöka en batchmedlem igen skapar en ny batch utan att skriva över den gamla rapporten. Att ta bort en batchpost tar inte bort enskilda resultatbyte eller bibliotekstillgångar.
- **Resultat i biblioteket.** Konverterade resultat kan läggas till i biblioteket utan normalisering eller omkodning, med käll- och utdatahashar och operationsrelationen bifogade. Upprepade tillägg återanvänder en oförändrad kopia, och en redigerad kopia skrivs aldrig över. Rasterbilder kan starta ett nytt Design-dokument, som använder det aktuella bibliotekstillgångens id; att upprätthålla exakta versionsfästen genom hela Designs körmiljö och URL-väg är separat arbete. SVG-, HTML-, PDF- och ZIP-resultat behålls som ogenomskinliga filtillgångar, inte uppgraderade till betrott interaktivt eller vektoriellt innehåll.
- **Var man ser det här.** **Convert → Recent file operations** visar historikanvändning, rapporter, nedladdningar och versionshanteraren, som också hittar tidigare versioner av raderade bibliotekstillgångar. Att återställa en ögonblicksbild skapar en ny aktuell version och behåller den valda ögonblicksbilden. **Settings → Preferences → Storage** räknar resultat och versioner skilt från engångscachar.
- **Rensning.** Uttrycklig rensning av temporära filer tar bara bort operationsägda, orefererade byte. Aktuella poster skyddar sina filer, och färska OPFS-filer har en respitperiod på en timme. Sparade resultat och tillgångsögonblicksbilder rensas inte automatiskt.

Äldre läsare godtar fortfarande v2-kuvertet (`minReader: 1`) och återställer delarna de känner till, och räknar historikdelar som inte stöds som överhoppade. Full historikåterställning kräver ett skal med adaptern `fileHistory`, en söm inuti skalet snarare än en ny verktygsvänd `HostV1`-förmåga. Verklig återställning mellan två enheter täcks av den lokala Chromium-grinden; återställning i installerade dator-, iOS- och Android-appar återstår att godkänna separat.
:::

## Referens

- Modul: `shells/web/src/data-transfer.ts` (`exportBackup`, `importBackup`, `BACKUP_FORMAT`, `BACKUP_FORMAT_VERSION`, `BACKUP_READER_VERSION`; namngivaren `backupFilename()` är intern).
- Kontraktstest: `tests/data-transfer.test.ts`, som täcker tur och retur, sammanslagning, integritet, framåtkompatibilitet och läsarspärren.
- Kontraktstester för historik: `tests/file-history-backup.test.ts`, `tests/file-batch-history.test.ts` och `tests/file-result-library.test.ts`. Webbläsargodkännande: `tests/file-history.browser.test.ts`, `tests/file-batch-history.browser.test.ts` och `tests/file-result-reuse.browser.test.ts`.
- Använd brygg-yta: `host.profile`, `host.state` och `host.assets`; se [Host API](/info/host-api.html).
