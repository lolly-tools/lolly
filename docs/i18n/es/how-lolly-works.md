# Cómo funciona Lolly

Una herramienta de Lolly contiene las reglas para un tipo de archivo: el diseño, la tipografía, los colores y qué partes pueden cambiar otras personas. Tú, un colega, un script o un agente de IA rellenáis los campos y todos los archivos siguen esas reglas.

<!--i:eti-repeat-->
## Una herramienta, tus reglas, muchos archivos

Las reglas de marca están en la herramienta. Configura la herramienta una vez y cada resultado tendrá la misma tipografía, color y espaciado, desde una tarjeta hasta una hoja de cálculo con filas en una docena de idiomas.

![Una herramienta de logotipo tipográfico con un campo rellenado: la tipografía, el color y el espaciado se fijaron al crear la herramienta](/info/shots/aud-rules-in-the-tool.svg)

Quien crea el archivo número cien solo escribe las palabras. Tú decides cómo se revisa el trabajo y quién lo revisa. Lolly deja menos cosas por revisar y agiliza la creación del siguiente archivo.

<!--i:eti-users-->
## Quién usa una herramienta

Tres roles de una organización trabajan en una misma tarjeta de campaña.

![Un diseñador fija las reglas una vez en una herramienta; un desarrollador la ejecuta desde un script y cualquiera puede rellenar sus campos; ambos crean archivos terminados](/info/diagrams/concepts/asset-relay.svg)

::: timeline
- <!--i:pentool--> **Un diseñador fija las reglas.** Diseña la tarjeta en Lolly Design con la tipografía y los colores de la marca y elige qué campos quedan abiertos. Lo hace una vez, así que nadie vuelve a adaptar la tarjeta a mano para cada idioma.
- <!--i:code--> **Un desarrollador amplía el alcance de la herramienta.** La misma herramienta se ejecuta cada noche en un script a través de la línea de comandos. Llega un gráfico actualizado o una versión en otro idioma sin que nadie vuelva a abrir el diseño.
- <!--i:people--> **Cualquiera la rellena.** Un comercial en un avión, sin conexión ni formación en diseño, abre la herramienta y crea la tarjeta para la reunión de mañana.
:::

El gráfico actualizado del desarrollador es un renderizado como este, creado a partir de una cadena de datos y unos pocos ajustes:

![Un gráfico de áreas apiladas con título y sus tres series en franjas de una paleta fría, con los ejes, la leyenda y el título colocados por la plantilla en lugar de a mano](/t/url-shot?url=%2F%23%2Ftool%2Fchart%3FchartType%3Darea%26stackMode%3Dstacked%26palette%3Dcool%26heading%3DProduct%2520mix%2520by%2520quarter%26full&width=1440&height=900&dpi=192&waitMs=2600&walker=1&format=svg&cropSelector=%23tool-canvas&dark=1&filename=ov2-lifecycle-chart)

El minuto que tarda el comercial depende de las reglas del diseñador y del script del desarrollador. Cada rol trabaja con la misma herramienta.

<!--i:eti-train-->
## Cuatro caminos para crear un archivo

Todos los caminos ejecutan el mismo motor con la misma herramienta, así que el archivo que crea un script coincide con el que ves en la vista previa de la aplicación.

![Los parámetros de URL y los argumentos de línea de comandos se convierten en el mismo modelo de entrada, que pasa por un entorno de ejecución y un puente de exportación compartidos](/info/diagrams/concepts/one-render-path.svg)

- <!--i:people--> **En la aplicación, de uno en uno.** Abre una herramienta, rellena los campos y pulsa **Export**. [Crea tu primer archivo](/info/make-something.html) te guía para crear uno.
- <!--i:layers--> **En la aplicación, muchos a la vez.** [Lolly Batch](/info/batch.html#make-many-versions-of-one-design) (`#/batch`) toma una tabla pegada o importada y renderiza un archivo terminado por fila.
- <!--i:cpu--> **Desde un script o un agente de IA.** La [CLI](/info/cli.html) ejecuta una herramienta sin interfaz gráfica y el [servidor MCP](/info/mcp.html) permite a un agente descubrir y ejecutar herramientas. El enlace a una herramienta también contiene sus entradas, así que un enlace es una petición completa.
- <!--i:server--> **A través del servidor de tu organización.** [Lolly Work](/info/organisation.html) renderiza en el servidor conforme a las políticas de inicio de sesión y herramientas de tu organización, conserva tareas que puede reanudar y guarda el resultado para su descarga o entrega aprobada.

El camino que puede seguir una tarea depende de los formatos de la herramienta y de las capacidades del entorno donde se ejecuta. Algunos formatos necesitan un navegador, así que la línea de comandos los pasa a una capa de navegador. [Renderizar con la CLI](/info/cli-rendering.html) enumera dónde se renderiza cada formato.

<!--i:eti-monitor-->
## Qué se ejecuta dónde

La creación, la edición y la exportación se ejecutan en tu dispositivo, sin cuenta. Una función que necesita un servidor, como Sync o enviar un archivo a un servicio conectado, solo se conecta cuando la usas. Con Lolly Work, los proyectos compartidos, la edición de equipo en vivo, las aprobaciones y las tareas de servidor usan el servidor de tu organización. [Qué se ejecuta dónde](/info/compare.html#what-runs-where) compara ambas partes.

<!--i:eti-graduation-cap-->
## Qué leer después

- [Crea tu primer archivo](/info/make-something.html), para probarlo ahora.
- [Empezar](/info/quickstart.html), para incorporar tu propio design system.
- [Automatizar](/info/builders.html), para la línea de comandos, los enlaces y los agentes.
- [Arquitectura de Lolly](/info/overview.html), para colaboradores: el motor, las interfaces y las reglas que los mantienen unidos.
