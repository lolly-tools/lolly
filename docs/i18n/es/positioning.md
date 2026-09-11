# Cómo se compara Lolly

Lo que Lolly hace que las herramientas creativas actuales no hacen, y lo que deja deliberadamente en sus manos.

Para la versión herramienta por herramienta, una página cada una para Canva, Adobe, Figma, las APIs de renderizado y los conversores en línea, ver [Lolly comparada, herramienta por herramienta](/info/compare.html). Cada página indica qué hace mejor la otra herramienta y qué hace Lolly en su lugar.

> **Estado del piloto:** Lolly es un prototipo de piloto cerrado, no un producto terminado, y su seguridad está actualmente sometida al estricto endurecimiento de infraestructura de SUSE, preparándose para la escala empresarial. La página [Adoption & Governance](/info/adoption-governance.html#status) cubre el estado actual.

## Las herramientas de hoy

Cada anillo de abajo puntúa cuán completamente entrega una capacidad una clase de producto **tal como se publica hoy** - no como se anuncia -, con cada clase puntuada según su mejor representante. Lolly se puntúa con el mismo criterio: se lleva el único anillo rojo del tablero, por madurez. Abre el nombre de una fila para ver el razonamiento tras sus puntuaciones. Las columnas están ordenadas por la fila de completitud general de arriba - la media de las filas puntuadas, excluida la fila de gasto.

::: figure positioning-comparison
Integridad de capacidades entre las herramientas creativas actuales, investigado en agosto de 2026. Puntuación: 0 ausente, 25 nivel workaround, 50 real pero limitado o parcial, 75 sólido con salvedades, 100 competencia central.
:::

**Notas de puntuación.** Las puntuaciones de Lolly asumen que sus afirmaciones publicadas se sostienen, por eso madurez es su único anillo rojo: piloto cerrado, endurecimiento de seguridad en curso, nada auditado todavía. La investigación movió varias celdas.

Canva se puntúa según el mejor miembro de su familia por fila, ya que posee Affinity y Cavalry (ambas regaladas en octubre de 2025). El renderizado sin conexión y en el dispositivo puntúa 75 a través de Affinity - una suite de escritorio que aún necesita una cuenta verificada y conlleva telemetría, la misma deducción que también se aplica a Adobe -, mientras que el propio modo sin conexión de Canva solo edita diseños ya sincronizados, en un dispositivo, con una ventana limitada. El autorrelleno puntúa 50: real pero restringido a Enterprise, asíncrono, solo texto e imagen. La generación masiva de Figma subió de 25 a 50 cuando Buzz lanzó el relleno de hojas de cálculo (beta gratuita, agosto de 2026).

Una sola regla rige el tablero: Full (100), en filas que tocan tu contenido o tu identidad, necesita una capacidad que puedas usar sin cuenta y sin condición previa de nube; las filas que describen el producto en sí (madurez, facilidad de uso) están exentas. Le cuesta puntos a Adobe en procedencia: el C2PA más amplio publicado (Photoshop, Lightroom, Premiere, Firefly) firma localmente y en la nube, pero nunca sin una cuenta e identidad de Adobe, de ahí 75. Limita a las APIs de renderizado en generación masiva y automatización por el mismo motivo.

Los 75 puntos de procedencia de Lolly reflejan la firma sin conexión en el dispositivo: arquitectónicamente más sólida pero sin auditar, y una clave de dispositivo se lee como no verificada en los validadores estándar hasta que una identidad o la CA propia de una organización la avale. Los 50 de Penpot llegan a través del plugin oficial Lolly Export: la misma firma del engine, opcional, declarada como propia de Lolly. Penpot también se lleva el único anillo fuera de escala del tablero, 90 en renderizado en el dispositivo - canvas del navegador, guardado en tu propia nube soberana (incluso un portátil), exportación privada; solo el salto al servidor lo separa de Lolly. Cloudinary tiene su propia columna: un pipeline de medios (DAM, API de transformación, CDN), y la única columna en la nube que publica C2PA (50, porque fl_c2pa firma en la entrega, atestiguando entregado-por-Cloudinary, no hecho-por-ti).

La colaboración en vivo funciona al revés: Figma marca el punto de referencia de escala (200 editores) y el P2P por pares, aislado de la red, de Lolly puntúa Parcial. El precio es una estimación, etiquetada como tal: aritmética de precio de lista sobre combinaciones de asientos realistas, deliberadamente amplia, para escala, no para adquisición. Las APIs de renderizado se llevan 75 en restricciones: plantillas fijas, sin capa de gobernanza de marca.

La brecha: nada de lo que se publica hoy es primero-restricciones y sin conexión, sin cuenta y sin servidor en la ruta de renderizado, y nadie ha copiado la cláusula de cuenta. Lolly ya publica su propio canvas abierto - **Design**, un canvas libre de manipulación directa -, pero los colores, la tipografía y los recursos en él se ajustan a los globales de marca, así que incluso la disposición libre sigue siendo primero-restricciones.

Lo que Lolly todavía **no** es es una suite de diseño sin restricciones; los diseñadores seguirán usando Illustrator y Figma para trabajo a medida - y cuando ese trabajo necesite convertirse en un activo gobernado y reproducible, la función [Import a design](/info/design-import.html) de la herramienta Design trae el archivo terminado de Figma, Penpot, Illustrator, InDesign o PDF al canvas como cajas editables y conformadas a la marca.

![El lienzo libre de Design, donde los colores, las tipografías y los recursos disponibles son los de la propia marca](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Ftemplate%3D__blank__&width=1440&height=900&dpi=192&waitMs=2400&walker=1&format=svg&dark=1&filename=aud-open-canvas)

## Para qué usarlo

- Generación rápida de recursos creativos operacionalizados (tiles de eventos, badges, firmas, alertas)
- Composición libre en el lienzo abierto (Design) cuando las piezas - colores, tipografía, iconos, imágenes - deben mantenerse conformes a los globales de marca
- Importar un diseño terminado de Figma, Penpot, Illustrator, InDesign o PDF (la función Importar un diseño de la herramienta Design) para poder editarlo, gobernarlo y volver a renderizarlo de forma determinista en cualquier formato de Lolly
- Flujos de "rellena tres campos, obtén el recurso terminado" de uno a muchos - incluidas ejecuciones masivas desde una hoja de cálculo/CSV en la cuadrícula de lotes `/pro` (pega o importa filas, un recurso terminado por fila, descarga como zip)
- Salidas de marca recurrentes y siempre activas
- Casos donde el control central de la expresión de marca importa más que la flexibilidad expresiva

Deck Studio es una buena medida del techo aquí: toda una presentación de diapositivas declarada como datos, maquetada en vivo en el lienzo y exportada como un PowerPoint nativo editable.

![Deck Studio en la vista dividida - las diapositivas de la presentación listadas como bloques a la izquierda, el renderizado maquetado de la presentación a la derecha](/t/url-shot?url=%2F%23%2Ftool%2Fdeck-studio&width=1440&height=900&dpi=192&waitMs=2600&walker=1&format=svg&dark=1&filename=ov2-deck-studio-output)

## Para qué no usarlo

- Contenido destacado a medida o insignia (vallas publicitarias, vídeos principales)
- Trabajo de campaña único que realmente necesita un diseñador
- Ideación que necesita escapar del sistema de marca por completo - el lienzo abierto de Lolly sigue conformando colores, tipografía y recursos a los globales de marca, y ese es precisamente el punto

## Innovar de forma probabilística, escalar de forma determinista

La mayoría de los discursos de "creatividad con IA" colocan al modelo en el lado equivocado de una línea antigua. Los copistas e iluminadores ya resolvieron dónde cae esa línea: trabajas con soltura en el boceto, donde se puede probar cualquier cosa y nada queda comprometido, y luego pasas a la imprenta, que resulta intimidante precisamente porque compromete. Los bocetos eran donde estaba el arte. La imprenta era cómo viajaba. Dos instrumentos, dos funciones, cada uno inventivo a su manera, y la obra impresa merecía confianza porque la imprenta cumplía su promesa en cada tirada.

Lolly es la imprenta, no el boceto. Trae lo que quieras a la ideación - un modelo, un diseñador, una servilleta - pero en el momento en que una idea tiene que convertirse en diez mil recursos, pasa por algo que se renderiza igual cada vez, a partir de entradas que cualquiera puede leer después. De eso trata realmente la comparación anterior: no de quién tiene el mejor generador, sino de quién hace reproducible el paso comprometido.

> Confía en el proceso creativo, escala con rigor.

## Aprueba la herramienta, no el archivo

Cualquier otra herramienta del panorama produce un *archivo* que luego hay que revisar - un responsable de marca en un hilo de Slack, legal revisando el descargo de responsabilidad, una ronda de cambios, otra revisión. Lolly mueve la aprobación **un paso hacia arriba**. Las reglas de marca - códigos hexadecimales exactos, archivos de fuentes con licencia, márgenes de sangrado, espaciados - están codificadas en el HTML y el CSS de la herramienta, de modo que la plantilla *no puede* generar un recurso fuera de marca. Es la propia maqueta la que hace cumplir las reglas.

Así que dejas de aprobar salidas y empiezas a aprobar la **herramienta** que las produce. Apruébala una vez, y cada recurso que produzca a partir de entonces queda preaprobado por construcción - sin humano en el bucle, sin ciclo de revisión, a cualquier volumen.

Este es el cambio que realmente aporta el motor determinista: no es una versión más rápida del antiguo proceso de aprobación, elimina el proceso. Para el equipo creativo es una barandilla de seguridad, no un reemplazo - sigues lanzando la bola (los datos, el texto, la imagen) y el código es el carril con topes que mantiene cada lanzamiento fuera de la canaleta.

![Todo el trabajo del productor: escribir las palabras. La tipografía, el color y el espaciado quedaron fijados cuando se aprobó la herramienta](/t/url-shot?url=%2F%23%2Ftool%2Fwordmark%3Ftext%3DApproved&width=1440&height=900&dpi=192&waitMs=2000&walker=1&format=svg&dark=1&filename=aud-approve-the-tool)

| Aprobar recursos a la manera antigua | Aprobar la herramienta, a la manera de Lolly |
|---|---|
| Cada archivo terminado se revisa, uno a uno | La herramienta se revisa una vez |
| Solicitud → el diseñador la construye → revisión de marca → revisión legal → cambios → nueva revisión | Un cambio de parámetro → recurso terminado |
| Diseñador, responsable de marca, legal y solicitante, todos en el bucle | El productor, por su cuenta |
| Días por recurso | Segundos por recurso |
| 10.000 recursos = 10.000 ciclos de revisión | 10.000 recursos = cero (la plantilla ya estaba aprobada) |

## Lo que esto aporta de forma única

- **Potencial de diseño arriesgado entregado de forma segura en su contexto.** Las herramientas pueden expresar ideas de diseño audaces dentro de barandillas de seguridad codificadas.

- **Automatización de contenido definida por software que devuelve el recurso final.** Entrada → archivo final. Nada de "ahora guárdalo desde tu herramienta de diseño y procésalo después".
- **Las herramientas componen herramientas.** Una herramienta puede incrustar el renderizado de otra herramienta y devolverlo como parte de un único recurso terminado, sin acoplamiento de código entre herramientas - una primitiva que ningún producto de lienzo abierto o plantillado de DAM ofrece en el panorama.
- **Neutralidad de proveedor.** Control total de funciones y costes. Motor de código abierto. Las herramientas y los recursos son contenido rastreado con git, no atrapados en una base de datos SaaS.

El primero de esos puntos es el que la gente subestima. Un mapa de ciudad de calidad de póster, dibujado como rutas de carreteras y agua realmente vectoriales, a partir de un desplegable y dos campos de color que no se pueden dirigir fuera de la marca:

![Los anillos de canales y la red de calles de Ámsterdam dibujados de borde a borde con la propia tinta de la marca, cada trazo colocado por la plantilla y no a mano](/t/url-shot?url=%2F%23%2Ftool%2Fstreet-map%3Fcity%3Damsterdam%26theme%3Dlight%26full&width=1440&height=900&dpi=96&waitMs=3200&walker=1&format=svg&cropSelector=%23tool-canvas&dark=1&filename=ov2-street-map-poster)

## Soberanía del contenido

Hay un nombre para lo que suma la sección anterior: soberanía. Tu flujo de medios se ejecuta en hardware que posees. Tu marca - los tokens, las fuentes, los logotipos, las herramientas que los hacen cumplir - vive en archivos que tienes en tu poder, en un control de versiones que tú controlas, no en la base de datos de un proveedor con un botón de exportación. El renderizado ocurre en el dispositivo que tienes delante, así que un recurso nunca transita por un tercero para existir, y toda la ruta desde la entrada hasta el archivo terminado es de código abierto e inspeccionable. Si mañana desaparecieran todos los proveedores SaaS de diseño, una implementación de Lolly ni se enteraría.

Esto importa a cualquiera cuyo trabajo deba sobrevivir a una suscripción: tanto al padre o madre cuyo álbum de fotos vive en ese portátil como al organismo público cuya biblioteca de marca está sujeta a normas de contratación pública. Para las organizaciones - organismos públicos, sectores regulados, cualquiera cuya marca sea un activo estratégico y no una decoración - "dónde vive nuestro contenido y quién puede apagarlo" es una cuestión de gobernanza, no una preferencia. Aquí la soberanía es una propiedad de la arquitectura y no una función de alojamiento añadida por cumplimiento normativo, y las páginas de [Política de privacidad](/info/privacy.html) y [Verifícalo tú mismo](/info/verify-yourself.html) existen para que puedas comprobar esa afirmación en lugar de creerla.

Debajo de todo esto hay una promesa, planteada como compromiso y no como función: **si se renderiza en tu dispositivo, es gratis para siempre.** El motor, las shells, las herramientas, los formatos - toda la ruta creativa en el dispositivo es de código abierto y lo seguirá siendo. Esa promesa tiene un mecanismo: una versión que ya se ha publicado está licenciada de modo que no se puede retirar, y no existe ningún acuerdo de colaborador que pudiera volver a licenciar el trabajo más adelante. Todo el límite cabe en una frase: todo lo que se renderiza en tu dispositivo es gratis y de código abierto, para siempre; coordinar personas y máquinas a través de una red es el trabajo de un plano de control separado, [lolly.work](https://lolly.work).
