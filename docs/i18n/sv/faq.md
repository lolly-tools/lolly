# Frågor och svar

Vanliga frågor, renderade som dragspelet på `/info/start/faq.html`.

**Så här underhåller du sidan:** varje `##`-rubrik nedan är en fråga; allt under den
(fram till nästa `##`) är svaret. Svaren använder samma lättviktiga markdown som
resten av webbplatsen - separera stycken med en tom rad. Lägg till, ta bort eller
flytta om frågor här och kör `pnpm run build:info` (eller `pnpm run dev:web`) igen.
Allt ovanför den första `##` (den här titeln och de här noteringarna) ignoreras av bygget.

Ordningen är en nybörjares: haken först, sedan dina filer, sedan att skaffa
och köra Lolly, sedan organisationer, sedan hur det byggdes. Varje frågas ankare
byggs från den engelska frågan på samma position, så en översättning behåller
den engelska ordningen.

## Varför är det gratis? Vad är haken?

**Vi byggde Lolly åt oss själva.** SUSE behövde tusentals filer i varumärkets stil, gjorda utan att lämna något till externa tjänster. Så vi byggde ett verktyg som gör allt på enheten, och släppte det som öppen källkod, som allt annat vi gör. Vi fortsätter underhålla det eftersom vi använder det varje dag. **Det finns ingen förpliktelse:** allt här fungerar med eller utan oss.

Den gränsen dras i licensen, inte i ett löfte: allt som körs lokalt är gratis, för alltid. En släppt version licensieras så att den inte kan tas tillbaka, och det finns inget bidragsgivaravtal som skulle kunna ge någons arbete en ny licens.

## Hur mycket håller SUSE privat? (alltså: när dras mattan undan?)

