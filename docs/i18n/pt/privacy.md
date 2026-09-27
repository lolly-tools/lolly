# Política de Privacidade

*Última atualização: 11 de agosto de 2026*

> **A versão resumida.** Os documentos, imagens, vídeos e arquivos que você cria no Lolly
> permanecem no seu dispositivo. Não existem contas para uso comum, nenhum cookie do
> próprio aplicativo e nenhuma análise ou rastreador em nenhum lugar do código-fonte -
> não é "nós não usamos os dados", é genuinamente ausente do código-fonte. Existe uma
> lista curta e completa de exceções para quando o software chega a conversar com uma
> rede, e cada uma delas é descrita abaixo em detalhes: o que sai, para quem e quando.
> A única exceção que envolve algo pessoal é um login que você precisa iniciar
> explicitamente. Se não está neste documento, não acontece.

## O que esta política cobre

O Lolly é um software de código aberto - um mecanismo (engine), vários shells de aplicativo (web, desktop,
móvel, CLI) e uma extensão de navegador - que qualquer pessoa pode executar. Esta política tem duas
partes:

- <!--i:code--> **O software em si**: o que ele faz e não faz com seus dados, onde quer que
  seja executado. Isso é uma propriedade do código, portanto é verdade para toda implantação do Lolly,
  seja nossa ou de qualquer outra pessoa.
- <!--i:server--> **lolly.tools**, a implantação de referência operada pela SUSE: as escolhas específicas
  feitas na execução de suas partes opcionais do lado do servidor (o que é registrado, por quanto tempo, por
  quem).

Se você estiver usando uma instância autogerenciada (self-hosted) ou corporativa do Lolly, o comportamento do software
abaixo ainda se aplica, mas o *operador* dessa instância - não a SUSE - é
responsável por tudo do lado do servidor: seu endpoint de renderização, seu servidor MCP,
sua autoridade certificadora de Content Credentials, se houver uma. Peça a eles
sua própria política. Veja [Adoção e Governança](/info/adoption-governance.html) para
o que envolve operar o Lolly.

## O aplicativo: o que fica no seu dispositivo

Os shells web, desktop e móvel do Lolly executam todo o mecanismo de renderização no lado do cliente.
Abrir uma ferramenta, preencher entradas, pré-visualizar e exportar, tudo acontece no seu
dispositivo - nenhum servidor está envolvido, e o aplicativo funciona offline depois de carregado.

**O aplicativo não define cookies.** Para funcionar, ele mantém uma pequena quantidade de dados **apenas
no seu dispositivo**, nunca transmitidos:

- <!--i:sliders--> **Preferências de interface** - tema, idioma, configurações de som, tamanho
  da barra lateral/zoom, ordenação e escolhas de visualização, quais dicas de integração você já viu - em
  `localStorage`, para que estejam disponíveis antes de o aplicativo terminar de inicializar.
- <!--i:download--> **Um cache offline do catálogo de ferramentas e das pré-visualizações de recursos**, para que a galeria
  funcione sem conexão.
- <!--i:hash--> **Contadores de uso locais** para as estatísticas do seu cartão de perfil (quantas exportações, quais
  ferramentas) - um blob pequeno e limitado em `localStorage`, nunca lido por nós, nunca enviado
  a lugar nenhum.
- <!--i:folder--> **Seus próprios documentos, sessões salvas, recursos enviados e fontes** - armazenados no
  IndexedDB no seu dispositivo, nunca enviados, nunca lidos por ninguém além de você.

Nada disso é compartilhado, vendido ou usado para identificar ou rastrear você. Não há
nada para consentir, porque não há coleta acontecendo - só este aviso, para que você
saiba o que é mantido e onde. Limpar o armazenamento do site no seu navegador remove
tudo isso a qualquer momento; **Configurações → Armazenamento → Limpar todos os meus dados** remove seu
perfil, sessões salvas, imagens enviadas e o cache de ativos. (Nos termos da Diretiva
ePrivacy, Art. 5(3), o armazenamento estritamente necessário para o serviço que você pediu
não exige consentimento - só transparência, que é o que este documento e
o aviso dentro do app são, os dois.)

![A seção de armazenamento da página de perfil em uma tela com largura de celular: cada categoria de dado no dispositivo é nomeada, com o botão Clear all my data logo ao lado](/t/url-shot?url=%2F%23%2Fprofile%3Ffocus%3Dstorage-section&width=430&height=1600&dpi=192&waitMs=2400&css=.welcome-dialog%2C.personalize-nudge%2C.store-manages%2C.storage-subsection%2C.store-selbar%2C.store-chip-val%2C%23store-hero-num%2C%23store-headroom%2C%23store-quota%2C%23store-reclaim%7Bdisplay%3Anone%7D&format=svg&walker=1&cropSelector=%23storage-section&dark=1&filename=pv-storage-clear)

Seu próprio backup desses dados - o pacote `lolly-backup` produzido por **Exportar meus
dados** - é um arquivo que você guarda e controla. Ele nunca toca nossos
servidores, a menos que você mesmo escolha enviá-lo para algum lugar. Veja [Data
Transfer](/info/data-transfer.html).

## Utilitários no dispositivo

Algumas ferramentas - **Strip Hidden Data**, **Compress PDF** e outras que exibem o
selo **"Runs on your device"** - operam sobre um arquivo que você fornece. O arquivo é lido
para a memória no seu navegador, transformado localmente e oferecido de volta como um download.
Ele nunca é enviado, porque não há servidor no caminho para o qual enviá-lo.
Esses utilitários funcionam offline, e sua saída não carrega nenhuma marca d'água ou metadado
nosso - o objetivo da maioria deles é remover e proteger dados, não adicionar risco.

