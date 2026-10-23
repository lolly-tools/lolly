# Arquitectura de Lolly

![Icono de Lolly - Piruleta grande verde y blanca](/info/icon.svg)

Esta página es para quienes cambian el código de Lolly: cómo encajan el motor, los shells y los paquetes de herramientas, dónde vive cada uno en el repositorio y los compromisos que limitan cada cambio. Si quieres saber qué hace Lolly y quién lo usa, lee antes [How Lolly works](/info/how-lolly-works.html).

Dos páginas complementarias profundizan más. [`engine/README.md`](../engine/README.md) es el mapa del motor módulo por módulo, generado a partir del código. [Threat Model & Trust Boundaries](/info/threat-model.html) lee la misma arquitectura como límites de confianza, y es la página para cualquier pregunta sobre lo que el motor trata como no confiable.

## El panorama general

Las herramientas son datos en lo alto. El motor, en el medio, no sabe nada de ninguna plataforma. Los shells, abajo, implementan un único contrato, y los catálogos aportan el contenido.

![Las herramientas aportan un manifiesto, una plantilla y hooks al motor compartido. Los shells web, Tauri y de terminal implementan el puente de capacidades HostV1 y leen herramientas y recursos de los catálogos.](/info/diagrams/concepts/platform-layers.svg)

Si puedes describirlo con datos puros y Handlebars, pertenece al **motor**. Si toca el DOM, el sistema de archivos, la red o cualquier API del navegador o del sistema operativo, pertenece al **host**, el lado del shell en el puente. El motor es de código abierto, y nada que conozca una marca o una plataforma concretas entra en el motor.

## Estructura del repositorio

Lolly es un único repositorio. Cada directorio de abajo es un directorio normal en él, excepto `brands/suse`, un submódulo git **privado** que contiene el paquete de herramientas y el catálogo de SUSE, que un clon público no descarga. Qué paquetes lee una compilación lo define un perfil de contenido (`profiles.json`), resuelto por proceso y no conmutado globalmente. [Build Guide](/info/build-guide.html) tiene el comando de clonado y cómo se confirma un cambio dentro del paquete privado.

| Directorio | Qué contiene |
|---|---|
| `engine/` | El núcleo independiente de plataforma: cargador, runtime, entradas, plantillas, modo URL, unidades y los módulos de formato |
| `shells/` | La aplicación web, las aplicaciones de escritorio y móviles de Tauri, la CLI, la TUI y la extensión de navegador |
| `packages/` | El SDK para autores de herramientas (`@lolly-tools/core`), las piezas compartidas del shell de Node y el renderizador de documentación, entre otros |
| `community/` | Las herramientas independientes de marca, más los paquetes de emojis compartidos |
| `brands/` | Paquetes de marca: `lolly-demo` (Lolly Demo, el design system que ejecuta lolly.tools), `lolly-start` (el inicial en blanco) y el privado `suse` |
| `services/` | Los servicios opcionales de MCP, certificados y Penpot, y el código de servidor que comparten |
| `schemas/` | JSON Schema para los manifiestos de herramientas, las entradas de recursos y las referencias a recursos |
| `scripts/`, `tests/`, `docs/`, `api/` | Scripts de compilación y de catálogo, la batería de pruebas del motor, esta documentación y los paquetes serverless generados |

::: details Los archivos del motor y de los shells que encuentras primero
```
engine/src/
  index.ts          public surface: loader, runtime, template, inputs, url-mode
  loader.ts         fetches and validates tool files
  runtime.ts        orchestrates one mounted tool, from load to export
  template.ts       Handlebars hydration and annotateTemplate
  inputs.ts         manifest to runtime input model
  url-mode.ts       URL to input state and back
  validate.ts       JSON Schema validation of manifests
  compose.ts        nested tool renders (composes)
  embed.ts          portable lolly.tools embed URLs
  bridge/host-v1.ts type re-export of the @lolly-tools/core contract

shells/web/src/
  main.ts           boot and routing
  bridge/           the web implementations of the host APIs
  catalog/sync.ts   boot-time catalog sync and offline cache
  views/            the gallery, tool, projects, free canvas and the other views
  pro/              Batch (#/batch)

shells/cli/         bin/lolly.ts (entry), src/run.ts (headless render), src/bridge.ts
shells/tui/         src/main.tsx (the full-screen app), src/bridge.ts
```
:::

