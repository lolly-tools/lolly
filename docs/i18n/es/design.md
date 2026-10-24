# Design: el lienzo libre

Design es la herramienta para diseños que ninguna plantilla cubre: un póster desde cero, un deck de diapositivas, una pieza de movimiento con banda sonora. En lugar de un formulario de controles, tienes un lienzo de cuadros que arrastras, redimensionas, giras y en los que escribes. Se exporta por el mismo camino de renderizado que cualquier otra herramienta, así que lo que ves en el lienzo es el archivo que obtienes.

Esta página recorre el lienzo desde el primer cuadro hasta un deck terminado: la ventana, dar forma a los cuadros, dibujar tus propias formas, colocar escenas 3D y otras herramientas, añadir tiempo, comprobar el resultado y presentar el deck terminado. [Using Lolly](/info/using.html) cubre lo que Design comparte con todas las herramientas, como guardar y compartir.

![El lienzo libre de Design - la mesa de trabajo con la zona de pegado que la rodea](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Fz%3D17ZTfS8MwEMf_mryO5NZ288GHrdqJv1CUvWdtOgppMtJMNv96yaV1iRNEQRBZoblwab53l0-uq915bXgrCOSDpf3LzgANnQ4eI0rrPJn7Gh9cd0sE8lIryxtFIFfatFx6L4F0Mi-11GbUiZYr25QjK3bW-S8I5MnUbRXKCkMgb5uqki6JFFU7rjoXYsSgT8GaLebKZSeGAPkUYypMHp80DeugYYR4J_U7X4XRkY8dFHuTYEJ-jDWM3qoqsEHo4Y20-xJi-SPVaOfRUuAL1hiZXNrG4gH6M85Z5lTAk8x8DdlnPL8gecVfBIEU6F5v0bbCor3VUu4JpOPCKTCWsPI9rBS107d6QyCfRET_Ac6wX36X6UpX-49Ip1mAlMEPkM6QX20aoSpECLTmpadcazPQ9hPlWxboRndWmFEIG1s4Yp3E3Ts-0f4GbcruWHLzlC0frmfpfbGk82LxmD0vUndSTcvXAoknWBKCz5LDSIdiRHV0D2Tfq1BIvdY42Zim5WZ_-n3_mRvwBg&width=1360&height=850&dpi=192&waitMs=3000&format=svg&walker=1&chrome=1&localize=1&dark=1&filename=design)

## La ventana de Design

La **barra superior** empieza con **Home**, el **File menu** y el nombre del documento (haz clic en el nombre para renombrar el documento). En el centro están **Undo**, **Redo**, **History**, los controles de zoom (con **Fit all** y **Fit artboard**) y los interruptores de la **Timeline**, el **Navigator** y el **Inspector**. A la derecha están **Share**, **Present** y **Export**. En un teléfono, los botones menos usados pasan a **More actions**.

El **carril de herramientas** a un lado contiene el menú de Lolly y las herramientas con las que dibujas: **Pointer**, **Add a box**, **Pen**, **Edit points**, **Line**, y luego los botones de Timeline, Artboards y Auto-arrange.

![La barra de herramientas del lienzo libre: un asa de arrastre, el menú de Lolly y luego Puntero, Añadir un cuadro, Pluma, Editar puntos, Línea, Línea de tiempo, Áreas de diseño y Organizar automáticamente](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Ftemplate%3D__blank__&width=1440&height=900&dpi=192&waitMs=2600&css=.fc-toolbar%7Bopacity%3A1!important%7D&cropSelector=.fc-toolbar&walker=1&format=svg&dark=1&filename=pen-editor-rail)

El lienzo funciona como la mesa de trabajo de un diseñador alrededor de la mesa de arte:

- **Aparca cuadros fuera de la mesa de arte.** Arrastra un cuadro más allá del borde del marco y sigue visible y seleccionable. Todo lo que queda fuera del marco se atenúa, y el marco conserva su sombra para marcar dónde empieza el archivo.
- **Solo se exporta la mesa de arte.** Todo lo que queda fuera del marco, o la parte de un cuadro que sobresale del borde, se recorta de la salida tanto en formatos de trama como vectoriales.
- **Aleja el zoom más allá de Fit** para ver todo lo que has aparcado.
- **Redimensiona la mesa de arte** cambiando el tamaño de exportación. Los cuadros conservan sus posiciones, así que puedes reencuadrar un diseño alrededor del contenido existente.

