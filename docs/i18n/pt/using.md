# Usando o Lolly

Um guia prático para realmente *usar* o app - abrir uma ferramenta, trabalhar na prancheta, exportar, salvar e compartilhar. Tudo aqui roda **no seu dispositivo**: sem conta, sem upload, e sem precisar de internet para as telas que você já abriu.

> Novo por aqui? O [Guia rápido](/info/quickstart.html) coloca você para criar em minutos, e [Lolly para Operadores](/info/operators.html) explica como instalar/implantar o app; esta página é sobre como usá-lo depois que já está aberto.

## Abrindo uma ferramenta

A tela inicial é a **galeria** - todas as ferramentas, agrupadas por categoria. Clique em um cartão para começar algo novo nessa ferramenta; [o trabalho salvo](#saving-continuing) reabre a partir de **Projetos**. Use a caixa de busca para filtrar por nome - ou a [Busca](/info/search.html) na barra ao pé das seis telas de listagem (a galeria, Utilitários, Projetos, Ativos, o Painel e Configurações), que alcança seu trabalho salvo, seus ativos e suas configurações além das ferramentas. Dentro de uma ferramenta, a barra dá lugar aos controles da própria ferramenta.

![Um cartão de galeria com navegação de exemplo e uma ação Novo](/t/url-shot?url=%2F%23%2F&width=1440&height=900&dpi=192&waitMs=1600&css=.welcome-dialog%2C.personalize-nudge%7Bdisplay%3Anone!important%7D&waitSelector=.gallery-view%5Bdata-shots-settled%5D&walker=1&format=svg&localize=1&dark=1&cropSelector=.gtile%5Bdata-tool-id%3D%22design%22%5D&filename=gallery&try=1)

Cada ferramenta é uma visualização dividida: **controles** de um lado, uma **pré-visualização** ao vivo (a tela) do outro. Altere qualquer controle e a pré-visualização é atualizada instantaneamente.

![A visão dividida de uma ferramenta - a pilha de controles à esquerda, e o gráfico de barras agrupadas ao vivo que ela desenha à direita](/t/url-shot?url=%2F%23%2Ftool%2Fchart%3Fct%3Dbar%26t%3DExample%2520data%26st%3DSample%2520values%252C%2520not%2520a%2520real%2520dataset%26d%3DMonth%252CSeries%2520A%252CSeries%2520B%252CSeries%2520C%250AJan%252C12%252C9%252C5%250AFeb%252C18%252C14%252C7%250AMar%252C24%252C17%252C11%250AApr%252C29%252C23%252C15%26lg%3D1&width=1440&height=900&dpi=192&waitMs=2500&walker=1&format=svg&dark=1&filename=vt-tool-split-view)

> Algumas ferramentas (como o **Design**) abrem, em vez disso, como uma **tela livre** - uma superfície sem interface, de manipulação direta, onde você arrasta, redimensiona, gira e encaixa caixas de texto, formas e imagens, e clica duas vezes para editar o texto no local. Ela exporta pelo mesmo caminho de renderização de qualquer outra ferramenta, então a tela *é* o arquivo. Veja [A tela livre](#the-free-canvas-design) abaixo.

Duas maneiras de moldar a própria grade e deixá-la do jeito que você quer:

- <!--i:star--> **Marque com estrela o que você usa.** Marque um cartão com ★ e ele ganha um bloco grande só dele em uma faixa acima da grade - veja [Seus favoritos](/info/favourites.html).
- <!--i:eyeoff--> **Oculte uma ferramenta que você nunca usa.** Clique com o botão direito em um cartão (ou selecione vários e use a barra de seleção) → **Ocultar ferramenta**. Ela sai da grade, e sai também do que a digitação na grade encontra; um bloco cinza **Mostrar ferramentas ocultas (N)** bem no fim revela todas de novo, esmaecidas, cada uma com **Reexibir ferramenta** no seu próprio menu. Ocultar diz respeito só à sua grade - a ferramenta continua abrindo por um link salvo ou um favorito, e permanece exatamente onde estava para todo mundo.

![O fim da grade de Ferramentas com as ferramentas ocultas reveladas: o cartão esmaecido do Gerador de QR Code e, ao lado dele, o bloco cinza que o trouxe de volta à vista, agora escrito Ocultar ferramentas ocultas](/t/url-shot?url=%2F%23%2F&width=1440&height=680&dpi=192&waitMs=1600&css=.welcome-dialog%2C.personalize-nudge%7Bdisplay%3Anone!important%7D&drive=click%3A%5Bdata-select%3D%22qr-code%22%5D%3Bclick%3A%5Bdata-bulk%3D%22hide%22%5D%3Bwait%3A300%3Bclick%3A.gtile--hiddenbox%3Bpress%3AEnd%3Bwait%3A800&waitSelector=.gallery-view%5Bdata-shots-settled%5D&walker=1&format=svg&rasterDpi=96&dark=1&filename=misc-hidden-tools)
<!--
SHOT NOTE (misc-hidden-tools): the trailing `press:End` is required. The
hidden box and the revealed cards live at the very END of the grid, and
clicking the box runs applyView(), which re-lays the grid out and drops the
scroll back to the top - so without it the frame published the TOP of the
gallery under a caption about its bottom. `press:` with no `on=` goes to the
keyboard, and the End key with focus on the just-clicked box scrolls the
document; the walker then anchors the body walk to that band.
The tile reads "HIDE hidden tools" in the shot, not "Show" - it is a toggle and
the recipe has just pressed it. The alt says so rather than quoting the resting
label the prose above already gives.
There is no standalone per-card "hide" button
(unlike the always-visible fav/pin corner icons) - Hide only exists inside a
tile's right-click menu or the bulk bar, both confirmed in views/gallery.ts.
The recipe goes the bulk-bar route since it needs no `|right` context-menu
step: tick the card (`[data-select="qr-code"]`, the same checkbox hook the
selection bullet under Projects uses), click the bar's Hide button
(`[data-bulk="hide"]` - the literal `data-bulk` value bulkBarHtml() writes,
confirmed in lib/bulk-bar.ts), then click the grey reveal tile
(`.gtile--hiddenbox`, confirmed in gallery.ts).
-->

Para agir em vários cartões de uma vez, marque a caixa de cada cartão, arraste uma caixa de seleção pelo espaço vazio ou use **Shift/Cmd-click**, e uma barra de ações flutuante aparece. **O que a barra de seleção oferece** muda um pouco por visão, já que nem toda ação faz sentido em todo lugar:

- **Ferramentas / Utilitários:** Favoritar (ou Desfavoritar), Ocultar (ou Reexibir), Disponível offline (ou Remover do offline), **Ver sessões** (abre Projetos mostrando só as sessões feitas com aquelas ferramentas) e Copiar link quando exatamente um cartão está selecionado.
- **Ativos:** Favoritar e Ocultar valem para qualquer seleção; Duplicar, Baixar e Excluir só aparecem quando todos os itens selecionados são uploads seus - um ativo compartilhado do design system é um contrato permanente, então esses três continuam fora dele mesmo em lote.
- **Projetos:** veja [Encontre e recupere seu trabalho](/info/find-your-work.html#find-something-you-saved).

> Uma armadilha de rótulo: **Ver sessões** só existe quando algo está *selecionado*. Clicar com o botão direito em um único cartão não selecionado oferece, em vez disso, **N sessões salvas**, que abre uma lista das sessões salvas daquela ferramenta, onde uma exclusão move a sessão para a Lixeira, em vez de navegar até Projetos.

![A barra de seleção da galeria para duas ferramentas, oferecendo Available offline, View sessions, Favourite e Hide](/t/url-shot?url=%2F%23%2F&width=1440&height=900&dpi=192&waitMs=1600&css=.welcome-dialog%2C.personalize-nudge%7Bdisplay%3Anone%21important%7D&drive=click%3A%5Bdata-select%3D%22qr-code%22%5D%3Bclick%3A%5Bdata-select%3D%22gradient%22%5D&waitSelector=.gallery-view%5Bdata-shots-settled%5D&walker=1&format=svg&dark=1&filename=misc-bulkbar-gallery&cropSelector=.gallery-bulkbar)
<!--
SHOT NOTE (misc-bulkbar-gallery): drive targets `[data-select="qr-code"]` /
`[data-select="gradient"]` - the `.tile-check[data-select="<ref>"]` checkbox button
confirmed directly in views/gallery.ts's card markup (the same attribute
cardMarkup gives every tile), so these two clicks tick both cards without
opening either tool.

SHOT NOTE (misc-sessions-by-tool, NOT PUBLISHED): the "View sessions" result
had a recipe of its own (`/#/p?tools=qr-code,d3`, views/projects.ts's
toolsBodyHtml()), dropped here because it has no `drive=` that can
manufacture its own content - a saved session isn't a click away, it has to
already exist, and build-docs-shots.ts gives every shot a fresh
`browser.newContext()`. It would publish an empty list. Same dependency the
`projects` shot (now on find-your-work.md) carries; revisit if the pipeline gains a
storage-seeding hook.
-->

### Ask Lolly

Quando você prefere perguntar em vez de procurar, o **Ask Lolly** (`#/ask`) recebe uma pergunta digitada e devolve a seção correspondente desta documentação **na íntegra** - as palavras dos próprios guias, não um resumo nem uma geração - com a página de origem citada e um link **Abrir na documentação** ao lado. Abaixo da resposta ficam os lugares do app que a mesma pergunta encontra: uma ferramenta, uma configuração, um projeto salvo, cada um como um botão que simplesmente leva até lá.

A transcrição é memória de sessão: faça uma pergunta de acompanhamento e a conversa vai se acumulando conforme você avança; recarregue a página e ela começa do zero. Os resultados de busca trazem uma linha **Ask Lolly: *sua consulta*** no fim - abaixo dos resultados concretos que os outros grupos encontraram - que passa a pergunta adiante, então você pode começar na barra e terminar aqui.

## A tela (pré-visualização)

A pré-visualização sempre mostra exatamente o que será exportado.

**Desktop**

- **Zoom:** Cmd/Ctrl + rolagem, ou pinça no trackpad - o zoom é centralizado no seu ponteiro.
- **Deslocar (pan):** segure **Espaço** e arraste, ou arraste com o **botão do meio do mouse**. (Cliques simples continuam livres para clicar em partes do design.)
- **Teclado:** `0` = ajustar à janela · `1` = 100% · `+` / `−` = zoom.
- **HUD de zoom:** o pequeno controle `−  NN%  +  Fit` no canto. Clique na porcentagem para alternar entre Fit ↔ 100%.

![O HUD de zoom no canto da tela - menos, a porcentagem ao vivo, mais, Fit, depois os interruptores de tema e som](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools&width=1440&height=900&dpi=192&waitMs=2500&css=.stage-nav%7Bopacity%3A1!important%7D&cropSelector=.stage-nav&walker=1&format=svg&dark=1&filename=use-zoom-hud)

**Toque**

- **Pinça** para dar zoom, **arraste** para deslocar, **toque duplo** para voltar ao ajuste.

**Clique para ir direto a um controle:** clique em qualquer elemento do design e o campo correspondente na barra lateral recebe foco e é rolado até ficar visível - no caso de um grupo de linhas repetidas, ele abre exatamente a linha que você clicou, então editar o que você vê está a um toque de distância.

Uma mudança de dimensão sempre encaixa a visualização de volta a um ajuste limpo.

### A tela livre (Design)

Ferramentas de tela livre adicionam uma superfície de trabalho *ao redor* da prancheta, como a mesa de composição de um designer:

- **Preparação fora da tela.** Arraste uma caixa para além da borda do quadro e ela permanece totalmente **visível e selecionável** - estacione elementos de lado enquanto organiza a composição, depois arraste-os de volta para dentro. Tudo fora do quadro fica **suavemente esmaecido** para que a área de exportação sempre seja identificada rapidamente, e o quadro mantém sua sombra para marcar exatamente onde o arquivo começa.
- **Só o quadro é exportado.** O arquivo exportado é limitado pela prancheta - tudo o que fica fora (ou a parte de uma caixa que ultrapassa a borda) é simplesmente cortado do resultado, tanto em formatos raster quanto vetoriais.
- **Afaste o zoom além do Fit** (até 20%) para ver toda a mesa de composição quando você tiver posicionado elementos bem longe do quadro.
- **Prancheta redimensionável.** Alterar as dimensões de exportação redimensiona o quadro no lugar; as caixas mantêm suas posições, então você pode reenquadrar um layout ao redor do conteúdo existente.
- **Antes de exportar.** A seção Documento do inspetor verifica a estrutura de camadas salva, depois lê a tela estabilizada em busca de texto cortado e contraste de cor lisa. Ela também pergunta ao mesmo registro de fontes usado no contorno de SVG/PDF se cada trecho de texto tem bytes de fonte incorporáveis; fundos de imagem e gradiente são citados como verificações visuais em vez de receberem uma pontuação de contraste inventada.

![O canvas livre do Design - a prancheta com a área de trabalho ao redor](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Fz%3D17ZTfS8MwEMf_mryO5NZ288GHrdqJv1CUvWdtOgppMtJMNv96yaV1iRNEQRBZoblwab53l0-uq915bXgrCOSDpf3LzgANnQ4eI0rrPJn7Gh9cd0sE8lIryxtFIFfatFx6L4F0Mi-11GbUiZYr25QjK3bW-S8I5MnUbRXKCkMgb5uqki6JFFU7rjoXYsSgT8GaLebKZSeGAPkUYypMHp80DeugYYR4J_U7X4XRkY8dFHuTYEJ-jDWM3qoqsEHo4Y20-xJi-SPVaOfRUuAL1hiZXNrG4gH6M85Z5lTAk8x8DdlnPL8gecVfBIEU6F5v0bbCor3VUu4JpOPCKTCWsPI9rBS107d6QyCfRET_Ac6wX36X6UpX-49Ip1mAlMEPkM6QX20aoSpECLTmpadcazPQ9hPlWxboRndWmFEIG1s4Yp3E3Ts-0f4GbcruWHLzlC0frmfpfbGk82LxmD0vUndSTcvXAoknWBKCz5LDSIdiRHV0D2Tfq1BIvdY42Zim5WZ_-n3_mRvwBg&width=1360&height=850&dpi=192&waitMs=3000&format=svg&walker=1&chrome=1&localize=1&dark=1&filename=design)

**Espelhe uma seleção.** Clique com o botão direito em qualquer caixa e escolha **Espelhar horizontalmente** ou **Espelhar verticalmente** para espelhá-la no lugar, ou pressione `Shift+H` / `Shift+V` no teclado - Shift, porque um `V` isolado é a ferramenta Ponteiro. Cada caixa selecionada se espelha em seu próprio eixo em um único passo de desfazer, e o espelhamento é uma transformação real, então ele permanece no SVG, PDF e PNG exportados, não só no canvas.

### Camadas e Inspetor

Em **Camadas**, cada prancheta é um grupo pai recolhível. Selecione o nome dela para saltar até lá, expanda suas camadas e selecione ou reordene objetos dentro dessa prancheta. Mude para **Páginas** para ver miniaturas e a ordem das páginas. As setas do teclado percorrem a lista de camadas; a seta para a esquerda volta ao cabeçalho da prancheta.

O **Inspetor** coloca primeiro os controles de texto ou imagem do objeto selecionado. Use os chips de opção para escolhas rápidas e expanda **Advanced** para detalhes de estilo. Em celulares, abra o **Inspetor** em **Mais ações**. Os controles abrem em uma folha; Escape ou Voltar a fecha mantendo sua seleção.

### Desenhando suas próprias formas (a caneta)

Caixas, círculos e molduras arredondadas cobrem a maioria dos layouts. Quando você precisa de uma forma que não está nessa lista, desenhe-a: o botão **Caneta** da barra (ou a tecla `P`) coloca você no modo de desenho. Três teclas únicas alternam entre os modos - **`V`** de volta ao Ponteiro, **`P`** para a Caneta, **`N`** para a ferramenta de nós (**Editar pontos**) - e o Ponteiro é sempre a saída de onde quer que você esteja.

![A barra de ferramentas da tela livre: uma alça de arraste, o menu do Lolly, depois Ponteiro, Adicionar uma caixa, Caneta, Editar pontos, Linha, Linha do tempo, Pranchetas e Organizar automaticamente](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Ftemplate%3D__blank__&width=1440&height=900&dpi=192&waitMs=2600&css=.fc-toolbar%7Bopacity%3A1!important%7D&cropSelector=.fc-toolbar&walker=1&format=svg&dark=1&filename=pen-editor-rail)

- **Clique** para posicionar um ponto. No tipo de curva padrão, **clicar e arrastar** puxa as alças desse ponto para fora, que é como se desenha uma curva em vez de um canto - segure **Alt** ao clicar para obter um canto duro. (Nos outros tipos de curva, todo ponto posicionado é um canto e o arraste não faz nada; veja **Tipo de spline** abaixo.)
- Os pontos se encaixam na prancheta e nas suas outras caixas conforme você os posiciona, desenhando as mesmas guias que um arraste normal desenha. Alt suprime a grade enquanto você desenha, e tanto a grade quanto as bordas enquanto você arrasta um ponto depois.
- **Clique no seu primeiro ponto** para fechar o traçado e concluir em um só movimento. Caso contrário, pressione **Enter**, clique duas vezes ou simplesmente troque de ferramenta - o desenho é mantido, não descartado.
- **Escape** age um degrau por vez: o primeiro toque abandona o desenho e não grava nada, e o segundo sai da caneta.
- **Delete** durante o desenho remove o último ponto que você posicionou.

O resultado é uma caixa comum na tela. Mova, redimensione, gire, agrupe, alinhe, reordene a pilha, dê a ela um preenchimento, um gradiente, uma sombra ou uma opacidade - um caminho se comporta como qualquer outra caixa, e nenhum desses controles o trata de forma diferente.

Ele já chega pintado, também. O primeiro caminho que você desenha assume o preenchimento e o traço que sua marca dá a um caminho, e depois disso cada novo caminho assume **o que você usou por último** - defina um preenchimento uma vez e siga desenhando, em vez de recolorir cada forma. (Em uma ferramenta cuja marca não diz nada sobre caminhos, um caminho desenhado recebe o traço na cor em que você o viu sendo desenhado, então ele nunca fica invisível.)

**Editando os pontos de novo.** Clique duas vezes na forma (ou use **Editar pontos** na barra do objeto) e os pontos voltam. Arraste um ponto para movê-lo, arraste uma alça para mudar a direção dela, clique em qualquer lugar da curva para inserir um ponto, faça uma seleção elástica em um grupo de pontos e pressione Delete para remover os selecionados. Um caminho sempre mantém pelo menos dois pontos, então você não consegue apagá-lo por acidente.

**Tipo de spline** decide que tipo de curva passa pelos seus pontos, e é a escolha que vale a pena entender:

| Tipo | O que faz |
|---|---|
| **Suave (automático)** | O padrão. Calcula sozinho o comprimento das alças, então clicar-clicar-clicar já dá uma curva realmente suave, sem precisar mexer em alça nenhuma. Se você definir uma alça, ela fixa a *direção* e a curva continua dona do comprimento. |
| **Alças Bézier** | A caneta clássica. As alças são os pontos de controle, e inserir um ponto nunca move a curva. |
| **Pelos pontos** | Passa exatamente por cada ponto que você posicionou, sem alças. |
| **B-spline** | Flui perto dos pontos em vez de passar por eles, para uma forma mais macia. |
| **Linhas retas** | Uma polilinha. |

Trocar um caminho existente para um tipo que calcula as próprias alças pede confirmação antes, porque os comprimentos de alça que você definiu não podem ser recuperados - trocar para **Alças Bézier** é sempre sem perdas. Durante o desenho não há aviso: a troca vale direto no rascunho, e as alças que você já tivesse puxado vão junto. Nos tipos que são donos das próprias alças, inserir um ponto remodela a curva levemente; em **Alças Bézier**, não.

Cada ponto também carrega uma regra de continuidade, indicada pelo seu formato na tela - quadrado para **Canto** (as alças se movem independentemente), redondo para **Suave** (as alças ficam alinhadas), redondo com um anel para **Simétrico** (alinhadas e do mesmo comprimento). Defina-a para quaisquer pontos selecionados e a curva se reajusta na hora.

![Dois caminhos de caneta renderizados direto de um link: uma curva em S traçada e uma mancha fechada preenchida](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Fboxes%3D%5B%7B%22id%22%3A%22paper%22%2C%22kind%22%3A%22box%22%2C%22x%22%3A0%2C%22y%22%3A0%2C%22w%22%3A1080%2C%22h%22%3A1080%2C%22shape%22%3A%22rect%22%2C%22bg%22%3A%22%23ffffff%22%7D%2C%7B%22id%22%3A%22curve%22%2C%22kind%22%3A%22path%22%2C%22x%22%3A140%2C%22y%22%3A180%2C%22w%22%3A800%2C%22h%22%3A420%2C%22shape%22%3A%22rect%22%2C%22bg%22%3A%22%22%2C%22stroke%22%3A%22%234f84ba%22%2C%22strokeW%22%3A14%2C%22path%22%3A%221!cubic!0_.02!.85!!!.25!-.45!s_.5!.5!-.22!.32!.22!-.32!y_.98!.12!-.25!.45!!!s%22%7D%2C%7B%22id%22%3A%22blob%22%2C%22kind%22%3A%22path%22%2C%22x%22%3A340%2C%22y%22%3A620%2C%22w%22%3A400%2C%22h%22%3A320%2C%22shape%22%3A%22rect%22%2C%22bg%22%3A%22%23d1e7ff%22%2C%22stroke%22%3A%22%234f84ba%22%2C%22strokeW%22%3A6%2C%22fillRule%22%3A%22nonzero%22%2C%22path%22%3A%221!catmull-rom!1_.5!0_1!.42_.78!1_.22!1_0!.42%22%7D%5D&width=1440&height=900&dpi=192&waitMs=2600&cropSelector=%23tool-canvas&walker=1&format=svg&dark=1&filename=pen-path-geometry)

Um caminho desenhado viaja no link como tudo o mais, então uma forma que você desenha reabre a partir de um link compartilhado e renderiza de forma idêntica pela CLI. Nada nele depende do editor.

### Combinando formas (operações de caminho)

Selecione duas ou mais formas, **clique com o botão direito** na tela (toque com dois dedos no touch) e o menu oferece as operações que você espera de um app de desenho:

- **União** mescla as formas em uma só, mantendo a pintura da que está mais acima.
- **Subtrair** recorta tudo o que está acima da forma de baixo.
- **Interseção** mantém apenas a sobreposição.
- **Excluir** mantém tudo, menos a sobreposição.

Mais três funcionam em uma única forma: **Contornar traço…** transforma um traço em uma forma preenchida com o mesmo contorno (útil quando você quer preservar uma espessura exatamente como foi desenhada), **Deslocar caminho…** faz a silhueta crescer para fora ou, com um número negativo, encolher para dentro, e **Simplificar** reconstrói um caminho com menos segmentos mantendo a mesma forma.

![Uma lua crescente e um anel com um furo de verdade, ambos produzidos por Subtrair](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Fboxes%3D%5B%7B%22id%22%3A%22paper%22%2C%22kind%22%3A%22box%22%2C%22x%22%3A0%2C%22y%22%3A0%2C%22w%22%3A1080%2C%22h%22%3A1080%2C%22shape%22%3A%22rect%22%2C%22bg%22%3A%22%23ffffff%22%7D%2C%7B%22id%22%3A%22crescent%22%2C%22kind%22%3A%22path%22%2C%22x%22%3A120%2C%22y%22%3A330%2C%22w%22%3A374%2C%22h%22%3A400%2C%22shape%22%3A%22rect%22%2C%22bg%22%3A%22%234f84ba%22%2C%22path%22%3A%221!cubic!1_.750491!.957645!-.128211!-.062578!-.065985!.027232!c_.534759!1!.076762!!-.295339!!c_0!.5!!.276142!!-.276142!c_.534759!0!-.295339!!.200102!!c_1.000984!.254923!-.09169!-.152161!-.021205!-.003239!c_.935829!.25!.022185!!-.221505!!c_.534759!.625!!-.207107!!.14459!c%22%7D%2C%7B%22id%22%3A%22ring%22%2C%22kind%22%3A%22path%22%2C%22x%22%3A580%2C%22y%22%3A330%2C%22w%22%3A400%2C%22h%22%3A400%2C%22shape%22%3A%22rect%22%2C%22bg%22%3A%22%234f84ba%22%2C%22fillRule%22%3A%22nonzero%22%2C%22path%22%3A%221!cubic!1_1!.5!!-.276142!!.276142!c_.5!1!.276142!!-.276142!!c_0!.5!!.276142!!-.276142!c_.5!0!-.276142!!.276142!!c*1!cubic!1_.5!.7!-.110457!!.110457!!c_.7!.5!!.110457!!-.110457!c_.5!.3!.110457!!-.110457!!c_.3!.5!!-.110457!!.110457!c%22%7D%5D&width=1440&height=900&dpi=192&waitMs=2600&cropSelector=%23tool-canvas&walker=1&format=svg&dark=1&filename=path-ops-boolean-result)

O resultado é um novo caminho que você pode continuar editando com a caneta. Furos são furos de verdade - um controle **Regra de preenchimento** no painel de traço decide se contornos sobrepostos preenchem (*não zero*) ou perfuram (*par-ímpar*).

Duas coisas que essas operações deliberadamente não fazem. Elas **recusam em vez de destruir**: peça a interseção de duas formas que não se sobrepõem e você é avisado de que não há nada a manter, e nada muda. E caixas de texto e de imagem não têm contorno com que trabalhar, então são deixadas de lado em vez de aproximadas pelo seu quadro. Um resultado combinado é armazenado como curvas Bézier simples, que é o que um app de desenho também faz - o tipo de spline original não sobrevive à operação.

### Cenas 3D

Escolha **Cena 3D** no menu de adicionar na barra da ferramenta e arraste para criar um quadro: o 3D Studio abre imediatamente na nova caixa, e o que você define lá volta para a tela. Em todos os outros aspectos, uma caixa de cena é uma caixa comum. Mova-a, redimensione-a, gire-a, dê a ela uma sombra, coloque-a em um slide ou na linha do tempo, e ela se comporta como as demais.

**Uma caixa de cena guarda a receita, não uma imagem.** Uma caixa de imagem contém um arquivo renderizado; uma caixa de cena contém uma única configuração, a cena em si, escrita como a própria consulta de link do 3D Studio, com todo valor ainda no padrão do estúdio deixado de fora. É por isso que uma cena tem cerca de cem bytes, em vez dos poucos quilobytes que uma receita inteira custa, por isso a mesma string funciona em um link de compartilhamento e na porta do editor, e por isso um novo controle do estúdio não exige nenhuma mudança no Design. É também por isso que a caixa é renderizada de novo no tamanho e no momento que o documento pedir, em vez de ser ampliada a partir de uma imagem tirada antes. As imagens que uma cena usa continuam sendo ativos e viajam por id, então um upload dentro de uma cena entra em um arquivo `.lolly` junto com o resto do documento.

**Edite-a no estúdio.** Selecione a caixa e o inspetor mostra uma seção **Cena 3D**: uma linha que nomeia do que a cena é feita, uma segunda que nomeia seu estúdio de iluminação depois que você escolher um, e um botão, **Editar no 3D Studio**. O botão abre o estúdio na cena dessa caixa com todos os controles que a ferramenta tem. Aplique, e a cena editada é gravada de volta como um único passo, então um desfazer devolve a caixa à cena de onde você partiu; feche o estúdio sem aplicar e nada muda. Tudo o mais sobre a caixa - seu lugar na prancheta, seu tamanho, sua sombra, quando ela chega em um slide - permanece nas seções que sempre usou. Uma caixa de cena não tem imagem própria nem legenda: sua imagem vem do estúdio, e suas palavras também são definidas lá.

**Uma cena ao vivo, um pôster em toda outra caixa.** Toda caixa 3D em um documento mostra um pôster: uma imagem estática da cena, desenhada fora da tela através do pool de renderização compartilhado, no tamanho que a caixa ocupa. Um documento com vinte cenas custa um contexto de desenho, não vinte. Selecione uma caixa de cena e ela se torna a única cena ao vivo do documento; deselecione-a e o quadro que estava na tela se torna seu pôster, então nada salta. Apenas uma cena fica ao vivo por vez, e selecionar duas caixas de cena ao mesmo tempo deixa as duas como pôsteres. Nesta versão, a cena ao vivo é para olhar, não para orbitar: mude uma cena por **Editar no 3D Studio**. Um dispositivo que não consegue abrir um contexto gráfico de ponto flutuante mantém o pôster e diz por quê dentro da caixa, em vez de mostrar um retângulo em branco, e o resto do documento não é afetado. Abrir um documento do Design sem nenhuma caixa 3D não carrega nenhum código 3D.

**Na linha do tempo**, uma caixa de cena segue o cursor de reprodução como um clipe de vídeo: seu início, o corte de entrada e a velocidade movem a cena através de sua própria animação, e a duração da cena é a que você definiu no 3D Studio, então aparar uma caixa para deixá-la mais curta mostra menos da cena, em vez de acelerá-la. Só a caixa de cena selecionada fica ao vivo; todas as outras são uma imagem estática, e uma imagem estática não pode ser arrastada no tempo.

**Em uma exportação**, cada cena é desenhada de novo no tamanho que o arquivo precisa, pelo mesmo renderizador que o estúdio usa. Um vídeo renderiza um quadro por cena a cada momento; um PNG, SVG ou PDF incorpora uma imagem por caixa no tamanho de pixel próprio da caixa. Nada é fotografado fora da tela, então uma exportação não depende de qual caixa você tinha selecionado. Uma cena que não pode ser desenhada faz a exportação falhar e diz por quê, nas próprias palavras do estúdio.

**Compartilhar uma cena feita a partir do seu próprio upload.** Um link de compartilhamento de um documento do Design carrega um id de upload local do dispositivo dentro de uma cena tal como ela está, onde uma caixa de imagem o deixaria em branco. Então uma cena cuja arte ou modelo é um arquivo que você enviou mostra o padrão do estúdio para essa imagem no dispositivo de outra pessoa, a menos que o documento viaje como um arquivo `.lolly`, que carrega os bytes.

## Linha do tempo (Sequência)

**Sequência** é a linha do tempo do Design: ela acrescenta *tempo* à tela livre. Cada caixa pode começar em um momento, durar um tempo e animar na entrada e na saída, e uma linha do tempo acoplada abaixo da prancheta é onde você as organiza. Abra-a e já há uma sequência tocando - um cartão de título, um clipe, um cartão final, um lower-third e uma trilha musical - de modo que o modelo fica visível antes de você mudar qualquer coisa.

![A linha do tempo da Sequência: o transporte, a régua, uma trilha de sobreposição, a linha de sequência magnética com seus clipes e chips de emenda e a faixa Always on](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Fz%3D11dZBb5swFADgX8MOiRYZB0J76GFpNO2wnbr7ZMwDrBg7s01C8usngmNwSqJszaT2aD8_G54_PUgJXRdK1iJ7CvAcpSHG6FMqG9BPQbwMkmWAMcsCjIP5lwDjUsp1O8DPAcZrJvpIKhsXaLpZ1I323mjXjcJHbCdKO4Ee7ISSxsvQJdmAO0cBNe6gtHDzQbKkkks101ARYRidaaBSZETtg2TlMgw0xuX8LBXANCN7PTVyWki3Kr-6b61yQmG4ay6FeWEHOL1K1E0TzgrhdqIgDCiXs_WjFcsyDi66A1aU_ZMuEPIOcwFNhHYRzgR8GySGs9CW0BDlFzWrVTe2qdCwftOcZP2TtJEfuovFyKZzIvor0fD7WKhVGzsXo2ALhH8UMxvFqmtiXmQFpmSimArYBfGzYHpKZcVEcS87-OHedpK72cHndmYWunu6rtxM-3wuwGqTXskacov-nhs15KNYG7HgWZtMvpNa0LJtUJNJi-2rYhnZ3ybtuNUVZuj9MotOrAbQFmPQbuB0uxwud4NX9-ycrmWIJw59Pg9h5AF6RGd-5vgWPhvG-2b5xs8bl5zvZ0ZK3tf_bd0pxu_lw2YDG2Jv6VRdj9Hi__WrKB7pV3OELuBKIRunReqM9f8d1tbnKPFsJVHs2Zqf9SaMLrSmASCjiNAbokD0lD0t_95Wxu-MVaQ4uT6WQ8ta0V46Z6lq9br1fVEOh7ypju-FFyjBC7fmVy0UaMm3YBcbVYMt-dhfTlUbe2BOuD6ujFd_AA&width=1440&height=900&dpi=192&waitMs=7000&waitSelector=.tl-clip&css=.tl-panel%7Bheight%3A252px!important%7D&cropSelector=.tl-panel&format=svg&walker=1&tolerance=0.03&dark=1&filename=seq-studio-timeline)

Há dois tipos de linha, e a diferença é a ideia toda:

- A **linha de sequência** é *magnética*. Os clipes ficam colados, um depois do outro, e arrastar um deles reordena a sequência em vez de deixar um buraco. Exclua um clipe e o resto se fecha. Essa é a sua espinha dorsal.
- As **faixas de sobreposição** são livres. Um lower-third, um logo, uma legenda - qualquer coisa que flutue sobre a espinha dorsal no seu próprio tempo - ganha sua própria faixa e seu próprio início.
- Abaixo delas, **Sempre ativo** reúne as caixas sem tempo nenhum: cenário que simplesmente está presente do começo ao fim. O `+` em um chip promove uma delas para uma faixa; **Deixar sempre ativo** a manda de volta.

![O palco de edição: a prancheta à frente e ao centro, o trilho de ferramentas à esquerda e o HUD de zoom no canto](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Fz%3D11dZBb5swFADgX8MOiRYZB0J76GFpNO2wnbr7ZMwDrBg7s01C8usngmNwSqJszaT2aD8_G54_PUgJXRdK1iJ7CvAcpSHG6FMqG9BPQbwMkmWAMcsCjIP5lwDjUsp1O8DPAcZrJvpIKhsXaLpZ1I323mjXjcJHbCdKO4Ee7ISSxsvQJdmAO0cBNe6gtHDzQbKkkks101ARYRidaaBSZETtg2TlMgw0xuX8LBXANCN7PTVyWki3Kr-6b61yQmG4ay6FeWEHOL1K1E0TzgrhdqIgDCiXs_WjFcsyDi66A1aU_ZMuEPIOcwFNhHYRzgR8GySGs9CW0BDlFzWrVTe2qdCwftOcZP2TtJEfuovFyKZzIvor0fD7WKhVGzsXo2ALhH8UMxvFqmtiXmQFpmSimArYBfGzYHpKZcVEcS87-OHedpK72cHndmYWunu6rtxM-3wuwGqTXskacov-nhs15KNYG7HgWZtMvpNa0LJtUJNJi-2rYhnZ3ybtuNUVZuj9MotOrAbQFmPQbuB0uxwud4NX9-ycrmWIJw59Pg9h5AF6RGd-5vgWPhvG-2b5xs8bl5zvZ0ZK3tf_bd0pxu_lw2YDG2Jv6VRdj9Hi__WrKB7pV3OELuBKIRunReqM9f8d1tbnKPFsJVHs2Zqf9SaMLrSmASCjiNAbokD0lD0t_95Wxu-MVaQ4uT6WQ8ta0V46Z6lq9br1fVEOh7ypju-FFyjBC7fmVy0UaMm3YBcbVYMt-dhfTlUbe2BOuD6ujFd_AA&width=1440&height=900&dpi=192&waitMs=7000&waitSelector=.tl-clip&css=.fc-toolbar%7Bopacity%3A1!important%7D&format=svg&walker=1&tolerance=0.03&dark=1&filename=seq-studio-stage)

Abrir a linha do tempo dá o teclado a ela, então Espaço e as setas dirigem o cursor de reprodução em vez da página - e, como ela abre sozinha em uma composição que já tem tempo, isso vale desde o momento em que a Sequência carrega.

> **[O editor de sequência](/info/sequence-editor.html)** aprofunda as quatro coisas que decidem se editar no tempo é previsível: qual clipe um clique na tela edita, os fantasmas em papel-cebola dos clipes vizinhos, o escopo da divisão e o Juntar que desfaz um corte, e o aparar (incluindo o conjunto de atalhos de teclado). Pressione `?` com a linha do tempo em foco para ver a folha de atalhos.

**Editando.** Arraste o meio de um clipe para movê-lo ou reordená-lo, arraste a poucos pixels de qualquer uma das pontas para apará-lo e pressione **Dividir no cursor de reprodução** (ou `S`) para cortar um clipe em dois. A divisão precisa de um clipe com uma **Duração** real e do cursor de reprodução um pouco para dentro dele, então um clipe em aberto (a trilha musical, por exemplo) não pode ser dividido. **Encaixar nas bordas** vem ativado por padrão e encaixa nas bordas dos clipes, no cursor de reprodução e em segundos inteiros, com Alt para ignorar. Cada arraste é um único passo de desfazer, e a pré-visualização do arraste faz a mesma aritmética que a confirmação, então o que você vê ao arrastar é o que você obtém.

Selecione um clipe e o inspetor oferece as mesmas edições em números: **Duração**, **Aparar entrada** (a que altura da fonte ele começa), **Velocidade** como um conjunto de multiplicadores fixos de ×0,25 a ×4, **Animar entrada** / **Animar saída** com suas durações e **Silenciar clipe**. Um clipe na linha magnética não tem campo **Início**, de propósito - a linha é dona da ordem, então você arrasta para movê-lo.

**Transições** são presets, não quadros-chave: Esmaecer, Pop, Crescer, Subir, Cair, os quatro Deslizes, Zoom para dentro e para fora, Inclinar, Mergulho, Girar, Deriva ou **Cortar (sem animação)**. As distâncias escalam com o objeto, então o mesmo preset funciona igualmente bem em um cartão de tela cheia e em um selo pequeno. Entre dois clipes adjacentes na linha de sequência há um **chip de emenda**: clique nele e escolha **Cortar** ou **Crossfade**, que se aplica na hora e fecha. Abra o mesmo chip de novo para mudar a **Duração (ms)** e pressione **Concluído**. Um crossfade é armazenado como uma saída em fade de um clipe e uma entrada em fade do próximo, e a dissolução real é derivada desse par: o primeiro clipe continua reproduzindo além do corte e sai em fade, enquanto o próximo entra em fade por baixo dele. A pré-visualização e o arquivo seguem a mesma regra, então o que você vê na emenda é o que você exporta.

**Som.** Adicione um clipe de **Áudio** e ele vive na linha do tempo como qualquer outro clipe: forma de onda, aparar, silenciar. (A trilha gerada que vem na sessão padrão é a única exceção - ela é sintetizada no momento da exportação, então sua barra fica lisa e silenciosa até você renderizar.) Pressione o microfone para **gravar uma locução** direto na linha do tempo, com contagem regressiva e medidor de nível, e a gravação é salva como um ativo seu no ponto em que você começou. Pressione a câmera ao lado dele para **gravar um vídeo** da mesma forma: a gravação é cortada para o tamanho de exportação da prancheta enquanto grava, então a pequena autovisualização mostra exatamente o que entra na sequência no cursor de reprodução, em quadro cheio - a maneira de reunir o clipe de um colega a partir de um link compartilhado. Música, diálogo e a trilha do próprio clipe chegam todos à mixagem exportada. (A **Faixa de áudio** do painel de exportação é outra coisa: uma única trilha colocada sob o clipe inteiro, com fade e ducking. As duas coexistem.)

**A faixa de áudio.** Selecione qualquer clipe que tenha som e uma faixa compacta abre abaixo da linha do tempo: um fader de **Volume**, **Panorâmica** para a posição estéreo, um **EQ** de três bandas (**Baixo**, **Médios**, **Alto**), um controle de **Tom** que transpõe em semitons enquanto a voz mantém seu caráter, e **Normalizar volume**, que leva o clipe à sonoridade de transmissão (BS.1770), para que uma nota de voz baixa e uma faixa alta fiquem niveladas. Onde dois clipes se encontram, **Crossfade** mescla a junção em vez de cortar. Um slot de **Efeito** roda um processamento no dispositivo sobre o clipe - **Limpeza de voz** tira o ambiente e o chiado de uma gravação. Mudanças de velocidade também mantêm o tom: um clipe desacelerado ou apressado é esticado no tempo, não vira uma voz de desenho animado. A cada mixagem, a exportação abaixa a música sob a fala conforme ela vai e vem e mantém o programa inteiro sob um limitador de pico verdadeiro, então nada estoura na saída; uma forma de onda que teria estourado é desenhada com um aviso onde isso acontece.

![A linha do tempo com o clipe de música selecionado: sua faixa fica ao longo da parte inferior com Velocidade, Fades, Volume, Panorâmica, EQ, Tom, Normalizar volume e o slot de Efeito](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Fbx%3Dt1%252Ctext%252C200%252C140%252C1500%252C220%252C0%252Crect%252C16%252C%252C100%252C%252Ccontain%252Cnormal%252CVoiceover%252520session%252C%25257Bcolor.semantic.text%25257D%252C48%252Ccenter%252Cmiddle%252C500%252Csans%252C1.12%252C0%252Ctrue%252Cfalse%252C%252C%252C8%252Cnone%252C00000055%252C0%252C0%252C10%252Ccenter%252Cfalse%252C%252C%252C0%252Cnonzero%252C0%252C3.3%252C0%252C1%252Cnone%252Cnone%252C400%252C400%252Cfalse%252Cseq%252C%252Cround%252Cround%252C%252C0%252C0%252C0%252C0%252C%252C%252C%252C0%252Ctrue%252Cnone%252Cnone%252C%252Cfalse%252C%252C%252C%252C0%252C%252C%252Cfalse%252C%252C%252C%252C%252Cfalse%252Cfalse%252C%252C1%252C%252Cfalse%252C%252C60%252C%252C%252C1%257Ea1%252Caudio%252C200%252C500%252C400%252C80%252C0%252Crect%252C16%252C%252C100%252Clolly%25252Floops%25252F3-am-echoes%252Ccontain%252Cnormal%252C%252C%25257Bcolor.semantic.text%25257D%252C48%252Ccenter%252Cmiddle%252C500%252Csans%252C1.12%252C0%252Ctrue%252Cfalse%252C%252C%252C8%252Cnone%252C00000055%252C0%252C0%252C10%252Ccenter%252Cfalse%252C%252C%252C0%252Cnonzero%252C0%252C3.3%252C0%252C1%252Cnone%252Cnone%252C400%252C400%252Cfalse%252C%252C%252Cround%252Cround%252C%252C0%252C0%252C0%252C0%252C%252C%252C%252C0%252Ctrue%252Cnone%252Cnone%252C%252Cfalse%252C%252C%252C%252C0%252C%252C%252Cfalse%252C%252C%252C%252C%252Cfalse%252Cfalse%252C%252C1.3%252C%252Cfalse%252C%252C60%252C%252C%252C1%26_sel%3Da1&width=1440&height=900&dpi=192&waitMs=5000&waitSelector=.tl-clip&css=.tl-panel%7Bheight%3A300px%21important%7D&cropSelector=.tl-panel&walker=1&format=svg&dark=1&filename=tl-audio-strip&drive=click%3Abutton%3Ahas-text%28%22Inspector%22%29)

**Renderizando.** Uma exportação com movimento é um **composto determinístico**, não uma gravação de tela - cada quadro é decodificado, desenhado e codificado em um tempo exato, então o arquivo não depende de a sua máquina dar conta, e não há um teto prático de quadros em MP4 ou WebM. A duração da própria linha do tempo define o tempo total, a menos que você digite um. Os Content Credentials são carimbados como em qualquer outra exportação. Uma exportação estática entrega o quadro no cursor de reprodução, ou uma folha de contato inteira a partir do campo **Quadros** ao lado do tamanho de saída - veja [Exportação](/info/exporting.html#stills-from-a-timed-composition).

Alguns limites a ter em mente: uma sequência é limitada a uma hora, GIF e PNG animado guardam seus quadros em buffer, então ficam curtos, um clipe reproduzido mais rápido ou mais devagar mantém seu tom (a faixa de áudio o estica no tempo, e um controle de **Tom** transpõe em semitons mantendo o caráter da voz) e **Gravar ao vivo** fica oculto aqui porque o compositor é o caminho melhor.

**Além das predefinições: quadros-chave, profundidade e uma câmera.** Uma transição anima um clipe conforme ele chega e sai. Para posicionar uma caixa *dentro* de um clipe - deslocá-la, esmaecê-la, desfocá-la, levantá-la da página e assentá-la de volta - adicione quadros-chave: selecione o clipe, pressione **+Keyframe** (o losango no conjunto de ferramentas da timeline, o losango na barra de objetos da tela ou `K`) e a posição do cursor de reprodução decide qual pose sua próxima edição grava. O mesmo sistema de quadros-chave dá a toda composição temporizada uma **câmera** que se aproxima, faz panorâmicas e ajusta o foco, transformando um único SVG plano em uma pilha de camadas entre as quais você pode voar. **[Animação](/info/animating.html)** é o guia completo.

A ferramenta Design tem a mesma linha do tempo, então você pode dar tempo a um layout sem trocar de ferramenta, e ela também exporta movimento.

## Apresentando

Para colocar sua câmera, um logotipo e uma legenda de nome sobre a imagem da plateia, use **Present with camera**. Seus controles privados, cenas salvas, etapas de compartilhamento e gravação são abordados em [Apresentando com câmera](/info/presenting.html). Os controles comuns da apresentação abaixo continuam disponíveis por **Apresentar**.

Um documento do Design feito de **pranchetas** já é uma apresentação. Abra o **menu do Lolly** na barra de ferramentas e escolha **Apresentar** - a última linha - e cada prancheta vira um slide em tela cheia, na ordem em que as pranchetas estão na tela. A apresentação roda sobre uma cópia das pranchetas renderizadas, então o editor por baixo nunca é tocado e sair coloca você de volta exatamente onde estava.

- **Avançar** com **Espaço**, `→`, **Page Down** ou um clique na faixa na borda direita da tela; volte com `←`, **Page Up** ou a faixa na borda esquerda. **Home** e **End** pulam para o primeiro e o último slide. Uma pequena barra de controles aparece suavemente sempre que você move o ponteiro e se esconde de novo quando você para.
- **Visão geral** (`O` ou o botão de grade) organiza todas as pranchetas de uma vez, no arranjo que você deu a elas no canvas; clique em uma para abri-la.
- **Revelar em etapas.** Clique com o botão direito em uma caixa e escolha **Revelar na etapa 1**, **2** ou **3** em vez do padrão **Sempre visível**. Essa caixa então espera até você avançar até a etapa dela, então um slide pode chegar em partes; caixas com o mesmo número chegam juntas.
- **Visão do apresentador** (`S`) abre uma segunda janela com o slide atual, o próximo, suas anotações para esse slide e um cronômetro em execução. Se o navegador bloquear o pop-up, ela recai em um painel sobre a apresentação. As anotações são definidas por prancheta e nunca aparecem no próprio slide.
- `B` mantém uma tela preta (qualquer tecla traz o slide de volta), `F` retorna à tela cheia e **Escape** descasca uma camada de cada vez: da visão geral de volta à apresentação, da apresentação de volta ao editor.
- **Quiosque.** Dê a uma prancheta uma **Duração** e a apresentação fica ali por esse tempo, depois avança sozinha por trás de uma barra de progresso fina; `K` (ou o botão de pausa, que só aparece quando algo tem uma duração) para e reinicia isso. Adicione `kiosk` ao link e a apresentação recomeça do início quando chega ao fim, o que é o que a torna sinalização digital.

- **Pilhas de sub-slide.** Clique com o botão direito em uma prancheta e escolha **Empilhar sob o slide anterior** e ela se torna uma etapa daquele slide em vez de um slide próprio: a visão geral mostra um único cartão, a apresentação percorre a pilha em ordem, e a linha **Empilhar** do inspetor diz a qual slide ela pertence.
- **Morph.** Quando dois slides consecutivos carregam uma caixa com o mesmo nome de **Correspondência do Transformar** (clique com o botão direito na caixa, ou a linha **Correspondência do Transformar** do inspetor - `hero`, por exemplo), a transição move essa caixa de onde ela estava para onde ela está, redimensionando e recolorindo pelo caminho, em vez de cortar. Uma transição **Morph** para o deck inteiro faz o mesmo para cada par correspondente.
- **Narração.** As **Notas do apresentador** de cada prancheta podem ser lidas em voz alta. Na seção **Documento** do inspetor, escolha uma **Voz**, opcionalmente uma segunda voz para **Misturar com**, a **Velocidade** de leitura, e uma **Entrada** e uma **Cauda** em milissegundos ao redor de cada slide; ative **Mostrar legendas ao apresentar** e as palavras aparecem conforme são faladas. A voz roda no seu dispositivo. As mesmas notas viram o filme em uma exportação de vídeo, áudio real de slide em uma exportação do PowerPoint, e o filme narrado dentro de um [pacote SCORM](/info/create/exporting.html#scorm-course-packages).

![A seção Documento do inspetor: Voz, Misturar com, Velocidade, Entrada, Cauda e Mostrar legendas ao apresentar](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Ftemplate%3Dfeature-tour&width=1440&height=900&dpi=192&waitMs=3500&cropSelector=.fc-insp&walker=1&format=svg&dark=1&filename=design-narration)

O deck também é um link. `?present` abre direto nele, `s=` escolhe o slide - uma posição, o id de uma prancheta ou `id.step` para uma etapa de revelação - e o endereço se atualiza conforme você avança, então o que você envia é o slide em que está. Para autores de ferramentas: esses parâmetros estão documentados na página [Modo URL](/info/url-parameters.html#reserved-parameters).

## No celular

Em telas estreitas, o layout se reorganiza em uma única coluna:

- Os **controles viram uma folha** no topo, com uma **alça de arraste** na borda inferior. Arraste a alça para redimensioná-la - ela se encaixa em **peek / half / full** (espiada / meia / cheia) - ou **toque** na alça para alternar entre recolhida e expandida. A pré-visualização preenche o espaço abaixo e permanece visível enquanto você edita.
- Um botão flutuante **Exportar** abre a folha de exportação - todos os controles de formato, tamanho, copiar, salvar e baixar em um só lugar. Feche-a tocando no fundo.

![Uma ferramenta em uma tela com largura de celular - os controles como uma folha no topo, a paleta gerada preenchendo a pré-visualização abaixo e a pílula de renderização flutuando na parte inferior central](/t/url-shot?url=%2F%23%2Ftool%2Fcolor-palette%3Fseed%3Df97316%26harmony%3Dadjacent-3%26steps%3D9&width=430&height=900&dpi=192&waitMs=2200&walker=1&format=svg&dark=1&filename=vt-phone-palette)

## Controles (inputs)

As ferramentas expõem apenas os inputs que devem variar - tudo o mais (cores, layout, tipografia, lógica) é fixado pelo autor da ferramenta, então tudo o que você cria segue as regras definidas pelo autor. Os inputs incluem texto, sliders, seletores de cor, menus suspensos, datas, seletores de imagem e grupos de linhas repetidas. Alguns são agrupados em seções recolhíveis.

![A pilha de controles de uma ferramenta - um campo de texto, gatilhos de cor e um slider, e nada mais, porque o autor escolheu travar o resto](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools&width=1440&height=900&dpi=192&waitMs=2500&cropSelector=%23tool-inputs&walker=1&format=svg&dark=1&filename=use-tool-inputs)

**Redefinir:** *Descartar alterações* retorna todos os inputs aos seus valores padrão.

### Desfazer e refazer

**Cmd/Ctrl-Z** volta um passo e **Cmd/Ctrl-Shift-Z** (ou **Cmd/Ctrl-Y**) avança de novo. O mesmo par fica como botões **Desfazer** e **Refazer** na linha acima dos controles - na tela livre eles ficam na barra de ferramentas - e cada um fica esmaecido enquanto não há nada a recuperar. Cada passo diz o que foi: desfaça uma cor e uma pequena mensagem nomeia o input que acabou de ser restaurado, com um botão **Refazer** dentro dela para o caminho de volta.

- **Um arraste é um passo.** Mudanças repetidas no mesmo controle dentro de meio segundo são mescladas, então puxar um slider por toda a sua faixa é um único desfazer, e não duzentos.
- **Os últimos 100 passos são mantidos** - os mais antigos caem fora. Fazer uma edição nova depois de desfazer limpa a pilha de refazer, como acontece em qualquer outro lugar.
- **Enquanto seu cursor está em uma caixa de texto**, Cmd/Ctrl-Z pertence ao próprio campo, caractere por caractere. O Lolly assume o comando dos controles que não têm um desfazer útil próprio: sliders, menus suspensos, cores e interruptores.
- **Escolher um arquivo** em um input do tipo **file** não é um passo - esses bytes ficam guardados só durante a sessão, então não haveria nada para repor.

Em uma [colaboração](/info/collaborate.html) ao vivo, o histórico continua sendo só seu. Uma alteração vinda do outro dispositivo nunca entra na sua pilha, então desfazer só pode reverter algo que você mesmo fez.

Desfazer alcança apenas o que aconteceu durante esta visita; ferramentas que salvam enquanto você trabalha também guardam versões anteriores em **Histórico**, ao lado de **Undo** (veja [Volte a uma versão anterior](/info/find-your-work.html#go-back-to-an-earlier-version)).

## Seus dados e sua foto de perfil

**Configurações** (no canto superior direito da galeria, mostrando seu primeiro nome depois que você define um) guarda seu nome, dados de contato e uma **foto de perfil** opcional. Ferramentas que pedem esses campos os preenchem automaticamente - defina-os uma vez e sua assinatura de e-mail, lockups e crachás se preenchem sozinhos. Você ainda pode sobrescrever qualquer campo por sessão. Ative **Usar meus dados para criar** para que seus dados viajem junto como autor no que você exporta.

Sua foto de perfil e seus dados ficam **somente neste dispositivo**. Um perfil pode ser mais do que só você - uma equipe ou um papel que você assume de vez em quando. Veja **[Perfis](/info/profile.html)** para o panorama completo, incluindo como manter mais de um.

## Salvando e continuando

Para manter seu trabalho, pressione **Salvar como**, o visto ao lado de **Exportar**. Em **Save to a project**, deixe **Minha biblioteca** selecionado ou escolha um projeto (**＋ Novo projeto…** cria um), depois pressione **Salvar**. Salvar de novo atualiza o mesmo item em vez de criar uma cópia. No Design, **Salvar como** fica no menu sob o logo do Lolly; no celular, toque em **•••**, depois em **File menu**, depois em **Salvar como**.

O botão **Salvar** no painel de exportação faz o mesmo em um clique e nunca baixa um arquivo: o trabalho novo vai para Minha biblioteca, e o trabalho que você salvou antes é atualizado onde está.

Para voltar depois, pressione **Home** no canto superior esquerdo, depois abra a aba **Projetos** (um ícone de pasta no celular). Os salvamentos de Minha biblioteca estão na primeira tela dela; um projeto é uma pasta lá. Itens recebem o nome do arquivo que você digitou no painel de exportação, ou então o nome da ferramenta, como **QR Code**. Abra um e cada configuração está lá, pronta para mudar e exportar de novo.

O trabalho salvo permanece neste dispositivo, no navegador ou app de onde você salvou, a menos que você ative a [Sincronização](/info/sync.html). Um arquivo que você obtém com **Baixar** é uma cópia finalizada; para alterá-lo depois, abra o item salvo em Projetos. Se algo não está onde você espera, veja [Encontre e recupere seu trabalho](/info/find-your-work.html).

![A pílula de renderização em duas metades - uma seta para cima que abre o painel de exportação, e um tique com o rótulo Salvar como que abre a folha de salvamento](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools&width=1440&height=900&dpi=192&waitMs=2500&css=%23tool-inputs%7Bdisplay%3Anone%7D&cropSelector=.render-pill&walker=1&format=svg&dark=1&filename=use-render-pill)

## Projetos

**Projetos**, a aba **Projetos** no topo da tela inicial, guarda tudo o que você salvou, em pastas que você cria. Encontrar, ordenar e buscar seu trabalho lá, e restaurar um item da **Lixeira**, estão em [Encontre e recupere seu trabalho](/info/find-your-work.html#find-something-you-saved).


## Compartilhando seu trabalho

Um design sai de uma de duas formas: como link ou como arquivo. O diálogo de compartilhamento oferece as duas. Abra-o com **Compartilhar** nos controles de exportação; **Compartilhar link** em uma sessão salva em Projetos abre o mesmo diálogo para aquela sessão.

### O link

Cada input é capturado na URL da página, então um link *é* o design. No topo do diálogo fica o link pronto para copiar, com duas seções recolhidas abaixo dele.

- **Opções do link** traz **Abrir no app instalado** (troca o campo por um URI `lolly://` para Atalhos, lançadores e automação, com todos os parâmetros inalterados), **Link mais curto** (um design grande gera uma URL longa, então isso compacta todo o estado em um token compacto e mostra a economia em caracteres; a forma legível continua sempre disponível), **Proteger este link com senha** (AES-256 sobre o link inteiro, com a senha nunca dentro dele) e **Fixar esta versão da ferramenta** - o sinalizador `_v`, que prende o link à versão da ferramenta que você está vendo, para que uma atualização posterior não possa mudar o que ele renderiza.
- **Comportamento do link** é o que acontece quando o destinatário o abre: tela cheia, o painel de exportação já expandido, download ao abrir com `&export` ou copiar para a área de transferência com `&copy`.

Cole o link para um colega, salve nos favoritos ou faça o commit dele. (Detalhes completos: [Modo URL](/info/url-mode.html).)

**Algumas ferramentas fazem do link o produto inteiro.** O Jump Page reúne seus links em uma única página para distribuir - um link de bio, uma palestra de conferência, uma vitrine de loja. Não há nada para hospedar e nenhuma conta por trás disso: a página é o link, então ela abre tão rápido quanto a URL viaja. No editor, você vê a página finalizada ao lado dos campos; um visitante que abre o link a recebe em largura total, um link por cena conforme rola a página.

![Jump Page no editor: a cena do título na parte superior da página, com as cenas de links abaixo](/t/url-shot?url=%2F%23%2Ftool%2Fjump%3Ffull%26heading%3DFind%2520us%2520everywhere%26subheading%3DOne%2520link%2520for%2520everything.%26links%3DURL%252CName%252CEmoji%257Ehttps%25253A%25252F%25252Fexample.com%252CWebsite%252C%257Ehttps%25253A%25252F%25252Fexample.com%25252Fnews%252CNewsletter%252C%257Ehttps%25253A%25252F%25252Fexample.com%25252Fhello%252CSay%252520hello%252C&width=900&height=1300&dpi=96&waitMs=2000&cropSelector=%23tool-canvas&walker=1&format=svg&dark=1&filename=use-jump-page)

**O diálogo diz o que um link não consegue carregar.** Três coisas não cabem em uma URL: uma imagem ou arquivo que você adicionou deste dispositivo, um valor de texto muito longo ou uma lista muito grande. Cada uma é contabilizada enquanto o link é montado. Se alguma coisa precisou ficar de fora, o diálogo diz qual foi e aponta você para o arquivo abaixo, em vez de entregar um link que abre com a imagem faltando. Um link que é apenas *longo* recebe um aviso mais brando, com sua contagem de caracteres, já que a compactação ainda pode resolver o comprimento.

### O arquivo .lolly

`.lolly` é a extensão de pacote portátil do Lolly, não uma promessa de que todo arquivo contém a mesma coisa. O `format` em `manifest.json` é a autoridade. O app lê esse pequeno manifesto primeiro e mostra o tamanho, o conteúdo e a ação antes de gravar qualquer coisa:

- A **shared design** (`lolly-share`) contém uma sessão salva de uma ferramenta, seus arquivos incorporados e um recibo para tudo que ainda resolve por referência. Ele também pode carregar a ferramenta e o design system usado para criá-lo. Abri-lo acrescenta um novo Projeto; nunca sobrescreve uma sessão existente.
- A **shared project** (`lolly-share` do tipo `project`) contém uma pasta de Projetos: suas subpastas, cada sessão salva arquivada nelas, o cartão de cada sessão e as imagens arquivadas ali. Abri-lo acrescenta uma cópia da pasta inteira a Projetos; nada que já está lá é substituído. Um Lolly anterior à existência dos arquivos de projeto não consegue ler um e avisa para atualizar.
- Um **design-system pack** (`lolly-brand`) contém tokens e pode conter fontes, logotipos, versões publicadas e recursos retidos. Abri-lo o acrescenta como um design system nomeado separado, e então muda para ele; os sistemas já no dispositivo permanecem.
- Um **brand workspace / instance pack** é um `lolly-brand` com ferramentas declaradas, ativos de catálogo e, opcionalmente, um endereço de instância. A pré-checagem lista esses efeitos em todo o dispositivo porque carregá-lo substitui a única sobreposição de espaço de trabalho carregada anteriormente.

Um **backup completo de dispositivo/perfil não é um `.lolly`**. Ele continua sendo um `LollyTools-….zip` com formato `lolly-backup`, e restaura por **Configurações → Armazenamento → Importar dados…**, que também pega uma cópia que a Sincronização guarda no seu armazenamento. Uma pasta de ferramenta zipada simples também continua sendo `.zip`. Em outras palavras, pacotes de sessão e de design system são donos do `.lolly`; fluxos de backup e de arquivo solto não são.

**Download .lolly**, no diálogo de compartilhamento da ferramenta em que você está trabalhando, grava o design atual como um pacote de design compartilhado. Ele carrega a sessão salva junto com as imagens e os arquivos disponíveis neste dispositivo. A arte de catálogo comum vai junto também. A arte licenciada é retida a menos que você a inclua explicitamente, e um arquivo desatualizado ou indisponível permanece como uma referência externa em vez de desaparecer. O recibo preparado mostra o tamanho real do `.lolly`, a contagem de arquivos incorporados, a contagem de referências externas e se a ferramenta está incluída. Onde o seu dispositivo tem uma folha de compartilhamento, **Enviar para…** entrega esse arquivo direto a ela (AirDrop, um compartilhamento do Android) em vez de salvá-lo no disco.

**Download project (.lolly)**, no menu de uma pasta em **Projetos**, grava essa pasta como um projeto compartilhado, para que outra pessoa possa abri-la e continuar com cada sessão nela. Cada sessão viaja como sua própria parte (`sessions/<key>.json`, com seu cartão em `thumbs/`), a árvore de pastas é listada em `manifest.json`, e uploads e arte de catálogo viajam sob as mesmas regras de um único design compartilhado. Sessões de lote não são sessões de ferramenta e ficam para trás; o aviso diz quantas. **Baixar originais**, ao lado, continua igual: um zip simples de cada item como seu próprio arquivo.

Um `.lolly` é um zip comum. Renomeie para `.zip` e abra: suas próprias imagens ficam em `assets/uploads/` e a arte de catálogo em `assets/catalog/`, cada uma com seu nome e extensão reais, o `manifest.json` lista todas elas e um README no topo diz o que é o arquivo.

Três coisas são você quem decide antes de ele sair:

- **Se o seu nome entra.** Seu nome, e-mail e organização só são gravados no arquivo quando **Use my details to create** está ativado no seu perfil. Com ele desligado, o arquivo registra que foi feito com o Lolly e quando - nada sobre você.
- **Se arte licenciada entra.** Assets licenciados e travados pela marca ficam retidos por padrão. Se o design usa algum, o diálogo diz quantos e oferece dois botões - *Download without them* ou *Include and download* - porque incluí-los entrega os arquivos reais a quem quer que abra o `.lolly`.
- **Se a ferramenta entra.** **Include the tool** empacota os próprios arquivos da ferramenta junto com o design, para que ele abra em um dispositivo que não tem essa ferramenta. Vem marcado para uma ferramenta personalizada - um fork ou uma ferramenta de marca privada que seu destinatário dificilmente vai ter - e desmarcado para uma ferramenta que o catálogo assinado lista, já que a cópia dele vem da mesma fonte. (Em uma build sem catálogo assinado, toda ferramenta conta como personalizada e a caixa começa marcada.)

**Abrindo um.** Em um app instalado no desktop ou no celular, dê um duplo clique ou toque em um `.lolly`, escolha **Open with Lolly**, ou envie-o ao Lolly pela folha de compartilhamento do sistema. macOS, Windows, Linux, iOS e Android registram todos o formato; os gerenciadores de arquivos do desktop o mostram como um documento do Lolly (e o GNOME Files pode mostrar a miniatura própria de uma sessão salva). No app web, use **Abrir** ou solte o arquivo sobre o Lolly. Toda porta de entrada usa a mesma pré-checagem baseada primeiro no manifesto. Abrir a partir do Brand Studio recomenda a ação de design system quando um design compartilhado carrega um, mas nunca renomeia o arquivo nem oculta **Desenho aberto compartilhado**.

Um documento do iOS ou Android entregue de outro app tem limite de 48 MB, porque a transferência nativa precisa copiar seus bytes através da fronteira entre apps. O app móvel avisa isso em vez de simplesmente ignorar um arquivo grande demais em silêncio. O **Abrir** dentro do Lolly não usa essa transferência; é o caminho a tentar para um pacote maior.

Depois da confirmação, o leitor escolhido descompacta e verifica o pacote uma vez. Os ativos de um design compartilhado vão para a sua biblioteca, sua sessão vai para Projetos e sua ferramenta abre quando disponível. As sessões de um projeto compartilhado vão para Projetos sob uma nova cópia de suas pastas, com novos ids, para que o mesmo arquivo possa ser aberto duas vezes, e a pasta se abre; uma sessão cuja ferramenta este dispositivo não tem espera lá. Um ativo já presente no dispositivo é identificado pelo checksum e reaproveitado. Um pacote de design system é armazenado em seu próprio namespace antes de o app mudar para ele. Arquivos com mais de 100 MB são sinalizados como grandes, e a pré-checagem avisa quando o armazenamento do navegador relata menos espaço livre do que a carga declarada precisa. Cada parte coberta por verificação de integridade é checada antes de a operação ser confirmada; uma cópia danificada é recusada e o destino recém-criado é revertido.

Se o arquivo carrega uma ferramenta que você não tem, o Lolly pergunta antes que essa ferramenta possa rodar: **Confiar nesta ferramenta?** nomeia a ferramenta e seu autor e diz claramente que abri-la roda o código dela no seu dispositivo, com **Confiar e instalar** como o caminho adiante. Recuse e o trabalho compartilhado continua salvo nos seus projetos, esperando ali pelo dia em que você adicionar a ferramenta. (Um tipo de ferramenta ainda não pode ser carregado assim - uma cujo código vem como módulo - e ela é recusada do mesmo jeito.)

Um link e um arquivo entregam, os dois, um instantâneo. Para trabalhar na mesma sessão *ao mesmo tempo* que outra pessoa - dois dispositivos, sem servidor, sem internet se vocês estiverem na mesma rede - veja [Trabalhando juntos](/info/collaborate.html).

## Câmera ao vivo (ferramentas reativas a movimento)

Todo **Filtro** de foto - Halftone, Scanline, Posterize, células de Voronoi, Tratamento de cor, Esticar pixels e Imperfeições - mostra um botão **Ativar ao vivo** onde há uma câmera disponível. Ative e o efeito acompanha sua webcam quadro a quadro, reagindo ao movimento; você pode gravar o resultado em GIF, WebM ou MP4. Os quadros são lidos e processados **no seu dispositivo** e nunca saem dele, e a câmera é liberada assim que você para ou sai da ferramenta. (Qualquer seletor de imagem também tem **Tirar uma foto**, para capturar um único quadro como imagem no dispositivo.)

## Minhas imagens

Quando uma ferramenta permite adicionar uma imagem do seu dispositivo, ela é mantida exatamente como chegou - então uma Content Credential nela ainda verifica - e salva na sua biblioteca pessoal **My images** (em **Configurações → Armazenamento**). Só um arquivo genuinamente enorme pergunta se quer mantê-lo ou redimensioná-lo. Reutilize-a em qualquer ferramenta. Para remover EXIF/GPS conforme as imagens chegam, ative **Remover metadados dos uploads** no seu perfil. Não há limite: a biblioteca é totalmente local e limitada só pelo armazenamento do seu dispositivo - gerencie ou exclua imagens lá.

## Ativos - sua biblioteca

A tela **Ativos** (`#/a`, ou o segmento **Ativos** do seletor Ferramentas · Utilitários · Ativos · Projetos no topo de toda tela de listagem) reúne tudo o que suas ferramentas podem usar - logos de marca, imagens, áudio e animações, agrupados por tipo - e é onde os seus **próprios arquivos criativos** também ficam. Sem servidor, sem console de administração, sem pull request: está tudo no seu dispositivo.

![Ativos - ativos de marca, amostras e fontes, além dos seus próprios uploads](/t/url-shot?url=%2F%23%2Fa%3Fsection%3Dswatches%2Cfonts&width=1440&height=900&dpi=96&waitMs=2400&css=.plat-swatch-grid~%2A%7Bdisplay%3Anone%7D&walker=1&format=svg&localize=1&dark=1&filename=assets)

- <!--i:upload--> **Traga seus arquivos.** Arraste qualquer imagem, SVG, clipe de áudio, vídeo, Lottie, PDF ou apresentação do PowerPoint para a área de envio - ou clique para escolher - e ele chega instantaneamente em Ativos, pronto no seletor de ativos de cada ferramenta. Um PDF de várias páginas ou um `.pptx` pergunta quais páginas ou slides manter - cada um vira um ativo SVG. Envie o quanto quiser; isso nunca sai do seu dispositivo.
- <!--i:star--> **Favorite o que você usa com frequência.** Marque com ★ um ativo (ou uma amostra de marca) e ele fica fixado no topo de todo seletor, para que o seu logotipo ou cor preferida fique a um clique de distância.
- <!--i:folder--> **Organize.** Recategorize um ativo em um grupo diferente, oculte um ativo de marca compartilhado que você não usa (com **Show hidden** para trazê-lo de volta) ou exclua seus próprios envios definitivamente. O mesmo gesto de seleção múltipla e a barra de ações flutuante do Projects funcionam aqui também, então qualquer uma dessas ações pode ser feita em toda uma seleção de uma vez.
- <!--i:layers--> **Remova o fundo de um vídeo.** Abra o detalhe de um vídeo ou clique com o botão direito no seu cartão em qualquer seletor de ativos e escolha **Remover fundo…** para salvar uma alternativa transparente - um WebP ou PNG animado com alfa real. Escolha um **Método**: um **Modelo no dispositivo** recorta um assunto de uma cena movimentada, ou uma **Chave de cor** remove um fundo uniforme e plano, como um fundo verde ou uma parede lisa, com **Tolerância**, **Suavidade** e **Remoção de respingo** para ajustar a borda. A chave de cor não precisa de download de modelo nem de rede, então **Remover fundo** é oferecido em qualquer vídeo e costuma ficar mais limpo em filmagens bem cuidadas. Um controle de **Resolução** (360, 480, 720 ou 1080p, nunca além da origem) troca detalhe por um arquivo menor e mais rápido. Ele roda como uma tarefa em segundo plano no seu dispositivo. O recorte finalizado é salvo ao lado do original como seu próprio ativo, e o Content Credential do vídeo de origem viaja junto como um ingrediente. (Veja [Gerado uma vez, renderizado do mesmo jeito](/info/ai-features.html) para entender por que remover um fundo continua sendo uma edição comum.)

### Leve sua paleta e suas fontes para qualquer lugar

O painel de **Amostras** em Ativos faz mais do que exibir - clique em uma cor para copiá-la, ou **baixe toda a paleta da marca** no formato que a sua outra ferramenta entende:

- <!--i:code--> **Design tokens (JSON)**, **variáveis CSS** ou **classes CSS** - leve a marca direto para uma folha de estilos ou um build;
- <!--i:palette--> **Adobe Swatch Exchange (.ase)** - carregue no Illustrator ou Photoshop;
- <!--i:pentool--> **Paleta do GIMP (.gpl)** - para o GIMP ou o Inkscape.

![O painel de Amostras - os cinco botões de download da paleta no topo, e depois cada cor da marca como um chip copiável](/t/url-shot?url=%2F%23%2Fa%3Fsection%3Dswatches&width=1440&height=900&dpi=96&waitMs=1800&css=.cat-group%3Anot%28%5Bdata-group%3Dswatches%5D%29%7Bdisplay%3Anone%7D&cropSelector=%5Bdata-group%3Dswatches%5D&walker=1&format=svg&dark=1&filename=use-swatch-downloads)

O painel de **Fontes** lista as fontes da sua marca com um botão de **download** ao lado de cada uma, para instalar localmente ou entregar a uma gráfica. (A sala de Cores do [Brand Studio](/info/brand-studio.html) oferece o mesmo download de paleta.)

Os ativos são metade do caminho aberto e faça-você-mesmo; a outra metade é **criar suas próprias ferramentas** - a tela livre (Design, descrita acima) permite construir uma visualmente, sem precisar de código.

## Som e acessibilidade

O Lolly busca ser confortável de usar para todo mundo. A interface é navegável pelo teclado, os controles personalizados têm rótulos adequados para leitores de tela, e a pré-visualização ao vivo de cada ferramenta é exposta como uma única imagem rotulada, descrevendo o que está sendo criado.

Uma camada suave de **sons de apoio** confirma o que você faz - chegar na galeria, uma checagem válida ou inválida de Content Credentials, fechar um painel, trocar um filtro. Isso vem **desativado por padrão**: ative **Som** em qualquer lugar em que o interruptor aparece (o popover de opções de cada visão, ou **Configurações**), e a escolha é lembrada.

Quatro configurações de conforto opcionais ficam em **Configurações → Acessibilidade**: **Reduce motion** (remove as transições e florituras do app), **Hide colourful previews** (cartões de galeria calmos, de ícone e texto, e miniaturas de projeto mais discretas), **High contrast** (bordas, texto e anéis de foco mais fortes) e **Large text** (tipografia do app maior - rótulos, menus, texto de botão). As quatro ajustam o app *ao redor* do seu trabalho: elas nunca alcançam o interior de uma prancheta de ferramenta nem mudam um pixel do que você exporta, e cada uma vem desativada até você ativá-la. Detalhes completos em [Seu perfil → Acessibilidade](/info/profile.html#accessibility).

Ao lado do interruptor de Som fica o **Modo Neurospicy** - uma faixa de foco de fundo, calma e opcional, que toca discretamente enquanto você trabalha. Ao ativá-la, abre-se um pequeno **dock de player** no canto inferior que acompanha você por todo o app; a partir dele você pode buscar e escolher uma faixa, avançar e voltar, ajustar o volume, e minimizá-lo ou fechá-lo. A lista de faixas abrange algumas categorias - músicas procedurais do *Lolly Sings*, loops e batidas ambiente, seu próprio áudio enviado e algumas estações de **rádio** ao vivo da internet (estas precisam de conexão; todo o resto toca offline). Ele vem **desativado por padrão** e, assim como o Som, é lembrado entre sessões e dispositivos. Desativar o Som também silencia a faixa de foco.

## Armazenamento e privacidade

O Lolly mantém seu trabalho no seu dispositivo: no armazenamento do próprio navegador no app web, e no armazenamento do próprio app nos apps de desktop e mobile. O que é mantido, o que **Limpar todos os meus dados** remove e o que limpar os dados do navegador leva junto estão em [Encontre e recupere seu trabalho](/info/find-your-work.html#if-you-clear-your-browser-data); a [Política de Privacidade](/info/privacy.html) lista tudo que o app busca ou envia, e [Server Surface](/info/server-surface.html) os componentes de servidor opcionais.

## Mudando para outro dispositivo

Para levar seu trabalho a um segundo computador ou celular, use a Sincronização, um arquivo de backup ou um arquivo `.lolly`. [Mova seu trabalho para outro dispositivo](/info/find-your-work.html#move-your-work-to-another-device) compara os três e explica **Exportar meus dados** e **Import data…**.

## Importando um design (Figma, Penpot, Illustrator, InDesign)

Você pode trazer um design existente para o Lolly e continuar trabalhando nele: abra o **Design**, clique em **Importar um design** na barra de ferramentas da tela, e escolha um **.fig** ou SVG do Figma, um **.penpot** do Penpot, um **.ai** / **.pdf** do Illustrator ou um **.idml** do InDesign. As camadas viram caixas editáveis na tela livre - o texto continua reeditável, as imagens vão para **Minhas imagens** e a tipografia e as cores seguem os padrões globais da marca - depois o resultado é salvo, compartilhado e renderizado como qualquer outra sessão. O parse acontece inteiramente no seu dispositivo. Detalhes completos: **[Importar um design](/info/design-import.html)**.

## Exportando

Veja **[Exportação e Formatos](/info/exporting.html)** para a história completa - escolher um formato, tamanho de saída e unidades de impressão, transparência, vídeo e copiar/compartilhar. Resumindo: escolha um formato, ajuste o tamanho se precisar e **Baixar** (ou **Copiar** para a área de transferência).

## Modo Batch (Pro)

Para usuários avançados, o **Batch** (acessível pela galeria, restrito à feature flag Pro, que vem ativada por padrão) renderiza várias variações de uma vez - uma grade em que cada linha é um conjunto de inputs, exportados juntos. Ideal para localizar um cartão em uma dezena de idiomas ou gerar cada variante de tamanho em uma única passagem. Preencha as linhas digitando, colando direto de uma planilha ou importando um CSV (você também pode exportar um de volta), e defina formato, tamanho e nome do arquivo de saída por linha. Salve uma grade inteira como uma **sessão de lote** nomeada, que reabre pela galeria, e baixe cada linha como um único `.zip`.

![A barra de ferramentas do lote - nome do zip, unidades, DPI e o formato que cada linha herda, com Sessions e Render à direita](/t/url-shot?url=%2F%23%2Fbatch&width=1440&height=900&dpi=192&waitMs=3500&cropSelector=.pro-toolbar&walker=1&format=svg&dark=1&filename=use-batch-toolbar)

O Batch serve para gerar **muitas variantes de um modelo** de uma vez. Para renderizar de novo sessões que você **já salvou**, use **Projetos → Renderizar pasta / Renderizar seleção** (veja [Encontre e recupere seu trabalho](/info/find-your-work.html#find-something-you-saved)) - não precisa de Pro.

## Editando lado a lado (Multiedição)

Batch são muitas variantes de *um* design. **Multi-edit** é a outra metade do trabalho: vários designs salvos **diferentes** abertos ao mesmo tempo, para que uma alteração se aplique a todos eles. Marque entre **duas e oito** sessões salvas em **Projects** e escolha **Edit together** na barra de seleção; eles abrem como cartões ao vivo lado a lado em `#/multi?s=<slot>,<slot>…`. Cada cartão é uma renderização real dessa sessão, não uma miniatura armazenada, então o que você vê é o que será exportado.

Uma única barra lateral comanda o conjunto:

- <!--i:sliders--> **Shared** lidera - todo input que duas ou mais das sessões selecionadas declaram *da mesma forma* (mesmo id, mesmo tipo, mesmas restrições - a mesma regra de mesclagem que a grade de lote usa nas suas colunas). Edite um controle compartilhado uma vez e o valor se espalha para toda sessão que o declara, ao vivo em cada cartão. Duas sessões da mesma ferramenta compartilham tudo; duas ferramentas diferentes compartilham só os inputs que têm em comum.
- <!--i:document--> Abaixo dele, **um cartão recolhido por sessão** com todos os inputs próprios daquela sessão, na mesma fidelidade da barra lateral da própria ferramenta - seletores de recursos, grupos de linhas repetidas, campos de cor - mais um bloco de exportação compacto: **Format**, **W** / **H**, **Unit**, **DPI** e seu próprio **Download**. Esse Download salva a sessão primeiro e depois a renderiza pelo caminho comum de exportação de sessão, então o arquivo carrega o mesmo nome, formato e Content Credentials que teria direto da ferramenta.
- <!--i:search--> **Filter inputs…** no topo restringe os controles em *todos* os cartões de uma vez - é assim que você chega ao "título" em oito sessões sem rolar para encontrá-lo.

Clique em qualquer tela (ou pressione Enter sobre ela) e o cartão da barra lateral daquela sessão se abre e é rolado até ficar visível. **Salvar tudo** grava cada sessão de volta no seu próprio espaço. **Baixar tudo** salva primeiro e depois renderiza o conjunto inteiro pelo mesmo pipeline do **Renderizar seleção** de Projetos - um único zip, com a trava opcional por senha oferecida no caminho.

Dois limites honestos. O teto de duas a oito é real: cada cartão monta seu próprio runtime ao vivo, e esse é o número que continua responsivo - um link pedindo mais (ou pedindo uma sessão que não existe mais) avisa em vez de carregar pela metade. E o link nomeia os *seus* espaços salvos, então ele reabre esse conjunto neste dispositivo; não é um link de compartilhamento.

Quando a seleção é maior que oito, mistura ferramentas ou inclui imagens além de sessões, a saída de emergência é **Editar como planilha**, na mesma barra de seleção: ela abre a seleção inteira como **linhas na grade de lote** (`#/pro?s=…`), sem limite de tamanho e sem a regra de mesma ferramenta. As pastas ficam fora das duas - elas têm seu próprio caminho de abrir na grade. (A [Busca](/info/search.html) é a única coisa que ainda não alcança aqui: a Multiedição é a única tela que a barra de busca não conhece.)

## Offline e instalação

O Lolly é um PWA. Ele continua funcionando **offline** nas telas que você já abriu, e **O app**, em **Configurações → Disponível offline**, baixa o resto - instale-o pela barra de endereço do seu navegador (ou *Adicionar à tela inicial* no celular) para uma experiência em tela cheia, como um app. Ele se atualiza sozinho quando você volta a ficar online.

Sobre atualizações: se uma visão falhar ao carregar logo depois de uma (um painel em branco, um "failed to fetch" no canto), recarregue a página uma vez - o app assume a nova versão sem problemas e seu trabalho salvo, sessões e marca ficam intactos; só uma imagem que você adicionou e nunca salvou pode precisar ser adicionada de novo. Ele guarda tudo no seu dispositivo, não na página.

O Design e o Darkroom podem manter a precisão original da imagem com a edição **Wide colour / HDR**, incluindo vídeo da Sequência. As amostras de marca podem carregar valores sRGB e P3 separados. Veja [Edição em cor ampla e HDR](/info/hdr-editing.html) para as opções de saída e os limites atuais.
