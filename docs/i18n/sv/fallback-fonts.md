# Reservtypsnitt

När ett designsystems typsnitt inte kan rita en bokstav ritar Lolly bokstaven med ett öppet Noto-typsnitt, så att exporten behåller bokstaven som en vektorkontur i stället för en bild. Lolly Demos typsnitt, Outfit för rubriker och SUSE för text, saknar kyrilliska, grekiska, arabiska, hebreiska, devanagari-, bengaliska, thailändska, kinesiska, japanska och koreanska tecken.

Designsystemets typsnitt kommer alltid först, i den ordning de listas. Outfit saknar vietnamesiska bokstäver, så en vietnamesisk rubrik hämtar dem från SUSE, nästa typsnitt i Lolly Demos lista. Ett reservtypsnitt ritar bara de tecken som inget av dessa typsnitt kan rita. Ett varumärkestypsnitt behåller varje bokstav, siffra och tecken det har, även kinesiska tecken, också inuti ett ord i ett annat skriftsystem.

<!--i:eti-package-->
## Det som ingår

Femton typsnitt, alla från Google Fonts vid en låst commit. Varje fil visas med sin nedladdningsstorlek.

| Skriftsystem | Typsnitt | Version | Nedladdning |
|---|---|---|---|
| Arabiska, inklusive urdu- och persiska bokstäver | Noto Sans Arabic | 2.012 | 211 KB |
| Hebreiska | Noto Sans Hebrew | 3.001 | 37 KB |
| Devanagari (hindi, marathi, nepalesiska) | Noto Sans Devanagari | 2.007 | 151 KB |
| Bengaliska | Noto Sans Bengali | 3.011 | 139 KB |
| Thailändska | Noto Sans Thai | 2.002 | 62 KB |
| Kyrilliska | Noto Sans, kyrilliska bokstäver | 2.015 | 115 KB, kursiv 132 KB |
| Grekiska | Noto Sans, grekiska bokstäver | 2.015 | 77 KB, kursiv 83 KB |
| Latinska, inklusive vietnamesiska och andra bokstäver med diakritiska tecken | Noto Sans, latinska bokstäver | 2.015 | 316 KB, kursiv 350 KB |
| Förenklad kinesiska, GB 2312-tecknen | Noto Sans SC | 2.004 | 2,0 MB |
| Traditionell kinesiska, Big5-tecknen | Noto Sans TC | 2.004 | 3,8 MB |
| Japanska, Shift_JIS-tecknen | Noto Sans JP | 2.004 | 2,2 MB |
| Koreanska, varje hangulstavelse och KS X 1001-tecknen | Noto Sans KR | 2.004 | 2,5 MB |

Varje typsnitt behåller alla vikter på sin viktaxel, så en fet kinesisk, japansk eller koreansk rubrik blir fet. Noto Sans-typsnitten har sin breddaxel låst till normal, vilket halverar varje fil. De kinesiska, japanska och koreanska typsnitten saknar breddaxel. Noto Sans är uppdelat efter skriftsystem, så ett kyrilliskt ord laddar bara ner de kyrilliska bokstäverna. Konturerna är oförändrade från originalkällan.

::: details Var typsnitten finns och hur de byggs
Typsnitten finns i en gemensam mapp, `community/fallback-fonts`, som levereras till varje designsystem från `/catalog/packs/fallback-fonts/`, precis som emojiuppsättningarna. `scripts/import-fallback-fonts.ts` bygger filerna från originaltypsnitten som är låsta i `scripts/data/fallback-fonts.json`, kontrollerar varje originalfil mot dess registrerade SHA-256 och skriver licenstexterna bredvid typsnitten.
:::

<!--i:eti-globe-->
## Kinesiska, japanska och koreanska

Ett fullständigt kinesiskt, japanskt eller koreanskt typsnitt är 9,6 MB till 17,8 MB. Varje typsnitt begränsas till sin nationella teckenuppsättning plus skiljetecken, kana, fullbreddsformer och symboler för löptext:

- Förenklad kinesiska: GB 2312, de 6 763 vanliga hanzi-tecknen och dess symboler, totalt 7 522 tecken.
- Traditionell kinesiska: Big5, dess 13 053 hanzi-tecken och symboler, totalt 13 629 tecken. Hong Kong Supplementary Character Set ingår inte.
- Japanska: Shift_JIS som Windows och webben läser det, vilket är JIS X 0208 med NEC- och IBM-tilläggen som namn som 髙 och 﨑 behöver, alla kana och katakana i halvbredd, totalt 7 432 tecken.
- Koreanska: alla 11 172 hangulstavelser och KS X 1001, med dess 4 888 hanja-tecken, totalt 17 082 tecken.

Dessa fyra typsnitt utelämnar latinska, grekiska och kyrilliska bokstäver, som designsystemets typsnitt och typsnitten ovan ritar. Uppsättningarna kommer från indexfilerna i Encoding Standard vid en låst commit, så en ombyggnad ger samma filer.

Kinesiska, japanska och koreanska delar de flesta av sina tecken men ritar många av dem olika. 直 skrivs till exempel på ett sätt på kinesiska och ett annat på japanska. Ett textavsnitt tar alla sina gemensamma tecken från ett av dessa typsnitt, aldrig två. Lolly väljer typsnittet i denna ordning:

1. Textavsnittets språk, från `lang` på dess element eller det närmaste omslutande elementet i dokumentet. Ett verktygs språkinställning, till exempel certifikatets Language, anger det. Språket i Lollys eget gränssnitt och designsystemets språk räknas inte, så ett dokument exporteras likadant för alla.
2. Textavsnittets skriftsystem: kana betyder japanska och hangul betyder koreanska. När textavsnittet saknar båda läser Lolly dokumentet, så en rubrik med bara kanji i ett japanskt dokument ritas på japanska. Ett dokument med både kana och hangul avgör inget i detta steg.
3. Ett tecken som bara traditionell kinesiska använder, till exempel 體 eller 說, i textavsnittet eller annars i dokumentet, betyder traditionell kinesiska, om inte samma text också innehåller ett som bara förenklad kinesiska använder.
4. Annars förenklad kinesiska.

Ett tecken som det valda typsnittet saknar hämtas aldrig från något av de andra tre. Det förblir en bild. Kana eller hangul som det valda typsnittet saknar, till exempel koreanska ord på en rad märkt som japanska, kan fortfarande komma från det japanska eller koreanska typsnittet, men bara när det typsnittet inte skulle rita något gemensamt tecken på raden.

På sidan listar en yta med två av dessa språk båda typsnitten, och webbläsaren ritar de gemensamma tecknen med det första. Exporten ritar varje textavsnitt med dess eget.

<!--i:eti-download-->
## När ett typsnitt laddas ner

Inget laddas ner förrän ett dokument innehåller ett tecken som inget typsnitt i dess designsystem kan rita. En symbol på en engelsk rad, till exempel ★ eller ※, laddar aldrig ner ett kinesiskt, japanskt eller koreanskt typsnitt.

Första gången ett dokument behöver ett reservtypsnitt laddar Lolly ner just det typsnittet och behåller det på din enhet. Ett japanskt dokument laddar bara ner det japanska typsnittet på 2,2 MB, och ett på traditionell kinesiska det traditionella typsnittet på 3,8 MB. Därefter ritas skriftsystemet offline, och typsnittet finns kvar när katalogen städas. Typsnittet sparas med katalogens filer, aldrig bland dina uppladdade typsnitt, och visas inte i ditt varumärkes typsnittslista.

Kommandoraden, terminalappen och MCP-servern läser samma filer från disk, så de behöver ingen nedladdning.

<!--i:eti-eye-->
## På sidan och i exporten

Sidan använder samma reservtypsnitt som exporten, så en rad med sådana bokstäver får samma bredd i båda. Bara på den ytan lägger Lolly till reservtypsnittet efter designsystemets egna typsnitt och före alla systemtypsnitt. Ett verktyg som anger en egen typsnittslista i sina stilar eller på sina element får reservtypsnittet på samma plats. En yta som designsystemet täcker behåller sin typsnittslista oförändrad.

Sidan lämnar en typsnittslista orörd när den börjar med ett systemtypsnitt, till exempel `system-ui` eller Helvetica, eftersom exporten ritar den texten med designsystemets typsnitt men sidan inte gör det.

