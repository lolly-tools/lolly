# Frågor & svar

Vanliga frågor, renderade som de hopfällbara avsnitten på `/info/start/faq.html`.

**Så underhåller du sidan:** varje `##`-rubrik nedan är en fråga. Allt under rubriken,
fram till nästa `##`, är svaret. Svaren använder webbplatsens enkla markdown:
skilj stycken åt med en tom rad. Lägg till, ta bort eller ändra ordningen på frågor här och
kör `pnpm run build:info` (eller `pnpm run dev:web`) igen.
Bygget ignorerar allt ovanför den första `##` (den här titeln och de här anteckningarna).

Ordningen är för en nybörjare: först haken, sedan dina filer, sedan att skaffa
och köra Lolly, sedan organisationer och till sist hur det skapades. Varje frågas ankare
byggs från den engelska frågan på samma position, så en översättning behåller den
engelska ordningen.

## Varför är det gratis? Vad är haken?

**Vi byggde Lolly för oss själva.** SUSE behövde tusentals filer som följde varumärket, skapade utan att lämna något till externa tjänster. Så vi byggde ett verktyg som gör allt på enheten och släppte det som öppen källkod, precis som allt annat vi gör. Vi fortsätter att underhålla det eftersom vi använder det varje dag. **Du förbinder dig inte till något:** allt här fungerar med eller utan oss.

Den gränsen dras i licensen, inte i ett löfte: allt som körs lokalt är gratis, för alltid. En släppt version är licensierad så att den inte kan tas tillbaka. Inget bidragsgivaravtal skulle kunna ändra licensen för någons arbete.

## Hur mycket håller SUSE privat? (alltså, när drar ni undan mattan?)

