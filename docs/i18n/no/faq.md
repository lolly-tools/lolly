# Spørsmål & svar

Vanlige spørsmål, gjengitt som utvidbare felt på `/info/start/faq.html`.

**Slik vedlikeholder du siden:** hver `##`-overskrift nedenfor er et spørsmål. Alt under overskriften,
frem til neste `##`, er svaret. Svarene bruker nettstedets enkle markdown:
skill avsnitt med en tom linje. Legg til, fjern eller endre rekkefølgen på spørsmål her og
kjør `pnpm run build:info` (eller `pnpm run dev:web`) på nytt.
Byggingen ignorerer alt over den første `##` (denne tittelen og disse merknadene).

Rekkefølgen er for førstegangsbrukere: haken først, deretter filene dine, så å hente
og kjøre Lolly, så organisasjoner, så hvordan det ble laget. Ankeret til hvert spørsmål
bygges fra det engelske spørsmålet på samme plass, så en oversettelse beholder den
engelske rekkefølgen.

## Hvorfor er det gratis? Hva er haken?

**Vi bygget Lolly for oss selv.** SUSE trengte tusenvis av filer i tråd med merkevaren, laget uten å overlate noe til eksterne tjenester. Derfor bygget vi et verktøy som gjør alt på enheten, og ga det ut som åpen kildekode, som alt annet vi lager. Vi fortsetter å vedlikeholde det fordi vi bruker det hver dag. **Det er ingen forpliktelser:** alt her fungerer med eller uten oss.

Den grensen er trukket i lisensen, ikke i et løfte: alt som kjører lokalt, er gratis for alltid. En utgitt versjon har en lisens som gjør at den ikke kan trekkes tilbake. Ingen bidragsyteravtale kan endre lisensen på noens arbeid.

## Hvor mye holder SUSE privat? (eller når trekkes teppet bort under oss)

