# Verifiera det själv

Lollys sidor om integritet och säkerhet gör påståenden: ingen analys, ingen spårning, filer lämnar aldrig enheten, en enda cookie i hela systemet. Den här sidan är annorlunda: den ber dig inte tro på något av det. Det är en lista med procedurer, var och en med det exakta kommandot eller klickvägen och resultatet du kommer att se. Varje påstående här går att motbevisa på några minuter, de flesta utan att installera något.

Om någon kontroll på den här sidan inte ger det visade resultatet är det antingen en bugg eller ett brutet löfte. [Rapportera det](#if-a-check-fails) oavsett, så behandlar vi det med den allvarlighetsgrad ett brutet löfte förtjänar.

## Se det fungera, på tio sekunder

Före procedurerna, belöningen. Öppna [`/verify`](/#/verify) och släpp en fil på den - ingen uppladdning, inget konto, ingen väntan på en server. Här är den och kontrollerar den [genererade Queensland-stormen](/info/ai-stance.html) från vår AI-ståndpunktssida: en Gemini-bild som Lolly öppnade, ändrade storlek på och exporterade. Varje badge nedan beräknades på enheten, från filens egna byte.

![Verify på en skärm i telefonbredd - stormbilden, ett grönt Made with Lolly-utlåtande och badgarna för intakt uppgift och oförändrade byte staplade under den](/t/url-shot?url=%2F%23%2Fverify%3Fsrc%3D%2Finfo%2Fthe-flood.webp&width=440&height=1500&dpi=192&waitMs=6000&waitSelector=.valid-steps&walker=1&format=svg&rasterDpi=96&cropSelector=.valid-top&dark=1&filename=cc-verify-mobile)

Utlåtandet är inte en enda badge utan en liten hög av dem, var och en ett oberoende faktum:

- <!--i:lock--> **Made with Lolly** - uppgiften är intakt *och* registrerar en Lolly-export.
- <!--i:seal--> **Uppgiften är intakt** - det signerade C2PA-manifestet tolkas och dess egen anspråkssignatur verifieras.
- <!--i:hash--> **Byten har inte ändrats** - filens hash matchar fortfarande det som signerades. Ändra en pixel och den här badgen slår om.
- <!--i:sparkle--> **GEN AI** - en maskin skapade dessa pixlar, och filen säger det. Lolly läser tillbaka det påståendet i stället för att dölja det.

Och hela historiken följer med filen. Nio steg överlever här - fem som Google registrerade när den genererade och vattenmärkte bilden, sedan fyra som Lolly registrerade när den öppnade, märkte och konverterade kopian på den här sidan - lästa rakt ur byten, på din enhet, och återgivna som en tidslinje. Det här är samma bild, verifierad på samma sätt, som C2PA-tidslinjen på [AI-ståndpunktssidan](/info/ai-stance.html).

![Ändringshistoriken Verify läser tillbaka ur stormbilden - fem steg registrerade av Google, sedan fyra av Lolly, som slutar i webp-filen på den här sidan](/t/url-shot?url=%2F%23%2Fverify%3Fsrc%3D%2Finfo%2Fthe-flood.webp&width=1440&height=1400&dpi=192&waitMs=6000&walker=1&format=svg&cropSelector=.valid-steps&dark=1&filename=ai-stance-change-history)

Inget av det är dock själva förtroendeutfästelsen - det är demot. Resten av den här sidan är förtroendeutfästelsen: varje märke ovan är reproducerbart, och här är hur du reproducerar garantierna bakom dem.

## I din webbläsare, inga verktyg krävs

**1. Titta på nätverket.** Öppna [lolly.tools](https://lolly.tools), öppna webbläsarens DevTools (F12), växla till fliken **Network** och använd ett verktyg - skriv in en URL i [QR Code](/t/qr-code), byt färger, exportera en PNG. Alla förfrågningar stannar på `lolly.tools`: appskalet, verktygets egna filer, katalogtillgångar. Ingen analyshost, ingen CDN-beacon, ingen typsnittstjänst, ingen "felrapporterings"-endpoint. Det du skriver in i ett verktyg dyker upp i **ingen förfrågan alls** - renderingen är lokal.

De ärliga undantagen - vart och ett opt-in, användarinitierat och synligt i samma Network-flik när det sker: att lägga till ett **Google Font** i varumärkesredigeraren hämtar den enda familjen från Google, efter en samtyckesdialog som talar om exakt det, en gång, innan den första hämtningen; att klicka på en **ICC-tryckprofil**-förinställning hämtar den profilen från ICC:s offentliga register på color.org; att spela den valfria inbyggda **radion** strömmar från stationen; att ange en plats i **Meeting Planner** slår upp den platsen hos open-meteos geokodningstjänst för dess koordinater och tidszon, en gång per stad (svaren sparas på din enhet), och fältet bär den upplysningen precis där du skriver; och **URL Screenshot** laddar med nödvändighet den URL du skrev in - det är dess uppgift, och du ser det hända. Ett verktyg som deklarerar en nätverksfunktion får bara hämta från de hostar dess manifest tillåtlistar, och den mekanismen är fail-closed; inget verktyg som levereras för närvarande deklarerar en sådan, så den webbläsarframtvingade Content-Security-Policy:n är gränsen som faktiskt håller listan ovan till sina hostar. [Integritetspolicyn](/info/privacy.html) håller den kanoniska tabellen över alla dessa; dess stående regel är att en nätverkskontakt som inte finns med i den tabellen inte sker.

**2. Dra ur kontakten.** Ladda appen och öppna ett verktyg eller två, gå sedan offline - flygplansläge, eller DevTools → Network → Offline. Ladda om. Galleriet och varje verktyg du har öppnat fortsätter fungera, inklusive rendering och export i de format du har använt - ett verktygs filer och ett formats kodare cachas första gången du använder dem, så kör ett verktyg en gång online innan du testar det offline. Detta är den starkaste enskilda kontrollen på den här sidan: mjukvara som ringer hem överlever inte att sladden dras ur.

**3. Räkna cookies.** DevTools → **Application** (Firefox: **Storage**) → Cookies → `https://lolly.tools`. Listan är tom - appen sätter inga cookies. Eller klistra in `document.cookie` i konsolen: du får `""`. (Den enda cookien i hela systemet, `lolly_ca_state`, lever i högst tio minuter under en valfri identitetsinloggning - raderas i samma stund som inloggningen slutförs - är avgränsad till `/api/ca` och är `HttpOnly`: [integritetspolicyn](/info/privacy.html) beskriver den exakt.)

**4. Läs din egen lagring.** Samma Application-panel: allt Lolly sparar går att inspektera framför dig - ett par dussin enkla `localStorage`-nycklar (tema, språk, sidopanelens bredd, ljud- och visningsinställningar, plus en cachad kopia av det offentliga verktygskatalogindexet), och dina egna dokument i IndexedDB. Varje värde är en läsbar sträng eller JSON - inget är förvanskat, inget är kodat för att avskräcka från att läsa det. **Profile → Clear all my data** raderar det; det gör även att rensa webbplatsdata i webbläsaren, eftersom det inte finns någon serverkopia som kan överleva det.

**5. Kontrollera att upplysningskontakten finns.** [`/.well-known/security.txt`](/.well-known/security.txt) svarar med ett kontaktblock enligt [RFC 9116](https://www.rfc-editor.org/rfc/rfc9116), inte en HTML-sida.

## Från en terminal

**6. Renderingsändpunkten är avstängd på lolly.tools.** Den enda serverfunktion som skulle lägga användarinskrivna indata i en URL - hotlink-renderingar - är avaktiverad här tills tjänsten flyttar till organisationsägd hosting ([integritetspolicyn](/info/privacy.html) förklarar varför):

```bash
curl -s -o /dev/null -w '%{http_code}\n' 'https://lolly.tools/tool/qr-code.svg?url=test'
# 404
```

Brytaren är per driftsättning (`LOLLY_DISABLE_RENDER_GET=1`): på en instans som lämnar den osatt, är hotlink-renderingar aktiva, så samma test där returnerar en bild - den skillnaden är flaggan som fungerar, inte en inkonsekvens.

**7. Serverytan går att räkna upp.** [Server Surface](/info/server-surface.html) listar varje serversidig rutt som finns, med den stående regeln att en endpoint som inte står på den sidan inte är en del av Lolly. `curl`:a dem; det finns inget annat att hitta.

## I källkoden

Allt ovan skulle fortfarande kunna vara teater om den driftsatta koden skilde sig från den publika koden. Så kontrollera koden - driftsättningen byggs från [det publika repositoriet](https://github.com/lolly-tools/lolly):

```bash
git clone --recurse-submodules https://github.com/lolly-tools/lolly.git
cd lolly
```

**8. Ingen spårare, ingen analys-SDK, någonstans.** Sök i koden som levereras - motorn, varje shell (inklusive webbläsartillägget, Tauri-bridgeöverstyrningarna och service workern), serverfunktionerna och verktygspaketen - efter de vanliga misstänkta:

```bash
grep -rn --include='*.ts' --include='*.js' --include='*.mjs' --include='*.html' \
  -e googletagmanager -e google-analytics -e posthog -e mixpanel -e hotjar \
  -e sentry.io -e segment.com -e '@vercel/analytics' \
  engine/src shells/*/src shells/chrome-extension shells/*/bridge-overrides \
  shells/web/public/sw.js services packages api community brands/*/tools
# (no output)
```

**9. Ingen DNS-resolver från tredje part.** Verifys SEAL-kontroll dirigerar aldrig uppslag genom en DNS-over-HTTPS-leverantör - webbappen har helt enkelt ingen resolver:

```bash
grep -rn --include='*.ts' --include='*.js' --include='*.mjs' \
  -e cloudflare-dns.com -e dns.google -e /dns-query \
  engine/src shells/*/src shells/chrome-extension shells/*/bridge-overrides \
  shells/web/public/sw.js services packages api community brands/*/tools
# (no output: outside this page and its built copies, the only place those
#  hostnames appear in the repo is tests/no-trackers.test.ts, the test that
#  bans them)
```

**10. Certifikattjänsten sparar ingenting.** Identitets-CA:n har ingen utfärdandelogg - inte din e-post, inte en tidsstämpel, ingen webhook. Frånvaron går att greppa:

```bash
grep -rn logIssuance services/ca api/ca
# (no output)
```

## Framtvingat av tester, inte löften

De tre källkontrollerna ovan är inte en engångsgranskning - de är fastnaglade i testsviten, så de inte kan förfalla i det tysta. [`tests/no-trackers.test.ts`](https://github.com/lolly-tools/lolly/blob/main/tests/no-trackers.test.ts) får bygget att misslyckas om:

- någon analys- eller spårnings-SDK förekommer någonstans i den levererade källkod den skannar - app-, motor-, server-, tilläggs- och verktygspaketskod likaså,
- någon DNS-over-HTTPS-resolver från tredje part förekommer i den källkoden,
- CA-utfärdandeloggen dyker upp igen - i källkoden **eller** i det genererade serverbundlet,
- integritetspolicyn förlorar sina lagstadgade uppgifter (namngiven personuppgiftsansvarig, rättslig grund, rätt att klaga).

Kör dem själv i klonen (Node 22.18+; ingen `npm install` behövs för den här filen):

```bash
node --test tests/no-trackers.test.ts
# ✔ no analytics or tracking SDK appears anywhere in shipped source
# ✔ no third-party DNS-over-HTTPS resolver is contacted
# ✔ the certificate service logs no personal data
# ✔ privacy policy states a controller, a legal basis and a right to complain
```

Den fullständiga sviten (`npm install && npm test`) kör flera tusen till, inklusive de adversariella kryptografitesterna som beskrivs i [Security & Verification](/info/security.html).

## Vad du inte kan verifiera utifrån - sagt rent ut

En sida som den här förtjänar förtroende genom att namnge sina egna begränsningar:

- **Hostingens åtkomstloggar.** Vilken server som helst som besvarar en förfrågan kan logga förfrågan - IP, sökväg, tidsstämpel. Du kan inte verifiera vad en host sparar eller inte sparar, och det kan inte vi heller, bortom vår leverantörs dokumenterade beteende. Det är exakt därför arkitekturen håller ditt innehåll helt borta från nätet: det som aldrig lämnar din enhet kan inte loggas av någon.
- **Att driftsättningen kör den här koden.** Du kan verifiera att källkoden är ren och att det driftsatta beteendet matchar den (kontrollerna ovan gör bägge delarna), men attestering på binärnivå av en webbdriftsättning är inget webbplattformen erbjuder. Åtgärderna är det publika repositoriet, de framtvingade testerna och offline-kontrollen - en manipulerad driftsättning som ringer hem misslyckas omedelbart med kontroll 1 och 2.
- **Verktygshooks är inte sandlådade som standard.** Ett verktygs valfria logik körs granskad, i sidans egen realm; varje verktyg på lolly.tools är förstapart och granskat innan det levereras. Worker-isolering levereras nu som en opt-in per verktyg - ett verktyg vars manifest sätter `isolate: true` kör istället sina hooks utanför huvudtråden - så det du inte kan verifiera utifrån krymper, men standardvägen är fortfarande i samma realm och granskning är fortfarande kontrollen. Detta är uttalat, inte dolt - se avsnittet [design boundaries](/info/security.html), som alltid har sagt det.

## Om en kontroll misslyckas

En diskrepans mellan den här sidan och observerat beteende är en säkerhetsrapport, och vi vill uppriktigt hellre höra om den än inte: [fitzy+security@suse.com](mailto:fitzy+security@suse.com), knappen **Report a vulnerability** på vilket [lolly-tools-repositorium](https://github.com/lolly-tools) som helst, eller kontakten i [`/.well-known/security.txt`](/.well-known/security.txt). Samordnat offentliggörande och kredit till rapportören är den stående policyn - [SECURITY.md](https://github.com/lolly-tools/lolly/blob/main/SECURITY.md) har detaljerna.
