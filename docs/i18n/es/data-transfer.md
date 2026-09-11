# Transferencia de datos - el paquete `lolly-backup`

Todo lo que acumula un usuario de Lolly vive **en su dispositivo** - sin cuenta, sin nube. El paquete de transferencia de datos es cómo se mueve ese valor: expórtalo en una instalación, lleva el archivo por cualquier medio (USB, AirDrop, correo a ti mismo, una carpeta compartida en red) e impórtalo en otra. El archivo *es* el transporte. El destino puede estar sin conexión o con conexión. No importa, porque nada habla nunca con un servidor.

![Los dos botones que mueven una instalación entera: Exportar mis datos escribe un zip, Importar datos lo vuelve a leer](/t/url-shot?url=%2F%23%2Fprofile%3Ffocus%3Dstorage-section&width=1440&height=1800&dpi=192&waitMs=2400&css=.store-manages%7Bdisplay%3Anone%7D&walker=1&format=svg&cropSelector=.storage-subsection&dark=1&filename=pd-transfer-controls)

Esta página es la especificación del formato. Para el recorrido pensado para el usuario final, consulta [Usar Lolly → Moverse a otro dispositivo](/info/using.html). La implementación es [`shells/web/src/data-transfer.ts`](../shells/web/src/data-transfer.ts), y [`tests/data-transfer.test.ts`](../tests/data-transfer.test.ts) fija el contrato de ida y vuelta.

> **Alcance.** Un paquete lleva *datos del usuario*, no herramientas. Las herramientas y los recursos del catálogo se sincronizan por separado y se asume que ya están presentes en el destino (en el peor caso, en una versión más nueva). Importar nunca instala ni actualiza una herramienta.

## Objetivos

- <!--i:box--> **Un formato, todos los shells.** Los mismos bytes son producidos y consumidos por la PWA web, las apps de escritorio/móvil de Tauri y cualquier shell futuro. El paquete es el contrato. El puente de capacidades de cada shell es el adaptador específico de la plataforma que hay detrás.
- <!--i:shieldcheck--> **Sobrevive al trayecto.** Un paquete dañado o truncado en tránsito falla de forma clara al importar, nunca restaura a medias.
- <!--i:clock--> **Sobrevive a esta versión.** Una app más antigua puede seguir importando las partes reconocidas de un paquete más nuevo. Un formato genuinamente incompatible se rechaza limpiamente.
- <!--i:check--> **Seguro para fusionar.** Importar sobre una instalación ya en uso nunca borra nada que no estuviera en el paquete.

## El sobre

Un paquete es un simple `.zip`. La descarga se nombra según la persona a la que pertenece - `LollyTools-<First>-<Last>-<YYYY-MM-DD>-<n>.zip` (por ejemplo, `LollyTools-Ada-Lovelace-2026-06-26-1.zip`) - para que una carpeta de Descargas llena de copias de seguridad siga siendo legible. Las partes de nombre y apellido provienen del perfil y se omiten cuando no están definidas. Sin perfil se obtiene `LollyTools-2026-06-26-1.zip`, y solo con un nombre de pila se obtiene `LollyTools-Ada-2026-06-26-1.zip`. Cada parte se sanea a un token seguro para nombres de archivo (se conservan letras/dígitos Unicode, se eliminan espacios/puntuación, con un tope de 32 caracteres). `<n>` es una secuencia por día y por dispositivo, de modo que las exportaciones repetidas el mismo día no chocan entre sí y se mantienen en orden. `backupFilename()` en [`shells/web/src/data-transfer.ts`](../shells/web/src/data-transfer.ts) construye el nombre. El contenido del zip es idéntico sin importar el nombre. Dentro:

| Ruta | Obligatorio | Contenido |
|---|---|---|
| `manifest.json` | sí | Id de formato, versiones, recuentos e integridad por parte. Lo primero que mira un lector. |
| `profile.json` | si está definido | El registro `me` del usuario (nombre, contacto, referencia de foto, indicadores). Se lee mediante `host.profile`. |
| `sessions.json` | sí | Cada sesión guardada: slot, id/versión de herramienta, etiqueta, miniatura (data-URL) y datos de entrada completos. Se lee mediante `host.state`. |
| `assets.json` | sí | Metadatos de cada recurso subido (imágenes, fuentes, tokens de marca), cada uno apuntando a sus bytes bajo `assets/blobs/`. |
| `assets/blobs/<n>.<ext>` | por recurso | Los bytes en bruto del recurso (archivos de imagen y de fuente). Almacenados sin comprimir (formatos ya comprimidos). La extensión es cosmética. El MIME en `assets.json` es el que manda. |
| `prefs.json` | sí | Preferencias locales del usuario: `theme`, `sidebarWidth` y el recuento de actividad `ct-metrics`. |
| `lolly.txt` | sí | Un resumen legible del paquete (recuentos, perfil, nombre de archivo) para quien abra el zip sin Lolly. Se regenera en cada exportación y se reconoce al importar, así que nunca cuenta como parte omitida. Se escribe *después* del mapa de integridad, así que queda fuera de él. |

El paquete es un zip normal a propósito: sobrevive intacto a cualquier transporte, y cualquier herramienta de descompresión puede inspeccionarlo.

`profile.json` es la parte más pequeña y la primera que ve un lector en la app: los datos que un productor rellena una sola vez, más el opt-in que permite que las herramientas los usen.

![El formulario de datos del perfil que se convierte en profile.json - nombre, contacto, foto y el opt-in junto a ellos](/t/url-shot?url=%2F%23%2Fprofile&width=1440&height=900&dpi=192&waitMs=1800&format=svg&cropSelector=.profile-details-grid&walker=1&dark=1&filename=ce-profile-record)

## `manifest.json`

```json
{
  "format": "lolly-backup",
  "formatVersion": 1,
  "minReader": 1,
  "app": "lolly",
  "exportedAt": "2026-06-22T09:30:00.000Z",
  "counts": { "profile": true, "sessions": 2, "userAssets": 4, "prefs": 3 },
  "integrity": {
    "profile.json": "sha256-…",
    "sessions.json": "sha256-…",
    "assets.json": "sha256-…",
    "assets/blobs/0.webp": "sha256-…",
    "prefs.json": "sha256-…"
  }
}
```

| Campo | Significado |
|---|---|
| `format` | Siempre `lolly-backup`. Un archivo sin él se rechaza como "no es una copia de seguridad de Lolly". |
| `formatVersion` | La versión con la que se **escribió** este paquete. Se incrementa con cualquier cambio en el conjunto o la forma de las partes. Los lectores **no** se rigen por ella. |
| `minReader` | La versión mínima de lector necesaria para importar este paquete **con seguridad**. Este es el campo que rige a los lectores. |
| `app` | Id de la app productora, para diagnóstico. |
| `exportedAt` | Marca de tiempo ISO en la que se creó el paquete. |
| `counts` | Lo que puso el escritor, para mostrar y para comprobaciones de coherencia. |
| `integrity` | Opcional. Asocia cada parte excepto `manifest.json` con un resumen estilo SRI `sha256-<base64>` de sus bytes **sin comprimir**. |

## Política de versiones (compatibilidad hacia adelante)

La división entre `formatVersion` y `minReader` es lo que permite que el formato crezca sin dejar huérfanas a las instalaciones más antiguas:

- Un lector importa un paquete cuando `manifest.minReader ≤` su propia versión de lector. Se niega (con "necesita una versión más nueva de la app") solo cuando el paquete exige explícitamente un lector más nuevo.
- Un cambio **aditivo** - una nueva parte *opcional*, o un nuevo campo opcional del manifiesto - incrementa `formatVersion` pero deja `minReader` sin cambios. Las apps más antiguas siguen importando todas las partes que reconocen. Las partes que no reconocen se omiten (ver más abajo), no se descartan en silencio.
- Un cambio **incompatible** - uno en el que importar mal una parte corrompe datos, o en el que una parte antes opcional pasa a ser obligatoria - eleva `minReader`. Las apps más antiguas entonces se niegan limpiamente en lugar de importar algo que no pueden manejar.
- Si un paquete futuro define `formatVersion` pero omite `minReader`, los lectores, por precaución, se rigen por `formatVersion` (tratan el cambio como incompatible).

