# Perfis - quem você é quando cria

Um **perfil** é a identidade de trabalho com a qual a Lolly cria. É o pequeno conjunto de detalhes que uma ferramenta pode usar para você não precisar redigitá-los toda vez - seu nome, dados de contato, uma foto opcional, algumas preferências - além de tudo o que você acumula enquanto trabalha: sessões salvas, imagens enviadas e o total de atividade local.

Tudo em um perfil vive **no dispositivo**, no banco de dados local do navegador (IndexedDB no PWA web, o sistema de arquivos nos apps Tauri). Não existe conta e nada é enviado. Você o gerencia em **Perfil** (canto superior direito da galeria); as ferramentas apenas *leem* essas informações, e somente os campos específicos para os quais foram criadas para preencher automaticamente.

> Um perfil é sobre *você* (ou quem quer que esteja criando aqui). É distinto da **Platform** - as cores, fontes e configurações globais da marca - e das **Capabilities**, o catálogo do que o aplicativo pode fazer. Veja [Profile vs Platform vs Capabilities](#profile-vs-platform-vs-capabilities) no final.

## O que há em um perfil

| Parte | O que é |
|---|---|
| **Nome** | Nome e sobrenome. |
| **Contato** | E-mail e telefone. |
| **Localização** | Cidade e país. |
| **Foto de perfil** | Uma foto opcional, recortada em formato quadrado e mantida como imagem local. Usada por ferramentas como assinaturas de e-mail, cartões de citação, organogramas e layouts dinâmicos. |
| **Use my details to create** | Um único interruptor opcional (ele passa a exibir **Using my details** quando ativado). Ele controla se seus dados pessoais acompanham os arquivos como **provenance** - a linha de autoria/crédito incorporada nos arquivos exportados - e como autor nas execuções em lote do **/pro**. (Ele não controla o preenchimento automático: veja [Como as ferramentas usam seu perfil](#how-tools-use-your-profile).) |
| **Preferências** | Seu tema (Light, Dark ou Brand - o tema Brand pinta o aplicativo com a sua própria paleta) e quais partes do aplicativo você ativou via **Feature flags**. |
| **Acessibilidade** | Quatro interruptores de conforto - *Reduce motion*, *Hide colourful previews*, *High contrast*, *Large text* - mantidos no registro do perfil, então acompanham uma exportação de perfil. Veja [Acessibilidade](#accessibility). |
| **Seu trabalho** | Sessões salvas (com miniaturas) - organizadas em pastas aninhadas em **[Projects](/info/using.html)** - sua biblioteca **My images** e as estatísticas de atividade local, todas vinculadas a este perfil. |

![Three theme cards, each previewing its own type and colour, with the active one flagged](/t/url-shot?url=%2F%23%2Fprofile&width=1440&height=1400&dpi=192&waitMs=1600&walker=1&format=svg&cropSelector=.profile-card--appearance&dark=1&filename=pd-theme-picker)

![A tela Profile - nome, contato, uma foto opcional e suas preferências](/t/url-shot?url=%2F%23%2Fprofile&width=1440&height=900&dpi=192&waitMs=1600&format=svg&walker=1&localize=1&dark=1&filename=profile-details)

Nada disso é obrigatório. Um perfil em branco já é um bom perfil; você preenche apenas o que economiza digitação.

A página é longa, então ela tem sua própria **barra de configurações** lateral - Your details, Appearance, Accessibility, Lolly instance, Your activity, Storage, Available offline, Feature flags, Content Credentials - com um campo **Search settings** acima que filtra a lista à medida que você digita. Cada seção pode ser referenciada diretamente como `#/profile?focus=<section-id>`, o que a abre e rola a tela até ela (`#/profile?focus=storage-section`, `?focus=feature-flags-section`, e assim por diante), então um link pode apontar para uma configuração específica em vez do topo da página.

![Três cartões de tema, cada um exibindo em pré-visualização sua própria tipografia e cor, com o ativo sinalizado](/t/url-shot?url=%2F%23%2Fprofile&width=1440&height=1400&dpi=192&waitMs=1600&walker=1&format=svg&cropSelector=.profile-card--appearance&dark=1&filename=pd-theme-picker)

## Um perfil é um contexto, não apenas uma pessoa

A palavra "perfil" sugere uma única pessoa fixa, mas no Lolly é, na verdade, um **contexto de criação** - *quem você é enquanto cria isto*. Esse contexto pode assumir três formas diferentes, e o Lolly lida com todas elas da mesma maneira.

### Como indivíduo

![The headshot control, empty until you upload a photo that then stays on this device](/t/url-shot?url=%2F%23%2Fprofile&width=1440&height=900&dpi=192&waitMs=1600&format=svg&cropSelector=.profile-side&walker=1&dark=1&filename=pd-profile-headshot)

![O controle de foto de perfil, vazio até você enviar uma foto, que então permanece neste dispositivo](/t/url-shot?url=%2F%23%2Fprofile&width=1440&height=900&dpi=192&waitMs=1600&format=svg&cropSelector=.profile-side&walker=1&dark=1&filename=pd-profile-headshot)

### Como equipe

Um perfil não precisa representar uma única pessoa. Ele pode representar uma **equipe ou função dentro de uma organização**: o nome compartilhado da equipe, um endereço de caixa de entrada de grupo (`events@…`), um departamento, a foto ou a marca da unidade da equipe. Uma pessoa configura, exporta (veja abaixo) e o restante da equipe carrega o mesmo perfil - assim, tudo o que a equipe produz carrega detalhes consistentes sem que ninguém precise redigitá-los. Um quiosque compartilhado ou um notebook de demonstração emprestado pode rodar um único perfil de equipe com o qual todos por trás dele criam.

### Como função - um chapéu que você veste às vezes

Este é o caso que o modelo rígido de "uma pessoa, um perfil" não cobre. Você pode ser um **gerente de eventos três dias por ano** e outra coisa completamente diferente no resto do tempo. Nesses três dias você quer os detalhes do evento, a caixa de entrada do evento, talvez uma submarca do evento para preencher seus crachás e sinalizações; nos outros 362 dias você quer sua identidade normal de volta.

No Lolly, essa função é apenas **outro perfil que você mantém à mão** - um pacote salvo (próxima seção) que você carrega para o evento e guarda depois. A função é um chapéu, não uma nova conta. Vista-o quando precisar, tire-o quando terminar.

## Uma instalação, um perfil ativo - vários que você pode manter

A qualquer momento, uma instalação tem **um perfil ativo** - os detalhes que uma ferramenta vê agora. Não há um alternador de perfis dentro do aplicativo; em vez disso, cada perfil é um **pacote portátil** (um único `.zip`, veja [abaixo](#moving-a-profile-to-a-new-device)). Esse é deliberadamente o mesmo mecanismo usado para mudar de dispositivo - um perfil é um arquivo que você pode salvar, copiar e carregar.

![The storage meter, breaking down saved sessions, images and cache against what the browser actually reports](/t/url-shot?url=%2F%23%2Fprofile%3Ffocus%3Dstorage-section&width=1440&height=1800&dpi=192&waitMs=2400&css=.store-manages%2C.storage-subsection%2C.storage-actions%7Bdisplay%3Anone%7D&walker=1&format=svg&cropSelector=.store-meter&dark=1&filename=pd-storage-meter)

- <!--i:trash--> **Troca mais limpa:** **Profile → Storage → Clear all my data**, depois **Import** o pacote do contexto para o qual você está indo. Agora você está criando puramente como esse perfil.
- <!--i:layers--> **Camadas:** importar *sem* limpar antes **mescla** - o perfil, as sessões e as imagens importados entram por cima do que já existe, substituindo tudo com o mesmo nome e deixando o resto intacto. Útil para trazer as sessões salvas de uma equipe para dentro da sua própria configuração; não é o que você quer se precisar de uma fronteira de papéis limpa.
- <!--i:monitor--> **Lado a lado:** como tudo é restrito ao dispositivo, um perfil de navegador separado, uma conta de usuário separada ou um segundo PWA instalado carregam, cada um, seu próprio perfil independente da Lolly. Rode sua instalação pessoal e a instalação do quiosque do evento ao mesmo tempo, sem trocar.

Então, se você realmente alterna entre vários contextos (você, sua equipe, o chapéu de gerente de eventos), você mantém vários pacotes e carrega o que precisar:

![O medidor de armazenamento, detalhando sessões salvas, imagens e cache em relação ao que o navegador realmente informa](/t/url-shot?url=%2F%23%2Fprofile%3Ffocus%3Dstorage-section&width=1440&height=1800&dpi=192&waitMs=2400&css=.store-manages%2C.storage-subsection%2C.storage-actions%7Bdisplay%3Anone%7D&walker=1&format=svg&cropSelector=.store-meter&dark=1&filename=pd-storage-meter)

> Mantenha um pacote por contexto e renomeie os arquivos de acordo com o que representam (`LollyTools-events-2026.zip`, `LollyTools-me.zip`). O arquivo *é* o perfil.

## Acessibilidade

**Profile → Accessibility** reúne quatro configurações de conforto para o aplicativo *ao redor* do seu trabalho. Cada uma vem desativada até você ativá-la, e nenhuma delas alcança o interior da tela de uma ferramenta ou de uma exportação - um aplicativo mais calmo não pode mover um único pixel do arquivo que você entrega.

- <!--i:film--> **Reduce motion** - desativa as transições, os slides e os floreios animados do aplicativo. A tela da sua ferramenta e qualquer exportação animada continuam se movendo exatamente como projetado.
- <!--i:image--> **Hide colourful previews** - troca as artes de pré-visualização da galeria por cartões calmos de ícone e texto, e reduz a cor e o contraste das miniaturas dos seus projetos para que continuem reconhecíveis sem chamar tanta atenção. Dentro de uma ferramenta, tudo aparece em cores plenas.
- <!--i:sliders--> **High contrast** - reforça as bordas, o texto e os anéis de foco do aplicativo. As cores da sua marca e tudo na tela permanecem exatamente como você definiu.
- <!--i:font--> **Large text** - aumenta a tipografia do aplicativo: rótulos, menus e texto dos botões. Os controles mantêm seu tamanho, então só as palavras dentro deles ficam maiores, e a tipografia dentro dos seus designs não é tocada, então nada que você exporta se realinha.

Elas ficam no próprio registro do perfil, por isso viajam em uma exportação de perfil e chegam à próxima instalação junto com o seu nome e as suas sessões. (O dispositivo também mantém um pequeno espelho local para que a configuração seja aplicada antes da primeira renderização na tela; esse espelho é exclusivo do dispositivo e não viaja.)

## Sua instância da Lolly

**Profile → Lolly instance** informa de onde essa instalação obtém suas ferramentas e catálogo - o endereço da instância, ou *Bundled with this app* quando tudo vem embutido no build. Onde uma implantação oferece um, um link **Instance console** abre sua superfície administrativa, e **Change** / **Disconnect** redirecionam a instalação ou a desvinculam.

Redirecionar para outra instância exige o **aplicativo desktop**: um navegador bloqueia uma página de carregar ferramentas e recursos entre origens diferentes, então na web a seção apenas informa onde você está e para por aí.

## Disponível offline

A Lolly armazena em cache conforme você usa, mas o cache-conforme-você-usa só cobre onde você já esteve. **Profile → Available offline** é para a viagem que você já vê chegando: uma hora de wifi de aeroporto antes de um voo sem nenhuma conexão. Baixe as partes de que você vai precisar, acompanhe uma única barra de progresso, e tudo o que você baixou continua funcionando mesmo com a conexão ausente.

Sete partes, cada uma com o tamanho informado antes de você confirmar:

- <!--i:layout--> **The app** - todas as telas, editores e fontes, incluindo os que você ainda não abriu. Sem isso, uma tela que você nunca visitou online não consegue carregar offline.
- <!--i:image--> **Catalogue** - recursos de marca além dos essenciais. Leve tudo, ou abra *Choose by tag* e leve só as tags que você usa.
- <!--i:book--> **Guides & docs** - este site de documentação, no seu idioma, com capturas de tela incluídas.
- <!--i:cpu--> **Speech voices** - os modelos de voz por trás do áudio e narração do Script. Baixados uma vez, depois rodam no dispositivo.
- <!--i:zap--> **Upscaling models** - os upscalers de imagem por IA: foto, ilustração/anime e rosto.
- <!--i:layers--> **Background removal** - os modelos de recorte no dispositivo por trás do *Remove background*.
- <!--i:shield--> **Verify deep scan** - o scanner de marca d'água no dispositivo, para verificar Content Credentials longe de uma conexão.

Os últimos quatro estão marcados como **download grande**, e são propositalmente opt-ins individuais: **Download everything**, no topo, leva o app, o escopo de catálogo que você escolheu, os docs e todas as ferramentas numa só passada e mais nada. Vozes de fala, os upscalers, remoção de fundo e a varredura profunda só baixam quando você pede aquela linha pelo nome - algumas centenas de megabytes escondidas dentro de um botão seria desonesto.

Abaixo das partes fica a lista por ferramenta: cada ferramenta baixa individualmente (o tique significa pronta offline), ou **Download all** varre tudo. Os downloads são retomáveis - cancele ou perca a conexão e a próxima execução continua de onde parou, buscando só o que falta - e eles se atualizam sozinhos quando você volta a ficar online, puxando só o que uma nova versão mudou.

Se o navegador não concedeu armazenamento persistente, a seção diz isso e oferece **Protect downloads**, que pede a permissão - a diferença entre "baixado" e "baixado até o navegador querer o espaço de volta".

## Movendo um perfil para um novo dispositivo

![The two buttons that move a whole install: Export my data writes one zip, Import data reads it back](/t/url-shot?url=%2F%23%2Fprofile%3Ffocus%3Dstorage-section&width=1440&height=1800&dpi=192&waitMs=2400&css=.store-manages%7Bdisplay%3Anone%7D&walker=1&format=svg&cropSelector=.storage-subsection&dark=1&filename=pd-transfer-controls)

Como um perfil é totalmente local, a única forma de levá-lo para uma instalação em branco - um laptop novo, um navegador recém-resetado, a máquina de um colega, um computador offline - é **carregar o arquivo**. Nenhum login o restaura para você, e esse é o objetivo: nada jamais saiu do seu dispositivo, para começar.

- <!--i:download--> **Export my data** baixa um `LollyTools-<First>-<Last>-<YYYY-MM-DD>-<n>.zip` - nomeado conforme o perfil a que pertence, com um número de sequência diário para exportações repetidas não colidirem (partes do nome são omitidas quando o perfil não as tem). Ele contém seu perfil, cada sessão salva (com sua miniatura), suas imagens enviadas - seus tokens de marca e fontes instaladas viajam junto como assets do usuário - e suas preferências (tema, layout, estatísticas de atividade local).
- <!--i:upload--> **Import data…** na outra instalação lê esse arquivo de volta e você retoma exatamente de onde parou.
- <!--i:box--> **Export my data & render everything** grava esse mesmo backup *mais* um segundo zip que renderiza cada sessão salva para seu arquivo de saída final, em pastas que espelham seus Projects. Um arquivo offline completo tanto das fontes quanto dos resultados - e pode ficar grande e lento com muitas sessões.

![Os dois botões que movem uma instalação inteira: Export my data grava um zip, Import data o lê de volta](/t/url-shot?url=%2F%23%2Fprofile%3Ffocus%3Dstorage-section&width=1440&height=1800&dpi=192&waitMs=2400&css=.store-manages%7Bdisplay%3Anone%7D&walker=1&format=svg&cropSelector=.storage-subsection&dark=1&filename=pd-transfer-controls)

O pacote é um zip simples e autocontido, então ele viaja por **qualquer** meio - USB, AirDrop, um compartilhamento de rede, e-mail para si mesmo - e o destino pode estar completamente offline. Cada parte tem checksum, então um arquivo danificado no transporte é detectado na importação em vez de ser restaurado pela metade. A importação **mescla** (perfil/sessão/imagem com o mesmo nome é sobrescrito; todo o resto é mantido), então ela nunca apaga um destino que já estava em uso.

O que não viaja: o cache do catálogo (ele se baixa novamente sozinho no novo dispositivo) e as próprias ferramentas (presumidas já presentes).

Para o layout exato do pacote, política de versão e regras de integridade, veja **[Data Transfer](/info/data-transfer.html)**; para o passo a passo completo, **[Using Lolly → Moving to another device](/info/using.html#moving-to-another-device)**.

## Como as ferramentas usam seu perfil

![The single Use my details switch, sitting beside Save Profile and off until you turn it on](/t/url-shot?url=%2F%23%2Fprofile&width=1440&height=900&dpi=192&waitMs=1600&format=svg&cropSelector=.profile-check&walker=1&dark=1&filename=pd-use-my-details)

Uma ferramenta só *pré-preenche* os campos do perfil para os quais foi explicitamente construída:

**O opt-in (proveniência).** Ao exportar um asset, seus dados opcionalmente viajam junto como **proveniência** - uma linha de autor/crédito embutida nos metadados do arquivo (PNG, PDF, SVG, …) - para que um asset finalizado possa dizer quem o fez. *Isso* é o que **Use my details to create** rege: deixe desligado e a exportação ainda carrega a atribuição de ferramenta/plataforma "Made with Lolly", mas nenhuma linha pessoal de autor/contato é embutida. (O mesmo opt-in define o autor nas execuções em lote do **/pro**.) (Autores de ferramentas: veja [Authoring Tools → `bindToProfile`](/info/authoring-tools.html#bindtoprofile) e [Host API → `host.profile`](/info/host-api.html#host-profile).)

![O único switch Use my details to create, ao lado de Save Profile e desligado até você ativá-lo](/t/url-shot?url=%2F%23%2Fprofile&width=1440&height=900&dpi=192&waitMs=1600&format=svg&cropSelector=.profile-check&walker=1&dark=1&filename=pd-use-my-details)

## Perfil vs Plataforma vs Capacidades

Três coisas ficam próximas na interface e são fáceis de confundir:

- <!--i:people--> **Profile** - *você* (ou sua equipe, ou o papel que você ocupa): nome, contato, foto, seu trabalho salvo. Pessoal, local ao dispositivo, portátil como pacote.
- <!--i:palette--> **Platform** - a *marca*: cores, fontes e configurações globais sobre as quais toda ferramenta renderiza. Compartilhada e consistente, não pessoal.
- <!--i:sliders--> **Capabilities** - *o que o app pode fazer*: o conjunto completo de recursos e as ferramentas disponíveis para você.

Um perfil muda de quem um ativo *é*; a plataforma muda a *aparência* dele; as capacidades são *o que você pode criar*.

### "Perfil" significa duas outras coisas em outros lugares - não esta

A palavra é sobrecarregada em todo o projeto. Nenhuma das duas é o perfil pessoal do qual esta página trata:

- <!--i:box--> **Content profile** - uma configuração em tempo de build no `profiles.json` que vincula um conjunto de pacotes de ferramentas a um catálogo de marca (por exemplo, `suse`, `lolly-start`). É o que um operador escolhe ao implantar, e é o que o **parâmetro de URL/CLI** `profile` também seleciona como uma variante de *cor* no momento da exportação (a condição de prova ICC/CMYK - veja [URL Mode](/info/url-mode.html)). Ambos dizem respeito ao *build/saída*, não a *você*. Veja [Configuration](/info/configuration.html).
- <!--i:seal--> **Identity profile** - a **identidade verificada de Content Credentials** opcional que você pode registrar (um certificado de curta duração que vincula seu e-mail às suas exportações assinadas). É uma identidade de assinatura, separada dos campos de nome/contato do perfil pessoal, embora **Use my details to create** determine se algum dos dois é embutido. Veja [Content Credentials Identity](/info/content-credentials-identity.html).

![O cartão Verified identity, na largura de um telefone: o seletor de tempo de vida do certificado e o passo de registro abaixo dele - o perfil de identidade, separado dos seus dados pessoais](/t/url-shot?url=%2F%23%2Fprofile%3Ffocus%3Didentity-section&width=430&height=1600&dpi=192&waitMs=2400&css=.welcome-dialog%2C.personalize-nudge%7Bdisplay%3Anone%7D&format=svg&walker=1&cropSelector=%23identity-section&dark=1&filename=pv-identity-enrol)

## Privacidade

Fora o registro de identidade opcional acima (que envia o e-mail que você registra ao serviço de certificado - veja [Server Surface](/info/server-surface.html)), um perfil nunca é transmitido, enviado ou usado para identificá-lo ou rastreá-lo - não há nada a consentir, só este aviso para você saber o que é mantido. Apague tudo a qualquer momento com **Profile → Clear all my data**. Veja a [Privacy Policy](/info/privacy.html).
