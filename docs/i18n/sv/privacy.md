# Integritetspolicy

*Senast uppdaterad: 11 augusti 2026*

> **Kortversionen.** Dokumenten, bilderna, videorna och filerna du skapar i Lolly stannar
> på din enhet. Det finns inga konton för vanlig användning, inga kakor från appen
> själv och ingen analys eller spårning någonstans i koden - inte "vi använder inte
> datan", utan genuint inte närvarande i källkoden. En kort, komplett lista över
> undantag finns där programvaran över huvud taget pratar med ett nätverk, och alla
> dessa beskrivs nedan i detalj: vad som lämnar enheten, till vem och när. Det enda
> undantaget som rör något personligt är en inloggning du uttryckligen måste
> starta. Om det inte står i det här dokumentet händer det inte.

## Vad den här policyn omfattar

Lolly är öppen källkod - en motor, flera app-skal (webb, dator, mobil, CLI) och ett webbläsartillägg - som vem som helst kan köra. Den här policyn har två delar:

- <!--i:code--> **Mjukvaran i sig**: vad den gör och inte gör med din data, oavsett var den
  körs. Det här är en egenskap hos koden, så det gäller alla Lolly-driftsättningar,
  våra eller andras.
- <!--i:server--> **lolly.tools**, referensdriftsättningen som SUSE driver: de specifika val
  som görs när dess valfria serverdelar körs (vad som loggas, hur länge, av
  vem).

Om du använder en självhostad eller företagsinstans av Lolly gäller mjukvarans
beteende nedan fortfarande, men *operatören* av den instansen - inte SUSE - är
ansvarig för allt som sker på serversidan: deras render-endpoint, deras MCP-server,
deras certifikatutfärdare för Content Credentials, om de kör en. Fråga dem om
deras egen policy. Se [Adoption & Governance](/info/adoption-governance.html) för
vad det innebär att driva Lolly.

## Appen: vad som stannar på din enhet

Lollys webb-, dator- och mobilskal kör hela rendermotorn på klientsidan.
Att öppna ett verktyg, fylla i indata, förhandsgranska och exportera sker allt på din
enhet - ingen server är inblandad, och appen fungerar offline när den väl har laddats.

**Appen sätter inga cookies.** För att fungera sparar den en liten mängd data **enbart
på din enhet**, och skickar den aldrig vidare:

- <!--i:sliders--> **Gränssnittsinställningar** - tema, språk, ljudinställningar, storlek på
  sidopanel/zoom, sorterings- och vyval, vilka introduktionstips du har sett - i
  `localStorage`, så de är tillgängliga innan appen har startat klart.
- <!--i:download--> **En offlinecache av verktygskatalogen och tillgångsförhandsgranskningar**, så att galleriet
  fungerar utan anslutning.
- <!--i:hash--> **Lokala användningsräknare** för statistiken på ditt profilkort (hur många exporter, vilka
  verktyg) - en liten avgränsad datamängd i `localStorage`, som aldrig läses av oss och aldrig skickas
  någonstans.
- <!--i:folder--> **Dina egna dokument, sparade sessioner, uppladdade tillgångar och typsnitt** - lagras i
  IndexedDB på din enhet, aldrig uppladdade, aldrig lästa av någon annan än dig.

Inget av detta delas, säljs eller används för att identifiera eller spåra dig. Det
finns inget att samtycka till, eftersom ingen insamling sker - bara det här
meddelandet, så att du vet vad som sparas och var. Att rensa webbplatsens lagring i
din webbläsare tar bort allt av det när som helst, och det gör även
**Inställningar → Lagring → Rensa all min data**, som också stänger av Synk först.
(Enligt ePrivacy-direktivet Art. 5(3) kräver lagring som är strikt nödvändig för
den tjänst du bad om inget samtycke - bara transparens, vilket är vad både det
här dokumentet och meddelandet i appen är.)

![Lagringssektionen på profilsidan i telefonbredd: varje kategori av data på enheten namngiven, med knappen Clear all my data alldeles bredvid](/t/url-shot?url=%2F%23%2Fprofile%3Ffocus%3Dstorage-section&width=430&height=1600&dpi=192&waitMs=2400&css=.welcome-dialog%2C.personalize-nudge%2C.store-manages%2C.storage-subsection%2C.store-selbar%2C.store-chip-val%2C%23store-hero-num%2C%23store-headroom%2C%23store-quota%2C%23store-reclaim%7Bdisplay%3Anone%7D&format=svg&walker=1&cropSelector=%23storage-section&dark=1&filename=pv-storage-clear)

Din egen säkerhetskopia av den här datan - `lolly-backup`-paketet som skapas
av **Exportera mina data** - är en fil du behåller och kontrollerar. Den rör aldrig
våra servrar om du inte själv väljer att skicka den någonstans. Se
[Dataöverföring](/info/data-transfer.html).

## Verktyg på enheten

Vissa verktyg - **Strip Hidden Data**, **Compress PDF** och andra som har
märket **"Runs on your device"** - arbetar med en fil du tillhandahåller. Filen läses
in i minnet i din webbläsare, omvandlas lokalt och erbjuds tillbaka som en nedladdning.
Den laddas aldrig upp, eftersom det inte finns någon server i vägen att ladda upp den till.
De här verktygen fungerar offline, och deras utdata bär varken vattenstämpel eller metadata från
oss - poängen med de flesta av dem är att ta bort & skydda data, inte lägga till risk.

![Märket dessa verktyg har: Runs on your device - inget laddas upp](/t/url-shot?url=%2F%23%2Ftool%2Fstrip-data&width=1440&height=900&dpi=192&waitMs=2400&walker=1&format=svg&cropSelector=.on-device-badge&dark=1&filename=pv-ondevice-badge)

