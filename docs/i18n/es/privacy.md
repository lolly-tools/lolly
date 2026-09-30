# Política de privacidad

*Última actualización: 11 de agosto de 2026*

> **La versión corta.** Los documentos, imágenes, vídeos y archivos que creas en Lolly se quedan
> en tu dispositivo. No hay cuentas para el uso ordinario, ni cookies de la propia app,
> ni analítica ni rastreadores en ningún lugar del código - no es "no usamos
> los datos", es que sencillamente no están presentes en el código fuente. Existe una lista corta y completa
> de excepciones en las que el software habla con una red, y cada
> una de ellas se describe abajo con detalle: qué sale, hacia quién y cuándo. La única
> excepción que implica algo personal es un inicio de sesión que tienes que iniciar
> tú mismo, de forma explícita. Si no está en este documento, no ocurre.

## Qué cubre esta política

Lolly es software de código abierto - un motor, varios shells de aplicación (web, escritorio,
móvil, CLI) y una extensión de navegador - que cualquiera puede ejecutar. Esta política tiene dos
partes:

- <!--i:code--> **El software en sí**: qué hace y qué no hace con tus datos, dondequiera que
  se ejecute. Esto es una propiedad del código, así que es cierto para todo despliegue de Lolly,
  el nuestro o el de cualquier otra persona.
- <!--i:server--> **lolly.tools**, el despliegue de referencia que opera SUSE: las decisiones específicas
  tomadas al ejecutar sus piezas opcionales del lado del servidor (qué se registra, durante cuánto tiempo, por
  quién).

Si usas una instancia de Lolly autoalojada o empresarial, el comportamiento del software
descrito a continuación sigue aplicando, pero el *operador* de esa instancia - no SUSE - es
responsable de todo lo que ocurra del lado del servidor: su endpoint de renderizado, su servidor MCP,
su autoridad de certificación de Content Credentials, si opera una. Pídeles su propia
política. Consulta [Adopción y gobernanza](/info/adoption-governance.html) para
saber qué implica operar Lolly.

## La aplicación: qué se queda en tu dispositivo

Los shells web, de escritorio y móvil de Lolly ejecutan todo el motor de renderizado del lado del cliente.
Abrir una herramienta, rellenar entradas, previsualizar y exportar ocurre todo en tu
dispositivo - no interviene ningún servidor, y la aplicación funciona sin conexión una vez cargada.

**La aplicación no establece cookies.** Para funcionar, guarda una pequeña cantidad de datos **solo en
tu dispositivo**, nunca transmitidos:

- <!--i:sliders--> **Preferencias de interfaz** - tema, idioma, ajustes de sonido, tamaño de la
  barra lateral/zoom, criterios de orden y vista, qué consejos de introducción has visto - en
  `localStorage`, para que estén disponibles antes de que la aplicación termine de arrancar.
- <!--i:download--> **Una caché sin conexión del catálogo de herramientas y las vistas previas de recursos**, para que la galería
  funcione sin conexión.
- <!--i:hash--> **Contadores de uso locales** para las estadísticas de la tarjeta de tu perfil (cuántas exportaciones, qué
  herramientas) - un blob pequeño y acotado en `localStorage`, que nunca leemos ni enviamos a
  ningún sitio.
- <!--i:folder--> **Tus propios documentos, sesiones guardadas, recursos subidos y fuentes** - almacenados en
  IndexedDB en tu dispositivo, nunca subidos, nunca leídos por nadie salvo tú.

Nada de esto se comparte, se vende ni se usa para identificarte o hacerte seguimiento. No
hay nada que consentir, porque no ocurre ninguna recopilación - solo este aviso, para que
sepas qué se guarda y dónde. Borrar el almacenamiento del sitio en tu navegador elimina
todo eso en cualquier momento, y lo mismo hace **Ajustes → Almacenamiento → Borrar todos
mis datos**, que además desactiva Sincronización primero. (Según la Directiva ePrivacy
Art. 5(3), el almacenamiento estrictamente necesario para el servicio que pediste no
requiere consentimiento - solo transparencia, que es lo que ofrecen tanto este documento
como el aviso dentro de la app.)

![La sección de almacenamiento de la página de perfil en una pantalla del ancho de un teléfono: cada categoría de datos en el dispositivo nombrada, con el botón Clear all my data justo al lado](/t/url-shot?url=%2F%23%2Fprofile%3Ffocus%3Dstorage-section&width=430&height=1600&dpi=192&waitMs=2400&css=.welcome-dialog%2C.personalize-nudge%2C.store-selbar%2C.profile-row-value%2C.profile-group-value%2C%23store-hero-num%2C%23store-headroom%7Bdisplay%3Anone%7D&format=svg&waitSelector=%5Bdata-store-group%3Dmove%5D&drive=click%3A%5Bdata-store-group%3Dwork%5D%3Esummary%3Bclick%3A%5Bdata-store-group%3Dcaches%5D%3Esummary&walker=1&cropSelector=%23storage-section&dark=1&filename=pv-storage-clear)

Tu propia copia de seguridad de estos datos - el paquete `lolly-backup` producido por **Exportar mis
datos** - es un archivo que conservas y controlas. Nunca toca nuestros
servidores a menos que decidas enviarlo tú mismo a algún sitio. Consulta [Transferencia de
datos](/info/data-transfer.html).

## Utilidades en el dispositivo

Algunas herramientas - **Strip Hidden Data**, **Compress PDF** y otras que llevan la
insignia **"Runs on your device"** - operan sobre un archivo que tú proporcionas. El archivo se lee
en memoria en tu navegador, se transforma localmente y se ofrece de vuelta como descarga.
Nunca se sube, porque no hay ningún servidor en la ruta al que subirlo.
Estas utilidades funcionan sin conexión, y su salida no lleva marca de agua ni metadatos
nuestros - el propósito de la mayoría de ellas es eliminar y proteger datos, no añadir riesgo.

