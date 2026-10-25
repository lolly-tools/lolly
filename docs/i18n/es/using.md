# Usando Lolly

Tienes Lolly abierto y quieres crear algo, conservarlo y enviarlo. Esta página recorre ese ciclo: abrir una herramienta, cambiar lo que te deja cambiar, guardar el resultado y compartirlo como enlace o como archivo.

Todo aquí se ejecuta en tu dispositivo, sin cuenta, y sigue funcionando sin conexión una vez descargadas las herramientas y los recursos que necesitas. La aplicación necesita un navegador o una aplicación con WebGPU para arrancar; [Supported environments](/info/supported-environments.html) enumera los probados.

## Orientarte

::: figure using-app-map
La pantalla de inicio: cuatro pestañas arriba y la barra al pie. Una herramienta, una vez abierta, muestra sus controles junto a una vista previa en vivo.
:::

Cuatro pestañas recorren la parte superior de la pantalla de inicio: **Tools**, **Utilities**, **Assets** y **Projects**. Tools es con lo que creas, Utilities son bancos de trabajo para tareas como convertir, comprobar o limpiar un archivo, Assets es tu biblioteca y Projects guarda lo que guardaste.

La barra al pie contiene **Open**, **Settings**, un campo de búsqueda, **Verify** y **What?**. Se muestra en Tools, Utilities, Assets, Projects, Settings y en las guías que lees en la aplicación, y se aparta cuando se abre una herramienta. [Search](/info/search.html) llega a tus herramientas, trabajo guardado, recursos y ajustes desde ese campo. [Ask Lolly](/info/ask.html) responde una pregunta escrita con la sección correspondiente de estas guías.

Haz clic en una tarjeta para empezar algo nuevo con esa herramienta. El trabajo guardado se reabre desde **Projects**.

![Una tarjeta de galería con navegación de ejemplo y una acción Nueva](/t/url-shot?url=%2F%23%2F&width=1440&height=900&dpi=192&waitMs=1600&css=.welcome-dialog%2C.personalize-nudge%7Bdisplay%3Anone!important%7D&waitSelector=.gallery-view%5Bdata-shots-settled%5D&walker=1&format=svg&localize=1&dark=1&cropSelector=.gtile%5Bdata-tool-id%3D%22design%22%5D&filename=gallery&try=1)

Cada herramienta es una vista dividida: los **controles** a un lado y una **vista previa** en vivo al otro. Cambia un control y la vista previa lo sigue al instante, y lo que ves es lo que se exporta.

![La vista dividida de una herramienta - la pila de controles a la izquierda, y el gráfico de barras agrupadas en directo que dibuja a la derecha](/t/url-shot?url=%2F%23%2Ftool%2Fchart%3Fct%3Dbar%26t%3DExample%2520data%26st%3DSample%2520values%252C%2520not%2520a%2520real%2520dataset%26d%3DMonth%252CSeries%2520A%252CSeries%2520B%252CSeries%2520C%250AJan%252C12%252C9%252C5%250AFeb%252C18%252C14%252C7%250AMar%252C24%252C17%252C11%250AApr%252C29%252C23%252C15%26lg%3D1&width=1440&height=900&dpi=192&waitMs=2500&walker=1&format=svg&dark=1&filename=vt-tool-split-view)

**Design** es la excepción. Se abre como un lienzo libre de cuadros que arrastras, redimensionas y en los que escribes, con su propia barra superior, línea de tiempo y controles de deck. [Design: the free canvas](/info/design.html) es su guía.

## Cambia lo que la herramienta te deja cambiar

Una herramienta muestra solo las entradas pensadas para variar. Su autor ya fijó los colores, el diseño, la tipografía y la lógica, así que lo que crees respeta sus reglas. Las entradas incluyen texto, deslizadores, selectores de color, menús desplegables, fechas, selectores de imagen y grupos de filas repetibles, y algunas están en secciones plegables.

![La pila de controles de una herramienta - un campo de texto, selectores de color y un deslizador, y nada más de lo que quien la creó decidió dejar fijado](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools&width=1440&height=900&dpi=192&waitMs=2500&cropSelector=%23tool-inputs&walker=1&format=svg&dark=1&filename=use-tool-inputs)

**Haz clic en el diseño para encontrar su control.** Haz clic en cualquier elemento de la vista previa y el control correspondiente recibe el foco y se desplaza hasta quedar a la vista. En un grupo de filas repetibles, se despliega la fila exacta en la que hiciste clic.

**Clear changes**, sobre los controles, devuelve todas las entradas a su valor predeterminado.

