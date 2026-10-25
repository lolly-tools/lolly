# Paano gumagana ang Lolly

Hawak ng Lolly tool ang mga patakaran para sa isang uri ng file: ang layout, ang type, ang mga kulay at kung aling mga bahagi ang puwedeng baguhin ng ibang tao. Ikaw, isang kasamahan, isang script o isang AI agent ang pupuno sa mga field, at tama ang labas ng bawat file. Ipinapakita ng pahinang ito kung sino ang gumagawa ng ano, at ang apat na ruta mula tool hanggang tapos na file.

## Isang tool, mga patakaran mo, maraming file

Nasa tool ang mga patakaran ng brand, hindi sa bawat file na ginagawa nito. Ayusin nang tama ang tool nang minsan at namamana ng bawat output ang parehong type, kulay at spacing, isang card man iyon o spreadsheet ng mga row sa isang dosenang wika.

![Isang wordmark tool na may isang field na napunan: naayos na ang type, kulay at spacing noong ginawa ang tool](/info/shots/aud-rules-in-the-tool.svg)

Ang taong gumagawa ng ika-isandaang file ay mga salita lang ang tina-type. Ikaw pa rin ang magpapasya kung paano susuriin ang gawa, at kung sino ang susuri. Pinapaliit ng Lolly ang bagay na dapat suriin, at pinapabilis ang susunod na file.

## Sino ang humahawak sa tool

Sundan ang isang campaign card sa isang organisasyon at lilitaw ang tatlong pares ng kamay. Bawat isa ay nagtatayo sa nauna.

![Isang designer ang nagtatakda ng mga patakaran nang minsan sa tool; isang developer ang nagpapatakbo nito mula sa script at kahit sino ay puwedeng pumuno sa mga field nito; parehong gumagawa ng tapos na file](/info/diagrams/concepts/asset-relay.svg)

::: timeline
- <!--i:pentool--> **Isang designer ang nagtatakda ng mga patakaran.** Inilalatag nila ang card sa Design gamit ang type at mga kulay ng brand, saka pinipili kung aling mga field ang mananatiling bukas. Minsan lang nila ito ginagawa, kaya walang manu-manong magla-localise muli ng card.
- <!--i:code--> **Isang developer ang nag-i-scale ng tool.** Tumatakbo ang parehong tool sa nightly script sa pamamagitan ng command line, kaya dumarating ang bagong chart o bagong bersyon sa ibang wika nang hindi kailangang buksan ulit ng sinuman ang design.
- <!--i:people--> **Kahit sino ang pupuno.** Ang sales rep sa eroplano, walang network at walang pagsasanay sa disenyo, ay nagbubukas ng tool at ginagawa ang card para sa meeting bukas.
:::

Ang bagong chart sa hakbang ng developer ay render na tulad nito, ginawa mula sa data string at ilang setting nang walang nagbubukas ng design file:

![Isang may pamagat na stacked area chart, ang tatlong series nito ay nakabanda sa cool na palette, na ang mga axis, legend at pamagat ay inilagay lahat ng template at hindi ng kamay](/t/url-shot?url=%2F%23%2Ftool%2Fchart%3FchartType%3Darea%26stackMode%3Dstacked%26palette%3Dcool%26heading%3DProduct%2520mix%2520by%2520quarter%26full&width=1440&height=900&dpi=192&waitMs=2600&walker=1&format=svg&cropSelector=%23tool-canvas&dark=1&filename=ov2-lifecycle-chart)

Posible lang ang madaling minuto ng rep dahil sa pag-iingat ng designer at script ng developer. Gumagamit ng iisang tool ang bawat papel, sa halip na hiwalay na produkto para sa bawat isa.

## Apat na ruta papunta sa file

Pinapatakbo ng bawat ruta ang parehong engine sa parehong tool, kaya tugma ang file na ginagawa ng script sa pino-preview mo sa app.

![Ang mga URL parameter at command-line argument ay nagiging iisang input model, dumadaan sa isang shared na runtime at export bridge](/info/diagrams/concepts/one-render-path.svg)

- <!--i:people--> **Sa app, isa-isa.** Magbukas ng tool, punan ang mga field at pindutin ang **Export**. Ginagabayan ka ng [Gawin ang una mong file](/info/make-something.html) sa isa.
- <!--i:layers--> **Sa app, sabay-sabay ang marami.** Ang [Batch](/info/batch.html#make-many-versions-of-one-design) (`#/batch`) ay kumukuha ng na-paste o na-import na table at nagre-render ng isang tapos na file bawat row.
- <!--i:cpu--> **Mula sa script o AI agent.** Pinapatakbo ng [CLI](/info/cli.html) ang tool nang headless, at hinahayaan ng [MCP server](/info/mcp.html) ang agent na tumuklas at magpatakbo ng mga tool. Dala rin ng link papunta sa tool ang mga input nito, kaya kumpletong request ang link.
- <!--i:server--> **Sa pamamagitan ng server ng organisasyon mo.** Nagre-render ang [Lolly Work](/info/organisation.html) sa server sa ilalim ng sign-in at tool policy ng organisasyon mo, may mga job na kayang ipagpatuloy, at hawak ang output para sa download o aprubadong delivery.

Nakadepende kung aling ruta ang magagamit ng isang job sa mga format ng tool at sa kayang gawin ng host: may mga format na nangangailangan ng browser, kaya ipinapasa ng command line ang mga iyon sa browser tier. Inililista ng [Mag-render gamit ang CLI](/info/cli-rendering.html) kung aling mga format ang nire-render saan.

## Ano ang tumatakbo saan

Tumatakbo sa device mo ang paggawa, pag-edit at pag-export, nang walang account. Ang feature na nangangailangan ng server, tulad ng Sync o pagpapadala ng file sa konektadong serbisyo, ay kumokonekta lang kapag ginamit mo ang feature na iyon. Sa Lolly Work, ang mga shared project, live na team editing, approval at server job ay gumagamit ng server ng organisasyon mo. Inilalagay ng [Ano ang tumatakbo saan](/info/compare.html#what-runs-where) ang dalawang bahagi nang magkatabi.

## Basahin susunod

- [Gawin ang una mong file](/info/make-something.html), para subukan ito ngayon.
- [Simulan](/info/quickstart.html), para ilagay ang sarili mong design system.
- [Mag-automate](/info/builders.html), para sa command line, mga link at agent.
- [Arkitektura ng Lolly](/info/overview.html), para sa mga contributor: ang engine, ang mga shell at ang mga patakarang nagbubuklod sa kanila.
