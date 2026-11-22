# Paano gumagana ang Lolly

Hawak ng Lolly tool ang mga patakaran para sa isang uri ng file: ang layout, type, mga kulay at kung aling mga bahagi ang puwedeng baguhin ng iba. Ikaw, ang kasamahan, script o AI agent ang pumupuno sa mga field, at sumusunod ang bawat file sa mga patakarang iyon.

<!--i:eti-repeat-->
## Isang tool, mga patakaran mo, maraming file

Nasa tool ang mga patakaran ng brand. I-set up ang tool nang isang beses at pare-pareho ang type, kulay at spacing ng bawat output, mula sa isang card hanggang sa spreadsheet na may mga row sa isang dosenang wika.

![Isang wordmark tool na may isang field na napunan: naitakda na ang type, kulay at spacing noong ginawa ang tool](/info/shots/aud-rules-in-the-tool.svg)

Mga salita lang ang tina-type ng gumagawa ng ika-isandaang file. Ikaw ang nagpapasya kung paano susuriin ang gawa at kung sino ang susuri nito. Binabawasan ng Lolly ang kailangang suriin at pinabibilis ang paggawa ng susunod na file.

<!--i:eti-users-->
## Sino ang gumagamit ng tool

Tatlong tungkulin sa organisasyon ang nagtutulungan sa iisang campaign card.

![Isang beses itinatakda ng designer ang mga patakaran sa tool; pinapatakbo ito ng developer mula sa script at kahit sino ay puwedeng pumuno sa mga field nito; kapwa gumagawa ng mga tapos na file](/info/diagrams/concepts/asset-relay.svg)

::: timeline
- <!--i:pentool--> **Itinatakda ng designer ang mga patakaran.** Inilalatag niya ang card sa Lolly Design gamit ang type at mga kulay ng brand, saka pinipili kung aling mga field ang puwedeng baguhin. Isang beses niya itong ginagawa, kaya wala nang mano-manong naglo-localise ng card muli.
- <!--i:code--> **Pinalalawak ng developer ang paggamit ng tool.** Tumatakbo ang parehong tool sa isang script gabi-gabi sa pamamagitan ng command line. Dumarating ang bagong chart o bagong bersyon sa ibang wika nang walang muling nagbubukas ng design.
- <!--i:people--> **Kahit sino ay puwedeng pumuno rito.** Binubuksan ng sales rep na nasa eroplano, walang network at walang pagsasanay sa design, ang tool at ginagawa ang card para sa pulong bukas.
:::

Ang bagong chart ng developer ay render na tulad nito, na ginawa mula sa isang data string at ilang setting:

![Isang stacked area chart na may pamagat, ang tatlong series nito ay nasa mga banda ng cool na palette, at ang mga axis, legend at pamagat ay inilagay lahat ng template sa halip na mano-mano](/t/url-shot?url=%2F%23%2Ftool%2Fchart%3FchartType%3Darea%26stackMode%3Dstacked%26palette%3Dcool%26heading%3DProduct%2520mix%2520by%2520quarter%26full&width=1440&height=900&dpi=192&waitMs=2600&walker=1&format=svg&cropSelector=%23tool-canvas&dark=1&filename=ov2-lifecycle-chart)

Nakadepende ang mabilis na isang minutong paggawa ng rep sa mga patakaran ng designer at sa script ng developer. Iisang tool ang gamit sa bawat tungkulin.

<!--i:eti-train-->
## Apat na paraan para gumawa ng file

Ginagamit ng bawat paraan ang parehong engine sa parehong tool, kaya tumutugma ang file na ginagawa ng script sa pini-preview mo sa app.

![Nagiging iisang input model ang mga URL parameter at command-line argument, at dumadaan sa iisang pinagsasaluhang runtime at export bridge](/info/diagrams/concepts/one-render-path.svg)

- <!--i:people--> **Sa app, paisa-isa.** Magbukas ng tool, punan ang mga field at pindutin ang **Export**. Ginagabayan ka ng [Gawin ang una mong file](/info/make-something.html) sa paggawa ng isa.
- <!--i:layers--> **Sa app, marami nang sabay-sabay.** Tumatanggap ang [Lolly Batch](/info/batch.html#make-many-versions-of-one-design) (`#/batch`) ng na-paste o na-import na table at nagre-render ng isang tapos na file bawat row.
- <!--i:cpu--> **Mula sa script o AI agent.** Pinapatakbo ng [CLI](/info/cli.html) ang tool nang headless, at pinapayagan ng [MCP server](/info/mcp.html) ang agent na tumuklas at magpatakbo ng mga tool. Dala rin ng link ng tool ang mga input nito, kaya kumpletong request ang isang link.
- <!--i:server--> **Sa pamamagitan ng server ng organisasyon mo.** Nagre-render ang [Lolly Work](/info/organisation.html) sa server sa ilalim ng sign-in at tool policy ng organisasyon mo, pinapanatili ang mga job na maipagpapatuloy nito at iniingatan ang output para sa download o aprubadong delivery.

Nakadepende sa mga format ng tool at sa kakayahan ng host kung aling paraan ang magagamit ng job. Kailangan ng ilang format ng browser, kaya ipinapasa ng command line ang mga iyon sa browser tier. Inililista ng [Mag-render gamit ang CLI](/info/cli-rendering.html) kung saan nire-render ang bawat format.

<!--i:eti-monitor-->
## Ano ang tumatakbo kung saan

Sa device mo tumatakbo ang paggawa, pag-edit at pag-export, nang walang account. Kumokonekta lang ang feature na nangangailangan ng server, tulad ng Sync o pagpapadala ng file sa nakakonektang serbisyo, kapag ginagamit mo ang feature na iyon. Sa Lolly Work, ginagamit ng mga shared project, live na pag-edit ng team, approval at server job ang server ng organisasyon mo. Pinagtatabi ng [Ano ang tumatakbo kung saan](/info/compare.html#what-runs-where) ang dalawang bahagi.

<!--i:eti-graduation-cap-->
## Susunod na babasahin

- [Gawin ang una mong file](/info/make-something.html), para subukan ito ngayon.
- [Magsimula](/info/quickstart.html), para ipasok ang sarili mong design system.
- [Mag-automate](/info/builders.html), para sa command line, mga link at agent.
- [Arkitektura ng Lolly](/info/overview.html), para sa mga contributor: ang engine, mga shell at ang mga patakarang nag-uugnay sa mga ito.
