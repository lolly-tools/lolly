# FAQ

Vanliga frågor som visas i dragspelsmenyn på landningssidan `/info`.

**Så här underhåller du sidan:** varje `##`-rubrik nedan är en fråga; allt under den
(fram till nästa `##`) är svaret. Svaren använder samma lättviktiga markdown som
resten av webbplatsen - separera stycken med en tom rad. Lägg till, ta bort eller
flytta om frågor här och kör `npm run build:info` (eller `npm run dev:web`) igen.
Allt ovanför den första `##` (den här titeln och de här noteringarna) ignoreras av bygget.

## Vad händer när jag väljer att delta på sidan /profile?

När du börjar använda Lolly är allt du skriver var som helst helt privat, tills du medvetet vill få ut informationen via media eller en delningslänk (om du är online).

När du har valt att delta förseglas de profiluppgifter du väljer in i det du gör, och anger dig som källa. Inget tas med utan att du väljer det.

Lolly producerar stora mängder innehåll. Vi tillämpar strikt dataminimering för att förebygga risk.

## Är Lolly "vibekodad"?

Lolly utvecklades med AI-assisterad kodning, AI-assisterad upptäckt och, på många ställen, AI-assisterat innehåll, med en blandning av modeller och leverantörer, inklusive sådana från ledande företag inom publik molnteknik.

Vid tidpunkten för denna text innehåller Lolly noll kända säkerhetssårbarheter i sin leveranskedja och åtar sig snabba säkerhetsåtgärder när CVE:er dyker upp.

En människa skapade arkitekturen, kurerade koden med avsikt och artdirigerade upplevelsen.

Viktigast av allt vilar Lolly på axlarna av decennier av innovation inom öppen källkod från verkliga experter runt om i världen.

Det finns en deterministisk byggspärr i Lollys kodbas för att hålla kod och dokumentation begriplig för den vanliga läsaren och "avskräpa" upplevelsen. Det kan göra det svårt med proprietär syntetisk kartläggning av ursprung. Det är oavsiktligt.

**Information om generativ AI:**

- **LLM-skriven kod:** Opus 4.8, Gemini 3.1, Qwen3-Coder-Next (listan kan komma att utökas)
- **LLM-upptäckt:** Gemini 3.1, Fable
- **Dokumentation:** Sonnet 5
- **Öppen källkod-bibliotek:** respektive upphovspersoner, angivna i SBOM, kommentarer och filhuvuden

Den här listan omfattar inte modeller som paketerats (vendored) i Lolly.

**Mänskligt bidrag:**

- **Arkitektur:** Andy Fitzsimon
- **Artdirection:** Andy Fitzsimon
- **Mänskligt skriven kod:** Andy Fitzsimon
- **Idégenerering, granskning och feedback:** Ravan Naidoo, Matthias Eckermann, Kelly Andrews, Ryan Kleeman, Peter Chamalian, Penpot-communityn (listan är inte uttömmande)

## Vad är funktionsflaggorna?

Funktionsflaggor slår på och av delar av Lolly. Vanligtvis är det en administratör som styr dem - i Lolly är det du som styr.

![Varje funktionsflagga är en strömbrytare du äger, placerad i din egen profil i stället för i en administratörs konsol](/t/url-shot?url=%2F%23%2Fprofile%3Ffocus%3Dfeature-flags&width=1440&height=1800&dpi=192&waitMs=2000&format=svg&cropSelector=%23feature-flags-section&walker=1&dark=1&filename=pd-feature-flags)

## Hur får jag tag på mobil- eller skrivbordsapparna?

Vem som helst kan distribuera sina egna appar, och verktygen och konfigurationen i dem bör variera kraftigt beroende på vilken målgrupp de är avsedda för. Så det finns ingen enda app om du inte gjort den själv eller fått den av någon som är relevant för dig.

## Varför namnet "Lolly Tools"?

**Lolly** för att frihet är sött, och för att en lolly är en godisbit i Australien, Nya Zeeland och Storbritannien.

**Tools** för att ett verktyg ligger stilla tills du plockar upp det. Det kör inte när du inte använder det, och det tittar inte på dig när du gör det.

## Vilka hinder kan jag vänta mig när jag börjar använda Lolly?

Lolly passar in där du redan genererar filer - CLI:t är samma motor som appen, så
en pipeline som körs klockan två på natten inte kan glida ifrån det en person
förhandsgranskar i en webbläsare. Motståndet mot införande är sällan tekniskt; det är
organisatoriskt. Räkna med det här:

**Någon måste bygga upp en kurerad varumärkeskatalog.** Lolly är en plattform, inte ett
färdigt paket med dina mallar. För en *styrd utrullning* definierar någon den gemensamma
tillgångskatalogen (logotyper, paletter, typsnitt som permanenta ID:n) och skriver manifestet +
mallen för varje utdatatyp. Enskilda användare behöver dock inte vänta på det - i den
öppna appen kan vem som helst läsa in sina egna filer i katalogen och bygga verktyg i
Design från dag ett.

