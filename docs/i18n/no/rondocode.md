# Rondocode-sanger

En rondocode-sang er musikk skrevet som kode: synther, mønstre og en miks, spilt av mens du skriver. Lolly kan spille en sang under en video, og utilityen **Rondocode** lar deg skrive en og eksportere den som lyd. Begge registrerer sangen i filens Content Credentials, slik at musikken sier hvor den kom fra.

## Spill en sang i Lolly

Ressursvelgeren tar en sang som en `.rondo`- eller `.rondo.json`-fil, eller som en innlimt `rondocode.com`-delingslenke. En sang er kode som lager sin egen lyd, så den spilles i den lengden klippet ber om. Den kan være **music bed** under en videoeksport eller spilles i Neurospicy Modes ambiente spiller.

Sangens kode kjører i Lollys sandkasse, uten nettverk og uten tilgang til filene dine. Enhver del en gjengivelse ikke kan spille, som en levende mikrofon, eller sang uten stemmemodellene, listes i ressursens detaljer.

Fra terminalen tar `lolly mix` en sang som hele lydsporet; se [CLI rendering](/info/cli-rendering.html).

## Skriv og eksporter en sang

Åpne **Rondocode** fra **Utilities** for å skrive en sang i rondocodes levende redigeringsprogram og høre den mens du skriver. Eksporter den som **WAV**, **MP3**, **M4A**, **Opus** eller **FLAC**, som en ZIP med stemmer, som **MIDI**, eller som et opptak av det som spilles. **Export length** setter hvor mange sekunder en lydeksport varer. Selve sangfilen (`.rondo.json`) er koden din slik den er skrevet og bærer ingenting lagt til.

En sang kan synge tekstene sine med `sing()`. Sangen lages på enheten din av nedlastede stemmemodeller, og en fil som holder syntetisert sang, deklarerer alltid sangen som AI-generert (se [AI features](/info/ai-features.html)).

## Sanger i credentialen

En video- eller lydeksport som spiller en rondocode-sang, registrerer hver sang i Content Credentials som en kilde:

- sangens navn;
- SHA-256 av `.rondo.json`-filen;
- hvordan den ble gjengitt: i Lollys sandkasse, utførelsesklassen `vm`, med gjengiverens versjon og frø, og enhver del gjengivelsen ikke kunne spille.

Musikk beregnet fra en sangs kode merkes som algoritmiske medier, så Verify flagger den ikke som AI. Før du eksporterer, lister en linje under **Download** sangene credentialen vil registrere; etter eksporten rapporterer den samme linjen hva en lesing av den leverte filen fant. Fjern avkrysningen for **C2PA Credentials** for å utelate posten. Et stillbilde registrerer ingen sang, fordi det ikke bærer lyd. `lolly mix` og [MCP server](/info/mcp.html) skriver den samme posten.

## Filer fra Rondocode-utilityen

De fleste utilities på enheten skriver ingen credential, fordi de transformerer en fil du allerede eier. Rondocode lager ny lyd, så hver lydfil den skriver, bærer Content Credentials som registrerer sangen som kilde: navnet, SHA-256 av `.rondo.json`-filen og hvor koden kjørte. Det dekker WAV, MP3, M4A, Opus, FLAC, hver stemme i en ZIP med stemmer og et opptak av det som spilles.

- Redigeringsprogrammets egne gjengivelser kjører i sin private ramme (utførelsesklassen `frame`) og registrerer redigeringsprogrammets versjon.
- En gjengivelse laget av CLI-et eller en delingslenke kjører i klassen `vm` og registrerer gjengiverens versjon og frø.
- En WAV oppgir også det samme i RIFF-kommentaren sin.
- Musikk beregnet fra sangens kode er algoritmiske medier og merkes ikke som AI.

Når en sang synger, deklarerer filen at sangen er AI-generert i en maskinlesbar form. Credentialens digitale kildetype er sammensatt media laget med trente modeller, posten lister de sungne delene, og én C2PA AI-erklæring per modell identifiserer hver modell sangen gikk gjennom: Supertonic-3 tekst til tale, wav2vec 2.0-fonemjusteren, ContentVec-koderen og RVC-stemmen, med repositoriet og committen Lolly hoster den fra. En fil som holder syntetisert sang, lagres aldri uten den erklæringen.

En MIDI-fil har ikke plass til en credential, så en tekstbegivenhet i filen bærer erklæringen i stedet, og eksportpanelet sier fra om det. Panelet beskriver alt dette før du eksporterer, og etter hver eksport leser redigeringsprogrammet den lagrede filen tilbake og rapporterer bare det den lesingen fant.

For hva Content Credentials registrerer generelt, se [Export a file](/info/exporting.html#content-credentials-c2pa).
