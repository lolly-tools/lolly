# Lolly Batch y Lolly Multi-edit

<a id="batch-and-multi-edit"></a>

**Lolly Batch** crea muchas versiones de un diseño, como una tarjeta en una docena de idiomas o todos los tamaños de un banner. **Lolly Multi-edit** aplica un cambio, como una fecha o un titular nuevos, a varios diseños guardados distintos.

Ambos se ejecutan en tu dispositivo y exportan por el mismo camino de renderizado que las herramientas.

::: cols
## Batch

- Una plantilla, muchas filas. Cada fila es un conjunto de entradas y crea un archivo.
- Rellena las filas escribiendo, pegando desde una hoja de cálculo o importando un CSV.
- Sin límite de filas; se muestran 50 por página.
- Se abre desde **Lolly Batch** en el encabezado de Projects (`#/batch`).

<a id="multi-edit"></a>
## Lolly Multi-edit

- Entre dos y ocho diseños guardados distintos, uno al lado del otro como tarjetas en vivo.
- Una barra lateral edita las entradas que comparten y luego las propias de cada tarjeta.
- Cada diseño se guarda en su ubicación de origen.
- Se abre desde **Edit together** en la barra de selección de Projects.
:::

<!--i:eti-table-->
## Crea muchas versiones de un diseño

Abre la vista **Projects** y pulsa **Batch** en su encabezado. La cuadrícula empieza con una fila. Elige una plantilla en esa fila y luego duplica la fila o pega datos desde una hoja de cálculo. Si lo abres desde una carpeta, Batch te devuelve a esa carpeta.

![Batch en una cuadrícula nueva: el nombre de archivo y las herramientas de filas arriba, y la lista de plantillas de la primera fila abierta con las herramientas que puedes elegir](/t/url-shot?url=%2F%23%2Fbatch&width=1440&height=900&dpi=192&waitMs=3500&walker=1&format=svg&dark=1&filename=use-batch-toolbar)

