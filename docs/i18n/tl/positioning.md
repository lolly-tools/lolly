# Paano maikukumpara ang Lolly

Gumagawa ang Lolly ng mga file na sumusunod sa brand sa sarili mong device, nang walang account. Ang **Lolly Work** ang server para sa mga team: sign-in, mga shared project, approval at server rendering, sa mga machine na pinapatakbo ng organisasyon mo. Parehong open source sa ilalim ng MPL-2.0.

Pinapanatili ng karamihan ng mga team ang mga tool na mayroon sila. Nagbibigay ng mga design ang isang design app, nananatiling opisyal na sanggunian ang isang DAM, at ginagawang mga tapos na file ng Lolly ang mga aprubadong input. Inilalarawan ng [Gamitin ang Lolly kasama ng umiiral mong DAM](/info/use-with-dam.html) ang kombinasyong iyon. Ang ideya sa likod ng kombinasyon ay [soberanya sa nilalaman](/info/content-sovereignty.html).

<!--i:eti-gauge-->
## Mga tool ngayon

Ipinapakita ng bawat singsing kung gaano kakumpleto natutugunan ng isang uri ng produkto ang isang pangangailangan. Pindutin ang **?** sa tabi ng row para makita ang ebidensya, at ang **?** sa tabi ng legend para makita kung paano gumagana ang mga score.

::: figure positioning-comparison
Paghahambing ng kakayahan. Pananaliksik tungkol sa mga kakompetensya mula sa mga dokumento ng vendor, Agosto hanggang 21 Nobyembre 2026. Sinuri ang Lolly at Lolly Work noong 21 Nobyembre 2026. Pagbibigay ng score: 0 wala, 25 may workaround, 50 mayroon pero may hadlang o bahagya lang, 75 mahusay pero may mga limitasyon, 100 pangunahing kakayahan.
:::

