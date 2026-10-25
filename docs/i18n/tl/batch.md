# Batch at Multi-edit

Dalawang gawain ang lumilitaw kapag madalas kang gumagawa ng parehong uri ng file. Minsan kailangan mo ng maraming bersyon ng isang design: card sa isang dosenang wika, o bawat laki ng banner. Minsan marami kang magkakaibang naka-save na design at gusto mong umabot sa lahat ang isang pagbabago, tulad ng bagong petsa o bagong headline.

Ginagawa ng **Batch** ang una at ginagawa ng **Multi-edit** ang pangalawa. Parehong tumatakbo sa device mo at nag-e-export sa parehong render path ng mga tool mismo.

::: cols
## Batch

- Isang template, maraming row. Ang bawat row ay isang set ng input at gumagawa ng isang file.
- Punan ang mga row sa pagta-type, pag-paste mula sa spreadsheet o pag-import ng CSV.
- Walang limitasyon sa row; 50 ang ipinapakita bawat page.
- Bumubukas mula sa **Batch** sa header ng Projects (`#/batch`).

## Multi-edit

- Dalawa hanggang walong magkakaibang naka-save na design, magkatabi bilang live na card.
- Isang sidebar ang nag-e-edit ng mga input na pinagsasaluhan nila, saka ng sarili ng bawat card.
- Bawat design ay nagse-save pabalik kung saan ito nanggaling.
- Bumubukas mula sa **Edit together** sa selection bar ng Projects.
:::

## Gumawa ng maraming bersyon ng isang design

Buksan ang **Projects** at pindutin ang **Batch** sa header nito. Nagsisimula ang grid sa isang row: pumili ng template dito, saka i-duplicate ang row o i-paste ang data mula sa spreadsheet mo. Kung binuksan mula sa loob ng folder, ibabalik ka ng Batch sa folder na iyon.

![Ang Batch sa bagong grid: ang file name at mga row tool sa itaas, at ang template list ng unang row na nakabukas sa mga tool na mapipili](/t/url-shot?url=%2F%23%2Fbatch&width=1440&height=900&dpi=192&waitMs=3500&walker=1&format=svg&dark=1&filename=use-batch-toolbar)

**Punan ang mga row.** Mag-type sa cell o mag-paste ng block diretso mula sa Excel, Google Sheets o ibang spreadsheet. Ang **Import CSV** ay nagdaragdag ng mga row o pumapalit sa batch. Kapag nag-paste ka sa cell na may hawak na export setting, tinatanong ng Lolly kung aling input ang pupunan ng bawat na-paste na column. Isinusulat pabalik ng **Export CSV** ang grid. Buksan ang **Columns** sa ilalim ng grid para magpakita ng mas maraming input, o lapad, taas, unit at DPI bawat row.

**Itakda ang output.** Itinatakda ng toolbar ang file name ng zip, ang **Default format**, mga unit at DPI para sa bawat row. Ang format menu ay ang pinagpangkat na listahan ng export panel, na nagpapakita ng mga format na iniaalok ng catalogue at sinusuportahan ng browser mo. Ang row na may sariling format, laki o file name ay nag-iingat ng sarili nitong setting.

**I-render.** Ine-export ng **Render all** ang bawat row sa isang `.zip`. Pumili muna ng mga row at kumikilos ang **Render selected**, **Export selected CSV** at **Print selected rows** sa mga iyon lang; i-clear ang seleksyon para gumawa muli sa buong batch. Inilalatag ng **Print sheet** ang mga row sa napi-print na sheet. Iniuulat ng **Batch activity** ang bawat import at render, at tumitiklop para bigyan ng mas maraming espasyo ang table.

**Itago ang batch.** Sine-save ng **Sessions** ang buong grid bilang pinangalanang batch session, na muling bumubukas sa kalaunan mula sa Projects. Laging sine-save ng Sessions ang bawat row, anuman ang napili. Ang **Folders…** sa parehong menu ay nagbubukas ng buong Projects folder bilang mga row, isa bawat naka-save na session, na ang bawat file name ay may dalang folder path nito.

::: details Pagpili ng mga row at cell
Pumili ng mga row gamit ang mga checkbox nila, o Shift-click ng checkbox para sa saklaw. Pinipili ng header checkbox ang kasalukuyang page, at ang **Select all *N* rows** ay kinukuha rin ang mga row sa ibang page. Nananatili ang mga seleksyon habang lumilipat ka sa pagitan ng mga page. Ang **Edit input**, **Duplicate** at **Remove** ay kumikilos sa mga napiling row, at ibinabalik ng **Undo remove** ang huling inalis na mga row. Mula sa cell na may focus, pinipili ng Shift+Space ang row na iyon at nililinis ng Escape ang seleksyon.

Mag-drag sa mga cell, mag-Shift-click ng cell o gamitin ang Shift+Arrow key para pumili ng parihaba. Kinokopya ng **Copy cells**, o Ctrl+C / Command+C, ang mga value para sa spreadsheet. Ang Ctrl+A / Command+A mula sa cell na may focus ay pumipili ng bawat nakikitang column sa bawat page; mula sa row checkbox, pinipili ng parehong shortcut ang bawat row. Ang pagpili ng mga cell ay iniiwang naka-tsek ang mga naka-tsek na row. I-double-click ang cell o pindutin ang Enter para i-edit ang text nito. Mag-paste ng parihaba mula sa clipboard, o mag-paste ng isang value para punan ang bawat napiling cell; nananatili ang posisyon ng mga blangkong cell at multiline na text.
:::

