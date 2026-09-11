# Patakaran sa Privacy

*Huling na-update: 11 Agosto 2026*

> **Ang maikling bersyon.** Ang mga dokumento, larawan, video, at file na ginagawa mo sa Lolly ay
> nananatili sa device mo. Walang account para sa ordinaryong paggamit, walang cookie mula sa
> app mismo, at walang analytics o tracker kahit saan sa codebase - hindi ito kaso ng "hindi namin
> ginagamit ang datos," kundi talagang wala ito sa source. May maikli, kumpletong listahan ng
> mga eksepsiyon kung saan nakikipag-ugnayan ang software sa network, at bawat isa
> sa mga ito ay inilalarawan nang detalyado sa ibaba: ano ang umaalis, kanino, at kailan. Ang
> tanging eksepsiyon na may kinalaman sa anumang personal ay isang sign-in na kailangan mong
> sadyang simulan. Kung wala ito sa dokumentong ito, hindi ito nangyayari.

## Ano ang sinasaklaw ng patakarang ito

Ang Lolly ay open-source software - isang engine, ilang app shell (web, desktop,
mobile, CLI) at isang browser extension - na kayang patakbuhin ng sinuman. May
dalawang bahagi ang patakarang ito:

- <!--i:code--> **Ang software mismo**: kung ano ang ginagawa at hindi ginagawa nito sa iyong data,
  saan man ito tumakbo. Ito ay katangian ng code, kaya totoo ito para sa bawat
  Lolly deployment, sa amin man o sa iba.
- <!--i:server--> **lolly.tools**, ang reference deployment na pinapatakbo ng SUSE: ang mga
  partikular na desisyon sa pagpapatakbo ng mga opsyonal na server-side na bahagi
  nito (kung ano ang naka-log, gaano katagal, at ng sino).

Kung gumagamit ka ng self-hosted o enterprise Lolly instance, nananatiling
angkop ang paggana ng software sa ibaba, ngunit ang *operator* ng instance na
iyon - hindi ang SUSE - ang may pananagutan sa anumang server-side: ang kanilang
render endpoint, ang kanilang MCP server, ang kanilang Content Credentials
certificate authority, kung nagpapatakbo sila nito. Hilingin sa kanila ang
kanilang sariling patakaran. Tingnan ang [Adopsyon at Pamamahala](/info/adoption-governance.html)
para sa kung ano ang kasama sa pagpapatakbo ng Lolly.

## Ang app: ano ang nananatili sa iyong device

Ang web, desktop at mobile shell ng Lolly ay nagpapatakbo ng buong render engine
sa client-side. Ang pagbukas ng tool, paglagay ng mga input, pag-preview at
pag-export ay lahat nangyayari sa iyong device - walang kasamang server, at
gumagana ang app offline kapag na-load na.

**Walang inilalagay na cookies ang app.** Para gumana, nagpapanatili ito ng
kaunting data **sa iyong device lamang**, hindi kailanman ipinapadala:

- <!--i:sliders--> **Mga interface preference** - theme, wika, mga setting ng tunog, laki ng
  sidebar/zoom, mga pagpili sa sort at view, kung aling mga onboarding tip na ang
  nakita mo - sa `localStorage`, para available ang mga ito bago pa matapos
  mag-boot ang app.
- <!--i:download--> **Isang offline cache ng tool catalogue at asset preview**, para gumana ang
  gallery kahit walang koneksyon.
- <!--i:hash--> **Mga lokal na usage counter** para sa mga stats ng iyong profile card (ilang
  export, aling mga tool) - isang maliit at bounded na blob sa `localStorage`,
  hindi kailanman binabasa namin, hindi kailanman ipinapadala kahit saan.
- <!--i:folder--> **Ang iyong sariling mga dokumento, na-save na session, na-upload na asset at
  font** - nakaimbak sa IndexedDB sa iyong device, hindi kailanman ina-upload,
  hindi kailanman binabasa ng kahit sino maliban sa iyo.

Wala sa mga ito ang ibinabahagi, ibinebenta, o ginagamit para kilalanin o subaybayan
ka. Walang dapat pahintulutan, dahil walang collection na nagaganap - itong abiso
lang, para malaman mo kung ano ang naka-imbak at saan. Burahin ang lahat ng ito
anumang oras gamit ang **Profile → Clear all my data**, o sa pamamagitan ng
pag-clear ng storage ng site sa iyong browser. (Sa ilalim ng ePrivacy Directive
Art. 5(3), ang storage na mahigpit na kailangan para sa serbisyong hiniling mo ay
hindi nangangailangan ng pahintulot - transparency lamang, na siyang katuturan ng
dokumentong ito at ng abiso sa loob ng app.)

![Ang seksyon ng storage sa profile page sa isang phone-width na screen: nakalista ang bawat kategorya ng on-device data, kasama ang Clear all my data button sa tabi nito](/t/url-shot?url=%2F%23%2Fprofile%3Ffocus%3Dstorage-section&width=430&height=1600&dpi=192&waitMs=2400&css=.welcome-dialog%2C.personalize-nudge%2C.store-manages%2C.storage-subsection%2C.store-selbar%2C.store-chip-val%2C%23store-hero-num%2C%23store-headroom%2C%23store-quota%2C%23store-reclaim%7Bdisplay%3Anone%7D&format=svg&walker=1&cropSelector=%23storage-section&dark=1&filename=pv-storage-clear)

