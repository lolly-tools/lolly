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

Nada disso é compartilhado, vendido ou usado para identificar ou rastrear você. Não há nada
para consentir, porque não está havendo coleta - apenas este aviso, para que você
saiba o que é mantido e onde. Apague tudo isso a qualquer momento em **Profile → Clear all
my data**, ou limpando o armazenamento do site no seu navegador. (Segundo a Diretiva
ePrivacy Art. 5(3), o armazenamento estritamente necessário para o serviço que você solicitou
não exige consentimento - apenas transparência, que é exatamente o que este documento e
o aviso no aplicativo oferecem.)

![A seção de armazenamento da página de perfil em uma tela com largura de celular: cada categoria de dado no dispositivo é nomeada, com o botão Clear all my data logo ao lado](/t/url-shot?url=%2F%23%2Fprofile%3Ffocus%3Dstorage-section&width=430&height=1600&dpi=192&waitMs=2400&css=.welcome-dialog%2C.personalize-nudge%2C.store-manages%2C.storage-subsection%2C.store-selbar%2C.store-chip-val%2C%23store-hero-num%2C%23store-headroom%2C%23store-quota%2C%23store-reclaim%7Bdisplay%3Anone%7D&format=svg&walker=1&cropSelector=%23storage-section&dark=1&filename=pv-storage-clear)

Seu próprio backup desses dados - o pacote `lolly-backup` produzido por **Export my
data & render everything** - é um arquivo que você guarda e controla. Ele nunca toca nossos
servidores, a menos que você escolha enviá-lo para algum lugar por conta própria. Veja [Transferência
de Dados](/info/data-transfer.html).

## Utilitários no dispositivo

Algumas ferramentas - **Strip Hidden Data**, **Compress PDF** e outras que exibem o
selo **"Runs on your device"** - operam sobre um arquivo que você fornece. O arquivo é lido
para a memória no seu navegador, transformado localmente e oferecido de volta como um download.
Ele nunca é enviado, porque não há servidor no caminho para o qual enviá-lo.
Esses utilitários funcionam offline, e sua saída não carrega nenhuma marca d'água ou metadado
nosso - o objetivo da maioria deles é remover e proteger dados, não adicionar risco.

![O selo que essas ferramentas exibem: Runs on your device - nada é enviado](/t/url-shot?url=%2F%23%2Ftool%2Fstrip-data&width=1440&height=900&dpi=192&waitMs=2400&walker=1&format=svg&cropSelector=.on-device-badge&dark=1&filename=pv-ondevice-badge)

## Quando o aplicativo se comunica com uma rede, por completo

A tabela abaixo é a lista completa de tudo que o aplicativo busca ou envia por uma
rede. Se não estiver aqui, o aplicativo não faz isso.

