# Preguntas y respuestas

Preguntas frecuentes, presentadas como el acordeón de `/info/start/faq.html`.

**Cómo mantenerlo:** cada encabezado `##` de abajo es una pregunta; todo lo que hay debajo
(hasta el siguiente `##`) es la respuesta. Las respuestas usan el mismo markdown ligero que
el resto del sitio - separa los párrafos con una línea en blanco. Añade, quita o
reordena preguntas aquí y vuelve a ejecutar `pnpm run build:info` (o `pnpm run dev:web`).
Todo lo que está por encima del primer `##` (este título y estas notas) lo ignora la compilación.

El orden es el de quien llega por primera vez: primero la trampa, luego tus archivos,
luego conseguir y ejecutar Lolly, luego las organizaciones, luego cómo se hizo. El ancla de cada pregunta
se construye a partir de la pregunta en inglés en la misma posición, así que una traducción conserva el
orden en inglés.

## ¿Por qué es gratis? ¿Dónde está la trampa?

**Creamos Lolly para nosotros mismos.** SUSE necesitaba miles de archivos fieles a la marca, creados sin entregar nada a servicios externos. Así que creamos una herramienta que lo hace todo en el dispositivo, y la publicamos como código abierto, como todo lo demás que hacemos. Seguimos manteniéndola porque la usamos cada día. **No hay obligación:** todo lo de aquí funciona con nosotros o sin nosotros.

Esa línea se traza en la licencia, no en una promesa: todo lo que se ejecuta en local es gratuito, para siempre. Una versión publicada se licencia de modo que no se pueda retirar, y no existe ningún acuerdo de contribuidores que pudiera relicenciar el trabajo de nadie.

## ¿Cuánto se guarda SUSE en privado? (o sea, ¿cuándo llega el cambiazo?)

