# FAQ

Domande frequenti mostrate nell'accordion nella pagina di destinazione `/info`.

**Come si aggiorna:** ogni titolo `##` qui sotto è una domanda; tutto ciò che si trova sotto
di esso (fino al `##` successivo) è la risposta. Le risposte usano lo stesso markdown leggero
del resto del sito - separa i paragrafi con una riga vuota. Aggiungi, rimuovi o riordina
le domande qui e riesegui `npm run build:info` (o `npm run dev:web`).
Tutto ciò che precede il primo `##` (questo titolo e queste note) viene ignorato dalla build.

## Cosa succede quando attivo l'opt-in nella pagina /profile?

Quando usi Lolly per la prima volta, tutto ciò che scrivi, ovunque, resta completamente privato finché non decidi deliberatamente di farlo uscire tramite un contenuto multimediale o un link di condivisione (se sei online).

Con l'opt-in selezionato, i dettagli del profilo che scegli vengono sigillati dentro ciò che crei, indicandoti come fonte. Nulla viene incluso senza che sia tu a sceglierlo.

Lolly produce un grande volume di contenuti. Adottiamo un approccio rigoroso di minimizzazione dei dati per prevenire i rischi.

## Lolly è stato "vibe coded"?

Lolly è stato sviluppato con codice assistito dall'IA, scoperta assistita dall'IA e, in molti punti, contenuti assistiti dall'IA, usando un mix di modelli e fornitori, inclusi quelli di aziende di punta del cloud pubblico.

Al momento in cui scriviamo, Lolly non contiene alcuna vulnerabilità di sicurezza nota nella sua supply chain, e si impegna ad applicare pratiche di risposta rapida in materia di sicurezza non appena emergono CVE.

Una persona ha creato l'architettura, curato il codice con intenzione e diretto artisticamente l'esperienza.

Soprattutto, Lolly poggia sulle spalle di decenni di innovazione open source di veri esperti di tutto il mondo.

Nel codice di Lolly esiste un build-gate deterministico che mantiene coerenti codice e documentazione per il lettore medio e "sgrassa" l'esperienza. Questo può rendere difficile un'enumerazione sintetica proprietaria dell'origine. Non è intenzionale.

**Informativa sull'IA generativa:**

- **Codice scritto da LLM:** Opus 4.8, Gemini 3.1, Qwen3-Coder-Next (questo elenco può ampliarsi)
- **Scoperta tramite LLM:** Gemini 3.1, Fable
- **Documentazione:** Sonnet 5
- **Librerie open source:** i rispettivi autori, indicati nella SBOM, nei commenti e nelle intestazioni dei file

Questo elenco non include i modelli integrati in Lolly.

**Contributo umano:**

- **Architettura:** Andy Fitzsimon
- **Direzione artistica:** Andy Fitzsimon
- **Codice scritto da un umano:** Andy Fitzsimon
- **Ideazione, revisione e feedback:** Ravan Naidoo, Matthias Eckermann, Kelly Andrews, Ryan Kleeman, Peter Chamalian, la comunità Penpot (elenco non esaustivo)

## Cosa sono i feature flag?

I feature flag attivano o disattivano parti di Lolly. Di solito sono controllati da un amministratore - con Lolly, il controllo è tuo.

![Ogni feature flag è un interruttore che appartiene a te e sta nel tuo profilo, non nella console di un amministratore](/t/url-shot?url=%2F%23%2Fprofile%3Ffocus%3Dfeature-flags&width=1440&height=1800&dpi=192&waitMs=2000&format=svg&cropSelector=%23feature-flags-section&walker=1&dark=1&filename=pd-feature-flags)

## Come ottengo le app mobile o desktop?

Chiunque può distribuire le proprie app; gli strumenti e la configurazione di quelle app dovrebbero variare molto a seconda del pubblico a cui sono destinate. Quindi non esiste un'unica app, a meno che tu non l'abbia creata o che te la fornisca qualcuno di rilevante.

## Perché il nome "Lolly Tools"?

**Lolly** perché la libertà è dolce, e perché in Australia, Nuova Zelanda e Gran Bretagna una lolly è una caramella.

**Tools** perché un attrezzo resta fermo finché non lo prendi in mano. Non gira quando non lo stai usando e non ti osserva mentre lo usi.

## Quali ostacoli potrei aspettarmi adottando Lolly?

Lolly si inserisce ovunque tu generi già file - la CLI è lo stesso motore
dell'app, quindi una pipeline eseguita alle 2 di notte non può divergere da ciò che una persona
vede in anteprima in un browser. L'attrito nell'adozione è raramente tecnico; è organizzativo. Ecco cosa aspettarsi:

**Va creato un catalogo di brand curato.** Lolly è una piattaforma, non un
pacchetto già pronto dei tuoi template. Per un *rollout governato*, qualcuno definisce il
catalogo condiviso degli asset (loghi, palette, font come ID permanenti) e scrive il manifest +
il template per ogni tipo di output. I singoli però non devono aspettare che questo accada -
nell'app aperta chiunque può importare i propri file nel catalogo e costruire strumenti in
Design fin dal primo giorno.