| O quê | O que realmente sai do seu dispositivo | Quando (o ato que aciona isso) | Se um operador bloquear isso |
|---|---|---|---|
| Sincronização do catálogo de ferramentas | Nada pessoal - uma requisição para o próprio índice público de ferramentas e ativos da Lolly, para a própria origem do aplicativo | Na inicialização, depois armazenado em cache offline | O aplicativo funciona com seu conjunto de ferramentas em cache. Ele só para de descobrir novas ferramentas |
| Uma ferramenta que precisa de dados em tempo real | O que essa ferramenta específica solicitar, para o host nomeado em sua própria descrição. Hoje isso é apenas a busca de cidade na ferramenta Meeting Planner, que consulta `geocoding-api.open-meteo.com` para transformar um nome de cidade em coordenadas e um fuso horário - sem conta, sem chave e sem identificador além da própria requisição. O campo de entrada diz isso bem onde você digita, e cada resposta é salva no seu dispositivo, para que uma cidade seja consultada apenas uma vez | Apenas enquanto usa essa ferramenta, e apenas quando você insere uma localização | Essa busca específica falha. Você ainda pode digitar coordenadas manualmente, e nada mais é afetado |
| Google Fonts | O nome da família de fonte escolhida e seu endereço IP, para os servidores de fonte do Google (`fonts.googleapis.com` para a folha de estilo, `fonts.gstatic.com` para o arquivo de fonte) | Apenas se você adicionar uma Google Font no editor de marca, **e somente depois de concordar com isso em uma caixa de diálogo que diz exatamente isso** - uma busca única por família, que depois fica no seu dispositivo e é usada offline | O seletor de Google Fonts falha de forma segura. Envie um arquivo de fonte em vez disso |
| Enviar para o Google Drive | O único arquivo que você escolheu enviar, para a API do Google Drive (`www.googleapis.com`), depois de um login do Google que você completa na própria janela pop-up do Google. O acesso da Lolly é limitado aos arquivos que ela criou (o escopo `drive.file` - ela nunca pode ler o restante do seu Drive), e o token de login é mantido em memória apenas durante a sessão, nunca armazenado | Apenas quando você pressiona "Send to Google Drive" em uma exportação EMF, e apenas em builds onde o operador configurou um client id do Google - sem um, o botão não existe | O botão nunca aparece. Baixe o arquivo e envie-o ao Drive você mesmo |
| Enviar para o Dropbox | O único arquivo que você escolheu enviar, para a API do Dropbox (`api.dropboxapi.com` para login e metadados, `content.dropboxapi.com` para o próprio arquivo), depois de um login do Dropbox que você completa na própria janela do Dropbox. O acesso da Lolly é restrito à pasta do aplicativo (ela só pode ver `Apps/` e sua própria pasta ali - nunca o restante do seu Dropbox), o link "Open" que ela mostra é um link privado de curta duração (nenhum compartilhamento público é criado), e um token de atualização só é armazenado se você marcar "stay connected" | Apenas quando você pressiona "Send to Dropbox" em um arquivo, e apenas em builds onde o operador configurou um client id do Dropbox - sem um, o botão não existe | O botão nunca aparece. Baixe o arquivo e envie-o ao Dropbox você mesmo |
| Enviar para o OneDrive | O único arquivo que você escolheu enviar, para os serviços de identidade e Graph da Microsoft (`login.microsoftonline.com` para login, `graph.microsoft.com` para o envio; um arquivo grande é enviado em partes para um endereço de upload de propriedade da Microsoft em `api.onedrive.com`, `*.up.1drv.com` ou `*.sharepoint.com`), depois de um login da Microsoft que você completa na própria janela da Microsoft. O acesso da Lolly é limitado à sua própria pasta em `Apps/` (ela nunca pode ler o restante do seu OneDrive) mais seu nome de exibição para o rótulo da conta, e um token de atualização só é armazenado se você marcar "stay connected" | Apenas quando você pressiona "Send to OneDrive" em um arquivo, e apenas em builds onde o operador configurou um client id da Microsoft - sem um, o botão não existe | O botão nunca aparece. Baixe o arquivo e envie-o ao OneDrive você mesmo |
| Enviar para o LinkedIn | O único arquivo que você escolheu enviar, mais o nome dele como o texto da publicação, para o LinkedIn (`www.linkedin.com` para o login, `api.linkedin.com` para o envio e a publicação), depois de um login do LinkedIn que você completa no seu próprio navegador. A publicação vai para o seu próprio feed como uma publicação pública sob o seu nome. A Lolly pode publicar como você e ler seu nome para o rótulo da conta, nada mais no seu LinkedIn, e o login só fica salvo neste dispositivo se você marcar "stay connected" - os tokens do LinkedIn duram 60 dias e não podem ser renovados silenciosamente, então expiram por conta própria | Apenas quando você pressiona "Send to LinkedIn" em um arquivo, somente nos aplicativos desktop, e apenas em builds onde um aplicativo do LinkedIn está configurado - sem um, o botão não existe | Nada a bloquear no aplicativo web: isso existe apenas nos **aplicativos desktop**, então esses dois hosts deliberadamente NÃO estão na Content-Security-Policy do aplicativo web abaixo. Nos aplicativos desktop, remova o aplicativo do LinkedIn configurado e o botão nunca aparece |
| Perfis de impressão ICC | Nada pessoal - uma requisição para um perfil de condição de impressão padrão, para o registro público da ICC (`registry.color.org`, `www.color.org`) | Apenas se você clicar em um predefinido ICC no gerenciador de perfis de impressão - uma busca única por perfil, que depois fica no seu dispositivo | Os predefinidos ICC falham. Forneça seu próprio perfil `.icc` em vez disso |
| Rádio pela internet | Nada pessoal - uma requisição de playlist e um stream de áudio, para a estação (`api.somafm.com` e o servidor icecast que ela nomeia, `*.somafm.com`) | Apenas enquanto você reproduz o rádio integrado opcional no player de som | O rádio falha. Todos os outros recursos de som continuam funcionando |
| Uma URL que você pede a uma ferramenta para capturar | Uma requisição para o endereço web exato que você digita, da ferramenta de captura de tela de URL. Seja qual for esse endereço. Esse host não está na política abaixo, porque você o escolhe no momento do uso | Apenas quando você insere uma URL nessa ferramenta e inicia a captura | Um operador não pode colocar isso em lista de permissões por host. Para removê-lo, remova a ferramenta |
| Verificação de assinatura SEAL | **Nada.** O aplicativo web não tem nenhum resolvedor DNS - veja abaixo | Nunca | Nada a bloquear |
| Modelos de IA no dispositivo | Nada pessoal - um download único do arquivo de modelo do host de modelos da Lolly (`lolli.li`), depois armazenado em cache no seu dispositivo; sem conta, sem identificador, apenas a requisição e seu IP | Apenas quando você usa um recurso que precisa de um modelo (varredura profunda do Verify, upscale de imagem, fala e semelhantes) | Esse recurso aguarda o download; tudo o mais continua funcionando |
| Instância remota | O que quer que a instância que você nomear devolva, pela mesma sincronização de catálogo descrita acima - além de uma tag de versão nas requisições a ela (tipo de shell e versão do engine, a mesma informação que um user agent carrega), para que o operador dela possa ver quais versões da Lolly estão em uso. Em uma instância gerenciada, enquanto você está conectado, essa tag também carrega um id de instalação por dispositivo, para que a lista de dispositivos do operador consiga distinguir essa instalação. Ela só acompanha requisições que o seu próprio uso já faz - não há temporizador e nada entra em contato sozinho - e sair da instância apaga o id, então um dispositivo que se reconectar depois apresenta um novo. Você escolhe o host no momento do uso, então ele não está na política abaixo | Apenas se você apontar explicitamente o shell para outra implantação da Lolly | A troca de instância falha. Sua instância local não é afetada |

