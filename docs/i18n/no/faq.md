# Spørsmål og svar

Vanlige spørsmål, gjengitt som trekkspillet på `/info/start/faq.html`.

**Slik vedlikeholder du siden:** hver `##`-overskrift nedenfor er et spørsmål; alt under den
(fram til neste `##`) er svaret. Svarene bruker den samme lette markdown-en som
resten av nettstedet - skill avsnitt med en tom linje. Legg til, fjern eller
endre rekkefølgen på spørsmål her og kjør `pnpm run build:info` (eller `pnpm run dev:web`) på nytt.
Alt over den første `##` (denne tittelen og disse notatene) ignoreres av bygget.

Rekkefølgen er en førstegangsbrukers rekkefølge: først haken, deretter filene dine, deretter å skaffe
og kjøre Lolly, deretter organisasjoner, og til slutt hvordan det ble laget. Hvert spørsmåls anker
bygges fra det engelske spørsmålet på samme plass, så en oversettelse beholder
den engelske rekkefølgen.

## Hvorfor er det gratis? Hva er haken?

**Vi bygde Lolly for oss selv.** SUSE trengte tusenvis av filer på merkevaren, laget uten å gi noe til eksterne tjenester. Så vi bygde et verktøy som gjør alt på enheten, og ga det ut som åpen kildekode, som alt annet vi lager. Vi vedlikeholder det fordi vi bruker det hver dag. **Det er ingen forpliktelse:** alt her fungerer med eller uten oss.

Den linjen er trukket i lisensen, ikke i et løfte: alt som kjører lokalt, er gratis, for alltid. En utgitt versjon er lisensiert slik at den ikke kan tas tilbake, og det finnes ingen bidragsyteravtale som kan relisensiere noens arbeid.

## Hvor mye holder SUSE privat? (altså: når blir teppet dratt vekk?)

