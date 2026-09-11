# FAQ

Preguntas frecuentes que se muestran en el acordeón de la página de inicio `/info`.

**Cómo mantenerlo:** cada encabezado `##` de abajo es una pregunta; todo lo que hay debajo
(hasta el siguiente `##`) es la respuesta. Las respuestas usan el mismo markdown ligero que
el resto del sitio - separa los párrafos con una línea en blanco. Añade, quita o
reordena preguntas aquí y vuelve a ejecutar `npm run build:info` (o `npm run dev:web`).
Todo lo que está por encima del primer `##` (este título y estas notas) lo ignora la compilación.

## ¿Qué pasa cuando activo la opción en la página /profile?

Cuando usas Lolly por primera vez, todo lo que escribes en cualquier sitio es totalmente privado hasta que decides deliberadamente sacar esa información al exterior mediante un medio o un enlace para compartir (si estás en línea).

Con la opción activada, los datos de perfil que elijas quedan sellados dentro de lo que creas, señalándote como la fuente. No se incluye nada que no hayas elegido tú.

Lolly produce un gran volumen de contenido. Aplicamos un enfoque estricto de minimización de datos para evitar riesgos.

## ¿Lolly fue "vibe coded"?

Lolly se desarrolló con programación asistida por IA, descubrimiento asistido por IA y, en muchos lugares, contenido asistido por IA, usando una combinación de modelos y proveedores, incluidos los de empresas punteras de la nube pública.

A fecha de esta redacción, Lolly no contiene ninguna vulnerabilidad de seguridad conocida en su cadena de suministro, y se compromete a aplicar prácticas de respuesta rápida en materia de seguridad en cuanto surgen CVEs.

Una persona creó la arquitectura, curó el código con intención y dirigió artísticamente la experiencia.

Y lo más importante, Lolly se apoya en los hombros de décadas de innovación de código abierto de verdaderos expertos de todo el mundo.

En el código base de Lolly existe una compuerta de compilación determinista que mantiene el código y la documentación coherentes para el lector medio y "desengrasa" la experiencia. Esto puede dificultar la enumeración sintética propietaria del origen. Eso no es intencionado.

**Divulgación sobre IA generativa:**

- **Código escrito por LLM:** Opus 4.8, Gemini 3.1, Qwen3-Coder-Next (esta lista puede ampliarse)
- **Descubrimiento por LLM:** Gemini 3.1, Fable
- **Documentación:** Sonnet 5
- **Bibliotecas de código abierto:** sus respectivos autores, indicados en el SBOM, los comentarios y las cabeceras de archivo

Esta lista no incluye los modelos integrados en Lolly.

**Contribución humana:**

- **Arquitectura:** Andy Fitzsimon
- **Dirección de arte:** Andy Fitzsimon
- **Código escrito por humanos:** Andy Fitzsimon
- **Ideación, revisión y comentarios:** Ravan Naidoo, Matthias Eckermann, Kelly Andrews, Ryan Kleeman, Peter Chamalian, la comunidad de Penpot (lista no exhaustiva)

## ¿Qué son los feature flags?

Los feature flags activan o desactivan partes de Lolly. Normalmente los controla un administrador - con Lolly, el control lo tienes tú.

![Cada feature flag es un interruptor tuyo, que vive en tu propio perfil y no en la consola de un administrador](/t/url-shot?url=%2F%23%2Fprofile%3Ffocus%3Dfeature-flags&width=1440&height=1800&dpi=192&waitMs=2000&format=svg&cropSelector=%23feature-flags-section&walker=1&dark=1&filename=pd-feature-flags)

## ¿Cómo consigo las apps de móvil o de escritorio?

Cualquiera puede distribuir sus propias apps, y las herramientas y la configuración de esas apps deberían variar mucho según el público al que se dirijan. Así que no hay una única app, salvo que la hayas hecho tú o te la dé alguien de tu entorno.

## ¿Por qué el nombre «Lolly Tools»?

**Lolly** porque la libertad es dulce y porque en Australia, Nueva Zelanda y Gran Bretaña una lolly es un caramelo.

**Tools** porque una herramienta está quieta hasta que la coges. No se ejecuta cuando no la usas y no te vigila mientras la usas.

## ¿Con qué obstáculos me puedo encontrar al adoptar Lolly?

Lolly encaja allí donde ya generas archivos - la CLI es el mismo motor
que la App, así que un pipeline lanzado a las 2 de la madrugada no puede desviarse de lo que una
persona previsualiza en un navegador. La fricción para adoptarlo rara vez es técnica; es organizativa. Cuenta con esto:

**Hay que crear un catálogo de marca curado.** Lolly es una plataforma, no un
paquete terminado con tus plantillas. Para un *despliegue gobernado*, alguien define el catálogo
compartido de recursos (logotipos, paletas, tipografías como IDs permanentes) y escribe el manifiesto +
la plantilla de cada tipo de salida. Aun así, nadie tiene que esperar a eso - en
la app abierta cualquiera puede incorporar sus propios archivos al catálogo y crear herramientas en
Design desde el primer día.

