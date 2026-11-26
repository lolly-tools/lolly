# Cómo se compara Lolly

Lolly crea archivos que respetan la marca en tu propio dispositivo, sin una cuenta. **Lolly Work** es el servidor para equipos: inicio de sesión, proyectos compartidos, aprobaciones y renderizado en servidor, en equipos que opera tu organización. Ambos son de código abierto bajo MPL-2.0.

La mayoría de los equipos conserva las herramientas que tiene. Una aplicación de diseño aporta los diseños, un DAM sigue siendo la fuente oficial y Lolly convierte las entradas aprobadas en archivos terminados. [Usa Lolly con tu DAM actual](/info/use-with-dam.html) describe esa combinación. La idea que la sustenta es la [soberanía del contenido](/info/content-sovereignty.html).

<!--i:eti-gauge-->
## Las herramientas de hoy

Cada anillo muestra hasta qué punto una clase de producto satisface una necesidad. Pulsa un **?** junto a una fila para ver las pruebas y el **?** junto a la leyenda para ver cómo funcionan las puntuaciones.

::: figure positioning-comparison
Comparación de capacidades. Investigación de competidores a partir de documentación de proveedores, de agosto al 21 de noviembre de 2026. Lolly y Lolly Work revisados el 21 de noviembre de 2026. Puntuación: 0 ausente, 25 solución alternativa, 50 real pero restringida o parcial, 75 sólida con salvedades, 100 competencia principal.
:::