Ang sarili mong backup ng data na ito - ang `lolly-backup` bundle na ginawa ng
**Export my data & render everything** - ay isang file na hawak at kontrolado mo.
Hindi ito kailanman nakakadikit sa aming mga server maliban kung pipiliin mong
ipadala ito sa iba sa iyong sarili. Tingnan ang [Paglipat ng Data](/info/data-transfer.html).

## Mga on-device na utility

May mga tool - **Strip Hidden Data**, **Compress PDF** at iba pa na may badge na
**"Runs on your device"** - na gumagana sa file na ibinibigay mo. Binabasa ang
file papunta sa memory sa iyong browser, tino-transform nang lokal, at ibinabalik
bilang download. Hindi ito kailanman ina-upload, dahil walang server sa daan na
pagpapadalhan nito. Gumagana offline ang mga utility na ito, at ang output nila ay
walang dalang watermark o metadata mula sa amin - ang layunin ng karamihan sa mga
ito ay alisin at protektahan ang data, hindi magdagdag ng panganib.

![Ang badge na dala ng mga tool na ito: Runs on your device - walang ina-upload](/t/url-shot?url=%2F%23%2Ftool%2Fstrip-data&width=1440&height=900&dpi=192&waitMs=2400&walker=1&format=svg&cropSelector=.on-device-badge&dark=1&filename=pv-ondevice-badge)

## Kailan nakikipag-ugnayan ang app sa network, nang buo

Ang talahanayan sa ibaba ang kumpletong listahan ng lahat ng kinukuha o
ipinapadala ng app sa network. Kung wala ito rito, hindi ito ginagawa ng app.