Cada host fixo dessa tabela também compõe toda a lista de permissões na
Content-Security-Policy do aplicativo, que o navegador aplica. Portanto, a lista não é apenas
uma descrição do que o código faz hoje, é o limite ao qual o navegador mantém o
aplicativo restrito: uma mudança futura que tentasse contatar algum outro host seria bloqueada,
não permitida silenciosamente. Uma linha é a exceção deliberada, e sua própria célula diz
isso: Enviar para o LinkedIn existe apenas nos aplicativos desktop, então a política do aplicativo
web não nomeia nenhum dos seus hosts - o aplicativo web não conseguiria alcançá-los mesmo que seu código tentasse.
Mais duas linhas não têm host fixo, porque você escolhe o
endereço no momento do uso: uma URL que você pede a uma ferramenta para capturar, e uma instância
remota para a qual você aponta o shell. Nenhuma das duas está na política, e cada uma só acontece
quando você digita um endereço e age sobre ele. Uma implantação que não quer nenhuma das
opcionais (uma instância corporativa com suas próprias fontes, por exemplo) remove esses
hosts da sua política, e os recursos falham de forma segura em vez de tentar se conectar.

Nenhum desses casos envia seus documentos, projetos, sessões ou arquivos enviados para lugar algum.
Eles existem para trazer coisas *para* o seu dispositivo (ferramentas, fontes, modelos), nunca para enviar
coisas *dele*, com as exceções nomeadas explicitamente nas seções abaixo.

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

