# Extensión de navegador

Una página web no puede leer los píxeles de otro sitio web, así que la aplicación web de Lolly necesita ayuda para capturar una página. En un navegador basado en Chromium (Chrome, Edge, Brave, Arc u Opera, desde Chrome 111), la extensión gratuita **Lolly URL Screenshot** da esa ayuda, con la misma captura que usa la aplicación de escritorio. Con ella instalada:

- **[URL Screenshot](/t/url-shot)** guarda como archivo la página que compusiste;
- una dirección web pegada en un espacio de imagen puede convertirse en una captura de esa página, con **Screenshot this page**;
- la fuente **Website** de [Design System Setup](/info/brand-studio.html) puede leer una página para iniciar un design system.

Tú apruebas cada solicitud, y la aplicación de escritorio hace los mismos trabajos sin la extensión.

## Antes de instalar

Hasta que se instala la extensión, **URL Screenshot** sigue abriéndose, así que puedes componer una captura. Una nota en la parte superior de los controles de la herramienta dice qué falta.

![La nota de la herramienta URL Screenshot ofreciendo la extensión, mostrada cuando la captura a archivo no tiene un host donde ejecutarse](/t/url-shot?url=%2F%23%2Ftool%2Furl-shot&width=1440&height=900&dpi=192&waitMs=2400&walker=1&format=svg&cropSelector=%23capture-hint-notice&dark=1&filename=exp-url-shot-notice)

Todos los controles funcionan mientras esperas: la URL de destino, la profundidad de desplazamiento, el retardo de estabilización, los márgenes de recorte y el recoloreado. Solo la captura en sí necesita la extensión.

![Los controles de URL Screenshot con una URL de destino, profundidad de desplazamiento, retardo de estabilización y recortes de encuadre, todos utilizables antes de que exista la extensión](/t/url-shot?url=%2F%23%2Ftool%2Furl-shot%3Furl%3Dhttps%3A%2F%2Flolly.tools%26scrollDepth%3D0.3%26waitMs%3D1200&width=1440&height=2200&dpi=192&waitMs=2400&format=svg&css=%23tool-canvas%7Bdisplay%3Anone%7D&cropSelector=%23tool-inputs&walker=1&dark=1&filename=fq-url-shot-controls)

## Instalar

**Desde la Chrome Web Store:** próximamente. Cuando se publique la extensión, se instalará con un clic.

**Cárgala tú mismo (desarrolladores).** La extensión vive en el repositorio en `shells/chrome-extension/`. Esa carpeta es la compilación de producción, que funciona solo con Lolly en `https://lolly.tools`.

1. Abre `chrome://extensions`.
2. Activa **Developer mode** (arriba a la derecha).
3. Haz clic en **Load unpacked** y elige la carpeta `shells/chrome-extension/`.
4. Recarga la pestaña de Lolly. La detección ocurre cuando se carga la página, así que el aviso "Get the extension" desaparece. **URL Screenshot** (en Utilities) ya puede guardar capturas en un archivo y queda disponible en el modo Batch.

Para un servidor de desarrollo local, ejecuta `pnpm run pack:chrome-extension:dev` y carga `dist/chrome-extension-dev` en su lugar. Ese paquete también acepta `http://localhost:5173` y lleva **Development** en el nombre.

## Qué ocurre cuando Lolly pide algo

![La pestaña de Lolly pide una página y tú pulsas Approve once en la ventana de aprobación de la extensión. Se abre una pestaña en segundo plano, lee la página y se cierra. Luego la pestaña de Lolly recibe el resultado.](/info/diagrams/concepts/extension-request.svg)

1. **Lolly pide.** Un pequeño script indica a Lolly que la extensión está presente, así que una captura o una lectura de página pueden empezar sin más configuración.
2. **Tú apruebas.** La extensión abre su propia ventana **Approve page request**. Muestra el sitio solicitante, si quiere una captura o el contenido de la página, y la dirección de la página. No se lee nada hasta que pulsas **Approve once**. **Cancel**, o cerrar la ventana, termina la solicitud.
3. **Chrome pregunta una vez por sitio.** La primera vez que apruebas una solicitud para un sitio, Chrome también pregunta si la extensión puede acceder a ese sitio. Chrome conserva ese acceso una vez que lo permites, pero cada solicitud posterior sigue necesitando su propio **Approve once**.
4. **La página se lee en una pestaña en segundo plano.** La extensión abre la página de destino en una pestaña en segundo plano, la captura mediante el DevTools Protocol (el mismo `Page.captureScreenshot` que usa la aplicación de escritorio), cierra la pestaña y devuelve el resultado a la pestaña de Lolly que lo pidió.