**Det krävs ingen git för att bidra.** Designers gör sina egna verktyg och mallar
i appen och delar dem sedan med kollegor, eller skickar in dem till den som äger
driftsättningen för att tas med som standard.

**Det är medvetet smalt - presentera det så.** Lolly är inte till för skräddarsytt eller
profilerande innehåll. Det *är* ditt personliga DAM - fyllt och förstärkt av ditt
designsystem, dina verktyg och din katalog - och det *har* en öppen yta (Design), men
även där följer färger, typografi och tillgångar de aktiva designglobalerna, så fri
placering håller sig inom systemet. Mätt mot Figma eller Canva ser det begränsat ut.
Bedömt som det det är - operationaliserad, återkommande tillgångsgenerering i stor
skala - finns det ingen konkurrent. Fel inramning är det vanligaste bakslaget.

**Förändringsledning på produktionssidan.** Befintliga processer fungerar i dag, även om
resultatet inte följer varumärket. Att rikta om dem mot motorn innebär omtestning och
omlärning, och "vi kan ju redan göra filer" blir ursäkten för att inte migrera. Börja med att
konvertera en enda väl synlig produktion med hög kvalitet och visa före/efter sida vid sida.

Lolly lyfter allting.


## Vad skiljer hjälpverktyg från verktyg?

**Enkelt svar →** Hjälpverktyg behöver inte alltid rendera och kan därför få en annan UX. 

**Verkligt svar →** Anledningen till att hjälpverktyg kan ligga inuti Lolly Tools är att lägga till ytterligare ett "bekvämlighetslager" av försvar som gör dataexfiltrering mindre lockande. 

Varför? För att det är känt att människor varje dag tar **konfidentiellt innehåll de redan har** och lämnar det till en
slumpmässig webbplats för att utföra en enda liten mekanisk operation:

- "**Komprimera den här PDF:en**" → laddar upp ett avtal / en lönespecifikation / ett styrelsematerial till okända aktörer.
- "**konvertera HEIC till JPG**" → laddar upp privata foton (med GPS-EXIF) till en annonsfinansierad värd
- "**beskär / ändra storlek på den här bilden**" → laddar upp en produktskärmdump eller en osläppt tillgång
- "**formatera den här JSON-filen**" / "avkoda den här JWT:n" → klistrar in API-svar, tokens och hemligheter i en formaterare
- "**slå ihop de här PDF:erna**" → laddar upp **två dokument som aldrig borde dela server**

De här webbplatserna och deras enorma svans av kloner är **inte tillförlitliga som standard**, med
okänd lagringstid, okända jurisdiktioner, okända underleverantörer och en affärsmodell byggd på
annonser och affiliate som har alla skäl att behålla det du ger dem. Operationen är
trivial; **innehållet är priset.** 

Vi vinner kampen om styrningen med utmärkt bekvämlighet och service. 

![Vyn Hjälpverktyg samlar de mekaniska jobb som folk annars lämnar till en slumpmässig webbplats, men här körs allt inuti Lolly i stället](/t/url-shot?url=%2F%23%2Fu&width=1440&height=900&dpi=192&waitMs=1600&css=.welcome-dialog%2C.personalize-nudge%7Bdisplay%3Anone!important%7D&tolerance=0.03&format=svg&walker=1&dark=1&filename=use-utilities&try=1)

## Kan Lolly redigera och rendera mina filer från Figma, Penpot, Illustrator eller InDesign?

Ja. Öppna **Design** och klicka på **Importera en design**: den tar emot en Figma-egen **.fig** (Save local copy), en Penpot-export **.penpot**, en Illustrator-fil **.ai** eller **.pdf**, en InDesign-fil **.idml** (File → Export → InDesign Markup) eller **vilken SVG som helst** (den breda dörren - nästan alla designprogram exporterar den). Det krävs inget konto, inget plugin och ingen licens till ett designprogram.

![Designs öppna kanvas - Importera en design finns i verktygsfältets Lolly-meny](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Fz%3D17VVRa9swEP41ekyQLrbjPOyhVeeOrSsbG3lXbLkYZCnISmn264tO9irFhdJCoZQIpBNn9N2dvu_k3cOX1opeEuCTpeNkG0BDy8ljZe28pyDA74UlUC4WOyt0sxgOthW1JJAD9wv1y6rFQWCDMB6BAK-NdqLTBLg2thcqeAnk68vaKGOXg-yFdl29dPLBef8VAZ6V_qjUTloCvO-aRvlcc0QdhB58iCWDMVNnD1iSUIOcAvASY2qsEUeex-XSOEJ6koaT_6Q1iY89IY4mw4TCmmJYc9BNZKPQ00ywxxJS-BlqcnL2KfJF3xhZf3WdwwsMd8xZ4VEgEF6EGornaH-ByW_iHkVAj-aAtpcO7Y1R6kggX1Uz7ext1wt7PNEOk7BZ7UbtYCpKtj4NZ_YE-Doh_hOwHnff-1K_M83xlPmyiJhn8AbmL5C61nZSN8g00OlFoK2xkyjCRofOBro3g5N2OdPE2PqxIGjL1iCCIPA1SPSQpQ_B6qyIVyiCsp8s-_Gn2P76fpHfVlt6WV3_Lv5e5_6mul7cSVRFhiWhOIrsaaVTMbKZaUWNbQ-VMncGN__b_fwn-CAKeAQ&width=1360&height=850&dpi=192&waitMs=3000&format=png&localize=1&dark=1&filename=design)

