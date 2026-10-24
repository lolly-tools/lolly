# Perfiles

Define una vez tu nombre, tus datos de contacto y tu foto, y cada herramienta creada para usarlos los rellena por ti: una firma de correo, una credencial, una tarjeta de ponente. Ese pequeño registro es tu **perfil**, y vive en tu dispositivo.

Tu perfil también guarda lo que acumulas mientras trabajas: sesiones guardadas, imágenes subidas y tu recuento local de actividad. Lo gestionas en **Settings → Preferences**; las herramientas solo leen los campos para los que se crearon. El uso independiente no necesita cuenta, y Sync opcional, compartir y los servicios de organización tienen cada uno sus propios flujos de datos, descritos más abajo.

## Qué hay en un perfil

| Parte | Qué es |
|---|---|
| **Name** | Nombre y apellidos. |
| **Contact** | Correo y teléfono. |
| **Location** | Ciudad y país. |
| **Headshot** | Una foto opcional, recortada a un cuadrado y guardada como imagen local, para herramientas como firmas de correo, tarjetas de cita y organigramas. |
| **Use my details to create** | Un interruptor de aceptación (se lee **Using my details** una vez activado). Decide si tus datos viajan como crédito de autoría en los archivos exportados y en las ejecuciones de Batch. No afecta al rellenado previo; consulta [How tools use your profile](#how-tools-use-your-profile). |
| **Preferences** | Tu tema, tus ajustes de accesibilidad y qué partes de la aplicación activaste en **Feature flags**. |
| **Your work** | Sesiones guardadas con sus miniaturas, organizadas en [Projects](/info/find-your-work.html), tus imágenes subidas y tus estadísticas locales de actividad. |

Nada es obligatorio. Un perfil en blanco funciona; rellena solo lo que te ahorre escribir.

![Settings en la pestaña Preferences: el carril de ajustes, y Your details con el interruptor Use my details to create y los campos de nombre, contacto y ubicación](/t/url-shot?url=%2F%23%2Fsettings%3Ffocus%3Ddetails-section&width=1440&height=900&dpi=192&waitMs=1600&format=svg&walker=1&localize=1&dark=1&filename=profile-details)

[Settings](/info/dashboard.html) recoge todo lo demás de Preferences, desde la apariencia y los emojis hasta el almacenamiento y las descargas sin conexión.

## Tú, un equipo o un rol

La palabra "perfil" sugiere una persona fija. En Lolly se parece más a un contexto de creación: quién eres mientras haces esto. Puede adoptar tres formas, y Lolly trata cada una del mismo modo.

::: cols
## Como tú mismo

Lo predeterminado. Tu nombre, tu correo, tu foto. Defínelo una vez y tu firma, tu credencial y tu rótulo de congreso se rellenan solos.

## Como un equipo

El nombre compartido de un equipo, una bandeja de grupo como `events@…`, un departamento y la marca del equipo. Una persona lo configura y lo exporta, y todos los demás cargan el mismo perfil, así que los archivos del equipo llevan datos coherentes. Un quiosco compartido o un portátil de demostración puede ejecutar un perfil de equipo.

## Como un rol

Una persona que gestiona eventos tres días al año quiere la bandeja del evento y la submarca del evento en credenciales y cartelería, y luego recuperar su identidad habitual. Guarda ese rol como un archivo de perfil, cárgalo para el evento y déjalo a un lado después.
:::

![El control de foto, vacío hasta que subes una imagen que luego permanece en este dispositivo](/t/url-shot?url=%2F%23%2Fsettings%3Ffocus%3Ddetails-section&width=1440&height=900&dpi=192&waitMs=1600&format=svg&cropSelector=.profile-side&walker=1&dark=1&filename=pd-profile-headshot&css=.profile-details-main%7Bdisplay%3Anone%7D)

::: details Perfiles en una organización que usa Lolly Work
Cuando inicias sesión en el [Lolly de una organización](/info/organisation.html), Lolly Work puede aportar campos de perfil verificados desde su proveedor de identidad y fijar campos o preferencias según la política de la organización. Un campo gestionado se etiqueta en la aplicación.

Ese inicio de sesión también controla el acceso a proyectos y recursos compartidos. Un archivo de perfil de equipo sigue siendo un archivo local: no concede pertenencia a la organización ni sustituye una cuenta de trabajo. **Use my details to create** controla el crédito en tus exportaciones, no el inicio de sesión ni los registros de auditoría de la organización. Consulta [Privacy](/info/privacy.html#organisation-services-with-lolly-work).
:::

## Guarda varios, usa uno

Una instalación tiene un perfil activo a la vez, y no hay selector en la aplicación. En su lugar, cada perfil es un archivo portátil, el mismo archivo de copia de seguridad que usarías para pasar a un dispositivo nuevo. Para entrar en otro contexto:

::: timeline
- <!--i:download--> **Export my data** en **Settings → Storage → Move to another device** guarda el perfil actual como un único `.zip`.
- <!--i:trash--> **Clear all my data** vacía esta instalación.
- <!--i:upload--> **Import data…** carga el archivo de perfil del contexto al que entras.
:::

Importar sin borrar antes **fusiona**. Las sesiones y las imágenes importadas se añaden; donde existen ambas copias, se conserva la guardada más recientemente. Las carpetas, los favoritos y las plantillas se añaden junto a los tuyos, y tus propios datos se mantienen, salvo los campos vacíos, que toman los valores del archivo. Eso sirve para incorporar a tu configuración las sesiones de un equipo, pero no para una separación limpia entre roles.

Para dos contextos a la vez, usa un perfil de navegador distinto, una cuenta de usuario distinta o una segunda copia instalada de la aplicación web: cada una lleva su propio perfil de Lolly independiente.

![Los dos botones que mueven toda una instalación: Export my data escribe un zip, Import data lo vuelve a leer](/t/url-shot?url=%2F%23%2Fsettings%3Ffocus%3Dstorage-section&width=1440&height=1800&dpi=192&waitMs=2400&css=.store-move%3Ediv%3Anth-of-type%282%29%2C.store-move%3Ep%3Alast-of-type%7Bdisplay%3Anone%7D&waitSelector=%5Bdata-store-group%3Dmove%5D&drive=click%3A%5Bdata-store-group%3Dmove%5D%3Esummary&walker=1&format=svg&cropSelector=%5Bdata-store-group%3Dmove%5D&dark=1&filename=pd-transfer-controls)

> Guarda un archivo por contexto y nombra cada uno según lo que es, como `LollyTools-events-2026.zip` y `LollyTools-me.zip`. El archivo es el perfil.

[Move your work to another device](/info/find-your-work.html#move-your-work-to-another-device) cubre lo que contiene el archivo, lo que se queda atrás y las demás formas de mover, incluido Sync.

## Cómo usan las herramientas tu perfil

**Rellenado previo.** El autor de una herramienta marca una entrada como tomada de tu perfil (`bindToProfile: "firstname"`, `"email"`, `"headshot"` y así sucesivamente). Cuando la herramienta se abre, esa entrada se rellena desde tu perfil, y puedes anularla durante una sesión sin cambiar el perfil, a menos que una política de la organización bloquee la entrada. El rellenado previo es una comodidad local y ocurre esté o no activado **Use my details**.

**Crédito.** Al exportar, tus datos pueden viajar como crédito de autoría en los metadatos del archivo (PNG, PDF, SVG y más), de modo que un archivo terminado pueda decir quién hizo el trabajo. **Use my details to create** gobierna esto, y el autor en las ejecuciones de Batch. Con él desactivado, la exportación sigue diciendo que se hizo con Lolly, y no lleva ninguna línea personal de autor ni de contacto.

Autores de herramientas: consultad [`bindToProfile`](/info/tool-inputs.html#bindtoprofile) y [`host.profile`](/info/host-api.html#host-profile).

![El único interruptor Use my details to create, marcado como de aceptación y desactivado hasta que lo actives](/t/url-shot?url=%2F%23%2Fsettings%3Ffocus%3Duse-details&width=1440&height=900&dpi=192&waitMs=1600&format=svg&cropSelector=.profile-check&walker=1&dark=1&filename=pd-use-my-details)

## Perfil, design system y capacidades

Tres cosas están cerca en Settings y es fácil confundirlas:

- <!--i:people--> **Profile** - tú, tu equipo o el rol en el que estás: nombre, contacto, foto y trabajo guardado. Personal, guardado en el dispositivo y portátil como archivo.
- <!--i:palette--> **Design system** - la marca: los colores, fuentes y ajustes con los que se renderiza cada herramienta. Compartido y coherente más que personal; consulta [Design System Setup](/info/brand-studio.html).
- <!--i:sliders--> **Capabilities** - lo que puede hacer la aplicación: las funciones y herramientas a tu disposición.

Un perfil cambia de quién es un archivo; el design system cambia cómo se ve el archivo; las capacidades son lo que puedes crear.

La palabra tiene otros tres significados en Lolly. Un **perfil de contenido** es un ajuste de compilación que elige qué herramientas y catálogo distribuye un despliegue; el [Glossary](/info/glossary.html) define el término. El parámetro de enlace `profile` elige un perfil de color para una exportación, como una condición de prensa CMYK; consulta [Reserved URL parameters](/info/url-parameters.html#print). Una **identidad verificada** es el certificado de firma opcional que vincula tu correo con tus exportaciones firmadas, independiente de estos datos, aunque **Use my details to create** gobierna si se incrusta alguno de los dos; consulta [Content Credentials](/info/content-credentials-identity.html).

![La tarjeta de identidad verificada, en ancho de móvil: el selector de vida del certificado y el paso de inscripción debajo - el perfil de identidad, separado de tus datos personales](/t/url-shot?url=%2F%23%2Fsettings%3Ffocus%3Didentity-section&width=430&height=1600&dpi=192&waitMs=2400&css=.welcome-dialog%2C.personalize-nudge%7Bdisplay%3Anone%7D&format=svg&walker=1&cropSelector=%23identity-section&dark=1&filename=pv-identity-enrol)

## Privacidad

Tu perfil personal se almacena en local. Tus datos pueden viajar en una copia de seguridad o de Sync, en el contenido que compartes o exportas y durante el registro opcional de Content Credentials. En una instancia de Lolly Work, el inicio de sesión, el trabajo compartido, la política de telemetría y los registros de auditoría son independientes de este perfil local. **Settings → Preferences → Clear all my data** limpia este dispositivo; no borra las copias que conserva tu proveedor de almacenamiento u organización. Consulta la [Privacy Policy](/info/privacy.html).