![La insignia que llevan estas herramientas: Runs on your device - no se sube nada](/t/url-shot?url=%2F%23%2Ftool%2Fstrip-data&width=1440&height=900&dpi=192&waitMs=2400&walker=1&format=svg&cropSelector=.on-device-badge&dark=1&filename=pv-ondevice-badge)

Prepare for sharing mantiene las entradas de trabajo, los hallazgos privados y los mapas de sustitución en
memoria, sin añadirlos automáticamente al historial, a los enlaces, a las copias de seguridad ni a la
sincronización. La inspección y la sustitución no envían el contenido del archivo a un servidor ni validan
credenciales en línea. El usuario decide si copia, descarga, envía o guarda explícitamente un resultado en su
biblioteca; un resultado guardado sigue entonces los ajustes normales de copia de seguridad y sincronización
de la biblioteca. Los archivos de receta omiten las cargas útiles previas y las asignaciones literales. Los
informes de resumen contienen recuentos, ids de ámbito y hashes de archivo. La CLI también puede guardar un
archivo de revisión privado que contenga los valores originales, solo cuando se solicita explícitamente con
`--review-file`. Cerrar o abandonar una vista de preparación en el navegador libera su estado de trabajo; esto
no es una promesa de borrado forense de la memoria del navegador o del sistema operativo.

## Todas las solicitudes de red que puede hacer la app

La tabla siguiente es la lista completa de todo lo que la aplicación obtiene o envía a través de una
red. Si no está aquí, la aplicación no lo hace.

