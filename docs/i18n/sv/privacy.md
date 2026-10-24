# Integritetspolicy

*Senast uppdaterad: 23 oktober 2026*

**Allt du gör i Lolly sker på din enhet.** Att öppna ett verktyg, skriva, förhandsgranska, exportera och kontrollera en fil sker i appen på din telefon, dator eller webbläsare. Du behöver inget konto, och appen sätter inga cookies för något av detta.

**Det du skapar lämnar din enhet bara när du ber om det.** Att lägga till ett Google Font, skicka en fil till Drive eller Dropbox, slå på Sync, spela radion eller ladda ner en AI-modell på enheten ger var och en en förfrågan som du själv startat. Appen hämtar också sina verktyg och uppdateringar från sin egen adress, och de förfrågningarna innehåller inget du har skapat. [Varje nätverksförfrågan som appen kan göra](#every-network-request-the-app-can-make) listar dem, värd för värd.

**Några av Lolly-tjänsterna körs på en server.** Renderlänkar, bildhämtaren, slutpunkten för AI-agenter och tjänsten för verifierad identitet tar bara emot det du skickar till dem, och sparar det inte längre än vad den här sidan anger.

**Din organisations Lolly Work-instans är annorlunda.** Den lagrar det delade arbete du lägger där, och för de uppgifterna gäller operatörens policy, inte den här.

::: figure privacy-where-data-goes
Vart dina data tar vägen: de stannar på din enhet om du inte startar en förfrågan, och varje typ av förfrågan har sitt eget mål.
:::

## Vad den här policyn omfattar

Lolly är programvara med öppen källkod som vem som helst kan köra: en motor, appskal för webben, datorn, mobilen och terminalen samt ett webbläsartillägg. Den här policyn har två delar:

- <!--i:code--> **Själva programvaran**: vad den gör och inte gör med dina data, oavsett var den körs. Det här är en egenskap hos koden, så det gäller varje Lolly-installation, vår eller någon annans.
- <!--i:server--> **lolly.tools**, referensinstallationen som SUSE driver: de val som gjorts när de valfria serverdelarna körs, till exempel vad som loggas, hur länge och av vem.

På en egen driftad Lolly-instans eller en företagsinstans gäller programvarans beteende nedan fortfarande, men det är instansens *operatör*, inte SUSE, som ansvarar för allt på operatörens servrar: deras renderslutpunkt, deras MCP-server, deras certifikattjänst och deras Lolly Work-instans. Be dem om deras egen policy. [Adoption & Governance](/info/adoption-governance.html) beskriver vad det innebär att driva Lolly.

## Vad som stannar på din enhet

Lollys webb-, dator- och mobilappar kör hela renderingsmotorn på enheten. När de verktyg, tillgångar och kodare du använder finns på enheten behövs ingen server för rendering och nedladdning.

**Fristående appanvändning sätter inga cookies.** Organisationsinloggning och den valfria registreringen för verifierad identitet har egna cookies, som beskrivs i deras avsnitt. Appen sparar de här posterna på enheten:

- <!--i:sliders--> **Gränssnittsinställningar**: tema, språk, ljudinställningar, storlekar på sidofält och zoom, sorterings- och visningsval samt vilka tips du har sett, i `localStorage`, så att de är redo innan appen har startat klart.
- <!--i:download--> **En offlinecache av verktygskatalogen och förhandsvisningar av tillgångar**, så att galleriet fungerar utan anslutning.
- <!--i:hash--> **Lokala användningsräknare** för statistiken på ditt profilkort, till exempel hur många exporter och vilka verktyg: en liten begränsad post i `localStorage`, som vi aldrig läser och som aldrig skickas någonstans.
- <!--i:folder--> **Ditt eget arbete**: dokument, sparade sessioner och deras historik, uppladdade bilder och typsnitt, filresultat och tidigare versioner samt Papperskorgen, som behåller borttagna objekt i 30 dagar. De finns i IndexedDB på enheten och stannar där om du inte väljer Sync eller delning.
- <!--i:globe--> **Meeting Planners stadsuppslag**, i `localStorage`, så att varje stad slås upp en gång.
- <!--i:cpu--> **Nedladdade modeller och fästa verktyg**: AI-modeller på enheten som du har gått med på att ladda ner och verktyg som du har fäst för offlineanvändning.

**Settings → Storage** visar hur mycket utrymme Lolly använder på enheten, med ditt arbete, Papperskorgen, nedladdade modeller, offlinekopior och cacheminnen uppräknade ett och ett. **Clear all my data** där tar bort den lokala kopian och stänger först av Sync; att rensa webbplatsens lagring i webbläsaren gör samma sak. Lagring som är strikt nödvändig för tjänsten du bad om kräver inget samtycke enligt ePrivacy-direktivet (Art. 5(3)), bara öppenhet, vilket är vad det här dokumentet och aviseringen i appen ger.

![Lagringsavsnittet i Settings på en skärm i telefonbredd: varje kategori av data på enheten är namngiven, med knappen Clear all my data bredvid listan](/t/url-shot?url=%2F%23%2Fprofile%3Ffocus%3Dstorage-section&width=430&height=1600&dpi=192&waitMs=2400&css=.welcome-dialog%2C.personalize-nudge%2C.store-selbar%2C.profile-row-value%2C.profile-group-value%2C%23store-hero-num%2C%23store-headroom%7Bdisplay%3Anone%7D&format=svg&waitSelector=%5Bdata-store-group%3Dmove%5D&drive=click%3A%5Bdata-store-group%3Dwork%5D%3Esummary%3Bclick%3A%5Bdata-store-group%3Dcaches%5D%3Esummary&walker=1&cropSelector=%23storage-section&dark=1&filename=pv-storage-clear)

**Export my data** skapar en `lolly-backup`-fil som du behåller och kontrollerar. Den berör aldrig våra servrar om du inte själv skickar den någonstans. Se [Dataöverföring](/info/data-transfer.html).

### Verktyg som körs på din enhet

Vissa verktyg, som **Strip Hidden Data**, **Compress** och andra med märket **Runs on your device**, arbetar på en fil som du tillhandahåller. Filen läses in i minnet, omvandlas på enheten och erbjuds tillbaka som en nedladdning. Den laddas aldrig upp, eftersom det inte finns någon server på vägen. De här verktygen fungerar offline, och deras utdata har ingen vattenstämpel eller några metadata från oss.

**Rondocode** är det enda undantaget, eftersom det skapar nytt ljud av din sång i stället för att omvandla en fil av dig. Varje ljudfil som det skriver bär Content Credentials som registrerar sången och anger eventuell AI-genererad sång. Exportpanelen säger det innan du exporterar, och [Rondocode-sånger](/info/rondocode.html#files-from-the-rondocode-utility) listar exakt vad som registreras.

![Märket som de här verktygen bär: Runs on your device - nothing is uploaded](/t/url-shot?url=%2F%23%2Ftool%2Ftext-helper&width=1440&height=900&dpi=192&waitMs=2400&walker=1&format=svg&cropSelector=%5Bdata-privacy%5D&dark=1&filename=pv-ondevice-badge)

**Prepare for sharing** och **Compare** arbetar i minnet på enheten och skickar ingenting till en server, och Prepare lägger inget i historik, länkar, säkerhetskopior eller Sync förrän du sparar ett resultat.

::: details Så hanterar Prepare for sharing och Compare dina filer
**Prepare for sharing** håller arbetsindata, privata fynd och ersättningsmappningar i minnet, utan att lägga dem i historik, länkar, säkerhetskopior eller Sync. Granskning och ersättning skickar inget filinnehåll till en server och kontrollerar inga inloggningsuppgifter online. Du väljer om du vill kopiera, ladda ner, skicka eller spara ett resultat i ditt bibliotek; ett sparat resultat följer därefter bibliotekets inställningar för säkerhetskopiering och Sync. Receptfiler utelämnar tidigare innehåll och bokstavliga mappningar, och sammanfattningsrapporter innehåller antal, omfattnings-ID:n och filhashar. CLI sparar en privat granskningsfil med originalvärdena bara när du ber om det med `--review-file`. När du lämnar en förberedelsevy frigörs dess arbetstillstånd, vilket inte är ett löfte om forensisk radering ur webbläsarens eller operativsystemets minne.

Förberedda kopior och färdiga filåtgärder delar kontrollerna i Compare. Borttagna värden börjar hopfällda, och jämförelserapporter utelämnar källnamn, sökvägar och värden om du inte väljer att ta med dem. Filhistoriken sparar kopian, så att jämföra efter en omladdning innebär att välja originalet igen, matchat med dess registrerade SHA-256. Att välja det sparar eller laddar inte upp filen.
:::

Strip Hidden Data och Prepare for sharing granskar också DOCX-, PPTX- och XLSX-filer på enheten. Från DOCX-filer som stöds kan valda egenskaper tas bort i en ny kopia; annat Office-innehåll kan bara granskas, och privata förhandsvisningar ligger bakom en visa-kontroll.

::: details Vad Office-granskningen läser och tar bort
| Office-format | Paketinnehåll som granskas | Borttagning som stöds |
|---|---|---|
| DOCX | Kärn-, program- och anpassade egenskaper; kommentarer och författare; markörer och förhandsvisningar för spårade ändringar; dolda textavsnitt; externa relationer; inbäddade objekt | Vald författare, senast sparad av, datum för skapad/ändrad/senast utskriven, titel, ämne, beskrivning, nyckelord, anpassade egenskaper, Company, Manager, Template, hyperlänksbas, programnamn och version samt statistik (total redigeringstid och antal sidor, ord, tecken, rader och stycken) |
| PPTX | Egenskaper; kommentarer och författarposter; talaranteckningar; markörer för dolda bilder; externa relationer; inbäddade objekt och arbetsböcker som stöds i flera nivåer | Ingen |
| XLSX | Egenskaper; kommentarer och anteckningar; markörer för dolda blad, rader och kolumner; definierade namn; externa relationer och anslutningar; ytor för externa länkar och pivotcache; inbäddade objekt | Ingen |

**Begränsningar.** Inventeringen granskar inte fullt ut synlig text, formler, beroenden, renderat utseende eller godtyckliga binära delar. Den stöder upp till 300 paketdelar, 64 MiB total deklarerad expansion, 2 MiB per XML-del och två nivåer av inbäddade paket; Prepare delar del- och expansionsbudgetarna över hela jobbet. Trunkerat, felaktigt, krypterat och icke-stött innehåll rapporteras och behålls. Makroinnehåll identifieras och körs aldrig, äldre binära Office-format och XLSB granskas inte, och externa referenser hämtas aldrig.

**Vad DOCX-rensningen behåller.** Rensningen stöder det transitionella DOCX-paketformatet med kanoniska kärn-, anpassade och utökade egenskapsdelar. Från de utökade egenskaperna kan Company, Manager, Template, HyperlinkBase, Application, AppVersion och statistiken TotalTime, Pages, Words, Characters, CharactersWithSpaces, Lines och Paragraphs tas bort. DocSecurity, rubrik- och deltitlar, länkflaggor och andra programegenskaper behålls. Om Template tas bort finns en eventuell kopplad mallänk kvar i dokumentinställningarna, där inventeringen rapporterar den som en extern relation.

Vissa läsare väljer hur diagram och ritningar ritas utifrån programnamn och version; LibreOffice visar till exempel ett diagram från en Word 2007-fil annorlunda utan dem. Båda behålls när filen innehåller diagram, bilder, former eller inbäddade objekt, och granskningen listar dem som behållna. En egenskap som ett Word-fält visar (TEMPLATE, EDITTIME, NUMPAGES, NUMWORDS eller NUMCHARS) behålls, och länkfält och relativa externa länkar behåller HyperlinkBase, eftersom deras mål löses upp mot den basadressen.

**Vad som bara kan granskas.** Utökade data för digitala signaturer förhindrar rensning. Signerade, makroaktiverade, krypterade, felaktiga, omdöpta eller nästlade Office-paket kan bara granskas. Det gäller också filer med andra egenskapsberoende Word-fält, som DOCPROPERTY eller AUTHOR, eller med XML-bundna innehållskontroller, eftersom borttagning av en egenskap kan ändra dokumentet när Word uppdaterar de bindningarna, och cachad fälttext kan inte visa att nästa rendering ser likadan ut. XML-delar med ovanliga filändelser, Word XML-relationsmål som inte kan granskas säkert, felaktigt deklarerade sidhuvuds- eller sidfotsdelar och SVG-delar som deklarerats som XML med filändelsen `.svg` kan också bara granskas i den här första rensningsversionen.

**Så kontrollerar rensningen sitt arbete.** Egenskapsdelar, deras deklarationer, orelaterade paketmedlemmar, XML-kommentarer och ZIP-kommentarer behålls. Rensningen tillämpar inventeringens gränser och kontrollerar varje medlems integritet innan den skriver, och granskar sedan de resulterande egenskaperna igen. Compare visar egenskapsskillnader som stöds med värdena hopfällda; den jämför inte synlig text eller renderat utseende. Värden använder förhandsvisningar på upp till 2048 tecken, så skillnader bortom en förhandsvisning kanske inte syns, och en partiell granskning kan inte fastställa att två filer är lika. CLI:s `prepare --strip-hidden-data` tar bort DOCX-egenskaper som stöds, och ett privat granskningsomslag kan välja enskilda egenskaper. Ett misslyckat rensningsskydd behåller filen och rapporterar en misslyckad åtgärd.
:::

## Varje nätverksförfrågan appen kan göra

De flesta förfrågningar hämtar verktyg, typsnitt eller modeller till din enhet. Skicka-åtgärder överför filen du valde, Sync överför en säkerhetskopia till lagringen du valde, och organisationstjänster överför innehållet eller uppgifterna som behövs för delat arbete. Varje grupp nedan listar vad som lämnar din enhet, när, och vad som händer om en operatör blockerar förfrågan. En operatörs konfigurerade identitets- och tillgångsleverantörer kan lägga till destinationer för den installationen. [Varje fast värd, i en tabell](#every-fixed-host-in-one-table) listar de värdar som webbappen kan kontakta.

::: details Sådant som hämtas till din enhet
- <!--i:download--> **Verktygskatalogen.** Inget personligt: en förfrågan om Lollys egna publika index över verktyg och tillgångar, till appens egen adress, vid start och därefter cachad offline. Om den blockeras körs appen på sina cachade verktyg och slutar upptäcka nya.
- <!--i:sparkle--> **Emojiuppsättningar.** Uppsättningen du väljer laddas ner från appens egen adress första gången du använder den. Inget personligt skickas. Lottie-animationer läses på enheten och kontaktar ingen.
- <!--i:document--> **Google Fonts.** Det valda familjenamnet och din IP-adress går till Googles typsnittsservrar (`fonts.googleapis.com` för formatmallen, `fonts.gstatic.com` för typsnittsfilen). Det här sker bara när du lägger till ett Google Font i Design System Setup, och först efter att du godkänt i en dialogruta som säger exakt detta. Varje familj hämtas en gång, sparas sedan på enheten och används offline. Om det blockeras misslyckas väljaren på den säkra sidan; ladda upp en typsnittsfil i stället.
- <!--i:cpu--> **AI-modeller på enheten.** Inget personligt: en nedladdning av en modellfil, som sedan sparas på enheten. Webbbyggen använder appens egen adress som standard; ett bygge kan ange en annan modellvärd, till exempel Lollys släppvärd `lolli.li` för de paketerade apparna. Värden tar emot förfrågan och din IP-adress, utan konto och utan modellindata. Det här sker bara när du använder en funktion som kräver en modell (Verifys djupskanning, bilduppskalning, tal och liknande) eller väljer att ladda ner modeller för offlineanvändning. Om det blockeras väntar den funktionen och allt annat fungerar.
- <!--i:sliders--> **ICC-tryckprofiler.** Inget personligt: en förfrågan om en standardprofil för tryckförhållanden till ICC:s publika register (`registry.color.org`, `www.color.org`), bara när du klickar på en ICC-förinställning i hanteraren för tryckprofiler, en gång per profil. Om det blockeras misslyckas förinställningarna; tillhandahåll din egen `.icc`-profil.
- <!--i:globe--> **Internetradio.** Inget personligt: en spellisteförfrågan och en ljudström från stationen (`api.somafm.com` och den strömserver den pekar på, `*.somafm.com`), bara medan du spelar den valfria radion i ljudspelaren. Om det blockeras misslyckas radion och alla andra ljudfunktioner fungerar.
:::

::: details Ett verktyg som behöver live-data
- <!--i:globe--> **Meeting Planners stadsuppslag.** I dag är det här det enda verktyget som hämtar live-data. Det ber `geocoding-api.open-meteo.com` att omvandla varje stadsnamn (värdstaden och varje teammedlems stad) till koordinater och en tidszon, utan konto, utan nyckel och utan någon identifierare utöver själva förfrågan. Inmatningen Host city förklarar detta, och varje svar sparas på enheten så att en stad slås upp en gång. Det körs bara medan verktyget är öppet. Om det blockeras misslyckas uppslaget och inget annat påverkas.
:::

::: details Filer du skickar
Var och en av dessa skickar bara den fil du valde, när du trycker på dess Send-knapp, efter en inloggning som du slutför i tjänstens eget fönster. Applösenordet för Bluesky, Discord-webhookadressen, applösenordet för Nextcloud och S3-nycklarna lagras bara på den här enheten, aldrig i en säkerhetskopia, och **Disconnect** raderar dem.

- <!--i:upload--> **Google Drive.** Filen, i valfritt format, går till Googles Drive API (`www.googleapis.com`). Lollys åtkomst är begränsad till filer som Lolly själv skapat (omfånget `drive.file`), så den kan aldrig läsa resten av din Drive. I webbappen hålls inloggningstoken i minnet under sessionen och lagras aldrig; i de andra apparna lagras en uppdateringstoken på den här enheten bara om du kryssar i **Stay connected**. Knappen finns bara i byggen där operatören konfigurerat ett Google-klient-id. Om det blockeras visas knappen aldrig; ladda ner filen och ladda upp den själv.
- <!--i:upload--> **Dropbox.** Filen går till Dropboxs API (`api.dropboxapi.com` för inloggning och metadata, `content.dropboxapi.com` för filen). Åtkomsten gäller bara appmappen, så Lolly ser `Apps/` och sin egen mapp där och inget annat. Länken **Open** som visas är en kortlivad privat länk, och ingen offentlig delning skapas. En uppdateringstoken lagras bara om du kryssar i **Stay connected**. Knappen finns bara med ett av operatören konfigurerat Dropbox-klient-id.
- <!--i:upload--> **OneDrive.** Filen går till Microsofts identitets- och Graph-tjänster (`login.microsoftonline.com` för inloggning, `graph.microsoft.com` för uppladdningen); en stor fil laddas upp i delar till `api.onedrive.com` eller lagringsursprung som operatören konfigurerat. Åtkomsten är begränsad till Lollys egen mapp under `Apps/`, plus ditt visningsnamn för kontoetiketten. En uppdateringstoken lagras bara om du kryssar i **Stay connected**. Knappen finns bara med ett av operatören konfigurerat Microsoft-klient-id.
- <!--i:upload--> **LinkedIn**, **bara i datorapparna**. Filen, med sitt namn som inläggstext, går till LinkedIn (`www.linkedin.com` för inloggning i din egen webbläsare, `api.linkedin.com` för uppladdningen och inlägget) som ett offentligt inlägg i ditt eget flöde. Lolly kan lägga upp som dig och läsa ditt namn för kontoetiketten, inget annat. Inloggningen sparas bara om du kryssar i **Stay connected**, och LinkedIns token gäller i 60 dagar och kan inte förnyas tyst, så den löper ut av sig själv. De värdarna finns inte i webbappens anslutningspolicy. Knappen finns bara i byggen med en LinkedIn-app konfigurerad.
- <!--i:upload--> **Penpot.** Din personliga åtkomsttoken för Penpot, som du klistrar in i appen, och designens `.penpot`-arkiv går till Penpots API (`design.penpot.app`) via en liten genomströmning på appens egen adress (`/api/penpot`), eftersom Penpots API inte svarar en webbläsare direkt. Genomströmningen vidarebefordrar och glömmer; datorapparna pratar direkt med Penpot. Det här sker bara när du trycker på **Send to Penpot** i Design-verktyget och bekräftar ett projekt. Om det blockeras misslyckas sändningen på den säkra sidan; exportera `.penpot`-filen och importera den själv.
- <!--i:upload--> **Bluesky.** Bilden, dess namn som inläggstext och alt-text, samt ditt handtag och applösenord (skapat under Bluesky → Settings → App passwords, aldrig ditt kontolösenord) går till den Bluesky-server du anger, `bsky.social` om du inte väljer en annan. Du ansluter kontot först i **Settings → Connected services**.
- <!--i:upload--> **Discord.** Filen går som en bilaga till webhookadressen för kanalen som du klistrade in, på discord.com. Vem som helst som har en webhookadress kan skriva i den kanalen, vilket är varför den stannar på enheten.
- <!--i:upload--> **Mastodon.** Filen, med sitt namn som inläggstext, går till den Mastodon- eller kompatibla server du anger, efter en inloggning i den serverns eget fönster. Anslutningen registrerar en liten app för den här enheten på den servern, och inloggningen sparas bara om du kryssar i **Stay connected**.
- <!--i:upload--> **Nextcloud eller WebDAV.** Filen går till din egen server i en autentiserad uppladdning, med serveradress, användarnamn och applösenord som du angav (Nextcloud → Settings → Security → Devices & sessions; aldrig ditt kontolösenord).
- <!--i:upload--> **S3-kompatibel lagring.** Filen går till din egen bucket (AWS S3, MinIO, R2, B2, Garage eller valfri SigV4-slutpunkt), signerad på enheten med nyckelparet du angav.

**Värdar du väljer kräver operatörens godkännande.** Värdarna för Bluesky, Discord, Mastodon, Nextcloud och S3 finns inte i Lollys fasta lista, eftersom du väljer dem. Appen skickar ingenting till någon av dem förrän operatören har godkänt exakt den HTTPS-värden: på webben i installationens Content Security Policy; i datorapparna när appen byggs. Detsamma gäller anpassad lagring och värdar för uppladdning till SharePoint. På webben måste servern dessutom tillåta webbläsaranrop från appen (CORS), och en omdirigering misslyckas på den säkra sidan, så använd en adress som inte omdirigerar. Datorapparna kontrollerar varje omdirigering mot den godkända listan.

Den här listan begränsar vilka värdar appen kan nå. Den skiljer inte på konton eller hyresgäster hos Google eller Microsoft, och leverantörens egna behörigheter avgör vilka konton och åtgärder som tillåts. Den täcker inte heller inloggningsfönster, andra resurstyper eller inbyggda funktioner, som har egna regler. En ändring kräver ett nytt datorbygge eller nya svarshuvuden på webben; spara ditt arbete innan du öppnar appen igen för att få med den. [Connector origins](/info/connector-origins.html) beskriver konfigurationen.
:::

::: details Sync mellan dina enheter
- <!--i:folder--> **Vad som lämnar enheten.** En kopia av det du skapat på den här enheten (sparade sessioner och projekt, dina designsystem med deras typsnitt och logotyper, uppladdade bilder, din profil och dina inställningar) som en fil, till den enda lagring du valde: Lollys appmapp i din Dropbox (`api.dropboxapi.com`, `content.dropboxapi.com`), filer som Lolly skapat i din Google Drive (`www.googleapis.com`), Lollys appmapp i din OneDrive (`graph.microsoft.com`, med större filer uppladdade till `api.onedrive.com` eller lagringsursprung som operatören konfigurerat, och nedladdningar från exakta lagringsursprung som operatören konfigurerat), eller din egen Nextcloud, WebDAV-server eller S3-bucket. Samma lagring håller upp till sju dagliga kopior och en kopia från före din senaste tillämpning.
- <!--i:shieldcheck--> **Inget går till Lolly.** Ingen Lolly-server, relä eller Lolly Work-server finns på vägen, och apparna behöver ingen Lolly-webbplats för det, inte ens för att logga in. Kopian krypteras på enheten först bara om du anger en lösenfras. Inloggningar, nycklar, applösenord, lösenfrasen och Sync-inställningarna stannar på enheten och finns aldrig i kopian. På webben behåller en ihågkommen Google Drive-anslutning bara ditt kontonamn (och ditt eget klient-id, om du angav ett), och Google-inloggningen varar ett besök. I Android-appen går Google Drive-inloggningen via Google Play-tjänster på telefonen, som Google driver.
- <!--i:sliders--> **När.** Bara efter att du slagit på **Sync across my devices** eller tryckt på **Sync now**: en uppladdning strax efter varje ändring och när du lämnar appen, och en kontroll efter en nyare kopia när appen startar. Om det blockeras misslyckas Sync och säger varför, och ditt arbete stannar på enheten. Du kan i stället exportera dina data till en fil och flytta den själv. [Synkronisera dina enheter](/info/sync.html) beskriver funktionen.
:::

::: details Webbsidor, skärmdumpar och bilder från andra webbplatser
- <!--i:monitor--> **En URL du ber ett verktyg ta en bild av.** Verktyget URL screenshot begär exakt den adress du skriver, bara när du startar tagningen. Eftersom du väljer adressen just då finns den inte i anslutningspolicyn, och en operatör kan inte tillåta eller blockera den per värd; för att ta bort den tar du bort verktyget.
- <!--i:globe--> **En webbsida i en Design-ruta.** Sidan begärs, med din IP-adress, från webbplatsen den kommer från, tillsammans med allt som sidan själv begär. Där webbläsaren stöder det skickas ramen inga cookies och ingen adress utöver appens eget ursprung, så ditt dokument och dess länk följer aldrig med förfrågan. I webbappen kan bara dessa spelare ramas in: `www.youtube-nocookie.com`, `player.vimeo.com`, `www.loom.com`, `www.google.com` (kartor) och `www.figma.com`, plus referenssidor på `wikipedia.org` och `*.wikipedia.org`, `commons.wikimedia.org`, `upload.wikimedia.org`, `www.wikidata.org`, `www.mediawiki.org` och `www.openstreetmap.org`. **Allow pages from any site**, under **Settings → Trusted sites**, laddar om Lolly på din enhet under en policy som kan ramma in vilken `https:`-sida som helst, och samma regler om förtroende och frågor gäller fortfarande. En sida laddas bara för en webbplats i dina Trusted sites, inklusive de borttagbara referensstandarderna, eller efter att du godkänt den rutan i dess inspektör; en presentation som någon skickat dig visar en bild av varje sida tills dess. Innan du presenterar erbjuder listan **Just this time** och **Always trust** för varje webbplats, och inget frågas medan du presenterar. Om det blockeras visar rutan sin bild med en länk för att öppna sidan i en ny flik. Lolly-verktyg och Sandbox-demon i en ruta körs på appens egen adress och kontaktar ingen.
- <!--i:sliders--> **Att ändra en sida du visar.** Åtgärden **Use page** i en webbsiderutan låter dig avvisa cookies eller stänga en banner inne på sidan. För tillgängliga Lolly-sidor döljer **Hide cookie banners** kända överlägg, inklusive OneTrust, utan att acceptera cookies eller ändra webbplatsens samtyckesval. **Page CSS** ändrar den rutans levande sida och presentation; exporter använder fortfarande den valda affischbilden. Reglerna kan inte importera resurser eller typsnitt, och webbläsare hindrar Lolly från att ändra en annan webbplats CSS. Sandbox-förhandsvisningar har en egen CSS-redigerare under **Edit in Sandbox**.
- <!--i:code--> **Webbresurserna i en Sandbox-demo.** Varje formatmall, skript, typsnitt eller bild som demons kod länkar till begärs, med din IP-adress och utan cookies, från webbplatsen som är värd för den; filer som en hämtad formatmall namnger, som Google Fonts typsnittsfiler, räknas som separata webbplatser. Det här sker bara efter att du klickat på **Fetch & inline**, eller för en webbplats i dina Trusted sites; **Always trust** bredvid en fil lägger till dess webbplats i den listan. Om det blockeras körs demon utan de filerna, och Sandbox listar varje fil som inte kunde hämtas och varför.
- <!--i:download--> **Lägg till en bild från en URL.** **Add from URL** i tillgångsväljaren eller Assets begär exakt den bildadress du klistrar in. Webbappens egen policy hindrar webbläsaren från att hämta en annan webbplats direkt, så en liten genomströmning på appens egen adress (`/api/fetch-image`) hämtar bilden och lämnar tillbaka bara byten; den lagrar ingenting, glömmer adressen och vägrar allt som inte är en offentlig bildadress. Datorapparna hämtar adressen direkt. En Lolly-länk som du klistrar in hämtas inte alls: den renderas på enheten. Om operatören stänger av genomströmningen (`LOLLY_DISABLE_IMAGE_PROXY=1`) kan bara Lolly-länkar, `data:`-bilder och bilder från samma ursprung läggas till i webbappen, och datorapparna påverkas inte.
- <!--i:palette--> **Ett designsystem från en webbplats.** Design System Setup kan läsa en sida på en webbplats du anger, via [webbläsartillägget](#the-browser-extension) eller datorappens egen hämtning, aldrig via en Lolly-server. Inget hämtas innan du trycker, och länkar på sidan följs inte.
:::

::: details Att arbeta med andra människor och agenter
- <!--i:link--> **En privat collab.** Två enheter ansluter direkt, utan någon server emellan. Inbjudan och svaret bär de adresser som varje enhet själv ser i sitt nätverk, och det här bygget konfigurerar ingen extern server för adressupptäckt, så ge dem bara till personen du arbetar med. Se [Arbeta tillsammans](/info/collaborate.html).
- <!--i:monitor--> **Nearby**, i datorappen. Medan du är synlig, vilket är tio minuter när du startar en collab-inbjudan eller, om du slår på det, så länge appen körs, tillkännager appen ett slumpmässigt namn, det visningsnamn du valt och vilken sorts enhet det är i det lokala nätverket. Den tillkännager ingen e-postadress, inget konto och ingen bestående identifierare.
- <!--i:link--> **Bjud in en agent.** Det inbjudna dokumentets tillstånd, de förhandsvisningar som agenten ber om, agentens identitet och dess ändringar går via det konfigurerade live-reläet (`lolly.ing` på lolly.tools) till agenten du bjuder in. Ett installerat värdbaserat plugin vidarebefordrar också anrop via lolly.tools-kopplingen till det relä som inbjudan väljer; kopplingen sparar ingen inbjudan eller något dokument mellan anropen. Reläet håller inbjudningar och väntande förfrågningar i minnet tills du kopplar från eller de löper ut: tio minuter för en oanvänd inbjudan och trettio minuter utan aktivitet för en som anslutits. Din agents leverantör hanterar de data den får enligt sin egen policy. Det här sker bara efter att du skapat en inbjudan i Share och gett dess instruktioner till din agent; läsbehörighet tillåter granskning och redigeringsbehörighet tillåter också ändringar. Pause stoppar ändringar, och Disconnect eller att du återkallar inbjudan avslutar åtkomsten. Om det blockeras kan agenten inte ansluta eller fortsätta, och du kan fortsätta redigera.
- <!--i:cpu--> **Allow AI control**, i datorappen. En agent som körs på den här datorn kan läsa och redigera det öppna Design-dokumentet via en anslutning som stannar på datorn. Det är av tills du slår på det. Lolly skickar ingenting till en server för det; agentens leverantör hanterar det agenten läser enligt sin egen policy. [Threat Model & Trust Boundaries](/info/threat-model.html) listar vad en sådan agent kan och inte kan göra.
- <!--i:server--> **En fjärrinstans.** När du pekar appen mot en annan Lolly-installation tar den emot allt den instansen svarar med, via samma katalogsynkronisering, plus en versionstagg på förfrågningar till den (vilken sorts app och motorversionen, samma information som en user agent bär), så att dess operatör kan se vilka Lolly-versioner som används. På en hanterad instans bär taggen, medan du är inloggad, också ett installations-id för den här enheten, så att operatörens enhetslista kan skilja installationer åt; att lämna raderar id:t, och en enhet som ansluter igen senare presenterar ett nytt. Du väljer värden, så den finns inte i anslutningspolicyn. Om det blockeras misslyckas bytet och din lokala instans påverkas inte.
- <!--i:people--> **Din organisations Lolly Work-instans.** Inloggningsidentitet och enhetsinformation, policyförfrågningar, de delade sessionerna, collab-ändringar, uppladdningar, godkännandeinlämningar och leveransfiler du använder, samt tillåtna etiketter för användningshändelser där det är konfigurerat, går till din organisations instans, med inloggning via dess identitetsleverantör. Policyuppdateringar och aktiverad telemetri kan köras under användning; delat arbete, collabs, granskning och leverans skickar innehåll som en del av de arbetsflödena. Om det blockeras kan de organisationsfunktionerna inte slutföras, och ditt personliga arbete förblir separat. Se [Organisationstjänster med Lolly Work](#organisation-services-with-lolly-work).
:::

### Varje fast värd, i en tabell

Webbappens Content Security Policy är det som hindrar ett skript från att nå en värd som inte finns i listan. Förutom appens egen adress anger tabellen varje värd som policyn listar, plus de två LinkedIn-värdarna som datorapparna lägger till, markerade som bara för datorn. Ett CI-test kontrollerar den här tabellen mot den driftsatta policyn, så att en värd inte kan läggas till i den ena utan den andra.

| Vad | Vad som faktiskt lämnar din enhet | Värdar |
|---|---|---|
| Modeller på enheten i de paketerade apparna, och släppfiler | En förfrågan om en publik fil, med din IP-adress | `lolli.li` |
| Google Fonts | Typsnittsfamiljens namn och din IP-adress | `fonts.googleapis.com`, `fonts.gstatic.com` |
| Skicka till och Sync med Google Drive | Filen eller säkerhetskopian du valde | `www.googleapis.com` |
| Skicka till och Sync med Dropbox | Filen eller säkerhetskopian du valde | `api.dropboxapi.com`, `content.dropboxapi.com` |
| Skicka till och Sync med OneDrive | Filen eller säkerhetskopian du valde, och ditt visningsnamn för kontoetiketten | `login.microsoftonline.com`, `graph.microsoft.com`, `api.onedrive.com` |
| Meeting Planners stadsuppslag | Varje stadsnamn | `geocoding-api.open-meteo.com` |
| ICC-tryckprofiler | En förfrågan om en publik profil | `registry.color.org`, `www.color.org` |
| Internetradio | En spellisteförfrågan och en ljudström | `api.somafm.com`, `*.somafm.com` |
| Bjud in en agent, och arbetsytan lolly.ing | Det inbjudna dokumentets tillstånd, förhandsvisningar och ändringar, samt de arbetsytsförfrågningar du gör | `lolly.ing` |
| Spelare i en Design-webbruta | En förfrågan om sidan, med din IP-adress | `www.youtube-nocookie.com`, `player.vimeo.com`, `www.loom.com`, `www.google.com`, `www.figma.com` |
| Referenssidor i en Design-webbruta | En förfrågan om sidan, med din IP-adress | `wikipedia.org`, `*.wikipedia.org`, `commons.wikimedia.org`, `upload.wikimedia.org`, `www.wikidata.org`, `www.mediawiki.org`, `www.openstreetmap.org` |
| Skicka till LinkedIn, bara i datorapparna | Filen, med sitt namn som ett offentligt inlägg | `www.linkedin.com`, `api.linkedin.com` |

Datorappernas egen lista innehåller också Googles tokenslutpunkt för Drive-inloggningen. Varje annan värd, som en Mastodon- eller Nextcloud-server du anger, kräver operatörens godkännande, enligt beskrivningen under Filer du skickar. Värdar som du väljer i stunden, som en URL du tar en bild av eller en fjärrinstans du anger, finns inte i någon lista.


**SEAL-signaturer gör inga förfrågningar.** Verify kan kontrollera SEAL-signaturer, ett schema där signeringsnyckeln kan publiceras i DNS. Webbläsare kan inte göra DNS-frågor, så ett webbuppslag skulle behöva gå via en DNS-över-HTTPS-resolver från tredje part, som skulle se domänen som kontrolleras och din IP-adress. Lolly brukade använda Cloudflares resolver; det gör det inte längre, och inget har ersatt Cloudflare. Ingen Lolly-app slår upp SEAL-nycklar i dag: dator- och mobilapparna kör samma Verify-vy, och kommandoradens `lolly validate` kontrollerar inte SEAL. En fil vars SEAL-post bär sin nyckel inbäddad kontrolleras offline, och Verify kallar signaturen internt konsekvent utan att bekräfta domänen. En fil vars nyckel bara finns i DNS visar **SEAL signature did not verify**, med orsaken "no key resolver and no inline key".

![Verify-skärmen: en släppyta och inget annat - filen kontrolleras där den redan finns, utan uppladdning och utan konto](/t/url-shot?url=%2F%23%2Fverify&width=1440&height=900&dpi=192&waitMs=1400&walker=1&format=svg&cropSelector=.valid-layout&dark=1&filename=cc-verify-drop)

Du kan själv kontrollera det här och varje annat påstående på den här sidan: [Verify It Yourself](/info/verify-yourself.html) ger kommandona och den utdata du kan förvänta dig.

## Tjänster som lolly.tools driver

Dessa körs på lolly.tools för alla. Var och en tar bara emot det du skickar. [Server Surface](/info/server-surface.html) beskriver samma komponenter så som de fungerar i vilken installation som helst.

### Renderlänkar

Varje URL av formen `https://lolly.tools/tool/<tool-id>.<ext>?<inputs>` renderas på riktigt, och dess indata färdas i URL:en, så en delad Lolly-länk kan visas som en live-bild i en README, en wiki eller en instrumentpanel. Att hämta en ber servern rendera **publika verktygs- och katalogdata** med indata skrivna i adressen.

- <!--i:usercheck--> **Inga konton, inga cookies, inget tillstånd.** Vägen kräver ingen inloggning, och inget på din enhet läses. Dina dokument, sessioner och uppladdningar lämnar aldrig din webbläsare och kan inte förekomma i de här länkarna.
- <!--i:document--> **URL:en i sig registreras.** En URL:s frågesträng är en del av förfrågan, så den syns i värdplattformens vanliga åtkomstloggar som vilken begärd sökväg som helst. Om en länks indata innehåller någons namn eller e-postadress, som en namnbricka eller en e-postsignatur kan göra, **finns den texten i de loggarna**. Ge en renderlänk bara det du skulle sätta på en publik sida.
- <!--i:globe--> **Indata är offentliga ändå.** De är vad länkens upphovsperson skrev i URL:en, läsbara för alla som länken når. Lägg inte hemligheter i en delad länk; Lolly erbjuder länkkryptering för känsligt innehåll.
- <!--i:eyeoff--> **Cachade, begränsade och inte indexerade.** Svar cachas och hastighetsbegränsas som vilken publik bild som helst, och markeras `noindex` så att sökmotorer lämnar dina renderingar utanför.

En egen driftad installation som inte vill ha någon publik renderväg sätter `LOLLY_DISABLE_RENDER_GET=1`, och varje sådan URL returnerar 404.

### Bildhämtaren och genomströmningen till Penpot

**Add from URL** i webbappen och **Send to Penpot** använder två små genomströmningar på lolly.tools, beskrivna under [Varje nätverksförfrågan som appen kan göra](#every-network-request-the-app-can-make). Bildhämtaren sparar ingenting och glömmer adressen. Penpot-genomströmningen vidarebefordrar din token och ditt arkiv till Penpot och sparar ingetdera; den loggar kommandonamnet och Penpots svarsstatus.

### MCP-servern, för AI-agenter

En AI-agent kan nå Lolly över Model Context Protocol, via en slutpunkt som en operatör driver. lolly.tools driver en, och vem som helst kan driva sin egen, även helt offline.

- <!--i:cpu--> **Filer som en agent skickar.** Verktygen som tar en fil (`lolly_transform`, `lolly_verify`, `lolly_redact`, `lolly_read`, `lolly_check`, `lolly_package`, `lolly_compose`, `lolly_rebrand` och bildverktygen `lolly_look`, `lolly_sample_color` och `lolly_trace_edges`) bearbetar den i minnet och returnerar resultatet i samma anrop. Filen skrivs aldrig till disk och sparas inte när förfrågan är klar. `lolly_inspect` tar också en fil, och dess video- och tryckproduktionskontroller skriver en tillfällig arbetskopia som raderas när anropet returnerar. Varje annat verktyg arbetar utifrån parametrarna i anropet: text, tal, färger, URL:er, katalogtillgångars id eller ett dokument som anroparen tillhandahåller.
- <!--i:cpu--> **Rebrand anger vart en presentation går.** `lolly_rebrand`s första steg, `capabilities`, säger med ord vart dina byte skulle gå innan du skickar något: på en egen driftad lokal server lämnar presentationen aldrig den maskinen, och på en värdbaserad server skickar anropet av `lolly_rebrand` presentationen dit, upp till de storleks- och bildgränser som det steget anger.
- <!--i:lock--> **Den öppna slutpunkten.** På lolly.tools är `lolly.tools/api/mcp` öppen för alla utan token. Anrop begränsas per adress och av en daglig budget. Adressen blir en pseudonym digest i missbrukskontrollens lager, som vid inloggningsslutpunkterna nedan, och budgeten räknar bara CPU-tid och skickade byte, utan adress. Bearer-token för en begränsad slutpunkt skrivs aldrig i en logg eller en render-URL.
- <!--i:link--> **Nedladdningslänkar för stora resultat.** lolly.tools returnerar resultat inline och utfärdar aldrig de här länkarna. En operatör kan slå på dem för sin egen autentiserade gateway, där ett resultat hålls i högst fem minuter och bara anroparens egen bearer-token kan hämta det; se [MCP Server](/info/mcp.html#private-download-links-for-large-results). En planerad begränsad slutpunkt på `mcp.lolly.tools` skulle ta en bearer-token som operatören utfärdar till betrodda klienter, eller OAuth 2.1 med kortlivade signerade token som kontrolleras mot en delad hemlighet; aktiveringen är väntande, och den listas under [Leveransvärdar och personuppgiftsbiträden](#delivery-hosts-and-processors).

### Verifierad identitet: en inloggning du startar själv

Lolly kan försegla ett **Content Credential** i dina exporter, så att vem som helst kan kontrollera offline att en fil är oförändrad sedan den lämnade Lolly. Så mycket är **på som standard och helt lokalt**: signeringsnyckeln skapas på din enhet och signeringen sker offline. Utan registrering är nyckeln en engångsnyckel, ett nytt nyckelpar som skapas för varje export och kastas efteråt. När du registrerar dig finns nyckeln kvar och genereras som **icke-extraherbar**, så inte ens Lollys egen kod kan läsa den, bara be den signera. Hur som helst lämnar den aldrig din enhet.

[Exporting](/info/exporting.html#content-credentials-c2pa) listar vad en credential registrerar: verktyget, tiden, den grova exportytan, ditt namn bara när du slagit på *Use my details*, de krediterade verk som en export placerar, och varje Rondocode-sång som en video- eller ljudexport spelar (dess namn, en hash av dess källa och hur Lollys sandlåda renderade sången). Exportpanelen listar de sångerna innan du exporterar.

Credentialen och filens metadata registrerar också [designsystemet och färgvarianten](/info/exporting.html#the-design-system-record) som ritade exporten: designsystemets id och namn, dess publicerade version och färgvarianten. Ett designsystems namn är text som dess ägare skrivit och kan vara en kunds namn, så exportpanelens kort **Design system** visar de exakta orden innan du exporterar. Avmarkera kortet, eller skicka `_madewith=0` eller `--no-madewith`, för att utelämna dem.

Det enda *valfria* steget utöver det är att registrera en verifierad identitet, så att dina exporter säger "Verified - signed by \<your email\>" i stället för att namnge en anonym nyckel. **Om du hoppar över registreringen tar certifikattjänsten inte emot några registreringsdata från dig.**

![Kortet Verified identity i Settings, i telefonbredd: väljaren för certifikatets livslängd och registreringssteget under den, vilande tills du själv startar det](/t/url-shot?url=%2F%23%2Fsettings%3Ffocus%3Didentity-section&width=430&height=1600&dpi=192&waitMs=2400&css=.welcome-dialog%2C.personalize-nudge%7Bdisplay%3Anone%7D&format=svg&walker=1&cropSelector=%23identity-section&dark=1&filename=pv-identity-enrol)

Om du registrerar dig är det här exakt vad som händer:

::: timeline
- <!--i:usercheck--> **Du väljer en inloggningsmetod**: GitHub, Google, SUSE (id.suse.com) eller en länk via e-post. För de tre OIDC-leverantörerna går du till leverantörens egen inloggningssida, under deras integritetspolicy, inte vår, och certifikattjänsten får tillbaka bara en verifierad e-postadress och leverantörens namn. För e-postlänken går adressen du skriver till **Resend**, en tjänst för transaktionsmejl, bara för att leverera den länken.
- <!--i:lock--> **En kortlivad cookie skyddar omdirigeringen.** Certifikattjänsten sätter `lolly_ca_state`, `HttpOnly`, avgränsad till `/api/ca` och som löper ut inom tio minuter. Den bär ett slumpvärde snarare än en spårningsidentifierare, finns bara för att hindra att inloggningsomdirigeringen förfalskas och rensas så snart inloggningen är klar.
- <!--i:eyeoff--> **Din IP-adress används kortvarigt för att förhindra missbruk** av inloggningsslutpunkterna, så att ett skript inte kan översvämma en inkorg eller göra slut på e-postkvoten. Lolly gör om den till en SHA-256-digest innan den når det kortlivade missbrukskontrolllagret, så den råa adressen skickas inte dit. Digesten är pseudonym snarare än anonym: den som har tillgång till lagret skulle kunna återskapa en IPv4-adress genom att prova varje möjlig. Hinken löper ut efter ungefär en minut och används inte till något annat. Vanliga åtkomstloggar hos värdtjänsten är separata och beskrivs nedan.
- <!--i:seal--> **Tjänsten utfärdar ett certifikat** som binder din verifierade e-postadress till din enhets publika nyckel. Den privata nyckeln stannar på enheten: klienten skickar en certifikatbegäran med ett bundet bevis på innehav, och ingen privat enhetsnyckel går till något av utfärdarlägena.
- <!--i:check--> **Signeringen förblir lokal.** Med den äldre utfärdaren behöver en export ingen förfrågan till certifikattjänsten. En hanterad identitet behöver också en färsk, signerad spärrlista från sin utfärdare; klienten kan använda en cachad lista inom sitt konfigurerade färskhetsfönster, och uppdateringen kan kontakta certifikattjänsten under en export. Saknad, utgången eller ogiltig status hindrar den hanterade identiteten från att användas.
:::

::: details Lagring och återkallelse i varje utfärdarläge
**Äldre värdbaserad utfärdning** erbjuder 7, 30, 90 eller 365 dagar, begränsat av operatören. Den sparar ingen identitetsförteckning och ingen utfärdningslogg, så den kan inte slå upp vem som fick ett certifikat eller återkalla den personens certifikat; livslängden är återkallelsen.

**Hanterad organisationsutfärdning** använder en standardlivslängd på högst 24 timmar och ett maximum på sju dagar, med egen rot och egen förtroendepolicy för utfärdare, och signeringen går till den Vault-utfärdare som operatören konfigurerat. Dess registreringsprogram använder ett delat engångslager för tillträde som bara håller en nyckelad autentiseringsidentifierare och en förfrågningsdigest, i högst tio minuter, och lagrar ingen identitetsförteckning eller cache av certifikatsvar. PKI-leverantören, dess granskningsenheter, gateways och säkerhetskopior har egna dataflöden. Även när den vanliga utfärdningslagringen är avstängd kan certifikatbaserad återkallelse behålla certifikatet, inklusive dess e-postidentitet, och återkallelsens serienummer och granskningsidentifierare kan förbli kopplingsbara; din operatörs policy avgör den förteckningen, vem som får åtkomst till den och hur länge den sparas.

En hanterad enhet kan be om att återkalla sitt eget certifikat, med ett autentiserat bevis från enheten, och inget API ber om enhetens privata nyckel. Operatören kan dra tillbaka en utfärdare via sin förtroendepolicy. Lolly sparar ingen koppling från personer till certifikat, så att återkalla en persons certifikat när hen slutar beror på poster som operatören för, och PKI-poster, granskningsposter, mottagare och säkerhetskopior följer operatörens policy. [Designen av certifikattjänsten](https://github.com/lolly-tools/lolly/blob/main/services/ca/README.md) beskriver utfärdarens förvaring, leverantörens lagring och kvalificering.
:::

## Organisationstjänster med Lolly Work

**Lolly Work** är Lolly-projektets valfria organisationstjänst, som varje organisation som driver en instans driftsätter separat. Att ansluta till en instans lägger till data som hålls på den servern vid sidan av din lokala redigering. Dess operatör ansvarar för den installationens integritetspolicy, åtkomstkontroller, mottagare, lagring och säkerhetskopior.

| Arbetsflöde | Data som organisationens tjänst hanterar |
|---|---|
| Inloggning och provisionering | Anspråk från identitetsleverantören, konto- och gruppmedlemskap, inloggningssessioner och enhetsinformation. OIDC hanterar inloggning; administratörer kan provisionera och avaktivera konton via SCIM |
| Delad katalog och projekt | Uppladdade tillgångar, metadata och versioner; delade projekt och sessioner; innehåll som hämtats från konfigurerade biblioteksleverantörer |
| Arbetscollabs | Delat sessionstillstånd, live-ändringar och deltagarnärvaro som skickas via instansen; sparat tillstånd består enligt dess lagringspolicy |
| Hanterade delningslänkar | Länkmål och åtkomstinställningar, som utgångsdatum och valfritt lösenordsskydd; förfrågningar löses via instansen och kan återkallas |
| Granskning och leverans | Inskickat innehåll, godkännandebeslut, vald destination, stegade filer och leveranskvitton |
| Serverrenderingar och batchar | Inskickade verktygsindata, renderingsförfrågningar, status och bevarade utdatafiler. De här jobben körs på servern i stället för på din enhet |
| Användningsrapportering | Tillåtlistade händelseetiketter som verktygs-id, format och tillgångs-id, enligt telemetripolicyn nedan |
| Granskningslogg | Poster om aktör och åtgärd för styrda operationer, förda separat från användningstelemetri |

Tjänsten använder autentiseringscookies, inklusive `lw_session` för inloggade medlemmar och `lw_guest` för gäståtkomst där det är aktiverat, separat från certifikattjänstens cookie. Policyuppdateringar och aktiverad användningsrapportering kan göra förfrågningar medan appen används, utan ett separat klick för varje. Det här är trafik till den konfigurerade instansen, inte en rapport till Lolly-projektet om installationer det inte driver.

**Användningstelemetri har tre nivåer.** `off` lagrar inga användningshändelser, `aggregate` tar bort användar-id och `standard` kan tillskriva händelser. Standardnivån är `standard`, så en instans lagrar de användningshändelser den tar emot om inte dess operatör väljer `off`. Standardpolicyn för tillskrivning är `opt-in`, som kräver ditt samtycke innan ett användar-id lagras; en operatör kan i stället konfigurera tillskriven rapportering med `telemetryAttribution: default`. Tillåtna attribut är etiketter, aldrig verktygens indatavärden. Se [Work telemetry](/info/work-telemetry.html).

**Granskningsloggen är separat.** Styrda åtgärder kan spara en identifierad granskningspost oavsett ditt telemetrisamtycke. Att stänga av telemetri stänger inte av lagring av delade sessioner, godkännandeposter, lagring av renderjobb eller granskningsloggen. Operatören styr lagringstid och radering, inklusive eventuell pseudonymisering av granskningsloggen; se [Work storage and data lifecycle](/info/work-data-lifecycle.html).

| | Din enhet | Din organisations instans |
|---|---|---|
| Vad den håller | Ditt personliga arbete, dina inställningar och cacheminnen | Delat arbete, konton, uppladdningar, godkännanden, renderingar, granskningslogg och konfigurerad telemetri |
| Vem som raderar det | Du, med **Clear all my data** eller webbläsarens webbplatsdata | Operatören, via instansens egna kontroller |
| Vem du frågar | Ingen: posterna finns på din enhet | Instansens operatör, för åtkomst, export eller radering |

**Lokal radering är inte serverradering.** Att lämna en instans eller rensa din webbläsare tar bort lokalt tillstånd, inte organisationens lagrade poster eller säkerhetskopior. Personlig [Sync](/info/sync.html) och **Export my data** säkerhetskopierar din enhet, inte organisationens tjänst. Den publika demon [lolly.work](https://lolly.work) håller sitt tillstånd bara i minnet och är ingen varaktig lagring för ditt arbete.

## Webbläsartillägget

Webbläsartillägget **Lolly URL Screenshot** samlar inte in några personuppgifter åt oss. Det har ingen analys, ingen spårning och ingen egen server. Sidan [Webbläsartillägg](/info/extension.html) beskriver hur det fungerar.

**Vad det gör.** Lollys webbapp kan be det om en skärmbild av en webbsida, eller om en sidas innehåll för att starta ett designsystem från en webbplats. Varje förfrågan öppnar ett godkännandefönster i tillägget som visar den begärande webbplatsen, om den vill ha en skärmbild eller sidans innehåll, och sidans adress. Först när du trycker på **Approve once** öppnar tillägget sidan i en tillfällig bakgrundsflik, tar skärmbilden eller läser sidan, lämnar resultatet till Lolly-fliken som frågade och stänger fliken. Varje förfrågan kräver sitt eget godkännande.

**Data.**

- <!--i:shieldcheck--> **Vi samlar in ingenting.** Resultatet går bara till Lolly-sidan som frågade, i samma webbläsare. Tillägget lagrar inget sidinnehåll och lägger inte till någon annan mottagare.
- <!--i:globe--> **Nätverksförfrågningar.** Sidan du godkänner laddas som den skulle göra i vilken flik som helst, tillsammans med allt som sidan själv begär. Att läsa en sidas innehåll hämtar också sidans formatmallar och några av dess ikon- och logotypbilder, inifrån sidan, och de hämtningarna skickar inga cookies till andra webbplatser. Tillägget gör inga andra förfrågningar, och inga går till en Lolly-server.
- <!--i:lock--> **Din webbläsarsession.** Sidan laddas med din webbläsarsession, som om du öppnade den själv, så en sida du är inloggad på kan lägga privat information i resultatet.
- <!--i:link--> **Adresserna du godkänner** används bara för att ladda den ena sidan för den ena förfrågan. De loggas eller delas inte.

**Behörigheter.**

- <!--i:wrench--> **`debugger`**: för att ta skärmbilden via DevTools Protocol, samma mekanism som Lollys datorapp använder.
- <!--i:monitor--> **`tabs`**: för att öppna och stänga den tillfälliga fliken, och för att kontrollera att varken Lolly-sidan eller målsidan har flyttats sedan du godkände.
- <!--i:code--> **`scripting`**: för att läsa en sidas innehåll i den tillfälliga fliken, efter att du godkänt den förfrågan.
- <!--i:database--> **`storage`**: för att notera id:n för sina tillfälliga flikar i sessionslagring, så att de ändå stängs om webbläsaren stoppar tillägget under en förfrågan. Inget sidinnehåll lagras.
- <!--i:check--> **Valfri webbplatsåtkomst (`http://*/*`, `https://*/*`)**: beviljas inte vid installation. När du trycker på **Approve once** ber tillägget Chrome om åtkomst till den enda webbplatsen i den förfrågan, och Chrome frågar dig första gången för varje webbplats. En webbplats som du tillåtit tidigare kräver fortfarande ett nytt godkännande för varje förfrågan.

Inget av detta används för att läsa, övervaka eller överföra din surfning utöver den enda förfrågan du godkände.

## Leveransvärdar och personuppgiftsbiträden

Publika katalogfiler, verktyg och visningsrenderingar kommer som standard från appens egen adress. Innehållsadresserade namn ändrar var en fil hämtas, inte vem som tar emot förfrågan. Inget CDN från tredje part aktiveras av den här leveransfunktionen. Ett CDN som avslutar TLS skulle ta emot förfrågningsuppgifter, inklusive IP-adresser och alla cookies eller bearer-uppgifter som vidarebefordras dit, även under samma värdnamn i webbläsaren, så en operatör som lägger till ett tar på sig ett nytt personuppgiftsbiträde.

**Innan något CDN eller någon extern modellvärd läggs till** måste administratören publicera biträdets namn, värdnamn, jurisdiktioner, vilka metadata som tas emot, lagringstid och överföringsarrangemang. [Delivery deployment](/info/deploy-delivery.html) listar vad som ska redovisas. Svar från privata arbetsytor går förbi delade cacheminnen: personliga resultat, åtkomstavslag och fel använder `private, no-store`, och ett tillåtet privat svar kan valideras om i din webbläsare utan att bli publikt.

Referenstjänsterna använder värdtjänsten nedan. Det här är en lista över värdnamn, inte ett påstående om att en annan organisations instans använder samma region.

| Värdnamn eller tjänst | Funktion och mottagare | Region och datahantering |
|---|---|---|
| lolly.tools | Publik app, katalog, rendering och certifikattjänster; UpCloud-hosting | Frankfurt, Tyskland. Förfrågningsuppgifter kan förekomma i infrastrukturloggar; vanlig lokal redigering stannar på enheten |
| lolly.ing | Hanterad arbetsyta och dokumentagenttjänster; UpCloud-hosting | Frankfurt, Tyskland. Den privata databasen och fillagringen finns på samma värd. Konton, delat innehåll och tjänsteposter följer instansadministratörens policy |
| mcp.lolly.tools | Planerad valfri autentiserad MCP-gateway och privata resultatnedladdningar; UpCloud-hosting | Frankfurt, Tyskland, med samma värdtjänstbiträde. Aktivering väntande. Gatewayen skulle ta emot förfrågningsuppgifter och de parametrar eller filer som dess anropare skickar |
| lolli.li | Publika släpp- och modellfiler; UpCloud Managed Object Storage, separat från applikationsklustret | Frankfurt, Tyskland, i UpClouds objektlagringsregion europe-2. En nedladdning skickar förfrågningsuppgifter, inte de indata som modellen senare bearbetar |
| Konfigurerad identitetsleverantör | Google, GitHub eller en operatörs OIDC-leverantör | Inloggningen följer den leverantörens policy. Fråga instansens operatör om värdnamn, region och överföringsarrangemang |
| Konfigurerad tillgångsleverantör | Brandfolder eller ett annat bibliotek som operatören väljer | Leverantören tar emot tillåtna biblioteksförfrågningar. Dess källbehörigheter och instansens policy styr åtkomsten; fråga operatören om dess värdnamn och regioner |
| E-postregistrering, när det är konfigurerat | Resend levererar den begärda inloggningslänken | Tar emot destinationsadressen för det meddelandet; dess egna behandlingsvillkor gäller |

Referensapplikationen använder ingen annan värdtjänst, databas eller leverantör för missbrukskontroll. En operatör kan välja andra leverantörer för en annan instans, och leverantörer av hosting, identitet, tillgångar och e-post behöver var och en sin egen redovisning. Modellvärdens [objektlagringsregion](https://upcloud.com/docs/products/managed-object-storage/availability/) verifieras separat från applikationens region.

**Valfria nedladdningslänkar för MCP bundna till huvudman.** En operatör kan slå på nedladdningslänkar för stora resultat på en autentiserad gateway med en enda replika. De är av som standard. Den anonyma gatewayen på `lolly.tools/api/mcp` returnerar resultat inline och utfärdar aldrig de här länkarna. Det planerade begränsade värdnamnet är `mcp.lolly.tools`, hos samma UpCloud-biträde i Frankfurt; aktiveringen är väntande, och den här sidan påstår inte att det finns en aktiv nedladdningslänkstjänst. Länkarna lägger inte till något CDN från tredje part.

Bara en autentiserad anropare med filomfång kan få en länk, och samma anroparens bearer krävs för att hämta den: använd den validerade bearer från renderanropet, inte en annan token för samma konto. Beviljandet löper ut inom 300 sekunder. Ägarskap och resultatuppslag stannar i gatewayens minne, och utdatabyte går till privata temporära filer, som rensas efter utgång eller tas bort vid ren avstängning. En omstart av gatewayen gör befintliga länkar ogiltiga. Hållna resultat är begränsade till 64 MiB per bearer, 256 MiB över hela gatewayen och 200 väntande eller hållna filer. Dagliga budgetar för CPU och avkodade byte räknar resultat både när de hålls och när de laddas ner. Svar använder `private, no-store` och `Referrer-Policy: no-referrer`. En länks token ensam låter inte en annan person eller agent läsa resultatet.

## Infrastrukturloggar

Det här avsnittet beskriver den publika installationen lolly.tools. Dess värdplattform registrerar vanliga förfrågningsuppgifter: IP-adress, begärd sökväg, tidsstämpel och user agent. Lokala redigeringar når inte den värden. En renderlänks frågesträng kan innehålla den text som anroparen angav, som förklarats ovan. MCP-filverktyg bearbetar de byte de får i minnet. En Lolly Work-instans håller också de poster som beskrivs ovan, enligt operatörens loggningspolicy.

**De publika tjänsterna håller applikationsloggningen till ett minimum.** MCP-servern loggar start, konfiguration och renderingsvarningar; den för ingen egen förfrågningslogg och loggar inte token eller anroparadresser. Penpot-genomströmningen loggar varje kommandonamn och Penpots svarsstatus, aldrig huvuden, token eller filen. Certifikattjänsten loggar sina startinställningar och konfigurationsvarningar, plus två avskalade rader vid fel: en statuskod för misslyckad sändning utan mottagaradress, och en fast felrad utan feltext, stackspår eller URL, eftersom ett leverantörsfel kan bära identitetsvärden eller inloggningsuppgifter. Allt annat i loggen kommer från värdplattformen.

För lolly.tools styr instansadministratören förfrågningsloggning, rotation och lagring hos UpCloud. Den här sidan anger ingen maximal loggtid som inte har verifierats. Kontakta den personuppgiftsansvarige nedan för det aktuella schemat och för alla förfrågningar om loggar som servern håller. För en annan instans gäller dess operatörs inställningar, inklusive eventuella logexporter eller andra biträden.

## Rättslig grund, lagring och mottagare

Den här tabellen gäller referensinstallationen **lolly.tools**. Den anger inte de rättsliga grunderna eller lagringstiderna för din organisations Lolly Work-instans; dess operatör anger dem i sin egen policy.

| Behandling | Rättslig grund (GDPR art. 6) | Lagras i |
|---|---|---|
| Allt på din enhet (dokument, inställningar, cache, räknare) | **Inte vår behandling alls**: det når aldrig oss. Lagring på din enhet är strikt nödvändig för tjänsten du bad om (ePrivacy art. 5(3)), så den kräver inget samtycke | Tills du raderar den |
| Din e-postadress under äldre värdbaserad registrering för Content Credentials | **Art. 6(1)(b)**, fullgörande av en tjänst du uttryckligen bad om | Ingen identitetsförteckning eller utfärdningslogg i den äldre tjänsten; e-postadressen används under förfrågan och ingår i ditt certifikat. Lagring av hanterad organisations-PKI, granskning och återkallelse följer operatörens policy |
| En pseudonym SHA-256-digest av din IP-adress, för hastighetsbegränsning av inloggningsslutpunkterna och de publika slutpunkterna för rendering, bilder och MCP | **Art. 6(1)(f)**, vårt berättigade intresse av att förhindra missbruk av en gratistjänst och av en tredje parts e-postkvot. Vi anser att detta klarar en intresseavvägning eftersom den råa adressen inte skickas till begränsaren, digesten bara används för missbrukskontroll och löper ut av sig själv | Ungefär en minut i missbrukskontrolllagret; sparas inte efteråt |
| Åtkomstloggar hos värdtjänsten (IP, sökväg, tidsstämpel, user agent) | **Art. 6(1)(f)**, vårt berättigade intresse av tjänstens säkerhet, missbruksförebyggande och felsökning | Rotation och lagring som administratören konfigurerat; kontakta den personuppgiftsansvarige för det aktuella schemat |

**Mottagare.** Kategorierna av mottagare är vår värdleverantör (UpCloud), som är värd för applikationens databas och missbrukskontrolllager, och, bara om du använder inloggning via e-post, en leverantör av transaktionsmejl (Resend). Missbrukskontrolllagret tar bara emot kortlivade digester, aldrig den råa IP-adressen. Om du loggar in med GitHub, Google eller SUSE (id.suse.com) har du att göra med den leverantören direkt enligt deras egen integritetspolicy, och de berättar för oss en verifierad e-postadress och inget annat. Vi delar inte personuppgifter med någon annan, och vi säljer inte data, kör ingen reklam och profilerar inte användare.

**Överföringar utanför EES.** Referensapplikationens hosting, databas och fillagring finns i Frankfurt. Valfria leverantörer av identitet, e-post och tillgångar har egna behandlingsplatser och villkor, som kan innefatta åtkomst utanför EES, och en servers region ensam fastställer inte varje mottagares jurisdiktion. Kontakta den personuppgiftsansvarige för de leverantörsavtal och överföringsarrangemang som gäller; för en annan instans, fråga dess operatör. Europeiska kommissionens [standardavtalsklausuler](https://commission.europa.eu/law/law-topic/data-protection/international-dimension-data-protection/standard-contractual-clauses-scc_en) är ett skydd som finns tillgängligt för sådana överföringar; den här sidan påstår inte att ett overifierat leverantörsavtal använder dem.

**Automatiserat beslutsfattande.** Inget. Det förekommer ingen profilering och inget automatiserat beslut med rättsliga eller liknande betydande följder (art. 22).

## Barns integritet

Vanlig lokal appanvändning skickar inget personligt innehåll till lolly.tools. Dess valfria registrering för Content Credentials tar emot en e-postadress och riktar sig inte till eller är avsedd för barn. Organisationstjänster har egna konton och egen datahantering, enligt operatörens policy.

## Dina rättigheter

För poster som bara lagras på din enhet kan du själv få åtkomst till, rätta, radera och flytta data. De finns i webbläsarens eller appens lagring, i en form du kan granska, exportera (**Export my data**, ovan) eller radera (**Clear all my data**, eller webbläsarens webbplatsdata).

Formellt har du enligt GDPR artiklarna 15-22 rätt till **tillgång** till dina personuppgifter, till **rättelse**, till **radering**, till **begränsning** av eller **invändning mot** behandlingen (inklusive allt vi grundar på berättigade intressen), till **dataportabilitet** och, där behandlingen vilar på samtycke, att **när som helst återkalla samtycket**, utan att det påverkar lagligheten av det som skedde innan du återkallade det.

Den publika certifikattjänsten för ingen utfärdningslogg. Infrastrukturloggar kan innehålla förfrågningsuppgifter, så den här policyn lovar inte att värdmiljön inte håller några personuppgifter. Kontakta den personuppgiftsansvarige för tillgång, radering eller en annan begäran om de posterna; vi förklarar vilka poster som finns och vad som kan göras. För arbete, identiteter, telemetri och granskningsposter som en organisation håller, kontakta din Lolly Work-operatör, eftersom lokala export- och raderingskontroller inte når de kopiorna.

**Du har rätt att klaga.** Om du anser att vi har hanterat dina data felaktigt kan du lämna in ett klagomål till en tillsynsmyndighet för dataskydd: i EU myndigheten i det land där du bor, arbetar eller där du anser att överträdelsen skedde (art. 77). Vår ansvariga tillsynsmyndighet är *Bayerisches Landesamt für Datenschutzaufsicht* (BayLDA) i Ansbach, Tyskland. Du behöver inte kontakta oss först, även om vi gärna får chansen att rätta till problemet.

## Ändringar av denna policy

Datumet överst ändras varje gång det här dokumentet ändras. En ändring som förändrar vad som lämnar din enhet eller vad som sparas får en egen rad här i stället för en tyst redigering. För att se vad som ändrats, fråga (nedan) eller jämför mot den [publika källan](https://github.com/lolly-tools/lolly/commits/main/docs/privacy.md).

**29 september 2026:** förtydligade den valfria tjänsten lolly.work, dess innehåll som organisationen håller, autentiseringscookies, användningstelemetri och granskningsposter, samt åtskillnaden mellan lokal radering och serverlagring. Det här är befintliga valfria arbetsflöden, inte ett nytt uppladdningskrav för lokal redigering.

**11 oktober 2026:** ersatte beskrivningen av den utfasade Vercel-hostingen med UpCloud-förteckningen över applikationens värdnamn, skilde valfria identitets- och tillgångsleverantörer åt, och beskrev innehållsadresserad leverans och läget med hållna MCP-nedladdningar. Inget CDN från tredje part aktiveras av den här ändringen. Loggtiden styrs av administratören i stället för av en angiven standard i en Vercel-plan.

**22 oktober 2026:** rättade beskrivningen av befintligt beteende. Avsnittet om webbläsartillägget täcker nu godkännandefönstret för varje förfrågan, webbplatsåtkomst som begärs för en webbplats i taget samt hämtningarna av formatmallar och ikoner när en webbplats läses. Rättades också: raderna Skicka till Google Drive och Meeting Planner, SEAL-notisen (ingen Lolly-app slår upp SEAL-nycklar i DNS), standardnivån för användningstelemetri i organisationstjänsten, MCP-bildverktygen och applikationsloggningen i de publika tjänsterna. Själva programvaran ändrades inte.

**23 oktober 2026:** omorganiserade policyn efter vad som startar varje förfrågan, och beskrev befintligt beteende som den inte täckte tidigare: privata collab-inbjudningar som bär lokala nätverksadresser, Nearby i datorappen, Allow AI control, att läsa ett designsystem från en webbplats, emojiuppsättningar, Meeting Planners cache på enheten av stadsuppslag, Papperskorgen och de andra posterna som Settings → Storage listar. Rättade två påståenden: Bluesky och Discord är inte bara för datorn, och varje värd som en person väljer för sändning kräver operatörens godkännande i både webb- och datorapparna; hastighetsbegränsningens digest av en IP-adress är pseudonym, inte anonym. Själva programvaran ändrades inte.

## Vem som ansvarar, och hur du når oss

**Personuppgiftsansvarig** för lolly.tools är:

> SUSE Software Solutions Germany GmbH
> Frankenstraße 146
> 90461 Nürnberg
> Tyskland

SUSE har utsett ett **dataskyddsombud**, som nås på [privacy@suse.com](mailto:privacy@suse.com). Använd den adressen för alla formella begäranden enligt "Dina rättigheter" ovan.

För allt som rör Lolly självt, som hur det fungerar, varför något är som det är eller en rättelse av det här dokumentet, kontakta **Andy Fitzsimon**, [fitzy@suse.com](mailto:fitzy@suse.com).

För en egen driftad Lolly-instans eller en företagsinstans, kontakta i stället den som driver den: operatören är personuppgiftsansvarig för sin egen installation. SUSE och Lollys projekt med öppen källkod håller inga data för installationer de inte driver.
