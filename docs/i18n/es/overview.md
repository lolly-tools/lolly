# Arquitectura de Lolly

![Icono de Lolly - Una piruleta grande verde y blanca](/info/icon.svg)

Esta página es para quienes cambian el código de Lolly: cómo encajan el motor, las shells y los paquetes de herramientas, dónde está cada uno en el repositorio y los compromisos que condicionan cada cambio. Para saber qué hace Lolly y quién lo usa, lee primero [Cómo funciona Lolly](/info/how-lolly-works.html).

[`engine/README.md`](https://github.com/lolly-tools/lolly/blob/main/engine/README.md) describe el motor módulo a módulo y se genera a partir del código. [Modelo de amenazas & límites de confianza](/info/threat-model.html) interpreta la misma arquitectura como límites de confianza e indica qué considera el motor no fiable.

<!--i:eti-layers-->
## Visión general

Las herramientas son datos en la parte superior. El motor, en el centro, no sabe nada de ninguna plataforma. Las shells, en la parte inferior, implementan un único contrato, y los catálogos suministran el contenido.

![Las herramientas suministran un manifiesto, una plantilla y hooks al motor compartido. Las shells web, de Tauri y de terminal implementan el puente de capacidades HostV1 y leen herramientas y recursos de los catálogos.](/info/diagrams/concepts/platform-layers.svg)

Todo lo que puedas describir con datos puros y Handlebars pertenece al **motor**. Todo lo que acceda al DOM, al sistema de archivos, a la red o a cualquier API del navegador o del sistema operativo pertenece al **host**, el lado del puente que corresponde a la shell. El motor es de código abierto. Nada que conozca una marca concreta entra en el motor.

<!--i:eti-folder-shared-->
## Estructura del repositorio

Lolly es un único repositorio. Cada directorio de abajo es un directorio normal, excepto `brands/suse`: un submódulo git **privado** con el paquete de herramientas y el catálogo de SUSE, que una clonación pública no descarga. Un perfil de contenido (`profiles.json`) establece qué paquetes lee una compilación. Cada proceso resuelve su propio perfil y no hay un interruptor global. La [guía de compilación](/info/build-guide.html) incluye el comando de clonación y cómo registrar un cambio dentro del paquete privado.

| Directorio | Qué contiene |
|---|---|
| `engine/` | El núcleo independiente de la plataforma: cargador, entorno de ejecución, entradas, plantillas, modo URL, unidades y módulos de formato |
| `shells/` | La aplicación web, las aplicaciones de escritorio y móvil de Tauri, la CLI, la TUI y la extensión del navegador |
| `packages/` | El SDK para autores de herramientas (`@lolly-tools/core`), los componentes compartidos de la shell de Node y el renderizador de documentación, entre otros |
| `community/` | Las herramientas independientes de la marca y los paquetes de emoji compartidos |
| `brands/` | Paquetes de marca: `lolly-demo` (Lolly Demo, el design system que usa lolly.tools), `lolly-start` (el punto de partida en blanco) y el privado `suse` |
| `services/` | Los servicios opcionales de MCP, certificados y Penpot, y el código de servidor que comparten |
| `schemas/` | JSON Schema para manifiestos de herramientas, entradas de recursos y referencias a recursos |
| `scripts/`, `tests/`, `docs/`, `api/` | Scripts de compilación y catálogo, la batería de pruebas del motor, esta documentación y los paquetes serverless generados |

::: details Los archivos del motor y las shells que verás primero
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

::: note No hay ningún directorio `tools/` ni `catalog/` en la raíz del repositorio
`packages/node-shell/src/content-roots.ts` responde a «dónde está la herramienta `<id>`» y «dónde está el catálogo» a partir de `profiles.json`. Solo se escribe un par real de `tools/` y `catalog/` en la salida de una compilación, como `dist/`, el contenido de un RPM o una imagen de contenedor, porque un navegador descarga esas dos rutas por HTTP.
:::

<!--i:eti-monitor-->
## Dónde se ejecuta Lolly

Todas las interfaces usan el mismo motor y los mismos archivos de herramientas.

- **La aplicación web.** Una aplicación web progresiva. Funciona sin conexión una vez que su service worker ha almacenado en caché las herramientas y los recursos. No necesita cuenta y el estado se guarda en IndexedDB en cada dispositivo. Un único diseño adaptable sirve para ordenador y teléfono. En un teléfono, los controles se convierten en un panel y los controles de exportación se abren desde una píldora flotante.
- **Las aplicaciones de escritorio y móvil.** Paquetes de Tauri de la misma aplicación web, con diálogos de archivos nativos, estado en el sistema de archivos y uso completo sin conexión.
- **La CLI.** `lolly <tool-id> --input=value --output=file.png` carga el mismo motor en un DOM sin interfaz gráfica y escribe el archivo. Es el modo URL sobre un transporte distinto. Consulta [CLI](/info/cli.html).
- **La TUI.** Una aplicación de terminal a pantalla completa, pensada ante todo para el teclado. Reutiliza el puente de la CLI y conserva las sesiones guardadas en disco: en la carpeta de la aplicación de escritorio cuando está instalada o, en caso contrario, en `~/.lolly`. Solo inicia un navegador sin interfaz gráfica de alcance limitado cuando un formato lo necesita. Consulta [TUI](/info/tui.html).

![La vista dividida de escritorio: los controles generados a partir del manifiesto a la izquierda y el lienzo en vivo a la derecha](/t/url-shot?url=%2F%23%2Ftool%2Fchart&width=1440&height=900&dpi=192&waitMs=2200&walker=1&format=svg&filename=aud-web-split)

Con el ancho de un teléfono, el panel de controles está arriba y la vista previa llena la pantalla.

![Un audiograma en una pantalla de 430px de ancho: el panel de controles arriba, el diseño cuadrado terminado abajo y la píldora de exportación flotante](/t/url-shot?url=%2F%23%2Ftool%2Faudiogram%3Faudio%3Dzzfxm%3A7%3Alofi%26title%3DField%2520notes%26subtitle%3DEpisode%252012%26style%3Dwave&width=430&height=900&dpi=192&waitMs=3200&css=%23ag-wave%7Bdisplay%3Anone!important%7D.ag-ph%7Bdisplay%3Ablock!important%7D&walker=1&format=svg&rasterDpi=110&dark=1&filename=ov2-phone-audiogram)

La aplicación web también incluye **Batch** (`#/batch`, `shells/web/src/pro/`), una cuadrícula de tipo hoja de cálculo que renderiza muchas filas a la vez con una o varias herramientas. Consulta [Batch y Lolly Multi-edit](/info/batch.html#make-many-versions-of-one-design). **Settings → Capabilities** enumera todo lo que la plataforma declara que puede hacer.

![Batch en una instalación nueva: una fila vacía espera una herramienta, con la hoja de cálculo y su botón Render ya presentes antes de que llegue ningún dato](/t/url-shot?url=%2F%23%2Fbatch&width=1440&height=900&dpi=192&waitMs=3500&walker=1&format=svg&dark=1&filename=ov2-batch-grid)

<!--i:eti-lock-->
## Compromisos de arquitectura

Estas decisiones son firmes. Todas las demás decisiones del código dependen de ellas, así que cambiar una supone un esfuerzo considerable.

### 1. Herramientas declarativas, con una vía de escape imperativa

Una herramienta es un manifiesto (`tool.json`), una plantilla (`template.html`) y, de forma opcional, `hooks.js`. **El manifiesto declara las entradas**. Las entradas nunca se deducen de los tokens de Handlebars de la plantilla. La mayoría de las herramientas solo tienen un manifiesto y una plantilla, así que pueden crearlas personas que no programan.

![La pila de controles de Street Map: un desplegable de ciudades, un selector de tema, deslizadores de grosor y botones de color, cada uno generado a partir de una línea del manifiesto](/t/url-shot?url=%2F%23%2Ftool%2Fstreet-map%3Fcity%3Damsterdam&width=1440&height=900&dpi=192&waitMs=2400&walker=1&format=svg&css=%23tool-canvas%7Bdisplay%3Anone%7D&cropSelector=%23tool-inputs&dark=1&filename=ov2-street-map-controls)

Las herramientas que calculan valores, como la codificación QR o la generación de gráficos, añaden hooks: funciones con nombre del ciclo de vida que el entorno de ejecución llama con el puente de capacidades inyectado. Los hooks son un contrato de portabilidad, no un entorno aislado de seguridad. Se ejecutan dentro de un presupuesto de tiempo. Las herramientas cuyos hooks se ha comprobado que no usan variables globales de la página llevan `isolate: true` y se ejecutan en un Worker. [Hooks de herramientas](/info/tool-hooks.html) describe el ciclo de vida y los presupuestos. El [modelo de amenazas](/info/threat-model.html) indica qué contiene y qué no contiene el ejecutor dentro de la página.

### 2. Las herramientas y los recursos son datos, no código empaquetado

Las aplicaciones web y de Tauri descargan los catálogos de herramientas y recursos al arrancar, los almacenan en caché y trabajan con lo almacenado. Una herramienta o un recurso nuevo no requiere una nueva versión de la aplicación. Los bytes de los recursos se verifican con sumas de comprobación SHA-256. El `id` y la `version` de un recurso determinan la invalidación de la caché.

### 3. El puente de capacidades es la única API que ven las herramientas

Las herramientas nunca acceden al DOM fuera de su plantilla, nunca llaman a `fetch` directamente y nunca leen el sistema de archivos. Llaman a métodos `host.*` versionados. El contrato se define en `packages/core/src/host-v1.ts`, dentro del SDK para autores de herramientas `@lolly-tools/core`. Un tercero puede desarrollar con el SDK sin depender del motor. `engine/src/bridge/host-v1.ts` reexporta sus tipos.

| API obligatoria | Qué hace |
|---|---|
| `host.profile` | Los datos del usuario; rellena las entradas mediante `bindToProfile` |
| `host.assets` | Consultas al catálogo, resolución de recursos y selector del host |
| `host.state` | Guardar y cargar ranuras de entradas: IndexedDB en la web, el sistema de archivos en Tauri, memoria en la CLI |
| `host.clipboard` | Escribir texto o una imagen en el portapapeles, con alternativas según la plataforma |
| `host.export` | Rasterizar o serializar el destino del renderizado y la ruta de transformación de archivos en el dispositivo |
| `host.log` | Registro por niveles en el host |

Todas las demás API son opcionales y aditivas: `tokens`, `text`, `color`, `geom`, `pdf`, `compose`, `media`, `recorder` y muchas más. El `requires` de un manifiesto enumera las API opcionales que sus hooks llaman sin comprobar antes su disponibilidad. Un host que carece de una de ellas se niega a montar la herramienta. Los hooks comprueban la disponibilidad de las demás. Algunas, como `recorder`, también necesitan una capacidad del dispositivo que la herramienta declara. `packages/core/src/host-v1/apis.ts` las enumera todas y [API del host](/info/host-api.html) documenta cada una. Añadir un método supone una versión menor. Eliminar o cambiar uno supone una versión mayor, y v1 sigue funcionando cuando se publica v2.

### 4. Los id de los recursos son para siempre

`lolly/logo/primary` es un contrato. Una vez publicado, un id nunca cambia ni se reutiliza. Un cambio de bytes incrementa `version` en la entrada del recurso. Una sustitución establece `deprecated: true` y, de forma opcional, `replacedBy`. Las referencias existentes siempre se resuelven, así que las sesiones guardadas y los enlaces compartidos siguen funcionando durante años.

### 5. El modo URL es una función de primer nivel

Cada entrada se puede expresar como un parámetro de URL, así que un enlace es un archivo terminado:

```
https://lolly.tools/t/qr-code?url=https://example.com&ecl=H
```

![Ese enlace por sí solo, sin nada más, es el archivo terminado](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Fexample.com%26ecl%3DH%26full&width=760&height=760&dpi=192&waitMs=2000&walker=1&format=svg&dark=1&filename=aud-url-mode-qr)

Cambia un parámetro y obtienes un archivo distinto. Esta paleta consiste en un color semilla, una armonía y un número de pasos:

![Nueve pasos a través de cuatro tonos, todos generados a partir del único color semilla que contiene el enlace](/t/url-shot?url=%2F%23%2Ftool%2Fcolor-palette%3Fseed%3De0521a%26harmony%3Dtetrad-4%26steps%3D9%26full&width=1440&height=900&dpi=192&waitMs=2000&walker=1&format=svg&cropSelector=%23tool-canvas&dark=1&filename=ov2-url-palette)

La CLI construye el mismo estado de URL a partir de sus argumentos y ejecuta el mismo proceso, así que la CLI no puede divergir de la aplicación. `engine/src/url-mode.ts` analiza y serializa el estado de URL. Los nombres reservados (`format`, `width`, `dpi`, `c2pa`, `z` y otros) nunca se pasan a una herramienta. [Parámetros de URL reservados](/info/url-parameters.html) los enumera todos. Las entradas de recursos viajan por `id` y se resuelven mediante `host.assets.get()` antes de rellenar la plantilla.

### 6. El almacenamiento pasa por el puente

La aplicación web usa IndexedDB, Tauri el sistema de archivos y la CLI la memoria. Las herramientas solo ven `host.state.save(slot, data)` y `host.state.load(slot)`, nunca `localStorage`. Puedes conservar varias sesiones con nombre por herramienta sin cuenta. Como el puente es el único punto de conexión, ese estado también es portable. `shells/web/src/data-transfer.ts` exporta el estado como un único archivo `lolly-backup` que se puede importar en cualquier otra instalación ([Transferencia de datos](/info/data-transfer.html)). [Sync](/info/sync.html) envía el mismo paquete al almacenamiento que elijas.

### 7. Las etiquetas de madurez indican qué es una herramienta

Cada herramienta declara `status: official | community | experimental`. La galería ordena por estado. Las herramientas experimentales añaden una marca de agua a sus exportaciones de forma predeterminada: el entorno de ejecución la activa salvo que quien lo llama pase `watermark: false`. Las herramientas que operan en el dispositivo están exentas. El proceso de catálogo propio de un equipo se aplica sobre estas etiquetas.

### 8. Las entradas tienen un tipo en el manifiesto

Una entrada declara un `type`: `text`, `longtext`, `number`, `boolean`, `color`, `select`, `asset`, `date`, `time`, `datetime-local`, `url`, `blocks`, `vector`, `table` o `file`. El host renderiza un control para cada tipo, así que las herramientas no escriben código de controles. Cualquier entrada puede llevar `bindToProfile`. Tres tipos son los más relevantes:

- **`asset`**, con `filter` y `allowUpload`, es el puente al sistema de recursos. `allowUpload: false` limita una ranura a los recursos de la biblioteca. Los archivos que sube el usuario comparten la estructura `AssetRef` de la biblioteca.
- **`blocks`** es un grupo de campos repetible que se edita en un panel lateral, usado por Meeting Planner, Wayfinding, Diagrams y otros. Hacer clic en un bloque renderizado lleva el foco a su fila.
- **`file`** conserva el archivo del usuario en memoria para utilidades que operan en el dispositivo, como Lolly Strip Hidden Data y Compress, y **`vector`** agrupa un conjunto fijo de números en un único control.

### 9. Las plantillas no contienen lógica

Las plantillas son Handlebars, así que pueden escribirlas personas que no programan. `{{x}}` escapa el contenido y `{{{x}}}` requiere una elección explícita. La lógica está en `hooks.js`, donde se puede revisar. Muchas plantillas usan `{{{` para el marcado que ha calculado un hook, así que cada hook debe escapar lo que entrega. Las funciones auxiliares son `default`, `upper`, `lower`, `eq`, `markdown`, `asset`, `framing` y `media`, además de `icsStamp`, `rfcText`, `csvCell` y `arrow` para las plantillas asociadas `.ics`, `.vcf` y `.csv`. [Plantillas y renderizado](/info/tool-rendering.html) las explica.

### 10. Las herramientas componen herramientas

Una herramienta puede incrustar el renderizado de otra sin importaciones entre herramientas. El motor resuelve la composición. Un manifiesto puede declarar `composes: [{ id, tool, inputs }]` y colocar el elemento hijo con `{{asset <id>}}`. Una URL de incrustación portable (`https://lolly.tools/tool/<id>.svg?…`) renderiza el hijo localmente; Lolly Design coloca así un código QR o un gráfico en vivo. Un hijo SVG se mantiene vectorial dentro de un padre SVG o PDF. Los hijos son elementos intermedios y nunca reciben marcas de agua ni sellos. Una shell que no puede renderizar un hijo deja la ranura vacía y el padre sigue renderizándose. [Composición y superposiciones de marca](/info/tool-composition.html) tiene los detalles.

<!--i:eti-scissors-->
## Lo que decidimos no hacer

- **Sin JavaScript arbitrario en las plantillas.** La lógica está en `hooks.js`.
- **Sin servidor de recursos obligatorio.** Puedes añadir tus propios archivos a Assets en la aplicación y entregar el trabajo como una sesión: un enlace para compartir entradas y ajustes, un archivo `.lolly` cuando también viajan los archivos subidos. Una sesión compartida puede convertirse en una plantilla del selector de una herramienta. Una organización que quiera un catálogo gestionado puede usar el catálogo, las aprobaciones y las políticas de Lolly Work o gestionar el paquete de marca en git y revisar allí los cambios.
- **Sin control de acceso forzoso.** La aplicación abierta es pública de forma predeterminada. Las etiquetas de madurez y las marcas de agua indican el riesgo para la marca. El inicio de sesión de la organización, los roles y la política los aporta Lolly Work cuando un equipo los quiere.
- **Sin base de datos central.** El estado del usuario se guarda en cada dispositivo y la función opcional Sync lo copia al almacenamiento que elija la persona, nunca a una base de datos de Lolly.
- **Sin rutas de código compartidas entre las herramientas y el motor.** El motor y las herramientas de la comunidad son de código abierto. Un paquete de marca como el privado `brands/suse/` incluye sus propias herramientas y catálogo con sus propias condiciones. Ninguna herramienta importa desde `engine/`, así que la separación se mantiene clara.

<!--i:eti-refresh-->
## El ciclo de vida de un renderizado

Alguien abre `https://lolly.tools/t/qr-code?url=https://example.com&ecl=H`:

1. **Arranque.** La aplicación web abre IndexedDB, construye el puente de capacidades y sincroniza los catálogos de herramientas y recursos, o los carga de la caché si no hay conexión.
2. **Enrutamiento.** La ruta selecciona la vista de herramienta para `qr-code`, con la consulta como valores iniciales.
3. **Carga.** `loadTool` descarga `tool.json`, lo valida frente al esquema y descarga la plantilla, los estilos y los hooks.
4. **Analizar el enlace.** `parseUrlState` convierte los parámetros en valores de entrada. Una referencia a un recurso como `?logo=lolly/logo/primary` se convierte en un `{ id }` sin resolver.
5. **Iniciar el entorno de ejecución.** `createRuntime(tool, host, initialValues)` construye el modelo de entradas a partir de los datos del perfil, los valores predeterminados y el enlace, resuelve las referencias a recursos, carga los hooks y llama a `onInit`.
6. **Renderizado.** La shell se suscribe al entorno de ejecución, dibuja los controles a partir del modelo y escribe la plantilla rellenada en `#tool-canvas`.
7. **Interacción.** Escribir llama a `runtime.setInput`, que aplica las restricciones, llama a `onInput`, rellena de nuevo la plantilla y vuelve a dibujar.
8. **Exportación.** **Download** llama a `runtime.export(node, format)` y el `host.export` de la shell produce el archivo: una imagen de trama, un vector a partir del recorrido del DOM, un PDF, un documento o uno de los otros formatos de `schemas/tool.schema.json`. Las unidades físicas se convierten según el formato. Los metadatos y Content Credentials se incrustan cuando el formato puede contenerlos. Las herramientas experimentales reciben su marca de agua del host, no de la herramienta. [Plantillas y renderizado](/info/tool-rendering.html) y [Exportar un archivo](/info/exporting.html) explican el paso de exportación.

![El panel de exportación que abre ?options: el par de nombre de archivo y formato, el tamaño de salida y los controles que escriben el archivo](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26options&width=1440&height=900&dpi=192&waitMs=2200&cropSelector=.export-popup&walker=1&format=svg&dark=1&filename=aud-export-popup)

El mismo ciclo de vida se ejecuta en Tauri y en la CLI con un DOM sin interfaz gráfica, donde la salida va a un archivo o a stdout.

<!--i:eti-stamp-->
## Licencias

El código, incluidos `engine/`, `shells/`, `services/`, `schemas/` y el generador de documentación, tiene licencia MPL-2.0 y está en un único repositorio público, [`lolly-tools/lolly`](https://github.com/lolly-tools/lolly). La prosa de la documentación tiene licencia CC BY-SA 4.0. Los paquetes de marca incluyen sus propias condiciones en el `NOTICE.md` de cada paquete: las herramientas de la comunidad tienen licencia MPL-2.0 y el paquete privado de SUSE es propiedad de SUSE. [Acerca de](/info/about.html) contiene la nota completa sobre licencias.
