# Browser extension

Hindi kayang basahin ng isang web page ang mga pixel ng ibang website. Sa browser na nakabatay sa Chromium (Chrome, Edge, Brave, Arc o Opera, mula sa Chrome 111), pinapayagan ng libreng **Lolly URL Screenshot** extension ang Lolly web app na kumuha ng screenshot ng page gamit ang parehong capture na ginagamit ng desktop app. Kapag naka-install ang extension:

- Sine-save ng **[Lolly URL Screenshot](/t/url-shot)** bilang file ang page na binuo mo;
- ang web address na na-paste sa isang image slot ay maaaring maging screenshot ng page na iyon, gamit ang **Screenshot this page**;
- maaaring basahin ng source na **Website** sa [Lolly Design System Setup](/info/brand-studio.html) ang isang page para magsimula ng design system.

Inaaprubahan mo ang bawat request, at ginagawa ng desktop app ang parehong mga gawain nang walang extension.

<!--i:eti-checklist-->
## Bago ka mag-install

Kahit walang extension, bumubukas pa rin ang **Lolly URL Screenshot** at puwede kang bumuo ng shot. Sinasabi ng tala sa itaas ng mga kontrol ng tool kung ano ang kulang.

![Ang tala ng URL Screenshot tool na nag-aalok ng extension, na ipinapakita kapag walang host na mapapatakbuhan ang pag-capture sa file](/t/url-shot?url=%2F%23%2Ftool%2Furl-shot&width=1440&height=900&dpi=192&waitMs=2400&walker=1&format=svg&cropSelector=%23capture-hint-notice&dark=1&filename=exp-url-shot-notice)

Gumagana ang bawat kontrol kahit walang extension: ang target na URL, lalim ng pag-scroll, paghihintay na matapos ang pag-load, mga crop inset at pagpapalit ng kulay. Ang capture lang ang nangangailangan ng extension.

![Ang mga kontrol ng Lolly URL Screenshot na may target na URL, lalim ng pag-scroll, paghihintay na matapos ang pag-load at mga crop inset, na magagamit lahat bago pa magkaroon ng extension](/t/url-shot?url=%2F%23%2Ftool%2Furl-shot%3Furl%3Dhttps%3A%2F%2Flolly.tools%26scrollDepth%3D0.3%26waitMs%3D1200&width=1440&height=2200&dpi=192&waitMs=2400&format=svg&css=%23tool-canvas%7Bdisplay%3Anone%7D&cropSelector=%23tool-inputs&walker=1&dark=1&filename=fq-url-shot-controls)

<!--i:eti-download-->
## Mag-install

**Mula sa Chrome Web Store:** malapit na. Kapag na-publish na, mai-install ang extension sa isang click.

**Ikaw mismo ang mag-load (mga developer).** Nasa repository sa `shells/chrome-extension/` ang source ng extension. Binubuo ng hakbang sa packaging ang production package mula sa folder na iyon. Gumagana lang ang package na iyon sa Lolly sa `https://lolly.tools`.

1. Patakbuhin ang `pnpm run pack:chrome-extension`. Binubuo nito ang package sa `dist/chrome-extension/`.
2. Buksan ang `chrome://extensions`.
3. I-on ang **Developer mode** (kanang itaas).
4. I-click ang **Load unpacked** at piliin ang folder na `dist/chrome-extension/`.
5. I-reload ang tab ng Lolly. Natutukoy ng Lolly ang extension kapag nag-load ang page, at nawawala ang prompt na "Get the extension". Pagkatapos, puwede nang mag-save ng mga capture sa file ang **Lolly URL Screenshot** (sa ilalim ng Utilities) at gumagana ito sa Lolly Batch mode.

::: details Para sa lokal na development server, o sa source folder
Para sa lokal na development server, patakbuhin ang `pnpm run pack:chrome-extension:dev` at i-load sa halip ang `dist/chrome-extension-dev`. Tinatanggap din ng package na iyon ang `http://localhost:5173` at may **Development** sa pangalan nito.

Gumagana rin para sa mga PNG screenshot ang pag-load sa mismong folder na `shells/chrome-extension/`. Walang page walk ang folder na iyon, na isinasama ng hakbang sa packaging. Screenshot ang laman ng SVG mula sa folder na iyon, hindi mga hugis.
:::