No hay ningún directorio `tools/` ni `catalog/` en la raíz del repositorio. `packages/node-shell/src/content-roots.ts` responde "dónde vive la herramienta `<id>`" y "dónde está el catálogo" a partir de `profiles.json` cuando se le pregunta. Un par real de `tools/` y `catalog/` se escribe solo en una salida de compilación, como `dist/`, una carga útil RPM o una imagen de contenedor, porque un navegador descarga esas dos rutas por HTTP.

## Dónde se ejecuta Lolly

Todas las superficies usan el mismo motor y los mismos archivos de herramienta.

- **La aplicación web.** Una aplicación web progresiva que funciona sin conexión una vez que su service worker ha guardado en caché las herramientas y los recursos. No necesita cuenta; el estado vive en IndexedDB en cada dispositivo. Un único diseño adaptable sirve para escritorio y teléfono: en un teléfono los controles pasan a ser una hoja y los controles de exportación se abren desde una píldora flotante.
- **Las aplicaciones de escritorio y móviles.** Paquetes Tauri de la misma aplicación web, con diálogos de archivo nativos, estado en el sistema de archivos y uso completo sin conexión.
- **La CLI.** `lolly <tool-id> --input=value --output=file.png` carga el mismo motor en un DOM sin interfaz y escribe el archivo. Es el modo URL sobre un transporte distinto, no una implementación aparte. Consulta [CLI](/info/cli.html).
- **La TUI.** Una aplicación de terminal a pantalla completa, pensada para el teclado, que reutiliza el puente de la CLI, guarda las sesiones en disco (en la carpeta propia de la aplicación de escritorio cuando está instalada, y si no en `~/.lolly`) y arranca un navegador sin interfaz acotado solo cuando un formato lo necesita. Consulta [TUI](/info/tui.html).

![La vista dividida de escritorio: los controles generados a partir del manifiesto a la izquierda, el lienzo en vivo a la derecha](/t/url-shot?url=%2F%23%2Ftool%2Fchart&width=1440&height=900&dpi=192&waitMs=2200&walker=1&format=svg&filename=aud-web-split)

La misma herramienta al ancho de un teléfono no necesita un segundo diseño: los controles pasan a ser una hoja en la parte superior y la vista previa ocupa la pantalla.

![Un audiograma en una pantalla de 430 px de ancho: la hoja de controles arriba, la ilustración cuadrada terminada debajo y la píldora flotante de exportación](/t/url-shot?url=%2F%23%2Ftool%2Faudiogram%3Faudio%3Dlolly%2Floops%2Ffireplace-loop%26title%3DField%2520notes%26subtitle%3DEpisode%252012%26style%3Dwave&width=430&height=900&dpi=192&waitMs=3200&css=%23ag-wave%7Bdisplay%3Anone!important%7D.ag-ph%7Bdisplay%3Ablock!important%7D&walker=1&format=svg&rasterDpi=110&dark=1&filename=ov2-phone-audiogram)