Förbered för delning håller arbetsindata, privata fynd och ersättningskartor i minnet, utan att
automatiskt lägga till dem i historik, länkar, säkerhetskopior eller synk. Inspektion och ersättning
skickar inte filinnehåll till en server och validerar inte autentiseringsuppgifter online. Användare
väljer om de vill kopiera, ladda ner, skicka eller uttryckligen spara ett resultat i sitt bibliotek; ett
sparat resultat följer sedan bibliotekets vanliga inställningar för säkerhetskopiering och synk.
Receptfiler utelämnar tidigare nyttolaster och bokstavliga mappningar. Sammanfattningsrapporter innehåller
antal, omfångs-ID:n och filhashar. CLI:t kan också spara en privat granskningsfil som innehåller
originalvärden, bara när det uttryckligen begärs med `--review-file`. Att rensa eller lämna en förberedelsevy i
webbläsaren frigör dess arbetstillstånd; det är inget löfte om forensisk radering från webbläsarens eller
operativsystemets minne.

## Varje nätverksförfrågan appen kan göra

Tabellen nedan är den fullständiga listan över allt appen hämtar eller skickar över ett
nätverk. Om det inte finns här gör appen det inte.

| Vad | Vad som faktiskt lämnar din enhet | När (händelsen som utlöser det) | Om en operatör blockerar det |
|---|---|---|---|
| Synkronisering av verktygskatalogen | Inget personligt - en förfrågan om Lollys egna publika verktygs- och tillgångsindex, till appens egen ursprungsadress | Vid start, sedan cachelagrat offline | Appen körs på sin cachelagrade verktygsuppsättning. Den slutar bara upptäcka nya verktyg |
| Ett verktyg som behöver realtidsdata | Vad det specifika verktyget än begär, till den värd som anges i dess egen beskrivning. Idag är det bara stadssökningen i verktyget Meeting Planner, som frågar `geocoding-api.open-meteo.com` för att omvandla ett stadsnamn till koordinater och en tidszon - inget konto, ingen nyckel och ingen identifierare utöver själva förfrågan. Inmatningsfältet säger detta precis där du skriver, och varje svar sparas på din enhet så att en stad bara slås upp en gång | Endast medan du använder det verktyget, och endast när du anger en plats | Just den uppslagningen misslyckas. Du kan fortfarande skriva in koordinater för hand, och inget annat påverkas |
| Google Fonts | Det valda typsnittsfamiljenamnet och din IP-adress, till Googles typsnittsservrar (`fonts.googleapis.com` för stilmallen, `fonts.gstatic.com` för typsnittsfilen) | Endast om du lägger till ett Google-typsnitt i varumärkesredigeraren, **och endast efter att du godkänt det i en dialogruta som säger exakt detta** - en engångshämtning per familj, som sedan finns kvar på din enhet och används offline | Google Fonts-väljaren nekar som standard (fail-closed). Ladda upp en typsnittsfil istället |
| Skicka till Google Drive | Den enda fil du valde att skicka, till Googles Drive-API (`www.googleapis.com`), efter en Google-inloggning som du slutför i Googles eget popup-fönster. Lollys åtkomst är begränsad till filer den själv har skapat (omfånget `drive.file` - den kan aldrig läsa resten av din Drive), och inloggningstoken hålls i minnet under sessionen, sparas aldrig | Endast när du trycker på "Send to Google Drive" vid en EMF-export, och endast i byggen där operatören har konfigurerat ett Google-klient-id - utan ett sådant finns knappen inte | Knappen visas aldrig. Ladda ner filen och ladda upp den till Drive själv |
| Skicka till Dropbox | Den enda fil du valde att skicka, till Dropboxs API (`api.dropboxapi.com` för inloggning och metadata, `content.dropboxapi.com` för själva filen), efter en Dropbox-inloggning som du slutför i Dropboxs eget fönster. Lollys åtkomst gäller endast appmappen (den kan bara någonsin se `Apps/` och sin egen mapp där - aldrig resten av din Dropbox), länken "Open" som visas är en kortlivad privat länk (ingen offentlig delning skapas), och en förnyelsetoken sparas bara om du kryssar i "stay connected" | Endast när du trycker på "Send to Dropbox" på en fil, och endast i byggen där operatören har konfigurerat ett Dropbox-klient-id - utan ett sådant finns knappen inte | Knappen visas aldrig. Ladda ner filen och ladda upp den till Dropbox själv |
| Skicka till OneDrive | Den enda fil du valde att skicka, till Microsofts identitets- och Graph-tjänster (`login.microsoftonline.com` för inloggning, `graph.microsoft.com` för uppladdningen; en stor fil laddas upp i delar till en Microsoft-ägd uppladdningsadress på `api.onedrive.com`, `*.up.1drv.com` eller `*.sharepoint.com`), efter en Microsoft-inloggning som du slutför i Microsofts eget fönster. Lollys åtkomst är begränsad till sin egen mapp under `Apps/` (den kan aldrig läsa resten av din OneDrive) plus ditt visningsnamn för kontoetiketten, och en förnyelsetoken sparas bara om du kryssar i "stay connected" | Endast när du trycker på "Send to OneDrive" på en fil, och endast i byggen där operatören har konfigurerat ett Microsoft-klient-id - utan ett sådant finns knappen inte | Knappen visas aldrig. Ladda ner filen och ladda upp den till OneDrive själv |
| Skicka till LinkedIn | Den enda fil du valde att skicka, plus dess namn som inläggstext, till LinkedIn (`www.linkedin.com` för inloggningen, `api.linkedin.com` för uppladdningen och inlägget), efter en LinkedIn-inloggning som du slutför i din egen webbläsare. Inlägget publiceras på ditt eget flöde som ett offentligt inlägg i ditt namn. Lolly kan publicera i ditt namn och läsa ditt namn för kontoetiketten, inget annat på ditt LinkedIn, och inloggningen sparas bara på den här enheten om du kryssar i "stay connected" - LinkedIns token är giltig i 60 dagar och kan inte förnyas i tysthet, så den upphör av sig själv | Endast när du trycker på "Send to LinkedIn" på en fil, endast i skrivbordsapparna, och endast i byggen där en LinkedIn-app är konfigurerad - utan en sådan finns knappen inte | Inget att blockera i webbappen: detta finns **endast i skrivbordsapparna**, så dessa två värdar finns medvetet INTE med i webbappens Content-Security-Policy nedan. I skrivbordsapparna: ta bort den konfigurerade LinkedIn-appen så visas knappen aldrig |
| Skicka till Penpot | Din personliga Penpot-åtkomsttoken (du klistrar in den i appen) och `.penpot`-arkivet för den design du valde att skicka, till Penpots API (`design.penpot.app`) via en liten genomströmning på appens egen ursprungsadress (`/api/penpot`), eftersom Penpots API inte svarar en webbläsare direkt. Genomströmningen vidarebefordrar och glömmer; skrivbordsapparna pratar direkt med Penpot | Endast när du trycker på "Send to Penpot" i Design-verktyget och bekräftar ett projekt | Genomströmningen returnerar ett fel och skickningen nekar (fail-closed). Exportera `.penpot`-filen och importera den i Penpot själv |
| Skicka till Bluesky | Den enda bild du valde att skicka, dess namn som inläggstext och alt-text, samt ditt handtag plus ett applösenord (Bluesky → Settings → App passwords, aldrig ditt kontolösenord), till den Bluesky-server du anger (`bsky.social` om du inte självhostar). Applösenordet sparas bara på den här enheten, aldrig i en säkerhetskopia, och Disconnect raderar det | Endast när du trycker på "Send to Bluesky" på en bild, efter att du anslutit kontot i din profil, **endast i skrivbordsapparna** | Inget att blockera i webbappen: dess policy nedan listar ingen Bluesky-värd, så övergången finns inte där. I skrivbordsapparna, ta bort anslutningen så visas knappen aldrig |
| Skicka till Discord | Den enda fil du valde att skicka, som en bilaga, till den kanalwebhook-adress du klistrat in (`discord.com`). En webhook-adress låter vem som helst som har den publicera i den kanalen, så den sparas bara på den här enheten, aldrig i en säkerhetskopia, och Disconnect raderar den | Endast när du trycker på "Send to Discord" på en fil, **endast i skrivbordsapparna** | Inget att blockera i webbappen: dess policy nedan nämner inte `discord.com`, så övergången finns inte där. I skrivbordsapparna, ta bort webhooken så visas knappen aldrig |
| Skicka till Mastodon | Den enda fil du valde att skicka och dess namn som inläggstext, till den Mastodon-server (eller kompatibla server) du anger, efter en inloggning du slutför i den serverns eget fönster. Att ansluta registrerar en liten app per enhet på den servern; inloggningen sparas bara på den här enheten om du kryssar i "stay connected" | Endast när du trycker på "Send to Mastodon" på en fil. Du väljer servern, så den finns inte med i policyn nedan | Servern du anger måste tillåta webbläsaranrop; om den inte gör det, använd skrivbordsapparna. Disconnect tar bort knappen |
| Skicka till Nextcloud / WebDAV | Den enda fil du valde att skicka, till din egen server, via en autentiserad PUT med serveradressen, användarnamnet och applösenordet du angett (Nextcloud → Settings → Security → Devices & sessions; aldrig ditt kontolösenord). Sparas bara på den här enheten, aldrig i en säkerhetskopia, raderas av Disconnect | Endast när du trycker på "Send to Nextcloud" på en fil. Du väljer servern, så den finns inte med i policyn nedan | Din server måste tillåta webbläsaranrop från appens ursprungsadress; om den inte gör det, använd skrivbordsapparna |
| Skicka till S3-kompatibel lagring | Den enda fil du valde att skicka, till din egen bucket (AWS S3, MinIO, R2, B2, Garage - vilken SigV4-endpoint som helst), signerad på din enhet med det nyckelpar du angett. Nycklar sparas bara på den här enheten, aldrig i en säkerhetskopia, raderas av Disconnect | Endast när du trycker på "Send to S3" på en fil. Du väljer endpointen, så den finns inte med i policyn nedan | Din buckets CORS-regler måste tillåta appens ursprungsadress; om de inte gör det, använd skrivbordsapparna |
| Synk mellan dina enheter | En kopia av det du skapat på den här enheten - sparade sessioner och projekt, dina designsystem med deras typsnitt och logotyper, uppladdade bilder, din profil och dina inställningar - som en enda fil, till den lagring du valt: Lolly-appmappen i din Dropbox (`api.dropboxapi.com`, `content.dropboxapi.com`), filer Lolly skapat i din Google Drive (`www.googleapis.com`), Lolly-appmappen i din OneDrive (`graph.microsoft.com`, med större filer uppladdade till `api.onedrive.com`, `*.up.1drv.com` eller `*.sharepoint.com`, och nedladdningar från Microsofts `*.files.1drv.com`, `my.microsoftpersonalcontent.com` eller `*.sharepoint.com`), eller din egen Nextcloud- / WebDAV-server eller S3-bucket. Samma lagring håller också upp till sju dagliga kopior och en kopia från innan din senaste tillämpning. **Inget går till Lolly:** ingen Lolly-server, relä eller Lolly Work-server ligger i vägen, och apparna behöver ingen Lolly-webbplats för det, inte ens för att logga in. Kopian krypteras på din enhet först bara om du ställer in en lösenfras. Inloggningar, nycklar, applösenord, lösenfrasen och synkinställningarna stannar på enheten och finns aldrig i kopian. På webben håller en ihågkommen Google Drive-anslutning bara ditt kontonamn (och ditt eget klient-id, om du angav ett); själva Google-inloggningen varar ett besök. I Android-appen går Google Drive-inloggningen via Google Play-tjänster på telefonen, som drivs av Google | Endast efter att du slagit på "Sync across my devices" eller tryckt på "Sync now": en uppladdning strax efter varje ändring och när du lämnar appen, samt en kontroll av en nyare kopia när appen startar | Synk misslyckas och säger varför; ditt arbete stannar på enheten. Exportera dina data till en fil och flytta den själv i stället |
| ICC-tryckprofiler | Inget personligt - en förfrågan om en standardiserad tryckförhållandeprofil, till ICC:s publika register (`registry.color.org`, `www.color.org`) | Endast om du klickar på en ICC-förinställning i tryckprofilhanteraren - en engångshämtning per profil, som sedan finns kvar på din enhet | ICC-förinställningarna misslyckas. Ange din egen `.icc`-profil istället |
| Internetradio | Inget personligt - en spellisteförfrågan och en ljudström, till kanalen (`api.somafm.com` och den icecast-server den anger, `*.somafm.com`) | Endast medan du spelar den valfria inbyggda radion i ljudspelaren | Radion fungerar inte. Alla andra ljudfunktioner fungerar fortfarande |
| En URL du ber ett verktyg fånga | En förfrågan till exakt den webbadress du skriver in, från URL-skärmdumpsverktyget. Vad den adressen än är. Denna värd finns inte med i policyn nedan, eftersom du väljer den i användningsögonblicket | Endast när du anger en URL i det verktyget och startar infångningen | En operatör kan inte tillåtlista detta per värd. För att ta bort det, ta bort verktyget |
| Lägg till en bild från en URL | En förfrågan till exakt den bildadress du klistrar in i "Add from URL" (i tillgångsväljaren eller Tillgångar). Webbappens egen policy förbjuder webbläsaren att hämta från en annan sajt direkt, så förfrågan görs åt dig av en liten genomströmning på appens egen ursprungsadress (`/api/fetch-image`), som hämtar bilden server-sidan och lämnar tillbaka bara byten - den sparar ingenting och glömmer adressen. Den nekar allt som inte är en offentlig bildadress (en privat eller intern adress blockeras). Skrivbordsapparna hämtar adressen direkt. En Lolly-länk du klistrar in hämtas inte alls - den renderas på din enhet. Värden finns inte med i policyn nedan, eftersom du väljer den i användningsögonblicket | Endast när du klistrar in en URL i "Add from URL" och bekräftar | Operatören stänger av genomströmningen (`LOLLY_DISABLE_IMAGE_PROXY=1`); då kan bara Lolly-länkar, `data:`-bilder och bilder från samma ursprung läggas till i webbappen. Skrivbordsapparna påverkas inte |
| SEAL-signaturkontroll | **Ingenting.** Webbappen har ingen DNS-uppslagning alls - se nedan | Aldrig | Inget att blockera |
| AI-modeller på enheten | Inget personligt - en engångsnedladdning av en modellfil från Lollys modellvärd (`lolli.li`), som sedan cachelagras på din enhet; inget konto, ingen identifierare, bara förfrågan och din IP | Endast när du använder en funktion som behöver en modell (Verify djupsökning, bilduppskalning, tal och liknande) | Den funktionen väntar på nedladdningen; allt annat fungerar fortfarande |
| Fjärrinstans | Vad den instans du namnger än svarar med, via samma katalogsynkning som beskrivs ovan - plus en versionstagg på förfrågningar till den (skaltyp och motorversion, samma information som en user agent bär), så att dess operatör kan se vilka Lolly-versioner som är i bruk. På en hanterad instans, medan du är inloggad, bär den taggen också ett per-enhets installations-id så att operatörens enhetslista kan skilja denna installation från andra. Den åker bara med på förfrågningar din egen användning redan gör - det finns ingen timer och inget som ringer hem - och att lämna instansen raderar id:t, så en enhet som ansluter igen senare presenterar ett nytt. Du väljer värden i användningsögonblicket, så den finns inte med i policyn nedan | Endast om du uttryckligen pekar skalet mot en annan Lolly-driftsättning | Instansbyte misslyckas. Din lokala instans påverkas inte |

