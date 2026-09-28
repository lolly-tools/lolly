# Varumärkesstudion

**Varumärkesstudion** på `#/start` är den enda platsen där du formar ditt varumärke - dess loggor, färger, typsnitt, resten av dina tokens och filerna det håller. Ställ in det här en gång så följer varje verktyg, sida och export det *per konstruktion*, inte genom granskning.

Ändringar förhandsvisas **live i hela appen** medan du gör dem, så att du kan se en färg eller ett typsnitt landa överallt innan du bekräftar det. Allt sker på enheten: dina varumärkesfiler och tokens lämnar aldrig din dator (att välja ett Google-typsnitt hämtar den familjen från Google, en gång, efter en samtyckesdialog), och varumärket reser i en enda [varumärkespaket](#move-a-brand-between-devices)-fil.

> **Det här är redigeraren. Instrumentpanelen är spegeln.** Fliken **Designsystem** på instrumentpanelen (`#/d`) *visar* ditt varumärke skrivskyddat; du *redigerar* det här på `#/start`. Om du vill ändra en färg senare, kom tillbaka till Varumärkesstudion.

## Rummen

Studion är en uppsättning **rum** listade i en rad längs sidan - inte steg. Inget är numrerat, inget är spärrat mot något annat och att komma till vilket som helst av dem är legitimt:

- **Översikt** - navet. Vad som finns just nu, i ett ögonkast, med en dörr in till varje rum.
- **Färger** - lägg till färger en i taget, tilldela roller eller generera en hel palett från en enda.
- **Typografi** - de fyra snitt appen, verktygen och varje export läser.
- **Logotyper** - dina märken, i varje riktning och variant.
- **Tokens** - hörnradie, spacing, shadows och resten av systemet.
- **Filer** - bild-, ljud- och rörelsefilerna ditt varumärke håller.

På en telefon blir samma lista en horisontell chipsrad fäst under rubriken. Att byta rum laddar aldrig om något - redigeraren håller alla sina paneler monterade och visar helt enkelt den du bad om.

**Djuplänka ett rum** med `#/start?area=<key>`. Nycklarna är `overview`, `color` *(observera den amerikanska stavningen i URL:en)*, `type`, `logos`, `tokens`, `catalogue` (Filer-rummet - panelnyckeln är ett permanent kontrakt, så URL:en behåller det gamla namnet) och `versions`. `?tab=` är det sedan länge etablerade aliaset för samma sak och fungerar fortfarande, så gamla länkar och bokmärken fortsätter att fungera; allt okänt öppnar Översikt i stället för att köra fast.

Fästa vid **radens nederkant** finns åtgärderna som hör till hela designsystemet snarare än till ett enda rum:

- **Lägg till från…** - källväljaren, för att ta in ett varumärke från en fil, en PDF, en bild, ett typsnitt eller en webbplats. Se [Ta in ett varumärke](#bring-a-brand-in) nedan.
- **Bricka** - kandidaterna en skanning hittat men ännu inte fört in. Den förblir dold tills en skanning faktiskt behåller något, och bär då ett antal; inget i den ändrar ditt varumärke förrän du trycker på Add på den raden.
- **Exportera** - skriver hela designsystemet som en enda `LollyBrand-….lolly`.
- **Tokens (.json)** - det rena design-tokens-dokumentet för sig, för ett repo, ett byggsteg eller ett annat tokens-verktyg.
- **Restore brand settings** - gå tillbaka till en kontrollpunkt sparad före en import eller ett byte av varumärkesinställningar.
- **Versioner** - publicera, aktivera och återställ namngivna kopior av designsystemet. Dolt tills det finns något eget att publicera (eller en `?area=versions`-länk ber om det med namn).

![Studions rumsrad - Översikt, Färger, Typografi, Logotyper, Tokens och Filer](/t/url-shot?url=%2F%23%2Fstart&width=1440&height=900&dpi=192&waitMs=1600&cropSelector=.ds-rail&waitSelector=.ds-rail&format=svg&walker=1&localize=1&dark=1&filename=brand-studio&try=1)

## Översikt

Översikt är det första rummet, och det har två ansikten.

Med **inget valt än** säger den **Gör den till din**. **Start from a reference** öppnar källväljaren för en logotyp, skärmbild, webbsida eller designfil. **Välj en färg**, **Välj ett snitt** och **Lägg till en logotyp** öppnar sina befintliga kontroller direkt. Varje väg börjar med ett val; att öppna en skriver ingenting. **Utforska verktygen** är tillgängligt direkt.

Så snart något är ditt eget visar samma rum **vad du har**, med de antal du skapat i täten. Färger läser av antalet färger designsystemet bär, och lägger till en dämpad `· N starter` bara där det finns ärvda färger att visa; remsan bredvid lägger dina egna valda färger först, sedan en hårlinje och de bleknade standardfärgerna. Typografi läser av per roll (*Inter för rubriker*, med *Standard för resten · SUSE, SUSE Mono* under). Logotyper läser av hur många platser som är fyllda, eller **Inte inställd**. Tokens bär hörnradien, taggad *standard* tills du flyttar den. Filer säger **Inget ännu** medan biblioteket är tomt. Varje block är en dörr in till sitt rum. Det finns antal här, aldrig en förloppsindikator och aldrig ett slutkort - inget i den här studion är skyldigt.

## Loggor

Börja med att tömma din mapp med märken i släppzonen högst upp: **"Släpp märken här, eller välj flera på en gång"** tar så många filer du har i en enda omgång. Varje fil läses för sin form och sitt bläck, och köas sedan under **Väntar på en plats** som ett chip som säger vad den tror - *"Ser ut som Horisontell primär"*, med det mått den gick på, och en knapp **Placera** (**Ersätt**, där den platsen redan är fylld). Där den är osäker säger chippet det rakt ut och erbjuder **Byt plats** i stället, som listar alla åtta. Inget placeras förrän du trycker på något.

Två saker händer runt den kön. Ett märke med överflödig tom marginal får ett **beskärningsförslag** först - besvara det eller tryck Escape så går originalfilen in orörd. Och där ett märke kan förse en tom syskonplats erbjuder rummet den härledda **mono**- eller **omvänd**-versionen som ett eget chip, märkt *Genererad*, som försvinner igen om du fyller den platsen på ett annat sätt.

Under det finns rutnätet varje märke hamnar i - platser för **orientering × behandling**:

- **Orienteringar:** Horisontell (ordmärke + symbol i rad) och Vertikal (staplad, för kvadratiska och höga ytor).
- **Behandlingar:** Primär, Primär omvänd (för mörka bakgrunder), Mono (en färg) och Mono omvänd.

Det är åtta valfria platser. Klicka på en plats för att lägga till en PNG, SVG, JPEG eller WebP; klicka på en fylld plats för att ersätta den. Varje plats är valfri och allt stannar på den här enheten.

![Logomatrisen - varje orientering längs toppen, varje behandling som sin egen streckade plats, alla valfria](/t/url-shot?url=%2F%23%2Fstart%3Ftab%3Dlogos&width=1440&height=1600&dpi=192&waitMs=1600&cropSelector=.be-logo-grid&format=svg&walker=1&dark=1&filename=bs-logo-slots)

- **Egna märken** - lägg till märken ditt varumärke kallar vid sitt eget namn (en ikon, ett emblem, en favicon) under **Egna märken**; namnge det och välj en fil.
- **Fler identiteter** - ett undervarumärke, en produkt eller ett event kan ha sin egen fullständiga uppsättning logotyper. Använd **+ Add another logo** och namnge den; din huvuduppsättning heter helt enkelt "Your logo".
- **Ladda upp en SVG så läser Lolly dess färger.** På en helt ny installation sätter den tyst din primärfärg från logotypen och säger det. På ett befintligt varumärke erbjuder den istället färgen som ett förslag - *"Hittades i logotypen: #…"* med en **Använd som primär**-knapp bredvid - borta i Färger-rummet, där du kan ta den eller avfärda den.

## Färger

Rummet växer med designsystemet. Inget du inte behövt än finns på sidan, så ett första besök är ett enda beslut, och resten kommer i takt med paletten.

### Den första färgen

Ett designsystem utan egna färger öppnas i en enda centrerad kolumn: **Start with one colour**, ett stort levande färgprov, ett fält och en tyst rad som säger att roller, nyanser och tryckinställningar kommer i takt med att systemet växer.

- **Färgprovet är väljaren.** Tryck på det så öppnas studions egen OKLCH-panel på färgprovet, förifylld med det fältet innehåller: ett namn, hjulet, de fyra ratterna, alfa och **Sparas som**, med **Avbryt** och **Lägg till färg** längst ner. Att dra en ratt målar färgprovet och skriver om fältet medan du gör det, och inget når designsystemet förrän du trycker på **Lägg till färg**.
- **Fältet tar valfri notation** - `#e0452b`, `rgb(224 69 43)`, `oklch(58% .19 32)` eller ett vanligt färgnamn - och en hel *lista* med färger blir en rad färgprov du lägger till en i taget.
- **Två dörrar till sitter bredvid.** Pipetten (i en webbläsare som har en) hämtar en färg från skärmen, och **Från en bild** läser en skärmbild eller ett foto på den här enheten och erbjuder de färger den hittar.
- **Lägg till är aldrig inaktiverad.** Med inget läsbart i fältet öppnar den väljaren, vilket är vad en tom tryckning oftast betyder; text den inte kan tolka får en rad under fältet som säger det, istället för en död knapp.

Den första färgen blir **primärfärgen**, och färgprovet som svarar på tillägget säger det - *"Primärfärgen är nu Vivid Violet"* - med **Finjustera** bredvid.

![Färger-rummet med inget valt än - ett stort levande färgprov, ett fält och en rad om vad som kommer senare](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor&width=1440&height=740&dpi=192&waitMs=1800&format=svg&walker=1&localize=1&dark=1&filename=brand-colours)

### Standard

**Standard** är ordet för allt som kom med appen istället för att väljas. En helt ny installation bär ingen färg alls: vad den har är en enda neutral ramp, bläck genom papper, så att ytor, text och hårlinjer renderas innan någon bestämt något. De neutrala är byggnadsställning, så de räknas inte som färger och ritas inte i palettpanelen. De bor i [Tokens](#tokens)-rummet som **Neutrala · standard · 9**, med en **Öppna** som visar dem i Färger-panelen som en hopfälld, taggad grupp (`#/start?area=color&group=neutral`).

Samma ord går igen i varje rum: en roll som vilar på en standardfärg läser *"Standard Paper fyller in"* och dess väljare erbjuder **Välj…**; ett standardsnitt bär en **Standard**-tagg och ingen ton; en standardhörnradie är taggad på Översikt. Ärvt material ritas aldrig med en streckad kant, för en streckad kant betyder ett släppmål här.

### När paletten växer

Dina färger ligger bredvid en **In context**-förhandsgranskning på en bred skärm och staplas ovanför den på mindre skärmar. Förhandsgranskningen kan visa en affisch, ett diagram eller ett gränssnittskort som använder din palett. Standardfärger stannar i sin egen hopfällbara grupp, skild från färger du lägger till.

Lägg till enskilda färger eller en uppsättning nyanser, tilldela deras roller och öppna de avancerade avsnitten när du behöver dem. Färgdiagrammet, gradienterna och nedladdningskontrollerna finns kvar med paletten.

![Färger-rummet efter att en färg lagts till, med dess palett och en levande kompositionsförhandsgranskning](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dpick&width=1440&height=840&dpi=192&waitMs=1800&drive=click%3A%5Bdata-be-editor-add%5D%3Bwait%3A900&format=svg&walker=1&dark=1&filename=bs-colour-first)

### Roller - det verktygen läser

**Roller** är lagret ovanpå färgproven: vilken färg som spelar vilken del i varje verktyg och export. Roller är valfria (ett designsystem med tre lösa färger och inga roller är fullt godtagbart), vilket färgprov som helst kan ta en, och kontrastavläsningen mäts mot ytan, APCA först.

En rad läses i ett av tre register, så remsan aldrig påstår ett beslut ingen tagit:

- en egen färg som fyller rollen, i full styrka;
- **Standard *Paper* fyller in** - dämpad, med **Välj…** i sin väljare;
- **↳ följer Primär** - rollen löses upp via primärfärgen istället för till en egen färg.

Så snart paletten har nyanser växer remsan till alla sju platser ett verktyg kan läsa: Primär, Sekundär, Yta, Text, Dämpad, Kant och På primärfärg. På primärfärg härleds från primärfärgen, läses som **Härledd** och saknar väljare.

**Appens egen accentfärg är en preferens, inte en token.** Som standard följer gränssnittet designsystemet och chrome-accenten tar primärfärgen. Det är en Utseende-inställning på [din profil](/info/profile.html) - **Gränssnittet följer designsystemet** - och att stänga av den lämnar chrome neutralt. Verktyg, arbetsytor och exporter påverkas inte i något fall, och typsnitten och hörnradien följer designsystemet oavsett om inställningen är på eller av.

### Expertflyglarna

Fyra hopfällda avsnitt sitter under kompositionsförhandsgranskningen och färgrollerna. Öppna den du vill; var och en är djuplänkningsbar som `#/start?area=color&focus=<wing>`, som öppnar den oavsett vad rummet annars visar:

- **Explore shades & harmonies** (`focus=generate`) - en färg till en hel uppsättning nyanser. Beskrivs nedan.
- **Nyanskurvor** (`focus=curves`) - forma om en ramp punkt för punkt. Ljushet, kroma och nyans får varsin kurva, växlas med L / C / H, och nyanserna nedanför bakas om live medan du drar.
- **Kontrast** (`focus=contrast`) - **Kontrastlås** omtonar en ramp för att träffa APCA-mål mot en bakgrund du väljer, varje steg behåller sin egen nyans och kroma; **Vrid nyans** vrider hela rampen runt hjulet, varje nyans behåller sin ljushet och kroma.
- **Print** (`focus=print`) - vad primärfärgen blir i tryck: dess automatiska skärmvärde, eller ett fäst CMYK-bygge eller en namngiven dekorfärg istället.

### En färg, en hel palett

Inuti **Explore shades & harmonies**, välj en **Startfärg**. Lolly föreslår matchande nyanser med samma perceptuella färgmatematik (OKLCH) som motorn använder på andra ställen. Finjustera förslagen:

- **Schema** - Mono, Komplement, Analog eller Triad - avgör hur sekundärfärgen förhåller sig till primärfärgen.
- **Nyanser** - ett reglage från 3 till 20 (standard 5) styr hur många steg varje ramp genererar.
- **Finjustera** (hopfälld) - **UI-intensitet** (Dämpad / Djup), **Kontrast** (Komfort / Hög) och **Text på varumärke** (Auto / Ljust / Mörkt).

Att ändra startfärgen och kontrollerna ändrar bara förslagen. Klicka på en nyans för att lägga till den färgen, eller **Add 5 shades** för att lägga till en grupp (antalet följer din Nyanser-inställning). Befintliga färger och roller ligger kvar. Ångra tar bort tillägget.

Raderna **Primär**, **Neutral** och **Sekundär** visar de föreslagna nyanserna. Öppna **Theme preview** för att inspektera ljusa och mörka exempel och deras kontrastvärden. Välj ett Neutral- eller Sekundär-steg där för att justera de föreslagna temaankarna. Att bygga om hela paletten förblir en separat, granskad åtgärd nedan.

![Tre föreslagna nyansgrupper, med individuella lägg-till-kontroller och en separat Theme preview](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dgenerate%26seed%3D%2523e0452b&width=1440&height=1400&dpi=192&waitMs=1800&css=.start-head%7Bdisplay%3Anone%7D&cropSelector=.be-preview&format=svg&walker=1&dark=1&filename=bs-colour-ramps)

### Bygg paletten (harmonigenerator)

I **Find matching colours** föreslår harmonigeneratorn matchande accentfärger utifrån primärfärgen. Välj en **Harmoni** - **Komplementär**, **Angränsande**, **Triad**, **Tetrad** eller **Analog** (som har sitt eget **Accenter**-antal, 2 till 5, och en nyans-**Vinkel** från 10° till 45°) - och varje kandidat kommer med ett automatgenererat, läsbart namn och en **+ Add**-knapp. Att lägga till en placerar den färgen i paletten direkt, ett tryck till en token. **In context** förhandsgranskar dina tillagda färger på exempelkompositioner.

![Genererade accenter, var och en med ett färgprov, ett automatgenererat namn, dess hex-kod och en Add-knapp](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dgenerate%26seed%3D%2523e0452b&width=1440&height=900&dpi=192&waitMs=1800&css=.start-head%2C.be-colour%7Bdisplay%3Anone%7D&drive=click%3A.be-generate-detail%3Anot%28%5Bdata-be-rebuild%5D%29%20%3E%20summary%3Bwait%3A500&cropSelector=.be-candidates&walker=1&format=svg&dark=1&filename=bs-harmony-candidates)

### Att spara en genererad palett

Att lägga till en föreslagen färg eller nyansgrupp behåller resten av din palett. För ett fullständigt utbyte, öppna **Rebuild the whole palette…** och tryck på **Preview full rebuild**. Granskningen förklarar ändringarna: hur många roller som ligger kvar som du tilldelat dem, hur många färger du själv lagt till som behålls, hur många nyanskurvor som förankras på nytt, hur många trycklås som fästs om, hur många dolda nyanser som förblir dolda, hur många gradientstopp som behåller sin färg.

**Apply rebuilt palette** på det kortet för den i mål; **Avbryt** går därifrån och ändrar ingenting. När den väl körts erbjuder kortet **Ångra** med fokus redan på den - och en kontrollpunkt av hela designsystemet tas *innan* bytet, så att "lägg tillbaka det som det var" blir en återställning istället för en förlorad eftermiddag.

### Paletten, diagrammet och varje färgprov

Paletten listar designsystemets färger i hopfällbara grupper, var och en med sin egen **+ Add**-kontroll. Skapa och byt namn på grupper för att organisera ditt arbete. En roll skapar aldrig en andra ruta: en token är en ruta, och en ruta en roll pekar på bär istället ett litet hörnmärke (**P**, **S**, **Su**, **T**). Under rutorna fäller **Färgdiagram** upp två vyer av samma färgprov: **Hjul** (OKLCH-hjulet - dra en punkt för att omfärga den, klicka på en punkt för att redigera den eller klicka på tomt utrymme för att släppa ett nytt färgprov) och **Färgomfång**-diagrammet, som visar var det visningsbara omfånget faktiskt slutar. `#/start?area=color&focus=chart` öppnar kortet direkt, precis som `?wheel` alltid har gjort.

![Färgpaletten, varje grupp fällbar, med nedladdningspillret placerat längs nederkanten](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dgenerate%26seed%3D%2523e0452b&width=1440&height=1000&dpi=192&waitMs=1800&drive=click%3A%5Bdata-be-add-ramp%3D%22primary%22%5D%3Bwait%3A1200&cropSelector=.be-split-side&walker=1&format=svg&dark=1&filename=bs-palette-pane)

![OKLCH-hjulet - vinkeln är nyans, avståndet ut är kroma och gråtonerna följer en ljushetsskala nedför sidan](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dgenerate%26seed%3D%2523e0452b&width=1440&height=900&dpi=192&waitMs=2400&css=.start-head%2C.be-pal%2C.be-gradients%7Bdisplay%3Anone%7D&drive=click%3A%5Bdata-be-add-ramp%3D%22primary%22%5D%3Bwait%3A1200%3Bclick%3A%5Bdata-be-chart%5D%20summary%3Bwait%3A900&cropSelector=.be-pal-wheel&walker=1&format=svg&dark=1&filename=bs-colour-wheel)

Klicka på valfritt färgprov för att öppna dess redigerare:

- **Rename** den.
- **Set the colour** - väljaren öppnas med perceptuella **OKLCH**-reglage, med lägen för **Hex**, **HSL**, **RGB** och **CMYK**; värdefältet läser *och* skriver i vilket utrymme som än är aktivt, så du kan klistra in en hex-kod eller skriva in färgprocent. Observera att CMYK sätter *skärm*-färgen via konvertering - för att låsa exakta färger, använd tryckläset nedan.
- **Stored as** - välj hur färgprovet lagras: **LCH** (standard - perceptuellt, brett färgomfång, det bästa valet för redigering), Hex, RGB eller HSL. Åsidosätt det när du behöver låsa en exakt äldre hex-kod eller matcha ett sRGB-värde.
- **Use as** - ge det här färgprovet direkt en av varumärkesrollerna, utan att gå tillbaka till Roles-panelen. (En rolls egen platta erbjuder det inte - en roll kan inte ta en roll.)
- **Print substitutes** (infälld) - lås färgens trycktbeteende:
  - **CMYK** - växla den från **Auto** till **Locked** för att åsidosätta den automatiska sRGB→CMYK-konverteringen med exakta färgvärden (C/M/Y/K, 0–100).
  - **Spot colour** - växla den från **None** till **Set** för att låsa färgprovet till en dekorfärg; ge den ett **Name** (t.ex. `PANTONE 186 C`), en valfri **Book** och en valfri **Finish** (Ordinary ink som standard) för när färgen inte är en färg alls - en folie, en präglad eller nedsänkt relief, en spotlack, en mjuktouch eller en stans, vikning eller perforering.
- **In other spaces** (infälld) - samma idé i vidare form: varje rad är ett utrymme det här färgprovet kan uttryckas i, antingen härlett från det kanoniska värdet eller angivet av dig, och ett angivet värde vinner vid export.

Dessa trycklås är det ett tryckeri använder när du exporterar en CMYK-PDF eller TIFF - se [Exportera](/info/exporting.html#colour-profiles).

**Deleting a swatch** är säkert: härledda rampsteg och temaroller *döljs* (den underliggande token fortsätter att slå upp värdet, så inget längre fram går sönder), medan färger du själv lagt till tas bort helt.

### Att arbeta med många färgprov

Varje färgprov har ett eget draghandtag. Dra det för att ändra ordning på färger inom dess grupp, eller fokusera det, tryck på Blanksteg, använd piltangenterna och tryck på Blanksteg igen för att släppa. Escape avbryter. Ordningen överlever att studion öppnas igen och kan ångras. För att flytta färger mellan grupper, använd färgprov-redigerarens **Group**-kontroll eller markera flera färger och använd **Flytta**. Tokennamn och rollreferenser förblir intakta.

Markering i palettpanelen är en gest, inte ett läge. Det finns ingen knapp att trycka på först, och fältet dyker upp med den första markerade rutan och försvinner med den sista.

- **Dra på panelens tomma yta** för att rita en rektangel: varje ruta den rör vid går med i markeringen, över gruppgränser. Ett hopfällt avsnitt bidrar med ingenting, och en dragning som aldrig rör sig rensar markeringen.
- **Shift-klick** tar intervallet i läsordning; **Cmd/Ctrl-klick** växlar en ruta; ett vanligt klick öppnar fortfarande den rutans redigerare.
- Varje gruppheader bär **Markera allt**, och **Cmd-A** med en ruta i fokus tar varje färg designsystemet äger - aldrig en standardfärg.
- Rutnätet har ett tabbstopp. Pilar går igenom det, Shift-pilar utökar markeringen, Blanksteg växlar en ruta, Delete tar bort markeringen och Escape rensar den. (Pilar flyttar bara fokus: för att knuffa en kanal, tryck på `l`, `c` eller `h` först, som avläsningen säger.)
- På en pekskärm finns ingen rektangel. Håll ner en ruta för att starta en markering, tryck sedan för att lägga till; **Markera allt** per grupp tar resten.

Fältet självt läser **{n} selected**, sedan **Flytta till** (en befintlig grupp, eller en ny du namnger i menyn), **Ge en roll** (varje markerad färg tar nästa roll i tur och ordning, så fyra rutor fyller alla fyra roller i ett tryck), **Ladda ner** (markeringen i valfritt av de sex palettformaten), **Kopiera värden** (en rad per färg i dess sparade notation) och **Radera**. Flytta till och Ge en roll dyker upp så snart paletten har nyanser att flytta runt. Ett Ctrl/Cmd-Z ångrar en hel massåtgärd - en flytt av fyrtio, en rollrunda, en radering - och en radering säger vad den behöll, eftersom en markering når rutor det här rummet inte tar bort.

### Gradienter

En valfri **Gradienter**-panel bygger blandningstokens från paletten för bakgrunder och accenter. Hoppa över den helt om designsystemet inte använder gradienter. Varje gradient har en förhandsgranskning, namngivna stopp (2–8) och en vinkel. Det viktiga beteendet: **ett stopp refererar till ett färgprov**, så omfärga det färgprovet och gradienten följer med. Interpolationen körs i OKLCH för rena övertoningar. Ta bort ett stopp för att korta av förloppet.

### Ta med paletten någon annanstans

Det flytande pillret placerat längs palettpanelens nederkant laddar ner hela paletten som **Designtokens (JSON)**, **CSS-variabler**, **CSS-klasser**, **SCSS-variabler**, en **GIMP-palett (.gpl)** eller en **Adobe Swatch Exchange (.ase)** - så att designsystemet släpps rakt in i Illustrator, Figma, GIMP eller ett stilmallsdokument. Det sitter utanför panelens rullningsyta, så det behåller sin plats hur långt paletten än rullas, och det dyker upp så snart paletten har nyanser. (Du kan också ladda ner paletten från [Tillgångar](/info/using.html#assets-your-library).)

## Typsnitt

Det här rummet växer på samma sätt. Utan ett eget snitt är det ett kort och ett beslut: **Primary**, satt i läsbar storlek i det snitt som tjänar det idag, en **Standard**-tagg bredvid namnet, en fylld **Välj ett snitt** och raden *"Inget installeras förrän du väljer ett."* Under kortet ligger *"Rubriker, kod och kursiv följer primärfärgen tills du väljer dem"*, med **Choose them separately** som avslöjar de andra tre korten för resten av besöket.

![Typografi-rummet med inget snitt valt än - ett kort i läsbar storlek, en Standard-tagg på det och en fylld Välj ett snitt](/t/url-shot?url=%2F%23%2Fstart%3Ftab%3Dtype&width=1440&height=740&dpi=192&waitMs=1800&format=svg&walker=1&dark=1&filename=brand-type)

Välj ett snitt så öppnar sig rummet till **fyra rollkort**, listan Fonts och det levande exemplet. De fyra snitten är de som appen, verktygen och varje export faktiskt läser:

- **Primary** - brödtext, knappar och alla verktyg.
- **Headings** - visningstypsnittet för `h1`/`h2`.
- **Code** - ett typsnitt med fast breddsteg för kod och data.
- **Italic** - en riktig kursiv motsvarighet för betoning, citat och sidokommentarer.

Rubriker, kod och kursiv faller alla tillbaka på primärfärgen tills du tilldelar dem, så ett designsystem med ett enda snitt behöver inga beslut alls här.

**En ton betyder att du valde den.** Ett kort är tonat bara där du installerat det snittet. Ett standardsnitt bär samma **Standard**-tagg som palettens ärvda grupper bär, i det dämpade registret och utan ton, och en roll ingen valt läser **↳ follows Primary** istället för att upprepa primärfärgens namn som om den hade valts. Knappen säger **Ändra** på ett eget snitt och **Välj ett snitt** överallt annars. Inget på ett kort binder något: knappen öppnar **jämförelseytan** avgränsad till den rollen.

![De fyra rollkorten synliga - vart och ett satt i det snitt som tjänar det, med en Standard-tagg där ingen valt ett och Italic som följer primärfärgen](/t/url-shot?url=%2F%23%2Fstart%3Ftab%3Dtype&width=1440&height=1000&dpi=192&waitMs=2600&drive=click%3A%5Bdata-be-typemore-toggle%5D%3Bwait%3A600&cropSelector=.be-typecard-grid&walker=1&format=svg&dark=1&filename=bs-type-specimen)

### Jämförelsevyn

![Jämförelseytan öppen under sitt kort, med sökraden, de fästa familjerna och korten hopfällda till en enradsremsa](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dtype%26focus%3Dstage&width=1440&height=740&dpi=192&waitMs=1800&format=svg&walker=1&dark=1&filename=bs-type-stage)

Ytan öppnas **infogad i rummet**, inte i en dialogruta, och direkt under kortet du tryckte på. Medan den är uppe fälls korten ihop till en enradsremsa med roll och snitt, så att ytan finns på första skärmen även på en telefon. Escape avbryter och lämnar tillbaka tangentbordet till kortet du öppnade den från.

Att välja ett snitt är tre tryckningar:

1. **Välj ett snitt** på kortet.
2. Skriv ett familjenamn och tryck på **Förhandsvisning** - eller tryck på en av de sex **Fästa**-familjerna under fältet, ett tryck vardera. Kortet visas redan under inläsning, med en skelettrad där exemplet kommer att vara, istället för att gränssnittssnittet står in för ett snitt du inte sett än.
3. **Använd den här stilen**.

**Samtycke frågas en gång, vid den tryckning du gjorde.** Första gången en förhandsvisning når Google Fonts säger en dialogruta vad som händer: *Google får veta familjenamnet och din IP-adress. Filen behålls sedan på den här enheten och används offline. Det är det enda steget i studion som når en tredje part.* **Hämta från Google** går vidare och kommer ihåg valet. **Avbryt** lämnar kortet med *"Inte hämtad. Inget skickades till Google."* med sin egen levande **Hämta från Google**, så att ändra sig är ett tryck på själva kortet. Inget kort visar någonsin en död knapp: oavsett vilket läge det är i säger dess enda primärknapp vad nästa steg är.

**Släpp en typsnittsfil på ytan** så förhandsvisas den direkt - **TTF**, **OTF** eller **WOFF** från din egen maskin, vilket är vägen för ett licensierat företagstypsnitt du redan äger. Den släppzonen är den enda fildörren i rummet.

Oavsett väg stannar snittet på den här enheten, renderas i appen, i verktygen och i varje export, offline för alltid, och följer med i designsystemfilen - inget hämtas vid rendering. Allt på Google Fonts levereras under en öppen licens (OFL/Apache/UFL).

### Typsnitt på den här enheten

Panelen **Fonts** listar varje snitt den här enheten har och den roll det tjänar. Snitt du lagt till leder under **In the design system**, vart och ett med sina roller och en radera, och det som tjänar Primary bär märket. Standardsnitten följer i en hopfälld rad - *Standard · SUSE, SUSE Mono · tjänar Primary och Code tills du väljer* - dämpad, utan radera och inget att befordra, eftersom ingetdera är ett beslut någon tagit. **Lägg till ett snitt** öppnar samma jämförelseyta utan avgränsning.

Panelen **Type roles** längst ner visar ett levande exempel på varje roll - brödtext och gränssnitt i primärfärgen, ett valfritt display-snitt för de översta rubrikerna, ett kursivt för betoning, ett mono för kod och data - med familjen och dess tillstånd bredvid varje (*Inter*, *SUSE · starter*, *SUSE · follows Primary*), så att hela uppsättningen kan läsas på en gång.

## Tokens

Resten av designsystemet, redigerbart utan att röra kod:

![Tokens-rummet - ett reglage för hörnradie plus spacing, sizing, shadows och resten av systemet](/t/url-shot?url=%2F%23%2Fstart%3Ftab%3Dtokens&width=1440&height=740&dpi=192&waitMs=1600&format=svg&walker=1&dark=1&filename=brand-tokens)

- **Rundade hörn** - ett enda radiereglage (0–1,5rem) som kort, knappar och paneler i hela appen följer.
- **Neutrala** - bläck-genom-papper-rampen en ny installation levereras med, listad som **Neutrala · standard · 9** med sina nio steg och en **Öppna** in till Färger-panelen. Det är den enda platsen de neutrala standardfärgerna hanteras, och *standard*-taggen försvinner i samma stund rampen genereras istället för ärvs.
- **Fler tokens** - lägg till och redigera **spacing**, **sizing**, **stroke width**, **opacity**, **rotation**, vanliga **numbers** och **shadows**. Välj en typ, namnge den (*Gutter, Card shadow…*) och ange dess värde. De här sparas som vanliga [designtokens](/info/design-tokens.html) (DTCG) och följer med designsystemet.

## Files

Släpp filerna ditt varumärke håller - förutom logotyper - här: **vektor-**, **bild-**, **ljud-** och **rörelse**-tillgångar (video, Lottie, animerat). De hamnar i [Tillgångar](/info/using.html#assets-your-library), sorterade i sektioner och redo i varje verktygs tillgångsväljare. Allt stannar på den här enheten. (Raden märker rummet **Filer**; URL-nyckeln förblir `catalogue`, eftersom en panelnyckel är ett permanent kontrakt.)

## Ta in ett varumärke

**Add from…** längst ner i menyraden öppnar en tvåstegsväljare. Det första steget frågar vad du *har*, inte vilket format det är:

- **Designtokens eller en designfil** - DTCG- eller Tokens Studio-JSON, ett Penpot-projekt, en **zip med tokenuppsättningar**, ett Lolly-designsystempaket eller en SVG.
- **PDF** - ett bygge eller en riktlinjefil, läst på den här enheten för dess färger, märken och inbäddade typsnitt.
- **Logotyp eller skärmbild** - en bild blir en föreslagen palett, läst på den här enheten. Inget laddas upp. Det här läser färger, inte typsnittet eller layouten i bilden.
- **Sparad webbsida** - välj en HTML-fil och dess CSS-filer, eller klistra in HTML eller CSS. Upp till 20 filer och 2 MB totalt. Bara den angivna texten läses; länkade resurser hämtas inte och skript körs inte. Den här vägen fungerar också utan tillägget eller skrivbordsappen.
- **Typsnittsfil** - TTF, OTF eller WOFF. Öppnar Typografi-rummet, där snittet installeras.
- **Webbplats** - en sida, läst för dess färger och typografi. Den här rutan visas bara på en enhet som faktiskt kan läsa en sida, för en inaktiverad ruta som annonserar något ingen kan trycka på är värre än ingen ruta alls. Där den väl visas säger den tydligt vilken läsare som används: hämtad av appen på den här enheten, eller läst genom webbläsartillägget i en bakgrundsflik, inloggad som du. Att ange en URL bara *förifyller* fältet - hämtningsknappen är samtycket, så en länk någon skickar dig kan aldrig starta en läsning.

Väljer du designfilskällan är det andra steget kortet nedan: de godkända formaten leder som ikonplattor i prioritetsordning, och hela kortet är ett enda släppmål - klicka var som helst på det eller dra en fil till det. Du kan också släppa en fil direkt på studion.

![Importkortet - de godkända formaten leder som ikonplattor, och hela kortet är ett enda släppmål](/t/url-shot?url=%2F%23%2Fstart%3Fsource%3Dfile&width=1440&height=900&dpi=192&waitMs=1600&css=.start-import-modal%20.modal-msg%2C.start-import-modal%20.modal-title%7Bdisplay%3Anone%7D&cropSelector=.start-import-drop&walker=1&format=svg&dark=1&filename=bs-brand-import-formats)

Vad varje designfil ger dig:

- ett **Lolly-designsystempaket** (`.lolly`; äldre `.zip` accepteras fortfarande) - installeras i ett steg;
- en **Penpot**-export (`.penpot`) - drar in dess designtokens;
- en **Design Tokens**-fil (`.json`) - W3C DTCG;
- en **Tokens Studio**-fil (`.json`) - Tokens Studio;
- en **ren SVG** (`.svg`) - Lolly skannar dess färger och låter dig välja vilka som ska behållas, den första blir din primärfärg.

En logotyp/skärmbild, webbplats eller sparad sida öppnar **Your suggested design system**. Se ett exempel med de föreslagna färgerna, välj en annan **Main colour** vid behov, och namnge systemet. **Use this design system** tillämpar de genererade ljusa och mörka paletterna och återgår till Översikt. Befintliga typsnitt ligger kvar. Det här ersätter det aktiva systemets färger och andra tokeninställningar. En kontrollpunkt måste lyckas först; **Restore brand settings** återställer de tidigare inställningarna.

**Source details and individual choices** visar vad som lästs, upptäckta typsnittsnamn och förhandsgranskningens text-/åtgärdskontrast. Den erbjuder också **Choose individual items in the tray** och **Download design context**. JSON-rapporten bär observationer, föreslagna tokens och källinformation; sparad HTML/CSS innehåller en SHA-256 av den angivna texten. Den innehåller ingen rå sidtext och är inget signerat Content Credential. Typsnittsnamn är förslag: Typografi förblir platsen för att välja och installera typsnitt.

PDF- och andra designfilsimporter behåller sina befintliga granskningskontroller. Objekt sparade i **Bricka** ändrar ingenting förrän de läggs till genom rummet som äger den typen av material.

`#/start?source=<kind>` öppnar väljaren på en given källa (`file`, `pdf`, `image`, `font`, `url`, `page`), och `?import` öppnar den på den vanliga listan.

## Flytta ett varumärke mellan enheter

**Exportera** längst ner på raden skriver en enda **`LollyBrand-….lolly`** - dina tokens, typsnitt, logotyper och temapreferens, med ett integritetsmanifest den verifierar på vägen tillbaka in. Webbversioner före 1.0.7 namngav samma nyttolast `.zip`; den äldre stavningen accepteras fortfarande. Bredvid, **Tokens (.json)** skriver det rena design-tokens-dokumentet för sig: inga typsnitt, inga logotyper, bara tokens, vilket är vad ett repo, ett CI-steg eller ett annat tokens-verktyg faktiskt läser.

Att ta tillbaka en sker via **Add from… → Design tokens or a design file** (ovan), eller genom att dra och släppa på studion. Så är det en kollega ger dig ett varumärke, eller hur du tar med ett till en andra installation - inget konto, inget moln. För att ta in ett varumärke från kommandoraden i stället, se [`ingest:brand`](/info/configuration.html#brand-packs).

## Återställ tidigare inställningar

Välj **Restore brand settings** längst ner på raden, välj en daterad kontrollpunkt och tryck sedan på **Återställ**. Det återställer färger, typsnittsinställningar och andra varumärkestokens för det aktiva varumärket. Typsnitts- och bildfiler ligger kvar som de är.

Lolly sparar dina aktuella inställningar som **Before restore** innan kontrollpunkten tillämpas. Välj den kontrollpunkten för att vända återställningen, även efter att webbläsaren stängts och öppnats igen. De senaste 20 kontrollpunkterna sparas på den här enheten. Om lagringen inte kan läsas eller de aktuella inställningarna inte kan sparas rapporterar dialogrutan problemet så att du kan försöka igen.

## Versioner

**Versioner** längst ner i listen är där ett designsystem slutar vara ett rörligt mål. Publicera en och du får en **permanent, namngiven kopia** som sparas på den här enheten: den ändras aldrig efteråt, så ett verktyg som fäster den fortsätter rita samma sak. Panelen förblir dold tills det finns något eget att publicera, så en studio som aldrig publicerar ser aldrig kontrollerna.

Tre saker att veta innan du trycker på något, och panelen säger alla tre före tryckningen snarare än efter:

- **En version är permanent.** Det finns ingen borttagningsfunktion ännu, så panelen anger vad som har sparats och att det förblir sparat istället för att erbjuda en knapp som ljuger.
- **Borttagningar leder kompatibilitetskortet.** Tillagda och ändrade token är nyheter; en *borttagen* är det som förstör ett verktyg, så den nämns först och kallas vid sitt rätta namn.
- **Publicering kan inte ångras; återställning kan.** *Återställ senaste från den här versionen* är en vanlig ändring på huvudet, så den hamnar på studions ångra-stack och panelen erbjuder dig **Ångra** direkt.

Du kan **Publish only**, eller **Publish and make active** - skillnaden är om verktyg och appen följer den versionen från och med nu eller fortsätter följa din senaste redigering. **Follow the latest again** gör varje redigering live i samma stund den görs. `#/start?area=versions` öppnar panelen direkt.

## När varumärket är låst

Vissa versioner levereras med ett **låst designsystem**, som SUSE Brand. Att öppna det visar en skrivskyddad notis med **Gör en redigerbar kopia** och **Byt**. Dess ursprungliga färger, typsnitt och tokens förblir intakta. Dina egna lokala system förblir redigerbara, även när det låsta systemet var det första på enheten. I Profile väljer **Öppna** ett system och öppnar dess studio; **Gör en ny** skapar ett lokalt system och öppnar det på `#/start` med namnfältet i fokus.

## Vart du ska gå härnäst

- **[Använda Lolly](/info/using.html)** - arbetsytan, spara, projekt och Tillgångar.
- **[Designtokens](/info/design-tokens.html)** - tokenmodellen som ditt varumärke uttrycks i.
- **[Export och format](/info/exporting.html)** - utskriftsenheter, CMYK och formaten ditt varumärke renderas till.


## Hitta och jämför ett utseende

Öppna **Find a look** från Överikt eller listan över designsystem på Profile. Bläddra bland system sparade på den här enheten och några återanvändbara Lolly-exempel. Sök på namn, färgtagg eller angivet typsnitt. **Closest to my current palette** sorterar efter uppmätt färglikhet, med matchande typsnittsfamiljer som avgör oavgjort; det är ingen kvalitetspoäng.

Markera ett utseende för att granska det, eller två för att jämföra. Granskningsknappen finns kvar tillgänglig på en liten skärm. Att markera ett utseende ändrar ingenting. **Use this saved system** byter genom det befintliga designsystemregistret. **Use these colours** tillämpar ett exempel genom det vanliga kontrollpunkts- och installationsflödet, och behåller de aktuella typsnitten. **Restore brand settings** kan återställa det tidigare utseendet.

Under **Details and design context** har sparade system redigerbara **Search tags** och en kontextnedladdning. Exemplen använder Lollys egna färgrecept; det finns ingen fjärrskrapad inspirationssamling eller något krav på konto.

![Jämför Sunroom och Orchard sida vid sida innan endera färgsystemet tillämpas.](/t/url-shot?url=%2F%23%2Fstart&width=1280&height=900&dpi=96&waitMs=3000&format=svg&filename=brand-compare-looks&try=1&drive=click%3A%5Bdata-ds-door%3D%22looks%22%5D%3Bwait%3A500%3Bclick%3A%5Bdata-look-select%3D%22example%3Asunroom%22%5D%3Bclick%3A%5Bdata-look-select%3D%22example%3Aorchard%22%5D%3Bclick%3A%5Bdata-looks-review%5D%3Bwait%3A500&cropSelector=.ds-looks-comparison&waitSelector=%5Bdata-ds-door%3D%22looks%22%5D&walker=1&rasterDpi=96)

Jämförelsen håller båda paletterna synliga tillsammans. Att granska ett utseende ändrar ingenting förrän du väljer **Use these colours** eller **Use this saved system**.

## Läs källbevis

Källgranskningens valfria detaljer visar typografi, mellanrum, utfyllnad och hörnvärden där de observerats. Sparad HTML/CSS och nativa webbplatsläsningar rapporterar deklarationer, som kanske inte används av den renderade sidan. Webbläsartillägget kan rapportera uppmätta stilar från ett avgränsat urval av synliga element, med dess visningsyta och webbläsarens färgpreferens. Äldre tillägg fungerar fortfarande med deklarerade stilar. Saknade fält säger **Not observed**.

Det här är observationer, inte automatiska stilinställningar. Typsnittsfiler hämtas eller installeras inte av en referensskanning, och källans mellanrum ersätter aldrig tyst dina egna. Antalen beskriver förekomster i urvalet, inte tillförlitlighet eller kvalitet.

## Kontrollera en komposition mot designsystemet

I Design, öppna **Exportera**, sedan **Before you export**. Kontrollen använder samma effektiva designsystemversion som renderingen. Den jämför angivna färger, tokenalias, typsnittsval och bildtillgångs-ID:n. Anpassade värden kan vara avsiktliga; en bild utanför de angivna varumärkestillgångarna är en granskningspunkt, inte en förbjuden bild.

Där ett konkret färg- eller typsnittsförslag finns ändrar dess knapp bara det ena lagret. Vanliga **Ångra** återställer det ursprungliga värdet. Låsta eller ändrade lager skrivs inte över av ett gammalt förslag. Saknade källbevis hålls separat från en träff. Renderad kontrast och textlayout kontrolleras av de befintliga inbyggda kontrollerna. Gradienter, effekter, inbäddat verktygsinnehåll, rättigheter och subjektiv kvalitet bedöms inte av varumärkesjämförelsen. Kontrollerna blockerar inte Ladda ner.

## Använd designkontext lokalt

**Download design context** innehåller tokendokumentet, upplösta färger, angivna typsnittsfamiljer, tillgångs-ID:n, källbevis där de registrerats, täckning och uttryckliga regler. Den innehåller inte typsnittsfiler eller ägandebevis. Referensgranskningen innehåller också sina föreslagna tokens och observationer.

CLI:t kan läsa endera nedladdningen utan en server:

```bash
lolly system import ./lolly-design-context.json
lolly system context --output=design-context.json
lolly system check ./design-inputs.json --file=design-context.json
```

`system check` accepterar Design-indata med en `boxes`-array eller ett kompilerat Design-dokument. Den rapporterar föreslagna fixar utan att ändra kompositionen. Den kan inte mäta webbläsarlayout eller renderad kontrast. Den befintliga MCP-resursen **lolly://design-context** exponerar det effektiva systemets kontext genom den konfigurerade lokala MCP-processen; ingen ny värdtjänst eller API-nyckel behövs.
