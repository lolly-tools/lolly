# Kom i gang

Lolly gjør reglene dine - farger, typografi, layout, logikk - om til verktøy hvem som helst kan bruke til å lage ferdige filer: bilder, PDF-er, kort til sosiale medier, video, ved å fylle ut noen få felter. Det er lite å lære og ingenting å laste opp: alt lages og eksporteres på enheten din, med eller uten nett.

Dette er siden du bør lese først. To ting gjør deg produktiv: **gjør Lolly til din** og **ta med det du allerede har** (designfilene og tokenene dine). Alt annet er én lenke unna.

> Ny i Lolly og vil bare lage noe? [Lag noe på 60 sekunder](/info/make-something.html) tar deg gjennom tre, eller [åpne appen](/#/), velg et verktøy fra galleriet, fyll ut feltene og trykk **Export**. Kom tilbake hit når du vil at det skal bære *din* merkevare.

![Utilities-visningen - arbeidshestene som kjører på enheten, som Strip Hidden Data, Compress PDF og Convert Image, samlet på ett sted](/t/url-shot?url=%2F%23%2Fu&width=1440&height=900&dpi=192&waitMs=1600&css=.welcome-dialog%2C.personalize-nudge%7Bdisplay%3Anone!important%7D&tolerance=0.03&format=svg&walker=1&dark=1&filename=use-utilities&try=1)

## 1. Gjør den til din - sett opp designsystemet ditt

Merkevaren din i Lolly er et lite **design-tokens**-dokument - farger, skrifter og noen få regler - som alle verktøy gjengir mot. Sett det opp én gang, så er alt du lager i tråd med merkevaren fra bunnen av, ikke etter en gjennomgang. Det finnes tre veier inn; velg den som passer der merkevaren din allerede bor.

### Start fra bunnen (designsystembyggeren)

Første gang lander du i **galleriet**, med en kort velkomstdialog over som tilbyr tre veier inn - **Make it yours** (Brand Studio på `#/start`), **Bring your design** (slipp en Figma-, Penpot-, InDesign- eller PDF-fil, så åpnes den som en redigerbar layout - den raskeste veien til [Ta med det du allerede har](#2-bring-in-what-you-already-have) nedenfor) og **Explore the community tools** - pluss en rad med språk hvis engelsk ikke er ditt. Velg det første kortet, så havner du i [**Brand Studio**](/info/brand-studio.html). Gi den et navn og en primærfarge, så *utleder* Lolly en komplett, tilgjengelig palett fra den - lyse og mørke flater, tekst, aksenter - med den samme fargematematikken motoren bruker overalt ellers.

![Fargerommet i Brand Studio - en primærfarge, og den tilgjengelige paletten Lolly utleder fra den](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor&width=1440&height=740&dpi=192&waitMs=1800&format=svg&walker=1&localize=1&dark=1&filename=brand-colours) Velg en skrift, og du har en fungerende merkevare på under ett minutt. Derfra lar studioets seks rom - Overview, Colours, Type, Logos, Tokens, Files - deg ta den så langt du vil, i hvilken rekkefølge du vil, og finpusse hva som helst hver gang du kommer tilbake. Fanen **Design system** på dashbordet (`#/d`) viser resultatet skrivebeskyttet og peker tilbake til `#/start`, som er der redigeringen skjer (med mindre du kjører en merkevarelåst utgave av Lolly, der merkevaren er fast og det ikke er noe å endre).

### Importer en merkevare du allerede har

Er merkevaren din allerede fanget som design-tokens - fra **Penpot**, **Tokens Studio** (Figma) eller en hvilken som helst ren **DTCG**-fil - så ta den inn i sin helhet i stedet for å taste den inn på nytt. To veier:

- <!--i:palette--> **I appen:** [designsystembyggeren: Brand Studio](/info/brand-studio.html) (`#/start`) tar den inn via **Add from…** nederst i romlisten - en token-fil, en Penpot-eksport, en SVG eller en `LollyBrand`-pakke. Slipp den inn, så lyser paletten opp.
- <!--i:code--> **Fra kommandolinjen**, for å sette opp en gjenbrukbar merkevarepakke:

```bash
# a monolithic tokens.json, a one-file-per-set directory, or a Penpot project archive
npm run ingest:brand -- ./my-tokens.json --name acme --label "Acme" --activate
```

`ingest:brand` godtar alle de tre beholderne Penpot / Tokens Studio eksporterer det samme dokumentet i - en enkelt `tokens.json`, en mappe (`$metadata.json` + filer per sett) eller et `project.penpot`-arkiv. Med `--activate` registreres merkevaren som en profil, den aktiveres og katalogen bygges på nytt. Se [Konfigurasjon](/info/configuration.html) for hvordan merkevarepakker og profiler henger sammen.

### Finjuster den i appen

Når en merkevare er aktiv, kan du fortsette å forme den i [**Brand Studio**](/info/brand-studio.html) (`#/start`) - endre en farge eller en rolle, så oppdateres alle forhåndsvisninger i appen mens du skriver. (Fanen **Design system** på dashbordet på `#/d` *viser* merkevaren skrivebeskyttet; det er i Studio du redigerer den.)

![Design system-fanen på dashbordet - den aktive merkevaren vist skrivebeskyttet](/t/url-shot?url=%2F%23%2Fd%3Ftab%3Dbrand&width=1440&height=900&dpi=192&waitMs=1800&format=svg&walker=1&localize=1&dark=1&filename=dashboard-brand) Den samme merkevaren er oppsummert på kortet **Profile → Your brand**. Skriftene er ekte: velg fra Google Fonts, så lagrer Lolly filen **på enheten din** som en merkevareressurs, slik at typografien din virker uten nett og ingenting hentes ved gjengivelse.

Når du er fornøyd, **eksporter merkevaren som en `LollyBrand`-pakke** - én enkelt fil en kollega kan importere for å få nøyaktig samme palett, skrifter og regler. Slik flytter en merkevare seg mellom folk og maskiner uten en server i mellom.

> **Merkevare-tokens går begge veier.** Fordi Lollys merkevare *er* DTCG-tokens - formatet Penpot leser og skriver direkte, og som Tokens Studio tar med til Figma - er paletten du designer *med* og paletten Lolly *håndhever* ett dokument, ikke to lister du holder synkronisert for hånd. Se [Design-tokens](/info/design-tokens.html).

## 2. Ta med det du allerede har

Du starter ikke med blanke ark. Lolly åpner designarbeidet og de åpne formatene du allerede eier.

### Åpne designfiler

Ferdig arbeid i **Figma, Penpot, Illustrator, InDesign eller en hvilken som helst SVG-app** trenger ikke bli låst inne i appen du tegnet det i. Åpne **Design**, klikk **Import a design**, og filen åpnes som en *levende layout* - ikke et flatet bilde. Hvert lag blir en redigerbar boks: tekst kan skrives om, former forblir former, bilder havner i biblioteket ditt og kompleks vektorgrafikk bevares tro mot originalen. Den kommer inn allerede tilpasset merkevarens skrifter og fargeregler.

| Du har | Ta det inn som |
|---|---|
| En Figma-ramme | Nativ `.fig` (File → Save local copy), eller en SVG-eksport |
| Et Penpot-design | `.penpot`-eksporten, eller en hvilken som helst SVG |
| En Illustrator-fil | Nativ `.ai` (PDF-kompatibel) eller `.pdf` - åpnes direkte |
| En InDesign-layout | `.idml` (File → Export → InDesign Markup) |
| Alt annet | **Hvilken som helst SVG** - den universelle døren inn |

Hele importen skjer **på enheten din** - filen tolkes i nettleseren din og ingenting lastes opp. Alle detaljer, og nøyaktig hva som følger med over, finner du i [Importer et design](/info/design-import.html).

Har du en **PowerPoint-presentasjon** i stedet? Slipp `.pptx`-filen på **Deck Builder** for å redigere den lysbilde for lysbilde, allerede tilpasset merkevaren din - eller kjør **Rebrand a Deck** for å få den samme presentasjonen tilbake med nytt tema, med diagrammer og animasjoner intakt.

### Fra engangsjobb til mal

Her er gevinsten: en importert layout er en helt vanlig Design-økt, så når du **lagrer** den, bor den på en URL. Hvem som helst med Lolly kan åpne den URL-en, endre ordene, bytte et bilde og gjengi sin egen versjon - uten designapp, og de låste delene forblir låst. Et engangsdesign blir et gjenbrukbart verktøy. Det er hele poenget, nådd uten å skrive en eneste linje med konfigurasjon.

### Åpne data og åpne verktøy

[Fellesskapets verktøysett](/info/builders.html) er åpen kildekode og merkevareuavhengig - QR-koder, gatekart, filtre, personvernverktøy - og det gjengir mot *din* merkevare i det øyeblikket du aktiverer den.

Mat verktøyene med dine egne åpne data også: lim inn eller slipp en **CSV**- eller **JSON**-tabell, så fylles verktøyets gjentakende felter fra den, én ferdig ressurs per rad.

## 3. Lag noe, del det eller automatiser det

Med en aktiv merkevare og materialet ditt for hånden lager hvert verktøy en ferdig fil:

- <!--i:download--> **Gjengi** et hvilket som helst verktøy til **SVG, PDF, PNG, JPG, WebP, video** og mer - i ekte trykkstørrelser og fysiske enheter når du trenger det. Se [Eksport & formater](/info/exporting.html).
- <!--i:link--> **Del en lenke.** Hver verktøytilstand er en URL, så en ferdig ressurs er reproduserbar og adresserbar med parametere - sjekk inn lenken, generer på nytt ved behov.
- <!--i:layers--> **Gjør det i bulk.** Driv en mal fra et regneark i [masserutenettet](/info/exporting.html): én ferdig ressurs per rad.
- <!--i:cpu--> **Automatiser det.** Den samme gjengivelsen kjører fra [CLI](/info/cli.html) og fra en [AI-agent](/info/ai-agents.html) - en URL er API-et.

«En URL er API-et» er bokstavelig ment. Diagrammet nedenfor er ikke tegnet av noen: typen, overskriften og hele datatabellen ble skrevet inn i adressefeltet, og den samme lenken gjengir det samme diagrammet på hvilken som helst enhet.

![Et arealdiagram over månedlige registreringer, der hver verdi kom inn som en spørreparameter i stedet for et klikk](/t/url-shot?url=%2F%23%2Ftool%2Fchart%3Fct%3Darea%26d%3DMonth%2CSignups%250AJan%2C120%250AFeb%2C180%250AMar%2C265%250AApr%2C340%250AMay%2C455%26t%3DSignups%2520this%2520year%26full&width=1440&height=900&dpi=192&waitMs=2600&cropSelector=%23tool-canvas&walker=1&format=svg&dark=1&filename=vt-d3-url-chart)

## Hvor du går videre

Tre veier, avhengig av hva du er her for å gjøre:

- <!--i:people--> **[Lolly for skapere](/info/creators.html)** - du lager ting. Fordelene, og hvordan du får mest ut av appen.
- <!--i:code--> **[Lolly for utviklere](/info/builders.html)** - du lager verktøy, integrerer og distribuerer. Den tekniske dokumentasjonen.
- <!--i:shieldcheck--> **[Lolly for driftsansvarlige](/info/operators.html)** - du har ansvar for merkevare, sikkerhet og utrulling i en organisasjon.