Varje fast värd i den tabellen är också den fullständiga tillåtlistan i appens
Content-Security-Policy, som webbläsaren tillämpar. Listan är alltså inte bara en
beskrivning av vad koden gör idag, den är den gräns webbläsaren håller appen till: en
framtida ändring som försökte kontakta någon annan värd skulle blockeras, inte tillåtas i
tysthet. En rad är det medvetna undantaget, och dess egen cell säger det: Send to
LinkedIn finns bara i skrivbordsapparna, och webbappens policy listar ingen av dess
värdar - webbappen skulle inte kunna nå dem ens om koden försökte. Ytterligare två rader,
Bluesky och Discord, är på samma sätt bara för skrivbordsapparna, och deras värdar
utelämnas från webbpolicyn av samma skäl. Fem rader har ingen fast värd, eftersom du
väljer adressen i användningsögonblicket: en URL du ber ett verktyg fånga, en
fjärrinstans du pekar skalet mot, och din egen Mastodon-server, WebDAV-server eller
S3-bucket (de två sistnämnda även som ett synkhem). Ingen av dem finns i policyn, och var
och en sker bara när du skriver in en adress och agerar på den. Penpot-raden når Penpot
via appens egen ursprungsadress, så den täcks av `'self'`. En driftsättning som inte vill ha
någon av de valfria (en företagsinstans med egna typsnitt, till exempel) tar bort de
värdarna från sin policy, och funktionerna nekar som standard (fail-closed) istället för
att nå ut.

