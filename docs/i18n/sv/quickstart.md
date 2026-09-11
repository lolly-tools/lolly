# Snabbstart

Lolly gör dina regler - färger, typografi, layouter, logik - till verktyg som vem som helst kan använda för att skapa färdiga filer: bilder, PDF:er, sociala kort, video, genom att fylla i några fält. Det finns lite att lära sig och inget att ladda upp: att skapa och exportera sker på din enhet, online eller offline.

Det här är sidan du bör läsa först. Två saker gör dig produktiv: **gör Lolly till din** och **ta in det du redan har** (dina designfiler och tokens). Allt annat är en länk bort.

> Ny på Lolly och vill bara skapa något? [Skapa något på 60 sekunder](/info/make-something.html) går igenom tre stycken, eller [öppna appen](/#/), välj valfritt verktyg från galleriet, fyll i fälten och tryck på **Exportera**. Kom tillbaka hit när du vill att det ska bära *ditt* varumärke.

![Verktygsvyn - arbetshästarna som körs på enheten, som Ta bort dold data, Komprimera PDF och Konvertera bild, samlade på ett ställe](/t/url-shot?url=%2F%23%2Fu&width=1440&height=900&dpi=192&waitMs=1600&css=.welcome-dialog%2C.personalize-nudge%7Bdisplay%3Anone!important%7D&tolerance=0.03&format=svg&walker=1&dark=1&filename=use-utilities&try=1)

## 1. Gör den till din - konfigurera ditt designsystem

Ditt varumärke i Lolly är ett litet **designtokens**-dokument - färger, typsnitt och några regler - som varje verktyg renderar mot. Ställ in det en gång så blir allt du skapar varumärkesriktigt per konstruktion, inte via granskning. Det finns tre sätt in; välj det som matchar var ditt varumärke redan finns.

### Börja från noll (designsystembyggaren)

Första körningen släpper av dig i **galleriet**, med en kort välkomstdialog över det som erbjuder tre vägar in - **Gör den till din** (Brand Studio på `#/start`), **Ta med din design** (släpp en Figma-, Penpot-, InDesign- eller PDF-fil så öppnas den som en redigerbar layout - snabbaste vägen till [Ta in det du redan har](#2-bring-in-what-you-already-have) nedan) och **Utforska community-verktygen** - plus en rad med språk om engelska inte är ditt. Ta det första kortet så landar du i [**Brand Studio**](/info/brand-studio.html). Ge det ett namn och en primärfärg så *härleder* Lolly en komplett, tillgänglig palett från den - ljusa/mörka ytor, text, accenter - med samma färgmatematik som motorn använder överallt annars.

![Brand Studios rum Färger - en primärfärg, och den tillgängliga palett Lolly härleder från den](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor&width=1440&height=740&dpi=192&waitMs=1800&format=svg&walker=1&localize=1&dark=1&filename=brand-colours) Välj ett typsnitt, så har du ett fungerande varumärke på under en minut. Därifrån låter studions sex rum - Översikt, Färger, Typografi, Logotyper, Tokens, Filer - dig ta det så långt du vill, i valfri ordning, och förfina vad som helst när du kommer tillbaka. Instrumentpanelens flik **Designsystem** (`#/d`) visar resultatet skrivskyddat och pekar tillbaka till `#/start`, där redigeringen sker (om du inte kör en varumärkeslåst version av Lolly, där varumärket är fast och det inte finns något att ändra).

### Importera ett varumärke du redan har

Om ditt varumärke redan är fångat som designtokens - från **Penpot**, **Tokens Studio** (Figma) eller en vanlig **DTCG**-fil - ta in det i sin helhet i stället för att skriva om det. Två vägar:

- <!--i:palette--> **I appen:** [designsystembyggaren: Brand Studio](/info/brand-studio.html) (`#/start`) tar emot det via **Lägg till från…** längst ned i rumsraden - en tokenfil, en Penpot-export, en SVG eller ett `LollyBrand`-paket. Släpp in det så tänds paletten upp.
- <!--i:code--> **Från kommandoraden**, för att sätta upp ett återanvändbart varumärkespaket:

```bash
# a monolithic tokens.json, a one-file-per-set directory, or a Penpot project archive
npm run ingest:brand -- ./my-tokens.json --name acme --label "Acme" --activate
```

`ingest:brand` tar emot alla tre behållare som Penpot / Tokens Studio exporterar samma dokument i - en enda `tokens.json`, en katalog (`$metadata.json` + filer per set) eller ett `project.penpot`-arkiv. Med `--activate` registreras varumärket som en profil, växlar till den och bygger om katalogen. Se [Konfiguration](/info/configuration.html) för hur varumärkespaket och profiler hänger ihop.

### Finjustera i appen

När ett varumärke är aktivt fortsätter du forma det i [**Brand Studio**](/info/brand-studio.html) (`#/start`) - ändra en färg eller en roll och varje förhandsvisning i appen uppdateras medan du skriver. (Instrumentpanelens flik **Designsystem** på `#/d` *visar* varumärket skrivskyddat; i studion redigerar du det.)

![Instrumentpanelens flik Designsystem - det aktiva varumärket visat skrivskyddat](/t/url-shot?url=%2F%23%2Fd%3Ftab%3Dbrand&width=1440&height=900&dpi=192&waitMs=1800&format=svg&walker=1&localize=1&dark=1&filename=dashboard-brand) Samma varumärke sammanfattas på kortet **Profil → Ditt varumärke**. Typsnitt är riktiga: välj från Google Fonts så lagrar Lolly filen **på din enhet** som en varumärkesresurs, så din typografi följer med offline och inget hämtas vid rendering.

När du är nöjd, **exportera varumärket som ett `LollyBrand`-paket** - en enda fil som en kollega kan importera för att få exakt samma palett, typsnitt och regler. Så förflyttas ett varumärke mellan människor och maskiner utan en server i mitten.

> **Varumärkestokens går åt båda hållen.** Eftersom Lollys varumärke *är* DTCG-tokens - formatet som Penpot läser och skriver nativt och som Tokens Studio tar med till Figma - är paletten du designar *med* och paletten Lolly *upprätthåller* ett och samma dokument, inte två listor du synkar för hand. Se [Designtokens](/info/design-tokens.html).

## 2. Ta in det du redan har

Du börjar inte på ett tomt blad. Lolly öppnar designarbetet och de öppna format du redan äger.

### Designfiler med öppen källkod

Färdigt arbete i **Figma, Penpot, Illustrator, InDesign eller vilken SVG-app som helst** behöver inte förbli inlåst i appen du ritade det i. Öppna **Design**, klicka på **Importera en design**, och filen öppnas som en *levande layout* - inte en plattad bild. Varje lager blir en redigerbar ruta: text går att skriva om, former förblir former, bilder hamnar i ditt bibliotek och komplex vektorgrafik bevaras troget. Den anländer redan anpassad till dina varumärkestypsnitt och färgregler.

| Du har | Ta in det som |
|---|---|
| En Figma-ram | Nativ `.fig` (Arkiv → Spara lokal kopia), eller en SVG-export |
| En Penpot-design | Dess `.penpot`-export, eller valfri SVG |
| En Illustrator-fil | Nativ `.ai` (PDF-kompatibel) eller `.pdf` - öppnas direkt |
| En InDesign-layout | `.idml` (Arkiv → Exportera → InDesign Markup) |
| Något annat | **Valfri SVG** - den universella ingången |

Hela importen sker **på din enhet** - filen tolkas i din webbläsare och inget laddas upp. Fullständiga detaljer, och exakt vad som följer med, finns i [Importera en design](/info/design-import.html).

Har du en **PowerPoint-presentation** i stället? Släpp `.pptx`-filen på **Bildspelsbyggare** för att redigera den bild för bild, redan anpassad till ditt varumärke - eller kör **Ombranda en presentation** för att få tillbaka samma presentation omtemad, med diagram och animationer intakta.

### Från engångsjobb till mall

Här är vinsten: en importerad layout är en vanlig Design-session, så när du **sparar** den lever den på en URL. Vem som helst med Lolly kan öppna den URL:en, ändra texten, byta ut en bild och rendera sin egen version - ingen designapp behövs, och de låsta delarna förblir låsta. En engångsdesign blir ett återanvändbart verktyg. Det är hela idén, uppnådd utan att skriva en enda rad konfiguration.

### Öppen data och öppna verktyg

[Community-verktygssamlingen](/info/builders.html) är öppen källkod och varumärkesoberoende - QR-koder, stadskartor, filter, integritetsverktyg - och den renderar mot *ditt* varumärke i samma stund du aktiverar det.

Mata verktygen med din egen öppna data också: klistra in eller släpp en **CSV**- eller **JSON**-tabell så fylls ett verktygs repeterande fält från den, en färdig tillgång per rad.

## 3. Skapa något, dela eller automatisera det sedan

Med ett aktivt varumärke och ditt material i handen skapar varje verktyg en färdig fil:

- <!--i:download--> **Rendera** vilket verktyg som helst till **SVG, PDF, PNG, JPG, WebP, video** och mer - i verkliga tryckstorlekar och fysiska enheter när du behöver det. Se [Export och format](/info/exporting.html).
- <!--i:link--> **Dela en länk.** Varje verktygstillstånd är en URL, så en färdig tillgång är reproducerbar och parameteradresserbar - spara länken, återskapa vid behov.
- <!--i:layers--> **Gör det i bulk.** Driv en mall från ett kalkylblad i [batch-rutnätet](/info/exporting.html): en färdig tillgång per rad.
- <!--i:cpu--> **Automatisera det.** Samma rendering körs från [CLI](/info/cli.html) och från en [AI-agent](/info/ai-agents.html) - en URL är API:et.

"En URL är API:et" är bokstavligt menat. Diagrammet nedan har ingen ritat: dess typ, dess rubrik och hela datatabellen skrevs in i adressfältet, och samma länk renderar samma diagram på vilken enhet som helst.

![Ett ytdiagram över månatliga registreringar, där varje värde kom in som en frågeparameter istället för ett klick](/t/url-shot?url=%2F%23%2Ftool%2Fchart%3Fct%3Darea%26d%3DMonth%2CSignups%250AJan%2C120%250AFeb%2C180%250AMar%2C265%250AApr%2C340%250AMay%2C455%26t%3DSignups%2520this%2520year%26full&width=1440&height=900&dpi=192&waitMs=2600&cropSelector=%23tool-canvas&walker=1&format=svg&dark=1&filename=vt-d3-url-chart)

## Vart du ska gå härnäst

Tre spår, beroende på vad du är här för att göra:

- <!--i:people--> **[Lolly för skapare](/info/creators.html)** - du skapar saker. Fördelarna, och hur du får ut det mesta av appen.
- <!--i:code--> **[Lolly för utvecklare](/info/builders.html)** - du skapar verktyg, integrerar och driftsätter. Den tekniska dokumentationen.
- <!--i:shieldcheck--> **[Lolly för operatörer](/info/operators.html)** - du ansvarar för varumärke, säkerhet och utrullning inom en organisation.