I en PDF blir orden konturer i reservtypsnittet oavsett textinställning, eftersom levande PDF-text inte kan innehålla ett skriftsystem som det inbäddade typsnittet saknar. I SVG, EMF, EPS, DXF och WMF blir de konturer när text konverteras till konturer. När texten hålls levande ritar läsarens egna typsnitt den. När ett reservtypsnitt ritade en del av en export visar exportpanelen en notis som:

> Japansk text ritas med Noto Sans JP, eftersom det här designsystemets typsnitt saknar de bokstäverna.

Kommandoraden skriver samma mening som en notis.

<!--i:eti-image-->
## Det som förblir en bild

Ett tecken utanför de fyra nationella uppsättningarna, till exempel 𠮷 eller ett kompletterande tecken för Hongkong, saknar reservtypsnitt. Sällsynta tecken som 𠮷, tecknen som lagts till för Hongkong genom dess kompletterande uppsättning och skriftsystem utan reservtypsnitt, till exempel tamil, etiopiska eller syriska, behandlas alla på samma sätt. Det gör också ett skriftsystem som tamil, etiopiska eller syriska. I en PDF läggs raden med sådan text in som en bild i 300 dpi, och exportpanelen listar skriftsystemen. I en SVG förblir textavsnittet levande text, som läsarens egna typsnitt ritar.

::: details I EPS-, WMF- och EMF-exporter
En EPS, WMF eller EMF med **Outline fonts** på har ingen levande text att falla tillbaka på, så textavsnittet läggs också in som en bild i 300 dpi. Bilden målar textens färg bara där bokstäverna finns, så bakgrunden syns igenom. Exportpanelen listar skriftsystemen. En bild ritas bara upprätt, så ett roterat eller lutat textavsnitt stoppar exporten med ett meddelande som citerar textavsnittet. I en WMF eller EMF är bilden ett par bitmappsoperationer, en mask och en färgläggning. Microsoft Office och LibreOffice ritar dem som avsett. En app som ignorerar dem, till exempel Inkscape, visar orden på en vit ruta.

En EMF med **Outline fonts** av behåller ett sådant textavsnitt som levande text, som läsarens egna typsnitt ritar. Undantaget är ett textavsnitt som levande EMF-text inte kan innehålla, till exempel text med teckenglesning. Lolly gör konturer av det textavsnittet, så ett textavsnitt som inget typsnitt kan rita läggs in som en bild även där.
:::

::: warning En DXF-export stannar vid text som inget typsnitt kan rita
En DXF går till skärmaskiner och CAD-program som behöver konturer, så ett textavsnitt som inget typsnitt kan rita stoppar en DXF-export. Meddelandet citerar textavsnittet och anger dess skriftsystem. Lägg till ett typsnitt med de bokstäverna eller exportera SVG eller PDF.
:::

<!--i:eti-checklist-->
## Kontrollen före export

Kortet **Before you export** i Lolly Design och `render`-kontrollerna i `lolly check` rapporterar text som inget typsnitt kan rita. De räknar med reservtypsnitten på samma sätt som en export, från samma teckenlistor per typsnitt, så text som ett reservtypsnitt ritar rapporteras inte. Ett skriftsystem utan reservtypsnitt, till exempel tamil, och ett kinesiskt, japanskt eller koreanskt tecken utanför de nationella uppsättningarna rapporteras fortfarande, eftersom exporten ritar dem som en bild eller som levande text, och en DXF-export stannar vid dem. Kontrollen läser listorna från katalogen och laddar inte ner något typsnitt.

<!--i:eti-stamp-->
## Licenser och upphovsangivelser

Varje reservtypsnitt omfattas av SIL Open Font License 1.1. Varje katalogpost registrerar den licensen med en hash av licenstexten, så rättighetsreglerna i [Kreativa rättigheter och upphovsangivelser](/info/creative-rights.html) läser licensen som för vilket annat typsnitt som helst. Licenstexterna finns bredvid typsnitten. Noto Sans-filerna anger inget Reserved Font Name. De kinesiska, japanska och koreanska typsnitten tillhör Adobe och reserverar namnet Source. De begränsade filerna behåller sina Noto-namn, som inte använder det namnet.

Licensen anger att dess villkor inte gäller dokument som skapas med typsnitten. En export innehåller bara konturerna för de bokstäver den använder, precis som med designsystemets egna typsnitt. Lolly lägger inte till något typsnittsprogram, någon upphovsrad eller någon ny post i innehållsintyget för ett reservtypsnitt.