> **Regla práctica para autores:** si todo lector existente seguiría haciendo lo correcto al ignorar tu adición, es aditivo - incrementa `formatVersion`, deja `minReader` igual. En caso contrario, eleva `minReader`.

## Integridad

Cuando `manifest.integrity` está presente, un lector verifica el SHA-256 de cada parte listada **antes de escribir nada**. Una discordancia ("falló su comprobación de integridad") o una parte faltante ("incompleto") aborta toda la importación - no hay restauración parcial. Esto detecta la corrupción que puede introducir un transporte de archivos (un AirDrop truncado, una pasarela de correo que recodificó el adjunto, un sector USB defectuoso).

La integridad es de mejor esfuerzo por diseño: solo se escribe donde Web Crypto está disponible (todo contexto seguro de navegador y Node moderno), y solo se verifica cuando el mapa y Web Crypto están presentes a la vez. Un paquete sin el mapa - por ejemplo uno de antes de que existiera la integridad - se importa sin cambios. "No se puede verificar" nunca se trata como "corrupto".

El manifiesto no se lista a sí mismo ni al README `lolly.txt` regenerado. Los resúmenes cubren las partes que el manifiesto avala.

## Semántica de importación

Importar es **fusionar y sobrescribir**, nunca reemplazar todo:

- Los datos existentes en el destino se dejan en su sitio.
- Cualquier clave que colisione - el perfil, un slot de sesión, un id de imagen subida - se reemplaza por la copia importada.
- Nada que no estuviera en el paquete se toca. Una sesión que el destino tenía pero el paquete no sobrevive a la importación.

Las sesiones guardadas se reenlazan automáticamente con sus imágenes: las referencias a recursos se conservan por id, y el puente las vuelve a resolver después de restaurar las imágenes subidas (tiene que hacerlo de todos modos, porque las URLs `blob:` no sobreviven a una recarga).

El resumen de importación reporta `{ profile, sessions, userAssets, prefs, skipped, failedAssets }`. `failedAssets` cuenta los recursos subidos que no se pudieron restaurar (almacenamiento del dispositivo lleno, por ejemplo). Es distinto de `skipped`, que cuenta partes de un escritor más nuevo compatible hacia adelante que esta build no reconoció. La interfaz muestra `skipped` ("… · N elementos más nuevos omitidos"), para que la restauración sea honesta sobre lo que dejó atrás.

## Qué no viaja

- **Cachés del catálogo** (metadatos y blobs de recursos descargados, el índice de herramientas) - se resincronizan gratis en el destino.
- **Herramientas y recursos de marca** - fuera de alcance, y se asume que ya están presentes en el destino.
- **URLs `blob:` / de objeto** - regeneradas por el puente al cargar.
- **El contador de secuencia de exportación** - el contador de nomenclatura de descargas por día (clave de `localStorage` `lolly-export-seq`) es una conveniencia de nomenclatura local. Se mantiene fuera de `PREF_KEYS`, así que nunca viaja en un paquete.

El medidor de almacenamiento desglosa la misma división. Las sesiones guardadas y Mis imágenes viajan en un paquete. La caché de recursos, las vistas previas de herramientas y los anclajes sin conexión debajo de ellas son todos re-derivables, así que se quedan atrás.

