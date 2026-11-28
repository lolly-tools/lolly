# Verifiera själv

Varje löfte på den här webbplatsen kan kontrolleras, utan konto. De flesta kontroller kräver bara en webbläsare; resten kräver en terminal och en kopia av källkoden. Om en kontroll nedan inte ger det resultat som visas är det ett fel eller ett brutet löfte, och vi vill veta: se [Om en kontroll misslyckas](#if-a-check-fails).

Dessa kontroller gäller Lolly på egen hand. Om din organisation kör Lolly Work tillkommer inloggning, delat innehåll, konfigurerad telemetri och granskningsposter; kontrollera dem mot [Servergränssnitt](/info/server-surface.html) och [organisationsavsnittet i integritetspolicyn](/info/privacy.html#organisation-services-with-lolly-work).

<!--i:eti-clock-->
## Se det fungera, på tio sekunder

Öppna [`/verify`](/#/verify) och släpp en fil på sidan. Ingen uppladdning, inget konto och ingen väntan på en server. Här kontrolleras den [genererade stormen i Queensland](/info/ai-stance.html) från Vår syn på AI: en bild som Gemini genererade och som Lolly öppnade, märkte och konverterade. Varje märke beräknades på enheten, utifrån filens egna byte.

![Lolly Verify på en skärm med telefonbredd - stormbilden, ett grönt omdöme Made with Lolly och märkena för intakt intyg och oförändrade byte staplade under det](/t/url-shot?url=%2F%23%2Fverify%3Fsrc%3D%2Finfo%2Fthe-flood.webp&width=440&height=1500&dpi=192&waitMs=6000&waitSelector=.valid-steps&walker=1&format=svg&rasterDpi=96&cropSelector=.valid-top&dark=1&filename=cc-verify-mobile)

Omdömet är en liten samling märken, vart och ett ett oberoende faktum:

- <!--i:lock--> **Made with Lolly**: intyget är intakt *och* registrerar en Lolly-export.
- <!--i:seal--> **The credential is intact**: det signerade C2PA-manifestet kan parsas och dess egen påståendesignatur kan verifieras.
- <!--i:hash--> **The bytes have not changed**: filens hashvärde matchar fortfarande det som signerades. Ändra en pixel så ändras det här märket.
- <!--i:sparkle--> **GEN AI**: en maskin skapade dessa pixlar, och filen säger det. Lolly läser ut den deklarationen i stället för att dölja faktumet.

Hela historiken följer med filen. Nio steg finns kvar här: fem som Google registrerade när det genererade och vattenmärkte bilden, sedan fyra som Lolly registrerade när det öppnade, märkte och konverterade kopian på den här sidan. Lolly Verify läser dem direkt ur byten och ritar dem som en tidslinje.

![Ändringshistoriken som Lolly Verify läser ut ur stormbilden - fem steg registrerade av Google, sedan fyra av Lolly, med WebP-filen på den här sidan som sista steg](/t/url-shot?url=%2F%23%2Fverify%3Fsrc%3D%2Finfo%2Fthe-flood.webp&width=1440&height=1400&dpi=192&waitMs=6000&walker=1&format=svg&cropSelector=.valid-steps&dark=1&filename=ai-stance-change-history)

Kontrollerna nedan är garantierna bakom den demonstrationen, och var och en går att upprepa. [Content Credentials](/info/content-credentials-identity.html) förklarar varje omdöme.

<!--i:eti-globe-->
## I din webbläsare, utan verktyg

::: timeline
- <!--i:globe--> **1. Titta på nätverket.** Öppna [lolly.tools](https://lolly.tools), öppna webbläsarens DevTools (F12), byt till **Network** och använd ett verktyg: skriv en webbadress i [Lolly QR Code](/t/qr-code), ändra färger, exportera en PNG. Varje begäran går till `lolly.tools`: appskalet, verktygets egna filer och katalogtillgångar. Det finns ingen analysvärd, ingen CDN-spårsignal, ingen typsnittstjänst och ingen felrapporteringsändpunkt. Det du skriver i ett verktyg syns **inte i någon begäran alls**, eftersom renderingen är lokal.
- <!--i:eyeoff--> **2. Koppla från.** Ladda appen och öppna ett eller två verktyg, gå sedan offline (flygplansläge, eller DevTools → Network → Offline) och ladda om. Galleriet och varje verktyg du öppnade fortsätter fungera, inklusive rendering och export i de format du använde. Ett verktygs filer och ett formats kodare cachas första gången du använder dem, så använd ett verktyg en gång online innan du testar det offline. Det här är den starkaste enskilda kontrollen på den här sidan: programvara som ringer hem klarar inte att sladden dras ur.
- <!--i:check--> **3. Räkna kakorna.** DevTools → **Application** (Firefox: **Storage**) → Cookies → `https://lolly.tools`. Listan är tom: appen sätter inga kakor. Klistra in `document.cookie` i konsolen så får du `""`. Den valfria CA-registreringen sätter en kortlivad `HttpOnly`-kaka, `lolly_ca_state`, avgränsad till `/api/ca`, som `document.cookie` inte kan visa. En Lolly Work-instans använder egna inloggningskakor; jämför dem med [Integritet](/info/privacy.html#organisation-services-with-lolly-work).
- <!--i:layers--> **4. Läs din egen lagring.** I samma panel ligger allt Lolly sparar framför dig: ett par dussin vanliga `localStorage`-nycklar (tema, språk, sidofältsbredd, ljud- och vyinställningar och en cachad kopia av det offentliga verktygskatalogindexet) och dina egna dokument i IndexedDB. Varje värde är en läsbar sträng eller JSON, utan något fördolt. Att rensa webbplatsdata tar bort dessa lokala poster, men inte en Sync-säkerhetskopia eller poster som lagras av en Lolly Work-instans. **Settings → Storage → Clear all my data** gör samma sak inifrån appen, och du kan se lagren och cacharna tömmas.
- <!--i:lock--> **5. Kontrollera att kontakten för sårbarhetsrapportering finns.** [`/.well-known/security.txt`](/.well-known/security.txt) svarar med ett kontaktblock enligt [RFC 9116](https://www.rfc-editor.org/rfc/rfc9116), inte en HTML-sida.
:::

::: details Vad du mer kan se på fliken Network
Vissa funktioner använder nätverket bara när du använder dem, och var och en syns på samma flik:

- att lägga till ett **Google Font** i Lolly Design System Setup hämtar den enda familjen från Google, efter en samtyckesdialog som säger det, en gång, före den första hämtningen;
- att klicka på en **förinställning för ICC-tryckprofil** hämtar den profilen från ICC:s offentliga register på color.org;
- att spela den valfria inbyggda **radion** strömmar från stationen;
- att ange en plats i **Meeting Planner** slår upp platsen hos open-meteos geokodningstjänst för dess koordinater och tidszon, en gång per stad (svaren sparas på din enhet), och fältet upplyser om det där du skriver;
- **Lolly URL Screenshot** laddar adressen du skrev, och du ser det hända.

Ett verktyg som deklarerar en nätverkskapabilitet får bara hämta från de värdar som dess manifest uttryckligen tillåter, och vid fel nekar kontrollen åtkomst. Inget verktyg som levereras i dag deklarerar en sådan, så webbläsarens Content-Security-Policy begränsar listan ovan till dess värdar. [Integritetspolicyn](/info/privacy.html) har den kanoniska tabellen över alla dessa, inklusive trafik för hanterade instanser som policyuppdateringar och aktiverad rapportering.
:::

<!--i:eti-code-->
## Från en terminal

**6. Renderingsändpunkten svarar bara med offentliga data.** Den enda serverfunktion som lägger inskrivna indata i en URL, direktlänkade renderingar, är aktiv här. [Integritetspolicyn](/info/privacy.html) säger vad det betyder för de indata du lägger i en länk.

```bash
curl -s -o /dev/null -w '%{http_code}\n' 'https://lolly.tools/tool/qr-code.svg?url=test'
# 200
```

Varje driftsättning väljer (`LOLLY_DISABLE_RENDER_GET=1`): på en instans som sätter variabeln returnerar samma kontroll `404`. Den skillnaden visar att inställningen fungerar, inte en inkonsekvens.

**7. Kontrollera de tjänster som din driftsättning aktiverar.** [Servergränssnitt](/info/server-surface.html) listar de valfria tjänsterna och länkar till deras detaljerade referenser. För Lolly Work ska dess autentiserade API:er, samarbetsanslutning, lagring och konfigurerade leverantörer ingå. En kontroll av offentliga lolly.tools testar inte en privat organisationsinstans.

Om du kör en egen instans finns releasekontrollerna i [Driftsättning av leverans](/info/deploy-delivery.html): modellintegritet, edge-kontrollen och dess provlista, visningsvarianter, den privata nedladdningsgatewayen och den signerade katalogen i en webbläsare.


<!--i:eti-search-->
## I källkoden

Allt ovan skulle fortfarande kunna vara ett skådespel om den driftsatta koden skilde sig från den offentliga koden. Så kontrollera koden. Driftsättningen byggs från [det offentliga kodförrådet](https://github.com/lolly-tools/lolly):

```bash
git clone https://github.com/lolly-tools/lolly.git
cd lolly
```

**8. Inga spårare och inga analys-SDK:er, någonstans.** Sök i koden som levereras (motorn, varje skal inklusive webbläsartillägget, Tauri-bryggans åsidosättningar och service workern, serverfunktionerna och verktygspaketen) efter de vanliga misstänkta:

```bash
grep -rnF --include='*.ts' --include='*.js' --include='*.mjs' --include='*.html' \
  -e googletagmanager -e google-analytics -e posthog -e mixpanel -e hotjar \
  -e sentry.io -e segment.com -e '@vercel/analytics' \
  engine/src shells/*/src shells/chrome-extension shells/*/bridge-overrides \
  shells/web/public/sw.js services packages api community brands/*/tools
# (no output)
```

Den här sökningen letar efter spårnings-SDK:er från tredje part. Den visar inte att egen användningsrapportering saknas: Lolly Work stöder organisationstelemetri och en separat granskningslogg, med egna policyer och tester.

**9. Ingen DNS-resolver från tredje part.** Lolly Verifys SEAL-kontroll skickar aldrig en uppslagning genom en DNS-over-HTTPS-leverantör, eftersom appen inte har någon resolver:

```bash
grep -rnF --include='*.ts' --include='*.js' --include='*.mjs' \
  -e cloudflare-dns.com -e dns.google -e /dns-query \
  engine/src shells/*/src shells/chrome-extension shells/*/bridge-overrides \
  shells/web/public/sw.js services packages api community brands/*/tools
# (no output: outside this page and its built copies, the only place those
#  hostnames appear in the repo is tests/no-trackers.test.ts, the test that
#  bans them)
```

**10. Certifikattjänsten för ingen utfärdandelogg.** Identitets-CA:n för ingen logg över vad den utfärdat och inget register över identiteter: ingen stdout-rad, ingen webhook, inget certifikatlager. Frånvaron går att söka efter:

```bash
grep -rn logIssuance services/ca api/ca
# (no output)
```

CA:n behåller dock kortlivat arbetstillstånd: behållare för anropsbegränsning lagrar hashade IP- och e-postnycklar under sitt tidsfönster, och antagningslagret i en hanterad driftsättning behåller en nyckelbaserad identifierare och kontrollsumman för begäran i högst tio minuter. [Tekniken bakom Content Credentials](/info/content-credentials-engineering.html#protocol) har detaljerna.

<!--i:eti-flask-->
## Upprätthålls av tester

Källkodskontrollerna ovan är ingen engångsgranskning: de är fastlagda i testsviten, så de kan inte förfalla obemärkt. [`tests/no-trackers.test.ts`](https://github.com/lolly-tools/lolly/blob/main/tests/no-trackers.test.ts) kontrollerar en längre lista med spårarnamn än sökningen ovan och underkänner bygget om:

- något analys- eller spårnings-SDK förekommer någonstans i den levererade källkod som genomsöks, i app-, motor-, server-, tilläggs- och verktygspaketskod;
- någon DNS-over-HTTPS-resolver från tredje part förekommer i den källkoden;
- CA:ns utfärdandelogg återkommer, i källkoden **eller** det genererade serverpaketet;
- integritetspolicyn förlorar sina lagstadgade uppgifter (namngiven personuppgiftsansvarig, rättslig grund, rätt att klaga).

Kör dem själv i den klonade kopian (Node 22.18 eller senare; den här filen kräver ingen `pnpm install`):

```bash
node --test tests/no-trackers.test.ts
# ✔ no analytics or tracking SDK appears anywhere in shipped source
# ✔ no third-party DNS-over-HTTPS resolver is contacted
# ✔ the certificate service logs no personal data
# ✔ privacy policy states a controller, a legal basis and a right to complain
```

Den fullständiga sviten (`pnpm install && pnpm test`) kör flera tusen till, inklusive de angreppsinriktade kryptografitester som beskrivs i [Säkerhet & verifiering](/info/security.html).

<!--i:eti-eye-off-->
## Vad du inte kan verifiera utifrån

- **Åtkomstloggar hos värden.** Varje server kan logga de begäranden den besvarar: IP-adress, sökväg och tid. En extern kontroll kan inte fastställa hur länge loggar sparas. Operatören styr loggning, rotation och exporter och måste redovisa de valen. Lokal rendering håller vanliga redigeringar på din enhet; valfri serverrendering och delade arbetsytetjänster har de separata dataflöden som integritetspolicyn beskriver.
- **Att driftsättningen kör den här koden.** Du kan kontrollera att källkoden är ren och att det driftsatta beteendet stämmer med källkoden, och kontrollerna ovan gör båda delarna. Webbplattformen erbjuder ingen attestering på binärnivå av en webbdriftsättning. Skydden är det offentliga kodförrådet, de obligatoriska testerna och offlinekontrollen: en manipulerad driftsättning som ringer hem misslyckas direkt i kontroll 1 och 2.
- **Verktygshookar.** Ett inbyggt verktygs valfria logik granskas i stället för att köras i en sandlåda: den körs på sidan om verktyget inte väljer en Worker. Varje verktyg på lolly.tools är egenutvecklat och granskas innan det levereras. [Hotmodellen](/info/threat-model.html#trust-boundaries) beskriver var hookar körs och vad som begränsar dem.

<!--i:eti-warning-->
## Om en kontroll misslyckas

En skillnad mellan den här sidan och det du observerar är en säkerhetsrapport. Skicka den genom de privata kanalerna på [Säkerhet & verifiering](/info/security.html#reporting-a-vulnerability). Vi tillämpar samordnat offentliggörande och ger erkännande till dem som rapporterar.