| Qué | Qué sale realmente de tu dispositivo | Cuándo (la acción que lo activa) | Si un operador lo bloquea |
|---|---|---|---|
| Sincronización del catálogo de herramientas | Nada personal - una solicitud del propio índice público de herramientas y recursos de Lolly, al origen propio de la app | Al iniciar, y luego se guarda en caché sin conexión | La app funciona con su conjunto de herramientas en caché. Solo deja de descubrir herramientas nuevas |
| Una herramienta que necesita datos en vivo | Lo que esa herramienta concreta solicite, al host indicado en su propia descripción. Hoy eso es solo la búsqueda de ciudad en la herramienta Meeting Planner, que pregunta a `geocoding-api.open-meteo.com` para convertir un nombre de ciudad en coordenadas y una zona horaria - sin cuenta, sin clave y sin identificador más allá de la propia solicitud. El campo lo indica justo donde escribes, y cada respuesta se guarda en tu dispositivo para que una ciudad se busque una sola vez | Solo mientras usas esa herramienta, y solo una vez que introduces una ubicación | Esa búsqueda concreta falla. Aún puedes escribir las coordenadas a mano, y nada más se ve afectado |
| Google Fonts | El nombre de la familia tipográfica elegida y tu dirección IP, a los servidores de fuentes de Google (`fonts.googleapis.com` para la hoja de estilos, `fonts.gstatic.com` para el archivo de fuente) | Solo si añades una Google Font en el editor de marca, **y solo después de aceptarlo en un diálogo que dice exactamente esto** - una descarga única por familia, que luego vive en tu dispositivo y se usa sin conexión | El selector de Google Fonts falla de forma segura. Sube un archivo de fuente en su lugar |
| Send to Google Drive | El único archivo que elegiste enviar, a la API de Drive de Google (`www.googleapis.com`), tras un inicio de sesión de Google que completas en la propia ventana emergente de Google. El acceso de Lolly se limita a los archivos que ha creado (el ámbito `drive.file` - nunca puede leer el resto de tu Drive), y el token de inicio de sesión se mantiene en memoria durante la sesión, nunca se almacena | Solo cuando pulsas «Send to Google Drive» en una exportación EMF, y solo en las compilaciones donde el operador ha configurado un id de cliente de Google - sin uno, el botón no existe | El botón nunca aparece. Descarga el archivo y súbelo tú mismo a Drive |
| Send to Dropbox | El único archivo que elegiste enviar, a la API de Dropbox (`api.dropboxapi.com` para el inicio de sesión y los metadatos, `content.dropboxapi.com` para el propio archivo), tras un inicio de sesión de Dropbox que completas en la propia ventana de Dropbox. El acceso de Lolly se limita a la carpeta de la app (solo puede ver `Apps/` y su propia carpeta ahí dentro - nunca el resto de tu Dropbox), el enlace «Open» que te muestra es un enlace privado de corta duración (no se crea ningún recurso compartido público), y un token de actualización solo se guarda si marcas «stay connected» | Solo cuando pulsas «Send to Dropbox» en un archivo, y solo en las compilaciones donde el operador ha configurado un id de cliente de Dropbox - sin uno, el botón no existe | El botón nunca aparece. Descarga el archivo y súbelo tú mismo a Dropbox |
| Send to OneDrive | El único archivo que elegiste enviar, a los servicios de identidad y Graph de Microsoft (`login.microsoftonline.com` para el inicio de sesión, `graph.microsoft.com` para la subida; un archivo grande se sube en fragmentos a una dirección de subida propiedad de Microsoft en `api.onedrive.com`, `*.up.1drv.com` o `*.sharepoint.com`), tras un inicio de sesión de Microsoft que completas en la propia ventana de Microsoft. El acceso de Lolly se limita a su propia carpeta bajo `Apps/` (nunca puede leer el resto de tu OneDrive) más tu nombre visible para la etiqueta de la cuenta, y un token de actualización solo se guarda si marcas «stay connected» | Solo cuando pulsas «Send to OneDrive» en un archivo, y solo en las compilaciones donde el operador ha configurado un id de cliente de Microsoft - sin uno, el botón no existe | El botón nunca aparece. Descarga el archivo y súbelo tú mismo a OneDrive |
| Send to LinkedIn | El único archivo que elegiste enviar, además de su nombre como texto de la publicación, a LinkedIn (`www.linkedin.com` para el inicio de sesión, `api.linkedin.com` para la subida y la publicación), tras un inicio de sesión de LinkedIn que completas en tu propio navegador. La publicación va a tu propio feed como publicación pública bajo tu nombre. Lolly puede publicar en tu nombre y leer tu nombre para la etiqueta de la cuenta, nada más de tu LinkedIn, y el inicio de sesión se conserva en este dispositivo solo si marcas «stay connected» - los tokens de LinkedIn duran 60 días y no se pueden renovar de forma silenciosa, así que caducan por sí solos | Solo cuando pulsas «Send to LinkedIn» en un archivo, únicamente en las apps de escritorio, y solo en las compilaciones donde hay una app de LinkedIn configurada - sin una, el botón no existe | Nada que bloquear en la app web: esto existe **solo en las apps de escritorio**, así que esos dos hosts están deliberadamente excluidos de la Content-Security-Policy de la app web más abajo. En las apps de escritorio, elimina la app de LinkedIn configurada y el botón nunca aparece |
| Send to Penpot | El token de acceso personal de Penpot (lo pegas tú en la app) y el archivo `.penpot` del diseño que elegiste enviar, a la API de Penpot (`design.penpot.app`) a través de una pequeña pasarela en el propio origen de la app (`/api/penpot`), porque la API de Penpot no responde directamente a un navegador. La pasarela reenvía y olvida; las apps de escritorio hablan con Penpot directamente | Solo cuando pulsas «Send to Penpot» en la herramienta Design y confirmas un proyecto | La pasarela devuelve un error y el envío falla de forma segura. Exporta el archivo `.penpot` e impórtalo tú mismo en Penpot |
| Send to Bluesky | La única imagen que elegiste enviar, su nombre como texto de la publicación y como texto alternativo, y tu identificador (handle) más una contraseña de aplicación (Bluesky → Settings → App passwords, nunca tu contraseña de cuenta), al servidor de Bluesky que indiques (`bsky.social` a menos que te autoalojes). La contraseña de aplicación se guarda solo en este dispositivo, nunca en una copia de seguridad, y Disconnect la borra | Solo cuando pulsas «Send to Bluesky» en una imagen, después de conectar la cuenta en tu perfil, únicamente en las **apps de escritorio** | Nada que bloquear en la app web: su política de abajo no incluye ningún host de Bluesky, así que ese cruce no existe ahí. En las apps de escritorio, elimina la conexión y el botón nunca aparece |
| Send to Discord | El único archivo que elegiste enviar, como adjunto, a la dirección de webhook del canal que pegaste (`discord.com`). Una dirección de webhook permite a cualquiera que la tenga publicar en ese canal, así que se guarda solo en este dispositivo, nunca en una copia de seguridad, y Disconnect la borra | Solo cuando pulsas «Send to Discord» en un archivo, únicamente en las **apps de escritorio** | Nada que bloquear en la app web: su política de abajo no nombra `discord.com`, así que ese cruce no existe ahí. En las apps de escritorio, elimina el webhook y el botón nunca aparece |
| Send to Mastodon | El único archivo que elegiste enviar y su nombre como texto de la publicación, al servidor de Mastodon (o compatible) que indiques, tras un inicio de sesión que completas en la propia ventana de ese servidor. Conectar registra una pequeña app por dispositivo en ese servidor; el inicio de sesión se conserva en este dispositivo solo si marcas «stay connected» | Solo cuando pulsas «Send to Mastodon» en un archivo. Tú eliges el servidor, así que no está en la política de abajo | El servidor que indiques tiene que permitir llamadas desde el navegador; si no lo hace, usa las apps de escritorio. Disconnect elimina el botón |
| Send to Nextcloud / WebDAV | El único archivo que elegiste enviar, a tu propio servidor, mediante una única solicitud PUT autenticada con la dirección del servidor, el nombre de usuario y la contraseña de aplicación que introdujiste (Nextcloud → Settings → Security → Devices & sessions; nunca tu contraseña de cuenta). Se guarda solo en este dispositivo, nunca en una copia de seguridad, y Disconnect la borra | Solo cuando pulsas «Send to Nextcloud» en un archivo. Tú eliges el servidor, así que no está en la política de abajo | Tu servidor tiene que permitir llamadas desde el navegador con el origen de la app; si no lo hace, usa las apps de escritorio |
| Send to S3-compatible storage | El único archivo que elegiste enviar, a tu propio bucket (AWS S3, MinIO, R2, B2, Garage - cualquier endpoint SigV4), firmado en tu dispositivo con el par de claves que introdujiste. Las claves se guardan solo en este dispositivo, nunca en una copia de seguridad, y Disconnect las borra | Solo cuando pulsas «Send to S3» en un archivo. Tú eliges el endpoint, así que no está en la política de abajo | Las reglas CORS de tu bucket tienen que permitir el origen de la app; si no lo hacen, usa las apps de escritorio |
| Sincronización entre tus dispositivos | Una copia de lo que hiciste en este dispositivo - sesiones y proyectos guardados, tus sistemas de diseño con sus tipografías y logotipos, imágenes subidas, tu perfil y tus preferencias - como un solo archivo, al almacenamiento único que elegiste: la carpeta de la app Lolly en tu Dropbox (`api.dropboxapi.com`, `content.dropboxapi.com`), los archivos que Lolly creó en tu Google Drive (`www.googleapis.com`), la carpeta de la app Lolly en tu OneDrive (`graph.microsoft.com`, con los archivos más grandes subidos a `api.onedrive.com`, `*.up.1drv.com` o `*.sharepoint.com`, y descargas desde `*.files.1drv.com`, `my.microsoftpersonalcontent.com` o `*.sharepoint.com` de Microsoft), o tu propio servidor Nextcloud / WebDAV o bucket S3. El mismo almacenamiento también conserva hasta siete copias diarias y una copia de antes de tu última aplicación. **Nada llega a Lolly:** ningún servidor, relé o servidor de Lolly Work está en la ruta, y las apps no necesitan ningún sitio web de Lolly para esto, ni siquiera para iniciar sesión. La copia se cifra primero en tu dispositivo solo si defines una frase de contraseña. Los inicios de sesión, las claves, las contraseñas de aplicación, la frase de contraseña y los ajustes de sincronización permanecen en el dispositivo y nunca están en la copia. En la web, una conexión recordada de Google Drive conserva solo el nombre de tu cuenta (y tu propio id de cliente, si diste uno); el propio inicio de sesión de Google dura una sola visita. En la app de Android, el inicio de sesión de Google Drive pasa por los servicios de Google Play del teléfono, que ejecuta Google | Solo después de activar «Sync across my devices» o pulsar «Sync now»: una subida poco después de cada cambio y al salir de la app, y una comprobación de si hay una copia más nueva al iniciar la app | La sincronización falla y dice por qué; tu trabajo permanece en el dispositivo. Exporta tus datos a un archivo y muévelo tú mismo en su lugar |
| Perfiles de imprenta ICC | Nada personal - una solicitud de un perfil estándar de condición de impresión, al registro público del ICC (`registry.color.org`, `www.color.org`) | Solo si haces clic en un preajuste ICC en el gestor de perfiles de impresión - una descarga única por perfil, que luego vive en tu dispositivo | Los preajustes ICC fallan. Aporta tu propio perfil `.icc` en su lugar |
| Radio por internet | Nada personal - una solicitud de lista de reproducción y una transmisión de audio, a la emisora (`api.somafm.com` y el servidor icecast que esta indica, `*.somafm.com`) | Solo mientras reproduces la radio integrada opcional en el reproductor de sonido | La radio falla. El resto de funciones de sonido sigue funcionando |
| Una URL que le pides a una herramienta que capture | Una solicitud a la dirección web exacta que escribes, desde la herramienta de captura de URL. Sea cual sea esa dirección. Este host no está en la política más abajo, porque tú lo eliges en el momento de usarla | Solo cuando introduces una URL en esa herramienta e inicias la captura | Un operador no puede autorizarlo por host. Para eliminarlo, elimina la herramienta |
| Añadir una imagen desde una URL | Una solicitud a la dirección de imagen exacta que pegas en «Add from URL» (en el selector de recursos o en Recursos). La propia política de la app web prohíbe que el navegador obtenga contenido de otro sitio directamente, así que la solicitud la hace por ti una pequeña pasarela en el propio origen de la app (`/api/fetch-image`), que obtiene la imagen del lado del servidor y devuelve solo los bytes - no guarda nada y olvida la dirección. Rechaza cualquier cosa que no sea una dirección de imagen pública (una dirección privada o interna se bloquea). Las apps de escritorio obtienen la dirección directamente. Un enlace de Lolly que pegues no se obtiene en absoluto - se renderiza en tu dispositivo. El host no está en la política de abajo, porque tú lo eliges en el momento de usarlo | Solo cuando pegas una URL en «Add from URL» y confirmas | El operador desactiva la pasarela (`LOLLY_DISABLE_IMAGE_PROXY=1`); entonces solo se pueden añadir en la app web enlaces de Lolly, imágenes `data:` e imágenes del mismo origen. Las apps de escritorio no se ven afectadas |
| Comprobación de firma SEAL | **Nada.** La app web no tiene ningún resolutor DNS - ver más abajo | Nunca | Nada que bloquear |
| Modelos de IA en el dispositivo | Nada personal - una descarga única del archivo de modelo desde el host de modelos de Lolly (`lolli.li`), que luego se guarda en caché en tu dispositivo; sin cuenta, sin identificador, solo la solicitud y tu IP | Solo cuando usas una función que necesita un modelo (análisis profundo de Verify, ampliación de imagen, voz y similares) | Esa función espera a la descarga; todo lo demás sigue funcionando |
| Instancia remota | Lo que sea que la instancia que indicas devuelva, a través de la misma sincronización de catálogo descrita arriba - más una etiqueta de versión en las solicitudes que le haces (tipo de shell y versión del engine, la misma información que lleva un user agent), para que su operador pueda ver qué versiones de Lolly hay en uso. En una instancia gestionada, mientras tienes la sesión iniciada, esa etiqueta también lleva un id de instalación por dispositivo para que la lista de dispositivos del operador pueda distinguir esta instalación. Solo viaja en solicitudes que tu propio uso ya genera - no hay temporizador y nada llama a casa por su cuenta - y al salir de la instancia se elimina el id, así que un dispositivo que se reconecta más tarde presenta uno nuevo. Tú eliges el host en el momento de usarlo, así que no está en la política más abajo | Solo si apuntas explícitamente el shell a otro despliegue de Lolly | El cambio de instancia falla. Tu instancia local no se ve afectada |