El motor, los shells, los esquemas y las herramientas independientes de marca son de código abierto. Las marcas registradas de SUSE y las herramientas con su marca son la parte que sigue siendo privada, y ya están separadas. La instancia pública en [lolly.tools](https://lolly.tools) ejecuta [Lolly Demo](/info/lolly-demo.html), el design system del propio Lolly.

Nada de esto descansa en una promesa: cada versión publicada sigue siendo de código abierto, y lo único que se reserva es la marca registrada. Cuando otra empresa cerró en 2023 sus fuentes de Linux empresarial, SUSE cofundó [OpenELA](https://openela.org) para mantener abierto ese código, la misma postura que hereda este proyecto.

Transparencia total: SUSE *sí* está creando herramientas internas para conectar Lolly con sus propios sistemas de TI. Es la configuración interna de SUSE, no una división entre desarrollo público y privado. Lolly también aspira a compilarse mediante [Open Build Service](https://openbuildservice.org/), con artefactos seguros de cadena de suministro entregados por la [SUSE Application Collection](https://apps.rancher.io/applications).

## ¿Por qué el nombre «Lolly Tools»?

**Lolly** porque la libertad es dulce y porque en Australia, Nueva Zelanda y Gran Bretaña una lolly es un caramelo.

**Tools** porque una herramienta está quieta hasta que la coges. No se ejecuta cuando no la usas y no te vigila mientras la usas.

## ¿Por qué todo es verde?

lolly.tools se abre en [Lolly Demo](/info/lolly-demo.html), el design system de muestra del propio Lolly, y su color principal es el verde. Es una muestra, no una regla. Cambia a **Lolly Starter**, un design system en blanco, o al tuyo en [Settings → Design systems](/#/settings?focus=design-systems-section).

## ¿Puedo usar mi propia marca?

Sí. **Design System Setup** (`#/start`) crea un design system a partir de un color, un archivo de design tokens o un diseño terminado, y entonces cada herramienta dibuja con tu design system. [Start](/info/quickstart.html#put-your-brand-in) recorre las tres rutas.

Un design system que aporta tu organización o tu compilación está gestionado: muestra un candado y es de solo lectura, y puedes crear una copia editable para cambiarlo.

## ¿Dónde está lo que hice ayer?

Si pulsaste **Save as** o **Save**, está en **Projects**, en la pantalla de inicio, en el navegador o la aplicación desde la que guardaste. Si solo pulsaste **Download**, el archivo está donde tu navegador o sistema guarda las descargas, y normalmente hay una copia en **Assets**. Las herramientas que [guardan mientras trabajas](/info/find-your-work.html#which-tools-save-as-you-work) también conservan el trabajo sin guardar en **Projects**. [Find and recover your work](/info/find-your-work.html) cubre todos los casos.

## Cerré la pestaña. ¿Se ha perdido mi trabajo?

El trabajo guardado sigue en **Proyectos**. El trabajo sin guardar se pierde, excepto en las herramientas que guardan mientras trabajas, que también lo conservan en **Proyectos**. La próxima vez, pulsa **Guardar como** antes de salir. Consulta [Si cerraste la pestaña o saliste de la herramienta](/info/find-your-work.html#if-you-closed-the-tab-or-left-the-tool).

## ¿Puedo compartir mi trabajo como archivo en vez de como enlace?

Sí. Cuando un enlace no puede llevarlo todo, como tus propias fotos o un texto largo, el diálogo Share indica qué se perdería y ofrece en su lugar un archivo **.lolly**: un archivo que contiene el diseño, las imágenes que usa y, si lo eliges, la propia herramienta.

Tú decides cuánto viaja. Tu nombre y tus datos entran solo si tu perfil lo permite, y el arte con licencia se retiene a menos que elijas incluirlo. A quien abra un archivo que lleva una herramienta se le pregunta si confía en la herramienta antes de que pueda ejecutarse. Consulta [Sharing your work](/info/using.html#sharing-your-work).

## ¿Para qué sirven los datos de mi perfil?

Tus datos en **Settings** rellenan previamente las herramientas que los piden, como un nombre en una credencial. Se quedan en este dispositivo. Si además activas la opción, los datos que elijas se sellan en lo que creas, nombrándote como fuente. No se incluye nada a menos que elijas incluir tus datos.

Compartir y Sync envían solo el contenido que eliges. En la instancia de Lolly Work de una organización, las sesiones compartidas y el trabajo gobernado también van a ese servidor. Consulta [Privacy](/info/privacy.html).

## ¿Cómo consigo las apps de móvil o de escritorio?

Descárgalas desde [Install Lolly](/info/install.html). La página enumera cada compilación para macOS, Windows, Linux y Android, y muestra cómo comprobar el archivo que descargaste. iPhone y iPad obtienen **Lolly Tools** desde la App Store; [la sección de iPhone y iPad](/info/install.html#iphone-and-ipad) tiene el enlace.

Cualquiera también puede compilar y repartir su propia copia de la aplicación, con las herramientas y los ajustes que necesite su público. La [Build Guide](/info/build-guide.html) muestra cómo.

## Lolly dice que requiere WebGPU. ¿Qué puedo hacer?

La aplicación web dibuja con WebGPU, una función gráfica de los navegadores actuales, y la comprueba antes de abrir una herramienta. Prueba esto en orden:

1. Actualiza tu navegador a su versión actual.
2. Activa la aceleración gráfica o por hardware en los ajustes del navegador y reinícialo.
3. Prueba un navegador que se haya probado: [Supported environments](/info/supported-environments.html) los enumera.
4. En un Mac, iPhone o iPad, [instala la aplicación](/info/install.html) en su lugar.

## ¿Puede Lolly editar y renderizar mis archivos de Figma, Penpot, Illustrator o InDesign?

Sí. Abre **Design** y haz clic en **Import a design**: acepta un **.fig** nativo de Figma (Save local copy), una exportación **.penpot** de Penpot, un **.ai** o **.pdf** de Illustrator, un **.idml** de InDesign (File → Export → InDesign Markup) o **cualquier SVG**. No necesitas cuenta, ni plugin, ni licencia de una aplicación de diseño.

![El lienzo abierto de Design - Importar un diseño está en el menú Lolly de la barra de herramientas](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Fz%3D17ZTfS8MwEMf_mryO5NZ288GHrdqJv1CUvWdtOgppMtJMNv96yaV1iRNEQRBZoblwab53l0-uq915bXgrCOSDpf3LzgANnQ4eI0rrPJn7Gh9cd0sE8lIryxtFIFfatFx6L4F0Mi-11GbUiZYr25QjK3bW-S8I5MnUbRXKCkMgb5uqki6JFFU7rjoXYsSgT8GaLebKZSeGAPkUYypMHp80DeugYYR4J_U7X4XRkY8dFHuTYEJ-jDWM3qoqsEHo4Y20-xJi-SPVaOfRUuAL1hiZXNrG4gH6M85Z5lTAk8x8DdlnPL8gecVfBIEU6F5v0bbCor3VUu4JpOPCKTCWsPI9rBS107d6QyCfRET_Ac6wX36X6UpX-49Ip1mAlMEPkM6QX20aoSpECLTmpadcazPQ9hPlWxboRndWmFEIG1s4Yp3E3Ts-0f4GbcruWHLzlC0frmfpfbGk82LxmD0vUndSTcvXAoknWBKCz5LDSIdiRHV0D2Tfq1BIvdY42Zim5WZ_-n3_mRvwBg&width=1360&height=850&dpi=192&waitMs=3000&format=svg&walker=1&chrome=1&localize=1&dark=1&filename=design)

Las capas llegan como cuadros editables: el texto sigue siendo editable, las formas siguen siendo formas y las imágenes se unen a tu propia biblioteca. Guárdalo, y **Share with rules** puede convertir el diseño en una herramienta que cualquiera con Lolly puede volver a rellenar. Consulta [Import a design](/info/design-import.html).

## ¿Pueden dos personas trabajar en el mismo diseño sin internet?

Sí. Una persona comparte una invitación, como enlace, código QR o código corto, y la otra la acepta. Entonces ambos dispositivos mantienen la misma sesión en vivo, con presencia y anillos de foco incluidos. Funciona en cualquier red compartida, incluida la conexión compartida de un teléfono en un sótano, porque no hay ningún servidor en medio. Consulta [Working together](/info/collaborate.html). Para colegas en redes distintas, la instancia de Lolly Work de una organización ofrece collabs de trabajo autenticadas.

## ¿Qué son los feature flags?

Los feature flags activan o desactivan partes de Lolly. En uso independiente, eliges tus ajustes personales. Una organización que use Lolly Work puede definir valores predeterminados u ocultar interruptores seleccionados según su política, y los controles gestionados se etiquetan. Consulta [Use Lolly at your organisation](/info/organisation.html).

![Feature flags personales en la aplicación independiente; la política de la organización puede gobernar interruptores seleccionados](/t/url-shot?url=%2F%23%2Fprofile%3Ffocus%3Dfeature-flags&width=1440&height=1800&dpi=192&waitMs=2000&format=svg&cropSelector=%23feature-flags-section&walker=1&dark=1&filename=pd-feature-flags)

## ¿En qué se diferencian las utilidades de las herramientas?

Una utilidad hace un trabajo rápido sobre un archivo que ya tienes, como comprimir un PDF, convertir una foto o eliminar datos ocultos, y muchas se ejecutan en tu dispositivo sin subir nada. Existen para que los trabajos que la gente suele entregar a un sitio web cualquiera se queden dentro de Lolly. Comprimir un contrato, convertir fotos de vacaciones con su ubicación todavía dentro o pegar un token en un formateador en línea no debería significar entregar el archivo a un sitio de conservación, jurisdicción y modelo de negocio desconocidos. [Utilities](/info/utilities.html) las enumera, y [The trade we never agreed to](/info/status-quo.html) cuenta la historia que hay detrás.

![La vista Utilities: Strip Hidden Data, Compress PDF, Convert Image y los demás trabajos en el dispositivo, todo en un solo lugar](/t/url-shot?url=%2F%23%2Fu&width=1440&height=900&dpi=192&waitMs=1600&css=.welcome-dialog%2C.personalize-nudge%7Bdisplay%3Anone!important%7D&tolerance=0.03&format=svg&walker=1&dark=1&filename=use-utilities&try=1)

## ¿Puede nuestra organización usar SSO, proyectos compartidos y aprobaciones?

Sí, con **Lolly Work**, el servidor de organización del mismo proyecto de código abierto. Se ejecuta por separado y añade inicio de sesión único mediante tu proveedor de identidad, aprovisionamiento SCIM, permisos de grupo, proyectos y recursos compartidos, collabs de trabajo en vivo, aprobaciones y registros de auditoría. La aplicación de uso diario sigue funcionando por sí sola.

[Use Lolly at your organisation](/info/organisation.html) cubre cómo iniciar sesión y encontrar el trabajo compartido, y [Deployment](/info/deployment.html#organisation-services-with-lolly-work) cubre cómo configurarlo. El contenido compartido y los registros de la organización siguen las políticas de privacidad y conservación de esa instancia.

## ¿Con qué obstáculos me puedo encontrar al adoptar Lolly?

Sobre todo cambia el lado de la producción más que la tecnología. Un equipo que quiere un conjunto gobernado de herramientas necesita a alguien que redacte su design system y las primeras plantillas, aunque cualquiera puede empezar a crear sus propias herramientas en Design desde el primer día, sin necesidad de git. Y los procesos existentes siguen funcionando aunque su resultado no sea fiel a la marca, así que convertir bien un resultado visible, con el antes y el después lado a lado, convence más rápido que un plan.

[Adoption & Governance](/info/adoption-governance.html) cubre la incorporación por rol, cómo medir un piloto y cómo puede ser un proceso de gobernanza.

## ¿Lolly fue "vibe coded"?

Lolly se desarrolló con programación asistida por IA, descubrimiento asistido por IA y, en muchos lugares, contenido asistido por IA, con una mezcla de modelos y proveedores, entre ellos los de empresas punteras de nube pública. Una persona creó la arquitectura, cuidó el código con intención y dirigió artísticamente la experiencia.

Un aviso de gravedad alta o crítica en las dependencias de Lolly bloquea la CI. Un aviso que todavía no se puede corregir solo se mantiene como excepción aprobada con un motivo por escrito. [SECURITY.md](https://github.com/lolly-tools/lolly/blob/main/SECURITY.md#dependency-audit-exceptions) enumera cada excepción vigente hoy, y las [notas de la versión](https://github.com/lolly-tools/lolly/releases) enumeran las que lleva cada versión. SECURITY.md también explica cómo informar de una vulnerabilidad.

Las comprobaciones de la compilación también rechazan redacciones que parecen hechas por una máquina en los comentarios del código, la aplicación y esta documentación, para mantener el texto claro para cualquier lector. Un efecto secundario es que a un detector le resulte más difícil saber qué texto escribió un modelo. No nos propusimos causarlo.

Lo más importante: Lolly se apoya en los hombros de décadas de trabajo de código abierto de expertos de todo el mundo.

**Divulgación sobre IA generativa:**

- **Código escrito por LLM:** Opus 4.8, Gemini 3.1, Qwen3-Coder-Next, Codex Sol (esta lista puede ampliarse)
- **Descubrimiento con LLM:** Gemini 3.1, Fable, Codex Astra
- **Documentación:** Sonnet 5
- **Bibliotecas de código abierto:** Sus respectivos autores, expresados en el SBOM, los comentarios y las cabeceras de archivo

Esta lista no incluye los modelos integrados en Lolly.

**Aportaciones humanas:**
- **Ideación, revisión y comentarios:** Ravan Naidoo, Matthias Eckermann, Kelly Andrews, Ryan Kleeman, Peter Chamalian, la comunidad de Penpot, Tim Hildred (lista no exhaustiva)
- **Arquitectura, dirección de arte y encargado de limpiar el desorden:** Andy Fitzsimon

## ¿Dónde han quedado las herramientas con la marca SUSE?

Viven en un repositorio privado aparte. Un clon público no descarga en absoluto el paquete de marca de SUSE, así que una compilación a partir de él usa el perfil neutro `lolly-start` a menos que elijas otro: las herramientas comunitarias independientes de marca más una marca en blanco que rellenas con la tuya. [lolly.tools](https://lolly.tools) se compila con el perfil `lolly-demo` y se abre en [Lolly Demo](/info/lolly-demo.html), el design system del propio Lolly. SUSE opera su propia instancia para proteger sus marcas registradas.

## ¿De qué sabor es ese logotipo de Lolly?

Unos dicen que de lima, otros que de menta y a veces de manzana; Lolly pone el dulzor, ¡el sabor lo pones tú!
