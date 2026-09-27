# Encontre e recupere seu trabalho

Tudo o que você cria no Lolly permanece no navegador ou app em que você o criou, nesse dispositivo, a menos que você ative a [Sincronização](/info/sync.html). O trabalho salvo fica em **Projetos**. Um arquivo baixado fica onde seu navegador ou sistema o colocou, e uma cópia costuma esperar em **Ativos**. Em nove ferramentas, o trabalho que você nunca salvou também é mantido. Esta página cobre cada um desses casos, além de uma aba fechada, dados do navegador apagados, versões anteriores, itens excluídos e a mudança para outro dispositivo.

| O que você fez | Onde procurar |
|---|---|
| Pressionou **Salvar como** ou **Salvar** | **Projetos** |
| Pressionou **Baixar** | Os downloads do seu navegador, e uma cópia em **Ativos** |
| Nenhum dos dois, em uma das [nove ferramentas que salvam enquanto você trabalha](#the-nine-tools-that-save-as-you-work) | **Projetos** e **History** |
| Nenhum dos dois, em qualquer outra ferramenta | Só a aba em que você trabalhou, até você fechá-la |
| Moveu para a Lixeira | O bloco **Lixeira** em **Projetos**, por 30 dias |

## Encontre algo que você salvou

1. Pressione **Home**, no canto superior esquerdo da ferramenta.
2. Abra a aba **Projetos** no topo da tela inicial (o ícone de pasta no celular).
3. Olhe na primeira tela. O trabalho salvo em **Minha biblioteca** está lá, e cada projeto é uma pasta. Para buscar em todas as pastas de uma vez, digite em **Buscar em todos os projetos…**, no rodapé da tela.

Um item recebe o nome do arquivo que você digitou no painel de exportação, ou o nome da ferramenta, como **QR Code**, se você não digitou nenhum. Abra o item e todas as configurações voltam, prontas para mudar e exportar de novo. Para manter o trabalho novo dessa forma, veja [Salvando e continuando](/info/using.html#saving-continuing).

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

- <!--i:folder--> **Pastas que se aninham.** Agrupe sessões salvas em pastas, e pastas dentro de pastas, tão fundo quanto quiser. Crie uma pasta, renomeie-a ou arraste um bloco sobre outra pasta para movê-lo; uma trilha de navegação leva você de volta. Sessões salvas sem pasta aparecem direto na raiz de **Projetos**.
- <!--i:clock--> **Ordene do seu jeito.** **Opções de exibição**, o botão de controles deslizantes no canto superior direito, oferece **Grade** ou **Lista** e ordena por **Nome**, **Data de adição**, **Modificado por último** (o padrão), **Tamanho** e, dentro de uma pasta, **Por ferramenta**. Pastas sempre vêm primeiro, não importa qual ordenação esteja ativa - a ordenação só organiza as sessões e pastas dentro do próprio grupo.
- <!--i:document--> **Traga trabalho novo direto para dentro.** **Novo recurso** abre o seletor compartilhado. Escolha **Modelos** para começar a partir de um modelo salvo: abra-o para editar, ou use **+ Adicionar** para salvar uma criação nova imediatamente.
- <!--i:checklist--> **Seleção múltipla (computador).** Marque a caixa de um bloco, arraste uma caixa de seleção pelo espaço vazio ou use **Shift/Cmd-click**; clique com o botão direito em um bloco para seu menu de contexto. A barra de seleção então oferece **Renderizar seleção**, **Mover para…**, **Nova pasta**, **Excluir** (que move para a Lixeira), **Editar juntos** para duas a oito sessões de uma mesma ferramenta, lado a lado sob uma única barra lateral, e **Editar como planilha**, que abre uma seleção de qualquer tamanho ou mistura como linhas na grade de lote.
- <!--i:download--> **Renderize uma pasta ou seleção inteira.** **Renderizar pasta** exporta cada sessão salva em uma pasta - incluindo suas subpastas - como um único `.zip` aninhado. **Renderizar seleção** faz o mesmo para qualquer multisseleção, e uma única sessão é renderizada direto para seu próprio arquivo. Não precisa de Batch/Pro.
- <!--i:link--> **Vá direto para o trabalho salvo de uma ferramenta.** Marque uma ou mais ferramentas na galeria de Ferramentas e escolha **Ver sessões** na barra de seleção - Projetos abre mostrando só as sessões feitas com aquelas ferramentas, com um **Limpar** para voltar à visão completa.
- <!--i:link--> **Compartilhe uma sessão salva.** Clique com o botão direito em uma sessão (no celular, toque em **•••** no bloco) → **Compartilhar link** para copiar um link que a reabre com as mesmas configurações; imagens do seu dispositivo não viajam com o link (o diálogo completo de compartilhamento: veja [Compartilhando seu trabalho](/info/using.html#sharing-your-work)).
- <!--i:pentool--> **Renomeie ou duplique uma sessão.** Clique com o botão direito em uma sessão (no celular, toque em **•••** no bloco) para **Renomear**, **Duplicar** (uma cópia na mesma pasta) e **Mover para…**.

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

- **Você fechou a aba, ou voltou outra hora.** O trabalho não salvo se foi, exceto nas [nove ferramentas](#the-nine-tools-that-save-as-you-work), que salvam suas edições enquanto você trabalha: abra-as em **Projetos**.
- **Você recarregou a página na mesma aba.** Suas configurações voltam a partir do endereço da página. Em ferramentas fora as nove, imagens e arquivos que você adicionou do seu dispositivo, e texto de uma linha com mais de 150 caracteres, não voltam, porque o endereço não os guarda.
- **Você pressionou Home, ou o botão de voltar no canto superior esquerdo.** Se você mudou algo desde a última vez que salvou, baixou ou copiou, um diálogo de **Alterações não salvas** pergunta se quer salvar primeiro. **Salvar e sair** salva o trabalho e leva você a **Projetos**, ou de volta à pasta do projeto de onde você abriu o trabalho. **Sair sem salvar** sai; nas nove ferramentas suas edições já estão salvas e continuam em Projetos. **Cancelar** mantém você na ferramenta.

O Lolly só pergunta quando você pressiona **Home** ou o botão de voltar em uma ferramenta. Fechar a aba, recarregar e o próprio botão Voltar do navegador nunca perguntam. Para garantir, pressione **Salvar como**, ou **Salvar** no painel de exportação, antes de sair de uma ferramenta.

::: note Saiu sem salvar por engano?
Em ferramentas fora as nove, pressione o botão Voltar do seu navegador imediatamente. As configurações do endereço da página voltam, embora imagens que você adicionou do seu dispositivo não voltem. Depois pressione **Salvar como** e **Salvar** antes de fazer qualquer outra coisa: dessa vez o Lolly não pergunta antes de você sair.
:::

::: details As nove ferramentas que salvam enquanto você trabalha
[Design](/#/tool/design), [Chart](/#/tool/chart), [QR Code](/#/tool/qr-code), [Gradient](/#/tool/gradient), [Snippet](/#/tool/snippet), [Flow Chart](/#/tool/org-chart), [Pricing](/#/tool/pricing-table), [Wordmark](/#/tool/wordmark) e [Text](/#/tool/text-helper). A lista cresce conforme mais ferramentas ganham salvamento automático.

Nessas ferramentas, sua primeira mudança arquiva o trabalho em **Projetos** como se você tivesse salvo, e mudanças posteriores são mantidas em poucos segundos. Então uma criação não salva continua em Projetos depois que você fecha a aba, e **Sair sem salvar** não descarta suas edições. Abrir a ferramenta de novo pela tela inicial começa uma nova criação; abra a anterior em Projetos.

Isso funciona só no app web, não nos apps de desktop ou mobile, e não enquanto você trabalha ao vivo com outra pessoa.
:::

## Encontre um arquivo que você baixou

No navegador, **Baixar** entrega o arquivo ao seu navegador, que o salva na pasta de downloads dele (geralmente **Downloads**) ou pergunta onde. O Lolly não sabe para onde o arquivo foi, então procure na lista de downloads do seu navegador.

Se nenhum arquivo apareceu, procure no painel de exportação enquanto você ainda está na ferramenta. Em **Baixar**, uma linha mostra o nome do arquivo e a hora, com **Retry download**, e no Chrome, Edge e outros navegadores baseados em Chromium, **Save file…** para escolher uma pasta você mesmo. A linha e seu arquivo duram até você sair da ferramenta, recarregar ou exportar de novo.

O Lolly também mantém duas coisas depois de cada download:

- **Uma cópia do arquivo**, em **Ativos** sob **Seus uploads**, enquanto **Salvar minhas renderizações na minha biblioteca** está ativado em **Configurações → Suas renderizações** (**Configurações** fica no rodapé da tela inicial). A configuração começa ativada. Um vídeo, ou um arquivo com mais de 50 MB, pergunta antes, e um zip não é copiado.
- **As configurações que você usou**, para seus últimos 24 downloads. **Exportações recentes**, abaixo do seu trabalho salvo em **Projetos**, reabre a ferramenta com essas configurações para que você possa gerar o arquivo de novo, embora imagens e arquivos que você adicionou do seu dispositivo não sejam incluídos. A mesma lista fica em **Configurações → Atividade e estatísticas → Exportações recentes** e na aba **Changes** de **History**. Essa lista guarda configurações, não os arquivos.

::: details Nos apps de desktop e mobile
- **App de desktop:** **Baixar** salva direto em uma pasta **Lolly** dentro da sua pasta **Downloads**, sem diálogo. Uma mensagem confirma o salvamento e oferece **Revelar** para mostrar o arquivo. **Open Exports Folder**, no menu **Window** ou **Exports**, abre a pasta a qualquer momento. Um arquivo com o mesmo nome de um anterior é salvo como "nome (1)".
- **iPhone e iPad:** o arquivo é salvo no app **Files**, em **Lolly**, e a folha de compartilhamento abre para que você possa enviá-lo adiante.
- **Android:** o menu de compartilhamento abre para que você escolha para onde o arquivo vai.

No iPhone, iPad e Android, um arquivo novo substitui um anterior com o mesmo nome.
:::

## Volte a uma versão anterior

- **Durante esta visita:** **Desfazer** volta pelas suas últimas 100 mudanças, até você sair da ferramenta ou recarregar. Veja [Desfazer e refazer](/info/using.html#undo-and-redo).
- **Nas nove ferramentas que salvam enquanto você trabalha:** versões anteriores de cada criação são mantidas. Siga os passos abaixo.
- **Tudo no dispositivo:** com a [Sincronização](/info/sync.html) ativada, **Restore an earlier copy**, em **Configurações → Serviços conectados**, traz de volta uma das últimas sete cópias diárias, ou a cópia de antes da sua última aplicação. Tudo neste dispositivo passa a corresponder àquela cópia, não só um design.

Para abrir uma versão anterior em uma das nove ferramentas:

1. Pressione **History**, o botão de relógio ao lado de **Desfazer** e **Refazer**. No Design, **History** fica na barra superior; no celular, toque em **•••** e depois em **History**.
2. Encontre a versão pela data e hora. Linhas de **Automatic checkpoint** são tiradas enquanto você trabalha; linhas de **Saved version** são os momentos em que você salvou.
3. Pressione **Open as a copy**. A versão abre como uma nova criação, e a que você tinha aberta continua como estava. A cópia fica em **Projetos**, com "(copy)" depois do nome.

Para manter uma versão com nome, pressione **Name version**, digite um nome e pressione **Keep milestone**. Versões nomeadas são listadas na página **History**, em **Milestones**.

::: details O painel History e a página History
O painel **History** também lista linhas de **Recovered work**, e **Protected drafts** guarda suas últimas edições entre checkpoints, com **Open draft as a copy**. **Compare** e **Check assets** ajudam você a escolher antes de abrir uma cópia. Alterne **This creation** para **All history on this device** para ver cada criação.

Automatic checkpoints se tornam mais espaçados com o tempo: um por minuto na última hora, um por hora no último dia, um por dia durante 30 dias, depois um por semana. Saved versions são todas mantidas. Excluir uma criação em **Configurações → Armazenamento** exclui suas versões também.

A página **History** (`#/history`, ou **Open app history** no painel) cobre cada criação neste navegador. No computador, abra a página pelo botão de relógio no canto superior direito da tela inicial ou de **Projetos**. No celular, vá até a galeria de ferramentas na tela inicial, toque no botão redondo do logo no canto superior direito e escolha **Saved sessions**, que abre History. Em **Projetos** esse item ainda não faz nada.

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

::: warning Importar substitui suas pastas
Se o outro dispositivo já tem trabalho, leia isto primeiro. Importar adiciona o que o arquivo contém, atualiza itens que correspondem e não exclui nenhum item salvo. Seu perfil é um único registro, porém, então as pastas, favoritos, modelos e detalhes naquele dispositivo são substituídos pelos do arquivo. Um item salvo que existia só naquele dispositivo permanece, no nível superior de **Projetos**. **Bring it to this device**, na Sincronização, faz o mesmo.
:::

Para mover tudo de uma vez:

1. No dispositivo antigo, abra **Configurações → Armazenamento** e, em **Move to another device**, pressione **Exportar meus dados**. O Lolly baixa um único arquivo `.zip` cujo nome começa com `LollyTools-`.
2. Leve o arquivo para o outro lado por USB, envie por e-mail para você mesmo, AirDrop ou uma pasta compartilhada.
3. No dispositivo novo, abra **Configurações → Armazenamento**, pressione **Import data…**, escolha o arquivo e pressione **Import**.

::: note O que fica para trás
Logins, chaves e a frase secreta de sincronização ficam em cada dispositivo. A lista de downloads recentes, downloads offline e modelos de IA não viajam por nenhum caminho. O histórico de versões viaja só em um arquivo de **Exportar meus dados**, não pela Sincronização ou por um `.lolly`. As cópias que a Sincronização guarda no seu armazenamento só abrem pela Sincronização, não com **Import data…** ou **Open**.
:::

::: details O que o arquivo de backup contém
O arquivo é nomeado `LollyTools-<First>-<Last>-<YYYY-MM-DD>-<n>.zip` (as partes do nome vêm do seu perfil e são descartadas se não estiverem definidas; `<n>` é um contador por dia para que exportações no mesmo dia não colidam). Ele contém seu perfil, com suas pastas, Lixeira, modelos e favoritos; cada sessão salva com sua miniatura; suas imagens, fontes e logos enviados e as cópias dos seus downloads; seus design systems; suas preferências (tema, largura da barra lateral, estatísticas locais de atividade); versões salvas e resultados do Convert; e, a partir do app web, o histórico de versões das suas criações.

O cache do catálogo não está incluído - ele se baixa de novo sozinho no dispositivo novo. Cada parte tem checksum, então um arquivo danificado no trajeto é detectado na importação em vez de ser restaurado pela metade. Sessões salvas se reconectam automaticamente às suas imagens importadas. Os apps web, de desktop e mobile leem o mesmo arquivo; o app de terminal grava um backup mais simples, próprio, que este formato não lê. **📦 Export my data & render everything** cria o mesmo arquivo mais um segundo zip com cada sessão salva renderizada para sua saída. (Especificação completa do formato: [Data Transfer](/info/data-transfer.html).)
:::

## Se você limpar os dados do seu navegador

No app web, o Lolly mantém tudo no armazenamento do seu navegador para este site: trabalho salvo, imagens, fontes, design systems, histórico de versões e downloads offline. Limpar os dados deste site no seu navegador remove tudo isso, e o Lolly não consegue trazer nada de volta. O que resta é o que já saiu do navegador: arquivos que você baixou, um arquivo de **Exportar meus dados**, uma cópia da [Sincronização](/info/sync.html) e links que você compartilhou.

::: warning Antes de limpar os dados do navegador
Pressione **Exportar meus dados** em **Configurações → Armazenamento**, e guarde o arquivo em outro lugar.
:::

Quando o app inicia, o Lolly pede ao navegador para não limpar seu armazenamento quando o dispositivo ficar sem espaço. O navegador decide. Em **Configurações → Disponível offline**, uma linha começando com **Protected** significa que o navegador concordou; "The browser may clear downloads if the device runs low on space" significa que não concordou, e **Protect downloads** pergunta de novo. Se o navegador não concordou, ele pode limpar trabalho salvo além de downloads quando o espaço acabar, então guarde um arquivo recente de **Exportar meus dados**.

**Configurações → Armazenamento** mostra quanto espaço cada tipo de dado usa. **Clear cache** descarta arquivos de catálogo baixados, que se baixam de novo quando necessário. **Limpar todos os meus dados** pede que você digite uma palavra, depois remove seu perfil, sessões salvas, imagens enviadas e o cache de ativos. Outros dados permanecem, incluindo histórico de versões, a lista de downloads recentes, resultados do Convert, design systems e modelos de IA baixados. Para remover tudo, limpe os dados deste site no seu navegador.

![O cartão de armazenamento em uma tela com largura de celular: cada categoria de dados no dispositivo nomeada, com o botão Limpar todos os meus dados embaixo](/t/url-shot?url=%2F%23%2Fprofile%3Ffocus%3Dstorage-section&width=430&height=1600&dpi=192&waitMs=2400&css=.welcome-dialog%2C.personalize-nudge%2C.store-manages%2C.storage-subsection%2C.store-selbar%2C.store-chip-val%2C%23store-hero-num%2C%23store-headroom%2C%23store-quota%2C%23store-reclaim%7Bdisplay%3Anone%7D&format=svg&walker=1&cropSelector=%23storage-section&dark=1&filename=pv-storage-clear)

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

Em **Projetos**, **Move to Trash** mantém um item por 30 dias. Uma pasta vai para a Lixeira com tudo dentro dela, como uma única entrada. Logo em seguida, uma mensagem oferece **Undo** por cerca de dez segundos. Depois disso:

1. Abra **Projetos** e pressione o bloco **Lixeira**. O bloco só aparece enquanto a Lixeira guarda algo.
2. Pressione **Restore** ao lado do item.

**Delete forever** e **Empty Trash** removem itens imediatamente, sem perguntar. Itens com mais de 30 dias são removidos definitivamente na próxima vez que você abrir Projetos.

::: warning Outras exclusões são permanentes
Excluir uma sessão salva em **Configurações → Armazenamento**, ou na lista de sessões salvas de uma ferramenta na galeria (clique com o botão direito no cartão da ferramenta, depois **N saved sessions**), remove a sessão definitivamente, com seu histórico de versões. Uma imagem que você exclui de **My images** é removida imediatamente, sem perguntar.
:::

Com a [Sincronização](/info/sync.html) ativada, **Restore an earlier copy** pode trazer de volta o estado de um dia anterior do dispositivo inteiro, e um arquivo de **Exportar meus dados** traz de volta o que o arquivo contém.