| Ano | Ano talaga ang lumalabas mula sa iyong device | Kailan (ang aksyon na nagta-trigger nito) | Kung babawalan ito ng operator |
|---|---|---|---|
| Pag-sync ng tool catalogue | Walang personal - isang request para sa sariling pampublikong tool at asset index ng Lolly, papunta sa sariling origin ng app | Sa pag-startup, pagkatapos ay naka-cache offline | Tumatakbo ang app gamit ang naka-cache nitong tool set. Tumitigil lang itong tumuklas ng mga bagong tool |
| Isang tool na nangangailangan ng live data | Anuman ang hinihiling ng partikular na tool na iyon, papunta sa host na pinangalanan sa sarili nitong deskripsyon. Sa ngayon, iyon lang ang city lookup sa Meeting Planner tool, na tumatawag sa `geocoding-api.open-meteo.com` upang gawing coordinates at time zone ang pangalan ng lungsod - walang account, walang key at walang identifier maliban sa mismong request. Nakasaad ito sa input mismo kung saan ka nagta-type, at bawat sagot ay naka-save sa iyong device kaya minsan lang tinitingnan ang isang lungsod | Habang ginagamit lang ang tool na iyon, at kapag naglagay ka lang ng lokasyon | Nabibigo ang isang lookup na iyon. Maaari ka pa ring mag-type ng coordinates nang manwal, at walang ibang naaapektuhan |
| Google Fonts | Ang napiling pangalan ng font family at ang iyong IP address, papunta sa mga font server ng Google (`fonts.googleapis.com` para sa stylesheet, `fonts.gstatic.com` para sa font file) | Kapag lang nagdagdag ka ng Google Font sa brand editor, **at kapag lang sumang-ayon ka rito sa isang dialog na sinasabi mismo ito** - isang beses lang na fetch bawat family, pagkatapos ay nananatili ito sa iyong device at ginagamit offline | Nabibigo ang Google Fonts picker sa closed na paraan. Mag-upload na lamang ng font file |
| Send to Google Drive | Ang isang file na pinili mong ipadala, papunta sa Drive API ng Google (`www.googleapis.com`), pagkatapos ng Google sign-in na kinukumpleto mo sa sarili ng Google na popup window. Limitado ang access ng Lolly sa mga file na nilikha nito (ang `drive.file` scope - hindi nito kayang basahin ang natitira sa iyong Drive), at ang sign-in token ay naka-hold sa memory para sa session lamang, hindi kailanman naka-store | Kapag lang pinindot mo ang "Send to Google Drive" sa isang EMF export, at kapag lang naka-configure ang operator ng Google client id sa build - kung wala nito, hindi umiiral ang button | Hindi kailanman lumalabas ang button. I-download ang file at i-upload mo mismo ito sa Drive |
| Send to Dropbox | Ang isang file na pinili mong ipadala, papunta sa API ng Dropbox (`api.dropboxapi.com` para sa sign-in at metadata, `content.dropboxapi.com` para sa file mismo), pagkatapos ng Dropbox sign-in na kinukumpleto mo sa sarili ng Dropbox na window. App-folder lamang ang access ng Lolly (makikita lang nito ang `Apps/` at ang sarili nitong folder doon - hindi kailanman ang natitira sa iyong Dropbox), ang link na "Open" na ipinapakita nito sa iyo ay isang panandaliang pribadong link (walang nililikhang pampublikong share), at ang refresh token ay naka-store lamang kung tinitikan mo ang "stay connected" | Kapag lang pinindot mo ang "Send to Dropbox" sa isang file, at kapag lang naka-configure ang operator ng Dropbox client id sa build - kung wala nito, hindi umiiral ang button | Hindi kailanman lumalabas ang button. I-download ang file at i-upload mo mismo ito sa Dropbox |
| Send to OneDrive | Ang isang file na pinili mong ipadala, papunta sa identity at Graph services ng Microsoft (`login.microsoftonline.com` para sa sign-in, `graph.microsoft.com` para sa upload; ang malaking file ay ina-upload nang paputol-putol papunta sa isang upload address na pag-aari ng Microsoft sa `api.onedrive.com`, `*.up.1drv.com` o `*.sharepoint.com`), pagkatapos ng Microsoft sign-in na kinukumpleto mo sa sarili ng Microsoft na window. Limitado ang access ng Lolly sa sarili nitong folder sa ilalim ng `Apps/` (hindi nito kayang basahin ang natitira sa iyong OneDrive) kasama ang iyong display name para sa account label, at ang refresh token ay naka-store lamang kung tinitikan mo ang "stay connected" | Kapag lang pinindot mo ang "Send to OneDrive" sa isang file, at kapag lang naka-configure ang operator ng Microsoft client id sa build - kung wala nito, hindi umiiral ang button | Hindi kailanman lumalabas ang button. I-download ang file at i-upload mo mismo ito sa OneDrive |
| Send to LinkedIn | Ang isang file na pinili mong ipadala, kasama ang pangalan nito bilang text ng post, papunta sa LinkedIn (`www.linkedin.com` para sa sign-in, `api.linkedin.com` para sa upload at post), pagkatapos ng LinkedIn sign-in na kinukumpleto mo sa sarili mong browser. Ang post ay napupunta sa sarili mong feed bilang pampublikong post sa ilalim ng iyong pangalan. Kayang mag-post ng Lolly bilang ikaw at basahin ang iyong pangalan para sa account label, wala nang iba pa sa iyong LinkedIn, at ang sign-in ay nananatili sa device na ito lamang kung tinitikan mo ang "stay connected" - ang mga token ng LinkedIn ay tumatagal ng 60 araw at hindi maaaring i-renew nang tahimik, kaya mag-e-expire ito nang mag-isa | Kapag lang pinindot mo ang "Send to LinkedIn" sa isang file, sa desktop apps lamang, at kapag lang naka-configure ang isang LinkedIn app sa build - kung wala nito, hindi umiiral ang button | Walang babawalan sa web app: umiiral ito **sa desktop apps lamang**, kaya sinadyang HINDI isinama ang dalawang host na iyon sa Content-Security-Policy ng web app sa ibaba. Sa desktop apps, alisin ang naka-configure na LinkedIn app at hindi na kailanman lumalabas ang button |
| Mga ICC press profile | Walang personal - isang request para sa isang standard na printing-condition profile, papunta sa pampublikong registry ng ICC (`registry.color.org`, `www.color.org`) | Kapag lang nag-click ka ng ICC preset sa print-profile manager - isang beses lang na fetch bawat profile, pagkatapos ay nananatili ito sa iyong device | Nabibigo ang mga ICC preset. Maglagay na lamang ng sarili mong `.icc` profile |
| Radyo sa internet | Walang personal - isang playlist request at isang audio stream, papunta sa istasyon (`api.somafm.com` at ang icecast server na pinangalanan nito, `*.somafm.com`) | Habang lang pinapatugtog mo ang opsyonal na built-in radio sa sound player | Nabibigo ang radyo. Gumagana pa rin ang lahat ng ibang sound feature |
| Isang URL na hinihiling mong kunin ng tool | Isang request papunta sa eksaktong web address na ini-type mo, mula sa URL screenshot tool. Anuman ang address na iyon. Hindi kasama ang host na ito sa patakaran sa ibaba, dahil ikaw mismo ang pumipili nito sa sandali ng paggamit | Kapag lang naglagay ka ng URL sa tool na iyon at sinimulan ang capture | Hindi maaaring i-allowlist ito ng operator ayon sa host. Upang alisin ito, alisin ang tool |
| Pagsuri ng SEAL signature | **Wala.** Walang DNS resolver ang web app - tingnan sa ibaba | Hindi kailanman | Walang babawalan |
| Mga modelo ng AI na on-device | Walang personal - isang beses lang na model-file download mula sa model host ng Lolly (`lolli.li`), pagkatapos ay naka-cache sa iyong device; walang account, walang identifier, request at IP mo lamang | Kapag lang gumagamit ka ng feature na nangangailangan ng model (Verify deep scan, image upscale, speech, at katulad nito) | Naghihintay ang feature na iyon sa download; gumagana pa rin ang lahat ng iba |
| Remote instance | Anuman ang ibinabalik ng instance na pinangalanan mo, sa parehong catalogue sync na inilarawan sa itaas - kasama ang isang version tag sa mga request papunta rito (uri ng shell at bersyon ng engine, ang parehong impormasyong dala ng isang user agent), para makita ng operator nito kung aling mga bersyon ng Lolly ang nasa paggamit. Sa isang managed instance, habang naka-sign in ka, dala rin ng tag na iyon ang isang per-device install id para makilala ng listahan ng device ng operator ang install na ito. Sumasakay lang ito sa mga request na ginagawa na ng sarili mong paggamit - walang timer at walang phone home - at pag-alis sa instance ay tinatanggal ang id, kaya ang device na muling kumonekta mamaya ay magpapakita ng panibago. Ikaw ang pumipili ng host sa sandali ng paggamit, kaya hindi ito kasama sa patakaran sa ibaba | Kapag lang tahasang itinuro mo ang shell sa ibang Lolly deployment | Nabibigo ang pagpapalit ng instance. Hindi naaapektuhan ang lokal mong instance |

