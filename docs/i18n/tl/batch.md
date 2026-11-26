# Lolly Batch at Lolly Multi-edit

<a id="batch-and-multi-edit"></a>

**Lolly Batch** ang gumagawa ng maraming bersyon ng isang design, tulad ng card sa isang dosenang wika o bawat laki ng banner. Gumagawa ang **Lolly Multi-edit** ng isang pagbabago, tulad ng bagong petsa o headline, sa ilang magkakaibang naka-save na design.

Parehong tumatakbo sa device mo at nag-e-export sa parehong render path ng mga tool.

::: cols
## Batch

- Isang template, maraming row. Bawat row ay isang set ng mga input at gumagawa ng isang file.
- Punan ang mga row sa pamamagitan ng pag-type, pag-paste mula sa spreadsheet o pag-import ng CSV.
- Walang limitasyon sa mga row; 50 ang ipinapakita sa bawat page.
- Bumubukas mula sa **Lolly Batch** sa header ng Projects (`#/batch`).

<a id="multi-edit"></a>
## Lolly Multi-edit

- Dalawa hanggang walong magkakaibang naka-save na design, magkakatabi bilang mga live na card.
- Isang sidebar ang nag-e-edit sa mga pinagsasaluhan nilang input, saka sa sariling input ng bawat card.
- Bawat design ay sine-save pabalik sa pinanggalingan nito.
- Bumubukas mula sa **Edit together** sa selection bar ng Projects.
:::

<!--i:eti-table-->
## Gumawa ng maraming bersyon ng isang design

Buksan ang **Projects** view at pindutin ang **Batch** sa header nito. Nagsisimula ang grid sa isang row. Pumili ng template sa row na iyon, saka i-duplicate ang row o mag-paste ng data mula sa spreadsheet. Kapag binuksan mula sa loob ng folder, ibinabalik ka ng Batch sa folder na iyon.

![Batch sa bagong grid: ang pangalan ng file at mga row tool sa itaas, at ang listahan ng template ng unang row na nakabukas sa mga tool na mapagpipilian mo](/t/url-shot?url=%2F%23%2Fbatch&width=1440&height=900&dpi=192&waitMs=3500&walker=1&format=svg&dark=1&filename=use-batch-toolbar)

