# Perfiles

Introduce una vez tu nombre, tus datos de contacto y tu foto de perfil, y cada herramienta preparada para usarlos los rellenará, como una firma de correo, una acreditación o una tarjeta de ponente. Ese registro es tu **perfil** y se guarda en tu dispositivo.

Tu perfil también contiene las sesiones guardadas, las imágenes subidas y el recuento de tu actividad local. Gestiónalo en **Settings → Preferences**. Las herramientas solo leen los campos que están preparadas para rellenar. El uso independiente no necesita cuenta. Las funciones opcionales de Sync, uso compartido y servicios de la organización tienen cada una sus propios flujos de datos.

<!--i:eti-user-check-->
## Qué contiene un perfil

| Parte | Qué es |
|---|---|
| **Name** | Nombre y apellidos. |
| **Contact** | Correo electrónico y teléfono. |
| **Location** | Ciudad y país. |
| **Headshot** | Una foto opcional, recortada en un cuadrado y guardada como imagen local, para herramientas como firmas de correo, tarjetas de citas y organigramas. |
| **Use my details to create** | Un interruptor opcional que muestra **Using my details** al activarlo. Decide si tus datos viajan como crédito de autor en los archivos exportados y en las ejecuciones de Lolly Batch; consulta [Cómo usan las herramientas tu perfil](#how-tools-use-your-profile). |
| **Preferences** | Tu tema, tu colourway en cada design system, tus ajustes de accesibilidad y las partes de la aplicación que activaste en **Feature flags**. |
| **Your work** | Las sesiones guardadas con sus miniaturas, organizadas en [Lolly Projects](/info/find-your-work.html), las imágenes que has subido y tus estadísticas de actividad local. |

Nada de esto es obligatorio y un perfil vacío funciona.

![Settings en la pestaña Preferences: el carril de ajustes y Your details con el interruptor Use my details to create y los campos de nombre, contacto y ubicación](/t/url-shot?url=%2F%23%2Fsettings%3Ffocus%3Ddetails-section&width=1440&height=900&dpi=192&waitMs=1600&format=svg&walker=1&localize=1&dark=1&filename=profile-details)

[Lolly Settings](/info/dashboard.html) explica el resto de Preferences, desde la apariencia y los emoji hasta el almacenamiento y las descargas para uso sin conexión.

<!--i:eti-users-->
## Tú, un equipo o un rol

En Lolly, un perfil es quién eres mientras creas algo: tú mismo, un equipo o un rol. Lolly trata los tres del mismo modo.

::: cols
## Como tú mismo

Lo predeterminado: tu nombre, correo electrónico y foto de perfil. Tu firma, acreditación y composición de marca para conferencias se rellenan con esos datos.

## Como equipo

El nombre compartido de un equipo, un buzón de grupo como `events@…`, un departamento y la marca del equipo. Una persona configura el perfil y exporta un archivo. Las demás cargan el mismo perfil, así que los archivos del equipo llevan los mismos datos. Un quiosco compartido o un portátil de demostración pueden usar un único perfil de equipo.

## Como rol

Quien gestiona un evento necesita el buzón y la submarca del evento en las acreditaciones y la señalización tres días al año, y después recuperar su identidad habitual. Conserva el rol como un archivo de perfil guardado, carga el archivo para el evento y apártalo después.
:::

![El control de foto de perfil, vacío hasta que subes una foto que después se queda en este dispositivo](/t/url-shot?url=%2F%23%2Fsettings%3Ffocus%3Ddetails-section&width=1440&height=900&dpi=192&waitMs=1600&format=svg&cropSelector=.profile-side&walker=1&dark=1&filename=pd-profile-headshot&css=.profile-details-main%7Bdisplay%3Anone%7D)

::: details Perfiles en una organización que usa Lolly Work
Cuando inicias sesión en el [Lolly de una organización](/info/organisation.html), Lolly Work puede proporcionar campos de perfil verificados desde su proveedor de identidad y fijar campos o preferencias según la política de la organización. Los campos gestionados se identifican en la aplicación.

Ese inicio de sesión también controla el acceso a los proyectos y recursos compartidos. Un archivo de perfil de equipo es un archivo local. No otorga pertenencia a la organización ni sustituye una cuenta de trabajo. **Use my details to create** controla el crédito en tus exportaciones, no el inicio de sesión ni los registros de auditoría de la organización. Consulta [Privacidad](/info/privacy.html#organisation-services-with-lolly-work).
:::

<!--i:eti-copy-->
## Conserva varios, usa uno

Una instalación tiene un único perfil activo a la vez, sin selector dentro de la aplicación. Cada perfil es un archivo portable, el mismo archivo de copia de seguridad que traslada tu trabajo a un dispositivo nuevo. Para cambiar de contexto:

::: timeline
- <!--i:download--> **Export my data**, en **Settings → Storage → Move to another device**, guarda el perfil actual en un único `.zip`.
- <!--i:trash--> **Clear all my data** vacía esta instalación.
- <!--i:upload--> **Import data…** carga el archivo de perfil del contexto al que vas a pasar.
:::

::: note Importar sin borrar antes fusiona los datos
Las sesiones e imágenes importadas se añaden. Cuando existen ambas copias, se conserva la guardada más recientemente. Las carpetas, los favoritos y las plantillas se añaden junto a los tuyos. Tus propios datos se conservan, salvo los campos vacíos, que toman los valores del archivo. Una fusión sirve para incorporar las sesiones de un equipo a tu configuración, pero no para separar por completo los roles.
:::

Para usar dos contextos a la vez, usa un perfil de navegador, una cuenta de usuario o una copia instalada de la aplicación web independiente. Cada uno tiene su propio perfil de Lolly.

![Los dos botones que trasladan una instalación completa: Export my data escribe un zip e Import data lo vuelve a leer](/t/url-shot?url=%2F%23%2Fsettings%3Ffocus%3Dstorage-section&width=1440&height=1800&dpi=192&waitMs=2400&css=.store-move%3Ediv%3Anth-of-type%282%29%2C.store-move%3Ep%3Alast-of-type%7Bdisplay%3Anone%7D&waitSelector=%5Bdata-store-group%3Dmove%5D&drive=click%3A%5Bdata-store-group%3Dmove%5D%3Esummary&walker=1&format=svg&cropSelector=%5Bdata-store-group%3Dmove%5D&dark=1&filename=pd-transfer-controls)

::: note Conserva un archivo por contexto
Pon a cada archivo un nombre que indique qué es, como `LollyTools-events-2026.zip` y `LollyTools-me.zip`. El archivo es el perfil.
:::

[Trasladar tu trabajo a otro dispositivo](/info/find-your-work.html#move-your-work-to-another-device) explica qué contiene el archivo, qué se queda atrás y las otras formas de trasladarlo, incluida Sync.

<!--i:eti-pen-->
## Cómo usan las herramientas tu perfil

**Relleno previo.** El autor de una herramienta marca una entrada para que tome datos de tu perfil (`bindToProfile: "firstname"`, `"email"`, `"headshot"` y así sucesivamente). Al abrir la herramienta, esa entrada se rellena desde tu perfil. Puedes cambiar el valor para una sesión sin modificar el perfil, salvo que una política de la organización bloquee la entrada. El relleno previo es local y se realiza tanto si **Use my details** está activado como si no.

**Crédito.** Cuando exportas, tus datos pueden viajar como crédito de autor en los metadatos del archivo (PNG, PDF, SVG y más). **Use my details to create** controla este crédito y el autor en las ejecuciones de Lolly Batch. Con el interruptor desactivado, la exportación sigue indicando que se hizo con Lolly, pero no lleva autor personal ni línea de contacto.

Autores de herramientas: consultad [`bindToProfile`](/info/tool-inputs.html#bindtoprofile) y [`host.profile`](/info/host-api.html#host-profile).

![El único interruptor Use my details to create, marcado como opcional y desactivado hasta que lo activas](/t/url-shot?url=%2F%23%2Fsettings%3Ffocus%3Duse-details&width=1440&height=900&dpi=192&waitMs=1600&format=svg&cropSelector=.profile-check&walker=1&dark=1&filename=pd-use-my-details)

<!--i:eti-layers-->
## Perfil, design system y capacidades

En Settings hay tres cosas cerca unas de otras que es fácil confundir:

- <!--i:people--> **Profile** - tú, tu equipo o el rol que desempeñas: nombre, contacto, foto de perfil y trabajo guardado. Personal, guardado en el dispositivo y portable como archivo.
- <!--i:palette--> **Design system** - la marca: colores, fuentes y ajustes con los que renderiza cada herramienta. Compartido, no personal; consulta [Lolly Design System Setup](/info/brand-studio.html).
- <!--i:sliders--> **Capabilities** - lo que puede hacer la aplicación: las funciones y herramientas disponibles para ti.

La palabra tiene otros tres significados en Lolly. Un **perfil de contenido** es un ajuste de compilación que elige qué herramientas y catálogo incluye un despliegue; el [Glosario](/info/glossary.html) define el término. El parámetro de enlace `profile` selecciona un perfil de color para una exportación, como una condición de impresión CMYK; consulta [Parámetros de URL reservados](/info/url-parameters.html#print). Una **identidad verificada** es el certificado de firma opcional que vincula tu correo electrónico con tus exportaciones firmadas. Es independiente de estos datos, pero **Use my details to create** decide si se incrusta cualquiera de los dos; consulta [Content Credentials](/info/content-credentials-identity.html).

![La tarjeta Verified identity, con el ancho de un teléfono: el selector de duración del certificado y el paso de registro debajo - el perfil de identidad, independiente de tus datos personales](/t/url-shot?url=%2F%23%2Fsettings%3Ffocus%3Didentity-section&width=430&height=1600&dpi=192&waitMs=2400&css=.welcome-dialog%2C.personalize-nudge%7Bdisplay%3Anone%7D&format=svg&walker=1&cropSelector=%23identity-section&dark=1&filename=pv-identity-enrol)

<!--i:eti-lock-->
## Privacidad

Tu perfil personal se almacena localmente. Tus datos pueden viajar en una copia de seguridad o de Sync, en el contenido que compartes o exportas y durante el registro opcional en Content Credentials. En una instancia de Lolly Work, el inicio de sesión, el trabajo compartido, la política de telemetría y los registros de auditoría son independientes de este perfil local. **Settings → Preferences → Clear all my data** borra los datos de este dispositivo; no borra las copias que conserve tu proveedor de almacenamiento o tu organización. Consulta la [Política de privacidad](/info/privacy.html).
