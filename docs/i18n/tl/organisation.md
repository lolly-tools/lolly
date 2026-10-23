# Gamitin ang Lolly sa iyong organisasyon

Puwedeng magpatakbo ang organisasyon mo ng sarili nitong Lolly: ang parehong app, na may mga tool at design system na pinili nito. Ipinapakita ng pahinang ito kung paano ito maaabot, mag-sign in at ano ang nagbabago pagkatapos.

::: note Ang kailangan mo mula sa iyong organisasyon
Ang web address ng Lolly nito, o isang `.lolly` na setup file na ginawa ng organisasyon mo. Hindi kumokonekta sa isang organisasyon ang lolly.tools mismo.
:::

## Sa isang browser

Buksan ang address na ibinigay ng organisasyon mo. Kung hihilingin ng page na mag-sign in ka, pindutin ang **Sign in** at sundin ang sign-in page na bubukas. Pagkatapos noon, gumagana ito gaya ng anumang Lolly, kasama ang mga tool at design system ng organisasyon mo.

Puwede ka ring magsimula sa lolly.tools: buksan ang **Settings**, at sa **Lolly instance** card pindutin ang **Open a workspace**, ilagay ang address at pindutin ang **Open this instance**. Pupunta ang browser sa sariling address ng organisasyon mo, dahil hindi makakapag-load ang browser ng mga tool ng ibang Lolly mula sa lolly.tools.

![Ang Lolly instance card sa Settings, kung saan mo binubuksan ang workspace ng organisasyon mo o binabago kung saan kumukuha ng mga tool ang app](/t/url-shot?url=%2F%23%2Fsettings%3Ffocus%3Dinstance-section&width=1440&height=1400&dpi=192&waitMs=2000&format=svg&cropSelector=%23instance-section&walker=1&dark=1&filename=org-instance-card)

## Sa desktop o mobile app

Nagsisimula ang app sa mga kasamang tool nito. Para kumonekta, buksan ang **Settings** at pindutin ang **Change** sa **Lolly instance** card. Itinatanong ng sheet ang **Where should Lolly get its tools?**

1. Piliin ang **Kumonekta sa isang Lolly instance**.
2. Ilagay ang web address ng organisasyon mo at pindutin ang **I-check at kumonekta**.
3. Pindutin ang **Gamitin ang instance na ito**. Ang susunod na screen, **I-import ang data mo (opsyonal)**, ay naghahatid ng naka-save na gawa mula sa isang Lolly backup; pindutin ang **Laktawan** kung wala ka nito.
4. Mag-sign in kung tatanungin ka ng app.

Tumatakbo ang mga tool mula sa isang connected instance nang may parehong tiwala gaya ng sariling app, kaya kumonekta lang sa isang pinagkakatiwalaan mo. Puwede ring magpadala sa iyo ang organisasyon mo ng isang `.lolly` na setup file na kumokonekta sa app para sa iyo.

Para lumipat sa kalaunan, gamitin muli ang **Change**, o ang **Leave** sa parehong card.

### Pag-sign in gamit ang code

Sa mga desktop at mobile app, nag-aalok din ang sign-in screen ng maikling code, kapag sinusuportahan ng Lolly ng organisasyon mo ang code sign-in. Pindutin ang **Open sign-in in browser**, mag-sign in at aprubahan ang code doon. O buksan ang address na ipinapakita nito sa phone o computer na naka-sign in ka na, at ilagay ang code. Mga sampung minuto ang tagal ng code.

## Ano ang naiiba doon

