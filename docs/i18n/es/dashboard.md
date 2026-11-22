# Ajustes

Settings contiene tus datos, tu design system, la accesibilidad, el almacenamiento en este dispositivo y las descargas para uso sin conexión. Abre **Settings** desde la barra al pie de la pantalla de inicio o desde el menú de tu avatar, y se abrirá en **Preferences**.

| Pestaña | Dirección | Qué contiene |
|---|---|---|
| **Preferences** | `#/settings` | Tus datos, design systems, apariencia, emoji, accesibilidad, conexiones, almacenamiento y descargas para uso sin conexión |
| **This device** | `#/settings?tab=device` | Una lectura en vivo de este navegador y equipo, además del sonido y una vista de solo lectura del almacenamiento |
| **Design system** | `#/settings?tab=brand` | El design system activo como portada y páginas, con una tira de portadas para cambiar de sistema |
| **Capabilities** | `#/settings?tab=caps` | Todo lo que puede hacer Lolly, en tarjetas que puedes buscar |
| **Activity & stats** | `#/settings?tab=activity` | El catálogo, tus contadores locales y el trabajo reciente |

Los enlaces antiguos `#/profile` y `#/d` siguen abriendo el lugar correcto, incluidos los ajustes individuales.

<!--i:eti-sliders-->
## Preferencias

Preferences es una única página larga con un **carril de ajustes** a un lado. El campo **Search settings**, encima del carril, lo filtra mientras escribes. Cada sección tiene un enlace con la forma `#/settings?focus=<section-id>`, como `#/settings?focus=storage-section`.

