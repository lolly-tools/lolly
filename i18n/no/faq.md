# FAQ

Ofte stilte spørsmål som vises i trekkspillmenyen på landingssiden `/info`.

**Slik vedlikeholder du siden:** hver `##`-overskrift nedenfor er et spørsmål; alt under den
(fram til neste `##`) er svaret. Svarene bruker den samme lette markdown-en som
resten av nettstedet - skill avsnitt med en tom linje. Legg til, fjern eller
endre rekkefølgen på spørsmål her og kjør `npm run build:info` (eller `npm run dev:web`) på nytt.
Alt over den første `##` (denne tittelen og disse notatene) ignoreres av bygget.

## Hva skjer når jeg gir samtykke på /profile-siden?

Når du bruker Lolly for første gang, er alt du skriver hvor som helst, helt privat, helt til du bevisst vil ha den informasjonen ut via medier eller en delingslenke (hvis du er på nett).

Når samtykket er valgt, forsegles profilopplysningene du velger, inn i det du lager, og navngir deg som kilde. Ingenting tas med uten at du velger det.

Lolly produserer store mengder innhold. Vi følger en streng dataminimering for å unngå risiko.

## Ble Lolly "vibekodet"?

Lolly ble utviklet med AI-assistert koding, AI-assistert oppdagelse og, mange steder, AI-assistert innhold, med en blanding av modeller og leverandører, inkludert ledende selskaper innen offentlig skyteknologi.

På tidspunktet dette ble skrevet, inneholder Lolly null kjente sikkerhetssårbarheter i forsyningskjeden og forplikter seg til rask sikkerhetsrespons når CVE-er dukker opp.

Et menneske skapte arkitekturen, kuraterte koden med hensikt og artdirigerte opplevelsen.

Aller viktigst: Lolly står på skuldrene til tiår med åpen kildekode-innovasjon fra ekte eksperter over hele verden.

Det finnes en deterministisk byggsperre i Lollys kodebase for å holde kode og dokumentasjon forståelig for den vanlige leseren og "avsøple" opplevelsen. Dette kan gjøre det vanskelig med proprietær syntetisk kartlegging av opprinnelse. Det er utilsiktet.

**Informasjon om generativ AI:**

- **LLM-skrevet kode:** Opus 4.8, Gemini 3.1, Qwen3-Coder-Next (listen kan bli utvidet)
- **LLM-oppdagelse:** Gemini 3.1, Fable
- **Dokumentasjon:** Sonnet 5
- **Åpen kildekode-biblioteker:** deres respektive forfattere, angitt i SBOM, kommentarer og filhoder

Denne listen omfatter ikke modeller som er pakket inn (vendored) i Lolly.

**Menneskelig bidrag:**

- **Arkitektur:** Andy Fitzsimon
- **Artdirection:** Andy Fitzsimon
- **Menneskeskrevet kode:** Andy Fitzsimon
- **Idémyldring, gjennomgang og tilbakemelding:** Ravan Naidoo, Matthias Eckermann, Kelly Andrews, Ryan Kleeman, Peter Chamalian, Penpot-fellesskapet (listen er ikke uttømmende)

## Hva er funksjonsflaggene?

Funksjonsflagg slår deler av Lolly av og på. Vanligvis er det en administrator som styrer dem - i Lolly er det du som styrer.

![Hvert funksjonsflagg er en bryter du eier, som ligger i din egen profil i stedet for i en administratorkonsoll](/t/url-shot?url=%2F%23%2Fprofile%3Ffocus%3Dfeature-flags&width=1440&height=1800&dpi=192&waitMs=2000&format=svg&cropSelector=%23feature-flags-section&walker=1&dark=1&filename=pd-feature-flags)

## Hvordan får jeg tak i mobil- eller skrivebordsappene?