Lagren kommer in som redigerbara rutor på den öppna ytan: text går att skriva om, former förblir former, bilder hamnar i ditt eget bildbibliotek och typografi och färger följer varumärkets globala värden. Spara den, så blir layouten en återanvändbar mall med egen URL som vem som helst med Lolly kan fylla på nytt - och du kan blanda in levande verktyg (en QR-kod, ett diagram) som renderas om vid inläsning. Därifrån renderas den som allt annat i Lolly - SVG, PDF, PNG och resten, reproducerbart från sin URL. Se [Importera en design](/info/design-import.html).

## Kan jag dela mitt arbete som en fil i stället för en länk?

Ja. När en länk inte kan bära allt (dina egna foton, lång text) talar delningsdialogen om exakt vad som skulle försvinna och erbjuder i stället en **.lolly**-fil: en fil som håller designen, bilderna den använder och, om du vill, själva verktyget. Du bestämmer hur mycket som följer med - ditt namn och dina uppgifter tas bara med om din profil tillåter det, licensierad konst hålls tillbaka om du inte själv inkluderar den, och den som öppnar en fil med ett verktyg i får frågan om hen litar på det innan det får köras. Se [Dela ditt arbete](/info/using.html#sharing-your-work).

## Kan två personer arbeta på samma design utan internet?

Ja. Den ena delar en inbjudan (en länk, en QR-kod eller en kort kod), den andra tackar ja, och båda enheterna håller samma session live - närvaro, fokusringar och allt. Det fungerar på vilket delat nätverk som helst, till och med en mobil surfzon i en källare, eftersom det inte finns någon server i mitten. Se [Arbeta tillsammans](/info/collaborate.html).

## Vart tog de SUSE-märkta verktygen vägen?

De ligger redan i ett separat, privat repo. En publik klon hämtar inte SUSE:s varumärkespaket alls, så ett publikt bygge kör den neutrala profilen `lolly-start` - de varumärkesoberoende community-verktygen plus ett tomt varumärke som du fyller med ditt eget. SUSE driver en egen instans för att skydda sina varumärken.

## Varför är det gratis? Vad är haken?

**Vi byggde Lolly åt oss själva.** SUSE behövde tusentals varumärkesriktiga filer, var och en med sitt namn förseglat inuti, gjorda utan att lämna något till externa tjänster. Så vi byggde ett verktyg som gör allt på enheten och släppte det som öppen källkod, som allt annat vi gör. Vi fortsätter underhålla det för att vi använder det varje dag. **Det finns inga förpliktelser:** allt här fungerar med eller utan oss.

Den gränsen är dragen i licensen, inte i ett löfte: allt som körs lokalt är gratis, för alltid. En version som har släppts är licensierad så att den inte kan tas tillbaka, och det finns inget bidragsgivaravtal som skulle kunna omlicensiera någons arbete. Se [positionering](/info/positioning.html) för hela beskrivningen.

## Hur mycket håller SUSE privat? (alltså: när dras mattan undan?)

Motorn, skalen, scheman och de varumärkesoberoende verktygen är öppen källkod; SUSE:s varumärken och märkta verktyg är den del som förblir privat, och den är redan utbruten. Den offentliga instansen på [lolly.tools](https://lolly.tools) körs med det neutrala varumärket.

Gränsen är strukturell snarare än utlovad. Varje släppt version är öppen källkod och kan inte tas tillbaka, det finns inget bidragsgivaravtal som skulle kunna omlicensiera någons arbete, och det enda som hålls tillbaka är varumärket. När ett annat företag stängde sina källor för enterprise-Linux 2023 var SUSE med och grundade [OpenELA](https://openela.org) för att hålla den koden öppen - samma hållning som det här projektet ärver.

Full öppenhet: SUSE *bygger* ut interna verktyg för att integrera Lolly i sina IT-system - det handlar om SUSE:s interna uppsättning, inte om publik kontra privat utveckling. Målet är också att Lolly ska byggas via [Open Build Service](https://openbuildservice.org/), med säkra leveranskedjeartefakter levererade av [SUSE Application Collection](https://apps.rancher.io/applications).

## Vilken smak är det på Lolly-logotypen?

Vissa säger lime, andra säger mint och ibland äpple, Lolly står för sötman, du gör smaken!