![El medidor de almacenamiento desglosando los datos de este dispositivo en categorías con nombre, con Sesiones guardadas y Mis imágenes rastreadas por separado de la Caché de recursos, aquí en una instalación nueva donde cada categoría sigue vacía](/t/url-shot?url=%2F%23%2Fprofile%3Ffocus%3Dstorage-section&width=1440&height=1600&dpi=192&waitMs=2600&format=svg&css=.store-manages%2C.storage-subsection%2C.store-selbar%7Bdisplay%3Anone%7D&cropSelector=.store-meter&walker=1&dark=1&filename=ce-storage-categories)

## Garantía entre shells

`data-transfer.ts` lee y escribe exclusivamente a través del puente de capacidades (`host.profile`, `host.state`, `host.assets`) y las preferencias compartidas de `localStorage`. Como el puente es la única costura, el *mismo* módulo produce un paquete idéntico byte a byte en cada shell aunque el almacenamiento subyacente difiera - IndexedDB en web, el sistema de archivos en Tauri. Los shells de Tauri reutilizan este módulo sin cambios. Solo difiere su implementación de `host.state`. La prueba sin interfaz gráfica ejercita el ciclo completo de ida y vuelta contra un puente en memoria, por eso representa a todos los demás.

Dos shells quedan fuera de esa garantía, por razones distintas:

- La **CLI de un solo uso** no tiene nada que transportar - su estado está en memoria y es efímero por invocación.
- La **TUI** sí persiste estado (`~/.lolly`: sesiones, carpetas, perfil) y su vista de Perfil puede respaldarlo, pero escribe un archivo *más simple* propio: `sessions/<slot>.json` por sesión más `profile.json` y `folders.json`, sin manifiesto, sin `formatVersion`/`minReader` y sin mapa de integridad. **No** se puede importar con este formato - un lector lo rechaza como "no es una copia de seguridad de Lolly" - y, para más confusión, usa un nombre parecido (`lolly-backup-<stamp>.zip`). Unificar los dos es una carencia conocida.

## Puntos de extensión reservados

El sobre es, por diseño, un manifiesto más un conjunto de partes con nombre, para que nuevos tipos de datos portables puedan viajar en él más adelante **sin un cambio incompatible**. Se incorporan como partes aditivas (nuevo `formatVersion`, mismo `minReader`), y el lector actual omite lo que no reconoce. Esto está en la [hoja de ruta](/info/overview.html#roadmap), aún no implementado. Los nombres se reservan aquí para que el formato siga siendo coherente cuando lleguen.

- **`tokens.json` - tokens de diseño.** Un documento de tokens de diseño [W3C DTCG](https://tr.designtokens.org/format/) (el formato que [Penpot importa y exporta](https://help.penpot.app/user-guide/design-systems/design-tokens/) - tokens con `$value`/`$type`/`$description`, organizados en grupos, conjuntos y temas). Un conjunto de tokens en el paquete permite a un usuario mover los primitivos de su marca entre instalaciones junto con sus sesiones. A más largo plazo, un conjunto de tokens ingerido se convierte en una fuente de primer nivel contra la que resuelven las herramientas y los recursos de paleta.
- **`penpot/` - archivos de Penpot ingeridos.** Un directorio reservado para un archivo de Penpot (o su subconjunto extraído, relevante para Lolly) importado y expuesto *como una herramienta*. El paquete llevará la definición ingerida, para que viaje con el resto de los datos del usuario.

Cualquier cosa fuera de estos nombres reservados y de las partes anteriores es, para un lector, una parte desconocida: se deja intacta y se cuenta en `skipped`.

## Referencia

- Módulo: [`shells/web/src/data-transfer.ts`](../shells/web/src/data-transfer.ts) (`exportBackup`, `importBackup`, `BACKUP_FORMAT`, `BACKUP_FORMAT_VERSION`, `BACKUP_READER_VERSION` - el nombrador `backupFilename()` es interno).
- Prueba de contrato: [`tests/data-transfer.test.ts`](../tests/data-transfer.test.ts) - casos de ida y vuelta, fusión, integridad, compatibilidad hacia adelante y control de lector.
- Superficie de puente usada: `host.profile`, `host.state`, `host.assets` - ver [Host API](/info/host-api.html).