Hvem som helst kan distribuere sine egne apper, og verktøyene og oppsettet i dem vil variere mye ut fra hvilket publikum de er laget for. Derfor finnes det ingen enkelt app, med mindre du har laget den selv eller noen relevant gir deg den.

## Hvorfor navnet «Lolly Tools»?

**Lolly** fordi frihet er søtt, og fordi en «lolly» er godteri i Australia, New Zealand og Storbritannia.

**Tools** fordi et verktøy ligger stille til du tar det opp. Det kjører ikke når du ikke bruker det, og det overvåker deg ikke mens du gjør det.

## Hvilke hindringer kan jeg møte når jeg tar i bruk Lolly?

Lolly passer inn der du allerede lager filer - CLI-en er den samme motoren
som appen, så en pipeline som kjører klokka to om natta, kan ikke drive fra det en person
forhåndsviser i en nettleser. Friksjonen ved innføring er sjelden teknisk; den er organisatorisk. Forvent disse:

**En kuratert merkevarekatalog må lages.** Lolly er en plattform, ikke en
ferdig pakke med malene dine. Ved en *styrt utrulling* er det noen som definerer den felles
ressurskatalogen (logoer, paletter, fonter som permanente ID-er) og skriver manifestet +
malen for hver utdatatype. Enkeltbrukere trenger likevel ikke å vente på det - i
den åpne appen kan hvem som helst importere sine egne filer inn i katalogen og bygge verktøy i
Design fra dag én.

**Du trenger ikke git for å bidra.** Designere lager sine egne verktøy og maler
i appen, og deler dem så med kolleger eller sender dem til den som eier
installasjonen, for å få dem med som standard.

**Den er bevisst smal - presenter den slik.** Lolly er ikke laget for skreddersydd innhold
eller hero-innhold. Den *er* ditt personlige DAM - fylt og forsterket av designsystemet,
verktøyene og katalogen din - og den *har* et åpent lerret (Design), men
selv der følger farger, typografi og ressurser de aktive designglobalene, så fri
komposisjon holder seg innenfor systemet. Målt mot Figma eller Canva ser den
begrenset ut. Målt som det den er - operasjonalisert, gjentakende ressursgenerering i
stor skala - er det ingenting som konkurrerer. Feil innramming er det vanligste tilbakeslaget.

**Endringsledelse på produksjonssiden.** Eksisterende prosesser fungerer i dag, selv om
resultatet ikke er i tråd med merkevaren. Å peke dem mot motoren betyr ny testing og ny læring,
og «vi kan jo allerede lage filer» blir unnskyldningen for ikke å bytte. Start med å konvertere
ett godt synlig resultat i produksjonskvalitet og vise før/etter side om side.

Lolly løfter alt.


## Hva skiller nytteverktøy fra verktøy?

**Enkelt svar →** Nytteverktøy trenger ikke alltid å rendre, og kan derfor få en annen brukeropplevelse. 

**Det egentlige svaret →** Grunnen til at nytteverktøy kan kjøre inne i Lolly Tools, er å legge til enda et «bekvemmelighetslag» av forsvar som gjør det mindre fristende å sende data ut av huset. 

Hvorfor? Fordi det er kjent at folk hver dag tar **fortrolig innhold de allerede har**, og gir det til et
tilfeldig nettsted for å få utført én liten mekanisk operasjon:

- «**Komprimer denne PDF-en**» → laster opp en kontrakt / lønnsslipp / styrepresentasjon til ukjente aktører.
- «**konverter HEIC til JPG**» → laster opp private bilder (med GPS-EXIF) til en annonsefinansiert tjeneste
- «**beskjær / endre størrelse på dette bildet**» → laster opp et produktskjermbilde eller en uutgitt ressurs
- «**formater denne JSON-en**» / «dekod denne JWT-en» → limer inn API-svar, tokener og hemmeligheter i en formaterer
- «**slå sammen disse PDF-ene**» → laster opp **to dokumenter som aldri burde dele en server**

