# Gamitin ang Lolly sa organisasyon mo

Puwedeng magpatakbo ang organisasyon mo ng sarili nitong Lolly: ang parehong app, kasama ang mga tool at design system na pinili nito. Alamin kung paano ito puntahan, mag-sign in at kung ano ang nagbabago.

Para sa pagpaplano ng setup ng organisasyon, ipinapaliwanag ng [Gamitin ang Lolly kasama ng umiiral mong DAM](/info/use-with-dam.html) kung paano mapapanatili ang aprubadong library habang gumagawa ng nilalaman ang mga tao sa Lolly. Inilalarawan ng [Soberanya sa nilalaman](/info/content-sovereignty.html) ang mas malawak na kontrol sa paggawa, pamamahala, pag-iimbak at paglilipat.

::: note Ano ang kailangan mo mula sa organisasyon mo
Ang web address ng Lolly nito, o isang `.lolly` setup file na ginawa ng organisasyon mo. Hindi kumokonekta sa isang organisasyon ang lolly.tools nang mag-isa.
:::

<!--i:eti-globe-->
## Sa browser

Buksan ang address na ibinigay ng organisasyon mo. Kung hinihingi ng page na mag-sign in ka, pindutin ang **Sign in** at sundin ang sign-in page na bubuksan nito. Pagkatapos, gumagana ang Lolly gaya ng dati, kasama ang mga tool at design system ng organisasyon mo.

Puwede ka ring magsimula sa lolly.tools: buksan ang **Settings** view, at sa **Lolly instance** card, pindutin ang **Open a workspace**, ilagay ang address at pindutin ang **Open this instance**. Pupunta ang browser sa sariling address ng organisasyon mo, dahil hindi kayang i-load ng browser ang mga tool ng ibang Lolly mula sa lolly.tools.

![Ang Lolly instance card sa Settings, kung saan binubuksan mo ang workspace ng organisasyon mo o binabago kung saan kinukuha ng app ang mga tool nito](/t/url-shot?url=%2F%23%2Fsettings%3Ffocus%3Dinstance-section&width=1440&height=1400&dpi=192&waitMs=2000&format=svg&cropSelector=%23instance-section&walker=1&dark=1&filename=org-instance-card)

<!--i:eti-monitor-->
## Sa desktop o mobile app

Nagsisimula ang app gamit ang mga tool na kasama nito. Para kumonekta, buksan ang **Settings** view at pindutin ang **Change** sa **Lolly instance** card. Itatanong ng sheet ang **Where should Lolly get its tools?**

1. Piliin ang **Connect to a Lolly instance**.
2. Ilagay ang web address ng organisasyon mo at pindutin ang **Check & connect**.
3. Pindutin ang **Use this instance**. Inililipat ng susunod na screen, **Import your data (optional)**, ang na-save na gawa mula sa Lolly backup. Pindutin ang **Skip** kung wala ka nito.
4. Mag-sign in kung hihingin ng app.

Tumatakbo ang mga tool mula sa nakakonektang instance nang may kaparehong tiwala sa sariling mga tool ng app, kaya kumonekta lang sa instance na pinagkakatiwalaan mo. Puwede ka ring padalhan ng organisasyon mo ng `.lolly` setup file na magkokonekta sa app para sa iyo.

Para lumipat sa ibang pagkakataon, gamitin muli ang **Change**, o ang **Leave** sa parehong card.

### Pag-sign in gamit ang code

Sa desktop at mobile app, nag-aalok din ang sign-in screen ng maikling code kapag sinusuportahan ng Lolly ng organisasyon mo ang pag-sign in gamit ang code. Pindutin ang **Open sign-in in browser**, mag-sign in at aprubahan ang code doon. O buksan ang address na ipinapakita ng screen sa phone o computer kung saan naka-sign in ka na, at ilagay ang code. Tumatagal ang code nang mga sampung minuto.

<!--i:eti-sliders-->
## Ano ang naiiba roon