- <!--i:usercheck--> **Your details** - tu nombre, datos de contacto y foto de perfil, y el interruptor **Use my details to create**. [Perfiles](/info/profile.html) explica cómo los usan las herramientas.
- <!--i:seal--> **Content Credentials** - la identidad verificada opcional que firma tus exportaciones. Consulta [Content Credentials](/info/content-credentials-identity.html).
- <!--i:palette--> **Design systems** - cambia, añade, oculta o elimina design systems. [Lolly Design System Setup](/info/brand-studio.html#manage-your-design-systems) explica cada acción.
- <!--i:moon--> **Appearance** - el tema (Light, Dark o Brand, que pinta la aplicación con tu paleta), **Your colourway** cuando el design system ofrece más de una ([Haz tuya una colourway](/info/colourways.html#make-a-colourway-your-own)) e **Interface follows the design system**.
- <!--i:sparkle--> **Emoji** - el conjunto de emoji para el trabajo nuevo, con la licencia de sus ilustraciones, y la intensidad con la que tu paleta recolorea los emoji (**Off**, **Subtle**, **Strong**, **Full**, **Mono** o **Duotone**). **Keep skin tones and flags** deja esos elementos con sus propios colores. El trabajo que ya has creado conserva su conjunto.
- <!--i:eyeoff--> **Accessibility** - cuatro interruptores de comodidad, además de Sound y Neurospicy Mode. Consulta [Accesibilidad](#accessibility).
- <!--i:link--> **Connected services** - el almacenamiento que conectas, como Dropbox, Google Drive, OneDrive, Nextcloud o S3, y **Sync across devices**. Consulta [Sincroniza tus dispositivos](/info/sync.html).
- <!--i:globe--> **Trusted sites** - los sitios con los que un cuadro de página web de Lolly Design o una demostración de Lolly Sandbox puede contactar sin preguntar y, donde el servidor lo ofrece, **Allow pages from any site**. La [Política de privacidad](/info/privacy.html) enumera lo que envía cada solicitud.
- <!--i:download--> **Your renders** - **Save my renders to my library** conserva una copia de cada imagen, clip de audio y vídeo que descargas en Assets, con la etiqueta Renders.
- <!--i:database--> **Storage** - lo que Lolly guarda en este dispositivo y los botones que borran o trasladan tus datos. Consulta [Almacenamiento](#storage).
- <!--i:cpu--> **Available offline** - descarga lo que necesitas antes de perder la conexión. Consulta [Disponible sin conexión](#available-offline).
- <!--i:folder--> **Hot folder** - en la aplicación de escritorio, Lolly vigila una carpeta e incorpora todo lo que se suelta en ella, mediante el mismo selector que al arrastrar y soltar.
- <!--i:clock--> **Your activity** - lo que has creado en este dispositivo, contado localmente.
- <!--i:sliders--> **Feature flags** - activa o desactiva partes de la aplicación, como **Print preflight** o **Strip metadata from uploads**. **Performance UI** da a la aplicación un aspecto más sencillo que requiere menos recursos para dibujarse. Lolly puede activar Performance UI por sí solo en un dispositivo lento. La línea bajo el interruptor indica entonces cuándo y por qué, con **Allow again** ([cómo lo decide](/info/configuration.html#curating-what-people-see)).
- <!--i:server--> **Lolly instance** - de dónde obtiene esta instalación sus herramientas y catálogo. Consulta [Instancia de Lolly](#lolly-instance).

Las tarjetas de tema son vistas previas en vivo. Un tema se aplica en cuanto lo eliges, solo en este dispositivo.

![Tres tarjetas de tema, cada una con una vista previa de su tipografía y color, con la activa marcada](/t/url-shot?url=%2F%23%2Fsettings%3Ffocus%3Dappearance-section&width=1440&height=1400&dpi=192&waitMs=1600&walker=1&format=svg&cropSelector=.profile-card--appearance&dark=1&filename=pd-theme-picker)

### Accesibilidad

**Settings → Preferences → Accessibility** contiene cuatro ajustes de comodidad para la aplicación. Cada uno está desactivado hasta que lo activas y ninguno afecta al interior del lienzo de una herramienta ni a una exportación, así que una aplicación más tranquila nunca mueve un píxel del archivo que entregas. Cada uno está desactivado de forma predeterminada. Ninguno cambia el lienzo de una herramienta ni una exportación.

- <!--i:pause--> **Reduce motion** desactiva las transiciones, los deslizamientos y los adornos de la aplicación.
- <!--i:photos--> **Hide colourful previews** sustituye las ilustraciones de vista previa de la galería por tarjetas con icono y texto y atenúa las miniaturas de los proyectos, que siguen siendo reconocibles.
- <!--i:sliders--> **High contrast** refuerza los bordes, el texto y los contornos de foco de la aplicación. Tus colores de marca y el lienzo se quedan como los configuraste.
- <!--i:font--> **Large text** amplía las etiquetas, los menús y el texto de los botones de la aplicación.

**Dominant hand** (Right o Left) establece en qué lado aparecen los controles cuando Lolly muestra dos paneles, en un dispositivo plegable o una tableta casi cuadrada. **Swap sides** en el encabezado de un panel también cambia esto.

Estos ajustes se guardan en tu perfil, así que viajan en una exportación del perfil con tu nombre y tus sesiones. Una copia exclusiva del dispositivo los aplica antes del primer dibujado.

La misma tarjeta tiene **Sound**, sonidos suaves de asistencia para acciones como llegar a la galería, recibir un resultado de Content Credentials o cerrar un panel. También tiene **Neurospicy Mode**, una pista tranquila para concentrarte. Activar Neurospicy abre un pequeño reproductor en la esquina que te acompaña por toda la aplicación. En el reproductor puedes elegir una pista, saltar a otra, ajustar el volumen y minimizar o cerrar el reproductor. Las pistas incluyen las emisoras generadas de Lolly, bucles ambientales y ritmos, tu propio audio y emisoras de radio por internet, que necesitan conexión. Ambas opciones están desactivadas de forma predeterminada y se recuerdan. Desactivar Sound también silencia la pista de concentración. El menú del perfil y **This device** tienen el mismo interruptor.

Un deslizador bajo el interruptor Sound establece de qué se componen los sonidos. Hacia la forma redondeada **Bouba**, se convierten en gotas suaves, burbujas y un poco de graves. Hacia la estrella puntiaguda **Kiki**, se convierten en tics secos, raspados y metal. El centro conserva las campanillas y notas de Lolly. Si te cuesta soportar los sonidos de un extremo, muévelo hacia el otro. El deslizador funciona con Sound desactivado y, al soltarlo, se reproduce una muestra breve.

::: details Las emisoras generadas
Las emisoras generadas componen su música mientras suenan, sin muestras ni voces grabadas. Cada tema tiene sus propios instrumentos, ritmo y orden de reproducción.

- **Lolly Sings** es una familia de emisoras. La Lolly Sings original es luminosa y melódica: tonalidades mayores, una melodía principal en cada tema y matices de bossa, shuffle y chiptune. Cada género tiene también su propia emisora, desde Sugar y K-pop hasta Country, Jazz, Metal y D&B.
- Las **emisoras Lofi** (Warm, Late night y Rainy) son ritmos lo-fi sin fin.

En una emisora generada, siguiente y anterior cambian de tema. Cada tema procede de una semilla, así que suena igual dondequiera que lo compartas o guardes (consulta [Música generada](/info/generated-music.html)). Bajo los controles de reproducción, **Mood** cambia entre las emisoras Lofi, **Drums** quita la batería y **Texture** va desde un sonido limpio hasta un disco polvoriento. Después hay una fila de botones con iconos. Pasa el puntero por un botón o mantenlo pulsado para ver su nombre:

- La nota musical, **Open in the music generator**, abre el tema en `#/music`, donde puedes cambiar sus instrumentos sección por sección.
- El enlace, **Share this tune or moment**, ofrece un enlace que reproduce el mismo tema u otro que además empieza donde estás y muestra el visualizador con tu preajuste y colores actuales.
- La carpeta, **Save to library**, guarda el tema en tus recursos.
- El rayo, **Light visualiser**, es un interruptor que se describe a continuación.

Un tema guardado aparece en el grupo de su emisora, por tonalidad y tempo. Elegir el tema guardado vuelve a reproducir el mismo tema, repitiéndolo como cualquier pista o avanzando en el modo de avance. Solo guarda la emisora y el número del tema, unos pocos bytes, y la música se compone de nuevo mientras suena. Puedes renombrar o eliminar un tema guardado en tus recursos y usarlo como música de fondo de un vídeo. Lolly Demo y Lolly Start incluyen seis temas guardados cada uno.

El visualizador escucha todas las pistas a un nivel constante, así que una pista suave mueve la imagen tanto como una fuerte, a cualquier volumen. Cada género de Lolly Sings y los temas guardados de ese género ofrecen **Light visualiser**: barras de nivel sencillas que dejan a la música el tiempo de procesamiento que necesita. Light visualiser empieza activado en las pantallas táctiles y en los dispositivos con cuatro núcleos o menos o con 4 GB de memoria o menos.
:::

Puedes usar la interfaz con el teclado. Los controles personalizados llevan etiquetas para lectores de pantalla. La vista previa en vivo de cada herramienta es una única imagen con una etiqueta que describe lo que muestra.

### Almacenamiento

El medidor de almacenamiento muestra cada byte que guarda esta instalación, por categoría, comparado con lo que informa el navegador.

![El medidor de almacenamiento, que desglosa las sesiones guardadas, las imágenes y la caché frente a lo que realmente informa el navegador](/t/url-shot?url=%2F%23%2Fsettings%3Ffocus%3Dstorage-section&width=1440&height=1800&dpi=192&waitMs=2400&css=%5Bdata-store-group%3Dmove%5D%2C.storage-actions%2C.store-selbar%7Bdisplay%3Anone%7D&waitSelector=%5Bdata-store-group%3Dmove%5D&drive=click%3A%5Bdata-store-group%3Dwork%5D%3Esummary%3Bclick%3A%5Bdata-store-group%3Dcaches%5D%3Esummary&walker=1&format=svg&cropSelector=.store-meter&dark=1&filename=pd-storage-meter)

Bajo el medidor:

- **Move to another device** tiene **Export my data**, **Import data…** y **Export my data & render everything**. [Trasladar tu trabajo a otro dispositivo](/info/find-your-work.html#move-your-work-to-another-device) explica cada opción.
- **Clear cache** elimina los archivos del catálogo descargados, que se vuelven a descargar cuando hacen falta.
- **Remove automatic checkpoints older than 30 days** libera espacio de History y conserva las versiones guardadas y con nombre.
- **Clear all my data** elimina todo lo que Lolly guarda en este navegador, después de que escribas una palabra para confirmar. [Si borras los datos de tu navegador](/info/find-your-work.html#if-you-clear-your-browser-data) enumera lo que se elimina.

### Disponible sin conexión

Lolly solo almacena en caché las pantallas que has visitado. **Available offline** descarga las partes que necesitarás, con una única barra de progreso, y siguen funcionando sin conexión.

- <!--i:monitor--> **App, catalogue and guides** - **The app** (todas las vistas, editores y fuentes, incluidas las pantallas que nunca has abierto), el **Catalogue** (entero, o **Choose by tag**) y **Guides & docs** (esta documentación en tu idioma, con capturas de pantalla incluidas).
- <!--i:cpu--> **AI models** - cada modelo local en su propia fila con su tamaño: Speech voices, Upscaling models, Background removal, Text recognition, Lolly Verify deep scan, Durable credential, Rewriter model, Ask matching model, AI text detector y Singing voices. Un modelo de más de 50 MB lleva la marca **large download**.
- <!--i:wrench--> **Tools** - cada herramienta se descarga por separado, o **Download all** descarga todas las herramientas. Una marca de verificación indica que está lista para usarse sin conexión.

**Download everything**, en la parte superior, descarga la aplicación, la parte del catálogo que elegiste, las guías y todas las herramientas. Marca **Include all the AI models** para añadir los modelos, o descarga un modelo desde su propia fila. Las voces de canto solo se descargan desde su propia fila. La política de una organización puede desactivar las descargas de IA, y las filas lo indican.

Las descargas se reanudan donde se detuvieron si cancelas o pierdes la conexión. Al volver a conectarse, se actualizan y descargan solo lo que cambió en una versión. Si el navegador no ha concedido almacenamiento persistente, **Protect downloads** solicita ese permiso. Sin el permiso, el navegador puede borrar las descargas cuando necesite recuperar ese espacio.

### Instancia de Lolly

**Lolly instance** indica de dónde obtiene esta instalación sus herramientas y su catálogo: la dirección de una instancia, o *Bundled with this app* cuando todo viene incluido en la compilación.

- **Design-system source** muestra de dónde procede el design system incluido.
- **Instance console** abre las páginas de administración de una implementación, si las ofrece.
- **Change** conecta la aplicación de escritorio a otra instancia. Un navegador no puede cargar herramientas y recursos de otros orígenes, así que en la web la sección ofrece **Open a workspace**.
- **Leave** elimina el design system, las herramientas y el catálogo de la instancia. Tu propio trabajo se conserva. Consulta [Usar Lolly en tu organización](/info/organisation.html#leaving).
- Cuando has iniciado sesión en una organización, **Sign out** cierra esta sesión y **Sign out everywhere** cierra tus sesiones en todos los dispositivos, incluido este.

<!--i:eti-monitor-->
## Este dispositivo

- <!--i:monitor--> **This Machine** - pantalla, entrada, gráficos, memoria, códecs, sistema de almacenamiento y más, consultados en vivo en esta sesión. No se guarda ni se envía nada. En una pantalla ancha, este panel se abre solo y la pestaña usa dos columnas.
- <!--i:neurobeat--> **Sound** - los sonidos de la interfaz y los bucles de concentración Neurospicy. Sound es el único interruptor de esta pestaña que guarda algo.
- <!--i:database--> **Storage** - una vista de solo lectura del medidor. Borra o traslada tus datos en [Preferences](#storage).

<!--i:eti-palette-->
## Design system

El design system activo, presentado para su consulta. Cuando este navegador contiene dos o más design systems, una franja de portadas en la parte superior los enumera. Elige uno para activarlo. **Undo** en el aviso que aparece después restaura el anterior.

![La pestaña Design system en Lolly Demo: una franja de portadas para cambiar de sistema y luego la portada con su logo, nombre, nota y los recuentos que abren cada página](/t/url-shot?url=%2F%23%2Fsettings%3Ftab%3Dbrand&width=1440&height=900&dpi=192&waitMs=2400&format=svg&walker=1&dark=1&filename=settings-design-system)

La pestaña se abre en una portada con los colores del propio sistema, su logo, su nombre en su tipografía de títulos y la nota que escribió su autor. Una línea de recuentos en la portada enlaza a cada página:

- <!--i:palette--> **Colour** - la superficie, el texto, el color primario y el secundario de los aspectos claro y oscuro, cada color con nombre como un chip con su nombre y valor hexadecimal, una banda para cada escala de tintes y el espectro de gráficos, y los roles de color en una sección plegable. Selecciona un valor para copiar el hexadecimal.
- <!--i:font--> **Type** - Headings, Text, Emphasis y Code, cada uno compuesto con su propia tipografía.
- <!--i:photos--> **Logos** - cada archivo de logo sobre el fondo para el que se creó.
- <!--i:layers--> **Colourways** - el par claro y oscuro de cada colourway, cuando el sistema tiene más de una.
- <!--i:sliders--> **Tokens** - radio, espaciado, efectos y degradados.
- <!--i:document--> **Print & CMYK** - los colores fijados a una tinta exacta y las condiciones de impresión que puede declarar un PDF CMYK.

Cambiar de sistema es la única modificación que hace esta pestaña. Edita un design system en [Lolly Design System Setup](/info/brand-studio.html), en `#/start`, al que enlaza la portada. Un sistema de solo lectura lo indica en su portada. Los sistemas locales que creas siguen siendo editables. `/b` y `/brand` son enlaces cortos a esta pestaña.

<!--i:eti-grid-->
## Capacidades

Cada parte de la plataforma tiene una tarjeta, en doce grupos: Experiences, Platforms & runtimes, Accessibility & languages, Export formats, Import formats, Print production, Automation & AI, Determinism & reproducibility, Brand & design system, Privacy & data ownership, Security & access control y Architecture (para desarrolladores). Cada grupo se pliega y muestra su número de tarjetas. Una tarjeta abre un diálogo con las funciones de esa capacidad y, en aproximadamente la mitad de las tarjetas, la captura de pantalla que usa esta documentación.

El campo de búsqueda sobre los grupos filtra las tarjetas mientras escribes y abre los grupos que contienen una coincidencia. El campo muestra cuántas capacidades busca. Una consulta sin coincidencias lo indica con texto.

Esta pestaña documenta lo que Lolly puede hacer, al día con estas guías. No examina la máquina que estás usando; de eso se encarga **This device**.

<!--i:eti-gauge-->
## Actividad y estadísticas

Primero, la compilación: el número de herramientas cargadas, formatos de exportación, entornos en los que se ejecuta la plataforma y recursos de marca del catálogo. Un panel **Catalogue** desglosa lo que incluye esta compilación.

Después, tu propio trabajo: **Your activity** cuenta lo que has creado en este dispositivo. **Recent creations** y **Latest exports** son pilas que puedes recorrer deslizando el dedo, y aparecen cuando tienen contenido. Ambas abren un elemento tal como estaba. Estos contadores se quedan en el dispositivo. Una instancia opcional de Lolly Work mantiene sus propios [registros de telemetría y auditoría de la organización](/info/privacy.html#organisation-services-with-lolly-work).

<!--i:eti-link-->
## Enlaces directos

Cada pestaña y sección de Settings tiene su propio enlace para guardar en marcadores o pegar. [Lolly Search](/info/search.html) genera sus resultados de **Settings** a partir del mismo registro que Settings, así que cambiar el nombre de una sección nunca rompe un resultado de búsqueda.

::: details Todas las formas de enlace

- **Una pestaña:** `#/settings?tab=brand`, `#/settings?tab=caps`, `#/settings?tab=device`, `#/settings?tab=activity`.
- **Una sección de Preferences:** `#/settings?focus=<section-id>`, como `#/settings?focus=offline-section`.
- **Una sección exacta:** su id como indicador sin valor, como `#/settings?dash-storage`, `#/settings?dash-logos`, `#/settings?dash-colourways` o `#/settings?cap-formats`. Los enlaces antiguos `#/settings?dash-lock` y `#/settings?dash-palette-wheel` abren la portada y la página Colour.
- **Una sección por palabra clave:** `#/settings?print`, `#/settings?formats`, `#/settings?palette` (la página Colour) o `#/settings?tokens`. Dos secciones pueden compartir una palabra clave: `print` pertenece tanto a la referencia de impresión de la pestaña de marca como al grupo Print production, y se abre la primera en el orden de la página. Usa el id para elegir una.

Un enlace directo cambia a la pestaña que contiene el destino y abre cualquier grupo en el que esté plegado. Luego se desplaza al destino una vez que las secciones superiores terminan de distribuirse. Las direcciones retiradas `#/platform` y `#/capabilities` se abren en Settings con sus indicadores de enlace directo intactos.
:::

---

**Relacionado:** [Perfiles](/info/profile.html) para tus datos y los contextos en los que creas. [Lolly Design System Setup](/info/brand-studio.html) para editar lo que muestra la pestaña Design system. [Encontrar y recuperar tu trabajo](/info/find-your-work.html) para el almacenamiento, las copias de seguridad y el cambio de dispositivo.