Cada host fijo de esa tabla es también la lista de permitidos completa en la
Content-Security-Policy de la app, que el navegador hace cumplir. Así que la lista no es solo
una descripción de lo que hace el código hoy, es el límite al que el navegador ciñe la app: un
cambio futuro que intentara contactar con algún otro host quedaría bloqueado, no permitido en
silencio. Una fila es la excepción deliberada, y su propia celda lo dice: Send to LinkedIn
existe solo en las apps de escritorio, así que la política de la app web no nombra ninguno de
sus dos hosts - la app web no podría alcanzarlos aunque su código lo intentara. Dos filas más,
Bluesky y Discord, son también exclusivas de escritorio por el mismo motivo, y sus hosts quedan
fuera de la política web por la misma razón. Cinco filas no tienen host fijo, porque tú eliges
la dirección en el momento de usarla: una URL que le pides a una herramienta que capture, una
instancia remota a la que apuntas el shell, y tu propio servidor de Mastodon, servidor WebDAV o
bucket S3 (los dos últimos también como destino de sincronización). Ninguna de ellas está en la
política, y cada una ocurre solo cuando escribes una dirección y actúas sobre ella. La fila de
Penpot alcanza Penpot a través del propio origen de la app, así que queda cubierta por
`'self'`. Un despliegue que no quiera ninguna de las opcionales (una instancia empresarial con
sus propias fuentes, por ejemplo) elimina esos hosts de su política y las funciones fallan de
forma segura en lugar de intentar conectarse.

