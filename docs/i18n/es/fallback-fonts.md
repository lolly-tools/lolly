# Tipografías de respaldo

Las tipografías de un design system suelen cubrir solo algunas de las escrituras del mundo. Lolly Demo usa Outfit para los títulos y SUSE para el texto, y ninguna de las dos tiene letras cirílicas, griegas, árabes, hebreas, devanagari, bengalíes, tailandesas, chinas, japonesas o coreanas. Cuando un documento contiene letras que las tipografías de su design system no pueden dibujar, Lolly las dibuja con una tipografía abierta de Noto, de modo que la exportación las conserva como contornos vectoriales en lugar de convertir las palabras en una imagen.

Las tipografías del design system van siempre primero, en el orden en que el design system las enumera. Outfit no tiene letras vietnamitas, así que un título en vietnamita las toma de SUSE, la siguiente tipografía de la lista de Lolly Demo. Una tipografía de respaldo dibuja solo los caracteres que ninguna de esas tipografías puede dibujar, de modo que una tipografía de marca conserva todas las letras, dígitos y signos que tiene, incluso dentro de una palabra en otra escritura. Una tipografía de marca que tiene un carácter chino conserva también ese carácter.

## Qué se incluye

Quince tipografías, todas de Google Fonts en un commit fijado y todas con la licencia SIL Open Font License 1.1. De cada archivo se indica el tamaño de descarga.

| Escritura | Tipografía | Versión | Descarga |
|---|---|---|---|
| Árabe, con las letras del urdu y del persa | Noto Sans Arabic | 2.012 | 206 KB |
| Hebreo | Noto Sans Hebrew | 3.001 | 37 KB |
| Devanagari (hindi, maratí, nepalí) | Noto Sans Devanagari | 2.007 | 147 KB |
| Bengalí | Noto Sans Bengali | 3.011 | 136 KB |
| Tailandés | Noto Sans Thai | 2.002 | 61 KB |
| Cirílico | Noto Sans, letras cirílicas | 2.015 | 112 KB, cursiva 129 KB |
| Griego | Noto Sans, letras griegas | 2.015 | 75 KB, cursiva 81 KB |
| Latino, con el vietnamita y otras letras acentuadas | Noto Sans, letras latinas | 2.015 | 309 KB, cursiva 342 KB |
| Chino simplificado, los caracteres GB 2312 | Noto Sans SC | 2.004 | 1,9 MB |
| Chino tradicional, los caracteres Big5 | Noto Sans TC | 2.004 | 3,6 MB |
| Japonés, los caracteres Shift_JIS | Noto Sans JP | 2.004 | 2,1 MB |
| Coreano, todas las sílabas hangul y los caracteres KS X 1001 | Noto Sans KR | 2.004 | 2,4 MB |

El eje de peso de cada tipografía se conserva entero, así que cada peso que pide un diseño se dibuja y un título en negrita en chino, japonés o coreano sale en negrita. El eje de ancho de las tipografías Noto Sans está fijado en normal, lo que reduce a la mitad cada archivo; las tipografías de chino, japonés y coreano no tienen eje de ancho. Noto Sans está dividida por escritura, así que una palabra en cirílico descarga solo las letras cirílicas. Los contornos son los originales, sin cambios.

Las tipografías viven en una única carpeta compartida, `community/fallback-fonts`, que se sirve a todos los design systems desde `/catalog/packs/fallback-fonts/`, igual que se comparten los conjuntos de emoji. `scripts/import-fallback-fonts.ts` genera los archivos a partir de las tipografías originales fijadas en `scripts/data/fallback-fonts.json`, comprueba cada archivo original con su SHA-256 registrado y escribe los textos de licencia junto a las tipografías.

## Chino, japonés y coreano

Una tipografía completa de chino, japonés o coreano pesa entre 9,6 MB y 17,8 MB, así que cada una se recorta al conjunto nacional de caracteres que usan a diario sus lectores, más la puntuación, el kana, las formas de ancho completo y los símbolos del texto corrido:

- Chino simplificado: GB 2312, los 6.763 hanzi comunes y sus símbolos, 7.522 caracteres en total.
- Chino tradicional: Big5, sus 13.053 hanzi y sus símbolos, 13.629 caracteres en total. El Hong Kong Supplementary Character Set no está incluido.
- Japonés: Shift_JIS tal como lo leen Windows y la web, es decir, JIS X 0208 con las ampliaciones de NEC e IBM que necesitan nombres como 髙 y 﨑, todo el kana y el katakana de ancho medio, 7.432 caracteres en total.
- Coreano: las 11.172 sílabas hangul y KS X 1001, con sus 4.888 hanja, 17.082 caracteres en total.

Las letras latinas, griegas y cirílicas se dejan fuera de estas cuatro tipografías, porque las dibujan las tipografías del design system y las tipografías anteriores. Los conjuntos se leen de los archivos de índice del Encoding Standard en un commit fijado, así que una reconstrucción da los mismos archivos.

El chino, el japonés y el coreano comparten la mayoría de sus caracteres, pero cada uno dibuja muchos de ellos de forma distinta. El mismo carácter 直 se escribe de una manera en chino y de otra en japonés. Por eso un tramo de texto toma todos sus caracteres compartidos de una sola de estas tipografías, nunca de dos, y Lolly elige esa tipografía en este orden:

1. El idioma del tramo, según el `lang` de su elemento o el más cercano que lo rodea en el documento. El ajuste de idioma de una herramienta, como el Language del certificado, lo establece. El idioma de la propia interfaz de Lolly y el del design system no cuentan, de modo que un documento se exporta igual para todos.
2. La escritura del tramo: el kana indica japonés y el hangul indica coreano. Cuando el propio tramo no tiene ninguno de los dos, se lee el documento entero, así que un título solo de kanji en un documento japonés se dibuja en japonés. Un documento que contiene kana y hangul no decide nada aquí.
3. Un carácter que solo usa el chino tradicional, como 體 o 說, en el tramo o, si no, en el documento, indica chino tradicional, salvo que el mismo texto contenga también uno que solo usa el chino simplificado.
4. En caso contrario, chino simplificado.

Un carácter que la tipografía elegida no tiene nunca se toma de una de las otras tres. Sigue siendo una imagen, como se describe más abajo. El kana o el hangul que la tipografía elegida no tiene, como palabras coreanas en una línea marcada como japonesa, aún pueden venir de la tipografía japonesa o coreana, pero solo cuando esa tipografía no dibujaría ningún carácter compartido de la línea.

En la página, un lienzo que contiene dos de estos idiomas enumera ambas tipografías, y el navegador dibuja los caracteres compartidos con la primera. La exportación dibuja cada tramo con la suya.

## Cuándo se descarga una tipografía

No se descarga nada hasta que un documento contiene un carácter que ninguna tipografía de su design system puede dibujar. Un documento en inglés, o en cualquier idioma que su design system cubra, nunca descarga una tipografía de respaldo. Un símbolo en una línea en inglés, como ★ o ※, nunca descarga una tipografía de chino, japonés o coreano.

La primera vez que un documento necesita una, Lolly descarga esa tipografía, para esa escritura, y la guarda en tu dispositivo. Un documento japonés descarga solo la tipografía japonesa, 2,1 MB, y uno en chino tradicional la tipografía tradicional de 3,6 MB. A partir de entonces la escritura se dibuja sin conexión, y la tipografía se queda cuando se limpia el catálogo. La tipografía se guarda con los archivos propios del catálogo, nunca entre las tipografías que subiste, así que no aparece en la lista de tipografías de tu marca.

La línea de comandos, la aplicación de terminal y el servidor MCP leen los mismos archivos del disco, así que no necesitan descarga.

## En la página y en la exportación

La página usa la misma tipografía de respaldo que la exportación. Sin esto, un navegador dibuja esas letras con una tipografía del sistema mientras la exportación usa Noto, y una línea que las contiene cambia de ancho entre ambas. Lolly añade la tipografía de respaldo al final de la lista de tipografías del design system solo en ese lienzo, después de las tipografías propias del design system y antes de cualquier tipografía del sistema. Una herramienta que define su propia lista de tipografías, en sus estilos o en sus elementos, recibe la tipografía de respaldo en el mismo lugar: después de las tipografías que da la lista y antes de cualquier tipografía del sistema. Un lienzo que el design system cubre mantiene su lista de tipografías exactamente como antes.

La página deja en paz una lista de tipografías cuando empieza con una tipografía del sistema, como `system-ui` o Helvetica, porque la exportación dibuja ese texto con las tipografías del design system y la página no.

En un PDF las palabras se convierten en contornos dibujados con la tipografía de respaldo, elijas el ajuste de texto que elijas, porque el texto vivo del PDF no puede llevar una escritura que la tipografía incrustada no tiene. En SVG, EMF, EPS, DXF y WMF se convierten en contornos siempre que el texto se convierte en contornos; con el texto vivo, las tipografías del propio lector las dibujan, como antes. Cuando una tipografía de respaldo dibujó parte de una exportación, el panel de exportación muestra una nota como esta:

> El texto japonés se dibuja con Noto Sans JP, porque las tipografías de este design system no tienen esas letras.

La línea de comandos imprime la misma frase como nota.

## Lo que sigue siendo una imagen

Un carácter fuera de los cuatro conjuntos nacionales no tiene tipografía de respaldo. Los caracteres raros como 𠮷, los caracteres añadidos para Hong Kong por su conjunto suplementario y las escrituras sin tipografía de respaldo, como el tamil, el etíope o el siríaco, se tratan todos igual. En un PDF la línea que contiene uno entra como una imagen de 300 dpi, y el panel de exportación enumera las escrituras. En un SVG el tramo sigue siendo texto vivo, que dibujan las tipografías del propio lector.

## La comprobación antes de exportar

La tarjeta **Before you export** de Design, y las comprobaciones `render` de `lolly check`, indican el texto que ninguna tipografía puede dibujar. Cuentan las tipografías de respaldo igual que una exportación, a partir de las mismas listas de los caracteres que tiene cada tipografía, así que el texto que dibuja una tipografía de respaldo no se indica. Una escritura sin tipografía de respaldo, como el tamil, y un carácter chino, japonés o coreano fuera de los conjuntos nacionales se siguen indicando, porque la exportación los dibuja como una imagen o como texto vivo. La comprobación lee esas listas del catálogo y no descarga ninguna tipografía.

## Licencias y créditos

Cada tipografía de respaldo tiene la licencia SIL Open Font License 1.1, y cada entrada del catálogo registra esa licencia con un hash del texto de la licencia, así que las reglas de derechos de [Creative rights and credits](/info/creative-rights.html) leen la licencia como la de cualquier otra tipografía. Los textos de licencia están junto a las tipografías. Los archivos de Noto Sans no declaran ningún Reserved Font Name. Las tipografías de chino, japonés y coreano son de Adobe y reservan el nombre Source; los archivos recortados conservan sus nombres Noto, que no usan ese nombre.

La licencia dice que sus términos no se aplican a los documentos hechos con las tipografías. Una exportación contiene solo los contornos dibujados de las letras que usa, igual que con las tipografías del propio design system, y Lolly no añade ningún programa de tipografía, ninguna línea de crédito ni ninguna entrada nueva de Content Credentials para una tipografía de respaldo.
