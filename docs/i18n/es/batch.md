# Batch y Multi-edit

Dos tareas surgen cuando creas a menudo el mismo tipo de archivo. A veces necesitas muchas versiones de un diseño: una tarjeta en una docena de idiomas, o cada tamaño de un banner. A veces tienes varios diseños guardados distintos y quieres que un cambio llegue a todos, como una fecha nueva o un titular nuevo.

**Batch** hace la primera tarea y **Multi-edit** la segunda. Ambos se ejecutan en tu dispositivo y exportan por el mismo camino de renderizado que las propias herramientas.

::: cols
## Batch

- Una plantilla, muchas filas. Cada fila es un conjunto de entradas y crea un archivo.
- Rellena las filas escribiendo, pegando desde una hoja de cálculo o importando un CSV.
- Sin límite de filas; se muestran 50 por página.
- Se abre desde **Batch** en el encabezado de Projects (`#/batch`).

## Multi-edit

- De dos a ocho diseños guardados distintos, lado a lado como tarjetas en vivo.
- Una barra lateral edita las entradas que comparten, y luego las propias de cada tarjeta.
- Cada diseño se guarda de nuevo donde estaba.
- Se abre desde **Edit together** en la barra de selección de Projects.
:::

## Crea muchas versiones de un diseño

Abre **Projects** y pulsa **Batch** en su encabezado. La cuadrícula empieza con una fila: elige en ella una plantilla, y luego duplica la fila o pega datos de tu hoja de cálculo. Si se abre desde dentro de una carpeta, Batch te devuelve a esa carpeta.

![Batch en una cuadrícula nueva: el nombre de archivo y las herramientas de fila arriba, y la lista de plantillas de la primera fila abierta con las herramientas que puedes elegir](/t/url-shot?url=%2F%23%2Fbatch&width=1440&height=900&dpi=192&waitMs=3500&walker=1&format=svg&dark=1&filename=use-batch-toolbar)

**Rellena las filas.** Escribe en una celda o pega un bloque directamente desde Excel, Google Sheets u otra hoja de cálculo. **Import CSV** añade filas o sustituye el lote. Cuando pegas en una celda que contiene ajustes de exportación, Lolly pregunta qué entrada rellena cada columna pegada. **Export CSV** vuelve a escribir la cuadrícula. Abre **Columns** bajo la cuadrícula para mostrar más entradas, o el ancho, alto, unidad y DPI de cada fila.

**Define la salida.** La barra de herramientas define el nombre de archivo del zip, el **Default format**, las unidades y los DPI de todas las filas. El menú de formato es la lista agrupada del panel de exportación, que muestra los formatos que ofrece el catálogo y que admite tu navegador. Una fila con su propio formato, tamaño o nombre de archivo conserva su propio ajuste.

**Render.** **Render all** exporta todas las filas en un único `.zip`. Selecciona antes las filas, y **Render selected**, **Export selected CSV** y **Print selected rows** actúan solo sobre ellas; borra la selección para volver a trabajar con todo el lote. **Print sheet** dispone las filas en una hoja imprimible. **Batch activity** informa de cada importación y renderizado, y se pliega para dar más espacio a la tabla.

**Conserva el lote.** **Sessions** guarda toda la cuadrícula como una sesión de lote con nombre, que se reabre más tarde desde Projects. Sessions siempre guarda todas las filas, sea cual sea la selección. **Folders…** en el mismo menú abre una carpeta entera de Projects como filas, una por sesión guardada, con cada nombre de archivo llevando la ruta de su carpeta.

::: details Seleccionar filas y celdas
Selecciona filas con sus casillas, o haz clic con Shift en una casilla para un rango. La casilla del encabezado selecciona la página actual, y **Select all *N* rows** incluye también las filas de otras páginas. Las selecciones se mantienen al cambiar de página. **Edit input**, **Duplicate** y **Remove** actúan sobre las filas seleccionadas, y **Undo remove** restaura las últimas filas eliminadas. Desde una celda enfocada, Shift+Espacio selecciona esa fila y Escape borra la selección.

Arrastra por las celdas, haz clic con Shift en una celda o usa Shift+flechas para seleccionar un rectángulo. **Copy cells**, o Ctrl+C / Command+C, copia los valores para una hoja de cálculo. Ctrl+A / Command+A desde una celda enfocada selecciona todas las columnas visibles de todas las páginas; desde una casilla de fila, el mismo atajo selecciona todas las filas. Seleccionar celdas deja marcadas las filas marcadas. Haz doble clic en una celda o pulsa Enter para editar su texto. Pega un rectángulo desde el portapapeles, o pega un valor para rellenar todas las celdas seleccionadas; las celdas en blanco y el texto multilínea mantienen sus posiciones.
:::