Ang bawat nakapirming host sa talahanayang iyon ay kabilang din sa kumpletong allowlist sa Content-Security-Policy ng app, na ipinapatupad ng browser. Kaya ang listahan ay hindi lamang isang paglalarawan kung ano ang ginagawa ng code ngayon, ito ang hangganan na ipinapataw ng browser sa app: ang isang pagbabago sa hinaharap na susubukang makipag-ugnayan sa ibang host ay babawalan, hindi tahimik na papayagan. Isang hilera ang sinadyang eksepsyon, at sinasabi mismo ito ng sarili nitong cell: umiiral lang ang Send to LinkedIn sa desktop apps, kaya walang pinapangalanan ang patakaran ng web app sa dalawa nitong host - hindi maaabot ng web app ang mga ito kahit subukan pa ng code nito. Dalawa pang hilera ang walang nakapirming host, dahil ikaw mismo ang pumipili ng address sa sandali ng paggamit: isang URL na hinihiling mong kunin ng tool, at isang remote instance na itinuturo mo ng shell. Wala sa dalawa ang kasama sa patakaran, at bawat isa ay nangyayari lamang kapag nag-type ka ng address at kumilos dito. Ang isang deployment na ayaw sa alinman sa mga opsyonal na ito (halimbawa, isang enterprise instance na may sariling mga font) ay inaalis ang mga host na iyon sa sarili nitong patakaran, at ang mga feature ay nabibigo nang closed sa halip na makipag-ugnayan sa labas.

Wala sa mga ito ang nagpapadala ng iyong mga dokumento, proyekto, session, o
na-upload na file kahit saan. Ang mga ito ay umiiral para magdala ng mga bagay
*papunta* sa iyong device (mga tool, font, modelo), hindi para magpadala ng mga
bagay *mula* dito, maliban sa mga eksepsiyon na tahasang binanggit sa mga
seksyon sa ibaba.

**Isang tala tungkol sa inalis namin.** Kayang suriin ng Verify ang mga SEAL
signature, isang scheme kung saan ang signing key ng isang file ay na-publish sa
DNS. Hindi kayang gumawa ng DNS query ang mga browser, kaya ang anumang web
implementation ay kailangang i-route ang lookup sa pamamagitan ng isang
third-party na DNS-over-HTTPS resolver - na magpapakita sa operator na iyon ng
domain na sinusuri kasama ng iyong IP address. Ginamit namin dati ang sa
Cloudflare. **Hindi na namin ito ginagamit, at walang kapalit**: hindi na
nagpapasa ng resolver ang web app ngayon, kaya walang network request na
inilalabas ng pag-verify ng SEAL dito. Ang mga file na ang SEAL record ay may
dalang key nang inline ay nagve-verify pa rin nang buong offline. Ang mga file
na ang key ay nasa DNS ay mag-uulat ng "no key resolver" sa halip, at puwede
mong suriin ang mga ito sa desktop o command-line app, na nagre-resolve ng DNS
nang katutubo sa pamamagitan ng sarili mong makina nang walang kasamang
third party.

![Ang Verify screen: isang drop target at wala nang iba pa - sinusuri ang file kung nasaan na ito, nang walang upload at walang account](/t/url-shot?url=%2F%23%2Fverify&width=1440&height=900&dpi=192&waitMs=1400&walker=1&format=svg&cropSelector=.valid-layout&dark=1&filename=cc-verify-drop) Puwede mo itong kumpirmahin sa iyong sarili: ang mga greppable check para dito
at sa bawat iba pang claim sa pahinang ito, kasama ang eksaktong mga command at
inaasahang output, ay nasa
[Patunayan Ito Mismo](/info/verify-yourself.html).

## Hot-linked na render URL

> **Live sa lolly.tools.** Bawat
> `https://lolly.tools/tool/<tool-id>.<ext>?<inputs>` URL ay talagang
> nagre-render, at kasama ang mga input sa URL na iyon. Ipinapaliwanag ng
> seksyon sa ibaba kung ano ang ibig sabihin nito para sa iyo, at puwedeng
> i-off ng isang operator ang feature na ito sa sarili nilang instance.

Ang app mismo ay nananatiling buong-buo sa iyong device. Hiwalay dito, puwedeng
paganahin ng isang operator ang **hot-link render URL** - `/tool/<tool-id>.<ext>?<inputs>`
- para makita ang isang ibinahaging Lolly link bilang live na larawan sa isang
README, wiki, o dashboard. Ang pag-fetch ng isa ay humihiling sa server na
i-render ang **pampublikong data ng tool at catalogue** gamit ang mga input na
nakasulat sa URL.

- <!--i:usercheck--> **Walang account, walang cookie, walang state.** Anonymous ang endpoint, at wala
  sa device mo ang nababasa. Ang mga dokumento, session, at upload mo ay hindi kailanman umaalis sa
  browser mo - hindi sila kailanman lalabas sa mga link na ito.
