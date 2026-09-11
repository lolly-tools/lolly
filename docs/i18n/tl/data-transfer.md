# Data Transfer - ang `lolly-backup` bundle

Ang lahat ng naiipon ng isang user ng Lolly ay nasa **kanilang device** - walang account, walang cloud. Ang data-transfer bundle ang paraan para ilipat ang halagang iyon: i-export ito sa isang install, dalhin ang file sa anumang paraan (USB, AirDrop, email-to-self, isang network share) at i-import ito sa isa pa. Ang file mismo *ang* transport. Maaaring offline o online ang target. Walang pagkakaiba, dahil walang kailanman nakikipag-usap sa isang server.

![Ang dalawang button na naglilipat ng buong install: isinusulat ng Export my data ang isang zip, binabasa ito pabalik ng Import data](/t/url-shot?url=%2F%23%2Fprofile%3Ffocus%3Dstorage-section&width=1440&height=1800&dpi=192&waitMs=2400&css=.store-manages%7Bdisplay%3Anone%7D&walker=1&format=svg&cropSelector=.storage-subsection&dark=1&filename=pd-transfer-controls)

Ang pahinang ito ang format spec. Para sa end-user na walkthrough, tingnan ang [Using Lolly → Moving to another device](/info/using.html). Ang implementation ay nasa [`shells/web/src/data-transfer.ts`](../shells/web/src/data-transfer.ts), at itinatakda ng [`tests/data-transfer.test.ts`](../tests/data-transfer.test.ts) ang round-trip contract.

> **Saklaw.** Ang isang bundle ay may dalang *user data*, hindi mga tool. Ang mga tool at catalog asset ay naka-sync nang hiwalay at ipinapalagay na naroroon na sa target (sa pinakamasamang kaso ay sa mas mataas na bersyon). Ang pag-import ay hindi kailanman nag-i-install o nag-a-upgrade ng isang tool.

## Mga Layunin

- <!--i:box--> **Isang format, bawat shell.** Ang parehong mga byte ay ginagawa at ginagamit ng web PWA, ng mga Tauri desktop/mobile app at ng anumang hinaharap na shell. Ang bundle ang kontrata. Ang capability bridge ng bawat shell ang per-platform na adapter sa likod nito.
- <!--i:shieldcheck--> **Nakakaligtas sa biyahe.** Ang isang bundle na nasira o na-truncate sa daan ay bumibigo nang malakas sa pag-import, hindi kailanman nagki-kalahating-restore.
- <!--i:clock--> **Nabubuhay nang mas matagal kaysa sa bersyong ito.** Kaya pa ring i-import ng isang mas lumang app ang mga bahaging kinikilala ng isang mas bagong bundle. Ang isang tunay na sumisira na format ay tinatanggihan nang malinis.
- <!--i:check--> **Ligtas i-merge.** Ang pag-import sa isang install na ginagamit na ay hindi kailanman bumubura ng anumang wala sa bundle.

## Ang Envelope

Ang isang bundle ay isang plain na `.zip`. Ipinapangalan ang download ayon sa taong pagmamay-ari nito - `LollyTools-<First>-<Last>-<YYYY-MM-DD>-<n>.zip` (halimbawa, `LollyTools-Ada-Lovelace-2026-06-26-1.zip`) - para manatiling nababasa ang isang Downloads folder ng mga backup. Ang unang pangalan at apelyido ay galing sa profile at inaalis kapag hindi nakatakda. Kung walang profile, `LollyTools-2026-06-26-1.zip` ang resulta, at kung unang pangalan lang, `LollyTools-Ada-2026-06-26-1.zip`. Bawat bahagi ay nili-linis tungo sa isang filename-safe na token (napapanatili ang mga Unicode letra/digit, tinatanggal ang mga espasyo/bantas, may hangganang 32 character). Ang `<n>` ay isang sequence kada araw, kada device, kaya hindi nagbabanggaan at nananatiling maayos ang pagkakasunod-sunod ng mga paulit-ulit na export sa parehong araw. Binubuo ng `backupFilename()` sa [`shells/web/src/data-transfer.ts`](../shells/web/src/data-transfer.ts) ang pangalan. Magkapareho ang laman ng zip anuman ang pangalan. Sa loob:

| Path | Kinakailangan | Laman |
|---|---|---|
| `manifest.json` | oo | Format id, mga bersyon, mga bilang at per-part integrity. Ang unang tinitingnan ng isang reader. |
| `profile.json` | kapag naka-set | Ang `me` record ng user (pangalan, contact, headshot ref, flags). Binabasa sa pamamagitan ng `host.profile`. |
| `sessions.json` | oo | Bawat naka-save na session: slot, tool id/version, label, thumbnail (data-URL) at buong input data. Binabasa sa pamamagitan ng `host.state`. |
| `assets.json` | oo | Metadata para sa bawat na-upload na asset (mga imahe, font, brand token), bawat isa ay tumuturo sa mga byte nito sa ilalim ng `assets/blobs/`. |
| `assets/blobs/<n>.<ext>` | per asset | Ang raw na byte ng asset (mga image at font file). Naka-store nang uncompressed (mga format na naka-compress na). Cosmetic lang ang extension. Ang MIME sa `assets.json` ang authoritative. |
| `prefs.json` | oo | Mga lokal na preference na pag-aari ng user: `theme`, `sidebarWidth` at ang activity tally na `ct-metrics`. |
| `lolly.txt` | oo | Isang human-readable na buod ng bundle (mga bilang, profile, filename) para sa sinumang magbubukas ng zip nang wala ang Lolly. Nabubuo muli sa bawat export at kinikilala sa pag-import, kaya hindi ito kailanman nabibilang bilang isang skipped na bahagi. Isinusulat ito *pagkatapos* ng integrity map, kaya nananatili itong nasa labas nito. |

Sadyang isang plain zip ang bundle: nakakaligtas itong buo sa anumang transport, at maaari itong tingnan ng anumang unzip tool.

Ang `profile.json` ang pinakamaliit na bahagi at ang unang nakikita ng isang reader sa app: ang mga detalyeng pinupunan ng isang producer nang isang beses, kasama ang opt-in na nagpapahintulot sa mga tool na gamitin ang mga ito.

![Ang Profile details form na nagiging profile.json - pangalan, contact, headshot at ang opt-in sa tabi nila](/t/url-shot?url=%2F%23%2Fprofile&width=1440&height=900&dpi=192&waitMs=1800&format=svg&cropSelector=.profile-details-grid&walker=1&dark=1&filename=ce-profile-record)

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

Ang pag-import ay **merge-overwrite**, hindi kailanman replace-all:

- Ang umiiral na datos sa target ay iniiwan sa kinaroroonan.
- Ang anumang key na nagbabanggaan - ang profile, isang session slot, isang id ng na-upload na imahe - ay papalitan ng imported na kopya.
- Walang gagalawin na wala sa bundle. Ang isang session na taglay ng target ngunit wala sa bundle ay nakakaligtas sa import.

Awtomatikong nagre-relink ang mga naka-save na session sa kanilang mga imahe: pinapanatili ang mga asset reference ayon sa id, at nire-resolve muli ang mga ito ng bridge matapos maibalik ang mga na-upload na imahe (kailangan itong gawin sa anumang paraan, dahil hindi nakakaligtas ang mga `blob:` URL sa isang reload).

Ang import summary ay nagre-report ng `{ profile, sessions, userAssets, prefs, skipped, failedAssets }`. Binibilang ng `failedAssets` ang mga na-upload na asset na hindi naibalik (halimbawa, puno ang device storage). Iba ito sa `skipped`, na bumibilang ng mga bahagi mula sa isang forward-compatible na mas bagong writer na hindi kinilala ng build na ito. Ipinapakita ng UI ang `skipped` ("… · N newer items skipped"), kaya matapat ang restore tungkol sa naiwan nito.

## Ang Hindi Naglalakbay

- **Mga catalog cache** (na-download na asset metadata at blobs, ang tool index) - na-re-sync nang libre sa target.
- **Mga tool at brand asset** - wala sa saklaw, at ipinapalagay na naroroon na sa target.
- **`blob:` / object URL** - nabubuo muli ng bridge sa oras ng load.
- **Ang export sequence counter** - ang counter na nagpapangalan sa download kada araw (`localStorage` key na `lolly-export-seq`) ay isang lokal na kaginhawahan sa pagpapangalan. Iniiwan ito sa labas ng `PREF_KEYS`, kaya hindi ito kailanman sumasama sa isang bundle.

Inilalarawan ng storage meter ang parehong paghahati. Sumasama sa bundle ang Saved sessions at My images. Ang asset cache, tool preview at offline pin sa ibaba ng mga ito ay lahat re-derivable, kaya naiiwan sila.

