# Lolly og API-er for gjengivelse

_Sist sjekket: 5. november 2026._

Hvis du genererer bilder fra maler gjennom et API, sier denne siden hva som endres når du kjører den produksjonen på din egen enhet, i CI eller på en server du kontrollerer. [Flytt fra et vertsbasert API for gjengivelse](/info/work-move-from-render-api.html) viser trinnene.

<!--i:eti-award-->
## Hva vertsbaserte API-er for gjengivelse gjør bedre

[Bannerbear](https://www.bannerbear.com/) og [Placid](https://placid.app/) er administrerte tjenester: du sender en forespørsel, og noen andre drifter serverne.

- **Ingenting å drifte.** Ingen server, database, lagring, oppdateringer eller kapasitetsplanlegging.
- **En vertsbasert malredigerer** med maler klare til å tilpasses.
- **Flere utdatatyper fra ett API.** Begge publiserer endepunkter for video og PDF, og Bannerbear dokumenterer også animerte utdata, WebP og AVIF, skjermbilder og fjerning av bakgrunn med KI.
- **Egne integrasjoner og støtte.**

Hvis det er ordningen du ønsker, er disse tjenestene et godt valg.

<!--i:eti-home-->
## Hva egen drift gir deg

- **Innholdet ditt blir på systemene dine.** Inndata, ressurser og utdata ligger på infrastruktur du har valgt. Gjengivelse på en enhet eller i CI trenger ingen tjeneste.
- **Reglene ligger i verktøyet.** Farger, skrift, logoer og låste inndata kommer fra [designsystemet](/info/brand-studio.html) ditt, så den som kaller verktøyet, kan bare endre det du tillater. [Lolly Work](/info/compare.html#what-runs-where) håndhever verktøysynlighet og inndatapolicyer for hver forespørsel.
- **Det samme verktøyet overalt.** Et verktøy gjengir fra de samme inndataene på en bærbar datamaskin, i en CI-jobb eller på en server. Folk kan redigere det samme verktøyet i appen.
- **Dokumentasjon du har kontroll over.** [Gjengivelseskvitteringer](/info/work-renders.html#evidence-and-identity), et revisjonsspor og Content Credentials der du konfigurerer en signeringsidentitet.
- **Åpen kildekode og ingen forbruksmåling.** Du kjører koden og betaler bare for din egen infrastruktur.

Du tar på deg arbeidet disse tjenestene gjør for deg. En varig server trenger en vedvarende database og lagring av utdata. Verktøy som trenger en nettleser, trenger Chromium-arbeideren. [Installer Lolly Work](/info/work-install.html) beskriver begge deler.

<!--i:eti-table-->
## Slik sammenlignes jobbene

| Jobb | Vertsbasert API for gjengivelse | Lolly |
|---|---|---|
| Fyll en mal fra data | API-forespørsel som angir en mal og lagene dens | [URL](/info/url-mode.html), [CLI](/info/cli.html) eller [server-API](/info/work-automation-api.html) som angir et verktøy og inndataene det tar |
| Mange filer fra en tabell | Satser og samlinger | [Satsvis behandling](/info/batch.html) på enheten din eller [gjengivelsessatser](/info/work-renders.html#batches-with-durable-rows) på en server |
| Vent eller spør gjentatte ganger etter et resultat | Gjentatte forespørsler eller et synkront alternativ | Varige gjengivelsesjobber du spør etter, eller en umiddelbar gjengivelse |
| Kall en webhook når jobben er ferdig | Ja | [Signerte tilbakekall](/info/work-renders.html) til opprinnelser du tillater |
| Dynamisk bilde-URL | Ja | [Delingslenker og `/render`-URL-er](/info/url-mode.html) |
| Rediger en mal | Vertsbasert redigerer | [Design](/info/using.html), på enheten din |
| Agenter | Begge publiserer en MCP-server | [MCP](/info/mcp.html), med et organisasjonsendepunkt under et tokens policy i Lolly Work |

Lollys egne utdatatyper er listet i [Eksport](/info/exporting.html). På en Work-server lager varige gjengivelsesjobber i dag SVG, PNG, JPG og PDF, og [video forblir på enheten, i kommandolinjeverktøyet og i MCP](/info/work-renders.html#production-still-checks-and-permitted-repairs).

<!--i:eti-folder-move-->
## Hva som følger med og hva som ikke gjør det

| | Bannerbear V5 | Bannerbear V2 | Placid |
|---|---|---|---|
| Forespørslene dine | Works migrerings-API tar imot den samme strukturen | Samme | Samme |
| Malene dine | **Import** som redigerbare dokumenter, unntatt lagtyper uten bekreftet skjema | Bare feltnavn og en forhåndsvisning. Bygg hver mal på nytt | Bare feltnavn og en forhåndsvisning. Bygg hver mal på nytt |
| Eksisterende dynamiske URL-er | Støttes ikke | Støttes ikke | Signerte URL-er fortsetter å fungere etter bytte av vert, med det gamle private tokenet ditt |
| Webhooks | Registrerte webhooks støttes ikke | `webhook_url` fungerer | `webhook_success` fungerer |
| WebP- og AVIF-utdata | Avvises etter navn | Tilbys ikke | WebP avvises etter navn |
| Animasjoner, videoer, samlinger, skjermbilder | Ikke i migrerings-API-et | Ikke i migrerings-API-et | Ikke i migrerings-API-et |

::: note Bygget fra offentlig dokumentasjon
Dette ble bygget fra hver leverandørs offentlige dokumentasjon og har ikke blitt kjørt mot en aktiv konto. Hvis du har en konto, har [flytteveiledningen](/info/work-move-from-render-api.html#check-it-on-your-own-account) en kort sjekkliste.
:::

Du kan flytte én mal og beholde resten der de er. [Å forlate Lolly](/info/work-move-from-render-api.html#leave-lolly-too) er like åpent: verktøy er vanlige filer, og kommandolinjeverktøyet gjengir dem uten server.

<!--i:eti-building-->
## Hvem drifter tjenesten

Med Lolly gjengir en enkeltperson lokalt, eller et team kjører Lolly Work på sin egen infrastruktur. En serverjobb sender inndataene og de nødvendige ressursene til den instansen. Behandling på enheten gjør ikke det.

Bannerbear og Placid er varemerker som tilhører eierne sine. Denne siden beskriver hvor produktene overlapper, ut fra den offentlige dokumentasjonen deres, og er ikke tilknyttet noen av dem.
