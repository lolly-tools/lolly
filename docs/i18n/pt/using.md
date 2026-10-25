# Usando o Lolly

Você abriu o Lolly e quer criar algo, guardar e enviar adiante. Esta página percorre esse ciclo: abrir uma ferramenta, mudar o que ela deixa mudar, salvar o resultado e compartilhá-lo como link ou arquivo.

Tudo aqui roda no seu dispositivo, sem conta, e continua funcionando offline depois que as ferramentas e os recursos de que você precisa são baixados. O app precisa de um navegador ou app com WebGPU para iniciar; [Supported environments](/info/supported-environments.html) lista os testados.

## Oriente-se

::: figure using-app-map
A tela inicial: quatro abas no topo e a barra no rodapé. Uma ferramenta, depois de aberta, mostra seus controles ao lado de uma prévia ao vivo.
:::

Quatro abas percorrem o topo da tela inicial: **Tools**, **Utilities**, **Assets** e **Projects**. Tools são o que você usa para criar, Utilities são bancadas para tarefas como converter, verificar ou limpar um arquivo, Assets é a sua biblioteca e Projects guarda o que você salvou.

A barra no rodapé tem **Open**, **Settings**, um campo de busca, **Verify** e **What?**. Ela aparece em Tools, Utilities, Assets, Projects, Settings e nos guias que você lê no app, e sai de cena quando uma ferramenta é aberta. A [Search](/info/search.html) alcança suas ferramentas, trabalhos salvos, recursos e configurações a partir desse campo. O [Ask Lolly](/info/ask.html) responde a uma pergunta digitada com a seção correspondente destes guias.

Clique em um cartão para começar algo novo nessa ferramenta. Os trabalhos salvos são reabertos em **Projects**.

![Um cartão de galeria com navegação de exemplo e uma ação Novo](/t/url-shot?url=%2F%23%2F&width=1440&height=900&dpi=192&waitMs=1600&css=.welcome-dialog%2C.personalize-nudge%7Bdisplay%3Anone!important%7D&waitSelector=.gallery-view%5Bdata-shots-settled%5D&walker=1&format=svg&localize=1&dark=1&cropSelector=.gtile%5Bdata-tool-id%3D%22design%22%5D&filename=gallery&try=1)

Cada ferramenta é uma visão dividida: **controles** de um lado e uma **prévia** ao vivo do outro. Mude um controle e a prévia acompanha na hora, e o que você vê é o que é exportado.

![A visão dividida de uma ferramenta - a pilha de controles à esquerda, e o gráfico de barras agrupadas ao vivo que ela desenha à direita](/t/url-shot?url=%2F%23%2Ftool%2Fchart%3Fct%3Dbar%26t%3DExample%2520data%26st%3DSample%2520values%252C%2520not%2520a%2520real%2520dataset%26d%3DMonth%252CSeries%2520A%252CSeries%2520B%252CSeries%2520C%250AJan%252C12%252C9%252C5%250AFeb%252C18%252C14%252C7%250AMar%252C24%252C17%252C11%250AApr%252C29%252C23%252C15%26lg%3D1&width=1440&height=900&dpi=192&waitMs=2500&walker=1&format=svg&dark=1&filename=vt-tool-split-view)

O **Design** é a exceção. Ele abre como um canvas livre de caixas que você arrasta, redimensiona e preenche com texto, com barra superior, linha do tempo e controles de deck próprios. [Design: the free canvas](/info/design.html) é o guia dele.

## Mude o que a ferramenta deixa mudar

Uma ferramenta mostra apenas as entradas feitas para variar. O autor dela já fixou as cores, o layout, a tipografia e a lógica, então tudo o que você cria respeita as regras dele. As entradas incluem texto, controles deslizantes, seletores de cor, menus suspensos, datas, seletores de imagem e grupos de linhas repetidas, e algumas ficam em seções que se recolhem.

![A pilha de controles de uma ferramenta - um campo de texto, gatilhos de cor e um slider, e nada mais, porque o autor escolheu travar o resto](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools&width=1440&height=900&dpi=192&waitMs=2500&cropSelector=%23tool-inputs&walker=1&format=svg&dark=1&filename=use-tool-inputs)

**Clique no design para achar o controle dele.** Clique em qualquer elemento da prévia e o controle correspondente recebe o foco e rola para a vista. Em um grupo de linhas repetidas, a linha exata em que você clicou se abre.

**Clear changes**, acima dos controles, devolve todas as entradas ao padrão.

