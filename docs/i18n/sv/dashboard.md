# Inställningar

Settings innehåller dina uppgifter, ditt designsystem, tillgänglighet, lagring på den här enheten och offlinenedladdningar. Öppna **Settings** från fältet längst ner på startskärmen eller från din avatarmeny, så öppnas **Preferences**.

| Flik | Adress | Vad den innehåller |
|---|---|---|
| **Preferences** | `#/settings` | Dina uppgifter, designsystem, utseende, emoji, tillgänglighet, anslutningar, lagring och offlinenedladdningar |
| **This device** | `#/settings?tab=device` | Aktuella uppgifter om den här webbläsaren och datorn samt ljud och en skrivskyddad lagringsvy |
| **Design system** | `#/settings?tab=brand` | Det aktiva designsystemet som ett omslag och sidor, med en rad omslag för att byta system |
| **Capabilities** | `#/settings?tab=caps` | Allt Lolly kan göra, som sökbara kort |
| **Activity & stats** | `#/settings?tab=activity` | Katalogen, dina lokala räknare och senaste arbeten |

Gamla länkar till `#/profile` och `#/d` öppnar fortfarande rätt plats, ända ner till enskilda inställningar.

<!--i:eti-sliders-->
## Preferenser

Preferences är en enda lång sida med en **inställningslist** längs sidan. Fältet **Search settings** ovanför listen filtrerar den medan du skriver. Varje avsnitt har en länk på formen `#/settings?focus=<section-id>`, till exempel `#/settings?focus=storage-section`.