Bortsett från två sorters rader skickar inget av detta dina dokument, projekt,
sessioner eller uppladdade filer någonstans: de finns för att föra saker *till* din enhet
(verktyg, typsnitt, modeller). De två sorterna är Skicka-raderna, som skickar den enda
fil du valt, och synkraden, som skickar en kopia av ditt arbete till den lagring du
valt och till ingen Lolly-server. Alla andra undantag namnges uttryckligen i avsnitten
nedan.

**En notering om vad vi tog bort.** Verify kan kontrollera SEAL-signaturer, ett system där en
fils signeringsnyckel publiceras i DNS. Webbläsare kan inte göra DNS-uppslag, så varje
webbimplementering måste dirigera uppslaget genom en DNS-over-HTTPS-resolver
från tredje part - vilket skulle visa den operatören domänen som kontrolleras plus din IP-
adress. Vi använde tidigare Cloudflares. **Det gör vi inte längre, och det finns ingen
ersättning**: webbappen skickar nu ingen resolver alls, så SEAL-verifiering
här gör noll nätverksförfrågningar. Filer vars SEAL-post har sin nyckel inbäddad
verifieras fortfarande helt offline. Filer vars nyckel finns i DNS rapporterar "no key
resolver" i stället, och du kan kontrollera dem i skrivbords- eller kommandoradsappen,
som löser DNS nativt via din egen dator utan att någon tredje part
är inblandad.

