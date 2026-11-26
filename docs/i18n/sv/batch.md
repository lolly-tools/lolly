# Lolly Batch och Lolly Multi-edit

<a id="batch-and-multi-edit"></a>

**Lolly Batch** gör många versioner av en design, som ett kort på ett dussin språk eller alla storlekar av en banderoll. **Lolly Multi-edit** gör en ändring, som ett nytt datum eller en ny rubrik, i flera olika sparade designer.

Båda körs på din enhet och exporterar genom samma renderingsväg som verktygen.

::: cols
## Batch

- En mall, många rader. Varje rad är en uppsättning indata och ger en fil.
- Fyll raderna genom att skriva, klistra in från ett kalkylblad eller importera en CSV.
- Ingen gräns för antalet rader; 50 visas per sida.
- Öppnas från **Lolly Batch** i rubrikfältet i Projects (`#/batch`).

<a id="multi-edit"></a>
## Lolly Multi-edit

- Två till åtta olika sparade designer, sida vid sida som levande kort.
- En sidopanel redigerar deras gemensamma indata och sedan varje korts egna.
- Varje design sparas tillbaka där den kom ifrån.
- Öppnas från **Edit together** i markeringsfältet i Projects.
:::

<!--i:eti-table-->
## Gör många versioner av en design

Öppna vyn **Projects** och tryck på **Batch** i rubrikfältet. Rutnätet börjar med en rad. Välj en mall på den raden och duplicera sedan raden eller klistra in data från ett kalkylblad. När Batch öppnas inifrån en mapp tar det dig tillbaka till den mappen.

![Batch med ett nytt rutnät: filnamnet och radverktygen överst och den första radens mallista öppen med verktygen du kan välja](/t/url-shot?url=%2F%23%2Fbatch&width=1440&height=900&dpi=192&waitMs=3500&walker=1&format=svg&dark=1&filename=use-batch-toolbar)

