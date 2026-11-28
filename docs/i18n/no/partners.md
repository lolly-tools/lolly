# Arbeide med partnere

Mange arbeider bærer to merkevarer, som en sponsors logo på en arrangementsplakat, en forhandlers tilbud under produsentens navn, en felles kunngjøring eller en kasusstudie skrevet sammen med en leverandør. Denne siden er for begge parter.

På denne siden er **hovedmerkevaren** den merkevaren som arbeidet lages i designsystemet til, og **partneren** er den andre merkevaren på arbeidet. Begge parter kan lage arbeidet. [Merkevarearkitekturer](/info/brand-architectures.html#co-branding) sammenligner samprofilering med andre merkevareordninger.

<!--i:eti-info-->
## Slik håndterer Lolly to merkevarer i dag

- **Ett designsystem tegner hvert arbeid.** Hovedmerkevarens farger, typografi og interne regler gjelder. Partnerens logo legges inn som grafikk: et bilde fra Assets eller en egen logo lagret i et designsystem.
- **En merkevare følger med som en fil.** En designsystemfil (`.lolly`) inneholder tokener, skrifter og logoer. Et gjenbrukbart verktøy laget med **Share with rules** inneholder én ferdig layout med inndataene du tillater. Merkevareferdigheter følger med som egne filer.
- **En merkevare kan også ha en adresse.** En [merkevareside](/info/brand-page.html) publiserer logoer, farger, typografi og regler som en partner kan lese, med tokener og ferdigheter for verktøyene deres.
- **Lolly sjekker bare hovedmerkevarens regler.** Lolly kjenner ikke partnerens regler, som frisone eller minstestørrelse, så sjekk dem mot partnerens retningslinjer. I et Lolly Work-partnerprogram inneholder et selskaps partnerpakke reglene deres, og Lolly Design sjekker selskapets logoer mot pakken.
- **Et helt partnerprogram kjører på Lolly Work.** Når forhandlere, distributører eller andre partnere lager arbeider i merkevaren din på din Lolly Work, gir et partnerprogram hvert partnerselskap bare verktøyene, filene og malene du velger. Programmet lagrer selskapets logoer og opplysninger, fyller dem inn i malene dine og registrerer selskapet i hver fil. [Driv et partnerprogram](/info/manage/run-a-partner-programme.html) er veiledningen for teamet som driver et.

<!--i:eti-folder-shared-->
## Del merkevaren din med en partner

### Velg hva du skal sende

| Send | Hvordan | Partneren får | Passer for |
| --- | --- | --- | --- |
| En designsystemfil | **Export** i linjen øverst i [Lolly Design System Setup](/info/brand-studio.html#move-a-brand-between-devices) | Tokenene, skriftene, logoene og temapreferansen din, som et designsystem de kan bytte til | En partner som lager mange arbeider i merkevaren din |
| Et gjenbrukbart verktøy | I Lolly Design, **Share with rules** ([Del et design med regler](/info/create-a-tool.html)) | Én ferdig layout med inndataene du tillater, som navnet og logoen deres. Filen inneholder de oppslåtte fargeverdiene, skriftene og bildene, slik at deres eget designsystem ikke kan endre stilen på den faste grafikken | Et samprofilert flygeblad, merke eller banner som hver partner fyller ut |
| Merkevareferdigheter | **Skills**-rommet: **Download skill (.zip)** eller **Copy as one file** | De skriftlige standardene dine, for folkene og agentene deres | Begge alternativene over, når en agent gjør noe av arbeidet |
| En merkevareside | **Publish a brand page** i Lolly Design System Setup, eller `lolly system publish`, skriver en mappe du publiserer ([Merkevaresider](/info/brand-page.html)) | De gjeldende logoene, fargene, typografien og reglene dine på én adresse, med tokener og ferdigheter for verktøyene deres. Logoer og skriftfiler vises når rettighetene tillater det, og siden lister det som ble holdt tilbake | Deling med folk du ikke sender filer til |
| Tokener | **Tokens (.json)** i studioets **More**-meny | Det rene designtokendokumentet, uten skrifter eller logoer | En partners egne designverktøy eller bygg |

![Lolly Design System Setup med Lolly Demo, åpnet i Skills-rommet: Export i linjen, More-menyen åpen på Tokens (.json), og Download skill (.zip) og Copy as one file ved siden av den valgte ferdigheten](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dskills&width=1200&height=900&dpi=192&waitMs=1800&waitSelector=.skills-reader-actions&drive=click%3A%5Bdata-ds-more%5D%3Bwait%3A500&format=svg&walker=1&dark=1&filename=partners-send)

::: warning Skriftene dine følger med i filen
Skrifter du har lagt til, følger med i en designsystemfil, så sjekk at lisensene lar deg sende filene videre.
:::

Et gjenbrukbart verktøy ber deg bekrefte før det tar med et bilde med lisensbegrensninger ([Forhåndsvis og del](/info/create-a-tool.html#preview-and-share)).

### Lag en mal med felles profilering

Et gjenbrukbart verktøy holder alt partnerne lager innenfor layouten din. En partner endrer bare det du tillater.

1. Lag designet med designsystemet ditt i Lolly Design. Tegn en bildeboks der partnerens logo skal stå, og la det være så mye plass rundt boksen som layouten trenger.
2. Velg **Share with rules** fra File menu. Velg bildeboksen og deretter **Make editable**. Tillat opplasting av erstatningsbilder i **Rules**, angi en minste pikselstørrelse og opplastingsformatene du godtar (SVG der du kan). Sett boksens **Image fit** til **Contain (fit inside)** for å holde en bred eller høy logo innenfor boksen.
3. Gjør også partnerens navn eller tilbud redigerbart, med en tegngrense.
4. Trykk **Preview** og prøv en svært bred logo, en svært høy logo og et langt navn.
5. Velg **Share .lolly**, og skriv instruksjoner til partneren: hvilken versjon av logoen de skal laste opp, for eksempel den vannrette logoen i full farge for en lys bakgrunn.

![Share with rules på et arrangementskort med felles profilering: partnerens logoboks er valgt og redigerbar, og Rules tillater bildeopplastinger på minst 480 ganger 110 piksler i PNG eller SVG](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Fboxes%3D%255B%257B%2522id%2522%253A%2522board%2522%252C%2522name%2522%253A%2522Build%2520day%2520card%2522%252C%2522kind%2522%253A%2522frame%2522%252C%2522x%2522%253A0%252C%2522y%2522%253A0%252C%2522w%2522%253A1600%252C%2522h%2522%253A900%252C%2522shape%2522%253A%2522rect%2522%252C%2522bg%2522%253A%2522%257Bcolor.brand.sugar%257D%2522%252C%2522clipChildren%2522%253Atrue%257D%252C%257B%2522id%2522%253A%2522dot-large%2522%252C%2522name%2522%253A%2522Large%2520circle%2522%252C%2522kind%2522%253A%2522box%2522%252C%2522x%2522%253A1040%252C%2522y%2522%253A70%252C%2522w%2522%253A480%252C%2522h%2522%253A480%252C%2522shape%2522%253A%2522circle%2522%252C%2522bg%2522%253A%2522%257Bcolor.brand.pandanus%257D%2522%252C%2522frame%2522%253A%2522board%2522%257D%252C%257B%2522id%2522%253A%2522dot-small%2522%252C%2522name%2522%253A%2522Small%2520circle%2522%252C%2522kind%2522%253A%2522box%2522%252C%2522x%2522%253A1330%252C%2522y%2522%253A380%252C%2522w%2522%253A240%252C%2522h%2522%253A240%252C%2522shape%2522%253A%2522circle%2522%252C%2522bg%2522%253A%2522%257Bcolor.brand.green-apple%257D%2522%252C%2522frame%2522%253A%2522board%2522%257D%252C%257B%2522id%2522%253A%2522band%2522%252C%2522name%2522%253A%2522Partner%2520band%2522%252C%2522kind%2522%253A%2522box%2522%252C%2522x%2522%253A0%252C%2522y%2522%253A680%252C%2522w%2522%253A1600%252C%2522h%2522%253A220%252C%2522shape%2522%253A%2522rect%2522%252C%2522bg%2522%253A%2522%257Bcolor.brand.avocado%257D%2522%252C%2522frame%2522%253A%2522board%2522%257D%252C%257B%2522id%2522%253A%2522lolly%2522%252C%2522name%2522%253A%2522Lolly%2520logo%2522%252C%2522kind%2522%253A%2522image%2522%252C%2522x%2522%253A120%252C%2522y%2522%253A96%252C%2522w%2522%253A260%252C%2522h%2522%253A90%252C%2522image%2522%253A%2522lolly%2Flogo%2Fhorizontal%2522%252C%2522fit%2522%253A%2522contain%2522%252C%2522imgpos%2522%253A%2522left%2522%252C%2522frame%2522%253A%2522board%2522%257D%252C%257B%2522id%2522%253A%2522headline%2522%252C%2522name%2522%253A%2522Headline%2522%252C%2522kind%2522%253A%2522text%2522%252C%2522x%2522%253A120%252C%2522y%2522%253A260%252C%2522w%2522%253A880%252C%2522h%2522%253A180%252C%2522text%2522%253A%2522Build%2520day%25202026%2522%252C%2522fg%2522%253A%2522%257Bcolor.brand.liquorice%257D%2522%252C%2522fontSize%2522%253A120%252C%2522weight%2522%253A%2522700%2522%252C%2522font%2522%253A%2522display%2522%252C%2522align%2522%253A%2522left%2522%252C%2522valign%2522%253A%2522middle%2522%252C%2522frame%2522%253A%2522board%2522%257D%252C%257B%2522id%2522%253A%2522sub%2522%252C%2522name%2522%253A%2522Subtitle%2522%252C%2522kind%2522%253A%2522text%2522%252C%2522x%2522%253A120%252C%2522y%2522%253A450%252C%2522w%2522%253A880%252C%2522h%2522%253A90%252C%2522text%2522%253A%2522Twelve%2520hours%2520of%2520making%252C%2520with%2520friends%2522%252C%2522fg%2522%253A%2522%257Bcolor.brand.basalt%257D%2522%252C%2522fontSize%2522%253A48%252C%2522align%2522%253A%2522left%2522%252C%2522valign%2522%253A%2522middle%2522%252C%2522frame%2522%253A%2522board%2522%257D%252C%257B%2522id%2522%253A%2522with%2522%252C%2522name%2522%253A%2522In%2520partnership%2520with%2522%252C%2522kind%2522%253A%2522text%2522%252C%2522x%2522%253A120%252C%2522y%2522%253A750%252C%2522w%2522%253A400%252C%2522h%2522%253A80%252C%2522text%2522%253A%2522In%2520partnership%2520with%2522%252C%2522fg%2522%253A%2522%257Bcolor.brand.basalt%257D%2522%252C%2522fontSize%2522%253A34%252C%2522align%2522%253A%2522left%2522%252C%2522valign%2522%253A%2522middle%2522%252C%2522frame%2522%253A%2522board%2522%257D%252C%257B%2522id%2522%253A%2522partner%2522%252C%2522name%2522%253A%2522Partner%2520logo%2522%252C%2522kind%2522%253A%2522image%2522%252C%2522x%2522%253A500%252C%2522y%2522%253A735%252C%2522w%2522%253A480%252C%2522h%2522%253A110%252C%2522image%2522%253A%2522%2Ftools%2Flogo-wall%2Fassets%2Fpartner-name.svg%2522%252C%2522fit%2522%253A%2522contain%2522%252C%2522frame%2522%253A%2522board%2522%257D%255D%26w%3D1600%26h%3D900&width=1280&height=1000&dpi=192&waitMs=3000&drive=click%3Abutton%5Baria-label%3D%22File%20menu%22%5D%3Bwait%3A500%3Bclick%3Atext%3DShare%20with%20rules%3Bwait%3A2500%3Bclick%3A%23tool-canvas%20%5Bdata-box-id%3D%22partner%22%5D%3Bclick%3Abutton%3Ahas-text%28%22Make%20editable%22%29%3Bwait%3A1200%3Bclick%3A.dr-input%20.dr-advanced%20%3E%20summary%3Bpress%3AControlOrMeta%2BA%7Con%3D%5Bdata-rule%3D%22image%3AminWidth%22%5D%3Bpress%3A4%3Bpress%3A8%3Bpress%3A0%3Bpress%3AControlOrMeta%2BA%7Con%3D%5Bdata-rule%3D%22image%3AminHeight%22%5D%3Bpress%3A1%3Bpress%3A1%3Bpress%3A0%3Bclick%3A%5Bdata-rule%3D%22image-format%3Ajpeg%22%5D%3Bclick%3A%5Bdata-rule%3D%22image-format%3Awebp%22%5D%3Bclick%3A%5Bdata-rule%3D%22image-format%3Aavif%22%5D&format=svg&walker=1&dark=1&filename=partners-template-rules)

Partneren slipper filen i Lolly, vurderer forespørselen om tillit, fyller ut inndataene og laster ned formatene du har tillatt ([Bruk det ferdige verktøyet](/info/create-a-tool.html#use-the-finished-tool)). Lolly holder logoen innenfor boksen du tegnet. Lolly leser ikke partnerens regel for frisone, så logoen får bare plassen du lar stå rundt boksen.

### Gi merkevareferdighetene dine til en agent

Ferdigheter veileder folk og agenter. Lolly sjekker merkevarens regler.

- Åpne **Skills**-rommet (`#/start?area=skills`) i Lolly Design System Setup, velg en ferdighet og trykk **Download skill (.zip)**. Mappens kataloglenker peker til din Lolly, og `lolly.json` registrerer hvor kopien kom fra. **Copy as one file** legger den samme teksten på utklippstavlen til bruk i et chatvindu.
- Fra en terminal skriver `lolly system skill <name> --into=<dir>` den samme mappen ([I en mappe for et lokalt agentverktøy](/info/brand-skills.html#in-a-folder-for-a-local-agent-tool)).
- Din egen maskin lister ferdigheter merket `internal` i tillegg til dem merket `public`, så velg hvilke du vil sende ([Offentlige og interne ferdigheter](/info/brand-skills.html#public-and-internal-skills)).
- For et designsystem uten egne ferdigheter skriver Lolly et grunnlag fra tokenene og merkevarens regler, og rommet lister grunnlaget.
- En kopi oppdaterer ikke seg selv. Når du publiserer en ny revisjon av en ferdighet, sender du mappen på nytt.

<!--i:eti-download-->
## Arbeid med en merkevare du har fått

For partneren som mottar en designsystemfil. Når hovedmerkevaren driver et partnerprogram på sin egen Lolly Work, logger du inn der i stedet: startskjermen viser firmakortet ditt og malene som er publisert til deg ([Hva partnere ser](/info/manage/run-a-partner-programme.html#what-partners-see)).

1. **Åpne filen.** Slipp filen på Lolly eller trykk **Open**; **Add from…** i Lolly Design System Setup tar også imot filen. Forhåndsvisningen lister filens innhold før noe skrives. En designsystemfil legger til et eget designsystem under hovedmerkevarens navn og gjør det aktivt. Ditt eget designsystem blir på enheten. En fil som i stedet kobler appen til hovedmerkevarens egen Lolly, lister først virkningene for hele enheten din; [Bruk Lolly i organisasjonen din](/info/organisation.html) dekker den typen fil.
2. **Se deg rundt i merkevaren.** I Lolly Design System Setup viser **Board** innholdet i designsystemet, **Logos** har merkene og **Rules** lister merkevarens regler som Lolly sjekker. **Skills** viser grunnlaget Lolly skriver fra tokenene og reglene; hovedmerkevarens egne ferdigheter kommer som separate filer hvis de sender dem.
3. **Bytt mellom merkevarer.** **Settings → Preferences → Design systems** bytter designsystem for hele enheten, og **Settings → Design system** har en stripe med forsider du kan bytte fra. Gjør ferdig arbeidet for én merkevare før du bytter.
4. **Plasser ditt eget merke.** Last opp logoen din til **Assets**, der den er tilgjengelig i alle designsystemer, eller legg den til som et **egendefinert merke** i hovedmerkevarens designsystem (**Logos**-rommet, **Custom marks**), der den følger med i designsystemets fil. Et designsystem som viser en lås, er skrivebeskyttet, så bruk Assets der. [Plasser en partners merke](#place-a-partner-s-mark) har sjekkene.
5. **Sjekk før du eksporterer.** I Lolly Design lister eksportpanelets **Before you export**-kort funn opp mot hovedmerkevarens regler, lag for lag ([Før du eksporterer](/info/design.html#before-you-export)). **Design system**-kortet viser designsystemet som er registrert i filen.
6. **Send arbeidet tilbake.** Send den eksporterte filen eller det redigerbare designet som en `.lolly` ([Del arbeidet ditt](/info/using.html#sharing-your-work)). Et design åpnes i det designsystemet som er aktivt, så hovedmerkevaren åpner ditt med sitt eget designsystem aktivt.

::: note En designsystemfil oppdateres ikke
En designsystemfil er en kopi av merkevaren på eksportdagen. Ingenting oppdaterer kopien.
:::

Når hovedmerkevaren sender en nyere fil, åpner du filen på samme måte. Sjekk deretter hvilket designsystem som er aktivt i **Settings → Preferences → Design systems**, og fjern den eldre kopien der når du ikke lenger trenger den.

![Design systems i Settings: Lolly Demo er aktivt, Lolly Starter har en Use-knapp som bytter for hele enheten, og Open or import a file tar imot en designsystemfil](/t/url-shot?url=%2F%23%2Fsettings%3Ffocus%3Ddesign-systems-section&width=1440&height=1200&dpi=192&waitMs=2400&cropSelector=%23design-systems-section&format=svg&walker=1&dark=1&filename=partners-design-systems)

<!--i:eti-image-->
## Plasser en partners merke

| Måte | Trinn | Best for |
| --- | --- | --- |
| Et bilde i Assets | Slipp filen på opplastingsområdet i **Assets**, og velg den deretter i et verktøys bildefelt, eller i Lolly Design med **Image** fra verktøylinjens legg til-meny | Enkeltstående arbeider. En opplasting tilhører enheten, så den er tilgjengelig uansett hvilket designsystem som er aktivt |
| Et egendefinert merke | **Logos**-rommet, **Custom marks**: skriv et navn på merket, og velg deretter **Choose file…** | En partner du ofte arbeider med. Merket tilhører designsystemet og følger med i filen |
| En ferdig logosammenstilling | Lag sammenstillingen av begge merkene i tegneverktøyet ditt, og legg den deretter til som et egendefinert merke | En logosammenstilling med «med» eller «i samarbeid med» som brukes om igjen |

::: check Sjekk merket før du eksporterer
- **Riktig fil.** Bruk filen partneren har levert, en SVG hvis det finnes en. En logo kopiert fra en nettside eller et lysbilde blir uskarp på trykk.
- **Riktig versjon for bakgrunnen.** Bruk en negativ eller ensfarget versjon på en mørk eller urolig bakgrunn når partnerens retningslinjer tilbyr en.
- **Proporsjoner.** Sett bildeboksens **Image fit** til **Contain (fit inside)**, så blir merket aldri strukket.
- **Frisone og størrelse.** La det være så mye plass rundt merket som partnerens retningslinjer krever, og hold merket over minstestørrelsen deres. Lolly måler ingen av delene.
- **Hvilken merkevare som er hovedmerkevaren.** Tilpass størrelsen på de to merkene etter begge merkevarenes retningslinjer for hvilken som skal dominere.
- **Rettigheter.** Lolly viser lisensen som er registrert for en katalogressurs. En fil du laster opp selv, har ingen registrert lisens, og detaljene viser *Licence not recorded*, så oppbevar partnerens tillatelse til å bruke merket sammen med din egen dokumentasjon ([Kreative rettigheter og kreditering](/info/creative-rights.html)).
:::

![Before you export på et kort med felles profilering: designsystemet er Lolly Demo, partnerens logo er oppført som et bilde utenfor designsystemets ressurser, og de fire merkevarereglene har ingen merknader](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Fboxes%3D%255B%257B%2522id%2522%253A%2522board%2522%252C%2522name%2522%253A%2522Build%2520day%2520card%2522%252C%2522kind%2522%253A%2522frame%2522%252C%2522x%2522%253A0%252C%2522y%2522%253A0%252C%2522w%2522%253A1600%252C%2522h%2522%253A900%252C%2522shape%2522%253A%2522rect%2522%252C%2522bg%2522%253A%2522%257Bcolor.brand.sugar%257D%2522%252C%2522clipChildren%2522%253Atrue%257D%252C%257B%2522id%2522%253A%2522dot-large%2522%252C%2522name%2522%253A%2522Large%2520circle%2522%252C%2522kind%2522%253A%2522box%2522%252C%2522x%2522%253A1040%252C%2522y%2522%253A70%252C%2522w%2522%253A480%252C%2522h%2522%253A480%252C%2522shape%2522%253A%2522circle%2522%252C%2522bg%2522%253A%2522%257Bcolor.brand.pandanus%257D%2522%252C%2522frame%2522%253A%2522board%2522%257D%252C%257B%2522id%2522%253A%2522dot-small%2522%252C%2522name%2522%253A%2522Small%2520circle%2522%252C%2522kind%2522%253A%2522box%2522%252C%2522x%2522%253A1330%252C%2522y%2522%253A380%252C%2522w%2522%253A240%252C%2522h%2522%253A240%252C%2522shape%2522%253A%2522circle%2522%252C%2522bg%2522%253A%2522%257Bcolor.brand.green-apple%257D%2522%252C%2522frame%2522%253A%2522board%2522%257D%252C%257B%2522id%2522%253A%2522band%2522%252C%2522name%2522%253A%2522Partner%2520band%2522%252C%2522kind%2522%253A%2522box%2522%252C%2522x%2522%253A0%252C%2522y%2522%253A680%252C%2522w%2522%253A1600%252C%2522h%2522%253A220%252C%2522shape%2522%253A%2522rect%2522%252C%2522bg%2522%253A%2522%257Bcolor.brand.avocado%257D%2522%252C%2522frame%2522%253A%2522board%2522%257D%252C%257B%2522id%2522%253A%2522lolly%2522%252C%2522name%2522%253A%2522Lolly%2520logo%2522%252C%2522kind%2522%253A%2522image%2522%252C%2522x%2522%253A120%252C%2522y%2522%253A96%252C%2522w%2522%253A260%252C%2522h%2522%253A90%252C%2522image%2522%253A%2522lolly%2Flogo%2Fhorizontal%2522%252C%2522fit%2522%253A%2522contain%2522%252C%2522imgpos%2522%253A%2522left%2522%252C%2522frame%2522%253A%2522board%2522%257D%252C%257B%2522id%2522%253A%2522headline%2522%252C%2522name%2522%253A%2522Headline%2522%252C%2522kind%2522%253A%2522text%2522%252C%2522x%2522%253A120%252C%2522y%2522%253A260%252C%2522w%2522%253A880%252C%2522h%2522%253A180%252C%2522text%2522%253A%2522Build%2520day%25202026%2522%252C%2522fg%2522%253A%2522%257Bcolor.brand.liquorice%257D%2522%252C%2522fontSize%2522%253A120%252C%2522weight%2522%253A%2522700%2522%252C%2522font%2522%253A%2522display%2522%252C%2522align%2522%253A%2522left%2522%252C%2522valign%2522%253A%2522middle%2522%252C%2522frame%2522%253A%2522board%2522%257D%252C%257B%2522id%2522%253A%2522sub%2522%252C%2522name%2522%253A%2522Subtitle%2522%252C%2522kind%2522%253A%2522text%2522%252C%2522x%2522%253A120%252C%2522y%2522%253A450%252C%2522w%2522%253A880%252C%2522h%2522%253A90%252C%2522text%2522%253A%2522Twelve%2520hours%2520of%2520making%252C%2520with%2520friends%2522%252C%2522fg%2522%253A%2522%257Bcolor.brand.basalt%257D%2522%252C%2522fontSize%2522%253A48%252C%2522align%2522%253A%2522left%2522%252C%2522valign%2522%253A%2522middle%2522%252C%2522frame%2522%253A%2522board%2522%257D%252C%257B%2522id%2522%253A%2522with%2522%252C%2522name%2522%253A%2522In%2520partnership%2520with%2522%252C%2522kind%2522%253A%2522text%2522%252C%2522x%2522%253A120%252C%2522y%2522%253A750%252C%2522w%2522%253A400%252C%2522h%2522%253A80%252C%2522text%2522%253A%2522In%2520partnership%2520with%2522%252C%2522fg%2522%253A%2522%257Bcolor.brand.basalt%257D%2522%252C%2522fontSize%2522%253A34%252C%2522align%2522%253A%2522left%2522%252C%2522valign%2522%253A%2522middle%2522%252C%2522frame%2522%253A%2522board%2522%257D%252C%257B%2522id%2522%253A%2522partner%2522%252C%2522name%2522%253A%2522Partner%2520logo%2522%252C%2522kind%2522%253A%2522image%2522%252C%2522x%2522%253A500%252C%2522y%2522%253A735%252C%2522w%2522%253A480%252C%2522h%2522%253A110%252C%2522image%2522%253A%2522%2Ftools%2Flogo-wall%2Fassets%2Fpartner-name.svg%2522%252C%2522fit%2522%253A%2522contain%2522%252C%2522frame%2522%253A%2522board%2522%257D%255D%26w%3D1600%26h%3D900&width=1440&height=1000&dpi=192&waitMs=3000&drive=click%3A.edge-dock-tab%3Ahas-text%28%22Export%22%29%3Bwait%3A2500%3Bclick%3A%5Bdata-action%3D%22preflight-open%22%5D%3Bwait%3A1200&cropSelector=.preflight-modal&format=svg&walker=1&dark=1&filename=partners-before-export)

Eksportens [designsystemoppføring](/info/exporting.html#the-design-system-record) angir hovedmerkevarens designsystem og fargevariant. Den registrerer ikke partnerens merkevare, unntatt i et Lolly Work-partnerprogram, der den også angir partnerbedriften og programmet arbeidet ble laget for.

### Gi hver merkevares ferdigheter til en agent

Når en agent gjør arbeidet, gir du agenten begge merkevarenes ferdigheter slik de er, og forteller hvilken merkevare som er hovedmerkevaren. Hver merkevares ferdigheter beholder sine egne navn og ID-er. Lolly slår ikke sammen to merkevarers ferdigheter eller avgjør hvilken merkevare som får forrang.

<!--i:eti-grid-->
## Logovegger for sponsorer og arrangementer

Verktøyet [Lolly Logo Wall](/#/tool/logo-wall) ordner logoer i et jevnt rutenett for en sponsorvegg, et partnerlysbilde eller en pressebakgrunn. På et arrangement er verten vanligvis hovedmerkevaren: veggen lages i vertens designsystem, og hver sponsors logo plasseres på veggen som grafikk.

![En sponsorvegg i tre nivåer på mørkegrønt, med alle logoene tegnet i hvitt: to gullpartnere, tre sølvpartnere og fem fellesskapspartnere, hvert nivå under sin egen overskrift og hvert lavere nivå ett trinn mindre](/t/url-shot?url=%2F%23%2Ftool%2Flogo-wall%3Flogos%3D%255B%257B%2522logo%2522%253A%2522%252Ftools%252Flogo-wall%252Fassets%252Fyour-logo.svg%2522%252C%2522tier%2522%253A%2522Gold%2520partners%2522%257D%252C%257B%2522logo%2522%253A%2522%252Ftools%252Flogo-wall%252Fassets%252Flogo-here.svg%2522%252C%2522tier%2522%253A%2522Gold%2520partners%2522%257D%252C%257B%2522logo%2522%253A%2522%252Ftools%252Flogo-wall%252Fassets%252Fcompany.svg%2522%252C%2522tier%2522%253A%2522Silver%2520partners%2522%257D%252C%257B%2522logo%2522%253A%2522%252Ftools%252Flogo-wall%252Fassets%252Fsponsor.svg%2522%252C%2522tier%2522%253A%2522Silver%2520partners%2522%257D%252C%257B%2522logo%2522%253A%2522%252Ftools%252Flogo-wall%252Fassets%252Fbrand-name.svg%2522%252C%2522tier%2522%253A%2522Silver%2520partners%2522%257D%252C%257B%2522logo%2522%253A%2522%252Ftools%252Flogo-wall%252Fassets%252Fsample-co.svg%2522%252C%2522tier%2522%253A%2522Community%2520partners%2522%257D%252C%257B%2522logo%2522%253A%2522%252Ftools%252Flogo-wall%252Fassets%252Fexample.svg%2522%252C%2522tier%2522%253A%2522Community%2520partners%2522%257D%252C%257B%2522logo%2522%253A%2522%252Ftools%252Flogo-wall%252Fassets%252Florem-ipsum.svg%2522%252C%2522tier%2522%253A%2522Community%2520partners%2522%257D%252C%257B%2522logo%2522%253A%2522%252Ftools%252Flogo-wall%252Fassets%252Fplaceholder.svg%2522%252C%2522tier%2522%253A%2522Community%2520partners%2522%257D%252C%257B%2522logo%2522%253A%2522%252Ftools%252Flogo-wall%252Fassets%252Fpartner-name.svg%2522%252C%2522tier%2522%253A%2522Community%2520partners%2522%257D%255D%26columns%3D3%26gap%3D64%26padding%3D96%26background%3D033633%26headingColor%3Dffffff%26vectorizeAll%3Dtrue%26inkColor%3Dffffff%26transparentBg%3Dfalse&width=1440&height=900&dpi=192&waitMs=4000&cropSelector=%23tool-canvas&format=svg&walker=1&filename=partners-logo-wall&try=1)

1. Åpne Lolly Logo Wall og slipp logoene på **Logos**. Hver logo får sitt eget sett med kontroller.
2. Gi hver logo et **Tier**, for eksempel «Gullpartnere». Hvert nivå får sine egne rader, i den rekkefølgen nivåene først forekommer, under sin egen overskrift; **Tier headings** slår av overskriftene. Med **Tier sizes** satt til **Step down** får hvert lavere nivå plass til én logo mer per rad, slik at høyere nivåer fremstår større. **Presence** og **Size %** justerer én logo innenfor nivået.
3. La **Balance sizes** være på. Lolly Logo Wall tilpasser størrelsen på hver logo etter dens optiske vekt, slik at en tung logo krymper og en lett vokser, og hvert nivå fremstår jevnt.
4. **Trim margins** beskjærer hver logo til selve grafikken. Slå av valget når logofilen allerede inneholder frisonen eieren krever.
5. **Remove white backgrounds** fjerner den hvite boksen som ofte følger med en logo kopiert fra et lysbilde.
6. Angi **Columns**, avstand og utfylling under **Layout**. **Background** starter med designsystemets overflatefarge.
7. For en ensfarget vegg slår du på **Render all as vector** og velger **Ink colour**, eller setter én logos **Filter** til **Greyscale**. Bruk en ensfarget versjon bare der hver sponsors retningslinjer tillater det.
8. For en pressebakgrunn velger du **Grid**, **Brick** eller **Checker** under **Step & repeat**, og angir antallet **Rows**.

Eksporter veggen som PNG, SVG, PDF eller en CMYK-PDF for trykk. Angi en annen størrelse og form i eksportpanelet, for eksempel en høy story på 1080 x 1920 eller en A4-side, så ordner lerretet veggen på nytt for å fylle formen, med færre eller flere logoer per rad. Eksporten samsvarer med lerretet. For å plassere veggen på en plakat velger du **Image** fra verktøylinjens legg til-meny i Lolly Design, tegner en ramme og velger Lolly Logo Wall på velgerens **Tools**-fane ([Verktøy i et design](/info/design.html#tools-inside-a-design)). For bildetekster mellom logoene kan en **Dynamic layout** satt til **grid** i Lolly Design inneholde én bildeboks per logo ([Layout i Lolly Design](/info/design-layout.html#dynamic-layouts)).

I en terminal bygger `lolly run logo-wall logos/*.png --output=wall.svg` veggen fra en mappe med bilder, og en CSV med kolonnene `logo` og `tier` bygger en vegg med nivåer. SVG og PNG trenger ingen nettleser ([En sponsorvegg med nivåer](/info/cli-rendering.html#a-sponsor-wall-with-tiers)).

Når en sponsor publiserer en [merkevareside](/info/brand-page.html), henter `lolly run logo-wall --logos-from=<address or folder>` den gjeldende logoen for overflaten og skriver ut det siden sier om bruk. Gjenta flagget for hver sponsor.

Lolly Logo Wall kjenner ingen sponsors regler. Tiers og Presence angir størrelser i forhold til hverandre, ikke en sponsors minstestørrelse, og ingenting sjekker frisonen mellom naboer. Sjekk den ferdige veggen mot hver sponsors retningslinjer i den størrelsen den skal trykkes eller vises.

<!--i:eti-hammer-->
## Hva Lolly ennå ikke gjør

- Et arbeid tegnes i ett designsystem. Partnerens farger, typografi og regler er ikke et designsystem inne i arbeidet, og partnerens merke er et bilde.
- Utenfor et Lolly Work-partnerprogram lagres eller sjekkes ikke partnerregler i appen: frisone, minstestørrelse og tillatte behandlinger som ensfarget eller negativ.
- En partnerpakke, en liten pakke med partnerens logoer, farger og regler til bruk i en annen merkevares arbeid, når bare appen gjennom et Lolly Work-partnerprogram. Ellers kjøres pakkens sjekk fra en terminal: `lolly check --kit=<file>` måler partnermerkene i et Lolly Design-dokument ([Sjekk gjenskapingen](/info/cli-decks.html#check-the-recreation)).
- Lolly lager ikke en logosammenstilling av to merker for en «med»-, «i samarbeid med»- eller «av»-oppstilling. Legg til en ferdig logosammenstilling som et egendefinert merke.
- Ett designsystem er aktivt for hele enheten, så to merkevarer kan ikke være åpne side om side.
- En designsystemfil eksportert fra appen inneholder ikke merkevareferdigheter, så send dem som egne filer.
- En logo hentet fra en merkevareside er et bilde i raden sin, og raden husker ikke siden. Ingenting viser hvem som publiserte en side, så sjekk adressen selv.
- Den driftede nettappen kan ikke hente en annen merkevares side, fordi dens Content Security Policy bare tillater navngitte verter. Hent logoen i en terminal, eller lagre filen og legg den til i **Assets**.

<!--i:eti-map-pin-->
## Veien videre

- **[Merkevarearkitekturer](/info/brand-architectures.html)**: felles profilering, white label og de andre ordningene, med hva du gjør i Lolly for hver av dem.
- **[Driv et partnerprogram](/info/manage/run-a-partner-programme.html)**: hva partnere får på din Lolly Work, og hvordan du setter opp og driver et program.
- **[Del et design med regler](/info/create-a-tool.html)**: gjenbrukbare verktøy med fast layout og inndataene du velger.
- **[Merkevareferdigheter](/info/brand-skills.html)**: hvordan ferdigheter skrives, leses og gis til en agent.
- **[Lolly Design System Setup](/info/brand-studio.html)**: logoer, egendefinerte merker og flytting av et designsystem mellom enheter.
- **[Merkevaresider](/info/brand-page.html)**: publiser merkevaren din på én adresse, og hent en partners logo fra deres.
- **[Kreative rettigheter og kreditering](/info/creative-rights.html)**: hva Lolly registrerer om verkene det tegner.
