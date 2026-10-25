# Innstillinger

Settings er stedet der du endrer hvordan Lolly fungerer for deg: detaljene dine, designsystemet du bruker, tilgjengelighet, hva som er lagret på denne enheten og hva som er klart uten nett. Åpne det med **Settings** i linjen nederst på startskjermen, eller fra avatarmenyen din. Det åpner på **Preferences**, med fire faner til ved siden av.

| Fane | Adresse | Hva den holder |
|---|---|---|
| **Preferences** | `#/settings` | Detaljene dine, designsystemer, utseende, emoji, tilgjengelighet, tilkoblinger, lagring og nedlastinger for bruk uten nett |
| **This device** | `#/settings?tab=device` | En levende avlesning av denne nettleseren og maskinen, pluss lyd og en skrivebeskyttet lagringsvisning |
| **Design system** | `#/settings?tab=brand` | Det aktive designsystemet som et omslag og sider, med en stripe av omslag for å bytte system |
| **Capabilities** | `#/settings?tab=caps` | Alt Lolly kan gjøre, som søkbare kort |
| **Activity & stats** | `#/settings?tab=activity` | Katalogen, de lokale tellerne dine og nylig arbeid |

Hver fane har sin egen adresse, og gamle `#/profile`- og `#/d`-lenker åpner fortsatt riktig sted, helt ned til enkeltinnstillinger.

## Preferences

Preferences er én lang side med en **innstillingsliste** ved siden og et felt **Search settings** over listen som filtrerer den mens du skriver. Hver del åpnes direkte fra en lenke på formen `#/settings?focus=<section-id>`, for eksempel `#/settings?focus=storage-section`.