- **May mga kontrol na nakatakda na para sa iyo.** Ipinapakita ng kontrol na pinamamahalaan ng organisasyon mo ang **Managed by** at ang pangalan ng organisasyon, o **Managed by your organisation**. Hindi mababago ang nakapirming kontrol, at maaaring ilan lang sa mga pagpipilian ng menu ang iniaalok nito. Nakatago ang ilang kontrol. Itinatala ng console ng organisasyon mo kung aling patakaran ang nagtakda sa kontrol at kung bakit. Magtanong sa nagpapatakbo ng Lolly ng organisasyon mo.
- **Naka-lock ang ilang design system.** May lock ang design system na ibinigay ng organisasyon mo at nananatili itong read-only. Para subukan ang mga pagbabago, gumawa ng mae-edit na kopya sa **Settings → Preferences → Design systems**.
- **Mga tool lang nito ang nakalista.** Hindi ipinapakita ang tool na hindi iniaalok ng organisasyon mo.
- **Mga shared project.** Kung nagbabahagi sa iyo ng mga project ang organisasyon mo, may **Team projects** tile sa **Projects**. Nasa server ng organisasyon ang mga session na ito. Buksan ang isa para gawin ito, o magsimula ng [work collab](/info/collaborate.html#collabs-through-lolly-work-optional) mula sa **Share** kapag available.
- **Maaaring kailangan ng approval ang ilang export.** Kapag humihingi ng approval ang organisasyon mo, pumapalit ang **Request approval** sa **Download**, at maaaring mas kaunti ang mga format na iniaalok ng tool.
- **Maaaring mga template ang unang lumabas sa home mo.** Kung naglalathala ng mga template para sa iyo ang organisasyon mo, gaya ng maaaring gawin nito para sa partner na kumpanya, iyon ang bubungad sa home mo sa halip na ang pagbati sa unang pagbisita. Isang card ang bawat template, na may **Your copy** para magpatuloy at **New version** kapag nagbago ang template. Tingnan ang [Mga template para sa partner](/info/work-partner-templates.html).

### Ano ang nananatili kung saan

::: cols
## Sa device na ito

- Mga sarili mong na-save, maliban kung i-on mo ang [Sync](/info/sync.html)
- Mga design system na ikaw mismo ang gumawa
- Anumang ginagawa at dina-download mo

## Sa server ng organisasyon mo

- Ang sign-in identity mo at impormasyon ng device
- Mga team project, shared session at live na edit sa work collab
- Mga asset na ina-upload mo sa shared library
- Mga request para sa approval at aprubadong delivery
- Isang log ng mga pag-sign in mo at ng ginagawa mo roon
:::

Kapag may nakakonektang workspace, ganoon din ang sinasabi ng linya tungkol sa privacy sa unang screen ng app. Walang ipinapadalang usage event sa workspace ang sariling mga app ng Lolly. Inililista ng [Privacy](/info/privacy.html#organisation-services-with-lolly-work) kung ano ang iniimbak ng server at kung sino ang may kontrol sa data na iyon.

<!--i:eti-building-->
## Ano ang idinaragdag ng Lolly Work

Pinapatakbo ng server ng organisasyon mo ang **Lolly Work**, ang software para sa organisasyon mula sa parehong open-source project. Hindi kailangan ng app ng work account o Lolly Work kapag ginagamit mo ito nang sarili mo.

::: details Ano ang puwedeng idagdag ng Lolly Work
Hino-host ng organisasyon mo ang [Lolly Work](https://github.com/lolly-tools/lolly-work) kasama ng Lolly at pinipili kung aling mga feature ang io-on:

- **Pag-sign in at access.** Single sign-on ng organisasyon, mga pahintulot batay sa grupo at mga pinamamahalaang profile field. Puwedeng gumawa at mag-deactivate ng mga account ang mga administrator sa pamamagitan ng SCIM.
- **Pinagsasaluhang gawa.** Mga team project, shared session at [work collab](/info/collaborate.html#collabs-through-lolly-work-optional), na may live na pag-edit sa pamamagitan ng server ng organisasyon.
- **Isang shared asset library.** Mga na-upload na asset, collection at nakakonektang library, na may mga patakaran sa access, bersyon at review.
- **Review at delivery.** Mga hakbang sa approval, pinamamahalaang link na may pag-expire o pagbawi at delivery sa mga destinasyong pinapayagan ng organisasyon.
- **Administrasyon.** Isang audit record ng mga aksyong saklaw ng pamamahala at pag-uulat ng paggamit sa ilalim ng telemetry policy ng instance para sa mga client na nagpapadala ng mga usage event. Walang ipinapadala ang sariling mga app ng Lolly sa kasalukuyan.
:::

Para i-set up ang serbisyo, magsimula sa [Pag-deploy](/info/deployment.html#organisation-services-with-lolly-work). Sandbox ang pampublikong demo sa [lolly.work](https://lolly.work). Gamitin ang sariling address ng organisasyon mo para sa gawa na kailangan mong itago.

<!--i:eti-palette-->
## Brand ng ibang organisasyon

Puwede kang padalhan ng partner, kliyente o sponsor ng kanilang brand bilang design-system file (`.lolly`) sa halip na address. Hindi ikinokonekta ng pagbubukas ng file na iyon ang app sa anuman. Idinaragdag ng file ang design system nila sa tabi ng sarili mong design system sa device na ito. Ikinokonekta ng setup file mula sa sarili mong organisasyon ang app sa Lolly ng organisasyon. Bago may magbago, ipinapakita ng preview kung ano ang gagawin ng pagbubukas ng file. Sinasaklaw ng [Pakikipagtulungan sa mga partner](/info/partners.html) ang magkabilang panig ng paggawa gamit ang brand ng ibang organisasyon.

<!--i:eti-unlink-->
## Pag-alis

Inaalis ng **Leave**, sa **Lolly instance** card sa **Settings**, ang design system, mga tool at catalog ng organisasyon mo. Nananatili ang sarili mong gawa. Hindi muling mabubuksan ang anumang ginawa mo gamit ang mga tool nito hangga't hindi ka kumokonekta muli. Kung iniaalok ito ng Lolly ng organisasyon mo, tinatapos ng **Sign out everywhere** sa parehong card ang mga session mo sa bawat device, kasama ang device na ito.

Nananatili sa organisasyon ang anumang na-save mo roon, sa ilalim ng mga patakaran nito sa access at pagpapanatili. Hindi binubura ng pag-alis o paglilinis ng device na ito ang kopyang iyon sa server. Sa browser na nasa sariling address ng organisasyon mo, walang kailangang alisan: magbukas na lang ng ibang address.

<!--i:eti-help-->
## Kanino magtatanong

Organisasyon mo ang nagpapasya kung ano ang nakakarating sa server nito, kung sino ang makakakita sa mga shared project nito at kung aling mga setting ang nakapirmi. Magtanong sa nagpapatakbo ng Lolly ng organisasyon mo. Sinasaklaw ng [Privacy](/info/privacy.html) kung ano ang ginagawa ng Lolly mismo sa data mo.
