# Reservelettertypen

Wanneer de lettertypen van een design system een letter niet kunnen tekenen, tekent Lolly de letter met een open Noto-lettertype, zodat de export de letter als vectorcontour behoudt in plaats van als afbeelding. De lettertypen van Lolly Demo, Outfit voor koppen en SUSE voor tekst, hebben geen Cyrillische, Griekse, Arabische, Hebreeuwse, Devanagari-, Bengaalse, Thaise, Chinese, Japanse of Koreaanse letters.

De lettertypen van het design system komen altijd eerst, in de opgegeven volgorde. Outfit heeft geen Vietnamese letters, dus haalt een Vietnamese kop die uit SUSE, het volgende lettertype in de lijst van Lolly Demo. Een reservelettertype tekent alleen de tekens die geen van die lettertypen kan tekenen. Een merklettertype behoudt elke letter, elk cijfer en elk teken dat het heeft, ook Chinese tekens, zelfs binnen een woord in een ander schrift.

<!--i:eti-package-->
## Wat er wordt meegeleverd

Vijftien lettertypen, allemaal uit Google Fonts op een vastgezette commit. Bij elk bestand staat de downloadgrootte.

| Schrift | Lettertype | Versie | Download |
|---|---|---|---|
| Arabisch, inclusief Urdu- en Perzische letters | Noto Sans Arabic | 2.012 | 211 KB |
| Hebreeuws | Noto Sans Hebrew | 3.001 | 37 KB |
| Devanagari (Hindi, Marathi, Nepalees) | Noto Sans Devanagari | 2.007 | 151 KB |
| Bengaals | Noto Sans Bengali | 3.011 | 139 KB |
| Thais | Noto Sans Thai | 2.002 | 62 KB |
| Cyrillisch | Noto Sans, Cyrillische letters | 2.015 | 115 KB, cursief 132 KB |
| Grieks | Noto Sans, Griekse letters | 2.015 | 77 KB, cursief 83 KB |
| Latijns, inclusief Vietnamese en andere letters met accenten | Noto Sans, Latijnse letters | 2.015 | 316 KB, cursief 350 KB |
| Vereenvoudigd Chinees, de GB 2312-tekens | Noto Sans SC | 2.004 | 2,0 MB |
| Traditioneel Chinees, de Big5-tekens | Noto Sans TC | 2.004 | 3,8 MB |
| Japans, de Shift_JIS-tekens | Noto Sans JP | 2.004 | 2,2 MB |
| Koreaans, elke Hangul-lettergreep en de KS X 1001-tekens | Noto Sans KR | 2.004 | 2,5 MB |

Elk lettertype behoudt elk gewicht op zijn gewichtsas, zodat een vette Chinese, Japanse of Koreaanse kop vet is. Bij de Noto Sans-lettertypen staat de breedteas vast op normaal, wat elk bestand halveert. De Chinese, Japanse en Koreaanse lettertypen hebben geen breedteas. Noto Sans is opgesplitst per schrift, zodat een Cyrillisch woord alleen de Cyrillische letters downloadt. De contouren zijn ongewijzigd ten opzichte van de bron.

::: details Waar de lettertypen staan en hoe ze worden opgebouwd
De lettertypen staan in één gedeelde map, `community/fallback-fonts`, die aan elk design system wordt aangeboden vanuit `/catalog/packs/fallback-fonts/`, net als de emojisets. `scripts/import-fallback-fonts.ts` bouwt de bestanden vanuit de bronlettertypen die in `scripts/data/fallback-fonts.json` zijn vastgezet, controleert elk bronbestand tegen zijn vastgelegde SHA-256 en schrijft de licentieteksten naast de lettertypen.
:::

<!--i:eti-globe-->
## Chinees, Japans en Koreaans

Een volledig Chinees, Japans of Koreaans lettertype is 9,6 MB tot 17,8 MB. Elk wordt teruggebracht tot zijn nationale tekenset, plus de leestekens, kana, vormen van volledige breedte en symbolen van lopende tekst:

- Vereenvoudigd Chinees: GB 2312, de 6.763 gangbare hanzi en bijbehorende symbolen, in totaal 7.522 tekens.
- Traditioneel Chinees: Big5, de 13.053 hanzi en bijbehorende symbolen, in totaal 13.629 tekens. De Hong Kong Supplementary Character Set is niet inbegrepen.
- Japans: Shift_JIS zoals Windows en het web het lezen, dat wil zeggen JIS X 0208 met de NEC- en IBM-toevoegingen die namen zoals 髙 en 﨑 nodig hebben, alle kana en de katakana van halve breedte, in totaal 7.432 tekens.
- Koreaans: alle 11.172 Hangul-lettergrepen en KS X 1001, met zijn 4.888 hanja, in totaal 17.082 tekens.

