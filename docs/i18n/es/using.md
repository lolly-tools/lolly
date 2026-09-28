# Usando Lolly

Una guía práctica para *usar* de verdad la aplicación - abrir una herramienta, trabajar en el lienzo, exportar, guardar y compartir. Todo esto funciona **en tu dispositivo**: sin cuenta, sin subir archivos, y sin necesitar internet para las pantallas que ya has abierto.

> ¿Eres nuevo aquí? La [Guía rápida](/info/quickstart.html) te pone a crear en minutos, y [Lolly para Operadores](/info/operators.html) cubre la instalación/el despliegue de la app; esta página trata sobre cómo manejarla una vez abierta.

## Abrir una herramienta

La pantalla de inicio es la **galería** - todas las herramientas, agrupadas por categoría. Haz clic en una tarjeta para empezar algo nuevo en esa herramienta; [el trabajo guardado](#saving-continuing) se reabre desde **Proyectos**. Usa el cuadro de búsqueda para filtrar por nombre - o [Buscar](/info/search.html) desde la barra al pie de las seis pantallas de listado (la galería, Utilidades, Proyectos, Recursos, el Panel y Ajustes), que llega a tu trabajo guardado, a tus recursos y a tus ajustes además de a las herramientas. Dentro de una herramienta, la barra se aparta para dejar sitio a los controles de la propia herramienta.

![Una tarjeta de galería con navegación de ejemplo y una acción Nueva](/t/url-shot?url=%2F%23%2F&width=1440&height=900&dpi=192&waitMs=1600&css=.welcome-dialog%2C.personalize-nudge%7Bdisplay%3Anone!important%7D&waitSelector=.gallery-view%5Bdata-shots-settled%5D&walker=1&format=svg&localize=1&dark=1&cropSelector=.gtile%5Bdata-tool-id%3D%22design%22%5D&filename=gallery&try=1)

Cada herramienta es una vista dividida: **controles** a un lado, una **vista previa** en vivo (el lienzo) al otro. Cambia cualquier control y la vista previa se actualiza al instante.

![La vista dividida de una herramienta - la pila de controles a la izquierda, y el gráfico de barras agrupadas en directo que dibuja a la derecha](/t/url-shot?url=%2F%23%2Ftool%2Fchart%3Fct%3Dbar%26t%3DExample%2520data%26st%3DSample%2520values%252C%2520not%2520a%2520real%2520dataset%26d%3DMonth%252CSeries%2520A%252CSeries%2520B%252CSeries%2520C%250AJan%252C12%252C9%252C5%250AFeb%252C18%252C14%252C7%250AMar%252C24%252C17%252C11%250AApr%252C29%252C23%252C15%26lg%3D1&width=1440&height=900&dpi=192&waitMs=2500&walker=1&format=svg&dark=1&filename=vt-tool-split-view)

> Algunas herramientas (como **Design**) se abren en cambio como un **lienzo libre** - una superficie sin interfaz, de manipulación directa, donde arrastras, redimensionas, rotas y ajustas cajas de texto, formas e imágenes, y haces doble clic para editar el texto en el sitio. Se exporta por la misma ruta de renderizado que cualquier otra herramienta, así que el lienzo *es* el archivo. Consulta [El lienzo libre](#the-free-canvas-design) más abajo.

Dos maneras de moldear la propia cuadrícula hasta dejarla como la quieres:

- <!--i:star--> **Marca con una estrella lo que uses.** Pon ★ a una tarjeta y consigue su propio mosaico grande en una tira sobre la cuadrícula - consulta [Tus favoritos](/info/favourites.html).
- <!--i:eyeoff--> **Oculta una herramienta que nunca usas.** Haz clic derecho en una tarjeta (o selecciona varias y usa la barra de selección) → **Ocultar herramienta**. Sale de la cuadrícula, y de lo que encuentra escribir en la cuadrícula; un mosaico gris **Mostrar herramientas ocultas (N)** al final del todo las vuelve a revelar, atenuadas, cada una con **Mostrar herramienta** en su propio menú. Ocultar solo afecta a tu cuadrícula - la herramienta sigue abriéndose desde un enlace guardado o un marcador, y queda exactamente donde estaba para todos los demás.

![El final de la cuadrícula de Herramientas con las herramientas ocultas reveladas: la tarjeta atenuada del Generador de códigos QR y, junto a ella, el mosaico gris que la devolvió a la vista, que ahora dice Ocultar herramientas ocultas](/t/url-shot?url=%2F%23%2F&width=1440&height=680&dpi=192&waitMs=1600&css=.welcome-dialog%2C.personalize-nudge%7Bdisplay%3Anone!important%7D&drive=click%3A%5Bdata-select%3D%22qr-code%22%5D%3Bclick%3A%5Bdata-bulk%3D%22hide%22%5D%3Bwait%3A300%3Bclick%3A.gtile--hiddenbox%3Bpress%3AEnd%3Bwait%3A800&waitSelector=.gallery-view%5Bdata-shots-settled%5D&walker=1&format=svg&rasterDpi=96&dark=1&filename=misc-hidden-tools)
<!--
SHOT NOTE (misc-hidden-tools): the trailing `press:End` is required. The
hidden box and the revealed cards live at the very END of the grid, and
clicking the box runs applyView(), which re-lays the grid out and drops the
scroll back to the top - so without it the frame published the TOP of the
gallery under a caption about its bottom. `press:` with no `on=` goes to the
keyboard, and the End key with focus on the just-clicked box scrolls the
document; the walker then anchors the body walk to that band.
The tile reads "HIDE hidden tools" in the shot, not "Show" - it is a toggle and
the recipe has just pressed it. The alt says so rather than quoting the resting
label the prose above already gives.
There is no standalone per-card "hide" button
(unlike the always-visible fav/pin corner icons) - Hide only exists inside a
tile's right-click menu or the bulk bar, both confirmed in views/gallery.ts.
The recipe goes the bulk-bar route since it needs no `|right` context-menu
step: tick the card (`[data-select="qr-code"]`, the same checkbox hook the
selection bullet under Projects uses), click the bar's Hide button
(`[data-bulk="hide"]` - the literal `data-bulk` value bulkBarHtml() writes,
confirmed in lib/bulk-bar.ts), then click the grey reveal tile
(`.gtile--hiddenbox`, confirmed in gallery.ts).
-->

Para actuar sobre varias tarjetas a la vez, marca la casilla de cada tarjeta, arrastra un recuadro de selección sobre el espacio vacío o usa **Shift/Cmd-click**, y aparece una barra de selección flotante. **Lo que ofrece la barra de selección** varía un poco según la vista, ya que no toda acción tiene sentido en todas partes:

- **Herramientas / Utilidades:** Favorito (o Quitar de favoritos), Ocultar (o Mostrar), Disponible sin conexión (o Quitar de sin conexión), **Ver sesiones** (abre Proyectos mostrando solo las sesiones hechas con esas herramientas) y Copiar enlace cuando hay exactamente una tarjeta seleccionada.
- **Recursos:** Favorito y Ocultar se aplican a cualquier selección; Duplicar, Descargar y Eliminar solo aparecen cuando todos los elementos seleccionados son subidas tuyas - un recurso compartido del sistema de diseño es un contrato permanente, así que esos tres no lo tocan ni siquiera en bloque.
- **Proyectos:** consulta [Encuentra y recupera tu trabajo](/info/find-your-work.html#find-something-you-saved).

> Una trampa de etiquetas: **Ver sesiones** solo existe cuando hay algo *seleccionado*. Hacer clic derecho en una sola tarjeta no seleccionada ofrece en cambio **N sesiones guardadas**, que abre una lista de las sesiones guardadas de esa herramienta, donde eliminar mueve la sesión a la Papelera, en lugar de llevarte a Proyectos.

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

### Ask Lolly

Cuando prefieres preguntar antes que buscar, **Ask Lolly** (`#/ask`) recibe una pregunta escrita y te devuelve **literalmente** la sección correspondiente de esta documentación - las palabras propias de las guías, no un resumen ni una generación - citando la página de la que salió y con un enlace **Abrir en la documentación** al lado. Bajo la respuesta están los lugares de la app con los que coincide esa misma pregunta: una herramienta, un ajuste, un proyecto guardado, cada uno como un botón que simplemente te lleva allí.

La transcripción es memoria de sesión: haz una pregunta de seguimiento y el hilo se va acumulando, pero al recargar empieza de cero. Los resultados de búsqueda llevan abajo una fila **Ask Lolly: *tu consulta*** - por debajo de los resultados concretos que hayan encontrado los demás grupos - que traslada la pregunta directamente, así que puedes empezar en la barra y terminar aquí.

## El lienzo (vista previa)

La vista previa siempre muestra exactamente lo que se exportará.

**Escritorio**

- **Zoom:** desplaza con Cmd/Ctrl, o pellizca en un trackpad - el zoom se centra en tu puntero.
- **Desplazamiento (pan):** mantén pulsada la **barra espaciadora** y arrastra, o arrastra con el **botón central del ratón**. (Los clics simples quedan libres para hacer clic en partes del diseño.)
- **Teclado:** `0` = ajustar a la ventana · `1` = 100% · `+` / `−` = zoom.
- **HUD de zoom:** el pequeño control `−  NN%  +  Fit` en la esquina. Haz clic en el porcentaje para alternar entre Ajustar ↔ 100%.

![El HUD de zoom en la esquina del lienzo - menos, el porcentaje en vivo, más, Ajustar, y luego los interruptores de tema y sonido](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools&width=1440&height=900&dpi=192&waitMs=2500&css=.stage-nav%7Bopacity%3A1!important%7D&cropSelector=.stage-nav&walker=1&format=svg&dark=1&filename=use-zoom-hud)

**Táctil**

- **Pellizca** para hacer zoom, **arrastra** para desplazarte, **toca dos veces** para restablecer el ajuste.

**Clic para ir a un control:** haz clic en cualquier elemento del diseño y el control correspondiente de la barra lateral recibe el foco y se desplaza a la vista - en un grupo de filas repetibles despliega exactamente la fila en la que hiciste clic, así que editar lo que ves está a un toque de distancia.

Un cambio de dimensión siempre hace que la vista vuelva a un ajuste limpio.

### El lienzo libre (Design)

Las herramientas de lienzo libre añaden una superficie de trabajo *alrededor* del área de diseño, como la mesa de montaje de un diseñador:

- **Preparación fuera de lienzo.** Arrastra una caja más allá del borde del marco y permanece totalmente **visible y seleccionable** - aparca elementos a un lado mientras organizas la composición y luego arrástralos de vuelta. Todo lo que queda fuera del marco se **atenúa suavemente** para que el área de exportación se distinga de un vistazo, y el marco conserva su sombra para marcar exactamente dónde empieza el archivo.
- **Solo se exporta el marco.** El archivo exportado queda delimitado por el área de diseño - todo lo que quede fuera (o la parte de una caja que sobresalga del borde) simplemente se recorta del resultado, tanto en formatos raster como vectoriales.
- **Aleja el zoom más allá de Ajustar** (hasta el 20%) para ver toda la mesa de montaje cuando hayas colocado elementos muy lejos del marco.
- **Área de diseño redimensionable.** Cambiar las dimensiones de exportación redimensiona el marco en el sitio; las cajas mantienen sus posiciones, así que puedes reencuadrar una composición alrededor del contenido existente.
- **Antes de exportar.** La sección Documento del inspector comprueba la estructura de capas guardada y luego revisa el lienzo ya asentado en busca de texto recortado y de contraste de color plano. También pregunta al mismo registro de tipografías que usa el contorneado de SVG/PDF si cada línea de texto tiene bytes de fuente incrustables; los fondos de imagen y de degradado se señalan como comprobaciones visuales en lugar de recibir una puntuación de contraste inventada.

![El lienzo libre de Design - la mesa de trabajo con la zona de pegado que la rodea](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Fz%3D17ZTfS8MwEMf_mryO5NZ288GHrdqJv1CUvWdtOgppMtJMNv96yaV1iRNEQRBZoblwab53l0-uq915bXgrCOSDpf3LzgANnQ4eI0rrPJn7Gh9cd0sE8lIryxtFIFfatFx6L4F0Mi-11GbUiZYr25QjK3bW-S8I5MnUbRXKCkMgb5uqki6JFFU7rjoXYsSgT8GaLebKZSeGAPkUYypMHp80DeugYYR4J_U7X4XRkY8dFHuTYEJ-jDWM3qoqsEHo4Y20-xJi-SPVaOfRUuAL1hiZXNrG4gH6M85Z5lTAk8x8DdlnPL8gecVfBIEU6F5v0bbCor3VUu4JpOPCKTCWsPI9rBS107d6QyCfRET_Ac6wX36X6UpX-49Ip1mAlMEPkM6QX20aoSpECLTmpadcazPQ9hPlWxboRndWmFEIG1s4Yp3E3Ts-0f4GbcruWHLzlC0frmfpfbGk82LxmD0vUndSTcvXAoknWBKCz5LDSIdiRHV0D2Tfq1BIvdY42Zim5WZ_-n3_mRvwBg&width=1360&height=850&dpi=192&waitMs=3000&format=svg&walker=1&chrome=1&localize=1&dark=1&filename=design)

**Voltea una selección.** Haz clic derecho en cualquier caja y elige **Flip horizontal** o **Flip vertical** para reflejarla en su sitio, o pulsa `Shift+H` / `Shift+V` desde el teclado - Shift, porque una `V` sola es la herramienta Puntero. Cada caja seleccionada se refleja en su propio eje en un solo paso de deshacer, y el reflejo es una transformación real, así que se mantiene en el SVG, PDF y PNG exportados y no solo en el lienzo.

### Capas e Inspector

En **Capas**, cada área de diseño es un grupo padre plegable. Selecciona su nombre para saltar hasta ella, despliega sus capas y selecciona o reordena objetos dentro de esa área de diseño. Cambia a **Páginas** para ver miniaturas y ordenar las páginas. Las flechas del teclado recorren la lista de capas; Izquierda vuelve al encabezado del área de diseño.

El **Inspector** pone primero los controles de texto o de imagen del objeto seleccionado. Usa los chips de opciones para elecciones rápidas y despliega **Advanced** para los detalles de estilo. En el teléfono, abre **Inspector** desde **Más acciones**. Los controles se abren en una hoja; Escape o Atrás la cierra sin perder tu selección.

### Dibujar tus propias formas (la pluma)

Las cajas, los círculos y los marcos redondeados cubren la mayoría de las composiciones. Cuando necesitas una forma que no está en esa lista, dibújala: el botón **Pluma** de la barra (o la tecla `P`) te pone en modo de dibujo. Tres teclas sueltas te mueven entre los modos - **`V`** para volver al Puntero, **`P`** para la Pluma, **`N`** para la herramienta de nodos (**Editar puntos**) - y el Puntero es siempre la salida de donde estés.

![La barra de herramientas del lienzo libre: un asa de arrastre, el menú de Lolly y luego Puntero, Añadir un cuadro, Pluma, Editar puntos, Línea, Línea de tiempo, Áreas de diseño y Organizar automáticamente](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Ftemplate%3D__blank__&width=1440&height=900&dpi=192&waitMs=2600&css=.fc-toolbar%7Bopacity%3A1!important%7D&cropSelector=.fc-toolbar&walker=1&format=svg&dark=1&filename=pen-editor-rail)

- **Haz clic** para colocar un punto. En el tipo de curva predeterminado, **haz clic y arrastra** para sacar los manejadores de ese punto, que es como se dibuja una curva en lugar de una esquina - mantén **Alt** al hacer clic si quieres una esquina dura. (En los demás tipos de curva cada punto colocado es una esquina y el arrastre no hace nada; consulta **Tipo de spline** más abajo.)
- Los puntos se ajustan al área de diseño y a tus otras cajas a medida que los colocas, dibujando las mismas guías que un arrastre normal. Alt desactiva la cuadrícula mientras dibujas, y tanto la cuadrícula como los bordes cuando después arrastras un punto.
- **Haz clic en tu primer punto** para cerrar el contorno y terminar de una vez. Si no, pulsa **Enter**, haz doble clic o simplemente cambia de herramienta - el dibujo se conserva, no se descarta.
- **Escape** actúa peldaño a peldaño: la primera pulsación abandona el dibujo y no escribe nada, y la segunda sale de la pluma.
- **Delete** mientras dibujas elimina el último punto que colocaste.

El resultado es una caja normal en el lienzo. Muévela, redimensiónala, rótala, agrúpala, alinéala, reordénala, dale un relleno, un degradado, una sombra o una opacidad - un trazado se comporta como cualquier otra caja, y ninguno de esos controles lo trata de forma distinta.

Además llega ya pintado. El primer trazado que dibujas toma el relleno y el trazo que tu marca asigna a un trazado, y a partir de ahí cada trazado nuevo toma **lo último que usaste** - define un relleno una vez y sigue dibujando, en lugar de recolorear cada forma. (En una herramienta cuya marca no dice nada sobre trazados, un trazado dibujado se traza en el mismo color con el que lo viste dibujarse, así que nunca es invisible.)

**Volver a editar los puntos.** Haz doble clic en la forma (o usa **Editar puntos** en la barra del objeto) y los puntos vuelven. Arrastra un punto para moverlo, arrastra un manejador para reorientarlo, haz clic en cualquier parte de la curva para insertar un punto, encierra un grupo de puntos con un recuadro y pulsa Delete para eliminar los seleccionados. Un trazado conserva siempre al menos dos puntos, así que no puedes borrarlo por completo sin querer.

**Tipo de spline** decide qué clase de curva pasa por tus puntos, y es la elección que merece la pena entender:

| Tipo | Qué hace |
|---|---|
| **Suave (auto)** | El predeterminado. Calcula por su cuenta la longitud de los manejadores, así que un simple clic-clic-clic da una curva realmente suave sin pelearse con los manejadores. Si defines un manejador, este fija la *dirección* y la curva conserva el control de la longitud. |
| **Manejadores Bézier** | La pluma clásica. Los manejadores son los puntos de control, e insertar un punto nunca mueve la curva. |
| **A través de los puntos** | Pasa exactamente por cada punto que colocaste, sin manejadores. |
| **B-spline** | Fluye cerca de los puntos en lugar de por ellos, para una forma más suave. |
| **Líneas rectas** | Una polilínea. |

Cambiar un trazado existente a un tipo que calcula sus propios manejadores pregunta antes, porque las longitudes de manejador que definiste no se pueden recuperar - cambiar a **Manejadores Bézier** nunca pierde nada. A mitad de un dibujo no hay aviso: el cambio se aplica directamente al borrador, y los manejadores que ya hubieras sacado se van con él. En los tipos que gestionan sus propios manejadores, insertar un punto reforma la curva muy levemente; en **Manejadores Bézier** no.

Cada punto lleva además una regla de continuidad, indicada por su forma en el lienzo - cuadrado para **Esquina** (los manejadores se mueven de forma independiente), redondo para **Suave** (los manejadores permanecen alineados), redondo con anillo para **Simétrico** (alineados y de igual longitud). Aplícala a los puntos que selecciones y la curva vuelve a cumplirla al instante.

![Dos trazados de pluma renderizados directamente desde un enlace: una curva en S con trazo y una mancha cerrada con relleno](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Fboxes%3D%5B%7B%22id%22%3A%22paper%22%2C%22kind%22%3A%22box%22%2C%22x%22%3A0%2C%22y%22%3A0%2C%22w%22%3A1080%2C%22h%22%3A1080%2C%22shape%22%3A%22rect%22%2C%22bg%22%3A%22%23ffffff%22%7D%2C%7B%22id%22%3A%22curve%22%2C%22kind%22%3A%22path%22%2C%22x%22%3A140%2C%22y%22%3A180%2C%22w%22%3A800%2C%22h%22%3A420%2C%22shape%22%3A%22rect%22%2C%22bg%22%3A%22%22%2C%22stroke%22%3A%22%234f84ba%22%2C%22strokeW%22%3A14%2C%22path%22%3A%221!cubic!0_.02!.85!!!.25!-.45!s_.5!.5!-.22!.32!.22!-.32!y_.98!.12!-.25!.45!!!s%22%7D%2C%7B%22id%22%3A%22blob%22%2C%22kind%22%3A%22path%22%2C%22x%22%3A340%2C%22y%22%3A620%2C%22w%22%3A400%2C%22h%22%3A320%2C%22shape%22%3A%22rect%22%2C%22bg%22%3A%22%23d1e7ff%22%2C%22stroke%22%3A%22%234f84ba%22%2C%22strokeW%22%3A6%2C%22fillRule%22%3A%22nonzero%22%2C%22path%22%3A%221!catmull-rom!1_.5!0_1!.42_.78!1_.22!1_0!.42%22%7D%5D&width=1440&height=900&dpi=192&waitMs=2600&cropSelector=%23tool-canvas&walker=1&format=svg&dark=1&filename=pen-path-geometry)

Un trazado dibujado viaja en el enlace como todo lo demás, así que una forma que dibujes se reabre desde un enlace compartido y se renderiza igual desde la CLI. Nada de él depende del editor.

### Combinar formas (operaciones de trazado)

Selecciona dos o más formas, haz **clic derecho** en el lienzo (toque con dos dedos en táctil) y el menú ofrece las operaciones que esperarías de una aplicación de dibujo:

- **Unión** las fusiona en una sola forma, conservando la pintura de la que está más arriba.
- **Restar** recorta de la forma inferior todo lo que hay encima.
- **Intersecar** conserva solo el solapamiento.
- **Excluir** conserva todo menos el solapamiento.

Otras tres actúan sobre una sola forma: **Convertir trazo en contorno…** convierte un trazo en una forma rellena con el mismo contorno (útil cuando quieres conservar un grosor exactamente como se dibujó), **Desplazar trazado…** hace crecer la silueta hacia fuera o, con un número negativo, la encoge hacia dentro y **Simplificar** reconstruye un trazado con menos segmentos manteniendo la misma forma.

![Una media luna y un anillo con un agujero real, ambos producidos con Restar](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Fboxes%3D%5B%7B%22id%22%3A%22paper%22%2C%22kind%22%3A%22box%22%2C%22x%22%3A0%2C%22y%22%3A0%2C%22w%22%3A1080%2C%22h%22%3A1080%2C%22shape%22%3A%22rect%22%2C%22bg%22%3A%22%23ffffff%22%7D%2C%7B%22id%22%3A%22crescent%22%2C%22kind%22%3A%22path%22%2C%22x%22%3A120%2C%22y%22%3A330%2C%22w%22%3A374%2C%22h%22%3A400%2C%22shape%22%3A%22rect%22%2C%22bg%22%3A%22%234f84ba%22%2C%22path%22%3A%221!cubic!1_.750491!.957645!-.128211!-.062578!-.065985!.027232!c_.534759!1!.076762!!-.295339!!c_0!.5!!.276142!!-.276142!c_.534759!0!-.295339!!.200102!!c_1.000984!.254923!-.09169!-.152161!-.021205!-.003239!c_.935829!.25!.022185!!-.221505!!c_.534759!.625!!-.207107!!.14459!c%22%7D%2C%7B%22id%22%3A%22ring%22%2C%22kind%22%3A%22path%22%2C%22x%22%3A580%2C%22y%22%3A330%2C%22w%22%3A400%2C%22h%22%3A400%2C%22shape%22%3A%22rect%22%2C%22bg%22%3A%22%234f84ba%22%2C%22fillRule%22%3A%22nonzero%22%2C%22path%22%3A%221!cubic!1_1!.5!!-.276142!!.276142!c_.5!1!.276142!!-.276142!!c_0!.5!!.276142!!-.276142!c_.5!0!-.276142!!.276142!!c*1!cubic!1_.5!.7!-.110457!!.110457!!c_.7!.5!!.110457!!-.110457!c_.5!.3!.110457!!-.110457!!c_.3!.5!!-.110457!!.110457!c%22%7D%5D&width=1440&height=900&dpi=192&waitMs=2600&cropSelector=%23tool-canvas&walker=1&format=svg&dark=1&filename=path-ops-boolean-result)

El resultado es un trazado nuevo que puedes seguir editando con la pluma. Los agujeros son agujeros de verdad - un control **Regla de relleno** en el panel de trazo decide si los contornos superpuestos se rellenan (*non-zero*) o se perforan (*even-odd*).

Dos cosas que estas operaciones deliberadamente no hacen. **Se niegan en vez de destruir**: pide intersecar dos formas que no se solapan y se te dice que no queda nada, y nada cambia. Y las cajas de texto e imagen no tienen contorno con el que trabajar, así que se dejan tal cual en lugar de aproximarlas por su marco. Un resultado combinado se guarda como curvas Bézier simples, que es lo que hace también una aplicación de dibujo - el tipo de spline original no sobrevive a la operación.

### Escenas 3D

Elige **Escena 3D** en el menú de añadir de la barra de herramientas y arrastra un marco: 3D Studio se abre de inmediato sobre la caja nueva, y lo que ajustes allí vuelve al lienzo. En todo lo demás, una caja de escena es una caja normal. Muévela, redimensiónala, rótala, dale una sombra, ponla en una diapositiva o en la línea de tiempo, y se comporta como las demás.

**Una caja de escena conserva la receta, no una imagen.** Una caja de imagen contiene un archivo ya renderizado; una caja de escena contiene un único ajuste, la propia escena, escrita como la consulta de enlace propia de 3D Studio, con todo valor que siga en el predeterminado del estudio omitido. Por eso una escena pesa alrededor de cien bytes en lugar de los pocos kilobytes que cuesta una receta completa, por eso la misma cadena funciona tanto en un enlace de compartir como en la puerta del editor, y por eso un control nuevo del estudio no exige ningún cambio en Design. También es la razón por la que la caja se vuelve a renderizar al tamaño y en el momento que pida el documento, en lugar de ampliarse a partir de una imagen tomada antes. Las imágenes que usa una escena siguen siendo recursos y viajan por id, así que una subida dentro de una escena entra en un archivo `.lolly` junto con el resto del documento.

**Edítala en el estudio.** Selecciona la caja y el Inspector muestra una sección **Escena 3D**: una línea que nombra de qué está hecha la escena, una segunda que nombra su estudio de iluminación una vez que has elegido uno, y un botón, **Editar en 3D Studio**. El botón abre el estudio sobre la escena de esa caja con todos los controles que tiene la herramienta. Aplica, y la escena editada se escribe de vuelta en un único paso, así que un deshacer devuelve la caja a la escena de la que partiste; cierra el estudio sin aplicar y nada cambia. Todo lo demás sobre la caja - su lugar en el área de diseño, su tamaño, su sombra, cuándo llega en una diapositiva - permanece en las secciones que siempre usó. Una caja de escena no lleva imagen propia ni leyenda: su imagen viene del estudio, y sus palabras también se definen allí.

**Una escena en vivo, un póster en cada otra caja.** Toda caja 3D de un documento muestra un póster: una imagen fija de la escena, dibujada fuera de pantalla a través del grupo de renderizado compartido, al tamaño que ocupa la caja. Un documento con veinte escenas cuesta un solo contexto de dibujo, no veinte. Selecciona una caja de escena y se convierte en la única escena en vivo del documento; deselecciónala y el fotograma que estaba en pantalla se convierte en su póster, así que nada salta. Solo una escena está en vivo a la vez, y seleccionar dos cajas de escena a la vez deja a ambas como pósters. En esta versión, la escena en vivo es para mirar, no para orbitar: cambia una escena mediante **Editar en 3D Studio**. Un dispositivo que no puede abrir un contexto gráfico en coma flotante conserva el póster y explica por qué dentro de la caja, en lugar de mostrar un rectángulo en blanco, y el resto del documento no se ve afectado. Abrir un documento de Design sin ninguna caja 3D no carga ningún código 3D.

**En la línea de tiempo**, una caja de escena sigue al cabezal de reproducción como un clip de vídeo: su inicio, su recorte de entrada y su velocidad mueven la escena a través de su propia animación, y la duración de la escena es la que fijaste en 3D Studio, así que recortar una caja para acortarla muestra menos escena en lugar de acelerarla. Solo la caja de escena seleccionada está en vivo; todas las demás son una imagen fija, y una imagen fija no se puede recorrer.

**En una exportación**, cada escena se dibuja de nuevo al tamaño que necesita el archivo, mediante el mismo renderizador que usa el estudio. Un vídeo renderiza un fotograma por escena en cada momento; un PNG, SVG o PDF incrusta una imagen por caja al tamaño en píxeles propio de esa caja. Nada se fotografía desde la pantalla, así que una exportación no depende de qué caja tuvieras seleccionada. Una escena que no se puede dibujar hace fallar la exportación y te dice por qué, con las propias palabras del estudio.

**Compartir una escena construida sobre una subida propia.** Un enlace para compartir de un documento de Design lleva un id de subida local al dispositivo dentro de una escena tal cual está, mientras que una caja de imagen lo deja en blanco. Así que una escena cuyo arte o modelo es un archivo que subiste muestra el valor predeterminado del estudio para esa imagen en el dispositivo de otra persona, a menos que el documento viaje como un archivo `.lolly`, que sí lleva los bytes.

## Línea de tiempo (Sequence)

**Sequence** es la línea de tiempo de Design: añade el *tiempo* al lienzo libre. Cada caja puede empezar en un momento, durar un tiempo y animarse al entrar y al salir, y una línea de tiempo acoplada bajo el área de diseño es donde las organizas. Ábrelo y ya hay una secuencia en marcha - una tarjeta de título, un clip, una tarjeta final, un rótulo inferior y una base musical - así que el modelo se ve antes de que cambies nada.

![La línea de tiempo de Sequence: el transporte, la regla, una pista de superposición, la fila de secuencia magnética con sus clips y sus fichas de unión, y la franja Siempre activo](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Fz%3D11dZBb5swFADgX8MOiRYZB0J76GFpNO2wnbr7ZMwDrBg7s01C8usngmNwSqJszaT2aD8_G54_PUgJXRdK1iJ7CvAcpSHG6FMqG9BPQbwMkmWAMcsCjIP5lwDjUsp1O8DPAcZrJvpIKhsXaLpZ1I323mjXjcJHbCdKO4Ee7ISSxsvQJdmAO0cBNe6gtHDzQbKkkks101ARYRidaaBSZETtg2TlMgw0xuX8LBXANCN7PTVyWki3Kr-6b61yQmG4ay6FeWEHOL1K1E0TzgrhdqIgDCiXs_WjFcsyDi66A1aU_ZMuEPIOcwFNhHYRzgR8GySGs9CW0BDlFzWrVTe2qdCwftOcZP2TtJEfuovFyKZzIvor0fD7WKhVGzsXo2ALhH8UMxvFqmtiXmQFpmSimArYBfGzYHpKZcVEcS87-OHedpK72cHndmYWunu6rtxM-3wuwGqTXskacov-nhs15KNYG7HgWZtMvpNa0LJtUJNJi-2rYhnZ3ybtuNUVZuj9MotOrAbQFmPQbuB0uxwud4NX9-ycrmWIJw59Pg9h5AF6RGd-5vgWPhvG-2b5xs8bl5zvZ0ZK3tf_bd0pxu_lw2YDG2Jv6VRdj9Hi__WrKB7pV3OELuBKIRunReqM9f8d1tbnKPFsJVHs2Zqf9SaMLrSmASCjiNAbokD0lD0t_95Wxu-MVaQ4uT6WQ8ta0V46Z6lq9br1fVEOh7ypju-FFyjBC7fmVy0UaMm3YBcbVYMt-dhfTlUbe2BOuD6ujFd_AA&width=1440&height=900&dpi=192&waitMs=7000&waitSelector=.tl-clip&css=.tl-panel%7Bheight%3A252px!important%7D&cropSelector=.tl-panel&format=svg&walker=1&tolerance=0.03&dark=1&filename=seq-studio-timeline)

Hay dos clases de fila, y la diferencia es la idea entera:

- La **fila de secuencia** es *magnética*. Los clips van sin huecos, uno tras otro, y arrastrar uno reordena la serie en lugar de dejar un vacío. Elimina un clip y el resto se cierran. Esta es tu columna vertebral.
- Los **carriles de superposición** son libres. Un rótulo inferior, un logo, un subtítulo - cualquier cosa que flote sobre la columna en su propio momento - recibe su propio carril y su propio inicio.
- Debajo de ellos, **Siempre activo** reúne las cajas sin ningún tiempo asignado: decorado que simplemente está presente todo el rato. El `+` de una ficha asciende una a un carril; **Hacer que esté siempre activo** la devuelve.

![El escenario de edición: el tablero de arte en primer plano, el riel de herramientas a la izquierda y el HUD de zoom en la esquina](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Fz%3D11dZBb5swFADgX8MOiRYZB0J76GFpNO2wnbr7ZMwDrBg7s01C8usngmNwSqJszaT2aD8_G54_PUgJXRdK1iJ7CvAcpSHG6FMqG9BPQbwMkmWAMcsCjIP5lwDjUsp1O8DPAcZrJvpIKhsXaLpZ1I323mjXjcJHbCdKO4Ee7ISSxsvQJdmAO0cBNe6gtHDzQbKkkks101ARYRidaaBSZETtg2TlMgw0xuX8LBXANCN7PTVyWki3Kr-6b61yQmG4ay6FeWEHOL1K1E0TzgrhdqIgDCiXs_WjFcsyDi66A1aU_ZMuEPIOcwFNhHYRzgR8GySGs9CW0BDlFzWrVTe2qdCwftOcZP2TtJEfuovFyKZzIvor0fD7WKhVGzsXo2ALhH8UMxvFqmtiXmQFpmSimArYBfGzYHpKZcVEcS87-OHedpK72cHndmYWunu6rtxM-3wuwGqTXskacov-nhs15KNYG7HgWZtMvpNa0LJtUJNJi-2rYhnZ3ybtuNUVZuj9MotOrAbQFmPQbuB0uxwud4NX9-ycrmWIJw59Pg9h5AF6RGd-5vgWPhvG-2b5xs8bl5zvZ0ZK3tf_bd0pxu_lw2YDG2Jv6VRdj9Hi__WrKB7pV3OELuBKIRunReqM9f8d1tbnKPFsJVHs2Zqf9SaMLrSmASCjiNAbokD0lD0t_95Wxu-MVaQ4uT6WQ8ta0V46Z6lq9br1fVEOh7ypju-FFyjBC7fmVy0UaMm3YBcbVYMt-dhfTlUbe2BOuD6ujFd_AA&width=1440&height=900&dpi=192&waitMs=7000&waitSelector=.tl-clip&css=.fc-toolbar%7Bopacity%3A1!important%7D&format=svg&walker=1&tolerance=0.03&dark=1&filename=seq-studio-stage)

Abrir la línea de tiempo le entrega el teclado, así que la barra espaciadora y las flechas manejan el cabezal de reproducción en vez de la página - y como se abre sola en una composición que ya tiene tiempos, eso se cumple en cuanto carga Sequence.

> **[El editor de secuencias](/info/sequence-editor.html)** profundiza en las cuatro cosas que deciden si editar en el tiempo resulta predecible: qué clip edita un clic en el lienzo, los fantasmas de piel de cebolla de los clips vecinos, el alcance de la división y el Unir que deshace un corte y el recorte (incluido el juego de teclas). Pulsa `?` con la línea de tiempo enfocada para ver la hoja de atajos.

**Edición.** Arrastra el centro de un clip para moverlo o reordenarlo, arrastra a unos pocos píxeles de cualquiera de sus extremos para recortarlo y pulsa **Dividir en el cabezal de reproducción** (o `S`) para cortar un clip en dos. Dividir necesita un clip con una **Duración** real y el cabezal un poco dentro de él, así que un clip sin final definido (la base musical, por ejemplo) no se puede dividir. **Ajustar a los bordes** está activado por defecto y se ajusta a los bordes de los clips, al cabezal y a los segundos enteros, con Alt para anularlo. Cada arrastre es un único paso de deshacer, y la vista previa del arrastre hace la misma aritmética que la confirmación, así que lo que ves mientras arrastras es lo que obtienes.

Selecciona un clip y el inspector te da las mismas ediciones como números: **Duración**, **Recortar entrada** (a qué altura del origen empieza), **Velocidad** como un conjunto de multiplicadores fijos de ×0,25 a ×4, **Animar entrada** / **Animar salida** con sus duraciones y **Silenciar clip**. Un clip de la fila magnética no tiene campo **Inicio** a propósito - la fila es la dueña del orden, así que lo arrastras para moverlo.

**Las transiciones** son preajustes, no fotogramas clave: Fundido, Sacar, Expandir, Elevación, Soltar, los cuatro Deslizamientos, Acercar y Alejar, Inclinación, Barrido, Giro, Deriva o **Corte (sin animación)**. Las distancias escalan con el objeto, así que el mismo preajuste se lee bien en una tarjeta a pantalla completa y en una insignia pequeña. Entre dos clips contiguos de la fila de secuencia hay una **ficha de unión**: haz clic en ella y elige **Corte** o **Fundido cruzado**, que se aplica de inmediato y se cierra. Vuelve a abrir la misma ficha para cambiar la **Duración (ms)** y pulsa **Listo**. Un fundido cruzado se guarda como un fundido de salida de uno y un fundido de entrada del siguiente, y la disolución real se deriva de ese par: el primer clip sigue reproduciéndose más allá del corte y se desvanece mientras el siguiente aparece debajo. La vista previa y el archivo siguen la misma regla, así que lo que ves en la unión es lo que exportas.

**Sonido.** Añade un clip de **Audio** y vive en la línea de tiempo como cualquier otro clip: forma de onda, recorte, silencio. (La base generada que trae la sesión predeterminada es la única excepción - se sintetiza en el momento de exportar, así que su barra se queda lisa y muda hasta que renderizas.) Pulsa el micrófono para **grabar una voz en off** directamente sobre la línea de tiempo, con cuenta atrás y medidor de nivel, y la toma se guarda como recurso tuyo en el punto donde empezaste. Pulsa la cámara de al lado para **grabar un vídeo** de la misma manera: la toma se recorta al tamaño de exportación del área de diseño mientras se graba, así que la pequeña vista propia muestra exactamente lo que entra en la secuencia en el cabezal de reproducción, con el encuadre completo - la manera de recoger el clip de un colega desde un enlace compartido. La música, los diálogos y la banda sonora propia de un clip llegan todos a la mezcla exportada. (La **Pista de audio** del panel de exportación es otra cosa: una única base tendida bajo todo el clip, con fundido y atenuación. Las dos conviven.)

**La franja de audio.** Selecciona cualquier clip que lleve sonido y se abre una franja compacta bajo la línea de tiempo: un fader de **Volumen**, **Pan** para la posición estéreo, un **EQ** de tres bandas (**Bajo**, **Medios**, **Alto**), un control de **Tono** que transpone en semitonos sin que la voz pierda su carácter, y **Normalizar volumen**, que lleva el clip a la sonoridad de emisión (BS.1770) para que una nota de voz baja y una pista alta queden a nivel. Donde se encuentran dos clips, **Fundido cruzado** mezcla la unión en lugar de cortar. Una ranura de **Efecto** ejecuta procesamiento en el dispositivo sobre el clip - **Limpieza de voz** elimina el ruido de sala y el siseo de una grabación. Los cambios de velocidad también conservan el tono: un clip ralentizado o acelerado se estira en el tiempo, no suena como una ardilla. En cada mezcla, la exportación atenúa la música bajo el habla a medida que esta aparece y desaparece, y mantiene todo el programa bajo un limitador de pico real, así que nada se corta a la salida; una forma de onda que se habría cortado se dibuja con un aviso en el punto donde ocurre.

![La línea de tiempo con el clip de música seleccionado: su franja recorre la parte inferior con Velocidad, Fundidos, Volumen, Desplazar, EQ, Tono, Normalizar volumen y la ranura de Efecto](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Fbx%3Dt1%252Ctext%252C200%252C140%252C1500%252C220%252C0%252Crect%252C16%252C%252C100%252C%252Ccontain%252Cnormal%252CVoiceover%252520session%252C%25257Bcolor.semantic.text%25257D%252C48%252Ccenter%252Cmiddle%252C500%252Csans%252C1.12%252C0%252Ctrue%252Cfalse%252C%252C%252C8%252Cnone%252C00000055%252C0%252C0%252C10%252Ccenter%252Cfalse%252C%252C%252C0%252Cnonzero%252C0%252C3.3%252C0%252C1%252Cnone%252Cnone%252C400%252C400%252Cfalse%252Cseq%252C%252Cround%252Cround%252C%252C0%252C0%252C0%252C0%252C%252C%252C%252C0%252Ctrue%252Cnone%252Cnone%252C%252Cfalse%252C%252C%252C%252C0%252C%252C%252Cfalse%252C%252C%252C%252C%252Cfalse%252Cfalse%252C%252C1%252C%252Cfalse%252C%252C60%252C%252C%252C1%257Ea1%252Caudio%252C200%252C500%252C400%252C80%252C0%252Crect%252C16%252C%252C100%252Clolly%25252Floops%25252F3-am-echoes%252Ccontain%252Cnormal%252C%252C%25257Bcolor.semantic.text%25257D%252C48%252Ccenter%252Cmiddle%252C500%252Csans%252C1.12%252C0%252Ctrue%252Cfalse%252C%252C%252C8%252Cnone%252C00000055%252C0%252C0%252C10%252Ccenter%252Cfalse%252C%252C%252C0%252Cnonzero%252C0%252C3.3%252C0%252C1%252Cnone%252Cnone%252C400%252C400%252Cfalse%252C%252C%252Cround%252Cround%252C%252C0%252C0%252C0%252C0%252C%252C%252C%252C0%252Ctrue%252Cnone%252Cnone%252C%252Cfalse%252C%252C%252C%252C0%252C%252C%252Cfalse%252C%252C%252C%252C%252Cfalse%252Cfalse%252C%252C1.3%252C%252Cfalse%252C%252C60%252C%252C%252C1%26_sel%3Da1&width=1440&height=900&dpi=192&waitMs=5000&waitSelector=.tl-clip&css=.tl-panel%7Bheight%3A300px%21important%7D&cropSelector=.tl-panel&walker=1&format=svg&dark=1&filename=tl-audio-strip&drive=click%3Abutton%3Ahas-text%28%22Inspector%22%29)

**Renderizarlo.** Una exportación de movimiento es una **composición determinista**, no una grabación de pantalla - cada fotograma se decodifica, se dibuja y se codifica en un instante exacto, así que el archivo no depende de que tu máquina siga el ritmo, y no hay un techo práctico de fotogramas en MP4 ni en WebM. La propia duración de la línea de tiempo fija la duración salvo que escribas una. Las Content Credentials se estampan igual que en cualquier otra exportación. Una exportación fija te da el fotograma del cabezal, o una hoja de contactos entera desde el campo **Fotogramas** junto al tamaño de salida - consulta [Exportar](/info/exporting.html#stills-from-a-timed-composition).

Unos límites que conviene tener presentes: una secuencia está limitada a una hora, GIF y PNG animado guardan sus fotogramas en memoria, así que se quedan cortos, un clip reproducido más rápido o más lento conserva su tono (la franja de audio lo estira en el tiempo, y un control de **Tono** transpone en semitonos conservando el carácter de la voz) y **Grabar en directo** está oculto aquí porque el compositor es el mejor camino.

**Más allá de los preajustes: fotogramas clave, profundidad y una cámara.** Una transición anima un clip cuando llega y cuando se va. Para posar una caja *dentro* de un clip - hacerla derivar, aparecer o desaparecer en fundido, difuminarla, levantarla de la página y volver a asentarla - añade fotogramas clave: selecciona el clip, pulsa **+Fotograma clave** (el rombo en el grupo de herramientas de la línea de tiempo, el rombo en la barra de objeto del lienzo, o `K`), y la posición de la cabeza de reproducción decide qué pose escribe tu próxima edición. El mismo sistema de fotogramas clave le da a cada composición cronometrada una **cámara** que se acerca, gira y enfoca, y convierte un SVG plano en una pila de capas entre las que puedes volar. **[Animar](/info/animating.html)** es la guía completa.

La herramienta Design tiene la misma línea de tiempo, así que puedes dar tiempos a una composición sin cambiar de herramienta, y también exporta movimiento.

## Presentar

Para colocar tu cámara, un logo y una leyenda con tu nombre sobre la imagen del público, usa **Present with camera**. Sus controles propios, las escenas guardadas, los pasos de compartir y de grabación se explican en [Presentar con cámara](/info/presenting.html). Los controles habituales de la presentación de abajo siguen disponibles mediante **Presentar**.

Un documento de Design hecho de **áreas de diseño** ya es una presentación. Abre el **menú de Lolly** en la barra de herramientas y elige **Presentar** - la última fila - y cada área de diseño se convierte en una diapositiva a pantalla completa, en el orden en que las áreas están colocadas en el lienzo. La presentación funciona sobre una copia de las áreas renderizadas, así que nunca se toca el editor de debajo y al salir vuelves exactamente a donde estabas.

- **Avanzar** con **Space**, `→`, **Page Down** o un clic en la franja del borde derecho de la pantalla; retrocede con `←`, **Page Up** o la franja del borde izquierdo. **Home** y **End** saltan a la primera y a la última diapositiva. Una pequeña barra de controles aparece con un fundido cada vez que mueves el puntero y vuelve a ocultarse en cuanto te detienes.
- **Vista general** (`O` o el botón de cuadrícula) dispone todos los tableros a la vez, en el orden que les diste en el lienzo; haz clic en uno para abrirlo.
- **Pasos de revelado.** Haz clic con el botón derecho en un cuadro y elige **Revelar en el paso 1**, **2** o **3** en lugar del valor predeterminado **Siempre visible**. Ese cuadro espera entonces hasta que avances a su paso, así que una diapositiva puede llegar por partes; los cuadros que comparten número llegan juntos.
- **Vista del ponente** (`S`) abre una segunda ventana con la diapositiva actual, la siguiente, tus notas para esa diapositiva y un cronómetro en marcha. Si el navegador bloquea la ventana emergente, recurre a un panel sobre la presentación. Las notas se definen por tablero y nunca aparecen en la propia diapositiva.
- `B` mantiene una pantalla en negro (cualquier tecla trae de vuelta la diapositiva), `F` vuelve a pantalla completa y **Escape** retira una capa cada vez: de la vista general a la presentación, de la presentación al editor.
- **Modo quiosco.** Dale a un tablero una **Duración** y la presentación se queda ahí ese tiempo, y luego avanza sola tras una barra de progreso fina; `K` (o el botón de pausa, que solo aparece una vez que algo tiene duración) la detiene y la reinicia. Añade `kiosk` al enlace y la presentación da la vuelta al llegar al final, que es lo que la convierte en cartelería.

- **Pilas de subdiapositivas.** Haz clic derecho en un área de diseño y elige **Apilar bajo la diapositiva anterior** y se convierte en un paso de esa diapositiva en lugar de una diapositiva propia: la vista general muestra una sola tarjeta, la presentación recorre la pila en orden, y la fila **Pila** del inspector indica a qué diapositiva pertenece.
- **Transformar.** Cuando dos diapositivas consecutivas llevan una caja con el mismo nombre de **Coincidencia Morfosis** (clic derecho en una caja, o la fila **Coincidencia Morfosis** del inspector - `hero`, por ejemplo), la transición mueve esa caja de donde estaba a donde está, redimensionándola y recoloreándola por el camino, en lugar de cortar. Una transición **Transformar** para toda la presentación hace lo mismo con cada par emparejado.
- **Narración.** Las **Notas del orador** de cada área de diseño se pueden leer en voz alta. En la sección **Documento** del inspector elige una **Voz**, opcionalmente una segunda voz para **Mezclar con**, la **Velocidad** de lectura, y una **Entrada** y una **Cola** en milisegundos alrededor de cada diapositiva; activa **Mostrar subtítulos al presentar** y las palabras aparecen a medida que se pronuncian. La voz se ejecuta en tu dispositivo. Las mismas notas se convierten en la película en una exportación de vídeo, en audio real de diapositiva en una exportación de PowerPoint, y en la película narrada dentro de un [paquete SCORM](/info/create/exporting.html#scorm-course-packages).

![La sección Documento del inspector: Voz, Mezclar con, Velocidad, Entrada, Cola y Mostrar subtítulos al presentar](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Ftemplate%3Dfeature-tour&width=1440&height=900&dpi=192&waitMs=3500&cropSelector=.fc-insp&walker=1&format=svg&dark=1&filename=design-narration)

La presentación también es un enlace. `?present` la abre directamente, `s=` elige la diapositiva - una posición, el id de un área de diseño o `id.step` para un paso de construcción - y la dirección se actualiza a medida que avanzas, así que lo que envías es la diapositiva en la que estás. Para quien crea herramientas: esos parámetros están documentados en la página [Modo URL](/info/url-parameters.html#reserved-parameters).

## En un teléfono

En pantallas estrechas, el diseño se reorganiza en una sola columna:

- Los **controles se convierten en una hoja** en la parte superior con un **asa de arrastre** en su borde inferior. Arrastra el asa para redimensionarla - se ajusta a **asomada / media / completa** - o **toca** el asa para alternar entre colapsada y expandida. La vista previa llena el espacio de abajo y permanece visible mientras editas.
- Un botón flotante **Exportar** abre la hoja de exportación - todos los controles de formato, tamaño, copiar, guardar y descargar en un solo lugar. Ciérrala tocando el fondo.

![Una herramienta en una pantalla de ancho de teléfono - los controles como una hoja arriba, la paleta generada llenando la vista previa abajo y la píldora de renderizado flotando en el centro inferior](/t/url-shot?url=%2F%23%2Ftool%2Fcolor-palette%3Fseed%3Df97316%26harmony%3Dadjacent-3%26steps%3D9&width=430&height=900&dpi=192&waitMs=2200&walker=1&format=svg&dark=1&filename=vt-phone-palette)

## Controles (entradas)

Las herramientas exponen solo las entradas que están pensadas para variar - todo lo demás (colores, composición, tipografía, lógica) queda fijado por quien creó la herramienta, así que lo que hagas siempre cumple las reglas que estableció. Las entradas incluyen texto, deslizadores, selectores de color, menús desplegables, fechas, selectores de imagen y grupos de filas repetibles. Algunas se agrupan en secciones plegables.

![La pila de controles de una herramienta - un campo de texto, selectores de color y un deslizador, y nada más de lo que quien la creó decidió dejar fijado](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools&width=1440&height=900&dpi=192&waitMs=2500&cropSelector=%23tool-inputs&walker=1&format=svg&dark=1&filename=use-tool-inputs)

**Restablecer:** *Descartar cambios* devuelve cada entrada a sus valores predeterminados.

### Deshacer y rehacer

**Cmd/Ctrl-Z** retrocede un paso y **Cmd/Ctrl-Shift-Z** (o **Cmd/Ctrl-Y**) vuelve a avanzar. El mismo par aparece como botones **Deshacer** y **Rehacer** en la fila sobre los controles - en el lienzo libre están en la barra de herramientas - y cada uno se atenúa mientras no queda nada que recuperar. Cada paso dice lo que fue: deshaz un color y un pequeño mensaje nombra la entrada que acaba de restaurar, con un botón **Rehacer** dentro para volver.

- **Un arrastre es un solo paso.** Los cambios repetidos en el mismo control dentro de medio segundo se fusionan, así que recorrer un deslizador de punta a punta es un solo deshacer y no doscientos.
- **Se conservan los últimos 100 pasos** - los más antiguos se van cayendo. Hacer una edición nueva después de deshacer borra la pila de rehacer, como en todas partes.
- **Mientras el cursor está en un cuadro de texto**, Cmd/Ctrl-Z pertenece al propio campo, carácter a carácter. Lolly toma el relevo en los controles que no tienen un deshacer útil propio: deslizadores, menús desplegables, colores e interruptores.
- **Elegir un archivo** en una entrada de tipo **archivo** no es un paso - esos bytes se guardan solo para la sesión, así que no habría nada que devolver.

En una [colaboración](/info/collaborate.html) en directo, el historial sigue siendo solo tuyo. Un cambio que llega desde el otro dispositivo nunca aterriza en tu pila, así que deshacer solo puede recuperar algo que hiciste tú.

Deshacer solo alcanza hasta el principio de esta visita; las herramientas que guardan mientras trabajas también conservan versiones anteriores bajo **Historial**, junto a **Deshacer** (consulta [Vuelve a una versión anterior](/info/find-your-work.html#go-back-to-an-earlier-version)).

## Tus datos y tu foto

**Ajustes** (arriba a la derecha en la galería, mostrando tu nombre de pila en cuanto lo configures) guarda tu nombre, tus datos de contacto y una **foto** opcional. Las herramientas que piden esos campos los rellenan automáticamente - configúralos una vez y tu firma de correo, tus lockups y tus insignias se completan solos. Aun así, puedes anular cualquier campo en cada sesión. Actívalo con **Usar mis datos para crear** para que tus datos viajen como autoría en lo que exportas.

Tu foto y tus datos viven **solo en este dispositivo**. Un perfil puede ser más que solo tú - un equipo o un rol que asumes de vez en cuando. Consulta **[Perfiles](/info/profile.html)** para ver el panorama completo, incluido cómo mantener más de uno.

## Guardar y continuar

Para conservar tu trabajo, pulsa **Guardar como**, la marca de verificación junto a **Exportar**. En **Save to a project**, deja seleccionada **Mi biblioteca** o elige un proyecto (**＋ Nuevo proyecto…** crea uno), luego pulsa **Guardar**. Guardar de nuevo actualiza el mismo elemento en lugar de hacer una copia. En Design, **Guardar como** está en el menú bajo el logotipo de Lolly; en un móvil, pulsa **•••**, luego **Menú de archivo**, luego **Guardar como**.

El botón **Guardar** del panel de exportación hace lo mismo en un clic y nunca descarga un archivo: el trabajo nuevo va a Mi biblioteca, y el trabajo que ya guardaste se actualiza donde está.

Para volver más tarde, pulsa **Inicio** en la esquina superior izquierda, luego abre la pestaña **Proyectos** (un icono de carpeta en el teléfono). Las sesiones de Mi biblioteca están en su primera pantalla; un proyecto es una carpeta ahí. Los elementos llevan el nombre del archivo que escribiste en el panel de exportación, o si no, el de su herramienta, como **QR Code**. Abre uno y cada ajuste está ahí, listo para cambiarlo y exportar de nuevo.

El trabajo guardado permanece en este dispositivo, en el navegador o la app desde donde lo guardaste, a menos que actives [Sincronización](/info/sync.html). Un archivo que obtienes con **Descargar** es una copia terminada; para cambiarlo más tarde, abre el elemento guardado en Proyectos. Si algo no está donde lo esperas, consulta [Encuentra y recupera tu trabajo](/info/find-your-work.html).

![La píldora de renderizado de dos mitades - una flecha hacia arriba que abre el panel de exportación, y una marca de verificación etiquetada Guardar como que abre la hoja de guardado](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools&width=1440&height=900&dpi=192&waitMs=2500&css=%23tool-inputs%7Bdisplay%3Anone%7D&cropSelector=.render-pill&walker=1&format=svg&dark=1&filename=use-render-pill)

## Proyectos

**Proyectos**, la pestaña **Proyectos** en la parte superior de la pantalla de inicio, guarda todo lo que has guardado, en las carpetas que crees. Encontrar, ordenar y buscar tu trabajo ahí, y restaurar un elemento desde la **Papelera**, está en [Encuentra y recupera tu trabajo](/info/find-your-work.html#find-something-you-saved).


## Compartir tu trabajo

Un diseño sale de una de estas dos maneras: como enlace o como archivo. El diálogo de Compartir ofrece ambas. Ábrelo con **Compartir** en los controles de exportación; **Compartir enlace** en una sesión guardada de Proyectos abre el mismo diálogo para esa sesión.

### El enlace

Cada entrada queda capturada en la URL de la página, así que un enlace *es* el diseño. En la parte superior del diálogo está el enlace listo para copiar, con dos secciones plegadas debajo.

- **Link options** contiene **Open in the installed app** (cambia el campo a una URI `lolly://` para Atajos, lanzadores y automatización, con todos los parámetros sin cambios), **Shortest link** (un diseño grande genera una URL larga, así que esto empaqueta todo el estado en un token compacto y te muestra el ahorro en caracteres; la forma legible sigue estando siempre), **Password-protect this link** (AES-256 sobre todo el enlace, y la contraseña nunca dentro) y **Pin this tool version** - el indicador `_v`, que clava el enlace a la versión de la herramienta que estás viendo para que una actualización posterior no pueda cambiar lo que renderiza.
- **Link behaviour** es lo que ocurre cuando quien lo recibe lo abre: pantalla completa, el panel de exportación ya desplegado, descarga al abrir con `&export` o copia al portapapeles con `&copy`.

Pégale el enlace a un colega, guárdalo en marcadores o inclúyelo en un commit. (Detalles completos: [Modo URL](/info/url-mode.html).)

**Algunas herramientas hacen del enlace el producto entero.** Jump Page reúne tus enlaces en una sola página para repartir - un enlace de bio, una charla de conferencia, un escaparate. No hay nada que alojar ni ninguna cuenta detrás: la página es el enlace, así que se abre tan rápido como viaja la URL. En el editor ves la página terminada junto a los campos; quien abre el enlace la recibe a todo lo ancho, una escena por enlace conforme se desplaza.

![Jump Page en el editor: la escena del título en la parte superior de la página, con las escenas de enlaces debajo](/t/url-shot?url=%2F%23%2Ftool%2Fjump%3Ffull%26heading%3DFind%2520us%2520everywhere%26subheading%3DOne%2520link%2520for%2520everything.%26links%3DURL%252CName%252CEmoji%257Ehttps%25253A%25252F%25252Fexample.com%252CWebsite%252C%257Ehttps%25253A%25252F%25252Fexample.com%25252Fnews%252CNewsletter%252C%257Ehttps%25253A%25252F%25252Fexample.com%25252Fhello%252CSay%252520hello%252C&width=900&height=1300&dpi=96&waitMs=2000&cropSelector=%23tool-canvas&walker=1&format=svg&dark=1&filename=use-jump-page)

**El diálogo dice lo que un enlace no puede llevar.** Tres cosas no caben en una URL: una imagen o un archivo que añadiste desde este dispositivo, un valor de texto muy largo o una lista muy grande. Cada una se cuenta mientras se construye el enlace. Si hubo que dejar algo fuera, el diálogo lo nombra y te señala el archivo de más abajo, en lugar de darte un enlace que se abre sin la imagen. Un enlace que solo es *largo* recibe un aviso más suave con su recuento de caracteres, ya que empaquetarlo aún puede salvar la longitud.

### El archivo .lolly

`.lolly` es la extensión de paquete portátil de Lolly, no una promesa de que todo archivo contenga lo mismo. El `format` en `manifest.json` es la autoridad. La app lee primero ese manifiesto diminuto y muestra el tamaño, el contenido y la acción antes de escribir nada:

- Un **diseño compartido** (`lolly-share`) contiene una sesión guardada de una herramienta, sus archivos incrustados y un recibo para cualquier cosa que todavía se resuelva por referencia. También puede llevar la herramienta y el sistema de diseño usados para crearlo. Abrirlo añade un nuevo Proyecto; nunca sobrescribe una sesión existente.
- Un **proyecto compartido** (`lolly-share` con el tipo `project`) contiene una carpeta de Proyectos: sus subcarpetas, cada sesión guardada archivada en ellas, la miniatura de cada sesión y las imágenes archivadas ahí. Abrirlo añade una copia de toda la carpeta a Proyectos; nada de lo que ya hay se reemplaza. Un Lolly de antes de que existieran los archivos de proyecto no puede leer uno y pide actualizar.
- Un **paquete de sistema de diseño** (`lolly-brand`) contiene tokens y puede contener tipografías, logos, versiones publicadas y recursos retenidos. Abrirlo lo añade como un sistema de diseño con nombre propio y separado, y luego cambia a él; los sistemas ya presentes en el dispositivo permanecen.
- Un **espacio de trabajo de marca / paquete de instancia** es un `lolly-brand` con herramientas declaradas, recursos de catálogo y, opcionalmente, una dirección de instancia. La comprobación previa enumera esos efectos a escala de todo el dispositivo, porque cargarlo reemplaza la única superposición de espacio de trabajo cargada anteriormente.

Una **copia de seguridad completa del dispositivo o del perfil no es un `.lolly`**. Sigue siendo un `LollyTools-….zip` con formato `lolly-backup`, y se restaura mediante **Ajustes → Almacenamiento → Importar datos…**, que también lee una copia que Sincronización guarda en tu almacenamiento. Una carpeta de herramienta comprimida sin más también sigue siendo `.zip`. En otras palabras, los paquetes de sesión y de sistema de diseño son dueños de `.lolly`; los flujos de copia de seguridad y de archivo suelto no lo son.

**Download .lolly**, en el diálogo de Compartir de la herramienta en la que estás trabajando, escribe el diseño actual como un paquete de diseño compartido. Lleva la sesión guardada junto con las imágenes y los archivos disponibles en este dispositivo. El arte habitual del catálogo viaja también. El arte con licencia se retiene a menos que lo incluyas explícitamente, y un archivo obsoleto o no disponible sigue siendo una referencia externa en lugar de desaparecer. El recibo preparado muestra el tamaño real del `.lolly`, el número de archivos incrustados, el número de referencias externas y si la herramienta está incluida. Donde tu dispositivo tiene una hoja de compartir, **Enviar a…** entrega ese archivo directamente a ella (AirDrop, un compartir de Android) en lugar de guardarlo en el disco.

**Download project (.lolly)**, en el menú de una carpeta dentro de **Proyectos**, escribe esa carpeta como un proyecto compartido, para que otra persona pueda abrirla y seguir con cada sesión que contiene. Cada sesión viaja como su propia parte (`sessions/<key>.json`, con su miniatura bajo `thumbs/`), el árbol de carpetas se enumera en `manifest.json`, y las subidas y el arte del catálogo viajan bajo las mismas reglas que un solo diseño compartido. Las sesiones de lote no son sesiones de herramienta y se quedan atrás; el aviso dice cuántas. **Descargar originales**, al lado, no cambia: un zip sencillo de cada elemento como su propio archivo.

Un `.lolly` es un zip normal. Renómbralo a `.zip` y ábrelo: tus propias imágenes están en `assets/uploads/` y el material del catálogo en `assets/catalog/`, cada uno con su nombre y su extensión reales, `manifest.json` los enumera todos y un README en la raíz explica qué es el archivo.

Tres cosas las decides tú antes de que salga:

- **Si tu nombre entra o no.** Tu nombre, correo y organización se escriben en el archivo solo cuando **Use my details to create** está activado en tu perfil. Con esa opción apagada, el archivo registra que se hizo con Lolly y cuándo - nada sobre ti.
- **Si el arte con licencia entra o no.** Los activos con licencia y bloqueados por marca se retienen por defecto. Si el diseño usa alguno, el diálogo dice cuántos hay y ofrece dos botones - *Download without them* o *Include and download* - porque incluirlos entrega los archivos reales a quien abra el `.lolly`.
- **Si la herramienta entra o no.** **Include the tool** empaqueta los propios archivos de la herramienta junto con el diseño, para que se abra en un dispositivo que no tiene esa herramienta. Llega marcado para una herramienta personalizada - un fork o una herramienta de marca privada que tu destinatario probablemente no tenga - y sin marcar para una herramienta que figura en el catálogo firmado, ya que su copia viene de la misma fuente. (En una compilación sin catálogo firmado, toda herramienta cuenta como personalizada y la casilla empieza marcada.)

**Abrir uno.** En una app de escritorio o móvil instalada, haz doble clic o toca un `.lolly`, elige **Open with Lolly**, o envíaselo a Lolly desde la hoja de compartir del sistema. macOS, Windows, Linux, iOS y Android registran todos el formato; los gestores de archivos de escritorio lo muestran como un documento de Lolly (y GNOME Files puede mostrar la miniatura propia de una sesión guardada). En la app web, usa **Abrir** o suelta el archivo sobre Lolly. Cada puerta usa la misma comprobación previa basada primero en el manifiesto. Abrir desde Brand Studio recomienda la acción de sistema de diseño cuando un diseño compartido lleva uno, pero nunca renombra el archivo ni oculta **Diseño abierto compartido**.

Un documento de iOS o Android entregado desde otra app está limitado a 48 MB, porque el traspaso nativo tiene que copiar sus bytes a través del límite entre apps. La app móvil lo dice en lugar de ignorar en silencio un archivo demasiado grande. **Abrir** dentro de Lolly no usa ese traspaso; es la vía que probar para un paquete más grande.

Tras la confirmación, el lector elegido descomprime y verifica el paquete una sola vez. Los recursos de un diseño compartido van a tu biblioteca, su sesión va a Proyectos y su herramienta se abre cuando está disponible. Las sesiones de un proyecto compartido van a Proyectos bajo una copia nueva de sus carpetas, con ids nuevos para que el mismo archivo se pueda abrir dos veces, y la carpeta se abre; una sesión cuya herramienta falta en este dispositivo espera ahí. Un recurso que ya está en el dispositivo se identifica por checksum y se reutiliza. Un paquete de sistema de diseño se guarda en su propio espacio de nombres antes de que la app cambie a él. Los archivos de más de 100 MB se señalan como grandes, y la comprobación previa avisa cuando el almacenamiento del navegador indica menos espacio libre del que necesita la carga declarada. Cada parte cubierta por integridad se comprueba antes de que la operación se confirme; una copia dañada se rechaza y el destino recién creado se revierte.

Si el archivo lleva una herramienta que no tienes, Lolly pregunta antes de que esa herramienta pueda ejecutarse: **¿Confiar en esta herramienta?** la nombra a ella y a su autor y dice con claridad que abrirla ejecuta el código de la herramienta en tu dispositivo, con **Confiar e instalar** como la vía para seguir. Si lo rechazas, el trabajo compartido se guarda igualmente en tus proyectos, esperando ahí al día en que añadas la herramienta. (Un tipo de herramienta todavía no se puede cargar así - una cuyo código se distribuye como módulo - y se rechaza de la misma manera.)

Tanto un enlace como un archivo entregan una instantánea. Para trabajar en la misma sesión *a la vez* que otra persona - dos dispositivos, sin servidor, sin necesidad de internet si estáis en la misma red - consulta [Trabajar juntos](/info/collaborate.html).

## Cámara en vivo (herramientas que reaccionan al movimiento)

Todos los **Filtros** de foto - Halftone, Scanline, Posterize, celdas de Voronoi, Tratamiento de color, Estirado de píxeles e Imperfecciones - muestran un botón **Activar en vivo** donde haya una cámara disponible. Actívalo y el efecto sigue tu cámara web fotograma a fotograma, así que reacciona al movimiento; puedes grabar el resultado en GIF, WebM o MP4. Los fotogramas se leen y se procesan **en tu dispositivo** y nunca salen de él, y la cámara se libera en cuanto detienes o abandonas la herramienta. (Cualquier selector de imagen también tiene **Tomar una foto** para capturar un solo fotograma como imagen local.)

## Mis imágenes

Cuando una herramienta te permite añadir una imagen desde tu dispositivo, se conserva exactamente como llegó - así un Content Credential que lleve sigue verificándose - y se guarda en tu biblioteca personal **Mis imágenes** (en **Ajustes → Almacenamiento**). Solo un archivo verdaderamente enorme pregunta si conservarlo o redimensionarlo. Reutilízala en cualquier herramienta. Para borrar EXIF/GPS a medida que entran las imágenes, activa **Eliminar metadatos de los archivos subidos** en tu perfil. No hay límite: la biblioteca es totalmente local y solo la limita el almacenamiento de tu dispositivo - gestiona o elimina imágenes ahí.

## Recursos - tu biblioteca

**Recursos** (`#/a`, o el segmento **Recursos** del selector Herramientas · Utilidades · Recursos · Proyectos en la parte superior de cada vista de listado) reúne todo lo que tus herramientas pueden aprovechar - logos de marca, imágenes, audio y animación, agrupados por tipo - y es también donde viven tus **propios archivos creativos**. Sin servidor, sin consola de administración, sin pull request: todo está en tu dispositivo.

![Recursos, con las muestras y las tipografías de la marca, y tus propias subidas](/t/url-shot?url=%2F%23%2Fa%3Fsection%3Dswatches%2Cfonts&width=1440&height=900&dpi=96&waitMs=2400&css=.plat-swatch-grid~%2A%7Bdisplay%3Anone%7D&walker=1&format=svg&localize=1&dark=1&filename=assets)

- <!--i:upload--> **Trae tus archivos.** Arrastra cualquier imagen, SVG, clip de audio, vídeo, Lottie, PDF o presentación de PowerPoint a la zona de subida - o haz clic para elegir - y llega a Recursos al instante, listo en el selector de assets de cada herramienta. Un PDF de varias páginas o un `.pptx` pregunta qué páginas o diapositivas conservar - cada una se convierte en un asset SVG. Importa todo lo que quieras; nunca sale de tu dispositivo.
- <!--i:star--> **Marca como favorito lo que usas a menudo.** ★ un asset (o un color de marca) y se fija arriba en cada selector, para que tu logo o color habitual estén a un clic.
- <!--i:folder--> **Ordena.** Recategoriza un asset a otro grupo, oculta un asset de marca compartido que no usas (con **Mostrar ocultos** para recuperarlo) o elimina directamente tus propias subidas. El mismo gesto de selección múltiple y la misma barra de acciones flotante que en Proyectos funcionan aquí también, así que todo eso se puede hacer sobre una selección entera a la vez.
- <!--i:layers--> **Separa un vídeo de su fondo.** Abre el detalle de un vídeo o haz clic derecho en su tarjeta en cualquier selector de assets, y elige **Eliminar fondo…** para guardar una alternativa transparente - un WebP o PNG animado con canal alfa real. Elige un **Método**: un **Modelo en el dispositivo** recorta un sujeto de una escena cargada, o una **Clave de color** recorta un fondo uniforme y bien iluminado como una pantalla verde o una pared lisa, con **Tolerancia**, **Suavidad** y **Eliminación de derrame** para ajustar el borde. La clave de color no necesita ninguna descarga de modelo ni red, así que **Eliminar fondo** se ofrece en cualquier vídeo y suele quedar más limpio en material bien nítido. Un control de **Resolución** (360, 480, 720 o 1080p, nunca más allá de la fuente) cambia detalle por un archivo más pequeño y rápido. Se ejecuta como tarea en segundo plano en tu dispositivo. El recorte final se guarda junto al original como su propio asset, y el Content Credential del vídeo de origen viaja con él como ingrediente. (Consulta [Generado una vez, renderizado igual](/info/ai-features.html) para saber por qué quitar un fondo sigue siendo una edición sencilla.)

### Lleva tu paleta y tus tipografías a cualquier parte

El panel de **Muestras** de Recursos no es solo para consultar - haz clic en un color para copiarlo, o **descarga toda la paleta de marca** en el formato que hable tu otra herramienta:

- <!--i:code--> **Design tokens (JSON)**, **variables CSS** o **clases CSS** - lleva la marca directamente a una hoja de estilos o a una compilación;
- <!--i:palette--> **Adobe Swatch Exchange (.ase)** - cárgala en Illustrator o Photoshop;
- <!--i:pentool--> **Paleta de GIMP (.gpl)** - para GIMP o Inkscape.

![El panel de Muestras - los cinco botones de descarga de paleta en la parte superior y luego cada color de marca como una ficha que se puede copiar](/t/url-shot?url=%2F%23%2Fa%3Fsection%3Dswatches&width=1440&height=900&dpi=96&waitMs=1800&css=.cat-group%3Anot%28%5Bdata-group%3Dswatches%5D%29%7Bdisplay%3Anone%7D&cropSelector=%5Bdata-group%3Dswatches%5D&walker=1&format=svg&dark=1&filename=use-swatch-downloads)

El panel de **Tipografías** lista las tipografías de tu marca con una **descarga** junto a cada una, para instalarlas localmente o entregarlas a una imprenta. (La sala de Colores del [Brand Studio](/info/brand-studio.html) ofrece la misma descarga de paleta.)

Los recursos son una mitad del camino abierto y de hazlo-tú-mismo; la otra es **crear tus propias herramientas** - el lienzo libre (Design, descrito arriba) te permite construir una visualmente, sin necesidad de código.

## Sonido y accesibilidad

Lolly aspira a ser cómodo de usar para todo el mundo. La interfaz se puede navegar con el teclado, los controles personalizados llevan etiquetas adecuadas para lectores de pantalla y la vista previa en vivo de cada herramienta se expone como una única imagen etiquetada que describe lo que está creando.

Una capa suave de **sonidos asistivos** confirma lo que haces - al llegar a la galería, al comprobar si unas Content Credentials son válidas o no, al cerrar un panel, al cambiar un filtro. Está **desactivada por defecto**: activa **Sonido** en cualquier lugar donde aparezca el interruptor (el popover de opciones de cada vista, o **Ajustes**), y la elección se recuerda.

Cuatro ajustes de comodidad opcionales viven en **Ajustes → Accesibilidad**: **Reducir movimiento** (elimina las transiciones y los adornos de la app), **Ocultar vistas previas con color** (tarjetas de galería sobrias, de icono y texto, y miniaturas de proyecto más calmadas), **Alto contraste** (bordes, texto y anillos de foco más marcados) y **Texto grande** (tipografía de la app más grande - etiquetas, menús, texto de los botones). Los cuatro calman la app *alrededor* de tu trabajo: nunca entran en el lienzo de una herramienta ni cambian un píxel de lo que exportas, y cada uno está desactivado hasta que tú lo actives. Todo el detalle en [Tu perfil → Accesibilidad](/info/profile.html#accessibility).

Junto al interruptor de Sonido está el **Modo Neurospicy** - una pista de concentración de fondo, opcional y relajante, que suena en voz baja mientras trabajas. Al activarla se abre un pequeño **dock de reproductor** en la esquina inferior que te acompaña por toda la app; desde él puedes buscar y elegir una pista, avanzar y retroceder, ajustar el volumen y minimizarlo o cerrarlo. La lista de pistas abarca varias categorías - melodías procedurales *Lolly Sings*, bucles y ritmos ambientales, tu propio audio subido y un puñado de emisoras de **radio** de internet en directo (estas necesitan conexión; todo lo demás se reproduce sin conexión). Está **desactivado por defecto** y, como el Sonido, se recuerda entre sesiones y dispositivos. Desactivar el Sonido también silencia la pista de concentración.

## Almacenamiento y privacidad

Lolly guarda tu trabajo en tu dispositivo: en el almacenamiento propio de este navegador en la app web, y en el almacenamiento propio de la app en las apps de escritorio y móviles. Qué se guarda, qué elimina **Borrar todos mis datos** y qué se lleva consigo borrar los datos del navegador está en [Encuentra y recupera tu trabajo](/info/find-your-work.html#if-you-clear-your-browser-data); la [Política de privacidad](/info/privacy.html) enumera todo lo que la app descarga o envía, y [Superficie de servidor](/info/server-surface.html) los componentes de servidor opcionales.

## Pasar a otro dispositivo

Para llevar tu trabajo a un segundo ordenador o móvil, usa Sincronización, un archivo de copia de seguridad o un archivo `.lolly`. [Pasa tu trabajo a otro dispositivo](/info/find-your-work.html#move-your-work-to-another-device) compara los tres y explica **Exportar mis datos** e **Importar datos…**.

## Importar un diseño (Figma, Penpot, Illustrator, InDesign)

Puedes traer un diseño existente a Lolly y seguir trabajando en él: abre **Design**, haz clic en **Importar un diseño** en la barra de herramientas del lienzo y elige un **.fig** o SVG de Figma, un **.penpot** de Penpot, un **.ai** / **.pdf** de Illustrator o un **.idml** de InDesign. Las capas se convierten en cajas editables en el lienzo libre - el texto se puede volver a escribir, las imágenes van a **Mis imágenes** y la tipografía y los colores se ajustan a las variables globales de marca - y luego el resultado se guarda, se comparte y se renderiza como cualquier otra sesión. El análisis ocurre por completo en tu dispositivo. Detalle completo: **[Importar un diseño](/info/design-import.html)**.

## Exportar

Consulta **[Exportar y formatos](/info/exporting.html)** para la historia completa - elegir un formato, el tamaño de salida y las unidades de impresión, la transparencia, el vídeo y copiar/compartir. En resumen: elige un formato, ajusta el tamaño si lo necesitas y **Descargar** (o **Copiar** al portapapeles).

## Modo Batch (Pro)

Para usuarios avanzados, **Batch** (enlazado desde la galería, protegido tras el indicador de función Pro, que está activado por defecto) renderiza muchas variaciones a la vez - una cuadrícula donde cada fila es un conjunto de entradas, exportadas juntas. Ideal para localizar una tarjeta en una docena de idiomas o generar cada variante de tamaño de una sola vez. Rellena las filas escribiendo, pegando directamente desde una hoja de cálculo o importando un CSV (también puedes exportar uno de vuelta), y define el formato, el tamaño y el nombre de archivo de salida por fila. Guarda una cuadrícula completa como una **sesión por lotes** con nombre que se reabre desde la galería, y descarga cada fila como un único `.zip`.

![La barra de herramientas de Batch - nombre del zip, unidades, DPI y el formato que hereda cada fila, con Sesiones y Renderizar a la derecha](/t/url-shot?url=%2F%23%2Fbatch&width=1440&height=900&dpi=192&waitMs=3500&cropSelector=.pro-toolbar&walker=1&format=svg&dark=1&filename=use-batch-toolbar)

Batch sirve para generar **muchas variantes de una misma plantilla** a la vez. Para volver a renderizar sesiones que **ya has guardado**, usa **Proyectos → Carpeta de renderizado / Renderizar selección** (consulta [Encuentra y recupera tu trabajo](/info/find-your-work.html#find-something-you-saved)) - no hace falta Pro.

## Editar en paralelo (Multiedición)

Batch son muchas variantes de *un solo* diseño. **Multi-Edit** es la otra mitad del trabajo: varios diseños guardados **distintos** abiertos a la vez, para que un cambio se aplique a todos ellos. Marca entre **dos y ocho** sesiones guardadas en **Proyectos** y elige **Editar juntos** en la barra de selección; se abren como tarjetas en directo una junto a otra en `#/multi?s=<slot>,<slot>…`. Cada tarjeta es un render real de esa sesión, no una miniatura guardada, así que lo que ves es lo que se exportará.

Una sola barra lateral lo gobierna todo:

- <!--i:sliders--> **Compartidos** va primero - cada entrada que dos o más de las sesiones seleccionadas declaran *igual* (mismo id, mismo tipo, mismas restricciones - la misma regla de fusión que usa la cuadrícula por lotes en sus columnas). Edita un control compartido una vez y el valor se reparte a cada sesión que lo declara, en vivo en todas las tarjetas. Dos sesiones de la misma herramienta lo comparten todo; dos herramientas distintas solo comparten las entradas que tienen en común.
- <!--i:document--> Debajo, **una tarjeta plegada por sesión** con todas las entradas propias de esa sesión, con la misma fidelidad que la barra lateral de la herramienta - selectores de recursos, grupos de filas repetibles, campos de color - más un bloque de exportación compacto: **Formato**, **W** / **H**, **Unidad**, **DPI** y su propio **Descargar**. Ese Descargar guarda primero la sesión y luego la renderiza por la ruta normal de exportación de sesiones, así que el archivo lleva el mismo nombre, formato y Content Credentials que llevaría directamente desde la herramienta.
- <!--i:search--> **Filtrar campos…** en la parte superior acota los controles de *todas* las tarjetas a la vez - que es como llegas al «titular» de ocho sesiones sin tener que buscarlo desplazándote.

Haz clic en cualquier lienzo (o pulsa Enter sobre él) y la tarjeta de barra lateral de esa sesión se abre y se desplaza a la vista. **Guardar todo** devuelve cada sesión a su propia ranura. **Descargar todo** guarda primero y luego renderiza el conjunto entero por la misma tubería que **Renderizar selección** de Proyectos - un solo zip, con el bloqueo opcional por contraseña ofrecido por el camino.

Dos límites honestos. El tope de dos a ocho es real: cada tarjeta monta su propio runtime en vivo, y ese es el número que se mantiene ágil - un enlace que pida más (o una sesión que ya no existe) lo dice en lugar de cargar a medias. Y el enlace nombra *tus* ranuras guardadas, así que reabre ese conjunto en este dispositivo; no es un enlace para compartir.

Cuando la selección supera las ocho, mezcla herramientas o incluye imágenes además de sesiones, la vía de escape es **Editar como hoja** en esa misma barra de selección: abre toda la selección como **filas en la cuadrícula por lotes** (`#/pro?s=…`), sin límite de tamaño y sin la regla de la misma herramienta. Las carpetas quedan fuera de ambas - tienen su propia ruta de apertura en cuadrícula. ([Buscar](/info/search.html) es lo único que todavía no llega hasta aquí: Multiedición es la única vista que la barra de búsqueda no conoce.)

## Sin conexión e instalación

Lolly es una PWA. Sigue funcionando **sin conexión** en las pantallas que ya has abierto, y **La app**, bajo **Ajustes → Disponible sin conexión**, descarga el resto - instálala desde la barra de direcciones de tu navegador (o *Añadir a pantalla de inicio* en el móvil) para una experiencia a pantalla completa, como la de una app. Se actualiza sola cuando vuelves a tener conexión.

Sobre las actualizaciones: si una vista alguna vez no carga justo después de una (un panel en blanco, un "failed to fetch" en la esquina), recarga la página una vez - la app adopta la nueva versión sin problemas y tu trabajo guardado, sesiones y marca quedan intactos; solo puede que tengas que volver a añadir una imagen que agregaste y nunca guardaste. Almacena todo en tu dispositivo, no en la página.

Design y Darkroom pueden conservar la precisión de imagen original con la edición **Wide colour / HDR**, incluido el vídeo de Sequence. Las muestras de marca pueden llevar valores sRGB y P3 separados. Consulta [Edición de color amplio y HDR](/info/hdr-editing.html) para las opciones de salida y los límites actuales.