Motoren, skallene, skjemaene og de merkevareuavhengige verktøyene er åpen kildekode. SUSEs varemerker og merkevareverktøy er den delen som forblir privat, og de er allerede skilt ut. Den offentlige instansen på [lolly.tools](https://lolly.tools) kjører [Lolly Demo](/info/lolly-demo.html), Lollys eget designsystem.

Ingenting her hviler på et løfte: hver utgitt versjon forblir åpen kildekode, og det eneste som holdes tilbake, er varemerket. Da et annet selskap stengte kildekoden til sin bedriftsutgave av Linux i 2023, var SUSE med på å grunnlegge [OpenELA](https://openela.org) for å holde den koden åpen, den samme holdningen dette prosjektet arver.

Full åpenhet: SUSE *bygger* interne verktøy for å koble Lolly til sine egne IT-systemer. Det er SUSEs interne oppsett, ikke en splittelse mellom offentlig og privat utvikling. Lolly har også som mål å bygges gjennom [Open Build Service](https://openbuildservice.org/), med sikre leveringskjedeartefakter levert av [SUSE Application Collection](https://apps.rancher.io/applications).

## Hvorfor navnet «Lolly Tools»?

**Lolly** fordi frihet er søtt, og fordi en «lolly» er godteri i Australia, New Zealand og Storbritannia.

**Tools** fordi et verktøy ligger stille til du tar det opp. Det kjører ikke når du ikke bruker det, og det overvåker deg ikke mens du gjør det.

## Hvorfor er alt grønt?

lolly.tools åpner i [Lolly Demo](/info/lolly-demo.html), Lollys eget eksempel på et designsystem, og hovedfargen er grønn. Det er et eksempel, ikke en regel. Bytt til **Lolly Starter**, et tomt designsystem, eller til ditt eget i [Settings → Design systems](/#/settings?focus=design-systems-section).

## Kan jeg bruke min egen merkevare?

Ja. **Design System Setup** (`#/start`) bygger et designsystem fra én farge, en designtokens-fil eller et ferdig design, og hvert verktøy tegner deretter med designsystemet ditt. [Start](/info/quickstart.html#put-your-brand-in) går gjennom de tre rutene.

Et designsystem som organisasjonen eller bygget ditt leverer, er administrert: det viser en lås og forblir skrivebeskyttet, og du kan lage en redigerbar kopi for å endre det.

## Hvor er det jeg lagde i går?

Hvis du trykket **Save as** eller **Save**, ligger det i **Projects**, på startskjermen, i nettleseren eller appen du lagret fra. Hvis du bare trykket **Download**, ligger filen der nettleseren eller systemet lagrer nedlastinger, og vanligvis ligger en kopi i **Assets**. Verktøy som [lagrer mens du arbeider](/info/find-your-work.html#which-tools-save-as-you-work) beholder også ulagret arbeid i **Projects**. [Find and recover your work](/info/find-your-work.html) dekker alle tilfeller.

## Jeg lukket fanen. Er arbeidet mitt borte?

Lagret arbeid ligger fortsatt i **Prosjekter**. Ulagret arbeid er borte, unntatt i de verktøyene som lagrer mens du jobber, som beholder det i **Prosjekter** også. Neste gang, trykk **Lagre som** før du forlater. Se [Hvis du lukket fanen eller forlot verktøyet](/info/find-your-work.html#if-you-closed-the-tab-or-left-the-tool).

## Kan jeg dele arbeidet mitt som en fil i stedet for en lenke?

Ja. Når en lenke ikke kan bære alt, som dine egne bilder eller lang tekst, sier Share-dialogen hva som ville gått tapt og tilbyr en **.lolly**-fil i stedet: én fil som holder designet, bildene det bruker og, hvis du velger det, selve verktøyet.

Du bestemmer hvor mye som følger med. Navnet og detaljene dine tas bare med hvis profilen din har sagt ja, og lisensiert kunst holdes tilbake med mindre du velger å ta med kunsten. Den som åpner en fil som bærer et verktøy, blir spurt om hun eller han stoler på verktøyet før det kan kjøre. Se [Sharing your work](/info/using.html#sharing-your-work).

## Hva gjør profildetaljene mine?

Detaljene dine i **Settings** forhåndsutfyller verktøyene som ber om dem, som et navn på et navneskilt. De blir på denne enheten. Hvis du også slår på valget, forsegles detaljene du velger i det du lager, og navngir deg som kilden. Ingenting tas med med mindre du velger å ta med detaljene dine.

Deling og Sync sender bare innholdet du velger. På en organisasjons Lolly Work-instans går delte økter og styrt arbeid også til den serveren. Se [Privacy](/info/privacy.html).

## Hvordan får jeg tak i mobil- eller skrivebordsappene?

Last dem ned fra [Install Lolly](/info/install.html). Siden lister hvert bygg for macOS, Windows, Linux og Android, og viser hvordan du sjekker filen du lastet ned. iPhone og iPad får **Lolly Tools** fra App Store; [delen om iPhone og iPad](/info/install.html#iphone-and-ipad) har lenken.

Hvem som helst kan også bygge og dele ut sin egen kopi av appen, med verktøyene og innstillingene målgruppen trenger. [Build Guide](/info/build-guide.html) viser hvordan.

## Lolly sier at det krever WebGPU. Hva kan jeg gjøre?

Nettappen tegner med WebGPU, en grafikkfunksjon i dagens nettlesere, og den sjekker etter den før den åpner et verktøy. Prøv disse i rekkefølge:

1. Oppdater nettleseren til gjeldende versjon.
2. Slå på grafikk- eller maskinvareakselerasjon i innstillingene til nettleseren, og start deretter nettleseren på nytt.
3. Prøv en nettleser som er testet: [Supported environments](/info/supported-environments.html) lister dem.
4. På en Mac, iPhone eller iPad, [installer appen](/info/install.html) i stedet.

## Kan Lolly redigere og rendre Figma-, Penpot-, Illustrator- eller InDesign-filene mine?

Ja. Åpne **Design** og klikk **Import a design**: den godtar en innebygd Figma **.fig** (Save local copy), en Penpot **.penpot**-eksport, en Illustrator **.ai** eller **.pdf**, en InDesign **.idml** (File → Export → InDesign Markup) eller **en hvilken som helst SVG**. Du trenger ingen konto, ingen plugin og ingen lisens på designapp.

![Designs åpne canvas - Importer et design ligger i verktøylinjens Lolly-meny](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Fz%3D17ZTfS8MwEMf_mryO5NZ288GHrdqJv1CUvWdtOgppMtJMNv96yaV1iRNEQRBZoblwab53l0-uq915bXgrCOSDpf3LzgANnQ4eI0rrPJn7Gh9cd0sE8lIryxtFIFfatFx6L4F0Mi-11GbUiZYr25QjK3bW-S8I5MnUbRXKCkMgb5uqki6JFFU7rjoXYsSgT8GaLebKZSeGAPkUYypMHp80DeugYYR4J_U7X4XRkY8dFHuTYEJ-jDWM3qoqsEHo4Y20-xJi-SPVaOfRUuAL1hiZXNrG4gH6M85Z5lTAk8x8DdlnPL8gecVfBIEU6F5v0bbCor3VUu4JpOPCKTCWsPI9rBS107d6QyCfRET_Ac6wX36X6UpX-49Ip1mAlMEPkM6QX20aoSpECLTmpadcazPQ9hPlWxboRndWmFEIG1s4Yp3E3Ts-0f4GbcruWHLzlC0frmfpfbGk82LxmD0vUndSTcvXAoknWBKCz5LDSIdiRHV0D2Tfq1BIvdY42Zim5WZ_-n3_mRvwBg&width=1360&height=850&dpi=192&waitMs=3000&format=svg&walker=1&chrome=1&localize=1&dark=1&filename=design)

Lag kommer inn som redigerbare bokser: tekst kan fortsatt skrives på nytt, former forblir former og bilder blir med i ditt eget bibliotek. Lagre den, så kan **Share with rules** gjøre layouten om til et verktøy alle med Lolly kan fylle ut på nytt. Se [Import a design](/info/design-import.html).

## Kan to personer jobbe på det samme designet uten internett?

Ja. Én person deler en invitasjon, som en lenke, en QR-kode eller en kort kode, og den andre godtar. Begge enhetene holder da den samme økten live, med tilstedeværelse og fokusringer. Det fungerer på hvilket som helst delt nettverk, også en telefonhotspot i en kjeller, fordi det ikke er noen server imellom. Se [Working together](/info/collaborate.html). For kolleger på ulike nettverk gir en organisasjons Lolly Work-instans autentiserte work collabs.

## Hva er funksjonsflaggene?

Feature flags slår deler av Lolly på eller av. I frittstående bruk velger du dine personlige innstillinger. En organisasjon som bruker Lolly Work kan sette standarder eller skjule utvalgte brytere under sin policy, og administrerte kontroller er merket. Se [Use Lolly at your organisation](/info/organisation.html).

![Personlige feature flags i den frittstående appen; organisasjonspolicy kan styre utvalgte brytere](/t/url-shot?url=%2F%23%2Fprofile%3Ffocus%3Dfeature-flags&width=1440&height=1800&dpi=192&waitMs=2000&format=svg&cropSelector=%23feature-flags-section&walker=1&dark=1&filename=pd-feature-flags)

## Hva skiller nytteverktøy fra verktøy?

En utility gjør én rask jobb på en fil du allerede har, som å komprimere en PDF, konvertere et bilde eller fjerne skjulte data, og mange av dem kjører på enheten din uten at noe lastes opp. De finnes for at jobbene folk vanligvis gir til et tilfeldig nettsted, blir i Lolly. Å komprimere en kontrakt, konvertere feriebilder med posisjonen fortsatt inni eller lime inn et token i en nettbasert formaterer burde ikke bety å gi filen til et nettsted med ukjent oppbevaring, jurisdiksjon og forretningsmodell. [Utilities](/info/utilities.html) lister dem, og [The trade we never agreed to](/info/status-quo.html) forteller historien bak dem.

![Utilities-visningen: Strip Hidden Data, Compress PDF, Convert Image og de andre jobbene på enheten, alle på ett sted](/t/url-shot?url=%2F%23%2Fu&width=1440&height=900&dpi=192&waitMs=1600&css=.welcome-dialog%2C.personalize-nudge%7Bdisplay%3Anone!important%7D&tolerance=0.03&format=svg&walker=1&dark=1&filename=use-utilities&try=1)

## Kan organisasjonen vår bruke SSO, delte prosjekter og godkjenninger?

Ja, med **Lolly Work**, organisasjonsserveren fra det samme åpen kildekode-prosjektet. Den kjører separat og legger til enkel pålogging gjennom identitetsleverandøren din, SCIM-klargjøring, gruppetillatelser, delte prosjekter og ressurser, live work collabs, godkjenninger og revisjonsposter. Den daglige appen fungerer fortsatt på egen hånd.

[Use Lolly at your organisation](/info/organisation.html) dekker pålogging og å finne delt arbeid, og [Deployment](/info/deployment.html#organisation-services-with-lolly-work) dekker oppsettet. Delt innhold og organisasjonsposter følger den instansens personvern- og oppbevaringspolicyer.

## Hvilke hindringer kan jeg møte når jeg tar i bruk Lolly?

Mest endringer på produksjonssiden, ikke i teknologien. Et team som vil ha et styrt sett med verktøy, trenger noen som forfatter designsystemet og de første malene, selv om hvem som helst kan begynne å lage sine egne verktøy i Design første dag, uten git. Og eksisterende prosesser fortsetter å fungere selv når resultatet er utenfor merkevaren, så å konvertere ett synlig resultat godt, før og etter side om side, gjør saken raskere enn en plan.

[Adoption & Governance](/info/adoption-governance.html) dekker onboarding etter rolle, hvordan man måler en pilot og hvordan en styringsprosess kan se ut.

## Ble Lolly "vibekodet"?

Lolly ble utviklet med AI-assistert koding, AI-assistert utforskning og, mange steder, AI-assistert innhold, med en blanding av modeller og leverandører, inkludert de fra frontselskaper i offentlig sky. Et menneske skapte arkitekturen, kuraterte koden med hensikt og artdirigerte opplevelsen.

En høy eller kritisk sikkerhetsmelding i Lollys avhengigheter blokkerer CI. En melding som ikke kan fikses ennå, holdes tilbake bare som et godkjent unntak med en skriftlig begrunnelse. [SECURITY.md](https://github.com/lolly-tools/lolly/blob/main/SECURITY.md#dependency-audit-exceptions) lister hvert unntak som gjelder i dag, og [release notes](https://github.com/lolly-tools/lolly/releases) lister de hver utgivelse bærer. SECURITY.md sier også hvordan du rapporterer en sårbarhet.

Kontroller i bygget avviser også formuleringer som leses som maskinlagde i kodekommentarene, appen og disse dokumentene, for å holde teksten enkel for alle lesere. En bieffekt er at en detektor kanskje får det vanskeligere å si hvilken tekst en modell skrev. Vi la ikke ut for å forårsake det.

Aller viktigst står Lolly på skuldrene til tiår med åpen kildekode-arbeid fra eksperter over hele verden.

**Informasjon om generativ AI:**

- **LLM-skrevet kode:** Opus 4.8, Gemini 3.1, Qwen3-Coder-Next, Codex Sol (denne listen kan bli utvidet)
- **LLM-utforskning:** Gemini 3.1, Fable, Codex Astra
- **Dokumentasjon:** Sonnet 5
- **Åpen kildekode-biblioteker:** Deres respektive forfattere, uttrykt i SBOM-en, kommentarene og filhodene

Denne listen omfatter ikke modeller som er pakket inn (vendored) i Lolly.

**Menneskelige bidrag:**
- **Idéutvikling, gjennomgang og tilbakemelding:** Ravan Naidoo, Matthias Eckermann, Kelly Andrews, Ryan Kleeman, Peter Chamalian, Penpot-fellesskapet, Tim Hildred (listen er ikke uttømmende)
- **Arkitektur, art direction og slop-vaktmester:** Andy Fitzsimon

## Hvor ble det av de SUSE-merkede verktøyene?

De ligger i et eget, privat repositorium. En offentlig klone henter ikke SUSE-merkevarepakken i det hele tatt, så et bygg fra den bruker den nøytrale profilen `lolly-start` med mindre du velger en annen: de merkevareuavhengige fellesskapsverktøyene pluss en blank merkevare du fyller ut med din egen. [lolly.tools](https://lolly.tools) bygges med profilen `lolly-demo` og åpner i [Lolly Demo](/info/lolly-demo.html), Lollys eget designsystem. SUSE driver sin egen instans for å beskytte varemerkene sine.

## Hvilken smak har den Lolly-logoen?

Noen sier lime, andre sier mint og av og til eple. Lolly står for det søte, du bestemmer smaken!
