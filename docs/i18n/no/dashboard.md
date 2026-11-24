# Innstillinger

Settings inneholder opplysningene dine, designsystemet ditt, tilgjengelighet, lagring på denne enheten og nedlastinger for bruk uten nett. Åpne **Settings** fra linjen nederst på startskjermen eller fra avatarmenyen din, så åpnes **Preferences**.

| Fane | Adresse | Innhold |
|---|---|---|
| **Preferences** | `#/settings` | Opplysningene dine, designsystemer, utseende, emoji, tilgjengelighet, tilkoblinger, lagring og nedlastinger for bruk uten nett |
| **This device** | `#/settings?tab=device` | En løpende avlesning av denne nettleseren og maskinen, pluss lyd og en skrivebeskyttet lagringsvisning |
| **Design system** | `#/settings?tab=brand` | Det aktive designsystemet som et omslag og sider, med en stripe med omslag for å bytte system |
| **Capabilities** | `#/settings?tab=caps` | Alt Lolly kan gjøre, som søkbare kort |
| **Activity & stats** | `#/settings?tab=activity` | Katalogen, de lokale tellerne dine og nylig arbeid |

Gamle lenker til `#/profile` og `#/d` åpner fortsatt riktig sted, helt ned til enkeltinnstillinger.

<!--i:eti-sliders-->
## Preferanser

Preferences er én lang side med en **innstillingsliste** langs siden. Feltet **Search settings** over listen filtrerer den mens du skriver. Hver del har en lenke på formen `#/settings?focus=<section-id>`, som `#/settings?focus=storage-section`.