Disse nettstedene og den enorme halen av kloner er **ikke troverdige som standard**, med
ukjent lagringstid, ukjente jurisdiksjoner, ukjente underleverandører og en forretningsmodell basert på
annonser og affiliate som har all grunn til å beholde det du gir dem. Operasjonen er
triviell; **innholdet er prisen.** 

Vi vinner kampen om styring med fremragende bekvemmelighet og service. 

![Nytteverktøy-visningen samler de mekaniske jobbene folk vanligvis gir til et tilfeldig nettsted, og kjører dem inne i Lolly i stedet](/t/url-shot?url=%2F%23%2Fu&width=1440&height=900&dpi=192&waitMs=1600&css=.welcome-dialog%2C.personalize-nudge%7Bdisplay%3Anone!important%7D&tolerance=0.03&format=svg&walker=1&dark=1&filename=use-utilities&try=1)

## Kan Lolly redigere og rendre Figma-, Penpot-, Illustrator- eller InDesign-filene mine?

Ja. Åpne **Design** og klikk **Import a design** (importer et design): den godtar en Figma-fil **.fig** (Save local copy), en Penpot-eksport **.penpot**, en Illustrator-fil **.ai** eller **.pdf**, en InDesign-fil **.idml** (File → Export → InDesign Markup) eller **hvilken som helst SVG** (den vide døra - nesten alle designprogrammer eksporterer det). Ingen konto, ingen plugin og ingen lisens på et designprogram er nødvendig.

![Designs åpne canvas - «Import a design» ligger i verktøylinjens Lolly-meny](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Fz%3D17VVRa9swEP41ekyQLrbjPOyhVeeOrSsbG3lXbLkYZCnISmn264tO9irFhdJCoZQIpBNn9N2dvu_k3cOX1opeEuCTpeNkG0BDy8ljZe28pyDA74UlUC4WOyt0sxgOthW1JJAD9wv1y6rFQWCDMB6BAK-NdqLTBLg2thcqeAnk68vaKGOXg-yFdl29dPLBef8VAZ6V_qjUTloCvO-aRvlcc0QdhB58iCWDMVNnD1iSUIOcAvASY2qsEUeex-XSOEJ6koaT_6Q1iY89IY4mw4TCmmJYc9BNZKPQ00ywxxJS-BlqcnL2KfJF3xhZf3WdwwsMd8xZ4VEgEF6EGornaH-ByW_iHkVAj-aAtpcO7Y1R6kggX1Uz7ext1wt7PNEOk7BZ7UbtYCpKtj4NZ_YE-Doh_hOwHnff-1K_M83xlPmyiJhn8AbmL5C61nZSN8g00OlFoK2xkyjCRofOBro3g5N2OdPE2PqxIGjL1iCCIPA1SPSQpQ_B6qyIVyiCsp8s-_Gn2P76fpHfVlt6WV3_Lv5e5_6mul7cSVRFhiWhOIrsaaVTMbKZaUWNbQ-VMncGN__b_fwn-CAKeAQ&width=1360&height=850&dpi=192&waitMs=3000&format=png&localize=1&dark=1&filename=design)

Lag kommer inn som redigerbare bokser på det åpne lerretet: tekst kan fortsatt skrives om, former er fortsatt former, bilder havner i ditt eget bildebibliotek, og typografi og farger følger merkevareglobalene. Lagre den, og oppsettet blir en gjenbrukbar mal med egen URL som hvem som helst med Lolly kan fylle på nytt - og du kan blande inn levende verktøy (en QR-kode, et diagram) som rendres på nytt ved innlasting. Derfra rendres den som alt annet i Lolly - SVG, PDF, PNG og resten, reproduserbart fra URL-en. Se [Importer et design](/info/design-import.html).

## Kan jeg dele arbeidet mitt som en fil i stedet for en lenke?