### Mga colourway at theme bawat row

Bawat row ay nag-iingat ng sarili nitong mga pagpili sa theme: light o dark, at colourway kapag mayroon ang design system. Ang row na binuksan mula sa Projects, folder o naka-save na batch ay nagre-render sa mga pagpiling pinag-save-an ng session nito, at bumubukas ang preview nito sa mga iyon. Ang print sheet, na-duplicate na row at napunan na row ay pawang nag-iingat sa mga ito.

Dala ng CSV ang mga pagpili sa column na `_themes` pagkatapos ng mga size column, na may hawak na parehong JSON ng `_themes` link parameter, halimbawa `{"":"dark","colourway":"beach"}`. Ang blangkong cell, o `{}`, ay nangangahulugang mga default ng design system. Isinusulat lang ang column kapag may row na may mga pagpili, kaya ang batch na wala ay nag-e-export ng parehong CSV tulad ng dati. Sa pag-import, ang cell na hindi wastong theme choice ay inililista bilang isyu at ang row nito ay nagre-render sa mga default. Wala pang kontrol ang grid para baguhin ang mga pagpili ng row, kaya itakda ang mga ito sa CSV o sa naka-save na session.

### Batch, o Render folder

Gumagawa ang Batch ng maraming variant ng isang template. Para muling i-render ang mga session na na-save mo na, piliin ang mga ito sa Projects at gamitin ang **Render selection**, o **Render folder** para sa buong folder; sinasaklaw ng [Hanapin at bawiin ang gawa mo](/info/find-your-work.html#find-something-you-saved) ang pareho.

## Mag-edit ng ilang naka-save na design nang sabay

I-tsek ang dalawa hanggang walong naka-save na session sa **Projects** at piliin ang **Edit together** mula sa selection bar. Bumubukas ang mga ito nang magkatabi bilang live na card sa `#/multi?s=<slot>,<slot>…`. Ang bawat card ay tunay na render ng session nito, kaya ang nakikita mo ang ie-export.

Isang sidebar ang nagmamaneho sa lahat:

- <!--i:sliders--> Una ang **Shared**: bawat input na dineklara sa parehong paraan ng dalawa o higit pang session (parehong id, parehong uri, parehong constraint, ang rule na ginagamit ng batch grid para sa mga column nito). I-edit nang minsan ang shared na kontrol at aabot ang value sa bawat session na nagdedeklara ng input, live sa bawat card. Ang dalawang session ng parehong tool ay nagbabahagi ng lahat; ang dalawang magkaibang tool ay nagbabahagi lang ng mga input na pareho sila.
- <!--i:document--> Sa ibaba nito, hawak ng **isang nakatiklop na card bawat session** ang lahat ng sariling input ng session na iyon, kasing-kumpleto ng sariling sidebar ng tool, na may compact na export block: **Format**, **W** / **H**, **Unit**, **DPI** at **Download**. Sine-save muna ng Download na iyon ang session, saka nire-render ang file na may parehong file name, format at Content Credentials na makukuha nito mula sa tool.
- <!--i:search--> Ang **Filter inputs…** sa itaas ay pinapakitid ang mga kontrol sa bawat card nang sabay, kaya maaabot mo ang "ang headline" sa walong session nang hindi nag-i-scroll.

Mag-click ng anumang card (o pindutin ang Enter dito) para buksan ang sidebar card ng session na iyon. Isinusulat pabalik ng **Save all** ang bawat session sa sarili nitong slot. Ang **Download all** ay nagse-save muna, saka nire-render ang buong set sa isang zip, sa parehong paraan ng **Render selection** sa Projects, na may opsyonal na password lock na iniaalok sa daan.

Gumuguhit ang bawat card sa mga theme choice ng sarili nitong session, kasama ang tool na inilagay sa loob ng design. Magkatabi ang mga card na magkakaiba ang itsura habang nananatili ang sariling kulay ng app sa paligid nila, at pinapanatili ng **Save all**, mga download, **Batch grid** at **Send to Print Sheet** ang mga pagpili ng bawat session.

### Mga limitasyon

- **Walo ang pinakamarami.** Bawat card ay nagma-mount ng sarili nitong live runtime, at ang walo ang bilang na nananatiling responsive. Ang link na humihingi ng higit, o ng session na wala na, ay nagsasabi nito sa halip na bahagyang mag-load.
- **Lokal ang link.** Pinangangalanan nito ang sarili mong mga naka-save na slot, kaya muling binubuksan nito ang set na iyon sa device na ito. Hindi ito share link.
- **Para sa anumang mas malaki,** piliin ang **Edit as sheet** sa parehong selection bar. Binubuksan nito ang buong seleksyon bilang mga row sa batch grid (`#/batch?s=…`), na walang limitasyon sa laki at walang same-tool na rule. Wala ang mga folder sa pareho: magbukas ng folder sa grid gamit ang **Sessions → Folders…**, o i-render ang isa gamit ang **Render folder** sa Projects.
- **Hindi umaabot ang Search sa Multi-edit.** Ito ang nag-iisang view na hindi alam ng search bar.

## Saan susunod

- **[Mag-export ng file](/info/exporting.html)**: ang mga format, laki at print setting na magagamit ng bawat row.
- **[Mga template](/info/templates.html)**: mga panimulang punto na gumagawa ng magandang unang row.
- **[Hanapin at bawiin ang gawa mo](/info/find-your-work.html)**: Projects, mga folder at pag-render ng na-save mo.