::: details Mga sanggunian para sa mga score na nagbago noong Nobyembre 2026
- Canva: [changelog ng API](https://www.canva.dev/docs/apps/rest-apis/changelog/), [mga service app](https://www.canva.dev/blog/developers/canva-service-accounts/), [tulong sa Brand Controls](https://www.canva.com/help/brand-control/)
- Adobe: [changelog ng InDesign API](https://developer.adobe.com/firefly-services/docs/indesign-apis/getting-started/changelog/), [presyo ng Adobe Express](https://www.adobe.com/express/pricing)
- Figma: [mga credit ng agent at AI](https://help.figma.com/hc/en-us/articles/42614902212887), [MCP server](https://developers.figma.com/docs/figma-mcp-server/)
- Frontify at Bynder: [tala ng release ng Frontify noong Oktubre 2026](https://news.frontify.com/163371-what-s-new-in-october-2026), [Frontify MCP](https://help.frontify.com/en/articles/14787214-frontify-mcp-beta)
- Bannerbear at Placid: [presyo ng Bannerbear](https://www.bannerbear.com/pricing/), [changelog ng Bannerbear](https://www.bannerbear.com/changelog/), [presyo ng Placid](https://placid.app/pricing)
- Penpot: [presyo ng self-host](https://penpot.app/pricing/self-host), [mga release](https://github.com/penpot/penpot/releases)
- Cloudinary: [provenance ng nilalaman](https://cloudinary.com/documentation/content_provenance_and_authenticity), [presyo](https://cloudinary.com/pricing)
:::

Magkahiwalay na row ang mga feature at track record. Ang unang pampublikong release ng Lolly ay 1.0.1 noong 30 Agosto 2026, wala pang independiyenteng audit ang seguridad nito at ilang buwan pa lang ang ebidensya ng paggamit dito. Nasa [Paggamit & Pamamahala](/info/adoption-governance.html#status) ang kasalukuyang kalagayan.

<!--i:eti-hammer-->
## Kailan gagamit ng Lolly

::: cols
## Gamitin ang Lolly kapag

- Paulit-ulit na kailangan ang parehong uri ng file: mga event tile, badge, certificate, alert, social card
- Maraming file ang nagmumula sa isang template at talahanayan ng mga value, sa [Lolly Batch](/info/batch.html#make-many-versions-of-one-design) o sa CLI
- Kailangang manatili sa loob ng design system ang mga kulay, type at asset, kahit sa malayang canvas
- Kailangang maging nae-edit at nauulit ang isang tapos na design sa Figma, Penpot, Illustrator, InDesign, Affinity o PDF ([Mag-import ng design](/info/design-import.html))
- Kailangang gawin ang mga file sa sarili mong mga device o server

## Gumamit ng iba kapag

- Detalyadong pag-retouch ng larawan o ilustrasyon ang gawain
- Nagdidisenyo at gumagawa ka ng prototype ng interface ng application
- Kailangan mo ng malaking library ng stock at template na handa sa unang araw
- Kailangan mo ng pinamamahalaang serbisyo na may mahabang track record sa malawakang paggamit
:::

Hinahayaan ng mga na-import na design at pinagsasaluhang design token ang team na pagsamahin ang Lolly at mga espesyalistang application, habang pinamamahalaan ng Lolly Work ang mga shared asset, review at delivery.

Para sa mga team na may piniling nilalaman sa DAM, magsimula sa pagpapanatili ng library na iyon at ng mga administrator nito. Itinatala ng [Karanasan ng SUSE sa Brandfolder](/info/suse-brandfolder.html) kung paano sinuportahan ng integration ang paggamit at ang pamamahala ng pagbabago sa approval. Maaaring suriin ng mga DAM vendor at partner sa implementation ang parehong kaayusan sa pamamagitan ng [workflow ng partner](/info/dam-partners.html).

Sa **Lolly Markdown Slides**, isinusulat bilang data ang isang buong deck, inaayos ang layout nang live at ine-export bilang native at nae-edit na PowerPoint file.

![Ang Lolly Markdown Slides sa split view: nakalista bilang mga block sa kaliwa ang mga slide ng deck, at nire-render sa kanan ang deck na may nakaayos nang layout](/t/url-shot?url=%2F%23%2Ftool%2Fdeck-studio&width=1440&height=900&dpi=192&waitMs=2600&walker=1&format=svg&dark=1&filename=ov2-deck-studio-output)

<!--i:eti-shield-check-->
## Nasa tool ang mga patakaran

Inilalagay ng Lolly sa tool ang mga patakaran ng brand na magagamit muli: mga kulay, font, bleed margin, spacing at pinapayagang input. Itinatakda ng template ang mga bahaging hindi dapat baguhin ng tatanggap. Nagdaragdag ang Lolly Work ng access para sa grupo at mga policy sa input sa paligid ng template na iyon, na may mga sunod-sunod na approval para sa mga isinusumite sa catalog at delivery.

Pinapadali ng minsanang pagsusuri sa tool ang paulit-ulit na produksyon, dahil minamana ng bawat output ang mga patakaran nito sa layout. Maaaring kailangan pa ring suriin ang teksto, mga na-upload na larawan at mga karapatan sa paggamit, at nagbibigay ang Lolly Work ng mga shared catalog at hakbang sa approval para rito. Para sa creative team, nagsisilbing gabay na hangganan ang tool: ikaw pa rin ang nagbibigay ng data, teksto at larawan, at pinapanatili ng tool na sumusunod sa brand ang bawat resulta.

![Ang buong gawain ng producer: i-type ang mga salita. Itinakda na ang type, kulay at spacing nang gawin ang tool](/t/url-shot?url=%2F%23%2Ftool%2Fwordmark%3Ftext%3DHello&width=1440&height=900&dpi=192&waitMs=2000&walker=1&format=svg&filename=aud-rules-in-the-tool)

Tatlo pang pagkakaiba:

- **Ang tapos na file, mula sa mga input.** Input ang pumapasok, tapos na file ang lumalabas, nang walang "ngayon i-save ito mula sa design tool mo at ayusin".
- **Pinagsasama ng mga tool ang mga tool.** Maaaring i-embed ng isang tool ang render ng ibang tool sa iisang tapos na file, nang walang pagkakaugnay ang code ng dalawa.
- **Open source.** Open source ang engine, at ang mga tool, asset at design token ay mga file na puwede mong itago sa version control o pamahalaan sa Lolly Work, hindi mga row sa database ng ibang tao.

Posible pa rin ang mapangahas na design sa loob ng mga hangganan. Ang mapa ng lungsod na ito, na angkop para sa poster, ay binubuo ng tunay na vector path ng mga kalsada at tubig, mula sa isang dropdown at dalawang color field na hindi maaaring ituro sa labas ng design system:

![Ang mga singsing ng kanal at network ng kalsada ng Amsterdam na iginuhit mula gilid hanggang gilid gamit ang sariling tinta ng design system, bawat stroke ay inilagay ng template sa halip na mano-mano](/t/url-shot?url=%2F%23%2Ftool%2Fstreet-map%3Fcity%3Damsterdam%26theme%3Dlight%26full&width=1440&height=900&dpi=96&waitMs=3200&walker=1&format=svg&cropSelector=%23tool-canvas&dark=1&filename=ov2-street-map-poster)

<!--i:eti-stamp-->
## Mag-innovate batay sa posibilidad, magpalawak nang may tiyak na resulta

Inilalagay ng karamihan sa mga alok na "AI creative" ang model sa maling panig ng isang matagal nang hangganan. Itinakda na ng mga tagasulat at tagapagpalamuti ng manuskrito kung saan ito naroon. Malaya kang gumagawa sa sketch, kung saan puwedeng subukan ang kahit ano at wala pang pinal. Pagkatapos, pupunta ka sa palimbagan, na ginagawang pinal ang gawa. Nasa mga sketch ang sining, ang palimbagan ang paraan ng pagkalat nito, at mapagkakatiwalaan ang nakalimbag na gawa dahil tinutupad ng palimbagan ang pangako nito sa bawat paglimbag.

Ang Lolly ang palimbagan. Gamitin ang anumang gusto mo sa pagbuo ng mga ideya, isang model, designer o magaspang na guhit, pero sa sandaling kailangang maging maraming file ang isang ideya, dumadaan ito sa isang bagay na pareho ang pag-render sa bawat pagkakataon, mula sa mga input na mababasa muli ng kahit sino. Ang paghahambing sa itaas ay tungkol talaga sa kung sino ang nagpapahintulot na maulit ang hakbang na iyon ng pagsasapinal.

> Magtiwala sa malikhaing proseso, magpalawak nang may mahigpit na pamantayan.

<!--i:eti-tag-->
## Libre magpakailanman

**Kung nare-render ito sa device mo, libre ito magpakailanman.** Open source ang engine, mga shell, tool at format, at hindi na mababawi ang inilabas nang bersyon. Open source din ang Lolly Work. Binabayaran ng organisasyon ang imprastraktura at operasyong pinipili nito, nang walang singil sa lisensya ng software bawat user o bawat render kapag sariling hosting. Ikinukuwento ng [Mga tanong & sagot](/info/faq.html) ang nasa likod ng pangako.

<!--i:eti-map-pin-->
## Kung saan nakalagay ang nilalaman mo

Maaaring tumakbo ang malikhaing gawain ng Lolly sa hardware na pag-aari mo, at ang mga design token, font, logo at tool nito ay mga file na puwede mong itago. Sa Lolly Work, nasa storage na kino-configure ng organisasyon mo ang mga shared project, asset, policy at audit record. Ipinapaliwanag ng [Tiwala](/info/trust.html) kung bakit mahalaga iyon, at hinahayaan ka ng [Privacy Policy](/info/privacy.html) at [Ikaw Mismo ang Mag-verify](/info/verify-yourself.html) na suriin ang pahayag sa halip na basta maniwala sa amin.

<!--i:eti-grid-->
## Bawat tool

Inihahambing ng [Paghahambing sa Lolly, bawat tool](/info/compare.html) ang Lolly sa Canva, Adobe, Figma, Penpot, mga brand portal, rendering API at online converter, na may tig-isang page, at inilalatag [kung ano ang tumatakbo kung saan](/info/compare.html#what-runs-where).