![Verify-skärmen: ett släppmål och inget annat - filen kontrolleras där den redan finns, utan uppladdning och utan konto](/t/url-shot?url=%2F%23%2Fverify&width=1440&height=900&dpi=192&waitMs=1400&walker=1&format=svg&cropSelector=.valid-layout&dark=1&filename=cc-verify-drop) Du kan bekräfta detta själv: greppbara kontroller för det här och varje
annat påstående på den här sidan, med exakta kommandon och förväntad utdata, finns på
[Verifiera själv](/info/verify-yourself.html).

## Direktlänkade render-URL:er

> **Aktiv på lolly.tools.** Varje
> `https://lolly.tools/tool/<tool-id>.<ext>?<inputs>`-URL renderas på riktigt,
> och indata följer med i den URL:en. Avsnittet nedan förklarar vad det
> betyder för dig, och en operatör kan stänga av funktionen på sin egen instans.

Appen i sig stannar helt på din enhet. Separat kan en operatör aktivera
**direktlänkade render-URL:er** - `/tool/<tool-id>.<ext>?<inputs>` - så att en delad Lolly-
länk kan visas som en levande bild i en README, en wiki eller en instrumentpanel. Att hämta en
sådan ber servern rendera **publik verktygs- och katalogdata** med indata
skrivna i URL:en.

- <!--i:usercheck--> **Inga konton, inga kakor, inget tillstånd.** Slutpunkten är anonym, och inget
  på din enhet läses. Dina dokument, sessioner och uppladdningar lämnar aldrig din
  webbläsare - de kan inte förekomma i de här länkarna alls.
- <!--i:document--> **Men själva URL:en registreras.** En URL:s frågesträng är en del av
  förfrågningsraden, så den hamnar i värdplattformens vanliga åtkomstloggar på samma sätt
  som varje begärd sökväg gör. Om en länks indata innehåller någons namn eller e-post -
  en namnbricka, en e-postsignatur - **finns den texten i de loggarna**, och ingen
  mängd policytext ändrar på det. Därför är en hotlink-URL fel plats för
  personuppgifter: lägg bara in det du skulle lägga på en offentlig sida.
- <!--i:globe--> **Indata är offentliga av konstruktion** i vilket fall - de är vad som helst
  länkens upphovsperson skrev in i URL:en, läsbart för alla länken når. Lägg inte
  hemligheter i en delad länk. Lolly erbjuder länkkryptering för känsligt innehåll.
- <!--i:eyeoff--> Svar **cachas och hastighetsbegränsas** som vilken publik bild som helst, och märks
  `noindex` så att sökmotorer inte indexerar dina renderingar.

Självhostar du Lolly och vill inte ha en publik renderingsyta? Sätt `LOLLY_DISABLE_RENDER_GET=1` och var och en av de här URL:erna returnerar
404.

## MCP-servern (valfri, för AI-agenter)

Lolly kan också nås av en AI-agent via Model Context Protocol - en operatörsdriven endpoint
(lolly.tools kör en; vem som helst kan självhosta sin egen, också helt luftgapad). Den delar
renderingsvägens inga-konton-hållning, plus fyra verktyg som med nödvändighet hanterar
filbytes:

- <!--i:cpu--> **`lolly_transform`** (kör ett verktyg för enheten på serversidan, för den anropande
  agentens räkning), **`lolly_verify`** (kontrollerar Content Credentials) och **`lolly_redact`**
  (svärtar över regioner i en bild eller PDF) tar alla emot
  en fils bytes från anroparen. De behandlas **i processen, i minnet**,
  och resultatet returneras i samma anrop - filen skrivs aldrig till
  disk och sparas aldrig när begäran är klar.
