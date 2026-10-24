# Design: den fria ytan

Design är verktyget för layouter som ingen mall täcker: en affisch från grunden, en presentation med bilder, ett rörelsestycke med ljudspår. I stället för ett formulär med kontroller får du en yta med rutor som du drar, ändrar storlek på, roterar och skriver i. Det exporteras genom samma renderingsväg som varje annat verktyg, så det du ser på ytan är filen du får.

Den här sidan går igenom ytan från den första rutan till en färdig presentation: fönstret, att forma rutor, att rita egna former, att placera 3D-scener och andra verktyg, att lägga till tid, att kontrollera resultatet och att presentera den färdiga presentationen. [Använda Lolly](/info/using.html) beskriver det som Design delar med varje verktyg, som att spara och dela.

![Designs fria kanvas - ritytan med den omgivande arbetsytan runt om](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Fz%3D17ZTfS8MwEMf_mryO5NZ288GHrdqJv1CUvWdtOgppMtJMNv96yaV1iRNEQRBZoblwab53l0-uq915bXgrCOSDpf3LzgANnQ4eI0rrPJn7Gh9cd0sE8lIryxtFIFfatFx6L4F0Mi-11GbUiZYr25QjK3bW-S8I5MnUbRXKCkMgb5uqki6JFFU7rjoXYsSgT8GaLebKZSeGAPkUYypMHp80DeugYYR4J_U7X4XRkY8dFHuTYEJ-jDWM3qoqsEHo4Y20-xJi-SPVaOfRUuAL1hiZXNrG4gH6M85Z5lTAk8x8DdlnPL8gecVfBIEU6F5v0bbCor3VUu4JpOPCKTCWsPI9rBS107d6QyCfRET_Ac6wX36X6UpX-49Ip1mAlMEPkM6QX20aoSpECLTmpadcazPQ9hPlWxboRndWmFEIG1s4Yp3E3Ts-0f4GbcruWHLzlC0frmfpfbGk82LxmD0vUndSTcvXAoknWBKCz5LDSIdiRHV0D2Tfq1BIvdY42Zim5WZ_-n3_mRvwBg&width=1360&height=850&dpi=192&waitMs=3000&format=svg&walker=1&chrome=1&localize=1&dark=1&filename=design)

## Design-fönstret

**Översta listen** börjar med **Home**, **File menu** och dokumentets namn (klicka på namnet för att döpa om dokumentet). Mitten håller **Undo**, **Redo**, **History**, zoomkontrollerna (med **Fit all** och **Fit artboard**) och växlarna för **Timeline**, **Navigator** och **Inspector**. Till höger sitter **Share**, **Present** och **Export**. På en telefon flyttas de mindre använda knapparna in i **More actions**.

**Verktygsfältet** längs sidan håller Lolly-menyn och verktygen du ritar med: **Pointer**, **Add a box**, **Pen**, **Edit points**, **Line**, sedan knapparna Timeline, Artboards och Auto-arrange.

![Den fria arbetsytans verktygslist: ett draghandtag, Lolly-menyn, sedan Pekare, Lägg till en ruta, Penna, Redigera punkter, Linje, Tidslinje, Ritytor och Ordna automatiskt](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Ftemplate%3D__blank__&width=1440&height=900&dpi=192&waitMs=2600&css=.fc-toolbar%7Bopacity%3A1!important%7D&cropSelector=.fc-toolbar&walker=1&format=svg&dark=1&filename=pen-editor-rail)

Ytan fungerar som en designers arbetsbord runt ritytan:

- **Parkera rutor utanför ritytan.** Dra en ruta förbi ramens kant så förblir den synlig och markerbar. Allt utanför ramen tonas ned, och ramen behåller sin skugga för att markera var filen börjar.
- **Bara ritytan exporteras.** Allt utanför ramen, eller den del av en ruta som hänger över kanten, beskärs från utdatan i både raster- och vektorformat.
- **Zooma ut förbi Fit**, ned till 20 %, för att se allt du parkerat.
- **Ändra ritytans storlek** genom att ändra exportstorleken. Rutorna behåller sina positioner, så du kan ramma om en layout kring befintligt innehåll.

