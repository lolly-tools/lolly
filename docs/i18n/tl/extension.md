# Browser extension

Hindi mababasa ng web page ang mga pixel ng ibang website, kaya kailangan ng Lolly web app ng tulong para mag-screenshot ng page. Sa Chromium-based na browser (Chrome, Edge, Brave, Arc o Opera, mula Chrome 111), ang libreng **Lolly URL Screenshot** extension ang nagbibigay ng tulong na iyon, gamit ang parehong capture na ginagamit ng desktop app. Kapag naka-install ito:

- Sine-save ng **[Lolly URL Screenshot](/t/url-shot)** ang page na binuo mo bilang file;
- ang web address na na-paste sa image slot ay maaaring maging screenshot ng page na iyon, gamit ang **Screenshot this page**;
- ang **Website** source sa [Lolly Design System Setup](/info/brand-studio.html) ay maaaring magbasa ng isang page para magsimula ng design system.

Aaprubahan mo ang bawat request, at ginagawa ng desktop app ang parehong trabaho nang walang extension.

## Bago ka mag-install

Hanggang hindi naka-install ang extension, bumubukas pa rin ang **Lolly URL Screenshot**, kaya makakabuo ka ng shot. Sinasabi ng tala sa itaas ng mga kontrol ng tool kung ano ang kulang.

![Ang note ng URL Screenshot tool na nag-aalok ng extension, ipinapakita kapag walang host na tatakbuhan ang capture to file](/t/url-shot?url=%2F%23%2Ftool%2Furl-shot&width=1440&height=900&dpi=192&waitMs=2400&walker=1&format=svg&cropSelector=%23capture-hint-notice&dark=1&filename=exp-url-shot-notice)

Gumagana ang bawat kontrol habang naghihintay ka: ang target na URL, ang lalim ng scroll, ang settle delay, ang crop inset at ang recolour. Ang mismong capture lang ang nangangailangan ng extension.

![Ang mga kontrol ng Lolly URL Screenshot na may target URL, scroll depth, settle delay at crop insets, lahat magagamit bago pa man umiral ang extension](/t/url-shot?url=%2F%23%2Ftool%2Furl-shot%3Furl%3Dhttps%3A%2F%2Flolly.tools%26scrollDepth%3D0.3%26waitMs%3D1200&width=1440&height=2200&dpi=192&waitMs=2400&format=svg&css=%23tool-canvas%7Bdisplay%3Anone%7D&cropSelector=%23tool-inputs&walker=1&dark=1&filename=fq-url-shot-controls)

## Pag-install

**Mula sa Chrome Web Store:** malapit na. Kapag nailathala na ang extension, mai-install mo ito sa isang click.

**I-load mo mismo (mga developer).** Ang source ng extension ay nasa repository sa `shells/chrome-extension/`. Ang packaging step ay bumubuo ng production package mula sa folder na iyon, na gumagana lang sa Lolly sa `https://lolly.tools`.

1. Patakbuhin ang `pnpm run pack:chrome-extension`. Binubuo nito ang package sa `dist/chrome-extension/`.
2. Buksan ang `chrome://extensions`.
3. I-on ang **Developer mode** (kanang itaas).
4. I-click ang **Load unpacked** at piliin ang `dist/chrome-extension/` folder.
5. I-reload ang Lolly tab. Nangyayari ang detection kapag nag-load ang page, kaya nawawala ang prompt na "Get the extension". Ang **Lolly URL Screenshot** (sa ilalim ng Utilities) ay makakapag-save na ng mga capture sa file at magiging available sa Lolly Batch mode.

Para sa lokal na development server, patakbuhin ang `pnpm run pack:chrome-extension:dev` at i-load na lang ang `dist/chrome-extension-dev`. Tumatanggap din ang package na iyon ng `http://localhost:5173` at may **Development** sa pangalan nito.

Gumagana rin ang pag-load mismo ng `shells/chrome-extension/` folder, para sa mga PNG screenshot. Walang page walk ang folder na iyon (ang packaging step ang naglalagay nito), kaya ang SVG mula rito ay may screenshot sa halip na mga hugis.