- <!--i:cpu--> **`lolly_rebrand`** (renoverar en gammal presentation till ett designsystem,
  genom dess steg `plan`, `compile` och `inspect`) tar emot ett bildspels bytes på
  samma sätt, och behandlar dem **i minnet, bara för det anropet** - inget
  skrivs till disk eller sparas när svaret har skickats. Dess första steg,
  `capabilities`, anger i klartext vart dina bytes skulle gå innan du skickar
  några: på en självhostad lokal server lämnar bildspelet aldrig den maskinen;
  på en hostad server skickar ett anrop till `lolly_rebrand` bildspelet dit, upp till de
  storleks- och bildgränser som samma steg anger.
- <!--i:checklist--> Alla andra verktyg - `lolly_render`, `lolly_build_url`, `lolly_list_tools`,
  `lolly_describe_tool` - fungerar enbart med parametrar (text, siffror, färger,
  URL:er, katalogtillgångs-id:n), samma indata som en direktlänkad render-URL tar.
- <!--i:lock--> Åtkomst är antingen en delad token som operatören utfärdar till klienter den litar på, eller
  tillståndslös OAuth 2.1: kortlivade signerade tokens verifierade mot en delad
  hemlighet, inget lagras på serversidan och själva token skrivs aldrig till en
  logg eller en render-URL.

## Content Credentials-identitet (en inloggning du måste starta själv)

Lolly kan försegla en kryptografisk **Content Credential** i dina exporter så att vem som helst
kan verifiera, offline, att en fil är oförändrad sedan den lämnade Lolly. Så långt är det
**påslaget som standard och helt lokalt** - signeringsnyckeln genereras på din enhet
och själva signeringen sker offline. Utan registrering är den nyckeln engångsbruk:
ett nytt nyckelpar skapas för varje export och kastas med den. När du registrerar dig blir
nyckeln bestående och genereras **icke-extraherbar** - inte ens Lollys
egen kod kan läsa den, bara be den signera. Hur som helst lämnar den aldrig din
enhet. Det här avsnittet täcker det enda *valfria* steget utöver detta:
att registrera en verifierad identitet, så att dina exporter säger "Verified - signed by
\<your email\>" i stället för en anonym nyckel. **Hoppar du över registreringen gäller inget i
det här avsnittet dig, och ingen personlig data lämnar någonsin din enhet.**

![Kortet Verified identity på profilsidan, telefonbredd: väljaren för certifikatets livslängd och registreringssteget under det, vilande tills du själv startar det](/t/url-shot?url=%2F%23%2Fsettings%3Ffocus%3Didentity-section&width=430&height=1600&dpi=192&waitMs=2400&css=.welcome-dialog%2C.personalize-nudge%7Bdisplay%3Anone%7D&format=svg&walker=1&cropSelector=%23identity-section&dark=1&filename=pv-identity-enrol)

Om du registrerar dig är det här exakt vad som händer:

1. **Du väljer en inloggningsmetod** - GitHub, Google, SUSE (id.suse.com) eller en
   e-postad länk. För de tre OIDC-leverantörerna omdirigeras du till den
   leverantörens egen inloggningssida, som styrs av deras integritetspolicy, inte vår.
   Lollys certifikattjänst får tillbaka bara en verifierad e-postadress och
   leverantörens namn. För e-postlänken skickas adressen du skriver till
   **Resend**, ett transaktionellt e-post-API, enbart för att leverera den ena länken.
2. **En kortlivad cookie skyddar omdirigeringen.** Det här är den enda cookien hela
   Lolly-systemet sätter: `lolly_ca_state`, `HttpOnly`, avgränsad till `/api/ca`,
   som går ut inom tio minuter. Den bär ett slumpvärde, inte en spårnings-
   identifierare, och finns bara för att stoppa att OAuth-omdirigeringen förfalskas. Den
   rensas så snart inloggningen är klar.
3. **Din IP-adress används kort för att förhindra missbruk** av inloggnings-
   endpointerna (så att inte ett skript kan spamma en inkorg eller tömma
   e-postkvoten). Lolly hashar den innan en kortlivad missbrukskontrollhink
   skapas; den råa adressen skickas inte till den lagringen. Hinken går ut
   efter ungefär en minut och används inte för spårning. Vanliga hostingåtkomst-
   loggar är separata och beskrivs nedan.
4. **Certifikattjänsten utfärdar ett kortlivat certifikat** (7, 30, 90 eller 365
   dagar, ditt val, begränsat av operatörens policy) som binder din verifierade
   e-post till den publika halvan av nyckelparet som genereras på din enhet. Den privata
   halvan lämnar aldrig din webbläsare.
5. **Ingenting om utfärdandet registreras.** Certifikattjänsten för ingen
   utfärdandelogg: inte din e-post, inte leverantören, inte ett serienummer, inte en
   tidsstämpel. Ingen databas, ingen loggrad, ingen webhook. Din e-postadress finns i
   begäran bara så länge det tar att skriva in den i certifikatet som din egen
   enhet tar emot, och sedan är den helt borta från vår sida.
6. **Efter det är signering offline igen** under hela certifikatets livslängd.
   Att exportera en fil kontaktar aldrig certifikattjänsten - bara registreringen gjorde det.

