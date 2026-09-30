# Data Transfer - ang `lolly-backup` bundle

Ang lahat ng naiipon ng isang user ng Lolly ay nasa **kanilang device** - walang account, walang cloud. Ang data-transfer bundle ang paraan para ilipat ang halagang iyon: i-export ito sa isang install, dalhin ang file sa anumang paraan (USB, AirDrop, email-to-self, isang network share) at i-import ito sa isa pa. Ang file mismo *ang* transport. Maaaring offline o online ang target. Walang pagkakaiba, dahil walang kailanman nakikipag-usap sa isang server.

![Ang dalawang button na naglilipat ng buong install: isinusulat ng Export my data ang isang zip, binabasa ito pabalik ng Import data](/t/url-shot?url=%2F%23%2Fsettings%3Ffocus%3Dstorage-section&width=1440&height=1800&dpi=192&waitMs=2400&css=.store-move%3Ediv%3Anth-of-type%282%29%2C.store-move%3Ep%3Alast-of-type%7Bdisplay%3Anone%7D&waitSelector=%5Bdata-store-group%3Dmove%5D&drive=click%3A%5Bdata-store-group%3Dmove%5D%3Esummary&walker=1&format=svg&cropSelector=%5Bdata-store-group%3Dmove%5D&dark=1&filename=pd-transfer-controls)

