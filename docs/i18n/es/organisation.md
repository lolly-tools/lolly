# Usa Lolly en tu organización

Tu organización puede operar su propio Lolly: la misma aplicación, con las herramientas y los design systems que haya elegido. Descubre cómo acceder, iniciar sesión y qué cambia.

Para planificar la configuración de la organización, [Usar Lolly con tu DAM actual](/info/use-with-dam.html) explica cómo mantener una biblioteca aprobada donde está mientras las personas crean contenido en Lolly. [Soberanía del contenido](/info/content-sovereignty.html) describe el control más amplio sobre la creación, la gobernanza, el almacenamiento y la portabilidad.

::: note Qué necesitas de tu organización
La dirección web de su Lolly o un archivo de configuración `.lolly` creado por tu organización. lolly.tools por sí solo no se conecta a una organización.
:::

<!--i:eti-globe-->
## En un navegador

Abre la dirección que te dio tu organización. Si la página te pide iniciar sesión, pulsa **Sign in** y sigue las indicaciones de la página de inicio de sesión que se abre. Después, Lolly funciona como siempre, con las herramientas y los design systems de tu organización.

También puedes empezar desde lolly.tools: abre la vista **Settings** y, en la tarjeta **Lolly instance**, pulsa **Open a workspace**, introduce la dirección y pulsa **Open this instance**. El navegador va a la dirección propia de tu organización, porque un navegador no puede cargar las herramientas de otro Lolly desde lolly.tools.

![La tarjeta Lolly instance de Settings, donde abres el espacio de trabajo de tu organización o cambias de dónde obtiene la aplicación sus herramientas](/t/url-shot?url=%2F%23%2Fsettings%3Ffocus%3Dinstance-section&width=1440&height=1400&dpi=192&waitMs=2000&format=svg&cropSelector=%23instance-section&walker=1&dark=1&filename=org-instance-card)

<!--i:eti-monitor-->
## En la aplicación de escritorio o móvil

La aplicación arranca con las herramientas que incluye. Para conectarte, abre la vista **Settings** y pulsa **Change** en la tarjeta **Lolly instance**. El panel pregunta **Where should Lolly get its tools?**

1. Elige **Connect to a Lolly instance**.
2. Introduce la dirección web de tu organización y pulsa **Check & connect**.
3. Pulsa **Use this instance**. La siguiente pantalla, **Import your data (optional)**, transfiere trabajo guardado desde una copia de seguridad de Lolly. Pulsa **Skip** si no tienes ninguna.
4. Inicia sesión si la aplicación te lo pide.

Las herramientas de una instancia conectada se ejecutan con la misma confianza que las propias de la aplicación, así que conéctate solo a una en la que confíes. Tu organización puede enviarte en su lugar un archivo de configuración `.lolly` que conecte la aplicación por ti.

Para cambiar más adelante, usa **Change** otra vez o **Leave** en la misma tarjeta.

### Iniciar sesión con un código

En las aplicaciones de escritorio y móvil, la pantalla de inicio de sesión también ofrece un código corto cuando el Lolly de tu organización admite iniciar sesión con código. Pulsa **Open sign-in in browser**, inicia sesión y aprueba el código allí. O abre la dirección que muestra la pantalla en un teléfono u ordenador donde ya hayas iniciado sesión e introduce el código. El código dura unos diez minutos.

<!--i:eti-sliders-->
## Qué cambia allí

