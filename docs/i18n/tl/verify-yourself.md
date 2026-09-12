# I-verify Mo Mismo

May mga claim ang privacy at security pages ng Lolly: walang analytics, walang tracking, hindi kailanman umaalis sa device ang mga file, isang cookie lang sa buong sistema. Iba ang page na ito: hindi ka nito hinihiling na paniwalaan ang alinman diyan. Isa itong listahan ng mga proseso, bawat isa may eksaktong command o click-path at ang output na makikita mo. Bawat claim dito ay mapapatunayang mali sa loob ng ilang minuto, karamihan nang hindi kailangang mag-install ng anuman.

Kung may check sa page na ito na hindi nagbunga ng resultang ipinapakita, ito ay alinman sa isang bug o isang sirang pangako. [I-report ito](#if-a-check-fails) kahit alin sa dalawa, at pagtutuunan namin ito ng kahalagahang nararapat sa isang sirang pangako.

## Panoorin itong gumana, sa loob ng sampung segundo

Bago ang mga proseso, ang resulta. Buksan ang [`/verify`](/#/verify) at mag-drop ng file dito - walang upload, walang account, walang paghihintay sa server. Narito itong sinusuri ang [ginawang Queensland storm](/info/ai-stance.html) mula sa aming AI stance page: isang Gemini image na binuksan, binago ang laki, at ineksport ng Lolly. Bawat badge sa ibaba ay kinompyut sa device, mula sa sarili nitong bytes ng file.

![Verify sa isang phone-width na screen - ang storm image, isang berdeng Made with Lolly verdict at ang credential-intact at bytes-unchanged badges na nakasalansan sa ilalim nito](/t/url-shot?url=%2F%23%2Fverify%3Fsrc%3D%2Finfo%2Fthe-flood.webp&width=440&height=1500&dpi=192&waitMs=6000&waitSelector=.valid-steps&walker=1&format=svg&rasterDpi=96&cropSelector=.valid-top&dark=1&filename=cc-verify-mobile)

Ang verdict ay hindi isang badge lang kundi isang maliit na tambak ng mga ito, bawat isa ay isang independiyenteng katotohanan:

- <!--i:lock--> **Made with Lolly** - buo ang credential *at* nagtatala ng Lolly export.
- <!--i:seal--> **Buo ang credential** - na-parse ang naka-sign na C2PA manifest at na-verify ang sarili nitong claim signature.
- <!--i:hash--> **Hindi nagbago ang bytes** - tumutugma pa rin ang hash ng file sa naka-sign. Baguhin ang isang pixel at mababaligtad ang badge na ito.
- <!--i:sparkle--> **GEN AI** - isang makina ang gumawa ng mga pixel na ito, at sinasabi iyon ng file. Binabasa itong assertion pabalik ng Lolly sa halip na itago ito.

At ang buong kasaysayan ay sumasama sa file. Siyam na hakbang ang buhay dito - lima na itinala ng Google habang ginagawa at wina-watermark nito ang larawan, tapos apat na itinala ng Lolly habang binubuksan, minamarkahan at kinokonbert nito ang kopya sa page na ito - direktang binasa mula sa bytes, sa iyong device, at inihanay bilang isang timeline. Ito ang parehong larawan, na-verify sa parehong paraan, gaya ng C2PA timeline sa [AI stance page](/info/ai-stance.html).

![Ang change history na binabasa ni Verify pabalik mula sa storm image - limang hakbang na itinala ng Google, tapos apat ng Lolly, na nagtatapos sa WebP sa page na ito](/t/url-shot?url=%2F%23%2Fverify%3Fsrc%3D%2Finfo%2Fthe-flood.webp&width=1440&height=1400&dpi=192&waitMs=6000&walker=1&format=svg&cropSelector=.valid-steps&dark=1&filename=ai-stance-change-history)

Wala doon sa lahat ng iyon ang trust claim, gayunman - ito ang demo. Ang trust claim ay nasa natitirang bahagi ng pahinang ito: bawat badge sa itaas ay reproducible, at narito kung paano mo ma-reproduce ang mga guarantee sa likod ng mga ito.

## Sa iyong browser, walang kailangang tools

**1. Panoorin ang network.** Buksan ang [lolly.tools](https://lolly.tools), buksan ang DevTools ng iyong browser (F12), lumipat sa tab na **Network** at gumamit ng isang tool - mag-type ng URL sa [QR Code](/t/qr-code), baguhin ang mga kulay, i-export bilang PNG. Nananatili sa `lolly.tools` ang bawat request: ang app shell, ang sariling mga file ng tool, ang mga catalogue asset. Walang analytics host, walang CDN beacon, walang font service, walang "error reporting" endpoint. Ang itina-type mo sa isang tool ay lumalabas sa **wala talagang request** - lokal ang rendering.

Ang mga tapat na eksepsiyon - bawat isa ay opt-in, sinimulan ng user, at nakikita sa parehong Network tab kapag nangyari: ang pagdagdag ng **Google Font** sa brand editor ay kumukuha ng isang family na iyon mula sa Google, matapos ang consent dialog na nagsasabi nga nito, minsan lang, bago ang unang fetch; ang pag-click sa **ICC press-profile preset** ay kumukuha ng profile na iyon mula sa pampublikong registry ng ICC sa color.org; ang pagpapatugtog ng opsyonal na built-in na **radio** ay nagsa-stream mula sa istasyon; ang paglalagay ng lokasyon sa **Meeting Planner** ay naghahanap ng lugar na iyon sa geocoding service ng open-meteo para sa mga coordinate at time zone nito, minsan bawat lungsod (naka-save ang mga sagot sa device mo), at dala ng input ang disclosure na iyon mismo sa kinatatayuan mo habang nagta-type ka; at ang **URL Screenshot** ay kinakailangang mag-load ng URL na itina-type mo - iyan ang trabaho nito, at napapanood mo itong nangyayari. Ang tool na nagdedeklara ng network capability ay maaaring mag-fetch lamang mula sa mga host na naka-allowlist sa manifest nito, at fail-closed ang mekanismong iyon; walang kasalukuyang na-ship na tool na nagdedeklara nito, kaya ang Content-Security-Policy na pinapatupad ng browser ang boundary na talagang nagpapanatili sa listahan sa itaas sa mga host nito. Pinapanatili ng [privacy policy](/info/privacy.html) ang canonical table ng lahat ng ito; ang standing rule nito ay hindi mangyayari ang isang network touch na wala sa table na iyon.

**2. Bunutin ang plug.** I-load ang app at magbukas ng isa o dalawang tool, pagkatapos ay mag-offline - airplane mode, o DevTools → Network → Offline. I-reload. Patuloy na gumagana ang gallery at bawat tool na binuksan mo, kasama na ang rendering at export sa mga format na nagamit mo - naka-cache ang mga file ng isang tool at ang encoder ng isang format sa unang pagkakataong gamitin mo ang mga ito, kaya gamitin muna ang isang tool nang online bago ito subukan nang offline. Ito ang pinakamalakas na check sa pahinang ito: hindi nakakaligtas ang software na tumatawag pauwi kapag naputol ang kable nito.

**3. Bilangin ang cookies.** DevTools → **Application** (Firefox: **Storage**) → Cookies → `https://lolly.tools`. Walang laman ang listahan - hindi nagse-set ng cookies ang app. O i-paste ang `document.cookie` sa console: makukuha mo ang `""`. (Ang tanging cookie sa buong sistema, `lolly_ca_state`, umiiral nang hanggang sampung minuto lamang sa panahon ng opsyonal na identity sign-in - buburahin agad pagkatapos matapos ang sign-in - naka-scope sa `/api/ca` at `HttpOnly`: inilalarawan ito nang tumpak ng [privacy policy](/info/privacy.html).)

**4. Basahin ang sarili mong storage.** Sa parehong Application panel: lahat ng iniingatan ng Lolly ay maaaring siyasatin sa harap mo - dalawa hanggang tatlong dosenang plain `localStorage` keys (theme, wika, lapad ng sidebar, mga setting ng tunog at view, kasama ang naka-cache na kopya ng pampublikong tool-catalogue index), at ang iyong sariling mga dokumento sa IndexedDB. Bawat value ay nababasang string o JSON - walang naka-obfuscate, walang naka-encode para pigilan ang pagbasa rito. Binubura ito ng **Profile → Clear all my data**; ganoon din ang pag-clear ng site data sa browser, dahil walang server-side na kopya na mananatili.

**5. Tingnan kung umiiral ang disclosure contact.** Sumasagot ang [`/.well-known/security.txt`](/.well-known/security.txt) ng contact block na sumusunod sa [RFC 9116](https://www.rfc-editor.org/rfc/rfc9116), hindi isang HTML page.

## Mula sa terminal

**6. Ang render endpoint ay sumasagot gamit lamang ang pampublikong data.** Ang tanging feature ng server na naglalagay ng mga input na na-type ng user sa isang URL - ang hot-link render - ay live dito, at sinasabi ng [privacy policy](/info/privacy.html) kung ano ang ibig sabihin nito para sa mga input na inilalagay mo sa isang link:

```bash
curl -s -o /dev/null -w '%{http_code}\n' 'https://lolly.tools/tool/qr-code.svg?url=test'
# 200
```

Ang switch ay per-deployment (`LOLLY_DISABLE_RENDER_GET=1`): sa isang instance na nagtatakda nito, ang parehong probe ay nagbabalik ng `404` - ang pagkakaibang iyon ay ang flag na gumagana, hindi isang hindi pagkakapare-pareho.

**7. Mabibilang ang server surface.** Nakalista sa [Server Surface](/info/server-surface.html) ang bawat server-side route na umiiral, kasama ang standing rule na ang endpoint na wala sa pahinang iyon ay hindi bahagi ng Lolly. I-`curl` ang mga ito; wala nang iba pang matutuklasan.

## Sa source

Maaari pa ring maging teatro ang lahat sa itaas kung magkaiba ang na-deploy na code sa pampublikong code. Kaya suriin ang code - bumubuo ang deployment mula sa [pampublikong repository](https://github.com/lolly-tools/lolly):

```bash
git clone https://github.com/lolly-tools/lolly.git
cd lolly
```

**8. Walang tracker, walang analytics SDK, kahit saan.** Hanapin sa code na na-ship - ang engine, bawat shell (kasama ang browser extension, ang Tauri bridge overrides at ang service worker), ang server functions at ang tool packs - ang mga karaniwang kahinahinala:

```bash
grep -rn --include='*.ts' --include='*.js' --include='*.mjs' --include='*.html' \
  -e googletagmanager -e google-analytics -e posthog -e mixpanel -e hotjar \
  -e sentry.io -e segment.com -e '@vercel/analytics' \
  engine/src shells/*/src shells/chrome-extension shells/*/bridge-overrides \
  shells/web/public/sw.js services packages api community brands/*/tools
# (no output)
```

**9. Walang third-party DNS resolver.** Hindi kailanman inirurutang ng SEAL check ng Verify ang mga lookup sa isang DNS-over-HTTPS provider - wala talagang resolver ang web app:

```bash
grep -rn --include='*.ts' --include='*.js' --include='*.mjs' \
  -e cloudflare-dns.com -e dns.google -e /dns-query \
  engine/src shells/*/src shells/chrome-extension shells/*/bridge-overrides \
  shells/web/public/sw.js services packages api community brands/*/tools
# (no output: outside this page and its built copies, the only place those
#  hostnames appear in the repo is tests/no-trackers.test.ts, the test that
#  bans them)
```

**10. Walang iniingatan ang certificate service.** Walang issuance log ang identity CA - hindi ang iyong email, hindi ang isang timestamp, hindi ang isang webhook. Ang kawalang iyon ay magre-grep:

```bash
grep -rn logIssuance services/ca api/ca
# (no output)
```

## Ipinapatupad ng mga test, hindi ng mga pangako

Ang tatlong source check sa itaas ay hindi isang one-time audit lamang - naka-pin ang mga ito sa test suite, kaya hindi sila tahimik na mabubulok. Bibigo ang build ng [`tests/no-trackers.test.ts`](https://github.com/lolly-tools/lolly/blob/main/tests/no-trackers.test.ts) kung:

- may lumitaw na analytics o tracking SDK kahit saan sa shipped source na sinusuri nito - app, engine, server, extension at tool-pack code man,
- may lumitaw na third-party DNS-over-HTTPS resolver sa source na iyon,
- bumalik ang CA issuance log - sa source **o** sa generated server bundle,
- nawala sa privacy policy ang mga legal na kinakailangang pahayag nito (named controller, legal basis, karapatang magreklamo).

Patakbuhin mo ang mga ito sa clone (Node 22.18+; hindi kailangan ang `pnpm install` para sa file na ito):

```bash
node --test tests/no-trackers.test.ts
# ✔ no analytics or tracking SDK appears anywhere in shipped source
# ✔ no third-party DNS-over-HTTPS resolver is contacted
# ✔ the certificate service logs no personal data
# ✔ privacy policy states a controller, a legal basis and a right to complain
```

Ang buong suite (`pnpm install && pnpm test`) ay nagpapatakbo ng ilang libo pa, kabilang ang mga adversarial cryptography test na inilarawan sa [Security & Verification](/info/security.html).

## Ang hindi mo ma-veripika mula sa labas - sinabi nang tapat

Nakakakuha ng tiwala ang pahinang tulad nito sa pamamagitan ng pagbanggit sa sarili nitong mga limitasyon:

- **Mga hosting access log.** Anumang server na sumasagot sa isang request ay maaaring mag-log ng request - IP, path, timestamp. Hindi mo mave-verify kung ano ang iniingatan o hindi iniingatan ng isang host, at hindi rin namin ito magagawa kundi ayon sa dokumentadong ugali ng aming provider. Iyan mismo ang dahilan kung bakit pinananatili ng arkitektura ang iyong content nang buo sa labas ng wire: kung ano ang hindi umaalis sa device mo ay hindi malo-log ng kahit sino.
- **Na pinapatakbo ng deployment ang code na ito.** Mave-verify mo na malinis ang source at tugma rito ang na-deploy na behavior (ginagawa ng mga check sa itaas ang parehong dulo), pero hindi inaalok ng web platform ang binary-level attestation ng isang web deployment. Ang mga mitigation ay ang pampublikong repo, ang ipinapatupad na mga test, at ang offline check - isang na-tampeng deployment na tumatawag pauwi ay agad na bumabagsak sa check 1 at 2.
- **Hindi naka-sandbox bilang default ang tool hooks.** Ang opsyonal na logic ng isang tool ay tumatakbo nang naisuri na, sa sariling realm ng pahina; ang bawat tool sa lolly.tools ay first-party at nasuri na bago ito na-ship. Ngayon, naka-ship na ang Worker isolation bilang per-tool opt-in - isang tool na ang manifest nito ay nagtatakda ng `isolate: true` ay pinapatakbo ang mga hook nito nang off-thread sa halip - kaya nagliliit ang hindi mo mave-verify mula sa labas, pero ang default na landas ay nasa in-realm pa rin at ang review pa rin ang kontrol. Nakasaad ito, hindi itinatago - tingnan ang bahaging [design boundaries](/info/security.html), na palaging ganito na ang sinasabi.

## Kung mabigo ang isang check

Ang anumang pagkakaiba sa pagitan ng pahinang ito at ng nasaksihang behavior ay isang security report, at talagang mas gusto naming marinig ito kaysa hindi: [fitzy+security@suse.com](mailto:fitzy+security@suse.com), ang button na **Report a vulnerability** sa anumang [lolly-tools repository](https://github.com/lolly-tools) o ang contact sa [`/.well-known/security.txt`](/.well-known/security.txt). Ang coordinated disclosure at reporter credit ang standing policy - nasa [SECURITY.md](https://github.com/lolly-tools/lolly/blob/main/SECURITY.md) ang mga detalye.
