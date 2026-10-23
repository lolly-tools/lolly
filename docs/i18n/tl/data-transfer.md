# Data transfer: ang `lolly-backup` bundle

Iniingatan ng Lolly ang personal mong library sa device. Ang backup bundle ang paraan para lumipat ang library na iyon: i-export sa isang install, dalhin ang file sa anumang paraang gusto mo (USB, AirDrop, email sa sarili o network share) at i-import sa iba. Hindi nangangailangan ng server ang pag-export at pag-import, at puwedeng offline ang target.

Ang pahinang ito ay ang format specification, para sa mga taong bumubuo ng shell, tool o script sa paligid ng mga backup: ano ang nasa zip, paano gina-gate ang mga bersyon, paano nagme-merge ang import at ano ang sinusuri. Ang walkthrough para sa mga taong naglilipat ng sarili nilang gawa ay [Ilipat ang gawa mo sa ibang device](/info/find-your-work.html#move-your-work-to-another-device).

![Ang dalawang button na naglilipat ng buong install: ang Export my data ay nagsusulat ng isang zip, ang Import data ay binabasa ito pabalik](/t/url-shot?url=%2F%23%2Fsettings%3Ffocus%3Dstorage-section&width=1440&height=1800&dpi=192&waitMs=2400&css=.store-move%3Ediv%3Anth-of-type%282%29%2C.store-move%3Ep%3Alast-of-type%7Bdisplay%3Anone%7D&waitSelector=%5Bdata-store-group%3Dmove%5D&drive=click%3A%5Bdata-store-group%3Dmove%5D%3Esummary&walker=1&format=svg&cropSelector=%5Bdata-store-group%3Dmove%5D&dark=1&filename=pd-transfer-controls)

> **Saklaw.** Ang bundle ay may dalang *user data*, hindi mga catalog tool. Ang mga catalog tool at catalog asset ay hiwalay na sini-sync at ipinapalagay na nasa target na, sa pinakamasama ay nasa mas mataas na bersyon. Ang mga tool na ginawa mismo ng user ay sumasama sa loob ng `profile.json`. Hindi kailanman nag-i-install o nag-a-upgrade ng catalog tool ang pag-import.

## Mga Layunin

- <!--i:box--> **Isang format, bawat shell.** Ang web app, ang mga desktop at mobile app at mga hinaharap na shell ay nagbabahagi ng parehong envelope at part schema. Ang mga opsyonal na bahagi ay nakadepende sa kakayahan ng bawat shell, at iniuulat ang mga hindi sinusuportahang bahagi. Ang bawat capability bridge ay nagbibigay ng storage adapter nito.
- <!--i:shieldcheck--> **Nakaliligtas sa biyahe.** Ang bundle na nasira o naputol sa daan ay malakas na nabibigo sa pag-import at hindi kailanman bahagyang nagre-restore.
- <!--i:clock--> **Tumatagal lampas sa bersyong ito.** Ang mas lumang app ay nakakapag-import pa rin ng mga bahagi ng mas bagong bundle na kinikilala nito. Ang tunay na nakakasirang format ay malinis na tinatanggihan.
- <!--i:check--> **Ligtas i-merge.** Ang pag-import sa install na ginagamit na ay hindi kailanman bumubura ng anumang wala sa bundle.

## Ang Envelope

Ang bundle ay payak na `.zip`, kaya nakaliligtas ito sa anumang transport nang buo at kahit anong unzip tool ay masusuri ang laman.

Pinapangalanan ang download ayon sa taong may-ari nito: `LollyTools-<First>-<Last>-<YYYY-MM-DD>-<n>.zip`, halimbawa `LollyTools-Ada-Lovelace-2026-06-26-1.zip`, kaya nananatiling nababasa ang Downloads folder ng mga backup. Ang una at huling pangalan ay galing sa profile at inaalis kapag hindi nakatakda: ang walang profile ay nagbibigay ng `LollyTools-2026-06-26-1.zip`, at ang unang pangalan lang ay nagbibigay ng `LollyTools-Ada-2026-06-26-1.zip`. Ang bawat pangalan ay binabawasan sa filename-safe na token (iniingatan ang mga Unicode letter at digit, inaalis ang espasyo at bantas, hanggang 32 character). Ang `<n>` ay per-day, per-device na sequence, kaya ang paulit-ulit na export sa isang araw ay hindi nagbabanggaan at nananatiling nakaayos. Binubuo ng `backupFilename()` sa `data-transfer.ts` ang pangalan, at ang laman ng zip ay pareho anuman ang pangalan nito.

| Path | Kinakailangan | Laman |
|---|---|---|
| `manifest.json` | oo | Format id, mga bersyon, bilang at integrity bawat bahagi. Ang unang tinitingnan ng reader. |
| `profile.json` | kapag nakatakda | Ang buong `me` record ng user: pangalan, contact, headshot ref at flag, kasama ang mga folder, Trash, project blueprint, user template at user-made na tool, paborito, nakatagong tool, wika at piniling emoji. Binabasa sa pamamagitan ng `host.profile`. |
| `sessions.json` | oo | Bawat naka-save na session: slot, tool id at bersyon, label, thumbnail (data URL) at buong input data. Binabasa sa pamamagitan ng `host.state`. |
| `assets.json` | oo | Metadata para sa bawat na-upload na asset (larawan, font, brand token, logo, naka-save na kopya ng mga download), bawat isa ay tumuturo sa mga byte nito sa ilalim ng `assets/blobs/`. |
| `assets/blobs/<n>.<ext>` | bawat asset | Ang hilaw na byte ng asset, naka-store nang hindi compressed dahil karamihan ay compressed na format. Pampaganda lang ang extension; ang MIME type sa `assets.json` ang tiyak. |
| `assets/blobs/<n>.c2pa` | kapag meron | Mga nakuhang Content Credentials bilang eksaktong binary byte, tinutukoy ng `_credentialFile` sa asset record. Hindi ito mga device signing key. |
| `design-systems.json` | kapag meron | Ang mga design system na ginawa o idinagdag sa install na ito, bilang `{ active, records }`. Tingnan ang [Mga patakaran sa import](#import-rules). |
| `file-history.json` | opsyonal | Mga versioned na asset snapshot, tapos na ulat ng file-operation at kumpletong batch manifest, na may sarili nitong bersyon. Ibinibigay ng internal na `fileHistory` backup adapter ng shell. |
| `revision-history.json` | opsyonal, manual na backup | Mga stable na creation ID, itinagong checkpoint, thumbnail at rolling na recovery draft. Ibinibigay ng `host.state.history.backup` kung saan sinusuportahan. |
| `file-history/versions/` | bawat snapshot | Mga naunang byte ng asset at nakuhang credential, nariyan man o wala pa ang kasalukuyang asset. |
| `file-history/results/` | bawat tapos na operasyon | Eksaktong output byte. Walang original na file na pinili para sa conversion ang iniingatan o isinasama. |
| `prefs.json` | oo | Mga lokal na preference na pag-aari ng user: `theme`, `sidebarWidth` at ang `ct-metrics` activity tally. |
| `lolly.txt` | oo | Nababasang buod ng bundle (mga bilang, profile, filename) para sa sinumang magbubukas ng zip nang walang Lolly. Muling binubuo sa bawat export at kinikilala sa import, kaya hindi ito binibilang na nilaktawang bahagi. Isinusulat ito pagkatapos ng integrity map, kaya hindi sakop ng map ang file na ito. |

::: details Paano isinusulat ng export ang zip
Isinusulat ng export ang zip nang isang bahagi sa isang pagkakataon (`shells/web/src/lib/zip-stream.ts`). Ang mga upload, naka-save na resulta at naka-save na bersyon ng asset ay binabasa sa 4 MiB na hiwa, hindi kailanman buo, at ang mga naka-save na resulta at bersyon ay unang sinusuri laban sa naitalang SHA-256 nila. Pagkatapos, binabasa ang bawat file para sa checksum at integrity digest nito, at tinutukoy ng zip ito kung nasaan ito.

Walang ine-encode muli, kaya ang file na may Content Credentials ay nag-iingat ng eksaktong byte na sakop ng signature nito, at ang bawat bahagi ay nag-iingat ng eksaktong byte at digest nito. Para sa parehong bahagi at oras, ang zip ay kapareho ng sa naunang in-memory writer, maliban sa history file na higit sa 16 MiB ay kinokompress sa mga piraso. Sinusuri ito ng `tests/backup-streaming.test.ts` laban sa mga naitalang reference digest.

Sa 192 MiB na synthetic library, sinukat sa Node, ang pagtatapos ng backup ay umabot ng mga 125 hanggang 150 MiB bukod sa library, kumpara sa mga 850 MiB para sa in-memory writer (`node scripts/bench-backup-finalise.ts`). Binabasa pa rin ng import ang buong zip sa memory.
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

| Field | Kahulugan |
|---|---|
| `format` | Laging `lolly-backup`. Ang file na wala nito ay tinatanggihan bilang "not a Lolly backup". |
| `formatVersion` | Ang layout na **ginamit sa pagsulat** ng bundle na ito. Tinataasan sa anumang pagbabago sa hanay o hugis ng mga bahagi. **Hindi** nagge-gate ang mga reader sa field na ito. |
| `minReader` | Ang pinakamababang bersyon ng reader na maaaring mag-import ng bundle na ito nang **ligtas**. Ito ang field na ginagamit ng mga reader sa gate. |
| `app` | Id ng app na gumawa, para sa diagnostics. |
| `exportedAt` | ISO timestamp kung kailan ginawa ang bundle. |
| `counts` | Kung ano ang inilagay ng writer, para sa display at sanity check. |
| `integrity` | Opsyonal. Minamapa ang bawat bahagi maliban sa `manifest.json` sa SRI-style na `sha256-<base64>` digest ng **hindi compressed** na mga byte nito. |

## Patakaran sa bersyon

Dalawang numero ng bersyon ang nagpapahintulot sa format na lumaki nang hindi iniiwan ang mas lumang install.

![Ang pagbabago sa bundle format ay additive, na kayang balewalain ng lumang reader, o breaking, kung saan ang maling import ay nakakasira. Ang additive ay nagtataas ng formatVersion at pinananatili ang minReader; ang breaking ay nagtataas ng formatVersion at itinataas ang minReader. Nag-i-import ang reader kapag ang minReader ay hindi hihigit sa sarili nitong bersyon.](/info/diagrams/concepts/backup-version-gate.svg)

- Nag-i-import ang reader ng bundle kapag ang `manifest.minReader` ay hindi hihigit sa sarili nitong reader version. Tumatanggi ito, na may "needs a newer version of the app", kapag humihingi lang ang bundle ng mas bagong reader.
- Ang **additive** na pagbabago, tulad ng bagong opsyonal na bahagi o bagong opsyonal na manifest field, ay nagtataas ng `formatVersion` at iniiwan ang `minReader`. Nag-i-import pa rin ang mas lumang app ng bawat bahaging kilala nito, at ang mga bahaging hindi nito kilala ay iniuulat bilang nilaktawan, hindi tahimik na ibinabasura.
- Ang **breaking** na pagbabago, kung saan ang maling import ng isang bahagi ay sumisira ng data o ang opsyonal na bahagi ay nagiging mandatory, ay itinataas ang `minReader`. Malinis na tumatanggi ang mas lumang app sa halip na mag-import ng hindi nito kayang hawakan.
- Kung magtakda ang hinaharap na bundle ng `formatVersion` pero iwanan ang `minReader`, bumabalik ang mga reader sa pag-gate sa `formatVersion` at itinuturing ang pagbabago bilang breaking.

> **Panuntunan para sa mga may-akda:** kung gagawin pa rin ng bawat umiiral na reader ang tama sa pagbalewala sa idinagdag mo, additive ang pagbabago: itaas ang `formatVersion` at iwanan ang `minReader`. Kung hindi, itaas ang `minReader`.

## Integridad

Kapag may `manifest.integrity`, sinusuri ng reader ang SHA-256 ng bawat nakalistang bahagi **bago magsulat ng anuman**. Ang hindi tugma ("failed its integrity check") o nawawalang bahagi ("incomplete") ay humihinto sa buong import, kaya walang bahagyang restore. Nahuhuli nito ang pinsalang kayang gawin ng file transport: naputol na AirDrop, email gateway na nag-encode muli ng attachment, sirang USB sector.

Best effort ang integrity. Isinusulat lang ito kung saan available ang Web Crypto (bawat secure browser context at modernong Node), at sinusuri lang kapag parehong naroon ang map at Web Crypto. Ang bundle na walang map, tulad ng mula bago umiral ang integrity, ay nag-i-import nang walang pagbabago: ang "cannot verify" ay hindi kailanman binibilang bilang "corrupt".

Hindi inililista ng manifest ang sarili nito o ang muling binuong `lolly.txt`. Sakop ng mga digest ang mga bahaging pinatotohanan ng manifest.

## Mga patakaran sa import

Ang import ay tumatakbo sa isa sa dalawang mode.

- Ang **Merge** ang ginagawa ng **Import data…**, at ng unang pagsali ng sync, **Bring it to this device**. Nananatili ang data sa target, at walang gagalawin na wala sa bundle: ang session na meron ang target pero wala ang bundle ay nakakaligtas sa import.
- Ang **Replace** ang ginagamit ng device sync para panatilihing magkasabay ang mga device: kinukuha nito ang profile record, mga preference, session, larawan at piniling aktibong design system ng na-sync na kopya, at inaalis lang ang mga item na binura ng ibang device mula sa huling sync. Ang pagbabalik ng mas naunang kopya ay mas malayo: ginagawa nitong tugma ang device sa kopyang iyon, inaalis ang lahat ng wala sa kopya, pagkatapos i-save muna ang device. Sinasaklaw ng [Sync your devices](/info/sync.html) ang nakikita ng tao.

Sa merge, anumang nasa target lang ay iniingatan, at ang bawat uri ng data sa bundle ay nakikipagtagpo sa target nang ganito:

| Data | Nasa target na | Nasa bundle lang |
|---|---|---|
| Mga session (ayon sa slot) at na-upload na larawan (ayon sa id) | Iniingatan ang kopyang mas kamakailang na-save, kaya hindi kailanman ino-overwrite ng mas lumang backup ang mas bagong gawa. Ang magkapareho o hindi alam na oras ay nag-iingat ng kopya ng target. | Idinaragdag |
| Mga folder | Iniingatan ang pangalan at parent ng target, at nadaragdagan ang folder ng mga member ng bundle na wala nito. Ang session na naka-file sa folder sa target ay nananatiling naka-file doon. | Idinaragdag |
| Mga paborito (tool, catalog asset at Projects item) | Pinagsama | Idinaragdag |
| Mga template, Projects template at user tool (ayon sa id) | Iniingatan ang record ng target. | Idinaragdag |
| Mga entry sa Trash | Iniingatan ang entry ng target. | Idinaragdag, kaya ang item na maibabalik sa alinmang install ay maibabalik pa rin. Ang entry na ang folder ay ginagamit muli sa target, o ang Trash slot ay ginagamit na ng target, ay iniiwan. |
| Iba pang profile field (pangalan, mga detalye ng contact, wika, feature flag, nakatagong tool at iba pang setting) | Iniingatan ang value ng target. | Kinukuha kung walang laman ang field ng target |
| Mga preference (`prefs.json`) | Iniingatan ang value ng target. | Isinusulat kung wala ang target |
| Mga design system (ayon sa id) | Pinapalitan ng record ng bundle ang sa target. | Idinaragdag. Ang aktibong pagpili ng bundle ay umiiral lang kapag walang sariling design system ang target. |
| Creation history | Nananatiling kasalukuyan ang kopyang mas kamakailang na-save, at ang isa pa ay iniingatan bilang protektadong draft. | Idinaragdag |

**Ang mga naka-save na session ay awtomatikong nagre-re-link sa mga larawan nila.** Iniingatan ayon sa id ang mga asset reference, at nireresolba muli ng bridge ang mga ito pagkatapos maibalik ang mga larawan, na kailangan nitong gawin pa rin dahil hindi nakaliligtas sa reload ang mga `blob:` URL.

**Hindi kailanman nagbabago ang mga history record pagkatapos isulat.** Ang paulit-ulit na import ng mga bersyon ng asset at operation ID ay walang idinaragdag, at ang ID na pinangalanan na ang ibang mga byte o history ay tinatanggihan, hindi ino-overwrite. Ang muling pag-import ng magkaparehong kasalukuyang asset ay nag-iingat ng bersyon nito, at ang nagbagong kasalukuyang asset ay kailangang may ibang bersyon.

**May ilan pang patakaran ang creation history.** Ang likha na ang slot ay ginagamit ng target para sa ibang likha ay idinaragdag bilang hiwalay na likha, at ang likha sa Trash ng target ay nananatili roon. Ang checkpoint id na pinangalanan ang ibang nilalaman sa target ay nag-iingat sa sa target. Ang archive na nabigo sa sarili nitong mga check ay humihinto sa import bago magbago ang anumang profile, session, asset o preference, at ang magkaparehong paulit-ulit na import ay walang idinaragdag na storage.

**Iniuulat ng buod kung ano ang nangyari.** Bawat import ay nagbabalik ng `profile`, `sessions`, `userAssets`, `prefs`, `skipped` at `failedAssets`.

- Binibilang ng `failedAssets` ang mga na-upload na asset na hindi nai-restore, halimbawa dahil puno ang device storage.
- Binibilang ng `skipped` ang mga bahagi mula sa mas bagong writer na hindi nakilala ng build na ito. Ipinapakita ito ng app ("… · N newer items skipped"), kaya sinasabi ng restore kung ano ang iniwan nito.
- Sa file history, idinaragdag ng buod ang `assetVersions`, `fileOperations`, `fileBatches` at `failedHistory`. Ang pagkaubos ng storage o immutable-ID conflict ay maaaring magdulot ng bahagyang restore, at sinasabi ng app sa tao na itago ang source backup.
- Sa creation history, idinaragdag nito ang `revisions` at `recoveryDrafts`, na binibilang lang ang idinagdag ng import na ito, at `added`, `kept`, `replaced`, `copies` at `hidden` para sa kung paano na-merge ang bawat likha. Binibilang ng `skippedCheckpoints` ang mga checkpoint na ang id ay pinangalanan ang ibang nilalaman sa target, at binibilang ng `historyLeftOut` ang mas lumang checkpoint at draft na hindi kasya sa history space ng device.
- Ang replace import ay nagdaragdag ng `removed` at `failedRemovals`.

Hindi iisang transaksyon ang restore sa mga profile, session, asset at history store. **Hindi** pinauuna ng cloud sync ang naapply nitong revision pagkatapos ng bahagyang o hindi sinusuportahang restore, kaya nananatiling available ang kopya para subukan muli.

## Ang Hindi Naglalakbay

- **Mga catalog cache** (na-download na asset metadata at blob, ang tool index), na muling sini-sync ng target nang libre.
- **Mga catalog tool at catalog asset**, na labas sa saklaw at ipinapalagay na nasa target. Ang mga brand token, font at logo na idinagdag ng user ay mga user asset, kaya sumasama ang mga ito.
- **Mga `blob:` at object URL**, na muling binubuo ng bridge sa pag-load.
- **Mga conversion original, live execution lease at machine-local na access o signing secret.** Hindi portable na history ang mga ito. Ang naka-save na resulta ay kopya, hindi pangako na na-backup ang orihinal na source.
- **Ang export sequence counter**, ang per-day na download-naming counter sa `localStorage` (`lolly-export-seq`). Nakatago ito sa `PREF_KEYS`, kaya hindi ito kailanman sumasama sa bundle.

Ipinapakita ng storage meter ang parehong paghahati. Ang mga naka-save na session, My images at File results & versions ay napupunta sa bundle. Ang asset cache, tool preview at offline pin sa ilalim ng mga ito ay maaaring muling buuin, kaya naiiwan ang mga ito.

![Ang storage meter na naghihiwalay ng data ng device na ito sa mga pinangalanang kategorya, na ang Saved sessions at My images ay hiwalay na sinusubaybayan mula sa Asset cache, dito sa bagong install kung saan walang laman pa ang bawat kategorya](/t/url-shot?url=%2F%23%2Fprofile%3Ffocus%3Dstorage-section&width=1440&height=1600&dpi=192&waitMs=2600&format=svg&css=%5Bdata-store-group%3Dmove%5D%2C.storage-actions%2C.store-selbar%7Bdisplay%3Anone%7D&cropSelector=.store-meter&waitSelector=%5Bdata-store-group%3Dmove%5D&drive=click%3A%5Bdata-store-group%3Dwork%5D%3Esummary%3Bclick%3A%5Bdata-store-group%3Dcaches%5D%3Esummary&walker=1&dark=1&filename=ce-storage-categories)

## Data ng organisasyon gamit ang Lolly Work

Ang bundle na ito ay nagba-back up ng personal na library ng device. Hindi ito backup ng **Lolly Work** instance: ang mga account ng organisasyon, access policy, shared project, bersyon ng catalog, approval, render job at audit record ay hawak ng serbisyong iyon. Kumonekta muli at mag-sign in para mabawi ang access sa shared work; ang pag-import ng personal na bundle ay hindi nagbibigay ng access na iyon.

Ang mga operator ang nagba-back up, nag-iingat at nagbubura ng server data gamit ang sariling mga gabay ng Lolly Work: [Backup at restore](/info/work-operations.html#backup-and-restore) at [Work storage at data lifecycle](/info/work-data-lifecycle.html). Ang pag-clear o pag-export ng device ay hindi gumagawa ng alinman sa mga server operation na iyon.

## Sa iba't ibang shell

Ang `data-transfer.ts` ay nagbabasa at nagsusulat lang sa pamamagitan ng capability bridge (`host.profile`, `host.state`, `host.assets`) at ng shared na `localStorage` preference. Ang parehong module ay nagbabasa at nagsusulat ng karaniwang envelope sa web at sa mga desktop at mobile app, sa IndexedDB o filesystem storage. Lumilitaw lang ang mga opsyonal na history part kung saan available ang adapter nila, at ang hindi sinusuportahang bahagi ay iniuulat na nilaktawan sa import. Sinusubok ng headless suite ang mga karaniwang bahagi laban sa in-memory bridge, at ang history transaction ay may mga real-browser test din.

May dalawang shell na wala sa guarantee na iyon, sa magkaibang dahilan:

- Ang **one-shot CLI** ay walang dadalhin: nasa memory ang state nito at isang invocation lang ang tagal.
- Ang **TUI** ay nag-iingat ng state sa `~/.lolly` (mga session, folder, profile), at ang Profile view nito ay kayang mag-back up nito, pero nagsusulat ito ng mas simpleng sariling archive: `saved-state/<slot>.json` bawat session kasama ang `profile.json` at `folders.json`, na walang manifest, walang `formatVersion` o `minReader` at walang integrity map. Hindi ito kayang i-import ng format na ito (tinatanggihan ito ng reader bilang "not a Lolly backup"), at nakalilitong magkahawig ang pangalan nito (`lolly-backup-<stamp>.zip`). Kilalang puwang ang pagsasama ng dalawa.

## Hindi pa portable

Ang envelope ay manifest kasama ang mga pinangalanang bahagi, kaya ang mga bagong uri ng portable na data ay maaaring sumali sa kalaunan bilang additive na bahagi (bagong `formatVersion`, parehong `minReader`), at nilalaktawan ng mga reader ngayon ang hindi nila kilala. Ganito na naglalakbay ang mga design system, bilang `design-systems.json` kasama ang mga user asset nila.

Dalawang pangalan ang nakareserba para sa data na hindi pa naglalakbay:

- Ang **`tokens.json`** ay magdadala ng buong [W3C DTCG](https://tr.designtokens.org/format/) design-tokens na dokumento kasama ang mga grupo, set at theme nito, ang format na [ini-import at ine-export ng Penpot](https://help.penpot.app/user-guide/design-systems/design-tokens/). Ang mga brand token ng user ay naglalakbay na bilang `user/tokens/brand` asset sa `assets.json`, at ang mga token ng design system ay naglalakbay kasama ang record nito.
- Ang **`penpot/`** ay nakareserba para sa na-ingest na Penpot file, o ang Lolly-relevant na subset nito, na inilalabas bilang tool.

Wala pa sa mga reader ngayon ang nakakakilala sa alinmang pangalan. Tulad ng anupamang nasa labas ng mga bahagi sa itaas, ang bawat isa ay hindi kilalang bahagi sa kanila: iniiwang hindi ginagalaw at binibilang sa `skipped`.

## Mga history part

Opsyonal ang dalawang history part at may sarili silang bersyon. Maaaring laktawan ng karamihan ng reader ang seksyong ito.

::: details Creation history (v3)
Ang mga manual backup mula sa web install na may creation history ay may kasamang `revision-history.json`, na may sarili nitong schemang `{ version: 1, documents, revisions, recoveries }`. Dala nito ang mga itinagong ID, canonical input snapshot, version stamp, raster preview at hiwalay na writer draft. Kinukuha ng history adapter ang mga kasalukuyang session at ang mga head nila sa isang read transaction, at ginagamit ng `sessions.json` ang parehong kasalukuyang snapshot para sa mas lumang reader.

Sinusuri ng restore ang payload SHA-256 at bilang ng byte, natatanging identity, relasyon ng dokumento at head, ancestry, timestamp, uri ng preview at limitasyon bago i-commit ang archive sa isang transaction. Ang mga compacted na parent reference ay maaaring nawawala. Hindi kailanman tahimik na pinapalitan ang kasalukuyang gawa: kapag ang isang likha ay nasa magkabilang panig, ang panig na hindi pinanatiling kasalukuyan ay nagiging protektadong draft.

Tahasang sinusuri ang 384 MiB na transfer limit ng archive, at ipinapatupad ang mga storage limit nang hindi pinuputol ang mga itinagong checkpoint. Isinusulat ng export ang `revision-history.json` at `sessions.json` sa mga chunk, na may parehong byte na ibinibigay ng iisang `JSON.stringify`, kaya hindi kailanman hawak nang buo ang text ng file. Ang history file na lalampas sa limitasyon ay ibinabasura sa sandaling lumampas at binibilang na lang mula roon. Gagawing muli ang archive nang wala ang pinakaluma nitong awtomatikong checkpoint, at binibilang ng export summary ang mga iyon bilang `checkpointsLeftOut`, o ang archive ay tinatanggihan nang buo.

Ang shell na walang capability na ito ay nagre-restore ng mga karaniwang session at iniuulat ang history part bilang nilaktawan. Nananatiling hindi sinusuportahan ang native filesystem history hanggang magbigay ang adapter nito ng matibay na history transaction. Ang mga guest sa pribadong collab ay walang matibay na history o recovery archive.

Iniiwan ng personal snapshot sync ang creation history. Ang paglalapat ng snapshot sa lokal na dokumentong may history ay nag-iingat ng naunang working state nito bilang hiwalay na recovery draft at ginagawang hindi na balido ang write token ng anumang bukas na editor. Nananatili sa device ang mga immutable checkpoint nito. Pinoprotektahan nito ang lokal na history sa pagpapalit ng snapshot; hindi nito minemerge ang mga sabay-sabay na history ng device.

Iniingatan ang mga historical na asset reference, habang ang rendering ay nagreresolba pa rin ng mga asset sa pamamagitan ng umiiral na library ng destinasyon. Hindi pa ginagarantiya ng archive na ito ang eksaktong lumang byte ng asset o lumang render ng tool. Ang mga byte ng bersyon ng asset at resulta ng file ay naglalakbay sa sarili nilang backup part.
:::

::: details Mga naka-save na bersyon at resulta ng file (v2)
Ang opsyonal na history part ay may hawak ng `{ version: 2, assetVersions: [...], operations: [...], batches: [...] }`, at tinatanggap din ng mga reader ang mas naunang history-v1 na hugis na walang batch. Ang bawat snapshot ay nagbibigay ng stable na asset ID at eksaktong bersyon, oras ng pag-save, haba ng byte at hex SHA-256, kasama ang asset record na ang `_file` at opsyonal na `_credentialFile` ay tumuturo sa mga binary part. Ang mga operasyon ay may dalang mga katotohanan ng orihinal na file, request, ulat, timestamp at opsyonal na resultang `_file`. Hindi naglalakbay ang mga pangalan ng storage backend, OPFS handle at execution lease. Ang mga reader na history v1 lang ang alam ay tumatanggi sa bagong history version bago mag-import, sa halip na tahimik na ibasura ang membership ng batch.

Itinatala ng mga batch manifest ang bawat napiling source bago ang pagproseso, kasama ang mga file na hindi kailanman nabasa, mga kinanselang member, pagkabigong magreserba ng espasyo para sa resulta at naantalang gawa. Ang bawat member ay may stable na operation ID, source reference at mga katotohanan, hiniling na pangalan ng output at huling ulat. Ang hindi nabasang source ay may mga idineklarang katotohanan, hindi inimbentong digest. Vina-validate ng import ang identity ng member at pagkakatugma sa anumang dalang operation report. Nananatiling available ang mga batch report kahit inalis ang mga indibidwal na resulta, pero ang resibo ay hindi nangangahulugang naka-store pa rin ang mga output byte nito.

- **Validation muna.** Bawat kilalang history record, ulat at tinutukoy na file ay vina-validate bago magsulat ang anumang profile o asset import. Ang nawawalang byte at hindi tugmang SHA-256 ay nabibigo kahit walang integrity map ang envelope. Nananatiling byte array ang mga nakuhang credential, kasama ang mga import mula sa mas lumang writer na nag-serialise ng mga ito bilang numeric-key na object.
- **Tumatakbong gawa.** Ang mga tumatakbong operasyon ay nagiging mga naantalang record sa backup, na may nagpapaliwanag na failure report at walang resulta. Hindi kailanman nire-restart ng restore ang background work o nag-i-import ng aktibong lease. Ang pagsubok muli ay nangangahulugang pagpili muli sa orihinal na file, sinusuri laban sa naitalang SHA-256 nito kapag available.
- **Storage.** Ang mga naibalik na resulta ay nagko-commit ng mga byte at metadata nila nang sabay sa IndexedDB. Ang karaniwang bagong resulta ay gumagamit ng OPFS kung available, na may IndexedDB fallback. Ang umiiral na live na operasyon ay hindi kailanman pinapalitan ng import.
- **Mga limitasyon ng backup.** Ini-stream ng export ang mga byte na ito sa archive, pero ina-unzip pa rin ng restore ang buong backup sa memory, kaya nananatili ang mga limitasyon: **256 MiB ng history payload**, **4 MiB ng history metadata**, hanggang **100 operasyon**, **100 batch** at **2,000 snapshot**. Tahasang tinatanggihan ng export ang sobra ang laki o hindi kumpletong history at hindi kailanman tahimik na iniiwan ito. I-download nang isa-isa ang mahahalagang bersyon at resulta bago alisin ang mas lumang lokal na kopya. Hindi sinusukat na garantiya ng peak memory para sa phone ang mga limitasyong ito.
- **Mga lokal na budget.** Ang lokal na result history ay may 512 MiB na budget at 100-record na takip. Ang mga asset snapshot ay may hiwalay na 512 MiB na budget at hanggang 20 historical na bersyon bawat asset, at ang mga byte ng nakuhang credential ay bumibilang sa budget na iyon. Iginagalang ng restore ang mga limitasyong ito at hindi kailanman tahimik na nagpapalayas ng umiiral na user data.
- **Batch metadata.** Ang lokal na batch metadata ay may hiwalay na 4 MiB na budget, hanggang 100 manifest at 20 member bawat batch. Ang mga nakabinbing member ay nagrereserba ng metadata capacity, na may 32 KiB na report ceiling bawat member. Lohikal na budget ito, hindi garantiya sa espasyo ng disk ng browser: ipinapakita ang tunay na quota failure, at nananatiling mada-download ang in-memory na ulat. Ang pagsubok muli sa batch member ay gumagawa ng bagong batch nang hindi ino-overwrite ang lumang ulat. Ang pag-alis ng batch record ay hindi nag-aalis ng indibidwal na byte ng resulta o library asset.
- **Mga resulta sa library.** Ang mga na-convert na resulta ay maaaring idagdag sa library nang walang normalisation o re-encoding, na may kalakip na source at output hash at ang operation relation. Ang paulit-ulit na pagdagdag ay gumagamit muli ng hindi nagbagong kopya, at ang na-edit na kopya ay hindi kailanman ino-overwrite. Ang mga raster na larawan ay maaaring magsimula ng bagong Design document, na gumagamit ng kasalukuyang library asset ID; ang pagpapatupad ng eksaktong version pin sa buong runtime at URL path ng Design ay hiwalay na gawain. Ang mga resultang SVG, HTML, PDF at ZIP ay iniingatan bilang opaque na file asset, hindi itinataas sa pinagkakatiwalaang interactive o vector na nilalaman.
- **Kung saan ito nakikita ng mga tao.** Ipinapakita ng **Convert → Recent file operations** ang paggamit ng history, mga ulat, download at ang version manager, na nakakahanap din ng mas naunang bersyon ng mga binurang library asset. Ang pag-restore ng snapshot ay gumagawa ng bagong kasalukuyang bersyon at iniingatan ang napiling snapshot. Binibilang ng **Settings → Preferences → Storage** ang mga resulta at bersyon nang hiwalay sa mga disposable na cache.
- **Cleanup.** Ang tahasang temporary-file cleanup ay nag-aalis lang ng mga byte na pag-aari ng operasyon at walang reference. Pinoprotektahan ng mga kasalukuyang record ang mga file nila, at ang mga kamakailang OPFS file ay may isang-oras na grace period. Hindi awtomatikong nililinis ang mga naka-save na resulta at asset snapshot.

Tinatanggap pa rin ng mga mas lumang reader ang v2 envelope (`minReader: 1`) at nire-restore ang mga bahaging kilala nila, binibilang ang mga hindi sinusuportahang history part bilang nilaktawan. Ang buong history recovery ay nangangailangan ng shell na may `fileHistory` adapter, isang tahi sa loob ng shell sa halip na bagong tool-facing na `HostV1` capability. Ang tunay na two-device restore ay sakop ng lokal na Chromium gate; ang recovery sa mga naka-install na desktop, iOS at Android app ay hiwalay pang tatanggapin.
:::

## Reference

- Module: `shells/web/src/data-transfer.ts` (`exportBackup`, `importBackup`, `BACKUP_FORMAT`, `BACKUP_FORMAT_VERSION`, `BACKUP_READER_VERSION`; internal ang `backupFilename()` namer).
- Contract test: `tests/data-transfer.test.ts`, na sumasaklaw sa round trip, merge, integrity, forward compatibility at ang reader gate.
- Mga history contract test: `tests/file-history-backup.test.ts`, `tests/file-batch-history.test.ts` at `tests/file-result-library.test.ts`. Browser acceptance: `tests/file-history.browser.test.ts`, `tests/file-batch-history.browser.test.ts` at `tests/file-result-reuse.browser.test.ts`.
- Bridge surface na ginamit: `host.profile`, `host.state` at `host.assets`; tingnan ang [Host API](/info/host-api.html).
