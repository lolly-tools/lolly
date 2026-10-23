# Encuentra y recupera tu trabajo

Falta algo: un diseño que nunca guardaste, un archivo que descargaste, la versión de la semana pasada, o todo después de borrar el navegador. Empieza con la tabla, y luego sigue la sección a la que apunta.

El trabajo personal permanece en el navegador o la aplicación en que lo creaste, en ese dispositivo, a menos que actives [Sync](/info/sync.html). Una organización que use Lolly Work opcional también guarda **Team projects** en su servidor, como se explica más abajo.

| Qué hiciste | Dónde mirar |
|---|---|
| Pulsaste **Guardar como** o **Guardar** | **Proyectos** |
| Pulsaste **Descargar** | Las descargas de tu navegador, y una copia en **Recursos** |
| Ninguna de las dos, en una [herramienta que guarda mientras trabajas](#which-tools-save-as-you-work) | **Proyectos** e **Historial** |
| Ninguna de las dos, en una herramienta que no lo hace | Solo la pestaña en la que trabajaste, hasta que la cierres |
| Lo eliminaste en la aplicación | **Papelera**, en **Proyectos**, **Recursos** o **Ajustes → Almacenamiento**, durante 30 días |

::: figure find-your-work-places
Dónde vive tu trabajo: el almacenamiento propio del navegador guarda Projects, History y Trash; las descargas van a las carpetas de tu dispositivo; Sync y un archivo de copia de seguridad son las copias fuera del navegador.
:::

::: details Encontrar el trabajo compartido en Lolly Work (opcional)
Abre el Lolly de tu organización e inicia sesión, y luego mira en **Projects → Team projects**. Las sesiones compartidas las guarda esa instancia y aparecen según tu acceso. Iniciar sesión puede restaurar el acceso a esas sesiones en otro dispositivo; no restaura tu biblioteca personal ni la copia de seguridad del dispositivo.

En una [collab de trabajo](/info/collaborate.html#work-collabs-with-lolly-work-optional), espera a **Saved to work** antes de salir. Si falta un proyecto compartido, comprueba que estás conectado a la instancia correcta y pregunta a su operador por el acceso o la conservación. Borrar los datos del navegador elimina las copias locales, no la copia del servidor de la organización. Consulta [Use Lolly at your organisation](/info/organisation.html).
:::

## Encuentra algo que guardaste

1. Pulsa **Inicio** en la esquina superior izquierda de la herramienta.
2. Abre la pestaña **Proyectos** en la parte superior de la pantalla de inicio (el icono de carpeta en un móvil).
3. Mira en la primera pantalla. Ahí está el trabajo guardado en **Mi biblioteca**, y cada proyecto es una carpeta. Para buscar en todas las carpetas a la vez, escribe en **Buscar en todos los proyectos…** al pie de la pantalla.

Un elemento se nombra según el nombre de archivo que escribiste en el panel de exportación, o según su herramienta, como **QR Code**, si no escribiste ninguno. Abre el elemento y todos los ajustes están de vuelta, listos para cambiar y exportar de nuevo. Para conservar así el trabajo nuevo, consulta [Saving & continuing](/info/using.html#saving-continuing).

::: note ¿No está en Proyectos?
- Puede estar en **Papelera**: consulta [Recupera algo que eliminaste](#get-back-something-you-deleted).
- Otro navegador, una ventana privada u otro dispositivo empiezan vacíos, a menos que uses [Sincronización](/info/sync.html) o [pases tu trabajo a otro dispositivo](#move-your-work-to-another-device).
- Si solo pulsaste **Descargar**, consulta [Encuentra un archivo que descargaste](#find-a-file-you-downloaded).
:::

::: details Trabajar con Proyectos
También puedes abrir **Proyectos** desde **Ajustes → Almacenamiento → Sesiones guardadas → Organiza en Proyectos**. Funciona como un gestor de archivos:

![Proyectos antes de guardar nada: los mosaicos Nueva carpeta, Nuevo recurso y Plantillas, el reloj de History arriba a la derecha y la barra Buscar en todos los proyectos al pie](/t/url-shot?url=%2F%23%2Fp&width=1440&height=900&dpi=192&waitMs=1200&walker=1&format=svg&localize=1&dark=1&filename=projects)
<!--
SHOT NOTE (projects): build-docs-shots.ts gives every shot a fresh browser
context with no storage seeding, so this frame is always the empty Projects
root. The alt says so. Revisit (and re-caption) if the pipeline gains a
storage-seeding hook.
-->

- <!--i:folder--> **Carpetas anidables.** Agrupa las sesiones guardadas en carpetas, y carpetas dentro de carpetas, tan hondo como quieras. Crea una carpeta, renómbrala o arrastra un mosaico sobre otra carpeta para moverlo; una ruta de migas te lleva de vuelta hacia arriba. Las sesiones guardadas sin carpeta aparecen directamente en la raíz de **Projects**.
- <!--i:clock--> **Ordena a tu manera.** **View options**, el botón de deslizadores arriba a la derecha, ofrece **Grid** o **List** y ordena por **Name**, **Date added**, **Last modified** (el predeterminado), **Size** y, dentro de una carpeta, **By tool**. Las carpetas siempre van primero sea cual sea el orden activo: el orden solo ordena las sesiones y carpetas dentro de su propio grupo.
- <!--i:document--> **Archiva el trabajo nuevo directamente.** **New asset** abre el selector compartido. Elige **Templates** para empezar desde una plantilla guardada: ábrela para editar, o usa **+ Add** para guardar una creación nueva de inmediato.
- <!--i:checklist--> **Selección múltiple (escritorio).** Marca la casilla de un mosaico, arrastra un recuadro de selección por el espacio vacío o haz **clic con Shift/Cmd**; **haz clic derecho** en un mosaico para su menú contextual. La barra de selección ofrece entonces **Render selection**, **Move to…**, **New folder**, **Delete** (que mueve a la Papelera), **Edit together** para dos a ocho sesiones de una sola herramienta, lado a lado bajo una barra lateral, y **Edit as sheet**, que abre una selección de cualquier tamaño o mezcla como filas en la cuadrícula de lotes.
- <!--i:download--> **Renderiza una carpeta o selección entera.** **Render folder** exporta todas las sesiones guardadas de una carpeta - incluidas sus subcarpetas - como un `.zip` anidado. **Render selection** hace lo mismo para cualquier selección múltiple, y una sola sesión se renderiza directamente a su propio archivo.
- <!--i:link--> **Salta directamente al trabajo guardado de una herramienta.** Marca una o más herramientas en la galería Tools y elige **View sessions** en la barra de selección - Projects se abre mostrando solo las sesiones creadas con esas herramientas, con un **Clear** para volver a la vista completa.
- <!--i:link--> **Comparte una sesión guardada.** Haz clic derecho en una sesión (en un teléfono, pulsa **•••** en su mosaico) → **Share link** para copiar un enlace que la reabre con los mismos ajustes; las imágenes de tu dispositivo no viajan con un enlace (el diálogo Share completo: consulta [Sharing your work](/info/using.html#sharing-your-work)).
- <!--i:pentool--> **Renombra o copia una.** Haz clic derecho en una sesión (en un teléfono, pulsa **•••** en su mosaico) para **Rename**, **Duplicate** (una copia en la misma carpeta) y **Move to…**.

![El popover de opciones de vista en Proyectos: Diseño con Cuadrícula y Lista, y Ordenar por configurado en Última modificación, junto a un botón que invierte el orden](/t/url-shot?url=%2F%23%2Fp&width=900&height=700&dpi=192&waitMs=1400&drive=click%3A.projects-viewopts&cropSelector=.projects-viewmenu&walker=1&format=svg&dark=1&filename=misc-projects-sort)
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

## Si cerraste la pestaña o saliste de la herramienta

Lo que vuelve depende de cómo saliste y de qué herramienta usaste:

- **Cerraste la pestaña, o volviste otro día.** El trabajo sin guardar se pierde, excepto en las [herramientas que guardan mientras trabajas](#which-tools-save-as-you-work): abre ese trabajo desde **Projects**.
- **Recargaste la página en la misma pestaña.** Tus ajustes vuelven desde la dirección de la página. En las herramientas que no guardan mientras trabajas, las imágenes y los archivos que añadiste desde tu dispositivo, y el texto de una sola línea de más de 150 caracteres, no vuelven, porque la dirección no los contiene.
- **Pulsaste Home, o el botón de atrás arriba a la izquierda.** Si cambiaste algo desde la última vez que guardaste, descargaste o copiaste, un diálogo **Unsaved edits** pregunta si guardar antes. **Save & leave** guarda el trabajo y te lleva a **Projects**, o de vuelta a la carpeta del proyecto desde la que abriste el trabajo. **Leave anyway** descarta tus cambios: un elemento guardado vuelve a como lo guardaste por última vez, y una creación que nunca guardaste sale de **Projects**. **Cancel** te mantiene en la herramienta.

Lolly solo pregunta cuando pulsas **Inicio** o el botón de retroceso en una herramienta. Cerrar la pestaña, recargar y el propio botón Atrás de tu navegador nunca preguntan. Para estar seguro, pulsa **Guardar como**, o **Guardar** en el panel de exportación, antes de salir de una herramienta.

Cuando la recuperación automática no está disponible, una nota junto a los controles de edición dice qué conservar:

- En una herramienta que trabaja sobre un archivo que aportas, guarda tus ajustes y conserva también los archivos originales.
- En una herramienta de grabación, o una utilidad sin acción Save, guarda o descarga el resultado antes de salir.
- Las aplicaciones de escritorio y móviles indican cuándo necesitas guardar a mano.
- En una colaboración privada, la persona que invitó conserva el documento y su historial, incluidos los cambios de la otra persona. La persona que se unió trabaja sobre una copia temporal y debería guardar una copia aparte antes de que termine la sesión.

::: note ¿Saliste sin guardar por error?
En las herramientas que guardan mientras trabajas, el Historial conserva una copia de los cambios descartados. Abre la página **Historial**, encuéntralos bajo **Cambios** y pulsa **Abrir como copia**. En otras herramientas los cambios han desaparecido.
:::

::: details Qué herramientas guardan mientras trabajas
En la app web, toda herramienta que crea un documento guarda mientras trabajas: Design, Chart, QR Code, Text, Sandbox y el resto. Estas herramientas no lo hacen:

- las herramientas que trabajan sobre un archivo que aportas, como Redact, Sign o Convert Image, porque Lolly nunca conserva una copia de ese archivo;
- las herramientas que graban desde tu cámara, micrófono o pantalla, como Record, Screen Capture y Voice Recorder;
- una herramienta sin nada que cambiar, como Countdown.

En las demás herramientas, tu primer cambio archiva el trabajo en **Projects** como si hubieras guardado, y los cambios posteriores se conservan mientras trabajas una vez que la herramienta ha terminado de dibujar. Una creación sin guardar sigue en Projects tras cerrar la pestaña, y se reabre con sus cambios marcados como sin guardar.

**Leave anyway** sigue descartando esos cambios, y History conserva una copia de las ediciones descartadas durante 30 días. Volver a abrir la herramienta desde la pantalla de inicio empieza una creación nueva; abre la anterior desde Projects.

3D y Darkroom guardan mientras trabajas, pero no conservan un archivo que cargas en ellos, como un modelo 3D o una LUT. History y **Save** conservan el nombre, el tipo y el tamaño del archivo, no el archivo. Cuando vuelves a abrir el trabajo, una nota indica qué archivo era, y la herramienta funciona sin él hasta que lo cargues de nuevo. Conserva tus archivos originales.

Con [Sincronización](/info/sync.html) activada, una creación archivada así llega a tus otros dispositivos como cualquier otra cosa en Proyectos. Sus versiones permanecen en el dispositivo donde se hicieron.

Si una creación está abierta en dos pestañas y guardas en ambas, se conserva el último guardado. El trabajo que reemplazó no se pierde: está bajo **Borradores protegidos** en el Historial de la creación, con **Abrir borrador como copia**.

Esto funciona solo en la app web, no en las apps de escritorio o móviles, y no mientras trabajas en vivo con otra persona.
:::

## Encuentra un archivo que descargaste

En un navegador, **Descargar** entrega el archivo a tu navegador, que lo guarda en su carpeta de descargas (normalmente **Descargas**) o te pregunta dónde. Lolly no sabe adónde fue el archivo, así que mira en la lista de descargas de tu navegador.

Si no apareció ningún archivo, mira en el panel de exportación mientras sigues en la herramienta. Bajo **Descargar**, una línea da el nombre del archivo y la hora, con **Retry download**, y en Chrome, Edge y otros navegadores Chromium **Save file…** para elegir tú mismo una carpeta. La línea y su archivo duran hasta que sales de la herramienta, recargas o exportas de nuevo.

Lolly también conserva dos cosas después de cada descarga:

- **Una copia del archivo**, en **Recursos** bajo **Tus archivos subidos**, mientras **Guardar mis renderizados en mi biblioteca** esté activado en **Ajustes → Tus renders** (**Ajustes** está al pie de la pantalla de inicio). El ajuste empieza activado. Un vídeo, o un archivo de más de 50 MB, pregunta antes, y un zip no se copia.
- **Los ajustes que usaste**, para tus últimas 24 descargas. **Exportaciones recientes**, debajo de tu trabajo guardado en **Proyectos**, reabre la herramienta con esos ajustes para que puedas hacer de nuevo el archivo, aunque las imágenes y archivos que añadiste desde tu dispositivo no se incluyen. La misma lista está bajo **Ajustes → Actividad y estadísticas → Últimas exportaciones** y en la pestaña **Changes** de **History**. Esta lista conserva ajustes, no archivos.

::: details En las apps de escritorio y móviles
- **App de escritorio:** **Descargar** guarda directamente en una carpeta **Lolly** dentro de tu carpeta **Descargas**, sin ningún diálogo. La línea bajo **Descargar** indica adónde fue el archivo, algo como "Saved to Downloads/Lolly", con **Mostrar en la carpeta**. **Open Exports Folder**, en el menú **Ventana** o **Exportaciones**, abre la carpeta en cualquier momento. Un archivo con el mismo nombre que uno anterior se guarda como "name (1)".
- **iPhone y iPad:** el archivo se guarda en la app **Archivos**, bajo **Lolly**, y se abre la hoja para compartir para que puedas enviarlo. La línea bajo **Descargar** dice "Saved to Files → Lolly".
- **Android:** se abre el menú para compartir para que elijas adónde va el archivo.

En iPhone, iPad y Android, un archivo nuevo reemplaza a uno anterior con el mismo nombre.
:::

## Vuelve a una versión anterior

- **Durante esta visita:** **Deshacer** retrocede por tus últimos 100 cambios, hasta que sales de la herramienta o recargas. Consulta [Deshacer y rehacer](/info/using.html#undo-and-redo).
- **En las [herramientas que guardan mientras trabajas](#which-tools-save-as-you-work):** se conservan versiones anteriores de cada creación. Sigue los pasos de abajo.
- **Todo en el dispositivo:** con [Sincronización](/info/sync.html) activada, **Restore an earlier copy**, bajo **Ajustes → Servicios conectados**, recupera una de las últimas siete copias diarias, o la copia de antes de tu última aplicación. Todo en este dispositivo coincide entonces con esa copia, no solo un diseño.

Para abrir una versión anterior:

1. Pulsa **Historial**, el botón de reloj junto a **Deshacer** y **Rehacer**. En Design, **Historial** está en la barra superior; en un móvil, pulsa **•••** y luego **Historial**. En las herramientas sin **Deshacer**, como Text y Sandbox, **Historial** está junto a **Inicio** arriba a la izquierda.
2. Encuentra la versión por su fecha y hora. Las filas **Punto de control automático** se toman mientras trabajas; las filas **Versión guardada** son los momentos en que guardaste.
3. Pulsa **Abrir como copia**. La versión se abre como una nueva creación, y la que tenías abierta se queda como estaba. La copia está en **Proyectos**, con "(copy)" después de su nombre.

Para conservar una versión con nombre, pulsa **Name version**, escribe un nombre y pulsa **Keep milestone**. Las versiones con nombre aparecen en la página **History**, bajo **Milestones**.

::: details El panel de History y la página de History
El panel de **History** también lista filas de **Recovered work**, y **Protected drafts** guarda tus últimos cambios entre puntos de control, con **Open draft as a copy**. **Compare** y **Check assets** te ayudan a elegir antes de abrir una copia. Cambia **This creation** a **All history on this device** para ver todas las creaciones.

Los puntos de control automáticos se van reduciendo con el tiempo: uno por minuto durante la última hora, uno por hora durante el último día, uno al día durante 30 días, y luego uno a la semana. Las versiones guardadas y las versiones con nombre se conservan todas. Eliminar una creación mueve también sus versiones a la **Papelera**, y **Eliminar para siempre** las elimina.

Cuando el almacenamiento del Historial se llena, se eliminan primero los puntos de control automáticos más antiguos de las creaciones que no has abierto en 30 días. Un guardado siempre se conserva, incluso entonces: se escribe como el trabajo actual, y el Historial indica que ese guardado no se conserva como versión. **Ajustes → Almacenamiento** muestra cuánto usa el Historial.

La página **History** (`#/history`) abarca todas las creaciones de este navegador. Para abrirla, pulsa el botón de reloj arriba a la derecha de la pantalla de inicio o de **Projects**, elige **Saved sessions** en el menú del perfil (en un teléfono, el botón redondo del logotipo arriba a la derecha), o pulsa **Open app history** en el panel History de una herramienta. Las aplicaciones de escritorio y móviles no tienen página History, así que allí el botón de reloj de la pantalla de inicio y **Saved sessions** abren **Your recent work**: tus últimas sesiones guardadas y exportaciones, con un enlace a Projects.

- **Recent** lista tus creaciones, las más nuevas primero, con **Resume**.
- **Changes** pone los puntos de control, las descargas y los resultados de Convert en una sola línea de tiempo. Una descarga tiene **Reopen settings**.
- **Milestones** lista las versiones con nombre.

Filtra por proyecto, herramienta y fecha (detrás de **Filters** en un móvil). La página History no tiene botón de eliminar; para quitar un elemento, usa Proyectos.
:::

## Pasa tu trabajo a otro dispositivo

| Para | Usa |
|---|---|
| Mantener tus dispositivos al día | **Sincronización entre dispositivos**, bajo **Ajustes → Servicios conectados**: consulta [Sincroniza tus dispositivos](/info/sync.html) |
| Trasladarlo todo de una vez | **Exportar mis datos** e **Importar datos…**, más abajo |
| Entregar un diseño o un proyecto | Un archivo `.lolly`: **Exportar**, luego **Compartir**, luego **Download .lolly**; para un proyecto entero, **Download project (.lolly)** en el menú de la carpeta. Pulsa **Abrir** en el otro dispositivo. Consulta [El archivo .lolly](/info/using.html#the-lolly-file) |

Un enlace para compartir lleva tus ajustes, pero no las imágenes o archivos que añadiste desde tu dispositivo.

::: note Importar no añade ni elimina nada
Las carpetas, favoritos y plantillas del archivo se añaden junto a los que ya hay en el otro dispositivo. Cuando un elemento guardado está en ambos, se conserva la copia guardada más recientemente. Tus datos y ajustes en ese dispositivo se quedan como están; los que están vacíos se rellenan desde el archivo. **Traer a este dispositivo**, en Sincronización, funciona igual.
:::

Para trasladarlo todo de una vez:

1. En el dispositivo antiguo, abre **Ajustes → Almacenamiento** y, bajo **Mover a otro dispositivo**, pulsa **Exportar mis datos**. Lolly descarga un archivo `.zip` cuyo nombre empieza por `LollyTools-`.
2. Lleva el archivo contigo por USB, envíatelo por correo, AirDrop o una carpeta compartida.
3. En el dispositivo nuevo, abre **Ajustes → Almacenamiento**, pulsa **Importar datos…**, elige el archivo y pulsa **Importar**.

::: note Qué se queda atrás
Los inicios de sesión, las claves y la frase de contraseña de sincronización permanecen en cada dispositivo. La lista de descargas recientes, las descargas sin conexión y los modelos de IA no viajan por ninguna vía. El historial de versiones viaja solo en un archivo de **Exportar mis datos**, no a través de Sincronización ni de un `.lolly`. Cuando el historial es demasiado grande para un solo archivo, se dejan fuera los puntos de control automáticos más antiguos y la línea de exportación indica cuántos. Una copia que Sincronización guarda en tu almacenamiento se puede descargar y abrir, o elegir en **Importar datos…**, como un archivo de copia de seguridad; una copia cifrada pide tu frase de contraseña.
:::

::: details Qué contiene el archivo de copia de seguridad
El archivo se llama `LollyTools-<First>-<Last>-<YYYY-MM-DD>-<n>.zip` (las partes del nombre vienen de tu perfil y se omiten si no están definidas; `<n>` es un contador por día para que las exportaciones del mismo día no choquen). Contiene tu perfil, con tus carpetas, Papelera, plantillas y favoritos; cada sesión guardada con su miniatura; tus imágenes subidas, tipografías, logotipos y las copias de tus descargas; tus sistemas de diseño; tus preferencias (tema, ancho de la barra lateral, estadísticas de actividad locales); versiones guardadas y resultados de Convert; y, desde la app web, el historial de versiones de tus creaciones.

La caché del catálogo no se incluye: se vuelve a descargar sola en el nuevo dispositivo. Cada parte lleva suma de verificación, así que un archivo dañado en tránsito se detecta al importar en lugar de restaurarse a medias. Las sesiones guardadas se vuelven a vincular automáticamente a tus imágenes importadas. Las aplicaciones web, de escritorio y móviles leen el mismo archivo; la aplicación de terminal escribe una copia de seguridad más sencilla propia, que este formato no lee. **Export my data & render everything** crea el mismo archivo más un segundo zip con cada sesión guardada renderizada a su salida. (Especificación completa del formato: [Data transfer](/info/data-transfer.html).)
:::

## Si borras los datos de tu navegador

En la app web, Lolly guarda todo en el almacenamiento de tu navegador para este sitio: trabajo guardado, imágenes, tipografías, sistemas de diseño, historial de versiones y descargas sin conexión. Borrar los datos de este sitio en tu navegador elimina todo eso, y Lolly no puede recuperar nada de ello. Lo que queda es lo que ya salió del navegador: los archivos que descargaste, un archivo de **Exportar mis datos**, una copia de [Sincronización](/info/sync.html) y los enlaces que compartiste.

::: warning Antes de borrar los datos del navegador
Pulsa **Exportar mis datos** bajo **Ajustes → Almacenamiento**, y guarda el archivo en otro lugar.
:::

Cuando la aplicación arranca, Lolly pide al navegador que no borre su almacenamiento cuando el dispositivo se queda sin espacio, y el navegador decide. En **Settings → Available offline**, una línea que empieza por **Protected** significa que el navegador aceptó. "The browser may clear downloads if the device runs low on space" significa que no, y **Protect downloads** lo vuelve a pedir.

Si el navegador no aceptó, puede borrar el trabajo guardado además de las descargas cuando se agota el espacio, así que conserva un archivo reciente de **Export my data**.

**Ajustes → Almacenamiento** muestra cuánto espacio usa cada tipo de dato. Su fila **Historial** cuenta los puntos de control automáticos, sus vistas previas y los borradores de recuperación; **Eliminar puntos de control automáticos de más de 30 días** libera ese espacio y conserva las versiones guardadas y con nombre. **Borrar caché** elimina los archivos de catálogo descargados, que se vuelven a descargar cuando hacen falta. **Borrar todos mis datos** te pide que escribas una palabra, desactiva Sincronización y luego elimina todo lo que Lolly guarda en este navegador: tu perfil y tus ajustes, las sesiones guardadas con su historial y la Papelera, los archivos subidos, las tipografías y los sistemas de diseño, el registro de descargas, los resultados de Convert, los modelos de IA descargados y las copias sin conexión. Los archivos que descargaste se quedan donde los guardaste. La aplicación arranca entonces como en la primera visita.

![La tarjeta de almacenamiento en una pantalla del ancho de un teléfono: cada categoría de datos del dispositivo con su nombre, con el botón Clear all my data al final](/t/url-shot?url=%2F%23%2Fprofile%3Ffocus%3Dstorage-section&width=430&height=1600&dpi=192&waitMs=2400&css=.welcome-dialog%2C.personalize-nudge%2C.store-selbar%2C.profile-row-value%2C.profile-group-value%2C%23store-hero-num%2C%23store-headroom%7Bdisplay%3Anone%7D&format=svg&waitSelector=%5Bdata-store-group%3Dmove%5D&drive=click%3A%5Bdata-store-group%3Dwork%5D%3Esummary%3Bclick%3A%5Bdata-store-group%3Dcaches%5D%3Esummary&walker=1&cropSelector=%23storage-section&dark=1&filename=pv-storage-clear)

En las apps de escritorio y móviles, las sesiones guardadas son archivos en la propia carpeta de datos de la app y el resto está en el propio almacenamiento de la app, así que borrar un navegador web no las afecta.

::: details Dónde guardan las sesiones las apps de escritorio y móviles
Un archivo por sesión guardada, en una carpeta `saved-state`:

- macOS: `~/Library/Application Support/tools.lolly.Desktop/saved-state/`
- Windows: `%APPDATA%\tools.lolly.Desktop\saved-state\`
- Linux: `~/.local/share/tools.lolly.Desktop/saved-state/`, o la misma ruta bajo `$XDG_DATA_HOME`
- iPhone, iPad y Android: dentro del propio almacenamiento de la app, que la app Archivos no muestra

Las imágenes, los sistemas de diseño y la lista de descargas recientes permanecen en el almacenamiento interno de la app, no en estas carpetas. La app de terminal y la línea de comandos leen la misma carpeta `saved-state`: consulta [Dónde viven las sesiones guardadas](/info/cli-reference.html#where-saved-sessions-live).
:::

## Recupera algo que eliminaste

Eliminar una sesión guardada, una carpeta, uno de tus archivos subidos o una de tus tipografías en la aplicación lo mueve a la **Papelera** durante 30 días, sea donde sea que lo elimines: **Proyectos**, **Recursos**, **Ajustes → Almacenamiento** o la lista de sesiones guardadas de una herramienta. Una carpeta se va con todo su contenido, como una sola entrada. Una sesión conserva su historial de versiones mientras está allí. Justo después, un mensaje ofrece **Deshacer**. Más tarde:

1. Abre la **Papelera**: el mosaico **Papelera** en **Proyectos**, el botón **Papelera** en **Recursos → Tus archivos subidos**, o la fila **Papelera** en **Ajustes → Almacenamiento**. Las tres abren la misma lista.
2. Pulsa **Restaurar** junto al elemento. Vuelve a su carpeta, y una tipografía recupera los roles que tenía en su sistema de diseño.

**Eliminar para siempre** elimina un elemento para siempre. **Vaciar papelera** pregunta primero, y luego elimina todos los elementos de la Papelera. Los elementos de más de 30 días se eliminan definitivamente.

::: warning Algunas eliminaciones son inmediatas
Eliminar un sistema de diseño, un logotipo o tu foto de perfil no pasa por la Papelera. La línea de comandos y la aplicación de terminal también eliminan al instante.
:::

Con [Sincronización](/info/sync.html) activada, **Restore an earlier copy** puede recuperar el estado de un día anterior de todo el dispositivo, y un archivo de **Exportar mis datos** recupera lo que contiene el archivo.