**Avvägningen, sagt rakt ut.** En tidigare version av den här tjänsten loggade varje
utfärdande, så att ett felaktigt utfärdat eller komprometterat certifikat kunde spåras. Vi
tog bort det, eftersom den loggen var den enda platsen i hela Lolly där personlig
data kom till ro på en server, och vi föredrar att inte ha den framför att ha den
försiktigt. Vad vi ger upp är spårbarhet på serversidan: om ett certifikat
missbrukas kan vi inte slå upp vem som fick det. Certifikat är kortlivade till sin
natur - 7 till 365 dagar, ditt val, begränsat av operatören - och går ut av sig
själva, vilket är den motåtgärd vi förlitar oss på i stället. Självhostare vars egna
skyldigheter kräver en granskningslogg kan lägga till en, och blir därmed
personuppgiftsansvarig för den datan.

## Webbläsartillägget

Webbläsartillägget **Lolly URL Screenshot** samlar inte in, lagrar eller
skickar någon personlig data. Ingen analys, ingen spårning, ingen fjärrserver.

**Vad det gör.** När du ber Lolly-webbappen ta en skärmdump av en URL öppnar
tillägget den sidan i en tillfällig bakgrundsflik, fångar den i din webbläsare
med DevTools Protocol, lämnar bilden tillbaka till appen och stänger
fliken. Allt sker lokalt, på din egen enhet och ditt eget nätverk.

**Data.**

- <!--i:shieldcheck--> **Vi samlar inte in något.** Tillägget har inga servrar och gör inga egna
  nätverksförfrågningar.
- <!--i:photos--> **Fångade bilder** går direkt till Lolly-appen i samma webbläsare - laddas
  aldrig upp av tillägget.
- <!--i:link--> **URL:erna du fångar** används bara för att ladda den ena sidan för den ena
  skärmdumpen. De loggas eller delas inte.

**Behörigheter.**

- <!--i:wrench--> **`debugger`** - för att fånga den renderade sidan via DevTools Protocol (samma
  mekanism som Lollys skrivbordsapp använder).
- <!--i:monitor--> **`tabs`** - för att öppna och stänga den tillfälliga flik sidan laddas i.
- <!--i:globe--> **Värdåtkomst (`<all_urls>`)** - eftersom sidan du väljer att fånga kan vara
  på vilken webbplats som helst. Chrome visar detta vid installationen som en bred behörighets-
  varning. Tillägget besöker bara någonsin URL:en du ger det.

Ingen av dessa används för att läsa, övervaka eller överföra din surfning utöver den
ena begärda fångsten.

## Infrastrukturloggar

Precis som vilken webbplats som helst genererar servrarna bakom lolly.tools - och bakom varje
Lolly-driftsättning - standardmässiga webbserverloggar (access logs) närhelst en förfrågan
över huvud taget når dem: IP-adress, begärd sökväg, tidsstämpel, user agent. Det är
grundläggande hostingbeteende, inget Lolly lägger till ovanpå, och det innehåller aldrig
innehållet i dina dokument, eftersom de aldrig når en server över huvud taget. Det
enda avsiktliga undantaget är en fil du uttryckligen lämnar till ett MCP-
anrop av `lolly_transform`, `lolly_verify`, `lolly_redact` eller `lolly_rebrand`, som behandlas i minnet och aldrig
skrivs till disk eller en logg, som beskrivet ovan.

**Lollys egen kod skriver ingenting till de loggarna.** MCP-servern innehåller inga
loggningssatser alls. Certifikattjänsten avger exakt två rader, båda vid
fel och båda avsiktligt avskalade: en felstatuskod för misslyckad sändning utan
mottagaradress, och ett felmeddelande utan stackspårning eller URL (en stack skulle kunna
bära en registreringstoken). Allt annat i loggen tillhör värdplattformen,
inte oss.

