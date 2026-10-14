# Lolly y Adobe

_Última revisión: 28 de septiembre de 2026._

Lolly gestiona la edición y conversión de imágenes, la maquetación, la producción de marca repetible, la salida para impresión y Content Credentials. [lolly.work](https://lolly.work) añade a ese flujo creativo la identidad de la organización, los activos compartidos, las aprobaciones y la producción automatizada en el servidor.

## Dónde coinciden

Ambos admiten tareas como redimensionar imágenes, componer maquetaciones y exportar a formatos profesionales. Lolly admite PDF/X, CMYK y salida raster de alta profundidad de bits, con [capacidades específicas de cada formato](/info/formats.html). Sus utilidades en el dispositivo convierten y limpian archivos sin subirlos.

Las aplicaciones especializadas de Adobe cubren flujos de trabajo creativos muy amplios. [Photoshop](https://www.adobe.com/products/photoshop.html), por ejemplo, ofrece herramientas detalladas de edición fotográfica, selección, enmascarado y composición. Compara las operaciones de edición que necesita tu trabajo con las herramientas de Lolly; un activo de marca recurrente y un retoque complejo pueden tener requisitos distintos.

## Creación y servicios de organización

Lolly independiente funciona sin cuenta de Adobe ni cuenta de Lolly, con el mismo motor en el navegador, la app de escritorio y la CLI. Las plantillas y los tokens de diseño hacen que los resultados sean repetibles, y [Compartir con reglas](/info/create-a-tool.html) convierte un diseño en una herramienta que otras personas pueden rellenar.

lolly.work es un servicio independiente dentro del proyecto Lolly, de código abierto bajo MPL-2.0 como las apps creativas. Aporta SSO, SCIM, catálogos y proyectos compartidos, aprobaciones, políticas de acceso, registros de auditoría y renderizado en el servidor. Una organización puede ejecutar ambas partes por su cuenta y conectar bibliotecas de activos existentes. La creación local permanece en el dispositivo; el trabajo compartido y los trabajos del servidor usan los servicios configurados.

## Content Credentials e identidad

Lolly puede firmar en el dispositivo las exportaciones compatibles, con Content Credentials activadas por el usuario. Una clave generada en el dispositivo demuestra la integridad de la firma del archivo; aun así, un verificador debe confiar en el firmante antes de mostrar una identidad verificada. Una organización puede usar su propia autoridad de certificación y distribuir su raíz a sus verificadores. lolly.work también admite la firma en el servidor con un certificado y una clave de la organización configurados.

Así, dentro de la solución de Lolly están disponibles tanto la firma personal como la firma de la organización. Consulta [Content Credentials Identity](/info/content-credentials-identity.html), la [guía de firma de lolly.work](https://github.com/lolly-tools/lolly-work/blob/main/docs/c2pa.md) y la [descripción de la solución combinada](/info/compare.html). Las utilidades de transformación en el dispositivo no añaden marcas de agua de Lolly ni metadatos de procedencia.

Adobe, Photoshop y Creative Cloud son marcas de Adobe. Esta página describe dónde coinciden las soluciones y no está afiliada a Adobe.
