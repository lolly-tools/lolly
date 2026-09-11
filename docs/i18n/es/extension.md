# Extensión de navegador

La extensión **Lolly URL Screenshot** permite que la aplicación web capture cualquier página web desde tu navegador. Sin ella, capturar una URL requiere la aplicación de escritorio - una página del navegador no puede leer píxeles de otro sitio por su cuenta. La extensión sí puede, usando la misma captura que usa la aplicación de escritorio.

Hace otro trabajo del mismo modo: leer una sola página que tú nombras para que Brand Studio pueda extraer una marca de un sitio web en directo. Ambos se explican abajo.

Funciona en navegadores basados en Chromium: **Chrome, Edge, Brave, Arc, Opera** - Chrome 111 o más reciente.

Hasta que se instala, **URL Screenshot** igualmente se abre para que puedas componer una captura, y una nota en la parte superior de los controles de la herramienta indica qué falta.

![La nota de la herramienta URL Screenshot ofreciendo la extensión, mostrada cuando la captura a archivo no tiene un host donde ejecutarse](/t/url-shot?url=%2F%23%2Ftool%2Furl-shot&width=1440&height=900&dpi=192&waitMs=2400&walker=1&format=svg&cropSelector=%23capture-hint-notice&dark=1&filename=exp-url-shot-notice)

Todos los controles están activos mientras esperas: la URL de destino, la profundidad de desplazamiento, el retardo de estabilización, los recortes de encuadre y el recoloreado. Solo la captura en sí necesita un host.

![Los controles de URL Screenshot con una URL de destino, profundidad de desplazamiento, retardo de estabilización y recortes de encuadre, todos utilizables antes de que exista la extensión](/t/url-shot?url=%2F%23%2Ftool%2Furl-shot%3Furl%3Dhttps%3A%2F%2Flolly.tools%26scrollDepth%3D0.3%26waitMs%3D1200&width=1440&height=2200&dpi=192&waitMs=2400&format=svg&css=%23tool-canvas%7Bdisplay%3Anone%7D&cropSelector=%23tool-inputs&walker=1&dark=1&filename=fq-url-shot-controls)

## Instalar

### Desde la Chrome Web Store

*Próximamente.* Una vez publicada, la instalarás con un clic y luego recargarás Lolly.

### Cárgala tú mismo (desarrolladores)

La extensión vive en el repositorio en `shells/chrome-extension/`.

1. Abre `chrome://extensions`.
2. Activa el **modo de desarrollador** (arriba a la derecha).
3. Haz clic en **Cargar descomprimida** y elige la carpeta `shells/chrome-extension/`.
4. Recarga Lolly - **URL Screenshot** ahora funciona en el navegador.

## Cómo funciona

- Un pequeño script le indica a Lolly que la extensión está presente, así que la herramienta **URL Screenshot** se activa automáticamente - sin configuración.
- Al renderizar, la extensión abre la página de destino en una pestaña en segundo plano, la captura mediante el DevTools Protocol (el mismo `Page.captureScreenshot` que usa la aplicación de escritorio), luego cierra la pestaña y devuelve la imagen.
- Se ejecuta enteramente en tu navegador, en tu red - así que capturar `localhost` o un sitio interno funciona. La captura en sí nunca se sube a ningún sitio; el único tráfico de red es el de tu propio navegador cargando la página que pediste capturar.

Mientras se ejecuta una captura, puede que veas brevemente un aviso *"…started debugging this browser"* en la pestaña temporal. Eso es el DevTools Protocol en acción; desaparece solo cuando la captura termina.

## Leer un sitio para Brand Studio

La fuente **Website** en Brand Studio inicia una marca a partir de un sitio que ya tienes. En Chromium, la extensión es la que lo lee; en la aplicación de escritorio, una obtención nativa hace la misma tarea, y en un navegador normal sin extensión, la casilla ni siquiera se ofrece.

Qué ocurre cuando la pulsas:

- Una dirección, una página. La extensión la abre en el mismo tipo de pestaña en segundo plano, lee el marcado renderizado, el texto de la hoja de estilos y un puñado de imágenes de iconos y logotipos, y luego cierra la pestaña. No sigue enlaces ni rastrea el sitio.
- Las hojas de estilos y fuentes alojadas en otro lugar (una CDN, un servicio de fuentes) también se obtienen, porque los colores y la tipografía de la página viven en ellas. Las solicitudes de origen cruzado se hacen sin tus cookies; las del mismo origen sí las usan, exactamente como lo haría la propia página.
- Todo tiene un límite - un número acotado de hojas, imágenes y bytes - para que una página hostil o mal formada devuelva material parcial en lugar de quedarse colgada.
- Los bytes vuelven directamente a la pestaña de Lolly que los solicitó. El análisis en colores, tipografía y logotipos ocurre en tu dispositivo; nada se sube.

No se lee nada hasta que pulsas. Pegar una dirección solo rellena el campo.

## Después de instalar

Recarga la pestaña de Lolly. El aviso "Get the extension" desaparece y **URL Screenshot** queda disponible en la galería y en el modo Batch.

## Permisos

Su `manifest.json` declara cuatro permisos más acceso a hosts:

- `debugger` - controla la pestaña en segundo plano mediante el DevTools Protocol. Esto es lo que toma la captura de pantalla.
- `tabs` - abre la pestaña temporal en segundo plano y la cierra después.
- `scripting` - ejecuta el lector de una sola página dentro del sitio que indicaste, para la fuente Website de Brand Studio.
- `storage` - anota el id de una pestaña que abrió, solo en el almacenamiento de sesión, para que la pestaña se cierre igualmente si el navegador suspende la extensión a mitad de la lectura. Se borra al siguiente inicio; nada sobre ti queda almacenado.
- `host_permissions: ["<all_urls>"]` - acceso a *todos* los sitios, porque puedes apuntarla a cualquier URL que elijas. Chrome muestra esto al instalar como una advertencia amplia de "leer y cambiar todos tus datos en todos los sitios web".

A pesar de esa advertencia, solo lee la única página que le pidas capturar o importar, y no lee ni transmite tus datos de navegación - nada se sube a ningún sitio.

El manifiesto también fija `minimum_chrome_version: 111`. La versión actual es 0.2.1.

## Solución de problemas

- **¿Sigues viendo "Get the extension"?** Recarga la pestaña de Lolly - la detección ocurre al cargar la página.
- **¿No pasa nada en este sitio?** La extensión solo se activa en los propios orígenes de Lolly. ¿Estás ejecutando una compilación personalizada en otro dominio? Añádelo a `content_scripts.matches` en el `manifest.json` de la extensión.
- **¿Falla una captura?** Comprueba que la URL sea accesible y empiece por `http://` o `https://`. Algunas páginas bloquean activamente la captura automatizada.
