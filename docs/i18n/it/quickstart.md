# Inizia

Imposta gli strumenti con i tuoi colori e font e riusa il lavoro che hai già. Non ti serve un account e la creazione e l'esportazione avvengono sul tuo dispositivo.

::: steps
- <!--i:eti-sparkles--> **[Crea un file](/info/make-something.html)** Un codice QR in pochi minuti, con ogni passaggio mostrato.
- <!--i:eti-palette--> **[Inserisci il tuo brand](#put-your-brand-in)** Parti da un colore, un file di token o un design finito.
- <!--i:eti-folder-move--> **[Importa il tuo lavoro](#bring-in-what-you-already-have)** Design, deck e dati che hai già, letti sul tuo dispositivo.
- <!--i:eti-repeat--> **[Crea altri lavori dello stesso tipo](#make-many-share-and-automate)** Condividi un link, compila un foglio di calcolo o esegui lo strumento da uno script.
:::

[Cos'è Lolly?](/info/what-is-lolly.html) è un'introduzione di cinque minuti. [Come funziona Lolly](/info/how-lolly-works.html) mostra chi fa cosa.

<!--i:eti-palette-->
## Inserisci il tuo brand

lolly.tools si apre con **Lolly Demo**, il design system di esempio di Lolly ([Scopri Lolly Demo](/info/lolly-demo.html)). Il tuo design system sostituisce Lolly Demo. È un piccolo insieme di token di design (colori, font e poche regole) con cui ogni strumento disegna. Impostalo una volta e tutto ciò che crei parte già in linea con il brand.

Scegli il percorso adatto a ciò che hai:

- <!--i:palette--> **Un colore.** Apri la vista **Design System Setup** (`#/start`), dai un nome al tuo design system e scegli un colore primario. Lolly ricava da quel colore una palette accessibile, con superfici chiare e scure, testo e accenti. Scegli un font e hai un brand pronto all'uso.
- <!--i:upload--> **Un file di token.** **Add from…**, in alto in Lolly Design System Setup, accetta un file di token DTCG, Tokens Studio o Penpot, un SVG o un pacchetto `LollyBrand`. La palette si compila dal file. Finché il design system è vuoto, **Start from a reference** nel Board apre lo stesso selettore.
- <!--i:pentool--> **Un design finito.** In Lolly Design, scegli **Import a design** e trascina un file Figma, Penpot, Illustrator, InDesign, Affinity, Photoshop, PowerPoint o SVG ([tutti i formati](/info/design-import.html#what-comes-in-from-each-app)). Vedi [Importa ciò che hai già](#bring-in-what-you-already-have) sotto.

La prima volta che apri la galleria, un messaggio di benvenuto in alto propone un passo successivo. Su lolly.tools, **Start making** apre Lolly Design sul poster Launch. Su una nuova installazione, **Make it yours** apre Lolly Design System Setup. Sotto quel pulsante, **Bring a file** apre un selettore di file per un design e l'altra delle due opzioni compare come link. Una qualsiasi di queste azioni, o il pulsante di chiusura, nasconde il messaggio di benvenuto per sempre.

![La sezione Colours di Lolly Design System Setup su un nuovo design system: un campione live, un campo e tutta la prima decisione](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor&system=new-design-system&width=1440&height=740&dpi=192&waitMs=1800&format=svg&walker=1&dark=1&filename=bs-colours-new-system)

Otto sezioni, utilizzabili in qualsiasi ordine, permettono di sviluppare ulteriormente il design system: **Board**, **Colours**, **Type**, **Logos**, **Tokens**, **Files**, **Rules** e **Skills**. Ogni anteprima nell'app si aggiorna mentre scrivi. [Lolly Design System Setup](/info/brand-studio.html) descrive ogni sezione.

I font sono conservati sul tuo dispositivo. Un Google Font che scegli viene memorizzato come risorsa del brand, così i tuoi caratteri funzionano offline e non viene scaricato nulla quando uno strumento disegna.

### Vedere, cambiare e condividere un design system

- **Vedi quello attivo.** **Settings → Design system** mostra il design system attivo come copertina e pagine, in sola lettura.
- **Passa dall'uno all'altro.** **Settings → Preferences → Design systems** elenca tutti i design system su questo dispositivo. Un'organizzazione può usare più design system o uno con più colourway. [Architetture del brand](/info/brand-architectures.html) illustra le configurazioni.
- **Condividine uno.** Esporta il design system come pacchetto `LollyBrand`: un unico file che un collega importa per ottenere la stessa palette, gli stessi font e le stesse regole.

Un design system fornito dalla tua build o dalla tua organizzazione è **gestito**: mostra un lucchetto e resta di sola lettura. Per modificarlo, crea una copia modificabile da **Settings → Preferences → Design systems**.

![La scheda Design system in Settings: il design system attivo come copertina e pagine](/t/url-shot?url=%2F%23%2Fd%3Ftab%3Dbrand&width=1440&height=900&dpi=192&waitMs=1800&format=svg&walker=1&localize=1&dark=1&filename=dashboard-brand&waitSelector=%5Bdata-issue-ready%5D)

Il tuo design system è composto da token DTCG, il formato che Penpot legge e scrive e che Tokens Studio porta in Figma. La palette con cui progetti e quella che Lolly applica sono un unico documento. [Token di design](/info/design-tokens.html) contiene i dettagli.

::: details Per sviluppatori: crea un pacchetto del brand dalla riga di comando
`ingest:brand` crea un pacchetto del brand riutilizzabile in un checkout. Accetta i tre contenitori esportati da Penpot e Tokens Studio: un singolo `tokens.json`, una directory di file per set con `$metadata.json` o un archivio `project.penpot`.

```bash
pnpm run ingest:brand ./my-tokens.json --name acme --label "Acme" --activate
```

`--activate` registra il brand come profilo e ne genera e convalida il catalogo. Non cambia mai il profilo predefinito: esegui con `LOLLY_PROFILE=acme` per usare il nuovo pacchetto. [Configurazione](/info/configuration.html) spiega come si integrano pacchetti del brand e profili.
:::

<!--i:eti-folder-move-->
## Importa ciò che hai già

**File di Lolly Design.** Il lavoro finito in Figma, Penpot, Illustrator, InDesign o qualsiasi app SVG si apre in Lolly Design come layout modificabile. Il testo resta modificabile, le forme restano forme e le immagini finiscono nella tua libreria. Il file viene letto nel browser e non viene caricato nulla. [Importa un design](/info/design-import.html) elenca ogni formato e ciò che viene conservato.

**Deck.** Trascina un PowerPoint `.pptx` su Lolly per archiviare le sue slide come risorse. Scrivi un nuovo deck da Markdown in **Lolly Markdown Slides**. [Adatta un deck al tuo brand](/info/rebrand.html) porta un deck sul tuo design system.

**Dati.** Incolla o trascina una tabella CSV o JSON per compilare i campi ripetuti di uno strumento. [Lolly Batch](/info/batch.html#make-many-versions-of-one-design) crea un file finito per ogni riga.

### Da un lavoro singolo a un template

Un layout importato è una normale sessione di Lolly Design. **Share with rules** trasforma la sessione in uno strumento. Scegli quali parti possono cambiare gli altri, che compilano solo quelle.

![Conserva il master di Lolly Design, scegli input e limiti in una copia di lavoro, poi condividi uno strumento .lolly riutilizzabile che i destinatari compilano](/info/diagrams/concepts/share-with-rules.svg)

[Condividi un design con regole](/info/create-a-tool.html) illustra ogni passaggio.

<!--i:eti-repeat-->
## Crea in serie, condividi e automatizza

- <!--i:download--> **Esporta.** Gli strumenti creano SVG, PDF, PNG, JPG, WebP, video e altro, alle dimensioni reali di stampa quando serve. Ogni strumento offre i propri formati. Vedi [Esporta un file](/info/exporting.html).
- <!--i:link--> **Condividi un link.** Le impostazioni di uno strumento viaggiano nel suo link, che riapre quindi lo stesso file ovunque.
- <!--i:layers--> **Creane uno per riga.** Pilota uno strumento da un foglio di calcolo in [Lolly Batch](/info/batch.html#make-many-versions-of-one-design).
- <!--i:cpu--> **Automatizza.** Lo stesso rendering si esegue dalla [CLI](/info/cli.html) e da un [agente AI](/info/ai-agents.html).

Un link è una richiesta completa. Il tipo, il titolo e la tabella dati del grafico qui sotto sono stati digitati nella barra degli indirizzi.

![Un grafico a barre delle iscrizioni mensili per canale nei colori del design system, con ogni valore arrivato come parametro di query anziché con un clic](/t/url-shot?url=%2F%23%2Ftool%2Fchart%3Fct%3Dbar%26sty%3Dposter%26pl%3Droles%26transparentBg%3Dfalse%26d%3DMonth%2CWeb%2CApp%2CPartners%250AJan%2C120%2C60%2C25%250AFeb%2C180%2C95%2C40%250AMar%2C265%2C150%2C70%250AApr%2C340%2C210%2C110%250AMay%2C455%2C290%2C160%250AJun%2C560%2C380%2C230%26t%3DSignups%2520this%2520year%26st%3DBy%2520channel%252C%2520January%2520to%2520June%26full&width=1440&height=900&dpi=192&waitMs=4000&cropSelector=%23tool-canvas&walker=1&format=svg&dark=1&filename=vt-d3-url-chart)

<!--i:eti-map-pin-->
## Dove proseguire

- <!--i:people--> **[Crea](/info/creators.html)**: creare, animare, registrare, condividere ed esportare.
- <!--i:code--> **[Automatizza](/info/builders.html)**: design system, creazione di strumenti, riga di comando, link e agenti.
- <!--i:usercheck--> **[Gestisci](/info/operators.html)**: gestire Lolly per un team con Lolly Work.
- <!--i:server--> **[Distribuisci](/info/operate.html)**: ospitare Lolly e Lolly Work.
- <!--i:shieldcheck--> **[Fiducia](/info/trust.html)**: privacy, sicurezza e verifica autonoma di un file.
