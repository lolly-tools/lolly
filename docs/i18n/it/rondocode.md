# Canzoni Rondocode

Una canzone rondocode è musica scritta come codice: sintetizzatori, pattern e un mix, suonati mentre scrivi. Lolly può riprodurre una canzone sotto un video, e l'utility **Rondocode** ti permette di scriverne una ed esportarla come audio. Entrambi registrano la canzone nelle Content Credentials del file, così la musica dice da dove viene.

## Riprodurre una canzone in Lolly

Il selettore di risorse accetta una canzone come file `.rondo` o `.rondo.json`, oppure come link di condivisione `rondocode.com` incollato. Una canzone è codice che produce il proprio suono, quindi si riproduce alla durata che la sua clip richiede. Può essere il **music bed** sotto un'esportazione video o suonare nel player ambient di Neurospicy Mode.

Il codice della canzone gira nella sandbox di Lolly, senza rete e senza accesso ai tuoi file. Qualsiasi parte che un rendering non può riprodurre, come un microfono live, o il canto senza i modelli vocali, è elencata nei dettagli della risorsa.

Dal terminale, `lolly mix` prende una canzone come intera colonna sonora; vedi [CLI rendering](/info/cli-rendering.html).

## Scrivere ed esportare una canzone

Apri **Rondocode** da **Utilities** per scrivere una canzone nell'editor live di rondocode e ascoltarla mentre scrivi. Esportala come **WAV**, **MP3**, **M4A**, **Opus** o **FLAC**, come ZIP di stem, come **MIDI**, o come registrazione di ciò che sta suonando. **Export length** imposta quanti secondi dura un'esportazione audio. Il file della canzone stesso (`.rondo.json`) è il tuo codice così come scritto e non porta nulla di aggiunto.

Una canzone può cantare i suoi testi con `sing()`. Il canto viene prodotto sul tuo dispositivo da modelli vocali scaricati, e un file che contiene canto sintetizzato dichiara sempre il canto come generato dall'IA (vedi [AI features](/info/ai-features.html)).

## Canzoni nella credenziale

Un'esportazione video o audio che riproduce una canzone rondocode registra ogni canzone nelle sue Content Credentials come fonte:

- il nome della canzone;
- lo SHA-256 del suo file `.rondo.json`;
- come è stata renderizzata: nella sandbox di Lolly, la classe di esecuzione `vm`, con la versione e il seed del renderer, e qualsiasi parte che il rendering non ha potuto riprodurre.

La musica calcolata dal codice di una canzone è contrassegnata come media algoritmico, quindi Verify non la segnala come IA. Prima di esportare, una riga sotto **Download** elenca le canzoni che la credenziale registrerà; dopo l'esportazione, la stessa riga riporta ciò che ha trovato una lettura del file consegnato. Deseleziona **C2PA Credentials** per omettere il record. Un'immagine fissa non registra alcuna canzone, perché non porta suono. `lolly mix` e il [server MCP](/info/mcp.html) scrivono lo stesso record.

## File dell'utility Rondocode

La maggior parte delle utility sul dispositivo non scrive alcuna credenziale, perché trasforma un file che già possiedi. Rondocode crea nuovo audio, quindi ogni file audio che scrive porta Content Credentials che registrano la canzone come fonte: il suo nome, lo SHA-256 del suo file `.rondo.json` e dove ha girato il suo codice. Questo copre WAV, MP3, M4A, Opus, FLAC, ogni stem in uno ZIP di stem e una registrazione di ciò che sta suonando.

- I rendering dell'editor stesso girano nel suo frame privato (la classe di esecuzione `frame`) e registrano la versione dell'editor.
- Un rendering fatto dalla CLI o da un link di condivisione gira nella classe `vm` e registra la versione e il seed del renderer.
- Un WAV riporta lo stesso anche nel suo commento RIFF.
- La musica calcolata dal codice della canzone è media algoritmico e non è contrassegnata come IA.

Quando una canzone canta, il file dichiara quel canto generato dall'IA in forma leggibile da una macchina. Il tipo di sorgente digitale della credenziale è media composito creato con modelli addestrati, il record elenca le parti cantate, e una dichiarazione IA C2PA per modello identifica ogni modello attraverso cui è passato il canto: la sintesi vocale Supertonic-3, l'allineatore di fonemi wav2vec 2.0, l'encoder ContentVec e la voce RVC, con il repository e il commit da cui Lolly li ospita. Un file che contiene canto sintetizzato non viene mai salvato senza quella dichiarazione.

Un file MIDI non ha spazio per una credenziale, quindi un evento di testo nel file porta invece la dichiarazione, e il pannello di esportazione te lo dice. Il pannello descrive tutto questo prima che tu esporti, e dopo ogni esportazione l'editor rilegge il file salvato e riporta solo ciò che quella lettura ha trovato.

Per ciò che le Content Credentials registrano in generale, vedi [Export a file](/info/exporting.html#content-credentials-c2pa).
