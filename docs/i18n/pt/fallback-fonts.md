# Fontes de reserva

Quando as fontes de um sistema de design não conseguem desenhar uma letra, o Lolly desenha a letra com uma fonte aberta Noto, para que a exportação mantenha a letra como um contorno vetorial em vez de uma imagem. As fontes do Lolly Demo, Outfit para títulos e SUSE para texto, não têm letras cirílicas, gregas, árabes, hebraicas, devanágari, bengalis, tailandesas, chinesas, japonesas ou coreanas.

As fontes do sistema de design sempre vêm primeiro, na ordem em que estão listadas. Outfit não tem letras vietnamitas, então um título em vietnamita as obtém de SUSE, a próxima fonte na lista do Lolly Demo. Uma fonte de reserva desenha apenas os caracteres que nenhuma dessas fontes consegue desenhar. Uma fonte da marca mantém cada letra, dígito e sinal que tem, incluindo caracteres chineses, mesmo dentro de uma palavra em outra escrita.

<!--i:eti-package-->
## O que vem incluído

Quinze fontes, todas do Google Fonts em um commit fixado. Cada arquivo é mostrado com seu tamanho de download.

| Escrita | Fonte | Versão | Download |
|---|---|---|---|
| Árabe, incluindo letras do urdu e do persa | Noto Sans Arabic | 2.012 | 211 KB |
| Hebraica | Noto Sans Hebrew | 3.001 | 37 KB |
| Devanágari (hindi, marata, nepalês) | Noto Sans Devanagari | 2.007 | 151 KB |
| Bengali | Noto Sans Bengali | 3.011 | 139 KB |
| Tailandesa | Noto Sans Thai | 2.002 | 62 KB |
| Cirílica | Noto Sans, letras cirílicas | 2.015 | 115 KB, itálico 132 KB |
| Grega | Noto Sans, letras gregas | 2.015 | 77 KB, itálico 83 KB |
| Latina, incluindo letras vietnamitas e outras letras acentuadas | Noto Sans, letras latinas | 2.015 | 316 KB, itálico 350 KB |
| Chinesa simplificada, os caracteres GB 2312 | Noto Sans SC | 2.004 | 2,0 MB |
| Chinesa tradicional, os caracteres Big5 | Noto Sans TC | 2.004 | 3,8 MB |
| Japonesa, os caracteres Shift_JIS | Noto Sans JP | 2.004 | 2,2 MB |
| Coreana, todas as sílabas Hangul e os caracteres KS X 1001 | Noto Sans KR | 2.004 | 2,5 MB |

Cada fonte mantém todos os pesos do seu eixo de peso, então um título em negrito em chinês, japonês ou coreano fica em negrito. As fontes Noto Sans têm o eixo de largura fixado em normal, o que reduz cada arquivo à metade. As fontes chinesas, japonesas e coreanas não têm eixo de largura. Noto Sans é dividida por escrita, então uma palavra em cirílico baixa apenas as letras cirílicas. Os contornos não mudam em relação aos originais.

::: details Onde as fontes ficam e como são geradas
As fontes ficam em uma pasta compartilhada, `community/fallback-fonts`, fornecida a todos os sistemas de design a partir de `/catalog/packs/fallback-fonts/`, como os conjuntos de emojis. `scripts/import-fallback-fonts.ts` gera os arquivos a partir das fontes originais fixadas em `scripts/data/fallback-fonts.json`, confere cada arquivo original com seu SHA-256 registrado e grava os textos das licenças ao lado das fontes.
:::

<!--i:eti-globe-->
## Chinês, japonês e coreano

Uma fonte chinesa, japonesa ou coreana completa tem de 9,6 MB a 17,8 MB. Cada uma é reduzida ao seu conjunto nacional de caracteres, mais a pontuação, os kana, as formas de largura total e os símbolos de texto corrido:

- Chinês simplificado: GB 2312, os 6.763 hanzi comuns e seus símbolos, 7.522 caracteres ao todo.
- Chinês tradicional: Big5, seus 13.053 hanzi e seus símbolos, 13.629 caracteres ao todo. O Hong Kong Supplementary Character Set não está incluído.
- Japonês: Shift_JIS como o Windows e a web o leem, que é JIS X 0208 com os acréscimos da NEC e da IBM de que nomes como 髙 e 﨑 precisam, todos os kana e os katakana de meia largura, 7.432 caracteres ao todo.
- Coreano: todas as 11.172 sílabas Hangul e KS X 1001, com seus 4.888 hanja, 17.082 caracteres ao todo.

