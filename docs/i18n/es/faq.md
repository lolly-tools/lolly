# Preguntas y respuestas

Preguntas frecuentes, renderizadas como el acordeón de `/info/start/faq.html`.

**Cómo mantenerlo:** cada encabezado `##` de abajo es una pregunta. Todo lo que hay bajo el encabezado,
hasta el siguiente `##`, es la respuesta. Las respuestas usan el markdown ligero del sitio:
separa los párrafos con una línea en blanco. Añade, elimina o reordena preguntas aquí y
vuelve a ejecutar `pnpm run build:info` (o `pnpm run dev:web`).
La compilación ignora todo lo anterior al primer `##` (este título y estas notas).

El orden es el de alguien que llega por primera vez: primero la trampa, luego tus archivos, después obtener
y ejecutar Lolly, luego las organizaciones y después cómo se hizo. El ancla de cada pregunta
se genera a partir de la pregunta en inglés en la misma posición, así que una traducción conserva
el orden del inglés.

## ¿Por qué es gratis? ¿Dónde está la trampa?

**Creamos Lolly para nosotros mismos.** SUSE necesitaba miles de archivos que respetaran su marca, hechos sin entregar nada a servicios externos. Así que creamos una herramienta que lo hace todo en el dispositivo y la publicamos como código abierto, como todo lo demás que hacemos. Seguimos manteniéndola porque la usamos a diario. **No hay ninguna obligación:** todo lo que hay aquí funciona con o sin nosotros.

Ese límite lo marca la licencia, no una promesa: todo lo que se ejecuta localmente es gratis, para siempre. Una versión publicada tiene una licencia que impide retirarla. Ningún acuerdo de contribución podría cambiar la licencia del trabajo de nadie.

## ¿Cuánto mantiene SUSE en privado? (o cuándo cambiarán las reglas por sorpresa)

