# Lolly y las API de renderizado

_Última revisión: 28 de septiembre de 2026._

Si hoy generas imágenes a partir de plantillas mediante una API, esta página dice cómo hace Lolly el mismo trabajo en tu propio dispositivo, en CI o en tu propio servidor.

## Lo que las API de renderizado alojadas hacen mejor

[Bannerbear](https://www.bannerbear.com/) y [Placid](https://placid.app/) empaquetan el renderizado como servicios gestionados, con su propia infraestructura, integraciones y soporte. Envías una solicitud y otra persona opera los servidores.

## Dónde coinciden

Ambos convierten una plantilla más entradas en medios. Lolly toma las entradas de un [enlace](/info/url-mode.html), la [CLI](/info/cli.html), una cuadrícula de lotes o un endpoint de servidor.

## Cómo hace Lolly el trabajo que se solapa

La misma herramienta renderiza en un portátil, en un trabajo de CI o en un servidor, con las mismas entradas. El renderizado local y en CI no necesita ningún servicio.

![Ajustes de exportación por lotes: nombre de archivo, formato predeterminado, unidades, DPI y el número de filas a renderizar](/info/shots/use-batch-toolbar.svg)

En un servidor, [Lolly Work](/info/compare.html#what-runs-where) ejecuta el motor de Lolly tras una API y aplica la visibilidad de herramientas y las políticas de entradas. Su [servicio de renderizado recuperable](/info/work-renders.html) admite trabajos individuales y lotes, envío idempotente, estado, reintentos acotados, cancelación y salidas retenidas, y el trabajo interrumpido se reanuda tras un reinicio cuando se configura almacenamiento persistente.

El servidor tiene una ruta rápida para SVG y PNG y un worker opcional de Chromium para las herramientas que necesitan un navegador. La automatización inicia sesión con tokens de servicio, la salida terminada puede pasar por una [entrega aprobada](/info/work-delivery.html) a destinos de la organización, y una identidad de firma configurada añade Content Credentials a la salida admitida.

## Quién ejecuta el servicio

Con Lolly, una persona renderiza en local, o un equipo opera Lolly Work en su propia infraestructura. Enviar un trabajo de servidor manda sus entradas y los recursos necesarios a esa instancia, lo que es distinto del camino en el dispositivo. Un servicio duradero necesita una base de datos persistente y almacenamiento de salida, y las herramientas que dependen del navegador necesitan el worker de Chromium; [Install Lolly Work](/info/work-install.html) describe ambos.

Bannerbear y Placid son marcas registradas de sus propietarios. Esta página describe dónde se solapan los productos y no está afiliada a ninguno de los dos.
