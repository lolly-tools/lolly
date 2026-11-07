# Reservtypsnitt

Ett designsystems typsnitt täcker ofta bara några av världens skriftsystem. Lolly Demo sätter rubriker i Outfit och text i SUSE, och inget av dem har kyrilliska, grekiska, arabiska, hebreiska, devanagari-, bengaliska, thailändska, kinesiska, japanska eller koreanska tecken. När ett dokument innehåller tecken som designsystemets typsnitt inte kan rita, ritar Lolly dem med ett öppet Noto-typsnitt, så att exporten behåller dem som vektorkonturer i stället för att göra orden till en bild.

Designsystemets typsnitt kommer alltid först, i den ordning designsystemet listar dem. Outfit saknar vietnamesiska tecken, så en vietnamesisk rubrik hämtar dem från SUSE, nästa typsnitt i Lolly Demos lista. Ett reservtypsnitt ritar bara de tecken som inget av de typsnitten kan rita, så ett varumärkestypsnitt behåller varje bokstav, siffra och tecken det har, även inne i ett ord på ett annat skriftsystem. Ett varumärkestypsnitt som har ett kinesiskt tecken behåller också det tecknet.

## Vad som ingår

Femton typsnitt, alla från Google Fonts vid en fastlåst commit och alla under SIL Open Font License 1.1. Varje fil visas med sin nedladdningsstorlek.

| Skriftsystem | Typsnitt | Version | Nedladdning |
|---|---|---|---|
| Arabiska, inklusive urdu- och persiska tecken | Noto Sans Arabic | 2.012 | 206 KB |
| Hebreiska | Noto Sans Hebrew | 3.001 | 37 KB |
| Devanagari (hindi, marathi, nepali) | Noto Sans Devanagari | 2.007 | 147 KB |
| Bengaliska | Noto Sans Bengali | 3.011 | 136 KB |
| Thailändska | Noto Sans Thai | 2.002 | 61 KB |
| Kyrilliska | Noto Sans, kyrilliska tecken | 2.015 | 112 KB, kursiv 129 KB |
| Grekiska | Noto Sans, grekiska tecken | 2.015 | 75 KB, kursiv 81 KB |
| Latinska, inklusive vietnamesiska och andra accenttecken | Noto Sans, latinska tecken | 2.015 | 309 KB, kursiv 342 KB |
| Förenklad kinesiska, GB 2312-tecknen | Noto Sans SC | 2.004 | 1,9 MB |
| Traditionell kinesiska, Big5-tecknen | Noto Sans TC | 2.004 | 3,6 MB |
| Japanska, Shift_JIS-tecknen | Noto Sans JP | 2.004 | 2,1 MB |
| Koreanska, varje hangulstavelse och KS X 1001-tecknen | Noto Sans KR | 2.004 | 2,4 MB |

Varje typsnitts viktaxel behålls hel, så varje vikt en design ber om ritas fortfarande, och en fetstilt kinesisk, japansk eller koreansk rubrik är fetstilt. Breddaxeln hos Noto Sans-typsnitten är låst till normal, vilket halverar varje fil; de kinesiska, japanska och koreanska typsnitten har ingen breddaxel. Noto Sans är delat per skriftsystem, så ett kyrilliskt ord laddar bara ner de kyrilliska tecknen. Konturerna är upphovstypsnittens konturer, oförändrade.

Typsnitten ligger i en delad mapp, `community/fallback-fonts`, som serveras till varje designsystem från `/catalog/packs/fallback-fonts/`, på samma sätt som emojiuppsättningarna delas. `scripts/import-fallback-fonts.ts` bygger filerna från upphovstypsnitten som är fastlåsta i `scripts/data/fallback-fonts.json`, kontrollerar varje upphovsfil mot dess registrerade SHA-256 och skriver licenstexterna bredvid typsnitten.

## Kinesiska, japanska och koreanska

