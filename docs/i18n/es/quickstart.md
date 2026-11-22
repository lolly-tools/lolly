# Empezar

Configura tus herramientas con tus propios colores y fuentes, y reutiliza el trabajo que ya tienes. No necesitas una cuenta, y la creación y la exportación se ejecutan en tu dispositivo.

::: steps
- <!--i:eti-sparkles--> **[Crea un archivo](/info/make-something.html)** Un código QR en pocos minutos, con cada paso explicado.
- <!--i:eti-palette--> **[Añade tu marca](#put-your-brand-in)** Empieza con un color, un archivo de tokens o un diseño terminado.
- <!--i:eti-folder-move--> **[Trae tu trabajo](#bring-in-what-you-already-have)** Diseños, decks y datos que ya tienes, leídos en tu dispositivo.
- <!--i:eti-repeat--> **[Crea más de lo mismo](#make-many-share-and-automate)** Comparte un enlace, rellena una hoja de cálculo o ejecuta la herramienta desde un script.
:::

[¿Qué es Lolly?](/info/what-is-lolly.html) es una introducción de cinco minutos. [Cómo funciona Lolly](/info/how-lolly-works.html) muestra quién hace qué.

<!--i:eti-palette-->
## Añade tu marca

lolly.tools se abre con **Lolly Demo**, el design system de ejemplo propio de Lolly ([Conoce Lolly Demo](/info/lolly-demo.html)). Tu design system sustituye a Lolly Demo. Es un pequeño conjunto de tokens de diseño (colores, fuentes y unas pocas reglas) con el que dibuja cada herramienta. Configúralo una vez y todo lo que crees empieza con el estilo de tu marca.

Elige la vía que encaje con lo que tienes:

- <!--i:palette--> **Un color.** Abre la vista **Design System Setup** (`#/start`), ponle un nombre a tu design system y elige un color primario. Lolly deriva una paleta accesible de ese color, con superficies claras y oscuras, texto y acentos. Elige una fuente y ya tienes una marca que puedes usar.
- <!--i:upload--> **Un archivo de tokens.** **Add from…**, en la parte superior de Lolly Design System Setup, acepta un archivo de tokens DTCG, Tokens Studio o Penpot, un SVG o un paquete `LollyBrand`. La paleta se rellena desde el archivo. Mientras el design system está vacío, **Start from a reference** en el Board abre el mismo selector.
- <!--i:pentool--> **Un diseño terminado.** En Lolly Design, elige **Import a design** y suelta un archivo de Figma, Penpot, Illustrator, InDesign, Affinity, Photoshop, PowerPoint o SVG ([todos los formatos](/info/design-import.html#what-comes-in-from-each-app)). Consulta [Trae lo que ya tienes](#bring-in-what-you-already-have) más abajo.

La primera vez que abres la galería, un saludo en la parte superior ofrece un siguiente paso. En lolly.tools, **Start making** abre Lolly Design con el póster Launch. En una instalación nueva, **Make it yours** abre Lolly Design System Setup. Debajo de ese botón, **Bring a file** abre un selector de archivos para un diseño, y la otra de esas dos opciones aparece como enlace. Cualquiera de ellas, o el botón de cerrar, oculta el saludo definitivamente.

![La sala Colours de Lolly Design System Setup en un design system nuevo: un chip en vivo, un campo y toda la primera decisión](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor&system=new-design-system&width=1440&height=740&dpi=192&waitMs=1800&format=svg&walker=1&dark=1&filename=bs-colours-new-system)

Ocho salas, que puedes usar en cualquier orden, permiten desarrollar el design system: **Board**, **Colours**, **Type**, **Logos**, **Tokens**, **Files**, **Rules** y **Skills**. Cada vista previa de la aplicación se actualiza mientras escribes. [Lolly Design System Setup](/info/brand-studio.html) explica cada sala.

Las fuentes se conservan en tu dispositivo. Una fuente de Google Fonts que eliges se almacena como recurso de marca, así que tu tipografía funciona sin conexión y no se descarga nada cuando una herramienta dibuja.

### Ver, cambiar y compartir un design system

- **Ver el activo.** **Settings → Design system** muestra el design system activo como una portada y páginas, en modo de solo lectura.
- **Cambiar entre ellos.** **Settings → Preferences → Design systems** enumera todos los design systems de este dispositivo. Una organización puede usar varios design systems o uno con varias colourways. [Arquitecturas de marca](/info/brand-architectures.html) describe las disposiciones.
- **Compartir uno.** Exporta el design system como un paquete `LollyBrand`: un archivo que un colega importa para obtener la misma paleta, fuentes y reglas.

Un design system que proporciona tu compilación o tu organización está **gestionado**: muestra un candado y se mantiene en modo de solo lectura. Para cambiarlo, crea una copia editable desde **Settings → Preferences → Design systems**.

![La pestaña Design system de Settings: el design system activo como portada y páginas](/t/url-shot?url=%2F%23%2Fd%3Ftab%3Dbrand&width=1440&height=900&dpi=192&waitMs=1800&format=svg&walker=1&localize=1&dark=1&filename=dashboard-brand&waitSelector=%5Bdata-issue-ready%5D)

Tu design system se compone de tokens DTCG, el formato que Penpot lee y escribe y que Tokens Studio lleva a Figma. La paleta con la que diseñas y la que aplica Lolly son un mismo documento. [Tokens de diseño](/info/design-tokens.html) explica los detalles.

::: details Para desarrolladores: crear un paquete de marca desde la línea de comandos
`ingest:brand` crea un paquete de marca reutilizable en una copia local del repositorio. Acepta los tres contenedores que exportan Penpot y Tokens Studio: un único `tokens.json`, un directorio de archivos por conjunto con `$metadata.json` o un archivo `project.penpot`.

```bash
pnpm run ingest:brand ./my-tokens.json --name acme --label "Acme" --activate
```

`--activate` registra la marca como perfil y crea y valida su catálogo. Nunca cambia el perfil predeterminado: ejecuta con `LOLLY_PROFILE=acme` para usar el nuevo paquete. [Configuración](/info/configuration.html) explica cómo encajan los paquetes de marca y los perfiles.
:::

<!--i:eti-folder-move-->
## Incorpora lo que ya tienes

**Archivos de Lolly Design.** El trabajo terminado en Figma, Penpot, Illustrator, InDesign o cualquier aplicación de SVG se abre en Lolly Design como un diseño editable. El texto se puede seguir modificando, las formas siguen siendo formas y las imágenes van a tu biblioteca. El archivo se lee en tu navegador y no se sube nada. [Importar un diseño](/info/design-import.html) enumera cada formato y lo que se conserva.

**Decks.** Suelta un PowerPoint `.pptx` sobre Lolly para guardar sus diapositivas como recursos. Crea un nuevo deck a partir de Markdown en **Lolly Markdown Slides**. [Adaptar un deck a tu marca](/info/rebrand.html) traslada un deck a tu design system.

**Datos.** Pega o suelta una tabla CSV o JSON para rellenar los campos repetibles de una herramienta. [Lolly Batch](/info/batch.html#make-many-versions-of-one-design) crea un archivo terminado por fila.

### De una pieza única a una plantilla

Un diseño importado es una sesión normal de Lolly Design. **Share with rules** convierte la sesión en una herramienta. Tú eliges qué partes pueden cambiar otras personas y ellas solo rellenan esas.

![Conserva el original de Lolly Design, elige entradas y límites en una copia de autoría y comparte una herramienta .lolly reutilizable que los destinatarios rellenan](/info/diagrams/concepts/share-with-rules.svg)

[Compartir un diseño con reglas](/info/create-a-tool.html) te guía por cada paso.

<!--i:eti-repeat-->
## Crear en cantidad, compartir y automatizar

- <!--i:download--> **Exportar.** Las herramientas crean SVG, PDF, PNG, JPG, WebP, vídeo y más, con tamaños reales de impresión cuando hace falta. Cada herramienta ofrece sus propios formatos. Consulta [Exportar un archivo](/info/exporting.html).
- <!--i:link--> **Compartir un enlace.** Los ajustes de una herramienta viajan en su enlace, así que el enlace vuelve a abrir el mismo archivo en cualquier lugar.
- <!--i:layers--> **Crear uno por fila.** Controla una herramienta desde una hoja de cálculo en [Lolly Batch](/info/batch.html#make-many-versions-of-one-design).
- <!--i:cpu--> **Automatizar.** El mismo renderizado se ejecuta desde la [CLI](/info/cli.html) y desde un [agente de IA](/info/ai-agents.html).

Un enlace es una petición completa. El tipo, el encabezado y la tabla de datos del gráfico de abajo se escribieron en la barra de direcciones.

![Un gráfico de barras de registros mensuales por canal con los colores del design system, en el que cada valor llegó como parámetro de consulta en lugar de mediante un clic](/t/url-shot?url=%2F%23%2Ftool%2Fchart%3Fct%3Dbar%26sty%3Dposter%26pl%3Droles%26transparentBg%3Dfalse%26d%3DMonth%2CWeb%2CApp%2CPartners%250AJan%2C120%2C60%2C25%250AFeb%2C180%2C95%2C40%250AMar%2C265%2C150%2C70%250AApr%2C340%2C210%2C110%250AMay%2C455%2C290%2C160%250AJun%2C560%2C380%2C230%26t%3DSignups%2520this%2520year%26st%3DBy%2520channel%252C%2520January%2520to%2520June%26full&width=1440&height=900&dpi=192&waitMs=4000&cropSelector=%23tool-canvas&walker=1&format=svg&dark=1&filename=vt-d3-url-chart)

<!--i:eti-map-pin-->
## Por dónde seguir

- <!--i:people--> **[Crear](/info/creators.html)**: crear, animar, grabar, compartir y exportar.
- <!--i:code--> **[Automatizar](/info/builders.html)**: design systems, creación de herramientas, línea de comandos, enlaces y agentes.
- <!--i:usercheck--> **[Gestionar](/info/operators.html)**: operar Lolly para un equipo con Lolly Work.
- <!--i:server--> **[Desplegar](/info/operate.html)**: alojar Lolly y Lolly Work.
- <!--i:shieldcheck--> **[Confiar](/info/trust.html)**: privacidad, seguridad y comprobación de archivos por tu cuenta.
