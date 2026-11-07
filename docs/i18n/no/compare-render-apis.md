# Lolly og gjengivelses-API-er

_Sist kontrollert: 5. november 2026._

Hvis du genererer bilder fra maler gjennom et API i dag, sier denne siden hva som endrer seg hvis du driver den produksjonen selv: på din egen enhet, i CI eller på en server du kontrollerer. [Move from a hosted render API](/info/work-move-from-render-api.html) er fremgangsmåten.

## Hva vertsbaserte gjengivelses-API-er gjør bedre

[Bannerbear](https://www.bannerbear.com/) og [Placid](https://placid.app/) er administrerte tjenester, og det er en reell fordel. Du sender en forespørsel, og noen andre driver serverne, holder dem oppe og håndterer belastningen.

- **Ingenting å drifte.** Ingen server, database, lagring, oppdateringer eller kapasitetsplanlegging.
- **Et vertsbasert malredigeringsprogram** med ferdige maler du kan tilpasse.
- **Flere typer resultat fra ett API.** Begge har video- og PDF-endepunkter, og Bannerbear dokumenterer også animert resultat, WebP og AVIF, skjermbilder og AI-fjerning av bakgrunn.
- **Egne integrasjoner og egen støtte.**

Hvis det er ordningen du vil ha, er disse tjenestene et godt valg.

## Hva egen drift gir deg

- **Innholdet ditt blir på systemene dine.** Inndata, ressurser og resultater ligger på infrastruktur du har valgt. Gjengivelse på en enhet eller i CI trenger ingen tjeneste i det hele tatt.
- **Reglene bor i verktøyet.** Farger, skrift, logoer og låste inndata kommer fra [designsystemet](/info/brand-studio.html) ditt, så en som kaller, bare kan endre det du tillater. [Lolly Work](/info/compare.html#what-runs-where) bruker verktøysynlighet og inndatapolicyer på hver forespørsel.
- **Det samme verktøyet overalt.** Et verktøy gjengir på en bærbar, i en CI-jobb eller på en server fra de samme inndataene, og folk kan redigere det samme verktøyet i appen.
- **Poster du selv holder.** [Render receipts](/info/work-renders.html#evidence-and-identity), et revisjonsspor og Content Credentials der du konfigurerer en signeringsidentitet.
- **Åpen kildekode og ingen måler.** Du kjører koden, og det du betaler for, er din egen infrastruktur.

Du overtar arbeidet disse tjenestene gjør for deg. En varig server trenger en vedvarende database og lagring av resultater, og verktøy som trenger en nettleser, trenger Chromium-arbeideren. [Install Lolly Work](/info/work-install.html) beskriver begge.

## Hvordan jobbene svarer til hverandre

| Jobb | Vertsbasert gjengivelses-API | Lolly |
|---|---|---|
| Fylle en mal fra data | API-forespørsel som navngir en mal og lagene dens | [URL](/info/url-mode.html), [CLI](/info/cli.html) eller [server-API](/info/work-automation-api.html) som navngir et verktøy og inndataene dets |
| Mange filer fra en tabell | Batcher og samlinger | [Batch](/info/batch.html) på enheten din, eller [render batches](/info/work-renders.html#batches-with-durable-rows) på en server |
| Vente på eller polle et resultat | Polling, eller et synkront alternativ | Varige gjengivelser du poller, eller en umiddelbar gjengivelse |
| Kalle en webhook når den er ferdig | Ja | [Signed callbacks](/info/work-renders.html) til opprinnelser du tillater |
| Dynamisk bilde-URL | Ja | [Share links and `/render` URLs](/info/url-mode.html) |
| Redigere en mal | Vertsbasert redigeringsprogram | [Design](/info/using.html), på enheten din |
| Agenter | Begge har en MCP-server | [MCP](/info/mcp.html), med et organisasjonsendepunkt under et tokens policy på Lolly Work |

Lollys egne typer resultat er listet i [Exporting](/info/exporting.html). På en Work-server i dag lager varige gjengivelser SVG, PNG, JPG og PDF, og [video blir på enheten, i CLI og MCP](/info/work-renders.html#production-still-checks-and-permitted-repairs).

## Hva som følger med, og hva som ikke gjør det

| | Bannerbear V5 | Bannerbear V2 | Placid |
|---|---|---|---|
| Forespørslene dine | Works migrerings-API tar samme form | Samme | Samme |
| Malene dine | **Importeres** som redigerbare dokumenter, bortsett fra lagtyper uten bekreftet skjema | Bare feltnavn og en forhåndsvisning. Bygg hver på nytt | Bare feltnavn og en forhåndsvisning. Bygg hver på nytt |
| Eksisterende dynamiske URL-er | Støttes ikke | Støttes ikke | Signerte URL-er fortsetter å virke etter et vertsbytte, med det gamle private tokenet ditt |
| Webhooks | Registrerte webhooks støttes ikke | `webhook_url` virker | `webhook_success` virker |
| WebP- og AVIF-resultat | Avvises ved navn | Tilbys ikke | WebP avvises ved navn |
| Animasjoner, videoer, samlinger, skjermbilder | Ikke på migrerings-API-et | Ikke på migrerings-API-et | Ikke på migrerings-API-et |

Alt dette er bygget fra hver leverandørs offentlige dokumentasjon og er ikke kjørt mot en levende konto. [The move guide](/info/work-move-from-render-api.html#check-it-on-your-own-account) har en kort sjekkliste hvis du har en.

Å flytte er ikke alt eller ingenting. Du kan flytte én mal og la resten bli der de er, og [leaving Lolly](/info/work-move-from-render-api.html#leave-lolly-too) er like åpent: verktøy er vanlige filer, og CLI-et gjengir dem uten server.

## Hvem som driver tjenesten

Med Lolly gjengir en enkeltperson lokalt, eller et team kjører Lolly Work på sin egen infrastruktur. Å sende inn en serverjobb sender inndataene og de nødvendige ressursene til den instansen, noe som er annerledes enn veien på enheten.

Bannerbear og Placid er varemerker tilhørende eierne. Denne siden beskriver hvor produktene overlapper, fra den offentlige dokumentasjonen deres, og er ikke tilknyttet noen av dem.