![Redigeringsscenen: ritytan i centrum, verktygsfältet till vänster och zoom-HUD:en i hörnet](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Fz%3D11dZBb5swFADgX8MOiRYZB0J76GFpNO2wnbr7ZMwDrBg7s01C8usngmNwSqJszaT2aD8_G54_PUgJXRdK1iJ7CvAcpSHG6FMqG9BPQbwMkmWAMcsCjIP5lwDjUsp1O8DPAcZrJvpIKhsXaLpZ1I323mjXjcJHbCdKO4Ee7ISSxsvQJdmAO0cBNe6gtHDzQbKkkks101ARYRidaaBSZETtg2TlMgw0xuX8LBXANCN7PTVyWki3Kr-6b61yQmG4ay6FeWEHOL1K1E0TzgrhdqIgDCiXs_WjFcsyDi66A1aU_ZMuEPIOcwFNhHYRzgR8GySGs9CW0BDlFzWrVTe2qdCwftOcZP2TtJEfuovFyKZzIvor0fD7WKhVGzsXo2ALhH8UMxvFqmtiXmQFpmSimArYBfGzYHpKZcVEcS87-OHedpK72cHndmYWunu6rtxM-3wuwGqTXskacov-nhs15KNYG7HgWZtMvpNa0LJtUJNJi-2rYhnZ3ybtuNUVZuj9MotOrAbQFmPQbuB0uxwud4NX9-ycrmWIJw59Pg9h5AF6RGd-5vgWPhvG-2b5xs8bl5zvZ0ZK3tf_bd0pxu_lw2YDG2Jv6VRdj9Hi__WrKB7pV3OELuBKIRunReqM9f8d1tbnKPFsJVHs2Zqf9SaMLrSmASCjiNAbokD0lD0t_95Wxu-MVaQ4uT6WQ8ta0V46Z6lq9br1fVEOh7ypju-FFyjBC7fmVy0UaMm3YBcbVYMt-dhfTlUbe2BOuD6ujFd_AA&width=1440&height=900&dpi=192&waitMs=7000&waitSelector=.tl-clip&css=.fc-toolbar%7Bopacity%3A1!important%7D&format=svg&walker=1&chrome=1&dark=1&filename=seq-studio-stage)

### Navigator och Inspector

**Navigator** listar varje ritytan (med rubriken **Artboards**, eller **Slides** i en presentation) som en hopfällbar grupp av dess **Layers**. Välj en rityta namn för att hoppa dit, fäll ut den för att markera eller ordna om dess lager och använd piltangenterna för att röra dig i listan; Vänster återvänder till ritytans rubrik. **Pages** grupperar ritytor i namngivna sidor, och att välja en sida ändrar bara vilka ritytor redigeraren visar.

**Inspector** lägger det markerade objektets text- eller bildkontroller först. Alternativchips täcker de snabba valen, och **Advanced** håller stildetaljerna. På en telefon öppnas Inspector som ett blad från **More actions**; Escape eller Back stänger bladet och behåller din markering.

![Avsnittet Document i Inspector: flikarna Selection och Canvas, sedan Dimensions och Style & look](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Ftemplate%3Dfeature-tour&width=1440&height=900&dpi=192&waitMs=3500&cropSelector=.fc-insp&walker=1&format=svg&dark=1&filename=design-narration)

## Ändra storlek, skala och rotera

Markera ett objekt och dra sedan i ett handtag för att ändra storleken, eller dra i det runda handtaget under markeringen för att vrida objektet. Ett storleksdrag fungerar i ett av två lägen:

- **Resize**, standard, ändrar bara rutan. Text bryts om till den nya storleken, och teckenstorlek, linjebredd, hörnradie och effekter förblir som de var.
- **Scale** förstorar eller förminskar hela objektet med dess innehåll: teckenstorlek, linje, hörnradie, skugga, oskärpa, utfyllnad och avstånd ändras alla med samma mängd.

Tryck `K` för att slå Scale på eller av. Utan tangentbord väljer du **Scale mode** i Lolly-menyn, eller trycker och håller knappen **Pointer** i verktygsfältet (eller högerklickar på knappen) och väljer **Scale**; på en pekskärm har objektfältet också en Scale-växel. Medan Scale är på visar Pointer-knappen Scale-ikonen och varje handtag har en prick i mitten. `V` eller **Escape** återgår till Resize och behåller din markering. Varje dokument öppnas med Scale av, så ingen skalar linjer av misstag.

**Skala med ett tal.** Med Scale på, eller med flera objekt markerade, klickar du på värdet i objektfältet för att öppna popover-rutan **Scale**. Skriv en procentsats, en bredd eller en höjd, välj punkten som står still på 3 x 3-rutnätet och välj **Apply**. Varje skalning är ett ångra-steg.

**Flera objekt.** En markering av flera objekt har handtag på sina kanter såväl som hörn. Så länge varje objekt är upprätt eller vridet i hela kvartsvarv, och markeringen inte innehåller någon grupp eller cirkel, ändrar ett hörndrag bredd och höjd fritt. Annars behåller markeringen sina proportioner och värdet lägger till **Proportional**. Medan du drar visar en liten etikett storleken, eller procentsatsen i Scale-läge.

**Vänd en markering.** Högerklicka och välj **Flip horizontal** eller **Flip vertical**, eller tryck `Shift+H` eller `Shift+V` (Shift, eftersom ett ensamt `V` är Pointer). Speglingen är en riktig transformation, så den exporterade SVG, PDF och PNG behåller vändningen.

**Tangenter du håller under ett drag** får effekt i samma stund du trycker eller släpper dem; genvägsbladet (`?`) listar dem också.

| Håll | Ändra storlek eller skala | Rotera | Flytta |
|---|---|---|---|
| **Shift** | Behåller proportionerna (Scale gör det alltid) | Vrider i steg om 15 grader | Ingen ändring |
| **Alt** (Option) | Arbetar från mitten | Vrider fritt | Slår av snappning och rutnät |
| **Cmd/Ctrl** | Slår av snappning och rutnät | Vrider fritt | Slår av snappning och rutnät |