Deze vier lettertypen laten Latijnse, Griekse en Cyrillische letters weg, die de lettertypen van het design system en de bovenstaande lettertypen tekenen. De sets komen uit de indexbestanden van de Encoding Standard op een vastgezette commit, zodat opnieuw opbouwen dezelfde bestanden oplevert.

Chinees, Japans en Koreaans delen de meeste tekens, maar tekenen er veel verschillend. 直 wordt bijvoorbeeld in het Chinees op de ene manier geschreven en in het Japans op een andere. Een tekstsegment haalt al zijn gedeelde tekens uit één van deze lettertypen, nooit uit twee. Lolly kiest dat lettertype in deze volgorde:

1. De taal van het segment, uit de `lang` van zijn element of het dichtstbijzijnde omvattende element in het document. De taalinstelling van een tool, zoals Language bij het certificaat, stelt dit in. De taal van de eigen interface van Lolly en de taal van het design system tellen niet mee, zodat een document voor iedereen hetzelfde wordt geëxporteerd.
2. Het schrift van het segment: kana betekent Japans en Hangul betekent Koreaans. Wanneer het segment geen van beide heeft, leest Lolly het document, zodat een kop met alleen kanji in een Japans document in het Japans wordt getekend. Een document met zowel kana als Hangul geeft in deze stap geen uitsluitsel.
3. Een teken dat alleen Traditioneel Chinees gebruikt, zoals 體 of 說, in het segment of anders in het document, betekent Traditioneel Chinees, tenzij dezelfde tekst ook een teken bevat dat alleen Vereenvoudigd Chinees gebruikt.
4. Anders: Vereenvoudigd Chinees.

Een teken dat het gekozen lettertype mist, wordt nooit uit een van de andere drie gehaald. Het blijft een afbeelding. Kana of Hangul die het gekozen lettertype mist, zoals Koreaanse woorden in een regel die als Japans is gemarkeerd, kunnen nog steeds uit het Japanse of Koreaanse lettertype komen, maar alleen wanneer dat lettertype geen gedeeld teken van de regel zou tekenen.

Op de pagina vermeldt een canvas met twee van deze talen beide lettertypen, en de browser tekent de gedeelde tekens met het eerste. De export tekent elk segment met zijn eigen lettertype.

<!--i:eti-download-->
## Wanneer een lettertype wordt gedownload

Er wordt niets gedownload totdat een document een teken bevat dat geen lettertype van zijn design system kan tekenen. Een symbool in een Engelse regel, zoals ★ of ※, downloadt nooit een Chinees, Japans of Koreaans lettertype.

De eerste keer dat een document een reservelettertype nodig heeft, downloadt Lolly dat ene lettertype en bewaart het op je apparaat. Een Japans document downloadt alleen het Japanse lettertype van 2,2 MB en een Traditioneel Chinees document het traditionele lettertype van 3,8 MB. Vanaf dan wordt het schrift offline getekend, en het lettertype blijft behouden wanneer de catalogus wordt opgeschoond. Het lettertype wordt bij de bestanden van de catalogus bewaard, nooit tussen je geüploade lettertypen, en verschijnt niet in de lettertypelijst van je merk.

De opdrachtregel, de terminalapp en de MCP-server lezen dezelfde bestanden van schijf, dus hebben ze geen download nodig.

<!--i:eti-eye-->
## Op de pagina en in de export

De pagina gebruikt hetzelfde reservelettertype als de export, zodat een regel met zulke letters in beide even breed is. Alleen op dat canvas voegt Lolly het reservelettertype toe na de eigen lettertypen van het design system en vóór elk systeemlettertype. Een tool die zijn eigen lettertypelijst instelt, in zijn stijlen of op zijn elementen, krijgt het reservelettertype op dezelfde plaats. Een canvas dat door het design system wordt gedekt, behoudt zijn lettertypelijst ongewijzigd.

De pagina laat een lettertypelijst ongemoeid wanneer die begint met een systeemlettertype, zoals `system-ui` of Helvetica, omdat de export die tekst met de lettertypen van het design system tekent en de pagina niet.

