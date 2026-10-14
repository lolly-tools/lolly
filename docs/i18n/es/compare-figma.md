# Lolly y Figma

_Última revisión: 28 de septiembre de 2026._

Lolly admite diseño, edición en directo y producción de activos reutilizables. [lolly.work](https://lolly.work) añade los servicios de organización en torno a ese trabajo: identidad, proyectos compartidos, controles de acceso y aprobaciones.

## Dónde coinciden

Con ambos se pueden disponer tipografía, formas e imágenes en un lienzo y trabajar con otras personas. [Importar un diseño](/info/design-import.html) en Lolly lee los archivos de Figma como maquetaciones editables. Figma también cubre la producción de marca basada en plantillas: [Figma Buzz](https://help.figma.com/hc/en-us/articles/31271566667543-Guide-to-Figma-Buzz) crea activos a partir de plantillas y los rellena desde archivos CSV o XLSX.

Lolly convierte un diseño en una [herramienta reutilizable con reglas](/info/create-a-tool.html). Esa herramienta se ejecuta en el navegador o en la CLI y acepta entradas desde una URL, un script o la cuadrícula por lotes. La misma plantilla sirve tanto a una persona que edita un activo como a un equipo que produce muchas variantes.

## Colaboración y diseño de producto

[Figma Design](https://www.figma.com/design/) reúne diseño de interfaces, componentes, prototipos interactivos y traspaso a desarrollo. Su flujo de trabajo de diseño de producto y su ecosistema, ya consolidados, son relevantes cuando un equipo necesita diseñar y especificar una aplicación completa.

Lolly ofrece dos tipos de colaboración en directo. Un [collab privado](/info/collaborate.html) empareja dos dispositivos directamente, sin cuenta y sin necesidad de internet en una red compartida. Un collab de trabajo usa lolly.work para el acceso autenticado, las ediciones compartidas, los cursores en directo y las sesiones de equipo guardadas. La colaboración de trabajo está implementada tanto en el cliente de Lolly como en el servidor de lolly.work; su despliegue actual de un solo nodo no establece paridad con la escala de operación de Figma.

## Despliegue y producción

Las apps creativas de Lolly y lolly.work son partes del mismo proyecto de código abierto desplegadas por separado. Lolly independiente puede renderizar sin conexión y sin cuenta. lolly.work aporta SSO, SCIM, catálogos compartidos, permisos de proyecto, aprobaciones, registros de auditoría y renderizado en el servidor sobre una infraestructura que controla la organización.

Las sesiones de equipo y las ediciones de los collabs de trabajo llegan a esa instancia; los renderizados locales pueden permanecer en el dispositivo. Content Credentials son opcionales para las exportaciones compatibles, y la firma en el servidor usa una identidad de organización configurada. Consulta la [descripción de la solución combinada](/info/compare.html) para ver la separación y [Content Credentials Identity](/info/content-credentials-identity.html) para saber cómo confía un verificador en el firmante.

Figma es una marca de su propietario. Esta página describe dónde coinciden las dos soluciones y no está afiliada a Figma.
