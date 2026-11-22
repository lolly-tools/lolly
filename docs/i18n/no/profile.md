# Profiler

Angi navn, kontaktopplysninger og portrettbilde én gang, så fyller alle verktøy som er laget for å bruke dem, dem inn, som en e-postsignatur, et navneskilt eller et foredragsholderkort. Denne oppføringen er **profilen** din, og den ligger på enheten din.

Profilen din inneholder også lagrede økter, opplastede bilder og en lokal opptelling av aktiviteten din. Du administrerer den under **Settings → Preferences**. Verktøy leser bare feltene de er laget for å forhåndsutfylle. Frittstående bruk krever ingen konto. Valgfri Sync, deling og organisasjonstjenester har hver sin dataflyt.

<!--i:eti-user-check-->
## Hva en profil inneholder

| Del | Hva det er |
|---|---|
| **Name** | For- og etternavn. |
| **Contact** | E-post og telefon. |
| **Location** | By og land. |
| **Headshot** | Et valgfritt foto, beskåret til et kvadrat og lagret som et lokalt bilde, for verktøy som e-postsignaturer, sitatkort og organisasjonskart. |
| **Use my details to create** | En bryter du selv slår på, som viser **Using my details** når den er på. Den avgjør om opplysningene dine følger med som forfatterkreditering i eksporterte filer og Lolly Batch-kjøringer; se [Slik bruker verktøy profilen din](#how-tools-use-your-profile). |
| **Preferences** | Temaet ditt, fargevarianten din i hvert designsystem, tilgjengelighetsinnstillingene dine og hvilke deler av appen du slo på i **Feature flags**. |
| **Your work** | Lagrede økter med miniatyrbildene sine, organisert i [Lolly Projects](/info/find-your-work.html), de opplastede bildene dine og den lokale aktivitetsstatistikken din. |

Ingenting av dette er påkrevd, og en tom profil fungerer.

![Settings på fanen Preferences: innstillingslisten og Your details med bryteren Use my details to create og feltene for navn, kontakt og sted](/t/url-shot?url=%2F%23%2Fsettings%3Ffocus%3Ddetails-section&width=1440&height=900&dpi=192&waitMs=1600&format=svg&walker=1&localize=1&dark=1&filename=profile-details)

[Lolly-innstillinger](/info/dashboard.html) dekker resten av Preferences, fra utseende og emoji til lagring og nedlastinger for bruk uten nett.

<!--i:eti-users-->
## Deg, et team eller en rolle

I Lolly er en profil den du er mens du lager noe: deg selv, et team eller en rolle. Lolly håndterer alle tre på samme måte.

::: cols
## Som deg selv

Standarden: navnet, e-postadressen og portrettbildet ditt. Signaturen, navneskiltet og konferanselogooppsettet ditt fylles ut fra dem.

## Som et team

Et teams felles navn, en gruppeinnboks som `events@…`, en avdeling og teamets merke. Én person setter opp profilen og eksporterer en fil. Alle andre laster inn den samme profilen, så teamets filer har de samme opplysningene. En delt kiosk eller en bærbar demomaskin kan bruke én teamprofil.

## Som en rolle

En arrangementsansvarlig trenger arrangementets innboks og undermerkevare på navneskilt og skilting tre dager i året, og deretter sin vanlige identitet tilbake. Behold rollen som en lagret profilfil, last inn filen til arrangementet og legg den til side etterpå.
:::

![Kontrollen for portrettbilde, tom til du laster opp et foto som deretter blir på denne enheten](/t/url-shot?url=%2F%23%2Fsettings%3Ffocus%3Ddetails-section&width=1440&height=900&dpi=192&waitMs=1600&format=svg&cropSelector=.profile-side&walker=1&dark=1&filename=pd-profile-headshot&css=.profile-details-main%7Bdisplay%3Anone%7D)

::: details Profiler i en organisasjon som bruker Lolly Work
Når du logger på [en organisasjons Lolly](/info/organisation.html), kan Lolly Work levere verifiserte profilfelt fra identitetsleverandøren og låse felt eller innstillinger i henhold til organisasjonens policy. Et administrert felt er merket i appen.

Denne påloggingen styrer også tilgangen til delte prosjekter og ressurser. En teamprofilfil er en lokal fil. Den gir ikke medlemskap i organisasjonen og erstatter ikke en jobbkonto. **Use my details to create** styrer krediteringen i eksportene dine, ikke organisasjonens pålogging eller revisjonsposter. Se [Personvern](/info/privacy.html#organisation-services-with-lolly-work).
:::

<!--i:eti-copy-->
## Behold flere, bruk én

En installasjon har én aktiv profil om gangen, uten profilbytte i appen. Hver profil er en flyttbar fil, den samme sikkerhetskopifilen som flytter arbeidet ditt til en ny enhet. Slik bytter du kontekst:

::: timeline
- <!--i:download--> **Export my data** under **Settings → Storage → Move to another device** lagrer den gjeldende profilen som én `.zip`.
- <!--i:trash--> **Clear all my data** tømmer denne installasjonen.
- <!--i:upload--> **Import data…** laster inn profilfilen for konteksten du går inn i.
:::

::: note Import uten å tømme først slår sammen
Importerte økter og bilder legges til. Når begge kopiene finnes, beholdes den som sist ble lagret. Mapper, favoritter og maler legges til ved siden av dine. Dine egne opplysninger beholdes, bortsett fra tomme felt, som får verdiene fra filen. En sammenslåing passer for å hente et teams økter inn i oppsettet ditt, men ikke for et klart skille mellom roller.
:::

Hvis du vil ha to kontekster samtidig, bruker du en egen nettleserprofil, brukerkonto eller installert kopi av nettappen. Hver av dem har sin egen Lolly-profil.

![De to knappene som flytter en hel installasjon: Export my data skriver én zip, Import data leser den inn igjen](/t/url-shot?url=%2F%23%2Fsettings%3Ffocus%3Dstorage-section&width=1440&height=1800&dpi=192&waitMs=2400&css=.store-move%3Ediv%3Anth-of-type%282%29%2C.store-move%3Ep%3Alast-of-type%7Bdisplay%3Anone%7D&waitSelector=%5Bdata-store-group%3Dmove%5D&drive=click%3A%5Bdata-store-group%3Dmove%5D%3Esummary&walker=1&format=svg&cropSelector=%5Bdata-store-group%3Dmove%5D&dark=1&filename=pd-transfer-controls)

::: note Behold én fil per kontekst
Gi hver fil navn etter hva den er, som `LollyTools-events-2026.zip` og `LollyTools-me.zip`. Filen er profilen.
:::

[Flytt arbeidet ditt til en annen enhet](/info/find-your-work.html#move-your-work-to-another-device) dekker hva filen inneholder, hva som blir igjen og de andre måtene å flytte på, inkludert Sync.

<!--i:eti-pen-->
## Slik bruker verktøy profilen din

**Forhåndsutfylling.** En verktøyforfatter merker en inndata som hentet fra profilen din (`bindToProfile: "firstname"`, `"email"`, `"headshot"` og så videre). Når verktøyet åpnes, fylles denne inndataen fra profilen din. Du kan overstyre verdien for én økt uten å endre profilen, med mindre en organisasjonspolicy låser inndataen. Forhåndsutfylling skjer lokalt, uansett om **Use my details** er på eller av.

**Kreditering.** Når du eksporterer, kan opplysningene dine følge med som forfatterkreditering i filens metadata (PNG, PDF, SVG og mer). **Use my details to create** styrer denne krediteringen og forfatteren på Lolly Batch-kjøringer. Når bryteren er av, står det fortsatt at eksporten er laget med Lolly, men den har ingen personlig forfatter- eller kontaktlinje.

Verktøyforfattere: se [`bindToProfile`](/info/tool-inputs.html#bindtoprofile) og [`host.profile`](/info/host-api.html#host-profile).

![Den ene bryteren Use my details to create, merket som et aktivt valg og av til du slår den på](/t/url-shot?url=%2F%23%2Fsettings%3Ffocus%3Duse-details&width=1440&height=900&dpi=192&waitMs=1600&format=svg&cropSelector=.profile-check&walker=1&dark=1&filename=pd-use-my-details)

<!--i:eti-layers-->
## Profil, designsystem og funksjonalitet

Tre ting ligger nær hverandre i Settings og er lette å forveksle:

- <!--i:people--> **Profile** - deg, teamet ditt eller rollen du har: navn, kontakt, portrettbilde og lagret arbeid. Personlig, lagret på enheten og flyttbart som en fil.
- <!--i:palette--> **Design system** - merkevaren: farger, skrifter og innstillinger som alle verktøy gjengir med. Delt, ikke personlig; se [Lolly Design System Setup](/info/brand-studio.html).
- <!--i:sliders--> **Capabilities** - hva appen kan gjøre: funksjonene og verktøyene som er tilgjengelige for deg.

Ordet har tre andre betydninger i Lolly. En **innholdsprofil** er en byggeinnstilling som velger hvilke verktøy og hvilken katalog en utrulling leveres med; [ordlisten](/info/glossary.html) definerer begrepet. Lenkeparameteren `profile` velger en fargeprofil for en eksport, som en CMYK-trykkbetingelse; se [Reserverte URL-parametere](/info/url-parameters.html#print). En **verifisert identitet** er det valgfrie signeringssertifikatet som knytter e-postadressen din til de signerte eksportene dine. Den er atskilt fra disse opplysningene, men **Use my details to create** avgjør om noen av delene bygges inn; se [Content Credentials](/info/content-credentials-identity.html).

![Kortet Verified identity i telefonbredde: velgeren for sertifikatets levetid og registreringstrinnet under - identitetsprofilen, atskilt fra de personlige opplysningene dine](/t/url-shot?url=%2F%23%2Fsettings%3Ffocus%3Didentity-section&width=430&height=1600&dpi=192&waitMs=2400&css=.welcome-dialog%2C.personalize-nudge%7Bdisplay%3Anone%7D&format=svg&walker=1&cropSelector=%23identity-section&dark=1&filename=pv-identity-enrol)

<!--i:eti-lock-->
## Personvern

Den personlige profilen din lagres lokalt. Opplysningene dine kan følge med i en sikkerhetskopi eller Sync-kopi, i innhold du deler eller eksporterer og under valgfri registrering for Content Credentials. På en Lolly Work-instans er pålogging, delt arbeid, telemetripolicy og revisjonsposter atskilt fra denne lokale profilen. **Settings → Preferences → Clear all my data** tømmer denne enheten; det sletter ikke kopier hos lagringsleverandøren eller organisasjonen din. Se [personvernerklæringen](/info/privacy.html).
