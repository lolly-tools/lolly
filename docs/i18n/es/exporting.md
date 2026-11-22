# Exportar un archivo

Pulsa **Export**, la mitad izquierda de la píldora **Export | Save**, elige un formato junto al nombre del archivo y pulsa **Download**. El archivo se crea en tu dispositivo.

El archivo contiene lo que ves en el lienzo. El menú de formatos enumera solo lo que esta herramienta puede crear en este navegador.

La mayoría de los trabajos necesitan uno de tres formatos:

| Para | Elige | Porque |
|---|---|---|
| Una pantalla, un mensaje o una diapositiva | **PNG** | Todas las aplicaciones lo abren, y conserva el fondo transparente cuando la herramienta lo ofrece |
| Una página terminada o cualquier cosa impresa | **PDF** | Un tamaño de página real que se imprime tal como se ve; **Print PDF**, cuando una herramienta lo ofrece, es la versión CMYK para imprenta |
| Obras que deben mantenerse nítidas a cualquier tamaño | **SVG** | Formas vectoriales |

::: check Comprueba el archivo al tamaño en que se usará
Antes de enviar el archivo, ábrelo en la pantalla para la que se creó o imprímelo a su tamaño real.
:::

::: details Aprobaciones y entrega con Lolly Work (opcional)
Una [organización que opera Lolly Work](/info/organisation.html) puede elegir qué formatos y ajustes de exportación ven sus miembros. Cuando se exige aprobación, **Request approval** sustituye a **Download**. Sigue la política que muestre tu instancia.

Lolly Work también puede entregar un archivo a destinos S3, WebDAV y HTTP configurados, con pasos de aprobación, comprobantes de entrega y un registro de auditoría. Esa entrega envía el archivo al servicio de la organización. Una descarga normal se queda en tu dispositivo. Los destinos personales de Send y la entrega de la organización se configuran por separado.

