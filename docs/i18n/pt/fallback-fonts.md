# Fontes de reserva

As fontes de um sistema de design muitas vezes cobrem apenas algumas das escritas do mundo. O Lolly Demo usa Outfit nos títulos e SUSE no texto, e nenhuma das duas tem letras cirílicas, gregas, árabes, hebraicas, devanágaris, bengalis, tailandesas, chinesas, japonesas ou coreanas. Quando um documento contém letras que as fontes do sistema de design não conseguem desenhar, o Lolly desenha essas letras com uma fonte Noto aberta, e assim a exportação as mantém como contornos vetoriais em vez de transformar as palavras em imagem.

As fontes do sistema de design vêm sempre primeiro, na ordem em que o sistema de design as lista. A Outfit não tem letras vietnamitas, então um título em vietnamita as pega da SUSE, a fonte seguinte na lista do Lolly Demo. Uma fonte de reserva desenha apenas os caracteres que nenhuma dessas fontes consegue desenhar, então uma fonte da marca mantém todas as letras, dígitos e marcas que tem, mesmo dentro de uma palavra em outra escrita. Uma fonte da marca que tem um caractere chinês também mantém esse caractere.

## O que vem incluído

Quinze fontes, todas do Google Fonts em um commit fixado e todas sob a SIL Open Font License 1.1. Cada arquivo aparece com o tamanho do download.

| Escrita | Fonte | Versão | Download |
|---|---|---|---|
| Árabe, incluindo as letras do urdu e do persa | Noto Sans Arabic | 2.012 | 206 KB |
| Hebraico | Noto Sans Hebrew | 3.001 | 37 KB |
| Devanágari (hindi, marata, nepalês) | Noto Sans Devanagari | 2.007 | 147 KB |
| Bengali | Noto Sans Bengali | 3.011 | 136 KB |
| Tailandês | Noto Sans Thai | 2.002 | 61 KB |
| Cirílico | Noto Sans, letras cirílicas | 2.015 | 112 KB, itálico 129 KB |
| Grego | Noto Sans, letras gregas | 2.015 | 75 KB, itálico 81 KB |
| Latim, incluindo o vietnamita e outras letras acentuadas | Noto Sans, letras latinas | 2.015 | 309 KB, itálico 342 KB |
| Chinês simplificado, os caracteres GB 2312 | Noto Sans SC | 2.004 | 1,9 MB |
| Chinês tradicional, os caracteres Big5 | Noto Sans TC | 2.004 | 3,6 MB |
| Japonês, os caracteres Shift_JIS | Noto Sans JP | 2.004 | 2,1 MB |
| Coreano, todas as sílabas hangul e os caracteres KS X 1001 | Noto Sans KR | 2.004 | 2,4 MB |

O eixo de peso de cada fonte é mantido inteiro, então todo peso que um design pede continua sendo desenhado, e um título em chinês, japonês ou coreano em negrito sai em negrito. O eixo de largura das fontes Noto Sans é fixado em normal, o que reduz cada arquivo à metade; as fontes chinesa, japonesa e coreana não têm eixo de largura. A Noto Sans é dividida por escrita, então uma palavra em cirílico baixa apenas as letras cirílicas. Os contornos são os contornos originais, sem alteração.

As fontes ficam em uma pasta compartilhada, `community/fallback-fonts`, servida a todos os sistemas de design em `/catalog/packs/fallback-fonts/`, do mesmo modo que os conjuntos de emoji são compartilhados. O `scripts/import-fallback-fonts.ts` monta os arquivos a partir das fontes originais fixadas em `scripts/data/fallback-fonts.json`, confere cada arquivo original com o SHA-256 registrado e grava os textos das licenças ao lado das fontes.

## Chinês, japonês e coreano

Uma fonte chinesa, japonesa ou coreana completa tem de 9,6 MB a 17,8 MB, então cada uma delas é cortada no conjunto nacional de caracteres que os leitores usam todo dia, mais a pontuação, os kana, as formas de largura total e os símbolos do texto corrido:

- Chinês simplificado: GB 2312, os 6.763 hanzi comuns e seus símbolos, 7.522 caracteres ao todo.
- Chinês tradicional: Big5, seus 13.053 hanzi e seus símbolos, 13.629 caracteres ao todo. O Hong Kong Supplementary Character Set não está incluído.
- Japonês: Shift_JIS como o Windows e a web o leem, que é o JIS X 0208 com as adições da NEC e da IBM de que nomes como 髙 e 﨑 precisam, todos os kana e o katakana de meia largura, 7.432 caracteres ao todo.
- Coreano: todas as 11.172 sílabas hangul e o KS X 1001, com seus 4.888 hanja, 17.082 caracteres ao todo.

As letras latinas, gregas e cirílicas ficam de fora dessas quatro fontes, porque as fontes do sistema de design e as fontes acima as desenham. Os conjuntos são lidos dos arquivos de índice do Encoding Standard em um commit fixado, então uma nova compilação gera os mesmos arquivos.

Chinês, japonês e coreano compartilham a maioria dos caracteres, mas cada um desenha muitos deles de modo diferente. O mesmo caractere 直 é escrito de um jeito em chinês e de outro em japonês. Por isso um trecho de texto pega todos os seus caracteres compartilhados de uma só dessas fontes, nunca de duas, e o Lolly escolhe essa fonte nesta ordem:

1. O idioma do trecho, a partir do `lang` do seu elemento ou do mais próximo ao redor dele no documento. A configuração de idioma de uma ferramenta, como o Language do certificado, define isso. O idioma da própria interface do Lolly e o idioma do sistema de design não contam, então um documento é exportado igual para todos.
2. A escrita do trecho: kana significa japonês e hangul significa coreano. Quando o próprio trecho não tem nenhum dos dois, o documento inteiro é lido, então um título só de kanji em um documento japonês é desenhado em japonês. Um documento que contém kana e hangul não decide nada aqui.
3. Um caractere que só o chinês tradicional usa, como 體 ou 說, no trecho ou, na falta, no documento, significa chinês tradicional, a menos que o mesmo texto também contenha um que só o chinês simplificado usa.
4. Caso contrário, chinês simplificado.

Um caractere que a fonte escolhida não tem nunca é pego de uma das outras três. Ele continua sendo uma imagem, como descrito abaixo. Kana ou hangul que a fonte escolhida não tem, como palavras em coreano em uma linha marcada como japonesa, ainda podem vir da fonte japonesa ou coreana, mas só quando essa fonte não desenharia nenhum caractere compartilhado da linha.

Na página, um canvas que contém dois desses idiomas lista as duas fontes, e o navegador desenha os caracteres compartilhados com a primeira. A exportação desenha cada trecho com a sua própria.

## Quando uma fonte é baixada

Nada é baixado até que um documento contenha um caractere que nenhuma fonte do seu sistema de design consiga desenhar. Um documento em inglês, ou em qualquer idioma que o seu sistema de design cubra, nunca baixa uma fonte de reserva. Um símbolo em uma linha em inglês, como ★ ou ※, nunca baixa uma fonte chinesa, japonesa ou coreana.

Na primeira vez que um documento precisa de uma, o Lolly baixa essa fonte, para essa escrita, e a guarda no seu dispositivo. Um documento em japonês baixa só a fonte japonesa, de 2,1 MB, e um em chinês tradicional baixa a fonte tradicional de 3,6 MB. Dali em diante a escrita é desenhada offline, e a fonte permanece quando o catálogo é limpo. A fonte é guardada junto com os arquivos do próprio catálogo, nunca entre as fontes que você enviou, então não aparece na lista de fontes da sua marca.

A linha de comando, o app de terminal e o servidor MCP leem os mesmos arquivos do disco, então não precisam de download.

## Na página e na exportação

A página usa a mesma fonte de reserva que a exportação. Sem isso, um navegador desenha essas letras em uma fonte do sistema enquanto a exportação usa a Noto, e uma linha que as contém muda de largura entre as duas. O Lolly acrescenta a fonte de reserva ao fim da lista de fontes do sistema de design apenas nesse canvas, depois das fontes do próprio sistema de design e antes de qualquer fonte do sistema. Uma ferramenta que define a sua própria lista de fontes, nos estilos ou nos elementos, recebe a fonte de reserva no mesmo lugar: depois das fontes que a lista dá e antes de qualquer fonte do sistema. Um canvas que o sistema de design cobre mantém a sua lista de fontes exatamente como antes.

A página deixa uma lista de fontes em paz quando ela começa com uma fonte do sistema, como `system-ui` ou Helvetica, porque a exportação desenha esse texto com as fontes do sistema de design e a página não.

Em um PDF, as palavras viram contornos desenhados com a fonte de reserva, qualquer que seja a opção de texto escolhida, porque o texto ativo de um PDF não pode carregar uma escrita que a fonte incorporada não tem. Em SVG, EMF, EPS, DXF e WMF elas viram contornos sempre que o texto é convertido em contornos; com o texto mantido ativo, as fontes do próprio leitor as desenham, como antes. Quando uma fonte de reserva desenhou parte de uma exportação, o painel de exportação mostra uma nota como:

> O texto em japonês é desenhado com a Noto Sans JP, porque as fontes deste sistema de design não têm essas letras.

A linha de comando imprime a mesma frase como nota.

## O que continua sendo imagem

Um caractere fora dos quatro conjuntos nacionais não tem fonte de reserva. Caracteres raros como 𠮷, os caracteres acrescentados para Hong Kong pelo seu conjunto suplementar e escritas sem fonte de reserva, como o tâmil, o etíope ou o siríaco, recebem todos o mesmo tratamento. Em um PDF, a linha que contém um deles entra como uma imagem de 300 dpi, e o painel de exportação lista as escritas. Em um SVG, o trecho continua sendo texto ativo, que as fontes do próprio leitor desenham.

## A verificação antes de exportar

O cartão **Before you export** do Design, e as verificações `render` do `lolly check`, apontam texto que nenhuma fonte consegue desenhar. Elas contam as fontes de reserva como uma exportação conta, a partir das mesmas listas dos caracteres que cada fonte tem, então o texto que uma fonte de reserva desenha não é apontado. Uma escrita sem fonte de reserva, como o tâmil, e um caractere chinês, japonês ou coreano fora dos conjuntos nacionais continuam sendo apontados, porque a exportação os desenha como uma imagem ou como texto ativo. A verificação lê essas listas do catálogo e não baixa nenhuma fonte.

## Licenças e créditos

Toda fonte de reserva está sob a SIL Open Font License 1.1, e cada entrada do catálogo registra essa licença com um hash do texto da licença, então as regras de direitos em [Creative rights and credits](/info/creative-rights.html) leem a licença como a de qualquer outra fonte. Os textos das licenças ficam ao lado das fontes. Os arquivos da Noto Sans não declaram nenhum Reserved Font Name. As fontes chinesa, japonesa e coreana são da Adobe e reservam o nome Source; os arquivos cortados mantêm os nomes Noto, que não usam esse nome.

A licença diz que os seus termos não se aplicam aos documentos feitos com as fontes. Uma exportação contém apenas os contornos desenhados das letras que usa, como acontece com as fontes do próprio sistema de design, e o Lolly não acrescenta programa de fonte, linha de crédito nem nova entrada de Content Credentials por uma fonte de reserva.
