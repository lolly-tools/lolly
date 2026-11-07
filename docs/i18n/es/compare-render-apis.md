# Lolly y las API de renderizado

_Última revisión: 5 de noviembre de 2026._

Si hoy generas imágenes a partir de plantillas mediante una API, esta página dice qué cambia si operas tú mismo esa producción: en tu propio dispositivo, en CI o en un servidor que controlas. [Move from a hosted render API](/info/work-move-from-render-api.html) explica cómo hacerlo.

## Lo que las API de renderizado alojadas hacen mejor

[Bannerbear](https://www.bannerbear.com/) y [Placid](https://placid.app/) son servicios gestionados, y eso es una ventaja real. Envías una solicitud y otra persona opera los servidores, los mantiene en marcha y absorbe la carga.

- **Nada que operar.** Sin servidor, base de datos, almacenamiento, actualizaciones ni planificación de capacidad.
- **Un editor de plantillas alojado** con plantillas listas para adaptar.
- **Más tipos de salida desde una sola API.** Ambos publican endpoints de vídeo y PDF, y Bannerbear documenta además salida animada, WebP y AVIF, capturas de pantalla y eliminación de fondo con IA.
- **Sus propias integraciones y su soporte.**

Si ese es el acuerdo que quieres, esos servicios son una buena opción.

## Lo que te da operarlo tú

- **Tu contenido se queda en tus sistemas.** Las entradas, los recursos y las salidas viven en la infraestructura que elegiste. Renderizar en un dispositivo o en CI no necesita ningún servicio.
- **Las reglas viven en la herramienta.** Los colores, la tipografía, los logos y las entradas bloqueadas vienen de tu [design system](/info/brand-studio.html), así que quien llama solo puede cambiar lo que tú permites. [Lolly Work](/info/compare.html#what-runs-where) aplica la visibilidad de herramientas y las políticas de entradas a cada solicitud.
- **La misma herramienta en todas partes.** Una herramienta renderiza en un portátil, en un trabajo de CI o en un servidor a partir de las mismas entradas, y la gente puede editar esa misma herramienta en la aplicación.
- **Registros que conservas tú.** [Render receipts](/info/work-renders.html#evidence-and-identity), un rastro de auditoría y Content Credentials donde configures una identidad de firma.
- **Código abierto y sin contador.** Ejecutas el código, y lo que pagas es tu propia infraestructura.

Asumes el trabajo que esos servicios hacen por ti. Un servidor duradero necesita una base de datos persistente y almacenamiento de salida, y las herramientas que necesitan un navegador necesitan el worker de Chromium. [Install Lolly Work](/info/work-install.html) describe ambos.

## Cómo se corresponden los trabajos

| Trabajo | API de renderizado alojada | Lolly |
|---|---|---|
| Rellenar una plantilla con datos | Solicitud a la API que nombra una plantilla y sus capas | [URL](/info/url-mode.html), [CLI](/info/cli.html) o [API de servidor](/info/work-automation-api.html) que nombra una herramienta y sus entradas |
| Muchos archivos desde una tabla | Lotes y colecciones | [Batch](/info/batch.html) en tu dispositivo, o [lotes de renderizado](/info/work-renders.html#batches-with-durable-rows) en un servidor |
| Esperar o consultar un resultado | Consulta periódica, o una opción síncrona | Renderizados duraderos que consultas, o un renderizado inmediato |
| Llamar a un webhook al terminar | Sí | [Callbacks firmados](/info/work-renders.html) a los orígenes que permitas |
| URL de imagen dinámica | Sí | [Enlaces para compartir y URL de `/render`](/info/url-mode.html) |
| Editar una plantilla | Editor alojado | [Design](/info/using.html), en tu dispositivo |
| Agentes | Ambos publican un servidor MCP | [MCP](/info/mcp.html), con un endpoint de organización bajo la política de un token en Lolly Work |

Los tipos de salida propios de Lolly se enumeran en [Exporting](/info/exporting.html). En un servidor Work hoy, los renderizados duraderos producen SVG, PNG, JPG y PDF, y [el vídeo se queda en el dispositivo, la CLI y MCP](/info/work-renders.html#production-still-checks-and-permitted-repairs).

## Qué se traslada y qué no

| | Bannerbear V5 | Bannerbear V2 | Placid |
|---|---|---|---|
| Tus solicitudes | La API de migración de Work admite la misma forma | Igual | Igual |
| Tus plantillas | Se **importan** como documentos editables, salvo los tipos de capa sin esquema confirmado | Solo nombres de campo y una vista previa. Reconstruye cada una | Solo nombres de campo y una vista previa. Reconstruye cada una |
| URL dinámicas existentes | No admitidas | No admitidas | Las URL firmadas siguen funcionando tras un cambio de host, con tu antiguo token privado |
| Webhooks | Los webhooks registrados no se admiten | `webhook_url` funciona | `webhook_success` funciona |
| Salida WebP y AVIF | Rechazada por nombre | No se ofrece | WebP rechazado por nombre |
| Animaciones, vídeos, colecciones, capturas de pantalla | No están en la API de migración | No están en la API de migración | No están en la API de migración |

Todo esto se construyó a partir de la documentación pública de cada proveedor y no se ha probado con una cuenta real. [The move guide](/info/work-move-from-render-api.html#check-it-on-your-own-account) incluye una breve lista de comprobación si tienes una.

Cambiar no es todo o nada. Puedes trasladar una plantilla y dejar el resto donde están, y [salir de Lolly](/info/work-move-from-render-api.html#leave-lolly-too) es igual de abierto: las herramientas son archivos simples y la CLI las renderiza sin servidor.

## Quién ejecuta el servicio

Con Lolly, una persona renderiza en local, o un equipo opera Lolly Work en su propia infraestructura. Enviar un trabajo de servidor manda sus entradas y los recursos necesarios a esa instancia, lo que es distinto del camino en el dispositivo.

Bannerbear y Placid son marcas registradas de sus propietarios. Esta página describe dónde se solapan los productos, a partir de su documentación pública, y no está afiliada a ninguno de los dos.
