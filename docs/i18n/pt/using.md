# Usando o Lolly

Abra uma ferramenta, altere o que ela permite, salve o resultado e compartilhe por link ou arquivo.

Tudo roda no seu dispositivo sem conta e funciona offline após o download das ferramentas e dos recursos necessários. Para iniciar, o app precisa de um navegador ou app com WebGPU. [Ambientes compatíveis](/info/supported-environments.html) lista os que foram testados.

**O ciclo**, em quatro etapas:

::: steps
- <!--i:eti-home--> **[Abra uma ferramenta](#find-your-way-around)** Clique em um cartão da tela inicial. Os controles ficam ao lado de uma prévia ao vivo.
- <!--i:eti-sliders--> **[Altere as entradas](#change-what-the-tool-lets-you-change)** Apenas as entradas que o autor deixou abertas. Clique no design para encontrar seu controle.
- <!--i:eti-folder-plus--> **[Salve seu trabalho](#saving-continuing)** **Save** guarda o trabalho em My library, e Projects permite retomá-lo.
- <!--i:eti-link--> **[Compartilhe o design](#sharing-your-work)** Um link que carrega todas as entradas ou um arquivo `.lolly`.
:::

<!--i:eti-home-->
## Encontre o que precisa

::: figure using-app-map
Na tela inicial, há quatro abas na parte superior e uma barra no rodapé. Uma ferramenta aberta exibe os controles ao lado de uma prévia ao vivo.
:::

A parte superior da tela inicial tem quatro abas: **Tools**, **Utilities**, **Assets** e **Projects**. Tools reúne as ferramentas de criação. Utilities converte, verifica ou limpa um arquivo. Assets é sua biblioteca. Projects reúne o que você salvou.

A barra no rodapé reúne **Open**, **Settings**, um campo de busca, um atalho **Verify** para o Lolly Verify e **Docs**, que abre estes guias. A barra aparece em Tools, Utilities, Assets, Projects, Settings e nos guias dentro do app, e fica oculta quando você abre uma ferramenta. O [Lolly Search](/info/search.html) encontra suas ferramentas, trabalhos salvos, recursos e configurações por esse campo. O [Ask Lolly](/info/ask.html) responde à pergunta que você digita com a seção correspondente destes guias.

Clique em um cartão para iniciar um trabalho nessa ferramenta. Reabra os trabalhos salvos em **Projects**. Na primeira visita, uma faixa de boas-vindas no topo da galeria oferece uma ação para começar: **Start making** no Lolly Demo ou **Make it yours** para configurar seu próprio sistema de design.

![Um cartão da galeria com navegação entre exemplos e uma ação New](/t/url-shot?url=%2F%23%2F&width=1440&height=900&dpi=192&waitMs=1600&css=.welcome-dialog%2C.personalize-nudge%7Bdisplay%3Anone!important%7D&waitSelector=.gallery-view%5Bdata-shots-settled%5D&walker=1&format=svg&localize=1&dark=1&cropSelector=.gtile%5Bdata-tool-id%3D%22design%22%5D&filename=gallery&try=1)

Cada ferramenta tem uma visão dividida: **controles** de um lado e uma **prévia** ao vivo do outro. A prévia é atualizada quando você altera um controle, e o que aparece nela é o que será exportado.

![A visão dividida de uma ferramenta - a pilha de controles à esquerda e o gráfico de barras agrupadas que ela desenha ao vivo à direita](/t/url-shot?url=%2F%23%2Ftool%2Fchart%3Fct%3Dbar%26t%3DExample%2520data%26st%3DSample%2520values%252C%2520not%2520a%2520real%2520dataset%26d%3DMonth%252CSeries%2520A%252CSeries%2520B%252CSeries%2520C%250AJan%252C12%252C9%252C5%250AFeb%252C18%252C14%252C7%250AMar%252C24%252C17%252C11%250AApr%252C29%252C23%252C15%26lg%3D1&width=1440&height=900&dpi=192&waitMs=2500&walker=1&format=svg&dark=1&filename=vt-tool-split-view)

**Lolly Design** é a exceção: um canvas livre com caixas que você arrasta, redimensiona e preenche com texto, com barra superior, linha do tempo e controles de deck próprios. Seu guia é [Lolly Design: o canvas livre](/info/design.html).

<!--i:eti-sliders-->
## Altere o que a ferramenta permite

Uma ferramenta exibe apenas as entradas que podem variar. O autor definiu as cores, o layout, a tipografia e a lógica, então seu trabalho segue essas regras. As entradas incluem texto, controles deslizantes, seletores de cor, menus suspensos, datas, seletores de imagem e grupos de linhas repetidas. Algumas ficam em seções recolhíveis.

![A pilha de controles de uma ferramenta - um campo de texto, gatilhos de cor e um controle deslizante, sem nenhum dos outros elementos que o autor escolheu bloquear](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools&width=1440&height=900&dpi=192&waitMs=2500&cropSelector=%23tool-inputs&walker=1&format=svg&dark=1&filename=use-tool-inputs)

**Clique no design para encontrar seu controle.** Ao clicar em um elemento da prévia, seu controle recebe o foco e a área rola até exibi-lo. Em um grupo de linhas repetidas, a linha clicada se expande.

**Clear changes**, acima dos controles, restaura o valor padrão de todas as entradas.

**Opções do sistema de design.** Se o seu sistema de design oferece várias variações de cores, um visual claro e um escuro ou outra opção de tema, elas ficam na seção **Design system** abaixo dos controles. Uma opção só aparece se afetar esta ferramenta, por isso um utilitário de arquivos não exibe a seção. Cada variação de cores aparece como um ponto com suas próprias cores, claro e escuro são dois botões e as demais opções aparecem em listas.

Essa escolha vale para esta peça. Ela acompanha o link e a sessão salva. Todas as cores vinculadas ao sistema de design seguem a escolha, e as cores do próprio app permanecem iguais. No Lolly Design, as mesmas opções aparecem na aba **Canvas** do Inspector. Uma ferramenta cujas cores são seu conteúdo pode permanecer na variação de cores canônica e, nesse caso, não exibe os pontos de variação de cores. [Lolly Demo em uso](/info/lolly-demo-in-use.html#colourways-on-real-work) apresenta variações de cores em trabalhos reais. Para usar uma variação de cores no app e em cada nova peça, selecione-a em **Settings → Appearance** ([Escolher sua variação de cores](/info/colourways.html#make-a-colourway-your-own)).

### Dê zoom e desloque a prévia

- **Zoom:** Cmd/Ctrl com rolagem ou gesto de pinça no trackpad, com centro no ponteiro. No teclado, `0` ou `Shift+1` ajusta tudo à visualização, `1` ou `Shift+0` define 100% e `Shift+2` ajusta a seleção. `+` / `−` dão zoom em torno do ponteiro quando ele está sobre a área de edição; caso contrário, em torno do centro.
- **Deslocar:** mantenha **Space** pressionado e arraste ou use o botão do meio do mouse para arrastar. Cliques comuns continuam disponíveis para clicar nas partes do design.
- **Toque:** use pinça para o zoom, arraste para deslocar e dê dois toques para ajustar.
- **HUD de zoom:** pressione e segure o redemoinho do Lolly no canto para exibir `−`, **Fit** e `+`. Um toque breve no redemoinho continua abrindo o menu do perfil.

No Lolly Design, **Fit all** abrange as pranchetas e as camadas soltas. O zoom manual pode cair abaixo de 20% até que a página ocupe metade da visualização. O limite mínimo é o menor valor entre 5% da escala Fit comum e 2% de zoom absoluto.

Alterar o tamanho da saída sempre reajusta a visualização para caber.

![O HUD de zoom expandido a partir do redemoinho no canto do canvas - menos, Fit, mais e depois os alternadores de tema e som e a alça para movê-lo](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools&width=1440&height=900&dpi=192&waitMs=2500&css=.stage-nav%7Bopacity%3A1!important%7D&drive=drag%3A.stage-nav-profile%7Cdx%3D1%7Chold%3Bwait%3A700&cropSelector=.stage-nav&walker=1&format=svg&dark=1&filename=use-zoom-hud)

### Desfazer e refazer

**Cmd/Ctrl-Z** retrocede um passo e **Cmd/Ctrl-Shift-Z** (ou **Cmd/Ctrl-Y**) avança um passo. Os botões **Undo** e **Redo** ficam acima dos controles ou, no Lolly Design, na barra superior. Cada botão fica cinza quando não há mais passos disponíveis. Uma mensagem informa qual entrada foi restaurada a cada desfazer, com um botão **Redo**.

- **Um arrasto conta como um passo.** Alterações repetidas no mesmo controle dentro de meio segundo são agrupadas em um só passo.
- **Os últimos 100 passos ficam guardados.** Uma edição nova após desfazer limpa a pilha de refazer.
- **Em uma caixa de texto**, Cmd/Ctrl-Z atua no campo, caractere por caractere. Nos controles deslizantes, menus suspensos, cores e chaves, o Lolly assume.
- **Escolher um arquivo** em uma entrada de arquivo não conta como passo, pois esses bytes só são mantidos nesta sessão.

Em uma [colaboração](/info/collaborate.html) ao vivo, alterações do outro dispositivo nunca entram na sua pilha de desfazer. O histórico de desfazer dura até você sair da ferramenta ou recarregar. Para mudanças mais antigas, as ferramentas que salvam durante o trabalho guardam versões anteriores em **History** ([Voltar a uma versão anterior](/info/find-your-work.html#go-back-to-an-earlier-version)).

### Câmera ao vivo

Os efeitos da ferramenta **Filter** (Halftone, Scanline, Posterize, Voronoi, Duotone, Stretch, Misprint, Dither, ASCII art e Glitch) exibem o botão **Go live** quando há uma câmera disponível. Ative o botão para que o efeito acompanhe a webcam quadro a quadro. Uma exportação de movimento registra o resultado em GIF, WebM ou MP4. O processamento dos quadros acontece no seu dispositivo. A câmera é liberada assim que você interrompe a captura ou sai da ferramenta. Todo seletor de imagem também oferece **Take a photo** para capturar um único quadro.

<!--i:eti-folder-plus-->
## Salvar & continuar

Para manter seu trabalho, pressione **Save**, o visto junto de **Export** na pílula de renderização. Trabalhos novos ficam em **My library**, os já salvos são atualizados no mesmo lugar e nenhum arquivo é baixado. O painel de exportação oferece o mesmo botão **Save**.

Para definir o destino, pressione **Save as**, ao lado de **Download** no painel de exportação. Em **Save to a project**, mantenha **My library** selecionada ou escolha um projeto (**＋ New project…** cria um) e pressione **Save**. **Save as a template** salva o design como um [template](/info/templates.html), um ponto de partida para novos documentos. No Lolly Design, **Save as** fica no menu Lolly. No celular, pressione **•••**, depois **File menu** e então **Save as**.

![A pílula de renderização dividida em duas metades: Export, com uma seta para cima que abre o painel de exportação, e Save, com um visto que salva no mesmo lugar](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools&width=1440&height=900&dpi=192&waitMs=2500&css=%23tool-inputs%7Bdisplay%3Anone%7D&cropSelector=.render-pill&walker=1&format=svg&dark=1&filename=use-render-pill)

::: timeline
- <!--i:check--> Pressione **Save** na pílula de renderização ou **Save as** para escolher um projeto.
- <!--i:folder--> O item vai para **My library** ou para o projeto que você escolheu.
- <!--i:home--> Depois, pressione **Home** no canto superior esquerdo e abra a aba **Projects**.
- <!--i:document--> Abra o item. Todas as configurações estão de volta, prontas para alterar e exportar novamente.
:::

Os itens recebem o nome de arquivo que você digitou no painel de exportação ou, se não digitou nenhum, o nome da ferramenta, como **QR Code**. Um arquivo obtido por **Download** é uma cópia finalizada. Para alterá-lo depois, abra o item salvo em Projects.

::: note Os itens salvos ficam neste dispositivo
Os itens salvos na sua biblioteca pessoal ficam neste dispositivo, no navegador ou app em que você os salvou, a menos que ative o [Sync](/info/sync.html).
:::

Se algo não estiver onde você espera, [Encontre e recupere seu trabalho](/info/find-your-work.html) cobre todos os casos, de uma aba fechada à limpeza dos dados do navegador.

::: details Projetos de equipe com o Lolly Work (opcional)
Se a [sua organização usa o Lolly Work](/info/organisation.html), entre na instância dela e abra **Projects → Team projects** para ver as sessões compartilhadas com você. A organização define o acesso e a retenção, e o serviço Lolly Work dela armazena essas sessões. Quando a organização permite edição ao vivo, uma sessão compartilhada entra na colaboração ao vivo ao ser aberta. [Trabalhando juntos](/info/collaborate.html#collabs-through-lolly-work-optional) explica os passos.

Sua biblioteca pessoal continua separada. Entrar em outro dispositivo dá acesso ao trabalho da equipe. Os itens salvos na biblioteca pessoal ainda precisam do Sync ou de um backup para serem transferidos.
:::

<!--i:eti-link-->
## Compartilhar seu trabalho

Compartilhe um design como link ou arquivo. **Share** nos controles de exportação abre uma caixa de diálogo com as duas opções. **Share link** em uma sessão salva em Projects abre a mesma caixa de diálogo para essa sessão. Depois que você envia um arquivo para o Google Drive, Nextcloud, um bucket S3, Dropbox ou OneDrive, a caixa de diálogo também pode criar um link por esse serviço ([Exportar um arquivo](/info/exporting.html#how-export-works)).

::: cols
## Um link

- Leva todas as entradas no endereço, para que o link reproduza o design.
- Deixa de fora imagens e arquivos que você adicionou deste dispositivo, textos muito longos e listas muito grandes.
- Abre em qualquer navegador, para que você possa salvar o link nos favoritos, colá-lo ou incluí-lo em um commit.

## Um arquivo .lolly

- Leva a sessão salva com as imagens e os arquivos deste dispositivo, e também pode levar a ferramenta e o sistema de design.
- Deixa de fora a arte licenciada do catálogo, a menos que você escolha incluir os arquivos.
- Abre no Lolly: dê um clique duplo, use **Open** ou solte o arquivo no app.
:::

### O link

O link fica no topo da caixa de diálogo, com **Copy** e um botão **QR** que abre a ferramenta QR Code com o link. Abaixo dele, **Link options** oferece:

- **Open in the installed app** muda o link para um endereço `lolly://` para Shortcuts, inicializadores e automação, sem alterar nenhum parâmetro.
- **Shortest link** compacta um design longo em um token curto e mostra a economia de caracteres. A forma legível continua disponível.
- **Password-protect this link** criptografa o link no seu dispositivo com AES-256. A senha nunca faz parte do link.
- **Pin this tool version** adiciona a flag `_v`, para que uma atualização posterior da ferramenta não altere o que o link renderiza.
- **When the recipient opens the link…** permite escolher tela cheia, o painel de exportação já expandido, um download ao abrir (`&export`) ou uma cópia para a área de transferência (`&copy`).
- **Copy credit** copia uma legenda "Feito com Lolly" com o link, para uma publicação ou um slide.

Quando uma ferramenta contém campos pessoais, como seu nome, **Review personal fields** mantém cada um fora do link até você marcá-lo. [Modo URL](/info/url-mode.html) cobre tudo o que um link pode levar.

**A caixa de diálogo informa o que um link não pode levar.** Ao criar o link, o Lolly conta tudo o que não cabe em um endereço. Se algo foi deixado de fora, a caixa de diálogo lista esses itens e indica a opção de arquivo. Um link que apenas é longo recebe um aviso mais leve com sua contagem de caracteres.

**Algumas ferramentas fazem do link o produto inteiro.** O Jump Page reúne seus links em uma página para distribuir: um link de bio, uma palestra ou uma vitrine. A página é o link, então nada é hospedado e não há uma conta por trás dela. Quem visita vê a página em toda a largura, com um link por cena à medida que rola.

![Jump Page no editor: a cena do título no topo da página, com as cenas dos links abaixo](/t/url-shot?url=%2F%23%2Ftool%2Fjump%3Ffull%26heading%3DFind%2520us%2520everywhere%26subheading%3DOne%2520link%2520for%2520everything.%26links%3DURL%252CName%252CEmoji%257Ehttps%25253A%25252F%25252Fexample.com%252CWebsite%252C%257Ehttps%25253A%25252F%25252Fexample.com%25252Fnews%252CNewsletter%252C%257Ehttps%25253A%25252F%25252Fexample.com%25252Fhello%252CSay%252520hello%252C&width=900&height=1300&dpi=96&waitMs=2000&cropSelector=%23tool-canvas&walker=1&format=svg&dark=1&filename=use-jump-page)

::: details Links gerenciados pela organização com o Lolly Work
Para compartilhamentos que precisam de expiração, revogação ou senha, o Lolly Work oferece links gerenciados para sessões compartilhadas, ferramentas e recursos do catálogo. Eles são resolvidos pelo serviço da organização e seguem suas regras de acesso. São separados dos links autocontidos acima. Revogar um deles não recupera um arquivo que alguém já baixou. [Renderização e compartilhamento](/info/manage/sharing.html) lista os tipos de link e as permissões.
:::

### O arquivo .lolly

**Download .lolly**, na seção **Editable file** da caixa de diálogo Share, grava o design atual em um único arquivo. A arte comum do catálogo é incluída junto com as imagens e os arquivos deste dispositivo. Um arquivo desatualizado ou indisponível permanece como referência externa. Antes de salvar, a caixa de diálogo mostra o tamanho do arquivo, quantos arquivos ele incorpora, quantos referencia e se a ferramenta está incluída. Se o dispositivo tem um painel de compartilhamento, **Send to…** entrega o arquivo a esse painel (AirDrop, um compartilhamento do Android).

**Download project (.lolly)**, no menu de uma pasta em **Projects**, grava uma pasta inteira, para que outra pessoa possa continuar com todas as sessões dela. As sessões em lote ficam de fora, e o aviso informa quantas são. **Download originals**, no mesmo menu, grava um zip simples com cada item em seu próprio arquivo.

Antes de enviar um arquivo, você decide três coisas:

- **Se seu nome será incluído.** Seu nome, e-mail e organização só são gravados quando **Use my details to create** está ativado no [seu perfil](/info/profile.html). Com essa opção desativada, o arquivo registra apenas que foi feito com o Lolly e quando.
- **Se a arte retida será incluída.** Arte licenciada e arte restrita à marca ficam de fora por padrão, assim como uma obra do catálogo cuja licença registrada o Lolly ainda não consegue ler. Se o design usa alguma delas, a caixa de diálogo informa quantas são e oferece *Download without them* ou *Include and download*. Incluí-las entrega os arquivos a quem abrir o `.lolly`. Uma obra do catálogo sem registro de direitos é incluída, e a caixa de diálogo lista cada uma para você conferir antes de enviar. O `CREDITS.txt` do arquivo lista o que foi incluído e o que ficou de fora, com o motivo. [Direitos criativos e créditos](/info/creative-rights.html) explica as regras.
- **Se a ferramenta será incluída.** **Include the tool** empacota os arquivos da própria ferramenta, para que o design abra em um dispositivo sem ela. A opção vem marcada para uma ferramenta personalizada, como um fork, e desmarcada para uma ferramenta listada no catálogo assinado. Em uma versão sem catálogo assinado, toda ferramenta é considerada personalizada.

**Abrir um arquivo.** Nos apps para desktop e celular, dê um clique duplo ou toque em um `.lolly`, escolha **Open with Lolly** ou envie-o para o Lolly pelo painel de compartilhamento. No app web, pressione **Open** ou solte o arquivo no Lolly. Cada caminho lê primeiro o manifesto do arquivo e mostra seu tamanho, conteúdo e o que vai acontecer, antes de gravar qualquer coisa.

::: warning Instalar uma ferramenta executa o código dela
Se o arquivo inclui uma ferramenta que você não tem, **Trust this tool?** mostra a ferramenta e seu autor e avisa que abri-la executa o código dela no seu dispositivo. **Trust & install** prossegue.
:::

Se você recusar, o trabalho ainda é salvo em Projects e aguarda até que você adicione a ferramenta. Uma ferramenta cujo código é distribuído como módulo ainda não pode ser instalada dessa forma e é recusada do mesmo jeito.

::: details O que um .lolly contém e como funciona sua abertura
`.lolly` é a extensão dos pacotes do Lolly, e o `format` em seu `manifest.json` informa o que há dentro:

- Um **design compartilhado** (`lolly-share`) contém uma sessão salva, seus arquivos incorporados e um recibo de tudo o que ainda é resolvido por referência. Também pode levar a ferramenta e o sistema de design. Abri-lo adiciona um novo projeto e nunca sobrescreve uma sessão.
- Um **projeto compartilhado** (`lolly-share`, tipo `project`) contém uma pasta de Projects: suas subpastas, todas as sessões nelas com seus cartões e as imagens arquivadas ali. Abri-lo adiciona uma cópia da pasta. Cada sessão é incluída como `sessions/<key>.json`, com seu cartão em `thumbs/`. Uma versão do Lolly anterior à existência dos arquivos de projeto pede que você atualize.
- Um **pacote de sistema de design** (`lolly-brand`) contém tokens e pode conter fontes, logotipos, versões publicadas e recursos retidos. Abrir o pacote adiciona um sistema de design separado e nomeado e o torna ativo.
- Um **pacote de espaço de trabalho ou instância** é um `lolly-brand` com ferramentas declaradas, recursos do catálogo e, opcionalmente, um endereço de instância. Carregá-lo substitui a única camada de espaço de trabalho carregada antes, e a prévia lista esses efeitos em todo o dispositivo.

Um backup completo do dispositivo não é um `.lolly`. Ele continua sendo um `LollyTools-….zip` (formato `lolly-backup`) e é restaurado por **Settings → Storage → Import data…**. Uma pasta de ferramenta compactada também continua sendo um `.zip`. [Transferência de dados](/info/data-transfer.html) é a referência dos formatos.

Um `.lolly` é um zip comum. Renomeie-o para `.zip` para ver o conteúdo. Suas próprias imagens ficam em `assets/uploads/` e a arte do catálogo em `assets/catalog/`. O `manifest.json` lista todos os arquivos, e um README explica o que é o arquivo.

macOS, Windows, Linux, iOS e Android registram o formato. Os gerenciadores de arquivos de desktop mostram o arquivo como um documento do Lolly, e o GNOME Files pode mostrar a miniatura da própria sessão salva. Abrir pelo Lolly Design System Setup recomenda a ação de sistema de design quando um design compartilhado contém um, mas nunca oculta **Open shared design**.

No iOS ou Android, um documento recebido de outro app tem um limite de 48 MB, e o app avisa sobre isso. A transferência copia os bytes entre os apps. **Open** dentro do Lolly não tem esse limite, então use essa opção para um pacote maior.

Depois que você confirma, o Lolly descompacta e verifica o pacote uma única vez. Os recursos vão para sua biblioteca, comparados por soma de verificação para reutilizar um arquivo que já esteja no dispositivo. As sessões vão para Projects com novos ids, para que o mesmo arquivo possa ser aberto duas vezes. Uma sessão cuja ferramenta está ausente fica lá aguardando. Arquivos acima de 100 MB são identificados como grandes, e a prévia avisa quando o armazenamento do navegador informa menos espaço livre do que o arquivo precisa. Todas as partes cobertas pela verificação de integridade são conferidas antes de qualquer gravação definitiva, e uma cópia danificada é recusada sem deixar nada para trás.
:::

Tanto um link quanto um arquivo entregam uma cópia do estado atual. Para edição ao vivo, [Trabalhando juntos](/info/collaborate.html) cobre colaborações privadas entre dois dispositivos e colaborações de trabalho opcionais pelo Lolly Work.

<!--i:eti-images-->
## Recursos - sua biblioteca

**Lolly Assets** (`#/a`) contém o que suas ferramentas podem usar: logotipos da marca, imagens, áudio e movimento, agrupados por tipo, e seus próprios arquivos. Seus uploads ficam armazenados no dispositivo. Uma organização que usa o Lolly Work também pode fornecer um catálogo compartilhado sob suas próprias regras de acesso ([Use o Lolly na sua organização](/info/organisation.html)).

![Assets, com as amostras de cores e as fontes da marca e seus próprios uploads](/t/url-shot?url=%2F%23%2Fa%3Fsection%3Dswatches%2Cfonts&width=1440&height=900&dpi=96&waitMs=2400&css=.plat-swatch-grid~%2A%7Bdisplay%3Anone%7D&walker=1&format=svg&localize=1&dark=1&filename=assets)

- <!--i:upload--> **Importe seus arquivos.** Solte uma imagem, SVG, clipe de áudio, vídeo, Lottie, PDF ou deck do PowerPoint na área de upload ou clique para escolher. O arquivo aparece na hora em Assets e no seletor de recursos de todas as ferramentas. Um PDF com várias páginas ou um `.pptx` pergunta quais páginas ou slides manter, e cada um vira um recurso SVG. Uma imagem que você adiciona dentro de uma ferramenta é mantida sem alterações em **My images**, para que a Content Credential dela continue verificável. Só um arquivo muito grande pergunta se você quer redimensioná-lo. **Settings → Storage** mostra quanto **My images** armazena. Não há limite além do armazenamento do dispositivo. Para remover dados EXIF e GPS no upload, ative **Strip metadata from uploads** em **Settings → Feature flags**. As Content Credentials são mantidas em ambos os casos.
- <!--i:star--> **Favorite o que você usa com frequência.** Marque um recurso ou uma amostra de cor da marca com uma estrela para fixá-lo no topo de todos os seletores.
- <!--i:folder--> **Organize.** Mova um recurso para outro grupo, oculte um recurso compartilhado da marca que você não usa (**Show hidden** o traz de volta) ou exclua seus próprios uploads. A mesma barra de seleção de Projects atua sobre toda a seleção.
- <!--i:layers--> **Separe um vídeo do fundo.** Abra os detalhes de um vídeo ou clique com o botão direito no cartão dele em um seletor de recursos e escolha **Remove background…**. Um **On-device model** recorta o sujeito de uma cena com muitos elementos. Uma **Colour key** remove um fundo com iluminação uniforme, como uma tela verde, e não precisa de download. **Tolerance**, **Softness** e **Spill removal** ajustam a borda. **Resolution** (360, 480, 720 ou 1080p, nunca acima da origem) troca detalhe por velocidade. O recorte é um WebP ou PNG animado com transparência, salvo ao lado do original. A Content Credential da origem acompanha o recorte como ingrediente. [Gerado uma vez, renderizado da mesma forma](/info/ai-features.html) explica por que isso continua sendo uma edição comum.

### Leve sua paleta e suas fontes para qualquer lugar

O painel **Swatches** em Assets mostra as cores da sua marca: as cores da marca, as que você adicionou, suas escalas e seu espectro. As cores de função que o Lolly mantém para a interface (texto, superfícies, bordas, cores principais das variações de cores e cópias de uma cor da marca com outro nome) ficam atrás de um cartão cinza **Show colour roles** no rodapé do painel.

Cada cor é um cartão como qualquer outro recurso. Clique em uma para abrir os detalhes, selecione algumas para baixá-las ou baixe a paleta inteira no formato que sua outra ferramenta lê:

- <!--i:code--> **Design tokens (JSON)**, **CSS variables** ou **CSS classes**, para uma folha de estilos ou um build. Uma cor com gama além de sRGB mantém seu valor de gama ampla: o CSS o define depois do hex, e o JSON mantém o hex junto com a cor de gama ampla, a composição CMYK e a tinta especial.
- <!--i:palette--> **Adobe Swatch Exchange (.ase)**, para Illustrator ou Photoshop. Uma cor vinculada a uma composição CMYK chega como essa amostra CMYK, uma tinta especial como uma amostra especial nomeada e uma cor com gama além de sRGB como Lab.
- <!--i:pentool--> **GIMP palette (.gpl)**, para GIMP ou Inkscape, e **SCSS variables**, ambos em sRGB.

![O painel Swatches - os cinco botões de download da paleta no topo, depois cada cor da marca como um chip que abre seus detalhes](/t/url-shot?url=%2F%23%2Fa%3Fsection%3Dswatches&width=1440&height=900&dpi=96&waitMs=1800&css=.cat-group%3Anot%28%5Bdata-group%3Dswatches%5D%29%7Bdisplay%3Anone%7D&cropSelector=%5Bdata-group%3Dswatches%5D&walker=1&format=svg&dark=1&filename=use-swatch-downloads)

::: details Selecione várias cores ou abra os detalhes de uma cor
Selecione cores pelo ponto de cada cartão: clique em um segundo ponto com Shift para selecionar tudo entre os dois, arraste uma caixa pelos espaços vazios ou pressione Cmd/Ctrl+A com um cartão em foco. A barra oferece **Download as…** nos mesmos seis formatos, **Copy hex** e **Favourite**. Antes de você escolher um formato, o menu lista as cores que nenhum formato pode conter (Transparent não tem cor), quais formatos salvam uma cor de gama ampla como sua alternativa sRGB (SCSS e GIMP) e quais levam os valores CMYK e de tinta especial (JSON e .ase). Clique com o botão direito em um cartão para ver as mesmas ações para uma cor.

Os detalhes de uma cor preenchem a prévia com a cor e expandem **Linked values** (sua composição CMYK ou tinta especial, qualquer valor criado para um espaço ou uma impressora específicos e seu token de design), **Every notation** (hex, OKLCH, Display-P3 e as demais, cada uma com um botão de cópia), **Plotted on a colour space**, **Tones** e **Readability**. As teclas de seta percorrem a paleta, **Copy link** compartilha a cor e **Open in Colour Lab** abre a cor para continuar o trabalho.
:::

O painel **Fonts** lista as fontes da sua marca com um **download** para cada uma, para instalar localmente ou entregar a uma gráfica.

<!--i:eti-grid-->
## Deixe a grade do seu jeito

- <!--i:star--> **Favorite o que você usa.** Clique com o botão direito em um cartão e escolha **Add to favourites**. A ferramenta ganha um cartão grande em uma faixa acima da grade. [Seus favoritos](/info/favourites.html) explica a faixa.
- <!--i:eyeoff--> **Oculte uma ferramenta que você nunca usa.** Clique com o botão direito em um cartão ou selecione vários e escolha **Hide tool**. Ela sai da grade e dos resultados encontrados ao digitar na grade. A ferramenta deixa a grade e não aparece mais nas buscas feitas ao digitar nela. Um cartão cinza **Show hidden tools (N)** no final mostra novamente as ferramentas ocultas, esmaecidas, cada uma com **Unhide tool** no menu. Ocultar muda apenas sua grade: a ferramenta ainda abre por um link ou favorito.
- <!--i:clock--> **Suas ferramentas primeiro.** Depois que você salva trabalho em três ferramentas diferentes, uma linha de chips **Yours** acima da grade começa com seus favoritos e suas ferramentas recentes.
- <!--i:sliders--> **Organize à sua maneira.** **View options** define o layout (**Grid**, **Card** ou **List**), o tamanho e a densidade dos cartões, a ordem de classificação e um filtro de categoria.

![O final da grade Tools com as ferramentas ocultas reveladas: o cartão Wordmark esmaecido e, ao lado, o cartão cinza que o trouxe de volta à vista, agora com o texto Hide hidden tools](/t/url-shot?url=%2F%23%2F&width=1440&height=680&dpi=192&waitMs=1600&css=.welcome-dialog%2C.personalize-nudge%7Bdisplay%3Anone!important%7D&drive=click%3A.gtile--hiddenbox%3Bpress%3AEnd%3Bwait%3A800%3Bhover%3A.gtile--hiddenbox%3Bwait%3A300&waitSelector=.gallery-view%5Bdata-shots-settled%5D&walker=1&format=svg&rasterDpi=96&dark=1&filename=misc-hidden-tools)
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

**Aplique ações a vários cartões de uma vez.** Marque a caixa de seleção de cada cartão, arraste uma caixa de seleção pelo espaço vazio ou clique com Shift/Cmd, e uma barra aparece com as ações permitidas nessa visualização:

- **Tools e Utilities:** Favourite, Hide, Available offline, **View sessions** (Projects, mostrando apenas as sessões feitas com essas ferramentas) e Copy link para um único cartão.
- **Assets:** Favourite e Hide para qualquer seleção. Duplicate, Download e Delete aparecem apenas quando todos os itens selecionados são uploads seus, porque um recurso compartilhado do sistema de design é um contrato permanente.
- **Projects:** veja [Encontre e recupere seu trabalho](/info/find-your-work.html#find-something-you-saved).

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

**View sessions** aparece apenas quando há algo selecionado. Clique com o botão direito em um único cartão não selecionado para ver **N saved sessions**: uma lista das sessões salvas dessa ferramenta, em que excluir move uma sessão para a Lixeira.

<!--i:eti-layers-->
## No celular

Em uma tela estreita, o layout passa a ter uma coluna:

- Os **controles viram um painel** no topo, com uma alça de arraste na borda inferior. Arraste a alça para encaixar em **recolhido**, **metade** ou **inteiro**, ou toque nela para recolher e expandir. A prévia preenche o espaço abaixo e continua visível enquanto você edita.
- Um botão flutuante **Export** abre o painel de exportação: formato, tamanho, copiar, salvar e baixar. Toque no fundo para fechar o painel.

![Uma ferramenta em uma tela com largura de celular - controles em um painel no topo, a paleta gerada preenchendo a prévia abaixo e a pílula de renderização flutuando no centro inferior](/t/url-shot?url=%2F%23%2Ftool%2Fcolor-palette%3Fseed%3Df97316%26harmony%3Dadjacent-3%26steps%3D9&width=430&height=900&dpi=192&waitMs=2200&walker=1&format=svg&dark=1&filename=vt-phone-palette)

<!--i:eti-copy-->
## Dobráveis e iPhone Duo

Em um dobrável, um iPhone Duo ou uma tela de toque quase quadrada, o Lolly organiza a ferramenta em dois painéis:

- **Controles de um lado, canvas do outro.** Os controles ficam longe da mão com que você desenha. Escolha **Dominant hand** em **Settings → Accessibility** ou pressione **Swap sides** no topo dos controles. Em um idioma da direita para a esquerda, os lados se invertem.
- **O divisor é a dobradiça.** Quando o dispositivo informa a posição da dobra, os painéis se encontram nela, para que nenhum controle ou arte fique sobre o vinco. Em uma tela contínua, arraste o divisor para um terço, metade ou dois terços da largura. O Lolly lembra sua escolha para cada visualização neste dispositivo.
- **Sobre a mesa.** Com o dispositivo entreaberto e a dobra atravessando a tela, o canvas ocupa a metade superior e os controles ficam abaixo da dobra. Ao apresentar, o slide fica no topo, com suas notas, o próximo slide e **Back** e **Next** abaixo. No Sequence, a prévia fica em cima e a linha do tempo embaixo.
- **Lolly Design, Design System Setup e Assets.** No Lolly Design, o Inspector, as camadas e o painel de exportação ficam em abas ao lado do canvas. As ferramentas ficam ao longo da borda externa do canvas, sob a mão com que você desenha. Quando as ferramentas não cabem, a coluna rola e um esmaecimento com uma seta mostra em que direção estão as demais. Sobre a mesa, as ferramentas ficam na parte inferior do canvas. O Lolly Design System Setup mantém o Board de um lado e a sala que você abre do outro. Em Assets, os detalhes de um recurso abrem ao lado da biblioteca, para que o próximo toque mostre o próximo recurso no mesmo lugar.
- **Nada sobre o vinco.** Quando uma dobra é informada, a caixa de diálogo abre na página que contém os controles. O mesmo acontece com a caixa de busca no rodapé da tela inicial e seus resultados. Uma tela plana os mantém no meio.
- **Dobrar não perde nada.** Dobrar, desdobrar ou girar o dispositivo mantém seu documento, sua seleção, o zoom e o campo em que você estava digitando, com o cursor no lugar.

A tela externa de um dobrável mantém o layout de celular descrito acima, assim como uma janela do Lolly em uma metade de uma tela dividida.

<!--i:eti-smile-->
## Configurações, som e conforto

**Settings**, no rodapé da tela inicial, reúne seus dados, seus sistemas de design, acessibilidade, armazenamento e downloads para uso offline. [Configurações do Lolly](/info/dashboard.html) apresenta todas as abas.

- **Seus dados e sua foto de perfil** preenchem qualquer ferramenta feita para usá-los, como uma assinatura de e-mail ou um crachá. [Perfis](/info/profile.html) explica esses dados.
- **Accessibility** tem quatro opções de conforto: **Reduce motion**, **Hide colourful previews**, **High contrast** e **Large text**. Elas mudam o app ao redor do seu trabalho, nunca o canvas de uma ferramenta ou uma exportação. Ao lado delas, **Dominant hand** escolhe em qual lado ficam os controles em dois painéis.
- **Sound** reproduz sons suaves de auxílio para suas ações, e **Neurospicy Mode** toca uma faixa calma para concentração. Ambos ficam desativados até você ativá-los em **Settings → Accessibility** ou no menu do perfil. O controle deslizante **Sound shape** abaixo da opção Sound muda os sons de gotas suaves e arredondadas (Bouba) para estalos secos e arranhados (Kiki), com os sinos do Lolly no meio. As faixas do Neurospicy incluem as estações geradas do Lolly: **Lolly Sings** e seus gêneros, e três **Lofi stations**. As estações criam música sem fim durante a reprodução. Cada uma tem controles de bateria e textura (e clima, no Lofi), um link para compartilhar a música que você está ouvindo e um botão que salva a música nos seus recursos. [Música gerada](/info/generated-music.html) explica como uma música é feita. **Music generator** em Utilities (`#/music`) permite criar uma do seu jeito.
- **Available offline** baixa o restante do app, suas ferramentas, o catálogo e os guias antes de você perder a conexão. Para instalar o Lolly como app web, use o botão de instalação do navegador ou *Add to Home Screen* no celular. O app instalado roda em tela cheia e se atualiza quando você volta a ficar online.
- **Performance UI**, em **Settings → Feature flags**, dá ao app um visual mais simples que exige menos recursos para desenhar. Os canvas das ferramentas e as exportações continuam iguais. Em um dispositivo lento, o Lolly ativa esse visual por conta própria e explica o motivo, com **Undo** e **Keep** ([Performance UI](/info/configuration.html#curating-what-people-see)).
- **Storage** mostra o que o Lolly mantém neste dispositivo. [Se você limpar os dados do navegador](/info/find-your-work.html#if-you-clear-your-browser-data) explica o que a limpeza remove, e a [Política de Privacidade](/info/privacy.html) lista tudo o que o app busca ou envia.

::: note Se uma visualização não carregar após uma atualização
Um painel vazio ou uma mensagem "failed to fetch" logo após uma atualização costuma se resolver com uma recarga. Seus trabalhos salvos, sessões e sistemas de design permanecem intactos porque estão armazenados no dispositivo. Só uma imagem que você adicionou e nunca salvou pode precisar ser adicionada novamente.
:::

<!--i:eti-map-pin-->
## Para onde ir agora

- **[Lolly Design: o canvas livre](/info/design.html)**: o canvas, as formas, a linha do tempo e a apresentação de um deck.
- **[Lotes e Lolly Multi-edit](/info/batch.html)**: muitas versões de um design ou vários designs salvos editados juntos.
- **[Exportar um arquivo](/info/exporting.html)**: escolher formato, tamanho, unidades de impressão, transparência e vídeo.
- **[Importar um design](/info/design-import.html)**: importe um arquivo do Figma, Penpot, Illustrator, InDesign, Affinity ou DXF para o Lolly Design e continue editando.
- **[Templates](/info/templates.html)**: pontos de partida salvos para uma ferramenta.
- **[Cores de gama ampla e HDR](/info/hdr-editing.html)**: mantenha a precisão original das imagens no Lolly Design e no Lolly Darkroom.
- **[Encontre e recupere seu trabalho](/info/find-your-work.html)**: onde tudo está e como mover para outro dispositivo.
