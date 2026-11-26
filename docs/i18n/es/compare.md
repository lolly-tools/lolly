# Lolly en comparación, herramienta por herramienta

Estas páginas indican si Lolly sustituye a otro producto, trabaja junto a él o no encaja con tu trabajo. Cada página empieza por lo que el otro producto hace mejor.

_Última comprobación: 28 de septiembre de 2026._

<!--i:eti-grid-->
## Compara por producto

- [Lolly y Canva](/info/compare-canva.html) - plantillas, diseño cotidiano y producción compartida de contenido de marca.
- [Lolly y Adobe](/info/compare-adobe.html) - edición, conversión, salida profesional y Content Credentials.
- [Lolly y Figma](/info/compare-figma.html) - diseño, colaboración en vivo y producción de recursos reutilizables.
- [Lolly y Penpot](/info/compare-penpot.html) - diseño de código abierto, tokens compartidos y trabajo de la organización.
- [Lolly y los portales de marca](/info/compare-brand-portals.html) - bibliotecas aprobadas, plantillas bloqueadas, identidad, revisión e informes.
- [Lolly y las API de renderizado](/info/compare-render-apis.html) - generación automatizada en tu dispositivo, en CI o en tu propio servidor, y [cómo migrar](/info/work-move-from-render-api.html) desde Bannerbear o Placid.
- [Lolly y los conversores de archivos en línea](/info/compare-converters.html) - conversión de formatos en tu propio dispositivo.

[Cómo se compara Lolly](/info/positioning.html) ofrece una vista función por función. Cada comparación está fechada. Una afirmación que ya no se ajuste a cualquiera de los productos necesita corregirse.

<!--i:eti-map-pin-->
## Qué se ejecuta dónde

Cada comparación abarca dos partes de un mismo proyecto de código abierto. **Lolly** es el motor, las aplicaciones y las herramientas. **Lolly Work** es el servidor de la organización, mantenido en el [repositorio lolly-work](https://github.com/lolly-tools/lolly-work). Ambos usan MPL-2.0 y cada organización decide qué servicios de Lolly Work activar.

::: cols
## En tu dispositivo: Lolly

- Sin cuenta para el uso independiente
- Creación, edición, conversión y exportación
- Funciona sin conexión una vez guardadas las herramientas y los recursos que necesita
- Content Credentials firmadas en el dispositivo
- Colaboraciones privadas entre dos dispositivos, sin servidor

## En el servidor de tu organización: Lolly Work

- Inicio de sesión único, aprovisionamiento SCIM, roles y políticas
- Catálogos compartidos, proyectos de equipo y colaboraciones de trabajo
- Aprobaciones, informes de uso y registros de auditoría
- Renderizado en servidor, trabajos recuperables y entrega aprobada
- Firma en servidor con la identidad de la organización
:::

El uso independiente mantiene los archivos en el dispositivo. Elegir proyectos compartidos, una colaboración de trabajo, un renderizado en servidor o una entrega envía los datos que esa función necesita al servidor de tu organización.

<!--i:eti-info-->
## Qué presupone cada comparación

Estos límites se aplican a todas las páginas de este conjunto:

- **Las colaboraciones de Lolly Work se ejecutan actualmente en un solo nodo de servidor.** Su escala y su trayectoria operativa difieren de las de los productos alojados con muchos años de recorrido. [Estado y hoja de ruta de Lolly Work](/info/work-status.html) recoge los límites actuales.
- **El sitio [lolly.work](https://lolly.work) es un entorno de pruebas de demostración.** Un despliegue duradero para una organización necesita almacenamiento persistente y un operador. [Instalar Lolly Work](/info/work-install.html) cubre ambos.
- **No hay un coste de licencia de software por usuario** para Lolly ni para Lolly Work autoalojado. El alojamiento, el almacenamiento y las operaciones siguen teniendo un coste.
- **Una firma no implica un firmante de confianza.** Un verificador muestra al firmante como de confianza solo cuando confía en el certificado que firmó el archivo. [Identidad de Content Credentials](/info/content-credentials-identity.html) explica cómo.
