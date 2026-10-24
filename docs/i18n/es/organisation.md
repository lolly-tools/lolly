# Usa Lolly en tu organización

Tu organización puede operar su propio Lolly: la misma aplicación, con las herramientas y los design systems que eligió. Esta página muestra cómo acceder, iniciar sesión y qué cambia cuando lo haces.

::: note Lo que necesitas de tu organización
La dirección web de su Lolly, o un archivo de configuración `.lolly` que haya creado tu organización. lolly.tools por sí solo no se conecta a ninguna organización.
:::

## En un navegador

Abre la dirección que te dio tu organización. Si la página te pide iniciar sesión, pulsa **Sign in** y sigue la página de inicio de sesión que abre. Después funciona como cualquier Lolly, con las herramientas y los design systems de tu organización.

También puedes empezar desde lolly.tools: abre **Settings**, y en la tarjeta **Lolly instance** pulsa **Open a workspace**, introduce la dirección y pulsa **Open this instance**. El navegador va a la propia dirección de tu organización, porque un navegador no puede cargar desde lolly.tools las herramientas de otro Lolly.

![La tarjeta Lolly instance en Settings, donde abres el espacio de trabajo de tu organización o cambias de dónde obtiene la aplicación sus herramientas](/t/url-shot?url=%2F%23%2Fsettings%3Ffocus%3Dinstance-section&width=1440&height=1400&dpi=192&waitMs=2000&format=svg&cropSelector=%23instance-section&walker=1&dark=1&filename=org-instance-card)

## En la app de escritorio o móvil

La aplicación empieza con sus herramientas incluidas. Para conectar, abre **Settings** y pulsa **Change** en la tarjeta **Lolly instance**. La hoja pregunta **Where should Lolly get its tools?**

1. Elige **Conectar con una instancia de Lolly**.
2. Introduce la dirección web de tu organización y pulsa **Comprobar y conectar**.
3. Pulsa **Usar esta instancia**. La siguiente pantalla, **Importa tus datos (opcional)**, trae el trabajo guardado desde una copia de seguridad de Lolly; pulsa **Omitir** si no tienes ninguna.
4. Inicia sesión si la app lo pide.

Las herramientas de una instancia conectada se ejecutan con la misma confianza que las propias de la app, así que conéctate solo a una en la que confíes. Tu organización también puede enviarte un archivo de configuración `.lolly` que conecta la app por ti.

Para cambiar más tarde, usa **Change** de nuevo, o **Leave** en la misma tarjeta.

### Iniciar sesión con un código

En las aplicaciones de escritorio y móviles, la pantalla de inicio de sesión también ofrece un código corto, cuando el Lolly de tu organización admite el inicio de sesión con código. Pulsa **Open sign-in in browser**, inicia sesión y aprueba allí el código. O abre la dirección que muestra en un teléfono u ordenador donde ya hayas iniciado sesión, e introduce el código. El código dura unos diez minutos.

## Qué cambia ahí

- **Algunos controles vienen ya definidos.** Un control que gobierna tu organización muestra **Managed by** y el nombre de la organización, o **Managed by your organisation**. Un control fijo no se puede cambiar, un menú puede ofrecer solo algunas de sus opciones, y una línea que empieza por **Set by** puede indicar qué regla se aplica y por qué. Algunos controles no se muestran en absoluto.
- **Algunos design systems están bloqueados.** Un design system que aporta tu organización muestra un candado y es de solo lectura. Para probar cambios, crea una copia editable en **Settings → Preferences → Design systems**.
- **Solo se enumeran sus herramientas.** Una herramienta que tu organización no ofrece no se muestra en absoluto.
- **Proyectos compartidos.** Si tu organización comparte proyectos contigo, **Projects** muestra un mosaico **Team projects**. Estas sesiones viven en el servidor de la organización. Abre una para trabajar en ella, o inicia una [collab de trabajo](/info/collaborate.html#work-collabs-with-lolly-work-optional) desde **Share** cuando esté disponible.
- **Algunas exportaciones pueden necesitar aprobación.** Donde tu organización pide aprobación, **Request approval** ocupa el lugar de **Download**, y una herramienta puede ofrecer menos formatos.

### Qué se queda dónde

::: cols
## En este dispositivo

- Tus propios guardados, a menos que actives [Sync](/info/sync.html)
- Design systems que creaste tú mismo
- Todo lo que creas y descargas

## En el servidor de tu organización

- Tu identidad de inicio de sesión y la información del dispositivo
- Proyectos de equipo, sesiones compartidas y ediciones en vivo en una collab de trabajo
- Recursos que subes a la biblioteca compartida
- Solicitudes de aprobación y entregas aprobadas
- Eventos de uso, donde tu organización los active
:::

[Privacy](/info/privacy.html#organisation-services-with-lolly-work) enumera lo que almacena el servidor y quién controla esos datos.

## Qué añade Lolly Work

El servidor de tu organización ejecuta **Lolly Work**, el software de organización del mismo proyecto de código abierto. La aplicación no necesita ni una cuenta de trabajo ni Lolly Work cuando la usas por tu cuenta.

::: details Qué puede añadir Lolly Work
Tu organización aloja [Lolly Work](https://github.com/lolly-tools/lolly-work) junto a Lolly y elige qué funciones activar:

- **Inicio de sesión y acceso.** Inicio de sesión único de la organización, permisos basados en grupos y campos de perfil gestionados. Los administradores pueden aprovisionar y desactivar cuentas mediante SCIM.
- **Trabajo compartido.** Proyectos de equipo, sesiones compartidas y [collabs de trabajo](/info/collaborate.html#work-collabs-with-lolly-work-optional), con edición en vivo a través del servidor de la organización.
- **Una biblioteca de recursos compartida.** Recursos subidos, colecciones y bibliotecas conectadas, con reglas de acceso, versiones y revisión.
- **Revisión y entrega.** Pasos de aprobación, enlaces gestionados con caducidad o revocación, y entrega a los destinos que la organización permite.
- **Administración.** Informes de uso bajo la política de telemetría de la instancia, además de un registro de auditoría de las acciones gobernadas.

Si estás configurando el servicio, empieza por [Deployment](/info/deployment.html#organisation-services-with-lolly-work). La demo pública en [lolly.work](https://lolly.work) es un entorno de pruebas; usa la propia dirección de tu organización para el trabajo que necesites conservar.
:::

## Salir

**Leave**, en la tarjeta **Lolly instance** de **Settings**, elimina el design system, las herramientas y el catálogo de tu organización. Tu propio trabajo se queda. Lo que hayas creado con sus herramientas no volverá a abrirse hasta que te reconectes.

Todo lo que guardaste en la organización se queda con la organización, bajo sus políticas de acceso y conservación. Salir o limpiar este dispositivo no elimina esa copia del servidor. En un navegador en la propia dirección de tu organización no hay nada de lo que salir: abre otra dirección en su lugar.

## A quién preguntar

Lo que llega al servidor de tu organización, quién puede ver sus proyectos compartidos y qué ajustes son fijos son decisiones de tu organización. Pregunta a quien administre el Lolly de tu organización. [Privacidad](/info/privacy.html) cubre lo que Lolly mismo hace con tus datos.