::: details Fuentes de las puntuaciones que cambiaron en noviembre de 2026
- Canva: [registro de cambios de la API](https://www.canva.dev/docs/apps/rest-apis/changelog/), [aplicaciones de servicio](https://www.canva.dev/blog/developers/canva-service-accounts/), [ayuda de Brand Controls](https://www.canva.com/help/brand-control/)
- Adobe: [registro de cambios de la API de InDesign](https://developer.adobe.com/firefly-services/docs/indesign-apis/getting-started/changelog/), [precios de Adobe Express](https://www.adobe.com/express/pricing)
- Figma: [créditos de agentes e IA](https://help.figma.com/hc/en-us/articles/42614902212887), [servidor MCP](https://developers.figma.com/docs/figma-mcp-server/)
- Frontify y Bynder: [nota de versión de Frontify de octubre de 2026](https://news.frontify.com/163371-what-s-new-in-october-2026), [MCP de Frontify](https://help.frontify.com/en/articles/14787214-frontify-mcp-beta)
- Bannerbear y Placid: [precios de Bannerbear](https://www.bannerbear.com/pricing/), [registro de cambios de Bannerbear](https://www.bannerbear.com/changelog/), [precios de Placid](https://placid.app/pricing)
- Penpot: [precios de alojamiento propio](https://penpot.app/pricing/self-host), [versiones](https://github.com/penpot/penpot/releases)
- Cloudinary: [procedencia del contenido](https://cloudinary.com/documentation/content_provenance_and_authenticity), [precios](https://cloudinary.com/pricing)
:::

Las funciones y la trayectoria son filas separadas. La primera versión pública de Lolly fue la 1.0.1, el 30 de agosto de 2026, su seguridad aún no ha tenido una auditoría independiente y sus pruebas de adopción tienen unos pocos meses. [Adopción & gobernanza](/info/adoption-governance.html#status) contiene el estado actual.

<!--i:eti-hammer-->
## Cuándo recurrir a Lolly

::: cols
## Recurre a Lolly cuando

- Se necesita una y otra vez el mismo tipo de archivo: tarjetas de eventos, insignias, certificados, alertas, tarjetas para redes sociales
- Muchos archivos parten de una plantilla y una tabla de valores, en [Lolly Batch](/info/batch.html#make-many-versions-of-one-design) o la CLI
- Los colores, la tipografía y los recursos deben mantenerse dentro del design system, incluso en un lienzo abierto
- Un diseño terminado de Figma, Penpot, Illustrator, InDesign, Affinity o PDF debe convertirse en editable y repetible ([Importar un diseño](/info/design-import.html))
- Los archivos deben crearse en tus propios dispositivos o servidores

## Recurre a otra opción cuando

- El trabajo es retoque fotográfico detallado o ilustración
- Estás diseñando la interfaz de una aplicación y creando sus prototipos
- Necesitas una gran biblioteca de recursos y plantillas lista desde el primer día
- Necesitas un servicio gestionado con una larga trayectoria a gran escala
:::

Los diseños importados y los tokens de diseño compartidos permiten que un equipo combine Lolly con aplicaciones especializadas, mientras Lolly Work gobierna los recursos compartidos, la revisión y la entrega.

Para equipos con un DAM cuidadosamente organizado, empieza por conservar esa biblioteca y a sus administradores. [La experiencia de SUSE con Brandfolder](/info/suse-brandfolder.html) documenta cómo la integración apoyó la adopción y la gestión del cambio en las aprobaciones. Los proveedores de DAM y los socios de implementación pueden evaluar la misma configuración mediante [el flujo de trabajo para socios](/info/dam-partners.html).

En **Lolly Markdown Slides**, todo un deck se escribe como datos, se maqueta en vivo y se exporta como un archivo PowerPoint nativo y editable.

![Lolly Markdown Slides en la vista dividida: las diapositivas del deck enumeradas como bloques a la izquierda, el renderizado del deck maquetado a la derecha](/t/url-shot?url=%2F%23%2Ftool%2Fdeck-studio&width=1440&height=900&dpi=192&waitMs=2600&walker=1&format=svg&dark=1&filename=ov2-deck-studio-output)

<!--i:eti-shield-check-->
## Las reglas están en la herramienta

Lolly incorpora reglas de marca reutilizables en la herramienta: colores, fuentes, márgenes de sangrado, espaciado y entradas permitidas. La plantilla fija las partes que un destinatario no debe cambiar. Lolly Work añade acceso por grupos y políticas de entrada alrededor de esa plantilla, con cadenas de aprobación para las propuestas al catálogo y la entrega.

Revisar una herramienta una vez facilita la producción repetible, porque cada salida hereda sus reglas de diseño. Los textos, las imágenes subidas y los derechos de uso pueden seguir necesitando revisión, y Lolly Work ofrece catálogos compartidos y pasos de aprobación para ello. Para el equipo creativo, la herramienta marca los límites: tú sigues aportando los datos, el texto y la imagen, y la herramienta mantiene cada resultado fiel a la marca.

![Todo el trabajo de quien produce: escribir las palabras. La tipografía, el color y el espaciado quedaron fijados al crear la herramienta](/t/url-shot?url=%2F%23%2Ftool%2Fwordmark%3Ftext%3DHello&width=1440&height=900&dpi=192&waitMs=2000&walker=1&format=svg&filename=aud-rules-in-the-tool)

Tres diferencias más:

- **El archivo final, a partir de las entradas.** Introduces datos y obtienes un archivo terminado, sin un "ahora guárdalo desde tu herramienta de diseño y retócalo".
- **Las herramientas componen otras herramientas.** Una herramienta puede incrustar el renderizado de otra en un único archivo terminado, sin acoplamiento de código entre ellas.
- **Código abierto.** El motor es de código abierto, y las herramientas, los recursos y los tokens de diseño son archivos que puedes conservar en un sistema de control de versiones o gestionar en Lolly Work, no filas en la base de datos de otra persona.

El diseño atrevido sobrevive a los límites. Este mapa urbano con calidad de póster está hecho de trazados vectoriales reales de calles y cursos de agua, a partir de un menú desplegable y dos campos de color que no permiten salirse del design system:

![Los anillos de canales y la red de calles de Ámsterdam dibujados de borde a borde con la tinta propia del design system, cada trazo colocado por la plantilla en lugar de a mano](/t/url-shot?url=%2F%23%2Ftool%2Fstreet-map%3Fcity%3Damsterdam%26theme%3Dlight%26full&width=1440&height=900&dpi=96&waitMs=3200&walker=1&format=svg&cropSelector=%23tool-canvas&dark=1&filename=ov2-street-map-poster)

<!--i:eti-stamp-->
## Innova de forma probabilística, escala de forma determinista

La mayoría de las propuestas de "creatividad con IA" colocan el modelo en el lado equivocado de una antigua línea. Los escribas y los iluminadores establecieron dónde cae. Trabajas con libertad en el boceto, donde todo se puede probar y nada es definitivo. Después pasas a la imprenta, que sí lo deja fijado. El arte estaba en los bocetos, y la imprenta era la forma de difundirlo, y se podía confiar en la obra impresa porque la imprenta cumplía su promesa en cada tirada.

Lolly es la imprenta. Aporta lo que quieras a las ideas, un modelo, un diseñador o un dibujo a mano alzada, pero en el momento en que una idea tiene que convertirse en muchos archivos, pasa por algo que renderiza siempre igual, a partir de entradas que cualquiera puede volver a leer. La comparación anterior trata, en realidad, de quién hace repetible ese paso que fija el resultado.

> Confía en el proceso creativo, escala con rigor.

<!--i:eti-tag-->
## Gratis para siempre

**Si se renderiza en tu dispositivo, es gratis para siempre.** El motor, las shells, las herramientas y los formatos son de código abierto, y una versión publicada no se puede retirar. Lolly Work también es de código abierto. Una organización paga por la infraestructura y la operación que elige, sin cargos de licencia de software por usuario ni por renderizado para el alojamiento propio. [Preguntas & respuestas](/info/faq.html) cuenta la historia de esa promesa.

<!--i:eti-map-pin-->
## Dónde reside tu contenido

El trabajo creativo de Lolly puede ejecutarse en hardware de tu propiedad, y sus tokens de diseño, fuentes, logotipos y herramientas son archivos que puedes conservar. Con Lolly Work, los proyectos compartidos, los recursos, las políticas y los registros de auditoría residen en el almacenamiento que configura tu organización. [Confianza](/info/trust.html) explica por qué importa, y la [Política de privacidad](/info/privacy.html) y [Compruébalo tú mismo](/info/verify-yourself.html) te permiten comprobar la afirmación en lugar de fiarte de nuestra palabra.

<!--i:eti-grid-->
## Herramienta por herramienta

[Lolly comparado, herramienta por herramienta](/info/compare.html) compara Lolly con Canva, Adobe, Figma, Penpot, portales de marca, API de renderizado y conversores en línea, una página para cada uno, y detalla [qué se ejecuta dónde](/info/compare.html#what-runs-where).