Utan hållen tangent dras en vridning till närmaste 15 grader när den kommer inom 4 grader från en sådan. Ritytor roterar inte, så de har inget roteringshandtag.

::: details Handtag, greppzoner och touch
**Greppa var som helst längs en kant.** Varje sida av en markering är en storleksremsa längs hela sin längd, och med en mus eller en penna finns en roteringszon strax utanför varje hörn. Pekaren visar vad ett drag kommer att göra. Ett tryck i en remsa eller zon blir en storleksändring eller en vridning först när du börjar dra, så ett vanligt klick markerar som förut. Ett låst objekt har inga handtag, remsor eller zoner.

**Små objekt förblir flyttbara.** På ett objekt som är 25 skärmpixlar eller mindre över döljs mittenhandtagen och de andra flyttas en bit ut från konturen, så ett tryck på objektet flyttar objektet. Vid 10 pixlar eller mindre försvinner också hörnhandtagen, och en tunn linje behåller ett handtag i varje ände. Ett tryck strax bredvid en tunn linje eller ett pyttelitet objekt, utanför dess handtag, flyttar objektet.

**Stora greppytor.** På en pekskärm är varje hörnzon en fjärdedel av markeringens bredd och höjd på skärmen, mellan 24 och 44 pixlar, och varje sidozon täcker sträckan mellan två hörn. När markeringen är för liten för det flyttas zonerna utanför dess kontur. Zonen under din pekare eller ditt finger skuggas. För att få samma zoner med en mus eller en penna slår du på **Large grab areas** i Lolly-menyn; inställningen stannar på den här enheten.

**Två fingrar på en markering.** På en pekskärm lägger du två fingrar på ett markerat objekt: nyp för att skala, vrid för att rotera eller flytta båda fingrarna för att bära markeringen, allt som ett ångra-steg. Med Scale på skalar ett nyp innehållet också; med Scale av ändrar det storleken proportionellt. En vridning snäpper till närmaste 15 grader när den är nära, och en tvåfingersflytt snäpper aldrig. Det första fingret måste landa på markeringen och det andra måste följa snabbt, på markeringen eller strax utanför dess kant. Två fingrar var som helst annars zoomar och panorerar vyn, och det gör två fingrar på en markering som innehåller en rityta eller ett låst objekt, täcker det mesta av vyn eller går förbi dess kant.
:::

## Rita egna former

Rutor, cirklar och rundade ramar täcker de flesta layouter. För varje annan form ritar du en: knappen **Pen** i verktygsfältet (eller `P`) försätter dig i ritläge. Tre enkla tangenter växlar mellan lägen: `V` för Pointer, `P` för Pen och `N` för **Edit points**. Pointer är alltid vägen ut.

- **Klicka** för att placera en punkt. Med standardkurvtypen drar **klicka och dra** ut punktens handtag för att göra en kurva; håll **Alt** medan du klickar för ett hårt hörn. (På de andra kurvtyperna är varje punkt ett hörn och ett drag gör ingenting.)
- Punkter snäpper mot ritytan och dina andra rutor medan du placerar dem. Alt undertrycker rutnätet medan du ritar, och både rutnätet och kanterna medan du därefter drar en punkt.
- **Klicka på din första punkt** för att sluta formen. Annars trycker du **Enter**, dubbelklickar eller byter verktyg, och ritningen behålls.
- **Escape** fungerar ett steg i taget: det första trycket överger ritningen, det andra lämnar pennan.
- **Delete** under ritning tar bort den sista punkten.

Resultatet är en vanlig ruta. Flytta, ändra storlek på, rotera, gruppera, justera, ändra ordning på, fyll, skugga eller tona banan som vilken annan ruta som helst. Den första banan får den fyllning och linje som ditt varumärke ger en bana, och varje ny bana därefter får det du senast använde. I ett verktyg där varumärket inte anger något för banor ritas en ny bana med linje i färgen du ritade med, så formen aldrig är osynlig.

**Redigera punkterna igen.** Dubbelklicka på formen, eller använd **Edit points** i objektfältet. Dra en punkt för att flytta den, dra ett handtag för att rikta om kurvan, klicka på kurvan för att infoga en punkt eller dra en ruta runt flera punkter och tryck Delete. En bana behåller alltid minst två punkter.

**Spline type** avgör vilken sorts kurva som går genom dina punkter:

| Typ | Vad den gör |
|---|---|
| **Smooth (auto)** | Standard. Räknar ut sina egna handtagslängder, så vanliga klick ger en mjuk kurva. Ett handtag du sätter låser riktningen, och kurvan äger fortfarande längden. |
| **Bezier handles** | Den klassiska pennan: du styr varje handtag, och att infoga en punkt flyttar aldrig kurvan. |
| **Through the points** | Passerar exakt genom varje punkt, utan handtag. |
| **B-spline** | Flyter nära punkterna i stället för genom dem, för en mjukare linje. |
| **Straight lines** | En polylinje. |

Att byta en befintlig bana till en typ som räknar ut sina egna handtag frågar först, eftersom handtagslängder du satt inte kan återskapas; att byta till **Bezier handles** är alltid förlustfritt. Under pågående ritning gäller bytet direkt, och alla handtag du dragit ut tas bort.

