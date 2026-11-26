# Bruk Lolly i organisasjonen din

Organisasjonen din kan drive sin egen Lolly: den samme appen, med verktøyene og designsystemene den har valgt. Finn ut hvordan du får tilgang, logger på og hva som er annerledes.

Når dere planlegger organisasjonens oppsett, forklarer [Bruk Lolly med ditt eksisterende DAM](/info/use-with-dam.html) hvordan et godkjent bibliotek kan bli værende mens folk lager innhold i Lolly. [Innholdssuverenitet](/info/content-sovereignty.html) beskriver den bredere kontrollen over oppretting, styring, lagring og portabilitet.

::: note Dette trenger du fra organisasjonen din
Nettadressen til organisasjonens Lolly, eller en `.lolly`-oppsettfil organisasjonen har laget. lolly.tools alene kobler deg ikke til en organisasjon.
:::

<!--i:eti-globe-->
## I en nettleser

Åpne adressen du fikk fra organisasjonen. Hvis siden ber deg logge på, trykker du **Sign in** og følger påloggingssiden som åpnes. Deretter fungerer Lolly som vanlig, med organisasjonens verktøy og designsystemer.

Du kan også starte fra lolly.tools: åpne **Settings**-visningen og trykk **Open a workspace** på kortet **Lolly instance**, skriv inn adressen og trykk **Open this instance**. Nettleseren går til organisasjonens egen adresse, fordi en nettleser ikke kan laste inn verktøyene til en annen Lolly fra lolly.tools.

![Kortet Lolly instance i Settings, der du åpner organisasjonens arbeidsområde eller endrer hvor appen henter verktøyene sine](/t/url-shot?url=%2F%23%2Fsettings%3Ffocus%3Dinstance-section&width=1440&height=1400&dpi=192&waitMs=2000&format=svg&cropSelector=%23instance-section&walker=1&dark=1&filename=org-instance-card)

<!--i:eti-monitor-->
## I skrivebords- eller mobilappen

Appen starter med verktøyene som følger med. For å koble til åpner du **Settings**-visningen og trykker **Change** på kortet **Lolly instance**. Panelet spør **Where should Lolly get its tools?**

1. Velg **Connect to a Lolly instance**.
2. Skriv inn organisasjonens nettadresse og trykk **Check & connect**.
3. Trykk **Use this instance**. Neste skjermbilde, **Import your data (optional)**, overfører lagret arbeid fra en Lolly-sikkerhetskopi. Trykk **Skip** hvis du ikke har noen.
4. Logg på hvis appen ber om det.

Verktøy fra en tilkoblet instans kjører med samme tillit som appens egne, så koble bare til en du stoler på. Organisasjonen kan i stedet sende deg en `.lolly`-oppsettfil som kobler til appen for deg.

For å bytte senere bruker du **Change** igjen, eller **Leave** på det samme kortet.

### Logg på med en kode

I skrivebords- og mobilappene tilbyr påloggingsskjermen også en kort kode når organisasjonens Lolly støtter kodepålogging. Trykk **Open sign-in in browser**, logg på og godkjenn koden der. Eller åpne adressen skjermen viser på en telefon eller datamaskin der du allerede er pålogget, og skriv inn koden. Koden er gyldig i omtrent ti minutter.

<!--i:eti-sliders-->
## Hva er annerledes der

