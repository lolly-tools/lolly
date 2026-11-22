# Fuentes de respaldo

Cuando las fuentes de un design system no pueden dibujar una letra, Lolly la dibuja con una fuente abierta de Noto, para que la exportación conserve la letra como contorno vectorial en lugar de imagen. Las fuentes de Lolly Demo, Outfit para encabezados y SUSE para texto, no tienen letras cirílicas, griegas, árabes, hebreas, devanagari, bengalíes, tailandesas, chinas, japonesas ni coreanas.

Las fuentes del design system siempre van primero, en el orden en que se enumeran. Outfit no tiene letras vietnamitas, así que un encabezado en vietnamita las toma de SUSE, la siguiente fuente en la lista de Lolly Demo. Una fuente de respaldo dibuja solo los caracteres que ninguna de esas fuentes puede dibujar. Una fuente de marca conserva cada letra, dígito y signo que tiene, incluidos los caracteres chinos, incluso dentro de una palabra en otra escritura.

<!--i:eti-package-->
## Qué se incluye

Quince fuentes, todas de Google Fonts en un commit fijado. Cada archivo se muestra con su tamaño de descarga.

| Escritura | Fuente | Versión | Descarga |
|---|---|---|---|
| Árabe, incluidas las letras del urdu y el persa | Noto Sans Arabic | 2.012 | 211 KB |
| Hebreo | Noto Sans Hebrew | 3.001 | 37 KB |
| Devanagari (hindi, maratí, nepalí) | Noto Sans Devanagari | 2.007 | 151 KB |
| Bengalí | Noto Sans Bengali | 3.011 | 139 KB |
| Tailandés | Noto Sans Thai | 2.002 | 62 KB |
| Cirílico | Noto Sans, letras cirílicas | 2.015 | 115 KB, cursiva 132 KB |
| Griego | Noto Sans, letras griegas | 2.015 | 77 KB, cursiva 83 KB |
| Latino, incluidas las letras vietnamitas y otras letras acentuadas | Noto Sans, letras latinas | 2.015 | 316 KB, cursiva 350 KB |
| Chino simplificado, los caracteres GB 2312 | Noto Sans SC | 2.004 | 2,0 MB |
| Chino tradicional, los caracteres Big5 | Noto Sans TC | 2.004 | 3,8 MB |
| Japonés, los caracteres Shift_JIS | Noto Sans JP | 2.004 | 2,2 MB |
| Coreano, todas las sílabas hangul y los caracteres KS X 1001 | Noto Sans KR | 2.004 | 2,5 MB |

Cada fuente conserva todos los pesos de su eje de peso, así que un encabezado en negrita en chino, japonés o coreano se muestra en negrita. Las fuentes Noto Sans tienen su eje de anchura fijado en normal, lo que reduce cada archivo a la mitad. Las fuentes chinas, japonesas y coreanas no tienen eje de anchura. Noto Sans se divide por escritura, así que una palabra en cirílico descarga solo las letras cirílicas. Los contornos no cambian respecto a los originales.

::: details Dónde están las fuentes y cómo se generan
Las fuentes están en una carpeta compartida, `community/fallback-fonts`, y se sirven a todos los design systems desde `/catalog/packs/fallback-fonts/`, como los conjuntos de emoji. `scripts/import-fallback-fonts.ts` genera los archivos a partir de las fuentes originales fijadas en `scripts/data/fallback-fonts.json`, comprueba cada archivo original frente a su SHA-256 registrado y escribe los textos de las licencias junto a las fuentes.
:::

<!--i:eti-globe-->
## Chino, japonés y coreano

Una fuente china, japonesa o coreana sin recortar ocupa entre 9,6 MB y 17,8 MB. Cada una se recorta a su conjunto nacional de caracteres, más la puntuación, los kana, las formas de ancho completo y los símbolos del texto corriente:

- Chino simplificado: GB 2312, los 6.763 hanzi comunes y sus símbolos, 7.522 caracteres en total.
- Chino tradicional: Big5, sus 13.053 hanzi y sus símbolos, 13.629 caracteres en total. No se incluye el conjunto de caracteres suplementarios de Hong Kong.
- Japonés: Shift_JIS tal como lo leen Windows y la web, que es JIS X 0208 con las adiciones de NEC e IBM que necesitan nombres como 髙 y 﨑, todos los kana y los katakana de ancho medio, 7.432 caracteres en total.
- Coreano: las 11.172 sílabas hangul y KS X 1001, con sus 4.888 hanja, 17.082 caracteres en total.

