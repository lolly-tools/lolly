# Settings

Settings är där du ändrar hur Lolly fungerar för dig: dina uppgifter, designsystemet du använder, tillgänglighet, vad som lagras på den här enheten och vad som är redo offline. Öppna det med **Settings** i fältet längst ner på startskärmen, eller från din avatarmeny. Det öppnas på **Preferences**, med fyra flikar till bredvid.

| Flik | Adress | Vad den håller |
|---|---|---|
| **Preferences** | `#/settings` | Dina uppgifter, designsystem, utseende, emoji, tillgänglighet, anslutningar, lagring och offlinenedladdningar |
| **This device** | `#/settings?tab=device` | En levande avläsning av den här webbläsaren och maskinen, plus ljud och en skrivskyddad lagringsvy |
| **Design system** | `#/settings?tab=brand` | Det aktiva designsystemet som ett omslag och sidor, med ett band av omslag för att byta system |
| **Capabilities** | `#/settings?tab=caps` | Allt Lolly kan göra, som sökbara kort |
| **Activity & stats** | `#/settings?tab=activity` | Katalogen, dina lokala räknare och senaste arbete |

Varje flik har sin egen adress, och gamla länkar till `#/profile` och `#/d` öppnar fortfarande rätt ställe, ända ned till enskilda inställningar.

## Preferences

Preferences är en lång sida med en **inställningsrail** längs sidan och ett fält **Search settings** ovanför railen som filtrerar den medan du skriver. Varje avsnitt öppnas direkt från en länk av formen `#/settings?focus=<section-id>`, till exempel `#/settings?focus=storage-section`.

