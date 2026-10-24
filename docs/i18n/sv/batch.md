# Batch och Multi-edit

Två jobb dyker upp när du ofta gör samma sorts fil. Ibland behöver du många versioner av en design: ett kort på ett dussin språk, eller varje storlek av en banner. Ibland har du flera olika sparade designer och vill att en ändring ska nå alla, till exempel ett nytt datum eller en ny rubrik.

**Batch** gör det första jobbet och **Multi-edit** det andra. Båda körs på din enhet och exporterar genom samma renderingsväg som verktygen själva.

::: cols
## Batch

- En mall, många rader. Varje rad är en uppsättning indata och gör en fil.
- Fyll raderna genom att skriva, klistra in från ett kalkylblad eller importera en CSV.
- Ingen gräns för rader; 50 visas per sida.
- Öppnas från **Batch** i rubriken för Projects (`#/batch`).

## Multi-edit

- Två till åtta olika sparade designer, sida vid sida som levande kort.
- Ett sidofält redigerar indata som de delar, sedan varje korts egna.
- Varje design sparas tillbaka dit den kom ifrån.
- Öppnas från **Edit together** i urvalsfältet i Projects.
:::

## Gör många versioner av en design

Öppna **Projects** och tryck på **Batch** i dess rubrik. Rutnätet börjar med en rad: välj en mall i den och duplicera sedan raden eller klistra in data från ditt kalkylblad. Om Batch öppnats inifrån en mapp tar det dig tillbaka till den mappen.

![Batch på ett nytt rutnät: filnamnet och radverktygen längs toppen, och den första radens mallista öppen på de verktyg du kan välja](/t/url-shot?url=%2F%23%2Fbatch&width=1440&height=900&dpi=192&waitMs=3500&walker=1&format=svg&dark=1&filename=use-batch-toolbar)

**Fyll raderna.** Skriv i en cell eller klistra in ett block direkt från Excel, Google Sheets eller ett annat kalkylblad. **Import CSV** lägger till rader eller ersätter batchen. När du klistrar in i en cell som håller exportinställningar frågar Lolly vilken indata varje inklistrad kolumn fyller. **Export CSV** skriver ut rutnätet igen. Öppna **Columns** under rutnätet för att visa fler indata, eller bredd, höjd, enhet och DPI per rad.

**Ställ in utdatan.** Verktygsfältet anger zippens filnamn, **Default format**, enheter och DPI för varje rad. Formatmenyn är exportpanelens grupperade lista och visar de format som katalogen erbjuder och din webbläsare stöder. En rad med eget format, egen storlek eller eget filnamn behåller sin egen inställning.

**Rendera.** **Render all** exporterar varje rad till en `.zip`. Markera rader först så verkar **Render selected**, **Export selected CSV** och **Print selected rows** bara på dem; rensa markeringen för att arbeta på hela batchen igen. **Print sheet** lägger ut raderna på ett utskrivbart ark. **Batch activity** rapporterar varje import och rendering, och viks undan för att ge tabellen mer plats.

**Behåll batchen.** **Sessions** sparar hela rutnätet som en namngiven batchsession, som öppnas igen senare från Projects. Sessions sparar alltid varje rad, oavsett vad som är markerat. **Folders…** i samma meny öppnar en hel Projects-mapp som rader, en per sparad session, där varje filnamn bär sin mappsökväg.

::: details Markera rader och celler
Markera rader med deras kryssrutor, eller Shift-klicka en kryssruta för ett intervall. Kryssrutan i rubriken markerar den aktuella sidan, och **Select all *N* rows** tar med raderna på andra sidor också. Markeringar finns kvar när du går mellan sidor. **Edit input**, **Duplicate** och **Remove** verkar på de markerade raderna, och **Undo remove** återställer raderna som togs bort senast. Från en cell i fokus markerar Shift+Space den raden och Escape rensar markeringen.

Dra över celler, Shift-klicka en cell eller använd Shift+piltangenter för att markera en rektangel. **Copy cells**, eller Ctrl+C / Command+C, kopierar värdena för ett kalkylblad. Ctrl+A / Command+A från en cell i fokus markerar varje synlig kolumn på varje sida; från en radkryssruta markerar samma genväg varje rad. Att markera celler låter ikryssade rader förbli ikryssade. Dubbelklicka på en cell eller tryck Enter för att redigera dess text. Klistra in en rektangel från urklipp, eller klistra in ett värde för att fylla varje markerad cell; tomma celler och text med flera rader behåller sina positioner.
:::

