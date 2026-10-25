# Ang Paninindigan Namin sa AI

Binuo ang Lolly sa gitna ng pinakamalaking pagbabago sa paggawa ng media mula nang imbento ang printing press, ng mga taong hindi natataranta sa AI at hindi rin hinihingal sa teknolohiya. Narito ang posisyon ng proyekto, kasama ang mekanismo sa likod ng bawat pangako, para makapag-verify ka sa halip na magtiwala lang.

> "Umiinom tayo na parang mauubusan ng tubig ang gripo anumang oras. Hindi ito mangyayari - ang AI ngayon ang pinakamasama na magiging estado nito kailanman. Kung tayo ay makaligtas sa baha, hindi ito sa pamamagitan ng pag-iimbak ng laman ng kalawanging tangke ng tubig sa ibaba ng burol, puno ng latak. Ito ay sa pamamagitan ng pagpapatubig at pagbawi sa ***ating*** lupa para sa masaganang kinabukasan."
>
> - Andy Fitzsimon, Lolly Contributor

![Isang supercell storm na sumasabog sa itaas ng isang outback homestead - ang tangke at mga sheds sa ibaba, gumagawa na ang baha ng mga kanal sa tuyong bukid](/info/the-flood.webp)

%file{Gemini_Generated_Image_vmy7thvmy7thvmy7.png} %entity{Gemini} generated image %sig{signed by %entity{Google LLC}} %entity{Lolly} %act{opened}, %act{watermarked} and %act{exported to WebP} as %file{the-flood.webp} %detail{10.6 MB down to 0.8 MB} %sig{signed by %entity{Lolly}} [I-verify ito ngayon](/#/verify?src=%2Finfo%2Fthe-flood.webp)

Para maging tiyak, dahil ang pahinang ito ay nagsasabing mahalaga ang katumpakan: ang larawan sa itaas ay generated, hindi kinunan ng litrato. Walang camerang itinutok sa homestead na iyon, dahil walang homestead. Naglalarawan ito ng rehiyonal na Queensland, Australia, pinrompt mula sa United Kingdom, nabuo sa datacenter sa United States. Sinusubukan nitong maging tapat sa isang lugar nang hindi nagiging tala ng lugar, at ang pagkakaibang iyon ang buong dahilan kung bakit may Content Credentials ang larawan.

Ganito ang itsura kapag chine-check mo ang file. Siyam na hakbang ang nakaligtas sa file: lima ang itinala ng Google habang ginagawa at winawatermark ang larawan, saka apat ang itinala ng Lolly habang binubuksan, ginagawa, minamarkahan at kino-convert ang bersyon sa page na ito. Walang ginawa ang Lolly, at sinasabi iyon ng entry nito.

![Ang change history na binabasa muli ni Lolly mula sa tapos na file - limang hakbang na naitala ni Google, pagkatapos ay apat ni Lolly, na natapos sa WebP sa pahinang ito](/t/url-shot?url=%2F%23%2Fverify%3Fsrc%3D%2Finfo%2Fthe-flood.webp&width=1440&height=1400&dpi=192&waitMs=6000&walker=1&format=svg&cropSelector=.valid-steps&dark=1&filename=ai-stance-change-history)

Sa larawan ni Andy, ang scarcity posture sa AI ay ang pag-inom ng sirang tubig sa tangke habang rumaragasa ang baha sa kapatagan. Ang generated na nilalaman ay malapit nang maging halos walang hanggan. Kapag may naging walang hanggan, lumilipat ang halaga nito sa anumang nananatiling kakaunti sa paligid nito: tiwala, provenance, pagkakaugnay ng brand at paghuhusga ng tao. Hindi mas malaking timba para sa baha ang Lolly. Ito ang patubig: mga kanal na nagdidirekta ng tubig, at lupang pinagtutubuan ng mga bagay.

## Ang stance, sa limang pangako

- <!--i:layers--> **Tinatanggap ang AI bilang input, hindi bilang pagpapanggap.** Ang mga agent ay first-class na user ng Lolly: pinapatakbo nila ang parehong tool na ginagamit ng mga tao, sa pamamagitan ng [MCP server](/info/mcp.html) at [URL mode](/info/url-mode.html), sa eksaktong parehong mga limitasyon. Ang hindi pinahihintulutan sa sinumang agent ay ang ipasa ang output nito bilang hindi ito. Iginuguhit ng [Input, hindi pagpapanggap](/info/input-not-impersonation.html) ang linyang iyon.
- <!--i:shieldcheck--> **Nagdedeklara ang AI ng sarili.** Kapag AI ang gumawa ng mga pixel, sinasabi ito ng export: machine-readable na assertion sa Content Credentials ng file at nakikitang GEN AI badge kapag may nag-verify ng file. Kapag ang media na idineklara mong gawa ng AI ay inilagay sa design, sinasabi rin ito ng sariling credential ng export: composite origin mark at signed, machine-readable na AI disclosure. Binabasa at inilalabas din ng Lolly ang mga AI declaration ng mga file na ginawa sa ibang lugar, at nagfa-flag kapag malamang na may SynthID watermark, binabasa ang deklarasyon, hindi ang watermark mismo. Ang parehong patakaran ay nagbibigkis sa sariling on-device rewriter ng Lolly: bawat pangungusap na isinusulat nito ay may dalang pampublikong statistical watermark sa pagpili ng salita, isiniwalat dito at sa tool, kaya ang text na isinulat ng model ay nananatiling nagdedeklara ng sarili kahit bilang plain-text na kopya, at kahit sino ay makakapag-check ng text na iyon sa [Verify](/#/verify) ([paano gumagana ang check](/info/what-verify-checks.html#text-reworded-by-lolly)). Pampubliko ang scheme sa disenyo: verification para sa lahat, sikreto para sa wala. Karapat-dapat malaman ng mga manonood kung paano ginawa ang media.
- <!--i:check--> **Naka-on bilang default ang provenance.** Ang mga export ay may dalang [Content Credentials](/info/content-credentials-identity.html) bilang default, hindi bilang nakabaong setting. Sakop ng chain ang mga edit at ingredient, kaya ang kasaysayan ng gawa ay naglalakbay kasama ng gawa. Maaari mong [i-verify ito mismo](/info/verify-yourself.html) sa anumang file na ginagawa ng Lolly.
- <!--i:people--> **Ang mga tao pa rin ang may-akda.** Ang mga salita, ang larawan, ang palette, ang desisyong nangangailangan ng paghuhusga: pinalalawak ng mga tool ang paghuhusgang iyon at hindi kailanman pumapalit sa tao. Ang mga nakakapagod na bahagi ang ina-automate: ang brand-checking, ang pag-export muli sa bawat laki, ang manu-manong lokalisasyon. Ang natitira ay ang pagiging may-akda.
- <!--i:globe--> **Mga kanal, hindi mga timba.** Ang mga model ngayon ay sahig, hindi kisame, kaya tumatanggi kaming bumuo ng anumang nakasalalay ang halaga sa pag-iimbak ng access sa kanila. Open source ang engine, nagre-render sa sarili mong device at gumagana offline. Walang model moat, walang usage meter, walang scarcity business na nakakabit sa baha mismo. Ang matibay na pamumuhunan ay ang infrastructure sa paligid ng tubig - at ang infrastructure na iyon ang ibinibigay namin.

## Ang Desisyon ng Tao ang Punto

Hinuhubog ng mga indibidwal ang lupa at ang ating kasaysayan. Ang mga pagpili nila, ginawa isa-isa, ang nagiging mundong tinitirhan ng iba sa atin. Ang mga ginagawa nila ang bumubuo sa mundong iyon. Ganyan nangyari ang anumang nangyari kailanman.

Kaya pinalalakas namin ang desisyon ng tao at hindi kailanman ikinokompromiso iyon. Ang karapatang pumili. Ang agency. Ang awtonomiya. Ang kakayahang magpasya at kumilos, at na ang kilos na iyon ay sa iyo.

Pinapalawak ng mga tool dito ang napagpasyahan ng isang tao. Hindi sila nagpapasya sa halip ng tao, at hindi sila kailanman tahimik na pumapalit sa kanila. Kung saan may desisyong dinadala ng automation, patuloy pa ring babalik ang record sa taong nagsimula nito, gaano man karaming systems at left turns ang dinaanan nito.

Iginagalang namin ito hanggang sa dulo, at itinatala namin ito: para sa kasaysayan, para sa accountability, para sa tiwala at para sa bukas.

## AI, Ayon sa Iyong mga Tuntunin

Hindi mo kailanman kailangan ang AI dito. Kung pipiliin mo ito, may tatlong bagay na nananatili:

- <!--i:people--> **Ikaw ang may kontrol.** Tumutulong lang ang AI kapag hiniling mo, at sa piraso lang na itinuro mo. Walang ipinapasya para sa iyo.
- <!--i:check--> **Hindi na ito nagkakahalaga.** Kung minsang tumulong ang AI sa paggawa ng isang bagay, sa iyo na ang resulta. Libre ang muling paggamit nito, ilang beses mang kailanganin mo ang resulta.
- <!--i:shieldcheck--> **Nananatili itong tapat.** Ang pirasong gawa ng AI ay nagsasabi nito, at ang ginagawa mo ay may pangalan mo sa halip na magpanggap na ibang tao. Maging ang built-in na tulong ay ganito gumagana: sinasagot ng [Ask Lolly](/info/ask.html) ang tanong gamit ang sariling pangungusap ng manwal at link, hindi kailanman gawa-gawang sagot.

## Ang hindi nito

- <!--i:check--> **Hindi isang pagbabawal.** Maaaring gumamit ng AI ang mga tool kung saan makakatulong ito sa trabaho, at ang mga agent ay suportadong audience - tingnan ang [AI Agents](/info/ai-agents.html).
- <!--i:seal--> **Hindi isang claim ng purity.** Malawak na binabasa ni Lolly ang provenance at tapat itong isinusulat; hindi nito pinapanggap na nade-detect nito ang bawat generated pixel sa internet.
- <!--i:sunburst--> **Hindi isang moral panic.** Hindi ang baha ang kaaway. Ang unattributed na tubig ang kaaway.

## Suriin ang mga pangakong ito mismo

Ipinapatupad ang bawat pangako sa itaas sa bukas na codebase, hindi sa policy PDF: ang provenance path, ang GEN AI labelling at ang garantiyang walang tracker ay pawang may kasamang test, at ginagabayan ka ng pahinang [Verify It Yourself](/info/verify-yourself.html) sa pag-check ng mga pahayag laban sa totoong export.
