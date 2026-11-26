# Finn og gjenopprett arbeidet ditt

Finn et design du aldri lagret, en fil du lastet ned, forrige ukes versjon eller arbeidet ditt etter at nettleserdataene ble slettet. Start med tabellen.

Personlig arbeid blir i nettleseren eller appen du laget det i, på den enheten, med mindre du slår på [Sync](/info/sync.html). En organisasjon som bruker Lolly Work som tilvalg, har også **Team projects** på serveren sin.

| Hva du gjorde | Hvor du skal se |
|---|---|
| Trykket **Save as** eller **Save** | **Projects** |
| Trykket **Download** | Nettleserens nedlastinger og en kopi i **Assets** |
| Ingen av delene, i et [verktøy som lagrer mens du arbeider](#which-tools-save-as-you-work) | **Projects** og **History** |
| Ingen av delene, i et verktøy som ikke gjør det | Bare fanen du arbeidet i, til du lukker fanen |
| Slettet det i appen | **Trash**, i **Projects**, **Assets** eller **Settings → Storage**, i 30 dager |

::: figure find-your-work-places
Hvor arbeidet ditt ligger: nettleserens egen lagring holder Projects, History og Trash; nedlastinger går til enhetens mapper; Sync og en sikkerhetskopifil er kopiene utenfor nettleseren.
:::

::: details Finn delt arbeid i Lolly Work (valgfritt)
Åpne organisasjonens Lolly, logg inn og se i **Projects → Team projects**. Den instansen har delte økter og viser dem du har tilgang til. Innlogging på en annen enhet kan gjenopprette tilgangen til disse øktene. Innlogging gjenoppretter ikke det personlige biblioteket ditt eller sikkerhetskopien av enheten.

I et [arbeidssamarbeid](/info/collaborate.html#collabs-through-lolly-work-optional) må du vente på **Saved to work** før du forlater det. Hvis et delt prosjekt mangler, sjekk at du er koblet til riktig instans og spør den driftsansvarlige om tilgang eller oppbevaring. Sletting av nettleserdata fjerner lokale kopier, ikke organisasjonens serverkopi. Se [Bruk Lolly i organisasjonen din](/info/organisation.html).
:::

<!--i:eti-search-->
## Finn noe du har lagret

1. Trykk **Home** øverst til venstre i verktøyet.
2. Åpne fanen **Projects** øverst på startskjermen (mappeikonet på en telefon).
3. Alt du har lagret i **My library**, ligger på den første skjermen. Hvert prosjekt er en mappe. For å søke i alle mapper skriver du i **Search all projects…** nederst på skjermen.

Et element får filnavnet du skrev i eksportpanelet. Uten filnavn får det verktøyets navn, for eksempel **QR Code**. Når du åpner elementet, kommer alle innstillingene tilbake. For å lagre nytt arbeid, se [Lagre & fortsette](/info/using.html#saving-continuing).

::: note Ikke i Projects?
- Det kan være i **Trash**: se [Få tilbake noe du har slettet](#get-back-something-you-deleted).
- En annen nettleser, et privat vindu eller en annen enhet starter tom, med mindre du bruker [Sync](/info/sync.html) eller [flytter arbeidet ditt](#move-your-work-to-another-device).
- Hvis du bare trykket **Download**, se [Finn en fil du har lastet ned](#find-a-file-you-downloaded).
:::

::: details Arbeide med Projects
Du kan også åpne **Projects**-visningen fra **Settings → Storage → Saved sessions → Organise in Projects**. Den fungerer som en filbehandler:

![Projects før noe er lagret: flisene New folder, New asset og Templates, History-klokken øverst til høyre og Search all projects-linjen nederst](/t/url-shot?url=%2F%23%2Fp&width=1440&height=900&dpi=192&waitMs=1200&walker=1&format=svg&localize=1&dark=1&filename=projects)
<!--
SHOT NOTE (projects): build-docs-shots.ts gives every shot a fresh browser
context with no storage seeding, so this frame is always the empty Projects
root. The alt says so. Revisit (and re-caption) if the pipeline gains a
storage-seeding hook.
-->

- <!--i:folder--> **Mapper inni mapper.** Legg lagrede økter i mapper og mapper inni mapper, på så mange nivåer du vil. Opprett eller gi nytt navn til en mappe, eller dra en flis til en mappe for å flytte flisen. En brødsmulesti tar deg opp igjen. Økter lagret uten mappe ligger på rotnivået i **Projects**.
- <!--i:clock--> **Sorter på din måte.** **View options**, knappen med glidere øverst til høyre, tilbyr **Grid** eller **List** og sorterer etter **Name**, **Date added**, **Last modified** (standarden), **Size** og, inne i en mappe, **By tool**. Mapper kommer alltid først. Økter og mapper sorteres hver for seg i sin egen gruppe.
- <!--i:document--> **Legg nytt arbeid rett på plass.** **New asset** åpner den felles velgeren. Velg **Templates** for å starte fra en lagret mal. Åpne malen for å redigere, eller trykk **+ Add** for å lagre et nytt arbeid med en gang.
- <!--i:checklist--> **Flervalg (skrivebord).** Kryss av i en flis, dra en markeringsboks over et tomt område eller **Shift/Cmd-klikk**. For å åpne flisens kontekstmeny, **høyreklikk** på flisen. Valglinjen tilbyr **Render selection**, **Move to…**, **New folder** og **Delete** (til Trash). **Edit together** åpner to til åtte økter med ett verktøy hver side om side under én sidelinje. **Edit as sheet** åpner et utvalg av enhver størrelse eller blanding som rader i batchrutenettet.
- <!--i:download--> **Gjengi en hel mappe eller et helt utvalg.** **Render folder** eksporterer alle lagrede økter i en mappe og undermappene som én `.zip` med mappestruktur. **Render selection** gjør det samme for et flervalg. En enkelt økt gjengis til sin egen fil.
- <!--i:link--> **Hopp rett til et verktøys lagrede arbeid.** Kryss av for ett eller flere verktøy i Tools-galleriet og velg **View sessions** fra valglinjen. Projects viser da bare øktene laget med disse verktøyene. **Clear** henter tilbake hele visningen.
- <!--i:link--> **Del en lagret økt.** Høyreklikk på en økt (på en telefon trykker du **•••** på flisen) og velg **Share link**. Lenken åpner økten på nytt med de samme innstillingene. Bilder fra enheten din følger ikke med i en lenke. For hele Share-dialogen, se [Dele arbeidet ditt](/info/using.html#sharing-your-work).
- <!--i:pentool--> **Gi nytt navn eller kopier.** Den samme menyen har **Rename**, **Duplicate** (en kopi i samme mappe) og **Move to…**.

![View options-popoveren i Projects: Layout med Grid og List, og Sort by satt til Last modified, ved siden av en knapp som snur rekkefølgen](/t/url-shot?url=%2F%23%2Fp&width=900&height=700&dpi=192&waitMs=1400&drive=click%3A.projects-viewopts&cropSelector=.projects-viewmenu&walker=1&format=svg&dark=1&filename=misc-projects-sort)
<!--
SHOT NOTE (misc-projects-sort): trigger button confirmed as
`.filter-fab.projects-viewopts` in views/projects.ts (openViewOpts() is bound
to `.projects-viewopts` specifically) - `.projects-viewopts` alone is the
more specific hook, so that's what drives the click. The popover it opens
(`.projects-viewmenu`, also confirmed directly in openViewOpts()) is body-
appended, not nested under the Projects root, so cropSelector finds it
regardless. "By tool" only appears inside a folder - this recipe captures at
the Projects ROOT (`url=/#/p`), so if the capture pass wants "By tool"
visible too, point url= at a real folder instead: the route is a path
segment, `/#/p/<folderId>` (confirmed in main.ts's hash router - `parts[0]
=== 'p'` reads `folderId` from `parts[1]`), not a query param. Caveat: a
folder has to already EXIST in the capture profile, which a per-shot fresh
context has none of.
The popover (views/projects-view-options.ts, checked 2026-09-26) holds a
Layout pair (Grid / List) and a Sort by menu with a reverse button; the
options inside the menu (Name, Date added, Last modified, Size, By tool) are
not visible in the closed menu, so the alt does not list them.
-->

:::

<!--i:eti-refresh-->
## Hvis du lukket fanen eller forlot verktøyet

Hva som kommer tilbake, avhenger av hvordan du forlot det og av verktøyet:

- **Du lukket fanen eller kom tilbake en annen gang.** Ulagret arbeid er borte, unntatt i [verktøyene som lagrer mens du arbeider](#which-tools-save-as-you-work). Åpne det arbeidet fra **Projects**.
- **Du lastet siden på nytt i samme fane.** Innstillingene dine kommer tilbake fra sideadressen. I verktøy som ikke lagrer mens du arbeider, inneholder ikke adressen bilder og filer fra enheten din eller tekst på én linje som er lengre enn 150 tegn, så disse kommer ikke tilbake.
- **Du trykket Home eller tilbakeknappen øverst til venstre.** Hvis du endret noe siden du sist lagret, lastet ned eller kopierte, spør en **Unsaved edits**-dialog om du vil lagre først. **Save & leave** lagrer arbeidet og tar deg til **Projects**, eller tilbake til prosjektmappen du åpnet arbeidet fra. **Leave anyway** forkaster endringene dine. Et lagret element går tilbake til siste lagring, og et arbeid du aldri lagret, fjernes fra **Projects**. **Cancel** holder deg i verktøyet.

::: warning Fanen lukkes uten å spørre først
Lukking av fanen, ny innlasting og nettleserens egen tilbakeknapp spør aldri. For å være sikker trykker du **Save as**, eller **Save** i eksportpanelet, før du forlater et verktøy.
:::

Når automatisk gjenoppretting ikke er tilgjengelig, sier en merknad ved siden av redigeringskontrollene hva du bør beholde:

- I et verktøy som arbeider med en fil du legger inn, lagrer du innstillingene og beholder originalfilene også.
- I et opptaksverktøy eller et hjelpeverktøy uten Save-handling må du lagre eller laste ned resultatet før du forlater det.
- Skrivebords- og mobilappene sier fra når du må lagre manuelt.
- I et privat samarbeid beholder personen som inviterte, dokumentet og historikken, inkludert den andre personens endringer. Personen som ble med, arbeider på en midlertidig kopi og bør lagre en egen kopi før økten avsluttes.

::: note Forlot du verktøyet uten å lagre ved en feil?
I verktøy som lagrer mens du arbeider, beholder History en kopi av de forkastede endringene i 30 dager. Åpne **History**-siden, finn dem under **Changes** og trykk **Open as a copy**. I andre verktøy er endringene borte.
:::

::: details Hvilke verktøy lagrer mens du arbeider
I nettappen lagrer alle verktøy som lager et dokument, mens du arbeider, for eksempel Lolly Design, Lolly Chart, QR Code, Text og Lolly Sandbox. Disse verktøyene gjør det ikke:

- verktøy som arbeider med en fil du legger inn, for eksempel Redact, Sign eller Convert Image, fordi Lolly aldri beholder en kopi av den filen;
- verktøy som tar opp fra kameraet, mikrofonen eller skjermen, for eksempel Record, Lolly Screen Capture og Lolly Voice Recorder;
- et verktøy uten noe å endre, for eksempel Countdown.

I de andre verktøyene legger den første endringen arbeidet i **Projects** som om du hadde lagret. Senere endringer beholdes når verktøyet er ferdig med å tegne. Et ulagret arbeid blir i Projects etter at du lukker fanen og åpnes på nytt med endringene merket som ulagret.

**Leave anyway** forkaster fortsatt disse endringene. Å åpne verktøyet igjen fra startskjermen starter et nytt arbeid; åpne det tidligere fra Projects.

3D og Lolly Darkroom lagrer mens du arbeider, men beholder ikke en fil du laster inn i dem, for eksempel en 3D-modell eller en LUT. History og **Save** beholder filens navn, type og størrelse, ikke selve filen. Når du åpner arbeidet igjen, sier en merknad hvilken fil det gjelder, og verktøyet fungerer uten filen til du laster den inn igjen. Behold originalfilene dine.

Med [Sync](/info/sync.html) på sendes et arbeid som er lagret på denne måten, til de andre enhetene dine. Versjonene blir på enheten der de ble laget.

Hvis et arbeid er åpent i to faner og du lagrer i begge, beholdes den siste lagringen. Det erstattede arbeidet ligger under **Protected drafts** i arbeidets History, med **Open draft as a copy**.

Dette fungerer bare i nettappen, ikke i skrivebords- eller mobilappene, og ikke mens du arbeider direkte med noen andre.
:::

<!--i:eti-download-->
## Finn en fil du har lastet ned

I en nettleser gir **Download** filen til nettleseren din. Nettleseren lagrer filen i nedlastingsmappen (vanligvis **Downloads**) eller spør deg hvor. Lolly får ikke vite hvor filen havnet, så se i nettleserens liste over nedlastinger.

Hvis ingen fil dukket opp, se i eksportpanelet mens du fortsatt er i verktøyet. Under **Download** viser en linje filnavnet og tidspunktet, med **Retry download**. I Chrome, Edge og andre Chromium-nettlesere tilbyr linjen også **Save file…** for å velge en mappe. Linjen og filen varer til du forlater verktøyet, laster på nytt eller eksporterer igjen.

Lolly beholder også to ting etter hver nedlasting:

- **En kopi av filen**, i **Assets** under **Your uploads**, så lenge **Save my renders to my library** er på under **Settings → Your renders** (**Settings** ligger nederst på startskjermen). Innstillingen er på fra starten. En video eller en fil over 50 MB spør først, og en zip kopieres ikke.
- **Innstillingene du brukte**, for de siste 24 nedlastingene dine. **Recent exports**, under det lagrede arbeidet ditt i **Projects**, åpner verktøyet igjen med disse innstillingene. Bilder og filer du la til fra enheten din, er ikke med. Den samme listen ligger under **Settings → Activity & stats → Latest exports** og på **Changes**-fanen i **History**.

::: details I skrivebords- og mobilappene
- **Skrivebordsapp:** **Download** lagrer i en **Lolly**-mappe inne i **Downloads**-mappen, uten dialog. Linjen under **Download** sier hvor filen havnet, for eksempel "Saved to Downloads/Lolly", med **Show in folder**. **Open Exports Folder**, i **Window**- eller **Exports**-menyen, åpner mappen når som helst. En fil med samme navn som en tidligere fil lagres som "name (1)".
- **iPhone og iPad:** filen lagres i **Files**-appen, under **Lolly**, og delingspanelet åpnes. Linjen under **Download** viser "Saved to Files → Lolly".
- **Android:** delingsmenyen åpnes. Velg hvor filen skal.

På iPhone, iPad og Android erstatter en ny fil en tidligere fil med samme navn.
:::

<!--i:eti-history-->
## Gå tilbake til en tidligere versjon

- **Under dette besøket:** **Undo** går tilbake gjennom de siste 100 endringene dine, til du forlater verktøyet eller laster på nytt. Se [Angre og gjøre om](/info/using.html#undo-and-redo).
- **I [verktøy som lagrer mens du arbeider](#which-tools-save-as-you-work):** tidligere versjoner av hvert arbeid beholdes.
- **Alt på enheten:** med [Sync](/info/sync.html) på henter **Restore an earlier copy**, under **Settings → Connected services**, tilbake én av de siste sju daglige kopiene eller kopien fra før du sist tok i bruk en kopi. Alt på denne enheten samsvarer da med den kopien.

Slik åpner du en tidligere versjon:

1. Trykk **History**, klokkeknappen ved siden av **Undo** og **Redo**. I Lolly Design ligger **History** i toppmenyen. På en telefon trykker du **•••** og deretter **History**. I verktøy uten **Undo**, som Text og Lolly Sandbox, ligger **History** ved siden av **Home** øverst til venstre.
2. Finn versjonen etter dato og klokkeslett. Rader merket **Automatic checkpoint** opprettes mens du arbeider; rader merket **Saved version** er gangene du lagret.
3. Trykk **Open as a copy**. Versjonen åpnes som et nytt arbeid, og det du hadde åpent, blir som det var. Kopien ligger i **Projects**, med "(copy)" etter navnet.

For å beholde en versjon med navn trykker du **Name version**, skriver et navn og trykker **Keep milestone**. Navngitte versjoner vises på **History**-siden, under **Milestones**.

::: details History-panelet og History-siden
**History**-panelet viser også **Recovered work**-rader, og **Protected drafts** holder de siste endringene dine mellom sjekkpunkter, med **Open draft as a copy**. **Lolly Compare** og **Check assets** hjelper deg å velge før du åpner en kopi. Bytt **This creation** til **All history on this device** for å se alle arbeidene.

Automatiske sjekkpunkter blir færre med alderen: ett i minuttet for den siste timen, ett i timen for det siste døgnet, ett om dagen i 30 dager og deretter ett i uken. Alle lagrede og navngitte versjoner beholdes. Når et arbeid slettes, flyttes også versjonene til **Trash**, og **Delete forever** fjerner dem.

Når History-lagringen blir full, fjernes de eldste automatiske sjekkpunktene for arbeider du ikke har åpnet på 30 dager, først. Selv da beholdes alltid en lagring. Den skrives som gjeldende arbeid, og History sier at denne lagringen ikke beholdes som en versjon. **Settings → Storage** viser hvor mye plass History bruker.

**History**-siden (`#/history`) dekker alle arbeidene i denne nettleseren. For å åpne siden trykker du klokkeknappen øverst til høyre på startskjermen eller i **Projects**, velger **Saved sessions** i profilmenyen (på en telefon, den runde logoknappen øverst til høyre) eller trykker **Open app history** i History-panelet til et verktøy. Skrivebords- og mobilappene har ingen History-side. Der åpner klokkeknappen på startskjermen og **Saved sessions** visningen **Your recent work**: de siste lagrede øktene og eksportene dine, med en lenke til Projects.

- **Recent** viser arbeidene dine, nyeste først, med **Resume**.
- **Changes** legger sjekkpunkter, nedlastinger og Convert-resultater på én tidslinje. En nedlasting har **Reopen settings**.
- **Milestones** viser navngitte versjoner.

Hvert arbeid er en flis med sitt bilde. **Grid** eller **List** bytter layout. Filtrer etter prosjekt, verktøy og dato (bak **Filters** på en telefon). Flisens meny (høyreklikk eller langt trykk) tilbyr **Resume**, **Versions**, **Show in Projects** og **Move to Trash**. For å fjerne flere velger du dem og deretter **Move to Trash**, som tilbyr Undo.
:::

<!--i:eti-folder-move-->
## Flytt arbeidet ditt til en annen enhet

| For å | Bruk |
|---|---|
| Holde enhetene dine synkronisert | **Sync across devices**, under **Settings → Connected services**: se [Synkroniser enhetene dine](/info/sync.html) |
| Flytte alt én gang | **Export my data** og **Import data…**, nedenfor |
| Overlevere ett design eller ett prosjekt | En `.lolly`-fil: **Export**, deretter **Share**, deretter **Download .lolly**; for et helt prosjekt, **Download project (.lolly)** i mappens meny. Trykk **Open** på den andre enheten. Se [.lolly-filen](/info/using.html#the-lolly-file) |

En delingslenke tar med innstillingene dine, men ikke bilder eller filer du la til fra enheten din.

::: note Import legger til, men sletter ingenting
Mapper, favoritter og maler i filen legges til dem som allerede finnes på den andre enheten. Når et lagret element finnes begge steder, beholdes den sist lagrede kopien. Opplysningene og innstillingene dine på den enheten blir som de er. Tomme verdier fylles inn fra filen. **Bring it to this device**, i Sync, fungerer på samme måte.
:::

Slik flytter du alt én gang:

1. På den gamle enheten åpner du **Settings → Storage** og trykker **Export my data** under **Move to another device**. Lolly laster ned én `.zip`-fil med et navn som begynner med `LollyTools-`.
2. Flytt filen over med USB, e-post til deg selv, AirDrop eller en delt mappe.
3. På den nye enheten åpner du **Settings → Storage**, trykker **Import data…**, velger filen og trykker **Import**.

::: note Hva som blir igjen
Innlogginger, nøkler og synkroniseringspassfrasen blir på hver enhet. Listen over nylige nedlastinger, nedlastinger for bruk uten nett og KI-modeller overføres ikke på noen måte. Versjonshistorikk overføres bare i en **Export my data**-fil, ikke gjennom Sync eller en `.lolly`. Når historikken er for stor for én fil, utelates de eldste automatiske sjekkpunktene, og eksportlinjen sier hvor mange. Du kan laste ned og åpne en kopi som Sync beholder i lagringen din, eller velge kopien i **Import data…**, som en sikkerhetskopifil. En kryptert kopi ber om passfrasen din.
:::

::: details Hva sikkerhetskopifilen inneholder
Filen heter `LollyTools-<First>-<Last>-<YYYY-MM-DD>-<n>.zip`. Navnedelene kommer fra profilen din og utelates hvis de ikke er angitt. `<n>` teller eksportene gjort samme dag. Den inneholder profilen din, med mapper, Trash, maler og favoritter; hver lagrede økt med miniatyrbildet sitt; opplastede bilder, skrifter, logoer og kopiene av nedlastingene dine; designsystemene dine; innstillingene dine (tema, bredde på sidelinjen, lokal aktivitetsstatistikk); lagrede versjoner og resultater fra Convert; og, fra nettappen, versjonshistorikken til arbeidene dine.

Katalogens hurtigbuffer er ikke med. Den nye enheten laster ned hurtigbufferen på nytt. Hver del har en kontrollsum, så importen oppdager en fil som er skadet under overføring. Lagrede økter kobles til de importerte bildene dine igjen. Nett-, skrivebords- og mobilappene leser den samme filen. Terminalappen skriver en enklere sikkerhetskopi av sin egen type, som dette formatet ikke leser. **Export my data & render everything** lager den samme filen pluss en ekstra zip med hver lagrede økt gjengitt til sitt utdataformat. Hele formatet er beskrevet i [Dataoverføring](/info/data-transfer.html).
:::

<!--i:eti-globe-->
## Hvis du sletter nettleserdataene dine

I nettappen beholder Lolly alt i nettleserens lagring for dette nettstedet: lagret arbeid, bilder, skrifter, designsystemer, versjonshistorikk og nedlastinger for bruk uten nett. Sletting av dette nettstedets data i nettleseren fjerner alt dette, og Lolly kan ikke hente noe av det tilbake. Det som gjenstår, er det som allerede har forlatt nettleseren: filer du har lastet ned, en **Export my data**-fil, en [Sync](/info/sync.html)-kopi og lenker du har delt.

::: warning Før du sletter nettleserdata
Trykk **Export my data** under **Settings → Storage** og oppbevar filen et annet sted.
:::

Når appen starter, ber Lolly nettleseren om ikke å slette lagringen når enheten får lite ledig plass, og nettleseren avgjør. Under **Settings → Available offline** betyr en linje som begynner med **Protected**, at nettleseren har godtatt det. "The browser may clear downloads if the device runs low on space" betyr at den ikke gjorde det, og **Protect downloads** spør igjen.

Hvis nettleseren ikke godtok det, kan den slette både lagret arbeid og nedlastinger når det blir lite plass, så behold en fersk **Export my data**-fil.

**Settings → Storage** viser hvor mye plass hver datatype bruker. **History**-raden teller automatiske sjekkpunkter, forhåndsvisningene deres og gjenopprettingsutkast. **Remove automatic checkpoints older than 30 days** frigjør den plassen og beholder lagrede og navngitte versjoner. **Clear cache** fjerner nedlastede katalogfiler, som lastes ned igjen ved behov. **Clear all my data** ber deg skrive et ord, slår av Sync og fjerner deretter alt Lolly beholder i denne nettleseren: profilen og innstillingene dine, lagrede økter med historikken og Trash, opplastinger, skrifter og designsystemer, nedlastingsloggen, Convert-resultater, nedlastede KI-modeller og kopier for bruk uten nett. Filer du har lastet ned, blir der du lagret dem. Appen starter deretter som ved første besøk.

![Lagringskortet på en skjerm med telefonbredde: hver kategori av data på enheten er navngitt, med Clear all my data-knappen nederst](/t/url-shot?url=%2F%23%2Fprofile%3Ffocus%3Dstorage-section&width=430&height=1600&dpi=192&waitMs=2400&css=.welcome-dialog%2C.personalize-nudge%2C.store-selbar%2C.profile-row-value%2C.profile-group-value%2C%23store-hero-num%2C%23store-headroom%7Bdisplay%3Anone%7D&format=svg&waitSelector=%5Bdata-store-group%3Dmove%5D&drive=click%3A%5Bdata-store-group%3Dwork%5D%3Esummary%3Bclick%3A%5Bdata-store-group%3Dcaches%5D%3Esummary&walker=1&cropSelector=%23storage-section&dark=1&filename=pv-storage-clear)

I skrivebords- og mobilappene er lagrede økter filer i appens egen datamappe, og alt annet er i appens egen lagring. Sletting av data i en nettleser berører ikke disse.

::: details Hvor skrivebords- og mobilappene lagrer økter
Én fil per lagrede økt, i en `saved-state`-mappe:

- macOS: `~/Library/Application Support/tools.lolly.Desktop/saved-state/`
- Windows: `%APPDATA%\tools.lolly.Desktop\saved-state\`
- Linux: `~/.local/share/tools.lolly.Desktop/saved-state/`, eller samme bane under `$XDG_DATA_HOME`
- iPhone, iPad og Android: i appens egen lagring, som Files-appen ikke viser

Bilder, designsystemer og listen over nylige nedlastinger blir i appens interne lagring, ikke i disse mappene. Terminalappen og kommandolinjen leser den samme `saved-state`-mappen: se [Hvor lagrede økter ligger](/info/cli-reference.html#where-saved-sessions-live).
:::

<!--i:eti-trash-->
## Få tilbake noe du har slettet

Når du sletter en lagret økt, en mappe, en av opplastingene dine eller en av skriftene dine i appen, flyttes den til **Trash** i 30 dager, uansett hvor du sletter den: **Projects**, **Assets**, **Settings → Storage** eller et verktøys liste over lagrede økter. En mappe og alt i mappen går til Trash som én oppføring. En økt beholder versjonshistorikken i Trash. Rett etter sletting tilbyr en melding **Undo**. Senere:

1. Åpne **Trash**: **Trash**-flisen i **Projects**, **Trash**-knappen i **Assets → Your uploads** eller **Trash**-raden i **Settings → Storage**. Alle tre åpner den samme listen.
2. Trykk **Restore** ved siden av elementet. Det går tilbake til mappen sin, og en skrift får tilbake rollene den hadde i designsystemet.

**Delete forever** fjerner ett element for godt. **Empty Trash** spør først og fjerner deretter alle elementene i Trash. Elementer eldre enn 30 dager fjernes for godt.

::: warning Noe slettes med en gang
Når du sletter et designsystem, en logo eller profilbildet ditt, går det ikke til Trash. Kommandolinjen og terminalappen sletter også med en gang.
:::

Med [Sync](/info/sync.html) på kan **Restore an earlier copy** hente tilbake hele enhetens tilstand fra en tidligere dag, og en **Export my data**-fil henter tilbake det filen inneholder.
