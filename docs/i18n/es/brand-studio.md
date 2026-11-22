# Lolly Design System Setup

<a id="design-system-setup"></a>

**Lolly Design System Setup**, en `#/start`, contiene tu logo, colores y tipografías. Todas las herramientas, páginas y exportaciones dibujan con ellos.

Suelta un logo y Lolly lee sus colores. Elige una tipografía o suelta el archivo de fuente para el que tu empresa tiene licencia. Cada cambio se muestra en toda la aplicación al instante. Tu logo, fuentes y tokens se quedan en este dispositivo. Solo elegir una Google Font se conecta al exterior: Lolly pide permiso primero y luego descarga la familia una vez.

Pon nombre al design system y pulsa **Export** para obtener un único archivo `.lolly`. Conserva el archivo, ábrelo en otro dispositivo o entrégaselo a un colega. [Lolly Settings](/info/dashboard.html#design-system) muestra el sistema activo en modo de solo lectura; su portada enlaza aquí para editarlo.

<!--i:eti-clock-->
## Hazlo tuyo en cinco minutos

::: timeline
- <!--i:upload--> **Suelta tu logo** en la zona para soltar archivos de **Logos**. Lolly lee su forma y sus colores.
- <!--i:palette--> **Use these colours.** El color principal del logo se convierte en tu primario, y un neutro oscuro del logo se convierte en tu color de texto.
- <!--i:font--> **Choose a face** en **Type**: una Google Font o un archivo de fuente que tengas.
- <!--i:pentool--> **Pon nombre al sistema.** Tu primera edición crea un design system propio, y Lolly pide su nombre una vez.
- <!--i:download--> **Export** escribe todo el sistema como un único archivo `LollyBrand-….lolly`.
:::

La barra superior del estudio muestra el nombre del design system como un campo editable. **Enter** conserva un nombre nuevo y **Escape** restaura el anterior. Cuando tu primera edición pregunta **What is this design system called?**, Lolly rellena el campo con las palabras de tu logo, si contiene texto. **Save name** conserva el nombre; **Not now** mantiene un nombre provisional hasta que escribas uno en la barra. El nombre identifica el sistema en Settings y cuando cambias de sistema, y es el nombre del archivo que escribe **Export**.

<!--i:eti-grid-->
## Las salas

El estudio es un conjunto de salas sin un orden fijo. Ninguna sala depende de otra. En un ordenador, las salas se sitúan en una franja bajo la barra. En un teléfono, pasan a una barra en el borde inferior, que se desplaza para mostrar la sala abierta. El panel de la paleta y la bandeja se elevan sobre esa barra, y la barra se aparta mientras escribes. Con un teclado, Tab llega a la franja una sola vez, y las teclas de flecha, Home y End se mueven entre salas.

![La barra del estudio y sus salas: Board, Colours, Type, Logos, Tokens, Files, Sound, Rules y Skills](/t/url-shot?url=%2F%23%2Fstart&width=1440&height=900&dpi=192&waitMs=1600&cropSelector=.ds-top&waitSelector=.ds-room-nav&format=svg&walker=1&localize=1&dark=1&filename=brand-studio&try=1)

| Sala | Qué haces allí | Clave del enlace |
|---|---|---|
| **Board** | Ver qué contiene el sistema, con una puerta a cada sala | `overview` |
| **Colours** | Añadir colores, asignarles roles, crear tonos y una paleta | `color` |
| **Type** | Elegir las cuatro tipografías que leen la aplicación, las herramientas y cada exportación | `type` |
| **Logos** | Colocar tus marcas en todas las orientaciones y tratamientos | `logos` |
| **Tokens** | Esquinas, espaciado, sombras y todos los demás valores con nombre | `tokens` |
| **Files** | Los archivos de imagen, audio y movimiento que conserva tu marca | `catalogue` |
| **Sound** | Dar forma a la identidad sonora, la música para distintos usos y la relación con la voz | `sound` |
| **Rules** | Las reglas que aplica tu marca, comprobadas en ejemplos reales | `usage` |
| **Skills** | Las normas escritas de la marca para personas y agentes, para leer y descargar | `skills` |

Enlaza a una sala con `#/start?area=<key>`. Las claves de las salas son permanentes, así que Files conserva `catalogue`, Board conserva `overview` y Rules conserva `usage`. `?tab=` sigue funcionando como alias antiguo. Una clave desconocida abre Board.

La **barra** contiene acciones para todo el sistema. **Add from…** importa una marca ([Importar una marca](#bring-a-brand-in)). **Tray** contiene lo que encontró un análisis y que todavía no has añadido. **Export** escribe el sistema como un único archivo. **More** contiene **Tokens (.json)**, **Fonts for Linux (.rpm)**, **Versions & publishing**, **Restore brand settings** y **Design systems**, que abre la lista de Settings donde cambias de sistema ([Conservar y trasladar tu design system](#keep-and-move-your-design-system)). Cada acción aparece cuando tiene algo sobre lo que actuar. En un teléfono, **Add from…** pasa a **More** y **Export** se muestra como su icono.

Mientras el design system sea el que venía con la aplicación, la barra empieza con **Make it yours**, un menú con **Find a look**, **Add from…** y **Pick a colour**. Cuando el sistema ya es tuyo, **Export** vuelve a ocupar ese lugar.

<!--i:eti-clipboard-->
## Board

Cuando todavía no has elegido nada, Board ofrece cuatro formas de empezar. **Start from a reference** abre el selector de origen para un logo, una captura de pantalla, una página web o un archivo de diseño. **Pick a colour**, **Choose a face** y **Add a logo** abren esos controles. Abrir uno no guarda nada. Debajo, **Find a look** ofrece colores y tipografías ya preparados para probar, y **Explore the tools** está disponible desde el principio.

En cuanto hay algo tuyo, Board muestra lo que tienes, con tus propios recuentos primero. Colours indica el número de colores, con un `· N starter` atenuado para los heredados. Su franja muestra tus colores, luego una línea fina y después los colores iniciales atenuados. Colourways muestra cada colourway como una pequeña tarjeta en su color principal. Type enumera cada rol y compone cada familia con su propia tipografía (*Inter para encabezados*, con *Starter para el resto* en la línea de abajo). Logos indica cuántas posiciones están ocupadas (o **Not set**), Tokens muestra el radio de las esquinas y Files dice **Nothing yet** mientras la biblioteca está vacía. Cada bloque abre su sala.

Un design system editable que venía con la aplicación, como Lolly Demo, muestra sus colores, colourways, tipografías y marcas en Board desde el principio, con una etiqueta **Came with this app** junto al encabezado. Encima, **Start here** ofrece **Find a look**, **Add from…** y **Pick a colour**.

### Starter y lo tuyo

En cada sala, **Starter** marca todo lo que venía con la aplicación y que nadie eligió. Una instalación nueva no tiene color, solo una escala de neutros de tinta a papel, para que las superficies, el texto y las líneas finas puedan renderizarse antes de que alguien elija.

::: cols
## Starter

- Venía con la aplicación: los neutros de tinta a papel, las tipografías iniciales, el radio de esquina predeterminado.
- Atenuado, con una etiqueta **Starter** y sin tinte.
- No se cuenta entre tus colores. Los neutros están en **Tokens** como **Neutrals · starter · 9**, y **Open** los muestra en Colours como un único grupo plegado (`#/start?area=color&group=neutral`).
- Un rol que usa un color inicial indica *"Starter Paper lo sustituye"*, con **Choose…** en su selector.

## Lo tuyo

- Elegido o instalado por ti.
- A plena intensidad, y con una tarjeta teñida donde instalaste una tipografía.
- Se cuenta en Board y en Tokens.
- Un rol que sigue a otro indica **↳ follows Primary**.
:::

El material heredado nunca tiene un borde discontinuo. Un borde discontinuo indica una zona para soltar archivos.

<!--i:eti-shapes-->
## Logos

La zona para soltar archivos de la parte superior, **"Drop marks here, or choose several at once"**, acepta tantos archivos como tengas. Lolly lee la forma y la tinta de cada archivo. El archivo espera entonces bajo **Waiting for a slot** como un chip que indica a qué se parece, como *"Parece Horizontal primary"*, con la medida que usó y un botón **Place** (**Replace** donde la posición está ocupada). Cuando Lolly no está seguro, el chip lo indica y ofrece **Change slot**, que enumera las ocho posiciones. No se coloca nada hasta que pulsas un botón.

Una marca con demasiado margen vacío recibe primero una propuesta de recorte. Responde a la propuesta o pulsa Escape para colocar el original intacto. Cuando una marca puede ocupar una posición hermana vacía, la sala ofrece la versión **mono** o **reverse** derivada como un chip marcado *Generated*.

Cada marca va en una cuadrícula de ocho posiciones opcionales, una por **orientación** y **tratamiento**:

- **Orientaciones:** Horizontal (logotipo tipográfico y símbolo en una fila) y Vertical (apilados, para espacios cuadrados y altos).
- **Tratamientos:** Primary, Primary reverse (para fondos oscuros), Mono (un color) y Mono reverse.

Un grupo sin marcas se pliega en una línea; abre el grupo para ver sus posiciones. Haz clic en una posición para añadir un PNG, SVG, JPEG o WebP, o en una ocupada para reemplazar la marca. Una posición vacía también acepta un archivo soltado. Las marcas horizontales se sitúan en tarjetas anchas y las verticales en cuadrados, cada una sobre la superficie para la que se creó, con un espacio libre de un cuarto de su altura. Todo se queda en este dispositivo.

![Las posiciones de logos con Horizontal y Vertical abiertos: cada tratamiento tiene su propia posición y todas las posiciones son opcionales](/t/url-shot?url=%2F%23%2Fstart%3Ftab%3Dlogos&system=new-design-system&width=1440&height=1600&dpi=192&waitMs=1600&drive=click%3A.be-logo-identity%3Edetails.be-logo-group--fold%3Anot%28.be-logo-group--custom%29%3Esummary%3Bwait%3A600&cropSelector=.be-logo-grid&format=svg&walker=1&dark=1&filename=bs-logo-slots)

- **Custom marks** son marcas que tu marca identifica con su propio nombre, como un icono, un escudo o un favicon.
- **Más identidades.** Una submarca, un producto o un evento puede tener su propio conjunto completo: pulsa **+ Add another logo** y pon nombre al conjunto. Tu conjunto principal es "Your logo". [Arquitecturas de marca](/info/brand-architectures.html) muestra cuándo usar una identidad de logo.
- **Lolly lee los colores del logo.** Una tarjeta bajo la zona para soltar archivos y en la parte superior de Colours enumera los colores del logo y pregunta **Which is the main colour?**. Se selecciona el color más intenso, nunca el blanco sobre el que se exportó el logo. **Use these colours** los añade a tu paleta y convierte el color principal en tu primario. Cuando el logo tiene un neutro oscuro que se lee bien sobre papel, ese neutro se convierte en el color del texto. **Not now** los deja en Tray. En una instalación nueva, Lolly aplica la respuesta más probable al instante, y la tarjeta ofrece **Undo** u otro color principal. Un SVG da colores exactos; un PNG, JPEG o WebP da los colores que cubren una parte significativa de la marca.

<!--i:eti-palette-->
## Colours

La sala crece con el design system. La primera visita pide una decisión; aparecen más controles a medida que crece la paleta.

### El primer color

Un sistema sin colores propios muestra los neutros iniciales en su propio grupo abierto. En la parte superior de la sala hay un campo con borde discontinuo para pegar y soltar: un chip grande y un campo. Suelta una imagen o una lista de colores en cualquier parte del campo, y Lolly lee los colores.

- **El chip es el selector.** **Pick a colour** abre la tarjeta OKLCH del estudio, inicializada con el contenido del campo. La tarjeta muestra primero el nombre del color y su valor hexadecimal. Los espacios de color, la rueda, los cuatro diales y el alfa están en **Fine-tune**, y **Cancel** y **Add colour** están al pie. Nada llega al sistema hasta que pulsas **Add colour**.
- **El campo acepta cualquier notación**: `#e0452b`, `rgb(224 69 43)`, `oklch(58% .19 32)` o un nombre de color. Una lista pegada se convierte en una fila de chips para añadir uno a uno o con **Add all**.
- **Dos formas más de añadir.** **Pick a colour from the screen** usa el cuentagotas cuando el navegador lo tiene, y **Take colours from an image** lee una captura de pantalla o una foto de este dispositivo.
- **Add nunca está desactivado.** Si el campo está vacío, abre el selector; si no puede leer el texto, aparece una línea bajo el campo que lo indica.

Tu primer color se convierte en el **primario**. Un chip confirma el cambio, como *"El primario ahora es Vivid Violet"*, con **Fine-tune** para ajustar el color.


### A medida que crece la paleta

Tus colores se sitúan junto a una vista previa **In context** en una pantalla ancha y encima de ella en una más pequeña. La vista previa muestra un póster, un gráfico o una tarjeta de interfaz con tu paleta. Los colores iniciales tienen su propio grupo, que se pliega cuando el sistema tiene colores propios. El campo para pegar y soltar se convierte en una fila compacta. La cabecera de la sala no tiene exportación; usa **Export** en la barra o la sala Tokens.

![La sala Colours en Lolly Demo: los chips de roles y el campo para pegar y soltar en la parte superior, seguidos de la paleta en grupos plegables, cada color con su nombre y valor hexadecimal](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor&width=1440&height=740&dpi=192&waitMs=1800&drive=click%3A%5Bdata-be-roles-fold%5D%3Esummary%3Bwait%3A500&format=svg&walker=1&localize=1&dark=1&filename=brand-colours)

![La sala Colours en Lolly Demo después de añadir un color: la tabla Colour roles y luego el chip del color nuevo que ofrece Use as Lead? y Fine-tune, junto a una vista previa de la composición en vivo](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dpick&width=1440&height=840&dpi=192&waitMs=1800&drive=click%3A%5Bdata-be-editor-add%5D%3Bwait%3A900&format=svg&walker=1&dark=1&filename=bs-colour-first)

### Roles de color: cómo se llaman los colores

El design system da nombres a sus colores e indica para qué sirve cada uno, y Lolly lee ambas cosas. **Colour roles** está en la cabecera de la sala Colours. **In context** muestra cada cambio al instante.

![La tabla Colour roles de Wefthouse, una marca textil inventada, con sus propias palabras: los chips de colourway Indigo, Madder y Weld, seguidos de Main, Accent, Supporting y Tertiary, cada uno con su color claro y oscuro, interpretados como color principal, color complementario y solo por su nombre, y Background, Text, Quiet text y Hairlines enumerados bajo la tabla como las interpretaciones que ningún rol cubre](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor&system=wefthouse&width=2720&height=2000&dpi=192&waitMs=1800&cropSelector=%5Bdata-be-roles-fold%5D&format=svg&walker=1&dark=1&filename=bs-colour-roles)

La tabla tiene cuatro columnas. En un teléfono, cada fila se convierte en una tarjeta con el aspecto claro y el oscuro uno junto al otro:

| Columna | Qué contiene |
|---|---|
| **Role** | La palabra propia del design system, que puedes editar en el mismo lugar, y una línea que indica para qué sirve el color |
| **Light** y **Dark** | El color en ese aspecto para la colourway elegida, con su nombre o valor y su contraste |
| **Lolly reads this as** | Lo que hace una herramienta con el rol, con las propias palabras de Lolly |

**Cómo interpreta Lolly un rol.** Cada interpretación corresponde a un rol. Elegir una interpretación que tiene otro rol la traslada a este rol. Lolly nunca deduce el significado de una palabra.

| Interpretación | Qué implica |
|---|---|
| **Lead colour** | Formas grandes, botones, el color que predomina en una herramienta |
| **Partner colour** | El segundo color al que recurre una herramienta |
| **Background** | Se sitúa detrás de todo lo demás |
| **Text** | Encabezados y texto del cuerpo |
| **Quiet text** | Pies de imagen y letra pequeña |
| **Hairlines** | Líneas, bordes y separadores |
| **By name only** | Ninguna herramienta elige el rol por sí sola. Se ofrece en todos los campos de color y en Design, donde la elección mantiene el vínculo, de modo que sigue la colourway |

Una interpretación que no ocupa ningún rol conserva la definición del design system, y la sala enumera esas interpretaciones bajo la tabla. Un rol que comparte el id de una interpretación, como un rol llamado Primary, es esa interpretación y no se puede trasladar.

**En un gráfico.** La paleta **Design system - colour roles first** de Lolly Chart asigna a las series los roles de color del design system en su propio orden y luego el resto de su paleta. Un rol interpretado como fondo, texto, texto secundario o líneas finas queda fuera, porque el gráfico dibuja su fondo y sus palabras con esos colores. Nada cambia hasta que eliges esa paleta. Un design system sin roles de color dibuja la paleta como **Design system - ordered**.

**Valores.** Pulsa un valor para elegir el color de ese rol para ese aspecto y la colourway elegida. **Same as light** hace que el valor oscuro siga al claro hasta que elijas un color oscuro. El chip **Aa** muestra el texto que Lolly elige para poner sobre el color. La línea bajo el valor indica cómo se lee ese texto en cada aspecto: **Text reads well**, **Large text only** o **Hard to read as text**. La valoración solo se refiere al texto sobre el color; el color puede seguir sirviendo para formas y zonas grandes. Un rol interpretado solo por su nombre muestra las mismas palabras sin el color de advertencia, porque ninguna herramienta pone texto sobre ese rol por sí sola. La descripción emergente y el selector muestran las cifras, primero APCA y después WCAG. **Own text colour** marca un valor cuyo archivo indica el color del texto; ese color de texto se conserva. **Copied** marca un valor de otra colourway o del color de apoyo que nadie ha elegido aún; **Keep this colour** en el selector confirma el valor.

**Puntos de partida.** Un design system sin roles propios muestra las palabras actuales: Primary, Secondary, Surface y Text. No se escribe nada hasta que cambias una. **+ Add a role** sugiere **Primary, Secondary** o **Main, Accent, Supporting, Tertiary**, o acepta las palabras que escribas, y muestra la interpretación que recibiría cada una. Las dos primeras palabras se convierten en el color principal y el color de apoyo. Las herramientas siguen dibujando los mismos colores. En un sistema con un color principal, la primera colourway toma el nombre de ese color.

**Renombrar, reordenar, eliminar.** Renombrar solo cambia la palabra; todo lo que usa el rol sigue funcionando. Arrastra un rol por su asa, o pulsa Space sobre el asa, usa las teclas de flecha y pulsa Space para soltarlo. **Remove** indica qué sigue usando el rol. Cuando las herramientas interpretan el rol, **Remove and keep those colours** deja cada interpretación con su color actual. Una regla de la organización, un grupo de guías, un campo de herramienta u otro token que use el rol lo retiene hasta que cambie ese uso. Un documento de Design guardado también puede usar un rol por su nombre, y Lolly no puede verlo desde el archivo de tokens. Ese documento indica que el color no se ha podido resolver.

::: details Roles en un archivo de tokens escrito a mano
**Un archivo escrito a mano.** Los colores de un archivo de tokens que ningún rol declara se enumeran bajo **In this file, with no role yet**, cada uno con un campo para una palabra y **Make a role**. Siguen funcionando por su nombre en ambos casos. Un token con dígitos en su nombre no puede ser un rol; permanece en el archivo y sigue funcionando por su ruta. Si un registro del archivo no supera la validación, la tabla se muestra sin controles e indica por qué.
:::

**El resto de la sala usa las mismas palabras.** Los chips, la fila **Use as** de la muestra y el grupo **Colour roles** de la paleta usan las palabras del design system. La tarjeta de un rol de color abre su valor. Los archivos exportados no registran nada nuevo sobre los roles; los colores de un renderizado cambian porque cambiaron los tokens.

**Adónde van las palabras.** Las palabras y descripciones viajan con el design system. Los agentes las leen en el brief de diseño, en "'`lolly://tokens` y en el `AGENTS.md` de una página de marca. El terminal las muestra en `lolly system status`. Una página de marca las enumera en `brand.json` y mide un par de contraste para cada rol. Los archivos de DTCG y Tokens Studio lo conservan todo, `DESIGN.md` conserva las palabras y las interpretaciones, y un tema de PowerPoint conserva solo el orden de la marca. [Roles de color en otros formatos](/info/design-tokens.html#colour-roles-in-other-formats) contiene la lista completa. Las palabras siempre se citan como datos del design system, nunca se interpretan como instrucciones.'"

**Dónde se elige un color.** Cada campo de color de una herramienta y de Lolly Design enumera primero los roles del design system, en su propio orden, con cada palabra y su propósito. **Aa**, junto a un rol, elige el color que se sitúa sobre ese rol. Los otros colores aparecen después, bajo **Other colours**, sin las copias propias de una colourway, los colores de superposición ni ninguna interpretación que ya ocupe un rol. La elección mantiene el vínculo con el rol y sigue la colourway. El campo muestra la palabra en cada colourway, y Settings y Tokens también la usan. Un design system sin roles conserva su cuadrícula de muestras.

### Cada color que lee una herramienta

Con **Colour roles** cerrado, la sala empieza con chips para las primeras decisiones. Cada chip muestra el color del rol y su nombre. En un sistema sin palabras propias son **Primary**, **Secondary**, **Surface** y **Text**. Pulsa un chip para elegir su color entre las muestras de la paleta. **Every colour a tool reads**, al pie de **Colour roles**, contiene la tira completa.

La tira muestra los siete colores que puede leer una herramienta: Primary, Secondary, Surface, Text, Muted, Edge y On primary, con las palabras propias del design system cuando las tiene. Cada uno cumple la misma función en todas las herramientas y exportaciones. No es obligatorio definir ninguno, y cualquier color puede ocupar uno. Tres colores sueltos forman un buen sistema. El indicador muestra cómo se lee el texto sobre la superficie, primero con APCA. Cada fila muestra tu propio color a plena intensidad, un color inicial que lo sustituye o **↳ follows Primary**.

On primary se deriva del color primario, indica **Derived** y no tiene selector. El interruptor **Light** y **Dark** junto a On primary, y el que hay junto a **In context**, eligen qué aspecto muestran la tira, la paleta y la vista previa.

El color de acento de la aplicación sigue el design system de forma predeterminada, mediante el ajuste **Interface follows the design system** en **Settings → Appearance**. Con el ajuste desactivado, la interfaz de la aplicación se mantiene neutra. Las herramientas, los lienzos y las exportaciones siguen el design system en ambos casos.

**Colourways.** Un design system puede contener varios colores principales, que se eligen para cada pieza. La fila **Colourways** al principio de **Colour roles** muestra un chip por colourway, con **Default** en la canónica. **+ Add** inicia una colourway nueva a partir de un color de la paleta. Elige un chip y la tabla, la tira, la paleta y las vistas previas muestran esa colourway. Puedes renombrar, duplicar, eliminar o establecer como predeterminada la colourway elegida. En un sistema con colourways, cada una necesita su propio color primario y secundario, y su propia superficie cuando las colourways tiñen el fondo. Esos roles permanecen definidos en el editor de muestras. [Añadir colourways a un design system](/info/colourways.html#add-colourways-to-a-design-system) contiene los pasos y el formato de los tokens, y [Lolly Demo en uso](/info/lolly-demo-in-use.html#colourways-on-real-work) muestra colourways en trabajo real. Cada persona puede adoptar una colourway como propia en **Settings → Appearance** ([Haz tuya una colourway](/info/colourways.html#make-a-colourway-your-own)).

### Encuentra más colores

Tres herramientas parten de tu color primario. Las dos primeras solo sugieren; la tercera reemplaza la paleta.

::: cols
## Explora tonos & armonías

Elige un **Starting colour**, un **Scheme** (Mono, Complement, Analogous o Triad) y cuántos **Shades** quieres (de 3 a 20, 5 de forma predeterminada). **Fine-tune** ajusta la intensidad de la interfaz, el contraste y el texto sobre el color de marca. Haz clic en un tono para añadirlo, o en **Add 5 shades** para añadir un grupo. Tus colores y roles se conservan.

## Encuentra colores que combinen

Elige una **Harmony**: Complementary, Adjacent, Triad, Tetrad o Analogous (con **Accents** de 2 a 5 y un **Angle** de 10° a 45°). Cada candidato tiene un nombre generado y **+ Add**, una pulsación por color.

## Reconstruye toda la paleta

Reemplaza la paleta a partir de un color inicial, tras revisar qué cambia y qué se conserva.
:::

Las tres usan los mismos cálculos de color perceptual (OKLCH) que el motor. En **Explore shades & harmonies**, las filas **Primary**, **Neutral** y **Secondary** muestran los tonos sugeridos, y **Theme preview** muestra ejemplos claros y oscuros con sus mediciones de contraste.

![Tres grupos de tonos sugeridos, con controles individuales para añadirlos y una Theme preview aparte](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dgenerate%26seed%3D%2523e0452b&width=1440&height=1400&dpi=192&waitMs=1800&css=.start-head%7Bdisplay%3Anone%7D&cropSelector=.be-preview&format=svg&walker=1&dark=1&filename=bs-colour-ramps)

![Acentos generados, cada uno con una muestra, un nombre generado automáticamente, su valor hexadecimal y un botón Add](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dgenerate%26seed%3D%2523e0452b&width=1440&height=900&dpi=192&waitMs=1800&css=.start-head%2C.be-colour%7Bdisplay%3Anone%7D&drive=click%3A.be-generate-detail%3Anot%28%5Bdata-be-rebuild%5D%29%20%3E%20summary%3Bwait%3A500&cropSelector=.be-candidates&walker=1&format=svg&dark=1&filename=bs-harmony-candidates)

### Aplicar una paleta generada

Abre **Rebuild the whole palette…** y pulsa **Preview full rebuild**. La revisión cuenta cuántos roles se quedan como los asignaste, cuántos colores propios se conservan y cuántas curvas de tonos, valores fijos de impresión, tonos ocultos y paradas de degradado se vuelven a anclar o se conservan. **Apply rebuilt palette** aplica los cambios; **Cancel** no cambia nada. Después, la tarjeta ofrece **Undo**, ya con el foco, y el punto de control creado antes del cambio restaura todo el sistema.

Un sistema con colourways conserva todas sus colourways al reconstruirse. La colourway canónica sigue el nuevo color inicial, y todas las demás conservan sus propios colores, nombre, orden y ajustes. La revisión enumera qué colourway sigue el cambio y cuáles conservan sus colores. Lolly no reconstruye un sistema que codifica sus colourways de una forma que no puede editar; la tarjeta explica por qué y nada cambia.

### Las secciones avanzadas

Bajo la vista previa y los roles hay cuatro secciones plegadas. Cada una se abre con `#/start?area=color&focus=<name>`:

- **Explore shades & harmonies** (`focus=generate`).
- **Shade curves** (`focus=curves`) modifica una escala punto por punto, con curvas independientes de luminosidad, croma y tono (L / C / H) y los tonos se redibujan al arrastrar.
- **Contrast** (`focus=contrast`): **Contrast-lock** ajusta los tonos de una escala para alcanzar los objetivos APCA sobre un fondo que eliges, y **Rotate hue** gira toda la escala por el círculo cromático.
- **Print** (`focus=print`) define en qué se convierte el color primario en imprenta: su valor automático, una composición CMYK fija o una tinta plana con nombre.

### La paleta y cada muestra

La paleta enumera tus colores en grupos plegables, cada uno con su propio **+ Add**. Puedes crear y renombrar grupos. Un rol nunca crea una segunda tarjeta; la tarjeta a la que apunta un rol muestra el nombre del rol, como **Primary**. **Colour chart**, bajo las tarjetas, muestra los mismos colores en **Wheel** de OKLCH (arrastra un punto para cambiar su color, haz clic en un espacio vacío para añadir una muestra) y en el gráfico **Gamut**, que muestra dónde termina la gama representable. `#/start?area=color&focus=chart` abre el gráfico.

![El panel de la paleta, con todos los grupos plegables](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dgenerate%26seed%3D%2523e0452b&width=1440&height=1000&dpi=192&waitMs=1800&drive=click%3A%5Bdata-be-roles-fold%5D%3Esummary%3Bwait%3A500%3Bclick%3A%5Bdata-be-add-ramp%3D%22primary%22%5D%3Bwait%3A1200&cropSelector=.be-split-side&walker=1&format=svg&dark=1&filename=bs-palette-pane)

![El círculo OKLCH - el ángulo es el tono, la distancia al centro es el croma y los grises se sitúan en un carril de luminosidad en el lateral](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dgenerate%26seed%3D%2523e0452b&width=1440&height=900&dpi=192&waitMs=2400&css=.start-head%2C.be-pal%2C.be-gradients%7Bdisplay%3Anone%7D&drive=click%3A%5Bdata-be-add-ramp%3D%22primary%22%5D%3Bwait%3A1200%3Bclick%3A%5Bdata-be-chart%5D%20summary%3Bwait%3A900&cropSelector=.be-pal-wheel&walker=1&format=svg&dark=1&filename=bs-colour-wheel)

Haz clic en una muestra para abrir su editor:

- **Rename** cambia el nombre de la muestra.
- **Set the colour** permite ajustar el color con deslizadores OKLCH, o en **Hex**, **HSL**, **RGB** o **CMYK**. El campo de valor lee y escribe en el espacio activo. CMYK aquí define el color de pantalla mediante conversión; para fijar tintas exactas, usa **Print substitutes**.
- **Stored as** elige cómo se guarda la muestra: **LCH** (el predeterminado, perceptual y de gama amplia), Hex, RGB o HSL.
- **Use as** asigna un rol a la muestra, con las palabras propias del design system cuando las tiene. Pulsa de nuevo un rol resaltado para quitarlo.
- **Print substitutes** (plegado): fija **CMYK** de **Auto** a valores de tinta exactos, o define un **Spot colour** con un **Name** (como `PANTONE 186 C`), un **Book** opcional y un **Finish** para estampado con lámina, relieve, bajorrelieve, barniz selectivo, tacto suave o troquelado, hendido o perforación. Una imprenta usa estos valores fijos cuando exportas un PDF o TIFF CMYK; consulta [Perfiles de color](/info/exporting.html#colour-profiles). Una tinta plana se imprime en su propia plancha en un Print PDF; para imprimir todas las tintas planas en cuatricromía en una exportación, consulta [Tintas planas en cuatricromía](/info/exporting.html#spot-inks-as-process).
- **In other spaces** (plegado): un valor por espacio de color, derivado o definido por ti, y el definido por ti tiene prioridad al exportar.

**Eliminar una muestra** es seguro. Los tonos derivados y los roles del tema se ocultan, así que nada que los lea deja de funcionar. Los colores que añadiste se eliminan.

::: details Trabajar con muchas muestras
En reposo, una muestra presenta su color, nombre y valor hexadecimal. Select muestra la casilla y el asa de arrastre de cada muestra en cualquier pantalla, y una tarjeta con el foco del teclado también muestra su asa. Arrastra un asa para reordenar dentro de un grupo, o pon el foco en el asa, pulsa Space, usa las teclas de flecha y pulsa Space de nuevo para soltar; Escape cancela. En un teléfono, la paleta muestra cuatro colores por fila. Para mover colores entre grupos, usa el control **Group** del editor o selecciona varios y usa **Move to**.

La selección no necesita un interruptor aparte: la barra y las casillas aparecen con la primera tarjeta seleccionada y desaparecen con la última.

- **Arrastra sobre un espacio vacío** para dibujar un rectángulo; toda tarjeta que toque se suma a la selección, incluso entre grupos. Una sección plegada no añade nada.
- **Shift-clic** selecciona un rango en orden de lectura, **Cmd/Ctrl-clic** activa o desactiva una tarjeta y un clic normal abre el editor.
- El encabezado de cada grupo tiene **Select all**, y **Cmd-A** con el foco en una tarjeta selecciona todos tus colores propios, nunca uno inicial.
- La cuadrícula tiene una única parada de tabulación: las flechas mueven, Shift-flechas amplía la selección, Space alterna, Delete elimina y Escape borra la selección. Para ajustar un canal en pequeños incrementos, pulsa primero `l`, `c` o `h`.
- En una pantalla táctil, mantén pulsada una tarjeta para iniciar una selección y luego toca para añadir.

La barra indica **{n} selected**, luego **Move to**, **Give a role** (cada color toma el siguiente rol por turno), **Download** (la selección en cualquiera de los seis formatos de paleta), **Duplicate** (una copia de cada uno, situada después del original), **Copy values** y **Delete**. Una copia se abre en el editor; varias se quedan seleccionadas. Un Cmd/Ctrl-Z deshace una acción en bloque.
:::

### Degradados

El panel opcional **Gradients** crea tokens de mezcla a partir de la paleta. Cada degradado tiene una vista previa, de 2 a 8 paradas con nombre y un ángulo. Una parada apunta a una muestra, así que al cambiar el color de la muestra el degradado la sigue. Las mezclas se realizan en OKLCH.

Las descargas de la paleta (design tokens, CSS, SCSS, GIMP y Adobe Swatch Exchange) están en su cabecera. [Lleva tu paleta y tus fuentes a cualquier parte](/info/using.html#take-your-palette-and-fonts-anywhere) describe cada formato.

<!--i:eti-type-->
## Tipografía

Sin una fuente propia, la sala muestra una tarjeta: **Primary**, con un tamaño de lectura en su fuente actual, una etiqueta **Starter**, un botón **Choose for Primary** y la línea *"No se instala nada hasta que eliges una."* Los encabezados, el código y la cursiva siguen la principal hasta que los eliges; **Choose them separately** muestra sus tarjetas.

![La sala Type sin ninguna fuente elegida aún - una tarjeta con tamaño de lectura, una etiqueta Starter y un único Choose for Primary con relleno](/t/url-shot?url=%2F%23%2Fstart%3Ftab%3Dtype&system=new-design-system&width=1440&height=740&dpi=192&waitMs=1800&format=svg&walker=1&dark=1&filename=brand-type)

Elige una fuente y la sala se despliega en cuatro tarjetas de roles, la lista Fonts y una muestra en vivo:

- **Primary**: texto del cuerpo, botones y todas las herramientas.
- **Headings**: la fuente de titulares para `h1` y `h2`.
- **Code**: una fuente monoespaciada para código y datos.
- **Italic**: una cursiva auténtica para énfasis, citas y acotaciones.

Una tarjeta solo se tiñe si instalaste esa fuente. Su botón muestra el rol: **Change Headings** en una fuente propia y **Choose for Headings** en las demás. La línea de muestra se ajusta en varias líneas. Nada en una tarjeta aplica un cambio; el botón abre el área de comparación para ese rol.

![Las cuatro tarjetas de roles desplegadas - cada una con la fuente que le corresponde, con una etiqueta Starter donde nadie ha elegido una e Italic siguiendo a la principal](/t/url-shot?url=%2F%23%2Fstart%3Ftab%3Dtype&system=new-design-system&width=1440&height=1000&dpi=192&waitMs=2600&drive=click%3A%5Bdata-be-typemore-toggle%5D%3Bwait%3A600&cropSelector=.be-typecard-grid&walker=1&format=svg&dark=1&filename=bs-type-specimen)

### El área de comparación

El área se abre bajo la tarjeta que pulsaste. Las tarjetas se pliegan en una tira de una sola línea para que el área se vea en la primera pantalla de un teléfono. Escape cancela y devuelve el foco a la tarjeta.

1. Pulsa **Choose for** y el rol en la tarjeta.
2. Escribe el nombre de una familia y pulsa **Preview**, o pulsa una de las seis familias **Pinned** bajo el campo.
3. Pulsa **Use this face**.

![El área de comparación abierta bajo su tarjeta, con la fila de búsqueda, las familias fijadas y las tarjetas plegadas en una tira de una sola línea](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dtype%26focus%3Dstage&width=1440&height=740&dpi=192&waitMs=1800&format=svg&walker=1&dark=1&filename=bs-type-stage)

**El consentimiento se pide una vez.** La primera vez que una vista previa accede a Google Fonts, un diálogo explica: *Google recibe el nombre de la familia y tu dirección IP. El archivo se guarda después en este dispositivo y se usa sin conexión. Este es el único paso del estudio que accede a un tercero.* **Fetch from Google** continúa y recuerda la elección. **Cancel** deja en la tarjeta el texto *"No se ha obtenido. No se ha enviado nada a Google."*, con su propio **Fetch from Google**.

**Suelta un archivo de fuente en el área** (TTF, OTF o WOFF) para previsualizar una tipografía con licencia que tengas. En ambos casos, la fuente se queda en este dispositivo, se renderiza sin conexión en la aplicación, las herramientas y todas las exportaciones, y viaja en el archivo del design system. Todo lo que ofrece Google Fonts se distribuye con una licencia abierta (OFL, Apache o UFL).

### Fuentes en este dispositivo

El panel **Fonts** enumera todas las fuentes de este dispositivo y el rol que cumplen. Las fuentes que añadiste aparecen primero, bajo **In the design system**, cada una con sus roles y una opción para eliminarla. Las fuentes iniciales aparecen después en una sola fila atenuada y plegada. **Add a face** abre el área de comparación para cualquier rol. El panel **Type roles** presenta una muestra en vivo de cada rol con su familia y estado, como *Inter* o *Inter · follows Primary*.

<!--i:eti-tag-->
## Tokens

Los tokens son los valores con nombre que sustentan el design system: colores, tipografías, logotipos, esquinas y espaciado. Las herramientas los leen por su nombre, así que un cambio aquí llega a todas las herramientas a la vez.

![La sala Tokens: la cabecera con un ejemplo del sistema y las acciones de archivo, tarjetas que cuentan cada tipo de token y luego los pares de colores con sus mediciones de contraste](/t/url-shot?url=%2F%23%2Fstart%3Ftab%3Dtokens&width=1440&height=740&dpi=192&waitMs=1600&format=svg&walker=1&dark=1&filename=brand-tokens)

- **La cabecera** ofrece un ejemplo de tu propio sistema (*Primary es Spearmint, #033633*) y las acciones de archivo: **Download** (el sistema como design tokens, o la paleta en otros cinco formatos), **Copy CSS** y **Add from…** para volver a leer un archivo JSON.
- **Las tarjetas** cuentan cada tipo de token y saltan a su sección: Colours, Type, Logos, Shape and spacing, More y All tokens. Una sección que solo contiene lo que venía con el sistema inicial en blanco lleva una etiqueta **Starter**; un sistema que venía con la aplicación cuenta su propio material sin la etiqueta. En un teléfono, las tarjetas se distribuyen en dos filas de tres.
- **Colours** empieza con los pares que combinan las herramientas (texto sobre superficie, sobre primario, texto atenuado sobre superficie) con una medición APCA en claro y oscuro, y marca **Weak contrast** cuando un par no alcanza el contraste necesario. Luego aparecen todos los grupos de colores: una escala como una fila de chips, los demás colores con su valor y la referencia que usan las herramientas, como `{color.brand.spearmint}`. Pulsa una referencia para copiarla. **Edit in Colours** abre un grupo en la sala Colours. En un design system con [roles de color](#colour-roles-what-the-colours-are-called), **Colour roles** aparece primero, con cada rol una sola vez en las palabras y el orden propios del sistema. Un rol conserva un color para cada colourway y aspecto. Esos colores se enumeran con el rol, no como colores aparte; cámbialos en la tabla Colour roles.
- **Type** y **Logos** enumeran la fuente de cada rol y cada espacio de logotipo, con **Edit in Type** y **Edit in Logos** una vez que tienes los tuyos propios.
- **Shape and spacing** contiene **Rounded corners** (`shape.radius`) y **Spacing rhythm** (`space.base`). Cada uno indica *Lolly default* hasta que mueves el deslizador y *Yours* después, se guarda al instante y se puede deshacer.
- **More tokens** añade espaciado, tamaños, grosor de trazo, opacidad, rotación, números simples y sombras, guardados como [design tokens](/info/design-tokens.html) estándar.
- **App appearance (advanced)** enumera los colores, tamaños y sombras que usan las pantallas de Lolly, e **Inspect every token (advanced)** busca y edita cualquier valor guardado y muestra cada cambio para revisarlo primero. Allí, los valores de un rol de color en cada colourway se enumeran con el rol: elige el token del rol para ver una fila por colourway, con claro y oscuro uno al lado del otro. La línea de recuento indica cuántos valores contienen los roles. Un design system de solo lectura muestra la misma lista.

Una sección vacía ofrece **Pick a colour**, **Choose a face** o **Add a logo**.

<!--i:eti-images-->
## Archivos

Suelta los archivos que conserva tu marca, aparte de los logotipos: archivos **vectoriales**, de **imagen**, de **audio** y de **movimiento** (vídeo, Lottie y animaciones). Aparecen en [Assets](/info/using.html#assets-your-library), ordenados en secciones, y en el selector de recursos de cada herramienta. Se quedan en este dispositivo.

## Sonido

**Sound** se elige escuchando. La sala se abre con tres sonidos iniciales, **Calm**, **Steady** y **Bright**, cada uno en una tarjeta con los colores de su género y un botón de reproducción. Reproduce uno para oír un fragmento breve; al iniciar otro se detiene el primero. **Choose** convierte ese sonido en el sonido de todos los usos. La cuarta tarjeta, **Mixed**, da a cada uso su propio sonido: Calm para Explain, Steady para Demonstrate y Bright para Play. Su botón de reproducción reproduce los tres por turno. No se guarda nada hasta que eliges **Save sound**. El sonido pasa entonces a formar parte de este design system, con un punto de control en el mismo historial que usan las otras salas. Un design system sin sonido sigue funcionando como antes.

Un uso es un momento en el que suena el sonido: **Explain**, **Demonstrate** y **Play** para empezar. Cada uso es un chip con su propio botón de reproducción. **Music** o **With narration**, sobre los chips, define si un chip reproduce solo la música o la acompaña de una voz. El uso que eliges muestra su propósito y su música con palabras sencillas, por ejemplo "Cálido · 84 bpm · Rhodes, bajo fluido, batería vintage". Cada uso toma el género, el tempo y los instrumentos del sonido elegido (o, con Mixed, los suyos propios). Cada uso conserva su propia composición y su propio equilibrio: Explain mantiene la melodía sin interferir con la voz, y Play deja que la melodía lleve el protagonismo. Pasar de Mixed a un solo sonido y viceversa conserva ambos. Un uso que añadiste tú conserva el sonido que tiene en Mixed. El design system registra cuál elegiste. **Add a use** añade uno y te deja escribir su nombre en el mismo sitio. **Make main** elige el uso que se reproduce cuando no se pide otro. **Another tune** reproduce una composición nueva con los mismos ajustes.

**Edit in the music generator** abre el [generador de música](/info/generated-music.html#the-music-generator) con los ajustes de ese uso, con una línea arriba que indica de quién es el sonido que editas. **Save to this use** devuelve los ajustes a la sala; **Cancel** vuelve sin cambiar nada. Las opciones sin guardar de la sala esperan mientras estás fuera. Si alguien guarda el sonido en otra pestaña entretanto, se conserva lo guardado más recientemente y tu edición queda fuera.

**Voice** elige una voz para el uso, la velocidad del habla y el volumen de la música bajo la voz; **Hear the voice with the music** reproduce ambas. Bajo **More** están la atenuación mientras habla la voz, las palabras para probar (se quedan en la sala), las notas de pronunciación (una por línea, como escrito = hablado) y las notas sobre la voz. Las vistas previas usan el modelo de voz local y la misma mezcla que una exportación de secuencia. Una vista previa termina con un fundido; no es un final compuesto.

**Notes and signature** contiene qué escuchar en un uso y una firma sonora: un inicio o final fijo guardado como archivo de audio propio. Coloca la firma en tu secuencia; la música generada nunca incluye la firma. Un requisito que esta versión de Lolly no puede comprobar impide crear música nueva para ese uso.

**Details** contiene el carácter de la marca (qué debe transmitir el sonido, qué se mantiene y qué evitar) y la revisión de escucha. **Record a listening review** guarda el nombre de quien revisa, la fecha y sus notas junto a la versión guardada del sonido. Cualquier cambio convierte el sonido de nuevo en borrador. Una revisión cubre esa versión, no todas las composiciones hechas después a partir del sonido: escucha cada pieza nueva antes de difundirla.

**Make a music project** abre el uso en el generador de música como un proyecto que conserva el uso, la versión del sonido y los ajustes exactos. Allí, **New tune** crea una composición nueva y conserva el sonido. Si cambias los ajustes, **Put the sound back** vuelve al sonido y **Keep as my own** continúa con una composición independiente. Hasta que elijas, el proyecto no se puede guardar ni descargar como creado a partir del sonido. Los enlaces para compartir solo llevan los ajustes musicales. El proyecto y una composición guardada también conservan las notas del sonido, que quedan fuera de los enlaces para compartir y de las credenciales públicas del archivo de audio. Conserva una grabación renderizada cuando el audio exacto deba perdurar en versiones futuras del generador.

<!--i:eti-checklist-->
## Reglas

**Rules** define qué se puede cambiar, qué permanece fijo y qué puede comprobar Lolly.

![Rules en Lolly Demo: cuatro reglas de la organización, cada una marcada como Checked in Design y Required o Advisory, y luego Try your design system in use con sus ejemplos listos para renderizar](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dusage&width=1440&height=1200&dpi=192&waitMs=2400&cropSelector=%23start-panel-usage&format=svg&walker=1&dark=1&filename=bs-usage-rules)

**Brand rules** enumera tus reglas. **Add rule** (o **Add your first rule**) abre un formulario breve:

- un **Rule name** con tus propias palabras, como *Acentos Beacon*;
- la **Check**: **Colour choices**, **Font choices**, **Fixed artwork** o **Text length**, con el rol de marca que usa, bajo tu propio nombre para el rol;
- el **Example** al que se aplica (Poster, Title slide, Content slide o Lolly Chart), el **Mode** y si es **Required** o **Advisory**;
- **Reviewed by** y luego **Save draft** o **Approve & save**.

La aprobación registra tu propia decisión en este dispositivo. Las reglas obligatorias aprobadas restringen el póster reutilizable, y las comprobaciones solo cubren los PNG de ejemplo; no cambian ninguna otra herramienta.

Las reglas del archivo de tokens de un design system, como los pares de colores aprobados, el grosor y la alineación del texto o un logotipo por superficie, se enumeran aquí como **Checked in Design**. Lolly Design las comprueba capa por capa en la tarjeta **Before you export** del panel de exportación, y `lolly check` hace lo mismo con un documento de Lolly Design guardado ([Antes de exportar](/info/design.html#before-you-export)). Una regla para la que esta compilación no tiene comprobación se conserva tal como se suministró y se marca como **Unchecked**.

Lolly Demo incluye cuatro reglas aprobadas de la organización. Los titulares nunca se escriben en mayúsculas: esa regla es obligatoria, así que `lolly check` señala como error un titular en mayúsculas. Las otras tres son recomendaciones. El texto del cuerpo se alinea a la izquierda. Las marcas principales se colocan sobre superficies claras y las marcas en negativo sobre oscuras. Las líneas discontinuas significan que puedes soltar aquí.

**Try your design system in use** renderiza cuatro ejemplos de la revisión actual con **Render & check examples**. Elige un **Mode** y **Try your own text** para el encabezado, el texto de apoyo y el texto de la diapositiva. Cada ejemplo informa de lo medido, con **See checks & sources** y **Download check report**. **Make reusable poster** descarga un `.lolly` con su diseño fijo y las opciones de entrada aprobadas. Los ejemplos son locales: ejecutar una comprobación no publica ni aprueba nada.

Una compilación que incluye una marca fija muestra las mismas reglas y ejemplos en modo de solo lectura, bajo *This brand is set*.

<!--i:eti-graduation-cap-->
## Skills

**Skills** enumera las [skills de marca](/info/brand-skills.html) del design system activo: las normas escritas de la marca, una por disciplina, para personas y agentes de IA. Cada fila indica la disciplina, el estado definido por la propia marca (**Draft** o **Approved**), si la skill es pública o interna y su revisión. Elige una fila para leer la skill con su cobertura, que compara las líneas de la skill con tus tokens: qué comprueba Lolly, qué entra en conflicto, qué coincide y qué es solo orientación.

**Download skill (.zip)** escribe la skill como una carpeta de Agent Skills para una herramienta de agentes, con enlaces del catálogo que apuntan a este Lolly. **Copy as one file** pone el mismo texto en el portapapeles para una ventana de chat. Un design system sin skills propias enumera una base que Lolly escribe a partir de sus tokens y reglas de la organización cada vez que se lee esa base. La sala lee skills y nunca las edita.

<!--i:eti-upload-->
## Importa una marca

**Add from…** en la barra abre un selector que pregunta qué tienes, no en qué formato está:

- **Design tokens or a design file**: JSON de DTCG o Tokens Studio, un proyecto de Penpot, un zip de conjuntos de tokens, un paquete de design system de Lolly, un SVG, un `DESIGN.md` o una carpeta de página de marca.
- **PDF**: un deck o un archivo de directrices, que se lee en este dispositivo para obtener sus colores, marcas y tipografías incrustadas.
- **Logo or screenshot**: una imagen se convierte en una paleta sugerida, leída en este dispositivo. Lee los colores, no la tipografía ni el diseño.
- **Saved web page**: un archivo HTML y sus archivos CSS, o HTML o CSS pegado, hasta 20 archivos y 2 MB. Solo se lee el texto que proporcionas: no se obtienen recursos enlazados ni se ejecutan scripts.
- **Font file**: TTF, OTF o WOFF. Abre la sala Type, donde se instala la fuente.
- **Website**: una página, que se lee para obtener sus colores y tipografía. Esta tarjeta solo aparece en un dispositivo que puede leer una página e indica qué lector usa: la aplicación de este dispositivo o la extensión del navegador en una pestaña en segundo plano, con tu sesión iniciada. Escribir una URL solo rellena el campo; pulsar el botón para obtenerla da el consentimiento.

Elige el origen de archivo de diseño y la siguiente tarjeta enumera los formatos admitidos como tarjetas con iconos. Toda la tarjeta es una zona para soltar archivos. También puedes soltar un archivo sobre el estudio.

![La tarjeta de importación - los formatos admitidos aparecen primero como tarjetas con iconos, y toda la tarjeta es una zona para soltar archivos](/t/url-shot?url=%2F%23%2Fstart%3Fsource%3Dfile&width=1440&height=900&dpi=192&waitMs=1600&css=.start-import-modal%20.modal-msg%2C.start-import-modal%20.modal-title%7Bdisplay%3Anone%7D&cropSelector=.start-import-drop&walker=1&format=svg&dark=1&filename=bs-brand-import-formats)

- Un **paquete de design system de Lolly** (`.lolly`, o un `.zip` antiguo) se instala en un paso.
- Una exportación de **Penpot** (`.penpot`) trae sus design tokens.
- Un archivo de **Design Tokens** (W3C DTCG) o **Tokens Studio** (`.json`) trae sus tokens. Una descripción que pide al lector ignorar instrucciones, afirma tener permisos o pide ejecutar código queda fuera, y la importación indica dónde estaba.
- Un **SVG simple** se analiza para extraer colores entre los que eliges, y el primero se convierte en tu color primario.
- Un **`DESIGN.md`** (`.md`) pasa a **Try these colours** con sus tokens tal como están escritos. Su prosa puede conservarse como una skill de marca en borrador, y la tarjeta señala las líneas que piden al lector ignorar instrucciones, afirman tener permisos o piden ejecutar código. Los agentes y las páginas de marca no ven un borrador hasta que pulsas **Keep this skill** en la sala Skills, y una skill conservada sigue siendo interna.
- Una **carpeta de página de marca**, elegida como carpeta, soltada o comprimida en zip, pasa a la misma revisión. Cada archivo se comprueba con el `brand.json` de la carpeta; un archivo que no coincide hace que se rechace toda la carpeta. La importación añade los tokens. Los logotipos y las fuentes se quedan en la carpeta.

::: warning La comprobación de instrucciones lee línea por línea
La comprobación que excluye instrucciones de las descripciones de un archivo de tokens lee línea por línea y no detecta otras formulaciones. Lee los archivos de personas que no conoces antes de aplicar los tokens.
:::

Lolly lee una página de marca a partir de los archivos que proporcionas. No accede a la dirección de otro sitio.

### Un archivo con sus propias palabras para los colores

Un archivo de tokens o un `DESIGN.md` puede usar sus propias palabras para sus colores, como main, accent, supporting y tertiary. Cuando Lolly encuentra esas palabras, la revisión enumera cada una antes de aplicar nada: la palabra, su color en cada aspecto, el token del que procede y la interpretación que sugiere Lolly. Lolly sugiere interpretaciones solo a partir de las palabras, comparándolas con una lista breve, sin ningún modelo. Una palabra que no está en la lista llega como propia de la marca, **By name only**. Puedes renombrar cualquier palabra, indicar para qué sirve, darle otra interpretación o desmarcarla para conservarla como un color con nombre.

**Install with these roles** escribe los roles; **Install without roles** instala el archivo tal como llegó. Un archivo sin esas palabras omite este paso. Un archivo que declara sus propios roles, como uno escrito por Lolly, los muestra tal como están escritos y los instala sin cambios; puedes editarlos después en la sala Colours. El terminal no tiene revisión: `lolly system import` conserva un registro declarado y deja las palabras de otros archivos como colores con nombre.

### Revisa una referencia

Un logotipo, una captura de pantalla, un sitio web o una página guardada abre **Try these colours**: un ejemplo con los colores propuestos, un **Main colour** que puedes cambiar y un nombre para un sistema nuevo. Un cuadro explica qué hace la aplicación de los ajustes: **reemplaza** los ajustes de tokens activos con la paleta generada y los estilos predeterminados, **conserva** tus fuentes y archivos de la biblioteca y permite **recuperar** el sistema anterior. **Apply suggested settings** crea un punto de control y luego aplica las paletas clara y oscura. **Restore brand settings** puede recuperar los ajustes anteriores. **Change reference** elige otro origen.

::: details Qué lee una referencia y el informe de contexto de diseño
**Palette, source details and individual choices** muestra qué se leyó, los nombres de fuentes encontrados y el contraste de la vista previa. Los nombres de fuentes son solo sugerencias; instalas una fuente en Type. Los detalles del origen pueden incluir tipografía, separaciones, relleno y valores de esquinas donde se hayan observado, con la etiqueta **Not observed** en caso contrario. Una página guardada o la lectura nativa de un sitio web informa de estilos declarados, que la página puede no usar. La extensión del navegador puede informar de estilos medidos en una muestra de elementos visibles. Son observaciones: no se instala nada y el espaciado del origen nunca reemplaza el tuyo. **Choose individual items in the tray** conserva elementos individuales. **Download design context** guarda un informe JSON de observaciones, tokens propuestos e información del origen (con un SHA-256 del HTML o CSS proporcionado). El informe no contiene texto sin procesar de la página y no es una Content Credential firmada.
:::

Las importaciones de PDF y archivos de diseño conservan sus propios controles de revisión. Los elementos de **Tray** no cambian nada hasta que los añades en la sala correspondiente a ese tipo de material. `#/start?source=<kind>` abre el selector en un origen (`file`, `pdf`, `image`, `font`, `url`, `page`), y `?import` abre la lista simple.

### Encuentra y compara un aspecto

Abre **Find a look** desde Board o desde la lista de design systems en Settings. Explora los sistemas guardados en este dispositivo y algunos ejemplos reutilizables de Lolly, y busca por nombre, etiqueta de color o fuente declarada. **Closest to my current palette** ordena por similitud de color medida, con las fuentes coincidentes para resolver empates; no es una puntuación de calidad.

Haz clic en un aspecto para previsualizarlo en contexto; la vista previa no cambia nada. **Use this look** en una tarjeta aplica ese aspecto. Un sistema guardado pasa a ser el activo, sin editar nada. Los colores de un ejemplo se incorporan al design system abierto tras el punto de control habitual. Los logotipos, las fuentes y todo lo demás que el ejemplo no defina se quedan como están. **Compare looks** añade una casilla a cada tarjeta: elige dos para compararlas una al lado de la otra. **Restore brand settings** recupera el aspecto anterior. Los sistemas guardados tienen **Search tags** editables bajo **Details and design context**. Los ejemplos son recetas de color originales de Lolly, sin una colección extraída de otros sitios ni cuenta.

![Lolly compara Sunroom y Orchard uno al lado del otro antes de aplicar cualquiera de los dos sistemas de color.](/t/url-shot?url=%2F%23%2Fstart&width=1280&height=900&dpi=96&waitMs=3000&format=svg&filename=brand-compare-looks&try=1&drive=click%3A%5Bdata-ds-door%3D%22looks%22%5D%3Bwait%3A500%3Bclick%3A%5Bdata-looks-compare-toggle%5D%3Bclick%3A%5Bdata-look-select%3D%22example%3Asunroom%22%5D%3Bclick%3A%5Bdata-look-select%3D%22example%3Aorchard%22%5D%3Bclick%3A%5Bdata-looks-review%5D%3Bwait%3A500&cropSelector=.ds-looks-comparison&waitSelector=%5Bdata-ds-door%3D%22looks%22%5D&walker=1&rasterDpi=96)

<!--i:eti-package-->
## Conserva y traslada tu design system

### Traslada una marca entre dispositivos

**Export** escribe un archivo **`LollyBrand-….lolly`**: tus tokens, fuentes, logotipos y preferencia de tema, con un manifiesto de integridad que se comprueba al importar. Las versiones web anteriores a la 1.0.7 llamaban al archivo `.zip`, y Lolly sigue aceptando esa extensión. **Tokens (.json)** escribe el documento simple de design tokens, sin fuentes ni logotipos, para un repositorio, un paso de compilación u otra herramienta de tokens.

Para volver a importar uno, usa **Add from… → Design tokens or a design file**, o suelta el archivo sobre el estudio. Así te entrega una marca un colega o la llevas a una segunda instalación, sin cuenta ni nube. [Trabajar con socios](/info/partners.html) explica qué más enviar cuando quien recibe tu marca trabaja para otra organización. Para importar una marca desde la línea de comandos, consulta [`ingest:brand`](/info/configuration.html#brand-packs).

**Fonts for Linux (.rpm)** empaqueta las fuentes que añadiste en un RPM instalable. Si subiste alguna por tu cuenta, Lolly te pide primero que confirmes que puedes redistribuirla.

### Restaura ajustes anteriores

Abre **More** en la barra, elige **Restore brand settings**, selecciona un punto de control fechado y pulsa **Restore**. Esto restaura los colores, los ajustes tipográficos y otros tokens de la marca activa; los archivos de fuentes e imágenes se quedan como están. Lolly guarda primero tus ajustes actuales como **Before restore**, para que puedas revertir una restauración incluso después de cerrar el navegador. Los últimos 20 puntos de control se conservan en este dispositivo. Una edición hecha mientras el estudio indica **Saving…** sobrevive a una recarga, y una tarjeta ofrece restaurar los cambios que no terminaron de guardarse.

### Versiones

Una versión publicada es una **copia permanente con nombre** que se conserva en este dispositivo. Nunca cambia, de modo que una herramienta o un enlace que la fija (con `designv`) sigue dibujando lo mismo. Un sistema con algo propio muestra **Versions & publishing** en el menú **More** de la barra; tras tu primera publicación, **Versions** se suma a las salas. `#/start?area=versions` abre Versions.

::: warning Una versión publicada es permanente
Aún no se puede eliminar, y el panel lo indica. Publicar no se puede deshacer; restaurar sí. *Restore latest from this version* es una edición normal, con **Undo** disponible al instante.
:::

**Las eliminaciones encabezan la tarjeta de compatibilidad**, porque un token eliminado hace que una herramienta deje de funcionar.

**Publish only** conserva una versión sin cambiar qué siguen las herramientas; **Publish and make active** hace que las herramientas y la aplicación sigan esa versión. **Follow the latest again** aplica cada edición al instante.

### Publica una página de marca

Una [página de marca](/info/brand-page.html) es una dirección para personas y agentes: una página de logotipos, colores, tipografía y ejemplos, con los mismos datos en los archivos que la acompañan. **Publish a brand page**, bajo Versions & publishing, muestra la página en vivo y, junto a ella:

- **Goes public**: cada archivo, agrupado, con su tamaño.
- **Held back**: qué quedó fuera y por qué. Un logotipo sin licencia registrada queda fuera hasta que marcas el nombre del logotipo. Un archivo de fuente necesita una licencia registrada que permita distribuirlo, y la página muestra una muestra contorneada cuando el archivo queda fuera. Las skills de marca internas nunca aparecen.
- **What was checked**: pares de colores por colourway y modo, y las reglas de la organización. Son mediciones, no un veredicto.
- **In your words**: una declaración de uso y un contacto. La página muestra lo que escribes y Lolly no añade ninguna licencia ni afirmación legal. Un interruptor desactiva la línea "Made with Lolly" del pie de página.
- **On exports**: un interruptor que [registra la dirección de la página en las exportaciones de este design system](/info/brand-page.html#lead-back-from-your-files). El interruptor está desactivado hasta que lo activas, necesita una dirección `https` y no viaja con un paquete ni con una copia. Un design system bloqueado no muestra el interruptor, porque quien lo administra decide.

**Download folder** guarda la carpeta como un ZIP para que la alojes donde elijas. Nada se hace público hasta que alojas la carpeta. En un terminal, `lolly system publish --out=<dir>` escribe la misma carpeta. Una instancia que sirve páginas de marca también ofrece **Publish to** su dirección: una pulsación explícita, a través de la cadena de aprobación de la instancia cuando la tiene. Un design system administrado solo se publica cuando quien lo administra lo permite.

### Conecta un agente

**Connect an agent**, en el mismo sitio, te da texto para pegar e indica qué puede hacer cada opción:

- **`AGENTS.md`** en un proyecto: los agentes leen los nombres y las reglas del sistema. No dibuja nada ni necesita servidor.
- **Lolly's public server**: dibuja con Lolly Demo, sea cual sea el sistema que tengas abierto aquí. No necesita clave.
- **Your instance**: dibuja con los sistemas que contiene la instancia y lee un token de servicio de una variable de entorno. El panel indica el nombre de la variable y nunca muestra un token.

Cuando ningún servidor alojado dibuja con tu sistema, el panel lo indica.

<!--i:eti-layers-->
## Gestiona tus design systems

Abre **Settings → Preferences → Design systems** para cambiar, añadir o eliminar sistemas. **Open** selecciona un sistema y lo abre aquí; **Make a new one** crea un sistema local y lo abre con su campo de nombre listo. Hay un sistema activo a la vez, para todo el dispositivo. [Arquitecturas de marca](/info/brand-architectures.html) ayuda a decidir cuándo una marca necesita su propio design system.

**De dónde viene un sistema.** El sistema que proporciona el catálogo de un despliegue indica **Came with this app**, o **From this instance** en una aplicación conectada a una instancia. Despliega **Catalogue source** para ver quién lo proporciona, su recurso de tokens y espacio de nombres, y su versión o suma de comprobación conocida; si falla una actualización, el material en caché se etiqueta.

**Los sistemas administrados son de solo lectura.** Un sistema indica **Managed by this instance** (o **Managed by this app** en la aplicación de escritorio sin instancia) cuando su catálogo lo bloquea. Puedes usar y descargar un sistema administrado. Al abrir uno aquí, se muestra una nota de solo lectura con **Make an editable copy** y **Switch**, y luego sus roles de color y tokens sin controles de edición. Tus propios sistemas locales siguen siendo editables, aunque el administrado haya llegado primero. Una compilación con una marca fija abre Lolly Design System Setup en *This brand is set*, con los tokens y las reglas de uso de la marca para leerlos.

**Todos los demás sistemas suministrados son tuyos** para ocultarlos, editarlos y restablecerlos, incluidos Lolly Demo y Lolly Starter en lolly.tools. Editar uno conserva su nombre y marca la fila como **Edited here**. **Reset to original** en su menú descarta los cambios hechos en este dispositivo. El sistema inicial en blanco es la excepción: un primer cambio ahí inicia un design system propio, y Lolly pregunta su nombre una vez. [Lolly Demo en uso](/info/lolly-demo-in-use.html#switch-to-your-own) muestra qué reemplaza tu propio sistema.

### Eliminar un design system

Elige **Remove** en el menú de un sistema; la confirmación indica qué sistema estará activo después. Las sesiones guardadas, los archivos subidos y el material compartido con otro sistema se conservan.

Eliminar un sistema suministrado solo lo oculta: sus recursos del catálogo se conservan, **Bring back** lo muestra de nuevo y vuelve por sí solo si eliminas todos los demás. Eliminar una copia importada o editada no elimina el sistema suministrado, sus logotipos ni sus fuentes. Si la copia estaba activa, el sistema suministrado vuelve a estar activo. Eliminar una copia alojada activa borra solo la conexión de esa copia; una instancia elegida por separado sigue seleccionada.

::: details Cambiar un design system que proporciona un servidor
Cambiar lo que proporciona un servidor es una tarea de administración: su operador cambia el catálogo de origen y vuelve a desplegar, o un administrador de Lolly Work revisa y aplica un cambio en el servidor. Las ediciones hechas aquí se quedan en local, con una excepción. En una instancia de Lolly Work que te concede `brand.edit`, un sistema administrado también ofrece **Edit for** esa instancia, que abre una copia para editar. **Send to** esa instancia en **Versions** devuelve sus colores, colourways, roles de color y dirección de la página de marca. [Edita esta instancia desde el estudio](/info/work-design-system-administration.html#edit-this-instance-from-the-studio) explica qué puede cambiar una edición y cómo la instancia sirve el cambio. Consulta [Eliminar un design system del catálogo](/info/configuration.html#removing-a-catalogue-design-system) y [Configuración](/info/configuration.html#supplied-and-local-design-systems).
:::

<!--i:eti-code-->
## Usa el contexto de diseño fuera de la aplicación

**Download design context** guarda el documento de tokens, los colores resueltos, las familias de fuentes declaradas, los ids de recursos, las evidencias del origen cuando se han registrado, la cobertura y las reglas explícitas, sin archivos de fuentes ni prueba de propiedad. La línea de comandos lee el archivo sin servidor: `lolly system import` lo convierte en el design system del terminal y `lolly system check` comprueba las entradas de Lolly Design con el contexto guardado. [Importa tu design system](/info/cli.html#bring-your-design-system) explica la importación y [Qué design system usa un comando](/info/cli-decks.html#which-design-system-a-command-uses) explica la comprobación. Un cliente MCP lee el mismo brief desde `lolly://design-context` ([Servidor MCP](/info/mcp.html)).

<!--i:eti-map-pin-->
## Por dónde seguir

- **[Usando Lolly](/info/using.html)**: las herramientas, guardar, compartir y Assets.
- **[Arquitecturas de marca](/info/brand-architectures.html)**: cómo las divisiones, los productos, las marcas respaldadas, los clientes y las temporadas se corresponden con design systems, colourways e identidades de logotipos.
- **[Trabajar con socios](/info/partners.html)**: compartir tu marca con un socio y trabajar con una marca que te han dado.
- **[Páginas de marca](/info/brand-page.html)**: publica tu design system en una dirección, como un kit de prensa y un kit para agentes.
- **[Design Tokens](/info/design-tokens.html)**: el modelo de tokens en el que está escrita tu marca.
- **[Exportar un archivo](/info/exporting.html)**: unidades de impresión, CMYK y los formatos en los que se renderiza tu marca.