![O selo que essas ferramentas exibem: Runs on your device - nada é enviado](/t/url-shot?url=%2F%23%2Ftool%2Fstrip-data&width=1440&height=900&dpi=192&waitMs=2400&walker=1&format=svg&cropSelector=.on-device-badge&dark=1&filename=pv-ondevice-badge)

O Prepare for sharing guarda entradas de trabalho, descobertas privadas e mapas de substituição
em memória, sem adicioná-los automaticamente ao histórico, a links, a backups ou à sincronização.
Inspeção e substituição não enviam o conteúdo do arquivo a um servidor nem validam
credenciais on-line. Os usuários escolhem se copiam, baixam, enviam ou salvam explicitamente
um resultado na biblioteca deles; um resultado salvo então segue as configurações normais
de backup e sincronização da biblioteca. Arquivos de receita omitem cargas anteriores e mapeamentos literais.
Relatórios de resumo contêm contagens, IDs de escopo e hashes de arquivo. A CLI também pode salvar
um arquivo de revisão privado contendo os valores originais, só quando pedido explicitamente
com `--review-file`. Limpar ou sair de uma visão de preparação no navegador libera seu
estado de trabalho; isso não é uma promessa de apagamento forense da memória do navegador ou do sistema.

## Quando o aplicativo se comunica com uma rede, por completo

A tabela abaixo é a lista completa de tudo que o aplicativo busca ou envia por uma
rede. Se não estiver aqui, o aplicativo não faz isso.

