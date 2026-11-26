# Arbeta med partner

Många arbeten bär två varumärken, till exempel en sponsors logotyp på en evenemangsaffisch, en återförsäljares erbjudande under tillverkarens namn, ett gemensamt tillkännagivande eller en fallstudie skriven med en leverantör. Den här sidan är för båda sidor.

På den här sidan är **huvudvarumärket** det varumärke vars designsystem ett arbete skapas i, och **partnern** är det andra varumärket på arbetet. Båda sidor kan skapa arbetet. [Varumärkesarkitekturer](/info/brand-architectures.html#co-branding) jämför gemensam varumärkesprofilering med andra varumärkesupplägg.

<!--i:eti-info-->
## Så hanterar Lolly två varumärken i dag

- **Ett designsystem ritar varje arbete.** Huvudvarumärkets färger, typografi och egna regler gäller. Partnerns logotyp läggs in som grafik: en bild från Assets, eller en egen logotyp sparad i ett designsystem.
- **Ett varumärke följer med som en fil.** En designsystemfil (`.lolly`) innehåller tokens, typsnitt och logotyper. Ett återanvändbart verktyg som skapats med **Share with rules** innehåller en färdig layout med de indata du tillåter. Varumärkesfärdigheter följer med som egna filer.
- **Ett varumärke kan också ha en adress.** En [varumärkessida](/info/brand-page.html) publicerar logotyper, färger, typografi och regler som en partner kan läsa, med tokens och färdigheter för deras verktyg.
- **Lolly kontrollerar bara huvudvarumärkets regler.** Lolly känner inte till partnerns regler, till exempel friyta eller minimistorlek, så kontrollera dem mot partnerns riktlinjer. I ett Lolly Work-partnerprogram innehåller ett företags partnerkit dess regler, och Lolly Design kontrollerar företagets logotyper mot kitet.
- **Ett helt partnerprogram körs på Lolly Work.** När återförsäljare, distributörer eller andra partner skapar arbeten med ditt varumärke i din Lolly Work ger ett partnerprogram varje partnerföretag bara de verktyg, filer och mallar du väljer. Programmet sparar företagets logotyper och uppgifter, fyller i dem i dina mallar och registrerar företaget i varje fil. [Driv ett partnerprogram](/info/manage/run-a-partner-programme.html) är guiden för teamet som driver ett.

<!--i:eti-folder-shared-->
## Dela ditt varumärke med en partner

### Välj vad du ska skicka

| Skicka | Hur | Partnern får | Passar |
| --- | --- | --- | --- |
| En designsystemfil | **Export** i fältet överst i [Lolly Design System Setup](/info/brand-studio.html#move-a-brand-between-devices) | Dina tokens, typsnitt, logotyper och temainställningar, som ett designsystem de kan byta till | En partner som skapar många arbeten med ditt varumärke |
| Ett återanvändbart verktyg | I Lolly Design, **Share with rules** ([Dela en design med regler](/info/create-a-tool.html)) | En färdig layout med de indata du tillåter, till exempel deras namn och logotyp. Filen innehåller de upplösta färgvärdena, typsnitten och bilderna, så deras eget designsystem kan inte ändra stilen på den fasta grafiken | Ett flygblad, en bricka eller en banderoll med båda varumärkena som varje partner fyller i |
| Varumärkesfärdigheter | Rummet **Skills**: **Download skill (.zip)** eller **Copy as one file** | Dina skrivna standarder, för deras medarbetare och agenter | Något av ovanstående, när en agent gör en del av arbetet |
| En varumärkessida | **Publish a brand page** i Lolly Design System Setup, eller `lolly system publish`, skriver en mapp som du är värd för ([Varumärkessidor](/info/brand-page.html)) | Dina aktuella logotyper, färger, typografi och regler på en adress, med tokens och färdigheter för deras verktyg. Logotyper och typsnittsfiler visas när deras rättigheter tillåter det, och sidan listar vad den utelämnade | Delning med människor som du inte skickar filer till |
| Tokens | **Tokens (.json)** i studions meny **More** | Det rena dokumentet med designtokens, utan typsnitt eller logotyper | En partners egna designverktyg eller bygge |

![Lolly Design System Setup med Lolly Demo, öppet i rummet Skills: Export i listen, menyn More öppen på Tokens (.json) samt Download skill (.zip) och Copy as one file bredvid den valda färdigheten](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dskills&width=1200&height=900&dpi=192&waitMs=1800&waitSelector=.skills-reader-actions&drive=click%3A%5Bdata-ds-more%5D%3Bwait%3A500&format=svg&walker=1&dark=1&filename=partners-send)

::: warning Dina typsnitt följer med i filen
Typsnitt du har lagt till följer med i en designsystemfil, så kontrollera att deras licenser tillåter att du skickar filerna vidare.
:::

Ett återanvändbart verktyg ber dig bekräfta innan det tar med en bild vars licens begränsar användningen ([Förhandsvisa och dela](/info/create-a-tool.html#preview-and-share)).

### Skapa en mall för gemensam varumärkesprofilering

Ett återanvändbart verktyg håller varje partners delar på plats i din layout. En partner ändrar bara det du tillåter.

1. Skapa materialet i ditt designsystem i Lolly Design. Rita en bildruta där partnerns logotyp ska vara och lämna det utrymme runt rutan som layouten behöver.
2. Välj **Share with rules** i File menu. Markera bildrutan och välj **Make editable**. Tillåt uppladdning av ersättningsbilder i dess **Rules**, ange en minsta pixelstorlek och de uppladdningsformat du accepterar (SVG där det går). Ställ in rutans **Image fit** på **Contain (fit inside)** för att hålla en bred eller hög logotyp inom rutan.
3. Gör även partnerns namn eller erbjudande redigerbart, med en teckengräns.
4. Tryck på **Preview** och prova en mycket bred logotyp, en mycket hög och ett långt namn.
5. Välj **Share .lolly** och skriv instruktioner till partnern: vilken version av logotypen de ska ladda upp, till exempel den horisontella logotypen i fullfärg för en ljus bakgrund.

![Share with rules på ett evenemangskort med gemensam varumärkesprofilering: partnerns logotypruta är markerad och redigerbar, och dess Rules tillåter bilduppladdningar på minst 480 gånger 110 pixlar i PNG eller SVG](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Fboxes%3D%255B%257B%2522id%2522%253A%2522board%2522%252C%2522name%2522%253A%2522Build%2520day%2520card%2522%252C%2522kind%2522%253A%2522frame%2522%252C%2522x%2522%253A0%252C%2522y%2522%253A0%252C%2522w%2522%253A1600%252C%2522h%2522%253A900%252C%2522shape%2522%253A%2522rect%2522%252C%2522bg%2522%253A%2522%257Bcolor.brand.sugar%257D%2522%252C%2522clipChildren%2522%253Atrue%257D%252C%257B%2522id%2522%253A%2522dot-large%2522%252C%2522name%2522%253A%2522Large%2520circle%2522%252C%2522kind%2522%253A%2522box%2522%252C%2522x%2522%253A1040%252C%2522y%2522%253A70%252C%2522w%2522%253A480%252C%2522h%2522%253A480%252C%2522shape%2522%253A%2522circle%2522%252C%2522bg%2522%253A%2522%257Bcolor.brand.pandanus%257D%2522%252C%2522frame%2522%253A%2522board%2522%257D%252C%257B%2522id%2522%253A%2522dot-small%2522%252C%2522name%2522%253A%2522Small%2520circle%2522%252C%2522kind%2522%253A%2522box%2522%252C%2522x%2522%253A1330%252C%2522y%2522%253A380%252C%2522w%2522%253A240%252C%2522h%2522%253A240%252C%2522shape%2522%253A%2522circle%2522%252C%2522bg%2522%253A%2522%257Bcolor.brand.green-apple%257D%2522%252C%2522frame%2522%253A%2522board%2522%257D%252C%257B%2522id%2522%253A%2522band%2522%252C%2522name%2522%253A%2522Partner%2520band%2522%252C%2522kind%2522%253A%2522box%2522%252C%2522x%2522%253A0%252C%2522y%2522%253A680%252C%2522w%2522%253A1600%252C%2522h%2522%253A220%252C%2522shape%2522%253A%2522rect%2522%252C%2522bg%2522%253A%2522%257Bcolor.brand.avocado%257D%2522%252C%2522frame%2522%253A%2522board%2522%257D%252C%257B%2522id%2522%253A%2522lolly%2522%252C%2522name%2522%253A%2522Lolly%2520logo%2522%252C%2522kind%2522%253A%2522image%2522%252C%2522x%2522%253A120%252C%2522y%2522%253A96%252C%2522w%2522%253A260%252C%2522h%2522%253A90%252C%2522image%2522%253A%2522lolly%2Flogo%2Fhorizontal%2522%252C%2522fit%2522%253A%2522contain%2522%252C%2522imgpos%2522%253A%2522left%2522%252C%2522frame%2522%253A%2522board%2522%257D%252C%257B%2522id%2522%253A%2522headline%2522%252C%2522name%2522%253A%2522Headline%2522%252C%2522kind%2522%253A%2522text%2522%252C%2522x%2522%253A120%252C%2522y%2522%253A260%252C%2522w%2522%253A880%252C%2522h%2522%253A180%252C%2522text%2522%253A%2522Build%2520day%25202026%2522%252C%2522fg%2522%253A%2522%257Bcolor.brand.liquorice%257D%2522%252C%2522fontSize%2522%253A120%252C%2522weight%2522%253A%2522700%2522%252C%2522font%2522%253A%2522display%2522%252C%2522align%2522%253A%2522left%2522%252C%2522valign%2522%253A%2522middle%2522%252C%2522frame%2522%253A%2522board%2522%257D%252C%257B%2522id%2522%253A%2522sub%2522%252C%2522name%2522%253A%2522Subtitle%2522%252C%2522kind%2522%253A%2522text%2522%252C%2522x%2522%253A120%252C%2522y%2522%253A450%252C%2522w%2522%253A880%252C%2522h%2522%253A90%252C%2522text%2522%253A%2522Twelve%2520hours%2520of%2520making%252C%2520with%2520friends%2522%252C%2522fg%2522%253A%2522%257Bcolor.brand.basalt%257D%2522%252C%2522fontSize%2522%253A48%252C%2522align%2522%253A%2522left%2522%252C%2522valign%2522%253A%2522middle%2522%252C%2522frame%2522%253A%2522board%2522%257D%252C%257B%2522id%2522%253A%2522with%2522%252C%2522name%2522%253A%2522In%2520partnership%2520with%2522%252C%2522kind%2522%253A%2522text%2522%252C%2522x%2522%253A120%252C%2522y%2522%253A750%252C%2522w%2522%253A400%252C%2522h%2522%253A80%252C%2522text%2522%253A%2522In%2520partnership%2520with%2522%252C%2522fg%2522%253A%2522%257Bcolor.brand.basalt%257D%2522%252C%2522fontSize%2522%253A34%252C%2522align%2522%253A%2522left%2522%252C%2522valign%2522%253A%2522middle%2522%252C%2522frame%2522%253A%2522board%2522%257D%252C%257B%2522id%2522%253A%2522partner%2522%252C%2522name%2522%253A%2522Partner%2520logo%2522%252C%2522kind%2522%253A%2522image%2522%252C%2522x%2522%253A500%252C%2522y%2522%253A735%252C%2522w%2522%253A480%252C%2522h%2522%253A110%252C%2522image%2522%253A%2522%2Ftools%2Flogo-wall%2Fassets%2Fpartner-name.svg%2522%252C%2522fit%2522%253A%2522contain%2522%252C%2522frame%2522%253A%2522board%2522%257D%255D%26w%3D1600%26h%3D900&width=1280&height=1000&dpi=192&waitMs=3000&drive=click%3Abutton%5Baria-label%3D%22File%20menu%22%5D%3Bwait%3A500%3Bclick%3Atext%3DShare%20with%20rules%3Bwait%3A2500%3Bclick%3A%23tool-canvas%20%5Bdata-box-id%3D%22partner%22%5D%3Bclick%3Abutton%3Ahas-text%28%22Make%20editable%22%29%3Bwait%3A1200%3Bclick%3A.dr-input%20.dr-advanced%20%3E%20summary%3Bpress%3AControlOrMeta%2BA%7Con%3D%5Bdata-rule%3D%22image%3AminWidth%22%5D%3Bpress%3A4%3Bpress%3A8%3Bpress%3A0%3Bpress%3AControlOrMeta%2BA%7Con%3D%5Bdata-rule%3D%22image%3AminHeight%22%5D%3Bpress%3A1%3Bpress%3A1%3Bpress%3A0%3Bclick%3A%5Bdata-rule%3D%22image-format%3Ajpeg%22%5D%3Bclick%3A%5Bdata-rule%3D%22image-format%3Awebp%22%5D%3Bclick%3A%5Bdata-rule%3D%22image-format%3Aavif%22%5D&format=svg&walker=1&dark=1&filename=partners-template-rules)

Partnern släpper filen i Lolly, granskar frågan om tillit, fyller i indata och laddar ner de format du tillät ([Använd det färdiga verktyget](/info/create-a-tool.html#use-the-finished-tool)). Lolly håller logotypen inom rutan du ritade. Lolly läser inte partnerns regel för friyta, så logotypen får bara det utrymme du lämnar runt rutan.

### Ge dina varumärkesfärdigheter till en agent

Färdigheter vägleder människor och agenter. Lolly kontrollerar organisationens regler.

- Öppna rummet **Skills** (`#/start?area=skills`) i Lolly Design System Setup, välj en färdighet och tryck på **Download skill (.zip)**. Mappens kataloglänkar pekar på din Lolly, och dess `lolly.json` registrerar var kopian kom ifrån. **Copy as one file** lägger samma text i urklipp för ett chattfönster.
- I en terminal skriver `lolly system skill <name> --into=<dir>` samma mapp ([I en mapp för ett lokalt agentverktyg](/info/brand-skills.html#in-a-folder-for-a-local-agent-tool)).
- Din egen dator listar färdigheter märkta `internal` såväl som `public`, så välj vilka du ska skicka ([Offentliga och interna färdigheter](/info/brand-skills.html#public-and-internal-skills)).
- För ett designsystem utan egna färdigheter skriver Lolly en grundversion utifrån dess tokens och organisationens regler, och rummet listar grundversionen.
- En kopia uppdateras inte automatiskt. Skicka mappen igen när du publicerar en ny version av en färdighet.

<!--i:eti-download-->
## Arbeta med ett varumärke du fått

För partnern som tar emot en designsystemfil. När huvudvarumärket driver ett partnerprogram på sin egen Lolly Work loggar du i stället in där: din startsida öppnas på ditt företagskort och mallarna som publicerats för dig ([Vad partner ser](/info/manage/run-a-partner-programme.html#what-partners-see)).

1. **Öppna filen.** Släpp filen på Lolly eller tryck på **Open**; **Add from…** i Lolly Design System Setup tar också emot filen. Förhandsvisningen listar vad filen innehåller innan något skrivs. En designsystemfil lägger till ett separat designsystem under huvudvarumärkets namn och gör det aktivt. Ditt eget designsystem finns kvar på enheten. En fil som i stället ansluter appen till huvudvarumärkets egen Lolly listar först effekterna på hela din enhet; [Använd Lolly i din organisation](/info/organisation.html) beskriver den typen av fil.
2. **Utforska varumärket.** I Lolly Design System Setup visar **Board** vad designsystemet innehåller, **Logos** har dess märken och **Rules** listar organisationens regler som Lolly kontrollerar. **Skills** visar grundversionen som Lolly skriver utifrån tokens och regler; huvudvarumärkets egna färdigheter kommer som separata filer, om de skickar dem.
3. **Växla mellan varumärken.** **Settings → Preferences → Design systems** byter designsystem för hela enheten, och **Settings → Design system** har en rad omslag att växla mellan. Gör klart ett varumärkes material innan du byter.
4. **Placera ditt eget märke.** Ladda upp din logotyp till **Assets**, där den finns tillgänglig i alla designsystem, eller lägg till den som ett **eget märke** i huvudvarumärkets designsystem (rummet **Logos**, **Custom marks**), där den följer med i designsystemets fil. Ett designsystem som visar ett lås är skrivskyddat, så använd Assets där. [Placera en partners märke](#place-a-partner-s-mark) har kontrollerna.
5. **Kontrollera innan du exporterar.** I Lolly Design listar exportpanelens kort **Before you export** kontrollresultat utifrån huvudvarumärkets regler, lager för lager ([Innan du exporterar](/info/design.html#before-you-export)). Kortet **Design system** visar det designsystem som filen registrerar.
6. **Skicka tillbaka arbetet.** Skicka den exporterade filen eller den redigerbara designen som en `.lolly` ([Dela ditt arbete](/info/using.html#sharing-your-work)). En design öppnas i det designsystem som är aktivt, så huvudvarumärket öppnar din design med sitt eget designsystem aktivt.

::: note En designsystemfil uppdateras inte
En designsystemfil är en kopia av varumärket på exportdagen. Inget uppdaterar kopian.
:::

När huvudvarumärket skickar en nyare fil öppnar du den på samma sätt. Kontrollera sedan vilket designsystem som är aktivt i **Settings → Preferences → Design systems** och ta bort den äldre kopian där när du inte längre behöver den.

![Design systems i Settings: Lolly Demo är aktivt, Lolly Starter har en Use-knapp som byter för hela enheten, och Open or import a file tar emot en designsystemfil](/t/url-shot?url=%2F%23%2Fsettings%3Ffocus%3Ddesign-systems-section&width=1440&height=1200&dpi=192&waitMs=2400&cropSelector=%23design-systems-section&format=svg&walker=1&dark=1&filename=partners-design-systems)

<!--i:eti-image-->
## Placera en partners märke

| Sätt | Steg | Passar bäst för |
| --- | --- | --- |
| En bild i Assets | Släpp filen på uppladdningsområdet i **Assets** och välj den sedan i ett verktygs bildfält, eller i Lolly Design med **Image** från verktygsfältets meny för att lägga till | Enstaka arbeten. En uppladdning tillhör enheten, så den finns tillgänglig oavsett vilket designsystem som är aktivt |
| Ett eget märke | Rummet **Logos**, **Custom marks**: skriv ett namn på märket, sedan **Choose file…** | En partner du ofta arbetar med. Märket tillhör designsystemet och följer med i dess fil |
| En färdig logotypkombination | Skapa kombinationen av båda märkena i ditt ritverktyg och lägg sedan till den som ett eget märke | En logotypkombination med ”med” eller ”i samarbete med” som används om och om igen |

::: check Kontrollera märket innan du exporterar
- **Rätt fil.** Använd filen som partnern tillhandahöll, en SVG om det finns en. En logotyp som kopierats från en webbsida eller en presentationsbild blir oskarp i tryck.
- **Rätt version för bakgrunden.** Använd en negativ eller enfärgad version på en mörk eller rörig bakgrund när partnerns riktlinjer erbjuder en.
- **Proportioner.** Ställ in bildrutans **Image fit** på **Contain (fit inside)** så sträcks märket aldrig ut.
- **Friyta och storlek.** Lämna det utrymme runt märket som partnerns riktlinjer kräver och håll märket över deras minsta storlek. Lolly mäter ingetdera.
- **Vilket varumärke som är ledande.** Anpassa de två märkenas storlek efter båda varumärkenas riktlinjer för vilket som är ledande.
- **Rättigheter.** Lolly visar den licens som registrerats för en katalogtillgång. En fil du laddar upp själv har ingen registrerad licens, och dess uppgifter visar *Licence not recorded*, så spara partnerns tillstånd att använda märket bland dina egna handlingar ([Kreativa rättigheter och erkännanden](/info/creative-rights.html)).
:::

![Before you export på ett kort med gemensam varumärkesprofilering: designsystemet är Lolly Demo, partnerns logotyp anges som en bild utanför designsystemets tillgångar, och de fyra organisationsreglerna har inget att anmärka på](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Fboxes%3D%255B%257B%2522id%2522%253A%2522board%2522%252C%2522name%2522%253A%2522Build%2520day%2520card%2522%252C%2522kind%2522%253A%2522frame%2522%252C%2522x%2522%253A0%252C%2522y%2522%253A0%252C%2522w%2522%253A1600%252C%2522h%2522%253A900%252C%2522shape%2522%253A%2522rect%2522%252C%2522bg%2522%253A%2522%257Bcolor.brand.sugar%257D%2522%252C%2522clipChildren%2522%253Atrue%257D%252C%257B%2522id%2522%253A%2522dot-large%2522%252C%2522name%2522%253A%2522Large%2520circle%2522%252C%2522kind%2522%253A%2522box%2522%252C%2522x%2522%253A1040%252C%2522y%2522%253A70%252C%2522w%2522%253A480%252C%2522h%2522%253A480%252C%2522shape%2522%253A%2522circle%2522%252C%2522bg%2522%253A%2522%257Bcolor.brand.pandanus%257D%2522%252C%2522frame%2522%253A%2522board%2522%257D%252C%257B%2522id%2522%253A%2522dot-small%2522%252C%2522name%2522%253A%2522Small%2520circle%2522%252C%2522kind%2522%253A%2522box%2522%252C%2522x%2522%253A1330%252C%2522y%2522%253A380%252C%2522w%2522%253A240%252C%2522h%2522%253A240%252C%2522shape%2522%253A%2522circle%2522%252C%2522bg%2522%253A%2522%257Bcolor.brand.green-apple%257D%2522%252C%2522frame%2522%253A%2522board%2522%257D%252C%257B%2522id%2522%253A%2522band%2522%252C%2522name%2522%253A%2522Partner%2520band%2522%252C%2522kind%2522%253A%2522box%2522%252C%2522x%2522%253A0%252C%2522y%2522%253A680%252C%2522w%2522%253A1600%252C%2522h%2522%253A220%252C%2522shape%2522%253A%2522rect%2522%252C%2522bg%2522%253A%2522%257Bcolor.brand.avocado%257D%2522%252C%2522frame%2522%253A%2522board%2522%257D%252C%257B%2522id%2522%253A%2522lolly%2522%252C%2522name%2522%253A%2522Lolly%2520logo%2522%252C%2522kind%2522%253A%2522image%2522%252C%2522x%2522%253A120%252C%2522y%2522%253A96%252C%2522w%2522%253A260%252C%2522h%2522%253A90%252C%2522image%2522%253A%2522lolly%2Flogo%2Fhorizontal%2522%252C%2522fit%2522%253A%2522contain%2522%252C%2522imgpos%2522%253A%2522left%2522%252C%2522frame%2522%253A%2522board%2522%257D%252C%257B%2522id%2522%253A%2522headline%2522%252C%2522name%2522%253A%2522Headline%2522%252C%2522kind%2522%253A%2522text%2522%252C%2522x%2522%253A120%252C%2522y%2522%253A260%252C%2522w%2522%253A880%252C%2522h%2522%253A180%252C%2522text%2522%253A%2522Build%2520day%25202026%2522%252C%2522fg%2522%253A%2522%257Bcolor.brand.liquorice%257D%2522%252C%2522fontSize%2522%253A120%252C%2522weight%2522%253A%2522700%2522%252C%2522font%2522%253A%2522display%2522%252C%2522align%2522%253A%2522left%2522%252C%2522valign%2522%253A%2522middle%2522%252C%2522frame%2522%253A%2522board%2522%257D%252C%257B%2522id%2522%253A%2522sub%2522%252C%2522name%2522%253A%2522Subtitle%2522%252C%2522kind%2522%253A%2522text%2522%252C%2522x%2522%253A120%252C%2522y%2522%253A450%252C%2522w%2522%253A880%252C%2522h%2522%253A90%252C%2522text%2522%253A%2522Twelve%2520hours%2520of%2520making%252C%2520with%2520friends%2522%252C%2522fg%2522%253A%2522%257Bcolor.brand.basalt%257D%2522%252C%2522fontSize%2522%253A48%252C%2522align%2522%253A%2522left%2522%252C%2522valign%2522%253A%2522middle%2522%252C%2522frame%2522%253A%2522board%2522%257D%252C%257B%2522id%2522%253A%2522with%2522%252C%2522name%2522%253A%2522In%2520partnership%2520with%2522%252C%2522kind%2522%253A%2522text%2522%252C%2522x%2522%253A120%252C%2522y%2522%253A750%252C%2522w%2522%253A400%252C%2522h%2522%253A80%252C%2522text%2522%253A%2522In%2520partnership%2520with%2522%252C%2522fg%2522%253A%2522%257Bcolor.brand.basalt%257D%2522%252C%2522fontSize%2522%253A34%252C%2522align%2522%253A%2522left%2522%252C%2522valign%2522%253A%2522middle%2522%252C%2522frame%2522%253A%2522board%2522%257D%252C%257B%2522id%2522%253A%2522partner%2522%252C%2522name%2522%253A%2522Partner%2520logo%2522%252C%2522kind%2522%253A%2522image%2522%252C%2522x%2522%253A500%252C%2522y%2522%253A735%252C%2522w%2522%253A480%252C%2522h%2522%253A110%252C%2522image%2522%253A%2522%2Ftools%2Flogo-wall%2Fassets%2Fpartner-name.svg%2522%252C%2522fit%2522%253A%2522contain%2522%252C%2522frame%2522%253A%2522board%2522%257D%255D%26w%3D1600%26h%3D900&width=1440&height=1000&dpi=192&waitMs=3000&drive=click%3A.edge-dock-tab%3Ahas-text%28%22Export%22%29%3Bwait%3A2500%3Bclick%3A%5Bdata-action%3D%22preflight-open%22%5D%3Bwait%3A1200&cropSelector=.preflight-modal&format=svg&walker=1&dark=1&filename=partners-before-export)

En exports [designsystempost](/info/exporting.html#the-design-system-record) anger huvudvarumärkets designsystem och färgvariant. Den registrerar inte partnerns varumärke, utom i ett partnerprogram i Lolly Work, där den också anger partnerföretaget och programmet som materialet skapades för.

### Ge varje varumärkes färdigheter till en agent

När en agent gör arbetet ger du agenten båda varumärkenas färdigheter som de är och talar om vilket varumärke som är ledande. Varje varumärkes färdigheter behåller sina egna namn och id:n. Lolly slår inte ihop två varumärkens färdigheter och avgör inte vilket varumärke som har företräde.

<!--i:eti-grid-->
## Logotypväggar för sponsorer och evenemang

Verktyget [Lolly Logo Wall](/#/tool/logo-wall) ordnar logotyper i ett jämnt rutnät för en sponsortavla, en partnerbild i en presentation eller en pressvägg. Vid ett evenemang är värden oftast huvudvarumärket: väggen skapas i värdens designsystem, och varje sponsors logotyp placeras på väggen som grafik.

![En sponsorvägg i tre nivåer på mörkgrönt, med varje logotyp ritad i vitt: två guldpartner, tre silverpartner och fem communitypartner, varje nivå under sin egen rubrik och varje lägre nivå ett steg mindre](/t/url-shot?url=%2F%23%2Ftool%2Flogo-wall%3Flogos%3D%255B%257B%2522logo%2522%253A%2522%252Ftools%252Flogo-wall%252Fassets%252Fyour-logo.svg%2522%252C%2522tier%2522%253A%2522Gold%2520partners%2522%257D%252C%257B%2522logo%2522%253A%2522%252Ftools%252Flogo-wall%252Fassets%252Flogo-here.svg%2522%252C%2522tier%2522%253A%2522Gold%2520partners%2522%257D%252C%257B%2522logo%2522%253A%2522%252Ftools%252Flogo-wall%252Fassets%252Fcompany.svg%2522%252C%2522tier%2522%253A%2522Silver%2520partners%2522%257D%252C%257B%2522logo%2522%253A%2522%252Ftools%252Flogo-wall%252Fassets%252Fsponsor.svg%2522%252C%2522tier%2522%253A%2522Silver%2520partners%2522%257D%252C%257B%2522logo%2522%253A%2522%252Ftools%252Flogo-wall%252Fassets%252Fbrand-name.svg%2522%252C%2522tier%2522%253A%2522Silver%2520partners%2522%257D%252C%257B%2522logo%2522%253A%2522%252Ftools%252Flogo-wall%252Fassets%252Fsample-co.svg%2522%252C%2522tier%2522%253A%2522Community%2520partners%2522%257D%252C%257B%2522logo%2522%253A%2522%252Ftools%252Flogo-wall%252Fassets%252Fexample.svg%2522%252C%2522tier%2522%253A%2522Community%2520partners%2522%257D%252C%257B%2522logo%2522%253A%2522%252Ftools%252Flogo-wall%252Fassets%252Florem-ipsum.svg%2522%252C%2522tier%2522%253A%2522Community%2520partners%2522%257D%252C%257B%2522logo%2522%253A%2522%252Ftools%252Flogo-wall%252Fassets%252Fplaceholder.svg%2522%252C%2522tier%2522%253A%2522Community%2520partners%2522%257D%252C%257B%2522logo%2522%253A%2522%252Ftools%252Flogo-wall%252Fassets%252Fpartner-name.svg%2522%252C%2522tier%2522%253A%2522Community%2520partners%2522%257D%255D%26columns%3D3%26gap%3D64%26padding%3D96%26background%3D033633%26headingColor%3Dffffff%26vectorizeAll%3Dtrue%26inkColor%3Dffffff%26transparentBg%3Dfalse&width=1440&height=900&dpi=192&waitMs=4000&cropSelector=%23tool-canvas&format=svg&walker=1&filename=partners-logo-wall&try=1)

1. Öppna Lolly Logo Wall och släpp logotyperna på **Logos**. Varje logotyp får en egen uppsättning kontroller.
2. Ge varje logotyp en **Tier**, till exempel ”Guldpartner”. Varje nivå får egna rader, i den ordning nivåerna först förekommer, under en egen rubrik; **Tier headings** stänger av rubrikerna. Med **Tier sizes** på **Step down** får varje lägre nivå plats med en logotyp till per rad, så högre nivåer ser större ut. **Presence** och **Size %** justerar en logotyp inom dess nivå.
3. Låt **Balance sizes** vara på. Lolly Logo Wall anpassar varje logotyps storlek efter dess optiska tyngd, så en tung logotyp krymper och en lätt växer och varje nivå ser jämn ut.
4. **Trim margins** beskär varje logotyp till själva grafiken. Stäng av alternativet när en logotypfil redan innehåller den friyta som ägaren kräver.
5. **Remove white backgrounds** tar bort den vita ruta som en logotyp kopierad från en presentationsbild ofta ligger i.
6. Ställ in **Columns**, avstånd och utfyllnad under **Layout**. **Background** börjar med ditt designsystems ytfärg.
7. För en enfärgad vägg slår du på **Render all as vector** och väljer **Ink colour**, eller ställer in en logotyps **Filter** på **Greyscale**. Använd en enfärgad version bara när varje sponsors riktlinjer tillåter det.
8. För en pressvägg väljer du **Grid**, **Brick** eller **Checker** under **Step & repeat** och ställer in antalet **Rows**.

Exportera väggen som PNG, SVG, PDF eller en CMYK-PDF för tryck. Ställ in en annan storlek och form i exportpanelen, till exempel en stående story på 1080 x 1920 eller en A4-sida, så gör ytan om väggens layout för att fylla formen, med färre eller fler logotyper på varje rad. Exporten stämmer med ytan. För att placera väggen på en affisch väljer du **Image** i verktygsfältets meny för att lägga till i Lolly Design, ritar en ram och väljer Lolly Logo Wall på väljarens flik **Tools** ([Verktyg i en design](/info/design.html#tools-inside-a-design)). För bildtexter mellan logotyperna rymmer en **Dynamic layout** inställd på **grid** i Lolly Design en bildruta per logotyp ([Layout i Lolly Design](/info/design-layout.html#dynamic-layouts)).

I en terminal bygger `lolly run logo-wall logos/*.png --output=wall.svg` väggen från en mapp med bilder, och en CSV med kolumnerna `logo` och `tier` bygger en vägg med nivåer. SVG och PNG behöver ingen webbläsare ([En sponsorvägg med nivåer](/info/cli-rendering.html#a-sponsor-wall-with-tiers)).

När en sponsor publicerar en [varumärkessida](/info/brand-page.html) hämtar `lolly run logo-wall --logos-from=<address or folder>` deras aktuella logotyp för ytan och skriver ut vad sidan säger om användning. Upprepa flaggan för varje sponsor.

Lolly Logo Wall känner inte till någon sponsors regler. Tiers och Presence ställer in storlekar i förhållande till varandra, inte en sponsors minsta storlek, och inget kontrollerar friytan mellan intilliggande logotyper. Kontrollera den färdiga väggen mot varje sponsors riktlinjer i den storlek den ska tryckas eller visas.

<!--i:eti-hammer-->
## Vad Lolly inte gör ännu

- Ett arbete ritas i ett designsystem. Partnerns färger, typografi och regler utgör inget designsystem i arbetet, och partnerns märke är en bild.
- Utanför ett partnerprogram i Lolly Work lagras eller kontrolleras inga partnerregler i appen: friyta, minsta storlek och tillåtna utföranden som enfärgat eller negativt.
- Ett partnerpaket, ett litet paket med en partners logotyper, färger och regler för användning i ett annat varumärkes arbete, når appen bara genom ett partnerprogram i Lolly Work. I övriga fall körs paketets kontroll från en terminal: `lolly check --kit=<file>` mäter partnermärkena i ett Lolly Design-dokument ([Kontrollera återskapandet](/info/cli-decks.html#check-the-recreation)).
- Lolly genererar ingen logotypkombination av två märken för en uppställning med ”med”, ”i samarbete med” eller ”av”. Lägg till en färdig kombination som ett eget märke.
- Ett designsystem är aktivt för hela enheten, så två varumärken kan inte vara öppna sida vid sida.
- En designsystemfil som exporteras från appen innehåller inga varumärkesfärdigheter, så skicka dem som egna filer.
- En logotyp hämtad från en varumärkessida är en bild på sin rad, och raden minns inte sidan. Inget visar vem som publicerade en sida, så kontrollera adressen själv.
- Den driftade webbappen kan inte hämta ett annat varumärkes sida, eftersom dess Content Security Policy bara tillåter namngivna värdar. Hämta logotypen i en terminal eller spara filen och lägg till den i **Assets**.

<!--i:eti-map-pin-->
## Gå vidare

- **[Varumärkesarkitekturer](/info/brand-architectures.html)**: gemensam varumärkesprofilering, white label och de andra uppläggen, med vad du ska göra i Lolly för vart och ett.
- **[Driv ett partnerprogram](/info/manage/run-a-partner-programme.html)**: vad partner får på din Lolly Work och hur du skapar och driver ett program.
- **[Dela en design med regler](/info/create-a-tool.html)**: återanvändbara verktyg med en fast layout och de indata du väljer.
- **[Varumärkesfärdigheter](/info/brand-skills.html)**: hur färdigheter skrivs, läses och lämnas till en agent.
- **[Lolly Design System Setup](/info/brand-studio.html)**: logotyper, egna märken och att flytta ett designsystem mellan enheter.
- **[Varumärkessidor](/info/brand-page.html)**: publicera ditt varumärke på en adress och hämta en partners logotyp från deras.
- **[Kreativa rättigheter och erkännanden](/info/creative-rights.html)**: vad Lolly registrerar om verken det ritar.
