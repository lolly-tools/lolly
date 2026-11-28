# Ask Lolly

Ask Lolly responde a una pregunta con la sección correspondiente de estas guías, citada palabra por palabra, con su página como fuente y un enlace **Open in docs** a esa sección. No se genera nada: la respuesta se encuentra y se cita en tu dispositivo.

Bajo la sección citada están los lugares de la aplicación que coinciden con la pregunta: una herramienta, una utilidad, un proyecto guardado, un recurso del catálogo, un ajuste o una página de la aplicación. Cada fila solo sirve para navegar. Nada en una respuesta cambia un ajuste, abre un archivo ni actúa por ti, la misma regla que [Lolly Search](/info/search.html).

<!--i:eti-chat-->
## Hacer una pregunta

Escribe en el campo de preguntas al pie de la vista y pulsa Enter. Se ignora cualquier texto de menos de dos caracteres. Las respuestas se apilan sobre el campo, con la más reciente al final.

![Ask Lolly, abierto y vacío: el campo de preguntas al pie de la vista, con la nota de que las respuestas vienen de la documentación](/t/url-shot?url=%2F%23%2Fask&width=1200&height=820&waitMs=2200&format=svg&walker=1&filename=ask-view)

::: note Cada pregunta es independiente
Las preguntas anteriores no aportan contexto a las siguientes, así que «¿y el PDF?» después de una pregunta sobre exportación se interpreta como una pregunta solo sobre PDF. Haz la pregunta completa cada vez.
:::

La primera palabra de tu pregunta decide qué encabeza la respuesta:

| Empiezas por | Qué aparece primero |
|---|---|
| *where*, *find*, *open*, *show*, *go to*, *goto*, *take*, *jump*, *navigate*, *switch* | los lugares de la aplicación que coinciden |
| *make*, *create*, *generate*, *build*, *design*, *convert*, *resize*, *compress*, *remove*, *strip*, *export*, *render*, *add* | las herramientas que coinciden |
| cualquier otra cosa, incluidos *how do I* y *what is* | la sección de la documentación, que es la opción predeterminada |

Siempre se recuperan ambas partes, así que una pregunta mal interpretada solo cambia el orden de la respuesta.

La búsqueda de coincidencias descarta palabras habituales de las preguntas (*how*, *do*, *I*, *the*, *my*). Ordena las secciones por cuántas de tus otras palabras cubren y luego por dónde coinciden: un encabezado cuenta más que el cuerpo del texto. La coincidencia es por subcadena, sin distinguir mayúsculas ni acentos, así que un error de escritura no se corrige. Cuando no hay coincidencias, Ask lo indica y remite al índice de la documentación.

**Better matching** es opcional. Tras tu primera respuesta, Ask puede ofrecer un pequeño modelo de búsqueda de coincidencias, con su tamaño de descarga. El modelo relaciona una pregunta con una guía que usa palabras distintas para lo mismo. Se descarga solo cuando aceptas, se ejecuta en este dispositivo y cambia únicamente qué secciones aparecen primero. La respuesta sigue usando las propias palabras de la documentación. También puedes descargarlo como **Ask matching model** en **Settings → Preferences → Available offline** ([Disponible sin conexión](/info/dashboard.html#available-offline)).

<!--i:eti-clipboard-->
## Qué recibes

Una tarjeta de respuesta tiene un orden fijo:

1. **La propia sección**, renderizada desde el código fuente de la documentación: párrafos, listas, tablas, código y citas, con enlaces de la aplicación y de `/info` activos. Una sección larga termina en **Show more**, que abre el resto en el mismo lugar. Las imágenes se omiten, y un enlace a otro sitio se muestra como texto sin formato.
2. **La cita** - *Página › Encabezado* - y el enlace **Open in docs** a esa sección exacta.
3. **More in the docs** - hasta cuatro secciones más que coinciden, como enlaces.
4. **Las filas de la aplicación**, bajo los mismos encabezados de grupo que usa Search.

El texto completo procede de la versión equivalente en markdown que cada página de la documentación publica en `/info/<slug>.md`. Esas versiones solo están en inglés. En otro idioma, y en las pocas páginas que no se generan a partir de markdown, la respuesta muestra en su lugar el extracto breve del índice de búsqueda. La cita y el enlace **Open in docs** siguen apuntando a la página en tu idioma.

<!--i:eti-map-pin-->
## Dónde está

La ruta es `#/ask`. No tiene pestaña ni tarjeta en la cuadrícula de Utilities. Llegas a la vista desde la barra de búsqueda o por su dirección.

- <!--i:search--> **Desde la búsqueda.** Cada panel de resultados termina con una fila **Ask Lolly: *tu consulta***, bajo los resultados de los otros grupos. La fila abre `#/ask?q=…`, y la vista hace la pregunta una vez al llegar. Las palabras llegan en minúsculas y sin puntuación, así que ajústalas en el campo de preguntas si lo necesitas.
- <!--i:link--> **Desde un enlace.** `#/ask?q=how%20do%20I%20export%20a%20transparent%20png` abre la vista con esa pregunta ya hecha. El fragmento de la URL solo fija la primera pregunta. Las preguntas que escribas después se responden en el mismo lugar y nunca cambian la dirección.

La barra de búsqueda se oculta en esta vista porque el campo de preguntas usa Enter. La píldora de retroceso te devuelve a donde estabas.

Las respuestas se conservan durante esta sesión: siguen ahí si sales y vuelves, y una recarga las borra. No se escribe nada en el almacenamiento, así que no hay historial que gestionar.

<!--i:eti-download-->
## Sin conexión

Las respuestas vienen de dos archivos estáticos que publica el sitio de documentación: el índice de búsqueda por idioma y la versión equivalente en markdown de la página. Ambos se solicitan por su nombre, así que Ask funciona sin conexión una vez que están en caché. Leer las guías en la aplicación las guarda en caché. **Guides & docs**, en [Disponible sin conexión](/info/dashboard.html#available-offline), obtiene todo el sitio, incluidas las capturas de pantalla, en una sola descarga.

Sin estos archivos, la parte de documentación de una respuesta no aparece, y no se muestra ningún error. Las filas de la aplicación siguen apareciendo, porque buscan coincidencias en datos que ya están en el dispositivo.

<!--i:eti-lock-->
## Privacidad

Tu pregunta nunca sale del dispositivo. La búsqueda de coincidencias se ejecuta localmente sobre archivos solicitados por su nombre, así que lo que escribiste no forma parte de ninguna petición. Ningún servidor ve tu pregunta, ninguna cuenta la tiene y no queda ningún registro tras recargar. La [Política de privacidad](/info/privacy.html) enumera todo lo que la aplicación obtiene o envía.

---

**Relacionado:** [Lolly Search](/info/search.html) para la barra que transmite las preguntas. [Usar Lolly](/info/using.html) para el resto de la aplicación. [Ajustes de Lolly](/info/dashboard.html#available-offline) para descargar primero la documentación y usarla sin conexión.
