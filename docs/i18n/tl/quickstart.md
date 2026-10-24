# Simulan

Pagdating sa dulo ng pahinang ito, isusuot na ng mga tool mo ang sarili mong mga kulay at font, at handa nang gamitin muli ang gawa mo na. Hindi mo kailangan ng account, at tumatakbo sa device mo ang paggawa at pag-export.

::: timeline
- <!--i:sparkle--> **Gumawa ng isang file.** Ginagabayan ka ng [Gawin ang una mong file](/info/make-something.html) sa isang QR code sa loob ng ilang minuto.
- <!--i:palette--> **Ilagay ang brand mo.** Magsimula sa isang kulay, tokens file o tapos nang design.
- <!--i:layers--> **Gumawa pa ng kapareho.** Magbahagi ng link, punan ang spreadsheet o patakbuhin ang tool mula sa script.
:::

Bago ka sa mismong ideya? Ang [Ano ang Lolly?](/info/what-is-lolly.html) ay limang-minutong pagpapakilala, at ipinapakita ng [Paano gumagana ang Lolly](/info/how-lolly-works.html) kung sino ang gumagawa ng ano.

## Ilagay ang brand mo

Nagbubukas ang lolly.tools sa **Lolly Demo**, ang sariling sample na design system ng Lolly; ipinapakita ng [Kilalanin ang Lolly Demo](/info/lolly-demo.html) kung ano ang tinitingnan mo. Papalitan ito ng design system mo: isang maliit na hanay ng design token, ibig sabihin mga kulay, font at ilang patakaran, na ginagamit ng bawat tool sa pagguhit. Itakda ito nang minsan, at on-brand na ang simula ng lahat ng gagawin mo.

Piliin ang rutang tugma sa meron ka:

- <!--i:palette--> **Isang kulay.** Buksan ang **Design System Setup** (`#/start`), pangalanan ang design system mo at pumili ng primary na kulay. Gumagawa ang Lolly mula rito ng kumpleto at accessible na palette, na may light at dark na surface, text at accent. Pumili ng font at may gumagana ka nang brand.
- <!--i:upload--> **Isang tokens file.** Ang **Add from…**, sa paanan ng room rail sa Design System Setup, ay tumatanggap ng DTCG, Tokens Studio o Penpot tokens file, SVG o `LollyBrand` pack. I-drop ito at mapupuno ang palette. Habang walang laman pa ang design system, binubuksan ng **Start from a reference** sa Overview room ang parehong picker.
- <!--i:pentool--> **Isang tapos nang design.** Sa Design, piliin ang **Import a design** at i-drop ang `.fig`, `.penpot`, `.ai`, `.idml` o SVG file. Tingnan ang [Dalhin ang meron ka na](#bring-in-what-you-already-have) sa ibaba.

Sa unang beses mong buksan ang gallery, nag-aalok ang maikling welcome ng parehong mga pagpipilian: binubuksan ng **Make it yours** ang Design System Setup, binubuksan ng **Bring your design** ang file picker para sa design at isinasara ng **Explore the community tools** ang welcome.

![Ang Colours room ng Design System Setup sa bagong install: isang live na chip, isang field at ang kabuuan ng unang desisyon](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor&width=1440&height=740&dpi=192&waitMs=1800&format=svg&walker=1&localize=1&dark=1&filename=brand-colours)

Mula roon, pitong room ang magdadala nito hanggang saan mo gusto, sa anumang pagkakasunod-sunod: **Overview**, **Colours**, **Type**, **Logos**, **Tokens**, **Files** at **Usage & rules**. Nag-a-update ang bawat preview sa app habang nagta-type ka. Sinasaklaw ng [Design System Setup](/info/brand-studio.html) ang bawat room.

Iniingatan sa device mo ang mga font. Pumili ng Google Font at ise-save ng Lolly ang file bilang brand asset, kaya sumasama offline ang type mo at walang kinukuha kapag gumuguhit ang tool.

### Tingnan, ilipat at ibahagi ang design system

- **Tingnan ang aktibo.** Ipinapakita ng **Settings → Design system** ang aktibong design system bilang cover at mga pahina, read-only.
- **Lumipat sa pagitan nila.** Inililista ng **Settings → Preferences → Design systems** ang bawat design system sa device na ito. Ang isang organisasyon ay puwedeng magpatakbo ng ilang design system, o isa na may ilang colourway; ipinapakita ng [Brand architectures](/info/brand-architectures.html) ang mga kaayusan.
- **Magbahagi ng isa.** I-export ang design system bilang `LollyBrand` pack: isang file na ii-import ng kasamahan para makuha ang parehong palette, font at patakaran.

Ang design system na ibinigay ng build o organisasyon mo ay **managed**: may lock ito at nananatiling read-only. Para baguhin ang isa, gumawa ng mae-edit na kopya mula sa **Settings → Preferences → Design systems**.

![Ang Design system tab sa Settings: ang aktibong design system bilang cover at mga pahina](/t/url-shot?url=%2F%23%2Fd%3Ftab%3Dbrand&width=1440&height=900&dpi=192&waitMs=1800&format=svg&walker=1&localize=1&dark=1&filename=dashboard-brand&waitSelector=%5Bdata-issue-ready%5D)

Ang design system mo ay mga DTCG token, ang format na binabasa at isinusulat ng Penpot at dinadala ng Tokens Studio sa Figma, kaya iisang dokumento ang palette na dinidisenyo mo at ang palette na inilalapat ng Lolly. Nasa [Design Tokens](/info/design-tokens.html) ang mga detalye.

::: details Para sa mga developer: bumuo ng brand pack mula sa command line
Para magtayo ng magagamit muling brand pack sa checkout, tumatanggap ang `ingest:brand` ng tatlong container na ine-export ng Penpot at Tokens Studio: isang `tokens.json`, isang directory ng mga file bawat set na may `$metadata.json`, o isang `project.penpot` archive.

```bash
pnpm run ingest:brand ./my-tokens.json --name acme --label "Acme" --activate
```

Nire-register ng `--activate` ang brand bilang profile at binubuo at vina-validate ang catalog nito. Hindi nito kailanman binabago ang default na profile: patakbuhin gamit ang `LOLLY_PROFILE=acme` para magamit ang bagong pack. Ipinapaliwanag ng [Configuration](/info/configuration.html) kung paano nagkakasya ang mga brand pack at profile.
:::

## Dalhin ang meron ka na

Hindi ka nagsisimula sa blangkong pahina.

**Mga design file.** Ang tapos nang gawa mula sa Figma, Penpot, Illustrator, InDesign o anumang SVG app ay bumubukas sa Design bilang buhay na layout: nananatiling matatype muli ang text, nananatiling hugis ang mga hugis at napupunta sa library mo ang mga larawan. Binabasa sa browser mo ang file at walang ina-upload. Inililista ng [Import a design](/info/design-import.html) ang bawat format at kung ano ang nadadala.

**Mga deck.** I-drop ang PowerPoint `.pptx` sa Lolly para i-file ang mga slide nito bilang asset, magsulat ng bagong deck mula sa Markdown sa **Markdown Slides**, o gamitin ang [Rebrand a deck](/info/rebrand.html) para ilipat ang buong deck sa design system mo.

**Data.** Mag-paste o mag-drop ng CSV o JSON table at mapupunan mula roon ang mga umuulit na field ng tool, o gumagawa ang [Batch](/info/batch.html#make-many-versions-of-one-design) ng isang tapos na file bawat row.

### Mula sa isang beses lang papuntang template

Ang na-import na layout ay karaniwang Design session. Ginagawa itong tool ng **Share with rules**: pipiliin mo kung aling mga bahagi ang puwedeng baguhin ng ibang tao, at iyon lang ang pupunan nila.

![Panatilihin ang Design master, piliin ang mga input at limitasyon sa authoring copy, saka magbahagi ng magagamit muling .lolly tool na pupunan ng mga tatanggap](/info/diagrams/concepts/share-with-rules.svg)

Ginagabayan ka ng [Share a design with rules](/info/create-a-tool.html) sa bawat hakbang.

## Gumawa ng marami, magbahagi at mag-automate

- <!--i:download--> **I-export.** Gumagawa ang mga tool ng SVG, PDF, PNG, JPG, WebP, video at iba pa, sa mga format na iniaalok ng bawat tool, sa tunay na laki ng print kapag kailangan. Tingnan ang [Mag-export ng file](/info/exporting.html).
- <!--i:link--> **Magbahagi ng link.** Sumasama sa link ang mga setting ng tool, kaya muling binubuksan ng link ang parehong file saanman.
- <!--i:layers--> **Gumawa ng isa bawat row.** Patakbuhin ang tool mula sa spreadsheet sa [Batch](/info/batch.html#make-many-versions-of-one-design).
- <!--i:cpu--> **Mag-automate.** Tumatakbo ang parehong render mula sa [CLI](/info/cli.html) at mula sa [AI agent](/info/ai-agents.html).

Kumpletong request ang isang link. Walang gumuhit sa chart sa ibaba: ang uri, heading at buong data table nito ay tinype sa address bar, at iginuguhit ng parehong link ang parehong chart sa anumang device.

![Isang area chart ng buwanang signup, kung saan ang bawat value ay dumating bilang isang query parameter sa halip na isang click](/t/url-shot?url=%2F%23%2Ftool%2Fchart%3Fct%3Darea%26d%3DMonth%2CSignups%250AJan%2C120%250AFeb%2C180%250AMar%2C265%250AApr%2C340%250AMay%2C455%26t%3DSignups%2520this%2520year%26full&width=1440&height=900&dpi=192&waitMs=2600&cropSelector=%23tool-canvas&walker=1&format=svg&dark=1&filename=vt-d3-url-chart)

## Saan susunod

- <!--i:people--> **[Gumawa](/info/creators.html)**: paggawa, pag-animate, pagre-record, pagbabahagi at pag-export.
- <!--i:code--> **[Mag-automate](/info/builders.html)**: mga design system, pagbuo ng tool, command line, mga link at agent.
- <!--i:usercheck--> **[Mamahala](/info/operators.html)**: pagpapatakbo ng Lolly para sa team gamit ang Lolly Work.
- <!--i:server--> **[I-deploy](/info/operate.html)**: pag-host ng Lolly at Lolly Work.
- <!--i:shieldcheck--> **[Tiwala](/info/trust.html)**: privacy, seguridad at pag-check ng file mismo.
