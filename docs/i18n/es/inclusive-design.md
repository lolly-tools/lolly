# Política de diseño inclusivo de Lolly

*Última actualización: 30 de julio de 2026*

> **Nuestro ethos.** Una comunidad de código abierto nos incluye a todos. Un
> software que cualquiera puede leer, ejecutar y modificar solo se gana esa
> apertura cuando cualquiera puede realmente usarlo, sea lo que sea lo que ve,
> oye, procesa, habla o cree. Por eso tratamos cada adaptación como una forma de
> celebración, nunca como un compromiso: una preferencia que hace que Lolly sea
> más tranquila, más sonora, más grande o más familiar para alguien no es un
> modo degradado del producto. Es el producto, saliendo al encuentro de una
> persona más de nosotros allí donde está.

## Qué cubre esta política

Lolly es una herramienta creativa: la gente viene aquí a crear cosas que la
representan. Eso da forma a cada adaptación de abajo en un sentido muy concreto:
**ajustar la aplicación nunca ajusta tu trabajo**. Las preferencias de
accesibilidad reestilizan la propia interfaz de Lolly: menús, tarjetas,
navegación, tipografía. Están diseñadas para no llegar nunca al lienzo de la
herramienta ni a la canalización de exportación, y las pruebas automatizadas
hacen fallar nuestras builds si una preferencia pudiera mover un solo píxel de
un archivo exportado. Nunca deberías tener que elegir entre una aplicación
cómoda y un render fiel.

## Accesibilidad

![The Accessibility card on the profile page: four plain switches - Reduce motion, Hide colourful previews, High contrast and Large text - each with a help tip](/t/url-shot?url=%2F%23%2Fprofile&width=430&height=900&dpi=192&waitMs=2000&scrollDepth=1300&css=.welcome-dialog%2C.personalize-nudge%7Bdisplay%3Anone%7D&walker=1&format=svg&cropSelector=.profile-card--a11y&dark=1&filename=incl-a11y-card)

Además de seguir las señales de la propia plataforma (el modo oscuro del
sistema, la preferencia de movimiento reducido del sistema operativo), Lolly
incluye preferencias de accesibilidad explícitas y opcionales en tu perfil:

- <!--i:pause--> **Reducir movimiento** desactiva las transiciones, los
  deslizamientos y las florituras animadas de la aplicación, y se combina con
  (nunca anula) el ajuste de tu sistema operativo. Las exportaciones animadas
  siguen moviéndose exactamente como se diseñaron.
- <!--i:sunburst--> **Contraste alto** refuerza los bordes, el texto y los
  anillos de foco alrededor de tu trabajo. Los colores de tu marca y el lienzo
  se mantienen exactamente como los configuraste.
- <!--i:font--> **Texto grande** agranda la tipografía y los iconos de la
  aplicación sin recomponer tus diseños, así que lo que exportas es idéntico
  byte a byte.
- <!--i:eyeoff--> **Ocultar vistas previas coloridas** sustituye las
  ilustraciones de vista previa de la galería por tarjetas tranquilas de icono y
  texto, y suaviza las miniaturas de proyectos, reduciendo a la mitad su color y
  su contraste, para que sigan siendo reconocibles sin el ruido cromático. El
  color completo vuelve en cuanto entras en una herramienta, de modo que el
  único lugar donde aparecen imágenes de alto estímulo es el único lugar donde
  elegiste trabajar con ellas.

Junto a las preferencias: los controles llevan nombres accesibles y estados de
pulsado, los cambios se anuncian a los lectores de pantalla, los paneles
superpuestos se cierran con Escape, el foco de teclado es visible y se refuerza
aún más con contraste alto, y cada uno de estos interruptores es una tarjeta
sencilla y siempre visible en la página de perfil, localizable por alguien que
apenas puede leer la página tal como está, que es justo el momento en que
importa.

## Estimulación reducida y aumentada

![The Neurospicy player docked over the app: track title and transport, separate Music and Effects volumes, and the Atmosphere mixer with Wind, Birdsong and Crickets raised](/t/url-shot?url=%2F%23%2F%3Fneuro%3Dplayer&width=1440&height=1000&dpi=192&waitMs=3200&css=%5Bdata-dock-viz-slot%5D%7Bdisplay%3Anone%7D&format=svg&walker=1&cropSelector=%23neuro-dock&dark=1&filename=incl-neuro-player)

![The visualiser open over the app, painting the music as a full-motion field, with its own transport and volume controls](/t/url-shot?url=%2F%23%2F%3Fneuro%3Dviz&width=1440&height=900&dpi=96&waitMs=2000&waitSelector=.audio-dock%5Bdata-demo-settled%5D&walker=1&format=svg&cropSelector=.audio-dock&css=.audio-dock%20*%7Bbackdrop-filter%3Anone%21important%7D&dark=1&filename=incl-neuro-viz)

![A utility card on a phone-width screen: a calm icon and text tile that keeps its favourite, pin and info actions](/t/url-shot?url=%2F%23%2Fu&width=430&height=900&dpi=192&waitMs=2400&scrollDepth=900&css=.welcome-dialog%2C.personalize-nudge%7Bdisplay%3Anone%7D.gtile%7Bcontent-visibility%3Avisible%7D&format=svg&walker=1&cropSelector=.gtile--utility%5Bdata-tool-id%5D&dark=1&filename=incl-utility-card)

Las personas neurodivergentes no son una sola audiencia con una sola necesidad.
El mismo cerebro que un día difícil se siente abrumado por un muro de miniaturas
coloridas puede buscar un estímulo sensorial intenso otro día, así que Lolly se
adapta en ambas direcciones, siempre de forma opcional:

- <!--i:moon--> **Bajar la intensidad.** Reducir movimiento y Ocultar vistas
  previas coloridas reducen la interfaz a iconos, texto y un color de acento. La
  navegación queda libre de bullicio para personas con TDAH, personas autistas y
  personas disléxicas a quienes les cuesta escanear imágenes densas y de alta
  variación; nada de lo que necesitas (favoritos, anclado, acciones) desaparece
  en la presentación más tranquila.
- <!--i:neurobeat--> **Subir la intensidad.** El Modo Neurospicy es una capa
  sensorial deliberada, con bucles de concentración, un mezclador de atmósfera
  con fondos ambientales de nivel individual, música procedural y efectos de
  sonido de la interfaz, para quienes se concentran mejor con un estímulo rico.
  Está desactivado por defecto y nunca se reproduce solo antes de que lo pidas.
- <!--i:sliders--> **El sonido es separable.** Cada capa audible tiene su propio
  interruptor, así que "visuales tranquilos, sonido rico" y su inverso son
  configuraciones reales, no un único paquete de accesibilidad que otra persona
  compuso por ti.

## Prioridad de idiomas y localización

![The appearance settings rendered in Arabic on a phone-width screen: a fully right-to-left layout, not a mirrored afterthought](/t/url-shot?url=%2F%23%2Fprofile%3Flang%3Dar&width=430&height=900&dpi=192&waitMs=2200&scrollDepth=950&css=.welcome-dialog%2C.personalize-nudge%7Bdisplay%3Anone%7D&walker=1&format=svg&cropSelector=.profile-card--appearance&dark=1&filename=incl-profile-rtl)

- <!--i:globe--> La interfaz y la documentación de Lolly están traducidas a más
  de 25 idiomas, y **priorizamos los idiomas por cuántas personas los hablan**,
  no por los ingresos de mercado: el hindi, el bengalí, el urdu y el indonesio
  llegaron en las mismas oleadas que el francés y el alemán.
- <!--i:convert--> Las escrituras de derecha a izquierda son de primera clase:
  el árabe llega con un diseño RTL completo, no como un reflejo hecho a
  posteriori.
- <!--i:layers--> Los idiomas son distintos, no intercambiables: el indonesio y
  el malayo son catálogos separados, el chino tradicional y el simplificado son
  catálogos separados, y el atributo de idioma se establece antes del primer
  pintado para que los caracteres Han y las alternativas de escritura se
  muestren correctamente para tu idioma, no para uno parecido.
- <!--i:checklist--> El menú de idiomas muestra cada idioma en su propio nombre
  y escritura, y puede ordenarse por población de hablantes, así que encontrar
  el tuyo nunca exige conocer su nombre en inglés.

## Inclusión cultural

- <!--i:palette--> La marca neutral de partida no asume nada sobre quién eres;
  Lolly existe para que tu propia identidad, paleta y tipografía sustituyan a
  las nuestras en minutos.
- <!--i:pentool--> La tipografía se trata como una superficie cultural: las
  fuentes subidas y las de Google se modelan con conformado de texto correcto en
  todas las escrituras, para que los nombres, los diacríticos y el texto no
  latino se exporten como contornos bien dibujados y no como tofu o
  sustituciones.
- <!--i:people--> Los textos evitan modismos y referencias culturales que se
  traducen mal, y los traductores reciben cadenas limpias y desnudas, no frases
  con fragmentos de marcado incrustados.

## Compromisos éticos

- <!--i:lock--> **Privacidad por arquitectura.** Tu trabajo se queda en tu
  dispositivo. No hay rastreadores ni analíticas en el código, y los pocos
  puntos de contacto de red están enumerados en la
  [Política de privacidad](/info/privacy.html). Las preferencias de
  accesibilidad e idioma se guardan en tu propio perfil, en tu dispositivo: una
  discapacidad o un idioma nunca son telemetría.
- <!--i:shieldcheck--> **Procedencia honesta.** Las exportaciones pueden llevar
  Content Credentials, y el contenido generado por IA se etiqueta como tal.
  Creemos que las audiencias merecen saber cómo se hizo un contenido, y que los
  creadores merecen herramientas capaces de demostrar que su trabajo es suyo.
- <!--i:check--> **Sin patrones oscuros.** Las preferencias son interruptores
  sencillos que hacen lo que dicen, los ajustes por defecto permanecen inactivos
  hasta que los eliges, y las convenciones de la plataforma (desplazamiento
  nativo, atajos del navegador, diálogos estándar) se respetan en lugar de
  secuestrarse.
- <!--i:code--> **Código abierto.** El motor, los shells y las herramientas
  comunitarias son públicos. Cada afirmación de este documento puede comprobarse
  en el código fuente, y varias se hacen cumplir mediante pruebas que hacen
  fallar la build cuando se rompen: la regla de aditividad por defecto para los
  atributos de accesibilidad, la prohibición de que las preferencias lleguen a
  las exportaciones, y la sincronía de las dos copias que la aplicación guarda
  de cada preferencia.

## Cómo nos lo exigimos

El diseño inclusivo es aquí una política en el sentido de la ingeniería:
invariantes con pruebas, no aspiraciones con adjetivos. Cuando una adaptación y
una funcionalidad entran en conflicto, rediseñamos la funcionalidad (cuando un
ajuste de "ocultar vistas previas" también ocultaba los iconos de acción de las
tarjetas de utilidades, la solución fue conservar las acciones, no excusar la
pérdida). Si algo en Lolly te excluye, un idioma que falta, un momento
abrumador, una suposición que incorporamos sin darnos cuenta, eso es un bug.
Cuéntanoslo: [fitzy@suse.com](mailto:fitzy@suse.com).