In een PDF worden de woorden contouren in het reservelettertype, ongeacht de tekstinstelling, omdat live PDF-tekst geen schrift kan bevatten dat het ingesloten lettertype mist. In SVG, EMF, EPS, DXF en WMF worden ze contouren wanneer tekst naar contouren wordt omgezet. Als tekst live blijft, tekenen de eigen lettertypen van de lezer die. Wanneer een reservelettertype een deel van een export heeft getekend, toont het exportpaneel een opmerking zoals:

> Japanse tekst wordt getekend met Noto Sans JP, omdat de lettertypen van dit design system die letters niet hebben.

De opdrachtregel toont dezelfde zin als opmerking.

<!--i:eti-image-->
## Wat een afbeelding blijft

Een teken buiten de vier nationale sets, zoals 𠮷 of een aanvullend teken uit Hongkong, heeft geen reservelettertype. Zeldzame tekens zoals 𠮷, de tekens die voor Hongkong zijn toegevoegd in de aanvullende set en schriften zonder reservelettertype, zoals Tamil, Ethiopisch of Syrisch, worden allemaal op dezelfde manier behandeld. Ook een schrift zoals Tamil, Ethiopisch of Syrisch heeft er geen. In een PDF wordt de regel met zulke tekst opgenomen als een afbeelding van 300 dpi, en het exportpaneel vermeldt de schriften. In een SVG blijft het segment live tekst, die de eigen lettertypen van de lezer tekenen.

::: details In EPS-, WMF- en EMF-exports
Een EPS, WMF of EMF met **Outline fonts** aan heeft geen live tekst om op terug te vallen, dus wordt het segment ook opgenomen als een afbeelding van 300 dpi. De afbeelding tekent de tekstkleur alleen waar de letters staan, zodat de achtergrond zichtbaar blijft. Het exportpaneel vermeldt de schriften. Een afbeelding wordt alleen rechtop getekend, dus een gedraaid of schuin segment stopt de export met een melding die het segment citeert. In een WMF of EMF is de afbeelding een paar bitmapbewerkingen: een masker en een schilderbewerking. Microsoft Office en LibreOffice tekenen ze zoals bedoeld. Een app die ze negeert, zoals Inkscape, toont de woorden op een wit vak.

Een EMF met **Outline fonts** uit behoudt zo'n segment als live tekst, die de eigen lettertypen van de lezer tekenen. De uitzondering is een segment dat live EMF-tekst niet kan bevatten, zoals tekst met letterspatiëring. Lolly zet dat segment om naar contouren, dus wordt een segment dat geen lettertype kan tekenen daar ook als afbeelding opgenomen.
:::

::: warning Een DXF-export stopt bij tekst die geen lettertype kan tekenen
Een DXF gaat naar snijmachines en CAD-software, die contouren nodig hebben, dus stopt een segment dat geen lettertype kan tekenen een DXF-export. De melding citeert het segment en vermeldt het schrift. Voeg een lettertype met die letters toe of exporteer SVG of PDF.
:::

<!--i:eti-checklist-->
## De controle voordat je exporteert

De kaart **Before you export** van Lolly Design en de `render`-controles van `lolly check` melden tekst die geen lettertype kan tekenen. Ze tellen de reservelettertypen mee zoals een export dat doet, vanuit dezelfde tekenlijsten per lettertype, zodat tekst die een reservelettertype tekent niet wordt gemeld. Een schrift zonder reservelettertype, zoals Tamil, en een Chinees, Japans of Koreaans teken buiten de nationale sets worden nog steeds gemeld, omdat de export ze als afbeelding of als live tekst tekent en een DXF-export erbij stopt. De controle leest die lijsten uit de catalogus en downloadt geen lettertype.

<!--i:eti-stamp-->
## Licenties en naamsvermeldingen

Elk reservelettertype valt onder de SIL Open Font License 1.1. Elke catalogusvermelding legt die licentie vast met een hash van de licentietekst, zodat de rechtenregels in [Creatieve rechten en bronvermeldingen](/info/creative-rights.html) de licentie lezen zoals die van elk ander lettertype. De licentieteksten staan naast de lettertypen. De Noto Sans-bestanden geven geen Reserved Font Name op. De Chinese, Japanse en Koreaanse lettertypen zijn van Adobe en reserveren de naam Source. De ingekorte bestanden behouden hun Noto-namen, die die naam niet gebruiken.

De licentie zegt dat haar voorwaarden niet gelden voor documenten die met de lettertypen zijn gemaakt. Een export bevat alleen de contouren van de letters die hij gebruikt, net als bij de eigen lettertypen van het design system. Lolly voegt geen lettertypeprogramma, geen naamsvermelding en geen nieuwe vermelding in de content credential toe voor een reservelettertype.
