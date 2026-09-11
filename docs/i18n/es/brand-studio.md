# El Estudio de Marca

El **Estudio de Marca** en `#/start` es el único lugar donde das forma a tu marca - sus logotipos, colores, tipografía, el resto de tus tokens y los archivos que guarda. Configúralo aquí una vez y cada herramienta, página y exportación lo sigue *por construcción*, no por revisión.

Los cambios se previsualizan **en vivo en toda la app** a medida que los haces, así puedes ver cómo un color o una fuente aterrizan en todas partes antes de confirmarlos. Todo ocurre en el dispositivo: tus archivos de marca y tokens nunca salen de tu máquina (elegir una fuente de Google descarga esa única familia desde Google, una vez, tras un diálogo de consentimiento), y la marca viaja en un único archivo de [paquete de marca](#move-a-brand-between-devices).

> **Este es el editor. El panel es el espejo.** La pestaña **Sistema de diseño** del Panel (`#/d`) *muestra* tu marca en modo solo lectura; la *editas* aquí en `#/start`. Si quieres cambiar un color más adelante, vuelve al Estudio de Marca.

## Las salas

El estudio es un conjunto de **salas** listadas en un riel lateral - no pasos. Nada está numerado, nada depende de nada más, y llegar a cualquiera de ellas es legítimo:

- **Resumen** - el centro. Lo que existe ahora mismo, de un vistazo, con una puerta hacia cada sala.
- **Colores** - añade colores de uno en uno, asigna roles o genera una paleta entera a partir de uno.
- **Tipografía** - los cuatro tipos que leen la app, tus herramientas y cada exportación.
- **Logotipos** - tus marcas, en cada orientación y tratamiento.
- **Tokens** - radio de esquina, espaciado, sombras y el resto del sistema.
- **Archivos** - los archivos de imagen, audio y movimiento que guarda tu marca.

En un móvil la misma lista se convierte en una tira horizontal de chips fijada bajo la cabecera. Cambiar de sala nunca recarga nada - el editor mantiene todos sus paneles montados y simplemente muestra el que pediste.

**Enlaza directamente a una sala** con `#/start?area=<key>`. Las claves son `overview`, `color` *(fíjate en la ortografía estadounidense en la URL)*, `type`, `logos`, `tokens`, `catalogue` (la sala Archivos - la clave del panel es un contrato permanente, así que la URL conserva el nombre antiguo) y `versions`. `?tab=` es el alias de siempre para lo mismo y sigue resolviendo, así que los enlaces y marcadores antiguos siguen funcionando; cualquier valor no reconocido abre Overview en lugar de dar un callejón sin salida.

Fijadas al **pie del riel** están las acciones que pertenecen a todo el sistema de diseño y no a una sala concreta:

- **Añadir desde…** - el selector de origen, para traer una marca desde un archivo, un PDF, una imagen, una fuente o un sitio web. Consulta [Traer una marca](#bring-a-brand-in) más abajo.
- **Bandeja** - los candidatos que un escaneo encontró pero aún no se han confirmado. Permanece oculta hasta que un escaneo realmente conserva algo, y muestra un número cuando lo hace; nada de lo que hay dentro cambia tu marca hasta que pulsas Añadir en esa fila.
- **Exportar** - escribe toda la marca como un único `LollyBrand-…zip`.
- **Tokens (.json)** - el documento de tokens de diseño plano por sí solo, para un repositorio, un paso de compilación u otra herramienta de tokens.
- **Versiones** - publica, activa y restaura copias con nombre del sistema de diseño. Oculto hasta que haya algo propio que publicar (o hasta que un enlace `?area=versions` lo pida por su nombre).

![El riel de salas del estudio - Overview, Colours, Type, Logos, Tokens y Files](/t/url-shot?url=%2F%23%2Fstart&width=1440&height=900&dpi=192&waitMs=1600&cropSelector=.ds-rail&format=svg&walker=1&localize=1&dark=1&filename=brand-studio&try=1)

## Overview

Overview es la sala en la que aterrizas, y tiene dos caras.

Con **nada configurado todavía** ofrece dos puertas - **Empezar desde un archivo** (tokens de diseño, un proyecto de Penpot, un paquete de sistema de diseño o un SVG) y **Empezar de cero** (añade un color, y sigue cuando quieras) - y una discreta salida **Explorar las herramientas** debajo de ellas, porque marcharse también es una respuesta legítima.

Una vez que existe un sistema de diseño, la misma sala muestra **lo que tienes**: la paleta y su número de colores, las familias tipográficas en vigor, cuántas ranuras de logotipo están rellenas, cuántos tokens hay y la sala Archivos. Cada bloque es una puerta a su sala. Aquí hay recuentos, nunca una barra de progreso ni una tarjeta de finalización - nada en este estudio se debe.

## Logotipos

Empieza vaciando tu carpeta de marcas en la zona de arrastre de arriba: **"Suelta marcas aquí, o elige varias a la vez"** admite tantos archivos como tengas de una sola vez. Cada archivo se analiza por su forma y su tinta, y luego se pone en cola bajo **Esperando una ranura** como una etiqueta que dice lo que cree - *"Parece el Horizontal primario"*, con la medida en la que se basó, y un botón **Colocar** (**Reemplazar**, donde esa ranura ya está ocupada). Cuando no está segura, la etiqueta lo dice claramente y ofrece **Cambiar ranura** en su lugar, que lista las ocho. Nada se coloca hasta que pulsas algo.

En torno a esa cola ocurren dos cosas. Una marca con margen vacío de sobra recibe primero una **oferta de recorte** - respóndela o pulsa Escape y el archivo original se coloca sin tocar. Y donde una marca puede cubrir una ranura hermana vacía, la sala ofrece la versión derivada **mono** o **invertida** como su propia etiqueta, marcada *Generada*, que desaparece de nuevo si rellenas esa ranura de otra manera.

Debajo de eso está la cuadrícula en la que acaba cada marca - ranuras **orientación × tratamiento**:

- **Orientaciones:** Horizontal (logotipo textual + símbolo en fila) y Vertical (apilado, para espacios cuadrados y altos).
- **Tratamientos:** Primario, Primario invertido (para fondos oscuros), Mono (un color) y Mono invertido.

Eso son ocho ranuras opcionales. Haz clic en una ranura para añadir un PNG, SVG, JPEG o WebP; haz clic en una ranura ocupada para reemplazarla. Todas las ranuras son opcionales y todo permanece en este dispositivo.

![La matriz de logotipos - cada orientación en la parte superior, cada tratamiento como su propia ranura discontinua, todas opcionales](/t/url-shot?url=%2F%23%2Fstart%3Ftab%3Dlogos&width=1440&height=1600&dpi=192&waitMs=1600&cropSelector=.be-logo-grid&format=svg&walker=1&dark=1&filename=bs-logo-slots)

- **Marcas personalizadas** - añade marcas que tu marca nombra a su manera (un icono, un escudo, un favicon) bajo **Marcas personalizadas**; nómbrala y elige un archivo.
- **Más identidades** - una submarca, un producto o un evento puede tener su propio conjunto completo de logotipos. Usa **+ Añadir otro logotipo** y nómbralo; tu conjunto principal es simplemente "Tu logotipo".
- **Sube un SVG y Lolly lee sus colores.** En una instalación completamente nueva, establece silenciosamente tu color primario a partir del logotipo y lo indica. En una marca ya existente, ofrece el color como sugerencia en su lugar - *"Encontrado en el logotipo: #…"* con un botón **Usar como primario** al lado - en la sala Colores, donde puedes aceptarlo o descartarlo.

## Colores

![The Colours room after one colour - the two panes back, the generate offer, roles reading in three registers and the pane at one colour](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dpick&width=1440&height=840&dpi=192&waitMs=1800&drive=click%3A%5Bdata-be-editor-add%5D%3Bwait%3A900&format=svg&walker=1&dark=1&filename=bs-colour-first)

La sala más rica, en dos paneles. El izquierdo es donde trabajas; el derecho es tu **paleta en vivo**. Arrastra el divisor entre ambos para redimensionar (Intro sobre él pliega la paleta a un lado).

![La sala Colores - un color primario deriva rampas, tarjetas de muestra con ratios de contraste y una paleta en vivo](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor&width=1440&height=740&dpi=192&waitMs=1800&format=svg&walker=1&localize=1&dark=1&filename=brand-colours)

### Añade un color, luego dale un cometido

**Añadir un color** es toda la ruta sencilla: pega o elige un color en cualquier notación y se convierte en exactamente un token. No se deriva nada de él, no se sugiere nada a partir de él, no se exige nada más. Pega una *lista* entera de colores y cada uno se convierte en una etiqueta que puedes añadir por su cuenta.

**Roles** es la capa por encima de eso - qué color desempeña cada papel. Los roles son opcionales (un sistema de diseño con tres colores sueltos y sin roles es perfectamente válido), cualquier muestra puede tomar uno y la lectura de contraste se mide contra la superficie, APCA primero.

### Las alas de experto

Cuatro secciones plegadas se sitúan debajo de esas dos. Abre la que quieras; cada una tiene enlace directo como `#/start?area=color&focus=<wing>`:

- **Generar una paleta inicial** (`focus=generate`) - un color se convierte en un conjunto completo de tonos. Descrito más abajo.
- **Curvas de tono** (`focus=curves`) - remodela una rampa punto por punto. Luminosidad, croma y matiz tienen cada uno su propia curva, se cambian con L / C / H, y los tonos de abajo se recalculan en vivo mientras arrastras.
- **Contraste** (`focus=contrast`) - **Bloqueo de contraste** retoniza una rampa para alcanzar objetivos APCA frente a un fondo que eliges, cada paso conservando su propio matiz y croma; **Rotar matiz** gira toda la rampa en bloque alrededor de la rueda, cada tono conservando su luminosidad y croma.
- **Impresión** (`focus=print`) - en qué se convierte el primario en imprenta: su valor de pantalla automático, o una compilación CMYK fijada o una tinta directa con nombre en su lugar.

### Un color, toda una paleta

Dentro de **Generar una paleta inicial**, elige un **Color primario** y Lolly calcula una paleta completa - superficies claras y oscuras, texto, acentos y rampas completas de matiz/tono - usando las mismas matemáticas de color perceptual (OKLCH) que el motor usa en todas partes. Ajusta la derivación:

- **Esquema** - Mono, Complementario, Análogo o Tríada - establece cómo se relaciona el color secundario con tu primario.
- **Tonos** - un deslizador de 3 a 20 (por defecto 5) controla cuántos pasos genera cada rampa.
- **Ajuste fino** (plegado) - **Intensidad de la interfaz** (Apagado / Intenso), **Contraste** (Cómodo / Alto) y **Texto sobre la marca** (Automático / Claro / Oscuro).

Nada en esta ala escribe nada en tu marca. Es una vista previa, en vivo en toda la aplicación para que la juzgues, hasta que pulsas **Reemplazar paleta** (abajo).

Debajo del primario verás rampas en vivo **Primario / Neutro / Secundario / Mezcla** y tarjetas de muestra Claro y Oscuro, cada una con su propia lectura de contraste - el ratio WCAG con la cifra APCA `Lc` al lado. **Haz clic en un paso de la rampa Neutro o Secundario** para anclar ese tono en lugar del valor derivado por defecto.

![Las cuatro rampas apiladas sobre tarjetas de muestra claras y oscuras, cada tarjeta con su propio ratio de contraste WCAG](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dgenerate%26seed%3D%2523e0452b&width=1440&height=1400&dpi=192&waitMs=1800&css=.start-head%7Bdisplay%3Anone%7D&cropSelector=.be-preview&format=svg&walker=1&dark=1&filename=bs-colour-ramps)

### Construye tu paleta (generador de armonías)

Todavía en la misma ala, **Construye tu paleta** genera colores de acento a juego a partir de tu primario. Elige una **Armonía** - **Complementaria**, **Adyacente**, **Tríada**, **Tétrada** o **Análoga** (que trae su propio número de **Acentos**, de 2 a 5, y un **Ángulo** de matiz de 10° a 45°) - y cada candidato llega con un nombre legible generado automáticamente y un botón **+ Añadir**. Añadir uno pone ese color en tu paleta de inmediato, una pulsación a un token. *"Tu paleta, aplicada"* muestra el conjunto completo sobre gráficos reales.

![Acentos generados, cada uno con una muestra, un nombre generado automáticamente, su hex y un botón Añadir](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dgenerate%26seed%3D%2523e0452b&width=1440&height=900&dpi=192&waitMs=1800&css=.start-head%2C.be-colour%7Bdisplay%3Anone%7D&cropSelector=.be-candidates&walker=1&format=svg&dark=1&filename=bs-harmony-candidates)

### Confirmar una paleta generada

**Reemplazar paleta** es el único control de esta ala que escribe algo, y nunca lo escribe de inmediato. Púlsalo y primero se abre una tarjeta de revisión, encabezada **"¿Reemplazar la paleta?"**, que detalla exactamente lo que está a punto de ocurrir: cuántos roles se mantienen como los asignaste, cuántos colores que añadiste tú se conservan, cuántas curvas de tono se reanclan, cuántos bloqueos de impresión se refijan, cuántos tonos ocultos permanecen ocultos, cuántas paradas de degradado conservan su color.

**Reemplazar paleta** en esa tarjeta lo confirma; **Cancelar** se retira y no cambia nada. Una vez ejecutado, la tarjeta se convierte en **"Paleta reemplazada."** con un único **Deshacer** ya enfocado - y se toma un punto de control de todo el sistema de diseño *antes* del cambio, así que "volver a como estaba" es una restauración y no una tarde perdida.

### La paleta, el gráfico y cada muestra

El panel derecho lista todos los colores que lleva tu marca, agrupados (Primario, Neutro, Secundario, Espectro, Personalizado, Roles), cada grupo plegable con su propio **+ Añadir**. Debajo, **Gráfico de color** se despliega en dos vistas de las mismas muestras: la **Rueda** (la rueda OKLCH - arrastra un punto para recolorearlo, haz clic en un punto para editarlo o haz clic en un espacio vacío para soltar una muestra nueva) y el gráfico de **Gamut**, que muestra dónde termina realmente el rango representable. `#/start?area=color&focus=chart` abre la tarjeta directamente, igual que `?wheel` siempre ha hecho.

![El panel de la paleta, cada grupo plegable, con la píldora de descarga situada en su borde inferior](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dpick&width=1440&height=1000&dpi=192&waitMs=1800&drive=click%3A%5Bdata-be-editor-add%5D%3Bwait%3A500%3Bclick%3A%5Bdata-be-generate-cta-go%5D%3Bwait%3A900%3Bclick%3A%5Bdata-be-replace-palette%5D%3Bwait%3A800%3Bclick%3A%5Bdata-be-review-go%5D%3Bwait%3A1400&cropSelector=.be-split-side&walker=1&format=svg&dark=1&filename=bs-palette-pane)

![La rueda OKLCH - el ángulo es el tono, la distancia hacia fuera es el croma y los grises recorren un carril de luminosidad en el lateral](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dpick&width=1440&height=900&dpi=192&waitMs=2400&css=.start-head%2C.be-pal%2C.be-gradients%7Bdisplay%3Anone%7D&drive=click%3A%5Bdata-be-editor-add%5D%3Bwait%3A500%3Bclick%3A%5Bdata-be-generate-cta-go%5D%3Bwait%3A900%3Bclick%3A%5Bdata-be-replace-palette%5D%3Bwait%3A800%3Bclick%3A%5Bdata-be-review-go%5D%3Bwait%3A1400%3Bclick%3A%5Bdata-be-chart%5D%20summary%3Bwait%3A900&cropSelector=.be-pal-wheel&walker=1&format=svg&dark=1&filename=bs-colour-wheel)

Haz clic en cualquier muestra para abrir su editor:

- **Renómbrala**.
- **Define el color** - el selector se abre con controles deslizantes perceptuales **OKLCH**, con modos para **Hex**, **HSL**, **RGB** y **CMYK**; el campo de valor lee *y* escribe en el espacio que esté activo, así que puedes pegar un hex o escribir porcentajes de tinta. Ten en cuenta que introducir CMYK define el color de *pantalla* por conversión - para fijar tintas exactas, usa el bloqueo de impresión de más abajo.
- **Almacenado como** - elige cómo se guarda la muestra: **LCH** (el valor por defecto - perceptual, de amplio gamut, la mejor opción para editar), Hex, RGB o HSL. Anúlalo cuando necesites fijar un hex heredado exacto o igualar un valor sRGB.
- **Usar como** - asigna a esta muestra uno de los roles de marca directamente, sin volver al panel de Roles. (La ficha propia de un rol no lo ofrece - un rol no puede tomar un rol.)
- **Sustitutos de impresión** (plegado) - bloquea el comportamiento de impresión del color:
  - **CMYK** - cámbialo de **Auto** a **Bloqueado** para anular la conversión automática de sRGB a CMYK con valores de tinta exactos (C/M/Y/K, 0-100).
  - **Color plano** - cámbialo de **Ninguno** a **Definido** para fijar la muestra a un color plano (spot); dale un **Nombre** (p. ej. `PANTONE 186 C`), un **Libro** opcional y un **Acabado** opcional (Tinta ordinaria por defecto) para cuando la tinta no es en realidad una tinta - un estampado en relieve, un grabado o repujado, un barniz localizado, un tacto suave o un troquelado, hendido o perforado.
- **En otros espacios** (plegado) - la misma idea ampliada: cada fila es un espacio en el que se puede expresar esta muestra, ya sea derivado del valor canónico o creado por ti, y uno creado por ti prevalece en la exportación.

Estos bloqueos de impresión son lo que usa una imprenta cuando exportas un PDF o TIFF en CMYK - consulta [Exportar](/info/exporting.html#colour-profiles).

**Eliminar una muestra** es seguro: los pasos de rampa derivados y los roles de tema quedan *ocultos* (el token subyacente sigue resolviéndose, así que nada aguas abajo se rompe), mientras que los colores que añadiste tú mismo se eliminan por completo.

### Degradados

Un panel opcional de **Degradados** construye tokens de mezcla a partir de tu paleta para fondos y acentos. Omítelo por completo si tu marca no usa degradados. Cada degradado tiene una vista previa, paradas con nombre (2-8) y un ángulo. El comportamiento clave: **una parada hace referencia a una muestra**, así que si recoloreas esa muestra, el degradado la sigue. La interpolación se ejecuta en OKLCH para mezclas limpias. Elimina una parada para recortar la secuencia.

### Lleva la paleta a otro sitio

La píldora flotante situada en el borde inferior del panel de paleta descarga la paleta completa como **Tokens de diseño (JSON)**, **variables CSS**, **clases CSS**, **variables SCSS**, una **paleta GIMP (.gpl)** o un **Adobe Swatch Exchange (.ase)** - así la marca entra directamente en Illustrator, Figma, GIMP o una hoja de estilos. Está fuera del scroller del panel, así que mantiene su lugar por mucho que se desplace la paleta. (También puedes descargar la paleta desde la vista [Catálogo](/info/using.html).)

## Tipografía

![The compare stage open under its card, with the search row, the pinned families and the cards folded to a one-line strip](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dtype%26focus%3Dstage&width=1440&height=740&dpi=192&waitMs=1800&format=svg&walker=1&dark=1&filename=bs-type-stage)

La sala empieza con **cuatro tarjetas de rol** - las cuatro fuentes que la app, tus herramientas y cada exportación realmente leen. Cada tarjeta muestra qué sirve ese rol ahora mismo, tipografiado en esa fuente, con una línea de texto real debajo:

- **Principal** - texto de cuerpo, botones y todas las herramientas.
- **Titulares** - la fuente de visualización para `h1`/`h2`.
- **Código** - una fuente monoespaciada para código y datos.
- **Cursiva** - una compañera de cursiva verdadera para énfasis, citas y apartes.

Titulares, código y cursiva recurren cada uno a la principal hasta que se los asignas, así que una marca de una sola fuente no necesita ninguna decisión aquí. Nada en una tarjeta compromete nada: **Cambiar** (o **Elegir una fuente** en un rol vacío) abre el **escenario de comparación** centrado en ese rol.

![La sala de Tipografía - las tarjetas de rol y un espécimen en vivo de cada fuente haciendo su trabajo](/t/url-shot?url=%2F%23%2Fstart%3Ftab%3Dtype&width=1440&height=740&dpi=192&waitMs=1800&format=svg&walker=1&dark=1&filename=brand-type)

### El escenario de comparación

El escenario se abre **integrado en la sala**, no en un diálogo, así que las tarjetas de las que viniste permanecen en pantalla. Busca una familia de Google Fonts (Inter, Fraunces, Space Grotesk…) o suelta un archivo de fuente, pulsa **Añadir a la comparación** y las candidatas se colocan lado a lado con las mismas palabras antes de que ninguna se instale. Escape cancela y devuelve el teclado a la tarjeta desde la que lo abriste.

Esa es la única puerta de entrada, por lo que nada entra en tu marca sin ser visto. Bajo el escenario están los dos paneles de gestión:

- **Fuentes en este dispositivo** - cada familia instalada, los roles a los que sirve y un botón de eliminar. **Añadir una fuente** aquí abre el mismo escenario de comparación sin restringir a un rol.
- **Tus fuentes** - sube un **TTF**, **OTF** o **WOFF** desde tu propia máquina. Ese es el camino para una tipografía corporativa con licencia que ya posees.

En ambos casos, la fuente permanece en este dispositivo, se representa en la app, en tus herramientas y en cada exportación, sin conexión para siempre, y viaja en tu paquete de marca - nada se descarga en el momento de renderizar. Todo lo que hay en Google Fonts se distribuye bajo una licencia abierta (OFL/Apache/UFL).

El panel **Roles de tipografía** al pie muestra un espécimen en vivo de cada rol - cuerpo e interfaz en la principal, una fuente de visualización opcional para los titulares superiores, una cursiva para énfasis, una monoespaciada para código y datos - así puedes ver todo el conjunto funcionando junto.

![El espécimen de Roles de tipografía - titular, cuerpo, cursiva y código, cada uno tipografiado en la fuente a la que resuelve ese rol, con el nombre de la fuente al lado](/t/url-shot?url=%2F%23%2Fstart%3Ftab%3Dtype&width=1440&height=1000&dpi=192&waitMs=2600&drive=click%3A%5Bdata-be-typemore-toggle%5D%3Bwait%3A600&cropSelector=.be-typecard-grid&walker=1&format=svg&dark=1&filename=bs-type-specimen)

## Tokens

El resto del sistema de diseño, editable sin tocar código:

![La sala de Tokens - un control deslizante de radio de esquina más espaciado, tamaño, sombras y el resto del sistema](/t/url-shot?url=%2F%23%2Fstart%3Ftab%3Dtokens&width=1440&height=740&dpi=192&waitMs=1600&format=svg&walker=1&dark=1&filename=brand-tokens)

- **Esquinas redondeadas** - un único control deslizante de radio (0-1.5rem) que siguen las tarjetas, botones y paneles de toda la app.
- **Más tokens** - añade y edita **espaciado**, **tamaño**, **grosor de trazo**, **opacidad**, **rotación**, **números** simples y **sombras**. Elige un tipo, dale un nombre (*Espacio, Sombra de tarjeta…*) y define su valor. Se almacenan como [tokens de diseño](/info/design-tokens.html) estándar (DTCG) y viajan con tu marca.

## Archivos

Suelta aquí los archivos que guarda tu marca -aparte de los logos-: recursos **vectoriales**, de **imagen**, de **audio** y de **movimiento** (vídeo, Lottie, animados). Llegan a tu [Catálogo](/info/using.html), clasificados en secciones y listos en el selector de recursos de cada herramienta. Todo permanece en este dispositivo. (El riel etiqueta la sala como **Archivos**; la clave de URL sigue siendo `catalogue`, porque la clave de un panel es un contrato permanente.)

## Traer una marca

**Añadir desde…** al pie del riel abre un selector de dos fases. La primera fase pregunta qué *tienes*, no en qué formato está:

- **Tokens de diseño o un archivo de diseño** - DTCG o JSON de Tokens Studio, un proyecto de Penpot, un **zip de conjuntos de tokens**, un paquete de sistema de diseño de Lolly o un SVG.
- **PDF** - una presentación o un archivo de directrices, leído en este dispositivo para extraer sus colores, sus marcas y sus tipografías incrustadas.
- **Imagen** - una captura de pantalla o una foto; sus colores se leen en este dispositivo y no se sube nada.
- **Archivo de fuente** - TTF, OTF o WOFF. Abre la sala de Tipografía, donde se instala la fuente.
- **Sitio web** - una página, leída para extraer sus colores y tipografía. Esta ficha solo aparece en un dispositivo que realmente pueda leer una página, porque una ficha desactivada que anuncia algo que nadie puede pulsar es peor que ninguna ficha. Donde aparece, nombra claramente su lector: obtenida por la app en este dispositivo, o leída a través de la extensión de navegador en una pestaña en segundo plano, con tu sesión iniciada. Nombrar una URL solo *rellena de antemano* el campo - el botón de obtención es el consentimiento, así que un enlace que alguien te envíe nunca puede iniciar una lectura.

Elige la fuente de archivo de diseño y la segunda fase es la tarjeta de abajo: los formatos aceptados encabezan como fichas con icono en orden de preferencia, y toda la tarjeta es un único destino de arrastre - haz clic en cualquier parte de ella o arrastra un archivo hasta ella. También puedes soltar un archivo directamente sobre el estudio.

![La tarjeta de importación - los formatos aceptados encabezan como fichas con icono, y toda la tarjeta es un único destino de arrastre](/t/url-shot?url=%2F%23%2Fstart%3Fsource%3Dfile&width=1440&height=900&dpi=192&waitMs=1600&css=.start-import-modal%20.modal-msg%2C.start-import-modal%20.modal-title%7Bdisplay%3Anone%7D&cropSelector=.start-import-drop&walker=1&format=svg&dark=1&filename=bs-brand-import-formats)

Qué te ofrece cada archivo de diseño:

- un paquete **LollyBrand** (`.zip`) - se instala en un solo paso;
- una exportación de **Penpot** (`.penpot`) - importa sus tokens de diseño;
- un archivo de **Tokens de diseño** (`.json`) - W3C DTCG;
- un archivo de **Tokens Studio** (`.json`) - Tokens Studio;
- un **SVG plano** (`.svg`) - Lolly escanea sus colores y te deja elegir cuáles conservar, y el primero se convierte en tu color principal.

Una instalación desde una fuente crea primero un **punto de control**, así que "volver a como estaba antes de la importación" es una sola restauración. Y lo que encuentra un escaneo no entra directamente: los candidatos llegan a la **Bandeja**, donde cada uno se añade con su propia pulsación, a través de la sala que posee ese tipo de material.

`#/start?source=<kind>` abre el selector en una fuente dada (`file`, `pdf`, `image`, `font`, `url`), y `?import` lo abre en la lista simple.

## Mover una marca entre dispositivos

**Exportar** al pie del riel escribe un único **`LollyBrand-…zip`** - tus tokens, fuentes, logos y preferencia de tema, con un manifiesto de integridad que se verifica al volver a importarlo. Junto a él, **Tokens (.json)** escribe el documento de tokens de diseño en solitario: sin fuentes, sin logos, solo los tokens, que es lo que realmente lee un repositorio, un paso de CI u otra herramienta de tokens.

Traer una de vuelta es **Añadir desde… → Tokens de diseño o un archivo de diseño** (arriba), o un arrastrar y soltar sobre el estudio. Así es como un compañero te entrega una marca, o cómo llevas una a una segunda instalación - sin cuenta, sin nube. Para traer una marca desde la línea de comandos, consulta [`ingest:brand`](/info/configuration.html#brand-packs).

## Versiones

**Versiones**, al pie de la barra, es donde un design system deja de ser un objetivo móvil. Publica una y obtienes una **copia permanente y con nombre** conservada en este dispositivo: nunca cambia después, así que una herramienta que la fija sigue dibujando lo mismo. El panel permanece oculto hasta que hay algo propio que publicar, así que un estudio que nunca publica nunca ve los controles.

Tres cosas que conviene saber antes de pulsar nada, y el panel las dice las tres antes de pulsar, no después:

- **Una versión es permanente.** Todavía no hay eliminación, así que el panel indica lo que se ha conservado y que sigue conservado, en lugar de ofrecer un botón que mienta.
- **Las eliminaciones encabezan la tarjeta de compatibilidad.** Los tokens añadidos y modificados son novedades; uno *eliminado* es lo que rompe una herramienta, así que se nombra primero y se llama por lo que es.
- **Publicar no se puede deshacer; restaurar, sí.** *Restaurar lo último desde esta versión* es una edición ordinaria de la cabeza, así que aterriza en la pila de deshacer del estudio y el panel te ofrece de inmediato el botón **Deshacer**.

Puedes **Publicar solo**, o **Publicar y activar** - la diferencia está en si las herramientas y la app siguen esa versión a partir de ahora o siguen tu última edición. **Volver a seguir la última** pone en vivo cada edición en el momento en que se hace. `#/start?area=versions` abre el panel directamente.

## Cuando la marca es fija

Algunas compilaciones incluyen una **marca bloqueada** - sus colores, fuentes y tokens son los que usan todas las herramientas y exportaciones, y no hay nada que cambiar. En ese caso, el estudio se sustituye por una nota breve que explica que esta compilación incluye una marca fija y que la edición está desactivada. Esto es deliberado: así es como una organización garantiza que todo se mantenga fiel a la marca.

## A dónde ir ahora

- **[Usar Lolly](/info/using.html)** - el lienzo, guardar, proyectos y el catálogo.
- **[Tokens de diseño](/info/design-tokens.html)** - el modelo de tokens en el que se expresa tu marca.
- **[Exportar y formatos](/info/exporting.html)** - unidades de impresión, CMYK y los formatos a los que renderiza tu marca.
