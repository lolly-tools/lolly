# Empezar

Al terminar esta página tus herramientas llevarán tus propios colores y fuentes, y el trabajo que ya tienes estará listo para reutilizarse. No necesitas cuenta, y crear y exportar se ejecutan en tu dispositivo.

::: timeline
- <!--i:sparkle--> **Crea un archivo.** [Make your first file](/info/make-something.html) te guía por un código QR en pocos minutos.
- <!--i:palette--> **Pon tu marca.** Empieza con un color, un archivo de tokens o un diseño terminado.
- <!--i:layers--> **Crea más de lo mismo.** Comparte un enlace, rellena una hoja de cálculo o ejecuta la herramienta desde un script.
:::

¿Es nueva para ti la idea en sí? [What is Lolly?](/info/what-is-lolly.html) es la introducción de cinco minutos, y [How Lolly works](/info/how-lolly-works.html) muestra quién hace qué.

## Pon tu marca

lolly.tools se abre en **Lolly Demo**, el design system de muestra del propio Lolly; [Meet Lolly Demo](/info/lolly-demo.html) muestra qué estás viendo. Tu design system lo sustituye: un pequeño conjunto de design tokens, es decir, colores, fuentes y unas pocas reglas, con el que dibuja cada herramienta. Defínelo una vez, y todo lo que crees empieza ya con tu marca.

Elige la ruta que corresponda a lo que tienes:

- <!--i:palette--> **Un color.** Abre **Design System Setup** (`#/start`), da un nombre a tu design system y elige un color primario. Lolly deriva de él una paleta completa y accesible, con superficies claras y oscuras, texto y acentos. Elige una fuente y ya tienes una marca que funciona.
- <!--i:upload--> **Un archivo de tokens.** **Add from…**, al pie del carril de salas de Design System Setup, acepta un archivo de tokens DTCG, Tokens Studio o Penpot, un SVG o un paquete `LollyBrand`. Suéltalo y la paleta se rellena. Mientras el design system sigue vacío, **Start from a reference** en la sala Overview abre el mismo selector.
- <!--i:pentool--> **Un diseño terminado.** En Design, elige **Import a design** y suelta un archivo `.fig`, `.penpot`, `.ai`, `.idml` o SVG. Consulta [Trae lo que ya tienes](#bring-in-what-you-already-have) más abajo.

La primera vez que abres la galería, una breve bienvenida ofrece las mismas opciones: **Make it yours** abre Design System Setup, **Bring your design** abre un selector de archivos para un diseño y **Explore the community tools** cierra la bienvenida.

![La sala Colours de Design System Setup en una instalación nueva: una muestra en vivo, un campo y toda la primera decisión](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor&width=1440&height=740&dpi=192&waitMs=1800&format=svg&walker=1&localize=1&dark=1&filename=brand-colours)

A partir de ahí, siete salas lo llevan tan lejos como quieras, en cualquier orden: **Overview**, **Colours**, **Type**, **Logos**, **Tokens**, **Files** y **Usage & rules**. Todas las vistas previas de la aplicación se actualizan mientras escribes. [Design System Setup](/info/brand-studio.html) cubre cada sala.

Las fuentes se guardan en tu dispositivo. Elige una Google Font y Lolly guarda el archivo como recurso de marca, de modo que tu tipografía viaja sin conexión y no se descarga nada cuando una herramienta dibuja.

### Ver, cambiar y compartir un design system

- **Ver el activo.** **Settings → Design system** muestra el design system activo como portada y páginas, de solo lectura.
- **Cambiar entre ellos.** **Settings → Preferences → Design systems** enumera todos los design systems de este dispositivo. Una organización puede operar varios design systems, o uno con varias colourways; [Brand architectures](/info/brand-architectures.html) recoge las configuraciones posibles.
- **Compartir uno.** Exporta el design system como paquete `LollyBrand`: un archivo que un colega importa para obtener la misma paleta, fuentes y reglas.

Un design system que aporta tu compilación u organización está **gestionado**: muestra un candado y es de solo lectura. Para cambiar uno, crea una copia editable desde **Settings → Preferences → Design systems**.

![La pestaña Design system en Settings: el design system activo como portada y páginas](/t/url-shot?url=%2F%23%2Fd%3Ftab%3Dbrand&width=1440&height=900&dpi=192&waitMs=1800&format=svg&walker=1&localize=1&dark=1&filename=dashboard-brand&waitSelector=%5Bdata-issue-ready%5D)

Tu design system son tokens DTCG, el formato que Penpot lee y escribe y que Tokens Studio lleva a Figma, de modo que la paleta con la que diseñas y la paleta que Lolly aplica son un único documento. [Design Tokens](/info/design-tokens.html) tiene los detalles.

::: details Para desarrolladores: crear un paquete de marca desde la línea de comandos
Para montar un paquete de marca reutilizable en un checkout, `ingest:brand` acepta los tres contenedores que exportan Penpot y Tokens Studio: un único `tokens.json`, un directorio de archivos por conjunto con `$metadata.json`, o un archivo `project.penpot`.

```bash
pnpm run ingest:brand ./my-tokens.json --name acme --label "Acme" --activate
```

`--activate` registra la marca como perfil y compila y valida su catálogo. Nunca cambia el perfil predeterminado: ejecuta con `LOLLY_PROFILE=acme` para usar el nuevo paquete. [Configuration](/info/configuration.html) explica cómo encajan los paquetes de marca y los perfiles.
:::

## Trae lo que ya tienes

No empiezas desde una página en blanco.

**Archivos de diseño.** El trabajo terminado de Figma, Penpot, Illustrator, InDesign o cualquier aplicación SVG se abre en Design como un diseño vivo: el texto sigue siendo editable, las formas siguen siendo formas y las imágenes llegan a tu biblioteca. El archivo se lee en tu navegador y no se sube nada. [Import a design](/info/design-import.html) enumera cada formato y lo que se conserva.

**Decks.** Suelta un `.pptx` de PowerPoint en Lolly para archivar sus diapositivas como recursos, escribe un deck nuevo desde Markdown en **Markdown Slides**, o usa [Rebrand a deck](/info/rebrand.html) para pasar todo el deck a tu design system.

**Datos.** Pega o suelta una tabla CSV o JSON y los campos repetibles de una herramienta se rellenan con ella, o [Batch](/info/batch.html#make-many-versions-of-one-design) crea un archivo terminado por fila.

### De algo puntual a una plantilla

Un diseño importado es una sesión de Design normal. **Share with rules** lo convierte en una herramienta: tú eliges qué partes pueden cambiar otras personas, y ellas rellenan solo esas.

![Conserva el maestro de Design, elige entradas y límites en una copia de autoría, y luego comparte una herramienta .lolly reutilizable que los destinatarios rellenan](/info/diagrams/concepts/share-with-rules.svg)

[Share a design with rules](/info/create-a-tool.html) recorre cada paso.

## Crea muchos, comparte y automatiza

- <!--i:download--> **Exportar.** Las herramientas crean SVG, PDF, PNG, JPG, WebP, vídeo y más, en los formatos que ofrece cada herramienta, a tamaños reales de impresión cuando los necesitas. Consulta [Export a file](/info/exporting.html).
- <!--i:link--> **Compartir un enlace.** Los ajustes de una herramienta viajan en su enlace, así que el enlace reabre el mismo archivo en cualquier parte.
- <!--i:layers--> **Crear uno por fila.** Maneja una herramienta desde una hoja de cálculo en [Batch](/info/batch.html#make-many-versions-of-one-design).
- <!--i:cpu--> **Automatizar.** El mismo renderizado se ejecuta desde la [CLI](/info/cli.html) y desde un [agente de IA](/info/ai-agents.html).

Un enlace es una solicitud completa. Nadie dibujó el gráfico de abajo: su tipo, su título y toda su tabla de datos se escribieron en la barra de direcciones, y el mismo enlace dibuja el mismo gráfico en cualquier dispositivo.

![Un gráfico de área de altas mensuales, cuyos valores llegaron todos como parámetro de consulta en lugar de con un clic](/t/url-shot?url=%2F%23%2Ftool%2Fchart%3Fct%3Darea%26d%3DMonth%2CSignups%250AJan%2C120%250AFeb%2C180%250AMar%2C265%250AApr%2C340%250AMay%2C455%26t%3DSignups%2520this%2520year%26full&width=1440&height=900&dpi=192&waitMs=2600&cropSelector=%23tool-canvas&walker=1&format=svg&dark=1&filename=vt-d3-url-chart)

## A dónde ir ahora

- <!--i:people--> **[Create](/info/creators.html)**: crear, animar, grabar, compartir y exportar.
- <!--i:code--> **[Automate](/info/builders.html)**: design systems, creación de herramientas, la línea de comandos, enlaces y agentes.
- <!--i:usercheck--> **[Manage](/info/operators.html)**: operar Lolly para un equipo con Lolly Work.
- <!--i:server--> **[Deploy](/info/operate.html)**: alojar Lolly y Lolly Work.
- <!--i:shieldcheck--> **[Trust](/info/trust.html)**: privacidad, seguridad y cómo comprobar un archivo tú mismo.
