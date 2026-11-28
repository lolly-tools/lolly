# Canciones de Lolly Rondocode

<a id="rondocode-songs"></a>

Una canción de rondocode es música escrita como código: sintetizadores, patrones y una mezcla, que se reproducen mientras escribes. Lolly puede reproducir una canción de fondo en un vídeo, y la utilidad **Rondocode** permite escribir canciones y exportarlas como audio; ambos registran la canción en las Content Credentials del archivo.

<!--i:eti-music-->
## Reproducir una canción en Lolly

El selector de recursos acepta una canción como archivo `.rondo` o `.rondo.json`, o como enlace para compartir de `rondocode.com` pegado. Una canción se reproduce durante el tiempo que pida su clip. Puede ser la **base musical** de una exportación de vídeo o sonar en el reproductor ambiental de Neurospicy Mode.

El código de la canción se ejecuta en el entorno aislado de Lolly, sin red ni acceso a tus archivos. Cualquier parte que un renderizado no pueda reproducir, como un micrófono en vivo o canto sin los modelos de voz, se enumera en los detalles del recurso.

Desde el terminal, `lolly mix` acepta una canción como banda sonora completa; consulta [Renderizado con la CLI](/info/cli-rendering.html).

<!--i:eti-code-->
## Escribir y exportar una canción

Abre la herramienta **Rondocode** desde **Utilities** para escribir una canción en el editor en vivo de rondocode y escucharla mientras escribes. Expórtala como **WAV**, **MP3**, **M4A**, **Opus** o **FLAC**, como un ZIP de stems, como **MIDI** o como una grabación de lo que está sonando. Desde el terminal, `lolly rondocode --export=mid` escribe el mismo archivo MIDI. **Export length** establece cuántos segundos dura una exportación de audio. El archivo de la canción (`.rondo.json`) es tu código tal como lo escribiste, sin nada añadido.

Una canción puede cantar su letra con `sing()`. Los modelos de voz descargados generan el canto en tu dispositivo. Un archivo que contiene canto sintetizado siempre declara que el canto se generó con IA (consulta [Funciones de IA](/info/ai-features.html)).

<!--i:eti-badge-check-->
## Canciones en la credencial

Una exportación de vídeo o audio que reproduce una canción de rondocode registra cada canción como fuente en sus Content Credentials:

- el nombre de la canción;
- el SHA-256 de su archivo `.rondo.json`;
- cómo se renderizó: en el entorno aislado de Lolly, la clase de ejecución `vm`, con la versión y la semilla del renderizador y cualquier parte que el renderizado no pudo reproducir.

La música calculada a partir del código de una canción se marca como contenido algorítmico, así que Lolly Verify no la señala como IA. Antes de exportar, una línea bajo **Download** enumera las canciones que registrará la credencial. Tras la exportación, la misma línea informa de lo que encontró al leer el archivo entregado. Desmarca **C2PA Credentials** para omitir el registro. Una imagen estática no registra ninguna canción, porque no tiene sonido. Una imagen estática no registra ninguna canción. `lolly mix` y el [servidor MCP](/info/mcp.html) escriben el mismo registro.

<!--i:eti-file-->
## Archivos de la utilidad Rondocode

La mayoría de las utilidades en el dispositivo no escriben ninguna credencial, porque transforman un archivo que ya te pertenece. Lolly Rondocode crea audio nuevo, así que cada archivo de audio que escribe lleva Content Credentials que registran la canción como fuente: WAV, MP3, M4A, Opus, FLAC, cada stem de un ZIP de stems y una grabación de lo que está sonando.

- Los renderizados del propio editor se ejecutan en su marco privado (la clase de ejecución `frame`) y registran la versión del editor.
- Un renderizado creado por la CLI o un enlace para compartir se ejecuta en la clase `vm` y registra la versión y la semilla del renderizador.
- Un WAV también declara lo mismo en su comentario RIFF.

Cuando una canción canta, la declaración de IA es legible por máquinas. El tipo de fuente digital de la credencial es contenido compuesto creado con modelos entrenados, el registro enumera las partes cantadas y una declaración de IA C2PA por modelo identifica cada modelo por el que pasó el canto: la conversión de texto a voz de Supertonic-3, el alineador de fonemas wav2vec 2.0, el codificador ContentVec y la voz RVC, con el repositorio y el commit a partir de los que Lolly lo aloja.

### Qué contiene el archivo MIDI

El archivo MIDI es un Standard MIDI File de formato 1. La primera pista contiene el tempo y un compás de 4/4, seguida de una pista por sintetizador, con el nombre del sintetizador. Cada nota conserva su inicio, duración y velocidad. Un sintetizador cuyo nombre se interpreta como un instrumento, como un bajo, cuerdas, un pad o un piano, recibe el instrumento General MIDI correspondiente, y un nombre de tipo percusión va al canal 10. Una afinación que no sea de doce tonos se redondea al semitono más cercano con un pitch bend.

Un archivo MIDI no puede contener los ajustes de los sintetizadores, filtros, efectos, buses, muestras ni canto, así que una DAW reproduce las notas con sus propios instrumentos. El tempo se lee a partir de los ciclos por segundo de la canción, con un ciclo como compás de cuatro tiempos, porque el compás propio de la canción no forma parte de lo que devuelve el renderizador.

Un archivo MIDI no tiene lugar para una credencial, así que un evento de texto del archivo lleva la declaración, y el panel de exportación te lo indica. El panel describe todo esto antes de exportar. Tras cada exportación, el editor vuelve a leer el archivo guardado e informa solo de lo que encontró en esa lectura.

Para saber qué registran las Content Credentials en general, consulta [Exportar un archivo](/info/exporting.html#content-credentials-c2pa).