> **Ativo no lolly.tools.** Toda
> URL `https://lolly.tools/tool/<tool-id>.<ext>?<inputs>` é renderizada de
> verdade, e as entradas viajam nessa URL. A seção abaixo explica o que isso
> significa para você, e um operador pode desativar o recurso na própria
> instância.

O aplicativo em si permanece inteiramente no seu dispositivo. Separadamente, um operador pode ativar
**URLs de renderização com hot-link** - `/tool/<tool-id>.<ext>?<inputs>` - para que um
link compartilhado do Lolly possa aparecer como uma imagem ao vivo em um README, uma wiki ou um dashboard. Buscar uma
dessas URLs pede ao servidor que renderize **dados públicos de ferramentas e catálogo** com as entradas
escritas na URL.

- <!--i:usercheck--> **Sem contas, sem cookies, sem estado.** O endpoint é anônimo, e nada
  no seu dispositivo é lido. Seus documentos, sessões e envios nunca saem do seu
  navegador - eles não podem aparecer nesses links de jeito nenhum.
- <!--i:document--> **Mas a própria URL é registrada.** A query string de uma URL faz parte da
  linha de requisição, então ela aparece nos registros de acesso comuns da plataforma
  de hospedagem, da mesma forma que todo caminho requisitado aparece. Se as entradas de
  um link contêm o nome ou e-mail de alguém - um crachá, uma assinatura de e-mail -
  **esse texto fica nesses registros**, e nenhuma redação de política muda isso. Por isso uma URL de hot-link é o lugar
  errado para dados pessoais: coloque nela apenas o que você colocaria em uma página pública.
- <!--i:globe--> **As entradas são públicas por construção** de qualquer forma - são o que quer
  que o autor do link tenha digitado na URL, legível por qualquer um que o link alcance.
  Não coloque segredos em um link compartilhado. O Lolly oferece criptografia de link
  para conteúdo sensível.
- <!--i:eyeoff--> As respostas ficam **em cache e com limite de taxa** como qualquer imagem
  pública, e marcadas como `noindex` para que os mecanismos de busca não indexem suas
  renderizações.

Está autogerenciando o Lolly e não quer uma superfície pública de renderização? Defina
`LOLLY_DISABLE_RENDER_GET=1`, e todas
essas URLs retornam 404.

## O servidor MCP (opcional, para agentes de IA)

O Lolly também pode ser acessado por um agente de IA através do Model Context Protocol - um
endpoint operado pelo operador (o lolly.tools opera um; qualquer pessoa pode autogerenciar o seu próprio,
incluindo totalmente air-gapped). Ele compartilha a postura sem contas do caminho de renderização,
mais três ferramentas que necessariamente lidam com bytes de arquivo:

- <!--i:cpu--> **`lolly_transform`** (executa um utilitário no dispositivo, mas do lado do servidor, em
  nome do agente que chamou), **`lolly_verify`** (checa Content Credentials) e **`lolly_redact`**
  (bloqueia regiões de uma imagem ou PDF) - todos aceitam
  os bytes de um arquivo vindos de quem chama. Eles são processados **no próprio processo, em memória**,
  e o resultado é devolvido nessa mesma chamada - o arquivo nunca é gravado em
  disco e nunca é armazenado depois que a requisição termina.
- <!--i:checklist--> Toda outra ferramenta - `lolly_render`, `lolly_build_url`, `lolly_list_tools`,
  `lolly_describe_tool` - funciona apenas a partir de parâmetros (texto, números, cores,
  URLs, ids de recursos do catálogo), as mesmas entradas que uma URL de renderização com hot-link usa.
- <!--i:lock--> O acesso é ou um token compartilhado que o operador emite para os clientes em que confia, ou
  OAuth 2.1 sem estado: tokens assinados de curta duração verificados contra um segredo
  compartilhado, nada armazenado do lado do servidor, e o próprio token nunca é gravado em um
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

