# Encontre e recupere seu trabalho

Encontre um design que você nunca salvou, um arquivo que baixou, a versão da semana passada ou seu trabalho depois que o navegador foi limpo. Comece pela tabela.

O trabalho pessoal fica no navegador ou app em que você o criou, naquele dispositivo, a menos que você ative o [Sync](/info/sync.html). Uma organização que usa o Lolly Work opcional também mantém **Team projects** no servidor dela.

| O que você fez | Onde procurar |
|---|---|
| Pressionou **Save as** ou **Save** | **Projects** |
| Pressionou **Download** | Os downloads do seu navegador e uma cópia em **Assets** |
| Nenhum dos dois, em uma [ferramenta que salva enquanto você trabalha](#which-tools-save-as-you-work) | **Projects** e **History** |
| Nenhum dos dois, em uma ferramenta que não salva | Apenas a aba em que você trabalhou, até fechá-la |
| Apagou no app | **Trash**, em **Projects**, **Assets** ou **Settings → Storage**, por 30 dias |

::: figure find-your-work-places
Onde seu trabalho fica: o armazenamento do próprio navegador guarda Projects, History e Trash; os downloads vão para as pastas do seu dispositivo; o Sync e um arquivo de backup são as cópias fora do navegador.
:::

::: details Encontre trabalho compartilhado no Lolly Work (opcional)
Abra o Lolly da sua organização, entre e procure em **Projects → Team projects**. Essa instância contém sessões compartilhadas e mostra aquelas às quais você tem acesso. Entrar em outro dispositivo pode restaurar o acesso a essas sessões. Entrar não restaura sua biblioteca pessoal nem o backup do dispositivo.

Em uma [colaboração de trabalho](/info/collaborate.html#collabs-through-lolly-work-optional), espere por **Saved to work** antes de sair. Se um projeto compartilhado não aparecer, confira se você está conectado à instância certa e pergunte ao operador sobre acesso ou retenção. Limpar os dados do navegador remove as cópias locais, sem remover a cópia no servidor da organização. Veja [Use o Lolly na sua organização](/info/organisation.html).
:::

<!--i:eti-search-->
## Encontre algo que você salvou

1. Pressione **Home** no canto superior esquerdo da ferramenta.
2. Abra a aba **Projects** no topo da tela inicial (o ícone de pasta no celular).
3. Tudo o que você salvou em **My library** está na primeira tela. Cada projeto é uma pasta. Para pesquisar em todas as pastas, digite em **Search all projects…** no rodapé da tela.

Um item recebe o nome de arquivo que você digitou no painel de exportação. Sem um nome de arquivo, recebe o nome da ferramenta, como **QR Code**. Abrir o item restaura todas as configurações. Para salvar um trabalho novo, veja [Salvando & continuando](/info/using.html#saving-continuing).

::: note Não está em Projects?
- Pode estar em **Trash**: veja [Recupere algo que você apagou](#get-back-something-you-deleted).
- Outro navegador, uma janela privada ou outro dispositivo começa vazio, a menos que você use o [Sync](/info/sync.html) ou [transfira seu trabalho](#move-your-work-to-another-device).
- Se você só pressionou **Download**, veja [Encontre um arquivo que você baixou](#find-a-file-you-downloaded).
:::

::: details Trabalhando com Projects
Você também pode abrir a tela **Projects** em **Settings → Storage → Saved sessions → Organise in Projects**. Ela funciona como um gerenciador de arquivos:

![Projects antes de salvar qualquer coisa: os blocos New folder, New asset e Templates, o relógio de History no canto superior direito e a barra Search all projects no rodapé](/t/url-shot?url=%2F%23%2Fp&width=1440&height=900&dpi=192&waitMs=1200&walker=1&format=svg&localize=1&dark=1&filename=projects)
<!--
SHOT NOTE (projects): build-docs-shots.ts gives every shot a fresh browser
context with no storage seeding, so this frame is always the empty Projects
root. The alt says so. Revisit (and re-caption) if the pipeline gains a
storage-seeding hook.
-->

- <!--i:folder--> **Pastas dentro de pastas.** Coloque sessões salvas em pastas e pastas dentro de pastas, em qualquer profundidade. Crie ou renomeie uma pasta, ou arraste um bloco para uma pasta para movê-lo. Uma trilha de navegação leva você de volta aos níveis anteriores. Sessões salvas sem pasta ficam na raiz de **Projects**.
- <!--i:clock--> **Ordene do seu jeito.** **View options**, o botão de controles deslizantes no canto superior direito, oferece **Grid** ou **List** e ordena por **Name**, **Date added**, **Last modified** (o padrão), **Size** e, dentro de uma pasta, **By tool**. As pastas sempre vêm primeiro. Sessões e pastas são ordenadas dentro dos respectivos grupos.
- <!--i:document--> **Guarde trabalhos novos diretamente.** **New asset** abre o seletor compartilhado. Escolha **Templates** para começar com um template salvo. Abra o template para editar ou pressione **+ Add** para salvar uma criação nova na hora.
- <!--i:checklist--> **Seleção múltipla (desktop).** Marque a caixa de seleção de um bloco, arraste uma caixa de seleção sobre uma área vazia ou use **Shift/Cmd-click**. Para abrir o menu de contexto de um bloco, **clique com o botão direito** nele. A barra de seleção oferece **Render selection**, **Move to…**, **New folder** e **Delete** (para Trash). **Edit together** abre de duas a oito sessões de ferramenta única lado a lado, com uma só barra lateral. **Edit as sheet** abre uma seleção de qualquer tamanho ou combinação como linhas na grade de processamento em lote.
- <!--i:download--> **Renderize uma pasta ou seleção inteira.** **Render folder** exporta cada sessão salva em uma pasta e suas subpastas como um único `.zip` com a mesma hierarquia. **Render selection** faz o mesmo com uma seleção múltipla. Uma sessão única é renderizada em seu próprio arquivo.
- <!--i:link--> **Vá direto ao trabalho salvo de uma ferramenta.** Marque uma ou mais ferramentas na galeria Tools e escolha **View sessions** na barra de seleção. Projects passa a mostrar apenas as sessões feitas com essas ferramentas. **Clear** restaura a visualização completa.
- <!--i:link--> **Compartilhe uma sessão salva.** Clique com o botão direito em uma sessão (no celular, pressione **•••** no bloco dela) e escolha **Share link**. O link reabre a sessão com as mesmas configurações. Imagens do seu dispositivo não viajam com um link. Para a caixa Share completa, veja [Compartilhando seu trabalho](/info/using.html#sharing-your-work).
- <!--i:pentool--> **Renomeie ou copie uma sessão.** O mesmo menu tem **Rename**, **Duplicate** (uma cópia na mesma pasta) e **Move to…**.

![O popover View options em Projects: Layout com Grid e List e Sort by definido como Last modified, ao lado de um botão que inverte a ordem](/t/url-shot?url=%2F%23%2Fp&width=900&height=700&dpi=192&waitMs=1400&drive=click%3A.projects-viewopts&cropSelector=.projects-viewmenu&walker=1&format=svg&dark=1&filename=misc-projects-sort)
<!--
SHOT NOTE (misc-projects-sort): trigger button confirmed as
`.filter-fab.projects-viewopts` in views/projects.ts (openViewOpts() is bound
to `.projects-viewopts` specifically) - `.projects-viewopts` alone is the
more specific hook, so that's what drives the click. The popover it opens
(`.projects-viewmenu`, also confirmed directly in openViewOpts()) is body-
appended, not nested under the Projects root, so cropSelector finds it
regardless. "By tool" only appears inside a folder - this recipe captures at
the Projects ROOT (`url=/#/p`), so if the capture pass wants "By tool"
visible too, point url= at a real folder instead: the route is a path
segment, `/#/p/<folderId>` (confirmed in main.ts's hash router - `parts[0]
=== 'p'` reads `folderId` from `parts[1]`), not a query param. Caveat: a
folder has to already EXIST in the capture profile, which a per-shot fresh
context has none of.
The popover (views/projects-view-options.ts, checked 2026-09-26) holds a
Layout pair (Grid / List) and a Sort by menu with a reverse button; the
options inside the menu (Name, Date added, Last modified, Size, By tool) are
not visible in the closed menu, so the alt does not list them.
-->

:::

<!--i:eti-refresh-->
## Se você fechou a aba ou saiu da ferramenta

O que volta depende de como você saiu e da ferramenta:

- **Você fechou a aba ou voltou em outro momento.** O trabalho não salvo se perde, exceto nas [ferramentas que salvam enquanto você trabalha](#which-tools-save-as-you-work). Abra esse trabalho em **Projects**.
- **Você recarregou a página na mesma aba.** Suas configurações voltam pelo endereço da página. Nas ferramentas que não salvam enquanto você trabalha, o endereço não guarda imagens e arquivos do seu dispositivo nem texto de uma linha com mais de 150 caracteres, então eles não voltam.
- **Você pressionou Home ou o botão de voltar no canto superior esquerdo.** Se você mudou algo desde a última vez que salvou, baixou ou copiou, uma caixa **Unsaved edits** pergunta se quer salvar antes. **Save & leave** salva o trabalho e leva você a **Projects** ou de volta à pasta do projeto de onde abriu o trabalho. **Leave anyway** descarta suas alterações. Um item salvo volta ao último salvamento, e uma criação que você nunca salvou sai de **Projects**. **Cancel** mantém você na ferramenta.

::: warning Fechar a aba não pede confirmação
Fechar a aba, recarregar e usar o botão Voltar do próprio navegador nunca pede confirmação. Para garantir, pressione **Save as** ou **Save** no painel de exportação antes de sair de uma ferramenta.
:::

Quando a recuperação automática não está disponível, uma nota ao lado dos controles de edição diz o que guardar:

- Em uma ferramenta que trabalha com um arquivo que você traz, salve suas configurações e guarde também os arquivos originais.
- Em uma ferramenta de gravação ou um utilitário sem a ação Save, salve ou baixe o resultado antes de sair.
- Os apps para desktop e celular avisam quando você precisa salvar manualmente.
- Em uma colaboração privada, a pessoa que convidou guarda o documento e seu histórico, incluindo as alterações da outra pessoa. A pessoa que entrou trabalha em uma cópia temporária e deve salvar uma cópia separada antes que a sessão termine.

::: note Saiu sem salvar por engano?
Nas ferramentas que salvam enquanto você trabalha, History guarda uma cópia das edições descartadas por 30 dias. Abra a página **History**, encontre-as em **Changes** e pressione **Open as a copy**. Nas outras ferramentas, as alterações se perdem.
:::

::: details Quais ferramentas salvam enquanto você trabalha
No app web, toda ferramenta que cria um documento salva enquanto você trabalha, como Lolly Design, Lolly Chart, QR Code, Text e Lolly Sandbox. Estas ferramentas não salvam:

- ferramentas que trabalham com um arquivo que você traz, como Redact, Sign ou Convert Image, porque o Lolly nunca guarda uma cópia desse arquivo;
- ferramentas que gravam da sua câmera, microfone ou tela, como Record, Lolly Screen Capture e Lolly Voice Recorder;
- uma ferramenta sem nada para mudar, como Countdown.

Nas outras ferramentas, sua primeira alteração guarda o trabalho em **Projects** como se você tivesse salvado. As alterações seguintes são guardadas assim que a ferramenta termina de desenhar. Uma criação não salva fica em Projects depois que você fecha a aba e reabre com as alterações marcadas como não salvas.

**Leave anyway** ainda descarta essas alterações. Abrir a ferramenta de novo pela tela inicial começa uma nova criação; abra a anterior em Projects.

3D e Lolly Darkroom salvam enquanto você trabalha, mas não guardam um arquivo que você carrega neles, como um modelo 3D ou uma LUT. History e **Save** guardam o nome, o tipo e o tamanho do arquivo, sem guardar o arquivo. Quando você abre o trabalho de novo, uma nota diz qual é o arquivo, e a ferramenta funciona sem ele até que você o carregue novamente. Guarde seus arquivos originais.

Com o [Sync](/info/sync.html) ativado, uma criação guardada dessa forma vai para seus outros dispositivos. As versões dela ficam no dispositivo em que foram feitas.

Se uma criação estiver aberta em duas abas e você salvar nas duas, o último salvamento é mantido. O trabalho substituído fica em **Protected drafts** no History da criação, com **Open draft as a copy**.

Isso funciona apenas no app web, não nos apps para desktop ou celular, nem enquanto você trabalha ao vivo com outra pessoa.
:::

<!--i:eti-download-->
## Encontre um arquivo que você baixou

Em um navegador, **Download** entrega o arquivo ao navegador. O navegador salva o arquivo na pasta de downloads (geralmente **Downloads**) ou pergunta onde salvar. O Lolly não recebe a informação de onde o arquivo foi salvo, então procure na lista de downloads do navegador.

Se nenhum arquivo apareceu, confira o painel de exportação enquanto ainda está na ferramenta. Abaixo de **Download**, uma linha informa o nome do arquivo e o horário, com **Retry download**. No Chrome, Edge e em outros navegadores Chromium, a linha também oferece **Save file…** para escolher uma pasta. A linha e seu arquivo ficam disponíveis até você sair da ferramenta, recarregar ou exportar de novo.

O Lolly também guarda duas coisas depois de cada download:

- **Uma cópia do arquivo**, em **Assets**, dentro de **Your uploads**, enquanto **Save my renders to my library** estiver ativado em **Settings → Your renders** (**Settings** fica no rodapé da tela inicial). A configuração começa ativada. Um vídeo ou arquivo com mais de 50 MB pede confirmação antes, e um zip não é copiado.
- **As configurações que você usou**, nos últimos 24 downloads. **Recent exports**, abaixo do trabalho salvo em **Projects**, reabre a ferramenta com essas configurações. Imagens e arquivos que você adicionou do seu dispositivo não são incluídos. A mesma lista fica em **Settings → Activity & stats → Latest exports** e na aba **Changes** de **History**.

::: details Nos apps para desktop e celular
- **App para desktop:** **Download** salva em uma pasta **Lolly** dentro da sua pasta **Downloads**, sem caixa de diálogo. A linha abaixo de **Download** diz onde o arquivo foi salvo, como "Salvo em Downloads/Lolly", com **Show in folder**. **Open Exports Folder**, no menu **Window** ou **Exports**, abre a pasta a qualquer momento. Um arquivo com o mesmo nome de um anterior é salvo como "name (1)".
- **iPhone e iPad:** o arquivo é salvo no app **Files**, em **Lolly**, e o painel de compartilhamento se abre. A linha abaixo de **Download** diz "Salvo em Files → Lolly".
- **Android:** o menu de compartilhamento se abre. Escolha para onde o arquivo vai.

No iPhone, iPad e Android, um arquivo novo substitui um anterior com o mesmo nome.
:::

<!--i:eti-history-->
## Volte a uma versão anterior

- **Durante esta visita:** **Undo** volta pelas suas últimas 100 alterações, até você sair da ferramenta ou recarregar. Veja [Desfazer e refazer](/info/using.html#undo-and-redo).
- **Nas [ferramentas que salvam enquanto você trabalha](#which-tools-save-as-you-work):** as versões anteriores de cada criação são guardadas.
- **Tudo no dispositivo:** com o [Sync](/info/sync.html) ativado, **Restore an earlier copy**, em **Settings → Connected services**, restaura uma das últimas sete cópias diárias ou a cópia anterior à sua última aplicação. Tudo neste dispositivo passa a corresponder a essa cópia.

Para abrir uma versão anterior:

1. Pressione **History**, o botão de relógio ao lado de **Undo** e **Redo**. No Lolly Design, **History** fica na barra superior. No celular, pressione **•••** e depois **History**. Em ferramentas sem **Undo**, como Text e Lolly Sandbox, **History** fica ao lado de **Home** no canto superior esquerdo.
2. Encontre a versão pela data e hora. As linhas **Automatic checkpoint** são registradas enquanto você trabalha; as linhas **Saved version** são os momentos em que você salvou.
3. Pressione **Open as a copy**. A versão abre como uma nova criação, e a que estava aberta fica como estava. A cópia fica em **Projects**, com "(cópia)" depois do nome.

Para guardar uma versão com um nome, pressione **Name version**, digite um nome e pressione **Keep milestone**. As versões nomeadas são listadas na página **History**, em **Milestones**.

::: details O painel History e a página History
O painel **History** também lista linhas **Recovered work**, e **Protected drafts** guarda suas edições mais recentes entre pontos de controle, com **Open draft as a copy**. **Lolly Compare** e **Check assets** ajudam você a escolher antes de abrir uma cópia. Mude **This creation** para **All history on this device** para ver todas as criações.

Os pontos de controle automáticos ficam mais espaçados com o tempo: um por minuto na última hora, um por hora no último dia, um por dia por 30 dias e depois um por semana. Todas as versões salvas e nomeadas são mantidas. Apagar uma criação também move suas versões para **Trash**, e **Delete forever** as remove.

Quando o armazenamento de History fica cheio, os pontos de controle automáticos mais antigos de criações que você não abriu por 30 dias são removidos primeiro. Mesmo assim, um salvamento é sempre mantido. Ele é gravado como o trabalho atual, e History informa que esse salvamento não é guardado como versão. **Settings → Storage** mostra quanto espaço History usa.

A página **History** (`#/history`) abrange todas as criações neste navegador. Para abrir a página, pressione o botão de relógio no canto superior direito da tela inicial ou de **Projects**, escolha **Saved sessions** no menu do perfil (no celular, o botão redondo com o logo no canto superior direito) ou pressione **Open app history** no painel History de uma ferramenta. Os apps para desktop e celular não têm uma página History. Neles, o botão de relógio da tela inicial e **Saved sessions** abrem **Your recent work**: suas sessões salvas e exportações mais recentes, com um link para Projects.

- **Recent** lista suas criações, com as mais recentes primeiro e **Resume**.
- **Changes** reúne pontos de controle, downloads e resultados do Convert em uma linha do tempo. Um download tem **Reopen settings**.
- **Milestones** lista as versões nomeadas.

Cada criação é um bloco com sua imagem. **Grid** ou **List** muda o layout. Filtre por projeto, ferramenta e data (em **Filters** no celular). O menu de um bloco (clique com o botão direito ou mantenha pressionado) oferece **Resume**, **Versions**, **Show in Projects** e **Move to Trash**. Para remover vários, selecione-os e escolha **Move to Trash**, que oferece Undo.
:::

<!--i:eti-folder-move-->
## Transfira seu trabalho para outro dispositivo

| Para | Use |
|---|---|
| Manter seus dispositivos sincronizados | **Sync across devices**, em **Settings → Connected services**: veja [Sincronize seus dispositivos](/info/sync.html) |
| Transferir tudo uma vez | **Export my data** e **Import data…**, abaixo |
| Entregar um design ou um projeto | Um arquivo `.lolly`: **Export**, depois **Share**, depois **Download .lolly**; para um projeto inteiro, **Download project (.lolly)** no menu da pasta. Pressione **Open** no outro dispositivo. Veja [O arquivo .lolly](/info/using.html#the-lolly-file) |

Um link de compartilhamento leva suas configurações, mas não as imagens ou os arquivos que você adicionou do seu dispositivo.

::: note A importação adiciona conteúdo e não apaga nada
Pastas, favoritos e templates do arquivo são adicionados aos que já estão no outro dispositivo. Quando um item salvo está nos dois, a cópia salva mais recentemente é mantida. Seus dados e configurações naquele dispositivo ficam como estão. Os vazios são preenchidos a partir do arquivo. **Bring it to this device**, no Sync, funciona da mesma forma.
:::

Para transferir tudo uma vez:

1. No dispositivo antigo, abra **Settings → Storage** e, em **Move to another device**, pressione **Export my data**. O Lolly baixa um arquivo `.zip` cujo nome começa com `LollyTools-`.
2. Transfira o arquivo por USB, e-mail para você mesmo, AirDrop ou uma pasta compartilhada.
3. No dispositivo novo, abra **Settings → Storage**, pressione **Import data…**, escolha o arquivo e pressione **Import**.

::: note O que fica para trás
Os acessos a contas, as chaves e a frase-senha de sincronização ficam em cada dispositivo. A lista de downloads recentes, os downloads offline e os modelos de IA não são transferidos por nenhum meio. O histórico de versões só é transferido em um arquivo **Export my data**, não pelo Sync nem por um `.lolly`. Quando o histórico é grande demais para um arquivo, os pontos de controle automáticos mais antigos ficam de fora e a linha de exportação informa quantos. Você pode baixar e abrir uma cópia que o Sync guarda no seu armazenamento ou escolher a cópia em **Import data…**, como um arquivo de backup. Uma cópia criptografada pede sua frase-senha.
:::

::: details O que o arquivo de backup contém
O arquivo se chama `LollyTools-<First>-<Last>-<YYYY-MM-DD>-<n>.zip`. As partes do nome vêm do seu perfil e são omitidas se não estiverem definidas. `<n>` conta as exportações feitas no mesmo dia. Ele contém seu perfil, com suas pastas, Trash, templates e favoritos; todas as sessões salvas com suas miniaturas; suas imagens, fontes e logos enviados e as cópias dos seus downloads; seus sistemas de design; suas preferências (tema, largura da barra lateral, estatísticas de atividade local); versões salvas e resultados do Convert; e, no app web, o histórico de versões das suas criações.

O cache do catálogo não é incluído. O dispositivo novo baixa o cache de novo. Cada parte tem uma soma de verificação, então a importação detecta um arquivo danificado durante a transferência. As sessões salvas voltam a se vincular às imagens importadas. Os apps web, para desktop e celular leem o mesmo arquivo. O app de terminal grava um backup próprio mais simples, que este formato não lê. **Export my data & render everything** gera o mesmo arquivo mais um segundo zip com cada sessão salva renderizada no seu formato de saída. O formato completo está em [Transferência de dados](/info/data-transfer.html).
:::

<!--i:eti-globe-->
## Se você limpar os dados do navegador

No app web, o Lolly guarda tudo no armazenamento do navegador para este site: trabalhos salvos, imagens, fontes, sistemas de design, histórico de versões e downloads offline. Limpar os dados deste site no navegador remove tudo isso, e o Lolly não pode recuperar nada. O que resta é o que já saiu do navegador: arquivos que você baixou, um arquivo **Export my data**, uma cópia do [Sync](/info/sync.html) e links que você compartilhou.

::: warning Antes de limpar os dados do navegador
Pressione **Export my data** em **Settings → Storage** e guarde o arquivo em outro lugar.
:::

Quando o app inicia, o Lolly pede ao navegador que não limpe seu armazenamento quando o dispositivo ficar com pouco espaço, e o navegador decide. Em **Settings → Available offline**, uma linha que começa com **Protected** significa que o navegador concordou. "O navegador pode limpar os downloads se o dispositivo ficar com pouco espaço" significa que não concordou, e **Protect downloads** pede de novo.

Se o navegador não concordou, ele pode limpar os trabalhos salvos e os downloads quando faltar espaço, então guarde um arquivo **Export my data** recente.

**Settings → Storage** mostra quanto espaço cada tipo de dado usa. A linha **History** conta pontos de controle automáticos, suas prévias e rascunhos de recuperação. **Remove automatic checkpoints older than 30 days** libera esse espaço e mantém as versões salvas e nomeadas. **Clear cache** remove os arquivos baixados do catálogo, que são baixados de novo quando necessário. **Clear all my data** pede que você digite uma palavra, desativa o Sync e remove tudo o que o Lolly guarda neste navegador: seu perfil e suas configurações, sessões salvas com seu histórico e Trash, uploads, fontes e sistemas de design, o registro de downloads, resultados do Convert, modelos de IA baixados e cópias offline. Os arquivos que você baixou ficam onde você os salvou. O app então inicia como em uma primeira visita.

![O cartão de armazenamento em uma tela com largura de celular: todas as categorias de dados no dispositivo nomeadas, com o botão Clear all my data no rodapé](/t/url-shot?url=%2F%23%2Fprofile%3Ffocus%3Dstorage-section&width=430&height=1600&dpi=192&waitMs=2400&css=.welcome-dialog%2C.personalize-nudge%2C.store-selbar%2C.profile-row-value%2C.profile-group-value%2C%23store-hero-num%2C%23store-headroom%7Bdisplay%3Anone%7D&format=svg&waitSelector=%5Bdata-store-group%3Dmove%5D&drive=click%3A%5Bdata-store-group%3Dwork%5D%3Esummary%3Bclick%3A%5Bdata-store-group%3Dcaches%5D%3Esummary&walker=1&cropSelector=%23storage-section&dark=1&filename=pv-storage-clear)

Nos apps para desktop e celular, as sessões salvas são arquivos na pasta de dados do próprio app, e todo o resto fica no armazenamento do próprio app. Limpar um navegador web não afeta esses dados.

::: details Onde os apps para desktop e celular guardam as sessões salvas
Um arquivo por sessão salva, em uma pasta `saved-state`:

- macOS: `~/Library/Application Support/tools.lolly.Desktop/saved-state/`
- Windows: `%APPDATA%\tools.lolly.Desktop\saved-state\`
- Linux: `~/.local/share/tools.lolly.Desktop/saved-state/` ou o mesmo caminho em `$XDG_DATA_HOME`
- iPhone, iPad e Android: dentro do armazenamento do próprio app, que o app Files não mostra

Imagens, sistemas de design e a lista de downloads recentes ficam no armazenamento interno do app, não nessas pastas. O app de terminal e a linha de comando leem a mesma pasta `saved-state`: veja [Onde ficam as sessões salvas](/info/cli-reference.html#where-saved-sessions-live).
:::

<!--i:eti-trash-->
## Recupere algo que você apagou

Apagar uma sessão salva, uma pasta, um dos seus uploads ou uma das suas fontes no app move o item para **Trash** por 30 dias, onde quer que você o apague: **Projects**, **Assets**, **Settings → Storage** ou a lista de sessões salvas de uma ferramenta. Uma pasta e todo o seu conteúdo vão para Trash como uma única entrada. Uma sessão mantém seu histórico de versões em Trash. Logo depois de apagar, uma mensagem oferece **Undo**. Mais tarde:

1. Abra **Trash**: o bloco **Trash** em **Projects**, o botão **Trash** em **Assets → Your uploads** ou a linha **Trash** em **Settings → Storage**. Os três abrem a mesma lista.
2. Pressione **Restore** ao lado do item. Ele volta para sua pasta, e uma fonte recupera as funções que tinha no sistema de design.

**Delete forever** remove um item de vez. **Empty Trash** pede confirmação antes e depois remove todos os itens de Trash. Itens com mais de 30 dias são removidos de vez.

::: warning Algumas exclusões são imediatas
Apagar um sistema de design, um logo ou sua foto de perfil não move o item para Trash. A linha de comando e o app de terminal também apagam imediatamente.
:::

Com o [Sync](/info/sync.html) ativado, **Restore an earlier copy** pode restaurar o estado de todo o dispositivo em um dia anterior, e um arquivo **Export my data** restaura o que o arquivo contém.