- <!--i:document--> **Pero ang URL mismo ay naitatala.** Ang query string ng isang URL ay bahagi ng request
  line, kaya lumalabas ito sa ordinaryong access log ng hosting platform sa parehong paraan gaya ng
  bawat hiniling na path. Kung ang mga input ng isang link ay naglalaman ng pangalan o email ng isang tao -
  isang name badge, isang email signature - **nananatili ang tekstong iyon sa mga log na iyon**, at wala
  kahit anong salita ng patakaran ang makakapagbago nito. Kaya mali ang hot-link URL na
  paglagyan ng personal na detalye: ilagay lang dito ang ilalagay mo sa isang pampublikong pahina.
- <!--i:globe--> **Pampubliko na ang mga input sa likas nitong pagkakabuo** kahit papaano - anuman ang
  itinype ng may-akda ng link sa URL, mababasa ng sinumang mararating ng link. Huwag maglagay ng
  mga sekreto sa isang shared link. Nag-aalok ang Lolly ng link encryption para sa sensitibong content.
- <!--i:eyeoff--> Ang mga tugon ay **naka-cache at may rate-limit** gaya ng anumang pampublikong larawan, at minarkahang
  `noindex` para hindi i-index ng mga search engine ang mga render mo.

Nag-self-host ng Lolly at ayaw ng pampublikong render surface? I-set ang
`LOLLY_DISABLE_RENDER_GET=1`, at ang
bawat isa sa mga URL na ito ay magbabalik ng 404.

## Ang MCP server (opsyonal, para sa mga AI agent)

Maaari ring marating ang Lolly ng isang AI agent sa pamamagitan ng Model Context
Protocol - isang endpoint na pinapatakbo ng operator (may pinapatakbo ang
lolly.tools; puwedeng mag-self-host ng sarili nila ang kahit sino, kabilang ang
buong air-gapped). Ibinabahagi nito ang no-accounts na postura ng render path,
kasama ng tatlong tool na kinakailangang humawak ng file bytes:

- <!--i:cpu--> Ang **`lolly_transform`** (nagpapatakbo ng on-device na utility sa server-side,
  sa ngalan ng agent na tumatawag), **`lolly_verify`** (sinusuri ang Content
  Credentials), at **`lolly_redact`** (nagtatakip ng mga rehiyon ng isang larawan
  o PDF) - lahat ng ito ay tumatanggap ng bytes ng file mula sa tumatawag. Ang mga
  ito ay pino-proseso **in-process, sa memory**, at ang resulta ay ibinabalik sa
  parehong tawag na iyon - hindi kailanman isinusulat ang file sa disk at hindi
  kailanman naka-store kapag natapos na ang request.
- <!--i:checklist--> Ang bawat iba pang tool - `lolly_render`, `lolly_build_url`, `lolly_list_tools`,
  `lolly_describe_tool` - ay gumagana mula sa mga parameter lamang (teksto, numero,
  kulay, URL, catalogue asset id), ang parehong mga input na kinukuha ng isang
  hot-link render URL.
- <!--i:lock--> Ang access ay alinman sa isang shared token na inilalabas ng operator sa mga
  client na pinagkakatiwalaan nila, o stateless OAuth 2.1: mga short-lived na
  naka-sign na token na na-verify laban sa isang shared secret, walang naka-store
  sa server-side at ang token mismo ay hindi kailanman isinusulat sa isang log o
  isang render URL.

## Content Credentials identity (isang sign-in na kailangan mong simulan mismo)

Kaya ng Lolly na maglagay ng cryptographic **Content Credential** sa mga export mo para may makapag-verify, offline, na hindi na-alter ang isang file mula nang umalis ito sa Lolly. Ganoon na iyon **naka-on by default at fully local** - ang signing key ay ginagawa sa device mo at ang pag-sign mismo ay nangyayari offline. Kung walang enrolment, ang key na iyon ay throwaway lang: isang bagong keypair na ginagawa para sa bawat export at isinasama dito. Kapag nag-enrol ka, ang key ay nagiging lasting at ginagawang **non-extractable** - kahit ang code mismo ng Lolly ay hindi ito mababasa, puwede lang itong hilingan na mag-sign. Sa alinmang paraan, hindi ito umaalis sa device mo. Sakop ng seksyong ito ang isang *optional* na hakbang dito: ang pag-enrol ng verified identity, para ang mga export mo ay magsabing "Verified - signed by \<your email\>" sa halip na anonymous key. **Kung nilaktawan mo ang enrolment, wala sa seksyong ito ang aplikable sa iyo, at walang personal data na aalis sa device mo.**

![Ang Verified identity card sa profile page, phone-width: ang certificate lifetime picker at ang enrolment step sa ilalim nito, tulog hanggang simulan mo ito mismo](/t/url-shot?url=%2F%23%2Fprofile%3Ffocus%3Didentity-section&width=430&height=1600&dpi=192&waitMs=2400&css=.welcome-dialog%2C.personalize-nudge%7Bdisplay%3Anone%7D&format=svg&walker=1&cropSelector=%23identity-section&dark=1&filename=pv-identity-enrol)

Kung mag-enrol ka, narito nang eksakto ang mangyayari:

1. **Pipili ka ng paraan ng sign-in** - GitHub, Google, SUSE (id.suse.com), o
   isang emailed na link. Para sa tatlong OIDC provider, ire-redirect ka papunta
   sa sariling login page ng provider na iyon, na pinamamahalaan ng kanilang
   sariling patakaran sa privacy, hindi sa amin. Ang certificate service ng
   Lolly ay tumatanggap lamang pabalik ng isang verified na email address at
   ang pangalan ng provider. Para sa email link, ang address na tina-type mo ay
   ipinapasa sa **Resend**, isang transactional email API, para lang maihatid
   ang link na iyon.