Una aprobación cubre una solicitud y caduca a los 30 segundos. Solo una solicitud puede esperar o ejecutarse a la vez, y una solicitud aprobada se detiene a los 55 segundos. Si la página de Lolly se cierra o cambia, o la página de destino pasa a otro sitio, la solicitud se cancela.

La captura se ejecuta en tu navegador, en tu red, así que `localhost` y los sitios internos funcionan. La página se carga con la sesión de tu navegador, de modo que una página en la que tienes la sesión iniciada puede mostrar información privada en el resultado. La captura no se sube: el único tráfico de red es tu propio navegador cargando la página que pediste.

Mientras se ejecuta una captura puedes ver brevemente un aviso *"…started debugging this browser"* en la pestaña temporal. Es el DevTools Protocol trabajando, y el aviso desaparece cuando termina la captura.

## Leer un sitio para Design System Setup

La fuente **Website** de Design System Setup inicia un design system a partir de un sitio que ya tienes. En un navegador Chromium, la extensión lee la página. En la aplicación de escritorio, la propia aplicación descarga la página. En un navegador sin extensión, el mosaico Website no se ofrece.

- **Una dirección, una página.** Tras tu aprobación, la extensión abre la página en el mismo tipo de pestaña en segundo plano, lee el marcado renderizado, el texto de las hojas de estilo y un puñado de imágenes de iconos y logotipos, y luego cierra la pestaña. No sigue enlaces ni rastrea.
- **Las hojas de estilo alojadas en otro sitio** (una CDN o un servicio de fuentes) también se descargan, porque los colores y la tipografía de la página viven en ellas. Las solicitudes entre orígenes van sin tus cookies; las del mismo origen las usan, como haría la propia página.
- **Todo tiene tope**, con un límite en el número de hojas de estilo e imágenes y en bytes, así que una página hostil o a medio romper devuelve material parcial en lugar de colgarse.
- **El análisis ocurre en tu dispositivo.** Los bytes vuelven directamente a la pestaña de Lolly que los pidió, que los convierte en colores, tipografía y logotipos.

Pegar una dirección solo rellena el campo. No se lee nada hasta que inicias la lectura y pulsas **Approve once**.

## Permisos

El `manifest.json` de la extensión declara cuatro permisos, además de un acceso a sitios que pide de uno en uno. Define `minimum_chrome_version: 111`, y la versión actual es la 0.4.0.

| Permiso | Para qué sirve | Cuándo se concede |
|---|---|---|
| `debugger` | Maneja la pestaña en segundo plano mediante el DevTools Protocol, que hace la captura. | Al instalar |
| `tabs` | Abre la pestaña temporal en segundo plano y la cierra después, y comprueba que ni la página de Lolly ni la de destino se han movido desde que aprobaste. | Al instalar |
| `scripting` | Ejecuta el lector de una página dentro del sitio que indicaste, para la fuente Website. | Al instalar |
| `storage` | Anota el ID de una pestaña que abrió, solo en el almacenamiento de sesión, para que la pestaña se cierre aunque el navegador suspenda la extensión a mitad de lectura. Se borra en el siguiente arranque; no se guarda nada sobre ti. | Al instalar |
| `optional_host_permissions: ["http://*/*", "https://*/*"]` | Acceso a sitios, no concedido al instalar. Cuando pulsas **Approve once**, la extensión pide a Chrome acceso al único sitio de esa solicitud. | La primera vez que apruebas una solicitud para ese sitio, tras preguntártelo Chrome |

La extensión lee solo la única página que apruebas. No lee ni envía tus datos de navegación, y no se sube nada.

## Solución de problemas

- **¿Sigues viendo "Get the extension"?** Recarga la pestaña de Lolly.
- **¿No pasa nada en este sitio?** La extensión funciona solo en `https://lolly.tools`, además de `http://localhost:5173` en el paquete de desarrollo. Otro origen, como una copia autoalojada de Lolly, necesita su propia compilación de la extensión que enumere ese origen tanto en `manifest.json` como en `policy.js`. Editar solo el manifiesto no funciona.
- **¿Falla una captura?** Comprueba que la URL es accesible y empieza por `http://` o `https://`. Algunas páginas bloquean la captura automatizada. Si pulsaste **Cancel**, cerraste la ventana de aprobación o esperaste más de 30 segundos, inicia de nuevo la captura.
