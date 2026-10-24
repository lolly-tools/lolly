# Rondocode-nummers

Een rondocode-nummer is muziek geschreven als code: synths, patronen en een mix, afgespeeld terwijl je typt. Lolly kan een nummer onder een video afspelen, en met het hulpprogramma **Rondocode** schrijf je er een en exporteer je het als audio. Beide leggen het nummer vast in de Content Credentials van het bestand, zodat de muziek zegt waar ze vandaan komt.

## Een nummer afspelen in Lolly

De assetkiezer neemt een nummer aan als `.rondo`- of `.rondo.json`-bestand, of als geplakte `rondocode.com`-deellink. Een nummer is code die zijn eigen geluid maakt, dus het speelt op welke lengte zijn clip ook vraagt. Het kan het **muziekbed** onder een video-export zijn of spelen in de ambient-speler van Neurospicy Mode.

De code van het nummer draait in de sandbox van Lolly, zonder netwerk en zonder toegang tot je bestanden. Elk deel dat een render niet kan afspelen, zoals een live microfoon, of zang zonder de stemmodellen, staat vermeld in de details van de asset.

Vanaf de terminal neemt `lolly mix` een nummer als de hele soundtrack; zie [CLI rendering](/info/cli-rendering.html).

## Een nummer schrijven en exporteren

Open **Rondocode** vanuit **Utilities** om een nummer te schrijven in de live editor van rondocode en het te horen terwijl je typt. Exporteer het als **WAV**, **MP3**, **M4A**, **Opus** of **FLAC**, als een ZIP met stems, als **MIDI**, of als opname van wat wordt afgespeeld. **Export length** bepaalt hoeveel seconden een audio-export duurt. Het nummerbestand zelf (`.rondo.json`) is je code zoals geschreven en draagt niets extra's.

Een nummer kan zijn tekst zingen met `sing()`. De zang wordt op je apparaat gemaakt door gedownloade stemmodellen, en een bestand dat gesynthetiseerde zang bevat, verklaart de zang altijd als door AI gegenereerd (zie [AI features](/info/ai-features.html)).

## Nummers in de credential

Een video- of audio-export die een rondocode-nummer afspeelt, legt elk nummer vast in zijn Content Credentials als bron:

- de naam van het nummer;
- de SHA-256 van zijn `.rondo.json`-bestand;
- hoe het is gerenderd: in de sandbox van Lolly, de uitvoeringsklasse `vm`, met de versie en seed van de renderer, en elk deel dat de render niet kon afspelen.

Muziek die uit de code van een nummer wordt berekend, is gemarkeerd als algoritmische media, zodat Verify haar niet als AI markeert. Voordat je exporteert noemt een regel onder **Download** de nummers die de credential zal vastleggen; na de export meldt dezelfde regel wat een lezing van het bezorgde bestand vond. Haal het vinkje bij **C2PA Credentials** weg om het record weg te laten. Een stilstaande afbeelding legt geen nummer vast, omdat ze geen geluid draagt. `lolly mix` en de [MCP-server](/info/mcp.html) schrijven hetzelfde record.

## Bestanden van het Rondocode-hulpprogramma

De meeste hulpprogramma's op het apparaat schrijven geen credential, omdat ze een bestand transformeren dat je al bezit. Rondocode maakt nieuwe audio, dus elk audiobestand dat het schrijft draagt Content Credentials die het nummer als bron vastleggen: zijn naam, de SHA-256 van zijn `.rondo.json`-bestand en waar zijn code draaide. Dat dekt WAV, MP3, M4A, Opus, FLAC, elke stem in een stems-ZIP en een opname van wat wordt afgespeeld.

- De eigen renders van de editor draaien in zijn privéframe (de uitvoeringsklasse `frame`) en leggen de versie van de editor vast.
- Een render van de CLI of een deellink draait in de klasse `vm` en legt de versie en seed van de renderer vast.
- Een WAV zegt hetzelfde ook in zijn RIFF-opmerking.
- Muziek die uit de code van het nummer wordt berekend is algoritmische media en wordt niet als AI gemarkeerd.

Wanneer een nummer zingt, verklaart het bestand die zang in machineleesbare vorm als door AI gegenereerd. Het digitale brontype van de credential is samengestelde media gemaakt met getrainde modellen, het record somt de gezongen delen op, en één C2PA-AI-vermelding per model identificeert elk model waar de zang doorheen ging: Supertonic-3 tekst-naar-spraak, de wav2vec 2.0-fonemenuitlijner, de ContentVec-encoder en de RVC-stem, met de repository en commit waar Lolly het vandaan host. Een bestand met gesynthetiseerde zang wordt nooit zonder die verklaring opgeslagen.

Een MIDI-bestand heeft geen plek voor een credential, dus een tekstgebeurtenis in het bestand draagt de verklaring in plaats daarvan, en het exportpaneel zegt dat. Het paneel beschrijft dit alles voordat je exporteert, en na elke export leest de editor het opgeslagen bestand terug en meldt alleen wat die lezing vond.

Voor wat Content Credentials in het algemeen vastleggen, zie [Een bestand exporteren](/info/exporting.html#content-credentials-c2pa).