Aparte de dos tipos de fila, ninguna de estas envía tus documentos, proyectos, sesiones o
archivos subidos a ningún sitio: existen para traer cosas *a* tu dispositivo
(herramientas, fuentes, modelos). Los dos tipos son las filas de Send, que envían el único
archivo que elegiste, y la fila de sincronización, que envía una copia de tu trabajo al
almacenamiento que elegiste y a ningún servidor de Lolly. Cualquier otra excepción se
nombra explícitamente en las secciones siguientes.

**Una nota sobre lo que eliminamos.** Verify puede comprobar firmas SEAL, un esquema en el que
la clave de firma de un archivo se publica en el DNS. Los navegadores no pueden hacer consultas DNS, así que cualquier
implementación web tiene que enrutar la búsqueda a través de un resolutor DNS-over-HTTPS de
un tercero - lo cual mostraría a ese operador el dominio que se está comprobando más tu dirección
IP. Antes usábamos el de Cloudflare. **Ya no lo hacemos, y no hay ningún
reemplazo**: la aplicación web ahora no pasa ningún resolutor, así que la verificación SEAL
aquí no hace ninguna solicitud de red. Los archivos cuyo registro SEAL lleva su clave incorporada
siguen verificándose por completo sin conexión. Los archivos cuya clave vive en el DNS informan "no key
resolver" en su lugar, y puedes comprobarlos en la aplicación de escritorio o de línea de
comandos, que resuelven el DNS de forma nativa a través de tu propia máquina sin que intervenga
ningún tercero.

![La pantalla de Verify: una zona para soltar archivos y nada más - el archivo se comprueba donde ya está, sin subida y sin cuenta](/t/url-shot?url=%2F%23%2Fverify&width=1440&height=900&dpi=192&waitMs=1400&walker=1&format=svg&cropSelector=.valid-layout&dark=1&filename=cc-verify-drop) Puedes confirmarlo tú mismo: comprobaciones verificables con grep para esta y cada
otra afirmación de esta página, con los comandos exactos y la salida esperada, están en
[Verifícalo tú mismo](/info/verify-yourself.html).

## URLs de renderizado con enlace directo

> **Activo en lolly.tools.** Cada URL
> `https://lolly.tools/tool/<tool-id>.<ext>?<inputs>` se renderiza de verdad, y las entradas
> viajan en esa misma URL. La sección siguiente explica qué significa eso para ti, y
> un operador puede desactivar la función en su propia instancia.

La aplicación en sí se queda por completo en tu dispositivo. Por separado, un operador puede activar
las **URLs de renderizado con enlace directo** - `/tool/<tool-id>.<ext>?<inputs>` - para que un
enlace de Lolly compartido pueda aparecer como una imagen en vivo en un README, una wiki o un panel.
Obtener una de ellas le pide al servidor que renderice **datos públicos de herramientas y catálogo** con las entradas
escritas en la URL.

- <!--i:usercheck--> **Sin cuentas, sin cookies, sin estado.** El punto de acceso es anónimo, y no se
  lee nada en tu dispositivo. Tus documentos, sesiones y subidas nunca salen de tu
  navegador - no pueden aparecer en estos enlaces en absoluto.
- <!--i:document--> **Pero la propia URL se registra.** La cadena de consulta de una URL forma parte de la línea de
  solicitud, así que aparece en los registros de acceso habituales de la plataforma de alojamiento, igual que
  cualquier ruta solicitada. Si las entradas de un enlace contienen el nombre o el correo de alguien -
  una etiqueta identificativa, una firma de correo - **ese texto queda en esos registros**, y ninguna
  redacción de política lo cambia. Por eso una URL de enlace directo es el lugar equivocado para datos personales: dale solo
  lo que pondrías en una página pública.
- <!--i:globe--> **De todos modos, las entradas son públicas por construcción** - son lo que quien creó
  el enlace escribió en la URL, legible por cualquiera que llegue al enlace. No pongas
  secretos en un enlace compartido. Lolly ofrece cifrado de enlaces para contenido sensible.
- <!--i:eyeoff--> Las respuestas se **almacenan en caché y se limitan de velocidad** como cualquier imagen pública, y se marcan
  como `noindex` para que los buscadores no indexen tus renders.

¿Autoalojas Lolly y no quieres una superficie pública de renderizado? Configura
`LOLLY_DISABLE_RENDER_GET=1` y todas estas URLs devuelven un 404.

## El servidor MCP (opcional, para agentes de IA)

Lolly también puede ser alcanzado por un agente de IA a través del Model Context Protocol - un
endpoint operado por el operador (lolly.tools ejecuta uno; cualquiera puede autoalojar el suyo
propio, incluido uno completamente aislado de la red). Comparte la postura sin cuentas de la ruta de
renderizado, más cuatro herramientas que necesariamente manejan bytes de archivo:

- <!--i:cpu--> **`lolly_transform`** (ejecuta una utilidad en el dispositivo pero del lado del servidor, en
  nombre del agente que llama), **`lolly_verify`** (comprueba Content Credentials) y
  **`lolly_redact`** (tapa regiones de una imagen o un PDF) aceptan
  los bytes de un archivo enviados por quien llama. Se procesan **en proceso, en memoria**,
  y el resultado se devuelve en esa misma llamada - el archivo nunca se escribe en
  disco ni se almacena una vez completada la solicitud.
- <!--i:cpu--> **`lolly_rebrand`** (renueva una presentación antigua sobre un sistema de
diseño, a través de sus etapas `plan`, `compile` e `inspect`) acepta los bytes de una
presentación de la misma manera, y los procesa **en memoria, solo para esa llamada** - no
se escribe nada en disco ni se conserva nada una vez enviada la respuesta. Su primera
etapa, `capabilities`, indica con palabras adónde irían tus bytes antes de que envíes
ninguno: en un servidor local autoalojado, la presentación nunca sale de esa máquina; en
un servidor alojado, llamar a `lolly_rebrand` envía la presentación allí, hasta los
límites de tamaño y de diapositivas que da esa misma etapa.
- <!--i:checklist--> El resto de herramientas - `lolly_render`, `lolly_build_url`, `lolly_list_tools`,
  `lolly_describe_tool` - funcionan solo a partir de parámetros (texto, números, colores,
  URLs, ids de recursos del catálogo), las mismas entradas que toma una URL de renderizado con enlace directo.
- <!--i:lock--> El acceso es o bien un token compartido que el operador emite a los clientes en los que confía, o bien
  OAuth 2.1 sin estado: tokens firmados de corta duración verificados frente a un secreto
  compartido, nada almacenado del lado del servidor, y el propio token nunca se escribe en un
  registro ni en una URL de renderizado.

## Identidad de Content Credentials (un inicio de sesión que tienes que iniciar tú mismo)

Lolly puede sellar una **Content Credential** criptográfica en tus exportaciones para que cualquiera pueda verificar, sin conexión, que un archivo no se ha alterado desde que salió de Lolly. Eso ya está **activado por defecto y totalmente local** - la clave de firma se genera en tu dispositivo y la propia firma ocurre sin conexión. Sin inscripción, esa clave es desechable: se genera un par de claves nuevo para cada exportación y se descarta junto con ella. Una vez que te inscribes, la clave pasa a ser permanente y se genera como **no extraíble** - ni siquiera el propio código de Lolly puede leerla, solo pedirle que firme. En cualquier caso, nunca sale de tu dispositivo. Esta sección cubre el único paso *opcional* que se añade a eso: inscribir una identidad verificada, para que tus exportaciones digan "Verificado - firmado por \<your email\>" en lugar de una clave anónima. **Si omites la inscripción, nada de esta sección se aplica a ti, y ningún dato personal sale nunca de tu dispositivo.**

![La tarjeta de identidad verificada en la página de perfil, del ancho de un teléfono: el selector de duración del certificado y el paso de inscripción debajo, inactivo hasta que lo inicias tú mismo](/t/url-shot?url=%2F%23%2Fsettings%3Ffocus%3Didentity-section&width=430&height=1600&dpi=192&waitMs=2400&css=.welcome-dialog%2C.personalize-nudge%7Bdisplay%3Anone%7D&format=svg&walker=1&cropSelector=%23identity-section&dark=1&filename=pv-identity-enrol)

Si te inscribes, esto es exactamente lo que ocurre:

1. **Eliges un método de inicio de sesión** - GitHub, Google, SUSE (id.suse.com) o un
   enlace por correo. Para los tres proveedores OIDC, se te redirige a la página de
   inicio de sesión de ese proveedor, regida por su propia política de privacidad, no por la nuestra.
   El servicio de certificados de Lolly recibe de vuelta solo una dirección de correo verificada y
   el nombre del proveedor. Para el enlace por correo, la dirección que escribes se pasa a
   **Resend**, una API de correo transaccional, únicamente para entregar ese enlace.
2. **Una cookie de corta duración protege la redirección.** Esta es la única cookie que
   establece todo el sistema Lolly: `lolly_ca_state`, `HttpOnly`, restringida a `/api/ca`,
   que expira en diez minutos. Lleva un valor aleatorio, no un identificador de
   rastreo, y existe solo para impedir que se falsifique la redirección OAuth. Se
   borra en cuanto se completa el inicio de sesión.
3. **Tu dirección IP se usa, brevemente, para prevenir abusos** de los endpoints de inicio
de sesión (para que un script no pueda saturar una bandeja de entrada ni agotar la cuota
de correo). Lolly le aplica una función hash antes de crear un bucket de control de abuso
de corta duración; la dirección en bruto no se envía a ese almacén. El bucket expira al
cabo de aproximadamente un minuto y no se usa para rastreo. Los registros de acceso de
alojamiento habituales son independientes y se describen más abajo.
4. **El servicio de certificados emite un certificado de corta duración** (7, 30, 90 o 365
   días, a tu elección, limitado por la política del operador) que vincula tu correo verificado
   a la mitad pública del par de claves generado en tu dispositivo. La mitad privada
   nunca sale de tu navegador.
5. **Nada sobre la emisión queda registrado.** El servicio de certificados no mantiene ningún registro
   de emisión: ni tu correo, ni el proveedor, ni un número de serie, ni una
   marca de tiempo. Sin base de datos, sin línea de registro, sin webhook. Tu dirección de correo existe en
   la solicitud solo el tiempo necesario para escribirse en el certificado que recibe tu propio
   dispositivo, y después desaparece por completo de nuestro lado.
6. **A partir de ahí, la firma vuelve a ser sin conexión** durante toda la vida del
   certificado. Exportar un archivo nunca contacta con el servicio de certificados - solo la inscripción lo hizo.