2. **May proteksiyon ang redirect ng isang short-lived na cookie.** Ito ang
   nag-iisang cookie na inilalagay ng buong sistema ng Lolly: `lolly_ca_state`,
   `HttpOnly`, naka-scope sa `/api/ca`, mag-e-expire sa loob ng sampung minuto.
   Nagdadala ito ng random na value, hindi tracking identifier, at umiiral lang
   para pigilan ang pagpeke ng OAuth redirect. Nabubura ito sa sandaling
   matapos ang sign-in.
3. **Ang iyong IP address ay ginagamit, nang panandalian, para pigilan ang
   pang-aabuso** ng mga sign-in endpoint (para hindi makapag-spam ng isang inbox
   o mauubos ang email quota ang iisang script) - naka-hold lang sa server
   memory, para sa sliding window na mga isang minuto, hindi kailanman
   isinusulat sa isang log o pinananatili kahit saan.
4. **Naglalabas ang certificate service ng isang short-lived na certificate**
   (7, 30, 90, o 365 araw, ayon sa iyong pili, na naka-cap ng patakaran ng
   operator) na nagbibigkis sa iyong verified na email sa pampublikong kalahati
   ng keypair na nabuo sa iyong device. Ang pribadong kalahati ay hindi kailanman
   umaalis sa iyong browser.
5. **Walang naitatala tungkol sa pagpapalabas.** Ang certificate service ay
   walang pinapanatiling issuance log: hindi ang iyong email, hindi ang
   provider, hindi ang serial number, hindi ang timestamp. Walang database,
   walang log line, walang webhook. Ang iyong email address ay umiiral sa
   request nang sapat lang na panahon para maisulat ito sa certificate na
   natatanggap ng sarili mong device, at pagkatapos ay nawawala na ito sa amin
   nang lubusan.
6. **Pagkatapos noon, offline na naman ang pag-sign** sa buong lifetime ng
   certificate. Ang pag-export ng file ay hindi kailanman nakikipag-ugnayan sa
   certificate service - ang pag-enrol lang ang nakipag-ugnayan.

**Ang tradeoff, sinabi nang tuwiran.** Nag-log dati ang mas naunang bersyon ng
serbisyong ito ng bawat pagpapalabas, para masubaybayan ang isang certificate na
mali ang pagkalabas o na-compromise. Inalis namin ito, dahil ang log na iyon ang
tanging lugar sa buong Lolly kung saan may personal na data na napunta sa isang
server, at mas gugustuhin naming huwag itong hawakan kaysa hawakan ito nang
maingat. Ang isinusuko namin ay ang server-side na traceability: kung inabuso
ang isang certificate, hindi namin ito masusubaybayan kung sino ang nagkaroon
nito. Short-lived ang mga certificate ayon sa disenyo - 7 hanggang 365 araw, ayon
sa iyong pili, na naka-cap ng operator - at nag-e-expire nang mag-isa, na siyang
mitigation na inaasahan namin sa halip. Ang mga self-hoster na ang sariling mga
obligasyon ay nangangailangan ng audit log ay puwedeng magdagdag ng isa, at
magiging controller ng data na iyon sa paggawa nito.

## Ang browser extension

Ang browser extension na **Lolly URL Screenshot** ay hindi kumukolekta,
nag-iimbak, o nagpapadala ng anumang personal na data. Walang analytics, walang
tracking, walang remote server.

**Ano ang ginagawa nito.** Kapag hiniling mo sa Lolly web app na kunan ng
litrato ang isang URL, binubuksan ng extension ang page na iyon sa isang
pansamantalang background tab, kinukunan ito ng litrato sa iyong browser gamit
ang DevTools Protocol, ibinibigay ang larawan pabalik sa app, at isinasara ang
tab. Nangyayari nang lokal ang lahat, sa sarili mong device at network.

**Data.**

- <!--i:shieldcheck--> **Wala kaming kinokolekta.** Walang server ang extension at hindi ito gumagawa
  ng sariling network request.
- <!--i:photos--> **Ang mga nakunang larawan** ay diretsong napupunta sa Lolly app sa parehong
  browser - hindi kailanman ina-upload ng extension.
- <!--i:link--> **Ang mga URL na kinukuhanan mo ng litrato** ay ginagamit lang para i-load
  ang isang page na iyon para sa isang screenshot na iyon. Hindi ito naka-log o
  ibinabahagi.

**Mga Pahintulot.**

- <!--i:wrench--> **`debugger`** - para kunan ng litrato ang na-render na page sa pamamagitan ng
  DevTools Protocol (ang parehong mekanismo na ginagamit ng Lolly desktop app).
- <!--i:monitor--> **`tabs`** - para buksan at isara ang pansamantalang tab kung saan nilo-load
  ang page.
- <!--i:globe--> **Host access (`<all_urls>`)** - dahil puwedeng nasa kahit anong site ang page
  na pinipili mong kunan ng litrato. Ipinapakita ito ng Chrome sa oras ng
  pag-install bilang isang malawak na babala sa permission. Ang extension ay
  binibisita lamang ang URL na ibinigay mo rito.