### Colourways y temas por fila

Cada fila conserva sus propias opciones de tema: claro u oscuro, y una colourway cuando el design system las tiene. Una fila abierta desde Projects, una carpeta o un lote guardado se renderiza con las opciones con que se guardó su sesión, y su vista previa se abre con ellas. La hoja de impresión, una fila duplicada y una fila rellenada las conservan todas.

Un CSV lleva las opciones en una columna `_themes` después de las columnas de tamaño, con el mismo JSON que el parámetro de enlace `_themes`, por ejemplo `{"":"dark","colourway":"beach"}`. Una celda en blanco, o `{}`, significa los valores predeterminados del design system. La columna se escribe solo cuando alguna fila tiene opciones, así que un lote sin ninguna exporta el mismo CSV que antes. Al importar, una celda que no son opciones de tema válidas se enumera como incidencia y su fila se renderiza con los valores predeterminados. La cuadrícula aún no tiene un control para cambiar las opciones de una fila, así que defínelas en el CSV o en la sesión guardada.

### Batch, o Render folder

Batch crea muchas variantes de una plantilla. Para volver a renderizar sesiones que ya guardaste, selecciónalas en Projects y usa **Render selection**, o **Render folder** para una carpeta entera; [Find and recover your work](/info/find-your-work.html#find-something-you-saved) cubre ambas.

## Edita varios diseños guardados juntos

Marca entre dos y ocho sesiones guardadas en **Projects** y elige **Edit together** en la barra de selección. Se abren lado a lado como tarjetas en vivo en `#/multi?s=<slot>,<slot>…`. Cada tarjeta es un renderizado real de su sesión, así que lo que ves es lo que se exportará.

Una barra lateral los maneja a todos:

- <!--i:sliders--> **Shared** va primero: cada entrada que dos o más de las sesiones declaran del mismo modo (mismo ID, mismo tipo, mismas restricciones, la regla que usa la cuadrícula de lotes para sus columnas). Edita un control compartido una vez y el valor llega a todas las sesiones que declaran la entrada, en vivo en cada tarjeta. Dos sesiones de la misma herramienta lo comparten todo; dos herramientas distintas comparten solo las entradas que tienen en común.
- <!--i:document--> Debajo, **una tarjeta plegada por sesión** contiene todas las entradas propias de esa sesión, tan completas como la barra lateral de la propia herramienta, con un bloque de exportación compacto: **Format**, **W** / **H**, **Unit**, **DPI** y **Download**. Ese Download guarda primero la sesión y luego renderiza el archivo con el mismo nombre de archivo, formato y Content Credentials que tendría desde la herramienta.
- <!--i:search--> **Filter inputs…** en la parte superior reduce los controles de todas las tarjetas a la vez, para que llegues a "el titular" en ocho sesiones sin desplazarte.

Haz clic en cualquier tarjeta (o pulsa Enter sobre ella) para abrir la tarjeta de la barra lateral de esa sesión. **Save all** escribe cada sesión de nuevo en su propio espacio. **Download all** guarda primero, y luego renderiza todo el conjunto en un zip, igual que **Render selection** en Projects, con el bloqueo opcional por contraseña ofrecido por el camino.

Cada tarjeta se dibuja con las opciones de tema de su propia sesión, incluida una herramienta colocada dentro del diseño. Las tarjetas con aspectos distintos se sitúan lado a lado mientras la aplicación a su alrededor conserva sus propios colores, y **Save all**, las descargas, **Batch grid** y **Send to Print Sheet** conservan las opciones de cada sesión.

### Límites

- **Ocho como máximo.** Cada tarjeta monta su propio runtime en vivo, y ocho es el número que se mantiene ágil. Un enlace que pide más, o una sesión que ya no existe, lo dice en lugar de cargar a medias.
- **El enlace es local.** Nombra tus propios espacios guardados, así que reabre ese conjunto en este dispositivo. No es un enlace para compartir.
- **Para algo más grande,** elige **Edit as sheet** en la misma barra de selección. Abre toda la selección como filas en la cuadrícula de lotes (`#/batch?s=…`), sin límite de tamaño y sin la regla de la misma herramienta. Las carpetas quedan fuera de ambos: abre una carpeta en la cuadrícula con **Sessions → Folders…**, o renderiza una con **Render folder** en Projects.
- **La búsqueda no llega a Multi-edit.** Es la única vista que la barra de búsqueda no conoce.

## A dónde ir ahora

- **[Export a file](/info/exporting.html)**: los formatos, tamaños y ajustes de impresión que puede usar cada fila.
- **[Templates](/info/templates.html)**: puntos de partida que hacen una buena primera fila.
- **[Find and recover your work](/info/find-your-work.html)**: Projects, carpetas y renderizar lo que guardaste.
