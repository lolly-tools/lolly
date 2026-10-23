# Inizia

Alla fine di questa pagina i tuoi strumenti useranno i tuoi colori e i tuoi font, e il lavoro che hai già sarà pronto da riutilizzare. Non serve un account, e creare ed esportare avviene sul tuo dispositivo.

::: timeline
- <!--i:sparkle--> **Crea un file.** [Crea il tuo primo file](/info/make-something.html) ti guida a creare un codice QR in pochi minuti.
- <!--i:palette--> **Inserisci il tuo brand.** Parti da un colore, da un file di token o da un design finito.
- <!--i:layers--> **Crea altri file uguali.** Condividi un link, compila un foglio di calcolo o esegui lo strumento da uno script.
:::

Nuovo all'idea stessa? [Che cos'è Lolly?](/info/what-is-lolly.html) è l'introduzione di cinque minuti, e [Come funziona Lolly](/info/how-lolly-works.html) mostra chi fa cosa.

## Inserisci il tuo brand

lolly.tools si apre in **Lolly Demo**, il design system di esempio di Lolly; [Meet Lolly Demo](/info/lolly-demo.html) mostra cosa stai guardando. Il tuo design system lo sostituisce: un piccolo insieme di design token, cioè colori, font e poche regole, con cui disegna ogni strumento. Impostalo una volta e tutto ciò che crei parte già in linea con il brand.

Scegli il percorso che corrisponde a ciò che hai:

- <!--i:palette--> **Un colore.** Apri **Design System Setup** (`#/start`), dai un nome al tuo design system e scegli un colore primario. Lolly ne ricava una palette completa e accessibile, con superfici chiare e scure, testo e accenti. Scegli un font e hai un brand funzionante.
- <!--i:upload--> **Un file di token.** **Add from…**, in fondo alla barra delle stanze di Design System Setup, accetta un file di token DTCG, Tokens Studio o Penpot, un SVG o un pacchetto `LollyBrand`. Trascinalo dentro e la palette si compila. Finché il design system è ancora vuoto, **Start from a reference** nella stanza Overview apre lo stesso selettore.
- <!--i:pentool--> **Un design finito.** In Design, scegli **Import a design** e trascina un file `.fig`, `.penpot`, `.ai`, `.idml` o SVG. Vedi [Porta ciò che hai già](#bring-in-what-you-already-have) più sotto.

La prima volta che apri la galleria, un breve benvenuto offre le stesse scelte: **Make it yours** apre Design System Setup, **Bring your design** apre un selettore di file per un design e **Explore the community tools** chiude il benvenuto.

![La stanza Colours di Design System Setup su un'installazione nuova: un chip live, un campo e tutta la prima decisione](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor&width=1440&height=740&dpi=192&waitMs=1800&format=svg&walker=1&localize=1&dark=1&filename=brand-colours)

Da lì, sette stanze portano la configurazione fin dove vuoi, in qualsiasi ordine: **Overview**, **Colours**, **Type**, **Logos**, **Tokens**, **Files** e **Usage & rules**. Ogni anteprima nell'app si aggiorna mentre scrivi. [Design System Setup](/info/brand-studio.html) descrive ogni stanza.

I font restano sul tuo dispositivo. Scegli un Google Font e Lolly salva il file come risorsa del brand, così la tua tipografia viaggia offline e nulla viene scaricato quando uno strumento disegna.

### Vedere, cambiare e condividere un design system

- **Vedere quello attivo.** **Settings → Design system** mostra il design system attivo come copertina e pagine, in sola lettura.
- **Passare da uno all'altro.** **Settings → Preferences → Design systems** elenca ogni design system presente su questo dispositivo. Un'organizzazione può gestire più design system, o uno con più colourway; [Brand architectures](/info/brand-architectures.html) mappa le configurazioni.
- **Condividerne uno.** Esporta il design system come pacchetto `LollyBrand`: un unico file che un collega importa per ottenere la stessa palette, gli stessi font e le stesse regole.

Un design system fornito dalla tua build o dalla tua organizzazione è **managed**: mostra un lucchetto e resta in sola lettura. Per modificarne uno, crea una copia modificabile da **Settings → Preferences → Design systems**.

![La scheda Design system nelle Impostazioni: il design system attivo come copertina e pagine](/t/url-shot?url=%2F%23%2Fd%3Ftab%3Dbrand&width=1440&height=900&dpi=192&waitMs=1800&format=svg&walker=1&localize=1&dark=1&filename=dashboard-brand&waitSelector=%5Bdata-issue-ready%5D)

Il tuo design system è fatto di token DTCG, il formato che Penpot legge e scrive e che Tokens Studio porta in Figma, quindi la palette con cui progetti e quella che Lolly applica sono un unico documento. [Design Tokens](/info/design-tokens.html) ha i dettagli.

::: details Per sviluppatori: creare un pacchetto brand dalla riga di comando
Per creare un pacchetto brand riutilizzabile in un checkout, `ingest:brand` accetta i tre contenitori che Penpot e Tokens Studio esportano: un singolo `tokens.json`, una directory di file per set con `$metadata.json`, oppure un archivio `project.penpot`.

```bash
pnpm run ingest:brand ./my-tokens.json --name acme --label "Acme" --activate
```

`--activate` registra il brand come profilo e ne compila e convalida il catalogo. Non cambia mai il profilo predefinito: esegui con `LOLLY_PROFILE=acme` per usare il nuovo pacchetto. [Configuration](/info/configuration.html) spiega come si combinano pacchetti brand e profili.
:::

## Porta ciò che hai già

Non parti da una pagina bianca.

**File di design.** Il lavoro finito da Figma, Penpot, Illustrator, InDesign o da qualsiasi app SVG si apre in Design come layout vivo: il testo resta riscrivibile, le forme restano forme e le immagini finiscono nella tua libreria. Il file viene letto nel tuo browser e non viene caricato nulla. [Import a design](/info/design-import.html) elenca ogni formato e cosa viene mantenuto.

**Deck.** Trascina su Lolly una presentazione PowerPoint `.pptx` per archiviarne le slide come risorse, scrivi un nuovo deck da Markdown in **Markdown Slides**, oppure usa [Rebrand a deck](/info/rebrand.html) per portare l'intero deck sul tuo design system.

**Dati.** Incolla o trascina una tabella CSV o JSON e i campi ripetuti di uno strumento si compilano da essa, oppure [Batch](/info/batch.html#make-many-versions-of-one-design) crea un file finito per ogni riga.

### Da un progetto singolo a un template

Un layout importato è una normale sessione Design. **Share with rules** lo trasforma in uno strumento: scegli quali parti altre persone possono modificare, ed esse compilano solo quelle.

![Tieni il master di Design, scegli input e limiti in una copia di authoring, poi condividi uno strumento .lolly riutilizzabile che i destinatari compilano](/info/diagrams/concepts/share-with-rules.svg)

[Share a design with rules](/info/create-a-tool.html) descrive ogni passaggio.

## Crea molti file, condividi e automatizza

- <!--i:download--> **Esporta.** Gli strumenti producono SVG, PDF, PNG, JPG, WebP, video e altro, nei formati che ciascuno offre, alle dimensioni reali di stampa quando servono. Vedi [Export a file](/info/exporting.html).
- <!--i:link--> **Condividi un link.** Le impostazioni di uno strumento viaggiano nel suo link, così il link riapre lo stesso file ovunque.
- <!--i:layers--> **Crea un file per riga.** Pilota uno strumento da un foglio di calcolo in [Batch](/info/batch.html#make-many-versions-of-one-design).
- <!--i:cpu--> **Automatizza.** Lo stesso rendering gira dalla [CLI](/info/cli.html) e da un [agente di IA](/info/ai-agents.html).

Un link è una richiesta completa. Nessuno ha disegnato il grafico qui sotto: il tipo, il titolo e l'intera tabella di dati sono stati digitati nella barra degli indirizzi, e lo stesso link disegna lo stesso grafico su qualsiasi dispositivo.

![Un grafico ad area delle iscrizioni mensili, i cui valori sono arrivati tutti come parametro di query anziché con un clic](/t/url-shot?url=%2F%23%2Ftool%2Fchart%3Fct%3Darea%26d%3DMonth%2CSignups%250AJan%2C120%250AFeb%2C180%250AMar%2C265%250AApr%2C340%250AMay%2C455%26t%3DSignups%2520this%2520year%26full&width=1440&height=900&dpi=192&waitMs=2600&cropSelector=%23tool-canvas&walker=1&format=svg&dark=1&filename=vt-d3-url-chart)

## Dove andare adesso

- <!--i:people--> **[Crea](/info/creators.html)**: creare, animare, registrare, condividere ed esportare.
- <!--i:code--> **[Automatizza](/info/builders.html)**: design system, creazione di strumenti, riga di comando, link e agenti.
- <!--i:usercheck--> **[Gestisci](/info/operators.html)**: far funzionare Lolly per un team con Lolly Work.
- <!--i:server--> **[Distribuisci](/info/operate.html)**: ospitare Lolly e Lolly Work.
- <!--i:shieldcheck--> **[Fiducia](/info/trust.html)**: privacy, sicurezza e verifica di un file in autonomia.
