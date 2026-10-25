# Verifiera det själv

Varje löfte på den här webbplatsen kan kontrolleras, utan konto. De flesta kontroller behöver bara en webbläsare; resten behöver en terminal och en kopia av källkoden. Om en kontroll nedan inte ger det visade resultatet är det en bugg eller ett brutet löfte, och vi vill höra om det: se [Om en kontroll misslyckas](#if-a-check-fails).

Börja med den snabbaste: släpp en fil på Verify. Gå sedan längre: titta på nätverket medan du använder ett verktyg, dra ur sladden och fortsätt arbeta, räkna cookies och läs källkoden.

De här kontrollerna gäller Lolly på egen hand. Om din organisation kör Lolly Work lägger det till inloggning, delat innehåll, konfigurerad telemetri och granskningsposter; kontrollera dem mot [Server Surface](/info/server-surface.html) och [organisationsavsnittet i integritetspolicyn](/info/privacy.html#organisation-services-with-lolly-work).

## Se det fungera, på tio sekunder

Öppna [`/verify`](/#/verify) och släpp en fil på sidan. Det finns ingen uppladdning, inget konto och ingen väntan på en server. Här kontrollerar den [den genererade Queensland-stormen](/info/ai-stance.html) från Vår hållning till AI: en bild som Gemini genererade, som Lolly öppnade, märkte och konverterade. Varje märke räknades ut på enheten, från filens egna byte.

![Verify på en skärm i telefonbredd - stormbilden, ett grönt Made with Lolly-utlåtande och badgarna för intakt uppgift och oförändrade byte staplade under den](/t/url-shot?url=%2F%23%2Fverify%3Fsrc%3D%2Finfo%2Fthe-flood.webp&width=440&height=1500&dpi=192&waitMs=6000&waitSelector=.valid-steps&walker=1&format=svg&rasterDpi=96&cropSelector=.valid-top&dark=1&filename=cc-verify-mobile)

Utlåtandet är en liten hög med märken, vart och ett ett oberoende faktum:

- <!--i:lock--> **Made with Lolly**: credentialen är intakt *och* registrerar en Lolly-export.
- <!--i:seal--> **The credential is intact**: det signerade C2PA-manifestet tolkas och dess egen anspråkssignatur verifieras.
- <!--i:hash--> **The bytes have not changed**: filens hash matchar fortfarande det som signerades. Ändra en pixel och det här märket slår om.
- <!--i:sparkle--> **GEN AI**: en maskin gjorde de här pixlarna, och filen säger det. Lolly läser den deklarationen tillbaka i stället för att dölja faktumet.

Hela historiken följer med filen. Nio steg överlever här: fem som Google registrerade när den genererade och vattenstämplade bilden, sedan fyra som Lolly registrerade när den öppnade, märkte och konverterade kopian på den här sidan. Verify läser dem direkt ur byten och ritar dem som en tidslinje.

![Ändringshistoriken Verify läser tillbaka ur stormbilden - fem steg registrerade av Google, sedan fyra av Lolly, som slutar i webp-filen på den här sidan](/t/url-shot?url=%2F%23%2Fverify%3Fsrc%3D%2Finfo%2Fthe-flood.webp&width=1440&height=1400&dpi=192&waitMs=6000&walker=1&format=svg&cropSelector=.valid-steps&dark=1&filename=ai-stance-change-history)

Det är demon. Kontrollerna nedan är garantierna under den, och var och en är reproducerbar. [Content Credentials](/info/content-credentials-identity.html) förklarar varje utlåtande.

## I din webbläsare, inga verktyg krävs

::: timeline
- <!--i:globe--> **1. Titta på nätverket.** Öppna [lolly.tools](https://lolly.tools), öppna webbläsarens DevTools (F12), byt till **Network** och använd ett verktyg: skriv en webbadress i [QR Code](/t/qr-code), ändra färger, exportera en PNG. Varje förfrågan stannar på `lolly.tools`: appskalet, verktygets egna filer och katalogtillgångar. Det finns ingen analysvärd, ingen CDN-beacon, ingen typsnittstjänst och ingen slutpunkt för felrapportering. Det du skriver i ett verktyg syns i **ingen förfrågan alls**, eftersom renderingen är lokal.
- <!--i:eyeoff--> **2. Dra ur sladden.** Läs in appen och öppna ett verktyg eller två, gå sedan offline (flygplansläge, eller DevTools → Network → Offline) och ladda om. Galleriet och varje verktyg du öppnade fortsätter fungera, inklusive rendering och export i formaten du använde. Ett verktygs filer och ett formats kodare cachas första gången du använder dem, så använd ett verktyg en gång online innan du testar det offline. Det här är den starkaste enskilda kontrollen på den här sidan: programvara som ringer hem överlever inte att sladden kapas.
- <!--i:check--> **3. Räkna cookies.** DevTools → **Application** (Firefox: **Storage**) → Cookies → `https://lolly.tools`. Listan är tom: appen sätter inga cookies. Klistra in `document.cookie` i konsolen så får du `""`. Den valfria CA-registreringen sätter en kortlivad `HttpOnly`-cookie, `lolly_ca_state`, avgränsad till `/api/ca`, som `document.cookie` inte kan visa. En Lolly Work-instans använder egna inloggningscookies; jämför dem med [Integritet](/info/privacy.html#organisation-services-with-lolly-work).
- <!--i:layers--> **4. Läs din egen lagring.** I samma panel finns allt Lolly behåller framför dig: ett par dussin vanliga `localStorage`-nycklar (tema, språk, sidofältsbredd, ljud- och visningsinställningar, och en cachad kopia av det publika verktygskatalogindexet) och dina egna dokument i IndexedDB. Varje värde är en läsbar sträng eller JSON, utan något obfuskerat. Att rensa webbplatsdata tar bort de här lokala posterna, men inte en Sync-säkerhetskopia eller poster som en Lolly Work-instans håller. **Settings → Storage → Clear all my data** gör detsamma inifrån appen, och du kan se lagren och cacharna tömmas.
- <!--i:lock--> **5. Kontrollera att kontaktvägen för rapportering finns.** [`/.well-known/security.txt`](/.well-known/security.txt) svarar med ett [RFC 9116](https://www.rfc-editor.org/rfc/rfc9116)-kontaktblock, inte en HTML-sida.
:::

::: details Vad mer du kan se i fliken Network
Vissa funktioner når nätverket bara när du använder dem, och var och en syns i samma flik:

- att lägga till ett **Google Font** i Design System Setup hämtar den familjen från Google, efter en samtyckesdialog som säger det, en gång, före den första hämtningen;
- att klicka på en **ICC press-profile preset** hämtar den profilen från ICC:s publika register på color.org;
- att spela den valfria inbyggda **radion** strömmar från stationen;
- att ange en plats i **Meeting Planner** slår upp den platsen hos open-meteos geokodningstjänst för dess koordinater och tidszon, en gång per stad (svar sparas på din enhet), och fältet säger det där du skriver;
- **URL Screenshot** laddar adressen du skrev, eftersom det är dess jobb, och du ser det ske.

Ett verktyg som deklarerar en nätverksförmåga får bara hämta från de värdar dess manifest tillåtlistar, och den kontrollen misslyckas på den säkra sidan. Inget verktyg som levereras i dag deklarerar en, så den webbläsarupprätthållna Content-Security-Policy är det som håller listan ovan till sina värdar. [Integritetspolicyn](/info/privacy.html) har den kanoniska tabellen över allt detta, inklusive trafik från hanterade instanser som policyuppdateringar och aktiverad rapportering.
:::

## Från en terminal

**6. Renderingsslutpunkten svarar bara med publika data.** Den enda serverfunktionen som lägger skrivna indata i en URL, hot-link-renderingar, är live här. [Integritetspolicyn](/info/privacy.html) säger vad det betyder för indata du lägger i en länk.

```bash
curl -s -o /dev/null -w '%{http_code}\n' 'https://lolly.tools/tool/qr-code.svg?url=test'
# 200
```

Varje installation väljer (`LOLLY_DISABLE_RENDER_GET=1`): på en instans som sätter den returnerar samma prob `404`. Den skillnaden är inställningen som fungerar, inte en inkonsekvens.

**7. Kontrollera tjänsterna din installation aktiverar.** [Server Surface](/info/server-surface.html) listar de valfria tjänsterna och länkar deras detaljerade referenser. För Lolly Work, ta med dess autentiserade API:er, collab-anslutning, lagring och konfigurerade leverantörer. En prob mot publika lolly.tools testar inte en privat organisationsinstans.

Om du kör din egen instans har [Delivery deployment](/info/deploy-delivery.html) releasekontrollerna för den: modellintegritet, kantproben och dess exempellista, visningsrenderingar, den privata nedladdningsgatewayen och den signerade katalogen i en webbläsare.


## I källkoden

Allt ovan kunde ändå vara teater om den driftsatta koden skilde sig från den publika koden. Så kontrollera koden. Installationen byggs från [det publika arkivet](https://github.com/lolly-tools/lolly):

```bash
git clone https://github.com/lolly-tools/lolly.git
cd lolly
```

**8. Ingen spårare och inget analys-SDK, någonstans.** Sök i koden som levereras (motorn, varje skal inklusive webbläsartillägget, Tauri-bryggans överskrivningar och service workern, serverfunktionerna och verktygspaketen) efter de vanliga misstänkta:

```bash
grep -rnF --include='*.ts' --include='*.js' --include='*.mjs' --include='*.html' \
  -e googletagmanager -e google-analytics -e posthog -e mixpanel -e hotjar \
  -e sentry.io -e segment.com -e '@vercel/analytics' \
  engine/src shells/*/src shells/chrome-extension shells/*/bridge-overrides \
  shells/web/public/sw.js services packages api community brands/*/tools
# (no output)
```

Den här skanningen letar efter spårnings-SDK:er från tredje part. Den visar inte att förstapartsanvändningsrapportering saknas: Lolly Work stöder organisationstelemetri och en separat granskningslogg, med egen policy och egna tester.

**9. Ingen DNS-resolver från tredje part.** Verifys SEAL-kontroll skickar aldrig ett uppslag genom en DNS-över-HTTPS-leverantör, eftersom appen inte har någon resolver:

```bash
grep -rnF --include='*.ts' --include='*.js' --include='*.mjs' \
  -e cloudflare-dns.com -e dns.google -e /dns-query \
  engine/src shells/*/src shells/chrome-extension shells/*/bridge-overrides \
  shells/web/public/sw.js services packages api community brands/*/tools
# (no output: outside this page and its built copies, the only place those
#  hostnames appear in the repo is tests/no-trackers.test.ts, the test that
#  bans them)
```

**10. Certifikattjänsten för ingen utfärdningslogg.** Identitets-CA:n för ingen logg över vad den utfärdat och ingen förteckning över identiteter: ingen stdout-rad, ingen webhook, inget certifikatlager. Frånvaron går att söka efter:

```bash
grep -rn logIssuance services/ca api/ca
# (no output)
```

CA:n behåller kortlivat arbetstillstånd: hastighetsbegränsningshinkar håller hashade IP- och e-postnycklar under sitt fönster, och en hanterad installations tillträdeslager behåller en nyckelad identifierare och en förfrågningsdigest i högst tio minuter. [Content Credentials engineering](/info/content-credentials-engineering.html#protocol) har detaljerna.

## Upprätthållet av tester

Källkontrollerna ovan är ingen engångsgranskning: de är fastlåsta i testsviten, så de kan inte i tysthet förfalla. [`tests/no-trackers.test.ts`](https://github.com/lolly-tools/lolly/blob/main/tests/no-trackers.test.ts) kontrollerar en längre lista med spårarnamn än skanningen ovan och fäller bygget om:

- något analys- eller spårnings-SDK dyker upp var som helst i den levererade källkod den skannar, i app-, motor-, server-, tilläggs- och verktygspaketskod;
- någon DNS-över-HTTPS-resolver från tredje part dyker upp i den källan;
- CA:ns utfärdningslogg kommer tillbaka, i källan **eller** det genererade serverpaketet;
- integritetspolicyn tappar sina lagkrav (namngiven personuppgiftsansvarig, rättslig grund, rätt att klaga).

Kör dem själv i klonen (Node 22.18 eller senare; den här filen behöver ingen `pnpm install`):

```bash
node --test tests/no-trackers.test.ts
# ✔ no analytics or tracking SDK appears anywhere in shipped source
# ✔ no third-party DNS-over-HTTPS resolver is contacted
# ✔ the certificate service logs no personal data
# ✔ privacy policy states a controller, a legal basis and a right to complain
```

Den fullständiga svitan (`pnpm install && pnpm test`) kör flera tusen till, inklusive de kontradiktoriska kryptografitesterna som beskrivs i [Säkerhet och verifiering](/info/security.html).

## Vad du inte kan verifiera utifrån

- **Åtkomstloggar hos värdtjänsten.** Varje server som svarar på en förfrågan kan logga den: IP-adress, sökväg och tid. En utomstående prob kan inte fastställa hur länge loggar sparas. Operatören styr loggning, rotation och exporter, och måste redovisa de valen. Lokal rendering håller vanliga redigeringar på din enhet; valfri serverrendering och delade arbetsytetjänster har de separata dataflöden som integritetspolicyn beskriver.
- **Att installationen kör den här koden.** Du kan kontrollera att källan är ren och att det driftsatta beteendet matchar den, och kontrollerna ovan gör båda. Attestering på binärnivå av en webbinstallation är inget webbplattformen erbjuder. Skydden är det publika arkivet, de upprätthållna testerna och offlinekontrollen: en manipulerad installation som ringer hem fallerar kontroll 1 och 2 på en gång.
- **Verktygshooks.** Ett inbyggt verktygs valfria logik granskas snarare än isoleras: den körs på sidan om inte verktyget väljer en Worker. Varje verktyg på lolly.tools är förstaparts och granskas innan det levereras. [Threat Model](/info/threat-model.html#trust-boundaries) redogör för var hooks körs och vad som begränsar dem.

## Om en kontroll misslyckas

En skillnad mellan den här sidan och det du observerar är en säkerhetsrapport. Skicka den genom de privata kanalerna på [Security & Verification](/info/security.html#reporting-a-vulnerability). Vi tillämpar samordnat röjande och krediterar rapportörer.
