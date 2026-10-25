# Cómo se compara Lolly

Lolly son dos partes de un mismo proyecto de código abierto. **Lolly** es el motor, las aplicaciones y las herramientas para crear, editar, convertir y exportar en tu dispositivo, sin cuenta. **Lolly Work** es el servidor de organización, que se ejecuta en tu propia infraestructura, para inicio de sesión, proyectos compartidos, aprobaciones y renderizado en servidor. Ambos son MPL-2.0. Esta página compara el par con las otras formas en que la gente diseña, gobierna y produce archivos.

## Las herramientas de hoy

Cada anillo puntúa cuán completamente cubre una clase de producto una capacidad, con cada clase puntuada según su mejor representante. La columna de Lolly abarca Lolly y Lolly Work juntos, y cada fila dice qué parte aporta qué. Abre el nombre de una fila para ver el razonamiento de su puntuación. Las columnas se ordenan por la fila Overall completeness de arriba: la media de las filas puntuadas, excluyendo la fila de gasto.

::: figure positioning-comparison
Comparativa de capacidades: investigación de la competencia y puntuaciones de agosto de 2026; cobertura de Lolly + Lolly Work revisada el 28 de septiembre de 2026. Puntuación: 0 ausente, 25 apaño, 50 real pero restringido o parcial, 75 sólido con salvedades, 100 competencia central.
:::