La aplicación web incluye además **Batch** (`#/batch`, `shells/web/src/pro/`), una cuadrícula al estilo de una hoja de cálculo que renderiza muchas filas a la vez con una o varias herramientas; [Batch and Multi-edit](/info/batch.html#make-many-versions-of-one-design) cubre Batch. **Settings → Capabilities** recoge todo lo que la plataforma declara poder hacer.

![Batch en una instalación nueva: una fila vacía a la espera de una herramienta, con la superficie de hoja de cálculo y su botón Render en su sitio antes de que llegue ningún dato](/t/url-shot?url=%2F%23%2Fbatch&width=1440&height=900&dpi=192&waitMs=3500&walker=1&format=svg&dark=1&filename=ov2-batch-grid)

## Compromisos arquitectónicos

Estas decisiones están cerradas. Cambiar cualquiera de ellas es una empresa de gran calado, porque dan forma a todas las demás decisiones del código.

### 1. Herramientas declarativas, con una vía de escape imperativa

Una herramienta es un manifiesto (`tool.json`), una plantilla (`template.html`) y un `hooks.js` opcional. **El manifiesto declara las entradas**, nunca la plantilla: las entradas no se infieren de los tokens de Handlebars. La mayoría de las herramientas son solo manifiesto y plantilla, lo que permite que las creen quienes no son desarrolladores.

![La pila de controles de Street Map: un menú desplegable de ciudad, un selector de tema, deslizadores de grosor y disparadores de color, todos dibujados a partir de una línea del manifiesto](/t/url-shot?url=%2F%23%2Ftool%2Fstreet-map%3Fcity%3Damsterdam&width=1440&height=900&dpi=192&waitMs=2400&walker=1&format=svg&css=%23tool-canvas%7Bdisplay%3Anone%7D&cropSelector=%23tool-inputs&dark=1&filename=ov2-street-map-controls)

Las herramientas que calculan valores, como la codificación QR o la composición de gráficos, añaden hooks: funciones de ciclo de vida con nombre que el runtime llama con el puente de capacidades inyectado. Los hooks son un contrato de portabilidad, no un sandbox de seguridad, y se ejecutan dentro de un presupuesto de tiempo. Las herramientas cuyos hooks están demostrados libres de globales de la página llevan `isolate: true` y se ejecutan en un Worker. [Tool hooks](/info/tool-hooks.html) tiene el ciclo de vida y los presupuestos, y el [Threat Model](/info/threat-model.html) dice qué contiene y qué no contiene el ejecutor dentro de la página.

### 2. Las herramientas y los activos son datos, no código empaquetado

Las aplicaciones web y Tauri descargan los catálogos de herramientas y recursos al arrancar, los guardan en caché y trabajan con lo que haya, así que una herramienta o un recurso nuevos no necesitan una versión de la aplicación. Los bytes de los recursos llevan suma de verificación SHA-256, y el `id` y la `version` de un recurso gobiernan la invalidación de la caché.

### 3. El puente de capacidades es la única API que ven las herramientas

Las herramientas nunca tocan el DOM fuera de su plantilla, nunca llaman a `fetch` directamente y nunca leen el sistema de archivos. Llaman a métodos `host.*` con versión. La definición canónica del contrato es `packages/core/src/host-v1.ts`, el SDK para autores de herramientas `@lolly-tools/core`, para que un tercero pueda desarrollar contra él sin depender del motor; `engine/src/bridge/host-v1.ts` reexporta sus tipos.

| API obligatoria | Qué hace |
|---|---|
| `host.profile` | Los datos del usuario; rellena entradas mediante `bindToProfile` |
| `host.assets` | Consultas al catálogo, resolución de recursos y el selector del host |
| `host.state` | Guardar y cargar espacios de entradas: IndexedDB en la web, el sistema de archivos en Tauri, memoria en la CLI |
| `host.clipboard` | Escribir texto o una imagen en el portapapeles, con alternativas según la plataforma |
| `host.export` | Rasterizar o serializar el destino del renderizado, y la ruta de transformación de archivos en el dispositivo |
| `host.log` | Registro por niveles hacia el host |

Todas las demás API son opcionales y aditivas: `tokens`, `text`, `color`, `geom`, `pdf`, `compose`, `media`, `recorder` y muchas más. El manifiesto de una herramienta enumera en `requires` las API opcionales que sus hooks llaman sin comprobar antes, y un host que carezca de una se niega a montar la herramienta; los hooks detectan el resto. Unas pocas, como `recorder`, también necesitan una capacidad del dispositivo que declara la herramienta. `packages/core/src/host-v1/apis.ts` las enumera todas y [Host API](/info/host-api.html) documenta cada una. Añadir un método es una versión menor; eliminar o cambiar uno es una versión mayor, y v1 sigue funcionando cuando sale v2.

### 4. Los ID de recursos son para siempre

`lolly/logo/primary` es un contrato. Una vez publicado, un ID nunca cambia y nunca se reutiliza. Un cambio de bytes sube la `version` en la entrada del recurso, y un reemplazo establece `deprecated: true` y, opcionalmente, `replacedBy`, para que las referencias existentes siempre se resuelvan. Eso es lo que mantiene funcionando durante años las sesiones guardadas y los enlaces compartidos.

### 5. El modo URL es de primera clase

Toda entrada se puede expresar como parámetro de URL, así que un enlace es un archivo terminado:

```
https://lolly.tools/t/qr-code?url=https://example.com&ecl=H
```

![Ese enlace por sí solo, sin nada más, es el archivo terminado](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Fexample.com%26ecl%3DH%26full&width=760&height=760&dpi=192&waitMs=2000&walker=1&format=svg&dark=1&filename=aud-url-mode-qr)

Cambia un parámetro y tienes un archivo distinto. Toda esta paleta es un color semilla, una armonía y un número de pasos:

![Nueve pasos en cuatro matices, todos generados a partir del único color semilla que lleva el enlace](/t/url-shot?url=%2F%23%2Ftool%2Fcolor-palette%3Fseed%3De0521a%26harmony%3Dtetrad-4%26steps%3D9%26full&width=1440&height=900&dpi=192&waitMs=2000&walker=1&format=svg&cropSelector=%23tool-canvas&dark=1&filename=ov2-url-palette)

La CLI construye el mismo estado de URL a partir de sus argumentos y ejecuta la misma canalización, así que la CLI no puede divergir de la aplicación. `engine/src/url-mode.ts` analiza y serializa; un conjunto de nombres reservados (`format`, `width`, `dpi`, `c2pa`, `z` y otros) nunca se pasa a una herramienta, y [Reserved URL parameters](/info/url-parameters.html) los enumera todos. Las entradas de recursos viajan por `id` y se resuelven mediante `host.assets.get()` antes de que se rellene la plantilla.

### 6. El almacenamiento pasa por el puente

La aplicación web usa IndexedDB, Tauri el sistema de archivos y la CLI la memoria. Las herramientas solo ven `host.state.save(slot, data)` y `host.state.load(slot)`, nunca `localStorage`. Las personas pueden guardar varias sesiones con nombre por herramienta sin cuenta. Como el puente es la única costura, ese estado también es portátil: `shells/web/src/data-transfer.ts` lo vuelve a leer en un único archivo `lolly-backup` que se importa en cualquier otra instalación ([Data transfer](/info/data-transfer.html)), y [Sync](/info/sync.html) envía el mismo paquete al almacenamiento que elige la persona.

### 7. Las etiquetas de madurez dicen qué es una herramienta

Toda herramienta declara `status: official | community | experimental`. La galería ordena por estado, y las herramientas experimentales ponen marca de agua en sus exportaciones por defecto: el runtime activa la marca de agua a menos que quien llama pase `watermark: false`, y las herramientas en el dispositivo están exentas. Cualquier proceso que un equipo ponga alrededor del catálogo se apoya en esto.

### 8. Las entradas están tipadas en el manifiesto

Una entrada declara un `type`: `text`, `longtext`, `number`, `boolean`, `color`, `select`, `asset`, `date`, `time`, `datetime-local`, `url`, `blocks`, `vector`, `table` o `file`. El host dibuja un control por tipo, así que las herramientas no escriben código de controles, y cualquier entrada puede llevar `bindToProfile`. Tres pesan más:

- **`asset`**, con `filter` y `allowUpload`, es el puente al sistema de recursos. `allowUpload: false` limita un espacio a los recursos de la biblioteca, y las subidas de usuarios comparten la forma `AssetRef` de la biblioteca.
- **`blocks`** es un grupo de campos repetible que se edita en un panel lateral, usado por Meeting Planner, Wayfinding, Diagrams y otras. Hacer clic en un bloque renderizado enfoca su fila.
- **`file`** guarda en memoria el propio archivo del usuario para utilidades en el dispositivo como Strip Hidden Data y Compress, y **`vector`** agrupa un conjunto fijo de números en un solo control.

### 9. Las plantillas no tienen lógica

Las plantillas son Handlebars, elegido para que puedan escribirlas quienes no son desarrolladores: `{{x}}` escapa, y `{{{x}}}` es una aceptación explícita. La lógica vive en `hooks.js`, donde es explícita y revisable. Muchas plantillas usan `{{{` para marcado que calculó un hook, así que cada hook debe escapar lo que entrega. Los helpers son `default`, `upper`, `lower`, `eq`, `markdown`, `asset`, `framing` y `media`, más `icsStamp`, `rfcText`, `csvCell` y `arrow` para las plantillas hermanas `.ics`, `.vcf` y `.csv`. [Templates and rendering](/info/tool-rendering.html) los cubre.

### 10. Las herramientas componen herramientas

Una herramienta puede incrustar el renderizado de otra sin importaciones entre herramientas; el motor resuelve la composición. Un manifiesto puede declarar `composes: [{ id, tool, inputs }]` y colocar la hija con `{{asset <id>}}`, y una URL de incrustación portátil (`https://lolly.tools/tool/<id>.svg?…`) renderiza la hija en local, que es como Design coloca un código QR o un gráfico en vivo. Una hija SVG sigue siendo vectorial dentro de un padre SVG o PDF. Las hijas son intermedios, nunca llevan marca de agua ni sello, y un shell que no puede renderizar una deja el espacio vacío mientras el padre se renderiza igualmente. [Composition and brand overlays](/info/tool-composition.html) tiene los detalles.

## Lo que decidimos no hacer

- **Sin JavaScript arbitrario en las plantillas.** La lógica vive en `hooks.js`.
- **Sin servidor de recursos obligatorio.** Las personas añaden sus propios archivos a Assets en la aplicación y pasan el trabajo como una sesión: un enlace compartido para las entradas y los ajustes, un archivo `.lolly` cuando también viajan las subidas. Una sesión compartida puede convertirse en plantilla en el selector de una herramienta. Una organización que quiera un catálogo gobernado puede usar el catálogo, las aprobaciones y las políticas de Lolly Work, o gestionar el paquete de marca en git y revisar allí los cambios.
- **Sin control de acceso forzado.** La aplicación abierta es pública por defecto, y las etiquetas de madurez y las marcas de agua cargan con el riesgo para la marca. El inicio de sesión de organización, los roles y las políticas vienen de Lolly Work cuando un equipo los quiere.
- **Sin base de datos central.** El estado del usuario vive en cada dispositivo, y Sync opcional lo copia al almacenamiento que elige la persona, nunca a una base de datos de Lolly.
- **Sin camino de código compartido entre las herramientas y el motor.** El motor y las herramientas comunitarias son de código abierto, y un paquete de marca como el privado `brands/suse/` lleva sus propias herramientas y catálogo bajo sus propios términos. Ninguna herramienta importa de `engine/`, así que la separación se mantiene limpia.

## El ciclo de vida de un renderizado

Alguien abre `https://lolly.tools/t/qr-code?url=https://example.com&ecl=H`:

1. **Arranque.** La aplicación web abre IndexedDB, construye el puente de capacidades y sincroniza los catálogos de herramientas y recursos, o los carga de la caché cuando no hay conexión.
2. **Ruta.** La ruta selecciona la vista de herramienta de `qr-code`, con la consulta como valores iniciales.
3. **Carga.** `loadTool` descarga `tool.json`, lo valida con el esquema y descarga la plantilla, los estilos y los hooks.
4. **Análisis del enlace.** `parseUrlState` convierte los parámetros en valores de entrada. Una referencia a un recurso como `?logo=lolly/logo/primary` se convierte en un `{ id }` sin resolver.
5. **Arranque del runtime.** `createRuntime(tool, host, initialValues)` construye el modelo de entradas a partir de los datos del perfil, los valores predeterminados y el enlace, resuelve las referencias a recursos, carga los hooks y llama a `onInit`.
6. **Renderizado.** El shell se suscribe al runtime, dibuja los controles a partir del modelo y escribe la plantilla rellenada en `#tool-canvas`.
7. **Interacción.** Escribir llama a `runtime.setInput`, que aplica restricciones, llama a `onInput`, vuelve a rellenar la plantilla y redibuja.
8. **Exportación.** **Download** llama a `runtime.export(node, format)`, y el `host.export` del shell produce el archivo: una trama, un vector desde el recorredor del DOM, un PDF, un documento o uno de los demás formatos de `schemas/tool.schema.json`. Las unidades físicas se convierten por formato, y los metadatos y las Content Credentials se incrustan donde el formato puede contenerlos. Las herramientas experimentales reciben su marca de agua del host, no de la herramienta. [Templates and rendering](/info/tool-rendering.html) y [Export a file](/info/exporting.html) cubren el paso de exportación.

![El panel de exportación que abre ?options: el par de nombre de archivo y formato, el tamaño de salida y los controles que escriben el archivo](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26options&width=1440&height=900&dpi=192&waitMs=2200&cropSelector=.export-popup&walker=1&format=svg&dark=1&filename=aud-export-popup)

El mismo ciclo de vida se ejecuta en Tauri, y en la CLI con un DOM sin interfaz, donde la salida va a un archivo o a stdout.

## Licencias

El código, incluidos `engine/`, `shells/`, `services/`, `schemas/` y el generador de documentación, es MPL-2.0, en un único repositorio público, [`lolly-tools/lolly`](https://github.com/lolly-tools/lolly). La prosa de la documentación es CC BY-SA 4.0. Los paquetes de marca llevan sus propios términos en el `NOTICE.md` de cada paquete: las herramientas comunitarias son MPL-2.0, y el paquete privado de SUSE es propiedad de SUSE. [About](/info/about.html) tiene la nota completa de licencias.