Motorn, skalen, scheman och de varumärkesoberoende verktygen har öppen källkod. SUSE:s varumärken och varumärkesbundna verktyg är den del som förblir privat, och de är redan utskilda. Den publika instansen på [lolly.tools](https://lolly.tools) kör [Lolly Demo](/info/lolly-demo.html), Lollys eget designsystem.

Inget här vilar på ett löfte: varje släppt version förblir öppen källkod, och det enda som hålls tillbaka är varumärket. När ett annat företag stängde sina företagskällor för Linux 2023 var SUSE med och grundade [OpenELA](https://openela.org) för att hålla den koden öppen, samma hållning som det här projektet ärver.

Full transparens: SUSE bygger *faktiskt* internt verktygsstöd för att koppla Lolly till sina egna IT-system. Det är SUSE:s interna uppsättning, inte en uppdelning mellan offentlig och privat utveckling. Lolly siktar också på att byggas genom [Open Build Service](https://openbuildservice.org/), med säkra artefakter för försörjningskedjan levererade av [SUSE Application Collection](https://apps.rancher.io/applications).

## Varför namnet "Lolly Tools"?

**Lolly** för att frihet är sött, och för att en lolly är en godisbit i Australien, Nya Zeeland och Storbritannien.

**Tools** för att ett verktyg ligger stilla tills du plockar upp det. Det kör inte när du inte använder det, och det tittar inte på dig när du gör det.

## Varför är allt grönt?

lolly.tools öppnas i [Lolly Demo](/info/lolly-demo.html), Lollys eget exempel på designsystem, och dess ledfärg är grön. Det är ett exempel, inte en regel. Byt till **Lolly Starter**, ett tomt designsystem, eller till ditt eget i [Settings → Design systems](/#/settings?focus=design-systems-section).

## Kan jag använda mitt eget varumärke?

Ja. **Design System Setup** (`#/start`) bygger ett designsystem från en färg, en designtokenfil eller en färdig design, och varje verktyg ritar sedan med ditt designsystem. [Kom igång](/info/quickstart.html#put-your-brand-in) går igenom de tre vägarna.

Ett designsystem som din organisation eller ditt bygge tillhandahåller är hanterat: det visar ett lås och förblir skrivskyddat, och du kan göra en redigerbar kopia för att ändra.

## Var är det jag gjorde igår?

Om du tryckte på **Save as** eller **Save** finns det i **Projects**, på startskärmen, i webbläsaren eller appen du sparade från. Om du bara tryckte på **Download** ligger filen där din webbläsare eller ditt system sparar nedladdningar, och oftast finns en kopia i **Assets**. Verktyg som [sparar medan du arbetar](/info/find-your-work.html#which-tools-save-as-you-work) behåller också osparat arbete i **Projects**. [Hitta och återställ ditt arbete](/info/find-your-work.html) beskriver varje fall.

## Jag stängde fliken. Är mitt arbete borta?

Sparat arbete finns fortfarande i **Projekt**. Osparat arbete är borta, förutom i de verktyg som sparar medan du arbetar, som behåller det i **Projekt** också. Nästa gång, tryck på **Spara som** innan du lämnar. Se [Om du stängde fliken eller lämnade verktyget](/info/find-your-work.html#if-you-closed-the-tab-or-left-the-tool).

## Kan jag dela mitt arbete som en fil i stället för en länk?

Ja. När en länk inte kan bära allt, som dina egna foton eller lång text, säger dialogen Share vad som skulle saknas och erbjuder en **.lolly**-fil i stället: en fil som håller designen, bilderna den använder och, om du vill, själva verktyget.

Du bestämmer hur mycket som följer med. Ditt namn och dina uppgifter tas bara med om din profil har valt det, och licensierad konst hålls tillbaka om du inte väljer att ta med konsten. Den som öppnar en fil som bär ett verktyg tillfrågas om hen litar på verktyget innan det kan köras. Se [Dela ditt arbete](/info/using.html#sharing-your-work).

## Vad gör mina profiluppgifter?

Dina uppgifter i **Settings** fyller i på förhand de verktyg som ber om dem, som ett namn på en namnbricka. De stannar på den här enheten. Om du också slår på valet läggs de uppgifter du väljer in i det du gör, med dig som källa. Inget tas med om du inte väljer att ta med dina uppgifter.

Delning och Sync skickar bara innehållet du väljer. På en organisations Lolly Work-instans går delade sessioner och styrt arbete också till den servern. Se [Integritet](/info/privacy.html).

## Hur får jag tag på mobil- eller skrivbordsapparna?

Ladda ner dem från [Install Lolly](/info/install.html). Sidan listar varje bygge för macOS, Windows, Linux och Android, och visar hur du kontrollerar filen du laddade ner. iPhone och iPad får **Lolly Tools** från App Store; [avsnittet om iPhone och iPad](/info/install.html#iphone-and-ipad) har länken.

Vem som helst kan också bygga och dela ut sin egen kopia av appen, med de verktyg och inställningar målgruppen behöver. [Build Guide](/info/build-guide.html) visar hur.

## Lolly säger att det kräver WebGPU. Vad kan jag göra?

Webbappen ritar med WebGPU, en grafikfunktion i aktuella webbläsare, och den kontrollerar det innan ett verktyg öppnas. Prova dessa i ordning:

1. Uppdatera webbläsaren till den senaste versionen.
2. Slå på grafik- eller hårdvaruacceleration i webbläsarens inställningar och starta sedan om webbläsaren.
3. Prova en webbläsare som är testad: [Supported environments](/info/supported-environments.html) listar dem.
4. På en Mac, iPhone eller iPad, [installera appen](/info/install.html) i stället.

## Kan Lolly redigera och rendera mina filer från Figma, Penpot, Illustrator eller InDesign?

Ja. Öppna **Design** och klicka på **Import a design**: den tar en inbyggd Figma-**.fig** (Save local copy), en Penpot-**.penpot**-export, en Illustrator-**.ai** eller **.pdf**, en InDesign-**.idml** (File → Export → InDesign Markup) eller **valfri SVG**. Du behöver inget konto, inget plugin och ingen licens för något designprogram.

![Designs öppna arbetsyta - Importera en design ligger i verktygslistens Lolly-meny](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Fz%3D17ZTfS8MwEMf_mryO5NZ288GHrdqJv1CUvWdtOgppMtJMNv96yaV1iRNEQRBZoblwab53l0-uq915bXgrCOSDpf3LzgANnQ4eI0rrPJn7Gh9cd0sE8lIryxtFIFfatFx6L4F0Mi-11GbUiZYr25QjK3bW-S8I5MnUbRXKCkMgb5uqki6JFFU7rjoXYsSgT8GaLebKZSeGAPkUYypMHp80DeugYYR4J_U7X4XRkY8dFHuTYEJ-jDWM3qoqsEHo4Y20-xJi-SPVaOfRUuAL1hiZXNrG4gH6M85Z5lTAk8x8DdlnPL8gecVfBIEU6F5v0bbCor3VUu4JpOPCKTCWsPI9rBS107d6QyCfRET_Ac6wX36X6UpX-49Ip1mAlMEPkM6QX20aoSpECLTmpadcazPQ9hPlWxboRndWmFEIG1s4Yp3E3Ts-0f4GbcruWHLzlC0frmfpfbGk82LxmD0vUndSTcvXAoknWBKCz5LDSIdiRHV0D2Tfq1BIvdY42Zim5WZ_-n3_mRvwBg&width=1360&height=850&dpi=192&waitMs=3000&format=svg&walker=1&chrome=1&localize=1&dark=1&filename=design)

Lager kommer in som redigerbara rutor: text förblir omskrivbar, former förblir former och bilder går med i ditt eget bibliotek. Spara den, så kan **Share with rules** göra layouten till ett verktyg som vem som helst med Lolly kan fylla i på nytt. Se [Importera en design](/info/design-import.html).

## Kan två personer arbeta på samma design utan internet?

Ja. En person delar en inbjudan, som en länk, en QR-kod eller en kort kod, och den andra accepterar. Båda enheterna håller sedan samma session live, med närvaro och fokusringar. Det fungerar på vilket delat nätverk som helst, även en telefons hotspot i en källare, eftersom det inte finns någon server emellan. Se [Arbeta tillsammans](/info/collaborate.html). För kollegor på olika nätverk tillhandahåller en organisations Lolly Work-instans autentiserade arbetscollabs.

## Vad är funktionsflaggorna?

Feature flags slår på eller av delar av Lolly. Vid fristående användning väljer du dina personliga inställningar. En organisation som använder Lolly Work kan sätta standardvärden eller dölja valda reglage enligt sin policy, och hanterade kontroller är märkta. Se [Använd Lolly i din organisation](/info/organisation.html).

![Personliga feature flags i den fristående appen; organisationspolicy kan styra valda reglage](/t/url-shot?url=%2F%23%2Fprofile%3Ffocus%3Dfeature-flags&width=1440&height=1800&dpi=192&waitMs=2000&format=svg&cropSelector=%23feature-flags-section&walker=1&dark=1&filename=pd-feature-flags)

## Vad skiljer hjälpverktyg från verktyg?

Ett hjälpverktyg gör ett snabbt jobb på en fil du redan har, som att komprimera en PDF, konvertera ett foto eller ta bort dolda data, och många av dem körs på din enhet utan att något laddas upp. De finns så att jobben som folk brukar lämna till en slumpmässig webbplats stannar inom Lolly. Att komprimera ett kontrakt, konvertera semesterbilder med platsen kvar eller klistra in en token i en onlineformaterare ska inte betyda att man ger filen till en webbplats med okänd lagring, jurisdiktion och affärsmodell. [Verktyg för filer](/info/utilities.html) listar dem, och [The trade we never agreed to](/info/status-quo.html) berättar historien bakom dem.

![Vyn Utilities: Strip Hidden Data, Compress PDF, Convert Image och de andra jobben på enheten, alla på ett ställe](/t/url-shot?url=%2F%23%2Fu&width=1440&height=900&dpi=192&waitMs=1600&css=.welcome-dialog%2C.personalize-nudge%7Bdisplay%3Anone!important%7D&tolerance=0.03&format=svg&walker=1&dark=1&filename=use-utilities&try=1)

## Kan vår organisation använda SSO, delade projekt och godkännanden?

Ja, med **Lolly Work**, organisationsservern i samma projekt med öppen källkod. Den körs separat och lägger till enkel inloggning via din identitetsleverantör, SCIM-provisionering, gruppbehörigheter, delade projekt och tillgångar, levande arbetscollabs, godkännanden och granskningsposter. Den vardagliga appen fungerar fortfarande på egen hand.

[Använd Lolly i din organisation](/info/organisation.html) beskriver att logga in och hitta delat arbete, och [Deployment](/info/deployment.html#organisation-services-with-lolly-work) beskriver hur det sätts upp. Delat innehåll och organisationsposter följer den instansens policyer för integritet och lagring.

## Vilka hinder kan jag vänta mig när jag börjar använda Lolly?

Mest förändring på producentsidan snarare än teknik. Ett team som vill ha en styrd uppsättning verktyg behöver någon som skapar dess designsystem och de första mallarna, även om vem som helst kan börja göra egna verktyg i Design den första dagen, utan git. Och befintliga processer fortsätter fungera även när deras utdata bryter mot varumärket, så att omvandla en synlig utdata väl, före och efter sida vid sida, driver ärendet snabbare än en plan.

[Adoption & Governance](/info/adoption-governance.html) beskriver introduktion per roll, hur man mäter en pilot och hur en styrningsprocess kan se ut.

## Är Lolly "vibekodad"?

Lolly utvecklades med AI-assisterad kodning, AI-assisterad utforskning och, på många ställen, AI-assisterat innehåll, med en blandning av modeller och leverantörer, bland annat från frontföretag inom publika moln. En människa skapade arkitekturen, kuraterade koden med avsikt och art-directade upplevelsen.

En hög eller kritisk säkerhetsrekommendation i Lollys beroenden blockerar CI. En rekommendation som ännu inte kan åtgärdas hålls bara tillbaka som ett godkänt undantag med en skriftlig motivering. [SECURITY.md](https://github.com/lolly-tools/lolly/blob/main/SECURITY.md#dependency-audit-exceptions) listar varje undantag som hålls i dag, och [versionsnoteringarna](https://github.com/lolly-tools/lolly/releases) listar de som varje version bär. SECURITY.md säger också hur man rapporterar en sårbarhet.

Kontroller i bygget avvisar också formuleringar som låter maskingjorda i kodkommentarer, appen och de här dokumenten, för att hålla texten enkel för varje läsare. En bieffekt är att en detektor kan få svårare att avgöra vilken text en modell skrev. Vi hade inte som mål att åstadkomma det.

Viktigast av allt: Lolly står på axlarna av decennier av öppen källkod av experter runt om i världen.

**Information om generativ AI:**

- **Kod skriven av LLM:** Opus 4.8, Gemini 3.1, Qwen3-Coder-Next, Codex Sol (listan kan växa)
- **LLM-utforskning:** Gemini 3.1, Fable, Codex Astra
- **Dokumentation:** Sonnet 5
- **Bibliotek med öppen källkod:** Deras respektive upphovspersoner, uttryckta i SBOM, kommentarer och filhuvuden

Den här listan omfattar inte modeller som paketerats (vendored) i Lolly.

**Mänskliga bidrag:**
- **Idéarbete, granskning och återkoppling:** Ravan Naidoo, Matthias Eckermann, Kelly Andrews, Ryan Kleeman, Peter Chamalian, Penpot Community, Tim Hildred (listan är inte uttömmande)
- **Arkitektur, art direction och slop janitor:** Andy Fitzsimon

## Vart tog de SUSE-märkta verktygen vägen?

De finns i ett separat, privat arkiv. En publik klon hämtar inte SUSE:s varumärkespaket alls, så ett bygge från den använder den neutrala profilen `lolly-start` om du inte väljer en annan: de varumärkesoberoende gemenskapsverktygen plus ett tomt varumärke som du fyller i med ditt eget. [lolly.tools](https://lolly.tools) byggs med profilen `lolly-demo` och öppnas i [Lolly Demo](/info/lolly-demo.html), Lollys eget designsystem. SUSE driver sin egen instans för att skydda sina varumärken.

## Vilken smak är det på Lolly-logotypen?

Vissa säger lime, andra säger mint och ibland äpple, Lolly står för sötman, du gör smaken!
