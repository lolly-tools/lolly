# O Brand Studio

O **Brand Studio** em `#/start` é o único lugar onde você molda sua marca - seus logos, cores, tipografia, o restante dos seus tokens e os arquivos que ela mantém. Configure aqui uma vez e toda ferramenta, página e exportação segue *por construção*, não por revisão.

As mudanças aparecem em pré-visualização **ao vivo em todo o app** conforme você as faz, então você pode ver uma cor ou uma fonte se aplicar em tudo antes de confirmar. É tudo no dispositivo: seus arquivos de marca e tokens nunca saem da sua máquina (escolher uma Google Font busca aquela família específica do Google, uma vez, após um diálogo de consentimento), e a marca viaja em um único arquivo de [brand pack](#move-a-brand-between-devices).

> **Este é o editor. O dashboard é o espelho.** A aba **Design system** no Dashboard (`#/d`) *mostra* sua marca em modo só leitura; você *edita* aqui, em `#/start`. Se quiser mudar uma cor depois, volte ao Brand Studio.

## As salas

O studio é um conjunto de **salas** listadas num trilho lateral - não etapas. Nada é numerado, nada é condicionado a outra coisa e chegar a qualquer uma delas é legítimo:

- **Overview** - o núcleo. O que existe agora, num relance, com uma porta para cada sala.
- **Colours** - adicione cores uma de cada vez, atribua papéis ou gere uma paleta inteira a partir de uma.
- **Type** - as quatro fontes que o app, suas ferramentas e cada exportação leem.
- **Logos** - suas marcas, em toda orientação e tratamento.
- **Tokens** - raio de canto, espaçamento, sombras e o resto do sistema.
- **Files** - os arquivos de imagem, áudio e movimento que sua marca mantém.

Num celular, a mesma lista vira uma faixa horizontal de chips fixada sob o cabeçalho. Trocar de sala nunca recarrega nada - o editor mantém todos os seus painéis montados e simplesmente mostra o que você pediu.

**Faça deep-link de uma sala** com `#/start?area=<key>`. As chaves são `overview`, `color` *(note a grafia americana na URL)*, `type`, `logos`, `tokens`, `catalogue` (a sala Files - a chave do painel é um contrato permanente, então a URL mantém o nome antigo) e `versions`. `?tab=` é o alias de longa data para a mesma coisa e ainda funciona, então links e favoritos antigos continuam funcionando; qualquer coisa não reconhecida abre a Overview em vez de dar erro.

Fixas no **pé do trilho** ficam as ações que pertencem ao sistema de design inteiro, não a uma sala:

- **Add from…** - o seletor de origem, para trazer uma marca de um arquivo, um PDF, uma imagem, uma fonte ou um site. Veja [Bring a brand in](#bring-a-brand-in) abaixo.
- **Tray** - os candidatos que uma varredura encontrou mas ainda não confirmou. Fica oculta até uma varredura de fato reter algo, e mostra uma contagem quando isso acontece; nada nela muda sua marca até você apertar Add naquela linha.
- **Export** - grava a marca inteira como um único `LollyBrand-…zip`.
- **Tokens (.json)** - o documento simples de design tokens sozinho, para um repositório, um passo de build ou outra ferramenta de tokens.
- **Versions** - publique, ative e restaure cópias nomeadas do sistema de design. Oculta até haver algo seu para publicar (ou um link `?area=versions` pedir por ela pelo nome).

![O trilho de salas do studio - Overview, Colours, Type, Logos, Tokens e Files](/t/url-shot?url=%2F%23%2Fstart&width=1440&height=900&dpi=192&waitMs=1600&cropSelector=.ds-rail&format=svg&walker=1&localize=1&dark=1&filename=brand-studio&try=1)

## Overview

Overview é a sala em que você chega, e ela tem duas faces.

Com **nada configurado ainda**, ela oferece duas portas - **Start from a file** (design tokens, um projeto Penpot, um pacote de sistema de design ou um SVG) e **Start from scratch** (adicione uma cor e continue quando quiser) - e uma saída discreta **Explore the tools** abaixo delas, porque sair também é uma resposta legítima.

Uma vez que um sistema de design existe, a mesma sala mostra **o que você tem**: a paleta e sua contagem de cores, as famílias tipográficas em vigor, quantos slots de logo estão preenchidos, quantos tokens existem e a sala Files. Cada bloco é uma porta para sua sala. Há contagens aqui, nunca uma barra de progresso e nunca um cartão de conclusão - nada neste studio é devido.

## Logos

Comece esvaziando sua pasta de marcas na zona de soltura no topo: **"Drop marks here, or choose several at once"** aceita quantos arquivos você tiver de uma vez. Cada arquivo é lido quanto à forma e à tinta, e então enfileirado sob **Waiting for a slot** como um chip que diz o que pensa - *"Looks like the Horizontal primary"*, com a medida em que se baseou, e um botão **Place** (**Replace**, onde aquele slot já está preenchido). Onde não tem certeza, o chip diz isso claramente e oferece **Change slot** em vez disso, que lista os oito. Nada é colocado até você apertar algo.

Duas coisas acontecem ao redor dessa fila. Uma marca com margem vazia em excesso recebe uma **oferta de corte** primeiro - responda ou pressione Escape e o arquivo original entra sem alterações. E onde uma marca pode suprir um slot irmão vazio, a sala oferece a versão derivada **mono** ou **reverse** como seu próprio chip, marcado *Generated*, que desaparece de novo se você preencher aquele slot de outra forma.

Abaixo disso fica a grade em que toda marca acaba - slots de **orientação × tratamento**:

- **Orientations:** Horizontal (logotipo + símbolo em linha) e Vertical (empilhado, para espaços quadrados e altos).
- **Treatments:** Primary, Primary reverse (para fundos escuros), Mono (uma cor) e Mono reverse.

São oito slots opcionais. Clique num slot para adicionar um PNG, SVG, JPEG ou WebP; clique num slot preenchido para substituí-lo. Todo slot é opcional e tudo permanece neste dispositivo.

![A matriz de logos - cada orientação ao longo do topo, cada tratamento como seu próprio slot tracejado, todos opcionais](/t/url-shot?url=%2F%23%2Fstart%3Ftab%3Dlogos&width=1440&height=1600&dpi=192&waitMs=1600&cropSelector=.be-logo-grid&format=svg&walker=1&dark=1&filename=bs-logo-slots)

- **Custom marks** - adicione marcas que sua marca nomeia à própria maneira (um ícone, um brasão, um favicon) em **Custom marks**; dê um nome e escolha um arquivo.
- **More identities** - uma submarca, produto ou evento pode ter seu próprio conjunto completo de logos. Use **+ Add another logo** e dê um nome; seu conjunto principal é simplesmente "Your logo".
- **Upload an SVG and Lolly reads its colours.** Numa instalação nova em folha, ele define silenciosamente sua cor primária a partir do logo e avisa disso. Numa marca já existente, ele oferece a cor como sugestão - *"Found in the logo: #…"* com um botão **Use as primary** ao lado - lá na sala Colours, onde você pode aceitar ou dispensar.

## Colours

![The Colours room after one colour - the two panes back, the generate offer, roles reading in three registers and the pane at one colour](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dpick&width=1440&height=840&dpi=192&waitMs=1800&drive=click%3A%5Bdata-be-editor-add%5D%3Bwait%3A900&format=svg&walker=1&dark=1&filename=bs-colour-first)

A sala mais rica, em dois painéis. O da esquerda é onde você trabalha; o da direita é sua **paleta ao vivo**. Arraste o divisor entre eles para redimensionar (Enter nele recolhe a paleta para fora do caminho).

![A sala Colours - uma cor primária deriva rampas, cartões de espécime com razões de contraste e uma paleta ao vivo](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor&width=1440&height=740&dpi=192&waitMs=1800&format=svg&walker=1&localize=1&dark=1&filename=brand-colours)

### Adicione uma cor, depois dê a ela uma função

**Add a colour** é o todo do caminho simples: cole ou escolha uma cor em qualquer notação e ela vira exatamente um token. Nada é derivado dela, nada é sugerido a partir dela, nada mais é exigido. Cole uma *lista* inteira de cores e cada uma vira um chip que você pode adicionar por si só.

**Roles** é a camada por cima - qual cor exerce qual papel. Papéis são opcionais (um sistema de design com três cores soltas e nenhum papel é perfeitamente válido), qualquer amostra pode assumir um e a leitura de contraste é medida contra a superfície, APCA primeiro.

### As alas de especialista

Quatro seções recolhidas ficam abaixo dessas duas. Abra a que quiser; cada uma é deep-linkável como `#/start?area=color&focus=<wing>`:

- **Generate a starter palette** (`focus=generate`) - uma cor vira um conjunto completo de tons. Descrito abaixo.
- **Shade curves** (`focus=curves`) - remodele uma rampa ponto a ponto. Luminosidade, croma e matiz têm cada uma sua própria curva, alternadas com L / C / H, e os tons abaixo se recalculam ao vivo enquanto você arrasta.
- **Contrast** (`focus=contrast`) - **Contrast-lock** retonaliza uma rampa para atingir metas APCA contra um fundo que você escolhe, cada passo mantendo seu próprio matiz e croma; **Rotate hue** gira a rampa inteira ao redor da roda, cada tom mantendo sua luminosidade e croma.
- **Print** (`focus=print`) - o que a cor primária vira na impressão: seu valor de tela automático, ou uma composição CMYK fixa ou uma tinta spot nomeada.

### Uma cor, uma paleta inteira

Dentro de **Generate a starter palette**, escolha uma **Primary colour** e o Lolly calcula uma paleta completa - superfícies claras e escuras, texto, destaques e rampas completas de tinta/tom - usando a mesma matemática perceptual de cor (OKLCH) que o engine usa em todo lugar. Ajuste a derivação:

- **Scheme** - Mono, Complement, Analogous ou Triad - define como a cor secundária se relaciona com sua primária.
- **Shades** - um controle deslizante de 3 a 20 (padrão 5) controla quantos passos cada rampa gera.
- **Fine-tune** (recolhido) - **UI intensity** (Muted / Deep), **Contrast** (Comfort / High) e **Text on brand** (Auto / Light / Dark).

Nada nesta ala grava algo na sua marca. É uma pré-visualização, ao vivo em todo o app para você julgar, até você apertar **Replace palette** (abaixo).

Abaixo da primária você verá rampas ao vivo **Primary / Neutral / Secondary / Blend** e cartões de espécime Light e Dark, cada um trazendo sua própria leitura de contraste - a razão WCAG com o valor APCA `Lc` ao lado. **Clique num passo na rampa Neutral ou Secondary** para fixar aquele tom em vez do padrão derivado.

![As quatro rampas empilhadas acima de cartões de amostra claros e escuros, cada cartão trazendo sua própria taxa de contraste WCAG](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dgenerate%26seed%3D%2523e0452b&width=1440&height=1400&dpi=192&waitMs=1800&css=.start-head%7Bdisplay%3Anone%7D&cropSelector=.be-preview&format=svg&walker=1&dark=1&filename=bs-colour-ramps)

### Monte sua paleta (gerador de harmonia)

Ainda na mesma ala, **Monte sua paleta** gera cores de destaque combinando com sua cor primária. Escolha uma **Harmonia** - **Complementar**, **Adjacente**, **Tríade**, **Tétrade** ou **Análoga** (que traz sua própria contagem de **Destaques**, de 2 a 5, e um **Ângulo** de matiz de 10° a 45°) - e cada candidata chega com um nome legível gerado automaticamente e um botão **+ Adicionar**. Adicionar uma coloca essa cor na sua paleta imediatamente, um clique para um token. *"Sua paleta, aplicada"* mostra o conjunto inteiro em prévia sobre gráficos reais.

![Destaques gerados, cada um com uma amostra, um nome gerado automaticamente, seu hex e um botão Adicionar](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dgenerate%26seed%3D%2523e0452b&width=1440&height=900&dpi=192&waitMs=1800&css=.start-head%2C.be-colour%7Bdisplay%3Anone%7D&cropSelector=.be-candidates&walker=1&format=svg&dark=1&filename=bs-harmony-candidates)

### Confirmando uma paleta gerada

**Substituir paleta** é o único controle nesta ala que grava algo, e nunca grava de imediato. Pressione-o e um cartão de revisão se abre primeiro, com o título **"Substituir a paleta?"**, detalhando exatamente o que está prestes a acontecer: quantos papéis permanecem como você os atribuiu, quantas cores que você mesmo adicionou são mantidas, quantas curvas de tom são reancoradas, quantos travamentos de impressão são refixados, quantos tons ocultos permanecem ocultos, quantos pontos de gradiente mantêm sua cor.

**Substituir paleta** nesse cartão confirma a operação; **Cancelar** sai sem mudar nada. Depois que roda, o cartão vira **"Paleta substituída."** com um único **Desfazer** já em foco - e um checkpoint do sistema de design inteiro é criado *antes* da troca, então "voltar como estava" é uma restauração, não uma tarde perdida.

### A paleta, o gráfico e cada amostra

O painel direito lista todas as cores da sua marca, agrupadas (Primária, Neutra, Secundária, Espectro, Personalizada, Papéis), cada grupo dobrável com seu próprio **+ Adicionar**. Abaixo dele, **Gráfico de cores** se expande em duas visões das mesmas amostras: a **Roda** (a roda OKLCH - arraste um ponto para recolori-lo, clique num ponto para editá-lo ou clique num espaço vazio para soltar uma nova amostra) e o gráfico de **Gama**, que mostra onde a faixa exibível realmente termina. `#/start?area=color&focus=chart` abre o cartão diretamente, assim como `?wheel` sempre faz.

![O painel de paleta, cada grupo dobrável, com a pílula de download fixada na borda inferior](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dpick&width=1440&height=1000&dpi=192&waitMs=1800&drive=click%3A%5Bdata-be-editor-add%5D%3Bwait%3A500%3Bclick%3A%5Bdata-be-generate-cta-go%5D%3Bwait%3A900%3Bclick%3A%5Bdata-be-replace-palette%5D%3Bwait%3A800%3Bclick%3A%5Bdata-be-review-go%5D%3Bwait%3A1400&cropSelector=.be-split-side&walker=1&format=svg&dark=1&filename=bs-palette-pane)

![A roda OKLCH - o ângulo é o matiz, a distância do centro é a croma e os cinzas seguem um trilho de luminosidade na lateral](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dpick&width=1440&height=900&dpi=192&waitMs=2400&css=.start-head%2C.be-pal%2C.be-gradients%7Bdisplay%3Anone%7D&drive=click%3A%5Bdata-be-editor-add%5D%3Bwait%3A500%3Bclick%3A%5Bdata-be-generate-cta-go%5D%3Bwait%3A900%3Bclick%3A%5Bdata-be-replace-palette%5D%3Bwait%3A800%3Bclick%3A%5Bdata-be-review-go%5D%3Bwait%3A1400%3Bclick%3A%5Bdata-be-chart%5D%20summary%3Bwait%3A900&cropSelector=.be-pal-wheel&walker=1&format=svg&dark=1&filename=bs-colour-wheel)

Clique em qualquer amostra para abrir seu editor:

- **Renomeie** a amostra.
- **Defina a cor** - o seletor abre com controles deslizantes perceptuais **OKLCH**, com modos para **Hex**, **HSL**, **RGB** e **CMYK**; o campo de valor lê *e* grava no espaço ativo, então você pode colar um hex ou digitar porcentagens de tinta. Note que inserir CMYK define a cor de *tela* por conversão - para fixar tintas exatas, use o travamento de impressão abaixo.
- **Armazenado como** - escolha como a amostra é persistida: **LCH** (o padrão - perceptual, de gama ampla, a melhor escolha para edição), Hex, RGB ou HSL. Substitua quando precisar fixar um hex legado exato ou corresponder a um valor sRGB.
- **Usar como** - atribua esta amostra diretamente a um dos papéis de marca, sem voltar ao painel de Papéis. (O próprio bloco de um papel não oferece isso - um papel não pode assumir outro papel.)
- **Substitutos de impressão** (dobrado) - trave o comportamento de impressão da cor:
  - **CMYK** - mude de **Automático** para **Travado** para substituir a conversão automática sRGB→CMYK por valores exatos de tinta (C/M/Y/K, 0-100).
  - **Cor spot** - mude de **Nenhuma** para **Definida** para travar a amostra a uma cor spot; dê um **Nome** (ex.: `PANTONE 186 C`), um **Catálogo** opcional e um **Acabamento** opcional (Tinta comum por padrão) para quando a tinta não é tinta nenhuma - um foil, um relevo ou baixo-relevo, um verniz spot, um soft touch ou um corte, vinco ou perfuração.
- **Em outros espaços** (dobrado) - a mesma ideia ampliada: cada linha é um espaço em que esta amostra pode ser expressa, derivado do valor canônico ou definido por você, e um valor definido por você prevalece na exportação.

Esses travamentos de impressão são o que uma gráfica usa quando você exporta um PDF ou TIFF em CMYK - veja [Exportação](/info/exporting.html#colour-profiles).

**Excluir uma amostra** é seguro: passos de rampa derivados e papéis de tema ficam *ocultos* (o token subjacente continua resolvendo, então nada a jusante quebra), enquanto cores que você mesmo adicionou são removidas de vez.

### Gradientes

Um painel opcional de **Gradientes** cria tokens de mescla a partir da sua paleta para fundos e destaques. Pule por completo se sua marca não usa gradientes. Cada gradiente tem uma prévia, pontos nomeados (2-8) e um ângulo. O comportamento chave: **um ponto referencia uma amostra**, então recolorir essa amostra faz o gradiente acompanhar. A interpolação roda em OKLCH para mesclas limpas. Exclua um ponto para encurtar a sequência.

### Leve a paleta para outros lugares

A pílula flutuante fixada na borda inferior do painel de paleta baixa a paleta inteira como **Tokens de design (JSON)**, **Variáveis CSS**, **Classes CSS**, **Variáveis SCSS**, uma **Paleta GIMP (.gpl)** ou um **Adobe Swatch Exchange (.ase)** - assim a marca entra direto no Illustrator, Figma, GIMP ou numa folha de estilos. Ela fica fora do scroller do painel, então mantém seu lugar não importa até onde a paleta role. (Você também pode baixar a paleta na visão [Catálogo](/info/using.html).)

## Tipografia

![The compare stage open under its card, with the search row, the pinned families and the cards folded to a one-line strip](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dtype%26focus%3Dstage&width=1440&height=740&dpi=192&waitMs=1800&format=svg&walker=1&dark=1&filename=bs-type-stage)

A sala começa com **quatro cartões de papel** - as quatro fontes que o app, suas ferramentas e toda exportação de fato leem. Cada cartão mostra o que atende esse papel agora, definido nessa fonte, com uma linha de texto real embaixo:

- **Primária** - texto do corpo, botões e todas as ferramentas.
- **Títulos** - a fonte de destaque para `h1`/`h2`.
- **Código** - uma fonte monoespaçada para código e dados.
- **Itálico** - um companheiro itálico verdadeiro para ênfase, citações e observações.

Títulos, código e itálico caem de volta na primária até você atribuí-los, então uma marca de fonte única não exige nenhuma decisão aqui. Nada num cartão grava algo: **Trocar** (ou **Escolher uma fonte** num papel vazio) abre o **palco de comparação** restrito a esse papel.

![A sala Tipografia - os cartões de papel e uma amostra ao vivo de cada fonte em ação](/t/url-shot?url=%2F%23%2Fstart%3Ftab%3Dtype&width=1440&height=740&dpi=192&waitMs=1800&format=svg&walker=1&dark=1&filename=brand-type)

### O palco de comparação

O palco abre **dentro da própria sala**, não numa caixa de diálogo, então os cartões de onde você veio permanecem na tela. Pesquise uma família do Google Fonts (Inter, Fraunces, Space Grotesk...) ou solte um arquivo de fonte, pressione **Adicionar à comparação** e as candidatas ficam lado a lado nas mesmas palavras antes de qualquer uma delas ser instalada. Esc cancela e devolve o teclado ao cartão de onde você abriu.

Essa é a única porta de entrada, e é por isso que nada entra na sua marca sem ser visto. Abaixo do palco ficam os dois painéis de gerenciamento:

- **Fontes neste dispositivo** - toda família instalada, os papéis que ela atende e uma opção de excluir. **Adicionar uma fonte** aqui abre o mesmo palco de comparação sem restrição.
- **Suas fontes** - envie um **TTF**, **OTF** ou **WOFF** da sua própria máquina. Esse é o caminho para uma tipografia corporativa licenciada que você já possui.

De qualquer forma a fonte permanece neste dispositivo, é renderizada no app, nas suas ferramentas e em toda exportação, offline para sempre, e viaja no seu pacote de marca - nada é buscado no momento da renderização. Tudo no Google Fonts é distribuído sob uma licença aberta (OFL/Apache/UFL).

O painel **Papéis de tipografia** no rodapé mostra uma amostra ao vivo de cada papel - corpo e interface na primária, uma fonte de destaque opcional para os títulos principais, um itálico para ênfase, uma monoespaçada para código e dados - assim você vê o conjunto inteiro funcionando junto.

![A amostra de Papéis de tipografia - título, corpo, itálico e código, cada um na fonte para a qual esse papel resolve, com o nome da fonte ao lado](/t/url-shot?url=%2F%23%2Fstart%3Ftab%3Dtype&width=1440&height=1000&dpi=192&waitMs=2600&drive=click%3A%5Bdata-be-typemore-toggle%5D%3Bwait%3A600&cropSelector=.be-typecard-grid&walker=1&format=svg&dark=1&filename=bs-type-specimen)

## Tokens

O restante do sistema de design, editável sem tocar em código:

![A sala Tokens - um controle deslizante de raio de canto mais espaçamento, dimensionamento, sombras e o resto do sistema](/t/url-shot?url=%2F%23%2Fstart%3Ftab%3Dtokens&width=1440&height=740&dpi=192&waitMs=1600&format=svg&walker=1&dark=1&filename=brand-tokens)

- **Cantos arredondados** - um único controle deslizante de raio (0-1,5rem) que cartões, botões e painéis no app inteiro seguem.
- **Mais tokens** - adicione e edite **espaçamento**, **dimensionamento**, **espessura de traço**, **opacidade**, **rotação**, **números** simples e **sombras**. Escolha um tipo, dê um nome (*Espaçamento, Sombra do cartão...*) e defina seu valor. Eles são armazenados como [tokens de design](/info/design-tokens.html) padrão (DTCG) e viajam com sua marca.

## Arquivos

Solte aqui os arquivos que sua marca guarda - além dos logotipos: recursos **vetoriais**, de **imagem**, de **áudio** e de **movimento** (vídeo, Lottie, animado). Eles chegam ao seu [Catálogo](/info/using.html), organizados em seções e prontos no seletor de recursos de cada ferramenta. Tudo permanece neste dispositivo. (O trilho rotula a sala como **Arquivos**; a chave de URL permanece `catalogue`, porque a chave de um painel é um contrato permanente.)

## Trazer uma marca

**Adicionar de...** no rodapé do trilho abre um seletor de dois estágios. O primeiro estágio pergunta o que você *tem*, não em que formato está:

- **Tokens de design ou um arquivo de design** - JSON do DTCG ou Tokens Studio, um projeto Penpot, um **zip de conjuntos de tokens**, um pacote de sistema de design Lolly ou um SVG.
- **PDF** - uma apresentação ou um arquivo de diretrizes, lido neste dispositivo em busca de suas cores, suas marcas e suas fontes incorporadas.
- **Imagem** - uma captura de tela ou uma foto; suas cores são lidas neste dispositivo e nada é enviado.
- **Arquivo de fonte** - TTF, OTF ou WOFF. Abre a sala Tipografia, onde a fonte é instalada.
- **Site** - uma página, lida por suas cores e tipografia. Este bloco só aparece num dispositivo que realmente consegue ler uma página, porque um bloco desativado anunciando algo que ninguém pode pressionar é pior do que nenhum bloco. Onde aparece, ele nomeia claramente seu leitor: buscado pelo app neste dispositivo, ou lido pela extensão do navegador numa aba em segundo plano, conectado como você. Informar uma URL apenas *preenche* o campo antecipadamente - o botão de busca é o consentimento, então um link que alguém te manda nunca pode iniciar uma leitura sozinho.

Escolha a fonte de arquivo de design e o segundo estágio é o cartão abaixo: os formatos aceitos aparecem como blocos de ícone em ordem de preferência, e o cartão inteiro é um único alvo de arrastar-e-soltar - clique em qualquer lugar dele ou arraste um arquivo até ele. Você também pode soltar um arquivo direto no estúdio.

![O cartão de importação - os formatos aceitos aparecem como blocos de ícone, e o cartão inteiro é um único alvo de arrastar-e-soltar](/t/url-shot?url=%2F%23%2Fstart%3Fsource%3Dfile&width=1440&height=900&dpi=192&waitMs=1600&css=.start-import-modal%20.modal-msg%2C.start-import-modal%20.modal-title%7Bdisplay%3Anone%7D&cropSelector=.start-import-drop&walker=1&format=svg&dark=1&filename=bs-brand-import-formats)

O que cada arquivo de design te dá:

- um pacote **LollyBrand** (`.zip`) - instala em uma etapa;
- uma exportação **Penpot** (`.penpot`) - traz seus tokens de design;
- um arquivo de **Tokens de design** (`.json`) - W3C DTCG;
- um arquivo **Tokens Studio** (`.json`) - Tokens Studio;
- um **SVG simples** (`.svg`) - o Lolly examina suas cores e deixa você escolher quais manter, a primeira se tornando sua primária.

Uma instalação a partir de origem cria um **checkpoint primeiro**, então "voltar a antes da importação" é uma única restauração. E o que uma varredura encontra não entra direto: os candidatos chegam à **Bandeja**, onde cada um é adicionado por um clique próprio, pela sala responsável por aquele tipo de material.

`#/start?source=<kind>` abre o seletor numa origem específica (`file`, `pdf`, `image`, `font`, `url`), e `?import` o abre na lista simples.

## Mover uma marca entre dispositivos

**Exportar** no rodapé do trilho grava um único **`LollyBrand-…zip`** - seus tokens, fontes, logotipos e preferência de tema, com um manifesto de integridade que ele verifica ao ser importado de volta. Ao lado, **Tokens (.json)** grava o documento de tokens de design puro, sozinho: sem fontes, sem logotipos, só os tokens, que é o que um repositório, uma etapa de CI ou outra ferramenta de tokens de fato lê.

Trazer um de volta é **Adicionar de... → Tokens de design ou um arquivo de design** (acima), ou arrastar e soltar no estúdio. É assim que um colega te passa uma marca, ou como você a leva para uma segunda instalação - sem conta, sem nuvem. Para trazer uma marca pela linha de comando, veja [`ingest:brand`](/info/configuration.html#brand-packs).

## Versões

**Versões**, no rodapé do painel lateral, é onde um sistema de design deixa de ser um alvo móvel. Publique uma e você obtém uma **cópia permanente e nomeada** guardada neste dispositivo: ela nunca muda depois disso, então uma ferramenta que a fixa continua desenhando a mesma coisa. O painel fica oculto até que haja algo seu para publicar, então um estúdio que nunca publica nunca vê os controles.

Três coisas para saber antes de pressionar qualquer coisa, e o painel diz as três antes do clique, não depois:

- **Uma versão é permanente.** Ainda não há exclusão, então o painel declara o que foi mantido e que continua mantido, em vez de oferecer um botão que mente.
- **As remoções lideram o cartão de compatibilidade.** Tokens adicionados e alterados são notícia; um token *removido* é o que quebra uma ferramenta, então ele é citado primeiro e chamado pelo que é.
- **Publicar não pode ser desfeito; restaurar pode.** *Restore latest from this version* é uma edição comum à ponta (head), então ela entra na pilha de desfazer do estúdio e o painel oferece o **Undo** imediatamente.

Você pode **Publish only** ou **Publish and make active** - a diferença é se as ferramentas e o aplicativo passam a seguir essa versão dali em diante ou continuam seguindo sua edição mais recente. **Follow the latest again** coloca cada edição no ar assim que é feita. `#/start?area=versions` abre o painel diretamente.

## Quando a marca é fixa

Algumas builds vêm com uma **marca bloqueada** - suas cores, fontes e tokens são o que toda ferramenta e exportação usam, e não há nada para mudar. Nesse caso, o estúdio é substituído por uma nota breve explicando que essa build vem com uma marca fixa e a edição está desativada. Isso é deliberado: é assim que uma organização garante que tudo permaneça dentro da marca.

## Para onde ir agora

- **[Usando o Lolly](/info/using.html)** - a tela, o salvamento, os projetos e o catálogo.
- **[Tokens de Design](/info/design-tokens.html)** - o modelo de tokens em que sua marca é expressa.
- **[Exportação e formatos](/info/exporting.html)** - unidades de impressão, CMYK e os formatos em que sua marca é renderizada.
