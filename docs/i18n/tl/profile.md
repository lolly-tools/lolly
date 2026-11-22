# Mga profile

Itakda nang isang beses ang pangalan, mga contact detail at headshot mo, at pupunan ang mga ito ng bawat tool na ginawa para gamitin ang mga ito, tulad ng email signature, badge o speaker card. Ang talang iyon ang **profile** mo, at nasa device mo ito.

Hawak din ng profile mo ang mga naka-save na session, na-upload na larawan at lokal na bilang ng aktibidad mo. Pamahalaan ito sa **Settings → Preferences**. Binabasa lang ng mga tool ang mga field na ginawa silang paunang punan. Hindi kailangan ng account sa standalone na paggamit. May kanya-kanyang daloy ng data ang opsyonal na Sync, pagbabahagi at mga serbisyo ng organisasyon.

<!--i:eti-user-check-->
## Ano ang nasa profile

| Bahagi | Ano ito |
|---|---|
| **Name** | Pangalan at apelyido. |
| **Contact** | Email at telepono. |
| **Location** | Lungsod at bansa. |
| **Headshot** | Opsyonal na larawan, na kina-crop sa parisukat at itinatago bilang lokal na larawan, para sa mga tool tulad ng email signature, quote card at org chart. |
| **Use my details to create** | Isang switch na ikaw ang mag-o-on at nagiging **Using my details** kapag naka-on. Itinatakda nito kung sasama ang mga detalye mo bilang pagkilala sa may-akda sa mga na-export na file at sa mga Lolly Batch run; tingnan ang [Paano ginagamit ng mga tool ang profile mo](#how-tools-use-your-profile). |
| **Preferences** | Ang theme mo, colourway mo sa bawat design system, mga accessibility setting mo at kung aling mga bahagi ng app ang in-on mo sa **Feature flags**. |
| **Your work** | Mga naka-save na session kasama ang mga thumbnail nito, na nakaayos sa [Lolly Projects](/info/find-your-work.html), mga na-upload mong larawan at lokal na estadistika ng aktibidad mo. |

Walang kinakailangan sa mga ito, at gumagana ang blangkong profile.

![Settings sa Preferences tab: ang settings rail, at Your details na may Use my details to create switch at mga field ng pangalan, contact at lokasyon](/t/url-shot?url=%2F%23%2Fsettings%3Ffocus%3Ddetails-section&width=1440&height=900&dpi=192&waitMs=1600&format=svg&walker=1&localize=1&dark=1&filename=profile-details)

Sinasaklaw ng [Lolly Settings](/info/dashboard.html) ang natitirang bahagi ng Preferences, mula sa itsura at emoji hanggang sa storage at mga offline download.

<!--i:eti-users-->
## Ikaw, isang team o isang role

Sa Lolly, ang profile ay kung sino ka habang gumagawa: sarili mo, isang team o isang role. Pare-pareho ang paghawak ng Lolly sa tatlo.

::: cols
## Bilang sarili mo

Ang default: pangalan, email at headshot mo. Mula sa mga ito pinupunan ang signature, badge at conference lockup mo.

## Bilang isang team

Ang pinagsasaluhang pangalan ng team, inbox ng grupo tulad ng `events@…`, departamento at logo ng team. Isang tao ang nagse-set up ng profile at nag-e-export ng file. Nilo-load ng lahat ng iba ang parehong profile, kaya pareho ang mga detalyeng nasa mga file ng team. Puwedeng gumamit ng iisang team profile ang pinagsasaluhang kiosk o demo laptop.

## Bilang isang role

Kailangan ng event manager ang inbox at sub-brand ng event sa mga badge at karatula tatlong araw sa isang taon, saka babalik sa karaniwang pagkakakilanlan niya. Itago ang role bilang naka-save na profile file, i-load ang file para sa event at itabi ito pagkatapos.
:::

![Ang headshot control, walang laman hanggang mag-upload ka ng larawan na mananatili sa device na ito](/t/url-shot?url=%2F%23%2Fsettings%3Ffocus%3Ddetails-section&width=1440&height=900&dpi=192&waitMs=1600&format=svg&cropSelector=.profile-side&walker=1&dark=1&filename=pd-profile-headshot&css=.profile-details-main%7Bdisplay%3Anone%7D)

::: details Mga profile sa organisasyong gumagamit ng Lolly Work
Kapag nag-sign in ka sa [Lolly ng organisasyon](/info/organisation.html), puwedeng magbigay ang Lolly Work ng mga na-verify na profile field mula sa identity provider nito at magtakda ng mga field o preference na hindi mababago ayon sa policy ng organisasyon. May label sa app ang pinamamahalaang field.

Kinokontrol din ng sign-in na iyon ang access sa mga pinagsasaluhang proyekto at asset. Lokal na file ang team profile file. Hindi ito nagbibigay ng pagiging miyembro ng organisasyon o pumapalit sa work account. Kinokontrol ng **Use my details to create** ang pagkilala sa may-akda sa mga export mo, hindi ang sign-in o mga audit record ng organisasyon. Tingnan ang [Privacy](/info/privacy.html#organisation-services-with-lolly-work).
:::

<!--i:eti-copy-->
## Magtago ng ilan, gumamit ng isa

May iisang aktibong profile sa bawat install sa anumang oras, at walang pangpalit nito sa loob ng app. Portable na file ang bawat profile, ang parehong backup file na naglilipat ng gawa mo sa bagong device. Para magpalit ng konteksto:

::: timeline
- <!--i:download--> Sine-save ng **Export my data** sa **Settings → Storage → Move to another device** ang kasalukuyang profile bilang iisang `.zip`.
- <!--i:trash--> Nililinis ng **Clear all my data** ang lahat ng laman ng install na ito.
- <!--i:upload--> Nilo-load ng **Import data…** ang profile file para sa kontekstong lilipatan mo.
:::

::: note Pinagsasama ang data kapag nag-import nang hindi muna naglilinis
Idinaragdag ang mga na-import na session at larawan. Kapag may parehong kopya, pinananatili ang mas bagong na-save. Idinaragdag ang mga folder, paborito at template sa tabi ng sa iyo. Nananatili ang sarili mong mga detalye, maliban sa mga walang lamang field, na kumukuha ng mga value ng file. Bagay ang pagsasama sa pagkuha ng mga session ng team sa setup mo, pero hindi sa ganap na paghihiwalay ng mga role.
:::

Para sa dalawang konteksto nang sabay, gumamit ng hiwalay na browser profile, user account o naka-install na kopya ng web app. May sariling Lolly profile ang bawat isa.

![Ang dalawang button na naglilipat ng buong install: nagsusulat ng iisang zip ang Export my data, binabasa ito pabalik ng Import data](/t/url-shot?url=%2F%23%2Fsettings%3Ffocus%3Dstorage-section&width=1440&height=1800&dpi=192&waitMs=2400&css=.store-move%3Ediv%3Anth-of-type%282%29%2C.store-move%3Ep%3Alast-of-type%7Bdisplay%3Anone%7D&waitSelector=%5Bdata-store-group%3Dmove%5D&drive=click%3A%5Bdata-store-group%3Dmove%5D%3Esummary&walker=1&format=svg&cropSelector=%5Bdata-store-group%3Dmove%5D&dark=1&filename=pd-transfer-controls)

::: note Magtago ng isang file bawat konteksto
Pangalanan ang bawat file ayon sa laman nito, tulad ng `LollyTools-events-2026.zip` at `LollyTools-me.zip`. Ang file ang profile.
:::

Sinasaklaw ng [Ilipat ang gawa mo sa ibang device](/info/find-your-work.html#move-your-work-to-another-device) ang laman ng file, kung ano ang naiiwan at ang ibang paraan ng paglipat, kasama ang Sync.

<!--i:eti-pen-->
## Paano ginagamit ng mga tool ang profile mo

**Paunang pagpuno.** Minamarkahan ng may-akda ng tool ang input na kumukuha mula sa profile mo (`bindToProfile: "firstname"`, `"email"`, `"headshot"` at iba pa). Kapag bumukas ang tool, napupunan ang input na iyon mula sa profile mo. Puwede mong palitan ang value para sa isang session nang hindi binabago ang profile, maliban kung naka-lock ang input ayon sa policy ng organisasyon. Lokal ang paunang pagpuno at nangyayari ito naka-on man o hindi ang **Use my details**.

**Pagkilala sa may-akda.** Kapag nag-export ka, puwedeng sumama ang mga detalye mo bilang pagkilala sa may-akda sa metadata ng file (PNG, PDF, SVG at iba pa). Kinokontrol ng **Use my details to create** ang pagkilalang ito at ang may-akda sa mga Lolly Batch run. Kapag naka-off ang switch, sinasabi pa rin ng export na ginawa ito gamit ang Lolly, pero wala itong personal na may-akda o linya ng contact.

Mga may-akda ng tool: tingnan ang [`bindToProfile`](/info/tool-inputs.html#bindtoprofile) at [`host.profile`](/info/host-api.html#host-profile).

![Ang iisang Use my details to create switch, na may markang opt-in at naka-off hanggang i-on mo](/t/url-shot?url=%2F%23%2Fsettings%3Ffocus%3Duse-details&width=1440&height=900&dpi=192&waitMs=1600&format=svg&cropSelector=.profile-check&walker=1&dark=1&filename=pd-use-my-details)

<!--i:eti-layers-->
## Profile, design system at mga kakayahan

Magkakalapit sa Settings ang tatlong bagay at madaling mapagkamalan ang isa sa iba:

- <!--i:people--> **Profile** - ikaw, ang team mo o ang role mo: pangalan, contact, headshot at naka-save na gawa. Personal, nasa device at naililipat bilang file.
- <!--i:palette--> **Design system** - ang brand: mga kulay, font at setting na ginagamit ng bawat tool sa pag-render. Pinagsasaluhan, hindi personal; tingnan ang [Lolly Design System Setup](/info/brand-studio.html).
- <!--i:sliders--> **Capabilities** - kung ano ang kayang gawin ng app: ang mga feature at tool na available sa iyo.

May tatlo pang kahulugan ang salita sa Lolly. Ang **content profile** ay build setting na pumipili kung aling mga tool at catalog ang kasama sa deployment; binibigyang-kahulugan ito ng [Glosaryo](/info/glossary.html). Pumipili ang `profile` na link parameter ng colour profile para sa export, tulad ng CMYK press condition; tingnan ang [Mga nakareserbang URL parameter](/info/url-parameters.html#print). Ang **na-verify na pagkakakilanlan** ay ang opsyonal na signing certificate na nag-uugnay ng email mo sa mga nilagdaan mong export. Hiwalay ito sa mga detalyeng ito, pero ang **Use my details to create** ang nagtatakda kung ie-embed ang alinman sa dalawa; tingnan ang [Content Credentials](/info/content-credentials-identity.html).

![Ang Verified identity card, sa lapad ng phone: ang picker ng tagal ng certificate at ang hakbang ng pagpaparehistro sa ilalim nito - ang identity profile, hiwalay sa mga personal mong detalye](/t/url-shot?url=%2F%23%2Fsettings%3Ffocus%3Didentity-section&width=430&height=1600&dpi=192&waitMs=2400&css=.welcome-dialog%2C.personalize-nudge%7Bdisplay%3Anone%7D&format=svg&walker=1&cropSelector=%23identity-section&dark=1&filename=pv-identity-enrol)

<!--i:eti-lock-->
## Privacy

Lokal na nakaimbak ang personal mong profile. Puwedeng sumama ang mga detalye mo sa backup o Sync copy, sa nilalamang ibinabahagi o ine-export mo at sa opsyonal na pagpaparehistro sa Content Credentials. Sa Lolly Work instance, hiwalay sa lokal na profile na ito ang sign-in, pinagsasaluhang gawa, telemetry policy at mga audit record. Nililinis ng **Settings → Preferences → Clear all my data** ang device na ito; hindi nito binubura ang mga kopyang hawak ng storage provider o organisasyon mo. Tingnan ang [Patakaran sa Privacy](/info/privacy.html).