![La fase de edición: la mesa de arte en primer plano, el carril de herramientas a la izquierda y el HUD de zoom en la esquina](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Fz%3D11dZBb5swFADgX8MOiRYZB0J76GFpNO2wnbr7ZMwDrBg7s01C8usngmNwSqJszaT2aD8_G54_PUgJXRdK1iJ7CvAcpSHG6FMqG9BPQbwMkmWAMcsCjIP5lwDjUsp1O8DPAcZrJvpIKhsXaLpZ1I323mjXjcJHbCdKO4Ee7ISSxsvQJdmAO0cBNe6gtHDzQbKkkks101ARYRidaaBSZETtg2TlMgw0xuX8LBXANCN7PTVyWki3Kr-6b61yQmG4ay6FeWEHOL1K1E0TzgrhdqIgDCiXs_WjFcsyDi66A1aU_ZMuEPIOcwFNhHYRzgR8GySGs9CW0BDlFzWrVTe2qdCwftOcZP2TtJEfuovFyKZzIvor0fD7WKhVGzsXo2ALhH8UMxvFqmtiXmQFpmSimArYBfGzYHpKZcVEcS87-OHedpK72cHndmYWunu6rtxM-3wuwGqTXskacov-nhs15KNYG7HgWZtMvpNa0LJtUJNJi-2rYhnZ3ybtuNUVZuj9MotOrAbQFmPQbuB0uxwud4NX9-ycrmWIJw59Pg9h5AF6RGd-5vgWPhvG-2b5xs8bl5zvZ0ZK3tf_bd0pxu_lw2YDG2Jv6VRdj9Hi__WrKB7pV3OELuBKIRunReqM9f8d1tbnKPFsJVHs2Zqf9SaMLrSmASCjiNAbokD0lD0t_95Wxu-MVaQ4uT6WQ8ta0V46Z6lq9br1fVEOh7ypju-FFyjBC7fmVy0UaMm3YBcbVYMt-dhfTlUbe2BOuD6ujFd_AA&width=1440&height=900&dpi=192&waitMs=7000&waitSelector=.tl-clip&css=.fc-toolbar%7Bopacity%3A1!important%7D&format=svg&walker=1&chrome=1&dark=1&filename=seq-studio-stage)

### El Navigator y el Inspector

El **Navigator** enumera cada mesa de arte (con el encabezado **Artboards**, o **Slides** en un deck) como un grupo plegable de sus **Layers**. Selecciona el nombre de una mesa de arte para ir allí, despliégala para seleccionar o reordenar sus capas y usa las teclas de flecha para moverte por la lista; Izquierda vuelve al encabezado de la mesa de arte. **Pages** agrupa mesas de arte en páginas con nombre, y elegir una página solo cambia qué mesas de arte muestra el editor.

El **Inspector** pone primero los controles de texto o de imagen del objeto seleccionado. Los chips de opciones cubren las opciones rápidas, y **Advanced** contiene el detalle del estilo. En un teléfono el Inspector se abre como una hoja desde **More actions**; Escape o Atrás cierra la hoja y conserva tu selección.

![La sección Document del Inspector: las pestañas Selection y Canvas, y luego Dimensions y Style & look](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Ftemplate%3Dfeature-tour&width=1440&height=900&dpi=192&waitMs=3500&cropSelector=.fc-insp&walker=1&format=svg&dark=1&filename=design-narration)

## Redimensionar, escalar y girar

Selecciona un objeto y arrastra un tirador para cambiar su tamaño, o arrastra el tirador redondo bajo la selección para girar el objeto. Un arrastre de tamaño funciona en uno de dos modos:

- **Resize**, el predeterminado, cambia solo el cuadro. El texto se reajusta al nuevo tamaño, y el tamaño de fuente, el grosor del trazo, el radio de las esquinas y los efectos se quedan como estaban.
- **Scale** agranda o reduce todo el objeto con su contenido: el tamaño de fuente, el trazo, el radio de las esquinas, la sombra, el desenfoque, el relleno y el espaciado cambian en la misma proporción.

Pulsa `K` para activar o desactivar Scale. Sin teclado, elige **Scale mode** en el menú de Lolly, o mantén pulsado el botón **Pointer** del carril (o haz clic derecho en el botón) y elige **Scale**; en una pantalla táctil la barra de objeto también tiene un interruptor de Scale. Mientras Scale está activo, el botón Pointer muestra el icono de Scale y cada tirador tiene un punto en el centro. `V` o **Escape** vuelve a Resize y conserva tu selección. Todos los documentos se abren con Scale desactivado, así que nadie escala trazos por accidente.

**Escalar con un número.** Con Scale activo, o con varios objetos seleccionados, haz clic en el indicador de la barra de objeto para abrir el menú emergente **Scale**. Escribe un porcentaje, un ancho o un alto, elige el punto que permanece fijo en la cuadrícula de 3 x 3 y elige **Apply**. Cada escala es un paso de deshacer.

**Varios objetos.** Una selección de varios objetos tiene tiradores en sus bordes además de en sus esquinas. Mientras todos los objetos estén rectos o girados un número entero de cuartos de vuelta, y la selección no contenga ningún grupo ni círculo, un arrastre desde una esquina cambia el ancho y el alto libremente. En caso contrario la selección mantiene sus proporciones y el indicador añade **Proportional**. Mientras arrastras, una pequeña etiqueta muestra el tamaño, o el porcentaje en modo Scale.

**Voltear una selección.** Haz clic derecho y elige **Flip horizontal** o **Flip vertical**, o pulsa `Shift+H` o `Shift+V` (Shift, porque una `V` sola es el Pointer). El espejo es una transformación real, así que el SVG, PDF y PNG exportados conservan el volteo.

**Las teclas que mantienes durante un arrastre** surten efecto en el momento en que las pulsas o las sueltas; la hoja de atajos (`?`) también las enumera.

| Mantener | Redimensionar o escalar | Girar | Mover |
|---|---|---|---|
| **Shift** | Mantiene las proporciones (Scale siempre lo hace) | Gira en pasos de 15 grados | Sin cambio |
| **Alt** (Option) | Trabaja desde el centro | Gira libremente | Desactiva el ajuste magnético y la cuadrícula |
| **Cmd/Ctrl** | Desactiva el ajuste magnético y la cuadrícula | Gira libremente | Desactiva el ajuste magnético y la cuadrícula |

