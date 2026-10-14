# Lolly y las API de renderizado

_Última revisión: 28 de septiembre de 2026._

Lolly genera activos a partir de plantillas y datos en tu dispositivo, en CI o mediante la API de servidor de [lolly.work](https://lolly.work). La solución combinada cubre el renderizado automatizado, así como la identidad, las políticas y la entrega que rodean los trabajos de producción de una organización.

## Dónde coinciden

[Bannerbear](https://www.bannerbear.com/) y [Placid](https://placid.app/) generan imágenes y otros medios a partir de plantillas mediante API e integraciones. Lolly sigue el mismo enfoque de plantilla más entradas, con el [modo URL](/info/url-mode.html), la [CLI](/info/cli.html), una cuadrícula por lotes y endpoints de servidor como formas de enviar el trabajo.

## Qué ofrece lolly.work

lolly.work es el servicio de organización del proyecto Lolly, desplegado por separado. Ejecuta el motor de Lolly detrás de una API, aplica políticas de visibilidad de herramientas y de entradas, y sirve archivos renderizados y enlaces para compartir firmados. Su [servicio de renderizado recuperable](https://github.com/lolly-tools/lolly-work/blob/main/docs/renders.md) admite trabajos individuales y por lotes, envío idempotente, estado, reintentos acotados, cancelación y salidas retenidas. El trabajo interrumpido puede reanudarse tras reiniciar el servidor cuando hay almacenamiento persistente configurado.

El servidor usa una ruta de renderizado rápida SVG/PNG y un worker de Chromium opcional para las herramientas que necesitan un navegador. La automatización se autentica con tokens de servicio, y la salida completada puede enviarse mediante [entrega gobernada](https://github.com/lolly-tools/lolly-work/blob/main/docs/delivery.md) a destinos de la organización. Una identidad de firma configurada habilita la firma C2PA en la salida de servidor compatible.

## Quién ejecuta el servicio

Bannerbear y Placid ofrecen el renderizado como servicios gestionados con su propia infraestructura e integraciones. Con Lolly, una persona puede renderizar en local o un equipo puede operar lolly.work en su propia infraestructura. Ambos repositorios de Lolly son de código abierto bajo MPL-2.0; el autoalojamiento no tiene cargo de licencia de software por renderizado, aunque el cómputo, el almacenamiento y las operaciones siguen siendo costes que hay que prever.

El sitio público lolly.work es un entorno de evaluación, no un compromiso de alojamiento en producción. Un servicio duradero necesita base de datos y almacenamiento de salida persistentes; las herramientas que dependen del navegador necesitan el worker de Chromium. La [guía de instalación](https://github.com/lolly-tools/lolly-work/blob/main/docs/install.md) y la [página de estado](https://github.com/lolly-tools/lolly-work/blob/main/docs/status.md) describen esos requisitos y los límites actuales.

El renderizado local y en CI sigue disponible sin el servicio de organización. Enviar un trabajo al servidor manda sus entradas y los recursos necesarios a esa instancia; esto es distinto de la vía en el dispositivo. Consulta la [descripción de la solución combinada](/info/compare.html).

Bannerbear y Placid son marcas de sus propietarios. Esta página describe dónde coinciden las soluciones y no está afiliada a ninguna de las dos.