**No hace falta git para contribuir.** Los diseñadores crean sus propias herramientas y plantillas
en la app y luego las comparten con sus compañeros o las envían a quien gestione el
despliegue para que se incluyan por defecto.

**Es deliberadamente acotado - preséntalo así.** Lolly no sirve para contenido a medida ni
para piezas estrella. *Sí* es tu DAM personal - alimentado y potenciado por tu sistema
de diseño, tus herramientas y tu catálogo - y *sí* tiene un lienzo abierto (Design), pero
incluso ahí los colores, la tipografía y los recursos se ajustan a los globales de diseño activos, así que la
composición libre no se sale del sistema. Comparado con Figma o Canva parecerá
limitado. Visto por lo que es - generación de recursos operativa, recurrente y a gran escala -
no tiene competencia. Enmarcarlo mal es el tropiezo más habitual.

**Gestión del cambio en el lado de producción.** Los procesos actuales funcionan hoy, aunque
el resultado se salga de la marca. Reorientarlos hacia el motor implica volver a probar y volver a aprender,
y «ya sabemos hacer archivos» se convierte en la excusa para no migrar. Empieza por convertir
una salida de calidad de producción muy visible y enseña el antes y el después uno al lado del otro.

Lolly lo eleva todo.


## ¿En qué se diferencian las utilidades de las herramientas?

**Respuesta básica →** Las utilidades no siempre necesitan renderizar y por eso pueden tener otra UX. 

**Respuesta real →** Las utilidades se pueden alojar dentro de Lolly Tools para añadir una «capa de comodidad» más de defensa que desincentive la exfiltración de datos. 

¿Por qué? Porque se sabe que, cada día, la gente coge **contenido confidencial que ya tiene** y se lo entrega a una
página web cualquiera para hacer una pequeña operación mecánica:

- «**Comprime este PDF**» → sube un contrato / una nómina / una presentación de dirección a entidades desconocidas.
- «**convierte HEIC a JPG**» → sube fotos personales (con EXIF de GPS) a un servidor financiado con publicidad
- «**recorta / redimensiona esta imagen**» → sube una captura de un producto o un recurso sin publicar
- «**formatea este JSON**» / «descodifica este JWT» → pega respuestas de API, tokens y secretos en un formateador
- «**une estos PDF**» → sube **dos documentos que nunca deberían compartir servidor**

Estos sitios y su enorme cola de clones **no son de fiar por defecto**, con
retención desconocida, jurisdicciones desconocidas, subencargados desconocidos y un modelo de negocio
de publicidad y afiliación con todos los incentivos para quedarse con lo que les das. La operación es
trivial; el **coste es el contenido.** 

La guerra de la gobernanza se gana con una comodidad y un servicio excelentes. 

![La vista de utilidades reúne las tareas mecánicas que la gente suele encargar a una web cualquiera, ejecutándolas dentro de Lolly](/t/url-shot?url=%2F%23%2Fu&width=1440&height=900&dpi=192&waitMs=1600&css=.welcome-dialog%2C.personalize-nudge%7Bdisplay%3Anone!important%7D&tolerance=0.03&format=svg&walker=1&dark=1&filename=use-utilities&try=1)

## ¿Puede Lolly editar y renderizar mis archivos de Figma, Penpot, Illustrator o InDesign?

Sí. Abre **Design** y haz clic en **Import a design** (Importar un diseño): acepta un **.fig** nativo de Figma (Save local copy), una exportación **.penpot** de Penpot, un **.ai** o un **.pdf** de Illustrator, un **.idml** de InDesign (File → Export → InDesign Markup) o **cualquier SVG** (la puerta ancha - casi todas las apps de diseño lo exportan). No hace falta cuenta, ni plugin, ni licencia de una app de diseño.

![El lienzo abierto de Design - Importar un diseño está en el menú Lolly de la barra de herramientas](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Fz%3D17VVRa9swEP41ekyQLrbjPOyhVeeOrSsbG3lXbLkYZCnISmn264tO9irFhdJCoZQIpBNn9N2dvu_k3cOX1opeEuCTpeNkG0BDy8ljZe28pyDA74UlUC4WOyt0sxgOthW1JJAD9wv1y6rFQWCDMB6BAK-NdqLTBLg2thcqeAnk68vaKGOXg-yFdl29dPLBef8VAZ6V_qjUTloCvO-aRvlcc0QdhB58iCWDMVNnD1iSUIOcAvASY2qsEUeex-XSOEJ6koaT_6Q1iY89IY4mw4TCmmJYc9BNZKPQ00ywxxJS-BlqcnL2KfJF3xhZf3WdwwsMd8xZ4VEgEF6EGornaH-ByW_iHkVAj-aAtpcO7Y1R6kggX1Uz7ext1wt7PNEOk7BZ7UbtYCpKtj4NZ_YE-Doh_hOwHnff-1K_M83xlPmyiJhn8AbmL5C61nZSN8g00OlFoK2xkyjCRofOBro3g5N2OdPE2PqxIGjL1iCCIPA1SPSQpQ_B6qyIVyiCsp8s-_Gn2P76fpHfVlt6WV3_Lv5e5_6mul7cSVRFhiWhOIrsaaVTMbKZaUWNbQ-VMncGN__b_fwn-CAKeAQ&width=1360&height=850&dpi=192&waitMs=3000&format=png&localize=1&dark=1&filename=design)