Sin ninguna tecla pulsada, un giro se atrae a los 15 grados más próximos cuando llega a menos de 4 grados de ellos. Las mesas de arte no giran, así que no tienen tirador de giro.

::: details Tiradores, zonas de agarre y táctil
**Agarra en cualquier punto de un borde.** Cada lado de una selección es una franja de redimensionado a todo lo largo, y con un ratón o un lápiz hay una zona de giro justo fuera de cada esquina. El puntero muestra lo que hará un arrastre. Pulsar en una franja o zona solo se convierte en redimensionado o giro cuando empiezas a arrastrar, así que un clic simple sigue seleccionando como antes. Un objeto bloqueado no tiene tiradores, franjas ni zonas.

**Los objetos pequeños siguen siendo movibles.** En un objeto de 25 píxeles de pantalla o menos de ancho, los tiradores centrales se ocultan y los demás se alejan un poco del contorno, de modo que pulsar sobre el objeto lo mueve. A 10 píxeles o menos también desaparecen los tiradores de las esquinas, y una línea fina conserva un tirador en cada extremo. Pulsar justo al lado de una línea fina o de un objeto diminuto, lejos de sus tiradores, mueve el objeto.

**Zonas de agarre grandes.** En una pantalla táctil cada zona de esquina mide una cuarta parte del ancho y el alto de la selección en pantalla, entre 24 y 44 píxeles, y cada zona lateral cubre el tramo entre dos esquinas. Cuando la selección es demasiado pequeña para eso, las zonas pasan fuera de su contorno. La zona bajo tu puntero o dedo se sombrea. Para obtener las mismas zonas con un ratón o un lápiz, activa **Large grab areas** en el menú de Lolly; el ajuste se queda en este dispositivo.

**Dos dedos sobre una selección.** En una pantalla táctil, pon dos dedos sobre un objeto seleccionado: pellizca para escalar, gira para girar o mueve ambos dedos para llevar la selección, todo como un solo paso de deshacer. Con Scale activo, un pellizco escala también el contenido; con Scale desactivado, redimensiona en proporción. Un giro se ajusta a los 15 grados más próximos cuando está cerca, y un movimiento con dos dedos nunca se ajusta. El primer dedo tiene que caer sobre la selección y el segundo tiene que seguir rápidamente, sobre la selección o justo fuera de su borde. Dos dedos en cualquier otro sitio hacen zoom y desplazan la vista, y lo mismo ocurre con dos dedos sobre una selección que contiene una mesa de arte o un objeto bloqueado, cubre la mayor parte de la vista o se sale de su borde.
:::

## Dibuja tus propias formas

Los cuadros, círculos y marcos redondeados cubren la mayoría de los diseños. Para cualquier otra forma, dibuja una: el botón **Pen** del carril (o `P`) te pone en modo de dibujo. Tres teclas sueltas cambian entre modos: `V` para el Pointer, `P` para el Pen y `N` para **Edit points**. El Pointer es siempre la salida.

- **Haz clic** para colocar un punto. En el tipo de curva predeterminado, **hacer clic y arrastrar** saca los tiradores del punto para hacer una curva; mantén **Alt** al hacer clic para un vértice duro. (En los demás tipos de curva todos los puntos son vértices y arrastrar no hace nada.)
- Los puntos se ajustan a la mesa de arte y a tus otros cuadros al colocarlos. Alt suspende la cuadrícula mientras dibujas, y tanto la cuadrícula como los bordes mientras arrastras un punto después.
- **Haz clic en tu primer punto** para cerrar la forma. En caso contrario pulsa **Enter**, haz doble clic o cambia de herramienta, y el dibujo se conserva.
- **Escape** funciona de paso en paso: la primera pulsación abandona el dibujo, la segunda sale del pen.
- **Delete** mientras dibujas elimina el último punto.

El resultado es un cuadro normal. Mueve, redimensiona, gira, agrupa, alinea, reordena, rellena, sombrea o desvanece el trazado como cualquier otro cuadro. El primer trazado toma el relleno y el trazo que tu marca da a un trazado, y cada trazado nuevo toma lo último que usaste. En una herramienta cuya marca no define nada para los trazados, un trazado nuevo se perfila con el color con el que dibujaste, así que la forma nunca es invisible.

**Edita los puntos de nuevo.** Haz doble clic en la forma, o usa **Edit points** en la barra de objeto. Arrastra un punto para moverlo, arrastra un tirador para reorientar la curva, haz clic en la curva para insertar un punto, o arrastra un recuadro alrededor de varios puntos y pulsa Delete. Un trazado siempre conserva al menos dos puntos.

**Spline type** decide qué tipo de curva pasa por tus puntos:

| Tipo | Qué hace |
|---|---|
| **Smooth (auto)** | El predeterminado. Calcula sus propias longitudes de tirador, así que los clics simples dan una curva suave. Un tirador que fijas determina la dirección, y la curva sigue siendo dueña de la longitud. |
| **Bezier handles** | La pluma clásica: controlas cada tirador, e insertar un punto nunca mueve la curva. |
| **Through the points** | Pasa exactamente por cada punto, sin tiradores. |
| **B-spline** | Fluye cerca de los puntos en lugar de por ellos, para una línea más suave. |
| **Straight lines** | Una polilínea. |

