# Lolly comparado, herramienta por herramienta

Si ya usas otro producto, estas páginas dicen si Lolly lo sustituye, funciona a su lado o no encaja con tu trabajo. Cada una empieza por lo que el otro producto hace mejor.

_Última revisión: 28 de septiembre de 2026._

## Comparar por producto

- [Lolly y Canva](/info/compare-canva.html) - plantillas, diseño cotidiano y producción de marca compartida.
- [Lolly y Adobe](/info/compare-adobe.html) - edición, conversión, salida profesional y Content Credentials.
- [Lolly y Figma](/info/compare-figma.html) - diseño, colaboración en vivo y producción reutilizable de recursos.
- [Lolly y Penpot](/info/compare-penpot.html) - diseño de código abierto, tokens compartidos y trabajo de organización.
- [Lolly y los portales de marca](/info/compare-brand-portals.html) - bibliotecas aprobadas, plantillas bloqueadas, identidad, revisión e informes.
- [Lolly y las API de renderizado](/info/compare-render-apis.html) - generación automatizada en tu dispositivo, en CI o en un servidor de Lolly Work.
- [Lolly y los conversores de archivos en línea](/info/compare-converters.html) - conversión de formatos en tu propio dispositivo.

Para ver la comparación función por función, consulta [Cómo se compara Lolly](/info/positioning.html). Cada comparativa lleva fecha; una afirmación que ya no coincida con alguno de los dos productos debe corregirse.

## Qué se ejecuta dónde

Cada comparación abarca dos partes de un mismo proyecto de código abierto. **Lolly** es el motor, las aplicaciones y las herramientas. **Lolly Work** es el servidor de organización, mantenido en el [repositorio lolly-work](https://github.com/lolly-tools/lolly-work). Ambos son MPL-2.0, y una organización decide qué servicios de Lolly Work activar.

::: cols
## En tu dispositivo: Lolly

- Sin cuenta para el uso independiente
- Crear, editar, convertir y exportar
- Funciona sin conexión una vez guardadas las herramientas y los recursos que necesita
- Content Credentials firmadas en el dispositivo
- Collabs privadas entre dos dispositivos, sin servidor

## En el servidor de tu organización: Lolly Work

- Inicio de sesión único, aprovisionamiento SCIM, roles y políticas
- Catálogos compartidos, proyectos de equipo y collabs de trabajo
- Aprobaciones, informes de uso y registros de auditoría
- Renderizado en servidor, trabajos recuperables y entrega aprobada
- Firma en servidor con la identidad de la organización
:::

El uso independiente mantiene los archivos en el dispositivo. Elegir proyectos compartidos, una collab de trabajo, un renderizado en servidor o una entrega envía los datos que esa función necesita al servidor de tu organización.

## Lo que supone toda comparación

Estos límites se aplican a todas las páginas de este conjunto, así que se indican una sola vez aquí:

- **Las collabs de trabajo se ejecutan hoy en un único nodo de servidor.** Su escala y su historial operativo difieren de los de productos alojados consolidados desde hace tiempo. [Work status and roadmap](/info/work-status.html) recoge los límites actuales.
- **El sitio [lolly.work](https://lolly.work) es un entorno de pruebas de demostración.** Un despliegue duradero de una organización necesita almacenamiento persistente y un operador; [Install Lolly Work](/info/work-install.html) cubre ambos.
- **No hay cargo de licencia de software por usuario** para Lolly ni para un Lolly Work autoalojado. El alojamiento, el almacenamiento y la operación siguen costando dinero.
- **Una firma no es un firmante de confianza.** Un verificador debe confiar en el certificado que firmó un archivo antes de mostrar al firmante como de confianza; [Content Credentials Identity](/info/content-credentials-identity.html) explica cómo.
