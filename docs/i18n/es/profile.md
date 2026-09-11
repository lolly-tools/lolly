# Perfiles - quién eres cuando creas

Un **perfil** es la identidad de trabajo con la que Lolly crea. Es el pequeño conjunto de datos del que una herramienta puede tomar información para que no tengas que volver a escribirlos cada vez - tu nombre, datos de contacto, una foto opcional, algunas preferencias - además de todo lo que acumulas mientras trabajas: sesiones guardadas, imágenes subidas y el recuento de actividad local.

Todo lo que hay en un perfil vive **en el dispositivo**, en la base de datos local del navegador (IndexedDB en la PWA web, el sistema de archivos en las apps de Tauri). No hay cuenta y no se sube nada. Lo gestionas en **Perfil** (arriba a la derecha de la galería); las herramientas solo *leen* el perfil, y únicamente los campos concretos para los que fueron diseñadas para autocompletar.

> Un perfil trata sobre *ti* (o quien esté creando aquí). Es distinto de la **Plataforma** - los colores, fuentes y ajustes globales de la marca - y de las **Capacidades**, el catálogo de lo que la app puede hacer. Consulta [Perfil frente a Plataforma frente a Capacidades](#profile-vs-platform-vs-capabilities) al final.

## Qué hay en un perfil

| Parte | Qué es |
|---|---|
| **Nombre** | Nombre y apellidos. |
| **Contacto** | Correo electrónico y teléfono. |
| **Ubicación** | Ciudad y país. |
| **Foto** | Una foto opcional, recortada a cuadrado y guardada como imagen local. La usan herramientas como firmas de correo, tarjetas de cita, organigramas y diseños dinámicos. |
| **Usar mis datos para crear** | Un único interruptor de aceptación (dice **Usando mis datos** una vez activado). Controla si tus datos personales viajan como **procedencia** - la línea de autoría/crédito incrustada en los archivos exportados - y como autor en las ejecuciones por lotes de **/pro**. (No condiciona el autorrelleno: consulta [Cómo usan las herramientas tu perfil](#how-tools-use-your-profile).) |
| **Preferencias** | Tu tema (Claro, Oscuro o Marca - el tema de marca pinta la app con tu propia paleta) y qué partes de la app has habilitado mediante **Feature flags**. |
| **Accesibilidad** | Cuatro interruptores de confort - *Reducir movimiento*, *Ocultar vistas previas coloridas*, *Alto contraste*, *Texto grande* - guardados en el registro de perfil, así que viajan en una exportación de perfil. Consulta [Accesibilidad](#accessibility). |
| **Tu trabajo** | Sesiones guardadas (con miniaturas) - organizadas en carpetas anidadas en **[Proyectos](/info/using.html)** - tu biblioteca **Mis imágenes** y las estadísticas de actividad local, todo vinculado a este perfil. |

![Three theme cards, each previewing its own type and colour, with the active one flagged](/t/url-shot?url=%2F%23%2Fprofile&width=1440&height=1400&dpi=192&waitMs=1600&walker=1&format=svg&cropSelector=.profile-card--appearance&dark=1&filename=pd-theme-picker)

![La pantalla de Perfil - nombre, contacto, una foto opcional y tus preferencias](/t/url-shot?url=%2F%23%2Fprofile&width=1440&height=900&dpi=192&waitMs=1600&format=svg&walker=1&localize=1&dark=1&filename=profile-details)

| Parte | Qué es |
|---|---|
| **Nombre** | Nombre y apellidos. |
| **Contacto** | Correo electrónico y teléfono. |
| **Ubicación** | Ciudad y país. |
| **Foto de perfil** | Una foto opcional, recortada en cuadrado y guardada como imagen local. La usan herramientas como firmas de correo, tarjetas de citas, bloques de color y diseños dinámicos. |
| **Usar mis datos** | Un único interruptor de activación voluntaria. Controla si tus datos personales viajan como **procedencia** - la línea de autoría/crédito incrustada en los archivos exportados - y como autor en las ejecuciones por lotes de **/pro**. (No condiciona el autocompletado: consulta [Cómo usan las herramientas tu perfil](#how-tools-use-your-profile).) |
| **Preferencias** | Tu tema (claro, oscuro o SUSE) y qué partes de la app has activado mediante los indicadores de funciones (**Feature flags**). |
| **Tu trabajo** | Sesiones guardadas (con miniaturas) - organizadas en carpetas anidadas en **[Proyectos](/info/using.html)** - tu biblioteca de **Mis imágenes**, y las estadísticas de actividad local, todo vinculado a este perfil. |

La página es larga, así que lleva su propio **riel de ajustes** por el lateral - Tus datos, Apariencia, Accesibilidad, Instancia de Lolly, Tu actividad, Almacenamiento, Disponible sin conexión, Feature flags, Content Credentials - con un campo de **Buscar ajustes** encima que filtra la lista mientras escribes. Cada sección se puede enlazar directamente como `#/profile?focus=<section-id>`, lo que la abre y la desplaza a la vista (`#/profile?focus=storage-section`, `?focus=feature-flags-section`, etc.), así un enlace puede apuntar a un ajuste concreto en vez de a la parte superior de la página.

![Tres tarjetas de tema, cada una mostrando su propio tipo y color, con la activa marcada](/t/url-shot?url=%2F%23%2Fprofile&width=1440&height=1400&dpi=192&waitMs=1600&walker=1&format=svg&cropSelector=.profile-card--appearance&dark=1&filename=pd-theme-picker)

## Un perfil es un contexto, no solo una persona

La palabra "perfil" sugiere una única persona fija, pero en Lolly es en realidad un **contexto de creación** - *quién eres mientras haces esto*. Ese contexto puede adoptar tres formas distintas, y Lolly las gestiona todas de la misma manera.

### Como individuo

![The headshot control, empty until you upload a photo that then stays on this device](/t/url-shot?url=%2F%23%2Fprofile&width=1440&height=900&dpi=192&waitMs=1600&format=svg&cropSelector=.profile-side&walker=1&dark=1&filename=pd-profile-headshot)

![El control de foto, vacío hasta que subes una imagen que luego permanece en este dispositivo](/t/url-shot?url=%2F%23%2Fprofile&width=1440&height=900&dpi=192&waitMs=1600&format=svg&cropSelector=.profile-side&walker=1&dark=1&filename=pd-profile-headshot)

### Como equipo

Un perfil no tiene por qué ser una sola persona. Puede representar a un **equipo o función dentro de una organización**: el nombre compartido del equipo, una dirección de bandeja de entrada de grupo (`events@…`), un departamento, la foto del equipo o el distintivo de la unidad. Una persona lo configura, lo exporta (ver más abajo) y el resto del equipo carga el mismo perfil - así todo lo que produce el equipo lleva datos coherentes sin que nadie tenga que volver a introducirlos. Un quiosco compartido o un portátil de demostración prestado puede ejecutar un único perfil de equipo bajo el que crea todo el que lo usa.

### Como función - un papel que te pones a veces

Este es el caso que el modelo rígido de "una persona, un perfil" no contempla. Puede que seas **gestor de eventos tres días al año** y otra cosa completamente distinta el resto del tiempo. Esos tres días quieres los datos del evento, la bandeja de entrada del evento, quizá una submarca del evento para rellenar tus credenciales y señalética; los otros 362 quieres recuperar tu identidad normal.

En Lolly, ese papel es solo **otro perfil que tienes a mano** - un paquete guardado (siguiente sección) que cargas para el evento y apartas después. El papel es un sombrero, no una cuenta nueva. Póntelo cuando lo necesites, quítatelo cuando termines.

## Una instalación, un perfil activo - puedes conservar muchos

En cualquier momento una instalación tiene **un perfil activo** - los datos que ve una herramienta ahora mismo. No hay un selector de perfil dentro de la app; en su lugar, cada perfil es un **paquete portátil** (un único `.zip`, ver [más abajo](#moving-a-profile-to-a-new-device)). Ese es, deliberadamente, el mismo mecanismo que mudarse a un dispositivo nuevo - un perfil es un archivo que puedes guardar, copiar y cargar.

![The storage meter, breaking down saved sessions, images and cache against what the browser actually reports](/t/url-shot?url=%2F%23%2Fprofile%3Ffocus%3Dstorage-section&width=1440&height=1800&dpi=192&waitMs=2400&css=.store-manages%2C.storage-subsection%2C.storage-actions%7Bdisplay%3Anone%7D&walker=1&format=svg&cropSelector=.store-meter&dark=1&filename=pd-storage-meter)

- <!--i:trash--> **El cambio más limpio:** **Perfil → Almacenamiento → Borrar todos mis datos**, y luego **Importar** el paquete del contexto al que vas a pasar. Ahora estás creando puramente como ese perfil.
- <!--i:layers--> **Superposición:** importar *sin* borrar antes **fusiona** - el perfil, las sesiones y las imágenes importadas se colocan encima de lo que ya había, reemplazando lo que tenga el mismo nombre y dejando el resto. Útil para traer las sesiones guardadas de un equipo a tu propia configuración; no lo que quieres si necesitas un límite de rol limpio.
- <!--i:monitor--> **Uno junto a otro:** como todo está limitado al dispositivo, un perfil de navegador distinto, una cuenta de usuario distinta o una segunda PWA instalada llevan cada uno su propio perfil de Lolly independiente. Ejecuta tu instalación personal y la del quiosco del evento a la vez, sin cambiar.

Así que si de verdad manejas varios contextos a la vez (tú, tu equipo, el sombrero de gestor de eventos), conservas varios paquetes y cargas el que necesites:

![El medidor de almacenamiento, desglosando sesiones guardadas, imágenes y caché frente a lo que realmente informa el navegador](/t/url-shot?url=%2F%23%2Fprofile%3Ffocus%3Dstorage-section&width=1440&height=1800&dpi=192&waitMs=2400&css=.store-manages%2C.storage-subsection%2C.storage-actions%7Bdisplay%3Anone%7D&walker=1&format=svg&cropSelector=.store-meter&dark=1&filename=pd-storage-meter)

> Conserva un paquete por contexto y renombra los archivos según lo que son (`LollyTools-events-2026.zip`, `LollyTools-me.zip`). El archivo *es* el perfil.

## Accesibilidad

**Perfil → Accesibilidad** contiene cuatro ajustes de confort para la app *alrededor* de tu trabajo. Cada uno está desactivado hasta que lo activas, y ninguno llega dentro de un lienzo de herramienta ni de una exportación - una app más calmada no debe mover ni un píxel del archivo que entregas.

- <!--i:film--> **Reducir movimiento** - desactiva las transiciones, deslizamientos y florituras animadas de la app. Tu lienzo de herramienta y cualquier exportación animada siguen moviéndose exactamente como están diseñados.
- <!--i:image--> **Ocultar vistas previas coloridas** - cambia las ilustraciones de vista previa de la galería por tarjetas tranquilas de icono y texto, y reduce el color y el contraste de las miniaturas de tus proyectos para que sigan siendo reconocibles sin gritar. Dentro de una herramienta todo se muestra a todo color.
- <!--i:sliders--> **Alto contraste** - refuerza los bordes, el texto y los anillos de foco de la app. Los colores de tu marca y todo lo que hay en el lienzo se mantienen exactamente como los configuraste.
- <!--i:font--> **Texto grande** - agranda el tipo de la app: etiquetas, menús y texto de botones. Los controles mantienen su tamaño, así que solo las palabras dentro de ellos crecen, y el tipo dentro de tus diseños queda intacto, así que nada de lo que exportas se reajusta.

Estos viven en el propio registro de perfil, por lo que viajan en una exportación de perfil y llegan a la siguiente instalación junto con tu nombre y tus sesiones. (El dispositivo también guarda un pequeño espejo local para que el ajuste se aplique antes del primer pintado; ese espejo es solo del dispositivo y no viaja.)

## Tu instancia de Lolly

**Perfil → Instancia de Lolly** indica de dónde obtiene esta instalación sus herramientas y catálogo - la dirección de la instancia, o *Incluido en esta app* cuando todo se envía dentro de la compilación. Donde una implementación lo ofrece, un enlace de **Consola de instancia** abre su superficie de administración, y **Cambiar** / **Desconectar** redirigen la instalación o la liberan.

Redirigir a otra instancia necesita la **app de escritorio**: un navegador bloquea que una página cargue herramientas y activos entre orígenes distintos, así que en la web la sección informa dónde estás y lo deja ahí.

## Disponible sin conexión

Lolly guarda en caché a medida que avanzas, pero eso solo cubre por dónde ya has pasado. **Perfil → Disponible sin conexión** es para el viaje que ves venir: una hora con wifi de aeropuerto antes de un vuelo sin nada. Descarga las partes que necesitarás, mira una sola barra de progreso, y todo lo que descargaste sigue funcionando aunque se corte la conexión.

Siete partes, cada una con su tamaño indicado antes de que te comprometas:

- <!--i:layout--> **La app** - cada vista, editor y fuente, incluidas las que aún no has abierto. Sin esto, una pantalla que nunca visitaste en línea no puede cargar sin conexión.
- <!--i:image--> **Catálogo** - activos de marca más allá de lo esencial. Llévatelo todo, o abre *Elegir por etiqueta* y llévate solo las etiquetas que usas.
- <!--i:book--> **Guías y documentación** - este sitio de documentación, en tu idioma, capturas de pantalla incluidas.
- <!--i:cpu--> **Voces de voz** - los modelos de voz detrás del audio y la narración de Script. Se descargan una vez, y luego se ejecutan en el dispositivo.
- <!--i:zap--> **Modelos de escalado** - los ampliadores de imagen por IA: foto, ilustración/anime y rostro.
- <!--i:layers--> **Eliminación de fondo** - los modelos de recorte en el dispositivo detrás de *Eliminar fondo*.
- <!--i:shield--> **Análisis profundo de Verificar** - el escáner de marca de agua en el dispositivo, para comprobar Content Credentials sin conexión.

Las cuatro últimas están marcadas como **descarga grande**, y son deliberadamente opciones individuales: **Descargar todo** en la parte superior toma la app, el alcance de catálogo que elegiste, la documentación y todas las herramientas de una vez, y nada más. Las voces de voz, los ampliadores, la eliminación de fondo y el análisis profundo solo se descargan cuando pides esa fila por su nombre - unos cientos de megabytes escondidos dentro de un solo botón sería deshonesto.

Debajo de las partes está la lista por herramienta: cada herramienta se descarga individualmente (la marca indica lista sin conexión), o **Descargar todas** las arrastra todas de golpe. Las descargas son reanudables - cancela o pierde la conexión y la siguiente ejecución retoma donde se quedó, obteniendo solo lo que falta - y se actualizan solas cuando vuelves a estar en línea, trayendo solo lo que cambió una nueva versión.

Si el navegador no ha concedido almacenamiento persistente, la sección lo indica y ofrece **Proteger descargas**, que lo solicita - la diferencia entre "descargado" y "descargado hasta que el navegador quiera recuperar el espacio".

## Mover un perfil a un dispositivo nuevo

![The two buttons that move a whole install: Export my data writes one zip, Import data reads it back](/t/url-shot?url=%2F%23%2Fprofile%3Ffocus%3Dstorage-section&width=1440&height=1800&dpi=192&waitMs=2400&css=.store-manages%7Bdisplay%3Anone%7D&walker=1&format=svg&cropSelector=.storage-subsection&dark=1&filename=pd-transfer-controls)

Como un perfil es totalmente local, la única forma de llevarlo a una instalación en blanco - un portátil nuevo, un navegador recién restablecido, el equipo de un compañero, una máquina sin conexión - es **llevar el archivo contigo**. Ningún inicio de sesión lo restaura por ti, y esa es la idea: nada salió nunca de tu dispositivo, para empezar.

- <!--i:download--> **Export my data** (Exportar mis datos) descarga un `LollyTools-<First>-<Last>-<YYYY-MM-DD>-<n>.zip` - con un nombre según el perfil al que pertenece, con un número de secuencia diario para que las exportaciones repetidas no choquen entre sí (las partes del nombre se omiten cuando el perfil no las tiene). Contiene tu perfil, todas las sesiones guardadas (con su miniatura), tus imágenes subidas - tus tokens de marca y las fuentes instaladas viajan junto como activos de usuario - y tus preferencias (tema, diseño, estadísticas de actividad local).
- <!--i:upload--> **Import data…** (Importar datos…) en la otra instalación vuelve a leer ese archivo y retomas exactamente donde lo dejaste.
- <!--i:box--> **Export my data & render everything** (Exportar mis datos y renderizar todo) escribe esa misma copia de seguridad *además de* un segundo zip que renderiza cada sesión guardada a su archivo de salida final, en carpetas que reflejan tus Proyectos. Un archivo completo sin conexión tanto de las fuentes como de los resultados - y puede ser grande y lento con muchas sesiones.

![Los dos botones que mueven una instalación entera: Exportar mis datos escribe un zip, Importar datos lo vuelve a leer](/t/url-shot?url=%2F%23%2Fprofile%3Ffocus%3Dstorage-section&width=1440&height=1800&dpi=192&waitMs=2400&css=.store-manages%7Bdisplay%3Anone%7D&walker=1&format=svg&cropSelector=.storage-subsection&dark=1&filename=pd-transfer-controls)

El paquete es un zip plano y autocontenido, así que viaja por **cualquier** medio - USB, AirDrop, un recurso compartido de red, un correo a ti mismo - y el destino puede estar totalmente sin conexión. Cada parte lleva su suma de comprobación, así que un archivo dañado durante el traslado se detecta al importar en lugar de restaurarse a medias. Importar **combina** (el perfil/sesión/imagen con el mismo nombre se sobrescribe; todo lo demás se conserva), así que nunca borra un destino que ya estuviera en uso.

Lo que no viaja: la caché del catálogo (se vuelve a descargar sola en el dispositivo nuevo) y las propias herramientas (se asume que ya están presentes).

Para el diseño exacto del paquete, la política de versiones y las reglas de integridad, consulta **[Transferencia de datos](/info/data-transfer.html)**; para el recorrido completo de principio a fin, **[Usar Lolly → Mudarse a otro dispositivo](/info/using.html#moving-to-another-device)**.

## Cómo usan las herramientas tu perfil

![The single Use my details switch, sitting beside Save Profile and off until you turn it on](/t/url-shot?url=%2F%23%2Fprofile&width=1440&height=900&dpi=192&waitMs=1600&format=svg&cropSelector=.profile-check&walker=1&dark=1&filename=pd-use-my-details)

Una herramienta solo *autocompleta* los campos del perfil para los que fue diseñada explícitamente:

**La opción de aceptar (procedencia).** Cuando exportas un activo, tus datos opcionalmente viajan como **procedencia** - una línea de autoría/crédito incrustada en los metadatos del archivo (PNG, PDF, SVG, …) - de modo que un activo terminado pueda decir quién lo hizo. *Esto* es lo que controla **Usar mis datos para crear**: déjalo desactivado y la exportación sigue llevando la atribución de herramienta/plataforma "Hecho con Lolly", pero no se incrusta ninguna línea personal de autoría/contacto. (La misma opción establece el autor en las ejecuciones por lotes de **/pro**.) (Autores de herramientas: consulta [Crear herramientas → `bindToProfile`](/info/authoring-tools.html#bindtoprofile) y [API del host → `host.profile`](/info/host-api.html#host-profile).)

![El único interruptor Usar mis datos para crear, junto a Guardar perfil y desactivado hasta que lo activas](/t/url-shot?url=%2F%23%2Fprofile&width=1440&height=900&dpi=192&waitMs=1600&format=svg&cropSelector=.profile-check&walker=1&dark=1&filename=pd-use-my-details)

## Perfil frente a Plataforma frente a Capacidades

Tres elementos están próximos entre sí en la interfaz y es fácil confundirlos:

- <!--i:people--> **Perfil** - *tú* (o tu equipo, o el rol que ocupas): nombre, contacto, foto, tu trabajo guardado. Personal, local al dispositivo, portátil como paquete.
- <!--i:palette--> **Plataforma** - la *marca*: colores, fuentes y ajustes globales con los que renderiza cada herramienta. Compartida y coherente, no personal.
- <!--i:sliders--> **Capacidades** - *lo que la app puede hacer*: el conjunto completo de funciones y las herramientas disponibles para ti.

Un perfil cambia de quién *proviene* un recurso; la plataforma cambia su *aspecto*; las capacidades son *lo que puedes crear*.

### "Perfil" significa otras dos cosas en otro sitio - no esta

La palabra está sobrecargada en todo el proyecto. Ninguna de estas dos es el perfil personal del que trata esta página:

- <!--i:box--> **Perfil de contenido** - una configuración en tiempo de compilación en `profiles.json` que vincula un conjunto de paquetes de herramientas a un catálogo de marca (por ejemplo, `suse`, `lolly-start`). Es lo que elige un operador al desplegar, y es lo que el **parámetro de URL/CLI** `profile` también selecciona como una variante de *color* en el momento de exportar (la condición de imprenta ICC/CMYK - consulta [Modo URL](/info/url-mode.html)). Ambos tratan de la *compilación/salida*, no de ti. Consulta [Configuración](/info/configuration.html).
- <!--i:seal--> **Perfil de identidad** - la **identidad verificada de Content Credentials** opcional que puedes inscribir (un certificado de vida corta que vincula tu correo a tus exportaciones firmadas). Eso es una identidad de firma, separada de los campos de nombre/contacto del perfil personal, aunque **Usar mis datos para crear** controla si se incrusta uno u otro. Consulta [Identidad de Content Credentials](/info/content-credentials-identity.html).

![La tarjeta de identidad verificada, en ancho de móvil: el selector de vida del certificado y el paso de inscripción debajo - el perfil de identidad, separado de tus datos personales](/t/url-shot?url=%2F%23%2Fprofile%3Ffocus%3Didentity-section&width=430&height=1600&dpi=192&waitMs=2400&css=.welcome-dialog%2C.personalize-nudge%7Bdisplay%3Anone%7D&format=svg&walker=1&cropSelector=%23identity-section&dark=1&filename=pv-identity-enrol)

## Privacidad

Fuera de la inscripción de identidad opcional de arriba (que envía el correo que inscribes al servicio de certificados - consulta [Superficie del servidor](/info/server-surface.html)), un perfil nunca se transmite, se sube ni se usa para identificarte o rastrearte - no hay nada que consentir, solo este aviso para que sepas qué se guarda. Bórralo todo en cualquier momento con **Perfil → Borrar todos mis datos**. Consulta la [Política de privacidad](/info/privacy.html).
