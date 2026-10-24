# Cómo funciona Lolly

Una herramienta de Lolly guarda las reglas de un tipo de archivo: el diseño, la tipografía, los colores y qué partes pueden cambiar otras personas. Tú, un colega, un script o un agente de IA rellenáis los campos, y cada archivo sale bien. Esta página muestra quién hace qué, y las cuatro rutas de una herramienta a un archivo terminado.

## Una herramienta, tus reglas, muchos archivos

Las reglas de marca viven en la herramienta, no en cada archivo que crea. Si la herramienta queda bien una vez, cada resultado hereda la misma tipografía, color y espaciado, ya sea una tarjeta o una hoja de cálculo de filas en una docena de idiomas.

![Una herramienta de logotipo con un campo rellenado: la tipografía, el color y el espaciado se fijaron cuando se creó la herramienta](/info/shots/aud-rules-in-the-tool.svg)

Quien hace el archivo número cien solo escribe las palabras. Cómo se revisa el trabajo, y quién lo revisa, sigue siendo decisión tuya. Lolly reduce lo que merece revisarse y acelera el siguiente archivo.

## Quién toca una herramienta

Sigue una tarjeta de campaña por una organización y aparecen tres pares de manos. Cada una se apoya en la anterior.

![Un diseñador fija las reglas una vez en una herramienta; un desarrollador la ejecuta desde un script y cualquiera puede rellenar sus campos; ambos crean archivos terminados](/info/diagrams/concepts/asset-relay.svg)

::: timeline
- <!--i:pentool--> **Un diseñador fija las reglas.** Maqueta la tarjeta en Design con la tipografía y los colores de la marca, y luego elige qué campos quedan abiertos. Lo hace una vez, así que nadie vuelve a localizar la tarjeta a mano.
- <!--i:code--> **Un desarrollador escala la herramienta.** La misma herramienta se ejecuta en un script nocturno desde la línea de comandos, de modo que llega un gráfico nuevo o una versión en otro idioma sin que nadie reabra el diseño.
- <!--i:people--> **Cualquiera la rellena.** Un comercial en un avión, sin red y sin formación en diseño, abre la herramienta y crea la tarjeta para la reunión de mañana.
:::

El gráfico nuevo del paso del desarrollador es un renderizado como este, creado a partir de una cadena de datos y unos pocos ajustes sin que nadie abra un archivo de diseño:

![Un gráfico de áreas apiladas con título, sus tres series en bandas de una paleta fría, con ejes, leyenda y título colocados por la plantilla y no a mano](/t/url-shot?url=%2F%23%2Ftool%2Fchart%3FchartType%3Darea%26stackMode%3Dstacked%26palette%3Dcool%26heading%3DProduct%2520mix%2520by%2520quarter%26full&width=1440&height=900&dpi=192&waitMs=2600&walker=1&format=svg&cropSelector=%23tool-canvas&dark=1&filename=ov2-lifecycle-chart)

El minuto fácil del comercial solo es posible gracias al cuidado del diseñador y al script del desarrollador. Cada rol trabaja con la misma herramienta, en lugar de un producto distinto para cada uno.

## Cuatro rutas hacia un archivo

Cada ruta ejecuta el mismo motor sobre la misma herramienta, así que el archivo que crea un script coincide con el que previsualizas en la aplicación.

![Los parámetros de URL y los argumentos de línea de comandos se convierten en el mismo modelo de entradas, ejecutado por un único runtime y puente de exportación](/info/diagrams/concepts/one-render-path.svg)

- <!--i:people--> **En la aplicación, de una en una.** Abre una herramienta, rellena los campos y pulsa **Export**. [Make your first file](/info/make-something.html) te guía por una.
- <!--i:layers--> **En la aplicación, muchas a la vez.** [Batch](/info/batch.html#make-many-versions-of-one-design) (`#/batch`) toma una tabla pegada o importada y crea un archivo terminado por fila.
- <!--i:cpu--> **Desde un script o un agente de IA.** La [CLI](/info/cli.html) ejecuta una herramienta sin interfaz, y el [servidor MCP](/info/mcp.html) permite que un agente descubra y ejecute herramientas. Un enlace a una herramienta también lleva sus entradas, así que un enlace es una solicitud completa.
- <!--i:server--> **A través del servidor de tu organización.** [Lolly Work](/info/organisation.html) renderiza en el servidor con el inicio de sesión y la política de herramientas de tu organización, mantiene trabajos que puede reanudar y conserva el resultado para descargarlo o entregarlo de forma aprobada.

La ruta que puede usar un trabajo depende de los formatos de la herramienta y de lo que pueda hacer el host: algunos formatos necesitan un navegador, así que la línea de comandos los pasa a un nivel de navegador. [Render with the CLI](/info/cli-rendering.html) enumera qué formatos se renderizan dónde.

## Qué se ejecuta dónde

Crear, editar y exportar se ejecutan en tu dispositivo, sin cuenta. Una función que necesita un servidor, como Sync o enviar un archivo a un servicio conectado, solo se conecta cuando usas esa función. Con Lolly Work, los proyectos compartidos, la edición en equipo en vivo, las aprobaciones y los trabajos de servidor usan el servidor de tu organización. [What runs where](/info/compare.html#what-runs-where) pone las dos partes lado a lado.

## Qué leer después

- [Make your first file](/info/make-something.html), para probarlo ahora.
- [Start](/info/quickstart.html), para poner tu propio design system.
- [Automate](/info/builders.html), para la línea de comandos, los enlaces y los agentes.
- [Lolly architecture](/info/overview.html), para quienes contribuyen: el motor, los shells y las reglas que los mantienen unidos.