- **Algunos controles vienen fijados.** Un control gestionado por tu organización muestra **Managed by** y el nombre de la organización, o **Managed by your organisation**. Un control fijado no se puede cambiar y un menú puede ofrecer solo algunas de sus opciones. Algunos controles están ocultos. La consola de tu organización registra qué regla fijó un control y por qué. Pregunta a quien opere el Lolly de tu organización.
- **Algunos design systems están bloqueados.** Un design system que proporciona tu organización muestra un candado y se mantiene en modo de solo lectura. Para probar cambios, crea una copia editable en **Settings → Preferences → Design systems**.
- **Solo aparecen sus herramientas.** Una herramienta que tu organización no ofrece no se muestra.
- **Proyectos compartidos.** Si tu organización comparte proyectos contigo, **Projects** muestra una tarjeta **Team projects**. Estas sesiones residen en el servidor de la organización. Abre una para trabajar en ella o inicia una [colaboración de trabajo](/info/collaborate.html#collabs-through-lolly-work-optional) desde **Share** cuando esté disponible.
- **Algunas exportaciones pueden necesitar aprobación.** Cuando tu organización exige aprobación, **Request approval** ocupa el lugar de **Download** y una herramienta puede ofrecer menos formatos.
- **Tu pantalla de inicio puede abrirse en las plantillas.** Si tu organización publica plantillas para ti, como podría hacer para una empresa asociada, tu pantalla de inicio las muestra en lugar del saludo de la primera visita. Cada plantilla es una tarjeta, con **Your copy** para continuar y **New version** cuando la plantilla cambia. Consulta [Plantillas para socios](/info/work-partner-templates.html).

### Qué se queda dónde

::: cols
## En este dispositivo

- Lo que guardas por tu cuenta, salvo que actives [Sync](/info/sync.html)
- Los design systems que creaste tú
- Todo lo que creas y descargas

## En el servidor de tu organización

- Tu identidad de inicio de sesión y la información del dispositivo
- Proyectos de equipo, sesiones compartidas y ediciones en vivo en una colaboración de trabajo
- Recursos que subes a la biblioteca compartida
- Solicitudes de aprobación y entregas aprobadas
- Un registro de tus inicios de sesión y de lo que haces allí
:::

Con un espacio de trabajo conectado, la línea sobre privacidad de la primera pantalla de la aplicación dice lo mismo. Las aplicaciones propias de Lolly no envían eventos de uso al espacio de trabajo. [Privacidad](/info/privacy.html#organisation-services-with-lolly-work) enumera lo que almacena el servidor y quién controla esos datos.

<!--i:eti-building-->
## Qué añade Lolly Work

El servidor de tu organización ejecuta **Lolly Work**, el software para organizaciones del mismo proyecto de código abierto. La aplicación no necesita una cuenta de trabajo ni Lolly Work cuando la usas por tu cuenta.

::: details Qué puede añadir Lolly Work
Tu organización aloja [Lolly Work](https://github.com/lolly-tools/lolly-work) junto con Lolly y elige qué funciones activar:

- **Inicio de sesión y acceso.** Inicio de sesión único de la organización, permisos por grupos y campos de perfil gestionados. Los administradores pueden aprovisionar y desactivar cuentas mediante SCIM.
- **Trabajo compartido.** Proyectos de equipo, sesiones compartidas y [colaboraciones de trabajo](/info/collaborate.html#collabs-through-lolly-work-optional), con edición en vivo a través del servidor de la organización.
- **Una biblioteca de recursos compartida.** Recursos subidos, colecciones y bibliotecas conectadas, con reglas de acceso, versiones y revisión.
- **Revisión y entrega.** Pasos de aprobación, enlaces gestionados con caducidad o revocación y entrega a destinos permitidos por la organización.
- **Administración.** Un registro de auditoría de las acciones sujetas a políticas e informes de uso conforme a la política de telemetría de la instancia para los clientes que envían eventos de uso. Las aplicaciones propias de Lolly no envían ninguno actualmente.
:::

Para configurar el servicio, empieza por [Despliegue](/info/deployment.html#organisation-services-with-lolly-work). La demo pública en [lolly.work](https://lolly.work) es un entorno de pruebas. Usa la dirección propia de tu organización para el trabajo que necesites conservar.

<!--i:eti-palette-->
## La marca de otra organización

Un socio, cliente o patrocinador puede enviarte su marca como archivo de design system (`.lolly`) en lugar de una dirección. Abrir ese archivo no conecta la aplicación a nada. El archivo añade su design system junto al tuyo en este dispositivo. Un archivo de configuración de tu propia organización conecta la aplicación al Lolly de la organización. Antes de que cambie nada, la vista previa muestra qué hará abrir un archivo. [Trabajar con socios](/info/partners.html) cubre ambos lados del trabajo con la marca de otra organización.

<!--i:eti-unlink-->
## Desconectarte

**Leave**, en la tarjeta **Lolly instance** de **Settings**, elimina el design system, las herramientas y el catálogo de tu organización. Tu propio trabajo se conserva. Lo que hayas creado con sus herramientas no volverá a abrirse hasta que te conectes de nuevo. Cuando el Lolly de tu organización lo ofrece, **Sign out everywhere** en la misma tarjeta cierra tus sesiones en todos los dispositivos, incluido este.

Todo lo que guardaste en la organización permanece en ella, conforme a sus políticas de acceso y retención. Desconectarte o borrar los datos de este dispositivo no elimina esa copia del servidor. En un navegador abierto en la dirección propia de tu organización no hay nada de lo que desconectarse: abre otra dirección.

<!--i:eti-help-->
## A quién preguntar

Tu organización decide qué llega a su servidor, quién puede ver sus proyectos compartidos y qué ajustes quedan fijados. Pregunta a quien opere el Lolly de tu organización. [Privacidad](/info/privacy.html) explica qué hace Lolly con tus datos.