Ett helt kinesiskt, japanskt eller koreanskt typsnitt är 9,6 MB till 17,8 MB, så vart och ett av dessa typsnitt är skuret till den nationella teckenuppsättning som dess läsare använder dagligen, plus skiljetecken, kana, fullbreddsformer och symboler i löpande text:

- Förenklad kinesiska: GB 2312, de 6 763 vanliga hanzi och dess symboler, 7 522 tecken sammanlagt.
- Traditionell kinesiska: Big5, dess 13 053 hanzi och dess symboler, 13 629 tecken sammanlagt. Hongkongs kompletterande teckenuppsättning ingår inte.
- Japanska: Shift_JIS så som Windows och webben läser den, vilket är JIS X 0208 med de tillägg från NEC och IBM som namn som 髙 och 﨑 behöver, all kana och halvbreddskatakana, 7 432 tecken sammanlagt.
- Koreanska: alla 11 172 hangulstavelser och KS X 1001, med dess 4 888 hanja, 17 082 tecken sammanlagt.

Latinska, grekiska och kyrilliska tecken lämnas utanför dessa fyra typsnitt, eftersom designsystemets typsnitt och typsnitten ovan ritar dem. Uppsättningarna läses ur Encoding Standards indexfiler vid en fastlåst commit, så en ombyggnad ger samma filer.

Kinesiska, japanska och koreanska delar de flesta av sina tecken, men var och en ritar många av dem olika. Samma tecken 直 skrivs på ett sätt på kinesiska och på ett annat på japanska. Därför hämtar en textsekvens alla sina delade tecken från ett av dessa typsnitt, aldrig från två, och Lolly väljer typsnittet i den här ordningen:

1. Sekvensens språk, från `lang` på dess element eller det närmaste omgivande i dokumentet. Ett verktygs språkinställning, som certifikatets Language, sätter det. Språket i Lollys eget gränssnitt och designsystemets språk räknas inte, så ett dokument exporteras likadant för alla.
2. Sekvensens skriftsystem: kana betyder japanska och hangul betyder koreanska. När sekvensen själv har ingetdera läses hela dokumentet, så en rubrik med bara kanji i ett japanskt dokument ritas på japanska. Ett dokument som innehåller både kana och hangul avgör ingenting här.
3. Ett tecken som bara traditionell kinesiska använder, som 體 eller 說, i sekvensen eller annars i dokumentet, betyder traditionell kinesiska, såvida inte samma text också innehåller ett som bara förenklad kinesiska använder.
4. Annars förenklad kinesiska.

Ett tecken som det valda typsnittet saknar hämtas aldrig från ett av de andra tre. Det förblir en bild, som beskrivs nedan. Kana eller hangul som det valda typsnittet saknar, som koreanska ord på en rad markerad som japansk, kan ändå komma från det japanska eller koreanska typsnittet, men bara när det typsnittet inte skulle rita något delat tecken på raden.

På sidan listar en yta med två av dessa språk båda typsnitten, och webbläsaren ritar de delade tecknen med det första. Exporten ritar varje sekvens med sitt eget.

## När ett typsnitt laddas ner

Inget laddas ner förrän ett dokument innehåller ett tecken som inget av designsystemets typsnitt kan rita. Ett dokument på engelska, eller på något språk som designsystemet täcker, laddar aldrig ner ett reservtypsnitt. En symbol på en engelsk rad, som ★ eller ※, laddar aldrig ner ett kinesiskt, japanskt eller koreanskt typsnitt.

Första gången ett dokument behöver ett laddar Lolly ner just det typsnittet, för just det skriftsystemet, och behåller det på din enhet. Ett japanskt dokument laddar ner bara det japanska typsnittet, 2,1 MB, och ett traditionellt kinesiskt det traditionella typsnittet på 3,6 MB. Därefter ritas skriftsystemet offline, och typsnittet finns kvar när katalogen städas upp. Typsnittet förvaras bland katalogens egna filer, aldrig bland typsnitten du laddat upp, så det syns inte i ditt varumärkes typsnittslista.