![Hinahati ng storage meter ang datos ng device na ito sa mga pinangalanang kategorya, kasama ang Saved sessions at My images na sinusubaybayan nang hiwalay sa Asset cache, dito sa isang fresh install kung saan walang laman pa ang bawat kategorya](/t/url-shot?url=%2F%23%2Fprofile%3Ffocus%3Dstorage-section&width=1440&height=1600&dpi=192&waitMs=2600&format=svg&css=.store-manages%2C.storage-subsection%2C.store-selbar%7Bdisplay%3Anone%7D&cropSelector=.store-meter&walker=1&dark=1&filename=ce-storage-categories)

## Garantiya sa Cross-shell

Ang `data-transfer.ts` ay nagbabasa at nagsusulat eksklusibo sa pamamagitan ng capability bridge (`host.profile`, `host.state`, `host.assets`) at ng shared na `localStorage` prefs. Dahil ang bridge lang ang tanging seam, ang *parehong* module ay gumagawa ng byte-identical bundle sa bawat shell kahit magkaiba ang storage sa ilalim nito - IndexedDB sa web, ang filesystem sa Tauri. Ginagamit ulit ng mga Tauri shell ang module na ito nang walang pagbabago. Ang implementation lang ng `host.state` nila ang naiiba. Sinusubok ng headless test ang buong round-trip laban sa isang in-memory bridge, kaya ito ang katayuan para sa lahat ng iba pa.

May dalawang shell na wala sa guarantee na iyon, sa magkaibang dahilan:

- Ang **one-shot CLI** ay walang dinadala - ang state nito ay in-memory at pansamantala lang bawat invocation.
- Ang **TUI** ay nagpapanatili ng state (`~/.lolly`: sessions, folders, profile) at ang Profile view nito ay maaaring mag-back up nito, pero sumusulat ito ng *mas simpleng* archive na sarili: `sessions/<slot>.json` bawat session kasama ang `profile.json` at `folders.json`, na walang manifest, walang `formatVersion`/`minReader` at walang integrity map. **Hindi** ito ma-i-import ng format na ito - itinatanggi ito ng reader bilang "not a Lolly backup" - at nakakalito, gumagamit ito ng katulad na pangalan (`lolly-backup-<stamp>.zip`). Ang pagsasanib ng dalawa ay kilalang gap.

## Nakalaang extension points

Ang envelope ay isang manifest kasama ang isang set ng named parts sa disenyo, kaya ang mga bagong uri ng portable data ay maaaring sumakay dito sa hinaharap **nang walang breaking change**. Sumasakay sila bilang additive parts (bagong `formatVersion`, parehong `minReader`), at ang reader ngayon ay lumalampas sa hindi nito nakikilala. Ang mga ito ay nasa [roadmap](/info/overview.html#roadmap), hindi pa ipinapatupad. Nakalaan dito ang mga pangalan para manatiling coherent ang format kapag dumating na sila.

- **`tokens.json` - design tokens.** Isang [W3C DTCG](https://tr.designtokens.org/format/) design-tokens document (ang format na [ini-import at ineksport ng Penpot](https://help.penpot.app/user-guide/design-systems/design-tokens/) - mga token na may `$value`/`$type`/`$description`, nakaayos sa mga group, set at tema). Ang isang token set sa bundle ay nagpapahintulot sa isang user na ilipat ang kanilang brand primitives sa pagitan ng mga install kasama ang kanilang sessions. Sa mas mahabang panahon, ang na-ingest na token set ay magiging first-class source na sinusundan ng mga tool at palette asset.
- **`penpot/` - na-ingest na mga Penpot file.** Isang nakalaang directory para sa isang Penpot file (o ang na-extract, Lolly-relevant subset nito) na na-import at ipinapakita *bilang isang tool*. Dadalhin ng bundle ang na-ingest na definition, kaya sumasama ito sa buong data ng user.

Anumang wala sa mga nakalaang pangalang ito at sa mga parts sa itaas ay, sa paningin ng reader, isang unknown part: hindi nagagalaw at binibilang sa `skipped`.

## Reference

- Module: [`shells/web/src/data-transfer.ts`](../shells/web/src/data-transfer.ts) (`exportBackup`, `importBackup`, `BACKUP_FORMAT`, `BACKUP_FORMAT_VERSION`, `BACKUP_READER_VERSION` - internal ang `backupFilename()` namer).
- Contract test: [`tests/data-transfer.test.ts`](../tests/data-transfer.test.ts) - mga kaso ng round-trip, merge, integrity, forward-compat at reader-gate.
- Ginamit na bridge surface: `host.profile`, `host.state`, `host.assets` - tingnan ang [Host API](/info/host-api.html).
