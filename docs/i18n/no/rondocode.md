# Lolly Rondocode-sanger

<a id="rondocode-songs"></a>

En rondocode-sang er musikk skrevet som kode: synther, mønstre og en miks, spilt mens du skriver. Lolly kan spille en sang under en video, og verktøyet **Rondocode** skriver sanger og eksporterer dem som lyd; begge registrerer sangen i filens Content Credentials.

<!--i:eti-music-->
## Spill en sang i Lolly

Ressursvelgeren tar imot en sang som en `.rondo`- eller `.rondo.json`-fil, eller som en innlimt delingslenke fra `rondocode.com`. En sang spilles i den lengden klippet ber om. Den kan være **bakgrunnsmusikken** under en videoeksport eller spilles i bakgrunnsspilleren til Neurospicy Mode.

Sangens kode kjører i Lollys sandkasse, uten nettverk og uten tilgang til filene dine. Alle deler en gjengivelse ikke kan spille, som en direkte mikrofoninngang eller sang uten stemmemodellene, listes i ressursens detaljer.

Fra terminalen tar `lolly mix` imot en sang som hele lydsporet; se [CLI-gjengivelse](/info/cli-rendering.html).

<!--i:eti-code-->
## Skriv og eksporter en sang

Åpne verktøyet **Rondocode** fra **Utilities** for å skrive en sang i rondocodes sanntidseditor og høre den mens du skriver. Eksporter den som **WAV**, **MP3**, **M4A**, **Opus** eller **FLAC**, som en ZIP med separate lydspor, som **MIDI** eller som et opptak av det som spilles. Fra terminalen skriver `lolly rondocode --export=mid` den samme MIDI-filen. **Export length** angir hvor mange sekunder en lydeksport varer. Sangfilen (`.rondo.json`) er koden din slik du skrev den, uten tillegg.

En sang kan synge teksten sin med `sing()`. Nedlastede stemmemodeller lager sangen på enheten din. En fil som inneholder syntetisert sang, oppgir alltid sangen som AI-generert (se [AI-funksjoner](/info/ai-features.html)).

<!--i:eti-badge-check-->
## Sanger i attesten

En video- eller lydeksport som spiller en rondocode-sang, registrerer hver sang i sine Content Credentials som en kilde:

- sangens navn;
- SHA-256 for `.rondo.json`-filen;
- hvordan den ble gjengitt: i Lollys sandkasse, kjøringsklassen `vm`, med gjengiverens versjon og startverdi, og alle deler gjengivelsen ikke kunne spille.

Musikk beregnet fra koden til en sang merkes som algoritmiske medier, så Lolly Verify flagger den ikke som AI. Før du eksporterer, lister en linje under **Download** sangene attesten vil registrere. Etter eksporten rapporterer den samme linjen hva en lesing av den leverte filen fant. Fjern avmerkingen for **C2PA Credentials** for å utelate oppføringen. Et stillbilde registrerer ingen sang, fordi det ikke har lyd. Et stillbilde registrerer ingen sang. `lolly mix` og [MCP-serveren](/info/mcp.html) skriver den samme oppføringen.

<!--i:eti-file-->
## Filer fra Rondocode-verktøyet

De fleste verktøy som kjører på enheten, skriver ingen attest, fordi de transformerer en fil du allerede eier. Lolly Rondocode lager ny lyd, så hver lydfil det skriver, inneholder Content Credentials som registrerer sangen som kilde: WAV, MP3, M4A, Opus, FLAC, hvert separate lydspor i en ZIP med lydspor og et opptak av det som spilles.

- Editorens egne gjengivelser kjører i den private rammen (kjøringsklassen `frame`) og registrerer editorens versjon.
- En gjengivelse laget av CLI eller en delingslenke kjører i klassen `vm` og registrerer gjengiverens versjon og startverdi.
- En WAV oppgir også det samme i RIFF-kommentaren.

Når en sang synger, er AI-erklæringen maskinlesbar. Attestens digitale kildetype er sammensatte medier laget med trente modeller, oppføringen lister de sungne delene, og én C2PA AI-erklæring per modell identifiserer hver modell sangen gikk gjennom: Supertonic-3 tekst til tale, fonemjustereren wav2vec 2.0, ContentVec-koderen og RVC-stemmen, med repositoriet og commiten til modellen Lolly er vert for.

### Hva MIDI-filen inneholder

MIDI-filen er en Standard MIDI File, format 1. Det første sporet inneholder tempoet og en 4/4-taktart, etterfulgt av ett spor per synth, oppkalt etter synthen. Hver note beholder starttidspunkt, lengde og anslagsstyrke. En synth med et navn som viser til et instrument, som bass, strykere, pad eller piano, får det tilsvarende General MIDI-instrumentet, og et trommelignende navn legges på kanal 10. En stemming som ikke er tolvtonig, rundes av til nærmeste halvtone med en tonehøydebøyning.

En MIDI-fil kan ikke inneholde synthinnstillingene, filtre, effekter, busser, samplinger eller sang, så en DAW spiller notene med sine egne instrumenter. Tempoet leses fra sangens sykluser per sekund med én syklus som en takt på fire slag, fordi sangens egen taktart ikke er del av det gjengiveren leverer tilbake.

En MIDI-fil har ikke plass til en attest, så en teksthendelse i filen inneholder erklæringen, og eksportpanelet sier fra om det. Panelet beskriver alt dette før du eksporterer. Etter hver eksport leser editoren den lagrede filen tilbake og rapporterer bare det lesingen fant.

For hva Content Credentials registrerer generelt, se [Eksporter en fil](/info/exporting.html#content-credentials-c2pa).