- **May mga kontrol na itinakda para sa iyo.** Ang kontrol na pinamamahalaan ng organisasyon mo ay nagpapakita ng **Managed by** at ang pangalan ng organisasyon, o **Managed by your organisation**. Hindi mababago ang nakapirming kontrol, ang menu ay puwedeng mag-alok lang ng ilan sa mga pagpipilian nito, at ang linyang nagsisimula sa **Set by** ay puwedeng magsabi kung aling patakaran ang umiiral at bakit. May mga kontrol na hindi ipinapakita.
- **May mga naka-lock na design system.** Ang design system na ibinibigay ng organisasyon mo ay may lock at nananatiling read-only. Para subukan ang mga pagbabago, gumawa ng mae-edit na kopya sa **Settings → Preferences → Design systems**.
- **Ang mga tool lang nito ang nakalista.** Ang tool na hindi iniaalok ng organisasyon mo ay hindi ipinapakita.
- **Mga shared project.** Kung nagbabahagi ng mga project sa iyo ang organisasyon mo, nagpapakita ang **Projects** ng **Team projects** tile. Nasa server ng organisasyon ang mga session na ito. Magbukas ng isa para gumawa rito, o magsimula ng [work collab](/info/collaborate.html#work-collabs-with-lolly-work-optional) mula sa **Share** kapag available.
- **Ang ilang export ay maaaring mangailangan ng pag-apruba.** Kung humihingi ng pag-apruba ang organisasyon mo, pumapalit ang **Request approval** sa **Download**, at ang tool ay puwedeng mag-alok ng mas kaunting format.

### Ano ang nananatili saan

::: cols
## Sa device na ito

- Ang sarili mong mga save, maliban kung i-on mo ang [Sync](/info/sync.html)
- Mga design system na ikaw mismo ang gumawa
- Anumang gagawin at ido-download mo

## Sa server ng organisasyon mo

- Ang sign-in identity at impormasyon ng device mo
- Mga team project, shared session at live edit sa work collab
- Mga asset na ina-upload mo sa shared library
- Mga approval request at aprubadong delivery
- Mga usage event, kung ino-on ito ng organisasyon mo
:::

Inililista ng [Privacy](/info/privacy.html#organisation-services-with-lolly-work) kung ano ang iniimbak ng server at sino ang may kontrol sa data na iyon.

## Ang idinaragdag ng Lolly Work

Pinapatakbo ng server ng organisasyon mo ang **Lolly Work**, ang organisation software ng parehong open-source na proyekto. Hindi kailangan ng app ng work account o ng Lolly Work kapag mag-isa mo itong ginagamit.

::: details Ang maidaragdag ng Lolly Work
Ino-host ng organisasyon mo ang [Lolly Work](https://github.com/lolly-tools/lolly-work) kasabay ng Lolly at pinipili kung aling mga feature ang bubuksan:

- **Sign-in at access.** Organisation single sign-on, mga permission batay sa group at managed na profile field. Puwedeng mag-provision at mag-deactivate ng account ang mga administrator sa pamamagitan ng SCIM.
- **Shared na gawa.** Mga team project, shared session at [work collab](/info/collaborate.html#work-collabs-with-lolly-work-optional), na may live editing sa pamamagitan ng server ng organisasyon.
- **Shared na asset library.** Mga na-upload na asset, collection at konektadong library, na may access rule, bersyon at review.
- **Review at delivery.** Mga hakbang sa pag-apruba, managed link na may expiry o revocation, at delivery sa mga destinasyong pinapayagan ng organisasyon.
- **Administrasyon.** Usage reporting sa ilalim ng telemetry policy ng instance, kasama ang audit record ng mga governed na aksyon.

Kung ikaw ang nagse-setup ng serbisyo, magsimula sa [Deployment](/info/deployment.html#organisation-services-with-lolly-work). Sandbox ang pampublikong demo sa [lolly.work](https://lolly.work); gamitin ang sariling address ng organisasyon mo para sa gawang kailangan mong itago.
:::

## Pag-alis

Inaalis ng **Leave**, sa **Lolly instance** card sa **Settings**, ang design system, mga tool at catalogue ng organisasyon mo. Nananatili ang sarili mong gawa. Anumang ginawa mo gamit ang mga tool nito ay hindi na muling magbubukas hanggang kumonekta ka ulit.

Anumang sine-save mo sa organisasyon ay nananatili sa organisasyon, sa ilalim ng access at retention policy nito. Ang pag-alis o pag-clear sa device na ito ay hindi nagbubura ng kopya sa server. Sa browser sa sariling address ng organisasyon mo, walang iiwanan: magbukas na lang ng ibang address.

## Sino ang tatanungin

Ang naaabot sa server ng organisasyon mo, kung sino ang makakakita ng mga shared project nito at kung aling mga setting ang naka-fix ay mga desisyon ng organisasyon mo. Tanungin ang sinumang nagpapatakbo ng Lolly ng organisasyon mo. Sinasaklaw ng [Privacy](/info/privacy.html) kung ano ang ginagawa ni Lolly mismo sa data mo.
