# Extensión del navegador

Una página web no puede leer los píxeles de otro sitio web. En un navegador basado en Chromium (Chrome, Edge, Brave, Arc u Opera, a partir de Chrome 111), la extensión gratuita **Lolly URL Screenshot** permite que la aplicación web de Lolly haga capturas de una página con el mismo método que usa la aplicación de escritorio. Con la extensión instalada:

- **[Lolly URL Screenshot](/t/url-shot)** guarda la página que compusiste como archivo;
- una dirección web pegada en un espacio para imágenes se puede convertir en una captura de esa página, con **Screenshot this page**;
- el origen **Website** de [Lolly Design System Setup](/info/brand-studio.html) puede leer una página para iniciar un design system.

Apruebas cada solicitud, y la aplicación de escritorio hace los mismos trabajos sin la extensión.

<!--i:eti-checklist-->
## Antes de instalar

Sin la extensión, **Lolly URL Screenshot** sigue abriéndose y puedes componer una captura. Una nota sobre los controles de la herramienta indica qué falta.

![La nota de la herramienta URL Screenshot que ofrece la extensión, mostrada cuando la captura a archivo no tiene un host donde ejecutarse](/t/url-shot?url=%2F%23%2Ftool%2Furl-shot&width=1440&height=900&dpi=192&waitMs=2400&walker=1&format=svg&cropSelector=%23capture-hint-notice&dark=1&filename=exp-url-shot-notice)

Todos los controles funcionan sin la extensión: la URL de destino, la profundidad de desplazamiento, el tiempo de espera para estabilizar la página, los márgenes de recorte y el cambio de color. Solo la captura necesita la extensión.

![Los controles de Lolly URL Screenshot con una URL de destino, profundidad de desplazamiento, tiempo de espera para estabilizar la página y márgenes de recorte, todos utilizables antes de tener la extensión](/t/url-shot?url=%2F%23%2Ftool%2Furl-shot%3Furl%3Dhttps%3A%2F%2Flolly.tools%26scrollDepth%3D0.3%26waitMs%3D1200&width=1440&height=2200&dpi=192&waitMs=2400&format=svg&css=%23tool-canvas%7Bdisplay%3Anone%7D&cropSelector=%23tool-inputs&walker=1&dark=1&filename=fq-url-shot-controls)

<!--i:eti-download-->
## Instalar

**Desde Chrome Web Store:** próximamente. Una vez publicada, la extensión se instala con un clic.

**Cárgala tú mismo (desarrolladores).** El código fuente de la extensión está en el repositorio, en `shells/chrome-extension/`. El paso de empaquetado crea el paquete de producción a partir de esa carpeta. Ese paquete solo funciona con Lolly en `https://lolly.tools`.

1. Ejecuta `pnpm run pack:chrome-extension`. Crea el paquete en `dist/chrome-extension/`.
2. Abre `chrome://extensions`.
3. Activa **Developer mode** (arriba a la derecha).
4. Haz clic en **Load unpacked** y elige la carpeta `dist/chrome-extension/`.
5. Recarga la pestaña de Lolly. Lolly detecta la extensión cuando se carga la página, y el aviso "Get the extension" desaparece. **Lolly URL Screenshot** (en Utilities) ya puede guardar capturas en un archivo y funciona en modo Lolly Batch.

::: details Para un servidor de desarrollo local o la carpeta de código fuente
Para un servidor de desarrollo local, ejecuta `pnpm run pack:chrome-extension:dev` y carga `dist/chrome-extension-dev` en su lugar. Ese paquete también acepta `http://localhost:5173` y lleva **Development** en su nombre.

Cargar la propia carpeta `shells/chrome-extension/` también funciona para capturas PNG. Esa carpeta no incluye el recorrido de la página, que se incorpora en el paso de empaquetado. Un SVG de esa carpeta contiene una captura, no formas.
:::

<!--i:eti-user-check-->
## Qué ocurre cuando Lolly hace una solicitud

![La pestaña de Lolly solicita una página y pulsas Approve once en la ventana de aprobación de la extensión. Se abre una pestaña en segundo plano, lee la página y se cierra. Después, la pestaña de Lolly recibe el resultado.](/info/diagrams/concepts/extension-request.svg)

1. **Lolly lo solicita.** Un pequeño script informa a Lolly de que la extensión está presente, así que puede iniciarse una captura o una lectura de página sin más configuración.
2. **Tú lo apruebas.** La extensión abre su propia ventana **Approve page request**. Muestra el sitio solicitante, si quiere una captura o el contenido de la página y la dirección de la página. No se lee nada hasta que pulses **Approve once**. **Cancel**, o cerrar la ventana, finaliza la solicitud.
3. **Chrome pregunta una vez por sitio.** La primera vez que apruebas una solicitud para un sitio, Chrome también pregunta si la extensión puede acceder a ese sitio. Chrome conserva ese acceso cuando lo permites, pero cada solicitud posterior sigue necesitando su propio **Approve once**.
4. **La página se lee en una pestaña en segundo plano.** La extensión abre la página de destino en una pestaña en segundo plano, la captura mediante DevTools Protocol (el mismo `Page.captureScreenshot` que usa la aplicación de escritorio), cierra la pestaña y devuelve el resultado a la pestaña de Lolly que lo solicitó.

