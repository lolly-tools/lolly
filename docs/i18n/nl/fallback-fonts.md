# Reservelettertypen

De lettertypen van een design system dekken vaak maar een deel van de schriften van de wereld. Lolly Demo zet koppen in Outfit en tekst in SUSE, en geen van beide heeft Cyrillische, Griekse, Arabische, Hebreeuwse, Devanagari-, Bengaalse, Thaise, Chinese, Japanse of Koreaanse letters. Als een document letters bevat die de lettertypen van zijn design system niet kunnen tekenen, tekent Lolly die letters met een open Noto-lettertype, zodat de export ze als vectorcontouren bewaart in plaats van de woorden in een afbeelding te veranderen.

De lettertypen van het design system gaan altijd voor, in de volgorde waarin het design system ze noemt. Outfit heeft geen Vietnamese letters, dus een Vietnamese kop haalt ze uit SUSE, het volgende lettertype in de lijst van Lolly Demo. Een reservelettertype tekent alleen de tekens die geen van die lettertypen kan tekenen, zodat een merklettertype elke letter, elk cijfer en elk teken houdt dat het heeft, zelfs binnen een woord in een ander schrift. Een merklettertype dat een Chinees teken heeft, houdt dat teken ook.

## Wat is meegeleverd

Vijftien lettertypen, allemaal van Google Fonts op een vastgepinde commit en allemaal onder de SIL Open Font License 1.1. Bij elk bestand staat de downloadgrootte.

| Schrift | Lettertype | Versie | Download |
|---|---|---|---|
| Arabisch, inclusief Urdu- en Perzische letters | Noto Sans Arabic | 2.012 | 206 KB |
| Hebreeuws | Noto Sans Hebrew | 3.001 | 37 KB |
| Devanagari (Hindi, Marathi, Nepalees) | Noto Sans Devanagari | 2.007 | 147 KB |
| Bengaals | Noto Sans Bengali | 3.011 | 136 KB |
| Thai | Noto Sans Thai | 2.002 | 61 KB |
| Cyrillisch | Noto Sans, Cyrillische letters | 2.015 | 112 KB, cursief 129 KB |
| Grieks | Noto Sans, Griekse letters | 2.015 | 75 KB, cursief 81 KB |
| Latijn, inclusief Vietnamees en andere letters met accenten | Noto Sans, Latijnse letters | 2.015 | 309 KB, cursief 342 KB |
| Vereenvoudigd Chinees, de GB 2312-tekens | Noto Sans SC | 2.004 | 1,9 MB |
| Traditioneel Chinees, de Big5-tekens | Noto Sans TC | 2.004 | 3,6 MB |
| Japans, de Shift_JIS-tekens | Noto Sans JP | 2.004 | 2,1 MB |
| Koreaans, elke Hangul-lettergreep en de KS X 1001-tekens | Noto Sans KR | 2.004 | 2,4 MB |

De gewichtsas van elk lettertype blijft heel, dus elk gewicht dat een ontwerp vraagt, wordt nog steeds getekend en een vette Chinese, Japanse of Koreaanse kop is vet. De breedteas van de Noto Sans-lettertypen is vast op normaal gezet, wat elk bestand halveert; de Chinese, Japanse en Koreaanse lettertypen hebben geen breedteas. Noto Sans is per schrift opgesplitst, dus een Cyrillisch woord downloadt alleen de Cyrillische letters. De contouren zijn de contouren van de bron, ongewijzigd.

De lettertypen staan in één gedeelde map, `community/fallback-fonts`, die aan elk design system wordt geserveerd vanaf `/catalog/packs/fallback-fonts/`, op dezelfde manier als de emojisets worden gedeeld. `scripts/import-fallback-fonts.ts` bouwt de bestanden uit de bronlettertypen die in `scripts/data/fallback-fonts.json` zijn vastgepind, controleert elk bronbestand tegen zijn vastgelegde SHA-256 en schrijft de licentieteksten naast de lettertypen.

## Chinees, Japans en Koreaans

Een volledig Chinees, Japans of Koreaans lettertype is 9,6 MB tot 17,8 MB groot, dus elk van deze lettertypen is teruggebracht tot de nationale tekenset die zijn lezers dagelijks gebruiken, plus de leestekens, kana, vollebreedtevormen en symbolen van lopende tekst:

- Vereenvoudigd Chinees: GB 2312, de 6.763 gangbare hanzi en bijbehorende symbolen, in totaal 7.522 tekens.
- Traditioneel Chinees: Big5, de 13.053 hanzi en bijbehorende symbolen, in totaal 13.629 tekens. De Hong Kong Supplementary Character Set is niet inbegrepen.
- Japans: Shift_JIS zoals Windows en het web het lezen, dat is JIS X 0208 met de NEC- en IBM-toevoegingen die namen als 髙 en 﨑 nodig hebben, elke kana en de halfbreedte katakana, in totaal 7.432 tekens.
- Koreaans: alle 11.172 Hangul-lettergrepen en KS X 1001, met de 4.888 hanja, in totaal 17.082 tekens.

Latijnse, Griekse en Cyrillische letters zijn uit deze vier lettertypen weggelaten, omdat de lettertypen van het design system en de lettertypen hierboven ze tekenen. De sets worden gelezen uit de indexbestanden van de Encoding Standard op een vastgepinde commit, dus een nieuwe build geeft dezelfde bestanden.

Chinees, Japans en Koreaans delen de meeste tekens, maar elk tekent veel ervan anders. Hetzelfde teken 直 wordt in het Chinees op de ene manier geschreven en in het Japans op een andere. Daarom haalt één tekstdeel al zijn gedeelde tekens uit één van deze lettertypen, nooit uit twee, en kiest Lolly dat lettertype in deze volgorde:

1. De taal van het tekstdeel, uit de `lang` van zijn element of het dichtstbijzijnde element eromheen in het document. De taalinstelling van een tool, zoals de Language van het certificaat, bepaalt die. De taal van de eigen interface van Lolly en de taal van het design system tellen niet mee, zodat een document voor iedereen hetzelfde exporteert.
2. Het schrift van het tekstdeel: kana betekent Japans en Hangul betekent Koreaans. Als het tekstdeel zelf geen van beide heeft, wordt het hele document gelezen, dus een kop van alleen kanji in een Japans document wordt in het Japans getekend. Een document met zowel kana als Hangul beslist hier niets.
3. Een teken dat alleen traditioneel Chinees gebruikt, zoals 體 of 說, in het tekstdeel of anders in het document, betekent traditioneel Chinees, tenzij dezelfde tekst ook een teken bevat dat alleen vereenvoudigd Chinees gebruikt.
4. Anders: vereenvoudigd Chinees.

Een teken dat het gekozen lettertype niet heeft, wordt nooit uit een van de andere drie gehaald. Het blijft een afbeelding, zoals hieronder beschreven. Kana of Hangul die het gekozen lettertype mist, zoals Koreaanse woorden in een regel die als Japans is gemarkeerd, kunnen nog wel uit het Japanse of Koreaanse lettertype komen, maar alleen als dat lettertype geen gedeeld teken van de regel zou tekenen.

Op de pagina noemt een canvas met twee van deze talen beide lettertypen en tekent de browser de gedeelde tekens met het eerste. De export tekent elk tekstdeel met zijn eigen lettertype.

## Wanneer een lettertype downloadt

Er downloadt niets totdat een document een teken bevat dat geen enkel lettertype van zijn design system kan tekenen. Een document in het Engels, of in elke taal die zijn design system dekt, downloadt nooit een reservelettertype. Een symbool in een Engelse regel, zoals ★ of ※, downloadt nooit een Chinees, Japans of Koreaans lettertype.

De eerste keer dat een document er een nodig heeft, downloadt Lolly dat ene lettertype, voor dat ene schrift, en bewaart het op je apparaat. Een Japans document downloadt alleen het Japanse lettertype, 2,1 MB, en een traditioneel Chinees document het traditionele lettertype van 3,6 MB. Vanaf dat moment tekent het schrift offline, en het lettertype blijft staan als de catalogus wordt opgeruimd. Het lettertype wordt bewaard bij de eigen bestanden van de catalogus, nooit bij de lettertypen die je zelf hebt geüpload, dus het verschijnt niet in de lettertypelijst van je merk.

De opdrachtregel, de terminal-app en de MCP-server lezen dezelfde bestanden van schijf, dus ze hebben geen download nodig.

## Op de pagina en in de export

De pagina gebruikt hetzelfde reservelettertype als de export. Zonder dit tekent een browser zulke letters in een systeemlettertype terwijl de export Noto gebruikt, en een regel die ze bevat verandert van breedte tussen de twee. Lolly voegt het reservelettertype alleen op dat canvas toe aan het einde van de lettertypelijst van het design system, na de eigen lettertypen van het design system en vóór elk systeemlettertype. Een canvas dat het design system dekt, houdt zijn lettertypelijst precies zoals voorheen.

In een PDF worden de woorden contouren die met het reservelettertype zijn getekend, welke tekstinstelling je ook kiest, omdat live PDF-tekst geen schrift kan dragen dat het ingebedde lettertype mist. In SVG, EMF, EPS, DXF en WMF worden ze contouren zodra tekst naar contouren wordt omgezet; met live gehouden tekst tekenen de eigen lettertypen van de lezer ze, zoals voorheen. Als een reservelettertype een deel van een export tekende, toont het exportpaneel een melding zoals:

> Japanse tekst wordt getekend met Noto Sans JP, omdat de lettertypen van dit design system die letters niet hebben.

De opdrachtregel drukt dezelfde zin af als melding.

## Wat een afbeelding blijft

Een teken buiten de vier nationale sets heeft geen reservelettertype. Zeldzame tekens zoals 𠮷, de tekens die voor Hongkong zijn toegevoegd door de aanvullende set, en schriften zonder reservelettertype, zoals Tamil, Ethiopisch of Syrisch, worden allemaal op dezelfde manier behandeld. In een PDF gaat de regel die er een bevat erin als afbeelding van 300 dpi, en het exportpaneel noemt de schriften. In een SVG blijft het tekstdeel live tekst, die de eigen lettertypen van de lezer tekenen.

## Licenties en vermeldingen

Elk reservelettertype valt onder de SIL Open Font License 1.1, en elk catalogusitem legt die licentie vast met een hash van de licentietekst, zodat de rechtenregels in [Creatieve rechten en vermeldingen](/info/creative-rights.html) de licentie lezen zoals die van elk ander lettertype. De licentieteksten staan naast de lettertypen. De Noto Sans-bestanden verklaren geen Reserved Font Name. De Chinese, Japanse en Koreaanse lettertypen zijn van Adobe en reserveren de naam Source; de bijgesneden bestanden houden hun Noto-namen, die die naam niet gebruiken.

De licentie zegt dat haar voorwaarden niet gelden voor documenten die met de lettertypen zijn gemaakt. Een export bevat alleen de getekende contouren van de letters die hij gebruikt, zoals bij de eigen lettertypen van het design system, en Lolly voegt geen fontprogramma, geen vermeldingsregel en geen nieuw Content Credentials-item toe voor een reservelettertype.