| O quê | O que realmente sai do seu dispositivo | Quando (o ato que aciona isso) | Se um operador bloquear |
|---|---|---|---|
| Sincronização do catálogo de ferramentas | Nada pessoal - uma requisição para o próprio índice público de ferramentas e ativos do Lolly, para a própria origem do app | Na inicialização, depois em cache offline | O app funciona com seu conjunto de ferramentas em cache. Ele só para de descobrir novas ferramentas |
| Uma ferramenta que precisa de dados ao vivo | O que aquela ferramenta específica pedir, ao host nomeado na própria descrição dela. Hoje isso é só a busca de cidade na ferramenta Meeting Planner, que pede a `geocoding-api.open-meteo.com` para transformar um nome de cidade em coordenadas e um fuso horário - sem conta, sem chave e sem identificador além da própria requisição. O campo de entrada avisa bem onde você digita, e cada resposta é salva no seu dispositivo para que uma cidade seja buscada uma única vez | Só enquanto você usa aquela ferramenta, e só depois que você digita um local | Aquela busca falha. Você ainda pode digitar coordenadas à mão, e nada mais é afetado |
| Google Fonts | O nome da família de fontes escolhida e seu endereço IP, para os servidores de fontes do Google (`fonts.googleapis.com` para a folha de estilo, `fonts.gstatic.com` para o arquivo da fonte) | Só se você adicionar uma Google Font no editor de marca, **e só depois de você concordar em um diálogo que diz exatamente isso** - uma busca única por família, depois ela vive no seu dispositivo e é usada offline | O seletor de Google Fonts falha fechado. Envie um arquivo de fonte em vez disso |
| Enviar ao Google Drive | O único arquivo que você escolheu enviar, para a API do Drive do Google (`www.googleapis.com`), depois de um login do Google que você completa na própria janela popup do Google. O acesso do Lolly é limitado aos arquivos que ele criou (o escopo `drive.file` - ele nunca pode ler o resto do seu Drive), e o token de login fica na memória durante a sessão, nunca é armazenado | Só quando você pressiona "Enviar ao Google Drive" em uma exportação EMF, e só em builds em que o operador configurou um client id do Google - sem um, o botão não existe | O botão nunca aparece. Baixe o arquivo e envie-o você mesmo para o Drive |
| Enviar para o Dropbox | O único arquivo que você escolheu enviar, para a API do Dropbox (`api.dropboxapi.com` para login e metadados, `content.dropboxapi.com` para o próprio arquivo), depois de um login do Dropbox que você completa na própria janela do Dropbox. O acesso do Lolly é só de pasta de app (ele só consegue ver `Apps/` e sua própria pasta lá - nunca o resto do seu Dropbox), o link "Open" que ele mostra é um link privado de curta duração (nenhum compartilhamento público é criado), e um token de atualização só é armazenado se você marcar "stay connected" | Só quando você pressiona "Enviar para o Dropbox" em um arquivo, e só em builds em que o operador configurou um client id do Dropbox - sem um, o botão não existe | O botão nunca aparece. Baixe o arquivo e envie-o você mesmo para o Dropbox |
| Enviar para o OneDrive | O único arquivo que você escolheu enviar, para os serviços de identidade e Graph da Microsoft (`login.microsoftonline.com` para login, `graph.microsoft.com` para o envio; um arquivo grande é enviado em partes para um endereço de upload da Microsoft em `api.onedrive.com`, `*.up.1drv.com` ou `*.sharepoint.com`), depois de um login da Microsoft que você completa na própria janela da Microsoft. O acesso do Lolly é limitado à própria pasta dele sob `Apps/` (ele nunca pode ler o resto do seu OneDrive) mais seu nome de exibição para o rótulo da conta, e um token de atualização só é armazenado se você marcar "stay connected" | Só quando você pressiona "Enviar para o OneDrive" em um arquivo, e só em builds em que o operador configurou um client id da Microsoft - sem um, o botão não existe | O botão nunca aparece. Baixe o arquivo e envie-o você mesmo para o OneDrive |
| Enviar para o LinkedIn | O único arquivo que você escolheu enviar, mais o nome dele como texto da postagem, para o LinkedIn (`www.linkedin.com` para o login, `api.linkedin.com` para o envio e a postagem), depois de um login do LinkedIn que você completa no seu próprio navegador. A postagem vai para o seu próprio feed como uma postagem pública em seu nome. O Lolly pode postar como você e ler seu nome para o rótulo da conta, nada mais no seu LinkedIn, e o login é mantido só neste dispositivo se você marcar "stay connected" - os tokens do LinkedIn duram 60 dias e não podem ser renovados silenciosamente, então expiram sozinhos | Só quando você pressiona "Enviar para o LinkedIn" em um arquivo, só nos apps de desktop, e só em builds em que um app do LinkedIn está configurado - sem um, o botão não existe | Nada a bloquear no app web: isso existe só nos **apps de desktop**, então esses dois hosts estão deliberadamente FORA da Content-Security-Policy do app web abaixo. Nos apps de desktop, remover o app do LinkedIn configurado faz o botão nunca aparecer |
| Enviar para o Penpot | Seu token de acesso pessoal do Penpot (você o cola no app) e o arquivo `.penpot` do design que você escolheu enviar, para a API do Penpot (`design.penpot.app`) por uma pequena passagem na própria origem do app (`/api/penpot`), porque a API do Penpot não responde a um navegador diretamente. A passagem encaminha e esquece; os apps de desktop falam com o Penpot diretamente | Só quando você pressiona "Enviar para o Penpot" na ferramenta Design e confirma um projeto | A passagem retorna um erro e o envio falha fechado. Exporte o arquivo `.penpot` e importe-o você mesmo no Penpot |
| Enviar para o Bluesky | A única imagem que você escolheu enviar, o nome dela como texto da postagem e texto alternativo, e seu identificador mais uma senha de app (Bluesky → Settings → App passwords, nunca sua senha de conta), para o servidor do Bluesky que você nomear (`bsky.social`, a menos que você hospede o seu próprio). A senha de app é armazenada só neste dispositivo, nunca em um backup, e Disconnect a apaga | Só quando você pressiona "Enviar para o Bluesky" em uma imagem, depois de conectar a conta no seu perfil, só nos **apps de desktop** | Nada a bloquear no app web: a política dele abaixo não lista nenhum host do Bluesky, então essa travessia não existe lá. Nos apps de desktop, remover a conexão faz o botão nunca aparecer |
| Enviar para o Discord | O único arquivo que você escolheu enviar, como anexo, para o endereço de webhook do canal que você colou (`discord.com`). Um endereço de webhook deixa qualquer um que o tenha postar naquele canal, então ele é armazenado só neste dispositivo, nunca em um backup, e Disconnect o apaga | Só quando você pressiona "Enviar para o Discord" em um arquivo, só nos **apps de desktop** | Nada a bloquear no app web: a política dele abaixo não nomeia `discord.com`, então essa travessia não existe lá. Nos apps de desktop, remover o webhook faz o botão nunca aparecer |
| Enviar para o Mastodon | O único arquivo que você escolheu enviar e o nome dele como texto da postagem, para o servidor Mastodon (ou compatível) que você nomear, depois de um login que você completa na própria janela daquele servidor. Conectar registra um pequeno app por dispositivo naquele servidor; o login é mantido só neste dispositivo se você marcar "stay connected" | Só quando você pressiona "Enviar para o Mastodon" em um arquivo. Você escolhe o servidor, então ele não está na política abaixo | O servidor que você nomear precisa permitir chamadas de navegador; se não permitir, use os apps de desktop. Disconnect remove o botão |
| Enviar para o Nextcloud / WebDAV | O único arquivo que você escolheu enviar, para o seu próprio servidor, por um PUT autenticado com o endereço do servidor, nome de usuário e senha de app que você digitou (Nextcloud → Settings → Security → Devices & sessions; nunca sua senha de conta). Armazenado só neste dispositivo, nunca em um backup, apagado por Disconnect | Só quando você pressiona "Enviar para o Nextcloud" em um arquivo. Você escolhe o servidor, então ele não está na política abaixo | Seu servidor precisa permitir chamadas de navegador vindas da origem do app; se não permitir, use os apps de desktop |
| Enviar para armazenamento compatível com S3 | O único arquivo que você escolheu enviar, para o seu próprio bucket (AWS S3, MinIO, R2, B2, Garage - qualquer endpoint SigV4), assinado no seu dispositivo com o par de chaves que você digitou. As chaves são armazenadas só neste dispositivo, nunca em um backup, apagadas por Disconnect | Só quando você pressiona "Enviar para o S3" em um arquivo. Você escolhe o endpoint, então ele não está na política abaixo | As regras CORS do seu bucket precisam permitir a origem do app; se não permitirem, use os apps de desktop |
| Sincronizar entre seus dispositivos | Uma cópia do que você fez neste dispositivo - sessões e projetos salvos, seus design systems com suas fontes e logos, imagens enviadas, seu perfil e suas preferências - como um único arquivo, para o único armazenamento que você escolheu: a pasta do app Lolly no seu Dropbox (`api.dropboxapi.com`, `content.dropboxapi.com`), arquivos que o Lolly criou no seu Google Drive (`www.googleapis.com`), a pasta do app Lolly no seu OneDrive (`graph.microsoft.com`, com arquivos maiores enviados a `api.onedrive.com`, `*.up.1drv.com` ou `*.sharepoint.com`, e downloads a partir de `*.files.1drv.com`, `my.microsoftpersonalcontent.com` ou `*.sharepoint.com` da Microsoft), ou seu próprio servidor Nextcloud / WebDAV ou bucket S3. O mesmo armazenamento também guarda até sete cópias diárias e uma cópia de antes da sua última aplicação. **Nada vai para o Lolly:** nenhum servidor, relay ou servidor do Lolly Work está no caminho, e os apps não precisam do site do Lolly para isso, nem mesmo para fazer login. A cópia é criptografada no seu dispositivo primeiro só se você definir uma frase secreta. Logins, chaves, senhas de app, a frase secreta e as configurações de sincronização ficam no dispositivo e nunca estão na cópia. Na web, uma conexão lembrada do Google Drive guarda só o nome da sua conta (e seu próprio client id, se você forneceu um); o login do Google em si dura uma visita. No app Android, o login do Google Drive passa pelos serviços do Google Play no celular, que o Google opera | Só depois que você ativa "Sync across my devices" ou pressiona "Sync now": um upload logo após cada mudança e quando você sai do app, e uma checagem por uma cópia mais nova quando o app inicia | A sincronização falha e diz por quê; seu trabalho fica no dispositivo. Exporte seus dados para um arquivo e mova-o você mesmo em vez disso |
| Perfis de impressão ICC | Nada pessoal - uma requisição por um perfil padrão de condição de impressão, para o registro público do ICC (`registry.color.org`, `www.color.org`) | Só se você clicar em um preset ICC no gerenciador de perfil de impressão - uma busca única por perfil, depois ele vive no seu dispositivo | Os presets ICC falham. Forneça seu próprio perfil `.icc` em vez disso |
| Rádio pela internet | Nada pessoal - uma requisição de playlist e um stream de áudio, para a estação (`api.somafm.com` e o servidor icecast para o qual ela aponta, `*.somafm.com`) | Só enquanto você toca o rádio opcional embutido no player de som | O rádio falha. Todo outro recurso de som continua funcionando |
| Uma URL que você pede a uma ferramenta para capturar | Uma requisição para o endereço web exato que você digita, a partir da ferramenta de captura de tela de URL. Seja qual for esse endereço. Esse host não está na política abaixo, porque você o escolhe no momento de uso | Só quando você digita uma URL naquela ferramenta e inicia a captura | Um operador não consegue liberar isso por host. Para removê-lo, remova a ferramenta |
| Adicionar uma imagem de uma URL | Uma requisição para o endereço de imagem exato que você cola em "Add from URL" (no seletor de ativos ou em Assets). A própria política do app web proíbe o navegador de buscar outro site diretamente, então a requisição é feita por você por uma pequena passagem na própria origem do app (`/api/fetch-image`), que busca a imagem no lado do servidor e devolve só os bytes - ela não armazena nada e esquece o endereço. Ela recusa qualquer coisa que não seja um endereço de imagem público (um endereço privado ou interno é bloqueado). Os apps de desktop buscam o endereço diretamente. Um link do Lolly que você cola não é buscado de jeito nenhum - ele renderiza no seu dispositivo. O host não está na política abaixo, porque você o escolhe no momento de uso | Só quando você cola uma URL em "Add from URL" e confirma | O operador desliga a passagem (`LOLLY_DISABLE_IMAGE_PROXY=1`); depois só links do Lolly, imagens `data:` e imagens da mesma origem podem ser adicionadas no app web. Os apps de desktop não são afetados |
| Checagem de assinatura SEAL | **Nada.** O app web não tem nenhum resolvedor de DNS - veja abaixo | Nunca | Nada a bloquear |
| Modelos de IA no dispositivo | Nada pessoal - um download único de arquivo de modelo do host de modelos do Lolly (`lolli.li`), depois em cache no seu dispositivo; sem conta, sem identificador, só a requisição e seu IP | Só quando você usa um recurso que precisa de um modelo (Verify deep scan, upscale de imagem, fala, e similares) | Esse recurso espera o download; tudo o mais continua funcionando |
| Instância remota | O que quer que a instância que você nomear devolva, pela mesma sincronização de catálogo descrita acima - mais uma marca de versão nas requisições a ela (tipo de shell e versão do engine, a mesma informação que um user agent carrega), para que o operador dela veja quais versões do Lolly estão em uso. Em uma instância gerenciada, enquanto você está logado, essa marca também carrega um id de instalação por dispositivo para que a lista de dispositivos do operador consiga distinguir essa instalação. Ela viaja só em requisições que seu próprio uso já faz - não há temporizador e nada liga para casa sozinho - e sair da instância apaga o id, então um dispositivo que se reconectar depois apresenta um novo. Você escolhe o host no momento de uso, então ele não está na política abaixo | Só se você apontar explicitamente o shell para outro deployment do Lolly | A troca de instância falha. Sua instância local não é afetada |