Wala sa mga ito ang ginagamit para basahin, subaybayan, o ipadala ang iyong
pag-browse lampas doon sa isang hiniling na capture.

## Mga infrastructure log

Tulad ng anumang website, ang mga server sa likod ng lolly.tools - at sa likod
ng anumang Lolly deployment - ay gumagawa ng standard na web-server access log
tuwing may request na sumasapit sa kanila: IP address, hiniling na path,
timestamp, user agent. Iyon ay baseline na hosting behaviour, hindi isang bagay
na idinagdag ng Lolly sa ibabaw, at hindi ito kailanman naglalaman ng nilalaman
ng iyong mga dokumento, dahil hindi kailanman nakararating ang mga iyon sa
isang server sa simula pa lang. Ang isang sinasadyang eksepsiyon ay isang file
na tahasan mong ibinigay sa isang tawag ng MCP na `lolly_transform`,
`lolly_verify`, o `lolly_redact`, na pino-proseso sa memory at hindi kailanman
isinusulat sa disk o sa isang log, tulad ng inilarawan sa itaas.

**Walang isinusulat ang sariling code ng Lolly sa mga log na iyon.** Ang MCP
server ay walang kahit anong logging statement. Ang certificate service ay
naglalabas ng eksaktong dalawang linya, pareho lang sa pagkabigo at pareho lang
sinasadyang tinanggalan: isang send-failure status code na walang recipient
address, at isang error message na walang stack trace o URL (dahil puwedeng may
dala ang isang stack na enrolment token). Ang lahat ng iba pa sa log ay sa
hosting platform, hindi sa amin.

