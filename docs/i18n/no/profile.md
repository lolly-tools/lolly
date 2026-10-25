# Profiler

Sett navnet ditt, kontaktopplysningene dine og portrettbildet ditt én gang, så fyller hvert verktøy som er bygget for å bruke dem, dem inn for deg: en e-postsignatur, et navneskilt, et foredragskort. Den lille posten er **profilen** din, og den ligger på enheten din.

Profilen din holder også det du bygger opp mens du arbeider: lagrede økter, opplastede bilder og din lokale aktivitetstelling. Du styrer den under **Settings → Preferences**; verktøy leser bare feltene de er bygget for å forhåndsutfylle. Frittstående bruk trenger ingen konto, og valgfri Sync, deling og organisasjonstjenester har hver sin dataflyt, beskrevet nedenfor.

## Hva som er i en profil

| Del | Hva det er |
|---|---|
| **Name** | Fornavn og etternavn. |
| **Contact** | E-post og telefon. |
| **Location** | By og land. |
| **Headshot** | Et valgfritt bilde, beskåret til en firkant og beholdt som et lokalt bilde, for verktøy som e-postsignaturer, sitatkort og organisasjonskart. |
| **Use my details to create** | Én valgfri bryter (den leses som **Using my details** når den er på). Den avgjør om detaljene dine følger med som forfatterkreditt i eksporterte filer og på Batch-kjøringer. Den påvirker ikke forhåndsutfylling; se [How tools use your profile](#how-tools-use-your-profile). |
| **Preferences** | Temaet ditt, tilgjengelighetsinnstillingene dine og hvilke deler av appen du slo på i **Feature flags**. |
| **Your work** | Lagrede økter med miniatyrbildene sine, organisert i [Projects](/info/find-your-work.html), de opplastede bildene dine og den lokale aktivitetsstatistikken din. |

Ingenting av det er påkrevd. En blank profil fungerer; fyll bare ut det som sparer deg for å skrive.

![Settings på fanen Preferences: innstillingslisten, og Your details med bryteren Use my details to create og feltene for navn, kontakt og sted](/t/url-shot?url=%2F%23%2Fsettings%3Ffocus%3Ddetails-section&width=1440&height=900&dpi=192&waitMs=1600&format=svg&walker=1&localize=1&dark=1&filename=profile-details)

[Settings](/info/dashboard.html) kartlegger alt annet under Preferences, fra utseende og emoji til lagring og nedlastinger for bruk uten nett.

## Du, et team eller en rolle

Ordet "profil" antyder én fast person. I Lolly er det nærmere en skapende kontekst: hvem du er mens du lager dette. Den kan ha tre former, og Lolly håndterer hver på samme måte.

::: cols
## Som deg selv

Standarden. Navnet ditt, e-posten din, portrettbildet ditt. Sett det én gang, så fyller signaturen, navneskiltet og konferansemerket seg selv.

## Som et team

Et teams delte navn, en gruppeinnboks som `events@…`, en avdeling og teamets merke. Én person setter det opp og eksporterer det, og alle andre laster den samme profilen, så teamets filer bærer konsistente detaljer. En delt kiosk eller en demobærbar kan kjøre én teamprofil.

## Som en rolle

En arrangementsansvarlig som er det tre dager i året, vil ha arrangementsinnboksen og arrangementets underbrand på navneskilt og skilting, og så den vanlige identiteten sin tilbake. Behold den rollen som en lagret profilfil, last den for arrangementet og legg den bort etterpå.
:::

![Portrettbilde-kontrollen, tom inntil du laster opp et bilde som deretter blir værende på denne enheten](/t/url-shot?url=%2F%23%2Fsettings%3Ffocus%3Ddetails-section&width=1440&height=900&dpi=192&waitMs=1600&format=svg&cropSelector=.profile-side&walker=1&dark=1&filename=pd-profile-headshot&css=.profile-details-main%7Bdisplay%3Anone%7D)

::: details Profiler hos en organisasjon som bruker Lolly Work
Når du logger på [organisasjonens Lolly](/info/organisation.html), kan Lolly Work levere verifiserte profilfelt fra identitetsleverandøren sin og låse felt eller innstillinger under organisasjonspolicy. Et administrert felt er merket i appen.

Den påloggingen styrer også tilgang til delte prosjekter og ressurser. En teamprofilfil er fortsatt en lokal fil: den gir ikke organisasjonsmedlemskap og erstatter ikke en jobbkonto. **Use my details to create** styrer kreditten i eksportene dine, ikke organisasjonens pålogging eller revisjonsposter. Se [Privacy](/info/privacy.html#organisation-services-with-lolly-work).
:::

## Behold flere, bruk én

En installasjon har én aktiv profil om gangen, og det finnes ingen bryter i appen. I stedet er hver profil en portabel fil, den samme sikkerhetskopifilen du ville brukt for å flytte til en ny enhet. For å gå inn i en annen kontekst:

::: timeline
- <!--i:download--> **Export my data** under **Settings → Storage → Move to another device** lagrer gjeldende profil som én `.zip`.
- <!--i:trash--> **Clear all my data** tømmer denne installasjonen.
- <!--i:upload--> **Import data…** laster profilfilen for konteksten du går inn i.
:::

Å importere uten å tømme først **slår sammen** i stedet. Importerte økter og bilder legges til; der begge kopiene finnes, beholdes den som ble lagret sist. Mapper, favoritter og maler legges til ved siden av dine, og dine egne detaljer blir, bortsett fra tomme felt, som tar filens verdier. Det passer for å hente ett teams økter inn i ditt eget oppsett, men ikke for et rent brudd mellom roller.

For to kontekster samtidig, bruk en egen nettleserprofil, en egen brukerkonto eller en andre installert kopi av nettappen: hver bærer sin egen uavhengige Lolly-profil.

![De to knappene som flytter en hel installasjon: Export my data skriver én zip, Import data leser den inn igjen](/t/url-shot?url=%2F%23%2Fsettings%3Ffocus%3Dstorage-section&width=1440&height=1800&dpi=192&waitMs=2400&css=.store-move%3Ediv%3Anth-of-type%282%29%2C.store-move%3Ep%3Alast-of-type%7Bdisplay%3Anone%7D&waitSelector=%5Bdata-store-group%3Dmove%5D&drive=click%3A%5Bdata-store-group%3Dmove%5D%3Esummary&walker=1&format=svg&cropSelector=%5Bdata-store-group%3Dmove%5D&dark=1&filename=pd-transfer-controls)

> Behold én fil per kontekst og gi hver navn etter hva den er, som `LollyTools-events-2026.zip` og `LollyTools-me.zip`. Filen er profilen.

[Move your work to another device](/info/find-your-work.html#move-your-work-to-another-device) dekker hva filen holder, hva som blir igjen og de andre måtene å flytte på, inkludert Sync.

## Hvordan verktøy bruker profilen din

**Forhåndsutfylling.** En verktøyforfatter markerer en inndata som å hente fra profilen din (`bindToProfile: "firstname"`, `"email"`, `"headshot"` og så videre). Når verktøyet åpnes, fylles den inndataen fra profilen din, og du kan overstyre den for én økt uten å endre profilen, med mindre en organisasjonspolicy låser inndataen. Forhåndsutfylling er en lokal bekvemmelighet og skjer uansett om **Use my details** er på.

**Kreditt.** Når du eksporterer, kan detaljene dine følge med som forfatterkreditt i filens metadata (PNG, PDF, SVG og mer), slik at en ferdig fil kan si hvem som laget arbeidet. **Use my details to create** styrer dette, og forfatteren på Batch-kjøringer. Når den er av, sier eksporten fortsatt at den er laget med Lolly, og bærer ingen personlig forfatter- eller kontaktlinje.

Verktøyforfattere: se [`bindToProfile`](/info/tool-inputs.html#bindtoprofile) og [`host.profile`](/info/host-api.html#host-profile).

![Den ene bryteren Use my details to create, merket som valgfri og av til du slår den på](/t/url-shot?url=%2F%23%2Fsettings%3Ffocus%3Duse-details&width=1440&height=900&dpi=192&waitMs=1600&format=svg&cropSelector=.profile-check&walker=1&dark=1&filename=pd-use-my-details)

## Profil, designsystem og kapabiliteter

Tre ting ligger nær hverandre i Settings og er lette å blande sammen:

- <!--i:people--> **Profile** - du, teamet ditt eller rollen du er i: navn, kontakt, portrettbilde og lagret arbeid. Personlig, beholdt på enheten og portabel som en fil.
- <!--i:palette--> **Design system** - merkevaren: farger, skrifter og innstillinger hvert verktøy gjengir med. Delt og konsistent i stedet for personlig; se [Design System Setup](/info/brand-studio.html).
- <!--i:sliders--> **Capabilities** - hva appen kan gjøre: funksjonene og verktøyene som er tilgjengelige for deg.

En profil endrer hvem en fil er fra; designsystemet endrer hvordan filen ser ut; kapabiliteter er det du kan lage.

Ordet har tre andre betydninger i Lolly. En **content profile** er en byggeinnstilling som velger hvilke verktøy og hvilken katalog en installasjon leveres med; [Glossary](/info/glossary.html) definerer begrepet. Lenkeparameteren `profile` velger en fargeprofil for en eksport, for eksempel en CMYK-trykkbetingelse; se [Reserved URL parameters](/info/url-parameters.html#print). En **verified identity** er det valgfrie signeringssertifikatet som knytter e-posten din til de signerte eksportene dine, adskilt fra disse detaljene, selv om **Use my details to create** styrer om noen av dem bygges inn; se [Content Credentials](/info/content-credentials-identity.html).

![Kortet for Verifisert identitet, telefonbredde: velgeren for sertifikatets levetid og registreringssteget under - identitetsprofilen, atskilt fra de personlige detaljene dine](/t/url-shot?url=%2F%23%2Fsettings%3Ffocus%3Didentity-section&width=430&height=1600&dpi=192&waitMs=2400&css=.welcome-dialog%2C.personalize-nudge%7Bdisplay%3Anone%7D&format=svg&walker=1&cropSelector=%23identity-section&dark=1&filename=pv-identity-enrol)

## Personvern

Din personlige profil lagres lokalt. Detaljene dine kan følge med i en sikkerhetskopi eller Sync-kopi, i innhold du deler eller eksporterer og under valgfri registrering for Content Credentials. På en Lolly Work-instans er pålogging, delt arbeid, telemetripolicy og revisjonsposter adskilt fra denne lokale profilen. **Settings → Preferences → Clear all my data** tømmer denne enheten; den sletter ikke kopier hos lagringsleverandøren eller organisasjonen din. Se [Privacy Policy](/info/privacy.html).