Cada host fixo naquela tabela também é a lista de permissões completa na
Content-Security-Policy do app, que o navegador aplica. Então a lista não é só uma
descrição do que o código faz hoje, é a fronteira que o navegador impõe ao
app: uma mudança futura que tentasse contatar algum outro host seria bloqueada,
não permitida silenciosamente. Uma linha é a exceção deliberada, e a própria célula dela
explica isso: Enviar para o LinkedIn existe só nos apps de desktop, e a
política do app web não lista nenhum dos hosts dele - o app web não conseguiria alcançá-los
mesmo que o código tentasse.
Mais duas linhas, Bluesky e Discord, são desktop-only da mesma forma, e seus
hosts ficam de fora da política web pelo mesmo motivo. Cinco linhas não têm host
fixo, porque você escolhe o endereço no momento de uso: uma URL que você pede a uma ferramenta
para capturar, uma instância remota para a qual você aponta o shell, e seu próprio servidor
Mastodon, servidor WebDAV ou bucket S3 (os dois últimos também como um lar de sincronização). Nenhum desses está na política, e cada um
acontece só quando você digita um endereço e age sobre ele. A linha do Penpot alcança
o Penpot pela própria origem do app, então ela está coberta por `'self'`. Um deployment que não quer nenhum dos
opcionais (uma instância corporativa com suas próprias fontes, por exemplo) remove esses
hosts da própria política, e os recursos falham fechados em vez de tentar alcançá-los.