**La contrapartida, dicha con claridad.** Una versión anterior de este servicio sí registraba cada
emisión, para que un certificado mal emitido o comprometido pudiera rastrearse. Lo
eliminamos, porque ese registro era el único lugar en todo Lolly donde datos personales
llegaban a reposar en un servidor, y preferimos no tenerlo a tenerlo con cuidado.
Lo que perdemos es la trazabilidad del lado del servidor: si un certificado se usa mal
no podemos buscar quién lo obtuvo. Los certificados son de corta duración por
diseño - de 7 a 365 días, a tu elección, limitado por el operador - y expiran por sí
solos, que es la mitigación en la que confiamos en su lugar. Quienes se autoalojan y cuyas
obligaciones propias requieran un registro de auditoría pueden añadir uno, y convertirse en el responsable de esos
datos al hacerlo.

## La extensión de navegador

La extensión de navegador **Lolly URL Screenshot** no recopila, almacena ni
transmite ningún dato personal. Sin análisis, sin rastreo, sin servidor remoto.

**Qué hace.** Cuando le pides a la aplicación web de Lolly que capture la
captura de pantalla de una URL, la extensión abre esa página en una pestaña temporal en segundo
plano, la captura en tu navegador usando el DevTools Protocol, entrega la imagen
de vuelta a la aplicación y cierra la pestaña. Todo ocurre localmente, en tu propio
dispositivo y red.

**Datos.**

- <!--i:shieldcheck--> **No recopilamos nada.** La extensión no tiene servidores y no realiza
  solicitudes de red propias.
- <!--i:photos--> **Las imágenes capturadas** van directamente a la aplicación Lolly en el mismo navegador - nunca
  se suben desde la extensión.
- <!--i:link--> **Las URL que capturas** se usan solo para cargar esa página concreta para esa
  captura de pantalla. No se registran ni se comparten.

**Permisos.**

- <!--i:wrench--> **`debugger`** - para capturar la página renderizada mediante el DevTools Protocol (el
  mismo mecanismo que usa la aplicación de escritorio de Lolly).
- <!--i:monitor--> **`tabs`** - para abrir y cerrar la pestaña temporal en la que se carga la página.
- <!--i:globe--> **Acceso a hosts (`<all_urls>`)** - porque la página que elijas capturar puede estar
  en cualquier sitio. Chrome muestra esto en el momento de la instalación como una advertencia
  de permiso amplio. La extensión solo visita la URL que le indiques.

Ninguno de estos se usa para leer, monitorizar o transmitir tu navegación más allá de esa
única captura solicitada.

## Registros de infraestructura

Como cualquier sitio web, los servidores detrás de lolly.tools - y detrás de cualquier despliegue
de Lolly - generan los registros de acceso estándar de un servidor web cada vez que llega una solicitud a
ellos: dirección IP, ruta solicitada, marca de tiempo, agente de usuario. Ese es el comportamiento básico
de hosting, no algo que Lolly añada, y nunca contiene el
contenido de tus documentos, porque esos nunca llegan a un servidor en primer lugar. La
única excepción deliberada es un archivo que entregas explícitamente a una llamada MCP
`lolly_transform`, `lolly_verify`, `lolly_redact` o `lolly_rebrand`, que se procesa en memoria y nunca
se escribe en disco ni en un registro, como se describe arriba.

**El propio código de Lolly no escribe nada en esos registros.** El servidor MCP no contiene
ninguna instrucción de registro. El servicio de certificados emite exactamente dos líneas, ambas
en caso de fallo y ambas deliberadamente reducidas: un código de estado de fallo de envío sin
dirección de destinatario, y un mensaje de error sin traza de pila ni URL (una traza podría
contener un token de inscripción). Todo lo demás en el registro pertenece a la plataforma de hosting,
no a nosotros.