- **Noen kontroller er angitt for deg.** En kontroll organisasjonen styrer, viser **Managed by** og organisasjonens navn, eller **Managed by your organisation**. En låst kontroll kan ikke endres, og en meny kan tilby bare noen av valgene sine. Noen kontroller er skjult. Organisasjonens konsoll registrerer hvilken regel som låste en kontroll og hvorfor. Spør den som driver organisasjonens Lolly.
- **Noen designsystemer er låst.** Et designsystem organisasjonen leverer, viser en lås og er skrivebeskyttet. For å prøve endringer lager du en redigerbar kopi i **Settings → Preferences → Design systems**.
- **Bare organisasjonens verktøy er oppført.** Et verktøy organisasjonen ikke tilbyr, vises ikke.
- **Delte prosjekter.** Hvis organisasjonen deler prosjekter med deg, viser **Projects** en **Team projects**-flis. Disse øktene ligger på organisasjonens server. Åpne en for å arbeide med den, eller start et [arbeidssamarbeid](/info/collaborate.html#collabs-through-lolly-work-optional) fra **Share** når det er tilgjengelig.
- **Noen eksporter kan kreve godkjenning.** Der organisasjonen krever godkjenning, erstatter **Request approval** knappen **Download**, og et verktøy kan tilby færre formater.
- **Startskjermen kan åpnes med maler.** Hvis organisasjonen publiserer maler til deg, for eksempel til et partnerselskap, åpnes startskjermen med disse i stedet for velkomsten ved første besøk. Hver mal er ett kort, med **Your copy** for å fortsette og **New version** når malen endres. Se [Partnermaler](/info/work-partner-templates.html).

### Hva blir lagret hvor

::: cols
## På denne enheten

- Det du selv har lagret, med mindre du slår på [Sync](/info/sync.html)
- Designsystemer du har laget selv
- Alt du lager og laster ned

## På organisasjonens server

- Påloggingsidentiteten din og enhetsinformasjon
- Teamprosjekter, delte økter og direkte redigeringer i et arbeidssamarbeid
- Ressurser du laster opp til det delte biblioteket
- Godkjenningsforespørsler og godkjente leveringer
- En logg over påloggingene dine og det du gjør der
:::

Når et arbeidsområde er tilkoblet, sier personvernlinjen på appens første skjerm det samme. Lollys egne apper sender ingen brukshendelser til arbeidsområdet. [Personvern](/info/privacy.html#organisation-services-with-lolly-work) lister hva serveren lagrer og hvem som kontrollerer disse dataene.

<!--i:eti-building-->
## Hva Lolly Work tilfører

Organisasjonens server kjører **Lolly Work**, organisasjonsprogramvaren fra det samme prosjektet med åpen kildekode. Appen trenger verken en jobbkonto eller Lolly Work når du bruker den på egen hånd.

::: details Hva Lolly Work kan tilføre
Organisasjonen din drifter [Lolly Work](https://github.com/lolly-tools/lolly-work) sammen med Lolly og velger hvilke funksjoner som skal slås på:

- **Pålogging og tilgang.** Organisasjonens engangspålogging, gruppebaserte tillatelser og administrerte profilfelt. Administratorer kan opprette og deaktivere kontoer via SCIM.
- **Felles arbeid.** Teamprosjekter, delte økter og [arbeidssamarbeid](/info/collaborate.html#collabs-through-lolly-work-optional), med direkte redigering via organisasjonens server.
- **Et delt ressursbibliotek.** Opplastede ressurser, samlinger og tilkoblede biblioteker, med tilgangsregler, versjoner og gjennomgang.
- **Gjennomgang og levering.** Godkjenningstrinn, administrerte lenker som kan utløpe eller tilbakekalles og levering til destinasjoner organisasjonen tillater.
- **Administrasjon.** En revisjonspost for handlinger underlagt styring og bruksrapportering under instansens telemetripolicy for klienter som sender brukshendelser. Lollys egne apper sender ingen i dag.
:::

For å sette opp tjenesten starter du med [Utrulling](/info/deployment.html#organisation-services-with-lolly-work). Den offentlige demoen på [lolly.work](https://lolly.work) er en sandkasse. Bruk organisasjonens egen adresse til arbeid du trenger å beholde.

<!--i:eti-palette-->
## En annen organisasjons merkevare

En partner, kunde eller sponsor kan sende deg merkevaren sin som en designsystemfil (`.lolly`) i stedet for en adresse. Å åpne den filen kobler ikke appen til noe. Filen legger til deres designsystem ved siden av ditt eget på denne enheten. En oppsettfil fra din egen organisasjon kobler appen til organisasjonens Lolly. Før noe endres, viser forhåndsvisningen hva som skjer når du åpner en fil. [Samarbeid med partnere](/info/partners.html) dekker begge sider av å arbeide med en annen organisasjons merkevare.

<!--i:eti-unlink-->
## Koble fra

**Leave**, på kortet **Lolly instance** i **Settings**, fjerner organisasjonens designsystem, verktøy og katalog. Ditt eget arbeid blir værende. Alt du har laget med organisasjonens verktøy, kan ikke åpnes igjen før du kobler til på nytt. Der organisasjonens Lolly tilbyr det, avslutter **Sign out everywhere** på det samme kortet øktene dine på alle enheter, også denne.

Alt du har lagret hos organisasjonen, blir hos organisasjonen, under dens regler for tilgang og oppbevaring. Å koble fra eller tømme denne enheten sletter ikke serverkopien. I en nettleser på organisasjonens egen adresse er det ingenting å koble fra: åpne en annen adresse i stedet.

<!--i:eti-help-->
## Hvem du kan spørre

Hva som når organisasjonens server, hvem som kan se de delte prosjektene og hvilke innstillinger som er låst, bestemmes av organisasjonen. Spør den som driver organisasjonens Lolly. [Personvern](/info/privacy.html) dekker hva Lolly selv gjør med dataene dine.
