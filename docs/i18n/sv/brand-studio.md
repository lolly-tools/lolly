# Lolly Design System Setup

<a id="design-system-setup"></a>

**Lolly Design System Setup**, på `#/start`, innehåller din logotyp, dina färger och dina typsnitt. Varje verktyg, sida och export ritar med dem.

Släpp in en logotyp så läser Lolly dess färger. Välj ett typsnitt eller släpp typsnittsfilen som ditt företag har licens för. Varje ändring syns direkt i hela appen. Din logotyp, dina typsnitt och tokens stannar på den här enheten. Bara valet av ett Google Font-typsnitt kontaktar nätet: Lolly frågar först och hämtar sedan familjen en gång.

Ge designsystemet ett namn och tryck på **Export** för att få en `.lolly`-fil. Behåll filen, öppna den på en annan enhet eller lämna den till en kollega. [Lolly Settings](/info/dashboard.html#design-system) visar det aktiva systemet skrivskyddat; dess omslag länkar tillbaka hit för redigering.

<!--i:eti-clock-->
## Gör det till ditt på fem minuter

::: timeline
- <!--i:upload--> **Släpp din logotyp** på släppytan i **Logos**. Lolly läser dess form och färger.
- <!--i:palette--> **Use these colours.** Logotypens huvudfärg blir din primärfärg, och en mörk neutral färg från logotypen blir din textfärg.
- <!--i:font--> **Choose a face** i **Type**: ett Google Font-typsnitt eller en typsnittsfil du äger.
- <!--i:pentool--> **Ge systemet ett namn.** Din första ändring skapar ett eget designsystem, och Lolly frågar en gång efter namnet.
- <!--i:download--> **Export** skriver hela systemet som en enda `LollyBrand-….lolly`-fil.
:::

Listen högst upp i studion visar designsystemets namn som ett redigerbart fält. **Enter** behåller ett nytt namn och **Escape** återställer det gamla. När din första ändring ger frågan **What is this design system called?** fyller Lolly i orden från din logotyp, om den innehåller dem. **Save name** behåller namnet; **Not now** behåller en platshållare tills du skriver ett i listen. Namnet används för systemet i Settings och när du byter system, och är namnet på filen som **Export** skriver.

<!--i:eti-grid-->
## Rummen

Studion består av rum utan någon fast ordning. Inget rum är beroende av ett annat. På en dator ligger rummen i en rad under listen. På en telefon flyttas de till ett fält längs nederkanten, där det öppna rummet rullas fram. Palettpanelen och facket öppnas ovanför fältet, och fältet flyttas undan medan du skriver. Med tangentbord når Tab raden i ett steg, och piltangenterna, Home och End flyttar mellan rummen.

![Studions list och dess rum: Board, Colours, Type, Logos, Tokens, Files, Sound, Rules och Skills](/t/url-shot?url=%2F%23%2Fstart&width=1440&height=900&dpi=192&waitMs=1600&cropSelector=.ds-top&waitSelector=.ds-room-nav&format=svg&walker=1&localize=1&dark=1&filename=brand-studio&try=1)

| Rum | Vad du gör där | Länknyckel |
|---|---|---|
| **Board** | Se vad systemet innehåller, med en ingång till varje rum | `overview` |
| **Colours** | Lägg till färger, ge dem roller, skapa nyanser och en palett | `color` |
| **Type** | Välj de fyra typsnitt som appen, verktygen och varje export läser | `type` |
| **Logos** | Placera dina märken i varje orientering och utförande | `logos` |
| **Tokens** | Hörn, avstånd, skuggor och alla andra namngivna värden | `tokens` |
| **Files** | De bild-, ljud- och rörelsefiler ditt varumärke håller | `catalogue` |
| **Sound** | Forma ljudidentitet, musik för olika användningar och relationen till rösten | `sound` |
| **Rules** | Reglerna som ditt varumärke tillämpar, kontrollerade på verkliga exempel | `usage` |
| **Skills** | Varumärkets skriftliga standarder för människor och agenter, att läsa och ladda ner | `skills` |

Länka till ett rum med `#/start?area=<key>`. Rumsnycklarna är permanenta, så Files behåller `catalogue`, Board behåller `overview` och Rules behåller `usage`. `?tab=` fungerar fortfarande som ett äldre alias. En okänd nyckel öppnar Board.

**Listen** har åtgärder för hela systemet. **Add from…** tar in ett varumärke ([Ta in ett varumärke](#bring-a-brand-in)). **Tray** innehåller det som en skanning hittat och som du ännu inte lagt till. **Export** skriver systemet som en fil. **More** innehåller **Tokens (.json)**, **Fonts for Linux (.rpm)**, **Versions & publishing**, **Restore brand settings** och **Design systems**, som öppnar listan i Settings där du byter system ([Behåll och flytta ditt designsystem](#keep-and-move-your-design-system)). Varje åtgärd visas när den har något att arbeta med. På en telefon flyttas **Add from…** till **More** och **Export** visas som sin ikon.

Så länge designsystemet är det som följde med appen börjar listen med **Make it yours**, en meny med **Find a look**, **Add from…** och **Pick a colour**. När systemet är ditt eget tar **Export** den platsen igen.

<!--i:eti-clipboard-->
## Board

När inget ännu är valt erbjuder Board fyra sätt att börja. **Start from a reference** öppnar källväljaren för en logotyp, skärmbild, webbsida eller designfil. **Pick a colour**, **Choose a face** och **Add a logo** öppnar motsvarande kontroller. Att öppna en av dem skriver inget. Nedanför erbjuder **Find a look** färdiga färger och typsnitt att prova, och **Explore the tools** finns där från början.

Så snart något är ditt eget visar Board vad du har, med dina egna antal först. Colours anger antalet färger, med ett nedtonat `· N starter` för dem som följde med. Raden visar dina färger, sedan en tunn linje och sedan de bleka startfärgerna. Colourways visar varje färgvariant som en liten ruta i dess huvudfärg. Type listar varje roll och visar varje familj i sitt eget typsnitt (*Inter för rubriker*, med *Starter för resten* på raden nedanför). Logos anger hur många platser som är fyllda (eller **Not set**), Tokens visar hörnradien och Files anger **Nothing yet** medan biblioteket är tomt. Varje block öppnar sitt rum.

Ett redigerbart designsystem som följde med appen, till exempel Lolly Demo, visar sina färger, färgvarianter, typsnitt och märken på Board från början, med etiketten **Came with this app** bredvid rubriken. Ovanför dem erbjuder **Start here** alternativen **Find a look**, **Add from…** och **Pick a colour**.

### Starter och ditt eget

I varje rum markerar **Starter** allt som följde med appen och som ingen har valt. En ny installation har ingen färg, bara en neutral skala från trycksvärta till papper, så att ytor, text och tunna linjer kan renderas innan någon gör ett val.

::: cols
## Starter

- Följde med appen: de neutrala färgerna från trycksvärta till papper, starttypsnitten och standardradien för hörn.
- Nedtonat, med en **Starter**-etikett och ingen färgton.
- Räknas inte som dina färger. De neutrala färgerna finns i **Tokens** som **Neutrals · starter · 9**, och **Open** visar dem i Colours som en hopfälld grupp (`#/start?area=color&group=neutral`).
- En roll som använder en startfärg visar *"Starter Paper stands in"*, med **Choose…** på sin väljare.

## Ditt eget

- Valt eller installerat av dig.
- Full styrka och ett tonat kort där du installerat ett typsnitt.
- Räknas på Board och i Tokens.
- En roll som följer en annan visar **↳ follows Primary**.
:::

Material som följde med har aldrig en streckad kant. En streckad kant betyder en släppyta.

<!--i:eti-shapes-->
## Logotyper

Släppytan högst upp, **"Drop marks here, or choose several at once"**, tar emot så många filer du har. Lolly läser varje fils form och färger. Filen väntar sedan under **Waiting for a slot** som ett chip som anger vad den liknar, till exempel *"Looks like the Horizontal primary"*, med måttet som användes och en **Place**-knapp (**Replace** där platsen är fylld). När Lolly är osäker säger chipet det och erbjuder **Change slot**, som listar alla åtta. Inget placeras förrän du trycker på en knapp.

Ett märke med onödigt stor tom marginal får först ett erbjudande om beskärning. Svara på erbjudandet eller tryck på Escape för att placera originalet oförändrat. Om ett märke kan fylla en tom syskonplats erbjuder rummet den härledda **mono**- eller **reverse**-versionen som ett chip märkt *Generated*.

Varje märke placeras i ett rutnät med åtta valfria platser, en per **orientering** och **utförande**:

- **Orienteringar:** Horizontal (ordmärke och symbol på en rad) och Vertical (staplade, för kvadratiska och höga ytor).
- **Utföranden:** Primary, Primary reverse (för mörka bakgrunder), Mono (en färg) och Mono reverse.

En grupp utan märken fälls ihop till en rad; öppna gruppen för att se dess platser. Klicka på en plats för att lägga till en PNG, SVG, JPEG eller WebP, eller klicka på en fylld plats för att ersätta märket. En tom plats tar också emot en släppt fil. Horisontella märken ligger i breda rutor och vertikala i kvadrater, var och en på ytan den gjordes för, med en friyta på en fjärdedel av dess höjd. Allt stannar på den här enheten.

![Logotypplatserna med Horizontal och Vertical öppna: varje utförande har en egen plats, och varje plats är valfri](/t/url-shot?url=%2F%23%2Fstart%3Ftab%3Dlogos&system=new-design-system&width=1440&height=1600&dpi=192&waitMs=1600&drive=click%3A.be-logo-identity%3Edetails.be-logo-group--fold%3Anot%28.be-logo-group--custom%29%3Esummary%3Bwait%3A600&cropSelector=.be-logo-grid&format=svg&walker=1&dark=1&filename=bs-logo-slots)

- **Custom marks** är märken som ditt varumärke har egna namn på, till exempel en ikon, en vapensköld eller en favicon.
- **Fler identiteter.** Ett undervarumärke, en produkt eller ett evenemang kan ha en egen komplett uppsättning: tryck på **+ Add another logo** och ge uppsättningen ett namn. Din huvuduppsättning är "Your logo". [Varumärkesarkitekturer](/info/brand-architectures.html) visar när du ska använda en logotypidentitet.
- **Lolly läser logotypens färger.** Ett kort under släppytan och högst upp i Colours listar logotypens färger och frågar **Which is the main colour?**. Den starkaste färgen är vald, aldrig det vita som logotypen exporterades mot. **Use these colours** lägger till dem i din palett och gör huvudfärgen till din primärfärg. När logotypen har en mörk neutral färg som syns tydligt på papper blir den textfärgen. **Not now** lämnar dem i Tray. På en helt ny installation tillämpar Lolly det troligaste svaret direkt, och kortet erbjuder **Undo** eller en annan huvudfärg. En SVG ger exakta färger; en PNG, JPEG eller WebP ger färgerna som täcker en betydande del av märket.

<!--i:eti-palette-->
## Färger

Rummet växer med designsystemet. Vid första besöket behöver du fatta ett beslut; fler kontroller visas när paletten växer.

### Den första färgen

Ett system utan egna färger visar de neutrala startfärgerna i en egen öppen grupp. Högst upp i rummet finns ett streckat fält för att klistra in och släppa: ett stort chip och ett fält. Släpp en bild eller en färglista var som helst på fältet så läser Lolly färgerna.

- **Chipet är väljaren.** **Pick a colour** öppnar studions OKLCH-kort med fältets innehåll som utgångspunkt. Kortet visar först färgens namn och hexvärde. Färgrymderna, hjulet, de fyra vridreglagen och alfa finns under **Fine-tune**, och **Cancel** och **Add colour** finns längst ner. Inget når systemet förrän du trycker på **Add colour**.
- **Fältet tar emot alla notationer**: `#e0452b`, `rgb(224 69 43)`, `oklch(58% .19 32)` eller ett färgnamn. En inklistrad lista blir en rad chip att lägga till ett i taget eller med **Add all**.
- **Två vägar till.** **Pick a colour from the screen** använder pipetten där webbläsaren har en, och **Take colours from an image** läser en skärmbild eller ett foto på den här enheten.
- **Add är aldrig inaktiverad.** När fältet är tomt öppnar den väljaren; text den inte kan läsa får en rad under fältet som anger det.

Din första färg blir **primärfärgen**. Ett chip bekräftar ändringen, till exempel *"Primary is now Vivid Violet"*, med **Fine-tune** för att justera färgen.


### När paletten växer

Dina färger ligger bredvid en **In context**-förhandsvisning på en bred skärm och ovanför förhandsvisningen på en mindre. Förhandsvisningen visar en affisch, ett diagram eller ett gränssnittskort i din palett. Startfärgerna har en egen grupp som fälls ihop när systemet har egna färger. Fältet för att klistra in och släppa blir en kompakt rad. Rummets överdel har ingen export; använd listens **Export** eller rummet Tokens.

![Rummet Colours med Lolly Demo: rollchipen och fältet för att klistra in och släppa högst upp, sedan paletten i hopfällbara grupper, varje färg med sitt namn och hexvärde](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor&width=1440&height=740&dpi=192&waitMs=1800&drive=click%3A%5Bdata-be-roles-fold%5D%3Esummary%3Bwait%3A500&format=svg&walker=1&localize=1&dark=1&filename=brand-colours)

![Rummet Colours med Lolly Demo efter att en färg lagts till: tabellen Colour roles, sedan den nya färgens chip med Use as Lead? och Fine-tune, bredvid en levande förhandsvisning av kompositionen](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dpick&width=1440&height=840&dpi=192&waitMs=1800&drive=click%3A%5Bdata-be-editor-add%5D%3Bwait%3A900&format=svg&walker=1&dark=1&filename=bs-colour-first)

### Färgroller: vad färgerna heter

Designsystemet ger sina färger namn och anger vad varje färg är till för, och Lolly läser båda. **Colour roles** finns högst upp i rummet Colours. **In context** visar varje ändring direkt.

![Tabellen Colour roles för Wefthouse, ett påhittat textilvarumärke, med dess egna ord: färgvariantschipen Indigo, Madder och Weld, sedan Main, Accent, Supporting och Tertiary, var och en med sin ljusa och mörka färg, tolkade som huvudfärgen, den kompletterande färgen och enbart efter namn, och Background, Text, Quiet text och Hairlines listade under tabellen som de användningar ingen roll fyller](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor&system=wefthouse&width=2720&height=2000&dpi=192&waitMs=1800&cropSelector=%5Bdata-be-roles-fold%5D&format=svg&walker=1&dark=1&filename=bs-colour-roles)

Tabellen har fyra kolumner. På en telefon blir varje rad ett kort med ljust och mörkt sida vid sida:

| Kolumn | Vad den innehåller |
|---|---|
| **Role** | Designsystemets eget ord, som du kan redigera direkt, och en rad som anger vad färgen är till för |
| **Light** och **Dark** | Färgen i det utseendet för den valda färgvarianten, med sitt namn eller värde och sin kontrast |
| **Lolly reads this as** | Vad ett verktyg gör med rollen, med Lollys egna ord |

**Så tolkar Lolly en roll.** Varje tolkning tilldelas en roll. Om du väljer en tolkning som en annan roll har flyttas tolkningen till den här rollen. Lolly läser aldrig in betydelse i ett ord.

| Tolkning | Vad den innebär |
|---|---|
| **Lead colour** | Stora former, knappar och den färg ett verktyg använder som huvudfärg |
| **Partner colour** | Den andra färgen ett verktyg använder |
| **Background** | Ligger bakom allt annat |
| **Text** | Rubriker och brödtext |
| **Quiet text** | Bildtexter och finstilt |
| **Hairlines** | Linjer, kantlinjer och avdelare |
| **By name only** | Inget verktyg väljer rollen på egen hand. Den erbjuds i varje färgfält och i Design, där ett val förblir länkat så att det följer färgvarianten |

En tolkning som ingen roll fyller behåller designsystemets definition, och rummet listar de tolkningarna under tabellen. En roll som har samma id som en tolkning, till exempel en roll som heter Primary, är den tolkningen och kan inte flyttas.

**I ett diagram.** Paletten **Design system - colour roles first** i Lolly Chart ger serierna designsystemets färgroller i dess egen ordning, sedan resten av paletten. En roll som tolkas som bakgrund, text, diskret text eller tunna linjer utelämnas, eftersom diagrammet ritar sin bakgrund och sina ord i de färgerna. Inget ändras förrän du väljer den paletten. Ett designsystem utan färgroller visar paletten som **Design system - ordered**.

**Värden.** Tryck på ett värde för att välja rollens färg för det utseendet och den valda färgvarianten. **Same as light** låter det mörka värdet följa det ljusa tills du väljer en mörk färg. Chipet **Aa** visar den text Lolly väljer att placera på färgen. Raden under värdet anger hur läsbar texten är i varje utseende: **Text reads well**, **Large text only** eller **Hard to read as text**. Bedömningen gäller bara text på färgen; färgen kan fortfarande fungera för former och stora ytor. En roll som bara tolkas efter namn visar samma ord utan varningsfärgen, eftersom inget verktyg placerar text på den rollen på egen hand. Verktygstipset och väljaren visar siffrorna, APCA först och WCAG sedan. **Own text colour** markerar ett värde vars fil anger textfärgen; den textfärgen behålls. **Copied** markerar ett värde från en annan färgvariant eller från partnerfärgen som ingen har valt ännu; **Keep this colour** i väljaren bekräftar värdet.

**Utgångspunkter.** Ett designsystem utan egna roller visar de nuvarande orden: Primary, Secondary, Surface och Text. Inget skrivs förrän du ändrar ett av dem. **+ Add a role** föreslår **Primary, Secondary** eller **Main, Accent, Supporting, Tertiary**, eller tar vilka ord du än skriver, och visar tolkningen varje ord skulle få. De två första orden blir huvudfärgen och partnerfärgen. Verktygen fortsätter rita med samma färger. I ett system med en huvudfärg får den första färgvarianten den färgens namn.

**Byta namn, ändra ordning, ta bort.** Ett namnbyte ändrar bara ordet; allt som använder rollen fortsätter fungera. Dra en roll i dess handtag, eller tryck på Space på handtaget, använd piltangenterna och tryck på Space för att släppa. **Remove** talar om vad som fortfarande använder rollen. När verktyg läser rollen låter **Remove and keep those colours** varje tolkning behålla sin nuvarande färg. En egen regel, en guidegrupp, ett verktygsfält eller en annan token som använder rollen behåller rollen tills den användningen ändras. Ett sparat Design-dokument kan också använda en roll efter namn, och Lolly kan inte se det från tokenfilen. Ett sådant dokument rapporterar att färgen inte kan slås upp.

::: details Roller i en handskriven tokenfil
**En handskriven fil.** Färger i en tokenfil som ingen roll deklarerar listas under **In this file, with no role yet**, var och en med ett fält för ett ord och **Make a role**. De fortsätter fungera efter namn i båda fallen. En token med siffror i namnet kan inte vara en roll; den stannar i filen och fortsätter fungera via sin sökväg. Om en post i filen inte klarar valideringen visas tabellen utan kontroller och talar om varför.
:::

**Resten av rummet använder samma ord.** Chipen, färgrutans rad **Use as** och palettens grupp **Colour roles** använder alla designsystemets ord. En färgrolls ruta öppnar dess värde. Exporterade filer registrerar inget nytt om roller; en renderings färger ändras för att dess tokens ändrades.

**Vart orden följer med.** Orden och beskrivningarna följer med designsystemet. Agenter läser dem i designbriefen, `lolly://tokens` och en varumärkessidas `AGENTS.md`. Terminalen visar dem i `lolly system status`. En varumärkessida listar dem i `brand.json` och mäter ett kontrastpar för varje roll. DTCG- och Tokens Studio-filer behåller allt, `DESIGN.md` behåller orden och tolkningarna och ett PowerPoint-tema behåller bara varumärkets ordning. [Färgroller i andra format](/info/design-tokens.html#colour-roles-in-other-formats) har hela listan. Orden citeras alltid som designsystemets data och läses aldrig som instruktioner.

**Där en färg väljs.** Varje färgfält i ett verktyg och i Lolly Design listar designsystemets roller först, i dess egen ordning, med varje ord och dess syfte. **Aa** bredvid en roll väljer färgen som ligger på den rollen. De andra färgerna följer under **Other colours**, utan färgvariantens egna kopior, färgerna som ligger ovanpå och tolkningar som en roll redan fyller. Ett val förblir länkat till rollen och följer färgvarianten. Fältet visar ordet i varje färgvariant, och Settings och Tokens använder också ordet. Ett designsystem utan roller behåller sitt rutnät av färgrutor.

### Varje färg ett verktyg läser

Med **Colour roles** stängt börjar rummet med chip för de första besluten. Varje chip visar rollens färg och namn. I ett system utan egna ord är de **Primary**, **Secondary**, **Surface** och **Text**. Tryck på ett chip för att välja dess färg bland palettens färgrutor. **Every colour a tool reads**, längst ner i **Colour roles**, visar hela raden.

Raden visar de sju färger ett verktyg kan läsa: Primary, Secondary, Surface, Text, Muted, Edge och On primary, med designsystemets egna ord där de finns. Var och en har samma funktion i varje verktyg och export. Ingen måste anges, och vilken färg som helst kan fylla en funktion. Tre fristående färger ger ett bra system. Avläsningen anger hur läsbar texten är mot ytan, APCA först. Varje rad visar din egen färg med full styrka, en startfärg som används tills vidare eller **↳ follows Primary**.

On primary härleds från huvudfärgen, visar **Derived** och har ingen väljare. Växeln **Light** och **Dark** bredvid On primary, och den bredvid **In context**, väljer vilket utseende raden, paletten och förhandsvisningen visar.

Appens egen accentfärg följer designsystemet som standard, genom inställningen **Interface follows the design system** i **Settings → Appearance**. Med inställningen avstängd förblir appens gränssnitt neutralt. Verktyg, ytor och exporter följer designsystemet i båda fallen.

**Färgvarianter.** Ett designsystem kan innehålla flera huvudfärger som väljs per stycke. Raden **Colourways** överst i **Colour roles** visar ett chip per färgvariant, med **Default** på den kanoniska. **+ Add** skapar en ny färgvariant från en palettfärg. Välj ett chip så visar tabellen, raden, paletten och förhandsvisningarna den färgvarianten. Du kan byta namn på, duplicera, ta bort eller göra den valda färgvarianten till standard. I ett system med färgvarianter behöver varje färgvariant en egen primär och sekundär färg, och en egen ytfärg när färgvarianterna färgar bakgrunden. De rollerna förblir angivna i färgrutans redigerare. [Lägg till färgvarianter i ett designsystem](/info/colourways.html#add-colourways-to-a-design-system) beskriver stegen och tokenformatet, och [Lolly Demo i bruk](/info/lolly-demo-in-use.html#colourways-on-real-work) visar färgvarianter på verkligt arbete. Varje person kan välja en färgvariant som sin egen i **Settings → Appearance** ([Gör en färgvariant till din egen](/info/colourways.html#make-a-colourway-your-own)).

### Hitta fler färger

Tre verktyg bygger vidare på din huvudfärg. De två första ger bara förslag; det tredje ersätter paletten.

::: cols
## Utforska nyanser & harmonier

Välj en **Starting colour**, ett **Scheme** (Mono, Complement, Analogous eller Triad) och antal **Shades** (3 till 20, standard 5). **Fine-tune** ställer in gränssnittets intensitet, kontrast och text på varumärkesfärgen. Klicka på en nyans för att lägga till den, eller på **Add 5 shades** för en grupp. Dina färger och roller behålls.

## Hitta matchande färger

Välj en **Harmony**: Complementary, Adjacent, Triad, Tetrad eller Analogous (med **Accents** från 2 till 5 och en **Angle** från 10° till 45°). Varje förslag har ett genererat namn och **+ Add**, ett tryck per färg.

## Bygg om hela paletten

Ersätter paletten utifrån en startfärg, efter en granskning av vad som ändras och vad som behålls.
:::

Alla tre använder samma perceptuella färgmatematik (OKLCH) som motorn. I **Explore shades & harmonies** visar raderna **Primary**, **Neutral** och **Secondary** de föreslagna nyanserna, och **Theme preview** visar ljusa och mörka exempel med deras kontrastvärden.

![Tre föreslagna nyansgrupper, med individuella kontroller för att lägga till och en separat Theme preview](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dgenerate%26seed%3D%2523e0452b&width=1440&height=1400&dpi=192&waitMs=1800&css=.start-head%7Bdisplay%3Anone%7D&cropSelector=.be-preview&format=svg&walker=1&dark=1&filename=bs-colour-ramps)

![Genererade accentfärger, var och en med en färgruta, ett automatiskt genererat namn, sitt hexvärde och en Add-knapp](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dgenerate%26seed%3D%2523e0452b&width=1440&height=900&dpi=192&waitMs=1800&css=.start-head%2C.be-colour%7Bdisplay%3Anone%7D&drive=click%3A.be-generate-detail%3Anot%28%5Bdata-be-rebuild%5D%29%20%3E%20summary%3Bwait%3A500&cropSelector=.be-candidates&walker=1&format=svg&dark=1&filename=bs-harmony-candidates)

### Tillämpa en genererad palett

Öppna **Rebuild the whole palette…** och tryck på **Preview full rebuild**. Granskningen räknar hur många roller som behåller din tilldelning, hur många av dina egna färger som behålls och hur många nyanskurvor, trycklåsningar, dolda nyanser och toningsstopp som förankras om eller behålls. **Apply rebuilt palette** tillämpar ändringarna; **Cancel** ändrar inget. Efteråt erbjuder kortet **Undo**, som redan har fokus, och kontrollpunkten som togs före bytet återställer hela systemet.

Ett system med färgvarianter behåller varje färgvariant genom en ombyggnad. Den kanoniska färgvarianten följer den nya startfärgen, och varje annan färgvariant behåller sina egna färger, sitt namn, sin ordning och sina inställningar. Granskningen listar vilken färgvariant som följer med och vilka som behåller sina färger. Lolly bygger inte om ett system som kodar sina färgvarianter på ett sätt det inte kan redigera; kortet talar om varför, och inget ändras.

### Expertavsnitten

Fyra hopfällda avsnitt ligger under förhandsvisningen och rollerna. Vart och ett öppnas med `#/start?area=color&focus=<name>`:

- **Explore shades & harmonies** (`focus=generate`).
- **Shade curves** (`focus=curves`) formar om en nyansskala punkt för punkt, med separata kurvor för ljushet, kromaticitet och nyans (L / C / H), och nyanserna ritas om medan du drar.
- **Contrast** (`focus=contrast`): **Contrast-lock** ändrar tonerna i en nyansskala för att nå APCA-mål mot en bakgrund du väljer, och **Rotate hue** vrider hela nyansskalan runt hjulet.
- **Print** (`focus=print`) ställer in vad huvudfärgen blir i tryck: dess automatiska värde, en låst CMYK-blandning eller en namngiven dekorfärg.

### Paletten och varje färgruta

Paletten listar dina färger i hopfällbara grupper, var och en med en egen **+ Add**. Du kan skapa grupper och byta namn på dem. En roll skapar aldrig en andra ruta; rutan en roll pekar på visar rollens namn, till exempel **Primary**. **Colour chart** under rutorna visar samma färger på OKLCH-hjulet **Wheel** (dra en punkt för att ändra färg, klicka på en tom yta för att lägga till en färgruta) och i diagrammet **Gamut**, som visar var det visningsbara omfånget slutar. `#/start?area=color&focus=chart` öppnar diagrammet.

![Palettpanelen, där varje grupp kan fällas ihop](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dgenerate%26seed%3D%2523e0452b&width=1440&height=1000&dpi=192&waitMs=1800&drive=click%3A%5Bdata-be-roles-fold%5D%3Esummary%3Bwait%3A500%3Bclick%3A%5Bdata-be-add-ramp%3D%22primary%22%5D%3Bwait%3A1200&cropSelector=.be-split-side&walker=1&format=svg&dark=1&filename=bs-palette-pane)

![OKLCH-hjulet - vinkeln är nyansen, avståndet utåt är kromaticiteten och gråtonerna ligger längs en ljushetsskala vid sidan](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dgenerate%26seed%3D%2523e0452b&width=1440&height=900&dpi=192&waitMs=2400&css=.start-head%2C.be-pal%2C.be-gradients%7Bdisplay%3Anone%7D&drive=click%3A%5Bdata-be-add-ramp%3D%22primary%22%5D%3Bwait%3A1200%3Bclick%3A%5Bdata-be-chart%5D%20summary%3Bwait%3A900&cropSelector=.be-pal-wheel&walker=1&format=svg&dark=1&filename=bs-colour-wheel)

Klicka på en färgruta för att öppna dess redigerare:

- **Rename** byter namn på färgrutan.
- **Set the colour** ställer in färgen med OKLCH-reglage, eller i **Hex**, **HSL**, **RGB** eller **CMYK**. Värdefältet läser och skriver i den aktiva färgrymden. CMYK här ställer in skärmfärgen genom konvertering; använd **Print substitutes** för att låsa exakta tryckfärger.
- **Stored as** väljer hur färgrutan sparas: **LCH** (standard, perceptuell och med stort färgomfång), Hex, RGB eller HSL.
- **Use as** ger färgrutan en roll, med designsystemets egna ord där de finns. Tryck på en markerad roll igen för att rensa rollen.
- **Print substitutes** (hopfällt): lås **CMYK** från **Auto** till exakta tryckfärgsvärden, eller ange en **Spot colour** med ett **Name** (till exempel `PANTONE 186 C`), en valfri **Book** och en **Finish** för foliering, prägling, nedsänkt prägling, partiell lack, soft touch eller stansning, bigning eller perforering. En tryckpress använder dessa låsningar när du exporterar en CMYK-PDF eller TIFF; se [Färgprofiler](/info/exporting.html#colour-profiles). En dekorfärg trycks på en egen plåt i en Print PDF; för att trycka varje dekorfärg som processfärg i en export, se [Dekorfärger som processfärger](/info/exporting.html#spot-inks-as-process).
- **In other spaces** (hopfällt): ett värde per färgrymd, härlett eller angivet av dig, och ett eget angivet värde har företräde vid export.

**Att ta bort en färgruta** är säkert. Härledda nyanser och temaroller döljs, så inget som läser dem slutar fungera. Färger du har lagt till tas bort.

::: details Arbeta med många färgrutor
I viloläget visar en färgruta sin färg, sitt namn och sitt hexvärde. Select visar varje färgrutas kryssruta och draghandtag på alla skärmar, och en ruta med tangentbordsfokus visar också sitt handtag. Dra i ett handtag för att ändra ordningen inom en grupp, eller sätt fokus på handtaget, tryck på Space, använd piltangenterna och tryck på Space igen för att släppa; Escape avbryter. På en telefon visar paletten fyra färger per rad. För att flytta färger mellan grupper använder du redigerarens kontroll **Group** eller markerar flera och använder **Move to**.

Markering behöver ingen separat växel: fältet och kryssrutorna visas med den första markerade rutan och försvinner med den sista.

- **Dra på en tom yta** för att rita en rektangel; varje ruta den vidrör läggs till i markeringen, även i andra grupper. Ett hopfällt avsnitt lägger inte till något.
- **Skift-klick** markerar ett intervall i läsordning, **Cmd/Ctrl-klick** växlar markeringen för en ruta och ett vanligt klick öppnar redigeraren.
- Varje grupprubrik har **Select all**, och **Cmd-A** med fokus på en ruta markerar varje färg du äger, aldrig en startfärg.
- Rutnätet har ett tabbstopp: pilarna flyttar, Skift-pilar utökar, Space växlar markering, Delete tar bort och Escape rensar. Tryck först på `l`, `c` eller `h` för att finjustera en kanal.
- På en pekskärm trycker du och håller på en ruta för att börja markera, och trycker sedan för att lägga till.

Fältet visar **{n} selected**, sedan **Move to**, **Give a role** (varje färg får nästa roll i turordning), **Download** (markeringen i något av de sex palettformaten), **Duplicate** (en kopia av varje, placerad efter originalet), **Copy values** och **Delete**. En kopia öppnas i redigeraren; flera förblir markerade. Ett Cmd/Ctrl-Z ångrar en massåtgärd.
:::

### Toningar

Den valfria panelen **Gradients** bygger blandningstokens från paletten. Varje toning har en förhandsvisning, 2 till 8 namngivna stopp och en vinkel. Ett stopp pekar på en färgruta, så ändrar du färgrutans färg följer toningen med. Blandningar görs i OKLCH.

Palettens nedladdningar (designtokens, CSS, SCSS, GIMP och Adobe Swatch Exchange) finns överst i paletten. [Ta med din palett och dina typsnitt överallt](/info/using.html#take-your-palette-and-fonts-anywhere) beskriver varje format.

<!--i:eti-type-->
## Typografi

Utan ett eget typsnitt visar rummet ett kort: **Primary**, satt i lässtorlek med sitt nuvarande typsnitt, med etiketten **Starter**, knappen **Choose for Primary** och raden *"Inget installeras förrän du väljer ett."* Rubriker, kod och kursiv följer huvudtypsnittet tills du väljer dem; **Choose them separately** visar deras kort.

![Rummet Type utan valt typsnitt - ett kort i lässtorlek med en Starter-etikett och en fylld Choose for Primary-knapp](/t/url-shot?url=%2F%23%2Fstart%3Ftab%3Dtype&system=new-design-system&width=1440&height=740&dpi=192&waitMs=1800&format=svg&walker=1&dark=1&filename=brand-type)

Välj ett typsnitt så öppnar rummet fyra rollkort, listan Fonts och ett levande typsnittsprov:

- **Primary**: brödtext, knappar och varje verktyg.
- **Headings**: rubriktypsnittet för `h1` och `h2`.
- **Code**: ett typsnitt med fast teckenbredd för kod och data.
- **Italic**: en äkta kursiv för betoning, citat och utvikningar.

Ett kort är tonat bara där du har installerat det typsnittet. Dess knapp visar rollen: **Change Headings** på ett eget typsnitt och **Choose for Headings** överallt annars. Exempelraden radbryts. Inget på ett kort tillämpar en ändring; knappen öppnar jämförelsevyn för den rollen.

![De fyra rollkorten visas - vart och ett satt med det typsnitt som används för rollen, med en Starter-etikett där ingen har valt ett och Italic som följer huvudtypsnittet](/t/url-shot?url=%2F%23%2Fstart%3Ftab%3Dtype&system=new-design-system&width=1440&height=1000&dpi=192&waitMs=2600&drive=click%3A%5Bdata-be-typemore-toggle%5D%3Bwait%3A600&cropSelector=.be-typecard-grid&walker=1&format=svg&dark=1&filename=bs-type-specimen)

### Jämförelsevyn

Vyn öppnas under kortet du tryckte på. Korten fälls ihop till en remsa på en rad så att vyn syns direkt på en telefons skärm. Escape avbryter och flyttar tillbaka fokus till kortet.

1. Tryck på **Choose for** och rollen på kortet.
2. Skriv ett familjenamn och tryck på **Preview**, eller tryck på en av de sex **Pinned**-familjerna under fältet.
3. Tryck på **Use this face**.

![Jämförelsevyn öppen under sitt kort, med sökraden, de fästa familjerna och korten hopfällda till en remsa på en rad](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dtype%26focus%3Dstage&width=1440&height=740&dpi=192&waitMs=1800&format=svg&walker=1&dark=1&filename=bs-type-stage)

**Samtycke begärs en gång.** Första gången en förhandsvisning kontaktar Google Fonts förklarar en dialog: *Google får veta familjenamnet och din IP-adress. Filen sparas sedan på den här enheten och används offline. Det här är det enda steget i studion som kontaktar en tredje part.* **Fetch from Google** fortsätter och valet sparas. **Cancel** lämnar kortet med texten *"Inte hämtat. Inget skickades till Google."* och en egen **Fetch from Google**.

**Släpp en typsnittsfil i vyn** (TTF, OTF eller WOFF) för att förhandsvisa ett licensierat typsnitt du äger. I båda fallen stannar typsnittet på den här enheten, renderas offline i appen, verktygen och varje export och följer med i designsystemfilen. Allt på Google Fonts levereras med en öppen licens (OFL, Apache eller UFL).

### Typsnitt på den här enheten

Panelen **Fonts** listar varje typsnitt på den här enheten och rollen det fyller. Typsnitt du har lagt till kommer först, under **In the design system**, vart och ett med sina roller och en borttagningsknapp. Starttypsnitten följer på en nedtonad, hopfälld rad. **Add a face** öppnar jämförelsevyn för valfri roll. Panelen **Type roles** visar ett levande typsnittsprov för varje roll med dess familj och tillstånd, till exempel *Inter* eller *Inter · follows Primary*.

<!--i:eti-tag-->
## Tokens

Tokens är de namngivna värdena bakom designsystemet: färger, typsnitt, logotyper, hörn och avstånd. Verktyg läser dem efter namn, så en ändring här når varje verktyg direkt.

![Rummet Tokens: överdelen med ett exempel från systemet och filåtgärderna, rutor som räknar varje typ av token, sedan färgparen med sina kontrastvärden](/t/url-shot?url=%2F%23%2Fstart%3Ftab%3Dtokens&width=1440&height=740&dpi=192&waitMs=1600&format=svg&walker=1&dark=1&filename=brand-tokens)

- **Överdelen** ger ett exempel från ditt eget system (*Primary är Spearmint, #033633*) och filåtgärderna: **Download** (systemet som designtokens, eller paletten i fem andra format), **Copy CSS** och **Add from…** för att läsa in en JSON-fil igen.
- **Rutor** räknar varje typ av token och hoppar till dess avsnitt: Colours, Type, Logos, Shape and spacing, More och All tokens. Ett avsnitt som bara innehåller det som följde med den tomma startmallen har etiketten **Starter**; ett system som följde med appen räknar sitt eget material utan etiketten. På en telefon fördelas rutorna på två rader med tre i varje.
- **Colours** börjar med paren verktygen sätter ihop (text på yta, på huvudfärg, nedtonad på yta) med ett APCA-värde i ljust och mörkt, och markerar **Weak contrast** där ett par inte räcker till. Sedan kommer varje färggrupp: en nyansskala som en rad chip, andra färger med sitt värde och referensen verktygen använder, till exempel `{color.brand.spearmint}`. Tryck på en referens för att kopiera den. **Edit in Colours** öppnar en grupp i rummet Colours. I ett designsystem med [färgroller](#colour-roles-what-the-colours-are-called) kommer **Colour roles** först, med varje roll en gång i systemets egna ord och ordning. En roll behåller en färg för varje färgvariant och utseende. De färgerna listas med rollen, inte som separata färger; ändra dem i tabellen Colour roles.
- **Type** och **Logos** listar typsnittet för varje roll och varje logotypplats, med **Edit in Type** och **Edit in Logos** när du har egna.
- **Shape and spacing** innehåller **Rounded corners** (`shape.radius`) och **Spacing rhythm** (`space.base`). Var och en visar *Lolly default* tills du flyttar reglaget och *Yours* efteråt, sparas direkt och kan ångras.
- **More tokens** lägger till avstånd, storlekar, linjebredd, opacitet, rotation, vanliga tal och skuggor, lagrade som vanliga [designtokens](/info/design-tokens.html).
- **App appearance (advanced)** listar färgerna, storlekarna och skuggorna som Lollys egna skärmar använder, och **Inspect every token (advanced)** söker och redigerar alla lagrade värden och visar först varje ändring för granskning. Där listas en färgrolls värden i varje färgvariant med rollen: välj rollens token för att se en rad per färgvariant, ljust och mörkt sida vid sida. Raden med antal anger hur många värden rollerna innehåller. Ett skrivskyddat designsystem visar samma lista.

Ett tomt avsnitt erbjuder **Pick a colour**, **Choose a face** eller **Add a logo**.

<!--i:eti-images-->
## Filer

Släpp filerna ditt varumärke använder, utöver logotyper: **vektor**, **bild**, **ljud** och **rörelse** (video, Lottie och animationer). De visas i [Assets](/info/using.html#assets-your-library), sorterade i avsnitt, och i varje verktygs tillgångsväljare. De stannar på den här enheten.

## Ljud

**Sound** väljs genom att lyssna. Rummet öppnas med tre startljud, **Calm**, **Steady** och **Bright**, vart och ett som ett kort i sin genres färger med en uppspelningsknapp. Spela ett för att höra ett kort utdrag; när ett annat startar stoppas det första. **Choose** gör det ljudet till ljudet för varje användning. Det fjärde kortet, **Mixed**, ger varje användning sitt eget ljud: Calm för Explain, Steady för Demonstrate och Bright för Play. Dess uppspelningsknapp spelar de tre i turordning. Inget sparas förrän du väljer **Save sound**. Ljudet blir då en del av designsystemet, med en kontrollpunkt i samma historik som de andra rummen använder. Ett designsystem utan ljud fortsätter fungera som förut.

En användning är ett tillfälle då ljudet spelas: **Explain**, **Demonstrate** och **Play** till att börja med. Varje användning är ett chip med en egen uppspelningsknapp. **Music** eller **With narration** ovanför chipen bestämmer om ett chip spelar bara musiken eller musiken under en röst. Användningen du väljer visar sitt syfte och sin musik i enkla ord, till exempel "Varm · 84 bpm · Rhodes, rullande bas, dammiga trummor". Varje användning får det valda ljudets genre, tempo och instrument (eller sina egna med Mixed). Varje användning behåller sin egen melodi och sin egen balans: Explain låter melodin lämna plats åt en röst, och Play låter melodin leda. Att växla mellan Mixed och ett enda ljud behåller båda. En användning du har lagt till själv behåller ljudet den har under Mixed. Designsystemet registrerar vilket du valde. **Add a use** lägger till en och låter dig skriva namnet på plats. **Make main** väljer den användning som spelas när inget annat anges. **Another tune** spelar en ny komposition med samma inställningar.

**Edit in the music generator** öppnar [musikgeneratorn](/info/generated-music.html#the-music-generator) med den användningens inställningar och en rad överst som säger vems ljud du redigerar. **Save to this use** för tillbaka inställningarna till rummet; **Cancel** återvänder utan att något har ändrats. Osparade val i rummet väntar medan du är borta. Om någon sparar ljudet i en annan flik under tiden gäller den nyare sparningen och din ändring lämnas bort.

**Voice** väljer en röst för användningen, talhastigheten och hur hög musiken är under rösten; **Hear the voice with the music** spelar båda. Under **More** finns sänkningen medan rösten talar, orden att prova (de stannar i rummet), uttalsanteckningar (en per rad, som skrivet = uttalat) och anteckningar om rösten. Förhandsvisningar använder den lokala talmodellen och samma mixning som en sekvensexport. En förhandsvisning tonar ut; den är inte ett komponerat slut.

**Notes and signature** innehåller vad du ska lyssna efter i en användning och en ljudsignatur: en fast inledning eller avslutning som sparas som en egen ljudfil. Placera signaturen i din sekvens; genererad musik innehåller aldrig signaturen. Ett krav som den här versionen av Lolly inte kan kontrollera stoppar ny musik för den användningen.

**Details** innehåller varumärkets karaktär (hur ljudet ska kännas, vad som förblir detsamma och vad som ska undvikas) och lyssningsgranskningen. **Record a listening review** sparar granskarens namn, datumet och anteckningarna för den sparade versionen av ljudet. Varje ändring gör ljudet till ett utkast igen. En granskning gäller den versionen, inte varje melodi som senare skapas från ljudet: lyssna på varje nytt stycke innan det skickas ut.

**Make a music project** öppnar användningen i musikgeneratorn som ett projekt som behåller användningen, ljudversionen och de exakta inställningarna. **New tune** där skapar en ny komposition och behåller ljudet. Om du ändrar inställningarna återgår **Put the sound back** till ljudet, och **Keep as my own** fortsätter med en fristående melodi. Tills du väljer kan projektet inte sparas eller laddas ner som skapat från ljudet. Delningslänkar innehåller bara musikinställningarna. Projektet och en sparad melodi behåller också ljudets anteckningar, som inte följer med i delningslänkar eller ljudfilens offentliga ursprungsuppgifter. Behåll en renderad inspelning när det exakta ljudet måste bestå genom framtida versioner av generatorn.

<!--i:eti-checklist-->
## Regler

**Rules** anger vad människor kan ändra, vad som förblir fast och vad Lolly kan kontrollera.

![Rules i Lolly Demo: fyra egna regler, var och en markerad med Checked in Design och Required eller Advisory, sedan Try your design system in use med sina exempel redo att renderas](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dusage&width=1440&height=1200&dpi=192&waitMs=2400&cropSelector=%23start-panel-usage&format=svg&walker=1&dark=1&filename=bs-usage-rules)

**Brand rules** listar dina regler. **Add rule** (eller **Add your first rule**) öppnar ett kort formulär:

- ett **Rule name** med dina egna ord, till exempel *Beacon-accenter*;
- **Check**: **Colour choices**, **Font choices**, **Fixed artwork** eller **Text length**, med varumärkesrollen den använder, under ditt eget namn på rollen;
- det **Example** den gäller för (Poster, Title slide, Content slide eller Lolly Chart), **Mode** och om den är **Required** eller **Advisory**;
- **Reviewed by**, sedan **Save draft** eller **Approve & save**.

Godkännandet registrerar ditt eget beslut på den här enheten. Godkända obligatoriska regler begränsar den återanvändbara affischen, och kontrollerna omfattar bara exempelbilderna i PNG; de ändrar inget annat verktyg.

Regler i ett designsystems tokenfil, till exempel godkända färgpar, textvikt och justering eller en logotyp per yta, listas här som **Checked in Design**. Lolly Design kontrollerar dem lager för lager i exportpanelens kort **Before you export**, och `lolly check` gör samma sak för ett sparat Lolly Design-dokument ([Innan du exporterar](/info/design.html#before-you-export)). En regel som den här versionen inte har någon kontroll för behålls som den levererades och markeras som **Unchecked**.

Lolly Demo har fyra godkända egna regler. Rubriker sätts aldrig i versaler: den regeln är obligatorisk, så `lolly check` rapporterar en rubrik i versaler som ett fel. De andra tre är rekommendationer. Brödtext är vänsterjusterad. Primära logotyper placeras på ljusa ytor och negativa logotyper på mörka. Streckade linjer betyder släpp här.

**Try your design system in use** renderar fyra exempel från den aktuella revisionen med **Render & check examples**. Välj ett **Mode** och **Try your own text** för rubriken, den stödjande texten och texten på presentationsbilden. Varje exempel rapporterar vad som mättes, med **See checks & sources** och **Download check report**. **Make reusable poster** laddar ner en `.lolly` som innehåller sin fasta layout och sina godkända indataval. Exemplen är lokala: att köra en kontroll publicerar och godkänner inget.

En version som levereras med ett fast varumärke visar samma regler och exempel skrivskyddade, under *This brand is set*.

<!--i:eti-graduation-cap-->
## Färdigheter

**Skills** listar det aktiva designsystemets [varumärkesfärdigheter](/info/brand-skills.html): varumärkets skrivna standarder, en per disciplin, för människor och AI-agenter. Varje rad anger disciplinen, varumärkets egen status (**Draft** eller **Approved**), om färdigheten är offentlig eller intern och dess revision. Välj en rad för att läsa färdigheten med dess täckning, som jämför färdighetens rader med dina tokens: vad Lolly kontrollerar, vad som strider mot dem, vad som stämmer och vad som bara är vägledning.

**Download skill (.zip)** skriver färdigheten som en Agent Skills-mapp för ett agentverktyg, med kataloglänkar som pekar på denna Lolly. **Copy as one file** lägger samma text i urklipp för ett chattfönster. Ett designsystem utan egna färdigheter listar en grundversion som Lolly skriver utifrån dess tokens och egna regler varje gång grundversionen läses. Rummet läser färdigheter och redigerar dem aldrig.

<!--i:eti-upload-->
## Importera ett varumärke

**Add from…** i fältet öppnar en väljare som frågar vad du har, inte vilket format det är:

- **Design tokens or a design file**: DTCG- eller Tokens Studio-JSON, ett Penpot-projekt, en zip med tokenuppsättningar, ett Lolly-designsystempaket, en SVG, en `DESIGN.md` eller en mapp med en varumärkessida.
- **PDF**: en presentation eller en fil med riktlinjer, vars färger, logotyper och inbäddade typsnitt läses på den här enheten.
- **Logo or screenshot**: en bild blir en föreslagen palett, läst på den här enheten. Färgerna läses, inte typsnittet eller layouten.
- **Saved web page**: en HTML-fil och dess CSS-filer, eller inklistrad HTML eller CSS, upp till 20 filer och 2 MB. Bara texten du anger läses: länkade resurser hämtas inte och skript körs inte.
- **Font file**: TTF, OTF eller WOFF. Öppnar rummet Type, där typsnittet installeras.
- **Website**: en sida, vars färger och typografi läses. Den här rutan visas bara på en enhet som kan läsa en sida, och anger vilken läsare den använder: appen på den här enheten, eller webbläsartillägget i en bakgrundsflik, inloggat som du. Att skriva en URL fyller bara i fältet; att trycka på hämta ger samtycke.

Välj designfil som källa så listar nästa kort de format som stöds som ikonrutor. Kortet är en enda släppyta. Du kan också släppa en fil på studion.

![Importkortet - formaten som stöds visas först som ikonrutor, och hela kortet är en enda släppyta](/t/url-shot?url=%2F%23%2Fstart%3Fsource%3Dfile&width=1440&height=900&dpi=192&waitMs=1600&css=.start-import-modal%20.modal-msg%2C.start-import-modal%20.modal-title%7Bdisplay%3Anone%7D&cropSelector=.start-import-drop&walker=1&format=svg&dark=1&filename=bs-brand-import-formats)

- Ett **Lolly-designsystempaket** (`.lolly`, eller en äldre `.zip`) installeras i ett steg.
- En **Penpot**-export (`.penpot`) tar med sina designtokens.
- En **Design Tokens**-fil (W3C DTCG) eller **Tokens Studio**-fil (`.json`) tar med sina tokens. En beskrivning som ber en läsare att ignorera instruktioner, hävdar behörigheter eller ber om att köra kod utelämnas, och importen anger var den fanns.
- En **vanlig SVG** skannas efter färger du kan välja bland, där den första blir din huvudfärg.
- En **`DESIGN.md`** (`.md`) går till **Try these colours** med sina tokens som de är skrivna. Dess prosa kan behållas som ett utkast till en varumärkesfärdighet, och kortet flaggar rader som ber en läsare att ignorera instruktioner, hävdar behörigheter eller ber om att köra kod. Agenter och varumärkessidor ser inte ett utkast förrän du trycker på **Keep this skill** i rummet Skills, och en behållen färdighet förblir intern.
- En **mapp med en varumärkessida**, vald som mapp, släppt eller zippad, går till samma granskning. Varje fil kontrolleras mot mappens `brand.json`; en fil som inte stämmer gör att hela mappen avvisas. Importen lägger till tokenvärdena. Logotyper och typsnitt stannar i mappen.

::: warning Instruktionskontrollen läser rad för rad
Kontrollen som utelämnar instruktioner i en tokenfils beskrivningar läser rad för rad och missar andra formuleringar. Läs en fil från någon du inte känner innan du tillämpar dess tokens.
:::

Lolly läser en varumärkessida från filer du tillhandahåller. Det hämtar inte en annan webbplats adress.

### En fil med egna färgord

En tokenfil eller en `DESIGN.md` kan använda egna ord för sina färger, till exempel main, accent, supporting och tertiary. När Lolly hittar sådana ord listar granskningen varje ord innan något tillämpas: ordet, dess färg i varje utseende, den token det kom från och Lollys föreslagna tolkning. Lolly föreslår tolkningar enbart utifrån orden, mot en kort lista, utan någon modell. Ett ord som inte finns i listan kommer in som varumärkets eget, **By name only**. Du kan byta namn på vilket ord som helst, ange vad det är till för, ge det en annan tolkning eller avmarkera det för att behålla det som en namngiven färg.

**Install with these roles** skriver rollerna; **Install without roles** installerar filen som den kom. En fil utan sådana ord hoppar över det här steget. En fil som anger sina egna roller, till exempel en som Lolly har skrivit, visar dem som de är skrivna och installerar dem oförändrade; du kan redigera dem senare i rummet Colours. Terminalen har ingen granskning: `lolly system import` behåller en angiven post och lämnar andra filers ord som namngivna färger.

### Granska en referens

En logotyp, skärmbild, webbplats eller sparad sida öppnar **Try these colours**: ett exempel i de föreslagna färgerna, en **Main colour** du kan ändra och ett namn för ett nytt system. En ruta anger vad som händer när du tillämpar: de aktiva tokeninställningarna **ersätts** med den genererade paletten och standardstilarna, dina typsnitt och biblioteksfiler **behålls** och det tidigare systemet kan **återställas**. **Apply suggested settings** tar en kontrollpunkt och tillämpar sedan de ljusa och mörka paletterna. **Restore brand settings** kan återställa de gamla inställningarna. **Change reference** väljer en annan källa.

::: details Vad en referens läser och rapporten om designkontext
**Palette, source details and individual choices** visar vad som lästes, eventuella typsnittsnamn som hittades och förhandsvisningens kontrast. Typsnittsnamn är bara förslag; du installerar ett typsnitt i Type. Källuppgifterna kan innehålla typografi, mellanrum, utfyllnad och hörnvärden där de observerats, annars märkta **Not observed**. En sparad sida eller en webbplats läst i appen rapporterar deklarerade stilar, som sidan kanske inte använder. Webbläsartillägget kan rapportera uppmätta stilar från ett urval av synliga element. Det här är observationer: inget installeras, och källans avstånd ersätter aldrig dina egna. **Choose individual items in the tray** behåller enskilda objekt. **Download design context** sparar en JSON-rapport med observationer, föreslagna tokens och källinformation (med en SHA-256 för eventuell tillhandahållen HTML eller CSS). Rapporten innehåller ingen rå sidtext och är inte en signerad Content Credential.
:::

Importer av PDF- och designfiler behåller sina egna granskningskontroller. Objekt i **Tray** ändrar inget förrän du lägger till dem i rummet som hanterar den sortens material. `#/start?source=<kind>` öppnar väljaren med en källa (`file`, `pdf`, `image`, `font`, `url`, `page`), och `?import` öppnar den vanliga listan.

### Hitta och jämför ett utseende

Öppna **Find a look** från Board eller från designsystemlistan i Settings. Bläddra bland system som sparats på den här enheten och några återanvändbara Lolly-exempel, och sök efter namn, färgtagg eller deklarerat typsnitt. **Closest to my current palette** sorterar efter uppmätt färglikhet, med matchande typsnitt som avgör vid lika resultat; det är inget kvalitetsbetyg.

Klicka på ett utseende för att förhandsvisa det i sitt sammanhang; förhandsvisning ändrar inget. **Use this look** på ett kort tillämpar det utseendet. Ett sparat system blir det aktiva, vilket inte redigerar något. Ett exempels färger läggs in i det öppna designsystemet efter den vanliga kontrollpunkten. Systemets logotyper, typsnitt och allt annat som exemplet inte definierar förblir som de är. **Compare looks** lägger till en kryssruta på varje kort: välj två för att jämföra sida vid sida. **Restore brand settings** återställer det tidigare utseendet. Sparade system har redigerbara **Search tags** under **Details and design context**. Exemplen är Lollys egna färgrecept, utan någon skrapad samling och utan konto.

![Lolly Compare visar Sunroom och Orchard sida vid sida innan något av färgsystemen tillämpas.](/t/url-shot?url=%2F%23%2Fstart&width=1280&height=900&dpi=96&waitMs=3000&format=svg&filename=brand-compare-looks&try=1&drive=click%3A%5Bdata-ds-door%3D%22looks%22%5D%3Bwait%3A500%3Bclick%3A%5Bdata-looks-compare-toggle%5D%3Bclick%3A%5Bdata-look-select%3D%22example%3Asunroom%22%5D%3Bclick%3A%5Bdata-look-select%3D%22example%3Aorchard%22%5D%3Bclick%3A%5Bdata-looks-review%5D%3Bwait%3A500&cropSelector=.ds-looks-comparison&waitSelector=%5Bdata-ds-door%3D%22looks%22%5D&walker=1&rasterDpi=96)

<!--i:eti-package-->
## Behåll och flytta ditt designsystem

### Flytta ett varumärke mellan enheter

**Export** skriver en **`LollyBrand-….lolly`**-fil: dina tokens, typsnitt, logotyper och temainställningar, med ett integritetsmanifest som kontrolleras vid import. Webbversioner före 1.0.7 gav filen ändelsen `.zip`, och Lolly accepterar fortfarande den formen. **Tokens (.json)** skriver det rena dokumentet med designtokens, utan typsnitt eller logotyper, för ett kodarkiv, ett byggsteg eller ett annat tokenverktyg.

För att importera ett igen använder du **Add from… → Design tokens or a design file**, eller släpper filen på studion. Så lämnar en kollega över ett varumärke till dig, eller så tar du med ett till en andra installation, utan konto och utan moln. [Arbeta med partner](/info/partners.html) beskriver vad mer du bör skicka när personen som tar emot ditt varumärke arbetar för en annan organisation. För att importera ett varumärke från kommandoraden, se [`ingest:brand`](/info/configuration.html#brand-packs).

**Fonts for Linux (.rpm)** paketerar typsnitten du har lagt till i en installerbar RPM. Om du själv laddade upp något av dem ber Lolly dig först att bekräfta att du får distribuera dem vidare.

### Återställ tidigare inställningar

Öppna **More** i fältet, välj **Restore brand settings**, välj en daterad kontrollpunkt och tryck på **Restore**. Det återställer färger, typografiinställningar och andra tokens för det aktiva varumärket; typsnitts- och bildfiler förblir som de är. Lolly sparar först dina nuvarande inställningar som **Before restore**, så att du kan ångra en återställning även efter att ha stängt webbläsaren. De senaste 20 kontrollpunkterna sparas på den här enheten. En ändring som görs medan studion visar **Saving…** överlever en omladdning, och ett kort erbjuder att återställa ändringar som inte hann sparas klart.

### Versioner

En publicerad version är en **permanent, namngiven kopia** som sparas på den här enheten. Den ändras aldrig, så ett verktyg eller en länk som låser sig till den (med `designv`) fortsätter rita samma sak. Ett system med något eget listar **Versions & publishing** i fältets meny **More**; efter din första publicering läggs **Versions** till bland rummen. `#/start?area=versions` öppnar Versions.

::: warning En publicerad version är permanent
Det går ännu inte att ta bort den, och panelen säger det. Publicering kan inte ångras; återställning kan det. *Restore latest from this version* är en vanlig ändring, med **Undo** tillgängligt direkt.
:::

**Borttagningar visas först på kompatibilitetskortet**, eftersom en borttagen token får ett verktyg att sluta fungera.

**Publish only** behåller en version utan att ändra vad verktygen följer; **Publish and make active** får verktygen och appen att följa den versionen. **Follow the latest again** låter varje ändring slå igenom direkt.

### Publicera en varumärkessida

En [varumärkessida](/info/brand-page.html) är en adress för människor och agenter: en sida med logotyper, färger, typografi och exempel, med samma fakta i filer bredvid. **Publish a brand page**, under Versions & publishing, visar den levande sidan och, bredvid sidan:

- **Goes public**: varje fil, grupperad, med sin storlek.
- **Held back**: vad som utelämnades och varför. En logotyp utan registrerad licens utelämnas tills du kryssar för logotypens namn. En typsnittsfil behöver en registrerad licens som tillåter vidaredistribution, och sidan visar ett konturerat typsnittsprov när filen utelämnas. Interna varumärkesfärdigheter visas aldrig.
- **What was checked**: färgpar per färgvariant och läge, samt de egna reglerna. Det här är mätningar, inte ett omdöme.
- **In your words**: en användningsförklaring och en kontakt. Sidan visar vad du skriver och Lolly lägger inte till någon licens eller något juridiskt anspråk. En växel stänger av raden "Made with Lolly" i sidfoten.
- **On exports**: en växel som [registrerar sidans adress i det här designsystemets exporter](/info/brand-page.html#lead-back-from-your-files). Växeln är av tills du slår på den, kräver en `https`-adress och följer inte med i ett paket eller en kopia. Ett låst designsystem visar inte växeln, eftersom dess ansvariga bestämmer.

**Download folder** sparar mappen som en ZIP som du kan vara värd för där du vill. Inget blir offentligt förrän du lägger upp mappen. I en terminal skriver `lolly system publish --out=<dir>` samma mapp. En instans som tillhandahåller varumärkessidor erbjuder också **Publish to** dess adress: ett uttryckligt tryck, genom instansens godkännandekedja när den har en. Ett hanterat designsystem publiceras bara när dess ansvariga tillåter det.

### Anslut en agent

**Connect an agent**, på samma ställe, ger dig text att klistra in och talar om vad varje alternativ kan göra:

- **`AGENTS.md`** i ett projekt: agenter läser systemets namn och regler. Den ritar inget och behöver ingen server.
- **Lolly's public server**: ritar med Lolly Demo, oavsett vilket system du har öppet här. Den behöver ingen nyckel.
- **Your instance**: ritar med systemen som instansen innehåller och läser en tjänstetoken från en miljövariabel. Bladet anger variabelns namn och visar aldrig någon token.

När ingen värdbaserad server ritar med ditt system säger bladet det.

<!--i:eti-layers-->
## Hantera dina designsystem

Öppna **Settings → Preferences → Design systems** för att byta, lägga till eller ta bort system. **Open** väljer ett system och öppnar det här; **Make a new one** skapar ett lokalt system och öppnar det med namnfältet redo. Ett system är aktivt åt gången, för hela enheten. [Varumärkesarkitekturer](/info/brand-architectures.html) hjälper dig att avgöra när ett varumärke behöver ett eget designsystem.

**Var ett system kommer från.** Systemet som en installations katalog tillhandahåller visar **Came with this app**, eller **From this instance** i en app som är ansluten till en. Fäll ut **Catalogue source** för att se vem som tillhandahåller det, dess tokentillgång och namnrymd och dess kända version eller kontrollsumma; om en uppdatering misslyckas märks cachelagrat material ut.

**Hanterade system är skrivskyddade.** Ett system visar **Managed by this instance** (eller **Managed by this app** i skrivbordsappen utan instans) när dess katalog låser systemet. Du kan använda och ladda ner ett hanterat system. När du öppnar ett här visas ett meddelande om skrivskydd med **Make an editable copy** och **Switch**, sedan dess färgroller och tokens utan redigeringskontroller. Dina egna lokala system förblir redigerbara, även när det hanterade systemet kom först. En version med ett fast varumärke öppnar Lolly Design System Setup på *This brand is set*, med varumärkets tokens och användningsregler att läsa.

**Alla andra medföljande system är dina** att dölja, redigera och återställa, inklusive Lolly Demo och Lolly Starter på lolly.tools. När du redigerar ett behålls namnet och raden markeras med **Edited here**. **Reset to original** i dess meny tar bort ändringarna som gjorts på den här enheten. Den tomma startmallen är undantaget: en första ändring där skapar ett eget designsystem, och Lolly frågar en gång efter namnet. [Lolly Demo i bruk](/info/lolly-demo-in-use.html#switch-to-your-own) visar vad ditt eget system ersätter.

### Ta bort ett designsystem

Välj **Remove** i ett systems meny; bekräftelsen talar om vilket system som blir aktivt efteråt. Sparade sessioner, uppladdningar och material som delas med ett annat system behålls.

Att ta bort ett medföljande system döljer bara systemet: dess katalogtillgångar finns kvar, **Bring back** visar det igen och det kommer tillbaka av sig självt om du tar bort allt annat. Att ta bort en importerad eller redigerad kopia tar inte bort det medföljande systemet, dess logotyper eller dess typsnitt. Om kopian var aktiv blir det medföljande systemet aktivt igen. Att ta bort en aktiv värdbaserad kopia rensar bara den kopians anslutning; en separat vald instans förblir vald.

::: details Ändra ett designsystem som en server tillhandahåller
Att ändra vad en server tillhandahåller är en administratörsuppgift: dess operatör ändrar källkatalogen och driftsätter på nytt, eller så granskar och tillämpar en Lolly Work-administratör en serverändring. Ändringar här förblir lokala, med ett undantag. På en Lolly Work-instans som ger dig `brand.edit` erbjuder ett hanterat system också **Edit for** den instansen, vilket öppnar en redigeringskopia. **Send to** den instansen i **Versions** skickar tillbaka dess färger, färgvarianter, färgroller och varumärkessidans adress. [Redigera den här instansen från studion](/info/work-design-system-administration.html#edit-this-instance-from-the-studio) beskriver vad en redigering kan ändra och hur instansen tillhandahåller ändringen. Se [Ta bort ett katalogdesignsystem](/info/configuration.html#removing-a-catalogue-design-system) och [Konfiguration](/info/configuration.html#supplied-and-local-design-systems).
:::

<!--i:eti-code-->
## Använd designkontext utanför appen

**Download design context** sparar tokendokumentet, upplösta färgvärden, deklarerade typsnittsfamiljer, tillgångs-id:n, källbelägg där de har registrerats, täckning och uttryckliga regler, utan typsnittsfiler och utan bevis på ägande. Kommandoraden läser filen utan server: `lolly system import` gör den till terminalens designsystem och `lolly system check` kontrollerar indata för Lolly Design mot den sparade kontexten. [Ta med ditt designsystem](/info/cli.html#bring-your-design-system) beskriver importen och [Vilket designsystem ett kommando använder](/info/cli-decks.html#which-design-system-a-command-uses) beskriver kontrollen. En MCP-klient läser samma brief från `lolly://design-context` ([MCP-server](/info/mcp.html)).

<!--i:eti-map-pin-->
## Gå vidare

- **[Använda Lolly](/info/using.html)**: verktygen, att spara, dela och Assets.
- **[Varumärkesarkitekturer](/info/brand-architectures.html)**: hur divisioner, produkter, varumärken med avsändarstöd, kunder och säsonger motsvarar designsystem, färgvarianter och logotypidentiteter.
- **[Arbeta med partner](/info/partners.html)**: dela ditt varumärke med en partner och arbeta i ett varumärke du har fått.
- **[Varumärkessidor](/info/brand-page.html)**: publicera ditt designsystem på en adress, som ett presskit och ett agentkit.
- **[Designtokens](/info/design-tokens.html)**: tokenmodellen ditt varumärke är skrivet i.
- **[Exportera en fil](/info/exporting.html)**: tryckenheter, CMYK och formaten ditt varumärke renderas till.
