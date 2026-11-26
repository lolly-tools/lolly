# Magsimula

Itakda ang mga tool mo sa sarili mong mga kulay at font, at muling gamitin ang gawa na mayroon ka na. Hindi mo kailangan ng account, at sa device mo tumatakbo ang paggawa at pag-export.

::: steps
- <!--i:eti-sparkles--> **[Gumawa ng isang file](/info/make-something.html)** Isang QR code sa loob ng ilang minuto, na ipinapakita ang bawat hakbang.
- <!--i:eti-palette--> **[Ilagay ang brand mo](#put-your-brand-in)** Magsimula sa isang kulay, tokens file o tapos na design.
- <!--i:eti-folder-move--> **[Ipasok ang gawa mo](#bring-in-what-you-already-have)** Mga design, deck at datos na mayroon ka na, na binabasa sa device mo.
- <!--i:eti-repeat--> **[Gumawa pa ng kapareho](#make-many-share-and-automate)** Magbahagi ng link, punan ang spreadsheet o patakbuhin ang tool mula sa script.
:::

Ang [Ano ang Lolly?](/info/what-is-lolly.html) ay isang limang minutong pagpapakilala. Ipinapakita ng [Paano gumagana ang Lolly](/info/how-lolly-works.html) kung sino ang gumagawa ng ano.

<!--i:eti-palette-->
## Ilagay ang brand mo

Bumubukas ang lolly.tools sa **Lolly Demo**, ang sariling halimbawang design system ng Lolly ([Kilalanin ang Lolly Demo](/info/lolly-demo.html)). Pinapalitan ng design system mo ang Lolly Demo. Isa itong maliit na set ng mga design token (mga kulay, font at ilang panuntunan) na ginagamit ng bawat tool sa pagguhit. Itakda ito nang isang beses, at lahat ng gagawin mo ay magsisimulang tugma sa brand.

Piliin ang paraang tugma sa mayroon ka:

- <!--i:palette--> **Isang kulay.** Buksan ang **Design System Setup** view (`#/start`), pangalanan ang design system mo at pumili ng pangunahing kulay. Bumubuo ang Lolly ng accessible na palette mula sa kulay na iyon, na may light at dark na mga surface, text at accent. Pumili ng font at mayroon ka nang magagamit na brand.
- <!--i:upload--> **Isang tokens file.** Tumatanggap ang **Add from…**, sa itaas ng Lolly Design System Setup, ng DTCG, Tokens Studio o Penpot tokens file, SVG o `LollyBrand` pack. Napupunan ang palette mula sa file. Habang walang laman ang design system, binubuksan ng **Start from a reference** sa Board ang parehong picker.
- <!--i:pentool--> **Isang tapos na design.** Sa Lolly Design, piliin ang **Import a design** at mag-drop ng Figma, Penpot, Illustrator, InDesign, Affinity, Photoshop, PowerPoint o SVG file ([bawat format](/info/design-import.html#what-comes-in-from-each-app)). Tingnan ang [Ipasok ang mayroon ka na](#bring-in-what-you-already-have) sa ibaba.

Sa unang pagbukas mo ng gallery, may pagbati sa itaas na nag-aalok ng isang susunod na hakbang. Sa lolly.tools, binubuksan ng **Start making** ang Lolly Design sa Launch poster. Sa bagong install, binubuksan ng **Make it yours** ang Lolly Design System Setup. Sa ilalim ng button na iyon, binubuksan ng **Bring a file** ang file picker para sa design, at lumalabas bilang link ang isa pa sa dalawang pagpipiliang iyon. Alinman sa mga ito, o ang close button, ay permanenteng nag-aalis ng pagbati.

![Ang Colours room ng Lolly Design System Setup sa bagong design system: isang live na chip, isang field at ang buong unang desisyon](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor&system=new-design-system&width=1440&height=740&dpi=192&waitMs=1800&format=svg&walker=1&dark=1&filename=bs-colours-new-system)

Walong room, na magagamit sa anumang pagkakasunod, ang nagpapalawak sa design system: **Board**, **Colours**, **Type**, **Logos**, **Tokens**, **Files**, **Rules** at **Skills**. Nag-a-update ang bawat preview sa app habang nagta-type ka. Sinasaklaw ng [Lolly Design System Setup](/info/brand-studio.html) ang bawat room.

Itinatago ang mga font sa device mo. Iniimbak bilang brand asset ang Google Font na pipiliin mo, kaya gumagana offline ang type mo at walang kinukuha kapag gumuguhit ang tool.

### Tingnan, palitan at ibahagi ang design system

- **Tingnan ang aktibo.** Ipinapakita ng **Settings → Design system** ang aktibong design system bilang cover at mga page, na read-only.
- **Lumipat sa iba.** Inililista ng **Settings → Preferences → Design systems** ang bawat design system sa device na ito. Puwedeng magpatakbo ang isang organisasyon ng ilang design system, o ng isa na may ilang colourway. Ipinapakita ng [Mga arkitektura ng brand](/info/brand-architectures.html) ang mga ayos.
- **Magbahagi ng isa.** I-export ang design system bilang `LollyBrand` pack: isang file na ini-import ng kasamahan para makuha ang parehong palette, mga font at panuntunan.

Ang design system na kasama sa build mo o ibinigay ng organisasyon mo ay **pinamamahalaan**: may lock ito at nananatiling read-only. Para baguhin ito, gumawa ng mae-edit na kopya mula sa **Settings → Preferences → Design systems**.

![Ang Design system tab sa Settings: ang aktibong design system bilang cover at mga page](/t/url-shot?url=%2F%23%2Fd%3Ftab%3Dbrand&width=1440&height=900&dpi=192&waitMs=1800&format=svg&walker=1&localize=1&dark=1&filename=dashboard-brand&waitSelector=%5Bdata-issue-ready%5D)

DTCG tokens ang design system mo, ang format na binabasa at sinusulat ng Penpot at dinadala ng Tokens Studio sa Figma. Iisang dokumento ang palette na ginagamit mo sa pag-design at ang palette na inilalapat ng Lolly. Nasa [Design Tokens](/info/design-tokens.html) ang mga detalye.

::: details Para sa mga developer: bumuo ng brand pack mula sa command line
Bumubuo ang `ingest:brand` ng magagamit muli na brand pack sa isang checkout. Tinatanggap nito ang tatlong container na ine-export ng Penpot at Tokens Studio: isang `tokens.json`, isang directory ng mga file bawat set na may `$metadata.json` o isang `project.penpot` archive.

```bash
pnpm run ingest:brand ./my-tokens.json --name acme --label "Acme" --activate
```

Nirerehistro ng `--activate` ang brand bilang profile at binubuo at vina-validate ang catalog nito. Hindi nito kailanman binabago ang default na profile: patakbuhin gamit ang `LOLLY_PROFILE=acme` para gamitin ang bagong pack. Ipinapaliwanag ng [Pag-configure](/info/configuration.html) kung paano nagtutugma ang mga brand pack at profile.
:::

<!--i:eti-folder-move-->
## Ipasok ang mayroon ka na

**Mga Lolly Design file.** Bumubukas sa Lolly Design bilang mae-edit na layout ang tapos na gawa mula sa Figma, Penpot, Illustrator, InDesign o anumang SVG app. Puwede pa ring baguhin ang text, nananatiling hugis ang mga hugis at napupunta sa library mo ang mga larawan. Binabasa ang file sa browser mo at walang ina-upload. Inililista ng [Mag-import ng design](/info/design-import.html) ang bawat format at kung ano ang napapanatili.

**Mga deck.** Mag-drop ng PowerPoint `.pptx` sa Lolly para itago ang mga slide nito bilang mga asset. Sumulat ng bagong deck mula sa Markdown sa **Lolly Markdown Slides**. Inililipat ng [Palitan ang brand ng deck](/info/rebrand.html) ang isang deck sa design system mo.

**Data.** Mag-paste o mag-drop ng CSV o JSON table para punan ang mga umuulit na field ng tool. Gumagawa ang [Lolly Batch](/info/batch.html#make-many-versions-of-one-design) ng isang tapos na file bawat row.

### Mula sa minsanang gawa tungo sa template

Karaniwang Lolly Design session ang isang na-import na layout. Ginagawang tool ng **Share with rules** ang session. Pinipili mo kung aling mga bahagi ang puwedeng baguhin ng iba, at iyon lang ang pinupunan nila.

![Panatilihin ang Lolly Design master, piliin ang mga input at limitasyon sa kopyang pang-author, saka magbahagi ng magagamit muli na .lolly tool na pupunan ng mga tatanggap](/info/diagrams/concepts/share-with-rules.svg)

Dinadaanan ng [Magbahagi ng design na may mga patakaran](/info/create-a-tool.html) ang bawat hakbang.

<!--i:eti-repeat-->
## Gumawa ng marami, magbahagi at mag-automate

- <!--i:download--> **Mag-export.** Gumagawa ang mga tool ng SVG, PDF, PNG, JPG, WebP, video at iba pa, sa tunay na sukat ng print kapag kailangan. May sariling mga format na iniaalok ang bawat tool. Tingnan ang [Mag-export ng file](/info/exporting.html).
- <!--i:link--> **Magbahagi ng link.** Kasama sa link ng tool ang mga setting nito, kaya muling binubuksan ng link ang parehong file saanman.
- <!--i:layers--> **Gumawa ng isa bawat row.** Patakbuhin ang tool mula sa spreadsheet sa [Lolly Batch](/info/batch.html#make-many-versions-of-one-design).
- <!--i:cpu--> **Mag-automate.** Tumatakbo ang parehong render mula sa [CLI](/info/cli.html) at mula sa isang [AI agent](/info/ai-agents.html).

Kumpletong request ang isang link. Tinype sa address bar ang uri, heading at data table ng chart sa ibaba.

![Isang bar chart ng mga buwanang signup ayon sa channel sa mga kulay ng design system, kung saan ang bawat value ay galing sa query parameter sa halip na click](/t/url-shot?url=%2F%23%2Ftool%2Fchart%3Fct%3Dbar%26sty%3Dposter%26pl%3Droles%26transparentBg%3Dfalse%26d%3DMonth%2CWeb%2CApp%2CPartners%250AJan%2C120%2C60%2C25%250AFeb%2C180%2C95%2C40%250AMar%2C265%2C150%2C70%250AApr%2C340%2C210%2C110%250AMay%2C455%2C290%2C160%250AJun%2C560%2C380%2C230%26t%3DSignups%2520this%2520year%26st%3DBy%2520channel%252C%2520January%2520to%2520June%26full&width=1440&height=900&dpi=192&waitMs=4000&cropSelector=%23tool-canvas&walker=1&format=svg&dark=1&filename=vt-d3-url-chart)

<!--i:eti-map-pin-->
## Saan susunod

- <!--i:people--> **[Lumikha](/info/creators.html)**: paggawa, pag-animate, pag-record, pagbabahagi at pag-export.
- <!--i:code--> **[Mag-automate](/info/builders.html)**: mga design system, paggawa ng tool, command line, mga link at agent.
- <!--i:usercheck--> **[Pamahalaan](/info/operators.html)**: pagpapatakbo ng Lolly para sa team gamit ang Lolly Work.
- <!--i:server--> **[Mag-deploy](/info/operate.html)**: pag-host ng Lolly at Lolly Work.
- <!--i:shieldcheck--> **[Tiwala](/info/trust.html)**: privacy, seguridad at pag-check ng file nang sarili mo.