Kommandoraden, terminalappen och MCP-servern läser samma filer från disk, så de behöver ingen nedladdning.

## På sidan och i exporten

Sidan använder samma reservtypsnitt som exporten. Utan det ritar en webbläsare sådana tecken i ett systemtypsnitt medan exporten använder Noto, och en rad som innehåller dem byter bredd mellan de två. Lolly lägger till reservtypsnittet sist i designsystemets typsnittslista, på den ytan enbart, efter designsystemets egna typsnitt och före alla systemtypsnitt. Ett verktyg som anger en egen typsnittslista, i sina stilar eller på sina element, får reservtypsnittet på samma plats: efter de typsnitt listan anger och före alla systemtypsnitt. En yta som designsystemet täcker behåller sin typsnittslista exakt som förut.

Sidan lämnar en typsnittslista orörd när den börjar med ett systemtypsnitt, som `system-ui` eller Helvetica, eftersom exporten ritar den texten med designsystemets typsnitt och sidan gör det inte.

I en PDF blir orden konturer ritade med reservtypsnittet, vilken textinställning du än väljer, eftersom levande PDF-text inte kan bära ett skriftsystem som det inbäddade typsnittet saknar. I SVG, EMF, EPS, DXF och WMF blir de konturer närhelst text omvandlas till konturer; med text som hålls levande ritar läsarens egna typsnitt dem, som förut. När ett reservtypsnitt ritat en del av en export visar exportpanelen en notis som:

> Japansk text ritas med Noto Sans JP, eftersom det här designsystemets typsnitt inte har de tecknen.

Kommandoraden skriver ut samma mening som en notis.

## Vad som förblir en bild

Ett tecken utanför de fyra nationella uppsättningarna har inget reservtypsnitt. Sällsynta tecken som 𠮷, tecknen som Hongkong lagt till med sin kompletterande uppsättning, och skriftsystem utan reservtypsnitt, som tamil, etiopiska eller syriska, behandlas alla på samma sätt. I en PDF läggs raden som innehåller ett in som en bild på 300 dpi, och exportpanelen listar skriftsystemen. I en SVG förblir sekvensen levande text, som läsarens egna typsnitt ritar.

## Kontrollen före export

Lolly Designs kort **Before you export**, och `render`-kontrollerna i `lolly check`, rapporterar text som inget typsnitt kan rita. De räknar reservtypsnitten på samma sätt som en export, utifrån samma listor över tecknen varje typsnitt har, så text som ett reservtypsnitt ritar rapporteras inte. Ett skriftsystem utan reservtypsnitt, som tamil, och ett kinesiskt, japanskt eller koreanskt tecken utanför de nationella uppsättningarna rapporteras fortfarande, eftersom exporten ritar dem som en bild eller som levande text. Kontrollen läser listorna från katalogen och laddar inte ner något typsnitt.

## Licenser och krediter

Varje reservtypsnitt står under SIL Open Font License 1.1, och varje katalogpost registrerar den licensen med en hash av licenstexten, så att rättighetsreglerna i [Kreativa rättigheter och krediter](/info/creative-rights.html) läser licensen som vilket annat typsnitts som helst. Licenstexterna ligger bredvid typsnitten. Noto Sans-filerna anger inget Reserved Font Name. De kinesiska, japanska och koreanska typsnitten är Adobes och reserverar namnet Source; de skurna filerna behåller sina Noto-namn, som inte använder det namnet.

Licensen säger att dess villkor inte gäller dokument som gjorts med typsnitten. En export innehåller bara de ritade konturerna av de tecken den använder, som för designsystemets egna typsnitt, och Lolly lägger inte till något typsnittsprogram, ingen kreditrad och ingen ny post i content credentialen för ett reservtypsnitt.