Ang pahinang ito ang format spec. Para sa end-user na walkthrough, tingnan ang [Hanapin at bawiin ang gawa mo → Ilipat ang gawa mo sa ibang device](/info/find-your-work.html#move-your-work-to-another-device). Ang implementation ay nasa [`shells/web/src/data-transfer.ts`](../shells/web/src/data-transfer.ts), at itinatakda ng [`tests/data-transfer.test.ts`](../tests/data-transfer.test.ts) ang round-trip contract.

> **Saklaw.** Ang isang bundle ay may dalang *user data*, hindi mga catalogue tool. Ang mga catalogue tool at catalog asset ay naka-sync nang hiwalay at ipinapalagay na naroroon na sa target (sa pinakamasamang kaso ay sa mas mataas na bersyon); ang mga tool na ginawa mismo ng isang user ay naglalakbay sa loob ng `profile.json`. Ang pag-import ay hindi kailanman nag-i-install o nag-a-upgrade ng isang catalogue tool.

## Mga Layunin

- <!--i:box--> **Isang format, bawat shell.** Ibinabahagi ng web PWA, ng mga Tauri desktop/mobile app at ng mga hinaharap na shell ang parehong envelope at supported na part schema. Nakadepende ang mga opsyonal na bahagi sa mga kakayahan ng bawat shell; iniuulat ang mga bahaging hindi suportado. Binibigay ng bawat capability bridge ang sarili nitong storage adapter.
- <!--i:shieldcheck--> **Nakakaligtas sa biyahe.** Ang isang bundle na nasira o na-truncate sa daan ay bumibigo nang malakas sa pag-import, hindi kailanman nagki-kalahating-restore.
- <!--i:clock--> **Nabubuhay nang mas matagal kaysa sa bersyong ito.** Kaya pa ring i-import ng isang mas lumang app ang mga bahaging kinikilala ng isang mas bagong bundle. Ang isang tunay na sumisira na format ay tinatanggihan nang malinis.
- <!--i:check--> **Ligtas i-merge.** Ang pag-import sa isang install na ginagamit na ay hindi kailanman bumubura ng anumang wala sa bundle.

## Ang Envelope

Ang isang bundle ay isang plain na `.zip`. Ipinapangalan ang download ayon sa taong pagmamay-ari nito - `LollyTools-<First>-<Last>-<YYYY-MM-DD>-<n>.zip` (halimbawa, `LollyTools-Ada-Lovelace-2026-06-26-1.zip`) - para manatiling nababasa ang isang Downloads folder ng mga backup. Ang unang pangalan at apelyido ay galing sa profile at inaalis kapag hindi nakatakda. Kung walang profile, `LollyTools-2026-06-26-1.zip` ang resulta, at kung unang pangalan lang, `LollyTools-Ada-2026-06-26-1.zip`. Bawat bahagi ay nili-linis tungo sa isang filename-safe na token (napapanatili ang mga Unicode letra/digit, tinatanggal ang mga espasyo/bantas, may hangganang 32 character). Ang `<n>` ay isang sequence kada araw, kada device, kaya hindi nagbabanggaan at nananatiling maayos ang pagkakasunod-sunod ng mga paulit-ulit na export sa parehong araw. Binubuo ng `backupFilename()` sa [`shells/web/src/data-transfer.ts`](../shells/web/src/data-transfer.ts) ang pangalan. Magkapareho ang laman ng zip anuman ang pangalan. Sa loob:

| Path | Kinakailangan | Laman |
|---|---|---|
| `manifest.json` | oo | Format id, mga bersyon, mga bilang at per-part integrity. Ang unang tinitingnan ng isang reader. |
| `profile.json` | kapag naka-set | Ang buong `me` record ng user: pangalan, contact, headshot ref at flags, kasama ang mga folder, Trash, project blueprint, user template at mga tool na ginawa ng user, favourites, nakatagong tool, wika at pinili sa emoji. Binabasa sa pamamagitan ng `host.profile`. |
| `sessions.json` | oo | Bawat naka-save na session: slot, tool id/version, label, thumbnail (data-URL) at buong input data. Binabasa sa pamamagitan ng `host.state`. |
| `assets.json` | oo | Metadata para sa bawat na-upload na asset (mga imahe, font, brand token, logo, na-save na kopya ng mga download), bawat isa ay tumuturo sa mga byte nito sa ilalim ng `assets/blobs/`. |
| `assets/blobs/<n>.<ext>` | per asset | Ang raw na byte ng asset (mga image at font file). Naka-store nang uncompressed (mga format na naka-compress na). Cosmetic lang ang extension. Ang MIME sa `assets.json` ang authoritative. |
| `assets/blobs/<n>.c2pa` | kapag naroroon | Nakuhang Content Credentials bilang eksaktong binary bytes, tinutukoy ng `_credentialFile` sa asset record. Hindi ito mga signing key ng device. |
| `design-systems.json` | kapag naroroon | Ang mga design system na ginawa o idinagdag sa install na ito, bilang `{ active, records }`. Pinagsasama ayon sa id sa pag-import; ang aktibong pili ng bundle ay nalalapat lang kapag walang sariling design system ang target. |
| `file-history.json` | opsyonal | Mga versioned na asset snapshot, mga terminal file-operation report at kumpletong batch manifest. May sariling bersyon ang history part; ibinibigay ng internal na `fileHistory` backup adapter ng shell. |
| `revision-history.json` | opsyonal, manual na backup | Matatag na creation ID, mga retained checkpoint, thumbnail at umiikot na recovery draft. Ibinibigay ng `host.state.history.backup` kung suportado. |
| `file-history/versions/` | per snapshot | Mga nakaraang asset byte at nakuhang credentials, hindi nakadepende kung umiiral pa ang kasalukuyang asset. |
| `file-history/results/` | per completed operation | Eksaktong output bytes. Walang orihinal na file na napili-para-i-convert ang iniingatan o kasama. |
| `prefs.json` | oo | Mga lokal na preference na pag-aari ng user: `theme`, `sidebarWidth` at ang activity tally na `ct-metrics`. |
| `lolly.txt` | oo | Isang human-readable na buod ng bundle (mga bilang, profile, filename) para sa sinumang magbubukas ng zip nang wala ang Lolly. Nabubuo muli sa bawat export at kinikilala sa pag-import, kaya hindi ito kailanman nabibilang bilang isang skipped na bahagi. Isinusulat ito *pagkatapos* ng integrity map, kaya nananatili itong nasa labas nito. |

Sadyang isang plain zip ang bundle: nakakaligtas itong buo sa anumang transport, at maaari itong tingnan ng anumang unzip tool.

Ang `profile.json` ang pinakamaliit na bahagi at ang unang nakikita ng isang reader sa app: ang mga detalyeng pinupunan ng isang producer nang isang beses, kasama ang opt-in na nagpapahintulot sa mga tool na gamitin ang mga ito.

![Ang form ng mga detalye ng Profile na nagiging profile.json: pangalan, contact detail at larawan sa profile](/t/url-shot?url=%2F%23%2Fsettings%3Ffocus%3Ddetails-section&width=1440&height=1100&dpi=192&waitMs=1800&format=svg&cropSelector=.profile-details-grid&walker=1&dark=1&filename=ce-profile-record)

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
| `format` | Palaging `lolly-backup`. Tinatanggihan ang isang file na wala nito bilang "not a Lolly backup". |
| `formatVersion` | Ang layout na ginamit **sa pagsulat** ng bundle na ito. Tumataas sa anumang pagbabago sa set o hugis ng mga bahagi. **Hindi** ito ginagawang batayan ng mga reader. |
| `minReader` | Ang minimum na bersyon ng reader na kailangan para i-import **nang ligtas** ang bundle na ito. Ito ang field na ginagawang batayan ng mga reader. |
| `app` | Id ng app na gumawa nito, para sa diagnostics. |
| `exportedAt` | ISO timestamp kung kailan ginawa ang bundle. |
| `counts` | Ang inilagay ng writer, para sa display at sanity-checking. |
| `integrity` | Opsyonal. Nagmamapa ng bawat bahagi maliban sa `manifest.json` sa isang SRI-style na `sha256-<base64>` digest ng mga **uncompressed** na byte nito. |

## Patakaran sa Bersyon (forward compatibility)

Ang paghahati sa pagitan ng `formatVersion` at `minReader` ang nagpapahintulot sa format na lumago nang hindi iniiwan ang mga mas lumang install:

- Nag-i-import ang isang reader ng isang bundle kapag `manifest.minReader ≤` ang sarili nitong bersyon ng reader. Tumatanggi lang ito (may "needs a newer version of the app") kapag hayagang hinihiling ng bundle ang isang mas bagong reader.
- Ang isang **additive** na pagbabago - isang bagong *opsyonal* na bahagi, o isang bagong opsyonal na manifest field - ay nagpapataas ng `formatVersion` ngunit iniiwan ang `minReader` nang hindi nagbabago. Kaya pa ring i-import ng mga mas lumang app ang bawat bahaging kinikilala nila. Ang mga bahaging hindi nila kinikilala ay skinip (tingnan sa ibaba), hindi tuwirang binabalewala.
- Ang isang **breaking** na pagbabago - kung saan ang isang maling pag-import ng isang bahagi ay sumisira sa datos, o kung saan ang dati'y opsyonal na bahagi ay nagiging mandatoryo - ay nagpapataas sa `minReader`. Ang mga mas lumang app ay tatanggi nang malinis sa halip na mag-import ng bagay na hindi nila kayang hawakan.
- Kung magtakda ang isang hinaharap na bundle ng `formatVersion` ngunit alisin ang `minReader`, ang mga reader ay konserbatibong babalik sa paggamit ng `formatVersion` bilang batayan (ituturing na breaking ang pagbabago).

> **Simpleng patnubay para sa mga may-akda:** kung gagawin pa rin ng bawat umiiral na reader ang tamang bagay sa pamamagitan ng pagbalewala sa dinagdag mo, additive ito - itaas ang `formatVersion`, iwanan ang `minReader`. Kung hindi, itaas ang `minReader`.

## Integridad

Kapag naroroon ang `manifest.integrity`, vine-verify ng isang reader ang SHA-256 ng bawat nakalistang bahagi **bago magsulat ng anuman**. Ang isang mismatch ("failed its integrity check") o isang nawawalang bahagi ("incomplete") ay nag-a-abort sa buong import - walang partial restore. Nahuhuli nito ang katiwalian na maaaring idulot ng isang file transport (isang na-truncate na AirDrop, isang email gateway na nag-re-encode ng attachment, isang masamang USB sector).

Sadyang best-effort ang integrity: isinusulat lang ito kung saan available ang Web Crypto (bawat secure browser context at modernong Node), at vine-verify lang kapag naroroon ang parehong map at Web Crypto. Ang isang bundle na walang map - halimbawa, isa mula sa panahon bago pa magkaroon ng integrity - ay nag-i-import nang hindi nagbabago. Ang "cannot verify" ay hindi kailanman itinuturing na "corrupt".

Hindi nakalista sa manifest ang sarili nito o ang nabuong muli na `lolly.txt` README. Sinasaklaw ng mga digest ang mga bahaging binabatikos ng manifest.

## Semantika ng Pag-import

Ang import ay isang **merge**, hindi kailanman replace-all:

- Ang umiiral na datos sa target ay iniiwan sa kinaroroonan.
- Kapag nasa dalawa ang isang session slot o na-upload na image id, ang kopyang mas kamakailang na-save ang mananatili, kaya hindi kailanman babalewalain ng isang mas lumang backup ang mas bagong gawa sa target. Ang pantay o hindi alam na oras ay pinapanatili ang kopya ng target. Sa isang web install na may creation history, ang parehong tuntunin ang magpapasya kung aling kopya ng isang creation ang mananatiling kasalukuyan, at ang kabilang kopya ay iniingatan bilang isang protected draft (tingnan sa ibaba).
- Ang profile record ay pinagsasama, hindi pinapalitan. Ang bawat folder sa target ay nananatili kasama ang laman nito; ang isang folder mula sa bundle na wala sa target ay idinaragdag, at ang isang folder na nasa dalawa ay pinapanatili ang pangalan at parent ng target at nakakakuha ng mga miyembro ng bundle na wala pa rito. Ang isang session na naka-file sa isang folder sa target ay nananatiling naka-file doon.
- Pinagsasama ang mga favourite (tool, catalog asset at Projects item). Idinaragdag ang mga template, Projects template at user tool mula sa bundle kapag walang record ang target na may ganoong id. Iniingatan ang mga Trash entry mula sa dalawa, kaya ang isang item na puwedeng i-restore sa alinman sa dalawang install ay puwede pa ring i-restore.
- Ang bawat iba pang profile field (pangalan, contact detail, wika, feature flag, nakatagong tool at iba pang setting) ay pinapanatili ang value ng target. Ang isang field na blangko sa target ay kumukuha ng value ng bundle. Ganito rin sa `prefs.json`: isinusulat lang ang isang preference kung saan wala pa nito ang target.
- Ang karaniwang pag-apply ng device sync ang eksepsiyon: para panatilihing magkasabay ang mga device, kinukuha nito ang profile record, preference, session at larawan ng na-sync na kopya. Ganito rin ang pagbabalik sa isang mas naunang kopya, dahil sadyang bumabalik ito sa nakaraan. Ang unang pagsali, ang **Bring it to this device**, ay nagsasama tulad ng isang import.
- Ang mga historical asset version at operation ID ay mga immutable na eksepsiyon: idempotent ang isang paulit-ulit na import, at ang isang ID na nagngangalan na ng ibang bytes/history ay tinatanggihan, hindi pinapatungan. Ang muling pag-import ng eksaktong parehong kasalukuyang asset ay pinananatili ang bersyon nito. Ang isang kasalukuyang asset na nagbago ay dapat magdala ng ibang bersyon.
- Nagsasama rin ang creation history. Ang isang creation na nasa magkabilang panig ay pinapanatili ang kopyang mas kamakailang na-save bilang kasalukuyan at ang kabilang kopya bilang protected draft; ang isang creation na ang slot nito ay ginagamit ng target para sa ibang creation ay idinaragdag sa tabi nito; ang isang creation sa Trash ng target ay nananatili doon. Ang isang checkpoint id na nagngangalan ng ibang laman sa target ay pinapanatili ang sa target. Ang isang archive na bumagsak sa sarili nitong pagsusuri ay humihinto sa import bago pa man magkaroon ng anumang pagbabago sa profile, session, asset o preference. Walang idinaragdag na storage ang isang eksaktong paulit-ulit na import.
- Walang nagagalaw na wala sa bundle. Ang isang session na taglay ng target pero wala sa bundle ay nakakaligtas sa import.

Awtomatikong nagre-relink ang mga naka-save na session sa kanilang mga imahe: pinapanatili ang mga asset reference ayon sa id, at nire-resolve muli ang mga ito ng bridge matapos maibalik ang mga na-upload na imahe (kailangan itong gawin sa anumang paraan, dahil hindi nakakaligtas ang mga `blob:` URL sa isang reload).

Ang import summary ay nagre-report ng `{ profile, sessions, userAssets, prefs, skipped, failedAssets }`. Binibilang ng `failedAssets` ang mga na-upload na asset na hindi naibalik (halimbawa, puno ang device storage). Iba ito sa `skipped`, na bumibilang ng mga bahagi mula sa isang forward-compatible na mas bagong writer na hindi kinilala ng build na ito. Ipinapakita ng UI ang `skipped` ("… · N newer items skipped"), kaya matapat ang restore tungkol sa naiwan nito.

Kapag naroroon ang file history, dala rin ng summary ang `assetVersions`, `fileOperations` at `failedHistory`. Puwedeng magdulot ng partial restore ang pagkaubos ng storage o mga hidwaan sa immutable ID; sinasabihan ng UI ang user na itago ang orihinal na backup. Hindi isinusulong ng cloud sync ang applied revision nito pagkatapos ng isang partial o hindi suportadong restore, kaya nananatiling available ang snapshot para sa muling pagsubok. Hindi iisang transaction sa lahat ng profile/session/asset/history store ang restore.

## Kasaysayan ng creation (v3)

Kasama sa mga manual na backup mula sa isang history-capable na web host ang `revision-history.json` na may sariling `{ version: 1, documents, revisions, recoveries }` na schema. Dala nito ang mga retained ID, canonical na input snapshot, version stamp, raster preview at hiwalay na writer draft. Kinukuha ng history adapter ang mga kasalukuyang session at ang mga head nito sa iisang read transaction; ginagamit ng `sessions.json` ang parehong kasalukuyang snapshot na iyon para sa mga mas lumang reader.

Sinusuri ng restore ang SHA-256 at bilang ng byte ng payload, natatanging identity, relasyon ng document/head, ancestry, timestamp, uri ng preview at mga limitasyon bago i-commit ang archive sa iisang transaction. Puwedeng wala ang mga na-compact na parent reference. Hindi kailanman tahimik na pinapalitan ang umiiral na kasalukuyang gawa: kapag nasa magkabilang panig ang isang creation, ang panig na hindi pinanatiling kasalukuyan ay nagiging protected draft. Sinusuri nang tahasan ang 384 MiB na transfer limit ng archive, at ipinapatupad ang mga storage limit nang hindi pinuputol ang mga retained checkpoint. Gumagamit pa rin ang kabuuang backup ng isang in-memory na ZIP implementation at hindi ito isang streaming archive.

Idinaragdag ng summary ang `revisions` at `recoveryDrafts`, na binibilang lang ang idinagdag ng import na ito, at ang `added`, `kept`, `replaced`, `copies` at `hidden` para sa kung paano pinagsama ang bawat creation. Ibinabalik ng isang shell na walang kakayahang ito ang mga ordinaryong session at iniuulat ang bahagi ng history bilang skipped. Nananatiling hindi suportado ang native filesystem history hangga't hindi nagbibigay ang adapter nito ng durable history transaction. Walang durable history o recovery archive ang P2P guest state.

Sadyang hindi kasama ang creation history sa personal snapshot sync. Ang pag-apply ng isang snapshot sa isang lokal na dokumentong may history ay nag-iingat ng nakaraang working state nito bilang hiwalay na recovery draft at nagpapawalang-bisa sa write token ng anumang bukas na editor. Nananatili sa device ang mga immutable checkpoint nito. Pinoprotektahan nito ang lokal na history habang pinapalitan ang snapshot; hindi nito pinagsasama ang magkasabay na history ng device.

Iniingatan ang mga historical na asset reference, habang ang pag-render ay nire-resolve pa rin ang mga asset sa pamamagitan ng umiiral na library ng destinasyon. Hindi pa ginagarantiya ng archive na ito ang eksaktong lumang asset bytes o lumang tool render. Nagpapatuloy ang paglalakbay ng asset-version at file-result bytes sa pamamagitan ng umiiral na hiwalay na backup part nito.

## Mga na-save na bersyon at file result (v2)

May laman ang opsyonal na history part na `{ version: 2, assetVersions: [...], operations: [...], batches: [...] }`; tinatanggap din ng mga reader ang mas naunang hugis ng history-v1 na walang batches. Kinikilala ng bawat snapshot ang matatag na asset ID at eksaktong bersyon, ang oras ng pag-save nito, haba ng byte at hex SHA-256, kasama ang isang asset record na ang `_file` at opsyonal na `_credentialFile` ay tumuturo sa mga binary part. Dala ng mga operation ang orihinal na file fact, request, report, timestamp at opsyonal na result `_file`; hindi naglalakbay ang mga pangalan ng storage backend, OPFS handle at execution lease. Tinatanggihan ng mga reader na history-v1-only lang ang bagong history version bago mag-import, sa halip na tahimik na iwan ang batch membership.

Itinatala ng mga batch manifest ang bawat napiling source bago iproseso, kasama ang mga file na hindi kailanman nabasa, mga cancelled na member, mga kabiguang mag-reserve ng result space at mga naantalang gawa. Bawat member ay may matatag na operation ID, source reference/fact, hiniling na output name at terminal report. Ang isang hindi nabasang source ay may nakadeklarang fact, hindi imbentadong digest. Vine-validate ng import ang member identity at pagkakapareho nito sa anumang dalang operation report. Nananatiling available ang mga batch report kahit tahasang tinanggal na ang mga indibidwal na resulta, pero hindi ibig sabihin ng isang resibo na naka-store pa rin ang output bytes nito.

- Bawat kilalang history record, report at tinutukoy na file ay vine-validate bago magsulat ng anumang import ng profile o asset. Nabibigo ang mga nawawalang byte at hindi tugmang SHA-256 kahit walang integrity map ang envelope. Nananatiling byte array ang mga nakuhang credential, kasama ang mga import mula sa mas lumang writer na nag-JSON-serialize sa kanila bilang mga object na may numeric key.
- Ang mga tumatakbong operation ay nagiging interrupted na record sa backup, may paliwanag na failure report at walang resulta. Ang pag-restore ay hindi kailanman nag-re-restart ng background work o nag-i-import ng aktibong lease. Kailangang piliin muli ang orihinal na file para mag-retry, na sinusuri laban sa naitalang SHA-256 nito kung available.
- Sabay na kino-commit ng mga na-restore na resulta ang bytes at metadata nito sa IndexedDB. Ginagamit ng ordinaryong bagong resulta ang OPFS kung available, may IndexedDB fallback. Hindi kailanman pinapalitan ng isang import ang isang umiiral na live na operation.
- Nasa memory pa rin ang pagbuo ng History ZIP: ang kasalukuyang limitasyon ay **256 MiB ng history payload**, **4 MiB ng history metadata**, hanggang **100 operation**, **100 batch** at **2,000 snapshot**. Tahasang tinatanggihan ng export ang sobrang laki o hindi kumpletong history; hindi nito ito kailanman tahimik na inaalis. I-download nang isa-isa ang mahahalagang bersyon/resulta bago alisin ang mas lumang lokal na kopya. Hindi mga garantiyang sinukat na peak-memory para sa telepono ang mga limitasyong ito.
- May 512 MiB na budget at 100-record na cap ang lokal na result history. May hiwalay na 512 MiB na budget at hanggang 20 historical na bersyon kada asset ang mga asset snapshot; binibilang ang mga nakuhang credential bytes sa budget na iyon ng snapshot. Ginagalang ng restore ang mga limitasyong ito at hindi kailanman tahimik na inaalis ang umiiral na datos ng user.
- May hiwalay na 4 MiB na budget ang lokal na batch metadata, hanggang 100 manifest at 20 member kada batch. Ang mga pending na member ay nag-re-reserve ng metadata capacity, may 32 KiB na per-member na report ceiling. Isang logical na budget ito, hindi isang garantiya ng browser disk-space; ang isang tunay na quota failure ay ipinapakita at nananatiling ma-download ang in-memory na report. Ang muling pag-subok sa isang batch member ay gumagawa ng bagong batch nang hindi ino-overwrite ang lumang report. Ang pag-alis ng isang batch record ay hindi nag-aalis ng indibidwal na result bytes o library asset.
- Puwedeng tahasang idagdag sa library ang mga na-convert na resulta nang walang normalization o re-encoding. Sinasamahan ng source/output hash at ng operation relation ang asset. Ang paulit-ulit na pagdaragdag ay gumagamit muli ng hindi nagbagong kopya; hindi kailanman ino-overwrite ang isang na-edit na kopya. Puwedeng magsimula ng bagong Design document ang mga raster image. Ginagamit ng dokumentong iyon ang kasalukuyang library asset ID: hiwalay pa ring gawain ang pagpapatupad ng eksaktong version pin sa buong runtime at URL path ng Design. Ang mga resultang SVG/HTML/PDF/ZIP ay iniingatan bilang opaque na file asset ng handoff na ito, hindi itinataas sa pinagkakatiwalaang interactive/vector na content.
- Inilalantad ng **Convert → Recent file operations** ang paggamit ng history, mga report, download at ang version manager. Nakakahanap din ang manager ng mas naunang bersyon ng na-delete na library asset. Ang pag-restore ng isang snapshot ay gumagawa ng bagong kasalukuyang bersyon habang buo pa ring iniiwan ang napiling snapshot. Binibilang ng **Mga Setting → Imbakan** ang mga resulta at bersyon nang hiwalay sa mga disposable na cache.
- Ang tahasang paglilinis ng pansamantalang file ay nag-aalis lang ng mga byte na pag-aari ng operation at hindi tinutukoy. Pinoprotektahan ng mga kasalukuyang record ang kanilang mga file; may isang-oras na grace period ang mga kamakailang OPFS file. Hindi awtomatikong nililinis ang mga na-save na resulta at asset snapshot.

Tinatanggap pa rin ng mga mas lumang reader ang v2 envelope (`minReader: 1`) at nire-restore ang mga pamilyar na bahagi, binibilang ang mga hindi suportadong history part bilang skipped. Nangangailangan ng buong history recovery ang isang shell na may `fileHistory` adapter; isang shell-internal na seam ito, hindi isang bagong `HostV1` capability na nakaharap sa tool. Sinasaklaw ng lokal na Chromium gate ang tunay na two-device restore; hiwalay pa rin ang pagtanggap ng recovery sa naka-install na Tauri/iOS/Android.

## Ang Hindi Naglalakbay

- **Mga catalog cache** (na-download na asset metadata at blobs, ang tool index) - na-re-sync nang libre sa target.
- **Mga catalogue tool at catalogue asset** - wala sa saklaw, at ipinapalagay na naroroon na sa target. Ang mga brand token, font at logo na idinagdag ng user ay mga user asset, kaya naglalakbay ang mga ito.
- **`blob:` / object URL** - nabubuo muli ng bridge sa oras ng load.
- **Mga conversion original, live execution lease at machine-local na access/signing secret** - hindi portable na history payload. Ang isang na-save na resulta ay isang kopya, hindi isang pangako na na-back up ang orihinal na source.
- **Ang export sequence counter** - ang counter na nagpapangalan sa download kada araw (`localStorage` key na `lolly-export-seq`) ay isang lokal na kaginhawahan sa pagpapangalan. Iniiwan ito sa labas ng `PREF_KEYS`, kaya hindi ito kailanman sumasama sa isang bundle.

Inilalarawan ng storage meter ang parehong paghahati. Sumasama sa bundle ang Saved sessions, My images at File results & versions. Ang asset cache, tool preview at offline pin sa ibaba ng mga ito ay lahat re-derivable, kaya naiiwan sila.

![Hinahati ng storage meter ang datos ng device na ito sa mga pinangalanang kategorya, kasama ang Saved sessions at My images na sinusubaybayan nang hiwalay sa Asset cache, dito sa isang fresh install kung saan walang laman pa ang bawat kategorya](/t/url-shot?url=%2F%23%2Fprofile%3Ffocus%3Dstorage-section&width=1440&height=1600&dpi=192&waitMs=2600&format=svg&css=%5Bdata-store-group%3Dmove%5D%2C.storage-actions%2C.store-selbar%7Bdisplay%3Anone%7D&cropSelector=.store-meter&waitSelector=%5Bdata-store-group%3Dmove%5D&drive=click%3A%5Bdata-store-group%3Dwork%5D%3Esummary%3Bclick%3A%5Bdata-store-group%3Dcaches%5D%3Esummary&walker=1&dark=1&filename=ce-storage-categories)

## Garantiya sa Cross-shell

Ang `data-transfer.ts` ay nagbabasa at nagsusulat eksklusibo sa pamamagitan ng capability bridge (`host.profile`, `host.state`, `host.assets`) at ng shared na `localStorage` prefs. Binabasa at isinusulat ng parehong module ang common envelope sa web at Tauri, sa ibabaw ng IndexedDB o filesystem storage. Lumalabas lang ang mga opsyonal na history part kung saan available ang katugmang adapter; ang isang hindi suportadong part ay iniuulat bilang skipped sa pag-import. Sinusubok ng headless suite ang mga common part laban sa isang in-memory bridge, habang may mga real-browser test din ang history transactions.

May dalawang shell na wala sa guarantee na iyon, sa magkaibang dahilan:

- Ang **one-shot CLI** ay walang dinadala - ang state nito ay in-memory at pansamantala lang bawat invocation.
- Ang **TUI** ay nagpapanatili ng state (`~/.lolly`: sessions, folders, profile) at ang Profile view nito ay maaaring mag-back up nito, pero sumusulat ito ng *mas simpleng* archive na sarili: `saved-state/<slot>.json` bawat session kasama ang `profile.json` at `folders.json`, na walang manifest, walang `formatVersion`/`minReader` at walang integrity map. **Hindi** ito ma-i-import ng format na ito - itinatanggi ito ng reader bilang "not a Lolly backup" - at nakakalito, gumagamit ito ng katulad na pangalan (`lolly-backup-<stamp>.zip`). Ang pagsasanib ng dalawa ay kilalang gap.

## Nakalaang extension points

Ang envelope ay isang manifest kasama ang isang set ng named parts sa disenyo, kaya ang mga bagong uri ng portable data ay maaaring sumakay dito sa hinaharap **nang walang breaking change**. Sumasakay sila bilang additive parts (bagong `formatVersion`, parehong `minReader`), at ang reader ngayon ay lumalampas sa hindi nito nakikilala. Hindi pa ito ginagawa. Nakalaan dito ang mga pangalan para manatiling coherent ang format kapag dumating na sila.

- **`tokens.json` - design tokens.** Isang [W3C DTCG](https://tr.designtokens.org/format/) design-tokens document (ang format na [ini-import at ineksport ng Penpot](https://help.penpot.app/user-guide/design-systems/design-tokens/) - mga token na may `$value`/`$type`/`$description`, nakaayos sa mga group, set at tema). Ang isang token set sa bundle ay nagpapahintulot sa isang user na ilipat ang kanilang brand primitives sa pagitan ng mga install kasama ang kanilang sessions. (Ang sarili mong brand token ay naglalakbay na ngayon bilang `user/tokens/brand` na asset sa `assets.json`; ang part na ito ay magdadala ng buong DTCG document kasama ang mga set at tema nito.) Sa mas mahabang panahon, ang na-ingest na token set ay magiging first-class source na sinusundan ng mga tool at palette asset.
- **`penpot/` - na-ingest na mga Penpot file.** Isang nakalaang directory para sa isang Penpot file (o ang na-extract, Lolly-relevant subset nito) na na-import at ipinapakita *bilang isang tool*. Dadalhin ng bundle ang na-ingest na definition, kaya sumasama ito sa buong data ng user.

Anumang wala sa mga nakalaang pangalang ito at sa mga parts sa itaas ay, sa paningin ng reader, isang unknown part: hindi nagagalaw at binibilang sa `skipped`.

## Reference

- Module: [`shells/web/src/data-transfer.ts`](../shells/web/src/data-transfer.ts) (`exportBackup`, `importBackup`, `BACKUP_FORMAT`, `BACKUP_FORMAT_VERSION`, `BACKUP_READER_VERSION` - internal ang `backupFilename()` namer).
- Contract test: [`tests/data-transfer.test.ts`](../tests/data-transfer.test.ts) - mga kaso ng round-trip, merge, integrity, forward-compat at reader-gate.
- History contract test: [`tests/file-history-backup.test.ts`](../tests/file-history-backup.test.ts), [`tests/file-batch-history.test.ts`](../tests/file-batch-history.test.ts) at [`tests/file-result-library.test.ts`](../tests/file-result-library.test.ts). Browser acceptance: [`tests/file-history.browser.test.ts`](../tests/file-history.browser.test.ts), [`tests/file-batch-history.browser.test.ts`](../tests/file-batch-history.browser.test.ts) at [`tests/file-result-reuse.browser.test.ts`](../tests/file-result-reuse.browser.test.ts).
- Ginamit na bridge surface: `host.profile`, `host.state`, `host.assets` - tingnan ang [Host API](/info/host-api.html).