À parte dois tipos de linha, nenhuma delas envia seus documentos, projetos,
sessões ou arquivos enviados para lugar nenhum: elas existem para trazer coisas *ao* seu dispositivo
(ferramentas, fontes, modelos). Os dois tipos são as linhas de Enviar, que enviam o único arquivo
que você escolheu, e a linha de sincronização, que envia uma cópia do seu trabalho para o armazenamento que você
escolheu e para nenhum servidor do Lolly. Qualquer outra exceção é nomeada explicitamente nas
seções abaixo.

**Uma nota sobre o que removemos.** O Verify pode checar assinaturas SEAL, um esquema no qual a
chave de assinatura de um arquivo é publicada no DNS. Navegadores não conseguem fazer consultas DNS, então qualquer
implementação web precisa rotear a busca por um resolvedor DNS-over-HTTPS
de terceiros - o que mostraria a esse operador o domínio sendo verificado, além do seu endereço
IP. Costumávamos usar o da Cloudflare. **Não usamos mais, e não há
substituto**: o aplicativo web agora não passa nenhum resolvedor, então a verificação SEAL
aqui não faz nenhuma requisição de rede. Arquivos cujo registro SEAL traz a chave embutida
ainda são verificados completamente offline. Arquivos cuja chave está no DNS relatam "sem resolvedor
de chave" em vez disso, e você pode checá-los no aplicativo desktop ou de linha de comando,
que resolvem DNS nativamente pela sua própria máquina, sem nenhum terceiro
envolvido.

![A tela do Verify: uma área de soltar arquivo e nada mais - o arquivo é checado onde já está, sem upload e sem conta](/t/url-shot?url=%2F%23%2Fverify&width=1440&height=900&dpi=192&waitMs=1400&walker=1&format=svg&cropSelector=.valid-layout&dark=1&filename=cc-verify-drop) Você pode confirmar isso você mesmo: verificações via grep para esta e cada
outra afirmação nesta página, com os comandos exatos e a saída esperada, estão em
[Verify It Yourself](/info/verify-yourself.html).

## URLs de renderização com hot-link

> **Ao vivo em lolly.tools.** Toda URL `https://lolly.tools/tool/<tool-id>.<ext>?<inputs>`
> renderiza de verdade, e as entradas viajam naquela URL. A seção abaixo é
> o que isso significa para você, e um operador pode desligar o recurso na
> própria instância dele.

O aplicativo em si permanece inteiramente no seu dispositivo. Separadamente, um operador pode ativar
**URLs de renderização com hot-link** - `/tool/<tool-id>.<ext>?<inputs>` - para que um
link compartilhado do Lolly possa aparecer como uma imagem ao vivo em um README, uma wiki ou um dashboard. Buscar uma
dessas URLs pede ao servidor que renderize **dados públicos de ferramentas e catálogo** com as entradas
escritas na URL.

- <!--i:usercheck--> **Sem contas, sem cookies, sem estado.** O endpoint é anônimo, e nada
  no seu dispositivo é lido. Seus documentos, sessões e uploads nunca saem do seu
  navegador - eles não conseguem aparecer nesses links de jeito nenhum.
- <!--i:document--> **Mas a própria URL é registrada.** A query string de uma URL faz parte da linha de
  requisição, então ela aparece nos logs de acesso comuns da plataforma de hospedagem, do mesmo jeito que
  todo caminho requisitado aparece. Se as entradas de um link contêm o nome ou e-mail de alguém -
  um crachá com nome, uma assinatura de e-mail - **esse texto fica naqueles logs**, e nenhuma
  quantidade de redação de política muda isso. Então uma URL de link direto é o lugar errado para
  detalhes pessoais: dê a ela só o que você colocaria em uma página pública.
- <!--i:globe--> **As entradas são públicas por construção** de qualquer forma - elas são o que quer que o
  autor do link tenha digitado na URL, legível por qualquer um que o link alcance. Não coloque
  segredos em um link compartilhado. O Lolly oferece criptografia de link para conteúdo sensível.
- <!--i:eyeoff--> As respostas são **cacheadas e limitadas por taxa** como qualquer imagem pública, e marcadas
  `noindex` para que buscadores não indexem suas renderizações.

Está autohospedando o Lolly e não quer uma superfície de renderização pública? Defina
`LOLLY_DISABLE_RENDER_GET=1` e cada uma dessas URLs retorna 404.

## O servidor MCP (opcional, para agentes de IA)

O Lolly também pode ser alcançado por um agente de IA pelo Model Context Protocol - um
endpoint operado por um operador (lolly.tools roda um; qualquer um pode autohospedar o seu,
incluindo totalmente isolado da rede). Ele compartilha a postura de sem-contas do caminho de renderização,
mais quatro ferramentas que necessariamente lidam com bytes de arquivo:

- <!--i:cpu--> **`lolly_transform`** (roda um utilitário no dispositivo, do lado do servidor, em
  nome do agente que chamou), **`lolly_verify`** (checa Content Credentials) e **`lolly_redact`**
  (encobre regiões de uma imagem ou PDF) todas aceitam
  os bytes de um arquivo vindos de quem chamou. Eles são processados **no próprio processo, em memória**,
  e o resultado é devolvido naquela mesma chamada - o arquivo nunca é escrito em
  disco e nunca é armazenado depois que a requisição termina.
