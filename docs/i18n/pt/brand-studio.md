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
- **Export** - grava o sistema de design inteiro como um único `LollyBrand-….lolly`.
- **Tokens (.json)** - o documento simples de design tokens sozinho, para um repositório, um passo de build ou outra ferramenta de tokens.
- **Restore brand settings** - volte a um checkpoint salvo antes de uma importação ou substituição das configurações de marca.
- **Versions** - publique, ative e restaure cópias nomeadas do sistema de design. Oculta até haver algo seu para publicar (ou um link `?area=versions` pedir por ela pelo nome).

![O trilho de salas do studio - Overview, Colours, Type, Logos, Tokens e Files](/t/url-shot?url=%2F%23%2Fstart&width=1440&height=900&dpi=192&waitMs=1600&cropSelector=.ds-rail&waitSelector=.ds-rail&format=svg&walker=1&localize=1&dark=1&filename=brand-studio&try=1)

## Overview

Overview é a primeira sala, e ela tem duas faces.

Com **nada escolhido ainda** ela diz **Make it yours**. **Start from a reference** abre o seletor de origem para um logo, uma captura de tela, uma página web ou um arquivo de design. **Pick a colour**, **Choose a face** e **Add a logo** abrem diretamente seus controles já existentes. Cada caminho começa com uma escolha; abrir um deles não grava nada. **Explore the tools** está disponível imediatamente.

Assim que algo é seu, a mesma sala mostra **o que você tem**, com as contagens que você fez à frente. Colours lê o número de cores que o sistema de design carrega, e acrescenta um `· N starter` discreto só onde há cores herdadas à mostra; a faixa ao lado coloca primeiro as cores que você escolheu, depois um traço fino e as cores starter esmaecidas. Type lê por papel (*Inter para títulos*, com *Starter para o resto · SUSE, SUSE Mono* embaixo). Logos lê quantos slots estão preenchidos, ou **Not set**. Tokens carrega o raio de canto, marcado como *starter* até você movê-lo. Files diz **Nothing yet** enquanto a biblioteca está vazia. Cada bloco é uma porta para sua sala. Há contagens aqui, nunca uma barra de progresso e nunca um cartão de conclusão - nada neste studio é devido.

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

A sala cresce junto com o sistema de design. Nada que você ainda não precisou fica na página, então uma primeira visita é uma única decisão, e o resto chega conforme a paleta cresce.

### A primeira cor

Um sistema de design sem cores próprias abre em uma única coluna centralizada: **Start with one colour**, um grande chip ao vivo, um campo, e uma linha discreta dizendo que papéis, tons e configurações de impressão chegam conforme o sistema cresce.

- **The chip is the picker.** Pressione-o e o próprio cartão OKLCH do studio se abre sobre o chip, semeado com o que o campo estiver guardando: um nome, a roda, os quatro controles, alfa e **Stored as**, com **Cancel** e **Add colour** no rodapé. Arrastar um controle pinta o chip e reescreve o campo em tempo real, e nada chega ao sistema de design até você pressionar **Add colour**.
- **The field takes any notation** - `#e0452b`, `rgb(224 69 43)`, `oklch(58% .19 32)` ou um nome de cor simples - e uma *lista* inteira de cores vira uma fileira de chips que você adiciona um de cada vez.
- **Two more doors sit beside it.** O conta-gotas (num navegador que tem um) captura uma cor da tela, e **From an image** lê uma captura de tela ou uma foto neste dispositivo e oferece as cores que encontra.
- **Add is never disabled.** Sem nada legível no campo, ele abre o seletor, que é o que um pressionar vazio geralmente significa; um texto que ele não consegue interpretar recebe uma linha embaixo do campo avisando isso, em vez de um botão morto.

A primeira cor se torna a **primária**, e o chip que responde à adição diz isso - *"Primary is now Vivid Violet"* - com **Fine-tune** ao lado.

![A sala Colours sem nada escolhido ainda - um grande chip ao vivo, um campo e uma linha sobre o que chega depois](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor&width=1440&height=740&dpi=192&waitMs=1800&format=svg&walker=1&localize=1&dark=1&filename=brand-colours)

### Starter