### Färgvarianter och teman per rad

Varje rad behåller sina egna temaval: ljust eller mörkt, och en färgvariant när designsystemet har sådana. En rad som öppnats från Projects, en mapp eller en sparad batch renderas i de val som dess session sparades med, och dess förhandsvisning öppnas i dem. Utskriftsarket, en duplicerad rad och en ifylld rad behåller dem alla.

En CSV bär valen i en kolumn `_themes` efter storlekskolumnerna, med samma JSON som länkparametern `_themes`, till exempel `{"":"dark","colourway":"beach"}`. En tom cell, eller `{}`, betyder designsystemets standardvärden. Kolumnen skrivs bara när någon rad har val, så en batch utan några exporterar samma CSV som förut. Vid import listas en cell som inte är giltiga temaval som ett problem och dess rad renderas med standardvärdena. Rutnätet har ännu ingen kontroll för att ändra en rads val, så sätt dem i CSV:n eller i den sparade sessionen.

### Batch, eller Render folder

Batch gör många varianter av en mall. För att rendera om sessioner du redan sparat markerar du dem i Projects och använder **Render selection**, eller **Render folder** för en hel mapp; [Hitta och återställ ditt arbete](/info/find-your-work.html#find-something-you-saved) beskriver båda.

## Redigera flera sparade designer tillsammans

Kryssa i mellan två och åtta sparade sessioner i **Projects** och välj **Edit together** i urvalsfältet. De öppnas sida vid sida som levande kort på `#/multi?s=<slot>,<slot>…`. Varje kort är en riktig rendering av sin session, så det du ser är det som kommer att exporteras.

Ett sidofält styr dem alla:

- <!--i:sliders--> **Shared** kommer först: varje indata som två eller fler av sessionerna deklarerar på samma sätt (samma id, samma typ, samma begränsningar, regeln som batchrutnätet använder för sina kolumner). Redigera en delad kontroll en gång så når värdet varje session som deklarerar indatan, live på varje kort. Två sessioner av samma verktyg delar allt; två olika verktyg delar bara de indata de har gemensamt.
- <!--i:document--> Under den håller **ett hopfällt kort per session** alla den sessionens egna indata, lika kompletta som verktygets eget sidofält, med ett kompakt exportblock: **Format**, **W** / **H**, **Unit**, **DPI** och **Download**. Den Download sparar sessionen först och renderar sedan filen med samma filnamn, format och Content Credentials som den skulle få från verktyget.
- <!--i:search--> **Filter inputs…** överst begränsar kontrollerna på alla kort samtidigt, så att du når "rubriken" i åtta sessioner utan att rulla.

Klicka på valfritt kort (eller tryck Enter på det) för att öppna den sessionens sidofältskort. **Save all** skriver tillbaka varje session till sin egen plats. **Download all** sparar först och renderar sedan hela uppsättningen till en zip, på samma sätt som **Render selection** gör i Projects, med det valfria lösenordslåset erbjudet på vägen.

Varje kort ritas i sin egen sessions temaval, inklusive ett verktyg placerat inuti designen. Kort i olika utseenden sitter sida vid sida medan appen runt dem behåller sina egna färger, och **Save all**, nedladdningarna, **Batch grid** och **Send to Print Sheet** behåller varje sessions val.

### Gränser

- **Högst åtta.** Varje kort monterar sin egen levande körmiljö, och åtta är antalet som förblir responsivt. En länk som ber om fler, eller om en session som inte längre finns, säger det i stället för att halvladda.
- **Länken är lokal.** Den namnger dina egna sparade platser, så den öppnar den uppsättningen igen på den här enheten. Den är inte en delningslänk.
- **För något större** väljer du **Edit as sheet** i samma urvalsfält. Det öppnar hela urvalet som rader i batchrutnätet (`#/batch?s=…`), utan storleksgräns och utan regeln om samma verktyg. Mappar förblir utanför båda: öppna en mapp i rutnätet med **Sessions → Folders…**, eller rendera en med **Render folder** i Projects.
- **Sökningen når inte Multi-edit.** Det är den enda vy som sökfältet inte känner till.

## Vart du ska gå härnäst

- **[Exportera en fil](/info/exporting.html)**: formaten, storlekarna och utskriftsinställningarna varje rad kan använda.
- **[Mallar](/info/templates.html)**: startpunkter som gör en bra första rad.
- **[Hitta och återställ ditt arbete](/info/find-your-work.html)**: Projects, mappar och rendering av det du sparat.