Estas cuatro fuentes omiten las letras latinas, griegas y cirílicas, que dibujan las fuentes del design system y las fuentes anteriores. Los conjuntos proceden de los archivos de índices del Encoding Standard en un commit fijado, así que volver a generarlos produce los mismos archivos.

El chino, el japonés y el coreano comparten la mayoría de sus caracteres, pero dibujan muchos de ellos de forma distinta. 直, por ejemplo, se escribe de una forma en chino y de otra en japonés. Un segmento de texto toma todos sus caracteres compartidos de una de estas fuentes, nunca de dos. Lolly elige esa fuente en este orden:

1. El idioma del segmento, a partir del `lang` de su elemento o del más cercano que lo contenga en el documento. El ajuste de idioma de una herramienta, como Language en el certificado, lo establece. El idioma de la propia interfaz de Lolly y el del design system no cuentan, así que un documento se exporta igual para todos.
2. La escritura del segmento: los kana indican japonés y el hangul indica coreano. Cuando el segmento no tiene ninguno de los dos, Lolly lee el documento, así que un encabezado solo con kanji en un documento japonés se dibuja en japonés. Un documento con kana y hangul no determina nada en este paso.
3. Un carácter que solo usa el chino tradicional, como 體 o 說, en el segmento o, en su defecto, en el documento, indica chino tradicional, salvo que el mismo texto también contenga uno que solo use el chino simplificado.
4. En caso contrario, chino simplificado.

Un carácter que falte en la fuente elegida nunca se toma de una de las otras tres. Se queda como imagen. Los kana o el hangul que falten en la fuente elegida, como palabras coreanas en una línea marcada como japonesa, pueden proceder de la fuente japonesa o coreana, pero solo cuando esa fuente no dibujaría ningún carácter compartido de la línea.

En la página, un lienzo que contiene dos de estos idiomas enumera ambas fuentes, y el navegador dibuja los caracteres compartidos con la primera. La exportación dibuja cada segmento con la suya.

<!--i:eti-download-->
## Cuándo se descarga una fuente

No se descarga nada hasta que un documento contiene un carácter que ninguna fuente de su design system puede dibujar. Un símbolo en una línea en inglés, como ★ o ※, nunca descarga una fuente china, japonesa o coreana.

La primera vez que un documento necesita una fuente de respaldo, Lolly descarga solo esa fuente y la conserva en tu dispositivo. Un documento japonés descarga solo la fuente japonesa, de 2,2 MB, y uno en chino tradicional, la fuente de chino tradicional de 3,8 MB. A partir de entonces, la escritura se dibuja sin conexión y la fuente se conserva cuando se limpia el catálogo. La fuente se guarda con los archivos del catálogo, nunca entre las fuentes que has subido, y no aparece en la lista de fuentes de tu marca.

La línea de comandos, la aplicación de terminal y el servidor MCP leen los mismos archivos del disco, así que no necesitan descargarlos.

<!--i:eti-eye-->
## En la página y en la exportación

La página usa la misma fuente de respaldo que la exportación, así que una línea que contiene esas letras tiene el mismo ancho en ambas. Solo en ese lienzo, Lolly añade la fuente de respaldo después de las fuentes del propio design system y antes de cualquier fuente del sistema. Una herramienta que establece su propia lista de fuentes, en sus estilos o en sus elementos, recibe la fuente de respaldo en el mismo lugar. Un lienzo que el design system cubre conserva su lista de fuentes sin cambios.

La página deja intacta una lista de fuentes cuando empieza por una fuente del sistema, como `system-ui` o Helvetica, porque la exportación dibuja ese texto con las fuentes del design system y la página no.

En un PDF, las palabras se convierten en contornos de la fuente de respaldo con cualquier ajuste de texto, porque el texto vivo de PDF no puede contener una escritura que la fuente incrustada no tenga. En SVG, EMF, EPS, DXF y WMF se convierten en contornos siempre que el texto se convierte en contornos. Si el texto se mantiene vivo, lo dibujan las fuentes del propio lector. Cuando una fuente de respaldo dibujó parte de una exportación, el panel de exportación muestra una nota como esta:

> El texto japonés se dibuja con Noto Sans JP, porque las fuentes de este design system no tienen esas letras.

La línea de comandos imprime la misma frase como nota.

<!--i:eti-image-->
## Qué se queda como imagen

Un carácter fuera de los cuatro conjuntos nacionales, como 𠮷 o un carácter suplementario de Hong Kong, no tiene fuente de respaldo. Los caracteres poco frecuentes como 𠮷, los añadidos para Hong Kong por su conjunto suplementario y las escrituras sin fuente de respaldo, como el tamil, el etíope o el siríaco, se tratan todos del mismo modo. Tampoco la tiene una escritura como el tamil, el etíope o el siríaco. En un PDF, la línea que contiene ese texto se incorpora como imagen de 300 dpi, y el panel de exportación enumera las escrituras. En un SVG, el segmento se queda como texto vivo, que dibujan las fuentes del propio lector.

::: details En exportaciones EPS, WMF y EMF
Un EPS, un WMF o un EMF con **Outline fonts** activado no tiene texto vivo al que recurrir, así que el segmento también se incorpora como imagen de 300 dpi. La imagen pinta el color del texto solo donde están las letras, así que el fondo se ve a través. El panel de exportación enumera las escrituras. Una imagen se dibuja solo en posición vertical, así que un segmento girado o inclinado detiene la exportación con un mensaje que cita el segmento. En un WMF o EMF, la imagen es un par de operaciones de mapa de bits, una máscara y una pintura. Microsoft Office y LibreOffice las dibujan como se espera. Una aplicación que las ignora, como Inkscape, muestra las palabras sobre un cuadro blanco.

Un EMF con **Outline fonts** desactivado conserva ese segmento como texto vivo, que dibujan las fuentes del propio lector. La excepción es un segmento que el texto vivo de EMF no puede contener, como texto con espaciado entre letras. Lolly convierte ese segmento en contornos, así que uno que ninguna fuente puede dibujar también se incorpora ahí como imagen.
:::

::: warning Una exportación DXF se detiene ante texto que ninguna fuente puede dibujar
Un DXF va a máquinas de corte y software CAD, que necesitan contornos, así que un segmento que ninguna fuente puede dibujar detiene una exportación DXF. El mensaje cita el segmento e indica su escritura. Añade una fuente con esas letras o exporta SVG o PDF.
:::

<!--i:eti-checklist-->
## La comprobación antes de exportar

La tarjeta **Before you export** de Lolly Design y las comprobaciones `render` de `lolly check` indican el texto que ninguna fuente puede dibujar. Tienen en cuenta las fuentes de respaldo igual que una exportación, a partir de las mismas listas de caracteres por fuente, así que no se señala el texto que una fuente de respaldo dibuja. Una escritura sin fuente de respaldo, como el tamil, y un carácter chino, japonés o coreano fuera de los conjuntos nacionales se siguen señalando, porque la exportación los dibuja como imagen o como texto vivo, y una exportación DXF se detiene ante ellos. La comprobación lee esas listas del catálogo y no descarga ninguna fuente.

<!--i:eti-stamp-->
## Licencias y créditos

Todas las fuentes de respaldo están bajo la SIL Open Font License 1.1. Cada entrada del catálogo registra esa licencia con un hash del texto de la licencia, así que las reglas de derechos de [Derechos creativos y créditos](/info/creative-rights.html) leen la licencia como la de cualquier otra fuente. Los textos de las licencias están junto a las fuentes. Los archivos Noto Sans no declaran ningún Reserved Font Name. Las fuentes chinas, japonesas y coreanas son de Adobe y reservan el nombre Source. Los archivos recortados conservan sus nombres Noto, que no usan ese nombre.

La licencia indica que sus condiciones no se aplican a los documentos creados con las fuentes. Una exportación contiene solo los contornos de las letras que usa, como ocurre con las fuentes del propio design system. Lolly no añade ningún programa de fuente, línea de crédito ni nueva entrada de credencial de contenido para una fuente de respaldo.