![O cartão de identidade Verified na página de perfil, com largura de celular: o seletor de tempo de vida do certificado e a etapa de inscrição abaixo dele, inativa até que você mesmo a inicie](/t/url-shot?url=%2F%23%2Fprofile%3Ffocus%3Didentity-section&width=430&height=1600&dpi=192&waitMs=2400&css=.welcome-dialog%2C.personalize-nudge%7Bdisplay%3Anone%7D&format=svg&walker=1&cropSelector=%23identity-section&dark=1&filename=pv-identity-enrol)

Se você se inscrever, aqui está exatamente o que acontece:

1. **Você escolhe um método de login** - GitHub, Google, SUSE (id.suse.com) ou um
   link enviado por e-mail. Para os três provedores OIDC, você é redirecionado para a
   própria página de login do provedor, regida pela política de privacidade dele, não pela nossa.
   O serviço de certificados do Lolly recebe de volta apenas um endereço de e-mail verificado e
   o nome do provedor. Para o link por e-mail, o endereço que você digita é passado para o
   **Resend**, uma API de e-mail transacional, apenas para entregar esse link.
2. **Um cookie de curta duração protege o redirecionamento.** Este é o único cookie que
   todo o sistema Lolly define: `lolly_ca_state`, `HttpOnly`, restrito a `/api/ca`,
   expirando em até dez minutos. Ele carrega um valor aleatório, não um identificador
   de rastreamento, e existe apenas para impedir a falsificação do redirecionamento OAuth. Ele é
   apagado assim que o login é concluído.
3. **Seu endereço IP é usado, brevemente, para prevenir abuso** dos
   endpoints de login (para que um script não consiga fazer spam em uma caixa de entrada ou esgotar a cota de e-mails) - mantido
   apenas na memória do servidor, em uma janela deslizante de cerca de um minuto, nunca gravado
   em um log nem persistido em lugar algum.
4. **O serviço de certificados emite um certificado de curta duração** (7, 30, 90 ou 365
   dias, à sua escolha, limitado pela política do operador) vinculando seu e-mail
   verificado à metade pública do par de chaves gerado no seu dispositivo. A metade
   privada nunca sai do seu navegador.
5. **Nada sobre a emissão é registrado.** O serviço de certificados não mantém nenhum
   log de emissão: nem seu e-mail, nem o provedor, nem um número de série, nem um
   timestamp. Nenhum banco de dados, nenhuma linha de log, nenhum webhook. Seu endereço de e-mail existe na
   requisição apenas pelo tempo suficiente para ser gravado no certificado que seu próprio
   dispositivo recebe, e depois desaparece completamente do nosso lado.
6. **Depois disso, a assinatura volta a ser offline** por toda a vida útil do certificado.
   Exportar um arquivo nunca contata o serviço de certificados - apenas a inscrição contatou.

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

Como qualquer site, os servidores por trás do lolly.tools - e por trás de qualquer
implantação do Lolly - geram logs de acesso padrão de servidor web sempre que uma requisição os
alcança: endereço IP, caminho requisitado, timestamp, user agent. Isso é um comportamento
básico de hospedagem, não algo que o Lolly adiciona por cima, e nunca contém o
conteúdo dos seus documentos, porque eles nunca chegam a um servidor, para começar. A
única exceção deliberada é um arquivo que você explicitamente entrega a uma chamada MCP
`lolly_transform`, `lolly_verify` ou `lolly_redact`, que é processado em memória e nunca
gravado em disco ou em um log, como descrito acima.

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
| Tudo no seu dispositivo (documentos, preferências, cache, contadores) | **Não é processamento nosso** - nunca chega até nós. O armazenamento no seu dispositivo é estritamente necessário para o serviço que você solicitou (ePrivacy Art. 5(3)), então não precisa de consentimento | Até você excluir |
| Seu endereço de e-mail durante o cadastro em Content Credentials | **Art. 6(1)(b)**, execução de um serviço que você solicitou explicitamente | Não retido. Presente na memória apenas durante a duração da solicitação |
| Seu endereço IP nos endpoints de login, para limitação de taxa | **Art. 6(1)(f)**, nosso interesse legítimo em prevenir abuso de um serviço gratuito e da cota de e-mail de terceiros. Consideramos que isso passa em um teste de balanceamento porque fica apenas na memória, nunca é gravado e é descartado em cerca de um minuto | ~1 minuto, na memória do servidor, nunca persistido |
| Logs de acesso de hospedagem (IP, caminho, timestamp, user agent) | **Art. 6(1)(f)**, nosso interesse legítimo em segurança do serviço, prevenção de abuso e diagnóstico de falhas | Padrão da plataforma da Vercel para o nosso plano. Não adicionamos nenhuma captura (drain) ou exportação |