- <!--i:cpu--> **`lolly_rebrand`** (renova um slide deck antigo sobre um design system,
  pelas etapas `plan`, `compile` e `inspect`) aceita os bytes de um deck da mesma
  forma, e os processa **em memória, só para aquela chamada** - nada é
  escrito em disco nem mantido depois que a resposta é enviada. A primeira etapa dele,
  `capabilities`, diz em palavras para onde seus bytes iriam antes de você enviar
  qualquer um: em um servidor local autohospedado o deck nunca sai daquela máquina; em um
  servidor hospedado, chamar `lolly_rebrand` envia o deck para lá, até os limites
  de tamanho e de slides que essa mesma etapa dá.
- <!--i:checklist--> Toda outra ferramenta - `lolly_render`, `lolly_build_url`, `lolly_list_tools`,
  `lolly_describe_tool` - funciona só a partir de parâmetros (texto, números, cores,
  URLs, ids de ativos do catálogo), as mesmas entradas que uma URL de renderização de link direto usa.
- <!--i:lock--> O acesso é ou um token compartilhado que o operador emite para clientes em quem confia, ou
  OAuth 2.1 sem estado: tokens assinados de curta duração verificados contra um segredo
  compartilhado, nada armazenado do lado do servidor e o próprio token nunca é escrito em um
  log ou em uma URL de renderização.

## Identidade de Content Credentials (um login que você precisa iniciar você mesmo)

O Lolly pode selar uma **Content Credential** criptográfica em suas exportações para que qualquer pessoa
possa verificar, offline, que um arquivo permanece inalterado desde que saiu do Lolly. Isso já vem
**ativado por padrão e totalmente local** - a chave de assinatura é gerada no seu dispositivo
e a própria assinatura acontece offline. Sem inscrição, essa chave é descartável:
um par de chaves novo é gerado a cada exportação e descartado junto com ela. Depois que você se inscreve, a
chave passa a ser permanente e é gerada **não extraível** - nem mesmo o próprio código do Lolly
consegue lê-la, só pode pedir que ela assine. De um jeito ou de outro, ela nunca sai do seu
dispositivo. Esta seção cobre a única etapa *opcional* além disso:
inscrever uma identidade verificada, para que suas exportações digam "Verificado - assinado por
\<your email\>" em vez de uma chave anônima. **Se você pular a inscrição, nada nesta seção
se aplica a você, e nenhum dado pessoal jamais sai do seu dispositivo.**

![O cartão de identidade verificada na página de perfil, largura de celular: o seletor de duração do certificado e a etapa de inscrição abaixo dele, adormecida até você mesmo iniciá-la](/t/url-shot?url=%2F%23%2Fsettings%3Ffocus%3Didentity-section&width=430&height=1600&dpi=192&waitMs=2400&css=.welcome-dialog%2C.personalize-nudge%7Bdisplay%3Anone%7D&format=svg&walker=1&cropSelector=%23identity-section&dark=1&filename=pv-identity-enrol)

Se você se inscrever, aqui está exatamente o que acontece:

1. **Você escolhe um método de login** - GitHub, Google, SUSE (id.suse.com) ou um
   link por e-mail. Para os três provedores OIDC, você é redirecionado para a
   própria página de login daquele provedor, regida pela política de privacidade dele, não a nossa.
   O serviço de certificado do Lolly recebe de volta só um endereço de e-mail verificado e
   o nome do provedor. Para o link por e-mail, o endereço que você digita é passado ao
   **Resend**, uma API de e-mail transacional, só para entregar aquele link.
2. **Um cookie de curta duração protege o redirecionamento.** Este é o único cookie que
   todo o sistema Lolly define: `lolly_ca_state`, `HttpOnly`, restrito a `/api/ca`,
   expirando em até dez minutos. Ele carrega um valor aleatório, não um
   identificador de rastreamento, e existe só para impedir a falsificação do redirecionamento OAuth. Ele é
   apagado assim que o login termina.
3. **Seu endereço IP é usado, brevemente, para prevenir abuso** dos
   endpoints de login (para que um script não consiga entupir uma caixa de entrada ou esgotar a cota de e-mail).
   O Lolly faz o hash dele antes de criar um balde de controle de abuso de curta duração; o endereço
   bruto não é enviado a esse armazenamento. O balde expira depois de cerca de um minuto
   e não é usado para rastreamento. Os logs de acesso de hospedagem comuns são separados e
   descritos abaixo.
4. **O serviço de certificado emite um certificado de curta duração** (7, 30, 90 ou 365
   dias, sua escolha, limitado pela política do operador) vinculando seu e-mail verificado
   à metade pública do par de chaves gerado no seu dispositivo. A metade privada
   nunca sai do seu navegador.
5. **Nada sobre a emissão é registrado.** O serviço de certificado não mantém
   log de emissão: nem seu e-mail, nem o provedor, nem um número de série, nem um
   timestamp. Sem banco de dados, sem linha de log, sem webhook. Seu endereço de e-mail existe na
   requisição só pelo tempo suficiente para ser escrito no certificado que o seu próprio
   dispositivo recebe, e depois disso ele desaparece completamente do nosso lado.
6. **Depois disso, assinar volta a ser offline** por toda a vida útil do certificado.
   Exportar um arquivo nunca contata o serviço de certificado - só a inscrição contatou.

