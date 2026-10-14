# Lolly y Penpot

_Última revisión: 28 de septiembre de 2026._

Lolly y Penpot ofrecen herramientas de diseño de código abierto, tokens de diseño compartidos y colaboración en directo. Lolly combina la creación en el dispositivo con [lolly.work](https://lolly.work), su servicio de organización desplegado por separado.

## Bases de diseño compartidas

[Los tokens de diseño de Penpot](https://help.penpot.app/user-guide/design-systems/design-tokens/) usan el formato DTCG, que Lolly también lee. Los colores, la tipografía y otros valores de token pueden compartirse entre ambos flujos de trabajo. [Importar un diseño](/info/design-import.html) en Lolly abre una exportación `.penpot` como una maquetación editable.

El plugin Lolly Export para Penpot lo mantiene Lolly. Usa el motor de Lolly para las C2PA Content Credentials opcionales en el dispositivo. La integridad de la firma y la confianza en el firmante son cosas distintas: un verificador necesita una identidad en la que confíe, como se describe en [Content Credentials Identity](/info/content-credentials-identity.html).

## Flujos de trabajo de diseño y de equipo

[Penpot](https://penpot.app/) ofrece diseño de interfaces, componentes, maquetaciones flexibles, prototipos interactivos e inspección para desarrolladores. Ofrece despliegues alojados y autoalojados, con [opciones de instalación en Docker y Kubernetes](https://help.penpot.app/technical-guide/getting-started/).

El lienzo Design de Lolly crea activos editables y puede convertir una maquetación en una [herramienta con reglas](/info/create-a-tool.html). La misma herramienta se renderiza en el navegador, la app de escritorio o la CLI y puede generar variantes a partir de datos. Para el trabajo en equipo, Lolly ofrece tanto [collabs privados](/info/collaborate.html) directos entre dos dispositivos como collabs de trabajo a través de lolly.work, con ediciones compartidas, cursores y sesiones de equipo guardadas.

## En qué se diferencian los despliegues

Lolly independiente renderiza y firma en el dispositivo, sin cuenta ni servidor. lolly.work añade SSO, aprovisionamiento SCIM, catálogos y proyectos compartidos, roles, aprobaciones, registros de auditoría y renderizado en el servidor. Ambos repositorios son de código abierto bajo MPL-2.0 y la organización puede operarlos. El trabajo compartido usa la instancia configurada; la creación local sigue disponible de forma independiente.

La elección depende del trabajo: el flujo de diseño de interfaces y prototipado de Penpot, la producción repetible de activos de Lolly, o una combinación que use tokens compartidos y diseños importados. La colaboración de trabajo de Lolly funciona actualmente en un solo nodo de servidor, y su [estado de despliegue](https://github.com/lolly-tools/lolly-work/blob/main/docs/status.md) debería formar parte de la evaluación de una organización.

Penpot es una marca de su propietario. El plugin mencionado arriba es de Lolly. Consulta [Cómo se compara Lolly](/info/positioning.html) y la [descripción de la solución combinada](/info/compare.html) para la comparación más amplia.