**Non serve git per contribuire.** I designer creano i propri strumenti e template
nell'app, poi li condividono con i colleghi o li propongono a chi possiede il
deployment perché siano inclusi tra i predefiniti.

**È deliberatamente ristretto - presentalo così.** Lolly non è per contenuti su misura o
contenuti hero. *È* il tuo DAM personale - idratato e potenziato dal tuo design
system, dagli strumenti e dal catalogo - e *ha* davvero un canvas aperto (Design), ma
anche lì colori, tipografia e asset si conformano alle variabili di design globali attive, così la
disposizione libera resta dentro il sistema. Confrontato con Figma o Canva
sembrerà limitato. Giudicato per ciò che è - generazione di asset operazionalizzata, ricorrente,
su scala massiva - niente compete. L'inquadramento sbagliato è l'intoppo più comune.

**Gestione del cambiamento sul lato della produzione.** I processi esistenti funzionano oggi,
anche se l'output non rispetta il brand. Ripuntarli verso il motore significa nuovi test e un nuovo
apprendimento, e "sappiamo già creare file" diventa la scusa per non migrare. Inizia convertendo
un output di qualità produttiva ad alta visibilità e mostrando il prima/dopo affiancati.

Lolly alza il livello di tutto.


## Cosa distingue le utilità dagli strumenti?

**Risposta semplice →** Le utilità non hanno sempre bisogno di renderizzare e quindi possono avere una UX diversa. 

**Risposta vera →** Il motivo per cui le utilità possono essere ospitate dentro Lolly Tools è aggiungere un ulteriore "livello di comodità" di difesa per disincentivare l'esfiltrazione di dati. 

Perché? Perché è risaputo che ogni giorno le persone prendono **contenuti riservati che hanno già** e li affidano a un
sito web qualsiasi per eseguire una piccola operazione meccanica:

- "**Comprimi questo PDF**" → carica un contratto / una busta paga / una presentazione del consiglio verso entità sconosciute.
- "**converti HEIC in JPG**" → carica foto personali (con EXIF GPS) su un host finanziato dalla pubblicità
- "**ritaglia / ridimensiona questa immagine**" → carica uno screenshot di prodotto o un asset non ancora pubblicato
- "**formatta questo JSON**" / "decodifica questo JWT" → incolla risposte API, token, segreti in un formattatore
- "**unisci questi PDF**" → carica **due documenti che non dovrebbero mai condividere un server**

Questi siti e la loro enorme coda lunga di cloni **non sono affidabili per impostazione predefinita**, con
conservazione sconosciuta, giurisdizioni sconosciute, subresponsabili sconosciuti e un modello di business
pubblicità/affiliazione che ha ogni interesse a tenersi ciò che gli dai. L'operazione è
banale; è **il contenuto ad avere un costo.** 

Vinciamo la guerra della governance con un'eccellente comodità e un servizio eccellente. 

![La vista Utilities raccoglie i lavori meccanici che di solito si affidano a un sito web qualsiasi, ma che qui girano tutti dentro Lolly](/t/url-shot?url=%2F%23%2Fu&width=1440&height=900&dpi=192&waitMs=1600&css=.welcome-dialog%2C.personalize-nudge%7Bdisplay%3Anone!important%7D&tolerance=0.03&format=svg&walker=1&dark=1&filename=use-utilities&try=1)

## Lolly può modificare e renderizzare i miei file Figma, Penpot, Illustrator o InDesign?

Sì. Apri **Design** e clicca su **Importa un design**: accetta un file Figma nativo **.fig** (Save local copy), un'esportazione Penpot **.penpot**, un file Illustrator **.ai** o **.pdf**, un file InDesign **.idml** (File → Export → InDesign Markup) oppure **qualsiasi SVG** (la porta larga - quasi ogni app di design lo esporta). Non servono account, plugin né licenza di un'app di design.

![La tela aperta di Design - Importa un design si trova nel menu Lolly della barra degli strumenti](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Fz%3D17VVRa9swEP41ekyQLrbjPOyhVeeOrSsbG3lXbLkYZCnISmn264tO9irFhdJCoZQIpBNn9N2dvu_k3cOX1opeEuCTpeNkG0BDy8ljZe28pyDA74UlUC4WOyt0sxgOthW1JJAD9wv1y6rFQWCDMB6BAK-NdqLTBLg2thcqeAnk68vaKGOXg-yFdl29dPLBef8VAZ6V_qjUTloCvO-aRvlcc0QdhB58iCWDMVNnD1iSUIOcAvASY2qsEUeex-XSOEJ6koaT_6Q1iY89IY4mw4TCmmJYc9BNZKPQ00ywxxJS-BlqcnL2KfJF3xhZf3WdwwsMd8xZ4VEgEF6EGornaH-ByW_iHkVAj-aAtpcO7Y1R6kggX1Uz7ext1wt7PNEOk7BZ7UbtYCpKtj4NZ_YE-Doh_hOwHnff-1K_M83xlPmyiJhn8AbmL5C61nZSN8g00OlFoK2xkyjCRofOBro3g5N2OdPE2PqxIGjL1iCCIPA1SPSQpQ_B6qyIVyiCsp8s-_Gn2P76fpHfVlt6WV3_Lv5e5_6mul7cSVRFhiWhOIrsaaVTMbKZaUWNbQ-VMncGN__b_fwn-CAKeAQ&width=1360&height=850&dpi=192&waitMs=3000&format=png&localize=1&dark=1&filename=design)