**Opciones del design system.** Cuando tu design system ofrece más de una colourway, un aspecto claro y otro oscuro u otra opción de tema, una sección **Design system** bajo los controles las reúne. Una opción aparece solo cuando cambia esta herramienta, así que una utilidad de archivos no muestra ninguna sección. Cada colourway es un punto de sus propios colores, claro y oscuro son dos botones y cualquier otra opción es una lista.

La opción pertenece a esta pieza. Viaja en el enlace y en la sesión guardada, todos los colores vinculados al design system la siguen y los colores propios de la aplicación se mantienen. Design muestra las mismas opciones en la pestaña **Canvas** del Inspector. Una herramienta cuyos colores son su contenido puede quedarse en la colourway canónica, y entonces no ofrece puntos de colourway. [Lolly Demo in use](/info/lolly-demo-in-use.html#colourways-on-real-work) muestra colourways en trabajo real.

### Zoom y desplazamiento de la vista previa

La vista previa siempre muestra exactamente lo que se exportará.

- **Zoom:** Cmd/Ctrl y rueda, o pellizco en un trackpad, centrado en el puntero. Con el teclado, `0` o `Shift+1` ajusta todo, `1` o `Shift+0` pone el zoom al 100% y `Shift+2` ajusta la selección. `+` / `−` hacen zoom alrededor del puntero cuando está sobre el área de edición, o alrededor del centro en caso contrario.
- **Desplazar:** mantén **Space** y arrastra, o arrastra con el botón central del ratón. Los clics simples siguen libres para hacer clic en partes del diseño.
- **Táctil:** pellizca para hacer zoom, arrastra para desplazar y toca dos veces para ajustar.
- **HUD de zoom:** mantén pulsado el remolino de Lolly en la esquina para desplegar `−`, **Fit** y `+`. Un toque breve en el remolino sigue abriendo el menú de tu perfil.

En Design, **Fit all** incluye las mesas de arte y las capas sueltas. Puedes alejar el zoom manualmente por debajo del 20% hasta que toda la página ocupe la mitad de la vista. El límite inferior absoluto es el menor entre el 5% de la escala Fit normal y el 2% de zoom absoluto.

Un cambio en el tamaño de salida siempre devuelve la vista a un ajuste limpio.

![El HUD de zoom desplegado desde el remolino en la esquina del lienzo: menos, Fit, más, luego los interruptores de tema y sonido y el asa que lo mueve](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools&width=1440&height=900&dpi=192&waitMs=2500&css=.stage-nav%7Bopacity%3A1!important%7D&drive=drag%3A.stage-nav-profile%7Cdx%3D1%7Chold%3Bwait%3A700&cropSelector=.stage-nav&walker=1&format=svg&dark=1&filename=use-zoom-hud)

### Deshacer y rehacer

**Cmd/Ctrl-Z** retrocede y **Cmd/Ctrl-Shift-Z** (o **Cmd/Ctrl-Y**) avanza. El mismo par aparece como botones **Undo** y **Redo** sobre los controles (en Design están en la barra superior), y cada uno se atenúa cuando no queda nada que deshacer. Un mensaje indica qué entrada restauró cada deshacer, con un botón **Redo** en el mensaje.

- **Un arrastre es un paso.** Los cambios repetidos en un control en medio segundo se fusionan, así que mover un deslizador por todo su rango es un solo deshacer.
- **Se conservan los últimos 100 pasos.** Una edición nueva tras deshacer borra la pila de rehacer.
- **En un cuadro de texto**, Cmd/Ctrl-Z pertenece al campo, carácter a carácter. Lolly toma el control en deslizadores, menús desplegables, colores e interruptores.
- **Elegir un archivo** en una entrada de archivo no es un paso, porque esos bytes se conservan solo durante esta sesión.

En una [colaboración](/info/collaborate.html) en vivo tu historial sigue siendo tuyo: un cambio del otro dispositivo nunca entra en tu pila. Deshacer dura hasta que sales de la herramienta o recargas. Para algo más antiguo, las herramientas que guardan mientras trabajas conservan versiones anteriores en **History**; consulta [Go back to an earlier version](/info/find-your-work.html#go-back-to-an-earlier-version).

### Cámara en vivo

Los efectos de la herramienta **Filter** (Halftone, Scanline, Posterize, Voronoi, Duotone, Stretch, Misprint, Dither, ASCII art y Glitch) muestran un botón **Go live** donde hay una cámara disponible. Actívalo y el efecto sigue tu webcam fotograma a fotograma, y una exportación de movimiento graba el resultado como GIF, WebM o MP4. Los fotogramas se procesan en tu dispositivo, y la cámara se libera en el momento en que paras o sales de la herramienta. Cualquier selector de imagen también tiene **Take a photo** para un solo fotograma.

## Guardar y continuar

Para conservar tu trabajo, pulsa **Save**, la marca de verificación junto a **Export** en la píldora de renderizado. El trabajo nuevo va a **My library**, el trabajo que guardaste antes se actualiza donde está y no se descarga nada. El panel de exportación tiene el mismo botón **Save**.

Para elegir adónde va, pulsa **Save as**, junto a **Download** en el panel de exportación. En **Save to a project**, deja seleccionado **My library** o elige un proyecto (**＋ New project…** crea uno), y pulsa **Save**; **Save as a template** conserva el diseño como [plantilla](/info/templates.html), un punto de partida para documentos nuevos. En Design, **Save as** está en el menú de Lolly; en un teléfono, pulsa **•••**, luego **File menu** y luego **Save as**.

![La píldora de renderizado de dos mitades: Export, con una flecha hacia arriba que abre el panel de exportación, y Save, con una marca de verificación que guarda en el sitio](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools&width=1440&height=900&dpi=192&waitMs=2500&css=%23tool-inputs%7Bdisplay%3Anone%7D&cropSelector=.render-pill&walker=1&format=svg&dark=1&filename=use-render-pill)

::: timeline
- <!--i:check--> Pulsa **Save** en la píldora de renderizado, o **Save as** para elegir un proyecto.
- <!--i:folder--> El elemento va a **My library**, o al proyecto que elegiste.
- <!--i:home--> Más tarde, pulsa **Home** arriba a la izquierda y abre la pestaña **Projects**.
- <!--i:document--> Abre el elemento. Todos los ajustes están de vuelta, listos para cambiar y exportar de nuevo.
:::

Los elementos se nombran según el nombre de archivo que escribiste en el panel de exportación, o si no según su herramienta, como **QR Code**. Un archivo que obtienes con **Download** es una copia terminada; para cambiarlo más tarde, abre el elemento guardado en Projects.

Los guardados personales permanecen en este dispositivo, en el navegador o la aplicación desde la que guardaste, a menos que actives [Sync](/info/sync.html). Si algo no está donde esperas, [Find and recover your work](/info/find-your-work.html) cubre todos los casos, desde una pestaña cerrada hasta datos del navegador borrados.

::: details Proyectos de equipo con Lolly Work (opcional)
Si tu [organización usa Lolly Work](/info/organisation.html), inicia sesión en su instancia y abre **Projects → Team projects** para ver las sesiones compartidas contigo. La organización fija el acceso y la conservación, y su servicio Lolly Work almacena esas sesiones. Una sesión compartida se une a su collab en vivo al abrirse cuando tu organización permite la edición en vivo; [Working together](/info/collaborate.html#work-collabs-with-lolly-work-optional) explica los pasos.

Tu biblioteca personal sigue siendo aparte. Iniciar sesión en otro dispositivo te da el trabajo de equipo, mientras que los guardados personales siguen necesitando Sync o una copia de seguridad para pasar de un dispositivo a otro.
:::

## Compartir tu trabajo

Un diseño sale como enlace o como archivo. **Share** en los controles de exportación abre un cuadro de diálogo que ofrece ambos, y **Share link** en una sesión guardada de Projects abre el mismo diálogo para esa sesión.

::: cols
## Un enlace

- Lleva todas las entradas en la dirección, así que el enlace reproduce el diseño.
- Deja fuera las imágenes y archivos que añadiste desde este dispositivo, los textos muy largos y las listas muy grandes.
- Se abre en cualquier navegador, así que puedes guardar el enlace en marcadores, pegarlo o confirmarlo en un repositorio.

## Un archivo .lolly

- Lleva la sesión guardada con las imágenes y archivos de este dispositivo, y puede llevar también la herramienta y el design system.
- Retiene el arte con licencia del catálogo a menos que elijas incluir los archivos.
- Se abre en Lolly: haz doble clic, usa **Open** o suéltalo sobre la aplicación.
:::

### El enlace

El enlace listo para copiar está en la parte superior del diálogo, con **Copy** y un botón **QR** que abre la herramienta QR Code con el enlace. Bajo el enlace, **Link options** contiene:

- **Open in the installed app** cambia el enlace a una dirección `lolly://` para Atajos, lanzadores y automatización, con todos los parámetros sin cambios.
- **Shortest link** empaqueta un diseño largo en un token compacto y muestra el ahorro en caracteres. La forma legible también está siempre disponible.
- **Password-protect this link** cifra el enlace en tu dispositivo con AES-256. La contraseña nunca forma parte del enlace.
- **Pin this tool version** añade el indicador `_v`, para que una actualización posterior de la herramienta no pueda cambiar lo que renderiza el enlace.
- **When the recipient opens the link…** elige pantalla completa, el panel de exportación ya desplegado, una descarga al abrir (`&export`) o una copia en el portapapeles (`&copy`).
- **Copy credit** copia una leyenda "Made with Lolly" junto con el enlace, para una publicación o una diapositiva.

Cuando una herramienta contiene campos personales, como tu nombre, **Review personal fields** mantiene cada uno fuera del enlace hasta que marcas ese campo. [URL mode](/info/url-mode.html) cubre todo lo que puede llevar un enlace.

**El diálogo indica lo que un enlace no puede llevar.** Una imagen o archivo que añadiste desde este dispositivo, un valor de texto muy largo y una lista muy grande no caben en una dirección. Cada uno se cuenta al construir el enlace. Si hubo que descartar algo, el diálogo lo enumera y te señala la opción de archivo, en lugar de entregarte un enlace que se abre con una imagen que falta. Un enlace que solo es largo recibe una nota más suave con su número de caracteres.

**En algunas herramientas el enlace es todo el producto.** Jump Page reúne tus enlaces en una sola página para repartir: un enlace de biografía, una charla, un escaparate. No se aloja nada y no hay ninguna cuenta detrás de la página, porque la página es el enlace. Un visitante la ve a todo el ancho, con un enlace por escena al desplazarse.

![Jump Page en el editor: la escena del título en la parte superior de la página, con las escenas de enlaces debajo](/t/url-shot?url=%2F%23%2Ftool%2Fjump%3Ffull%26heading%3DFind%2520us%2520everywhere%26subheading%3DOne%2520link%2520for%2520everything.%26links%3DURL%252CName%252CEmoji%257Ehttps%25253A%25252F%25252Fexample.com%252CWebsite%252C%257Ehttps%25253A%25252F%25252Fexample.com%25252Fnews%252CNewsletter%252C%257Ehttps%25253A%25252F%25252Fexample.com%25252Fhello%252CSay%252520hello%252C&width=900&height=1300&dpi=96&waitMs=2000&cropSelector=%23tool-canvas&walker=1&format=svg&dark=1&filename=use-jump-page)

::: details Enlaces gestionados por la organización con Lolly Work
Para compartir con caducidad, revocación o contraseña, Lolly Work ofrece enlaces gestionados a sesiones compartidas, herramientas y recursos del catálogo. Se resuelven a través del servicio de la organización y siguen sus reglas de acceso. Son independientes de los enlaces autónomos de arriba, y revocar uno no puede recuperar un archivo que alguien ya descargó. [Rendering and sharing](/info/manage/sharing.html) enumera los tipos de enlace y los permisos.
:::

### El archivo .lolly

**Download .lolly**, en la sección **Editable file** del diálogo Share, escribe el diseño actual como un solo archivo. Lleva la sesión guardada con las imágenes y archivos de este dispositivo, y el arte ordinario del catálogo viaja también. Un archivo desactualizado o no disponible sigue como referencia externa en lugar de desaparecer. Antes de guardar, el diálogo muestra el tamaño del archivo, cuántos archivos incrusta, cuántos referencia y si se incluye la herramienta. Donde tu dispositivo tiene una hoja de compartir, **Send to…** le entrega el archivo directamente (AirDrop, compartir de Android).

**Download project (.lolly)**, en el menú de una carpeta en **Projects**, escribe una carpeta entera, para que otra persona pueda continuar con todas las sesiones de la carpeta. Las sesiones por lotes se quedan fuera, y el aviso indica cuántas. **Download originals**, en el mismo menú, escribe un zip simple con cada elemento como su propio archivo.

Tres cosas te corresponde decidir antes de que salga un archivo:

- **Si entra tu nombre.** Tu nombre, correo y organización se escriben solo cuando **Use my details to create** está activado en [tu perfil](/info/profile.html). Con él desactivado, el archivo registra solo que se creó con Lolly, y cuándo.
- **Si entra el arte retenido.** El arte con licencia, el arte bloqueado por marca y las obras del catálogo cuya licencia nunca se registró se quedan fuera por defecto. Si el diseño usa alguno, el diálogo indica cuántos y ofrece *Download without them* o *Include and download*, porque incluirlos entrega los archivos a quien abra el `.lolly`. El `CREDITS.txt` del archivo enumera lo que viajó y lo que no, con el motivo; [Creative rights and credits](/info/creative-rights.html) explica las reglas.
- **Si entra la herramienta.** **Include the tool** empaqueta los archivos propios de la herramienta, de modo que el diseño se abre en un dispositivo sin esa herramienta. Empieza marcado para una herramienta personalizada, como una bifurcación, y desmarcado para una herramienta que figura en el catálogo firmado. En una compilación sin catálogo firmado, toda herramienta cuenta como personalizada.

**Abrir uno.** En las aplicaciones de escritorio y móviles, haz doble clic o toca un `.lolly`, elige **Open with Lolly** o envíalo a Lolly desde la hoja de compartir. En la aplicación web, pulsa **Open** o suelta el archivo sobre Lolly. Todas las rutas leen primero el manifiesto del archivo y muestran su tamaño, su contenido y lo que ocurrirá, antes de escribir nada.

Si el archivo lleva una herramienta que no tienes, **Trust this tool?** muestra la herramienta y su autor, y indica que abrirla ejecuta en tu dispositivo el código propio de la herramienta. **Trust & install** continúa. Si lo rechazas, el trabajo igualmente se guarda en Projects, a la espera del día en que añadas la herramienta. Una herramienta cuyo código se distribuye como módulo todavía no se puede instalar así, y se rechaza del mismo modo.

::: details Qué contiene un .lolly y cómo funciona abrirlo
`.lolly` es la extensión de paquete de Lolly, y el `format` de su `manifest.json` indica qué hay dentro:

- Un **diseño compartido** (`lolly-share`) contiene una sesión guardada, sus archivos incrustados y un recibo de todo lo que aún se resuelve por referencia. También puede llevar la herramienta y el design system. Abrirlo añade un Project nuevo y nunca sobrescribe una sesión.
- Un **proyecto compartido** (`lolly-share`, tipo `project`) contiene una carpeta de Projects: sus subcarpetas, cada sesión que hay en ellas con su mosaico y las imágenes archivadas allí. Abrirlo añade una copia de toda la carpeta. Cada sesión viaja como `sessions/<key>.json` con su mosaico en `thumbs/`. Un Lolly anterior a los archivos de proyecto te pide actualizar.
- Un **paquete de design system** (`lolly-brand`) contiene tokens y puede contener fuentes, logotipos, versiones publicadas y recursos retenidos. Abrir el paquete añade un design system con nombre propio y lo hace activo.
- Un **paquete de espacio de trabajo o de instancia** es un `lolly-brand` con herramientas declaradas, recursos del catálogo y opcionalmente una dirección de instancia. Cargar uno sustituye la única superposición de espacio de trabajo cargada antes, y la vista previa enumera esos efectos para todo el dispositivo.

Una copia de seguridad completa del dispositivo no es un `.lolly`. Sigue siendo un `LollyTools-….zip` (formato `lolly-backup`) y se restaura mediante **Settings → Storage → Import data…**. Una carpeta de herramienta comprimida también sigue siendo un `.zip`. [Data transfer](/info/data-transfer.html) es la referencia del formato.

Un `.lolly` es un zip normal. Renómbralo a `.zip` para mirar dentro: tus propias imágenes están en `assets/uploads/`, el arte del catálogo en `assets/catalog/`, `manifest.json` enumera cada archivo y un README explica qué es el archivo.

macOS, Windows, Linux, iOS y Android registran todos el formato, los gestores de archivos de escritorio lo muestran como un documento de Lolly y GNOME Files puede mostrar la miniatura propia de una sesión guardada. Abrir desde Design System Setup recomienda la acción de design system cuando un diseño compartido lleva uno, pero nunca oculta **Open shared design**.

Un documento entregado desde otra aplicación en iOS o Android está limitado a 48 MB, porque la entrega copia sus bytes a través del límite de la aplicación, y la aplicación lo indica. **Open** dentro de Lolly no tiene ese límite, así que úsalo para un paquete más grande.

Tras confirmar, Lolly descomprime y verifica el paquete una vez. Los recursos van a tu biblioteca, emparejados por suma de verificación para que se reutilice un archivo que ya esté en el dispositivo. Las sesiones van a Projects con ID nuevos, así que el mismo archivo se puede abrir dos veces; una sesión cuya herramienta falta espera allí. Los archivos de más de 100 MB se señalan como grandes, y la vista previa avisa cuando el almacenamiento del navegador informa de menos espacio libre del que necesita el archivo. Cada parte cubierta por integridad se comprueba antes de confirmar nada, y una copia dañada se rechaza sin dejar nada atrás.
:::

Un enlace y un archivo entregan una instantánea. Para la edición en vivo, [Working together](/info/collaborate.html) cubre las collabs privadas entre dos dispositivos y las collabs de trabajo opcionales a través de Lolly Work.

## Recursos - tu biblioteca

**Assets** (`#/a`) reúne todo lo que pueden usar tus herramientas: logotipos de marca, imágenes, audio y movimiento, agrupados por tipo, junto con tus propios archivos. Tus subidas se almacenan en tu dispositivo. Una organización que use Lolly Work también puede aportar un catálogo compartido bajo sus propias reglas de acceso; consulta [Use Lolly at your organisation](/info/organisation.html).

![Recursos, con las muestras y las tipografías de la marca, y tus propias subidas](/t/url-shot?url=%2F%23%2Fa%3Fsection%3Dswatches%2Cfonts&width=1440&height=900&dpi=96&waitMs=2400&css=.plat-swatch-grid~%2A%7Bdisplay%3Anone%7D&walker=1&format=svg&localize=1&dark=1&filename=assets)

- <!--i:upload--> **Trae tus archivos.** Suelta una imagen, SVG, clip de audio, vídeo, Lottie, PDF o deck de PowerPoint en el área de subida, o haz clic para elegir. Llega a Assets al instante y al selector de recursos de cada herramienta. Un PDF de varias páginas o un `.pptx` pregunta qué páginas o diapositivas conservar, y cada una se convierte en un recurso SVG. Una imagen que añades dentro de una herramienta se conserva tal como llegó en **My images**, de modo que una Content Credential en ella sigue verificándose, y solo un archivo muy grande pregunta si redimensionar. **Settings → Storage** muestra cuánto contiene **My images**. No hay límite más allá del almacenamiento de tu dispositivo. Para borrar los datos EXIF y GPS al entrar las imágenes, activa **Strip metadata from uploads** en **Settings → Feature flags**; las Content Credentials se conservan en ambos casos.
- <!--i:star--> **Marca como favorito lo que más usas.** Marca con estrella un recurso o una muestra de marca y se fija arriba en cada selector.
- <!--i:folder--> **Ordena.** Mueve un recurso a otro grupo, oculta un recurso de marca compartido que no uses (**Show hidden** lo recupera) o elimina tus propias subidas. La misma barra de selección que en Projects actúa sobre toda una selección.
- <!--i:layers--> **Separa un vídeo de su fondo.** Abre los detalles de un vídeo, o haz clic derecho en su tarjeta en un selector de recursos, y elige **Remove background…**. Un **On-device model** recorta un sujeto de una escena cargada; un **Colour key** elimina un fondo iluminado de forma uniforme, como una pantalla verde, con **Tolerance**, **Softness** y **Spill removal** para el borde, y no necesita descarga. **Resolution** (360, 480, 720 o 1080p, nunca por encima del original) cambia detalle por velocidad. El recorte, un WebP animado o PNG con transparencia real, se guarda junto al original, y la Content Credential del origen viaja como ingrediente. [Generated once, rendered the same](/info/ai-features.html) explica por qué esto sigue siendo una edición simple.

### Lleva tu paleta y tus tipografías a cualquier parte

El panel **Swatches** de Assets muestra los colores de los que se compone tu marca: sus colores de marca, los que añadiste, sus rampas y su espectro. Los colores de rol que Lolly reserva para la interfaz (texto, superficies, bordes, colores principales de colourway y copias de un color de marca bajo otro nombre) esperan tras una tarjeta gris **Show colour roles** al pie del panel.

Cada color es una tarjeta como cualquier otro recurso. Haz clic en uno para abrir sus detalles, selecciona varios para descargar solo esos o descarga toda la paleta en el formato que lee tu otra herramienta:

- <!--i:code--> **Design tokens (JSON)**, **CSS variables** o **CSS classes**, para una hoja de estilos o una compilación. Un color más amplio que sRGB conserva su valor amplio: el CSS lo define tras el hex, y el JSON conserva el hex junto con el color amplio, la composición CMYK y la tinta plana.
- <!--i:palette--> **Adobe Swatch Exchange (.ase)**, para Illustrator o Photoshop. Un color bloqueado a una composición CMYK llega como esa muestra CMYK, una tinta plana como muestra plana con nombre y un color más amplio que sRGB como Lab.
- <!--i:pentool--> **GIMP palette (.gpl)**, para GIMP o Inkscape, y **SCSS variables**, ambos en sRGB.

![El panel Swatches: los cinco botones de descarga de paleta arriba, y luego cada color de marca como una muestra que abre sus detalles](/t/url-shot?url=%2F%23%2Fa%3Fsection%3Dswatches&width=1440&height=900&dpi=96&waitMs=1800&css=.cat-group%3Anot%28%5Bdata-group%3Dswatches%5D%29%7Bdisplay%3Anone%7D&cropSelector=%5Bdata-group%3Dswatches%5D&walker=1&format=svg&dark=1&filename=use-swatch-downloads)

Selecciona colores con el punto de cada tarjeta: Shift y clic en un segundo punto para todo lo que hay entre ambos, arrastra un recuadro por los huecos o pulsa Cmd/Ctrl+A con una tarjeta enfocada. La barra ofrece **Download as…** en los mismos seis formatos, **Copy hex** y **Favourite**. Antes de elegir un formato, el menú enumera cualquier color que ningún formato puede contener (Transparent no tiene color en absoluto), qué formatos guardan un color amplio como su alternativa sRGB (SCSS y GIMP) y cuáles llevan los valores CMYK y de tinta plana (JSON y .ase). Haz clic derecho en una tarjeta para las mismas acciones sobre un solo color.

Los detalles de un color llenan la vista previa con el color y despliegan **Linked values** (su composición CMYK o tinta plana, cualquier valor definido para un espacio o una prensa concretos y su design token), **Every notation** (hex, OKLCH, Display-P3 y el resto, cada una con un botón de copiar), **Plotted on a colour space**, **Tones** y **Readability**. Las teclas de flecha recorren la paleta, **Copy link** comparte el propio color y **Open in Colour Lab** lo lleva más lejos.

El panel **Fonts** enumera las fuentes de tu marca con una **descarga** para cada una, para instalarla en local o entregarla a una imprenta.

## Haz la cuadrícula tuya

- <!--i:star--> **Marca como favorito lo que usas.** Haz clic derecho en una tarjeta y elige **Add to favourites**, y obtiene un mosaico grande en una franja sobre la cuadrícula. [Your favourites](/info/favourites.html) cubre la franja.
- <!--i:eyeoff--> **Oculta una herramienta que nunca usas.** Haz clic derecho en una tarjeta, o selecciona varias, y elige **Hide tool**. Sale de la cuadrícula y de lo que encuentra escribir en la cuadrícula. Un mosaico gris **Show hidden tools (N)** al final las muestra de nuevo, atenuadas, cada una con **Unhide tool** en su menú. Ocultar solo cambia tu cuadrícula: la herramienta sigue abriéndose desde un enlace o un marcador.
- <!--i:clock--> **Tus herramientas, primero.** Cuando tengas trabajo guardado en tres herramientas distintas, una fila **Yours** de chips sobre la cuadrícula encabeza con tus favoritas y tus herramientas recientes.
- <!--i:sliders--> **Dispónla a tu manera.** **View options** define la disposición (**Grid**, **Card** o **List**), el tamaño y la densidad de las tarjetas, el orden y un filtro por categoría.

![El final de la cuadrícula de Tools con las herramientas ocultas reveladas: la tarjeta Wordmark atenuada, y junto a ella el mosaico gris que la devolvió a la vista, que ahora dice Hide hidden tools](/t/url-shot?url=%2F%23%2F&width=1440&height=680&dpi=192&waitMs=1600&css=.welcome-dialog%2C.personalize-nudge%7Bdisplay%3Anone!important%7D&drive=click%3A.gtile--hiddenbox%3Bpress%3AEnd%3Bwait%3A800%3Bhover%3A.gtile--hiddenbox%3Bwait%3A300&waitSelector=.gallery-view%5Bdata-shots-settled%5D&walker=1&format=svg&rasterDpi=96&dark=1&filename=misc-hidden-tools)
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

**Actúa sobre varias tarjetas a la vez.** Marca la casilla de cada tarjeta, arrastra un recuadro de selección por el espacio vacío o haz clic con Shift/Cmd, y aparece una barra con lo que permite esa vista:

- **Tools y Utilities:** Favourite, Hide, Available offline, **View sessions** (Projects, mostrando solo las sesiones creadas con esas herramientas) y Copy link para una sola tarjeta.
- **Assets:** Favourite y Hide para cualquier selección. Duplicate, Download y Delete aparecen solo cuando todos los elementos seleccionados son subidas tuyas, porque un recurso compartido del design system es un contrato permanente.
- **Projects:** consulta [Find and recover your work](/info/find-your-work.html#find-something-you-saved).

![La barra de selección de la galería para dos herramientas, con Disponible sin conexión, Ver sesiones, Favorito y Ocultar](/t/url-shot?url=%2F%23%2F&width=1440&height=900&dpi=192&waitMs=1600&css=.welcome-dialog%2C.personalize-nudge%7Bdisplay%3Anone%21important%7D&drive=click%3A%5Bdata-select%3D%22qr-code%22%5D%3Bclick%3A%5Bdata-select%3D%22gradient%22%5D&waitSelector=.gallery-view%5Bdata-shots-settled%5D&walker=1&format=svg&dark=1&filename=misc-bulkbar-gallery&cropSelector=.gallery-bulkbar)
<!--
SHOT NOTE (misc-bulkbar-gallery): drive targets `[data-select="qr-code"]` /
`[data-select="gradient"]` - the `.tile-check[data-select="<ref>"]` checkbox button
confirmed directly in views/gallery.ts's card markup (the same attribute
cardMarkup gives every tile), so these two clicks tick both cards without
opening either tool.

SHOT NOTE (misc-sessions-by-tool, NOT PUBLISHED): the "View sessions" result
had a recipe of its own (`/#/p?tools=qr-code,d3`, views/projects.ts's
toolsBodyHtml()), dropped here because it has no `drive=` that can
manufacture its own content - a saved session isn't a click away, it has to
already exist, and build-docs-shots.ts gives every shot a fresh
`browser.newContext()`. It would publish an empty list. Same dependency the
`projects` shot (now on find-your-work.md) carries; revisit if the pipeline gains a
storage-seeding hook.
-->

**View sessions** aparece solo cuando hay algo seleccionado. Haz clic derecho en una sola tarjeta no seleccionada y ofrece **N saved sessions**, una lista de las sesiones guardadas de esa herramienta donde eliminar una la mueve a la Papelera.

## En un teléfono

En una pantalla estrecha la disposición pasa a una sola columna:

- Los **controles pasan a ser una hoja** en la parte superior con un asa de arrastre en su borde inferior. Arrastra el asa para ajustarla a **peek**, **half** o **full**, o tócala para plegar y desplegar. La vista previa ocupa el espacio de debajo y permanece a la vista mientras editas.
- Un botón flotante **Export** abre la hoja de exportación: formato, tamaño, copiar, guardar y descargar en un solo lugar. Toca el fondo para cerrar la hoja.

![Una herramienta en una pantalla de ancho de teléfono - los controles como una hoja arriba, la paleta generada llenando la vista previa abajo y la píldora de renderizado flotando en el centro inferior](/t/url-shot?url=%2F%23%2Ftool%2Fcolor-palette%3Fseed%3Df97316%26harmony%3Dadjacent-3%26steps%3D9&width=430&height=900&dpi=192&waitMs=2200&walker=1&format=svg&dark=1&filename=vt-phone-palette)

## Ajustes, sonido y comodidad

**Settings**, al pie de la pantalla de inicio, contiene tus datos, tus design systems, accesibilidad, almacenamiento y descargas sin conexión. [Settings](/info/dashboard.html) recorre cada pestaña.

- **Tus datos y tu foto** rellenan cualquier herramienta creada para usarlos, como una firma de correo o una credencial. [Profiles](/info/profile.html) los cubre.
- **Accessibility** tiene cuatro interruptores de comodidad: **Reduce motion**, **Hide colourful previews**, **High contrast** y **Large text**. Cambian la aplicación que rodea tu trabajo, nunca el lienzo de una herramienta ni una exportación.
- **Sound** reproduce sonidos de apoyo suaves para lo que haces, y **Neurospicy Mode** reproduce una pista tranquila para concentrarte. Ambos están desactivados hasta que los activas, en **Settings → Accessibility** o en el menú del perfil.
- **Available offline** descarga el resto de la aplicación, tus herramientas, el catálogo y las guías antes de que pierdas la conexión. Lolly es una aplicación web que puedes instalar: usa el botón de instalar de tu navegador, o *Add to Home Screen* en un teléfono, para una aplicación a pantalla completa que se actualiza sola cuando vuelves a tener conexión.
- **Storage** muestra lo que Lolly guarda en este dispositivo. [If you clear your browser data](/info/find-your-work.html#if-you-clear-your-browser-data) explica qué elimina el borrado, y la [Privacy Policy](/info/privacy.html) enumera todo lo que la aplicación descarga o envía.

::: note Si una vista no carga tras una actualización
Un panel en blanco o un mensaje "failed to fetch" justo después de una actualización suele resolverse con una recarga. Tu trabajo guardado, tus sesiones y tus design systems quedan intactos, porque se almacenan en tu dispositivo. Solo una imagen que añadiste y nunca guardaste puede tener que añadirse de nuevo.
:::

## A dónde ir ahora

- **[Design: the free canvas](/info/design.html)**: el lienzo, las formas, la línea de tiempo y la presentación de un deck.
- **[Batch and Multi-edit](/info/batch.html)**: muchas versiones de un diseño, o varios diseños guardados editados juntos.
- **[Export a file](/info/exporting.html)**: elegir un formato, tamaño, unidades de impresión, transparencia y vídeo.
- **[Import a design](/info/design-import.html)**: lleva un archivo de Figma, Penpot, Illustrator o InDesign a Design y sigue editando.
- **[Templates](/info/templates.html)**: puntos de partida guardados para una herramienta.
- **[Wide Colour and HDR](/info/hdr-editing.html)**: conserva la precisión original de la imagen en Design y Darkroom.
- **[Find and recover your work](/info/find-your-work.html)**: dónde está todo, y cómo pasarlo a otro dispositivo.
