# Política de Privacidade

*Última atualização: 23 de outubro de 2026*

**Criar coisas no Lolly acontece no seu dispositivo.** Abrir uma ferramenta, digitar, visualizar, exportar e verificar um arquivo rodam no app, no seu celular, computador ou navegador. Você não precisa de conta, e o app não define cookies para nada disso.

**O que você cria só sai do seu dispositivo quando você pede.** Adicionar uma Google Font, enviar um arquivo para o Drive ou o Dropbox, ativar o Sync, tocar o rádio ou baixar um modelo de IA no dispositivo geram, cada um, uma requisição que você iniciou. O app também busca suas ferramentas e atualizações no próprio endereço, e essas requisições não levam nada do que você criou. [Toda requisição de rede que o app pode fazer](#every-network-request-the-app-can-make) lista todas, host por host.

**Alguns serviços do Lolly rodam em um servidor.** Os links de renderização, o buscador de imagens, o endpoint para agentes de IA e o serviço de identidade verificada recebem apenas o que você envia e não o guardam por mais tempo do que esta página informa.

**A instância do Lolly Work da sua organização é diferente.** Ela armazena o trabalho compartilhado que você coloca lá, e a política do operador dela se aplica a esses dados, não esta.

::: figure privacy-where-data-goes
Para onde vão seus dados: eles ficam no seu dispositivo, a menos que você inicie uma requisição, e cada tipo de requisição tem seu próprio destino.
:::

## O que esta política cobre

O Lolly é um software de código aberto que qualquer pessoa pode executar: um motor, shells de app para web, desktop, celular e terminal, e uma extensão de navegador. Esta política tem duas partes:

- <!--i:code--> **O software em si**: o que ele faz e não faz com seus dados, onde quer que rode. Isso é uma propriedade do código, então vale para toda implantação do Lolly, nossa ou de qualquer outra pessoa.
- <!--i:server--> **lolly.tools**, a implantação de referência operada pela SUSE: as escolhas feitas ao operar suas peças opcionais de servidor, como o que é registrado em log, por quanto tempo e por quem.

Em uma instância do Lolly auto-hospedada ou corporativa, o comportamento do software descrito abaixo continua valendo, mas o *operador* dessa instância, não a SUSE, é responsável por tudo o que estiver nos servidores dele: o endpoint de renderização, o servidor MCP, o serviço de certificados e a instância do Lolly Work. Peça a política própria dele. [Adoption & Governance](/info/adoption-governance.html) descreve o que envolve operar o Lolly.

## O que fica no seu dispositivo

Os apps web, desktop e mobile do Lolly executam todo o motor de renderização no dispositivo. Depois que as ferramentas, os recursos e os codificadores que você usa estão no dispositivo, renderizar e baixar não exigem servidor.

**O uso do app autônomo não define cookies.** O login da organização e o cadastro opcional de identidade verificada têm cookies próprios, descritos nas respectivas seções. O app guarda estes registros no dispositivo:

- <!--i:sliders--> **Preferências da interface**: tema, idioma, configurações de som, tamanhos da barra lateral e do zoom, escolhas de ordenação e de visualização e quais dicas você já viu, em `localStorage`, para que estejam prontas antes de o app terminar de iniciar.
- <!--i:download--> **Um cache offline do catálogo de ferramentas e das prévias de recursos**, para que a galeria funcione sem conexão.
- <!--i:hash--> **Contadores locais de uso** para as estatísticas do seu cartão de perfil, como quantas exportações e quais ferramentas: um pequeno registro limitado em `localStorage`, nunca lido por nós e nunca enviado a lugar nenhum.
- <!--i:folder--> **Seu próprio trabalho**: documentos, sessões salvas e seu histórico, imagens e fontes enviadas, resultados de arquivos e versões anteriores, e a Lixeira, que guarda os itens excluídos por 30 dias. Eles ficam no IndexedDB do dispositivo e permanecem lá, a menos que você escolha o Sync ou o compartilhamento.
- <!--i:globe--> **As consultas de cidades do Meeting Planner**, em `localStorage`, para que cada cidade seja consultada uma única vez.
- <!--i:cpu--> **Modelos baixados e ferramentas fixadas**: modelos de IA no dispositivo que você aceitou baixar e ferramentas que você fixou para uso offline.

**Settings → Storage** mostra quanto espaço o Lolly usa no dispositivo, com seu trabalho, a Lixeira, os modelos baixados, as cópias offline e os caches listados um a um. **Clear all my data** ali remove a cópia local e desativa o Sync antes; limpar o armazenamento do site no navegador faz o mesmo. O armazenamento estritamente necessário para o serviço que você pediu não exige consentimento pela Diretiva ePrivacy (Art. 5(3)), apenas transparência, que é o que este documento e o aviso no app oferecem.

![A seção de armazenamento das Configurações em uma tela do tamanho de um celular: todas as categorias de dados no dispositivo nomeadas, com o botão Clear all my data ao lado da lista](/t/url-shot?url=%2F%23%2Fprofile%3Ffocus%3Dstorage-section&width=430&height=1600&dpi=192&waitMs=2400&css=.welcome-dialog%2C.personalize-nudge%2C.store-selbar%2C.profile-row-value%2C.profile-group-value%2C%23store-hero-num%2C%23store-headroom%7Bdisplay%3Anone%7D&format=svg&waitSelector=%5Bdata-store-group%3Dmove%5D&drive=click%3A%5Bdata-store-group%3Dwork%5D%3Esummary%3Bclick%3A%5Bdata-store-group%3Dcaches%5D%3Esummary&walker=1&cropSelector=%23storage-section&dark=1&filename=pv-storage-clear)

**Export my data** gera um arquivo `lolly-backup` que fica com você e sob seu controle. Ele nunca passa pelos nossos servidores, a menos que você mesmo o envie a algum lugar. Veja [Data transfer](/info/data-transfer.html).

### Utilitários que rodam no seu dispositivo

Algumas ferramentas, como **Strip Hidden Data**, **Compress** e outras com o selo **Runs on your device**, trabalham com um arquivo que você fornece. O arquivo é lido na memória, transformado no dispositivo e devolvido como download. Ele nunca é enviado, porque não há servidor no caminho. Esses utilitários funcionam offline, e o resultado deles não leva marca d'água nem metadados nossos.

O **Rondocode** é a única exceção, porque cria áudio novo a partir da sua música em vez de transformar um arquivo seu. Todo arquivo de áudio que ele grava leva Content Credentials que registram a música e declaram qualquer canto gerado por IA. O painel Export avisa isso antes de você exportar, e [Rondocode songs](/info/rondocode.html#files-from-the-rondocode-utility) lista exatamente o que é registrado.

![O selo que essas ferramentas exibem: Runs on your device - nothing is uploaded](/t/url-shot?url=%2F%23%2Ftool%2Ftext-helper&width=1440&height=900&dpi=192&waitMs=2400&walker=1&format=svg&cropSelector=%5Bdata-privacy%5D&dark=1&filename=pv-ondevice-badge)

**Prepare for sharing** e **Compare** trabalham na memória do dispositivo e não enviam nada a um servidor, e o Prepare não adiciona nada ao histórico, aos links, aos backups nem ao Sync até você salvar um resultado.

::: details Como o Prepare for sharing e o Compare tratam seus arquivos
**Prepare for sharing** mantém entradas de trabalho, achados privados e mapas de substituição na memória, sem adicioná-los ao histórico, aos links, aos backups nem ao Sync. A inspeção e a substituição não enviam o conteúdo dos arquivos a nenhum servidor e não verificam credenciais online. Você escolhe se quer copiar, baixar, enviar ou salvar um resultado na sua biblioteca; um resultado salvo passa então a seguir as configurações de backup e Sync da sua biblioteca. Os arquivos de receita omitem conteúdo anterior e mapeamentos literais, e os relatórios-resumo contêm contagens, IDs de escopo e hashes de arquivo. A CLI só salva um arquivo de revisão privado com os valores originais quando isso é pedido com `--review-file`. Sair de uma tela de preparação libera o estado de trabalho dela, o que não é uma promessa de apagamento forense da memória do navegador ou do sistema operacional.

As cópias preparadas e as operações de arquivo concluídas compartilham os controles do Compare. Os valores removidos começam recolhidos, e os relatórios de comparação omitem nomes de origem, caminhos e valores, a menos que você escolha incluí-los. O histórico de arquivos salva a cópia, então comparar depois de recarregar significa selecionar o original de novo, identificado pelo SHA-256 registrado. Selecioná-lo não salva nem envia o arquivo.
:::

O Strip Hidden Data e o Prepare for sharing também inspecionam arquivos DOCX, PPTX e XLSX no dispositivo. Nos arquivos DOCX compatíveis, é possível remover propriedades selecionadas em uma nova cópia; o restante do conteúdo do Office é apenas para inspeção, e as prévias privadas ficam atrás de um controle de revelação.

::: details O que a inspeção do Office lê e remove
| Formato do Office | Conteúdo do pacote inspecionado | Remoção compatível |
|---|---|---|
| DOCX | Propriedades principais, de aplicativo e personalizadas; comentários e autores; marcadores e prévias de controle de alterações; trechos de texto oculto; relações externas; objetos incorporados | Autor, última modificação por, datas de criação/modificação/última impressão, título, assunto, descrição, palavras-chave, propriedades personalizadas, Company, Manager, Template, base de hiperlink, nome e versão do aplicativo e estatísticas (tempo total de edição e contagens de páginas, palavras, caracteres, linhas e parágrafos), quando selecionados |
| PPTX | Propriedades; comentários e registros de autor; notas do apresentador; marcadores de slides ocultos; relações externas; objetos incorporados e pastas de trabalho aninhadas compatíveis | Nenhuma |
| XLSX | Propriedades; comentários e notas; marcadores de planilhas, linhas e colunas ocultas; nomes definidos; relações e conexões externas; superfícies de vínculos externos e de cache de tabela dinâmica; objetos incorporados | Nenhuma |

**Limites.** O censo não inspeciona por completo o texto visível, as fórmulas, as dependências, a aparência renderizada nem partes binárias arbitrárias. Ele aceita até 300 partes de pacote, 64 MiB de expansão total declarada, 2 MiB por parte XML e dois níveis de pacotes incorporados aninhados; o Prepare divide os orçamentos de partes e de expansão entre todo o trabalho. Conteúdo truncado, malformado, criptografado e não compatível é informado e mantido. Conteúdo com macros é identificado e nunca executado, os formatos binários antigos do Office e o XLSB não são inspecionados, e as referências externas nunca são buscadas.

**O que a limpeza de DOCX mantém.** A limpeza aceita o formato de pacote DOCX transicional, com partes de propriedades principais, personalizadas e estendidas canônicas. Das propriedades estendidas, podem ser removidos Company, Manager, Template, HyperlinkBase, Application, AppVersion e as estatísticas TotalTime, Pages, Words, Characters, CharactersWithSpaces, Lines e Paragraphs. DocSecurity, títulos de cabeçalhos e partes, indicadores de links e outras propriedades do aplicativo são mantidos. Remover Template deixa qualquer link de modelo anexado nas configurações do documento, onde o censo o informa como uma relação externa.

Alguns leitores escolhem como desenhar gráficos e desenhos com base no nome e na versão do aplicativo; o LibreOffice, por exemplo, mostra de outro jeito um gráfico de um arquivo do Word 2007 sem eles. Ambos são mantidos quando o arquivo contém gráficos, imagens, formas ou objetos incorporados, e a inspeção os lista como mantidos. Uma propriedade exibida por um campo do Word (TEMPLATE, EDITTIME, NUMPAGES, NUMWORDS ou NUMCHARS) é mantida, e os campos de link e os links externos relativos mantêm o HyperlinkBase, porque seus destinos são resolvidos a partir desse endereço base.

**O que continua apenas para inspeção.** Dados estendidos de assinatura digital impedem a limpeza. Pacotes do Office assinados, com macros, criptografados, malformados, renomeados ou aninhados ficam apenas para inspeção. O mesmo vale para arquivos com outros campos do Word que dependem de propriedades, como DOCPROPERTY ou AUTHOR, ou com controles de conteúdo vinculados a XML, porque remover uma propriedade poderia alterar o documento quando o Word atualizasse esses vínculos, e o texto em cache dos campos não consegue mostrar que a próxima renderização ficará igual. Partes XML com extensões de nome de arquivo incomuns, destinos de relação XML do Word que não podem ser inspecionados com segurança, partes de cabeçalho ou rodapé declaradas incorretamente e partes SVG declaradas como XML com extensão `.svg` também ficam apenas para inspeção nesta primeira versão da limpeza.

**Como a limpeza confere o próprio trabalho.** As partes de propriedades, suas declarações, membros do pacote não relacionados, comentários XML e comentários ZIP são mantidos. A limpeza aplica os limites do censo e verifica a integridade de cada membro antes de gravar, depois inspeciona de novo as propriedades resultantes. O Compare mostra as diferenças de propriedades compatíveis com os valores recolhidos; ele não compara o texto visível nem a aparência renderizada. Os valores usam prévias de até 2048 caracteres, então diferenças além de uma prévia podem não aparecer, e uma revisão parcial não consegue estabelecer que dois arquivos são iguais. O `prepare --strip-hidden-data` da CLI remove as propriedades de DOCX compatíveis, e um envelope de revisão privado pode selecionar propriedades individuais. Se uma verificação da limpeza falhar, o arquivo é mantido e uma operação com falha é informada.
:::

## Cada requisição de rede que o app pode fazer

A maioria das requisições traz ferramentas, fontes ou modelos para o seu dispositivo. As ações de envio transmitem o arquivo que você escolheu, o Sync transmite um backup para o armazenamento que você escolheu, e os serviços da organização transmitem o conteúdo ou os dados necessários para o trabalho compartilhado. Cada grupo abaixo lista o que sai do seu dispositivo, quando, e o que acontece se um operador bloquear a requisição. Os provedores de identidade e de recursos configurados por um operador podem adicionar destinos a essa implantação. [Cada host fixo, em uma tabela](#every-fixed-host-in-one-table) lista os hosts que o app web pode contatar.

::: details Itens buscados para o seu dispositivo
- <!--i:download--> **O catálogo de ferramentas.** Nada pessoal: uma requisição ao índice público de ferramentas e recursos do próprio Lolly, no endereço do app, ao iniciar e depois mantido em cache offline. Se for bloqueada, o app roda com as ferramentas em cache e deixa de descobrir novas.
- <!--i:sparkle--> **Conjuntos de emoji.** O conjunto que você escolhe é baixado do endereço do próprio app na primeira vez que o usa. Nada pessoal é enviado. As animações Lottie são lidas no dispositivo e não contatam ninguém.
- <!--i:document--> **Google Fonts.** O nome da família escolhida e seu endereço IP vão para os servidores de fontes do Google (`fonts.googleapis.com` para a folha de estilos, `fonts.gstatic.com` para o arquivo da fonte). Isso só acontece quando você adiciona uma Google Font no Design System Setup, e somente depois de concordar em uma caixa de diálogo que diz exatamente isso. Cada família é buscada uma vez, depois mantida no dispositivo e usada offline. Se for bloqueada, o seletor falha de forma segura; envie um arquivo de fonte no lugar.
- <!--i:cpu--> **Modelos de IA no dispositivo.** Nada pessoal: o download de um arquivo de modelo, que depois fica no dispositivo. As versões web usam por padrão o endereço do próprio app; uma versão pode indicar outro host de modelos, como o host de lançamentos do Lolly, `lolli.li`, nos apps empacotados. O host recebe a requisição e seu endereço IP, sem conta e sem entradas do modelo. Isso só acontece quando você usa um recurso que precisa de um modelo (a verificação profunda do Verify, ampliação de imagens, fala e similares) ou escolhe baixar modelos para uso offline. Se for bloqueada, esse recurso espera e todo o resto funciona.
- <!--i:sliders--> **Perfis de impressão ICC.** Nada pessoal: uma requisição de um perfil padrão de condição de impressão ao registro público do ICC (`registry.color.org`, `www.color.org`), somente quando você clica em uma predefinição ICC no gerenciador de perfis de impressão, uma vez por perfil. Se for bloqueada, as predefinições falham; forneça seu próprio perfil `.icc`.
- <!--i:globe--> **Rádio pela internet.** Nada pessoal: uma requisição de playlist e um stream de áudio da estação (`api.somafm.com` e o servidor de stream para o qual ela aponta, `*.somafm.com`), somente enquanto você toca o rádio opcional no player de som. Se for bloqueada, o rádio falha e todos os outros recursos de som funcionam.
:::

::: details Uma ferramenta que precisa de dados ao vivo
- <!--i:globe--> **A consulta de cidades do Meeting Planner.** Hoje é a única ferramenta que busca dados ao vivo. Ela pede a `geocoding-api.open-meteo.com` que transforme o nome de cada cidade (a cidade anfitriã e a de cada integrante da equipe) em coordenadas e fuso horário, sem conta, sem chave e sem nenhum identificador além da própria requisição. A entrada Host city explica isso, e cada resposta é salva no dispositivo para que uma cidade seja consultada uma única vez. Ela só roda enquanto a ferramenta está aberta. Se for bloqueada, a consulta falha e nada mais é afetado.
:::

::: details Arquivos que você envia
Cada um destes envia apenas o arquivo que você escolheu, quando você pressiona o botão Send correspondente, depois de um login que você conclui na janela do próprio serviço. A senha de app do Bluesky, o endereço do webhook do Discord, a senha de app do Nextcloud e as chaves do S3 ficam armazenados somente neste dispositivo, nunca em um backup, e **Disconnect** apaga todos eles.

- <!--i:upload--> **Google Drive.** O arquivo, em qualquer formato, vai para a API do Drive do Google (`www.googleapis.com`). O acesso do Lolly se limita aos arquivos que ele criou (o escopo `drive.file`), então ele nunca pode ler o resto do seu Drive. No app web, o token de login fica na memória durante a sessão e nunca é armazenado; nos outros apps, um token de atualização é armazenado somente neste dispositivo se você marcar **Stay connected**. O botão só existe em versões nas quais o operador configurou um client id do Google. Se for bloqueado, o botão nunca aparece; baixe o arquivo e envie você mesmo.
- <!--i:upload--> **Dropbox.** O arquivo vai para a API do Dropbox (`api.dropboxapi.com` para login e metadados, `content.dropboxapi.com` para o arquivo). O acesso é somente à pasta do app, então o Lolly vê `Apps/` e a própria pasta ali, e nada mais. O link **Open** que ele mostra é um link privado de curta duração, e nenhum compartilhamento público é criado. Um token de atualização só é armazenado se você marcar **Stay connected**. O botão só existe com um client id do Dropbox configurado pelo operador.
- <!--i:upload--> **OneDrive.** O arquivo vai para os serviços de identidade e Graph da Microsoft (`login.microsoftonline.com` para login, `graph.microsoft.com` para o envio); um arquivo grande é enviado em partes para `api.onedrive.com` ou para origens de armazenamento configuradas pelo operador. O acesso se limita à pasta do próprio Lolly em `Apps/`, além do seu nome de exibição para o rótulo da conta. Um token de atualização só é armazenado se você marcar **Stay connected**. O botão só existe com um client id da Microsoft configurado pelo operador.
- <!--i:upload--> **LinkedIn**, **somente nos apps desktop**. O arquivo, com o nome dele como texto da publicação, vai para o LinkedIn (`www.linkedin.com` para login no seu próprio navegador, `api.linkedin.com` para o envio e a publicação) como uma publicação pública no seu próprio feed. O Lolly pode publicar como você e ler seu nome para o rótulo da conta, nada além disso. O login só é mantido se você marcar **Stay connected**, e os tokens do LinkedIn duram 60 dias e não podem ser renovados em silêncio, então ele expira sozinho. Esses hosts não estão na política de conexão do app web. O botão só existe em versões com um app do LinkedIn configurado.
- <!--i:upload--> **Penpot.** Seu token de acesso pessoal do Penpot, que você cola no app, e o arquivo `.penpot` do design vão para a API do Penpot (`design.penpot.app`) por meio de um pequeno repasse no endereço do próprio app (`/api/penpot`), porque a API do Penpot não responde diretamente a um navegador. O repasse encaminha e esquece; os apps desktop falam diretamente com o Penpot. Isso só acontece quando você pressiona **Send to Penpot** na ferramenta Design e confirma um projeto. Se for bloqueado, o envio falha de forma segura; exporte o arquivo `.penpot` e importe você mesmo.
- <!--i:upload--> **Bluesky.** A imagem, o nome dela como texto da publicação e texto alternativo, e seu identificador e senha de app (criada em Bluesky → Settings → App passwords, nunca a senha da sua conta) vão para o servidor Bluesky que você indicar, `bsky.social`, a menos que escolha outro. Você conecta a conta antes em **Settings → Connected services**.
- <!--i:upload--> **Discord.** O arquivo vai como anexo para o endereço de webhook do canal que você colou, em discord.com. Quem tem um endereço de webhook pode publicar naquele canal, e é por isso que ele fica no dispositivo.
- <!--i:upload--> **Mastodon.** O arquivo, com o nome dele como texto da publicação, vai para o servidor Mastodon ou compatível que você indicar, depois de um login na janela do próprio servidor. Conectar registra nesse servidor um pequeno app para este dispositivo, e o login só é mantido se você marcar **Stay connected**.
- <!--i:upload--> **Nextcloud ou WebDAV.** O arquivo vai para o seu próprio servidor em um único envio autenticado, com o endereço do servidor, o nome de usuário e a senha de app que você informou (Nextcloud → Settings → Security → Devices & sessions; nunca a senha da sua conta).
- <!--i:upload--> **Armazenamento compatível com S3.** O arquivo vai para o seu próprio bucket (AWS S3, MinIO, R2, B2, Garage ou qualquer endpoint SigV4), assinado no dispositivo com o par de chaves que você informou.

**Hosts que você escolhe precisam da aprovação do operador.** Os hosts de Bluesky, Discord, Mastodon, Nextcloud e S3 não estão na lista fixa do Lolly, porque é você quem os escolhe. O app não envia nada a nenhum deles até o operador aprovar exatamente aquele host HTTPS: na web, na Content Security Policy da implantação; nos apps desktop, quando o app é compilado. O mesmo vale para hosts de armazenamento personalizado e de envio para o SharePoint. Na web, o servidor também precisa permitir chamadas do navegador a partir do app (CORS), e um redirecionamento falha de forma segura, então use um endereço que não redirecione. Os apps desktop conferem cada redirecionamento com a lista aprovada.

Esta lista limita quais hosts o app pode alcançar. Ela não distingue contas ou tenants no Google ou na Microsoft, e as permissões do próprio provedor decidem quais contas e ações são permitidas. Também não cobre janelas de login, outros tipos de recurso nem recursos nativos, que têm regras próprias. Uma mudança exige uma nova versão desktop ou novos cabeçalhos de resposta da web; salve seu trabalho antes de reabrir o app para aplicá-la. [Connector origins](/info/connector-origins.html) descreve a configuração.
:::

::: details Sync entre os seus dispositivos
- <!--i:folder--> **O que sai.** Uma cópia do que você criou neste dispositivo (sessões e projetos salvos, seus sistemas de design com as fontes e os logotipos, imagens enviadas, seu perfil e preferências) como um único arquivo, para o único armazenamento que você escolheu: a pasta do app Lolly no seu Dropbox (`api.dropboxapi.com`, `content.dropboxapi.com`), arquivos criados pelo Lolly no seu Google Drive (`www.googleapis.com`), a pasta do app Lolly no seu OneDrive (`graph.microsoft.com`, com arquivos maiores enviados a `api.onedrive.com` ou a origens de armazenamento configuradas pelo operador, e downloads de origens de armazenamento exatas configuradas pelo operador), ou o seu próprio Nextcloud, servidor WebDAV ou bucket S3. O mesmo armazenamento mantém até sete cópias diárias e uma cópia de antes da sua última aplicação.
- <!--i:shieldcheck--> **Nada vai para o Lolly.** Nenhum servidor do Lolly, retransmissor ou servidor do Lolly Work está no caminho, e os apps não precisam de nenhum site do Lolly para isso, nem para fazer login. A cópia só é criptografada antes no dispositivo se você definir uma senha secreta. Logins, chaves, senhas de app, a senha secreta e as configurações do Sync ficam no dispositivo e nunca estão na cópia. Na web, uma conexão lembrada com o Google Drive guarda apenas o nome da sua conta (e o seu próprio client id, se você informou um), e o login do Google dura uma visita. No app Android, o login do Google Drive passa pelo Google Play Services no celular, que o Google opera.
- <!--i:sliders--> **Quando.** Somente depois que você ativa **Sync across my devices** ou pressiona **Sync now**: um envio logo após cada alteração e ao sair do app, e uma verificação de cópia mais recente quando o app inicia. Se for bloqueado, o Sync falha e diz por quê, e seu trabalho permanece no dispositivo. Em vez disso, você pode exportar seus dados para um arquivo e movê-lo por conta própria. [Sync your devices](/info/sync.html) trata desse recurso.
:::

::: details Páginas web, capturas e imagens de outros sites
- <!--i:monitor--> **Uma URL que você pede a uma ferramenta para capturar.** A ferramenta de captura de URL requisita o endereço exato que você digita, somente quando você inicia a captura. Como você escolhe o endereço nesse momento, ele não está na política de conexão, e um operador não pode permiti-lo nem bloqueá-lo por host; para removê-lo, remova a ferramenta.
- <!--i:globe--> **Uma página web em uma caixa do Design.** A página é requisitada, com o seu endereço IP, ao site de onde vem, junto com tudo o que a própria página requisitar. Onde o navegador permite, o quadro não recebe cookies nem endereço além da origem do próprio app, então seu documento e o link dele nunca viajam com a requisição. No app web, só estes players podem ser incorporados em quadros: `www.youtube-nocookie.com`, `player.vimeo.com`, `www.loom.com`, `www.google.com` (mapas) e `www.figma.com`, além de páginas de referência em `wikipedia.org` e `*.wikipedia.org`, `commons.wikimedia.org`, `upload.wikimedia.org`, `www.wikidata.org`, `www.mediawiki.org` e `www.openstreetmap.org`. **Allow pages from any site**, em **Settings → Trusted sites**, recarrega o Lolly no seu dispositivo sob uma política que pode incorporar em quadro qualquer página `https:`, e as mesmas regras de confiança e de pedido de permissão continuam valendo. Uma página só carrega para um site que esteja nos seus Trusted sites, incluindo os padrões de referência removíveis, ou depois que você aprova aquela caixa no inspetor dela; um deck que alguém enviou a você mostra uma imagem de cada página até lá. Antes de apresentar, a lista oferece **Just this time** e **Always trust** para cada site, e nada é perguntado durante a apresentação. Se for bloqueada, a caixa mostra a imagem dela com um link para abrir a página em uma nova aba. As ferramentas do Lolly e as demos do Sandbox em uma caixa rodam no endereço do próprio app e não contatam ninguém.
- <!--i:sliders--> **Alterar uma página que você mostra.** A ação **Use page** de uma caixa de página web permite rejeitar cookies ou fechar um banner dentro da página. Para páginas acessíveis do Lolly, **Hide cookie banners** oculta sobreposições conhecidas, incluindo o OneTrust, sem aceitar cookies nem alterar a escolha de consentimento do site. **Page CSS** altera a página ao vivo e a apresentação daquela caixa; as exportações continuam usando o pôster escolhido. As regras não podem importar recursos nem fontes, e os navegadores impedem o Lolly de alterar o CSS de outro site. As prévias do Sandbox têm seu próprio editor de CSS em **Edit in Sandbox**.
- <!--i:code--> **Os recursos web de uma demo do Sandbox.** Cada folha de estilos, script, fonte ou imagem a que o código da demo se vincula é requisitada, com o seu endereço IP e sem cookies, ao site que a hospeda; os arquivos que uma folha de estilos buscada nomeia, como os arquivos de fonte do Google Fonts, contam como sites separados. Isso só acontece depois que você clica em **Fetch & inline**, ou para um site que esteja nos seus Trusted sites; **Always trust** ao lado de um arquivo adiciona o site dele a essa lista. Se for bloqueada, a demo roda sem esses arquivos, e o Sandbox lista cada arquivo que não conseguiu buscar e o motivo.
- <!--i:download--> **Adicionar uma imagem de uma URL.** **Add from URL** no seletor de recursos ou em Assets requisita o endereço exato da imagem que você cola. A política do próprio app web impede o navegador de buscar outro site diretamente, então um pequeno repasse no endereço do próprio app (`/api/fetch-image`) busca a imagem e devolve apenas os bytes; ele não armazena nada, esquece o endereço e recusa tudo o que não for um endereço de imagem público. Os apps desktop buscam o endereço diretamente. Um link do Lolly que você cola não é buscado de forma alguma: ele é renderizado no dispositivo. Se o operador desativar o repasse (`LOLLY_DISABLE_IMAGE_PROXY=1`), só é possível adicionar links do Lolly, imagens `data:` e imagens de mesma origem no app web, e os apps desktop não são afetados.
- <!--i:palette--> **Um sistema de design a partir de um site.** O Design System Setup pode ler uma página de um site que você indicar, pela [extensão de navegador](#the-browser-extension) ou pela busca do próprio app desktop, nunca por um servidor do Lolly. Nada é buscado antes de você pressionar, e os links da página não são seguidos.
:::

::: details Trabalhar com outras pessoas e agentes
- <!--i:link--> **Um collab privado.** Dois dispositivos se conectam diretamente, sem servidor no meio. O convite e a resposta levam os endereços que cada dispositivo enxerga na própria rede, e esta versão não configura nenhum servidor externo de descoberta de endereços, então entregue-os apenas à pessoa com quem você está trabalhando. Veja [Working together](/info/collaborate.html).
- <!--i:monitor--> **Nearby**, no app desktop. Enquanto você está visível, o que dura dez minutos quando você inicia um convite de collab ou, se você ativar isso, sempre que o app estiver em execução, o app anuncia na rede local um nome aleatório, o nome de exibição que você escolheu e o tipo de dispositivo. Ele não anuncia endereço de e-mail, conta nem identificador duradouro.
- <!--i:link--> **Convidar um agente.** O estado do documento convidado, as prévias que o agente pede, a identidade do agente e as edições dele passam pelo retransmissor ao vivo configurado (`lolly.ing` no lolly.tools) até o agente que você convida. Um plugin hospedado instalado também encaminha chamadas pelo conector do lolly.tools ao retransmissor que o convite seleciona; o conector não guarda convite nem documento entre as chamadas. O retransmissor mantém convites e requisições pendentes na memória até você se desconectar ou eles expirarem: dez minutos para um convite não usado e trinta minutos sem atividade para um convite já aceito. O provedor do seu agente trata os dados que recebe segundo a própria política. Isso só acontece depois que você cria um convite em Share e entrega as instruções dele ao seu agente; o acesso de leitura permite inspeção e o acesso de edição também permite alterações. Pause interrompe as alterações, e Disconnect ou a revogação do convite encerra o acesso. Se for bloqueado, o agente não consegue entrar nem continuar, e você segue editando.
- <!--i:cpu--> **Allow AI control**, no app desktop. Um agente executado neste computador pode ler e editar o documento do Design aberto por meio de uma conexão que permanece no computador. Ela fica desativada até você ativá-la. O Lolly não envia nada a um servidor por causa dela; o provedor do agente trata o que o agente lê segundo a própria política. [Threat Model & Trust Boundaries](/info/threat-model.html) lista o que um agente assim pode e não pode fazer.
- <!--i:server--> **Uma instância remota.** Quando você aponta o app para outra implantação do Lolly, ele recebe o que essa instância servir, pela mesma sincronização de catálogo, além de uma etiqueta de versão nas requisições a ela (o tipo de app e a versão do motor, as mesmas informações que um user agent carrega), para que o operador dela veja quais versões do Lolly estão em uso. Em uma instância gerenciada, enquanto você estiver logado, a etiqueta também leva um id de instalação deste dispositivo, para que a lista de dispositivos do operador consiga distinguir as instalações; sair apaga o id, e um dispositivo que se reconecta depois apresenta um novo. Você escolhe o host, então ele não está na política de conexão. Se for bloqueada, a troca falha e a sua instância local não é afetada.
- <!--i:people--> **A instância do Lolly Work da sua organização.** A identidade de login e informações do dispositivo, requisições de política, as sessões compartilhadas, edições de colaboração, envios, submissões de aprovação e arquivos de entrega que você usa, e rótulos de eventos de uso permitidos, onde configurados, vão para a instância da sua organização, com login pelo provedor de identidade dela. Atualizações de política e telemetria ativada podem rodar durante o uso; trabalho compartilhado, collabs, revisão e entrega enviam conteúdo como parte desses fluxos. Se for bloqueado, esses recursos da organização não conseguem ser concluídos, e o seu trabalho pessoal continua separado. Veja [Organisation services with Lolly Work](#organisation-services-with-lolly-work).
:::

### Cada host fixo, em uma tabela

A Content Security Policy do app web é o que impede um script de alcançar qualquer host que ela não liste. Além do endereço do próprio app, a tabela traz todos os hosts que essa política lista, mais os dois hosts do LinkedIn que os apps desktop acrescentam, marcados como somente desktop. Um teste de CI confere esta tabela com a política implantada, então um host não pode ser adicionado a uma sem a outra.

| O quê | O que realmente sai do seu dispositivo | Hosts |
|---|---|---|
| Modelos no dispositivo nos apps empacotados e arquivos de lançamento | Uma requisição de um arquivo público, com o seu endereço IP | `lolli.li` |
| Google Fonts | O nome da família da fonte e o seu endereço IP | `fonts.googleapis.com`, `fonts.gstatic.com` |
| Enviar para e Sync com o Google Drive | O arquivo ou backup que você escolheu | `www.googleapis.com` |
| Enviar para e Sync com o Dropbox | O arquivo ou backup que você escolheu | `api.dropboxapi.com`, `content.dropboxapi.com` |
| Enviar para e Sync com o OneDrive | O arquivo ou backup que você escolheu e o seu nome de exibição para o rótulo da conta | `login.microsoftonline.com`, `graph.microsoft.com`, `api.onedrive.com` |
| Consulta de cidades do Meeting Planner | O nome de cada cidade | `geocoding-api.open-meteo.com` |
| Perfis de impressão ICC | Uma requisição de um perfil público | `registry.color.org`, `www.color.org` |
| Rádio pela internet | Uma requisição de playlist e um stream de áudio | `api.somafm.com`, `*.somafm.com` |
| Convidar um agente e o espaço de trabalho lolly.ing | O estado do documento convidado, prévias e edições, e as requisições de espaço de trabalho que você faz | `lolly.ing` |
| Players em uma caixa web do Design | Uma requisição da página, com o seu endereço IP | `www.youtube-nocookie.com`, `player.vimeo.com`, `www.loom.com`, `www.google.com`, `www.figma.com` |
| Páginas de referência em uma caixa web do Design | Uma requisição da página, com o seu endereço IP | `wikipedia.org`, `*.wikipedia.org`, `commons.wikimedia.org`, `upload.wikimedia.org`, `www.wikidata.org`, `www.mediawiki.org`, `www.openstreetmap.org` |
| Enviar para o LinkedIn, somente nos apps desktop | O arquivo, com o nome dele como publicação pública | `www.linkedin.com`, `api.linkedin.com` |

A lista própria dos apps desktop também inclui o endpoint de token do Google para o login do Drive. Qualquer outro host, como um servidor Mastodon ou Nextcloud que você indicar, precisa da aprovação do operador, como descrito em Arquivos que você envia. Hosts que você escolhe no momento do uso, como uma URL que você captura ou uma instância remota que você indica, não aparecem em nenhuma lista.


**As assinaturas SEAL não fazem nenhuma requisição.** O Verify consegue conferir assinaturas SEAL, um esquema cuja chave de assinatura pode ser publicada no DNS. Navegadores não conseguem fazer consultas DNS, então uma consulta pela web teria de passar por um resolvedor DNS-over-HTTPS de terceiros, que veria o domínio verificado e o seu endereço IP. O Lolly já usou o resolvedor da Cloudflare; hoje não usa mais, e nada substituiu a Cloudflare. Nenhum app do Lolly consulta chaves SEAL hoje: os apps desktop e mobile executam a mesma tela do Verify, e o `lolly validate` da linha de comando não verifica SEAL. Um arquivo cujo registro SEAL traz a chave embutida é verificado offline, e o Verify considera a assinatura internamente consistente sem confirmar o domínio. Um arquivo cuja chave existe apenas no DNS mostra **SEAL signature did not verify**, com o motivo "no key resolver and no inline key".

![A tela do Verify: uma área para soltar o arquivo e nada mais - o arquivo é verificado onde já está, sem envio e sem conta](/t/url-shot?url=%2F%23%2Fverify&width=1440&height=900&dpi=192&waitMs=1400&walker=1&format=svg&cropSelector=.valid-layout&dark=1&filename=cc-verify-drop)

Você mesmo pode conferir isto e todas as outras afirmações desta página: [Verify It Yourself](/info/verify-yourself.html) traz os comandos e o resultado esperado.

## Serviços que o lolly.tools executa

Estes rodam no lolly.tools para todas as pessoas. Cada um recebe apenas o que você envia. [Server Surface](/info/server-surface.html) descreve os mesmos componentes como funcionam em qualquer implantação.

### Links de renderização

Toda URL `https://lolly.tools/tool/<tool-id>.<ext>?<inputs>` renderiza de verdade, e as entradas dela viajam na URL, então um link do Lolly compartilhado pode aparecer como imagem ao vivo em um README, em uma wiki ou em um painel. Buscar um deles pede ao servidor que renderize **dados públicos de ferramentas e do catálogo** com as entradas escritas no endereço.

- <!--i:usercheck--> **Sem contas, sem cookies, sem estado.** A rota não pede login, e nada no seu dispositivo é lido. Seus documentos, sessões e envios nunca saem do seu navegador e não podem aparecer nesses links.
- <!--i:document--> **A própria URL é registrada.** A query string de uma URL faz parte da requisição, então aparece nos logs de acesso comuns da plataforma de hospedagem, como qualquer caminho requisitado. Se as entradas de um link contêm o nome ou o endereço de e-mail de alguém, como um crachá ou uma assinatura de e-mail poderia conter, **esse texto fica nesses logs**. Dê a um link de renderização apenas o que você colocaria em uma página pública.
- <!--i:globe--> **As entradas são públicas de qualquer forma.** São o que quem criou o link digitou na URL, legíveis por qualquer pessoa que o link alcance. Não coloque segredos em um link compartilhado; o Lolly oferece criptografia de link para conteúdo sensível.
- <!--i:eyeoff--> **Em cache, limitado e não indexado.** As respostas ficam em cache e têm limite de taxa como qualquer imagem pública, e são marcadas com `noindex` para que os buscadores deixem suas renderizações de fora.

Uma implantação auto-hospedada que não queira uma rota de renderização pública define `LOLLY_DISABLE_RENDER_GET=1`, e todas essas URLs passam a retornar 404.

### O buscador de imagens e o repasse do Penpot

**Add from URL** no app web e **Send to Penpot** usam dois pequenos repasses no lolly.tools, descritos em [Toda requisição de rede que o app pode fazer](#every-network-request-the-app-can-make). O buscador de imagens não guarda nada e esquece o endereço. O repasse do Penpot encaminha seu token e o arquivo ao Penpot e não guarda nenhum dos dois; ele registra em log o nome do comando e o status de resposta do Penpot.

### O servidor MCP, para agentes de IA

Um agente de IA pode acessar o Lolly pelo Model Context Protocol, por meio de um endpoint que um operador executa. O lolly.tools executa um, e qualquer pessoa pode executar o seu, inclusive totalmente offline.

- <!--i:cpu--> **Arquivos que um agente envia.** As ferramentas que recebem um arquivo (`lolly_transform`, `lolly_verify`, `lolly_redact`, `lolly_read`, `lolly_check`, `lolly_package`, `lolly_compose`, `lolly_rebrand` e as ferramentas de imagem `lolly_look`, `lolly_sample_color` e `lolly_trace_edges`) o processam na memória e devolvem o resultado na mesma chamada. O arquivo nunca é gravado em disco e não é mantido depois que a requisição termina. `lolly_inspect` também recebe um arquivo, e as verificações de vídeo e de produção gráfica dela gravam uma cópia de trabalho temporária, apagada quando a chamada retorna. Todas as outras ferramentas trabalham com os parâmetros da chamada: texto, números, cores, URLs, ids de recursos do catálogo ou um documento fornecido por quem chama.
- <!--i:cpu--> **O rebrand informa para onde vai um deck.** O primeiro estágio de `lolly_rebrand`, `capabilities`, diz em palavras para onde os seus bytes iriam antes de você enviar qualquer coisa: em um servidor local auto-hospedado, o deck nunca sai daquela máquina, e em um servidor hospedado, chamar `lolly_rebrand` envia o deck para lá, dentro dos limites de tamanho e de slides que esse estágio informa.
- <!--i:lock--> **O endpoint aberto.** No lolly.tools, `lolly.tools/api/mcp` é aberto a qualquer pessoa, sem token. As chamadas são limitadas por endereço e por um orçamento diário. O endereço vira um digest pseudonimizado no armazenamento de controle de abuso, como nos endpoints de login abaixo, e o orçamento conta apenas tempo de CPU e bytes enviados, sem endereço. O bearer token de um endpoint restrito nunca é gravado em um log nem em uma URL de renderização.
- <!--i:link--> **Links de download para resultados grandes.** O lolly.tools devolve os resultados inline e nunca emite esses links. Um operador pode ativá-los no próprio gateway autenticado, onde um resultado fica retido por no máximo cinco minutos e só o bearer token do próprio solicitante consegue buscá-lo; veja [MCP Server](/info/mcp.html#private-download-links-for-large-results). Um endpoint restrito planejado em `mcp.lolly.tools` aceitaria um bearer token que o operador emite para clientes confiáveis, ou OAuth 2.1 com tokens assinados de curta duração verificados contra um segredo compartilhado; a ativação dele está pendente, e ele consta em [Hosts de entrega e processadores](#delivery-hosts-and-processors).

### Identidade verificada: um login que você mesmo inicia

O Lolly pode selar uma **Content Credential** nas suas exportações, para que qualquer pessoa verifique offline que um arquivo não mudou desde que saiu do Lolly. Isso é **ativado por padrão e totalmente local**: a chave de assinatura é criada no seu dispositivo e a assinatura acontece offline. Sem cadastro, essa chave é descartável, um novo par de chaves gerado para cada exportação e descartado em seguida. Depois que você se cadastra, a chave passa a durar e é gerada como **não extraível**, então nem o código do próprio Lolly consegue lê-la, apenas pedir que assine. Em qualquer caso, ela nunca sai do seu dispositivo.

[Exporting](/info/exporting.html#content-credentials-c2pa) lista o que uma credencial registra: a ferramenta, o horário, a superfície de exportação em linhas gerais, o seu nome somente quando você ativou *Use my details*, as obras creditadas que uma exportação inclui e cada música do Rondocode que uma exportação de vídeo ou áudio toca (o nome, um hash da origem e como o sandbox do Lolly renderizou a música). O painel de exportação lista essas músicas antes de você exportar.

A credencial e os metadados do arquivo também registram o [sistema de design e a variação de cores](/info/exporting.html#the-design-system-record) que gerou a exportação: o id e o nome do sistema de design, a versão publicada e a variação de cores. O nome de um sistema de design é um texto digitado por quem o mantém e pode ser o nome de um cliente, então o cartão **Design system** do painel de exportação mostra as palavras exatas antes de você exportar. Desmarque o cartão, ou passe `_madewith=0` ou `--no-madewith`, para deixá-los de fora.

A única etapa *opcional* além dessa é cadastrar uma identidade verificada, para que suas exportações digam "Verified - signed by \<your email\>" em vez de nomear uma chave anônima. **Se você pular o cadastro, o serviço de certificados não recebe nenhum dado de cadastro seu.**

![O cartão Verified identity em Settings, na largura de um celular: o seletor de duração do certificado e a etapa de cadastro logo abaixo, inativa até você iniciá-la](/t/url-shot?url=%2F%23%2Fsettings%3Ffocus%3Didentity-section&width=430&height=1600&dpi=192&waitMs=2400&css=.welcome-dialog%2C.personalize-nudge%7Bdisplay%3Anone%7D&format=svg&walker=1&cropSelector=%23identity-section&dark=1&filename=pv-identity-enrol)

Se você se cadastrar, é exatamente isto que acontece:

::: timeline
- <!--i:usercheck--> **Você escolhe um método de login**: GitHub, Google, SUSE (id.suse.com) ou um link enviado por e-mail. Nos três provedores OIDC, você vai à página de login do próprio provedor, sob a política de privacidade dele, não a nossa, e o serviço de certificados recebe de volta apenas um endereço de e-mail verificado e o nome do provedor. No link por e-mail, o endereço que você digita vai para o **Resend**, um serviço de e-mail transacional, apenas para entregar esse único link.
- <!--i:lock--> **Um cookie de curta duração protege o redirecionamento.** O serviço de certificados define `lolly_ca_state`, `HttpOnly`, restrito a `/api/ca` e com expiração em até dez minutos. Ele carrega um valor aleatório, não um identificador de rastreamento, existe apenas para impedir que o redirecionamento de login seja forjado e é apagado assim que o login termina.
- <!--i:eyeoff--> **Seu endereço IP é usado brevemente para evitar abuso** dos endpoints de login, para que um único script não consiga inundar uma caixa de entrada nem esgotar a cota de e-mail. O Lolly o transforma em um digest SHA-256 antes de ele chegar ao armazenamento de controle de abuso de curta duração, então o endereço bruto não é enviado para lá. O digest é pseudonimizado, não anônimo: quem tivesse o armazenamento poderia recuperar um endereço IPv4 tentando todos os possíveis. O bucket expira em cerca de um minuto e não é usado para mais nada. Os logs de acesso comuns da hospedagem são separados e descritos abaixo.
- <!--i:seal--> **O serviço emite um certificado** que vincula o seu endereço de e-mail verificado à chave pública do seu dispositivo. A chave privada fica no dispositivo: o cliente envia uma solicitação de certificado com uma prova de posse vinculada, e nenhuma chave privada do dispositivo vai para nenhum dos modos de emissor.
- <!--i:check--> **A assinatura continua local.** Com o emissor legado, uma exportação não precisa de nenhuma requisição ao serviço de certificados. Uma identidade gerenciada também precisa de uma lista de revogação recente e assinada do emissor; o cliente pode usar uma lista em cache dentro da janela de atualização configurada, e atualizá-la pode contatar o serviço de certificados durante uma exportação. Um status ausente, expirado ou inválido impede o uso da identidade gerenciada.
:::

::: details Retenção e revogação em cada modo de emissor
A **emissão hospedada legada** oferece 7, 30, 90 ou 365 dias, limitados pelo operador. Ela não mantém inventário de identidades nem log de emissão, então não consegue descobrir quem obteve um certificado nem revogar os certificados dessa pessoa; a duração é a revogação.

A **emissão gerenciada pela organização** usa uma duração padrão de no máximo 24 horas e um máximo de sete dias, com raiz e política de confiança de emissor próprias, e a assinatura vai para o emissor Vault que o operador configurou. Seu aplicativo de cadastro usa um armazenamento de admissão compartilhado de uso único que guarda apenas um identificador de autenticação com chave e um digest da requisição, por no máximo dez minutos, e não guarda inventário de identidades nem cache de respostas de certificados. O provedor de PKI, seus dispositivos de auditoria, gateways e backups têm fluxos de dados próprios. Mesmo com o armazenamento comum de emissão desativado, a revogação baseada em certificado pode manter o certificado, incluindo sua identidade de e-mail, e os números de série de revogação e os identificadores de auditoria podem continuar vinculáveis; a política do seu operador decide esse inventário, quem pode acessá-lo e por quanto tempo é mantido.

Um dispositivo gerenciado pode pedir a revogação do próprio certificado, com uma prova autenticada do dispositivo, e nenhuma API pede a chave privada do dispositivo. O operador pode retirar um emissor por meio da política de confiança. O Lolly não mantém nenhum mapeamento entre pessoas e certificados, então revogar os certificados de uma pessoa quando ela sai depende de registros que o operador mantém, e os registros de PKI, os registros de auditoria, os destinatários e os backups seguem a política do operador. O [design do serviço de certificados](https://github.com/lolly-tools/lolly/blob/main/services/ca/README.md) trata de custódia do emissor, retenção do provedor e qualificação.
:::

## Serviços da organização com o Lolly Work

O **Lolly Work** é o serviço opcional de organização do projeto Lolly, implantado separadamente por cada organização que executa uma instância. Conectar-se a uma instância acrescenta dados mantidos naquele servidor à sua edição local. O operador dela é responsável pela política de privacidade, pelos controles de acesso, pelos destinatários, pela retenção e pelos backups daquela implantação.

| Fluxo | Dados tratados pelo serviço da organização |
|---|---|
| Login e provisionamento | Claims do provedor de identidade, associação a contas e grupos, sessões de login e informações do dispositivo. O OIDC trata o login; administradores podem provisionar e desativar contas pelo SCIM |
| Catálogo e projetos compartilhados | Recursos enviados, metadados e versões; projetos e sessões compartilhados; conteúdo obtido de provedores de biblioteca configurados |
| Collabs de trabalho | Estado de sessão compartilhada, edições ao vivo e presença dos participantes enviados pela instância; o estado salvo persiste conforme a política de armazenamento dela |
| Links de compartilhamento gerenciados | Destino do link e configurações de acesso, como expiração e proteção opcional por senha; as requisições são resolvidas pela instância e podem ser revogadas |
| Revisão e entrega | Conteúdo submetido, decisões de aprovação, destino selecionado, arquivos em preparação e recibos de entrega |
| Renderizações e lotes no servidor | Entradas de ferramentas submetidas, requisições de renderização, status e arquivos de saída retidos. Esses trabalhos rodam no servidor, não no seu dispositivo |
| Relatório de uso | Rótulos de eventos permitidos, como id da ferramenta, formato e id do recurso, conforme a política de telemetria abaixo |
| Auditoria | Registros de autor e ação para operações governadas, mantidos separados da telemetria de uso |

O serviço usa cookies de autenticação, incluindo `lw_session` para membros logados e `lw_guest` para acesso de convidados, onde ativado, separados do cookie do serviço de certificados. Atualizações de política e o relatório de uso ativado podem fazer requisições enquanto o app está em uso, sem um clique separado para cada uma. Esse é tráfego para a instância configurada, não um relatório ao projeto Lolly sobre implantações que ele não executa.

**A telemetria de uso tem três níveis.** `off` não armazena eventos de uso, `aggregate` remove os ids de usuário e `standard` pode atribuir eventos. O nível padrão é `standard`, então uma instância armazena os eventos de uso que recebe, a menos que o operador escolha `off`. A política de atribuição padrão é `opt-in`, que exige o seu consentimento antes de um id de usuário ser armazenado; um operador pode, em vez disso, configurar o relatório atribuído com `telemetryAttribution: default`. Os atributos permitidos são rótulos, nunca valores de entrada de ferramentas. Veja [Work telemetry](/info/work-telemetry.html).

**A auditoria é separada.** Ações governadas podem manter um registro de auditoria identificado, seja qual for o seu consentimento de telemetria. Desativar a telemetria não desativa o armazenamento de sessões compartilhadas, os registros de aprovação, o armazenamento de trabalhos de renderização nem a auditoria. O operador controla a retenção e o apagamento, incluindo qualquer pseudonimização do log de auditoria; veja [Work storage and data lifecycle](/info/work-data-lifecycle.html).

| | Seu dispositivo | A instância da sua organização |
|---|---|---|
| O que guarda | Seu trabalho pessoal, preferências e caches | Trabalho compartilhado, contas, envios, aprovações, renderizações, auditoria e telemetria configurada |
| Quem apaga | Você, com **Clear all my data** ou os dados do site no seu navegador | O operador, pelos controles da própria instância |
| A quem pedir | Ninguém: os registros estão no seu dispositivo | O operador da instância, para acesso, exportação ou apagamento |

**Apagar localmente não é apagar no servidor.** Sair de uma instância ou limpar o navegador remove o estado local, não os registros armazenados nem os backups da organização. O [Sync](/info/sync.html) pessoal e o **Export my data** fazem backup do seu dispositivo, não do serviço da organização. A demo pública [lolly.work](https://lolly.work) mantém seu estado apenas na memória e não é armazenamento durável para o seu trabalho.

## A extensão de navegador

A extensão de navegador **Lolly URL Screenshot** não coleta nenhum dado pessoal para nós. Ela não tem análise de uso, rastreamento nem servidor próprio. A página [Browser extension](/info/extension.html) descreve como ela funciona.

**O que ela faz.** O app web do Lolly pode pedir a ela uma captura de tela de uma página web, ou o conteúdo de uma página para começar um sistema de design a partir de um site. Cada pedido abre na extensão uma janela de aprovação que mostra o site solicitante, se ele quer uma captura de tela ou o conteúdo da página, e o endereço da página. Somente depois que você pressiona **Approve once** a extensão abre essa página em uma aba temporária em segundo plano, tira a captura ou lê a página, entrega o resultado à aba do Lolly que pediu e fecha a aba. Cada pedido precisa da própria aprovação.

**Dados.**

- <!--i:shieldcheck--> **Não coletamos nada.** O resultado vai apenas para a página do Lolly que pediu, no mesmo navegador. A extensão não armazena conteúdo de páginas e não adiciona nenhum outro destinatário.
- <!--i:globe--> **Requisições de rede.** A página que você aprova é carregada como em qualquer aba, junto com tudo o que ela mesma requisita. Ler o conteúdo de uma página também busca as folhas de estilo dela e algumas de suas imagens de ícone e logotipo, de dentro da página, e essas buscas não enviam cookies a outros sites. A extensão não faz nenhuma outra requisição, e nenhuma vai para um servidor do Lolly.
- <!--i:lock--> **A sessão do seu navegador.** A página carrega com a sessão do seu navegador, como se você mesmo a abrisse, então uma página em que você está logado pode colocar informações privadas no resultado.
- <!--i:link--> **Os endereços que você aprova** são usados apenas para carregar aquela página para aquele pedido. Eles não são registrados em log nem compartilhados.

**Permissões.**

- <!--i:wrench--> **`debugger`**: para tirar a captura de tela pelo DevTools Protocol, o mesmo mecanismo que o app desktop do Lolly usa.
- <!--i:monitor--> **`tabs`**: para abrir e fechar a aba temporária e para conferir que nem a página do Lolly nem a página de destino mudaram desde que você aprovou.
- <!--i:code--> **`scripting`**: para ler o conteúdo de uma página na aba temporária, depois que você aprova esse pedido.
- <!--i:database--> **`storage`**: para anotar os ids das abas temporárias no armazenamento de sessão, de modo que elas ainda sejam fechadas se o navegador interromper a extensão durante um pedido. Nenhum conteúdo de página é armazenado.
- <!--i:check--> **Acesso opcional a sites (`http://*/*`, `https://*/*`)**: não concedido na instalação. Quando você pressiona **Approve once**, a extensão pede ao Chrome acesso ao único site daquele pedido, e o Chrome pergunta a você na primeira vez para cada site. Um site que você permitiu antes ainda precisa de uma nova aprovação a cada pedido.

Nenhuma dessas permissões é usada para ler, monitorar ou transmitir sua navegação além do único pedido que você aprovou.

## Hosts de entrega e processadores

Os arquivos públicos do catálogo, as ferramentas e as versões de exibição vêm por padrão do endereço do próprio app. Nomes endereçados por conteúdo mudam de onde o arquivo é buscado, não quem recebe a requisição. Nenhuma CDN de terceiros é ativada por este recurso de entrega. Uma CDN que encerra o TLS receberia detalhes da requisição, incluindo endereços IP e quaisquer cookies ou credenciais bearer encaminhados a ela, mesmo sob o mesmo nome de host do navegador, então um operador que adiciona uma assume um novo processador.

**Antes de adicionar qualquer CDN ou host de modelos externo**, o administrador deve publicar o nome do processador, o nome de host, as jurisdições, os metadados recebidos, a retenção e os acordos de transferência. [Delivery deployment](/info/deploy-delivery.html) lista o que divulgar. As respostas de espaços de trabalho privados contornam os caches compartilhados: resultados pessoais, recusas de acesso e erros usam `private, no-store`, e uma resposta privada permitida pode ser revalidada no seu navegador sem se tornar pública.

Os serviços de referência usam a hospedagem abaixo. Esta é uma lista de nomes de host, não uma afirmação de que a instância de outra organização usa a mesma região.

| Nome de host ou serviço | Função e destinatário | Região e tratamento de dados |
|---|---|---|
| lolly.tools | App público, catálogo, renderização e serviços de certificados; hospedagem UpCloud | Frankfurt, Alemanha. Detalhes das requisições podem aparecer nos logs da infraestrutura; a edição local comum permanece no dispositivo |
| lolly.ing | Espaço de trabalho gerenciado e serviços de agente de documentos; hospedagem UpCloud | Frankfurt, Alemanha. O banco de dados privado e o armazenamento de arquivos ficam no mesmo host. Contas, conteúdo compartilhado e registros do serviço seguem a política do administrador da instância |
| mcp.lolly.tools | Gateway MCP autenticado opcional planejado e downloads privados de resultados; hospedagem UpCloud | Frankfurt, Alemanha, com o mesmo processador de hospedagem. Ativação pendente. O gateway receberia os detalhes das requisições e os parâmetros ou arquivos que quem chama enviar |
| lolli.li | Arquivos públicos de lançamentos e de modelos; UpCloud Managed Object Storage, separado do cluster do aplicativo | Frankfurt, Alemanha, na região de armazenamento de objetos europe-2 da UpCloud. Um download envia detalhes da requisição, não as entradas que o modelo processa depois |
| Provedor de identidade configurado | Google, GitHub ou um provedor OIDC do operador | O login segue a política desse provedor. Pergunte ao operador da instância o nome de host, a região e os acordos de transferência |
| Provedor de recursos configurado | Brandfolder ou outra biblioteca que o operador selecionar | O provedor recebe as requisições de biblioteca permitidas. As permissões de origem dele e a política da instância regem o acesso; pergunte ao operador os nomes de host e as regiões |
| Cadastro por e-mail, quando configurado | O Resend entrega o link de login solicitado | Recebe o endereço de e-mail de destino dessa mensagem; aplicam-se os termos de tratamento dele |

O aplicativo de referência não usa nenhum outro provedor de hospedagem, banco de dados ou controle de abuso. Um operador pode escolher outros provedores para uma instância diferente, e os provedores de hospedagem, identidade, recursos e e-mail precisam, cada um, da própria divulgação. A [região de armazenamento de objetos](https://upcloud.com/docs/products/managed-object-storage/availability/) do host de modelos é verificada separadamente da região do aplicativo.

**Links de download opcionais vinculados ao principal no MCP.** Um operador pode ativar links de download para resultados grandes em um gateway autenticado de réplica única. Eles vêm desativados por padrão. O gateway anônimo em `lolly.tools/api/mcp` devolve resultados inline e nunca emite esses links. O nome de host restrito planejado é `mcp.lolly.tools`, no mesmo processador UpCloud em Frankfurt; a ativação está pendente, e esta página não afirma que exista um serviço de links de download ativo. Os links não acrescentam nenhuma CDN de terceiros.

Somente um solicitante autenticado com escopo de arquivo pode receber um link, e o bearer do mesmo solicitante é necessário para buscá-lo: use o bearer validado da chamada de renderização, não outro token da mesma conta. A concessão expira em até 300 segundos. A propriedade e a consulta do resultado ficam na memória do gateway, e os bytes de saída vão para arquivos temporários privados, removidos após a expiração ou eliminados em um desligamento limpo. Reiniciar o gateway invalida os links existentes. Os resultados retidos são limitados a 64 MiB por bearer, 256 MiB no gateway inteiro e 200 arquivos pendentes ou retidos. Os orçamentos diários de CPU e de bytes decodificados contam os resultados quando são retidos e quando são baixados. As respostas usam `private, no-store` e `Referrer-Policy: no-referrer`. O token de um link, sozinho, não permite que outra pessoa ou agente leia o resultado.

## Logs de infraestrutura

Esta seção descreve a implantação pública do lolly.tools. A plataforma de hospedagem dela registra detalhes comuns das requisições: endereço IP, caminho requisitado, data e hora e user agent. As edições locais não chegam a esse host. A query string de um link de renderização pode conter o texto que quem o criou forneceu, como explicado acima. As ferramentas de arquivo do MCP processam os bytes que recebem na memória. Uma instância do Lolly Work também mantém os registros descritos acima, sob a política de logs do operador dela.

**Os serviços públicos mantêm o registro de logs do aplicativo no mínimo.** O servidor MCP registra a inicialização, a configuração e os avisos de renderização; não mantém log de requisições próprio e não registra tokens nem endereços de quem chama. O repasse do Penpot registra o nome de cada comando e o status de resposta do Penpot, nunca cabeçalhos, tokens nem o arquivo. O serviço de certificados registra suas configurações de inicialização e avisos de configuração, além de duas linhas reduzidas em caso de falha: um código de status de falha de envio sem o endereço do destinatário e uma linha fixa de falha sem texto de erro, stack trace ou URL, porque o erro de um provedor pode carregar valores de identidade ou credenciais. Todo o resto do log vem da plataforma de hospedagem.

No lolly.tools, o administrador da instância controla o registro de requisições, a rotação e a retenção na UpCloud. Esta página não afirma um prazo máximo de retenção de logs que não tenha sido verificado. Entre em contato com o controlador abaixo para saber o cronograma atual e para qualquer solicitação sobre logs mantidos no servidor. Em outra instância, valem as configurações do operador dela, incluindo quaisquer exportações de logs ou outros processadores.

## Bases legais, retenção e destinatários

Esta tabela cobre a implantação de referência **lolly.tools**. Ela não informa as bases legais nem os prazos de retenção da instância do Lolly Work da sua organização; o operador dela os fornece na própria política.

| Tratamento | Base legal (GDPR Art. 6) | Retido por |
|---|---|---|
| Tudo o que está no seu dispositivo (documentos, preferências, cache, contadores) | **Não é tratamento nosso**: nunca chega até nós. O armazenamento no seu dispositivo é estritamente necessário para o serviço que você pediu (ePrivacy Art. 5(3)), portanto não exige consentimento | Até você apagar |
| Seu endereço de e-mail durante o cadastro hospedado legado de Content Credentials | **Art. 6(1)(b)**, execução de um serviço que você pediu explicitamente | Sem inventário de identidades nem log de emissão no serviço legado; o e-mail é usado durante a requisição e incluído no seu certificado. A retenção de PKI, auditoria e revogação da organização gerenciada segue a política do operador dela |
| Um digest SHA-256 pseudonimizado criado a partir do seu endereço IP, para limitar a taxa dos endpoints de login e dos endpoints públicos de renderização, imagem e MCP | **Art. 6(1)(f)**, nosso interesse legítimo em evitar o abuso de um serviço gratuito e da cota de e-mail de terceiros. Consideramos que isso passa em um teste de ponderação, porque o endereço bruto não é enviado ao limitador, o digest é usado apenas para controle de abuso e expira sozinho | Cerca de um minuto no armazenamento de controle de abuso; não é mantido depois |
| Logs de acesso da hospedagem (IP, caminho, data e hora, user agent) | **Art. 6(1)(f)**, nosso interesse legítimo na segurança do serviço, na prevenção de abuso e no diagnóstico de falhas | Rotação e retenção configuradas pelo administrador; entre em contato com o controlador para saber o cronograma atual |

**Destinatários.** As categorias de destinatários são o nosso provedor de hospedagem (UpCloud), que hospeda o banco de dados do aplicativo e o armazenamento de controle de abuso, e, somente se você usar a opção de login por e-mail, um provedor de e-mail transacional (Resend). O armazenamento de controle de abuso recebe apenas digests de curta duração, nunca o endereço IP bruto. Se você faz login com GitHub, Google ou SUSE (id.suse.com), você lida diretamente com esse provedor, sob a política de privacidade dele, e ele nos informa um endereço de e-mail verificado e nada mais. Não compartilhamos dados pessoais com mais ninguém, não vendemos dados, não exibimos publicidade nem criamos perfis de usuários.

**Transferências para fora do EEE.** A hospedagem, o banco de dados e o armazenamento de arquivos do aplicativo de referência ficam em Frankfurt. Os provedores opcionais de identidade, e-mail e recursos têm locais de tratamento e termos próprios, que podem incluir acesso de fora do EEE, e a região de um servidor, por si só, não estabelece a jurisdição de todos os destinatários. Entre em contato com o controlador para obter os contratos com os provedores e os acordos de transferência aplicáveis; em outra instância, pergunte ao operador dela. As [Cláusulas Contratuais Padrão](https://commission.europa.eu/law/law-topic/data-protection/international-dimension-data-protection/standard-contractual-clauses-scc_en) da Comissão Europeia são uma das salvaguardas disponíveis para essas transferências; esta página não afirma que um contrato de provedor não verificado as utilize.

**Decisões automatizadas.** Nenhuma. Não há criação de perfis nem decisão automatizada com efeitos jurídicos ou igualmente significativos (Art. 22).

## Privacidade de crianças

O uso local comum do app não envia nenhum conteúdo pessoal ao lolly.tools. O cadastro opcional de Content Credentials dele recebe um endereço de e-mail e não é direcionado a crianças nem destinado a elas. Os serviços da organização têm contas e tratamento de dados próprios, sob a política do operador.

## Seus direitos

Para registros armazenados apenas no seu dispositivo, você mesmo pode acessar, corrigir, apagar e mover os dados. Eles ficam no armazenamento do seu navegador ou app, em uma forma que você pode inspecionar, exportar (**Export my data**, acima) ou apagar (**Clear all my data**, ou os dados do site no seu navegador).

Formalmente, pelos Artigos 15 a 22 do GDPR, você tem o direito de **acessar** seus dados pessoais, **retificá-los**, **apagá-los**, **restringir** o tratamento ou **se opor a ele** (inclusive a qualquer um que baseemos em interesses legítimos), à **portabilidade dos dados** e, quando o tratamento se baseia em consentimento, de **retirar esse consentimento a qualquer momento**, sem afetar a licitude do que ocorreu antes da retirada.

O serviço público de certificados não mantém log de emissão. Os logs da infraestrutura podem conter detalhes das requisições, portanto esta política não promete que o ambiente de hospedagem não guarde dados pessoais. Entre em contato com o controlador para pedidos de acesso, apagamento ou outra solicitação sobre esses registros; explicaremos quais registros existem e o que pode ser feito. Para trabalho, identidades, telemetria e registros de auditoria mantidos por uma organização, entre em contato com o operador do seu Lolly Work, porque os controles locais de exportação e exclusão não alcançam essas cópias.

**Você tem o direito de reclamar.** Se acha que tratamos seus dados de forma indevida, você pode apresentar uma reclamação a uma autoridade supervisora de proteção de dados: na UE, a autoridade do país onde você reside ou trabalha ou onde acredita que a infração ocorreu (Art. 77). Nossa autoridade supervisora principal é o *Bayerisches Landesamt für Datenschutzaufsicht* (BayLDA), em Ansbach, Alemanha. Você não precisa falar conosco primeiro, embora gostaríamos de ter a chance de corrigir o problema.

## Alterações nesta política

A data no topo muda sempre que este documento muda. Uma alteração que modifique o que sai do seu dispositivo ou o que é mantido ganha uma linha própria aqui, em vez de uma edição silenciosa. Para ver o que mudou, pergunte (abaixo) ou compare com o [código-fonte público](https://github.com/lolly-tools/lolly/commits/main/docs/privacy.md).

**29 de setembro de 2026:** esclarecemos o serviço opcional lolly.work, o conteúdo mantido pela organização, os cookies de autenticação, a telemetria de uso e os registros de auditoria, e a separação entre a exclusão local e a retenção no servidor. Esses são fluxos opcionais já existentes, não uma nova exigência de envio para a edição local.

**11 de outubro de 2026:** substituímos a descrição da hospedagem Vercel, já desativada, pelo inventário de nomes de host do aplicativo na UpCloud, distinguimos os provedores opcionais de identidade e de recursos e descrevemos a entrega endereçada por conteúdo e o modo de download retido do MCP. Nenhuma CDN de terceiros é ativada por esta alteração. A retenção de logs é controlada pelo administrador, e não por um padrão declarado de plano da Vercel.

**22 de outubro de 2026:** corrigimos a descrição de um comportamento existente. A seção da extensão de navegador agora cobre a janela de aprovação de cada pedido, o acesso a sites pedido um site por vez e as buscas de folhas de estilo e ícones na leitura de um site. Também corrigimos: as linhas de Send to Google Drive e Meeting Planner, a nota sobre SEAL (nenhum app do Lolly consulta chaves SEAL no DNS), o nível padrão de telemetria de uso do serviço da organização, as ferramentas de imagem do MCP e o registro de logs de aplicativo dos serviços públicos. O software em si não mudou.

**23 de outubro de 2026:** reorganizamos a política pelo que inicia cada requisição e descrevemos comportamentos existentes que ela não cobria antes: convites de collab privado que carregam endereços de rede local, o Nearby no app desktop, o Allow AI control, a leitura de um sistema de design a partir de um site, os conjuntos de emoji, o cache no dispositivo das consultas de cidades do Meeting Planner, a Lixeira e os demais registros que Settings → Storage lista. Corrigimos duas afirmações: Bluesky e Discord não são exclusivos do desktop, e todo host que uma pessoa escolhe para envio precisa da aprovação do operador tanto nos apps web quanto nos desktop; o digest de limitação de taxa de um endereço IP é pseudonimizado, não anônimo. O software em si não mudou.

## Quem é responsável e como nos contatar

O **controlador de dados** do lolly.tools é:

> SUSE Software Solutions Germany GmbH
> Frankenstraße 146
> 90461 Nürnberg
> Alemanha

A SUSE nomeou um **Encarregado de Proteção de Dados**, que pode ser contatado em [privacy@suse.com](mailto:privacy@suse.com). Use esse endereço para qualquer solicitação formal conforme "Seus direitos" acima.

Para qualquer assunto sobre o próprio Lolly, como o funcionamento, o motivo de algo ser como é ou uma correção a este documento, entre em contato com **Andy Fitzsimon**, [fitzy@suse.com](mailto:fitzy@suse.com).

No caso de uma instância do Lolly auto-hospedada ou corporativa, entre em contato com quem a opera: o operador é o controlador da própria implantação. A SUSE e o projeto de código aberto Lolly não guardam dados de implantações que não executam.