Ja. Når en lenke ikke kan bære alt (dine egne bilder, lang tekst), sier delingsdialogen nøyaktig hva som ville falt bort, og tilbyr en **.lolly**-fil i stedet: én fil som inneholder designet, bildene det bruker og, hvis du vil, selve verktøyet. Du bestemmer hvor mye som blir med - navnet og opplysningene dine blir bare med hvis profilen din samtykker, lisensiert kunst holdes tilbake med mindre du tar den med, og den som åpner en fil med et verktøy i, blir spurt om vedkommende stoler på det før det kan kjøre. Se [Deling av arbeidet ditt](/info/using.html#sharing-your-work).

## Kan to personer jobbe på det samme designet uten internett?

Ja. Én person deler en invitasjon (en lenke, en QR-kode eller en kort kode), den andre godtar, og begge enhetene holder den samme økta i live - med tilstedeværelse, fokusringer og det hele. Det fungerer på et hvilket som helst delt nettverk, også et mobilt trådløst nett i en kjeller, fordi det ikke er noen server i midten. Se [Samarbeid](/info/collaborate.html).

## Hvor ble det av de SUSE-merkede verktøyene?

De ligger allerede i et eget, privat repositorium. En offentlig klone henter ikke SUSE-merkevarepakken i det hele tatt, så et offentlig bygg kjører den nøytrale profilen `lolly-start` - de merkevareuavhengige fellesskapsverktøyene pluss en tom merkevare du fyller inn med din egen. SUSE drifter sin egen instans for å beskytte varemerkene sine.

## Hvorfor er det gratis? Hva er haken?

**Vi bygde Lolly for oss selv.** SUSE trengte tusenvis av filer i tråd med merkevaren, hver med navnet sitt forseglet inni, laget uten å gi noe fra oss til eksterne tjenester. Så vi bygde et verktøy som gjør alt sammen på enheten, og ga det ut som åpen kildekode, slik vi gjør med alt annet vi lager. Vi fortsetter å vedlikeholde det fordi vi bruker det hver dag. **Det følger ingen forpliktelser med:** alt her fungerer med eller uten oss.

Den grensa er trukket i lisensen, ikke i et løfte: alt som kjører lokalt, er gratis, for alltid. En versjon som er gitt ut, er lisensiert slik at den ikke kan trekkes tilbake, og det finnes ingen bidragsyteravtale som kunne gitt noens arbeid en ny lisens. Se [posisjonering](/info/positioning.html) for hele erklæringen.

## Hvor mye holder SUSE privat? (altså: når blir teppet dratt vekk?)

Motoren, skallene, skjemaene og de merkevareuavhengige verktøyene er åpen kildekode; SUSEs varemerker og merkede verktøy er den delen som forblir privat, og de er allerede skilt ut. Den offentlige instansen på [lolly.tools](https://lolly.tools) kjører på den blanke merkevaren.

Grensa er strukturell, ikke lovet. Hver utgitte versjon er åpen kildekode og kan ikke trekkes tilbake, det finnes ingen bidragsyteravtale som kunne gitt noens arbeid en ny lisens, og det eneste som holdes tilbake, er varemerket. Da et annet selskap lukket kildekoden til sin enterprise-Linux i 2023, var SUSE med på å grunnlegge [OpenELA](https://openela.org) for å holde den koden åpen - den samme holdningen som dette prosjektet arver.

For ordens skyld: SUSE *holder* på å bygge intern verktøystøtte for å integrere Lolly i IT-systemene sine - det handler om SUSEs interne oppsett, ikke om offentlig kontra privat utvikling. Lolly skal også bygges gjennom [Open Build Service](https://openbuildservice.org/), med sikre forsyningskjede-artefakter levert av [SUSE Application Collection](https://apps.rancher.io/applications).

## Hvilken smak har den Lolly-logoen?

Noen sier lime, andre sier mint og av og til eple. Lolly står for det søte, du bestemmer smaken!