Varje punkt bär också en kontinuitetsregel, visad av dess form: kvadrat för **Corner** (handtagen rör sig oberoende), rund för **Smooth** (handtagen ligger på linje) och rund med en ring för **Symmetric** (på linje och lika långa). Sätt regeln för markerade punkter så följer kurvan direkt.

![Två pennbanor renderade direkt från en länk: en S-kurva med streck och en sluten fylld klump](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Fboxes%3D%5B%7B%22id%22%3A%22paper%22%2C%22kind%22%3A%22box%22%2C%22x%22%3A0%2C%22y%22%3A0%2C%22w%22%3A1080%2C%22h%22%3A1080%2C%22shape%22%3A%22rect%22%2C%22bg%22%3A%22%23ffffff%22%7D%2C%7B%22id%22%3A%22curve%22%2C%22kind%22%3A%22path%22%2C%22x%22%3A140%2C%22y%22%3A180%2C%22w%22%3A800%2C%22h%22%3A420%2C%22shape%22%3A%22rect%22%2C%22bg%22%3A%22%22%2C%22stroke%22%3A%22%234f84ba%22%2C%22strokeW%22%3A14%2C%22path%22%3A%221!cubic!0_.02!.85!!!.25!-.45!s_.5!.5!-.22!.32!.22!-.32!y_.98!.12!-.25!.45!!!s%22%7D%2C%7B%22id%22%3A%22blob%22%2C%22kind%22%3A%22path%22%2C%22x%22%3A340%2C%22y%22%3A620%2C%22w%22%3A400%2C%22h%22%3A320%2C%22shape%22%3A%22rect%22%2C%22bg%22%3A%22%23d1e7ff%22%2C%22stroke%22%3A%22%234f84ba%22%2C%22strokeW%22%3A6%2C%22fillRule%22%3A%22nonzero%22%2C%22path%22%3A%221!catmull-rom!1_.5!0_1!.42_.78!1_.22!1_0!.42%22%7D%5D&width=1440&height=900&dpi=192&waitMs=2600&cropSelector=%23tool-canvas&walker=1&format=svg&dark=1&filename=pen-path-geometry)

En ritad bana färdas i en delningslänk som vilken annan ruta som helst och renderas likadant från kommandoraden.

## Kombinera former

Markera två eller fler former, högerklicka på ytan (tvåfingertryck på touch) och välj:

- **Union** slår ihop dem till en form med den översta formens färg.
- **Subtract** skär bort allt ovanför från den nedersta formen.
- **Intersect** behåller bara överlappningen.
- **Exclude** behåller allt utom överlappningen.

Tre till fungerar på en enda form. **Outline stroke…** gör en linje till en fylld kontur med samma tjocklek. **Offset path…** växer konturen utåt eller, med ett negativt tal, krymper den inåt. **Simplify** bygger om en bana med färre segment och samma kontur.

![En halvmåne och en ring med ett riktigt hål, båda skapade med Subtract](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Fboxes%3D%5B%7B%22id%22%3A%22paper%22%2C%22kind%22%3A%22box%22%2C%22x%22%3A0%2C%22y%22%3A0%2C%22w%22%3A1080%2C%22h%22%3A1080%2C%22shape%22%3A%22rect%22%2C%22bg%22%3A%22%23ffffff%22%7D%2C%7B%22id%22%3A%22crescent%22%2C%22kind%22%3A%22path%22%2C%22x%22%3A120%2C%22y%22%3A330%2C%22w%22%3A374%2C%22h%22%3A400%2C%22shape%22%3A%22rect%22%2C%22bg%22%3A%22%234f84ba%22%2C%22path%22%3A%221!cubic!1_.750491!.957645!-.128211!-.062578!-.065985!.027232!c_.534759!1!.076762!!-.295339!!c_0!.5!!.276142!!-.276142!c_.534759!0!-.295339!!.200102!!c_1.000984!.254923!-.09169!-.152161!-.021205!-.003239!c_.935829!.25!.022185!!-.221505!!c_.534759!.625!!-.207107!!.14459!c%22%7D%2C%7B%22id%22%3A%22ring%22%2C%22kind%22%3A%22path%22%2C%22x%22%3A580%2C%22y%22%3A330%2C%22w%22%3A400%2C%22h%22%3A400%2C%22shape%22%3A%22rect%22%2C%22bg%22%3A%22%234f84ba%22%2C%22fillRule%22%3A%22nonzero%22%2C%22path%22%3A%221!cubic!1_1!.5!!-.276142!!.276142!c_.5!1!.276142!!-.276142!!c_0!.5!!.276142!!-.276142!c_.5!0!-.276142!!.276142!!c*1!cubic!1_.5!.7!-.110457!!.110457!!c_.7!.5!!.110457!!-.110457!c_.5!.3!.110457!!-.110457!!c_.3!.5!!-.110457!!.110457!c%22%7D%5D%26w%3D1080%26h%3D1080&width=1440&height=900&dpi=192&waitMs=2600&cropSelector=%23tool-canvas&walker=1&format=svg&filename=path-ops-boolean-result)

