# Aming Pananaw sa AI

Binuo ang Lolly sa gitna ng pinakamalaking pagbabago sa paggawa ng media mula nang magkaroon ng palimbagan, ng mga taong hindi natataranta sa AI at hindi rin labis ang paghanga sa teknolohiya. Narito ang posisyon ng proyekto, kasama ang mekanismo sa likod ng bawat pangako, para makapag-verify ka sa halip na basta magtiwala.

> "Umiinom tayo na para bang matutuyo ang gripo anumang sandali. Hindi iyon mangyayari - ang AI ngayon ang pinakamasahol na magiging kalagayan nito kailanman. Kung makaligtas tayo sa baha, hindi iyon sa pag-iimbak ng laman ng kinakalawang na tangke ng tubig sa ibaba ng burol, na puno ng latak. Sa halip, sa pagpapatubig at pagbawi ng ***ating*** lupa para sa masaganang kinabukasan."
>
> - Andy Fitzsimon, Kontribyutor ng Lolly

![Isang supercell na bagyong humahagupit sa isang homestead sa outback - ang tangke at mga kubol sa ibaba, gumagawa na ng mga daluyan ang tubig-baha sa tuyong pastulan](/info/the-flood.webp)

%file{Gemini_Generated_Image_vmy7thvmy7thvmy7.png} larawang binuo ng %entity{Gemini} %sig{signed by %entity{Google LLC}} %entity{Lolly} %act{opened}, %act{watermarked} at %act{exported to WebP} bilang %file{the-flood.webp} %detail{10.6 MB down to 0.8 MB} %sig{signed by %entity{Lolly}} [I-verify ito ngayon](/#/verify?src=%2Finfo%2Fthe-flood.webp)

Para maging eksakto, dahil ipinapahayag ng page na ito na mahalaga ang pagiging eksakto: binuo ang larawan sa itaas, hindi kinunan. Walang camera na itinutok sa homestead na iyon, dahil walang ganoong homestead. Inilalarawan nito ang rehiyonal na Queensland, Australia, mula sa prompt na ginawa sa United Kingdom, na binuo sa isang datacenter sa United States. Sinisikap nitong maging tapat sa isang lugar nang hindi nagiging tala ng isang lugar, at ang pagkakaibang iyon ang buong dahilan kung bakit may Content Credentials ang larawan.

Ito ang makikita kapag sinuri mo ang file. Siyam na hakbang ang nananatili sa file: lima na itinala ng Google habang binubuo at nilalagyan nito ng watermark ang larawan, saka apat na itinala ng Lolly habang binubuksan, ginagawa, minamarkahan at kino-convert nito ang bersyon sa page na ito. Walang anumang binuo gamit ang AI ang Lolly, at sinasabi iyon ng entry nito.

![Ang history ng pagbabago na binabasa ng Lolly mula sa tapos na file - limang hakbang na itinala ng Google, saka apat ng Lolly, na nagtatapos sa WebP sa page na ito](/t/url-shot?url=%2F%23%2Fverify%3Fsrc%3D%2Finfo%2Fthe-flood.webp&width=1440&height=1400&dpi=192&waitMs=6000&walker=1&format=svg&cropSelector=.valid-steps&dark=1&filename=ai-stance-change-history)

Sa paglalarawan ni Andy, ang pagtingin sa AI bilang kapos na yaman ay parang pag-inom ng panis na tubig mula sa tangke habang rumaragasa ang tubig-baha sa kapatagan. Malapit nang maging halos walang hanggan ang nilalamang binuo ng AI. Kapag naging walang hanggan ang isang bagay, lumilipat ang halaga nito sa anumang nananatiling kakaunti sa paligid nito: tiwala, provenance, pagkakaugnay-ugnay ng brand at paghatol ng tao. Hindi mas malaking timba para sa baha ang Lolly. Patubig ito: mga daluyang gumagabay sa tubig at lupang may talagang tumutubo.

<!--i:eti-checklist-->
## Ang pananaw, sa limang pangako

- <!--i:layers--> **Tinatanggap ang AI bilang input, hindi kailanman bilang pagpapanggap.** Ganap na mga user ng Lolly ang mga agent: pinapatakbo nila ang parehong mga tool na ginagamit ng mga tao, sa pamamagitan ng [MCP server](/info/mcp.html) at [URL mode](/info/url-mode.html), sa loob ng eksaktong parehong mga limitasyon. Ang hindi puwedeng gawin ng anumang agent ay ipasa ang output nito bilang isang bagay na hindi naman ito. Itinatakda ng [Input, hindi pagpapanggap](/info/input-not-impersonation.html) ang hangganang iyon.
- <!--i:shieldcheck--> **Ipinapakilala ng AI ang sarili nito.** Kapag AI ang bumuo ng mga pixel, sinasabi iyon ng export: isang pahayag na nababasa ng machine sa Content Credentials ng file at isang nakikitang GEN AI badge kapag may nag-verify ng file. Kapag inilagay sa isang design ang media na idineklara mong gawa ng AI, sinasabi rin iyon ng sariling credential ng export: isang composite origin mark at isang nilagdaang pagsisiwalat tungkol sa AI na nababasa ng machine. Binabasa at ipinapakita rin ng Lolly ang mga deklarasyon tungkol sa AI sa mga file na ginawa sa ibang lugar, at minamarkahan kapag malamang na may SynthID watermark, na binabasa ang deklarasyon, hindi ang mismong watermark. Sakop ng parehong patakaran ang sariling rewriter ng Lolly na tumatakbo sa device: bawat pangungusap na isinusulat nito ay may pampublikong statistical watermark sa pagpili nito ng mga salita, na isiniwalat dito at sa tool, kaya patuloy na ipinapakilala ng text na isinulat ng model ang pinagmulan nito kahit bilang plain-text na kopya, at maaaring suriin ng kahit sino ang text na iyon sa [Lolly Verify](/#/verify) ([kung paano gumagana ang pagsusuri](/info/what-verify-checks.html#text-reworded-by-lolly)). Sadyang pampubliko ang pamamaraan: pag-verify para sa lahat, walang lihim para sa sinuman. Karapat-dapat malaman ng mga tumatanggap ng media kung paano ito ginawa.
- <!--i:check--> **Naka-on bilang default ang provenance.** May [Content Credentials](/info/content-credentials-identity.html) ang mga export bilang default, hindi bilang nakatagong setting. Sakop ng chain ang mga edit at sangkap, kaya kasama ng gawa ang history nito. Maaari mong [i-verify ito mismo](/info/verify-yourself.html) sa anumang file na ginagawa ng Lolly.
- <!--i:people--> **Ang mga tao pa rin ang may-akda.** Ang mga salita, larawan, palette, desisyong nangangailangan ng paghatol: pinalalawak ng mga tool ang paghatol na iyon at hindi kailanman pumapalit sa tao. Ang mga nakakapagod na bahagi ang ina-automate: ang pagsusuri sa pagsunod sa brand, muling pag-export sa bawat laki, manwal na pag-localize. Ang pagiging may-akda ang nananatili.
- <!--i:globe--> **Mga daluyan, hindi mga timba.** Panimulang antas ang mga model ngayon, hindi hangganan, kaya tumatanggi kaming bumuo ng anumang nakasalalay ang halaga sa pagsosolo ng access sa mga ito. Open source ang engine, nagre-render sa sarili mong device at gumagana offline. Walang model na ginagawang panangga sa kumpetisyon, walang metro ng paggamit, walang negosyong nakabatay sa kakapusan na nakakabit sa baha mismo. Ang pangmatagalang pamumuhunan ay ang imprastraktura sa paligid ng tubig - at ang imprastrakturang iyon ang ipinamimigay namin.

<!--i:eti-user-check-->
## Desisyon ng tao ang layunin

Hinuhubog ng mga indibidwal ang mundo at ang kasaysayan natin. Ang mga pasya nila, na ginagawa nang paisa-isa, ang nagiging mundong tinitirhan ng iba sa atin. Ang mga kilos nila ang lumilikha sa mundong iyon. Ganoon naganap ang lahat ng bagay.

Kaya binibigyan namin ng lakas ang desisyon ng tao at hindi kailanman ikinokompromiso iyon. Ang karapatang pumili. Kakayahang kumilos. Awtonomiya. Ang kakayahang magpasya at kumilos, at ang pagkilos na iyon ay maging iyo.

Pinapalawak ng mga tool dito ang napagpasyahan ng tao at hindi kailanman tahimik na nagpapasya para sa kanila. Kapag ipinapatupad ng automation ang isang pasya, natutunton pa rin ng record ang taong nagpasimula nito, gaano man karaming system at liko ang dinaanan nito.

Iginagalang namin iyon mula simula hanggang dulo, at itinatala namin ito: para sa kasaysayan, pananagutan, tiwala at bukas.

<!--i:eti-sliders-->
## AI, ayon sa gusto mo

Hindi mo kailanman kailangan ng AI dito. Kung pipiliin mo ito, tatlong bagay ang nananatili:

- <!--i:people--> **Ikaw ang may kontrol.** Tumutulong lang ang AI kapag hiniling mo, at sa bahaging itinuro mo lang. Walang pinagpapasyahan para sa iyo.
- <!--i:check--> **Wala nang kasunod na gastos.** Kung tumulong ang AI na gumawa ng isang bagay, sa iyo ang resulta. Libre ang paggamit nito muli, gaano man kadalas mo kailangan ang resulta.
- <!--i:shieldcheck--> **Nananatili itong tapat.** Sinasabi ng gawang mula sa AI na iyon ang pinagmulan nito, at dala ng ginagawa mo ang pangalan mo sa halip na magpanggap na ibang tao. Ganito rin gumagana ang built-in na tulong: sumasagot ang [Ask Lolly](/info/ask.html) gamit ang mismong pangungusap ng manwal at isang link, hindi kailanman gawa-gawang sagot.

<!--i:eti-info-->
## Ano ang hindi nito ibig sabihin

- <!--i:check--> **Hindi pagbabawal.** Puwedeng gumamit ng AI ang mga tool kung nakakatulong ito sa gawain, at sinusuportahan din ang mga agent bilang gumagamit - tingnan ang [Mga AI Agent](/info/ai-agents.html).
- <!--i:seal--> **Hindi pag-aangking walang bahid.** Malawak ang binabasang provenance ng Lolly at tapat ang pagsulat nito; hindi ito nagpapanggap na matutukoy ang bawat generated na pixel sa internet.
- <!--i:sunburst--> **Hindi pagkataranta tungkol sa moralidad.** Hindi ang pagdagsa ng nilalaman ang kalaban. Ang kawalan ng pagkilala sa pinagmulan nito ang problema.

<!--i:eti-search-->
## Suriin mo mismo ang mga pangakong ito

Ipinapatupad ang bawat pangako sa itaas sa bukas na codebase, hindi sa isang policy PDF: kasama sa release ang mga test para sa provenance path, GEN AI labelling at garantiyang walang tracker, at ginagabayan ka ng pahinang [Ikaw Mismo ang Mag-verify](/info/verify-yourself.html) sa pagsusuri ng mga pahayag gamit ang totoong export.
