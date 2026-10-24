# Ask Lolly

Escribe una pregunta y Ask Lolly responde con la sección de estas guías que la cubre, palabra por palabra, citando la página de la que procede y con un enlace **Open in docs** directo a esa sección. No se genera nada: la respuesta se recupera, se cita y se atribuye, en tu dispositivo.

Bajo la sección citada están los lugares de la aplicación que coinciden con la misma pregunta: una herramienta, una utilidad, un proyecto guardado, un recurso del catálogo, un ajuste o una página de la aplicación. Cada fila solo navega. Nada de una respuesta cambia un ajuste, abre un archivo ni actúa por ti, la misma regla que sigue [Search](/info/search.html).

## Hacer una pregunta

Escribe en el campo de pregunta al pie de la vista y pulsa Enter. Se ignora todo lo que tenga menos de dos caracteres. Las respuestas se apilan sobre el campo, la más nueva al final, y puedes seguir preguntando.

![Ask Lolly, abierto y vacío: el campo de pregunta al pie de la vista, con la nota de que las respuestas vienen de la documentación](/t/url-shot?url=%2F%23%2Fask&width=1200&height=820&waitMs=2200&format=svg&walker=1&filename=ask-view)

Cada pregunta se responde por sí sola: las preguntas anteriores no arrastran contexto, así que "¿y el PDF?" después de una pregunta sobre exportar se lee como una pregunta sobre PDF y nada más. Haz la pregunta completa cada vez.

La primera palabra de tu pregunta decide qué encabeza la respuesta:

| Empiezas con | Qué encabeza |
|---|---|
| *where*, *find*, *open*, *show*, *go to*, *goto*, *take*, *jump*, *navigate*, *switch* | los lugares de la aplicación que coinciden |
| *make*, *create*, *generate*, *build*, *design*, *convert*, *resize*, *compress*, *remove*, *strip*, *export*, *render*, *add* | las herramientas que coinciden |
| cualquier otra cosa - incluidas *how do I* y *what is* | la sección de la documentación, que es lo predeterminado |

Siempre se recuperan ambas mitades, así que una pregunta mal interpretada reordena una respuesta en lugar de perder la mitad.

La coincidencia descarta las palabras comunes de las preguntas (*how*, *do*, *I*, *the*, *my*) y clasifica una sección según cuántas de tus palabras restantes cubre, y luego según dónde coincidieron: un encabezado cuenta más que el texto del cuerpo. La coincidencia es por subcadena, sin distinguir mayúsculas ni acentos, así que no se corrige una errata. Cuando nada coincide, Ask lo dice y señala el índice de la documentación en lugar de inventar una respuesta.

**Better matching** es opcional. Tras tu primera respuesta, Ask puede ofrecer un pequeño modelo de coincidencia, con su tamaño de descarga, que ayuda a relacionar una pregunta con una guía que usa otras palabras para lo mismo. Solo se descarga si aceptas, se ejecuta en este dispositivo y solo cambia qué secciones quedan primero: la respuesta sigue siendo las propias palabras de la documentación. También puedes descargarlo desde **Settings → Preferences → Available offline**, donde aparece como **Ask matching model** ([Available offline](/info/dashboard.html#available-offline)).

## Qué devuelve

Una tarjeta de respuesta se compone en un orden fijo:

1. **La propia sección**, renderizada desde el código fuente de la documentación: párrafos, listas, tablas, código y citas, con los enlaces de la aplicación y de `/info` activos. Una sección larga se recorta con un **Show more** que la abre en el sitio. Las imágenes se omiten, y un enlace a otro sitio se renderiza como texto simple y no como ancla.
2. **La cita** - *Page › Heading* - y el enlace **Open in docs** a esa sección exacta.
3. **More in the docs** - hasta cuatro secciones más que coincidieron, como enlaces.
4. **Las filas de la aplicación**, bajo los mismos encabezados de grupo que usa Search.

El texto completo procede del gemelo en markdown simple que publica cada página de documentación en `/info/<slug>.md`, y esos gemelos solo existen en inglés. En otro idioma - y en la minoría de páginas que no se generan desde markdown - la respuesta recurre al breve extracto guardado en el índice de búsqueda en lugar de la sección completa. La cita y el enlace **Open in docs** están en ambos casos, apuntando a la página en tu propio idioma.

## Dónde vive

La ruta es `#/ask`. No tiene pestaña ni mosaico en la cuadrícula de Utilities; las vías de entrada son la barra de búsqueda y la propia dirección.

- <!--i:search--> **Desde la búsqueda.** Cada panel de resultados lleva una fila **Ask Lolly: *tu consulta*** al final del todo, bajo los resultados concretos que hayan encontrado los demás grupos. Entrega la pregunta como `#/ask?q=…`, y la vista hace la pregunta una vez al llegar. Las palabras entregadas llegan en minúsculas y sin puntuación, así que refínalas en el campo de pregunta si lo necesitas.
- <!--i:link--> **Desde un enlace.** `#/ask?q=how%20do%20I%20export%20a%20transparent%20png` abre la vista con esa pregunta ya hecha. El hash es solo la semilla de entrada: las preguntas que escribes después se responden en el sitio y nunca reescriben la dirección.

La barra de búsqueda se aparta dentro de esta vista, ya que el campo de pregunta usa Enter, y la píldora de volver te devuelve a donde estabas.

Las respuestas en pantalla duran esta sesión: siguen ahí si navegas a otro lado y vuelves, y una recarga las borra. No se escribe nada en el almacenamiento, así que no hay historial que gestionar.

## Sin conexión

Las respuestas se componen a partir de dos archivos estáticos que el sitio de documentación ya publica: el índice de búsqueda de cada idioma y el gemelo en markdown de la página. Ambos se descargan por nombre, así que Ask sigue funcionando sin conexión una vez guardados en caché. Leer las guías en la aplicación los guarda en caché sobre la marcha, y **Guides & docs** en [Available offline](/info/dashboard.html#available-offline) trae todo el sitio, capturas incluidas, en una sola descarga.

Sin ellos, la mitad de documentación de una respuesta simplemente no aparece, sin ningún error. Las filas de la aplicación sí, porque se comparan con datos que ya están en el dispositivo.

## Privacidad

Tu pregunta nunca sale del dispositivo. La coincidencia se ejecuta en local contra archivos descargados por nombre, así que lo que escribiste no forma parte de ninguna solicitud; no hay ningún servidor que la vea, ninguna cuenta a la que esté asociada y ningún registro de ella tras recargar. Consulta la [Privacy Policy](/info/privacy.html) para la lista completa de lo que la aplicación llega a descargar o enviar.

---

**Relacionado:** [Search](/info/search.html) para la barra que entrega las preguntas. [Using Lolly](/info/using.html) para el resto de la aplicación. [Settings](/info/dashboard.html#available-offline) para llevar primero la documentación a modo sin conexión.