::: details Notas de puntuación
Las funciones disponibles y la madurez en producción son cosas distintas. Lolly está publicado: la versión 1.0 salió como código abierto el 30 de agosto de 2026, su seguridad todavía no ha tenido una auditoría independiente y su evidencia de adopción tiene unos pocos meses ([Adoption & Governance](/info/adoption-governance.html#status) tiene el estado actual). Tener inicio de sesión único, aprobaciones o renderizado en servidor no establece un historial en producción, y la puntuación de madurez lo refleja. Las puntuaciones de la competencia mantienen su revisión fechada de agosto.

Una regla gobierna el tablero. La puntuación máxima (100), en filas que tocan tu contenido o tu identidad, requiere una capacidad que puedas usar sin cuenta y sin precondición de nube; las filas sobre el propio producto, como la madurez y la facilidad de uso, están exentas. Esa regla le cuesta a Adobe en Content Credentials: la implementación distribuida más amplia (Photoshop, Lightroom, Premiere, Firefly) firma en local y en la nube, pero nunca sin una cuenta e identidad de Adobe, de ahí el 75. Limita a las API de renderizado en generación masiva y automatización por la misma razón.

Canva se puntúa por su mejor miembro de familia en cada fila, ya que es propietaria de Affinity y Cavalry (ambos regalados en octubre de 2025). El renderizado sin conexión y en el dispositivo puntúa 75 gracias a Affinity, una suite de escritorio que aún necesita una cuenta verificada y lleva telemetría, la misma deducción que aplica Adobe; el propio modo sin conexión de Canva edita solo diseños presincronizados, en un dispositivo, durante una ventana limitada. Autofill puntúa 50: es real pero está restringido a Enterprise y es asíncrono, y solo rellena texto e imágenes. La generación masiva de Figma subió de 25 a 50 cuando Buzz lanzó el relleno desde hoja de cálculo (una beta gratuita, agosto de 2026).

La puntuación de 75 de Lolly en Content Credentials abarca la firma en el dispositivo y la firma en servidor de Lolly Work con una identidad de organización configurada; un verificador aún debe confiar en el firmante ([Content Credentials Identity](/info/content-credentials-identity.html)). El 50 de Penpot viene del plugin de exportación propio de Lolly para Penpot: la misma firma del motor, de aceptación voluntaria y divulgada como de Lolly. Penpot puntúa 90 en renderizado en el dispositivo: un lienzo de navegador con un destino de guardado en su servidor, que se puede autoalojar. Cloudinary recibe su propia columna por su biblioteca de recursos, su API de transformación y su CDN; la revisión de agosto puntuó con 50 su firma de entrega.

La colaboración en vivo de Lolly incluye collabs privadas directas entre dos dispositivos y collabs de trabajo autenticadas a través de Lolly Work, con ediciones compartidas, cursores y sesiones de equipo guardadas. La puntuación Partial refleja el despliegue de trabajo actual de un solo nodo y el corto historial operativo, no una ausencia de edición en equipo. Las estimaciones de precio son aritmética de precios de lista fechados para dar escala, no un proceso de compra.
:::

## Cuándo recurrir a Lolly

::: cols
## Recurre a Lolly cuando

- Se necesita una y otra vez el mismo tipo de archivo: mosaicos de eventos, credenciales, certificados, alertas, tarjetas sociales
- Muchos archivos salen de una plantilla y una tabla de valores, en [Batch](/info/batch.html#make-many-versions-of-one-design) o en la CLI
- Los colores, la tipografía y los recursos deben quedarse dentro del design system, incluso en un lienzo abierto
- Un diseño terminado de Figma, Penpot, Illustrator, InDesign o PDF debe volverse editable y repetible ([Import a design](/info/design-import.html))
- Los archivos deben crearse en tus propios dispositivos o servidores

## Recurre a otra cosa cuando

- El trabajo es retoque fotográfico detallado o ilustración
- Estás diseñando y prototipando la interfaz de una aplicación
- Necesitas una gran biblioteca de imágenes y plantillas lista desde el primer día
- Necesitas un servicio gestionado con un largo historial a escala
:::

Los diseños importados y los design tokens compartidos permiten que un equipo combine Lolly con aplicaciones especializadas, mientras Lolly Work gobierna los recursos compartidos, la revisión y la entrega.

Un deck de diapositivas entero muestra el techo: en **Markdown Slides** un deck se declara como datos, se maqueta en vivo y se exporta como un archivo PowerPoint nativo y editable.

![Markdown Slides en la vista dividida: las diapositivas del deck enumeradas como bloques a la izquierda, el deck maquetado renderizándose a la derecha](/t/url-shot?url=%2F%23%2Ftool%2Fdeck-studio&width=1440&height=900&dpi=192&waitMs=2600&walker=1&format=svg&dark=1&filename=ov2-deck-studio-output)

## Las reglas viven en la herramienta

Lolly pone las reglas de marca reutilizables en la herramienta: colores, fuentes, márgenes de sangrado, espaciado y entradas permitidas. La plantilla fija las partes que un destinatario no debe cambiar. Lolly Work añade acceso por grupos y políticas de entradas alrededor de esa plantilla, con cadenas de aprobación para los envíos al catálogo y la entrega.

Comprobar una herramienta una vez facilita la producción repetible, porque cada resultado hereda sus reglas de diseño. El texto, las imágenes subidas y los derechos de uso aún pueden necesitar comprobación, y Lolly Work aporta catálogos compartidos y pasos de aprobación para eso. Para el equipo creativo la herramienta es una barandilla: sigues aportando los datos, el texto y la imagen, y la herramienta mantiene cada resultado fiel a la marca.

![Todo el trabajo de quien produce: escribir las palabras. La tipografía, el color y el espaciado se fijaron cuando se creó la herramienta](/t/url-shot?url=%2F%23%2Ftool%2Fwordmark%3Ftext%3DHello&width=1440&height=900&dpi=192&waitMs=2000&walker=1&format=svg&filename=aud-rules-in-the-tool)

Otras tres cosas distinguen este enfoque:

- **El archivo final, a partir de entradas.** Entran los datos, sale el archivo terminado, sin un "ahora guárdalo desde tu herramienta de diseño y retócalo".
- **Las herramientas componen herramientas.** Una herramienta puede incrustar el renderizado de otra en un único archivo terminado, sin acoplamiento de código entre ellas.
- **Abierto hasta el fondo.** El motor es de código abierto, y las herramientas, los recursos y los design tokens son archivos que puedes guardar en control de versiones o gestionar en Lolly Work, no filas en la base de datos de otra persona.

El diseño arriesgado sobrevive a las barandillas. Este mapa de ciudad de calidad póster es de trazados vectoriales verdaderos de calles y agua, a partir de un menú desplegable y dos campos de color que no se pueden orientar fuera del design system:

![Los anillos de canales y la red de calles de Ámsterdam dibujados de borde a borde con la propia tinta del design system, con cada trazo colocado por la plantilla y no a mano](/t/url-shot?url=%2F%23%2Ftool%2Fstreet-map%3Fcity%3Damsterdam%26theme%3Dlight%26full&width=1440&height=900&dpi=96&waitMs=3200&walker=1&format=svg&cropSelector=%23tool-canvas&dark=1&filename=ov2-street-map-poster)

## Innovar de forma probabilística, escalar de forma determinista

La mayoría de los discursos sobre "creatividad con IA" colocan el modelo en el lado equivocado de una vieja frontera. Escribas e iluminadores ya establecieron dónde cae. Trabajas con soltura en el boceto, donde se puede probar cualquier cosa y nada se compromete. Luego vas a la imprenta, que sí compromete. Los bocetos eran donde estaba el arte, y la imprenta era cómo viajaba, y la obra impresa podía merecer confianza porque la imprenta cumplía su promesa en cada tirada.

Lolly es la imprenta. Lleva a las ideas lo que quieras, un modelo, una diseñadora o un dibujo a mano alzada, pero en el momento en que una idea tiene que convertirse en muchos archivos, pasa por algo que renderiza igual cada vez, a partir de entradas que cualquiera puede volver a leer. La comparativa de arriba trata en realidad de quién hace repetible ese paso que compromete.

> Confía en el proceso creativo, escala con rigor.

## Gratis para siempre

**Si se renderiza en tu dispositivo, es gratis para siempre.** El motor, los shells, las herramientas y los formatos son de código abierto, y una versión publicada no se puede retirar. Lolly Work también es de código abierto. Una organización paga la infraestructura y la operación que elige, sin cargo de licencia de software por usuario ni por renderizado para el autoalojamiento. [Questions & answers](/info/faq.html) cuenta la historia que hay detrás de la promesa.

## Dónde vive tu contenido

El trabajo creativo de Lolly puede ejecutarse en hardware que posees, y sus design tokens, fuentes, logotipos y herramientas son archivos que puedes conservar. Con Lolly Work, los proyectos compartidos, los recursos, las políticas y los registros de auditoría viven en el almacenamiento que configura tu organización. [Trust](/info/trust.html) explica por qué importa, y la [Privacy Policy](/info/privacy.html) y [Verify It Yourself](/info/verify-yourself.html) te permiten comprobar la afirmación en lugar de fiarte de nuestra palabra.

## Herramienta por herramienta

[Lolly compared, tool by tool](/info/compare.html) compara Lolly con Canva, Adobe, Figma, Penpot, portales de marca, API de renderizado y conversores en línea, una página para cada uno, y expone [what runs where](/info/compare.html#what-runs-where).