**Starter** é a palavra para qualquer coisa que veio com o app em vez de ter sido escolhida. Uma instalação nova não carrega nenhuma cor: o que ela tem é uma única rampa neutra, tinta sobre papel, para que superfícies, texto e traços finos se renderizem antes de alguém ter decidido qualquer coisa. Esses neutros são andaime, então não são contados como cores e não são desenhados no painel de paleta. Eles vivem na sala [Tokens](#tokens) como **Neutrals · starter · 9**, com um **Open** que os mostra no painel Colours como um grupo dobrado e marcado (`#/start?area=color&group=neutral`).

A mesma palavra atravessa todas as salas: um papel apoiado numa cor starter lê *"Starter Paper stands in"* e seu seletor oferece **Choose…**; uma fonte starter usa uma tag **Starter** e nenhum tingimento; um raio de canto starter é marcado na Overview. Material herdado nunca é desenhado com borda tracejada, porque uma borda tracejada aqui significa um alvo de soltura.

### Conforme a paleta cresce

Suas cores ficam ao lado de uma prévia **In context** numa tela larga e se empilham acima dela em telas menores. A prévia pode mostrar um pôster, um gráfico ou um cartão de interface usando sua paleta. Cores starter ficam em seu próprio grupo dobrável, separado das cores que você adiciona.

Adicione cores individuais ou um conjunto de tons, atribua seus papéis, e abra as seções avançadas quando precisar delas. O gráfico de cores, os gradientes e os controles de download ficam junto com a paleta.

![A sala Colours depois de adicionar uma cor, com sua paleta e uma prévia de composição ao vivo](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dpick&width=1440&height=840&dpi=192&waitMs=1800&drive=click%3A%5Bdata-be-editor-add%5D%3Bwait%3A900&format=svg&walker=1&dark=1&filename=bs-colour-first)

### Roles - o que as ferramentas leem

**Roles** é a camada por cima - qual cor exerce qual papel. Papéis são opcionais (um sistema de design com três cores soltas e nenhum papel é perfeitamente válido), qualquer amostra pode assumir um e a leitura de contraste é medida contra a superfície, APCA primeiro.

Uma linha se lê em um de três registros, para que a faixa nunca alegue uma decisão que ninguém tomou:

- uma cor própria servindo o papel, em força total;
- **Starter *Paper* stands in** - discreta, com **Choose…** em seu seletor;
- **↳ segue a Primária** - o papel resolve pela primária, em vez de por uma cor própria.

Assim que a paleta tem tons, a faixa cresce para todos os sete slots que uma ferramenta pode ler: Primary, Secondary, Surface, Text, Muted, Edge e On primary. On primary é derivada da primária, aparece como **Derived** e não tem seletor.

**O destaque do próprio app é uma preferência, não um token.** Por padrão a interface segue o sistema de design e o destaque do chrome usa a cor primária. Essa é uma configuração de Aparência no [seu perfil](/info/profile.html) - **A interface segue o sistema de design** - e desativá-la deixa o chrome neutro. Ferramentas, telas e exportações não são afetadas de nenhuma forma, e as fontes e o raio de canto seguem o sistema de design esteja a configuração ativada ou não.

### As alas de especialista

Quatro seções recolhidas ficam abaixo da prévia de composição e dos papéis de cor. Abra a que quiser; cada uma é deep-linkável como `#/start?area=color&focus=<wing>`, que a abre não importa o que a sala esteja mostrando.

- **Explore shades & harmonies** (`focus=generate`) - uma cor vira um conjunto completo de tons. Descrito abaixo.
- **Shade curves** (`focus=curves`) - remodele uma rampa ponto a ponto. Luminosidade, croma e matiz têm cada uma sua própria curva, alternadas com L / C / H, e os tons abaixo se recalculam ao vivo enquanto você arrasta.
- **Contrast** (`focus=contrast`) - **Contrast-lock** retonaliza uma rampa para atingir metas APCA contra um fundo que você escolhe, cada passo mantendo seu próprio matiz e croma; **Rotate hue** gira a rampa inteira ao redor da roda, cada tom mantendo sua luminosidade e croma.
- **Print** (`focus=print`) - o que a cor primária vira na impressão: seu valor de tela automático, ou uma composição CMYK fixa ou uma tinta spot nomeada.

### Uma cor, uma paleta inteira

Dentro de **Explore shades & harmonies**, escolha uma **Starting colour**. O Lolly sugere tons combinando usando a mesma matemática perceptual de cor (OKLCH) que o engine usa em todo lugar. Ajuste as sugestões:

- **Scheme** - Mono, Complement, Analogous ou Triad - define como a cor secundária se relaciona com a primária.
- **Shades** - um controle deslizante de 3 a 20 (padrão 5) controla quantos passos cada rampa gera.
- **Fine-tune** (recolhido) - **UI intensity** (Muted / Deep), **Contrast** (Comfort / High) e **Text on brand** (Auto / Light / Dark).

Mudar a cor inicial e os controles só muda as sugestões. Clique num tom para adicionar aquela cor, ou **Add 5 shades** para adicionar um grupo (a contagem segue sua configuração de Shades). Cores e papéis existentes ficam no lugar. Undo remove a adição.

As linhas **Primary**, **Neutral** e **Secondary** mostram os tons sugeridos. Abra **Theme preview** para inspecionar exemplos claros e escuros e suas leituras de contraste. Escolha um passo de Neutral ou Secondary ali para ajustar as âncoras de tema propostas. Reconstruir a paleta inteira continua sendo uma ação separada e revisada, abaixo.

![Três grupos de tons sugeridos, com controles de adição individuais e um Theme preview separado](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dgenerate%26seed%3D%2523e0452b&width=1440&height=1400&dpi=192&waitMs=1800&css=.start-head%7Bdisplay%3Anone%7D&cropSelector=.be-preview&format=svg&walker=1&dark=1&filename=bs-colour-ramps)

### Monte a paleta (gerador de harmonia)

Em **Find matching colours**, o gerador de harmonia sugere cores de destaque combinando com a primária. Escolha uma **Harmony** - **Complementary**, **Adjacent**, **Triad**, **Tetrad** ou **Analogous** (que traz sua própria contagem de **Accents**, de 2 a 5, e um **Angle** de matiz de 10° a 45°) - e cada candidata chega com um nome legível gerado automaticamente e um botão **+ Add**. Adicionar uma coloca essa cor na paleta imediatamente, um clique para um token. **In context** mostra em prévia as cores que você adicionou sobre composições de exemplo.

![Destaques gerados, cada um com uma amostra, um nome gerado automaticamente, seu hex e um botão Adicionar](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dgenerate%26seed%3D%2523e0452b&width=1440&height=900&dpi=192&waitMs=1800&css=.start-head%2C.be-colour%7Bdisplay%3Anone%7D&drive=click%3A.be-generate-detail%3Anot%28%5Bdata-be-rebuild%5D%29%20%3E%20summary%3Bwait%3A500&cropSelector=.be-candidates&walker=1&format=svg&dark=1&filename=bs-harmony-candidates)

### Confirmando uma paleta gerada

Adicionar uma cor ou grupo de tons sugerido mantém o resto da sua paleta. Para uma substituição completa, abra **Rebuild the whole palette…** e pressione **Preview full rebuild**. A revisão explica as mudanças: quantos papéis permanecem como você os atribuiu, quantas cores que você mesmo adicionou são mantidas, quantas curvas de tom são reancoradas, quantos travamentos de impressão são refixados, quantos tons ocultos permanecem ocultos, quantos pontos de gradiente mantêm sua cor.

**Apply rebuilt palette** nesse cartão confirma a operação; **Cancel** sai sem mudar nada. Depois que roda, o cartão oferece **Undo** já em foco - e um checkpoint do sistema de design inteiro é criado *antes* da troca, então "voltar como estava" é uma restauração, não uma tarde perdida.

### A paleta, o gráfico e cada amostra

A paleta lista as cores do sistema de design em grupos dobráveis, cada um com seu próprio controle **+ Add**. Crie e renomeie grupos para organizar seu trabalho. Um papel nunca cria um segundo tile: um token é um tile, e um tile que um papel aponta usa uma pequena marca de canto em vez disso (**P**, **S**, **Su**, **T**). Abaixo dos tiles, **Colour chart** se abre em duas visões das mesmas amostras: a **Wheel** (a roda OKLCH - arraste um ponto para recolori-lo, clique num ponto para editá-lo ou clique num espaço vazio para soltar uma nova amostra) e o gráfico **Gamut**, que mostra onde a faixa exibível realmente termina. `#/start?area=color&focus=chart` abre o cartão diretamente, assim como `?wheel` sempre fez.

![O painel de paleta, cada grupo dobrável, com a pílula de download fixada na borda inferior](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dgenerate%26seed%3D%2523e0452b&width=1440&height=1000&dpi=192&waitMs=1800&drive=click%3A%5Bdata-be-add-ramp%3D%22primary%22%5D%3Bwait%3A1200&cropSelector=.be-split-side&walker=1&format=svg&dark=1&filename=bs-palette-pane)

![A roda OKLCH - o ângulo é o matiz, a distância do centro é a croma e os cinzas seguem um trilho de luminosidade na lateral](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dgenerate%26seed%3D%2523e0452b&width=1440&height=900&dpi=192&waitMs=2400&css=.start-head%2C.be-pal%2C.be-gradients%7Bdisplay%3Anone%7D&drive=click%3A%5Bdata-be-add-ramp%3D%22primary%22%5D%3Bwait%3A1200%3Bclick%3A%5Bdata-be-chart%5D%20summary%3Bwait%3A900&cropSelector=.be-pal-wheel&walker=1&format=svg&dark=1&filename=bs-colour-wheel)

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

### Trabalhando com muitas amostras

Cada amostra tem sua própria alça de arrasto. Arraste-a para reordenar cores dentro do grupo, ou dê foco a ela, pressione Espaço, use as setas, e pressione Espaço de novo para soltar. Escape cancela. A ordem sobrevive a reabrir o studio e pode ser desfeita. Para mover cores entre grupos, use o controle **Group** do editor de amostra ou selecione várias cores e use **Move**. Nomes de token e referências de papel continuam intactos.

Seleção no painel de paleta é um gesto, não um modo. Não há botão para pressionar primeiro, e a barra chega com o primeiro tile selecionado e sai com o último.

- **Drag on the pane's empty space** para desenhar um retângulo: todo tile que ele toca entra na seleção, atravessando os limites dos grupos. Uma seção dobrada não contribui com nada, e um arrasto que nunca se move limpa a seleção.
- **Shift-click** pega o intervalo na ordem de leitura; **Cmd/Ctrl-click** alterna um tile; um clique simples ainda abre o editor daquele tile.
- Todo cabeçalho de grupo tem **Select all**, e **Cmd-A** com um tile em foco pega toda cor que o sistema de design possui - nunca uma starter.
- A grade tem uma única parada de tab. As setas a percorrem, Shift-setas estendem a seleção, Espaço alterna um tile, Delete remove a seleção e Escape a limpa. (As setas só movem o foco: para ajustar um canal, pressione `l`, `c` ou `h` primeiro, como a leitura indica.)
- Numa tela sensível ao toque não há retângulo. Pressione e segure um tile para começar uma seleção, depois toque para adicionar; o **Select all** de cada grupo carrega o resto.

A própria barra mostra **{n} selected**, depois **Move to** (um grupo existente, ou um novo que você nomeia dentro do menu), **Give a role** (cada cor selecionada assume o próximo papel na sequência, então quatro tiles preenchem os quatro papéis em um só clique), **Download** (a seleção em qualquer um dos seis formatos de paleta), **Copy values** (uma linha por cor, na sua notação armazenada) e **Delete**. Move to e Give a role aparecem assim que a paleta tem tons para mover. Um único Ctrl/Cmd-Z desfaz uma ação em lote inteira - um movimento de quarenta, uma volta de papéis, uma exclusão - e uma exclusão diz o que manteve, porque uma seleção alcança tiles que esta sala não remove.

### Gradientes

Um painel opcional de **Gradients** cria tokens de mescla a partir da paleta para fundos e destaques. Pule por completo se o sistema de design não usa gradientes. Cada gradiente tem uma prévia, pontos nomeados (2-8) e um ângulo. O comportamento chave: **um ponto referencia uma amostra**, então recolorir essa amostra faz o gradiente acompanhar. A interpolação roda em OKLCH para mesclas limpas. Exclua um ponto para encurtar a sequência.

### Leve a paleta para outros lugares

A pílula flutuante fixada na borda inferior do painel de paleta baixa a paleta inteira como **Design tokens (JSON)**, **CSS variables**, **CSS classes**, **SCSS variables**, uma **GIMP palette (.gpl)** ou um **Adobe Swatch Exchange (.ase)** - assim o sistema de design entra direto no Illustrator, Figma, GIMP ou numa folha de estilos. Ela fica fora do scroller do painel, então mantém seu lugar não importa até onde a paleta role, e aparece assim que a paleta tem tons. (Você também pode baixar a paleta em [Ativos](/info/using.html#assets-your-library).)

## Tipografia

Esta sala cresce da mesma forma. Sem fonte própria, ela é um único cartão e uma única decisão: **Primary**, definido em tamanho de leitura na fonte que o atende hoje, uma tag **Starter** ao lado do nome, um **Choose a face** preenchido e a linha "Nothing installs until you choose one." Sob o cartão fica "Headings, code and italic follow the primary until you choose them", com **Choose them separately** revelando os outros três cartões pelo resto da visita.

![A sala Type sem fonte escolhida ainda - um cartão em tamanho de leitura, uma tag Starter nele, e um Choose a face preenchido](/t/url-shot?url=%2F%23%2Fstart%3Ftab%3Dtype&width=1440&height=740&dpi=192&waitMs=1800&format=svg&walker=1&dark=1&filename=brand-type)

Escolha uma fonte e a sala se abre em **quatro cartões de papel**, a lista Fonts e o espécime ao vivo. As quatro fontes são as que o app, as ferramentas e cada exportação de fato leem:

- **Primária** - texto do corpo, botões e todas as ferramentas.
- **Títulos** - a fonte de destaque para `h1`/`h2`.
- **Código** - uma fonte monoespaçada para código e dados.
- **Itálico** - um companheiro itálico verdadeiro para ênfase, citações e observações.

Títulos, código e itálico caem cada um de volta na primária até você atribuí-los, então um sistema de design de fonte única não exige nenhuma decisão aqui.

**Um tingimento significa que você a escolheu.** Um cartão só é tingido onde você instalou aquela fonte. Uma fonte starter usa a mesma tag **Starter** que os grupos herdados da paleta usam, no registro discreto e sem tingimento, e um papel que ninguém escolheu lê **↳ segue a Primária** em vez de repetir o nome da primária como se ela tivesse sido escolhida. O botão diz **Change** numa fonte própria e **Choose a face** em todo o resto. Nada num cartão grava algo: o botão abre o **palco de comparação** restrito a esse papel.

![Os quatro cartões de papel revelados - cada um na fonte que o atende, com uma tag Starter onde ninguém escolheu uma e Italic seguindo a primária](/t/url-shot?url=%2F%23%2Fstart%3Ftab%3Dtype&width=1440&height=1000&dpi=192&waitMs=2600&drive=click%3A%5Bdata-be-typemore-toggle%5D%3Bwait%3A600&cropSelector=.be-typecard-grid&walker=1&format=svg&dark=1&filename=bs-type-specimen)

### O palco de comparação

![O palco de comparação aberto sob seu cartão, com a linha de busca, as famílias fixadas e os cartões dobrados numa faixa de uma linha](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dtype%26focus%3Dstage&width=1440&height=740&dpi=192&waitMs=1800&format=svg&walker=1&dark=1&filename=bs-type-stage)

O palco abre **inline in the room**, não numa caixa de diálogo, e diretamente sob o cartão que você pressionou. Enquanto está aberto, os cartões se dobram numa faixa de uma linha com papel e fonte, então o palco fica na primeira tela mesmo num celular. Escape cancela e devolve o teclado ao cartão de onde você o abriu.

Escolher uma fonte é três cliques:

1. **Choose a face** no cartão.
2. Digite o nome de uma família e pressione **Preview** - ou pressione uma das seis famílias **Pinned** sob o campo, um clique cada. O cartão aparece já carregando, com uma barra esqueleto onde o espécime vai ficar, em vez da fonte da interface substituindo uma fonte que você ainda não viu.
3. **Use this face**.

**O consentimento é pedido uma vez, no clique que você deu.** Na primeira vez que uma prévia alcança o Google Fonts, um diálogo diz o que acontece: *O Google aprende o nome da família e seu endereço IP. O arquivo então fica neste dispositivo e é usado offline. Este é o único passo no studio que alcança terceiros.* **Fetch from Google** segue em frente e é lembrado. **Cancel** deixa o cartão dizendo "Not fetched. Nothing was sent to Google." com seu próprio **Fetch from Google** ao vivo, então mudar de ideia é um clique no próprio cartão. Nenhum cartão nunca mostra um botão morto: seja qual for seu estado, seu único botão primário diz qual é o próximo passo.

**Solte um arquivo de fonte no palco** e ele aparece em prévia na hora - **TTF**, **OTF** ou **WOFF** da sua própria máquina, que é o caminho para uma tipografia corporativa licenciada que você já possui. Essa zona de soltura é a única porta de arquivo na sala.

De qualquer forma a fonte permanece neste dispositivo, renderiza no app, nas ferramentas e em toda exportação, offline para sempre, e viaja no arquivo do sistema de design - nada é buscado no momento da renderização. Tudo no Google Fonts é distribuído sob uma licença aberta (OFL/Apache/UFL).

### Fonts neste dispositivo

O painel **Fonts** lista toda fonte que este dispositivo guarda e o papel que ela atende. As fontes que você adicionou vêm primeiro sob **In the design system**, cada uma com seus papéis e uma exclusão, e a que atende Primary carrega o selo. As fontes starter vêm depois numa única linha dobrada - *Starter · SUSE, SUSE Mono · serving Primary and Code until you choose* - discretas, sem exclusão e nada para promover, porque nenhuma das duas é uma decisão que alguém tomou. **Add a face** abre o mesmo palco de comparação sem restrição.

O painel **Type roles** no rodapé mostra um espécime ao vivo de cada papel - corpo e interface na primária, uma fonte de destaque opcional para os títulos principais, um itálico para ênfase, uma monoespaçada para código e dados - com a família e seu estado ao lado de cada uma (*Inter*, *SUSE · starter*, *SUSE · follows Primary*), para que o conjunto inteiro possa ser lido de uma vez.

## Tokens

O restante do sistema de design, editável sem tocar em código:

![A sala Tokens - um controle deslizante de raio de canto mais espaçamento, dimensionamento, sombras e o resto do sistema](/t/url-shot?url=%2F%23%2Fstart%3Ftab%3Dtokens&width=1440&height=740&dpi=192&waitMs=1600&format=svg&walker=1&dark=1&filename=brand-tokens)

- **Rounded corners** - um único controle deslizante de raio (0-1,5rem) que cartões, botões e painéis no app inteiro seguem.
- **Neutrals** - a rampa tinta-sobre-papel que vem com uma instalação nova, listada como **Neutrals · starter · 9** com seus nove passos e um **Open** para o painel Colours. É o único lugar onde os neutros starter são gerenciados, e a tag *starter* vai embora no momento em que a rampa é gerada em vez de herdada.
- **More tokens** - adicione e edite **spacing**, **sizing**, **stroke width**, **opacity**, **rotation**, **numbers** simples e **shadows**. Escolha um tipo, dê um nome (*Gutter, Card shadow…*) e defina seu valor. Eles são armazenados como [tokens de design](/info/design-tokens.html) padrão (DTCG) e viajam com o sistema de design.

## Arquivos

Solte aqui os arquivos que sua marca guarda - além dos logos: recursos **vector**, **image**, **audio** e **motion** (vídeo, Lottie, animado). Eles chegam em [Ativos](/info/using.html#assets-your-library), organizados em seções e prontos no seletor de recursos de cada ferramenta. Tudo permanece neste dispositivo. (O trilho rotula a sala como **Files**; a chave de URL permanece `catalogue`, porque a chave de um painel é um contrato permanente.)

## Trazer uma marca

**Adicionar de...** no rodapé do trilho abre um seletor de dois estágios. O primeiro estágio pergunta o que você *tem*, não em que formato está:

- **Design tokens or a design file** - JSON do DTCG ou Tokens Studio, um projeto Penpot, um **zip de conjuntos de tokens**, um pacote de sistema de design Lolly ou um SVG.
- **PDF** - uma apresentação ou um arquivo de diretrizes, lido neste dispositivo em busca de suas cores, suas marcas e suas fontes incorporadas.
- **Logo or screenshot** - uma imagem vira uma paleta sugerida, lida neste dispositivo. Nada é enviado. Isso lê cores, não a tipografia ou o layout na imagem.
- **Saved web page** - escolha um arquivo HTML e seus arquivos CSS, ou cole HTML ou CSS. Até 20 arquivos e 2 MB no total. Só o texto fornecido é lido; recursos vinculados não são buscados e scripts não são executados. Este caminho também funciona sem a extensão ou o app de desktop.
- **Font file** - TTF, OTF ou WOFF. Abre a sala Type, onde a fonte é instalada.
- **Website** - uma página, lida por suas cores e tipografia. Este bloco só aparece num dispositivo que realmente consegue ler uma página, porque um bloco desativado anunciando algo que ninguém pode pressionar é pior do que nenhum bloco. Onde aparece, ele diz claramente qual leitor é usado: buscado pelo app neste dispositivo, ou lido pela extensão do navegador numa aba em segundo plano, conectado como você. Informar uma URL apenas *preenche antecipadamente* o campo - o botão de busca é o consentimento, então um link que alguém te manda nunca pode iniciar uma leitura sozinho.

Escolha a fonte de arquivo de design e o segundo estágio é o cartão abaixo: os formatos aceitos aparecem como blocos de ícone em ordem de preferência, e o cartão inteiro é um único alvo de arrastar-e-soltar - clique em qualquer lugar dele ou arraste um arquivo até ele. Você também pode soltar um arquivo direto no estúdio.

![O cartão de importação - os formatos aceitos aparecem como blocos de ícone, e o cartão inteiro é um único alvo de arrastar-e-soltar](/t/url-shot?url=%2F%23%2Fstart%3Fsource%3Dfile&width=1440&height=900&dpi=192&waitMs=1600&css=.start-import-modal%20.modal-msg%2C.start-import-modal%20.modal-title%7Bdisplay%3Anone%7D&cropSelector=.start-import-drop&walker=1&format=svg&dark=1&filename=bs-brand-import-formats)

O que cada arquivo de design te dá:

- um **Lolly design-system pack** (`.lolly`; o `.zip` legado ainda é aceito) - instala em uma etapa;
- uma exportação **Penpot** (`.penpot`) - traz seus tokens de design;
- um arquivo de **Design Tokens** (`.json`) - W3C DTCG;
- um arquivo **Tokens Studio** (`.json`) - Tokens Studio;
- um **SVG simples** (`.svg`) - o Lolly examina suas cores e deixa você escolher quais manter, a primeira se tornando sua primária.

Um logo/captura de tela, site ou página salva abre **Your suggested design system**. Veja um exemplo usando as cores propostas, escolha uma **Main colour** diferente se precisar, e dê um nome ao sistema. **Use this design system** aplica as paletas clara e escura geradas e retorna à Overview. As fontes existentes ficam no lugar. Isso substitui as cores do sistema ativo e as demais configurações de token. Um checkpoint precisa ter sucesso primeiro; **Restore brand settings** recupera as configurações anteriores.

**Source details and individual choices** mostra o que foi lido, os nomes de fonte detectados e o contraste de texto/ação da prévia. Também oferece **Choose individual items in the tray** e **Download design context**. O relatório JSON carrega observações, tokens propostos e informações de origem; HTML/CSS salvo inclui um SHA-256 do texto fornecido. Ele não contém o texto bruto da página e não é um Content Credential assinado. Nomes de fonte são sugestões: Type continua sendo o lugar para escolher e instalar fontes.

Importações de PDF e outros arquivos de design mantêm seus controles de revisão já existentes. Itens retidos na **Tray** não mudam nada até serem adicionados pela sala responsável por aquele tipo de material.

`#/start?source=<kind>` abre o seletor numa origem específica (`file`, `pdf`, `image`, `font`, `url`, `page`), e `?import` o abre na lista simples.

## Mover uma marca entre dispositivos

**Export**, no rodapé do trilho, grava um único **`LollyBrand-….lolly`** - seus tokens, fontes, logos e preferência de tema, com um manifesto de integridade que ele verifica ao ser importado de volta. Versões web anteriores à 1.0.7 chamavam o mesmo pacote de `.zip`; essa grafia legada ainda é aceita. Ao lado, **Tokens (.json)** grava o documento de tokens de design puro, sozinho: sem fontes, sem logos, só os tokens, que é o que um repositório, uma etapa de CI ou outra ferramenta de tokens de fato lê.

Trazer um de volta é **Adicionar de... → Tokens de design ou um arquivo de design** (acima), ou arrastar e soltar no estúdio. É assim que um colega te passa uma marca, ou como você a leva para uma segunda instalação - sem conta, sem nuvem. Para trazer uma marca pela linha de comando, veja [`ingest:brand`](/info/configuration.html#brand-packs).

## Restaurar configurações anteriores

Escolha **Restore brand settings** no rodapé do trilho, selecione um checkpoint datado, depois pressione **Restore**. Isso restaura cores, configurações de tipografia e outros tokens de marca para a marca ativa. Arquivos de fonte e imagem permanecem como estão.

O Lolly salva suas configurações atuais como **Before restore** antes de aplicar o checkpoint. Escolha esse checkpoint para reverter a restauração, mesmo depois de fechar e reabrir o navegador. Os últimos 20 checkpoints são mantidos neste dispositivo. Se o armazenamento não puder ser lido ou as configurações atuais não puderem ser salvas, o diálogo relata o problema para que você possa tentar de novo.

## Versões

**Versões**, no rodapé do painel lateral, é onde um sistema de design deixa de ser um alvo móvel. Publique uma e você obtém uma **cópia permanente e nomeada** guardada neste dispositivo: ela nunca muda depois disso, então uma ferramenta que a fixa continua desenhando a mesma coisa. O painel fica oculto até que haja algo seu para publicar, então um estúdio que nunca publica nunca vê os controles.

Três coisas para saber antes de pressionar qualquer coisa, e o painel diz as três antes do clique, não depois:

- **Uma versão é permanente.** Ainda não há exclusão, então o painel declara o que foi mantido e que continua mantido, em vez de oferecer um botão que mente.
- **As remoções lideram o cartão de compatibilidade.** Tokens adicionados e alterados são notícia; um token *removido* é o que quebra uma ferramenta, então ele é citado primeiro e chamado pelo que é.
- **Publicar não pode ser desfeito; restaurar pode.** *Restore latest from this version* é uma edição comum à ponta (head), então ela entra na pilha de desfazer do estúdio e o painel oferece o **Undo** imediatamente.

Você pode **Publish only** ou **Publish and make active** - a diferença é se as ferramentas e o aplicativo passam a seguir essa versão dali em diante ou continuam seguindo sua edição mais recente. **Follow the latest again** coloca cada edição no ar assim que é feita. `#/start?area=versions` abre o painel diretamente.

## Quando a marca é fixa

Algumas builds vêm com um **sistema de design travado**, como a SUSE Brand. Abri-lo mostra uma nota somente leitura com **Make an editable copy** e **Switch**. Suas cores, fontes e tokens originais ficam intactos. Seus próprios sistemas locais continuam editáveis, mesmo quando o sistema travado foi o primeiro no dispositivo. No Profile, **Open** seleciona um sistema e abre seu studio; **Make a new one** cria um sistema local e o abre em `#/start` com o campo de nome em foco.

## Para onde ir agora

- **[Usando o Lolly](/info/using.html)** - a tela, o salvamento, os projetos e Ativos.
- **[Tokens de Design](/info/design-tokens.html)** - o modelo de tokens em que sua marca é expressa.
- **[Exportação e formatos](/info/exporting.html)** - unidades de impressão, CMYK e os formatos em que sua marca é renderizada.


## Encontre e compare um visual

Abra **Find a look** a partir da Overview ou da lista de sistemas de design no Profile. Navegue pelos sistemas salvos neste dispositivo e alguns exemplos reutilizáveis do Lolly. Busque por nome, tag de cor ou fonte declarada. **Closest to my current palette** ordena por similaridade de cor medida, com famílias de fonte correspondentes desempatando; não é uma nota de qualidade.

Selecione um visual para revisá-lo, ou dois para comparar. O botão de revisão continua disponível numa tela pequena. Selecionar um visual não muda nada. **Use this saved system** alterna pelo registro de sistemas de design existente. **Use these colours** aplica um exemplo pelo fluxo normal de checkpoint e instalação, preservando as fontes atuais. **Restore brand settings** pode recuperar o visual anterior.

Sob **Details and design context**, sistemas salvos têm **Search tags** editáveis e um download de contexto. Os exemplos usam receitas de cor originais do Lolly; não há uma coleção de inspiração raspada remotamente nem conta obrigatória.

![Compare Sunroom e Orchard lado a lado antes de aplicar qualquer um dos sistemas de cor.](/t/url-shot?url=%2F%23%2Fstart&width=1280&height=900&dpi=96&waitMs=3000&format=svg&filename=brand-compare-looks&try=1&drive=click%3A%5Bdata-ds-door%3D%22looks%22%5D%3Bwait%3A500%3Bclick%3A%5Bdata-look-select%3D%22example%3Asunroom%22%5D%3Bclick%3A%5Bdata-look-select%3D%22example%3Aorchard%22%5D%3Bclick%3A%5Bdata-looks-review%5D%3Bwait%3A500&cropSelector=.ds-looks-comparison&waitSelector=%5Bdata-ds-door%3D%22looks%22%5D&walker=1&rasterDpi=96)

A comparação mantém as duas paletas visíveis juntas. Revisar um visual não muda nada até você escolher **Use these colours** ou **Use this saved system**.

## Leia a evidência de origem

Os detalhes opcionais da revisão de origem mostram tipografia, espaçamentos, preenchimentos e valores de canto onde observados. Leituras de HTML/CSS salvo e de sites nativos relatam declarações, que podem não ser usadas pela página renderizada. A extensão do navegador pode relatar estilos medidos a partir de uma amostra limitada de elementos visíveis, com sua viewport e preferência de cor do navegador. Extensões mais antigas ainda funcionam com estilos declarados. Campos ausentes dizem **Not observed**.

Isso são observações, não configurações de estilo automáticas. Arquivos de fonte não são buscados nem instalados por uma varredura de referência, e o espaçamento de origem não substitui silenciosamente o seu. Contagens descrevem ocorrências na amostra, não confiança ou qualidade.

## Verifique uma composição contra o sistema de design

No Design, abra **Export**, depois **Before you export**. A verificação usa a mesma versão efetiva do sistema de design que a renderização. Ela compara cores autorais, aliases de token, escolhas de fonte e IDs de asset de imagem. Valores personalizados podem ser intencionais; uma imagem fora dos assets de marca declarados é um item de revisão, não uma imagem proibida.

Onde uma sugestão concreta de cor ou fonte está disponível, seu botão muda apenas aquela camada. O **Undo** normal restaura o valor original. Camadas travadas ou alteradas não são sobrescritas por uma sugestão antiga. Evidência de origem ausente fica separada de uma correspondência. Contraste renderizado e layout de texto são verificados pelas checagens já instaladas. Gradientes, efeitos, conteúdo de ferramenta aninhado, direitos e qualidade subjetiva não são avaliados pela comparação de marca. As checagens não bloqueiam o Download.

## Use o contexto de design localmente

**Download design context** inclui o documento de tokens, cores resolvidas, famílias de fonte declaradas, IDs de asset, evidência de origem onde registrada, cobertura e regras explícitas. Não inclui arquivos de fonte nem prova de propriedade. A revisão de referência também inclui seus tokens propostos e observações.

A CLI pode ler qualquer um dos downloads sem um servidor:

```bash
lolly system import ./lolly-design-context.json
lolly system context --output=design-context.json
lolly system check ./design-inputs.json --file=design-context.json
```

`system check` aceita inputs do Design com um array `boxes` ou um documento Design compilado. Ele relata correções propostas sem modificar a composição. Não consegue medir o layout do navegador nem o contraste renderizado. O recurso MCP já existente **lolly://design-context** expõe o contexto do sistema efetivo pelo processo MCP local configurado; nenhum serviço hospedado novo nem chave de API é necessário.
