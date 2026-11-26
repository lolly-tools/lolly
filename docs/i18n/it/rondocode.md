# Brani di Lolly Rondocode

<a id="rondocode-songs"></a>

Un brano rondocode è musica scritta come codice: sintetizzatori, pattern e un mix, riprodotti mentre digiti. Lolly può riprodurre un brano sotto un video e l'utility **Rondocode** scrive brani e li esporta come audio; entrambi registrano il brano nelle Content Credentials del file.

<!--i:eti-music-->
## Riproduci un brano in Lolly

Il selettore di risorse accetta un brano come file `.rondo` o `.rondo.json` oppure come link di condivisione `rondocode.com` incollato. Un brano viene riprodotto per qualsiasi durata richiesta dalla sua clip. Può essere il **sottofondo musicale** di un'esportazione video o essere riprodotto nel lettore ambientale della modalità Neurospicy.

Il codice del brano viene eseguito nella sandbox di Lolly, senza rete né accesso ai tuoi file. Qualsiasi parte che un rendering non può riprodurre, come un microfono live o il canto senza i modelli vocali, viene elencata nei dettagli della risorsa.

Dal terminale, `lolly mix` usa un brano come intera colonna sonora; vedi [Rendering da CLI](/info/cli-rendering.html).

<!--i:eti-code-->
## Scrivi ed esporta un brano

Apri lo strumento **Rondocode** da **Utilities** per scrivere un brano nell'editor live di rondocode e ascoltarlo mentre digiti. Esportalo come **WAV**, **MP3**, **M4A**, **Opus** o **FLAC**, come ZIP di stem, come **MIDI** o come registrazione di ciò che viene riprodotto. Dal terminale, `lolly rondocode --export=mid` scrive lo stesso file MIDI. **Export length** imposta la durata in secondi di un'esportazione audio. Il file del brano (`.rondo.json`) è il tuo codice così com'è stato scritto, senza aggiunte.

Un brano può cantare il proprio testo con `sing()`. I modelli vocali scaricati producono il canto sul tuo dispositivo. Un file che contiene canto sintetizzato lo dichiara sempre come generato dall'AI (vedi [Funzioni AI](/info/ai-features.html)).

<!--i:eti-badge-check-->
## Brani nella credenziale

Un'esportazione video o audio che riproduce un brano rondocode registra ogni brano nelle proprie Content Credentials come fonte:

- il nome del brano;
- lo SHA-256 del suo file `.rondo.json`;
- come è stato renderizzato: nella sandbox di Lolly, la classe di esecuzione `vm`, con la versione e il seed del renderer e qualsiasi parte che il rendering non ha potuto riprodurre.

La musica calcolata dal codice di un brano è contrassegnata come media algoritmico, quindi Lolly Verify non la segnala come AI. Prima dell'esportazione, una riga sotto **Download** elenca i brani che la credenziale registrerà. Dopo l'esportazione, la stessa riga riporta ciò che è stato rilevato leggendo il file consegnato. Deseleziona **C2PA Credentials** per escludere il record. Un'immagine statica non registra alcun brano, perché non ha suono. Un'immagine statica non registra alcun brano. `lolly mix` e il [server MCP](/info/mcp.html) scrivono lo stesso record.

<!--i:eti-file-->
## File dell'utility Rondocode

La maggior parte delle utility sul dispositivo non scrive credenziali, perché trasforma un file che già possiedi. Lolly Rondocode crea nuovo audio, quindi ogni file audio che scrive contiene Content Credentials che registrano il brano come fonte: WAV, MP3, M4A, Opus, FLAC, ogni stem in uno ZIP di stem e una registrazione di ciò che viene riprodotto.

- I rendering dell'editor vengono eseguiti nel suo frame privato (la classe di esecuzione `frame`) e registrano la versione dell'editor.
- Un rendering creato dalla CLI o da un link di condivisione viene eseguito nella classe `vm` e registra la versione e il seed del renderer.
- Un WAV dichiara lo stesso anche nel suo commento RIFF.

Quando un brano canta, la dichiarazione AI è leggibile dalle macchine. Il tipo di fonte digitale della credenziale è media composito creato con modelli addestrati, il record elenca le parti cantate e una dichiarazione AI C2PA per modello identifica ogni modello attraverso cui è passato il canto: la sintesi vocale Supertonic-3, l'allineatore di fonemi wav2vec 2.0, l'encoder ContentVec e la voce RVC, con il repository e il commit da cui Lolly lo ospita.

### Cosa contiene il file MIDI

Il file MIDI è uno Standard MIDI File, formato 1. La prima traccia contiene il tempo e un'indicazione di misura di 4/4, seguita da una traccia per sintetizzatore, con il nome del sintetizzatore. Ogni nota mantiene l'inizio, la durata e la velocity. Un sintetizzatore il cui nome corrisponde a uno strumento, come basso, archi, pad o pianoforte, riceve lo strumento General MIDI corrispondente e un nome che richiama la batteria va sul canale 10. Un'accordatura non a dodici toni viene arrotondata al semitono più vicino con un pitch bend.

Un file MIDI non può contenere le impostazioni dei sintetizzatori, filtri, effetti, bus, campioni o canto, quindi una DAW riproduce le note con i propri strumenti. Il tempo viene ricavato dai cicli al secondo del brano, considerando un ciclo come una battuta di quattro movimenti, perché l'indicazione di misura del brano non fa parte di ciò che il renderer restituisce.

Un file MIDI non ha spazio per una credenziale, quindi un evento di testo nel file contiene la dichiarazione e il pannello di esportazione te lo indica. Il pannello descrive tutto questo prima dell'esportazione. Dopo ogni esportazione l'editor rilegge il file salvato e riporta solo ciò che quella lettura ha rilevato.

Per sapere cosa registrano in generale le Content Credentials, vedi [Esporta un file](/info/exporting.html#content-credentials-c2pa).
