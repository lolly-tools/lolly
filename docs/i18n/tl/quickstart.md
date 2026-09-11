# Quickstart

Ginagawang mga tool ng Lolly ang mga alituntunin mo - kulay, font, layout, lohika - na kayang gamitin ninuman para gumawa ng mga natapos na file: mga larawan, PDF, social card, video, sa pamamagitan lang ng pagpuno ng ilang field. Kaunti lang ang pag-aaralan at walang kailangang i-upload: sa device mo tumatakbo ang paggawa at pag-export, online man o offline.

Ito ang unang pahinang dapat basahin. Dalawang bagay ang magpapaproduktibo sa iyo: **gawing sarili mo ang Lolly** at **dalhin ang mga meron ka na** (ang iyong mga design file at token). Isang link na lang ang layo ng lahat ng iba pa.

> Bago sa Lolly at gusto mo lang gumawa ng kahit ano? Gagabayan ka ng [Gumawa ng isang bagay sa loob ng 60 segundo](/info/make-something.html) sa tatlo, o [buksan ang app](/#/), pumili ng kahit anong tool mula sa gallery, punan ang mga blangko at pindutin ang **Export**. Bumalik dito kapag gusto mo nang isuot nito ang *iyong* brand.

![Ang Utilities view - ang mga on-device na kabalikat gaya ng Strip Hidden Data, Compress PDF at Convert Image, nasa iisang lugar](/t/url-shot?url=%2F%23%2Fu&width=1440&height=900&dpi=192&waitMs=1600&css=.welcome-dialog%2C.personalize-nudge%7Bdisplay%3Anone!important%7D&tolerance=0.03&format=svg&walker=1&dark=1&filename=use-utilities&try=1)

## 1. Gawing sarili mo - i-configure ang iyong Design System

Ang brand mo sa Lolly ay isang maliit na **design-tokens** na dokumento - mga kulay, font at ilang alituntunin - na ginagamit ng bawat tool bilang batayan sa pag-render. I-set ito nang isang beses at magiging on-brand ang lahat ng gagawin mo sa mismong pagkakabuo, hindi sa pag-review pa. May tatlong paraan para pumasok; piliin ang tugma sa kung saan naroroon na ang brand mo.

### Magsimula mula sa wala (ang design system builder)

Sa unang pagbukas, dadalhin ka sa **gallery**, na may maikling welcome dialog sa ibabaw nito na nag-aalok ng tatlong paraan para pumasok - **Make it yours** (ang Brand Studio sa `#/start`), **Bring your design** (i-drop ang isang Figma, Penpot, InDesign o PDF file at magbubukas ito bilang isang layout na puwedeng i-edit - ang pinakamabilis na daan papunta sa [Dalhin ang mga meron ka na](#2-bring-in-what-you-already-have) sa ibaba) at **Explore the community tools** - saka isang hanay ng mga wika kung hindi Ingles ang sa iyo. Piliin ang unang card at mapupunta ka sa [**Brand Studio**](/info/brand-studio.html). Bigyan ito ng pangalan at isang primary na kulay at *kukunin* ng Lolly mula rito ang isang kumpleto at accessible na palette - light/dark surfaces, text, accents - gamit ang parehong colour maths na ginagamit ng engine sa lahat ng dako.

![Ang Colours room ng Brand Studio - isang primary na kulay, at ang accessible na palette na kinukuha ng Lolly mula rito](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor&width=1440&height=740&dpi=192&waitMs=1800&format=svg&walker=1&localize=1&dark=1&filename=brand-colours) Pumili ng font, at may gumaganang brand ka na sa loob ng wala pang isang minuto. Mula roon, ang anim na room ng studio - Overview, Colours, Type, Logos, Tokens, Files - ang magdadala nito hanggang saan mo gusto, sa kahit anong pagkakasunod-sunod, at puwede mong pinuhin ang alinman dito tuwing babalik ka. Ipinapakita ng **Design system** tab ng dashboard (`#/d`) ang resulta bilang read-only at itinuturo ka nito pabalik sa `#/start`, kung saan nangyayari ang pag-e-edit (maliban kung nasa brand-locked na build ka ng Lolly, kung saan nakapirmi ang brand at wala nang mababago).

### I-import ang brand na meron ka na

Kung nakuha na ang brand mo bilang design tokens - mula sa **Penpot**, **Tokens Studio** (Figma) o kahit anong plain na **DTCG** file - dalhin ito nang buo sa halip na i-type ulit. Dalawang paraan:

- <!--i:palette--> **Sa loob ng app:** tinatanggap ito ng [design system builder: Brand Studio](/info/brand-studio.html) (`#/start`) sa pamamagitan ng **Add from…** sa dulo ng room rail nito - isang token file, isang Penpot export, isang SVG o isang `LollyBrand` pack. I-drop lang ito at magli-light up ang palette.
- <!--i:code--> **Mula sa command line**, para magtayo ng reusable na brand pack:

```bash
# a monolithic tokens.json, a one-file-per-set directory, or a Penpot project archive
npm run ingest:brand -- ./my-tokens.json --name acme --label "Acme" --activate
```

Tinatanggap ng `ingest:brand` ang lahat ng tatlong container kung saan ini-export ng Penpot / Tokens Studio ang parehong dokumento - isang solong `tokens.json`, isang directory (`$metadata.json` + mga per-set file) o isang `project.penpot` archive. Gamit ang `--activate`, ire-register nito ang brand bilang isang profile, lilipat dito at ire-rebuild ang catalog. Tingnan ang [Configuration](/info/configuration.html) kung paano magkasya ang mga brand pack at profile.

### I-tune ito sa loob ng app

Kapag aktibo na ang isang brand, ipagpatuloy ang paghubog dito sa [**Brand Studio**](/info/brand-studio.html) (`#/start`) - palitan ang isang kulay o isang role at nag-a-update ang bawat preview sa buong app habang nagta-type ka. (Ang **Design system** tab ng dashboard sa `#/d` ay *nagpapakita* lang ng brand bilang read-only; sa Studio mo ito ine-edit.)

![Ang Design-system tab ng Dashboard - ang aktibong brand na ipinapakitang read-only](/t/url-shot?url=%2F%23%2Fd%3Ftab%3Dbrand&width=1440&height=900&dpi=192&waitMs=1800&format=svg&walker=1&localize=1&dark=1&filename=dashboard-brand) Ang parehong brand ay buod sa **Profile → Your brand** card. Totoo ang mga font: pumili mula sa Google Fonts at ise-store ng Lolly ang file **sa device mo** bilang isang brand asset, kaya nagbibiyahe ang typography mo kahit offline at wala nang kinukuha sa oras ng pag-render.

Kapag nasiyahan ka na, **i-export ang brand bilang isang `LollyBrand` pack** - isang solong file na maaaring i-import ng kasamahan mo para makuha ang eksaktong parehong palette, font at alituntunin. Ganoon lumilipat ang isang brand sa pagitan ng mga tao at makina nang walang server sa gitna.

> **Nagbi-round-trip ang brand tokens sa dalawang direksyon.** Dahil ang brand ng Lolly ay *talagang* DTCG tokens - ang format na direktang binabasa at isinusulat ng Penpot at dinadala ng Tokens Studio sa Figma - ang palette na *ginagamit mo sa* pag-design at ang palette na *ipinapatupad* ng Lolly ay iisang dokumento lang, hindi dalawang listahan na kailangan mong i-sync nang manu-mano. Tingnan ang [Design Tokens](/info/design-tokens.html).

## 2. Dalhin ang mga meron ka na

Hindi ka nagsisimula sa blangkong pahina. Binubuksan ng Lolly ang design work at ang mga open format na meron ka na.

### Mga open-source na design file

Ang natapos na trabaho sa **Figma, Penpot, Illustrator, InDesign o kahit anong SVG app** ay hindi kailangang manatiling naka-lock sa app na ginamit mo sa pagguhit nito. Buksan ang **Design**, i-click ang **Import a design**, at magbubukas ang file bilang isang *living layout* - hindi isang flattened na larawan. Ang bawat layer ay nagiging isang editable na box: nananatiling maaaring i-retype ang text, nananatiling shapes ang mga shape, napupunta sa library mo ang mga larawan at napapanatili nang tapat ang mga kumplikadong vector art. Dumarating na itong naka-conform na sa iyong mga brand face at alituntunin sa kulay.

| Meron ka | Dalhin ito bilang |
|---|---|
| Isang Figma frame | Native na `.fig` (File → Save local copy), o isang SVG export |
| Isang Penpot design | Ang `.penpot` export nito, o kahit anong SVG |
| Isang Illustrator file | Native na `.ai` (PDF-compatible) o `.pdf` - direktang bubukas |
| Isang InDesign layout | `.idml` (File → Export → InDesign Markup) |
| Kahit ano pa | **Kahit anong SVG** - ang universal na pinto papasok |

Ang buong import ay nangyayari **sa device mo** - pino-parse ang file sa browser mo at walang ini-upload. Nasa [Import a design](/info/design-import.html) ang buong detalye, at kung ano eksaktong nadadala.

**PowerPoint deck** ba ang meron ka? I-drop ang `.pptx` sa **Deck Builder** para i-edit ito nang slide by slide, naka-snap na sa brand mo - o patakbuhin ang **Rebrand a Deck** para makuha ang parehong deck na muling na-theme, buo pa rin ang mga chart at animation.

### Mula sa isang beses lang papuntang template

Ito ang bunga: ang na-import na layout ay isa lamang ordinaryong Design session, kaya kapag **na-save** mo na ito, mananatili itong nasa isang URL. Kahit sino na may Lolly ay puwedeng buksan ang URL na iyon, palitan ang mga salita, palitan ang isang larawan at i-render ang sarili nilang bersyon - walang kailangang design app, at nananatiling naka-lock ang mga naka-lock na bahagi. Ang isang beses-lang na design ay nagiging isang reusable na tool. Iyon ang buong ideya, nakakamit nang hindi na kailangang magsulat ng kahit isang linya ng configuration.

### Open data at open tools

Ang [koleksyon ng community tools](/info/builders.html) ay open source at brand-agnostic - QR code, street map, filter, privacy utilities - at nagre-render ito ayon sa *iyong* brand sa sandaling i-activate mo ito.

Pakainin din ang mga tool ng sarili mong open data: i-paste o i-drop ang isang **CSV** o **JSON** table at pupunuin mula rito ang mga repeating field ng isang tool, isang natapos na asset kada row.

## 3. Gumawa ng isang bagay, tapos ibahagi o i-automate ito

Kapag aktibo na ang isang brand at nasa kamay mo na ang iyong materyal, gumagawa ang bawat tool ng isang natapos na file:

- <!--i:download--> **I-render** ang kahit anong tool papuntang **SVG, PDF, PNG, JPG, WebP, video** at marami pa - sa tunay na print sizes at physical units kapag kailangan mo ang mga ito. Tingnan ang [Exporting & formats](/info/exporting.html).
- <!--i:link--> **Magbahagi ng link.** Ang bawat estado ng tool ay isang URL, kaya ang isang natapos na asset ay reproducible at parameter-addressable - i-commit ang link, i-regenerate on demand.
- <!--i:layers--> **Gawin ito nang bulk.** Patakbuhin ang isang template mula sa isang spreadsheet sa loob ng [batch grid](/info/exporting.html): isang natapos na asset kada row.
- <!--i:cpu--> **I-automate ito.** Ang parehong render ay tumatakbo mula sa [CLI](/info/cli.html) at mula sa isang [AI agent](/info/ai-agents.html) - ang URL ang API.

Literal ang "ang URL mismo ang API". Walang taong gumuhit ng chart sa ibaba: ang type nito, ang heading nito at ang buong data table nito ay tinipa sa address bar, at ang parehong link ay nagre-render ng parehong chart sa anumang device.

![Isang area chart ng buwanang signup, kung saan ang bawat value ay dumating bilang isang query parameter sa halip na isang click](/t/url-shot?url=%2F%23%2Ftool%2Fchart%3Fct%3Darea%26d%3DMonth%2CSignups%250AJan%2C120%250AFeb%2C180%250AMar%2C265%250AApr%2C340%250AMay%2C455%26t%3DSignups%2520this%2520year%26full&width=1440&height=900&dpi=192&waitMs=2600&cropSelector=%23tool-canvas&walker=1&format=svg&dark=1&filename=vt-d3-url-chart)

## Saan susunod

Tatlong pathway, depende sa kung ano ang dahilan mo rito:

- <!--i:people--> **[Lolly for Creators](/info/creators.html)** - gumagawa ka ng mga bagay. Ang mga bentahe, at kung paano makuha ang pinakamahusay mula sa app.
- <!--i:code--> **[Lolly for Builders](/info/builders.html)** - gumagawa ka ng mga tool, nag-i-integrate at nagde-deploy. Ang teknikal na dokumentasyon.
- <!--i:shieldcheck--> **[Lolly for Operators](/info/operators.html)** - responsable ka para sa brand, seguridad at rollout sa buong organisasyon.
