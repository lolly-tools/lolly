# Browser Extension

Ang **Lolly URL Screenshot** extension ay nagbibigay-daan sa web app na kumuha ng screenshot ng anumang web page mula sa loob ng iyong browser. Kung wala ito, kailangan ng desktop app para makakuha ng URL - hindi makakabasa ng pixels mula sa ibang site ang isang browser page nang mag-isa. Kaya ito ng extension, gamit ang parehong capture na ginagamit ng desktop app.

May dalawa pa itong ginagawang trabaho sa parehong paraan. Ang web address na na-paste sa isang image slot ay maaaring maging screenshot ng page na iyon (**I-screenshot ang page na ito**), at kaya ring basahin ng extension ang isang solong page na pinangalanan mo para makakuha ang Brand Studio ng isang brand mula sa isang live na website. Naghihintay ng iyong pag-apruba sa extension ang bawat request.

Tumatakbo ito sa mga Chromium-based na browser: **Chrome, Edge, Brave, Arc, Opera** - Chrome 111 o mas bago.

Hangga't hindi ito naka-install, bubukas pa rin ang **URL Screenshot** para makagawa ka ng shot, at may note sa itaas ng mga kontrol ng tool na nagsasabi kung ano ang kulang.

![Ang note ng URL Screenshot tool na nag-aalok ng extension, ipinapakita kapag walang host na tatakbuhan ang capture to file](/t/url-shot?url=%2F%23%2Ftool%2Furl-shot&width=1440&height=900&dpi=192&waitMs=2400&walker=1&format=svg&cropSelector=%23capture-hint-notice&dark=1&filename=exp-url-shot-notice)

Live ang bawat kontrol habang naghihintay ka: ang target URL, ang scroll depth, ang settle delay, ang crop insets at ang recolour. Ang capture mismo lang ang nangangailangan ng host.

![Ang mga kontrol ng URL Screenshot na may target URL, scroll depth, settle delay at crop insets, lahat magagamit bago pa man umiral ang extension](/t/url-shot?url=%2F%23%2Ftool%2Furl-shot%3Furl%3Dhttps%3A%2F%2Flolly.tools%26scrollDepth%3D0.3%26waitMs%3D1200&width=1440&height=2200&dpi=192&waitMs=2400&format=svg&css=%23tool-canvas%7Bdisplay%3Anone%7D&cropSelector=%23tool-inputs&walker=1&dark=1&filename=fq-url-shot-controls)

## Pag-install

### Mula sa Chrome Web Store

*Malapit na.* Kapag na-publish na ito, ii-install mo ito sa isang click, tapos i-reload ang Lolly.

### I-load ito mismo (para sa mga developer)

Nasa repo ang extension sa `shells/chrome-extension/`. Ang folder na iyon ang production build, na gumagana lang sa Lolly sa `https://lolly.tools`.

1. Buksan ang `chrome://extensions`.
2. I-on ang **Developer mode** (sa kanang-itaas).
3. I-click ang **Load unpacked** at piliin ang `shells/chrome-extension/` folder.
4. I-reload ang Lolly - gumagana na ngayon ang **URL Screenshot** sa browser.

Para sa lokal na development server, patakbuhin ang `pnpm run pack:chrome-extension:dev` at i-load na lang ang `dist/chrome-extension-dev`. Tumatanggap din ang package na iyon ng `http://localhost:5173` at may **Development** sa pangalan nito.

## Paano ito gumagana

- May maliit na script na nagsasabi sa Lolly na naroon ang extension, kaya makakapag-save ng mga capture ang **URL Screenshot** nang walang karagdagang setup.
- Ikaw ang nag-aapruba sa bawat request. Kapag nagtanong ang Lolly, binubuksan ng extension ang sarili nitong **Approve page request** window, na nagpapakita ng site na humihiling, kung screenshot o nilalaman ng page ang gusto nito, at ang address ng page. Walang binabasa hangga't hindi mo pinipindot ang **Approve once**. Tinatapos ng **Cancel**, o ng pagsasara ng window, ang request.
- Sa unang beses na aprubahan mo ang request para sa isang site, tinatanong din ng Chrome kung maaaring ma-access ng extension ang site na iyon. Pinananatili ng Chrome ang access na iyon kapag pinayagan mo na, pero ang bawat kasunod na request ay kailangan pa rin ng sarili nitong **Approve once**.
- Isang request lang ang sakop ng isang pag-apruba at mag-e-expire ito pagkalipas ng 30 segundo. Isang request lang ang puwedeng maghintay o tumakbo sa isang pagkakataon, at humihinto ang aprubadong request pagkalipas ng 55 segundo. Kung nagsara o nagbago ang Lolly page, o lumipat ang target page sa ibang site, kinakansela ang request.
- Pagkatapos mong aprubahan, binubuksan ng extension ang target page sa isang background tab, kinukuha ito sa pamamagitan ng DevTools Protocol (ang parehong `Page.captureScreenshot` na ginagamit ng desktop app), tapos isinasara ang tab at ibinabalik ang larawan sa Lolly tab na humiling.
- Tumatakbo ito nang buo sa iyong browser, sa iyong network - kaya gumagana ang pagkuha ng `localhost` o isang internal site. Nilo-load ang page gamit ang session ng iyong browser, kaya ang page na naka-sign in ka ay maaaring magpakita ng pribadong impormasyon sa resulta. Hindi kailanman ina-upload kung saan man ang capture mismo; ang tanging network traffic ay ang iyong sariling browser na naglo-load ng page na hiniling mong kunan.