<!--i:eti-user-check-->
## Ano ang nangyayari kapag humiling ang Lolly

![Humihiling ang tab ng Lolly ng isang page at pinipindot mo ang Approve once sa approval window ng extension. Bumubukas ang isang background tab, binabasa ang page at nagsasara. Pagkatapos, natatanggap ng tab ng Lolly ang resulta.](/info/diagrams/concepts/extension-request.svg)

1. **Humihiling ang Lolly.** Sinasabi ng maliit na script sa Lolly na naroon ang extension, kaya puwedeng magsimula ang capture o pagbasa ng page nang walang karagdagang setup.
2. **Inaaprubahan mo.** Binubuksan ng extension ang sarili nitong window na **Approve page request**. Ipinapakita nito ang site na humihiling, kung screenshot o nilalaman ng page ang gusto nito at ang address ng page. Walang binabasa hangga't hindi mo pinipindot ang **Approve once**. Tinatapos ng **Cancel**, o ng pagsasara ng window, ang request.
3. **Isang beses nagtatanong ang Chrome bawat site.** Sa unang pag-apruba mo ng request para sa isang site, nagtatanong din ang Chrome kung maaaring i-access ng extension ang site na iyon. Pinapanatili ng Chrome ang access na iyon kapag pinayagan mo na, pero kailangan pa rin ng bawat susunod na request ang sarili nitong **Approve once**.
4. **Binabasa ang page sa background tab.** Binubuksan ng extension ang target na page sa background tab, kinukuha ito sa pamamagitan ng DevTools Protocol (ang parehong `Page.captureScreenshot` na ginagamit ng desktop app), isinasara ang tab at ibinabalik ang resulta sa tab ng Lolly na humiling.

::: details Paano gumagana ang SVG capture
Para sa **SVG**, iniisa-isa ng extension ang mga bahagi ng page sa halip na kunan ng larawan ang screen. Binabasa ng script na kasama sa extension ang layout ng page sa background tab at ginagawang mga hugis at outlined na text ang page. Nananatiling matalas ang file sa anumang laki at nae-edit pa rin ang bawat bahagi. Nananatiling mga larawan ang mga larawan sa page. Anumang iginuguhit ng page gamit ang canvas, video o epektong hindi kayang ipakita ng SVG ay kinokopya mula sa screenshot ng parehong sandali. Ikinukumpara ng Lolly ang resulta sa screenshot na iyon. Kapag masyadong malaki ang pagkakaiba ng dalawa, screenshot na lang ang laman ng SVG.

Para gawing outline ang text sa sariling typeface ng page, ibinibigay ng extension sa Lolly ang mga font file na ni-load ng page. Hindi itinatago ng Chrome ang mga byte ng font kung saan mababasa ang mga ito ng extension, kaya hinihingi muli ng extension sa page ang bawat font. Karaniwang sumasagot ang browser mo mula sa cache nito, at naaangkop pa rin sa request na iyon ang sariling security policy ng page.
:::

Sakop ng isang approval ang isang request at nag-e-expire ito pagkalipas ng 30 segundo. Iisang request lang ang puwedeng maghintay o tumakbo sa isang pagkakataon, at humihinto ang naaprubahang request pagkalipas ng 55 segundo. Kung magsara o magbago ang page ng Lolly, o lumipat sa ibang site ang target na page, kinakansela ang request.

::: warning Ginagamit ng mga capture ang browser session mo
Naglo-load ang page gamit ang browser session mo, kaya maaaring magpakita ng pribadong impormasyon sa resulta ang page kung saan naka-sign in ka.
:::

Tumatakbo ang capture sa browser mo sa network mo, kaya gumagana ang `localhost` at mga internal na site. Hindi ina-upload ang capture. Ang tanging network traffic ay ang pag-load ng browser mo sa page na hiniling mo at, para sa SVG, ang pangalawang pag-load sa mga font file ng page na iyon.

Habang tumatakbo ang capture, maaari mong makita sandali ang banner na *"…started debugging this browser"* sa pansamantalang tab. Galing ang banner sa DevTools Protocol at nawawala kapag tapos na ang shot.

<a id="reading-a-site-for-design-system-setup"></a>
<!--i:eti-globe-->
## Pagbasa ng site para sa Lolly Design System Setup

