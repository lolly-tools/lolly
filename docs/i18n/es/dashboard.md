# Ajustes

Settings es donde cambias cómo funciona Lolly para ti: tus datos, el design system que usas, la accesibilidad, lo que se almacena en este dispositivo y lo que está listo sin conexión. Ábrelo con **Settings** en la barra al pie de la pantalla de inicio, o desde el menú de tu avatar. Se abre en **Preferences**, con otras cuatro pestañas a su lado.

| Pestaña | Dirección | Qué contiene |
|---|---|---|
| **Preferences** | `#/settings` | Tus datos, design systems, apariencia, emojis, accesibilidad, conexiones, almacenamiento y descargas sin conexión |
| **This device** | `#/settings?tab=device` | Una lectura en vivo de este navegador y máquina, además de sonido y una vista de almacenamiento de solo lectura |
| **Design system** | `#/settings?tab=brand` | El design system activo como portada y páginas, con una tira de portadas para cambiar de sistema |
| **Capabilities** | `#/settings?tab=caps` | Todo lo que puede hacer Lolly, como tarjetas con búsqueda |
| **Activity & stats** | `#/settings?tab=activity` | El catálogo, tus contadores locales y el trabajo reciente |

Cada pestaña tiene su propia dirección, y los antiguos enlaces `#/profile` y `#/d` siguen abriendo el lugar correcto, hasta cada ajuste concreto.

## Preferences

Preferences es una página larga con un **carril de ajustes** a un lado y un campo **Search settings** sobre el carril que lo filtra mientras escribes. Cada sección se abre directamente desde un enlace con la forma `#/settings?focus=<section-id>`, por ejemplo `#/settings?focus=storage-section`.

