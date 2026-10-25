# Använd Lolly i din organisation

Din organisation kan driva sin egen Lolly: samma app, med de verktyg och designsystem den valt. Den här sidan visar hur du når den, loggar in och vad som ändras när du gjort det.

::: note Vad du behöver från din organisation
Webbadressen till dess Lolly, eller en `.lolly`-installationsfil din organisation har gjort. lolly.tools i sig ansluter inte till någon organisation.
:::

## I en webbläsare

Öppna adressen som din organisation gav dig. Om sidan ber dig logga in trycker du på **Sign in** och följer inloggningssidan den öppnar. Därefter fungerar det som vilken Lolly som helst, med din organisations verktyg och designsystem.

Du kan också börja från lolly.tools: öppna **Settings**, och på kortet **Lolly instance** trycker du på **Open a workspace**, anger adressen och trycker på **Open this instance**. Webbläsaren går till din organisations egen adress, eftersom en webbläsare inte kan ladda en annan Lollys verktyg från lolly.tools.

![Kortet Lolly instance i Settings, där du öppnar din organisations arbetsyta eller ändrar var appen hämtar sina verktyg](/t/url-shot?url=%2F%23%2Fsettings%3Ffocus%3Dinstance-section&width=1440&height=1400&dpi=192&waitMs=2000&format=svg&cropSelector=%23instance-section&walker=1&dark=1&filename=org-instance-card)

## I skrivbords- eller mobilappen

Appen startar med sina medföljande verktyg. För att ansluta öppnar du **Settings** och trycker på **Change** på kortet **Lolly instance**. Dialogen frågar **Where should Lolly get its tools?**

1. Välj **Anslut till en Lolly-instans**.
2. Ange din organisations webbadress och tryck på **Kontrollera och anslut**.
3. Tryck på **Använd den här instansen**. Nästa skärm, **Importera dina data (valfritt)**, för över sparat arbete från en Lolly-säkerhetskopia; tryck på **Hoppa över** om du inte har någon.
4. Logga in om appen frågar.

Verktyg från en ansluten instans körs med samma tillit som appens egna, så anslut bara till en du litar på. Din organisation kan i stället skicka dig en `.lolly`-installationsfil som ansluter appen åt dig.

För att byta senare använder du **Change** igen, eller **Leave** på samma kort.

### Logga in med en kod

I dator- och mobilapparna erbjuder inloggningsskärmen också en kort kod, när din organisations Lolly stöder kodinloggning. Tryck på **Open sign-in in browser**, logga in och godkänn koden där. Eller öppna adressen den visar på en telefon eller dator där du redan är inloggad, och ange koden. Koden gäller i ungefär tio minuter.

## Vad som är annorlunda där

- **Vissa kontroller är inställda åt dig.** En kontroll som din organisation styr visar **Managed by** och organisationens namn, eller **Managed by your organisation**. En fast kontroll kan inte ändras, en meny kan bara erbjuda några av sina val, och en rad som börjar med **Set by** kan säga vilken regel som gäller och varför. Vissa kontroller visas inte alls.
- **Vissa designsystem är låsta.** Ett designsystem som din organisation tillhandahåller visar ett lås och förblir skrivskyddat. För att prova ändringar gör du en redigerbar kopia i **Settings → Preferences → Design systems**.
- **Bara dess verktyg listas.** Ett verktyg som din organisation inte erbjuder visas inte alls.
- **Delade projekt.** Om din organisation delar projekt med dig visar **Projects** en ruta **Team projects**. Dessa sessioner finns på organisationens server. Öppna en för att arbeta med den, eller starta en [arbetscollab](/info/collaborate.html#work-collabs-with-lolly-work-optional) från **Share** när det går.
- **Vissa exporter kan kräva godkännande.** Där din organisation ber om godkännande tar **Request approval** platsen för **Download**, och ett verktyg kan erbjuda färre format.

### Vad som stannar var

::: cols
## På den här enheten

- Dina egna sparade filer, om du inte slår på [Sync](/info/sync.html)
- Designsystem som du gjort själv
- Allt du gör och laddar ner

## På din organisations server

- Din inloggningsidentitet och enhetsinformation
- Teamprojekt, delade sessioner och live-ändringar i en arbetscollab
- Tillgångar du laddar upp till det delade biblioteket
- Godkännandebegäranden och godkända leveranser
- Användningshändelser, där din organisation slår på dem
:::

[Integritet](/info/privacy.html#organisation-services-with-lolly-work) listar vad servern lagrar och vem som styr de data.

## Vad Lolly Work tillför

Din organisations server kör **Lolly Work**, organisationsprogramvaran i samma projekt med öppen källkod. Appen behöver varken ett arbetskonto eller Lolly Work när du använder den på egen hand.

::: details Vad Lolly Work kan tillföra
Din organisation driver [Lolly Work](https://github.com/lolly-tools/lolly-work) vid sidan av Lolly och väljer vilka funktioner som slås på:

- **Inloggning och åtkomst.** Enkel inloggning för organisationen, gruppbaserade behörigheter och hanterade profilfält. Administratörer kan provisionera och avaktivera konton via SCIM.
- **Delat arbete.** Teamprojekt, delade sessioner och [arbetscollabs](/info/collaborate.html#work-collabs-with-lolly-work-optional), med redigering i realtid via organisationens server.
- **Ett delat tillgångsbibliotek.** Uppladdade tillgångar, samlingar och anslutna bibliotek, med åtkomstregler, versioner och granskning.
- **Granskning och leverans.** Godkännandesteg, hanterade länkar med utgångsdatum eller återkallelse, och leverans till destinationer som organisationen tillåter.
- **Administration.** Användningsrapportering enligt instansens telemetripolicy, plus en granskningspost över styrda åtgärder.

Om du sätter upp tjänsten, börja med [Deployment](/info/deployment.html#organisation-services-with-lolly-work). Den publika demon på [lolly.work](https://lolly.work) är en sandlåda; använd din organisations egen adress för arbete du behöver behålla.
:::

## Att lämna

**Leave**, på kortet **Lolly instance** i **Settings**, tar bort din organisations designsystem, verktyg och katalog. Ditt eget arbete blir kvar. Allt du gjort med dess verktyg öppnas inte igen förrän du ansluter på nytt.

Allt du sparat hos organisationen stannar hos organisationen, under dess åtkomst- och lagringspolicyer. Att lämna eller rensa den här enheten raderar inte den kopian på servern. I en webbläsare på din organisations egen adress finns inget att lämna: öppna en annan adress i stället.

## Vem du ska fråga

Vad som når din organisations server, vem som kan se dess delade projekt och vilka inställningar som är låsta är din organisations beslut. Fråga den som driftar din organisations Lolly. [Integritetspolicy](/info/privacy.html) tar upp vad Lolly själv gör med dina data.