**Fyll raderna.** Skriv i en cell eller klistra in ett block från Excel, Google Sheets eller ett annat kalkylblad. **Import CSV** lägger till rader eller ersätter batchen. När du klistrar in i en cell som innehåller exportinställningar frågar Lolly vilken indata varje inklistrad kolumn ska fylla. **Export CSV** skriver ut rutnätet till en fil. Öppna **Columns** under rutnätet för att visa fler indata, eller bredd, höjd, enhet och DPI per rad. Popover-rutan **Fill** för en tal-, text- eller valkolumn har också ett avsnitt **Design token** som länkar en token till alla rader i kolumnen ([Länka många dokument på en gång](/info/token-workflows.html#link-many-documents-at-once)).

**Ställ in utdatan.** Verktygsfältet anger zip-filens filnamn, **Default format**, enheter och DPI för alla rader. Formatmenyn är exportpanelens grupperade lista över de format som katalogen erbjuder och din webbläsare stöder. En rad med eget format, egen storlek eller eget filnamn behåller sin egen inställning.

**Rendera.** **Render all** exporterar alla rader till en `.zip`. Med markerade rader arbetar **Render selected**, **Export selected CSV** och **Print selected rows** bara med de raderna. Rensa markeringen för att arbeta med hela batchen igen. **Print sheet** placerar raderna på ett utskrivbart ark. **Batch activity** rapporterar varje import och rendering och kan fällas ihop.

**Behåll batchen.** **Sessions** sparar alla rader i rutnätet som en namngiven batchsession, oavsett vad som är markerat. Sessionen öppnas igen från Projects. **Folders…** i samma meny öppnar en Projects-mapp som rader, en per sparad session; varje filnamn innehåller sin mappsökväg.

::: details Markera rader och celler
Markera rader med deras kryssrutor eller Shift-klicka på en kryssruta för ett intervall. Kryssrutan i rubrikraden markerar den aktuella sidan och **Select all *N* rows** tar även med raderna på andra sidor. Markeringarna finns kvar när du byter sida. **Edit input**, **Duplicate** och **Remove** arbetar med de markerade raderna och **Undo remove** återställer de senast borttagna raderna. Från en cell med fokus markerar Shift+Space den raden och Escape rensar markeringen.

Dra över celler, Shift-klicka på en cell eller använd Shift+piltangenterna för att markera en rektangel. **Copy cells**, eller Ctrl+C / Command+C, kopierar värdena för ett kalkylblad. Ctrl+A / Command+A från en cell med fokus markerar alla synliga kolumner på alla sidor; från en rads kryssruta markerar samma kortkommando alla rader. När du markerar celler förblir ikryssade rader ikryssade. Dubbelklicka på en cell eller tryck på Enter för att redigera dess text. Klistra in en rektangel från urklipp eller klistra in ett värde för att fylla alla markerade celler; tomma celler och text med flera rader behåller sina positioner.
:::

### Färgvarianter och teman per rad

Varje rad behåller sina egna temaval: ljust eller mörkt och en färgvariant när designsystemet har sådana. En rad som öppnas från Projects, en mapp eller en sparad batch renderas och förhandsvisas med de val som sessionen sparades med. Utskriftsarket, en duplicerad rad och en fylld rad behåller dem.

En CSV innehåller valen i en `_themes`-kolumn efter storlekskolumnerna. Kolumnen har samma JSON som länkparametern `_themes`, till exempel `{"":"dark","colourway":"beach"}`. En tom cell, eller `{}`, betyder designsystemets standardvärden. Kolumnen skrivs bara om någon rad har val. Vid import listas en cell som inte innehåller giltiga temaval som ett problem och dess rad renderas med standardvärdena.

::: note Ställ in en rads val i CSV-filen
Rutnätet har ännu ingen kontroll för att ändra en rads val, så ställ in dem i CSV-filen eller i den sparade sessionen.
:::

### Ett språk för varje rad

Ett verktyg som skriver ut egna formuleringar, som Certificate, kan använda en `language`-kolumn med en kort språkkod som `de`, `ja` eller `ar`. Varje rad skriver då ut sina formuleringar och sitt datum på det språket. Rader på arabiska och urdu läggs ut från höger till vänster. En tom cell följer appens språk. Ett språk som Lolly ännu saknar översättning för skrivs ut på engelska, även datumet, så ett certifikat är aldrig halvöversatt.

### Batch eller Render folder

För att rendera om sessioner som du redan har sparat markerar du dem i Projects och använder **Render selection**, eller **Render folder** för en hel mapp. [Hitta och återställ ditt arbete](/info/find-your-work.html#find-something-you-saved) beskriver båda.

<!--i:eti-layers-->
## Redigera flera sparade designer tillsammans

Kryssa i mellan två och åtta sparade sessioner i **Projects** och välj **Edit together** i markeringsfältet. De öppnas sida vid sida som levande kort på `#/multi?s=<slot>,<slot>…`. Varje kort är en riktig rendering av sin session och visar vad som kommer att exporteras.

En sidopanel styr dem alla:

- <!--i:sliders--> **Shared** kommer först: varje indata som två eller fler sessioner deklarerar på samma sätt (samma id, typ och begränsningar, den regel som batchrutnätet använder för sina kolumner). En ändring av en gemensam kontroll når varje session som deklarerar den indatan, direkt på varje kort. Två sessioner av samma verktyg delar allt; två olika verktyg delar bara sina gemensamma indata. Menyn **Input actions** på Shared-kortet länkar en designtoken i varje session som deklarerar indatan.
- <!--i:document--> Under Shared-kortet innehåller **ett hopfällt kort per session** alla sessionens egna indata, som i verktygets egen sidopanel, med ett kompakt exportblock: **Format**, **W** / **H**, **Unit**, **DPI** och **Download**. Den Download-knappen sparar först sessionen och renderar sedan filen med samma filnamn, format och Content Credentials som den skulle ha från verktyget.
- <!--i:search--> **Filter inputs…** högst upp begränsar vilka kontroller som visas på alla kort samtidigt.

Klicka på valfritt kort (eller tryck på Enter på kortet) för att öppna sessionens kort i sidopanelen. **Save all** skriver tillbaka varje session till dess egen plats. **Download all** sparar först och renderar sedan uppsättningen till en zip-fil, som **Render selection** gör i Projects, och erbjuder ett valfritt lösenordsskydd.

Varje kort ritas med sin egen sessions temaval, även ett verktyg som placerats inuti designen. Appen runt korten behåller sina egna färger. **Save all**, nedladdningarna, **Batch grid** och **Send to Print Sheet** behåller varje sessions val.

### Begränsningar

- **Högst åtta.** Varje kort laddar sin egen levande körmiljö och åtta kort svarar fortfarande snabbt. En länk som begär fler, eller en session som inte längre finns, säger det och laddas inte bara delvis.
- **Länken är lokal.** Den anger dina egna sparade platser och öppnar den uppsättningen igen på den här enheten. Det är ingen delningslänk.
- **För något större** väljer du **Edit as sheet** i samma markeringsfält. Det öppnar markeringen som rader i batchrutnätet (`#/batch?s=…`), utan storleksgräns och utan krav på samma verktyg. Mappar ingår inte i något av alternativen: öppna en mapp i rutnätet med **Sessions → Folders…** eller rendera en med **Render folder** i Projects.
- **Sökningen når inte Lolly Multi-edit.** Det är den enda vyn som sökfältet inte täcker.

<!--i:eti-map-pin-->
## Gå vidare

- **[Exportera en fil](/info/exporting.html)**: formaten, storlekarna och tryckinställningarna som varje rad kan använda.
- **[Mallar](/info/templates.html)**: startpunkter som ger en bra första rad.
- **[Hitta och återställ ditt arbete](/info/find-your-work.html)**: Projects, mappar och rendering av det du sparat.
