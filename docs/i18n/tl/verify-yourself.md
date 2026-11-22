# Ikaw Mismo ang Mag-verify

Maaaring suriin ang bawat pangako sa site na ito, nang walang account. Browser lang ang kailangan ng karamihan sa mga pagsusuri; terminal at kopya ng source ang kailangan ng iba. Kung hindi ibinigay ng pagsusuri sa ibaba ang ipinakitang resulta, bug iyon o hindi natupad na pangako, at gusto naming malaman: tingnan ang [Kung mabigo ang pagsusuri](#if-a-check-fails).

Sakop ng mga pagsusuring ito ang Lolly nang mag-isa. Kung nagpapatakbo ang organisasyon mo ng Lolly Work, nagdaragdag ito ng sign-in, shared na nilalaman, naka-configure na telemetry at mga audit record; suriin ang mga iyon ayon sa [Server Surface](/info/server-surface.html) at sa [seksyon ng privacy policy tungkol sa organisasyon](/info/privacy.html#organisation-services-with-lolly-work).

<!--i:eti-clock-->
## Makitang gumagana ito, sa sampung segundo

Buksan ang [`/verify`](/#/verify) at mag-drop ng file sa page. Walang upload, walang account at walang paghihintay sa server. Dito, sinusuri nito ang [nabuong bagyo sa Queensland](/info/ai-stance.html) mula sa Aming Pananaw sa AI: isang larawang binuo ng Gemini, na binuksan, minarkahan at kinonvert ng Lolly. Kinalkula ang bawat badge sa device, mula sa mismong mga byte ng file.

![Ang Lolly Verify sa screen na kasinglapad ng phone - ang larawan ng bagyo, isang berdeng hatol na Made with Lolly at ang mga badge na buo ang credential at hindi nagbago ang mga byte na magkakapatong sa ilalim nito](/t/url-shot?url=%2F%23%2Fverify%3Fsrc%3D%2Finfo%2Fthe-flood.webp&width=440&height=1500&dpi=192&waitMs=6000&waitSelector=.valid-steps&walker=1&format=svg&rasterDpi=96&cropSelector=.valid-top&dark=1&filename=cc-verify-mobile)

Ang hatol ay isang maliit na pangkat ng mga badge, na bawat isa ay isang hiwalay na katotohanan:

- <!--i:lock--> **Made with Lolly**: buo ang credential *at* may tala ito ng export mula sa Lolly.
- <!--i:seal--> **The credential is intact**: naipa-parse ang nilagdaang C2PA manifest at nave-verify ang sarili nitong claim signature.
- <!--i:hash--> **The bytes have not changed**: tugma pa rin ang hash ng file sa nilagdaan. Baguhin ang isang pixel at magbabago ang badge na ito.
- <!--i:sparkle--> **GEN AI**: machine ang gumawa ng mga pixel na ito, at sinasabi iyon ng file. Binabasa ng Lolly ang deklarasyong iyon mula sa file sa halip na itago ang katotohanan.

Kasama ng file ang buong history. Siyam na hakbang ang nananatili rito: lima na itinala ng Google habang binubuo at nilalagyan nito ng watermark ang larawan, saka apat na itinala ng Lolly habang binubuksan, minamarkahan at kino-convert nito ang kopya sa page na ito. Direktang binabasa ng Lolly Verify ang mga ito mula sa mga byte at iginuguhit bilang timeline.

![Ang history ng pagbabago na binabasa ng Lolly Verify mula sa larawan ng bagyo - limang hakbang na itinala ng Google, saka apat ng Lolly, na nagtatapos sa WebP sa page na ito](/t/url-shot?url=%2F%23%2Fverify%3Fsrc%3D%2Finfo%2Fthe-flood.webp&width=1440&height=1400&dpi=192&waitMs=6000&walker=1&format=svg&cropSelector=.valid-steps&dark=1&filename=ai-stance-change-history)

Ang mga pagsusuri sa ibaba ang mga garantiya sa likod ng demo na iyon, at maaaring ulitin ang bawat isa. Ipinapaliwanag ng [Content Credentials](/info/content-credentials-identity.html) ang bawat hatol.

<!--i:eti-globe-->
## Sa browser mo, walang kailangang tool

::: timeline
- <!--i:globe--> **1. Bantayan ang network.** Buksan ang [lolly.tools](https://lolly.tools), buksan ang DevTools ng browser mo (F12), lumipat sa **Network** at gumamit ng tool: mag-type ng web address sa [Lolly QR Code](/t/qr-code), magpalit ng kulay, mag-export ng PNG. Bawat request ay pumupunta sa `lolly.tools`: ang app shell, ang sariling mga file ng tool at mga asset ng catalog. Walang analytics host, walang CDN beacon, walang serbisyo ng font at walang endpoint para sa pag-uulat ng error. **Wala sa anumang request** ang tina-type mo sa tool, dahil lokal ang rendering.
- <!--i:eyeoff--> **2. Putulin ang koneksyon.** I-load ang app at magbukas ng isa o dalawang tool, saka mag-offline (airplane mode, o DevTools → Network → Offline) at mag-reload. Patuloy na gumagana ang gallery at bawat tool na binuksan mo, kasama ang rendering at export sa mga format na ginamit mo. Naka-cache ang mga file ng tool at ang encoder ng format sa unang paggamit mo sa mga ito, kaya gumamit muna ng tool nang isang beses online bago ito subukan offline. Ito ang pinakamatibay na iisang pagsusuri sa page na ito: hindi patuloy na gagana ang software na umaasa sa pagkontak sa server kapag pinutol ang koneksyon nito.
- <!--i:check--> **3. Bilangin ang mga cookie.** DevTools → **Application** (Firefox: **Storage**) → Cookies → `https://lolly.tools`. Walang laman ang listahan: walang itinatakdang cookie ang app. I-paste ang `document.cookie` sa console at makukuha mo ang `""`. Nagtatakda ang opsyonal na CA enrolment ng panandaliang `HttpOnly` cookie, `lolly_ca_state`, na sakop lang ang `/api/ca`, na hindi maipapakita ng `document.cookie`. Gumagamit ang Lolly Work instance ng sarili nitong mga cookie sa sign-in; ikumpara ang mga ito sa [Privacy](/info/privacy.html#organisation-services-with-lolly-work).
- <!--i:layers--> **4. Basahin ang sarili mong storage.** Sa parehong panel, nasa harap mo ang lahat ng iniingatan ng Lolly: mga dalawang dosenang simpleng key sa `localStorage` (theme, wika, lapad ng sidebar, mga setting ng tunog at view at naka-cache na kopya ng pampublikong index ng catalog ng tool) at ang sarili mong mga dokumento sa IndexedDB. Nababasa ang bawat value bilang string o JSON, na walang inililihim sa pagkakabuo. Inaalis ng pag-clear ng data ng site ang mga lokal na record na ito, pero hindi ang Sync backup o mga record na naka-store sa Lolly Work instance. Ginagawa rin iyon ng **Settings → Storage → Clear all my data** mula sa loob ng app, at makikita mong nawawalan ng laman ang mga store at cache.
- <!--i:lock--> **5. Tingnan kung umiiral ang contact para sa pag-uulat ng kahinaan.** Sumasagot ang [`/.well-known/security.txt`](/.well-known/security.txt) ng contact block na [RFC 9116](https://www.rfc-editor.org/rfc/rfc9116), hindi HTML page.
:::

::: details Ano pa ang maaari mong makita sa Network tab
Gumagamit lang ng network ang ilang feature kapag ginagamit mo ang mga ito, at nakikita ang bawat isa sa parehong tab:

- ang pagdagdag ng **Google Font** sa Lolly Design System Setup ay kumukuha ng iisang font family na iyon mula sa Google, pagkatapos ng dialog para sa pahintulot na nagsasabi nito, nang isang beses, bago ang unang pagkuha;
- ang pag-click sa **ICC press-profile preset** ay kumukuha ng profile na iyon mula sa pampublikong registry ng ICC sa color.org;
- ang pagpapatugtog ng opsyonal na built-in na **radyo** ay nag-i-stream mula sa istasyon;
- ang paglagay ng lokasyon sa **Meeting Planner** ay naghahanap ng lugar na iyon sa geocoding service ng open-meteo para sa mga coordinate at time zone nito, nang isang beses bawat lungsod (sine-save ang mga sagot sa device mo), at sinasabi iyon ng field kung saan ka nagta-type;
- nilo-load ng **Lolly URL Screenshot** ang address na tinype mo, at nakikita mo itong nangyayari.

Ang tool na nagdedeklara ng kakayahang gumamit ng network ay maaaring kumuha lang mula sa mga host na nasa allowlist ng manifest nito, at hinaharangan ang access kapag nabigo ang pagsusuring iyon. Walang tool na inilalabas ngayon na nagdedeklara nito, kaya nililimitahan ng Content-Security-Policy na ipinapatupad ng browser ang listahan sa itaas sa mga host nito. Nasa [privacy policy](/info/privacy.html) ang opisyal na talahanayan ng lahat ng ito, kasama ang traffic ng pinamamahalaang instance tulad ng pag-refresh ng policy at naka-enable na pag-uulat.
:::

<!--i:eti-code-->
## Mula sa terminal

**6. Pampublikong data lang ang isinasagot ng render endpoint.** Aktibo rito ang iisang feature ng server na naglalagay ng mga tinype na input sa URL, ang mga hot-link render. Sinasabi ng [privacy policy](/info/privacy.html) kung ano ang ibig sabihin nito para sa mga input na inilalagay mo sa isang link.

```bash
curl -s -o /dev/null -w '%{http_code}\n' 'https://lolly.tools/tool/qr-code.svg?url=test'
# 200
```

Bawat deployment ang pumipili (`LOLLY_DISABLE_RENDER_GET=1`): sa instance na nagtatakda ng variable, nagbabalik ng `404` ang parehong probe. Ipinapakita ng pagkakaibang iyon na gumagana ang setting, hindi na may hindi pagkakatugma.

**7. Suriin ang mga serbisyong naka-enable sa deployment mo.** Inililista ng [Server Surface](/info/server-surface.html) ang mga opsyonal na serbisyo at may mga link sa detalyadong sanggunian ng mga ito. Para sa Lolly Work, isama ang mga API nitong may authentication, koneksyon sa collaboration, storage at naka-configure na provider. Hindi sinusubukan ng probe sa pampublikong lolly.tools ang isang pribadong instance ng organisasyon.

Kung nagpapatakbo ka ng sarili mong instance, nasa [Delivery deployment](/info/deploy-delivery.html) ang mga pagsusuri para sa release: integrity ng model, ang edge probe at sample list nito, mga display rendition, ang pribadong download gateway at ang nilagdaang catalog sa browser.


<!--i:eti-search-->
## Sa source

Maaaring palabas lang ang lahat ng nasa itaas kung iba ang naka-deploy na code sa pampublikong code. Kaya suriin ang code. Binu-build ang deployment mula sa [pampublikong repository](https://github.com/lolly-tools/lolly):

```bash
git clone https://github.com/lolly-tools/lolly.git
cd lolly
```

**8. Walang tracker at walang analytics SDK, saanman.** Hanapin ang mga karaniwang pinaghihinalaan sa code na inilalabas (ang engine, bawat shell kasama ang browser extension, ang mga override ng Tauri bridge at ang service worker, ang mga function ng server at ang mga tool pack):

```bash
grep -rnF --include='*.ts' --include='*.js' --include='*.mjs' --include='*.html' \
  -e googletagmanager -e google-analytics -e posthog -e mixpanel -e hotjar \
  -e sentry.io -e segment.com -e '@vercel/analytics' \
  engine/src shells/*/src shells/chrome-extension shells/*/bridge-overrides \
  shells/web/public/sw.js services packages api community brands/*/tools
# (no output)
```

Naghahanap ang scan na ito ng mga third-party tracking SDK. Hindi nito ipinapakitang walang first-party na pag-uulat ng paggamit: sinusuportahan ng Lolly Work ang telemetry ng organisasyon at hiwalay na audit log, na may sarili nilang policy at mga test.

**9. Walang third-party DNS resolver.** Hindi kailanman nagpapadala ng lookup sa isang DNS-over-HTTPS provider ang SEAL check ng Lolly Verify, dahil walang resolver ang app:

```bash
grep -rnF --include='*.ts' --include='*.js' --include='*.mjs' \
  -e cloudflare-dns.com -e dns.google -e /dns-query \
  engine/src shells/*/src shells/chrome-extension shells/*/bridge-overrides \
  shells/web/public/sw.js services packages api community brands/*/tools
# (no output: outside this page and its built copies, the only place those
#  hostnames appear in the repo is tests/no-trackers.test.ts, the test that
#  bans them)
```

**10. Walang iniingatang issuance log ang serbisyo ng certificate.** Walang iniingatang log ng mga inisyu nito at walang imbentaryo ng mga identity ang identity CA: walang stdout line, walang webhook, walang certificate store. Maaaring hanapin sa source kung wala ang mga ito:

```bash
grep -rn logIssuance services/ca api/ca
# (no output)
```

May iniingatang panandaliang working state ang CA: iniimbak ng mga rate-limit bucket ang mga na-hash na IP at email key sa loob ng kanilang takdang panahon, at iniingatan ng admission store ng isang pinamamahalaang deployment ang isang keyed identifier at digest ng request nang hanggang sampung minuto. Nasa [Engineering ng Content Credentials](/info/content-credentials-engineering.html#protocol) ang detalye.

<!--i:eti-flask-->
## Ipinapatupad ng mga test

Hindi minsanang audit ang mga pagsusuri sa source sa itaas: nakapirmi ang mga ito sa test suite, kaya hindi maaaring tahimik na masira. Sinusuri ng [`tests/no-trackers.test.ts`](https://github.com/lolly-tools/lolly/blob/main/tests/no-trackers.test.ts) ang mas mahabang listahan ng mga pangalan ng tracker kaysa sa scan sa itaas at pinapabigo ang build kung:

- may lumabas na anumang analytics o tracking SDK saanman sa inilabas na source na sina-scan nito, sa code ng app, engine, server, extension at tool pack;
- may lumabas na anumang third-party DNS-over-HTTPS resolver sa source na iyon;
- bumalik ang issuance log ng CA, sa source **o** sa nabuong server bundle;
- mawala sa privacy policy ang mga pahayag na hinihingi ng batas (pinangalanang controller, legal na batayan, karapatang magreklamo).

Ikaw mismo ang magpatakbo ng mga ito sa clone (Node 22.18 o mas bago; hindi kailangan ng file na ito ang `pnpm install`):

```bash
node --test tests/no-trackers.test.ts
# ✔ no analytics or tracking SDK appears anywhere in shipped source
# ✔ no third-party DNS-over-HTTPS resolver is contacted
# ✔ the certificate service logs no personal data
# ✔ privacy policy states a controller, a legal basis and a right to complain
```

Nagpapatakbo ang buong suite (`pnpm install && pnpm test`) ng ilang libo pang test, kasama ang mga adversarial cryptography test na inilalarawan sa [Seguridad & Pag-verify](/info/security.html).

<!--i:eti-eye-off-->
## Ano ang hindi mo mave-verify mula sa labas

- **Mga access log ng hosting.** Maaaring mag-log ang anumang server ng mga request na sinasagot nito: IP address, path at oras. Hindi matitiyak ng probe mula sa labas kung gaano katagal iniingatan ang mga log. Kontrolado ng operator ang pag-log, rotation at mga export, at dapat nitong ibunyag ang mga pagpiling iyon. Pinapanatili ng lokal na rendering sa device mo ang mga karaniwang edit; may magkahiwalay na daloy ng data na inilalarawan ng privacy policy ang opsyonal na server rendering at mga serbisyo ng shared workspace.
- **Na ang deployment ay nagpapatakbo ng code na ito.** Maaari mong suriin na malinis ang source at na tugma sa source ang asal ng deployment, at parehong ginagawa iyon ng mga pagsusuri sa itaas. Hindi nag-aalok ang web platform ng attestation sa antas ng binary para sa isang web deployment. Ang pampublikong repository, mga ipinapatupad na test at pagsusuri offline ang mga paraan ng pagbabawas ng panganib: sabay na bumabagsak sa mga pagsusuri 1 at 2 ang binagong deployment na kumokontak sa server.
- **Mga tool hook.** Nirerepaso ang opsyonal na logic ng built-in na tool sa halip na ilagay sa sandbox: tumatakbo ito sa page maliban kung pinili ng tool na gumamit ng Worker. First-party ang bawat tool sa lolly.tools at nirerepaso bago ilabas. Inilalatag ng [Threat Model](/info/threat-model.html#trust-boundaries) kung saan tumatakbo ang mga hook at ano ang naglilimita sa mga ito.

<!--i:eti-warning-->
## Kung mabigo ang pagsusuri

Isang ulat sa seguridad ang pagkakaiba sa pagitan ng page na ito at ng naoobserbahan mo. Ipadala ito sa mga pribadong channel sa [Seguridad & Pag-verify](/info/security.html#reporting-a-vulnerability). Nagsasagawa kami ng magkakaugnay na pagsisiwalat at kinikilala ang mga nag-uulat.
