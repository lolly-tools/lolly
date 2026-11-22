# Transferencia de datos: el paquete `lolly-backup`

Un paquete de copia de seguridad traslada la biblioteca personal que Lolly conserva en el dispositivo: expórtala en una instalación, lleva el archivo (USB, AirDrop, un correo a ti mismo o un recurso compartido de red) e impórtalo en otra. La exportación y la importación no necesitan servidor, y el destino puede estar sin conexión.

Esta es la especificación del formato para quienes crean entornos, herramientas o scripts en torno a las copias de seguridad. Para trasladar tu propio trabajo, lee [Trasladar tu trabajo a otro dispositivo](/info/find-your-work.html#move-your-work-to-another-device).

![Los dos botones que trasladan una instalación completa: Export my data escribe un zip e Import data lo vuelve a leer](/t/url-shot?url=%2F%23%2Fsettings%3Ffocus%3Dstorage-section&width=1440&height=1800&dpi=192&waitMs=2400&css=.store-move%3Ediv%3Anth-of-type%282%29%2C.store-move%3Ep%3Alast-of-type%7Bdisplay%3Anone%7D&waitSelector=%5Bdata-store-group%3Dmove%5D&drive=click%3A%5Bdata-store-group%3Dmove%5D%3Esummary&walker=1&format=svg&cropSelector=%5Bdata-store-group%3Dmove%5D&dark=1&filename=pd-transfer-controls)

::: note Alcance
Un paquete lleva *datos de usuario*, no herramientas del catálogo. Las herramientas y los recursos del catálogo se sincronizan por separado y se da por hecho que están presentes en el destino, en el peor caso en una versión superior. Las herramientas que creó un usuario viajan dentro de `profile.json`. La importación nunca instala ni actualiza una herramienta del catálogo.
:::

<!--i:eti-badge-check-->
## Objetivos

- <!--i:box--> **Un formato, todos los entornos.** La aplicación web, las aplicaciones de escritorio y móviles y los futuros entornos comparten la misma envoltura y los mismos esquemas de partes. Las partes opcionales dependen de las capacidades de cada entorno, y se informa de las partes no compatibles. Cada puente de capacidades proporciona su adaptador de almacenamiento.
- <!--i:shieldcheck--> **Resiste el traslado.** Un paquete dañado o truncado durante el traslado falla al importarse con un error y nunca se restaura a medias.
- <!--i:clock--> **Perdura más allá de esta versión.** Una aplicación antigua importa las partes que reconoce de un paquete más reciente. Un formato incompatible se rechaza sin problemas.
- <!--i:check--> **Se puede combinar con seguridad.** Importar en una instalación que ya está en uso nunca borra nada que no estuviera en el paquete.

<!--i:eti-package-->
## La envoltura

Un paquete es un `.zip` normal. Se conserva intacto en cualquier traslado, y cualquier herramienta para descomprimir ZIP puede inspeccionar el contenido.

La descarga lleva el nombre de su propietario: `LollyTools-<First>-<Last>-<YYYY-MM-DD>-<n>.zip`, por ejemplo `LollyTools-Ada-Lovelace-2026-06-26-1.zip`. El nombre y el apellido proceden del perfil y se omiten cuando no están definidos: sin perfil resulta `LollyTools-2026-06-26-1.zip`, y con solo un nombre resulta `LollyTools-Ada-2026-06-26-1.zip`. Cada nombre se convierte en un token válido para nombres de archivo (se conservan letras y dígitos Unicode, se eliminan espacios y puntuación, con un máximo de 32 caracteres). `<n>` es una secuencia por día y por dispositivo, así que las exportaciones repetidas en un día no coinciden y mantienen el orden. `backupFilename()` en `data-transfer.ts` construye el nombre. El nombre no cambia el contenido del zip.

| Ruta | Obligatorio | Contenido |
|---|---|---|
| `manifest.json` | sí | Id de formato, versiones, cantidades e integridad por parte. Un lector lee este archivo primero. |
| `profile.json` | cuando está definido | El registro `me` del usuario: nombre, contacto, referencia de foto de perfil e indicadores, además de carpetas, Trash, esquemas de proyecto, plantillas de usuario y herramientas creadas por el usuario, favoritos, herramientas ocultas, idioma y elección de emoji. Se lee mediante `host.profile`. |
| `sessions.json` | sí | Cada sesión guardada: posición, id y versión de la herramienta, etiqueta, miniatura (URL de datos) y datos de entrada completos. Se lee mediante `host.state`. |
| `assets.json` | sí | Metadatos de cada recurso subido (imágenes, fuentes, tokens de marca, logotipos, copias guardadas de descargas), cada uno apuntando a sus bytes bajo `assets/blobs/`. |
| `assets/blobs/<n>.<ext>` | por recurso | Los bytes sin procesar del recurso, almacenados sin comprimir porque la mayoría ya son formatos comprimidos. La extensión es estética; el tipo MIME en `assets.json` es el que determina el formato. |
| `assets/blobs/<n>.c2pa` | cuando está presente | Content Credentials extraídas como bytes binarios exactos, referenciadas por `_credentialFile` en el registro del recurso. No son claves de firma del dispositivo. |
| `design-systems.json` | cuando está presente | Los design systems creados o añadidos en esta instalación, como `{ active, records }`. Consulta [Reglas de importación](#import-rules). |
| `file-history.json` | opcional | Instantáneas de recursos con versiones, informes de operaciones de archivo terminadas y manifiestos de lotes completos, con una versión propia. Lo proporciona el adaptador interno de copias de seguridad `fileHistory` del entorno. |
| `revision-history.json` | opcional, copias de seguridad manuales | IDs estables de creación, puntos de control conservados, miniaturas y borradores de recuperación rotativos. Lo proporciona `host.state.history.backup` donde es compatible. |
| `file-history/versions/` | por instantánea | Bytes anteriores del recurso y credenciales extraídas, exista o no aún el recurso actual. |
| `file-history/results/` | por operación terminada | Bytes de salida exactos. No se conserva ni incluye ningún archivo original seleccionado para conversión. |
| `prefs.json` | sí | Preferencias locales del usuario: `theme`, `sidebarWidth` y el recuento de actividad `ct-metrics`. |
| `lolly.txt` | sí | Un resumen legible del paquete (cantidades, perfil, nombre de archivo) para quien abra el zip sin Lolly. Se regenera en cada exportación y se reconoce al importar, así que nunca cuenta como parte omitida. Se escribe después del mapa de integridad, así que el mapa no cubre este archivo. |

::: details Cómo escribe la exportación el zip
La exportación escribe el zip una parte cada vez (`shells/web/src/lib/zip-stream.ts`). Los archivos subidos, los resultados guardados y las versiones guardadas de recursos se leen en fragmentos de 4 MiB, nunca enteros. Primero se comprueban los resultados y las versiones guardadas frente a su SHA-256 registrado. Después se lee cada archivo para calcular su suma de comprobación y su resumen criptográfico de integridad, y el zip hace referencia al archivo en su ubicación.

No se recodifica nada. Cada parte conserva sus bytes y su resumen criptográfico exactos, así que un archivo con Content Credentials conserva los bytes que cubre su firma. Para las mismas partes y el mismo momento, el zip es idéntico al del escritor anterior en memoria, salvo que un archivo de historial de más de 16 MiB se comprime por partes. `tests/backup-streaming.test.ts` lo comprueba frente a resúmenes criptográficos de referencia registrados.

En una biblioteca sintética de 192 MiB, medido en Node, terminar la copia de seguridad consumió entre unos 125 y 150 MiB adicionales a la biblioteca, frente a unos 850 MiB del escritor en memoria (`node scripts/bench-backup-finalise.ts`). La importación sigue leyendo el zip entero en memoria.
:::

<!--i:eti-file-->
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
| `format` | Siempre `lolly-backup`. Un archivo sin él se rechaza como "no es una copia de seguridad de Lolly". |
| `formatVersion` | La estructura con la que se **escribió** este paquete. Se incrementa con cualquier cambio en el conjunto o la estructura de las partes. Los lectores **no** basan la aceptación en este campo. |
| `minReader` | La versión mínima del lector que puede importar este paquete **con seguridad**. Este es el campo en el que los lectores basan la aceptación. |
| `app` | Id de la aplicación que lo produjo, para diagnóstico. |
| `exportedAt` | Marca de tiempo ISO de la creación del paquete. |
| `counts` | Lo que incluyó el escritor, para mostrarlo y comprobar su coherencia. |
| `integrity` | Opcional. Asocia cada parte salvo `manifest.json` a un resumen criptográfico `sha256-<base64>` de estilo SRI de sus bytes **sin comprimir**. |

<!--i:eti-tag-->
## Política de versiones

Dos números de versión permiten que el formato crezca sin dejar atrás las instalaciones antiguas.

![Un cambio en el formato del paquete es aditivo, que los lectores antiguos pueden ignorar, o incompatible, en cuyo caso una importación incorrecta corrompe los datos. Un cambio aditivo incrementa formatVersion y mantiene minReader; uno incompatible incrementa formatVersion y aumenta minReader. Un lector importa cuando minReader es como máximo su propia versión.](/info/diagrams/concepts/backup-version-gate.svg)

- Un lector importa un paquete cuando `manifest.minReader` es como máximo su propia versión de lector. Lo rechaza, con "necesita una versión más reciente de la aplicación", solo cuando el paquete exige un lector más reciente.
- Un cambio **aditivo**, como una nueva parte opcional o un nuevo campo opcional del manifiesto, incrementa `formatVersion` y deja `minReader` intacto. Las aplicaciones antiguas siguen importando todas las partes que reconocen, y las que no reconocen se indican como omitidas, no se descartan en silencio.
- Un cambio **incompatible**, en el que una importación incorrecta de una parte corrompe los datos o una parte opcional pasa a ser obligatoria, aumenta `minReader`. Las aplicaciones antiguas lo rechazan entonces sin problemas en lugar de importar algo que no pueden manejar. Las aplicaciones antiguas rechazan entonces el paquete sin problemas.
- Si un paquete futuro define `formatVersion` pero omite `minReader`, los lectores pasan a basar la aceptación en `formatVersion` y tratan el cambio como incompatible.

::: note Regla práctica para autores
Si todos los lectores existentes seguirían funcionando correctamente al ignorar tu adición, el cambio es aditivo: incrementa `formatVersion` y deja `minReader` como está. En caso contrario, aumenta `minReader`.
:::

<!--i:eti-shield-check-->
## Integridad

Cuando `manifest.integrity` está presente, un lector comprueba el SHA-256 de cada parte enumerada **antes de escribir nada**. Una discrepancia ("no superó la comprobación de integridad") o una parte ausente ("incompleto") detiene la importación, así que no hay restauración parcial. Esto detecta daños del traslado: un AirDrop truncado, una pasarela de correo que recodificó el adjunto, un sector USB defectuoso.

La integridad se aplica en la medida de lo posible. Se escribe solo donde Web Crypto está disponible (todos los contextos seguros de navegador y Node moderno) y se comprueba solo cuando están presentes tanto el mapa como Web Crypto. Un paquete sin el mapa, como uno anterior a la existencia de la integridad, se importa sin cambios: "no se puede verificar" nunca cuenta como "corrupto".

El manifiesto no se enumera a sí mismo ni al `lolly.txt` regenerado.

<!--i:eti-download-->
## Reglas de importación

Una importación se ejecuta en uno de dos modos.

- **Merge** es lo que hacen **Import data…** y la primera incorporación a la sincronización, **Bring it to this device**. Los datos del destino se conservan, y no se toca nada fuera del paquete.
- **Replace** es lo que usa la sincronización de dispositivos para mantenerlos al día entre sí. Toma el registro de perfil, las preferencias, las sesiones, las imágenes y la elección del design system activo de la copia sincronizada. Elimina solo los elementos que otro dispositivo borró desde la última sincronización. Restaurar una copia anterior primero guarda el dispositivo, luego hace que coincida con esa copia y elimina todo lo que la copia no contiene. [Sincronizar tus dispositivos](/info/sync.html) explica lo que ve una persona.

Una combinación trata cada tipo de datos así:

| Datos | Ya están en el destino | Solo están en el paquete |
|---|---|---|
| Sesiones (por posición) e imágenes subidas (por id) | Se conserva la copia guardada más recientemente, así que una copia de seguridad antigua nunca sobrescribe trabajo más reciente. Si las horas son iguales o desconocidas, se conserva la copia del destino. | Se añaden |
| Carpetas | Se conservan el nombre y la carpeta superior del destino, y la carpeta recibe los elementos del paquete que le faltan. Una sesión archivada en una carpeta del destino sigue archivada allí. | Se añaden |
| Favoritos (herramientas, recursos del catálogo y elementos de Projects) | Se combinan | Se añaden |
| Plantillas, plantillas de Projects y herramientas del usuario (por id) | Se conserva el registro del destino. | Se añaden |
| Entradas de Trash | Se conserva la entrada del destino. | Se añaden, para que un elemento que podía restaurarse en cualquiera de las instalaciones siga pudiendo restaurarse. Se omite una entrada cuya carpeta vuelve a estar en uso en el destino, o cuya posición en Trash ya usa el destino. |
| Otros campos del perfil (nombre, datos de contacto, idioma, indicadores de funciones, herramientas ocultas y otros ajustes) | Se conserva el valor del destino. | Se toman donde el campo del destino está vacío |
| Preferencias (`prefs.json`) | Se conserva el valor del destino. | Se escriben donde el destino no tiene ninguna |
| Design systems (por id) | El registro del paquete sustituye al del destino. | Se añaden. La opción activa del paquete se aplica solo cuando el destino no tiene un design system propio. |
| Historial de creaciones | La copia guardada más recientemente sigue siendo la actual, y la otra se conserva como borrador protegido. | Se añade |

**Las sesiones guardadas vuelven a enlazarse a sus imágenes automáticamente.** Las referencias a recursos se conservan por id. El puente vuelve a resolverlas después de restaurar las imágenes, porque las URL `blob:` no sobreviven a una recarga.

**Los registros del historial nunca cambian después de escribirse.** Una importación repetida de versiones de recursos e IDs de operaciones no añade nada, y un ID que ya identifica bytes o historial diferentes se rechaza, no se sobrescribe. Volver a importar un recurso actual idéntico conserva su versión, y un recurso actual modificado debe llevar una versión distinta.

**El historial de creaciones tiene algunas reglas más.** Una creación cuya posición usa el destino para otra creación se añade como una creación independiente, y una creación en Trash del destino permanece allí. Un id de punto de control que identifica contenido distinto en el destino conserva el del destino. Un archivo que no supera sus propias comprobaciones detiene la importación antes de cualquier cambio en el perfil, las sesiones, los recursos o las preferencias, y repetir una importación idéntica no añade almacenamiento.

**El resumen informa de lo ocurrido.** Cada importación devuelve `profile`, `sessions`, `userAssets`, `prefs`, `skipped` y `failedAssets`.

- `failedAssets` cuenta los recursos subidos que no se pudieron restaurar, por ejemplo porque el almacenamiento del dispositivo está lleno.
- `skipped` cuenta las partes de un escritor más reciente que esta compilación no reconoció. La aplicación muestra la cantidad ("… · N elementos más recientes omitidos").
- Con historial de archivos, el resumen añade `assetVersions`, `fileOperations`, `fileBatches` y `failedHistory`. Quedarse sin almacenamiento o un conflicto de ID inmutable puede causar una restauración parcial, y la aplicación indica entonces a la persona que conserve la copia de seguridad de origen.
- Con historial de creaciones, añade `revisions` y `recoveryDrafts`, contando solo lo que añadió esta importación, y `added`, `kept`, `replaced`, `copies` y `hidden` para indicar cómo se combinó cada creación. `skippedCheckpoints` cuenta los puntos de control cuyo id identifica contenido distinto en el destino, y `historyLeftOut` cuenta los puntos de control y borradores antiguos que no cupieron en el espacio del historial del dispositivo.
- Una importación de sustitución añade `removed` y `failedRemovals`.

La restauración no es una única transacción que abarque los almacenes de perfil, sesiones, recursos e historial. La sincronización en la nube **no** avanza su revisión aplicada tras una restauración parcial o no compatible, así que la copia sigue disponible para volver a intentarlo.

<!--i:eti-unlink-->
## Lo que no se transfiere

- **Cachés de catálogo** (metadatos y blobs de recursos descargados, el índice de herramientas), que el destino vuelve a sincronizar.
- **Herramientas y recursos del catálogo**, que se supone que están presentes en el destino. Los tokens de marca, las fuentes y los logotipos que añadió el usuario son recursos del usuario y sí se transfieren.
- **URL `blob:` y de objetos**, que el puente regenera al cargar.
- **Originales de conversiones, permisos temporales de ejecución activos y secretos de acceso o firma locales del equipo.** No forman parte del historial portátil. Un resultado guardado es una copia. No significa que se haya hecho una copia de seguridad del origen original.
- **El contador de secuencia de exportación**, el contador diario para nombrar descargas en `localStorage` (`lolly-export-seq`). Se mantiene fuera de `PREF_KEYS`, así que nunca se transfiere en un paquete.

El medidor de almacenamiento muestra la misma división. Saved sessions, My images y File results & versions se incluyen en un paquete. La caché de recursos, las vistas previas de herramientas y los elementos fijados para uso sin conexión se pueden reconstruir y no se transfieren.

![El medidor de almacenamiento que divide los datos de este dispositivo en categorías con nombre, con Saved sessions y My images contabilizados por separado de Asset cache, aquí en una instalación nueva donde todas las categorías siguen vacías](/t/url-shot?url=%2F%23%2Fprofile%3Ffocus%3Dstorage-section&width=1440&height=1600&dpi=192&waitMs=2600&format=svg&css=%5Bdata-store-group%3Dmove%5D%2C.storage-actions%2C.store-selbar%7Bdisplay%3Anone%7D&cropSelector=.store-meter&waitSelector=%5Bdata-store-group%3Dmove%5D&drive=click%3A%5Bdata-store-group%3Dwork%5D%3Esummary%3Bclick%3A%5Bdata-store-group%3Dcaches%5D%3Esummary&walker=1&dark=1&filename=ce-storage-categories)

<!--i:eti-building-->
## Datos de la organización con Lolly Work

Este paquete hace una copia de seguridad de la biblioteca personal del dispositivo. Un paquete no es una copia de seguridad de una instancia de **Lolly Work**. Ese servicio almacena las cuentas de la organización, las políticas de acceso, los proyectos compartidos, las versiones del catálogo, las aprobaciones, los trabajos de renderizado y los registros de auditoría. Vuelve a conectarte e inicia sesión para recuperar el acceso al trabajo compartido. Importar un paquete personal no concede ese acceso.

Los operadores hacen copias de seguridad, conservan y borran los datos del servidor con las propias guías de Lolly Work: [Copia de seguridad y restauración](/info/work-operations.html#backup-and-restore) y [Almacenamiento y ciclo de vida de los datos de Lolly Work](/info/work-data-lifecycle.html). Borrar o exportar los datos de un dispositivo no realiza ninguna de esas operaciones en el servidor.

<!--i:eti-monitor-->
## Entre shells

`data-transfer.ts` lee y escribe solo a través del puente de capacidades (`host.profile`, `host.state`, `host.assets`) y de las preferencias compartidas de `localStorage`. El mismo módulo lee y escribe el contenedor común en la web y en las aplicaciones de escritorio y móviles, sobre IndexedDB o almacenamiento en el sistema de archivos. Las partes opcionales del historial aparecen solo donde su adaptador está disponible. La importación informa de las partes no compatibles como omitidas. La batería de pruebas sin interfaz gráfica comprueba las partes comunes con un puente en memoria, y las transacciones del historial también tienen pruebas en un navegador real.

Dos shells quedan fuera de esa garantía:

- La **CLI de una sola ejecución** no tiene nada que transferir: su estado está en memoria y dura una invocación.
- La **TUI** mantiene el estado en `~/.lolly` (sesiones, carpetas, perfil). Su vista Profile escribe su propio archivo de copia de seguridad, más sencillo: `saved-state/<slot>.json` por sesión más `profile.json` y `folders.json`, sin manifiesto, sin `formatVersion` ni `minReader` y sin mapa de integridad. Un lector de este formato rechaza ese archivo como "no es una copia de seguridad de Lolly", aunque los nombres son parecidos (`lolly-backup-<stamp>.zip`). Unificar ambos es una carencia conocida.

<!--i:eti-clock-->
## Aún no portátil

Más adelante se pueden añadir nuevos tipos de datos portátiles como partes adicionales (un nuevo `formatVersion`, el mismo `minReader`). Los design systems ya se transfieren así, como `design-systems.json` junto con sus recursos de usuario.

Hay dos nombres reservados para datos que aún no se transfieren:

- **`tokens.json`** contendría un documento de tokens de diseño [W3C DTCG](https://tr.designtokens.org/format/) con sus grupos, conjuntos y temas, el formato que [Penpot importa y exporta](https://help.penpot.app/user-guide/design-systems/design-tokens/). Los tokens de marca del propio usuario ya se transfieren como el recurso `user/tokens/brand` en `assets.json`, y los tokens de un design system se transfieren con su registro.
- **`penpot/`** está reservado para un archivo de Penpot incorporado, o el subconjunto relevante para Lolly, expuesto como herramienta.

<!--i:eti-history-->
## Partes del historial

Las dos partes del historial son opcionales y tienen sus propias versiones.

::: details Historial de creaciones (v3)
Las copias de seguridad manuales de una instalación web con historial de creaciones incluyen `revision-history.json`, con su propio esquema `{ version: 1, documents, revisions, recoveries }`. Contiene los ID conservados, las instantáneas canónicas de las entradas, las marcas de versión, las vistas previas de trama y los borradores separados de cada escritor. El adaptador del historial captura las sesiones actuales y sus revisiones más recientes en una única transacción de lectura, y `sessions.json` usa las mismas instantáneas actuales para los lectores anteriores.

La restauración comprueba el SHA-256 y el número de bytes de la carga útil, las identidades únicas, las relaciones entre documentos y revisiones más recientes, la ascendencia, las marcas de tiempo, los tipos de vista previa y los límites antes de guardar el archivo en una única transacción. Pueden faltar referencias a revisiones padre compactadas. El trabajo actual existente nunca se sustituye sin avisar: cuando una creación está en ambos lados, el lado que no se conserva como actual se convierte en un borrador protegido.

El archivo tiene un límite de transferencia de 384 MiB. Los límites de almacenamiento se aplican sin truncar los puntos de control conservados. La exportación escribe `revision-history.json` y `sessions.json` por fragmentos, con los mismos bytes que produce una única llamada a `JSON.stringify`, así que el texto del archivo nunca se mantiene entero en memoria. Un archivo de historial que superaría el límite se descarta en cuanto lo supera y, a partir de ahí, solo se cuenta su tamaño. Después, el archivo se vuelve a crear sin sus puntos de control automáticos más antiguos, y el resumen de la exportación los cuenta como `checkpointsLeftOut`, o se rechaza el archivo.

Una shell sin esta capacidad restaura las sesiones ordinarias e informa de la parte del historial como omitida. El historial nativo del sistema de archivos sigue sin ser compatible hasta que su adaptador proporcione transacciones duraderas de historial. Los invitados en una colaboración privada no tienen historial duradero ni archivo de recuperación.

La sincronización de instantáneas personales deja fuera el historial de creaciones. Aplicar una instantánea a un documento local con historial conserva su estado de trabajo anterior como un borrador de recuperación separado e invalida el token de escritura de cualquier editor abierto. Sus puntos de control inmutables permanecen en el dispositivo. Esto protege el historial local durante la sustitución de una instantánea. No combina los historiales simultáneos de distintos dispositivos.

Se conservan las referencias históricas a recursos, mientras que el renderizado sigue resolviendo los recursos a través de la biblioteca existente del destino. Este archivo aún no garantiza los bytes exactos de los recursos antiguos ni los renderizados antiguos de las herramientas. Los bytes de las versiones de recursos y de los resultados de archivos se transfieren en su propia parte de la copia de seguridad.
:::

::: details Versiones guardadas y resultados de archivos (v2)
La parte opcional del historial contiene `{ version: 2, assetVersions: [...], operations: [...], batches: [...] }`, y los lectores también aceptan la estructura anterior history-v1 sin lotes. Cada instantánea indica el ID estable del recurso y su versión exacta, la hora de guardado, la longitud en bytes y el SHA-256 hexadecimal, además de un registro del recurso cuyos `_file` y `_credentialFile` opcional apuntan a partes binarias. Las operaciones incluyen los datos del archivo original, la solicitud, el informe, las marcas de tiempo y un `_file` de resultado opcional. Los nombres de los motores de almacenamiento, los identificadores de OPFS y los permisos temporales de ejecución no se transfieren. Los lectores que solo conocen history v1 rechazan la nueva versión del historial antes de importar, así que la pertenencia a un lote nunca se pierde sin avisar.

Los manifiestos de lote registran cada origen seleccionado antes de procesarlo, incluidos los archivos que nunca se leyeron, los miembros cancelados, los fallos al reservar espacio para resultados y el trabajo interrumpido. Cada miembro tiene un ID de operación estable, una referencia y datos del origen, el nombre de salida solicitado y un informe final. Un origen no leído tiene datos declarados, no un resumen criptográfico inventado. La importación valida la identidad del miembro y su coherencia con cualquier informe de operación incluido. Los informes de Lolly Batch siguen disponibles cuando se han eliminado los resultados individuales, pero un comprobante no significa que sus bytes de salida sigan almacenados.

- **Validación primero.** Cada registro conocido del historial, informe y archivo referenciado se valida antes de que la importación escriba perfiles o recursos. La falta de bytes y las discrepancias de SHA-256 provocan un fallo incluso cuando el contenedor no tiene mapa de integridad. Las credenciales extraídas siguen siendo matrices de bytes, incluidas las importaciones de escritores anteriores que las serializaban como objetos con claves numéricas.
- **Trabajo en ejecución.** Las operaciones en ejecución se convierten en registros interrumpidos en la copia de seguridad, con un informe de fallo y sin resultado. La restauración nunca reinicia el trabajo en segundo plano ni importa un permiso temporal activo. Reintentar implica seleccionar de nuevo el archivo original, que se comprueba frente a su SHA-256 registrado cuando está disponible.
- **Almacenamiento.** Los resultados restaurados guardan sus bytes y metadatos juntos en IndexedDB. Los nuevos resultados ordinarios usan OPFS donde está disponible, con IndexedDB como alternativa. Una importación nunca sustituye una operación activa existente.
- **Límites de las copias de seguridad.** La exportación transmite estos bytes al archivo, pero la restauración sigue descomprimiendo una copia de seguridad entera en memoria, así que los límites se mantienen: **256 MiB de carga útil del historial**, **4 MiB de metadatos del historial**, como máximo **100 operaciones**, **100 lotes** y **2000 instantáneas**. La exportación rechaza explícitamente el historial incompleto o que supera el tamaño permitido y nunca lo omite sin avisar. Descarga las versiones y los resultados importantes uno a uno antes de eliminar copias locales más antiguas. Estos límites no garantizan un pico de memoria medido para teléfonos.
- **Cuotas locales.** El historial local de resultados tiene una cuota de 512 MiB y un límite de 100 registros. Las instantáneas de recursos tienen una cuota separada de 512 MiB y un máximo de 20 versiones históricas por recurso, y los bytes de credenciales extraídas cuentan para esa cuota. La restauración respeta estos límites y nunca elimina datos existentes del usuario sin avisar.
- **Metadatos de lotes.** Los metadatos locales de lotes tienen una cuota separada de 4 MiB, con un máximo de 100 manifiestos y 20 miembros por lote. Los miembros pendientes reservan capacidad de metadatos, con un límite de 32 KiB de informe por miembro. Es una cuota lógica, no una garantía de espacio en disco del navegador: un fallo real de cuota se muestra, y el informe en memoria sigue disponible para descargar. Reintentar un miembro de un lote crea un lote nuevo sin sobrescribir el informe anterior. Eliminar un registro de lote no elimina los bytes de resultados individuales ni los recursos de la biblioteca.
- **Resultados en la biblioteca.** Los resultados convertidos se pueden añadir a la biblioteca sin normalización ni recodificación, con los hashes de origen y salida y la relación con la operación adjuntos. Las adiciones repetidas reutilizan una copia sin cambios, y una copia editada nunca se sobrescribe. Las imágenes de trama pueden iniciar un nuevo documento de Lolly Design, que usa el ID actual del recurso de la biblioteca. Aplicar versiones fijadas exactas en todo el entorno de ejecución y la ruta de URL de Lolly Design es un trabajo aparte. Los resultados SVG, HTML, PDF y ZIP se conservan como recursos de archivo opacos, sin convertirlos en contenido interactivo o vectorial de confianza.
- **Dónde se muestra.** **Convert → Recent file operations** muestra el uso del historial, los informes, las descargas y el gestor de versiones, que también encuentra versiones anteriores de recursos eliminados de la biblioteca. Restaurar una instantánea crea una versión actual nueva y conserva la instantánea seleccionada. **Settings → Preferences → Storage** cuenta los resultados y las versiones por separado de las cachés desechables.
- **Limpieza.** La limpieza explícita de archivos temporales elimina solo los bytes sin referencias que pertenecen a operaciones. Los registros actuales protegen sus archivos, y los archivos recientes de OPFS tienen un periodo de gracia de una hora. Los resultados guardados y las instantáneas de recursos no se borran automáticamente.

Los lectores anteriores siguen aceptando el contenedor v2 (`minReader: 1`) y restauran las partes que conocen, contando las partes del historial no compatibles como omitidas. La recuperación completa del historial necesita una shell con el adaptador `fileHistory`, un punto de integración dentro de la shell, no una capacidad de `HostV1` expuesta a las herramientas. La restauración real entre dos dispositivos está cubierta por la comprobación local en Chromium. La recuperación en las aplicaciones instaladas de escritorio, iOS y Android aún debe superar la aceptación por separado.
:::

<!--i:eti-code-->
## Referencia

- Módulo: `shells/web/src/data-transfer.ts` (`exportBackup`, `importBackup`, `BACKUP_FORMAT`, `BACKUP_FORMAT_VERSION`, `BACKUP_READER_VERSION`; la función de nombres `backupFilename()` es interna).
- Prueba de contrato: `tests/data-transfer.test.ts`, que cubre la ida y vuelta, la combinación, la integridad, la compatibilidad hacia delante y el control de compatibilidad del lector.
- Pruebas de contrato del historial: `tests/file-history-backup.test.ts`, `tests/file-batch-history.test.ts` y `tests/file-result-library.test.ts`. Aceptación en navegador: `tests/file-history.browser.test.ts`, `tests/file-batch-history.browser.test.ts` y `tests/file-result-reuse.browser.test.ts`.
- Superficie del puente utilizada: `host.profile`, `host.state` y `host.assets`; consulta [API del host](/info/host-api.html).