Cambiar un trazado existente a un tipo que calcula sus propios tiradores pregunta primero, porque las longitudes de tirador que fijaste no se pueden recuperar; cambiar a **Bezier handles** nunca pierde nada. A mitad de un dibujo el cambio se aplica de inmediato, y se descartan los tiradores que hubieras sacado.

Cada punto también lleva una regla de continuidad, que muestra su forma: cuadrado para **Corner** (los tiradores se mueven de forma independiente), redondo para **Smooth** (los tiradores permanecen alineados) y redondo con un anillo para **Symmetric** (alineados y de igual longitud). Define la regla para los puntos seleccionados y la curva la sigue al instante.

![Dos trazados de pluma renderizados directamente desde un enlace: una curva en S con trazo y una mancha cerrada con relleno](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Fboxes%3D%5B%7B%22id%22%3A%22paper%22%2C%22kind%22%3A%22box%22%2C%22x%22%3A0%2C%22y%22%3A0%2C%22w%22%3A1080%2C%22h%22%3A1080%2C%22shape%22%3A%22rect%22%2C%22bg%22%3A%22%23ffffff%22%7D%2C%7B%22id%22%3A%22curve%22%2C%22kind%22%3A%22path%22%2C%22x%22%3A140%2C%22y%22%3A180%2C%22w%22%3A800%2C%22h%22%3A420%2C%22shape%22%3A%22rect%22%2C%22bg%22%3A%22%22%2C%22stroke%22%3A%22%234f84ba%22%2C%22strokeW%22%3A14%2C%22path%22%3A%221!cubic!0_.02!.85!!!.25!-.45!s_.5!.5!-.22!.32!.22!-.32!y_.98!.12!-.25!.45!!!s%22%7D%2C%7B%22id%22%3A%22blob%22%2C%22kind%22%3A%22path%22%2C%22x%22%3A340%2C%22y%22%3A620%2C%22w%22%3A400%2C%22h%22%3A320%2C%22shape%22%3A%22rect%22%2C%22bg%22%3A%22%23d1e7ff%22%2C%22stroke%22%3A%22%234f84ba%22%2C%22strokeW%22%3A6%2C%22fillRule%22%3A%22nonzero%22%2C%22path%22%3A%221!catmull-rom!1_.5!0_1!.42_.78!1_.22!1_0!.42%22%7D%5D&width=1440&height=900&dpi=192&waitMs=2600&cropSelector=%23tool-canvas&walker=1&format=svg&dark=1&filename=pen-path-geometry)

Un trazado dibujado viaja en un enlace compartido como cualquier otro cuadro y se renderiza igual desde la línea de comandos.

## Combinar formas

Selecciona dos o más formas, haz clic derecho en el lienzo (toque con dos dedos en táctil) y elige:

- **Union** las fusiona en una sola forma con el relleno de la que está más arriba.
- **Subtract** recorta todo lo que está encima de la forma inferior.
- **Intersect** conserva solo la superposición.
- **Exclude** conserva todo excepto la superposición.

Otras tres funcionan sobre una sola forma. **Outline stroke…** convierte un trazo en un contorno relleno del mismo grosor. **Offset path…** expande el contorno hacia fuera o, con un número negativo, lo contrae hacia dentro. **Simplify** reconstruye un trazado con menos segmentos y el mismo contorno.

![Una media luna y un anillo con un agujero real, ambos producidos con Subtract](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Fboxes%3D%5B%7B%22id%22%3A%22paper%22%2C%22kind%22%3A%22box%22%2C%22x%22%3A0%2C%22y%22%3A0%2C%22w%22%3A1080%2C%22h%22%3A1080%2C%22shape%22%3A%22rect%22%2C%22bg%22%3A%22%23ffffff%22%7D%2C%7B%22id%22%3A%22crescent%22%2C%22kind%22%3A%22path%22%2C%22x%22%3A120%2C%22y%22%3A330%2C%22w%22%3A374%2C%22h%22%3A400%2C%22shape%22%3A%22rect%22%2C%22bg%22%3A%22%234f84ba%22%2C%22path%22%3A%221!cubic!1_.750491!.957645!-.128211!-.062578!-.065985!.027232!c_.534759!1!.076762!!-.295339!!c_0!.5!!.276142!!-.276142!c_.534759!0!-.295339!!.200102!!c_1.000984!.254923!-.09169!-.152161!-.021205!-.003239!c_.935829!.25!.022185!!-.221505!!c_.534759!.625!!-.207107!!.14459!c%22%7D%2C%7B%22id%22%3A%22ring%22%2C%22kind%22%3A%22path%22%2C%22x%22%3A580%2C%22y%22%3A330%2C%22w%22%3A400%2C%22h%22%3A400%2C%22shape%22%3A%22rect%22%2C%22bg%22%3A%22%234f84ba%22%2C%22fillRule%22%3A%22nonzero%22%2C%22path%22%3A%221!cubic!1_1!.5!!-.276142!!.276142!c_.5!1!.276142!!-.276142!!c_0!.5!!.276142!!-.276142!c_.5!0!-.276142!!.276142!!c*1!cubic!1_.5!.7!-.110457!!.110457!!c_.7!.5!!.110457!!-.110457!c_.5!.3!.110457!!-.110457!!c_.3!.5!!-.110457!!.110457!c%22%7D%5D%26w%3D1080%26h%3D1080&width=1440&height=900&dpi=192&waitMs=2600&cropSelector=%23tool-canvas&walker=1&format=svg&filename=path-ops-boolean-result)

