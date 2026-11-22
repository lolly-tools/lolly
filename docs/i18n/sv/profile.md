# Profiler

Ange ditt namn, dina kontaktuppgifter och ditt porträttfoto en gång, så fylls de i av varje verktyg som är byggt för att använda dem, till exempel en mejlsignatur, en namnbricka eller ett talarkort. Den posten är din **profil** och finns på din enhet.

Din profil innehåller också sparade sessioner, uppladdade bilder och din lokala aktivitetsräkning. Hantera den under **Settings → Preferences**. Verktygen läser bara de fält de är byggda för att fylla i i förväg. Fristående användning behöver inget konto. Valfri Sync, delning och organisationstjänster har var och en sina egna dataflöden.

<!--i:eti-user-check-->
## Vad en profil innehåller

| Del | Vad det är |
|---|---|
| **Name** | För- och efternamn. |
| **Contact** | Mejladress och telefonnummer. |
| **Location** | Stad och land. |
| **Headshot** | Ett valfritt foto som beskärs till en kvadrat och sparas som en lokal bild, för verktyg som mejlsignaturer, citatkort och organisationsscheman. |
| **Use my details to create** | En omkopplare som du aktivt slår på och som då visar **Using my details**. Den avgör om dina uppgifter följer med i upphovsangivelsen i exporterade filer och vid Lolly Batch-körningar; se [Så använder verktygen din profil](#how-tools-use-your-profile). |
| **Preferences** | Ditt tema, din färgvariant i varje designsystem, dina tillgänglighetsinställningar och vilka delar av appen du slagit på i **Feature flags**. |
| **Your work** | Sparade sessioner med deras miniatyrer, ordnade i [Lolly Projects](/info/find-your-work.html), dina uppladdade bilder och din lokala aktivitetsstatistik. |

Inget av det är obligatoriskt och en tom profil fungerar.

![Settings på fliken Preferences: inställningslisten och Your details med omkopplaren Use my details to create och fälten för namn, kontakt och plats](/t/url-shot?url=%2F%23%2Fsettings%3Ffocus%3Ddetails-section&width=1440&height=900&dpi=192&waitMs=1600&format=svg&walker=1&localize=1&dark=1&filename=profile-details)

[Lolly Settings](/info/dashboard.html) beskriver resten av Preferences, från utseende och emoji till lagring och offlinenedladdningar.

<!--i:eti-users-->
## Du, ett team eller en roll

I Lolly är en profil den du är när du skapar något: dig själv, ett team eller en roll. Lolly hanterar alla tre på samma sätt.

::: cols
## Som dig själv

Standardvalet: ditt namn, din mejladress och ditt porträttfoto. Din signatur, namnbricka och konferensgrafik fylls i utifrån dem.

## Som ett team

Teamets gemensamma namn, en gruppinkorg som `events@…`, en avdelning och teamets märke. En person ställer in profilen och exporterar en fil. Alla andra läser in samma profil, så teamets filer innehåller samma uppgifter. En gemensam kiosk eller en bärbar dator för demonstrationer kan använda en teamprofil.

## I en roll

En evenemangsansvarig behöver evenemangets inkorg och undervarumärke på namnbrickor och skyltar tre dagar om året och sedan sin vanliga identitet igen. Behåll rollen som en sparad profilfil, läs in filen inför evenemanget och lägg den åt sidan efteråt.
:::

![Kontrollen för porträttfoto, tom tills du laddar upp ett foto som sedan stannar på den här enheten](/t/url-shot?url=%2F%23%2Fsettings%3Ffocus%3Ddetails-section&width=1440&height=900&dpi=192&waitMs=1600&format=svg&cropSelector=.profile-side&walker=1&dark=1&filename=pd-profile-headshot&css=.profile-details-main%7Bdisplay%3Anone%7D)

::: details Profiler i en organisation som använder Lolly Work
När du loggar in på en [organisations Lolly](/info/organisation.html) kan Lolly Work tillhandahålla verifierade profilfält från dess identitetsleverantör och låsa fält eller inställningar enligt organisationens policy. Ett hanterat fält markeras i appen.

Den inloggningen styr också åtkomsten till gemensamma projekt och tillgångar. En teamprofilfil är en lokal fil. Den ger inte medlemskap i organisationen och ersätter inte ett arbetskonto. **Use my details to create** styr upphovsuppgifterna i dina exporter, inte organisationens inloggning eller granskningsposter. Se [Integritet](/info/privacy.html#organisation-services-with-lolly-work).
:::

<!--i:eti-copy-->
## Behåll flera, använd en

En installation har en aktiv profil åt gången och ingen profilväxlare i appen. Varje profil är en portabel fil, samma säkerhetskopia som flyttar ditt arbete till en ny enhet. För att byta sammanhang:

::: timeline
- <!--i:download--> **Export my data** under **Settings → Storage → Move to another device** sparar den aktuella profilen som en enda `.zip`.
- <!--i:trash--> **Clear all my data** tömmer den här installationen.
- <!--i:upload--> **Import data…** läser in profilfilen för sammanhanget du går in i.
:::

::: note Import utan att rensa först slår ihop data
Importerade sessioner och bilder läggs till. Där båda kopiorna finns behålls den som sparades senast. Mappar, favoriter och mallar läggs till bredvid dina. Dina egna uppgifter behålls, utom tomma fält som får filens värden. En sammanslagning passar för att hämta ett teams sessioner till din miljö, men inte för att hålla roller helt åtskilda.
:::

För två sammanhang samtidigt använder du en separat webbläsarprofil, ett separat användarkonto eller en separat installerad kopia av webbappen. Var och en har sin egen Lolly-profil.

![De två knapparna som flyttar en hel installation: Export my data skriver en zip-fil, Import data läser in den igen](/t/url-shot?url=%2F%23%2Fsettings%3Ffocus%3Dstorage-section&width=1440&height=1800&dpi=192&waitMs=2400&css=.store-move%3Ediv%3Anth-of-type%282%29%2C.store-move%3Ep%3Alast-of-type%7Bdisplay%3Anone%7D&waitSelector=%5Bdata-store-group%3Dmove%5D&drive=click%3A%5Bdata-store-group%3Dmove%5D%3Esummary&walker=1&format=svg&cropSelector=%5Bdata-store-group%3Dmove%5D&dark=1&filename=pd-transfer-controls)

::: note Behåll en fil per sammanhang
Namnge varje fil efter vad den är, till exempel `LollyTools-events-2026.zip` och `LollyTools-me.zip`. Filen är profilen.
:::

[Flytta ditt arbete till en annan enhet](/info/find-your-work.html#move-your-work-to-another-device) beskriver vad filen innehåller, vad som stannar kvar och de andra sätten att flytta, inklusive Sync.

<!--i:eti-pen-->
## Så använder verktygen din profil

**Förifyllning.** En verktygsupphovsperson markerar att en indata ska hämtas från din profil (`bindToProfile: "firstname"`, `"email"`, `"headshot"` och så vidare). När verktyget öppnas fylls den indatan i från din profil. Du kan ändra värdet för en session utan att ändra profilen, om inte en organisationspolicy låser indatan. Förifyllningen sker lokalt oavsett om **Use my details** är på eller inte.

**Upphovsuppgifter.** När du exporterar kan dina uppgifter följa med som upphovsangivelse i filens metadata (PNG, PDF, SVG med flera). **Use my details to create** styr de här uppgifterna och upphovspersonen vid Lolly Batch-körningar. När omkopplaren är av anger exporten fortfarande att den gjordes med Lolly, men saknar personlig upphovsangivelse och kontaktrad.

Verktygsupphovspersoner: se [`bindToProfile`](/info/tool-inputs.html#bindtoprofile) och [`host.profile`](/info/host-api.html#host-profile).

![Den enda omkopplaren Use my details to create, markerad som ett aktivt val och av tills du slår på den](/t/url-shot?url=%2F%23%2Fsettings%3Ffocus%3Duse-details&width=1440&height=900&dpi=192&waitMs=1600&format=svg&cropSelector=.profile-check&walker=1&dark=1&filename=pd-use-my-details)

<!--i:eti-layers-->
## Profil, designsystem och funktioner

Tre saker finns nära varandra i Settings och är lätta att blanda ihop:

- <!--i:people--> **Profile** - du, ditt team eller rollen du har: namn, kontaktuppgifter, porträttfoto och sparat arbete. Personligt, lagrat på enheten och portabelt som en fil.
- <!--i:palette--> **Design system** - varumärket: färger, typsnitt och inställningar som varje verktyg renderar med. Gemensamt, inte personligt; se [Lolly Design System Setup](/info/brand-studio.html).
- <!--i:sliders--> **Capabilities** - vad appen kan göra: de funktioner och verktyg du har tillgång till.

Ordet har tre andra betydelser i Lolly. En **innehållsprofil** är en bygginställning som väljer vilka verktyg och vilken katalog en driftsättning innehåller; [Ordlistan](/info/glossary.html) definierar termen. Länkparametern `profile` väljer en färgprofil för en export, till exempel ett CMYK-tryckvillkor; se [Reserverade URL-parametrar](/info/url-parameters.html#print). En **verifierad identitet** är det valfria signeringscertifikat som knyter din mejladress till dina signerade exporter. Den är skild från de här uppgifterna, men **Use my details to create** avgör om något av dem bäddas in; se [Content Credentials](/info/content-credentials-identity.html).

![Kortet Verified identity i telefonbredd: väljaren för certifikatets giltighetstid och registreringssteget under den - identitetsprofilen, skild från dina personliga uppgifter](/t/url-shot?url=%2F%23%2Fsettings%3Ffocus%3Didentity-section&width=430&height=1600&dpi=192&waitMs=2400&css=.welcome-dialog%2C.personalize-nudge%7Bdisplay%3Anone%7D&format=svg&walker=1&cropSelector=%23identity-section&dark=1&filename=pv-identity-enrol)

<!--i:eti-lock-->
## Integritet

Din personliga profil lagras lokalt. Dina uppgifter kan följa med i en säkerhetskopia eller Sync-kopia, i innehåll du delar eller exporterar och vid valfri registrering för Content Credentials. På en Lolly Work-instans är inloggning, gemensamt arbete, telemetripolicy och granskningsposter skilda från den här lokala profilen. **Settings → Preferences → Clear all my data** rensar den här enheten; det raderar inte kopior hos din lagringsleverantör eller organisation. Se [Integritetspolicyn](/info/privacy.html).
