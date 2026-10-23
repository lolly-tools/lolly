# Lolly y Penpot

_Última revisión: 28 de septiembre de 2026._

Si tu equipo diseña en Penpot, Lolly funciona a su lado: ambos son de código abierto y ambos leen los mismos design tokens. Esta página dice para qué trabajo es cada uno.

## Lo que Penpot hace mejor

[Penpot](https://penpot.app/) ofrece diseño de interfaces, componentes, maquetas flexibles, prototipos interactivos e inspección para desarrollo, con edición en tiempo real y cursores en vivo. Ofrece despliegues alojados y autoalojados, con [opciones de instalación con Docker y Kubernetes](https://help.penpot.app/technical-guide/getting-started/). Para diseñar una aplicación, Penpot es la herramienta.

## Dónde coinciden

Los [design tokens de Penpot](https://help.penpot.app/user-guide/design-systems/design-tokens/) usan el formato DTCG, que Lolly también lee, así que colores, tipografía y otros valores de tokens se mueven entre los dos. [Import a design](/info/design-import.html) de Lolly abre una exportación `.penpot` como diseño editable, y **Send to Penpot** en Lolly devuelve un diseño como archivo `.penpot`. Lolly también mantiene el [plugin Lolly Export para Penpot](https://github.com/lolly-tools/lolly-plugins-penpot-export), que usa el motor de Lolly para añadir Content Credentials opcionales en el dispositivo.

## Cómo hace Lolly el trabajo que se solapa

El lienzo Design de Lolly crea recursos editables y puede convertir un diseño en una [herramienta con reglas](/info/create-a-tool.html). La misma herramienta renderiza en el navegador, la aplicación de escritorio o la CLI y crea variantes a partir de datos. Lolly independiente renderiza y firma en el dispositivo, sin cuenta ni servidor. Una [collab privada](/info/collaborate.html) empareja dos dispositivos directamente.

## Con una organización

Lolly Work añade inicio de sesión único, aprovisionamiento SCIM, catálogos y proyectos compartidos, roles, aprobaciones, registros de auditoría, collabs de trabajo y renderizado en servidor. Ambos repositorios son MPL-2.0 y una organización puede operar los dos. [What runs where](/info/compare.html#what-runs-where) pone las dos partes lado a lado.

Puedes usar ambos: Penpot para el diseño de interfaces y el prototipado, Lolly para archivos repetibles, unidos por tokens compartidos y diseños importados.

Penpot es una marca registrada de su propietario. Esta página describe dónde se solapan los dos productos y no está afiliada a Penpot.