**A contrapartida, dita sem rodeios.** Uma versão anterior deste serviço registrava cada
emissão em log, para que um certificado emitido incorretamente ou comprometido pudesse ser rastreado. Nós
removemos isso, porque esse log era o único lugar em todo o Lolly onde dados
pessoais chegavam a repousar em um servidor, e preferimos não guardá-los a guardá-los
com cuidado. O que abrimos mão é da rastreabilidade do lado do servidor: se um certificado é
usado indevidamente, não conseguimos consultar quem o obteve. Certificados têm vida curta
por design - de 7 a 365 dias, à sua escolha, limitado pelo operador - e expiram por
conta própria, que é a mitigação em que confiamos em vez disso. Quem autogerencia o Lolly e cujas
próprias obrigações exigem um log de auditoria pode adicionar um, e assim se tornar o controlador
desses dados.

## A extensão de navegador

A extensão de navegador **Lolly URL Screenshot** não coleta, armazena ou
transmite nenhum dado pessoal. Sem analytics, sem rastreamento, sem servidor remoto.

**O que ela faz.** Quando você pede ao aplicativo web do Lolly para capturar uma URL, a
extensão abre essa página em uma aba temporária em segundo plano, a captura no seu
navegador usando o DevTools Protocol, devolve a imagem ao aplicativo e fecha
a aba. Tudo acontece localmente, no seu próprio dispositivo e rede.

**Dados.**

- <!--i:shieldcheck--> **Não coletamos nada.** A extensão não tem servidores e não faz nenhuma requisição
  de rede própria.
- <!--i:photos--> **As imagens capturadas** vão direto para o aplicativo Lolly no mesmo navegador - nunca
  enviadas pela extensão.
- <!--i:link--> **As URLs que você captura** são usadas apenas para carregar aquela página para aquela
  captura. Elas não são registradas em log nem compartilhadas.

**Permissões.**

- <!--i:wrench--> **`debugger`** - para capturar a página renderizada via o DevTools Protocol (o
  mesmo mecanismo que o aplicativo desktop do Lolly usa).
- <!--i:monitor--> **`tabs`** - para abrir e fechar a aba temporária em que a página é carregada.
- <!--i:globe--> **Acesso a hosts (`<all_urls>`)** - porque a página que você escolhe capturar pode estar
  em qualquer site. O Chrome exibe isso no momento da instalação como um aviso amplo
  de permissão. A extensão só visita a URL que você fornece a ela.

Nada disso é usado para ler, monitorar ou transmitir sua navegação além dessa
única captura solicitada.

## Logs de infraestrutura

Como qualquer site, os servidores por trás de lolly.tools - e por trás de qualquer
deployment do Lolly - geram logs de acesso padrão de servidor web sempre que uma requisição os
alcança: endereço IP, caminho requisitado, timestamp, user agent. Esse é comportamento básico
de hospedagem, não algo que o Lolly adiciona por cima, e nunca contém o
conteúdo dos seus documentos, porque eles nunca chegam a um servidor para começo de conversa. A
única exceção deliberada é um arquivo que você explicitamente entrega a uma chamada MCP
`lolly_transform`, `lolly_verify`, `lolly_redact` ou `lolly_rebrand`, que
é processado em memória e nunca escrito em disco ou em um log, como descrito acima.

**O próprio código do Lolly não grava nada nesses logs.** O servidor MCP não contém
nenhuma instrução de log. O serviço de certificados emite exatamente duas linhas, ambas
em caso de falha e ambas deliberadamente reduzidas: um código de status de falha de envio sem
endereço de destinatário, e uma mensagem de erro sem stack trace ou URL (um stack trace poderia
carregar um token de inscrição). Tudo mais no log é da plataforma de hospedagem,
não nosso.

