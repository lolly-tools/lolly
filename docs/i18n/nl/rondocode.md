# Lolly Rondocode-nummers

<a id="rondocode-songs"></a>

Een rondocode-nummer is muziek die als code is geschreven: synths, patronen en een mix, afgespeeld terwijl je typt. Lolly kan een nummer onder een video afspelen, en het hulpprogramma **Rondocode** schrijft nummers en exporteert ze als audio; beide leggen het nummer vast in de Content Credentials van het bestand.

<!--i:eti-music-->
## Een nummer afspelen in Lolly

De assetkiezer accepteert een nummer als een `.rondo`- of `.rondo.json`-bestand of als een geplakte deellink van `rondocode.com`. Een nummer speelt zo lang als zijn clip vraagt. Het kan de **achtergrondmuziek** onder een video-export zijn of afspelen in de ambientplayer van Neurospicy Mode.

De code van het nummer draait in de sandbox van Lolly, zonder netwerk en zonder toegang tot je bestanden. Elk onderdeel dat een render niet kan afspelen, zoals een live microfoon of zang zonder de stemmodellen, staat in de details van de asset.

Vanuit de terminal gebruikt `lolly mix` een nummer als de volledige soundtrack; zie [CLI-rendering](/info/cli-rendering.html).

<!--i:eti-code-->
## Een nummer schrijven en exporteren

Open de tool **Rondocode** vanuit **Utilities** om een nummer te schrijven in de live editor van rondocode en het te horen terwijl je typt. Exporteer het als **WAV**, **MP3**, **M4A**, **Opus** of **FLAC**, als een ZIP met stems, als **MIDI** of als een opname van wat er speelt. Vanuit de terminal schrijft `lolly rondocode --export=mid` hetzelfde MIDI-bestand. **Export length** stelt in hoeveel seconden een audio-export duurt. Het nummerbestand (`.rondo.json`) is je code zoals geschreven, zonder toevoegingen.

Een nummer kan zijn tekst zingen met `sing()`. Gedownloade stemmodellen maken de zang op je apparaat. Een bestand dat gesynthetiseerde zang bevat, geeft de zang altijd op als AI-gegenereerd (zie [AI-functies](/info/ai-features.html)).

<!--i:eti-badge-check-->
## Nummers in de credential

Een video- of audio-export die een rondocode-nummer afspeelt, legt elk nummer als bron vast in zijn Content Credentials:

- de naam van het nummer;
- de SHA-256 van het `.rondo.json`-bestand;
- hoe het is gerenderd: in de sandbox van Lolly, de uitvoeringsklasse `vm`, met de versie en seed van de renderer en elk onderdeel dat de render niet kon afspelen.

Muziek die uit de code van een nummer is berekend, wordt gemarkeerd als algoritmische media, zodat Lolly Verify die niet als AI aanmerkt. Voordat je exporteert, vermeldt een regel onder **Download** de nummers die de credential zal vastleggen. Na de export meldt dezelfde regel wat er bij het lezen van het geleverde bestand is aangetroffen. Vink **C2PA Credentials** uit om de registratie weg te laten. Een stilstaande afbeelding legt geen nummer vast, omdat ze geen geluid heeft. Een stilstaande afbeelding legt geen nummer vast. `lolly mix` en de [MCP-server](/info/mcp.html) schrijven dezelfde registratie.

<!--i:eti-file-->
## Bestanden uit het hulpprogramma Rondocode

De meeste hulpprogramma's op het apparaat schrijven geen credential, omdat ze een bestand transformeren dat al van jou is. Lolly Rondocode maakt nieuwe audio, dus bevat elk audiobestand dat het schrijft Content Credentials die het nummer als bron vastleggen: WAV, MP3, M4A, Opus, FLAC, elke stem in een ZIP met stems en een opname van wat er speelt.

- De eigen renders van de editor draaien in zijn privéframe (de uitvoeringsklasse `frame`) en leggen de versie van de editor vast.
- Een render die door de CLI of een deellink is gemaakt, draait in de klasse `vm` en legt de versie en seed van de renderer vast.
- Een WAV vermeldt hetzelfde ook in zijn RIFF-commentaar.

Wanneer een nummer zingt, is de AI-verklaring machineleesbaar. Het digitale brontype van de credential is samengestelde media gemaakt met getrainde modellen, de registratie vermeldt de gezongen delen en één C2PA AI-vermelding per model identificeert elk model waar de zang doorheen ging: Supertonic-3 tekst-naar-spraak, de foneemuitlijner wav2vec 2.0, de ContentVec-encoder en de RVC-stem, met de repository en commit van waaruit Lolly het host.

### Wat het MIDI-bestand bevat

Het MIDI-bestand is een Standard MIDI File, formaat 1. Het eerste spoor bevat het tempo en een 4/4-maatsoort, gevolgd door één spoor per synth, met de naam van de synth. Elke noot behoudt zijn begin, lengte en aanslagsterkte. Een synth waarvan de naam een instrument aanduidt, zoals een bas, strijkers, een pad of een piano, krijgt het bijbehorende General MIDI-instrument, en een naam die op drums duidt, komt op kanaal 10. Een stemming die niet twaalftoons is, wordt afgerond op de dichtstbijzijnde halve toon met een pitch bend.

Een MIDI-bestand kan de synthinstellingen, filters, effecten, bussen, samples of zang niet bevatten, dus speelt een DAW de noten met zijn eigen instrumenten. Het tempo wordt afgelezen uit de cycli per seconde van het nummer, met één cyclus als een maat van vier tellen, omdat de eigen maatsoort van het nummer geen deel uitmaakt van wat de renderer teruggeeft.

Een MIDI-bestand heeft geen plaats voor een credential, dus bevat een tekstevent in het bestand de verklaring, en het exportpaneel vertelt je dat. Het paneel beschrijft dit allemaal voordat je exporteert. Na elke export leest de editor het opgeslagen bestand terug en meldt alleen wat er bij het lezen is aangetroffen.

Zie [Een bestand exporteren](/info/exporting.html#content-credentials-c2pa) voor wat Content Credentials in het algemeen vastleggen.
