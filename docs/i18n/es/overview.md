# Resumen

![Icono de Lolly - Piruleta grande verde y blanca](/info/icon.svg)

Este documento recoge el propósito, la estructura y las decisiones arquitectónicas de la plataforma Lolly. Refleja tanto la visión del producto como el estado actual del código.

> **Estado:** Lolly es un prototipo interno en un **piloto cerrado que aún no ha concluido**. El motor es determinista e internamente consistente, pero el producto está en fase temprana - SUSE es el cliente número uno - y sus motores de criptografía y análisis de archivos están actualmente sometidos al estricto endurecimiento de infraestructura de SUSE, preparándose para escala empresarial (se nos da muy bien esto). Lee la arquitectura de abajo como intención de diseño en prueba, no como un producto terminado y certificado. Ver [Adopción y Gobernanza](/info/adoption-governance.html#status) para saber cómo se gestiona y mide el piloto.

> **Cómo leer esta página.** Contiene dos tipos de material, en orden. La primera mitad es
> **por qué existe esto**: el problema, el posicionamiento y el ciclo de vida por el que pasa un solo activo.
> A partir de [El panorama general](#the-big-picture-how-the-layers-fit) en adelante es
> **cómo encajan las capas**: el documento de arquitectura para colaboradores, que cubre la
> separación motor/shell/pack, la disposición del repositorio, los objetivos de entrega y los
> compromisos que limitan cada cambio a la plataforma. Si estás aquí para cambiar el código en lugar
> de entender el producto, empieza por el panorama general.
>
> Dos documentos complementarios profundizan más que esta página. [`engine/README.md`](../engine/README.md) en
> el repositorio es el mapa módulo a módulo del motor, con una tabla generada de cada módulo y
> lo que analiza o escribe. [Modelo de amenazas y límites de confianza](/info/threat-model.html)
> es la misma arquitectura leída como límites de confianza, y es la página adecuada para cualquier pregunta sobre
> qué trata el motor como no confiable.

---

## Por qué existe esto

Los equipos se enfrentan a un problema recurrente: trabajo creativo y de contenido repetible que es demasiado predecible para justificar manos expertas cada vez, pero demasiado sensible a la calidad para delegarlo sin barandillas. El resultado es o bien un rendimiento lento (cuello de botella del especialista), inconsistencia (gente usando la herramienta que tenga a mano) o dependencia de proveedor (un DAM SaaS que controla tus plantillas).

Esta plataforma es la respuesta directa:

> **Contenido y creatividad programática a escala** - generación de activos sin esfuerzo humano, con las reglas bajo control central, para empleados, proveedores y socios.

Lolly no es donde se inventa un sistema de diseño - es donde se produce. Piénsalo como una máquina expendedora de diseño: haces una selección, obtienes un resultado. Cada vez. El engine busca la mayor calidad que cada formato puede producir en el hardware que tienes delante, y el mismo engine genera el mismo archivo en cada superficie a la que se despliega.

El resultado es **abundancia**: cada evento tiene la señalización correcta, cada alerta CVE coincide con el estilo corporativo, cada etiqueta se imprime limpia, cada firma de correo está actualizada - todo sin un ticket de diseño. La plataforma gestiona la creatividad operacionalizada recurrente. Deliberadamente no es una herramienta creativa a medida - los diseñadores siguen siendo dueños del trabajo insignia.

### Innova de forma probabilística, escala de forma determinista

Todo debate sobre la IA en un pipeline creativo se estanca en la misma pregunta: ¿qué parte de esto es trabajo de la máquina? Es una pregunta antigua con una respuesta ya asentada. Los escribas e iluminadores ya trabajaban entre dos instrumentos - el boceto libre, donde nada estaba fijado y todo podía probarse, y la imprenta, intimidante precisamente porque comprometía. Los bocetos eran donde ocurría el arte. La imprenta era el modo en que llegaba a cualquiera. Nadie confundía ambas cosas, y las dos siguieron avanzando - nuevas tintas, nuevos tipos, nuevas prensas - cada una mejorando en armonía con el oficio y la intención a la que servía.

Lolly traza la misma línea. Explora de forma probabilística: un modelo, un diseñador, una idea aproximada, un prompt que va a algún sitio que nadie planeó. Luego escala de forma determinista - lo que llega a diez mil resultados es una *herramienta*, y una herramienta se renderiza igual cada vez a partir de entradas que puedes leer. La exploración permanece libre porque nada aguas abajo depende de que salga igual dos veces. El resultado se gana la confianza porque no es una conjetura. Llevar la experimentación con IA a resultados predecibles y reproducibles no es una disciplina nueva; es la misma división del trabajo que hizo que el trabajo impreso mereciera confianza desde un principio.

> Confía en el proceso creativo, escala con rigor.

### Frente a las alternativas

::: figure positioning-comparison
Integridad de capacidades entre las herramientas creativas actuales, investigado en agosto de 2026. Puntuación: 0 ausente, 25 nivel workaround, 50 real pero limitado o parcial, 75 sólido con salvedades, 100 competencia central.
:::

La brecha es clara: nada de lo que existe hoy ofrece un resultado basado en restricciones, capaz de funcionar sin conexión, de baja exigencia técnica y accesible internamente. Lolly incluso incluye un lienzo abierto - **Design** - donde los colores, la tipografía y los assets se ajustan a los globales de marca, de modo que la composición libre sigue partiendo de restricciones. Lo que **no** es es una suite de diseño sin restricciones: los diseñadores siguen usando Illustrator y Figma para trabajo insignia a medida. Con esta herramienta pueden ensamblarse permutaciones.

![Cada herramienta de la biblioteca como una tarjeta, agrupada por categoría, para que un productor elija una y empiece](/t/url-shot?url=%2F%23%2F&width=1440&height=900&dpi=192&waitMs=1600&css=.welcome-dialog%2C.personalize-nudge%2C.brand-tips%7Bdisplay%3Anone!important%7D&tolerance=0.03&waitSelector=.gallery-view%5Bdata-shots-settled%5D&walker=1&format=svg&dark=1&filename=aud-gallery-landscape)

**Úsala para:** Generación rápida de assets creativos operacionalizados - tarjetas de evento, credenciales de nombre, firmas, alertas CVE, códigos QR, tarjetas sociales, etiquetas de envío, informes estructurados.

**No la uses para:** Contenido insignia a medida.

---

## El ciclo de vida de una campaña

La forma más clara de ver qué es Lolly no es una lista de funciones - es seguir un único asset mientras pasa de mano en mano. Observa cómo una tarjeta de campaña localizada se mueve por la organización:

1. **El creativo fija las reglas.** Un diseñador crea la plantilla base en la herramienta Design, codificando la tipografía y las variables de color de la marca. No está haciendo una tarjeta - está haciendo el trabajo fundacional *una vez* para no tener que volver a localizarlo a mano nunca más.
2. **El desarrollador la escala.** Esa misma plantilla se conecta a un pipeline nocturno mediante la CLI, de modo que un gráfico nuevo o una nueva variante de idioma se genera automáticamente - sin que nadie vuelva a abrir el archivo.
3. **El productor simplemente la usa.** Un representante de ventas, sin conexión en un avión, abre esa misma herramienta y genera una presentación perfectamente alineada con la marca para una reunión con un cliente. Sin conocimientos de diseño, sin red, sin espera.

El «gráfico nuevo» del paso dos es un render como este, producido a partir de una cadena de datos y un puñado de parámetros sin que nadie abra un archivo de diseño:

![Un gráfico de área apilada con título, sus tres series en bandas dentro de una paleta fría, con ejes, leyenda y título colocados todos por la plantilla en lugar de a mano](/t/url-shot?url=%2F%23%2Ftool%2Fchart%3FchartType%3Darea%26stackMode%3Dstacked%26palette%3Dcool%26heading%3DProduct%2520mix%2520by%2520quarter%26full&width=1440&height=900&dpi=192&waitMs=2600&walker=1&format=svg&cropSelector=%23tool-canvas&dark=1&filename=ov2-lifecycle-chart)

No se trata de que Lolly sea buena para diseñadores *y* buena para desarrolladores *y* buena para ventas, cada una en un vacío. Es una **carrera de relevos**: el trabajo inicial del creativo lo escala el desarrollador, lo que a su vez capacita al productor. La experiencia sin esfuerzo para el representante sin conocimientos técnicos en el avión solo es *posible* gracias al rigor que fijó el diseñador y desplegó el desarrollador.

Ese es el multiplicador de fuerza. Lolly no es un cajón de herramientas separadas para roles separados - es un único ciclo de vida de assets determinista que toca cada rol, y cada mano por la que pasa multiplica el valor de la anterior.

---

## Una aprobación, diez mil assets

Como la aprobación vive en la herramienta y no en el archivo (ver [Cómo se compara Lolly](/info/positioning.html)), la escala deja de ser un problema de revisión. Aprueba una herramienta de tarjeta social localizada una vez, luego genera **10.000 assets en 12 idiomas** a partir de una hoja de cálculo - y ninguno de ellos necesita una nueva revisión de cumplimiento por parte de legal o de marca, porque la plantilla de la que provienen todos ya fue aprobada.

La misma herramienta determinista alcanza esa escala de tres formas, todas produciendo un resultado idéntico y preaprobado:

- <!--i:people--> **Una persona, en la app.** La cuadrícula de lotes `/pro`: pega o importa las filas, obtén un asset terminado por fila, descarga el zip. Sin conocimientos de diseño, sin ticket, sin espera.
- <!--i:code--> **Un desarrollador, desde la línea de comandos.** La CLI ejecuta el *mismo* motor y la *misma* ruta de render sin interfaz, de modo que la herramienta puede secuenciarse sobre las 10.000 filas en un script o un pipeline nocturno. Una llamada `lolly <tool> --field=…` en un bucle es toda la integración.
- <!--i:cpu--> **Un sistema o un agente de IA, mediante MCP.** La misma herramienta operada mediante programación, con la misma fidelidad y una escala aún mayor - porque una máquina no se aburre mientras entran miles de archivos.

![El modo Batch en una instalación recién hecha: una fila vacía esperando una herramienta, con toda la superficie tipo hoja de cálculo y su botón Renderizar ya en su sitio antes de que lleguen datos](/t/url-shot?url=%2F%23%2Fbatch&width=1440&height=900&dpi=192&waitMs=3500&walker=1&format=svg&dark=1&filename=ov2-batch-grid)

Un conjunto de restricciones de marca, fijado una sola vez por un diseñador; tres rutas hacia el mismo resultado idéntico y preaprobado - y la ruta de la máquina escala más lejos que ninguna otra, porque nunca se cansa mientras entran los archivos.

---

## El panorama general: cómo encajan las capas

Todo lo que sigue a partir de aquí es arquitectura. El diagrama es el sistema completo en una sola vista: las herramientas son
datos arriba, el motor en el medio no sabe nada de ninguna plataforma, los shells debajo de él
implementan un único contrato, y los catálogos aportan el contenido.

```
                ┌─────────────────────────────────────────────┐
                │              Tools (data, not code)         │
                │   tool.json + template.html + hooks.js?     │
                └─────────────────────────────────────────────┘
                                    ▲
                                    │ talks to via Capability Bridge v1
                                    ▼
                ┌─────────────────────────────────────────────┐
                │                  Engine                     │
                │   loader · validator · runtime · template   │
                │   inputs · url-mode                         │
                │   PLATFORM AGNOSTIC. Knows nothing of DOM,  │
                │   filesystem, or You.                       │
                └─────────────────────────────────────────────┘
                                    ▲
                                    │ implements HostV1
                                    ▼
        ┌──────────────┬──────────────┬──────────────┬──────────────┐
        │  Web Shell   │ Tauri Desktop│ Tauri Mobile │  CLI Shell   │
        │   (PWA)      │              │              │              │
        └──────────────┴──────────────┴──────────────┴──────────────┘
                                    ▲
                                    │ fetches from
                                    ▼
                ┌─────────────────────────────────────────────┐
                │              Catalogs                       │
                │   catalog/tools/index.json + tool dirs      │
                │   catalog/assets/index.json + asset files   │
                └─────────────────────────────────────────────┘
```

### Estructura del repositorio

El contenido se monta como paquetes: `community/`, `docs/`, cada `shells/*`, tanto `services/*` como `brands/suse` son cada uno su propio repositorio, incorporado como submódulo git de este. El padre posee `engine/`, `schemas/`, `scripts/`, `tests/`, `api/`, `brands/lolly-start/` y `profiles.json`. Ver [Guía de compilación » Obtener el código fuente](/info/build-guide.html) para el comando de checkout y el flujo de trabajo entre repositorios.

```
lolly/
├── engine/           # Platform-agnostic core. Open source (MPL-2.0).
│   └── src/
│       ├── index.ts          # public surface - loader, runtime, template, inputs, url-mode
│       ├── loader.ts         # fetches and validates tool files
│       ├── runtime.ts        # orchestrates the 5-step lifecycle
│       ├── template.ts       # Handlebars hydration + annotateTemplate
│       ├── inputs.ts         # manifest → runtime input model
│       ├── url-mode.ts       # URL ↔ input state round-trip
│       ├── validate.ts       # JSON Schema validation of manifests
│       ├── compose.ts        # resolve nested tool renders (composes)
│       ├── embed.ts          # parse portable lolly.tools embed URLs
│       └── bridge/
│           └── host-v1.ts    # type re-export of the @lolly-tools/core contract
│
├── shells/
│   ├── web/          # PWA - hosted online; primary distribution
│   │   └── src/
│   │       ├── main.ts           # boot, routing
│   │       ├── theme.ts          # theme apply/persist (FOUC prevention)
│   │       ├── bridge/           # web implementations of HostV1 APIs
│   │       │   ├── index.ts      # compose all bridge pieces
│   │       │   ├── db.ts         # IndexedDB setup
│   │       │   ├── state.ts      # host.state - saved edits
│   │       │   ├── profile.ts    # host.profile - user details
│   │       │   ├── assets.ts     # host.assets - catalog + user uploads
│   │       │   ├── clipboard.ts  # host.clipboard
│   │       │   ├── export.ts     # host.export - rasterise/serialize
│   │       │   ├── net.ts        # host.net - allowlisted fetch
│   │       │   └── media.ts      # host.media - live camera frames (onFrame)
│   │       ├── catalog/
│   │       │   └── sync.ts       # boot-time catalog sync + offline cache
│   │       ├── styles/           # app-wide CSS (app.css, picker.css, tokens.css)
│   │       └── views/
│   │           ├── gallery.ts    # tool library listing + saved-state cards
│   │           ├── tool.ts       # mounts one tool (inputs + canvas + actions)
│   │           ├── picker.ts     # asset picker UI (invoked by host.assets)
│   │           ├── profile.ts    # user details editor
│   │           ├── projects.ts   # /p - folders of saved sessions (nested; folder/selection export)
│   │           └── free-canvas.ts # free-canvas editor overlay for render.layout:"editor" tools
│   │
│   ├── cli/          # Node.js CLI - same engine, headless jsdom
│   │   ├── bin/lolly.ts
│   │   └── src/
│   │       ├── run.ts    # loadTool → createRuntime → export → write file
│   │       └── bridge.ts # CLI implementation of HostV1
│   │
│   ├── tui/          # Interactive terminal shell (Ink) - reuses the CLI bridge
│   │   └── src/
│   │       ├── main.tsx  # full-screen app: Gallery / Projects / Profile / ToolView
│   │       └── bridge.ts # CLI bridge + on-disk state under ~/.lolly
│   │
│   ├── tauri-desktop/ # downloadable desktop app
│   └── tauri-mobile/  # iOS/Android app
│
├── tools/            # profile VIEW (gitignored) - data, not code. Merged from packs:
│                     #   community/ (public, brand-agnostic, MPL) + brands/<active>/tools (brand-owned).
│                     #   A SELECTION follows - the mounted set depends on the profile.
│   ├── qr-code/
│   ├── quotes/
│   ├── email-signature/
│   ├── snippet/
│   ├── countdown-timer/
│   ├── color-palette/
│   ├── color-block/           # typed/heterogeneous blocks (addMenu discriminator)
│   ├── dynamic-layout/
│   ├── tool-logo/         # "Logo" - auto-switching brand logo
│   ├── street-map/        # offline vector city-block maps
│   ├── url-shot/          # "URL Screenshot" (capture capability)
│   ├── strip-data/        # on-device metadata strip - JPEG/PNG/SVG/PDF (file in → clean file out)
│   ├── compress-pdf/      # on-device PDF compressor - recompresses images (file in → smaller file out)
│   ├── brand-lockup/      # "Brand Lockup" - SUSE logo lockups; HarfBuzz text-to-path (wasm)
│   ├── chart-creator/     # SVG charts from structured data
│   ├── filter/            # photo effects in one tool - halftone/scanline/posterize/voronoi (vector), duotone/pixel-stretch/imperfections (raster)
│   ├── meeting-planner/   # global timezone meeting scheduler
│   ├── calendar-ics/      # event → .ics calendar file plus a card
│   ├── digi-ad/           # "Animated Ad" - looping banner from scenes
│   ├── event-name-badge/  # conference badges - composes qr-code as an SVG
│   ├── wayfinding-signage/ # event signage; directions blocks auto-fit label text
│   ├── text-helper/       # on-device text workbench (format/decode/hash/de-identify)
│   ├── design/     # "Design" - freeform WYSIWYG editor canvas (render.layout: editor)
│   ├── multi-page-pdf/    # multi-page PDF document - cover, flowing content blocks, back page
│   ├── diagram-builder/   # org / layercake / process / cycle / pyramid diagrams
│   ├── logo-wall/         # many logos → auto-packed grid
│   ├── logo-lockup-partner/ # SUSE + partner co-brand lockup
│   ├── icon/          # favicon .ico / png / svg from text + colours
│   ├── lottie-digi-ad/    # animated Lottie ad banners
│   └── pose-geeko/        # pose the SUSE Geeko mascot - print-ready stills
│
├── catalog/
│   ├── tools/index.json        # tool registry
│   └── assets/
│       ├── index.json          # asset registry
│       └── suse/...            # logo, palette, etc.
│
├── schemas/          # JSON Schema for tool.json, asset entries, AssetRef
├── scripts/          # build-catalog-index.ts, checksum-assets.ts, validate-catalog.ts
├── tests/            # engine tests
└── docs/             # this file + authoring guides + positioning
```

---

## Modelo de distribución de la plataforma

La plataforma funciona en varias superficies - PWA web, Tauri de escritorio/móvil, la CLI programable y la TUI interactiva. Todas usan el mismo motor y los mismos archivos de herramienta.

### Web (PWA) - distribución principal
Alojada en una URL controlada por SUSE. Funciona sin conexión una vez que el service worker ha almacenado en caché las herramientas y los assets. Aquí es donde la mayoría de empleados, proveedores y socios usarán la plataforma. No requiere cuenta - el estado se almacena en IndexedDB por dispositivo.

El shell web es responsivo a partir de un único diseño. En escritorio, una herramienta es una barra lateral de controles redimensionable junto a un escenario de vista previa con navegación de lienzo nativa de trackpad (Cmd/Ctrl-rueda o pellizco para hacer zoom sobre el cursor, arrastre con Espacio o botón central para desplazar, teclas `0`/`1`/`+`/`−` y un HUD de Ajustar/%). En móvil (≤640px) los controles se convierten en una hoja anclada arriba con una pestaña de arrastre que encaja en asomo/mitad/completo (tocar alterna) sobre una vista previa estática a pantalla completa, y un botón flotante **Render** abre los controles de **Export** en una ventana emergente inferior. El tacto permite pellizco para zoom y arrastre para desplazar en la vista previa. La ruta de render y los controles de exportación son idénticos en ambos - solo el chrome se reorganiza.

![La vista dividida de escritorio - controles generados a partir del manifiesto a la izquierda, el lienzo en vivo a la derecha](/t/url-shot?url=%2F%23%2Ftool%2Fchart-creator&width=1440&height=900&dpi=192&waitMs=2200&walker=1&format=svg&dark=1&filename=aud-web-split)

La misma herramienta con ancho de teléfono, sin un segundo diseño que mantener: los controles se convierten en una hoja arriba, la vista previa ocupa toda la pantalla y la píldora de render flota sobre ella.

![Un audiograma en una pantalla de 430px de ancho - la hoja de controles arriba, la ilustración cuadrada terminada abajo y la píldora de renderizado flotante](/t/url-shot?url=%2F%23%2Ftool%2Faudiogram%3Faudio%3Dlolly%2Floops%2Ffireplace-loop%26title%3DField%2520notes%26subtitle%3DEpisode%252012%26style%3Dwave&width=430&height=900&dpi=192&waitMs=3200&css=%23ag-wave%7Bdisplay%3Anone!important%7D.ag-ph%7Bdisplay%3Ablock!important%7D&walker=1&format=svg&rasterDpi=110&dark=1&filename=ov2-phone-audiogram)

**Modo lote (`/pro`).** El shell web también incluye una cuadrícula de lote tipo hoja de cálculo (`shells/web/src/pro/`) que renderiza muchas filas a la vez en una o varias herramientas. Ofrece ida y vuelta CSV/TSV más pegado tipo hoja de cálculo, plantilla/formato/tamaño/unidad/dpi por fila, un panel lateral editor de bloques con vista previa en vivo, columnas de exportación colapsables, una barra de etiquetas de «relevancia» por fila, reordenación de filas mediante asa de arrastre a la izquierda, confirmación de borrado en dos pasos, sesiones de lote guardadas y una descarga en `.zip`. Esta es la superficie de uno a muchos detrás del posicionamiento de «generación masiva de contenido».

### Tauri de escritorio / móvil
App nativa empaquetada (huella pequeña gracias a Tauri). Ofrece disponibilidad sin conexión completa, acceso al sistema de archivos para herramientas que dependen de la CLI (PDF Smasher, Font Outliner) y acceso a la cámara. Programado para una mejora de herramientas a mediados de 2026.

### CLI
`lolly <tool-id> [--input=value ...] --output=file.png`

Los usuarios de escritorio pueden invocar muchas herramientas desde la terminal. El shell de la CLI carga el mismo motor, crea un DOM de jsdom, ejecuta la misma ruta de render y escribe el archivo. El modo URL es el transporte - la CLI no es una implementación separada. Esto garantiza que las salidas de la CLI y de la GUI sean idénticas.

```bash
lolly qr-code --url=https://suse.com --output=qr.svg
lolly quotes --quote="Ship it." --output=quote.png
lolly                        # lists available tools
lolly qr-code                # lists inputs for that tool
```

### TUI
`npm run tui`

La contrapartida interactiva de la CLI: una app de terminal a pantalla completa y centrada en el teclado (construida sobre Ink) para explorar herramientas, rellenar entradas, guardar proyectos y exportar - todo sin una GUI. Su bridge de host **reutiliza la implementación de la CLI** para los formatos sin DOM (SVG/EMF/EPS/HTML + texto/datos), y añade estado en disco bajo `~/.lolly` más una vista previa en línea opcional. Más allá de eso tiene un **nivel de render en navegador**: un Chromium headless acotado (el mismo que instala el servidor MCP) que produce ráster/PDF/vídeo y captura de URL en vivo a demanda - impulsando una copia compilada del shell web para que el resultado sea idéntico, y arrancando solo cuando exportas por primera vez un formato así. De modo que `url-shot` (con recorte + recoloreado + PDF/SVG vectorial) y todas las herramientas de ráster/pdf también funcionan en la terminal. Ver la [guía de TUI](/info/tui.html).

Sea cual sea la superficie en la que estés, la pestaña Capabilities del panel es el mapa completo de lo que la plataforma declara que puede hacer, agrupado y legible sin abrir ni una sola herramienta.

---

## Categorías de herramientas

Las herramientas están etiquetadas con una `category` en su manifiesto para agruparlas en la galería.

Las filas se listan en el orden de sección de la galería. La sección `utility` siempre se muestra **al final** en la galería (después de cualquier otra categoría, incluidas las futuras) - es el cajón «Utilidades sin conexión» en el dispositivo.

| Categoría | Ejemplos | Previsto |
|---|---|---|
| `everyone` | QR Code Generator, Quote Card, Email Signature, Logo, Wordmark, Audiogram, Battlecards, Sequence Studio, Record | Employee Image Stationery |
| `designer` | Brand Lockup, Design, Chart, Darkroom, Filter, Pose Geeko, Multi-Page PDF | Font Outliner |
| `event` | Meeting Planner, Event Name Badge, Wayfinding Signage, Calendar ICS, Booth Studio | Event Stationery, Bulk Name Badges, Room Agenda Cards |
| `product` | - | CVE Alert, Product Release Announcement, Blog OG Image |
| `utility` | Strip Hidden Data, Text Helper, Compress PDF, Convert Image, Convert Font, Redact, Run Web Code, Screen Capture, URL Screenshot | Unit/format converters, more on-device privacy utilities |

Esas celdas son **ejemplos, no inventarios**. Qué herramientas existen es una propiedad del perfil que hayas montado, no de esta página: un paquete de marca añade las suyas propias, y puede excluir una herramienta comunitaria que prefiera no distribuir. `catalog/tools/index.json` - generado a partir de los manifiestos, y el registro que la galería realmente lee - es la lista autorizada; para contar lo que monta un perfil, cuenta los manifiestos (`ls community/*/tool.json brands/*/tools/*/tool.json`) en lugar de confiar en un número escrito aquí. (Un id de herramienta presente en dos paquetes se monta una sola vez, desde el paquete ganador.)

Las herramientas también se clasifican por estado: `official` (aprobada por la marca, sin marca de agua), `community` (contribución externa), `experimental` (exportaciones con marca de agua). La mayor parte de la biblioteca es `official`; los estudios más nuevos y las herramientas de captura tienden a estar en `community` o `experimental` mientras se estabilizan. Cada superficie muestra la insignia, así que quien lee sabe qué está tomando antes de abrirlo - y, como las celdas de categoría de arriba, la pertenencia por estado cambia demasiado rápido para enumerarla aquí. Consúltala en la galería o en el índice generado.

**Design** es la primera herramienta construida sobre el modo de lienzo libre `render.layout: "editor"` - una superficie sin cromado, de manipulación directa, donde arrastras, redimensionas, rotas y ajustas cajas de texto, formas e imágenes, y luego exportas por la misma ruta de renderizado que cualquier otra herramienta.

**Strip Hidden Data** es la primera **utilidad en el dispositivo** (`privacy: "on-device"`): una herramienta de transformación de contenido que toma un archivo que *tú* aportas, lo procesa por completo en el navegador y devuelve una copia limpia - nunca se sube, nunca lleva marca de agua, no se estampa procedencia. **Text Helper** es la segunda - un banco de trabajo en el dispositivo para las tareas cotidianas de pegar-en-un-sitio-web (formato JSON, decodificación JWT, Base64, codificación/decodificación de URL, hash SHA). **Compress PDF** es la tercera - reduce un PDF recomprimiendo sus imágenes, también por completo en el dispositivo. El marcador y el texto de su insignia «Se ejecuta en tu dispositivo - nada se sube» cubren ahora todo el conjunto de transformación: Strip Hidden Data, Text Helper, Compress PDF, **Convert Image** (HEIC/TIFF/AVIF → WebP/JPG/PNG), **Convert Font**, **Redact** (destruir regiones de una imagen, SVG o PDF), **Prompt to Image** y **Rebrand a Deck** (recambiar el tema de un `.pptx` in situ) donde el perfil la monte. Es una categoría de utilidades de privacidad que reemplaza el entregar archivos confidenciales a sitios web de un solo propósito.

![El cajón de Utilidades, donde cada tarjeta es una herramienta que transforma un archivo que ya tienes](/t/url-shot?url=%2F%23%2Fu&width=1440&height=900&dpi=192&waitMs=1600&css=.welcome-dialog%2C.personalize-nudge%2C.brand-tips%7Bdisplay%3Anone!important%7D&tolerance=0.03&format=svg&walker=1&dark=1&filename=aud-utilities)

> Nota: `category` y `status` se desnormalizan en `catalog/tools/index.json` (el registro que lee la galería) a partir de cada `tool.json`. El manifiesto es la fuente de verdad - el índice se **genera** con `npm run build:catalog` y `npm run validate:catalog` falla en CI si el índice registrado se desvía de los manifiestos.

---

## Compromisos arquitectónicos

Estas decisiones están cerradas. Cambiar cualquiera de ellas es una empresa mayor - dan forma a cada otra decisión en el código base.

### 1. Herramientas declarativas, con una vía de escape imperativa

Una herramienta es un manifiesto (`tool.json`) + una plantilla (`template.html`) + `hooks.js` opcional.

**El manifiesto declara las entradas.** No la plantilla. Las entradas no se infieren de los tokens de Handlebars. El manifiesto es el contrato; la plantilla consume variables con nombre mediante `{{id}}`.

![La pila de controles de Street Map - un desplegable de ciudad, un selector de tema, deslizadores de grosor y disparadores de color, cada uno extraído de una línea del manifiesto](/t/url-shot?url=%2F%23%2Ftool%2Fstreet-map%3Fcity%3Damsterdam&width=1440&height=900&dpi=192&waitMs=2400&walker=1&format=svg&css=%23tool-canvas%7Bdisplay%3Anone%7D&cropSelector=%23tool-inputs&dark=1&filename=ov2-street-map-controls)

**Los hooks son opcionales.** La mayoría de las herramientas son puramente declarativas - manifiesto + plantilla basta. Las herramientas que necesitan valores calculados (codificación QR, formateo de datos de gráficos) proporcionan `hooks.js`, que expone funciones de ciclo de vida con nombre (`onInit`, `onInput`, `onFrame` - el hook por fotograma de cámara en vivo para herramientas reactivas al movimiento -, `onLevel`, `beforeExport`, `afterExport`, `exportFile` - la ruta de transformación archivo-a-archivo que usan las utilidades en el dispositivo como Strip Hidden Data - y `exportStill`, para una herramienta que gestiona su propio ráster en profundidad). El host carga los hooks mediante `new Function('host', …)` con el puente de capacidades inyectado como ámbito de clausura. Esto es un **contrato de portabilidad, no un sandbox de seguridad**: los hooks siguen ejecutándose en el ámbito de la página y *pueden* acceder a `window`/`fetch`/`document` en un shell de navegador - `host.*` es la superficie compatible y portátil, no un límite impuesto. Los resultados de hooks asíncronos tienen un plazo (`onInit` 5s, `onInput` 2s, `beforeExport`/`afterExport` 5s, `exportFile`/`exportStill` 10s) y los resultados tardíos se descartan; un hook *síncrono* descontrolado no se puede interrumpir. Por eso, el código de hooks de terceros no confiable no es seguro de ejecutar hasta que llegue el aislamiento en Worker.

Esto importa porque: las herramientas declarativas las pueden crear personas sin perfil de desarrollo. Si cada herramienta fuera una aplicación web, la nota de riesgo «capacidad limitada para crear/mantener plantillas de trabajo» se convierte en un cuello de botella permanente.

### 2. Las herramientas y los activos son datos, no código empaquetado

Las apps web y Tauri obtienen los catálogos de herramientas y activos desde una URL conocida al arrancar, los guardan en caché local y operan sobre lo que haya ahí. **Añadir una nueva tarjeta de evento o un activo de temporada no requiere una nueva versión de la app.**

Los bytes de los activos llevan suma de comprobación SHA-256 para evitar el envenenamiento de la CDN. El `id` + `version` del activo controla la invalidación de la caché.

### 3. El puente de capacidades es la única API que ven las herramientas

Las herramientas nunca tocan el DOM fuera del área de su plantilla, nunca llaman a `fetch` directamente, nunca leen el sistema de archivos. Llaman a métodos versionados `host.*`. La definición canónica del contrato es `packages/core/src/host-v1.ts` - el SDK para autores de herramientas `@lolly-tools/core`, para que un tercero pueda construir contra él sin depender del motor; `engine/src/bridge/host-v1.ts` es una reexportación de tipos de este, y el código del motor/shell sigue importando desde esa ruta sin cambios:

| API del puente | Qué hace |
|---|---|
| `host.profile` | Nombre de pila del usuario, correo, foto, ciudad, etc. Prellena entradas mediante `bindToProfile`. |
| `host.assets` | Consultas al catálogo, resolución de activos, interfaz de selector proporcionada por el host. |
| `host.state` | Guardar / cargar espacios de entrada. IndexedDB en web, sistema de archivos en Tauri, memoria en CLI. |
| `host.clipboard` | Escribe texto o imagen en el portapapeles (con alternativas por plataforma). |
| `host.export` | Rasteriza o serializa el destino de renderizado. Aplica marca de agua para herramientas experimentales. |
| `host.net` | Fetch en lista blanca - solo disponible si la herramienta declaró la capacidad `"network"`. (Ninguna herramienta distribuida la usa actualmente.) |

Las superficies opcionales y aditivas aparecen solo cuando un shell las proporciona. Algunas están **restringidas por capacidad** - expuestas solo cuando la herramienta declara la bandera correspondiente: `host.compose` (incrustar el renderizado de otra herramienta - `compose`), `host.capture` (captura de página para URL Screenshot - `capture`) y `host.recorder` (captura de micrófono/cámara/pantalla para las herramientas de grabación - `microphone` / `camera` / `screen`). El resto se **detecta por función** - presente siempre que el shell pueda proporcionarla, y la herramienta mantiene un respaldo para los shells que no puedan.

Un puñado de superficies destacadas, para mostrar lo que cubre - [Host API](/info/host-api.html) documenta cada una, y `packages/core/src/host-v1.ts` es el contrato en sí:

| Superficie | Desde | Qué añade |
|---|---|---|
| `host.tokens` | 1.0 | Tokens de diseño DTCG - las primitivas propias de la marca |
| `host.text` | 1.0 | Texto a trazado vía HarfBuzz WASM (el indicador de capacidad `wasm` marca las herramientas que dependen de él) |
| `host.media` | 1.4 | Fotogramas de cámara en directo que impulsan el hook `onFrame`. Mejora progresiva, deliberadamente *no* condicionada por el indicador `camera` - esa herramienta sigue funcionando como una herramienta de imagen fija normal |
| `host.color` | 1.40 | Matemáticas de color perceptuales: ΔEOK, contraste WCAG y APCA, degradados OKLab, cortes de clase, paletas categóricas, esquemas de armonía (1.60), mezcla CSS Color 4 y horneado de degradados (1.68). Puro y síncrono - los shells conectan el `makeColorApi()` del motor en lugar de implementar nada, así que no puede desviarse |
| `host.images` | 1.60 | Decodificar / redimensionar / recodificar bytes en el dispositivo - la ruta de conversión (HEIC → JPEG, comprimir a WebP, reducir escala). Distribuido en el shell web como una fachada perezosa, así que el decodificador HEIC nunca entra en el fragmento de arranque |
| `host.geom` | 1.64 | Geometría vectorial exacta: booleanos de trazados, desplazamiento, contorno a relleno, reducción de splines, simplificación, detección de colisiones. También puro, síncrono y conectado desde el motor (`makeGeomApi()`); los fallos se *devuelven*, nunca se lanzan |

El resto sigue las mismas reglas y está documentado junto a ellas: `pdf` (1.8) y `pptx` (1.58) para cirugía de documentos en el dispositivo, `audio` (1.71) y `speech` (1.96) para análisis de clips y TTS/transcripción en el dispositivo, `viz` (1.72) para el contrato de sustituto de MilkDrop, `codec` (1.100) y `layers` (1.102) para salida en profundidad de bits y de mapa de bits por capas, `upscale` (1.101) y `matte` (1.103) para los modelos en el dispositivo, `raster` (1.105) para hooks que hacen su propio trabajo de píxeles, `connectors` (1.106) para flechas seguras para exportación y `c2pa` (1.85) para firmar bytes finalizados. La lista crece; las reglas no.

Las capacidades declarables son: `network`, `filesystem`, `clipboard`, `camera`, `microphone`, `screen`, `ffmpeg`, `wasm`, `capture`, `compose`. (`screen`, añadida en 1.54, es captura de pantalla vía `host.recorder` - el usuario elige una pantalla/ventana/pestaña en la interfaz nativa del navegador; distinta de `capture`, que rasteriza una URL que la propia herramienta indica.)

La misma herramienta se ejecuta en navegador, Tauri y CLI sin interfaz porque cada shell implementa esta interfaz - la herramienta nunca sabe en cuál está.

El puente está versionado. Añadir métodos es una versión menor. Eliminar o cambiar firmas es un salto de versión mayor. Cuando salga v2, v1 debe seguir funcionando.

### 4. Los ID de activo son para siempre

`suse/logo/primary` es un contrato. Una vez publicado:
- El ID nunca cambia, nunca se reutiliza.
- Cambios de bytes → sube `version` en el manifiesto.
- Reemplazado por un activo nuevo → establece `deprecated: true` y opcionalmente `replacedBy`.
- Las referencias existentes siempre se resuelven.

Esto hace que los estados de herramienta guardados y los enlaces compartidos por URL sean duraderos a través de los años.

### 5. El modo URL es de primera clase

Cada entrada debe poder expresarse como un parámetro de URL:

```
lolly.tools/#/tool/qr-code?url=https://suse.com&ecl=H
```

![Ese enlace por sí solo, sin nada más en él, es el activo terminado](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Fsuse.com%26ecl%3DH%26full&width=760&height=760&dpi=192&waitMs=2000&walker=1&format=svg&dark=1&filename=aud-url-mode-qr)

El modo CLI es el modo URL bajo un transporte distinto - el shell de CLI construye un objeto de estado de URL a partir de argv y ejecuta la **misma** cadena del motor. Hay una sola ruta de renderizado. La CLI no puede desviarse de la GUI porque no es una implementación aparte.

`url-mode.ts` gestiona el ciclo completo (parsear y serializar). Un conjunto de **parámetros reservados** nunca se reenvía a la herramienta como entradas: los controles de salida (`format`, `export`, `copy`, `filename`, `width`/`w`, `height`/`h`, `unit`, `dpi`), los mandos de impresión y procedencia (`bleed`, `marks`, `profile`, `password`, `c2pa`, `imprint`, `durable`, `meta`, `hdr`, `depth`, `cuts`) y los portadores de estado (`template`, `z` - el token empaquetado de «Enlace más corto» - y `zx`, el mismo cifrado con contraseña). El conjunto `RESERVED` en `engine/src/url-mode.ts` es la autoridad y está fijado por una prueba; [URL Mode](/info/url-mode.html) documenta cada uno de ellos, incluidos los pocos que no se listan aquí. Las entradas de activo en modo URL se serializan por su `id`; el runtime las resuelve mediante `host.assets.get()` antes de la hidratación. `width`/`height` son valores en `unit` (por defecto `px`, también `mm`/`cm`/`in`/`pt`/`pc`); con una unidad física, `dpi` fija la resolución de ráster. Establecen el tamaño del documento del lienzo y prellenan el panel de dimensiones de exportación.

Porque cada entrada viaja en el enlace, un cambio de parámetro es un activo terminado distinto. Toda esta paleta es un color semilla, una armonía y un número de pasos:

![Nueve pasos en cuatro matices, todos generados a partir del único color semilla que lleva el enlace](/t/url-shot?url=%2F%23%2Ftool%2Fcolor-palette%3Fseed%3De0521a%26harmony%3Dtetrad-4%26steps%3D9%26full&width=1440&height=900&dpi=192&waitMs=2000&walker=1&format=svg&cropSelector=%23tool-canvas&dark=1&filename=ov2-url-palette)

### 6. El almacenamiento pasa por el bridge, no directamente

Web shell: IndexedDB. Tauri: sistema de archivos. CLI: en memoria. Las herramientas solo ven `host.state.save(slot, data)` y `host.state.load(slot)`. `localStorage` no se usa: es demasiado pequeño y no puede contener blobs.

Los usuarios pueden guardar varias ranuras de edición con nombre por herramienta y retomar cada sesión más tarde. No hace falta crear una cuenta; el estado es por dispositivo. Como el bridge es el único punto de paso, ese estado por dispositivo también es *portable*: `shells/web/src/data-transfer.ts` lee todo de vuelta a través de `host.profile`/`host.state`/`host.assets` en un único zip `lolly-backup` que se importa en cualquier otra instalación - la respuesta sin conexión a "pasar a un dispositivo nuevo" que no necesita servidor (especificación completa: `docs/data-transfer.md`). La integración con SUSE ID (sincronización entre varios dispositivos) es un hito futuro sobre esta base.

### 7. Las etiquetas de madurez responden por diseño al riesgo de "aprobado por la marca"

Cada herramienta declara `status: official | community | experimental` en su manifiesto. La galería ordena por estado. Las herramientas experimentales marcan sus exportaciones con marca de agua automáticamente - la marca de agua la aplica `host.export.render`, no la herramienta, así que un autor de herramientas no oficial no puede desactivarla.

Esta es una respuesta estructural al riesgo de percepción de que usar cualquier herramienta implica aprobación de la marca. Las respuestas de proceso (una cola de revisión, control de acceso por SUSE ID) se suman encima.

### 8. Las entradas de las herramientas están tipadas mediante el manifiesto, incluidos los assets

Las entradas declaran un `type`: `text`, `longtext`, `number`, `boolean`, `color`, `select`, `asset`, `date`, `time`, `datetime-local`, `url`, `blocks`, `vector`, `table` y `file`. El host renderiza un control genérico por tipo a partir del manifiesto - las herramientas no escriben código de control. (El prellenado desde el perfil del usuario no es un tipo; cualquier entrada puede llevar `bindToProfile`.) Tres pesan más que el resto:

- **`asset`** (con `filter` y `allowUpload`) es el puente al sistema de assets global; `allowUpload: false` es la palanca de exigencia de marca para casos como los logotipos de las tiles de patrocinio, donde solo se permiten assets de la biblioteca. Las cargas del usuario usan la misma forma `AssetRef` que los assets de biblioteca, así que las herramientas las tratan de forma idéntica.
- **`blocks`** es un grupo de campos repetible - una mini-tabla dentro de una entrada, editada en un panel lateral, con un menú de añadir tipado/discriminado y campos de asset por bloque. Al hacer clic en un bloque renderizado en el lienzo se pone el foco en la fila de ese bloque. Lo usan `meeting-planner`, `chart-creator`, `event-name-badge`, `wayfinding-signage`, `color-block` y `digi-ad`.
- **`vector`** agrupa un conjunto fijo de números (p. ej. una transformación) en un control compuesto; **`file`** contiene el propio archivo del usuario como bytes en memoria para utilidades de transformación en el dispositivo (p. ej. `strip-data` y `compress-pdf`).

### 9. Las plantillas no tienen lógica (Handlebars, no EJS)

Handlebars se eligió sobre EJS deliberadamente:
- Sin lógica. Las plantillas las pueden crear personas que no son desarrolladoras.
- Seguro por defecto. `{{x}}` escapa HTML; `{{{x}}}` es texto sin procesar, opcional.
- No tener JS arbitrario en las plantillas significa que no hay superficie de auditoría XSS por plantilla.

La lógica vive en `hooks.js`, donde es explícita y revisable. Helpers de Handlebars disponibles: `{{default}}`, `{{upper}}`, `{{lower}}`, `{{eq}}`, `{{markdown}}`, `{{asset ref}}`, `{{asset ref "property"}}` (además de los helpers de formato de datos `icsStamp`/`rfcText`/`csvCell` usados por las plantillas hermanas `.ics`/`.vcf`/`.csv`).

### 10. Las herramientas componen herramientas

Una herramienta puede incrustar el render de **otra** herramienta sin importaciones entre herramientas - la composición la resuelve el motor, nunca el código de la herramienta. Hay dos superficies:

- **Manifiesto declarativo** - `composes: [{ id, tool, inputs, format?, width?, height? }]`. El motor renderiza la hija indicada y coloca el resultado en la plantilla sin lógica como `{{asset <id>}}`. `event-name-badge` compone `qr-code` como SVG hoy.
- **URL de incrustación portable** - `<img src="https://lolly.tools/tool/<id>.<ext>?<inputs>">`. El shell renderiza esa hija **localmente** (se muestra un píxel de marcador de posición hasta que se resuelve el render local); nunca se obtiene nada de `lolly.tools`.

Compón el render de cualquier herramienta: una hija **SVG** sigue siendo un vector real cuando el padre exporta a SVG o PDF y se rasteriza con nitidez para PNG; las hijas **PNG/JPG/WEBP** se incrustan como imágenes. Requiere la capacidad `compose`. Las hijas compuestas son intermedias - nunca llevan marca de agua ni sello de procedencia - y la composición se degrada con elegancia: un shell que no puede renderizar una hija simplemente omite ese hueco y el padre igualmente se renderiza.

---

## Lo que decidimos explícitamente no hacer

- **Sin EJS / sin JS arbitrario en las plantillas.** La superficie de XSS es cero. La lógica vive en `hooks.js`.
- **Sin CMS de recursos obligatorio.** Cada persona ingiere sus propios archivos creativos directamente en su catálogo dentro de la app (la vista [Catálogo](/info/using.html) y el Brand Studio) - sin servidor, sin consola de administración. El trabajo se transmite como una **sesión**: un enlace para compartir lleva todo el estado, y la misma sesión viaja en una copia de seguridad o a través de una sesión de colaboración. Quien controle el despliegue puede entonces fijar una sesión compartida como **plantilla** - abrir el enlace, registrar sus valores como una entrada de plantilla en el directorio de esa herramienta dentro del brand pack y hacer commit - tras lo cual aparece en el selector «New from template» de la herramienta y se puede enlazar directamente como `?template=<id>`. Git es el paso de fijación del propietario del despliegue, nunca el del creador. Para un catálogo *compartido y gobernado*, una organización **puede** gestionar el directorio de recursos de la misma forma y condicionar las actualizaciones a una revisión de PR - un modelo de gobernanza disponible, no un requisito de la app.
- **Sin RBAC forzado.** La app abierta es de acceso público por defecto; el riesgo de marca se gestiona con etiquetas de madurez y marcas de agua. Una organización que quiera un control más estricto añade su propia capa de autenticación y el catálogo revisado por Git de arriba.
- **Sin base de datos central.** Todo el estado de usuario es por dispositivo. La integración con SUSE ID está en la hoja de ruta, pero no es un bloqueante para el lanzamiento.
- **Sin ruta de código compartida entre herramientas y engine.** El engine es de código abierto, y también lo son las herramientas independientes de marca en `community/`; un brand pack como el privado `brands/suse/` lleva sus propias herramientas y catálogo bajo sus propios términos. En cualquier caso, la separación se hace cumplir (sin importaciones cruzadas de `engine/` hacia el contenido de las herramientas) para que la división se mantenga limpia.

---

## Ciclo de vida, de principio a fin

Un usuario abre `lolly.tools/#/tool/qr-code?url=https://suse.com&ecl=H`:

1. **Arranque.** El web shell abre IndexedDB, construye el bridge de capacidades, sincroniza los catálogos de herramientas y assets (o carga desde la caché sin conexión).
2. **Ruta.** El hash de la URL → la vista `tool`, con `qr-code` y los parámetros de URL extraídos.
3. **Carga.** `loadTool('qr-code', fetchFile)` obtiene `tool.json`, lo valida contra el JSON Schema, y obtiene el origen de `template.html`, `styles.css` y `hooks.js`.
4. **Análisis del estado de la URL.** `parseUrlState` traduce los parámetros de URL a valores de entrada iniciales. Las referencias a assets (`?logo=suse/logo/primary`) se analizan como objetos ligeros `{ id, _unresolved: true }`.
5. **Runtime.** `createRuntime(tool, host, initialValues)` construye el modelo de entrada (combinando datos del perfil, valores por defecto y valores iniciales), resuelve las referencias a assets mediante `host.assets.get()`, carga los hooks (`host` con ámbito de clausura, no aislado) y llama a `hooks.onInit`.
6. **Renderizado.** El shell se suscribe al runtime; en cada cambio de estado recibe `{ model, hydrated }`. Renderiza los controles de entrada a partir del modelo y escribe el HTML de la plantilla hidratada en `#tool-canvas`.
7. **Interacción.** El usuario escribe en una entrada → `runtime.setInput(id, value)` → se aplican las restricciones → se llama a `hooks.onInput` → se rehidrata → se vuelve a renderizar. El lienzo se actualiza en vivo.
8. **Exportación.** El usuario hace clic en Descargar (PNG) → `runtime.export(canvasNode, 'png')` → `host.export.render` (rasteriza mediante dom-to-image-more; SVG/PDF pasan por vectorizadores dedicados que recorren el DOM) → blob → `host.export.download`. El abanico de formatos al que puede optar una herramienta es amplio, y el enum `render.formats` en `schemas/tool.schema.json` es la autoridad al respecto - rasters y rasters de coma flotante, vectores y archivos de corte, impresión/CMYK, movimiento, documentos editables (`pptx`, `docx`, `odt`), salidas de paleta y de datos/texto, archivos de audio y de fuentes. [URL Mode](/info/url-mode.html) nombra cada id y lo que produce. El audio está en ese enum como cualquier otra cosa (`wav`, `mp3`, `m4a`, `opus`, declarados por el audiograma y las herramientas de grabación); por separado, el modo `render.capture` de una herramienta de grabación activa `host.recorder`, cuya toma llega como un Blob terminado en el contenedor que el navegador haya grabado. (Las herramientas que fijan `render.export: false` - p. ej. Color Palette, Countdown Timer, Strip Hidden Data, Text Helper, Compress PDF - ocultan los controles de descarga/formato/dimensiones.) Las unidades físicas se convierten por formato aquí (PDF → puntos de página reales, raster → píxeles a la DPI con un chunk `pHYs`). Los metadatos de autoría/procedencia (autor, herramienta, fuente - construidos por `engine/src/metadata.ts`) se incrustan por formato: PNG iTXt, JPEG EXIF, diccionario de información de PDF, `<metadata>` de SVG, comentario de GIF. Las herramientas experimentales reciben una marca de agua insertada por el host, no por la herramienta.

![El panel de exportación que abre `?options`: el par nombre de archivo y formato, el tamaño de salida y los controles que escriben el archivo](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26options&width=1440&height=900&dpi=192&waitMs=2200&cropSelector=.export-popup&walker=1&format=svg&dark=1&filename=aud-export-popup)

Mismo ciclo de vida en Tauri. Mismo ciclo de vida en CLI - jsdom proporciona el DOM sin interfaz gráfica; la salida va a un archivo o a stdout.

---

## Estado de código abierto

**El código es MPL-2.0.** `engine/`, `shells/*`, `services/*`, `schemas/` y `docs/` son de código abierto bajo **MPL-2.0** - una plataforma de scaffolding neutral respecto al proveedor para herramientas de marca, con cada unidad distribuible en su propio repositorio bajo [github.com/lolly-tools](https://github.com/lolly-tools).

**El contenido de las herramientas se distribuye como brand packs**, cada uno con sus propios términos (consulta el `NOTICE.md` del pack). `community/` es el repositorio público [`lolly-tools`](https://github.com/lolly-tools/lolly-tools) y sus herramientas independientes de marca también son MPL-2.0. `brands/suse/` es el pack privado `suse-lolly`: las herramientas de SUSE y el catálogo de SUSE, **propiedad exclusiva de SUSE**, incluida su música con licencia de PremiumBeat. `brands/lolly-start/` es la marca inicial en blanco que posee este repositorio. Las fuentes se distribuyen dentro de un pack bajo la **SIL Open Font License 1.1** - el pack de SUSE lleva las tipografías SUSE y SUSE Mono.

Los directorios `tools/` y `catalog/` en la raíz del repo son *vistas* ignoradas por git: un perfil los ensambla a partir de `community/` más el brand pack activo, por lo que cada script y shell lee esas dos rutas y nunca un pack directamente.

La separación se hace cumplir - no hay importaciones cruzadas de `engine/` hacia el contenido de las herramientas - así que el límite entre plataforma y contenido se mantiene limpio.

---

## Dónde termina el motor y dónde empieza el host

Si puedes describirlo en datos puros + Handlebars → **motor**.
Si toca el DOM, el sistema de archivos, la red o cualquier API del navegador/SO → **host**.

La línea es nítida a propósito. El motor es la parte de código abierto. Todo lo que sabe sobre SUSE, plataformas concretas o entornos de ejecución queda fuera de él.

Para el siguiente nivel de detalle, [`engine/README.md`](../engine/README.md) enumera cada módulo del motor y de qué se encarga, y [Threat Model & Trust Boundaries](/info/threat-model.html) recoge dónde esa misma línea funciona también como límite de confianza.