::: details Cómo funciona una captura SVG
Para un **SVG**, la extensión recorre la página en lugar de tomar una imagen de la pantalla. Un script incluido en la extensión lee el diseño de la página en la pestaña en segundo plano y convierte la página en formas y texto contorneado. El archivo sigue nítido a cualquier tamaño y cada parte sigue siendo editable. Las imágenes de la página siguen siendo imágenes. Todo lo que la página dibuje con un lienzo, un vídeo o un efecto que SVG no pueda expresar se copia de una captura del mismo momento. Lolly comprueba el resultado frente a esa captura. Cuando los dos difieren demasiado, el SVG contiene la captura en su lugar.

Para contornear el texto con la tipografía de la propia página, la extensión entrega a Lolly los archivos de fuentes que cargó la página. Chrome no guarda los bytes de una fuente donde una extensión pueda leerlos, así que la extensión vuelve a solicitar cada fuente a la página. Tu navegador suele responder desde su caché, y la política de seguridad de la propia página sigue aplicándose a esa solicitud.
:::

Una aprobación cubre una solicitud y caduca a los 30 segundos. Solo puede haber una solicitud en espera o en ejecución a la vez, y una solicitud aprobada se detiene a los 55 segundos. Si la página de Lolly se cierra o cambia, o la página de destino se traslada a otro sitio, la solicitud se cancela.

::: warning Las capturas usan tu sesión del navegador
La página se carga con tu sesión del navegador, así que una página en la que hayas iniciado sesión puede mostrar información privada en el resultado.
:::

La captura se ejecuta en tu navegador, en tu red, así que `localhost` y los sitios internos funcionan. La captura no se sube. El único tráfico de red es el de tu navegador al cargar la página que pediste y, para un SVG, los archivos de fuentes de esa página por segunda vez.

Mientras se ejecuta una captura, puedes ver brevemente un aviso *"…started debugging this browser"* en la pestaña temporal. El aviso procede de DevTools Protocol y desaparece cuando termina la captura.

<a id="reading-a-site-for-design-system-setup"></a>
<!--i:eti-globe-->
## Leer un sitio para Lolly Design System Setup

El origen **Website** de Lolly Design System Setup inicia un design system a partir de un sitio que ya tienes. En un navegador Chromium, la extensión lee la página. En la aplicación de escritorio, la propia aplicación obtiene la página. En un navegador sin extensión, no se ofrece la tarjeta Website.

- **Una dirección, una página.** Tras tu aprobación, la extensión abre la página en el mismo tipo de pestaña en segundo plano, lee el marcado renderizado, el texto de las hojas de estilo y algunas imágenes de iconos y logotipos y después cierra la pestaña. La extensión no sigue enlaces ni rastrea el sitio.
- **Las hojas de estilo alojadas en otro lugar** (una CDN o un servicio de fuentes) también se obtienen, porque contienen los colores y la tipografía de la página. Las solicitudes entre orígenes no incluyen tus cookies. Las solicitudes al mismo origen usan tus cookies, como lo haría la página.
- **Todo tiene límites**, con un máximo de hojas de estilo, imágenes y bytes, así que una página hostil o que funciona a medias devuelve material parcial en lugar de quedarse bloqueada.
- **El análisis se realiza en tu dispositivo.** Los bytes vuelven directamente a la pestaña de Lolly que los solicitó, que los convierte en colores, tipografía y logotipos.

Pegar una dirección solo rellena el campo. No se lee nada hasta que inicies la lectura y pulses **Approve once**.

<!--i:eti-lock-->
## Permisos

El `manifest.json` de la extensión declara cuatro permisos, además del acceso a sitios que solicita de uno en uno. Establece `minimum_chrome_version: 111`, y la versión actual es 0.5.0.

| Permiso | Para qué sirve | Cuándo se concede |
|---|---|---|
| `debugger` | Controla la pestaña en segundo plano mediante DevTools Protocol, que toma la captura y, para un SVG, ejecuta el recorrido de la página. | Al instalar |
| `tabs` | Abre la pestaña temporal en segundo plano y la cierra después, y comprueba que ni la página de Lolly ni la página de destino hayan cambiado de ubicación desde tu aprobación. | Al instalar |
| `scripting` | Ejecuta el lector de una página dentro del sitio que indicaste, para el origen Website. | Al instalar |
| `storage` | Anota el ID de una pestaña que abrió, solo en el almacenamiento de sesión, para que la pestaña se cierre aunque el navegador suspenda la extensión durante la lectura. Se borra en el siguiente inicio; no se almacena nada sobre ti. | Al instalar |
| `optional_host_permissions: ["http://*/*", "https://*/*"]` | Acceso a sitios, que no se concede al instalar. Cuando pulsas **Approve once**, la extensión pide a Chrome acceso al único sitio de esa solicitud. | La primera vez que apruebas una solicitud para ese sitio, después de que Chrome te pregunte |

La extensión solo lee la página que apruebas. No lee ni envía tus datos de navegación.

<!--i:eti-help-->
## Resolución de problemas

- **¿Sigues viendo "Get the extension"?** Recarga la pestaña de Lolly.
- **¿No ocurre nada en este sitio?** La extensión solo funciona en `https://lolly.tools`, además de `http://localhost:5173` en el paquete de desarrollo. Otro origen, como una copia de Lolly alojada por ti, necesita su propia compilación de la extensión que incluya ese origen tanto en `manifest.json` como en `policy.js`. Editar solo el manifiesto no funciona.
- **¿Falla una captura?** Comprueba que se pueda acceder a la URL y que empiece por `http://` o `https://`. Algunas páginas bloquean la captura automatizada. Si pulsaste **Cancel**, cerraste la ventana de aprobación o esperaste más de 30 segundos, inicia la captura de nuevo.
