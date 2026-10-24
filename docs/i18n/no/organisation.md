# Bruk Lolly i organisasjonen din

Organisasjonen din kan kjøre sin egen Lolly: den samme appen, med verktøyene og designsystemene den har valgt. Denne siden viser hvordan du kommer dit, logger på og hva som endres når du gjør det.

::: note Hva du trenger fra organisasjonen din
Nettadressen til Lollyen deres, eller en `.lolly`-oppsettfil organisasjonen din har laget. lolly.tools alene kobler ikke til noen organisasjon.
:::

## I en nettleser

Åpne adressen organisasjonen din ga deg. Hvis siden ber deg logge på, trykk **Sign in** og følg påloggingssiden den åpner. Etter det fungerer det som enhver Lolly, med organisasjonens verktøy og designsystemer.

Du kan også starte fra lolly.tools: åpne **Settings**, og på kortet **Lolly instance** trykker du **Open a workspace**, skriver inn adressen og trykker **Open this instance**. Nettleseren går til organisasjonens egen adresse, fordi en nettleser ikke kan laste en annen Lollys verktøy fra lolly.tools.

![Kortet Lolly instance i Settings, der du åpner organisasjonens arbeidsområde eller endrer hvor appen henter verktøyene sine](/t/url-shot?url=%2F%23%2Fsettings%3Ffocus%3Dinstance-section&width=1440&height=1400&dpi=192&waitMs=2000&format=svg&cropSelector=%23instance-section&walker=1&dark=1&filename=org-instance-card)

## I skrivebords- eller mobilappen

Appen starter med de medfølgende verktøyene sine. For å koble til åpner du **Settings** og trykker **Change** på kortet **Lolly instance**. Arket spør **Where should Lolly get its tools?**

1. Velg **Koble til en Lolly-instans**.
2. Skriv inn organisasjonens nettadresse og trykk på **Sjekk og koble til**.
3. Trykk på **Bruk denne instansen**. Neste skjerm, **Importer dataene dine (valgfritt)**, tar med lagret arbeid fra en Lolly-sikkerhetskopi; trykk på **Hopp over** hvis du ikke har noen.
4. Logg inn hvis appen spør.

Verktøy fra en tilkoblet instans kjører med samme tillit som appens egne, så koble bare til en du stoler på. Organisasjonen din kan i stedet sende deg en `.lolly`-oppsettfil som kobler appen til for deg.

For å bytte senere, bruk **Change** igjen, eller **Leave** på samme kort.

### Pålogging med en kode

I skrivebords- og mobilappene tilbyr påloggingsskjermen også en kort kode, når organisasjonens Lolly støtter kodepålogging. Trykk **Open sign-in in browser**, logg på og godkjenn koden der. Eller åpne adressen den viser på en telefon eller datamaskin der du allerede er logget på, og skriv inn koden. Koden varer i omtrent ti minutter.

## Hva som er annerledes der

- **Noen kontroller er satt for deg.** En kontroll organisasjonen din styrer, viser **Managed by** og organisasjonens navn, eller **Managed by your organisation**. En fast kontroll kan ikke endres, en meny kan bare tilby noen av valgene sine, og en linje som begynner med **Set by** kan si hvilken regel som gjelder og hvorfor. Noen kontroller vises ikke i det hele tatt.
- **Noen designsystemer er låst.** Et designsystem organisasjonen din leverer, viser en lås og forblir skrivebeskyttet. For å prøve endringer, lag en redigerbar kopi i **Settings → Preferences → Design systems**.
- **Bare verktøyene dens listes.** Et verktøy organisasjonen din ikke tilbyr, vises ikke i det hele tatt.
- **Delte prosjekter.** Hvis organisasjonen din deler prosjekter med deg, viser **Projects** en **Team projects**-flis. Disse øktene ligger på organisasjonens server. Åpne en for å arbeide på den, eller start en [work collab](/info/collaborate.html#work-collabs-with-lolly-work-optional) fra **Share** når det er tilgjengelig.
- **Noen eksporter kan trenge godkjenning.** Der organisasjonen din ber om godkjenning, tar **Request approval** plassen til **Download**, og et verktøy kan tilby færre formater.

### Hva som blir hvor

::: cols
## På denne enheten

- Dine egne lagringer, med mindre du slår på [Sync](/info/sync.html)
- Designsystemer du har laget selv
- Alt du lager og laster ned

## På organisasjonens server

- Påloggingsidentiteten din og enhetsinformasjon
- Teamprosjekter, delte økter og sanntidsredigeringer i en work collab
- Ressurser du laster opp til det delte biblioteket
- Godkjenningsforespørsler og godkjente leveranser
- Bruksbegivenheter, der organisasjonen din slår dem på
:::

[Privacy](/info/privacy.html#organisation-services-with-lolly-work) lister hva serveren lagrer og hvem som kontrollerer de dataene.

## Hva Lolly Work legger til

Organisasjonens server kjører **Lolly Work**, organisasjonsprogramvaren fra det samme åpen kildekode-prosjektet. Appen trenger verken en jobbkonto eller Lolly Work når du bruker den på egen hånd.

::: details Hva Lolly Work kan legge til
Organisasjonen din huser [Lolly Work](https://github.com/lolly-tools/lolly-work) ved siden av Lolly og velger hvilke funksjoner som slås på:

- **Pålogging og tilgang.** Enkel pålogging for organisasjonen, gruppebaserte tillatelser og administrerte profilfelt. Administratorer kan klargjøre og deaktivere kontoer gjennom SCIM.
- **Delt arbeid.** Teamprosjekter, delte økter og [work collabs](/info/collaborate.html#work-collabs-with-lolly-work-optional), med redigering i sanntid gjennom organisasjonens server.
- **Et delt ressursbibliotek.** Opplastede ressurser, samlinger og tilkoblede biblioteker, med tilgangsregler, versjoner og gjennomgang.
- **Gjennomgang og levering.** Godkjenningstrinn, administrerte lenker med utløp eller tilbakekalling, og levering til destinasjoner organisasjonen tillater.
- **Administrasjon.** Bruksrapportering under instansens telemetripolicy, pluss en revisjonspost over styrte handlinger.

Hvis du setter opp tjenesten, start med [Deployment](/info/deployment.html#organisation-services-with-lolly-work). Den offentlige demoen på [lolly.work](https://lolly.work) er en sandkasse; bruk organisasjonens egen adresse for arbeid du må beholde.
:::

## Å forlate

**Leave**, på kortet **Lolly instance** i **Settings**, fjerner organisasjonens designsystem, verktøy og katalog. Ditt eget arbeid blir. Alt du lagde med verktøyene dens, åpnes ikke igjen før du kobler til på nytt.

Alt du lagret hos organisasjonen, blir hos organisasjonen, under dens tilgangs- og oppbevaringspolicyer. Å forlate eller tømme denne enheten sletter ikke den serverkopien. I en nettleser på organisasjonens egen adresse er det ingenting å forlate: åpne en annen adresse i stedet.

## Hvem du bør spørre

Hva som når organisasjonens server, hvem som kan se dens delte prosjekter, og hvilke innstillinger som er faste, er organisasjonens egne beslutninger. Spør den som drifter organisasjonens Lolly. [Personvernerklæring](/info/privacy.html) dekker hva Lolly selv gjør med dataene dine.
