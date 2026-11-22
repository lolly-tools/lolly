# Lolly y las API de renderizado

_Última comprobación: 5 de noviembre de 2026._

Si generas imágenes a partir de plantillas mediante una API, esta página indica qué cambia cuando ejecutas esa producción en tu propio dispositivo, en CI o en un servidor que controlas. [Migrar desde una API de renderizado alojada](/info/work-move-from-render-api.html) detalla los pasos.

<!--i:eti-award-->
## Lo que las API de renderizado alojadas hacen mejor

[Bannerbear](https://www.bannerbear.com/) y [Placid](https://placid.app/) son servicios gestionados: envías una solicitud y otra persona se encarga de los servidores.

- **Nada que operar.** Ni servidor, ni base de datos, ni almacenamiento, ni actualizaciones, ni planificación de capacidad.
- **Un editor de plantillas alojado** con plantillas listas para adaptar.
- **Más tipos de salida desde una sola API.** Ambos publican endpoints de vídeo y PDF, y Bannerbear también documenta salida animada, WebP y AVIF, capturas de pantalla y eliminación de fondos con IA.
- **Sus propias integraciones y soporte.**

Si esa es la forma de trabajar que quieres, esos servicios son una buena opción.

<!--i:eti-home-->
## Qué te aporta el autoalojamiento

- **Tu contenido se queda en tus sistemas.** Las entradas, los recursos y los resultados residen en la infraestructura que elegiste. Renderizar en un dispositivo o en CI no necesita ningún servicio.
- **Las reglas están en la herramienta.** Los colores, la tipografía, los logotipos y las entradas bloqueadas proceden de tu [design system](/info/brand-studio.html), así que quien hace una llamada solo puede cambiar lo que permites. [Lolly Work](/info/compare.html#what-runs-where) aplica la visibilidad de herramientas y las políticas de entradas a cada solicitud.
- **La misma herramienta en todas partes.** Una herramienta renderiza a partir de las mismas entradas en un portátil, en un trabajo de CI o en un servidor. Las personas pueden editar la misma herramienta en la aplicación.
- **Registros en tu poder.** [Comprobantes de renderizado](/info/work-renders.html#evidence-and-identity), un registro de auditoría y Content Credentials donde configures una identidad de firma.
- **Código abierto y sin cobro por uso.** Tú ejecutas el código y pagas solo tu propia infraestructura.

Asumes el trabajo que esos servicios hacen por ti. Un servidor duradero necesita una base de datos persistente y almacenamiento de resultados. Las herramientas que necesitan un navegador requieren el worker de Chromium. [Instalar Lolly Work](/info/work-install.html) describe ambos.

<!--i:eti-table-->
## Cómo se comparan las tareas

| Tarea | API de renderizado alojada | Lolly |
|---|---|---|
| Rellenar una plantilla con datos | Solicitud a la API que nombra una plantilla y sus capas | [URL](/info/url-mode.html), [CLI](/info/cli.html) o [API del servidor](/info/work-automation-api.html) que nombra una herramienta y sus entradas |
| Muchos archivos a partir de una tabla | Lotes y colecciones | [Lotes](/info/batch.html) en tu dispositivo o [lotes de renderizado](/info/work-renders.html#batches-with-durable-rows) en un servidor |
| Esperar o consultar periódicamente un resultado | Consultas periódicas o una opción síncrona | Renderizados duraderos que consultas periódicamente o un renderizado inmediato |
| Llamar a un webhook al terminar | Sí | [Callbacks firmados](/info/work-renders.html) a los orígenes que permites |
| URL de imagen dinámica | Sí | [Enlaces para compartir y URL `/render`](/info/url-mode.html) |
| Editar una plantilla | Editor alojado | [Design](/info/using.html), en tu dispositivo |
| Agentes | Ambos publican un servidor MCP | [MCP](/info/mcp.html), con un endpoint de la organización sujeto a la política de un token en Lolly Work |

Los tipos de salida propios de Lolly se enumeran en [Exportar](/info/exporting.html). Actualmente, en un servidor Work, los renderizados duraderos crean SVG, PNG, JPG y PDF, y [el vídeo sigue en el dispositivo, la CLI y MCP](/info/work-renders.html#production-still-checks-and-permitted-repairs).

<!--i:eti-folder-move-->
## Qué se transfiere y qué no

| | Bannerbear V5 | Bannerbear V2 | Placid |
|---|---|---|---|
| Tus solicitudes | La API de migración de Work acepta la misma estructura | Igual | Igual |
| Tus plantillas | **Import** como documentos editables, salvo los tipos de capa sin esquema confirmado | Solo nombres de campos y una vista previa. Reconstruye cada una | Solo nombres de campos y una vista previa. Reconstruye cada una |
| URL dinámicas existentes | No se admiten | No se admiten | Las URL firmadas siguen funcionando tras un cambio de host, con tu antiguo token privado |
| Webhooks | No se admiten webhooks registrados | `webhook_url` funciona | `webhook_success` funciona |
| Salida WebP y AVIF | Se rechaza explícitamente por nombre | No se ofrece | WebP se rechaza explícitamente por nombre |
| Animaciones, vídeos, colecciones, capturas de pantalla | No disponible en la API de migración | No disponible en la API de migración | No disponible en la API de migración |

::: note Desarrollado a partir de documentación pública
Esto se desarrolló a partir de la documentación pública de cada proveedor y no se ha ejecutado contra una cuenta activa. Si tienes una cuenta, [la guía de migración](/info/work-move-from-render-api.html#check-it-on-your-own-account) incluye una breve lista de comprobación.
:::

Puedes trasladar una plantilla y dejar las demás donde están. [Salir de Lolly](/info/work-move-from-render-api.html#leave-lolly-too) es igual de abierto: las herramientas son archivos simples y la CLI los renderiza sin servidor.

<!--i:eti-building-->
## Quién gestiona el servicio

Con Lolly, una persona renderiza localmente o un equipo ejecuta Lolly Work en su propia infraestructura. Un trabajo de servidor envía sus entradas y los recursos necesarios a esa instancia. La vía en el dispositivo no lo hace.

Bannerbear y Placid son marcas comerciales de sus titulares. Esta página describe dónde coinciden los productos, a partir de su documentación pública, y no está afiliada a ninguno de los dos.