- <!--i:usercheck--> **Your details** - ditt namn, dina kontaktuppgifter och ditt porträttfoto samt omkopplaren **Use my details to create**. [Profiler](/info/profile.html) förklarar hur verktygen använder dem.
- <!--i:seal--> **Content Credentials** - den valfria verifierade identitet som signerar dina exporter. Se [Content Credentials](/info/content-credentials-identity.html).
- <!--i:palette--> **Design systems** - byt, lägg till, dölj eller ta bort designsystem. [Lolly Design System Setup](/info/brand-studio.html#manage-your-design-systems) beskriver varje åtgärd.
- <!--i:moon--> **Appearance** - temat (Light, Dark eller Brand, som färgar appen med din palett), **Your colourway** när designsystemet erbjuder fler än en ([Gör en färgvariant till din egen](/info/colourways.html#make-a-colourway-your-own)) och **Interface follows the design system**.
- <!--i:sparkle--> **Emoji** - emojiuppsättningen för nytt arbete, med licensen för grafiken, och hur mycket din palett färgar om emoji (**Off**, **Subtle**, **Strong**, **Full**, **Mono** eller **Duotone**). **Keep skin tones and flags** låter dem behålla sina egna färger. Arbete du redan har gjort behåller sin uppsättning.
- <!--i:eyeoff--> **Accessibility** - fyra omkopplare för komfort samt Sound och Neurospicy Mode. Se [Tillgänglighet](#accessibility).
- <!--i:link--> **Connected services** - lagring som du ansluter, till exempel Dropbox, Google Drive, OneDrive, Nextcloud eller S3, och **Sync across devices**. Se [Synkronisera dina enheter](/info/sync.html).
- <!--i:globe--> **Trusted sites** - de webbplatser som en webbsideruta i Lolly Design eller en Lolly Sandbox-demo får kontakta utan att fråga och, där servern erbjuder det, **Allow pages from any site**. [Integritetspolicyn](/info/privacy.html) listar vad varje begäran skickar.
- <!--i:download--> **Your renders** - **Save my renders to my library** behåller en kopia av varje bild, ljudklipp och video du laddar ner i Assets, under en Renders-etikett.
- <!--i:database--> **Storage** - vad Lolly behåller på den här enheten och knapparna som rensar eller flyttar dina data. Se [Lagring](#storage).
- <!--i:cpu--> **Available offline** - ladda ner det du behöver innan du förlorar anslutningen. Se [Tillgängligt offline](#available-offline).
- <!--i:folder--> **Hot folder** - i datorappen bevakar Lolly en mapp och tar in allt som släpps där, via samma väljare som vid dra och släpp.
- <!--i:clock--> **Your activity** - vad du har skapat på den här enheten, räknat lokalt.
- <!--i:sliders--> **Feature flags** - slå på eller av delar av appen, som **Print preflight** eller **Strip metadata from uploads**. **Performance UI** ger appen ett enklare utseende som kräver mindre resurser att rita. Lolly kan slå på Performance UI på egen hand på en långsam enhet. Raden under omkopplaren anger då när och varför, med **Allow again** ([hur beslutet fattas](/info/configuration.html#curating-what-people-see)).
- <!--i:server--> **Lolly instance** - var den här installationen hämtar sina verktyg och sin katalog. Se [Lolly-instans](#lolly-instance).

Temakorten är levande förhandsvisningar. Ett tema tillämpas så snart du väljer det, bara på den här enheten.

![Tre temakort som vart och ett förhandsvisar sin egen typografi och färg, med det aktiva markerat](/t/url-shot?url=%2F%23%2Fsettings%3Ffocus%3Dappearance-section&width=1440&height=1400&dpi=192&waitMs=1600&walker=1&format=svg&cropSelector=.profile-card--appearance&dark=1&filename=pd-theme-picker)

### Tillgänglighet

**Settings → Preferences → Accessibility** innehåller fyra komfortinställningar för appen. Var och en är av tills du slår på den och ingen av dem påverkar ett verktygs yta eller en export, så en lugnare app flyttar aldrig en pixel i filen du levererar. Alla är av som standard. Ingen av dem ändrar ett verktygs yta eller en export.

- <!--i:pause--> **Reduce motion** slår av appens övergångar, glidningar och dekorativa animationer.
- <!--i:photos--> **Hide colourful previews** byter ut galleriets förhandsvisningsgrafik mot kort med ikoner och text och tonar ner projektminiatyrerna, som fortfarande går att känna igen.
- <!--i:sliders--> **High contrast** förstärker appens kanter, text och fokusmarkeringar. Dina varumärkesfärger och ytan förblir som du ställt in dem.
- <!--i:font--> **Large text** förstorar appens etiketter, menyer och knapptexter.

**Dominant hand** (Right eller Left) anger vilken sida kontrollerna hamnar på när Lolly visar två paneler, på en vikbar eller nästan kvadratisk surfplatta. **Swap sides** i en panels rubrik ändrar också detta.

De här inställningarna finns i din profil, så de följer med i en profilexport tillsammans med ditt namn och dina sessioner. En kopia som bara finns på enheten tillämpar dem före den första uppritningen.

Samma kort har **Sound**, mjuka ljud som stöd för handlingar som att komma till galleriet, få ett Content Credentials-resultat eller stänga en panel. Det har också **Neurospicy Mode**, ett lugnt ljudspår för fokus. När du slår på Neurospicy öppnas en liten spelare i hörnet som följer med dig i hela appen. I spelaren väljer du ett spår, hoppar vidare, ställer in volymen och minimerar eller stänger spelaren. Spåren omfattar Lollys genererade stationer, ambientloopar och beats, ditt eget ljud och internetradiostationer, som behöver en anslutning. Båda är av som standard och inställningarna sparas. Att slå av Sound tystar också fokusspåret. Profilmenyn och **This device** har samma omkopplare.

Ett reglage under omkopplaren Sound ställer in vad ljuden består av. Mot den runda **Bouba**-klumpen blir de mjuka droppar, bubblor och lite bas. Mot den spetsiga **Kiki**-stjärnan blir de torra tick, skrap och metall. Mitten behåller Lollys klanger och toner. Om ljuden i ena änden är svåra för dig att tåla, flytta mot den andra. Reglaget fungerar när Sound är av och när du släpper reglaget spelas ett kort prov upp.

::: details De genererade stationerna
De genererade stationerna komponerar sin musik medan de spelar, utan samplingar och inspelade röster. Varje låt har sina egna instrument, sitt eget sväng och sin egen spelordning.

- **Lolly Sings** är en familj av stationer. Ursprungliga Lolly Sings är ljus och melodisk: durtonarter, en huvudmelodi i varje låt och inslag av bossa, shuffle och chiptune. Varje genre har också sin egen station, från Sugar och K-pop till Country, Jazz, Metal och D&B.
- **Lofi-stationerna** (Warm, Late night och Rainy) är ändlösa lo-fi-beats.

På en genererad station byter nästa och föregående mellan låtar. Varje låt kommer från ett startvärde, så låten spelas likadant var du än delar eller sparar den (se [Genererad musik](/info/generated-music.html)). Under uppspelningskontrollerna byter **Mood** mellan Lofi-stationerna, **Drums** tar bort trumsetet och **Texture** går från rent ljud till en dammig skiva. Därefter kommer en rad ikonknappar. Håll pekaren över eller tryck länge på en knapp för att se dess namn:

- Musiknoten, **Open in the music generator**, öppnar låten på `#/music`, där du kan ändra dess instrument avsnitt för avsnitt.
- Länken, **Share this tune or moment**, erbjuder en länk som spelar samma låt eller en som också startar där du är och visar visualiseraren med din aktuella förinställning och dina färger.
- Mappen, **Save to library**, behåller låten bland dina tillgångar.
- Blixten, **Light visualiser**, är en omkopplare som beskrivs nedan.

En sparad låt listas under sin stations grupp, efter tonart och tempo. Om du väljer den sparade låten spelas samma låt igen, med upprepning som vilket spår som helst eller med fortsättning till nästa i framåtläge. Bara stationen och låtens nummer lagras, några få byte, och musiken komponeras igen medan den spelas. Du kan byta namn på eller ta bort en sparad låt bland dina tillgångar och använda den som bakgrundsmusik till en video. Lolly Demo och Lolly Start levereras med sex sparade låtar vardera.

Visualiseraren hör varje spår på en jämn nivå, så ett tyst spår rör bilden lika mycket som ett starkt, oavsett volym. Varje Lolly Sings-genre, och en sparad låt från en sådan, erbjuder **Light visualiser**: enkla nivåstaplar som lämnar den bearbetningstid musiken behöver. Light visualiser är på från start för pekskärmar och för enheter med högst fyra kärnor eller högst 4 GB minne.
:::

Du kan använda gränssnittet med tangentbordet. Anpassade kontroller har etiketter för skärmläsare. Varje verktygs levande förhandsvisning är en enda bild med en etikett som beskriver vad den visar.

### Lagring

Lagringsmätaren visar varje byte som den här installationen innehåller, uppdelat efter kategori och jämfört med vad webbläsaren rapporterar.

![Lagringsmätaren, som delar upp sparade sessioner, bilder och cache i förhållande till vad webbläsaren faktiskt rapporterar](/t/url-shot?url=%2F%23%2Fsettings%3Ffocus%3Dstorage-section&width=1440&height=1800&dpi=192&waitMs=2400&css=%5Bdata-store-group%3Dmove%5D%2C.storage-actions%2C.store-selbar%7Bdisplay%3Anone%7D&waitSelector=%5Bdata-store-group%3Dmove%5D&drive=click%3A%5Bdata-store-group%3Dwork%5D%3Esummary%3Bclick%3A%5Bdata-store-group%3Dcaches%5D%3Esummary&walker=1&format=svg&cropSelector=.store-meter&dark=1&filename=pd-storage-meter)

Under mätaren:

- **Move to another device** har **Export my data**, **Import data…** och **Export my data & render everything**. [Flytta ditt arbete till en annan enhet](/info/find-your-work.html#move-your-work-to-another-device) går igenom dem.
- **Clear cache** tar bort nedladdade katalogfiler som laddas ner igen när de behövs.
- **Remove automatic checkpoints older than 30 days** frigör utrymme i History och behåller sparade och namngivna versioner.
- **Clear all my data** tar bort allt som Lolly behåller i den här webbläsaren, efter att du skrivit ett ord för att bekräfta. [Om du rensar dina webbläsardata](/info/find-your-work.html#if-you-clear-your-browser-data) listar vad som försvinner.

### Tillgängligt offline

Lolly cachelagrar bara de vyer du har besökt. **Available offline** laddar ner de delar du kommer att behöva, med en enda förloppsindikator, och de fortsätter fungera utan anslutning.

- <!--i:monitor--> **App, catalogue and guides** - **The app** (varje vy, redigerare och typsnitt, även skärmar du aldrig har öppnat), **Catalogue** (hela katalogen eller **Choose by tag**) och **Guides & docs** (den här dokumentationen på ditt språk, inklusive skärmbilder).
- <!--i:cpu--> **AI models** - varje modell som körs på enheten på en egen rad med sin storlek: talröster, uppskalningsmodeller, bakgrundsborttagning, textigenkänning, Lolly Verify-djupskanning, beständig autenticitetsinformation, omskrivningsmodell, matchningsmodell för Ask, AI-textdetektor och sångröster. En modell över 50 MB är märkt **large download**.
- <!--i:wrench--> **Tools** - varje verktyg laddas ner för sig, eller så hämtar **Download all** alla verktyg. En bock betyder att det är redo att användas offline.

**Download everything** högst upp hämtar appen, det urval av katalogen du valde, guiderna och alla verktyg. Markera **Include all the AI models** för att ta med modellerna, eller ladda ner en modell från dess egen rad. Sångrösterna laddas bara ner från sin egen rad. En organisations policy kan stänga av AI-nedladdningar, och då visas det på raderna.

Nedladdningar fortsätter där de avbröts om du avbryter eller tappar anslutningen. När du är online igen uppdateras de och hämtar bara det som ändrats i en ny version. Om webbläsaren inte har beviljat beständig lagring ber **Protect downloads** om det tillståndet. Utan tillståndet kan webbläsaren radera nedladdningar när den vill frigöra utrymme.

### Lolly-instans

**Lolly instance** visar var den här installationen hämtar sina verktyg och sin katalog: en instansadress eller *Bundled with this app* när allt ingår i bygget.

- **Design-system source** visar varifrån det medföljande designsystemet kommer.
- **Instance console** öppnar en driftsättnings administratörssidor, om sådana finns.
- **Change** riktar skrivbordsappen mot en annan instans. En webbläsare kan inte ladda verktyg och tillgångar från andra ursprung, så på webben erbjuder avsnittet **Open a workspace** i stället.
- **Leave** tar bort instansens designsystem, verktyg och katalog. Ditt eget arbete finns kvar. Se [Använd Lolly i din organisation](/info/organisation.html#leaving).
- När du är inloggad i en organisation avslutar **Sign out** den här sessionen och **Sign out everywhere** avslutar dina sessioner på alla enheter, även den här.

<!--i:eti-monitor-->
## Den här enheten

- <!--i:monitor--> **This Machine** - skärm, inmatning, grafik, minne, kodekar, lagringsbackend och mer, avläst direkt från den här sessionen. Inget lagras eller skickas. På en bred skärm öppnas panelen automatiskt och fliken använder två kolumner.
- <!--i:neurobeat--> **Sound** - gränssnittsljuden och Neurospicy-fokuslooparna. Sound är den enda omkopplaren på den här fliken som skriver något.
- <!--i:database--> **Storage** - en skrivskyddad vy av mätaren. Rensa eller flytta dina data i [Preferences](#storage).

<!--i:eti-palette-->
## Designsystem

Det aktiva designsystemet, uppställt för läsning. När den här webbläsaren har två eller fler designsystem listas de i en rad omslag högst upp. Välj ett för att göra det aktivt. **Undo** i meddelandet som följer återställer det föregående.

![Fliken Design system med Lolly Demo: en rad omslag för att byta system, sedan omslaget med logotyp, namn, anteckning och antal som öppnar varje sida](/t/url-shot?url=%2F%23%2Fsettings%3Ftab%3Dbrand&width=1440&height=900&dpi=192&waitMs=2400&format=svg&walker=1&dark=1&filename=settings-design-system)

Fliken öppnas med ett omslag i systemets egna färger, med logotypen, namnet i dess displaytypsnitt och anteckningen från dess upphovsperson. En rad med antal på omslaget länkar till varje sida:

- <!--i:palette--> **Colour** - yta, text, primär och sekundär för det ljusa och mörka utseendet, varje namngiven färg som ett chip med namn och hexvärde, ett band för varje nyansskala och diagramspektrumet samt färgrollerna i ett hopfällbart avsnitt. Välj ett värde för att kopiera hexvärdet.
- <!--i:font--> **Type** - Headings, Text, Emphasis och Code, var och en satt i sitt eget typsnitt.
- <!--i:photos--> **Logos** - varje logotypfil på den bakgrund den gjordes för.
- <!--i:layers--> **Colourways** - varje färgvariants ljusa och mörka par, när systemet har fler än en.
- <!--i:sliders--> **Tokens** - radie, avstånd, effekter och gradienter.
- <!--i:document--> **Print & CMYK** - färgerna som är låsta till en exakt tryckfärg och de tryckförhållanden som en CMYK-PDF kan ange.

Att byta system är den enda ändring den här fliken gör. Redigera ett designsystem i [Lolly Design System Setup](/info/brand-studio.html) på `#/start`, som omslaget länkar till. Ett skrivskyddat system anger det på omslaget. Lokala system som du skapar förblir redigerbara. `/b` och `/brand` är kortlänkar till den här fliken.

<!--i:eti-grid-->
## Funktioner

Varje del av plattformen har ett kort, indelade i tolv grupper: upplevelser, plattformar & körmiljöer, tillgänglighet & språk, exportformat, importformat, tryckproduktion, automatisering & AI, determinism & reproducerbarhet, varumärke & designsystem, integritet & dataägande, säkerhet & åtkomstkontroll och arkitektur (för utvecklare). Varje grupp är hopfällbar och visar antalet kort. Ett kort öppnar en dialog med detaljer om funktionen och, för ungefär hälften av korten, skärmbilden som används i den här dokumentationen.

Sökfältet ovanför grupperna filtrerar korten medan du skriver och öppnar de grupper som har en träff. Fältet visar hur många funktioner sökningen omfattar. Om en sökning inte ger någon träff anges det i text.

Den här fliken dokumenterar vad Lolly kan göra, i takt med de här guiderna. Den undersöker inte datorn du använder; det gör **This device**.

<!--i:eti-gauge-->
## Aktivitet & statistik

Först bygget: antalet inlästa verktyg, exportformat, miljöer som plattformen körs i och varumärkestillgångar i katalogen. En **Catalogue**-panel visar vad som ingår i det här bygget.

Sedan ditt eget arbete: **Your activity** räknar det du har skapat på den här enheten. **Recent creations** och **Latest exports** är staplar som du kan svepa igenom och som visas när de har något innehåll. Båda öppnar ett objekt som det var. Räknarna stannar på enheten. En valfri Lolly Work-instans har sin egen [organisationstelemetri och sina egna granskningsposter](/info/privacy.html#organisation-services-with-lolly-work).

<!--i:eti-link-->
## Djuplänkar

Varje flik och avsnitt i Settings har en egen länk att bokmärka eller klistra in. [Lolly Search](/info/search.html) bygger sina **Settings**-resultat från samma register som Settings, så ett namnbyte på ett avsnitt förstör aldrig en sökträff.

::: details Alla länkformer

- **En flik:** `#/settings?tab=brand`, `#/settings?tab=caps`, `#/settings?tab=device`, `#/settings?tab=activity`.
- **Ett avsnitt i Preferences:** `#/settings?focus=<section-id>`, till exempel `#/settings?focus=offline-section`.
- **Ett exakt avsnitt:** dess id som en fristående flagga, till exempel `#/settings?dash-storage`, `#/settings?dash-logos`, `#/settings?dash-colourways` eller `#/settings?cap-formats`. De äldre länkarna `#/settings?dash-lock` och `#/settings?dash-palette-wheel` öppnar omslaget och sidan Colour.
- **Ett avsnitt via nyckelord:** `#/settings?print`, `#/settings?formats`, `#/settings?palette` (sidan Colour) eller `#/settings?tokens`. Två avsnitt kan dela ett nyckelord: `print` tillhör både varumärkesflikens tryckreferens och gruppen Print production, och det som kommer först på sidan väljs. Använd id:t för att välja ett av dem.

En djuplänk växlar till fliken som innehåller målet och öppnar alla grupper som målet är hopfällt i. Sedan rullar den till målet när avsnitten ovanför har fått sin layout. De tidigare adresserna `#/platform` och `#/capabilities` öppnas i Settings med sina djuplänksflaggor intakta.
:::

---

**Relaterat:** [Profiler](/info/profile.html) för dina uppgifter och de sammanhang du skapar i. [Lolly Design System Setup](/info/brand-studio.html) för att redigera det som fliken Design system visar. [Hitta och återställ ditt arbete](/info/find-your-work.html) för lagring, säkerhetskopior och byte av enhet.