El motor, las interfaces, los esquemas y las herramientas independientes de la marca son de código abierto. Las marcas registradas de SUSE y sus herramientas de marca se mantienen privadas y ya están separadas. La instancia pública de [lolly.tools](https://lolly.tools) ejecuta [Lolly Demo](/info/lolly-demo.html), el design system propio de Lolly.

Nada aquí depende de una promesa: toda versión publicada sigue siendo de código abierto. Cuando otra empresa cerró el código fuente de su Linux empresarial en 2023, SUSE cofundó [OpenELA](https://openela.org) para mantener ese código abierto. Este proyecto hereda esa postura.

SUSE *sí* está creando herramientas internas para conectar Lolly con sus propios sistemas informáticos. Esa es la configuración interna de SUSE, no una división entre desarrollo público y privado. Lolly también aspira a compilarse a través de [Open Build Service](https://openbuildservice.org/), con artefactos de una cadena de suministro segura entregados por [SUSE Application Collection](https://apps.rancher.io/applications).

## ¿Por qué el nombre "Lolly Tools"?

**Lolly** porque la libertad es dulce, y porque en Australia, Nueva Zelanda y Gran Bretaña una lolly es una golosina.

**Tools** porque una herramienta se queda quieta hasta que la coges. No se ejecuta cuando no la usas, y no te observa mientras la usas.

## ¿Por qué todo es verde?

lolly.tools se abre con [Lolly Demo](/info/lolly-demo.html), el design system de ejemplo propio de Lolly, cuyo color principal es el verde. Cambia a **Lolly Starter**, un design system en blanco, o al tuyo en [Settings → Design systems](/#/settings?focus=design-systems-section).

## ¿Puedo usar mi propia marca?

Sí. **Lolly Design System Setup** (`#/start`) crea un design system a partir de un color, un archivo de tokens de diseño o un diseño terminado. Todas las herramientas dibujan entonces con tu design system. [Empezar](/info/quickstart.html#put-your-brand-in) recorre las tres vías.

Un design system que proporciona tu organización o tu compilación está gestionado. Muestra un candado y se mantiene en modo de solo lectura. Para cambiarlo, haz una copia editable.

## ¿Dónde está lo que hice ayer?

Si pulsaste **Save as** o **Save**, tu trabajo está en **Projects** en la pantalla de inicio, en el navegador o la aplicación desde donde lo guardaste. Si solo pulsaste **Download**, el archivo está en las descargas de tu navegador o sistema, y suele haber una copia en **Assets**. Las herramientas que [guardan mientras trabajas](/info/find-your-work.html#which-tools-save-as-you-work) también conservan el trabajo sin guardar en **Projects**. [Encontrar y recuperar tu trabajo](/info/find-your-work.html) cubre todos los casos.

## Cerré la pestaña. ¿He perdido mi trabajo?

El trabajo guardado sigue en **Projects**. El trabajo sin guardar se pierde, excepto en las herramientas que guardan mientras trabajas, que también lo conservan en **Projects**. La próxima vez, pulsa **Save as** antes de salir. Consulta [Si cerraste la pestaña o saliste de la herramienta](/info/find-your-work.html#if-you-closed-the-tab-or-left-the-tool).

## ¿Puedo compartir mi trabajo como archivo en lugar de un enlace?

Sí. Cuando un enlace no puede llevarlo todo, como tus propias fotos o un texto largo, el diálogo Share dice qué faltaría y ofrece un archivo **.lolly**. Ese único archivo contiene el diseño, las imágenes que usa y, si lo eliges, la herramienta.

Tú decides cuánto viaja. Tu nombre y tus datos solo se incluyen si lo autorizas en tu perfil. Las ilustraciones con licencia se excluyen salvo que elijas incluirlas. A quien abre un archivo que lleva una herramienta se le pregunta si confía en ella antes de que pueda ejecutarse. Consulta [Compartir tu trabajo](/info/using.html#sharing-your-work).

## ¿Para qué sirven los datos de mi perfil?

Tus datos de **Settings** rellenan de antemano las herramientas que los piden, como un nombre en una insignia. Se quedan en este dispositivo. No se incluye nada en lo que creas salvo que actives la opción. Entonces los datos que elijas se incorporan de forma sellada y te identifican como la fuente.

Compartir y Sync envían solo el contenido que eliges. En una instancia de Lolly Work de una organización, las sesiones compartidas y el trabajo sujeto a sus normas también van a ese servidor. Consulta [Privacidad](/info/privacy.html).

## ¿Cómo consigo las aplicaciones móviles o de escritorio?

Descárgalas desde [Instalar Lolly](/info/install.html). La página enumera todas las compilaciones para macOS, Windows, Linux y Android, y muestra cómo comprobar el archivo que descargaste. En iPhone y iPad, **Lolly Tools** se obtiene del App Store. [La sección de iPhone y iPad](/info/install.html#iphone-and-ipad) tiene el enlace.

Cualquiera puede también compilar y distribuir su propia copia de la aplicación, con las herramientas y los ajustes que necesita su público. La [Guía de compilación](/info/build-guide.html) explica cómo.

## Lolly dice que necesita WebGPU. ¿Qué puedo hacer?

La aplicación web dibuja con WebGPU, una función gráfica de los navegadores actuales, y comprueba si hay WebGPU antes de abrir una herramienta. Prueba esto en orden:

1. Actualiza tu navegador a la versión actual.
2. Activa la aceleración gráfica o por hardware en los ajustes del navegador y luego reinicia el navegador.
3. Prueba un navegador probado: [Entornos compatibles](/info/supported-environments.html) los enumera.
4. En un Mac, iPhone o iPad, [instala la aplicación](/info/install.html) en su lugar.

## ¿Puede Lolly editar y renderizar mis archivos de Figma, Penpot, Illustrator o InDesign?

Sí. Abre la herramienta **Design** y haz clic en **Import a design**: acepta un **.fig** nativo de Figma (Save local copy), una exportación **.penpot** de Penpot, un **.ai** o **.pdf** de Illustrator, un **.idml** o **.indd** de InDesign, un documento de Affinity, un **.psd** de Photoshop, un **.pptx** de PowerPoint, un **.dxf** de CAD o **cualquier SVG** ([todos los formatos que lee](/info/design-import.html#what-comes-in-from-each-app)). No necesitas cuenta, plugin ni licencia de una aplicación de diseño.

![El lienzo abierto de Lolly Design - Import a design está en el menú de Lolly de la barra de herramientas](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Fz%3D17ZTfS8MwEMf_mryO5NZ288GHrdqJv1CUvWdtOgppMtJMNv96yaV1iRNEQRBZoblwab53l0-uq915bXgrCOSDpf3LzgANnQ4eI0rrPJn7Gh9cd0sE8lIryxtFIFfatFx6L4F0Mi-11GbUiZYr25QjK3bW-S8I5MnUbRXKCkMgb5uqki6JFFU7rjoXYsSgT8GaLebKZSeGAPkUYypMHp80DeugYYR4J_U7X4XRkY8dFHuTYEJ-jDWM3qoqsEHo4Y20-xJi-SPVaOfRUuAL1hiZXNrG4gH6M85Z5lTAk8x8DdlnPL8gecVfBIEU6F5v0bbCor3VUu4JpOPCKTCWsPI9rBS107d6QyCfRET_Ac6wX36X6UpX-49Ip1mAlMEPkM6QX20aoSpECLTmpadcazPQ9hPlWxboRndWmFEIG1s4Yp3E3Ts-0f4GbcruWHLzlC0frmfpfbGk82LxmD0vUndSTcvXAoknWBKCz5LDSIdiRHV0D2Tfq1BIvdY42Zim5WZ_-n3_mRvwBg&width=1360&height=850&dpi=192&waitMs=3000&format=svg&walker=1&chrome=1&localize=1&dark=1&filename=design)

Las capas llegan como cuadros editables. El texto se puede seguir reescribiendo, las formas siguen siendo formas y las imágenes se añaden a tu biblioteca. Una vez guardado el diseño, **Share with rules** puede convertirlo en una herramienta que cualquiera con Lolly puede volver a rellenar. Consulta [Importar un diseño](/info/design-import.html).

## ¿Pueden dos personas trabajar en el mismo diseño sin internet?

Sí. Una persona comparte una invitación (un enlace, un código QR o un código corto) y la otra la acepta. Ambos dispositivos mantienen entonces la misma sesión en vivo, con presencia y anillos de foco. Esto funciona en cualquier red compartida, incluido el punto de acceso de un teléfono, porque no hay ningún servidor de por medio. Consulta [Trabajar juntos](/info/collaborate.html). Para colegas en redes distintas, una instancia de Lolly Work de una organización ofrece colaboraciones de trabajo autenticadas.

## ¿Qué son los indicadores de función?

Los indicadores de función activan o desactivan partes de Lolly. En el uso independiente, eliges tus ajustes personales. Una organización que usa Lolly Work puede definir valores predeterminados u ocultar determinados interruptores según su política, y los controles gestionados están etiquetados. Consulta [Usar Lolly en tu organización](/info/organisation.html).

![Indicadores de función personales en la aplicación independiente; la política de la organización puede controlar determinados interruptores](/t/url-shot?url=%2F%23%2Fprofile%3Ffocus%3Dfeature-flags&width=1440&height=1800&dpi=192&waitMs=2000&format=svg&cropSelector=%23feature-flags-section&walker=1&dark=1&filename=pd-feature-flags)

## ¿Qué diferencia a las utilidades de las herramientas?

Una utilidad hace una tarea rápida con un archivo que ya tienes, como comprimir un PDF, convertir una foto o eliminar datos ocultos. Muchas se ejecutan en tu dispositivo sin subir nada. Las utilidades mantienen dentro de Lolly las tareas que la gente suele encargar a un sitio web cualquiera. Comprimir un contrato, convertir fotos de vacaciones que aún contienen su ubicación o pegar un token en un formateador en línea no debería significar entregar el archivo a un sitio cuya retención, jurisdicción y modelo de negocio desconoces. [Lolly Utilities](/info/utilities.html) las enumera, y [El trato que nunca aceptamos](/info/status-quo.html) cuenta la historia detrás de ellas.

![La vista Utilities: Lolly Strip Hidden Data, Compress PDF, Convert Image y las otras tareas que se ejecutan en el dispositivo, todas en un mismo lugar](/t/url-shot?url=%2F%23%2Fu&width=1440&height=900&dpi=192&waitMs=1600&css=.welcome-dialog%2C.personalize-nudge%7Bdisplay%3Anone!important%7D&tolerance=0.03&format=svg&walker=1&dark=1&filename=use-utilities&try=1)

## ¿Puede nuestra organización usar SSO, proyectos compartidos y aprobaciones?

Sí, con **Lolly Work**, el servidor para organizaciones del mismo proyecto de código abierto. Se ejecuta por separado y añade inicio de sesión único a través de tu proveedor de identidad, aprovisionamiento SCIM, permisos de grupo, proyectos y recursos compartidos, colaboraciones de trabajo en vivo, aprobaciones y registros de auditoría. La aplicación de uso diario sigue funcionando por sí sola.

[Usar Lolly en tu organización](/info/organisation.html) explica cómo iniciar sesión y encontrar trabajo compartido. [Despliegue](/info/deployment.html#organisation-services-with-lolly-work) explica cómo configurar Lolly Work. El contenido compartido y los registros de la organización siguen las políticas de privacidad y retención de esa instancia.

## ¿Qué dificultades puedo esperar al adoptar Lolly?

Sobre todo, cambios en cómo produce trabajo un equipo, no en la tecnología. Un equipo que quiere un conjunto de herramientas sujeto a normas necesita a alguien que cree su design system y las primeras plantillas. Cualquiera puede crear sus propias herramientas en Lolly Design desde el primer día, sin necesitar git. Los procesos existentes siguen funcionando incluso cuando su resultado no respeta la marca. Adaptar bien un resultado visible, con el antes y el después uno junto al otro, demuestra su utilidad más rápido que un plan.

[Adopción y gobernanza](/info/adoption-governance.html) explica la incorporación según el rol, cómo medir una prueba piloto y cómo puede ser un proceso de gobernanza.

## ¿Se programó Lolly mediante "vibe coding"?

Lolly se desarrolló con programación asistida por IA, exploración asistida por IA y, en muchos casos, contenido asistido por IA, usando una combinación de modelos y proveedores, incluidos los de empresas de modelos de vanguardia en la nube pública. Una persona creó la arquitectura, seleccionó y revisó el código con intención y dirigió artísticamente la experiencia.

Un aviso de gravedad alta o crítica en las dependencias de Lolly bloquea CI. Un aviso que aún no se puede corregir solo se deja pendiente como excepción aprobada con un motivo por escrito. [SECURITY.md](https://github.com/lolly-tools/lolly/blob/main/SECURITY.md#dependency-audit-exceptions) enumera cada excepción vigente, y las [notas de versión](https://github.com/lolly-tools/lolly/releases) enumeran las que lleva cada versión. SECURITY.md también explica cómo comunicar una vulnerabilidad.

Las comprobaciones de la compilación también rechazan expresiones que parecen escritas por una máquina en los comentarios del código, la aplicación y esta documentación, para que el texto sea sencillo para todos los lectores. Un efecto secundario es que a un detector le puede costar más distinguir qué texto escribió un modelo. No nos propusimos causar eso.

Por encima de todo, Lolly se apoya en décadas de trabajo de código abierto de expertos de todo el mundo.

**Declaración de uso de IA generativa:**

- **Código escrito por LLM:** Opus 4.8, Gemini 3.1, Qwen3-Coder-Next, Codex Sol (esta lista puede ampliarse)
- **Exploración con LLM:** Gemini 3.1, Fable, Codex Astra
- **Documentación:** Sonnet 5
- **Bibliotecas de código abierto:** Sus respectivos autores, indicados en la SBOM, los comentarios y las cabeceras de los archivos

Esta lista no incluye los modelos incorporados a Lolly.

**Aportaciones humanas:**
- **Ideación, revisión y comentarios:** Ravan Naidoo, Matthias Eckermann, Kelly Andrews, Ryan Kleeman, Peter Chamalian, la Penpot Community, Tim Hildred (lista no exhaustiva)
- **Arquitectura, dirección de arte & limpieza de contenido basura:** Andy Fitzsimon

## ¿Dónde están las herramientas con la marca SUSE?

Están en un repositorio privado aparte. Una clonación pública no descarga el paquete de marca de SUSE, así que una compilación a partir de ella usa el perfil neutro `lolly-start` salvo que elijas otro. Ese perfil incluye las herramientas de la comunidad independientes de la marca y una marca en blanco que rellenas con la tuya. [lolly.tools](https://lolly.tools) se compila con el perfil `lolly-demo` y se abre en [Lolly Demo](/info/lolly-demo.html), el design system propio de Lolly. SUSE opera su propia instancia para proteger sus marcas registradas.

## ¿De qué sabor es ese logotipo de Lolly?

Hay quien dice lima, otros dicen menta y a veces manzana. Lolly pone el dulzor y tú creas el sabor.

## ¿Qué entiende Lolly por soberanía del contenido?

El control sobre cómo se crea, gestiona, almacena y mueve tu contenido entre los sistemas que eliges. Lolly permite la producción local, el trabajo editable y las herramientas portables. Lolly Work añade servicios compartidos controlados por la organización. Las licencias de las fuentes, las dependencias disponibles y los flujos de datos del proceso siguen siendo relevantes. [¿Qué es la soberanía del contenido?](/info/content-sovereignty.html) explica cada control y sus límites.

## ¿Podemos conservar nuestro DAM actual?

Sí. Un DAM compatible puede seguir siendo la fuente de referencia mientras Lolly Work conecta los recursos seleccionados con las herramientas de Lolly. El acceso a las fuentes, las ediciones permitidas, los derechos de uso y la aprobación del resultado final son decisiones independientes. [Usar Lolly con tu DAM actual](/info/use-with-dam.html) explica cómo se organiza, y [la experiencia de SUSE con Brandfolder](/info/suse-brandfolder.html) documenta su uso satisfactorio durante la adopción.