Resultatet är en ny bana som du kan fortsätta redigera med pennan, lagrad som vanliga Bézierkurvor, så den ursprungliga splinetypen följer inte med. Hål är riktiga hål: kontrollen **Fill rule** på linjepanelen avgör om överlappande konturer fylls (*non-zero*) eller stansas igenom (*even-odd*). Operationerna vägrar hellre än förstör: be om att skära två former som inte överlappar och ingenting ändras. Text- och bildrutor har ingen kontur, så de lämnas ifred.

## 3D-scener och verktyg i en design

En ruta kan hålla mer än en bild. Båda sorterna nedan behåller ett recept i stället för en renderad bild, så de ritas om i den storlek och vid det ögonblick som dokumentet ber om, och en uppdatering av källan når varje design som använder källan.

### 3D-scener

Välj **3D scene** i verktygsfältets tilläggsmeny och dra ut en ram: 3D Studio öppnas på den nya rutan, och det du ställer in där kommer tillbaka till ytan. Därefter öppnar **Edit in 3D Studio** i avsnittet **3D scene** i Inspector studion igen. [Placera en scen i Design](/info/3d-studio.html#place-a-scene-in-design) beskriver affischer, tidslinjen, export och delning.

### Verktyg i en design

Välj **Image** i verktygsfältets tilläggsmeny, dra ut en ram och välj ett verktyg på väljarens flik **Tools**. Verktyget fyller ramen med sina standardvärden, och Inspector öppnas på ett avsnitt **Tool** med det verktygets egna kontroller. Ändra ett fält så uppdateras rutan en stund senare, som ett ångra-steg. **Image fit** och **Image position** fungerar som för vilken bild som helst, och **Replace with another tool or image** byter rutans innehåll.

**Verktyg som rör sig** spelas i rutan: en looppad illustration fortsätter loopa på ytan, följer spelhuvudet när tidslinjen är öppen och exporteras bildruta för bildruta till GIF, MP4 eller WebM. När verktyget anger hur länge en loop varar får rutan ett klipp exakt så långt, så en video håller hela loopar. Ett klipp som du ändrat tiden på behåller din tidsinställning, och att slå av verktygets rörelse gör rutan till en stillbild igen.

## Tidslinje (Sequence)

**Sequence** är Designs tidslinje: den lägger till tid på ytan. Varje ruta kan börja vid ett ögonblick, vara en viss längd och animeras in och ut, och tidslinjen som är dockad under ritytan är där du ordnar dem. Börja från Designs mall **Video** så är en kort sekvens redan på plats: två tidsatta textkort på sekvensraden och en procedurell musikbädd under dem, så att du kan se hur tidslinjen fungerar innan du ändrar något.

![Sequence-tidslinjen: transporten, linjalen, ett overlay-spår, den magnetiska sekvensraden med dess klipp och skarvchips samt Always on-remsan](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Fz%3D11dZBb5swFADgX8MOiRYZB0J76GFpNO2wnbr7ZMwDrBg7s01C8usngmNwSqJszaT2aD8_G54_PUgJXRdK1iJ7CvAcpSHG6FMqG9BPQbwMkmWAMcsCjIP5lwDjUsp1O8DPAcZrJvpIKhsXaLpZ1I323mjXjcJHbCdKO4Ee7ISSxsvQJdmAO0cBNe6gtHDzQbKkkks101ARYRidaaBSZETtg2TlMgw0xuX8LBXANCN7PTVyWki3Kr-6b61yQmG4ay6FeWEHOL1K1E0TzgrhdqIgDCiXs_WjFcsyDi66A1aU_ZMuEPIOcwFNhHYRzgR8GySGs9CW0BDlFzWrVTe2qdCwftOcZP2TtJEfuovFyKZzIvor0fD7WKhVGzsXo2ALhH8UMxvFqmtiXmQFpmSimArYBfGzYHpKZcVEcS87-OHedpK72cHndmYWunu6rtxM-3wuwGqTXskacov-nhs15KNYG7HgWZtMvpNa0LJtUJNJi-2rYhnZ3ybtuNUVZuj9MotOrAbQFmPQbuB0uxwud4NX9-ycrmWIJw59Pg9h5AF6RGd-5vgWPhvG-2b5xs8bl5zvZ0ZK3tf_bd0pxu_lw2YDG2Jv6VRdj9Hi__WrKB7pV3OELuBKIRunReqM9f8d1tbnKPFsJVHs2Zqf9SaMLrSmASCjiNAbokD0lD0t_95Wxu-MVaQ4uT6WQ8ta0V46Z6lq9br1fVEOh7ypju-FFyjBC7fmVy0UaMm3YBcbVYMt-dhfTlUbe2BOuD6ujFd_AA&width=1440&height=900&dpi=192&waitMs=7000&waitSelector=.tl-clip&css=.tl-panel%7Bheight%3A252px!important%7D&cropSelector=.tl-panel&format=svg&walker=1&tolerance=0.03&dark=1&filename=seq-studio-timeline)

Det finns två sorters rader:

- **Sekvensraden** är magnetisk. Klipp sitter ände mot ände, att dra ett ändrar ordning på körningen och att radera ett stänger luckan. Det här är ryggraden.
- **Överlagringsspår** är fria. En lower-third, en logotyp eller en bildtext svävar över ryggraden vid sin egen tid, var och en i sitt eget spår.
- Under dem håller **Always on** rutor utan tidsinställning, närvarande hela vägen. `+` på ett chip flyttar ett till ett spår; **Make always on** skickar tillbaka det.

Att öppna tidslinjen ger den tangentbordet, så Space och piltangenterna styr spelhuvudet. En komposition som redan har tidsinställning öppnar tidslinjen av sig själv.

**Redigering.** Dra ett klipps mitt för att flytta det, dra nära någon av ändarna för att trimma det och tryck **Split at playhead** (eller `S`) för att klippa det i två. Split kräver ett klipp med en riktig **Length** och spelhuvudet en bit innanför det, så ett klipp utan slut som musikbädden kan inte delas. **Snap to edges** är på som standard och snäpper mot klippkanter, spelhuvudet och hela sekunder; håll Alt för att dra utan snäppning. Varje drag är ett ångra-steg, och förhandsvisningen medan du drar använder samma aritmetik som resultatet.

Markera ett klipp så ger inspektören samma ändringar som tal: **Length**, **Trim in** (hur långt in i källan klippet börjar), **Speed** från ×0,25 till ×4, **Animate in** och **Animate out** med sina längder och **Mute clip**. Ett klipp på den magnetiska raden har inget fält **Start**, eftersom raden äger ordningen.

**Transitions** är förinställningar: Fade, Pop, Grow, Rise, Drop, de fyra Slides, Zoom in och out, Tilt, Swoop, Spin, Drift eller **Cut (no animation)**. Avstånd skalas med objektet, så en förinställning ser rätt ut på ett kort i full ram och en liten bricka. Mellan två klipp på sekvensraden väljer ett **seam chip** **Cut** eller **Crossfade**; öppna det igen för att sätta **Length (ms)** och tryck **Done**. I en crossfade spelar det första klippet vidare förbi snittet och tonar ut medan nästa tonar in, likadant i förhandsvisningen och filen.

**Ljud.** Ett **Audio**-klipp lever på tidslinjen som vilket annat klipp som helst, med vågform, trimning och ljud av. Video-mallens genererade musikbädd syntetiseras vid exporttillfället, så dess fält förblir enkelt och tyst tills du renderar. Tryck på mikrofonen för att **spela in ett speakerljud** direkt på tidslinjen, med nedräkning och nivåmätare; tagningen sparas som din egen tillgång vid spelhuvudet. Kameraknappen bredvid mikrofonen **spelar in en video** på samma sätt, beskuren till ritytan medan den spelas in, så att en kollega kan lägga till ett klipp från en delad länk. Markera ett klipp med ljud så öppnas dess remsa under tidslinjen för volym, panorering, EQ, tonhöjd, normalisering och effekter som **Voice cleanup**; [Ljud](/info/sequence-editor.html#sound) i guiden för sekvensredigeraren beskriver remsan. Exportpanelens **Audio track** är separat: en bädd under hela klippet, med tona och dämpning.

![Tidslinjen med musikklippet markerat: panelen längs botten visar Hastighet, Toningar, Volym, Panorera, EQ, Tonhöjd, Normalisera volym och Effekt-facket](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Fbx%3Dt1%252Ctext%252C200%252C140%252C1500%252C220%252C0%252Crect%252C16%252C%252C100%252C%252Ccontain%252Cnormal%252CVoiceover%252520session%252C%25257Bcolor.semantic.text%25257D%252C48%252Ccenter%252Cmiddle%252C500%252Csans%252C1.12%252C0%252Ctrue%252Cfalse%252C%252C%252C8%252Cnone%252C00000055%252C0%252C0%252C10%252Ccenter%252Cfalse%252C%252C%252C0%252Cnonzero%252C0%252C3.3%252C0%252C1%252Cnone%252Cnone%252C400%252C400%252Cfalse%252Cseq%252C%252Cround%252Cround%252C%252C0%252C0%252C0%252C0%252C%252C%252C%252C0%252Ctrue%252Cnone%252Cnone%252C%252Cfalse%252C%252C%252C%252C0%252C%252C%252Cfalse%252C%252C%252C%252C%252Cfalse%252Cfalse%252C%252C1%252C%252Cfalse%252C%252C60%252C%252C%252C1%257Ea1%252Caudio%252C200%252C500%252C400%252C80%252C0%252Crect%252C16%252C%252C100%252Clolly%25252Floops%25252F3-am-echoes%252Ccontain%252Cnormal%252C%252C%25257Bcolor.semantic.text%25257D%252C48%252Ccenter%252Cmiddle%252C500%252Csans%252C1.12%252C0%252Ctrue%252Cfalse%252C%252C%252C8%252Cnone%252C00000055%252C0%252C0%252C10%252Ccenter%252Cfalse%252C%252C%252C0%252Cnonzero%252C0%252C3.3%252C0%252C1%252Cnone%252Cnone%252C400%252C400%252Cfalse%252C%252C%252Cround%252Cround%252C%252C0%252C0%252C0%252C0%252C%252C%252C%252C0%252Ctrue%252Cnone%252Cnone%252C%252Cfalse%252C%252C%252C%252C0%252C%252C%252Cfalse%252C%252C%252C%252C%252Cfalse%252Cfalse%252C%252C1.3%252C%252Cfalse%252C%252C60%252C%252C%252C1%26_sel%3Da1&width=1440&height=900&dpi=192&waitMs=5000&waitSelector=.tl-clip&css=.tl-panel%7Bheight%3A300px%21important%7D&cropSelector=.tl-panel&walker=1&format=svg&dark=1&filename=tl-audio-strip&drive=click%3Abutton%3Ahas-text%28%22Inspector%22%29)

**Rendering.** En rörelseexport ritar, avkodar och kodar varje bildruta vid en exakt tid, så filen beror inte på att din maskin hänger med, och MP4 och WebM har inget praktiskt tak för antal bildrutor. Tidslinjens längd anger varaktigheten om du inte skriver in en, och Content Credentials stämplas som på vilken annan export som helst. En stillbildsexport ger bildrutan vid spelhuvudet, eller ett kontaktark från fältet **Frames**; se [Stillbilder från en tidsatt komposition](/info/exporting.html#stills-from-a-timed-composition). En sekvens begränsas till en timme. GIF och animerad PNG håller varje bildruta i minnet, så de passar korta klipp. **Record live** är dold här eftersom bildruta-för-bildruta-renderingen är den bättre vägen.

**Nyckelbilder, djup och en kamera.** En övergång animerar ett klipp när det kommer och går. För att posera en ruta inom ett klipp (driva, tona, göra oskarp, lyfta den från sidan och låta den sätta sig igen), markerar du klippet och trycker **+Keyframe**: romben i tidslinjens verktyg, romben i objektfältet på ytan eller **Shift+K** med tidslinjen i fokus. Spelhuvudets position avgör vilken pose din nästa redigering skriver. Samma nyckelbilder ger en tidsatt komposition en kamera som trycker in, panorerar och drar skärpa. [Animera](/info/animating.html) är hela guiden, och [Sekvensredigeraren](/info/sequence-editor.html) beskriver markering, onion skin, delning, trimning och markörer.

## Innan du exporterar

Design kontrollerar ditt dokument innan du skickar filen. Kortet **Before you export**, i avsnittet **Document** i Inspector och igen i exportpanelen, läser den sparade lagerstrukturen och tittar sedan på den färdigställda ytan efter avklippt text och kontrast mellan enfärgade ytor. Det frågar samma typsnittsregister som SVG- och PDF-konturningen använder om varje textavsnitt har typsnittsbyte som kan bäddas in. Bild- och gradientbakgrunder listas som visuella kontroller i stället för att få en påhittad kontrastpoäng.

### Kontrollera en komposition mot designsystemet

Exportpanelens kort jämför också kompositionen med ditt designsystem, vid samma designsystemversion som renderingen använder. Det tittar på författade färger, tokenalias, typsnittsval och bildtillgångars id. Ett anpassat värde kan vara avsiktligt, och en bild utanför de deklarerade varumärkestillgångarna är ett granskningsärende, inte en förbjuden bild.

Där ett konkret färg- eller typsnittsförslag finns ändrar dess knapp just det lagret, och **Undo** återställer originalet. Låsta eller sedan ändrade lager skrivs aldrig över av ett gammalt förslag. Gradienter, effekter, kapslat verktygsinnehåll, rättigheter och subjektiv kvalitet ligger utanför den här jämförelsen, och ingen kontroll blockerar Download.

### Organisationens regler och skrivsignalen

Exportpanelens kort kontrollerar också de organisationsregler som ditt designsystem medför, som textvikt och justering, godkända färgpar eller en logotyp per yta, lager för lager. Varje fynd är en varning med lagrets namn ovanför regeln. En regel som det här bygget saknar kontroll för listas som inte kontrollerad, aldrig som följd. [Usage & rules](/info/brand-studio.html#usage-rules) listar reglerna, och `lolly check` tillämpar samma regler på ett sparat dokument.

Samma kort visar skrivsignalen för texten dokumentet ritar: dess band (ingen, svag, märkbar eller stark), sedan Verifys egen mening med poängen av 100 och upp till tre flaggade fraser, var och en med lagret som håller dem. **Open the text in Verify** tar texten till [Verify](/#/verify) för hela läsningen; [AI evidence in Verify](/info/verify-ai-evidence.html) förklarar vad poängen väger in. Poängen är en signal, inte en dom: den räknar mönster som är vanliga i genererad text och kan inte avgöra vem som skrivit orden. Dolda lager lämnas utanför båda kontrollerna, och kortet anger hur många.

Fynd mot organisationens regler och en stark skrivsignal räknas in i kortets summa "to fix" så att de är lätta att hitta. De informerar och blockerar aldrig: Download förblir tillgänglig, och det finns inget att avfärda eller registrera som ett undantag. En agent som arbetar i det öppna dokumentet får samma rapport genom sina webbplatsverktyg ([Agenter i ett öppet dokument](/info/open-document-agents.html)).

Tryckkontrollerna (utfall, upplösning, färgtäckning och antal plåtar) ansluter till samma kort när du slår på **Settings → Feature flags → Print preflight**. I andra verktyg är den flaggan det som visar kortet över huvud taget; [Exportera en fil](/info/exporting.html) beskriver tryckkontrollerna.

## Presentera

Ett Design-dokument av ritytor är redan en presentation. Tryck **Present** i översta listen så blir varje rityta en helskärmsbild, i den ordning ritytorna ligger på ytan. Knappen lyder **Preview** tills dokumentets **Design outcome** är **Slides**. Presentationen körs på en kopia av de renderade ritytorna, så att lämna sätter dig tillbaka exakt där du var.

Pilen bredvid **Present** öppnar **Present from this slide**, **Speaker view**, **Present with camera**, **Narrate**, **Auto-advance slides**, **Loop the deck (kiosk)** och **Export slides as video**.

| Tangent | Vad den gör |
|---|---|
| **Space**, `→`, **Page Down** | Nästa steg eller bild (eller klicka på remsan vid högerkanten) |
| `←`, **Page Up** | Bakåt (eller klicka på remsan vid vänsterkanten) |
| **Home**, **End** | Första eller sista bilden |
| `O` | Översikt: varje rityta i din ytarrangering; klicka på en för att öppna den |
| `S` | Speaker view: aktuell bild, nästa bild, anteckningar och en klocka i ett andra fönster |
| `B` | Svart skärm; valfri tangent tar tillbaka bilden |
| `F` | Tillbaka till helskärm |
| `K` | Pausa eller starta om en kioskpresentation |
| **Escape** | Skala av ett lager: översikt till presentation, presentation till redigerare |

Ett litet kontrollfält tonas in när du rör pekaren och döljs igen när du slutar. Om webbläsaren blockerar talarpopupen öppnas talarvyn som en panel över presentationen. Anteckningar hör till varje rityta och visas aldrig på bilden.

- **Avslöjandesteg.** Högerklicka på en ruta och välj **Reveal at step 1**, **2** eller **3** i stället för **Always visible**, så väntar rutan tills du går vidare till dess steg. Rutor med samma nummer kommer tillsammans.
- **Kiosk.** Ge en rityta en **Length** så stannar presentationen där så länge, och går sedan vidare bakom ett tunt förloppsfält. Lägg till `kiosk` i länken så börjar presentationen om efter slutet, för skyltning.
- **Understaplar av bilder.** Högerklicka på en rityta och välj **Stack under the previous slide** för att göra den till ett steg i den bilden. Översikten visar ett kort, och inspektörens rad **Stack** säger vilken bild ritytan hör till.
- **Morph.** När två bilder i följd båda har en ruta med samma **Morph match**-namn (till exempel `hero`) flyttar, ändrar övergången storlek på och färgar om den rutan i stället för att klippa. En **Morph**-övergång för hela presentationen gör detsamma för varje matchat par.
- **Berättarröst.** Varje ritytas **Speaker notes** kan läsas upp. I avsnittet **Document** i Inspector väljer du en **Voice**, eventuellt en andra röst att **Blend with**, **Speed** och en **Lead-in** och **Tail** i millisekunder; **Show captions when presenting** visar orden medan de uttalas. Rösten körs på din enhet, och samma anteckningar blir ljudspåret i en videoexport, bildljud i en PowerPoint-export och den berättade filmen i ett [SCORM-paket](/info/create/exporting.html#scorm-course-packages).

Presentationen är också en länk. `?present` öppnar direkt i den och `s=` väljer bilden (en position, ett ritytans id eller `id.step` för ett byggsteg), och adressen följer med dig, så det du skickar är bilden du är på. [Reserved URL parameters](/info/url-parameters.html#what-happens-on-open) dokumenterar dem.

**Present with camera** placerar din kamera, en logotyp och en namnskylt över bilderna, med privata kontroller och sparade scener; se [Presentera med kamera](/info/presenting.html). En **Web page**-ruta kan ta klickern under ett föredrag när du slår på **Make interactive** i dess inspektör: vid dess steg **Focus on click** styr Upp och Ned sidan medan Nästa fortsätter presentationen. [Levande sidor som tar klickern](/info/interactive-pages.html) beskriver fokusstilar, rullningsstopp och webbplatsgodkännande.

## Vart du ska gå härnäst

- **[Text i Design](/info/text-composition.html)**: att redigera text på ytan, låta artiklar flyta genom ramar och typografi.
- **[Animera](/info/animating.html)**: nyckelbilder, djup, scenkameran och Lift-lager.
- **[Importera en design](/info/design-import.html)**: öppna en Figma-, Penpot-, Illustrator- eller InDesign-fil som redigerbara rutor.
- **[Dela en design med regler](/info/create-a-tool.html)**: gör ett Design-dokument till ett verktyg med bara de indata du väljer.
- **[Exportera en fil](/info/exporting.html)**: format, storlekar, tryckenheter och video.
