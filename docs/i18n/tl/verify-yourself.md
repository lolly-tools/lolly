# I-verify Mo Mismo

Masusuri ang bawat pangako sa site na ito, nang walang account. Karamihan ng check ay browser lang ang kailangan; ang iba ay nangangailangan ng terminal at kopya ng source. Kung ang check sa ibaba ay hindi nagbibigay ng resultang ipinapakita, bug iyon o sirang pangako, at gusto naming marinig ito: tingnan ang [Kung mabigo ang check](#if-a-check-fails).

Magsimula sa pinakamabilis: mag-drop ng file sa Verify. Pagkatapos, lumayo pa: panoorin ang network habang gumagamit ka ng tool, tanggalin ang saksakan at magpatuloy sa paggawa, bilangin ang mga cookie at basahin ang source.

Sakop ng mga check na ito ang Lolly nang mag-isa. Kung nagpapatakbo ang organisasyon mo ng Lolly Work, nagdaragdag ito ng sign-in, shared na nilalaman, naka-configure na telemetry at audit record; i-check ang mga iyon laban sa [Server Surface](/info/server-surface.html) at sa [seksyon ng organisasyon ng privacy policy](/info/privacy.html#organisation-services-with-lolly-work).

## Panoorin itong gumana, sa loob ng sampung segundo

Buksan ang [`/verify`](/#/verify) at mag-drop ng file sa page. Walang upload, walang account at walang paghihintay sa server. Dito, sinusuri nito ang [generated na Queensland storm](/info/ai-stance.html) mula sa Our AI Stance: larawang ginawa ng Gemini, na binuksan, minarkahan at kinonberte ng Lolly. Ang bawat badge ay kinalkula sa device, mula sa sariling mga byte ng file.

![Verify sa isang phone-width na screen - ang storm image, isang berdeng Made with Lolly verdict at ang credential-intact at bytes-unchanged badges na nakasalansan sa ilalim nito](/t/url-shot?url=%2F%23%2Fverify%3Fsrc%3D%2Finfo%2Fthe-flood.webp&width=440&height=1500&dpi=192&waitMs=6000&waitSelector=.valid-steps&walker=1&format=svg&rasterDpi=96&cropSelector=.valid-top&dark=1&filename=cc-verify-mobile)

Ang hatol ay maliit na tumpok ng mga badge, bawat isa ay independiyenteng katotohanan:

- <!--i:lock--> **Made with Lolly**: buo ang credential *at* nagtatala ito ng Lolly export.
- <!--i:seal--> **Buo ang credential**: nagpa-parse ang signed na C2PA manifest at nabe-verify ang sarili nitong claim signature.
- <!--i:hash--> **Hindi nagbago ang mga byte**: tugma pa rin ang hash ng file sa pinirmahan. Baguhin ang isang pixel at magbabago ang badge na ito.
- <!--i:sparkle--> **GEN AI**: makina ang gumawa ng mga pixel na ito, at sinasabi iyon ng file. Binabasa ng Lolly ang deklarasyong iyon pabalik sa halip na itago ang katotohanan.

Ang buong kasaysayan ay naglalakbay kasama ng file. Siyam na hakbang ang nakaligtas dito: limang itinala ng Google habang ginagawa at winawatermark ang larawan, saka apat na itinala ng Lolly habang binubuksan, minamarkahan at kino-convert ang kopya sa page na ito. Binabasa ng Verify ang mga ito diretso mula sa mga byte at iginuguhit bilang timeline.

![Ang change history na binabasa ni Verify pabalik mula sa storm image - limang hakbang na itinala ng Google, tapos apat ng Lolly, na nagtatapos sa WebP sa page na ito](/t/url-shot?url=%2F%23%2Fverify%3Fsrc%3D%2Finfo%2Fthe-flood.webp&width=1440&height=1400&dpi=192&waitMs=6000&walker=1&format=svg&cropSelector=.valid-steps&dark=1&filename=ai-stance-change-history)

Iyon ang demo. Ang mga check sa ibaba ang mga garantiya sa ilalim nito, at bawat isa ay maaaring ulitin. Ipinapaliwanag ng [Content Credentials](/info/content-credentials-identity.html) ang bawat hatol.

## Sa iyong browser, walang kailangang tools

::: timeline
- <!--i:globe--> **1. Panoorin ang network.** Buksan ang [lolly.tools](https://lolly.tools), buksan ang DevTools ng browser mo (F12), lumipat sa **Network** at gumamit ng tool: mag-type ng web address sa [QR Code](/t/qr-code), palitan ang mga kulay, mag-export ng PNG. Nananatili ang bawat request sa `lolly.tools`: ang app shell, ang sariling mga file ng tool at mga catalog asset. Walang analytics host, walang CDN beacon, walang font service at walang error-reporting endpoint. Ang tina-type mo sa tool ay lumalabas sa **walang anumang request**, dahil lokal ang rendering.
- <!--i:eyeoff--> **2. Hugutin ang saksakan.** I-load ang app at magbukas ng isa o dalawang tool, saka mag-offline (airplane mode, o DevTools → Network → Offline) at mag-reload. Patuloy na gumagana ang gallery at bawat tool na binuksan mo, kasama ang rendering at export sa mga format na ginamit mo. Ang mga file ng tool at encoder ng format ay naka-cache sa unang beses na gamitin mo ang mga ito, kaya gumamit muna ng tool nang minsan online bago subukan offline. Ito ang pinakamalakas na iisang check sa page na ito: ang software na tumatawag pauwi ay hindi nakakaligtas kapag pinutol ang kurdon nito.
- <!--i:check--> **3. Bilangin ang mga cookie.** DevTools → **Application** (Firefox: **Storage**) → Cookies → `https://lolly.tools`. Walang laman ang listahan: walang itinatakdang cookie ang app. I-paste ang `document.cookie` sa console at makakakuha ka ng `""`. Ang opsyonal na CA enrolment ay nagtatakda ng panandaliang `HttpOnly` na cookie, `lolly_ca_state`, saklaw sa `/api/ca`, na hindi maipapakita ng `document.cookie`. Ang Lolly Work instance ay gumagamit ng sarili nitong sign-in cookie; ihambing ang mga iyon sa [Privacy](/info/privacy.html#organisation-services-with-lolly-work).
- <!--i:layers--> **4. Basahin ang sarili mong storage.** Sa parehong panel, ang lahat ng iniingatan ng Lolly ay nasa harap mo: ilang dosenang payak na `localStorage` key (theme, wika, lapad ng sidebar, mga setting ng tunog at view, at cached na kopya ng pampublikong tool catalog index) at ang sarili mong dokumento sa IndexedDB. Ang bawat value ay nababasang string o JSON, walang itinatago. Ang pag-clear ng site data ay nag-aalis ng mga lokal na record na ito, pero hindi ng Sync backup o ng mga record na hawak ng Lolly Work instance. Ang **Settings → Storage → Clear all my data** ay gumagawa ng pareho mula sa loob ng app, at mapapanood mong nauubos ang mga store at cache.
- <!--i:lock--> **5. I-check na umiiral ang disclosure contact.** Ang [`/.well-known/security.txt`](/.well-known/security.txt) ay sumasagot ng [RFC 9116](https://www.rfc-editor.org/rfc/rfc9116) contact block, hindi HTML page.
:::

::: details Ano pa ang maaari mong makita sa Network tab
Ang ilang feature ay umaabot lang sa network kapag ginamit mo ang mga ito, at bawat isa ay nakikita sa parehong tab:

- ang pagdaragdag ng **Google Font** sa Design System Setup ay kumukuha ng isang family na iyon mula sa Google, pagkatapos ng consent dialog na nagsasabi nito, nang minsan, bago ang unang fetch;
- ang pag-click ng **ICC press-profile preset** ay kumukuha ng profile na iyon mula sa pampublikong registry ng ICC sa color.org;
- ang pagpapatugtog ng opsyonal na built-in na **radio** ay nag-i-stream mula sa istasyon;
- ang paglalagay ng lokasyon sa **Meeting Planner** ay hinahanap ang lugar na iyon sa geocoding service ng open-meteo para sa coordinates at time zone nito, isang beses bawat lungsod (sine-save sa device mo ang mga sagot), at sinasabi ito ng field kung saan ka nagta-type;
- ang **URL Screenshot** ay naglo-load ng address na tinype mo, dahil iyon ang trabaho nito, at mapapanood mo itong nangyayari.

Ang tool na nagdedeklara ng network capability ay maaari lang kumuha mula sa mga host na pinapayagan ng manifest nito, at nabibigo ang check na iyon nang sarado. Walang kasamang tool ngayon ang nagdedeklara nito, kaya ang Content-Security-Policy na ipinapatupad ng browser ang nagpapanatili sa listahan sa itaas sa mga host nito. Iniingatan ng [privacy policy](/info/privacy.html) ang canonical na table ng lahat ng ito, kasama ang trapiko ng managed-instance tulad ng policy refresh at naka-enable na reporting.
:::

## Mula sa terminal

**6. Pampublikong data lang ang sinasagot ng render endpoint.** Ang nag-iisang server feature na naglalagay ng tinype na input sa URL, ang hot-link render, ay live dito. Sinasabi ng [privacy policy](/info/privacy.html) kung ano ang ibig sabihin niyon para sa mga input na inilalagay mo sa link.

```bash
curl -s -o /dev/null -w '%{http_code}\n' 'https://lolly.tools/tool/qr-code.svg?url=test'
# 200
```

Bawat deployment ang pumipili (`LOLLY_DISABLE_RENDER_GET=1`): sa instance na nagtatakda nito, ang parehong probe ay nagbabalik ng `404`. Ang pagkakaibang iyon ay ang setting na gumagana, hindi hindi pagkakatugma.

**7. I-check ang mga serbisyong ine-enable ng deployment mo.** Inililista ng [Server Surface](/info/server-surface.html) ang mga opsyonal na serbisyo at nilalagyan ng link ang detalyadong reference nila. Para sa Lolly Work, isama ang mga authenticated API nito, collaboration connection, storage at naka-configure na provider. Ang probe sa pampublikong lolly.tools ay hindi sumusubok sa pribadong instance ng organisasyon.

Kung nagpapatakbo ka ng sarili mong instance, ang [Delivery deployment](/info/deploy-delivery.html) ay may mga release check para rito: model integrity, ang edge probe at ang sample list nito, mga display rendition, ang private download gateway at ang signed catalog sa browser.


## Sa source

Lahat ng nasa itaas ay maaari pa ring maging pagtatanghal kung iba ang naka-deploy na code sa pampublikong code. Kaya i-check ang code. Bumubuo ang deployment mula sa [pampublikong repository](https://github.com/lolly-tools/lolly):

```bash
git clone https://github.com/lolly-tools/lolly.git
cd lolly
```

**8. Walang tracker at walang analytics SDK, saanman.** Hanapin sa code na kasama sa ipinapadala (ang engine, bawat shell kasama ang browser extension, ang mga Tauri bridge override at ang service worker, ang mga server function at ang mga tool pack) ang mga karaniwang suspek:

```bash
grep -rnF --include='*.ts' --include='*.js' --include='*.mjs' --include='*.html' \
  -e googletagmanager -e google-analytics -e posthog -e mixpanel -e hotjar \
  -e sentry.io -e segment.com -e '@vercel/analytics' \
  engine/src shells/*/src shells/chrome-extension shells/*/bridge-overrides \
  shells/web/public/sw.js services packages api community brands/*/tools
# (no output)
```

Naghahanap ang scan na ito ng mga third-party tracking SDK. Hindi nito ipinapakitang walang first-party usage reporting: sinusuportahan ng Lolly Work ang organisation telemetry at hiwalay na audit log, na may sarili nilang policy at test.

**9. Walang third-party DNS resolver.** Ang SEAL check ng Verify ay hindi kailanman nagpapadala ng lookup sa DNS-over-HTTPS provider, dahil walang resolver ang app:

```bash
grep -rnF --include='*.ts' --include='*.js' --include='*.mjs' \
  -e cloudflare-dns.com -e dns.google -e /dns-query \
  engine/src shells/*/src shells/chrome-extension shells/*/bridge-overrides \
  shells/web/public/sw.js services packages api community brands/*/tools
# (no output: outside this page and its built copies, the only place those
#  hostnames appear in the repo is tests/no-trackers.test.ts, the test that
#  bans them)
```

**10. Walang iniingatang issuance log ang certificate service.** Ang identity CA ay walang log ng iniisyu nito at walang inventory ng mga identity: walang stdout line, walang webhook, walang certificate store. Ang kawalan ay maaaring hanapin:

```bash
grep -rn logIssuance services/ca api/ca
# (no output)
```

Nag-iingat ang CA ng panandaliang working state: ang mga rate-limit bucket ay may hawak na hashed na IP at email key sa saklaw ng window nila, at ang admission store ng managed deployment ay nag-iingat ng keyed identifier at request digest nang hindi hihigit sa sampung minuto. Nasa [Content Credentials engineering](/info/content-credentials-engineering.html#protocol) ang detalye.

## Ipinapatupad ng mga test

Ang mga source check sa itaas ay hindi minsanang audit: naka-pin ang mga ito sa test suite, kaya hindi sila tahimik na maaagnas. Ang [`tests/no-trackers.test.ts`](https://github.com/lolly-tools/lolly/blob/main/tests/no-trackers.test.ts) ay sinusuri ang mas mahabang listahan ng pangalan ng tracker kaysa sa scan sa itaas at binibigo ang build kung:

- may lumitaw na anumang analytics o tracking SDK saanman sa shipped source na ini-scan nito, sa app, engine, server, extension at tool-pack code;
- may lumitaw na anumang third-party DNS-over-HTTPS resolver sa source na iyon;
- bumalik ang CA issuance log, sa source **o** sa generated server bundle;
- mawala sa privacy policy ang mga pahayag na hinihingi ng batas (pinangalanang controller, legal basis, karapatang magreklamo).

Patakbuhin mo mismo ang mga ito sa clone (Node 22.18 o mas bago; ang file na ito ay hindi nangangailangan ng `pnpm install`):

```bash
node --test tests/no-trackers.test.ts
# ✔ no analytics or tracking SDK appears anywhere in shipped source
# ✔ no third-party DNS-over-HTTPS resolver is contacted
# ✔ the certificate service logs no personal data
# ✔ privacy policy states a controller, a legal basis and a right to complain
```

Ang buong suite (`pnpm install && pnpm test`) ay nagpapatakbo ng ilang libo pa, kabilang ang mga adversarial cryptography test na inilarawan sa [Security & Verification](/info/security.html).

## Ang hindi mo ma-verify mula sa labas

- **Mga hosting access log.** Ang anumang server na sumasagot sa request ay maaaring mag-log nito: IP address, path at oras. Hindi matutukoy ng outside probe kung gaano katagal iniingatan ang mga log. Kinokontrol ng operator ang logging, rotation at export, at dapat ibunyag ang mga pagpiling iyon. Pinananatili ng lokal na rendering ang karaniwang edit sa device mo; ang opsyonal na server rendering at shared workspace service ay may hiwalay na daloy ng data na inilalarawan ng privacy policy.
- **Na ang deployment ay nagpapatakbo ng code na ito.** Maaari mong i-check na malinis ang source at na tugma dito ang naka-deploy na behaviour, at ginagawa ng mga check sa itaas ang pareho. Ang binary-level attestation ng web deployment ay hindi iniaalok ng web platform. Ang mga pamamaraan ay ang pampublikong repository, ang mga ipinapatupad na test at ang offline check: ang deployment na pinakialaman na tumatawag pauwi ay bumabagsak sa mga check 1 at 2 nang sabay.
- **Mga tool hook.** Ang opsyonal na logic ng built-in na tool ay nire-review sa halip na sandboxed: tumatakbo ito sa page maliban kung mag-opt in ang tool sa Worker. Ang bawat tool sa lolly.tools ay first-party at nire-review bago ipadala. Inilalatag ng [Threat Model](/info/threat-model.html#trust-boundaries) kung saan tumatakbo ang mga hook at ano ang naglilimita sa kanila.

## Kung mabigo ang isang check

Ang pagkakaiba ng page na ito at ng nakikita mo ay security report. Ipadala ito sa mga pribadong channel sa [Security & Verification](/info/security.html#reporting-a-vulnerability). Nagsasagawa kami ng coordinated disclosure at kinikilala ang mga nag-uulat.