Habang tumatakbo ang isang capture, maaari mong makita nang sandali ang isang *"…started debugging this browser"* banner sa pansamantalang tab. Ito ang DevTools Protocol na gumagana; nawawala ito nang mag-isa kapag tapos na ang shot.

## Pagbabasa ng isang site para sa Brand Studio

Ang **Website** source sa Brand Studio ay nagsisimula ng isang brand mula sa isang site na mayroon ka na. Sa Chromium, ang extension ang bumabasa nito; sa desktop app, ginagawa ng native fetch ang parehong trabaho at sa isang plain browser na walang extension, hindi inaalok ang tile.

Ang nangyayari kapag pinindot mo ito:

- Isang address, isang page. Pagkatapos mong aprubahan, binubuksan ito ng extension sa parehong uri ng background tab, binabasa ang na-render na markup, ang stylesheet text at ilang icon at logo image, tapos isinasara ang tab. Hindi ito sumusunod sa mga link at hindi ito nag-c-crawl.
- Ang mga stylesheet na naka-host saanman - isang CDN, isang font service - ay kinukuha rin, dahil naroon ang mga kulay at type ng page. Ang mga cross-origin request ay walang kasamang cookies mo; ang mga same-origin ay gumagamit nito, eksakto tulad ng ginagawa ng page mismo.
- Naka-cap ang lahat - isang limitadong bilang ng mga sheet, larawan at bytes - kaya ang isang hostile o kalahating sirang page ay nagbabalik ng bahagyang materyal sa halip na mag-hang.
- Direktang bumabalik ang bytes sa Lolly tab na humiling. Ang pag-parse sa mga kulay, type at logo ay nangyayari sa iyong device; wala mang ina-upload.

Pupuno lang sa field ang pag-paste ng address. Walang binabasa hangga't hindi mo sinisimulan ang pagbasa at pinipindot ang **Approve once**.

## Pagkatapos mag-install

I-reload ang Lolly tab. Mawawala ang "Get the extension" prompt, makakapag-save ng mga capture sa isang file ang **URL Screenshot** (sa ilalim ng Mga Utility), at magiging available ang tool sa Batch mode.

## Mga pahintulot

Idineklara ng `manifest.json` nito ang apat na pahintulot, kasama ang site access na hinihingi nito nang isang site bawat beses:

- `debugger` - magpapatakbo sa background tab sa pamamagitan ng DevTools Protocol. Ito ang kumukuha ng screenshot.
- `tabs` - magbubukas ng pansamantalang background tab at isasara ito ulit pagkatapos, at titiyakin na hindi lumipat ang Lolly page o ang target page mula nang aprubahan mo ang request.
- `scripting` - patatakbuhin ang one-page reader sa loob ng site na pinangalanan mo, para sa Brand Studio Website source.
- `storage` - itatala ang id ng isang tab na binuksan nito, sa session storage lang, para masara pa rin ang tab kung suspindihin ng browser ang extension habang nagbabasa. Nabubura sa susunod na simula; walang tungkol sa iyo ang naka-store.
- `optional_host_permissions: ["http://*/*", "https://*/*"]` - site access, na hindi ibinibigay sa pag-install. Kapag pinindot mo ang **Approve once**, humihingi ang extension sa Chrome ng access sa nag-iisang site sa request na iyon, at tinatanong ka ng Chrome sa unang beses para sa bawat site.

Isang page lang ang binabasa nito - ang inaprubahan mo - at hindi nito binabasa o inililipat ang iyong browsing data - walang ina-upload kung saan man.

Itinakda rin ng manifest ang `minimum_chrome_version: 111`. Ang kasalukuyang bersyon ay 0.4.0.

## Pag-troubleshoot

- **Nakikita mo pa rin ang "Get the extension"?** I-reload ang Lolly tab - nangyayari ang detection sa page load.
- **Walang nangyayari sa site na ito?** Gumagana lang ang extension sa `https://lolly.tools`, kasama ang `http://localhost:5173` sa development package. Ang ibang origin, tulad ng self-hosted na kopya ng Lolly, ay nangangailangan ng hiwalay na build ng extension na naglilista ng origin na iyon sa parehong `manifest.json` at `policy.js`. Hindi na gumagana ang pag-edit lang ng manifest.
- **Nabigo ang isang capture?** Tiyakin na naaabot ang URL at nagsisimula sa `http://` o `https://`. May ilang page na aktibong humaharang sa automated capture. Kung pinindot mo ang **Cancel**, isinara mo ang approval window o lumampas ka sa 30 segundo, simulan muli ang capture.
