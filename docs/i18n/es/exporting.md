# Exportar un archivo

Has creado algo y tiene que salir de Lolly: un PNG para un chat, un PDF para la imprenta, un deck que un colega seguirá editando. Pulsa **Export**, la mitad izquierda de la píldora **Export | Save**. Elige un formato junto al nombre del archivo y pulsa **Download**. El archivo se crea en tu dispositivo.

Lo que ves en el lienzo es lo que contiene el archivo. El menú de formatos enumera solo lo que esta herramienta puede crear en este navegador.

Para la mayoría de los trabajos, uno de tres formatos es el adecuado:

| Para | Elige | Porque |
|---|---|---|
| Una pantalla, un mensaje o una diapositiva | **PNG** | Todas las apps lo abren, y mantiene el fondo transparente cuando la herramienta lo ofrece |
| Una página terminada, o cualquier cosa impresa | **PDF** | Un tamaño de página real que se imprime tal como se ve; **Print PDF**, donde una herramienta lo ofrece, es la versión CMYK para imprenta |
| Obras que deben mantenerse nítidas a cualquier tamaño | **SVG** | Formas vectoriales, nítidas desde una insignia hasta una valla publicitaria |

::: check Comprueba el archivo al tamaño en que se usará
Antes de enviarlo, ábrelo en la pantalla para la que se hizo, o imprímelo a su tamaño real.
:::

::: details Aprobaciones y entrega con Lolly Work (opcional)
Una [organización que opera Lolly Work](/info/organisation.html) puede gobernar qué formatos y ajustes de exportación ven sus miembros. Donde se exige aprobación, **Request approval** ocupa el lugar de **Download**. Sigue la política que muestre tu instancia.

Lolly Work también puede entregar un archivo a destinos S3, WebDAV y HTTP configurados, con pasos de aprobación, comprobantes de entrega y un registro de auditoría. Enviar un archivo a ese flujo lo manda al servicio de la organización; una descarga normal se queda en tu dispositivo. Los destinos de Send personales y la entrega de la organización se configuran por separado.