Las capas llegan como cajas editables al lienzo abierto: el texto se sigue pudiendo reescribir, las formas siguen siendo formas, las imágenes pasan a tu propia biblioteca de imágenes y la tipografía y los colores se ajustan a los globales de la marca. Guárdalo y la maquetación se convierte en una plantilla reutilizable y direccionable por URL que cualquiera con Lolly puede volver a rellenar - y puedes mezclar herramientas vivas (un código QR, un gráfico) que se vuelven a renderizar al cargar. A partir de ahí se renderiza como todo lo demás en Lolly - SVG, PDF, PNG y el resto, reproducible desde su URL. Consulta [Importar un diseño](/info/design-import.html).

## ¿Puedo compartir mi trabajo como archivo en vez de como enlace?

Sí. Cuando un enlace no puede llevarlo todo (tus propias fotos, textos largos), el diálogo de compartir te dice exactamente qué se quedaría fuera y te ofrece un archivo **.lolly** en su lugar: un solo archivo con el diseño, las imágenes que usa y, si quieres, la propia herramienta. Tú decides cuánto viaja - tu nombre y tus datos solo se incluyen si tu perfil lo activa, el material con licencia se queda fuera salvo que lo incluyas, y a quien abra un archivo que lleva una herramienta se le pregunta si confía en ella antes de poder ejecutarla. Consulta [Compartir tu trabajo](/info/using.html#sharing-your-work).

## ¿Pueden dos personas trabajar en el mismo diseño sin internet?

Sí. Una persona comparte una invitación (un enlace, un código QR o un código corto), la otra la acepta y ambos dispositivos mantienen la misma sesión en vivo - con presencia, anillos de foco y todo. Funciona en cualquier red compartida, incluido el punto de acceso de un móvil en un sótano, porque no hay ningún servidor de por medio. Consulta [Trabajar juntos](/info/collaborate.html).

## ¿Dónde han quedado las herramientas con la marca SUSE?

Ya viven en un repositorio privado aparte. Un clon público no descarga el paquete de marca de SUSE, así que una compilación pública ejecuta el perfil neutro `lolly-start` - las herramientas comunitarias sin marca más una marca en blanco que rellenas con la tuya. SUSE opera su propia instancia para proteger sus marcas registradas.

## ¿Por qué es gratis? ¿Dónde está la trampa?

**Construimos Lolly para nosotros.** SUSE necesitaba miles de archivos acordes con la marca, cada uno con su nombre sellado dentro, hechos sin entregar nada a servicios externos. Así que construimos una herramienta que lo hace todo en el dispositivo y la publicamos como código abierto, igual que todo lo demás que hacemos. La seguimos manteniendo porque la usamos a diario. **No hay ninguna obligación:** todo esto funciona con nosotros o sin nosotros.

Esa línea está trazada en la licencia, no en una promesa: todo lo que se ejecuta en local es gratis, para siempre. Una versión ya publicada está licenciada de forma que no se puede retirar, y no existe ningún acuerdo de colaborador que pudiera relicenciar el trabajo de nadie. Consulta [posicionamiento](/info/positioning.html) para leer la declaración completa.

## ¿Cuánto se guarda SUSE en privado? (o sea, ¿cuándo llega el cambiazo?)

El motor, los shells, los esquemas y las herramientas sin marca son de código abierto; las marcas registradas de SUSE y sus herramientas de marca son la parte que se mantiene privada, y ya están separadas. La instancia pública en [lolly.tools](https://lolly.tools) funciona con la marca en blanco.

El límite es estructural, no prometido. Cada versión publicada es de código abierto y no se puede despublicar, no existe ningún acuerdo de colaborador que pudiera relicenciar el trabajo de nadie y lo único que se reserva es la marca registrada. Cuando otra empresa cerró las fuentes de su Linux empresarial en 2023, SUSE cofundó [OpenELA](https://openela.org) para mantener ese código abierto - la misma postura que hereda este proyecto.

Con total transparencia: SUSE *sí* está desarrollando herramientas internas para integrar Lolly en sus sistemas de TI - eso va de la infraestructura interna de SUSE, no de desarrollo público frente a privado. Lolly también aspira a compilarse mediante [Open Build Service](https://openbuildservice.org/), con artefactos de cadena de suministro seguros entregados por la [SUSE Application Collection](https://apps.rancher.io/applications).

## ¿De qué sabor es ese logotipo de Lolly?

Unos dicen que de lima, otros que de menta y a veces de manzana; Lolly pone el dulzor, ¡el sabor lo pones tú!
