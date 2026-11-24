# Använd Lolly i din organisation

Din organisation kan köra sin egen Lolly: samma app, med de verktyg och designsystem den valt. Läs om hur du når den, loggar in och vad som ändras.

När ni planerar organisationens upplägg förklarar [Använd Lolly med ert befintliga DAM](/info/use-with-dam.html) hur ett godkänt bibliotek kan ligga kvar medan användarna skapar innehåll i Lolly. [Innehållssuveränitet](/info/content-sovereignty.html) beskriver den bredare kontrollen över skapande, styrning, lagring och portabilitet.

::: note Vad du behöver från din organisation
Webbadressen till organisationens Lolly, eller en konfigurationsfil i formatet `.lolly` som organisationen har skapat. lolly.tools ansluter inte till någon organisation på egen hand.
:::

<!--i:eti-globe-->
## I en webbläsare

Öppna adressen du fått av din organisation. Om sidan ber dig logga in trycker du på **Sign in** och följer inloggningssidan som öppnas. Därefter fungerar Lolly som vanligt, med organisationens verktyg och designsystem.

Du kan också börja på lolly.tools: öppna vyn **Settings**, tryck på **Open a workspace** på kortet **Lolly instance**, ange adressen och tryck på **Open this instance**. Webbläsaren går till organisationens egen adress, eftersom en webbläsare inte kan läsa in verktyg från en annan Lolly på lolly.tools.

![Kortet Lolly instance i Settings, där du öppnar organisationens arbetsyta eller ändrar var appen hämtar sina verktyg](/t/url-shot?url=%2F%23%2Fsettings%3Ffocus%3Dinstance-section&width=1440&height=1400&dpi=192&waitMs=2000&format=svg&cropSelector=%23instance-section&walker=1&dark=1&filename=org-instance-card)

<!--i:eti-monitor-->
## I dator- eller mobilappen

Appen startar med de medföljande verktygen. För att ansluta öppnar du vyn **Settings** och trycker på **Change** på kortet **Lolly instance**. Panelen frågar **Where should Lolly get its tools?**

1. Välj **Connect to a Lolly instance**.
2. Ange organisationens webbadress och tryck på **Check & connect**.
3. Tryck på **Use this instance**. Nästa skärm, **Import your data (optional)**, för över sparat arbete från en Lolly-säkerhetskopia. Tryck på **Skip** om du inte har någon.
4. Logga in om appen ber om det.

Verktyg från en ansluten instans körs med samma förtroende som appens egna, så anslut bara till en instans du litar på. Din organisation kan i stället skicka en konfigurationsfil i formatet `.lolly` som ansluter appen åt dig.

Om du vill byta senare använder du **Change** igen, eller **Leave** på samma kort.

### Logga in med en kod

I dator- och mobilapparna erbjuder inloggningsskärmen också en kort kod när organisationens Lolly stöder kodinloggning. Tryck på **Open sign-in in browser**, logga in och godkänn koden där. Eller öppna adressen som visas på skärmen på en telefon eller dator där du redan är inloggad och ange koden. Koden gäller i ungefär tio minuter.

<!--i:eti-sliders-->
## Vad som är annorlunda där

