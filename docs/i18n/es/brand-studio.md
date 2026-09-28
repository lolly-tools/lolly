# El Estudio de Marca

El **Estudio de Marca** en `#/start` es el único lugar donde das forma a tu marca - sus logotipos, colores, tipografía, el resto de tus tokens y los archivos que guarda. Configúralo aquí una vez y cada herramienta, página y exportación lo sigue *por construcción*, no por revisión.

Los cambios se previsualizan **en vivo en toda la app** a medida que los haces, así puedes ver cómo un color o una fuente aterrizan en todas partes antes de confirmarlos. Todo ocurre en el dispositivo: tus archivos de marca y tokens nunca salen de tu máquina (elegir una fuente de Google descarga esa única familia desde Google, una vez, tras un diálogo de consentimiento), y la marca viaja en un único archivo de [paquete de marca](#move-a-brand-between-devices).

> **Este es el editor. El panel es el espejo.** La pestaña **Sistema de diseño** del Panel (`#/d`) *muestra* tu marca en modo solo lectura; la *editas* aquí en `#/start`. Si quieres cambiar un color más adelante, vuelve al Estudio de Marca.

## Las salas

El estudio es un conjunto de **salas** listadas en un riel lateral - no pasos. Nada está numerado, nada depende de nada más, y llegar a cualquiera de ellas es legítimo:

- **Resumen** - el centro. Lo que existe ahora mismo, de un vistazo, con una puerta hacia cada sala.
- **Colores** - añade colores de uno en uno, asigna roles o genera una paleta entera a partir de uno.
- **Tipografía** - los cuatro tipos que leen la app, las herramientas y cada exportación.
- **Logotipos** - tus marcas, en cada orientación y tratamiento.
- **Tokens** - radio de esquina, espaciado, sombras y el resto del sistema.
- **Archivos** - los archivos de imagen, audio y movimiento que guarda tu marca.

En un móvil la misma lista se convierte en una tira horizontal de chips fijada bajo la cabecera. Cambiar de sala nunca recarga nada - el editor mantiene todos sus paneles montados y simplemente muestra el que pediste.

**Enlaza directamente a una sala** con `#/start?area=<key>`. Las claves son `overview`, `color` *(fíjate en la ortografía estadounidense en la URL)*, `type`, `logos`, `tokens`, `catalogue` (la sala Archivos - la clave del panel es un contrato permanente, así que la URL conserva el nombre antiguo) y `versions`. `?tab=` es el alias de siempre para lo mismo y sigue resolviendo, así que los enlaces y marcadores antiguos siguen funcionando; cualquier valor no reconocido abre Overview en lugar de dar un callejón sin salida.

Fijadas al **pie del riel** están las acciones que pertenecen a todo el sistema de diseño y no a una sala concreta:

- **Añadir desde…** - el selector de origen, para traer una marca desde un archivo, un PDF, una imagen, una fuente o un sitio web. Consulta [Traer una marca](#bring-a-brand-in) más abajo.
- **Bandeja** - los candidatos que un escaneo encontró pero aún no ha confirmado. Permanece oculta hasta que un escaneo realmente conserva algo, y muestra un número cuando lo hace; nada de lo que hay dentro cambia tu marca hasta que pulsas Añadir en esa fila.
- **Exportar** - escribe todo el sistema de diseño como un único `LollyBrand-….lolly`.
- **Tokens (.json)** - el documento de tokens de diseño plano por sí solo, para un repositorio, un paso de compilación u otra herramienta de tokens.
- **Restore brand settings** - vuelve a un punto de control guardado antes de una importación o un reemplazo de los ajustes de marca.
- **Versiones** - publica, activa y restaura copias con nombre del sistema de diseño. Oculto hasta que haya algo propio que publicar (o hasta que un enlace `?area=versions` lo pida por su nombre).

![El riel de salas del estudio - Overview, Colours, Type, Logos, Tokens y Files](/t/url-shot?url=%2F%23%2Fstart&width=1440&height=900&dpi=192&waitMs=1600&cropSelector=.ds-rail&waitSelector=.ds-rail&format=svg&walker=1&localize=1&dark=1&filename=brand-studio&try=1)

## Overview

Resumen es la primera sala, y tiene dos caras.

Con **nada elegido todavía** dice **Hazlo tuyo**. **Start from a reference** abre el selector de origen para un logotipo, una captura de pantalla, una página web o un archivo de diseño. **Elige un color**, **Elegir un estilo** y **Añadir un logotipo** abren directamente sus controles existentes. Cada ruta empieza con una elección; abrir una no escribe nada. **Explorar las herramientas** está disponible de inmediato.

Una vez que algo es tuyo, la misma sala muestra **lo que tienes**, con los recuentos que hiciste en primer plano. Colores indica el número de colores que lleva el sistema de diseño, y añade un discreto `· N starter` solo donde hay colores heredados a la vista; la franja de al lado coloca primero los colores que elegiste tú, luego una línea fina y los iniciales atenuados. Tipografía se lee por rol (*Inter para los titulares*, con *Inicial para el resto · SUSE, SUSE Mono* debajo). Logotipos indica cuántas ranuras están rellenas, o **Sin definir**. Tokens lleva el radio de esquina, etiquetado como *inicial* hasta que lo cambias. Archivos dice **Aún nada** mientras la biblioteca está vacía. Cada bloque es una puerta a su sala. Aquí hay recuentos, nunca una barra de progreso ni una tarjeta de finalización - nada en este estudio se debe.

## Logotipos

Empieza vaciando tu carpeta de marcas en la zona de arrastre de arriba: **"Suelta marcas aquí, o elige varias a la vez"** admite tantos archivos como tengas de una sola vez. Cada archivo se analiza por su forma y su tinta, y luego se pone en cola bajo **Esperando una ranura** como una etiqueta que dice lo que cree - *"Parece el Horizontal primario"*, con la medida en la que se basó, y un botón **Colocar** (**Reemplazar**, donde esa ranura ya está ocupada). Cuando no está segura, la etiqueta lo dice claramente y ofrece **Cambiar ranura** en su lugar, que lista las ocho. Nada se coloca hasta que pulsas algo.

En torno a esa cola ocurren dos cosas. Una marca con margen vacío de sobra recibe primero una **oferta de recorte** - respóndela o pulsa Escape y el archivo original se coloca sin tocar. Y donde una marca puede cubrir una ranura hermana vacía, la sala ofrece la versión derivada **mono** o **invertida** como su propia etiqueta, marcada *Generada*, que desaparece de nuevo si rellenas esa ranura de otra manera.

Debajo de eso está la cuadrícula en la que acaba cada marca - ranuras **orientación × tratamiento**:

- **Orientaciones:** Horizontal (logotipo textual + símbolo en fila) y Vertical (apilado, para espacios cuadrados y altos).
- **Tratamientos:** Primario, Primario invertido (para fondos oscuros), Mono (un color) y Mono invertido.

Eso son ocho ranuras opcionales. Haz clic en una ranura para añadir un PNG, SVG, JPEG o WebP; haz clic en una ranura ocupada para reemplazarla. Todas las ranuras son opcionales y todo permanece en este dispositivo.

![La matriz de logotipos - cada orientación en la parte superior, cada tratamiento como su propia ranura discontinua, todas opcionales](/t/url-shot?url=%2F%23%2Fstart%3Ftab%3Dlogos&width=1440&height=1600&dpi=192&waitMs=1600&cropSelector=.be-logo-grid&format=svg&walker=1&dark=1&filename=bs-logo-slots)

- **Marcas personalizadas** - añade marcas que tu marca llama a su manera (un icono, un escudo, un favicon) bajo **Marcas personalizadas**; nómbrala y elige un archivo.
- **Más identidades** - una submarca, un producto o un evento puede tener su propio conjunto completo de logotipos. Usa **+ Añadir otro logotipo** y nómbralo; tu conjunto principal es simplemente "Tu logotipo".
- **Sube un SVG y Lolly lee sus colores.** En una instalación completamente nueva, establece silenciosamente tu color primario a partir del logotipo y lo indica. En una marca ya existente, ofrece el color como sugerencia en su lugar - *"Encontrado en el logotipo: #…"* con un botón **Usar como primario** al lado - en la sala Colores, donde puedes aceptarlo o descartarlo.

## Colores

La sala crece junto con el sistema de diseño. Nada que aún no necesites está en la página, así que una primera visita es una sola decisión y el resto llega a medida que lo hace la paleta.

### El primer color

Un sistema de diseño sin colores propios se abre en una sola columna centrada: **Empieza con un color**, un gran chip en vivo, un campo, y una línea discreta que dice que los roles, los tonos y los ajustes de impresión llegan a medida que el sistema crece.

- **El chip es el selector.** Púlsalo y se abre la propia tarjeta OKLCH del estudio sobre el chip, sembrada con lo que sea que contenga el campo: un nombre, la rueda, los cuatro diales, alfa y **Guardado como**, con **Cancelar** y **Añadir color** al pie. Arrastrar un dial pinta el chip y reescribe el campo mientras lo haces, y nada llega al sistema de diseño hasta que pulsas **Añadir color**.
- **El campo acepta cualquier notación** - `#e0452b`, `rgb(224 69 43)`, `oklch(58% .19 32)` o un nombre de color sencillo - y una *lista* entera de colores se convierte en una fila de chips que añades de uno en uno.
- **Hay dos puertas más al lado.** El cuentagotas (en un navegador que tenga uno) toma un color de la pantalla, y **Desde una imagen** lee una captura de pantalla o una foto de este dispositivo y ofrece los colores que encuentra.
- **Añadir nunca está desactivado.** Con nada legible en el campo, abre el selector, que es lo que suele significar una pulsación en vacío; un texto que no puede analizar recibe una línea bajo el campo que lo indica, en lugar de un botón muerto.

El primer color se convierte en el **principal**, y el chip que responde a la adición lo dice - *"Principal es ahora Vivid Violet"* - con **Ajuste fino** al lado.

![La sala Colores sin nada elegido todavía - un gran chip en vivo, un campo y una línea sobre lo que llega después](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor&width=1440&height=740&dpi=192&waitMs=1800&format=svg&walker=1&localize=1&dark=1&filename=brand-colours)

### Inicial

**Inicial** es la palabra para todo lo que vino con la app en lugar de haber sido elegido. Una instalación nueva no lleva ningún color: lo que tiene es una rampa neutra, tinta sobre papel, para que las superficies, el texto y las líneas finas se rendericen antes de que nadie haya decidido nada. Esos neutros son andamiaje, así que no cuentan como colores y no se dibujan en el panel de la paleta. Viven en la sala [Tokens](#tokens) como **Neutros · inicial · 9**, con un **Abrir** que los muestra en el panel de Colores como un grupo plegado y etiquetado (`#/start?area=color&group=neutral`).

La misma palabra se repite en cada sala: un rol que se apoya en un color inicial se lee *"Paper inicial ocupa su lugar"* y su selector ofrece **Elegir…**; un estilo inicial lleva una etiqueta **Inicial** y ningún tinte; un radio de esquina inicial se etiqueta en el Resumen. El material heredado nunca se dibuja con un borde discontinuo, porque un borde discontinuo significa aquí un destino de arrastre.

### A medida que la paleta crece

Tus colores permanecen junto a una vista previa **In context** en una pantalla ancha y se apilan encima de ella en pantallas más pequeñas. La vista previa puede mostrar un póster, un gráfico o una tarjeta de interfaz usando tu paleta. Los colores iniciales permanecen en su propio grupo plegable, separado de los colores que añades.

Añade colores individuales o un conjunto de tonos, asigna sus roles, y abre las secciones avanzadas cuando las necesites. El gráfico de color, los degradados y los controles de descarga permanecen junto a la paleta.

![La sala Colores después de añadir un color, con su paleta y una vista previa de composición en vivo](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dpick&width=1440&height=840&dpi=192&waitMs=1800&drive=click%3A%5Bdata-be-editor-add%5D%3Bwait%3A900&format=svg&walker=1&dark=1&filename=bs-colour-first)

### Roles - lo que leen las herramientas

**Roles** es la capa por encima de las muestras: qué color desempeña cada papel en cada herramienta y exportación. Los roles son opcionales (un sistema de diseño con tres colores sueltos y sin roles es perfectamente válido), cualquier muestra puede tomar uno y la lectura de contraste se mide contra la superficie, con APCA primero.

Una fila se lee en uno de tres registros, así que la franja nunca afirma una decisión que nadie tomó:

- un color propio que ocupa el rol, a plena intensidad;
- **_Paper_ inicial ocupa su lugar** - apagado, con **Elegir…** en su selector;
- **↳ sigue a Primaria** - el rol se resuelve a través de la principal en lugar de tener un color propio.

En cuanto la paleta tiene tonos, la franja crece hasta las siete ranuras que una herramienta puede leer: Principal, Secundario, Superficie, Texto, Apagado, Borde y Sobre la primaria. Sobre la primaria se deriva de la principal, se lee como **Derivado** y no lleva selector.

**El acento propio de la app es una preferencia, no un token.** Por defecto la interfaz sigue al sistema de diseño y el acento de la interfaz toma el color principal. Eso es un ajuste de Apariencia en [tu perfil](/info/profile.html) - **La interfaz sigue al sistema de diseño** - y desactivarlo deja la interfaz en un tono neutro. Las herramientas, los lienzos y las exportaciones no se ven afectados de ninguna manera, y las fuentes y el radio de esquina siguen al sistema de diseño tanto si el ajuste está activado como si no.

### Las alas de experto

Cuatro secciones plegadas se sitúan debajo de la vista previa de composición y los roles de color. Abre la que quieras; cada una tiene enlace directo como `#/start?area=color&focus=<wing>`, que la abre sin importar lo que la sala esté mostrando en ese momento:

- **Explore shades & harmonies** (`focus=generate`) - un color se convierte en un conjunto completo de tonos. Descrito más abajo.
- **Curvas de tono** (`focus=curves`) - remodela una rampa punto por punto. Luminosidad, croma y matiz tienen cada uno su propia curva, se cambian con L / C / H, y los tonos de abajo se recalculan en vivo mientras arrastras.
- **Contraste** (`focus=contrast`) - **Bloqueo de contraste** retoniza una rampa para alcanzar objetivos APCA frente a un fondo que eliges, cada paso conservando su propio matiz y croma; **Rotar tono** gira toda la rampa en bloque alrededor de la rueda, cada tono conservando su luminosidad y croma.
- **Imprimir** (`focus=print`) - en qué se convierte el principal en imprenta: su valor de pantalla automático, o una compilación CMYK fijada o una tinta directa con nombre en su lugar.

### Un color, toda una paleta

Dentro de **Explore shades & harmonies**, elige un **Starting colour**. Lolly sugiere tonos a juego usando las mismas matemáticas de color perceptual (OKLCH) que el motor usa en otros lugares. Ajusta las sugerencias:

- **Esquema** - Mono, Complementario, Análogos o Tríada - establece cómo se relaciona el color secundario con el principal.
- **Tonos** - un deslizador de 3 a 20 (por defecto 5) controla cuántos pasos genera cada rampa.
- **Ajuste fino** (plegado) - **Intensidad de la interfaz** (Apagado / Profundo), **Contraste** (Confort / Alto) y **Texto sobre marca** (Auto / Claro / Oscuro).

Cambiar el color inicial y los controles solo cambia las sugerencias. Haz clic en un tono para añadir ese color, o en **Añadir 5 tonos** para añadir un grupo (la cantidad sigue tu ajuste de Tonos). Los colores y roles existentes permanecen en su lugar. Deshacer elimina la adición.

Las filas **Principal**, **Neutro** y **Secundario** muestran los tonos sugeridos. Abre **Theme preview** para inspeccionar ejemplos claros y oscuros y sus lecturas de contraste. Elige ahí un paso de Neutro o Secundario para ajustar los anclajes de tema propuestos. Reconstruir la paleta completa sigue siendo una acción aparte y revisada, más abajo.

![Tres grupos de tonos sugeridos, con controles de añadir individuales y un Theme preview aparte](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dgenerate%26seed%3D%2523e0452b&width=1440&height=1400&dpi=192&waitMs=1800&css=.start-head%7Bdisplay%3Anone%7D&cropSelector=.be-preview&format=svg&walker=1&dark=1&filename=bs-colour-ramps)

### Construye la paleta (generador de armonías)

En **Find matching colours**, el generador de armonías sugiere colores de acento a juego a partir del principal. Elige una **Armonía** - **Complementaria**, **Adyacente**, **Tríada**, **Tétrada** o **Análoga** (que trae su propio número de **Acentos**, de 2 a 5, y un **Ángulo** de matiz de 10° a 45°) - y cada candidato llega con un nombre legible generado automáticamente y un botón **+ Añadir**. Añadir uno pone ese color en la paleta de inmediato, una pulsación a un token. **In context** muestra tus colores añadidos sobre composiciones de ejemplo.

![Acentos generados, cada uno con una muestra, un nombre generado automáticamente, su hex y un botón Añadir](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dgenerate%26seed%3D%2523e0452b&width=1440&height=900&dpi=192&waitMs=1800&css=.start-head%2C.be-colour%7Bdisplay%3Anone%7D&drive=click%3A.be-generate-detail%3Anot%28%5Bdata-be-rebuild%5D%29%20%3E%20summary%3Bwait%3A500&cropSelector=.be-candidates&walker=1&format=svg&dark=1&filename=bs-harmony-candidates)

### Confirmar una paleta generada

Añadir un color sugerido o un grupo de tonos conserva el resto de tu paleta. Para un reemplazo completo, abre **Rebuild the whole palette…** y pulsa **Preview full rebuild**. La revisión explica los cambios: cuántos roles se mantienen como los asignaste, cuántos colores que añadiste tú se conservan, cuántas curvas de tono se reanclan, cuántos bloqueos de impresión se refijan, cuántos tonos ocultos permanecen ocultos, cuántas paradas de degradado conservan su color.

**Apply rebuilt palette** en esa tarjeta la confirma; **Cancelar** se retira y no cambia nada. Una vez ejecutado, la tarjeta ofrece **Deshacer** ya con el foco puesto en él - y se toma un punto de control de todo el sistema de diseño *antes* del cambio, así que "devolverlo a como estaba" es una restauración y no una tarde perdida.

### La paleta, el gráfico y cada muestra

La paleta enumera los colores del sistema de diseño en grupos plegables, cada uno con su propio control **+ Añadir**. Crea y renombra grupos para organizar tu trabajo. Un rol nunca crea una segunda ficha: un token es una ficha, y una ficha a la que apunta un rol lleva en su lugar una pequeña marca de esquina (**P**, **S**, **Su**, **T**). Debajo de las fichas, **Gráfico de color** se despliega en dos vistas de las mismas muestras: la **Rueda** (la rueda OKLCH - arrastra un punto para recolorearlo, haz clic en un punto para editarlo o haz clic en un espacio vacío para soltar una muestra nueva) y el gráfico de **Gama**, que muestra dónde termina realmente el rango representable. `#/start?area=color&focus=chart` abre la tarjeta directamente, igual que `?wheel` siempre ha hecho.

![El panel de la paleta, cada grupo plegable, con la píldora de descarga anclada en su borde inferior](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dgenerate%26seed%3D%2523e0452b&width=1440&height=1000&dpi=192&waitMs=1800&drive=click%3A%5Bdata-be-add-ramp%3D%22primary%22%5D%3Bwait%3A1200&cropSelector=.be-split-side&walker=1&format=svg&dark=1&filename=bs-palette-pane)

![La rueda OKLCH - el ángulo es el tono, la distancia hacia fuera es el croma y los grises recorren un carril de luminosidad en el lateral](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dgenerate%26seed%3D%2523e0452b&width=1440&height=900&dpi=192&waitMs=2400&css=.start-head%2C.be-pal%2C.be-gradients%7Bdisplay%3Anone%7D&drive=click%3A%5Bdata-be-add-ramp%3D%22primary%22%5D%3Bwait%3A1200%3Bclick%3A%5Bdata-be-chart%5D%20summary%3Bwait%3A900&cropSelector=.be-pal-wheel&walker=1&format=svg&dark=1&filename=bs-colour-wheel)

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

### Trabajar con muchas muestras

Cada muestra tiene su propio tirador de arrastre. Arrástralo para reordenar los colores dentro de su grupo, o enfócalo, pulsa Espacio, usa las teclas de flecha, y pulsa Espacio de nuevo para soltarlo. Escape cancela. El orden sobrevive a volver a abrir el estudio y se puede deshacer. Para mover colores entre grupos, usa el control **Agrupar** del editor de muestras o selecciona varios colores y usa **Mover**. Los nombres de los tokens y las referencias de rol permanecen intactos.

La selección en el panel de la paleta es un gesto, no un modo. No hay ningún botón que pulsar primero, y la barra aparece con la primera ficha seleccionada y desaparece con la última.

- **Arrastra sobre el espacio vacío del panel** para dibujar un rectángulo: cada ficha que toca se une a la selección, cruzando los límites de grupo. Una sección plegada no aporta nada, y un arrastre que nunca se mueve borra la selección.
- **Shift-clic** toma el rango en orden de lectura; **Cmd/Ctrl-clic** activa o desactiva una ficha; un clic normal sigue abriendo el editor de esa ficha.
- Cada encabezado de grupo lleva **Seleccionar todo**, y **Cmd-A** con una ficha enfocada toma cada color que posee el sistema de diseño - nunca uno inicial.
- La cuadrícula tiene una sola parada de tabulación. Las flechas la recorren, Shift-flechas extienden la selección, Espacio activa o desactiva una ficha, Suprimir elimina la selección y Escape la borra. (Las flechas solo mueven el foco: para ajustar un canal, pulsa primero `l`, `c` o `h`, como indica la lectura.)
- En una pantalla táctil no hay rectángulo. Mantén pulsada una ficha para iniciar una selección, y luego toca para añadir; **Seleccionar todo** por grupo se encarga del resto.

La propia barra dice **{n} seleccionados**, luego **Mover a** (un grupo existente, o uno nuevo que nombras dentro del menú), **Asignar un rol** (cada color seleccionado toma el siguiente rol por turno, así que cuatro fichas rellenan los cuatro roles en una sola pulsación), **Descargar** (la selección en cualquiera de los seis formatos de paleta), **Copiar valores** (una línea por color en su notación guardada) y **Eliminar**. Mover a y Asignar un rol aparecen en cuanto la paleta tiene tonos que mover. Un solo Ctrl/Cmd-Z deshace toda una acción masiva - un movimiento de cuarenta, un reparto de roles, una eliminación - y una eliminación dice qué conservó, porque una selección alcanza fichas que esta sala no elimina.

### Degradados

Un panel opcional de **Degradados** construye tokens de mezcla a partir de la paleta para fondos y acentos. Sáltatelo por completo si el sistema de diseño no usa degradados. Cada degradado tiene una vista previa, paradas con nombre (2-8) y un ángulo. El comportamiento clave: **una parada hace referencia a una muestra**, así que si recoloreas esa muestra, el degradado la sigue. La interpolación se ejecuta en OKLCH para mezclas limpias. Elimina una parada para recortar la secuencia.

### Lleva la paleta a otro sitio

La píldora flotante anclada en el borde inferior del panel de la paleta descarga la paleta completa como **Tokens de diseño (JSON)**, **variables CSS**, **clases CSS**, **variables SCSS**, una **paleta GIMP (.gpl)** o un **Adobe Swatch Exchange (.ase)** - así el sistema de diseño entra directamente en Illustrator, Figma, GIMP o una hoja de estilos. Está fuera del scroller del panel, así que mantiene su lugar por mucho que se desplace la paleta, y aparece en cuanto la paleta tiene tonos. (También puedes descargar la paleta desde [Recursos](/info/using.html#assets-your-library).)

## Tipografía

Esta sala crece de la misma manera. Sin una fuente propia es una sola tarjeta y una sola decisión: **Principal**, fijada a tamaño de lectura en la fuente que la sirve hoy, una etiqueta **Inicial** junto al nombre, un **Elegir una fuente** relleno y la línea "Nada se instala hasta que elijas una." Debajo de la tarjeta está "Titulares, código y cursiva siguen a la principal hasta que los elijas", con **Elegirlos por separado** revelando las otras tres tarjetas durante el resto de la visita.

![La sala Tipografía sin ninguna fuente elegida todavía - una tarjeta a tamaño de lectura, una etiqueta Inicial en ella, y un Elegir una fuente relleno](/t/url-shot?url=%2F%23%2Fstart%3Ftab%3Dtype&width=1440&height=740&dpi=192&waitMs=1800&format=svg&walker=1&dark=1&filename=brand-type)

Elige una fuente y la sala se abre en **cuatro tarjetas de rol**, la lista de Tipografías y el espécimen en vivo. Las cuatro fuentes son las que la app, las herramientas y cada exportación realmente leen:

- **Principal** - texto de cuerpo, botones y todas las herramientas.
- **Titulares** - la fuente de visualización para `h1`/`h2`.
- **Código** - una fuente monoespaciada para código y datos.
- **Cursiva** - una compañera de cursiva verdadera para énfasis, citas y apartes.

Titulares, código y cursiva recurren cada uno a la principal hasta que los asignas, así que un sistema de diseño de una sola fuente no necesita ninguna decisión aquí.

**Un tinte significa que tú lo elegiste.** Una tarjeta se tiñe solo donde instalaste esa fuente. Una fuente inicial lleva la misma etiqueta **Inicial** que llevan los grupos heredados de la paleta, en el registro apagado y sin tinte, y un rol que nadie ha elegido se lee **↳ sigue a Primaria** en lugar de repetir el nombre de la principal como si se hubiera elegido. El botón dice **Cambiar** en una fuente propia y **Elegir una fuente** en cualquier otro caso. Nada en una tarjeta confirma nada: el botón abre el **escenario de comparación** centrado en ese rol.

![Las cuatro tarjetas de rol reveladas - cada una tipografiada en la fuente que la sirve, con una etiqueta Inicial donde nadie eligió una y Cursiva siguiendo a la principal](/t/url-shot?url=%2F%23%2Fstart%3Ftab%3Dtype&width=1440&height=1000&dpi=192&waitMs=2600&drive=click%3A%5Bdata-be-typemore-toggle%5D%3Bwait%3A600&cropSelector=.be-typecard-grid&walker=1&format=svg&dark=1&filename=bs-type-specimen)

### El escenario de comparación

![El escenario de comparación abierto bajo su tarjeta, con la fila de búsqueda, las familias fijadas y las tarjetas plegadas a una tira de una línea](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dtype%26focus%3Dstage&width=1440&height=740&dpi=192&waitMs=1800&format=svg&walker=1&dark=1&filename=bs-type-stage)

El escenario se abre **integrado en la sala**, no en un diálogo, y justo debajo de la tarjeta que pulsaste. Mientras está abierto, las tarjetas se pliegan a una tira de una línea de rol y fuente, así que el escenario está en la primera pantalla incluso en un móvil. Escape cancela y devuelve el teclado a la tarjeta desde la que lo abriste.

Elegir una fuente son tres pulsaciones:

1. **Elegir una fuente** en la tarjeta.
2. Escribe el nombre de una familia y pulsa **Vista previa** - o pulsa una de las seis familias **Fijadas** bajo el campo, una pulsación cada una. La tarjeta aparece ya cargando, con una barra esqueleto donde estará el espécimen en lugar de la fuente de la interfaz haciendo de sustituta de una fuente que aún no has visto.
3. **Usar esta variante**.

**El consentimiento se pide una sola vez, en la pulsación que hiciste.** La primera vez que una vista previa llega a Google Fonts, un diálogo dice qué ocurre: *Google conoce el nombre de la familia y tu dirección IP. El archivo se guarda entonces en este dispositivo y se usa sin conexión. Este es el único paso del estudio que llega a un tercero.* **Obtener de Google** sigue adelante y se recuerda. **Cancelar** deja la tarjeta diciendo "No obtenido. No se envió nada a Google." con su propio **Obtener de Google** en vivo, así que cambiar de opinión es una sola pulsación en la propia tarjeta. Ninguna tarjeta muestra nunca un botón muerto: sea cual sea su estado, su único botón principal dice cuál es el siguiente paso.

**Suelta un archivo de fuente en el escenario** y se previsualiza al instante - **TTF**, **OTF** o **WOFF** desde tu propia máquina, que es el camino para una tipografía corporativa con licencia que ya posees. Esa zona de arrastre es la única puerta de archivo en la sala.

De cualquier manera, la fuente permanece en este dispositivo, se representa en la app, en las herramientas y en cada exportación, sin conexión para siempre, y viaja en el archivo del sistema de diseño - nada se obtiene en el momento de renderizar. Todo lo que hay en Google Fonts se distribuye bajo una licencia abierta (OFL/Apache/UFL).

### Fuentes en este dispositivo

El panel **Tipografías** enumera todas las fuentes que tiene este dispositivo y el rol que sirve cada una. Las fuentes que añadiste encabezan bajo **En el sistema de diseño**, cada una con sus roles y un botón de eliminar, y la que sirve a Principal lleva la insignia. Las fuentes iniciales siguen en una fila plegada - *Inicial · SUSE, SUSE Mono · sirviendo a Principal y Código hasta que elijas* - apagadas, sin eliminar y sin nada que ascender, porque ninguna de las dos es una decisión que haya tomado nadie. **Añadir un estilo** abre el mismo escenario de comparación sin restringir.

El panel **Roles tipográficos** al pie muestra un espécimen en vivo de cada rol - cuerpo e interfaz en la principal, una fuente de visualización opcional para los titulares superiores, una cursiva para énfasis, una monoespaciada para código y datos - con la familia y su estado junto a cada una (*Inter*, *SUSE · inicial*, *SUSE · sigue a Principal*), así se puede leer todo el conjunto de una vez.

## Tokens

El resto del sistema de diseño, editable sin tocar código:

![La sala Tokens - un control deslizante de radio de esquina más espaciado, tamaño, sombras y el resto del sistema](/t/url-shot?url=%2F%23%2Fstart%3Ftab%3Dtokens&width=1440&height=740&dpi=192&waitMs=1600&format=svg&walker=1&dark=1&filename=brand-tokens)

- **Esquinas redondeadas** - un único control deslizante de radio (0-1.5rem) que siguen las tarjetas, los botones y los paneles de toda la app.
- **Neutros** - la rampa de tinta sobre papel con la que viene una instalación nueva, listada como **Neutros · inicial · 9** con sus nueve pasos y un **Abrir** hacia el panel de Colores. Es el único lugar donde se gestionan los neutros iniciales, y la etiqueta *inicial* desaparece en el momento en que la rampa se genera en lugar de heredarse.
- **Más tokens** - añade y edita **espaciado**, **tamaño**, **grosor de trazo**, **opacidad**, **rotación**, simples **números** y **sombras**. Elige un tipo, nómbralo (*Espacio, Sombra de tarjeta…*) y define su valor. Se guardan como [tokens de diseño](/info/design-tokens.html) estándar (DTCG) y viajan con el sistema de diseño.

## Archivos

Suelta aquí los archivos que guarda tu marca -aparte de los logotipos-: recursos **vectoriales**, de **imagen**, de **audio** y de **movimiento** (vídeo, Lottie, animados). Llegan a [Recursos](/info/using.html#assets-your-library), clasificados en secciones y listos en el selector de recursos de cada herramienta. Todo permanece en este dispositivo. (El riel etiqueta la sala como **Archivos**; la clave de URL sigue siendo `catalogue`, porque la clave de un panel es un contrato permanente.)

## Traer una marca

**Añadir desde…** al pie del riel abre un selector de dos fases. La primera fase pregunta qué *tienes*, no en qué formato está:

- **Tokens de diseño o un archivo de diseño** - DTCG o JSON de Tokens Studio, un proyecto de Penpot, un **zip de conjuntos de tokens**, un paquete de sistema de diseño de Lolly o un SVG.
- **PDF** - una presentación o un archivo de directrices, leído en este dispositivo para extraer sus colores, sus marcas y sus tipografías incrustadas.
- **Logo or screenshot** - una imagen se convierte en una paleta sugerida, leída en este dispositivo. No se sube nada. Esto lee colores, no la tipografía ni la maquetación de la imagen.
- **Saved web page** - elige un archivo HTML y sus archivos CSS, o pega HTML o CSS. Hasta 20 archivos y 2 MB en total. Solo se lee el texto proporcionado; los recursos enlazados no se obtienen y los scripts no se ejecutan. Esta vía también funciona sin la extensión ni la app de escritorio.
- **Archivo de fuente** - TTF, OTF o WOFF. Abre la sala de Tipografía, donde se instala la fuente.
- **Sitio web** - una página, leída para extraer sus colores y su tipografía. Esta ficha solo aparece en un dispositivo que realmente pueda leer una página, porque una ficha desactivada que anuncia algo que nadie puede pulsar es peor que ninguna ficha. Donde aparece, dice claramente qué lector se usa: obtenida por la app en este dispositivo, o leída a través de la extensión de navegador en una pestaña en segundo plano, con tu sesión iniciada. Nombrar una URL solo *rellena de antemano* el campo - el botón de obtención es el consentimiento, así que un enlace que alguien te envíe nunca puede iniciar una lectura.

Elige la fuente de archivo de diseño y la segunda fase es la tarjeta de abajo: los formatos aceptados encabezan como fichas con icono en orden de preferencia, y toda la tarjeta es un único destino de arrastre - haz clic en cualquier parte de ella o arrastra un archivo hasta ella. También puedes soltar un archivo directamente sobre el estudio.

![La tarjeta de importación - los formatos aceptados encabezan como fichas con icono, y toda la tarjeta es un único destino de arrastre](/t/url-shot?url=%2F%23%2Fstart%3Fsource%3Dfile&width=1440&height=900&dpi=192&waitMs=1600&css=.start-import-modal%20.modal-msg%2C.start-import-modal%20.modal-title%7Bdisplay%3Anone%7D&cropSelector=.start-import-drop&walker=1&format=svg&dark=1&filename=bs-brand-import-formats)

Qué te ofrece cada archivo de diseño:

- un **paquete de sistema de diseño de Lolly** (`.lolly`; el `.zip` heredado todavía se acepta) - se instala en un solo paso;
- una exportación de **Penpot** (`.penpot`) - importa sus tokens de diseño;
- un archivo de **Tokens de diseño** (`.json`) - W3C DTCG;
- un archivo de **Tokens Studio** (`.json`) - Tokens Studio;
- un **SVG simple** (`.svg`) - Lolly escanea sus colores y te deja elegir cuáles conservar, y el primero se convierte en tu color principal.

Un logo/captura, sitio web o página guardada abre **Your suggested design system**. Mira un ejemplo usando los colores propuestos, elige un **Main colour** distinto si lo necesitas, y nombra el sistema. **Use this design system** aplica las paletas claras y oscuras generadas y vuelve a Resumen. Las fuentes existentes permanecen en su lugar. Esto reemplaza los colores del sistema activo y otros ajustes de tokens. Un punto de control debe completarse antes; **Restore brand settings** recupera los ajustes anteriores.

**Source details and individual choices** muestra qué se leyó, los nombres de fuente detectados y el contraste de texto/acción de la vista previa. También ofrece **Choose individual items in the tray** y **Download design context**. El informe JSON lleva observaciones, tokens propuestos e información de origen; el HTML/CSS guardado incluye un SHA-256 del texto proporcionado. No contiene texto bruto de la página y no es un Content Credential firmado. Los nombres de fuente son sugerencias: Tipografía sigue siendo el lugar donde elegir e instalar fuentes.

Las importaciones de PDF y otros archivos de diseño conservan sus controles de revisión existentes. Los elementos guardados en la **Bandeja** no cambian nada hasta que se añaden a través de la sala que posee ese tipo de material.

`#/start?source=<kind>` abre el selector en una fuente dada (`file`, `pdf`, `image`, `font`, `url`, `page`), y `?import` lo abre en la lista simple.

## Mover una marca entre dispositivos

**Exportar** al pie del riel escribe un único **`LollyBrand-….lolly`** - tus tokens, fuentes, logotipos y preferencia de tema, con un manifiesto de integridad que se verifica al volver a importarlo. Las versiones web anteriores a la 1.0.7 llamaban `.zip` a la misma carga; esa grafía heredada todavía se acepta. Junto a él, **Tokens (.json)** escribe el documento de tokens de diseño en solitario: sin fuentes, sin logotipos, solo los tokens, que es lo que realmente lee un repositorio, un paso de CI u otra herramienta de tokens.

Traer una de vuelta es **Añadir desde… → Tokens de diseño o un archivo de diseño** (arriba), o un arrastrar y soltar sobre el estudio. Así es como un compañero te entrega una marca, o cómo llevas una a una segunda instalación - sin cuenta, sin nube. Para traer una marca desde la línea de comandos, consulta [`ingest:brand`](/info/configuration.html#brand-packs).

## Restaurar ajustes anteriores

Elige **Restore brand settings** al pie del riel, selecciona un punto de control con fecha, y luego pulsa **Restaurar**. Esto restaura los colores, los ajustes de tipografía y otros tokens de marca de la marca activa. Los archivos de fuentes e imágenes permanecen como están.

Lolly guarda tus ajustes actuales como **Before restore** antes de aplicar el punto de control. Elige ese punto de control para revertir la restauración, incluso después de cerrar y volver a abrir el navegador. Los últimos 20 puntos de control se conservan en este dispositivo. Si el almacenamiento no se puede leer o los ajustes actuales no se pueden guardar, el diálogo informa del problema para que puedas volver a intentarlo.

## Versiones

**Versiones**, al pie de la barra, es donde un design system deja de ser un objetivo móvil. Publica una y obtienes una **copia permanente y con nombre** conservada en este dispositivo: nunca cambia después, así que una herramienta que la fija sigue dibujando lo mismo. El panel permanece oculto hasta que hay algo propio que publicar, así que un estudio que nunca publica nunca ve los controles.

Tres cosas que conviene saber antes de pulsar nada, y el panel las dice las tres antes de pulsar, no después:

- **Una versión es permanente.** Todavía no hay eliminación, así que el panel indica lo que se ha conservado y que sigue conservado, en lugar de ofrecer un botón que mienta.
- **Las eliminaciones encabezan la tarjeta de compatibilidad.** Los tokens añadidos y modificados son novedades; uno *eliminado* es lo que rompe una herramienta, así que se nombra primero y se llama por lo que es.
- **Publicar no se puede deshacer; restaurar, sí.** *Restaurar lo último desde esta versión* es una edición ordinaria de la cabeza, así que aterriza en la pila de deshacer del estudio y el panel te ofrece de inmediato el botón **Deshacer**.

Puedes **Publicar solo**, o **Publicar y activar** - la diferencia está en si las herramientas y la app siguen esa versión a partir de ahora o siguen tu última edición. **Volver a seguir la última** pone en vivo cada edición en el momento en que se hace. `#/start?area=versions` abre el panel directamente.

## Cuando la marca es fija

Algunas compilaciones incluyen un **sistema de diseño bloqueado**, como la Marca SUSE. Abrirlo muestra una nota de solo lectura con **Hacer una copia editable** y **Cambiar**. Sus colores, fuentes y tokens originales permanecen intactos. Tus propios sistemas locales siguen siendo editables, incluso cuando el sistema bloqueado fue el primero en el dispositivo. En Perfil, **Abrir** selecciona un sistema y abre su estudio; **Haga uno nuevo.** crea un sistema local y lo abre en `#/start` con el campo de nombre enfocado.

## A dónde ir ahora

- **[Usar Lolly](/info/using.html)** - el lienzo, guardar, proyectos y Recursos.
- **[Tokens de diseño](/info/design-tokens.html)** - el modelo de tokens en el que se expresa tu marca.
- **[Exportar y formatos](/info/exporting.html)** - unidades de impresión, CMYK y los formatos a los que renderiza tu marca.


## Encuentra y compara un look

Abre **Find a look** desde Resumen o la lista de sistemas de diseño en Perfil. Explora los sistemas guardados en este dispositivo y algunos ejemplos reutilizables de Lolly. Busca por nombre, etiqueta de color o fuente declarada. **Closest to my current palette** ordena por similitud de color medida, y las familias tipográficas coincidentes deshacen los empates; no es una puntuación de calidad.

Selecciona un look para revisarlo, o dos para compararlos. El botón de revisión permanece disponible en una pantalla pequeña. Seleccionar un look no cambia nada. **Use this saved system** cambia a través del registro existente de sistemas de diseño. **Usar estos colores** aplica un ejemplo mediante el flujo normal de punto de control e instalación, conservando las fuentes actuales. **Restore brand settings** puede recuperar el look anterior.

Bajo **Details and design context**, los sistemas guardados tienen **Search tags** editables y una descarga de contexto. Los ejemplos usan recetas de color originales de Lolly; no hay ninguna colección de inspiración raspada remotamente ni se requiere una cuenta.

![Compara Sunroom y Orchard uno junto al otro antes de aplicar cualquiera de los dos sistemas de color.](/t/url-shot?url=%2F%23%2Fstart&width=1280&height=900&dpi=96&waitMs=3000&format=svg&filename=brand-compare-looks&try=1&drive=click%3A%5Bdata-ds-door%3D%22looks%22%5D%3Bwait%3A500%3Bclick%3A%5Bdata-look-select%3D%22example%3Asunroom%22%5D%3Bclick%3A%5Bdata-look-select%3D%22example%3Aorchard%22%5D%3Bclick%3A%5Bdata-looks-review%5D%3Bwait%3A500&cropSelector=.ds-looks-comparison&waitSelector=%5Bdata-ds-door%3D%22looks%22%5D&walker=1&rasterDpi=96)

La comparación mantiene ambas paletas visibles juntas. Revisar un look no cambia nada hasta que eliges **Usar estos colores** o **Use this saved system**.

## Lee la evidencia de origen

Los detalles opcionales de la revisión de origen muestran tipografía, huecos, relleno y valores de esquina donde se observaron. El HTML/CSS guardado y las lecturas nativas de sitios web informan de declaraciones, que puede que la página renderizada no llegue a usar. La extensión de navegador puede informar de estilos medidos a partir de una muestra acotada de elementos visibles, con su viewport y su preferencia de color del navegador. Las extensiones más antiguas siguen funcionando con estilos declarados. Los campos que faltan dicen **Not observed**.

Esto son observaciones, no ajustes de estilo automáticos. Un escaneo de referencia no obtiene ni instala archivos de fuente, y el espaciado de origen no reemplaza el tuyo en silencio. Los recuentos describen apariciones en la muestra, no confianza ni calidad.

## Comprueba una composición contra el sistema de diseño

En Design, abre **Exportar**, luego **Antes de exportar**. La comprobación usa la misma versión efectiva del sistema de diseño que el render. Compara los colores creados, los alias de tokens, las fuentes elegidas y los ID de recursos de imagen. Los valores personalizados pueden ser intencionados; una imagen fuera de los recursos de marca declarados es un elemento a revisar, no una imagen prohibida.

Donde hay disponible una sugerencia concreta de color o fuente, su botón cambia esa única capa. El **Deshacer** normal restaura el valor original. Las capas bloqueadas o cambiadas no se sobrescriben con una sugerencia antigua. La evidencia de origen que falta se mantiene separada de una coincidencia. El contraste renderizado y la maquetación del texto se comprueban con las verificaciones ya integradas. Los degradados, los efectos, el contenido de herramientas anidadas, los derechos y la calidad subjetiva no se evalúan en la comparación de marca. Las comprobaciones no bloquean Descargar.

## Usa el contexto de diseño localmente

**Download design context** incluye el documento de tokens, los colores resueltos, las familias tipográficas declaradas, los ID de recursos, la evidencia de origen donde se registró, la cobertura y las reglas explícitas. No incluye archivos de fuente ni prueba de propiedad. La revisión de referencia también incluye sus tokens propuestos y sus observaciones.

La CLI puede leer cualquiera de las dos descargas sin un servidor:

```bash
lolly system import ./lolly-design-context.json
lolly system context --output=design-context.json
lolly system check ./design-inputs.json --file=design-context.json
```

`system check` acepta entradas de Design con un array `boxes` o un documento de Design compilado. Informa de las correcciones propuestas sin modificar la composición. No puede medir la maquetación del navegador ni el contraste renderizado. El recurso MCP existente **lolly://design-context** expone el contexto del sistema efectivo a través del proceso MCP local configurado; no se necesita ningún servicio alojado nuevo ni clave de API.