- <!--i:usercheck--> **Your details** - navnet, kontaktopplysningene og portrettbildet ditt og bryteren **Use my details to create**. [Profiler](/info/profile.html) forklarer hvordan verktøy bruker dem.
- <!--i:seal--> **Content Credentials** - den valgfrie verifiserte identiteten som signerer eksportene dine. Se [Content Credentials](/info/content-credentials-identity.html).
- <!--i:palette--> **Design systems** - bytt, legg til, skjul eller fjern designsystemer. [Lolly Design System Setup](/info/brand-studio.html#manage-your-design-systems) dekker hver handling.
- <!--i:moon--> **Appearance** - temaet (Light, Dark eller Brand, som farger appen med paletten din), **Your colourway** når designsystemet tilbyr mer enn én ([Gjør en fargevariant til din egen](/info/colourways.html#make-a-colourway-your-own)) og **Interface follows the design system**.
- <!--i:sparkle--> **Emoji** - emojisettet for nytt arbeid, med lisensen for grafikken, og hvor mye paletten din endrer emojifargene (**Off**, **Subtle**, **Strong**, **Full**, **Mono** eller **Duotone**). **Keep skin tones and flags** lar disse beholde sine egne farger. Arbeid du allerede har laget, beholder settet sitt.
- <!--i:eyeoff--> **Accessibility** - fire komfortbrytere, pluss Sound og Neurospicy Mode. Se [Tilgjengelighet](#accessibility).
- <!--i:link--> **Connected services** - lagring du kobler til, som Dropbox, Google Drive, OneDrive, Nextcloud eller S3, og **Sync across devices**. Se [Synkroniser enhetene dine](/info/sync.html).
- <!--i:globe--> **Trusted sites** - nettstedene en nettsideboks i Lolly Design eller en Lolly Sandbox-demo kan kontakte uten å spørre, og, der serveren tilbyr det, **Allow pages from any site**. [Personvernerklæringen](/info/privacy.html) lister hva hver forespørsel sender.
- <!--i:download--> **Your renders** - **Save my renders to my library** beholder en kopi av hvert bilde, lydklipp og hver video du laster ned, i Assets under merket Renders.
- <!--i:database--> **Storage** - det Lolly lagrer på denne enheten, og knappene som tømmer eller flytter dataene dine. Se [Lagring](#storage).
- <!--i:cpu--> **Available offline** - last ned det du trenger før du mister forbindelsen. Se [Tilgjengelig uten nett](#available-offline).
- <!--i:folder--> **Hot folder** - i skrivebordsappen overvåker Lolly én mappe og henter inn alt som legges der, gjennom den samme velgeren som ved dra og slipp.
- <!--i:clock--> **Your activity** - det du har laget på denne enheten, telt lokalt.
- <!--i:sliders--> **Feature flags** - slå deler av appen på eller av, som **Print preflight** eller **Strip metadata from uploads**. **Performance UI** gir appen et enklere utseende som krever mindre å tegne. Lolly kan slå på Performance UI selv på en treg enhet. Linjen under bryteren sier da når og hvorfor, med **Allow again** ([hvordan den avgjør det](/info/configuration.html#curating-what-people-see)).
- <!--i:server--> **Lolly instance** - hvor denne installasjonen henter verktøyene og katalogen sin. Se [Lolly-instans](#lolly-instance).

Temakortene er levende forhåndsvisninger. Et tema tas i bruk så snart du velger det, bare på denne enheten.

![Tre temakort som forhåndsviser hver sin typografi og farge, med det aktive kortet merket](/t/url-shot?url=%2F%23%2Fsettings%3Ffocus%3Dappearance-section&width=1440&height=1400&dpi=192&waitMs=1600&walker=1&format=svg&cropSelector=.profile-card--appearance&dark=1&filename=pd-theme-picker)

### Tilgjengelighet

**Settings → Preferences → Accessibility** har fire komfortinnstillinger for appen. Hver av dem er av til du slår den på, og ingen av dem påvirker et verktøylerret eller en eksport, så en roligere app flytter aldri en piksel i filen du leverer. Hver av dem er av som standard. Ingen av dem endrer et verktøylerret eller en eksport.

- <!--i:pause--> **Reduce motion** slår av appens overganger, skyvebevegelser og dekorative animasjoner.
- <!--i:photos--> **Hide colourful previews** erstatter galleriets forhåndsvisningsgrafikk med kort med ikoner og tekst og demper prosjektminiatyrene, som fortsatt er gjenkjennelige.
- <!--i:sliders--> **High contrast** gjør appens kanter, tekst og fokusringer tydeligere. Merkevarefargene og lerretet forblir slik du har satt dem.
- <!--i:font--> **Large text** forstørrer appens etiketter, menyer og knappetekst.

**Dominant hand** (Right eller Left) angir hvilken side kontrollene ligger på når Lolly viser to ruter, på en sammenleggbar enhet eller et nesten kvadratisk nettbrett. **Swap sides** i overskriften til en rute endrer også dette.

Disse innstillingene ligger i profilen din, så de følger med i en profileksport sammen med navnet og øktene dine. En kopi som bare ligger på enheten, tar dem i bruk før første tegning av grensesnittet.

Det samme kortet har **Sound**, dempede støttelyder for handlinger som å åpne galleriet, få et Content Credentials-resultat eller lukke et panel. Det har også **Neurospicy Mode**, et rolig lydspor for konsentrasjon. Når du slår på Neurospicy, åpnes en liten spiller i hjørnet som følger deg rundt i appen. I spilleren velger du et spor, hopper videre, stiller volumet og minimerer eller lukker spilleren. Sporene omfatter Lollys genererte stasjoner, ambiente looper og rytmer, din egen lyd og nettradiostasjoner, som trenger en forbindelse. Begge er av som standard, og valgene huskes. Når du slår av Sound, blir også konsentrasjonssporet lydløst. Profilmenyen og **This device** har den samme bryteren.

En glider under Sound-bryteren bestemmer hva lydene består av. Mot den runde **Bouba**-klumpen blir de til myke dråper, bobler og litt bass. Mot den spisse **Kiki**-stjernen blir de til tørre tikk, skrapelyder og metall. Midten beholder Lollys klokkeklang og toner. Hvis lydene i den ene enden er vanskelige å tåle, flytter du mot den andre enden. Glideren virker mens Sound er av, og når du slipper den, spilles en kort lydprøve.

::: details De genererte stasjonene
De genererte stasjonene komponerer musikken mens de spiller, uten samples og uten innspilte stemmer. Hver låt har egne instrumenter, rytme og rekkefølge.

- **Lolly Sings** er en familie av stasjoner. Den opprinnelige Lolly Sings er lys og melodisk: durtonearter, en hovedmelodi i hver låt og innslag av bossa, shuffle og chiptune. Hver sjanger har også sin egen stasjon, fra Sugar og K-pop til Country, Jazz, Metal og D&B.
- **Lofi-stasjonene** (Warm, Late night og Rainy) er endeløse lo-fi-rytmer.

På en generert stasjon går neste og forrige mellom låtene. Hver låt kommer fra en startverdi, så den spilles likt uansett hvor du deler eller lagrer den (se [Generert musikk](/info/generated-music.html)). Under avspillingskontrollene bytter **Mood** mellom Lofi-stasjonene, **Drums** tar ut trommesettet og **Texture** går fra ren lyd til en støvete plate. Deretter følger en rad med ikonknapper. Hold pekeren over eller trykk og hold en knapp for å se navnet:

- Noten, **Open in the music generator**, åpner låten på `#/music`, der du kan endre instrumentene del for del.
- Lenken, **Share this tune or moment**, tilbyr en lenke som spiller den samme låten, eller en som også starter der du er og viser visualiseringen med gjeldende forhåndsinnstilling og farger.
- Mappen, **Save to library**, beholder låten i ressursene dine.
- Lynet, **Light visualiser**, er en bryter som beskrives nedenfor.

En lagret låt listes i gruppen til stasjonen sin, etter toneart og tempo. Når du velger den lagrede låten, spilles den samme låten igjen, med gjentakelse som ethvert spor eller med videre avspilling i fremovermodus. Bare stasjonen og låtens nummer lagres, noen få byte, og musikken komponeres på nytt mens den spilles. Du kan gi en lagret låt nytt navn eller slette den i ressursene dine og bruke den som bakgrunnsmusikk i en video. Lolly Demo og Lolly Start leveres med seks lagrede låter hver.

Visualiseringen hører hvert spor på et jevnt nivå, så et stille spor beveger bildet like mye som et høyt spor, uansett volum. Hver Lolly Sings-sjanger og lagrede låter fra den tilbyr **Light visualiser**: enkle nivåstolper som lar musikken få behandlingstiden den trenger. Light visualiser starter på for berøringsskjermer og for enheter med fire kjerner eller færre eller 4 GB minne eller mindre.
:::

Du kan bruke grensesnittet med tastaturet. Tilpassede kontroller har etiketter for skjermlesere. Hvert verktøys levende forhåndsvisning er ett bilde med en etikett som beskriver hva det viser.

### Lagring

Lagringsmåleren viser hver byte denne installasjonen lagrer, fordelt på kategorier, sammenlignet med det nettleseren rapporterer.

![Lagringsmåleren, med lagrede økter, bilder og mellomlager fordelt mot det nettleseren faktisk rapporterer](/t/url-shot?url=%2F%23%2Fsettings%3Ffocus%3Dstorage-section&width=1440&height=1800&dpi=192&waitMs=2400&css=%5Bdata-store-group%3Dmove%5D%2C.storage-actions%2C.store-selbar%7Bdisplay%3Anone%7D&waitSelector=%5Bdata-store-group%3Dmove%5D&drive=click%3A%5Bdata-store-group%3Dwork%5D%3Esummary%3Bclick%3A%5Bdata-store-group%3Dcaches%5D%3Esummary&walker=1&format=svg&cropSelector=.store-meter&dark=1&filename=pd-storage-meter)

Under måleren:

- **Move to another device** har **Export my data**, **Import data…** og **Export my data & render everything**. [Flytt arbeidet ditt til en annen enhet](/info/find-your-work.html#move-your-work-to-another-device) går gjennom dem.
- **Clear cache** fjerner nedlastede katalogfiler, som lastes ned igjen ved behov.
- **Remove automatic checkpoints older than 30 days** frigjør plass i History og beholder lagrede og navngitte versjoner.
- **Clear all my data** fjerner alt Lolly lagrer i denne nettleseren, etter at du har skrevet et ord for å bekrefte. [Hvis du sletter nettleserdataene dine](/info/find-your-work.html#if-you-clear-your-browser-data) lister hva som fjernes.

### Tilgjengelig uten nett

Lolly mellomlagrer bare skjermene du har besøkt. **Available offline** laster ned delene du trenger, med én fremdriftslinje, og de fortsetter å fungere uten forbindelse.

- <!--i:monitor--> **App, catalogue and guides** - **The app** (alle visninger, redigeringsverktøy og skrifter, også skjermer du aldri har åpnet), **Catalogue** (hele, eller **Choose by tag**) og **Guides & docs** (denne dokumentasjonen på ditt språk, med skjermbilder).
- <!--i:cpu--> **AI models** - hver modell som kjører på enheten, på sin egen rad med størrelsen: talestemmer, oppskaleringsmodeller, bakgrunnsfjerning, tekstgjenkjenning, Lolly Verify-dybdeskanning, varig legitimasjon, omskrivingsmodell, Ask-samsvarsmodell, KI-tekstdetektor og sangstemmer. En modell over 50 MB er merket **large download**.
- <!--i:wrench--> **Tools** - hvert verktøy lastes ned for seg, eller **Download all** henter alle verktøyene. En hake betyr klar til bruk uten nett.

**Download everything** øverst henter appen, den delen av katalogen du valgte, veiledningene og alle verktøyene. Kryss av for **Include all the AI models** for å ta med modellene, eller last ned en modell fra dens egen rad. Sangstemmene lastes bare ned fra sin egen rad. Organisasjonens policy kan slå av KI-nedlastinger, og da viser radene det.

Nedlastinger fortsetter der de stoppet hvis du avbryter eller mister forbindelsen. Når du er på nett igjen, oppdateres de og henter bare det en utgivelse har endret. Hvis nettleseren ikke har tillatt varig lagring, ber **Protect downloads** om den tillatelsen. Uten tillatelsen kan nettleseren slette nedlastinger når den vil frigjøre plassen.

### Lolly-instans

**Lolly instance** sier hvor denne installasjonen henter verktøyene og katalogen sin: adressen til en instans, eller *Bundled with this app* når alt følger med i appversjonen.

- **Design-system source** viser hvor det medfølgende designsystemet kommer fra.
- **Instance console** åpner administrasjonssidene for en installasjon, der den tilbyr dem.
- **Change** kobler skrivebordsappen til en annen instans. En nettleser kan ikke laste inn verktøy og ressurser på tvers av opphav, så på nettet tilbyr delen **Open a workspace** i stedet.
- **Leave** fjerner instansens designsystem, verktøy og katalog. Ditt eget arbeid blir værende. Se [Bruk Lolly i organisasjonen din](/info/organisation.html#leaving).
- Når du er logget inn i en organisasjon, avslutter **Sign out** denne økten, og **Sign out everywhere** avslutter øktene dine på alle enheter, også denne.

<!--i:eti-monitor-->
## Denne enheten

- <!--i:monitor--> **This Machine** - skjerm, inndata, grafikk, minne, kodeker, lagringsmotor og mer, lest direkte fra denne økten. Ingenting lagres eller sendes. På en bred skjerm åpnes dette panelet av seg selv, og fanen bruker to kolonner.
- <!--i:neurobeat--> **Sound** - grensesnittlydene og Neurospicy-fokussløyfene. Sound er den eneste bryteren i denne fanen som skriver noe.
- <!--i:database--> **Storage** - en skrivebeskyttet visning av måleren. Slett eller flytt dataene dine i [Innstillinger](#storage).

<!--i:eti-palette-->
## Designsystem

Det aktive designsystemet, satt opp for lesing. Når denne nettleseren har to eller flere designsystemer, viser en stripe med forsider øverst alle sammen. Velg ett for å gjøre det aktivt. **Undo** i meldingen som følger, setter det forrige tilbake.

![Design system-fanen i Lolly Demo: en stripe med forsider for å bytte system, deretter forsiden med logo, navn, merknad og antall som åpner hver side](/t/url-shot?url=%2F%23%2Fsettings%3Ftab%3Dbrand&width=1440&height=900&dpi=192&waitMs=2400&format=svg&walker=1&dark=1&filename=settings-design-system)

Fanen åpnes på en forside i systemets egne farger, med logoen, navnet i profilskriften og merknaden forfatteren skrev. En linje med antall på forsiden lenker til hver side:

- <!--i:palette--> **Colour** - overflate, tekst, primær og sekundær i det lyse og mørke utseendet, hver navngitte farge som en brikke med navn og heksadesimalverdi, et bånd for hver nyanseskala og diagramspekteret og fargerollene i en sammenfoldbar del. Velg en verdi for å kopiere heksadesimalverdien.
- <!--i:font--> **Type** - Headings, Text, Emphasis og Code, hver satt i sin egen skrift.
- <!--i:photos--> **Logos** - hver logofil på bakgrunnen den er laget for.
- <!--i:layers--> **Colourways** - det lyse og mørke paret for hver fargevariant, når systemet har mer enn én.
- <!--i:sliders--> **Tokens** - radius, avstand, effekter og gradienter.
- <!--i:document--> **Print & CMYK** - fargene som er låst til en bestemt trykkfarge, og trykkbetingelsene en CMYK-PDF kan angi.

Å bytte er den eneste endringen denne fanen gjør. Rediger et designsystem i [Lolly Design System Setup](/info/brand-studio.html) på `#/start`, som forsiden lenker til. Et skrivebeskyttet system sier fra på forsiden. Lokale systemer du lager, forblir redigerbare. `/b` og `/brand` er kortlenker til denne fanen.

<!--i:eti-grid-->
## Funksjoner

Hver del av plattformen har et kort, i tolv grupper: Experiences, Platforms & runtimes, Accessibility & languages, Export formats, Import formats, Print production, Automation & AI, Determinism & reproducibility, Brand & design system, Privacy & data ownership, Security & access control og Architecture (for utviklere). Hver gruppe kan foldes sammen og viser antall kort. Et kort åpner en dialog med egenskapene til den funksjonen og, for omtrent halvparten av kortene, skjermbildet denne dokumentasjonen bruker.

Søkefeltet over gruppene filtrerer kortene mens du skriver og åpner gruppene som inneholder et treff. Feltet viser hvor mange funksjoner det søker i. Et søk uten treff sier fra med tekst.

Denne fanen dokumenterer hva Lolly kan gjøre, i takt med disse veiledningene. Den undersøker ikke maskinen du bruker; det gjør **This device**.

<!--i:eti-gauge-->
## Aktivitet & statistikk

Først appversjonen: antall innlastede verktøy, eksportformater, miljøer plattformen kjører i og merkevareressurser i katalogen. Et **Catalogue**-panel gir en oversikt over hva denne appversjonen inneholder.

Deretter ditt eget arbeid: **Your activity** teller det du har laget på denne enheten. **Recent creations** og **Latest exports** er stabler du kan sveipe gjennom, som vises når de har innhold. Begge åpner et element slik det var. Disse tellerne blir på enheten. En valgfri Lolly Work-instans beholder sin egen [organisasjonstelemetri og revisjonsposter](/info/privacy.html#organisation-services-with-lolly-work).

<!--i:eti-link-->
## Dyplenker

Hver fane og del i Settings har sin egen lenke du kan bokmerke eller lime inn. [Lolly Search](/info/search.html) bygger **Settings**-resultatene fra det samme registeret som Settings, så en del som får nytt navn, gjør aldri et søkeresultat ugyldig.

::: details Alle lenkeformer

- **En fane:** `#/settings?tab=brand`, `#/settings?tab=caps`, `#/settings?tab=device`, `#/settings?tab=activity`.
- **En del i Preferences:** `#/settings?focus=<section-id>`, som `#/settings?focus=offline-section`.
- **En bestemt del:** ID-en som et frittstående flagg, som `#/settings?dash-storage`, `#/settings?dash-logos`, `#/settings?dash-colourways` eller `#/settings?cap-formats`. De eldre lenkene `#/settings?dash-lock` og `#/settings?dash-palette-wheel` åpner forsiden og Colour-siden.
- **En del etter nøkkelord:** `#/settings?print`, `#/settings?formats`, `#/settings?palette` (Colour-siden) eller `#/settings?tokens`. To deler kan dele et nøkkelord: `print` tilhører både merkevarefanens trykkreferanse og gruppen Print production, og den første i siderekkefølgen vinner. Bruk ID-en for å velge én.

En dyplenke bytter til fanen som har målet og åpner enhver gruppe målet er foldet inn i. Deretter ruller den til målet når delene over er ferdig plassert. De utgåtte adressene `#/platform` og `#/capabilities` åpnes i Settings med dyplenkeflaggene intakte.
:::

---

**Relatert:** [Profiler](/info/profile.html) for opplysningene dine og sammenhengene du skaper i. [Lolly Design System Setup](/info/brand-studio.html) for å redigere det Design system-fanen viser. [Finn og gjenopprett arbeidet ditt](/info/find-your-work.html) for lagring, sikkerhetskopier og bytte av enhet.
