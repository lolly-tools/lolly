# Paglipat ng data: ang `lolly-backup` bundle

Inililipat ng backup bundle ang personal na library na itinatago ng Lolly sa device: i-export ito sa isang install, dalhin ang file (USB, AirDrop, email sa sarili mo o network share) at i-import ito sa iba. Hindi kailangan ng server sa pag-export at pag-import, at puwedeng offline ang destinasyon.

Ito ang format specification para sa mga gumagawa ng shell, tool o script para sa mga backup. Para ilipat ang sarili mong gawa, basahin ang [Ilipat ang gawa mo sa ibang device](/info/find-your-work.html#move-your-work-to-another-device).

![Ang dalawang button na naglilipat ng buong install: nagsusulat ng iisang zip ang Export my data, binabasa ito pabalik ng Import data](/t/url-shot?url=%2F%23%2Fsettings%3Ffocus%3Dstorage-section&width=1440&height=1800&dpi=192&waitMs=2400&css=.store-move%3Ediv%3Anth-of-type%282%29%2C.store-move%3Ep%3Alast-of-type%7Bdisplay%3Anone%7D&waitSelector=%5Bdata-store-group%3Dmove%5D&drive=click%3A%5Bdata-store-group%3Dmove%5D%3Esummary&walker=1&format=svg&cropSelector=%5Bdata-store-group%3Dmove%5D&dark=1&filename=pd-transfer-controls)

::: note Saklaw
*Data ng user* ang dala ng bundle, hindi mga tool sa catalog. Hiwalay na sini-sync ang mga tool at asset sa catalog at ipinapalagay na naroon na ang mga ito sa destinasyon, sa mas mataas na bersyon kung sakali. Sumasama ang mga tool na ginawa ng user sa loob ng `profile.json`. Hindi kailanman nag-i-install o nag-a-upgrade ng tool sa catalog ang pag-import.
:::

<!--i:eti-badge-check-->
## Mga layunin

- <!--i:box--> **Isang format, bawat shell.** Iisa ang envelope at mga part schema na ginagamit ng web app, mga desktop at mobile app at mga shell sa hinaharap. Nakadepende ang mga opsyonal na bahagi sa kakayahan ng bawat shell, at iniuulat ang mga hindi suportadong bahagi. Nagbibigay ang bawat capability bridge ng storage adapter nito.
- <!--i:shieldcheck--> **Nananatiling buo sa paglipat.** Ang bundle na nasira o naputol sa paglipat ay hindi mai-import at magbibigay ng error, at hindi kailanman bahagyang mare-restore.
- <!--i:clock--> **Magagamit lampas sa bersyong ito.** Ini-import ng mas lumang app ang mga bahagi ng mas bagong bundle na nakikilala nito. Maayos na tinatanggihan ang format na hindi tugma.
- <!--i:check--> **Ligtas pagsamahin.** Ang pag-import sa install na ginagamit na ay hindi kailanman nagbubura ng anumang wala sa bundle.

<!--i:eti-package-->
## Ang envelope

Karaniwang `.zip` ang bundle. Nananatili itong buo sa anumang paraan ng paglipat, at masusuri ng anumang unzip tool ang mga nilalaman.

Ipinapangalan ang download sa may-ari nito: `LollyTools-<First>-<Last>-<YYYY-MM-DD>-<n>.zip`, halimbawa `LollyTools-Ada-Lovelace-2026-06-26-1.zip`. Galing sa profile ang pangalan at apelyido at hindi isinasama kapag hindi nakatakda: kapag walang profile, `LollyTools-2026-06-26-1.zip`, at kapag pangalan lang, `LollyTools-Ada-2026-06-26-1.zip`. Nagiging token na ligtas para sa filename ang bawat pangalan (pinapanatili ang mga Unicode letter at digit, inaalis ang mga space at bantas, hanggang 32 character). Ang `<n>` ay pagkakasunod-sunod bawat araw, bawat device, kaya hindi nagkakapareho ang paulit-ulit na export sa isang araw at nananatiling sunod-sunod. Binubuo ng `backupFilename()` sa `data-transfer.ts` ang pangalan. Hindi binabago ng pangalan ang mga nilalaman ng zip.

| Path | Kailangan | Mga nilalaman |
|---|---|---|
| `manifest.json` | oo | Format id, mga bersyon, bilang at integrity bawat bahagi. Binabasa muna ng reader ang file na ito. |
| `profile.json` | kapag nakatakda | Ang `me` record ng user: pangalan, contact, headshot ref at mga flag, kasama ang mga folder, Trash, project blueprint, user template at tool na ginawa ng user, paborito, nakatagong tool, wika at piniling emoji. Binabasa sa pamamagitan ng `host.profile`. |
| `sessions.json` | oo | Bawat na-save na session: slot, tool id at bersyon, label, thumbnail (data URL) at buong input data. Binabasa sa pamamagitan ng `host.state`. |
| `assets.json` | oo | Metadata para sa bawat in-upload na asset (mga larawan, font, brand token, logo, na-save na kopya ng mga download), bawat isa ay nakaturo sa mga byte nito sa ilalim ng `assets/blobs/`. |
| `assets/blobs/<n>.<ext>` | bawat asset | Ang mga raw byte ng asset, itinatago nang hindi naka-compress dahil karamihan ay nasa mga compressed na format na. Para sa itsura lang ang extension; ang MIME type sa `assets.json` ang masusunod. |
| `assets/blobs/<n>.c2pa` | kapag mayroon | Na-extract na Content Credentials bilang eksaktong mga binary byte, na tinutukoy ng `_credentialFile` sa asset record. Hindi ito mga signing key ng device. |
| `design-systems.json` | kapag mayroon | Ang mga design system na ginawa o idinagdag sa install na ito, bilang `{ active, records }`. Tingnan ang [Mga tuntunin sa pag-import](#import-rules). |
| `file-history.json` | opsyonal | Mga snapshot ng asset na may bersyon, ulat ng mga tapos na file operation at kumpletong batch manifest, na may sarili nitong bersyon. Ibinibigay ng internal na `fileHistory` backup adapter ng shell. |
| `revision-history.json` | opsyonal, mga manual na backup | Mga permanenteng creation ID, itinagong checkpoint, thumbnail at patuloy na ina-update na recovery draft. Ibinibigay ng `host.state.history.backup` kung saan suportado. |
| `file-history/versions/` | bawat snapshot | Mga naunang byte ng asset at na-extract na credential, naroon pa man o wala na ang kasalukuyang asset. |
| `file-history/results/` | bawat tapos na operation | Eksaktong mga output byte. Walang itinatago o isinasamang orihinal na file na pinili para sa conversion. |
| `prefs.json` | oo | Mga lokal na preference na pag-aari ng user: `theme`, `sidebarWidth` at ang `ct-metrics` na bilang ng aktibidad. |
| `lolly.txt` | oo | Nababasa na buod ng bundle (mga bilang, profile, filename) para sa sinumang magbubukas ng zip nang walang Lolly. Muling binubuo sa bawat export at nakikilala sa pag-import, kaya hindi ito kailanman binibilang bilang nilaktawang bahagi. Isinusulat ito pagkatapos ng integrity map, kaya hindi sakop ng map ang file na ito. |

::: details Paano isinusulat ng export ang zip
Isinusulat ng export ang zip nang paisa-isang bahagi (`shells/web/src/lib/zip-stream.ts`). Binabasa ang mga upload, na-save na resulta at na-save na bersyon ng asset sa mga pirasong 4 MiB, hindi kailanman nang buo. Sinusuri muna ang mga na-save na resulta at bersyon ayon sa naitalang SHA-256 ng mga ito. Pagkatapos, binabasa ang bawat file para sa checksum at integrity digest nito, at tinutukoy ng zip ang file sa kinaroroonan nito.

Walang muling ine-encode. Pinapanatili ng bawat bahagi ang eksaktong mga byte at digest nito, kaya pinapanatili ng file na may Content Credentials ang mga byte na sakop ng pirma nito. Para sa parehong mga bahagi at oras, kapareho ang zip ng mula sa dating writer na gumagamit ng memory, maliban sa history file na lampas 16 MiB na kino-compress nang pira-piraso. Sinusuri ito ng `tests/backup-streaming.test.ts` ayon sa mga naitalang reference digest.

Sa isang 192 MiB na sintetikong library, na sinukat sa Node, ang pagtatapos ng backup ay gumamit ng humigit-kumulang 125 hanggang 150 MiB bukod pa sa library, kumpara sa humigit-kumulang 850 MiB para sa writer na gumagamit ng memory (`node scripts/bench-backup-finalise.ts`). Binabasa pa rin ng pag-import ang buong zip sa memory.
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

| Field | Kahulugan |
|---|---|
| `format` | Laging `lolly-backup`. Tinatanggihan ang file na wala nito bilang "hindi Lolly backup". |
| `formatVersion` | Ang layout na ginamit sa **pagsulat** ng bundle na ito. Tinataasan sa anumang pagbabago sa set o hugis ng mga bahagi. **Hindi** ginagamit ng mga reader ang field na ito para magpasya kung tatanggapin ito. |
| `minReader` | Ang pinakamababang bersyon ng reader na kayang mag-import ng bundle na ito nang **ligtas**. Ito ang field na ginagamit ng mga reader para magpasya kung tatanggapin ito. |
| `app` | Id ng app na gumawa, para sa diagnostics. |
| `exportedAt` | ISO timestamp kung kailan ginawa ang bundle. |
| `counts` | Kung ano ang inilagay ng writer, para ipakita at suriin kung makatwiran. |
| `integrity` | Opsyonal. Itinatapat ang bawat bahagi maliban sa `manifest.json` sa SRI-style na `sha256-<base64>` digest ng mga byte nitong **hindi naka-compress**. |

<!--i:eti-tag-->
## Patakaran sa bersyon

Dalawang numero ng bersyon ang nagpapahintulot sa format na lumawak nang hindi naiiwan ang mga mas lumang install.

![Ang pagbabago sa format ng bundle ay maaaring dagdag lang, na puwedeng balewalain ng mga lumang reader, o hindi tugma, kung saan nakakasira ang maling pag-import. Tinataasan ng dagdag lang ang formatVersion at pinapanatili ang minReader; tinataasan ng hindi tugma ang formatVersion at minReader. Nag-i-import ang reader kapag hindi mas mataas ang minReader sa sarili nitong bersyon.](/info/diagrams/concepts/backup-version-gate.svg)

- Ini-import ng reader ang bundle kapag hindi mas mataas ang `manifest.minReader` sa sarili nitong bersyon ng reader. Tinatanggihan lang nito, na may "kailangan ng mas bagong bersyon ng app", kapag nangangailangan ang bundle ng mas bagong reader.
- Ang **dagdag lang** na pagbabago, tulad ng bagong opsyonal na bahagi o bagong opsyonal na manifest field, ay nagtataas ng `formatVersion` at hindi binabago ang `minReader`. Ini-import pa rin ng mga mas lumang app ang bawat bahaging nakikilala nila, at iniuulat bilang nilaktawan ang mga bahaging hindi nila nakikilala, hindi tahimik na inaalis.
- Ang **hindi tugmang** pagbabago, kung saan nakakasira ng data ang maling pag-import ng isang bahagi o nagiging sapilitan ang opsyonal na bahagi, ay nagtataas ng `minReader`. Maayos na tumatanggi ang mga mas lumang app sa halip na mag-import ng hindi nila kayang hawakan. Maayos na tinatanggihan ng mga mas lumang app ang bundle.
- Kapag itinakda ng bundle sa hinaharap ang `formatVersion` pero hindi isinama ang `minReader`, bumabalik ang mga reader sa pagpapasya ayon sa `formatVersion` at itinuturing ang pagbabago bilang hindi tugma.

::: note Gabay para sa mga may-akda
Kung tama pa rin ang gagawin ng bawat umiiral na reader sa pagbalewala sa idinagdag mo, dagdag lang ang pagbabago: taasan ang `formatVersion` at panatilihin ang `minReader`. Kung hindi, taasan ang `minReader`.
:::

<!--i:eti-shield-check-->
## Integrity

Kapag naroon ang `manifest.integrity`, sinusuri ng reader ang SHA-256 ng bawat nakalistang bahagi **bago magsulat ng anuman**. Ang hindi pagtutugma ("bumagsak sa integrity check nito") o nawawalang bahagi ("hindi kumpleto") ay nagpapahinto sa pag-import, kaya walang bahagyang pag-restore. Natutukoy nito ang pinsala sa paglipat: naputol na AirDrop, email gateway na muling nag-encode ng attachment, sirang sektor ng USB.

Ginagawa ang integrity hangga't kaya. Isinusulat lang ito kung saan may Web Crypto (bawat secure na browser context at modernong Node), at sinusuri lang kapag parehong naroon ang map at Web Crypto. Ini-import nang walang pagbabago ang bundle na walang map, tulad ng mula noong wala pang integrity: ang "hindi ma-verify" ay hindi kailanman itinuturing na "sira".

Hindi inililista ng manifest ang sarili nito o ang muling binuong `lolly.txt`.

<!--i:eti-download-->
## Mga tuntunin sa pag-import

Tumatakbo ang pag-import sa isa sa dalawang mode.

- **Merge** ang ginagawa ng **Import data…** at ng unang pagsali sa sync, **Bring it to this device**. Nananatili ang data sa destinasyon, at walang ginagalaw sa labas ng bundle.
- **Replace** ang ginagamit ng device sync para panatilihing magkakatugma ang mga device. Kinukuha nito ang profile record, mga preference, session, larawan at piniling aktibong design system ng naka-sync na kopya. Inaalis lang nito ang mga item na binura ng ibang device mula sa huling sync. Ang pag-restore ng mas naunang kopya ay sine-save muna ang device, saka itinutugma ang device sa kopyang iyon at inaalis ang lahat ng wala sa kopya. Sinasaklaw ng [I-sync ang mga device mo](/info/sync.html) kung ano ang nakikita ng isang tao.

Ganito hinahawakan ng merge ang bawat uri ng data:

| Data | Nasa destinasyon na | Nasa bundle lang |
|---|---|---|
| Mga session (ayon sa slot) at in-upload na larawan (ayon sa id) | Pinapanatili ang mas kamakailang na-save na kopya, kaya hindi kailanman pinapatungan ng mas lumang backup ang mas bagong gawa. Kapag pareho o hindi alam ang mga oras, pinapanatili ang kopya sa destinasyon. | Idinaragdag |
| Mga folder | Pinapanatili ang pangalan at parent sa destinasyon, at idinaragdag sa folder ang mga miyembro ng bundle na wala pa rito. Nananatili sa folder na iyon ang session na nakalagay sa folder sa destinasyon. | Idinaragdag |
| Mga paborito (tool, asset sa catalog at item sa Projects) | Pinagsasama | Idinaragdag |
| Mga template, template sa Projects at tool ng user (ayon sa id) | Pinapanatili ang record sa destinasyon. | Idinaragdag |
| Mga entry sa Trash | Pinapanatili ang entry sa destinasyon. | Idinaragdag, kaya mare-restore pa rin ang item na puwedeng i-restore sa alinmang install. Hindi isinasama ang entry na ginagamit muli ang folder sa destinasyon, o ginagamit na ng destinasyon ang Trash slot nito. |
| Iba pang field ng profile (pangalan, detalye sa pakikipag-ugnayan, wika, feature flag, nakatagong tool at iba pang setting) | Pinapanatili ang value sa destinasyon. | Kinukuha kapag walang laman ang field sa destinasyon |
| Mga preference (`prefs.json`) | Pinapanatili ang value sa destinasyon. | Isinusulat kapag wala nito sa destinasyon |
| Mga design system (ayon sa id) | Pinapalitan ng record ng bundle ang nasa destinasyon. | Idinaragdag. Ginagamit lang ang aktibong pinili sa bundle kapag walang sariling design system ang destinasyon. |
| History ng gawa | Nananatiling kasalukuyan ang mas kamakailang na-save na kopya, at itinatago ang isa pa bilang protektadong draft. | Idinaragdag |

**Awtomatikong muling naka-link sa mga larawan nila ang mga na-save na session.** Pinapanatili ayon sa id ang mga asset reference. Muling nireresolba ng bridge ang mga ito pagkatapos ma-restore ang mga larawan, dahil hindi nananatili ang mga `blob:` URL pagkatapos ng reload.

**Hindi kailanman nagbabago ang mga history record matapos isulat.** Walang idinaragdag ang muling pag-import ng mga bersyon ng asset at operation ID, at tinatanggihan ang ID na tumutukoy na sa ibang mga byte o history, hindi pinapatungan. Pinapanatili ng muling pag-import ng kaparehong kasalukuyang asset ang bersyon nito, at kailangang may ibang bersyon ang binagong kasalukuyang asset.

**May ilan pang tuntunin ang history ng gawa.** Ang gawa na ang slot ay ginagamit ng destinasyon para sa ibang gawa ay idinaragdag bilang hiwalay na gawa, at nananatili roon ang gawa na nasa Trash ng destinasyon. Pinapanatili ang nasa destinasyon kapag ibang nilalaman ang tinutukoy roon ng checkpoint id. Pinapahinto ng archive na bumagsak sa sarili nitong mga pagsusuri ang pag-import bago magbago ang anumang profile, session, asset o preference, at walang idinaragdag na storage ang muling pag-import ng kapareho.

**Iniuulat ng buod kung ano ang nangyari.** Ibinabalik ng bawat pag-import ang `profile`, `sessions`, `userAssets`, `prefs`, `skipped` at `failedAssets`.

- Binibilang ng `failedAssets` ang mga in-upload na asset na hindi ma-restore, halimbawa dahil puno ang storage ng device.
- Binibilang ng `skipped` ang mga bahagi mula sa mas bagong writer na hindi nakilala ng build na ito. Ipinapakita ng app ang bilang ("… · N mas bagong item ang nilaktawan").
- Kapag may file history, idinaragdag ng buod ang `assetVersions`, `fileOperations`, `fileBatches` at `failedHistory`. Puwedeng magdulot ng bahagyang pag-restore ang pagkaubos ng storage o conflict sa immutable ID, at sinasabi ng app sa tao na itago ang pinagmulang backup.
- Kapag may history ng gawa, idinaragdag nito ang `revisions` at `recoveryDrafts`, na binibilang lang ang idinagdag ng pag-import na ito, at ang `added`, `kept`, `replaced`, `copies` at `hidden` para sa paraan ng pagsasama ng bawat gawa. Binibilang ng `skippedCheckpoints` ang mga checkpoint na ibang nilalaman sa destinasyon ang tinutukoy ng id, at binibilang ng `historyLeftOut` ang mga mas lumang checkpoint at draft na hindi nagkasya sa espasyo para sa history ng device.
- Idinaragdag ng replace import ang `removed` at `failedRemovals`.

Hindi iisang transaksyon ang pag-restore sa mga store ng profile, session, asset at history. **Hindi** inaabante ng cloud sync ang nailapat nitong revision pagkatapos ng bahagya o hindi suportadong pag-restore, kaya nananatiling available ang kopya para subukang muli.

<!--i:eti-unlink-->
## Ano ang hindi kasama sa paglilipat

- **Mga cache ng catalog** (na-download na metadata at blob ng asset, ang index ng tool), na muling sini-sync ng destinasyon.
- **Mga tool at asset ng catalog**, na ipinapalagay na nasa destinasyon na. Ang mga brand token, font at logo na idinagdag ng user ay mga user asset at kasama sa paglilipat.
- **Mga `blob:` at object URL**, na muling ginagawa ng bridge sa pag-load.
- **Mga orihinal na file ng conversion, aktibong execution lease at mga access o signing secret na lokal sa machine.** Hindi portable na history ang mga ito. Kopya ang naka-save na resulta. Hindi nito ibig sabihin na na-back up ang orihinal na source.
- **Ang export sequence counter**, ang pang-araw-araw na counter sa pagpapangalan ng download sa `localStorage` (`lolly-export-seq`). Hindi ito isinasama sa `PREF_KEYS`, kaya hindi ito kailanman kasama sa bundle.

Ipinapakita ng storage meter ang parehong paghahati. Kasama sa bundle ang Saved sessions, My images at File results & versions. Maaaring buuing muli ang asset cache, mga tool preview at offline pin at naiiwan ang mga ito.

![Ang storage meter na naghahati sa data ng device na ito sa mga pinangalanang kategorya, na hiwalay na sinusubaybayan ang Saved sessions at My images sa Asset cache, dito sa bagong install kung saan wala pang laman ang bawat kategorya](/t/url-shot?url=%2F%23%2Fprofile%3Ffocus%3Dstorage-section&width=1440&height=1600&dpi=192&waitMs=2600&format=svg&css=%5Bdata-store-group%3Dmove%5D%2C.storage-actions%2C.store-selbar%7Bdisplay%3Anone%7D&cropSelector=.store-meter&waitSelector=%5Bdata-store-group%3Dmove%5D&drive=click%3A%5Bdata-store-group%3Dwork%5D%3Esummary%3Bclick%3A%5Bdata-store-group%3Dcaches%5D%3Esummary&walker=1&dark=1&filename=ce-storage-categories)

<!--i:eti-building-->
## Data ng organisasyon gamit ang Lolly Work

Bina-back up ng bundle na ito ang personal na library ng device. Ang bundle ay hindi backup ng isang **Lolly Work** instance. Hawak ng serbisyong iyon ang mga account ng organisasyon, access policy, shared project, bersyon ng catalog, approval, render job at audit record. Kumonekta muli at mag-sign in para muling ma-access ang shared na gawa. Hindi ibinibigay ng pag-import ng personal na bundle ang access na iyon.

Bina-back up, pinapanatili at binubura ng mga operator ang data ng server gamit ang sariling mga gabay ng Lolly Work: [Pag-backup at pag-restore](/info/work-operations.html#backup-and-restore) at [Storage at lifecycle ng data sa Lolly Work](/info/work-data-lifecycle.html). Walang alinman sa mga operasyong iyon sa server ang ginagawa ng pag-clear o pag-export ng device.

<!--i:eti-monitor-->
## Sa iba't ibang shell

Nagbabasa at nagsusulat ang `data-transfer.ts` sa pamamagitan lang ng capability bridge (`host.profile`, `host.state`, `host.assets`) at ng mga pinagsasaluhang preference sa `localStorage`. Ang parehong module ang nagbabasa at nagsusulat ng karaniwang envelope sa web at sa mga desktop at mobile app, sa IndexedDB o filesystem storage. Lumalabas lang ang mga opsyonal na bahagi ng history kung available ang adapter ng mga ito. Iniuulat ng import na nilaktawan ang bahaging hindi suportado. Sinusubukan ng headless suite ang mga karaniwang bahagi gamit ang bridge na nasa memory, at may mga test din sa totoong browser ang mga transaksyon ng history.

May dalawang shell na hindi sakop ng garantiyang iyon:

- Walang ililipat ang **one-shot CLI**: nasa memory ang state nito at tumatagal lang sa isang invocation.
- Itinatago ng **TUI** ang state sa `~/.lolly` (mga session, folder, profile). Nagsusulat ang Profile view nito ng sarili nitong mas simpleng backup archive: `saved-state/<slot>.json` bawat session kasama ang `profile.json` at `folders.json`, na walang manifest, walang `formatVersion` o `minReader` at walang integrity map. Tinatanggihan ng reader ng format na ito ang archive na iyon bilang "hindi Lolly backup", kahit magkatulad ang mga pangalan (`lolly-backup-<stamp>.zip`). Kilalang kakulangan ang hindi pa pagkakaisa ng dalawa.

<!--i:eti-clock-->
## Hindi pa portable

Maaaring idagdag sa ibang pagkakataon ang mga bagong uri ng portable na data bilang mga karagdagang bahagi (bagong `formatVersion`, parehong `minReader`). Ganito na inililipat ang mga design system, bilang `design-systems.json` kasama ang mga user asset ng mga ito.

May dalawang pangalang nakalaan para sa data na hindi pa kasama sa paglilipat:

- Maglalaman ang **`tokens.json`** ng dokumento ng design token na [W3C DTCG](https://tr.designtokens.org/format/) kasama ang mga group, set at theme nito, ang format na [ini-import at ine-export ng Penpot](https://help.penpot.app/user-guide/design-systems/design-tokens/). Kasama na sa paglilipat ang sariling mga brand token ng user bilang asset na `user/tokens/brand` sa `assets.json`, at kasama sa record ng design system ang mga token nito.
- Nakalaan ang **`penpot/`** para sa isang na-ingest na Penpot file, o sa subset nito na may kaugnayan sa Lolly, na ipinapakita bilang tool.

<!--i:eti-history-->
## Mga bahagi ng history

Opsyonal ang dalawang bahagi ng history at may sarili silang mga bersyon.

::: details History ng paggawa (v3)
Kasama sa mga manwal na backup mula sa web install na may history ng paggawa ang `revision-history.json`, na may sarili nitong schema na `{ version: 1, documents, revisions, recoveries }`. Dala nito ang mga pinanatiling ID, canonical na snapshot ng input, version stamp, raster preview at hiwalay na draft ng mga writer. Kinukuha ng history adapter ang mga kasalukuyang session at ang mga head nito sa isang transaksyon ng pagbasa, at ginagamit ng `sessions.json` ang parehong mga kasalukuyang snapshot para sa mas lumang reader.

Sinusuri ng pag-restore ang SHA-256 at bilang ng byte ng payload, mga natatanging identity, ugnayan ng dokumento at head, ancestry, timestamp, mga uri ng preview at limitasyon bago i-commit ang archive sa isang transaksyon. Maaaring wala ang mga reference sa parent na na-compact na. Hindi kailanman pinapalitan nang walang abiso ang umiiral na kasalukuyang gawa: kapag nasa magkabilang panig ang isang gawa, nagiging protektadong draft ang panig na hindi pinanatiling kasalukuyan.

May limitasyong 384 MiB sa paglilipat ang archive. Ipinapatupad ang mga limitasyon sa storage nang hindi pinuputol ang mga pinanatiling checkpoint. Isinusulat ng export ang `revision-history.json` at `sessions.json` nang pira-piraso, gamit ang parehong mga byte na ibinibigay ng iisang `JSON.stringify`, kaya hindi kailanman hawak nang buo ang text ng file. Inaalis ang history file sa sandaling lumampas ito sa limitasyon at binibilang na lang mula roon. Pagkatapos, ginagawa muli ang archive nang wala ang pinakaluma nitong mga awtomatikong checkpoint, at binibilang ang mga iyon sa buod ng export bilang `checkpointsLeftOut`, o tinatanggihan ang archive.

Ibinabalik ng shell na walang kakayahang ito ang mga karaniwang session at iniuulat na nilaktawan ang bahagi ng history. Nananatiling hindi suportado ang native na filesystem history hanggang makapagbigay ang adapter nito ng mga transaksyon ng history na nananatili sa storage. Walang history o recovery archive na nananatili sa storage ang mga guest sa pribadong collab.

Hindi isinasama ng personal na snapshot sync ang history ng paggawa. Kapag inilapat ang snapshot sa lokal na dokumentong may history, pinananatili nito ang dating working state bilang hiwalay na recovery draft at pinapawalang-bisa ang write token ng anumang bukas na editor. Nananatili sa device ang mga checkpoint nitong hindi nababago. Pinoprotektahan nito ang lokal na history habang nagpapalit ng snapshot. Hindi nito pinagsasama ang magkakasabay na history mula sa mga device.

Pinananatili ang mga reference sa dating asset, habang patuloy na hinahanap ng rendering ang mga asset sa umiiral na library ng destinasyon. Hindi pa ginagarantiya ng archive na ito ang eksaktong mga lumang byte ng asset o mga lumang render ng tool. Kasama sa sarili nilang bahagi ng backup ang mga byte ng bersyon ng asset at resulta ng file.
:::

::: details Mga naka-save na bersyon at resulta ng file (v2)
Hawak ng opsyonal na bahagi ng history ang `{ version: 2, assetVersions: [...], operations: [...], batches: [...] }`, at tinatanggap din ng mga reader ang naunang anyo ng history-v1 na walang mga batch. Ibinibigay ng bawat snapshot ang matatag na ID at eksaktong bersyon ng asset, ang oras ng pag-save nito, haba sa byte at hex SHA-256, kasama ang isang asset record na may `_file` at opsyonal na `_credentialFile` na tumutukoy sa mga binary na bahagi. Dala ng mga operasyon ang mga detalye ng orihinal na file, request, ulat, timestamp at opsyonal na `_file` ng resulta. Hindi kasama sa paglilipat ang mga pangalan ng storage backend, OPFS handle at execution lease. Tinatanggihan ng mga reader na history v1 lang ang alam ang bagong bersyon ng history bago mag-import, kaya hindi kailanman inaalis nang walang abiso ang pagiging miyembro ng batch.

Itinatala ng mga batch manifest ang bawat napiling source bago iproseso, kasama ang mga file na hindi kailanman binasa, mga kinanselang miyembro, mga kabiguang magreserba ng espasyo para sa resulta at naantalang gawain. May matatag na operation ID, reference at mga detalye ng source, hiniling na pangalan ng output at huling ulat ang bawat miyembro. May idineklarang detalye ang source na hindi nabasa, walang inimbentong digest. Bine-validate ng import ang identity ng miyembro at ang pagtutugma nito sa anumang kasamang ulat ng operasyon. Nananatiling available ang mga ulat ng Lolly Batch kapag inalis na ang mga indibidwal na resulta, pero hindi ibig sabihin ng resibo na naka-store pa ang mga byte ng output nito.

- **Validation muna.** Bine-validate ang bawat kilalang history record, ulat at tinutukoy na file bago magsulat ang anumang pag-import ng profile o asset. Nabibigo ang validation kapag may nawawalang byte o hindi tugmang SHA-256 kahit walang integrity map ang envelope. Nananatiling mga byte array ang mga na-extract na credential, kasama ang mga import mula sa mas lumang writer na nag-serialize sa mga ito bilang mga object na may numeric na key.
- **Kasalukuyang gawain.** Nagiging mga interrupted record sa backup ang mga tumatakbong operasyon, na may ulat ng pagkabigo at walang resulta. Hindi kailanman muling nagsisimula ng background na gawain o nag-i-import ng aktibong lease ang pag-restore. Para subukang muli, kailangang piliin muli ang orihinal na file, na sinusuri laban sa nakatalang SHA-256 nito kung available.
- **Storage.** Magkasamang kino-commit ng mga na-restore na resulta ang kanilang mga byte at metadata sa IndexedDB. Gumagamit ng OPFS ang mga karaniwang bagong resulta kung available, na may IndexedDB bilang fallback. Hindi kailanman pinapalitan ng import ang isang umiiral na aktibong operasyon.
- **Mga limitasyon ng backup.** Ini-stream ng export ang mga byte na ito papunta sa archive, pero ina-unzip pa rin ng pag-restore ang buong backup sa memory, kaya nananatili ang mga limitasyon: **256 MiB ng history payload**, **4 MiB ng history metadata**, hanggang **100 operasyon**, **100 batch** at **2,000 snapshot**. Tahasang tinatanggihan ng export ang sobrang laki o hindi kumpletong history at hindi ito kailanman inaalis nang walang abiso. I-download nang paisa-isa ang mahahalagang bersyon at resulta bago alisin ang mas lumang mga lokal na kopya. Ang mga limitasyong ito ay hindi garantiya batay sa pagsukat ng pinakamataas na paggamit ng memory sa mga phone.
- **Mga lokal na budget.** May budget na 512 MiB at limitasyong 100 record ang lokal na history ng resulta. May hiwalay na budget na 512 MiB ang mga snapshot ng asset at hanggang 20 dating bersyon bawat asset, at kasama sa budget na iyon ang mga byte ng na-extract na credential. Sinusunod ng pag-restore ang mga limitasyong ito at hindi kailanman inaalis nang walang abiso ang umiiral na data ng user.
- **Metadata ng batch.** May hiwalay na budget na 4 MiB ang lokal na metadata ng batch, hanggang 100 manifest at 20 miyembro bawat batch. Nagrereserba ng kapasidad para sa metadata ang mga nakabinbing miyembro, na may limitasyong 32 KiB sa ulat bawat miyembro. Lohikal na budget ito, hindi garantiya ng espasyo sa disk ng browser: ipinapakita ang aktuwal na pagkabigo sa quota, at nananatiling mada-download ang ulat na nasa memory. Gumagawa ng bagong batch ang muling pagsubok sa isang miyembro ng batch nang hindi pinapatungan ang lumang ulat. Hindi inaalis ng pagtanggal ng batch record ang mga byte ng indibidwal na resulta o mga asset ng library.
- **Mga resulta sa library.** Maaaring idagdag sa library ang mga na-convert na resulta nang walang normalization o muling pag-encode, na may kalakip na mga hash ng source at output at ang kaugnayan sa operasyon. Ginagamit muli ng paulit-ulit na pagdagdag ang hindi nabagong kopya, at hindi kailanman pinapatungan ang na-edit na kopya. Maaaring magsimula ng bagong dokumento sa Lolly Design ang mga raster na larawan, na gumagamit ng kasalukuyang ID ng asset sa library. Hiwalay na gawain ang pagpapatupad ng pag-pin sa eksaktong bersyon sa buong runtime at URL path ng Lolly Design. Iniingatan ang mga resultang SVG, HTML, PDF at ZIP bilang mga opaque na file asset, hindi itinataas bilang pinagkakatiwalaang interactive o vector na nilalaman.
- **Saan ito nakikita ng mga tao.** Ipinapakita ng **Convert → Recent file operations** ang paggamit ng history, mga ulat, download at version manager, na nakakahanap din ng mga naunang bersyon ng mga naburang asset sa library. Gumagawa ng bagong kasalukuyang bersyon ang pag-restore ng snapshot at pinapanatili ang napiling snapshot. Hiwalay na binibilang ng **Settings → Preferences → Storage** ang mga resulta at bersyon mula sa mga cache na puwedeng itapon.
- **Paglilinis.** Ang tahasang paglilinis ng mga pansamantalang file ay nag-aalis lang ng mga byte na pag-aari ng operasyon at walang tumutukoy rito. Pinoprotektahan ng mga kasalukuyang record ang kanilang mga file, at may isang oras na palugit ang mga kamakailang OPFS file. Hindi awtomatikong nililinis ang mga naka-save na resulta at snapshot ng asset.

Tinatanggap pa rin ng mas lumang mga reader ang v2 envelope (`minReader: 1`) at ibinabalik ang mga bahaging alam nila, na binibilang bilang nilaktawan ang mga hindi suportadong bahagi ng history. Kailangan ng buong pagbawi ng history ang shell na may `fileHistory` adapter, isang dugtungan sa loob ng shell, hindi isang kakayahan ng `HostV1` na nakaharap sa tool. Sakop ng lokal na Chromium gate ang aktuwal na pag-restore sa dalawang device. Kailangan pang hiwalay na pumasa sa acceptance ang pagbawi sa mga naka-install na desktop, iOS at Android app.
:::

<!--i:eti-code-->
## Sanggunian

- Module: `shells/web/src/data-transfer.ts` (`exportBackup`, `importBackup`, `BACKUP_FORMAT`, `BACKUP_FORMAT_VERSION`, `BACKUP_READER_VERSION`; panloob ang tagapagpangalan na `backupFilename()`).
- Contract test: `tests/data-transfer.test.ts`, na sumasaklaw sa round trip, merge, integrity, forward compatibility at reader gate.
- Mga contract test ng history: `tests/file-history-backup.test.ts`, `tests/file-batch-history.test.ts` at `tests/file-result-library.test.ts`. Browser acceptance: `tests/file-history.browser.test.ts`, `tests/file-batch-history.browser.test.ts` at `tests/file-result-reuse.browser.test.ts`.
- Ginamit na bridge surface: `host.profile`, `host.state` at `host.assets`; tingnan ang [Host API](/info/host-api.html).