## Ano ang nangyayari kapag humiling ang Lolly

![Humihingi ang Lolly tab ng isang page at pinindot mo ang Approve once sa approval window ng extension. Bumubukas ang background tab, binabasa ang page at nagsasara. Pagkatapos, nakukuha ng Lolly tab ang resulta.](/info/diagrams/concepts/extension-request.svg)

1. **Humihingi ang Lolly.** Sinasabi ng maliit na script sa Lolly na naroon ang extension, kaya makakasimula ang capture o pagbasa ng page nang walang ibang setup.
2. **Aaprubahan mo.** Binubuksan ng extension ang sarili nitong **Approve page request** window. Ipinapakita nito ang site na humihiling, kung screenshot o nilalaman ng page ang gusto, at ang address ng page. Walang binabasa hanggang pindutin mo ang **Approve once**. Tinatapos ng **Cancel**, o ng pagsasara ng window, ang request.
3. **Nagtatanong ang Chrome nang isang beses bawat site.** Sa unang beses na aprubahan mo ang request para sa isang site, tinatanong din ng Chrome kung maaaring mag-access ang extension sa site na iyon. Iniingatan ng Chrome ang access na iyon kapag pinayagan mo, pero ang bawat susunod na request ay nangangailangan pa rin ng sariling **Approve once**.
4. **Binabasa ang page sa background tab.** Binubuksan ng extension ang target na page sa background tab, kinukuha ito sa pamamagitan ng DevTools Protocol (ang parehong `Page.captureScreenshot` na ginagamit ng desktop app), isinasara ang tab at ibinibigay ang resulta sa Lolly tab na humiling.

Para sa **SVG**, nilalakad ng extension ang page sa halip na kumuha ng larawan ng screen. Binabasa ng script na kasama ng extension ang layout ng page sa background tab na iyon at ginagawang mga hugis at outlined na text ang page, kaya nananatiling matalas ang file sa anumang laki at mae-edit ang bawat bahagi. Ang mga larawan sa page ay dumarating bilang mismong mga larawan, at ang iginuguhit ng page gamit ang canvas, video o effect na walang anyo sa SVG ay kinokopya mula sa screenshot ng parehong sandali. Sinusuri ng Lolly ang resulta laban sa screenshot na iyon, at kapag masyadong magkaiba ang dalawa, ang screenshot ang laman ng SVG.

Para ma-outline ang text sa sariling typeface ng page, ibinibigay ng extension sa Lolly ang mga font file na na-load ng page. Hindi iniingatan ng Chrome ang mga byte ng font kung saan mababasa ng extension, kaya hinihingi muli ng extension sa page ang bawat font. Kadalasang sumasagot ang browser mo mula sa cache nito, at nalalapat pa rin sa request na iyon ang sariling security policy ng page.

Isang request lang ang sakop ng isang pag-apruba at nag-e-expire ito sa loob ng 30 segundo. Isang request lang ang puwedeng maghintay o tumakbo sa isang pagkakataon, at ang inaprubahang request ay humihinto pagkatapos ng 55 segundo. Kung magsara o magbago ang Lolly page, o lumipat ang target na page sa ibang site, kinakansela ang request.

Tumatakbo ang capture sa browser mo, sa network mo, kaya gumagana ang `localhost` at mga internal na site. Naglo-load ang page gamit ang browser session mo, kaya ang page na naka-sign in ka ay puwedeng magpakita ng pribadong impormasyon sa resulta. Hindi ina-upload ang capture: ang tanging network traffic ay ang sarili mong browser na naglo-load ng page na hiniling mo, at para sa SVG, ang mga font file ng page na iyon sa pangalawang pagkakataon.

Habang tumatakbo ang capture, maaari kang makakita saglit ng banner na *"…started debugging this browser"* sa pansamantalang tab. Iyon ang DevTools Protocol na gumagana, at nawawala ang banner kapag tapos na ang shot.

<a id="reading-a-site-for-design-system-setup"></a>
## Pagbasa ng site para sa Lolly Design System Setup