Essas quatro fontes deixam de fora as letras latinas, gregas e cirílicas, que as fontes do sistema de design e as fontes acima desenham. Os conjuntos vêm dos arquivos de índice do Encoding Standard em um commit fixado, então uma nova geração produz os mesmos arquivos.

Chinês, japonês e coreano compartilham a maioria de seus caracteres, mas desenham muitos deles de formas diferentes. 直, por exemplo, é escrito de um jeito em chinês e de outro em japonês. Um trecho de texto obtém todos os seus caracteres compartilhados de uma dessas fontes, nunca de duas. O Lolly escolhe essa fonte nesta ordem:

1. O idioma do trecho, a partir do `lang` de seu elemento ou do ancestral mais próximo no documento. A configuração de idioma de uma ferramenta, como Language do certificado, define isso. O idioma da própria interface do Lolly e o idioma do sistema de design não contam, então um documento é exportado da mesma forma para todos.
2. A escrita do trecho: kana significa japonês e Hangul significa coreano. Quando o trecho não tem nenhum dos dois, o Lolly lê o documento, então um título só de kanji em um documento japonês é desenhado em japonês. Um documento com kana e Hangul não resolve nada nesta etapa.
3. Um caractere que só o chinês tradicional usa, como 體 ou 說, no trecho ou, caso contrário, no documento, significa chinês tradicional, a menos que o mesmo texto também contenha um que só o chinês simplificado usa.
4. Caso contrário, chinês simplificado.

Um caractere que falta na fonte escolhida nunca é obtido de uma das outras três. Ele continua como imagem. Kana ou Hangul que faltam na fonte escolhida, como palavras coreanas em uma linha marcada como japonesa, ainda podem vir da fonte japonesa ou coreana, mas só quando essa fonte não desenharia nenhum caractere compartilhado da linha.

Na página, um canvas com dois desses idiomas lista ambas as fontes, e o navegador desenha os caracteres compartilhados com a primeira. A exportação desenha cada trecho com sua própria fonte.

<!--i:eti-download-->
## Quando uma fonte é baixada

Nada é baixado até que um documento contenha um caractere que nenhuma fonte do seu sistema de design consegue desenhar. Um símbolo em uma linha em inglês, como ★ ou ※, nunca baixa uma fonte chinesa, japonesa ou coreana.

Na primeira vez que um documento precisa de uma fonte de reserva, o Lolly baixa só essa fonte e a mantém no seu dispositivo. Um documento em japonês baixa apenas a fonte japonesa, de 2,2 MB, e um em chinês tradicional baixa a fonte tradicional, de 3,8 MB. A partir daí, a escrita é desenhada offline, e a fonte permanece quando o catálogo é limpo. A fonte fica junto dos arquivos do catálogo, nunca entre as fontes que você enviou, e não aparece na lista de fontes da sua marca.

A linha de comando, o app de terminal e o servidor MCP leem os mesmos arquivos do disco, então não precisam de download.

<!--i:eti-eye-->
## Na página e na exportação

A página usa a mesma fonte de reserva que a exportação, então uma linha com essas letras tem a mesma largura nas duas. Só nesse canvas, o Lolly acrescenta a fonte de reserva depois das fontes do próprio sistema de design e antes de qualquer fonte do sistema. Uma ferramenta que define sua própria lista de fontes, em seus estilos ou em seus elementos, recebe a fonte de reserva na mesma posição. Um canvas que o sistema de design cobre mantém sua lista de fontes inalterada.

A página não altera uma lista de fontes quando ela começa com uma fonte do sistema, como `system-ui` ou Helvetica, porque a exportação desenha esse texto com as fontes do sistema de design e a página não.

Em um PDF, as palavras viram contornos na fonte de reserva com qualquer configuração de texto, porque o texto ativo de PDF não pode conter uma escrita que falta na fonte incorporada. Em SVG, EMF, EPS, DXF e WMF, elas viram contornos sempre que o texto é convertido em contornos. Com o texto mantido ativo, as fontes do próprio leitor as desenham. Quando uma fonte de reserva desenhou parte de uma exportação, o painel de exportação mostra uma nota como:

> O texto em japonês é desenhado com Noto Sans JP, porque as fontes deste sistema de design não têm essas letras.

A linha de comando imprime a mesma frase como uma nota.

<!--i:eti-image-->
## O que continua como imagem

Um caractere fora dos quatro conjuntos nacionais, como 𠮷 ou um caractere suplementar de Hong Kong, não tem fonte de reserva. Caracteres raros como 𠮷, os caracteres acrescentados para Hong Kong por seu conjunto suplementar e escritas sem fonte de reserva, como tâmil, etíope ou siríaca, são todos tratados da mesma forma. Uma escrita como tâmil, etíope ou siríaca também não tem. Em um PDF, a linha que contém esse texto entra como uma imagem de 300 dpi, e o painel de exportação lista as escritas. Em um SVG, o trecho continua como texto ativo, que as fontes do próprio leitor desenham.

::: details Nas exportações EPS, WMF e EMF
Um EPS, um WMF ou um EMF com **Outline fonts** ativado não tem texto ativo ao qual recorrer, então o trecho também entra como uma imagem de 300 dpi. A imagem pinta a cor do texto apenas onde estão as letras, deixando o fundo aparecer. O painel de exportação lista as escritas. Uma imagem só é desenhada na posição normal, então um trecho girado ou inclinado interrompe a exportação com uma mensagem que cita o trecho. Em um WMF ou EMF, a imagem é um par de operações de bitmap, uma máscara e uma pintura. Microsoft Office e LibreOffice as desenham como previsto. Um app que as ignora, como Inkscape, mostra as palavras sobre uma caixa branca.

Um EMF com **Outline fonts** desativado mantém esse trecho como texto ativo, que as fontes do próprio leitor desenham. A exceção é um trecho que o texto ativo de EMF não pode conter, como texto com espaçamento entre letras. O Lolly converte esse trecho em contornos, então um trecho que nenhuma fonte consegue desenhar também entra como imagem nesse caso.
:::

::: warning Uma exportação DXF para ao encontrar texto que nenhuma fonte consegue desenhar
Um DXF vai para máquinas de corte e softwares CAD, que precisam de contornos, então um trecho que nenhuma fonte consegue desenhar interrompe uma exportação DXF. A mensagem cita o trecho e informa sua escrita. Adicione uma fonte com essas letras ou exporte SVG ou PDF.
:::

<!--i:eti-checklist-->
## A verificação antes de exportar

O cartão **Before you export** do Lolly Design e as verificações `render` de `lolly check` informam textos que nenhuma fonte consegue desenhar. Eles consideram as fontes de reserva como uma exportação faz, a partir das mesmas listas de caracteres por fonte, então um texto que uma fonte de reserva desenha não é apontado. Uma escrita sem fonte de reserva, como tâmil, e um caractere chinês, japonês ou coreano fora dos conjuntos nacionais ainda são apontados, porque a exportação os desenha como imagem ou texto ativo, e uma exportação DXF para ao encontrá-los. A verificação lê essas listas do catálogo e não baixa nenhuma fonte.

<!--i:eti-stamp-->
## Licenças e créditos

Toda fonte de reserva está sob a SIL Open Font License 1.1. Cada entrada do catálogo registra essa licença com um hash do texto da licença, então as regras de direitos em [Direitos criativos e créditos](/info/creative-rights.html) leem a licença como a de qualquer outra fonte. Os textos das licenças ficam ao lado das fontes. Os arquivos Noto Sans não declaram nenhum Reserved Font Name. As fontes chinesas, japonesas e coreanas são da Adobe e reservam o nome Source. Os arquivos reduzidos mantêm seus nomes Noto, que não usam esse nome.

A licença diz que seus termos não se aplicam a documentos feitos com as fontes. Uma exportação contém apenas os contornos das letras que usa, como acontece com as fontes do próprio sistema de design. O Lolly não acrescenta nenhum programa de fonte, linha de crédito ou nova entrada na credencial de conteúdo para uma fonte de reserva.
