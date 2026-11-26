# Integritetspolicy

*Senast uppdaterad: 10 november 2026*

- <!--i:eti-home--> **Det du skapar i Lolly skapas på din enhet.** Att öppna ett verktyg, skriva, förhandsvisa, exportera och kontrollera en fil sker i appen på din telefon, dator eller i din webbläsare. Du behöver inget konto, och appen sätter inga kakor för något av detta.
- <!--i:eti-globe--> **Det du skapar lämnar din enhet bara när du ber om det.** Att lägga till ett Google Font, skicka en fil till Drive eller Dropbox, slå på Sync, spela radion eller ladda ner en AI-modell som körs på enheten startar var och en en begäran på ditt initiativ. Appen hämtar också sina verktyg och uppdateringar från sin egen adress, och de förfrågningarna innehåller inget du har skapat. [Alla nätverksförfrågningar appen kan göra](#every-network-request-the-app-can-make) listar dem, värd för värd.
- <!--i:eti-cpu--> **Några Lolly-tjänster körs på en server.** Renderingslänkar, bildhämtaren, ändpunkten för AI-agenter och tjänsten för verifierad identitet tar bara emot det du skickar till dem och behåller det inte längre än den här sidan anger.
- <!--i:eti-building--> **Din organisations Lolly Work-instans fungerar annorlunda.** Den lagrar det delade arbete du lägger där och en logg över dina inloggningar och vad du gör där. För de uppgifterna gäller operatörens policy, inte den här.

Om du vill fråga om dina uppgifter eller utöva dina rättigheter, se [Dina rättigheter](#your-rights) och [Vem som är ansvarig](#who-is-responsible-and-how-to-reach-us).

::: figure privacy-where-data-goes
Vart dina uppgifter tar vägen: de stannar på din enhet om du inte startar en begäran, och varje typ av begäran har sin egen destination.
:::

<!--i:eti-clipboard-->
## Vad den här policyn omfattar

Lolly är programvara med öppen källkod som vem som helst kan köra: en motor, appskal för webben, datorn, mobilen och terminalen samt ett webbläsartillägg. Den här policyn har två delar:

- <!--i:code--> **Själva programvaran**: vad den gör och inte gör med dina uppgifter, oavsett var den körs. Det här är en egenskap hos koden och gäller därför varje Lolly-installation, vår eller någon annans.
- <!--i:server--> **lolly.tools**, referensinstallationen som SUSE driver: de val som görs vid driften av dess valfria serverdelar, som vad som loggas, hur länge och av vem.

På en egenhostad Lolly-instans eller en företagsinstans gäller fortfarande programvarans beteende nedan, men det är instansens *operatör*, inte SUSE, som ansvarar för allt på dess servrar: renderingsändpunkten, MCP-servern, certifikattjänsten och Lolly Work-instansen. Be om operatörens egen policy. [Införande & styrning](/info/adoption-governance.html) beskriver vad det innebär att driva Lolly.

<!--i:eti-home-->
## Vad som stannar på din enhet

Lollys webb-, dator- och mobilappar kör hela renderingsmotorn på enheten. När verktygen, tillgångarna och kodarna du använder finns på enheten behövs ingen server för rendering och nedladdning.

**Fristående användning av appen sätter inga kakor.** Organisationsinloggning och den valfria registreringen för verifierad identitet har egna kakor som beskrivs i respektive avsnitt. Appen sparar följande poster på enheten:

- <!--i:sliders--> **Gränssnittsinställningar**: tema, språk, ljudinställningar, tillgänglighetsinställningar, sidofältets storlek och zoomnivå, sorterings- och visningsval samt vilka tips du har sett, i din profilpost och i `localStorage`, så att de är redo innan appen har startat klart.
- <!--i:usercheck--> **Dina profiluppgifter**: namn, e-postadress, telefonnummer, befattning, organisation, stad, land och porträttbild som du anger i **Settings**, i IndexedDB. De fylls i i verktyg som efterfrågar dem och skrivs till en exports provenienspost eller en delad `.lolly`-fil bara när du slår på *Use my details*.
- <!--i:download--> **En offlinecache med verktygskatalogen och förhandsvisningar av tillgångar**, så att galleriet fungerar utan anslutning.
- <!--i:hash--> **Lokala användningsräknare** för statistiken på ditt profilkort, som antal exporter och vilka verktyg: en liten post med begränsad storlek i `localStorage` som vi aldrig läser. De lämnar enheten bara i din egen säkerhetskopia eller Sync-kopia.
- <!--i:folder--> **Ditt eget arbete**: dokument, sparade sessioner och deras historik, uppladdade bilder och typsnitt, filresultat och tidigare versioner samt papperskorgen, som behåller raderade objekt i 30 dagar om du inte tömmer den tidigare. Efter 30 dagar tas ett objekt bort nästa gång du öppnar Projects, om det inte fortfarande används av sparat arbete, vilket en bild eller ett typsnitt kan göra. Dessa lagras i IndexedDB och i webbläsarens privata fillagring (OPFS) på enheten och stannar där om du inte väljer Sync eller delning.
- <!--i:globe--> **Meeting Planners stadsuppslagningar**, i `localStorage`, så att varje stad slås upp en gång.
- <!--i:cpu--> **Nedladdade modeller och fästa verktyg**: AI-modeller som körs på enheten och som du har godkänt att ladda ner samt verktyg som du har fäst för offlineanvändning.
- <!--i:seal--> **Din signeringsidentitet**, när du har registrerat dig: det beständiga nyckelparet som signerar dina Content Credentials och dess certifikat med din verifierade e-postadress, i IndexedDB. Den privata nyckeln lämnar aldrig enheten. Utan registrering skapas varje exports nyckel för just den exporten och kastas sedan; [Verifierad identitet](#verified-identity-a-sign-in-you-start-yourself) förklarar båda fallen.
- <!--i:link--> **Anslutna tjänster**: de inloggningar, applösenord, nycklar och den Sync-lösenfras du väljer att spara, kontoetiketterna som visas bredvid dem samt listan **Links you've shared**, med varje fils namn och länk. De finns aldrig med i en säkerhetskopia eller Sync-kopia; [Filer du skickar](#files-you-send) beskriver varje tjänst.

::: details Andra poster som appen sparar på enheten
- **Dina svar.** Vilka engångsfrågor du har besvarat och hur: att lägga till ett Google Font, den första begäran till varje agent i **Ask an agent**, **Allow pages from any site** och **Allow AI control**. Även vilka meddelanden och hälsningar du har stängt.
- **Senaste aktivitet.** En kort lista med dina senaste nedladdningar, med varje fils namn, verktyg, inställningar och en miniatyrbild, för Dashboard, samt de tillgångar och verktyg du använde senast.
- **En ansluten instans.** Dess adress, ett installations-id för den här enheten, en uppgift om vilka lokala kopior som kom från vilken arbetsyta och en cachad kopia av det som instansen skickar till appen: dess inställningar samt ditt kontos namn, e-postadress, grupper och roll.
- **Arbetsfiler.** Pågående skärminspelningar, ljudförhandsvisningar och videokodningar, i OPFS, samt en fil som en annan app delar till Lolly och som sparas tills appen startar nästa gång.
- **Dokumentationssidorna.** lolly.tools/info sätter inga kakor. De sparar ditt tema, språk och språkordning i `localStorage`, läser appens inställningar Reduce motion och Large text samt, för vägen tillbaka till appen, adressen till den appvy som webbläsarfliken kom från. De sparar en kopia av dokumentationen bara om du laddar ner den för offlineanvändning.
:::

**Settings → Storage** visar hur mycket utrymme Lolly använder på enheten, med ditt arbete, papperskorgen, nedladdade modeller, offlinekopior och cachar listade var för sig. **Clear all my data** där tar bort den lokala kopian, inklusive Lollys service workers och offlinecachar, och stänger först av Sync. Bara en markör sparas som talar om för dina andra öppna Lolly-flikar att rensningen har skett. Det avslutar inte en organisationsinloggning: den kakan tas bort när du loggar ut eller när du rensar webbplatsens data i webbläsaren, vilket också tar bort allt som den här knappen tar bort. Lagring som är strikt nödvändig för tjänsten du har begärt kräver inget samtycke enligt ePrivacy Directive (Art. 5(3)), bara transparens, vilket det här dokumentet och meddelandet i appen ger.

![Avsnittet Storage i Settings på en skärm med telefonbredd: varje kategori av data på enheten namngiven, med knappen Clear all my data bredvid listan](/t/url-shot?url=%2F%23%2Fprofile%3Ffocus%3Dstorage-section&width=430&height=1600&dpi=192&waitMs=2400&css=.welcome-dialog%2C.personalize-nudge%2C.store-selbar%2C.profile-row-value%2C.profile-group-value%2C%23store-hero-num%2C%23store-headroom%7Bdisplay%3Anone%7D&format=svg&waitSelector=%5Bdata-store-group%3Dmove%5D&drive=click%3A%5Bdata-store-group%3Dwork%5D%3Esummary%3Bclick%3A%5Bdata-store-group%3Dcaches%5D%3Esummary&walker=1&cropSelector=%23storage-section&dark=1&filename=pv-storage-clear)

**Export my data** skapar en `lolly-backup`-fil som du behåller och styr över. Den når aldrig våra servrar om du inte själv skickar den någonstans. Se [Dataöverföring](/info/data-transfer.html).

### Verktyg som körs på din enhet

Vissa verktyg, som **Lolly Strip Hidden Data**, **Compress** och andra med märket **Runs on your device**, arbetar med en fil som du tillhandahåller. Filen läses in i minnet, omvandlas på enheten och erbjuds tillbaka som en nedladdning. Den laddas aldrig upp eftersom ingen server ingår i flödet. De här verktygen fungerar offline, och deras utdata har ingen vattenstämpel eller metadata från oss.

**Lolly Rondocode** är det enda undantaget eftersom det skapar nytt ljud från din låt i stället för att omvandla en av dina filer. Varje ljudfil det skriver innehåller Content Credentials som dokumenterar låten och anger eventuell AI-genererad sång. Exportpanelen anger det innan du exporterar, och [Lolly Rondocode-låtar](/info/rondocode.html#files-from-the-rondocode-utility) listar exakt vad som registreras.

**Music generator** skapar också nytt ljud. En WAV eller M4A som du laddar ner därifrån innehåller alltid Content Credentials som anger att Lollys musikgenerator skapade spåret och anger musikens licens, CC BY 4.0, med erkännandet *Musik skapad med Lolly (https://lolly.tools), CC BY 4.0*. En melodi du sparar därifrån registrerar ditt profilnamn som skapare, om din profil har ett namn, Lollys och motorns versioner samt licensen, allt synligt i melodins detaljer i Assets. Namnet stannar i ditt bibliotek: en export som spelar melodin lägger till det bara när *Use my details* är på, och nedladdningen från musikgeneratorn innehåller inget namn. [Vad ett spår registrerar](/info/generated-music.html#what-a-track-records) listar varje post.

![Märket som dessa verktyg har: Runs on your device - inget laddas upp](/t/url-shot?url=%2F%23%2Ftool%2Ftext-helper&width=1440&height=900&dpi=192&waitMs=2400&walker=1&format=svg&cropSelector=%5Bdata-privacy%5D&dark=1&filename=pv-ondevice-badge)

**Prepare for sharing** och **Lolly Compare** arbetar i minnet på enheten och skickar inget till en server, och Prepare lägger inte till något i historik, länkar, säkerhetskopior eller Sync förrän du sparar ett resultat.

<a id="how-prepare-for-sharing-and-compare-handle-your-files"></a>
::: details Så hanterar Prepare for sharing och Lolly Compare dina filer
**Prepare for sharing** håller sina arbetsindata, privata fynd och ersättningstabeller i minnet och kontrollerar inga autentiseringsuppgifter online. Du väljer om du vill kopiera, ladda ner, skicka eller spara ett resultat i ditt bibliotek; ett sparat resultat följer sedan bibliotekets inställningar för säkerhetskopiering och Sync. Receptfiler utelämnar tidigare innehåll och ordagranna mappningar, och sammanfattande rapporter innehåller antal, omfattnings-id:n och filhashar. CLI sparar en privat granskningsfil med originalvärdena bara när det begärs med `--review-file`. När du lämnar en förberedelsevy frigörs dess arbetstillstånd, vilket inte är ett löfte om forensisk radering från webbläsarens eller operativsystemets minne.

Förberedda kopior och slutförda filoperationer delar kontrollerna i Lolly Compare. Borttagna värden är hopfällda från början, och jämförelserapporter utelämnar källnamn, sökvägar och värden om du inte väljer att ta med dem. Filhistoriken sparar kopian, så för att jämföra efter en omladdning måste du välja originalet igen, vilket matchas mot dess registrerade SHA-256. Att välja filen sparar eller laddar inte upp den.
:::

Lolly Strip Hidden Data och Prepare for sharing granskar också DOCX-, PPTX- och XLSX-filer på enheten. I DOCX-filer som stöds kan valda egenskaper tas bort i en ny kopia; annat Office-innehåll kan bara granskas, och privata förhandsvisningar döljs bakom en kontroll för att visa dem.

::: details Vad Office-granskningen läser och tar bort
| Office-format | Paketinnehåll som granskas | Borttagning som stöds |
|---|---|---|
| DOCX | Grundläggande, programspecifika och anpassade egenskaper; kommentarer och författare; markörer för spårade ändringar och förhandsvisningar; dolda textsekvenser; externa relationer; inbäddade objekt | Valda uppgifter om författare, senast sparad av, datum för skapande/ändring/senaste utskrift, titel, ämne, beskrivning, nyckelord, anpassade egenskaper, Company, Manager, Template, hyperlänkbas, programnamn och version samt statistik (total redigeringstid och antal sidor, ord, tecken, rader och stycken) |
| PPTX | Egenskaper; kommentarer och författarposter; talaranteckningar; markörer för dolda bilder; externa relationer; inbäddade objekt och nästlade arbetsböcker som stöds | Ingen |
| XLSX | Egenskaper; kommentarer och anteckningar; markörer för dolda blad, rader och kolumner; definierade namn; externa relationer och anslutningar; delar för externa länkar och pivotcache; inbäddade objekt | Ingen |

**Begränsningar.** Inventeringen granskar inte synlig text, formler, beroenden, renderat utseende eller godtyckliga binärdelar fullständigt. Den stöder upp till 300 paketdelar, 64 MiB totalt deklarerad uppackad storlek, 2 MiB per XML-del och två nästlade nivåer av inbäddade paket; Prepare delar gränserna för antal delar och uppackad storlek över hela jobbet. Avklippt, felaktigt formaterat, krypterat och ostött innehåll rapporteras och behålls. Makroinnehåll identifieras och körs aldrig, äldre binära Office-format och XLSB granskas inte och externa referenser hämtas aldrig.

**Vad DOCX-rensningen behåller.** Rensningen stöder DOCX-paketformatet Transitional med kanoniska delar för grundläggande, anpassade och utökade egenskaper. Från utökade egenskaper kan Company, Manager, Template, HyperlinkBase, Application, AppVersion och statistiken TotalTime, Pages, Words, Characters, CharactersWithSpaces, Lines och Paragraphs tas bort. DocSecurity, rubriker och deltitlar, länkflaggor och andra programegenskaper behålls. När Template tas bort finns eventuella kopplade mallänkar kvar i dokumentinställningarna, där inventeringen rapporterar dem som externa relationer.

Vissa läsare väljer hur de ska rita diagram och ritningar utifrån programnamn och version; LibreOffice visar till exempel ett diagram från en Word 2007-fil annorlunda utan dem. Båda behålls när filen innehåller diagram, bilder, former eller inbäddade objekt, och granskningen listar dem som behållna. En egenskap som ett Word-fält visar (TEMPLATE, EDITTIME, NUMPAGES, NUMWORDS eller NUMCHARS) behålls, och länkfält och relativa externa länkar gör att HyperlinkBase behålls eftersom deras mål tolkas i förhållande till den basadressen.

**Vad som bara kan granskas.** Utökade data för digitala signaturer förhindrar rensning. Signerade, makroaktiverade, krypterade, felaktigt formaterade, omdöpta eller nästlade Office-paket kan bara granskas. Detsamma gäller filer med andra egenskapsberoende Word-fält, som DOCPROPERTY eller AUTHOR, eller med XML-bundna innehållskontroller, eftersom borttagning av en egenskap kan ändra dokumentet när Word uppdaterar bindningarna, och cachad fälttext inte kan visa att nästa rendering ser likadan ut. XML-delar med ovanliga filändelser, relationsmål i Word XML som inte kan granskas säkert, felaktigt deklarerade sidhuvuds- eller sidfotsdelar och SVG-delar som deklarerats som XML med filändelsen `.svg` kan också bara granskas i den här första versionen av rensningen.

**Så kontrollerar rensningen sitt arbete.** Egenskapsdelar, deras deklarationer, orelaterade paketdelar, XML-kommentarer och ZIP-kommentarer behålls. Rensningen tillämpar inventeringens gränser och kontrollerar varje dels integritet före skrivning, och granskar sedan de resulterande egenskaperna igen. Lolly Compare visar de egenskapsskillnader som stöds med värdena hopfällda; det jämför inte synlig text eller renderat utseende. Värden visas i förhandsvisningar på upp till 2048 tecken, så skillnader utanför en förhandsvisning kanske inte syns, och en partiell granskning kan inte fastställa att två filer är lika. CLI-kommandot `prepare --strip-hidden-data` tar bort DOCX-egenskaper som stöds, och ett privat granskningspaket kan välja ut enskilda egenskaper. Om en skyddskontroll för rensningen misslyckas behålls filen och operationen rapporteras som misslyckad.
:::

<!--i:eti-globe-->
## Alla nätverksförfrågningar appen kan göra

De flesta förfrågningar hämtar verktyg, typsnitt eller modeller till din enhet. Send-åtgärder överför filen du valde, Sync överför en säkerhetskopia till lagringen du valde och organisationstjänster överför innehållet eller uppgifterna som behövs för gemensamt arbete. Varje grupp nedan listar vad som lämnar din enhet, när det sker och vad som händer om en operatör blockerar förfrågan. Operatörens konfigurerade identitets- och tillgångsleverantörer kan lägga till destinationer i installationen. [Alla fasta värdar i en tabell](#every-fixed-host-in-one-table) listar de värdar som webbappen kan kontakta.

::: details Saker som hämtas till din enhet
- <!--i:download--> **Verktygskatalogen.** Inget personligt: en begäran om Lollys eget offentliga verktygs- och tillgångsindex till appens egen adress vid start, som sedan cachas offline. Om den blockeras körs appen med sina cachade verktyg och slutar hitta nya.
- <!--i:sparkle--> **Emojiuppsättningar.** Uppsättningen du väljer laddas ner från appens egen adress första gången du använder den. Inget personligt skickas. Lottie-animationer läses på enheten och kontaktar ingen.
- <!--i:document--> **Google Fonts.** Den valda typsnittsfamiljens namn och din IP-adress skickas till Googles typsnittsservrar (`fonts.googleapis.com` för stilmallen, `fonts.gstatic.com` för typsnittsfilen). Det sker bara när du lägger till ett Google Font i Lolly Design System Setup och först efter att du har godkänt det i en dialog som anger exakt detta. Varje familj hämtas en gång och sparas sedan på enheten och används offline. Om det blockeras misslyckas väljaren utan att gå vidare; ladda upp en typsnittsfil i stället.
- <!--i:cpu--> **AI-modeller som körs på enheten.** Inget personligt: en modellfil laddas ner och sparas sedan på enheten. Webbversioner använder appens egen adress som standard; en version kan ange en annan modellvärd, till exempel Lollys versionsvärd `lolli.li` för de paketerade apparna. Värden tar emot förfrågan och din IP-adress, utan konto och utan indata till modellen. Det sker bara när du använder en funktion som behöver en modell (Lolly Verifys djupskanning, bilduppskalning, tal och liknande) eller väljer att ladda ner modeller för offlineanvändning. Om det blockeras väntar den funktionen och allt annat fungerar.
- <!--i:sliders--> **ICC-tryckprofiler.** Inget personligt: en begäran om en profil för standardiserade tryckförhållanden till ICC:s offentliga register (`registry.color.org`, `www.color.org`), bara när du klickar på en ICC-förinställning i tryckprofilhanteraren, en gång per profil. Om det blockeras fungerar inte förinställningarna; använd en egen `.icc`-profil.
- <!--i:globe--> **Internetradio.** Inget personligt: en begäran om en spellista och en ljudström från stationen (`api.somafm.com` och den strömningsserver den pekar på, `*.somafm.com`), bara medan du spelar den valfria radion i ljudspelaren. Om det blockeras fungerar inte radion, men alla andra ljudfunktioner fungerar.
:::

::: details Ett verktyg som behöver aktuella data
- <!--i:globe--> **Meeting Planners stadsuppslagning.** I dag är detta det enda verktyget som hämtar aktuella data. Det ber `geocoding-api.open-meteo.com` omvandla varje stadsnamn (värdstaden och varje teammedlems stad) till koordinater och en tidszon, utan konto, nyckel eller identifierare utöver själva förfrågan. Fältet Host city förklarar detta, och varje svar sparas på enheten så att en stad slås upp en gång. Det körs bara medan verktyget är öppet. Om det blockeras misslyckas uppslagningen och inget annat påverkas.
:::

::: details Filer du skickar
Var och en av dessa skickar bara den enda fil du valde när du trycker på dess Send-knapp, efter en inloggning som du slutför i tjänstens eget fönster. Blueskys applösenord, Discords webhook-adress, Nextclouds applösenord och S3-nycklarna lagras bara på den här enheten, aldrig i en säkerhetskopia, och **Disconnect** raderar dem.

- <!--i:upload--> **Google Drive.** Filen, i valfritt format, skickas till Googles Drive-API (`www.googleapis.com`). Lollys åtkomst är begränsad till filer som det har skapat (behörighetsomfånget `drive.file`), så det kan aldrig läsa resten av din Drive. I webbappen hålls inloggningstoken i minnet under sessionen och lagras aldrig; i de andra apparna lagras en uppdateringstoken på den här enheten bara om du markerar **Stay connected**. Knappen finns bara i versioner där operatören har konfigurerat ett Google-klient-id. Om det blockeras visas knappen aldrig; ladda ner filen och ladda upp den själv. **Delningslänkar.** Om du trycker på **Create a share link** lägger ett andra anrop till `www.googleapis.com` till en behörighet för filen (alla med länken, din Workspace-domän eller adresser du anger, som Google då skickar e-post till) och läser dess länk. **Stop sharing** tar bort behörigheten. Inget annat behövs: behörighetsomfånget `drive.file` täcker redan filer som Lolly har skapat.
- <!--i:upload--> **Dropbox.** Filen skickas till Dropbox API (`api.dropboxapi.com` för inloggning och metadata, `content.dropboxapi.com` för filen). Åtkomsten gäller bara appmappen, så Lolly ser `Apps/` och sin egen mapp där och inget annat. Länken **Open** som visas är en kortlivad privat länk, och ingen offentlig delning skapas. En uppdateringstoken lagras bara om du markerar **Stay connected**. Knappen finns bara med ett Dropbox-klient-id som operatören har konfigurerat. **Delningslänkar.** Först när du trycker på **Create a share link** för första gången ber Dropbox dig godkänna ytterligare en behörighet, `sharing.write`. Lolly anropar sedan `api.dropboxapi.com` för att skapa länken (`sharing/create_shared_link_with_settings`) och, för **Stop sharing**, återkalla den. Att skicka filer kräver aldrig den här behörigheten.
- <!--i:upload--> **OneDrive.** Filen skickas till Microsofts identitets- och Graph-tjänster (`login.microsoftonline.com` för inloggning, `graph.microsoft.com` för uppladdningen); stora filer laddas upp i delar till `api.onedrive.com` eller lagringsursprung som operatören har konfigurerat. Åtkomsten är begränsad till Lollys egen mapp under `Apps/` samt ditt visningsnamn för kontoetiketten. En uppdateringstoken lagras bara om du markerar **Stay connected**. Knappen finns bara med ett Microsoft-klient-id som operatören har konfigurerat. **Delningslänkar.** **Create a share link** anropar `graph.microsoft.com` (`createLink` på filen) med den åtkomst du redan har gett. Om Microsoft nekar det ber Lolly inte om bredare åtkomst: du skickas till filens egen sida i OneDrive för att använda dess Share-knapp. **Stop sharing** tar bort länkens behörighet.
- <!--i:upload--> **LinkedIn**, **bara i datorapparna**. Filen, med sitt namn som inläggstext, skickas till LinkedIn (`www.linkedin.com` för inloggning i din egen webbläsare, `api.linkedin.com` för uppladdningen och inlägget) som ett offentligt inlägg i ditt eget flöde. Lolly kan publicera som du och läsa ditt namn för kontoetiketten, inget annat. Inloggningen sparas bara om du markerar **Stay connected**, och LinkedIns token gäller i 60 dagar och kan inte förnyas i bakgrunden, så inloggningen löper ut av sig själv. De värdarna finns inte i webbappens anslutningspolicy. Knappen finns bara i versioner med en konfigurerad LinkedIn-app.
- <!--i:upload--> **Penpot.** Din personliga åtkomsttoken för Penpot, som du klistrar in i appen, och designens `.penpot`-arkiv skickas till Penpots API (`design.penpot.app`) genom en liten vidarebefordringstjänst på appens egen adress (`/api/penpot`), eftersom Penpots API inte svarar direkt till en webbläsare. Tjänsten vidarebefordrar och glömmer; datorapparna kommunicerar direkt med Penpot. Det sker bara när du trycker på **Send to Penpot** i Design-verktyget och bekräftar ett projekt. Om det blockeras misslyckas sändningen utan att gå vidare; exportera `.penpot`-filen och importera den själv.
- <!--i:upload--> **Bluesky.** Bilden, dess namn som inläggstext och alt-text samt ditt användarnamn och applösenord (skapat under Bluesky → Settings → App passwords, aldrig ditt kontolösenord) skickas till den Bluesky-server du anger, `bsky.social` om du inte väljer en annan. Du ansluter först kontot i **Settings → Connected services**.
- <!--i:upload--> **Discord.** Filen skickas som bilaga till den webhook-adress för kanalen som du klistrade in, på discord.com. Alla som har en webhook-adress kan skriva i den kanalen, vilket är anledningen till att den stannar på enheten.
- <!--i:upload--> **Mastodon.** Filen, med sitt namn som inläggstext, skickas till den Mastodon-server eller kompatibla server du anger, efter en inloggning i serverns eget fönster. Anslutningen registrerar en liten app för den här enheten på servern, och inloggningen sparas bara om du markerar **Stay connected**.
- <!--i:upload--> **Nextcloud eller WebDAV.** Filen skickas till din egen server i en enda autentiserad uppladdning, med serveradressen, användarnamnet och applösenordet du angav (Nextcloud → Settings → Security → Devices & sessions; aldrig ditt kontolösenord). **Delningslänkar.** **Create a share link** gör ett anrop till din egen servers delningstjänst (`/ocs/v2.php/apps/files_sharing/api/v1/shares`) med samma applösenord, för en offentlig skrivskyddad länk med det lösenord och utgångsdatum du väljer. **Stop sharing** tar bort delningen.
- <!--i:upload--> **S3-kompatibel lagring.** Filen skickas till din egen bucket (AWS S3, MinIO, R2, B2, Garage eller valfri SigV4-ändpunkt), signerad på enheten med nyckelparet du angav. **Delningslänkar.** En länk är en försignerad adress som skapas på din enhet från dina sparade nycklar, så inget skickas när den skapas. Den gäller i högst sju dagar och kan inte stängas av tidigare.

**Värdar som du väljer kräver operatörens godkännande.** Värdarna för Bluesky, Discord, Mastodon, Nextcloud och S3 finns inte i Lollys fasta lista eftersom du väljer dem. Appen skickar inget till en sådan värd förrän operatören har godkänt just den HTTPS-värden: på webben i installationens Content Security Policy; i datorapparna när appen byggs. Detsamma gäller anpassade uppladdningsvärdar för lagring och SharePoint. På webben måste servern också tillåta webbläsaranrop från appen (CORS), och en omdirigering stoppas, så använd en adress som inte omdirigerar. Datorapparna kontrollerar varje omdirigering mot listan över godkända värdar.

Listan begränsar vilka värdar appen kan nå. Den skiljer inte mellan konton eller klientorganisationer hos Google eller Microsoft, och leverantörens egna behörigheter avgör vilka konton och åtgärder som tillåts. Den omfattar inte heller inloggningsfönster, andra resurstyper eller inbyggda funktioner, som har egna regler. En ändring kräver en ny datorversion eller nya svarshuvuden för webben; spara ditt arbete innan du öppnar appen igen för att få ändringen. [Anslutningarnas ursprung](/info/connector-origins.html) beskriver konfigurationen.
:::

::: details Sync mellan dina enheter
- <!--i:folder--> **Vad som lämnar enheten.** En kopia av det du har skapat på den här enheten (sparade sessioner och projekt, dina designsystem med typsnitt och logotyper, uppladdade bilder, din profil och dina inställningar) som en enda fil, till den enda lagring du valde: Lolly-appmappen i din Dropbox (`api.dropboxapi.com`, `content.dropboxapi.com`), filer som Lolly har skapat i din Google Drive (`www.googleapis.com`), Lolly-appmappen i din OneDrive (`graph.microsoft.com`, med större filer uppladdade till `api.onedrive.com` eller lagringsursprung som operatören har konfigurerat och nedladdningar från de exakta lagringsursprung operatören har konfigurerat) eller din egen Nextcloud, WebDAV-server eller S3-bucket. Samma lagring behåller upp till sju dagliga kopior och en kopia från före den senaste tillämpningen.
- <!--i:shieldcheck--> **Inget skickas till Lolly.** Ingen Lolly-server, relätjänst eller Lolly Work-server ingår i flödet, och apparna behöver ingen Lolly-webbplats för det, inte ens för att logga in. Kopian krypteras först på enheten bara om du anger en lösenfras. Inloggningar, nycklar, applösenord, lösenfrasen och Sync-inställningarna stannar på enheten och finns aldrig med i kopian. På webben sparar en ihågkommen Google Drive-anslutning bara en kontoetikett, vanligen e-postadressen för ditt Google-konto, dess behörighet och när du anslöt (och ditt eget klient-id om du angav ett). Ingen åtkomsttoken lagras, och Google-inloggningen varar ett besök. I Android-appen sker Google Drive-inloggningen via Google Play services på telefonen, som Google driver.
- <!--i:sliders--> **När.** Bara efter att du slår på **Sync across my devices** eller trycker på **Sync now**: en uppladdning kort efter varje ändring och när du lämnar appen samt en kontroll efter en nyare kopia när appen startar. Om det blockeras misslyckas Sync och talar om varför, och ditt arbete stannar på enheten. Du kan exportera dina uppgifter till en fil och flytta den själv i stället. [Synka dina enheter](/info/sync.html) beskriver funktionen.
:::

::: details Webbsidor, skärmbilder och bilder från andra webbplatser
- <!--i:monitor--> **En URL som du ber ett verktyg att ta en bild av.** URL-skärmbildsverktyget begär exakt den adress du skriver, bara när du startar bildtagningen. Eftersom du väljer adressen i det ögonblicket finns den inte i anslutningspolicyn, och en operatör kan inte tillåta eller blockera den per värd; för att ta bort den måste verktyget tas bort.
- <!--i:globe--> **En webbsida i en Lolly Design-ruta.** Sidan begärs, med din IP-adress, från webbplatsen den kommer från, tillsammans med allt som sidan själv begär. Där webbläsaren stöder det skickas inga kakor till ramen och ingen adress utöver appens eget ursprung, så ditt dokument och dess länk följer aldrig med förfrågan. I webbappen kan bara dessa spelare bäddas in i ramar: `www.youtube-nocookie.com`, `player.vimeo.com`, `www.loom.com`, `www.google.com` (kartor) och `www.figma.com`, samt referenssidor på `wikipedia.org` och `*.wikipedia.org`, `commons.wikimedia.org`, `upload.wikimedia.org`, `www.wikidata.org`, `www.mediawiki.org` och `www.openstreetmap.org`. **Allow pages from any site**, under **Settings → Trusted sites**, laddar om Lolly på din enhet med en policy som kan bädda in alla `https:`-sidor, och samma regler för tillit och godkännande gäller fortfarande. En sida laddas bara för en webbplats i din Trusted sites-lista, inklusive de förvalda referenswebbplatser som kan tas bort, eller efter att du har godkänt rutan i dess Inspector; en presentation som någon har skickat visar tills dess en bild av varje sida. Innan du presenterar erbjuder listan **Just this time** och **Always trust** för varje webbplats, och inget efterfrågas medan du presenterar. Om det blockeras visar rutan sin bild med en länk som öppnar sidan i en ny flik. Lolly-verktyg och Lolly Sandbox-demonstrationer i en ruta körs på appens egen adress och kontaktar ingen.
- <!--i:sliders--> **Ändra en sida du visar.** Åtgärden **Use page** i en webbsideruta låter dig avvisa kakor eller stänga en banderoll på sidan. För Lolly-sidor som går att komma åt döljer **Hide cookie banners** kända överlägg, inklusive OneTrust, utan att acceptera kakor eller ändra webbplatsens samtyckesval. **Page CSS** ändrar rutans levande sida och presentation; exporter använder fortfarande den valda förhandsbilden. Reglerna kan inte importera resurser eller typsnitt, och webbläsare hindrar Lolly från att ändra en annan webbplats CSS. Lolly Sandbox-förhandsvisningar har en egen CSS-redigerare under **Edit in Sandbox**.
- <!--i:code--> **En Lolly Sandbox-demonstrations webbresurser.** Varje stilmall, skript, typsnitt eller bild som demonstrationens kod länkar till begärs, med din IP-adress och utan kakor, från webbplatsen som lagrar den; filer som en hämtad stilmall anger, till exempel Google Fonts typsnittsfiler, räknas som separata webbplatser. Det sker bara efter att du klickar på **Fetch & inline** eller för en webbplats i din Trusted sites-lista; **Always trust** bredvid en fil lägger till dess webbplats i listan. Om det blockeras körs demonstrationen utan de filerna, och Lolly Sandbox listar varje fil som inte kunde hämtas och varför.
- <!--i:download--> **Lägg till en bild från en URL.** **Add from URL** i tillgångsväljaren eller Assets begär exakt den bildadress du klistrar in. Webbappens egen policy hindrar webbläsaren från att hämta direkt från en annan webbplats, så en liten vidarebefordringstjänst på appens egen adress (`/api/fetch-image`) hämtar bilden och lämnar tillbaka bara byten; den lagrar inget, glömmer adressen och avvisar allt som inte är en offentlig bildadress. Datorapparna hämtar adressen direkt. En Lolly-länk som du klistrar in hämtas inte alls: den renderas på enheten. Om operatören stänger av vidarebefordringstjänsten (`LOLLY_DISABLE_IMAGE_PROXY=1`) kan bara Lolly-länkar, `data:`-bilder och bilder från samma ursprung läggas till i webbappen, och datorapparna påverkas inte.
- <!--i:palette--> **Ett designsystem från en webbplats.** Lolly Design System Setup kan läsa en sida på en webbplats du anger, genom [webbläsartillägget](#the-browser-extension) eller datorappens egen hämtning, aldrig genom en Lolly-server. Inget hämtas innan du trycker, och länkar på sidan följs inte.
:::

::: details Arbeta med andra personer och agenter
- <!--i:link--> **En privat collab.** Två enheter ansluter direkt till varandra, utan någon server emellan. Inbjudan och svaret innehåller de adresser som varje enhet kan se på sitt eget nätverk, och den här versionen konfigurerar ingen extern server för adressupptäckt, så ge dem bara till den du arbetar med. Se [Arbeta tillsammans](/info/collaborate.html).
- <!--i:monitor--> **Nearby**, i datorappen. Medan du är synlig, vilket är tio minuter när du startar en collab-inbjudan eller, om du slår på det, så länge appen körs, annonserar appen ett slumpmässigt namn, det visningsnamn du valde och enhetstypen på det lokala nätverket. Den annonserar ingen e-postadress, inget konto och ingen beständig identifierare.
- <!--i:link--> **Invite an agent.** Tillståndet för dokumentet som inbjudan gäller, förhandsvisningarna som agenten begär, agentens identitet och dess ändringar passerar genom den konfigurerade realtidsrelätjänsten (`lolly.ing` på lolly.tools) till agenten du bjuder in. Ett installerat hostat plugin vidarebefordrar också anrop genom lolly.tools-anslutningen till relätjänsten som inbjudan väljer; anslutningen sparar ingen inbjudan eller något dokument mellan anropen. Relätjänsten håller inbjudningar och väntande förfrågningar i minnet tills du kopplar från eller de löper ut: tio minuter för en oanvänd inbjudan och trettio minuter utan aktivitet för en som har använts för anslutning. Din agents leverantör hanterar de uppgifter den tar emot enligt sin egen policy. Det sker bara efter att du har skapat en inbjudan i Share och gett instruktionerna till din agent; läsåtkomst tillåter granskning och redigeringsåtkomst tillåter även ändringar. Pause stoppar ändringar, och Disconnect eller återkallad inbjudan avslutar åtkomsten. Om det blockeras kan agenten inte ansluta eller fortsätta, och du kan fortsätta redigera.
- <!--i:cpu--> **Allow AI control**, i datorappen. En agent som körs på den här datorn kan läsa och redigera det öppna Lolly Design-dokumentet genom en anslutning som stannar på datorn. Funktionen är avstängd tills du slår på den. Lolly skickar inget till en server för detta; agentens leverantör hanterar det agenten läser enligt sin egen policy. [Hotmodell & tillitsgränser](/info/threat-model.html) listar vad en sådan agent kan och inte kan göra.
- <!--i:cpu--> **Ask an agent**, i datorappen. När du öppnar **Ask an agent** i Lolly Design letar appen på den här datorn efter fyra kommandoradsverktyg för agenter (Claude Code, Codex, Gemini CLI och GitHub Copilot CLI), sju appar (Claude, ChatGPT, Codex, Cursor, Visual Studio Code, LM Studio och Ollama) och Ollama- och LM Studio-servrarna på `127.0.0.1`. Den kör varje verktygs versions- och hjälpkommandon (och Codex funktionslista), läser appnamn och versioner från apppaketen och frågar de två lokala servrarna vilka modeller de har. Den läser ingen fil med inloggnings- eller autentiseringsuppgifter, resultatet stannar i appens minne och inget om det skickas någonstans. När du frågar en agent skickas din begäran och det öppna dokumentet, utan uppladdade bilder, till agentens leverantör (Anthropic för Claude Code, OpenAI för Codex) under det konto som verktyget är inloggat med, och ditt abonnemang hos leverantören betalar. Ingen Lolly-server ingår i flödet. Före den första begäran till varje agent visar panelen detta och frågar en gång, och ditt svar sparas i `localStorage` på den här enheten. Agenten körs utan verktyg i en tom tillfällig mapp, med bara de miljövariabler den behöver för att hitta sin egen inloggning, så API-nycklar som är satta i miljön lämnas kvar. På en hanterad instans kan organisationens policy stänga av detta, och då varken letar appen efter agenter eller startar någon.
- <!--i:server--> **En fjärrinstans.** När du riktar appen mot en annan Lolly-installation tar den emot det som instansen skickar tillbaka genom samma katalogsynkronisering, och förfrågningar till instansen får en versionstagg (apptyp och motorversion, samma information som en användaragent innehåller), så att operatören kan se vilka Lolly-versioner som används. På en hanterad instans innehåller taggen också ett installations-id för den här enheten medan du är inloggad, så att operatörens enhetslista kan skilja installationer åt; när du lämnar tas id:t bort, och en enhet som ansluter igen senare visar ett nytt. Du väljer värden, så den finns inte i anslutningspolicyn. Om det blockeras misslyckas bytet och din lokala instans påverkas inte.
- <!--i:people--> **Din organisations Lolly Work-instans.** Inloggningsidentitet och enhetsinformation, policyförfrågningar, de delade sessioner, samarbetsändringar, uppladdningar, material för godkännande, varumärkessidor du publicerar och leveransfiler du använder skickas till din organisations instans, med inloggning genom dess identitetsleverantör. Policyuppdateringar kan köras under användning; delat arbete, collabs, granskning och leverans skickar innehåll som en del av dessa arbetsflöden. Lollys egna appar skickar inga användningshändelser till instansen. Om det blockeras kan dessa organisationsfunktioner inte slutföras, och ditt personliga arbete hålls separat. Se [Organisationstjänster med Lolly Work](#organisation-services-with-lolly-work).
:::

### Alla fasta värdar i en tabell

Webbappens Content Security Policy hindrar ett skript från att nå en värd som inte finns med i policyn. Utöver appens egen adress anger tabellen varje värd som policyn listar samt de två LinkedIn-värdar som datorapparna lägger till, markerade som enbart för datorapparna. Ett CI-test kontrollerar tabellen mot den driftsatta policyn, så en värd kan inte läggas till i den ena utan att läggas till i den andra.

| Vad | Vad som faktiskt lämnar din enhet | Värdar |
|---|---|---|
| Modeller som körs på enheten i de paketerade apparna och versionsfiler | En begäran om en offentlig fil, med din IP-adress | `lolli.li` |
| Google Fonts | Typsnittsfamiljens namn och din IP-adress | `fonts.googleapis.com`, `fonts.gstatic.com` |
| Skicka till och synka med Google Drive | Filen eller säkerhetskopian du valde och delningsbehörigheten när du begär en delningslänk | `www.googleapis.com` |
| Skicka till och synka med Dropbox | Filen eller säkerhetskopian du valde och länkinställningarna när du begär en delningslänk | `api.dropboxapi.com`, `content.dropboxapi.com` |
| Skicka till och synka med OneDrive | Filen eller säkerhetskopian du valde, ditt visningsnamn för kontoetiketten och länkförfrågan när du begär en delningslänk | `login.microsoftonline.com`, `graph.microsoft.com`, `api.onedrive.com` |
| Meeting Planners stadsuppslagning | Varje stadsnamn | `geocoding-api.open-meteo.com` |
| ICC-tryckprofiler | En begäran om en offentlig profil | `registry.color.org`, `www.color.org` |
| Internetradio | En begäran om en spellista och en ljudström | `api.somafm.com`, `*.somafm.com` |
| Invite an agent och arbetsytan lolly.ing | Tillståndet, förhandsvisningarna och ändringarna för dokumentet som inbjudan gäller samt de arbetsyteförfrågningar du gör | `lolly.ing` |
| Spelare i en Lolly Design-webbruta | En begäran om sidan, med din IP-adress | `www.youtube-nocookie.com`, `player.vimeo.com`, `www.loom.com`, `www.google.com`, `www.figma.com` |
| Referenssidor i en Lolly Design-webbruta | En begäran om sidan, med din IP-adress | `wikipedia.org`, `*.wikipedia.org`, `commons.wikimedia.org`, `upload.wikimedia.org`, `www.wikidata.org`, `www.mediawiki.org`, `www.openstreetmap.org` |
| Skicka till LinkedIn, bara i datorapparna | Filen, med sitt namn som ett offentligt inlägg | `www.linkedin.com`, `api.linkedin.com` |

Datorapparnas egen lista innehåller också Googles tokenändpunkt för Drive-inloggningen. Alla andra värdar, som en Mastodon- eller Nextcloud-server du anger, kräver operatörens godkännande enligt beskrivningen under Filer du skickar. Värdar som du väljer vid användningstillfället, som en URL du tar en bild av eller en fjärrinstans du anger, finns inte i någon lista.


**SEAL-signaturer gör ingen förfrågan.** Lolly Verify kan kontrollera SEAL-signaturer, ett system vars signeringsnyckel kan publiceras i DNS. Webbläsare kan inte göra DNS-frågor, så en webbuppslagning skulle behöva gå genom en DNS-over-HTTPS-resolver från tredje part som skulle se domänen som kontrolleras och din IP-adress. Lolly använde tidigare Cloudflares resolver; det gör det inte längre, och inget har ersatt Cloudflare. Ingen Lolly-app slår upp SEAL-nycklar i dag: dator- och mobilapparna kör samma Verify-vy, och kommandoradsverktyget `lolly validate` kontrollerar inte SEAL. En fil vars SEAL-post innehåller sin nyckel direkt kontrolleras offline, och Lolly Verify kallar signaturen internt konsekvent utan att bekräfta domänen. En fil vars nyckel bara finns i DNS visar **SEAL signature did not verify**, med orsaken "ingen nyckelresolver och ingen inbäddad nyckel".

![Lolly Verify-skärmen: en släppyta och inget annat - filen kontrolleras där den redan finns, utan uppladdning och utan konto](/t/url-shot?url=%2F%23%2Fverify&width=1440&height=900&dpi=192&waitMs=1400&walker=1&format=svg&cropSelector=.valid-layout&dark=1&filename=cc-verify-drop)

Du kan själv kontrollera detta och alla andra påståenden på den här sidan: [Verifiera själv](/info/verify-yourself.html) anger kommandona och vilka utdata du kan förvänta dig.

<!--i:eti-cpu-->
## Tjänster som lolly.tools driver

Dessa körs på lolly.tools för alla. Var och en tar bara emot det du skickar. [Serverns gränssnitt](/info/server-surface.html) beskriver samma komponenter så som de fungerar i alla installationer.

### Renderingslänkar

Varje `https://lolly.tools/tool/<tool-id>.<ext>?<inputs>`-URL renderar på riktigt, och dess indata följer med i URL:en, så en delad Lolly-länk kan visas som en levande bild i en README, en wiki eller en kontrollpanel. När en sådan hämtas ombeds servern rendera **offentliga verktygs- och katalogdata** med de indata som är skrivna i adressen.

- <!--i:usercheck--> **Inga konton, inga kakor, inget tillstånd.** Rutten kräver ingen inloggning, och inget på din enhet läses. Dina dokument, sessioner och uppladdningar lämnar aldrig din webbläsare och kan inte förekomma i dessa länkar.
- <!--i:document--> **Själva URL:en registreras.** En URL:s frågesträng ingår i förfrågan, så den visas i värdplattformens vanliga åtkomstloggar precis som alla begärda sökvägar. Om en länks indata innehåller någons namn eller e-postadress, som en namnskylt eller e-postsignatur kan göra, **finns den texten i loggarna**. Ge en renderingslänk bara sådant som du skulle lägga på en offentlig sida.
- <!--i:globe--> **Indata är ändå offentliga.** De är det som länkens upphovsperson skrev in i URL:en, läsbara för alla som får länken. För känsligt innehåll erbjuder Lolly länkkryptering.
- <!--i:eyeoff--> **Cachat, begränsat och inte indexerat.** Svaren cachas och hastighetsbegränsas som alla offentliga bilder och märks med `noindex` så att sökmotorer utelämnar dina renderingar.

En egenhostad installation som inte vill ha någon offentlig renderingsrutt sätter `LOLLY_DISABLE_RENDER_GET=1`, och var och en av dessa URL:er returnerar 404.

### Bildhämtaren och vidarebefordringstjänsten för Penpot

**Add from URL** i webbappen och **Send to Penpot** använder två små vidarebefordringstjänster på lolly.tools, beskrivna under [Alla nätverksförfrågningar appen kan göra](#every-network-request-the-app-can-make). Bildhämtaren behåller inget och glömmer adressen. Vidarebefordringstjänsten för Penpot skickar din token och ditt arkiv vidare till Penpot och behåller inget av dem; den loggar kommandonamnet och Penpots svarsstatus.

### MCP-servern för AI-agenter

En AI-agent kan nå Lolly via Model Context Protocol genom en ändpunkt som en operatör driver. lolly.tools driver en, och vem som helst kan köra en egen, även helt offline.

- <!--i:cpu--> **Filer som en agent skickar.** Verktygen som tar emot en fil (`lolly_transform`, `lolly_verify`, `lolly_redact`, `lolly_read`, `lolly_check`, `lolly_package`, `lolly_compose`, `lolly_rebrand` och bildverktygen `lolly_look`, `lolly_sample_color` och `lolly_trace_edges`) bearbetar den i minnet och returnerar resultatet i samma anrop. Filen skrivs aldrig till disk och behålls inte när förfrågan är slutförd. `lolly_inspect` tar också emot en fil, och dess kontroller för video och tryckproduktion skriver en tillfällig arbetskopia som raderas när anropet returnerar. Alla andra verktyg arbetar med parametrarna i anropet: text, tal, färger, URL:er, tillgångs-id:n från katalogen eller ett dokument som anroparen tillhandahåller.
- <!--i:cpu--> **Lolly Rebrand anger vart en presentation skickas.** Det första steget i `lolly_rebrand`, `capabilities`, beskriver med ord vart dina byte skulle skickas innan du skickar några: på en egenhostad lokal server lämnar presentationen aldrig den datorn, och på en hostad server skickas presentationen dit när du anropar `lolly_rebrand`, upp till de gränser för storlek och antal presentationsbilder som steget anger.
- <!--i:lock--> **Den öppna ändpunkten.** På lolly.tools är `lolly.tools/api/mcp` öppen för alla utan token. Anrop begränsas per adress och av en daglig budget. Adressen omvandlas till ett pseudonymt hashvärde i lagringen för missbruksskydd, precis som för inloggningsändpunkterna nedan, och budgeten räknar bara CPU-tid och skickade byte, utan adress. En begränsad ändpunkts bearer-token skrivs aldrig till en logg eller en renderings-URL.
- <!--i:link--> **Nedladdningslänkar för stora resultat.** lolly.tools returnerar resultaten direkt i svaret och utfärdar aldrig sådana länkar. En operatör kan slå på dem för sin egen autentiserade gateway, där ett resultat hålls kvar i högst fem minuter och bara anroparens egen bearer-token kan hämta det; se [MCP-server](/info/mcp.html#private-download-links-for-large-results). En planerad begränsad ändpunkt på `mcp.lolly.tools` skulle ta emot en bearer-token som operatören utfärdar till betrodda klienter, eller OAuth 2.1 med kortlivade signerade token som kontrolleras mot en delad hemlighet; aktiveringen återstår, och den listas under [Leveransvärdar och personuppgiftsbiträden](#delivery-hosts-and-processors).

### Verifierad identitet: en inloggning som du startar själv

Lolly kan försegla en **Content Credential** i dina exporter, så att vem som helst kan kontrollera offline att en fil är oförändrad sedan den lämnade Lolly. Den delen är **på som standard och helt lokal**: signeringsnyckeln skapas på din enhet och signeringen sker offline. Utan registrering är nyckeln tillfällig, ett nytt nyckelpar som skapas för varje export och kastas efteråt. När du har registrerat dig är nyckeln beständig och genereras **så att den inte kan extraheras**, så inte ens Lollys egen kod kan läsa den, bara be den signera. I båda fallen lämnar den aldrig din enhet.

[Exportera](/info/exporting.html#content-credentials-c2pa) listar vad ett intyg registrerar: verktyget, tidpunkten, den övergripande exportmiljön, ditt namn bara när du har slagit på *Use my details*, de källangivna verk som en export placerar, varje Lolly Rondocode-låt som en video- eller ljudexport spelar (dess namn, en hash av källan och hur Lollys sandlåda renderade låten) och varje sparad melodi som en sådan export spelar (dess namn, en hash av receptet, motorversionen och licensen när melodin har en registrerad sådan). En sparad melodis skapare, namnet som melodin sparades med, läggs till bara när *Use my details* är på, så när den omkopplaren är av lämnar inget namn din enhet på det här sättet heller. Exportpanelen listar låtarna och melodierna innan du exporterar och visar en melodis skapare bara när namnet kommer att skrivas.

Intyget och filens metadata registrerar också det [designsystem och den färgvariant](/info/exporting.html#the-design-system-record) som ritade exporten: designsystemets id och namn, dess publicerade version och färgvarianten. Ett designsystems namn är text som dess ägare har skrivit och kan vara en kunds namn, så exportpanelens kort **Design system** visar de exakta orden innan du exporterar. Avmarkera kortet eller ange `_madewith=0` eller `--no-madewith` för att utelämna dem.

Ett designsystems utgivare kan också välja att registrera adressen till dess [varumärkessida](/info/brand-page.html#lead-back-from-your-files) i samma post. Adressen är det enda tillägget. Inställningen är av tills utgivaren slår på den och följer inte med ett paket eller en kopia, och samma kort visar adressen och låter dig utelämna den. Att läsa in en fil igen laddar aldrig den adressen: Lolly Verify visar värden, och du väljer om du vill öppna sidan.

En fil som har godkänts genom en organisations Lolly Work kan också innehålla en signerad godkännandepost: godkännandets id, beslutsdatum och hashvärdet för den granskade filen, utan namn, e-postadresser, grupper, kommentarer eller kedjenamn. Den som begär granskningen ser detta som en markerad ruta och kan avmarkera den, och en organisation kan stänga av registreringen.

En fil som skapas från en [avsikt](/info/visual-intent.html#what-goes-in-the-file) registrerar också vad den ombads göra: syfte, yta, verktyg, språk och ett hashvärde för begäran. Tillfälle, målgrupp, region och eventuell prompt är bara fingeravtryck. Promptens egna ord tas med bara när personen eller agenten som kör renderingen begär det, och körningen anger det, eftersom alla som får filen kan läsa dem. Posten kan utelämnas, och ingen annan export innehåller en sådan.

Det enda *valfria* steget utöver detta är att registrera en verifierad identitet, så att dina exporter säger "Verifierad - signerad av \<your email\>" i stället för att ange en anonym nyckel. **Om du hoppar över registreringen får certifikattjänsten inga registreringsuppgifter från dig.**

![Kortet Verified identity i Settings, med telefonbredd: väljaren för certifikatets giltighetstid och registreringssteget under den, vilande tills du startar det själv](/t/url-shot?url=%2F%23%2Fsettings%3Ffocus%3Didentity-section&width=430&height=1600&dpi=192&waitMs=2400&css=.welcome-dialog%2C.personalize-nudge%7Bdisplay%3Anone%7D&format=svg&walker=1&cropSelector=%23identity-section&dark=1&filename=pv-identity-enrol)

Om du registrerar dig är det här exakt vad som händer:

::: timeline
- <!--i:usercheck--> **Du väljer en inloggningsmetod**: GitHub, Google, SUSE (id.suse.com) eller en länk via e-post. För de tre OIDC-leverantörerna går du till leverantörens egen inloggningssida, enligt dess integritetspolicy, inte vår, och certifikattjänsten får bara tillbaka en verifierad e-postadress och leverantörens namn. För e-postlänken skickas adressen du skriver till **Resend**, en tjänst för transaktionsmejl, enbart för att leverera den enda länken.
- <!--i:lock--> **En kortlivad kaka skyddar omdirigeringen.** Certifikattjänsten sätter `lolly_ca_state`, `HttpOnly`, begränsad till `/api/ca` och med en giltighetstid på högst tio minuter. Den innehåller ett slumpmässigt värde i stället för en spårningsidentifierare, finns bara för att hindra att inloggningens omdirigering förfalskas och rensas så snart inloggningen är klar.
- <!--i:eyeoff--> **Din IP-adress används kortvarigt för att förhindra missbruk** av inloggningsändpunkterna, så att ett skript inte kan överösa en inkorg eller förbruka e-postkvoten. Lolly omvandlar den till ett SHA-256-hashvärde innan den når den kortlivade lagringen för missbruksskydd, så den ursprungliga adressen skickas inte dit. Hashvärdet är pseudonymt, inte anonymt: den som har tillgång till lagringen skulle kunna återskapa en IPv4-adress genom att prova alla möjliga adresser. Posten löper ut efter ungefär en minut och används inte till något annat. Vanliga åtkomstloggar hos värdtjänsten är separata och beskrivs nedan.
- <!--i:seal--> **Tjänsten utfärdar ett certifikat** som binder din verifierade e-postadress till enhetens offentliga nyckel. Den privata nyckeln stannar på enheten: klienten skickar en certifikatbegäran med ett bundet innehavsbevis, och ingen privat enhetsnyckel skickas till något av utfärdarlägena.
- <!--i:check--> **Signeringen förblir lokal.** Med den äldre utfärdaren kräver en export ingen förfrågan till certifikattjänsten. En hanterad identitet behöver också en aktuell, signerad spärrlista från sin utfärdare; klienten kan använda en cachad lista inom sitt konfigurerade aktualitetsfönster, och en uppdatering av den kan kontakta certifikattjänsten under en export. Saknad, utgången eller ogiltig status hindrar den hanterade identiteten från att användas.
:::

::: details Lagringstid och återkallande i respektive utfärdarläge
**Äldre hostad utfärdning** erbjuder 7, 30, 90 eller 365 dagar, med en gräns som operatören sätter. Den behåller inget identitetsregister och ingen utfärdandelogg, så den kan inte slå upp vem som fått ett certifikat eller återkalla den personens certifikat; giltighetstiden fungerar som återkallande.

**Hanterad organisationsutfärdning** använder en standardgiltighetstid på högst 24 timmar och en maximal giltighetstid på sju dagar, med en egen tillitspolicy för rot och utfärdare, och signeringen sker hos den Vault-utfärdare som operatören har konfigurerat. Registreringsapplikationen använder en delad lagring för engångstillträde som bara innehåller en nyckelbaserad autentiseringsidentifierare och ett hashvärde för begäran i högst tio minuter och lagrar inget identitetsregister eller någon cache med certifikatsvar. PKI-leverantören, dess granskningsenheter, gatewayar och säkerhetskopior har egna dataflöden. Även när vanlig lagring vid utfärdande är avstängd kan certifikatbaserat återkallande behålla certifikatet, inklusive dess e-postidentitet, och serienummer för återkallade certifikat och granskningsidentifierare kan förbli länkbara; din operatörs policy avgör det registret, vem som kan komma åt det och hur länge det sparas.

En hanterad enhet kan begära att få sitt eget certifikat återkallat med ett autentiserat bevis på enhetens identitet, och inget API begär enhetens privata nyckel. Operatören kan dra tillbaka en utfärdare genom sin tillitspolicy. Lolly sparar ingen koppling mellan personer och certifikat, så återkallande av en persons certifikat när personen slutar beror på de register som operatören för, och PKI-poster, granskningsposter, mottagare och säkerhetskopior följer operatörens policy. [Certifikattjänstens utformning](https://github.com/lolly-tools/lolly/blob/main/services/ca/README.md) beskriver förvaring hos utfärdaren, leverantörens lagringstider och kvalificering.
:::

<!--i:eti-building-->
## Organisationstjänster med Lolly Work

**Lolly Work** är Lolly-projektets valfria organisationstjänst, som driftsätts separat av varje organisation som kör en instans. När du ansluter till en instans tillkommer data som lagras på den servern vid sidan av din lokala redigering. Dess operatör ansvarar för installationens integritetspolicy, åtkomstkontroller, mottagare, lagringstider och säkerhetskopior.

När en arbetsyta är ansluten anger integritetsraden på appens första skärm det: arbetsytan sparar det du sparar i dess projekt eller delar genom den samt en logg över dina inloggningar och vad du gör där.

| Arbetsflöde | Data som organisationens tjänst hanterar |
|---|---|
| Inloggning och kontohantering | Identitetsleverantörens påståenden, konto- och gruppmedlemskap, inloggningssessioner och enhetsinformation. OIDC hanterar inloggning; administratörer kan skapa och inaktivera konton genom SCIM |
| Delad katalog och delade projekt | Uppladdade tillgångar, metadata och versioner; delade projekt och sessioner; varumärkessidor du publicerar; innehåll som hämtas från konfigurerade biblioteksleverantörer |
| Lolly Work-collabs | Delat sessionstillstånd, ändringar i realtid och deltagarnas närvaro som skickas genom instansen; sparat tillstånd består enligt dess lagringspolicy |
| Hanterade delningslänkar | Länkmål och åtkomstinställningar, som giltighetstid och valfritt lösenordsskydd; förfrågningar hanteras genom instansen och kan återkallas |
| Granskning och leverans | Inskickat innehåll, godkännandebeslut, vald destination, förberedda filer och leveranskvitton |
| Serverrenderingar och batchar | Inskickade verktygsindata, renderingsförfrågningar, status och sparade utdatafiler. Dessa jobb körs på servern i stället för på din enhet |
| Användningsrapportering | Tillåtna händelseetiketter som verktygs-id, format och tillgångs-id från en klient som skickar dem, enligt telemetripolicyn nedan |
| Granskning | Aktörs- och åtgärdsposter för styrda operationer, sparade separat från användningstelemetrin |

Tjänsten använder autentiseringskakor, inklusive `lw_session` för inloggade medlemmar och `lw_guest` för gäståtkomst där den är aktiverad, åtskilda från certifikattjänstens kaka. Policyuppdateringar kan göra förfrågningar medan appen används, utan ett separat klick för varje. Det här är trafik till den konfigurerade instansen, inte en rapport till Lolly-projektet om installationer det inte driver.

**Versionskontroll.** En Lolly Work-server kontrollerar det publicerade chart-indexet på GitHub en gång om dagen efter en nyare version, med samma enkla förfrågan som varje `helm repo update` gör, utan något om instansen eller dess användare. Funktionen är på som standard, och instansens administratör kan stänga av den eller rikta den mot en spegel ([`updates`](/info/work-configuration.html#updates)).

**Användningstelemetri har tre nivåer.** Lollys egna appar skickar inga användningshändelser i dag, så dessa nivåer gäller händelser från en annan klient som operatören ansluter. `off` lagrar inga användningshändelser, `aggregate` tar bort användar-id:n och `standard` kan knyta händelser till användare. Standardnivån är `standard`, så en instans lagrar de användningshändelser den tar emot om inte operatören väljer `off`. Standardpolicyn för koppling till användare är `opt-in`, som kräver ditt samtycke innan ett användar-id lagras; en operatör kan i stället konfigurera rapportering med användarkoppling genom `telemetryAttribution: default`. Tillåtna attribut är etiketter, aldrig verktygens indatavärden. Se [Lolly Work-telemetri](/info/work-telemetry.html).

**Granskning är separat.** Styrda åtgärder kan spara en identifierad granskningspost oavsett ditt samtycke till telemetri. Att stänga av telemetri stänger inte av lagring av delade sessioner, godkännandeposter, renderingsjobb eller granskning. Operatören styr lagringstider och radering, inklusive eventuell pseudonymisering av granskningsloggen; se [Lolly Work-lagring och datalivscykel](/info/work-data-lifecycle.html).

| | Din enhet | Din organisations instans |
|---|---|---|
| Vad den lagrar | Ditt personliga arbete, dina inställningar och cachar | Delat arbete, konton, uppladdningar, godkännanden, renderingar, granskning och konfigurerad telemetri |
| Vem som raderar det | Du, med **Clear all my data** eller webbläsarens webbplatsdata | Operatören, genom instansens egna kontroller |
| Vem du ska fråga | Ingen: posterna finns på din enhet | Instansens operatör, för åtkomst, export eller radering |

::: warning Lokal radering är inte serverradering
Att lämna en instans eller rensa webbläsaren tar bort lokalt tillstånd, inte organisationens lagrade poster eller säkerhetskopior. Personlig [Sync](/info/sync.html) och **Export my data** säkerhetskopierar din enhet, inte organisationens tjänst. Den offentliga [lolly.work](https://lolly.work)-demonstrationen håller sitt tillstånd bara i minnet och är ingen beständig lagring för ditt arbete.
:::

<!--i:eti-camera-->
## Webbläsartillägget

Webbläsartillägget **Lolly URL Screenshot** samlar inte in några personuppgifter åt oss. Det har ingen användningsanalys, ingen spårning och ingen egen server. Sidan [Webbläsartillägget](/info/extension.html) beskriver hur det fungerar.

**Vad det gör.** Lollys webbapp kan be det om en skärmbild av en webbsida eller om en sidas innehåll för att skapa ett designsystem från en webbplats. Varje begäran öppnar ett godkännandefönster i tillägget som visar den begärande webbplatsen, om den vill ha en skärmbild eller sidans innehåll samt sidans adress. Först när du trycker på **Approve once** öppnar tillägget sidan i en tillfällig bakgrundsflik, tar skärmbilden eller läser sidan, lämnar resultatet till Lolly-fliken som frågade och stänger fliken. För en SVG-skärmbild läser det också sidans layout, bilder och typsnittsfiler i den fliken, och appen omvandlar dem till former på din enhet. Varje begäran kräver ett eget godkännande.

**Data.**

- <!--i:shieldcheck--> **Vi samlar inte in något.** Resultatet skickas bara till Lolly-sidan som frågade, i samma webbläsare. Tillägget lagrar inget sidinnehåll och lägger inte till någon annan mottagare.
- <!--i:globe--> **Nätverksförfrågningar.** Sidan du godkänner laddas som i vilken flik som helst, tillsammans med allt som sidan själv begär. När en sidas innehåll läses hämtas också sidans stilmallar och några av dess ikon- och logotypbilder, inifrån sidan, och de hämtningarna skickar inga kakor till andra webbplatser. En SVG-skärmbild begär på nytt de typsnittsfiler som sidan laddade, vilket din webbläsare vanligen besvarar från sin cache. Tillägget gör inga andra förfrågningar, och inga går till en Lolly-server.
- <!--i:lock--> **Din webbläsarsession.** Sidan laddas med din webbläsarsession, precis som om du öppnade den själv, så en sida där du är inloggad kan ta med privat information i resultatet.
- <!--i:link--> **Adresserna du godkänner** används bara för att ladda just den sidan för just den begäran. De loggas eller delas inte.

**Behörigheter.**

- <!--i:wrench--> **`debugger`**: för att ta skärmbilden genom DevTools Protocol, samma mekanism som Lollys datorapp använder, och för en SVG för att gå igenom sidan i den tillfälliga fliken.
- <!--i:monitor--> **`tabs`**: för att öppna och stänga den tillfälliga fliken och kontrollera att varken Lolly-sidan eller målsidan har bytt adress sedan du godkände.
- <!--i:code--> **`scripting`**: för att läsa en sidas innehåll i den tillfälliga fliken efter att du har godkänt begäran.
- <!--i:database--> **`storage`**: för att anteckna id:n för de tillfälliga flikarna i sessionslagringen, så att de ändå stängs om webbläsaren stoppar tillägget under en begäran. Inget sidinnehåll lagras.
- <!--i:check--> **Valfri webbplatsåtkomst (`http://*/*`, `https://*/*`)**: beviljas inte vid installation. När du trycker på **Approve once** ber tillägget Chrome om åtkomst till den enda webbplatsen i begäran, och Chrome frågar dig första gången för varje webbplats. En webbplats som du tidigare har tillåtit kräver ändå ett nytt godkännande för varje begäran.

Ingen av dessa används för att läsa, övervaka eller överföra din surfning utöver den enda begäran du godkände.

<!--i:eti-map-pin-->
## Leveransvärdar och personuppgiftsbiträden

Offentliga katalogfiler, verktyg och visningsrenderingar kommer som standard från appens egen adress. Innehållsadresserade namn ändrar var en fil hämtas, inte vem som tar emot förfrågan. Inget CDN från tredje part aktiveras av den här leveransfunktionen. Ett CDN som terminerar TLS skulle ta emot uppgifter om förfrågningar, inklusive IP-adresser och eventuella kakor eller bearer-uppgifter som vidarebefordras till det, även under samma värdnamn i webbläsaren, så en operatör som lägger till ett anlitar ett nytt personuppgiftsbiträde.

**Innan ett CDN eller en extern modellvärd läggs till** måste administratören publicera personuppgiftsbiträdets namn, värdnamn, jurisdiktioner, mottagna metadata, lagringstider och överföringsarrangemang. [Driftsättning av leverans](/info/deploy-delivery.html) listar vad som ska redovisas. Privata arbetsytesvar går förbi delade cachar: personliga resultat, nekad åtkomst och fel använder `private, no-store`, och ett tillåtet privat svar kan omvalideras i din webbläsare utan att bli offentligt.

Referenstjänsterna använder värdtjänsterna nedan. Detta är en lista över värdnamn, inte ett påstående om att en annan organisations instans använder samma region.

| Värdnamn eller tjänst | Funktion och mottagare | Region och datahantering |
|---|---|---|
| lolly.tools | Offentlig app, katalog, renderings- och certifikattjänster; drift hos UpCloud | Frankfurt, Tyskland. Uppgifter om förfrågningar kan förekomma i infrastrukturloggar; vanlig lokal redigering stannar på enheten |
| lolly.ing | Tjänster för hanterade arbetsytor och dokumentagenter; drift hos UpCloud | Frankfurt, Tyskland. Den privata databasen och fillagringen finns på samma värd. Konton, delat innehåll och tjänsteposter följer instansadministratörens policy |
| mcp.lolly.tools | Planerad valfri autentiserad MCP-gateway och privata resultatnedladdningar; drift hos UpCloud | Frankfurt, Tyskland, med samma personuppgiftsbiträde för drift. Aktivering återstår. Gatewayen skulle ta emot uppgifter om förfrågningar och de parametrar eller filer som anroparen skickar |
| lolli.li | Offentliga versions- och modellfiler; UpCloud Managed Object Storage, separat från applikationsklustret | Frankfurt, Tyskland, i UpClouds objektlagringsregion europe-2. En nedladdning skickar uppgifter om förfrågan, inte de indata som modellen senare bearbetar |
| Konfigurerad identitetsleverantör | Google, GitHub eller en operatörs OIDC-leverantör | Inloggningen följer leverantörens policy. Fråga instansens operatör om värdnamn, region och överföringsarrangemang |
| Konfigurerad tillgångsleverantör | Brandfolder eller ett annat bibliotek som operatören väljer | Leverantören tar emot tillåtna biblioteksförfrågningar. Källans behörigheter och instansens policy styr åtkomsten; fråga operatören om värdnamn och regioner |
| Registrering via e-post, när den är konfigurerad | Resend levererar den begärda inloggningslänken | Tar emot mottagarens e-postadress för meddelandet; dess egna behandlingsvillkor gäller |

Referensapplikationen använder ingen annan leverantör för drift, databas eller missbruksskydd. En operatör kan välja andra leverantörer för en annan instans, och leverantörer av drift, identitet, tillgångar och e-post behöver var och en redovisas separat. Modellvärdens [objektlagringsregion](https://upcloud.com/docs/products/managed-object-storage/availability/) verifieras separat från applikationens region.

**Valfria MCP-nedladdningslänkar bundna till en autentiserad identitet.** En operatör kan slå på nedladdningslänkar för stora resultat på en autentiserad gateway med en enda replik. De är avstängda som standard. Den anonyma gatewayen på `lolly.tools/api/mcp` returnerar resultat direkt i svaret och utfärdar aldrig sådana länkar. Det planerade begränsade värdnamnet är `mcp.lolly.tools`, hos samma UpCloud-personuppgiftsbiträde i Frankfurt; aktiveringen återstår, och den här sidan påstår inte att en tjänst för nedladdningslänkar är i drift. Länkarna tillför inget CDN från tredje part.

::: details Så lagras en operatörs MCP-nedladdningslänkar
Bara en autentiserad anropare med ett filbehörighetsomfång kan få en länk, och samma anropares bearer-token krävs för att hämta den: använd den validerade bearer-token från renderingsanropet, inte en annan token för samma konto. Behörigheten löper ut inom 300 sekunder. Ägarskap och resultatuppslagning stannar i gatewayens minne, och utdatabyten skrivs till privata tillfälliga filer som rensas efter utgångstiden eller tas bort vid normal avstängning. En omstart av gatewayen ogiltigförklarar befintliga länkar. Kvarhållna resultat begränsas till 64 MiB per bearer-token, 256 MiB för hela gatewayen och 200 väntande eller kvarhållna filer. Dagliga budgetar för CPU och avkodade byte räknar resultaten både när de hålls kvar och när de laddas ner. Svaren använder `private, no-store` och `Referrer-Policy: no-referrer`. En länks token räcker inte ensam för att en annan person eller agent ska kunna läsa resultatet.
:::

<!--i:eti-file-->
## Infrastrukturloggar

Det här avsnittet beskriver den offentliga lolly.tools-installationen. Dess värdplattform registrerar vanliga uppgifter om förfrågningar: IP-adress, begärd sökväg, tidsstämpel och användaragent. Lokala ändringar når inte den värden. En renderingslänks frågesträng kan innehålla texten som anroparen tillhandahöll, som förklarats ovan. MCP-filverktyg bearbetar de byte de får i minnet. En Lolly Work-instans lagrar också de poster som beskrivs ovan, enligt operatörens loggningspolicy.

**De offentliga tjänsterna håller applikationsloggningen till ett minimum.** MCP-servern loggar starten samt konfigurations- och renderingsvarningar; den för ingen egen förfrågningslogg och loggar inga token eller anroparadresser. Vidarebefordringstjänsten för Penpot loggar varje kommandonamn och Penpots svarsstatus, aldrig huvuden, token eller filen. Certifikattjänsten loggar sina startinställningar och konfigurationsvarningar samt två rensade rader vid fel: en statuskod för misslyckad sändning utan mottagaradress och en fast felrad utan feltext, stackspårning eller URL, eftersom ett leverantörsfel kan innehålla identitetsvärden eller autentiseringsuppgifter. Allt annat i loggen kommer från värdplattformen.

För lolly.tools styr instansadministratören loggning av förfrågningar, rotation och lagringstid på UpCloud. Den här sidan anger ingen maximal lagringstid för loggar som inte har verifierats. Kontakta den personuppgiftsansvarige nedan för det aktuella schemat och för alla förfrågningar om loggar som finns på servern. För en annan instans gäller dess operatörs inställningar, inklusive eventuella loggexporter eller andra personuppgiftsbiträden.

<!--i:eti-stamp-->
## Rättsliga grunder, lagringstider och mottagare

Den här tabellen gäller referensinstallationen **lolly.tools**. Den anger inte rättsliga grunder eller lagringstider för din organisations Lolly Work-instans; dess operatör anger dem i sin egen policy.

| Behandling | Rättslig grund (GDPR Art. 6) | Lagringstid |
|---|---|---|
| Allt på din enhet (dokument, inställningar, cache, räknare) | **Inte vår behandling alls**: det når oss aldrig. Lagring på din enhet är strikt nödvändig för tjänsten du har begärt (ePrivacy Art. 5(3)), så den kräver inget samtycke | Tills du raderar det |
| Din e-postadress under äldre hostad registrering för Content Credentials | **Art. 6(1)(b)**, fullgörande av en tjänst du uttryckligen har begärt | Varken identitetsregister eller utfärdandelogg i den äldre tjänsten; e-postadressen används under begäran och ingår i ditt certifikat. Lagringstider för hanterad organisations-PKI, granskning och återkallande följer operatörens policy |
| Ett pseudonymt SHA-256-hashvärde av din IP-adress för hastighetsbegränsning av inloggningsändpunkterna och de offentliga renderings-, bild- och MCP-ändpunkterna | **Art. 6(1)(f)**, vårt berättigade intresse av att förhindra missbruk av en kostnadsfri tjänst och en tredje parts e-postkvot. Vi bedömer att detta klarar en intresseavvägning eftersom den ursprungliga adressen inte skickas till begränsaren, hashvärdet bara används för missbruksskydd och det löper ut av sig självt | Ungefär en minut i lagringen för missbruksskydd; sparas inte efteråt |
| Värdtjänstens åtkomstloggar (IP, sökväg, tidsstämpel, användaragent) | **Art. 6(1)(f)**, vårt berättigade intresse av tjänstesäkerhet, förebyggande av missbruk och feldiagnostik | Rotation och lagringstid konfigureras av administratören; kontakta den personuppgiftsansvarige för det aktuella schemat |

**Mottagare.** Mottagarkategorierna är vår driftleverantör (UpCloud), som är värd för applikationens databas och lagring för missbruksskydd, och, bara om du använder e-postinloggning, en leverantör av transaktionsmejl (Resend). Lagringen för missbruksskydd tar bara emot kortlivade hashvärden, aldrig den ursprungliga IP-adressen. Om du loggar in med GitHub, Google eller SUSE (id.suse.com) har du direktkontakt med den leverantören enligt dess egen integritetspolicy, och den meddelar oss en verifierad e-postadress och inget annat. Vi delar inte personuppgifter med någon annan, och vi säljer inte data, visar inte reklam och profilerar inte användare.

**Överföringar utanför EES.** Referensapplikationens drift, databas och fillagring finns i Frankfurt. Valfria identitets-, e-post- och tillgångsleverantörer har egna behandlingsplatser och villkor, som kan omfatta åtkomst utanför EES, och en servers region fastställer inte ensam varje mottagares jurisdiktion. Kontakta den personuppgiftsansvarige för tillämpliga leverantörsavtal och överföringsarrangemang; för en annan instans, fråga dess operatör. Europeiska kommissionens [standardavtalsklausuler](https://commission.europa.eu/law/law-topic/data-protection/international-dimension-data-protection/standard-contractual-clauses-scc_en) är en tillgänglig skyddsåtgärd för sådana överföringar; den här sidan påstår inte att ett overifierat leverantörsavtal använder dem.

**Automatiserat beslutsfattande.** Inget. Ingen profilering sker och inga automatiserade beslut fattas som har rättsliga eller liknande betydande följder (Art. 22).

<!--i:eti-smile-->
## Barns integritet

Vanlig lokal användning av appen skickar inget personligt innehåll till lolly.tools. Dess valfria registrering för Content Credentials tar emot en e-postadress och riktar sig inte till och är inte avsedd för barn. Organisationstjänster har egna konton och egen datahantering enligt operatörens policy.

<!--i:eti-user-check-->
## Dina rättigheter

För poster som bara lagras på din enhet kan du själv komma åt, rätta, radera och flytta uppgifterna. De finns i webbläsarens eller appens lagring i en form som du kan granska, exportera (**Export my data**, ovan) eller radera (**Clear all my data** eller webbläsarens webbplatsdata).

Formellt har du enligt GDPR Articles 15-22 rätt till **tillgång till** dina personuppgifter, att **rätta** dem, att **radera** dem, att **begränsa** eller **invända mot** behandlingen av dem (inklusive allt vi grundar på berättigade intressen), till **dataportabilitet** och, när behandlingen grundar sig på samtycke, att **när som helst återkalla samtycket**, utan att det påverkar lagligheten i det som skedde innan du återkallade samtycket.

Den offentliga certifikattjänsten för ingen utfärdandelogg. Infrastrukturloggar kan innehålla uppgifter om förfrågningar, så den här policyn lovar inte att driftmiljön saknar personuppgifter. Kontakta den personuppgiftsansvarige för tillgång, radering eller andra förfrågningar om de posterna; vi förklarar vilka poster som finns och vad som kan göras. För arbete, identiteter, telemetri och granskningsposter som en organisation lagrar ska du kontakta din Lolly Work-operatör, eftersom lokala kontroller för export och radering inte når de kopiorna.

**Du har rätt att lämna in ett klagomål.** Om du anser att vi har hanterat dina uppgifter felaktigt kan du lämna in ett klagomål till en tillsynsmyndighet för dataskydd: i EU, myndigheten i det land där du bor, arbetar eller där du anser att överträdelsen skedde (Art. 77). Vår huvudansvariga tillsynsmyndighet är *Bayerisches Landesamt für Datenschutzaufsicht* (BayLDA) i Ansbach, Tyskland. Du behöver inte kontakta oss först, även om vi gärna vill få chansen att rätta till problemet.

<!--i:eti-history-->
## Ändringar i den här policyn

Datumet högst upp ändras varje gång det här dokumentet ändras. En ändring som påverkar vad som lämnar din enhet eller vad som sparas får en egen rad här i stället för att göras i tysthet. För att se vad som ändrats kan du fråga (nedan) eller jämföra med den [offentliga källan](https://github.com/lolly-tools/lolly/commits/main/docs/privacy.md).

::: details Tidigare ändringar, 29 september till 23 oktober 2026
**29 september 2026:** förtydligade den valfria tjänsten lolly.work, dess organisationslagrade innehåll, autentiseringskakor, användningstelemetri och granskningsposter samt skillnaden mellan lokal radering och lagring på servern. Detta är befintliga valfria arbetsflöden, inte ett nytt krav på uppladdning för lokal redigering.

**11 oktober 2026:** ersatte den inaktuella beskrivningen av drift hos Vercel med förteckningen över applikationens värdnamn hos UpCloud, skilde ut valfria identitets- och tillgångsleverantörer och beskrev innehållsadresserad leverans samt MCP-nedladdningsläget med kvarhållna resultat. Inget CDN från tredje part aktiveras av ändringen. Loggarnas lagringstid styrs av administratören i stället för av ett angivet standardvärde för ett Vercel-abonnemang.

**22 oktober 2026:** korrigerade beskrivningen av befintligt beteende. Avsnittet om webbläsartillägget omfattar nu godkännandefönstret för varje begäran, webbplatsåtkomst som begärs en webbplats i taget samt hämtning av stilmallar och ikoner när en webbplats läses. Även korrigerat: raderna Send to Google Drive och Meeting Planner, SEAL-anteckningen (ingen Lolly-app slår upp SEAL-nycklar i DNS), organisationstjänstens standardnivå för användningstelemetri, MCP-bildverktygen och de offentliga tjänsternas applikationsloggning. Själva programvaran ändrades inte.

**23 oktober 2026:** ordnade om policyn efter vad som startar varje förfrågan och beskrev befintligt beteende som inte täcktes tidigare: privata collab-inbjudningar med lokala nätverksadresser, Nearby i datorappen, Allow AI control, läsning av ett designsystem från en webbplats, emojiuppsättningar, Meeting Planners lokala cache med stadsuppslagningar, papperskorgen och de andra poster som Settings → Storage listar. Korrigerade två påståenden: Bluesky och Discord finns inte bara i datorapparna, och varje värd som en person väljer för sändning kräver operatörens godkännande i både webb- och datorapparna; hashvärdet av en IP-adress som används för hastighetsbegränsning är pseudonymt, inte anonymt. Själva programvaran ändrades inte.
:::

**3 november 2026:** lade till delningslänkar efter Send. När du trycker på Create a share link gör Lolly ett extra anrop till leverantören som du skickade filen till (Google Drive, Dropbox, OneDrive eller din egen Nextcloud), och Stop sharing gör ett till för att stänga av länken. En S3-delningslänk skapas på din enhet och skickar inget. Ingen ny värd tillkommer, och Lolly sparar ingen kopia av någon länk eller token på en server.

**3 november 2026:** lade till **Ask an agent** i datorappen: vad appen letar efter på datorn när panelen öppnas och vad som skickas till en agents leverantör när du frågar, under ditt eget konto hos leverantören.

**10 november 2026:** kompletterade och korrigerade beskrivningen av befintligt beteende. Enhetslistan anger nu dina profiluppgifter, din signeringsidentitet, sparade inloggningar och delade länkar, dina svar på engångsfrågor, senaste nedladdningar, en ansluten instans poster, arbetsfiler i webbläsarens fillagring och vad dokumentationssidorna sparar. Korrigerat: de lokala användningsräknarna följer med i din egen säkerhetskopia och Sync-kopia; Clear all my data avslutar inte en organisationsinloggning; papperskorgen tömmer objekt som är äldre än 30 dagar nästa gång du öppnar Projects; en ihågkommen Google Drive-anslutning på webben märks med e-postadressen för ditt Google-konto; Lollys egna appar skickar inga användningshändelser till en Lolly Work-instans. Beskrev också arbetsytans integritetsrad som lades till i 1.2.0 samt varumärkessidor som publiceras till en instans. Förutom den integritetsraden ändrades inte själva programvaran.

**10 november 2026:** lade till Lolly Works versionskontroll: en Lolly Work-server läser det publicerade chart-indexet en gång om dagen för att informera sina administratörer om en nyare version. Förfrågan innehåller inget om instansen eller dess användare, och en administratör kan stänga av den eller rikta den mot en spegel.

<!--i:eti-mail-->
## Vem som är ansvarig och hur du når oss

Den **personuppgiftsansvarige** för lolly.tools är:

> SUSE Software Solutions Germany GmbH
>
> Frankenstraße 146
>
> 90461 Nürnberg
>
> Tyskland

SUSE har utsett ett **dataskyddsombud** som kan nås på [privacy@suse.com](mailto:privacy@suse.com). Använd den adressen för alla formella förfrågningar enligt "Dina rättigheter" ovan.

För allt som gäller själva Lolly, till exempel hur det fungerar, varför något är som det är eller en rättelse i det här dokumentet, kontakta **Andy Fitzsimon**, [fitzy@suse.com](mailto:fitzy@suse.com).

För en egenhostad Lolly-instans eller en företagsinstans ska du i stället kontakta den som driver den: operatören är personuppgiftsansvarig för sin egen installation. SUSE och projektet Lolly med öppen källkod lagrar inga uppgifter för installationer de inte driver.