Para sa lolly.tools, Vercel ang hosting at sinusunod ng access-log retention
ang sariling mga platform default ng Vercel para sa plano namin. Hindi kami
nag-configure ng log drain, walang pangmatagalang log export, at walang
analytics o monitoring product sa ibabaw. Hindi kami nagpapanatili ng sarili
namin na kopya ng mga log na ito, na nangangahulugan din na wala kaming paraan
para hanapin ang mga ito para sa iyo - tingnan ang [Ang iyong mga karapatan](#your-rights).

## Mga legal na basehan, pagpapanatili at mga tatanggap

Halos walang kailangan ng legal na basehan dito, dahil halos walang pinoproseso. Para sa
kompletuhin, narito ang buong listahan:

| Pagproseso | Legal na basehan (GDPR Art. 6) | Pinapanatili nang |
|---|---|---|
| Lahat sa iyong device (mga dokumento, preferences, cache, counters) | **Hindi namin talaga pagproseso** - hindi ito kailanman umaabot sa amin. Ang storage sa iyong device ay mahigpit na kailangan para sa serbisyong hiniling mo (ePrivacy Art. 5(3)), kaya hindi ito nangangailangan ng consent | Hanggang burahin mo ito |
| Ang iyong email address sa panahon ng Content Credentials enrolment | **Art. 6(1)(b)**, pagganap ng serbisyong tahasang hiniling mo | Hindi pinapanatili. Naroroon sa memory lamang habang tumatagal ang request |
| Isang one-way na bucket key na hinango mula sa iyong IP address sa mga sign-in endpoint, para sa rate limiting | **Art. 6(1)(f)**, ang aming lehitimong interes sa pagpigil ng abuso sa isang libreng serbisyo at sa email quota ng third party. Hindi ipinapadala sa limiter ang mismong IP address; ginagamit lamang ang bucket para sa pagpigil ng abuso at awtomatiko itong nag-e-expire | Humigit-kumulang 1 minuto sa abuse-control store; hindi pinananatili pagkatapos |
| Hosting access logs (IP, path, timestamp, user agent) | **Art. 6(1)(f)**, ang aming lehitimong interes sa seguridad ng serbisyo, pagpigil ng abuso, at pag-diagnose ng mga problema | Default ng platform ng Vercel para sa aming plan. Wala kaming idinaragdag na drain o export |

**Mga Tatanggap.** Ang mga kategorya ng tatanggap ay: ang aming hosting provider (Vercel
Inc.); ang aming abuse-control store provider, na tumatanggap lamang ng panandalian at one-way
na hinangong bucket key at hindi kailanman ng mismong IP address; at - kapag ginamit mo lamang
ang opsyon na email sign-in - isang transactional email provider (Resend). Kung mag-sign in ka gamit ang GitHub, Google o SUSE (id.suse.com), direkta kang
nakikipag-ugnayan sa provider na iyon sa ilalim ng sarili nilang privacy policy. Sinasabi nila
sa amin ang isang na-verify na email address at wala nang iba. Hindi namin ibinabahagi ang personal na data sa kahit sino
pa, at hindi kami nagbebenta ng data, nagpapatakbo ng advertising, o nagpo-profile ng mga user.

**Mga paglilipat sa labas ng EEA.** Ang Vercel at Resend ay mga kumpanya ng US. Ang function
compute para sa lolly.tools ay naka-pin sa Frankfurt (`fra1`) region ng Vercel kaya
naganap ang pagproseso sa EU, ngunit dahil sila ay mga provider na naka-base sa US, maaari pa rin nilang
i-access ang data bilang mga processor mula sa US. Umaasa ang mga paglilipat na iyon sa Standard Contractual Clauses ng European
Commission at/o sa EU-US Data Privacy
Framework, gaya ng nakasaad sa data processing agreement ng bawat provider. Dahil napakalimitado
ng personal na data na umaabot sa mga provider na ito - isang email address na ipinapasa
para magpadala ng isang mensahe, ordinaryong access logs, at isang panandaliang hinangong
abuse-control bucket - katumbas na maliit ang exposure.

**Awtomatikong paggawa ng desisyon.** Wala. Walang profiling at walang awtomatikong
desisyon na gumagawa ng legal o katulad na makabuluhang epekto (Art. 22).

## Privacy ng mga bata

Hindi kusang kinokolekta ng Lolly ang personal na impormasyon ng kahit sino, anuman ang edad, sa
ordinaryong paggamit ng app - walang kokolektahin. Ang tanging pagkakataon na
nangongolekta ng personal na impormasyon (isang email address) ay ang Content Credentials
enrolment, na inilarawan sa itaas, na hindi nakatuon o nilaan para sa mga bata.

## Ang iyong mga karapatan

Dahil halos lahat ng nagagalaw ng Lolly ay iniimbak lamang sa iyong sariling device, karamihan sa
tinatawag ng batas sa proteksyon ng data na "ang iyong mga karapatan" - access, pagwawasto, pagbura,
portability - ay mga bagay na kaya mo nang gawin mismo, agad, nang hindi humihingi ng pahintulot
kaninuman: nasa storage ng iyong browser ang iyong data, sa isang anyo na maaari mong siyasatin,
i-export (**Export my data & render everything**, sa itaas) o i-delete (**Profile → Clear all
my data**).

Pormal, sa ilalim ng GDPR Articles 15-22 may karapatan kang **i-access** ang iyong
personal na data, **iwasto** ito, **burahin** ito, **paghigpitan** o **tutulan
ang** pagproseso nito (kabilang ang pagtutol sa anumang ibinabatay namin sa lehitimong
interes), sa **data portability** at - kung nakabatay sa consent ang pagproseso - sa
**pagbawi ng consent na iyon anumang oras**, nang hindi apektado ang legalidad ng
nangyari bago mo ito binawi.

Narito ang tapat na posisyon sa paggamit ng mga ito laban sa amin. Dahil hindi na kami
nagpapanatili ng issuance log, **wala kaming hawak na personal na data tungkol sa iyo na maaari naming
hanapin, iwasto, i-export o i-delete.** Kung susulat ka at magtatanong kung ano ang mayroon kami
tungkol sa iyo, ang tapat na sagot ay wala, at iyon ang aming sasabihin. Ang tanging kategoryang
umiiral ay ang hosting access logs na naka-key sa isang IP address, hawak ng aming hosting provider
sa ilalim ng kanilang mga default sa pagpapanatili. Wala kaming kakayahan para hanapin o piling
burahin ang mga iyon, at ito ang sasabihin namin sa halip na magkunwari. Lahat ng talagang
*sa iyo* ay nasa iyong device, kung saan maaari mo na itong basahin, i-export
at sirain nang hindi humihingi ng pahintulot kaninuman.

**May karapatan kang magreklamo.** Kung sa palagay mo ay hindi namin tama ang pagtrato
sa iyong data, maaari kang maghain ng reklamo sa isang data protection supervisory
authority - sa EU, ang awtoridad sa bansang iyong tinitirhan, lugar ng trabaho
o kung saan mo naniniwalang naganap ang paglabag (Art. 77). Ang aming lead supervisory
authority ay ang *Bayerisches Landesamt für Datenschutzaufsicht* (BayLDA) sa
Ansbach, Germany. Hindi mo kailangang kontakin kami muna, bagaman gusto naming
magkaroon ng pagkakataong ayusin ito.

Hindi kami nagbebenta ng data. Wala man lang kaming maibenta.

## Mga pagbabago sa patakarang ito

Nagbabago ang petsa sa itaas tuwing nagbabago ang dokumentong ito. Ang isang pagbabago na nag-aalter
sa kung ano ang umaalis sa iyong device o kung ano ang pinapanatili ay bibigyan ng sarili nitong linya dito, hindi isang
tahimik na edit - kung gusto mong makita kung ano ang nagbago, magtanong (sa ibaba) o ikumpara laban sa
[pampublikong pinagmulan](https://github.com/lolly-tools/lolly/commits/main/docs/privacy.md).

## Sino ang responsable, at paano kami maabot

Ang **data controller** para sa lolly.tools ay:

> SUSE Software Solutions Germany GmbH
> Frankenstraße 146
> 90461 Nürnberg
> Germany

Nagtalaga ang SUSE ng isang **Data Protection Officer**, na maaabot sa
[privacy@suse.com](mailto:privacy@suse.com). Gamitin ang address na iyon para sa anumang pormal
na kahilingan sa ilalim ng "Ang iyong mga karapatan" sa itaas.

Para sa kahit anong tungkol sa Lolly mismo - kung paano ito gumagana, bakit ganito ang isang bagay o
isang pagwawasto sa dokumentong ito - kontakin si **Andy Fitzsimon**,
[fitzy@suse.com](mailto:fitzy@suse.com).

Para sa isang self-hosted o enterprise na instance ng Lolly, kontakin sa halip ang
sinumang nagpapatakbo nito: ang operator ang controller para sa kanilang sariling deployment. Walang hawak na data
ang SUSE at ang Lolly open source project para sa mga deployment na hindi nila pinapatakbo.