- **Vissa kontroller är inställda åt dig.** En kontroll som organisationen styr visar **Managed by** och organisationens namn, eller **Managed by your organisation**. En låst kontroll går inte att ändra, och en meny kanske bara erbjuder en del av sina val. Vissa kontroller är dolda. Organisationens konsol registrerar vilken regel som låste en kontroll och varför. Fråga den som sköter organisationens Lolly.
- **Vissa designsystem är låsta.** Ett designsystem som organisationen tillhandahåller visas med ett lås och är skrivskyddat. Skapa en redigerbar kopia i **Settings → Preferences → Design systems** för att prova ändringar.
- **Bara organisationens verktyg listas.** Ett verktyg som organisationen inte erbjuder visas inte.
- **Delade projekt.** Om organisationen delar projekt med dig visar **Projects** en ruta med **Team projects**. Dessa sessioner finns på organisationens server. Öppna en för att arbeta med den, eller starta en [arbetscollab](/info/collaborate.html#collabs-through-lolly-work-optional) från **Share** när det är tillgängligt.
- **Vissa exporter kan kräva godkännande.** När organisationen kräver godkännande ersätter **Request approval** knappen **Download**, och ett verktyg kan erbjuda färre format.
- **Din startskärm kan öppnas med mallar.** Om organisationen publicerar mallar för dig, till exempel för ett partnerföretag, öppnas startskärmen med dem i stället för hälsningen vid första besöket. Varje mall är ett kort, med **Your copy** för att fortsätta och **New version** när mallen ändras. Se [Partnermallar](/info/work-partner-templates.html).

### Vad stannar var

::: cols
## På den här enheten

- Det du själv sparar, om du inte slår på [Sync](/info/sync.html)
- Designsystem som du har skapat själv
- Allt du skapar och laddar ner

## På organisationens server

- Din inloggningsidentitet och enhetsinformation
- Teamprojekt, delade sessioner och ändringar i realtid i en arbetscollab
- Tillgångar som du laddar upp till det delade biblioteket
- Begäranden om godkännande och godkända leveranser
- En logg över dina inloggningar och vad du gör där
:::

När en arbetsyta är ansluten säger integritetsraden på appens första skärm samma sak. Lollys egna appar skickar inga användningshändelser till arbetsytan. [Integritet](/info/privacy.html#organisation-services-with-lolly-work) listar vad servern lagrar och vem som styr över dessa data.

<!--i:eti-building-->
## Vad Lolly Work tillför

Organisationens server kör **Lolly Work**, organisationsprogramvaran från samma projekt med öppen källkod. Appen behöver varken ett jobbkonto eller Lolly Work när du använder den på egen hand.

::: details Vad Lolly Work kan tillföra
Din organisation är värd för [Lolly Work](https://github.com/lolly-tools/lolly-work) tillsammans med Lolly och väljer vilka funktioner som ska aktiveras:

- **Inloggning och åtkomst.** Organisationens enkelinloggning, gruppbaserade behörigheter och hanterade profilfält. Administratörer kan skapa och inaktivera konton via SCIM.
- **Delat arbete.** Teamprojekt, delade sessioner och [arbetscollabs](/info/collaborate.html#collabs-through-lolly-work-optional), med redigering i realtid via organisationens server.
- **Ett delat tillgångsbibliotek.** Uppladdade tillgångar, samlingar och anslutna bibliotek, med åtkomstregler, versioner och granskning.
- **Granskning och leverans.** Godkännandesteg, hanterade länkar med utgångstid eller återkallning och leverans till destinationer som organisationen tillåter.
- **Administration.** En granskningspost över styrda åtgärder och användningsrapportering enligt instansens telemetripolicy för klienter som skickar användningshändelser. Lollys egna appar skickar inga i dag.
:::

Börja med [Driftsättning](/info/deployment.html#organisation-services-with-lolly-work) för att konfigurera tjänsten. Den offentliga demon på [lolly.work](https://lolly.work) är en sandlåda. Använd organisationens egen adress för arbete du behöver behålla.

<!--i:eti-palette-->
## En annan organisations varumärke

En partner, kund eller sponsor kan skicka sitt varumärke som en designsystemfil (`.lolly`) i stället för en adress. Att öppna den filen ansluter inte appen till något. Filen lägger till deras designsystem bredvid ditt eget på den här enheten. En konfigurationsfil från din egen organisation ansluter appen till organisationens Lolly. Innan något ändras visar förhandsvisningen vad som händer när du öppnar en fil. [Arbeta med partner](/info/partners.html) beskriver båda sidor av att arbeta med en annan organisations varumärke.

<!--i:eti-unlink-->
## Lämna

**Leave**, på kortet **Lolly instance** i **Settings**, tar bort organisationens designsystem, verktyg och katalog. Ditt eget arbete finns kvar. Det du har skapat med organisationens verktyg går inte att öppna igen förrän du ansluter på nytt. Om organisationens Lolly erbjuder det avslutar **Sign out everywhere** på samma kort dina sessioner på alla enheter, även den här.

Allt du har sparat hos organisationen stannar där, enligt dess policyer för åtkomst och lagringstid. Att lämna eller rensa den här enheten tar inte bort kopian på servern. I en webbläsare på organisationens egen adress finns inget att lämna: öppna en annan adress i stället.

<!--i:eti-help-->
## Vem du kan fråga

Vad som når organisationens server, vem som kan se dess delade projekt och vilka inställningar som är låsta bestäms av din organisation. Fråga den som sköter organisationens Lolly. [Integritet](/info/privacy.html) beskriver vad Lolly självt gör med dina data.