- <!--i:usercheck--> **Your details** - ditt namn, dina kontaktuppgifter och ditt porträtt, och reglaget **Use my details to create**. [Profiler](/info/profile.html) förklarar hur verktyg använder dem.
- <!--i:seal--> **Content Credentials** - den valfria verifierade identiteten som signerar dina exporter. Se [Content Credentials](/info/content-credentials-identity.html).
- <!--i:palette--> **Design systems** - byt, lägg till, dölj eller ta bort designsystem. [Design System Setup](/info/brand-studio.html#manage-your-design-systems) beskriver varje åtgärd.
- <!--i:moon--> **Appearance** - temat (Light, Dark eller Brand, som målar appen i din palett) och **Interface follows the design system**.
- <!--i:sparkle--> **Emoji** - uppsättningen dina emoji ritas från när du börjar något nytt, med dess konstlicens, och hur starkt din palett färgar om dem (**Off**, **Subtle**, **Strong**, **Full**, **Mono** eller **Duotone**). **Keep skin tones and flags** låter dem behålla sina egna färger. Arbete du redan gjort behåller uppsättningen det gjordes med.
- <!--i:eyeoff--> **Accessibility** - fyra komfortreglage, plus Sound och Neurospicy Mode. Se [Tillgänglighet](#accessibility).
- <!--i:link--> **Connected services** - lagring du ansluter, som Dropbox, Google Drive, OneDrive, Nextcloud eller S3, och **Sync across devices**. Se [Synkronisera dina enheter](/info/sync.html).
- <!--i:globe--> **Trusted sites** - webbplatserna som en Design-webbsiderutan eller en Sandbox-demo får kontakta utan att fråga, och, där servern erbjuder det, **Allow pages from any site**. [Integritetspolicyn](/info/privacy.html) listar vad varje förfrågan skickar.
- <!--i:download--> **Your renders** - **Save my renders to my library** behåller en kopia av varje bild, ljudklipp och video du laddar ner i Assets, under taggen Renders.
- <!--i:database--> **Storage** - vad Lolly behåller på den här enheten, och knapparna som rensar eller bär dina data. Se [Lagring](#storage).
- <!--i:cpu--> **Available offline** - ladda ner det du behöver innan du förlorar anslutningen. Se [Available offline](#available-offline).
- <!--i:folder--> **Hot folder** - i datorappen, bevaka en mapp och dra in allt som släpps i den i Lolly, genom samma väljare som ett dra-och-släpp får.
- <!--i:clock--> **Your activity** - vad du har gjort på den här enheten, räknat lokalt.
- <!--i:sliders--> **Feature flags** - slå på eller av delar av appen, som **Print preflight** eller **Strip metadata from uploads**.
- <!--i:server--> **Lolly instance** - var den här installationen hämtar sina verktyg och sin katalog. Se [Lolly instance](#lolly-instance).

Temakorten är levande förhandsvisningar och tillämpas i samma stund du väljer ett, bara på den här enheten.

![Tre temakort, vart och ett med en förhandsvisning av sin egen typografi och färg, med det aktiva flaggat](/t/url-shot?url=%2F%23%2Fsettings%3Ffocus%3Dappearance-section&width=1440&height=1400&dpi=192&waitMs=1600&walker=1&format=svg&cropSelector=.profile-card--appearance&dark=1&filename=pd-theme-picker)

### Tillgänglighet

**Settings → Preferences → Accessibility** håller fyra komfortinställningar för appen runt ditt arbete. Var och en är av tills du slår på den, och ingen av dem når in i en verktygsyta eller en export, så en lugnare app flyttar aldrig en pixel i filen du levererar.

- <!--i:pause--> **Reduce motion** stänger av appens övergångar, svep och krusiduller. Din yta och alla animerade exporter fortsätter röra sig som designat.
- <!--i:photos--> **Hide colourful previews** byter galleriets förhandsvisningskonst mot lugna kort med ikon och text, och dämpar projektminiatyrer så att de förblir igenkännbara utan att skrika.
- <!--i:sliders--> **High contrast** förstärker appens kanter, text och fokusringar. Dina varumärkesfärger och ytan förblir som du ställt in dem.
- <!--i:font--> **Large text** förstorar appens etiketter, menyer och knapptext. Typ inne i dina designer rörs inte, så inget du exporterar bryts om.

De här inställningarna ligger på din profil, så de följer med i en profilexport och kommer fram på nästa installation med ditt namn och dina sessioner. En liten kopia bara för enheten tillämpar dem före den första målningen.

Samma kort håller **Sound**, ett milt lager av hjälpljud för det du gör (att komma till galleriet, ett Content Credentials-resultat, att stänga en panel), och **Neurospicy Mode**, ett lugnt fokusspår. Att slå på Neurospicy öppnar en liten spelare i hörnet som följer dig genom appen. Där väljer du ett spår, hoppar över, ställer in volymen och minimerar eller stänger spelaren. Spår inkluderar procedurella *Lolly Sings*-melodier, ambienta loopar och beats, ditt eget ljud och internetradiostationer, som kräver anslutning. Båda är av som standard och kommer ihåg, och att stänga av Sound tystar också fokusspåret. Profilmenyn och **This device** bär samma reglage.

Gränssnittet går att navigera med tangentbord, anpassade kontroller bär etiketter för skärmläsare och varje verktygs levande förhandsvisning exponeras som en etiketterad bild som beskriver vad den visar.

### Lagring

Lagringsmätaren redovisar varje byte den här installationen håller, kategori för kategori, mot vad webbläsaren rapporterar.

![Lagringsmätaren, som bryter ned sparade sessioner, bilder och cache mot vad webbläsaren faktiskt rapporterar](/t/url-shot?url=%2F%23%2Fsettings%3Ffocus%3Dstorage-section&width=1440&height=1800&dpi=192&waitMs=2400&css=%5Bdata-store-group%3Dmove%5D%2C.storage-actions%2C.store-selbar%7Bdisplay%3Anone%7D&waitSelector=%5Bdata-store-group%3Dmove%5D&drive=click%3A%5Bdata-store-group%3Dwork%5D%3Esummary%3Bclick%3A%5Bdata-store-group%3Dcaches%5D%3Esummary&walker=1&format=svg&cropSelector=.store-meter&dark=1&filename=pd-storage-meter)

Under mätaren:

- **Move to another device** har **Export my data**, **Import data…** och **Export my data & render everything**. [Flytta ditt arbete till en annan enhet](/info/find-your-work.html#move-your-work-to-another-device) går igenom dem.
- **Clear cache** släpper nedladdade katalogfiler, som laddas ner igen vid behov.
- **Remove automatic checkpoints older than 30 days** frigör utrymme i History och behåller sparade och namngivna versioner.
- **Clear all my data** tar bort allt Lolly behåller i den här webbläsaren, efter att du skrivit ett ord för att bekräfta. [Om du rensar webbläsardata](/info/find-your-work.html#if-you-clear-your-browser-data) listar vad som försvinner.

### Available offline

Lolly cachar skärmar när du besöker dem, vilket bara täcker platser du redan varit på. **Available offline** är för resan du ser komma: ladda ner de delar du behöver och titta på ett förloppsfält, så fortsätter allt du tog med fungera utan anslutning.

- <!--i:monitor--> **App, katalog och guider** - **The app** (varje vy, redigerare och typsnitt, inklusive skärmar du aldrig öppnat), **Catalogue** (allt, eller **Choose by tag**) och **Guides & docs** (den här dokumentationen på ditt språk, skärmbilder inkluderade).
- <!--i:cpu--> **AI-modeller** - varje modell på enheten på en egen rad med sin storlek: Speech voices, Upscaling models, Background removal, Text recognition, Verify deep scan, Durable credential, Rewriter model, Ask matching model, AI text detector och Singing voices. En modell över 50 MB märks **large download**.
- <!--i:wrench--> **Verktyg** - varje verktyg laddas ner för sig, eller så tar **Download all** varje verktyg. En bock betyder redo offline.

**Download everything** överst tar appen, katalogomfånget du valt, guiderna och alla verktyg. Kryssa i **Include all the AI models** för att lägga till modellerna, eller ladda ner en modell från dess egen rad; sångrösterna laddas bara någonsin ner från sin egen rad. En organisations policy kan stänga av AI-nedladdningar, och raderna säger det då.

Nedladdningar återupptas där de slutade om du avbryter eller förlorar anslutningen, och uppdaterar sig själva när du är online igen och hämtar bara det en version ändrat. Om webbläsaren inte beviljat beständig lagring ber **Protect downloads** om det: skillnaden mellan "nedladdat" och "nedladdat tills webbläsaren vill ha utrymmet tillbaka".

### Lolly instance

**Lolly instance** anger var den här installationen hämtar sina verktyg och sin katalog: en instans adress, eller *Bundled with this app* när allt levereras inuti bygget.

- **Design-system source** visar varifrån det tillhandahållna designsystemet kommer.
- **Instance console** öppnar en installations adminsidor, där den erbjuder dem.
- **Change** pekar datorappen mot en annan instans. En webbläsare kan inte läsa in verktyg och tillgångar över ursprung, så på webben erbjuder avsnittet **Open a workspace** i stället.
- **Leave** tar bort instansens designsystem, verktyg och katalog, och ditt eget arbete blir kvar. Se [Använd Lolly i din organisation](/info/organisation.html#leaving).
- När du är inloggad på en organisation avslutar **Sign out** den här sessionen och **Sign out everywhere** avslutar dina sessioner på varje enhet, den här inkluderad.

## This device

- <!--i:monitor--> **This Machine** - skärm, indata, grafik, minne, kodekar, lagringsbackend med mera, avläst live från den här sessionen. Inget lagras och inget skickas. Den öppnas av sig själv på en bred skärm, där fliken läggs ut i två kolumner.
- <!--i:neurobeat--> **Sound** - gränssnittsljuden och Neurospicy-fokusloopar, det enda reglaget på den här fliken som skriver något.
- <!--i:database--> **Storage** - en skrivskyddad vy av mätaren i [Preferences](#storage), där du rensar eller bär dina data.

## Design system

Det aktiva designsystemet, uppställt för läsning. När den här webbläsaren håller två eller fler designsystem listar ett band av små omslag högst upp dem: välj ett för att göra det aktivt, och **Undo** i notisen som följer sätter tillbaka det föregående.

![Fliken Design system på Lolly Demo: ett band av omslag för att byta system, sedan omslaget med sin logotyp, sitt namn, sin anteckning och räknarna som öppnar varje sida](/t/url-shot?url=%2F%23%2Fsettings%3Ftab%3Dbrand&width=1440&height=900&dpi=192&waitMs=2400&format=svg&walker=1&dark=1&filename=settings-design-system)

Fliken öppnas på ett omslag målat i systemets egna färger, med dess logotyp, dess namn i dess visningstypsnitt och anteckningen dess upphovsperson skrev. En rad med räknare på omslaget länkar till varje sida:

- <!--i:palette--> **Colour** - yta, text, primär och sekundär i de ljusa och mörka utseendena, varje namngiven färg som ett chip med namn och hexvärde, ett band för varje nyansramp och diagramspektrumet, och färgrollerna i en hopfällning. Välj ett värde för att kopiera hexvärdet.
- <!--i:font--> **Type** - Headings, Text, Emphasis och Code, var och en satt i sitt eget typsnitt.
- <!--i:photos--> **Logos** - varje logotypfil på den grund den gjordes för.
- <!--i:layers--> **Colourways** - det ljusa och mörka paret i varje färgvariant, när systemet har fler än en.
- <!--i:sliders--> **Tokens** - radie, avstånd, effekter och gradienter.
- <!--i:document--> **Print & CMYK** - färgerna låsta till en exakt färg, och tryckförhållandena en CMYK-PDF kan deklarera.

Att byta är den enda ändring den här fliken gör. Du redigerar ett designsystem i [Design System Setup](/info/brand-studio.html) på `#/start`, som omslaget länkar till. Ett skrivskyddat system säger det på sitt omslag; lokala system du skapar förblir redigerbara. `/b` och `/brand` är genvägar direkt till den här fliken.

## Capabilities

Varje del av plattformen är beskriven som ett kort, i tolv grupper: Experiences, Platforms & runtimes, Accessibility & languages, Export formats, Import formats, Print production, Automation & AI, Determinism & reproducibility, Brand & design system, Privacy & data ownership, Security & access control och Architecture (for builders). Varje grupp viks och visar sitt antal kort. Ett kort öppnas i en dialog med den förmågans funktioner och, för ungefär hälften av dem, skärmbilden som den här dokumentationen använder.

Sökfältet ovanför grupperna filtrerar korten medan du skriver och öppnar de grupper som fortfarande har en träff. Det säger hur många förmågor det söker i, och en fråga utan träff säger det med ord.

Den här fliken är skriven dokumentation av vad Lolly kan göra, hållen i takt med de här guiderna. Den undersöker inte maskinen du sitter vid; **This device** gör det.

## Activity & stats

Bygget först: hur många verktyg som är inlästa, hur många exportformat som finns, på hur många ytor plattformen körs och hur många varumärkestillgångar katalogen bär, med en panel **Catalogue** som bryter ned vad som levereras i det här bygget.

Sedan din egen sida: **Your activity** räknar vad du har gjort på den här enheten, och **Recent creations** och **Latest exports** är staplar du kan svepa genom, var och en visas först när det finns något att visa. Båda öppnar ett objekt som det var. De här räknarna stannar på enheten; en valfri Lolly Work-instans för sina egna [organisationstelemetri- och granskningsposter](/info/privacy.html#organisation-services-with-lolly-work).

## Djuplänkar

Varje flik och avsnitt i Settings har sin egen länk, som du kan bokmärka eller klistra in. [Sök](/info/search.html) pekar sina **Settings**-resultat mot samma register som Settings renderas från, så att ett avsnitt inte kan döpas om under ett sökresultat.

::: details Varje form av länk

- **En flik:** `#/settings?tab=brand`, `#/settings?tab=caps`, `#/settings?tab=device`, `#/settings?tab=activity`.
- **Ett Preferences-avsnitt:** `#/settings?focus=<section-id>`, till exempel `#/settings?focus=offline-section`.
- **Ett avsnitt, exakt:** dess id som en bar flagga, till exempel `#/settings?dash-storage`, `#/settings?dash-logos`, `#/settings?dash-colourways` eller `#/settings?cap-formats`. De äldre länkarna `#/settings?dash-lock` och `#/settings?dash-palette-wheel` öppnar omslaget och sidan Colour.
- **Ett avsnitt via nyckelord:** `#/settings?print`, `#/settings?formats`, `#/settings?palette` (sidan Colour) eller `#/settings?tokens`. Nyckelord kan delas: `print` hör till både varumärkesflikens tryckreferens och gruppen Print production, och den första i sidordning vinner. Använd id:t när det spelar roll vilken.

En djuplänk byter till fliken som äger målet, öppnar varje grupp den ligger hopfälld i och rullar sedan till den, och väntar en stund medan avsnitten ovanför blir färdiglagda. De utgångna adresserna `#/platform` och `#/capabilities` viks in i Settings med sina djuplänksflaggor intakta.
:::

---

**Relaterat:** [Profiler](/info/profile.html) för dina uppgifter och sammanhangen du skapar i. [Design System Setup](/info/brand-studio.html) för att redigera det fliken Design system visar. [Hitta och återställ ditt arbete](/info/find-your-work.html) för lagring, säkerhetskopior och byte av enhet.