- <!--i:usercheck--> **Your details** - navnet ditt, kontaktopplysningene og portrettbildet ditt, og bryteren **Use my details to create**. [Profiles](/info/profile.html) forklarer hvordan verktøy bruker dem.
- <!--i:seal--> **Content Credentials** - den valgfrie verifiserte identiteten som signerer eksportene dine. Se [Content Credentials](/info/content-credentials-identity.html).
- <!--i:palette--> **Design systems** - bytt, legg til, skjul eller fjern designsystemer. [Design System Setup](/info/brand-studio.html#manage-your-design-systems) dekker hver handling.
- <!--i:moon--> **Appearance** - temaet (Light, Dark eller Brand, som maler appen i paletten din) og **Interface follows the design system**.
- <!--i:sparkle--> **Emoji** - settet emojiene dine tegnes fra når du starter noe nytt, med kunstverkets lisens, og hvor sterkt paletten din omfarger dem (**Off**, **Subtle**, **Strong**, **Full**, **Mono** eller **Duotone**). **Keep skin tones and flags** lar disse beholde sine egne farger. Arbeid du allerede har laget, beholder settet det ble laget med.
- <!--i:eyeoff--> **Accessibility** - fire komfortbrytere, pluss Sound og Neurospicy Mode. Se [Accessibility](#accessibility).
- <!--i:link--> **Connected services** - lagring du kobler til, som Dropbox, Google Drive, OneDrive, Nextcloud eller S3, og **Sync across devices**. Se [Sync your devices](/info/sync.html).
- <!--i:globe--> **Trusted sites** - nettstedene en Design-nettsideboks eller en Sandbox-demo kan kontakte uten å spørre, og, der serveren tilbyr det, **Allow pages from any site**. [Privacy Policy](/info/privacy.html) lister hva hver forespørsel sender.
- <!--i:download--> **Your renders** - **Save my renders to my library** beholder en kopi av hvert bilde, hvert lydklipp og hver video du laster ned i Assets, under merket Renders.
- <!--i:database--> **Storage** - hva Lolly beholder på denne enheten, og knappene som tømmer eller flytter dataene dine. Se [Storage](#storage).
- <!--i:cpu--> **Available offline** - last ned det du trenger før du mister forbindelsen. Se [Available offline](#available-offline).
- <!--i:folder--> **Hot folder** - i skrivebordsappen, overvåk én mappe og trekk alt som slippes i den inn i Lolly, gjennom den samme velgeren som et dra-og-slipp får.
- <!--i:clock--> **Your activity** - hva du har laget på denne enheten, talt lokalt.
- <!--i:sliders--> **Feature flags** - slå deler av appen på eller av, som **Print preflight** eller **Strip metadata from uploads**.
- <!--i:server--> **Lolly instance** - hvor denne installasjonen henter verktøyene og katalogen sin. Se [Lolly instance](#lolly-instance).

Temakortene er levende forhåndsvisninger og gjelder i det øyeblikket du velger ett, bare på denne enheten.

![Tre temakort, hvert forhåndsviser sin egen type og farge, med det aktive markert](/t/url-shot?url=%2F%23%2Fsettings%3Ffocus%3Dappearance-section&width=1440&height=1400&dpi=192&waitMs=1600&walker=1&format=svg&cropSelector=.profile-card--appearance&dark=1&filename=pd-theme-picker)

### Tilgjengelighet

**Settings → Preferences → Accessibility** har fire komfortinnstillinger for appen rundt arbeidet ditt. Hver er av til du slår den på, og ingen av dem når inn i et verktøylerret eller en eksport, så en roligere app flytter aldri en piksel av filen du leverer.

- <!--i:pause--> **Reduce motion** slår av appens overganger, glidninger og utsmykninger. Lerretet ditt og enhver animert eksport fortsetter å bevege seg som designet.
- <!--i:photos--> **Hide colourful previews** bytter galleriets forhåndsvisningsgrafikk mot rolige kort med ikon og tekst, og demper prosjektminiatyrene slik at de forblir gjenkjennelige uten å rope.
- <!--i:sliders--> **High contrast** styrker appens kanter, tekst og fokusringer. Merkevarefargene dine og lerretet forblir som du satte dem.
- <!--i:font--> **Large text** forstørrer appens etiketter, menyer og knappetekst. Skrift inne i designene dine er urørt, så ingenting du eksporterer, brytes om.

Disse innstillingene ligger på profilen din, så de følger med i en profileksport og kommer til neste installasjon sammen med navnet og øktene dine. En liten kopi bare for enheten bruker dem før første tegning.

Det samme kortet har **Sound**, et mildt lag med hjelpelyder for det du gjør (å komme til galleriet, et Content Credentials-resultat, å lukke et panel), og **Neurospicy Mode**, et rolig fokusspor. Å slå på Neurospicy åpner en liten spiller i hjørnet som følger deg gjennom appen. Der velger du et spor, hopper, setter volumet og minimerer eller lukker spilleren. Sporene omfatter prosedyrelle *Lolly Sings*-melodier, ambiente løkker og beats, din egen lyd og internettradiostasjoner, som trenger forbindelse. Begge er av som standard og huskes, og å slå Sound av demper også fokussporet. Profilmenyen og **This device** har den samme bryteren.

Grensesnittet kan navigeres med tastatur, egendefinerte kontroller har etiketter for skjermlesere, og hvert verktøys levende forhåndsvisning eksponeres som ett merket bilde som beskriver hva det viser.

### Lagring

Lagringsmåleren gjør rede for hver byte denne installasjonen holder, kategori for kategori, mot det nettleseren melder.

![Lagringsmåleren, med oppdeling i lagrede økter, bilder og buffer mot det nettleseren faktisk melder](/t/url-shot?url=%2F%23%2Fsettings%3Ffocus%3Dstorage-section&width=1440&height=1800&dpi=192&waitMs=2400&css=%5Bdata-store-group%3Dmove%5D%2C.storage-actions%2C.store-selbar%7Bdisplay%3Anone%7D&waitSelector=%5Bdata-store-group%3Dmove%5D&drive=click%3A%5Bdata-store-group%3Dwork%5D%3Esummary%3Bclick%3A%5Bdata-store-group%3Dcaches%5D%3Esummary&walker=1&format=svg&cropSelector=.store-meter&dark=1&filename=pd-storage-meter)

Under måleren:

- **Move to another device** har **Export my data**, **Import data…** og **Export my data & render everything**. [Move your work to another device](/info/find-your-work.html#move-your-work-to-another-device) går gjennom dem.
- **Clear cache** fjerner nedlastede katalogfiler, som lastes ned igjen ved behov.
- **Remove automatic checkpoints older than 30 days** frigjør plass i History og beholder lagrede og navngitte versjoner.
- **Clear all my data** fjerner alt Lolly beholder i denne nettleseren, etter at du skriver et ord for å bekrefte. [If you clear your browser data](/info/find-your-work.html#if-you-clear-your-browser-data) lister hva som forsvinner.

### Tilgjengelig uten nett

Lolly bufrer skjermer etter hvert som du besøker dem, noe som bare dekker steder du allerede har vært. **Available offline** er for turen du ser komme: last ned delene du trenger og se på én fremdriftslinje, så fortsetter alt du tok med, å fungere uten forbindelse.

- <!--i:monitor--> **App, catalogue and guides** - **The app** (hver visning, redigeringsprogram og skrift, også skjermer du aldri har åpnet), **Catalogue** (hele, eller **Choose by tag**) og **Guides & docs** (denne dokumentasjonen på ditt språk, skjermbilder inkludert).
- <!--i:cpu--> **AI models** - hver modell på enheten på sin egen rad med størrelsen: Speech voices, Upscaling models, Background removal, Text recognition, Verify deep scan, Durable credential, Rewriter model, Ask matching model, AI text detector og Singing voices. En modell over 50 MB er merket **large download**.
- <!--i:wrench--> **Tools** - hvert verktøy lastes ned for seg, eller **Download all** tar hvert verktøy. En hake betyr klar uten nett.

**Download everything** øverst tar appen, katalogomfanget du valgte, veiledningene og alle verktøyene. Kryss av for **Include all the AI models** for å legge til modellene, eller last ned en modell fra sin egen rad; sangstemmene lastes bare ned fra sin egen rad. En organisasjons policy kan slå av AI-nedlastinger, og radene sier da fra.

Nedlastinger fortsetter der de stoppet hvis du avbryter eller mister forbindelsen, og oppdaterer seg selv når du er online igjen, og henter bare det en utgivelse endret. Hvis nettleseren ikke har gitt vedvarende lagring, ber **Protect downloads** om det: forskjellen mellom "nedlastet" og "nedlastet til nettleseren vil ha plassen tilbake".

### Lolly instance

**Lolly instance** sier hvor denne installasjonen henter verktøyene og katalogen sin: adressen til en instans, eller *Bundled with this app* når alt leveres inni bygget.

- **Design-system source** viser hvor det leverte designsystemet kommer fra.
- **Instance console** åpner en installasjons administrasjonssider, der den tilbyr dem.
- **Change** peker skrivebordsappen mot en annen instans. En nettleser kan ikke laste verktøy og ressurser på tvers av opprinnelser, så på nettet tilbyr delen **Open a workspace** i stedet.
- **Leave** fjerner instansens designsystem, verktøy og katalog, og ditt eget arbeid blir. Se [Use Lolly at your organisation](/info/organisation.html#leaving).
- Når du er logget på en organisasjon, avslutter **Sign out** denne økten og **Sign out everywhere** avslutter øktene dine på alle enheter, også denne.

## Denne enheten

- <!--i:monitor--> **This Machine** - skjerm, inndata, grafikk, minne, kodeker, lagringsbakende og mer, lest live fra denne økten. Ingenting lagres og ingenting sendes. Den åpner seg selv på en bred skjerm, der fanen legges ut i to kolonner.
- <!--i:neurobeat--> **Sound** - grensesnittlydene og Neurospicy-fokusløkkene, den ene bryteren på denne fanen som skriver noe.
- <!--i:database--> **Storage** - en skrivebeskyttet visning av måleren i [Preferences](#storage), som er der du tømmer eller flytter dataene dine.

## Designsystem

Det aktive designsystemet, lagt ut for lesing. Når denne nettleseren holder to eller flere designsystemer, lister en stripe av små omslag øverst dem: velg ett for å gjøre det aktivt, og **Undo** i varselet som følger setter det forrige tilbake.

![Fanen Design system på Lolly Demo: en stripe av omslag for å bytte system, deretter omslaget med logoen, navnet, notatet og tallene som åpner hver side](/t/url-shot?url=%2F%23%2Fsettings%3Ftab%3Dbrand&width=1440&height=900&dpi=192&waitMs=2400&format=svg&walker=1&dark=1&filename=settings-design-system)

Fanen åpner på et omslag malt i systemets egne farger, med logoen, navnet i visningsskriften og notatet forfatteren skrev. En linje med tall på omslaget lenker til hver side:

- <!--i:palette--> **Colour** - flaten, teksten, primær- og sekundærfargen i de lyse og mørke utseendene, hver navngitte farge som en brikke med navn og hex, et bånd for hver nyanseramp og diagramspekteret, og rollefargene i en fold. Velg en verdi for å kopiere hex-verdien.
- <!--i:font--> **Type** - Headings, Text, Emphasis og Code, hver satt i sin egen skrift.
- <!--i:photos--> **Logos** - hver logofil på bakgrunnen den ble laget for.
- <!--i:layers--> **Colourways** - lys- og mørkparet i hver fargevariant, når systemet har mer enn én.
- <!--i:sliders--> **Tokens** - radius, avstand, effekter og gradienter.
- <!--i:document--> **Print & CMYK** - fargene låst til en eksakt blekkfarge, og trykkbetingelsene en CMYK-PDF kan deklarere.

Å bytte er den eneste endringen denne fanen gjør. Du redigerer et designsystem i [Design System Setup](/info/brand-studio.html) på `#/start`, som omslaget lenker til. Et skrivebeskyttet system sier det på omslaget; lokale systemer du lager, forblir redigerbare. `/b` og `/brand` er snarlenker rett til denne fanen.

## Kapabiliteter

Hver del av plattformen er skrevet opp som et kort, i tolv grupper: Experiences, Platforms & runtimes, Accessibility & languages, Export formats, Import formats, Print production, Automation & AI, Determinism & reproducibility, Brand & design system, Privacy & data ownership, Security & access control og Architecture (for builders). Hver gruppe folder seg og viser antall kort. Et kort åpnes i en dialog med den kapabilitetens funksjoner og, for omtrent halvparten av dem, skjermbildet denne dokumentasjonen bruker.

Søkefeltet over gruppene filtrerer kortene mens du skriver og åpner de gruppene som fortsatt har et treff. Det sier hvor mange kapabiliteter det søker i, og et søk uten treff sier det med ord.

Denne fanen er skrevet dokumentasjon av hva Lolly kan gjøre, holdt i takt med disse veiledningene. Den undersøker ikke maskinen du er på; **This device** gjør det.

## Aktivitet og statistikk

Først bygget: hvor mange verktøy som er lastet, hvor mange eksportformater som finnes, hvor mange flater plattformen kjører på og hvor mange merkevareressurser katalogen bærer, med et **Catalogue**-panel som bryter ned hva som leveres i dette bygget.

Deretter din egen side: **Your activity** teller hva du har laget på denne enheten, og **Recent creations** og **Latest exports** er stabler du kan sveipe gjennom, hver synlig når det er noe å vise. Begge åpner et element slik det var. Disse tellerne blir på enheten; en valgfri Lolly Work-instans holder sine egne [organisasjonstelemetri- og revisjonsposter](/info/privacy.html#organisation-services-with-lolly-work).

## Dyplenker

Hver fane og del av Settings har sin egen lenke, som du kan bokmerke eller lime inn. [Search](/info/search.html) peker **Settings**-resultatene sine mot det samme registeret Settings gjengis fra, så en del kan ikke få nytt navn under et søkeresultat.

::: details Alle former for lenke

- **En fane:** `#/settings?tab=brand`, `#/settings?tab=caps`, `#/settings?tab=device`, `#/settings?tab=activity`.
- **En Preferences-del:** `#/settings?focus=<section-id>`, for eksempel `#/settings?focus=offline-section`.
- **En del, nøyaktig:** dens id som et bart flagg, for eksempel `#/settings?dash-storage`, `#/settings?dash-logos`, `#/settings?dash-colourways` eller `#/settings?cap-formats`. De eldre lenkene `#/settings?dash-lock` og `#/settings?dash-palette-wheel` åpner omslaget og Colour-siden.
- **En del etter nøkkelord:** `#/settings?print`, `#/settings?formats`, `#/settings?palette` (Colour-siden) eller `#/settings?tokens`. Nøkkelord kan deles: `print` tilhører både trykkreferansen på merkevarefanen og gruppen Print production, og den første i siderekkefølge vinner. Bruk id-en når det betyr noe hvilken.

En dyplenke bytter til fanen som eier målet, åpner enhver gruppe det ligger foldet inni, og ruller deretter dit, og roer seg et øyeblikk mens delene over ferdigstiller layouten. De utgåtte adressene `#/platform` og `#/capabilities` foldes inn i Settings med dyplenkeflaggene intakte.
:::

---

**Related:** [Profiles](/info/profile.html) for detaljene dine og kontekstene du lager i. [Design System Setup](/info/brand-studio.html) for å redigere det Design system-fanen viser. [Find and recover your work](/info/find-your-work.html) for lagring, sikkerhetskopier og å flytte mellom enheter.