För lolly.tools är hostingen Vercel, och lagringstiden för åtkomstloggar följer Vercels egna
plattformsstandarder för vårt abonnemang. Vi konfigurerar ingen loggexport, ingen långsiktig logg-
export och ingen analys- eller övervakningsprodukt ovanpå. Vi behåller ingen egen kopia av de här
loggarna, vilket också innebär att vi inte har något sätt att söka i dem åt dig - se
[Dina rättigheter](#your-rights).

## Rättslig grund, lagring och mottagare

Nästan ingenting här kräver en rättslig grund, eftersom nästan ingenting behandlas. För
fullständighetens skull, hela listan:

| Behandling | Rättslig grund (GDPR art. 6) | Sparas i |
|---|---|---|
| Allt på din enhet (dokument, inställningar, cache, räknare) | **Ingen behandling från vår sida alls** - det når oss aldrig. Lagring på din enhet är absolut nödvändig för den tjänst du begärt (ePrivacy art. 5(3)), och kräver därför inget samtycke | Tills du raderar det |
| Din e-postadress vid registrering av Content Credentials | **Art. 6(1)(b)**, fullgörande av en tjänst du uttryckligen begärt | Sparas inte. Finns i minnet endast under förfrågans varaktighet |
| En envägshärledd hinknyckel gjord från din IP-adress på inloggningsendpunkterna, för hastighetsbegränsning | **Art. 6(1)(f)**, vårt berättigade intresse av att förhindra missbruk av en gratis tjänst och av en tredje parts e-postkvot. Vi anser att detta klarar en intresseavvägning eftersom den råa adressen inte skickas till begränsaren, hinken bara används för missbrukskontroll och den går ut automatiskt | Ungefär 1 minut i missbrukskontrollagringen; sparas inte därefter |
| Åtkomstloggar för hosting (IP, sökväg, tidsstämpel, användaragent) | **Art. 6(1)(f)**, vårt berättigade intresse av tjänstesäkerhet, missbruksförebyggande och felsökning | Vercels plattformsstandard för vår plan. Vi lägger inte till någon utdragning eller export |

**Mottagare.** Kategorierna av mottagare är: vår hostingleverantör (Vercel
Inc.); vår leverantör av missbrukskontrollagring, som bara tar emot kortlivade,
envägshärledda hinknycklar och aldrig den råa IP-adressen; och - endast om du
använder e-postinloggning - en leverantör av transaktionsmejl (Resend). Om du loggar in
med GitHub, Google eller SUSE (id.suse.com) interagerar du direkt med den
leverantören enligt deras egen integritetspolicy. De lämnar oss en verifierad
e-postadress och inget annat. Vi delar inte personuppgifter med någon annan, och vi
säljer inte data, kör inte reklam eller profilerar användare.

**Överföringar utanför EES.** Vercel och Resend är amerikanska företag. Beräkningsfunktioner
för lolly.tools är fästa till Vercels Frankfurt-region (`fra1`) så
behandlingen sker i EU, men som USA-baserade leverantörer kan de ändå
få åtkomst till data som personuppgiftsbiträden från USA. Dessa överföringar bygger på Europeiska
kommissionens standardavtalsklausuler och/eller EU-US Data Privacy
Framework, enligt vad som anges i respektive leverantörs personuppgiftsbiträdesavtal. Eftersom
de personuppgifter som når dessa leverantörer är så begränsade - en e-postadress som skickas
vidare för att skicka ett meddelande, vanliga åtkomstloggar, och en kortlivad härledd
missbrukskontrollhink - är exponeringen motsvarande liten.

**Automatiserat beslutsfattande.** Inget. Det förekommer ingen profilering och inget automatiserat
beslut som ger rättsliga eller på liknande sätt betydande effekter (art. 22).

## Barns integritet

Lolly samlar inte medvetet in personuppgifter från någon, oavsett ålder, i
den vanliga användningen av appen - det finns inget att samla in. Den enda plats där
personuppgifter (en e-postadress) någonsin samlas in är vid registrering av Content Credentials,
som beskrivs ovan, vilket inte riktar sig till eller är avsett för barn.

## Dina rättigheter

Eftersom nästan allt Lolly rör vid endast lagras på din egen enhet är det mesta av
vad dataskyddslagstiftningen kallar "dina rättigheter" - tillgång, rättelse, radering,
portabilitet - saker du redan kan göra själv, direkt, utan att fråga
någon: din data finns i din webbläsares lagring, i en form du kan granska,
exportera (**Exportera mina data**, ovan) eller radera (genom att rensa sajtens lagring i din
webbläsare, som ovan).

Formellt har du enligt GDPR artikel 15-22 rätt att få **tillgång** till dina
personuppgifter, att **rätta** dem, att **radera** dem, att **begränsa** eller **invända
mot** behandlingen av dem (inklusive att invända mot allt vi grundar på berättigat
intresse), till **dataportabilitet** och - där behandlingen bygger på samtycke - att
**återkalla det samtycket när som helst**, utan att det påverkar lagligheten av det som
skedde innan du återkallade det.

Här är den ärliga positionen kring att utöva dem gentemot oss. Eftersom vi inte längre
för en utfärdandelogg, **har vi inga personuppgifter om dig som vi kan slå upp,
rätta, exportera eller radera.** Om du skriver och frågar vad vi har om dig är
det sanna svaret ingenting, och det säger vi rakt ut. Den enda kategori som alls finns
är åtkomstloggar för hosting kopplade till en IP-adress, som förvaras av vår hostingleverantör
enligt deras standardlagringstider. Vi har ingen möjlighet att söka i eller selektivt
radera dessa, och vi säger det istället för att låtsas annat. Allt som faktiskt är
din egendom finns på din enhet, där du redan kan läsa, exportera
och förstöra det utan att fråga någon om lov.

**Du har rätt att klaga.** Om du anser att vi har hanterat dina uppgifter
felaktigt kan du lämna in ett klagomål till en tillsynsmyndighet för dataskydd
- inom EU, myndigheten i ditt bosättningsland, ditt arbetsland eller där du anser
att överträdelsen skedde (art. 77). Vår ledande tillsynsmyndighet är *Bayerisches
Landesamt für Datenschutzaufsicht* (BayLDA) i Ansbach, Tyskland. Du behöver inte
kontakta oss först, även om vi gärna vill ha chansen att rätta till det.

Vi säljer inte data. Vi har ingen att sälja.

## Ändringar av denna policy

Datumet högst upp ändras varje gång detta dokument gör det. En ändring som påverkar
vad som lämnar din enhet eller vad som sparas får en egen rad här, inte en tyst
redigering - om du vill se vad som ändrats, fråga (nedan) eller jämför mot
[den publika källkoden](https://github.com/lolly-tools/lolly/commits/main/docs/privacy.md).

## Vem som ansvarar, och hur du når oss

**Personuppgiftsansvarig** för lolly.tools är:

> SUSE Software Solutions Germany GmbH
> Frankenstraße 146
> 90461 Nürnberg
> Tyskland

SUSE har utsett ett **dataskyddsombud**, nåbart på
[privacy@suse.com](mailto:privacy@suse.com). Använd den adressen för alla formella
förfrågningar under "Dina rättigheter" ovan.

Angående allt kring Lolly i sig - hur det fungerar, varför något är som det är eller
en rättelse av detta dokument - kontakta **Andy Fitzsimon**,
[fitzy@suse.com](mailto:fitzy@suse.com).

För en självhostad eller enterprise-instans av Lolly, kontakta istället den som
driver den: operatören är personuppgiftsansvarig för sin egen driftsättning. SUSE och
Lolly open source-projektet innehar inga uppgifter för driftsättningar de inte kör.