Motoren, skallene, skjemaene og verktøyene som er uavhengige av merkevare, er åpen kildekode. SUSEs varemerker og merkevaretilpassede verktøy forblir private og er allerede skilt ut. Den offentlige instansen på [lolly.tools](https://lolly.tools) kjører [Lolly Demo](/info/lolly-demo.html), Lollys eget designsystem.

Ingenting her bygger på et løfte: hver utgitte versjon forblir åpen kildekode. Da et annet selskap lukket kildekoden til sin Linux for bedrifter i 2023, var SUSE med på å grunnlegge [OpenELA](https://openela.org) for å holde den koden åpen. Dette prosjektet viderefører den holdningen.

SUSE *bygger* interne verktøy for å koble Lolly til sine egne IT-systemer. Det er SUSEs interne oppsett, ikke et skille mellom offentlig og privat utvikling. Lolly sikter også mot å bli bygget gjennom [Open Build Service](https://openbuildservice.org/), med sikre artefakter i leveransekjeden levert av [SUSE Application Collection](https://apps.rancher.io/applications).

## Hvorfor navnet «Lolly Tools»?

**Lolly** fordi frihet er søtt, og fordi en lolly er et sukkertøy i Australia, New Zealand og Storbritannia.

**Tools** fordi et verktøy ligger stille til du plukker det opp. Det kjører ikke når du ikke bruker det, og det overvåker deg ikke mens du gjør det.

## Hvorfor er alt grønt?

lolly.tools åpnes med [Lolly Demo](/info/lolly-demo.html), Lollys eget eksempeldesignsystem med grønt som hovedfarge. Bytt til **Lolly Starter**, et tomt designsystem, eller til ditt eget i [Settings → Design systems](/#/settings?focus=design-systems-section).

## Kan jeg bruke min egen merkevare?

Ja. **Lolly Design System Setup** (`#/start`) bygger et designsystem fra én farge, en fil med designtokener eller et ferdig design. Hvert verktøy tegner deretter med designsystemet ditt. [Start](/info/quickstart.html#put-your-brand-in) går gjennom de tre veiene.

Et designsystem som leveres av organisasjonen din eller versjonen du bruker, er administrert. Det viser en lås og forblir skrivebeskyttet. Lag en redigerbar kopi for å endre det.

## Hvor er det jeg laget i går?

Hvis du trykket **Save as** eller **Save**, ligger arbeidet ditt i **Projects** på startskjermen, i nettleseren eller appen du lagret fra. Hvis du bare trykket **Download**, ligger filen i nedlastingene til nettleseren eller systemet, og en kopi ligger vanligvis i **Assets**. Verktøy som [lagrer mens du arbeider](/info/find-your-work.html#which-tools-save-as-you-work), beholder også ulagret arbeid i **Projects**. [Finn og gjenopprett arbeidet ditt](/info/find-your-work.html) dekker alle tilfellene.

## Jeg lukket fanen. Er arbeidet mitt borte?

Lagret arbeid ligger fortsatt i **Projects**. Ulagret arbeid er borte, unntatt i verktøyene som lagrer mens du arbeider, som også beholder det i **Projects**. Neste gang trykker du **Save as** før du går ut. Se [Hvis du lukket fanen eller forlot verktøyet](/info/find-your-work.html#if-you-closed-the-tab-or-left-the-tool).

## Kan jeg dele arbeidet mitt som en fil i stedet for en lenke?

Ja. Når en lenke ikke kan ta med alt, som dine egne bilder eller lang tekst, sier Share-dialogen hva som ville mangle, og tilbyr en **.lolly**-fil. Den ene filen inneholder designet, bildene det bruker og, hvis du velger det, verktøyet.

Du bestemmer hvor mye som følger med. Navnet ditt og opplysningene dine tas bare med hvis du har samtykket til det i profilen. Lisensiert grafikk holdes tilbake med mindre du velger å inkludere den. Den som åpner en fil som inneholder et verktøy, blir spurt om de stoler på verktøyet før det kan kjøre. Se [Dele arbeidet ditt](/info/using.html#sharing-your-work).

## Hva brukes profilopplysningene mine til?

Opplysningene dine i **Settings** fyller ut verktøyene som ber om dem på forhånd, som et navn på et navneskilt. De blir på denne enheten. Ingenting legges inn i det du lager med mindre du slår på samtykkevalget. Da forsegles de valgte opplysningene i resultatet og angir deg som kilden.

Deling og Sync sender bare innholdet du velger. På en organisasjons Lolly Work-instans sendes også delte økter og arbeid underlagt styring til den serveren. Se [Personvern](/info/privacy.html).

## Hvordan får jeg mobil- eller skrivebordsappene?

Last dem ned fra [Installer Lolly](/info/install.html). Siden lister alle bygg for macOS, Windows, Linux og Android og viser hvordan du sjekker filen du lastet ned. iPhone og iPad får **Lolly Tools** fra App Store. [Delen om iPhone og iPad](/info/install.html#iphone-and-ipad) har lenken.

Alle kan også bygge og dele ut sin egen kopi av appen, med verktøyene og innstillingene målgruppen trenger. [Byggeveiledningen](/info/build-guide.html) viser hvordan.

## Lolly sier at det krever WebGPU. Hva kan jeg gjøre?

Nettappen tegner med WebGPU, en grafikkfunksjon i moderne nettlesere, og sjekker at WebGPU finnes før den åpner et verktøy. Prøv dette i rekkefølge:

1. Oppdater nettleseren til nyeste versjon.
2. Slå på grafikk- eller maskinvareakselerasjon i nettleserens innstillinger, og start deretter nettleseren på nytt.
3. Prøv en testet nettleser: [Støttede miljøer](/info/supported-environments.html) lister dem.
4. På en Mac, iPhone eller iPad kan du [installere appen](/info/install.html) i stedet.

## Kan Lolly redigere og gjengi Figma-, Penpot-, Illustrator- eller InDesign-filene mine?

Ja. Åpne **Design**-verktøyet og klikk **Import a design**: det tar imot en fil i Figmas eget **.fig**-format (Save local copy), en **.penpot**-eksport fra Penpot, en **.ai** eller **.pdf** fra Illustrator, en **.idml** eller **.indd** fra InDesign, et Affinity-dokument, en **.psd** fra Photoshop, en **.pptx** fra PowerPoint, en **.dxf** fra CAD eller **en hvilken som helst SVG** ([alle formatene det leser](/info/design-import.html#what-comes-in-from-each-app)). Du trenger ingen konto, ingen plugin og ingen lisens til en designapp.

![Lolly Designs åpne lerret - Import a design ligger i Lolly-menyen på verktøylinjen](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Fz%3D17ZTfS8MwEMf_mryO5NZ288GHrdqJv1CUvWdtOgppMtJMNv96yaV1iRNEQRBZoblwab53l0-uq915bXgrCOSDpf3LzgANnQ4eI0rrPJn7Gh9cd0sE8lIryxtFIFfatFx6L4F0Mi-11GbUiZYr25QjK3bW-S8I5MnUbRXKCkMgb5uqki6JFFU7rjoXYsSgT8GaLebKZSeGAPkUYypMHp80DeugYYR4J_U7X4XRkY8dFHuTYEJ-jDWM3qoqsEHo4Y20-xJi-SPVaOfRUuAL1hiZXNrG4gH6M85Z5lTAk8x8DdlnPL8gecVfBIEU6F5v0bbCor3VUu4JpOPCKTCWsPI9rBS107d6QyCfRET_Ac6wX36X6UpX-49Ip1mAlMEPkM6QX20aoSpECLTmpadcazPQ9hPlWxboRndWmFEIG1s4Yp3E3Ts-0f4GbcruWHLzlC0frmfpfbGk82LxmD0vUndSTcvXAoknWBKCz5LDSIdiRHV0D2Tfq1BIvdY42Zim5WZ_-n3_mRvwBg&width=1360&height=850&dpi=192&waitMs=3000&format=svg&walker=1&chrome=1&localize=1&dark=1&filename=design)

Lag kommer inn som redigerbare bokser. Tekst kan fortsatt skrives om, former forblir former og bilder legges i biblioteket ditt. Når layouten er lagret, kan **Share with rules** gjøre den til et verktøy som alle med Lolly kan fylle ut på nytt. Se [Importer et design](/info/design-import.html).

## Kan to personer arbeide på samme design uten internett?

Ja. Én person deler en invitasjon (en lenke, en QR-kode eller en kort kode), og den andre godtar. Begge enhetene har da den samme økten i sanntid, med tilstedeværelse og fokusringer. Dette fungerer på alle delte nettverk, inkludert et mobilt tilgangspunkt, fordi ingen server står imellom. Se [Arbeide sammen](/info/collaborate.html). For kolleger på forskjellige nettverk tilbyr en organisasjons Lolly Work-instans autentisert arbeidssamarbeid.

## Hva er funksjonsflaggene?

Funksjonsflagg slår deler av Lolly på eller av. Ved frittstående bruk velger du dine personlige innstillinger. En organisasjon som bruker Lolly Work, kan angi standardverdier eller skjule utvalgte brytere i henhold til sin policy, og administrerte kontroller er merket. Se [Bruk Lolly i organisasjonen din](/info/organisation.html).

![Personlige funksjonsflagg i den frittstående appen; organisasjonens policy kan styre utvalgte brytere](/t/url-shot?url=%2F%23%2Fprofile%3Ffocus%3Dfeature-flags&width=1440&height=1800&dpi=192&waitMs=2000&format=svg&cropSelector=%23feature-flags-section&walker=1&dark=1&filename=pd-feature-flags)

## Hva skiller hjelpeverktøy fra verktøy?

Et hjelpeverktøy gjør én rask jobb på en fil du allerede har, som å komprimere en PDF, konvertere et bilde eller fjerne skjulte data. Mange kjører på enheten din uten at noe lastes opp. Hjelpeverktøy holder jobbene folk vanligvis overlater til et tilfeldig nettsted, inne i Lolly. Å komprimere en kontrakt, konvertere feriebilder som fortsatt inneholder posisjonsdata eller lime inn et token i et formateringsverktøy på nett bør ikke bety å gi filen til et nettsted med ukjent lagringstid, jurisdiksjon og forretningsmodell. [Lolly Utilities](/info/utilities.html) lister dem, og [Handelen vi aldri sa ja til](/info/status-quo.html) forteller historien bak dem.

![Utilities-visningen: Lolly Strip Hidden Data, Compress PDF, Convert Image og de andre jobbene som kjører på enheten, samlet på ett sted](/t/url-shot?url=%2F%23%2Fu&width=1440&height=900&dpi=192&waitMs=1600&css=.welcome-dialog%2C.personalize-nudge%7Bdisplay%3Anone!important%7D&tolerance=0.03&format=svg&walker=1&dark=1&filename=use-utilities&try=1)

## Kan organisasjonen vår bruke SSO, delte prosjekter og godkjenninger?

Ja, med **Lolly Work**, organisasjonsserveren til det samme prosjektet med åpen kildekode. Den kjører separat og legger til engangspålogging gjennom identitetsleverandøren din, SCIM-provisjonering, gruppetillatelser, delte prosjekter og ressurser, arbeidssamarbeid i sanntid, godkjenninger og revisjonsposter. Den vanlige appen fungerer fortsatt på egen hånd.

[Bruk Lolly i organisasjonen din](/info/organisation.html) dekker pålogging og hvordan du finner delt arbeid. [Utrulling](/info/deployment.html#organisation-services-with-lolly-work) dekker oppsett av Lolly Work. Delt innhold og organisasjonens registreringer følger instansens retningslinjer for personvern og lagringstid.

## Hvilke hindringer kan jeg vente når vi tar i bruk Lolly?

Hovedsakelig endringer i hvordan et team produserer arbeid, ikke teknologi. Et team som ønsker et styrt sett med verktøy, trenger noen som lager designsystemet og de første malene. Alle kan fortsatt lage sine egne verktøy i Lolly Design fra første dag, uten krav om git. Eksisterende prosesser fungerer fortsatt selv når resultatene ikke følger merkevaren. Å tilpasse ett synlig resultat godt, med før og etter side om side, viser verdien raskere enn en plan.

[Innføring & styring](/info/adoption-governance.html) dekker opplæring etter rolle, hvordan du måler en pilot og hvordan en styringsprosess kan se ut.

## Ble Lolly «vibe-kodet»?

Lolly ble utviklet med AI-assistert koding, AI-assistert utforsking og, mange steder, AI-assistert innhold, med en blanding av modeller og leverandører, inkludert ledende AI-selskaper som tilbyr tjenester i offentlig sky. Et menneske skapte arkitekturen, valgte og bearbeidet koden bevisst og styrte den visuelle utformingen av opplevelsen.

Et sikkerhetsvarsel med høy eller kritisk alvorlighetsgrad i Lollys avhengigheter blokkerer CI. Et varsel som ennå ikke kan rettes, settes bare til side som et godkjent unntak med en skriftlig begrunnelse. [SECURITY.md](https://github.com/lolly-tools/lolly/blob/main/SECURITY.md#dependency-audit-exceptions) lister alle gjeldende unntak, og [utgivelsesnotatene](https://github.com/lolly-tools/lolly/releases) lister dem hver utgivelse har. SECURITY.md sier også hvordan du rapporterer en sårbarhet.

Sjekker under byggingen avviser også formuleringer som virker maskingenererte i kodekommentarene, appen og denne dokumentasjonen, for å holde teksten enkel for alle lesere. En bivirkning er at en detektor kan få vanskeligere for å avgjøre hvilken tekst en modell skrev. Det var ikke hensikten vår.

Det viktigste er at Lolly bygger på flere tiår med arbeid med åpen kildekode fra eksperter over hele verden.

**Opplysninger om generativ AI:**

- **LLM-skrevet kode:** Opus 4.8, Gemini 3.1, Qwen3-Coder-Next, Codex Sol (denne listen kan utvides)
- **LLM-utforsking:** Gemini 3.1, Fable, Codex Astra
- **Dokumentasjon:** Sonnet 5
- **Biblioteker med åpen kildekode:** De respektive forfatterne, oppgitt i SBOM-en, kommentarer og filhoder

Denne listen omfatter ikke modeller som er inkludert i Lollys kildekode.

**Menneskelige bidrag:**
- **Idéutvikling, gjennomgang og tilbakemeldinger:** Ravan Naidoo, Matthias Eckermann, Kelly Andrews, Ryan Kleeman, Peter Chamalian, Penpot-fellesskapet, Tim Hildred (listen er ikke uttømmende)
- **Arkitektur, kunstnerisk ledelse & opprydding i KI-rusk:** Andy Fitzsimon

## Hvor ble det av verktøyene med SUSE-profil?

De ligger i et eget, privat kodelager. En offentlig klone henter ikke SUSE-merkevarepakken, så en byggversjon fra den bruker den nøytrale profilen `lolly-start` med mindre du velger en annen. Den profilen har fellesskapets merkevareuavhengige verktøy og en tom merkevare du fyller med din egen. [lolly.tools](https://lolly.tools) bygges med profilen `lolly-demo` og åpnes i [Lolly Demo](/info/lolly-demo.html), Lollys eget designsystem. SUSE driver sin egen instans for å beskytte varemerkene sine.

## Hvilken smak har Lolly-logoen?

Noen sier lime, andre sier mynte og noen ganger eple. Lolly står for sødmen, og du lager smaken.

## Hva mener Lolly med innholdssuverenitet?

Kontroll over hvordan innholdet ditt skapes, forvaltes, lagres og flyttes mellom systemene du velger. Lolly støtter lokal produksjon, redigerbart arbeid og flyttbare verktøy. Lolly Work legger til delte tjenester som organisasjonen styrer. Kildelisensene, tilgjengelige avhengigheter og dataflyten i arbeidsflyten har fortsatt betydning. [Hva er innholdssuverenitet?](/info/content-sovereignty.html) forklarer hver kontrollmulighet og dens grenser.

## Kan vi beholde vårt eksisterende DAM?

Ja. Et støttet DAM kan fortsatt være den autoritative kilden mens Lolly Work kobler utvalgte ressurser til Lolly-verktøy. Tilgang til kilden, tillatte endringer, bruksrettigheter og godkjenning av det ferdige resultatet er separate beslutninger. [Bruk Lolly med ditt eksisterende DAM](/info/use-with-dam.html) forklarer oppsettet, og [SUSEs erfaring med Brandfolder](/info/suse-brandfolder.html) dokumenterer vellykket bruk under innføringen.
