# Canciones de Rondocode

Una canción de rondocode es música escrita como código: sintetizadores, patrones y una mezcla, que suena mientras escribes. Lolly puede reproducir una canción bajo un vídeo, y la utilidad **Rondocode** te permite escribir una y exportarla como audio. Ambas registran la canción en las Content Credentials del archivo, para que la música diga de dónde viene.

## Reproducir una canción en Lolly

El selector de recursos acepta una canción como archivo `.rondo` o `.rondo.json`, o como enlace compartido de `rondocode.com` pegado. Una canción es código que produce su propio sonido, así que suena con la duración que pida su clip. Puede ser la **base musical** de una exportación de vídeo o sonar en el reproductor ambiental de Neurospicy Mode.

El código de la canción se ejecuta en el sandbox de Lolly, sin red y sin acceso a tus archivos. Cualquier parte que un renderizado no pueda reproducir, como un micrófono en vivo, o el canto sin los modelos de voz, se enumera en los detalles del recurso.

Desde la terminal, `lolly mix` toma una canción como toda la banda sonora; consulta [CLI rendering](/info/cli-rendering.html).

## Escribir y exportar una canción

Abre **Rondocode** desde **Utilities** para escribir una canción en el editor en vivo de rondocode y oírla mientras escribes. Expórtala como **WAV**, **MP3**, **M4A**, **Opus** o **FLAC**, como un ZIP de stems, como **MIDI**, o como una grabación de lo que suena. **Export length** define cuántos segundos dura una exportación de audio. El archivo de la canción en sí (`.rondo.json`) es tu código tal como lo escribiste y no lleva nada añadido.

Una canción puede cantar su letra con `sing()`. El canto lo crean en tu dispositivo modelos de voz descargados, y un archivo que contiene canto sintetizado siempre declara el canto como generado por IA (consulta [AI features](/info/ai-features.html)).

## Canciones en la credencial

Una exportación de vídeo o audio que reproduce una canción de rondocode registra cada canción en sus Content Credentials como una fuente:

- el nombre de la canción;
- el SHA-256 de su archivo `.rondo.json`;
- cómo se renderizó: en el sandbox de Lolly, la clase de ejecución `vm`, con la versión y la semilla del renderizador, y cualquier parte que el renderizado no pudo reproducir.

La música calculada a partir del código de una canción se marca como medio algorítmico, así que Verify no la señala como IA. Antes de exportar, una línea bajo **Download** enumera las canciones que registrará la credencial; tras la exportación, la misma línea informa de lo que encontró una lectura del archivo entregado. Desmarca **C2PA Credentials** para dejar fuera el registro. Una imagen fija no registra ninguna canción, porque no lleva sonido. `lolly mix` y el [servidor MCP](/info/mcp.html) escriben el mismo registro.

## Archivos de la utilidad Rondocode

La mayoría de las utilidades en el dispositivo no escriben credencial, porque transforman un archivo que ya es tuyo. Rondocode crea audio nuevo, así que cada archivo de audio que escribe lleva Content Credentials que registran la canción como su fuente: su nombre, el SHA-256 de su archivo `.rondo.json` y dónde se ejecutó su código. Eso abarca WAV, MP3, M4A, Opus, FLAC, cada stem de un ZIP de stems y una grabación de lo que suena.

- Los renderizados propios del editor se ejecutan en su marco privado (la clase de ejecución `frame`) y registran la versión del editor.
- Un renderizado hecho por la CLI o un enlace compartido se ejecuta en la clase `vm` y registra la versión y la semilla del renderizador.
- Un WAV también indica lo mismo en su comentario RIFF.
- La música calculada a partir del código de la canción es un medio algorítmico y no se marca como IA.

Cuando una canción canta, el archivo declara ese canto generado por IA en un formato legible por máquina. El tipo de fuente digital de la credencial es medio compuesto hecho con modelos entrenados, el registro enumera las partes cantadas, y una declaración de IA de C2PA por modelo identifica cada modelo por el que pasó el canto: la síntesis de voz Supertonic-3, el alineador de fonemas wav2vec 2.0, el codificador ContentVec y la voz RVC, con el repositorio y el commit desde el que Lolly lo aloja. Un archivo que contiene canto sintetizado nunca se guarda sin esa declaración.

Un archivo MIDI no tiene lugar para una credencial, así que un evento de texto del archivo lleva la declaración en su lugar, y el panel de exportación te lo dice. El panel describe todo esto antes de exportar, y tras cada exportación el editor vuelve a leer el archivo guardado e informa solo de lo que encontró esa lectura.

Para lo que registran las Content Credentials en general, consulta [Export a file](/info/exporting.html#content-credentials-c2pa).