Nagsisimula ang source na **Website** sa Lolly Design System Setup ng design system mula sa site na mayroon ka na. Sa Chromium browser, binabasa ng extension ang page. Sa desktop app, ang app mismo ang kumukuha ng page. Sa browser na walang extension, hindi iniaalok ang Website tile.

- **Isang address, isang page.** Pagkatapos mong mag-apruba, binubuksan ng extension ang page sa parehong uri ng background tab, binabasa ang na-render na markup, text ng stylesheet at ilang larawan ng icon at logo, saka isinasara ang tab. Hindi sumusunod sa mga link o nagka-crawl ang extension.
- Kinukuha rin ang **mga stylesheet na naka-host sa ibang lugar** (isang CDN o serbisyo ng font), dahil naroon ang mga kulay at type ng page. Ipinapadala ang mga cross-origin request nang wala ang mga cookie mo. Ginagamit ng mga same-origin request ang mga cookie mo, tulad ng ginagawa ng page.
- **May limitasyon ang lahat**, sa bilang ng mga stylesheet at larawan at sa mga byte, kaya nagbabalik ng bahagyang materyal ang mapanira o bahagyang sirang page sa halip na mag-hang.
- **Sa device mo nangyayari ang pag-parse.** Direktang bumabalik ang mga byte sa tab ng Lolly na humiling, na ginagawang mga kulay, type at logo ang mga ito.

Pinupunan lang ng pag-paste ng address ang field. Walang binabasa hangga't hindi mo sinisimulan ang pagbasa at pinipindot ang **Approve once**.

<!--i:eti-lock-->
## Mga pahintulot

Nagdedeklara ang `manifest.json` ng extension ng apat na pahintulot, kasama ang access sa site na hinihingi nito nang paisa-isang site. Itinatakda nito ang `minimum_chrome_version: 111`, at 0.5.0 ang kasalukuyang bersyon.

| Pahintulot | Para saan ito | Kailan ito ibinibigay |
|---|---|---|
| `debugger` | Kinokontrol ang background tab sa pamamagitan ng DevTools Protocol, na kumukuha ng screenshot at, para sa SVG, nagpapatakbo ng page walk. | Sa pag-install |
| `tabs` | Binubuksan ang pansamantalang background tab at isinasara ito pagkatapos, at sinusuri kung hindi lumipat ang page ng Lolly o ang target na page mula nang mag-apruba ka. | Sa pag-install |
| `scripting` | Pinapatakbo ang reader ng isang page sa loob ng site na tinukoy mo, para sa Website source. | Sa pag-install |
| `storage` | Itinatala ang id ng tab na binuksan nito, sa session storage lang, para magsara pa rin ang tab kung pansamantalang ihinto ng browser ang extension habang nagbabasa. Nililinis sa susunod na pagsisimula; walang iniimbak tungkol sa iyo. | Sa pag-install |
| `optional_host_permissions: ["http://*/*", "https://*/*"]` | Access sa site, na hindi ibinibigay sa pag-install. Kapag pinindot mo ang **Approve once**, humihingi ang extension sa Chrome ng access sa iisang site sa request na iyon. | Sa unang pag-apruba mo ng request para sa site na iyon, matapos magtanong sa iyo ang Chrome |

Ang page lang na inaaprubahan mo ang binabasa ng extension. Hindi nito binabasa o ipinapadala ang data ng pag-browse mo.

<!--i:eti-help-->
## Pag-troubleshoot

- **Nakikita pa rin ang "Get the extension"?** I-reload ang tab ng Lolly.
- **Walang nangyayari sa site na ito?** Gumagana lang ang extension sa `https://lolly.tools`, kasama ang `http://localhost:5173` sa development package. Kailangan ng ibang origin, tulad ng kopya ng Lolly na ikaw ang nagho-host, ng sarili nitong build ng extension na naglilista ng origin na iyon sa parehong `manifest.json` at `policy.js`. Hindi sapat ang pag-edit lang ng manifest.
- **Nabigo ang capture?** Tingnan kung naaabot ang URL at nagsisimula sa `http://` o `https://`. Hinaharangan ng ilang page ang awtomatikong capture. Kung pinindot mo ang **Cancel**, isinara ang approval window o naghintay nang higit sa 30 segundo, simulan muli ang capture.
