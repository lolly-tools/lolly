# Guida rapida

Lolly trasforma le tue regole - colori, tipografia, layout, logica - in strumenti che chiunque può usare per creare file finiti: immagini, PDF, card per i social, video, compilando pochi campi. C'è poco da imparare e niente da caricare: creazione ed esportazione girano sul tuo dispositivo, online o offline.

Questa è la prima pagina da leggere. Due cose ti rendono operativo: **rendi Lolly tuo** e **porta con te quello che hai già** (i tuoi file di design e i tuoi token). Tutto il resto è a un link di distanza.

> Sei nuovo di Lolly e vuoi solo creare qualcosa? [Crea qualcosa in 60 secondi](/info/make-something.html) te ne fa creare tre, oppure [apri l'app](/#/), scegli uno strumento qualsiasi dalla galleria, compila i campi e premi **Esporta**. Torna qui quando vorrai che indossi *il tuo* brand.

![La vista Utility - i cavalli di battaglia che lavorano sul dispositivo, come Rimuovi dati nascosti, Comprimi PDF e Converti immagine, tutti in un unico posto](/t/url-shot?url=%2F%23%2Fu&width=1440&height=900&dpi=192&waitMs=1600&css=.welcome-dialog%2C.personalize-nudge%7Bdisplay%3Anone!important%7D&tolerance=0.03&format=svg&walker=1&dark=1&filename=use-utilities&try=1)

## 1. Rendilo tuo - configura il tuo sistema di design

Il tuo brand in Lolly è un piccolo documento di **design token** - colori, font e poche regole - su cui ogni strumento esegue il rendering. Impostalo una volta e tutto ciò che crei è coerente con il brand per costruzione, non per revisione. Ci sono tre strade per iniziare; scegli quella che corrisponde a dove vive già il tuo brand.

### Parti da zero (il costruttore del sistema di design)

Al primo avvio atterri sulla **galleria**, con sopra una breve finestra di benvenuto che offre tre strade - **Rendilo tuo** (il Brand Studio su `#/start`), **Porta il tuo design** (trascina un file Figma, Penpot, InDesign o PDF e si apre come layout modificabile - la via più rapida verso [Porta con te quello che hai già](#2-bring-in-what-you-already-have) qui sotto) e **Esplora gli strumenti della community** - più una riga di lingue se l'inglese non è la tua. Scegli la prima scheda e arrivi nel [**Brand Studio**](/info/brand-studio.html). Dagli un nome e un colore primario e Lolly ne *deriva* una palette completa e accessibile - superfici chiare/scure, testo, accenti - usando la stessa matematica del colore che il motore usa ovunque.

![La stanza Colori del Brand Studio - un colore primario e la palette accessibile che Lolly ne deriva](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor&width=1440&height=740&dpi=192&waitMs=1800&format=svg&walker=1&localize=1&dark=1&filename=brand-colours) Scegli un font e hai un brand funzionante in meno di un minuto. Da lì le sei stanze dello studio - Panoramica, Colori, Tipografia, Loghi, Token, File - ti lasciano spingerti quanto vuoi, in qualsiasi ordine, perfezionando ogni dettaglio ogni volta che torni. La scheda **Sistema di design** della dashboard (`#/d`) mostra il risultato in sola lettura e rimanda a `#/start`, dove avviene la modifica (a meno che tu non sia su una build di Lolly con brand bloccato, dove il brand è fisso e non c'è nulla da cambiare).

### Importa un brand che hai già

Se il tuo brand è già catturato come design token - da **Penpot**, **Tokens Studio** (Figma) o un qualsiasi file **DTCG** semplice - importalo in blocco invece di reinserirlo a mano. Due percorsi:

- <!--i:palette--> **Nell'app:** il [costruttore del sistema di design: Brand Studio](/info/brand-studio.html) (`#/start`) lo accetta tramite **Aggiungi da…** in fondo alla barra delle stanze - un file di token, un'esportazione Penpot, un SVG o un pacchetto `LollyBrand`. Trascinalo dentro e la palette si accende.
- <!--i:code--> **Dalla riga di comando**, per creare un pacchetto di brand riutilizzabile:

```bash
# a monolithic tokens.json, a one-file-per-set directory, or a Penpot project archive
npm run ingest:brand -- ./my-tokens.json --name acme --label "Acme" --activate
```

`ingest:brand` accetta tutti e tre i contenitori in cui Penpot / Tokens Studio esportano lo stesso documento - un singolo `tokens.json`, una cartella (`$metadata.json` + file per ogni set) o un archivio `project.penpot`. Con `--activate` registra il brand come profilo, vi passa e ricostruisce il catalogo. Consulta [Configurazione](/info/configuration.html) per capire come si combinano pacchetti di brand e profili.

### Perfezionalo nell'app

Una volta che un brand è attivo, continua a modellarlo nel [**Brand Studio**](/info/brand-studio.html) (`#/start`) - cambia un colore o un ruolo e ogni anteprima dell'app si aggiorna mentre scrivi. (La scheda **Sistema di design** della dashboard su `#/d` *mostra* il brand in sola lettura; è nello Studio che lo modifichi.)

![La scheda Sistema di design della dashboard - il brand attivo mostrato in sola lettura](/t/url-shot?url=%2F%23%2Fd%3Ftab%3Dbrand&width=1440&height=900&dpi=192&waitMs=1800&format=svg&walker=1&localize=1&dark=1&filename=dashboard-brand) Lo stesso brand è riassunto nella scheda **Profilo → Il tuo brand**. I font sono reali: scegli da Google Fonts e Lolly salva il file **sul tuo dispositivo** come asset di brand, così la tua tipografia viaggia offline e non viene scaricato nulla al momento del rendering.

Quando sei soddisfatto, **esporta il brand come pacchetto `LollyBrand`** - un unico file che un collega può importare per ottenere esattamente la stessa palette, gli stessi font e le stesse regole. È così che un brand si sposta tra persone e macchine senza un server in mezzo.

> **I token di brand vanno e vengono in entrambe le direzioni.** Poiché il brand di Lolly *è* token DTCG - il formato che Penpot legge e scrive in modo nativo e che Tokens Studio porta in Figma - la palette con cui *progetti* e la palette che Lolly *applica* sono un unico documento, non due liste che tieni sincronizzate a mano. Consulta [Design Token](/info/design-tokens.html).

## 2. Porta con te quello che hai già

Non parti da una pagina bianca. Lolly apre il lavoro di design e i formati aperti che possiedi già.

### File di design open source

Il lavoro finito in **Figma, Penpot, Illustrator, InDesign o qualsiasi app SVG** non deve restare chiuso nell'app in cui l'hai disegnato. Apri **Design**, fai clic su **Importa un design** e il file si apre come un *layout vivo* - non un'immagine appiattita. Ogni livello diventa un riquadro modificabile: il testo resta riscrivibile, le forme restano forme, le immagini finiscono nella tua libreria e la grafica vettoriale complessa viene preservata fedelmente. Arriva già conforme ai font e alle regole di colore del tuo brand.

| Se hai | Importalo come |
|---|---|
| Un frame di Figma | `.fig` nativo (File → Salva copia locale), oppure un'esportazione SVG |
| Un design di Penpot | La sua esportazione `.penpot`, o un qualsiasi SVG |
| Un file di Illustrator | `.ai` nativo (compatibile PDF) o `.pdf` - si apre direttamente |
| Un layout di InDesign | `.idml` (File → Esporta → InDesign Markup) |
| Qualsiasi altra cosa | **Un qualsiasi SVG** - la porta universale |

L'intera importazione avviene **sul tuo dispositivo** - il file viene analizzato nel tuo browser e non viene caricato nulla. I dettagli completi, e cosa esattamente viene mantenuto, sono in [Importare un design](/info/design-import.html).

Hai invece una **presentazione PowerPoint**? Trascina il `.pptx` su **Creatore di deck** per modificarla diapositiva per diapositiva, già allineata al tuo brand - oppure usa **Rebrand di una presentazione** per riavere la stessa presentazione ritematizzata, con grafici e animazioni intatti.

### Da un progetto singolo a un template

Ecco il vantaggio: un layout importato è una normale sessione di Design, quindi appena lo **salvi** vive a un URL. Chiunque abbia Lolly può aprire quell'URL, cambiare le parole, sostituire un'immagine e renderizzare la propria versione - senza app di design, e le parti bloccate restano bloccate. Un design creato una volta diventa uno strumento riutilizzabile. Questa è tutta l'idea, raggiunta senza scrivere una riga di configurazione.

### Dati aperti e strumenti aperti

Il [set di strumenti della community](/info/builders.html) è open source e agnostico rispetto al brand - codici QR, mappe stradali, filtri, utilità per la privacy - e renderizza sul *tuo* brand nel momento in cui lo attivi.

Alimenta gli strumenti anche con i tuoi dati aperti: incolla o trascina una tabella **CSV** o **JSON** e i campi ripetibili di uno strumento si compilano da essa, un asset finito per riga.

## 3. Crea qualcosa, poi condividilo o automatizzalo

Con un brand attivo e il tuo materiale a portata di mano, ogni strumento produce un file finito:

- <!--i:download--> **Renderizza** qualsiasi strumento in **SVG, PDF, PNG, JPG, WebP, video** e altro ancora - a dimensioni di stampa reali e in unità fisiche quando ti servono. Consulta [Esportazione e formati](/info/exporting.html).
- <!--i:link--> **Condividi un link.** Ogni stato di uno strumento è un URL, quindi un asset finito è riproducibile e indirizzabile per parametri - salva il link, rigeneralo quando vuoi.
- <!--i:layers--> **Fallo in massa.** Guida un template da un foglio di calcolo nella [griglia batch](/info/exporting.html): un asset finito per riga.
- <!--i:cpu--> **Automatizzalo.** Lo stesso rendering funziona dalla [CLI](/info/cli.html) e da un [agente IA](/info/ai-agents.html) - un URL è l'API.

"Un URL è l'API" va preso alla lettera. Il grafico qui sotto non l'ha disegnato nessuno: il suo tipo, il suo titolo e tutta la sua tabella di dati sono stati scritti nella barra degli indirizzi, e lo stesso link renderizza lo stesso grafico su qualsiasi dispositivo.

![Un grafico ad area delle iscrizioni mensili, i cui valori sono arrivati tutti come parametro di query anziché con un clic](/t/url-shot?url=%2F%23%2Ftool%2Fchart%3Fct%3Darea%26d%3DMonth%2CSignups%250AJan%2C120%250AFeb%2C180%250AMar%2C265%250AApr%2C340%250AMay%2C455%26t%3DSignups%2520this%2520year%26full&width=1440&height=900&dpi=192&waitMs=2600&cropSelector=%23tool-canvas&walker=1&format=svg&dark=1&filename=vt-d3-url-chart)

## Dove andare adesso

Tre percorsi, a seconda di cosa sei venuto a fare:

- <!--i:people--> **[Lolly per i creatori](/info/creators.html)** - crei cose. I vantaggi, e come ottenere il massimo dall'app.
- <!--i:code--> **[Lolly per gli sviluppatori](/info/builders.html)** - crei strumenti, integri e distribuisci. La documentazione tecnica.
- <!--i:shieldcheck--> **[Lolly per gli operatori](/info/operators.html)** - sei responsabile del brand, della sicurezza e della diffusione in un'organizzazione.
