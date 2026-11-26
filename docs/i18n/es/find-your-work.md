# Encontrar y recuperar tu trabajo

Encuentra un diseño que nunca guardaste, un archivo que descargaste, la versión de la semana pasada o tu trabajo después de borrar los datos del navegador. Empieza por la tabla.

El trabajo personal se queda en el navegador o la aplicación donde lo creaste, en ese dispositivo, salvo que actives [Sync](/info/sync.html). Una organización que usa el servicio opcional Lolly Work también guarda **Team projects** en su servidor.

| Qué hiciste | Dónde buscar |
|---|---|
| Pulsaste **Save as** o **Save** | **Projects** |
| Pulsaste **Download** | Las descargas de tu navegador y una copia en **Assets** |
| Ninguna de las dos cosas, en una [herramienta que guarda mientras trabajas](#which-tools-save-as-you-work) | **Projects** e **History** |
| Ninguna de las dos cosas, en una herramienta que no lo hace | Solo la pestaña en la que trabajaste, hasta que la cierres |
| Lo borraste en la aplicación | **Trash**, en **Projects**, **Assets** o **Settings → Storage**, durante 30 días |

::: figure find-your-work-places
Dónde se guarda tu trabajo: el almacenamiento del propio navegador contiene Projects, History y Trash; las descargas van a las carpetas de tu dispositivo; Sync y un archivo de copia de seguridad son las copias fuera del navegador.
:::

::: details Encontrar trabajo compartido en Lolly Work (opcional)
Abre el Lolly de tu organización, inicia sesión y busca en **Projects → Team projects**. Esa instancia contiene las sesiones compartidas y muestra aquellas a las que tienes acceso. Iniciar sesión en otro dispositivo puede restaurar el acceso a esas sesiones. Iniciar sesión no restaura tu biblioteca personal ni la copia de seguridad de tu dispositivo.

En una [colaboración de trabajo](/info/collaborate.html#collabs-through-lolly-work-optional), espera a que aparezca **Saved to work** antes de salir. Si falta un proyecto compartido, comprueba que estás conectado a la instancia correcta y consulta a su operador sobre el acceso o la conservación. Borrar los datos del navegador elimina las copias locales, pero no la copia del servidor de la organización. Consulta [Usar Lolly en tu organización](/info/organisation.html).
:::

<!--i:eti-search-->
## Encontrar algo que guardaste

1. Pulsa **Home** en la parte superior izquierda de la herramienta.
2. Abre la pestaña **Projects** en la parte superior de la pantalla de inicio (el icono de carpeta en un teléfono).
3. Todo lo que guardaste en **My library** está en la primera pantalla. Cada proyecto es una carpeta. Para buscar en todas las carpetas, escribe en **Search all projects…** al pie de la pantalla.

Un elemento toma el nombre de archivo que escribiste en el panel de exportación. Sin nombre de archivo, toma el nombre de su herramienta, como **QR Code**. Al abrir el elemento se restauran todos los ajustes. Para guardar trabajo nuevo, consulta [Guardar y continuar](/info/using.html#saving-continuing).

::: note ¿No está en Projects?
- Puede estar en **Trash**: consulta [Recuperar algo que borraste](#get-back-something-you-deleted).
- Otro navegador, una ventana privada u otro dispositivo empieza vacío, salvo que uses [Sync](/info/sync.html) o [traslades tu trabajo](#move-your-work-to-another-device).
- Si solo pulsaste **Download**, consulta [Encontrar un archivo que descargaste](#find-a-file-you-downloaded).
:::

::: details Trabajar con Projects
También puedes abrir la vista **Projects** desde **Settings → Storage → Saved sessions → Organise in Projects**. Funciona como un gestor de archivos:

![Projects antes de guardar nada: las tarjetas New folder, New asset y Templates, el reloj de History arriba a la derecha y la barra Search all projects al pie](/t/url-shot?url=%2F%23%2Fp&width=1440&height=900&dpi=192&waitMs=1200&walker=1&format=svg&localize=1&dark=1&filename=projects)
<!--
SHOT NOTE (projects): build-docs-shots.ts gives every shot a fresh browser
context with no storage seeding, so this frame is always the empty Projects
root. The alt says so. Revisit (and re-caption) if the pipeline gains a
storage-seeding hook.
-->

- <!--i:folder--> **Carpetas anidadas.** Coloca sesiones guardadas en carpetas y carpetas dentro de carpetas, sin límite de profundidad. Crea una carpeta o cámbiale el nombre, o arrastra una tarjeta sobre una carpeta para mover la tarjeta. La ruta de navegación te lleva a los niveles superiores. Las sesiones guardadas sin carpeta están en la raíz de **Projects**.
- <!--i:clock--> **Ordena a tu manera.** **View options**, el botón de deslizadores arriba a la derecha, ofrece **Grid** o **List** y ordena por **Name**, **Date added**, **Last modified** (la opción predeterminada), **Size** y, dentro de una carpeta, **By tool**. Las carpetas siempre van primero. Las sesiones y las carpetas se ordenan cada una dentro de su propio grupo.
- <!--i:document--> **Archiva el trabajo nuevo directamente.** **New asset** abre el selector compartido. Elige **Templates** para empezar desde una plantilla guardada. Abre la plantilla para editarla, o pulsa **+ Add** para guardar una creación nueva al instante.
- <!--i:checklist--> **Selección múltiple (escritorio).** Marca la casilla de una tarjeta, arrastra un cuadro de selección sobre un espacio vacío o haz **Shift/Cmd-clic**. Para abrir el menú contextual de una tarjeta, haz **clic derecho** en ella. La barra de selección ofrece **Render selection**, **Move to…**, **New folder** y **Delete** (a Trash). Su opción **Edit together** abre de dos a ocho sesiones de una sola herramienta una junto a otra bajo una única barra lateral. **Edit as sheet** abre una selección de cualquier tamaño o combinación como filas en la cuadrícula de lotes.
- <!--i:download--> **Renderiza una carpeta o selección completa.** **Render folder** exporta todas las sesiones guardadas de una carpeta y sus subcarpetas como un único `.zip` con la misma jerarquía. **Render selection** hace lo mismo con una selección múltiple. Una sola sesión se renderiza en su propio archivo.
- <!--i:link--> **Ve directamente al trabajo guardado de una herramienta.** Marca una o más herramientas en la galería Tools y elige **View sessions** en la barra de selección. Projects muestra entonces solo las sesiones creadas con esas herramientas. **Clear** restaura la vista completa.
- <!--i:link--> **Comparte una sesión guardada.** Haz clic derecho en una sesión (en un teléfono, pulsa **•••** en su tarjeta) y elige **Share link**. El enlace vuelve a abrir la sesión con los mismos ajustes. Las imágenes de tu dispositivo no viajan con un enlace. Para ver el diálogo Share completo, consulta [Compartir tu trabajo](/info/using.html#sharing-your-work).
- <!--i:pentool--> **Cambia el nombre o crea una copia.** El mismo menú tiene **Rename**, **Duplicate** (una copia en la misma carpeta) y **Move to…**.

![El menú emergente View options en Projects: Layout con Grid y List, y Sort by configurado en Last modified, junto a un botón que invierte el orden](/t/url-shot?url=%2F%23%2Fp&width=900&height=700&dpi=192&waitMs=1400&drive=click%3A.projects-viewopts&cropSelector=.projects-viewmenu&walker=1&format=svg&dark=1&filename=misc-projects-sort)
<!--
SHOT NOTE (misc-projects-sort): trigger button confirmed as
`.filter-fab.projects-viewopts` in views/projects.ts (openViewOpts() is bound
to `.projects-viewopts` specifically) - `.projects-viewopts` alone is the
more specific hook, so that's what drives the click. The popover it opens
(`.projects-viewmenu`, also confirmed directly in openViewOpts()) is body-
appended, not nested under the Projects root, so cropSelector finds it
regardless. "By tool" only appears inside a folder - this recipe captures at
the Projects ROOT (`url=/#/p`), so if the capture pass wants "By tool"
visible too, point url= at a real folder instead: the route is a path
segment, `/#/p/<folderId>` (confirmed in main.ts's hash router - `parts[0]
=== 'p'` reads `folderId` from `parts[1]`), not a query param. Caveat: a
folder has to already EXIST in the capture profile, which a per-shot fresh
context has none of.
The popover (views/projects-view-options.ts, checked 2026-09-26) holds a
Layout pair (Grid / List) and a Sort by menu with a reverse button; the
options inside the menu (Name, Date added, Last modified, Size, By tool) are
not visible in the closed menu, so the alt does not list them.
-->

:::

<!--i:eti-refresh-->
## Si cerraste la pestaña o saliste de la herramienta

Lo que se recupera depende de cómo saliste y de la herramienta:

- **Cerraste la pestaña o volviste en otro momento.** El trabajo sin guardar se pierde, salvo en las [herramientas que guardan mientras trabajas](#which-tools-save-as-you-work). Abre ese trabajo desde **Projects**.
- **Recargaste la página en la misma pestaña.** Tus ajustes se recuperan de la dirección de la página. En las herramientas que no guardan mientras trabajas, la dirección no contiene imágenes y archivos de tu dispositivo ni texto de una sola línea de más de 150 caracteres, así que no se recuperan.
- **Pulsaste Home o el botón de volver arriba a la izquierda.** Si cambiaste algo desde la última vez que guardaste, descargaste o copiaste, un diálogo **Unsaved edits** pregunta si quieres guardar primero. **Save & leave** guarda el trabajo y te lleva a **Projects**, o de vuelta a la carpeta del proyecto desde la que lo abriste. **Leave anyway** descarta tus cambios. Un elemento guardado vuelve a su último estado guardado, y una creación que nunca guardaste desaparece de **Projects**. **Cancel** te mantiene en la herramienta.

::: warning Cerrar la pestaña no pide confirmación
Cerrar la pestaña, recargar y el botón Atrás del propio navegador nunca piden confirmación. Para asegurarte, pulsa **Save as** o **Save** en el panel de exportación antes de salir de una herramienta.
:::

Cuando la recuperación automática no está disponible, una nota junto a los controles de edición indica qué conservar:

- En una herramienta que trabaja con un archivo que aportas, guarda tus ajustes y conserva también los archivos originales.
- En una herramienta de grabación o una utilidad sin acción Save, guarda o descarga el resultado antes de salir.
- Las aplicaciones de escritorio y móvil indican cuándo necesitas guardar manualmente.
- En una colaboración privada, quien invitó conserva el documento y su historial, incluidos los cambios de la otra persona. Quien se unió trabaja en una copia temporal y debe guardar una copia aparte antes de que termine la sesión.

::: note ¿Saliste sin guardar por error?
En las herramientas que guardan mientras trabajas, History conserva una copia de los cambios descartados durante 30 días. Abre la página **History**, búscalos en **Changes** y pulsa **Open as a copy**. En otras herramientas, los cambios se pierden.
:::

::: details Qué herramientas guardan mientras trabajas
En la aplicación web, todas las herramientas que crean un documento guardan mientras trabajas, como Lolly Design, Lolly Chart, QR Code, Text y Lolly Sandbox. Estas herramientas no lo hacen:

- herramientas que trabajan con un archivo que aportas, como Redact, Sign o Convert Image, porque Lolly nunca conserva una copia de ese archivo;
- herramientas que graban desde tu cámara, micrófono o pantalla, como Record, Lolly Screen Capture y Lolly Voice Recorder;
- una herramienta sin nada que cambiar, como Countdown.

En las demás herramientas, tu primer cambio archiva el trabajo en **Projects** como si lo hubieras guardado. Los cambios posteriores se conservan una vez que la herramienta termina de dibujar. Una creación sin guardar permanece en Projects después de cerrar la pestaña y vuelve a abrirse con sus cambios marcados como no guardados.

**Leave anyway** sigue descartando esos cambios. Volver a abrir la herramienta desde la pantalla de inicio empieza una creación nueva; abre la anterior desde Projects.

3D y Lolly Darkroom guardan mientras trabajas, pero no conservan los archivos que cargas en ellas, como un modelo 3D o una LUT. History y **Save** conservan el nombre, el tipo y el tamaño del archivo, no el archivo. Cuando vuelves a abrir el trabajo, una nota indica qué archivo era, y la herramienta funciona sin él hasta que lo vuelvas a cargar. Conserva tus archivos originales.

Con [Sync](/info/sync.html) activado, una creación archivada así pasa a tus otros dispositivos. Sus versiones se quedan en el dispositivo donde se crearon.

Si una creación está abierta en dos pestañas y guardas en ambas, se conserva lo último que guardaste. El trabajo reemplazado está en **Protected drafts**, en el History de la creación, con **Open draft as a copy**.

Esto solo funciona en la aplicación web, no en las aplicaciones de escritorio o móvil, ni mientras trabajas en vivo con otra persona.
:::

<!--i:eti-download-->
## Encontrar un archivo que descargaste

En un navegador, **Download** entrega el archivo a tu navegador. El navegador guarda el archivo en su carpeta de descargas (normalmente **Downloads**) o te pregunta dónde. Lolly no recibe información sobre dónde se guardó el archivo, así que busca en la lista de descargas de tu navegador.

Si no apareció ningún archivo, mira el panel de exportación mientras sigues en la herramienta. Bajo **Download**, una línea muestra el nombre del archivo y la hora, con **Retry download**. En Chrome, Edge y otros navegadores Chromium, la línea también ofrece **Save file…** para elegir una carpeta. La línea y su archivo se conservan hasta que sales de la herramienta, recargas o vuelves a exportar.

Lolly también conserva dos cosas después de cada descarga:

- **Una copia del archivo**, en **Assets**, bajo **Your uploads**, mientras **Save my renders to my library** está activado en **Settings → Your renders** (**Settings** está al pie de la pantalla de inicio). El ajuste viene activado. Un vídeo o un archivo de más de 50 MB pide confirmación, y los archivos zip no se copian.
- **Los ajustes que usaste**, para tus últimas 24 descargas. **Recent exports**, bajo tu trabajo guardado en **Projects**, vuelve a abrir la herramienta con esos ajustes. No se incluyen las imágenes y los archivos que añadiste desde tu dispositivo. La misma lista está en **Settings → Activity & stats → Latest exports** y en la pestaña **Changes** de **History**.

::: details En las aplicaciones de escritorio y móvil
- **Aplicación de escritorio:** **Download** guarda en una carpeta **Lolly** dentro de tu carpeta **Downloads**, sin diálogo. La línea bajo **Download** indica dónde se guardó el archivo, como "Guardado en Downloads/Lolly", con **Show in folder**. **Open Exports Folder**, en el menú **Window** o **Exports**, abre la carpeta en cualquier momento. Un archivo con el mismo nombre que otro anterior se guarda como "name (1)".
- **iPhone y iPad:** el archivo se guarda en la aplicación **Files**, bajo **Lolly**, y se abre el panel de compartir. La línea bajo **Download** dice "Guardado en Files → Lolly".
- **Android:** se abre el menú de compartir. Elige dónde va el archivo.

En iPhone, iPad y Android, un archivo nuevo reemplaza a otro anterior con el mismo nombre.
:::

<!--i:eti-history-->
## Volver a una versión anterior

- **Durante esta visita:** **Undo** retrocede por tus últimos 100 cambios, hasta que sales de la herramienta o recargas. Consulta [Deshacer y rehacer](/info/using.html#undo-and-redo).
- **En las [herramientas que guardan mientras trabajas](#which-tools-save-as-you-work):** se conservan versiones anteriores de cada creación.
- **Todo lo que hay en el dispositivo:** con [Sync](/info/sync.html) activado, **Restore an earlier copy**, en **Settings → Connected services**, recupera una de las últimas siete copias diarias o la copia anterior a la última que aplicaste. Todo lo que hay en este dispositivo pasa a coincidir con esa copia.

Para abrir una versión anterior:

1. Pulsa **History**, el botón de reloj junto a **Undo** y **Redo**. En Lolly Design, **History** está en la barra superior. En un teléfono, pulsa **•••** y luego **History**. En herramientas sin **Undo**, como Text y Lolly Sandbox, **History** está junto a **Home** arriba a la izquierda.
2. Busca la versión por su fecha y hora. Las filas **Automatic checkpoint** se crean mientras trabajas; las filas **Saved version** corresponden a las veces que guardaste.
3. Pulsa **Open as a copy**. La versión se abre como una creación nueva, y la que tenías abierta sigue como estaba. La copia está en **Projects**, con "(copy)" después de su nombre.

Para conservar una versión con nombre, pulsa **Name version**, escribe un nombre y pulsa **Keep milestone**. Las versiones con nombre aparecen en la página **History**, bajo **Milestones**.

::: details El panel History y la página History
El panel **History** también enumera filas **Recovered work**, y **Protected drafts** contiene tus últimas ediciones entre puntos de control, con **Open draft as a copy**. **Lolly Compare** y **Check assets** te ayudan a elegir antes de abrir una copia. Cambia **This creation** a **All history on this device** para ver todas las creaciones.

Los puntos de control automáticos se espacian con el tiempo: uno por minuto durante la última hora, uno por hora durante el último día, uno por día durante 30 días y después uno por semana. Se conservan todas las versiones guardadas y con nombre. Al borrar una creación, sus versiones también pasan a **Trash**, y **Delete forever** las elimina.

Cuando se llena el almacenamiento de History, se eliminan primero los puntos de control automáticos más antiguos de las creaciones que no has abierto en 30 días. Aun así, siempre se conserva lo que guardas. Se escribe como trabajo actual, y History indica que este guardado no se conserva como una versión. **Settings → Storage** muestra cuánto ocupa History.

La página **History** (`#/history`) abarca todas las creaciones de este navegador. Para abrirla, pulsa el botón de reloj arriba a la derecha de la pantalla de inicio o de **Projects**, elige **Saved sessions** en el menú de perfil (en un teléfono, el botón redondo del logo arriba a la derecha) o pulsa **Open app history** en el panel History de una herramienta. Las aplicaciones de escritorio y móvil no tienen página History. En ellas, el botón de reloj de la pantalla de inicio y **Saved sessions** abren **Your recent work**: tus últimas sesiones guardadas y exportaciones, con un enlace a Projects.

- **Recent** enumera tus creaciones, las más nuevas primero, con **Resume**.
- **Changes** reúne los puntos de control, las descargas y los resultados de Convert en una línea de tiempo. Una descarga tiene **Reopen settings**.
- **Milestones** enumera las versiones con nombre.

Cada creación es una tarjeta con su imagen. **Grid** o **List** cambia la disposición. Filtra por proyecto, herramienta y fecha (en **Filters** en un teléfono). El menú de una tarjeta (clic derecho o pulsación larga) ofrece **Resume**, **Versions**, **Show in Projects** y **Move to Trash**. Para eliminar varias, selecciónalas y elige **Move to Trash**, que ofrece Undo.
:::

<!--i:eti-folder-move-->
## Trasladar tu trabajo a otro dispositivo

| Para | Usa |
|---|---|
| Mantener tus dispositivos sincronizados | **Sync across devices**, en **Settings → Connected services**: consulta [Sincronizar tus dispositivos](/info/sync.html) |
| Trasladarlo todo una vez | **Export my data** e **Import data…**, más abajo |
| Entregar un diseño o un proyecto | Un archivo `.lolly`: **Export**, luego **Share** y después **Download .lolly**; para un proyecto completo, **Download project (.lolly)** en el menú de la carpeta. Pulsa **Open** en el otro dispositivo. Consulta [El archivo .lolly](/info/using.html#the-lolly-file) |

Un enlace para compartir lleva tus ajustes, pero no las imágenes ni los archivos que añadiste desde tu dispositivo.

::: note Importar añade y no borra nada
Las carpetas, los favoritos y las plantillas del archivo se añaden a los que ya hay en el otro dispositivo. Cuando un elemento guardado está en ambos, se conserva la copia guardada más recientemente. Tus datos y ajustes de ese dispositivo se quedan como están. Los que están vacíos se rellenan desde el archivo. **Bring it to this device**, en Sync, funciona igual.
:::

Para trasladarlo todo una vez:

1. En el dispositivo antiguo, abre **Settings → Storage** y, bajo **Move to another device**, pulsa **Export my data**. Lolly descarga un único archivo `.zip` cuyo nombre empieza por `LollyTools-`.
2. Pasa el archivo por USB, enviándotelo por correo, con AirDrop o mediante una carpeta compartida.
3. En el dispositivo nuevo, abre **Settings → Storage**, pulsa **Import data…**, elige el archivo y pulsa **Import**.

::: note Lo que se queda
Las sesiones iniciadas, las claves y la frase de contraseña de sincronización se quedan en cada dispositivo. La lista de descargas recientes, las descargas sin conexión y los modelos de IA no se trasladan por ninguna vía. El historial de versiones solo viaja en un archivo de **Export my data**, no mediante Sync ni un `.lolly`. Cuando el historial es demasiado grande para un solo archivo, se omiten los puntos de control automáticos más antiguos y la línea de exportación indica cuántos. Puedes descargar y abrir una copia que Sync guarda en tu almacenamiento, o elegirla en **Import data…**, como un archivo de copia de seguridad. Una copia cifrada pide tu frase de contraseña.
:::

::: details Qué contiene el archivo de copia de seguridad
El archivo se llama `LollyTools-<First>-<Last>-<YYYY-MM-DD>-<n>.zip`. Las partes del nombre proceden de tu perfil y se omiten si no están definidas. `<n>` cuenta las exportaciones realizadas el mismo día. Contiene tu perfil, con tus carpetas, Trash, plantillas y favoritos; cada sesión guardada con su miniatura; las imágenes, fuentes y logos que subiste y las copias de tus descargas; tus design systems; tus preferencias (tema, ancho de la barra lateral, estadísticas de actividad local); versiones guardadas y resultados de Convert; y, desde la aplicación web, el historial de versiones de tus creaciones.

La caché del catálogo no se incluye. El dispositivo nuevo vuelve a descargarla. Cada parte tiene una suma de comprobación, así que la importación detecta un archivo dañado durante el traslado. Las sesiones guardadas se vuelven a vincular a tus imágenes importadas. Las aplicaciones web, de escritorio y móvil leen el mismo archivo. La aplicación de terminal escribe su propia copia de seguridad más sencilla, que este formato no lee. **Export my data & render everything** crea el mismo archivo más un segundo zip con cada sesión guardada renderizada en su formato de salida. El formato completo está en [Transferencia de datos](/info/data-transfer.html).
:::

<!--i:eti-globe-->
## Si borras los datos de tu navegador

En la aplicación web, Lolly guarda todo en el almacenamiento de tu navegador para este sitio: trabajo guardado, imágenes, fuentes, design systems, historial de versiones y descargas sin conexión. Borrar los datos de este sitio en tu navegador elimina todo eso, y Lolly no puede recuperar nada. Lo que queda es lo que ya salió del navegador: los archivos que descargaste, un archivo de **Export my data**, una copia de [Sync](/info/sync.html) y los enlaces que compartiste.

::: warning Antes de borrar los datos del navegador
Pulsa **Export my data** en **Settings → Storage** y conserva el archivo en otro lugar.
:::

Cuando se inicia la aplicación, Lolly pide al navegador que no borre su almacenamiento cuando quede poco espacio en el dispositivo, y el navegador decide. En **Settings → Available offline**, una línea que empieza por **Protected** significa que el navegador aceptó. "El navegador puede borrar las descargas si queda poco espacio en el dispositivo" significa que no aceptó, y **Protect downloads** vuelve a pedirlo.

Si el navegador no aceptó, puede borrar el trabajo guardado además de las descargas cuando quede poco espacio, así que conserva un archivo reciente de **Export my data**.

**Settings → Storage** muestra cuánto espacio usa cada tipo de datos. Su fila **History** cuenta los puntos de control automáticos, sus vistas previas y los borradores de recuperación. **Remove automatic checkpoints older than 30 days** libera ese espacio y conserva las versiones guardadas y con nombre. **Clear cache** elimina los archivos descargados del catálogo, que se vuelven a descargar cuando hacen falta. **Clear all my data** te pide que escribas una palabra, desactiva Sync y luego elimina todo lo que Lolly guarda en este navegador: tu perfil y tus ajustes, las sesiones guardadas con su historial y Trash, los archivos subidos, las fuentes y los design systems, el registro de descargas, los resultados de Convert, los modelos de IA descargados y las copias sin conexión. Los archivos que descargaste se quedan donde los guardaste. La aplicación se inicia entonces como en una primera visita.

![La tarjeta de almacenamiento en una pantalla del ancho de un teléfono: todas las categorías de datos del dispositivo con su nombre y el botón Clear all my data al pie](/t/url-shot?url=%2F%23%2Fprofile%3Ffocus%3Dstorage-section&width=430&height=1600&dpi=192&waitMs=2400&css=.welcome-dialog%2C.personalize-nudge%2C.store-selbar%2C.profile-row-value%2C.profile-group-value%2C%23store-hero-num%2C%23store-headroom%7Bdisplay%3Anone%7D&format=svg&waitSelector=%5Bdata-store-group%3Dmove%5D&drive=click%3A%5Bdata-store-group%3Dwork%5D%3Esummary%3Bclick%3A%5Bdata-store-group%3Dcaches%5D%3Esummary&walker=1&cropSelector=%23storage-section&dark=1&filename=pv-storage-clear)

En las aplicaciones de escritorio y móvil, las sesiones guardadas son archivos en la carpeta de datos de la propia aplicación, y todo lo demás está en su propio almacenamiento. Borrar los datos de un navegador web no los afecta.

::: details Dónde guardan las sesiones las aplicaciones de escritorio y móvil
Un archivo por sesión guardada, en una carpeta `saved-state`:

- macOS: `~/Library/Application Support/tools.lolly.Desktop/saved-state/`
- Windows: `%APPDATA%\tools.lolly.Desktop\saved-state\`
- Linux: `~/.local/share/tools.lolly.Desktop/saved-state/`, o la misma ruta bajo `$XDG_DATA_HOME`
- iPhone, iPad y Android: dentro del almacenamiento de la propia aplicación, que la aplicación Files no muestra

Las imágenes, los design systems y la lista de descargas recientes se quedan en el almacenamiento interno de la aplicación, no en estas carpetas. La aplicación de terminal y la línea de comandos leen la misma carpeta `saved-state`: consulta [Dónde se guardan las sesiones](/info/cli-reference.html#where-saved-sessions-live).
:::

<!--i:eti-trash-->
## Recuperar algo que borraste

Borrar una sesión guardada, una carpeta, uno de tus archivos subidos o una de tus fuentes en la aplicación lo mueve a **Trash** durante 30 días, desde donde lo borres: **Projects**, **Assets**, **Settings → Storage** o la lista de sesiones guardadas de una herramienta. Una carpeta y todo su contenido van a Trash como una sola entrada. Una sesión conserva su historial de versiones en Trash. Justo después de borrar, un mensaje ofrece **Undo**. Más tarde:

1. Abre **Trash**: la tarjeta **Trash** en **Projects**, el botón **Trash** en **Assets → Your uploads** o la fila **Trash** en **Settings → Storage**. Los tres abren la misma lista.
2. Pulsa **Restore** junto al elemento. Vuelve a su carpeta, y una fuente recupera los roles que tenía en su design system.

**Delete forever** elimina un elemento para siempre. **Empty Trash** pide confirmación y luego elimina todos los elementos de Trash. Los elementos con más de 30 días se eliminan para siempre.

::: warning Algunas eliminaciones son inmediatas
Al borrar un design system, un logo o tu foto de perfil, no pasan a Trash. La línea de comandos y la aplicación de terminal también eliminan al instante.
:::

Con [Sync](/info/sync.html) activado, **Restore an earlier copy** puede recuperar el estado de todo el dispositivo de un día anterior, y un archivo de **Export my data** recupera lo que contiene.