Los operadores lo configuran con la [guía de entrega de la organización](/info/work-delivery.html). Para renderizados y lotes de servidor en cola, consulta [CLI batch and automation](/info/cli-automation.html#organisation-jobs-with-lolly-work).
:::

## Cómo funciona la exportación

Cuando exportas, el lienzo de la herramienta se renderiza en el formato que elegiste y se te entrega como descarga, o se pone en tu portapapeles.

Tres caminos producen un archivo. La mayoría de las herramientas **renderizan el lienzo**. Los formatos de texto y datos (HTML, Markdown, TXT, JSON, CSV, ICS, VCF) se **generan a partir del contenido de la herramienta** en lugar de dibujarse desde la imagen. Las utilidades de privacidad como *Strip Hidden Data* **transforman el archivo que elegiste**, en tu dispositivo, y te lo devuelven sin lienzo, marca de agua ni metadatos añadidos, porque ya es tu propio archivo.

![Tres caminos de exportación convergen en un archivo terminado: renderizar el lienzo, generar texto o datos a partir del contenido, o transformar un archivo elegido en el dispositivo.](/info/diagrams/concepts/three-export-paths.svg)

El panel de exportación ofrece estas acciones. El autor de una herramienta elige cuáles aparecen; el conjunto predeterminado es Copy, Download y Save.

- <!--i:download--> **Download** guarda el archivo. Si luego no lo encuentras, consulta [Find a file you downloaded](/info/find-your-work.html#find-a-file-you-downloaded).
- <!--i:photos--> **Copy** pone la imagen en tu portapapeles, lista para pegar en un chat, un correo o un documento. Donde un navegador no puede copiar imágenes, la descarga en su lugar y te lo dice.
- <!--i:folder--> **Save** conserva el diseño actual en Projects con un clic y nunca descarga un archivo. **Save as**, junto a **Download**, pregunta dónde (consulta [Saving and continuing](/info/using.html#saving-continuing)).
- <!--i:link--> **Share** abre el diálogo Share: un enlace que reproduce el diseño, los interruptores de visita (pantalla completa, panel de exportación, descargar o copiar al abrir) y un **Shortest link** opcional que empaqueta todo el estado en un token compacto (consulta [URL Mode](/info/url-mode.html)).

![El panel de exportación - formato, tamaño y las acciones Copiar / Descargar / Guardar / Compartir](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26options&width=1440&height=900&dpi=192&waitMs=2000&format=svg&walker=1&dark=1&filename=export-panel)

Cuando un diseño incrusta el renderizado de otra herramienta, como un cuadro de imagen de Design con un enlace de QR Code, el renderizado anidado se dibuja en la exportación del padre. Sigue siendo vector verdadero en SVG y PDF y se rasteriza con nitidez en PNG, JPG y WebP. El renderizado incrustado no recibe marca de agua ni procedencia propia; solo el archivo terminado. Las exportaciones HTML, Markdown y TXT no pueden contener un renderizado compuesto.

## Elige un formato

El nombre del archivo y el menú de formato están juntos como un único par `name.format`, debajo de **Descargar**.

![El campo de nombre de archivo fusionado con el selector de formato, de modo que la exportación se lee como un único par name.format](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26options&width=1440&height=900&dpi=192&waitMs=2000&format=svg&cropSelector=.filename-extension&walker=1&dark=1&filename=exp-format-picker)

Parte de adónde va el archivo. Cada tarjeta enumera los formatos que convienen a ese destino; una herramienta muestra solo los que puede crear.

::: figure exporting-format-chooser
Seis destinos y los formatos que convienen a cada uno.
:::

Un logotipo tipográfico compuesto con la tipografía de tu design system se exporta como SVG con cada letra como trazado contorneado, de modo que un archivo sigue nítido al tamaño de una tarjeta de visita y al de una lona de edificio.

![Un logotipo tipográfico de trazo finísimo y mucho espaciado que dice Aurora, el tipo de ilustración vectorial pura a la que se refiere la fila SVG de la tabla](/t/url-shot?url=%2F%23%2Ftool%2Fwordmark%3Ftext%3DAurora%26weight%3D200%26tracking%3D16%26size%3D200%26full&width=1440&height=900&dpi=192&waitMs=2200&cropSelector=%23tool-canvas&walker=1&format=svg&filename=vt-wordmark-vector)

::: details Todos los formatos y para qué sirve cada uno
| Quieres | Usa | Por qué |
|---|---|---|
| Logotipos o ilustraciones nítidos que escalan | **SVG** | Vectorial: escalable, pequeño y editable; un efecto que la exportación vectorial no puede dibujar se incrusta como imagen |
| Vector para Office y aplicaciones de Windows | **EMF** | Se pega como vector editable en PowerPoint y Word, con texto vivo; Google Drive lo abre en Google Drawings |
| Vector para impresión y aplicaciones de diseño | **EPS**, o **EPS (CMYK)** | Vector PostScript para Illustrator y flujos de imprenta |
| Vector para máquinas de corte | **DXF** | Cortadoras láser, plóteres de vinilo y CNC: trazados de contorno en milímetros |
| Un deck de diapositivas editable | **PowerPoint** (PPTX) | Texto y formas nativos editables, con imágenes y vectores que se pueden extraer |
| Un documento de texto editable | **Word** (DOCX) u **OpenDocument** (ODT) | Párrafos y encabezados reales que un procesador de texto puede seguir editando (Doc Studio) |
| Una maqueta para InDesign | **InDesign IDML (static subset)** | Texto, rectángulos, óvalos e imágenes, un pliego por mesa de arte (Design) |
| Un documento de Penpot editable | **Penpot** | Tableros, formas, texto y tokens enlazados |
| Una foto o imagen de uso general | **PNG** (sin pérdida) o **JPG** (más pequeño) | Trama universal |
| Imágenes modernas más pequeñas | **WebP** o **AVIF** | Mejor compresión, con transparencia |
| Impresión | **PDF**, o **Print PDF** (CMYK) | Tamaño de página real; CMYK para imprenta |
| Trama de impresión para imprenta | **Print TIFF** (CMYK) | Píxeles DeviceCMYK para un RIP |
| Animado para la web | **GIF** | Se reproduce en todas partes; archivos más grandes |
| Animado con color completo y transparencia real | **APNG** | PNG animado: sin límite de paleta |
| Animado, archivo más pequeño | **Animated WebP** | Color completo y transparencia, más pequeño que GIF o APNG |
| Vector animado que escala | **Animated SVG** | Autocontenido; en bucle en un navegador o una `<img>`, a cualquier tamaño (Lottie Ad) |
| Una animación que sigue siendo editable | **dotLottie** | Formas, trazados y fotogramas clave de transformación exterior de la línea de tiempo de Design |
| Una entrega a Premiere | **Premiere XML + media** | Clips temporizados y medios originales para Premiere (Design) |
| Vídeo para redes sociales y compartir | **MP4** o **WebM** | La mejor calidad para el tamaño de archivo (consulta [Video](#video)) |
| Subtítulos | **SRT** o **VTT** | Texto temporizado para un reproductor de vídeo (Captions, Audiogram y Record) |
| Un curso de formación | **SCORM (LMS)** | Un sitio web con versión, paquete SCORM o xAPI (consulta [SCORM](#scorm-course-packages)) |
| Texto enriquecido o una firma de correo | **HTML** | Se pega con formato en los clientes de correo |
| Contenido simple | **MD** o **TXT** | Solo texto |
| Un evento de calendario | **ICS** | Se importa en cualquier aplicación de calendario |
| Una tarjeta de contacto | **VCF** | Se importa en las libretas de direcciones |
| Datos estructurados para reimportar | **JSON** o **CSV** | Recorre de ida y vuelta el contenido de la herramienta |
| Un favicon | **ICO** | Icono de sitio de varios tamaños; **ZIP** agrupa varios formatos |
:::

### Transparencia

Las herramientas que la admiten ofrecen un interruptor de fondo transparente, como **No BG**. PNG, WebP, AVIF, SVG, APNG y Animated WebP conservan la transparencia, y GIF conserva un borde duro. JPG y PDF son siempre opacos. TIFF se aplana sobre blanco, o sobre negro en el camino HDR descrito en [HDR](#hdr-bright-colours).

## Tamaño y unidades de impresión

Las exportaciones usan el tamaño de píxeles nativo de la herramienta a menos que la herramienta ofrezca **dimensions**. Entonces defines ancho, alto y una **unit**:

- **px** (el predeterminado) son píxeles exactos.
- **mm, cm, in, pt** y **pc** son tamaños físicos. Con una unidad física también defines los **DPI** (300 por defecto). Un **PDF** se convierte en una página real de ese tamaño, una **trama** recibe el número de píxeles para esos DPI y registra la resolución, y un **SVG** conserva la unidad física con un viewBox en píxeles.

Para una trama de mayor resolución, introduce un ancho y un alto mayores, o elige una unidad física y sube los DPI (píxeles = tamaño × DPI). Ancho `210`, alto `297` y unidad `mm` dan una página A4.

![La fila de dimensiones fijada a 210 por 297 mm, con el campo DPI revelado porque la unidad es física](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26w%3D210%26h%3D297%26unit%3Dmm%26format%3Dpdf%26options&width=1440&height=900&dpi=192&waitMs=2000&format=svg&cropSelector=.export-dims&walker=1&dark=1&filename=exp-export-dims)

## Fotogramas fijos de una composición temporizada

Una composición temporizada, como una línea de tiempo [Sequence](/info/sequence-editor.html) en Design, se mueve, así que una exportación fija tiene que elegir un instante: **el fotograma del cabezal**. Coloca el cabezal donde quieras la imagen y exporta.

Para más de un instante, el campo **Frames** aparece junto al tamaño de salida. Se muestra solo para una composición temporizada y un formato fijo (PNG, JPG, WebP, SVG o PDF). Déjalo en `1` para el fotograma del cabezal. Súbelo y obtienes ese número de imágenes fijas, repartidas por igual en toda la secuencia:

- PNG, JPG, WebP y SVG vuelven como un ZIP: `<name>-01.png`, `-02.png` y así sucesivamente.
- PDF vuelve como un documento con ese número de páginas.

Cada imagen fija sale del medio de su porción de la línea de tiempo, así que el primer fotograma nunca es una entrada a medio fundir y el último nunca es el instante vacío después de que terminen todos los clips.

::: figure exporting-contact-sheet
Frames: 4 corta la secuencia en cuatro porciones iguales y toma el medio de cada una.
:::

Úsalo para un storyboard, una hoja de contactos de revisión o un carrusel social extraído de una edición de vídeo. El número tiene un tope de 64, y cualquier otra cosa escrita en el campo vuelve a `1`. Cada fotograma es una imagen fija normal, así que las credenciales, el Imprint, las unidades físicas y los DPI se comportan como en una exportación. Un enlace de exportación, la CLI y MCP piden la misma hoja con `cuts=` (consulta [Contact sheets](/info/url-export.html#contact-sheets)).

## Muchos archivos a la vez

Lolly tiene tres maneras de trabajar en volumen, cada una para un trabajo distinto:

::: cols
## Una tabla se convierte en un documento
Una herramienta con una entrada de tabla, como **Battlecards**, convierte cada fila en una página. Pega una tabla de tu hoja de cálculo y obtén un PDF. Corrige filas en la hoja de cálculo y vuelve a pegar.
## Un CSV se convierte en un archivo por fila
**Batch** (`#/batch`) toma un CSV y renderiza una exportación por cada fila: credenciales o certificados, un archivo cada uno, entregados en un ZIP. Consulta [Batch](/info/batch.html#make-many-versions-of-one-design).
## Varios diseños reciben una edición
**Multi-edit** abre varias sesiones guardadas lado a lado para el mismo retoque en diseños distintos. Consulta [Multi-edit](/info/batch.html#edit-several-saved-designs-together).
:::

Desde **Projects**, **Render folder** exporta todas las sesiones guardadas de una carpeta y sus subcarpetas como un ZIP anidado, y **Render selection** hace lo mismo con cualquier selección múltiple; una sesión guardada se renderiza a su propio archivo. Una sesión guardada también se puede compartir de nuevo como enlace de herramienta desde Projects, que la reabre con los mismos ajustes.

## Archivos que siguen siendo editables en otro sitio

Algunos formatos entregan tu trabajo a otra aplicación como contenido editable y no como imagen.

### PowerPoint (PPTX)

Design, Markdown Slides, Booklet, Doc Studio, Chart, Diagrams, Flow Chart y Agenda exportan un deck de PowerPoint, una diapositiva por página. Cada página se descompone en objetos nativos, para que un colega pueda editar el deck y extraer recursos de él:

- <!--i:font--> El **texto** se convierte en cuadros de texto editables de PowerPoint con el tamaño de fuente, color, grosor, cursiva y alineación del diseño.
- <!--i:pentool--> Los **vectores** como logotipos e iconos se incrustan como imágenes SVG; siguen nítidos, y PowerPoint puede aplicarles *Convert to Shape*.
- <!--i:photos--> Las **imágenes** llegan a resolución nativa como imágenes propias. Una imagen principal recortada conserva la imagen completa tras el recorte, y cualquier filtro o mezcla sobre ella queda integrado.
- <!--i:layers--> Los **fondos, bordes y filetes** se convierten en formas de rectángulo y de línea.

![El panel de exportación con PowerPoint elegido: una diapositiva por página, texto y formas mantenidos editables](/t/url-shot?url=%2F%23%2Ftool%2Fdeck-studio%3Foptions&width=1440&height=900&dpi=192&waitMs=2500&drive=click%3A%5Bdata-fmt-trigger%5D%3Bwait%3A400%3Bclick%3A%5Bdata-fmt%3D%22pptx%22%5D%3Bwait%3A800&cropSelector=.export-popup&walker=1&format=svg&dark=1&filename=exp-pptx)

La maquetación es aproximada; el objetivo es el contenido reutilizable. Todo lo que el recorredor no puede expresar de forma nativa, como una región compleja con filtros o máscaras, se incrusta como imagen para que no se pierda nada. Un deck tiene un tamaño de diapositiva, tomado de la primera página.

PowerPoint también es una vía de entrada: [Rebrand a deck](/info/rebrand.html) pasa un deck a tu design system, e [Import a design](/info/design-import.html) abre uno en Design.

### Penpot

La mayoría de las herramientas que exportan SVG también exportan un **archivo Penpot** (`.penpot`), listo para seguir editando en Penpot.

| Lo que creaste | En Penpot |
|---|---|
| Texto | Objetos de texto editables: corrige una errata o cambia el estilo |
| Formas, trazados, degradados e imágenes | Sus propias formas vectoriales editables |
| Un color o fuente de un token del design system | Un enlace de token vivo: edita el token y cada forma que lo hereda lo sigue |
| Todo el diseño | Un componente reutilizable en el panel Assets |
| Una ilustración compleja o un lienzo en vivo | Incrustado por separado como imagen, con el contenido editable alrededor intacto |

Desde Design, cada marco se convierte en un tablero de Penpot. Los colores y tipografías del design system llegan al panel Assets y su conjunto completo de tokens al panel Tokens. Penpot conserva allí su propia copia: un token editado en Penpot vuelve mediante la importación en [Design System Setup](/info/brand-studio.html).

![El panel de exportación con Penpot elegido: el archivo .penpot, y Send to Penpot junto a la descarga](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26options&width=1440&height=900&dpi=192&waitMs=2000&drive=click%3A%5Bdata-fmt-trigger%5D%3Bwait%3A400%3Bclick%3A%5Bdata-fmt%3D%22penpot%22%5D%3Bwait%3A800&cropSelector=.export-popup&walker=1&format=svg&dark=1&filename=exp-penpot)

Para abrir el archivo, inicia Penpot, elige un proyecto y selecciona **Import**. Si has iniciado sesión en Penpot desde el panel de exportación, **Send to Penpot** hace ese paso por ti.

### Word, OpenDocument e InDesign

**Doc Studio** exporta **Word** (DOCX) y **OpenDocument** (ODT) con párrafos y encabezados reales.

**Design** exporta **InDesign IDML (static subset)**: texto, rectángulos, óvalos e imágenes PNG o JPEG, un pliego por mesa de arte. El formato en línea admitido sigue siendo editable, las imágenes viajan en `Links` y las coordenadas se convierten en puntos de InDesign. Volver a vincular, la sustitución de fuentes y los cambios de ajuste de texto pueden requerir atención. Los efectos, la animación, los textos compuestos y la geometría no admitida detienen la exportación con un informe que los enumera. IDML no conserva el documento original, así que envía PDF para el arte final.

### Líneas de tiempo: dotLottie y Premiere

Desde la línea de tiempo de Design, **dotLottie** escribe una animación que sigue siendo editable en herramientas Lottie; [Lottie animations](/info/sequence-editor.html#lottie-animations) enumera lo que conserva. **Premiere XML + media** empaqueta los clips temporizados y sus medios originales para Premiere; consulta [Premiere XML exchange](/info/sequence-editor.html#premiere-xml-exchange).

### SCORM (paquetes de curso)

La exportación de cursos está desactivada hasta que actives **Training and courses** en Settings → Preferences → Feature flags.

Luego elige **Export course** en una herramienta compatible, una carpeta de proyecto o una selección. En Design, elegir **SCORM (LMS)** y **Download** abre el mismo flujo de curso. Lolly guarda el trabajo, te permite revisar el contenido y el orden del curso, y luego abre el módulo y su diálogo de exportación.

- <!--i:layers--> Elige una versión para cada fuente: páginas fijas, movimiento como vídeo, audio o un recurso descargable. Añade texto de lección y alternativas de lectura en el módulo.
- <!--i:clock--> Previsualiza el reproductor del alumno y revisa descripciones y subtítulos. El movimiento se incluye como vídeo, incluida la animación silenciosa.
- <!--i:document--> Elige Website, SCORM 1.2, SCORM 2004 4th Edition o un destino xAPI experimental. Comprueba el contenido y el tamaño del ZIP, y luego guarda y descarga la versión comprobada.
- <!--i:check--> Para completarlo hay que reconocer todas las lecciones obligatorias y elegir Finish.

![El panel de exportación en una presentación de Design con SCORM (LMS) elegido](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Ftemplate%3Dfeature-tour%26format%3Dscorm%26options&width=1440&height=900&dpi=192&waitMs=3500&css=.fc-insp%7Bdisplay%3Anone!important%7D.edge-dock-slot--fill%7Bflex%3A1%201%20auto!important%3Bheight%3Aauto!important%3Bmax-height%3Anone!important%3Boverflow%3Avisible!important%7D.export-popup.is-floating%7Bheight%3Aauto!important%7D.export-popup-body%7Bmax-height%3Anone!important%3Boverflow%3Avisible!important%7D&drive=click:.edge-dock-tab%3Ahas-text%28%22Export%22%29;wait:600&cropSelector=.export-popup&walker=1&format=svg&dark=1&filename=exp-scorm)

El paquete contiene su contenido terminado y no necesita cuenta de Lolly. Pon un ZIP de Website en un host HTTP(S); importa un ZIP de LMS sin cambios. Prueba el destino antes de compartir el curso. Para un curso creado a partir de varias creaciones guardadas, consulta [Create a training course](/info/training-creators.html).

### DXF (archivos de corte)

Asset Export, Diagrams, Growth, Logo Wall, QR Code, Street Map, Wayfinding y Wordmark exportan **DXF**, el formato de intercambio AutoCAD R12 que leen las cortadoras láser, los plóteres de vinilo y el software CNC. La geometría se escribe como trazados de contorno en milímetros, el texto se contornea y el color se asigna al AutoCAD Color Index más cercano, que suele determinar la operación de la cortadora. DXF es solo arte lineal: una región fotográfica o con filtros no tiene trazado de corte y se descarta, con una advertencia. Usa SVG o PDF para conservar el contenido de trama.

Street Map es el caso más claro. Todo el diseño ya son trazos, así que cada calle y canal se convierte en un trazado de corte.

::: showcase
![Un render de Street Map de París en tinta sobre crema - arte lineal puro, así que cada trazo sobrevive el viaje a una cortadora](/t/url-shot?url=%2F%23%2Ftool%2Fstreet-map%3Fcity%3Dparis%26roadColor%3D1a1a2e%26waterColor%3D93c5fd%26background%3Dfaf7f2%26full&width=1440&height=900&dpi=96&waitMs=3200&cropSelector=%23tool-canvas&walker=1&format=svg&dark=1&filename=vt-street-map-cut)

Desplázate, y la cámara se aleja a través de la geometría real: siete rutas, ningún píxel en ningún lado, cada trazo nítido como un cabello a cualquier zoom. Ese es el mismo archivo que lee una cortadora.
:::

## Impresión

**Print PDF** escribe CMYK frente a una condición de prensa con nombre, **Coated FOGRA39** por defecto. Las muestras de marca con valores de tinta medidos se convierten exactamente; los demás colores usan una conversión de dispositivo estándar. **Print TIFF** escribe píxeles DeviceCMYK para un RIP y registra la misma condición de prensa en sus metadatos TIFF. El control Colour profile maneja ambos; [Colour profiles](#colour-profiles) tiene el detalle.

**Print marks & bleed** tiene su propia tarjeta en los formatos de impresión: el sangrado en milímetros más los detalles de Crop, Registration, Bleed, Colour bars y Stamp.

Algunas herramientas crean un **PDF de varias páginas**: una portada, contenido que fluye por tantas páginas como necesite y una contraportada, como en la herramienta *Booklet*. Cada página es una página PDF vertical real en A4, US Letter o A5, y puedes forzar que cualquier bloque empiece en una página nueva. Son documentos RGB sin marcas de corte ni sangrado, que pertenecen al Print PDF de una sola página. Un PDF de Design también puede ser un **Notes handout**: una página vertical por diapositiva con sus notas del orador debajo.

**Before you export.** Una tarjeta **Before you export** al pie del panel dice lo que está a punto de ver una imprenta: formato, tamaño y sangrado, áreas de corte y sangrado, cobertura de tinta, número de planchas y número de páginas, con un veredicto junto a su encabezado. Nunca bloquea una exportación. Design siempre muestra la tarjeta con sus propias comprobaciones, incluidas las normas internas del design system capa por capa y la señal de redacción del texto del documento ([Before you export](/info/design.html#before-you-export)), y añade estas comprobaciones de impresión cuando **Print preflight** está activado. En otras herramientas, activa **Print preflight** en Settings → Preferences → Feature flags; está desactivado por defecto, y un despliegue de Lolly Work puede activarlo para sus miembros.

**After you export.** Cuando el archivo está listo, Lolly lo vuelve a leer y lo compara con lo que elegiste: formato, tamaño en píxeles o de página, duración del clip, un fondo transparente, color CMYK, HDR, Content Credentials y una contraseña de PDF o ZIP. Todo lo que difiere se escribe en la tarjeta de exportación. Cada medición procede del archivo, nunca del ajuste, y una propiedad que el archivo no puede responder no se cuenta como coincidencia. La línea de comandos escribe la comparación completa con `--export-report` (consulta [Render with the CLI](/info/cli-rendering.html)).

Las comprobaciones del inspector de Design y la comparación de marca en Design System Setup son comprobaciones distintas: miran el diseño, mientras que estas dos tarjetas miran el archivo.

::: details Coste a partir de una tarifa
Bajo el preflight, una tarjeta de coste convierte los mismos recuentos en dinero, usando solo precios que alguien aportó. Lee esos recuentos incluso cuando la propia tarjeta de preflight está desactivada. Necesita dos cosas: un trabajo que una lista de precios pueda valorar (planchas, hojas, superficie, páginas, filas de variantes o archivos de salida, así que un simple PNG de logotipo nunca la muestra) y una **rate card**, una lista de precios JSON de tu imprenta. Una compilación predeterminada no lleva ninguna y no tiene forma de cargar una dentro de la aplicación. Una rate card llega como recurso de catálogo que distribuye un despliegue, o mediante la extensión opcional de rate card que activa quien autoalberga o un plano de control. Sin rate card, no se muestra nada.

Cada cifra es una tarifa que aportaste multiplicada por una cantidad que contó Lolly, como `4 plate × €35.00`, y el total lleva su origen: el emisor de la tarjeta y la fecha de sus tarifas. No hay moneda predeterminada ni precio de marcador. Lo que el archivo dice de sí mismo sigue siendo estilo indirecto: *"The file says: … Lolly has not verified this."*

Cuando una cifra no se puede calcular, la tabla se retira en lugar de rellenarse:

- Las líneas que la tarjeta no valora significan **ningún total**, solo un titular que dice cuántas quedan sin valorar.
- Una cantidad que es un máximo lleva **"up to"** a su subtotal.
- Las tarifas pasada su fecha de validez muestran **solo recuentos** hasta que pulsas *Use these rates anyway*; la fecha de caducidad acompaña entonces a la cifra.
- Abierta mediante un **enlace**, el dinero permanece oculto hasta que lo pides en este dispositivo. La CLI toma `--rate-card=<file.json>` como archivo local y nunca como parámetro de enlace.

La tarjeta se elimina de todas las etapas de exportación, así que nunca cambia el archivo. Es aritmética, no un presupuesto; solo tu imprenta puede presupuestar.
:::

## Movimiento y sonido

### Vídeo

Las herramientas animadas exportan **MP4** y **WebM**. El selector muestra solo los contenedores que este navegador puede crear, y un enlace compartido con `?format=` que pida uno que no puede crear recurre al otro, con un nombre de archivo coincidente. Las herramientas animadas también ofrecen **Start after**, que mantiene quieto el lienzo un momento para que las animaciones y las fuentes se asienten antes de grabar, y **Duration**, la duración del clip terminado. **Motion blur** (Off, Draft quality, Standard o High, con un **Shutter angle**) difumina el movimiento rápido a costa de tiempo de renderizado. Donde el navegador lo admite, **Record live** graba la vista previa en pantalla en tiempo real mediante una pantalla compartida.

![Los ajustes de tiempo de una exportación animada: Start after, Duration, Motion blur con su Shutter angle, y Record live](/t/url-shot?url=%2F%23%2Ftool%2Flottie-digi-ad%3Fformat%3Dmp4%26options&width=1440&height=900&dpi=192&waitMs=2500&cropSelector=.video-params&walker=1&format=svg&dark=1&filename=exp-video-settings)

**Quality** elige Smaller file, Balanced o Best quality. **Advanced** abre **Codec**, **Frame rate**, **Rate mode** y **Hardware acceleration**. Donde una herramienta tiene subtítulos, **Captions** elige una **Embedded track** o un **Sidecar .vtt + .srt** junto al vídeo. Un enlace lleva la calidad, el códec, la tasa de fotogramas, la duración y el retardo de inicio como `vq`, `codec`, `fps`, `seconds` y `wait` ([URL parameters](/info/url-parameters.html)).

Las exportaciones de vídeo conservan su sonido. Una herramienta puede colocar una **base musical** bajo el clip: un recurso de audio en bucle o recortado a la duración del clip, con fundidos, volumen y atenuación automática bajo el propio sonido de la grabación. Las herramientas de grabación llevan su audio en directo hasta el archivo.

Un deck de Design que sigue siendo un deck de clics aun así puede salir como vídeo. **Export slides as video** en el menú Present abre la hoja de exportación en MP4. Cada diapositiva se reproduce durante su propio tiempo de permanencia, o durante la Duration de la hoja de exportación cuando no tiene ninguno, y la transición de diapositivas del deck se reproduce entre ellas como un fundido. El documento en sí no cambia.

### Imágenes animadas

**GIF** se reproduce en todas partes y sirve para chat y correo; es más grande y tiene menos colores que el vídeo. **APNG** y **Animated WebP** conservan el color completo y la transparencia. **Lottie Ad** también exporta **Animated SVG**: fotogramas vectoriales con fotogramas clave CSS incrustados, de modo que escala a cualquier tamaño y se repite en una pestaña del navegador o en una `<img>` sin códec. Su texto se contornea y usa una tasa de fotogramas predeterminada más baja porque cada fotograma pesa más que un mapa de bits. Todos estos son silenciosos.

### Audio

Algunas herramientas exportan sonido por sí solo. **Voice Recorder** captura una toma de micrófono con un medidor de nivel en vivo y la guarda como **MP3**, **WAV**, **M4A (AAC)** u **Opus (WebM)**, codificado en tu dispositivo. `wav`, `mp3`, `m4a` y `opus` son ID de formato normales, así que una exportación de audio se puede compartir y automatizar tanto como un PNG.

El selector de recursos acepta una amplia gama de audio para una base musical, desde MP3 y FLAC hasta MIDI y módulos tracker; [Formats](/info/formats.html) los enumera. Una [canción de Rondocode](/info/rondocode.html) se reproduce con la duración que pida su clip.

## Color y HDR

Lolly lee todos los colores CSS modernos, hace sus cálculos de color de forma perceptual y escribe cada archivo en un espacio que un lector puede abrir: sRGB para pantallas, CMYK para impresión y Rec.2100 PQ para HDR. [Colour in the engine](/info/colour-engine.html) explica cómo. Un documento de Design configurado en **Wide colour / HDR** sigue sus propias reglas, descritas en [Wide colour and HDR editing](/info/hdr-editing.html).

### Perfiles de color

Las exportaciones se etiquetan con un perfil de color, para que las aplicaciones con gestión de color, como las imprentas, Photoshop y los navegadores, lean los colores tal como los viste. Esto ocurre automáticamente; las miniaturas y las vistas previas omiten la etiqueta para seguir siendo pequeñas.

- **PNG y JPG** llevan un perfil ICC **sRGB** incrustado, el espacio en el que se dibuja la vista previa. Los píxeles se etiquetan, no se recodifican.
- **Print PDF (CMYK)** declara su condición de prensa en su *OutputIntent*, indicando a una imprenta cómo deben leerse sus tintas CMYK.
- **Print TIFF (CMYK)** escribe píxeles DeviceCMYK sin etiquetar y registra la condición de prensa en sus metadatos TIFF. Un TIFF no puede incrustar un perfil de prensa, así que una fila **Embed** registra solo el nombre de ese perfil.
- **TIFF (RGB)** es el hermano sRGB sin comprimir para archivo o para un ida y vuelta con un editor. Aplana la transparencia sobre blanco. Ambos TIFF son solo de escritorio, porque los navegadores no pueden previsualizar un TIFF.
- **SVG**, **EMF**, **EPS** y **DXF** son vectores sin perfil incrustado: los colores de SVG son sRGB, EMF y EPS usan RGB de dispositivo, **EPS (CMYK)** escribe DeviceCMYK y DXF usa el AutoCAD Color Index. SVG, EPS y DXF contornean el texto a trazados. EMF mantiene el texto vivo y editable en Office y Google Slides, recurriendo a contornos solo para los tramos que el formato no puede expresar; la opción **Outline fonts** del panel de exportación fuerza trazados en todas partes. SVG también reproduce las sombras de caja de CSS, interiores y exteriores.

::: details PDF/X-4 y tu propio perfil de prensa
Lolly no incluye ningún perfil CMYK. Una condición de prensa con nombre escribe la intención de salida sin afirmar la conformidad con PDF/X-4, porque PDF/X-4 requiere el perfil incrustado.

Carga un perfil CMYK propio y elige su fila **Embed** en el control Colour profile. Se incrusta como el *DestOutputProfile* del archivo, y el PDF afirma PDF/X-4 siempre que el resto del archivo lo permita. La condición de prensa que declara se lee de ese perfil: un nombre registrado donde el perfil lo demuestra, o `Custom` bajo el propio nombre del perfil.

Tres cosas retienen la afirmación mientras conservan la intención de salida: arte RGB que la pasada CMYK no pudo convertir, el texto de crédito de margen de prueba `prov` (dibujado con una fuente estándar que no está incrustada) y una contraseña **Strong**, ya que PDF/X-4 prohíbe el cifrado. Todo PDF también lleva metadatos PDF/X-4: cajas de página, XMP, un ID de documento y una intención de salida sRGB con su perfil.
:::

### HDR (colores brillantes)

Esta es la tarjeta **HDR** del panel de exportación, que aviva el arte ordinario para pantallas HDR. Conservar los originales HDR durante la edición es una función distinta: [Wide colour and HDR editing](/info/hdr-editing.html).

Una exportación ordinaria es sRGB: un color de marca saturado es tan brillante como el blanco normal de la pantalla. Una pantalla HDR tiene margen por encima de eso. La tarjeta **HDR** impulsa los colores de tu marca y el texto blanco hacia el brillo máximo, mientras las zonas oscuras siguen oscuras y dan contraste al resplandor.

![La tarjeta HDR en el panel de exportación, activada, con los diales White / Reach / Dark lift / Focus revelados debajo](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26format%3Dpng%26hdr%3D1%26options&width=1440&height=900&dpi=192&waitMs=2000&format=svg&cropSelector=.export-hdr&walker=1&dark=1&filename=exp-hdr-card)

- **Formatos.** PNG, JPG, AVIF y TIFF. WebP es de 8 bits sin camino de decodificación HDR funcional, y los vectores y el PDF no tienen modelo HDR.
- **Desactivado por defecto**, porque cambia los píxeles. Marca la tarjeta, o pasa `hdr=1` en un enlace compartido.
- **Los diales.** **White** (el techo de brillo máximo, de 400 a 2000 nits), **Reach** (hasta dónde se extiende el resplandor por los tonos), **Dark lift** (cuánto se aclaran los oscuros; `0` los mantiene oscuros) y **Focus** (cuánta riqueza de color conserva el impulso). Viajan como un solo valor: `hdr=1600-60-0-50` es White 1600, Reach 60, Dark lift 0 y Focus 50.
- **Qué se escribe.** PNG obtiene Rec.2100 PQ de 16 bits con un fragmento `cICP`. JPG es un JPG con mapa de ganancia ISO 21496-1: una imagen SDR normal más un mapa de ganancia añadido. AVIF obtiene un cuadro `colr` reescrito. TIFF obtiene píxeles PQ con un perfil ICC v4 generado que lleva una etiqueta `cicp`, y se aplana sobre negro, porque el blanco es el código de 10 000 nits en PQ y rodearía cada borde con un halo. El impulso sigue la luminosidad perceptual (OKLab) y conserva el matiz, así que un verde de marca se vuelve más brillante, no menta.
- **Dónde se ve el resplandor.** En visores con gestión de color en una pantalla HDR: Preview, Quick Look y Safari en dispositivos Apple, o Chrome en un monitor HDR. Una pantalla SDR muestra una imagen normal.
- **Antes de publicar.** Muchas plataformas recodifican las subidas y eliminan la señal HDR, lo que puede dejar la imagen oscura o apagada. Usa HDR donde controlas el destino, como tu propio sitio, una videowall o un deck en un panel brillante.
- **Desde la terminal.** `--hdr=1` con `--export=png` o `--export=jpg` escribe el mismo PNG y JPG con mapa de ganancia en la [CLI](/info/cli.html), con los mismos codificadores del motor, sin ningún navegador en el camino. AVIF y TIFF siguen siendo exportaciones web por ahora.

## Lo que viaja con tu archivo

Un archivo terminado puede llevar varios registros además de la imagen. Algunos van junto a los píxeles y desaparecen cuando el archivo se vuelve a guardar o se despoja de ellos; dos marcas viven en los propios píxeles.

::: figure exporting-what-travels
Dónde vive cada registro, si está activado por defecto y qué parámetro de enlace controla cada uno.
:::

El panel de exportación pliega **Licence**, **Source credits**, *Password protect*, **C2PA Credentials**, el **Lolly Imprint** y la **Durable credential** en un solo grupo **Content protection** que muestra solo las tarjetas que puede usar el formato elegido. Se abre solo cuando un enlace o documento ya declara una licencia, o cuando una fuente necesita una decisión tuya. La tarjeta **Design system** queda fuera del grupo, a la vista en cada exportación.

![El grupo Content protection abierto en una exportación PNG, mostrando solo las tarjetas que le aplican](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26format%3Dpng%26imprint%3D1%26options&width=1440&height=900&dpi=192&waitMs=2000&walker=1&format=svg&cropSelector=.export-protection&dark=1&filename=exp-content-protection)

### Procedencia y marca de agua

Donde el formato tiene los campos, las exportaciones llevan **metadatos de procedencia**: el software, la fuente, el nombre de la herramienta y la línea de crédito de tu perfil, escritos en iTXt de PNG, EXIF de JPEG, info de PDF, `<metadata>` de SVG o un comentario de GIF. Registra solo la autoría, y no se sube nada. Las herramientas **Experimental** también estampan una marca de agua visible, aplicada por el host para que editar la herramienta no pueda quitar la marca.

**El Lolly Imprint** es una marca de agua invisible en los píxeles, **activada por defecto**. La credencial y los metadatos viajan junto a los píxeles y se pierden al volver a guardar, hacer una captura o eliminar metadatos. El Imprint vive en los píxeles y sobrevive a la recompresión, así que una copia todavía se puede reconocer como hecha con Lolly. Es una pista y no una garantía criptográfica, y no lleva datos personales. Viaja en JPEG XL, PNG, JPG, WebP, AVIF, TIFF y BMP, y en las tramas que Lolly renderiza dentro de un PDF o PPTX, nunca en una imagen que tú incrustaste. Desmarca **Lolly Imprint** o pasa `imprint=0` para dejar fuera el Imprint. La supervivencia de AVIF a la recodificación aún no está calibrada. [Verify](/verify) lo detecta en tu dispositivo; consulta [The Lolly Imprint](/info/what-verify-checks.html#the-lolly-imprint).

**La Durable credential** escribe el ID de Lolly en los píxeles con un modelo neuronal en el dispositivo en el formato TrustMark, de modo que el enlace "made with Lolly" sobreviva a la eliminación de metadatos y a una recodificación y pueda leerse con herramientas compatibles con TrustMark. Está **desactivada por defecto**, porque cuesta una pasada neuronal por exportación y una descarga única del modelo. Cubre PNG, JPG, WebP, AVIF y TIFF; márcala en el panel o pasa `durable=1`. Las aplicaciones de escritorio y móviles ocultan la tarjeta, porque no tienen un origen del que descargar el modelo sin conexión.

**Licence.** Elige cómo pueden usar otros tu trabajo: *None (all rights reserved)* por defecto, CC0 1.0, la Public Domain Mark 1.0, o una licencia Creative Commons 4.0 (BY, BY-SA, BY-NC, BY-NC-SA, BY-ND, BY-NC-ND). El nombre de la licencia y un enlace a su resumen pasan a los metadatos de licencia del archivo (EXIF, XMP y RIFF donde el formato los tiene) y a su Content Credential. La elección se guarda con el documento y viaja en un enlace como `licence=`. Lolly escribe la licencia que elegiste; no comprueba ni hace cumplir los términos. Una herramienta con su propio campo de licencia, como Claim, conserva ese campo.

### El registro del design system

Una exportación registra el design system que creó el archivo: su nombre, la versión publicada de la que se dibujó (cuando no es la versión de trabajo) y la [colourway](/info/colourways.html) en que se dibujó. Cualquier otra opción de tema que declare un design system, como una densidad, se registra del mismo modo. La opción de claro u oscuro se deja fuera, porque la imagen ya muestra cuál se usó.

**Ves el registro antes de que se escriba nada.** La tarjeta **Design system**, marcada por defecto, muestra las palabras exactas que llevará el archivo, como *Records: Acme · Colourway: Beach*, y la descripción tal como se leerá. El nombre de un design system es lo que escribieron sus propietarios, así que la tarjeta lo muestra tal como está escrito. Desmarca la tarjeta para dejar el registro fuera de esa exportación. El panel de documento de Design enumera las mismas palabras bajo *Embedded in exports*.

**La descripción da la colourway junto a la herramienta.** Con la tarjeta marcada, *"Made with https://lolly.tools : Chart"* pasa a ser *"Made with https://lolly.tools : Chart (Beach colourway)"*. El nombre propio del design system se queda en el registro, no en la descripción. Una descripción sin nombre de herramienta, o una que una herramienta escribe a partir de sus propias entradas, se deja como está. Una herramienta que ignora las colourways mediante `tokenAxes` no registra ninguna, y el crédito de prueba en PDF (la marca de impresión `prov`) sigue la misma regla.

**Brand skills que guiaron a un agente.** Cuando un agente creó la pieza y nombró las [brand skills](/info/brand-skills.html) que leyó y siguió, el registro también enumera cada skill con su revisión, como *Guided by: acme-brand 1.0*. Las palabras significan que la skill guió el trabajo. No son una comprobación: Lolly no prueba la pieza frente a una skill. Solo la propia declaración del agente añade la lista, lo que hoy significa el argumento `brandSkills` de `lolly_render` del [servidor MCP](/info/mcp.html), así que una pieza creada en la aplicación o desde un enlace compartido no lleva ninguna. La Content Credential guarda la lista como `brandSkills`, un valor JSON con el ID, nombre, revisión y hash SHA-256 de cada skill. El paquete XMP y los metadatos SVG guardan el mismo valor como `lolly:BrandSkills`, un PDF escrito a partir del registro gana una palabra clave por skill y la descripción se queda como estaba. Una skill interna se registra por su ID, nombre, revisión y hash, nunca por su texto. Los mismos interruptores dejan fuera la lista junto con el resto del registro: la tarjeta **Design system**, `_madewith=0`, `--no-madewith` y `madeWith: false`. Cuando el servidor MCP dibuja el archivo en un navegador (un PDF, un JPEG y los demás formatos que su camino sin navegador no puede escribir), los metadatos del propio archivo no guardan lista y solo una Content Credential puede guardarla. Pasa `c2pa` para conservar el registro; sin credencial, el renderizado avisa de que las brand skills no se registraron.

**Leer el registro de vuelta.** [Verify](/verify) enumera el registro como **Design system** en los detalles de credencial de un archivo, y las brand skills como **Guided by**. *Recreate with these settings* reabre la herramienta en la versión y colourway registradas. El enlace se abre con el design system registrado cuando este dispositivo tiene uno con el mismo ID y nombre; si no, se abre con tu design system activo.

::: details Qué se escribe dónde, y qué ejecuciones dejan fuera el registro
| Dónde | Qué se escribe |
|---|---|
| Content Credential | `designSystem` (el ID), `designSystemLabel`, `designVersion` y `themes` en la aserción `tools.lolly.export`, cada uno un valor de texto simple; `themes` es una lista JSON de las opciones |
| PNG, JPEG, WebP y JXL | Los mismos cuatro valores como propiedades `lolly:` del paquete XMP del archivo, en el espacio de nombres `https://lolly.tools/ns/export/1.0/` |
| SVG | Las mismas propiedades `lolly:` dentro del bloque `<metadata>` |
| PDF | Palabras clave como *Design system: Acme* y *Colourway: Beach* |
| Todos los formatos con campo de descripción | La descripción, con la colourway junto a la herramienta |

La tarjeta aparece solo cuando hay algo que registrar y el formato puede contener el registro. CSV, JSON, un archivo de calendario y otros formatos de texto o datos no contienen metadatos, y EPS, EMF, DXF y BMP no tienen campo para el registro. HTML, Markdown y CSS guardan el registro solo en su Content Credential, así que para ellos la tarjeta no muestra línea de descripción y se oculta mientras **C2PA Credentials** está desactivado. Un campo que el design system no da se queda fuera del archivo.

Un enlace compartido desactiva el registro con `_madewith=0` ([URL parameters](/info/url-parameters.html)); la línea de comandos acepta `--no-madewith`, `lolly_render` del [servidor MCP](/info/mcp.html) acepta `madeWith: false`, y el panel de exportación de la aplicación de terminal tiene una fila **Design system**. La línea de comandos imprime en la salida de error estándar las palabras que lleva un archivo terminado, para un renderizado de herramienta y para cada archivo que `lolly run` exporta desde una sesión guardada de Design, y un renderizado MCP las imprime junto al archivo, ambos leídos de vuelta del archivo. Un PNG que la línea de comandos dibuja sin navegador no lleva metadatos de archivo, así que su registro viaja solo en la credencial. Las utilidades en el dispositivo no añaden ningún metadato.

Las ejecuciones sin tarjeta **Design system** dejan fuera el registro: una ejecución de Batch, una carpeta exportada desde Projects y una exportación de colección 3D, y en la aplicación de terminal un lote CSV, una exportación de carpeta o selección de Projects y la vista de renderizar todo. Exporta un archivo desde la herramienta para registrar el design system.
:::

### Content Credentials (C2PA)

Las exportaciones pueden llevar **Content Credentials**: un manifiesto [C2PA](https://c2pa.org) firmado que registra qué creó el archivo, cuándo y dónde, vinculado a un hash de los bytes del archivo para que cualquier edición posterior sea detectable. La especificación la publica la C2PA, y Lolly escribe manifiestos estándar que cualquier lector C2PA puede inspeccionar.

![La tarjeta C2PA Credentials, marcada, con la duración de la credencial junto a la casilla](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26format%3Dpng%26c2pa%3D30%26options&width=1440&height=900&dpi=192&waitMs=2000&format=svg&cropSelector=.export-c2pa%5Bdata-c2pa-only%5D&walker=1&dark=1&filename=exp-c2pa-card)

- **Activado por defecto.** La tarjeta **C2PA Credentials** viene preseleccionada en casi todas las herramientas. Desmárcala para una exportación, o pasa `c2pa=off` en un enlace. Una herramienta puede excluirse en su manifiesto.
- **Formatos.** PDF (RGB e impresión), PNG y APNG, JPG, GIF, SVG, TIFF (RGB e impresión), WebP (fijo y animado), AVIF, MP4, WebM, los contenedores de audio MP3, WAV, M4A, OGG/Opus y FLAC, y HTML, Markdown y CSS. Un ZIP estampa cada miembro compatible, que es como un Animated SVG obtiene una. MP4, AVIF y M4A usan el enlace BMFF estándar y MP3 su asignación ID3v2, así que `c2patool` y otros lectores los verifican. WebM y OGG/Opus aún no tienen asignación estándar, así que Lolly lleva el manifiesto como un adjunto de Matroska y un campo OpusTags, que comprueba el propio verificador de Lolly. ICO, EPS, EMF, DXF, BMP, PPTX, los formatos de Office y los demás formatos de texto y datos no tienen contenedor C2PA.
- **Qué registra.** La herramienta y la aplicación que crearon el archivo, la hora de la firma, el shell que lo exportó, el [design system y la colourway](#the-design-system-record) mientras la tarjeta **Design system** está marcada, y huellas de las entradas activas. El texto de las entradas, los campos vinculados al perfil, los controles inactivos, las versiones del navegador y los datos del sistema operativo se dejan fuera. Tu nombre y correo aparecen como autor solo cuando **Use my details to create** está activado en Settings → Preferences → Your details. Las fuentes que coloca una exportación viajan como ingredientes: [obras acreditadas](#source-credits) como emojis, y [canciones de Rondocode](/info/rondocode.html#songs-in-the-credential) en una exportación de vídeo o audio.
- **Qué ven los destinatarios.** Las herramientas C2PA como las aplicaciones de Adobe, `c2patool` y contentcredentials.org/verify leen el manifiesto y muestran la declaración. Lolly firma con una clave creada en tu dispositivo, no con un certificado de una lista de confianza, así que los visores informan de una credencial *unverified*: la estructura y la evidencia de manipulación son reales, el firmante no está avalado. Para cambiarlo, registra una **verified identity** en Settings → Preferences → Content Credentials; consulta [Content Credentials Identity](/info/content-credentials-identity.html).
- **Comprobar un archivo.** Suelta cualquier archivo en [Verify](/verify), o ejecuta `lolly validate <file>`, para un informe en el dispositivo que empieza por si Lolly creó el archivo y si ha cambiado desde entonces. Verify también mira más allá de la credencial; consulta [What Verify checks](/info/what-verify-checks.html).
- **Privacidad.** La clave de firma se crea para la exportación y nunca sale de tu dispositivo, y la declaración contiene solo lo que ya llevan los metadatos de procedencia. Las utilidades de privacidad que transforman tus propios archivos no añaden credencial, y *Strip Hidden Data* elimina un manifiesto C2PA como cualquier otro metadato. La utilidad Rondocode crea audio nuevo, así que firma lo que escribe ([Rondocode songs](/info/rondocode.html#files-from-the-rondocode-utility)).
- **Interacciones.** Un PDF protegido con contraseña no puede llevar Content Credentials, en ninguno de los dos niveles. La credencial se añade en último lugar, sobre los bytes terminados, después de los DPI, EXIF, perfil de color, metadatos PDF/X y marcas de impresión.

### Créditos de origen

Una exportación que coloca el trabajo de otra persona registra esa fuente en la credencial. Un emoji dibujado del conjunto de emojis elegido es el caso cotidiano: la obra, su creador, la licencia, de dónde vinieron los bytes exactos y qué cambió viajan con el archivo. El texto de una herramienta cuya plantilla es un SVG conserva los emojis propios del sistema, así que allí no se acredita nada. La fila **Source credits** dice lo que las fuentes piden de la entrega antes de que descargues, y tras la descarga lee de vuelta los bytes entregados antes de decir que los créditos están en el archivo. Una licencia que te pide elegir, como un glifo CC BY-SA recoloreado que estás a punto de compartir, recibe una tarjeta con las opciones; la descarga nunca se bloquea. [Creative rights and credits](/info/creative-rights.html) tiene la redacción, las licencias revisadas y lo que sigue siendo tuyo.

## Protección con contraseña

Dos tipos de bloqueo, ambos creados en tu dispositivo. La tarjeta *Password protect* del panel de exportación maneja ambos.

![La tarjeta Password protect desplegada en una exportación de PDF, con el campo de contraseña y los dos niveles de bloqueo](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26format%3Dpdf%26password%3Ddemo%26options&width=1440&height=900&dpi=192&waitMs=2000&walker=1&format=svg&cropSelector=.export-pdfpass&dark=1&filename=exp-pdf-password)

**Una contraseña de apertura de PDF** tiene dos niveles una vez que escribes una contraseña:

- **Weak**: RC4 de 40 bits, un elemento disuasorio más que una protección. Su contraseña puede viajar en un enlace compartido, en texto claro. Solo `pdf` RGB.
- **Strong**: AES-256 (PDF 2.0). Se escribe al exportar y nunca se pone en un enlace. También se aplica a los PDF de impresión y a cada PDF dentro de un ZIP por lotes. Un PDF de impresión con bloqueo Strong conserva su CMYK, marcas e intención de salida pero abandona la afirmación PDF/X-4.

**Un ZIP bloqueado** cubre una exportación ZIP, una descarga de carpeta desde Projects o un lote, con una contraseña en dos niveles: **Weak** (ZipCrypto, un elemento disuasorio; puede viajar en un enlace `?password=`) o **Strong** (AES-256, escrito al exportar, nunca en un enlace). La contraseña protege a cada miembro, y cualquier PDF de dentro también se bloquea por su cuenta con AES-256, de modo que sigue bloqueado tras descomprimir el ZIP. El aviso aparece cuando empieza la descarga; una contraseña en blanco significa sin bloqueo.

**Un enlace compartido protegido con contraseña** pide una contraseña al destinatario antes de abrirse. Todo el estado del enlace se cifra con AES-256 bajo una clave derivada de la contraseña (PBKDF2), de modo que solo viaja texto cifrado y el descifrado ocurre en el navegador del destinatario. El servidor que sirve el enlace nunca ve la contraseña ni el diseño. Actívalo en el diálogo **Share**. Un enlace cifrado se abre solo en Lolly, nunca como imagen incrustada. Consulta [URL Mode](/info/url-mode.html).

## En un teléfono

Los controles de exportación están tras el botón flotante **Export**, que abre la hoja **Export**: los mismos formatos, tamaño, copiar, descargar y compartir, dimensionados para el tacto.

## ID de formato para enlaces y la CLI

Estos son los valores del parámetro de URL `format=` y del indicador de la CLI `--export=` (consulta [URL parameters](/info/url-parameters.html) y [CLI](/info/cli.html)). El menú de una herramienta muestra solo los formatos que esa herramienta puede crear, así que siempre es más corto que esta lista.

| Tipo | ID |
|---|---|
| Trama | `png` · `jpg`/`jpeg` · `webp` · `avif` · `jxl` · `jxl-lossless` · `tiff` (TIFF RGB) · `cmyk-tiff` (Print TIFF) · `bmp` · `ico` |
| Vector | `svg` · `svgz` (SVG comprimido con gzip) · `emf` · `wmf` · `eps` · `eps-cmyk` (EPS CMYK) · `dxf` (archivo de corte) |
| Página y documento | `pdf` · `pdf-cmyk` (Print PDF) · `pptx` (PowerPoint) · `docx` (Word) · `odt` (OpenDocument Text) · `idml` (InDesign) · `penpot` (archivo de diseño de Penpot) · `scorm` (paquete de curso, un ZIP) |
| Movimiento | `gif` · `apng` (PNG animado) · `webp-anim` (WebP animado) · `svg-anim` (SVG animado) · `webm` · `mp4` · `lottie` (dotLottie) · `premiere-xml` (Premiere XML + media) |
| Audio | `wav` · `mp3` · `m4a` · `aac` · `opus` · `ogg` · `flac` |
| Texto y datos | `html` · `md` · `txt` · `json` · `csv` · `ics` · `vcf` · `srt` · `vtt` · `css` · `scss` · `gpl` (paleta de GIMP) |
| Paquetes y bundles | `zip` · `rpm` y `tar.gz` (el renderizado sellado en un paquete de Linux) |

Unos pocos ID proceden del propio código de exportación de una herramienta: `ase` (Adobe Swatch Exchange, de Palette Lab) y `exr` y `hdr` (tramas de alto rango dinámico, de Darkroom). **Convert Font** escribe `ttf`, `otf` y `woff` a partir de un archivo de fuente que aportas, así que un enlace simple no tiene nada que renderizar para ella.
