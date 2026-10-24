# Design System Setup

Seu logotipo, suas cores e suas fontes pertencem a um só lugar, para que todas as ferramentas, páginas e exportações desenhem com eles. Esse lugar é o **Design System Setup**, em `#/start`, e o lema dele diz para que serve: *Make it yours*.

Comece com o que você tiver. Solte um logotipo e o Lolly lê as cores dele. Escolha uma fonte, ou solte o arquivo de fonte que a sua empresa licencia. Cada mudança aparece no app inteiro na hora. Seu logotipo, suas fontes e seus tokens ficam neste dispositivo. Escolher uma Google Font é a única etapa que sai do dispositivo: o Lolly pergunta antes e depois busca a família uma vez.

Quando estiver bom, dê um nome ao sistema de design e pressione **Export**. Você recebe um arquivo `.lolly` para guardar, abrir em outro dispositivo ou entregar a um colega. [Settings](/info/dashboard.html#design-system) mostra o sistema ativo somente leitura, e a capa dele leva de volta para cá para edição.

## Deixe com a sua cara em cinco minutos

::: timeline
- <!--i:upload--> **Solte o seu logotipo** na área de soltar em **Logos**. O Lolly lê o formato e as cores dele.
- <!--i:palette--> **Use estas cores.** A cor principal do logotipo vira a sua primária, e um neutro escuro do logotipo vira a cor do seu texto.
- <!--i:font--> **Escolha uma fonte** em **Type**: uma Google Font, ou um arquivo de fonte que você possua.
- <!--i:pentool--> **Dê um nome ao sistema.** Sua primeira edição cria um sistema de design só seu, e o Lolly pergunta uma vez o nome dele.
- <!--i:download--> **Export** grava o sistema inteiro como um único arquivo `LollyBrand-….lolly`.
:::

O cabeçalho mostra qual sistema de design você está **Editing**, e o nome dele é um campo que você pode mudar a qualquer momento. Quando a sua primeira edição pergunta **What is this design system called?**, as palavras do seu logotipo são preenchidas se o logotipo as soletra. **Save name** guarda o nome; **Not now** mantém um provisório até você digitar um no cabeçalho. O nome identifica o sistema em Settings e ao trocar de sistema, e vira o nome do arquivo que **Export** grava.

## As salas

O estúdio é um conjunto de salas em uma barra lateral, sem ordem fixa: nada é numerado e nada espera por outra coisa. No celular, a barra vira uma faixa de chips sob o cabeçalho.

![A barra de salas do estúdio: Overview, Colours, Type, Logos, Tokens, Files e Usage & rules](/t/url-shot?url=%2F%23%2Fstart&width=1440&height=900&dpi=192&waitMs=1600&cropSelector=.ds-rail&waitSelector=.ds-rail&format=svg&walker=1&localize=1&dark=1&filename=brand-studio&try=1)

| Sala | O que você faz lá | Chave do link |
|---|---|---|
| **Overview** | Ver o que o sistema contém, com uma porta para cada sala | `overview` |
| **Colours** | Adicionar cores, dar funções a elas, criar tons e uma paleta | `color` |
| **Type** | Escolher as quatro fontes que o app, as ferramentas e todas as exportações leem | `type` |
| **Logos** | Posicionar suas marcas em todas as orientações e tratamentos | `logos` |
| **Tokens** | Cantos, espaçamento, sombras e todos os outros valores nomeados | `tokens` |
| **Files** | As imagens, o áudio e os arquivos de movimento que a sua marca guarda | `catalogue` |
| **Usage & rules** | As regras que a sua marca aplica, conferidas em exemplos reais | `usage` |

Crie um link para uma sala com `#/start?area=<key>`. A sala Files mantém a chave `catalogue`, porque a chave de uma sala é um contrato permanente, e `?tab=` ainda funciona como um apelido mais antigo. Uma chave desconhecida abre o Overview.

O **rodapé da barra** guarda as ações do sistema inteiro, e não de uma sala. **Add from…** traz uma marca ([Bring a brand in](#bring-a-brand-in)), e a **Tray** guarda o que uma varredura encontrou e que você ainda não adicionou. **Export**, **Tokens (.json)**, **Fonts for Linux (.rpm)**, **Versions** e **Restore brand settings** guardam e movem o sistema ([Keep and move your design system](#keep-and-move-your-design-system)). Cada um aparece quando há algo sobre o que agir.

## Overview

Sem nada escolhido ainda, o Overview oferece quatro formas de começar. **Start from a reference** abre o seletor de origem para um logotipo, captura de tela, página web ou arquivo de design, e **Pick a colour**, **Choose a face** e **Add a logo** abrem esses controles diretamente. Abrir um deles não grava nada, e **Explore the tools** está lá desde o início.

Quando algo já é seu, o Overview mostra o que você tem, com as suas contagens à frente. Colours dá o número de cores, com um discreto `· N starter` onde aparecem cores herdadas; a faixa coloca as suas cores primeiro, depois um traço fino, depois as cores iniciais esmaecidas. Type é lido por função (*Inter for headings*, com *Starter for the rest* na linha abaixo). Logos diz quantos slots estão preenchidos (ou **Not set**), Tokens mostra o raio dos cantos e Files diz **Nothing yet** enquanto a biblioteca está vazia. Cada bloco abre a sala dele.

### Starter e seu

**Starter** é a palavra para tudo o que veio com o app em vez de ter sido escolhido. Uma instalação nova não traz cor alguma, apenas uma rampa neutra do preto ao papel, para que superfícies, texto e traços finos possam ser renderizados antes de alguém decidir qualquer coisa. A mesma palavra marca o material herdado em todas as salas.

::: cols
## Starter

- Veio com o app: os neutros do preto ao papel, as fontes iniciais, o raio de canto padrão.
- Esmaecido, com uma etiqueta **Starter** e sem tom.
- Não conta como suas cores. Os neutros ficam em **Tokens** como **Neutrals · starter · 9**, e **Open** os mostra em Colours como um grupo recolhido (`#/start?area=color&group=neutral`).
- Uma função apoiada em uma cor inicial diz *"Starter Paper stands in"*, com **Choose…** no seletor dela.

## Seu

- Escolhido ou instalado por você.
- Com força total e um cartão tingido onde você instalou uma fonte.
- Contado no Overview e em Tokens.
- Uma função que segue outra diz **↳ follows Primary** em vez de repetir o nome da primária.
:::

O material herdado nunca é desenhado com uma borda tracejada, porque aqui uma borda tracejada indica uma área de soltar.

## Logos

Esvazie a sua pasta de marcas na área de soltar do topo: **"Drop marks here, or choose several at once"** aceita quantos arquivos você tiver. Cada arquivo é lido pelo formato e pela tinta, e então espera em **Waiting for a slot** como um chip que diz com o que ele se parece, como *"Looks like the Horizontal primary"*, com a medição usada e um botão **Place** (**Replace** onde o slot está preenchido). Onde há dúvida, o chip diz isso e oferece **Change slot**, listando os oito. Nada é colocado até você pressionar algo.

Uma marca com margem vazia sobrando recebe primeiro uma oferta de corte; responda a ela ou pressione Escape e o original entra intocado. Onde uma marca pode preencher um slot irmão vazio, a sala oferece a versão derivada **mono** ou **reverse** como um chip marcado *Generated*.

Toda marca termina em uma grade de oito slots opcionais, um por **orientation** e **treatment**:

- **Orientações:** Horizontal (logotipo e símbolo em uma linha) e Vertical (empilhados, para espaços quadrados e altos).
- **Tratamentos:** Primary, Primary reverse (para fundos escuros), Mono (uma cor) e Mono reverse.

Um grupo ainda sem marcas se recolhe em uma linha; abra-o para ver os slots. Clique em um slot para adicionar um PNG, SVG, JPEG ou WebP, ou clique em um slot preenchido para substituir a marca. Tudo fica neste dispositivo.

![Os slots de logotipo com Horizontal e Vertical abertos: cada tratamento é um slot próprio, e todos os slots são opcionais](/t/url-shot?url=%2F%23%2Fstart%3Ftab%3Dlogos&width=1440&height=1600&dpi=192&waitMs=1600&drive=click%3A.be-logo-identity%3Edetails%3Anth-of-type%281%29%3Esummary%3Bclick%3A.be-logo-identity%3Edetails%3Anth-of-type%282%29%3Esummary%3Bwait%3A600&cropSelector=.be-logo-grid&format=svg&walker=1&dark=1&filename=bs-logo-slots)

- **Custom marks** são marcas que a sua marca chama pelo próprio nome, como um ícone, um brasão ou um favicon.
- **More identities.** Uma submarca, produto ou evento pode ter um conjunto completo próprio: **+ Add another logo** e dê um nome ao conjunto. Seu conjunto principal é "Your logo". [Brand architectures](/info/brand-architectures.html) mostra quando uma identidade de logotipo é o bloco certo.
- **O Lolly lê as cores do logotipo.** Um cartão sob a área de soltar, e de novo no topo de Colours, lista as cores do logotipo e pergunta **Which is the main colour?**, com a cor mais forte já selecionada (nunca o branco sobre o qual ele foi exportado). **Use these colours** as adiciona à sua paleta, torna a cor principal a sua primária e, quando o logotipo tem um neutro escuro que se lê sobre papel, torna essa a cor do texto. **Not now** as deixa na Tray. Em uma instalação nova, a resposta mais provável é aplicada na hora, e o cartão oferece **Undo** ou outra cor principal. Um SVG dá cores exatas; um PNG, JPEG ou WebP dá as cores que cobrem uma parcela real da marca.

## Colours

A sala cresce com o sistema de design: uma primeira visita é uma decisão, e o resto chega conforme a paleta cresce.

### A primeira cor

Um sistema sem cores próprias abre com um chip grande e um campo, com uma linha dizendo que funções, tons e configurações de impressão chegam conforme o sistema cresce.

- **O chip é o seletor.** Pressione **Pick a colour** e o cartão OKLCH do estúdio abre, preenchido com o que o campo contiver: um nome, a roda, os quatro seletores, o alfa e **Stored as**, com **Cancel** e **Add colour** no rodapé. Nada chega ao sistema até você pressionar **Add colour**.
- **O campo aceita qualquer notação**: `#e0452b`, `rgb(224 69 43)`, `oklch(58% .19 32)` ou um nome de cor. Cole uma lista e ela vira uma fileira de chips para adicionar um de cada vez ou com **Add all**.
- **Mais duas formas de entrar.** **Pick a colour from the screen** usa o conta-gotas onde o navegador tem um, e **Take colours from an image** lê uma captura de tela ou foto deste dispositivo.
- **Add nunca fica desativado.** Com o campo vazio, ele abre o seletor; um texto que ele não consegue ler recebe uma linha sob o campo avisando isso.

Sua primeira cor vira a **primary**, e um chip confirma, como *"Primary is now Vivid Violet"*, com **Fine-tune** para ajustar a cor.


### Conforme a paleta cresce

Suas cores ficam ao lado de uma prévia **In context** em tela larga, e acima dela em uma menor. A prévia mostra um pôster, gráfico ou cartão de interface na sua paleta. As cores iniciais ficam no próprio grupo recolhível.

![A sala Colours no Lolly Demo: a paleta em grupos recolhíveis, cada cor com seu nome e hex, e a pílula de download no rodapé](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor&width=1440&height=740&dpi=192&waitMs=1800&format=svg&walker=1&localize=1&dark=1&filename=brand-colours)

![A sala Colours depois de adicionar uma cor, com sua paleta e uma prévia de composição ao vivo](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dpick&width=1440&height=840&dpi=192&waitMs=1800&drive=click%3A%5Bdata-be-editor-add%5D%3Bwait%3A900&format=svg&walker=1&dark=1&filename=bs-colour-first)

### Roles: o que as ferramentas leem

As **Roles** dizem qual cor faz cada papel em todas as ferramentas e exportações. São opcionais (três cores soltas e nenhuma função é um sistema perfeitamente bom), qualquer cor pode assumir uma e a leitura de contraste é medida contra a superfície, APCA primeiro. Cada linha de função mostra uma cor própria com força total, uma cor inicial no lugar dela, ou **↳ follows Primary**.

Quando a paleta tem tons, a faixa mostra as sete funções que uma ferramenta pode ler: Primary, Secondary, Surface, Text, Muted, Edge e On primary. On primary é derivada da primária, mostra **Derived** e não tem seletor.

O destaque do próprio app segue o sistema de design por padrão. Essa é a configuração **Interface follows the design system** em **Settings → Appearance**; desativá-la deixa o chrome do app neutro, enquanto ferramentas, canvases e exportações seguem o sistema de design de qualquer forma.

**Variações de cores.** Um sistema de design pode guardar várias cores principais, cada uma escolhida por peça. O Lolly mantém todas as variações de cores, mas esta sala ainda não consegue criar uma: uma variação de cores é escrita no arquivo de tokens. Em um sistema com variações de cores, cada variação precisa da própria primária e secundária, e da própria superfície quando as variações tingem o fundo, então essas funções continuam definidas no editor de amostras. [Lolly Demo in use](/info/lolly-demo-in-use.html#colourways-on-real-work) mostra variações de cores em trabalhos reais, e [Add colourways to a design system](/info/colourways.html#add-colourways-to-a-design-system) traz o formato.

### Encontre mais cores

Três ferramentas se baseiam na sua primária. As duas primeiras apenas sugerem, e a terceira substitui a paleta depois que você revisa a mudança.

::: cols
## Explore shades & harmonies

Escolha uma **Starting colour**, um **Scheme** (Mono, Complement, Analogous ou Triad) e quantos **Shades** (de 3 a 20, padrão 5). **Fine-tune** define a intensidade da interface, o contraste e o texto na marca. Clique em um tom para adicioná-lo, ou em **Add 5 shades** para um grupo. Suas cores e funções permanecem.

## Find matching colours

Escolha uma **Harmony**: Complementary, Adjacent, Triad, Tetrad ou Analogous (com **Accents** de 2 a 5 e um **Angle** de 10° a 45°). Cada candidata tem um nome gerado e **+ Add**, um clique por cor.

## Rebuild the whole palette

Substitui a paleta a partir de uma cor inicial, depois de uma revisão do que muda e do que permanece. Um ponto de restauração é criado antes, e **Undo** é oferecido depois.
:::

As três usam a mesma matemática de cor perceptual (OKLCH) do motor. Em **Explore shades & harmonies**, as linhas **Primary**, **Neutral** e **Secondary** mostram os tons sugeridos, e **Theme preview** mostra exemplos claros e escuros com as leituras de contraste.

![Três grupos de tons sugeridos, com controles de adição individuais e um Theme preview separado](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dgenerate%26seed%3D%2523e0452b&width=1440&height=1400&dpi=192&waitMs=1800&css=.start-head%7Bdisplay%3Anone%7D&cropSelector=.be-preview&format=svg&walker=1&dark=1&filename=bs-colour-ramps)

![Destaques gerados, cada um com uma amostra, um nome gerado automaticamente, seu hex e um botão Adicionar](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dgenerate%26seed%3D%2523e0452b&width=1440&height=900&dpi=192&waitMs=1800&css=.start-head%2C.be-colour%7Bdisplay%3Anone%7D&drive=click%3A.be-generate-detail%3Anot%28%5Bdata-be-rebuild%5D%29%20%3E%20summary%3Bwait%3A500&cropSelector=.be-candidates&walker=1&format=svg&dark=1&filename=bs-harmony-candidates)

### Confirmando uma paleta gerada

Abra **Rebuild the whole palette…** e pressione **Preview full rebuild**. A revisão conta quantas funções ficam como você as atribuiu, quantas das suas próprias cores são mantidas e quantas curvas de tons, bloqueios de impressão, tons ocultos e paradas de gradiente são reancorados ou mantidos. **Apply rebuilt palette** confirma; **Cancel** não altera nada. Depois, o cartão oferece **Undo** com o foco nele, e o ponto de restauração criado antes da troca restaura o sistema inteiro.

Um sistema com variações de cores mantém todas elas em uma reconstrução. A variação de cores canônica acompanha a nova cor inicial, e todas as outras variações mantêm as próprias cores, nome, ordem e configurações. A revisão lista qual variação acompanha e quais mantêm suas cores. O Lolly não reconstrói um sistema que codifica suas variações de cores de um modo que ele não consegue editar; o cartão explica por quê, e nada muda.

### As seções avançadas

Quatro seções recolhidas ficam abaixo da prévia e das funções. Cada uma abre diretamente com `#/start?area=color&focus=<name>`:

- **Explore shades & harmonies** (`focus=generate`), descrita acima.
- **Shade curves** (`focus=curves`) remodelam uma rampa ponto a ponto, com curvas separadas de luminosidade, croma e matiz (L / C / H) e os tons se redesenhando conforme você arrasta.
- **Contrast** (`focus=contrast`): **Contrast-lock** retoma uma rampa para atingir metas APCA contra um fundo que você escolhe, e **Rotate hue** gira a rampa inteira ao redor da roda.
- **Print** (`focus=print`) define em que a primária se transforma na impressão: o valor automático, uma composição CMYK fixa ou uma tinta especial nomeada.

### A paleta e cada amostra

A paleta lista suas cores em grupos recolhíveis, cada um com o próprio **+ Add**. Crie e renomeie grupos como quiser. Uma função nunca cria um segundo bloco: um bloco para o qual uma função aponta usa uma pequena marca (**P**, **S**, **Su**, **T**). **Colour chart**, abaixo dos blocos, mostra as mesmas cores na **Wheel** OKLCH (arraste um ponto para recolorir, clique no espaço vazio para adicionar uma amostra) e no gráfico **Gamut**, que mostra onde termina a faixa exibível. `#/start?area=color&focus=chart` abre o gráfico diretamente.

![O painel de paleta, cada grupo dobrável, com a pílula de download fixada na borda inferior](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dgenerate%26seed%3D%2523e0452b&width=1440&height=1000&dpi=192&waitMs=1800&drive=click%3A%5Bdata-be-add-ramp%3D%22primary%22%5D%3Bwait%3A1200&cropSelector=.be-split-side&walker=1&format=svg&dark=1&filename=bs-palette-pane)

![A roda OKLCH - o ângulo é o matiz, a distância do centro é a croma e os cinzas seguem um trilho de luminosidade na lateral](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dgenerate%26seed%3D%2523e0452b&width=1440&height=900&dpi=192&waitMs=2400&css=.start-head%2C.be-pal%2C.be-gradients%7Bdisplay%3Anone%7D&drive=click%3A%5Bdata-be-add-ramp%3D%22primary%22%5D%3Bwait%3A1200%3Bclick%3A%5Bdata-be-chart%5D%20summary%3Bwait%3A900&cropSelector=.be-pal-wheel&walker=1&format=svg&dark=1&filename=bs-colour-wheel)

Clique em uma amostra para abrir o editor dela:

- **Rename** da amostra.
- **Defina a cor** em controles OKLCH, ou em **Hex**, **HSL**, **RGB** ou **CMYK**. O campo de valor lê e grava no espaço ativo. O CMYK aqui define a cor da tela por conversão; para fixar tintas exatas, use **Print substitutes**.
- **Stored as** escolhe como a amostra é salva: **LCH** (o padrão, perceptual e de gama ampla), Hex, RGB ou HSL.
- **Use as** dá uma função à amostra diretamente. Pressione de novo uma função destacada para limpá-la.
- **Print substitutes** (recolhido): trave o **CMYK** de **Auto** para valores de tinta exatos, ou defina uma **Spot colour** com um **Name** (como `PANTONE 186 C`), um **Book** opcional e um **Finish** para hot stamping, relevo, baixo-relevo, verniz localizado, soft touch ou corte especial, vinco ou picote. Uma gráfica usa esses bloqueios quando você exporta um PDF ou TIFF CMYK; veja [Colour profiles](/info/exporting.html#colour-profiles).
- **In other spaces** (recolhido): um valor por espaço de cor, derivado ou criado por você, e um valor criado por você vale na exportação.

**Excluir uma amostra** é seguro. Tons derivados e funções de tema são ocultados, então nada que os leia quebra, enquanto as cores que você adicionou são removidas.

::: details Trabalhar com muitas amostras
Cada amostra tem uma alça de arrastar. Arraste para reordenar dentro de um grupo, ou dê foco à alça, pressione Space, use as setas e pressione Space de novo para soltar; Escape cancela. Para mover cores entre grupos, use o controle **Group** do editor ou selecione várias e use **Move to**.

A seleção não precisa de modo. A barra aparece com o primeiro bloco selecionado e some com o último.

- **Arraste no espaço vazio** para desenhar um retângulo; todo bloco que ele toca entra na seleção, entre grupos. Uma seção recolhida não adiciona nada.
- **Shift-clique** pega um intervalo na ordem de leitura, **Cmd/Ctrl-clique** alterna um bloco e um clique simples abre o editor.
- Cada cabeçalho de grupo tem **Select all**, e **Cmd-A** com um bloco em foco pega todas as cores que são suas, nunca uma inicial.
- A grade tem uma única parada de tabulação: as setas movem, Shift-setas estendem, Space alterna, Delete remove e Escape limpa. Para ajustar um canal, pressione `l`, `c` ou `h` antes.
- Em uma tela de toque, mantenha pressionado um bloco para iniciar uma seleção e depois toque para adicionar.

A barra mostra **{n} selected**, depois **Move to**, **Give a role** (cada cor recebe a próxima função em sequência), **Download** (a seleção em qualquer um dos seis formatos de paleta), **Duplicate** (uma cópia de cada uma, colocada depois do original), **Copy values** e **Delete**. Uma cópia abre direto no editor; várias continuam selecionadas. Um único Cmd/Ctrl-Z desfaz uma ação em lote inteira.
:::

### Gradientes

O painel opcional **Gradients** cria tokens de mistura a partir da paleta. Cada gradiente tem uma prévia, de 2 a 8 paradas nomeadas e um ângulo. Uma parada aponta para uma amostra, então ao recolorir a amostra o gradiente a acompanha. As misturas são feitas em OKLCH.

Os downloads da paleta (design tokens, CSS, SCSS, GIMP e Adobe Swatch Exchange) ficam em uma pílula no rodapé da paleta quando há tons. [Take your palette and fonts anywhere](/info/using.html#take-your-palette-and-fonts-anywhere) descreve cada formato.

## Tipografia

Sem uma fonte própria, a sala é um único cartão: **Primary**, composto em tamanho de leitura na fonte que o atende hoje, com uma etiqueta **Starter**, um botão **Choose a face** e a linha *"Nothing installs until you choose one."* Headings, code e italic seguem a primária até você escolhê-los; **Choose them separately** mostra os cartões deles.

![A sala Type sem fonte escolhida ainda - um cartão em tamanho de leitura, uma tag Starter nele, e um Choose a face preenchido](/t/url-shot?url=%2F%23%2Fstart%3Ftab%3Dtype&width=1440&height=740&dpi=192&waitMs=1800&format=svg&walker=1&dark=1&filename=brand-type)

Escolha uma fonte e a sala se abre em quatro cartões de função, na lista Fonts e em um espécime ao vivo:

- **Primary**: texto corrido, botões e todas as ferramentas.
- **Headings**: a fonte de exibição para `h1` e `h2`.
- **Code**: uma fonte monoespaçada para código e dados.
- **Italic**: um itálico verdadeiro para ênfase, citações e observações.

Um cartão só é tingido onde você instalou aquela fonte, e o botão dele diz **Change** em uma fonte sua e **Choose a face** nos demais casos. Nada em um cartão confirma nada: o botão abre o palco de comparação para aquela função.

![Os quatro cartões de papel revelados - cada um na fonte que o atende, com uma tag Starter onde ninguém escolheu uma e Italic seguindo a primária](/t/url-shot?url=%2F%23%2Fstart%3Ftab%3Dtype&width=1440&height=1000&dpi=192&waitMs=2600&drive=click%3A%5Bdata-be-typemore-toggle%5D%3Bwait%3A600&cropSelector=.be-typecard-grid&walker=1&format=svg&dark=1&filename=bs-type-specimen)

### O palco de comparação

O palco abre dentro da sala, sob o cartão que você pressionou, e os cartões se recolhem em uma faixa de uma linha para que o palco apareça na primeira tela de um celular. Escape cancela e devolve o foco ao cartão.

1. Pressione **Choose a face** no cartão.
2. Digite o nome de uma família e pressione **Preview**, ou pressione uma das seis famílias **Pinned** sob o campo.
3. Pressione **Use this face**.

![O palco de comparação aberto sob seu cartão, com a linha de busca, as famílias fixadas e os cartões dobrados numa faixa de uma linha](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dtype%26focus%3Dstage&width=1440&height=740&dpi=192&waitMs=1800&format=svg&walker=1&dark=1&filename=bs-type-stage)

**O consentimento é pedido uma vez.** Na primeira vez que uma prévia chega ao Google Fonts, uma caixa de diálogo explica: *Google learns the family name and your IP address. The file is then kept on this device and used offline. This is the one step in the studio that reaches a third party.* **Fetch from Google** segue em frente e é lembrado. **Cancel** deixa o cartão com o texto *"Not fetched. Nothing was sent to Google."*, com o próprio **Fetch from Google**.

**Solte um arquivo de fonte no palco** (TTF, OTF ou WOFF) para pré-visualizar uma fonte licenciada que você já possui. De qualquer forma, a fonte fica neste dispositivo, é renderizada offline no app, nas ferramentas e em todas as exportações, e viaja no arquivo do sistema de design. Tudo no Google Fonts é distribuído sob uma licença aberta (OFL, Apache ou UFL).

### Fonts neste dispositivo

O painel **Fonts** lista todas as fontes deste dispositivo e a função que cada uma atende. As fontes que você adicionou vêm primeiro em **In the design system**, cada uma com as suas funções e uma opção de excluir. As fontes iniciais vêm depois, em uma linha discreta e recolhida. **Add a face** abre o palco de comparação para qualquer função. O painel **Type roles** mostra um espécime ao vivo de cada função com a família e o estado dela, como *Inter* ou *Inter · follows Primary*.

## Tokens

Os tokens são os valores nomeados por trás do sistema de design: cores, fontes, logotipos, cantos e espaçamento. As ferramentas os leem pelo nome, então uma mudança aqui chega a todas as ferramentas de uma vez.

![A sala Tokens: o cabeçalho com um exemplo do sistema e as ações de arquivo, blocos que contam cada tipo de token e depois os pares de cores com as leituras de contraste](/t/url-shot?url=%2F%23%2Fstart%3Ftab%3Dtokens&width=1440&height=740&dpi=192&waitMs=1600&format=svg&walker=1&dark=1&filename=brand-tokens)

- **O cabeçalho** traz um exemplo do seu próprio sistema (*Primary is Spearmint, #033633*) e as ações de arquivo: **Download** (o sistema inteiro como design tokens, ou a paleta em outros cinco formatos), **Copy CSS** e **Add from…** para ler um arquivo JSON de volta.
- **Os blocos** contam cada tipo de token e levam à respectiva seção: Colours, Type, Logos, Shape and spacing, More e All tokens. Eles contam o que é seu, como o Overview faz. No celular, os blocos rolam para o lado.
- **Colours** começa com os pares que as ferramentas combinam (texto sobre superfície, sobre primária, secundário sobre superfície) com uma leitura APCA em claro e escuro, e sinaliza **Weak contrast** onde um par fica abaixo. Depois, cada grupo de cores: uma rampa como uma fileira de chips, outras cores com o valor e a referência que as ferramentas usam, como `{color.brand.spearmint}`. Pressione uma referência para copiá-la. **Edit in Colours** abre um grupo na sala Colours.
- **Type** e **Logos** listam a fonte de cada função e cada slot de logotipo, com **Edit in Type** e **Edit in Logos** quando você já tem os seus.
- **Shape and spacing** contém **Rounded corners** (`shape.radius`) e **Spacing rhythm** (`space.base`). Cada um mostra *Lolly default* até você mover o controle deslizante e *Yours* depois, salva na hora e pode ser desfeito.
- **More tokens** acrescenta espaçamento, dimensionamento, espessura de traço, opacidade, rotação, números simples e sombras, armazenados como [design tokens](/info/design-tokens.html) padrão.
- **App appearance (advanced)** lista as cores, tamanhos e sombras que as telas do próprio Lolly usam, e **Inspect every token (advanced)** pesquisa e edita qualquer valor armazenado, mostrando cada mudança para revisão antes.

Uma seção sem nada oferece o caminho para preencher a lacuna: **Pick a colour**, **Choose a face** ou **Add a logo**.

## Arquivos

Solte os arquivos que a sua marca guarda, além dos logotipos: arquivos **vector**, **image**, **audio** e **motion** (vídeo, Lottie e animações). Eles aparecem em [Assets](/info/using.html#assets-your-library), organizados em seções e prontos no seletor de recursos de todas as ferramentas, e permanecem neste dispositivo.

## Usage & rules

**Usage & rules** põe em prática as escolhas da sua marca: o que as pessoas podem mudar, o que fica fixo e o que o Lolly pode verificar.

![Usage & rules no Lolly Demo: um cartão Brand rules vazio com Add your first rule, depois Try your brand in use com os exemplos prontos para renderizar](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dusage&width=1440&height=1200&dpi=192&waitMs=2400&cropSelector=%23start-panel-usage&format=svg&walker=1&dark=1&filename=bs-usage-rules)

**Brand rules** lista suas regras. **Add rule** (ou **Add your first rule**) abre um formulário curto:

- um **Rule name** nas suas próprias palavras, como *Beacon accents*;
- o **Check**: **Colour choices**, **Font choices**, **Fixed artwork** ou **Text length**, com a função de marca que ele usa, sob o seu próprio nome para a função;
- o **Example** ao qual se aplica (Poster, Title slide, Content slide ou Chart), o **Mode** e se é **Required** ou **Advisory**;
- **Reviewed by**, e depois **Save draft** ou **Approve & save**.

A aprovação registra a sua própria decisão neste dispositivo. As regras obrigatórias aprovadas restringem o pôster reutilizável, e as verificações cobrem apenas os PNGs de exemplo; elas não alteram nenhuma outra ferramenta.

As regras que um sistema de design traz no arquivo de tokens, como pares de cores aprovados, peso e alinhamento do texto ou um logotipo por superfície, são listadas aqui como **Checked in Design**. O Design as verifica camada por camada no cartão **Before you export** do painel de exportação, e o `lolly check` faz o mesmo para um documento do Design salvo ([Before you export](/info/design.html#before-you-export)). Uma regra para a qual esta versão não tem verificador é mantida como fornecida e marcada como **Unchecked**.

**Try your brand in use** renderiza quatro exemplos da revisão atual com **Render & check examples**. Escolha um **Brand mode** e **Try your own text** para o título, o texto de apoio e o texto dos slides. Cada exemplo informa o que foi medido, com **See checks & sources** e **Download check report**, e **Make reusable poster** baixa um `.lolly` cujo layout fixo e cujas escolhas de entrada aprovadas viajam com o arquivo. Os exemplos são locais: nada é publicado nem aprovado ao rodar uma verificação.

Uma compilação que vem com uma marca fixa mostra as mesmas regras e exemplos somente leitura, sob *This brand is set*.

## Trazer uma marca

**Add from…**, no rodapé da barra, abre um seletor que pergunta o que você tem, não qual é o formato:

- **Design tokens or a design file**: JSON DTCG ou Tokens Studio, um projeto Penpot, um zip de conjuntos de tokens, um pacote de sistema de design do Lolly ou um SVG.
- **PDF**: um deck ou um arquivo de diretrizes, lido neste dispositivo em busca de cores, marcas e fontes incorporadas.
- **Logo or screenshot**: uma imagem vira uma paleta sugerida, lida neste dispositivo. Ele lê cores, não a fonte nem o layout.
- **Saved web page**: um arquivo HTML e seus arquivos CSS, ou HTML ou CSS colado, até 20 arquivos e 2 MB. Apenas o texto que você fornece é lido: os recursos vinculados não são buscados e os scripts não são executados.
- **Font file**: TTF, OTF ou WOFF. Abre a sala Type, onde a fonte é instalada.
- **Website**: uma página, lida para extrair cores e tipografia. Este bloco só aparece em um dispositivo que pode ler uma página e diz qual leitor usa: o app neste dispositivo, ou a extensão de navegador em uma aba em segundo plano, logada como você. Informar uma URL apenas preenche o campo; pressionar buscar é o consentimento.

Escolha a origem de arquivo de design e o cartão seguinte lista os formatos aceitos como blocos com ícone, com o cartão inteiro como uma única área de soltar. Você também pode soltar um arquivo direto no estúdio.

![O cartão de importação - os formatos aceitos aparecem como blocos de ícone, e o cartão inteiro é um único alvo de arrastar-e-soltar](/t/url-shot?url=%2F%23%2Fstart%3Fsource%3Dfile&width=1440&height=900&dpi=192&waitMs=1600&css=.start-import-modal%20.modal-msg%2C.start-import-modal%20.modal-title%7Bdisplay%3Anone%7D&cropSelector=.start-import-drop&walker=1&format=svg&dark=1&filename=bs-brand-import-formats)

- Um **Lolly design-system pack** (`.lolly`, ou um `.zip` legado) é instalado em uma etapa.
- Uma exportação do **Penpot** (`.penpot`) traz seus design tokens.
- Um arquivo **Design Tokens** (W3C DTCG) ou **Tokens Studio** (`.json`) traz seus tokens.
- Um **SVG simples** é analisado em busca de cores para você escolher, e a primeira vira sua primária.

### Revise uma referência

Um logotipo, uma captura de tela, um site ou uma página salva abre **Try these colours**: um exemplo nas cores propostas, uma **Main colour** que você pode mudar e um nome para um novo sistema. Uma caixa explica o que aplicar significa: ele **replaces** as configurações de token ativas pela paleta gerada e pelos estilos padrão, **keeps** suas fontes e arquivos da biblioteca e o sistema anterior pode ser **recovered**. **Apply suggested settings** aplica as paletas clara e escura, depois de um ponto de restauração, e **Restore brand settings** pode trazer as configurações antigas de volta. **Change reference** escolhe outra origem.

**Palette, source details and individual choices** mostra o que foi lido, os nomes de fontes encontrados e o contraste da prévia. Os nomes de fontes são só sugestões; Type continua sendo onde você instala uma fonte. Os detalhes da origem podem incluir tipografia, intervalos, preenchimento e valores de cantos quando observados, rotulados como **Not observed** nos demais casos. Uma página salva ou uma leitura nativa de site informa estilos declarados, que a página pode não usar, e a extensão de navegador pode informar estilos medidos em uma amostra de elementos visíveis. Essas são observações: nada é instalado, e o espaçamento da origem nunca substitui o seu. **Choose individual items in the tray** mantém itens individuais, e **Download design context** salva um relatório JSON com observações, tokens propostos e informações da origem (com um SHA-256 de qualquer HTML ou CSS fornecido). O relatório não contém texto bruto da página e não é uma Content Credential assinada.

As importações de PDF e de arquivos de design mantêm os próprios controles de revisão. Os itens na **Tray** não mudam nada até você adicioná-los na sala que cuida daquele tipo de material. `#/start?source=<kind>` abre o seletor em uma origem (`file`, `pdf`, `image`, `font`, `url`, `page`), e `?import` abre a lista simples.

### Encontre e compare um visual

Abra **Find a look** no Overview ou na lista de sistemas de design em Settings. Navegue pelos sistemas salvos neste dispositivo e por alguns exemplos reutilizáveis do Lolly, e pesquise por nome, etiqueta de cor ou fonte declarada. **Closest to my current palette** ordena pela similaridade de cor medida, com as fontes correspondentes servindo de desempate; não é uma nota de qualidade.

Selecione um visual para revisá-lo, ou dois para compará-los lado a lado. Selecionar não muda nada. **Use this saved system** troca para ele, e **Use these colours** aplica as cores de um exemplo pelo ponto de restauração habitual, mantendo suas fontes. **Restore brand settings** recupera o visual anterior. Os sistemas salvos têm **Search tags** editáveis em **Details and design context**. Os exemplos são receitas de cor originais do Lolly, sem coleção copiada de sites e sem conta.

![Compare Sunroom e Orchard lado a lado antes de aplicar qualquer um dos sistemas de cor.](/t/url-shot?url=%2F%23%2Fstart&width=1280&height=900&dpi=96&waitMs=3000&format=svg&filename=brand-compare-looks&try=1&drive=click%3A%5Bdata-ds-door%3D%22looks%22%5D%3Bwait%3A500%3Bclick%3A%5Bdata-look-select%3D%22example%3Asunroom%22%5D%3Bclick%3A%5Bdata-look-select%3D%22example%3Aorchard%22%5D%3Bclick%3A%5Bdata-looks-review%5D%3Bwait%3A500&cropSelector=.ds-looks-comparison&waitSelector=%5Bdata-ds-door%3D%22looks%22%5D&walker=1&rasterDpi=96)

## Guarde e mova o seu sistema de design

### Mova uma marca entre dispositivos

**Export** grava um arquivo **`LollyBrand-….lolly`**: seus tokens, fontes, logotipos e preferência de tema, com um manifesto de integridade conferido na volta. As versões web anteriores à 1.0.7 chamavam o mesmo arquivo de `.zip`, e essa grafia ainda é aceita. **Tokens (.json)** grava sozinho o documento simples de design tokens, sem fontes nem logotipos, para um repositório, uma etapa de compilação ou outra ferramenta de tokens.

Para trazer um de volta, use **Add from… → Design tokens or a design file**, ou solte o arquivo no estúdio. É assim que um colega entrega uma marca a você, ou que você leva uma para uma segunda instalação, sem conta e sem nuvem. Para trazer uma marca pela linha de comando, veja [`ingest:brand`](/info/configuration.html#brand-packs).

**Fonts for Linux (.rpm)** empacota as fontes que você adicionou em um RPM instalável. Se você mesmo enviou alguma delas, o Lolly pede antes que você confirme que pode redistribuí-las.

### Restaure configurações anteriores

Escolha **Restore brand settings**, selecione um ponto de restauração datado e pressione **Restore**. Ele restaura cores, configurações de fonte e outros tokens da marca ativa; os arquivos de fonte e de imagem ficam como estão. O Lolly salva antes as suas configurações atuais como **Before restore**, para que você possa reverter uma restauração mesmo depois de fechar o navegador. Os últimos 20 pontos de restauração ficam neste dispositivo.

### Versions

Uma versão publicada é uma **cópia nomeada e permanente** mantida neste dispositivo. Ela nunca muda, então uma ferramenta ou um link que a fixa (com `designv`) continua desenhando a mesma coisa. Um sistema com algo seu mostra um discreto link **Versions & publishing** no rodapé da barra; depois da sua primeira publicação, ele vira a entrada **Versions**. `#/start?area=versions` a abre diretamente.

- **Uma versão é permanente.** Ainda não há como excluir, e o painel diz isso.
- **As remoções abrem o cartão de compatibilidade**, porque um token removido é o que quebra uma ferramenta.
- **Publicar não pode ser desfeito; restaurar pode.** *Restore latest from this version* é uma edição comum, com **Undo** oferecido na hora.

**Publish only** guarda uma versão sem mudar o que as ferramentas seguem; **Publish and make active** faz as ferramentas e o app seguirem aquela versão. **Follow the latest again** põe cada edição no ar no instante em que você a faz.

## Gerencie seus sistemas de design

Abra **Settings → Preferences → Design systems** para alternar, adicionar ou remover sistemas. **Open** seleciona um sistema e o abre aqui; **Make a new one** cria um sistema local e o abre com o campo de nome pronto. Um sistema fica ativo por vez, para o dispositivo inteiro. [Brand architectures](/info/brand-architectures.html) ajuda a decidir quando uma marca precisa de um sistema de design próprio.

**De onde vem um sistema.** O sistema que o catálogo de uma implantação fornece mostra **Came with this app**, ou **From this instance** em um app conectado a uma. Expanda **Catalogue source** para ver quem o fornece, o recurso de tokens e o namespace dele, e a versão ou o checksum conhecido; se uma atualização falhar, o material em cache é identificado.

**Os sistemas gerenciados são somente leitura.** Um sistema mostra **Managed by this instance** (ou **Managed by this app** no app desktop sem instância) quando o catálogo dele o bloqueia. Você pode usá-lo e baixá-lo, e abri-lo aqui mostra uma nota somente leitura com **Make an editable copy** e **Switch**. Seus próprios sistemas locais continuam editáveis, mesmo quando o gerenciado veio primeiro. Uma compilação com uma marca fixa abre o Design System Setup em *This brand is set*, com os tokens e as regras de uso da marca para leitura.

**Todo outro sistema fornecido é seu** para ocultar, editar e redefinir, incluindo o Lolly Demo e o Lolly Starter no lolly.tools. Editar um mantém o nome dele e marca a linha como **Edited here**, e **Reset to original** no menu dele descarta as alterações feitas neste dispositivo. O starter em branco é a exceção: uma primeira alteração ali inicia um sistema de design só seu, então o Lolly pergunta uma vez como chamar o novo sistema. [Lolly Demo in use](/info/lolly-demo-in-use.html#switch-to-your-own) mostra o que o seu próprio sistema substitui.

### Remover um sistema de design

Escolha **Remove** no menu de um sistema; a confirmação diz qual sistema ficará ativo depois. As sessões salvas, os envios e o material compartilhado com outro sistema permanecem.

Remover um sistema fornecido apenas o oculta: os recursos do catálogo dele permanecem, **Bring back** o mostra de novo e ele volta sozinho se você remover todos os outros. Remover uma cópia importada ou editada não remove o sistema fornecido, seus logotipos nem suas fontes, e se a cópia estava ativa, o sistema fornecido volta a ficar ativo. Remover uma cópia hospedada ativa limpa apenas a conexão dessa cópia; uma instância escolhida separadamente continua selecionada.

Mudar o que um servidor fornece é tarefa de administrador: o operador dele altera o catálogo de origem e reimplanta, ou um administrador do Lolly Work revisa e aplica uma mudança no servidor. As edições aqui continuam locais. Veja [Removing a catalogue design system](/info/configuration.html#removing-a-catalogue-design-system) e [Configuration](/info/configuration.html#supplied-and-local-design-systems).

## Use o contexto de design fora do app

**Download design context** salva o documento de tokens, as cores resolvidas, as famílias de fontes declaradas, os ids de recursos, as evidências de origem quando registradas, a cobertura e as regras explícitas, sem arquivos de fonte e sem prova de propriedade. A linha de comando lê o arquivo sem servidor: `lolly system import` faz dele o sistema de design do terminal e `lolly system check` verifica as entradas do Design contra o contexto salvo. [Bring your design system](/info/cli.html#bring-your-design-system) cobre a importação e [Which design system a command uses](/info/cli-decks.html#which-design-system-a-command-uses) cobre a verificação, e um cliente MCP lê o mesmo resumo em `lolly://design-context` ([MCP Server](/info/mcp.html)).

## Para onde ir agora

- **[Using Lolly](/info/using.html)**: as ferramentas, salvar, compartilhar e Assets.
- **[Brand architectures](/info/brand-architectures.html)**: como divisões, produtos, marcas endossadas, clientes e temporadas se encaixam em sistemas de design, variações de cores e identidades de logotipo.
- **[Design Tokens](/info/design-tokens.html)**: o modelo de tokens em que a sua marca é escrita.
- **[Export a file](/info/exporting.html)**: unidades de impressão, CMYK e os formatos em que a sua marca é renderizada.
