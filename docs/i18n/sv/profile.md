# Profiler - vem du är när du skapar

En **profil** är den arbetsidentitet Lolly skapar *som*. Det är den lilla uppsättningen detaljer ett verktyg kan hämta från så att du slipper skriva om dem varje gång - ditt namn, kontaktuppgifter, en valfri profilbild, några inställningar - plus allt du samlar på dig medan du arbetar: sparade sessioner, uppladdade bilder och den lokala aktivitetssammanräkningen.

Allt i en profil finns **på enheten**, i webbläsarens lokala databas (IndexedDB i webb-PWA:n, filsystemet i Tauri-apparna). Det finns inget konto och inget laddas upp. Du hanterar den under **Profil** (uppe till höger i galleriet); verktyg *läser* den bara någonsin, och endast de specifika fälten de är byggda för att förifylla.

> En profil handlar om *dig* (eller vem det nu är som skapar här). Den är skild från **Platform** - varumärkets färger, typsnitt och globala inställningar - och från **Capabilities**, katalogen över vad appen kan göra. Se [Profile vs Platform vs Capabilities](#profile-vs-platform-vs-capabilities) i slutet.

## Vad som finns i en profil

| Del | Vad det är |
|---|---|
| **Namn** | För- och efternamn. |
| **Kontakt** | E-post och telefon. |
| **Plats** | Stad och land. |
| **Profilbild** | Ett valfritt foto, beskuret till en kvadrat och sparat som en lokal bild. Används av verktyg som e-postsignaturer, citatkort, organisationsscheman och dynamiska layouter. |
| **Använd mina uppgifter för att skapa** | En enda opt-in-omkopplare (den läser **Använder mina uppgifter** när den är på). Den styr om dina personuppgifter följer med som **proveniens** - upphovs-/kreditraden inbäddad i exporterade filer - och som upphovsman på **/pro**-batchkörningar. (Den spärrar inte förifyllnad: se [Hur verktyg använder din profil](#how-tools-use-your-profile).) |
| **Inställningar** | Ditt tema (Light, Dark eller Brand - varumärkestemat målar appen i din egen palett) och vilka delar av appen du har aktiverat via **Feature flags**. |
| **Tillgänglighet** | Fyra komfortomkopplare - *Minska rörelse*, *Dölj färgglada förhandsvisningar*, *Hög kontrast*, *Stor text* - lagrade på profilposten, så de följer med i en profilexport. Se [Tillgänglighet](#accessibility). |
| **Ditt arbete** | Sparade sessioner (med miniatyrbilder) - organiserade i nästlade mappar i **[Projects](/info/using.html)** - ditt **My images**-bibliotek och den lokala aktivitetsstatistiken, alla kopplade till denna profil. |

![Three theme cards, each previewing its own type and colour, with the active one flagged](/t/url-shot?url=%2F%23%2Fprofile&width=1440&height=1400&dpi=192&waitMs=1600&walker=1&format=svg&cropSelector=.profile-card--appearance&dark=1&filename=pd-theme-picker)

![Profilskärmen - namn, kontakt, en valfri profilbild och dina inställningar](/t/url-shot?url=%2F%23%2Fprofile&width=1440&height=900&dpi=192&waitMs=1600&format=svg&walker=1&localize=1&dark=1&filename=profile-details)

Inget av detta är obligatoriskt. En tom profil är en fullt godtagbar profil; du fyller bara i det som besparar dig onödigt skrivande.

Sidan är lång, så den har en egen **inställningsskena** längs sidan - Your details, Appearance, Accessibility, Lolly instance, Your activity, Storage, Available offline, Feature flags, Content Credentials - med ett **Search settings**-fält ovanför som filtrerar listan medan du skriver. Varje sektion kan djuplänkas som `#/profile?focus=<section-id>`, vilket öppnar den och skrollar den i vy (`#/profile?focus=storage-section`, `?focus=feature-flags-section` och så vidare), så en länk kan peka på en enskild inställning i stället för toppen av sidan.

![Tre temakort, vart och ett med en förhandsvisning av sin egen typografi och färg, med det aktiva flaggat](/t/url-shot?url=%2F%23%2Fprofile&width=1440&height=1400&dpi=192&waitMs=1600&walker=1&format=svg&cropSelector=.profile-card--appearance&dark=1&filename=pd-theme-picker)

## En profil är ett sammanhang, inte bara en person

Ordet "profil" antyder en fast person, men i Lolly är det egentligen ett **skapande sammanhang** - *vem du är medan du gör den här saken*. Det sammanhanget kan ha tre olika former, och Lolly hanterar dem alla på samma sätt.

### Som individ

![The headshot control, empty until you upload a photo that then stays on this device](/t/url-shot?url=%2F%23%2Fprofile&width=1440&height=900&dpi=192&waitMs=1600&format=svg&cropSelector=.profile-side&walker=1&dark=1&filename=pd-profile-headshot)

![Profilbildskontrollen, tom tills du laddar upp ett foto som sedan stannar på den här enheten](/t/url-shot?url=%2F%23%2Fprofile&width=1440&height=900&dpi=192&waitMs=1600&format=svg&cropSelector=.profile-side&walker=1&dark=1&filename=pd-profile-headshot)

### Som ett team

En profil behöver inte vara en enskild människa. Den kan representera ett **team eller en funktion inom en organisation**: teamets gemensamma namn, en gruppinkorgsadress (`events@…`), en avdelning, teamets profilbild eller enhetsmärke. En person sätter upp den, exporterar den (se nedan) och resten av teamet laddar samma profil - så allt teamet producerar bär konsekventa uppgifter utan att någon behöver mata in dem på nytt. En delad kiosk eller en utlånad demolaptop kan köra en enda teamprofil som alla bakom den skapar som.

### Som en funktion - en roll du bär ibland

Det här är fallet som den stelbenta modellen "en person, en profil" missar. Du kanske är **eventansvarig tre dagar om året** och något helt annat resten av tiden. De där tre dagarna vill du ha eventuppgifter, eventinkorgen, kanske ett event-undervarumärke som fyller i dina brickor och skyltar; de andra 362 vill du ha tillbaka din vanliga identitet.

I Lolly är den rollen bara **ännu en profil du har till hands** - ett sparat paket (nästa avsnitt) du läser in för eventet och lägger åt sidan efteråt. Rollen är en hatt, inte ett nytt konto. Ta på den när du behöver den, ta av den när du är klar.

## En installation, en aktiv profil - men du kan ha flera

I varje ögonblick har en installation **en aktiv profil** - de uppgifter ett verktyg ser just nu. Det finns ingen profilväxlare i appen; i stället är varje profil ett **portabelt paket** (en enda `.zip`, se [nedan](#moving-a-profile-to-a-new-device)). Det är medvetet samma mekanism som att flytta till en ny enhet - en profil är en fil du kan spara, kopiera och ladda.

![The storage meter, breaking down saved sessions, images and cache against what the browser actually reports](/t/url-shot?url=%2F%23%2Fprofile%3Ffocus%3Dstorage-section&width=1440&height=1800&dpi=192&waitMs=2400&css=.store-manages%2C.storage-subsection%2C.storage-actions%7Bdisplay%3Anone%7D&walker=1&format=svg&cropSelector=.store-meter&dark=1&filename=pd-storage-meter)

- <!--i:trash--> **Renaste bytet:** **Profile → Storage → Clear all my data**, och sedan **Import** paketet för det sammanhang du går in i. Nu skapar du helt och hållet som den profilen.
- <!--i:layers--> **Lagring:** att importera *utan* att först rensa **slår ihop** - den importerade profilen, sessionerna och bilderna hamnar ovanpå det som redan finns, ersätter allt med samma namn och lämnar resten. Praktiskt för att dra in ett teams sparade sessioner i din egen uppsättning; inte vad du vill om du behöver en ren rollgräns.
- <!--i:monitor--> **Sida vid sida:** eftersom allt är enhetsbundet bär en separat webbläsarprofil, ett separat användarkonto eller en andra installerad PWA var sin oberoende Lolly-profil. Kör din personliga installation och event-kioskens installation samtidigt, utan att växla.

Så om du verkligen jonglerar flera sammanhang (du, ditt team, eventansvarig-hatten), håller du flera paket och läser in det du behöver:

![Lagringsmätaren, som bryter ned sparade sessioner, bilder och cache mot vad webbläsaren faktiskt rapporterar](/t/url-shot?url=%2F%23%2Fprofile%3Ffocus%3Dstorage-section&width=1440&height=1800&dpi=192&waitMs=2400&css=.store-manages%2C.storage-subsection%2C.storage-actions%7Bdisplay%3Anone%7D&walker=1&format=svg&cropSelector=.store-meter&dark=1&filename=pd-storage-meter)

> Håll ett paket per sammanhang och döp om filerna efter vad de är (`LollyTools-events-2026.zip`, `LollyTools-me.zip`). Filen *är* profilen.

## Tillgänglighet

**Profile → Accessibility** rymmer fyra komfortinställningar för appen *runt* ditt arbete. Var och en är av tills du slår på den, och ingen av dem når in i en verktygscanvas eller en export - en lugnare app får inte flytta en enda pixel i filen du skickar.

- <!--i:film--> **Minska rörelse** - stänger av övergångarna, glidningarna och de animerade flourishesna i appen. Din verktygscanvas och alla animerade exporter fortsätter att röra sig precis som avsett.
- <!--i:image--> **Dölj färgglada förhandsvisningar** - byter ut galleriets förhandsvisningskonst mot lugna ikon-och-text-kort, och sänker färgen och kontrasten på dina projektminiatyrer så de förblir igenkännbara utan att skrika. Inuti ett verktyg visas allt i full färg.
- <!--i:sliders--> **Hög kontrast** - förstärker kanterna, texten och fokusringarna i appen. Dina varumärkesfärger och allt på canvasen förblir exakt som du ställt in dem.
- <!--i:font--> **Stor text** - förstorar apptexten: etiketter, menyer och knapptext. Kontrollerna behåller sin storlek, så bara orden inuti dem blir större, och texten i dina designer rörs inte, så inget du exporterar flödar om.

De här bor på själva profilposten, vilket är varför de följer med i en profilexport och landar på nästa installation tillsammans med ditt namn och dina sessioner. (Enheten behåller också en liten lokal spegling så att inställningen gäller före första målningen; den speglingen är enhetsbunden och följer inte med.)

## Din Lolly-instans

**Profile → Lolly instance** anger var den här installationen hämtar sina verktyg och sin katalog ifrån - instansens adress, eller *Bundled with this app* när allt levereras inuti bygget. Där en driftsättning erbjuder en visas en **Instance console**-länk som öppnar dess administrationsyta, och **Change** / **Disconnect** pekar om installationen eller kopplar loss den.

Att peka om mot en annan instans kräver **skrivbordsappen**: en webbläsare blockerar en sida från att ladda verktyg och tillgångar över origin, så på webben rapporterar sektionen bara var du är och lämnar det så.

## Tillgängligt offline

Lolly cachar allteftersom, men cachning-allteftersom täcker bara där du redan varit. **Profile → Available offline** är till för resan du ser komma: en timme på flygplatsens wifi innan en flygning utan något alls. Ladda ner delarna du kommer behöva, se en enda förloppsindikator, och allt du tog med fortsätter fungera när anslutningen är borta.

Sju delar, var och en med sin storlek angiven innan du bestämmer dig:

- <!--i:layout--> **Appen** - varje vy, redigerare och typsnitt, inklusive de du inte öppnat än. Utan detta kan en skärm du aldrig besökt online inte laddas offline.
- <!--i:image--> **Katalog** - varumärkestillgångar utöver det nödvändigaste. Ta allt, eller öppna *Choose by tag* och ta bara de taggar du använder.
- <!--i:book--> **Guider och dokumentation** - den här dokumentationswebbplatsen, på ditt språk, inklusive skärmdumpar.
- <!--i:cpu--> **Talröster** - röstmodellerna bakom Script-ljud och berättarröst. Nedladdade en gång, sedan körs det på enheten.
- <!--i:zap--> **Uppskalningsmodeller** - AI-bilduppskalarna: foto, illustration/anime och ansikte.
- <!--i:layers--> **Bakgrundsborttagning** - utklippsmodellerna på enheten bakom *Remove background*.
- <!--i:shield--> **Verify deep scan** - vattenmärkesskannern på enheten, för att kontrollera Content Credentials utan uppkoppling.

De sista fyra är märkta **stor nedladdning** och är avsiktligt individuella tillval: **Ladda ned allt** högst upp tar appen, den katalogomfattning du valt, dokumentationen och alla verktyg i en enda omgång och inget annat. Röster för tal, uppskalarna, bakgrundsborttagning och den djupa skanningen laddas var för sig endast när du begär just den raden vid namn - några hundra megabyte gömda i en enda knapp vore ohederligt.

Under delarna finns listan per verktyg: varje verktyg laddas ned individuellt (bocken betyder klart för offlinebruk), eller så sveper **Ladda ned alla** över allihop. Nedladdningar går att återuppta - avbryt eller tappa anslutningen och nästa körning fortsätter där den slutade och hämtar bara det som saknas - och de uppdaterar sig själva när du är online igen och hämtar bara det som en ny version ändrat.

Om webbläsaren inte har beviljat permanent lagring säger avsnittet det och erbjuder **Skydda nedladdningar**, som ber om det - skillnaden mellan "nedladdat" och "nedladdat tills webbläsaren vill ha tillbaka utrymmet".

## Flytta en profil till en ny enhet

![The two buttons that move a whole install: Export my data writes one zip, Import data reads it back](/t/url-shot?url=%2F%23%2Fprofile%3Ffocus%3Dstorage-section&width=1440&height=1800&dpi=192&waitMs=2400&css=.store-manages%7Bdisplay%3Anone%7D&walker=1&format=svg&cropSelector=.storage-subsection&dark=1&filename=pd-transfer-controls)

Eftersom en profil är helt lokal är det enda sättet att få den till en tom installation - en ny bärbar dator, en nyligen återställd webbläsare, en kollegas maskin, en offline-burk - att **ta med filen**. Ingen inloggning återställer den åt dig, och det är hela poängen: inget lämnade någonsin din enhet från början.

- <!--i:download--> **Export my data** laddar ner en `LollyTools-<First>-<Last>-<YYYY-MM-DD>-<n>.zip` - uppkallad efter profilen den tillhör, med ett sekvensnummer per dag så att upprepade exporter inte krockar (namndelar utelämnas om profilen saknar dem). Den innehåller din profil, varje sparad session (med sin miniatyrbild), dina uppladdade bilder - dina varumärkestoken och installerade typsnitt följer med som användartillgångar - och dina inställningar (tema, layout, lokal aktivitetsstatistik).
- <!--i:upload--> **Import data…** på den andra installationen läser in den filen igen så att du fortsätter precis där du slutade.
- <!--i:box--> **Export my data & render everything** skriver samma säkerhetskopia *plus* en andra zip-fil som renderar varje sparad session till sin färdiga utdatafil, i mappar som speglar dina Projects. Ett komplett offlinearkiv av både källorna och resultaten - och det kan bli stort och långsamt med många sessioner.

![De två knapparna som flyttar en hel installation: Exportera mina data skriver en zip, Importera data läser in den igen](/t/url-shot?url=%2F%23%2Fprofile%3Ffocus%3Dstorage-section&width=1440&height=1800&dpi=192&waitMs=2400&css=.store-manages%7Bdisplay%3Anone%7D&walker=1&format=svg&cropSelector=.storage-subsection&dark=1&filename=pd-transfer-controls)

Paketet är en enkel, självständig zip-fil, så den kan färdas på **vilket** sätt som helst - USB, AirDrop, en nätverksdelning, e-post till dig själv - och målet kan vara helt offline. Varje del är checksummerad, så en fil som skadats under transporten fångas upp vid import istället för att återställas halvtrasig. Import **slår samman** (profil/session/bild med samma namn skrivs över; allt annat behålls), så den suddar aldrig ut ett mål som redan är i bruk.

Det som inte följer med: katalogcachen (den laddas ner igen på den nya enheten) och själva verktygen (antas redan finnas där).

För den exakta paketstrukturen, versionspolicyn och integritetsreglerna, se **[Dataöverföring](/info/data-transfer.html)**; för den fullständiga genomgången, **[Använda Lolly → Flytta till en annan enhet](/info/using.html#moving-to-another-device)**.

## Hur verktyg använder din profil

![The single Use my details switch, sitting beside Save Profile and off until you turn it on](/t/url-shot?url=%2F%23%2Fprofile&width=1440&height=900&dpi=192&waitMs=1600&format=svg&cropSelector=.profile-check&walker=1&dark=1&filename=pd-use-my-details)

Ett verktyg *förifyller* bara någonsin de profilfält det uttryckligen är byggt för att binda till:

**Tillvalet (proveniens).** När du exporterar en tillgång följer dina uppgifter valfritt med som **proveniens** - en upphovs-/krediteringsrad inbäddad i filens metadata (PNG, PDF, SVG, …) - så att en färdig tillgång kan visa vem som gjorde den. Det är *detta* som **Använd mina uppgifter för att skapa** styr: låt den vara av och exporten bär ändå attributionen "Made with Lolly" för verktyg/plattform, men ingen personlig upphovs-/kontaktrad bäddas in. (Samma tillval sätter upphovspersonen på batchkörningar i **/pro**.) (Verktygsförfattare: se [Authoring Tools → `bindToProfile`](/info/authoring-tools.html#bindtoprofile) och [Host API → `host.profile`](/info/host-api.html#host-profile).)

![Den enda omkopplaren Använd mina uppgifter för att skapa, bredvid Spara profil och av tills du slår på den](/t/url-shot?url=%2F%23%2Fprofile&width=1440&height=900&dpi=192&waitMs=1600&format=svg&cropSelector=.profile-check&walker=1&dark=1&filename=pd-use-my-details)

## Profil vs plattform vs funktioner

Tre saker ligger nära varandra i gränssnittet och är lätta att blanda ihop:

- <!--i:people--> **Profil** - *du* (eller ditt team, eller den roll du har): namn, kontakt, porträttbild, ditt sparade arbete. Personlig, enhetslokal, portabel som ett paket.
- <!--i:palette--> **Plattform** - *varumärket*: färger, typsnitt och globala inställningar som varje verktyg renderar mot. Delad och konsekvent, inte personlig.
- <!--i:sliders--> **Funktioner** - *vad appen kan göra*: hela funktionsuppsättningen och verktygen som är tillgängliga för dig.

En profil ändrar vem en tillgång är *från*; plattformen ändrar hur den *ser ut*; funktioner är *vad du kan skapa*.

### "Profil" betyder två andra saker på andra ställen - inte det här

Ordet är överanvänt i projektet. Ingen av dessa är den personliga profil som den här sidan handlar om:

- <!--i:box--> **Innehållsprofil** - en byggtidskonfiguration i `profiles.json` som binder en uppsättning verktygspaket till en varumärkeskatalog (t.ex. `suse`, `lolly-start`). Det är vad en operatör väljer vid driftsättning, och det är vad **URL-/CLI-parametern** `profile` också väljer - en *färg*-variant vid export (pressförhållandet ICC/CMYK - se [URL-läge](/info/url-mode.html)). Båda handlar om *bygget/utdatan*, inte om *dig*. Se [Konfiguration](/info/configuration.html).
- <!--i:seal--> **Identitetsprofil** - den valfria **verifierade Content Credentials-identiteten** du kan registrera (ett kortlivat certifikat som knyter din e-post till dina signerade exporter). Det är en signeringsidentitet, skild från den personliga profilens namn-/kontaktfält, även om **Använd mina uppgifter för att skapa** styr om någon av dem bäddas in. Se [Content Credentials-identitet](/info/content-credentials-identity.html).

![Kortet Verifierad identitet, telefonbredd: väljaren för certifikatets livslängd och registreringssteget under den - identitetsprofilen, skild från dina personliga uppgifter](/t/url-shot?url=%2F%23%2Fprofile%3Ffocus%3Didentity-section&width=430&height=1600&dpi=192&waitMs=2400&css=.welcome-dialog%2C.personalize-nudge%7Bdisplay%3Anone%7D&format=svg&walker=1&cropSelector=%23identity-section&dark=1&filename=pv-identity-enrol)

## Integritet

Utöver den valfria identitetsregistreringen ovan (som skickar den e-post du registrerar till certifikattjänsten - se [Serverns yta](/info/server-surface.html)) skickas en profil aldrig, laddas aldrig upp och används aldrig för att identifiera eller spåra dig - det finns inget att samtycka till, bara denna information så att du vet vad som sparas. Radera allt av det när som helst med **Profil → Radera alla mina data**. Se [Integritetspolicyn](/info/privacy.html).
