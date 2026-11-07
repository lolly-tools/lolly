# Lolly Design System Setup

<a id="design-system-setup"></a>

Tu logotipo, tus colores y tus tipografías pertenecen a un solo lugar, para que cada herramienta, página y exportación dibuje con ellos. Ese lugar es **Lolly Design System Setup**, en `#/start`.

Empieza con lo que tengas. Suelta un logotipo y Lolly lee sus colores. Elige una tipografía, o suelta el archivo de fuente que licencia tu empresa. Cada cambio se muestra enseguida en toda la aplicación. Tu logotipo, tus fuentes y tus tokens se quedan en este dispositivo. Elegir una Google Font es el único paso que sale al exterior: Lolly pregunta primero, y luego descarga la familia una vez.

Cuando se ve bien, da un nombre al design system y pulsa **Export**. Obtienes un archivo `.lolly` para conservar, abrir en otro dispositivo o entregar a un colega. [Lolly Settings](/info/dashboard.html#design-system) muestra el sistema activo en solo lectura, y su portada enlaza de vuelta aquí para editarlo.

## Hazlo tuyo en cinco minutos

::: timeline
- <!--i:upload--> **Suelta tu logotipo** en la zona de soltar de **Logos**. Lolly lee su forma y sus colores.
- <!--i:palette--> **Usa estos colores.** El color principal del logotipo pasa a ser tu primario, y un neutro oscuro del logotipo pasa a ser tu color de texto.
- <!--i:font--> **Elige una tipografía** en **Type**: una Google Font, o un archivo de fuente que poseas.
- <!--i:pentool--> **Pon nombre al sistema.** Tu primera edición crea un design system propio, y Lolly pide una vez su nombre.
- <!--i:download--> **Export** escribe todo el sistema como un único archivo `LollyBrand-….lolly`.
:::

La barra de la parte superior del estudio lleva el nombre del design system, y el nombre es un campo que puedes cambiar en cualquier momento: **Enter** conserva un nombre nuevo y **Escape** devuelve el anterior. Cuando tu primera edición pregunta **What is this design system called?**, se rellenan las palabras de tu logotipo si el logotipo las deletrea. **Save name** conserva el nombre; **Not now** mantiene un marcador hasta que escribas uno en la barra. El nombre etiqueta el sistema en Settings y al cambiar, y pasa a ser el nombre del archivo que escribe **Export**.

## Las salas

El estudio es un conjunto de salas sin un orden fijo: nada está numerado y nada espera a otra cosa. En un escritorio las salas están en una tira bajo la barra. En un teléfono pasan a una barra en el borde inferior, donde las alcanza el pulgar, con la sala abierta desplazada a la vista; la hoja de la paleta y la bandeja suben por encima de esa barra, y la barra se aparta mientras escribes. Con un teclado, Tab llega a la tira una sola vez, y las teclas de flecha, Inicio y Fin pasan de una sala a otra.

![La barra del estudio y sus salas: Board, Colours, Type, Logos, Tokens, Files, Rules y Skills](/t/url-shot?url=%2F%23%2Fstart&width=1440&height=900&dpi=192&waitMs=1600&cropSelector=.ds-top&waitSelector=.ds-room-nav&format=svg&walker=1&localize=1&dark=1&filename=brand-studio&try=1)

| Sala | Qué haces allí | Clave de enlace |
|---|---|---|
| **Board** | Ver qué contiene el sistema, con una puerta a cada sala | `overview` |
| **Colours** | Añadir colores, darles roles, crear tonos y una paleta | `color` |
| **Type** | Elegir las cuatro tipografías que leen la aplicación, las herramientas y cada exportación | `type` |
| **Logos** | Colocar tus marcas en cada orientación y tratamiento | `logos` |
| **Tokens** | Esquinas, espaciado, sombras y cualquier otro valor con nombre | `tokens` |
| **Files** | Las imágenes, el audio y los archivos de movimiento que guarda tu marca | `catalogue` |
| **Rules** | Las reglas que aplica tu marca, comprobadas con ejemplos reales | `usage` |
| **Skills** | Los estándares escritos de la marca para personas y agentes, para leer y descargar | `skills` |

Enlaza a una sala con `#/start?area=<key>`. La sala Files conserva la clave `catalogue`, Board conserva `overview` y Rules conserva `usage`, porque la clave de una sala es un contrato permanente, y `?tab=` sigue funcionando como alias anterior. Una clave desconocida abre Board.

La **barra** contiene las acciones de todo el sistema y no de una sala. **Add from…** incorpora una marca ([Bring a brand in](#bring-a-brand-in)), y la **Tray** guarda lo que encontró un escaneo y aún no has añadido. **Export** escribe el sistema como un solo archivo, y **More** contiene **Tokens (.json)**, **Fonts for Linux (.rpm)**, **Versions & publishing**, **Restore brand settings** y **Design systems**, que abre la lista en Settings donde cambias de sistema ([Keep and move your design system](#keep-and-move-your-design-system)). Cada una aparece cuando hay algo sobre lo que actuar. En un teléfono, **Add from…** pasa a **More** y **Export** se muestra como su icono.

## Board

Sin nada elegido todavía, Board ofrece cuatro maneras de empezar. **Start from a reference** abre el selector de fuente para un logotipo, una captura, una página web o un archivo de diseño, y **Pick a colour**, **Choose a face** y **Add a logo** abren directamente esos controles. Abrir uno no escribe nada, y **Explore the tools** está disponible desde el principio.

Cuando algo es tuyo, Board muestra lo que tienes, con tus propios recuentos delante. Colours da el número de colores, con un `· N starter` atenuado donde se muestran colores heredados; su tira pone primero tus colores, luego una línea fina, luego los colores de inicio atenuados. Colourways muestra cada colourway como un pequeño mosaico con su color principal. Type se lee por rol y compone cada familia con su propia tipografía (*Inter for headings*, con *Starter for the rest* en la línea de abajo). Logos indica cuántos espacios están rellenos (o **Not set**), Tokens muestra el radio de las esquinas y Files dice **Nothing yet** mientras la biblioteca está vacía. Cada bloque abre su sala.

Un design system que vino con la aplicación y se puede editar, como Lolly Demo, tiene todo eso desde el principio: Board muestra sus colores, colourways, tipografías y marcas, con una etiqueta **Came with this app** junto al encabezado.

### Starter y Yours

**Starter** es la palabra para todo lo que vino con la aplicación en lugar de ser elegido. Una instalación nueva no trae ningún color, solo una rampa neutra de la tinta al papel, de modo que las superficies, el texto y las líneas finas puedan renderizarse antes de que nadie decida nada. La misma palabra marca el material heredado en cada sala.

::: cols
## Starter

- Vino con la aplicación: los neutros de tinta a papel, las tipografías de inicio, el radio de esquina predeterminado.
- Atenuado, con una etiqueta **Starter** y sin tinte.
- No cuenta como tus colores. Los neutros viven en **Tokens** como **Neutrals · starter · 9**, y **Open** los muestra en Colours como un grupo plegado (`#/start?area=color&group=neutral`).
- Un rol apoyado en un color de inicio dice *"Starter Paper stands in"*, con **Choose…** en su selector.

## Yours

- Elegido o instalado por ti.
- A plena intensidad, y una tarjeta teñida donde instalaste una tipografía.
- Cuenta en Board y en Tokens.
- Un rol que sigue a otro dice **↳ follows Primary** en lugar de repetir el nombre del primario.
:::

El material heredado nunca se dibuja con borde discontinuo, porque aquí un borde discontinuo significa una zona de soltar.

## Logotipos

Vacía tu carpeta de marcas en la zona de soltar de arriba: **"Drop marks here, or choose several at once"** acepta tantos archivos como tengas. Cada archivo se lee por su forma y su tinta, y luego espera bajo **Waiting for a slot** como un chip que dice cómo se ve, como *"Looks like the Horizontal primary"*, con la medición que usó y un botón **Place** (**Replace** donde el espacio ya está ocupado). Donde no está seguro, el chip lo dice y ofrece **Change slot**, que enumera los ocho. No se coloca nada hasta que pulsas algo.

Una marca con margen vacío sobrante recibe primero una oferta de recorte; respóndela o pulsa Escape y el original entra sin tocar. Donde una marca puede rellenar un espacio hermano vacío, la sala ofrece la versión derivada **mono** o **reverse** como un chip marcado *Generated*.

Cada marca acaba en una cuadrícula de ocho espacios opcionales, uno por **orientación** y **tratamiento**:

- **Orientaciones:** Horizontal (logotipo y símbolo en una fila) y Vertical (apilados, para espacios cuadrados y altos).
- **Tratamientos:** Primary, Primary reverse (para fondos oscuros), Mono (un color) y Mono reverse.

Un grupo sin marcas todavía se pliega en una línea; ábrelo para ver sus espacios. Haz clic en un espacio para añadir un PNG, SVG, JPEG o WebP, o haz clic en un espacio ocupado para sustituir la marca. Todo se queda en este dispositivo.

![Los espacios de logotipo con Horizontal y Vertical abiertos: cada tratamiento es un espacio propio, y cada espacio es opcional](/t/url-shot?url=%2F%23%2Fstart%3Ftab%3Dlogos&system=new-design-system&width=1440&height=1600&dpi=192&waitMs=1600&drive=click%3A.be-logo-identity%3Edetails.be-logo-group--fold%3Anot%28.be-logo-group--custom%29%3Esummary%3Bwait%3A600&cropSelector=.be-logo-grid&format=svg&walker=1&dark=1&filename=bs-logo-slots)

- Las **Custom marks** son marcas que tu marca llama por su propio nombre, como un icono, un escudo o un favicon.
- **Más identidades.** Una submarca, un producto o un evento puede tener su propio conjunto completo: **+ Add another logo** y da un nombre al conjunto. Tu conjunto principal es "Your logo". [Brand architectures](/info/brand-architectures.html) muestra cuándo una identidad de logotipo es el bloque adecuado.
- **Lolly lee los colores del logotipo.** Una tarjeta bajo la zona de soltar, y de nuevo arriba en Colours, enumera los colores del logotipo y pregunta **Which is the main colour?**, con el color más fuerte ya seleccionado (nunca el blanco sobre el que se exportó). **Use these colours** los añade a tu paleta, hace del color principal tu primario y, cuando el logotipo tiene un neutro oscuro que se lee sobre papel, lo convierte en el color de texto. **Not now** los deja en la Tray. En una instalación nueva se aplica de inmediato la respuesta más probable, y la tarjeta ofrece **Undo** u otro color principal. Un SVG da colores exactos; un PNG, JPEG o WebP da los colores que cubren una parte real de la marca.

## Colores

La sala crece con el design system: una primera visita es una sola decisión, y el resto llega conforme llega la paleta.

### El primer color

Un sistema sin colores propios muestra los neutros de inicio, abiertos en su propio grupo, y en la parte superior de la sala un campo de pegar y soltar con borde discontinuo: un chip grande y un campo. Suelta una imagen o una lista de colores en cualquier parte del campo y Lolly lee los colores de lo que soltaste.

- **El chip es el selector.** Pulsa **Pick a colour** y se abre la tarjeta OKLCH del estudio, con lo que contenga el campo: primero el nombre del color y su hex, con los espacios de color, la rueda, los cuatro diales y el alfa bajo **Fine-tune**, y **Cancel** y **Add colour** al pie. Nada llega al sistema hasta que pulsas **Add colour**.
- **El campo acepta cualquier notación**: `#e0452b`, `rgb(224 69 43)`, `oklch(58% .19 32)` o un nombre de color. Pega una lista y se convierte en una fila de chips para añadirlos uno a uno o con **Add all**.
- **Dos formas más de entrar.** **Pick a colour from the screen** usa el cuentagotas donde el navegador lo tiene, y **Take colours from an image** lee una captura o una foto de este dispositivo.
- **Add nunca está desactivado.** Con el campo vacío abre el selector; un texto que no puede leer recibe una línea bajo el campo que lo dice.

Tu primer color pasa a ser el **primary**, y un chip lo confirma, como *"Primary is now Vivid Violet"*, con **Fine-tune** para ajustar el color.


### A medida que la paleta crece

Tus colores se sitúan junto a una vista previa **In context** en una pantalla ancha, y encima en una más pequeña. La vista previa muestra un póster, un gráfico o una tarjeta de interfaz con tu paleta. Los colores de inicio permanecen en su propio grupo plegable, que se pliega cuando el sistema ya tiene colores propios, y el campo de pegar y soltar pasa a ser una sola fila compacta. Export está en el **Export** de la barra y en la sala Tokens, así que la cabecera de la sala no lleva ninguno.

![La sala Colours en Lolly Demo: la paleta en grupos plegables, cada color con su nombre y hex, y la descarga de la paleta en la cabecera](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor&width=1440&height=740&dpi=192&waitMs=1800&drive=click%3A%5Bdata-be-roles-fold%5D%3Esummary%3Bwait%3A500&format=svg&walker=1&localize=1&dark=1&filename=brand-colours)

![La sala Colours en Lolly Demo tras añadir un color: la tabla Colour roles, y luego el chip del nuevo color con Use as Lead? y Fine-tune, junto a una vista previa de composición en vivo](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dpick&width=1440&height=840&dpi=192&waitMs=1800&drive=click%3A%5Bdata-be-editor-add%5D%3Bwait%3A900&format=svg&walker=1&dark=1&filename=bs-colour-first)

### Roles de color: cómo se llaman los colores

El design system dice cómo se llaman sus colores y para qué sirve cada uno, y Lolly lo lee. **Colour roles** está al principio de la sala Colours. En una pantalla ancha **In context** comparte la vista, así que un cambio se ve en el póster, el gráfico y la tarjeta de interfaz a medida que lo haces.

![La tabla Colour roles en Wefthouse, una marca textil inventada, con sus propias palabras: los chips de colourway Indigo, Madder y Weld, y luego Main, Accent, Supporting y Tertiary, cada uno con su color claro y oscuro, leídos como el color principal, el color del socio y solo por nombre, y Background, Text, Quiet text y Hairlines listados bajo la tabla como las lecturas que ningún rol ocupa](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor&system=wefthouse&width=2720&height=2000&dpi=192&waitMs=1800&cropSelector=%5Bdata-be-roles-fold%5D&format=svg&walker=1&dark=1&filename=bs-colour-roles)

La tabla tiene cuatro columnas, y en un teléfono cada fila se convierte en una tarjeta que mantiene lado a lado el claro y el oscuro:

| Columna | Qué contiene |
|---|---|
| **Role** | La palabra propia del design system, que puedes editar en el sitio, y una línea que dice para qué sirve el color |
| **Light** y **Dark** | El color en ese aspecto para la colourway elegida, con su nombre o valor, y su contraste |
| **Lolly reads this as** | Lo que hace una herramienta con el rol, en las propias palabras de Lolly |

**Cómo lee Lolly un rol.** Cada lectura toma un solo rol, así que elegir una lectura que tiene otro rol la traslada aquí. Lolly nunca deduce el significado de una palabra.

| Lectura | Qué se deriva de ella |
|---|---|
| **Lead colour** | Formas grandes, botones, el color con el que arranca una herramienta |
| **Partner colour** | El segundo color al que recurre una herramienta |
| **Background** | Va detrás de todo lo demás |
| **Text** | Títulos y texto del cuerpo |
| **Quiet text** | Pies de foto y letra pequeña |
| **Hairlines** | Filetes, bordes y divisores |
| **By name only** | Ninguna herramienta elige el rol por sí sola. Se ofrece en cada campo de color y en Design, donde una elección sigue enlazada, así que sigue a la colourway |

Una lectura que ningún rol ocupa se queda como la define el design system, y la sala las lista bajo la tabla. Un rol que comparte el id de una lectura, como un rol llamado Primary, es esa lectura y no se puede trasladar.

**En un gráfico.** La paleta **Design system - colour roles first** de Lolly Chart da a las series los roles de color del design system en su propio orden, y después el resto de su paleta. Un rol que se lee como fondo, texto, texto discreto o filetes se deja fuera, porque el gráfico dibuja su fondo y sus palabras con esos colores. Nada cambia hasta que eliges esa paleta, y un design system sin roles de color dibuja la paleta como **Design system - ordered**.

**Valores.** Pulsa un valor para elegir un color para ese rol, en ese aspecto, en la colourway elegida. **Same as light** hace que el valor oscuro siga al claro hasta que elijas un color propio. El chip **Aa** muestra el texto que Lolly elige para ir sobre el color, y la línea bajo el valor dice cómo se lee ese texto, por aspecto: **Text reads well**, **Large text only** o **Hard to read as text**. Eso trata del texto sobre el color y no dice nada contra el color en sí, que aún puede servir para formas y áreas grandes. Un rol leído solo por nombre muestra las mismas palabras sin el color de aviso, porque ninguna herramienta pone texto sobre él por sí sola. Las cifras detrás de las palabras, primero APCA y después WCAG, están en la información emergente y en el selector. **Own text colour** marca un valor cuyo archivo indica el color del texto, que se mantiene. **Copied** marca un valor que vino de otra colourway o del color del socio y que nadie ha elegido aún; **Keep this colour** en el selector fija el valor.

**Puntos de partida.** Un design system sin roles propios muestra las palabras de hoy: Primary, Secondary, Surface y Text. No se escribe nada hasta que cambias uno. **+ Add a role** ofrece **Primary, Secondary** o **Main, Accent, Supporting, Tertiary** como sugerencias, o las palabras que escribas, con la lectura que recibiría cada una. Las dos primeras palabras pasan a ser el color principal y el color del socio. Las herramientas siguen dibujando los mismos colores, y en un sistema con un solo color principal la primera colourway lleva el nombre de ese color.

**Renombrar, reordenar, quitar.** Renombrar cambia solo la palabra, así que todo lo que usa el rol sigue funcionando. Arrastra un rol por su asa, o pulsa Espacio en el asa, usa las teclas de flecha y pulsa Espacio para soltar. **Remove** dice qué sigue usando el rol. Cuando lo leen herramientas, **Remove and keep those colours** deja cada lectura con el color que dibuja ahora. Una norma interna, un grupo de guías, un campo de herramienta u otro token que use el rol lo retiene hasta que ese uso cambie. Un documento de Lolly Design guardado también puede usar un rol por su nombre, y Lolly no puede verlo desde el archivo de tokens: un documento que lo hace informa del color como sin resolver.

**Un archivo escrito a mano.** Los colores que contiene un archivo de tokens y que ningún rol declara se listan bajo **In this file, with no role yet**, cada uno con un campo para una palabra y **Make a role**. Siguen funcionando por su nombre de todos modos. Un token con dígitos en su nombre no puede ser un rol, así que se queda en el archivo y sigue funcionando por su ruta. Un registro del archivo que no valida muestra la tabla sin controles y dice por qué.

**El resto de la sala habla con las mismas palabras.** Los chips, la fila **Use as** de la muestra y el grupo **Colour roles** de la paleta usan las palabras del design system, y el mosaico de un rol de color abre su valor. Los archivos exportados no registran nada nuevo sobre los roles: los colores de un renderizado cambian porque cambiaron los tokens.

**Adónde van las palabras.** Las palabras y las descripciones viajan con el design system. Los agentes las leen en el resumen de diseño, en `lolly://tokens` y en el `AGENTS.md` de una página de marca, el terminal las muestra en `lolly system status`, y una página de marca las lista en `brand.json` y mide un par de contraste para cada rol. Cada formato de exportación conserva lo que le cabe: los archivos DTCG y Tokens Studio conservan todo, `DESIGN.md` conserva las palabras y las lecturas, y un tema de PowerPoint conserva solo el orden de la marca. [Colour roles in other formats](/info/design-tokens.html#colour-roles-in-other-formats) tiene la lista completa. Las palabras siempre se citan como datos del design system, nunca se leen como instrucciones.

**Dónde se elige un color.** Cada campo de color de una herramienta y de Lolly Design empieza con los roles del design system, en su propio orden, con cada palabra y para qué sirve el color a la vista. **Aa** junto a un rol elige el color que va sobre ese rol. El resto sigue bajo **Other colours**, sin las copias propias de una colourway, los colores "sobre" y cualquier lectura que ya ocupa un rol. Una elección queda enlazada al rol y sigue a la colourway, el campo sigue mostrando la palabra sea cual sea la colourway elegida, y Settings y Tokens también usan la palabra. Un design system sin roles conserva la cuadrícula de muestras que siempre ha tenido.

### Cada color que lee una herramienta

Con **Colour roles** cerrado, las primeras decisiones encabezan la sala como chips, cada uno con el color que hace el papel y su nombre. En un sistema sin palabras propias son **Primary**, **Secondary**, **Surface** y **Text**. Pulsa un chip para elegir su color entre las muestras de la propia paleta. **Every colour a tool reads**, al pie de **Colour roles**, tiene la tira completa.

La tira muestra los siete colores que puede leer una herramienta: Primary, Secondary, Surface, Text, Muted, Edge y On primary, con las palabras propias del design system donde las tiene. Cada uno hace el mismo papel en cada herramienta y exportación. Ninguno tiene que estar definido (tres colores sueltos son un buen sistema), cualquier color puede ocupar uno y el indicador dice cómo se lee el texto, medido contra la superficie, primero con APCA. Cada fila muestra un color propio a plena intensidad, un color de inicio que ocupa su lugar, o **↳ follows Primary**.

On primary se deriva del primario, se lee **Derived** y no tiene selector. El interruptor **Light** y **Dark** junto a ella, y el que está junto a **In context**, eligen qué aspecto muestran la tira, la paleta y la vista previa.

El acento propio de la aplicación sigue por defecto al design system. Ese es el ajuste **Interface follows the design system** en **Settings → Appearance**; desactivarlo deja neutro el marco de la aplicación, mientras que las herramientas, los lienzos y las exportaciones siguen al design system en ambos casos.

**Colourways.** Un design system puede tener varios colores principales, elegidos para cada pieza. La fila **Colourways** al comienzo de **Colour roles** muestra un chip por colourway, con **Default** en la canónica. **+ Add** inicia una colourway nueva a partir de uno de los colores de la paleta. Elige un chip, y la tabla, la tira, la paleta y las vistas previas muestran esa colourway; la colourway elegida se puede renombrar, duplicar, convertir en la predeterminada o eliminar. En un sistema con colourways, cada colourway necesita su propio primario y secundario, y su propia superficie cuando las colourways tiñen el fondo, así que esos roles se mantienen en el editor de muestras. [Add colourways to a design system](/info/colourways.html#add-colourways-to-a-design-system) tiene los pasos y el formato de tokens, y [Lolly Demo in use](/info/lolly-demo-in-use.html#colourways-on-real-work) muestra colourways en trabajo real.

### Encuentra más colores

Tres herramientas se apoyan en tu primario. Las dos primeras solo sugieren, y la tercera sustituye la paleta tras revisar el cambio.

::: cols
## Explore shades & harmonies

Elige un **Starting colour**, un **Scheme** (Mono, Complement, Analogous o Triad) y cuántos **Shades** (de 3 a 20, 5 por defecto). **Fine-tune** define la intensidad de la interfaz, el contraste y el texto sobre la marca. Haz clic en un tono para añadirlo, o en **Add 5 shades** para un grupo. Tus colores y roles se mantienen.

## Find matching colours

Elige una **Harmony**: Complementary, Adjacent, Triad, Tetrad o Analogous (con **Accents** de 2 a 5 y un **Angle** de 10° a 45°). Cada candidato tiene un nombre generado y **+ Add**, una pulsación por color.

## Rebuild the whole palette

Sustituye la paleta a partir de un color inicial, tras revisar qué cambia y qué se mantiene. Antes se toma un punto de control, y después se ofrece **Undo**.
:::

Los tres usan las mismas matemáticas perceptuales de color (OKLCH) que el motor. En **Explore shades & harmonies**, las filas **Primary**, **Neutral** y **Secondary** muestran los tonos sugeridos, y **Theme preview** muestra ejemplos claros y oscuros con sus lecturas de contraste.

![Tres grupos de tonos sugeridos, con controles de añadir individuales y un Theme preview aparte](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dgenerate%26seed%3D%2523e0452b&width=1440&height=1400&dpi=192&waitMs=1800&css=.start-head%7Bdisplay%3Anone%7D&cropSelector=.be-preview&format=svg&walker=1&dark=1&filename=bs-colour-ramps)

![Acentos generados, cada uno con una muestra, un nombre generado automáticamente, su hex y un botón Añadir](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dgenerate%26seed%3D%2523e0452b&width=1440&height=900&dpi=192&waitMs=1800&css=.start-head%2C.be-colour%7Bdisplay%3Anone%7D&drive=click%3A.be-generate-detail%3Anot%28%5Bdata-be-rebuild%5D%29%20%3E%20summary%3Bwait%3A500&cropSelector=.be-candidates&walker=1&format=svg&dark=1&filename=bs-harmony-candidates)

### Confirmar una paleta generada

Abre **Rebuild the whole palette…** y pulsa **Preview full rebuild**. La revisión cuenta cuántos roles se mantienen como los asignaste, cuántos de tus colores se conservan y cuántas curvas de tonos, bloqueos de impresión, tonos ocultos y paradas de degradado se reanclan o se conservan. **Apply rebuilt palette** confirma; **Cancel** no cambia nada. Después la tarjeta ofrece **Undo** con el foco en él, y el punto de control tomado antes del cambio restaura todo el sistema.

Un sistema con colourways conserva todas las colourways en una reconstrucción. La colourway canónica sigue al nuevo color inicial, y cada una de las demás conserva sus propios colores, nombre, orden y ajustes. La revisión enumera cuál colourway sigue y cuáles conservan sus colores. Lolly no reconstruye un sistema que codifica sus colourways de una forma que no puede editar; la tarjeta dice por qué, y nada cambia.

### Las secciones para expertos

Cuatro secciones plegadas están bajo la vista previa y los roles. Cada una se abre directamente con `#/start?area=color&focus=<name>`:

- **Explore shades & harmonies** (`focus=generate`), descrita arriba.
- **Shade curves** (`focus=curves`) remodelan una rampa punto a punto, con curvas separadas de luminosidad, croma y matiz (L / C / H) y los tonos redibujándose mientras arrastras.
- **Contrast** (`focus=contrast`): **Contrast-lock** reajusta una rampa para alcanzar objetivos APCA frente a un fondo que eliges, y **Rotate hue** gira toda la rampa por la rueda.
- **Print** (`focus=print`) define en qué se convierte el primario en prensa: su valor automático, una composición CMYK fijada o una tinta plana con nombre.

### La paleta y cada muestra

La paleta lista tus colores en grupos plegables, cada uno con su propio **+ Add**. Crea y renombra grupos como quieras. Un rol nunca crea un segundo mosaico: un mosaico al que apunta un rol lleva el nombre del rol, como **Primary**. **Colour chart**, bajo los mosaicos, muestra los mismos colores en la **Wheel** OKLCH (arrastra un punto para recolorear, haz clic en el espacio vacío para añadir una muestra) y en el gráfico **Gamut**, que muestra dónde termina el rango representable. `#/start?area=color&focus=chart` abre el gráfico directamente.

![El panel de la paleta, cada grupo plegable, con la descarga de la paleta en su cabecera](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dgenerate%26seed%3D%2523e0452b&width=1440&height=1000&dpi=192&waitMs=1800&drive=click%3A%5Bdata-be-roles-fold%5D%3Esummary%3Bwait%3A500%3Bclick%3A%5Bdata-be-add-ramp%3D%22primary%22%5D%3Bwait%3A1200&cropSelector=.be-split-side&walker=1&format=svg&dark=1&filename=bs-palette-pane)

![La rueda OKLCH - el ángulo es el tono, la distancia hacia fuera es el croma y los grises recorren un carril de luminosidad en el lateral](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dgenerate%26seed%3D%2523e0452b&width=1440&height=900&dpi=192&waitMs=2400&css=.start-head%2C.be-pal%2C.be-gradients%7Bdisplay%3Anone%7D&drive=click%3A%5Bdata-be-add-ramp%3D%22primary%22%5D%3Bwait%3A1200%3Bclick%3A%5Bdata-be-chart%5D%20summary%3Bwait%3A900&cropSelector=.be-pal-wheel&walker=1&format=svg&dark=1&filename=bs-colour-wheel)

Haz clic en una muestra para abrir su editor:

- **Rename**: cambia el nombre de la muestra.
- **Set the colour**: con deslizadores OKLCH, o en **Hex**, **HSL**, **RGB** o **CMYK**. El campo de valor lee y escribe en el espacio activo. Aquí CMYK fija el color de pantalla por conversión; para fijar tintas exactas, usa **Print substitutes**.
- **Stored as** elige cómo se guarda la muestra: **LCH** (el predeterminado, perceptual y de gama amplia), Hex, RGB o HSL.
- **Use as** da a la muestra un rol directamente, con las palabras propias del design system donde las tiene. Pulsa de nuevo un rol resaltado para quitar el rol.
- **Print substitutes** (plegado): fija **CMYK** de **Auto** a valores de tinta exactos, o define un **Spot colour** con un **Name** (como `PANTONE 186 C`), un **Book** opcional y un **Finish** para estampado en caliente, relieve, bajorrelieve, barniz selectivo, tacto suave o un troquel, hendido o perforación. Una imprenta usa estos bloqueos cuando exportas un PDF o TIFF CMYK; consulta [Colour profiles](/info/exporting.html#colour-profiles).
- **In other spaces** (plegado): un valor por espacio de color, derivado o definido por ti, y uno definido por ti gana en la exportación.

**Eliminar una muestra** es seguro. Los tonos derivados y los roles de tema se ocultan, de modo que nada que los lea se rompe, mientras que los colores que añadiste se eliminan.

::: details Trabajar con muchas muestras
Cada muestra tiene un asa de arrastre. Arrastra para reordenar dentro de un grupo, o enfoca el asa, pulsa Espacio, usa las teclas de flecha y pulsa Espacio de nuevo para soltar; Escape cancela. En un teléfono la paleta muestra cuatro colores por fila y las asas aparecen en el modo Select, en lugar de una fila bajo cada color. Para mover colores entre grupos, usa el control **Group** del editor o selecciona varios y usa **Move to**.

La selección no necesita un interruptor aparte. La barra y las casillas aparecen con el primer mosaico seleccionado y se van con el último.

- **Arrastra por el espacio vacío** para dibujar un rectángulo; cada mosaico que toca se une a la selección, entre grupos. Una sección plegada no añade nada.
- **Clic con Shift** toma un rango en orden de lectura, **clic con Cmd/Ctrl** alterna un mosaico, y un clic simple abre el editor.
- Cada encabezado de grupo tiene **Select all**, y **Cmd-A** con un mosaico enfocado toma todos los colores que posees, nunca uno de inicio.
- La cuadrícula tiene una sola parada de tabulación: las flechas mueven, Shift y flechas amplían, Espacio alterna, Delete elimina y Escape borra. Para ajustar un canal, pulsa antes `l`, `c` o `h`.
- En una pantalla táctil, mantén pulsado un mosaico para iniciar una selección y luego toca para añadir.

La barra dice **{n} selected**, luego **Move to**, **Give a role** (cada color toma el siguiente rol por turnos), **Download** (la selección en cualquiera de los seis formatos de paleta), **Duplicate** (una copia de cada uno, colocada tras el original), **Copy values** y **Delete**. Una copia se abre directamente en el editor; varias siguen seleccionadas. Un Cmd/Ctrl-Z deshace toda una acción en bloque.
:::

### Degradados

El panel opcional **Gradients** crea tokens de mezcla a partir de la paleta. Cada degradado tiene una vista previa, de 2 a 8 paradas con nombre y un ángulo. Una parada apunta a una muestra, así que si recoloreas la muestra, el degradado la sigue. Las mezclas se calculan en OKLCH.

Las descargas de la paleta (design tokens, CSS, SCSS, GIMP y Adobe Swatch Exchange) están en la cabecera de la paleta, junto a su encabezado. [Take your palette and fonts anywhere](/info/using.html#take-your-palette-and-fonts-anywhere) describe cada formato.

## Tipografía

Sin una tipografía propia, la sala es una sola tarjeta: **Primary**, compuesta a tamaño de lectura con la tipografía que la sirve hoy, con una etiqueta **Starter**, un botón **Choose for Primary** y la línea *"Nothing installs until you choose one."* Headings, Code e Italic siguen al primario hasta que los eliges; **Choose them separately** muestra sus tarjetas.

![La sala Tipografía sin ninguna fuente elegida todavía - una tarjeta a tamaño de lectura, una etiqueta Inicial en ella, y un Choose for Primary relleno](/t/url-shot?url=%2F%23%2Fstart%3Ftab%3Dtype&system=new-design-system&width=1440&height=740&dpi=192&waitMs=1800&format=svg&walker=1&dark=1&filename=brand-type)

Elige una tipografía y la sala se abre en cuatro tarjetas de rol, la lista Fonts y una muestra en vivo:

- **Primary**: texto del cuerpo, botones y todas las herramientas.
- **Headings**: la tipografía de títulos para `h1` y `h2`.
- **Code**: una tipografía monoespaciada para código y datos.
- **Italic**: una cursiva verdadera para énfasis, citas y apartes.

Una tarjeta se tiñe solo donde instalaste esa tipografía, Su botón dice para qué rol es: **Change Headings** en una tipografía propia y **Choose for Headings** en todas las demás. La línea de muestra se ajusta en lugar de cortarse. Nada de una tarjeta confirma nada: el botón abre la fase de comparación para ese rol.

![Las cuatro tarjetas de rol reveladas - cada una tipografiada en la fuente que la sirve, con una etiqueta Inicial donde nadie eligió una y Cursiva siguiendo a la principal](/t/url-shot?url=%2F%23%2Fstart%3Ftab%3Dtype&system=new-design-system&width=1440&height=1000&dpi=192&waitMs=2600&drive=click%3A%5Bdata-be-typemore-toggle%5D%3Bwait%3A600&cropSelector=.be-typecard-grid&walker=1&format=svg&dark=1&filename=bs-type-specimen)

### El escenario de comparación

La fase se abre dentro de la sala, bajo la tarjeta que pulsaste, y las tarjetas se pliegan en una tira de una línea para que la fase se vea en la primera pantalla de un teléfono. Escape cancela y devuelve el foco a la tarjeta.

1. Pulsa **Choose for** y el rol en la tarjeta.
2. Escribe el nombre de una familia y pulsa **Preview**, o pulsa una de las seis familias **Pinned** bajo el campo.
3. Pulsa **Use this face**.

![El escenario de comparación abierto bajo su tarjeta, con la fila de búsqueda, las familias fijadas y las tarjetas plegadas a una tira de una línea](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dtype%26focus%3Dstage&width=1440&height=740&dpi=192&waitMs=1800&format=svg&walker=1&dark=1&filename=bs-type-stage)

**El consentimiento se pide una vez.** La primera vez que una vista previa llega a Google Fonts, un diálogo explica: *Google learns the family name and your IP address. The file is then kept on this device and used offline. This is the one step in the studio that reaches a third party.* **Fetch from Google** continúa y se recuerda. **Cancel** deja la tarjeta diciendo *"Not fetched. Nothing was sent to Google."*, con su propio **Fetch from Google**.

**Suelta un archivo de fuente en la fase** (TTF, OTF o WOFF) para previsualizar una tipografía con licencia que ya posees. En ambos casos la tipografía se queda en este dispositivo, se renderiza sin conexión en la aplicación, las herramientas y cada exportación, y viaja en el archivo del design system. Todo lo de Google Fonts se distribuye con una licencia abierta (OFL, Apache o UFL).

### Fuentes en este dispositivo

El panel **Fonts** enumera cada tipografía de este dispositivo y el rol al que sirve. Las tipografías que añadiste van primero en **In the design system**, cada una con sus roles y un botón de borrar. Las tipografías de inicio siguen en una fila atenuada y plegada. **Add a face** abre la fase de comparación para cualquier rol. El panel **Type roles** muestra una muestra en vivo de cada rol con su familia y estado, como *Inter* o *Inter · follows Primary*.

## Tokens

Los tokens son los valores con nombre detrás del design system: colores, tipografías, logotipos, esquinas y espaciado. Las herramientas los leen por nombre, así que un cambio aquí llega a todas las herramientas a la vez.

![La sala Tokens: la cabecera con un ejemplo del sistema y las acciones de archivo, mosaicos que cuentan cada tipo de token, y luego los pares de colores con sus lecturas de contraste](/t/url-shot?url=%2F%23%2Fstart%3Ftab%3Dtokens&width=1440&height=740&dpi=192&waitMs=1600&format=svg&walker=1&dark=1&filename=brand-tokens)

- **La cabecera** da un ejemplo de tu propio sistema (*Primary is Spearmint, #033633*) y las acciones de archivo: **Download** (todo el sistema como design tokens, o la paleta en otros cinco formatos), **Copy CSS** y **Add from…** para volver a leer un archivo JSON.
- **Los mosaicos** cuentan cada tipo de token y saltan a su sección: Colours, Type, Logos, Shape and spacing, More y All tokens. Cuentan lo que contiene cada sección; una sección que solo contiene lo que vino con el inicio en blanco lleva una etiqueta **Starter**, y un sistema que vino con la aplicación cuenta su propio material sin ella. En un teléfono los mosaicos se reparten en dos filas de tres.
- **Colours** empieza con los pares que las herramientas combinan (texto sobre superficie, sobre primario, atenuado sobre superficie) con una lectura APCA en claro y oscuro, y marca **Weak contrast** donde un par se queda corto. Luego cada grupo de colores: una rampa como una fila de chips, otros colores con su valor y la referencia que usan las herramientas, como `{color.brand.spearmint}`. Pulsa una referencia para copiarla. **Edit in Colours** abre un grupo en la sala Colours. En un sistema de diseño con [roles de color](#colour-roles-what-the-colours-are-called), **Colour roles** va primero, con cada rol una sola vez en las palabras y el orden del propio sistema. Un rol guarda un color para cada combinación de color y aspecto, y esos colores se quedan con el rol en lugar de aparecer como colores propios: cámbialos en la tabla Colour roles.
- **Type** y **Logos** enumeran la tipografía de cada rol y cada espacio de logotipo, con **Edit in Type** y **Edit in Logos** cuando tienes los tuyos.
- **Shape and spacing** contiene **Rounded corners** (`shape.radius`) y **Spacing rhythm** (`space.base`). Cada uno dice *Lolly default* hasta que mueves el deslizador y *Yours* después, se guarda al instante y se puede deshacer.
- **More tokens** añade espaciado, tamaños, grosor de trazo, opacidad, rotación, números simples y sombras, guardados como [design tokens](/info/design-tokens.html) estándar.
- **App appearance (advanced)** enumera los colores, tamaños y sombras que usan las pantallas propias de Lolly, e **Inspect every token (advanced)** busca y edita cualquier valor guardado, mostrando antes cada cambio para revisarlo. Ahí los valores de un rol en cada combinación de color se enumeran con el rol: elige el token del rol para ver una fila por combinación de color, claro y oscuro lado a lado, y la línea de recuento dice cuántos valores guardan los roles. Un sistema de diseño de solo lectura muestra la misma lista.

Una sección sin nada ofrece la forma de llenar el hueco: **Pick a colour**, **Choose a face** o **Add a logo**.

## Archivos

Suelta los archivos que guarda tu marca, aparte de los logotipos: archivos **vector**, **image**, **audio** y **motion** (vídeo, Lottie y animaciones). Aparecen en [Assets](/info/using.html#assets-your-library), ordenados en secciones y listos en el selector de recursos de cada herramienta, y se quedan en este dispositivo.

## Rules

**Rules** pone a trabajar las decisiones de tu marca: qué pueden cambiar las personas, qué queda fijo y qué puede comprobar Lolly.

![Rules en Lolly Demo: cuatro normas internas, cada una marcada Checked in Lolly Design y Required o Advisory, y luego Try your design system in use con sus ejemplos listos para renderizar](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dusage&width=1440&height=1200&dpi=192&waitMs=2400&cropSelector=%23start-panel-usage&format=svg&walker=1&dark=1&filename=bs-usage-rules)

**Brand rules** enumera tus reglas. **Add rule** (o **Add your first rule**) abre un formulario breve:

- un **Rule name** con tus propias palabras, como *Beacon accents*;
- la **Check**: **Colour choices**, **Font choices**, **Fixed artwork** o **Text length**, con el rol de marca que usa, bajo tu propio nombre para el rol;
- el **Example** al que se aplica (Poster, Title slide, Content slide o Lolly Chart), el **Mode** y si es **Required** o **Advisory**;
- **Reviewed by**, y luego **Save draft** o **Approve & save**.

La aprobación registra tu propia decisión en este dispositivo. Las reglas obligatorias aprobadas limitan el póster reutilizable, y las comprobaciones cubren solo los PNG de ejemplo; no cambian ninguna otra herramienta.

Las normas que un design system trae en su archivo de tokens, como emparejamientos de colores aprobados, peso y alineación del texto o un logotipo por superficie, se listan aquí como **Checked in Lolly Design**. Lolly Design las comprueba capa por capa en la tarjeta **Before you export** del panel de exportación, y `lolly check` hace lo mismo con un documento de Lolly Design guardado ([Before you export](/info/design.html#before-you-export)). Una norma para la que esta compilación no tiene comprobador se conserva tal como se suministró y se marca como **Unchecked**.

Lolly Demo trae cuatro normas internas aprobadas. Los titulares nunca se componen en mayúsculas: esa norma es obligatoria, así que `lolly check` informa de un titular en mayúsculas como un error. Las otras tres son orientativas. El texto del cuerpo se alinea a la izquierda. Las marcas primarias van sobre superficies claras y las marcas invertidas sobre las oscuras. Las líneas discontinuas significan suelta aquí.

**Try your design system in use** renderiza cuatro ejemplos de la revisión actual con **Render & check examples**. Elige un **Mode** y **Try your own text** para el título, el texto de apoyo y el texto de las diapositivas. Cada ejemplo informa de lo que se midió, con **See checks & sources** y **Download check report**, y **Make reusable poster** descarga un `.lolly` cuyo diseño fijo y opciones de entrada aprobadas viajan con el archivo. Los ejemplos son locales: ejecutar una comprobación no publica ni aprueba nada.

Una compilación que incluye una marca fija muestra las mismas reglas y ejemplos en solo lectura, bajo *This brand is set*.

## Skills

**Skills** enumera las [brand skills](/info/brand-skills.html) del design system activo: los estándares escritos de la marca, uno por disciplina, para personas y agentes de IA. Cada fila indica la disciplina, el estado propio de la marca (**Draft** o **Approved**), si la skill es pública o interna y su revisión. Elige una fila para leer la skill junto a su cobertura, que contrasta las líneas de la skill con tus tokens: lo que Lolly comprueba, lo que entra en conflicto, lo que coincide y lo que es solo orientación.

**Download skill (.zip)** escribe la skill como una carpeta de Agent Skills para una herramienta de agente, con enlaces de catálogo que apuntan a este Lolly, y **Copy as one file** pone el mismo texto en el portapapeles para una ventana de chat. Un design system sin skills propias enumera una base que Lolly escribe a partir de sus tokens y reglas de la casa cada vez que se lee. La sala lee las skills y nunca las edita.

## Traer una marca

**Add from…** en la barra abre un selector que pregunta qué tienes, no en qué formato está:

- **Design tokens or a design file**: JSON DTCG o Tokens Studio, un proyecto de Penpot, un zip de conjuntos de tokens, un paquete de design system de Lolly, un SVG, un `DESIGN.md` o una carpeta de página de marca.
- **PDF**: una presentación o un archivo de directrices, leído en este dispositivo para sacar sus colores, marcas y tipografías incrustadas.
- **Logo or screenshot**: una imagen se convierte en una paleta sugerida, leída en este dispositivo. Lee colores, no la tipografía ni la maquetación.
- **Saved web page**: un archivo HTML y sus archivos CSS, o HTML o CSS pegado, hasta 20 archivos y 2 MB. Solo se lee el texto que aportas: los recursos enlazados no se descargan y los scripts no se ejecutan.
- **Font file**: TTF, OTF o WOFF. Abre la sala Type, donde se instala la tipografía.
- **Website**: una página, leída para sus colores y su tipografía. Este mosaico aparece solo en un dispositivo que puede leer una página, e indica qué lector usa: la app de este dispositivo, o la extensión del navegador en una pestaña en segundo plano, con tu sesión iniciada. Indicar una URL solo rellena el campo; pulsar obtener es el consentimiento.

Elige el origen de archivo de diseño y la siguiente tarjeta enumera los formatos aceptados como mosaicos con icono, con toda la tarjeta como destino de soltar. También puedes soltar un archivo directamente sobre el estudio.

![La tarjeta de importación - los formatos aceptados encabezan como fichas con icono, y toda la tarjeta es un único destino de arrastre](/t/url-shot?url=%2F%23%2Fstart%3Fsource%3Dfile&width=1440&height=900&dpi=192&waitMs=1600&css=.start-import-modal%20.modal-msg%2C.start-import-modal%20.modal-title%7Bdisplay%3Anone%7D&cropSelector=.start-import-drop&walker=1&format=svg&dark=1&filename=bs-brand-import-formats)

- Un **paquete de design system de Lolly** (`.lolly`, o un `.zip` heredado) se instala en un solo paso.
- Una exportación de **Penpot** (`.penpot`) trae sus tokens de diseño.
- Un archivo **Design Tokens** (W3C DTCG) o **Tokens Studio** (`.json`) trae sus tokens. Una descripción que pide a un lector ignorar instrucciones, afirma permisos o pide ejecutar código se deja fuera, y la importación dice dónde estaba. Es una comprobación línea a línea y no detecta otras formulaciones, así que lee un archivo de alguien que no conoces antes de aplicar los tokens.
- Un **SVG simple** se analiza en busca de colores entre los que eliges, y el primero pasa a ser tu primario.
- Un **`DESIGN.md`** (`.md`) va a **Try these colours** con sus tokens tal como están escritos. Su prosa se puede conservar como borrador de skill de marca, y la tarjeta señala las líneas que piden a un lector ignorar instrucciones, afirmar permisos o ejecutar código. Los agentes y las páginas de marca no ven un borrador hasta que pulsas **Keep this skill** en la sala Skills, y un skill conservado sigue siendo interno.
- Una **carpeta de página de marca**, elegida como carpeta, soltada o comprimida en zip, va a la misma revisión. Cada archivo se comprueba contra el `brand.json` de la carpeta, y uno que no coincide rechaza toda la carpeta. Añade los tokens. Los logotipos y las fuentes se quedan en la carpeta.

Lolly lee una página de marca a partir de los archivos que aportas. No descarga la dirección de otro sitio.

### Un archivo con sus propias palabras para los colores

Un archivo de tokens o un `DESIGN.md` puede usar sus propias palabras para sus colores, como main, accent, supporting y tertiary. Cuando Lolly encuentra esas palabras, la revisión lista cada una antes de que se aplique nada: la palabra, su color en cada aspecto, el token de donde vino y como qué la leería Lolly. Lolly sugiere esas lecturas solo a partir de las palabras, contra una lista corta, y no usa ningún modelo. Una palabra fuera de la lista llega como propia de la marca, **By name only**. Renombra cualquier palabra, indica para qué sirve, léela como otra cosa o desmárcala para dejarla como color con nombre.

**Install with these roles** los escribe, e **Install without roles** instala el archivo exactamente como llegó. Un archivo sin esas palabras no muestra ningún paso nuevo. Un archivo que declara sus propios roles, como uno que escribió Lolly, los muestra tal como están escritos y los instala sin cambios, y puedes editarlos después en la sala Colours. El terminal no tiene revisión, así que `lolly system import` conserva un registro declarado y deja las palabras de otros archivos como colores con nombre.

### Revisar una referencia

Un logotipo, una captura, un sitio web o una página guardada abre **Try these colours**: un ejemplo con los colores propuestos, un **Main colour** que puedes cambiar y un nombre para un sistema nuevo. Un recuadro detalla lo que hace aplicar: **reemplaza** los ajustes de tokens activos por la paleta generada y los estilos predeterminados, **conserva** tus fuentes y los archivos de tu biblioteca y el sistema anterior se puede **recuperar**. **Apply suggested settings** aplica las paletas clara y oscura, tras un punto de control, y **Restore brand settings** puede devolver los ajustes antiguos. **Change reference** elige otro origen.

**Palette, source details and individual choices** muestra lo que se leyó, los nombres de fuente encontrados y el contraste de la vista previa. Los nombres de fuente son solo sugerencias; Type sigue siendo donde instalas una tipografía. Los detalles del origen pueden incluir tipografía, huecos, relleno y valores de esquina cuando se observaron, etiquetados **Not observed** en caso contrario. Una página guardada o una lectura nativa de un sitio web informa de estilos declarados, que la página puede no usar, y la extensión de navegador puede informar de estilos medidos a partir de una muestra de elementos visibles. Son observaciones: no se instala nada, y el espaciado del origen nunca sustituye al tuyo. **Choose individual items in the tray** conserva elementos sueltos, y **Download design context** guarda un informe JSON de observaciones, tokens propuestos e información del origen (con un SHA-256 de cualquier HTML o CSS aportado). El informe no contiene texto sin procesar de la página y no es una Content Credential firmada.

Las importaciones de PDF y de archivos de diseño conservan sus propios controles de revisión. Los elementos de la **Tray** no cambian nada hasta que los añades en la sala que posee ese tipo de material. `#/start?source=<kind>` abre el selector en un origen (`file`, `pdf`, `image`, `font`, `url`, `page`), y `?import` abre la lista simple.

### Encontrar y comparar un aspecto

Abre **Find a look** desde Board o desde la lista de design systems en Settings. Explora los sistemas guardados en este dispositivo y unos pocos ejemplos reutilizables de Lolly, y busca por nombre, etiqueta de color o fuente declarada. **Closest to my current palette** ordena por similitud de color medida, desempatando con las fuentes coincidentes; no es una puntuación de calidad.

Haz clic en un aspecto para verlo en contexto. Previsualizar no cambia nada. El **Use this look** de cada tarjeta usa ese aspecto. Un sistema guardado pasa a ser el activo, lo que no edita nada. Los colores de un ejemplo pasan por el punto de control habitual hacia el design system abierto, cuyos logotipos, fuentes y todo lo demás que el ejemplo no define se quedan como están. **Compare looks** añade una casilla a cada tarjeta, para que puedas elegir dos y compararlas lado a lado. **Restore brand settings** recupera el aspecto anterior. Los sistemas guardados tienen **Search tags** editables bajo **Details and design context**. Los ejemplos son recetas de color originales de Lolly, sin colección extraída de la web y sin cuenta.

![Compara Sunroom y Orchard uno junto al otro antes de aplicar cualquiera de los dos sistemas de color.](/t/url-shot?url=%2F%23%2Fstart&width=1280&height=900&dpi=96&waitMs=3000&format=svg&filename=brand-compare-looks&try=1&drive=click%3A%5Bdata-ds-door%3D%22looks%22%5D%3Bwait%3A500%3Bclick%3A%5Bdata-looks-compare-toggle%5D%3Bclick%3A%5Bdata-look-select%3D%22example%3Asunroom%22%5D%3Bclick%3A%5Bdata-look-select%3D%22example%3Aorchard%22%5D%3Bclick%3A%5Bdata-looks-review%5D%3Bwait%3A500&cropSelector=.ds-looks-comparison&waitSelector=%5Bdata-ds-door%3D%22looks%22%5D&walker=1&rasterDpi=96)

## Conserva y traslada tu design system

### Trasladar una marca entre dispositivos

**Export** escribe un archivo **`LollyBrand-….lolly`**: tus tokens, fuentes, logotipos y preferencia de tema, con un manifiesto de integridad que se comprueba al volver a entrar. Las versiones web anteriores a la 1.0.7 llamaban `.zip` al mismo archivo, y esa grafía todavía se acepta. **Tokens (.json)** escribe por separado el documento simple de design tokens, sin fuentes ni logotipos, para un repositorio, un paso de compilación u otra herramienta de tokens.

Para traer uno de vuelta, usa **Add from… → Design tokens or a design file**, o suelta el archivo sobre el estudio. Así te entrega una marca un colega, o así llevas una a una segunda instalación, sin cuenta y sin nube. [Working with partners](/info/partners.html) explica qué más enviar cuando la persona que recibe tu marca trabaja para otra organización. Para traer una marca desde la línea de comandos, consulta [`ingest:brand`](/info/configuration.html#brand-packs).

**Fonts for Linux (.rpm)** empaqueta las fuentes que añadiste en un RPM instalable. Si subiste alguna tú mismo, Lolly te pide antes que confirmes que puedes redistribuirla.

### Restaurar ajustes anteriores

Abre **More** en la barra, elige **Restore brand settings**, selecciona un punto de control con fecha y pulsa **Restore**. Restaura colores, ajustes de tipografía y otros tokens de la marca activa; los archivos de fuente e imagen se quedan como están. Lolly guarda antes tus ajustes actuales como **Before restore**, para que puedas revertir una restauración incluso después de cerrar el navegador. Se conservan los últimos 20 puntos de control en este dispositivo.

### Versions

Una versión publicada es una **copia permanente con nombre** guardada en este dispositivo. Nunca cambia, así que una herramienta o un enlace que la fija (con `designv`) sigue dibujando lo mismo. Un sistema con algo propio muestra **Versions & publishing** en el menú **More** de la barra; tras tu primera publicación **Versions** se une a las salas. `#/start?area=versions` la abre directamente.

- **Una versión es permanente.** Todavía no hay eliminación, y el panel lo dice.
- **Las eliminaciones encabezan la tarjeta de compatibilidad**, porque un token eliminado es lo que rompe una herramienta.
- **Publicar no se puede deshacer; restaurar sí.** *Restore latest from this version* es una edición normal, con **Undo** ofrecido de inmediato.

**Publish only** conserva una versión sin cambiar lo que siguen las herramientas; **Publish and make active** hace que las herramientas y la aplicación sigan esa versión. **Follow the latest again** pone en vivo cada edición en el momento en que la haces.

### Publicar una página de marca

Una [página de marca](/info/brand-page.html) es una sola dirección para personas y para agentes: una página que muestra los logotipos, los colores, la tipografía y los ejemplos, con los mismos datos en archivos junto a la página. **Publish a brand page**, bajo Versions & publishing, muestra la página en vivo y, junto a ella:

- **Goes public**: cada archivo, agrupado, con su tamaño.
- **Held back**: lo que se quedó fuera, y por qué. Un logotipo sin licencia registrada se queda fuera hasta que marcas el nombre del logotipo. Un archivo de fuente necesita una licencia registrada que permita transmitirlo, y la página muestra una muestra con contornos cuando el archivo se queda fuera. Los skills de marca internos nunca aparecen.
- **What was checked**: pares de colores por colourway y modo, y las normas internas. Son mediciones, no un veredicto.
- **In your words**: una declaración de uso y un contacto. La página imprime lo que escribes y Lolly no añade ninguna licencia ni afirmación legal. Un interruptor desactiva la línea "Made with Lolly" del pie.
- **On exports**: un interruptor que [registra la dirección de la página en las exportaciones de este design system](/info/brand-page.html#lead-back-from-your-files). Está desactivado hasta que lo activas, necesita una dirección `https` y no viaja con un paquete ni con una copia. Un design system bloqueado no muestra el interruptor, porque lo decide quien lo gestiona.

**Download folder** guarda la carpeta como un ZIP para que la alojes donde quieras, y nada se hace público hasta que lo hagas. En un terminal, `lolly system publish --out=<dir>` escribe la misma carpeta. Una instancia que sirve páginas de marca también ofrece **Publish to** su dirección, que es una pulsación explícita y pasa por su cadena de aprobación cuando la tiene. Un design system gestionado se publica solo cuando quien lo gestiona lo permite.

### Conectar un agente

**Connect an agent**, en el mismo lugar, te da texto para pegar e indica qué puede hacer cada opción:

- **`AGENTS.md`** en un proyecto: los agentes leen los nombres y las normas del sistema. No dibuja nada y no necesita servidor.
- **El servidor público de Lolly**: dibuja con Lolly Demo, sea cual sea el sistema que tengas abierto aquí. No necesita clave.
- **Tu instancia**: dibuja con los sistemas que contiene la instancia, y lee un token de servicio de una variable de entorno. La hoja da el nombre de la variable y nunca muestra un token.

Cuando ningún servidor alojado dibuja con tu sistema, la hoja lo dice.

## Gestiona tus design systems

Abre **Settings → Preferences → Design systems** para cambiar, añadir o eliminar sistemas. **Open** selecciona un sistema y lo abre aquí; **Make a new one** crea un sistema local y lo abre con su campo de nombre listo. Un sistema está activo a la vez, para todo el dispositivo. [Brand architectures](/info/brand-architectures.html) ayuda a decidir cuándo una marca necesita un design system propio.

**De dónde viene un sistema.** El sistema que aporta el catálogo de un despliegue dice **Came with this app**, o **From this instance** en una aplicación conectada a una. Despliega **Catalogue source** para ver quién lo aporta, su recurso de tokens y espacio de nombres y su versión o suma de verificación conocidas; si falla una actualización, el material en caché se etiqueta.

**Los sistemas gestionados son de solo lectura.** Un sistema muestra **Managed by this instance** (o **Managed by this app** en la app de escritorio sin instancia) cuando su catálogo lo bloquea. Puedes usarlo y descargarlo, y al abrirlo aquí aparece una nota de solo lectura con **Make an editable copy** y **Switch**, y luego sus roles de color y tokens sin controles de edición. Tus propios sistemas locales siguen siendo editables, aunque el gestionado llegara primero. Una compilación con una marca fija abre Lolly Design System Setup en *This brand is set*, con los tokens y las normas de uso de la marca para leer.

**Cualquier otro sistema aportado es tuyo** para ocultarlo, editarlo y restablecerlo, incluidos Lolly Demo y Lolly Starter en lolly.tools. Editar uno conserva su nombre y marca la fila como **Edited here**, y **Reset to original** en su menú descarta los cambios hechos en este dispositivo. El inicial en blanco es la excepción: un primer cambio allí inicia un design system propio, así que Lolly pregunta una vez cómo llamar al sistema nuevo. [Lolly Demo in use](/info/lolly-demo-in-use.html#switch-to-your-own) muestra lo que sustituye tu propio sistema.

### Eliminar un design system

Elige **Remove** en el menú de un sistema; la confirmación indica qué sistema estará activo después. Las sesiones guardadas, las subidas y el material compartido con otro sistema permanecen.

Eliminar un sistema aportado solo lo oculta: sus recursos de catálogo se quedan, **Bring back** lo muestra de nuevo y vuelve solo si eliminas todo lo demás. Eliminar una copia importada o editada no elimina el sistema aportado, sus logotipos ni sus fuentes, y si la copia estaba activa, el sistema aportado vuelve a estar activo. Eliminar una copia alojada activa borra solo la conexión de esa copia; una instancia elegida por separado sigue seleccionada.

Cambiar lo que suministra un servidor es una tarea de administrador: su operador cambia el catálogo de origen y vuelve a desplegar, o un administrador de Lolly Work revisa y aplica un cambio del servidor. Las ediciones aquí se quedan en local, con una excepción: en una instancia de Lolly Work que te concede `brand.edit`, un sistema gestionado también ofrece **Edit for** esa instancia, que abre una copia de edición, y **Send to** esa instancia en **Versions** le devuelve sus colores, colourways, roles de color y la dirección de la página de marca. [Edit this instance from the studio](/info/work-design-system-administration.html#edit-this-instance-from-the-studio) cubre qué puede cambiar una edición y cómo sirve la instancia el cambio. Consulta [Removing a catalogue design system](/info/configuration.html#removing-a-catalogue-design-system) y [Configuration](/info/configuration.html#supplied-and-local-design-systems).

## Usa el contexto de diseño fuera de la aplicación

**Download design context** guarda el documento de tokens, los colores resueltos, las familias de fuentes declaradas, los ids de recursos, la evidencia de origen donde está registrada, la cobertura y las normas explícitas, sin archivos de fuente y sin prueba de propiedad. La línea de comandos lee el archivo sin servidor: `lolly system import` lo convierte en el design system del terminal y `lolly system check` comprueba las entradas de Lolly Design contra el contexto guardado. [Bring your design system](/info/cli.html#bring-your-design-system) cubre la importación y [Which design system a command uses](/info/cli-decks.html#which-design-system-a-command-uses) cubre la comprobación, y un cliente MCP lee el mismo resumen en `lolly://design-context` ([MCP Server](/info/mcp.html)).

## A dónde ir ahora

- **[Using Lolly](/info/using.html)**: las herramientas, el guardado, el uso compartido y Assets.
- **[Brand architectures](/info/brand-architectures.html)**: cómo se corresponden divisiones, productos, marcas avaladas, clientes y temporadas con design systems, colourways e identidades de logotipo.
- **[Working with partners](/info/partners.html)**: compartir tu marca con un socio y trabajar en una marca que te dieron.
- **[Brand pages](/info/brand-page.html)**: publica tu design system en una sola dirección, como kit de prensa y kit para agentes.
- **[Design Tokens](/info/design-tokens.html)**: el modelo de tokens en que está escrita tu marca.
- **[Export a file](/info/exporting.html)**: unidades de impresión, CMYK y los formatos en que se renderiza tu marca.