Motorn, skalen, schemana och de varumärkesoberoende verktygen är öppen källkod. SUSE:s varumärken och varumärkesanpassade verktyg förblir privata och är redan separerade. Den publika instansen på [lolly.tools](https://lolly.tools) kör [Lolly Demo](/info/lolly-demo.html), Lollys eget designsystem.

Inget här bygger på ett löfte: varje släppt version förblir öppen källkod. När ett annat företag stängde källkoden till sin företagsversion av Linux 2023 var SUSE med och grundade [OpenELA](https://openela.org) för att hålla den koden öppen. Det här projektet för vidare den hållningen.

SUSE *bygger* interna verktyg för att ansluta Lolly till sina egna IT-system. Det är SUSE:s interna upplägg, ingen uppdelning mellan offentlig och privat utveckling. Lolly siktar också på att byggas genom [Open Build Service](https://openbuildservice.org/), med säkra artefakter i leveranskedjan levererade av [SUSE Application Collection](https://apps.rancher.io/applications).

## Varför namnet ”Lolly Tools”?

**Lolly** för att frihet är sött och för att en lolly är en sötsak i Australien, Nya Zeeland och Storbritannien.

**Tools** för att ett verktyg ligger still tills du tar upp det. Det körs inte när du inte använder det och det övervakar dig inte när du gör det.

## Varför är allt grönt?

lolly.tools öppnas med [Lolly Demo](/info/lolly-demo.html), Lollys eget exempeldesignsystem, vars huvudfärg är grön. Byt till **Lolly Starter**, ett tomt designsystem, eller till ditt eget under [Settings → Design systems](/#/settings?focus=design-systems-section).

## Kan jag använda mitt eget varumärke?

Ja. **Lolly Design System Setup** (`#/start`) bygger ett designsystem från en färg, en fil med designtokens eller en färdig design. Varje verktyg ritar sedan med ditt designsystem. [Kom igång](/info/quickstart.html#put-your-brand-in) går igenom de tre vägarna.

Ett designsystem som din organisation eller din byggversion tillhandahåller är hanterat. Det visar ett lås och förblir skrivskyddat. Gör en redigerbar kopia för att ändra det.

## Var är det jag gjorde igår?

Om du tryckte på **Save as** eller **Save** finns ditt arbete i **Projects** på startskärmen, i webbläsaren eller appen du sparade från. Om du bara tryckte på **Download** finns filen bland webbläsarens eller systemets nedladdningar och en kopia finns oftast i **Assets**. Verktyg som [sparar medan du arbetar](/info/find-your-work.html#which-tools-save-as-you-work) behåller också osparat arbete i **Projects**. [Hitta och återställ ditt arbete](/info/find-your-work.html) beskriver alla fall.

## Jag stängde fliken. Är mitt arbete borta?

Sparat arbete finns fortfarande i **Projects**. Osparat arbete är borta, utom i verktygen som sparar medan du arbetar, som också behåller det i **Projects**. Tryck på **Save as** innan du lämnar nästa gång. Se [Om du stängde fliken eller lämnade verktyget](/info/find-your-work.html#if-you-closed-the-tab-or-left-the-tool).

## Kan jag dela mitt arbete som en fil i stället för en länk?

Ja. När en länk inte kan innehålla allt, som dina egna foton eller lång text, anger Share-dialogen vad som skulle saknas och erbjuder en **.lolly**-fil. Den enda filen innehåller designen, bilderna den använder och, om du väljer det, verktyget.

Du bestämmer hur mycket som följer med. Ditt namn och dina uppgifter tas bara med om du har valt det i din profil. Licensierad grafik utelämnas om du inte väljer att ta med den. Den som öppnar en fil som innehåller ett verktyg får frågan om de litar på verktyget innan det kan köras. Se [Dela ditt arbete](/info/using.html#sharing-your-work).

## Vad används mina profiluppgifter till?

Dina uppgifter i **Settings** används för att i förväg fylla i de verktyg som frågar efter dem, som ett namn på en namnbricka. De stannar på den här enheten. Inget läggs till i det du skapar om du inte aktivt väljer det. Då förseglas uppgifterna du väljer i resultatet och anger dig som källa.

Delning och Sync skickar bara det innehåll du väljer. På en organisations Lolly Work-instans skickas även delade sessioner och arbete som styrs av organisationens regler till den servern. Se [Integritet](/info/privacy.html).

## Hur skaffar jag apparna för mobil eller dator?

Ladda ner dem från [Installera Lolly](/info/install.html). Sidan listar alla byggversioner för macOS, Windows, Linux och Android och visar hur du kontrollerar filen du laddade ner. iPhone och iPad får **Lolly Tools** från App Store. [Avsnittet om iPhone och iPad](/info/install.html#iphone-and-ipad) har länken.

Vem som helst kan också bygga och dela ut sin egen kopia av appen, med de verktyg och inställningar som deras målgrupp behöver. [Byggguiden](/info/build-guide.html) visar hur.

## Lolly säger att WebGPU krävs. Vad kan jag göra?

Webbappen ritar med WebGPU, en grafikfunktion i moderna webbläsare, och kontrollerar att WebGPU finns innan ett verktyg öppnas. Prova följande i ordning:

1. Uppdatera webbläsaren till den senaste versionen.
2. Slå på grafik- eller maskinvaruacceleration i webbläsarens inställningar och starta sedan om webbläsaren.
3. Prova en testad webbläsare: [Miljöer som stöds](/info/supported-environments.html) listar dem.
4. På en Mac, iPhone eller iPad kan du [installera appen](/info/install.html) i stället.

## Kan Lolly redigera och rendera mina Figma-, Penpot-, Illustrator- eller InDesign-filer?

Ja. Öppna verktyget **Design** och klicka på **Import a design**: det tar emot en Figma-fil i originalformatet **.fig** (Save local copy), en Penpot-export i **.penpot**, en Illustrator-fil i **.ai** eller **.pdf**, en InDesign-fil i **.idml** eller **.indd**, ett Affinity-dokument, en Photoshop-fil i **.psd**, en PowerPoint-fil i **.pptx**, en CAD-fil i **.dxf** eller **valfri SVG** ([alla format det läser](/info/design-import.html#what-comes-in-from-each-app)). Du behöver inget konto, inget insticksprogram och ingen licens för en designapp.

![Lolly Designs öppna yta - Import a design finns i verktygsfältets Lolly-meny](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Fz%3D17ZTfS8MwEMf_mryO5NZ288GHrdqJv1CUvWdtOgppMtJMNv96yaV1iRNEQRBZoblwab53l0-uq915bXgrCOSDpf3LzgANnQ4eI0rrPJn7Gh9cd0sE8lIryxtFIFfatFx6L4F0Mi-11GbUiZYr25QjK3bW-S8I5MnUbRXKCkMgb5uqki6JFFU7rjoXYsSgT8GaLebKZSeGAPkUYypMHp80DeugYYR4J_U7X4XRkY8dFHuTYEJ-jDWM3qoqsEHo4Y20-xJi-SPVaOfRUuAL1hiZXNrG4gH6M85Z5lTAk8x8DdlnPL8gecVfBIEU6F5v0bbCor3VUu4JpOPCKTCWsPI9rBS107d6QyCfRET_Ac6wX36X6UpX-49Ip1mAlMEPkM6QX20aoSpECLTmpadcazPQ9hPlWxboRndWmFEIG1s4Yp3E3Ts-0f4GbcruWHLzlC0frmfpfbGk82LxmD0vUndSTcvXAoknWBKCz5LDSIdiRHV0D2Tfq1BIvdY42Zim5WZ_-n3_mRvwBg&width=1360&height=850&dpi=192&waitMs=3000&format=svg&walker=1&chrome=1&localize=1&dark=1&filename=design)

Lager kommer in som redigerbara rutor. Text går fortfarande att skriva om, former förblir former och bilder läggs till i ditt bibliotek. När layouten har sparats kan **Share with rules** göra den till ett verktyg som alla med Lolly kan fylla i på nytt. Se [Importera en design](/info/design-import.html).

## Kan två personer arbeta med samma design utan internet?

Ja. En person delar en inbjudan (en länk, en QR-kod eller en kort kod) och den andra accepterar. Båda enheterna har sedan samma session i realtid, med närvaro och fokusringar. Det fungerar på alla gemensamma nätverk, även en telefons internetdelning, eftersom ingen server finns emellan. Se [Arbeta tillsammans](/info/collaborate.html). För kollegor på olika nätverk erbjuder organisationens Lolly Work-instans autentiserade arbetssamarbeten.

## Vad är funktionsflaggorna?

Funktionsflaggor slår på eller av delar av Lolly. Vid fristående användning väljer du dina personliga inställningar. En organisation som använder Lolly Work kan ange standardvärden eller dölja utvalda omkopplare enligt sin policy, och hanterade kontroller är märkta. Se [Använd Lolly i din organisation](/info/organisation.html).

![Personliga funktionsflaggor i den fristående appen; organisationens policy kan styra utvalda omkopplare](/t/url-shot?url=%2F%23%2Fprofile%3Ffocus%3Dfeature-flags&width=1440&height=1800&dpi=192&waitMs=2000&format=svg&cropSelector=%23feature-flags-section&walker=1&dark=1&filename=pd-feature-flags)

## Vad skiljer hjälpverktyg från verktyg?

Ett hjälpverktyg gör ett snabbt jobb på en fil du redan har, som att komprimera en PDF, konvertera ett foto eller ta bort dolda data. Många körs på din enhet utan att något laddas upp. Hjälpverktygen håller de jobb som folk vanligtvis lämnar till en godtycklig webbplats inom Lolly. Att komprimera ett avtal, konvertera semesterfoton som fortfarande innehåller platsdata eller klistra in en token i ett formateringsverktyg på nätet ska inte innebära att ge filen till en webbplats med okänd lagringstid, jurisdiktion och affärsmodell. [Lolly Utilities](/info/utilities.html) listar dem och [Utbytet vi aldrig gick med på](/info/status-quo.html) berättar bakgrunden till dem.

![Utilities-vyn: Lolly Strip Hidden Data, Compress PDF, Convert Image och de andra jobben som körs på enheten, allt på ett ställe](/t/url-shot?url=%2F%23%2Fu&width=1440&height=900&dpi=192&waitMs=1600&css=.welcome-dialog%2C.personalize-nudge%7Bdisplay%3Anone!important%7D&tolerance=0.03&format=svg&walker=1&dark=1&filename=use-utilities&try=1)

## Kan vår organisation använda SSO, delade projekt och godkännanden?

Ja, med **Lolly Work**, organisationsservern i samma projekt med öppen källkod. Den körs separat och lägger till enkel inloggning via din identitetsleverantör, SCIM-provisionering, gruppbehörigheter, delade projekt och tillgångar, arbetssamarbeten i realtid, godkännanden och granskningsposter. Den vanliga appen fungerar fortfarande på egen hand.

[Använd Lolly i din organisation](/info/organisation.html) beskriver hur du loggar in och hittar delat arbete. [Driftsättning](/info/deployment.html#organisation-services-with-lolly-work) beskriver hur du konfigurerar Lolly Work. Delat innehåll och organisationsposter följer instansens policyer för integritet och lagring.

## Vilka hinder kan jag möta när jag inför Lolly?

Främst förändringar i hur ett team producerar sitt arbete, inte i tekniken. Ett team som vill ha en uppsättning verktyg som följer organisationens regler behöver någon som skapar designsystemet och de första mallarna. Alla kan fortfarande skapa egna verktyg i Lolly Design från dag ett, utan att behöva git. Befintliga processer fortsätter fungera även när deras resultat avviker från varumärket. Att göra om ett synligt resultat väl, med före och efter sida vid sida, övertygar snabbare än en plan.

[Införande & styrning](/info/adoption-governance.html) beskriver introduktion per roll, hur du mäter ett pilotprojekt och hur en styrningsprocess kan se ut.

## Blev Lolly ”vibekodat”?

Lolly utvecklades med AI-stödd kodning, AI-stödd utforskning och på många ställen AI-stött innehåll, med en blandning av modeller och leverantörer, även från företag bakom ledande AI-modeller i publika moln. En människa skapade arkitekturen, valde medvetet ut koden och styrde upplevelsens visuella utformning.

En säkerhetsvarning med hög eller kritisk allvarlighetsgrad i Lollys beroenden blockerar CI. En varning som ännu inte kan åtgärdas får bara undantas efter godkännande och med en skriftlig motivering. [SECURITY.md](https://github.com/lolly-tools/lolly/blob/main/SECURITY.md#dependency-audit-exceptions) listar alla aktuella undantag och [versionsinformationen](https://github.com/lolly-tools/lolly/releases) listar dem som varje version innehåller. SECURITY.md beskriver också hur du rapporterar en sårbarhet.

Kontroller i bygget avvisar också formuleringar som låter maskingjorda i kodkommentarerna, appen och den här dokumentationen, för att hålla texten enkel för alla läsare. En bieffekt är att en detektor kan få svårare att avgöra vilken text en modell skrev. Det var inte vår avsikt.

Viktigast av allt bygger Lolly vidare på decennier av arbete med öppen källkod av experter runt om i världen.

**Redovisning av generativ AI:**

- **LLM-skriven kod:** Opus 4.8, Gemini 3.1, Qwen3-Coder-Next, Codex Sol (listan kan utökas)
- **LLM-baserad utforskning:** Gemini 3.1, Fable, Codex Astra
- **Dokumentation:** Sonnet 5
- **Bibliotek med öppen källkod:** Deras respektive upphovspersoner, angivna i SBOM, kommentarer och filhuvuden

Den här listan innehåller inte modeller som medföljer Lolly.

**Mänskliga bidrag:**
- **Idéer, granskning och återkoppling:** Ravan Naidoo, Matthias Eckermann, Kelly Andrews, Ryan Kleeman, Peter Chamalian, Penpot Community, Tim Hildred (listan är inte uttömmande)
- **Arkitektur, konstnärlig ledning & skräpstädning:** Andy Fitzsimon

## Vart tog verktygen med SUSE:s varumärke vägen?

De finns i ett separat, privat kodförråd. En offentlig klon hämtar inte SUSE:s varumärkespaket, så ett bygge från den använder den neutrala profilen `lolly-start` om du inte väljer en annan. Den profilen har gemenskapens varumärkesoberoende verktyg och ett tomt varumärke som du fyller med ditt eget. [lolly.tools](https://lolly.tools) byggs med profilen `lolly-demo` och öppnas i [Lolly Demo](/info/lolly-demo.html), Lollys eget designsystem. SUSE driver sin egen instans för att skydda sina varumärken.

## Vilken smak har Lolly-logotypen?

Vissa säger lime, andra säger mint och ibland äpple. Lolly står för sötman och du skapar smaken.

## Vad menar Lolly med innehållssuveränitet?

Kontroll över hur ditt innehåll skapas, styrs, lagras och flyttas mellan de system du väljer. Lolly stöder lokal produktion, redigerbart arbete och portabla verktyg. Lolly Work lägger till gemensamma tjänster som organisationen kontrollerar. Källornas licenser, tillgängliga beroenden och arbetsflödets dataflöden spelar fortfarande roll. [Vad är innehållssuveränitet?](/info/content-sovereignty.html) förklarar varje kontrollmöjlighet och dess gränser.

## Kan vi behålla vårt befintliga DAM?

Ja. Ett DAM som stöds kan förbli den auktoritativa källan medan Lolly Work kopplar utvalda tillgångar till Lollys verktyg. Åtkomst till källan, tillåtna ändringar, användningsrättigheter och godkännande av det färdiga resultatet är separata beslut. [Använd Lolly med ditt befintliga DAM](/info/use-with-dam.html) förklarar upplägget och [SUSE:s erfarenhet av Brandfolder](/info/suse-brandfolder.html) dokumenterar framgångsrik användning under införandet.