Para lolly.tools, el hosting es Vercel y la retención de registros de acceso sigue los valores
predeterminados propios de la plataforma de Vercel para nuestro plan. No configuramos ningún drenaje de registros, ninguna
exportación de registros a largo plazo ni ningún producto de analítica o monitorización adicional. No conservamos ninguna copia de estos
registros nosotros mismos, lo que también significa que no tenemos forma de buscarlos por ti - consulta
[Tus derechos](#your-rights).

## Bases legales, retención y destinatarios

Casi nada de esto necesita una base legal, porque casi nada se procesa. Por
exhaustividad, la lista completa:

| Procesamiento | Base legal (RGPD Art. 6) | Retenido durante |
|---|---|---|
| Todo en tu dispositivo (documentos, preferencias, caché, contadores) | **No es en absoluto un procesamiento nuestro** - nunca llega hasta nosotros. El almacenamiento en tu dispositivo es estrictamente necesario para el servicio que solicitaste (ePrivacy Art. 5(3)), por lo que no requiere consentimiento | Hasta que lo elimines |
| Tu dirección de correo durante la inscripción en Content Credentials | **Art. 6(1)(b)**, ejecución de un servicio que solicitaste explícitamente | No se retiene. Presente en memoria solo durante la duración de la solicitud |
| Una clave de bucket derivada de un solo sentido a partir de tu dirección IP en los endpoints de inicio de sesión, para limitación de tasa | **Art. 6(1)(f)**, nuestro interés legítimo en prevenir el abuso de un servicio gratuito y de la cuota de correo de un tercero. Consideramos que esto supera una prueba de ponderación porque la dirección en bruto no se envía al limitador, el bucket se usa solo para control de abuso y expira automáticamente | Aproximadamente 1 minuto en el almacén de control de abuso; no se retiene después |
| Registros de acceso de hosting (IP, ruta, marca de tiempo, agente de usuario) | **Art. 6(1)(f)**, nuestro interés legítimo en la seguridad del servicio, la prevención de abuso y el diagnóstico de fallos | Valor predeterminado de la plataforma de Vercel para nuestro plan. No añadimos drenaje ni exportación |

**Destinatarios.** Las categorías de destinatario son: nuestro proveedor de hosting (Vercel
Inc.); nuestro proveedor de almacén de control de abuso, que solo recibe claves de bucket
derivadas de un solo sentido y de corta duración, nunca la dirección IP en bruto; y - solo si
usas la opción de inicio de sesión por correo - un proveedor de correo transaccional (Resend).
Si inicias sesión con GitHub, Google o SUSE (id.suse.com), interactúas directamente con ese
proveedor bajo su propia política de privacidad. Ellos nos indican una dirección de correo
verificada y nada más. No compartimos datos personales con nadie más, y no vendemos datos, no
publicamos anuncios ni elaboramos perfiles de usuarios.

**Transferencias fuera del EEE.** Vercel y Resend son empresas estadounidenses. El cómputo de
funciones para lolly.tools está fijado a la región de Fráncfort de Vercel (`fra1`), por lo que
el procesamiento ocurre en la UE, pero al ser proveedores con sede en EE. UU., podrían seguir
acceder a los datos como encargados desde EE. UU. Esas transferencias se basan en las Cláusulas
Contractuales Tipo de la Comisión Europea y/o el Marco de Privacidad de Datos UE-EE. UU., según
se establece en el acuerdo de tratamiento de datos de cada proveedor. Dado que los datos
personales que llegan a estos proveedores son tan limitados - una dirección de correo
transmitida para enviar un mensaje, registros de acceso ordinarios, y un bucket de control de
abuso derivado y de corta duración -, la exposición es correspondientemente pequeña.

**Toma de decisiones automatizada.** Ninguna. No hay elaboración de perfiles ni una decisión
automatizada que produzca efectos jurídicos o similarmente significativos (Art. 22).

## Privacidad de menores

Lolly no recopila a sabiendas información personal de nadie, de ninguna edad, en
el uso ordinario de la aplicación - no hay nada que recopilar. El único lugar donde
se recoge alguna vez información personal (una dirección de correo) es la inscripción en Content
Credentials, descrita arriba, que no está dirigida ni pensada para menores.

## Tus derechos

Dado que casi todo lo que Lolly toca se almacena únicamente en tu propio dispositivo, la
mayoría de lo que la legislación de protección de datos llama "tus derechos" - acceso,
corrección, eliminación, portabilidad - son cosas que ya puedes hacer tú mismo, al
instante, sin pedirle nada a nadie: tus datos viven en el almacenamiento de tu navegador,
en una forma que puedes inspeccionar, exportar (**Exportar mis datos**, arriba) o eliminar
(borrando el almacenamiento del sitio en tu navegador, como arriba).

Formalmente, en virtud de los artículos 15-22 del RGPD tienes derecho a **acceder** a tus
datos personales, a **rectificarlos**, a **borrarlos**, a **restringir** su tratamiento u
**oponerte** a él (incluida la oposición a cualquier cosa que basemos en intereses
legítimos), a la **portabilidad de datos** y - cuando el tratamiento se base en el consentimiento - a
**retirar ese consentimiento en cualquier momento**, sin afectar a la licitud de lo
ocurrido antes de la retirada.

Esta es la postura honesta sobre cómo ejercerlos frente a nosotros. Como ya no mantenemos
un registro de emisión, **no tenemos ningún dato personal tuyo que podamos consultar,
corregir, exportar o eliminar.** Si nos escribes preguntando qué tenemos sobre ti, la
respuesta veraz es nada, y así te lo diremos. La única categoría que existe en absoluto es
los registros de acceso de hosting vinculados a una dirección IP, en poder de nuestro
proveedor de hosting bajo sus plazos de retención predeterminados. No tenemos capacidad
para buscar ni eliminar selectivamente esos registros, y te lo diremos en vez de fingir lo
contrario. Todo lo que es realmente *tuyo* está en tu dispositivo, donde ya puedes leerlo,
exportarlo y destruirlo sin pedirle permiso a nadie.

**Tienes derecho a reclamar.** Si crees que hemos gestionado tus datos de
forma indebida, puedes presentar una reclamación ante una autoridad de control de
protección de datos - en la UE, la autoridad de tu país de residencia, de tu lugar de trabajo
o del lugar donde crees que se produjo la infracción (Art. 77). Nuestra autoridad de control
principal es el *Bayerisches Landesamt für Datenschutzaufsicht* (BayLDA) en
Ansbach, Alemania. No necesitas contactarnos primero, aunque nos gustaría tener la
oportunidad de solucionarlo.

No vendemos datos. No tenemos ninguno que vender.

## Cambios en esta política

La fecha en la parte superior cambia cada vez que cambia este documento. Un cambio que altere
lo que sale de tu dispositivo o lo que se retiene recibe su propia línea aquí, no una edición
silenciosa - si quieres ver qué cambió, pregunta (abajo) o compáralo con el
[código fuente público](https://github.com/lolly-tools/lolly/commits/main/docs/privacy.md).

## Quién es responsable y cómo contactarnos

El **responsable del tratamiento** de lolly.tools es:

> SUSE Software Solutions Germany GmbH
> Frankenstraße 146
> 90461 Núremberg
> Alemania

SUSE ha designado un **Delegado de Protección de Datos**, localizable en
[privacy@suse.com](mailto:privacy@suse.com). Usa esa dirección para cualquier solicitud
formal en el marco de "Tus derechos" mencionado arriba.

Para cualquier cuestión sobre Lolly en sí - cómo funciona, por qué algo es como es o
una corrección a este documento - contacta con **Andy Fitzsimon**,
[fitzy@suse.com](mailto:fitzy@suse.com).

Para una instancia de Lolly autoalojada o empresarial, contacta con quien la opere
en su lugar: el operador es el responsable de su propio despliegue. SUSE y el
proyecto de código abierto Lolly no conservan datos de despliegues que no operan.