**Destinatários.** As categorias de destinatário são: nosso provedor de hospedagem (Vercel
Inc.) e - somente se você usar a opção de login por e-mail - um provedor de e-mail
transacional (Resend). Se você fizer login com GitHub, Google ou SUSE (id.suse.com), você
interage com esse provedor diretamente sob a própria política de privacidade dele. Eles nos informam
um endereço de e-mail verificado e nada mais. Não compartilhamos dados pessoais com mais ninguém,
e não vendemos dados, não fazemos publicidade nem criamos perfis de usuários.

**Transferências para fora do EEE.** Vercel e Resend são empresas dos EUA. A computação de funções
para lolly.tools está fixada na região de Frankfurt (`fra1`) da Vercel, então
o processamento acontece na UE, mas como provedores sediados nos EUA eles ainda podem
acessar dados como processadores a partir dos EUA. Essas transferências se baseiam nas Cláusulas
Contratuais Padrão da Comissão Europeia e/ou no EU-US Data Privacy
Framework, conforme estabelecido no acordo de processamento de dados de cada provedor. Como os
dados pessoais que chegam a qualquer um dos provedores são tão limitados - um endereço de e-mail
passado adiante para enviar uma mensagem, e logs de acesso comuns - a exposição é
correspondentemente pequena.

**Decisões automatizadas.** Nenhuma. Não há criação de perfis nem decisão automatizada
que produza efeitos legais ou similarmente significativos (Art. 22).

## Privacidade de crianças

O Lolly não coleta intencionalmente informações pessoais de ninguém, de qualquer idade, no
uso normal do app - não há nada a coletar. O único lugar em que
informações pessoais (um endereço de e-mail) são coletadas é o cadastro em Content Credentials,
descrito acima, que não é direcionado nem destinado a crianças.

## Seus direitos

Como quase tudo que o Lolly toca é armazenado apenas no seu próprio dispositivo, a maior parte do
que a legislação de proteção de dados chama de "seus direitos" - acesso, correção, exclusão,
portabilidade - são coisas que você já pode fazer sozinho, instantaneamente, sem pedir a
ninguém: seus dados vivem no armazenamento do seu navegador, em um formato que você pode inspecionar,
exportar (**Export my data & render everything**, acima) ou excluir (**Profile → Clear all
my data**).

Formalmente, nos termos dos Artigos 15-22 do GDPR, você tem o direito de **acessar** seus
dados pessoais, de **retificá-los**, de **apagá-los**, de **restringir** ou **se opor
a** seu processamento (incluindo se opor a qualquer coisa que baseemos em interesses
legítimos), à **portabilidade de dados** e - quando o processamento se basear em consentimento - de
**retirar esse consentimento a qualquer momento**, sem afetar a legalidade do que
aconteceu antes de você retirá-lo.

Aqui está a posição honesta sobre exercê-los contra nós. Como não mantemos mais um
registro de emissão, **não temos nenhum dado pessoal seu que possamos consultar,
corrigir, exportar ou excluir.** Se você nos escrever perguntando o que temos sobre você, a
resposta verdadeira é nada, e é isso que diremos. A única categoria que existe
é a de logs de acesso de hospedagem indexados por endereço IP, mantidos pelo nosso provedor de hospedagem
sob os padrões de retenção dele. Não temos como pesquisar ou excluir seletivamente
esses registros, e diremos isso em vez de fingir o contrário. Tudo
que é realmente *seu* está no seu dispositivo, onde você já pode ler, exportar
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