No caso do lolly.tools, a hospedagem é a Vercel, e a retenção dos logs de acesso segue os padrões
da própria plataforma Vercel para o nosso plano. Não configuramos nenhum log drain, nenhuma exportação
de log de longo prazo e nenhum produto de analytics ou monitoramento por cima. Não mantemos nenhuma cópia desses
logs por conta própria, o que também significa que não temos como buscá-los para você - veja
[Seus direitos](#your-rights).

## Bases legais, retenção e destinatários

Quase nada aqui precisa de uma base legal, porque quase nada é processado. Para
completude, a lista inteira:

| Processamento | Base legal (GDPR Art. 6) | Retido por |
|---|---|---|
| Tudo no seu dispositivo (documentos, preferências, cache, contadores) | **Não é processamento nosso** - nunca chega até nós. O armazenamento no seu dispositivo é estritamente necessário para o serviço que você pediu (ePrivacy Art. 5(3)), então não precisa de consentimento | Até você excluí-lo |
| Seu endereço de e-mail durante a inscrição em Content Credentials | **Art. 6(1)(b)**, execução de um serviço que você pediu explicitamente | Não retido. Presente em memória só durante a duração da requisição |
| Uma chave de balde derivada em uma via a partir do seu endereço IP nos endpoints de login, para limitação de taxa | **Art. 6(1)(f)**, nosso interesse legítimo em prevenir abuso de um serviço gratuito e da cota de e-mail de terceiros. Consideramos que isso passa em um teste de balanceamento porque o endereço bruto não é enviado ao limitador, o balde é usado só para controle de abuso e ele expira automaticamente | Cerca de 1 minuto no armazenamento de controle de abuso; não retido depois disso |
| Logs de acesso de hospedagem (IP, caminho, timestamp, user agent) | **Art. 6(1)(f)**, nosso interesse legítimo em segurança do serviço, prevenção de abuso e diagnóstico de falhas | Padrão da plataforma da Vercel para o nosso plano. Não adicionamos nenhuma captura (drain) ou exportação |

**Destinatários.** As categorias de destinatário são: nosso provedor de hospedagem (Vercel
Inc.); nosso provedor de armazenamento de controle de abuso, que recebe só chaves de balde de curta duração,
derivadas em uma via, e nunca o endereço IP bruto; e - só se você usar
a opção de login por e-mail - um provedor de e-mail transacional (Resend). Se você fizer login
com GitHub, Google ou SUSE (id.suse.com), você
interage com esse provedor diretamente, sob a própria política de privacidade dele. Eles nos dizem
um endereço de e-mail verificado e nada mais. Não compartilhamos dados pessoais com mais ninguém,
e não vendemos dados, não fazemos publicidade nem perfilamos usuários.

**Transferências para fora do EEE.** Vercel e Resend são empresas dos EUA. A computação de funções
para lolly.tools é fixada na região de Frankfurt (`fra1`) da Vercel, então
o processamento acontece na UE, mas, como provedores sediados nos EUA, eles ainda podem
acessar dados como processadores a partir dos EUA. Essas transferências se apoiam nas Cláusulas
Contratuais Padrão da Comissão Europeia e/ou no Data Privacy Framework UE-EUA,
como definido no acordo de processamento de dados de cada provedor. Como os
dados pessoais que chegam a esses provedores são tão limitados - um endereço de e-mail
repassado para enviar uma mensagem, logs de acesso comuns, e um balde de controle de abuso
derivado de curta duração - a exposição é correspondentemente pequena.

**Decisões automatizadas.** Nenhuma. Não há criação de perfis nem decisão automatizada
que produza efeitos legais ou similarmente significativos (Art. 22).

## Privacidade de crianças

O Lolly não coleta intencionalmente informações pessoais de ninguém, de qualquer idade, no
uso normal do app - não há nada a coletar. O único lugar em que
informações pessoais (um endereço de e-mail) são coletadas é o cadastro em Content Credentials,
descrito acima, que não é direcionado nem destinado a crianças.

## Seus direitos

Como quase tudo que o Lolly toca é armazenado só no seu próprio dispositivo, a maior parte do
que a lei de proteção de dados chama de "seus direitos" - acesso, correção, exclusão,
portabilidade - são coisas que você já pode fazer sozinho, instantaneamente, sem pedir a
ninguém: seus dados vivem no armazenamento do seu navegador, em uma forma que você pode inspecionar,
exportar (**Exportar meus dados**, acima) ou excluir (limpando o armazenamento do site no
seu navegador, como acima).

Formalmente, nos termos dos Artigos 15-22 do GDPR, você tem o direito de **acessar** seus
dados pessoais, de **retificá-los**, de **apagá-los**, de **restringir** ou **se opor
a** seu processamento (incluindo se opor a qualquer coisa que baseemos em interesses
legítimos), à **portabilidade de dados** e - quando o processamento se basear em consentimento - de
**retirar esse consentimento a qualquer momento**, sem afetar a legalidade do que
aconteceu antes de você retirá-lo.

Aqui está a posição honesta sobre exercer esses direitos contra nós. Já que não mantemos mais
um log de emissão, **não temos nenhum dado pessoal seu que possamos consultar,
corrigir, exportar ou excluir.** Se você escrever e perguntar o que temos sobre você, a
resposta verdadeira é nada, e diremos isso. A única categoria que existe de fato
é a de logs de acesso de hospedagem indexados por um endereço IP, mantidos pelo nosso provedor de hospedagem
sob os padrões de retenção dele. Não temos como buscar ou apagar seletivamente
esses logs, e diremos isso a você em vez de fingir o contrário. Tudo o
que é de fato *seu* está no seu dispositivo, onde você já pode ler, exportar
e destruir sem pedir permissão a ninguém.

**Você tem o direito de reclamar.** Se você acha que tratamos seus dados
de forma inadequada, pode registrar uma reclamação junto a uma autoridade
supervisora de proteção de dados - na UE, a autoridade do seu país de residência, local de trabalho
ou onde você acredita que a infração ocorreu (Art. 77). Nossa autoridade supervisora
principal é o *Bayerisches Landesamt für Datenschutzaufsicht* (BayLDA), em
Ansbach, Alemanha. Você não precisa nos contatar primeiro, embora gostaríamos da
chance de corrigir o problema.

Não vendemos dados. Não temos nenhum para vender.

## Alterações nesta política

A data no topo muda sempre que este documento muda. Uma alteração que muda
o que sai do seu dispositivo ou o que é retido ganha sua própria linha aqui, não é uma edição
silenciosa - se quiser ver o que mudou, pergunte (abaixo) ou compare com a
[fonte pública](https://github.com/lolly-tools/lolly/commits/main/docs/privacy.md).

## Quem é responsável e como nos contatar

O **controlador de dados** do lolly.tools é:

> SUSE Software Solutions Germany GmbH
> Frankenstraße 146
> 90461 Nürnberg
> Alemanha

A SUSE nomeou um **Encarregado de Proteção de Dados**, que pode ser contatado em
[privacy@suse.com](mailto:privacy@suse.com). Use esse endereço para qualquer solicitação formal
sob "Seus direitos" acima.

Para qualquer coisa sobre o Lolly em si - como funciona, por que algo é do jeito que é ou
uma correção a este documento - entre em contato com **Andy Fitzsimon**,
[fitzy@suse.com](mailto:fitzy@suse.com).

Para uma instância do Lolly self-hosted ou empresarial, entre em contato com quem a opera
em vez de nós: o operador é o controlador da própria implantação. A SUSE e o
projeto open source Lolly não mantêm dados de implantações que não operam.