Ang **Website** source sa Lolly Design System Setup ay nagsisimula ng design system mula sa site na meron ka na. Sa Chromium browser, binabasa ng extension ang page. Sa desktop app, ang app mismo ang kumukuha ng page. Sa browser na walang extension, hindi iniaalok ang Website tile.

- **Isang address, isang page.** Pagkatapos mong aprubahan, binubuksan ng extension ang page sa parehong uri ng background tab, binabasa ang na-render na markup, ang stylesheet text at ilang icon at logo na larawan, saka isinasara ang tab. Hindi ito sumusunod sa mga link o nag-crawl.
- **Ang mga stylesheet na naka-host sa ibang lugar** (CDN o font service) ay kinukuha rin, dahil nandoon ang mga kulay at type ng page. Ang mga cross-origin request ay walang cookie mo; ang same-origin request ay gumagamit nito, gaya ng gagawin ng page mismo.
- **May takip ang lahat**, na may limitasyon sa bilang ng stylesheet at larawan at sa mga byte, kaya ang masama o sirang page ay nagbabalik ng bahagyang materyal sa halip na mag-hang.
- **Nangyayari ang pag-parse sa device mo.** Ang mga byte ay diretsong bumabalik sa Lolly tab na humiling, na ginagawa itong mga kulay, type at logo.

Ang pag-paste ng address ay pumupuno lang sa field. Walang binabasa hanggang simulan mo ang pagbasa at pindutin ang **Approve once**.

## Mga pahintulot

Ang `manifest.json` ng extension ay nagdedeklara ng apat na permission, kasama ang site access na hinihingi nito isang site sa bawat pagkakataon. Itinatakda nito ang `minimum_chrome_version: 111`, at ang kasalukuyang bersyon ay 0.5.0.

| Permission | Para saan ito | Kailan ibinibigay |
|---|---|---|
| `debugger` | Minamaneho ang background tab sa pamamagitan ng DevTools Protocol, na kumukuha ng screenshot at, para sa SVG, nagpapatakbo ng page walk. | Sa pag-install |
| `tabs` | Binubuksan ang pansamantalang background tab at isinasara ito pagkatapos, at chine-check na hindi gumalaw ang Lolly page o ang target na page mula nang aprubahan mo. | Sa pag-install |
| `scripting` | Pinapatakbo ang one-page reader sa loob ng site na pinangalanan mo, para sa Website source. | Sa pag-install |
| `storage` | Itinatala ang id ng tab na binuksan nito, sa session storage lang, para magsara pa rin ang tab kung sinuspinde ng browser ang extension sa gitna ng pagbasa. Nililinis sa susunod na start; walang tungkol sa iyo ang iniimbak. | Sa pag-install |
| `optional_host_permissions: ["http://*/*", "https://*/*"]` | Site access, hindi ibinibigay sa pag-install. Kapag pinindot mo ang **Approve once**, hinihingi ng extension sa Chrome ang access sa iisang site sa request na iyon. | Sa unang beses na aprubahan mo ang request para sa site na iyon, pagkatapos kang tanungin ng Chrome |

Binabasa lang ng extension ang iisang page na inaprubahan mo. Hindi nito binabasa o ipinapadala ang browsing data mo, at walang ina-upload.

## Pag-troubleshoot

- **Nakikita pa rin ang "Get the extension"?** I-reload ang Lolly tab.
- **Walang nangyayari sa site na ito?** Gumagana lang ang extension sa `https://lolly.tools`, kasama ang `http://localhost:5173` sa development package. Ang ibang origin, tulad ng self-hosted na kopya ng Lolly, ay nangangailangan ng sariling build ng extension na naglilista ng origin na iyon sa parehong `manifest.json` at `policy.js`. Hindi gumagana ang pag-edit ng manifest lang.
- **Nabigo ang capture?** I-check na maaabot ang URL at nagsisimula sa `http://` o `https://`. Hinaharangan ng ilang page ang automated capture. Kung pinindot mo ang **Cancel**, isinara ang approval window o naghintay nang higit sa 30 segundo, simulan muli ang capture.