- <!--i:usercheck--> **Your details** - tu nombre, datos de contacto y foto, y el interruptor **Use my details to create**. [Profiles](/info/profile.html) explica cómo los usan las herramientas.
- <!--i:seal--> **Content Credentials** - la identidad verificada opcional que firma tus exportaciones. Consulta [Content Credentials](/info/content-credentials-identity.html).
- <!--i:palette--> **Design systems** - cambia, añade, oculta o elimina design systems. [Design System Setup](/info/brand-studio.html#manage-your-design-systems) cubre cada acción.
- <!--i:moon--> **Appearance** - el tema (Light, Dark o Brand, que pinta la aplicación con tu paleta) e **Interface follows the design system**.
- <!--i:sparkle--> **Emoji** - el conjunto con el que se dibujan tus emojis cuando empiezas algo nuevo, con su licencia de arte, y con qué intensidad tu paleta los recolorea (**Off**, **Subtle**, **Strong**, **Full**, **Mono** o **Duotone**). **Keep skin tones and flags** los deja con sus propios colores. El trabajo que ya hiciste conserva el conjunto con el que se hizo.
- <!--i:eyeoff--> **Accessibility** - cuatro interruptores de comodidad, además de Sound y Neurospicy Mode. Consulta [Accessibility](#accessibility).
- <!--i:link--> **Connected services** - almacenamiento que conectas, como Dropbox, Google Drive, OneDrive, Nextcloud o S3, y **Sync across devices**. Consulta [Sync your devices](/info/sync.html).
- <!--i:globe--> **Trusted sites** - los sitios con los que un cuadro de página web de Design o una demo de Sandbox puede contactar sin preguntar y, donde el servidor lo ofrece, **Allow pages from any site**. La [Privacy Policy](/info/privacy.html) enumera lo que envía cada solicitud.
- <!--i:download--> **Your renders** - **Save my renders to my library** guarda en Assets, con la etiqueta Renders, una copia de cada imagen, clip de audio y vídeo que descargas.
- <!--i:database--> **Storage** - lo que Lolly guarda en este dispositivo, y los botones que borran o trasladan tus datos. Consulta [Storage](#storage).
- <!--i:cpu--> **Available offline** - descarga lo que necesites antes de perder la conexión. Consulta [Available offline](#available-offline).
- <!--i:folder--> **Hot folder** - en la aplicación de escritorio, vigila una carpeta y lleva a Lolly todo lo que se suelte en ella, mediante el mismo selector que recibe un arrastrar y soltar.
- <!--i:clock--> **Your activity** - lo que has creado en este dispositivo, contado en local.
- <!--i:sliders--> **Feature flags** - activa o desactiva partes de la aplicación, como **Print preflight** o **Strip metadata from uploads**.
- <!--i:server--> **Lolly instance** - de dónde obtiene esta instalación sus herramientas y su catálogo. Consulta [Lolly instance](#lolly-instance).

Las tarjetas de tema son vistas previas en vivo y se aplican en el momento en que eliges una, solo en este dispositivo.

![Tres tarjetas de tema, cada una mostrando su propio tipo y color, con la activa marcada](/t/url-shot?url=%2F%23%2Fsettings%3Ffocus%3Dappearance-section&width=1440&height=1400&dpi=192&waitMs=1600&walker=1&format=svg&cropSelector=.profile-card--appearance&dark=1&filename=pd-theme-picker)

### Accessibility

**Settings → Preferences → Accessibility** contiene cuatro ajustes de comodidad para la aplicación que rodea tu trabajo. Cada uno está desactivado hasta que lo activas, y ninguno llega al interior del lienzo de una herramienta ni de una exportación, así que una aplicación más tranquila nunca mueve un píxel del archivo que entregas.

- <!--i:pause--> **Reduce motion** desactiva las transiciones, los deslizamientos y los adornos de la aplicación. Tu lienzo y cualquier exportación animada siguen moviéndose como se diseñó.
- <!--i:photos--> **Hide colourful previews** cambia las ilustraciones de vista previa de la galería por tarjetas tranquilas de icono y texto, y atenúa las miniaturas de los proyectos para que sigan siendo reconocibles sin gritar.
- <!--i:sliders--> **High contrast** refuerza los bordes, el texto y los anillos de foco de la aplicación. Los colores de tu marca y el lienzo se quedan como los definiste.
- <!--i:font--> **Large text** agranda las etiquetas, los menús y el texto de los botones de la aplicación. La tipografía dentro de tus diseños no se toca, así que nada de lo que exportas se reajusta.

Estos ajustes viven en tu perfil, así que viajan en una exportación del perfil y llegan a la siguiente instalación con tu nombre y tus sesiones. Una pequeña copia solo del dispositivo los aplica antes del primer pintado.

La misma tarjeta contiene **Sound**, una capa suave de sonidos de apoyo para lo que haces (llegar a la galería, un resultado de Content Credentials, cerrar un panel), y **Neurospicy Mode**, una pista tranquila para concentrarte. Activar Neurospicy abre un pequeño reproductor en la esquina que te sigue por la aplicación. Allí eliges una pista, saltas, ajustas el volumen y minimizas o cierras el reproductor. Las pistas incluyen melodías procedimentales de *Lolly Sings*, bucles ambientales y ritmos, tu propio audio y emisoras de radio por internet, que necesitan conexión. Ambos están desactivados por defecto y se recuerdan, y desactivar Sound silencia también la pista de concentración. El menú del perfil y **This device** llevan el mismo interruptor.

La interfaz se puede navegar con el teclado, los controles personalizados llevan etiquetas para lectores de pantalla y la vista previa en vivo de cada herramienta se expone como una imagen con etiqueta que describe lo que muestra.

### Storage

El medidor de almacenamiento contabiliza cada byte que guarda esta instalación, categoría por categoría, frente a lo que informa el navegador.

![El medidor de almacenamiento, desglosando sesiones guardadas, imágenes y caché frente a lo que realmente informa el navegador](/t/url-shot?url=%2F%23%2Fsettings%3Ffocus%3Dstorage-section&width=1440&height=1800&dpi=192&waitMs=2400&css=%5Bdata-store-group%3Dmove%5D%2C.storage-actions%2C.store-selbar%7Bdisplay%3Anone%7D&waitSelector=%5Bdata-store-group%3Dmove%5D&drive=click%3A%5Bdata-store-group%3Dwork%5D%3Esummary%3Bclick%3A%5Bdata-store-group%3Dcaches%5D%3Esummary&walker=1&format=svg&cropSelector=.store-meter&dark=1&filename=pd-storage-meter)

Bajo el medidor:

- **Move to another device** tiene **Export my data**, **Import data…** y **Export my data & render everything**. [Move your work to another device](/info/find-your-work.html#move-your-work-to-another-device) los recorre.
- **Clear cache** elimina los archivos de catálogo descargados, que se vuelven a descargar cuando hacen falta.
- **Remove automatic checkpoints older than 30 days** libera espacio de History y conserva las versiones guardadas y con nombre.
- **Clear all my data** elimina todo lo que Lolly guarda en este navegador, tras escribir una palabra para confirmar. [If you clear your browser data](/info/find-your-work.html#if-you-clear-your-browser-data) enumera lo que desaparece.

### Available offline

Lolly guarda en caché las pantallas a medida que las visitas, lo que solo cubre donde ya has estado. **Available offline** es para el viaje que ves venir: descarga las partes que necesitarás y mira una sola barra de progreso, y todo lo que te llevaste sigue funcionando sin conexión.

- <!--i:monitor--> **App, catalogue and guides** - **The app** (todas las vistas, editores y fuentes, incluidas las pantallas que nunca has abierto), el **Catalogue** (entero, o **Choose by tag**) y **Guides & docs** (esta documentación en tu idioma, capturas incluidas).
- <!--i:cpu--> **AI models** - cada modelo en el dispositivo en su propia fila con su tamaño: Speech voices, Upscaling models, Background removal, Text recognition, Verify deep scan, Durable credential, Rewriter model, Ask matching model, AI text detector y Singing voices. Un modelo de más de 50 MB se marca como **large download**.
- <!--i:wrench--> **Tools** - cada herramienta se descarga por separado, o **Download all** trae todas. Una marca de verificación significa listo sin conexión.

**Download everything**, arriba, trae la aplicación, el alcance de catálogo que elegiste, las guías y todas las herramientas. Marca **Include all the AI models** para añadir los modelos, o descarga un modelo desde su propia fila; las voces de canto solo se descargan desde su propia fila. La política de una organización puede desactivar las descargas de IA, y entonces las filas te lo dicen.

Las descargas se reanudan donde se detuvieron si cancelas o pierdes la conexión, y se actualizan solas cuando vuelves a tener conexión, descargando solo lo que cambió una versión. Si el navegador no ha concedido almacenamiento persistente, **Protect downloads** lo solicita: la diferencia entre "descargado" y "descargado hasta que el navegador quiera recuperar el espacio".

### Lolly instance

**Lolly instance** indica de dónde obtiene esta instalación sus herramientas y su catálogo: la dirección de una instancia, o *Bundled with this app* cuando todo viene dentro de la compilación.

- **Design-system source** muestra de dónde viene el design system suministrado.
- **Instance console** abre las páginas de administración de un despliegue, donde las ofrece.
- **Change** apunta la aplicación de escritorio a otra instancia. Un navegador no puede cargar herramientas y recursos entre orígenes, así que en la web la sección ofrece **Open a workspace** en su lugar.
- **Leave** elimina el design system, las herramientas y el catálogo de la instancia, y tu propio trabajo se queda. Consulta [Use Lolly at your organisation](/info/organisation.html#leaving).
- Cuando has iniciado sesión en una organización, **Sign out** cierra esta sesión y **Sign out everywhere** cierra tus sesiones en todos los dispositivos, incluido este.

## This device

- <!--i:monitor--> **This Machine** - pantalla, entrada, gráficos, memoria, códecs, backend de almacenamiento y más, leídos en vivo de esta sesión. No se almacena nada y no se envía nada. Se abre solo en una pantalla ancha, donde la pestaña se dispone en dos columnas.
- <!--i:neurobeat--> **Sound** - los sonidos de la interfaz y los bucles de concentración de Neurospicy, el único interruptor de esta pestaña que escribe algo.
- <!--i:database--> **Storage** - una vista de solo lectura del medidor de [Preferences](#storage), que es donde borras o trasladas tus datos.

## Design system

El design system activo, expuesto para leer. Cuando este navegador guarda dos o más design systems, una tira de pequeñas portadas arriba los enumera: elige uno para activarlo, y **Undo** en el aviso que sigue vuelve a poner el anterior.

![La pestaña Design system en Lolly Demo: una tira de portadas para cambiar de sistema, y luego la portada con su logotipo, nombre, nota y los recuentos que abren cada página](/t/url-shot?url=%2F%23%2Fsettings%3Ftab%3Dbrand&width=1440&height=900&dpi=192&waitMs=2400&format=svg&walker=1&dark=1&filename=settings-design-system)

La pestaña se abre en una portada pintada con los colores propios del sistema, con su logotipo, su nombre en su tipografía de títulos y la nota que escribió su autor. Una línea de recuentos en la portada enlaza con cada página:

- <!--i:palette--> **Colour** - la superficie, el texto, el primario y el secundario de los aspectos claro y oscuro, cada color con nombre como un chip con su nombre y hex, una banda para cada rampa de tonos y el espectro de gráficos, y los roles de color en un pliegue. Selecciona un valor para copiar el hex.
- <!--i:font--> **Type** - Headings, Text, Emphasis y Code, cada uno compuesto en su propia tipografía.
- <!--i:photos--> **Logos** - cada archivo de logotipo sobre el fondo para el que se hizo.
- <!--i:layers--> **Colourways** - el par claro y oscuro de cada colourway, cuando el sistema tiene más de una.
- <!--i:sliders--> **Tokens** - radio, espaciado, efectos y degradados.
- <!--i:document--> **Print & CMYK** - los colores fijados a una tinta exacta, y las condiciones de prensa que puede declarar un PDF CMYK.

Cambiar es el único cambio que hace esta pestaña. Editas un design system en [Design System Setup](/info/brand-studio.html) en `#/start`, al que enlaza la portada. Un sistema de solo lectura lo dice en su portada; los sistemas locales que creas siguen siendo editables. `/b` y `/brand` son atajos directos a esta pestaña.

## Capabilities

Cada parte de la plataforma está descrita en una tarjeta, en doce grupos: Experiences, Platforms & runtimes, Accessibility & languages, Export formats, Import formats, Print production, Automation & AI, Determinism & reproducibility, Brand & design system, Privacy & data ownership, Security & access control y Architecture (for builders). Cada grupo se pliega y muestra su número de tarjetas. Una tarjeta se abre en un diálogo con las funciones de esa capacidad y, en aproximadamente la mitad, la captura que usa esta documentación.

El campo de búsqueda sobre los grupos filtra las tarjetas mientras escribes y abre los grupos que aún contienen una coincidencia. Indica cuántas capacidades está buscando, y una consulta sin coincidencias lo dice con palabras.

Esta pestaña es documentación escrita de lo que puede hacer Lolly, mantenida al día con estas guías. No sondea la máquina en la que estás; **This device** lo hace.

## Activity & stats

Primero la compilación: cuántas herramientas están cargadas, cuántos formatos de exportación existen, en cuántas superficies se ejecuta la plataforma y cuántos recursos de marca lleva el catálogo, con un panel **Catalogue** que desglosa lo que incluye esta compilación.

Luego tu propio lado: **Your activity** cuenta lo que has creado en este dispositivo, y **Recent creations** y **Latest exports** son pilas por las que puedes deslizar, cada una visible cuando hay algo que mostrar. Ambas abren un elemento tal como era. Estos contadores se quedan en el dispositivo; una instancia opcional de Lolly Work guarda sus propios [registros de telemetría y auditoría de la organización](/info/privacy.html#organisation-services-with-lolly-work).

## Enlaces directos

Cada pestaña y sección de Settings tiene su propio enlace, que puedes guardar en marcadores o pegar. [Search](/info/search.html) apunta sus resultados de **Settings** al mismo registro desde el que se dibuja Settings, así que una sección no puede cambiar de nombre sin que lo note un resultado de búsqueda.

::: details Todas las formas de enlace

- **Una pestaña:** `#/settings?tab=brand`, `#/settings?tab=caps`, `#/settings?tab=device`, `#/settings?tab=activity`.
- **Una sección de Preferences:** `#/settings?focus=<section-id>`, como `#/settings?focus=offline-section`.
- **Una sección, exactamente:** su ID como indicador suelto, como `#/settings?dash-storage`, `#/settings?dash-logos`, `#/settings?dash-colourways` o `#/settings?cap-formats`. Los antiguos enlaces `#/settings?dash-lock` y `#/settings?dash-palette-wheel` abren la portada y la página Colour.
- **Una sección por palabra clave:** `#/settings?print`, `#/settings?formats`, `#/settings?palette` (la página Colour) o `#/settings?tokens`. Las palabras clave pueden compartirse: `print` pertenece tanto a la referencia de impresión de la pestaña de marca como al grupo Print production, y gana la primera en el orden de la página. Usa el ID cuando importe cuál.

Un enlace directo cambia a la pestaña que contiene el destino, abre cualquier grupo en el que esté plegado y luego se desplaza hasta él, esperando un momento mientras las secciones de arriba terminan de componerse. Las direcciones retiradas `#/platform` y `#/capabilities` se integran en Settings con sus indicadores de enlace directo intactos.
:::

---

**Relacionado:** [Profiles](/info/profile.html) para tus datos y los contextos en los que creas. [Design System Setup](/info/brand-studio.html) para editar lo que muestra la pestaña Design system. [Find and recover your work](/info/find-your-work.html) para almacenamiento, copias de seguridad y cambio de dispositivo.
