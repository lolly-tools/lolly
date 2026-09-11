# Exportar y formatos

Cómo obtener un archivo terminado desde una herramienta - elegir el formato correcto, ajustar el tamaño de salida y qué hace cada opción. Como todo lo demás, **la exportación ocurre en tu dispositivo**; no se sube nada.

## Cómo funciona la exportación

La vista previa *es* el archivo. Al exportar, el host renderiza ese lienzo al formato que elegiste y te entrega una descarga (o lo pone en tu portapapeles). Una herramienta solo ofrece los formatos que declaró su autor, y el selector oculta cualquiera que tu navegador no pueda producir (ver [Video](#video)).

Tres rutas producen un archivo. La mayoría de las herramientas **renderizan el lienzo** al formato elegido. Los formatos de texto y datos (HTML, MD, TXT, JSON, CSV, ICS, VCF) se **generan a partir del contenido de la herramienta**, en lugar de rasterizarse desde la imagen. Y las utilidades de privacidad (p. ej. *Strip Hidden Data*) usan una tercera ruta: el archivo que *tú* eliges se transforma byte a byte en el dispositivo y se devuelve tal cual - sin lienzo, sin marca de agua y sin añadir metadatos de procedencia, porque ya es tu propio archivo.

Las acciones en los controles de exportación:

- <!--i:download--> **Descargar** - guarda el archivo (la acción principal).
- <!--i:photos--> **Copiar** - pone la imagen en tu portapapeles para pegarla directamente en Slack, correo o un documento. Cuando un navegador no puede copiar imágenes, descarga en su lugar y te lo indica.
- <!--i:folder--> **Guardar** - conserva el diseño actual como una sesión de herramienta guardada en tu biblioteca.
- <!--i:link--> **Compartir** - abre el **diálogo de compartir**: un enlace copiable que reproduce el diseño, opciones de activación al visitar (pantalla completa, panel de exportación, descarga o copia al abrir) y un **enlace más corto** opcional que empaqueta todo el estado en un token compacto (ver [Modo URL](/info/url-mode.html)).

(El autor de una herramienta elige cuáles de estas aparecen; el conjunto predeterminado es Copiar, Descargar y Guardar.)

![El panel de exportación - formato, tamaño y las acciones Copiar / Descargar / Guardar / Compartir](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26options&width=1440&height=900&dpi=192&waitMs=2000&format=svg&walker=1&dark=1&filename=export-panel)

Compartir se abre sobre la herramienta, con el enlace ya construido y las opciones de activación al visitar debajo.

### Renderizar varios a la vez

Una sola exportación es un archivo, pero puedes renderizar **varios** en una sola pasada - cada uno entregado como un `.zip`:

- <!--i:folder--> **Proyectos → Renderizar carpeta** exporta cada sesión guardada de una carpeta (y sus subcarpetas) como un único zip anidado; **Renderizar selección** hace lo mismo para cualquier selección múltiple; una sola sesión guardada se renderiza directamente a su propio archivo. No hace falta Batch/Pro - ver [Usar Lolly → Proyectos](/info/using.html).
- <!--i:layers--> **Batch (Pro)** renderiza una cuadrícula de conjuntos de entradas - todas las variantes de una plantilla a la vez.

Una sesión guardada también se puede volver a compartir como un enlace de herramienta desde Proyectos (reconstruye la URL de la herramienta a partir de las entradas guardadas), así que un enlace la reabre con exactamente los mismos ajustes.

## Elegir un formato

El campo de nombre de archivo y el selector de formato están en la parte superior del panel como un único par `nombre.formato`, y el selector solo lista los formatos que declaró el autor de esta herramienta.

![El campo de nombre de archivo fusionado con el selector de formato, de modo que la exportación se lee como un único par name.format](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26options&width=1440&height=900&dpi=192&waitMs=2000&format=svg&cropSelector=.filename-extension&walker=1&dark=1&filename=exp-format-picker)

| Quieres… | Usa | Por qué |
|---|---|---|
| Logos / obras artísticas nítidas y escalables | **SVG** | Vectorial - infinitamente escalable, ligero, editable |
| Vector para Office / apps de Windows | **EMF** | Se pega como vector editable en PowerPoint / Word; el texto sigue siendo editable, y Google Drive lo abre en Google Dibujos para Presentaciones |
| Vector para impresión / apps de diseño | **EPS**, o **EPS (CMYK)** | Vector PostScript para Illustrator / flujos de imprenta |
| Vector para corte / máquinas CAD | **DXF** | Cortadoras láser, plotters de vinilo, CNC - rutas de contorno en milímetros |
| Una presentación editable | **PowerPoint** (PPTX) | Texto y formas nativas editables, con imágenes y vectores que se pueden extraer |
| Un curso que un LMS pueda importar | **SCORM** (LMS) | Un zip con el manifiesto, una página de lanzamiento, las diapositivas y la película narrada con subtítulos - a partir de una presentación de Design |
| Un documento de texto editable | **Word** (DOCX) u **OpenDocument** (ODT) | Párrafos y encabezados reales que un procesador de texto puede seguir editando (Doc Studio) |
| Una foto o imagen de propósito general | **PNG** (sin pérdida) o **JPG** (más pequeño) | Raster universal |
| Imágenes modernas más pequeñas | **WebP** / **AVIF** | Mejor compresión, alfa |
| Impresión | **PDF**, o **Print PDF** (CMYK) | Tamaño de página real; CMYK para imprenta |
| Raster de impresión para una prensa | **Print TIFF** (CMYK) | Píxeles DeviceCMYK para un RIP |
| Animado para la web | **GIF** | Funciona en todas partes, archivos más grandes |
| Animado con color completo + alfa real | **APNG** | PNG animado - sin límite de paleta, transparencia verdadera |
| Animado, archivo más pequeño | **WebP animado** | Color completo + alfa, mejor comprimido que GIF o APNG |
| Vector animado que escala | **SVG animado** | Autocontenido; se repite en un navegador o `<img>`, sin códec, cualquier tamaño |
| Video para redes sociales / compartir | **MP4** o **WebM** | Mejor calidad por byte (ver más abajo) |
| Texto enriquecido / firma de correo | **HTML** | Se pega formateado en clientes de correo |
| Contenido plano | **MD** / **TXT** | Solo texto |
| Un evento de calendario | **ICS** | Se importa en cualquier app de calendario |
| Una tarjeta de contacto | **VCF** | Se importa en Contactos / libretas de direcciones |
| Datos estructurados para reimportar | **JSON** / **CSV** | Hace round-trip con el contenido de la herramienta |
| Un favicon | **ICO** | Icono de sitio multi-tamaño (**ZIP** agrupa varios formatos) |

La primera fila es el caso común. Un logotipo tipográfico compuesto en la tipografía de tu marca se exporta como SVG, donde cada letra es una ruta perfilada en lugar de un píxel, así que se mantiene nítido tanto a tamaño de tarjeta de visita como a tamaño de vinilo de fachada, desde el mismo archivo.

![Un logotipo tipográfico de trazo fino y tracking amplio que dice Aurora, el tipo de obra puramente vectorial de la que trata la fila SVG de la tabla](/t/url-shot?url=%2F%23%2Ftool%2Fwordmark%3Ftext%3DAurora%26weight%3D200%26tracking%3D16%26size%3D200%26full&width=1440&height=900&dpi=192&waitMs=2200&cropSelector=%23tool-canvas&walker=1&format=svg&dark=1&filename=vt-wordmark-vector)

## Tamaño y unidades de impresión

Por defecto, las exportaciones usan el tamaño en píxeles nativo de la herramienta. Cuando una herramienta expone **dimensiones**, puedes fijar ancho × alto y una **unidad**:

- **px** (predeterminado) - píxeles exactos.
- **mm · cm · in · pt · pc** - tamaños físicos/de impresión. Con una unidad física también fijas el **DPI** (predeterminado **300** para impresión); el motor convierte correctamente según el formato - **PDF** se convierte en una página real a ese tamaño, el **ráster** se renderiza con el número de píxeles correcto para el DPI (e incrusta la resolución), **SVG** conserva la unidad física con un viewBox en px.

Para obtener un ráster de mayor resolución, introduce un ancho/alto mayor, o elige una unidad física y sube el DPI (píxeles = tamaño × DPI). No hay un interruptor de escala de un solo clic.

Ejemplo: ancho `210`, alto `297`, unidad `mm` → una página A4.

![La fila de dimensiones fijada a 210 por 297 mm, con el campo DPI revelado porque la unidad es física](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26w%3D210%26h%3D297%26unit%3Dmm%26format%3Dpdf%26options&width=1440&height=900&dpi=192&waitMs=2000&format=svg&cropSelector=.export-dims&walker=1&dark=1&filename=exp-export-dims)

## Fotogramas fijos de una composición temporizada

Una **composición temporizada** - una línea de tiempo de [Secuencia](/info/using.html#timeline-sequence) en Design, o cualquier artboard controlado por línea de tiempo - es algo en movimiento, así que una exportación fija tiene que responder "¿qué momento?". La regla es la que esperarías: **el fotograma en la posición del cabezal**. Coloca el cabezal donde quieras la imagen y exporta; lo que ves es lo que obtienes.

Cuando quieres más de un momento, el campo **Fotogramas** aparece junto al tamaño de salida (solo para una composición temporizada, y solo para un formato fijo - PNG, JPG, WebP, SVG o PDF). Déjalo en `1` para el fotograma de la cabeza de reproducción. Súbelo y obtienes esa cantidad de fotogramas muestreados a intervalos iguales a lo largo de toda la secuencia:

- **Raster y SVG** vuelven como un solo **zip** - `<name>-01.png`, `-02.png` y así sucesivamente.
- **PDF** vuelve como un **único documento con ese mismo número de páginas**.

Útil para un storyboard, una hoja de miniaturas, una hoja de contactos para revisión o un carrusel social recortado directamente de una edición de video.

El muestreo se toma en el **punto medio** de cada intervalo en lugar de en los extremos, porque el primer instante de una secuencia suele ser una transición de entrada que aún no ha aparecido del todo y el último es el estado tras haber terminado cada clip - un muestreo en los extremos gastaría dos de tus fotogramas en imágenes casi en blanco. El recuento está limitado a **64** (una hoja de contactos es para que la lea una persona), y cualquier valor sin sentido escrito en el campo vuelve a `1` en lugar de hacer fallar la exportación. Cada fotograma es un fijo normal, así que Content Credentials, la marca, las unidades físicas y el DPI se comportan exactamente igual que en una sola exportación.

El campo **Fotogramas** es la forma de obtener una hoja hoy. El motor reserva un parámetro de URL `cuts` a juego, pero ningún shell lo lee todavía desde un enlace, así que un enlace compartido siempre se reabre en el fotograma de la cabeza de reproducción - ver [Modo URL](/info/url-mode.html#contact-sheets-cuts).

## PDF multipágina

Algunas herramientas construyen un **documento PDF de varias páginas** en lugar de una sola obra - una portada, contenido que fluye a lo largo de tantas páginas como necesite y una contraportada, todo en un solo archivo (ver la herramienta *Booklet*). Cada página es una **página PDF real** dimensionada según la caja de esa página, así que lectores e impresoras obtienen páginas reales, no una sola imagen larga.

- **Páginas a partir de contenido.** Añade bloques de texto e imágenes; se crean páginas nuevas automáticamente a medida que los bloques se llenan, y puedes forzar que cualquier bloque empiece una página nueva.
- **Tamaños de página reales.** Elige A4, US Letter o A5 (vertical - el diseño a dos columnas está pensado para eso) - cada página, y el PDF exportado, se renderiza exactamente a ese tamaño.

Los PDF de varias páginas son documentos RGB y no llevan marcas de corte/sangrado - eso pertenece a la ruta de **Print PDF** de una sola página, arriba. Sí llevan los mismos **metadatos PDF/X-4** que toda exportación PDF (cajas de página, XMP, ID de documento, un intent de salida sRGB con perfil incrustado), y ofrecen **Content Credentials** (abajo) - en la herramienta *Booklet* la opción viene preseleccionada.

## Hacer muchas cosas a la vez

Lolly tiene tres formas distintas de trabajar a volumen, y resuelven trabajos diferentes - la edición por lotes es una capacidad de primera clase de la plataforma, no algo que cada herramienta reinventa:

- <!--i:document--> **Un diseño × una tabla de filas → un documento multipágina.** Las herramientas con una entrada `table` (como *Battlecards*) convierten cada fila en una página automáticamente - pega una tabla de tu hoja de cálculo, obtén un PDF con tamaño de mazo. Tu verdadero editor por lotes sigue siendo la hoja de cálculo: corrige diez filas ahí, pega de nuevo. La herramienta en sí nunca gestiona páginas.
- <!--i:layers--> **Un diseño × un archivo de datos → muchos archivos separados.** La cuadrícula por lotes de `/pro` toma un CSV y renderiza una exportación *por fila* - gafetes con nombre, certificados, un archivo cada uno.
- <!--i:sliders--> **Muchos activos distintos, editados uno al lado del otro.** *Multi-edit* abre varias sesiones guardadas en una sola vista para retoques coordinados en diseños distintos.

Regla general: filas del mismo diseño que pertenecen a **un documento** → una herramienta basada en tabla; filas que deben entregarse como **archivos separados** → `/pro`; **diseños distintos** que necesitan el mismo ajuste → multi-edit. (Una opción de renderizado planeada, "combinar medios", conectará las dos primeras - concatenando exportaciones del mismo formato en un solo PDF, un solo video o una hoja de contacto de prueba.)

## PowerPoint (PPTX)

Design, Markdown Slides, Booklet, Doc Studio, Chart y Diagrams pueden exportar una **presentación de PowerPoint** - una diapositiva por página. El objetivo no es una captura de pantalla pixel-perfecta; es entregarle a un colega una presentación que pueda **editar y de la que pueda extraer recursos**. Así que cada página se descompone en objetos nativos:

- <!--i:font--> **El texto** se convierte en **cuadros de texto de PowerPoint reales y editables** - con el tamaño de fuente, color, grosor, cursiva y alineación del diseño - así que puedes corregir una errata o restilizar en PowerPoint.
- <!--i:pentool--> **Los vectores** (logos, iconos, la marca SUSE) se incrustan como **imágenes SVG reales** - se mantienen nítidos a cualquier tamaño, y PowerPoint incluso puede hacer *Convert to Shape* sobre ellos.
- <!--i:photos--> **Las imágenes** llegan a su resolución nativa como imágenes propias extraíbles (un elemento destacado recortado con `cover` conserva la imagen completa detrás del recorte, así puedes reencuadrarla), con cualquier tratamiento sobre la imagen (filtros, mezclas) horneado con fidelidad.
- <!--i:layers--> **Fondos, bordes y reglas** se convierten en formas reales de rectángulo/línea.

![El panel de exportación con PowerPoint elegido: una diapositiva por página, texto y formas mantenidos editables](/t/url-shot?url=%2F%23%2Ftool%2Fdeck-studio%3Foptions&width=1440&height=900&dpi=192&waitMs=2500&drive=click%3A%5Bdata-fmt-trigger%5D%3Bwait%3A400%3Bclick%3A%5Bdata-fmt%3D%22pptx%22%5D%3Bwait%3A800&cropSelector=.export-popup&walker=1&format=svg&dark=1&filename=exp-pptx)

El diseño es aproximado por diseño - el objetivo es un **contenido** fiel y reutilizable, no una captura bloqueada. Cualquier cosa que el walker no pueda expresar de forma nativa (una región compleja filtrada o enmascarada) se incrusta como imagen para que no se pierda nada. Un mazo tiene un único tamaño de diapositiva, tomado de la primera página.

PowerPoint también es una vía de **entrada**. Suelta un `.pptx` en cualquier superficie de carga y elige las diapositivas que quieras - cada una se convierte en un recurso para colocar, retocar o usar como base. **Markdown Slides** escribe una presentación nueva a partir de Markdown (y entrega una plantilla `.pptx` de marca), y la utilidad **Rebrand** retematiza una presentación existente en el mismo lugar - paleta del tema, colores y fuentes fijados en el código - sin tocar sus gráficos, SmartArt ni animaciones, devolviendo un `.pptx`. Ver [Importar un diseño → Presentaciones y documentos](/info/design-import.html#decks-and-documents).

## Penpot

Cualquier herramienta que pueda exportar SVG también puede exportar un **archivo Penpot** (`.penpot`) - el documento, listo para seguir editándose en Penpot en lugar de solo para mirarse.

- <!--i:layout--> Desde **Design**, cada fotograma se convierte en un **board** de Penpot, cada caja en él pasa como su propia forma editable - rectángulo, elipse, texto, imagen o trazado - y el resultado llega como un **componente** reutilizable en el panel Assets, listo para arrastrarlo de nuevo.
- <!--i:pentool--> Desde una herramienta cuyo renderizado es **geometría pura** - las herramientas vectoriales como QR Code, Street Map, Wordmark y Palette Lab - cada trazado, rectángulo, línea de texto y degradado pasa de la misma forma, como su propia forma editable.
- <!--i:font--> Desde una herramienta que compone su renderizado en **HTML**, **el texto sigue siendo texto** - un objeto de texto Penpot editable por línea, no un contorno ni una imagen plana. Una pieza de arte para la que Penpot no tiene un constructo - una ilustración compleja, un canvas en vivo - viaja aparte como imagen, así que nunca aplana el texto ni las cajas a su alrededor. Un diseño completo que Penpot no puede separar fielmente aun así puede llegar como una sola imagen a fidelidad completa, así que nada se pierde nunca.
- <!--i:palette--> Un color o fuente que una forma **hereda de un token de marca** permanece **vinculado** a ese token en el archivo: cambia el token en el panel Tokens de Penpot y cada forma que lo hereda se repinta a la vez, mientras que un color literal puntual se queda exactamente donde está. Los colores y tipografías de la marca también llegan al panel **Assets** y su conjunto completo de tokens de diseño al panel **Tokens** - el mismo conjunto de tokens DTCG que usa la propia paleta de Lolly. Penpot conserva su propia copia a partir de ahí: una edición hecha en su panel Tokens vuelve a la marca a través de [la importación de Brand Studio](/info/design-import.html), no por sí sola.

| Lo que hiciste | En Penpot |
|---|---|
| Texto | Objetos de texto editables - corrige una errata o restilízalo |
| Formas, trazados, degradados, imágenes | Sus propias formas vectoriales editables |
| Un color o fuente de un token de marca | Un vínculo de token en vivo - edita el token, cada forma que lo hereda lo sigue |
| El diseño completo | Un componente reutilizable en el panel Assets |
| Una ilustración compleja o un canvas en vivo | Incrustado aparte como imagen, el contenido editable alrededor intacto |

![El panel de exportación con Penpot elegido: el archivo .penpot, y Send to Penpot junto a la descarga](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26options&width=1440&height=900&dpi=192&waitMs=2000&drive=click%3A%5Bdata-fmt-trigger%5D%3Bwait%3A400%3Bclick%3A%5Bdata-fmt%3D%22penpot%22%5D%3Bwait%3A800&cropSelector=.export-popup&walker=1&format=svg&dark=1&filename=exp-penpot)

Para abrirlo, inicia Penpot, elige un proyecto y selecciona **Import**. Con sesión iniciada en Penpot desde el panel de exportación, **Send to Penpot** hace ese paso por ti - eliges un proyecto ahí y el archivo va directo a él.

## SCORM (paquetes de curso)

Una presentación de Design puede salir como un **paquete SCORM** - el zip que importa un sistema de gestión de aprendizaje, ya sea Moodle, Canvas, Blackboard o un LMS corporativo. Elige **SCORM (LMS)** en el selector de formato y la exportación escribe:

- <!--i:layout--> **Las diapositivas**, una imagen por artboard, como vector donde el artboard lo permite y como píxeles solo donde no.
- <!--i:play--> **La película narrada** con su pista de subtítulos - las notas del orador leídas por una voz en el dispositivo, exactamente como las reproduce [Presenting](/info/create/using.html#presenting).
- <!--i:file--> **Una página de lanzamiento** que recorre las diapositivas, reproduce la película e informa la finalización al LMS a través del runtime SCORM 1.2, la versión que acepta todo LMS.
- <!--i:font--> Las fuentes que usa la presentación, para que la página de lanzamiento se renderice igual sin conexión.

![El panel de exportación en una presentación de Design con SCORM (LMS) elegido](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Ftemplate%3Dfeature-tour%26format%3Dscorm%26options&width=1440&height=900&dpi=192&waitMs=3500&css=.fc-insp%7Bdisplay%3Anone!important%7D.edge-dock-slot--fill%7Bflex%3A1%201%20auto!important%3Bheight%3Aauto!important%3Bmax-height%3Anone!important%3Boverflow%3Avisible!important%7D.export-popup.is-floating%7Bheight%3Aauto!important%7D.export-popup-body%7Bmax-height%3Anone!important%3Boverflow%3Avisible!important%7D&cropSelector=.export-popup&walker=1&format=svg&dark=1&filename=exp-scorm)

Nada en el paquete llama a casa: son archivos en un zip, y funciona dentro del LMS sin empaquetador, sin CDN y sin cuenta. Las apps web y de escritorio lo construyen; la CLI no, porque fotografiar los artboards y codificar la película necesitan el navegador.

## DXF (archivos de corte)

Las herramientas vectoriales (Brand Lockup, QR Code, Street Map, Wayfinding Signage, Pose Geeko, los lockups de logo, Diagram Builder) pueden exportar a **DXF** - el formato de intercambio AutoCAD R12 que leen las cortadoras láser, los plotters de vinilo y el software CNC/CAD. La geometría se escribe como **trazados de contorno en milímetros** (curvas aplanadas con una tolerancia fina), el texto se convierte a trazados y el color se asigna al AutoCAD Color Index más cercano (que suele controlar la herramienta u operación en una cortadora). DXF es solo dibujo de línea - una zona fotográfica o filtrada no tiene forma de trazado de corte y se descarta (Lolly avisa), así que usa SVG/PDF cuando necesites conservar contenido ráster.

Street Map es el caso más claro: todo el diseño ya son trazos, así que cada calle y canal se convierte en una ruta de corte sin nada que descartar.

::: showcase
![Un render de Street Map de París en tinta sobre crema - arte lineal puro, así que cada trazo sobrevive el viaje a una cortadora](/t/url-shot?url=%2F%23%2Ftool%2Fstreet-map%3Fcity%3Dparis%26roadColor%3D1a1a2e%26waterColor%3D93c5fd%26background%3Dfaf7f2%26full&width=1440&height=900&dpi=96&waitMs=3200&cropSelector=%23tool-canvas&walker=1&format=svg&dark=1&filename=vt-street-map-cut)

Desplázate, y la cámara se aleja a través de la geometría real: siete rutas, ningún píxel en ningún lado, cada trazo nítido como un cabello a cualquier zoom. Ese es el mismo archivo que lee una cortadora.
:::

## SVG animado

Las herramientas de movimiento (Animated Ad, Lottie Ad) pueden exportar **SVG animado** - una animación *vectorial* autocontenida. A diferencia de GIF/APNG/WebP (que muestrean cada cuadro a píxeles), un SVG animado apila instantáneas vectoriales con keyframes CSS incrustados, así que **escala a cualquier tamaño sin códec y sin entorno de ejecución externo** - hace bucle en una pestaña del navegador o en un `<img>`. El texto se mantiene contorneado para que se renderice en cualquier lugar. Comparte los controles de **Duración**/velocidad de cuadros de los formatos animados, y (al ser más pesado por cuadro que un mapa de bits) usa una velocidad de cuadros por defecto más baja.

## Transparencia

Las herramientas que la admiten ofrecen un interruptor de **fondo transparente** (p. ej. *No BG*). La transparencia se conserva en PNG, WebP, AVIF, SVG (fijo y animado), APNG y WebP animado. JPG y PDF son siempre opacos, y TIFF aplana sobre blanco (sobre negro en la ruta HDR - ver abajo).

## Espacios de color

Dos preguntas distintas, que vale la pena mantener separadas: qué espacios de color puede **leer y con los que puede pensar** Lolly, y cuáles **escribe**.

**Lectura.** Dondequiera que se escriba un color - la hoja de estilos de una herramienta, el trazo de un SVG importado, el valor de un token de diseño, una sombra o degradado dentro de un shorthand CSS - Lolly lee el vocabulario completo de **CSS Color 4**: `#hex`, `rgb()`, `hsl()`, `hwb()`, `lab()`, `lch()`, `oklab()`, `oklch()`, los colores con nombre de CSS y `color()` en los espacios predefinidos - `srgb`, `srgb-linear`, `display-p3`, `a98-rgb`, `prophoto-rgb`, `rec2020`, `xyz-d50`, `xyz-d65` - incluyendo componentes escritos como la palabra clave `none`. Un solo parser hace esto para toda la plataforma, así que el navegador y cada walker de exportación coinciden en qué significa una cadena de color.

Eso importa más de lo que suena, porque un navegador resuelve CSS moderno a CSS moderno. Escribe `color-mix(in oklab, …)` y Chrome calcula `oklab(…)`; usa un token de marca guardado como `oklch()` y ese es el valor literal que ve el walker de exportación. Los colores en esas formas se leen correctamente en lugar de descartarse - que es lo que hacía un walker que solo entendía `rgb()`, exportando texto con color de marca como negro, perdiendo paneles teñidos y reglas de tabla, y leyendo `oklch(0.7 0.1 200) 0px 2px 4px` como un desplazamiento de sombra de 0.7 por 0.1.

**Modo de pensar.** Las matemáticas de color ocurren de forma perceptual en lugar de en canales crudos. La derivación de paletas, los degradados, las armonías y el contraste se ejecutan en **OKLCH/OKLab**, y un color fuera de gama se lleva al rango mediante el propio algoritmo de mapeo de gama de CSS Color 4 - reducción de croma con una comprobación de distancia perceptual - en lugar de recortando canales, así que un color vivo se asienta en el color más cercano que realmente aceptarías en lugar de en uno aplanado. Los degradados interpolan en un espacio que eliges (OKLab por defecto, o `oklch`, `lab`, `lch`, `srgb`, `srgb-linear`, `hsl`, con una dirección de recorrido de tono para los polares), y la mezcla es **premultiplicada**, así que un fundido hacia transparente mantiene el color correcto en lugar de oscurecerse hacia el negro por el camino. Un único interpolador sirve tanto la vista previa como los walkers de exportación - eso es precisamente lo que impidió que un degradado cónico se mezclara de una forma en pantalla y de otra en el archivo exportado.

**Escritura.** La salida es deliberadamente más estrecha que la entrada, porque un archivo tiene que poder leerse en lo que sea que lo abra, y un espacio solo se *declara* en la salida cuando los números realmente se convirtieron a él. Los formatos de pantalla y web se escriben como **sRGB** y se etiquetan como tal; los formatos de impresión se escriben como **CMYK** frente a una condición de imprenta nombrada (abajo); y la ruta HDR es **Rec.2100 PQ** (arriba). Un color de gamut amplio que llega a una exportación se mapea a sRGB en lugar de etiquetarse mal - llevar `color(display-p3 …)` hasta un archivo vectorial es una extensión planeada, no algo que las exportaciones de hoy pretendan hacer. Un degradado creado en OKLab se *hornea* a paradas sRGB planas al salir, con paradas adicionales insertadas solo donde sRGB divergiría visiblemente de la curva perceptual, porque un `<linearGradient>` de SVG y un sombreado axial de PDF no tienen un ajuste de espacio de interpolación para llevar esa intención. Un valor creado, tres renderizadores, sin desviación.

## Perfiles de color

Para que los colores se reproduzcan fielmente en apps con gestión de color (imprentas, Photoshop, navegadores), las exportaciones se **etiquetan con un perfil de color**:

- **PNG / JPG** llevan un perfil ICC **sRGB** incrustado - el espacio de color en el que realmente se renderiza la vista previa - así que no queda nada que adivinar. (Solo etiquetado; los píxeles no se recodifican.)
- **Print PDF (CMYK)** declara una **condición de imprenta** objetivo en su *OutputIntent* (por defecto *Coated FOGRA39*), indicándole a un RIP/imprenta cómo deben leerse sus tintas CMYK. Las muestras de marca con valores de tinta medidos se convierten con exactitud; otros colores usan una conversión de dispositivo estándar. Esa declaración es un *nombre*: ningún perfil CMYK viene con Lolly, y PDF/X-4 exige el perfil incrustado, así que una condición nombrada escribe el intento de salida sin reclamar conformidad PDF/X-4. Carga un perfil CMYK propio y elige su fila **Embed** en el control de Perfil de color, y se incrusta como el *DestOutputProfile* del archivo - momento en el que el PDF puede ser genuinamente PDF/X-4, y lo reclama siempre que el resto del archivo lo permita. Tres cosas retienen la reclamación mientras conservan el intento de salida (un RIP aún lo quiere): arte RGB que el paso CMYK no pudo convertir, el texto de crédito del margen de prueba `prov` (dibujado en una fuente estándar que no está incrustada, y X-4 no hace excepción para eso) y una contraseña **Strong**, ya que X-4 prohíbe el cifrado. La condición que declara se lee entonces de ese perfil: un nombre registrado donde el perfil demuestra uno, `Custom` bajo el propio nombre del perfil donde no lo hace, así que el archivo nunca puede nombrar una condición de imprenta mientras lleva las mediciones de otra.
- **Print TIFF (CMYK)** escribe píxeles **DeviceCMYK** sin etiquetar y registra la misma condición de imprenta como procedencia en sus metadatos TIFF (*ImageDescription*) en lugar de incrustar un perfil. El mismo control de Perfil de color maneja ambos formatos CMYK - un TIFF no puede incrustar un perfil de imprenta en absoluto, así que una fila **Embed** registra ahí solo el nombre propio de ese perfil, nada más.
- **TIFF (RGB)** es el hermano sRGB simple y sin comprimir - un ráster sin pérdida al DPI elegido para archivo o ida y vuelta con un editor, con la procedencia registrada en los mismos metadatos TIFF. Cualquier transparencia se aplana sobre blanco (este perfil no lleva alfa). Como el TIFF CMYK, es solo de escritorio, ya que los navegadores no pueden previsualizar un TIFF y las descargas móviles llegan a un callejón sin salida.
- **SVG**, **EMF**, **EPS** y **DXF** son vectores independientes de resolución y de perfil sin perfil incrustado - los colores de SVG son sRGB plano, los de EMF y EPS son RGB de dispositivo (y **EPS (CMYK)** escribe DeviceCMYK ingenuo) y **DXF** lleva el Color Index de AutoCAD más cercano. (SVG, EPS y DXF, como PDF, convierten cualquier texto a rutas vectoriales, así que el resultado se renderiza incluso donde la fuente no está instalada. EMF en cambio mantiene el texto VIVO por defecto - registros de texto de metarchivo reales que siguen siendo seleccionables y editables en Office y Google Slides, recurriendo a contornos solo para los fragmentos que el formato no puede expresar; la opción "Outline fonts" del panel de exportación fuerza rutas en todas partes.) **SVG** también reproduce el `box-shadow` de CSS del HTML - cada sombra exterior se pinta detrás de la caja, con desplazamiento/extensión y desenfoque gaussiano para igualar al navegador, y las sombras internas se pintan dentro de ella de la misma manera.

Esto es automático - no hay ajuste que tocar. Las miniaturas y vistas previas omiten la etiqueta para mantenerse ligeras. Un perfil *sí es* una elección, porque cambia los píxeles en lugar de solo etiquetarlos - ver **HDR** abajo.

## HDR (colores brillantes)

Las exportaciones normales son sRGB: el blanco es blanco, y un color de marca saturado es tan brillante como el blanco normal de la pantalla. En una pantalla con capacidad HDR hay mucho margen por encima de eso, y la tarjeta **HDR** del panel de exportación lo aprovecha - tus colores de marca y el texto blanco se impulsan hacia el brillo máximo para que realmente *brillen*, mientras las zonas oscuras se mantienen oscuras y le dan al brillo su contraste.

![La tarjeta HDR en el panel de exportación, activada, con los diales White / Reach / Dark lift / Focus revelados debajo](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26format%3Dpng%26hdr%3D1%26options&width=1440&height=900&dpi=192&waitMs=2000&format=svg&cropSelector=.export-hdr&walker=1&dark=1&filename=exp-hdr-card)

- **Formatos.** Los formatos raster con un lugar para llevar la señal: **PNG**, **JPG**, **AVIF** y **TIFF**. (No WebP - es de 8 bits sin una ruta de decodificación HDR funcional, así que un WebP PQ simplemente se vería oscuro. Los vectores y el PDF no tienen ningún modelo HDR.)
- **Desactivado por defecto**, a diferencia del etiquetado de color - cambia los píxeles, así que es opcional. Marca la tarjeta, o pasa `hdr=1` en un enlace para compartir.
- **Lo que realmente se escribe.** Los píxeles se recodifican a **Rec.2100 PQ** - primarios BT.2020 con la curva de transferencia SMPTE ST 2084 (PQ) - y el contenedor lleva la señal correspondiente para que una app con gestión de color sepa leerlos así: un **perfil ICC v4 generado con una etiqueta `cicp`** (JPG, TIFF), un **chunk `cICP`** (PNG) o una caja `colr` reescrita (AVIF). El realce está condicionado a la **luminosidad perceptual (OKLab)**, así que los colores medios y superiores llegan al pico y los oscuros se calman en lugar de quemarse, y preserva el matiz - un verde de marca se vuelve más brillante, no menta.
- **Los controles.** Cuatro, revelados cuando la tarjeta está activada: **White** (el techo de brillo máximo, 400-2000 nits), **Reach** (hasta dónde se extiende el brillo por los tonos), **Dark lift** (cuánto se aclaran los oscuros - `0` los mantiene oscuros) y **Focus** (cuánta riqueza de color conserva el realce). Viajan en el mismo parámetro como un valor ajustado compacto - `hdr=1600-60-0-50` es White 1600, Reach 60, Dark lift 0, Focus 50 - así que un ajuste concreto es reproducible desde el enlace.
- **Dónde lo verás.** Visores con gestión de color en una pantalla HDR: Preview / Quick Look / Safari en dispositivos Apple, Chrome en un monitor HDR. En una pantalla SDR normal el archivo se sigue viendo como una imagen normal.
- **Antes de publicarlo.** Muchas plataformas **recodifican** lo que subes y eliminan la señal HDR - redes sociales, apps de mensajería, algunos CMS - lo que puede dejar la imagen viéndose oscura o descolorida. Usa HDR donde controles el destino (un sitio que construyas, una pantalla de video, una presentación en un panel brillante), no como opción por defecto para todo.
- **Transparencia.** PNG y AVIF conservan su alfa; JPG es opaco como siempre. La ruta de **TIFF** aplana sobre **negro**, no sobre el blanco de la ruta SDR - en PQ, el blanco es el código de 10.000 nits, así que aplanar sobre él rodearía cada borde con un halo cegador.
- **Los mismos bytes desde la terminal.** `--hdr=1` con `--export=png` o `--export=jpg` escribe el PNG Rec.2100 PQ de 16 bits y el JPEG con gain map ISO 21496-1 también en la [CLI](/info/cli.html), desde los mismos codificadores del motor en lugar de un navegador - así que una herramienta nativa en `<svg>` produce un archivo HDR sin ningún Chromium en el camino, y el PNG es idéntico byte a byte al del shell web. AVIF y TIFF siguen siendo exportaciones exclusivas del shell web por ahora.

## Video

Las herramientas animadas exportan movimiento como **MP4**, **WebM** o **GIF** - y, donde se ofrece, **APNG**, **WebP animado** o el **SVG animado** vectorial (arriba). Qué contenedor de video ves depende de tu navegador - el selector solo muestra lo que realmente puede grabar:

| Navegador | Muestra |
|---|---|
| Safari / iOS | **MP4** |
| Firefox | **WebM** |
| Chrome / Edge 126+ / Android | **MP4 y WebM** |
| Chrome antiguo | **WebM** |

GIF funciona en todas partes (excelente para chat/correo; más pesado y con menos color que el video). Las herramientas animadas también exponen **Wait** (segundos para dejar que la animación se asiente antes de grabar) y **Duration** (duración del clip).

> Un enlace compartido `?format=…` que solicita un contenedor que tu navegador no puede grabar recurre correctamente al otro y nombra el archivo en consecuencia.

**Sonido.** Las exportaciones de vídeo no son mudas. Una herramienta puede colocar una **pista musical** bajo el clip - un recurso de audio del catálogo, en bucle o recortado a la duración del clip, con fundido de entrada/salida, volumen y atenuación automática bajo el propio sonido de la grabación - y las herramientas de grabación llevan el audio en directo de su grabación directamente al archivo. **MP4** y **WebM** conservan la pista mezclada; GIF y los formatos de imagen animada (APNG, WebP animado, SVG animado) son mudos por naturaleza.

## Audio

Algunas herramientas exportan **audio por sí solo**, no solo como pista de vídeo. El **Grabador de voz** captura una toma de micrófono con un medidor de nivel en directo y una guía suave, y luego la guarda como **MP3** (el predeterminado, transcodificado en tu navegador) o en su contenedor nativo - **M4A** (AAC), **OGG** o **WebM** (Opus), lo que haya grabado tu navegador. Como con todo lo demás, la codificación ocurre en tu dispositivo - no se sube nada.

El audio que *importas* es igual de amplio. El selector de recursos acepta **MP3**, **WAV**, **OGG**/**Opus**, **M4A**/**AAC** y **FLAC** (conservado byte a byte y decodificado en el dispositivo), **MIDI** (`.mid` - convertido al importar en una pequeña pista sintetizada en el dispositivo) y **módulos de tracker** - **MOD**, **XM**, **IT**, **S3M**, **STM**, **MTM** (decodificados en el dispositivo por un reproductor incluido, unos pocos kilobytes de datos de canción). Cualquiera de ellos puede convertirse en la **pista musical** bajo una exportación de vídeo, o reproducirse en el reproductor ambiental del Modo Neurospicy.

El audio *forma parte* del pipeline `format=` / `--export=` de más abajo: `wav`, `mp3`, `m4a` y `opus` son ids de formato normales, así que una exportación solo de audio es tan compartible y programable como un PNG. Lo que sale es solo el sonido, sin imagen.

## Procedencia y marca de agua

Donde el formato lo permite, las exportaciones llevan **metadatos de procedencia** - software, origen, el nombre de la herramienta y tu línea de crédito de perfil - incrustados de forma nativa (PNG iTXt, JPEG EXIF, información de PDF, `<metadata>` de SVG, comentario de GIF). Es solo autoría; no se sube nada. Las herramientas **experimentales** además estampan una marca de agua visible, aplicada por el host para que no pueda eliminarse editando la herramienta.

**El Sello Lolly.** Las exportaciones ráster también llevan la propia **marca de agua invisible en píxeles** de Lolly - el *Sello Lolly* (Lolly Imprint) - **activada por defecto**, igual que Content Credentials. Mientras que la credencial y los metadatos de procedencia viajan *junto a* los píxeles y se pierden al volver a guardar, hacer una captura de pantalla o eliminar los metadatos, el Sello vive *en* los píxeles y sobrevive a la recompresión - así que una copia de la imagen puede seguir reconociéndose después como hecha con Lolly. Es un indicio duradero, no una garantía criptográfica, y es de solo presencia (no lleva datos personales). Viaja en **PNG, JPG, WebP, AVIF, TIFF y BMP**, y en los rásteres renderizados por Lolly compuestos dentro de un **PDF o PPTX** - nunca en una imagen que *tú* hayas incrustado, solo en lo que Lolly mismo renderiza. Desmarca la tarjeta **Lolly Imprint** en el panel de exportación para omitirlo, o pasa `imprint=0` en un enlace compartido. (La supervivencia de AVIF a la recodificación aún no está calibrada; la detección en PDF/PPTX cubre los rásteres de Lolly incrustados.) [/verify](/verify) lo detecta en el dispositivo - consulta [Content Credentials Identity](/info/content-credentials-identity.html#the-lolly-imprint).

**La credencial duradera.** Una segunda marca, más pesada, se sitúa junto al Sello: **Credencial duradera** (Durable credential), que usa un modelo neuronal en el dispositivo (formato TrustMark) para escribir el id de Lolly *en* los píxeles, de modo que el vínculo "hecho con Lolly" sobrevive a la eliminación de metadatos, una recodificación y una nueva lectura por herramientas compatibles con TrustMark, además de las propias de Lolly. Está **desactivada por defecto** - a diferencia del Sello, que es JavaScript puro, esta cuesta un paso neuronal por exportación más una descarga de modelo única, así que es una opción deliberada y no un impuesto silencioso. Solo ráster (**PNG, JPG, WebP, AVIF, TIFF**), se marca en el panel de exportación o se pasa como `durable=1` en un enlace compartido. En las apps de escritorio y móvil la tarjeta se oculta directamente en lugar de mostrarse sin efecto, porque no hay ningún origen desde el que obtener el modelo sin conexión.

**Protección de contenido.** En el panel de exportación, *Password protect*, **C2PA Credentials**, el **Lolly Imprint** y la **Durable credential** se agrupan en un único grupo colapsado y consciente del formato llamado **Content protection**, de modo que las opciones de procedencia y protección de un archivo viven en un solo lugar - el grupo muestra solo las tarjetas que aplican al formato elegido, y se oculta por completo cuando ninguna aplica. Las marcas de impresión están deliberadamente *fuera* de él: son geometría de producción de impresión, no protección, así que **Print marks & bleed** - la medida de sangrado en milímetros más Crop, Registration, Bleed, Colour bars y Stamp details - conserva su propia tarjeta de nivel superior en los formatos de impresión.

![El grupo Content protection abierto en una exportación PNG, mostrando solo las tarjetas que le aplican](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26format%3Dpng%26imprint%3D1%26options&width=1440&height=900&dpi=192&waitMs=2000&walker=1&format=svg&cropSelector=.export-protection&dark=1&filename=exp-content-protection)

**Antes de exportar (preflight de impresión).** Activa **Print preflight** (`export-preflight`) en las banderas de función de tu Perfil - está **desactivado por defecto**, así que a alguien que exporta un PNG para un mensaje de chat nunca lo emboscan hallazgos de preimpresión, y un plano de control de despliegue ([lolly.work](https://lolly.work)) puede activarlo por defecto para sus miembros - y aparece una tarjeta **Before you export** al pie del panel, justo encima de los botones, siempre que las reglas de impresión tengan algo cierto que decir sobre el trabajo: formato, tamaño y sangrado, luego áreas de corte y sangrado, cobertura de tinta, número de planchas y de páginas, con un veredicto junto a su título. Se sitúa bajo cada ajuste porque es una afirmación *sobre* esos ajustes y no otro de ellos - y nunca bloquea una exportación. Te dice lo que una imprenta está a punto de ver.

**Coste, calculado a partir de tu tarifario.** Debajo del preflight - la última de todas, aún por encima de los botones - hay una tarjeta que convierte esos mismos recuentos en dinero, y solo a partir de precios que alguien le haya dado. Lee lo que sea que el paso de preflight haya contado, esté o no activada la propia tarjeta de preflight, y necesita que se cumplan dos cosas: que el trabajo tenga algo que una lista de precios pueda tarificar (planchas, pliegos, área, páginas, filas de variantes o archivos de salida - así que un simple PNG de logotipo nunca la muestra), **y** que haya presente un **tarifario**. Un tarifario es una lista de precios en JSON de tu imprenta. Una compilación por defecto no incluye ninguno y no tiene forma de cargarlo dentro de la app: llega bien como recurso de catálogo que envía un despliegue, bien mediante la extensión opcional de tarifario que activa un autoalojador o un plano de control. Sin tarifario, no se muestra nada - ni un aviso, ni una tabla vacía.

La regla sobre la que se construye todo esto es que **nunca inventa dinero**. Cada cifra es una tarifa que tú aportaste multiplicada por una cantidad que Lolly contó - `4 planchas × 35,00 €` - y el total nombra su propia fuente en la misma frase que la cifra: el emisor que nombra el tarifario, y la fecha en que el tarifario dice que datan sus tarifas. No hay moneda por defecto, ni marcador de posición, ni un cero que sustituya a un precio ausente. Lo que el archivo dice de sí mismo se mantiene como discurso referido: *"El archivo dice: … Lolly no lo ha verificado."*

Y cuando no puede calcular con honestidad, la tabla de trabajo **desaparece** en lugar de degradarse a una cifra en gris o rellenada:

- Las líneas que el tarifario no tarifica implican **ningún total en absoluto** - solo un titular que indica cuántas de ellas no tienen precio. Una suma parcial no es una respuesta más pequeña, es una respuesta incorrecta.
- Una cantidad que es un tope y no un recuento exacto lleva **"hasta"** hasta su subtotal, de modo que un límite nunca se blanquea como una cifra plana.
- Las tarifas pasadas su fecha de validez muestran **solo cantidades**, hasta que pulsas *Use these rates anyway* - y entonces la fecha de caducidad viaja junto a la cifra, para que un total caducado no pueda leerse como uno vigente.
- Abierto mediante un **enlace**, el dinero permanece oculto hasta que lo pides en este dispositivo. Ni la tarjeta ni esa revelación viajan nunca en una URL - la misma razón por la que la CLI toma `--rate-card=<file.json>` como marcador de archivo local y nunca como parámetro de enlace.

La tarjeta es interfaz, nunca contenido: se elimina en cada etapa de exportación, así que no puede mover ni un píxel del archivo que descargas. Y es aritmética, no un presupuesto: solo tu imprenta puede dártelo.

**Renders compuestos.** Cuando una herramienta incrusta la salida de otra herramienta (por ejemplo, una *Event Name Badge* que incrusta un *QR Code*), el render anidado se integra en la exportación de la herramienta principal - se mantiene como **vector real** en SVG y PDF y se rasteriza con nitidez en PNG/JPG/WebP. El elemento hijo incrustado es un intermedio: no recibe *ninguna* marca de agua ni procedencia propia; solo el recurso final de la herramienta principal la recibe. (La composición cubre SVG y los formatos ráster; HTML/MD/TXT no se pueden componer.)

## Protección con contraseña

Dos tipos de bloqueo independientes, ambos completamente en el dispositivo.

**Contraseña de apertura de PDF** - la tarjeta *Password protect* del panel de exportación ofrece dos niveles:

![La tarjeta Password protect desplegada en una exportación de PDF, con el campo de contraseña y los dos niveles de bloqueo](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26format%3Dpdf%26password%3Ddemo%26options&width=1440&height=900&dpi=192&waitMs=2000&walker=1&format=svg&cropSelector=.export-pdfpass&dark=1&filename=exp-pdf-password)

- **Standard** - un bloqueo básico de 40 bits (RC4). Se abre en *cualquier* app de PDF y - al ser un disuasorio ligero, no una protección real - puede viajar en un enlace compartido (en texto claro, por diseño). Solo `pdf` RGB.
- **Strong** - AES-256 (PDF 2.0). Su contraseña se escribe al exportar y **nunca** se coloca en un enlace; solo se abre en apps de PDF más recientes (Acrobat / Preview ~2018 en adelante), y las apps más antiguas pueden reportar el archivo como dañado. Strong también se aplica a los **PDF de impresión / CMYK** y a **cada PDF dentro de un zip por lotes** (el diálogo de confirmación del lote recoge la contraseña). Como PDF/X-4 prohíbe el cifrado, un PDF de impresión bloqueado con Strong conserva su CMYK, sus marcas y su intención de salida, pero pierde la declaración de conformidad PDF/X-4.

Cualquiera de los dos niveles es mutuamente excluyente con Content Credentials (un PDF cifrado no puede llevar la credencial).

**Descargas bloqueadas (zip completo + defensa en profundidad)** - una exportación en **ZIP** (el formato *ZIP* del panel de exportación, que agrupa varios formatos de una herramienta), una descarga de **carpeta** (Proyectos → Descargar) o la **cuadrícula por lotes** puede bloquear el zip completo con una contraseña, en dos niveles:

- **Standard** - **ZipCrypto** tradicional: se abre en *cualquier* herramienta de descompresión, incluida la extracción integrada del Explorador de Windows, pero es débil (un disuasorio). Su contraseña puede viajar en un enlace compartido `?password=`.
- **Strong** - **AES-256** (WinZip AE-2): fuerte, pero **no** se abre con la extracción integrada del Explorador de Windows - el destinatario necesita 7-Zip / WinZip / Keka / macOS. Se escribe al exportar, nunca se coloca en un enlace.

La misma tarjeta *Password protect* del panel de exportación controla tanto los bloqueos de PDF como los de ZIP, reformulándose según el formato elegido. La misma contraseña protege a **todos** los miembros - imágenes, SVG, todo, PDFs incluidos (solo el contenedor zip puede proteger archivos que no son PDF, que no tienen bloqueo propio). Y es **defensa en profundidad**: cualquier PDF interior queda *también* bloqueado individualmente con AES-256 y la misma contraseña, de modo que un PDF permanece bloqueado incluso después de descomprimir el zip. El aviso aparece al iniciar la descarga; una contraseña en blanco significa ningún bloqueo.

**Enlaces compartidos protegidos con contraseña** - cualquier enlace compartido puede cifrarse para que al abrirlo se pida una contraseña al destinatario. Todo el estado del enlace se cifra con AES-256 bajo una clave derivada de la contraseña (PBKDF2); solo viaja el texto cifrado, así que **la contraseña nunca está en el enlace** y el descifrado ocurre **en el navegador del destinatario** - el servidor que sirve el enlace solo ve el texto cifrado en la URL, nunca la contraseña ni el diseño descifrado. Actívalo en el diálogo **Share**. Un enlace cifrado solo puede *abrirse* en Lolly (no puede incrustarse como imagen, ya que esa vía no puede pedir la contraseña). Consulta [URL Mode → Encrypted links](/info/url-mode.html).

## Content Credentials (C2PA)

Las exportaciones pueden llevar **Content Credentials** - un manifiesto [C2PA](https://c2pa.org) firmado, incrustado en el archivo, que registra, de forma detectable ante manipulaciones, que el archivo se hizo con Lolly y no ha sido alterado desde entonces. Es la versión estandarizada de los metadatos de procedencia descritos arriba: una afirmación criptográfica (qué hizo el archivo, cuándo, por quién y dónde) vinculada a un hash de los bytes del archivo, de modo que cualquier edición posterior es detectable por un visor compatible con C2PA. El estándar está gestionado por la [Content Authenticity Initiative](https://contentauthenticity.org) (Adobe, BBC, Microsoft, Nikon y otros), así que las mismas credenciales que escribe Lolly son las que están adoptando las cámaras, las redacciones y las suites creativas.

![La tarjeta C2PA Credentials, premarcada, con la duración de la credencial al lado](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26format%3Dpng%26c2pa%3D30%26options&width=1440&height=900&dpi=192&waitMs=2000&format=svg&cropSelector=.export-c2pa%5Bdata-c2pa-only%5D&walker=1&dark=1&filename=exp-c2pa-card)

- **Formatos.** Todo contenedor con incrustación C2PA: **PDF** (tanto RGB como de impresión), **PNG / PNG animado**, **JPG**, **GIF**, **SVG**, **TIFF** (RGB y de impresión), **WebP** (fijo y animado), **AVIF**, **MP4**, **WebM** y los contenedores de audio **MP3**, **WAV**, **M4A** y **OGG/Opus** - así que un clip de voz grabado o sintetizado se envía con la misma credencial que una imagen. Un paquete **ZIP** estampa cada miembro compatible por separado, que es también donde un **SVG animado** obtiene una: por debajo es un documento SVG normal (una exportación directa de SVG animado no ofrece tarjeta propia). MP4, AVIF y M4A usan el enlace BMFF de la especificación y MP3 su mapeo ID3v2, así que `c2patool` y otros visores compatibles con C2PA los verifican; **WebM** y **OGG/Opus** aún no tienen mapeo C2PA estandarizado, así que Lolly lleva el manifiesto como un adjunto de Matroska y un campo OpusTags respectivamente, que el propio verificador de Lolly (y la CLI) comprueba. (`ico`, `eps`, `emf`, `dxf`, `bmp`, `pptx`, los formatos de Office y los formatos de texto/datos no tienen contenedor C2PA.)
- **Activado por defecto.** La tarjeta **C2PA Credentials** del panel de exportación viene premarcada para casi todas las herramientas - desmárcala para omitir la credencial en una exportación puntual (o pasa `c2pa=off` en un enlace compartido). Una herramienta puede excluirse por completo en su manifiesto.
- **Qué registra.** La herramienta y la app que hicieron el archivo, la hora de firma, la superficie de exportación (familia de motor de navegador + familia de sistema operativo - deliberadamente aproximado, nunca una huella) y - solo cuando *Profile → Use my details* está activado - tu nombre y correo como autor de la obra.
- **Qué ven los destinatarios.** Las herramientas de inspección de Content Credentials (apps de Adobe, `c2patool`, contentcredentials.org/verify) leerán el manifiesto y mostrarán la afirmación. Como Lolly firma con una clave generada **en tu dispositivo** - no un certificado de una lista de confianza - los visores la reportan como una credencial *no verificada*. La estructura y la detección de manipulaciones son reales; simplemente nadie avala la identidad del firmante. Para mejorar eso, puedes inscribir una **identidad verificada** (Profile → Content Credentials): un certificado de corta duración de la CA de Lolly vincula tu correo a tus exportaciones mientras la clave de firma nunca sale de tu dispositivo - consulta [Content Credentials Identity](/info/content-credentials-identity.html).
- **Comprobar un archivo.** Lolly también verifica sus propias credenciales: suelta cualquier archivo en [/verify](/verify) (o ejecuta `lolly validate <file>` en la CLI) para obtener un informe en el dispositivo - encabezado por si el archivo se hizo genuinamente con Lolly y no ha cambiado desde entonces. La vista Verify de la web va mucho más allá de la credencial: señala **contenido generado por IA**, detecta el **Lolly Imprint**, comprueba firmas **SEAL** y (opcional) marcas de agua de píxeles de terceros, y muestra **datos ocultos** - todo en el dispositivo, sin subir nada. Consulta [Content Credentials Identity → Beyond the credential](/info/content-credentials-identity.html#beyond-the-credential-what-else-verify-shows).
- **Privacidad.** Todo ocurre en tu dispositivo: la clave de firma se crea para la exportación y nunca sale del navegador, no se sube nada y la afirmación solo contiene lo que ya llevan los metadatos de procedencia. Las utilidades de privacidad (transformaciones en el dispositivo de *tus propios* archivos) nunca añaden credenciales, y *Strip Hidden Data* eliminará un manifiesto C2PA como cualquier otro metadato incrustado.
- **Interacciones.** En los PDF, Content Credentials y la **protección con contraseña** (cualquier nivel - ver arriba) son mutuamente excluyentes (un PDF cifrado no puede llevar el adjunto de la credencial). La credencial se añade como paso final sobre los bytes terminados - después del estampado de DPI/EXIF/perfil de color, los metadatos PDF/X y las marcas de impresión.

## En un teléfono

Los controles de exportación viven detrás del botón flotante **Render**, que abre la hoja **Export** - los mismos formatos, tamaño, copia, descarga y compartir, dimensionados para tacto.

## Referencia de formatos

Cada id que el host puede renderizar, agrupado. Son también los valores del parámetro de URL `format=` y del flag `--export=` de la CLI - consulta [URL Mode](/info/url-mode.html) y [CLI](/info/cli.html). Una herramienta ofrece solo el subconjunto que declaró su autor, así que el selector siempre es más corto que esta lista.

| Tipo | Ids |
|---|---|
| Raster | `png` · `jpg`/`jpeg` · `webp` · `avif` · `tiff` (RGB TIFF) · `cmyk-tiff` (Print TIFF) · `bmp` · `ico` |
| Vectorial | `svg` · `svgz` (SVG comprimido con gzip) · `emf` · `wmf` · `eps` · `eps-cmyk` (EPS CMYK) · `dxf` (archivo de corte) |
| Página y documento | `pdf` · `pdf-cmyk` (Print PDF) · `pptx` (PowerPoint) · `scorm` (paquete de curso SCORM, un zip) · `penpot` (archivo de diseño Penpot) · `docx` (Word) · `odt` (OpenDocument Text) |
| Movimiento | `gif` · `apng` (PNG animado) · `webp-anim` (WebP animado) · `svg-anim` (SVG animado) · `webm` · `mp4` |
| Audio | `wav` · `mp3` · `m4a` · `opus` |
| Texto y datos | `html` · `md` · `txt` · `json` · `csv` · `ics` · `vcf` · `css` · `scss` · `gpl` (paleta de GIMP) |
| Paquete | `zip` |

Unos pocos ids más provienen del **propio hook de exportación de la herramienta** en lugar de la vía de render compartida: `ase` (Adobe Swatch Exchange, de Palette Lab), `exr` y `hdr` (los rásteres de alto rango dinámico de Darkroom) y `ttf` / `otf` / `woff` (Font Convert). Eligen un formato de la misma manera - el selector, `format=`, `--export=` - los bytes simplemente los construye la herramienta. Font Convert es la única excepción: transforma un archivo de fuente que *tú* aportas, así que no hay nada que una URL desnuda pueda renderizar.