I livelli arrivano come riquadri modificabili sul canvas aperto: il testo resta modificabile, le forme restano forme, le immagini si uniscono alla tua libreria di immagini e la tipografia e i colori si conformano alle variabili globali di brand. Salvalo e il layout diventa un template riutilizzabile e indirizzabile via URL che chiunque abbia Lolly può compilare di nuovo - e puoi mescolarci strumenti dal vivo (un codice QR, un grafico) che vengono renderizzati di nuovo al caricamento. Da lì si renderizza come qualsiasi altra cosa in Lolly - SVG, PDF, PNG e il resto, riproducibile dal suo URL. Vedi [Importa un design](/info/design-import.html).

## Posso condividere il mio lavoro come file invece che come link?

Sì. Quando un link non riesce a portare tutto (le tue foto, testi lunghi), la finestra di condivisione dice esattamente cosa andrebbe perso e propone invece un file **.lolly**: un unico file che contiene il design, le immagini che usa e, se vuoi, lo strumento stesso. Decidi tu quanto viaggia - il tuo nome e i tuoi dati entrano solo se il tuo profilo attiva l'opt-in, le opere sotto licenza restano fuori a meno che tu non le includa, e a chi apre un file che porta con sé uno strumento viene chiesto se si fida prima che possa essere eseguito. Vedi [Condividere il tuo lavoro](/info/using.html#sharing-your-work).

## Due persone possono lavorare sullo stesso design senza internet?

Sì. Una persona condivide un invito (un link, un codice QR o un codice breve), l'altra accetta, e i due dispositivi tengono viva la stessa sessione - presenza, anelli di focus e tutto il resto. Funziona su qualsiasi rete condivisa, compreso l'hotspot di un telefono in uno scantinato, perché non c'è nessun server in mezzo. Vedi [Lavorare insieme](/info/collaborate.html).

## Dove sono finiti gli strumenti a marchio SUSE?

Vivono già in un repository separato e privato. Un clone pubblico non scarica affatto il brand pack SUSE, quindi una build pubblica esegue il profilo neutro `lolly-start` - gli strumenti della community indipendenti dal brand più un brand vuoto che riempi con il tuo. SUSE gestisce una propria istanza per proteggere i suoi marchi registrati.

## Perché è gratis? Dov'è l'inghippo?

**Abbiamo costruito Lolly per noi stessi.** A SUSE servivano migliaia di file in linea con il brand, ognuno con il proprio nome sigillato dentro, prodotti senza consegnare nulla a servizi esterni. Così abbiamo costruito uno strumento che fa tutto sul dispositivo e l'abbiamo rilasciato come open source, come tutto il resto di ciò che facciamo. Continuiamo a mantenerlo perché lo usiamo ogni giorno. **Non c'è alcun obbligo:** tutto quello che trovi qui funziona con o senza di noi.

Quella linea è tracciata nella licenza, non in una promessa: tutto ciò che gira in locale è gratuito, per sempre. Una versione già rilasciata è licenziata in modo da non poter essere ritirata, e non esiste alcun contributor agreement che possa cambiare licenza al lavoro di qualcuno. Vedi il [posizionamento](/info/positioning.html) per la dichiarazione completa.

## Quanto sta tenendo privato SUSE? (ovvero: quando arriva la fregatura)

Il motore, le shell, gli schemi e gli strumenti indipendenti dal brand sono open source; i marchi registrati di SUSE e gli strumenti a marchio sono la parte che resta privata, e sono già stati separati. L'istanza pubblica su [lolly.tools](https://lolly.tools) gira sul brand vuoto.

Il confine è strutturale, non promesso. Ogni versione rilasciata è open source e non può essere ritirata, non esiste alcun contributor agreement che possa cambiare licenza al lavoro di qualcuno, e l'unica cosa trattenuta è il marchio registrato. Quando nel 2023 un'altra azienda ha chiuso i sorgenti del suo Linux enterprise, SUSE ha co-fondato [OpenELA](https://openela.org) per mantenere quel codice aperto - la stessa postura che questo progetto eredita.

Per totale trasparenza: SUSE *sta* effettivamente costruendo strumenti interni per integrare Lolly nei propri sistemi IT - questo riguarda l'assetto interno di SUSE, non una scelta tra sviluppo pubblico e privato. Lolly punta inoltre a essere costruito tramite [Open Build Service](https://openbuildservice.org/), con artefatti di supply chain sicuri distribuiti dalla [SUSE Application Collection](https://apps.rancher.io/applications).

## Che gusto ha quel logo Lolly?

Alcuni dicono Lime, altri dicono Menta e a volte Mela, Lolly porta la dolcezza, il gusto lo crei tu!