**Escolhas do sistema de design.** Quando o seu sistema de design oferece mais de uma variação de cores, um visual claro e um escuro ou outra escolha de tema, uma seção **Design system** abaixo dos controles reúne essas opções. Uma escolha só aparece quando muda esta ferramenta, então um utilitário de arquivos não mostra seção alguma. Cada variação de cores é um ponto nas próprias cores, claro e escuro são dois botões e qualquer outra escolha é uma lista.

A escolha pertence a esta peça. Ela viaja no link e na sessão salva, todas as cores vinculadas ao sistema de design a seguem e as cores do próprio app ficam como estão. O Design mostra as mesmas escolhas na aba **Canvas** do Inspector. Uma ferramenta cujas cores são o próprio conteúdo pode ficar na variação de cores canônica, e então não oferece pontos de variação. [Lolly Demo in use](/info/lolly-demo-in-use.html#colourways-on-real-work) mostra variações de cores em trabalhos reais.

### Zoom e deslocamento da prévia

A pré-visualização sempre mostra exatamente o que será exportado.

- **Zoom:** Cmd/Ctrl com rolagem, ou pinça no trackpad, centrado no ponteiro. No teclado, `0` ou `Shift+1` ajusta tudo, `1` ou `Shift+0` define 100% e `Shift+2` ajusta a seleção. `+` / `−` dão zoom ao redor do ponteiro quando ele está sobre a área de edição, ou ao redor do centro caso contrário.
- **Deslocar:** segure **Space** e arraste, ou arraste com o botão do meio do mouse. Os cliques simples ficam livres para clicar nas partes do design.
- **Toque:** pinça para dar zoom, arraste para deslocar e toque duplo para ajustar.
- **HUD de zoom:** mantenha pressionado o redemoinho do Lolly no canto para abrir `−`, **Fit** e `+`. Um toque curto no redemoinho ainda abre o menu do seu perfil.

No Design, **Fit all** inclui as pranchetas e as camadas soltas. Você pode afastar o zoom manualmente abaixo de 20% até que a página inteira ocupe metade da visualização. O limite inferior é o menor entre 5% da escala Fit normal e 2% de zoom absoluto.

Uma mudança no tamanho da saída sempre leva a vista de volta a um ajuste limpo.

![O HUD de zoom aberto a partir do redemoinho no canto do canvas - menos, Fit, mais, depois os alternadores de tema e som e a alça que o move](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools&width=1440&height=900&dpi=192&waitMs=2500&css=.stage-nav%7Bopacity%3A1!important%7D&drive=drag%3A.stage-nav-profile%7Cdx%3D1%7Chold%3Bwait%3A700&cropSelector=.stage-nav&walker=1&format=svg&dark=1&filename=use-zoom-hud)

### Desfazer e refazer

**Cmd/Ctrl-Z** volta um passo e **Cmd/Ctrl-Shift-Z** (ou **Cmd/Ctrl-Y**) avança um passo. O mesmo par aparece como botões **Undo** e **Redo** acima dos controles (no Design ficam na barra superior), e cada um fica cinza quando não há mais nada a desfazer. Uma mensagem diz qual entrada cada desfazer restaurou, com um botão **Redo** na mensagem.

- **Um arrasto é um passo.** Mudanças repetidas em um controle em até meio segundo se fundem, então puxar um controle deslizante por toda a faixa é um único desfazer.
- **Os últimos 100 passos são mantidos.** Uma nova edição depois de desfazer limpa a pilha de refazer.
- **Em uma caixa de texto**, Cmd/Ctrl-Z pertence ao campo, caractere por caractere. O Lolly assume nos controles deslizantes, menus suspensos, cores e chaves.
- **Escolher um arquivo** em uma entrada de arquivo não é um passo, porque esses bytes são mantidos apenas durante esta sessão.

Em uma [colaboração](/info/collaborate.html) ao vivo, seu histórico continua sendo seu: uma alteração vinda do outro dispositivo nunca entra na sua pilha. O desfazer dura até você sair da ferramenta ou recarregar. Para qualquer coisa mais antiga, as ferramentas que salvam enquanto você trabalha mantêm versões anteriores em **History**; veja [Go back to an earlier version](/info/find-your-work.html#go-back-to-an-earlier-version).

### Câmera ao vivo

Os efeitos da ferramenta **Filter** (Halftone, Scanline, Posterize, Voronoi, Duotone, Stretch, Misprint, Dither, ASCII art e Glitch) mostram um botão **Go live** onde houver câmera. Ative-o e o efeito acompanha a sua webcam quadro a quadro, e uma exportação de movimento grava o resultado como GIF, WebM ou MP4. Os quadros são processados no seu dispositivo, e a câmera é liberada assim que você para ou sai da ferramenta. Qualquer seletor de imagem também tem **Take a photo** para um único quadro.

## Salvando e continuando

Para guardar o seu trabalho, pressione **Save**, o visto ao lado de **Export** na pílula de renderização. O trabalho novo vai para **My library**, o trabalho salvo antes é atualizado onde está e nada é baixado. O painel de exportação tem o mesmo botão **Save**.

Para escolher onde ele vai, pressione **Save as**, ao lado de **Download** no painel de exportação. Em **Save to a project**, deixe **My library** selecionada ou escolha um projeto (**＋ New project…** cria um) e pressione **Save**; **Save as a template** guarda o design como um [modelo](/info/templates.html), um ponto de partida para novos documentos. No Design, **Save as** fica no menu Lolly; no celular, pressione **•••**, depois **File menu** e então **Save as**.

![A pílula de renderização de duas metades: Export, com uma seta para cima que abre o painel de exportação, e Save, com um visto que salva no mesmo lugar](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools&width=1440&height=900&dpi=192&waitMs=2500&css=%23tool-inputs%7Bdisplay%3Anone%7D&cropSelector=.render-pill&walker=1&format=svg&dark=1&filename=use-render-pill)

::: timeline
- <!--i:check--> Pressione **Save** na pílula de renderização, ou **Save as** para escolher um projeto.
- <!--i:folder--> O item vai para **My library**, ou para o projeto que você escolheu.
- <!--i:home--> Depois, pressione **Home** no canto superior esquerdo e abra a aba **Projects**.
- <!--i:document--> Abra o item. Todas as configurações voltam, prontas para mudar e exportar de novo.
:::

Os itens recebem o nome do arquivo que você digitou no painel de exportação ou, na falta dele, o da ferramenta, como **QR Code**. Um arquivo obtido com **Download** é uma cópia final; para alterá-lo depois, abra o item salvo em Projects.

Os salvamentos pessoais ficam neste dispositivo, no navegador ou app em que você salvou, a menos que você ative o [Sync](/info/sync.html). Se algo não estiver onde você espera, [Find and recover your work](/info/find-your-work.html) cobre todos os casos, de uma aba fechada a dados de navegador apagados.

::: details Projetos de equipe com o Lolly Work (opcional)
Se a sua [organização usa o Lolly Work](/info/organisation.html), faça login na instância dela e abra **Projects → Team projects** para ver as sessões compartilhadas com você. A organização define o acesso e a retenção, e o serviço Lolly Work dela armazena essas sessões. Uma sessão compartilhada entra no collab ao vivo dela quando é aberta, se a sua organização permitir a edição ao vivo; [Working together](/info/collaborate.html#work-collabs-with-lolly-work-optional) explica as etapas.

Sua biblioteca pessoal continua separada. Fazer login em outro dispositivo traz o trabalho da equipe, mas os salvamentos pessoais ainda precisam do Sync ou de um backup para passar de um dispositivo a outro.
:::

## Compartilhando seu trabalho

Um design sai como link ou como arquivo. **Share**, nos controles de exportação, abre uma caixa de diálogo que oferece os dois, e **Share link** em uma sessão salva em Projects abre a mesma caixa para essa sessão.

::: cols
## Um link

- Carrega todas as entradas no endereço, então o link reproduz o design.
- Deixa para trás imagens e arquivos que você adicionou deste dispositivo, textos muito longos e listas muito grandes.
- Abre em qualquer navegador, então você pode marcar, colar ou fazer commit do link.

## Um arquivo .lolly

- Carrega a sessão salva com as imagens e os arquivos deste dispositivo e pode levar também a ferramenta e o sistema de design.
- Retém arte licenciada do catálogo, a menos que você escolha incluir os arquivos.
- Abre no Lolly: dê dois cliques, use **Open** ou solte-o no app.
:::

### O link

O link pronto para copiar fica no topo da caixa de diálogo, com **Copy** e um botão **QR** que abre a ferramenta QR Code com o link. Abaixo do link, **Link options** reúne:

- **Open in the installed app** troca o link por um endereço `lolly://` para Atalhos, lançadores e automação, com todos os parâmetros inalterados.
- **Shortest link** compacta um design longo em um token curto e mostra a economia em caracteres. A forma legível também está sempre lá.
- **Password-protect this link** criptografa o link no seu dispositivo com AES-256. A senha nunca faz parte do link.
- **Pin this tool version** adiciona o sinalizador `_v`, para que uma atualização posterior da ferramenta não mude o que o link renderiza.
- **When the recipient opens the link…** escolhe tela cheia, o painel de exportação já expandido, um download ao abrir (`&export`) ou uma cópia para a área de transferência (`&copy`).
- **Copy credit** copia uma legenda "Made with Lolly" junto com o link, para uma publicação ou um slide.

Quando uma ferramenta tem campos pessoais, como o seu nome, **Review personal fields** mantém cada um fora do link até você marcar esse campo. [URL mode](/info/url-mode.html) cobre tudo o que um link pode carregar.

**A caixa de diálogo diz o que um link não consegue carregar.** Uma imagem ou arquivo que você adicionou deste dispositivo, um valor de texto muito longo e uma lista muito grande não cabem em um endereço. Cada um é contado enquanto o link é montado. Se algo precisou ser descartado, a caixa de diálogo lista o que foi e indica a opção de arquivo, em vez de entregar um link que abre com uma imagem faltando. Um link que é apenas longo recebe uma nota mais branda com a contagem de caracteres.

**Algumas ferramentas fazem do link o produto inteiro.** O Jump Page reúne seus links em uma única página para distribuir: um link de bio, uma palestra, uma vitrine. Nada é hospedado e nenhuma conta fica por trás da página, porque a página é o link. Quem a visita a vê em largura total, um link por cena conforme rola.

![Jump Page no editor: a cena do título na parte superior da página, com as cenas de links abaixo](/t/url-shot?url=%2F%23%2Ftool%2Fjump%3Ffull%26heading%3DFind%2520us%2520everywhere%26subheading%3DOne%2520link%2520for%2520everything.%26links%3DURL%252CName%252CEmoji%257Ehttps%25253A%25252F%25252Fexample.com%252CWebsite%252C%257Ehttps%25253A%25252F%25252Fexample.com%25252Fnews%252CNewsletter%252C%257Ehttps%25253A%25252F%25252Fexample.com%25252Fhello%252CSay%252520hello%252C&width=900&height=1300&dpi=96&waitMs=2000&cropSelector=%23tool-canvas&walker=1&format=svg&dark=1&filename=use-jump-page)

::: details Links gerenciados pela organização com o Lolly Work
Para compartilhamentos que exigem expiração, revogação ou senha, o Lolly Work oferece links gerenciados para sessões compartilhadas, ferramentas e recursos do catálogo. Eles são resolvidos pelo serviço da organização e seguem as regras de acesso dela. São separados dos links autônomos acima, e revogar um não recupera um arquivo que alguém já baixou. [Rendering and sharing](/info/manage/sharing.html) lista os tipos de link e as permissões.
:::

### O arquivo .lolly

**Download .lolly**, na seção **Editable file** da caixa de diálogo Share, grava o design atual em um único arquivo. Ele carrega a sessão salva com as imagens e os arquivos deste dispositivo, e a arte comum do catálogo vai junto. Um arquivo desatualizado ou indisponível continua como referência externa em vez de desaparecer. Antes de salvar, a caixa de diálogo mostra o tamanho do arquivo, quantos arquivos ele incorpora, quantos referencia e se a ferramenta está incluída. Onde o seu dispositivo tem uma folha de compartilhamento, **Send to…** entrega o arquivo direto a ela (AirDrop, compartilhamento do Android).

**Download project (.lolly)**, no menu de uma pasta em **Projects**, grava uma pasta inteira, para que outra pessoa continue com todas as sessões da pasta. As sessões de lote ficam para trás, e o aviso diz quantas. **Download originals**, no mesmo menu, grava um zip simples com cada item como arquivo próprio.

Três coisas ficam por sua decisão antes de um arquivo sair:

- **Se o seu nome entra.** Seu nome, e-mail e organização só são gravados quando **Use my details to create** está ativado no [seu perfil](/info/profile.html). Com a opção desativada, o arquivo registra apenas que foi feito com o Lolly e quando.
- **Se a arte retida entra.** Arte licenciada, arte bloqueada pela marca e obras do catálogo cuja licença nunca foi registrada ficam de fora por padrão. Se o design usa alguma, a caixa de diálogo diz quantas e oferece *Download without them* ou *Include and download*, porque incluí-las entrega os arquivos a quem abrir o `.lolly`. O `CREDITS.txt` do arquivo lista o que viajou e o que não viajou, com o motivo; [Creative rights and credits](/info/creative-rights.html) explica as regras.
- **Se a ferramenta entra.** **Include the tool** empacota os arquivos da própria ferramenta, para que o design abra em um dispositivo sem essa ferramenta. Começa marcado para uma ferramenta personalizada, como um fork, e desmarcado para uma ferramenta listada no catálogo assinado. Em uma versão sem catálogo assinado, toda ferramenta conta como personalizada.

**Abrir um.** Nos apps desktop e mobile, dê dois cliques ou toque em um `.lolly`, escolha **Open with Lolly** ou envie-o ao Lolly pela folha de compartilhamento. No app web, pressione **Open** ou solte o arquivo no Lolly. Todos os caminhos leem primeiro o manifesto do arquivo e mostram o tamanho, o conteúdo e o que vai acontecer, antes de qualquer coisa ser gravada.

Se o arquivo traz uma ferramenta que você não tem, **Trust this tool?** mostra a ferramenta e o autor dela e diz que abri-la executa o código da própria ferramenta no seu dispositivo. **Trust & install** segue em frente. Se você recusar, o trabalho ainda é salvo em Projects, esperando o dia em que você adicionar a ferramenta. Uma ferramenta cujo código vem como módulo ainda não pode ser instalada assim e é recusada do mesmo jeito.

::: details O que um .lolly contém e como funciona abrir um
`.lolly` é a extensão de pacote do Lolly, e o `format` no `manifest.json` dele diz o que há dentro:

- Um **design compartilhado** (`lolly-share`) contém uma sessão salva, seus arquivos incorporados e um recibo para tudo o que ainda é resolvido por referência. Também pode levar a ferramenta e o sistema de design. Abri-lo adiciona um novo Project e nunca sobrescreve uma sessão.
- Um **projeto compartilhado** (`lolly-share`, tipo `project`) contém uma pasta de Projects: suas subpastas, todas as sessões nelas com o respectivo bloco e as imagens arquivadas ali. Abri-lo adiciona uma cópia da pasta inteira. Cada sessão viaja como `sessions/<key>.json` com o bloco dela em `thumbs/`. Um Lolly anterior aos arquivos de projeto pede que você atualize.
- Um **pacote de sistema de design** (`lolly-brand`) contém tokens e pode conter fontes, logotipos, versões publicadas e recursos retidos. Abrir o pacote adiciona um sistema de design separado, com nome, e o torna ativo.
- Um **pacote de espaço de trabalho ou de instância** é um `lolly-brand` com ferramentas declaradas, recursos do catálogo e, opcionalmente, o endereço de uma instância. Carregar um substitui a única sobreposição de espaço de trabalho carregada antes, e a prévia lista esses efeitos em todo o dispositivo.

Um backup completo do dispositivo não é um `.lolly`. Ele continua sendo um `LollyTools-….zip` (formato `lolly-backup`) e é restaurado em **Settings → Storage → Import data…**. Uma pasta de ferramenta compactada também continua sendo um `.zip`. [Data transfer](/info/data-transfer.html) é a referência do formato.

Um `.lolly` é um zip comum. Renomeie-o para `.zip` para ver o interior: suas próprias imagens ficam em `assets/uploads/`, a arte do catálogo em `assets/catalog/`, o `manifest.json` lista todos os arquivos e um README diz o que é o arquivo.

macOS, Windows, Linux, iOS e Android registram o formato, os gerenciadores de arquivos do desktop o mostram como um documento do Lolly e o GNOME Files pode mostrar a miniatura da própria sessão salva. Abrir pelo Design System Setup recomenda a ação de sistema de design quando um design compartilhado traz um, mas nunca esconde **Open shared design**.

Um documento entregue por outro app no iOS ou no Android é limitado a 48 MB, porque a entrega copia os bytes através do limite do app, e o app avisa isso. **Open** dentro do Lolly não tem esse limite, então use-o para um pacote maior.

Depois que você confirma, o Lolly descompacta e verifica o pacote uma vez. Os recursos vão para a sua biblioteca, combinados por checksum para que um arquivo já presente no dispositivo seja reaproveitado. As sessões vão para Projects com novos ids, então o mesmo arquivo pode ser aberto duas vezes; uma sessão cuja ferramenta falta espera ali. Arquivos acima de 100 MB são sinalizados como grandes, e a prévia avisa quando o armazenamento do navegador informa menos espaço livre do que o arquivo precisa. Toda parte coberta por integridade é verificada antes de qualquer confirmação, e uma cópia danificada é recusada sem deixar nada para trás.
:::

Um link e um arquivo entregam uma cópia instantânea. Para edição ao vivo, [Working together](/info/collaborate.html) cobre collabs privados entre dois dispositivos e collabs de trabalho opcionais pelo Lolly Work.

## Ativos - sua biblioteca

**Assets** (`#/a`) reúne tudo em que suas ferramentas podem se apoiar: logotipos da marca, imagens, áudio e movimento, agrupados por tipo, junto com os seus próprios arquivos. Seus envios ficam armazenados no seu dispositivo. Uma organização que usa o Lolly Work também pode fornecer um catálogo compartilhado sob as próprias regras de acesso; veja [Use Lolly at your organisation](/info/organisation.html).

![Ativos - ativos de marca, amostras e fontes, além dos seus próprios uploads](/t/url-shot?url=%2F%23%2Fa%3Fsection%3Dswatches%2Cfonts&width=1440&height=900&dpi=96&waitMs=2400&css=.plat-swatch-grid~%2A%7Bdisplay%3Anone%7D&walker=1&format=svg&localize=1&dark=1&filename=assets)

- <!--i:upload--> **Traga seus arquivos.** Solte uma imagem, SVG, clipe de áudio, vídeo, Lottie, PDF ou deck do PowerPoint na área de envio, ou clique para escolher. Ele chega em Assets na hora e no seletor de recursos de todas as ferramentas. Um PDF com várias páginas ou um `.pptx` pergunta quais páginas ou slides manter, e cada um vira um recurso SVG. Uma imagem que você adiciona dentro de uma ferramenta é mantida como chegou em **My images**, então uma Content Credential nela continua sendo verificada, e só um arquivo muito grande pergunta se deve ser redimensionado. **Settings → Storage** mostra quanto **My images** ocupa. Não há limite além do armazenamento do seu dispositivo. Para limpar dados EXIF e GPS conforme as imagens entram, ative **Strip metadata from uploads** em **Settings → Feature flags**; as Content Credentials são mantidas de qualquer forma.
- <!--i:star--> **Favorite o que você mais usa.** Marque um recurso ou uma amostra da marca com estrela e ele fica fixo no topo de todos os seletores.
- <!--i:folder--> **Arrume.** Mova um recurso para outro grupo, oculte um recurso compartilhado da marca que você não usa (**Show hidden** o traz de volta) ou exclua seus próprios envios. A mesma barra de seleção de Projects age sobre uma seleção inteira.
- <!--i:layers--> **Tire um vídeo do fundo.** Abra os detalhes de um vídeo, ou clique com o botão direito no cartão dele em um seletor de recursos, e escolha **Remove background…**. Um **On-device model** recorta um sujeito de uma cena movimentada; um **Colour key** remove um fundo de iluminação uniforme, como um chroma key verde, com **Tolerance**, **Softness** e **Spill removal** para a borda, e não exige download. **Resolution** (360, 480, 720 ou 1080p, nunca além da origem) troca detalhe por velocidade. O recorte, um WebP ou PNG animado com transparência real, é salvo ao lado do original, e a Content Credential da origem segue junto como ingrediente. [Generated once, rendered the same](/info/ai-features.html) explica por que isso continua sendo uma edição simples.

### Leve sua paleta e suas fontes para qualquer lugar

O painel **Swatches** em Assets mostra as cores de que a sua marca é feita: as cores da marca, as cores que você adicionou, suas rampas e seu espectro. As cores de função que o Lolly mantém para a interface (texto, superfícies, bordas, cores principais de variações e cópias de uma cor da marca sob outro nome) ficam atrás de um cartão cinza **Show colour roles** no pé do painel.

Cada cor é um cartão como qualquer outro recurso. Clique em uma para abrir os detalhes, selecione algumas para baixar apenas essas ou baixe a paleta inteira no formato que a sua outra ferramenta lê:

- <!--i:code--> **Design tokens (JSON)**, **CSS variables** ou **CSS classes**, para uma folha de estilos ou uma compilação. Uma cor mais ampla que o sRGB mantém seu valor amplo: o CSS a define depois do hex, e o JSON mantém o hex junto com a cor ampla, a composição CMYK e a tinta especial.
- <!--i:palette--> **Adobe Swatch Exchange (.ase)**, para Illustrator ou Photoshop. Uma cor presa a uma composição CMYK chega como essa amostra CMYK, uma tinta especial como uma amostra especial nomeada e uma cor mais ampla que o sRGB como Lab.
- <!--i:pentool--> **GIMP palette (.gpl)**, para GIMP ou Inkscape, e **SCSS variables**, ambos em sRGB.

![O painel Swatches - os cinco botões de download de paleta no topo e depois cada cor da marca como uma amostra que abre os detalhes dela](/t/url-shot?url=%2F%23%2Fa%3Fsection%3Dswatches&width=1440&height=900&dpi=96&waitMs=1800&css=.cat-group%3Anot%28%5Bdata-group%3Dswatches%5D%29%7Bdisplay%3Anone%7D&cropSelector=%5Bdata-group%3Dswatches%5D&walker=1&format=svg&dark=1&filename=use-swatch-downloads)

Selecione cores pelo ponto de cada cartão: Shift-clique em um segundo ponto para tudo o que está entre eles, arraste uma caixa pelos intervalos ou pressione Cmd/Ctrl+A com um cartão em foco. A barra oferece **Download as…** nos mesmos seis formatos, **Copy hex** e **Favourite**. Antes de escolher um formato, o menu lista qualquer cor que nenhum formato consegue guardar (Transparent não tem cor alguma), quais formatos salvam uma cor ampla como sua alternativa sRGB (SCSS e GIMP) e quais carregam os valores CMYK e de tinta especial (JSON e .ase). Clique com o botão direito em um cartão para as mesmas ações em uma única cor.

Os detalhes de uma cor preenchem a prévia com a cor e abrem **Linked values** (sua composição CMYK ou tinta especial, qualquer valor criado para um espaço ou uma impressora específicos e o design token dela), **Every notation** (hex, OKLCH, Display-P3 e as demais, cada uma com um botão de copiar), **Plotted on a colour space**, **Tones** e **Readability**. As setas do teclado percorrem a paleta, **Copy link** compartilha a própria cor e **Open in Colour Lab** vai além.

O painel **Fonts** lista as fontes da sua marca com um **download** para cada uma, para instalar localmente ou entregar a uma gráfica.

## Deixe a grade com a sua cara

- <!--i:star--> **Favorite o que você usa.** Clique com o botão direito em um cartão e escolha **Add to favourites**, e ele ganha um bloco grande em uma faixa acima da grade. [Your favourites](/info/favourites.html) cobre a faixa.
- <!--i:eyeoff--> **Oculte uma ferramenta que você nunca usa.** Clique com o botão direito em um cartão, ou selecione vários, e escolha **Hide tool**. Ela sai da grade e do que a digitação na grade encontra. Um bloco cinza **Show hidden tools (N)** no fim as revela de novo, esmaecidas, cada uma com **Unhide tool** no menu. Ocultar só muda a sua grade: a ferramenta ainda abre por um link ou um favorito.
- <!--i:clock--> **Suas ferramentas, primeiro.** Depois que você tem trabalho salvo em três ferramentas diferentes, uma fileira **Yours** de chips acima da grade começa com seus favoritos e ferramentas recentes.
- <!--i:sliders--> **Organize do seu jeito.** **View options** define o layout (**Grid**, **Card** ou **List**), o tamanho e a densidade dos cartões, a ordem e um filtro de categoria.

![O fim da grade de Tools com as ferramentas ocultas reveladas: o cartão Wordmark esmaecido e, ao lado dele, o bloco cinza que as trouxe de volta à vista, agora com o texto Hide hidden tools](/t/url-shot?url=%2F%23%2F&width=1440&height=680&dpi=192&waitMs=1600&css=.welcome-dialog%2C.personalize-nudge%7Bdisplay%3Anone!important%7D&drive=click%3A.gtile--hiddenbox%3Bpress%3AEnd%3Bwait%3A800%3Bhover%3A.gtile--hiddenbox%3Bwait%3A300&waitSelector=.gallery-view%5Bdata-shots-settled%5D&walker=1&format=svg&rasterDpi=96&dark=1&filename=misc-hidden-tools)
<!--
SHOT NOTE (misc-hidden-tools): the trailing `press:End` is required. The
hidden box and the revealed cards live at the very END of the grid, and
clicking the box runs applyView(), which re-lays the grid out and drops the
scroll back to the top - so without it the frame published the TOP of the
gallery under a caption about its bottom. `press:` with no `on=` goes to the
keyboard, and the End key with focus on the just-clicked box scrolls the
document; the walker then anchors the body walk to that band.
The tile reads "HIDE hidden tools" in the shot, not "Show" - it is a toggle and
the recipe has just pressed the tile. The alt says so rather than quoting the resting
label the prose above already gives.
The recipe hides nothing itself. The lolly-demo catalog the captures pin
ships Wordmark hidden (`defaultHiddenTools` in its assets index.json), so a
fresh profile already has one hidden tool and the recipe only clicks the grey
reveal tile (`.gtile--hiddenbox`, confirmed in gallery.ts). It used to tick
the QR Code card and press the bulk bar's Hide button first; under lolly-demo
that published Wordmark dimmed and QR Code not, under a caption naming QR
Code, so the steps were dropped rather than relied on. QR Code was hidden
in that run too: the End scroll had left the pointer over its card, and a
hovered hidden card lifts its dimming (gallery.css), so it read as a normal
tool. The closing `hover:` puts the pointer back on the reveal tile, which
keeps every revealed card dimmed.
-->

**Aja sobre vários cartões de uma vez.** Marque a caixa de seleção de cada cartão, arraste uma caixa de seleção sobre o espaço vazio ou use Shift/Cmd-clique, e aparece uma barra com o que aquela visão permite:

- **Tools e Utilities:** Favourite, Hide, Available offline, **View sessions** (Projects, mostrando apenas as sessões feitas com essas ferramentas) e Copy link para um único cartão.
- **Assets:** Favourite e Hide para qualquer seleção. Duplicate, Download e Delete só aparecem quando todos os itens selecionados são envios seus, porque um recurso compartilhado do sistema de design é um contrato permanente.
- **Projects:** veja [Find and recover your work](/info/find-your-work.html#find-something-you-saved).

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

**View sessions** só aparece depois que algo é selecionado. Clique com o botão direito em um único cartão não selecionado e ele oferece **N saved sessions**, uma lista das sessões salvas daquela ferramenta em que excluir move a sessão para a Lixeira.

## No celular

Em uma tela estreita, o layout vira uma única coluna:

- Os **controles viram uma folha** no topo, com uma alça de arrastar na borda inferior. Arraste a alça para encaixar em **peek**, **half** ou **full**, ou toque nela para recolher e expandir. A prévia ocupa o espaço abaixo e continua visível enquanto você edita.
- Um botão flutuante **Export** abre a folha de exportação: formato, tamanho, copiar, salvar e baixar em um só lugar. Toque no fundo para fechar a folha.

![Uma ferramenta em uma tela com largura de celular - os controles como uma folha no topo, a paleta gerada preenchendo a pré-visualização abaixo e a pílula de renderização flutuando na parte inferior central](/t/url-shot?url=%2F%23%2Ftool%2Fcolor-palette%3Fseed%3Df97316%26harmony%3Dadjacent-3%26steps%3D9&width=430&height=900&dpi=192&waitMs=2200&walker=1&format=svg&dark=1&filename=vt-phone-palette)

## Configurações, som e conforto

**Settings**, no rodapé da tela inicial, reúne seus dados, seus sistemas de design, acessibilidade, armazenamento e downloads offline. [Settings](/info/dashboard.html) mapeia todas as abas.

- **Seus dados e sua foto de perfil** preenchem qualquer ferramenta feita para usá-los, como uma assinatura de e-mail ou um crachá. [Profiles](/info/profile.html) trata deles.
- **Accessibility** tem quatro opções de conforto: **Reduce motion**, **Hide colourful previews**, **High contrast** e **Large text**. Elas mudam o app ao redor do seu trabalho, nunca o canvas de uma ferramenta nem uma exportação.
- **Sound** toca sons de apoio suaves para o que você faz, e o **Neurospicy Mode** toca uma faixa calma de foco. Ambos ficam desativados até você ativá-los, em **Settings → Accessibility** ou no menu do perfil.
- **Available offline** baixa o restante do app, suas ferramentas, o catálogo e os guias antes que você perca a conexão. O Lolly é um app web que você pode instalar: use o botão de instalação do navegador, ou *Add to Home Screen* no celular, para ter um app em tela cheia que se atualiza sozinho quando você volta a ficar online.
- **Storage** mostra o que o Lolly guarda neste dispositivo. [If you clear your browser data](/info/find-your-work.html#if-you-clear-your-browser-data) explica o que a limpeza remove, e a [Política de Privacidade](/info/privacy.html) lista tudo o que o app busca ou envia.

::: note Se uma tela não carregar depois de uma atualização
Um painel em branco ou uma mensagem "failed to fetch" logo após uma atualização costuma desaparecer com um recarregamento. Seu trabalho salvo, suas sessões e seus sistemas de design não são afetados, porque ficam armazenados no seu dispositivo. Apenas uma imagem que você adicionou e nunca salvou pode precisar ser adicionada de novo.
:::

## Para onde ir agora

- **[Design: the free canvas](/info/design.html)**: o canvas, as formas, a linha do tempo e a apresentação de um deck.
- **[Batch and Multi-edit](/info/batch.html)**: muitas versões de um design, ou vários designs salvos editados juntos.
- **[Export a file](/info/exporting.html)**: escolher formato, tamanho, unidades de impressão, transparência e vídeo.
- **[Import a design](/info/design-import.html)**: traga um arquivo do Figma, Penpot, Illustrator ou InDesign para o Design e continue editando.
- **[Templates](/info/templates.html)**: pontos de partida salvos para uma ferramenta.
- **[Wide Colour and HDR](/info/hdr-editing.html)**: mantenha a precisão original das imagens no Design e no Darkroom.
- **[Find and recover your work](/info/find-your-work.html)**: onde está cada coisa e como levá-la para outro dispositivo.
