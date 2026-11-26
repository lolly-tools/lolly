# Usar Lolly

Abre una herramienta, modifica lo que te permita modificar, guarda el resultado y compártelo mediante un enlace o un archivo.

Todo se ejecuta en tu dispositivo sin cuenta y funciona sin conexión cuando ya has descargado las herramientas y los recursos que necesitas. Para arrancar, la aplicación necesita un navegador o una aplicación con WebGPU. [Entornos compatibles](/info/supported-environments.html) enumera los que se han probado.

**El ciclo**, en cuatro pasos:

::: steps
- <!--i:eti-home--> **[Abre una herramienta](#find-your-way-around)** Haz clic en una tarjeta de la pantalla de inicio. Los controles están junto a una vista previa en vivo.
- <!--i:eti-sliders--> **[Cambia las entradas](#change-what-the-tool-lets-you-change)** Solo las entradas que el autor dejó abiertas. Haz clic en el diseño para localizar su control.
- <!--i:eti-folder-plus--> **[Guarda tu trabajo](#saving-continuing)** **Save** lo conserva en My library y Projects permite recuperarlo.
- <!--i:eti-link--> **[Comparte el diseño](#sharing-your-work)** Un enlace que contiene todas las entradas o un único archivo `.lolly`.
:::

<!--i:eti-home-->
## Oriéntate

::: figure using-app-map
La pantalla de inicio tiene cuatro pestañas en la parte superior y una barra al pie. Al abrir una herramienta, sus controles aparecen junto a una vista previa en vivo.
:::

En la parte superior de la pantalla de inicio hay cuatro pestañas: **Tools**, **Utilities**, **Assets** y **Projects**. Tools son las herramientas con las que creas. Utilities convierte, comprueba o limpia un archivo. Assets es tu biblioteca. Projects conserva lo que guardaste.

La barra al pie incluye **Open**, **Settings**, un campo de búsqueda, un atajo **Verify** a Lolly Verify y **Docs**, que abre estas guías. La barra aparece en Tools, Utilities, Assets, Projects, Settings y las guías dentro de la aplicación, y se oculta cuando abres una herramienta. [Lolly Search](/info/search.html) encuentra tus herramientas, trabajo guardado, recursos y ajustes desde ese campo. [Ask Lolly](/info/ask.html) responde a una pregunta escrita con la sección correspondiente de estas guías.

Haz clic en una tarjeta para empezar un trabajo nuevo con esa herramienta. Puedes volver a abrir el trabajo guardado desde **Projects**. En la primera visita, una franja de bienvenida en la parte superior de la galería ofrece una acción para empezar: **Start making** con Lolly Demo o **Make it yours** para configurar tu propio design system.

![Una tarjeta de la galería con navegación de ejemplo y una acción Nueva](/t/url-shot?url=%2F%23%2F&width=1440&height=900&dpi=192&waitMs=1600&css=.welcome-dialog%2C.personalize-nudge%7Bdisplay%3Anone!important%7D&waitSelector=.gallery-view%5Bdata-shots-settled%5D&walker=1&format=svg&localize=1&dark=1&cropSelector=.gtile%5Bdata-tool-id%3D%22design%22%5D&filename=gallery&try=1)

Cada herramienta tiene una vista dividida: los **controles** a un lado y una **vista previa** en vivo al otro. La vista previa se actualiza cuando cambias un control y lo que ves es lo que se exporta.

![Vista dividida de una herramienta - los controles apilados a la izquierda y el gráfico de barras agrupadas que dibuja en vivo a la derecha](/t/url-shot?url=%2F%23%2Ftool%2Fchart%3Fct%3Dbar%26t%3DExample%2520data%26st%3DSample%2520values%252C%2520not%2520a%2520real%2520dataset%26d%3DMonth%252CSeries%2520A%252CSeries%2520B%252CSeries%2520C%250AJan%252C12%252C9%252C5%250AFeb%252C18%252C14%252C7%250AMar%252C24%252C17%252C11%250AApr%252C29%252C23%252C15%26lg%3D1&width=1440&height=900&dpi=192&waitMs=2500&walker=1&format=svg&dark=1&filename=vt-tool-split-view)

**Lolly Design** es la excepción: un lienzo libre con cuadros que puedes arrastrar, redimensionar y rellenar con texto, con su propia barra superior, línea de tiempo y controles de deck. Su guía es [Lolly Design: el lienzo libre](/info/design.html).

<!--i:eti-sliders-->
## Cambia lo que la herramienta te permite cambiar

Una herramienta solo muestra las entradas previstas para cambiar. El autor fijó los colores, el diseño, la tipografía y la lógica, así que tu trabajo sigue sus reglas. Las entradas incluyen texto, deslizadores, selectores de color, menús desplegables, fechas, selectores de imagen y grupos de filas repetibles. Algunas se encuentran en secciones plegables.

![Los controles apilados de una herramienta - un campo de texto, selectores de color y un deslizador, sin nada más de lo que el autor decidió dejar bloqueado](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools&width=1440&height=900&dpi=192&waitMs=2500&cropSelector=%23tool-inputs&walker=1&format=svg&dark=1&filename=use-tool-inputs)

**Haz clic en el diseño para localizar su control.** Haz clic en un elemento de la vista previa y su control se desplaza hasta quedar visible y recibe el foco. En un grupo de filas repetibles, se despliega la fila en la que hiciste clic.

**Clear changes**, encima de los controles, restablece el valor predeterminado de cada entrada.

**Opciones del design system.** Si tu design system ofrece varias colourways, un aspecto claro y otro oscuro u otra opción de tema, las encontrarás en una sección **Design system** debajo de los controles. Una opción solo aparece si cambia esta herramienta, así que una utilidad de archivos no muestra esa sección. Cada colourway se representa con un punto de sus propios colores, claro y oscuro son dos botones y cualquier otra opción es una lista.

La opción corresponde a esta pieza. Viaja en el enlace y en la sesión guardada. Todos los colores vinculados al design system siguen la opción y los colores de la propia aplicación no cambian. Lolly Design ofrece las mismas opciones en la pestaña **Canvas** del Inspector. Una herramienta cuyos colores son su contenido puede conservar la colourway canónica y, en ese caso, no muestra puntos de colourway. [Lolly Demo en uso](/info/lolly-demo-in-use.html#colourways-on-real-work) muestra colourways aplicadas a trabajo real. Para usar una colourway en la aplicación y en cada pieza nueva, elígela en **Settings → Appearance** ([Haz tuya una colourway](/info/colourways.html#make-a-colourway-your-own)).

### Zoom y desplazamiento de la vista previa

- **Zoom:** usa Cmd/Ctrl y la rueda o pellizca en un trackpad, con el puntero como centro. En el teclado, `0` o `Shift+1` ajusta todo, `1` o `Shift+0` pone el zoom al 100% y `Shift+2` ajusta la selección. `+` / `−` hacen zoom en torno al puntero si está sobre el área de edición; en caso contrario, en torno al centro.
- **Desplazar:** mantén pulsado **Space** y arrastra, o arrastra con el botón central del ratón. Los clics simples siguen disponibles para hacer clic en partes del diseño.
- **Táctil:** pellizca para hacer zoom, arrastra para desplazar y toca dos veces para ajustar la vista.
- **HUD de zoom:** mantén pulsado el remolino de Lolly de la esquina para desplegar `−`, **Fit** y `+`. Un toque corto en el remolino sigue abriendo el menú de tu perfil.

En Lolly Design, **Fit all** abarca las mesas de arte y las capas sueltas. El zoom manual puede bajar del 20% hasta que la página ocupe la mitad de la vista. El límite absoluto es el menor entre el 5% de la escala Fit normal y el 2% de zoom absoluto.

Al cambiar el tamaño de salida, la vista siempre vuelve a ajustarse.

![El HUD de zoom desplegado desde el remolino de la esquina del lienzo - menos, Fit, más, después los interruptores de tema y sonido y el asa para moverlo](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools&width=1440&height=900&dpi=192&waitMs=2500&css=.stage-nav%7Bopacity%3A1!important%7D&drive=drag%3A.stage-nav-profile%7Cdx%3D1%7Chold%3Bwait%3A700&cropSelector=.stage-nav&walker=1&format=svg&dark=1&filename=use-zoom-hud)

### Deshacer y rehacer

**Cmd/Ctrl-Z** retrocede un paso y **Cmd/Ctrl-Shift-Z** (o **Cmd/Ctrl-Y**) avanza un paso. Los botones **Undo** y **Redo** están encima de los controles o en la barra superior de Lolly Design. Cada botón se atenúa cuando no le quedan pasos. Un mensaje indica qué entrada restauró cada acción de deshacer e incluye un botón **Redo**.

- **Un arrastre equivale a un paso.** Los cambios repetidos en un mismo control dentro de medio segundo se combinan en un solo paso.
- **Se guardan los últimos 100 pasos.** Una edición nueva después de deshacer vacía la pila de rehacer.
- **En un cuadro de texto**, Cmd/Ctrl-Z actúa sobre el campo, carácter a carácter. Lolly toma el control en los deslizadores, menús desplegables, colores e interruptores.
- **Elegir un archivo** en una entrada de archivo no cuenta como paso, porque esos bytes solo se conservan durante esta sesión.

En una [colaboración](/info/collaborate.html) en vivo, los cambios del otro dispositivo nunca se incorporan a tu pila de deshacer. Puedes deshacer hasta que salgas de la herramienta o recargues. Para cambios más antiguos, las herramientas que guardan mientras trabajas conservan versiones previas en **History** ([Volver a una versión anterior](/info/find-your-work.html#go-back-to-an-earlier-version)).

### Cámara en vivo

Los efectos de la herramienta **Filter** (Halftone, Scanline, Posterize, Voronoi, Duotone, Stretch, Misprint, Dither, ASCII art y Glitch) muestran un botón **Go live** cuando hay una cámara disponible. Actívalo y el efecto sigue tu webcam fotograma a fotograma. Una exportación de movimiento graba el resultado como GIF, WebM o MP4. Los fotogramas se procesan en tu dispositivo. La cámara se libera en cuanto paras o sales de la herramienta. Cualquier selector de imagen también ofrece **Take a photo** para capturar un solo fotograma.

<!--i:eti-folder-plus-->
## Guardar & continuar

Para conservar tu trabajo, pulsa **Save**, la marca de verificación junto a **Export** en la píldora de renderizado. El trabajo nuevo se guarda en **My library**, el que ya habías guardado se actualiza donde está y no se descarga nada. El panel de exportación ofrece el mismo botón **Save**.

Para elegir dónde guardarlo, pulsa **Save as**, junto a **Download** en el panel de exportación. En **Save to a project**, deja seleccionado **My library** o elige un proyecto (**＋ New project…** crea uno) y pulsa **Save**. **Save as a template** conserva el diseño como [plantilla](/info/templates.html), un punto de partida para documentos nuevos. En Lolly Design, **Save as** está en el menú de Lolly. En un teléfono, pulsa **•••**, luego **File menu** y después **Save as**.

![La píldora de renderizado en dos mitades: Export, con una flecha hacia arriba que abre el panel de exportación, y Save, con una marca de verificación que guarda en el mismo lugar](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools&width=1440&height=900&dpi=192&waitMs=2500&css=%23tool-inputs%7Bdisplay%3Anone%7D&cropSelector=.render-pill&walker=1&format=svg&dark=1&filename=use-render-pill)

::: timeline
- <!--i:check--> Pulsa **Save** en la píldora de renderizado o **Save as** para elegir un proyecto.
- <!--i:folder--> El elemento se guarda en **My library** o en el proyecto que elegiste.
- <!--i:home--> Más tarde, pulsa **Home** arriba a la izquierda y abre la pestaña **Projects**.
- <!--i:document--> Abre el elemento. Todos los ajustes vuelven a estar ahí, listos para cambiarlos y exportar de nuevo.
:::

Los elementos toman el nombre de archivo que escribiste en el panel de exportación o, si no lo hiciste, el nombre de su herramienta, como **QR Code**. Un archivo de **Download** es una copia terminada. Para modificarlo después, abre el elemento guardado en Projects.

::: note El trabajo guardado se queda en este dispositivo
El trabajo personal guardado se queda en este dispositivo, en el navegador o la aplicación desde donde lo guardaste, salvo que actives [Sync](/info/sync.html).
:::

Si algo no está donde esperabas, [Encontrar y recuperar tu trabajo](/info/find-your-work.html) cubre todos los casos, desde una pestaña cerrada hasta los datos del navegador borrados.

::: details Proyectos de equipo con Lolly Work (opcional)
Si tu [organización usa Lolly Work](/info/organisation.html), inicia sesión en su instancia y abre **Projects → Team projects** para ver las sesiones compartidas contigo. La organización establece el acceso y la retención, y su servicio Lolly Work almacena esas sesiones. Cuando tu organización permite la edición en vivo, una sesión compartida se une a su colaboración en vivo al abrirse. [Trabajar juntos](/info/collaborate.html#collabs-through-lolly-work-optional) explica los pasos.

Tu biblioteca personal se mantiene aparte. Iniciar sesión en otro dispositivo te da acceso al trabajo del equipo. El trabajo personal guardado sigue necesitando Sync o una copia de seguridad para trasladarlo.
:::

<!--i:eti-link-->
## Compartir tu trabajo

Comparte un diseño como enlace o como archivo. **Share** en los controles de exportación abre un diálogo con ambas opciones. **Share link** en una sesión guardada en Projects abre el mismo diálogo para esa sesión. Tras enviar un archivo a Google Drive, Nextcloud, un bucket de S3, Dropbox o OneDrive, el diálogo también puede crear un enlace a través de ese servicio ([Exportar un archivo](/info/exporting.html#how-export-works)).

::: cols
## Un enlace

- Incluye todas las entradas en la dirección, así que el enlace reproduce el diseño.
- Deja fuera las imágenes y los archivos que añadiste desde este dispositivo, los textos muy largos y las listas muy grandes.
- Se abre en cualquier navegador, así que puedes guardar el enlace en marcadores, pegarlo o incluirlo en un commit.

## Un archivo .lolly

- Incluye la sesión guardada con las imágenes y los archivos de este dispositivo, y también puede incluir la herramienta y el design system.
- Excluye las ilustraciones del catálogo sujetas a licencia, salvo que elijas incluir los archivos.
- Se abre en Lolly: haz doble clic en él, usa **Open** o suéltalo sobre la aplicación.
:::

### El enlace

El enlace está en la parte superior del diálogo, con **Copy** y un botón **QR** que abre la herramienta QR Code con ese enlace. Debajo, **Link options** contiene:

- **Open in the installed app** convierte el enlace en una dirección `lolly://` para Shortcuts, lanzadores y automatización, sin cambiar ningún parámetro.
- **Shortest link** empaqueta un diseño largo en un token compacto y muestra cuántos caracteres ahorra. La forma legible sigue disponible.
- **Password-protect this link** cifra el enlace en tu dispositivo con AES-256. La contraseña nunca forma parte del enlace.
- **Pin this tool version** añade la bandera `_v`, para que una actualización posterior de la herramienta no pueda cambiar lo que renderiza el enlace.
- **When the recipient opens the link…** permite elegir pantalla completa, el panel de exportación ya desplegado, una descarga al abrir (`&export`) o una copia al portapapeles (`&copy`).
- **Copy credit** copia el texto "Hecho con Lolly" con el enlace, para una publicación o una diapositiva.

Cuando una herramienta contiene campos personales, como tu nombre, **Review personal fields** deja cada uno fuera del enlace hasta que lo marques. [Modo URL](/info/url-mode.html) cubre todo lo que puede incluir un enlace.

**El diálogo indica qué no puede incluir un enlace.** Lolly cuenta todo lo que no cabe en una dirección mientras crea el enlace. Si se ha omitido algo, el diálogo enumera lo omitido y te dirige a la opción de archivo. Un enlace que solo es largo recibe una nota más leve con su número de caracteres.

**Algunas herramientas hacen del enlace el producto completo.** Jump Page reúne tus enlaces en una página para compartir: un enlace de biografía, una charla o un escaparate. La página es el enlace, así que no se aloja nada ni hay una cuenta detrás de la página. Quien la visita ve la página a todo lo ancho, con un enlace por escena a medida que se desplaza.

![Jump Page en el editor: la escena del encabezado en la parte superior de la página, con las escenas de los enlaces debajo](/t/url-shot?url=%2F%23%2Ftool%2Fjump%3Ffull%26heading%3DFind%2520us%2520everywhere%26subheading%3DOne%2520link%2520for%2520everything.%26links%3DURL%252CName%252CEmoji%257Ehttps%25253A%25252F%25252Fexample.com%252CWebsite%252C%257Ehttps%25253A%25252F%25252Fexample.com%25252Fnews%252CNewsletter%252C%257Ehttps%25253A%25252F%25252Fexample.com%25252Fhello%252CSay%252520hello%252C&width=900&height=1300&dpi=96&waitMs=2000&cropSelector=%23tool-canvas&walker=1&format=svg&dark=1&filename=use-jump-page)

::: details Enlaces gestionados por la organización con Lolly Work
Para compartir con caducidad, revocación o contraseña, Lolly Work ofrece enlaces gestionados a sesiones compartidas, herramientas y recursos del catálogo. Se resuelven a través del servicio de la organización y siguen sus reglas de acceso. Son independientes de los enlaces autosuficientes anteriores. Revocar uno no puede retirar un archivo que alguien ya haya descargado. [Renderizado y uso compartido](/info/manage/sharing.html) enumera los tipos de enlace y los permisos.
:::

### El archivo .lolly

**Download .lolly**, en la sección **Editable file** del diálogo Share, escribe el diseño actual como un único archivo. Las ilustraciones normales del catálogo se incluyen junto con las imágenes y los archivos de este dispositivo. Un archivo desactualizado o no disponible permanece como referencia externa. Antes de guardar, el diálogo muestra el tamaño del archivo, cuántos archivos incrusta, cuántos referencia y si incluye la herramienta. Si tu dispositivo tiene un panel para compartir, **Send to…** le entrega el archivo (AirDrop, compartir en Android).

**Download project (.lolly)**, en el menú de una carpeta de **Projects**, escribe una carpeta completa para que otra persona pueda continuar con todas sus sesiones. Las sesiones por lotes se excluyen y el aviso indica cuántas. **Download originals**, en el mismo menú, escribe un zip simple con cada elemento como archivo independiente.

Antes de enviar un archivo, decides tres cosas:

- **Si incluye tu nombre.** Tu nombre, correo y organización solo se escriben cuando **Use my details to create** está activado en [tu perfil](/info/profile.html). Si está desactivado, el archivo solo registra que se creó con Lolly y cuándo.
- **Si incluye las ilustraciones excluidas.** Las ilustraciones sujetas a licencia y las bloqueadas por la marca quedan fuera de forma predeterminada, al igual que una obra del catálogo cuya licencia registrada Lolly aún no pueda leer. Si el diseño usa alguna, el diálogo indica cuántas y ofrece *Download without them* o *Include and download*. Incluirlas entrega los archivos a quien abra el `.lolly`. Una obra del catálogo sin información registrada sobre sus derechos se incluye, y el diálogo enumera cada una para que puedas revisarlas antes de enviar. El archivo `CREDITS.txt` enumera qué se incluyó y qué no, con el motivo. [Derechos creativos y créditos](/info/creative-rights.html) explica las reglas.
- **Si incluye la herramienta.** **Include the tool** empaqueta los archivos de la propia herramienta para que el diseño se abra en un dispositivo que no la tenga. Empieza marcado para una herramienta personalizada, como un fork, y sin marcar para una herramienta incluida en el catálogo firmado. En una compilación sin catálogo firmado, todas las herramientas cuentan como personalizadas.

**Abrir uno.** En las aplicaciones de escritorio y móviles, haz doble clic o toca un `.lolly`, elige **Open with Lolly** o envíalo a Lolly desde el panel para compartir. En la aplicación web, pulsa **Open** o suelta el archivo sobre Lolly. Todas las opciones leen primero el manifiesto del archivo y muestran su tamaño, contenido y lo que va a ocurrir antes de escribir nada.

::: warning Instalar una herramienta ejecuta su código
Si el archivo incluye una herramienta que no tienes, **Trust this tool?** muestra la herramienta y su autor, e indica que abrirla ejecuta su propio código en tu dispositivo. **Trust & install** continúa.
:::

Si lo rechazas, el trabajo se guarda igualmente en Projects y espera hasta que añadas la herramienta. Una herramienta cuyo código se distribuye como módulo aún no se puede instalar así y se rechaza de la misma forma.

::: details Qué contiene un .lolly y cómo se abre
`.lolly` es la extensión de los paquetes de Lolly, y el `format` de su `manifest.json` indica qué contiene:

- Un **diseño compartido** (`lolly-share`) contiene una sesión guardada, sus archivos incrustados y un comprobante de todo lo que aún se resuelve por referencia. También puede incluir la herramienta y el design system. Al abrirlo se añade un proyecto nuevo y nunca se sobrescribe una sesión.
- Un **proyecto compartido** (`lolly-share`, tipo `project`) contiene una carpeta de Projects: sus subcarpetas, todas sus sesiones con sus tarjetas y las imágenes archivadas allí. Al abrirlo se añade una copia de la carpeta. Cada sesión viaja como `sessions/<key>.json` con su tarjeta en `thumbs/`. Una versión de Lolly anterior a los archivos de proyecto te pide que actualices.
- Un **paquete de design system** (`lolly-brand`) contiene tokens y puede contener fuentes, logotipos, versiones publicadas y recursos conservados. Al abrir el paquete se añade un design system independiente con nombre y se activa ese sistema.
- Un **paquete de espacio de trabajo o de instancia** es un `lolly-brand` con herramientas declaradas, recursos del catálogo y, opcionalmente, una dirección de instancia. Cargar uno sustituye la única capa de espacio de trabajo cargada antes, y la vista previa enumera esos efectos que abarcan todo el dispositivo.

Una copia de seguridad completa del dispositivo no es un `.lolly`. Sigue siendo un `LollyTools-….zip` (formato `lolly-backup`) y se restaura desde **Settings → Storage → Import data…**. Una carpeta de herramienta comprimida también sigue siendo un `.zip`. [Transferencia de datos](/info/data-transfer.html) es la referencia de los formatos.

Un `.lolly` es un zip normal. Cambia su extensión a `.zip` para ver su contenido. Tus propias imágenes están en `assets/uploads/` y las ilustraciones del catálogo en `assets/catalog/`. `manifest.json` enumera todos los archivos y un README indica qué es el archivo.

macOS, Windows, Linux, iOS y Android registran el formato. Los gestores de archivos de escritorio muestran el archivo como documento de Lolly, y GNOME Files puede mostrar la miniatura propia de una sesión guardada. Abrirlo desde Lolly Design System Setup recomienda la acción de design system cuando un diseño compartido incluye uno, pero nunca oculta **Open shared design**.

En iOS o Android, un documento recibido de otra aplicación tiene un límite de 48 MB y la aplicación lo indica. La transferencia copia sus bytes de una aplicación a otra. **Open** dentro de Lolly no tiene ese límite, así que úsalo para un paquete más grande.

Tras tu confirmación, Lolly descomprime y verifica el paquete una sola vez. Los recursos van a tu biblioteca y se comparan por suma de comprobación para reutilizar los archivos que ya estén en el dispositivo. Las sesiones van a Projects con identificadores nuevos, así que el mismo archivo se puede abrir dos veces. Una sesión cuya herramienta falte espera allí. Los archivos de más de 100 MB se señalan como grandes, y la vista previa avisa si el almacenamiento del navegador indica menos espacio libre del que necesita el archivo. Se comprueba cada parte cubierta por la verificación de integridad antes de guardar nada, y se rechaza una copia dañada sin dejar restos.
:::

Tanto un enlace como un archivo entregan una instantánea. Para la edición en vivo, [Trabajar juntos](/info/collaborate.html) cubre las colaboraciones privadas entre dos dispositivos y las colaboraciones de trabajo opcionales a través de Lolly Work.

<!--i:eti-images-->
## Assets - tu biblioteca

**Lolly Assets** (`#/a`) contiene lo que pueden usar tus herramientas: logotipos de marca, imágenes, audio y movimiento, agrupados por tipo, y tus propios archivos. Tus archivos subidos se almacenan en tu dispositivo. Una organización que usa Lolly Work también puede ofrecer un catálogo compartido bajo sus propias reglas de acceso ([Usar Lolly en tu organización](/info/organisation.html)).

![Assets, con las muestras y fuentes de la marca y tus propios archivos subidos](/t/url-shot?url=%2F%23%2Fa%3Fsection%3Dswatches%2Cfonts&width=1440&height=900&dpi=96&waitMs=2400&css=.plat-swatch-grid~%2A%7Bdisplay%3Anone%7D&walker=1&format=svg&localize=1&dark=1&filename=assets)

- <!--i:upload--> **Añade tus archivos.** Suelta una imagen, SVG, clip de audio, vídeo, Lottie, PDF o deck de PowerPoint en el área de carga, o haz clic para elegir. El archivo aparece al instante en Assets y en el selector de recursos de cada herramienta. Un PDF de varias páginas o un `.pptx` pregunta qué páginas o diapositivas conservar, y cada una se convierte en un recurso SVG. Una imagen que añades dentro de una herramienta se conserva sin cambios en **My images**, así que su Content Credential sigue siendo verificable. Solo un archivo muy grande pregunta si quieres redimensionarlo. **Settings → Storage** muestra cuánto ocupa **My images**. No hay más límite que el almacenamiento de tu dispositivo. Para eliminar los datos EXIF y GPS al subir archivos, activa **Strip metadata from uploads** en **Settings → Feature flags**. Las Content Credentials se conservan en ambos casos.
- <!--i:star--> **Marca como favorito lo que usas a menudo.** Marca con una estrella un recurso o una muestra de marca y se fijará en la parte superior de cada selector.
- <!--i:folder--> **Pon orden.** Mueve un recurso a otro grupo, oculta un recurso de marca compartido que no uses (**Show hidden** lo recupera) o elimina tus propios archivos subidos. La misma barra de selección de Projects actúa sobre toda una selección.
- <!--i:layers--> **Separa un vídeo de su fondo.** Abre los detalles de un vídeo, o haz clic derecho en su tarjeta en un selector de recursos, y elige **Remove background…**. Un **On-device model** recorta un sujeto de una escena compleja. Una **Colour key** elimina un fondo iluminado de manera uniforme, como una pantalla verde, y no necesita ninguna descarga. **Tolerance**, **Softness** y **Spill removal** ajustan su borde. **Resolution** (360, 480, 720 o 1080p, nunca por encima del original) permite intercambiar detalle por velocidad. El recorte es un WebP o PNG animado con transparencia, guardado junto al original. La Content Credential del original acompaña al recorte como ingrediente. [Generado una vez, renderizado igual](/info/ai-features.html) explica por qué esto sigue siendo una edición normal.

### Lleva tu paleta y tus fuentes a cualquier parte

El panel **Swatches** de Assets muestra los colores de tu marca: sus colores de marca, los que añadiste, sus rampas y su espectro. Los colores de función que Lolly reserva para la interfaz (texto, superficies, bordes, colores principales de las colourways y copias de un color de marca con otro nombre) están detrás de una tarjeta gris **Show colour roles** al pie del panel.

Cada color es una tarjeta como cualquier otro recurso. Haz clic en uno para abrir sus detalles, selecciona varios para descargarlos o descarga la paleta completa en el formato que lea tu otra herramienta:

- <!--i:code--> **Design tokens (JSON)**, **CSS variables** o **CSS classes**, para una hoja de estilos o una compilación. Un color con una gama más amplia que sRGB conserva su valor de gama amplia: el CSS lo define después del hexadecimal, y el JSON conserva el hexadecimal junto con el color de gama amplia, la composición CMYK y la tinta plana.
- <!--i:palette--> **Adobe Swatch Exchange (.ase)**, para Illustrator o Photoshop. Un color fijado a una composición CMYK llega como esa muestra CMYK, una tinta plana como muestra de tinta plana con nombre y un color con una gama más amplia que sRGB como Lab.
- <!--i:pentool--> **GIMP palette (.gpl)**, para GIMP o Inkscape, y **SCSS variables**, ambos en sRGB.

![El panel Swatches: los cinco botones de descarga de la paleta en la parte superior, seguidos de cada color de marca como un chip que abre sus detalles](/t/url-shot?url=%2F%23%2Fa%3Fsection%3Dswatches&width=1440&height=900&dpi=96&waitMs=1800&css=.cat-group%3Anot%28%5Bdata-group%3Dswatches%5D%29%7Bdisplay%3Anone%7D&cropSelector=%5Bdata-group%3Dswatches%5D&walker=1&format=svg&dark=1&filename=use-swatch-downloads)

::: details Selecciona varios colores o abre los detalles de uno
Selecciona colores con el punto de cada tarjeta: haz clic con Shift en un segundo punto para seleccionar todo lo que hay entre ambos, arrastra un cuadro por los huecos o pulsa Cmd/Ctrl+A con una tarjeta enfocada. La barra ofrece **Download as…** en los mismos seis formatos, **Copy hex** y **Favourite**. Antes de elegir un formato, el menú enumera los colores que ningún formato puede contener (Transparent no tiene color), qué formatos guardan un color de gama amplia como su alternativa sRGB (SCSS y GIMP) y cuáles incluyen los valores CMYK y de tinta plana (JSON y .ase). Haz clic derecho en una tarjeta para acceder a las mismas acciones para un solo color.

Los detalles de un color llenan la vista previa con ese color y despliegan **Linked values** (su composición CMYK o tinta plana, cualquier valor definido para un espacio o una prensa concretos y su token de diseño), **Every notation** (hexadecimal, OKLCH, Display-P3 y el resto, cada uno con un botón de copia), **Plotted on a colour space**, **Tones** y **Readability**. Las teclas de flecha recorren la paleta, **Copy link** comparte el color y **Open in Colour Lab** abre el color para seguir trabajando.
:::

El panel **Fonts** enumera las tipografías de tu marca con un botón **download** para cada una, para instalarlas localmente o entregarlas a una imprenta.

<!--i:eti-grid-->
## Haz tuya la cuadrícula

- <!--i:star--> **Marca como favorito lo que usas.** Haz clic derecho en una tarjeta y elige **Add to favourites**. La herramienta obtiene una tarjeta grande en una franja sobre la cuadrícula. [Tus favoritos](/info/favourites.html) cubre esa franja.
- <!--i:eyeoff--> **Oculta una herramienta que nunca uses.** Haz clic derecho en una tarjeta, o selecciona varias, y elige **Hide tool**. Desaparece de la cuadrícula y de los resultados al escribir en ella. La herramienta sale de la cuadrícula y deja de aparecer al escribir en ella. Una tarjeta gris **Show hidden tools (N)** al final vuelve a mostrar las herramientas ocultas, atenuadas y con **Unhide tool** en su menú. Ocultar solo cambia tu cuadrícula: la herramienta sigue abriéndose desde un enlace o un marcador.
- <!--i:clock--> **Tus herramientas primero.** Una vez que hayas guardado trabajo en tres herramientas distintas, una fila **Yours** de chips sobre la cuadrícula muestra primero tus favoritas y las herramientas recientes.
- <!--i:sliders--> **Organízala a tu manera.** **View options** establece el diseño (**Grid**, **Card** o **List**), el tamaño y la densidad de las tarjetas, el orden y un filtro por categoría.

![El final de la cuadrícula de Tools con las herramientas ocultas visibles: la tarjeta atenuada de Wordmark y, al lado, la tarjeta gris que la volvió a mostrar, ahora con el texto Hide hidden tools](/t/url-shot?url=%2F%23%2F&width=1440&height=680&dpi=192&waitMs=1600&css=.welcome-dialog%2C.personalize-nudge%7Bdisplay%3Anone!important%7D&drive=click%3A.gtile--hiddenbox%3Bpress%3AEnd%3Bwait%3A800%3Bhover%3A.gtile--hiddenbox%3Bwait%3A300&waitSelector=.gallery-view%5Bdata-shots-settled%5D&walker=1&format=svg&rasterDpi=96&dark=1&filename=misc-hidden-tools)
<!--
SHOT NOTE (misc-hidden-tools): the trailing `press:End` is required. The
hidden box and the revealed cards live at the very END of the grid, and
clicking the box runs applyView(), which re-lays the grid out and drops the
scroll back to the top - so without it the frame published the TOP of the
gallery under a caption about its bottom. `press:` with no `on=` goes to the
keyboard, and the End key with focus on the just-clicked box scrolls the
document; the walker then anchors the body walk to that band.
The tile reads "HIDE hidden tools" in the shot, not "Show" - it is a toggle and
the recipe has just pressed the tile. The alt says so rather than quoting the resting
label the prose above already gives.
The recipe hides nothing itself. The lolly-demo catalog the captures pin
ships Wordmark hidden (`defaultHiddenTools` in its assets index.json), so a
fresh profile already has one hidden tool and the recipe only clicks the grey
reveal tile (`.gtile--hiddenbox`, confirmed in gallery.ts). It used to tick
the QR Code card and press the bulk bar's Hide button first; under lolly-demo
that published Wordmark dimmed and QR Code not, under a caption naming QR
Code, so the steps were dropped rather than relied on. QR Code was hidden
in that run too: the End scroll had left the pointer over its card, and a
hovered hidden card lifts its dimming (gallery.css), so it read as a normal
tool. The closing `hover:` puts the pointer back on the reveal tile, which
keeps every revealed card dimmed.
-->

**Actúa sobre varias tarjetas a la vez.** Marca la casilla de cada tarjeta, arrastra un cuadro de selección por el espacio vacío o haz clic con Shift/Cmd, y aparece una barra con lo que permite esa vista:

- **Tools y Utilities:** Favourite, Hide, Available offline, **View sessions** (Projects, mostrando solo las sesiones creadas con esas herramientas) y Copy link para una sola tarjeta.
- **Assets:** Favourite y Hide para cualquier selección. Duplicate, Download y Delete solo aparecen cuando todos los elementos seleccionados son archivos que tú has subido, porque un recurso compartido del design system es un contrato permanente.
- **Projects:** consulta [Encontrar y recuperar tu trabajo](/info/find-your-work.html#find-something-you-saved).

![La barra de selección de la galería para dos herramientas, con Available offline, View sessions, Favourite y Hide](/t/url-shot?url=%2F%23%2F&width=1440&height=900&dpi=192&waitMs=1600&css=.welcome-dialog%2C.personalize-nudge%7Bdisplay%3Anone%21important%7D&drive=click%3A%5Bdata-select%3D%22qr-code%22%5D%3Bclick%3A%5Bdata-select%3D%22gradient%22%5D&waitSelector=.gallery-view%5Bdata-shots-settled%5D&walker=1&format=svg&dark=1&filename=misc-bulkbar-gallery&cropSelector=.gallery-bulkbar)
<!--
SHOT NOTE (misc-bulkbar-gallery): drive targets `[data-select="qr-code"]` /
`[data-select="gradient"]` - the `.tile-check[data-select="<ref>"]` checkbox button
confirmed directly in views/gallery.ts's card markup (the same attribute
cardMarkup gives every tile), so these two clicks tick both cards without
opening either tool.

NOTA DE CAPTURA (misc-sessions-by-tool, NO PUBLICADA): el resultado de "View sessions"
tenía su propia receta (`/#/p?tools=qr-code,d3`, toolsBodyHtml() de
views/projects.ts), omitida aquí porque no tiene un `drive=` que pueda
crear su propio contenido: una sesión guardada no está a un clic, tiene que
existir ya, y build-docs-shots.ts da a cada captura un
`browser.newContext()` nuevo. Publicaría una lista vacía. La misma dependencia que
la captura `projects` (ahora en find-your-work.md); revisar si la canalización incorpora un
punto de extensión para precargar el almacenamiento.
-->

**View sessions** solo aparece cuando hay algo seleccionado. Haz clic derecho en una tarjeta sin seleccionar para ver **N saved sessions**: una lista de las sesiones guardadas de esa herramienta, donde eliminar mueve una sesión a la papelera.

<!--i:eti-layers-->
## En un teléfono

En una pantalla estrecha, el diseño pasa a una sola columna:

- Los **controles se convierten en un panel** en la parte superior, con un asa para arrastrar en el borde inferior. Arrastra el asa para ajustarlo a **peek**, **half** o **full**, o tócala para plegarlo y desplegarlo. La vista previa ocupa el espacio de debajo y sigue a la vista mientras editas.
- Un botón flotante **Export** abre el panel de exportación: formato, tamaño, copiar, guardar y descargar. Toca el fondo para cerrar el panel.

![Una herramienta en una pantalla del ancho de un teléfono: los controles como panel en la parte superior, la paleta generada llenando la vista previa debajo y la píldora de renderizado flotando en el centro inferior](/t/url-shot?url=%2F%23%2Ftool%2Fcolor-palette%3Fseed%3Df97316%26harmony%3Dadjacent-3%26steps%3D9&width=430&height=900&dpi=192&waitMs=2200&walker=1&format=svg&dark=1&filename=vt-phone-palette)

<!--i:eti-copy-->
## Dispositivos plegables y iPhone Duo

En un dispositivo plegable, un iPhone Duo o una pantalla táctil casi cuadrada, Lolly organiza la herramienta en dos paneles:

- **Los controles a un lado y el lienzo al otro.** Los controles quedan lejos de la mano con la que dibujas. Elige **Dominant hand** en **Settings → Accessibility** o pulsa **Swap sides** en la parte superior de los controles. En un idioma de derecha a izquierda, los lados se invierten.
- **El separador es la bisagra.** Cuando el dispositivo comunica su pliegue, los paneles se encuentran en él para que ningún control ni ilustración quede sobre el doblez. En una pantalla continua, arrastra el separador a un tercio, la mitad o dos tercios del ancho. Lolly recuerda tu elección para cada vista en este dispositivo.
- **Sobre la mesa.** Con el dispositivo medio abierto y el pliegue atravesando la pantalla, el lienzo ocupa la mitad superior y los controles quedan debajo del pliegue. Al presentar, la diapositiva queda arriba, con tus notas, la siguiente diapositiva y **Back** y **Next** debajo. En Sequence, la vista previa está arriba y la línea de tiempo debajo.
- **Lolly Design, Design System Setup y Assets.** En Lolly Design, el inspector, las capas y el panel de exportación son pestañas junto al lienzo. Las herramientas se sitúan a lo largo del borde exterior del lienzo, bajo la mano con la que dibujas. Cuando no caben, la columna se desplaza y un degradado con una flecha muestra en qué dirección están las demás. Sobre la mesa, las herramientas recorren el pie del lienzo. Lolly Design System Setup mantiene el Board a un lado y la sala que abres al otro. En Assets, los detalles de un recurso se abren junto a la biblioteca, así que el siguiente toque muestra el siguiente recurso en el mismo lugar.
- **Nada sobre el doblez.** Cuando se comunica un pliegue, los diálogos se abren en la página que contiene los controles. Lo mismo ocurre con el cuadro de búsqueda al pie de la pantalla de inicio y sus resultados. Una pantalla plana los mantiene en el centro.
- **Plegar no pierde nada.** Plegar, desplegar o girar el dispositivo conserva tu documento, tu selección, el zoom y el campo en el que estabas escribiendo, con el cursor en su sitio.

La pantalla exterior de un dispositivo plegable mantiene el diseño para teléfono descrito arriba, al igual que una ventana de Lolly en una mitad de una pantalla dividida.

<!--i:eti-smile-->
## Ajustes, sonido y comodidad

**Settings**, al pie de la pantalla de inicio, contiene tus datos, tus design systems, accesibilidad, almacenamiento y descargas sin conexión. [Ajustes de Lolly](/info/dashboard.html) describe cada pestaña.

- **Tus datos y tu foto de perfil** rellenan cualquier herramienta preparada para usarlos, como una firma de correo o una credencial. [Perfiles](/info/profile.html) los explica.
- **Accessibility** tiene cuatro interruptores de comodidad: **Reduce motion**, **Hide colourful previews**, **High contrast** y **Large text**. Cambian la aplicación que rodea tu trabajo, nunca el lienzo de una herramienta ni una exportación. A su lado, **Dominant hand** elige en qué lado quedan los controles en dos paneles.
- **Sound** reproduce sonidos suaves de ayuda para tus acciones, y **Neurospicy Mode** reproduce una pista tranquila para concentrarte. Ambos están desactivados hasta que los actives en **Settings → Accessibility** o en el menú del perfil. El deslizador **Sound shape** bajo el interruptor Sound pasa de gotas suaves y redondeadas (Bouba) a chasquidos secos y raspaduras (Kiki), con las campanadas de Lolly en el centro. Las pistas de Neurospicy incluyen las emisoras generadas de Lolly: **Lolly Sings** y sus géneros, y tres **Lofi stations**. Las emisoras crean música sin fin mientras suenan. Cada una tiene controles de percusión y textura (y de ambiente, en Lofi), un enlace para compartir la melodía que oyes y un botón que la guarda en tus recursos. [Música generada](/info/generated-music.html) explica cómo se crea una melodía. **Music generator** en Utilities (`#/music`) te permite dar forma a una.
- **Available offline** descarga el resto de la aplicación, tus herramientas, el catálogo y las guías antes de que pierdas la conexión. Para instalar Lolly como aplicación web, usa el botón de instalación de tu navegador o *Add to Home Screen* en un teléfono. La aplicación instalada se ejecuta a pantalla completa y se actualiza cuando vuelves a tener conexión.
- **Performance UI**, en **Settings → Feature flags**, da a la aplicación un aspecto más sencillo que requiere menos recursos para dibujarse. Los lienzos de las herramientas y las exportaciones siguen igual. En un dispositivo lento, Lolly activa este aspecto por sí mismo e indica por qué, con **Undo** y **Keep** ([Performance UI](/info/configuration.html#curating-what-people-see)).
- **Storage** muestra lo que Lolly conserva en este dispositivo. [Si borras los datos del navegador](/info/find-your-work.html#if-you-clear-your-browser-data) explica qué se elimina al borrarlos, y la [Política de privacidad](/info/privacy.html) enumera todo lo que la aplicación obtiene o envía.

::: note Si una vista no se carga tras una actualización
Un panel vacío o un mensaje "failed to fetch" justo después de una actualización suele resolverse con una recarga. Tu trabajo guardado, tus sesiones y tus design systems permanecen intactos porque se almacenan en tu dispositivo. Solo puede ser necesario volver a añadir una imagen que añadiste y nunca guardaste.
:::

<!--i:eti-map-pin-->
## Por dónde seguir

- **[Lolly Design: el lienzo libre](/info/design.html)**: el lienzo, las formas, la línea de tiempo y la presentación de un deck.
- **[Lotes y Lolly Multi-edit](/info/batch.html)**: muchas versiones de un diseño o varios diseños guardados que se editan juntos.
- **[Exportar un archivo](/info/exporting.html)**: elegir un formato, tamaño, unidades de impresión, transparencia y vídeo.
- **[Importar un diseño](/info/design-import.html)**: lleva un archivo de Figma, Penpot, Illustrator, InDesign, Affinity o DXF a Lolly Design y sigue editando.
- **[Plantillas](/info/templates.html)**: puntos de partida guardados para una herramienta.
- **[Gama amplia de color y HDR](/info/hdr-editing.html)**: conserva la precisión de la imagen original en Lolly Design y Lolly Darkroom.
- **[Encontrar y recuperar tu trabajo](/info/find-your-work.html)**: dónde está todo y cómo moverlo a otro dispositivo.