**Rellena las filas.** Escribe en una celda o pega un bloque desde Excel, Google Sheets u otra hoja de cálculo. **Import CSV** añade filas o sustituye el lote. Cuando pegas en una celda que contiene ajustes de exportación, Lolly pregunta qué entrada rellena cada columna pegada. **Export CSV** exporta la cuadrícula. Abre **Columns** bajo la cuadrícula para mostrar más entradas, o el ancho, alto, unidad y DPI de cada fila. El menú emergente **Fill** de una columna de números, texto u opciones también tiene una sección **Design token** que vincula un token en todas las filas de la columna ([Vincular muchos documentos a la vez](/info/token-workflows.html#link-many-documents-at-once)).

**Define la salida.** La barra de herramientas fija el nombre del archivo zip, el **Default format**, las unidades y los DPI para todas las filas. El menú de formatos es la lista agrupada del panel de exportación con los formatos que ofrece el catálogo y admite tu navegador. Una fila con su propio formato, tamaño o nombre de archivo conserva su ajuste.

**Renderiza.** **Render all** exporta todas las filas a un único `.zip`. Con filas seleccionadas, **Render selected**, **Export selected CSV** y **Print selected rows** actúan solo sobre esas filas. Borra la selección para volver a trabajar con todo el lote. **Print sheet** distribuye las filas en una hoja imprimible. **Batch activity** informa de cada importación y renderizado, y se puede plegar.

**Conserva el lote.** **Sessions** guarda todas las filas de la cuadrícula como una sesión de lote con nombre, sea cual sea la selección. La sesión se vuelve a abrir desde Projects. **Folders…**, en el mismo menú, abre una carpeta de Projects como filas, una por sesión guardada; cada nombre de archivo lleva la ruta de su carpeta.

::: details Seleccionar filas y celdas
Selecciona filas con sus casillas, o haz clic en una casilla con Shift para seleccionar un rango. La casilla del encabezado selecciona la página actual, y **Select all *N* rows** incluye también las filas de otras páginas. Las selecciones se mantienen al cambiar de página. **Edit input**, **Duplicate** y **Remove** actúan sobre las filas seleccionadas, y **Undo remove** restaura las últimas filas eliminadas. Desde una celda con el foco, Shift+Space selecciona esa fila y Escape borra la selección.

Arrastra sobre las celdas, haz clic en una celda con Shift o usa Shift+teclas de flecha para seleccionar un rectángulo. **Copy cells**, o Ctrl+C / Command+C, copia los valores para una hoja de cálculo. Ctrl+A / Command+A desde una celda con el foco selecciona todas las columnas visibles de todas las páginas; desde la casilla de una fila, el mismo atajo selecciona todas las filas. Seleccionar celdas mantiene marcadas las filas marcadas. Haz doble clic en una celda o pulsa Enter para editar su texto. Pega un rectángulo desde el portapapeles, o pega un valor para rellenar todas las celdas seleccionadas; las celdas vacías y el texto de varias líneas conservan sus posiciones.
:::

### Colourways y temas por fila

Cada fila conserva sus propias opciones de tema: claro u oscuro, y una colourway cuando el design system las tiene. Una fila abierta desde Projects, una carpeta o un lote guardado se renderiza y se muestra en la vista previa con las opciones con las que se guardó su sesión. La hoja de impresión, una fila duplicada y una fila rellenada las conservan.

Un CSV lleva las opciones en una columna `_themes` después de las columnas de tamaño. La columna tiene el mismo JSON que el parámetro de enlace `_themes`, por ejemplo `{"":"dark","colourway":"beach"}`. Una celda vacía, o `{}`, indica los valores predeterminados del design system. La columna solo se escribe cuando alguna fila tiene opciones. Al importar, una celda que no contiene opciones de tema válidas se enumera como un problema y su fila se renderiza con los valores predeterminados.

::: note Define las opciones de una fila en el CSV
La cuadrícula aún no tiene un control para cambiar las opciones de una fila, así que defínelas en el CSV o en la sesión guardada.
:::

### Un idioma para cada fila

Una herramienta que imprime su propio texto, como Certificate, puede aceptar una columna `language` con un código corto de idioma como `de`, `ja` o `ar`. Cada fila imprime entonces su texto y su fecha en ese idioma. Las filas en árabe y urdu se disponen de derecha a izquierda. Una celda vacía sigue el idioma de la aplicación. Un idioma para el que Lolly aún no tiene traducción imprime en inglés, incluida la fecha, así que un certificado nunca queda a medio traducir.

### Batch o Render folder

Para volver a renderizar sesiones que ya has guardado, selecciónalas en Projects y usa **Render selection**, o **Render folder** para una carpeta entera. [Encontrar y recuperar tu trabajo](/info/find-your-work.html#find-something-you-saved) explica ambas opciones.

<!--i:eti-layers-->
## Edita varios diseños guardados juntos

Marca entre dos y ocho sesiones guardadas en **Projects** y elige **Edit together** en la barra de selección. Se abren una al lado de la otra como tarjetas en vivo en `#/multi?s=<slot>,<slot>…`. Cada tarjeta es un renderizado real de su sesión y muestra lo que se exportará.

Una barra lateral las controla todas:

- <!--i:sliders--> **Shared** va primero: todas las entradas que dos o más sesiones declaran de la misma forma (mismo id, tipo y restricciones, la regla que usa la cuadrícula de lotes para sus columnas). Un cambio en un control compartido llega a todas las sesiones que declaran la entrada, en vivo en cada tarjeta. Dos sesiones de la misma herramienta lo comparten todo; dos herramientas distintas solo comparten sus entradas comunes. El menú **Input actions** de la tarjeta Shared vincula un token de diseño en cada sesión que declara la entrada.
- <!--i:document--> Bajo la tarjeta Shared, **una tarjeta plegada por sesión** contiene todas las entradas propias de esa sesión, como en la barra lateral de la herramienta, con un bloque de exportación compacto: **Format**, **W** / **H**, **Unit**, **DPI** y **Download**. Ese Download guarda primero la sesión y luego renderiza el archivo con el mismo nombre, formato y Content Credentials que tendría desde la herramienta.
- <!--i:search--> **Filter inputs…**, arriba, filtra los controles de todas las tarjetas a la vez.

Haz clic en cualquier tarjeta (o pulsa Enter sobre ella) para abrir la tarjeta de esa sesión en la barra lateral. **Save all** guarda cada sesión en su propia ubicación. **Download all** guarda primero y luego renderiza el conjunto en un único zip, como hace **Render selection** en Projects, y ofrece el bloqueo opcional con contraseña.

Cada tarjeta se dibuja con las opciones de tema de su propia sesión, incluida una herramienta colocada dentro del diseño. La aplicación alrededor de las tarjetas conserva sus propios colores. **Save all**, las descargas, **Batch grid** y **Send to Print Sheet** conservan las opciones de cada sesión.

### Límites

- **Ocho como máximo.** Cada tarjeta carga su propio entorno de ejecución en vivo, y ocho tarjetas siguen respondiendo con fluidez. Un enlace que pide más, o una sesión que ya no existe, lo indica y no se carga a medias.
- **El enlace es local.** Identifica tus propias ubicaciones guardadas y vuelve a abrir ese conjunto en este dispositivo. No es un enlace para compartir.
- **Para algo mayor,** elige **Edit as sheet** en la misma barra de selección. Abre la selección como filas en la cuadrícula de lotes (`#/batch?s=…`), sin límite de tamaño ni requisito de usar la misma herramienta. Las carpetas quedan fuera de ambos: abre una carpeta en la cuadrícula con **Sessions → Folders…**, o renderiza una con **Render folder** en Projects.
- **La búsqueda no llega a Lolly Multi-edit.** Es la única vista que no cubre la barra de búsqueda.

<!--i:eti-map-pin-->
## Por dónde seguir

- **[Exportar un archivo](/info/exporting.html)**: los formatos, tamaños y ajustes de impresión que puede usar cada fila.
- **[Plantillas](/info/templates.html)**: puntos de partida que sirven como primera fila.
- **[Encontrar y recuperar tu trabajo](/info/find-your-work.html)**: Projects, carpetas y renderizar lo que guardaste.