Los operadores lo configuran con la [guía de entrega de la organización](/info/work-delivery.html). Para renderizados y lotes de servidor en cola, consulta [Lotes y automatización con la CLI](/info/cli-automation.html#organisation-jobs-with-lolly-work).
:::

<!--i:eti-cpu-->
## Cómo funciona la exportación

Tres caminos producen un archivo. La mayoría de las herramientas **renderizan el lienzo**. Los formatos de texto y datos (HTML, Markdown, TXT, JSON, CSV, ICS, VCF) se **generan a partir del contenido de la herramienta**. Las utilidades de privacidad como *Lolly Strip Hidden Data* **transforman el archivo que elegiste** en tu dispositivo. El resultado no tiene lienzo, marca de agua ni metadatos añadidos.

![Tres caminos de exportación convergen en un archivo terminado: renderizar el lienzo, generar texto o datos a partir del contenido o transformar un archivo elegido en el dispositivo.](/info/diagrams/concepts/three-export-paths.svg)

El autor de una herramienta elige qué acciones ofrece el panel de exportación. El conjunto predeterminado es Copy, Download y Save.

- <!--i:download--> **Download** guarda el archivo. Si luego no lo encuentras, consulta [Encontrar un archivo que descargaste](/info/find-your-work.html#find-a-file-you-downloaded).
- <!--i:photos--> **Copy** pone la imagen en el portapapeles. Cuando un navegador no puede copiar imágenes, Copy descarga el archivo y te lo indica.
- <!--i:folder--> **Save** conserva el diseño actual en Projects y nunca descarga un archivo. **Save as**, junto a **Download**, pregunta dónde (consulta [Guardar y continuar](/info/using.html#saving-continuing)).
- <!--i:link--> **Share** abre el diálogo Share: un enlace que reproduce el diseño, los interruptores de visita (pantalla completa, panel de exportación, descargar o copiar al abrir) y un **Shortest link** opcional que empaqueta el estado en un token compacto (consulta [Modo URL](/info/url-mode.html)).

**Send to**, una tarjeta del panel de exportación, envía el archivo a un servicio que hayas conectado. Tras enviarlo a Google Drive, Nextcloud, un bucket S3, Dropbox o OneDrive, **Create a share link** puede crear allí un enlace sin volver a subirlo. La sección **Share through your cloud** del diálogo Share envía un archivo `.lolly` y crea su enlace en un solo paso. El panel del enlace muestra quién puede abrirlo, dónde está el archivo y cuándo caduca el enlace. **Links you've shared**, en el diálogo Share, te permite dejar de compartirlo. Los enlaces de Nextcloud pueden tener una contraseña y una fecha de caducidad. Los enlaces de S3 duran de 1 a 7 días y no pueden cancelarse antes. Lolly no guarda ninguna copia del archivo ni ningún token de inicio de sesión en un servidor. [Privacidad](/info/privacy.html#every-network-request-the-app-can-make) enumera qué recibe cada servicio.

![El panel de exportación: formato, tamaño y las acciones Copy / Download / Save / Share](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26options&width=1440&height=900&dpi=192&waitMs=2000&format=svg&walker=1&dark=1&filename=export-panel)

Cuando un diseño incrusta el renderizado de otra herramienta, como un cuadro de imagen de Lolly Design que contiene un enlace de QR Code, la exportación del padre dibuja el renderizado anidado. Se mantiene vectorial en SVG y PDF y se rasteriza en PNG, JPG y WebP. El renderizado incrustado no recibe marca de agua ni procedencia propia; solo el archivo terminado. Las exportaciones HTML, Markdown y TXT no pueden contener un renderizado compuesto.

<!--i:eti-file-->
## Elige un formato

El nombre del archivo y el menú de formato están juntos como un único par `name.format`, debajo de **Download**.

![El campo de nombre de archivo unido al selector de formato, de modo que la exportación se lee como un único par name.format](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26options&width=1440&height=900&dpi=192&waitMs=2000&format=svg&cropSelector=.filename-extension&walker=1&dark=1&filename=exp-format-picker)

Empieza por el destino del archivo. Cada tarjeta enumera los formatos adecuados para ese destino.

::: figure exporting-format-chooser
Seis destinos y los formatos adecuados para cada uno.
:::

Un logotipo tipográfico compuesto con la tipografía de tu design system se exporta como SVG con cada letra como trazado contorneado. El archivo se mantiene nítido a cualquier tamaño.

El texto en otro idioma depende de las fuentes que tengas. Cuando una fuente de tu design system tiene las letras, SVG y PDF las dibujan como contornos, con su forma y en orden de lectura, incluidas las líneas de derecha a izquierda. Cuando ninguna las tiene, Lolly usa una [fuente de respaldo](/info/fallback-fonts.html), y la tarjeta de exportación muestra esa fuente. El texto que ninguna fuente de respaldo cubre se mantiene como texto vivo en un SVG, dibujado por las fuentes del propio visor. En un PDF, EPS o WMF, y en un EMF con **Outline fonts** activado, ese texto se convierte en imágenes. Esas palabras se ven como en la página, pero no se pueden seleccionar ni buscar. La tarjeta de exportación enumera esas escrituras. Añade una fuente con esas letras para conservarlas como texto vectorial.

![Un logotipo tipográfico de trazo finísimo y mucho espaciado que dice Aurora, el tipo de ilustración vectorial pura al que se refiere la fila SVG de la tabla](/t/url-shot?url=%2F%23%2Ftool%2Fwordmark%3Ftext%3DAurora%26weight%3D200%26tracking%3D16%26size%3D200%26full&width=1440&height=900&dpi=192&waitMs=2200&cropSelector=%23tool-canvas&walker=1&format=svg&filename=vt-wordmark-vector)

::: details Todos los formatos y para qué sirve cada uno
| Quieres | Usa | Por qué |
|---|---|---|
| Logotipos nítidos o ilustraciones que escalan | **SVG** | Vectorial: escalable, pequeño y editable; un efecto que la exportación vectorial no puede dibujar se incrusta como imagen |
| Vector para Office y aplicaciones de Windows | **EMF** | Se pega como vector editable en PowerPoint y Word, con texto vivo; Google Drive lo abre en Google Drawings |
| Vector para impresión y aplicaciones de diseño | **EPS**, o **EPS (CMYK)** | Vector PostScript para Illustrator y flujos de imprenta |
| Vector para máquinas de corte | **DXF** | Cortadoras láser, plóteres de vinilo y CNC: trazados de contorno en milímetros |
| Un deck de diapositivas editable | **PowerPoint** (PPTX) | Texto y formas nativos editables, con imágenes y vectores que se pueden extraer |
| Un documento de texto editable | **Word** (DOCX) u **OpenDocument** (ODT) | Párrafos y encabezados que un procesador de texto puede seguir editando (Lolly Doc Studio) |
| Una maqueta para InDesign | **InDesign IDML (static subset)** | Texto, rectángulos, óvalos e imágenes, un pliego por mesa de arte (Lolly Design) |
| Un documento de Penpot editable | **Penpot** | Tableros, formas, texto y tokens enlazados |
| Una foto o imagen de uso general | **PNG** (sin pérdida) o **JPG** (más pequeño) | Trama universal |
| Imágenes modernas más pequeñas | **WebP** o **AVIF** | Mejor compresión, con transparencia |
| Impresión | **PDF**, o **Print PDF** (CMYK) | Tamaño de página real; CMYK para imprenta |
| Trama de impresión para imprenta | **Print TIFF** (CMYK) | Píxeles DeviceCMYK para un RIP |
| Animación para la web | **GIF** | Se reproduce en todas partes; archivos más grandes |
| Animación con color completo y transparencia real | **APNG** | PNG animado: sin límite de paleta |
| Animación con el archivo más pequeño | **Animated WebP** | Color completo y transparencia, más pequeño que GIF o APNG |
| Vector animado que escala | **Animated SVG** | Autónomo; se reproduce en bucle en un navegador o un `<img>`, a cualquier tamaño (Lottie Ad) |
| Una animación que siga siendo editable | **dotLottie** | Formas, trazados y fotogramas clave de transformación externa de la línea de tiempo de Lolly Design |
| Una entrega para Premiere | **Premiere XML + media** | Clips temporizados y medios originales para Premiere (Lolly Design) |
| Vídeo para redes sociales y para compartir | **MP4** o **WebM** | La mejor calidad para el tamaño de archivo (consulta [Vídeo](#video)) |
| Subtítulos | **SRT** o **VTT** | Texto temporizado para un reproductor de vídeo (Captions, Audiogram y Record) |
| Subtítulos para emisión | **TTML** o **SCC** | Texto temporizado IMSC1.1 o subtítulos emergentes CEA-608 (Captions; consulta [Subtítulos para emisión](#broadcast-captions)) |
| Un curso de formación | **SCORM (LMS)** | Un sitio web o paquete SCORM o xAPI con versiones (consulta [SCORM](#scorm-course-packages)) |
| Texto enriquecido o una firma de correo | **HTML** | Se pega con formato en clientes de correo |
| Una animación que se reproduce en un navegador | **HTML** | Un reproductor en un solo archivo, desde la línea de tiempo de Lolly Design o Snippet (consulta [Vídeo](#video)) |
| Contenido sin formato | **MD** o **TXT** | Solo texto |
| Un evento de calendario | **ICS** | Se importa en cualquier aplicación de calendario |
| Una tarjeta de contacto | **VCF** | Se importa en libretas de direcciones |
| Datos estructurados para volver a importar | **JSON** o **CSV** | Permite exportar y volver a importar el contenido de la herramienta |
| Un favicon | **ICO** | Icono de sitio de varios tamaños; **ZIP** agrupa varios formatos |
:::

### Transparencia

Las herramientas que lo admiten ofrecen un interruptor de fondo transparente, como **No BG**. PNG, WebP, AVIF, SVG, APNG y Animated WebP conservan la transparencia, y GIF conserva un borde duro. JPG y PDF son siempre opacos. TIFF se acopla sobre blanco, o sobre negro en la ruta [HDR](#hdr-bright-colours).

<!--i:eti-crop-->
## Tamaño y unidades de impresión

Las exportaciones usan el tamaño nativo en píxeles de la herramienta, salvo que esta ofrezca **dimensiones**. En ese caso, fijas el ancho, el alto y una **unidad**:

- **px** (la opción predeterminada) son píxeles exactos.
- **mm, cm, in, pt** y **pc** son tamaños físicos. Con una unidad física también fijas los **DPI** (300 de forma predeterminada). Un **PDF** se convierte en una página real de ese tamaño. Una **imagen de trama** tiene el número de píxeles correspondiente a esos DPI y registra la resolución. Un **SVG** conserva la unidad física con un viewBox en píxeles.

Para una imagen de trama de mayor resolución, introduce un ancho y un alto mayores, o elige una unidad física y aumenta los DPI (píxeles = tamaño × DPI). Un ancho de `210`, un alto de `297` y la unidad `mm` crean una página A4.

![La fila de dimensiones configurada en 210 por 297 mm, con el campo DPI visible porque la unidad es física](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26w%3D210%26h%3D297%26unit%3Dmm%26format%3Dpdf%26options&width=1440&height=900&dpi=192&waitMs=2000&format=svg&cropSelector=.export-dims&walker=1&dark=1&filename=exp-export-dims)

<!--i:eti-images-->
## Imágenes fijas de una composición temporizada

En una composición temporizada, como una línea de tiempo de [Sequence](/info/sequence-editor.html) en Lolly Design, una exportación de imagen fija toma **el fotograma en el cabezal de reproducción**. Coloca el cabezal de reproducción donde quieras la imagen y exporta.

Para más de un momento, usa el campo **Frames** junto al tamaño de salida. Solo aparece para una composición temporizada y un formato de imagen fija (PNG, JPG, WebP, SVG o PDF). `1` da el fotograma del cabezal de reproducción. Un número mayor da esa cantidad de imágenes fijas, distribuidas uniformemente por la secuencia:

- PNG, JPG, WebP y SVG se entregan en un solo ZIP: `<name>-01.png`, `-02.png` y así sucesivamente.
- PDF se entrega como un solo documento con esa cantidad de páginas.

Cada imagen fija procede del centro de su segmento de la línea de tiempo, así que la primera nunca es una entrada a medio fundir y la última nunca es el momento vacío después de que terminen los clips.

::: figure exporting-contact-sheet
Frames: 4 divide la secuencia en cuatro segmentos iguales y toma el centro de cada uno.
:::

Usa Frames para un guion gráfico, una hoja de contactos de revisión o un carrusel para redes sociales extraído de un montaje de vídeo. El máximo es 64. Cualquier otro valor introducido en el campo se restablece a `1`. Cada fotograma es una imagen fija normal, así que las credenciales, el Imprint, las unidades físicas y los DPI se comportan como en una sola exportación. Un enlace de exportación, la CLI y MCP solicitan la misma hoja con `cuts=` (consulta [Hojas de contactos](/info/url-export.html#contact-sheets)).

<!--i:eti-copy-->
## Muchos archivos a la vez

Lolly tiene tres formas de trabajar a gran escala:

::: cols
## Una tabla se convierte en un documento
Una herramienta diseñada para paginar una tabla de entrada convierte cada fila en una página. Pega una tabla de tu hoja de cálculo para obtener un solo PDF. Para corregir filas, edita la hoja de cálculo y vuelve a pegarla. Battlecards es la herramienta de referencia. Está en la carpeta de código abierto `community` y no figura en lolly.tools.
## Un CSV se convierte en un archivo por fila
**Batch** (`#/batch`) toma un CSV y renderiza una exportación por cada fila, como acreditaciones o certificados, que se entregan en un ZIP. Consulta [Lolly Batch](/info/batch.html#make-many-versions-of-one-design).
## Varios diseños reciben una edición
**Lolly Multi-edit** abre varias sesiones guardadas una al lado de la otra para hacer el mismo cambio en cada una. Consulta [Lolly Multi-edit](/info/batch.html#edit-several-saved-designs-together).
:::

Una herramienta con varias páginas, como Booklet, Print Sheet, Lolly Doc Studio o Lolly Markdown Slides, exporta PNG, JPG, WebP, SVG y los demás formatos de una sola imagen como un archivo por página, en un ZIP cuando hay varias. Print Sheet conserva la hoja completa y las marcas de corte con los DPI elegidos.

Desde **Projects**, **Render folder** exporta todas las sesiones guardadas de una carpeta y sus subcarpetas en un solo ZIP con esa estructura. **Render selection** hace lo mismo con una selección múltiple. Cada sesión guardada se renderiza en su propio archivo. Projects también puede volver a compartir una sesión guardada como enlace de herramienta que reabre la sesión con los mismos ajustes.

<!--i:eti-pen-->
## Archivos que siguen siendo editables en otras aplicaciones

Algunos formatos entregan tu trabajo a otra aplicación como contenido editable en lugar de una imagen.

### PowerPoint (PPTX)

Lolly Design, Lolly Markdown Slides, Booklet, Lolly Doc Studio, Lolly Chart, Diagrams, Flow Chart y Agenda exportan un deck de PowerPoint, con una diapositiva por página. Cada página se divide en objetos nativos que un colega puede editar y extraer:

- <!--i:font--> El **texto** se convierte en cuadros de texto editables de PowerPoint con el tamaño de fuente, color, peso, cursiva y alineación del diseño. Un deck de Lolly Design fija la tipografía de la marca en cada tramo de texto, incluso sin un patrón de diapositivas.
- <!--i:pentool--> Los **vectores**, como logotipos e iconos, se incrustan como imágenes SVG, y PowerPoint puede aplicarles *Convert to Shape*.
- <!--i:photos--> Las **imágenes** se transfieren como imágenes separadas a su resolución nativa. Una imagen principal recortada conserva la imagen completa detrás del recorte. Cualquier filtro o mezcla de una imagen queda integrado en ella.
- <!--i:layers--> Los **fondos, bordes y líneas** se convierten en formas de rectángulo y línea. Los círculos, elipses y píldoras de Lolly Design se mantienen como formas nativas editables.

![El panel de exportación con PowerPoint seleccionado: una diapositiva por página, con texto y formas que se mantienen editables](/t/url-shot?url=%2F%23%2Ftool%2Fdeck-studio%3Foptions&width=1440&height=900&dpi=192&waitMs=2500&drive=click%3A%5Bdata-fmt-trigger%5D%3Bwait%3A400%3Bclick%3A%5Bdata-fmt%3D%22pptx%22%5D%3Bwait%3A800&cropSelector=.export-popup&walker=1&format=svg&dark=1&filename=exp-pptx)

La composición es aproximada. Todo lo que el walker no puede expresar de forma nativa, como una región compleja con filtros o máscaras, se incrusta como imagen. Un deck tiene un único tamaño de diapositiva, tomado de la primera página.

PowerPoint también es una vía de entrada: [Adaptar un deck a tu marca](/info/rebrand.html) traslada un deck a tu design system, e [Importar un diseño](/info/design-import.html) abre uno en Lolly Design.

### Penpot

La mayoría de las herramientas que exportan SVG también exportan un **archivo de Penpot** (`.penpot`).

| Lo que creaste | En Penpot |
|---|---|
| Texto | Objetos de texto editables |
| Formas, trazados, degradados e imágenes | Formas vectoriales editables |
| Un color o una fuente de un token del design system | Un enlace activo al token: edita el token y todas las formas que lo heredan reflejan el cambio |
| El diseño completo | Un componente reutilizable en el panel Assets |
| Una ilustración compleja o un lienzo en vivo | Una imagen incrustada; el contenido que la rodea sigue siendo editable |

Desde Lolly Design, cada marco se convierte en un tablero de Penpot. Los colores y las tipografías del design system van al panel Assets y su conjunto completo de tokens, al panel Tokens. Penpot conserva su propia copia. Un token editado en Penpot vuelve mediante la importación en [Lolly Design System Setup](/info/brand-studio.html).

![El panel de exportación con Penpot seleccionado: el archivo .penpot y Send to Penpot junto a la descarga](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26options&width=1440&height=900&dpi=192&waitMs=2000&drive=click%3A%5Bdata-fmt-trigger%5D%3Bwait%3A400%3Bclick%3A%5Bdata-fmt%3D%22penpot%22%5D%3Bwait%3A800&cropSelector=.export-popup&walker=1&format=svg&dark=1&filename=exp-penpot)

Para abrir el archivo, inicia Penpot, selecciona un proyecto y elige **Import**. Si inicias sesión en Penpot desde el panel de exportación, **Send to Penpot** importa el archivo por ti.

### Word, OpenDocument e InDesign

**Lolly Doc Studio** exporta **Word** (DOCX) y **OpenDocument** (ODT) con párrafos y encabezados editables. El archivo de Word fija las fuentes y el color de texto de la marca mediante los estilos del documento, respeta el tamaño de página que elijas y añade un PNG junto a un logotipo SVG para las aplicaciones que no pueden dibujar SVG.

**Lolly Design** exporta **InDesign IDML (static subset)**: texto, rectángulos, óvalos e imágenes PNG o JPEG, un pliego por mesa de arte. El formato en línea compatible sigue siendo editable, las imágenes viajan en `Links` y las coordenadas se convierten en puntos de InDesign. Puede ser necesario revisar los vínculos, la sustitución de fuentes y los cambios en los saltos de línea. Los efectos, la animación, los artículos compuestos y la geometría no compatible detienen la exportación con un informe que los enumera. IDML no conserva el documento original. Envía PDF para las obras terminadas.

### Líneas de tiempo: dotLottie y Premiere

Desde la línea de tiempo de Lolly Design, **dotLottie** escribe una animación que sigue siendo editable en las herramientas de Lottie; [Animaciones Lottie](/info/sequence-editor.html#lottie-animations) enumera lo que conserva. **Premiere XML + media** empaqueta clips temporizados y sus medios originales para Premiere; consulta [Intercambio XML de Premiere](/info/sequence-editor.html#premiere-xml-exchange).

### SCORM (paquetes de cursos)

La exportación de cursos está desactivada hasta que activas **Training and courses** en Settings → Preferences → Feature flags.

Después elige **Export course** desde una herramienta compatible, una carpeta de proyecto o una selección. En Lolly Design, elegir **SCORM (LMS)** y **Download** abre el mismo flujo de cursos. Lolly guarda el trabajo, muestra el contenido y el orden del curso para revisarlos y luego abre el módulo y su diálogo de exportación.

- <!--i:layers--> Elige una representación para cada fuente: páginas estáticas, movimiento como vídeo, audio o un recurso descargable. Añade el texto de las lecciones y alternativas de lectura en el módulo.
- <!--i:clock--> Previsualiza el reproductor del alumno y revisa las descripciones y los subtítulos. El movimiento, incluida la animación sin sonido, se incluye como vídeo.
- <!--i:document--> Elige Website, SCORM 1.2, SCORM 2004 4th Edition o un destino xAPI experimental. Comprueba el contenido y el tamaño del ZIP y luego guarda y descarga la versión comprobada.
- <!--i:check--> Para completar el curso hay que confirmar cada lección obligatoria y elegir Finish.

![El panel de exportación de un deck de Lolly Design con SCORM (LMS) seleccionado](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Ftemplate%3Dfeature-tour%26format%3Dscorm%26options&width=1440&height=900&dpi=192&waitMs=3500&css=.fc-insp%7Bdisplay%3Anone!important%7D.edge-dock-slot--fill%7Bflex%3A1%201%20auto!important%3Bheight%3Aauto!important%3Bmax-height%3Anone!important%3Boverflow%3Avisible!important%7D.export-popup.is-floating%7Bheight%3Aauto!important%7D.export-popup-body%7Bmax-height%3Anone!important%3Boverflow%3Avisible!important%7D&drive=click:.edge-dock-tab%3Ahas-text%28%22Export%22%29;wait:600&cropSelector=.export-popup&walker=1&format=svg&dark=1&filename=exp-scorm)

El paquete contiene el contenido terminado y no necesita una cuenta de Lolly. Coloca un ZIP de Website en un host HTTP(S); importa un ZIP de LMS sin modificarlo. Prueba el destino antes de compartir el curso. Para un curso creado a partir de varias creaciones guardadas, consulta [Crear un curso de formación](/info/training-creators.html).

### Subtítulos para emisión

La herramienta Captions también puede exportar **TTML** y **SCC**. Ambos se escriben a partir de la misma lista de entradas que los archivos SRT y VTT, así que las palabras y los tiempos coinciden.

- **TTML** es el IMSC1.1 Text Profile, con tiempos de reloj referidos al tiempo del medio y una región centrada en la parte inferior. No incluye color, fuente ni posición por subtítulo, porque los subtítulos de Lolly solo contienen un inicio, un final y texto.
- **SCC** contiene subtítulos emergentes CEA-608 en el canal 1 a 29,97 fotogramas por segundo con código de tiempo drop-frame. Admite los caracteres norteamericanos básicos, además de los especiales y ampliados. Si un subtítulo contiene un carácter ajeno al conjunto, la exportación se detiene e indica qué carácter es. Cada subtítulo se ajusta a 32 columnas y un máximo de 15 filas. Un subtítulo que no puede cargarse antes de su hora de inicio se retrasa unos fotogramas.
- No se escriben subtítulos roll-up ni paint-on.

::: note SCC no se ha comprobado en una herramienta de emisión
Tampoco se ha probado en un decodificador de hardware. Prueba un archivo en tu propio flujo de trabajo antes de la entrega.
:::

### DXF (archivos de corte)

Lolly Asset Export, Diagrams, Growth, Lolly Logo Wall, QR Code, Street Map, Wayfinding y Wordmark exportan **DXF**, el formato de intercambio AutoCAD R12 que leen las cortadoras láser, los plóteres de vinilo y el software CNC. La geometría se escribe como trazados de contorno en milímetros y el texto se convierte en contornos. El color se asigna al índice más cercano de AutoCAD Color Index, que suele determinar la operación de la cortadora. DXF solo contiene dibujos de líneas: una región fotográfica o con filtros no tiene trazado de corte y se omite con una advertencia. Usa SVG o PDF para conservar el contenido de trama. El texto que ninguna fuente cubre, ni siquiera una [fuente de respaldo](/info/fallback-fonts.html), detiene la exportación con un mensaje que cita ese texto.

Un diseño de Street Map se compone solo de trazos, así que cada carretera y canal se convierte en un trazado de corte.

::: showcase
![Un renderizado de París en Street Map con tinta sobre crema - solo líneas, así que cada trazo se conserva al pasar a una cortadora](/t/url-shot?url=%2F%23%2Ftool%2Fstreet-map%3Fcity%3Dparis%26roadColor%3D1a1a2e%26waterColor%3D93c5fd%26background%3Dfaf7f2%26full&width=1440&height=900&dpi=96&waitMs=3200&cropSelector=%23tool-canvas&walker=1&format=svg&dark=1&filename=vt-street-map-cut)

Desplázate y la cámara se aleja a través de la geometría: siete trazados y ningún píxel. Una cortadora lee el mismo archivo.
:::

<!--i:eti-stamp-->
## Impresión

**Print PDF** escribe CMYK según una condición de impresión con nombre, **Coated FOGRA39** de forma predeterminada. Las muestras de color de marca con valores de tinta medidos conservan esos valores. Los demás colores se convierten mediante un perfil de impresión: el perfil Coated FOGRA39 de Lolly de forma predeterminada, o tu propio perfil cuando eliges su fila **Embed**. Los grises y el negro se mantienen solo en la plancha negra, así que el texto pequeño no puede quedar fuera de registro. FOGRA51, SWOP y GRACoL usan una conversión de dispositivo estándar. El texto negro también sobreimprime el color que tiene debajo, de modo que una prensa ligeramente desalineada no deja un borde blanco alrededor de las letras. **Print TIFF** escribe píxeles DeviceCMYK para un RIP. El control Colour profile regula ambos ([Perfiles de color](#colour-profiles)). Print TIFF y **EPS (CMYK)** separan los colores mediante el mismo perfil de impresión que Print PDF.

**Print marks & bleed** tiene su propia tarjeta en los formatos de impresión: el sangrado en milímetros más Crop, Registration, Bleed, Colour bars y Stamp details. Stamp details imprime la fecha, la herramienta y tu nombre en el margen. Un nombre o nombre de herramienta con letras que la fuente del margen no tiene, como árabe, chino, cirílico o un emoji, se dibuja como imagen en el mismo gris. La tarjeta de exportación enumera esas escrituras.

Algunas herramientas, como *Booklet*, crean un **PDF de varias páginas**: una portada, contenido que fluye por tantas páginas como necesite y una contraportada. Cada página es una página PDF vertical real en A4, US Letter o A5. Puedes forzar cualquier bloque a una página nueva. Son documentos RGB sin marcas de corte ni de sangrado; esas marcas pertenecen al Print PDF de una sola página. Un PDF de Lolly Design también puede ser un **Notes handout**: una página vertical por cada diapositiva con sus notas del orador debajo.

**Antes de exportar.** Una tarjeta **Before you export** al pie del panel muestra lo que verá una imprenta: formato, tamaño y sangrado, áreas de corte y sangrado, cobertura de tinta, número de planchas y de páginas, con un dictamen junto al encabezado. La tarjeta nunca bloquea una exportación. Lolly Design siempre muestra la tarjeta con sus propias comprobaciones, incluidas las reglas del design system capa por capa y la señal de escritura del texto del documento ([Antes de exportar](/info/design.html#before-you-export)). Lolly Design añade estas comprobaciones de impresión cuando **Print preflight** está activado. En otras herramientas, activa **Print preflight** en Settings → Preferences → Feature flags. Está desactivado de forma predeterminada, y un despliegue de Lolly Work puede activarlo para sus miembros.

**Después de exportar.** Lolly vuelve a leer el archivo terminado y lo compara con lo que elegiste: formato, tamaño en píxeles o de página, duración del clip, fondo transparente, color CMYK, HDR, Content Credentials y contraseña de PDF o ZIP. Cualquier diferencia se escribe en la tarjeta de exportación. Cada medida procede del archivo, nunca del ajuste. Una propiedad que el archivo no puede confirmar no se cuenta como coincidencia. La línea de comandos escribe la comparación completa con `--export-report` (consulta [Renderizar con la CLI](/info/cli-rendering.html)).

::: details Comprobaciones de accesibilidad de PDF desde la línea de comandos
**Comprobaciones de accesibilidad de PDF.** Para un PDF, la línea de comandos también enumera 32 comprobaciones de accesibilidad en el archivo `--export-report`, bajo `pdfAccessibility`. Cada comprobación tiene un identificador, una descripción sencilla, un resultado y el lugar del archivo donde encontró un problema:

- **Passed**: la comprobación examinó algo y no encontró ningún problema.
- **Failed**: la comprobación encontró un problema. Se enumeran sus números de página o etiquetas.
- **Not applicable**: el archivo no contenía nada de ese tipo que examinar, como las comprobaciones de tablas en un archivo sin tablas. Esto no dice nada sobre el archivo.
- **Needs a person**: un programa no puede evaluar seis comprobaciones (orden de lectura, contraste de color, destellos, scripts, límites de tiempo y enlaces repetidos).

La lista no es un dictamen. No afirma que un PDF cumpla PDF/UA ni que las personas que usan tecnología de asistencia puedan utilizar el PDF. Sigue siendo necesario que una persona compruebe el archivo con un lector de pantalla. Los propios PDF de Lolly no superan actualmente las comprobaciones de etiquetado, porque los exportadores aún no escriben etiquetas. La comprobación lee el archivo en tu dispositivo y no cambia nada. Los archivos que necesitan contraseña figuran como no comprobados, no como aprobados. Para comprobar un PDF que te hayan enviado, suéltalo en [Lolly Strip Hidden Data](/info/utilities.html), que muestra la misma lista en **PDF accessibility checks**.
:::

Las comprobaciones del Inspector de Lolly Design y la comparación de marca en Lolly Design System Setup examinan el diseño. Estas dos tarjetas examinan el archivo.

::: details Coste a partir de una lista de tarifas
Debajo de la comprobación previa a la impresión, una tarjeta de costes convierte los mismos recuentos en dinero, incluso cuando la tarjeta de comprobación está desactivada. Necesita dos cosas: un trabajo que una lista de precios pueda valorar (planchas, hojas, área, páginas, filas de variantes o archivos de salida, por lo que un simple PNG de logotipo nunca muestra la tarjeta) y una **lista de tarifas**, una lista de precios en JSON de tu imprenta. Una compilación predeterminada no incluye ninguna lista de tarifas ni permite cargar una desde la aplicación. Una lista de tarifas llega como recurso del catálogo incluido en un despliegue, o mediante la extensión opcional de tarifas que activa quien aloja su propia instancia o un plano de control. Sin una lista de tarifas, no se muestra nada.

Cada cifra es una tarifa que proporcionaste multiplicada por una cantidad que contó Lolly, como `4 plate × €35.00`. El total muestra su fuente: el emisor de la lista y la fecha de sus tarifas. No hay moneda predeterminada ni precio de relleno. Lo que el archivo dice de sí mismo se presenta como una afirmación del archivo: *"El archivo dice: … Lolly no lo ha verificado."*

Cuando no se puede calcular una cifra, la tabla se retira en lugar de rellenarse:

- Las líneas que la lista no valora implican **ningún total**, solo un encabezado que indica cuántas no tienen precio.
- Una cantidad que es un límite máximo lleva **"hasta"** en su subtotal.
- Las tarifas cuya fecha de validez ha pasado muestran **solo recuentos** hasta que pulsas *Use these rates anyway*; la fecha de caducidad permanece entonces junto a la cifra.
- Al abrirse mediante un **enlace**, los importes permanecen ocultos hasta que los solicitas en este dispositivo. La CLI acepta `--rate-card=<file.json>` como archivo local y nunca como parámetro de enlace.

La lista se elimina de cada fase de exportación y nunca cambia el archivo. Es aritmética, no un presupuesto. Solo tu imprenta puede darte un presupuesto.
:::

<!--i:eti-film-->
## Movimiento y sonido

### Vídeo

Las herramientas animadas exportan **MP4** y **WebM**. Un enlace compartido `?format=` que solicita un contenedor que este navegador no puede crear recurre al otro, con el nombre de archivo correspondiente. **Start after** mantiene el lienzo quieto para que las animaciones y las fuentes se estabilicen antes de grabar. **Duration** fija la duración del clip terminado. **Motion blur** (Off, Draft quality, Standard o High, con un **Shutter angle**) desenfoca los movimientos rápidos y hace más lento el renderizado. Cuando el navegador lo admite, **Record live** graba la vista previa en pantalla en tiempo real mediante una pantalla compartida.

![Los ajustes de tiempo de una exportación animada: Start after, Duration, Motion blur con su Shutter angle y Record live](/t/url-shot?url=%2F%23%2Ftool%2Flottie-digi-ad%3Fformat%3Dmp4%26options&width=1440&height=900&dpi=192&waitMs=2500&cropSelector=.video-params&walker=1&format=svg&dark=1&filename=exp-video-settings)

**Quality** permite elegir Smaller file, Balanced o Best quality. **Advanced** abre **Codec**, **Frame rate**, **Rate mode** y **Hardware acceleration**. Cuando una herramienta tiene subtítulos, **Captions** permite elegir una **Embedded track** o un **Sidecar .vtt + .srt** junto al vídeo. Un enlace incluye la calidad, el códec, la frecuencia de fotogramas, la duración y el retraso de inicio como `vq`, `codec`, `fps`, `seconds` y `wait` ([Parámetros URL](/info/url-parameters.html)).

Las exportaciones de vídeo conservan su sonido. Una herramienta puede poner un **fondo musical** bajo el clip: un recurso de audio en bucle o recortado a la duración del clip, con fundidos, volumen y atenuación bajo el sonido del propio metraje. Las herramientas de grabación incorporan su audio en vivo al archivo.

Un deck de Lolly Design que avanza por clics también puede exportarse como vídeo. **Export slides as video** en el menú Present abre la hoja de exportación en MP4. Cada diapositiva se reproduce durante su propio tiempo de permanencia, o durante la Duration de la hoja de exportación si no tiene uno. La transición del deck se reproduce entre diapositivas como un fundido. El documento no cambia.

**HTML** de un documento temporizado de Lolly Design, o de Snippet, es un reproductor en un solo archivo: controles de reproducción, desplazamiento y sonido sobre la animación, con sus fuentes compatibles, imágenes y sonido incrustados. El archivo se reproduce sin conexión. Una película de Lolly Design con escenas añade un menú de sus escenas. Una secuencia que contiene un clip de vídeo, Lottie o 3D aún no puede exportarse como HTML; exporta la secuencia como vídeo.

### Imágenes animadas

**GIF** se reproduce en todas partes y sirve para chat y correo; ocupa más y tiene menos colores que el vídeo. **APNG** y **Animated WebP** conservan el color completo y la transparencia. **Lottie Ad** también exporta **Animated SVG**: fotogramas vectoriales con fotogramas clave CSS incrustados que escalan a cualquier tamaño y se reproducen en bucle en una pestaña del navegador o en un `<img>` sin códec. Su texto se convierte en contornos. Usa una frecuencia de fotogramas predeterminada menor porque cada fotograma pesa más que un mapa de bits. Todos estos formatos carecen de sonido.

### Audio

Algunas herramientas exportan solo sonido. **Lolly Voice Recorder** captura una toma de micrófono con un medidor de nivel en vivo y la guarda como **MP3**, **WAV**, **M4A (AAC)** u **Opus (WebM)**, codificada en tu dispositivo. `wav`, `mp3`, `m4a` y `opus` son identificadores de formato normales, así que una exportación de audio se puede compartir y controlar mediante scripts igual que un PNG.

El selector de recursos acepta muchos formatos de audio para un fondo musical, desde MP3 y FLAC hasta MIDI y módulos de tracker; [Formatos](/info/formats.html) los enumera. Una [canción de Lolly Rondocode](/info/rondocode.html) se reproduce con la duración que pide su clip.

<!--i:eti-palette-->
## Color y HDR

Lolly lee todos los colores CSS modernos, calcula los colores de forma perceptual y escribe cada archivo en un espacio que un lector puede abrir: sRGB para pantallas, CMYK para impresión y Rec.2100 PQ para HDR ([El color en el motor](/info/colour-engine.html)). Un documento de Lolly Design configurado en **Wide colour / HDR** sigue sus propias reglas: consulta [Edición con gama de color amplia y HDR](/info/hdr-editing.html).

### Perfiles de color

Las exportaciones se etiquetan con un perfil de color, para que las aplicaciones con gestión del color, como las de las imprentas, Photoshop y los navegadores, lean los colores tal como los viste. Las miniaturas y las vistas previas omiten la etiqueta para mantenerse pequeñas.

- **PNG y JPG** incluyen un perfil ICC **sRGB** incrustado, el espacio en el que se dibuja la vista previa. Los píxeles se etiquetan, no se vuelven a codificar.
- **Print PDF (CMYK)** declara su condición de impresión en su *OutputIntent*, que indica a una imprenta cómo deben interpretarse sus tintas CMYK.
- **Print TIFF (CMYK)** escribe píxeles DeviceCMYK sin etiquetar y registra la condición de impresión en sus metadatos TIFF. Un TIFF no puede incrustar un perfil de impresión, así que una fila **Embed** solo registra el nombre de ese perfil.
- **TIFF (RGB)** es la versión sRGB sin comprimir para archivo o para editar y volver a importar. Ambos TIFF solo están disponibles en la aplicación de escritorio, porque los navegadores no pueden previsualizar un TIFF.
- **SVG**, **EMF**, **EPS** y **DXF** son vectores sin perfil incrustado: los colores de SVG son sRGB, EMF y EPS usan RGB de dispositivo, **EPS (CMYK)** escribe DeviceCMYK y DXF usa AutoCAD Color Index. SVG, EPS y DXF convierten el texto en trazados de contorno. EMF mantiene el texto vivo y editable en Office y Google Slides y solo convierte en contornos los tramos que el formato no puede expresar. La opción **Outline fonts** del panel de exportación fuerza el uso de trazados en todas partes, como `_text=outline` en un enlace y `--text=outline` en la línea de comandos. SVG también reproduce las sombras de caja CSS, interiores y exteriores.

::: details PDF/X-4 y tu propio perfil de impresión
Lolly incluye un perfil CMYK, ajustado a los datos de caracterización FOGRA39 de Fogra y publicado bajo CC0, y convierte los colores mediante él para la condición de impresión predeterminada. El perfil no se incrusta porque es de la versión ICC 4.3 y PDF/X-4 acepta versiones hasta la 4.2. Por ello, una condición de impresión con nombre escribe el propósito de salida sin declarar conformidad con PDF/X-4.

Carga tu propio perfil CMYK y elige su fila **Embed** en el control Colour profile. Se incrusta como *DestOutputProfile* del archivo, y el PDF declara conformidad con PDF/X-4 siempre que el resto del archivo lo permite. La condición de impresión que declara se lee de ese perfil: un nombre registrado cuando el perfil acredita uno, o `Custom` bajo el nombre del propio perfil.

Tres cosas impiden la declaración de conformidad pero conservan el propósito de salida: las ilustraciones RGB que la pasada CMYK no pudo convertir, el texto de crédito `prov` en el margen de prueba (dibujado con una fuente estándar que no está incrustada) y una contraseña **Strong**, ya que PDF/X-4 prohíbe el cifrado. Todos los PDF también contienen metadatos PDF/X-4: cajas de página, XMP, un identificador de documento y un propósito de salida sRGB con su perfil.
:::

### Tintas planas en cuatricromía

Un design system puede asignar a un color una tinta plana, como un color Pantone o HLC. El **Print PDF** imprime entonces ese color en una plancha propia. Lolly Demo asigna una tinta plana a cada color excepto a sus blancos, Sugar y Daylight, y a su negro, Void. Un Print PDF creado en Lolly Demo imprime la mayoría de los colores en planchas de tintas planas y el negro en la plancha negra.

Para obtener un archivo solo en cuatricromía, marca **Print spot inks as process** en la tarjeta Profile del panel de exportación. Cada tinta plana se imprime entonces con cian, magenta, amarillo y negro, usando la composición CMYK que el design system asigna a ese color. Un color sin composición propia usa la conversión del perfil de imprenta, como cualquier otro color del diseño. El archivo tiene entonces solo las cuatro planchas de cuatricromía. La opción está desactivada de forma predeterminada. El panel muestra la casilla solo para **Print PDF** y solo cuando el design system asigna una tinta plana a algún color.

Un acabado no es una tinta. El estampado con foil, el relieve, el bajorrelieve, el barniz selectivo, el tacto suave, el troquelado, el hendido y la perforación conservan sus propias planchas con nombre cuando la casilla está marcada, porque imprimir un acabado en cuatricromía pondría su máscara negra en la página.

La tarjeta **Before you export** y `lolly preflight` cuentan las planchas que tendrá el archivo. Con la casilla marcada, cuentan las cuatro planchas de cuatricromía y las de acabados, e indican que las tintas planas se imprimen en cuatricromía y no añaden planchas. Con la casilla desmarcada, cuentan hasta una plancha por cada tinta plana que asigna el design system. Una tabla de tarifas calcula el precio a partir de esas cantidades, así que nunca cobra una plancha de tinta plana que el archivo no tendrá.

El **Print TIFF** y el **EPS (CMYK)** no tienen planchas con nombre, así que imprimen todas las tintas en cuatricromía con la opción activada o sin ella. Para esos dos formatos, la tarjeta y `lolly preflight` cuentan las cuatro planchas de cuatricromía y ninguna plancha de tinta plana ni de acabado. Un acabado se incorpora a ellos como su máscara negra en la plancha negra, y la tarjeta lo indica como un error.

Un enlace solicita el mismo archivo con `_spots=process`, la línea de comandos con `--spots=process`, el [servidor MCP](/info/mcp.html) con `spots: "process"` y la aplicación de terminal con su fila **Spot inks**. Nada sobre la opción se incorpora al archivo: solo cambian las tintas.

### HDR (colores brillantes)

La tarjeta **HDR** del panel de exportación aumenta el brillo de los diseños normales para pantallas HDR. Para conservar los originales HDR durante la edición, consulta [Edición con amplia gama de color y HDR](/info/hdr-editing.html).

Una exportación normal es sRGB: un color de marca saturado tiene el mismo brillo que el blanco normal de la pantalla. Una pantalla HDR puede alcanzar más brillo. La tarjeta **HDR** intensifica los colores de tu marca y el texto blanco hacia el brillo máximo. Las zonas oscuras se mantienen oscuras.

![La tarjeta HDR del panel de exportación, activada, con los controles White / Reach / Dark lift / Focus visibles debajo](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26format%3Dpng%26hdr%3D1%26options&width=1440&height=900&dpi=192&waitMs=2000&format=svg&cropSelector=.export-hdr&walker=1&dark=1&filename=exp-hdr-card)

- **Formatos.** PNG, JPG, AVIF y TIFF. WebP es de 8 bits y no tiene una vía de decodificación HDR operativa, y los vectores y PDF no tienen modelo HDR.
- **Desactivado de forma predeterminada**, porque cambia los píxeles. Marca la tarjeta o pasa `hdr=1` en un enlace para compartir.
- **Los controles.** **White** (el límite de brillo máximo, de 400 a 2000 nits), **Reach** (hasta qué tonos se extiende el brillo), **Dark lift** (cuánto se aclaran los oscuros; `0` los mantiene oscuros) y **Focus** (cuánta riqueza de color conserva el aumento de brillo). Viajan como un solo valor: `hdr=1600-60-0-50` es White 1600, Reach 60, Dark lift 0 y Focus 50.
- **Qué se escribe.** PNG recibe Rec.2100 PQ de 16 bits con un bloque `cICP`. JPG es un JPEG con mapa de ganancia ISO 21496-1: una imagen SDR normal con un mapa de ganancia añadido. AVIF recibe una caja `colr` reescrita. TIFF recibe píxeles PQ con un perfil ICC v4 generado que lleva una etiqueta `cicp`. TIFF se acopla sobre negro, porque el blanco es el código de 10.000 nits en PQ y pondría un halo alrededor de cada borde. El aumento sigue la luminosidad perceptual (OKLab) y conserva el tono, así que un verde de marca se vuelve más brillante, no verde menta.
- **Dónde se ve el brillo.** En visores con gestión de color en una pantalla HDR: Preview, Quick Look y Safari en dispositivos Apple, o Chrome en un monitor HDR. Una pantalla SDR muestra una imagen normal.
- **Desde el terminal.** `--hdr=1` con `--export=png` o `--export=jpg` escribe el mismo PNG y JPEG con mapa de ganancia en la [CLI](/info/cli.html) con los mismos codificadores del motor, sin navegador. Por ahora, AVIF y TIFF solo se exportan desde la web.

::: warning Muchas plataformas eliminan la señal HDR
Una plataforma que recodifica los archivos subidos puede dejar la imagen oscura o deslavada. Usa HDR donde controles el destino, como tu propio sitio, un videowall o un deck en una pantalla de alto brillo.
:::

<!--i:eti-badge-check-->
## Qué viaja con tu archivo

Un archivo terminado puede tener varios registros. Algunos acompañan a los píxeles y desaparecen cuando el archivo se vuelve a guardar, se captura en pantalla o se eliminan sus metadatos. Dos marcas residen en los píxeles.

::: figure exporting-what-travels
Dónde reside cada registro, si está activado de forma predeterminada y qué parámetro de enlace controla cada uno.
:::

El panel de exportación reúne **Licence**, **Source credits**, **Password**, **C2PA Credentials**, **Lolly Imprint** y **Durable credential** en un grupo **Content protection** que muestra solo las tarjetas que puede usar el formato elegido. El grupo se abre solo cuando un enlace o documento ya declara una licencia, o cuando una fuente necesita tu decisión. La tarjeta **Design system** permanece fuera del grupo, a la vista en cada exportación.

![El grupo Content protection abierto en una exportación PNG, mostrando solo las tarjetas que le corresponden](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26format%3Dpng%26imprint%3D1%26options&width=1440&height=900&dpi=192&waitMs=2000&walker=1&format=svg&cropSelector=.export-protection&dark=1&filename=exp-content-protection)

### Procedencia & marca de agua

Cuando el formato tiene los campos, las exportaciones llevan **metadatos de procedencia**: el software, la fuente, el nombre de la herramienta y la línea de crédito de tu perfil, escritos en PNG iTXt, JPEG EXIF, la información de PDF, `<metadata>` de SVG o un comentario GIF. Solo registran la autoría. No se sube nada. Las herramientas **Experimental** también estampan una marca de agua visible. El anfitrión aplica la marca de agua, así que editar la herramienta no permite eliminarla.

**Lolly Imprint** es una marca de agua invisible en los píxeles, **activada de forma predeterminada**. Sobrevive a la recompresión, así que una copia puede seguir reconociéndose como creada con Lolly. Es un indicio, no una garantía criptográfica, y no lleva datos personales. Se escribe en JPEG XL, PNG, JPG, WebP, AVIF, TIFF y BMP, y en las imágenes de trama que Lolly renderiza dentro de un PDF o PPTX, nunca en una imagen que hayas incrustado. Desmarca **Lolly Imprint** o pasa `imprint=0` para omitir el Imprint. Su supervivencia a la recodificación de AVIF aún no está calibrada. [Lolly Verify](/#/verify) detecta el Imprint en tu dispositivo; consulta [Lolly Imprint](/info/what-verify-checks.html#the-lolly-imprint).

**Durable credential** escribe el id de Lolly en los píxeles mediante un modelo neuronal en el dispositivo, en el formato TrustMark, para que el vínculo «creado con Lolly» sobreviva a la eliminación de metadatos y a una recodificación, y pueda leerse con herramientas compatibles con TrustMark. Está **desactivada de forma predeterminada**, porque requiere una pasada neuronal por exportación y una descarga del modelo una sola vez. Abarca PNG, JPG, WebP, AVIF y TIFF. Márcala en el panel o pasa `durable=1`. Las aplicaciones de escritorio y móviles ocultan la tarjeta, porque sin conexión no tienen un origen del que obtener el modelo.

**Licence.** Elige cómo pueden usar otros tu trabajo: *None (all rights reserved)* de forma predeterminada, CC0 1.0, Public Domain Mark 1.0 o una licencia Creative Commons 4.0 (BY, BY-SA, BY-NC, BY-NC-SA, BY-ND, BY-NC-ND). El nombre de la licencia y un enlace a su resumen se incorporan a los metadatos de licencia del archivo (EXIF, XMP y RIFF cuando el formato los tiene) y a su Content Credential. La opción se guarda con el documento y viaja en un enlace como `licence=`. Lolly escribe la licencia que elegiste. Lolly no comprueba ni hace cumplir las condiciones. Una herramienta con su propio campo de licencia, como Claim, conserva ese campo.

### El registro del design system

Una exportación registra el design system que creó el archivo: su nombre, la versión publicada a partir de la que se dibujó (cuando no es la versión de trabajo) y la [colourway](/info/colourways.html) con la que se dibujó. Cualquier otra opción de tema que declare un design system, como una densidad, se registra del mismo modo. Se omite la opción clara u oscura, porque la imagen ya muestra cuál se usó.

**Ves el registro antes de que se escriba nada.** La tarjeta **Design system**, marcada de forma predeterminada, muestra las palabras exactas que llevará el archivo, como *Registra: Acme · Colourway: Beach*, y la descripción. El nombre de un design system es el que escribieron sus propietarios, y la tarjeta lo muestra tal como está escrito. Desmarca la tarjeta para omitir el registro en esa exportación. El panel de documento de Lolly Design enumera las mismas palabras bajo *Embedded in exports*.

**La descripción indica la colourway junto a la herramienta.** Con la tarjeta marcada, *"Creado con https://lolly.tools : Chart"* pasa a ser *"Creado con https://lolly.tools : Chart (colourway Beach)"*. El nombre del design system permanece en el registro, no en la descripción. Una descripción sin nombre de herramienta, o una que la herramienta escribe a partir de sus propias entradas, no cambia. Una herramienta que ignora las colourways mediante `tokenAxes` no registra ninguna, y el crédito de la prueba PDF (la marca de impresión `prov`) sigue la misma regla.

::: details Skills de marca, páginas de marca y empresas asociadas en el registro
**Skills de marca que guiaron a un agente.** Cuando un agente creó la pieza e indicó las [skills de marca](/info/brand-skills.html) que leyó y siguió, el registro también enumera cada skill con su revisión, como *Guiado por: acme-brand 1.0*. Las palabras significan que la skill guio el trabajo. Lolly no comprueba la pieza frente a una skill. Solo la declaración del propio agente añade la lista. Actualmente es el argumento `brandSkills` de `lolly_render` del [servidor MCP](/info/mcp.html), así que una pieza creada en la aplicación o desde un enlace para compartir no lleva ninguna. La Content Credential contiene la lista como `brandSkills`, un único valor JSON con el id, el nombre, la revisión y el hash SHA-256 de cada skill. El paquete XMP y los metadatos SVG contienen el mismo valor como `lolly:BrandSkills`. Un PDF escrito a partir del registro recibe una palabra clave por skill. La descripción no cambia. El texto de una skill interna nunca se registra. Los mismos interruptores omiten la lista junto con el resto del registro: la tarjeta **Design system**, `_madewith=0`, `--no-madewith` y `madeWith: false`. Cuando el servidor MCP dibuja el archivo en un navegador (un PDF, un JPEG y los demás formatos que su vía sin navegador no puede escribir), los metadatos del propio archivo no contienen ninguna lista. En ese caso, solo una Content Credential puede contenerla. Pasa `c2pa` para conservar el registro. Sin una credencial, el renderizado advierte de que no se registraron las skills de marca.

**La página de marca, cuando quien la publica lo activa.** Quien publica un design system puede optar por registrar la dirección de su [página de marca](/info/brand-page.html#lead-back-from-your-files) en las exportaciones. El ajuste es por design system y está desactivado de forma predeterminada. La tarjeta añade entonces la dirección a la misma línea, como *Registra: Acme · Colourway: Beach · Página de marca: https://acme.example/brand/acme/*. Desmarcar la tarjeta elimina la dirección junto con el resto. El registro contiene la dirección y nada más sobre la página. No cambia nada más en el archivo. Un design system sin dirección escribe el mismo archivo que antes.

**La dirección no viaja con un paquete.** Un registro en un archivo firmado se interpreta como propio del firmante. Una dirección no debe activarse sola para alguien que no la eligió, y un paquete no debe poder dirigir los archivos de otras personas a una página que él elija. Un paquete `.lolly`, una copia o bifurcación de un design system, **Try these colours**, una copia de seguridad restaurada y un archivo de tokens facilitado para una sola ejecución llegan todos con el ajuste desactivado. Puedes activar el ajuste tú mismo, con una dirección que escribas. Un design system gestionado es la única excepción: conserva la dirección que su responsable estableció en los tokens de origen. [Dirigir a tu página desde tus archivos](/info/brand-page.html#lead-back-from-your-files) tiene los detalles.

**La empresa asociada, en un programa de socios de Lolly Work.** Una pieza creada para una empresa asociada registra la empresa y su programa en la misma línea, como *Registra: Acme · Colourway: Beach · Socio: Northwind IT (Resellers, EMEA)*, con la revisión de los datos de la empresa en el archivo. El registro no contiene ninguna persona, datos de contacto, dirección ni moneda. Con el kit de socio de la empresa adjunto, la línea añade la revisión del kit, como *, revisión del kit 2*, y la credencial contiene el id y la revisión del kit, nunca sus colores ni sus reglas. Desmarcar la tarjeta elimina el socio junto con el resto del registro. Un PDF recibe la palabra clave *Socio: Northwind IT*, y [Lolly Verify](/info/what-verify-checks.html#partner) muestra el registro como **Partner** ([El registro del socio en los archivos](/info/manage/partner-programmes.html#the-partner-record-in-files)).
:::

**Volver a leer el registro.** [Lolly Verify](/#/verify) enumera el registro como **Design system** en los detalles de la credencial de un archivo y las skills de marca como **Guided by**. Una página de marca aparece por separado, como [el registro de una dirección por parte del firmante](/info/what-verify-checks.html#brand-page). *Recreate with these settings* vuelve a abrir la herramienta con la versión y la colourway registradas. El enlace se abre con el design system registrado cuando este dispositivo contiene uno con el mismo id y nombre; en caso contrario se abre con tu design system activo.

::: details Qué se escribe en cada lugar y qué ejecuciones omiten el registro
| Dónde | Qué se escribe |
|---|---|
| Content Credential | `designSystem` (el id), `designSystemLabel`, `designVersion` y `themes` en la declaración `tools.lolly.export`, cada uno como valor de texto sin formato; `themes` es una lista JSON de las opciones. `brandPage` cuando quien publica lo activó |
| PNG, JPEG, WebP y JXL | Los mismos valores como propiedades `lolly:` del paquete XMP del archivo, en el espacio de nombres `https://lolly.tools/ns/export/1.0/`. `lolly:BrandPage` cuando quien publica lo activó |
| SVG | Las mismas propiedades `lolly:` dentro del bloque `<metadata>` |
| PDF | Palabras clave como *Design system: Acme*, *Colourway: Beach* y, cuando quien publica lo activó, *Página de marca: https://acme.example/brand/acme/* |
| Cada formato con un campo de descripción | La descripción, con la colourway junto a la herramienta |

La tarjeta aparece solo cuando hay algo que registrar y el formato puede contener el registro. CSV, JSON, un archivo de calendario y otros formatos de texto o datos no contienen metadatos, y EPS, EMF, DXF y BMP no tienen ningún campo para el registro. HTML, Markdown y CSS contienen el registro solo en su Content Credential, así que para ellos la tarjeta no muestra ninguna línea de descripción y se oculta mientras **C2PA Credentials** está desactivado. Un campo que el design system no proporciona queda fuera del archivo.

Un enlace para compartir desactiva el registro con `_madewith=0` ([Parámetros de URL](/info/url-parameters.html)). La línea de comandos acepta `--no-madewith`, `lolly_render` del [servidor MCP](/info/mcp.html) acepta `madeWith: false` y el panel de exportación de la aplicación de terminal tiene una fila **Design system**. La línea de comandos imprime en la salida de error estándar las palabras que lleva un archivo terminado, tanto para el renderizado de una herramienta como para cada archivo que `lolly run` exporta desde una sesión guardada de Lolly Design. Un renderizado MCP imprime las palabras junto al archivo. Ambos vuelven a leer las palabras del archivo. Un PNG que la línea de comandos dibuja sin navegador no lleva metadatos de archivo, así que su registro viaja solo en la credencial. Las utilidades en el dispositivo no añaden metadatos.

Las ejecuciones sin tarjeta **Design system** omiten el registro: una ejecución de Lolly Batch, una carpeta exportada desde Projects y una exportación de una colección 3D, y en la aplicación de terminal un lote CSV, una exportación de una carpeta o selección de Projects y la vista que renderiza todo. Exporta un archivo desde la herramienta para registrar el design system.
:::

### Content Credentials (C2PA)

Las exportaciones pueden llevar **Content Credentials**: un manifiesto [C2PA](https://c2pa.org) firmado que registra qué creó el archivo, cuándo y dónde, vinculado a un hash de los bytes del archivo para que se pueda detectar cualquier edición posterior. Lolly escribe manifiestos estándar que cualquier lector C2PA puede inspeccionar.

![La tarjeta C2PA Credentials, marcada, con la vigencia de la credencial junto a la casilla](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26format%3Dpng%26c2pa%3D30%26options&width=1440&height=900&dpi=192&waitMs=2000&format=svg&cropSelector=.export-c2pa%5Bdata-c2pa-only%5D&walker=1&dark=1&filename=exp-c2pa-card)

- **Activado de forma predeterminada.** La tarjeta **C2PA Credentials** está marcada para casi todas las herramientas. Desmárcala para una exportación o pasa `c2pa=off` en un enlace. El archivo no tendrá entonces ninguna credencial, y un SVG que integre un diseño con credencial, como un logotipo del catálogo, también pierde la credencial de ese diseño. El Lolly Imprint y los demás metadatos del archivo se conservan. Una herramienta puede desactivarlo en su manifiesto.
- **Formatos.** PDF (RGB y Print), PNG y APNG, JPG, GIF, SVG y SVGZ, TIFF (RGB y Print), WebP (estático y animado), AVIF, MP4, WebM, HTML, Markdown, CSS y los contenedores de audio MP3, WAV, M4A, OGG/Opus y FLAC. Un ZIP sella cada elemento compatible, que es como un Animated SVG recibe una credencial. MP4, AVIF y M4A usan la vinculación BMFF estándar y MP3 su correspondencia ID3v2, así que `c2patool` y otros lectores los verifican. WebM y OGG/Opus aún no tienen una correspondencia estándar, así que Lolly lleva el manifiesto como adjunto Matroska y como campo OpusTags, que comprueba el propio verificador de Lolly. Un SVGZ es un SVG comprimido. La especificación C2PA no define ninguna forma comprimida, así que la credencial se escribe en el SVG antes de comprimirlo. El verificador de Lolly lee el archivo tal como está; `c2patool` lee la misma credencial una vez descomprimido el archivo (`gunzip`). ICO, EPS, EMF, DXF, BMP, PPTX, los formatos de Office y los demás formatos de texto y datos no tienen contenedor C2PA.
- **Qué registra.** La herramienta y la aplicación que crearon el archivo, la hora de firma y el entorno que exportó el archivo. Para una página de Lolly Design exportada como imagen, SVG o PDF, el renderizador que dibujó la página (`route` en la declaración `tools.lolly.export`: `gpu` para el renderizador de páginas por GPU, `operations` para las operaciones de dibujo escritas como vectores, `compatibility` para el propio renderizador del navegador) y la versión de ese renderizador (`renderer`: la receta GPU, `design-draw-v` y su versión, o `dom-to-image` y `dom-walker`). El [design system y la colourway](#the-design-system-record) mientras la tarjeta **Design system** esté marcada. Los ajustes activos: opciones de menú, números, interruptores y colores tal como están, y todo lo escrito (títulos, nombres, notas, enlaces y fechas) solo como huella, para que las palabras no estén en el archivo. Se omiten los campos vinculados al perfil, los controles inactivos, las versiones del navegador y los detalles del sistema operativo. Tu nombre y correo aparecen como autor solo cuando **Use my details to create** está activado en Settings → Preferences → Your details. Las fuentes que coloca una exportación viajan como ingredientes. Cada imagen de la página que lleva una Content Credential propia se registra como componente de la página, con esa credencial y cualquier tipo de fuente de IA que declare. Esto ocurre en PNG, JPEG, WebP, AVIF, TIFF, SVG o PDF, y en GIF, APNG, WebP animado, MP4 o WebM cuando la imagen se dibuja en al menos un fotograma del intervalo exportado. La única imagen que modifica una herramienta como Darkroom, Filter o Asset Export se registra en cambio como origen del archivo, abierta primero y seguida de lo que la herramienta hizo con ella. Otros ingredientes son [obras acreditadas](#source-credits) como emoji, [canciones de Lolly Rondocode](/info/rondocode.html#songs-in-the-credential) en una exportación de vídeo o audio y [melodías guardadas](/info/generated-music.html#what-a-track-records) en una exportación de vídeo o audio. Cada melodía guardada incluye su nombre, la licencia cuando la melodía registra una, el SHA-256 de su receta, la versión del motor y su clasificación como contenido algorítmico. El creador de una melodía guardada (el nombre de perfil con el que se guardó) se añade solo mientras **Use my details to create** está activado, como tu propio nombre. Solo entonces el panel de exportación muestra al creador antes de exportar.
- **Una aprobación, cuando se registró.** Un archivo aprobado mediante [Lolly Work](/info/work-approvals.html#review-an-exported-file) puede llevar un segundo registro firmado sobre esta credencial: el id de aprobación, la fecha de la decisión y el resumen criptográfico del archivo revisado. No contiene nombres, correos, grupos, comentarios ni nombres de cadenas. Está marcado de forma predeterminada en el diálogo de solicitud y puede desmarcarse para una solicitud o desactivarse para una instancia. Registra que un firmante declaró una decisión. No afirma que el trabajo cumpla ninguna norma.
- **Qué se le pidió hacer, para un archivo creado a partir de una [intención](/info/visual-intent.html#what-goes-in-the-file).** El propósito, la superficie, la herramienta, el idioma, las versiones de las reglas y del vocabulario y el resumen criptográfico de la intención. La ocasión, el público, la región y el prompt son solo huellas, salvo que la persona o el agente que ejecuta ese renderizado pida registrar las palabras del prompt. Solo un renderizado que partió de una intención lleva este registro. La ejecución indica qué registró, y el registro puede omitirse.
- **Qué ven los destinatarios.** Las herramientas C2PA, como las aplicaciones de Adobe, `c2patool` y contentcredentials.org/verify, leen el manifiesto y muestran la declaración. Lolly firma con una clave creada en tu dispositivo, no con un certificado de una lista de confianza, así que los visores indican una credencial *no verificada*. La estructura y la evidencia de manipulación son válidas, pero nadie avala al firmante. Para cambiarlo, registra una **identidad verificada** en Settings → Preferences → Content Credentials; consulta [Identidad de Content Credentials](/info/content-credentials-identity.html).
- **Comprobar un archivo.** Suelta cualquier archivo en [Lolly Verify](/#/verify), o ejecuta `lolly validate <file>`, para obtener un informe en el dispositivo que empieza indicando si Lolly creó el archivo y si ha cambiado desde entonces. Lolly Verify también examina más allá de la credencial; consulta [Qué comprueba Lolly Verify](/info/what-verify-checks.html).
- **Privacidad.** La clave de firma se crea para la exportación y nunca sale de tu dispositivo. La declaración contiene solo lo que ya llevan los metadatos de procedencia. Las utilidades de privacidad que transforman tus propios archivos no añaden ninguna credencial, y *Lolly Strip Hidden Data* elimina un manifiesto C2PA como cualquier otro metadato. La utilidad Rondocode crea audio nuevo, así que firma lo que escribe ([Canciones de Lolly Rondocode](/info/rondocode.html#files-from-the-rondocode-utility)). El generador de música firma cada descarga WAV o M4A. La credencial registra que el generador de música de Lolly creó la pista y la licencia de la música, CC BY 4.0, con su crédito ([Qué registra una pista](/info/generated-music.html#what-a-track-records)).
- **Interacciones.** Un PDF protegido con contraseña no puede llevar Content Credentials en ninguno de los dos niveles. La credencial se añade al final, sobre los bytes terminados, después de los DPI, EXIF, el perfil de color, los metadatos PDF/X y las marcas de impresión.

### Créditos de las fuentes

Una exportación que coloca el trabajo de otra persona registra esa fuente en la credencial. El caso habitual es un emoji del conjunto de emoji elegido: la obra, su creador, la licencia, de dónde proceden los bytes exactos y qué cambió viajan con el archivo. El texto en una herramienta cuya plantilla es un SVG conserva los emoji del propio sistema, así que ahí no se acredita nada. Antes de descargar, la fila **Source credits** indica qué exigen las fuentes para la entrega. Tras la descarga, la fila vuelve a leer los bytes entregados antes de indicar que los créditos están en el archivo. Una licencia que te exige elegir, como la de un glifo CC BY-SA recoloreado que vas a compartir, recibe una tarjeta con las opciones. La descarga nunca se bloquea. [Derechos creativos y créditos](/info/creative-rights.html) contiene la redacción, las licencias revisadas y lo que sigue siendo tuyo.

<!--i:eti-lock-->
## Protección con contraseña

Lolly crea dos tipos de bloqueo, ambos en tu dispositivo. La tarjeta **Password** del panel de exportación configura los dos.

![La tarjeta Password desplegada en una exportación PDF, con el campo de contraseña y los dos niveles de bloqueo](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26format%3Dpdf%26password%3Ddemo%26options&width=1440&height=900&dpi=192&waitMs=2000&walker=1&format=svg&cropSelector=.export-pdfpass&dark=1&filename=exp-pdf-password)

**Una contraseña de apertura de PDF** tiene dos niveles una vez que escribes una contraseña:

- **Weak**: RC4 de 40 bits, para `pdf` RGB sin marcas de impresión ni sangrado y contraseñas en ASCII simple. Una contraseña con otros caracteres pasa a Strong, porque los lectores no pueden abrir un archivo bloqueado así en este nivel. Solo cuentan los primeros 32 caracteres.
- **Strong**: AES-256 (PDF 2.0). También se aplica a los Print PDF y a cada PDF dentro de un ZIP de lote. Un Print PDF bloqueado con Strong conserva su CMYK, sus marcas y su propósito de salida, pero elimina la declaración PDF/X-4.

::: warning Weak disuade, pero no protege
Usa **Strong** para un archivo confidencial.
:::

**Un ZIP bloqueado** cubre una exportación ZIP, una descarga de carpeta de Projects o un lote, con una contraseña en dos niveles: **Weak** (ZipCrypto, disuasorio) o **Strong** (AES-256). La contraseña protege cada elemento. Cualquier PDF dentro también se bloquea por separado con AES-256, así que sigue bloqueado después de descomprimir el ZIP. La solicitud aparece cuando empieza la descarga. Una contraseña en blanco significa que no hay bloqueo.

**Una contraseña escrita queda fuera de los enlaces en ambos niveles.** Si un archivo llega a través de un enlace `?password=`, Lolly lee el valor y lo elimina de la dirección al instante. Un enlace que solicita un bloqueo que su archivo no puede contener no escribe ningún archivo e indica por qué (consulta [`password`](/info/url-parameters.html)).

**Un enlace para compartir protegido con contraseña** pide al destinatario una contraseña antes de abrirse. El estado del enlace se cifra con AES-256 mediante una clave derivada de la contraseña (PBKDF2). Solo viaja el texto cifrado, y el descifrado ocurre en el navegador del destinatario. El servidor que sirve el enlace nunca ve la contraseña ni el diseño. Actívalo en el diálogo **Share**. Un enlace cifrado se abre solo en Lolly, nunca como imagen incrustada. Consulta [Modo URL](/info/url-mode.html).

<!--i:eti-monitor-->
## En un teléfono

Los controles de exportación están tras el botón flotante **Export**, que abre el panel **Export**: los mismos formatos, tamaño, copia, descarga y opciones para compartir, adaptados al uso táctil.

<!--i:eti-code-->
## Ids de formato para enlaces y la CLI

Estos son los valores del parámetro de URL `format=` y de la opción de CLI `--export=` (consulta [Parámetros de URL](/info/url-parameters.html) y [CLI](/info/cli.html)). El menú de una herramienta muestra solo los formatos que esa herramienta puede crear.

| Tipo | Ids |
|---|---|
| Trama | `png` · `jpg`/`jpeg` · `webp` · `avif` · `jxl` · `jxl-lossless` · `tiff` (RGB TIFF) · `cmyk-tiff` (Print TIFF) · `bmp` · `ico` |
| Vector | `svg` · `svgz` (SVG comprimido con gzip) · `emf` · `wmf` · `eps` · `eps-cmyk` (EPS CMYK) · `dxf` (archivo de corte) |
| Página y documento | `pdf` · `pdf-cmyk` (Print PDF) · `pptx` (PowerPoint) · `docx` (Word) · `odt` (OpenDocument Text) · `idml` (InDesign) · `penpot` (archivo de diseño de Penpot) · `scorm` (paquete de curso, un ZIP) |
| Movimiento | `gif` · `apng` (Animated PNG) · `webp-anim` (Animated WebP) · `svg-anim` (Animated SVG) · `webm` · `mp4` · `lottie` (dotLottie) · `premiere-xml` (Premiere XML + medios) |
| Audio | `wav` · `mp3` · `m4a` · `aac` · `opus` · `ogg` · `flac` · `mid` (notas MIDI, de Lolly Rondocode) |
| Texto y datos | `html` · `md` · `txt` · `json` · `csv` · `ics` · `vcf` · `srt` · `vtt` · `ttml` · `scc` · `css` · `scss` · `gpl` (paleta GIMP) |
| Paquetes y archivos agrupados | `zip` · `rpm` y `tar.gz` (el renderizado sellado en un paquete Linux) |

Algunos ids proceden del propio código de exportación de una herramienta: `ase` (Adobe Swatch Exchange, de Lolly Palette Lab) y `exr` y `hdr` (imágenes de trama de alto rango dinámico, de Lolly Darkroom). **Convert Font** escribe `ttf`, `otf` y `woff` a partir de un archivo de fuente que tú proporcionas, así que un enlace solo no da a la herramienta nada que renderizar.
