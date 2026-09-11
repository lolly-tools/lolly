# Guía rápida

Lolly convierte tus reglas - colores, tipografía, diseños, lógica - en herramientas que cualquiera puede usar para crear archivos terminados: imágenes, PDF, tarjetas para redes sociales, vídeo, rellenando unos pocos campos. Hay poco que aprender y nada que subir: crear y exportar ocurre en tu dispositivo, con o sin conexión.

Esta es la primera página que conviene leer. Dos cosas te hacen productivo: **haz que Lolly sea tuya** y **aprovecha lo que ya tienes** (tus archivos de diseño y tus tokens). Todo lo demás está a un enlace de distancia.

> ¿Eres nuevo en Lolly y solo quieres crear algo? [Crea algo en 60 segundos](/info/make-something.html) te guía por tres, o [abre la app](/#/), elige cualquier herramienta de la galería, rellena los campos y pulsa **Exportar**. Vuelve aquí cuando quieras que lleve *tu* marca.

![La vista Utilidades - las herramientas de trabajo que corren en tu dispositivo, como Strip Hidden Data, Compress PDF y Convert Image, todas en un mismo sitio](/t/url-shot?url=%2F%23%2Fu&width=1440&height=900&dpi=192&waitMs=1600&css=.welcome-dialog%2C.personalize-nudge%7Bdisplay%3Anone!important%7D&tolerance=0.03&format=svg&walker=1&dark=1&filename=use-utilities&try=1)

## 1. Hazlo tuyo - configura tu sistema de diseño

Tu marca en Lolly es un pequeño documento de **tokens de diseño** - colores, tipografías y algunas reglas - contra el que se renderiza cada herramienta. Configúralo una vez y todo lo que crees respetará tu marca por construcción, no por revisión. Hay tres formas de empezar; elige la que encaje con dónde vive ya tu marca.

### Empezar desde cero (el constructor del sistema de diseño)

La primera vez que la abres aterrizas en la **galería**, con un breve diálogo de bienvenida encima que ofrece tres formas de empezar - **Hazlo tuyo** (el Brand Studio, en `#/start`), **Trae tu diseño** (suelta un archivo de Figma, Penpot, InDesign o PDF y se abre como una maquetación editable - la vía más rápida a [Aprovecha lo que ya tienes](#2-bring-in-what-you-already-have), más abajo) y **Explorar las herramientas de la comunidad** - además de una fila de idiomas si el inglés no es el tuyo. Elige la primera tarjeta y aterrizas en el [**Brand Studio**](/info/brand-studio.html). Dale un nombre y un color primario, y Lolly *deriva* de él una paleta completa y accesible - superficies claras/oscuras, texto, acentos - con las mismas matemáticas de color que el motor usa en todo lo demás.

![La sala Colores del Brand Studio - un color primario y la paleta accesible que Lolly deriva de él](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor&width=1440&height=740&dpi=192&waitMs=1800&format=svg&walker=1&localize=1&dark=1&filename=brand-colours) Elige una tipografía y tendrás una marca funcional en menos de un minuto. A partir de ahí, las seis salas del estudio - Resumen, Colores, Tipografía, Logotipos, Tokens, Archivos - te dejan llevarla tan lejos como quieras, en el orden que quieras, y refinar cualquier parte cuando vuelvas. La pestaña **Sistema de diseño** del panel (`#/d`) muestra el resultado en solo lectura y remite a `#/start`, que es donde se edita (salvo que estés en una build de Lolly con la marca bloqueada, donde la marca es fija y no hay nada que cambiar).

### Importar una marca que ya tienes

Si tu marca ya está capturada como tokens de diseño - desde **Penpot**, **Tokens Studio** (Figma) o cualquier archivo **DTCG** plano - tráela entera en lugar de volver a escribirla. Dos vías:

- <!--i:palette--> **En la app:** el [constructor del sistema de diseño: Brand Studio](/info/brand-studio.html) (`#/start`) la acepta desde **Add from…** (Añadir desde…), al pie de su barra de salas - un archivo de tokens, una exportación de Penpot, un SVG o un paquete `LollyBrand`. Suéltalo y la paleta se enciende.
- <!--i:code--> **Desde la línea de comandos**, para crear un paquete de marca reutilizable:

```bash
# a monolithic tokens.json, a one-file-per-set directory, or a Penpot project archive
npm run ingest:brand -- ./my-tokens.json --name acme --label "Acme" --activate
```

`ingest:brand` acepta los tres contenedores en los que Penpot / Tokens Studio exportan el mismo documento: un único `tokens.json`, un directorio (`$metadata.json` + archivos por conjunto) o un archivo `project.penpot`. Con `--activate` registra la marca como perfil, cambia a ella y reconstruye el catálogo. Consulta [Configuración](/info/configuration.html) para ver cómo encajan los paquetes de marca y los perfiles.

### Ajústala en la app

Una vez activa una marca, sigue dándole forma en el [**Brand Studio**](/info/brand-studio.html) (`#/start`) - cambia un color o un rol y cada vista previa de la app se actualiza mientras escribes. (La pestaña **Sistema de diseño** del panel, en `#/d`, *muestra* la marca en solo lectura; el estudio es donde la editas.)

![La pestaña Sistema de diseño del panel - la marca activa mostrada en solo lectura](/t/url-shot?url=%2F%23%2Fd%3Ftab%3Dbrand&width=1440&height=900&dpi=192&waitMs=1800&format=svg&walker=1&localize=1&dark=1&filename=dashboard-brand) La misma marca se resume en la tarjeta **Perfil → Tu marca**. Las tipografías son reales: elige entre Google Fonts y Lolly guarda el archivo **en tu dispositivo** como recurso de marca, así que tu tipografía viaja sin conexión y nada se descarga en el momento de renderizar.

Cuando estés satisfecho, **exporta la marca como paquete `LollyBrand`** - un único archivo que un compañero puede importar para obtener exactamente la misma paleta, tipografías y reglas. Así es como una marca viaja entre personas y máquinas sin un servidor de por medio.

> **Los tokens de marca van y vienen en ambos sentidos.** Como la marca de Lolly *es* tokens DTCG - el formato que Penpot lee y escribe de forma nativa y que Tokens Studio lleva a Figma - la paleta con la que *diseñas* y la paleta que Lolly *aplica* son un mismo documento, no dos listas que mantienes sincronizadas a mano. Consulta [Tokens de diseño](/info/design-tokens.html).

## 2. Aprovecha lo que ya tienes

No partes de una página en blanco. Lolly abre el trabajo de diseño y los formatos abiertos que ya tienes.

### Archivos de diseño de código abierto

El trabajo terminado en **Figma, Penpot, Illustrator, InDesign o cualquier app de SVG** no tiene por qué quedarse encerrado en la app donde lo dibujaste. Abre **Design**, haz clic en **Importar un diseño** y el archivo se abre como una *maquetación viva* - no una imagen aplanada. Cada capa se convierte en una caja editable: el texto se puede volver a escribir, las formas siguen siendo formas, las imágenes llegan a tu biblioteca y el arte vectorial complejo se conserva fielmente. Llega ya adaptado a tus tipografías y reglas de color de marca.

| Si tienes | Impórtalo como |
|---|---|
| Un frame de Figma | `.fig` nativo (Archivo → Guardar copia local), o una exportación SVG |
| Un diseño de Penpot | Su exportación `.penpot`, o cualquier SVG |
| Un archivo de Illustrator | `.ai` nativo (compatible con PDF) o `.pdf` - se abre directamente |
| Un diseño de InDesign | `.idml` (Archivo → Exportar → InDesign Markup) |
| Cualquier otra cosa | **Cualquier SVG** - la puerta universal de entrada |

Toda la importación ocurre **en tu dispositivo** - el archivo se analiza en tu navegador y nada se sube. Los detalles completos y qué se conserva exactamente están en [Importar un diseño](/info/design-import.html).

¿Lo que tienes es una **presentación de PowerPoint**? Suelta el `.pptx` en **Deck Builder** para editarla diapositiva a diapositiva, ya ajustada a tu marca - o usa **Rebrand a Deck** para recuperar la misma presentación con tu tema aplicado, con los gráficos y las animaciones intactos.

### De algo puntual a una plantilla

Aquí está la recompensa: una maquetación importada es una sesión normal de Design, así que en cuanto la **guardas**, vive en una URL. Cualquiera con Lolly puede abrir esa URL, cambiar el texto, sustituir una imagen y renderizar su propia versión - sin app de diseño, y las partes bloqueadas siguen bloqueadas. Un diseño puntual se convierte en una herramienta reutilizable. Esa es toda la idea, y se llega ahí sin escribir ni una línea de configuración.

### Datos abiertos y herramientas abiertas

El [conjunto de herramientas de la comunidad](/info/builders.html) es de código abierto y agnóstico de marca - códigos QR, mapas de calles, filtros, utilidades de privacidad - y se renderiza contra *tu* marca en cuanto la activas.

Alimenta las herramientas también con tus propios datos abiertos: pega o suelta una tabla **CSV** o **JSON** y los campos repetibles de una herramienta se rellenan a partir de ella, un recurso terminado por fila.

## 3. Crea algo, y luego compártelo o automatízalo

Con una marca activa y tu material a mano, cada herramienta produce un archivo terminado:

- <!--i:download--> **Renderiza** cualquier herramienta a **SVG, PDF, PNG, JPG, WebP, vídeo** y más - a tamaños de impresión reales y en unidades físicas cuando lo necesites. Consulta [Exportación y formatos](/info/exporting.html).
- <!--i:link--> **Comparte un enlace.** Cada estado de una herramienta es una URL, así que un recurso terminado es reproducible y direccionable por parámetros - guarda el enlace, regenera cuando quieras.
- <!--i:layers--> **Hazlo en lote.** Alimenta una plantilla desde una hoja de cálculo en la [cuadrícula por lotes](/info/exporting.html): un recurso terminado por fila.
- <!--i:cpu--> **Automatízalo.** El mismo renderizado se ejecuta desde la [CLI](/info/cli.html) y desde un [agente de IA](/info/ai-agents.html) - una URL es la API.

"Una URL es la API" es literal. El gráfico de abajo no lo dibujó nadie: su tipo, su título y toda su tabla de datos se escribieron en la barra de direcciones, y el mismo enlace renderiza el mismo gráfico en cualquier dispositivo.

![Un gráfico de área de altas mensuales, cuyos valores llegaron todos como parámetro de consulta en lugar de con un clic](/t/url-shot?url=%2F%23%2Ftool%2Fchart%3Fct%3Darea%26d%3DMonth%2CSignups%250AJan%2C120%250AFeb%2C180%250AMar%2C265%250AApr%2C340%250AMay%2C455%26t%3DSignups%2520this%2520year%26full&width=1440&height=900&dpi=192&waitMs=2600&cropSelector=%23tool-canvas&walker=1&format=svg&dark=1&filename=vt-d3-url-chart)

## A dónde ir ahora

Tres caminos, según lo que hayas venido a hacer:

- <!--i:people--> **[Lolly para creadores](/info/creators.html)** - creas cosas. Las ventajas y cómo sacarle el máximo partido a la app.
- <!--i:code--> **[Lolly para desarrolladores](/info/builders.html)** - creas herramientas, integras y despliegas. La documentación técnica.
- <!--i:shieldcheck--> **[Lolly para operadores](/info/operators.html)** - eres responsable de la marca, la seguridad y el despliegue en una organización.