El resultado es un trazado nuevo que puedes seguir editando con el pen, guardado como curvas Bézier simples, por lo que el tipo de spline original no se conserva. Los agujeros son agujeros reales: el control **Fill rule** del panel de trazo decide si los contornos superpuestos se rellenan (*non-zero*) o se perforan (*even-odd*). Las operaciones se niegan antes que destruir: si pides intersecar dos formas que no se superponen, no cambia nada. Los cuadros de texto e imagen no tienen contorno, así que se dejan como están.

## Escenas 3D y herramientas dentro de un diseño

Un cuadro puede contener más que una imagen. Los dos tipos de abajo conservan una receta y no una imagen renderizada, así que se redibujan al tamaño y en el momento que pida el documento, y una actualización de la fuente llega a todos los diseños que la usan.

### Escenas 3D

Elige **3D scene** en el menú de añadir del carril y arrastra un marco: 3D Studio se abre sobre el nuevo cuadro, y lo que definas allí vuelve al lienzo. Después, **Edit in 3D Studio** en la sección **3D scene** del Inspector reabre el estudio. [Place a scene in Design](/info/3d-studio.html#place-a-scene-in-design) cubre pósteres, la línea de tiempo, la exportación y el compartir.

### Herramientas dentro de un diseño

Elige **Image** en el menú de añadir del carril, arrastra un marco y elige una herramienta en la pestaña **Tools** del selector. La herramienta llena el marco con sus valores predeterminados, y el Inspector se abre en una sección **Tool** con los controles propios de esa herramienta. Cambia un campo y el cuadro se actualiza un momento después, como un solo paso de deshacer. **Image fit** e **Image position** funcionan como en cualquier imagen, y **Replace with another tool or image** cambia el contenido del cuadro.

**Las herramientas que se mueven** se reproducen dentro del cuadro: una ilustración en bucle sigue en bucle en el lienzo, sigue el cabezal de reproducción una vez abierta la línea de tiempo y se exporta fotograma a fotograma a GIF, MP4 o WebM. Cuando la herramienta indica cuánto dura un bucle, el cuadro recibe un clip exactamente de esa duración, de modo que un vídeo contiene bucles completos. Un clip al que cambiaste el tiempo conserva tu tiempo, y desactivar el movimiento de la herramienta vuelve a convertir el cuadro en una imagen fija.

## Línea de tiempo (Sequence)

**Sequence** es la línea de tiempo de Design: añade tiempo al lienzo. Cada cuadro puede empezar en un momento, durar una longitud y animarse al entrar y al salir, y la línea de tiempo acoplada bajo la mesa de arte es donde los organizas. Empieza desde la plantilla **Video** de Design y ya hay una secuencia corta preparada: dos tarjetas de texto temporizadas en la fila de secuencia y una base musical procedimental debajo, para que veas cómo funciona la línea de tiempo antes de cambiar nada.

![La línea de tiempo de Sequence: el transporte, la regla, una pista de superposición, la fila de secuencia magnética con sus clips y sus fichas de unión, y la franja Siempre activo](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Fz%3D11dZBb5swFADgX8MOiRYZB0J76GFpNO2wnbr7ZMwDrBg7s01C8usngmNwSqJszaT2aD8_G54_PUgJXRdK1iJ7CvAcpSHG6FMqG9BPQbwMkmWAMcsCjIP5lwDjUsp1O8DPAcZrJvpIKhsXaLpZ1I323mjXjcJHbCdKO4Ee7ISSxsvQJdmAO0cBNe6gtHDzQbKkkks101ARYRidaaBSZETtg2TlMgw0xuX8LBXANCN7PTVyWki3Kr-6b61yQmG4ay6FeWEHOL1K1E0TzgrhdqIgDCiXs_WjFcsyDi66A1aU_ZMuEPIOcwFNhHYRzgR8GySGs9CW0BDlFzWrVTe2qdCwftOcZP2TtJEfuovFyKZzIvor0fD7WKhVGzsXo2ALhH8UMxvFqmtiXmQFpmSimArYBfGzYHpKZcVEcS87-OHedpK72cHndmYWunu6rtxM-3wuwGqTXskacov-nhs15KNYG7HgWZtMvpNa0LJtUJNJi-2rYhnZ3ybtuNUVZuj9MotOrAbQFmPQbuB0uxwud4NX9-ycrmWIJw59Pg9h5AF6RGd-5vgWPhvG-2b5xs8bl5zvZ0ZK3tf_bd0pxu_lw2YDG2Jv6VRdj9Hi__WrKB7pV3OELuBKIRunReqM9f8d1tbnKPFsJVHs2Zqf9SaMLrSmASCjiNAbokD0lD0t_95Wxu-MVaQ4uT6WQ8ta0V46Z6lq9br1fVEOh7ypju-FFyjBC7fmVy0UaMm3YBcbVYMt-dhfTlUbe2BOuD6ujFd_AA&width=1440&height=900&dpi=192&waitMs=7000&waitSelector=.tl-clip&css=.tl-panel%7Bheight%3A252px!important%7D&cropSelector=.tl-panel&format=svg&walker=1&tolerance=0.03&dark=1&filename=seq-studio-timeline)

Hay dos tipos de fila:

- La **fila de secuencia** es magnética. Los clips se colocan uno tras otro, arrastrar uno reordena la serie y eliminar uno cierra el hueco. Es la columna vertebral.
- Los **carriles de superposición** son libres. Un tercio inferior, un logotipo o un subtítulo flota sobre la columna vertebral en su propio momento, cada uno en su propio carril.
- Debajo, **Always on** contiene cuadros sin temporización, presentes de principio a fin. El `+` de un chip mueve uno a un carril; **Make always on** lo devuelve.

Abrir la línea de tiempo le da el teclado, así que Espacio y las teclas de flecha manejan el cabezal. Una composición que ya tiene temporización abre la línea de tiempo por sí sola.

**Edición.** Arrastra el centro de un clip para moverlo, arrastra cerca de cualquiera de sus extremos para recortarlo y pulsa **Split at playhead** (o `S`) para cortarlo en dos. Dividir requiere un clip con una **Length** real y el cabezal algo dentro de él, así que un clip abierto como la base musical no se puede dividir. **Snap to edges** está activado por defecto, y se ajusta a los bordes de los clips, al cabezal y a los segundos enteros; mantén Alt para arrastrar sin ajuste. Cada arrastre es un paso de deshacer, y la vista previa mientras arrastras usa la misma aritmética que el resultado.

Selecciona un clip y el inspector da las mismas ediciones en números: **Length**, **Trim in** (cuánto dentro de la fuente empieza el clip), **Speed** de ×0.25 a ×4, **Animate in** y **Animate out** con sus duraciones y **Mute clip**. Un clip de la fila magnética no tiene campo **Start**, porque la fila decide el orden.

Las **transiciones** son preajustes: Fade, Pop, Grow, Rise, Drop, los cuatro Slides, Zoom in y out, Tilt, Swoop, Spin, Drift o **Cut (no animation)**. Las distancias se escalan con el objeto, así que un mismo preajuste queda bien en una tarjeta a pantalla completa y en una insignia pequeña. Entre dos clips de la fila de secuencia, un **seam chip** elige **Cut** o **Crossfade**; ábrelo de nuevo para definir la **Length (ms)** y pulsa **Done**. En un fundido cruzado, el primer clip sigue más allá del corte y se desvanece mientras el siguiente aparece, igual en la vista previa y en el archivo.

**Sonido.** Un clip de **Audio** vive en la línea de tiempo como cualquier otro clip, con forma de onda, recorte y silencio. La base musical generada de la plantilla Video se sintetiza en el momento de exportar, así que su barra se mantiene lisa y silenciosa hasta que renderizas. Pulsa el micrófono para **grabar una locución** directamente en la línea de tiempo, con cuenta atrás y medidor de nivel; la toma se guarda como recurso tuyo en el cabezal. El botón de cámara junto al micrófono **graba un vídeo** del mismo modo, recortado a la mesa de arte mientras graba, para que un colega pueda añadir un clip desde un enlace compartido. Selecciona cualquier clip con sonido y su tira se abre bajo la línea de tiempo para volumen, panorama, ecualizador, tono, normalización y efectos como **Voice cleanup**; [Sound](/info/sequence-editor.html#sound) en la guía del editor de secuencias cubre la tira. La **Audio track** del panel de exportación es aparte: una base bajo todo el clip, con fundido y atenuación automática.

![La línea de tiempo con el clip de música seleccionado: su franja recorre la parte inferior con Velocidad, Fundidos, Volumen, Desplazar, EQ, Tono, Normalizar volumen y la ranura de Efecto](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Fbx%3Dt1%252Ctext%252C200%252C140%252C1500%252C220%252C0%252Crect%252C16%252C%252C100%252C%252Ccontain%252Cnormal%252CVoiceover%252520session%252C%25257Bcolor.semantic.text%25257D%252C48%252Ccenter%252Cmiddle%252C500%252Csans%252C1.12%252C0%252Ctrue%252Cfalse%252C%252C%252C8%252Cnone%252C00000055%252C0%252C0%252C10%252Ccenter%252Cfalse%252C%252C%252C0%252Cnonzero%252C0%252C3.3%252C0%252C1%252Cnone%252Cnone%252C400%252C400%252Cfalse%252Cseq%252C%252Cround%252Cround%252C%252C0%252C0%252C0%252C0%252C%252C%252C%252C0%252Ctrue%252Cnone%252Cnone%252C%252Cfalse%252C%252C%252C%252C0%252C%252C%252Cfalse%252C%252C%252C%252C%252Cfalse%252Cfalse%252C%252C1%252C%252Cfalse%252C%252C60%252C%252C%252C1%257Ea1%252Caudio%252C200%252C500%252C400%252C80%252C0%252Crect%252C16%252C%252C100%252Clolly%25252Floops%25252F3-am-echoes%252Ccontain%252Cnormal%252C%252C%25257Bcolor.semantic.text%25257D%252C48%252Ccenter%252Cmiddle%252C500%252Csans%252C1.12%252C0%252Ctrue%252Cfalse%252C%252C%252C8%252Cnone%252C00000055%252C0%252C0%252C10%252Ccenter%252Cfalse%252C%252C%252C0%252Cnonzero%252C0%252C3.3%252C0%252C1%252Cnone%252Cnone%252C400%252C400%252Cfalse%252C%252C%252Cround%252Cround%252C%252C0%252C0%252C0%252C0%252C%252C%252C%252C0%252Ctrue%252Cnone%252Cnone%252C%252Cfalse%252C%252C%252C%252C0%252C%252C%252Cfalse%252C%252C%252C%252C%252Cfalse%252Cfalse%252C%252C1.3%252C%252Cfalse%252C%252C60%252C%252C%252C1%26_sel%3Da1&width=1440&height=900&dpi=192&waitMs=5000&waitSelector=.tl-clip&css=.tl-panel%7Bheight%3A300px%21important%7D&cropSelector=.tl-panel&walker=1&format=svg&dark=1&filename=tl-audio-strip&drive=click%3Abutton%3Ahas-text%28%22Inspector%22%29)

**Renderizado.** Una exportación de movimiento dibuja, decodifica y codifica cada fotograma en un instante exacto, así que el archivo no depende de que tu máquina siga el ritmo, y MP4 y WebM no tienen un límite práctico de fotogramas. La duración de la línea de tiempo fija la duración a menos que escribas una, y las Content Credentials se estampan como en cualquier otra exportación. Una exportación fija da el fotograma del cabezal, o una hoja de contactos desde el campo **Frames**; consulta [Stills from a timed composition](/info/exporting.html#stills-from-a-timed-composition). Una secuencia tiene un tope de una hora. GIF y PNG animado guardan todos los fotogramas en memoria, así que sirven para clips cortos. **Record live** está oculto aquí porque el renderizado fotograma a fotograma es el mejor camino.

**Fotogramas clave, profundidad y una cámara.** Una transición anima un clip al entrar y al salir. Para dar una pose a un cuadro dentro de un clip (desplazarse, desvanecerse, desenfocarse, elevarlo de la página y asentarlo de nuevo), selecciona el clip y pulsa **+Keyframe**: el rombo en las herramientas de la línea de tiempo, el rombo en la barra de objeto del lienzo o **Shift+K** con la línea de tiempo enfocada. La posición del cabezal decide qué pose escribe tu siguiente edición. Los mismos fotogramas clave dan a una composición temporizada una cámara que se acerca, panea y cambia el enfoque. [Animating](/info/animating.html) es la guía completa, y [The sequence editor](/info/sequence-editor.html) cubre la selección, el onion skin, la división, el recorte y los marcadores.

## Antes de exportar

Design comprueba tu documento antes de que envíes el archivo. La tarjeta **Before you export**, en la sección **Document** del Inspector y de nuevo en el panel de exportación, lee la estructura de capas guardada y luego examina el lienzo asentado en busca de texto recortado y contraste de colores planos. Pregunta al mismo registro de fuentes que usa el contorneado de SVG y PDF si cada tramo de texto tiene bytes de fuente que se puedan incrustar. Los fondos de imagen y de degradado se enumeran como comprobaciones visuales en lugar de recibir una puntuación de contraste inventada.

### Comprobar una composición con el design system

La tarjeta del panel de exportación también compara la composición con tu design system, en la misma versión del design system que usa el renderizado. Examina los colores definidos, los alias de tokens, las fuentes elegidas y los ID de recursos de imagen. Un valor personalizado puede ser intencionado, y una imagen fuera de los recursos de marca declarados es un elemento de revisión, no una imagen prohibida.

Donde existe una sugerencia concreta de color o fuente, su botón cambia esa única capa, y **Undo** restaura el original. Las capas bloqueadas o cambiadas desde entonces nunca se sobrescriben con una sugerencia antigua. Los degradados, los efectos, el contenido anidado de herramientas, los derechos y la calidad subjetiva quedan fuera de esta comparación, y ninguna comprobación bloquea Download.

### Normas internas y la señal de redacción

La tarjeta del panel de exportación también comprueba las normas internas que trae tu design system, como el grosor y la alineación del texto, las combinaciones de colores aprobadas o un logotipo por superficie, capa por capa. Cada hallazgo es una advertencia con el nombre de la capa sobre la regla. Una regla para la que esta compilación no tiene comprobador se enumera como no comprobada, nunca como cumplida. [Usage & rules](/info/brand-studio.html#usage-rules) enumera las reglas, y `lolly check` aplica las mismas a un documento guardado.

La misma tarjeta muestra la señal de redacción del texto que dibuja el documento: su banda (none, weak, notable o strong), y luego la propia frase de Verify con la puntuación sobre 100 y hasta tres frases señaladas, cada una con la capa que las contiene. **Open the text in Verify** lleva ese texto a [Verify](/#/verify) para la lectura completa; [AI evidence in Verify](/info/verify-ai-evidence.html) explica qué pondera la puntuación. La puntuación es una señal, no un veredicto: cuenta patrones comunes en la escritura generada y no puede decir quién escribió las palabras. Las capas ocultas quedan fuera de ambas comprobaciones, y la tarjeta indica cuántas.

Los hallazgos de normas internas y una señal de redacción fuerte cuentan para el total "to fix" de la tarjeta para que sean fáciles de encontrar. Informan y nunca bloquean: Download sigue disponible, y no hay nada que descartar ni que registrar como excepción. Un agente que trabaja en el documento abierto recibe el mismo informe mediante sus herramientas del sitio ([Agents in an open document](/info/open-document-agents.html)).

Las comprobaciones de impresión (sangrado, resolución, cobertura de tinta y número de planchas) se unen a la misma tarjeta cuando activas **Settings → Feature flags → Print preflight**. En otras herramientas, ese indicador es lo que hace que aparezca la tarjeta; [Export a file](/info/exporting.html) describe las comprobaciones de impresión.

## Presentar

Un documento de Design formado por mesas de arte ya es un deck. Pulsa **Present** en la barra superior y cada mesa de arte se convierte en una diapositiva a pantalla completa, en el orden en que están en el lienzo. El botón dice **Preview** hasta que el **Design outcome** del documento es **Slides**. El deck se ejecuta sobre una copia de las mesas de arte renderizadas, así que al salir vuelves exactamente donde estabas.

La flecha junto a **Present** abre **Present from this slide**, **Speaker view**, **Present with camera**, **Narrate**, **Auto-advance slides**, **Loop the deck (kiosk)** y **Export slides as video**.

| Tecla | Qué hace |
|---|---|
| **Space**, `→`, **Page Down** | Siguiente paso o diapositiva (o haz clic en la franja del borde derecho) |
| `←`, **Page Up** | Atrás (o haz clic en la franja del borde izquierdo) |
| **Home**, **End** | Primera o última diapositiva |
| `O` | Vista general: cada mesa de arte según la disposición de tu lienzo; haz clic en una para abrirla |
| `S` | Vista del orador: diapositiva actual, siguiente, notas y un reloj en una segunda ventana |
| `B` | Pantalla en negro; cualquier tecla devuelve la diapositiva |
| `F` | Volver a pantalla completa |
| `K` | Pausar o reiniciar un deck en modo quiosco |
| **Escape** | Quita una capa: de la vista general al deck, del deck al editor |

Una pequeña barra de control aparece cuando mueves el puntero y se oculta de nuevo cuando paras. Si el navegador bloquea la ventana emergente del orador, la vista del orador se abre como un panel sobre el deck. Las notas pertenecen a cada mesa de arte y nunca aparecen en la diapositiva.

- **Pasos de revelado.** Haz clic derecho en un cuadro y elige **Reveal at step 1**, **2** o **3** en lugar de **Always visible**, y el cuadro espera hasta que avanzas a su paso. Los cuadros que comparten un número llegan juntos.
- **Quiosco.** Da a una mesa de arte una **Length** y el deck se detiene ahí ese tiempo, y luego avanza tras una fina barra de progreso. Añade `kiosk` al enlace y el deck vuelve al principio al llegar al final, para cartelería digital.
- **Pilas de subdiapositivas.** Haz clic derecho en una mesa de arte y elige **Stack under the previous slide** para convertirla en un paso de esa diapositiva. La vista general muestra una tarjeta, y la fila **Stack** del inspector indica a qué diapositiva pertenece la mesa de arte.
- **Morph.** Cuando dos diapositivas consecutivas tienen un cuadro con el mismo nombre de **Morph match** (`hero`, por ejemplo), la transición mueve, redimensiona y recolorea ese cuadro en lugar de cortar. Una transición **Morph** de todo el deck hace lo mismo con cada pareja coincidente.
- **Narración.** Las **Speaker notes** de cada mesa de arte se pueden leer en voz alta. En la sección **Document** del Inspector elige una **Voice**, opcionalmente una segunda voz con la que **Blend with**, la **Speed** y un **Lead-in** y un **Tail** en milisegundos; **Show captions when presenting** muestra las palabras a medida que se pronuncian. La voz se ejecuta en tu dispositivo, y las mismas notas se convierten en la banda sonora de una exportación de vídeo, en el audio de las diapositivas de una exportación a PowerPoint y en la película narrada de un [paquete SCORM](/info/create/exporting.html#scorm-course-packages).

El deck también es un enlace. `?present` abre directamente en él y `s=` elige la diapositiva (una posición, un ID de mesa de arte o `id.step` para un paso de construcción), y la dirección te sigue, así que lo que envías es la diapositiva en la que estás. [Reserved URL parameters](/info/url-parameters.html#what-happens-on-open) los documenta.

**Present with camera** coloca tu cámara, un logotipo y un rótulo con tu nombre sobre las diapositivas, con controles privados y escenas guardadas; consulta [Presenting with camera](/info/presenting.html). Un cuadro **Web page** puede tomar el control del puntero durante una charla cuando activas **Make interactive** en su inspector: en su paso **Focus on click**, Arriba y Abajo controlan la página mientras Siguiente continúa el deck. [Live pages that take the clicker](/info/interactive-pages.html) cubre los estilos de foco, las paradas de desplazamiento y la aprobación de sitios.

## A dónde ir ahora

- **[Text in Design](/info/text-composition.html)**: editar texto en el lienzo, hacer fluir artículos por marcos y tipografía.
- **[Animating](/info/animating.html)**: fotogramas clave, profundidad, la cámara de escena y las capas Lift.
- **[Import a design](/info/design-import.html)**: abre un archivo de Figma, Penpot, Illustrator o InDesign como cuadros editables.
- **[Share a design with rules](/info/create-a-tool.html)**: convierte un documento de Design en una herramienta con solo las entradas que elijas.
- **[Export a file](/info/exporting.html)**: formatos, tamaños, unidades de impresión y vídeo.
