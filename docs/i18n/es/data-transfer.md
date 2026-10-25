# Transferencia de datos: el paquete `lolly-backup`

Lolly guarda tu biblioteca personal en el dispositivo. Un paquete de copia de seguridad es cómo se traslada esa biblioteca: expórtalo en una instalación, lleva el archivo como quieras (USB, AirDrop, correo a ti mismo o un recurso de red) e impórtalo en otra. Exportar e importar no necesitan servidor, y el destino puede estar sin conexión.

Esta página es la especificación del formato, para quienes construyen shells, herramientas o scripts alrededor de las copias de seguridad: qué hay en el zip, cómo se controlan las versiones, cómo se fusiona una importación y qué se comprueba. La guía para quienes trasladan su propio trabajo es [Move your work to another device](/info/find-your-work.html#move-your-work-to-another-device).

![Los dos botones que mueven toda una instalación: Export my data escribe un zip, Import data lo vuelve a leer](/t/url-shot?url=%2F%23%2Fsettings%3Ffocus%3Dstorage-section&width=1440&height=1800&dpi=192&waitMs=2400&css=.store-move%3Ediv%3Anth-of-type%282%29%2C.store-move%3Ep%3Alast-of-type%7Bdisplay%3Anone%7D&waitSelector=%5Bdata-store-group%3Dmove%5D&drive=click%3A%5Bdata-store-group%3Dmove%5D%3Esummary&walker=1&format=svg&cropSelector=%5Bdata-store-group%3Dmove%5D&dark=1&filename=pd-transfer-controls)

> **Alcance.** Un paquete lleva *datos de usuario*, no herramientas del catálogo. Las herramientas y los recursos del catálogo se sincronizan por separado y se da por supuesto que ya están presentes en el destino, como mucho en una versión superior. Las herramientas que creó el propio usuario viajan dentro de `profile.json`. Importar nunca instala ni actualiza una herramienta del catálogo.

## Objetivos

- <!--i:box--> **Un formato, todos los shells.** La aplicación web, las aplicaciones de escritorio y móviles y los shells futuros comparten el mismo sobre y los mismos esquemas de partes. Las partes opcionales dependen de las capacidades de cada shell, y las partes no admitidas se notifican. Cada puente de capacidades aporta su adaptador de almacenamiento.
- <!--i:shieldcheck--> **Sobrevive al viaje.** Un paquete estropeado o truncado en tránsito falla de forma explícita al importar y nunca se restaura a medias.
- <!--i:clock--> **Sobrevive a esta versión.** Una aplicación más antigua aún puede importar las partes de un paquete más nuevo que reconoce. Un formato realmente incompatible se rechaza limpiamente.
- <!--i:check--> **Seguro de fusionar.** Importar sobre una instalación que ya está en uso nunca borra nada que no estuviera en el paquete.

## El sobre

Un paquete es un `.zip` simple, así que sobrevive intacto a cualquier transporte y cualquier herramienta de descompresión puede inspeccionar el contenido.

La descarga lleva el nombre de la persona a la que pertenece: `LollyTools-<First>-<Last>-<YYYY-MM-DD>-<n>.zip`, por ejemplo `LollyTools-Ada-Lovelace-2026-06-26-1.zip`, para que una carpeta de Descargas con copias de seguridad siga siendo legible. El nombre y el apellido proceden del perfil y se omiten cuando no están definidos: sin perfil da `LollyTools-2026-06-26-1.zip`, y solo un nombre da `LollyTools-Ada-2026-06-26-1.zip`. Cada nombre se reduce a un token seguro para nombres de archivo (se conservan letras y dígitos Unicode, se eliminan espacios y puntuación, como máximo 32 caracteres). `<n>` es una secuencia por día y por dispositivo, de modo que las exportaciones repetidas en un día no chocan y siguen en orden. `backupFilename()` en `data-transfer.ts` construye el nombre, y el contenido del zip es el mismo sea cual sea su nombre.

| Ruta | Obligatorio | Contenido |
|---|---|---|
| `manifest.json` | sí | ID del formato, versiones, recuentos e integridad por parte. Lo primero que mira un lector. |
| `profile.json` | cuando está definido | Todo el registro `me` del usuario: nombre, contacto, referencia e indicadores de la foto, más carpetas, Papelera, planos de proyecto, plantillas del usuario y herramientas creadas por el usuario, favoritos, herramientas ocultas, idioma y elección de emoji. Se lee mediante `host.profile`. |
| `sessions.json` | sí | Todas las sesiones guardadas: espacio, ID y versión de la herramienta, etiqueta, miniatura (URL de datos) y datos completos de entrada. Se lee mediante `host.state`. |
| `assets.json` | sí | Metadatos de cada recurso subido (imágenes, fuentes, tokens de marca, logotipos, copias guardadas de descargas), cada uno apuntando a sus bytes en `assets/blobs/`. |
| `assets/blobs/<n>.<ext>` | por recurso | Los bytes sin procesar del recurso, almacenados sin comprimir porque la mayoría ya son formatos comprimidos. La extensión es cosmética; el tipo MIME de `assets.json` es el que manda. |
| `assets/blobs/<n>.c2pa` | cuando existe | Content Credentials extraídas como bytes binarios exactos, referenciadas por `_credentialFile` en el registro del recurso. No son claves de firma del dispositivo. |
| `design-systems.json` | cuando existe | Los design systems creados o añadidos en esta instalación, como `{ active, records }`. Consulta [Import rules](#import-rules). |
| `file-history.json` | opcional | Instantáneas versionadas de recursos, informes de operaciones de archivo terminadas y manifiestos de lote completos, con una versión propia. Lo aporta el adaptador de copia de seguridad interno `fileHistory` del shell. |
| `revision-history.json` | opcional, copias manuales | ID de creación estables, puntos de control conservados, miniaturas y borradores de recuperación continuos. Lo aporta `host.state.history.backup` donde se admite. |
| `file-history/versions/` | por instantánea | Bytes anteriores de recursos y credenciales extraídas, exista o no ya el recurso actual. |
| `file-history/results/` | por operación terminada | Bytes exactos de salida. No se conserva ni se incluye ningún archivo original elegido para conversión. |
| `prefs.json` | sí | Preferencias locales del usuario: `theme`, `sidebarWidth` y el recuento de actividad `ct-metrics`. |
| `lolly.txt` | sí | Un resumen legible del paquete (recuentos, perfil, nombre de archivo) para quien abra el zip sin Lolly. Se regenera en cada exportación y se reconoce al importar, así que nunca cuenta como parte omitida. Se escribe después del mapa de integridad, así que el mapa no cubre este archivo. |

::: details Cómo escribe la exportación el zip
La exportación escribe el zip una parte cada vez (`shells/web/src/lib/zip-stream.ts`). Las subidas, los resultados guardados y las versiones guardadas de recursos se leen en porciones de 4 MiB, nunca enteros, y los resultados y versiones guardados se comprueban primero con su SHA-256 registrado. Luego se lee cada archivo para su suma de verificación y resumen de integridad, y el zip lo referencia donde está.

No se recodifica nada, así que un archivo con Content Credentials conserva los bytes exactos que cubre su firma, y cada parte conserva sus bytes y resumen exactos. Para las mismas partes y hora, el zip es idéntico al del anterior escritor en memoria, salvo que un archivo de historial de más de 16 MiB se comprime por trozos. `tests/backup-streaming.test.ts` lo comprueba con resúmenes de referencia registrados.

En una biblioteca sintética de 192 MiB, medido en Node, terminar la copia de seguridad requirió unos 125 a 150 MiB además de la biblioteca, frente a unos 850 MiB del escritor en memoria (`node scripts/bench-backup-finalise.ts`). La importación sigue leyendo todo el zip en memoria.
:::

## `manifest.json`

```json
{
  "format": "lolly-backup",
  "formatVersion": 3,
  "minReader": 1,
  "app": "lolly",
  "exportedAt": "2026-06-22T09:30:00.000Z",
  "counts": { "profile": true, "sessions": 2, "userAssets": 4, "prefs": 3, "assetVersions": 1, "fileOperations": 1 },
  "integrity": {
    "profile.json": "sha256-…",
    "sessions.json": "sha256-…",
    "assets.json": "sha256-…",
    "assets/blobs/0.bin": "sha256-…",
    "file-history.json": "sha256-…",
    "file-history/versions/0.bin": "sha256-…",
    "file-history/results/0.bin": "sha256-…",
    "prefs.json": "sha256-…"
  }
}
```

| Campo | Significado |
|---|---|
| `format` | Siempre `lolly-backup`. Un archivo sin él se rechaza como "not a Lolly backup". |
| `formatVersion` | El diseño con el que se **escribió** este paquete. Se incrementa con cualquier cambio en el conjunto de partes o sus formas. Los lectores **no** se rigen por este campo. |
| `minReader` | La versión mínima de lector que puede importar este paquete **con seguridad**. Este es el campo por el que se rigen los lectores. |
| `app` | ID de la aplicación productora, para diagnóstico. |
| `exportedAt` | Marca de tiempo ISO de creación del paquete. |
| `counts` | Lo que puso el escritor, para mostrar y comprobar la coherencia. |
| `integrity` | Opcional. Asigna a cada parte, salvo `manifest.json`, un resumen `sha256-<base64>` al estilo SRI de sus bytes **sin comprimir**. |

## Política de versiones

Dos números de versión permiten que el formato crezca sin dejar atrás las instalaciones más antiguas.

![Un cambio en el formato del paquete es aditivo, y los lectores antiguos pueden ignorarlo, o incompatible, y una importación errónea corrompe. El aditivo incrementa formatVersion y conserva minReader; el incompatible incrementa formatVersion y sube minReader. Un lector importa cuando minReader es como mucho su propia versión.](/info/diagrams/concepts/backup-version-gate.svg)

- Un lector importa un paquete cuando `manifest.minReader` es como mucho su propia versión de lector. Se niega, con "needs a newer version of the app", solo cuando el paquete exige un lector más nuevo.
- Un cambio **aditivo**, como una nueva parte opcional o un nuevo campo opcional del manifiesto, incrementa `formatVersion` y deja `minReader` como está. Las aplicaciones más antiguas aún importan todas las partes que reconocen, y las que no reconocen se notifican como omitidas, no se descartan en silencio.
- Un cambio **incompatible**, donde una importación errónea de una parte corrompe datos o una parte opcional pasa a ser obligatoria, sube `minReader`. Las aplicaciones más antiguas entonces se niegan limpiamente en lugar de importar algo que no pueden manejar.
- Si un paquete futuro define `formatVersion` pero omite `minReader`, los lectores recurren a regirse por `formatVersion` y tratan el cambio como incompatible.

> **Regla práctica para autores:** si cada lector existente haría lo correcto ignorando tu adición, el cambio es aditivo: incrementa `formatVersion` y deja `minReader`. Si no, sube `minReader`.

## Integridad

Cuando `manifest.integrity` está presente, un lector comprueba el SHA-256 de cada parte listada **antes de escribir nada**. Una discrepancia ("failed its integrity check") o una parte que falta ("incomplete") detiene toda la importación, así que no hay restauración parcial. Esto detecta el daño que puede causar un transporte de archivos: un AirDrop truncado, una pasarela de correo que recodificó el adjunto, un sector USB defectuoso.

La integridad es de mejor esfuerzo. Se escribe solo donde hay Web Crypto (cada contexto seguro de navegador y Node moderno), y se comprueba solo cuando están presentes tanto el mapa como Web Crypto. Un paquete sin el mapa, como uno anterior a que existiera la integridad, se importa sin cambios: "no se puede verificar" nunca cuenta como "corrupto".

El manifiesto no se lista a sí mismo ni a `lolly.txt` regenerado. Los resúmenes cubren las partes que avala el manifiesto.

## Reglas de importación

Una importación se ejecuta en uno de dos modos.

- **Merge** es lo que hace **Import data…**, y lo que hace la primera unión de sync, **Bring it to this device**. Los datos del destino se quedan, y no se toca nada que no estuviera en el paquete: una sesión que tenía el destino y no el paquete sobrevive a la importación.
- **Replace** es lo que usa la sincronización de dispositivos para mantenerlos al día: toma el registro de perfil de la copia sincronizada, las preferencias, las sesiones, las imágenes y la elección de design system activo, y elimina solo los elementos que otro dispositivo borró desde la última sincronización. Restaurar una copia anterior va más allá y hace que el dispositivo coincida con esa copia, eliminando todo lo que la copia no contiene, tras guardar antes el dispositivo. [Sync your devices](/info/sync.html) cubre lo que ve una persona.

En una fusión, se conserva todo lo que solo está en el destino, y cada tipo de dato del paquete se encuentra con el destino así:

| Dato | Ya en el destino | Solo en el paquete |
|---|---|---|
| Sesiones (por espacio) e imágenes subidas (por ID) | Se conserva la copia guardada más recientemente, así que una copia de seguridad más antigua nunca sobrescribe trabajo más nuevo. Si las horas son iguales o desconocidas, se conserva la copia del destino. | Se añade |
| Carpetas | Se conservan el nombre y el padre del destino, y la carpeta gana los miembros del paquete que le faltan. Una sesión archivada en una carpeta del destino sigue archivada allí. | Se añade |
| Favoritos (herramientas, recursos del catálogo y elementos de Projects) | Se combinan | Se añade |
| Plantillas, plantillas de Projects y herramientas del usuario (por ID) | Se conserva el registro del destino. | Se añade |
| Entradas de la Papelera | Se conserva la entrada del destino. | Se añade, de modo que un elemento que se podía restaurar en cualquiera de las instalaciones sigue pudiéndose. Se deja fuera una entrada cuya carpeta vuelve a estar en uso en el destino, o cuyo espacio de Papelera ya usa el destino. |
| Otros campos del perfil (nombre, datos de contacto, idioma, feature flags, herramientas ocultas y otros ajustes) | Se conserva el valor del destino. | Se toma cuando el campo del destino está vacío |
| Preferencias (`prefs.json`) | Se conserva el valor del destino. | Se escribe donde el destino no tiene ninguna |
| Design systems (por ID) | El registro del paquete sustituye al del destino. | Se añade. La elección activa del paquete se aplica solo cuando el destino no tiene ningún design system propio. |
| Historial de creación | La copia guardada más recientemente sigue vigente, y la otra se conserva como borrador protegido. | Se añade |

**Las sesiones guardadas se vuelven a vincular automáticamente a sus imágenes.** Las referencias a recursos se guardan por ID, y el puente las vuelve a resolver tras restaurar las imágenes, lo que tiene que hacer de todos modos porque las URL `blob:` no sobreviven a una recarga.

**Los registros de historial nunca cambian tras escribirse.** Una importación repetida de versiones de recursos e ID de operaciones no añade nada, y un ID que ya nombra bytes o historial distintos se rechaza, no se sobrescribe. Reimportar un recurso actual idéntico conserva su versión, y un recurso actual cambiado debe llevar una versión distinta.

**El historial de creación tiene algunas reglas más.** Una creación cuyo espacio el destino usa para una creación distinta se añade como creación separada, y una creación en la Papelera del destino se queda allí. Un ID de punto de control que nombra contenido distinto en el destino conserva el del destino. Un archivo que no pasa sus propias comprobaciones detiene la importación antes de que cambie cualquier perfil, sesión, recurso o preferencia, y una importación repetida idéntica no añade almacenamiento.

**El resumen informa de lo ocurrido.** Cada importación devuelve `profile`, `sessions`, `userAssets`, `prefs`, `skipped` y `failedAssets`.

- `failedAssets` cuenta los recursos subidos que no se pudieron restaurar, por ejemplo porque el almacenamiento del dispositivo está lleno.
- `skipped` cuenta las partes de un escritor más nuevo que esta compilación no reconoció. La aplicación lo muestra ("… · N newer items skipped"), de modo que una restauración indica lo que dejó atrás.
- Con historial de archivos, el resumen añade `assetVersions`, `fileOperations`, `fileBatches` y `failedHistory`. El agotamiento del almacenamiento o un conflicto de ID inmutable pueden causar una restauración parcial, y la aplicación entonces indica a la persona que conserve la copia de seguridad de origen.
- Con historial de creación, añade `revisions` y `recoveryDrafts`, contando solo lo que añadió esta importación, y `added`, `kept`, `replaced`, `copies` y `hidden` para cómo se fusionó cada creación. `skippedCheckpoints` cuenta los puntos de control cuyo ID nombra contenido distinto en el destino, y `historyLeftOut` cuenta los puntos de control y borradores más antiguos que no cupieron en el espacio de historial del dispositivo.
- Una importación de sustitución añade `removed` y `failedRemovals`.

Restaurar no es una única transacción entre los almacenes de perfil, sesiones, recursos e historial. La sincronización en la nube **no** avanza su revisión aplicada tras una restauración parcial o no admitida, de modo que la copia sigue disponible para reintentar.

## Qué no viaja

- **Cachés del catálogo** (metadatos y blobs de recursos descargados, el índice de herramientas), que el destino vuelve a sincronizar gratis.
- **Herramientas y recursos del catálogo**, que quedan fuera de alcance y se da por supuesto que están presentes en el destino. Los tokens de marca, las fuentes y los logotipos que añadió el usuario son recursos del usuario, así que sí viajan.
- **URL `blob:` y de objeto**, que el puente regenera al cargar.
- **Originales de conversión, arrendamientos de ejecución activos y secretos locales de acceso o firma de la máquina.** No son historial portátil. Un resultado guardado es una copia, no una promesa de que se hizo copia de seguridad del origen original.
- **El contador de secuencia de exportación**, el contador diario de nombres de descarga en `localStorage` (`lolly-export-seq`). Se mantiene fuera de `PREF_KEYS`, así que nunca viaja en un paquete.

El medidor de almacenamiento muestra la misma división. Saved sessions, My images y File results & versions entran en un paquete. La caché de recursos, las vistas previas de herramientas y los anclajes sin conexión de debajo se pueden reconstruir, así que se quedan atrás.

![El medidor de almacenamiento desglosando los datos de este dispositivo en categorías con nombre, con Saved sessions y My images contados aparte de la Asset cache, aquí en una instalación nueva donde todas las categorías siguen vacías](/t/url-shot?url=%2F%23%2Fprofile%3Ffocus%3Dstorage-section&width=1440&height=1600&dpi=192&waitMs=2600&format=svg&css=%5Bdata-store-group%3Dmove%5D%2C.storage-actions%2C.store-selbar%7Bdisplay%3Anone%7D&cropSelector=.store-meter&waitSelector=%5Bdata-store-group%3Dmove%5D&drive=click%3A%5Bdata-store-group%3Dwork%5D%3Esummary%3Bclick%3A%5Bdata-store-group%3Dcaches%5D%3Esummary&walker=1&dark=1&filename=ce-storage-categories)

## Datos de la organización con Lolly Work

Este paquete hace copia de seguridad de la biblioteca personal del dispositivo. No es una copia de seguridad de una instancia de **Lolly Work**: las cuentas de la organización, las políticas de acceso, los proyectos compartidos, las versiones del catálogo, las aprobaciones, los trabajos de renderizado y los registros de auditoría los guarda ese servicio. Reconéctate e inicia sesión para recuperar el acceso al trabajo compartido; importar un paquete personal no concede ese acceso.

Los operadores hacen copia de seguridad, conservan y borran los datos del servidor con las guías propias de Lolly Work: [Backup and restore](/info/work-operations.html#backup-and-restore) y [Work storage and data lifecycle](/info/work-data-lifecycle.html). Borrar o exportar un dispositivo no hace ninguna de esas operaciones del servidor.

## Entre shells

`data-transfer.ts` lee y escribe solo mediante el puente de capacidades (`host.profile`, `host.state`, `host.assets`) y las preferencias compartidas de `localStorage`. El mismo módulo lee y escribe el sobre común en la web y en las aplicaciones de escritorio y móviles, sobre almacenamiento IndexedDB o de sistema de archivos. Las partes opcionales de historial aparecen solo donde su adaptador está disponible, y una parte no admitida se notifica como omitida al importar. La batería sin interfaz ejercita las partes comunes con un puente en memoria, y las transacciones de historial también tienen pruebas en navegador real.

Dos shells quedan fuera de esa garantía, por razones distintas:

- La **CLI de una sola ejecución** no tiene nada que llevar: su estado está en memoria y dura una invocación.
- La **TUI** guarda el estado en `~/.lolly` (sesiones, carpetas, perfil), y su vista Profile puede hacer copia de seguridad, pero escribe un archivo más sencillo propio: `saved-state/<slot>.json` por sesión más `profile.json` y `folders.json`, sin manifiesto, sin `formatVersion` ni `minReader` y sin mapa de integridad. Este formato no puede importarlo (un lector lo rechaza como "not a Lolly backup"), y su nombre es confusamente parecido (`lolly-backup-<stamp>.zip`). Unificar ambos es una carencia conocida.

## Todavía no portable

El sobre es un manifiesto más partes con nombre, así que nuevos tipos de datos portátiles pueden unirse más adelante como partes aditivas (un `formatVersion` nuevo, el mismo `minReader`), y los lectores de hoy omiten lo que no reconocen. Los design systems ya viajan así, como `design-systems.json` más sus recursos de usuario.

Dos nombres están reservados para datos que todavía no viajan:

- **`tokens.json`** llevaría un documento completo de design tokens [W3C DTCG](https://tr.designtokens.org/format/) con sus grupos, conjuntos y temas, el formato que [Penpot importa y exporta](https://help.penpot.app/user-guide/design-systems/design-tokens/). Los tokens de marca propios de un usuario ya viajan como el recurso `user/tokens/brand` en `assets.json`, y los tokens de un design system viajan con su registro.
- **`penpot/`** está reservado para un archivo de Penpot ingerido, o su subconjunto relevante para Lolly, expuesto como herramienta.

Los lectores de hoy no conocen todavía ninguno de los dos nombres. Como cualquier otra cosa fuera de las partes anteriores, cada uno es una parte desconocida para ellos: se deja intacta y se cuenta en `skipped`.

## Partes de historial

Las dos partes de historial son opcionales y tienen sus propias versiones. La mayoría de los lectores pueden omitir esta sección.

::: details Historial de creación (v3)
Las copias de seguridad manuales de una instalación web con historial de creación incluyen `revision-history.json`, con su propio esquema `{ version: 1, documents, revisions, recoveries }`. Lleva los ID conservados, instantáneas canónicas de entradas, sellos de versión, vistas previas de trama y borradores de escritor separados. El adaptador de historial captura las sesiones actuales y sus cabezas en una única transacción de lectura, y `sessions.json` usa las mismas instantáneas actuales para lectores más antiguos.

La restauración comprueba el SHA-256 de la carga y los recuentos de bytes, las identidades únicas, las relaciones entre documentos y cabezas, la ascendencia, las marcas de tiempo, los tipos de vista previa y los límites antes de confirmar el archivo en una transacción. Las referencias a padres compactadas pueden faltar. El trabajo actual existente nunca se sustituye en silencio: cuando una creación está en ambos lados, el lado que no se conserva como actual pasa a ser un borrador protegido.

El límite de transferencia de 384 MiB del archivo se comprueba de forma explícita, y los límites de almacenamiento se aplican sin truncar los puntos de control conservados. La exportación escribe `revision-history.json` y `sessions.json` por trozos, con los mismos bytes que da un único `JSON.stringify`, de modo que el texto del archivo nunca se guarda entero. Un archivo de historial que superaría el límite se descarta en el momento en que lo hace y solo se cuenta desde ahí. El archivo se vuelve a crear entonces sin sus puntos de control automáticos más antiguos, y el resumen de exportación los cuenta como `checkpointsLeftOut`, o el archivo se rechaza entero.

Un shell sin esta capacidad restaura las sesiones normales y notifica la parte de historial como omitida. El historial nativo del sistema de archivos sigue sin admitirse hasta que su adaptador aporte transacciones de historial duraderas. Los invitados en una collab privada no tienen historial duradero ni archivo de recuperación.

La sincronización personal por instantáneas deja fuera el historial de creación. Aplicar una instantánea a un documento local con historial conserva su estado de trabajo anterior como borrador de recuperación separado e invalida el token de escritura de cualquier editor abierto. Sus puntos de control inmutables se quedan en el dispositivo. Esto protege el historial local durante una sustitución por instantánea; no fusiona historiales concurrentes de dispositivos.

Las referencias históricas a recursos se conservan, mientras que el renderizado sigue resolviendo los recursos mediante la biblioteca existente del destino. Este archivo todavía no garantiza los bytes exactos de recursos antiguos ni los renderizados antiguos de herramientas. Los bytes de versiones de recursos y de resultados de archivos viajan en su propia parte de copia de seguridad.
:::

::: details Versiones guardadas y resultados de archivos (v2)
La parte opcional de historial contiene `{ version: 2, assetVersions: [...], operations: [...], batches: [...] }`, y los lectores también aceptan la forma anterior history-v1 sin lotes. Cada instantánea da el ID estable del recurso y la versión exacta, su hora de guardado, longitud en bytes y SHA-256 hexadecimal, más un registro de recurso cuyo `_file` y `_credentialFile` opcional apuntan a partes binarias. Las operaciones llevan los datos del archivo original, la solicitud, el informe, las marcas de tiempo y un `_file` de resultado opcional. Los nombres de backend de almacenamiento, los manejadores OPFS y los arrendamientos de ejecución no viajan. Los lectores que solo conocen history v1 rechazan la nueva versión de historial antes de importar, en lugar de descartar en silencio la pertenencia a lotes.

Los manifiestos de lote registran cada origen seleccionado antes del procesamiento, incluidos los archivos nunca leídos, los miembros cancelados, los fallos al reservar espacio de resultados y el trabajo interrumpido. Cada miembro tiene un ID de operación estable, referencia y datos del origen, nombre de salida solicitado e informe final. Un origen sin leer tiene datos declarados, no un resumen inventado. La importación valida la identidad de los miembros y su coherencia con cualquier informe de operación que se lleve. Los informes de lote siguen disponibles cuando se han eliminado resultados individuales, pero un recibo no significa que sus bytes de salida sigan almacenados.

- **Primero la validación.** Cada registro de historial, informe y archivo referenciado conocido se valida antes de que escriba cualquier importación de perfil o de recursos. Los bytes que faltan y un SHA-256 que no coincide fallan incluso cuando el sobre no tiene mapa de integridad. Las credenciales extraídas siguen siendo matrices de bytes, incluidas las importaciones de escritores más antiguos que las serializaban como objetos con claves numéricas.
- **Trabajo en curso.** Las operaciones en curso pasan a ser registros interrumpidos en la copia de seguridad, con un informe de fallo explicativo y sin resultado. Restaurar nunca reinicia el trabajo en segundo plano ni importa un arrendamiento activo. Reintentar significa seleccionar de nuevo el archivo original, comprobado con su SHA-256 registrado cuando está disponible.
- **Almacenamiento.** Los resultados restaurados confirman sus bytes y metadatos juntos en IndexedDB. Los resultados nuevos normales usan OPFS donde está disponible, con IndexedDB como alternativa. Una importación nunca sustituye una operación activa existente.
- **Límites de la copia de seguridad.** La exportación transmite estos bytes al archivo, pero la restauración sigue descomprimiendo toda la copia de seguridad en memoria, así que los límites se mantienen: **256 MiB de carga de historial**, **4 MiB de metadatos de historial**, como máximo **100 operaciones**, **100 lotes** y **2000 instantáneas**. La exportación rechaza explícitamente un historial demasiado grande o incompleto y nunca lo deja fuera en silencio. Descarga las versiones y resultados importantes uno a uno antes de eliminar copias locales más antiguas. Estos límites no son una garantía de memoria máxima medida para teléfonos.
- **Presupuestos locales.** El historial local de resultados tiene un presupuesto de 512 MiB y un tope de 100 registros. Las instantáneas de recursos tienen un presupuesto separado de 512 MiB y como máximo 20 versiones históricas por recurso, y los bytes de credenciales extraídas cuentan para ese presupuesto. La restauración respeta estos límites y nunca expulsa en silencio datos existentes del usuario.
- **Metadatos de lote.** Los metadatos locales de lote tienen un presupuesto separado de 4 MiB, como máximo 100 manifiestos y 20 miembros por lote. Los miembros pendientes reservan capacidad de metadatos, con un techo de 32 KiB de informe por miembro. Es un presupuesto lógico, no una garantía de espacio en disco del navegador: un fallo real de cuota se muestra, y el informe en memoria sigue siendo descargable. Reintentar un miembro de lote crea un lote nuevo sin sobrescribir el informe antiguo. Eliminar un registro de lote no elimina los bytes de resultados individuales ni los recursos de la biblioteca.
- **Resultados en la biblioteca.** Los resultados convertidos se pueden añadir a la biblioteca sin normalización ni recodificación, con los resúmenes de origen y salida y la relación de la operación adjuntos. Las adiciones repetidas reutilizan una copia sin cambios, y una copia editada nunca se sobrescribe. Las imágenes de trama pueden iniciar un documento nuevo de Design, que usa el ID actual del recurso de la biblioteca; aplicar anclajes de versión exactos en todo el runtime y la ruta de URL de Design es trabajo aparte. Los resultados SVG, HTML, PDF y ZIP se conservan como recursos de archivo opacos, no se promueven a contenido interactivo o vectorial de confianza.
- **Dónde lo ve la gente.** **Convert → Recent file operations** muestra el uso del historial, informes, descargas y el gestor de versiones, que también encuentra versiones anteriores de recursos de biblioteca eliminados. Restaurar una instantánea crea una versión actual nueva y conserva la instantánea seleccionada. **Settings → Preferences → Storage** cuenta los resultados y las versiones por separado de las cachés desechables.
- **Limpieza.** La limpieza explícita de archivos temporales elimina solo los bytes propiedad de una operación y sin referencias. Los registros actuales protegen sus archivos, y los archivos OPFS recientes tienen un periodo de gracia de una hora. Los resultados guardados y las instantáneas de recursos no se borran automáticamente.

Los lectores más antiguos aún aceptan el sobre v2 (`minReader: 1`) y restauran las partes que conocen, contando como omitidas las partes de historial no admitidas. La recuperación completa del historial necesita un shell con el adaptador `fileHistory`, una costura dentro del shell y no una nueva capacidad de `HostV1` de cara a las herramientas. La restauración real entre dos dispositivos está cubierta por la comprobación local de Chromium; la recuperación en las aplicaciones instaladas de escritorio, iOS y Android todavía está pendiente de aceptarse por separado.
:::

## Referencia

- Módulo: `shells/web/src/data-transfer.ts` (`exportBackup`, `importBackup`, `BACKUP_FORMAT`, `BACKUP_FORMAT_VERSION`, `BACKUP_READER_VERSION`; el nombrador `backupFilename()` es interno).
- Prueba de contrato: `tests/data-transfer.test.ts`, que cubre el viaje de ida y vuelta, la fusión, la integridad, la compatibilidad hacia delante y la puerta del lector.
- Pruebas de contrato del historial: `tests/file-history-backup.test.ts`, `tests/file-batch-history.test.ts` y `tests/file-result-library.test.ts`. Aceptación en navegador: `tests/file-history.browser.test.ts`, `tests/file-batch-history.browser.test.ts` y `tests/file-result-reuse.browser.test.ts`.
- Superficie del puente usada: `host.profile`, `host.state` y `host.assets`; consulta [Host API](/info/host-api.html).
