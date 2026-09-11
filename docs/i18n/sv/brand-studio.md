# Varumärkesstudion

**Varumärkesstudion** på `#/start` är den enda platsen där du formar ditt varumärke - dess loggor, färger, typsnitt, resten av dina tokens och filerna det håller. Ställ in det här en gång så följer varje verktyg, sida och export det *per konstruktion*, inte genom granskning.

Ändringar förhandsvisas **live i hela appen** medan du gör dem, så att du kan se en färg eller ett typsnitt landa överallt innan du bekräftar det. Allt sker på enheten: dina varumärkesfiler och tokens lämnar aldrig din dator (att välja ett Google-typsnitt hämtar den familjen från Google, en gång, efter en samtyckesdialog), och varumärket reser i en enda [varumärkespaket](#move-a-brand-between-devices)-fil.

> **Det här är redigeraren. Instrumentpanelen är spegeln.** Fliken **Designsystem** på instrumentpanelen (`#/d`) *visar* ditt varumärke skrivskyddat; du *redigerar* det här på `#/start`. Om du vill ändra en färg senare, kom tillbaka till Varumärkesstudion.

## Rummen

Studion är en uppsättning **rum** listade i en rad längs sidan - inte steg. Inget är numrerat, inget är spärrat mot något annat och att komma till vilket som helst av dem är legitimt:

- **Översikt** - navet. Vad som finns just nu, med en snabb blick, med en dörr in i varje rum.
- **Färger** - lägg till färger en i taget, tilldela roller eller generera en hel palett från en.
- **Typsnitt** - de fyra typsnitten som appen, dina verktyg och varje export läser.
- **Loggor** - dina märken, i alla orienteringar och behandlingar.
- **Tokens** - hörnradie, marginaler, skuggor och resten av systemet.
- **Filer** - bild-, ljud- och rörelsefilerna ditt varumärke håller.

På en telefon blir samma lista en horisontell chipsrad fäst under rubriken. Att byta rum laddar aldrig om något - redigeraren håller alla sina paneler monterade och visar helt enkelt den du bad om.

**Djuplänka ett rum** med `#/start?area=<key>`. Nycklarna är `overview`, `color` *(observera den amerikanska stavningen i URL:en)*, `type`, `logos`, `tokens`, `catalogue` (Filer-rummet - panelnyckeln är ett permanent kontrakt, så URL:en behåller det gamla namnet) och `versions`. `?tab=` är det sedan länge etablerade aliaset för samma sak och fungerar fortfarande, så gamla länkar och bokmärken fortsätter att fungera; allt okänt öppnar Översikt i stället för att köra fast.

Fästa vid **radens nederkant** finns åtgärderna som hör till hela designsystemet snarare än till ett enda rum:

- **Lägg till från…** - källväljaren, för att ta in ett varumärke från en fil, en PDF, en bild, ett typsnitt eller en webbplats. Se [Ta in ett varumärke](#bring-a-brand-in) nedan.
- **Bricka** - kandidaterna en skanning hittade men ännu inte bekräftat. Den förblir dold tills en skanning faktiskt behåller något, och visar ett antal när den gör det; inget i den ändrar ditt varumärke förrän du trycker på Lägg till på den raden.
- **Exportera** - skriver hela varumärket som en enda `LollyBrand-…zip`.
- **Tokens (.json)** - det rena design-tokens-dokumentet för sig, för ett repo, ett byggsteg eller ett annat tokens-verktyg.
- **Versioner** - publicera, aktivera och återställ namngivna kopior av designsystemet. Dold tills det finns något eget att publicera (eller en `?area=versions`-länk begär det vid namn).

![Studions rumsrad - Översikt, Färger, Typsnitt, Loggor, Tokens och Filer](/t/url-shot?url=%2F%23%2Fstart&width=1440&height=900&dpi=192&waitMs=1600&cropSelector=.ds-rail&format=svg&walker=1&localize=1&dark=1&filename=brand-studio&try=1)

## Översikt

Översikt är rummet du landar i, och det har två ansikten.

Med **inget uppsatt ännu** erbjuder det två dörrar - **Börja från en fil** (design tokens, ett Penpot-projekt, ett designsystempaket eller en SVG) och **Börja från grunden** (lägg till en färg, fortsätt sedan när du vill) - och en tyst utgång **Utforska verktygen** under dem, för att lämna också är ett legitimt svar.

När ett designsystem väl finns visar samma rum **vad du har**: paletten och dess färgantal, de typsnittsfamiljer som gäller, hur många loggplatser som är fyllda, hur många tokens det finns och Filer-rummet. Varje block är en dörr in i sitt rum. Det finns antal här, aldrig en förloppsindikator och aldrig ett slutkort - inget i den här studion är skyldigt dig något.

## Loggor

Börja med att tömma din mapp med märken i släppzonen högst upp: **"Släpp märken här, eller välj flera på en gång"** tar så många filer du har i en enda omgång. Varje fil läses för sin form och sitt bläck, och köas sedan under **Väntar på en plats** som ett chip som säger vad den tror - *"Ser ut som Horisontell primär"*, med det mått den gick på, och en knapp **Placera** (**Ersätt**, där den platsen redan är fylld). Där den är osäker säger chippet det rakt ut och erbjuder **Byt plats** i stället, som listar alla åtta. Inget placeras förrän du trycker på något.

Två saker händer runt den kön. Ett märke med överflödig tom marginal får ett **beskärningsförslag** först - besvara det eller tryck Escape så går originalfilen in orörd. Och där ett märke kan förse en tom syskonplats erbjuder rummet den härledda **mono**- eller **omvänd**-versionen som ett eget chip, märkt *Genererad*, som försvinner igen om du fyller den platsen på ett annat sätt.

Under det finns rutnätet varje märke hamnar i - platser för **orientering × behandling**:

- **Orienteringar:** Horisontell (ordmärke + symbol i rad) och Vertikal (staplad, för kvadratiska och höga ytor).
- **Behandlingar:** Primär, Primär omvänd (för mörka bakgrunder), Mono (en färg) och Mono omvänd.

Det är åtta valfria platser. Klicka på en plats för att lägga till en PNG, SVG, JPEG eller WebP; klicka på en fylld plats för att ersätta den. Varje plats är valfri och allt stannar på den här enheten.

![Logomatrisen - varje orientering längs toppen, varje behandling som sin egen streckade plats, alla valfria](/t/url-shot?url=%2F%23%2Fstart%3Ftab%3Dlogos&width=1440&height=1600&dpi=192&waitMs=1600&cropSelector=.be-logo-grid&format=svg&walker=1&dark=1&filename=bs-logo-slots)

- **Egna märken** - lägg till märken som ditt varumärke namnger på sitt eget sätt (en ikon, ett vapen, en favikon) under **Egna märken**; namnge det och välj en fil.
- **Fler identiteter** - ett undervarumärke, en produkt eller ett event kan ha sin egen fullständiga uppsättning loggor. Använd **+ Lägg till en till logga** och namnge den; din huvuduppsättning är helt enkelt "Din logga".
- **Ladda upp en SVG så läser Lolly dess färger.** På en helt ny installation sätter den tyst din primärfärg från loggan och säger det. På ett befintligt varumärke erbjuder den i stället färgen som ett förslag - *"Hittad i loggan: #…"* med en knapp **Använd som primär** bredvid - borta i Färger-rummet, där du kan ta den eller avvisa den.

## Färger

![The Colours room after one colour - the two panes back, the generate offer, roles reading in three registers and the pane at one colour](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dpick&width=1440&height=840&dpi=192&waitMs=1800&drive=click%3A%5Bdata-be-editor-add%5D%3Bwait%3A900&format=svg&walker=1&dark=1&filename=bs-colour-first)

Det rikaste rummet, i två paneler. Den vänstra är där du arbetar; den högra är din **levande palett**. Dra avdelaren mellan dem för att ändra storlek (Enter på den fäller ihop paletten ur vägen).

![Färger-rummet - en primärfärg härleder ramper, provkort med kontrastförhållanden och en levande palett](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor&width=1440&height=740&dpi=192&waitMs=1800&format=svg&walker=1&localize=1&dark=1&filename=brand-colours)

### Lägg till en färg, ge den sedan ett jobb

**Lägg till en färg** är hela den enkla vägen: klistra in eller välj en färg i valfri notation så blir den precis en token. Inget härleds från den, inget föreslås in i den, inget annat krävs. Klistra in en hel *lista* med färger så blir varje en chip du kan lägga till för sig.

**Roller** är lagret ovanpå - vilken färg som spelar vilken del. Roller är valfria (ett designsystem med tre lösa färger och inga roller är ett fullgott sådant), vilken swatch som helst kan ta en, och kontrastavläsningen mäts mot ytan, APCA först.

### Expertflyglarna

Fyra hopfällda avsnitt finns under dessa två. Öppna den du vill; var och en är djuplänkningsbar som `#/start?area=color&focus=<wing>`:

- **Generera en startpalett** (`focus=generate`) - en färg till en hel uppsättning nyanser. Beskrivs nedan.
- **Nyanskurvor** (`focus=curves`) - forma om en ramp punkt för punkt. Ljushet, kroma och nyans får varsin kurva, växlas med L / C / H, och nyanserna nedan bakas om live medan du drar.
- **Kontrast** (`focus=contrast`) - **Kontrastlås** omtonar en ramp för att träffa APCA-mål mot en bakgrund du väljer, varje steg behåller sin egen nyans och kroma; **Rotera nyans** vrider hela rampen fysiskt runt hjulet, varje nyans behåller sin ljushet och kroma.
- **Tryck** (`focus=print`) - vad primärfärgen blir på press: dess automatiska skärmvärde, eller en fastnålad CMYK-uppbyggnad eller en namngiven dekorfärg i stället.

### En färg, en hel palett

Inuti **Generera en startpalett**, välj en **primärfärg** så räknar Lolly ut en fullständig palett - ljusa och mörka ytor, text, accenter och fullständiga ton-/nyansramper - med samma perceptuella färgmatematik (OKLCH) som motorn använder överallt. Justera härledningen:

- **Schema** - Mono, Komplement, Analog eller Triad - avgör hur sekundärfärgen förhåller sig till din primärfärg.
- **Nyanser** - ett skjutreglage från 3 till 20 (standard 5) styr hur många steg varje ramp genererar.
- **Finjustering** (hopfälld) - **UI-intensitet** (Dämpad / Djup), **Kontrast** (Komfort / Hög) och **Text på varumärke** (Auto / Ljus / Mörk).

Inget i denna flygel skriver något till ditt varumärke. Det är en förhandsvisning, live i hela appen så att du kan bedöma den, ända fram till du trycker på **Ersätt palett** (nedan).

Under primärfärgen ser du levande ramper för **Primär / Neutral / Sekundär / Blandning** och provkort för Ljus och Mörk, var och en med sin egen kontrastavläsning - WCAG-förhållandet med APCA-talet `Lc` bredvid. **Klicka på ett steg i Neutral- eller Sekundär-rampen** för att förankra den nyansen i stället för det härledda standardvärdet.

![De fyra rampstegen staplade ovanför ljusa och mörka exempelkort, där varje kort har sitt eget WCAG-kontrastförhållande](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dgenerate%26seed%3D%2523e0452b&width=1440&height=1400&dpi=192&waitMs=1800&css=.start-head%7Bdisplay%3Anone%7D&cropSelector=.be-preview&format=svg&walker=1&dark=1&filename=bs-colour-ramps)

### Skapa din palett (harmonigenerator)

Fortfarande i samma flygel genererar **Build your palette** matchande accentfärger utifrån din primärfärg. Välj en **Harmony** - **Complementary**, **Adjacent**, **Triad**, **Tetrad** eller **Analogous** (som har ett eget antal **Accents**, 2 till 5, och en nyansvinkel, **Angle**, från 10° till 45°) - och varje kandidat kommer med ett automatiskt genererat, läsbart namn och en **+ Add**-knapp. Att lägga till en placerar den färgen direkt i din palett, ett tryck till en token. *"Your palette, applied"* förhandsgranskar hela uppsättningen på riktig grafik.

![Genererade accenter, var och en med ett färgprov, ett automatgenererat namn, dess hex-kod och en Add-knapp](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dgenerate%26seed%3D%2523e0452b&width=1440&height=900&dpi=192&waitMs=1800&css=.start-head%2C.be-colour%7Bdisplay%3Anone%7D&cropSelector=.be-candidates&walker=1&format=svg&dark=1&filename=bs-harmony-candidates)

### Att spara en genererad palett

**Replace palette** är den enda kontrollen i den här flygeln som faktiskt skriver något, och den skriver aldrig direkt. Tryck på den och ett granskningskort öppnas först, rubricerat **"Replace the palette?"**, som radar upp exakt vad som är på väg att hända: hur många roller som behåller den tilldelning du gjort, hur många färger du själv lagt till som behålls, hur många nyanskurvor som ankras om, hur många trycklås som pinnas om, hur många dolda nyanser som förblir dolda, hur många gradientstopp som behåller sin färg.

**Replace palette** på det kortet genomför bytet; **Cancel** avbryter och ändrar ingenting. När det är klart blir kortet till **"Palette replaced."** med en enda **Undo**-knapp redan i fokus - och en kontrollpunkt av hela designsystemet tas *innan* bytet, så att "lägg tillbaka det som det var" blir en återställning i stället för en förlorad eftermiddag.

### Paletten, diagrammet och varje färgprov

Den högra panelen listar alla färger ditt varumärke har, grupperade (Primary, Neutral, Secondary, Spectrum, Custom, Roles), där varje grupp kan fällas ihop och har sin egen **+ Add**. Nedanför fälls **Colour chart** ut till två vyer av samma färgprov: **Wheel** (OKLCH-hjulet - dra en punkt för att ändra dess färg, klicka på en punkt för att redigera den eller klicka på tomt utrymme för att släppa ett nytt färgprov) och **Gamut**-diagrammet, som visar var det visningsbara intervallet faktiskt tar slut. `#/start?area=color&focus=chart` öppnar kortet direkt, precis som `?wheel` alltid har gjort.

![Färgpaletten, varje grupp fällbar, med nedladdningspillret placerat längs nederkanten](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dpick&width=1440&height=1000&dpi=192&waitMs=1800&drive=click%3A%5Bdata-be-editor-add%5D%3Bwait%3A500%3Bclick%3A%5Bdata-be-generate-cta-go%5D%3Bwait%3A900%3Bclick%3A%5Bdata-be-replace-palette%5D%3Bwait%3A800%3Bclick%3A%5Bdata-be-review-go%5D%3Bwait%3A1400&cropSelector=.be-split-side&walker=1&format=svg&dark=1&filename=bs-palette-pane)

![OKLCH-hjulet - vinkeln är nyans, avståndet ut är mättnad (chroma) och gråtonerna följer en ljushetsskala nedför sidan](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dpick&width=1440&height=900&dpi=192&waitMs=2400&css=.start-head%2C.be-pal%2C.be-gradients%7Bdisplay%3Anone%7D&drive=click%3A%5Bdata-be-editor-add%5D%3Bwait%3A500%3Bclick%3A%5Bdata-be-generate-cta-go%5D%3Bwait%3A900%3Bclick%3A%5Bdata-be-replace-palette%5D%3Bwait%3A800%3Bclick%3A%5Bdata-be-review-go%5D%3Bwait%3A1400%3Bclick%3A%5Bdata-be-chart%5D%20summary%3Bwait%3A900&cropSelector=.be-pal-wheel&walker=1&format=svg&dark=1&filename=bs-colour-wheel)

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

### Gradienter

En valfri **Gradients**-panel bygger övertoningstoken från din palett för bakgrunder och accenter. Hoppa över den helt om ditt varumärke inte använder gradienter. Varje gradient har en förhandsgranskning, namngivna stopp (2–8) och en vinkel. Det viktiga beteendet: **ett stopp refererar till ett färgprov**, så byter du färg på det färgprovet följer gradienten med. Interpolationen sker i OKLCH för rena övertoningar. Ta bort ett stopp för att korta serien.

### Ta med paletten någon annanstans

Pillret som flyter längs nederkanten av palettpanelen laddar ner hela paletten som **Design tokens (JSON)**, **CSS variables**, **CSS classes**, **SCSS variables**, en **GIMP palette (.gpl)** eller en **Adobe Swatch Exchange (.ase)** - så att varumärket går rakt in i Illustrator, Figma, GIMP eller ett stilmallsdokument. Det ligger utanför panelens rullningslist, så det behåller sin plats oavsett hur långt paletten rullas. (Du kan också ladda ner paletten från vyn [Catalogue](/info/using.html).)

## Typsnitt

![The compare stage open under its card, with the search row, the pinned families and the cards folded to a one-line strip](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dtype%26focus%3Dstage&width=1440&height=740&dpi=192&waitMs=1800&format=svg&walker=1&dark=1&filename=bs-type-stage)

Rummet inleds med **fyra rollkort** - de fyra typsnitt som appen, dina verktyg och varje export faktiskt läser av. Varje kort visar vad som just nu fyller den rollen, satt i det typsnittet, med en rad riktig text under:

- **Primary** - brödtext, knappar och alla verktyg.
- **Headings** - visningstypsnittet för `h1`/`h2`.
- **Code** - ett typsnitt med fast breddsteg för kod och data.
- **Italic** - en riktig kursiv motsvarighet för betoning, citat och sidokommentarer.

Headings, code och italic faller alla tillbaka på primary tills du tilldelar dem, så ett varumärke med ett enda typsnitt behöver inte fatta några beslut här alls. Inget på ett kort genomför något: **Change** (eller **Choose a face** på en tom roll) öppnar **jämförelsevyn**, avgränsad till den rollen.

![Typsnittsrummet - rollkorten och ett levande exempel på varje typsnitt i arbete](/t/url-shot?url=%2F%23%2Fstart%3Ftab%3Dtype&width=1440&height=740&dpi=192&waitMs=1800&format=svg&walker=1&dark=1&filename=brand-type)

### Jämförelsevyn

Vyn öppnas **inline i rummet**, inte i en dialogruta, så att korten du kom ifrån ligger kvar på skärmen. Sök efter en Google Fonts-familj (Inter, Fraunces, Space Grotesk…) eller släpp en typsnittsfil, tryck på **Add to the comparison** och kandidaterna ställs sida vid sida i samma ord innan något av dem installeras. Escape avbryter och lämnar tillbaka tangentbordsfokus till kortet du öppnade det från.

Det är den enda dörren in, vilket är varför inget kommer in i ditt varumärke osett. Under scenen sitter de två hanteringspanelerna:

- **Fonts on this device** - alla installerade familjer, rollerna de fyller och en raderingsknapp. **Add a face** här öppnar samma jämförelsevy utan avgränsning.
- **Your fonts** - ladda upp en **TTF**, **OTF** eller **WOFF** från din egen dator. Det är vägen för ett licensierat företagstypsnitt du redan äger.

Oavsett vilket stannar typsnittet på den här enheten, renderas i appen, i dina verktyg och i varje export, offline för alltid, och följer med i ditt varumärkespaket - inget hämtas vid renderingstillfället. Allt på Google Fonts levereras under en öppen licens (OFL/Apache/UFL).

**Type roles**-panelen längst ner visar ett levande exempel för varje roll - brödtext och gränssnitt i primary, ett valfritt visningstypsnitt för de översta rubrikerna, en kursiv för betoning, ett typsnitt med fast breddsteg för kod och data - så att du kan se hela uppsättningen fungera tillsammans.

![Type roles-exemplet - rubrik, brödtext, kursiv och kod, var och en satt i det typsnitt rollen slår upp, med typsnittets namn bredvid](/t/url-shot?url=%2F%23%2Fstart%3Ftab%3Dtype&width=1440&height=1000&dpi=192&waitMs=2600&drive=click%3A%5Bdata-be-typemore-toggle%5D%3Bwait%3A600&cropSelector=.be-typecard-grid&walker=1&format=svg&dark=1&filename=bs-type-specimen)

## Tokens

Resten av designsystemet, redigerbart utan att röra kod:

![Tokens-rummet - ett reglage för hörnradie plus spacing, sizing, shadows och resten av systemet](/t/url-shot?url=%2F%23%2Fstart%3Ftab%3Dtokens&width=1440&height=740&dpi=192&waitMs=1600&format=svg&walker=1&dark=1&filename=brand-tokens)

- **Rounded corners** - ett enda radiereglage (0–1.5rem) som kort, knappar och paneler i hela appen följer.
- **More tokens** - lägg till och redigera **spacing**, **sizing**, **stroke width**, **opacity**, **rotation**, vanliga **numbers** och **shadows**. Välj en typ, namnge den (*Gutter, Card shadow…*) och ange dess värde. De lagras som standardiserade [design tokens](/info/design-tokens.html) (DTCG) och följer med i ditt varumärke.

## Files

Släpp filerna ditt varumärke sparar - bortsett från loggor - här: **vector**, **image**, **audio** och **motion** (video, Lottie, animerat) tillgångar. De hamnar i din [Catalogue](/info/using.html), sorterade i sektioner och redo i varje verktygs tillgångsväljare. Allt stannar på den här enheten. (Menyraden märker rummet **Files**; URL-nyckeln förblir `catalogue`, eftersom en panelnyckel är ett permanent kontrakt.)

## Ta in ett varumärke

**Add from…** längst ner i menyraden öppnar en tvåstegsväljare. Det första steget frågar vad du *har*, inte vilket format det är:

- **Design tokens or a design file** - DTCG- eller Tokens Studio-JSON, ett Penpot-projekt, en **zip av tokenuppsättningar**, ett Lolly-designsystempaket eller en SVG.
- **PDF** - en presentation eller en riktlinjefil, läst på den här enheten för dess färger, dess märken och dess inbäddade typsnitt.
- **Image** - en skärmdump eller ett foto; dess färger läses på den här enheten och inget laddas upp.
- **Font file** - TTF, OTF eller WOFF. Öppnar typsnittsrummet, där typsnittet installeras.
- **Website** - en sida, läst för dess färger och typsnitt. Den här plattan visas bara på en enhet som faktiskt kan läsa en sida, eftersom en inaktiverad platta som utannonserar något ingen kan trycka på är värre än ingen platta alls. Där den väl visas namnger den sin läsare tydligt: hämtad av appen på den här enheten, eller läst via webbläsartillägget i en bakgrundsflik, inloggad som du. Att ange en URL *förifyller* bara fältet - hämtningsknappen är samtycket, så en länk någon skickar dig kan aldrig starta en läsning.

Väljer du designfilskällan är det andra steget kortet nedan: de godkända formaten leder som ikonplattor i prioritetsordning, och hela kortet är ett enda släppmål - klicka var som helst på det eller dra en fil till det. Du kan också släppa en fil direkt på studion.

![Importkortet - de godkända formaten leder som ikonplattor, och hela kortet är ett enda släppmål](/t/url-shot?url=%2F%23%2Fstart%3Fsource%3Dfile&width=1440&height=900&dpi=192&waitMs=1600&css=.start-import-modal%20.modal-msg%2C.start-import-modal%20.modal-title%7Bdisplay%3Anone%7D&cropSelector=.start-import-drop&walker=1&format=svg&dark=1&filename=bs-brand-import-formats)

Vad varje designfil ger dig:

- ett **LollyBrand**-paket (`.zip`) - installeras i ett steg;
- en **Penpot**-export (`.penpot`) - hämtar in dess designtoken;
- en **Design Tokens**-fil (`.json`) - W3C DTCG;
- en **Tokens Studio**-fil (`.json`) - Tokens Studio;
- en **vanlig SVG** (`.svg`) - Lolly skannar dess färger och låter dig välja vilka som ska behållas, där den första blir din primärfärg.

En källinstallation tar en **kontrollpunkt först**, så "återgå till innan importen" blir en enda återställning. Och det en skanning hittar går inte rakt in: kandidater hamnar i **Tray**, där var och en läggs till med ett eget tryck, genom det rum som äger den typen av material.

`#/start?source=<kind>` öppnar väljaren på en given källa (`file`, `pdf`, `image`, `font`, `url`), och `?import` öppnar den på den vanliga listan.

## Flytta ett varumärke mellan enheter

**Export** längst ner i menyraden skriver en enda **`LollyBrand-…zip`** - dina token, typsnitt, loggor och temainställning, med ett integritetsmanifest som verifieras när den kommer tillbaka in. Bredvid den skriver **Tokens (.json)** det enkla design-tokens-dokumentet för sig själv: inga typsnitt, inga loggor, bara token, vilket är det ett repo, ett CI-steg eller ett annat tokenverktyg faktiskt läser.

Att ta tillbaka en sker via **Add from… → Design tokens or a design file** (ovan), eller genom att dra och släppa på studion. Så är det en kollega ger dig ett varumärke, eller hur du tar med ett till en andra installation - inget konto, inget moln. För att ta in ett varumärke från kommandoraden i stället, se [`ingest:brand`](/info/configuration.html#brand-packs).

## Versioner

**Versioner** längst ner i listen är där ett designsystem slutar vara ett rörligt mål. Publicera en och du får en **permanent, namngiven kopia** som sparas på den här enheten: den ändras aldrig efteråt, så ett verktyg som fäster den fortsätter rita samma sak. Panelen förblir dold tills det finns något eget att publicera, så en studio som aldrig publicerar ser aldrig kontrollerna.

Tre saker att veta innan du trycker på något, och panelen säger alla tre före tryckningen snarare än efter:

- **En version är permanent.** Det finns ingen borttagningsfunktion ännu, så panelen anger vad som har sparats och att det förblir sparat istället för att erbjuda en knapp som ljuger.
- **Borttagningar leder kompatibilitetskortet.** Tillagda och ändrade token är nyheter; en *borttagen* är det som förstör ett verktyg, så den nämns först och kallas vid sitt rätta namn.
- **Publicering kan inte ångras; återställning kan.** *Återställ senaste från den här versionen* är en vanlig ändring på huvudet, så den hamnar på studions ångra-stack och panelen erbjuder dig **Ångra** direkt.

Du kan **Publish only**, eller **Publish and make active** - skillnaden är om verktyg och appen följer den versionen från och med nu eller fortsätter följa din senaste redigering. **Follow the latest again** gör varje redigering live i samma stund den görs. `#/start?area=versions` öppnar panelen direkt.

## När varumärket är låst

Vissa builds levereras med ett **låst varumärke** - dess färger, typsnitt och tokens är vad varje verktyg och export använder, och det finns inget att ändra. I det fallet ersätts studion med en kort notis som förklarar att den här byggnaden levereras med ett fast varumärke och att redigering är avstängd. Detta är avsiktligt: det är så en organisation garanterar att allt förblir on-brand.

## Vart du ska gå härnäst

- **[Använda Lolly](/info/using.html)** - arbetsytan, spara, projekt och katalogen.
- **[Designtokens](/info/design-tokens.html)** - tokenmodellen som ditt varumärke uttrycks i.
- **[Export och format](/info/exporting.html)** - utskriftsenheter, CMYK och formaten ditt varumärke renderas till.
