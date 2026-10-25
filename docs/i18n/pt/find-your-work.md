# Encontre e recupere seu trabalho

Algo sumiu: um design que você nunca salvou, um arquivo que você baixou, a versão da semana passada, ou tudo depois que o navegador foi limpo. Comece pela tabela e depois siga a seção para a qual ela aponta.

O trabalho pessoal permanece no navegador ou app em que você o criou, naquele dispositivo, a menos que você ative o [Sync](/info/sync.html). Uma organização que usa o Lolly Work opcional também mantém **Team projects** no servidor dela, tratados abaixo.

| O que você fez | Onde procurar |
|---|---|
| Pressionou **Salvar como** ou **Salvar** | **Projetos** |
| Pressionou **Baixar** | Os downloads do seu navegador, e uma cópia em **Ativos** |
| Nenhum dos dois, em uma [ferramenta que salva enquanto você trabalha](#which-tools-save-as-you-work) | **Projetos** e **Histórico** |
| Nenhum dos dois, em qualquer outra ferramenta | Só a aba em que você trabalhou, até você fechá-la |
| Excluiu no app | **Lixeira**, em **Projetos**, **Ativos** ou **Configurações → Armazenamento**, por 30 dias |

::: figure find-your-work-places
Onde seu trabalho fica: o armazenamento do próprio navegador guarda Projects, History e Trash; os downloads vão para as pastas do seu dispositivo; o Sync e um arquivo de backup são as cópias fora do navegador.
:::

::: details Encontre trabalho compartilhado no Lolly Work (opcional)
Abra o Lolly da sua organização e faça login, depois procure em **Projects → Team projects**. As sessões compartilhadas ficam na instância e aparecem conforme o seu acesso. Fazer login pode restaurar o acesso a essas sessões em outro dispositivo; não restaura a sua biblioteca pessoal nem o backup do dispositivo.

Em um [collab de trabalho](/info/collaborate.html#work-collabs-with-lolly-work-optional), espere por **Saved to work** antes de sair. Se um projeto compartilhado sumiu, confira se você está conectado à instância certa e pergunte ao operador dela sobre acesso ou retenção. Limpar os dados do navegador remove as cópias locais, não a cópia da organização no servidor. Veja [Use Lolly at your organisation](/info/organisation.html).
:::

## Encontre algo que você salvou

1. Pressione **Home**, no canto superior esquerdo da ferramenta.
2. Abra a aba **Projetos** no topo da tela inicial (o ícone de pasta no celular).
3. Olhe na primeira tela. O trabalho salvo em **Minha biblioteca** está lá, e cada projeto é uma pasta. Para buscar em todas as pastas de uma vez, digite em **Buscar em todos os projetos…**, no rodapé da tela.

Um item recebe o nome do arquivo que você digitou no painel de exportação ou o da ferramenta, como **QR Code**, se você não digitou nenhum. Abra o item e todas as configurações voltam, prontas para mudar e exportar de novo. Para manter o trabalho novo assim, veja [Saving & continuing](/info/using.html#saving-continuing).

::: note Não está em Projetos?
- Pode estar na **Lixeira**: veja [Recupere algo que você excluiu](#get-back-something-you-deleted).
- Outro navegador, uma janela privada ou outro dispositivo começam vazios, a menos que você use a [Sincronização](/info/sync.html) ou [mova seu trabalho](#move-your-work-to-another-device).
- Se você só pressionou **Baixar**, veja [Encontre um arquivo que você baixou](#find-a-file-you-downloaded).
:::

::: details Trabalhando com Projetos
Você também pode abrir **Projetos** em **Configurações → Armazenamento → Sessões salvas → Organizar em Projetos**. Funciona como um gerenciador de arquivos:

![Projetos antes de qualquer coisa ser salva: os blocos Nova pasta, Novo recurso e Modelos, o relógio de History no canto superior direito e a barra Buscar em todos os projetos no rodapé](/t/url-shot?url=%2F%23%2Fp&width=1440&height=900&dpi=192&waitMs=1200&walker=1&format=svg&localize=1&dark=1&filename=projects)
<!--
SHOT NOTE (projects): build-docs-shots.ts gives every shot a fresh browser
context with no storage seeding, so this frame is always the empty Projects
root. The alt says so. Revisit (and re-caption) if the pipeline gains a
storage-seeding hook.
-->

- <!--i:folder--> **Pastas que se aninham.** Agrupe sessões salvas em pastas, e pastas dentro de pastas, na profundidade que quiser. Crie uma pasta, renomeie-a ou arraste um bloco para outra pasta para movê-lo; uma trilha de navegação leva você de volta para cima. As sessões salvas sem pasta aparecem direto na raiz de **Projects**.
- <!--i:clock--> **Ordene do seu jeito.** **View options**, o botão de controles deslizantes no canto superior direito, oferece **Grid** ou **List** e ordena por **Name**, **Date added**, **Last modified** (o padrão), **Size** e, dentro de uma pasta, **By tool**. As pastas sempre vêm primeiro, seja qual for a ordenação ativa - a ordenação só organiza as sessões e pastas dentro do próprio grupo.
- <!--i:document--> **Arquive trabalho novo direto.** **New asset** abre o seletor compartilhado. Escolha **Templates** para começar de um template salvo: abra para editar ou use **+ Add** para salvar uma criação nova imediatamente.
- <!--i:checklist--> **Seleção múltipla (desktop).** Marque a caixa de seleção de um bloco, arraste uma caixa de seleção sobre o espaço vazio ou use **Shift/Cmd-clique**; **clique com o botão direito** em um bloco para o menu de contexto. A barra de seleção então oferece **Render selection**, **Move to…**, **New folder**, **Delete** (que move para a Lixeira), **Edit together** para de duas a oito sessões de uma só ferramenta, lado a lado sob uma única barra lateral, e **Edit as sheet**, que abre uma seleção de qualquer tamanho ou mistura como linhas na grade do lote.
- <!--i:download--> **Renderize uma pasta inteira ou uma seleção.** **Render folder** exporta todas as sessões salvas de uma pasta - inclusive as subpastas - em um único `.zip` aninhado. **Render selection** faz o mesmo para qualquer seleção múltipla, e uma única sessão é renderizada direto no próprio arquivo.
- <!--i:link--> **Vá direto ao trabalho salvo de uma ferramenta.** Marque uma ou mais ferramentas na galeria de Tools e escolha **View sessions** na barra de seleção - Projects abre mostrando apenas as sessões feitas com essas ferramentas, com um **Clear** para voltar à visão completa.
- <!--i:link--> **Compartilhe uma sessão salva.** Clique com o botão direito em uma sessão (no celular, pressione o **•••** do bloco dela) → **Share link** para copiar um link que a reabre com as mesmas configurações; as imagens do seu dispositivo não viajam com um link (a caixa Share completa: veja [Sharing your work](/info/using.html#sharing-your-work)).
- <!--i:pentool--> **Renomeie ou copie uma.** Clique com o botão direito em uma sessão (no celular, pressione o **•••** do bloco dela) para **Rename**, **Duplicate** (uma cópia na mesma pasta) e **Move to…**.

![O popover Opções de exibição em Projetos: Layout com Grade e Lista, e Ordenar por definido como Modificado por último, ao lado de um botão que inverte a ordem](/t/url-shot?url=%2F%23%2Fp&width=900&height=700&dpi=192&waitMs=1400&drive=click%3A.projects-viewopts&cropSelector=.projects-viewmenu&walker=1&format=svg&dark=1&filename=misc-projects-sort)
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

## Se você fechou a aba ou saiu da ferramenta

O que volta depende de como você saiu e de qual ferramenta você usou:

- **Você fechou a aba ou voltou em outro momento.** O trabalho não salvo se perdeu, exceto nas [ferramentas que salvam enquanto você trabalha](#which-tools-save-as-you-work): abra esse trabalho em **Projects**.
- **Você recarregou a página na mesma aba.** Suas configurações voltam do endereço da página. Nas ferramentas que não salvam enquanto você trabalha, as imagens e os arquivos que você adicionou do seu dispositivo e os textos de uma linha com mais de 150 caracteres não voltam, porque o endereço não os guarda.
- **Você pressionou Home ou o botão de voltar no canto superior esquerdo.** Se você mudou algo desde a última vez que salvou, baixou ou copiou, uma caixa **Unsaved edits** pergunta se quer salvar antes. **Save & leave** salva o trabalho e leva você a **Projects**, ou de volta à pasta do projeto de onde você abriu o trabalho. **Leave anyway** descarta as alterações: um item salvo volta a como você o salvou por último, e uma criação que você nunca salvou sai de **Projects**. **Cancel** mantém você na ferramenta.

O Lolly só pergunta quando você pressiona **Home** ou o botão de voltar em uma ferramenta. Fechar a aba, recarregar e o próprio botão Voltar do navegador nunca perguntam. Para garantir, pressione **Salvar como**, ou **Salvar** no painel de exportação, antes de sair de uma ferramenta.

Quando a recuperação automática não está disponível, uma nota ao lado dos controles de edição diz o que guardar:

- Em uma ferramenta que trabalha com um arquivo que você traz, salve suas configurações e guarde também os arquivos originais.
- Em uma ferramenta de gravação, ou em um utilitário sem ação Save, salve ou baixe o resultado antes de sair.
- Os apps desktop e mobile avisam quando você precisa salvar manualmente.
- Em uma colaboração privada, quem convidou mantém o documento e o histórico dele, incluindo as alterações da outra pessoa. Quem entrou trabalha em uma cópia temporária e deve salvar uma cópia separada antes de a sessão terminar.

::: note Saiu sem salvar por engano?
Nas ferramentas que salvam enquanto você trabalha, o Histórico guarda uma cópia das edições descartadas. Abra a página **Histórico**, encontre-as em **Changes** e pressione **Open as a copy**. Nas outras ferramentas as alterações se foram.
:::

::: details Quais ferramentas salvam enquanto você trabalha
No app web, toda ferramenta que produz um documento salva enquanto você trabalha: Design, Chart, QR Code, Text, Sandbox e as demais. Estas ferramentas não:

- ferramentas que trabalham com um arquivo que você traz, como Redact, Sign ou Convert Image, porque o Lolly nunca guarda uma cópia desse arquivo;
- ferramentas que gravam a partir da sua câmera, microfone ou tela, como Record, Screen Capture e Voice Recorder;
- uma ferramenta sem nada a alterar, como o Countdown.

Nas outras ferramentas, sua primeira alteração arquiva o trabalho em **Projects** como se você tivesse salvo, e as alterações seguintes são mantidas enquanto você trabalha, depois que a ferramenta termina de desenhar. Uma criação não salva continua em Projects depois que você fecha a aba e reabre com as alterações marcadas como não salvas.

**Leave anyway** ainda descarta essas alterações, e o History guarda uma cópia das edições descartadas por 30 dias. Abrir a ferramenta de novo pela tela inicial começa uma nova criação; abra a anterior em Projects.

O 3D e o Darkroom salvam enquanto você trabalha, mas não guardam um arquivo que você carrega neles, como um modelo 3D ou uma LUT. O History e o **Save** guardam o nome, o tipo e o tamanho do arquivo, não o arquivo. Quando você abre o trabalho de novo, uma nota diz qual arquivo era, e a ferramenta funciona sem ele até você carregá-lo outra vez. Guarde seus arquivos originais.

Com a [Sincronização](/info/sync.html) ativada, uma criação arquivada dessa forma vai para seus outros dispositivos como qualquer outra coisa em Projetos. Suas versões ficam no dispositivo onde foram feitas.

Se uma criação está aberta em duas abas e você salva em ambas, o último salvamento é mantido. O trabalho que ele substituiu não se perde: fica em **Rascunhos protegidos**, no Histórico da criação, com **Open draft as a copy**.

Isso funciona só no app web, não nos apps de desktop ou mobile, e não enquanto você trabalha ao vivo com outra pessoa.
:::

## Encontre um arquivo que você baixou

No navegador, **Baixar** entrega o arquivo ao seu navegador, que o salva na pasta de downloads dele (geralmente **Downloads**) ou pergunta onde. O Lolly não sabe para onde o arquivo foi, então procure na lista de downloads do seu navegador.

Se nenhum arquivo apareceu, procure no painel de exportação enquanto você ainda está na ferramenta. Em **Baixar**, uma linha mostra o nome do arquivo e a hora, com **Retry download**, e no Chrome, Edge e outros navegadores baseados em Chromium, **Save file…** para escolher uma pasta você mesmo. A linha e seu arquivo duram até você sair da ferramenta, recarregar ou exportar de novo.

O Lolly também mantém duas coisas depois de cada download:

- **Uma cópia do arquivo**, em **Ativos** sob **Seus uploads**, enquanto **Salvar minhas renderizações na minha biblioteca** está ativado em **Configurações → Suas renderizações** (**Configurações** fica no rodapé da tela inicial). A configuração começa ativada. Um vídeo, ou um arquivo com mais de 50 MB, pergunta antes, e um zip não é copiado.
- **As configurações que você usou**, para seus últimos 24 downloads. **Exportações recentes**, abaixo do seu trabalho salvo em **Projetos**, reabre a ferramenta com essas configurações para que você possa gerar o arquivo de novo, embora imagens e arquivos que você adicionou do seu dispositivo não sejam incluídos. A mesma lista fica em **Configurações → Atividade e estatísticas → Exportações recentes** e na aba **Changes** de **History**. Essa lista guarda configurações, não os arquivos.

::: details Nos apps de desktop e mobile
- **App de desktop:** **Baixar** salva direto em uma pasta **Lolly** dentro da sua pasta **Downloads**, sem diálogo. A linha abaixo de **Baixar** mostra para onde foi, como "Saved to Downloads/Lolly", com **Mostrar na pasta**. **Open Exports Folder**, no menu **Window** ou **Exports**, abre a pasta a qualquer momento. Um arquivo com o mesmo nome de um anterior é salvo como "nome (1)".
- **iPhone e iPad:** o arquivo é salvo no app **Arquivos**, em **Lolly**, e a folha de compartilhamento abre para que você possa enviá-lo adiante. A linha abaixo de **Baixar** mostra "Saved to Files → Lolly".
- **Android:** o menu de compartilhamento abre para que você escolha para onde o arquivo vai.

No iPhone, iPad e Android, um arquivo novo substitui um anterior com o mesmo nome.
:::

## Volte a uma versão anterior

- **Durante esta visita:** **Undo** volta pelas suas últimas 100 mudanças, até você sair da ferramenta ou recarregar. Veja [Desfazer e refazer](/info/using.html#undo-and-redo).
- **Nas [ferramentas que salvam enquanto você trabalha](#which-tools-save-as-you-work):** versões anteriores de cada criação são mantidas. Siga os passos abaixo.
- **Tudo no dispositivo:** com a [Sincronização](/info/sync.html) ativada, **Restore an earlier copy**, em **Configurações → Serviços conectados**, traz de volta uma das últimas sete cópias diárias, ou a cópia de antes da sua última aplicação. Tudo neste dispositivo passa a corresponder àquela cópia, não só um design.

Para abrir uma versão anterior:

1. Pressione **Histórico**, o botão de relógio ao lado de **Undo** e **Redo**. No Design, **Histórico** fica na barra superior; no celular, toque em **•••** e depois em **Histórico**. Em ferramentas sem **Undo**, como Text e Sandbox, **Histórico** fica ao lado de **Home** no canto superior esquerdo.
2. Encontre a versão pela data e hora. Linhas de **Automatic checkpoint** são tiradas enquanto você trabalha; linhas de **Saved version** são os momentos em que você salvou.
3. Pressione **Open as a copy**. A versão abre como uma nova criação, e a que você tinha aberta continua como estava. A cópia fica em **Projetos**, com "(copy)" depois do nome.

Para manter uma versão com nome, pressione **Name version**, digite um nome e pressione **Keep milestone**. Versões nomeadas são listadas na página **History**, em **Milestones**.

::: details O painel History e a página History
O painel **History** também lista linhas de **Recovered work**, e **Protected drafts** guarda suas últimas edições entre checkpoints, com **Open draft as a copy**. **Compare** e **Check assets** ajudam você a escolher antes de abrir uma cópia. Alterne **This creation** para **All history on this device** para ver cada criação.

Checkpoints automáticos se tornam mais espaçados com o tempo: um por minuto na última hora, um por hora no último dia, um por dia durante 30 dias, depois um por semana. Versões salvas e versões nomeadas são todas mantidas. Excluir uma criação move suas versões para a **Lixeira** também, e **Delete forever** as remove.

Quando o armazenamento do Histórico se enche, os checkpoints automáticos mais antigos de criações que você não abre há 30 dias são removidos primeiro. Um salvamento é sempre mantido, mesmo assim: ele é gravado como o trabalho atual, e o Histórico avisa que esse salvamento não é mantido como uma versão. **Configurações → Armazenamento** mostra quanto o Histórico usa.

A página **History** (`#/history`) cobre todas as criações deste navegador. Para abri-la, pressione o botão de relógio no canto superior direito da tela inicial ou de **Projects**, escolha **Saved sessions** no menu do perfil (no celular, o botão redondo do logotipo no canto superior direito) ou pressione **Open app history** no painel History de uma ferramenta. Os apps desktop e mobile não têm página History, então neles o botão de relógio da tela inicial e **Saved sessions** abrem **Your recent work**: suas últimas sessões salvas e exportações, com um link para Projects.

- **Recent** lista suas criações, mais recentes primeiro, com **Resume**.
- **Changes** reúne checkpoints, downloads e resultados do Convert em uma única linha do tempo. Um download tem **Reopen settings**.
- **Milestones** lista versões nomeadas.

Filtre por projeto, ferramenta e data (atrás de **Filters** no celular). A página History não tem botão de exclusão; para remover um item, use Projetos.
:::

## Mova seu trabalho para outro dispositivo

| Para | Use |
|---|---|
| Manter seus dispositivos sincronizados | **Sincronizar entre dispositivos**, em **Configurações → Serviços conectados**: veja [Sincronize seus dispositivos](/info/sync.html) |
| Mover tudo de uma vez | **Exportar meus dados** e **Import data…**, abaixo |
| Entregar um design ou um projeto | Um arquivo `.lolly`: **Exportar**, depois **Compartilhar**, depois **Download .lolly**; para um projeto inteiro, **Download project (.lolly)** no menu da pasta. Pressione **Open** no outro dispositivo. Veja [O arquivo .lolly](/info/using.html#the-lolly-file) |

Um link de compartilhamento carrega suas configurações, mas não imagens ou arquivos que você adicionou do seu dispositivo.

::: note Importar não adiciona nem exclui nada
Pastas, favoritos e modelos no arquivo são adicionados ao lado dos que já existem no outro dispositivo. Quando um item salvo está em ambos, a cópia salva mais recentemente é mantida. Seus dados e configurações naquele dispositivo permanecem como estão; os vazios são preenchidos a partir do arquivo. **Trazer para este dispositivo**, na Sincronização, funciona da mesma forma.
:::

Para mover tudo de uma vez:

1. No dispositivo antigo, abra **Configurações → Armazenamento** e, em **Move to another device**, pressione **Exportar meus dados**. O Lolly baixa um único arquivo `.zip` cujo nome começa com `LollyTools-`.
2. Leve o arquivo para o outro lado por USB, envie por e-mail para você mesmo, AirDrop ou uma pasta compartilhada.
3. No dispositivo novo, abra **Configurações → Armazenamento**, pressione **Import data…**, escolha o arquivo e pressione **Import**.

::: note O que fica para trás
Logins, chaves e a frase-senha de sincronização ficam em cada dispositivo. A lista de downloads recentes, downloads offline e modelos de IA não viajam por nenhuma rota. O histórico de versões viaja apenas em um arquivo de **Exportar meus dados**, não pela Sincronização nem por um `.lolly`. Quando o histórico é grande demais para um único arquivo, os checkpoints automáticos mais antigos ficam de fora e a linha da exportação diz quantos. Uma cópia que a Sincronização guarda no seu armazenamento pode ser baixada e aberta, ou escolhida em **Import data…**, como um arquivo de backup; uma cópia criptografada pede sua frase-senha.
:::

::: details O que o arquivo de backup contém
O arquivo é nomeado `LollyTools-<First>-<Last>-<YYYY-MM-DD>-<n>.zip` (as partes do nome vêm do seu perfil e são descartadas se não estiverem definidas; `<n>` é um contador por dia para que exportações no mesmo dia não colidam). Ele contém seu perfil, com suas pastas, Lixeira, modelos e favoritos; cada sessão salva com sua miniatura; suas imagens, fontes e logos enviados e as cópias dos seus downloads; seus design systems; suas preferências (tema, largura da barra lateral, estatísticas locais de atividade); versões salvas e resultados do Convert; e, a partir do app web, o histórico de versões das suas criações.

O cache do catálogo não está incluído - ele é baixado de novo sozinho no novo dispositivo. Cada parte tem checksum, então um arquivo danificado no trânsito é detectado na importação em vez de ser restaurado pela metade. As sessões salvas se religam automaticamente às suas imagens importadas. Os apps web, desktop e mobile leem o mesmo arquivo; o app de terminal grava um backup mais simples, próprio, que este formato não lê. **Export my data & render everything** gera o mesmo arquivo mais um segundo zip com cada sessão salva renderizada na saída dela. (Especificação completa do formato: [Data transfer](/info/data-transfer.html).)
:::

## Se você limpar os dados do seu navegador

No app web, o Lolly mantém tudo no armazenamento do seu navegador para este site: trabalho salvo, imagens, fontes, design systems, histórico de versões e downloads offline. Limpar os dados deste site no seu navegador remove tudo isso, e o Lolly não consegue trazer nada de volta. O que resta é o que já saiu do navegador: arquivos que você baixou, um arquivo de **Exportar meus dados**, uma cópia da [Sincronização](/info/sync.html) e links que você compartilhou.

::: warning Antes de limpar os dados do navegador
Pressione **Exportar meus dados** em **Configurações → Armazenamento**, e guarde o arquivo em outro lugar.
:::

Quando o app inicia, o Lolly pede ao navegador que não limpe seu armazenamento quando o dispositivo ficar com pouco espaço, e o navegador decide. Em **Settings → Available offline**, uma linha que começa com **Protected** significa que o navegador concordou. "The browser may clear downloads if the device runs low on space" significa que não concordou, e **Protect downloads** pede de novo.

Se o navegador não concordou, ele pode limpar o trabalho salvo e também os downloads quando o espaço acabar, então guarde um arquivo recente de **Export my data**.

**Configurações → Armazenamento** mostra quanto espaço cada tipo de dado usa. Sua linha de **Histórico** conta checkpoints automáticos, suas prévias e rascunhos de recuperação; **Remover checkpoints automáticos com mais de 30 dias** libera esse espaço e mantém as versões salvas e nomeadas. **Limpar cache** descarta arquivos de catálogo baixados, que baixam de novo quando necessário. **Limpar todos os meus dados** pede que você digite uma palavra, desliga a Sincronização, depois remove tudo que o Lolly guarda neste navegador: seu perfil e configurações, sessões salvas com seu histórico e a Lixeira, uploads, fontes e design systems, o log de downloads, resultados do Convert, modelos de IA baixados e cópias offline. Arquivos que você baixou permanecem onde você os salvou. O app então inicia como em uma primeira visita.

![O cartão de armazenamento em uma tela do tamanho de um celular: todas as categorias de dados no dispositivo nomeadas, com o botão Clear all my data na parte de baixo](/t/url-shot?url=%2F%23%2Fprofile%3Ffocus%3Dstorage-section&width=430&height=1600&dpi=192&waitMs=2400&css=.welcome-dialog%2C.personalize-nudge%2C.store-selbar%2C.profile-row-value%2C.profile-group-value%2C%23store-hero-num%2C%23store-headroom%7Bdisplay%3Anone%7D&format=svg&waitSelector=%5Bdata-store-group%3Dmove%5D&drive=click%3A%5Bdata-store-group%3Dwork%5D%3Esummary%3Bclick%3A%5Bdata-store-group%3Dcaches%5D%3Esummary&walker=1&cropSelector=%23storage-section&dark=1&filename=pv-storage-clear)

Nos apps de desktop e mobile, sessões salvas são arquivos na própria pasta de dados do app e o resto fica no próprio armazenamento do app, então limpar um navegador web não os afeta.

::: details Onde os apps de desktop e mobile guardam sessões salvas
Um arquivo por sessão salva, em uma pasta `saved-state`:

- macOS: `~/Library/Application Support/tools.lolly.Desktop/saved-state/`
- Windows: `%APPDATA%\tools.lolly.Desktop\saved-state\`
- Linux: `~/.local/share/tools.lolly.Desktop/saved-state/`, ou o mesmo caminho sob `$XDG_DATA_HOME`
- iPhone, iPad e Android: dentro do próprio armazenamento do app, que o app Files não mostra

Imagens, design systems e a lista de downloads recentes ficam no armazenamento interno do app, não nessas pastas. O app de terminal e a linha de comando leem a mesma pasta `saved-state`: veja [Onde vivem as sessões salvas](/info/cli-reference.html#where-saved-sessions-live).
:::

## Recupere algo que você excluiu

Excluir uma sessão salva, uma pasta, um dos seus uploads ou uma das suas fontes no app move o item para a **Lixeira** por 30 dias, onde quer que você o exclua: **Projetos**, **Ativos**, **Configurações → Armazenamento** ou a lista de sessões salvas de uma ferramenta. Uma pasta vai com tudo o que contém, como uma única entrada, e uma sessão mantém seu histórico de versões enquanto está lá. Logo em seguida, uma mensagem oferece **Desfazer**. Depois:

1. Abra a **Lixeira**: o bloco **Lixeira** em **Projetos**, o botão **Lixeira** em **Ativos → Seus uploads**, ou a linha **Lixeira** em **Configurações → Armazenamento**. Os três abrem a mesma lista.
2. Pressione **Restaurar** ao lado do item. Ele volta para sua pasta, e uma fonte recupera as funções que tinha no seu design system.

**Excluir para sempre** remove um item definitivamente. **Esvaziar lixeira** pede confirmação antes, depois remove todo item da Lixeira. Itens com mais de 30 dias são removidos definitivamente.

::: warning Algumas exclusões são imediatas
Excluir um design system, um logotipo ou sua foto de perfil não vai para a Lixeira. A linha de comando e o app de terminal também excluem na hora.
:::

Com a [Sincronização](/info/sync.html) ativada, **Restore an earlier copy** pode trazer de volta o estado de um dia anterior do dispositivo inteiro, e um arquivo de **Exportar meus dados** traz de volta o que o arquivo contém.
