# Lolly Design System Setup

<a id="design-system-setup"></a>

**Lolly Design System Setup**, em `#/start`, reúne seu logo, suas cores e suas fontes. Todas as ferramentas, páginas e exportações desenham com eles.

Solte um logo e o Lolly lê suas cores. Escolha uma fonte ou solte o arquivo de fonte que sua empresa licencia. Cada alteração aparece em todo o app na hora. Seu logo, suas fontes e seus tokens ficam neste dispositivo. Só a escolha de uma Google Font faz uma conexão externa: o Lolly pede confirmação antes e depois baixa a família uma vez.

Dê um nome ao sistema de design e pressione **Export** para obter um arquivo `.lolly`. Guarde o arquivo, abra-o em outro dispositivo ou entregue-o a um colega. [Lolly Settings](/info/dashboard.html#design-system) mostra o sistema ativo apenas para leitura; a capa dele leva de volta aqui para edição.

<!--i:eti-clock-->
## Deixe com a sua cara em cinco minutos

::: timeline
- <!--i:upload--> **Solte seu logo** na área de soltar arquivos em **Logos**. O Lolly lê sua forma e suas cores.
- <!--i:palette--> **Use these colours.** A cor principal do logo vira sua cor primária, e um tom neutro escuro do logo vira sua cor de texto.
- <!--i:font--> **Escolha uma fonte** em **Type**: uma Google Font ou um arquivo de fonte seu.
- <!--i:pentool--> **Dê um nome ao sistema.** Sua primeira edição cria um sistema de design próprio, e o Lolly pede o nome dele uma vez.
- <!--i:download--> **Export** grava o sistema inteiro como um arquivo `LollyBrand-….lolly`.
:::

A barra no topo do estúdio mostra o nome do sistema de design como um campo editável. **Enter** mantém um nome novo e **Escape** restaura o antigo. Quando sua primeira edição pergunta **What is this design system called?**, o Lolly preenche as palavras do seu logo, se ele as contiver. **Save name** mantém o nome; **Not now** mantém um nome provisório até você digitar um na barra. O nome identifica o sistema em Settings e quando você troca de sistema, e é o nome do arquivo que **Export** grava.

<!--i:eti-grid-->
## As salas

O estúdio é um conjunto de salas sem ordem fixa. Nenhuma sala depende de outra. No desktop, as salas ficam em uma faixa abaixo da barra. No celular, elas passam para uma barra na borda inferior, que rola para mostrar a sala aberta. O painel da paleta e a bandeja se abrem acima dessa barra, e a barra sai do caminho enquanto você digita. Com um teclado, Tab chega à faixa uma vez, e as teclas de seta, Home e End mudam de sala.

![A barra do estúdio e suas salas: Board, Colours, Type, Logos, Tokens, Files, Sound, Rules e Skills](/t/url-shot?url=%2F%23%2Fstart&width=1440&height=900&dpi=192&waitMs=1600&cropSelector=.ds-top&waitSelector=.ds-room-nav&format=svg&walker=1&localize=1&dark=1&filename=brand-studio&try=1)

| Sala | O que você faz nela | Chave do link |
|---|---|---|
| **Board** | Veja o que o sistema contém, com uma entrada para cada sala | `overview` |
| **Colours** | Adicione cores, atribua funções a elas, crie tons e uma paleta | `color` |
| **Type** | Escolha as quatro fontes que o app, as ferramentas e todas as exportações leem | `type` |
| **Logos** | Posicione suas marcas gráficas em cada orientação e tratamento | `logos` |
| **Tokens** | Cantos, espaçamento, sombras e todos os outros valores nomeados | `tokens` |
| **Files** | As imagens e os arquivos de áudio e movimento que sua marca guarda | `catalogue` |
| **Sound** | Defina a identidade sonora, a música para diferentes usos e a relação com a voz | `sound` |
| **Rules** | As regras que sua marca aplica, verificadas em exemplos reais | `usage` |
| **Skills** | Os padrões escritos da marca para pessoas e agentes, para ler e baixar | `skills` |

Crie um link para uma sala com `#/start?area=<key>`. As chaves das salas são permanentes, então Files mantém `catalogue`, Board mantém `overview` e Rules mantém `usage`. `?tab=` ainda funciona como um alias antigo. Uma chave desconhecida abre Board.

A **barra** reúne ações para todo o sistema. **Add from…** importa uma marca ([Importe uma marca](#bring-a-brand-in)). A **Tray** guarda o que uma análise encontrou e que você ainda não adicionou. **Export** grava o sistema como um único arquivo. **More** reúne **Tokens (.json)**, **Fonts for Linux (.rpm)**, **Versions & publishing**, **Restore brand settings** e **Design systems**, que abre a lista em Settings onde você troca de sistema ([Guarde e transfira seu sistema de design](#keep-and-move-your-design-system)). Cada ação aparece assim que tem algo sobre o qual agir. No celular, **Add from…** passa para **More** e **Export** aparece como ícone.

Enquanto o sistema de design for o que veio com o app, a barra começa com **Make it yours**, um menu com **Find a look**, **Add from…** e **Pick a colour**. Assim que o sistema é seu, **Export** volta a ocupar esse lugar.

<!--i:eti-clipboard-->
## Board

Sem nada escolhido ainda, Board oferece quatro maneiras de começar. **Start from a reference** abre o seletor de origem para um logo, uma captura de tela, uma página web ou um arquivo de design. **Pick a colour**, **Choose a face** e **Add a logo** abrem esses controles. Abrir um deles não grava nada. Abaixo, **Find a look** oferece cores e fontes prontas para experimentar, e **Explore the tools** está disponível desde o início.

Assim que algo é seu, Board mostra o que você tem, com suas próprias contagens primeiro. Colours informa o número de cores, com um `· N starter` discreto para as herdadas. A faixa mostra suas cores, depois uma linha fina e então as cores iniciais esmaecidas. Colourways mostra cada variação de cores como um pequeno bloco na sua cor principal. Type lista cada função e exibe cada família na própria fonte (*Inter para títulos*, com *Starter para o restante* na linha abaixo). Logos diz quantos espaços estão preenchidos (ou **Not set**), Tokens mostra o raio dos cantos e Files diz **Nothing yet** enquanto a biblioteca está vazia. Cada bloco abre sua sala.

Um sistema de design editável que veio com o app, como o Lolly Demo, mostra suas cores, variações de cores, fontes e marcas gráficas em Board desde o início, com uma etiqueta **Came with this app** ao lado do título. Acima, **Start here** oferece **Find a look**, **Add from…** e **Pick a colour**.

### O que vem no início e o que é seu

Em todas as salas, **Starter** marca tudo o que veio com o app e que ninguém escolheu. Uma instalação nova não traz nenhuma cor, apenas uma escala de tons neutros da tinta ao papel, para que superfícies, texto e linhas finas possam ser renderizados antes de qualquer escolha.

::: cols
## Inicial

- Veio com o app: os tons neutros da tinta ao papel, as fontes iniciais e o raio dos cantos padrão.
- Discreto, com uma etiqueta **Starter** e sem cor de destaque.
- Não conta como suas cores. Os tons neutros ficam em **Tokens** como **Neutrals · starter · 9**, e **Open** os mostra em Colours como um único grupo recolhido (`#/start?area=color&group=neutral`).
- Uma função que usa uma cor inicial mostra *"Starter Paper serve como substituta"*, com **Choose…** no seletor.

## Seu

- Escolhido ou instalado por você.
- Em destaque, com um cartão colorido onde você instalou uma fonte.
- Contado em Board e Tokens.
- Uma função que acompanha outra mostra **↳ follows Primary**.
:::

O material herdado nunca tem uma borda tracejada. Uma borda tracejada indica uma área para soltar arquivos.

<!--i:eti-shapes-->
## Logos

A área de soltar arquivos no topo, **"Drop marks here, or choose several at once"**, aceita quantos arquivos você tiver. O Lolly lê a forma e a tinta de cada arquivo. O arquivo então espera em **Waiting for a slot** como um chip que diz com o que ele se parece, como *"Parece a versão Horizontal primary"*, com a medida usada e um botão **Place** (**Replace** quando o espaço está preenchido). Quando o Lolly não tem certeza, o chip avisa e oferece **Change slot**, listando todos os oito. Nada é posicionado até você pressionar um botão.

Uma marca gráfica com margem vazia em excesso recebe primeiro uma oferta de corte. Responda à oferta ou pressione Escape para posicionar o original sem alterações. Quando uma marca gráfica pode preencher outro espaço vazio do mesmo conjunto, a sala oferece a versão derivada **mono** ou **reverse** como um chip marcado *Generated*.

Cada marca gráfica vai para uma grade de oito espaços opcionais, um por **orientação** e **tratamento**:

- **Orientações:** Horizontal (logotipo e símbolo em uma linha) e Vertical (empilhados, para espaços quadrados e altos).
- **Tratamentos:** Primary, Primary reverse (para fundos escuros), Mono (uma cor) e Mono reverse.

Um grupo sem marcas gráficas se recolhe a uma linha; abra o grupo para ver seus espaços. Clique em um espaço para adicionar um PNG, SVG, JPEG ou WebP, ou clique em um espaço preenchido para substituir a marca gráfica. Um espaço vazio também aceita um arquivo arrastado. As marcas horizontais ficam em blocos largos e as verticais em quadrados, cada uma sobre a superfície para a qual foi feita, com uma área livre equivalente a um quarto da sua altura. Tudo fica neste dispositivo.

![Os espaços de logo com Horizontal e Vertical abertos: cada tratamento tem seu próprio espaço, e todos os espaços são opcionais](/t/url-shot?url=%2F%23%2Fstart%3Ftab%3Dlogos&system=new-design-system&width=1440&height=1600&dpi=192&waitMs=1600&drive=click%3A.be-logo-identity%3Edetails.be-logo-group--fold%3Anot%28.be-logo-group--custom%29%3Esummary%3Bwait%3A600&cropSelector=.be-logo-grid&format=svg&walker=1&dark=1&filename=bs-logo-slots)

- **Custom marks** são marcas gráficas que sua marca chama por um nome próprio, como um ícone, um brasão ou um favicon.
- **Mais identidades.** Uma submarca, produto ou evento pode ter seu próprio conjunto completo: pressione **+ Add another logo** e dê um nome ao conjunto. Seu conjunto principal é "Your logo". [Arquiteturas de marca](/info/brand-architectures.html) mostra quando usar uma identidade de logo.
- **O Lolly lê as cores do logo.** Um cartão abaixo da área de soltar arquivos e no topo de Colours lista as cores do logo e pergunta **Which is the main colour?**. A cor mais forte é selecionada, nunca o branco sobre o qual o logo foi exportado. **Use these colours** adiciona essas cores à sua paleta e torna a cor principal sua primária. Quando o logo tem um tom neutro escuro legível sobre papel, esse tom vira a cor de texto. **Not now** deixa as cores na Tray. Em uma instalação nova, o Lolly aplica a resposta mais provável na hora, e o cartão oferece **Undo** ou outra cor principal. Um SVG fornece cores exatas; um PNG, JPEG ou WebP fornece as cores que cobrem uma parte significativa da marca gráfica.

<!--i:eti-palette-->
## Colours

A sala cresce com o sistema de design. Uma primeira visita pede uma decisão; mais controles aparecem conforme a paleta cresce.

### A primeira cor

Um sistema sem cores próprias mostra os tons neutros iniciais em seu próprio grupo aberto. No topo da sala há um campo tracejado para colar e soltar: um chip grande e um campo. Solte uma imagem ou uma lista de cores em qualquer ponto do campo, e o Lolly lê as cores.

- **O chip é o seletor.** **Pick a colour** abre o cartão OKLCH do estúdio, preenchido com o conteúdo do campo. O cartão mostra primeiro o nome da cor e o hex. Os espaços de cor, o círculo cromático, os quatro controles giratórios e o alfa ficam em **Fine-tune**, e **Cancel** e **Add colour** ficam no rodapé. Nada chega ao sistema até você pressionar **Add colour**.
- **O campo aceita qualquer notação**: `#e0452b`, `rgb(224 69 43)`, `oklch(58% .19 32)` ou um nome de cor. Uma lista colada vira uma linha de chips para adicionar um por vez ou com **Add all**.
- **Mais duas formas de entrada.** **Pick a colour from the screen** usa o conta-gotas quando o navegador tem um, e **Take colours from an image** lê uma captura de tela ou foto neste dispositivo.
- **Add nunca fica desativado.** Com o campo vazio, ele abre o seletor; um texto que não consegue ler recebe uma linha abaixo do campo informando isso.

Sua primeira cor se torna a **primária**. Um chip confirma a alteração, como *"A primária agora é Vivid Violet"*, com **Fine-tune** para ajustar a cor.


### Conforme a paleta cresce

Suas cores ficam ao lado de uma prévia **In context** em uma tela larga e acima da prévia em uma tela menor. A prévia mostra um pôster, gráfico ou cartão de interface na sua paleta. As cores iniciais têm seu próprio grupo, que se recolhe assim que o sistema tem cores próprias. O campo de colar e soltar vira uma linha compacta. O cabeçalho da sala não tem exportação; use **Export** na barra ou a sala Tokens.

![A sala Colours no Lolly Demo: os chips de funções e o campo de colar e soltar no topo, depois a paleta em grupos retráteis, cada cor com seu nome e hex](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor&width=1440&height=740&dpi=192&waitMs=1800&drive=click%3A%5Bdata-be-roles-fold%5D%3Esummary%3Bwait%3A500&format=svg&walker=1&localize=1&dark=1&filename=brand-colours)

![A sala Colours no Lolly Demo depois de adicionar uma cor: a tabela Colour roles, depois o chip da nova cor oferecendo Use as Lead? e Fine-tune, ao lado de uma prévia ao vivo da composição](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dpick&width=1440&height=840&dpi=192&waitMs=1800&drive=click%3A%5Bdata-be-editor-add%5D%3Bwait%3A900&format=svg&walker=1&dark=1&filename=bs-colour-first)

### Funções das cores: como as cores são chamadas

O sistema de design dá nomes às cores e diz para que cada uma serve, e o Lolly lê as duas coisas. **Colour roles** fica no topo da sala Colours. **In context** mostra cada alteração na hora.

![A tabela Colour roles na Wefthouse, uma marca têxtil fictícia, nos próprios termos dela: os chips de variações de cores Indigo, Madder e Weld, depois Main, Accent, Supporting e Tertiary, cada um com sua cor clara e escura, interpretados como a cor principal, a cor parceira e apenas pelo nome, com Background, Text, Quiet text e Hairlines listados abaixo da tabela como as interpretações que nenhuma função atende](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor&system=wefthouse&width=2720&height=2000&dpi=192&waitMs=1800&cropSelector=%5Bdata-be-roles-fold%5D&format=svg&walker=1&dark=1&filename=bs-colour-roles)

A tabela tem quatro colunas. No celular, cada linha vira um cartão com claro e escuro lado a lado:

| Coluna | O que contém |
|---|---|
| **Role** | O termo do próprio sistema de design, que você pode editar no lugar, e uma linha dizendo para que a cor serve |
| **Light** e **Dark** | A cor nesse visual para a variação de cores escolhida, com seu nome ou valor e seu contraste |
| **Lolly reads this as** | O que uma ferramenta faz com a função, nas palavras do próprio Lolly |

**Como o Lolly interpreta uma função.** Cada interpretação aceita uma função. Escolher uma interpretação que outra função ocupa transfere a interpretação para esta função. O Lolly nunca deduz o significado de uma palavra.

| Interpretação | O que decorre dela |
|---|---|
| **Lead colour** | Formas grandes, botões, a cor principal de uma ferramenta |
| **Partner colour** | A segunda cor que uma ferramenta usa |
| **Background** | Fica atrás de todo o resto |
| **Text** | Títulos e corpo do texto |
| **Quiet text** | Legendas e letras miúdas |
| **Hairlines** | Linhas, bordas e divisórias |
| **By name only** | Nenhuma ferramenta escolhe a função por conta própria. Ela é oferecida em todos os campos de cor e no Design, onde a escolha fica vinculada, acompanhando a variação de cores |

Uma interpretação que nenhuma função ocupa mantém a definição do sistema de design, e a sala lista essas interpretações abaixo da tabela. Uma função que tem o mesmo id de uma interpretação, como uma função chamada Primary, é essa interpretação e não pode ser movida.

**Em um gráfico.** A paleta **Design system - colour roles first** do Lolly Chart dá às séries as funções de cor do sistema de design na ordem dele, depois o restante da paleta. Uma função interpretada como fundo, texto, texto discreto ou linhas finas fica de fora, porque o gráfico desenha seu fundo e suas palavras nessas cores. Nada muda até você escolher essa paleta. Um sistema de design sem funções de cor desenha a paleta como **Design system - ordered**.

**Valores.** Pressione um valor para escolher a cor dessa função para esse visual e a variação de cores escolhida. **Same as light** faz o valor escuro acompanhar o claro até você escolher uma cor escura. O chip **Aa** mostra o texto que o Lolly escolhe para colocar sobre a cor. A linha abaixo do valor diz como esse texto fica em cada visual: **Text reads well**, **Large text only** ou **Hard to read as text**. A avaliação trata apenas do texto sobre a cor; a cor ainda pode funcionar para formas e áreas grandes. Uma função interpretada apenas pelo nome mostra as mesmas palavras sem a cor de aviso, porque nenhuma ferramenta coloca texto nessa função por conta própria. A dica e o seletor mostram os números, APCA primeiro e WCAG depois. **Own text colour** marca um valor cujo arquivo declara a cor do texto; essa cor de texto permanece. **Copied** marca um valor de outra variação de cores ou da cor parceira que ninguém escolheu ainda; **Keep this colour** no seletor confirma o valor.

**Pontos de partida.** Um sistema de design sem funções próprias mostra as palavras atuais: Primary, Secondary, Surface e Text. Nada é gravado até você mudar uma delas. **+ Add a role** sugere **Primary, Secondary** ou **Main, Accent, Supporting, Tertiary**, ou aceita as palavras que você digitar, e mostra a interpretação que cada uma receberia. As duas primeiras palavras viram a cor principal e a cor parceira. As ferramentas continuam desenhando as mesmas cores. Em um sistema com uma cor principal, a primeira variação de cores recebe o nome dessa cor.

**Renomear, reordenar, remover.** Renomear muda apenas a palavra; tudo o que usa a função continua funcionando. Arraste uma função pela alça, ou pressione Space na alça, use as setas e pressione Space para soltar. **Remove** diz o que ainda usa a função. Quando ferramentas interpretam a função, **Remove and keep those colours** deixa cada interpretação com sua cor atual. Uma regra da organização, um grupo de guias, um campo de ferramenta ou outro token que usa a função impede sua remoção até esse uso mudar. Um documento salvo do Design também pode usar uma função pelo nome, e o Lolly não consegue ver isso pelo arquivo de tokens. Esse documento informa a cor como não resolvida.

::: details Funções em um arquivo de tokens escrito à mão
**Um arquivo escrito à mão.** Cores em um arquivo de tokens que nenhuma função declara são listadas em **In this file, with no role yet**, cada uma com um campo para uma palavra e **Make a role**. Elas continuam funcionando pelo nome de qualquer forma. Um token com dígitos no nome não pode ser uma função; ele permanece no arquivo e continua funcionando pelo seu caminho. Se um registro do arquivo não passar na validação, a tabela aparece sem controles e diz por quê.
:::

**O restante da sala usa as mesmas palavras.** Os chips, a linha **Use as** da amostra e o grupo **Colour roles** da paleta usam as palavras do sistema de design. O cartão de uma função de cor abre seu valor. Os arquivos exportados não registram nada novo sobre funções; as cores de uma renderização mudam porque os tokens mudaram.

**Para onde vão as palavras.** As palavras e descrições acompanham o sistema de design. Os agentes as leem no brief de design, em `lolly://tokens` e no `AGENTS.md` de uma página de marca. O terminal as mostra em `lolly system status`. Uma página de marca as lista em `brand.json` e mede um par de contraste para cada função. Os arquivos DTCG e Tokens Studio mantêm tudo, `DESIGN.md` mantém as palavras e as interpretações, e um tema do PowerPoint mantém apenas a ordem da marca. [Funções de cor em outros formatos](/info/design-tokens.html#colour-roles-in-other-formats) traz a lista completa. As palavras são sempre citadas como dados do sistema de design, nunca lidas como instruções.

**Onde uma cor é escolhida.** Todo campo de cor em uma ferramenta e no Lolly Design lista primeiro as funções do sistema de design, na ordem dele, com cada palavra e sua finalidade. **Aa** ao lado de uma função escolhe a cor que fica sobre essa função. As outras cores vêm em **Other colours**, sem as cópias próprias de uma variação de cores, as cores de sobreposição e qualquer interpretação que uma função já ocupe. Uma escolha fica vinculada à função e acompanha a variação de cores. O campo mostra a palavra em todas as variações de cores, e Settings e Tokens também usam a palavra. Um sistema de design sem funções mantém sua grade de amostras.

### Todas as cores que uma ferramenta lê

Com **Colour roles** fechado, a sala começa com chips para as primeiras decisões. Cada chip mostra a cor da função e seu nome. Em um sistema sem palavras próprias, eles são **Primary**, **Secondary**, **Surface** e **Text**. Pressione um chip para escolher sua cor nas amostras da paleta. **Every colour a tool reads**, no rodapé de **Colour roles**, tem a faixa completa.

A faixa mostra as sete cores que uma ferramenta pode ler: Primary, Secondary, Surface, Text, Muted, Edge e On primary, nas palavras do próprio sistema de design quando ele as tem. Cada uma cumpre o mesmo papel em todas as ferramentas e exportações. Nenhuma precisa ser definida, e qualquer cor pode ocupar uma delas. Três cores independentes formam um bom sistema. O indicador diz como o texto fica sobre a superfície, com APCA primeiro. Cada linha mostra sua própria cor em intensidade total, uma cor inicial como substituta ou **↳ follows Primary**.

On primary é derivada da cor primária, mostra **Derived** e não tem seletor. O alternador **Light** e **Dark** ao lado de On primary, e o que fica ao lado de **In context**, escolhem qual visual a faixa, a paleta e a prévia mostram.

A cor de destaque do próprio app acompanha o sistema de design por padrão, pela configuração **Interface follows the design system** em **Settings → Appearance**. Com a configuração desativada, a interface do app fica neutra. Ferramentas, canvas e exportações acompanham o sistema de design de qualquer forma.

**Variações de cores.** Um sistema de design pode conter várias cores principais, escolhidas por peça. A linha **Colourways** no topo de **Colour roles** mostra um chip por variação de cores, com **Default** na canônica. **+ Add** cria uma nova variação de cores a partir de uma cor da paleta. Escolha um chip, e a tabela, a faixa, a paleta e as prévias mostram essa variação de cores. Você pode renomear, duplicar, remover ou tornar padrão a variação de cores escolhida. Em um sistema com variações de cores, cada variação precisa de sua própria cor primária e secundária, e de sua própria superfície quando as variações de cores tingem o fundo. Essas funções permanecem definidas no editor de amostras. [Adicionar variações de cores a um sistema de design](/info/colourways.html#add-colourways-to-a-design-system) traz os passos e o formato dos tokens, e [Lolly Demo em uso](/info/lolly-demo-in-use.html#colourways-on-real-work) mostra variações de cores em trabalhos reais. Cada pessoa pode adotar uma variação de cores como sua em **Settings → Appearance** ([Adote uma variação de cores](/info/colourways.html#make-a-colourway-your-own)).

### Encontre mais cores

Três ferramentas partem da sua cor primária. As duas primeiras apenas sugerem; a terceira substitui a paleta.

::: cols
## Explore tons & harmonias

Escolha uma **Starting colour**, um **Scheme** (Mono, Complement, Analogous ou Triad) e quantos **Shades** (3 a 20, padrão 5). **Fine-tune** define a intensidade da interface, o contraste e o texto sobre a cor da marca. Clique em um tom para adicioná-lo, ou em **Add 5 shades** para um grupo. Suas cores e funções permanecem.

## Encontre cores que combinam

Escolha uma **Harmony**: Complementary, Adjacent, Triad, Tetrad ou Analogous (com **Accents** de 2 a 5 e um **Angle** de 10° a 45°). Cada candidata tem um nome gerado e **+ Add**, um clique por cor.

## Reconstrua toda a paleta

Substitui a paleta a partir de uma cor inicial, após uma revisão do que muda e do que fica.
:::

As três usam os mesmos cálculos de cor perceptual (OKLCH) do mecanismo. Em **Explore shades & harmonies**, as linhas **Primary**, **Neutral** e **Secondary** mostram os tons sugeridos, e **Theme preview** mostra exemplos claros e escuros com suas leituras de contraste.

![Três grupos de tons sugeridos, com controles individuais para adicionar e uma Theme preview separada](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dgenerate%26seed%3D%2523e0452b&width=1440&height=1400&dpi=192&waitMs=1800&css=.start-head%7Bdisplay%3Anone%7D&cropSelector=.be-preview&format=svg&walker=1&dark=1&filename=bs-colour-ramps)

![Cores de destaque geradas, cada uma com uma amostra, um nome gerado automaticamente, seu valor hexadecimal e um botão Add](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dgenerate%26seed%3D%2523e0452b&width=1440&height=900&dpi=192&waitMs=1800&css=.start-head%2C.be-colour%7Bdisplay%3Anone%7D&drive=click%3A.be-generate-detail%3Anot%28%5Bdata-be-rebuild%5D%29%20%3E%20summary%3Bwait%3A500&cropSelector=.be-candidates&walker=1&format=svg&dark=1&filename=bs-harmony-candidates)

### Aplicar uma paleta gerada

Abra **Rebuild the whole palette…** e pressione **Preview full rebuild**. A revisão conta quantas funções ficam como você as atribuiu, quantas cores próprias são mantidas e quantas curvas de tons, travas de impressão, tons ocultos e paradas de gradiente são reancorados ou mantidos. **Apply rebuilt palette** aplica; **Cancel** não muda nada. Depois, o cartão oferece **Undo**, já em foco, e o ponto de restauração criado antes da troca restaura o sistema inteiro.

Um sistema com variações de cores mantém todas elas durante uma reconstrução. A variação de cores canônica acompanha a nova cor inicial, e todas as outras mantêm suas próprias cores, nome, ordem e configurações. A revisão lista qual variação acompanha a cor inicial e quais mantêm suas cores. O Lolly não reconstrói um sistema que codifica suas variações de cores de uma forma que ele não consegue editar; o cartão diz por quê, e nada muda.

### As seções avançadas

Quatro seções recolhidas ficam abaixo da prévia e das funções. Cada uma abre com `#/start?area=color&focus=<name>`:

- **Explore shades & harmonies** (`focus=generate`).
- **Shade curves** (`focus=curves`) remodela uma escala ponto a ponto, com curvas separadas de luminosidade, croma e matiz (L / C / H) e os tons redesenhados enquanto você arrasta.
- **Contrast** (`focus=contrast`): **Contrast-lock** reajusta os tons de uma escala para atingir metas de APCA contra um fundo que você escolhe, e **Rotate hue** gira toda a escala ao redor do círculo.
- **Print** (`focus=print`) define o que a cor primária vira na impressão: seu valor automático, uma composição CMYK fixa ou uma tinta especial nomeada.

### A paleta e cada amostra

A paleta lista suas cores em grupos retráteis, cada um com seu próprio **+ Add**. Você pode criar e renomear grupos. Uma função nunca cria um segundo cartão; o cartão para o qual uma função aponta mostra o nome da função, como **Primary**. **Colour chart** abaixo dos cartões mostra as mesmas cores no **Wheel** de OKLCH (arraste um ponto para mudar a cor, clique em um espaço vazio para adicionar uma amostra) e no gráfico **Gamut**, que mostra onde termina a faixa de cores que podem ser exibidas. `#/start?area=color&focus=chart` abre o gráfico.

![O painel da paleta, com todos os grupos retráteis](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dgenerate%26seed%3D%2523e0452b&width=1440&height=1000&dpi=192&waitMs=1800&drive=click%3A%5Bdata-be-roles-fold%5D%3Esummary%3Bwait%3A500%3Bclick%3A%5Bdata-be-add-ramp%3D%22primary%22%5D%3Bwait%3A1200&cropSelector=.be-split-side&walker=1&format=svg&dark=1&filename=bs-palette-pane)

![O círculo OKLCH - o ângulo é o matiz, a distância do centro é o croma e os cinzas ficam em uma faixa de luminosidade na lateral](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dgenerate%26seed%3D%2523e0452b&width=1440&height=900&dpi=192&waitMs=2400&css=.start-head%2C.be-pal%2C.be-gradients%7Bdisplay%3Anone%7D&drive=click%3A%5Bdata-be-add-ramp%3D%22primary%22%5D%3Bwait%3A1200%3Bclick%3A%5Bdata-be-chart%5D%20summary%3Bwait%3A900&cropSelector=.be-pal-wheel&walker=1&format=svg&dark=1&filename=bs-colour-wheel)

Clique em uma amostra para abrir seu editor:

- **Rename** renomeia a amostra.
- **Defina a cor** com controles deslizantes de OKLCH, ou em **Hex**, **HSL**, **RGB** ou **CMYK**. O campo de valor lê e grava no espaço ativo. CMYK aqui define a cor da tela por conversão; para fixar tintas exatas, use **Print substitutes**.
- **Stored as** escolhe como a amostra é salva: **LCH** (o padrão, perceptual e de ampla gama), Hex, RGB ou HSL.
- **Use as** dá uma função à amostra, nas palavras do próprio sistema de design quando ele as tem. Pressione novamente uma função destacada para limpar a função.
- **Print substitutes** (recolhido): trave **CMYK**, mudando de **Auto** para valores exatos de tinta, ou defina uma **Spot colour** com um **Name** (como `PANTONE 186 C`), um **Book** opcional e um **Finish** para aplicação de foil, alto-relevo, baixo-relevo, verniz localizado, toque aveludado ou corte especial, vinco ou perfuração. A gráfica usa essas travas quando você exporta um PDF ou TIFF em CMYK; veja [Perfis de cor](/info/exporting.html#colour-profiles). Uma tinta especial imprime em sua própria chapa em um Print PDF; para imprimir todas as tintas especiais em quadricromia em uma exportação, veja [Tintas especiais em quadricromia](/info/exporting.html#spot-inks-as-process).
- **In other spaces** (recolhido): um valor por espaço de cor, derivado ou definido por você, e o definido por você prevalece na exportação.

**Excluir uma amostra** é seguro. Tons derivados e funções de tema são ocultados, então nada que os lê deixa de funcionar. As cores que você adicionou são removidas.

::: details Trabalhar com muitas amostras
Em repouso, uma amostra mostra sua cor, nome e valor hexadecimal. Select mostra a caixa de seleção e a alça de arraste de cada amostra em qualquer tela, e um cartão com foco do teclado também mostra sua alça. Arraste uma alça para reordenar dentro de um grupo, ou dê foco à alça, pressione Space, use as setas e pressione Space de novo para soltar; Escape cancela. No celular, a paleta mostra quatro cores por linha. Para mover cores entre grupos, use o controle **Group** do editor ou selecione várias e use **Move to**.

A seleção não precisa de um alternador separado: a barra e as caixas de seleção aparecem com o primeiro cartão selecionado e somem com o último.

- **Arraste em um espaço vazio** para desenhar um retângulo; todos os cartões que ele toca entram na seleção, mesmo em grupos diferentes. Uma seção recolhida não adiciona nada.
- **Clique com Shift** seleciona um intervalo na ordem de leitura, **clique com Cmd/Ctrl** alterna a seleção de um cartão e um clique simples abre o editor.
- Cada cabeçalho de grupo tem **Select all**, e **Cmd-A** com um cartão em foco seleciona todas as suas cores, nunca uma cor inicial.
- A grade tem uma única parada de tabulação: as setas movem, Shift com setas estende a seleção, Space alterna, Delete remove e Escape limpa. Para ajustar um canal em pequenos passos, pressione `l`, `c` ou `h` primeiro.
- Em uma tela de toque, mantenha um cartão pressionado para iniciar uma seleção, depois toque para adicionar.

A barra mostra **{n} selected**, depois **Move to**, **Give a role** (cada cor recebe a próxima função na sequência), **Download** (a seleção em qualquer um dos seis formatos de paleta), **Duplicate** (uma cópia de cada, colocada após o original), **Copy values** e **Delete**. Uma cópia abre no editor; várias permanecem selecionadas. Um Cmd/Ctrl-Z desfaz uma ação em lote.
:::

### Gradientes

O painel opcional **Gradients** cria tokens de mistura a partir da paleta. Cada gradiente tem uma prévia, 2 a 8 paradas nomeadas e um ângulo. Uma parada aponta para uma amostra, então mude a cor da amostra e o gradiente acompanha. As misturas usam OKLCH.

Os downloads da paleta (tokens de design, CSS, SCSS, GIMP e Adobe Swatch Exchange) ficam no cabeçalho da paleta. [Leve sua paleta e suas fontes para qualquer lugar](/info/using.html#take-your-palette-and-fonts-anywhere) descreve cada formato.

<!--i:eti-type-->
## Tipografia

Sem uma fonte própria, a sala mostra um cartão: **Primary**, composta em tamanho de leitura na fonte atual, com uma etiqueta **Starter**, um botão **Choose for Primary** e a frase *"Nada é instalado até você escolher uma."* Títulos, código e itálico acompanham a fonte primária até você escolhê-los; **Choose them separately** mostra seus cartões.

![A sala Type sem nenhuma fonte escolhida ainda - um cartão em tamanho de leitura, uma etiqueta Starter nele e um botão preenchido Choose for Primary](/t/url-shot?url=%2F%23%2Fstart%3Ftab%3Dtype&system=new-design-system&width=1440&height=740&dpi=192&waitMs=1800&format=svg&walker=1&dark=1&filename=brand-type)

Escolha uma fonte e a sala se expande em quatro cartões de função, a lista Fonts e uma amostra ao vivo:

- **Primary**: corpo do texto, botões e todas as ferramentas.
- **Headings**: a fonte de destaque para `h1` e `h2`.
- **Code**: uma fonte monoespaçada para código e dados.
- **Italic**: um itálico verdadeiro para ênfase, citações e observações.

Um cartão só recebe cor onde você instalou aquela fonte. Seu botão mostra a função: **Change Headings** em uma fonte própria e **Choose for Headings** nos demais casos. A linha de exemplo quebra automaticamente. Nada em um cartão aplica uma mudança; o botão abre a área de comparação para essa função.

![Os quatro cartões de função revelados - cada um composto na fonte que o atende, com uma etiqueta Starter onde ninguém escolheu uma e Italic acompanhando a fonte primária](/t/url-shot?url=%2F%23%2Fstart%3Ftab%3Dtype&system=new-design-system&width=1440&height=1000&dpi=192&waitMs=2600&drive=click%3A%5Bdata-be-typemore-toggle%5D%3Bwait%3A600&cropSelector=.be-typecard-grid&walker=1&format=svg&dark=1&filename=bs-type-specimen)

### A área de comparação

A área abre abaixo do cartão que você pressionou. Os cartões se recolhem em uma faixa de uma linha para que a área apareça na primeira tela do celular. Escape cancela e devolve o foco ao cartão.

1. Pressione **Choose for** e a função no cartão.
2. Digite o nome de uma família e pressione **Preview**, ou pressione uma das seis famílias **Pinned** abaixo do campo.
3. Pressione **Use this face**.

![A área de comparação aberta abaixo do seu cartão, com a linha de busca, as famílias fixadas e os cartões recolhidos em uma faixa de uma linha](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dtype%26focus%3Dstage&width=1440&height=740&dpi=192&waitMs=1800&format=svg&walker=1&dark=1&filename=bs-type-stage)

**O consentimento é pedido uma vez.** Na primeira vez que uma prévia acessa o Google Fonts, uma caixa de diálogo explica: *O Google recebe o nome da família e seu endereço IP. O arquivo é então mantido neste dispositivo e usado offline. Este é o único passo no estúdio que acessa um terceiro.* **Fetch from Google** prossegue e a escolha é lembrada. **Cancel** deixa o cartão com a mensagem *"Não obtida. Nada foi enviado ao Google."*, com seu próprio **Fetch from Google**.

**Solte um arquivo de fonte na área** (TTF, OTF ou WOFF) para visualizar uma fonte licenciada que você tem. De qualquer forma, a fonte fica neste dispositivo, é renderizada offline no app, nas ferramentas e em todas as exportações, e acompanha o arquivo do sistema de design. Tudo no Google Fonts é distribuído sob uma licença aberta (OFL, Apache ou UFL).

### Fontes neste dispositivo

O painel **Fonts** lista todas as fontes neste dispositivo e a função que cada uma atende. As fontes que você adicionou vêm primeiro, em **In the design system**, cada uma com suas funções e uma opção de excluir. As fontes iniciais vêm depois em uma linha discreta e recolhida. **Add a face** abre a área de comparação para qualquer função. O painel **Type roles** mostra uma amostra ao vivo de cada função com sua família e estado, como *Inter* ou *Inter · follows Primary*.

<!--i:eti-tag-->
## Tokens

Tokens são os valores nomeados por trás do sistema de design: cores, fontes, logos, cantos e espaçamento. As ferramentas os leem pelo nome, então uma mudança aqui chega a todas as ferramentas de uma vez.

![A sala Tokens: o cabeçalho com um exemplo do sistema e as ações de arquivo, cartões contando cada tipo de token, depois os pares de cores com seus indicadores de contraste](/t/url-shot?url=%2F%23%2Fstart%3Ftab%3Dtokens&width=1440&height=740&dpi=192&waitMs=1600&format=svg&walker=1&dark=1&filename=brand-tokens)

- **O cabeçalho** dá um exemplo do seu próprio sistema (*Primary é Spearmint, #033633*) e as ações de arquivo: **Download** (o sistema como tokens de design, ou a paleta em outros cinco formatos), **Copy CSS** e **Add from…** para ler um arquivo JSON de volta.
- **Os cartões** contam cada tipo de token e levam à sua seção: Colours, Type, Logos, Shape and spacing, More e All tokens. Uma seção que contém apenas o que veio com o modelo inicial em branco recebe uma etiqueta **Starter**; um sistema que veio com o app conta seu próprio material sem a etiqueta. No celular, os cartões se distribuem em duas linhas de três.
- **Colours** começa com os pares que as ferramentas combinam (texto sobre superfície, sobre a cor primária, texto discreto sobre superfície) com um indicador de APCA nos visuais claro e escuro, e sinaliza **Weak contrast** quando um par fica aquém do necessário. Depois vêm todos os grupos de cores: uma escala como uma linha de chips, outras cores com seu valor e a referência que as ferramentas usam, como `{color.brand.spearmint}`. Pressione uma referência para copiá-la. **Edit in Colours** abre um grupo na sala Colours. Em um sistema de design com [funções de cor](#colour-roles-what-the-colours-are-called), **Colour roles** vem primeiro, com cada função uma vez nas palavras e na ordem do próprio sistema. Uma função mantém uma cor para cada variação de cores e visual. Essas cores são listadas com a função, não como cores separadas; mude-as na tabela Colour roles.
- **Type** e **Logos** listam a fonte para cada função e cada posição de logo, com **Edit in Type** e **Edit in Logos** quando você tiver os seus próprios.
- **Shape and spacing** contém **Rounded corners** (`shape.radius`) e **Spacing rhythm** (`space.base`). Cada um mostra *Lolly default* até você mover o controle deslizante e *Yours* depois, salva na hora e pode ser desfeito.
- **More tokens** adiciona espaçamento, dimensionamento, espessura de traço, opacidade, rotação, números simples e sombras, armazenados como [tokens de design](/info/design-tokens.html) padrão.
- **App appearance (advanced)** lista as cores, os tamanhos e as sombras que as telas do próprio Lolly usam, e **Inspect every token (advanced)** busca e edita qualquer valor armazenado e mostra cada mudança para revisão antes. Ali, os valores de uma função de cor em cada variação de cores são listados com a função: escolha o token da função para ver uma linha por variação de cores, com claro e escuro lado a lado. A linha de contagem diz quantos valores as funções contêm. Um sistema de design somente leitura mostra a mesma lista.

Uma seção vazia oferece **Pick a colour**, **Choose a face** ou **Add a logo**.

<!--i:eti-images-->
## Arquivos

Solte os arquivos que sua marca mantém, além dos logos: arquivos **vetoriais**, de **imagem**, de **áudio** e de **movimento** (vídeo, Lottie e animações). Eles aparecem em [Assets](/info/using.html#assets-your-library), organizados em seções, e no seletor de recursos de todas as ferramentas. Eles ficam neste dispositivo.

## Som

**Sound** é escolhido ouvindo. A sala abre com três sons iniciais, **Calm**, **Steady** e **Bright**, cada um em um cartão nas cores de seu gênero com um botão de reprodução. Reproduza um para ouvir um trecho curto; iniciar outro para o primeiro. **Choose** torna esse som o som de todos os usos. O quarto cartão, **Mixed**, dá a cada uso seu próprio som: Calm para Explain, Steady para Demonstrate e Bright para Play. Seu botão de reprodução toca os três em sequência. Nada é salvo até você escolher **Save sound**. O som então passa a fazer parte deste sistema de design, com um ponto de restauração no mesmo histórico que as outras salas usam. Um sistema de design sem som continua funcionando como antes.

Um uso é um momento em que o som toca: **Explain**, **Demonstrate** e **Play** para começar. Cada uso é um chip com seu próprio botão de reprodução. **Music** ou **With narration** acima dos chips define se um chip toca só a música ou com uma voz por cima. O uso que você escolhe mostra sua finalidade e sua música em palavras simples, por exemplo "Acolhedor · 84 bpm · Rhodes, baixo fluido, bateria com som vintage". Cada uso recebe o gênero, o andamento e os instrumentos do som escolhido (ou, com Mixed, os seus próprios). Cada uso mantém sua própria melodia e seu próprio equilíbrio: Explain mantém a melodia sem atrapalhar a voz, e Play deixa a melodia em destaque. Alternar entre Mixed e um único som mantém ambos. Um uso que você adicionou mantém o som que tem em Mixed. O sistema de design registra qual você escolheu. **Add a use** adiciona um e deixa você digitar seu nome no lugar. **Make main** escolhe o uso reproduzido quando nenhum outro é solicitado. **Another tune** toca uma nova composição com as mesmas configurações.

**Edit in the music generator** abre o [gerador de música](/info/generated-music.html#the-music-generator) nas configurações desse uso, com uma linha no topo dizendo de quem é o som que você está editando. **Save to this use** traz as configurações de volta à sala; **Cancel** volta sem mudar nada. As escolhas não salvas na sala esperam enquanto você está fora. Se alguém salvar o som em outra aba nesse meio-tempo, o salvamento mais recente prevalece e sua edição fica de fora.

**Voice** escolhe uma voz para o uso, a velocidade da fala e o volume da música sob a voz; **Hear the voice with the music** reproduz os dois. Em **More** ficam a redução de volume enquanto a voz fala, as palavras para testar (elas ficam na sala), notas de pronúncia (uma por linha, como escrito = falado) e notas sobre a voz. As prévias usam o modelo de fala local e a mesma mixagem de uma exportação de sequência. Uma prévia termina diminuindo o volume; não é um final composto.

**Notes and signature** contém o que observar ao ouvir um uso e uma assinatura sonora: uma abertura ou um encerramento fixo mantido como seu próprio arquivo de áudio. Coloque a assinatura na sua sequência; a música gerada nunca inclui a assinatura. Um requisito que esta versão do Lolly não consegue verificar impede novas músicas para esse uso.

**Details** contém a personalidade da marca (a sensação que o som deve passar, o que permanece igual e o que evitar) e a revisão de escuta. **Record a listening review** mantém o nome do revisor, a data e suas notas junto à versão salva do som. Qualquer mudança torna o som um rascunho de novo. Uma revisão cobre aquela versão, não todas as músicas feitas a partir do som depois: ouça cada peça nova antes de ela sair.

**Make a music project** abre o uso no gerador de música como um projeto que mantém o uso, a versão do som e as configurações exatas. **New tune** ali cria uma nova composição e mantém o som. Se você mudar as configurações, **Put the sound back** volta ao som, e **Keep as my own** continua com uma música independente. Até você escolher, o projeto não pode ser salvo nem baixado como feito a partir do som. Os links de compartilhamento levam apenas as configurações de música. O projeto e uma música salva também mantêm as notas do som, que ficam fora dos links de compartilhamento e das credenciais públicas do arquivo de áudio. Guarde uma gravação renderizada quando o áudio exato precisar sobreviver a versões futuras do gerador.

<!--i:eti-checklist-->
## Regras

**Rules** define o que as pessoas podem mudar, o que fica fixo e o que o Lolly pode verificar.

![Rules no Lolly Demo: quatro regras da organização, cada uma marcada como Checked in Design e Required ou Advisory, depois Try your design system in use com seus exemplos prontos para renderizar](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dusage&width=1440&height=1200&dpi=192&waitMs=2400&cropSelector=%23start-panel-usage&format=svg&walker=1&dark=1&filename=bs-usage-rules)

**Brand rules** lista suas regras. **Add rule** (ou **Add your first rule**) abre um formulário curto:

- um **Rule name** nas suas palavras, como *Destaques Beacon*;
- a **Check**: **Colour choices**, **Font choices**, **Fixed artwork** ou **Text length**, com a função da marca que ela usa, sob o nome que você deu à função;
- o **Example** ao qual ela se aplica (Poster, Title slide, Content slide ou Lolly Chart), o **Mode** e se é **Required** ou **Advisory**;
- **Reviewed by**, depois **Save draft** ou **Approve & save**.

A aprovação registra sua própria decisão neste dispositivo. As regras obrigatórias aprovadas restringem o pôster reutilizável, e as verificações cobrem apenas os PNGs de exemplo; elas não mudam nenhuma outra ferramenta.

As regras no arquivo de tokens de um sistema de design, como combinações de cores aprovadas, peso e alinhamento do texto ou um logo por superfície, são listadas aqui como **Checked in Design**. O Lolly Design as verifica camada por camada no cartão **Before you export** do painel de exportação, e `lolly check` faz o mesmo para um documento salvo do Lolly Design ([Antes de exportar](/info/design.html#before-you-export)). Uma regra para a qual esta compilação não tem verificador é mantida como fornecida e marcada como **Unchecked**.

O Lolly Demo traz quatro regras aprovadas da organização. Os títulos nunca são compostos em maiúsculas: essa regra é obrigatória, então `lolly check` informa um título em maiúsculas como erro. As outras três são recomendações. O corpo do texto é alinhado à esquerda. As marcas principais ficam sobre superfícies claras e as marcas em negativo sobre as escuras. Linhas tracejadas significam solte aqui.

**Try your design system in use** renderiza quatro exemplos da revisão atual com **Render & check examples**. Escolha um **Mode** e **Try your own text** para o título, o texto de apoio e o texto do slide. Cada exemplo informa o que foi medido, com **See checks & sources** e **Download check report**. **Make reusable poster** baixa um `.lolly` com seu layout fixo e opções de entrada aprovadas. Os exemplos são locais: executar uma verificação não publica nem aprova nada.

Uma compilação que vem com uma marca fixa mostra as mesmas regras e exemplos como somente leitura, em *This brand is set*.

<!--i:eti-graduation-cap-->
## Skills

**Skills** lista as [skills de marca](/info/brand-skills.html) do sistema de design ativo: os padrões escritos da marca, um por disciplina, para pessoas e agentes de IA. Cada linha traz a disciplina, o estado definido pela própria marca (**Draft** ou **Approved**), se a skill é pública ou interna e sua revisão. Escolha uma linha para ler a skill com sua cobertura, que compara as linhas da skill com seus tokens: o que o Lolly verifica, o que conflita, o que concorda e o que é apenas orientação.

**Download skill (.zip)** grava a skill como uma pasta Agent Skills para uma ferramenta de agente, com links de catálogo apontando para este Lolly. **Copy as one file** coloca o mesmo texto na área de transferência para uma janela de chat. Um sistema de design sem skills próprias lista uma base que o Lolly escreve a partir dos seus tokens e das regras da organização toda vez que essa base é lida. A sala lê skills e nunca as edita.

<!--i:eti-upload-->
## Importe uma marca

**Add from…** na barra abre um seletor que pergunta o que você tem, não qual é o formato:

- **Design tokens or a design file**: JSON de DTCG ou Tokens Studio, um projeto Penpot, um zip de conjuntos de tokens, um pacote de sistema de design do Lolly, um SVG, um `DESIGN.md` ou uma pasta de página de marca.
- **PDF**: um deck ou um arquivo de diretrizes, lido neste dispositivo para obter suas cores, marcas e fontes incorporadas.
- **Logo or screenshot**: uma imagem vira uma paleta sugerida, lida neste dispositivo. A leitura obtém cores, não a fonte nem o layout.
- **Saved web page**: um arquivo HTML e seus arquivos CSS, ou HTML ou CSS colado, até 20 arquivos e 2 MB. Apenas o texto que você fornece é lido: recursos vinculados não são buscados e scripts não são executados.
- **Font file**: TTF, OTF ou WOFF. Abre a sala Type, onde a fonte é instalada.
- **Website**: uma página, lida para obter suas cores e tipografia. Este cartão aparece apenas em um dispositivo que consegue ler uma página e diz qual leitor usa: o app neste dispositivo ou a extensão do navegador em uma aba em segundo plano, com a sua sessão iniciada. Digitar uma URL apenas preenche o campo; pressionar o botão de busca é o consentimento.

Escolha a origem de arquivo de design e o próximo cartão lista os formatos aceitos como cartões de ícones. O cartão inteiro é uma área para soltar arquivos. Você também pode soltar um arquivo no estúdio.

![O cartão de importação - os formatos aceitos aparecem primeiro como cartões de ícones, e o cartão inteiro é uma área para soltar arquivos](/t/url-shot?url=%2F%23%2Fstart%3Fsource%3Dfile&width=1440&height=900&dpi=192&waitMs=1600&css=.start-import-modal%20.modal-msg%2C.start-import-modal%20.modal-title%7Bdisplay%3Anone%7D&cropSelector=.start-import-drop&walker=1&format=svg&dark=1&filename=bs-brand-import-formats)

- Um **pacote de sistema de design do Lolly** (`.lolly`, ou um `.zip` antigo) é instalado em um passo.
- Uma exportação do **Penpot** (`.penpot`) traz seus tokens de design.
- Um arquivo **Design Tokens** (W3C DTCG) ou **Tokens Studio** (`.json`) traz seus tokens. Uma descrição que pede ao leitor para ignorar instruções, alega permissões ou pede para executar código fica de fora, e a importação diz onde ela estava.
- Um **SVG simples** é examinado em busca de cores para você escolher, com a primeira se tornando sua cor primária.
- Um **`DESIGN.md`** (`.md`) vai para **Try these colours** com seus tokens como escritos. Sua prosa pode ser mantida como uma skill de marca em rascunho, e o cartão sinaliza linhas que pedem ao leitor para ignorar instruções, alegam permissões ou pedem para executar código. Agentes e páginas de marca não veem um rascunho até você pressionar **Keep this skill** na sala Skills, e uma skill guardada permanece interna.
- Uma **pasta de página de marca**, escolhida como pasta, arrastada ou compactada em zip, vai para a mesma revisão. Cada arquivo é verificado contra o `brand.json` da pasta; um arquivo que não corresponde causa a rejeição de toda a pasta. A importação adiciona os tokens. Logos e fontes ficam na pasta.

::: warning A verificação de instruções lê linha por linha
A verificação que exclui instruções das descrições de um arquivo de tokens lê linha por linha e não detecta outras formulações. Leia um arquivo de alguém que você não conhece antes de aplicar os tokens.
:::

O Lolly lê uma página de marca a partir dos arquivos que você fornece. Ele não busca o endereço de outro site.

### Um arquivo com suas próprias palavras para cores

Um arquivo de tokens ou um `DESIGN.md` pode usar palavras próprias para suas cores, como principal, destaque, apoio e terciária. Quando o Lolly encontra essas palavras, a revisão lista cada uma antes de qualquer aplicação: a palavra, sua cor em cada visual, o token de onde veio e a interpretação sugerida pelo Lolly. O Lolly sugere interpretações apenas a partir das palavras, comparando-as com uma lista curta, sem modelo. Uma palavra fora da lista chega como própria da marca, **By name only**. Você pode renomear qualquer palavra, dizer para que serve, dar outra interpretação a ela ou desmarcá-la para mantê-la como uma cor nomeada.

**Install with these roles** grava as funções; **Install without roles** instala o arquivo como veio. Um arquivo sem essas palavras pula este passo. Um arquivo que declara suas próprias funções, como um escrito pelo Lolly, mostra-as como escritas e as instala sem mudanças; você pode editá-las depois na sala Colours. O terminal não tem revisão: `lolly system import` mantém um registro declarado e deixa as palavras de outros arquivos como cores nomeadas.

### Revise uma referência

Um logo, captura de tela, site ou página salva abre **Try these colours**: um exemplo nas cores propostas, uma **Main colour** que você pode mudar e um nome para um novo sistema. Uma caixa diz o que aplicar faz: **substitui** as configurações dos tokens ativos pela paleta gerada e pelos estilos padrão, **mantém** suas fontes e arquivos da biblioteca e o sistema anterior pode ser **recuperado**. **Apply suggested settings** cria um ponto de restauração, depois aplica as paletas clara e escura. **Restore brand settings** pode trazer as configurações antigas de volta. **Change reference** escolhe outra origem.

::: details O que é lido de uma referência e o relatório de contexto de design
**Palette, source details and individual choices** mostra o que foi lido, os nomes de fontes encontrados e o contraste da prévia. Nomes de fontes são apenas sugestões; você instala uma fonte em Type. Os detalhes da origem podem incluir tipografia, intervalos, espaçamento interno e valores de cantos quando observados, com a indicação **Not observed** caso contrário. Uma página salva ou uma leitura nativa de site informa estilos declarados, que a página pode não usar. A extensão do navegador pode informar estilos medidos a partir de uma amostra de elementos visíveis. São observações: nada é instalado, e o espaçamento da origem nunca substitui o seu. **Choose individual items in the tray** guarda itens individuais. **Download design context** salva um relatório JSON de observações, tokens propostos e informações da origem (com um SHA-256 de qualquer HTML ou CSS fornecido). O relatório não contém o texto bruto da página e não é uma Content Credential assinada.
:::

Importações de PDF e arquivos de design mantêm seus próprios controles de revisão. Os itens na **Tray** não mudam nada até você adicioná-los na sala responsável por esse tipo de material. `#/start?source=<kind>` abre o seletor em uma origem (`file`, `pdf`, `image`, `font`, `url`, `page`), e `?import` abre a lista simples.

### Encontre e compare um visual

Abra **Find a look** pelo Board ou pela lista de sistemas de design em Settings. Explore sistemas salvos neste dispositivo e alguns exemplos reutilizáveis do Lolly, e busque por nome, etiqueta de cor ou fonte declarada. **Closest to my current palette** ordena pela semelhança de cores medida, com fontes correspondentes como desempate; não é uma nota de qualidade.

Clique em um visual para vê-lo no contexto; a prévia não muda nada. **Use this look** em um cartão aplica esse visual. Um sistema salvo se torna o ativo, o que não edita nada. As cores de um exemplo entram no sistema de design aberto após o ponto de restauração habitual. Os logos, as fontes e tudo mais que o exemplo não define no sistema ficam como estão. **Compare looks** adiciona uma caixa de seleção a cada cartão: escolha dois para comparar lado a lado. **Restore brand settings** recupera o visual anterior. Sistemas salvos têm **Search tags** editáveis em **Details and design context**. Os exemplos são receitas de cores originais do Lolly, sem coleção coletada de outros sites e sem conta.

![Lolly: compare Sunroom e Orchard lado a lado antes de aplicar qualquer um dos sistemas de cores.](/t/url-shot?url=%2F%23%2Fstart&width=1280&height=900&dpi=96&waitMs=3000&format=svg&filename=brand-compare-looks&try=1&drive=click%3A%5Bdata-ds-door%3D%22looks%22%5D%3Bwait%3A500%3Bclick%3A%5Bdata-looks-compare-toggle%5D%3Bclick%3A%5Bdata-look-select%3D%22example%3Asunroom%22%5D%3Bclick%3A%5Bdata-look-select%3D%22example%3Aorchard%22%5D%3Bclick%3A%5Bdata-looks-review%5D%3Bwait%3A500&cropSelector=.ds-looks-comparison&waitSelector=%5Bdata-ds-door%3D%22looks%22%5D&walker=1&rasterDpi=96)

<!--i:eti-package-->
## Guarde e mova seu sistema de design

### Mova uma marca entre dispositivos

**Export** grava um arquivo **`LollyBrand-….lolly`**: seus tokens, fontes, logos e preferência de tema, com um manifesto de integridade que é verificado na importação. Versões web anteriores à 1.0.7 nomeavam o arquivo como `.zip`, e o Lolly ainda aceita essa grafia. **Tokens (.json)** grava o documento simples de tokens de design, sem fontes nem logos, para um repositório, uma etapa de compilação ou outra ferramenta de tokens.

Para trazer um de volta, use **Add from… → Design tokens or a design file**, ou solte o arquivo no estúdio. É assim que um colega entrega uma marca a você ou que você a leva para uma segunda instalação, sem conta e sem nuvem. [Trabalhar com parceiros](/info/partners.html) cobre o que mais enviar quando a pessoa que recebe sua marca trabalha em outra organização. Para importar uma marca pela linha de comando, veja [`ingest:brand`](/info/configuration.html#brand-packs).

**Fonts for Linux (.rpm)** empacota as fontes que você adicionou em um RPM instalável. Se você mesmo enviou alguma delas, o Lolly pede primeiro que você confirme que pode redistribuí-las.

### Restaure configurações anteriores

Abra **More** na barra, escolha **Restore brand settings**, selecione um ponto de restauração datado e pressione **Restore**. Isso restaura cores, configurações de tipografia e outros tokens da marca ativa; arquivos de fontes e imagens ficam como estão. O Lolly salva primeiro suas configurações atuais como **Before restore**, para que você possa reverter uma restauração mesmo depois de fechar o navegador. Os últimos 20 pontos de restauração são mantidos neste dispositivo. Uma edição feita enquanto o estúdio diz **Saving…** sobrevive a um recarregamento, e um cartão oferece restaurar mudanças que não terminaram de ser salvas.

### Versões

Uma versão publicada é uma **cópia permanente e nomeada** mantida neste dispositivo. Ela nunca muda, então uma ferramenta ou um link que a fixa (com `designv`) continua desenhando a mesma coisa. Um sistema com algo seu lista **Versions & publishing** no menu **More** da barra; após sua primeira publicação, **Versions** se junta às salas. `#/start?area=versions` abre Versions.

::: warning Uma versão publicada é permanente
Ainda não há opção de excluir, e o painel diz isso. Publicar não pode ser desfeito; restaurar pode. *Restore latest from this version* é uma edição comum, com **Undo** oferecido na hora.
:::

**As remoções vêm primeiro no cartão de compatibilidade**, porque um token removido faz uma ferramenta parar de funcionar.

**Publish only** guarda uma versão sem mudar o que as ferramentas seguem; **Publish and make active** faz as ferramentas e o app seguirem essa versão. **Follow the latest again** coloca cada edição em uso na hora.

### Publique uma página de marca

Uma [página de marca](/info/brand-page.html) é um endereço para pessoas e agentes: uma página de logos, cores, tipografia e exemplos, com os mesmos fatos em arquivos ao lado. **Publish a brand page**, em Versions & publishing, mostra a página ao vivo e, ao lado dela:

- **Goes public**: todos os arquivos, agrupados, com seu tamanho.
- **Held back**: o que ficou de fora e por quê. Um logo sem licença registrada fica de fora até você marcar o nome do logo. Um arquivo de fonte precisa de uma licença registrada que permita repassá-lo, e a página mostra uma amostra convertida em contornos quando o arquivo fica de fora. Skills de marca internas nunca aparecem.
- **What was checked**: pares de cores por variação de cores e modo, e as regras da organização. São medições, não um veredito.
- **In your words**: uma declaração de uso e um contato. A página exibe o que você escreve e o Lolly não adiciona licença nem alegação jurídica. Um alternador desativa a linha "Made with Lolly" no rodapé.
- **On exports**: um alternador que [registra o endereço da página nas exportações deste sistema de design](/info/brand-page.html#lead-back-from-your-files). O alternador fica desativado até você ativá-lo, precisa de um endereço `https` e não acompanha um pacote nem uma cópia. Um sistema de design bloqueado não mostra o alternador, porque seu gestor decide.

**Download folder** salva a pasta como ZIP para você hospedar onde escolher. Nada se torna público até você hospedar a pasta. Em um terminal, `lolly system publish --out=<dir>` grava a mesma pasta. Uma instância que serve páginas de marca também oferece **Publish to** seu endereço: um clique explícito, pela cadeia de aprovação da instância quando ela tem uma. Um sistema de design gerenciado publica apenas quando seu gestor permite.

### Conecte um agente

**Connect an agent**, no mesmo lugar, fornece texto para colar e diz o que cada opção pode fazer:

- **`AGENTS.md`** em um projeto: os agentes leem os nomes e as regras do sistema. Ele não desenha nada e não precisa de servidor.
- **Servidor público do Lolly**: desenha com o Lolly Demo, qualquer que seja o sistema aberto aqui. Não precisa de chave.
- **Sua instância**: desenha com os sistemas que a instância contém e lê um token de serviço de uma variável de ambiente. O painel informa o nome da variável e nunca mostra um token.

Quando nenhum servidor hospedado desenha com seu sistema, o painel diz isso.

<!--i:eti-layers-->
## Gerencie seus sistemas de design

Abra **Settings → Preferences → Design systems** para alternar, adicionar ou remover sistemas. **Open** seleciona um sistema e o abre aqui; **Make a new one** cria um sistema local e o abre com o campo de nome pronto. Um sistema fica ativo por vez, para o dispositivo inteiro. [Arquiteturas de marca](/info/brand-architectures.html) ajuda a decidir quando uma marca precisa de um sistema de design próprio.

**De onde vem um sistema.** O sistema fornecido pelo catálogo de uma implantação mostra **Came with this app**, ou **From this instance** em um app conectado a uma instância. Expanda **Catalogue source** para ver quem o fornece, seu recurso de tokens e namespace e sua versão ou soma de verificação conhecida; se uma atualização falhar, o material em cache é identificado.

**Sistemas gerenciados são somente leitura.** Um sistema mostra **Managed by this instance** (ou **Managed by this app** no app de desktop sem instância) quando seu catálogo bloqueia o sistema. Você pode usar e baixar um sistema gerenciado. Abrir um aqui mostra um aviso de somente leitura com **Make an editable copy** e **Switch**, depois suas funções de cor e tokens sem controles de edição. Seus próprios sistemas locais continuam editáveis, mesmo quando o gerenciado veio primeiro. Uma compilação com uma marca fixa abre o Lolly Design System Setup em *This brand is set*, com os tokens e as regras de uso da marca para ler.

**Todos os outros sistemas fornecidos são seus** para ocultar, editar e redefinir, incluindo Lolly Demo e Lolly Starter em lolly.tools. Editar um mantém seu nome e marca a linha como **Edited here**. **Reset to original** no menu dele descarta as mudanças feitas neste dispositivo. O modelo inicial em branco é a exceção: uma primeira mudança ali inicia um sistema de design próprio, e o Lolly pergunta seu nome uma vez. [Lolly Demo em uso](/info/lolly-demo-in-use.html#switch-to-your-own) mostra o que seu próprio sistema substitui.

### Remover um sistema de design

Escolha **Remove** no menu de um sistema; a confirmação diz qual sistema ficará ativo depois. Sessões salvas, uploads e material compartilhado com outro sistema permanecem.

Remover um sistema fornecido apenas oculta o sistema: seus recursos de catálogo ficam, **Bring back** o mostra de novo e ele volta sozinho se você remover todo o resto. Remover uma cópia importada ou editada não remove o sistema fornecido, seus logos nem suas fontes. Se a cópia estava ativa, o sistema fornecido fica ativo de novo. Remover uma cópia hospedada ativa limpa apenas a conexão dessa cópia; uma instância escolhida separadamente continua selecionada.

::: details Mudar um sistema de design fornecido por um servidor
Mudar o que um servidor fornece é tarefa de administrador: seu operador muda o catálogo de origem e refaz a implantação, ou um administrador do Lolly Work revisa e aplica uma mudança no servidor. As edições aqui ficam locais, com uma exceção. Em uma instância do Lolly Work que concede a você `brand.edit`, um sistema gerenciado também oferece **Edit for** essa instância, que abre uma cópia para edição. **Send to** essa instância em **Versions** envia suas cores, variações de cores, funções de cor e endereço da página de marca de volta. [Edite esta instância pelo estúdio](/info/work-design-system-administration.html#edit-this-instance-from-the-studio) cobre o que uma edição pode mudar e como a instância disponibiliza a mudança. Veja [Remover um sistema de design do catálogo](/info/configuration.html#removing-a-catalogue-design-system) e [Configuração](/info/configuration.html#supplied-and-local-design-systems).
:::

<!--i:eti-code-->
## Use o contexto de design fora do app

**Download design context** salva o documento de tokens, cores resolvidas, famílias de fontes declaradas, ids de recursos, evidências de origem quando registradas, cobertura e regras explícitas, sem arquivos de fontes nem prova de propriedade. A linha de comando lê o arquivo sem servidor: `lolly system import` o torna o sistema de design do terminal e `lolly system check` verifica as entradas do Lolly Design contra o contexto salvo. [Traga seu sistema de design](/info/cli.html#bring-your-design-system) cobre a importação e [Qual sistema de design um comando usa](/info/cli-decks.html#which-design-system-a-command-uses) cobre a verificação. Um cliente MCP lê o mesmo brief de `lolly://design-context` ([Servidor MCP](/info/mcp.html)).

<!--i:eti-map-pin-->
## Para onde ir agora

- **[Usando o Lolly](/info/using.html)**: as ferramentas, salvar, compartilhar e Assets.
- **[Arquiteturas de marca](/info/brand-architectures.html)**: como divisões, produtos, marcas endossadas, clientes e temporadas se relacionam com sistemas de design, variações de cores e identidades de logo.
- **[Trabalhar com parceiros](/info/partners.html)**: compartilhar sua marca com um parceiro e trabalhar em uma marca que você recebeu.
- **[Páginas de marca](/info/brand-page.html)**: publique seu sistema de design em um endereço, como um kit de imprensa e um kit de agente.
- **[Tokens de design](/info/design-tokens.html)**: o modelo de tokens em que sua marca é escrita.
- **[Exportar um arquivo](/info/exporting.html)**: unidades de impressão, CMYK e os formatos em que sua marca é renderizada.
