# Lolly para Desarrolladores

La documentación técnica - para quien crea herramientas, integra Lolly en un pipeline, la autoaloja o extiende la plataforma.

**Qué ganas tú con esto.** Crea una herramienta una vez y la petición deja de volver a ti. Ese típico «¿me puedes hacer un…?» que te come las tardes se convierte en una plantilla que otras personas rellenan por su cuenta - correctamente, sin que tengas que mediar. Tu trabajo es HTML/CSS/JS puro: versionado, diferenciable, revisable, y corre sobre un motor abierto sin ataduras a un proveedor, así que sigue siendo tuyo. Automatiza la tirada de producción y tu tiempo se dedica al problema interesante, no a la exportación número diez mil.

Lolly es un **motor** agnóstico de plataforma que ejecuta la misma ruta de renderizado en varios **shells** (PWA web, Tauri de escritorio/móvil, CLI, TUI). Las herramientas son **datos, no código empaquetado** - un manifiesto más una plantilla más hooks opcionales - así que las herramientas nuevas se publican sin necesidad de actualizar la app. Empieza por [Visión general](/info/overview.html) para la arquitectura, y luego sigue el recorrido que encaje con lo que estás construyendo.

¿Nuevo en la plataforma? El **[Inicio rápido](/info/quickstart.html)** prepara una marca y tu primer render antes de que profundices.

## Comprende la arquitectura



- **[Visión general](/info/overview.html)** - por qué existe Lolly, la separación entre motor, shell y herramientas, el puente de capacidades, y los compromisos arquitectónicos ya asentados.
- **[Tokens de Diseño](/info/design-tokens.html)** - el modelo de tokens DTCG en el que se expresan las marcas, y cómo los consumen las herramientas.

## Crea herramientas

Cada control que ves aquí abajo se generó a partir de una entrada declarada en `tool.json`. Tú escribes la línea del manifiesto, el host dibuja el widget, y ese mismo modelo alimenta la CLI y la URL.

![One declared input, one generated control: a url, a colour, a select, a number, a boolean](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code&width=1440&height=900&dpi=192&waitMs=2000&cropSelector=.tool-inputs&walker=1&format=svg&dark=1&filename=aud-manifest-controls)

Y eso escala mucho más allá de cinco controles. Dale a una entrada un `section` y el host la pliega, así que una herramienta de cincuenta entradas como D3 Chart Studio se sigue abriendo como una pila corta, con el resto archivado en grupos con nombre.

![The D3 sidebar - a handful of primary controls, then Data, Columns, Chart, Axes and the other sections collapsed into one line each](/t/url-shot?url=%2F%23%2Ftool%2Fchart&width=1440&height=1600&dpi=192&waitMs=2400&walker=1&format=svg&css=%23tool-canvas%7Bdisplay%3Anone%7D&cropSelector=%23tool-inputs&dark=1&filename=ov2-d3-sections)

- **[Creación de Herramientas](/info/authoring-tools.html)** - la guía completa: manifiesto, plantilla, estilos, hooks, composición y publicación.
- **[Creación de Assets](/info/authoring-assets.html)** - assets del catálogo, niveles, locales, paletas, iconos personalizables y fuentes.
- **[API de Host](/info/host-api.html)** - el puente de capacidades `HostV1` contra el que está escrita cada herramienta (la única API que ven las herramientas).
- **[Modo URL](/info/url-mode.html)** - cada entrada como parámetro de URL; parámetros reservados, codificación compacta, enlaces empaquetados.

## Ejecuta e integra

- **[CLI](/info/cli.html)** - renderizado headless; la misma ruta de renderizado que la GUI, controlada mediante argv `--foo=bar`.
- **[TUI](/info/tui.html)** - el shell interactivo de terminal.
- **[Servidor MCP](/info/mcp.html)** - el endpoint nativo que permite que un agente de IA descubra y ejecute herramientas.
- **[Agentes de IA](/info/ai-agents.html)** - cómo controlar Lolly desde un modelo: una URL es la API.
- **[Extensión de Chrome](/info/extension.html)** - captura una URL en vivo como asset reutilizable.

## Publícalo y opéralo

- **[Guía de Compilación](/info/build-guide.html)** - compila cada objetivo: CLI, TUI, escritorio, móvil.
- **[Despliegue](/info/deployment.html)** - la app web, las apps, y los servicios backend; dónde corre cada pieza.
- **[Configuración](/info/configuration.html)** - perfiles, paquetes de marca, control de capacidades, feature flags, y validación del catálogo.

## Confianza y datos

Los derechos y la autoría son entradas como cualquier otra. Embed & Track Image declara campos de autor, copyright, licencia y contacto, y la exportación los escribe en los metadatos del propio archivo y en su manifiesto C2PA.

![The Embed and Track Image controls - creator, copyright, a licence dropdown, contact and title, filled from the link](/t/url-shot?url=%2F%23%2Ftool%2Fclaim%3Fcreator%3DAda%2520Lovelace%26title%3DEngine%2520Notes&width=1440&height=1200&dpi=192&waitMs=2200&walker=1&format=svg&css=%23tool-canvas%7Bdisplay%3Anone%7D&cropSelector=%23tool-inputs&dark=1&filename=ov2-rights-fields)

- **[Identidad de Content Credentials](/info/content-credentials-identity.html)** - firma emitida por una CA para C2PA en el dispositivo; contratos del motor y el runbook del operador.
- **[Transferencia de Datos](/info/data-transfer.html)** - el paquete `lolly-backup`: envelope, integridad, y garantías entre shells.
- **[Acerca de](/info/about.html)** - el proyecto, el límite de su licencia, y el repositorio.