**Punan ang mga row.** Mag-type sa cell o mag-paste ng block mula sa Excel, Google Sheets o ibang spreadsheet. Nagdaragdag ng mga row o pinapalitan ng **Import CSV** ang batch. Kapag nag-paste ka sa cell na may mga export setting, tinatanong ng Lolly kung aling input ang pupunan ng bawat na-paste na column. Isinusulat ng **Export CSV** ang grid sa file. Buksan ang **Columns** sa ilalim ng grid para magpakita ng higit pang input, o lapad, taas, unit at DPI sa bawat row. May **Design token** section din ang **Fill** popover ng column na may numero, text o pagpipilian na nagli-link ng isang token sa lahat ng row ng column ([Mag-link ng maraming dokumento nang sabay-sabay](/info/token-workflows.html#link-many-documents-at-once)).

**Itakda ang output.** Itinatakda ng toolbar ang pangalan ng zip file, ang **Default format**, mga unit at DPI para sa bawat row. Ang format menu ang nakagrupong listahan ng export panel ng mga format na inaalok ng catalog at sinusuportahan ng browser mo. Pinapanatili ng row na may sariling format, laki o pangalan ng file ang sarili nitong setting.

**Mag-render.** Ine-export ng **Render all** ang bawat row sa isang `.zip`. Kapag may mga napiling row, sa mga row lang na iyon gumagana ang **Render selected**, **Export selected CSV** at **Print selected rows**. Alisin ang seleksyon para bumalik sa paggawa sa buong batch. Inilalatag ng **Print sheet** ang mga row sa sheet na puwedeng i-print. Iniuulat ng **Batch activity** ang bawat import at render, at puwede itong itiklop.

**Itago ang batch.** Sine-save ng **Sessions** ang bawat row ng grid bilang pinangalanang batch session, anuman ang napili. Muling bumubukas ang session mula sa Projects. Binubuksan ng **Folders…** sa parehong menu ang folder ng Projects bilang mga row, isa sa bawat naka-save na session; dala ng bawat pangalan ng file ang path ng folder nito.

::: details Pagpili ng mga row at cell
Pumili ng mga row gamit ang mga checkbox nito, o mag-Shift-click sa checkbox para sa isang saklaw. Pinipili ng checkbox sa header ang kasalukuyang page, at kinukuha rin ng **Select all *N* rows** ang mga row sa ibang page. Nananatili ang mga seleksyon habang lumilipat ka ng page. Gumagana ang **Edit input**, **Duplicate** at **Remove** sa mga napiling row, at ibinabalik ng **Undo remove** ang mga huling inalis na row. Mula sa naka-focus na cell, pinipili ng Shift+Space ang row na iyon at inaalis ng Escape ang seleksyon.

Mag-drag sa mga cell, mag-Shift-click sa cell o gumamit ng Shift+Arrow key para pumili ng parihaba. Kinokopya ng **Copy cells**, o Ctrl+C / Command+C, ang mga value para sa spreadsheet. Pinipili ng Ctrl+A / Command+A mula sa naka-focus na cell ang bawat nakikitang column sa bawat page; mula sa checkbox ng row, pinipili ng parehong shortcut ang bawat row. Pinapanatili ng pagpili ng mga cell ang tsek ng mga row na may tsek. I-double-click ang cell o pindutin ang Enter para i-edit ang text nito. Mag-paste ng parihaba mula sa clipboard, o mag-paste ng isang value para punan ang bawat napiling cell; pinapanatili ng mga blangkong cell at text na maraming linya ang mga posisyon nila.
:::

### Mga colourway at theme sa bawat row

Pinapanatili ng bawat row ang sarili nitong mga theme choice: light o dark, at colourway kapag mayroon ang design system. Ang row na binuksan mula sa Projects, folder o naka-save na batch ay nagre-render at nagpe-preview gamit ang mga pagpipiliang kasama noong na-save ang session nito. Pinapanatili ang mga ito ng print sheet, na-duplicate na row at napunang row.

Dala ng CSV ang mga pagpipilian sa `_themes` column pagkatapos ng mga column ng laki. Pareho ang JSON ng column at ng `_themes` link parameter, halimbawa `{"":"dark","colourway":"beach"}`. Ang blangkong cell, o `{}`, ay nangangahulugang mga default ng design system. Isinusulat lang ang column kapag may row na may mga pagpipilian. Sa pag-import, inililista bilang isyu ang cell na hindi valid na mga theme choice at nagre-render ang row nito gamit ang mga default.

::: note Itakda ang mga pagpipilian ng row sa CSV
Wala pang kontrol ang grid para baguhin ang mga pagpipilian ng row, kaya itakda ang mga ito sa CSV o sa naka-save na session.
:::

### Wika para sa bawat row

Ang tool na nagpi-print ng sarili nitong mga salita, tulad ng Certificate, ay puwedeng gumamit ng `language` column na may maikling language code tulad ng `de`, `ja` o `ar`. Ipi-print ng bawat row ang mga salita at petsa nito sa wikang iyon. Mula kanan pakaliwa ang layout ng mga Arabic at Urdu na row. Sumusunod sa wika ng app ang blangkong cell. Ang wikang wala pang salin sa Lolly ay nagpi-print sa English, kasama ang petsa, kaya hindi kailanman kalahati lang ang salin ng sertipiko.

### Batch, o Render folder

Para i-render ulit ang mga session na na-save mo na, piliin ang mga ito sa Projects at gamitin ang **Render selection**, o **Render folder** para sa buong folder. Sinasaklaw ng [Hanapin at bawiin ang gawa mo](/info/find-your-work.html#find-something-you-saved) ang pareho.

<!--i:eti-layers-->
## Mag-edit ng ilang naka-save na design nang sabay-sabay

Lagyan ng tsek ang dalawa hanggang walong naka-save na session sa **Projects** at piliin ang **Edit together** mula sa selection bar. Bumubukas ang mga ito nang magkakatabi bilang mga live na card sa `#/multi?s=<slot>,<slot>…`. Bawat card ay tunay na render ng session nito at nagpapakita ng ie-export.

Isang sidebar ang kumokontrol sa lahat:

- <!--i:sliders--> Nauuna ang **Shared**: bawat input na idinedeklara sa parehong paraan ng dalawa o higit pang session (parehong id, uri at mga limitasyon, ang patakarang ginagamit ng batch grid para sa mga column nito). Umaabot ang pagbabago sa pinagsasaluhang kontrol sa bawat session na nagdedeklara ng input, live sa bawat card. Pinagsasaluhan ng dalawang session ng parehong tool ang lahat; pinagsasaluhan lang ng dalawang magkaibang tool ang mga input na pareho sa kanila. Nagli-link ang **Input actions** menu ng Shared card ng design token sa bawat session na nagdedeklara ng input.
- <!--i:document--> Sa ilalim ng Shared card, hawak ng **isang nakatiklop na card sa bawat session** ang lahat ng sariling input ng session na iyon, tulad ng sa sariling sidebar ng tool, na may maliit na export block: **Format**, **W** / **H**, **Unit**, **DPI** at **Download**. Sine-save muna ng Download na iyon ang session, saka nire-render ang file gamit ang parehong pangalan ng file, format at Content Credentials na makukuha nito mula sa tool.
- <!--i:search--> Sinasala ng **Filter inputs…** sa itaas ang mga kontrol sa bawat card nang sabay-sabay.

I-click ang anumang card (o pindutin ang Enter sa card) para buksan ang sidebar card ng session na iyon. Isinusulat ng **Save all** ang bawat session pabalik sa sarili nitong slot. Nagse-save muna ang **Download all**, saka nire-render ang set sa isang zip, tulad ng ginagawa ng **Render selection** sa Projects, at iniaalok ang opsyonal na password lock.

Iginuguhit ang bawat card gamit ang mga theme choice ng sarili nitong session, kasama ang tool na inilagay sa loob ng design. Pinapanatili ng app sa paligid ng mga card ang sarili nitong mga kulay. Pinapanatili ng **Save all**, mga download, **Batch grid** at **Send to Print Sheet** ang mga pagpipilian ng bawat session.

### Mga limitasyon

- **Hanggang walo lang.** Nilo-load ng bawat card ang sarili nitong live runtime, at nananatiling responsive ang walong card. Sinasabi ng link na humihingi ng higit pa, o ng session na wala na, ang problema at hindi ito naglo-load nang bahagya lang.
- **Lokal ang link.** Tinutukoy nito ang sarili mong mga naka-save na slot at muling binubuksan ang set na iyon sa device na ito. Hindi ito share link.
- **Para sa mas malaki,** piliin ang **Edit as sheet** sa parehong selection bar. Binubuksan nito ang seleksyon bilang mga row sa batch grid (`#/batch?s=…`), nang walang limitasyon sa dami at walang patakarang dapat pareho ang tool. Hindi kasama ang mga folder sa pareho: magbukas ng folder sa grid gamit ang **Sessions → Folders…**, o mag-render ng isa gamit ang **Render folder** sa Projects.
- **Hindi naaabot ng Search ang Lolly Multi-edit.** Ito lang ang view na hindi saklaw ng search bar.

<!--i:eti-map-pin-->
## Saan susunod

- **[Mag-export ng file](/info/exporting.html)**: mga format, laki at print setting na magagamit ng bawat row.
- **[Mga template](/info/templates.html)**: mga panimula na magandang gawing unang row.
- **[Hanapin at bawiin ang gawa mo](/info/find-your-work.html)**: Projects, mga folder at pag-render ng na-save mo.
